'use strict';
const crypto=require('node:crypto');
const ORIGIN='https://solattime-license.zedan9107.workers.dev';
const DOWNLOAD='https://files.azobss.com/solattime/releases/1.0.36/Azobss_SolatTime_Setup.exe';
const COLLECTION='solattimePurchaseFulfillment';
const SERIAL=/^AZST-(?:[A-Z2-7]{5}-){5}[A-Z2-7]{5}$/;
const ORDER=/^[-A-Za-z0-9_]{1,160}$/;
const error=(status,message)=>Object.assign(new Error(message),{statusCode:status});
function isProduct(product={}){
 const name=String(product.name||product.productName||'').trim().toLowerCase();
 return String(product.licenseProduct||'').toLowerCase()==='solattime'||['SOLATTIME','AZOBSS-SOLATTIME'].includes(String(product.productId||product.id||'').toUpperCase())||name==='azobss solattime';
}
function isOrder(order={}){return order.product?.licenseProduct==='solattime'&&order.product?.fulfilment==='solattime';}
const uidOf=order=>String(order.user?.uid||'');
function orderFields(product,user){return product?.licenseProduct==='solattime'&&product?.fulfilment==='solattime'?{solattimeOrder:true,solattimeAccountUid:String(user?.uid||''),...(product.solattimeQuantity!==undefined?{solattimeQuantity:product.solattimeQuantity}:{})}:{};}
function quantityOf(order){const n=order.solattimeQuantity??order.product?.solattimeQuantity??1;if(!Number.isInteger(n)||n<1||n>100)throw error(409,'Bilangan lesen SolatTime tidak sah.');return n;}
function purchaseContext(order){const n=quantityOf(order);return JSON.stringify(n===1?['solattime-purchase-v1',order.orderId,uidOf(order),Number(order.amountSen)]:['solattime-purchase-v2',order.orderId,uidOf(order),Number(order.amountSen),n]);}
function purchaseKey(order,index){return quantityOf(order)===1?order.orderId:'stp-'+crypto.createHash('sha256').update(order.orderId).digest('hex')+'-pc-'+(index+1);}
const licensesOf=value=>Array.isArray(value.licenses)?value.licenses:[{serial:value.serial,license_id:value.license_id}];
const verified=order=>order.status==='paid'&&!!(order.paymentVerifiedAt||order.toyyibVerifiedAt||order.stripeVerifiedAt);
function paymentMatches(order,method,value){
 if(value?.paid!==true||!Number.isInteger(order.amountSen)||order.amountSen<1)return false;
 if(method==='stripe'){const s=value.session||{};return s.id===(order.stripeCheckoutSessionId||order.stripeSessionId)&&s.client_reference_id===order.orderId&&s.metadata?.orderId===order.orderId&&s.currency==='myr'&&s.amount_total===order.amountSen;}
 if(method==='toyyibpay'){const tx=value.tx||{},amount=String(tx.billpaymentAmount??'');return /^\d+(?:\.\d{1,2})?$/.test(amount)&&Math.round(Number(amount)*100)>=order.amountSen&&tx.billExternalReferenceNo===order.orderId&&(!tx.billCode||tx.billCode===order.billCode);}
 return false;
}
function codec(secret){
 secret=String(secret||'').trim();
 if(!/^[a-fA-F0-9]{64}$/.test(String(secret||'')))throw error(503,'Simpanan serial SolatTime belum dikonfigurasi.');
 const key=Buffer.from(secret,'hex');
 return {
  encrypt(value,context){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(context));const out=Buffer.concat([c.update(JSON.stringify(value),'utf8'),c.final()]);return ['v1',iv.toString('base64url'),c.getAuthTag().toString('base64url'),out.toString('base64url')].join('.');},
  decrypt(value,context){const [v,iv,tag,raw,...extra]=String(value||'').split('.');if(v!=='v1'||!iv||!tag||!raw||extra.length)throw Error('Invalid cipher');const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));d.setAAD(Buffer.from(context));d.setAuthTag(Buffer.from(tag,'base64url'));const result=JSON.parse(Buffer.concat([d.update(Buffer.from(raw,'base64url')),d.final()]).toString('utf8'));const items=licensesOf(result);if(!items.length||items.length>100||items.some(x=>!SERIAL.test(x.serial||'')||!/^[-a-f0-9]{36}$/.test(x.license_id||''))||new Set(items.map(x=>x.serial)).size!==items.length||new Set(items.map(x=>x.license_id)).size!==items.length||result.serial!==items[0].serial||result.license_id!==items[0].license_id)throw Error('Invalid serial');return result;}
 };
}
function createSolatTimeCommerce({getDb,getIdentity,getAdminIdentity,findOrder,persistSummary,verifyPayment,sendEmail,send,readBody,rateLimit,env=process.env,fetchImpl=globalThis.fetch,now=Date.now}){
 let readyUntil=0,draining=false,queueCursor='';
 const getCodec=()=>codec(env.SOLATTIME_ORDER_CIPHER_KEY);
 const db=()=>{const value=getDb();if(!value)throw error(503,'Pangkalan data SolatTime belum tersedia.');return value;};
 async function worker(action,body={}){
  const token=String(env.SOLATTIME_ADMIN_TOKEN||'').trim();if(token.length<32||token.length>400)throw error(503,'Sambungan lesen SolatTime belum dikonfigurasi.');
  const r=await fetchImpl(ORIGIN+'/admin/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(25000)});
  const value=await r.json();if(!r.ok||value.ok!==true)throw error(503,'Servis lesen SolatTime belum tersedia. Cuba semula kemudian.');return value;
 }
 async function readiness(){
  getCodec();db();
  if(now()>readyUntil){const r=await worker('commerce-ready');if(r.commerce_protocol!==1)throw error(503,'Servis pembelian SolatTime perlu dikemas kini.');readyUntil=now()+30000;}
 }
 async function account(req){const identity=await getIdentity(req);if(!identity?.uid)throw error(401,'Sila log masuk ke akaun AZOBSS.');if(identity.emailVerified!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email||'')||identity.email.endsWith('.local'))throw error(403,'Sahkan alamat e-mel akaun sebelum membeli SolatTime.');return identity;}
 async function prepareCheckout(req){const identity=await account(req);await readiness();return identity;}
 const context=purchaseContext;
 function view(order,record={},admin=false){
  const result={order_id:order.orderId,customer:String(order.user?.username||order.email||''),email:String(order.email||order.user?.email||''),phone:String(order.user?.phone||''),status:String(order.status||'pending'),amount_cents:Number(order.amountSen)||0,created_at:String(order.createdAt||''),paid_at:String(order.paidAt||''),payment_method:String(order.paymentMethod||''),fulfillment_state:record.state||(order.status==='paid'?'review':'awaiting_payment'),email_status:record.email_status||'queued',license_id:record.license_id||'',invoice_no:order.invoiceNo||'',receipt_no:order.receiptNo||''};
  result.quantity=quantityOf(order);result.license_ids=record.license_ids||(record.license_id?[record.license_id]:[]);
  if(admin){result.account_uid=uidOf(order);result.payment_reference=String(order.paymentReference||'');result.payment_verified_at=String(order.paymentVerifiedAt||order.toyyibVerifiedAt||order.stripeVerifiedAt||'');result.email_sent_at=record.email_sent_at||'';result.error=record.state==='review'?'Penghantaran belum selesai. Cuba semula selepas semakan servis.':'';}
  return result;
 }
 async function recordFor(order){const snap=await db().collection(COLLECTION).doc(order.orderId).get();return snap.exists?snap.data():{};}
 async function fulfill(order,options={}){
  if(!isOrder(order)||!verified(order))return order;
  if(!ORDER.test(order.orderId)||!uidOf(order)||!Number.isInteger(order.amountSen)||order.amountSen<1)throw error(409,'Pesanan SolatTime tidak sah.');
  const crypt=getCodec(),store=db(),ref=store.collection(COLLECTION).doc(order.orderId),lease=crypto.randomUUID(),aad=context(order),stamp=now();
  // Verify against the payment provider before every retry. Browser success URLs,
  // client prices and a plain status="paid" never authorize issuance.
  if(!await verifyPayment(order))throw error(409,'Pembayaran SolatTime belum disahkan oleh penyedia bayaran.');
  const claim=await store.runTransaction(async tx=>{
   const snap=await tx.get(ref);let record=snap.exists?snap.data():null;
   if(record&&record.context!==aad)throw error(409,'Butiran pesanan tidak sepadan.');
   if(record?.state==='complete'&&!options.forceEmail)return null;
   if(Number(record?.lease_until)>stamp)return null;
   if(Number(record?.next_retry_at)>stamp&&!options.forceEmail&&!options.retryNow)return null;
   if(!record){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',licenses=Array.from({length:quantityOf(order)},()=>({serial:'AZST-'+Array.from(crypto.randomBytes(30),x=>alphabet[x&31]).join('').match(/.{5}/g).join('-'),license_id:crypto.randomUUID()}));const issued={...licenses[0],...(licenses.length>1?{licenses}:{})};record={context:aad,cipher:crypt.encrypt(issued,aad),license_id:issued.license_id,license_ids:licenses.map(x=>x.license_id),purchase_keys:licenses.map((x,i)=>purchaseKey(order,i)),customer:String(order.user?.username||order.email).slice(0,120),state:'prepared',email_status:'queued'};}
   // Detect wrong keys before issuing anything; never replace an unreadable serial.
   if(licensesOf(crypt.decrypt(record.cipher,aad)).length!==quantityOf(order))throw error(409,'Bilangan lesen pesanan tidak sepadan.');
   record={...record,attempts:Number(record.attempts||0)+1,lease,lease_until:stamp+120000,updated_at:new Date(stamp).toISOString()};tx.set(ref,record);return record;
  });
  if(!claim){const existing=await recordFor(order);if(existing.state==='complete')await persistSummary({...order,solattimeFulfillmentState:'complete',email_status:'accepted',emailSentAt:existing.email_sent_at,solattimeLicenseId:existing.license_id});return await findOrder(order.orderId)||order;}
  async function save(patch){return store.runTransaction(async tx=>{const snap=await tx.get(ref),record=snap.data();if(record?.lease!==lease)throw error(409,'Pesanan sedang diproses.');const updated={...record,lease_until:now()+120000,...patch,updated_at:new Date(now()).toISOString()};tx.set(ref,updated);return updated;});}
  try{
   const issued=crypt.decrypt(claim.cipher,aad);
   if(!claim.issued_at){const items=licensesOf(issued),done=new Set(claim.issued_ids||[]);for(let i=0;i<items.length;i++){const item=items[i];if(done.has(item.license_id))continue;const customer=items.length>1?claim.customer.slice(0,100)+' ('+(i+1)+'/'+items.length+')':claim.customer;const result=await worker('issue-order',{order_id:purchaseKey(order,i),customer,...item});if(result.license_id!==item.license_id)throw Error('Issue mismatch');done.add(item.license_id);await save({issued_ids:[...done]});}await save({issued_at:new Date(now()).toISOString(),state:'issued'});}
   // Persist the exact encrypted serial before sending email; failures can safely retry.
   await sendEmail(order,issued);
   await save({state:'complete',email_status:'accepted',email_sent_at:new Date(now()).toISOString(),next_retry_at:0,lease_until:0,lease:''});
  }catch(e){await save({state:'review',email_status:'review',next_retry_at:now()+Math.min(3600000,30000*2**Math.min(claim.attempts-1,7)),lease_until:0,lease:''});}
  const saved=await recordFor(order);
  await persistSummary({...order,solattimeFulfillmentState:saved.state,email_status:saved.email_status,...(saved.email_sent_at?{emailSentAt:saved.email_sent_at}:{}),solattimeLicenseId:saved.issued_at?saved.license_id:''});
  return await findOrder(order.orderId)||order;
 }
 async function drainPending(){
  if(draining||!env.SOLATTIME_ORDER_CIPHER_KEY||!env.SOLATTIME_ADMIN_TOKEN||!getDb())return;
  draining=true;
  try{
   let query=db().collection(COLLECTION).where('state','in',['prepared','issued','review']).orderBy('__name__').limit(10);
   if(queueCursor)query=query.startAfter(queueCursor);
   const snap=await query.get();if(!snap.docs.length){queueCursor='';return;}
   for(const doc of snap.docs){queueCursor=doc.id;const row=doc.data();if(Number(row.lease_until)>now()||Number(row.next_retry_at)>now())continue;const order=await findOrder(doc.id);if(order&&isOrder(order)&&verified(order)){try{await fulfill(order);}catch{/* Durable state remains queued; no raw provider errors or keys are logged. */}}}
  }finally{draining=false;}
 }
 async function loadOwned(req,id,admin=false){
  if(!ORDER.test(id||''))throw error(404,'Pesanan tidak ditemui.');
  const identity=admin?await getAdminIdentity(req):await account(req);
  if(!identity?.uid||(admin&&identity.isAdmin!==true))throw error(identity?.uid?403:401,'Akses tidak dibenarkan.');
  let order=await findOrder(id);
  if(!order||!isOrder(order)||(!admin&&uidOf(order)!==identity.uid))throw error(404,'Pesanan tidak ditemui.');
  return order;
 }
 async function list(req,cursor,admin){
  const identity=admin?await getAdminIdentity(req):await account(req);
  if(!identity?.uid||(admin&&identity.isAdmin!==true))throw error(identity?.uid?403:401,'Akses tidak dibenarkan.');
  if(cursor&&!ORDER.test(cursor))throw error(400,'Halaman tidak sah.');
  let query=db().collection('premiumOrders').where(admin?'solattimeOrder':'solattimeAccountUid','==',admin?true:identity.uid).orderBy('__name__').limit(26);
  if(cursor)query=query.startAfter(cursor);
  const snap=await query.get(),docs=snap.docs,rows=docs.slice(0,25),orders=[];
  for(const doc of rows){const order={...doc.data(),orderId:doc.id};if(!isOrder(order)||(!admin&&uidOf(order)!==identity.uid))continue;orders.push(view(order,await recordFor(order),admin));}
  return {ok:true,orders,next_cursor:docs.length>25?rows[rows.length-1].id:null};
 }
 const routes=new Set(['/api/solattime/orders','/api/solattime/order','/api/solattime/admin/orders','/api/solattime/admin/order','/api/solattime/admin/retry-email']);
 async function handle(req,res,parsed){
  if(!routes.has(parsed.pathname))return false;
  const reply=(status,value)=>send(res,status,JSON.stringify(value),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  const admin=parsed.pathname.includes('/admin/'),retry=parsed.pathname.endsWith('/retry-email');
  if(req.method!==(admin?'POST':'GET')){reply(405,{ok:false,error:'Kaedah permintaan tidak sah.'});return true;}
  if(rateLimit(req,res,'solattime-commerce-'+parsed.pathname,retry?5:40,60000))return true;
  try{
   let body=parsed.query||{};
   if(admin){const raw=await readBody(req);if(Buffer.byteLength(raw)>8192)throw error(413,'Permintaan terlalu besar.');try{body=JSON.parse(raw);}catch{throw error(400,'Permintaan tidak sah.');}if(!body||typeof body!=='object'||Array.isArray(body))throw error(400,'Permintaan tidak sah.');}
   if(parsed.pathname.endsWith('/orders')){reply(200,await list(req,body.cursor||'',admin));return true;}
   let order=await loadOwned(req,body.order_id,admin);
   const record=await recordFor(order);
   if(retry||record.state!=='complete'){
    // Status can recover a webhook lost before finalization, using the existing
    // provider verifier/finalizer injected by the server, never browser claims.
    const alreadyVerified=verified(order);
    if(!alreadyVerified)order=await verifyPayment(order,{finalize:true,req})||order;
    if(verified(order))order=await fulfill(order,{forceEmail:retry&&alreadyVerified});
   }
   const latest=await recordFor(order),result=view(order,latest,admin);
   if(latest.issued_at&&verified(order)){const value=getCodec().decrypt(latest.cipher,context(order));result.serial=value.serial;result.serials=licensesOf(value);}
   if(retry&&latest.email_status!=='accepted')throw error(503,'E-mel belum berjaya dihantar. Cuba semula kemudian.');
   reply(200,{ok:true,order:result,download_url:DOWNLOAD});
  }catch(e){reply(Number(e.statusCode)||503,{ok:false,error:e.statusCode?e.message:'Servis pembelian SolatTime belum tersedia. Cuba semula kemudian.'});}
  return true;
 }
 return {prepareCheckout,fulfill,handle,drainPending};
}
module.exports={createSolatTimeCommerce,codec,isProduct,isOrder,orderFields,paymentMatches,quantityOf,purchaseContext,purchaseKey,licensesOf,DOWNLOAD,COLLECTION};
