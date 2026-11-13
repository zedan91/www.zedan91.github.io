'use strict';
const crypto=require('node:crypto');
const collectionFor=(db,uid)=>db.collection('pcShopUserNotifications/'+crypto.createHash('sha256').update(String(uid)).digest('hex')+'/items');
const validId=id=>typeof id==='string'&&/^[-a-zA-Z0-9_]{1,120}$/.test(id);
const {invoiceDeadline,receiptAvailable}=require('./azobss-pc-documents-v1541');
function noticeFromOrder(row,now=Date.now()){
 if(!row?.uid||!validId(row.orderId)||row.adminTrashed||['cancelled','refunded','quote-declined'].includes(row.status))return null;
 let kind,atMs,readAtMs=0;
 if(row.paymentStatus==='paid'&&(row.fulfillmentStatus==='ready-for-pickup'||row.trackingNumber&&['shipped','in-transit','delivered','completed'].includes(row.fulfillmentStatus))){kind='tracking';atMs=Number(row.updatedAtMs)||now;}
 else if(receiptAvailable(row)){kind='receipt';atMs=Number(row.paidAtMs)||Number(row.updatedAtMs)||now;}
 else if(row.invoiceNo&&row.paymentStatus==='pending'){kind='invoice';atMs=Number(row.invoiceRenewedAtMs)||Number(row.invoiceIssuedAtMs)||Number(row.updatedAtMs)||now;}
 else if(row.requestOnly&&row.quoteSentAtMs&&row.priceConfirmed&&['quote-ready','quote-accepted'].includes(row.status)){kind='quote';atMs=Number(row.quoteSentAtMs);readAtMs=Number(row.customerApprovedAtMs)||0;}
 else return null;
 const total=Math.max(0,Number(row.confirmedTotal)||0),expiresAtMs=kind==='quote'?Number(row.quoteExpiresAtMs)||0:kind==='invoice'?invoiceDeadline(row):0,expired=expiresAtMs>0&&expiresAtMs<=now;
 const titles={quote:expired?'Quote expired':'Final quote ready',invoice:expired?'Invoice expired':'Invoice ready',receipt:'Payment received',tracking:row.fulfillmentStatus==='ready-for-pickup'?'Ready for pickup':row.fulfillmentStatus==='delivered'||row.fulfillmentStatus==='completed'?'Order delivered':'Order shipped'};
 const actionLabel={quote:'View Quote',invoice:'View Invoice',receipt:'View Receipt',tracking:'Track Order'}[kind];
 const number=kind==='receipt'?row.receiptNo:kind==='invoice'?row.invoiceNo:row.quoteNo||row.orderId;
 const version=kind==='receipt'?'receipt:'+row.receiptNo:kind==='tracking'?'tracking:'+row.fulfillmentStatus+':'+(row.trackingNumber||''):kind+':'+Number(row.quoteVersion||0)+(kind==='invoice'&&row.invoiceVersion?':'+row.invoiceVersion:'');
 return {id:row.orderId,orderId:row.orderId,uid:String(row.uid),version,kind,active:true,atMs,readAtMs,expiresAtMs,title:titles[kind],actionLabel,body:String(number)+' · RM'+total.toFixed(2)+(kind==='receipt'?' · Payment verified':kind==='tracking'?' · '+String(row.courier||'Courier'):' · '+(kind==='quote'?'Review your quote':'Review your invoice')),href:'/PC-Build/?requests=1&order='+encodeURIComponent(row.orderId)+'&document='+(kind==='tracking'?'order':kind)};
}
function writeTransitionTx(db,tx,previous,next,action='admin',now=Date.now()){
 if(!next?.uid||!validId(next.orderId))return;
 const ref=collectionFor(db,next.uid).doc(next.orderId),notice=noticeFromOrder(next,now);
 const published=Number(next.quoteVersion)!==Number(previous.quoteVersion)&&next.status==='quote-ready';
 const issued=!previous.invoiceNo&&!!next.invoiceNo,renewed=!!next.invoiceNo&&Number(next.invoiceVersion)!==Number(previous.invoiceVersion);
 const paid=next.paymentStatus==='paid'&&(previous.paymentStatus!=='paid'||previous.receiptNo!==next.receiptNo);
 const tracked=notice?.kind==='tracking'&&(previous.fulfillmentStatus!==next.fulfillmentStatus||previous.trackingNumber!==next.trackingNumber||previous.courier!==next.courier);
 if(notice&&(published||issued||renewed||paid||tracked))tx.set(ref,{...notice,readAtMs:0});
 else if(action==='customer'&&notice)tx.set(ref,{...notice,readAtMs:now},{merge:true});
 else if(!notice&&(previous.quoteSentAtMs||previous.invoiceNo))tx.set(ref,{id:next.orderId,uid:String(next.uid),active:false,readAtMs:now,atMs:now,version:'closed:'+Number(next.quoteVersion||0)},{merge:true});
}
function createCustomerNotifications({getDb,getUserIdentity,parseBody,json,newestUserOrders,now=Date.now}){
 const legacyCache=new Map();
 const respond=(res,status,body)=>{json(res,status,body);return true;};
 async function legacy(db,uid){let hit=legacyCache.get(uid);if(hit&&hit.expires>now())return hit.rows;const snap=await newestUserOrders(db,uid,50),rows=[];snap.forEach(d=>{const n=noticeFromOrder(d.data(),now());if(n&&n.uid===uid&&(n.kind!=='quote'||n.expiresAtMs>now()))rows.push(n);});if(legacyCache.size>=128)legacyCache.delete(legacyCache.keys().next().value);legacyCache.set(uid,{rows,expires:now()+300000});return rows;}
 async function handle(req,res,parsed){const route=parsed.pathname;if(!['/api/pc-shop/notifications','/api/pc-shop/notifications/read'].includes(route))return false;/* Browser preflight belongs to the outer CORS handler, before Firebase auth. */if(String(req.method||'GET').toUpperCase()==='OPTIONS')return false;const identity=await getUserIdentity(req,parsed);if(!identity?.uid)return respond(res,401,{ok:false,error:'login_required'});const uid=String(identity.uid);
  try{const db=getDb();if(!db)return respond(res,503,{ok:false,error:'firestore_unavailable'});const collection=collectionFor(db,uid);
   if(route.endsWith('/read')&&req.method==='POST'){
    const body=await parseBody(req),items=body?.items;if(!Array.isArray(items)||!items.length||items.length>50||items.some(x=>!validId(x?.id)||typeof x.version!=='string'||x.version.length>80))return respond(res,400,{ok:false,error:'invalid_selection'});
    let acknowledged=[];await db.runTransaction(async tx=>{acknowledged=[];const refs=items.map(x=>collection.doc(x.id)),snapshots=await Promise.all(refs.map(ref=>tx.get(ref))),orders=await Promise.all(items.map((x,i)=>snapshots[i].exists?null:tx.get(db.collection('pcShopOrders').doc(x.id))));
     for(let i=0;i<items.length;i++){const n=snapshots[i].exists?snapshots[i].data():orders[i]?.exists?noticeFromOrder(orders[i].data(),now()):null;if(!n||n.uid!==uid||n.version!==items[i].version)continue;tx.set(refs[i],{...n,readAtMs:now()},{merge:true});acknowledged.push(items[i].id);}});legacyCache.delete(uid);return respond(res,200,{ok:true,acknowledged});
   }
   if(route.endsWith('/read')||req.method!=='GET')return respond(res,405,{ok:false,error:'method_not_allowed'});
   const snap=await collection.orderBy('atMs','desc').limit(50).get(),records=[];snap.forEach(d=>{const n=d.data();if(n.uid===uid)records.push(n);});let unread=[],partial=false;try{const count=await collection.where('active','==',true).where('readAtMs','==',0).limit(100).get();count.forEach(d=>{if(d.data().uid===uid)unread.push(d.data());});partial=unread.length===100;}catch{unread=records.filter(n=>n.active&&n.readAtMs===0);partial=records.length===50;}
   const merged=new Map([...records,...unread].map(n=>[n.id,n]));if(String(parsed.query?.includeLegacy||'')==='1')for(const n of await legacy(db,uid))if(!merged.has(n.id)){const existing=records.length?await collection.doc(n.id).get():null;merged.set(n.id,existing?.exists?existing.data():n);}
   const active=[...merged.values()].filter(n=>n.active).sort((a,b)=>Number(!b.readAtMs)-Number(!a.readAtMs)||b.atMs-a.atMs),items=active.slice(0,50).map(n=>{const {uid,...publicNotice}=n;if(['quote','invoice'].includes(n.kind)&&n.expiresAtMs>0&&n.expiresAtMs<=now())publicNotice.title=n.kind==='quote'?'Quote expired':'Invoice expired';return publicNotice;});
   return respond(res,200,{ok:true,items,removedIds:records.filter(n=>!n.active).map(n=>n.id),unreadCount:Math.max(unread.length,active.filter(n=>!n.readAtMs).length),unreadCountIsLowerBound:partial});
  }catch(e){return respond(res,503,{ok:false,error:'notifications_unavailable',message:'Your notifications could not be loaded. Please retry.'});}
 }
 return {handle};
}
module.exports={collectionFor,noticeFromOrder,writeTransitionTx,createCustomerNotifications};
