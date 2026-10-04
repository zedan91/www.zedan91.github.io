'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('../assets/js/azobss-azdm-offer-model'),{createAzdmHandler}=require('../lib/azobss-azdm'),{createOfferHandler}=require('../lib/azobss-azdm-offers');
const bundle=()=>({...model.defaults(),product_id:'OTHER-SOFTWARE',name:'Software lain',fulfilment:'download',bulk_minimum:0,bulk_unit_cents:0,plans:[{id:'three',label:'3 PC',quantity:3,days:0,amount_cents:10000},{id:'month',label:'1 Bulan',quantity:0,days:30,amount_cents:1200}]});
test('universal packages support arbitrary names, duration, fixed PC bundles and future price edits',()=>{
 assert.equal(model.quote(bundle(),'three',3).total_cents,10000);assert.throws(()=>model.quote(bundle(),'three',2));
 assert.equal(model.quote(bundle(),'month',4).total_cents,4800);
 const future=bundle();future.plans[0].amount_cents=15000;assert.equal(model.quote(future,'three',3).total_cents,15000);
 assert.equal(model.quote(model.defaults(),'lifetime',2).total_cents,8000);
 for(const patch of [{max_quantity:101},{bulk_minimum:1},{plans:[]},{plans:[{...bundle().plans[0],amount_cents:-1}]}])assert.throws(()=>model.normalize({...bundle(),...patch}));
});
test('actual premium resolver prices generic packages from trusted catalogue and keeps ordinary product checkout intact',async()=>{
 const source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8'),fn=source.slice(source.indexOf('async function azResolveTrustedPremiumProduct('),source.indexOf('\nfunction azRequestHasCommissionSecret'));
 let identity={uid:'real-buyer'},trusted={productId:'OTHER-SOFTWARE',name:'Software lain',type:'premium',price:'RM999',secureDownloadLink:'https://files.azobss.com/test.exe',softwarePackages:bundle()};
 const sandbox={azSoftwarePackageModel:model,getPremiumUser:()=>({}),azProductIdFromAny:p=>p.productId,cleanPremiumText:x=>String(x||''),cleanPremiumUrl:x=>x||'',azSafeR2ObjectKey:x=>x||'',azFindFirestoreProduct:async()=>trusted,azFindLocalSoftwareProduct:()=>null,azIsAdminTestPurchase:()=>false,azProductIsPremium:()=>true,azdmVerifiedAccount:async()=>identity,azSubscriptionSelectedPlan:()=>null,parseAmountToSen:x=>Math.round(Number(String(x).replace(/[^\d.]/g,''))*100)};
 vm.runInNewContext(fn+';globalThis.resolve=azResolveTrustedPremiumProduct;',sandbox);
 const data={product:{productId:'OTHER-SOFTWARE',price:'RM0.01',downloadLink:'https://attacker.invalid'},softwarePackageId:'three',packageQuantity:3,amount:1};
 const result=await sandbox.resolve(data,{});assert.equal(result.amountSen,10000);assert.equal(result.product.packageQuantity,3);assert.equal(result.downloadLink,'https://files.azobss.com/test.exe');
 await assert.rejects(sandbox.resolve({...data,packageQuantity:2},{}));identity=null;await assert.rejects(sandbox.resolve(data,{}));identity={uid:'real-buyer'};
 trusted={...trusted,status:'draft'};await assert.rejects(sandbox.resolve(data,{}));
 trusted={...trusted,status:'active',softwarePackages:null,price:'RM20'};assert.equal((await sandbox.resolve({product:{productId:'OTHER-SOFTWARE'}},{})).amountSen,2000);
});
test('package catalogue uses bounded SKU lookups and rejects disabled or unpublished software',async()=>{
 const source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8'),fn=source.slice(source.indexOf('async function azSoftwarePackageProduct('),source.indexOf('\nconst handleSoftwarePackages='));let product=null,stored=null,reads=0;
 const items={doc:id=>({get:async()=>{reads++;return {exists:false};}}),where:()=>({limit:()=>({get:async()=>{reads++;return {empty:!product,docs:product?[{id:'doc',data:()=>product}]:[]};}})})};
 const db={collection:name=>name==='softwareTools'?items:{doc:()=>({get:async()=>{reads++;return {data:()=>({items:{AZDM:stored}})};}})}};
 const sandbox={getAzobssBackendDb:()=>db,azNormalizeTrustedProduct:x=>x,azSoftwarePackageModel:model};vm.runInNewContext(fn+';globalThis.catalogue=azSoftwarePackageOffer',sandbox);
 assert.equal((await sandbox.catalogue('AZDM')).product_id,'AZDM');assert.equal(reads,3,'starter catalogue needs at most three document/query reads');
 product={name:'Software lain',status:'draft',softwarePackages:bundle()};await assert.rejects(sandbox.catalogue('OTHER-SOFTWARE'));
 product={...product,status:'active',softwarePackages:null};await assert.rejects(sandbox.catalogue('OTHER-SOFTWARE'));
 product={...product,softwarePackages:bundle()};assert.equal((await sandbox.catalogue('OTHER-SOFTWARE')).name,'Software lain');
});
test('equal-price packages with different quantity or terms do not reuse another checkout; ordinary fingerprints stay unchanged',()=>{
 const crypto=require('node:crypto'),source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8'),fn=source.slice(source.indexOf('function azAutomaticCheckoutFingerprint('),source.indexOf('\nfunction azAutomaticCheckoutKindForOrder'));
 const sandbox={crypto,cleanPremiumText:x=>String(x||''),azAutoCheckoutUserKey:()=> 'buyer',azAutoCheckoutItemKey:()=>''};vm.runInNewContext(fn+';globalThis.fingerprint=azAutomaticCheckoutFingerprint;',sandbox);
 const base={user:{uid:'buyer'},amountSen:10000,productId:'S'};const regular=sandbox.fingerprint('digital',base),pack={...base,softwarePackageId:'bundle',packageQuantity:3,softwarePackageDays:90};
 assert.equal(regular,crypto.createHash('sha256').update(['azobss-auto-checkout-v1050','digital','buyer','10000','s','',''].join('|')).digest('hex'));
 assert.notEqual(sandbox.fingerprint('digital',pack),regular);assert.notEqual(sandbox.fingerprint('digital',pack),sandbox.fingerprint('digital',{...pack,packageQuantity:2}));assert.notEqual(sandbox.fingerprint('digital',pack),sandbox.fingerprint('digital',{...pack,softwarePackageDays:365}));
});
test('AZDM checkout only forwards a quote loaded from server, ignoring submitted prices and forged quote',async()=>{
 let sent,payload;const offer={...bundle(),fulfilment:'azdm'};
 const handler=createAzdmHandler({getIdentity:async()=>({uid:'buyer',email:'buyer@example.com',emailVerified:true}),getOffer:async()=>offer,env:{AZDM_SHOP_SERVICE_TOKEN:'a'.repeat(64)},readBody:async()=>JSON.stringify({software_id:'OTHER-SOFTWARE',plan:'three',quantity:3,request_id:'11111111-1111-4111-8111-111111111111',trusted_quote:{total_cents:1},amount:1}),rateLimit:()=>false,send:(r,s,b)=>sent={status:s,...JSON.parse(b)},fetchImpl:async(u,o)=>{payload=JSON.parse(o.body);return Response.json({ok:true});}});
 await handler({method:'POST'},{},{pathname:'/api/azdm/checkout',query:{}});assert.equal(sent.status,200);assert.equal(payload.trusted_quote.total_cents,10000);assert.equal(payload.trusted_quote.id,'OTHER-SOFTWARE:three');
});
test('only verified owner can save serial integration settings; public catalogue does not write',async()=>{
 for(const identity of [null,{uid:'customer',isAdmin:false},{uid:'staff',isAdmin:false},{uid:'owner',isAdmin:true}]){
  let wrote=false,status;const handler=createOfferHandler({getIdentity:async()=>identity,readBody:async()=>JSON.stringify({...bundle(),fulfilment:'azdm'}),send:(r,s)=>status=s,saveOffer:async()=>wrote=true,getOffer:async()=>bundle(),rateLimit:()=>false});
  await handler({method:'POST'},{},{pathname:'/api/azdm/offers'});assert.equal(wrote,identity?.isAdmin===true);assert.equal(status,identity?.isAdmin?200:identity?.uid?403:401);
  wrote=false;await handler({method:'GET'},{},{pathname:'/api/software-packages/catalog',query:{product_id:'OTHER-SOFTWARE'}});assert.equal(status,200);assert.equal(wrote,false);
 }
});
