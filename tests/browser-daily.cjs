// Real project page and its existing report builder. Mocked persistence; all
// production API requests blocked. Auth/SQL/Storage have separate integration tests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.UI_REPORT_DIR||'work/daily-validation');fs.mkdirSync(out,{recursive:true});
const fixture=`(()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.test'};
 const project={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:user.id,name:'Önálló napló – Őrmező',location:'Teszt helyszín',status:'active',progress:25};
 const profile={id:user.id,email:user.email,full_name:'Teszt Kivitelező',role:'user',is_admin:false,plan:'pro',plan_status:'active',plan_expires_at:'2099-01-01',company_name:'Teszt Cég'};
 const initial=[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:user.id,project_id:project.id,note:'Régi napi bejegyzés',phase:'Burkolás',status:'Normál',created_at:new Date().toISOString(),image_urls:[],images:[]}];
 let entries=JSON.parse(localStorage.getItem('issue8_test_entries')||JSON.stringify(initial));window.__uiCalls=[];
 const api={getCurrentUser:async()=>user,getProfile:async()=>profile,getProjects:async()=>[project],getEntries:async()=>entries,
  getProjectMaterials:async()=>[{id:'material',name:'Csemperagasztó',quantity:2,unit:'zsák'}],getProjectInvoices:async()=>[{id:'invoice',title:'Szintetikus számla',amount:12700}],getProjectMembers:async()=>[],getTasks:async()=>[],
  getProjectCloseData:async()=>({project,entries,materials:[{name:'Csemperagasztó',quantity:2,unit:'zsák'}],invoices:[{title:'Szintetikus számla',amount:12700}],tasks:[]}),
  saveEntry:async value=>{const e={...value,id:crypto.randomUUID(),user_id:user.id,project_id:value.projectId||value.project_id,created_at:new Date().toISOString(),image_urls:value.images||[]};entries.push(e);localStorage.setItem('issue8_test_entries',JSON.stringify(entries));window.__uiCalls.push(['saveEntry',e]);return e;},
  analyzePhotoWithAI:async()=>({ok:false}),getProjectClientCollabV173:async()=>({links:[],messages:[],extra_works:[]}),getPermissions:async()=>({}),
  saveReportDocument:async()=>({id:'test-document'}),getSignedVideoUrl:async v=>v.url||v,
 };
 window.EpitesNaploAPI=new Proxy(api,{get(target,key){if(key in target)return target[key];return async(...args)=>{window.__uiCalls.push(['unmodelled:'+String(key)]);return [];};}});
 window.__uiEntries=()=>entries;
})();`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});let results=[];
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const errors=[],network=[],consoleErrors=[];
 page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>network.push(r.url()));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
 await context.route('**/*',route=>{
  const url=route.request().url();if(url.includes('supabase-adapter.js'))return route.fulfill({contentType:'application/javascript',body:fixture});
  if(url.includes('.supabase.co'))return route.fulfill({status:500,body:'Production API blocked by test'});
  return route.continue();
 });
 await page.goto((process.env.TEST_BASE_URL||'http://127.0.0.1:5588/Epites-Naplo')+'/project.html?id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 await page.waitForFunction(()=>document.getElementById('projectTitle').textContent.includes('Őrmező'));
 await page.waitForFunction(()=>window.detailState?.entries?.length===1);
 console.log('Loaded daily page '+width);
 await page.locator('#dailyFormCard > .v174AccordionHeader').click();
 await page.locator('#detailNote').fill('Mai ellenőrzött burkolás – őűáéíöü.');
 console.log('Filled note '+width);
 const before=await page.evaluate(()=>window.__uiEntries().length);
 await page.locator('#detailFiles').setInputFiles({name:'daily-photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAPAAAAB4CAIAAABD1OhwAAAEY0lEQVR4nO3Z3W9TZQDH8ef05ZSu695gy4KWiShgAph5IZCIWRNcxEQwmpgYvSEkeuPrHyAKV17AhcoFCRgvwPgSIgYNN8YEfMumARc3HCONGJ0y3dburTusPd0x5bhRx3BkqyH78f1ctc+e5/Qs/ebpk9aqP9hnABWBm30DQDkRNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKSEFrj+110NZ/vznmfsoHWk2/mgx/HHn1kbfWNLvPnoQL8zaYxJ7Wy4692/Sh/41tSGDm2tbjk2OOkVn37+eN0Lp0bOp93SK4cD1qvfjv7Qn5+xdvrpU2uiu9ZF8wUTDppDnc6HF5xHVkaeXV9hjNnYaLf35Ywx73Q5lWFrxrQF/u8QDDo3aR47kTHGVISsIw/XjOe9Ez9fNsa0NkUOdzpbV0Ten0p8Vj0Ztzvt7li15Hjq8kMrIr+MFPyaS698T13ozZaq1o/Ts14hmbCfXht94tPMcM6rtq33ttVeyhZOXpw4eXHCj96/SDJhP7e+csa0L38vtg4lZTtyjLve3vYxf1+MhqxY2Dp63mltisy5cP/Z7CvNsYBlXmqO7TuTvXZCd9ptigevt/z5e2Ovt40O54o7/HDO29M2+mJzbN7TsNiV8wz902B+ZXWxvGTC/uK3idSQm4gH7ID136suZNxzaXffg1W9Y4WezD/bc6ktt9ldg7OM++6uCXUOXP3rjwPu6prQvKdhsSvnmxoMWPkrZ+Ftd0TWLQ1vv3NJY0Vw8/Lw6d45Ptn3n8l+/eTSBz4aLB20A+aT7bWWMSM57+XTI9MjpROuZVnmyml8Djc4Dbd00PfVh7vTbtAyq6pDyWPFOpMJu7UpMmfQqSF3LO+lhv61DU+foa83ktrZUNzgh9wNy0Lf/5n3BzcsC826zd/gNCx2ZTty1EQCuzdVHugYv7/RPjd1Qmi7lG+53Tb/pwMd2dc2xavs4sGm2rZ2b4y/3ZGd9zTc6ju0fwzwv1x7qyP7zR+5PZvjX019e+C43oAzubr26qvYAfPZjjr/8Xd9ub3tYwu8gVO9ueWVzvFH63IFLxw0h7uc6VefxzQsdlb9wb6bfQ9A2fBLIaQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNKQQNIySvwGVBmbhwMyqhAAAAABJRU5ErkJggg==','base64')});
 console.log('Set daily photo '+width);
 await page.evaluate(()=>{const gps=document.getElementById('autoWeatherGpsCheck');if(gps)gps.checked=false;});
 page.on('dialog',d=>d.dismiss());
 await Promise.race([page.evaluate(()=>window.saveDailyEntry()),new Promise((_,reject)=>setTimeout(()=>reject(Error('Daily save did not finish')),20000))]);
 console.log('Saved daily entry '+width);
 await page.waitForFunction(count=>window.__uiEntries().length===count,before+1);
 const saved=await page.evaluate(()=>window.__uiEntries().at(-1));console.log('Saved photo fields',Object.fromEntries(Object.entries(saved).filter(([key])=>/image|photo|general|before|after/.test(key)).map(([key,value])=>[key,Array.isArray(value)?value.length:typeof value])));assert.ok(saved.note.includes('Mai ellenőrzött burkolás'));assert.ok((saved.images||saved.image_urls).length);
 await page.locator('#detailNote').fill('Következő nap, új fotó nélkül.');
 await page.evaluate(()=>window.saveDailyEntry());
 assert.equal(await page.evaluate(()=>window.__uiEntries().at(-1).images.length),0,'Previous photo leaked into a later entry');
 await page.reload();await page.waitForFunction(()=>window.detailState?.entries?.length===3);
 console.log('Reloaded daily entry '+width);
 const popupEvent=context.waitForEvent('page');await page.evaluate(()=>window.printClosingDocument());const popup=await popupEvent;
 await popup.waitForLoadState('domcontentloaded');await popup.waitForFunction(()=>document.body.textContent.includes('Mai ellenőrzött burkolás'));
 await popup.evaluate(()=>Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r}))));
 const reportText=await popup.locator('body').innerText();assert.ok(reportText.includes('Régi napi bejegyzés'));assert.ok(reportText.includes('Mai ellenőrzött burkolás'));
 const pdf=path.join(out,`diary-${width}.pdf`);await popup.pdf({path:pdf,format:'A4',printBackground:true});
 await page.screenshot({path:path.join(out,`project-${width}.png`),fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
 results.push({width,scope:'Standalone daily form/photo save, next entry without photo reuse, reload and actual closing report print HTML to PDF',entries:3,pdf:path.basename(pdf),overflow,errors,networkFailures:network,consoleErrors,unmodelledCalls:await page.evaluate(()=>[...new Set(window.__uiCalls.filter(x=>x[0].startsWith('unmodelled:')).map(x=>x[0]))])});
 console.log(JSON.stringify(results.at(-1)));assert.deepEqual(errors,[]);assert.equal(overflow,false);
 await Promise.race([context.close(),new Promise(r=>setTimeout(r,5000))]);
}fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}finally{await Promise.race([browser.close(),new Promise(r=>setTimeout(r,5000))])}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
