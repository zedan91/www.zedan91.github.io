'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const D=require('../lib/azobss-tech-delivery');
const eligible=D.packageDetails({kg:1,length:20,width:15,height:5,eligible:true});
const settings=D.normalizeSettings({subsidyEnabled:true,categories:['RAM'],marginShare:100,marginReserve:10});
const price=(total,km,vehicle='car',unitCost=400,box=eligible)=>D.calculate(settings,[{productId:'ram',qty:1,category:'RAM',unitCost}],{ram:box},{itemTotal:total,km,vehicle,cost:30});
test('subsidy follows approved vehicle caps, minimum purchase, road distance, margin and product eligibility',()=>{
  assert.deepEqual(price(500,10),{cost:30,subsidy:25,charge:5,km:10,vehicle:'car'});
  assert.equal(price(499,10).charge,30);
  assert.equal(price(1999,9,'van').charge,30);
  assert.equal(price(2000,9,'van').charge,0);
  assert.equal(price(500,10.01).charge,30);
  assert.equal(price(500,null).charge,30);
  assert.equal(price(500,9,'car',487).subsidy,3);
  assert.equal(price(500,9,'car',0).charge,30);
  assert.equal(price(500,9,'car',400,{...eligible,eligible:false}).charge,30);
  assert.equal(price(500,9,'motorcycle').subsidy,15);
  assert.equal(D.calculate(D.DEFAULTS,[{productId:'ram',qty:1,category:'RAM',unitCost:400}],{ram:eligible},{itemTotal:500,km:9,vehicle:'car',cost:30}).charge,30);
});
test('mixed RAM, SSD, laptop and custom PC use conservative carton geometry and verified mass',()=>{
  const items=['ram','ssd','laptop','custom'].map(productId=>({productId,qty:1}));
  const known={ram:eligible,ssd:eligible,laptop:{...eligible,kg:3,length:45,width:30,height:12,fragile:true},
    custom:{...eligible,kg:12,length:65,width:45,height:35}};
  const pack=D.packing(items,known);
  assert.deepEqual([pack.kg,pack.length,pack.width,pack.height],[17,65,45,57]);
  assert.equal(D.vehicleFits('motorcycle',pack),false);
  assert.equal(D.vehicleFits('car',pack),false);
  assert.equal(D.vehicleFits('van',pack),true);
  assert.equal(D.packing(items,{ram:eligible}),null);
  assert.throws(()=>D.packing(items,known,{...pack,kg:2}),{code:'package_weight'});
});
test('live carrier request sends official route and returns actual MYR rate, TTL and driving distance',async()=>{
  const cfg={PC_SHIPPING_LALAMOVE_MODE:'production',PC_SHIPPING_LALAMOVE_KEY:'test-key',PC_SHIPPING_LALAMOVE_SECRET:'test-secret',PC_SHIPPING_LALAMOVE_CAR:'CAR'};
  const expiresAt=new Date(Date.now()+60000).toISOString();
  const api=D.integration(cfg,async (url,options)=>{
    assert.equal(url,'https://rest.lalamove.com/v3/quotations');
    assert.equal(options.headers.Market,'MY');
    assert.match(options.headers.Authorization,/^hmac test-key:\d+:[0-9a-f]{64}$/);
    assert.equal(JSON.parse(options.body).data.language,'en_MY');
    return {ok:true,json:async()=>({data:{quotationId:'q1',expiresAt,priceBreakdown:{total:'30.00',currency:'MYR'},distance:{value:'9500',unit:'m'},stops:[{stopId:'s1'},{stopId:'s2'}]}})};
  });
  const from=D.DEFAULTS.location,to={latitude:3.3,longitude:101.7};
  const q=await api.quotation(from,to,'car',eligible);
  assert.equal(q.km,9.5);
  assert.equal(q.cost,30);
  assert.equal(q.expiresAtMs,Date.parse(expiresAt));
  assert.deepEqual(q.stopIds,['s1','s2']);
  const timeout=D.integration(cfg,async()=>{throw new DOMException('timeout','TimeoutError');});
  await assert.rejects(timeout.quotation(from,to,'car',eligible),{name:'TimeoutError'});
  assert.equal(await D.integration({},()=>assert.fail()).quotation(from,to,'car',eligible),null);
  const expired=D.integration(cfg,async()=>({ok:true,json:async()=>({data:{quotationId:'expired',expiresAt:'2020-01-01',priceBreakdown:{total:'30',currency:'MYR'}}})}));
  assert.equal(await expired.quotation(from,to,'car',eligible),null);
});
test('carrier webhook validates market account, path, signed data and time window',()=>{
  const env={PC_SHIPPING_LALAMOVE_MODE:'production',PC_SHIPPING_LALAMOVE_KEY:'test-key',PC_SHIPPING_LALAMOVE_SECRET:'test-secret'};
  const api=D.integration(env,()=>assert.fail()),path='/api/pc-shop/lalamove-webhook';
  const now=Date.now(),timestamp=Math.floor(now/1000);
  const data={order:{orderId:'123',status:'COMPLETED'},updatedAt:new Date(now).toISOString()};
  const signature=createHmac('sha256',env.PC_SHIPPING_LALAMOVE_SECRET).update([timestamp,'POST',path,'',JSON.stringify(data)].join('\n')).digest('hex');
  const event={apiKey:env.PC_SHIPPING_LALAMOVE_KEY,timestamp,data,signature};
  assert.equal(api.webhook(path,event,now),true);
  assert.equal(api.webhook(path,{...event,data:{...data,order:{...data.order,status:'CANCELED'}}},now),false);
  assert.equal(api.webhook('/unrelated',event,now),false);
  assert.equal(api.webhook(path,event,now+86400001),false);
});

test('pickup proposals stay in Malaysia local time, never add delivery fees, and expose only approved profile URL formats',()=>{
  const {createTechDelivery}=require('../lib/azobss-tech-delivery-routes');
  const route=createTechDelivery({});
  const cfg=D.normalizeSettings({location:{address:'',mapsListingUrl:'https://maps.app.goo.gl/Example123'}});
  const row=route.validateRequest(cfg,D.PICKUP,{customerAddress:'ignore this',pickupRequestedSlot:'2026-12-12T14:00'});
  assert.equal(row.customerAddress,'');
  assert.equal(row.delivery.charge,0);
  assert.match(row.pickupLocation.address,/Tingkat 1, 30-1B/);
  assert.equal(D.customerDelivery({...row,shippingMethod:D.PICKUP}).pickupRequestedSlot,'2026-12-12T14:00');
  assert.equal(D.customerDelivery({...row,shippingMethod:D.PICKUP,pickupConfirmedSlot:'2026-12-12T15:00'}).pickupConfirmedSlot,'2026-12-12T15:00');
  assert.throws(()=>route.validateRequest(cfg,D.PICKUP,{pickupRequestedSlot:'2026-02-30T14:00'}),{code:'pickup_slot'});
  assert.throws(()=>D.normalizeSettings({location:{mapsListingUrl:'https://example.com/maps'}}),{code:'pickup_listing'});
});
