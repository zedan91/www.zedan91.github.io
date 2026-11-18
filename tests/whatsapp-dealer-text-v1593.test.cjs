'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../azobss-firefox-whatsapp-pdf-bridge/whatsapp-bridge.js'),'utf8');

function fixture(initial='') {
  let listener, currentPhone='', edits=0;
  const document = {};
  class Field {
    constructor() { this._value=initial; this.isConnected=true; this.tagName='TEXTAREA'; }
    get value() { return this._value; }
    set value(value) { this._value=value; edits++; }
    matches() { return true; }
    focus() { document.activeElement=this; }
    blur() { document.activeElement=null; }
    dispatchEvent() {}
  }
  const box = new Field();
  Object.assign(document,{
    getElementById:()=>({style:{},querySelector:()=>({}),remove(){}}),
    querySelector:selector=>selector.startsWith('#main footer')?box:null,
    querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}
  });
  const window = {AZOBSSWhatsappTarget1552:{ensure:async phone=>{currentPhone=phone;},current:phone=>phone===currentPhone}};
  const browser = {runtime:{sendMessage:async()=>({pending:false}),onMessage:{addListener:fn=>{listener=fn;}}}};
  vm.runInNewContext(source,{
    window,document,browser,crypto:{randomUUID:()=> 'fixture-instance'},
    setTimeout:fn=>{queueMicrotask(fn);return 1;},clearTimeout(){},setInterval(){},
    HTMLTextAreaElement:Field,HTMLInputElement:Field,InputEvent:class {},console:{log(){}}
  });
  const phone='60182491182',text='Jenama: Example\nModel: Test Laptop\nSerial Number: TEST\nBattery Name: BIF0_9';
  return {box,get edits(){return edits;},verify:()=>listener({type:'AZOBSS_WA_ENSURE_CHAT_1552',phone,instanceId:'fixture-instance'}),
    prepare:changes=>listener({type:'AZOBSS_WA_PREPARE_TEXT_1593',phone,text,instanceId:'fixture-instance',...changes}),text};
}

test('dealer composer receives four lines once after its recipient is verified',async()=>{
  const f=fixture();await f.verify();
  assert.equal((await f.prepare()).draftVerified,true);assert.equal(f.box.value,f.text);assert.equal(f.edits,1);
  assert.equal((await f.prepare()).draftVerified,true);assert.equal(f.edits,1);
});

test('an existing message draft is preserved when preparing dealer text',async()=>{
  const f=fixture('My unsent message');await f.verify();
  assert.equal((await f.prepare()).ok,false);assert.equal(f.box.value,'My unsent message');assert.equal(f.edits,0);
});

test('an unverified or stale chat cannot receive dealer text',async()=>{
  const f=fixture();assert.equal((await f.prepare()).ok,false);await f.verify();
  assert.equal((await f.prepare({instanceId:'old-document'})).ok,false);
  assert.equal((await f.prepare({phone:'60182491183'})).ok,false);assert.equal(f.edits,0);
});
