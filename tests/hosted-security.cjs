// Runs after the hosted-schema integration suite, on disposable PostgreSQL 17 only.
const fs=require('node:fs');const {sql,check,as,owner,other,assert}=require('./pg-helper.cjs');
const tables=JSON.parse(fs.readFileSync('tests/hosted-schema-provenance.json')).tables;
const naplo=tables.includes('projects');
const rights=()=>JSON.parse(sql(`select jsonb_agg(jsonb_build_array(c.relname,r.rolname,p.name,has_table_privilege(r.oid,c.oid,p.name)) order by c.relname,r.rolname,p.name)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) p(name)
 where n.nspname='public' and c.relkind='r' and r.rolname in ('anon','authenticated','service_role');`));
const before=rights();
check('captured live fixture reproduces direct browser TRUNCATE grants',()=>{
 const table=naplo?'projects':'ajanlatok';for(const role of ['anon','authenticated'])assert.equal(sql(`select has_table_privilege('${role}','public.${table}','TRUNCATE')`),'t');
});
// Demonstrate the RLS bypass on a synthetic table, never on hosted data.
sql(`create table public.test_truncate_probe(id int);alter table public.test_truncate_probe enable row level security;
 insert into public.test_truncate_probe values(1);grant select,truncate on public.test_truncate_probe to anon;`);
check('TRUNCATE bypasses RLS on synthetic disposable table',()=>{
 assert.equal(sql('set role anon;select count(*) from public.test_truncate_probe'),'0');
 sql('set role anon;truncate public.test_truncate_probe;');assert.equal(sql('select count(*) from public.test_truncate_probe'),'0');
});
sql('drop table public.test_truncate_probe;create role supabase_admin nologin;');
for(const creator of ['postgres','supabase_admin'])sql(`alter default privileges for role ${creator} in schema public grant truncate on tables to anon,authenticated;`);
const proposal=fs.readFileSync('docs/proposals/revoke-browser-truncate.sql','utf8');
// The proposal inventories all live public tables. This fixture models only the
// affected subset: execute its matching statements plus both creator defaults.
const statements=proposal.split('\n').filter(line=>line.startsWith('ALTER DEFAULT')||(line.startsWith('REVOKE TRUNCATE')&&tables.some(t=>line.includes('public."'+t+'"'))));
sql('begin;'+statements.join('\n')+'commit;');sql('begin;'+statements.join('\n')+'commit;');
check('minimum proposal removes TRUNCATE and is repeatable',()=>{
 for(const t of tables)for(const role of ['anon','authenticated'])assert.equal(sql(`select has_table_privilege('${role}','public."${t}"','TRUNCATE')`),'f');
 assert.deepEqual(rights(),before,'CRUD, REFERENCES, TRIGGER, MAINTAIN or service role changed');
});
check('new tables from both creator roles no longer inherit TRUNCATE',()=>{
 for(const creator of ['postgres','supabase_admin']){
  sql(`grant create on schema public to ${creator};set role ${creator};create table public.test_default_${creator}(id int);`);
  for(const role of ['anon','authenticated'])assert.equal(sql(`select has_table_privilege('${role}','public.test_default_${creator}','TRUNCATE')`),'f');
  sql(`drop table public.test_default_${creator};`);
 }
});
if(naplo){
 const id='f1111111-1111-4111-8111-111111111111';
 check('standalone journal CRUD, daily photos/tasks/materials survive minimum rights change',()=>{
  sql(as(owner,`insert into projects(id,user_id,name) values('${id}','${owner}','Standalone');
   insert into entries(user_id,project_id,note,image_urls,video_urls) values('${owner}','${id}','Daily note','["synthetic-photo.jpg"]','["synthetic-video.mp4"]');
   insert into tasks(user_id,project_id,title) values('${owner}','${id}','Daily task');
   insert into project_materials(user_id,project_id,name,quantity) values('${owner}','${id}','Daily material',2);
   update projects set progress=25 where id='${id}';`));
  assert.equal(sql(as(owner,`select image_urls->>0 from entries where project_id='${id}'`)),'synthetic-photo.jpg');
  assert.equal(sql(as(other,`select count(*) from projects where id='${id}'`)),'0');
  assert.equal(sql(as(other,`select count(*) from entries where project_id='${id}'`)),'0');
  sql(as(owner,`delete from tasks where project_id='${id}';delete from project_materials where project_id='${id}';delete from entries where project_id='${id}';delete from projects where id='${id}';`));
 });
 check('profile field restrictions remain effective',()=>{
  for(const col of ['role','email','is_admin'])assert.equal(sql(`select has_column_privilege('authenticated','profiles','${col}','UPDATE')`),'f');
  assert.equal(sql(`select has_column_privilege('authenticated','profiles','company_name','UPDATE')`),'t');
 });
 check('hosted legacy timestamp and absent historical FKs are preserved',()=>{
  assert.equal(sql("select data_type from information_schema.columns where table_schema='public' and table_name='diary_entries' and column_name='created_at'"),'timestamp without time zone');
  assert.equal(sql("select count(*) from pg_constraint where conrelid='project_materials'::regclass and contype='f'"),'0');
 });
}else{
 check('standalone quote and optional unlinked KivitelezesPRO save remain usable',()=>{
  sql(as(owner,`insert into ajanlatok(user_id,project_name) values('${owner}','Standalone quote');`));
  const saved=JSON.parse(sql(as(owner,`select save_kivitelezes_project_v2('f1111111-1111-4111-8111-111111111111',null,'{"project_name":"Optional standalone","payload":{}}');`)));
  assert.equal(saved.revision,1);assert.equal(saved.source_quote_id,null);
 });
}
console.log('Hosted-schema security/standalone checks completed. No production privileges modified.');
