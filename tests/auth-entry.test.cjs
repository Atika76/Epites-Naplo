const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync('script.js','utf8'),start=script.indexOf("  document.addEventListener('click', (e) => {",script.indexOf('function requireLoginV38'));
const end=script.indexOf('  }, true);',start)+'  }, true);'.length;
function click(id,user=null){let listener,blocked=0,prevented=0;const target={id,tagName:'BUTTON',onclick:()=>{},closest:s=>s==='button, a, input, select, textarea'?target:null,getAttribute:()=>null,matches:()=>false};vm.runInNewContext(script.slice(start,end),{state:{user},document:{addEventListener:(type,fn)=>listener=fn},showGuestLockV38:()=>blocked++});listener({target,preventDefault:()=>prevented++,stopPropagation(){}});return {blocked,prevented};}
test('a főoldali Belépés / Regisztráció gomb vendégként is megnyithatja a belépést',()=>assert.deepEqual(click('loginBtn'),{blocked:0,prevented:0}));
test('a korábbi Regisztráció gomb is működőképes marad',()=>assert.deepEqual(click('heroRegisterBtn'),{blocked:0,prevented:0}));
test('vendégként egyéb projektműveletet továbbra is megfog a védelem',()=>assert.deepEqual(click('saveProjectBtn'),{blocked:1,prevented:1}));
test('belépett felhasználó projektműveletét nem változtatjuk meg',()=>assert.deepEqual(click('saveProjectBtn',{id:'synthetic'}),{blocked:0,prevented:0}));
