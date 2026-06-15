
(function(){
  if(window.__azobssShopCartReady) return; window.__azobssShopCartReady=true;
  const getKey=()=>window.__azobssCurrentCartKey||'azobss_shop_cart_guest_v1';
  const CART_MAX_AGE_MS=60*24*60*60*1000;
const moneyVal=v=>{const n=String(v||'').replace(/,/g,'').match(/[0-9]+(?:\.[0-9]+)?/);return n?Number(n[0]):0;};
  const fmt=n=>'RM'+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const read=()=>{try{return JSON.parse(localStorage.getItem(getKey())||'[]').filter(Boolean)}catch(e){return[]}};
  const save=a=>{localStorage.setItem(getKey(),JSON.stringify(a));window.dispatchEvent(new Event('azobss-shop-cart-updated'));try{updateBadges();render();}catch(e){}};
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function ensurePanel(){let p=document.getElementById('azShopCartPanel'); if(p)return p; p=document.createElement('div'); p.id='azShopCartPanel'; p.className='az-shop-cart-panel'; p.innerHTML='<div class="az-shop-cart-head"><h3>My Cart</h3><button class="az-shop-cart-close" type="button" aria-label="Close cart">×</button></div><div id="azShopCartBody"></div>'; document.body.appendChild(p); return p;}
  
window.__azobssCartClickLock=window.__azobssCartClickLock||new WeakMap();
function lockCartButton(btn){
 try{
   if(!btn) return false;
   if(window.__azobssCartClickLock.get(btn)) return true;
   window.__azobssCartClickLock.set(btn,true);
   setTimeout(()=>window.__azobssCartClickLock.delete(btn),400);
 }catch(e){}
 return false;
}
function updateBadges(){const total=read().reduce((s,i)=>s+Number(i.qty||1),0); document.querySelectorAll('[data-az-shop-cart-badge]').forEach(b=>{b.textContent=total; b.classList.toggle('is-show',total>0);});}
  function render(){const p=ensurePanel(), body=p.querySelector('#azShopCartBody'), items=read(); const totalQty=items.reduce((s,i)=>s+Number(i.qty||1),0); p.querySelector('h3').textContent='My Cart ('+totalQty+')'; if(!items.length){body.innerHTML='<div class="az-shop-cart-empty">Cart kosong.<br><small>Cart ini hanya untuk Software dan CAD Tools.</small></div>'; updateBadges(); return;} const total=items.reduce((s,i)=>s+moneyVal(i.price)*Number(i.qty||1),0); body.innerHTML=items.map((i,idx)=>`<div class="az-shop-cart-item"><div class="az-shop-cart-thumb">${i.image?`<img src="${esc(i.image)}" alt="" style="width:100%;height:100%;object-fit:cover">`:esc((i.name||'?').slice(0,1))}</div><div><div class="az-shop-cart-title">${esc(i.name)}</div><div class="az-shop-cart-meta">${esc(i.category||i.source||'Software/CAD Tools')}</div><div class="az-shop-cart-price">${esc(i.price||'RM0')}</div></div><div class="az-shop-cart-actions"><span class="az-shop-cart-qty"><button type="button" data-az-cart-minus="${idx}">−</button><span>${Number(i.qty||1)}</span><button type="button" data-az-cart-plus="${idx}">+</button></span><button type="button" class="az-shop-cart-remove" data-az-cart-remove="${idx}" title="Remove">🗑</button></div></div>`).join('')+`<div class="az-shop-cart-total"><span>Total</span><strong>${fmt(total)}</strong></div><button class="az-shop-cart-checkout" type="button" data-az-cart-checkout>Go to Cart Checkout</button><div class="az-shop-cart-note">Nota: Cart ini hanya untuk Software dan CAD Tools. Ia tidak berkaitan dengan PA/BM cart.</div>`; updateBadges();}
  function openPanel(){render(); ensurePanel().classList.add('is-open');}
  function closePanel(){ensurePanel().classList.remove('is-open');}
  function add(item){const items=read().slice(0,100); const id=String(item.id||item.name||Date.now()); const src=String(item.source||''); const found=items.find(x=>String(x.id)===id && String(x.source||'')===src); if(found) found.qty=Number(found.qty||1)+1; else { if(items.length>=100){ if(window.azShowToast) window.azShowToast('Cart limit reached: maximum 100 items.'); else alert('Cart limit reached: maximum 100 items.'); return; } items.push({...item,id,source:src,qty:1,addedAt:Date.now()}); } save(items.slice(0,100)); render(); updateBadges(); openPanel(); setTimeout(()=>{render();updateBadges();window.dispatchEvent(new Event('azobss-shop-cart-updated'));},60);}
  window.azobssAddShopCart=add; window.azobssOpenShopCart=openPanel; window.azobssShopCartItems=read; window.azobssRefreshShopCart=function(){try{render();updateBadges();}catch(e){}};
  document.addEventListener('click',function(e){
    const toggle=e.target.closest('[data-az-shop-cart-toggle]'); if(toggle){e.preventDefault(); const p=ensurePanel(); p.classList.contains('is-open')?closePanel():openPanel(); return;}
    if(e.target.closest('.az-shop-cart-close')){closePanel();return;}
    const rem=e.target.closest('[data-az-cart-remove]'); if(rem){const a=read(); a.splice(Number(rem.dataset.azCartRemove),1); save(a); render(); return;}
    const plus=e.target.closest('[data-az-cart-plus]'); if(plus){const a=read(); const i=a[Number(plus.dataset.azCartPlus)]; if(i)i.qty=Number(i.qty||1)+1; save(a); render(); return;}
    const minus=e.target.closest('[data-az-cart-minus]'); if(minus){const a=read(); const i=a[Number(minus.dataset.azCartMinus)]; if(i){i.qty=Number(i.qty||1)-1; if(i.qty<=0)a.splice(Number(minus.dataset.azCartMinus),1);} save(a); render(); return;}
    if(e.target.closest('[data-az-cart-checkout]')){
const items=read();
if(!items.length)return;
const totalAmount=items.reduce((s,i)=>s+((parseFloat(String(i.price||0).replace(/[^0-9.]/g,''))||0)*Number(i.qty||1)),0);
const totalQty=items.reduce((s,i)=>s+Number(i.qty||1),0);
const firstItem=items[0]||{};
const checkoutItem={
id:'CART-CHECKOUT',
name:`${totalQty} Item(s)`,
price:`RM${totalAmount.toFixed(2)}`,
qty:totalQty,
cartItems:items,
isCartCheckout:true,
downloadLink:firstItem.downloadLink||firstItem.secureDownloadLink||firstItem.premiumDownloadFileLink||'',
secureDownloadLink:firstItem.secureDownloadLink||firstItem.downloadLink||firstItem.premiumDownloadFileLink||'',
premiumDownloadFileLink:firstItem.premiumDownloadFileLink||firstItem.secureDownloadLink||firstItem.downloadLink||''
};
if(typeof window.azobssOpenPremiumPay==='function'){window.azobssOpenPremiumPay(checkoutItem); closePanel();}
else if(items[0].pageUrl){location.href=items[0].pageUrl;}
else {alert('Buka page Software Tools atau CAD Tools untuk checkout item ini.');}
return;
}
  });
  // AZOBSS fix: Buy Now is no longer hijacked by cart. Only .az-card-cart-btn adds items to this cart.
  window.addEventListener('azobss-shop-cart-updated',updateBadges); document.addEventListener('DOMContentLoaded',()=>{ensurePanel();render();updateBadges();}); if(document.readyState!=='loading'){ensurePanel();render();updateBadges();}
})();
