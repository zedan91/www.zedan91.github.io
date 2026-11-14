(function(){
'use strict';
const stage=document.getElementById('azCheckoutStage');
const hub=window.AZOBSSCustomerHub1538;
if(!stage||!hub)return;
const params=new URL(location.href).searchParams;
const order=params.get('order')||'';
const documentKind=params.get('document')==='invoice'?'invoice':'quote';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'}).format(value);
const price=value=>Number(String(value??'').replace(/[^0-9.]/g,''))||0;
const owner=()=>String(window.azobssGetCurrentFirebaseUid?.()||'');
let currentOrderOwner=null,authReady=false;
function showOrders(){
 if(!owner()){
  currentOrderOwner='';
  stage.innerHTML='<p>Sign in to view your quote or invoice.</p><button type="button" class="az-pc-shop-btn primary" data-auth-open="login">Log in</button> <button type="button" class="az-pc-shop-btn" data-auth-open="register">Register</button>';
  return;
 }
 currentOrderOwner=owner();
 window.azobssOpenPcRequests(order,documentKind);
}
function drawCart(){
 if(order){
  if(!authReady&&!owner())return;
  if(currentOrderOwner!==owner())showOrders();
  return;
 }
 if(stage.querySelector('[data-submit-order],[data-customer-order]'))return;
 const tech=hub.readTech(),digital=hub.readDigital();
 const list=(items,isTech)=>'<ul class="az-checkout-items">'+items.map(item=>{
  const link=hub.productLink(item,isTech),qty=isTech?Math.max(1,Number(item.qty)||1):1;
  const title=esc(item.name||item.productName||'Product');
  return '<li><span>'+(link?'<a href="'+esc(link)+'">'+title+'</a>':title)+' × '+qty+'</span><strong>'+money(price(item.unitPrice??item.price)*qty)+'</strong></li>';
 }).join('')+'</ul>';
 stage.innerHTML=(tech.length?'<section class="az-checkout-section"><h2>Tech Products</h2>'+list(tech,true)+
  '<p>Request a quote first. After AZOBSS confirms the items, you can enter your delivery details or choose pickup. Pay by Maybank QR when your invoice is ready.</p><button type="button" class="az-pc-shop-btn primary" data-checkout-quote>Request Quote</button> <button type="button" class="az-pc-shop-btn" data-checkout-orders>My Requests &amp; Orders</button></section>':'')+
  (digital.length?'<section class="az-checkout-section"><h2>Software &amp; CAD Tools</h2>'+list(digital,false)+'<div class="az-checkout-digital">'+digital.map((item,index)=>'<button type="button" class="az-pc-shop-btn" data-checkout-digital="'+index+'">Checkout '+esc(item.name||item.productName||'item')+'</button>').join('')+'</div></section>':'')+
  (!tech.length&&!digital.length?'<div><p>Your cart is empty. Open My Requests &amp; Orders for a quote or invoice.</p><button type="button" class="az-pc-shop-btn" data-checkout-orders>My Requests &amp; Orders</button></div>':'');
 stage.querySelector('[data-checkout-quote]')?.addEventListener('click',()=>window.azobssPcRequestQuote());
 stage.querySelector('[data-checkout-orders]')?.addEventListener('click',()=>window.azobssOpenPcRequests(''));
 stage.querySelectorAll('[data-checkout-digital]').forEach(button=>button.onclick=()=>hub.checkoutDigital(digital[Number(button.dataset.checkoutDigital)]));
}
window.addEventListener('azobss:auth-state-ready',()=>{authReady=true;drawCart();});
for(const name of ['azobss-pc-list-updated','azobss-shop-cart-updated','azobss:checkout-account-change','storage'])window.addEventListener(name,drawCart);
if(order&&!owner())setTimeout(()=>{if(currentOrderOwner===null){authReady=true;drawCart();}},2500);
drawCart();
})();
