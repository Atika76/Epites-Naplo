const fs=require('node:fs');
const {sql,check,as,owner,other,concurrent,ready,assert}=require('./pg-helper.cjs');
const file=p=>sql(fs.readFileSync(p,'utf8'));
file('tests/bootstrap.sql');file('supabase-schema.sql');file('supabase/szakipiac_import_schema.sql');
const migration='supabase/migrations/202610180001_szakipiac_import_stabilization.sql';file(migration);file(migration);
sql('grant select on projects,entries,tasks,project_materials to authenticated;');
let seq=0;
const plan={location:'Test city',phase:'Burkolás',note:'Accepted quote',items:[{name:'Burkolás',type:'munka',quantity:2,unit:'m²',material_total:200,labor_total:300}],ai:{}};
function register(){const id=`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`;const row={protocol_version:2,source_status:'accepted',source_quote_id:id,accepted_at:'2026-10-18T00:00:00Z',owner_email:'owner@example.test',token:'token-'+seq,project_name:'Accepted project',client_name:'Client',quote_total_gross:127000,payload:{items:plan.items}};const call=`set role service_role;select register_szakipiac_import_v2('${JSON.stringify(row)}');`;return {row,call,data:JSON.parse(sql(call))};}
const claim=(token,user=owner)=>`set role service_role;select claim_szakipiac_import_v2('${token}','${user}','${JSON.stringify(plan)}');`;
check('migration repeats and creates no historical evidence',()=>assert.equal(sql('select count(*) from project_import_requests'),'0'));
const r=register();
check('registration is idempotent',()=>{sql(r.call);assert.equal(sql(`select count(*) from project_import_requests where source_quote_id='${r.row.source_quote_id}'`),'1')});
check('browser roles cannot call trusted registration/claim RPCs',()=>{sql('set role anon;select register_szakipiac_import_v2(\'{}\');',false);sql(as(owner,`select claim_szakipiac_import_v2('${r.row.token}','${owner}','{}');`),false)});
check('wrong destination account cannot claim',()=>sql(claim(r.row.token,other),false));
let result=JSON.parse(sql(claim(r.row.token)));
check('complete import has real counts and preserves quote',()=>{assert.equal(result.status,'complete');assert.deepEqual(result.inserted,{projects:1,entries:1,imports:1,materials:1,tasks:1,diary:1});assert.equal(sql(`select quote_total_gross from project_imports where project_id='${result.project_id}'`),'127000')});
check('second claim reuses project with no duplicate entries',()=>{const again=JSON.parse(sql(claim(r.row.token)));assert.equal(again.project_id,result.project_id);assert.equal(again.already_claimed,true);assert.equal(sql(`select count(*) from entries where project_id='${result.project_id}'`),'1')});
check('project RLS prevents foreign account reading journal',()=>assert.equal(sql(as(other,`select count(*) from projects where id='${result.project_id}'`)),'0'));
// Inject a real PostgreSQL material failure, retry only the failed step.
sql(`create function test_fail_material() returns trigger language plpgsql as $$ begin raise exception 'injected material failure';end;$$;
create trigger test_material before insert on project_materials for each row execute function test_fail_material();`);
const partial=register();const first=JSON.parse(sql(claim(partial.row.token)));
check('partial failure is durable and successful counts are truthful',()=>{assert.equal(first.status,'partial');assert.equal(first.inserted.materials,0);assert.equal(first.inserted.tasks,1);assert.match(first.warnings.join(),/injected material/);assert.equal(sql(`select import_status from project_import_requests where id='${partial.data.id}'`),'partial')});
sql('drop trigger test_material on project_materials;');
check('retry repairs missing materials without duplicating tasks or entries',()=>{const retry=JSON.parse(sql(claim(partial.row.token)));assert.equal(retry.status,'complete');assert.equal(retry.project_id,first.project_id);assert.equal(sql(`select count(*) from tasks where project_id='${first.project_id}'`),'1');assert.equal(sql(`select count(*) from project_materials where project_id='${first.project_id}'`),'1')});
sql(`create function test_fail_entry() returns trigger language plpgsql as $$begin raise exception 'injected core failure';end;$$;
create trigger test_entry before insert on entries for each row execute function test_fail_entry();`);
const failed=register(),before=sql('select count(*) from projects');const fail=JSON.parse(sql(claim(failed.row.token)));
check('critical failure rolls back ALL core writes and keeps retry state',()=>{assert.equal(fail.ok,false);assert.equal(sql('select count(*) from projects'),before);assert.equal(sql(`select import_status from project_import_requests where id='${failed.data.id}'`),'failed')});
sql('drop trigger test_entry on entries;');
check('critical failure can be retried successfully',()=>assert.equal(JSON.parse(sql(claim(failed.row.token))).status,'complete'));
check('historical pending import without verification is blocked, not changed',()=>{sql(`insert into project_import_requests(token,source_quote_id,project_name) values('legacy-pending','legacy','Historical');`);const x=JSON.parse(sql(claim('legacy-pending')));assert.equal(x.ok,false);assert.equal(sql("select project_name from project_import_requests where token='legacy-pending'"),'Historical')});
check('historical claimed project is reused without modifying it',()=>{sql(`insert into project_import_requests(token,source_quote_id,project_name,claimed_project_id,claimed_by) values('legacy-claimed','old','Historical','${result.project_id}','${owner}');`);const x=JSON.parse(sql(claim('legacy-claimed')));assert.equal(x.project_id,result.project_id);assert.equal(x.status,'legacy');assert.ok(x.warnings.length);sql(claim('legacy-claimed',other),false)});
(async()=>{
 const next=register();
 const holder=concurrent(`begin;select pg_advisory_xact_lock(hashtextextended('szakipiac:${next.row.source_quote_id}',0));\\echo READY
select pg_sleep(1);${claim(next.row.token)}commit;`);
 await ready(holder);const waiting=concurrent(claim(next.row.token));
 const [a,b]=await Promise.all([holder.done,waiting.done]);assert.equal(a.code,0,a.err);assert.equal(b.code,0,b.err);
 const id=sql(`select claimed_project_id from project_import_requests where token='${next.row.token}'`);assert.equal(sql(`select count(*) from project_imports where source_quote_id='${next.row.source_quote_id}'`),'1');assert.equal(sql(`select count(*) from entries where project_id='${id}'`),'1');console.log('PASS simultaneous claims produce one real project and one initial entry');
 console.log('PostgreSQL/RLS integration completed successfully.');
})().catch(e=>{console.error(e);process.exitCode=1});
