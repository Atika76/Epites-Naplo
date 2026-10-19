// Only used by the disposable PostgreSQL test runner, before each migration.
const {sql,sqlError,assert}=require('./pg-helper.cjs');
function fingerprint(){return sql(`select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by table_name,ordinal_position) from information_schema.columns x where table_schema='public'),
 'constraints',(select jsonb_agg(to_jsonb(x) order by conname,conrelid) from pg_constraint x where connamespace='public'::regnamespace),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'tables',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace),
 'functions',(select jsonb_agg(jsonb_build_array(proname,prosrc,proacl,prosecdef,proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace));`)}
function verifyRollback(text,name){
 seedLegacy();if(!legacyCatalog)legacyCatalog=catalogSubset();
 // Existing data must roll back too, not just newly created catalog objects.
 sql("create table public.issue8_rollback_probe(id int primary key,value text);insert into public.issue8_rollback_probe values(1,'before');");
 const before=fingerprint();
 assert.match(text,/^begin;/mi);assert.match(text,/commit;\s*$/i);
 const broken=text.replace(/^begin;/mi,()=>`begin;
 update public.issue8_rollback_probe set value='changed';
 insert into public.issue8_rollback_probe values(2,'inserted');
 create table public.issue8_rollback_ddl(id int);`)
 .replace(/commit;\s*$/i,()=>`do $$ begin raise exception using errcode='P0001', message='injected migration interruption'; end $$; commit;`);
 sqlError(broken,'P0001','injected migration interruption');
 assert.equal(fingerprint(),before,'Failed migration leaked DDL/grants/functions: '+name);
 assert.equal(sql('select jsonb_agg(to_jsonb(p) order by id) from public.issue8_rollback_probe p;'),'[{"id": 1, "value": "before"}]','Failed migration leaked UPDATE/INSERT');
 sql('drop table public.issue8_rollback_probe;');
 console.log('PASS hosted-schema injected P0001 reaches final RAISE; full DDL/grants/functions and UPDATE/INSERT roll back: '+name);
}

let legacyRows;
const legacyId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
function legacySnapshot(){return sql(`select jsonb_build_object(
 'project',(select to_jsonb(p) from projects p where id='${legacyId}'),
 'entry',(select to_jsonb(e) from entries e where id='${legacyId}'),
 'task',(select to_jsonb(t) from tasks t where id='${legacyId}'),
 'material',(select to_jsonb(m) from project_materials m where id='${legacyId}'),
 'diary',(select to_jsonb(d) from diary_entries d where id='${legacyId}'),
 'import',(select to_jsonb(i) from project_imports i where id='${legacyId}'));`)}
function seedLegacy(){if(legacyRows)return;
 sql(`insert into projects(id,user_id,name) values('${legacyId}','11111111-1111-4111-8111-111111111111','Synthetic legacy');
 insert into entries(id,user_id,project_id,note,image_urls) values('${legacyId}','11111111-1111-4111-8111-111111111111','${legacyId}','Old daily entry','["old-photo.jpg"]');
 insert into tasks(id,user_id,project_id,source_entry_id,title) values('${legacyId}','11111111-1111-4111-8111-111111111111','${legacyId}','${legacyId}','Old task');
 insert into project_materials(id,user_id,project_id,entry_id,name) values('${legacyId}','11111111-1111-4111-8111-111111111111','${legacyId}','${legacyId}','Old material');
 insert into diary_entries(id,user_id,project_id,description) values('${legacyId}','11111111-1111-4111-8111-111111111111','${legacyId}','Old diary');
 insert into project_imports(id,project_id,source_quote_id,payload) values('${legacyId}','${legacyId}','legacy-source','{"synthetic":true}');`);
 legacyRows=legacySnapshot();
}
function verifyPreserved(){checkLegacyCatalog();assert.equal(legacySnapshot(),legacyRows,'Migration changed legacy rows or relationships');console.log('PASS hosted migration preserves legacy project, entry/photos, task, material, diary and import');}


let legacyCatalog;
function catalogSubset(){return JSON.parse(sql(`select jsonb_build_object(
 'constraints',(select jsonb_agg(jsonb_build_array(c.relname,x.conname,pg_get_constraintdef(x.oid)) order by c.relname,x.conname) from pg_constraint x join pg_class c on c.oid=x.conrelid where x.connamespace='public'::regnamespace),
 'indexes',(select jsonb_agg(jsonb_build_array(tablename,indexname,indexdef) order by tablename,indexname) from pg_indexes where schemaname='public'),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'rights',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r'));`))}
function checkLegacyCatalog(){const current=catalogSubset();for(const key of Object.keys(legacyCatalog))for(const row of legacyCatalog[key]||[])assert.ok((current[key]||[]).some(value=>JSON.stringify(value)===JSON.stringify(row)),'Migration changed existing '+key+': '+JSON.stringify(row));}

module.exports={verifyRollback,verifyPreserved};
