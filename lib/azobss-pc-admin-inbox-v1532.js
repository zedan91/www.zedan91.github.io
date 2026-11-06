'use strict';
const crypto=require('node:crypto');
const {trashEligibility}=require('./azobss-pc-quote-trash-v1533');
const STAGES=Object.freeze({review:['quote-requested','price-confirmation','shipping-confirmation'],customer:['quote-ready'],approved:['quote-accepted'],payment:['awaiting-payment'],fulfilment:['payment-received','processing','packed','shipped','in-transit'],closed:['completed','delivered','cancelled','refunded','quote-declined']});
function fail(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;throw e;}
const text=(x,max=200)=>String(x??'').trim().slice(0,max);
const fold=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function options(query={}){
 const stage=text(query.stage,30)||'all',status=text(query.status,40)||'all',sort=query.sort==='oldest'?'asc':'desc',q=text(query.q,160),uid=text(query.customer,128);
 if(stage!=='all'&&!STAGES[stage])fail('invalid_stage','Choose a valid workflow filter.');
 const date=x=>{if(!x)return 0;if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x)))fail('invalid_date','Choose a valid date.');const n=Date.parse(x+'T00:00:00+08:00');if(!Number.isFinite(n))fail('invalid_date','Choose a valid date.');return n;};
 const from=date(query.from),to=date(query.to);if(from&&to&&from>to)fail('invalid_date_range','The end date must follow the start date.');
 const pageSize=Math.max(1,Math.min(100,Math.floor(Number(query.pageSize)||25)));
 const filter={trash:String(query.trash||'')==='1',stage,status,sort,q,uid,from,to:to?to+86400000:0};
 return {...filter,pageSize,key:crypto.createHash('sha256').update(JSON.stringify(filter)).digest('hex').slice(0,20)};
}
function matches(row,o){
 if((row.adminTrashed===true)!==o.trash)return false;
 if(o.uid&&String(row.uid||'')!==o.uid)return false;
 if(o.stage!=='all'&&!STAGES[o.stage].includes(row.status))return false;
 const expired=!row.invoiceNo&&Number(row.quoteExpiresAtMs)>0&&Number(row.quoteExpiresAtMs)<=Date.now()&&!['cancelled','refunded','quote-declined'].includes(row.status);
 if(o.status==='expired'&&!expired)return false;
 if(o.status!=='all'&&o.status!=='expired'&&row.status!==o.status)return false;
 const at=Number(row.createdAtMs||0);if(o.from&&at<o.from||o.to&&at>=o.to)return false;
 if(!o.q)return true;
 const hay=fold([row.orderId,row.quoteNo,row.invoiceNo,row.receiptNo,row.customerName,row.customerPhone,row.customerEmail,row.username,row.trackingNumber,row.notes,row.adminNote,...(row.items||[]).flatMap(x=>[x.name,x.productId,x.optionLabel])].join(' '));
 return o.q.split(/\s+/).filter(Boolean).every(term=>hay.includes(fold(term)));
}
function summary(row,id){
 return {adminTrashed:row.adminTrashed===true,canTrash:row.adminTrashed!==true&&trashEligibility(row),canRestore:row.adminTrashed===true&&trashEligibility(row),trashedAtMs:Number(row.trashedAtMs)||0,orderId:row.orderId||id,quoteNo:row.quoteNo||'',invoiceNo:row.invoiceNo||'',receiptNo:row.receiptNo||'',uid:row.uid||'',customerName:row.customerName||row.username||'',customerPhone:row.customerPhone||'',customerEmail:row.customerEmail||'',status:row.status||'',paymentStatus:row.paymentStatus||'',fulfillmentStatus:row.fulfillmentStatus||'',requestOnly:row.requestOnly===true,priceConfirmed:row.priceConfirmed===true,referenceSubtotal:Number(row.referenceSubtotal)||0,confirmedTotal:Number(row.confirmedTotal)||0,createdAtMs:Number(row.createdAtMs)||0,updatedAtMs:Number(row.updatedAtMs)||0,quoteExpiresAtMs:Number(row.quoteExpiresAtMs)||0,itemCount:(row.items||[]).reduce((n,x)=>n+(Number(x.qty)||1),0),modelCount:(row.items||[]).length,items:(row.items||[]).slice(0,3).map(x=>({name:x.name||'',optionLabel:x.optionLabel||'',qty:Number(x.qty)||1}))};
}
function cursorFor(doc,key){return Buffer.from(JSON.stringify({id:doc.id,key})).toString('base64url');}
async function readCursor(db,value,key){
 if(!value)return null;
 try{const cursor=JSON.parse(Buffer.from(text(value,1000),'base64url').toString('utf8'));if(cursor.key!==key||!cursor.id||/[\/\\]/.test(cursor.id))throw Error();const snap=await db.collection('pcShopOrders').doc(cursor.id).get();if(!snap.exists)fail('cursor_expired','The list changed. Refresh to start again.');return snap;}catch(e){if(e.code)throw e;fail('invalid_cursor','Refresh the list after changing filters.');}
}
async function listInbox(db,query={}){
 const o=options(query),collection=db.collection('pcShopOrders'),rows=[];let after=await readCursor(db,query.cursor,o.key),last=after,scanned=0,exhausted=false;
 const filtered=!!(o.trash||o.q||o.uid||o.stage!=='all'||o.status!=='all'||o.from||o.to),chunkSize=filtered?Math.max(o.pageSize+1,50):o.pageSize+1;
 while(scanned<1000&&!exhausted){
  let request=collection.orderBy('createdAtMs',o.sort);if(after)request=request.startAfter(after);
  const limit=Math.min(chunkSize,1000-scanned),snap=await request.limit(limit).get(),docs=snap.docs||(()=>{const d=[];snap.forEach(x=>d.push(x));return d;})();
  if(!docs.length){exhausted=true;break;}
  for(const doc of docs){
   scanned++;last=doc;const row=doc.data()||{};
   if(matches(row,o))rows.push({doc,record:summary(row,doc.id)});
   if(rows.length>o.pageSize)return {orders:rows.slice(0,o.pageSize).map(x=>x.record),hasMore:true,nextCursor:cursorFor(rows[o.pageSize-1].doc,o.key),pageSize:o.pageSize};
  }
  after=docs[docs.length-1];if(docs.length<limit)exhausted=true;
 }
 return {orders:rows.map(x=>x.record),hasMore:!exhausted,nextCursor:!exhausted&&last?cursorFor(last,o.key):'',pageSize:o.pageSize};
}
const countCache=new WeakMap();
function invalidateCounts(db){if(db)countCache.delete(db);}
async function inboxCounts(db){
 const prior=countCache.get(db);if(prior&&Date.now()-prior.at<20000)return prior.value;
 const count=async query=>{if(typeof query.count!=='function')return null;const result=await query.count().get();return Number(result.data().count)||0;};
 const values=await Promise.allSettled([count(db.collection('pcShopOrders')),...Object.values(STAGES).map(statuses=>count(db.collection('pcShopOrders').where('status','in',statuses))),count(db.collection('pcShopOrders').where('adminTrashed','==',true))]);
 const keys=['all',...Object.keys(STAGES),'trash'],counts=Object.fromEntries(keys.map((k,i)=>[k,values[i].status==='fulfilled'?values[i].value:null]));
 if(typeof counts.trash==='number'){for(const key of ['all','closed'])if(typeof counts[key]==='number')counts[key]=Math.max(0,counts[key]-counts.trash);}else {counts.all=null;counts.closed=null;}
 countCache.set(db,{at:Date.now(),value:counts});return counts;
}
module.exports={STAGES,listInbox,inboxCounts,invalidateCounts};
