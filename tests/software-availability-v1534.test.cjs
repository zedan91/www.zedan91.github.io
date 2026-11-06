'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createSoftwareAvailability}=require('../lib/azobss-software-availability-v1534');
function fixture(){
 let state,reads=0,writes=0,admin=null,broken=false;const doc={get:async()=>{reads++;if(broken)throw Error('Offline');return {exists:!!state,data:()=>structuredClone(state)};}};
 const db={collection:()=>({doc:()=>doc}),runTransaction:async fn=>fn({get:r=>r.get(),set:(_r,data)=>{state=structuredClone(data);writes++;}})};
 const product={productId:'AZSW-ONE',id:'AZSW-ONE',name:'Software One',price:'RM25',items:['preserve'],r2ObjectKey:'software/fixture-private-installer.zip'};
 const service=createSoftwareAvailability({getDb:()=>db,getAdminIdentity:async()=>admin,findProduct:async id=>id.toLowerCase()==='azsw-one'?product:null,readBody:async req=>JSON.stringify(req.body),send:(res,status,body)=>Object.assign(res,{status,body:JSON.parse(body)}),now:()=>12345});
 return {service,product,setAdmin:value=>admin=value,setBroken:value=>broken=value,counts:()=>({reads,writes}),state:()=>state,call:async(method,path,body={})=>{const res={};await service.handle({method,body},res,{pathname:path});return res;}};
}
test('pause is persistent, case insensitive, reversible and retains trusted product and purchase data',async()=>{
 const f=fixture(),before=structuredClone(f.product);f.setAdmin({isAdmin:true,uid:'owner'});
 const paused=await f.call('POST','/api/admin/software-availability',{productId:'azsw-one',paused:true,reason:'Fix installer'});assert.equal(paused.status,200);assert.equal(paused.body.name,'Software One');assert.equal(f.state().items['azsw-one'].updatedBy,'owner');
 await assert.rejects(f.service.assertAvailable({productId:'AZSW-ONE'}),e=>e.statusCode===423);await f.service.assertAvailable({productId:'OTHER'});
 const restored=await f.call('POST','/api/admin/software-availability',{productId:'AZSW-ONE',paused:false,reason:''});assert.equal(restored.body.revision,2);await f.service.assertAvailable('AZSW-ONE');assert.deepEqual(f.product,before);assert.equal(f.counts().writes,2);
});
test('guests and staff cannot read private reasons or write availability; public result contains only paused IDs',async()=>{
 const f=fixture();for(const actor of [null,{uid:'buyer',isAdmin:false},{uid:'staff',role:'staff',isAdmin:false}]){f.setAdmin(actor);const before=f.counts();for(const method of ['GET','POST'])assert.equal((await f.call(method,'/api/admin/software-availability',{productId:'AZSW-ONE',paused:true})).status,403);assert.deepEqual(f.counts(),before);}
 f.setAdmin({uid:'owner',isAdmin:true});await f.call('POST','/api/admin/software-availability',{productId:'AZSW-ONE',paused:true,reason:'Private licensing discussion'});const publicData=(await f.call('GET','/api/software-availability')).body;assert.deepEqual(publicData.pausedIds,['azsw-one']);assert.equal(Object.hasOwn(publicData,'items'),false);assert.ok(!JSON.stringify(publicData).includes('licensing'));assert.ok(!JSON.stringify(publicData).includes('owner'));
});
test('invalid input, unknown products and unavailable storage fail without saving a fake local state',async()=>{
 const f=fixture();f.setAdmin({uid:'owner',isAdmin:true});for(const body of [{productId:'AZSW-ONE',paused:'true'},{productId:'../bad',paused:true},{productId:'AZSW-ONE',paused:true,reason:'x'.repeat(241)},{productId:'UNKNOWN',paused:true}])assert.ok((await f.call('POST','/api/admin/software-availability',body)).status>=400);assert.equal(f.counts().writes,0);f.setBroken(true);assert.equal((await f.call('GET','/api/software-availability')).status,503);await assert.rejects(f.service.assertAvailable('AZSW-ONE'),e=>e.statusCode===503);
});
test('actual shared checkout rejects paused normal, licence, package, subscription and admin-test products before side effects',async()=>{
 const source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8'),fn=source.slice(source.indexOf('async function azResolveTrustedPremiumProduct('),source.indexOf('\nfunction azRequestHasCommissionSecret'));
 for(const variant of [{},{softwarePackages:{enabled:true}},{subscriptionCodeEnabled:true},{licenseProduct:'solattime'},{isAdminTestPurchase:true}]){
  let checked=false;const context={getPremiumUser:()=>({}),azProductIdFromAny:p=>p.productId,azFindFirestoreProduct:async()=>({productId:'AZSW-ONE',...variant}),softwareAvailability:{assertAvailable:async()=>{checked=true;throw Object.assign(Error('Paused'),{statusCode:423});}}};vm.runInNewContext(fn+';globalThis.run=azResolveTrustedPremiumProduct',context);await assert.rejects(context.run({product:{productId:'AZSW-ONE'}},{}),e=>e.statusCode===423);assert.ok(checked);
 }
});
test('legacy object-only sessions are blocked and public object hashes never expose private object paths',async()=>{
 const f=fixture();f.setAdmin({isAdmin:true,uid:'owner'});await f.call('POST','/api/admin/software-availability',{productId:'AZSW-ONE',paused:true});await assert.rejects(f.service.assertAvailable({sourceTarget:'software/fixture-private-installer.zip'}),e=>e.statusCode===423);const publicData=(await f.call('GET','/api/software-availability')).body;assert.equal(publicData.pausedObjectHashes.length,1);assert.match(publicData.pausedObjectHashes[0],/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(publicData).includes('fixture-private-installer'));
});
test('actual token start and existing download session are checked before counters, streams or R2 redirects',async()=>{
 const source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8');
 const start=source.slice(source.indexOf('async function azCreatePremiumDownloadSession('),source.indexOf('\nasync function ',source.indexOf('async function azCreatePremiumDownloadSession(')+10));
 const context={softwareAvailability:{assertAvailable:async()=>{throw Object.assign(Error('Paused'),{statusCode:423});}}};vm.runInNewContext(start+';globalThis.start=azCreatePremiumDownloadSession',context);await assert.rejects(context.start({},'test',{productId:'AZSW-ONE'}),e=>e.statusCode===423);
 const session=source.slice(source.indexOf('async function azHandlePremiumDownloadSession('),source.indexOf('\nfunction ',source.indexOf('async function azHandlePremiumDownloadSession(')+10));
 let response;Object.assign(context,{cleanPremiumText:x=>x,azFindPremiumSessionDeep:async()=>({productId:'AZSW-ONE'}),send:(_r,status,message)=>response={status,message}});vm.runInNewContext(session+';globalThis.session=azHandlePremiumDownloadSession',context);await context.session({headers:{}},{},'existing');assert.equal(response.status,423);
});
