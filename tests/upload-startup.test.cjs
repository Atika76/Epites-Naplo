const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {span}=require('./helpers.cjs');
function pageFixture(){
 const inputs=new Map(['beforeFiles','afterFiles','detailFiles','detailVideos'].map(id=>[id,{id,dataset:{},files:[],addEventListener(type,fn){this.change=fn}}]));
 const window={};const document={getElementById:id=>inputs.get(id)||null,addEventListener(){}};
 class DataTransfer{constructor(){this.files=[];this.items={add:file=>this.files.push(file)}}}
 vm.runInNewContext(span('project.js','// ===== V37:','// ===== V79 FINAL:'),{window,document,DataTransfer,setTimeout(){}});
 return {window,inputs};
}
test('a photo selected before the delayed basket initializer survives the first save sync',()=>{
 const {window,inputs}=pageFixture();const photo={name:'early.png',size:10,lastModified:1,type:'image/png'};
 inputs.get('detailFiles').files=[photo];window.v37InitProjectBaskets();
 assert.equal(window.v37FileBaskets.detailFiles.length,1);assert.equal(window.v37FileBaskets.detailFiles[0],photo);
 // Repeat initialization is safe, without reimporting previous-entry photos.
 window.v37InitProjectBaskets();assert.equal(window.v37FileBaskets.detailFiles.length,1);
});
