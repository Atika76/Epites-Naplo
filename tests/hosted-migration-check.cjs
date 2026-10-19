// Only used by the disposable PostgreSQL test runner, before each migration.
const {sql,assert}=require('./pg-helper.cjs');
function fingerprint(){return sql(`select jsonb_build_object(
 'columns',(select jsonb_agg(to_jsonb(x) order by table_name,ordinal_position) from information_schema.columns x where table_schema='public'),
 'constraints',(select jsonb_agg(to_jsonb(x) order by conname,conrelid) from pg_constraint x where connamespace='public'::regnamespace),
 'policies',(select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'),
 'tables',(select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity,relforcerowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace),
 'functions',(select jsonb_agg(jsonb_build_array(proname,prosrc,proacl,prosecdef,proconfig) order by proname,oid) from pg_proc where pronamespace='public'::regnamespace));`)}
function verifyRollback(text,name){
 seedLegacy();
 const before=fingerprint();
 assert.match(text,/commit;\s*$/i);
 const broken=text.replace(/commit;\s*$/i,`do $$ begin raise exception 'injected migration interruption'; end $$; commit;`);
 sql(broken,false);assert.equal(fingerprint(),before,'Failed migration leaked DDL/grants/functions: '+name);
 console.log('PASS hosted-schema failed migration rolls back all catalog changes: '+name);
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
function verifyPreserved(){assert.equal(legacySnapshot(),legacyRows,'Migration changed legacy rows or relationships');console.log('PASS hosted migration preserves legacy project, entry/photos, task, material, diary and import');}

module.exports={verifyRollback,verifyPreserved};
