'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createSolatTimeCommerce,codec,isProduct,isOrder,orderFields,paymentMatches,COLLECTION}=require('../lib/azobss-solattime-commerce');
const clone=v=>v===undefined?undefined:structuredClone(v);
class Store{
 constructor(){this.values=new Map();this.queue=Promise.resolve();}
 ref(collection,id){const key=collection+'/'+id;return {id,get:async()=>({exists:this.values.has(key),data:()=>clone(this.values.get(key))}),set:async value=>this.values.set(key,clone(value)),key};}
 collection(name){const self=this;return {doc:id=>self.ref(name,id),where(field,op,value){let cursor='',limit=26;const q={orderBy(){return q;},limit(n){limit=n;return q;},startAfter(v){cursor=v;return q;},async get(){return {docs:[...self.values].filter(([key,v])=>key.startsWith(name+'/')&&(op==='in'?value.includes(v[field]):v[field]===value)&&key.slice(name.length+1)>cursor).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,v])=>({id:key.slice(name.length+1),data:()=>clone(v)}))};}};return q;}};}
 runTransaction(fn){const job=this.queue.then(()=>fn({get:ref=>ref.get(),set:(ref,data)=>this.values.set(ref.key,clone(data))}));this.queue=job.catch(()=>{});return job;}
}
function fixture(){
 const db=new Store(),orders=new Map(),sent=[],issues=new Map(),requests=[],emails=[];
 let identity={uid:'buyer-1',email:'buyer@example.com',emailVerified:true},admin={uid:'admin',isAdmin:true},paid=true,emailFails=false,loseResponse=false,workerFails=false,verifyCount=0,persistFails=false;
 const env={SOLATTIME_ADMIN_TOKEN:crypto.randomBytes(32).toString('hex'),SOLATTIME_ORDER_CIPHER_KEY:crypto.randomBytes(32).toString('hex')};
 const service=createSolatTimeCommerce({getDb:()=>db,getIdentity:async()=>identity,getAdminIdentity:async()=>admin,findOrder:async id=>clone(orders.get(id)),persistSummary:async order=>{if(persistFails)throw Error('DB down');orders.set(order.orderId,clone(order));await db.collection('premiumOrders').doc(order.orderId).set(order);},verifyPayment:async(order,opts)=>{verifyCount++;if(opts?.finalize&&paid){const updated={...order,status:'paid',paymentVerifiedAt:'verified'};orders.set(order.orderId,updated);return updated;}return opts?.finalize?order:paid;},sendEmail:async(order,issued)=>{if(emailFails)throw Error('SMTP down');emails.push({...issued,email:order.email});},send:(res,status,body)=>sent.push({status,...JSON.parse(body)}),readBody:async req=>req.body||'{}',rateLimit:()=>false,env,fetchImpl:async(url,options)=>{requests.push({url,options});const body=JSON.parse(options.body);if(workerFails)return {ok:false,json:async()=>({error:'private upstream details'})};if(url.endsWith('/commerce-ready'))return {ok:true,json:async()=>({ok:true,commerce_protocol:1})};assert.ok(url.endsWith('/issue-order'));const previous=issues.get(body.order_id);if(previous)assert.deepEqual(body,previous);else issues.set(body.order_id,clone(body));if(loseResponse){loseResponse=false;throw Error('Lost response after committed issue');}return {ok:true,json:async()=>({ok:true,license_id:body.license_id})};}});
 const order={orderId:'tp-order-123',product:{name:'AZOBSS SolatTime',licenseProduct:'solattime',fulfilment:'solattime'},solattimeOrder:true,solattimeAccountUid:'buyer-1',user:{uid:'buyer-1',username:'Customer',email:'buyer@example.com'},email:'buyer@example.com',status:'paid',amountSen:3000,paymentMethod:'toyyibpay',paymentVerifiedAt:'verified',createdAt:'2026-10-24T00:00:00Z'};
 async function add(value=order){orders.set(value.orderId,clone(value));await db.collection('premiumOrders').doc(value.orderId).set(value);return value;}
 async function call(path,body={}){const isAdmin=path.includes('/admin/');await service.handle({method:isAdmin?'POST':'GET',body:JSON.stringify(body)},{},{pathname:path,query:body});return sent.at(-1);}
 return {db,orders,service,env,order,add,call,issues,requests,emails,sent,setIdentity:v=>identity=v,setAdmin:v=>admin=v,setPaid:v=>paid=v,setEmailFails:v=>emailFails=v,setLost:v=>loseResponse=v,setWorkerFails:v=>workerFails=v,setPersistFails:v=>persistFails=v,get verifyCount(){return verifyCount;}};
}
test('SolatTime catalog detection and order markers do not classify other products',()=>{
 assert.ok(isProduct({name:'AZOBSS SolatTime'}));assert.ok(!isProduct({name:'AZDM'}));assert.ok(!isOrder({product:{name:'AZOBSS SolatTime'}}));assert.deepEqual(orderFields({licenseProduct:'solattime',fulfilment:'solattime'},{uid:'u'}),{solattimeOrder:true,solattimeAccountUid:'u'});assert.deepEqual(orderFields({fulfilment:'azdm'},{uid:'u'}),{});
});
test('AES-GCM binds serial to order/account/amount and rejects wrong keys or tampering',()=>{
 const c=codec(crypto.randomBytes(32).toString('hex')),value={serial:'AZST-ABCDE-FGHIJ-KLMNO-PQRST-UVWXY-Z2345',license_id:crypto.randomUUID()},raw=c.encrypt(value,'order-a');assert.ok(!raw.includes(value.serial));assert.deepEqual(c.decrypt(raw,'order-a'),value);assert.throws(()=>c.decrypt(raw,'order-b'));assert.throws(()=>codec('b'.repeat(64)).decrypt(raw,'order-a'));assert.throws(()=>c.decrypt(raw.slice(0,-3)+'xyz','order-a'));assert.throws(()=>codec('short'));
});
test('provider proof requires amount, order reference, session and currency',()=>{
 const order={orderId:'tp-1',amountSen:3000,billCode:'bill',stripeCheckoutSessionId:'cs_1'};
 const toy={paid:true,tx:{billpaymentAmount:'30.00',billExternalReferenceNo:'tp-1',billCode:'bill'}};assert.ok(paymentMatches(order,'toyyibpay',toy));assert.ok(!paymentMatches(order,'toyyibpay',{...toy,tx:{...toy.tx,billpaymentAmount:'1.00'}}));assert.ok(!paymentMatches(order,'toyyibpay',{...toy,tx:{...toy.tx,billExternalReferenceNo:'another'}}));
 const stripe={paid:true,session:{id:'cs_1',client_reference_id:'tp-1',metadata:{orderId:'tp-1'},currency:'myr',amount_total:3000}};assert.ok(paymentMatches(order,'stripe',stripe));for(const patch of [{currency:'usd'},{amount_total:100},{id:'other'},{metadata:{orderId:'other'}}])assert.ok(!paymentMatches(order,'stripe',{...stripe,session:{...stripe.session,...patch}}));assert.ok(!paymentMatches(order,'admin-test',toy));assert.ok(!paymentMatches(order,'toyyibpay',{...toy,paid:false}));
});
test('verified payment produces one durable encrypted serial, one email, buyer can recover it',async()=>{
 const f=fixture();await f.add();await f.service.fulfill(f.order);assert.equal(f.issues.size,1);assert.equal(f.emails.length,1);const record=await f.db.collection(COLLECTION).doc(f.order.orderId).get();assert.equal(record.data().state,'complete');assert.ok(!JSON.stringify(record.data()).includes(f.emails[0].serial));const result=await f.call('/api/solattime/order',{order_id:f.order.orderId});assert.equal(result.status,200);assert.equal(result.order.serial,f.emails[0].serial);assert.equal(result.order.license_id,f.emails[0].license_id);assert.equal(f.orders.get(f.order.orderId).solattimeFulfillmentState,'complete');assert.ok(!JSON.stringify(f.orders.get(f.order.orderId)).includes(f.emails[0].serial));
});
test('parallel duplicate callbacks and completed retries issue/send only once',async()=>{
 const f=fixture();await f.add();await Promise.all([f.service.fulfill(f.order),f.service.fulfill(f.order),f.service.fulfill(f.order)]);await f.service.fulfill(f.order);assert.equal(f.issues.size,1);assert.equal(f.requests.filter(x=>x.url.endsWith('/issue-order')).length,1);assert.equal(f.emails.length,1);
});
test('lost Worker response retries same serial/id and does not create another licence',async()=>{
 const f=fixture();await f.add();f.setLost(true);await f.service.fulfill(f.order);assert.equal(f.issues.size,1);assert.equal(f.emails.length,0);await f.service.fulfill(f.order);assert.equal(f.emails.length,0,'automatic backoff is respected');await f.service.fulfill(f.order,{retryNow:true});assert.equal(f.issues.size,1);assert.equal(f.emails.length,1);assert.equal(f.requests.filter(x=>x.url.endsWith('/issue-order')).length,2);
});
test('email failure preserves issued serial; retry sends identical key without another Worker issue',async()=>{
 const f=fixture();await f.add();f.setEmailFails(true);await f.service.fulfill(f.order);const first=await f.call('/api/solattime/order',{order_id:f.order.orderId});assert.ok(first.order.serial);f.setEmailFails(false);const resend=await f.call('/api/solattime/admin/retry-email',{order_id:f.order.orderId});assert.equal(resend.status,200);assert.equal(f.emails[0].serial,first.order.serial);assert.equal(f.requests.filter(x=>x.url.endsWith('/issue-order')).length,1);
});
test('pending, unverified, provider mismatch and non-SolatTime orders never issue',async()=>{
 const f=fixture();await f.add();for(const order of [{...f.order,status:'pending'},{...f.order,paymentVerifiedAt:''},{...f.order,product:{fulfilment:'azdm'}}])await f.service.fulfill(order);assert.equal(f.issues.size,0);f.setPaid(false);await assert.rejects(()=>f.service.fulfill(f.order));assert.equal(f.issues.size,0);
});
test('buyer API requires verified identity and denies another account, including email spoofing',async()=>{
 const f=fixture();await f.add();await f.service.fulfill(f.order);f.setIdentity({uid:'other',email:'buyer@example.com',emailVerified:true});assert.equal((await f.call('/api/solattime/order',{order_id:f.order.orderId})).status,404);assert.deepEqual((await f.call('/api/solattime/orders')).orders,[]);f.setIdentity(null);assert.equal((await f.call('/api/solattime/orders')).status,401);f.setIdentity({uid:'buyer-1',email:'buyer@example.com',emailVerified:false});assert.equal((await f.call('/api/solattime/orders')).status,403);f.setAdmin({uid:'customer',isAdmin:false});assert.equal((await f.call('/api/solattime/admin/retry-email',{order_id:f.order.orderId})).status,403);
});
test('missing cipher/Worker migration blocks checkout, secrets never appear in errors',async()=>{
 const f=fixture();await f.service.prepareCheckout({});assert.ok(f.requests[0].url.endsWith('/commerce-ready'));delete f.env.SOLATTIME_ORDER_CIPHER_KEY;await assert.rejects(()=>f.service.prepareCheckout({}));const other=fixture();other.setWorkerFails(true);await assert.rejects(()=>other.service.prepareCheckout({}));await other.add();const response=await other.call('/api/solattime/order',{order_id:other.order.orderId});assert.ok(!JSON.stringify(response).includes(other.env.SOLATTIME_ADMIN_TOKEN));assert.ok(!JSON.stringify(response).includes('private upstream details'));
});
test('wrong encryption key does not replace an existing serial or issue another licence',async()=>{
 const f=fixture();await f.add();f.setEmailFails(true);await f.service.fulfill(f.order);f.env.SOLATTIME_ORDER_CIPHER_KEY='b'.repeat(64);await assert.rejects(()=>f.service.fulfill(f.order,{retryNow:true}));assert.equal(f.issues.size,1);assert.equal(f.requests.filter(x=>x.url.endsWith('/issue-order')).length,1);
});
test('lease prevents another instance sending while owner works; abandoned lease is recoverable',async()=>{
 const f=fixture();await f.add();f.setLost(true);await f.service.fulfill(f.order);const ref=f.db.collection(COLLECTION).doc(f.order.orderId),record=(await ref.get()).data();await ref.set({...record,lease:'another-instance',lease_until:Date.now()+60000});await f.service.fulfill(f.order,{retryNow:true});assert.equal(f.emails.length,0);await ref.set({...record,lease:'crashed',lease_until:Date.now()-1,next_retry_at:0});await f.service.fulfill(f.order);assert.equal(f.emails.length,1);assert.equal(f.issues.size,1);
});
test('API cursor pagination is private, lists metadata only and supports persistent accounts',async()=>{
 const f=fixture();for(let i=0;i<27;i++)await f.add({...f.order,orderId:'tp-page-'+String(i).padStart(3,'0')});const first=await f.call('/api/solattime/orders');assert.equal(first.orders.length,25);assert.ok(first.next_cursor);assert.ok(first.orders.every(x=>!('serial'in x)));const second=await f.call('/api/solattime/orders',{cursor:first.next_cursor});assert.equal(second.orders.length,2);assert.equal(second.next_cursor,null);const admin=await f.call('/api/solattime/admin/orders');assert.equal(admin.orders.length,25);assert.ok('account_uid'in admin.orders[0]);assert.equal((await f.call('/api/solattime/orders',{cursor:'bad/cursor'})).status,400);
});
test('missing payment callback is recovered only after provider verification',async()=>{
 const f=fixture();await f.add({...f.order,status:'pending',paymentVerifiedAt:''});const response=await f.call('/api/solattime/order',{order_id:f.order.orderId});assert.equal(response.order.status,'paid');assert.ok(response.order.serial);assert.ok(f.verifyCount>=2);
});
test('summary persistence failure never replaces the already-issued serial or resends a completed email',async()=>{
 const f=fixture();await f.add();f.setPersistFails(true);await assert.rejects(()=>f.service.fulfill(f.order));f.setPersistFails(false);await f.service.fulfill(f.order);assert.equal(f.emails.length,1);assert.equal(f.issues.size,1);const response=await f.call('/api/solattime/order',{order_id:f.order.orderId});assert.ok(response.order.serial);
});
test('actual shared checkout resolver uses server SolatTime price/account and disables generic subscription issuance',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../deploy-server.js'),'utf8');
 const fn=source.slice(source.indexOf('async function azResolveTrustedPremiumProduct('),source.indexOf('\nfunction azRequestHasCommissionSecret'));
 let buyer={uid:'verified-buyer',email:'real@example.com'},catalog={productId:'actual-catalog-sku',name:'AZOBSS SolatTime',type:'premium',status:'active',price:'RM30',softwarePackages:{enabled:true,fulfilment:'download'}};
 const sandbox={getPremiumUser:()=>({uid:'forged'}),azProductIdFromAny:p=>p.productId,azFindFirestoreProduct:async()=>catalog,azFindLocalSoftwareProduct:()=>null,azIsSolatTimeProduct:isProduct,azProductIsPremium:()=>true,mailReady:()=>true,solatTimeCommerce:{prepareCheckout:async()=>{if(!buyer)throw Error('Sign in');return buyer;}},parseAmountToSen:v=>Math.round(Number(v.replace('RM',''))*100),cleanPremiumUrl:v=>v||'',azSafeR2ObjectKey:v=>v||'',SOLATTIME_INSTALLER_URL:'https://files.azobss.com/test.exe'};
 vm.runInNewContext(fn+';globalThis.resolve=azResolveTrustedPremiumProduct',sandbox);
 const result=await sandbox.resolve({product:{productId:'actual-catalog-sku',price:'RM0.01'},user:{uid:'forged'},subscriptionPlan:{durationDays:1}},{});
 assert.equal(result.amountSen,3000);assert.equal(result.account.uid,'verified-buyer');assert.equal(result.product.licenseProduct,'solattime');assert.equal(result.product.softwarePackages,null);assert.equal(result.subscriptionCodeEnabled,false);assert.equal(result.isAdminTestPurchase,false);
 buyer=null;await assert.rejects(()=>sandbox.resolve({product:{productId:'actual-catalog-sku'}},{}));catalog={...catalog,status:'draft'};await assert.rejects(()=>sandbox.resolve({product:{productId:'actual-catalog-sku'}},{}));
});
test('durable pending queue resumes after failure, respects backoff and does not resend completed keys',async()=>{
 const f=fixture();await f.add();f.setEmailFails(true);await f.service.fulfill(f.order);f.setEmailFails(false);await f.service.drainPending();assert.equal(f.emails.length,0);const ref=f.db.collection(COLLECTION).doc(f.order.orderId),record=(await ref.get()).data();await ref.set({...record,next_retry_at:0});await f.service.drainPending();await f.service.drainPending();await f.service.drainPending();assert.equal(f.emails.length,1);assert.equal(f.issues.size,1);assert.equal((await ref.get()).data().state,'complete');
});
