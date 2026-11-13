'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createPcShopRuntime}=require('../lib/azobss-pc-shop-runtime');
const {adminRequestPatch,customerDecisionPatch}=require('../lib/azobss-pc-requests-v1530');
function fixture(){
 const deliveryProvider=arguments[0];
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'azobss-requests-1530-')),saved=new Map(),fetches=[];let chain=Promise.resolve();
 const write=(n,v)=>{const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v));};
 write('PC-Build/pc-shop-products-v1487.json',{products:[{id:'fixture-hardware',type:'hardware',name:'Trusted Fixture RAM',category:'RAM',snapshotPrice:100,snapshotPriceClear:true,snapshotCheckedAt:new Date().toISOString(),sourceVerified:true,specVerified:true,mediaVerified:true,specs:['DDR5 16GB'],sourceName:'Fixture Supplier'}]});
 write('PC-Build/pc-build-data.json',{builds:[]});write('PC-Build/catalog/v1496/sources.json',{sources:[]});
 write('Upgrade-Parts/catalog-v1518.json',{date:new Date().toISOString().slice(0,10),products:[]});
 const clone=x=>x===undefined?undefined:structuredClone(x);
 const collection=name=>({filters:[],doc(id){return {key:name+'/'+id,async get(){const x=saved.get(this.key);return {exists:x!==undefined,data:()=>clone(x)};},async set(v,o={}){saved.set(this.key,o.merge?{...saved.get(this.key),...clone(v)}:clone(v));},async delete(){saved.delete(this.key);}};},where(k,_op,v){this.filters.push([k,v]);return this;},orderBy(){return this;},limit(){return this;},async get(){return {forEach:fn=>{for(const [key,value] of saved)if(key.startsWith(name+'/')&&this.filters.every(([k,v])=>value[k]===v))fn({id:key.split('/')[1],data:()=>clone(value)});}};}});
 const db={collection,runTransaction(fn){const work=chain.then(async()=>{const writes=[];const value=await fn({get:r=>r.get(),set:(r,v,o)=>writes.push([r,v,o])});for(const [r,v,o] of writes)await r.set(v,o);return value;});chain=work.catch(()=>{});return work;}};
 const runtime=createPcShopRuntime({rootDir:dir,deliveryProvider,getDb:()=>db,getUserIdentity:async req=>Object.hasOwn(req,'identity')?req.identity:{uid:'customer-1',username:'Fixture Customer',email:'fixture@example.invalid'},getAdminIdentity:async req=>req.admin?{isAdmin:true}:null,readBody:async req=>req.body,send:(res,status,body)=>Object.assign(res,{status,body:JSON.parse(body)}),pcBuildFetch:async url=>{fetches.push(url);throw Error('Supplier network not permitted in fixture');}});
 const call=async(method,pathname,body={},extra={})=>{const res={};await runtime.handle({method,body,...extra},res,{pathname});return res;};
 const create=(extra={})=>call('POST','/api/pc-shop/orders',{items:[{productId:'fixture-hardware',qty:2}],shippingMethod:'Pickup at AZOBSS',customerName:'Fixture Customer',customerPhone:'0100000000',...extra});
 const patch=(id,body)=>call('PATCH','/api/admin/pc-shop/orders/'+id,body,{admin:true});
 const decision=(id,body,extra={})=>call('POST','/api/pc-shop/orders/'+id+'/decision',body,extra);
 const row=id=>clone(saved.get('pcShopOrders/'+id));
 const publish=id=>patch(id,{publishQuote:true,stockConfirmed:true,shippingConfirmed:true,confirmedItemTotal:300,shippingCharge:0});
 return {saved,fetches,call,create,patch,decision,row,publish,close(){assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(dir).startsWith('azobss-requests-1530-'));fs.rmSync(dir,{recursive:true,force:true});}};
}
test('even a forged checkout is saved as an unpaid request with trusted models, quantities and no supplier network call',async()=>{
 const f=fixture();try{const r=await f.create({intent:'checkout',stockConfirmed:true,priceConfirmed:true,customerApproval:'accepted',paymentStatus:'paid',invoiceNo:'FAKE',items:[{productId:'fixture-hardware',qty:2,name:'FORGED',unitPrice:1,unitCost:1}]});assert.equal(r.status,201);const o=r.body.order;assert.equal(o.intent,'quote');assert.equal(o.requestOnly,true);assert.equal(o.status,'quote-requested');assert.equal(o.invoiceNo,'');assert.equal(o.paymentStatus,'not-ready');assert.equal(o.stockConfirmed,false);assert.equal(o.priceConfirmed,false);assert.equal(o.items[0].name,'Trusted Fixture RAM');assert.equal(o.items[0].qty,2);assert.ok(o.referenceSubtotal>2);assert.equal(o.items[0].unitCost,undefined);assert.deepEqual(o.items[0].specs,['DDR5 16GB']);assert.equal([...f.saved.keys()].filter(k=>k.startsWith('purchaseLogs/')).length,0);assert.deepEqual(f.fetches,[]);}finally{f.close();}
});
test('login, known model and item-count validation protect the saved request',async()=>{
 const f=fixture();try{assert.equal((await f.call('POST','/api/pc-shop/orders',{}, {identity:null})).status,401);assert.equal((await f.create({items:[{productId:'FORGED'}]})).status,400);assert.equal((await f.create({items:Array.from({length:25},()=>({productId:'fixture-hardware'}))})).status,400);assert.equal([...f.saved.keys()].filter(k=>k.startsWith('pcShopOrders/')).length,0);}finally{f.close();}
});
test('repeat submission reuses a saved request and never creates a purchase log',async()=>{
 const f=fixture();try{const first=await f.create(),second=await f.create();assert.equal(second.status,200);assert.equal(second.body.duplicate,true);assert.equal(first.body.order.orderId,second.body.order.orderId);assert.equal([...f.saved.keys()].filter(k=>k.startsWith('pcShopOrders/')).length,1);}finally{f.close();}
});
test('an already invoiced request does not swallow a deliberate new request for the same items',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});await f.patch(id,{issueInvoice:true,stockConfirmed:true});const next=await f.create();assert.equal(next.status,201);assert.notEqual(next.body.order.orderId,id);assert.equal(next.body.order.invoiceNo,'');assert.equal(next.body.order.status,'quote-requested');}finally{f.close();}
});
test('catalogue refresh retains selected models and quantities even if supplier data is missing or unavailable',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-pc-shop-v1487.js'),'utf8');let list=[{productId:'missing',name:'Saved model',qty:3,unitPrice:200},{productId:'out-of-stock',name:'Saved other model',qty:2,unitPrice:150}];
 const context={catalog:[{id:'out-of-stock',name:'Saved other model',price:0,availability:'unavailable'}],externalBuilds:new Map(),readCart:()=>list,saveCart:x=>{list=x;}};
 vm.runInNewContext(source.split('\n').filter(l=>/^function (syncCartPrices|normalizedItem)\(/.test(l)).join('\n'),context);assert.equal(context.syncCartPrices(true),0);assert.equal(list.length,2);assert.equal(list[0].qty,3);assert.equal(list[1].qty,2);assert.equal(list[0].requiresConfirmation,true);assert.equal(list[1].unitPrice,150);
});
test('verified manual delivery is priced server-side before quote and carried through receipt',async()=>{
 const f=fixture();try{
  const c=await f.create({shippingMethod:'Courier',customerAddress:'Fixture address',deliveryPin:{latitude:3,longitude:101},shippingCharge:1});
  const id=c.body.order.orderId;
  assert.equal(c.body.order.delivery.charge,null);
  assert.equal((await f.patch(id,{publishQuote:true,confirmedItemTotal:300})).body.error,'supplier_stock_required');
  assert.equal((await f.publish(id)).body.error,'shipping_quote_expired');
  const route='/api/admin/pc-shop/shipping-quotes/'+id;
  const input={source:'manual',vehicle:'car',confirmed:true,itemTotal:300,cost:30,roadKm:8,measured:{kg:2,length:25,width:20,height:10}};
  assert.equal((await f.call('POST',route,input)).status,403);
  const q=await f.call('POST',route,input,{admin:true});
  assert.equal(q.status,200);
  const rate=f.row(id).deliveryRate;
  f.saved.set('pcShopOrders/'+id,{...f.row(id),deliveryRate:{...rate,expiresAtMs:1}});
  assert.equal((await f.publish(id)).body.error,'shipping_quote_expired');
  f.saved.set('pcShopOrders/'+id,{...f.row(id),deliveryRate:rate});
  assert.equal((await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:301})).body.error,'shipping_quote_changed');
  const published=await f.publish(id);
  assert.equal(published.status,200);
  assert.equal(published.body.order.shippingCharge,30);
  assert.equal(published.body.order.delivery.cost,undefined);
  assert.equal(published.body.order.delivery.measured,undefined);
  await f.decision(id,{action:'accept',quoteVersion:published.body.order.quoteVersion});
  const invoice=await f.patch(id,{issueInvoice:true,stockConfirmed:true});
  assert.equal(invoice.body.order.confirmedTotal,330);
  assert.equal((await f.patch(id,{paymentStatus:'paid'})).status,200);
  const receipt=await f.call('GET','/api/pc-shop/orders/'+id+'/documents/receipt');
  assert.equal(receipt.body.document.pdf.customerAddress,'Fixture address');
  assert.equal(receipt.body.document.total,330);
 }finally{f.close();}
});
test('pickup stays free and requires paid ready status before completion',async()=>{
 const f=fixture();try{
  const [a,b]=await Promise.all([f.create({customerAddress:'discard me'}),f.create()]);
  const id=a.body.order.orderId;
  assert.equal(b.body.order.orderId,id);
  assert.equal(f.row(id).customerAddress,'');
  assert.equal(a.body.order.delivery.pickupLocation.latitude,3.255498);
  const q=await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:25,shippingCharge:70});
  assert.equal(q.body.order.confirmedTotal,25);
  await f.decision(id,{action:'accept',quoteVersion:q.body.order.quoteVersion});
  await f.patch(id,{issueInvoice:true,stockConfirmed:true});
  assert.equal((await f.patch(id,{fulfillmentStatus:'ready-for-pickup'})).body.error,'payment_required');
  await f.patch(id,{paymentStatus:'paid'});
  assert.equal((await f.patch(id,{fulfillmentStatus:'completed'})).body.error,'pickup_not_ready');
  assert.equal((await f.patch(id,{fulfillmentStatus:'ready-for-pickup'})).body.order.status,'ready-for-pickup');
  assert.equal((await f.patch(id,{fulfillmentStatus:'completed'})).body.order.status,'completed');
 }finally{f.close();}
});
test('delivery rejects incomplete addresses and invalid coordinates and protects admin configuration',async()=>{
 const f=fixture();try{
  assert.equal((await f.create({shippingMethod:'Courier',customerAddress:'abc'})).status,400);
  assert.equal((await f.create({shippingMethod:'Courier',customerAddress:'Fixture address',deliveryPin:{latitude:91,longitude:101}})).status,400);
  const url='/api/admin/pc-shop/shipping-settings';
  const settings={location:{address:'Tingkat 1, Fixture premises'},pickup:false};
  assert.equal((await f.call('PUT',url,{settings})).status,403);
  assert.equal((await f.call('PUT',url,{settings},{admin:true})).status,200);
  assert.equal((await f.call('GET',url,{}, {admin:true})).body.settings.pickup,false);
  assert.equal((await f.create()).status,409);
  const view=(await f.call('GET','/api/pc-shop/shipping-settings')).body;
  assert.equal(view.location.name,'AZOBSS');
  assert.equal(view.vehicles,undefined);
  assert.equal(view.marginShare,undefined);
 }finally{f.close();}
});
test('carrier booking is explicitly approved, requires payment and has a single dispatch',async()=>{
 let dispatches=0;
 const provider={booking:true,lalamove:'production',maps:false,roadKm:async()=>7,
  quotation:async()=>({id:'provider-quote',cost:30,expiresAtMs:Date.now()+60000,km:7,source:'lalamove',stopIds:['stop-a','stop-b']}),
  book:async()=>{dispatches++;return {id:'carrier-01',status:'ASSIGNING_DRIVER',link:''};}};
 const f=fixture(provider);try{
  await f.call('PUT','/api/admin/pc-shop/shipping-settings',{settings:{location:{address:'Tingkat 1, Fixture premises'}}},{admin:true});
  const id=(await f.create({shippingMethod:'Courier',customerAddress:'Fixture address',deliveryPin:{latitude:3,longitude:101}})).body.order.orderId;
  const url='/api/admin/pc-shop/shipping-bookings/'+id;
  assert.equal((await f.call('POST',url,{approved:true},{admin:true})).body.error,'carrier_payment_required');
  const q=await f.call('POST','/api/admin/pc-shop/shipping-quotes/'+id,{source:'lalamove',itemTotal:300,measured:{kg:2,length:10,width:10,height:10}},{admin:true});
  assert.equal(q.status,200);
  const o=(await f.publish(id)).body.order;
  await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});
  await f.patch(id,{issueInvoice:true,stockConfirmed:true});
  await f.patch(id,{paymentStatus:'paid'});
  assert.equal((await f.call('POST',url,{},{admin:true})).body.error,'carrier_approval_required');
  await Promise.all([f.call('POST',url,{approved:true},{admin:true}),f.call('POST',url,{approved:true},{admin:true})]);
  assert.equal(dispatches,1);
  assert.equal((await f.call('POST',url,{approved:true},{admin:true})).body.booking.id,'carrier-01');
  assert.equal(dispatches,1);
 }finally{f.close();}
});
test('only the owning customer can approve the current quote and approval does not issue an invoice',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId;assert.equal((await f.decision(id,{action:'accept',quoteVersion:0})).body.error,'quote_not_ready');const o=(await f.publish(id)).body.order;assert.equal((await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion},{identity:{uid:'other'}})).status,404);assert.equal((await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion-1})).body.error,'quote_changed');assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true,customerApproval:'accepted'})).body.error,'customer_approval_required');const accepted=await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion,confirmedTotal:1});assert.equal(accepted.status,200);assert.equal(accepted.body.order.status,'quote-accepted');assert.equal(accepted.body.order.confirmedTotal,300);assert.equal(accepted.body.order.invoiceNo,'');assert.equal(accepted.body.order.paymentStatus,'not-ready');assert.equal((await f.call('GET','/api/pc-shop/orders',{}, {identity:{uid:'other'}})).body.orders.length,0);}finally{f.close();}
});
test('invoice requires customer approval and a fresh explicit admin stock check; payment and receipt follow the invoice',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;assert.equal((await f.patch(id,{paymentStatus:'paid'})).body.error,'invoice_not_ready');await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});assert.equal((await f.patch(id,{issueInvoice:true})).body.error,'supplier_stock_required');const invoice=await f.patch(id,{issueInvoice:true,stockConfirmed:true});assert.equal(invoice.status,200);assert.match(invoice.body.order.invoiceNo,/^AZI-/);assert.equal(invoice.body.order.paymentStatus,'pending');assert.equal(invoice.body.order.confirmedTotal,300);assert.ok(f.saved.has('purchaseLogs/pcshop-'+id));const paid=await f.patch(id,{paymentStatus:'paid'});assert.equal(paid.status,200);assert.equal(paid.body.order.status,'payment-received');assert.match(paid.body.order.receiptNo,/^AZR-/);assert.equal((await f.decision(id,{action:'cancel'})).body.error,'request_closed');assert.equal((await f.patch(id,{confirmedItemTotal:1})).body.error,'invoice_locked');}finally{f.close();}
});
test('changing the quote total invalidates approval and stale decisions cannot approve the new amount',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});const changed=await f.patch(id,{confirmedItemTotal:350});assert.equal(changed.body.order.customerApproval,'pending');assert.equal(changed.body.order.priceConfirmed,false);assert.equal(changed.body.order.status,'quote-requested');assert.equal((await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion})).body.error,'quote_changed');assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.error,'customer_approval_required');}finally{f.close();}
});
test('expired or cancelled quotes cannot become payable and invalid amounts cannot alter the stored request',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});const row=f.row(id),later=row.quoteExpiresAtMs+1;assert.throws(()=>adminRequestPatch(row,{issueInvoice:true,stockConfirmed:true},later),e=>e.code==='quote_expired');assert.throws(()=>customerDecisionPatch({...row,status:'quote-ready'},row.uid,{action:'accept',quoteVersion:row.quoteVersion},later),e=>e.code==='quote_expired');assert.equal((await f.patch(id,{confirmedItemTotal:-1})).body.error,'invalid_amount');assert.equal(f.row(id).confirmedTotal,300);await f.decision(id,{action:'cancel'});assert.equal((await f.publish(id)).body.error,'request_closed');}finally{f.close();}
});
test('concurrent customer approval and admin price change cannot leave approval attached to the wrong quote',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;await Promise.all([f.decision(id,{action:'accept',quoteVersion:o.quoteVersion}),f.patch(id,{confirmedItemTotal:400})]);const row=f.row(id);assert.equal(row.customerApproval,'pending');assert.ok(row.quoteVersion>o.quoteVersion);assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.error,'customer_approval_required');}finally{f.close();}
});
test('decline is saved without an invoice and admin cannot fulfil an unpaid request',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;const declined=await f.decision(id,{action:'decline',quoteVersion:o.quoteVersion});assert.equal(declined.body.order.status,'quote-declined');assert.equal(declined.body.order.invoiceNo,'');assert.equal((await f.patch(id,{fulfillmentStatus:'shipped'})).body.error,'payment_required');assert.equal((await f.call('PATCH','/api/admin/pc-shop/orders/'+id,{publishQuote:true})).status,403);}finally{f.close();}
});
test('an admin-cancelled approved request cannot be converted into a payable invoice',async()=>{
 const f=fixture();try{const id=(await f.create()).body.order.orderId,o=(await f.publish(id)).body.order;await f.decision(id,{action:'accept',quoteVersion:o.quoteVersion});assert.equal((await f.patch(id,{paymentStatus:'cancelled'})).status,200);assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.error,'request_closed');assert.equal(f.row(id).invoiceNo,'');}finally{f.close();}
});
test('historical paid orders keep their original invoice, receipt, total and workflow',async()=>{
 const f=fixture();try{const id='AZO-2025-000001';f.saved.set('pcShopOrders/'+id,{orderId:id,uid:'customer-1',intent:'checkout',status:'payment-received',paymentStatus:'paid',fulfillmentStatus:'order-received',priceConfirmed:true,shippingConfirmationRequired:false,shippingMethod:'Pickup at AZOBSS',confirmedItemTotal:120,confirmedTotal:120,referenceSubtotal:120,invoiceNo:'AZI-2025-000001',receiptNo:'AZR-2025-000001',items:[],createdAtMs:1});const r=await f.patch(id,{fulfillmentStatus:'packed'});assert.equal(r.status,200);assert.equal(r.body.order.requestOnly,false);assert.equal(r.body.order.invoiceNo,'AZI-2025-000001');assert.equal(r.body.order.receiptNo,'AZR-2025-000001');assert.equal(r.body.order.confirmedTotal,120);assert.equal(r.body.order.status,'packed');}finally{f.close();}
});
test('cart requests defer address and payment until an item quote, then require approval of the delivery total',async()=>{
 const f=fixture();try{
  const created=await f.create({deferDelivery:true,customerAddress:'must not be stored',customerPhone:''});
  const id=created.body.order.orderId;
  assert.equal(created.body.order.deliveryDetailsPending,true);
  assert.equal(f.row(id).customerAddress,'');
  assert.equal((await f.decision(id,{action:'delivery-details',quoteVersion:0,shippingMethod:'Courier'})).status,409);
  const quote=(await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:300,shippingCharge:90})).body.order;
  assert.equal(quote.confirmedTotal,300);
  assert.equal(quote.canPay,false);
  assert.equal((await f.decision(id,{action:'accept',quoteVersion:quote.quoteVersion})).body.error,'delivery_details_required');
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.error,'delivery_details_required');
  const delivery={action:'delivery-details',quoteVersion:quote.quoteVersion,shippingMethod:'Courier',customerPhone:'0123456789',customerAddress:'12 Jalan Fixture, Batu Caves',deliveryPin:{latitude:3,longitude:101}};
  assert.equal((await f.decision(id,{...delivery,customerAddress:'short'})).status,400);
  assert.equal((await f.decision(id,delivery)).status,200);
  assert.equal((await f.decision(id,delivery)).status,200);
  assert.equal(f.row(id).priceConfirmed,false);
  assert.equal(f.row(id).shippingConfirmationRequired,true);
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).status,409);
  assert.equal((await f.call('POST','/api/admin/pc-shop/shipping-quotes/'+id,{source:'manual',vehicle:'car',confirmed:true,itemTotal:300,cost:30,roadKm:8,measured:{kg:2,length:25,width:20,height:10}},{admin:true})).status,200);
  const final=(await f.publish(id)).body.order;
  assert.equal(final.confirmedTotal,330);
  assert.equal((await f.decision(id,{action:'accept',quoteVersion:quote.quoteVersion})).status,409);
  assert.equal((await f.decision(id,{action:'accept',quoteVersion:final.quoteVersion})).status,200);
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.order.canPay,true);
 }finally{f.close();}
});
test('a customer can proceed from an item quote with free self pickup',async()=>{
 const f=fixture();try{
  const id=(await f.create({deferDelivery:true})).body.order.orderId;
  const quote=(await f.publish(id)).body.order;
  const details={action:'delivery-details',quoteVersion:quote.quoteVersion,shippingMethod:'Pickup at AZOBSS',customerPhone:'0123456789',pickupRequestedSlot:'2026-12-12T14:30'};
  assert.equal((await f.decision(id,{...details,pickupRequestedSlot:''})).status,400);
  const accepted=(await f.decision(id,details)).body.order;
  assert.equal(accepted.status,'quote-accepted');
  assert.equal(accepted.delivery.charge,0);
  assert.equal(accepted.delivery.pickupRequestedSlot,details.pickupRequestedSlot);
  assert.equal(accepted.canPay,false);
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.order.canPay,true);
 }finally{f.close();}
});
test('fixed car rate lets a customer see the quote, accept once and receive an invoice after the final stock check',async()=>{
 const f=fixture();
 try{
  const id=(await f.create({deferDelivery:true})).body.order.orderId;
  const first=await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:300,deliveryVehicle:'car',shippingCharge:1,expectedQuoteVersion:0});
  assert.equal(first.status,200,JSON.stringify(first.body));
  const quote=first.body.order;
  assert.deepEqual(quote.fixedDeliveryOffer,{vehicle:'car',charge:25});
  assert.equal(quote.canPay,false);
  const doc=await f.call('GET','/api/pc-shop/orders/'+id+'/documents/quote');
  assert.equal(doc.status,200);
  assert.match(doc.body.document.pdf.notes,/RM25\.00/);
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true})).body.error,'delivery_details_required');
  const details={action:'delivery-details',quoteVersion:quote.quoteVersion,shippingMethod:'Courier',customerPhone:'0123456789',customerAddress:'12 Jalan Fixture, Batu Caves'};
  assert.equal((await f.decision(id,{...details,acceptedTotal:301})).body.error,'delivery_total_changed');
  const accepted=(await f.decision(id,{...details,acceptedTotal:325})).body.order;
  assert.equal(accepted.status,'quote-accepted');
  assert.equal(accepted.confirmedTotal,325);
  assert.equal(accepted.shippingCharge,25);
  assert.equal(accepted.canPay,false);
  assert.equal((await f.decision(id,{...details,acceptedTotal:325})).status,200);
  assert.equal((await f.patch(id,{issueInvoice:true,stockConfirmed:true,expectedQuoteVersion:quote.quoteVersion-1})).body.error,'quote_changed');
  const invoice=await f.patch(id,{issueInvoice:true,stockConfirmed:true,shippingCharge:5,expectedQuoteVersion:quote.quoteVersion});
  assert.equal(invoice.status,200,JSON.stringify(invoice.body));
  assert.equal(invoice.body.order.confirmedTotal,325);
  assert.equal(invoice.body.order.canPay,true);
 }finally{f.close();}
});
test('fixed rates use server settings and block a motor when a known parcel needs a larger vehicle',async()=>{
 const f=fixture();
 try{
  const id=(await f.create({deferDelivery:true})).body.order.orderId;
  const sku=f.row(id).items[0].productId;
  f.saved.set('pcShopPackages/'+sku,{kg:5,length:45,width:30,height:10});
  assert.equal((await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:300,deliveryVehicle:'motorcycle'})).body.error,'packing_required');
  f.saved.set('settings/pcShopDelivery',{fixedDelivery:{motorcycle:999,car:32,van:72}});
  const van=(await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:300,deliveryVehicle:'van'})).body.order;
  assert.deepEqual(van.fixedDeliveryOffer,{vehicle:'van',charge:72});
  f.saved.delete('pcShopPackages/'+sku);
  const motor=(await f.patch(id,{publishQuote:true,stockConfirmed:true,confirmedItemTotal:300,deliveryVehicle:'motorcycle'})).body.order;
  assert.deepEqual(motor.fixedDeliveryOffer,{vehicle:'motorcycle',charge:10});
  const pickup=(await f.decision(id,{action:'delivery-details',quoteVersion:motor.quoteVersion,shippingMethod:'Pickup at AZOBSS',customerPhone:'0123456789',pickupRequestedSlot:'2026-12-12T14:30'})).body.order;
  assert.equal(pickup.confirmedTotal,300);
  assert.equal(pickup.delivery.charge,0);
 }finally{f.close();}
});
