const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const create=require('../azobss-firefox-whatsapp-pdf-bridge/dealer-delivery');
const text='Jenama: Synthetic\nModel: Test X\nSerial Number: TEST\nBattery Name: BIF0_9';
function setup(){let rows=[],draft=text,verified=true,ack=true;const sent=[];const delivery={reportId:crypto.randomUUID(),eventId:crypto.randomUUID(),manualRevision:0};
 const observer=create({messages:()=>rows,composer:()=>draft,verifyPhone:async()=>verified,deliver:async receipt=>{sent.push(receipt);return {ok:ack};}});
 observer.arm({phone:'60182491182',text,delivery});
 return {observer,delivery,sent,rows:value=>{rows=value;},draft:value=>{draft=value;},verified:value=>{verified=value;},ack:value=>{ack=value;}};}
const bubble=(changes={})=>({id:'true_60182491182@c.us_NEW',outgoing:true,sent:true,phone:'60182491182',text,...changes});
test('preparing a draft and synthetic send events never mark a report as sent',async()=>{
 const f=setup();f.rows([bubble()]);await f.observer.tick();assert.equal(f.sent.length,0);
 assert.equal(f.observer.intent(false),false);await f.observer.tick();assert.equal(f.sent.length,0);
});
test('only a new exact outgoing message with a sent tick confirms the selected dealer',async()=>{
 const f=setup();f.rows([bubble({id:'true_OLD'})]);assert.equal(f.observer.intent(true),true);
 for(const change of [{sent:false},{outgoing:false},{text:'different note'},{phone:'60119999999'}]){f.rows([bubble(change)]);await f.observer.tick();assert.equal(f.sent.length,0);}
 f.rows([bubble()]);await f.observer.tick();assert.equal(f.sent.length,1);assert.equal(f.sent[0].reportId,f.delivery.reportId);
 await f.observer.tick();assert.equal(f.sent.length,1);
});
test('historical exact matches, changed drafts and another recipient cannot confirm delivery',async()=>{
 const f=setup();f.rows([bubble()]);f.observer.intent(true);await f.observer.tick();assert.equal(f.sent.length,0);
 f.draft('edited note');assert.equal(f.observer.intent(true),false);
 f.rows([bubble({id:'true_NEW2'})]);f.verified(false);await f.observer.tick();assert.equal(f.sent.length,0);
});
test('offline confirmation retries until its durable outbox accepts it',async()=>{
 const f=setup();f.observer.intent(true);f.rows([bubble()]);f.ack(false);await f.observer.tick();f.ack(true);await f.observer.tick();await f.observer.tick();assert.equal(f.sent.length,2);assert.equal(f.sent[0].eventId,f.sent[1].eventId);
});
test('background saves confirmation before forwarding and removes it only after admin ACK',async()=>{
 const handlers=[],saved={},forwarded=[];const ext={storage:{local:{get:async key=>({[key]:saved[key]}),set:async data=>Object.assign(saved,JSON.parse(JSON.stringify(data)))}},runtime:{onMessage:{addListener:fn=>handlers.push(fn)}},tabs:{query:async()=>[{id:10}],sendMessage:async(id,message)=>forwarded.push(message)}};
 const context=vm.createContext({browser:ext,console,setInterval:()=>{},Map,URL,Date,Number,Promise});
 vm.runInContext(fs.readFileSync(require.resolve('../azobss-firefox-whatsapp-pdf-bridge/dealer-delivery-background.js'),'utf8')+'\nglobalThis.api=dealerDelivery1594;',context);
 const delivery={reportId:crypto.randomUUID(),eventId:crypto.randomUUID(),manualRevision:0};context.api.register(15,'request','60182491182',delivery);
 const message={type:'AZOBSS_WA_DEALER_SENT_1594',requestId:'request',receipt:{...delivery,phone:'60182491182',messageId:'true_NEW'}};
 assert.equal((await handlers[0](message,{frameId:0,tab:{id:99},url:'https://web.whatsapp.com/'})).ok,false);
 assert.equal((await handlers[0](message,{frameId:0,tab:{id:15},url:'https://web.whatsapp.com/'})).ok,true);
 assert.equal(saved.azobssDealerSentOutbox1594.length,1);
 await handlers[0]({type:'AZOBSS_PC_DEALER_SENT_READY_1594'},{frameId:0,tab:{id:10},url:'https://www.azobss.com/admin/'});
 assert.ok(forwarded.some(row=>row.receipt?.eventId===delivery.eventId));
 await handlers[0]({type:'AZOBSS_PC_DEALER_SENT_ACK_1594',eventId:delivery.eventId},{frameId:0,tab:{id:10},url:'https://www.azobss.com/admin/'});
 assert.equal(saved.azobssDealerSentOutbox1594.length,0);
});
