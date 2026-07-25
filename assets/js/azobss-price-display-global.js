import { adjustPriceText, getCachedPriceAdjustment, waitForPriceAdjustment } from './azobss-user-price-adjustment.js?v=591';
import { getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const basePriceByProductId = new Map();
let percent = Number(getCachedPriceAdjustment().percent || 0);
let scheduled = false;

function textPrice(value){ return String(value || '').trim(); }
function storeBase(btn){
  const productId = String(btn.dataset.productId || btn.dataset.id || '').trim();
  let base = textPrice(btn.dataset.basePrice || '');
  if(!base){
    base = textPrice(btn.dataset.productPrice || btn.dataset.price || '');
    if(base) btn.dataset.basePrice = base;
  }
  if(productId && base) basePriceByProductId.set(productId, base);
  return base;
}
function applyButton(btn){
  if(!btn || String(btn.dataset.azobssPremiumBuy || '') !== '1') return;
  const base = storeBase(btn);
  if(!base || /^free$/i.test(base)) return;
  const adjusted = adjustPriceText(base, percent);
  btn.dataset.productPrice = adjusted;
  btn.dataset.priceAdjustmentPercent = String(percent);
  const priceNode = btn.querySelector('.buy-price,.az-sub-plan-price,[data-price-text]');
  if(priceNode && priceNode.textContent !== adjusted) priceNode.textContent = adjusted;
  const card = btn.closest('.software-card,.cad-card,[data-admin-software],[data-admin-cad]');
  if(card){
    const badge = card.querySelector('.cad-badge.premium');
    if(badge && badge.textContent !== '🛒 ' + adjusted) badge.textContent = '🛒 ' + adjusted;
    card.dataset.userPriceAdjustment = String(percent);
  }
}
function applyAll(){
  document.querySelectorAll('[data-azobss-premium-buy="1"]').forEach(applyButton);
  document.querySelectorAll('#azobssPayProduct').forEach(box=>{
    const b=box.querySelector('b');
    if(!b) return;
  });
}
function schedule(){
  if(scheduled) return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;applyAll();});
}
async function authToken(){
  try{
    const apps=getApps(); if(!apps.length) return '';
    const auth=getAuth(apps[0]);
    if(typeof auth.authStateReady==='function') await Promise.race([auth.authStateReady(),new Promise(r=>setTimeout(r,3500))]);
    return auth.currentUser ? await auth.currentUser.getIdToken() : '';
  }catch(_){ return ''; }
}
function installFetchGuard(){
  if(window.__azobssPriceAdjustmentFetchGuard) return;
  window.__azobssPriceAdjustmentFetchGuard=true;
  const original=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=String(typeof input==='string'?input:input?.url||'');
    const cfg={...(init||{})};
    if(/\/api\/(?:toyyib\/create-bill|create-payment)(?:\?|$)/i.test(url) && String(cfg.method||'GET').toUpperCase()==='POST'){
      let bodyObj=null;
      try{ bodyObj=typeof cfg.body==='string'?JSON.parse(cfg.body):null; }catch(_){ }
      if(bodyObj && typeof bodyObj==='object'){
        const product=bodyObj.product&&typeof bodyObj.product==='object'?bodyObj.product:{};
        const productId=String(product.productId||product.id||bodyObj.productId||'').trim();
        const base=basePriceByProductId.get(productId)||textPrice(product.basePrice||bodyObj.basePrice||'');
        if(base){ product.basePrice=base; bodyObj.basePrice=base; }
        product.priceAdjustmentPercent=percent;
        bodyObj.product=product;
        cfg.body=JSON.stringify(bodyObj);
      }
      const token=await authToken();
      if(token){
        const headers=new Headers(cfg.headers||{});
        headers.set('Authorization','Bearer '+token);
        cfg.headers=headers;
      }
    }
    return original(input,cfg);
  };
}

installFetchGuard();
waitForPriceAdjustment().then(state=>{percent=Number(state?.percent||0);applyAll();});
window.addEventListener('azobss:price-adjustment-change',event=>{percent=Number(event.detail?.percent||0);applyAll();});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',applyAll,{once:true}); else applyAll();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
[300,900,1800,3500].forEach(ms=>setTimeout(applyAll,ms));
