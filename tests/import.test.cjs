const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {edge,span,query}=require('./helpers.cjs');
test('only authenticated v2 accepted quote version can register',async()=>{
 const calls=[];const handler=edge('supabase/functions/create-szakipiac-import/index.ts',{createClient:()=>({rpc:async(name,args)=>{calls.push(args);return {data:{id:'r',token:'t'}}}})});
 for(const body of [{source_quote_id:'kivitelezes_projektek:1',source_status:'kivitelezes_pro'},
 {source_quote_id:'11111111-1111-4111-8111-111111111111',source_status:'accepted'},
 {protocol_version:2,source_quote_id:'11111111-1111-4111-8111-111111111111',source_status:'rejected',accepted_at:'2026-10-18',owner_email:'owner@example.test'}]){
  const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test-only'},body:JSON.stringify(body)}));assert.equal(response.status,409);
 }assert.equal(calls.length,0);
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer browser-token'},body:'{}'}));assert.equal(response.status,401);
 const body={protocol_version:2,source_quote_id:'11111111-1111-4111-8111-111111111111',source_status:'accepted',accepted_at:'2026-10-18',owner_email:'owner@example.test',payload:{items:[]}};
 assert.equal((await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer test-only'},body:JSON.stringify(body)}))).status,200);assert.equal(calls.length,1);
});
test('claim verifies login, owner and calls transactional RPC',async()=>{
 for(const owner of ['owner@example.test','other@example.test']){
  let calls=0;const client={auth:{getUser:async()=>({data:{user:{id:'u',email:'owner@example.test'}}})},from:()=>query({data:{id:'r',protocol_version:2,verified_owner_email:owner,payload:{items:[]}}}),rpc:async()=>{calls++;return {data:{ok:true,project_id:'p',warnings:[]}}}};
  const handler=edge('supabase/functions/claim-szakipiac-import/index.ts',{createClient:()=>client});
  const res=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer valid'},body:'{"token":"t"}'}));assert.equal(res.status,owner==='owner@example.test'?200:403);assert.equal(calls,owner==='owner@example.test'?1:0);
 }
});
function importUi(out,{fail=false}={}){
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{classList:{toggle(){},remove(){},add(){}},textContent:'',disabled:false});return elements.get(id)};
 const c={claimInProgress:false,importBtn:element('import'),db:{auth:{getSession:async()=>({data:{session:{access_token:'valid'}}})}},
  token:'t',EPITESNAPLO_CONFIG:{supabaseUrl:'https://example.test'},location:{href:''},document:{getElementById:element},setStatus:(s,type)=>{c.status=s;c.type=type},checkLogin:async()=>{},fetch:async()=>{if(fail)throw Error('offline');return {ok:out.ok,json:async()=>out}}};
 vm.createContext(c);vm.runInContext(span('import-szakipiac.html','async function claimImport(){',"importBtn.addEventListener"),c);return {c,elements};
}
test('partial import stays visible with real counts and a project link',async()=>{const {c,elements}=importUi({ok:true,project_id:'p',status:'partial',warnings:['Anyaghiba'],inserted:{materials:0,tasks:2}});await c.claimImport();assert.equal(c.location.href,'');assert.match(elements.get('importDetails').textContent,/Anyaghiba/);assert.match(elements.get('importDetails').textContent,/materials: 0/);assert.equal(c.importBtn.disabled,false);assert.equal(elements.get('openProject').href,'/project.html?id=p')});
test('complete import opens project; network failure can be retried',async()=>{const good=importUi({ok:true,project_id:'p',status:'complete'});await good.c.claimImport();assert.equal(good.c.location.href,'/project.html?id=p');const bad=importUi({}, {fail:true});await bad.c.claimImport();assert.equal(bad.c.claimInProgress,false);assert.equal(bad.c.importBtn.disabled,false);assert.equal(bad.c.type,'error')});
test('manual deployment only; no production secrets in tests',()=>{const s=fs.readFileSync('.github/workflows/deploy-epites-import-functions.yml','utf8');assert.ok(!/^  push:/m.test(s));assert.match(s,/inputs.production_confirmation == 'DEPLOY_PRODUCTION'/);assert.doesNotMatch(fs.readFileSync('.github/workflows/verify-workflow.yml','utf8'),/secrets\./)});
