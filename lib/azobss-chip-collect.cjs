'use strict';
// CHIP Collect server-side connector.
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CHIP_SECTIONS = Object.freeze({
 tech: 'Tech Products',
 'pc-service': 'PC & Laptop Services',
 'remote-troubleshooting': 'Remote PC Troubleshooting',
 rentals: 'Equipment Rentals',
 software: 'Software',
 cad: 'CAD Tools'
});
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function createChipAdapter({apiKey,brandId,fetchImpl=globalThis.fetch,testMode=false}){
 if(!apiKey||/[\r\n]/.test(apiKey)||!UUID.test(brandId||''))throw fail('CHIP configuration unavailable.',503);
 async function request(path,{method='GET',body}={}){
  const response=await fetchImpl('https://gate.chip-in.asia/api/v1'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Cache-Control':'no-store'},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await response.json();}catch{throw fail('CHIP returned an invalid response.',502);}
  if(!response.ok)throw fail('CHIP request failed. Please try again later.',response.status===429?429:502);
  return data;
 }
 function checkoutAllowed(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='gate.chip-in.asia'&&!u.username&&!u.password&&!u.port;}catch{return false;}}
 function samePurchase(p,order){return UUID.test(order.chipPurchaseId||'')&&p.id===order.chipPurchaseId&&p.brand_id===brandId&&p.reference===order.orderId&&p.is_test===testMode&&p.purchase?.currency==='MYR'&&Number.isSafeInteger(p.purchase?.total)&&p.purchase.total===order.amountSen;}
 async function methods(amountSen=1000){const data=await request('/payment_methods/?'+new URLSearchParams({brand_id:brandId,currency:'MYR',amount:String(amountSen),language:'en'}));return Array.isArray(data.available_payment_methods)?data.available_payment_methods.filter(m=>typeof m==='string'):[];}
 async function create({orderId,amountSen,productName,section,email,name='',successUrl,cancelUrl,callbackUrl,due}){
  // Caller must resolve amount/product/account on the trusted server and persist
  // the local creating order before calling this method. POST is not retried.
  if(!orderId||orderId.length>128||!Number.isSafeInteger(amountSen)||amountSen<=0||!/^\S+@\S+\.\S+$/.test(email||'')||!productName)throw fail('Invalid trusted purchase.');
  for(const value of [successUrl,cancelUrl,callbackUrl]){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw fail('Invalid callback or return URL.');}
  const available=await methods(amountSen);if(!available.length)throw fail('CHIP payment methods are not available yet.',503);
  const p=await request('/purchases/',{method:'POST',body:{brand_id:brandId,reference:orderId,client:{email,full_name:name.slice(0,128)},purchase:{currency:'MYR',language:'en',...(due ? {due,due_strict:true} : {}),products:[{name:[section,productName].filter(Boolean).join(' — ').slice(0,256),price:amountSen,quantity:1}]},success_redirect:successUrl,failure_redirect:cancelUrl,cancel_redirect:cancelUrl,success_callback:callbackUrl,...(testMode ? {send_receipt:false} : {})}});
  if(!UUID.test(p.id||'')||!checkoutAllowed(p.checkout_url)||!samePurchase(p,{orderId,amountSen,chipPurchaseId:p.id}))throw fail('CHIP purchase identity or amount did not match.',502);
  return {purchaseId:p.id,paymentUrl:p.checkout_url};
 }
 async function verify(order){
  if(!UUID.test(order?.chipPurchaseId||'')||!Number.isSafeInteger(order.amountSen)||order.amountSen<=0)return {paid:false,reason:'missing_purchase'};
  // Neither browser return values nor callback body mark an order paid.
  const p=await request('/purchases/'+encodeURIComponent(order.chipPurchaseId)+'/');
  if(!samePurchase(p,order))return {paid:false,reason:'purchase_mismatch'};
  if(p.status!=='paid')return {paid:false,reason:'not_paid'};
  if(!p.payment||p.payment.is_outgoing!==false||p.payment.currency!=='MYR'||p.payment.amount!==order.amountSen)return {paid:false,reason:'payment_mismatch'};
  return {paid:true,paymentReference:p.id,verificationSource:'chip-api',feeSen:Number.isSafeInteger(p.payment.fee_amount)?p.payment.fee_amount:null};
 }
 return {methods,create,verify,checkoutAllowed};
}
module.exports={createChipAdapter,CHIP_SECTIONS};
