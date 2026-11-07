'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const createRouter=require('../azobss-firefox-whatsapp-pdf-bridge/tab-router');
function fixture(extra=[]){
 const source={id:1,url:'https://www.azobss.com/admin/',windowId:5,cookieStoreId:'firefox-default',incognito:false},tabs=new Map([source,...extra].map(x=>[x.id,{...x}])),calls={created:[],updated:[],focused:[],injected:[]};let next=200;
 const ext={tabs:{async get(id){if(!tabs.has(id))throw Error('Tab closed');return {...tabs.get(id)};},async query(q){return [...tabs.values()].filter(t=>t.url.startsWith('https://web.whatsapp.com/')&&t.cookieStoreId===q.cookieStoreId).map(t=>({...t}));},async sendMessage(id,message){const tab=tabs.get(id);if(tab.noReceiver&&!tab.injected)throw Error('No receiver');if(message.type==='AZOBSS_WA_ENSURE_CHAT_1552')return {ok:true,phone:message.phone,instanceId:tab.instanceId||'initial-'+id};return {bridgeVersion:1552,instanceId:tab.instanceId||'initial-'+id,ready:true,...tab.state};},async executeScript(id){calls.injected.push(id);tabs.get(id).injected=true;},async create(opts){calls.created.push(opts);const tab={...opts,id:next++,incognito:false};tabs.set(tab.id,tab);return {...tab};},async update(id,opts){if(!tabs.has(id))throw Error('Tab closed');calls.updated.push({id,...opts});Object.assign(tabs.get(id),opts);if(opts.url)tabs.get(id).instanceId='fresh-'+id+'-'+calls.updated.length;return {...tabs.get(id)};}},windows:{async update(id,opts){calls.focused.push({id,...opts});}}};
 const sender={url:source.url,frameId:0,tab:{...source}},router=createRouter(ext,{sleep:async()=>{}});
 const open=(phone='601100000001',opts={})=>router.route(sender,{phone,requestId:'fixture-'+Math.random().toString(36).slice(2),...opts});return {tabs,calls,ext,sender,router,open};
}
const wa=(id,extra={})=>({id,url:'https://web.whatsapp.com/',windowId:8,cookieStoreId:'firefox-default',incognito:false,...extra});
test('existing WhatsApp in another window is reused and focused with only the selected phone',async()=>{
 const f=fixture([wa(40)]),r=await f.open();assert.equal(r.reused,true);assert.equal(r.whatsappTabId,40);assert.equal(r.phoneVerified,true);assert.equal(f.calls.created.length,0);assert.equal(f.tabs.get(40).url,'https://web.whatsapp.com/send?phone=601100000001&type=phone_number&app_absent=0');assert.equal(f.calls.focused.at(-1).id,8);assert.ok(!f.tabs.get(40).url.includes('text='));
});
test('no matching tab creates exactly one tab in the source window and container',async()=>{
 const f=fixture(),r=await f.open();assert.equal(r.reused,false);assert.equal(f.calls.created.length,1);assert.equal(f.calls.created[0].windowId,5);assert.equal(f.calls.created[0].cookieStoreId,'firefox-default');assert.equal(f.tabs.get(r.whatsappTabId).url,'https://web.whatsapp.com/send?phone=601100000001&type=phone_number&app_absent=0');
});
test('concurrent contact clicks serialize and never create duplicate WhatsApp tabs',async()=>{
 const f=fixture();const results=await Promise.all(Array.from({length:20},(_,i)=>f.open('60110000'+String(i).padStart(4,'0'))));assert.equal(f.calls.created.length,1);assert.equal(new Set(results.map(x=>x.whatsappTabId)).size,1);assert.equal(f.tabs.size,2);
});
test('a retried request is idempotent and cannot change the recipient under the same request ID',async()=>{
 const f=fixture();const opts={requestId:'retry-id'},a=f.open('601100000001',opts),b=f.open('601100000001',opts);assert.deepEqual(await a,await b);assert.equal(f.calls.created.length,1);assert.equal(f.calls.updated.filter(x=>x.url).length,1);await assert.rejects(f.open('601100000002',opts),e=>e.code==='request_changed');
});
test('other private windows and containers are never reused for this admin session',async()=>{
 const f=fixture([wa(40,{incognito:true}),wa(41,{cookieStoreId:'firefox-container-1'})]),r=await f.open();assert.equal(r.reused,false);assert.equal(f.calls.created.length,1);assert.ok(!f.calls.updated.some(x=>x.id===40||x.id===41));
});
test('untrusted origin, frame, malformed phone and stale source page cannot control tabs',async()=>{
 const f=fixture([wa(40)]);for(const url of ['https://evil.test/admin/','https://www.azobss.com.evil.test/admin/','http://www.azobss.com/admin/','https://www.azobss.com:444/admin/','https://www.azobss.com/administrator'])await assert.rejects(f.router.route({...f.sender,url},{phone:'601100000001',requestId:'bad-origin'}),e=>e.code==='untrusted_sender');
 await assert.rejects(f.router.route({...f.sender,frameId:1},{phone:'601100000001',requestId:'bad-frame'}));await assert.rejects(f.open('601100000001&text=secret'),e=>e.code==='invalid_phone');f.tabs.get(1).url='https://evil.test/';await assert.rejects(f.open(),e=>e.code==='source_unavailable');assert.equal(f.calls.updated.length,0);assert.equal(f.calls.created.length,0);
});
test('a usable tab is preferred over a stale session-conflict tab',async()=>{
 const f=fixture([wa(40,{active:true,lastAccessed:100,state:{locked:true}}),wa(41,{lastAccessed:1,state:{locked:false}})]),r=await f.open();assert.equal(r.whatsappTabId,41);assert.equal(f.calls.created.length,0);
});
test('all locked tabs focus the existing session without opening another tab or taking it over',async()=>{
 const f=fixture([wa(40,{state:{locked:true}})]);await assert.rejects(f.open(),e=>e.code==='session_locked');assert.equal(f.calls.created.length,0);assert.equal(f.calls.updated.filter(x=>x.url).length,0);assert.equal(f.calls.updated[0].id,40);
});
test('an unsent draft or attachment blocks navigation and preserves the existing WhatsApp page',async()=>{
 for(const state of [{draft:true},{busy:true}]){const f=fixture([wa(40,{state})]);await assert.rejects(f.open(),e=>e.code==='unfinished_draft');assert.equal(f.calls.created.length,0);assert.equal(f.calls.updated.filter(x=>x.url).length,0);assert.equal(f.tabs.get(40).url,'https://web.whatsapp.com/');}
});
test('bulk home action focuses an existing tab without changing its chat or draft',async()=>{
 const f=fixture([wa(40,{url:'https://web.whatsapp.com/send?phone=601100000002',state:{draft:true}})]);await f.open('',{home:true});assert.equal(f.calls.created.length,0);assert.equal(f.calls.updated.filter(x=>x.url).length,0);assert.ok(f.tabs.get(40).url.endsWith('601100000002'));
});
test('tabs opened before extension installation receive a scoped status probe and are reused',async()=>{
 const f=fixture([wa(40,{noReceiver:true})]),r=await f.open();assert.equal(r.whatsappTabId,40);assert.deepEqual(f.calls.injected,[40,40]);assert.equal(f.calls.created.length,0);
});
test('a phone action navigates even if a stale send URL still names that phone',async()=>{
 const f=fixture([wa(40,{url:'https://web.whatsapp.com/send?phone=601100000001'})]);await f.open();assert.equal(f.calls.updated.filter(x=>x.url).length,1);
});
test('legacy PDF payload is registered before navigating the reused tab',async()=>{
 const f=fixture([wa(40)]);let registered=false;const update=f.ext.tabs.update;f.ext.tabs.update=async(id,opts)=>{if(opts.url)assert.equal(registered,true);return update(id,opts);};await f.open('601100000001',{beforeNavigate:async tab=>{assert.equal(tab.id,40);registered=true;}});assert.equal(f.calls.created.length,0);
});
