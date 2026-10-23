'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSolatTimeAdminHandler}=require('../lib/azobss-solattime-admin');
const secret='isolated-fixture-solattime-admin-credential-123456';
const id='11111111-1111-4111-8111-111111111111';
const serial='AZST-'+Array(6).fill('AAAAA').join('-');
function fixture({identity={uid:'owner',isAdmin:true},env={SOLATTIME_ADMIN_TOKEN:secret},data={licenses:[],next_offset:null},status=200,rateLimited=false,fetchError=false}={}){
 const calls=[],replies=[];
 const handler=createSolatTimeAdminHandler({getAdminIdentity:async()=>identity,env,rateLimit:()=>rateLimited,readBody:async req=>req.body||'{}',send:(res,status,raw,type,headers)=>replies.push({status,body:JSON.parse(raw),headers}),fetchImpl:async(url,options)=>{calls.push({url,options});if(fetchError)throw Error(secret);return Response.json(data,{status});}});
 return {calls,replies,run:(action='list',body={},method='POST')=>handler({method,body:typeof body==='string'?body:JSON.stringify(body)},{},{pathname:'/api/solattime/admin/'+action}),handler};
}
test('SolatTime rejects unsigned accounts, customers and forged browser admin roles',async()=>{
 for(const identity of [null,{uid:'customer',isAdmin:false},{uid:'staff',role:'admin'}]){
  const f=fixture({identity});await f.run('issue',{customer:'Example',isAdmin:true,adminToken:secret});
  assert.ok([401,403].includes(f.replies[0].status));assert.equal(f.calls.length,0);
 }
});
test('SolatTime always uses its fixed Worker and server secret, never AZDM or caller credentials',async()=>{
 const f=fixture({env:{SOLATTIME_ADMIN_TOKEN:' \n'+secret+' ',SOLATTIME_LICENSE_URL:'https://evil.example',AZDM_ADMIN_TOKEN:'wrong'}});
 await f.run('list',{limit:25,offset:25,adminToken:'forged',url:'https://evil.example'});
 assert.equal(f.calls[0].url,'https://solattime-license.zedan9107.workers.dev/admin/list');
 assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+secret);
 assert.equal(f.calls[0].options.redirect,'error');assert.deepEqual(JSON.parse(f.calls[0].options.body),{limit:25,offset:25});
 assert.equal(f.replies[0].headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(f.replies).includes(secret));
});
test('list projects actual Worker fields, paginates and drops upstream debug/secrets',async()=>{
 const f=fixture({data:{licenses:[{id,customer:'Example',source:'new',status:'active',generation:1,created:100,device_count:1,token:secret}],next_offset:25,debug:secret}});
 await f.run();assert.equal(f.replies[0].body.next_offset,25);assert.equal(f.replies[0].body.licenses[0].id,id);
 assert.equal(JSON.stringify(f.replies).includes(secret),false);
});
test('new serial output is returned for explicit issue with no invented expiry field',async()=>{
 const f=fixture({data:{license_id:id,serial,debug:secret}});await f.run('issue',{customer:' Customer ',days:30});
 assert.deepEqual(JSON.parse(f.calls[0].options.body),{customer:'Customer'});
 assert.deepEqual(f.replies[0].body,{ok:true,license_id:id,serial});
});
test('legacy import and block/restore match the actual SolatTime admin protocol',async()=>{
 const f=fixture({data:{ok:true}});await f.run('import-legacy',{customer:'Legacy',serial:' azst-1234-5678-9abc-def0-1234 '});
 assert.equal(JSON.parse(f.calls[0].options.body).serial,'AZST-1234-5678-9ABC-DEF0-1234');
 for(const action of ['block','restore']){await f.run(action,{license_id:id,transfer:true});assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{license_id:id});}
 assert.ok(f.calls[1].url.endsWith('/admin/block'));
});
test('SolatTime refuses AZDM operations, GET, malformed data and invalid pagination',async()=>{
 for(const action of ['reset','delete','revoke','orders','update','../issue']){const f=fixture();await f.run(action);assert.equal(f.replies[0].status,404);assert.equal(f.calls.length,0);}
 for(const [action,body,method,status] of [['issue',{},'GET',405],['list','bad JSON','POST',400],['list',[],'POST',400],['list',{offset:-1},'POST',400],['list',{limit:101},'POST',400],['issue',{customer:''},'POST',400],['issue',{customer:'a'.repeat(121)},'POST',400],['import-legacy',{customer:'Old',serial},'POST',400],['block',{license_id:'invalid'},'POST',400],['issue',{customer:'a'.repeat(9000)},'POST',413]]){
  const f=fixture();await f.run(action,body,method);assert.equal(f.replies[0].status,status);assert.equal(f.calls.length,0);
 }
});
test('missing setup and rate limits stop before sending anything upstream',async()=>{
 const f=fixture({env:{AZDM_ADMIN_TOKEN:secret}});await f.run();assert.equal(f.replies[0].status,503);assert.equal(f.calls.length,0);
 const limited=fixture({rateLimited:true});await limited.run();assert.equal(limited.calls.length,0);
 assert.equal(await f.handler({method:'POST'},{},{pathname:'/api/azdm/admin/list'}),false);
});
test('upstream errors, invalid schemas and exceptions never leak the owner credential',async()=>{
 for(const options of [{fetchError:true},{data:{error:secret},status:401},{data:{debug:secret}},{data:{licenses:[],next_offset:-1}}]){
  const f=fixture(options);await f.run();assert.ok(f.replies[0].status>=400);assert.equal(JSON.stringify(f.replies).includes(secret),false);
 }
 const f=fixture({data:{error:'already_registered'},status:409});await f.run('import-legacy',{customer:'Old',serial:'AZST-1234-5678-9ABC-DEF0-1234'});
 assert.equal(f.replies[0].status,409);assert.match(f.replies[0].body.error,/sudah didaftarkan/);
});
