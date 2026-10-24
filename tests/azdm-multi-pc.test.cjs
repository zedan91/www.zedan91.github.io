'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../assets/js/azobss-azdm-offer-model'),{createAzdmHandler}=require('../lib/azobss-azdm');
test('single-PC prices stay RM25/year and RM50/lifetime; multi-PC prices are RM20/year and RM40/lifetime per PC',()=>{
 const offer=model.defaults();
 assert.equal(model.quote(offer,'annual',1).total_cents,2500);
 assert.equal(model.quote(offer,'lifetime',1).total_cents,5000);
 for(const n of [2,3,100])for(const [id,unit,days] of [['annual-multi',2000,365],['lifetime-multi',4000,0]]){
  const q=model.quote(offer,id,n);assert.equal(q.total_cents,unit*n);assert.equal(q.unit_cents,unit);assert.equal(q.days,days);assert.equal(q.quantity,n);
 }
});
test('2+ PC prices reject single PCs, fractions and out-of-range quantities; one-PC plans reject extra PCs',()=>{
 for(const id of ['annual-multi','lifetime-multi'])for(const n of [0,1,1.5,101,NaN,'2'])assert.throws(()=>model.quote(model.defaults(),id,n));
 for(const id of ['annual','lifetime'])assert.throws(()=>model.quote(model.defaults(),id,2));
 for(const min of [0,101,1.5,'2']){const o=model.defaults();o.plans[1].min_quantity=min;assert.throws(()=>model.normalize(o));}
});
test('legacy unrestricted Lifetime discounts and fixed-total bundles retain their original calculation',()=>{
 const o={...model.defaults(),plans:[{id:'legacy',label:'Lifetime',days:0,quantity:0,amount_cents:5000},{id:'fixed',label:'Bundle',days:0,quantity:2,amount_cents:4000}]};
 assert.equal(model.quote(o,'legacy',1).total_cents,5000);assert.equal(model.quote(o,'legacy',3).total_cents,12000);
 assert.equal(model.quote(o,'fixed',2).total_cents,4000);
});
test('both payment gateways use server prices and reject forged multi-PC minimums before any checkout is created',async()=>{
 for(const method of ['stripe','toyyibpay'])for(const id of ['annual-multi','lifetime-multi'])for(const n of [1,3]){
  let status,payload,calls=0;
  const handler=createAzdmHandler({getIdentity:async()=>({uid:'fixture',email:'test@example.com',emailVerified:true}),getOffer:async()=>model.defaults(),rateLimit:()=>false,readBody:async()=>JSON.stringify({software_id:'AZDM',plan:id,quantity:n,payment_method:method,request_id:'11111111-1111-4111-8111-111111111111',amount:1,trusted_quote:{total_cents:1,quantity:n,min_quantity:1}}),send:(r,s)=>status=s,localShop:{checkout:async({body})=>{calls++;payload=body;return {ok:true};}}});
  await handler({method:'POST'},{},{pathname:'/api/azdm/checkout',query:{}});
  assert.equal(status,n===1?400:200);assert.equal(calls,n===1?0:1);
  if(n===3){assert.equal(payload.trusted_quote.total_cents,id==='annual-multi'?6000:12000);assert.equal(payload.trusted_quote.days,id==='annual-multi'?365:0);}
 }
});
test('paid multi-PC fulfilment creates one distinct serial per PC with correct term and does not reissue on retry',async()=>{
 const code=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8');
 const fn=code.slice(code.indexOf('async function azFulfillAzdmOrder('),code.indexOf('\nasync function azAzdmLocalCatalog'));
 for(const days of [365,0]){
  let stored={orderId:'fixture',status:'paid',packageQuantity:3,softwarePackageDays:days,email:'test@example.com'},issued=[],mailed=[];
  const sandbox={azReloadPremiumOrder:async()=>stored,azIsAzdmPremiumOrder:()=>true,azAzdmDecryptSerials:s=>s?JSON.parse(s):[],azAzdmEncryptSerials:JSON.stringify,upsertPremiumOrder:o=>(stored=o),azPersistPremiumOrder:async()=>{},cleanPremiumText:s=>s,cleanToyyibEmail:s=>s,cleanToyyibPhone:s=>s,azAzdmAdminCall:async(action,body)=>{issued.push(body);return {serial:'TEST-SERIAL-'+issued.length,id:'fixture-'+issued.length};},azAzdmSendSerialEmail:async(o,keys)=>{mailed=keys;return o.email;},findPremiumOrderByAny:()=>stored};
  vm.runInNewContext(fn+';globalThis.fulfill=azFulfillAzdmOrder;',sandbox);
  await sandbox.fulfill(stored,{});assert.equal(issued.length,3);assert.equal(new Set(mailed.map(k=>k.serial)).size,3);assert.ok(issued.every(b=>b.days===days));assert.equal(stored.azdmFulfillmentState,'complete');
  await sandbox.fulfill(stored,{});assert.equal(issued.length,3);
 }
});
