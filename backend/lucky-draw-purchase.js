// Eligibility comes only from private, server-verified order records.
export const PURCHASE_POLICY='liyabudun-paid-v1550';
export function qualifyingPurchase(order,uid){
 if(!order||!uid||order.user?.uid!==uid||order.deleted||order.isAdminTestPayment||order.testPayment||order.testMode||order.refundedAt||order.chargebackAt)return false;
 if(order.status!=='paid'||!Number.isInteger(order.amountSen)||order.amountSen<1||!(order.paymentVerifiedAt||order.toyyibVerifiedAt||order.stripeVerifiedAt))return false;
 if(order.paymentStatus&&order.paymentStatus!=='paid')return false;
 return order.product?.licenseProduct==='solattime'&&order.product?.fulfilment==='solattime';
}
export function createPurchaseChecker({getDb,readOrders=()=>[]}){
 return async function findPurchase(identity,transaction){
  const uid=String(identity?.uid||'');if(!uid)return null;
  const db=getDb();
  if(!db){const row=readOrders().find(order=>qualifyingPurchase(order,uid));return row?{orderId:row.orderId}:null;}
  let cursor=null;
  for(let page=0;page<100;page++){
   let query=db.collection('premiumOrders').where('user.uid','==',uid).orderBy('__name__').limit(100);
   if(cursor)query=query.startAfter(cursor);
   const snap=transaction?await transaction.get(query):await query.get();
   const found=snap.docs.find(doc=>qualifyingPurchase(doc.data(),uid));
   if(found)return {orderId:found.id};
   if(snap.docs.length<100)return null;
   cursor=snap.docs.at(-1);
  }
  throw Object.assign(new Error('Rekod pembelian belum dapat disemak. Cuba semula.'),{status:503});
 };
}
export async function purchasedEntries(rows,findPurchase,transaction){
 const memo=new Map(),result=[];
 for(let i=0;i<rows.length;i+=8){
  const batch=rows.slice(i,i+8);
  const valid=await Promise.all(batch.map(row=>{
   if(!row.uid)return null;
   if(!memo.has(row.uid))memo.set(row.uid,findPurchase({uid:row.uid},transaction));
   return memo.get(row.uid);
  }));
  batch.forEach((row,index)=>{if(valid[index])result.push(row);});
 }
 return result;
}
