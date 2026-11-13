'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveMapPin}=require('../lib/azobss-delivery-map-link');
const {createTechDelivery}=require('../lib/azobss-tech-delivery-routes');
const point={latitude:3.240793,longitude:101.704036};
const path='/maps/place/Test/@4.8,102.3,17z/data=!4m6!3m5!8m2!3d3.240793!4d101.704036!16s%2Fg%2Ftest';
const never=()=>{assert.fail('Full links must not trigger a fetch');};
test('uses the selected Google Maps pin instead of the map viewport',async()=>{
  for(const url of [
    'https://www.google.com'+path,
    'https://www.google.com/maps/search/?api=1&query=3.240793%2C101.704036',
    'https://maps.google.com/?q=3.240793%2C101.704036',
    'https://www.google.com/maps/place/3.240793%2C101.704036/@4,101,17z'
  ])assert.deepEqual(await resolveMapPin(url,never),point);
  assert.deepEqual(await resolveMapPin('https://www.google.com/maps?q=-3.5,-101.7',never),{latitude:-3.5,longitude:-101.7});
});
test('does not mistake the viewport, a search phrase, or a route for a pin',async()=>{
  for(const url of [
    'https://www.google.com/maps/@3.2,101.7,17z',
    'https://www.google.com/maps/search/?api=1&query=Gombak',
    'https://www.google.com/maps/dir/?q=3.2,101.7',
    'https://www.google.com/maps/search/?query=93,101.7',
    'https://www.google.com/maps/place/Test/@3.2,101.7,17z'
  ])await assert.rejects(resolveMapPin(url,never),{code:'maps_pin_missing'});
});
test('resolves short Google Maps links without contacting the final map page',async()=>{
  const short='https://maps.app.goo.gl/ABCDE?g_st=aw',seen=[];
  const pin=await resolveMapPin(short,async (url,opts)=>{
    seen.push(url);assert.equal(opts.redirect,'manual');assert.ok(opts.signal);
    return new Response(null,{status:302,headers:{location:'https://www.google.com'+path}});
  });
  assert.deepEqual(seen,[short]);assert.deepEqual(pin,point);
});
test('rejects redirects outside Google Maps and stops redirect loops',async()=>{
  const short='https://maps.app.goo.gl/ABCDE';
  const urls=[];
  await assert.rejects(resolveMapPin(short,async url=>{
    urls.push(url);return new Response(null,{status:302,headers:{location:'https://example.com/maps?q=3,101'}});
  }),{code:'maps_link_unavailable'});
  assert.deepEqual(urls,[short]);
  let attempts=0;
  await assert.rejects(resolveMapPin(short,async()=>{
    attempts++;return new Response(null,{status:302,headers:{location:short}});
  }),{code:'maps_link_unavailable'});
  assert.equal(attempts,3);
  for(const url of ['https://maps.app.goo.gl.example.com/ABCDE','https://www.google.com/url?q=3,101','http://maps.app.goo.gl/ABCDE','https://example.com@maps.app.goo.gl/ABCDE','https://goo.gl/ABCDE']){
    await assert.rejects(resolveMapPin(url,never),{code:'maps_link_invalid'});
  }
});
test('requires a signed-in customer and returns only the validated pin without writing an order',async()=>{
  const route=new URL('https://example.com/api/pc-shop/shipping-map-pin');
  let parsed=0;
  const delivery=createTechDelivery({
    getUserIdentity:req=>req.user,
    getDb:()=>assert.fail('Pin lookup should not require Firestore'),
    parseBody:req=>{parsed++;return req.body;},
    json:(_res,status,body)=>({status,body})
  });
  assert.deepEqual(await delivery.handle({method:'POST'},null,route),{status:401,body:{ok:false,error:'login_required'}});
  assert.equal(parsed,0);
  assert.deepEqual(await delivery.handle({method:'POST',user:{uid:'fixture'},body:{url:'https://www.google.com'+path}},null,route),
    {status:200,body:{ok:true,pin:point}});
  assert.equal(parsed,1);
});
