'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../assets/js/azobss-customer-whatsapp-v1542.js'),'utf8');
function browser({firefox=false,version=0,addon="1.3.2",draftVersion=0,clipboardFails=false}={}){
 const nodes=new Map(),listeners={},copies=[],posts=[];let opens=0;
 const document={documentElement:{getAttribute:name=>name==='data-azobss-firefox-whatsapp-extension-version'?addon:name==='data-azobss-firefox-whatsapp-text-draft'?String(draftVersion):String(version)},body:{append:el=>nodes.set(el.id,el)},getElementById:id=>nodes.get(id),createElement:()=>({setAttribute(){},style:{},querySelector:()=>({}),remove(){nodes.delete(this.id);}})};
 const window={document,crypto:{randomUUID:()=> 'qa-id'},open(){opens++;},addEventListener:(type,fn)=>{listeners[type]=fn;},postMessage:data=>posts.push(data)};
 const env={window,document,navigator:{userAgent:firefox?'Firefox/159.0':'Chrome/143.0',clipboard:{writeText:async text=>{if(clipboardFails)throw Error('Denied');copies.push(text);}}},location:{origin:'https://www.azobss.com'},URL,Map,setTimeout,clearTimeout,console};vm.runInNewContext(code,env);
 return {api:window.AZOBSSCustomerWhatsApp1542,nodes,copies,posts,get opens(){return opens;},reply(data){listeners.message({source:window,origin:env.location.origin,data:{type:'AZOBSS_FIREFOX_WA_OPEN_CHAT_STATUS',requestId:'wa1545-qa-id',...data}});},replyDraft(data){listeners.message({source:window,origin:env.location.origin,data:{type:'AZOBSS_FIREFOX_WA_TEXT_STATUS',requestId:'draft1593-qa-id',...data}});}};
}
test('Chrome without a bridge prepares only the full customer number and never asks for Firefox',async()=>{
 const b=browser();assert.equal(await b.api.openURL(b.api.url('01100000001')),false);assert.deepEqual(b.copies,['+601100000001']);assert.equal(b.posts.length,0);assert.equal(b.opens,0);
 const notice=b.nodes.get('azWhatsappReuseStatus1545').innerHTML;assert.match(notice,/No new tab was opened/);assert.doesNotMatch(notice,/Firefox|INSTALL\.html/);
});
test('denied clipboard keeps the number visible for manual use and claims no opened chat',async()=>{
 const b=browser({clipboardFails:true});assert.equal(await b.api.openURL(b.api.url('+65 8123 4567')),false);assert.equal(b.copies.length,0);assert.equal(b.opens,0);assert.match(b.nodes.get('azWhatsappReuseStatus1545').innerHTML,/value="\+6581234567"/);
});
test('Firefox without a bridge also supports manual contact with an optional installation link',async()=>{
 const b=browser({firefox:true});assert.equal(await b.api.openURL(b.api.url('01100000001')),false);assert.match(b.nodes.get('azWhatsappReuseStatus1545').innerHTML,/Optional Firefox Bridge/);assert.equal(b.opens,0);assert.deepEqual(b.copies,['+601100000001']);
});
test('a ready bridge coalesces repeated clicks and requires the exact verified recipient',async()=>{
 const b=browser({firefox:true,version:1552}),url=b.api.url('01100000001');const first=b.api.openURL(url),second=b.api.openURL(url);assert.equal(first,second);assert.equal(b.posts.length,1);assert.equal(b.copies.length,0);assert.equal(b.opens,0);
 b.reply({ok:true,phoneVerified:true,phone:'601100000099'});assert.equal(await first,false);
 const next=b.api.openURL(url);b.reply({ok:true,phoneVerified:true,phone:'601100000001'});assert.equal(await next,true);assert.equal(b.nodes.has('azWhatsappReuseStatus1545'),false);
});
test('invalid destinations cannot copy unrelated information or navigate',async()=>{
 const b=browser();for(const url of ['https://example.test/','https://web.whatsapp.com/send?phone=601100000001&text=secret','javascript:alert(1)'])assert.equal(await b.api.openURL(url),false);assert.equal(b.copies.length,0);assert.equal(b.posts.length,0);assert.equal(b.opens,0);
});

test('an older bundle with the same wire protocol cannot launch the old attachment/notice code',async()=>{
 const b=browser({firefox:true,version:1552,addon:'1.3.1'});assert.equal(b.api.bridgeReady(),false);assert.equal(await b.api.openURL(b.api.url('01100000001')),false);assert.equal(b.posts.length,0);assert.deepEqual(b.copies,['+601100000001']);
});

test('dealer drafts copy text and request an upgrade when the installed bridge lacks text support',async()=>{
 const b=browser({firefox:true,version:1552,addon:'1.3.4'});
 const result=b.api.openDraft('0182491182','Model: TEST');await new Promise(setImmediate);
 assert.equal(b.posts[0].type,'AZOBSS_FIREFOX_WA_OPEN_CHAT_REQUEST');
 b.reply({ok:true,phoneVerified:true,phone:'60182491182',reused:true});
 assert.equal(await result,false);
 assert.deepEqual(b.copies,['Model: TEST','Model: TEST']);assert.equal(b.opens,0);assert.equal(b.posts.length,1);
 assert.match(b.nodes.get('azWhatsappReuseStatus1545').innerHTML,/1\.3\.5/);
});

test('dealer draft clicks coalesce and require exact recipient, reuse and text confirmation',async()=>{
 const b=browser({firefox:true,version:1552,addon:'1.3.5',draftVersion:1593});
 const a=b.api.openDraft('0182491182','Model: TEST'),same=b.api.openDraft('0182491182','Model: TEST');
 assert.equal(a,same);await new Promise(setImmediate);assert.equal(b.posts.length,1);
 assert.equal(b.posts[0].type,'AZOBSS_FIREFOX_WA_TEXT_REQUEST');
 b.replyDraft({ok:true,phoneVerified:true,phone:'60182491182',draftVerified:true,reused:true});
 assert.equal(await a,true);assert.equal(b.opens,0);
 for(const change of [{phone:'60182491183'},{draftVerified:false},{reused:false}]){
  const task=b.api.openDraft('0182491182','Model: TEST');await new Promise(setImmediate);
  b.replyDraft({ok:true,phoneVerified:true,phone:'60182491182',draftVerified:true,reused:true,...change});
  assert.equal(await task,false);
 }
});
