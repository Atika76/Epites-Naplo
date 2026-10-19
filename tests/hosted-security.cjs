// Runs after the hosted-schema integration suite, on disposable PostgreSQL 17 only.
const fs=require('node:fs');const {sql,sqlError,check,as,owner,other,assert}=require('./pg-helper.cjs');
const tables=JSON.parse(fs.readFileSync('tests/hosted-schema-provenance.json')).tables;
const naplo=tables.includes('projects');
check('SQLSTATE assertion rejects syntax errors as intentional migration interruption',()=>{
 const malformed="do $ begin raise exception 'injected migration interruption'; end $;";
 assert.throws(()=>sqlError(malformed,'P0001','injected migration interruption'),{code:'ERR_ASSERTION'});
 sqlError(malformed,'42601','syntax error');
});
const captured=JSON.parse(fs.readFileSync('tests/hosted-default-acl.json'));
const browserRoles=['anon','authenticated'],creators=['postgres','supabase_admin'];
const aclTables=[...new Set(captured.public_tables.map(row=>row.table_name))];
// Unrelated tables are ACL-only placeholders, NOT a claim to model their schema.
// This lets us execute the exact complete proposals, rather than filter their SQL.
for(const table of aclTables)if(sql(`select to_regclass('public."${table}"')`)==='')sql(`create table public."${table}"(id int);`);
sql('create role supabase_admin nologin;');
for(const row of captured.public_tables)sql(`grant truncate on public."${row.table_name}" to "${row.grantee}";`);
for(const row of captured.defaults)sql(`alter default privileges for role "${row.creator}" ${row.scope==='GLOBAL'?'':'in schema public'} grant ${row.privilege_type} on tables to "${row.grantee}"${row.is_grantable?' with grant option':''};`);
const defaultRows=()=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(x) order by creator,scope,grantee,privilege_type),'[]') from (
 select pg_get_userbyid(d.defaclrole) as creator,case when d.defaclnamespace=0 then 'GLOBAL' else n.nspname end as scope,
 case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,a.privilege_type,a.is_grantable
 from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace cross join lateral aclexplode(d.defaclacl) a
 where pg_get_userbyid(d.defaclrole) in ('postgres','supabase_admin') and d.defaclobjtype='r' and (d.defaclnamespace=0 or n.nspname='public'))x;`));
const normalized=rows=>rows.map(row=>JSON.stringify([row.creator,row.scope,row.grantee,row.privilege_type,row.is_grantable])).sort();
const otherDefaults=rows=>normalized(rows.filter(row=>!(browserRoles.includes(row.grantee)&&row.privilege_type==='TRUNCATE')));
const rights=()=>JSON.parse(sql(`select jsonb_agg(jsonb_build_array(c.relname,r.rolname,p.name,has_table_privilege(r.oid,c.oid,p.name)) order by c.relname,r.rolname,p.name)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join pg_roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'),('TRUNCATE')) p(name)
 where n.nspname='public' and c.relkind='r' and r.rolname in ('anon','authenticated','service_role') and not(p.name='TRUNCATE' and r.rolname in ('anon','authenticated'));`));
const before=rights(),defaultsBefore=defaultRows();
check('both creators reproduce captured GLOBAL/public default ACLs; GLOBAL is absent',()=>{
 assert.deepEqual(normalized(defaultsBefore),normalized(captured.defaults));
 for(const creator of creators){
  assert.equal(defaultsBefore.filter(row=>row.creator===creator&&row.scope==='GLOBAL').length,0);
  for(const role of browserRoles)assert.ok(defaultsBefore.some(row=>row.creator===creator&&row.scope==='public'&&row.grantee===role&&row.privilege_type==='TRUNCATE'));
 }
});
check('all captured public tables reproduce exact direct browser TRUNCATE grants',()=>{
 for(const table of aclTables)for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),captured.public_tables.some(row=>row.table_name===table&&row.grantee===role)?'t':'f');
});
// Demonstrate the RLS bypass on a synthetic table, never on hosted data.
sql(`create table public.test_truncate_probe(id int);alter table public.test_truncate_probe enable row level security;
 insert into public.test_truncate_probe values(1);grant select,truncate on public.test_truncate_probe to anon;`);
check('TRUNCATE bypasses RLS on synthetic disposable table',()=>{
 assert.equal(sql('set role anon;select count(*) from public.test_truncate_probe'),'0');
 sql('set role anon;truncate public.test_truncate_probe;');assert.equal(sql('select count(*) from public.test_truncate_probe'),'0');
});
sql('drop table public.test_truncate_probe;');
const browserProposal=fs.readFileSync('docs/proposals/revoke-browser-truncate.sql','utf8');
const platformProposal=fs.readFileSync('docs/proposals/revoke-platform-default-truncate.sql','utf8');
check('new tables under BOTH creators inherit the captured broad defaults BEFORE the proposals',()=>{
 for(const creator of creators){
  sql(`grant create on schema public to ${creator};set role ${creator};create table public.test_default_before(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_default_before','TRUNCATE')`),'t');
  sql('drop table public.test_default_before;');
 }
});
// Real hosted postgres is NOT a platform operator. This local superuser only
// models the separately authorized platform script; the boundary is tested below.
sql(browserProposal);sql(platformProposal);sql(browserProposal);sql(platformProposal);
check('exact repeatable proposals remove TRUNCATE from ALL inventoried public tables only',()=>{
 for(const table of aclTables)for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),'f');
 assert.deepEqual(rights(),before,'CRUD/other grants or service_role TRUNCATE changed');
 assert.deepEqual(otherDefaults(defaultRows()),otherDefaults(defaultsBefore),'Non-TRUNCATE defaults changed');
});
check('new public tables under BOTH creators lose browser TRUNCATE but preserve all other defaults',()=>{
 for(const creator of creators){
  sql(`set role ${creator};create table public.test_default_after(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_default_after','TRUNCATE')`),'f');
  for(const row of captured.defaults.filter(row=>row.creator===creator&&!(browserRoles.includes(row.grantee)&&row.privilege_type==='TRUNCATE')))
   assert.equal(sql(`select has_table_privilege('${row.grantee}','public.test_default_after','${row.privilege_type}')`),'t');
  sql('drop table public.test_default_after;');
 }
});
check('adversarial GLOBAL grants survive schema REVOKE; BOTH proposals refuse them atomically',()=>{
 for(const creator of creators){
  sql(`alter default privileges for role ${creator} grant truncate on tables to anon,authenticated;
   alter default privileges for role ${creator} in schema public revoke truncate on tables from anon,authenticated;
   set role ${creator};create table public.test_global_default(id int);`);
  for(const role of browserRoles)assert.equal(sql(`select has_table_privilege('${role}','public.test_global_default','TRUNCATE')`),'t');
  sql('drop table public.test_global_default;');
  const prior=normalized(defaultRows());
  sqlError(creator==='postgres'?browserProposal:platformProposal,'P0001','Global TRUNCATE default requires separate review for '+creator);
  assert.deepEqual(normalized(defaultRows()),prior);assert.deepEqual(rights(),before);
  sql(`alter default privileges for role ${creator} revoke truncate on tables from anon,authenticated;`);
 }
 assert.deepEqual(otherDefaults(defaultRows()),otherDefaults(defaultsBefore));
});
if(naplo){
 check('hosted Auth trigger provisions profile and trial subscription without a missing dependency',()=>{
  const id='f5555555-5555-4555-8555-555555555555';
  sql(`insert into auth.users(id,email,raw_user_meta_data) values('${id}','new-user@example.test','{"full_name":"Synthetic new user"}');`);
  assert.equal(sql(`select count(*) from profiles where id='${id}'`),'1');
  assert.equal(sql(`select count(*) from subscriptions where user_id='${id}' and plan='trial'`),'1');
 });
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
if(naplo){
 const project='f2222222-2222-4222-8222-222222222222',ownProject='f3333333-3333-4333-8333-333333333333';
 const children=[['entries','note'],['tasks','title'],['project_materials','name'],['diary_entries','description']];
 const ids={},legacy={};
 sql(as(owner,`insert into projects(id,user_id,name) values('${project}','${owner}','Ownership guard');`));
 sql(as(other,`insert into projects(id,user_id,name) values('${ownProject}','${other}','Other own project');`));
 const policies=()=>JSON.parse(sql("select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public';"));
 const originalPolicies=policies();
 for(const [table,column] of children){
  ids[table]=sql(as(other,`insert into ${table}(user_id,project_id,${column}) values('${other}','${ownProject}','Own baseline') returning id;`));
  if(table!=='project_materials')legacy[table]=sql(as(owner,`insert into ${table}(user_id,${column}) values('${owner}','Legacy unassigned') returning id;`));
 }
 const legacySnapshot=()=>Object.keys(legacy).map(table=>sql(`select to_jsonb(x) from ${table} x where id='${legacy[table]}';`));
 const legacyBefore=legacySnapshot();
 check('OLD RLS permits foreign-project INSERT in all four child tables (rolled back)',()=>{
  for(const [table,column] of children){
   const result=sql(`begin;${as(other,`insert into ${table}(user_id,project_id,${column}) values('${other}','${project}','Rolled-back INSERT proof') returning project_id;`)}rollback;`);
   assert.equal(result,project);
  }
 });
 check('OLD RLS permits foreign-project UPDATE in entries/tasks/materials (rolled back)',()=>{
  for(const table of ['entries','tasks','project_materials']){
   assert.equal(sql(`begin;${as(other,`update ${table} set project_id='${project}' where id='${ids[table]}' returning project_id;`)}rollback;`),project);
   assert.equal(sql(`select project_id from ${table} where id='${ids[table]}'`),ownProject);
  }
 });
 check('OLD diary RLS already denies ALL browser UPDATEs, including legitimate owner edits',()=>{
  assert.equal(sql("select count(*) from pg_policies where schemaname='public' and tablename='diary_entries' and cmd in ('UPDATE','ALL')"),'0');
  assert.equal(sql(as(other,`update diary_entries set project_id='${project}' where id='${ids.diary_entries}' returning id;`)),'');
  assert.equal(sql(as(other,`update diary_entries set description='Own edit' where id='${ids.diary_entries}' returning id;`)),'');
  assert.equal(sql(`select project_id from diary_entries where id='${ids.diary_entries}'`),ownProject);
  assert.equal(sql(`select description from diary_entries where id='${ids.diary_entries}'`),'Own baseline');
 });
 const proposal=fs.readFileSync('docs/proposals/enforce-project-write-ownership.sql','utf8');sql(proposal);sql(proposal);
 check('NEW proposal preserves every old policy and only adds eight restrictive checks',()=>{
  const current=policies();
  for(const policy of originalPolicies)assert.deepEqual(current.find(row=>row.tablename===policy.tablename&&row.policyname===policy.policyname),policy);
  const added=current.filter(row=>!originalPolicies.some(old=>old.tablename===row.tablename&&old.policyname===row.policyname));
  assert.equal(added.length,8);assert.ok(added.every(row=>row.permissive==='RESTRICTIVE'&&['INSERT','UPDATE'].includes(row.cmd)));
 });
 check('NEW RLS rejects previously permitted foreign-project INSERTs with SQLSTATE 42501',()=>{
  for(const [table,column] of children)sqlError(as(other,`insert into ${table}(user_id,project_id,${column}) values('${other}','${project}','Forbidden');`),'42501','row-level security policy');
 });
 check('NEW RLS rejects previously permitted foreign-project UPDATEs with SQLSTATE 42501',()=>{
  for(const table of ['entries','tasks','project_materials']){
   sqlError(as(other,`update ${table} set project_id='${project}' where id='${ids[table]}' returning id;`),'42501','row-level security policy');
   assert.equal(sql(`select project_id from ${table} where id='${ids[table]}'`),ownProject);
  }
 });
 check('NEW diary UPDATE check is defense in depth; existing zero-row denial remains unchanged',()=>{
  for(const edit of [`project_id='${project}'`,"description='Own edit'"])
   assert.equal(sql(as(other,`update diary_entries set ${edit} where id='${ids.diary_entries}' returning id;`)),'');
  assert.equal(sql(`select project_id from diary_entries where id='${ids.diary_entries}'`),ownProject);
  assert.equal(sql(`select description from diary_entries where id='${ids.diary_entries}'`),'Own baseline');
 });
 check('NEW RLS preserves project-owner daily INSERT/read and existing UPDATE operations',()=>{
  for(const [table,column] of children){
   const id=sql(as(owner,`insert into ${table}(user_id,project_id,${column}) values('${owner}','${project}','Allowed owner') returning id;`));
   assert.equal(sql(as(owner,`select ${column} from ${table} where id='${id}'`)),'Allowed owner');
   assert.equal(sql(as(other,`select count(*) from ${table} where id='${id}'`)),'0');
   if(table!=='diary_entries')assert.equal(sql(as(owner,`update ${table} set ${column}='Allowed edit' where id='${id}' returning id;`)),id);
  }
 });
 check('NEW RLS preserves pre-existing NULL-project rows and permits unassigned daily INSERTs',()=>{
  assert.deepEqual(legacySnapshot(),legacyBefore);
  for(const [table,column] of children){
   if(table==='project_materials'){
    sqlError(as(owner,`insert into project_materials(user_id,name) values('${owner}','Invalid unassigned material');`),'23502','project_id');
    continue;
   }
   assert.equal(sql(as(owner,`select ${column} from ${table} where id='${legacy[table]}'`)),'Legacy unassigned');
   sql(as(owner,`insert into ${table}(user_id,${column}) values('${owner}','New unassigned');`));
   if(table!=='diary_entries')assert.equal(sql(as(owner,`update ${table} set ${column}='Legacy own edit' where id='${legacy[table]}' returning id;`)),legacy[table]);
  }
 });
 check('NEW RLS preserves existing admin reads/writes without granting new diary UPDATE rights',()=>{
  const admin='33333333-3333-4333-8333-333333333333';
  sql(`insert into profiles(id,email,role,is_admin) values('${admin}','admin@example.test','admin',true) on conflict(id) do update set role='admin',is_admin=true;`);
  assert.equal(sql(as(admin,'select is_current_user_admin();')),'t');
  for(const [table] of children)assert.equal(sql(as(admin,`select count(*) from ${table} where id='${ids[table]}'`)),'1');
  for(const [table,column] of children)sql(as(admin,`insert into ${table}(user_id,project_id,${column}) values('${admin}','${project}','Authorized admin');`));
  assert.equal(sql(as(admin,`update projects set progress=50 where id='${project}' returning id;`)),project);
  assert.equal(sql(as(admin,`update project_materials set name='Admin edit' where id='${ids.project_materials}' returning id;`)),ids.project_materials);
  assert.equal(sql(as(admin,`update diary_entries set description='Admin edit' where id='${ids.diary_entries}' returning id;`)),'');
 });
 check('NEW RLS preserves service-role atomic accepted import, diary creation and idempotent retry',()=>{
  const row={protocol_version:2,source_status:'accepted',source_quote_id:'f4444444-4444-4444-8444-444444444444',accepted_at:'2026-10-18T00:00:00Z',owner_email:'owner@example.test',token:'rls-proposal-import',project_name:'Guarded import',payload:{}};
  sql(`set role service_role;select register_szakipiac_import_v2('${JSON.stringify(row)}');`);
  const claim=`set role service_role;select claim_szakipiac_import_v2('rls-proposal-import','${owner}','{"location":"Test","note":"Accepted","items":[]}');`;
  const first=JSON.parse(sql(claim));assert.equal(first.status,'complete');assert.equal(JSON.parse(sql(claim)).project_id,first.project_id);
  for(const table of ['projects','entries','diary_entries','project_imports'])assert.equal(sql(`select count(*) from ${table} where ${table==='projects'?'id':'project_id'}='${first.project_id}'`),'1');
  assert.equal(sql(as(owner,`select count(*) from projects where id='${first.project_id}'`)),'1');
  assert.equal(sql(as(owner,`select count(*) from diary_entries where project_id='${first.project_id}'`)),'1');
  assert.equal(sql(as(other,`select count(*) from projects where id='${first.project_id}'`)),'0');
  assert.equal(sql(as(other,`select count(*) from diary_entries where project_id='${first.project_id}'`)),'0');
 });
}
check('captured permission rollback restores exactly the original modeled table rights',()=>{
 sql(fs.readFileSync('docs/proposals/restore-browser-truncate-snapshot.sql','utf8'));
 sql(fs.readFileSync('docs/proposals/restore-platform-default-truncate-snapshot.sql','utf8'));
 for(const table of aclTables)for(const role of browserRoles)
  assert.equal(sql(`select has_table_privilege('${role}','public."${table}"','TRUNCATE')`),captured.public_tables.some(row=>row.table_name===table&&row.grantee===role)?'t':'f');
 assert.deepEqual(normalized(defaultRows()),normalized(defaultsBefore),'Restore changed default scope or privileges');
 assert.deepEqual(rights(),before);
});
check('non-superuser owner can change own defaults but cannot change platform defaults',()=>{
 sql(`begin;create role issue8_owner nologin createrole;grant usage,create on schema public to issue8_owner;
 set role issue8_owner;
 alter default privileges in schema public revoke truncate on tables from anon,authenticated;
 do $$begin
  begin
   execute 'alter default privileges for role supabase_admin in schema public revoke truncate on tables from anon,authenticated';
   raise exception 'Unexpected platform privilege';
  exception when insufficient_privilege then null;
  end;
 end $$;reset role;rollback;`);
});
console.log('Hosted-schema security/standalone checks completed. No production privileges modified.');
