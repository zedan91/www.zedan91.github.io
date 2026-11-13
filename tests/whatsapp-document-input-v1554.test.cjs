'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../azobss-firefox-whatsapp-pdf-bridge/whatsapp-bridge.js'),'utf8');
const code=source.slice(source.indexOf('  function chooseDocumentInput('),source.indexOf('  function setInputFile('));
const input=(accept='',extra={})=>({isConnected:true,disabled:false,id:'',getAttribute:name=>name==='accept'?accept:null,closest:()=>null,...extra});
function chooser(inputs){return vm.runInNewContext(code+';chooseDocumentInput',{document:{querySelectorAll:()=>inputs},Set});}
const menu=owned=>({contains:el=>owned.includes(el),getAttribute:()=>null});
test('a stale generic upload input is never chosen instead of a newly created document input',()=>{
 const stale=input('',{multiple:true}),fresh=input('*/*');assert.equal(chooser([stale,fresh])(new Set([stale])),fresh);
});
test('an old unrelated generic input alone cannot receive the PDF',()=>{
 const stale=input();assert.equal(chooser([stale])(new Set([stale])),null);
});
test('ambiguous new inputs wait for a Document association',()=>{
 const a=input(),b=input();const choose=chooser([a,b]);assert.equal(choose(new Set()),null);assert.equal(choose(new Set(),menu([b])),b);
});
test('a Document control may reuse its own existing input without selecting profile upload',()=>{
 const stale=input(),documentInput=input();assert.equal(chooser([stale,documentInput])(new Set([stale,documentInput]),menu([documentInput])),documentInput);
});
test('only the new input created by the Document action wins over earlier generic inputs',()=>{
 const earlier=input(),documentInput=input();assert.equal(chooser([earlier,documentInput])(new Set(),null,new Set([earlier])),documentInput);
});
test('photo/video-only, disabled and disconnected inputs are excluded',()=>{
 const photo=input('image/*,video/*'),disabled=input('application/pdf',{disabled:true}),detached=input('application/pdf',{isConnected:false});assert.equal(chooser([photo,disabled,detached])(new Set()),null);
});
