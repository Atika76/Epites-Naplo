const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function edge(path, deps) {
 let handler;
 const code = fs.readFileSync(path,'utf8').replace(/^import .*;\r?\n/gm,'');
 const context = { Response, Request, Headers, TextEncoder, crypto: require('node:crypto').webcrypto,
   console, Deno: { env: { get: key => deps.env?.[key] || 'test-only' } },
   serve: fn => {handler=fn}, ...deps };
 vm.runInNewContext(stripTypeScriptTypes(code),context,{filename:path});
 return req => handler(req);
}
function span(path,start,end) { const s=fs.readFileSync(path,'utf8');const a=s.indexOf(start);const b=s.indexOf(end,a);if(a<0||b<0)throw Error('Missing source span '+start);return s.slice(a,b); }
function query(result) {
 const builder={}; for(const method of ['select','eq','order','limit','is','not','update','insert','delete']) builder[method]=()=>builder;
 builder.maybeSingle=builder.single=async()=>result;
 builder.then=(ok,fail)=>Promise.resolve(result).then(ok,fail);
 return builder;
}
module.exports={edge,span,query};
