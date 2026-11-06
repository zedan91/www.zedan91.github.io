'use strict';
// New requests use an explicit supplier quote -> customer approval -> admin invoice workflow.
// Historical orders retain the workflow under which they were created.
const isRequest = row => row?.requestOnly === true && Number(row.workflowVersion) >= 1530;
function fail(code, message, status=409) { const e=new Error(message);e.code=code;e.status=status;throw e; }
function amount(value) { const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000)fail('invalid_amount','Masukkan jumlah yang sah.',400);return Math.round(n*100)/100; }
const clean=(v,n=800)=>String(v??'').trim().slice(0,n);
const approvalValid=row=>row.customerApproval==='accepted'&&Number(row.customerApprovedQuoteVersion)===Number(row.quoteVersion);
function readyForInvoice(row) { return !isRequest(row)||(row.stockConfirmed===true&&row.priceConfirmed===true&&row.shippingConfirmationRequired!==true&&approvalValid(row)); }
function history(row,status,by,now) { return [...(Array.isArray(row.statusHistory)?row.statusHistory.slice(-19):[]),{status,atMs:now,by,quoteVersion:Number(row.quoteVersion||0)}]; }
function adminRequestPatch(row,body,now=Date.now()) {
 if(!isRequest(row))fail('legacy_order','Gunakan aliran pesanan asal.',400);
 const issued=!!row.invoiceNo,patch={updatedAtMs:now};
 if(['cancelled','refunded'].includes(row.status)&&(body.issueInvoice===true||body.convertToOrder===true||body.paymentStatus==='paid'))fail('request_closed','Permintaan ini telah ditutup.');
 for(const [key,max] of [['courier',100],['trackingNumber',160],['adminNote',800]])if(body[key]!==undefined)patch[key]=clean(body[key],max);
 if(body.shippingCost!==undefined)patch.shippingCost=amount(body.shippingCost);
 const itemTotal=body.confirmedItemTotal===undefined?amount(row.confirmedItemTotal||0):amount(body.confirmedItemTotal);
 const shipping=body.shippingCharge===undefined?amount(row.shippingCharge||0):amount(body.shippingCharge);
 const changed=itemTotal!==amount(row.confirmedItemTotal||0)||shipping!==amount(row.shippingCharge||0)||body.stockConfirmed===false;
 if(issued&&(changed||body.publishQuote===true))fail('invoice_locked','Jumlah invois yang telah dikeluarkan tidak boleh diubah melalui sebut harga.');
 let next={...row,...patch};
 if(!issued){
  Object.assign(patch,{intent:'quote',invoiceNo:'',receiptNo:'',documentNo:row.quoteNo||row.orderId,paymentStatus:'not-ready',confirmedItemTotal:itemTotal,shippingCharge:shipping,confirmedTotal:amount(itemTotal+shipping)});
  if(changed)Object.assign(patch,{quoteVersion:Number(row.quoteVersion||0)+1,priceConfirmed:false,priceConfirmationRequired:true,stockConfirmed:false,shippingConfirmationRequired:row.shippingMethod==='Courier',customerApproval:'pending',customerApprovedAtMs:0,customerApprovedQuoteVersion:0,quoteExpiresAtMs:0,status:'quote-requested'});
  next={...row,...patch};
  if(body.publishQuote===true){
   if(['cancelled','refunded'].includes(row.status))fail('request_closed','Permintaan ini telah ditutup.');
   if(body.stockConfirmed!==true)fail('supplier_stock_required','Sahkan stok dengan pembekal dahulu.');
   if(itemTotal<=0)fail('final_price_required','Masukkan harga akhir item dahulu.',400);
   if(row.shippingMethod==='Courier'&&body.shippingConfirmed!==true)fail('shipping_confirmation_required','Sahkan caj penghantaran dahulu, termasuk jika percuma.');
   Object.assign(patch,{quoteVersion:Number(next.quoteVersion||0)+1,stockConfirmed:true,stockCheckedAtMs:now,priceConfirmed:true,priceConfirmationRequired:false,shippingConfirmationRequired:false,customerApproval:'pending',customerApprovedAtMs:0,customerApprovedQuoteVersion:0,quoteSentAtMs:now,quoteExpiresAtMs:now+24*60*60*1000,status:'quote-ready'});
   next={...row,...patch};
  }
  if(body.issueInvoice===true||body.convertToOrder===true){
   if(!approvalValid(next))fail('customer_approval_required','Pelanggan perlu bersetuju dengan sebut harga terkini dalam My Requests dahulu.');
   if(Number(next.quoteExpiresAtMs)<=now)fail('quote_expired','Sebutharga tamat. Sahkan stok dan hantar sebut harga baharu.');
   if(body.stockConfirmed!==true||!readyForInvoice(next))fail('supplier_stock_required','Semak semula stok pembekal sebelum mengeluarkan invois.');
   const parts=String(row.orderId).split('-');
   Object.assign(patch,{intent:'checkout',invoiceNo:`AZI-${parts[1]}-${parts[2]}`,documentNo:`AZI-${parts[1]}-${parts[2]}`,paymentStatus:'pending',status:'awaiting-payment',stockCheckedAtMs:now});
   next={...row,...patch};
  }
 }
 if(body.paymentStatus!==undefined){
  const payment=String(body.paymentStatus);
  if(!['not-ready','pending','paid','refunded','cancelled'].includes(payment))fail('invalid_payment_status','Status bayaran tidak sah.',400);
  if(!next.invoiceNo&&!['not-ready','cancelled'].includes(payment))fail('invoice_not_ready','Bayaran disekat sehingga invois diluluskan.');
  if(next.invoiceNo&&['not-ready'].includes(payment))fail('invoice_already_issued','Invois telah dikeluarkan.');
  patch.paymentStatus=payment;next={...next,...patch};
 }
 if(body.fulfillmentStatus!==undefined){
  const status=String(body.fulfillmentStatus);
  if(!['order-received','processing','packed','shipped','in-transit','delivered','completed','cancelled'].includes(status))fail('invalid_fulfillment_status','Status penghantaran tidak sah.',400);
  if(!['order-received','cancelled'].includes(status)&&next.paymentStatus!=='paid')fail('payment_required','Sahkan bayaran sebelum memproses atau menghantar barang.');
  patch.fulfillmentStatus=status;
 }
 next={...next,...patch};
 if(next.paymentStatus==='cancelled'||next.fulfillmentStatus==='cancelled')patch.status='cancelled';
 else if(next.paymentStatus==='refunded')patch.status='refunded';
 else if(next.paymentStatus==='paid'){
  if(!readyForInvoice(next)||!next.invoiceNo)fail('invoice_not_ready','Invois belum layak untuk pembayaran.');
  patch.status=next.fulfillmentStatus==='order-received'?'payment-received':next.fulfillmentStatus;
  if(!row.paidAtMs)patch.paidAtMs=now;
  if(!row.receiptNo){const parts=String(row.orderId).split('-');patch.receiptNo=`AZR-${parts[1]}-${parts[2]}`;}
 }
 if(patch.status&&patch.status!==row.status)patch.statusHistory=history(row,patch.status,'admin',now);
 return patch;
}
function customerDecisionPatch(row,uid,body,now=Date.now()) {
 if(row.uid!==uid)fail('order_not_found','Permintaan tidak dijumpai.',404);
 if(!isRequest(row)||row.invoiceNo||['cancelled','refunded'].includes(row.status))fail('request_closed','Permintaan ini tidak boleh diubah.');
 const action=String(body.action||'');
 if(action==='cancel')return {status:'cancelled',paymentStatus:'cancelled',fulfillmentStatus:'cancelled',customerApproval:'cancelled',updatedAtMs:now,statusHistory:history(row,'cancelled','customer',now)};
 if(!['accept','decline'].includes(action))fail('invalid_decision','Pilihan tidak sah.',400);
 if(Number(body.quoteVersion)!==Number(row.quoteVersion))fail('quote_changed','Sebutharga telah berubah. Muat semula dan semak harga terkini.');
 if(row.status==='quote-accepted'&&action==='accept'&&approvalValid(row))return {};
 if(row.status!=='quote-ready'||!row.priceConfirmed||!row.stockConfirmed)fail('quote_not_ready','Tunggu sebut harga akhir daripada admin.');
 if(Number(row.quoteExpiresAtMs)<=now)fail('quote_expired','Sebutharga tamat. Minta admin semak stok dan harga semula.');
 const status=action==='accept'?'quote-accepted':'quote-declined';
 return {status,customerApproval:action==='accept'?'accepted':'declined',customerApprovedAtMs:action==='accept'?now:0,customerApprovedQuoteVersion:action==='accept'?Number(row.quoteVersion):0,updatedAtMs:now,statusHistory:history(row,status,'customer',now)};
}
module.exports={isRequest,readyForInvoice,adminRequestPatch,customerDecisionPatch};
