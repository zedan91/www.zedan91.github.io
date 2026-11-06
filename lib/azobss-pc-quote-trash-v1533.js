'use strict';
function trashEligibility(row={}){
 if(row.invoiceNo||row.receiptNo||row.invoiceIssued===true||Number(row.paidAtMs)>0||Number(row.amountPaid)>0||Number(row.paidAmount)>0)return false;
 if(!['','quote-requested','quote-ready','quote-accepted','quote-declined','price-confirmation','shipping-confirmation','cancelled','order-received'].includes(String(row.status||'')))return false;
 if(!['','not-ready','pending','unpaid','cancelled'].includes(String(row.paymentStatus||'').toLowerCase()))return false;
 return ['','order-received','cancelled','quote-requested'].includes(String(row.fulfillmentStatus||''));
}
function error(code,message,status=409,blocked=[]){const e=new Error(message);Object.assign(e,{code,status,blocked});return e;}
function ensureActive(row){if(row.adminTrashed===true)throw error('request_in_trash','This request is in Trash. Restore it before editing.');}
async function bulkQuoteTrash(db,body={},admin={},now=Date.now()){
 const action=String(body.action||'');if(!['trash','restore'].includes(action))throw error('invalid_action','Choose Move to Trash or Restore.',400);
 if(!Array.isArray(body.ids)||!body.ids.length||body.ids.length>100||body.ids.some(id=>typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(id)))throw error('invalid_selection','Select between1 and100 valid requests.',400);
 const ids=[...new Set(body.ids)],actor=String(admin.uid||admin.email||admin.username||'admin').slice(0,160);
 return db.runTransaction(async tx=>{
  const refs=ids.map(id=>db.collection('pcShopOrders').doc(id)),logs=ids.map(id=>db.collection('purchaseLogs').doc('pcshop-'+id));
  // Read every candidate and sales log before any write, including on transaction retry.
  const [snapshots,sales]=await Promise.all([Promise.all(refs.map(ref=>tx.get(ref))),Promise.all(logs.map(ref=>tx.get(ref)))]);
  const blocked=[];
  for(let i=0;i<ids.length;i++){
   if(!snapshots[i].exists){blocked.push({id:ids[i],reason:'Record not found'});continue;}
   const row=snapshots[i].data()||{};
   if(!trashEligibility(row)||sales[i].exists)blocked.push({id:ids[i],reason:'Invoice, payment, receipt, fulfillment or sales record is protected'});
   else if(action==='restore'&&row.adminTrashed!==true)blocked.push({id:ids[i],reason:'Record is not in Trash'});
  }
  if(blocked.length)throw error('selection_contains_protected_records','Nothing was changed. Review the protected records and select again.',409,blocked);
  let changed=0;
  for(let i=0;i<ids.length;i++){
   const row=snapshots[i].data()||{};if(action==='trash'&&row.adminTrashed===true)continue;
   const version=Math.max(0,Number(row.quoteVersion)||0)+1;
   const history=[...(Array.isArray(row.trashHistory)?row.trashHistory.slice(-49):[]),{action,atMs:now,by:actor}];
   const patch={adminTrashed:action==='trash',updatedAtMs:now,quoteVersion:version,priceConfirmed:false,priceConfirmationRequired:true,stockConfirmed:false,stockCheckedAtMs:0,customerApproval:action==='trash'?'cancelled':'pending',customerApprovedAtMs:0,customerApprovedQuoteVersion:0,quoteExpiresAtMs:0,trashHistory:history};
   if(action==='trash')Object.assign(patch,{trashedAtMs:now,trashedBy:actor,trashPreviousStatus:row.status||'',status:'cancelled',paymentStatus:'cancelled',fulfillmentStatus:'cancelled'});
   else Object.assign(patch,{restoredAtMs:now,restoredBy:actor,status:row.intent==='quote'?'quote-requested':'price-confirmation',paymentStatus:'not-ready',fulfillmentStatus:'order-received',shippingConfirmationRequired:row.shippingMethod==='Courier'});
   patch.statusHistory=[...(Array.isArray(row.statusHistory)?row.statusHistory.slice(-19):[]),{status:patch.status,action,atMs:now,by:'admin'}];
   tx.set(refs[i],patch,{merge:true});changed++;
  }
  return {action,selected:ids.length,changed,ids};
 });
}
module.exports={trashEligibility,ensureActive,bulkQuoteTrash};
