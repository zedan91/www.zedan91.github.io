const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAzdmAdminHandler}=require('../lib/azobss-azdm-admin');
const secret='private-test-admin-token-not-a-customer-key-123456';
function fixture(identity={uid:'owner',isAdmin:true},env={AZDM_ADMIN_TOKEN:secret},response={licenses:[],next_cursor:null}) {
  const calls=[],replies=[];
  const handler=createAzdmAdminHandler({getAdminIdentity:async()=>identity,env,rateLimit:()=>false,readBody:async req=>req.body||'{}',send:(r,status,raw,type,headers)=>replies.push({status,body:JSON.parse(raw),headers}),fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(response);}});
  return {handler,calls,replies};
}
test('only verified server-approved owners can use the AZDM admin bridge',async()=>{
  for(const identity of [null,{uid:'customer',isAdmin:false},{uid:'staff',role:'admin',isAdmin:false}]) {
    const f=fixture(identity);await f.handler({method:'POST',body:JSON.stringify({isAdmin:true,adminToken:secret})},{},{pathname:'/api/azdm/admin/list'});
    assert.ok([401,403].includes(f.replies[0].status));assert.equal(f.calls.length,0);
  }
});
test('server admin credential is sent to the fixed license endpoint and never returned to browser',async()=>{
  const f=fixture();await f.handler({method:'POST',body:JSON.stringify({limit:25})},{},{pathname:'/api/azdm/admin/list'});
  assert.equal(f.replies[0].status,200);assert.equal(f.calls[0].url,'https://azdm-license.zedan9107.workers.dev/admin/list');
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+secret);assert.equal(JSON.stringify(f.replies).includes(secret),false);assert.equal(f.replies[0].headers['Cache-Control'],'no-store');
});
test('copied credentials tolerate surrounding whitespace without changing the secret',async()=>{
  const f=fixture(undefined,{AZDM_ADMIN_TOKEN:' \n'+secret+'\r\n '});
  await f.handler({method:'POST',body:'{}'},{},{pathname:'/api/azdm/admin/list'});
  assert.equal(f.replies[0].status,200);
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+secret);
});
test('allowed license operations and email retries are forwarded without SurveyCAD operations',async()=>{
  for(const action of ['issue','update','reset','revoke','restore','delete','orders','order-email-retry']) {
    const f=fixture();await f.handler({method:'POST',body:'{"customer":"Example"}'},{},{pathname:'/api/azdm/admin/'+action});assert.equal(f.calls.length,1);assert.match(f.calls[0].url,new RegExp('/admin/'+action+'$'));
  }
  const f=fixture();assert.equal(await f.handler({method:'POST'},{},{pathname:'/api/admin/software-keys-action'}),false);
});
test('unknown operations, GET mutations, large or malformed bodies and missing setup are rejected',async()=>{
  for(const [method,action,body,status] of [['POST','destroy','{}',404],['GET','reset','{}',405],['POST','list','[]',400],['POST','list','bad JSON',400],['POST','list','{"x":"'+'x'.repeat(9000)+'"}',413]]) {
    const f=fixture();await f.handler({method,body},{},{pathname:'/api/azdm/admin/'+action});assert.equal(f.replies[0].status,status);assert.equal(f.calls.length,0);
  }
  const f=fixture(undefined,{});await f.handler({method:'POST'},{},{pathname:'/api/azdm/admin/list'});assert.equal(f.replies[0].status,503);
});
test('AZDM order list and retry can be served from Render-local order storage instead of missing Worker admin routes',async()=>{
  const replies=[],localCalls=[];
  const handler=createAzdmAdminHandler({getAdminIdentity:async()=>({uid:'owner',isAdmin:true}),env:{},rateLimit:()=>false,readBody:async req=>req.body||'{}',send:(r,status,raw)=>replies.push({status,body:JSON.parse(raw)}),localAdmin:{
    orders:async ctx=>{localCalls.push(['orders',ctx]);return {enabled:true,orders:[{id:'azdm-1'}],next_cursor:null};},
    'order-email-retry':async ctx=>{localCalls.push(['retry',ctx]);return {order:{id:'azdm-1',email_status:'accepted'}};}
  }});
  await handler({method:'POST',body:'{"limit":25}'},{},{pathname:'/api/azdm/admin/orders'});
  assert.equal(replies[0].status,200);assert.equal(replies[0].body.orders[0].id,'azdm-1');
  await handler({method:'POST',body:'{"order_id":"azdm-1"}'},{},{pathname:'/api/azdm/admin/order-email-retry'});
  assert.equal(replies[1].status,200);assert.equal(localCalls.length,2);
});
