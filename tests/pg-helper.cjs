const { spawnSync, spawn }=require('node:child_process');
const assert=require('node:assert/strict');
if(!['127.0.0.1','localhost','::1'].includes(process.env.PGHOST)||process.env.PGDATABASE!=='issue8_test')
 throw Error('Refusing database writes: set PGHOST=127.0.0.1 and PGDATABASE=issue8_test (disposable database only).');
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'];
let checks=0;
function sql(input,expected=true){const r=spawnSync(process.env.PSQL||'psql',args,{input,encoding:'utf8'});if(r.error)throw r.error;
 if(expected&&r.status!==0)throw Error(r.stderr+'\nSQL: '+input);if(!expected)assert.notEqual(r.status,0,'Expected SQL rejection: '+input);return r.stdout.trim();}
// Match the PostgreSQL SQLSTATE as well as the message: syntax/permission errors
// must never masquerade as a successful, intentional failure injection.
function sqlError(input,state,message){
 const r=spawnSync(process.env.PSQL||'psql',args,{input:'\\set VERBOSITY verbose\n'+input,encoding:'utf8'});if(r.error)throw r.error;
 assert.notEqual(r.status,0,'Expected SQL rejection: '+input);
 assert.match(r.stderr,new RegExp('ERROR:\\s+'+state+':'),r.stderr);
 if(message)assert.ok(r.stderr.includes(message),r.stderr);
 return r.stderr;
}
function check(name,fn){fn();checks++;console.log('PASS '+name)}
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
function as(user,query){const email=user===admin?'atika.76@windowslive.com':user===owner?'owner@example.test':'other@example.test';return `set role authenticated;set request.jwt.claim.sub='${user}';set request.jwt.claims='{"email":"${email}"}';${query}`;}
function concurrent(input){const p=spawn(process.env.PSQL||'psql',args);let out='',err='';p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);const done=new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));p.stdin.end(input);return {done,output:()=>out};}
async function ready(p){const until=Date.now()+10000;while(!p.output().includes('READY')){if(Date.now()>until)throw Error('Lock holder did not start');await new Promise(r=>setTimeout(r,30));}}
module.exports={sql,sqlError,check,as,owner,other,admin,concurrent,ready,assert};
