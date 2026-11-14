'use strict';
const {customerDelivery}=require('./azobss-tech-delivery');
const DAY=24*60*60*1000;
const validOrderId=id=>typeof id==='string'&&/^[-a-zA-Z0-9_]{1,120}$/.test(id);
const invoiceDeadline=row=>Number(row.invoiceExpiresAtMs)||((Number(row.invoiceIssuedAtMs)||Number(row.stockCheckedAtMs)||Number(row.quoteSentAtMs)||Number(row.createdAtMs)) + DAY);
const receiptAvailable=row=>!!row.receiptNo&&['paid','refunded'].includes(row.paymentStatus);
function documentState(row,now=Date.now()){
 const closed=row.adminTrashed||['cancelled','refunded'].includes(row.status)||['cancelled','refunded'].includes(row.paymentStatus);
 const paid=row.paymentStatus==='paid',expiresAtMs=row.invoiceNo?invoiceDeadline(row):0;
 const invoiceStatus=!row.invoiceNo?'not-issued':closed?(row.paymentStatus==='refunded'?'refunded':'cancelled'):paid?'paid':expiresAtMs<=now?'expired':row.paymentReviewStatus==='pending'?'verification-pending':'unpaid';
 return {invoiceStatus,invoiceExpiresAtMs:expiresAtMs,canPay:!!row.invoiceNo&&invoiceStatus==='unpaid'&&row.priceConfirmed===true&&row.stockConfirmed!==false&&row.shippingConfirmationRequired!==true&&row.deliveryDetailsPending!==true,receiptAvailable:receiptAvailable(row),paidAtMs:Number(row.paidAtMs)||0,paymentReportedAtMs:Number(row.paymentReportedAtMs)||0,paymentReviewStatus:row.paymentReviewStatus||'',paymentReference:row.paymentReference||''};
}
function fail(code,message,status=409){const e=new Error(message);e.code=code;e.status=status;throw e;}
function paymentReportPatch(row,uid,body,now=Date.now()){
 if(row.uid!==uid||row.adminTrashed)fail('order_not_found','Order not found.',404);
 if(!row.invoiceNo||['cancelled','refunded'].includes(row.status)||['paid','refunded','cancelled'].includes(row.paymentStatus))fail('invoice_not_payable','This invoice cannot accept a payment report.');
 const reference=String(body.reference||'').trim();if(!reference||reference.length>120)fail('payment_reference_required','Enter the bank transaction reference (up to120 characters).',400);
 // A customer report never confirms money received or creates a receipt.
 return {paymentReference:reference,paymentReportedAtMs:now,paymentReviewStatus:'pending',updatedAtMs:now};
}
function customerDocument(row,kind,now=Date.now()){
 if(!['quote','invoice','receipt'].includes(kind))fail('document_not_found','Document not found.',404);
 const state=documentState(row,now);
 if(row.adminTrashed||kind==='quote'&&(!row.quoteSentAtMs||!row.priceConfirmed)||kind==='invoice'&&!row.invoiceNo||kind==='receipt'&&!state.receiptAvailable)fail('document_not_available','This document is not available.',404);
 const total=Number(row.confirmedTotal)||0,itemsTotal=Number(row.confirmedItemTotal)||Math.max(0,total-(Number(row.shippingCharge)||0));
 const number=kind==='quote'?row.quoteNo||row.orderId:kind==='invoice'?row.invoiceNo:row.receiptNo;
 const status=kind==='quote'?(Number(row.quoteExpiresAtMs)<=now?'expired':row.customerApproval||'pending'):kind==='invoice'?state.invoiceStatus:row.paymentStatus;
 const sourceItems=Array.isArray(row.items)?row.items:[];
 const itemized=sourceItems.length>0&&sourceItems.every(x=>Number.isFinite(x.confirmedUnitPrice)&&x.confirmedUnitPrice>=0)&&
  sourceItems.reduce((sum,x)=>sum+Math.round(x.confirmedUnitPrice*100)*(Number(x.qty)||1),0)===Math.round(itemsTotal*100);
 const items=sourceItems.map(x=>({name:String(x.name||''),optionLabel:String(x.optionLabel||''),qty:Number(x.qty)||1,
  ...(itemized?{unitPrice:x.confirmedUnitPrice,amount:Math.round(x.confirmedUnitPrice*100*(Number(x.qty)||1))/100}:{})}));
 const pdfItems=items.map(x=>({name:x.name+(x.optionLabel?' - '+x.optionLabel:''),category:'computer-it',qty:x.qty,
  ...(itemized?{unitPrice:x.unitPrice,amount:x.amount}:{unitPrice:0,includedInBundle:true})}));
 if(!itemized)pdfItems.unshift({name:'Agreed items bundle (models listed below)',category:'computer-it',qty:1,unitPrice:itemsTotal,amount:itemsTotal});
 const date=kind==='receipt'?Number(row.paidAtMs)||Number(row.updatedAtMs):kind==='invoice'?Number(row.invoiceIssuedAtMs)||Number(row.stockCheckedAtMs)||Number(row.createdAtMs):Number(row.quoteSentAtMs);
 const shipping=customerDelivery(row);
 const shippingNote=shipping?.pickupLocation?['Ambil Sendiri',shipping.pickupLocation.name,shipping.pickupLocation.address||'Tingkat 1, Batu Caves / Gombak',shipping.pickupConfirmedSlot?'Waktu disahkan: '+shipping.pickupConfirmedSlot.replace('T',' ')+' MYT':shipping.pickupRequestedSlot?'Waktu cadangan: '+shipping.pickupRequestedSlot.replace('T',' ')+' MYT (belum disahkan)':'',shipping.pickupLocation.instructions].filter(Boolean).join(' · '):shipping?.address?'Penghantaran ke Alamat · '+shipping.address+(shipping.subsidy>0?' · Subsidi RM'+shipping.subsidy.toFixed(2):''):'';
 const notes=kind==='quote'&&row.deliveryDetailsPending?(row.fixedDeliveryOffer?'Items-only quote. Delivery costs RM'+Number(row.fixedDeliveryOffer.charge).toFixed(2)+' or self pickup is free. Choose in My Requests & Orders.':'Items-only quote. Delivery charge is pending. Choose delivery or self pickup in My Requests & Orders to continue.'):kind==='quote'?'Quotation only. Customer acceptance and a fresh supplier stock check are required before an invoice is issued.':kind==='invoice'?(state.canPay?'Supplier stock checked. Pay before the invoice expires and use the invoice number as your bank reference.':'Payment status: '+status+'. Contact AZOBSS if reconfirmation is required.'):'Payment received and verified by AZOBSS. This receipt does not confirm delivery.';
 const pdf={source:'pc-shop',documentNo:number,quotationNo:row.quoteNo||'',invoiceNo:row.invoiceNo||'',receiptNo:kind==='receipt'?row.receiptNo:'',documentType:kind==='quote'?'quotation':kind,status:kind==='invoice'&&status==='unpaid'?'pending':status,customerName:row.customerName||'',customerPhone:row.customerPhone||'',customerAddress:row.customerAddress||'',customerEmail:row.customerEmail||'',paymentMethod:state.canPay||state.receiptAvailable?row.paymentMethod||'Maybank':'Awaiting AZOBSS reconfirmation',paymentReference:row.paymentReference||'',createdAtMs:date,saleDateMs:date,quotationDateMs:Number(row.quoteSentAtMs)||date,invoiceDateMs:Number(row.invoiceIssuedAtMs)||date,paidAtMs:Number(row.paidAtMs)||0,quotationValidUntil:kind==='quote'?new Date(Number(row.quoteExpiresAtMs)||now).toISOString().slice(0,10):'',dueDate:kind==='invoice'?new Date(state.invoiceExpiresAtMs).toISOString().slice(0,10):'',subtotal:itemsTotal,gross:total,shippingCharge:Number(row.shippingCharge)||0,paidGross:state.receiptAvailable?total:0,amountDue:state.receiptAvailable?0:total,items:pdfItems,notes:notes+(shippingNote?' '+shippingNote+'.':'')+(row.paymentReference?' Bank reference: '+row.paymentReference+'.':'')};
 return {kind,number,status,...(shipping?{delivery:shipping}:{}),orderId:row.orderId,items,itemsTotal,shippingCharge:Number(row.shippingCharge)||0,total,currency:'MYR',issuedAtMs:date,expiresAtMs:kind==='quote'?Number(row.quoteExpiresAtMs)||0:kind==='invoice'?state.invoiceExpiresAtMs:0,pdf};
}
module.exports={DAY,validOrderId,invoiceDeadline,receiptAvailable,documentState,paymentReportPatch,customerDocument};
