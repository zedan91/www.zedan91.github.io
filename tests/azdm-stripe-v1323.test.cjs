'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createAzdmHandler}=require('../lib/azobss-azdm');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json');
const html=fs.readFileSync(path.join(root,'Software-Tools','index.html'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets','js','azobss-software-packages.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');

test('v1323 exposes ToyyibPay and Stripe choices in AZDM plan dialog',()=>{
  assert.equal(pkg.version,'1.0.1323');
  assert.match(html,/data-azdm-buy[^>]*>Pay via ToyyibPay</);
  assert.match(html,/data-azdm-buy-stripe[^>]*>Pay via Stripe</);
  assert.match(html,/azobss-software-packages\.js\?v=1323/);
  assert.match(frontend,/payment_method:paymentMethod/);
  assert.match(frontend,/startCheckout\('stripe',buyStripe\)/);
  assert.match(frontend,/checkout\.stripe\.com/);
});

test('AZDM bridge forwards a trusted Stripe payment method and accepts Render order IDs on status',async()=>{
  const sent=[];const calls=[];
  const offer={enabled:true,product_id:'AZDM',name:'AZDM',fulfilment:'azdm',max_quantity:100,bulk_minimum:2,bulk_unit_cents:4000,plans:[{id:'annual',label:'1 Year',days:365,quantity:0,amount_cents:2500}]};
  const handler=createAzdmHandler({
    getIdentity:async()=>({uid:'buyer',email:'buyer@example.com',emailVerified:true,name:'Buyer'}),
    getOffer:async()=>offer,
    readBody:async req=>req.body||'{}',rateLimit:()=>false,env:{},
    send:(r,s,b)=>sent.push({status:s,body:JSON.parse(b)}),
    localShop:{
      catalog:async()=>({enabled:true,payment_methods:{toyyibpay:true,stripe:true}}),
      checkout:async ctx=>{calls.push(ctx.body);return {order_id:'azdm-'+ctx.body.request_id,payment_url:'https://checkout.stripe.com/c/pay/test',status:'pending'};},
      status:async ctx=>{calls.push(ctx.body);return {status:'pending'};},orders:async()=>({orders:[]})
    }
  });
  const id=randomUUID();
  await handler({method:'POST',body:JSON.stringify({software_id:'AZDM',plan:'annual',quantity:1,request_id:id,payment_method:'stripe'})},{},{pathname:'/api/azdm/checkout',query:{}});
  assert.equal(sent[0].status,200);assert.equal(calls[0].payment_method,'stripe');
  await handler({method:'GET'},{},{pathname:'/api/azdm/status',query:{azdm_order:'azdm-'+id}});
  assert.equal(sent[1].status,200);assert.equal(calls[1].order_id,'azdm-'+id);
});

test('Render AZDM checkout has Stripe session creation, webhook-compatible order metadata and API verification fallback',()=>{
  assert.match(backend,/paymentMethods:\{toyyibpay,stripe\}/);
  assert.match(backend,/paymentMethod === 'stripe'/);
  assert.match(backend,/azStripeDigitalRequest\('\/checkout\/sessions'/);
  assert.match(backend,/metadata\[orderId\]/);
  assert.match(backend,/stripeCheckoutSessionId:stripeData\.id/);
  assert.match(backend,/azVerifyDigitalStripeOrder\(order\)/);
  assert.match(backend,/azFinalizePaidOrderOnce\(order,req,\{verified:true,paymentMethod:'stripe'/);
  assert.match(backend,/else if \(azIsAzdmPremiumOrder\(latest\)\) \{\s*latest = await azFulfillAzdmOrder/);
});
