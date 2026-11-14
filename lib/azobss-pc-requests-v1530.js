'use strict';
// New requests use an explicit supplier quote -> customer approval -> admin invoice workflow.
// Historical orders retain the workflow under which they were created.
const {DAY}=require('./azobss-pc-documents-v1541');
const isRequest = row => row?.requestOnly === true && Number(row.workflowVersion) >= 1530;
function fail(code, message, status=409) { const e=new Error(message);e.code=code;e.status=status;throw e; }
function amount(value) { const n=Number(value);if(!Number.isFinite(n)||n<0||n>10000000)fail('invalid_amount','Masukkan jumlah yang sah.',400);return Math.round(n*100)/100; }
function priceBreakdown(row,body){
 const lines=body.itemPrices;
 if(lines===undefined){
  const total=amount(body.confirmedItemTotal??row.confirmedItemTotal??0);
  if(row.items?.length&&row.items.every(item=>Number.isFinite(item.confirmedUnitPrice))&&total!==amount(row.confirmedItemTotal||0))
   fail('item_prices_required','Ubah harga seunit setiap barang untuk mengubah jumlah sebut harga.',400);
  return {total};
 }
 if(row.invoiceNo)fail('invoice_locked','Harga invois yang telah dikeluarkan dikunci.');
 if(body.publishQuote!==true)fail('publish_required','Terbitkan sebut harga untuk menyimpan harga setiap barang.',400);
 if(!Array.isArray(lines)||!row.items?.length||lines.length!==row.items.length)fail('item_prices_required','Sahkan harga jualan setiap barang.',400);
 let cents=0,changed=false;
 const items=row.items.map((item,index)=>{
  const line=lines[index],value=line?.unitPrice;
  if(line?.productId!==item.productId||!['number','string'].includes(typeof value)||!/^\d+(?:\.\d{1,2})?$/.test(String(value)))
   fail('invalid_item_price','Masukkan harga seunit yang sah (maksimum dua tempat perpuluhan) bagi setiap barang.',400);
  const confirmedUnitPrice=amount(value);
  cents+=Math.round(confirmedUnitPrice*100)*item.qty;
  if(item.confirmedUnitPrice!==confirmedUnitPrice)changed=true;
  return {...item,confirmedUnitPrice};
 });
 const total=amount(cents/100);
 if(body.confirmedItemTotal!==undefined&&amount(body.confirmedItemTotal)!==total)
  fail('item_total_mismatch','Jumlah barang perlu sepadan dengan harga seunit darab kuantiti.',400);
 return {total,items,changed};
}
const clean=(v,n=800)=>String(v??'').trim().slice(0,n);
const approvalValid=row=>row.customerApproval==='accepted'&&Number(row.customerApprovedQuoteVersion)===Number(row.quoteVersion);
function readyForInvoice(row) { return !isRequest(row)||(row.stockConfirmed===true&&row.priceConfirmed===true&&row.shippingConfirmationRequired!==true&&row.deliveryDetailsPending!==true&&approvalValid(row)); }
function history(row,status,by,now) { return [...(Array.isArray(row.statusHistory)?row.statusHistory.slice(-19):[]),{status,atMs:now,by,quoteVersion:Number(row.quoteVersion||0)}]; }
function adminRequestPatch(row,body,now=Date.now()) {
 if(!isRequest(row))fail('legacy_order','Gunakan aliran pesanan asal.',400);
 const issued=!!row.invoiceNo,patch={updatedAtMs:now};
 if(['cancelled','refunded'].includes(row.status)&&(body.issueInvoice===true||body.convertToOrder===true||body.paymentStatus==='paid'))fail('request_closed','Permintaan ini telah ditutup.');
 for(const [key,max] of [['courier',100],['trackingNumber',160],['adminNote',800]])if(body[key]!==undefined)patch[key]=clean(body[key],max);
 if(body.shippingCost!==undefined)patch.shippingCost=amount(body.shippingCost);
 const prices=priceBreakdown(row,body),itemTotal=prices.total;
 if(prices.items)patch.items=prices.items;
 const shipping=row.deliveryDetailsPending===true?0:body.shippingCharge===undefined?amount(row.shippingCharge||0):amount(body.shippingCharge);
 const changed=prices.changed||itemTotal!==amount(row.confirmedItemTotal||0)||shipping!==amount(row.shippingCharge||0)||body.stockConfirmed===false;
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
   if(next.deliveryDetailsPending===true)fail('delivery_details_required','Tunggu pelanggan memilih cara penerimaan dahulu.');
   if(!approvalValid(next))fail('customer_approval_required','Pelanggan perlu bersetuju dengan sebut harga terkini dalam My Requests dahulu.');
   if(Number(next.quoteExpiresAtMs)<=now)fail('quote_expired','Sebutharga tamat. Sahkan stok dan hantar sebut harga baharu.');
   if(body.stockConfirmed!==true||!readyForInvoice(next))fail('supplier_stock_required','Semak semula stok pembekal sebelum mengeluarkan invois.');
   const parts=String(row.orderId).split('-');
   Object.assign(patch,{intent:'checkout',invoiceNo:`AZI-${parts[1]}-${parts[2]}`,documentNo:`AZI-${parts[1]}-${parts[2]}`,paymentStatus:'pending',status:'awaiting-payment',stockCheckedAtMs:now,invoiceIssuedAtMs:now,invoiceExpiresAtMs:now+DAY,invoiceVersion:1});
   next={...row,...patch};
  }
 }
 if(issued&&body.reconfirmInvoice===true){
  if(['cancelled','refunded'].includes(row.status)||['paid','refunded','cancelled'].includes(row.paymentStatus))fail('invoice_closed','This invoice cannot be renewed.');
  if(body.stockConfirmed!==true||!readyForInvoice(next))fail('supplier_stock_required','Recheck supplier stock before renewing the invoice.');
  Object.assign(patch,{stockCheckedAtMs:now,invoiceRenewedAtMs:now,invoiceExpiresAtMs:now+DAY,invoiceVersion:Number(row.invoiceVersion||1)+1});next={...next,...patch};
 }
 if(body.paymentStatus!==undefined){
  const payment=String(body.paymentStatus);
  if(row.paymentStatus==='paid'&&['pending','not-ready'].includes(payment))fail('payment_already_verified','Verified payment cannot be changed back to unpaid. Use the refund workflow when needed.');
  if(!['not-ready','pending','paid','refunded','cancelled'].includes(payment))fail('invalid_payment_status','Status bayaran tidak sah.',400);
  if(!next.invoiceNo&&!['not-ready','cancelled'].includes(payment))fail('invoice_not_ready','Bayaran disekat sehingga invois diluluskan.');
  if(next.invoiceNo&&['not-ready'].includes(payment))fail('invoice_already_issued','Invois telah dikeluarkan.');
  patch.paymentStatus=payment;next={...next,...patch};
 }
 if(body.fulfillmentStatus!==undefined){
  const status=String(body.fulfillmentStatus);
  const pickup=row.shippingMethod==='Pickup at AZOBSS'&&!!row.pickupLocation;
  const states=pickup?['order-received','processing','packed','ready-for-pickup','completed','cancelled']:['order-received','processing','packed','shipped','in-transit','delivered','completed','cancelled'];
  if(!['order-received','cancelled'].includes(status)&&next.paymentStatus!=='paid')fail('payment_required','Sahkan bayaran sebelum memproses atau menghantar barang.');
  if(!states.includes(status))fail('invalid_fulfillment_status','Status penghantaran tidak sah.',400);
  if(pickup&&status==='completed'&&!['ready-for-pickup','completed'].includes(row.fulfillmentStatus))fail('pickup_not_ready','Tandakan pesanan sedia diambil sebelum menyiapkannya.');
  patch.fulfillmentStatus=status;
 }
 next={...next,...patch};
 if(next.paymentStatus==='cancelled'||next.fulfillmentStatus==='cancelled')patch.status='cancelled';
 else if(next.paymentStatus==='refunded')patch.status='refunded';
 else if(next.paymentStatus==='paid'){
  if(!readyForInvoice(next)||!next.invoiceNo)fail('invoice_not_ready','Invois belum layak untuk pembayaran.');
  patch.status=next.fulfillmentStatus==='order-received'?'payment-received':next.fulfillmentStatus;
  if(!row.paidAtMs)patch.paidAtMs=now;
  patch.paymentReviewStatus='verified';
  if(!row.receiptNo){const parts=String(row.orderId).split('-');patch.receiptNo=`AZR-${parts[1]}-${parts[2]}`;}
 }
 if(patch.status&&patch.status!==row.status)patch.statusHistory=history(row,patch.status,'admin',now);
 return patch;
}
function customerDecisionPatch(row,uid,body,now=Date.now()) {
 if(row.uid!==uid||row.adminTrashed)fail('order_not_found','Permintaan tidak dijumpai.',404);
 if(!isRequest(row)||row.invoiceNo||['cancelled','refunded'].includes(row.status))fail('request_closed','Permintaan ini tidak boleh diubah.');
 const action=String(body.action||'');
 if(action==='cancel')return {status:'cancelled',paymentStatus:'cancelled',fulfillmentStatus:'cancelled',customerApproval:'cancelled',updatedAtMs:now,statusHistory:history(row,'cancelled','customer',now)};
 if(action==='accept'&&row.deliveryDetailsPending===true)fail('delivery_details_required','Pilih cara penerimaan dahulu.');
 if(!['accept','decline'].includes(action))fail('invalid_decision','Pilihan tidak sah.',400);
 if(Number(body.quoteVersion)!==Number(row.quoteVersion))fail('quote_changed','Sebutharga telah berubah. Muat semula dan semak harga terkini.');
 if(row.status==='quote-accepted'&&action==='accept'&&approvalValid(row))return {};
 if(row.status!=='quote-ready'||!row.priceConfirmed||!row.stockConfirmed)fail('quote_not_ready','Tunggu sebut harga akhir daripada admin.');
 if(Number(row.quoteExpiresAtMs)<=now)fail('quote_expired','Sebutharga tamat. Minta admin semak stok dan harga semula.');
 const status=action==='accept'?'quote-accepted':'quote-declined';
 return {status,customerApproval:action==='accept'?'accepted':'declined',customerApprovedAtMs:action==='accept'?now:0,customerApprovedQuoteVersion:action==='accept'?Number(row.quoteVersion):0,updatedAtMs:now,statusHistory:history(row,status,'customer',now)};
}
module.exports={isRequest,readyForInvoice,priceBreakdown,adminRequestPatch,customerDecisionPatch};
