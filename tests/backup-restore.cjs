// Dedicated synthetic database ONLY; never a hosted backup/restore command.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');const {sql,assert}=require('./pg-helper.cjs');
if(process.env.ISSUE8_RESTORE_TEST!=='synthetic-only')throw Error('Explicit synthetic restore opt-in required.');
assert.equal(sql('select current_database()'),'issue8_test');
assert.equal(sql("select shobj_description(oid,'pg_database') from pg_database where datname=current_database()"),'Issue8 disposable synthetic test');
const container=process.env.PG_CONTAINER;
if(container&&!/^[a-f0-9]{12,64}$/.test(container))throw Error('Invalid disposable CI container id');
const binDir=process.env.PSQL?path.dirname(process.env.PSQL):null;
function run(name,args,input){
 const executable=binDir?path.join(binDir,name+(process.platform==='win32'?'.exe':'')):name;
 const cmd=container?'docker':executable;
 const params=container?['exec','-i',container,name,'-U','postgres',...args]:args;
 const r=spawnSync(cmd,params,{input,maxBuffer:30*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr.toString());return r.stdout;
}
function query(text,database='issue8_test'){
 const r=spawnSync(process.env.PSQL||'psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',database],{input:text,encoding:'utf8',maxBuffer:10*1024*1024});if(r.error)throw r.error;if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();
}
const names=JSON.parse(sql("select json_agg(json_build_array(schemaname,tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','auth')"));
function snapshot(){const rows={};for(const [schema,table] of names){assert.match(table,/^[a-z0-9_]+$/);rows[schema+'.'+table]=sql(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from ${schema}."${table}" t;`)}return JSON.stringify({rows,
 constraints:sql("select jsonb_agg(jsonb_build_array(c.relname,x.conname,pg_get_constraintdef(x.oid)) order by c.relname,x.conname) from pg_constraint x join pg_class c on c.oid=x.conrelid where x.connamespace='public'::regnamespace"),
 policies:sql("select jsonb_agg(to_jsonb(x) order by tablename,policyname) from pg_policies x where schemaname='public'"),
 acl:sql("select jsonb_agg(jsonb_build_array(relname,relacl,relrowsecurity) order by relname) from pg_class where relnamespace='public'::regnamespace and relkind='r'")})}
const before=snapshot(),dump=run('pg_dump',['-Fc','-d','issue8_test']);
const directory=process.env.ISSUE8_BACKUP_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'issue8-synthetic-restore-'));fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'synthetic.dump'),dump);
query('drop database issue8_test;','postgres');query('create database issue8_test;','postgres');
run('pg_restore',['-d','issue8_test','--exit-on-error'],dump);assert.equal(snapshot(),before);
console.log('PASS full synthetic backup/restore preserves public/Auth rows, relationships, RLS and table privileges');
