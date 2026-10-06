'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {createAzdmHandler}=require('../lib/azobss-azdm');
const token='a'.repeat(64);
function fixture(identity={uid:'verified-account',email:'buyer@example.com',emailVerified:true,name:'Real Customer',phone:''},fetchImpl=async()=>Response.json({enabled:true})) {
  const sent=[],calls=[];
  const handler=createAzdmHandler({getIdentity:async()=>identity,readBody:async req=>req.body||'{}',send:(res,status,body,type,headers)=>sent.push({status,body:JSON.parse(body),headers}),rateLimit:()=>false,env:{AZDM_SHOP_SERVICE_TOKEN:token},fetchImpl:async(...args)=>{calls.push(args);return fetchImpl(...args);}});
  return {handler,sent,calls};
}
test('AZDM checkout forwards verified account and ignores forged browser identity and price',async()=>{
  const f=fixture();
  await f.handler({method:'POST',body:JSON.stringify({plan:'lifetime',quantity:3,request_id:randomUUID(),email:'attacker@example.com',account_uid:'other',amount_cents:1,customer:'Injected'})},{},{pathname:'/api/azdm/checkout',query:{}});
  assert.equal(f.sent[0].status,200);
  const payload=JSON.parse(f.calls[0][1].body);
  assert.equal(payload.account_uid,'verified-account');assert.equal(payload.email,'buyer@example.com');assert.equal(payload.customer,'Real Customer');assert.equal(payload.quantity,3);assert.equal(payload.amount_cents,undefined);
  assert.equal(f.calls[0][1].headers.Authorization,'Bearer '+token);
  assert.equal(f.sent[0].headers['Cache-Control'],'no-store');
});
test('guest, unverified and local pseudo-email accounts cannot buy',async()=>{
  for(const identity of [null,{uid:'x',email:'x@example.com',emailVerified:false},{uid:'x',email:'x@azobss.local',emailVerified:true}]) {
    const f=fixture(identity);await f.handler({method:'POST'},{},{pathname:'/api/azdm/checkout',query:{}});
    assert.ok([401,403].includes(f.sent[0].status));assert.equal(f.calls.length,0);
  }
});
test('malformed quantities and request IDs are rejected before creating a bill',async()=>{
  for(const quantity of [0,-1,1.5,101,'2']) {
    const f=fixture();await f.handler({method:'POST',body:JSON.stringify({plan:'lifetime',quantity,request_id:randomUUID()})},{},{pathname:'/api/azdm/checkout',query:{}});
    assert.equal(f.sent[0].status,400);assert.equal(f.calls.length,0);
  }
});
test('status always carries authenticated UID; worker denial is preserved',async()=>{
  const f=fixture(undefined,async()=>Response.json({error:'Pesanan tidak ditemui.'},{status:404}));
  await f.handler({method:'GET'},{},{pathname:'/api/azdm/status',query:{azdm_order:randomUUID(),account_uid:'someone-else'}});
  assert.equal(JSON.parse(f.calls[0][1].body).account_uid,'verified-account');assert.equal(f.sent[0].status,404);
});
test('catalog is readable without login and visibly disabled before setup; unrelated routes are untouched',async()=>{
  const sent=[];const handler=createAzdmHandler({getIdentity:()=>{throw Error('Should not use login');},readBody:()=>'',send:(r,s,b)=>sent.push({s,b:JSON.parse(b)}),rateLimit:()=>false,env:{}});
  await handler({method:'GET'},{},{pathname:'/api/azdm/catalog',query:{}});
  assert.equal(sent[0].s,200);assert.equal(sent[0].b.enabled,false);assert.equal(sent[0].b.support.email,'zedan9107@gmail.com');
  assert.equal(await handler({method:'POST'},{},{pathname:'/api/toyyib/create-bill',query:{}}),false);
});
test('Render-local AZDM shop can replace the undeployed Cloudflare integration without exposing a service token',async()=>{
  const sent=[],calls=[];
  const offer={enabled:true,product_id:'AZDM',name:'AZDM',fulfilment:'azdm',max_quantity:100,bulk_minimum:2,bulk_unit_cents:4000,plans:[{id:'annual',label:'1 Tahun',days:365,quantity:0,amount_cents:2500},{id:'lifetime',label:'Lifetime',days:0,quantity:0,amount_cents:5000}]};
  const handler=createAzdmHandler({
    getIdentity:async()=>({uid:'buyer',email:'buyer@example.com',emailVerified:true,name:'Buyer'}),
    getOffer:async()=>offer,readBody:async req=>req.body||'{}',rateLimit:()=>false,env:{},
    send:(r,s,b)=>sent.push({status:s,body:JSON.parse(b)}),
    localShop:{
      catalog:async ctx=>{calls.push(['catalog',ctx]);return {enabled:true,sandbox:false};},
      checkout:async ctx=>{calls.push(['checkout',ctx]);return {order_id:'azdm-local',payment_url:'https://toyyibpay.com/example',status:'pending'};},
      status:async()=>({status:'pending'}),orders:async()=>({orders:[]})
    }
  });
  await handler({method:'GET'},{},{pathname:'/api/azdm/catalog',query:{product_id:'AZDM'}});
  assert.equal(sent[0].status,200);assert.equal(sent[0].body.enabled,true);assert.equal(calls[0][0],'catalog');
  await handler({method:'POST',body:JSON.stringify({software_id:'AZDM',plan:'lifetime',quantity:2,request_id:randomUUID(),amount_cents:1})},{},{pathname:'/api/azdm/checkout',query:{}});
  assert.equal(sent[1].status,200);assert.equal(calls[1][1].body.account_uid,'buyer');assert.equal(calls[1][1].body.email,'buyer@example.com');assert.equal(calls[1][1].body.trusted_quote.total_cents,8000);assert.equal(calls[1][1].body.software_id,'AZDM');
});
