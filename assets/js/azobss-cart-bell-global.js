// AZOBSS global cart + notification dropdown for pages that use fallback stickybar (admin/staff/etc)
(function(){
  if(window.__azobssCartBellGlobalBoot) return;
  window.__azobssCartBellGlobalBoot = true;

  const css = `
.market-icon-btn{position:relative!important;}
.az-shop-cart-badge{position:absolute!important;right:-7px!important;top:-8px!important;min-width:18px!important;height:18px!important;padding:0 5px!important;border-radius:999px!important;background:#ef4444!important;color:#fff!important;font-size:11px!important;font-weight:900!important;line-height:18px!important;text-align:center!important;box-shadow:0 0 0 2px rgba(2,6,23,.95)!important;display:none!important;}
.az-shop-cart-badge.is-show{display:inline-block!important;}
.az-shop-cart-panel,.az-bell-panel{position:fixed!important;top:78px!important;right:18px!important;width:min(410px,calc(100vw - 28px))!important;max-height:72vh!important;overflow:auto!important;background:rgba(7,12,20,.98)!important;border:1px solid rgba(148,163,184,.35)!important;border-radius:18px!important;box-shadow:0 22px 60px rgba(0,0,0,.45)!important;z-index:9999999!important;color:#fff!important;padding:15px!important;display:none!important;backdrop-filter:blur(14px)!important;box-sizing:border-box!important;}
.az-shop-cart-panel.is-open,.az-bell-panel.is-open{display:block!important;}
.az-shop-cart-head,.az-bell-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;margin-bottom:12px!important;padding-bottom:10px!important;border-bottom:1px solid rgba(148,163,184,.18)!important;}
.az-shop-cart-head h3,.az-bell-head h3{margin:0!important;font-size:18px!important;font-weight:950!important;}
.az-shop-cart-close,.az-bell-close{border:0!important;background:rgba(255,255,255,.08)!important;color:#fff!important;width:32px!important;height:32px!important;border-radius:999px!important;font-size:20px!important;cursor:pointer!important;}
.az-shop-cart-empty,.az-bell-empty{color:#cbd5e1!important;padding:14px!important;border:1px dashed rgba(148,163,184,.35)!important;border-radius:12px!important;text-align:center!important;}
.az-shop-cart-item{display:grid!important;grid-template-columns:54px 1fr auto!important;gap:12px!important;align-items:center!important;padding:12px 0!important;border-bottom:1px solid rgba(148,163,184,.25)!important;}
.az-shop-cart-thumb{width:54px!important;height:54px!important;border-radius:10px!important;background:#fff!important;object-fit:cover!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#0f172a!important;font-weight:900!important;overflow:hidden!important;}
.az-shop-cart-title{font-weight:900!important;line-height:1.2!important;margin-bottom:3px!important;}
.az-shop-cart-meta{font-size:12px!important;color:#94a3b8!important;}
.az-shop-cart-price{font-size:13px!important;color:#4ade80!important;font-weight:900!important;margin-top:4px!important;}
.az-shop-cart-actions{display:flex!important;align-items:center!important;gap:6px!important;}
.az-shop-cart-qty{display:inline-flex!important;align-items:center!important;border:1px solid rgba(148,163,184,.35)!important;border-radius:9px!important;overflow:hidden!important;height:32px!important;}
.az-shop-cart-qty button,.az-shop-cart-remove{border:0!important;background:rgba(255,255,255,.08)!important;color:#fff!important;height:32px!important;min-width:30px!important;cursor:pointer!important;font-weight:900!important;}
.az-shop-cart-qty span{min-width:28px!important;text-align:center!important;font-weight:800!important;}
.az-shop-cart-remove{border-radius:9px!important;color:#fecaca!important;font-size:16px!important;}
.az-shop-cart-total{display:flex!important;justify-content:space-between!important;align-items:center!important;font-size:18px!important;font-weight:950!important;margin:14px 0 12px!important;}
.az-shop-cart-total strong{color:#4ade80!important;}
.az-shop-cart-checkout{width:100%!important;border:0!important;border-radius:12px!important;background:linear-gradient(135deg,#2563eb,#0ea5e9)!important;color:#fff!important;font-weight:950!important;padding:12px 14px!important;cursor:pointer!important;font-size:15px!important;}
.az-shop-cart-note,.az-bell-meta{font-size:12px!important;color:#94a3b8!important;margin-top:7px!important;line-height:1.45!important;}
.az-bell-item{border:1px solid rgba(148,163,184,.22)!important;background:rgba(15,23,42,.72)!important;border-radius:14px!important;padding:11px!important;margin:8px 0!important;}
.az-bell-item strong{display:block!important;margin-bottom:5px!important;color:#fff!important;}
.az-bell-item div{color:#dbeafe!important;line-height:1.35!important;}
.az-bell-badge{position:absolute!important;right:-6px!important;top:-7px!important;min-width:18px!important;height:18px!important;padding:0 5px!important;border-radius:999px!important;background:#ef4444!important;color:#fff!important;font-size:11px!important;font-weight:900!important;line-height:18px!important;text-align:center!important;display:none!important;box-shadow:0 0 0 2px rgba(2,6,23,.95)!important;}

/* AZOBSS PATCH 421: Software/CAD cart is one quantity per item */
.az-shop-cart-qty button[disabled]{
  opacity:.42!important;
  cursor:not-allowed!important;
  filter:grayscale(1)!important;
}

@media(max-width:760px){.az-shop-cart-panel,.az-bell-panel{top:66px!important;right:10px!important;width:calc(100vw - 20px)!important;max-height:78vh!important;border-radius:16px!important;padding:14px!important}.az-shop-cart-item{grid-template-columns:46px 1fr!important}.az-shop-cart-thumb{width:46px!important;height:46px!important}.az-shop-cart-actions{grid-column:2!important;justify-content:flex-start!important}}
`;
  function addCss(){ if(document.getElementById('azobss-cart-bell-global-css')) return; const s=document.createElement('style'); s.id='azobss-cart-bell-global-css'; s.textContent=css; document.head.appendChild(s); }
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function moneyVal(v){const m=String(v||'').replace(/,/g,'').match(/[0-9]+(?:\.[0-9]+)?/); return m?Number(m[0]):0;}
  function fmt(n){return 'RM'+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
  function cartKey(){return window.__azobssCurrentCartKey || 'azobss_shop_cart_guest_v1';}
  function readCart(){try{return JSON.parse(localStorage.getItem(cartKey())||'[]').filter(Boolean).map(i=>({...i,qty:1}));}catch(e){return[];}}
  function saveCart(a){localStorage.setItem(cartKey(),JSON.stringify((Array.isArray(a)?a:[]).filter(Boolean).map(i=>({...i,qty:1})))); window.dispatchEvent(new Event('azobss-shop-cart-updated')); renderCart(); updateCartBadge();}
  function ensureCart(){let p=document.getElementById('azShopCartPanel'); if(p) return p; p=document.createElement('div'); p.id='azShopCartPanel'; p.className='az-shop-cart-panel'; p.innerHTML='<div class="az-shop-cart-head"><h3>My Cart</h3><button class="az-shop-cart-close" type="button" aria-label="Close cart">×</button></div><div id="azShopCartBody"></div>'; document.body.appendChild(p); return p;}
  function updateCartBadge(){const n=readCart().length; document.querySelectorAll('[data-az-shop-cart-badge],.az-shop-cart-badge').forEach(b=>{b.textContent=String(n); b.classList.toggle('is-show',n>0); b.style.display=n>0?'inline-block':'none';});}
  function renderCart(){const p=ensureCart(), body=p.querySelector('#azShopCartBody'), items=readCart(); const qty=items.length; p.querySelector('h3').textContent='My Cart ('+qty+')'; if(!items.length){body.innerHTML='<div class="az-shop-cart-empty">Cart is empty.<br><small>This cart is for Software and CAD Tools.</small></div>'; return;} const total=items.reduce((s,i)=>s+moneyVal(i.price),0); body.innerHTML=items.map((i,idx)=>'<div class="az-shop-cart-item"><div class="az-shop-cart-thumb">'+(i.image?'<img src="'+esc(i.image)+'" alt="" style="width:100%;height:100%;object-fit:cover">':esc((i.name||'?').slice(0,1)))+'</div><div><div class="az-shop-cart-title">'+esc(i.name||'Item')+'</div><div class="az-shop-cart-meta">'+esc(i.category||i.source||'Software/CAD Tools')+'</div><div class="az-shop-cart-price">'+esc(i.price||'RM0')+'</div></div><div class="az-shop-cart-actions"><span class="az-shop-cart-qty"><button type="button" data-az-cart-minus="'+idx+'">−</button><span>'+Number(i.qty||1)+'</span><button type="button" data-az-cart-plus="'+idx+'">+</button></span><button type="button" class="az-shop-cart-remove" data-az-cart-remove="'+idx+'" title="Remove">🗑</button></div></div>').join('')+'<div class="az-shop-cart-total"><span>Total</span><strong>'+fmt(total)+'</strong></div><button class="az-shop-cart-checkout" type="button" data-az-cart-checkout>Go to Cart Checkout</button><div class="az-shop-cart-note">Note: buka Software/CAD page untuk checkout payment penuh jika diperlukan.</div>';}
  function toggleCart(){const p=ensureCart(); renderCart(); updateCartBadge(); p.classList.toggle('is-open'); closeBell();}
  window.azobssOpenShopCart=function(){const p=ensureCart(); renderCart(); updateCartBadge(); p.classList.add('is-open'); closeBell();};
  window.azShopOpenCart=window.azobssOpenShopCart; window.azShopCartToggle=toggleCart; window.azobssRefreshShopCart=function(){renderCart();updateCartBadge();};

  function ensureBell(){let p=document.getElementById('azBellPanel'); if(p) return p; p=document.createElement('div'); p.id='azBellPanel'; p.className='az-bell-panel'; p.innerHTML='<div class="az-bell-head"><h3>🔔 Notifications</h3><button class="az-bell-close" type="button" aria-label="Close notifications">×</button></div><div id="azBellBody"><div class="az-bell-empty">Loading notifications...</div></div>'; document.body.appendChild(p); return p;}
  function closeBell(){const p=document.getElementById('azBellPanel'); if(p) p.classList.remove('is-open');}
  function getBellBtn(){return document.querySelector('a[aria-label="Notifications"],button[aria-label="Notifications"],[title="Notifications"]');}
  function ensureBellBadge(){const bell=getBellBtn(); if(!bell) return null; let b=bell.querySelector('#azBellUnreadBadge'); if(!b){b=document.createElement('span'); b.id='azBellUnreadBadge'; b.className='az-bell-badge'; bell.appendChild(b);} return b;}
  function renderNotifs(rows, err){const body=ensureBell().querySelector('#azBellBody'); if(err){body.innerHTML='<div class="az-bell-empty">Unable to load notifications:<br>'+esc(err)+'</div>'; return;} if(!rows || !rows.length){body.innerHTML='<div class="az-bell-empty">No notifications available.</div>'; return;} body.innerHTML=rows.slice(0,30).map(x=>'<div class="az-bell-item"><strong>'+esc(x.title||'Notification')+'</strong><div>'+esc(x.body||'')+'</div><div class="az-bell-meta">'+esc(x.type||'system')+'</div></div>').join('');}
  async function loadNotifications(){renderNotifs([]); try{ if(!window.__azFirebaseDb){renderNotifs(JSON.parse(localStorage.getItem('azobss_notifications_cache')||'[]')); return;} const f=window.__azFirestoreFns; let snap; try{snap=await f.getDocs(f.query(f.collection(window.__azFirebaseDb,'notifications'),f.where('active','==',true),f.orderBy('createdAtMs','desc'),f.limit(30)));}catch(e){snap=await f.getDocs(f.collection(window.__azFirebaseDb,'notifications'));} const rows=[]; snap.forEach(d=>{const x=d.data()||{}; if(x.active===false) return; rows.push(x);}); rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0)); localStorage.setItem('azobss_notifications_cache',JSON.stringify(rows.slice(0,30))); renderNotifs(rows); localStorage.setItem('azobss_notifications_seen_at_v2',String(Date.now())); updateBellBadge(rows); }catch(e){renderNotifs(null,e.message||e.code||String(e));}}
  function toggleBell(){const p=ensureBell(); p.classList.toggle('is-open'); ensureCart().classList.remove('is-open'); if(p.classList.contains('is-open')) loadNotifications();}
  function updateBellBadge(rows){try{const b=ensureBellBadge(); if(!b) return; rows=rows||JSON.parse(localStorage.getItem('azobss_notifications_cache')||'[]'); const seen=Number(localStorage.getItem('azobss_notifications_seen_at_v2')||0); const n=rows.filter(x=>Number(x.createdAtMs||0)>seen).length; b.textContent=String(n); b.style.display=n>0?'inline-block':'none';}catch(e){}}

  function bind(){
    addCss(); ensureCart(); ensureBell(); updateCartBadge(); updateBellBadge();
    document.querySelectorAll('a[aria-label="Notifications"]').forEach(a=>{a.setAttribute('href','#'); a.title='Notifications';});
    document.addEventListener('click',function(e){
      const cart=e.target.closest('[data-az-shop-cart-toggle],a[aria-label="Cart"]');
      if(cart){e.preventDefault(); e.stopImmediatePropagation(); toggleCart(); return;}
      const bell=e.target.closest('a[aria-label="Notifications"],button[aria-label="Notifications"],[title="Notifications"]');
      if(bell){e.preventDefault(); e.stopImmediatePropagation(); toggleBell(); return;}
      if(e.target.closest('.az-shop-cart-close')){ensureCart().classList.remove('is-open'); return;}
      if(e.target.closest('.az-bell-close')){closeBell(); return;}
      const rem=e.target.closest('[data-az-cart-remove]'); if(rem){const a=readCart(); a.splice(Number(rem.dataset.azCartRemove),1); saveCart(a); return;}
      const plus=e.target.closest('[data-az-cart-plus]'); if(plus){const a=readCart(); const i=a[Number(plus.dataset.azCartPlus)]; if(i)i.qty=1; saveCart(a); if(window.azShowToast) window.azShowToast('Maximum 1 quantity per item.'); return;}
      const minus=e.target.closest('[data-az-cart-minus]'); if(minus){const a=readCart(); const i=a[Number(minus.dataset.azCartMinus)]; if(i){a.splice(Number(minus.dataset.azCartMinus),1);} saveCart(a); return;}
      if(e.target.closest('[data-az-cart-checkout]')){const items=readCart(); if(items[0]?.pageUrl) location.href=items[0].pageUrl; else return false; return;}
    }, true);
    window.addEventListener('storage',()=>{updateCartBadge();updateBellBadge();});
    window.addEventListener('azobss-shop-cart-updated',()=>{renderCart();updateCartBadge();});
    setInterval(updateCartBadge,1500);
  }
  document.addEventListener('DOMContentLoaded',bind); if(document.readyState!=='loading') bind();
})();

(async function(){
  if(window.__azobssCartBellFirebaseBoot) return;
  window.__azobssCartBellFirebaseBoot = true;
  try{
    const appMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js');
    const fsMod = await import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js');
    const cfg={apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',authDomain:'azobss.firebaseapp.com',projectId:'azobss',storageBucket:'azobss.firebasestorage.app',messagingSenderId:'159277716405',appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'};
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(cfg);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);
    window.__azFirebaseDb = db;
    window.__azFirestoreFns = {collection:fsMod.collection,query:fsMod.query,where:fsMod.where,orderBy:fsMod.orderBy,limit:fsMod.limit,getDocs:fsMod.getDocs};
    authMod.onAuthStateChanged(auth, function(user){
      const oldKey=window.__azobssCurrentCartKey||'azobss_shop_cart_guest_v1';
      window.__azobssCurrentCartKey = user ? ('azobss_shop_cart_user_'+user.uid+'_v1') : 'azobss_shop_cart_guest_v1';
      try{
        if(user && oldKey==='azobss_shop_cart_guest_v1'){
          const guest=JSON.parse(localStorage.getItem(oldKey)||'[]');
          const userItems=JSON.parse(localStorage.getItem(window.__azobssCurrentCartKey)||'[]');
          if(guest.length && !userItems.length) localStorage.setItem(window.__azobssCurrentCartKey, JSON.stringify(guest));
        }
      }catch(e){}
      if(window.azobssRefreshShopCart) window.azobssRefreshShopCart();
    });
    setTimeout(async()=>{try{
      const snap=await fsMod.getDocs(fsMod.query(fsMod.collection(db,'notifications'),fsMod.where('active','==',true),fsMod.orderBy('createdAtMs','desc'),fsMod.limit(30)));
      const rows=[]; snap.forEach(d=>rows.push(d.data()||{}));
      localStorage.setItem('azobss_notifications_cache',JSON.stringify(rows));
      const b=document.querySelector('#azBellUnreadBadge'); if(b){const seen=Number(localStorage.getItem('azobss_notifications_seen_at_v2')||0); const n=rows.filter(x=>Number(x.createdAtMs||0)>seen).length; b.textContent=String(n); b.style.display=n>0?'inline-block':'none';}
    }catch(e){}},1200);
  }catch(e){ console.warn('AZOBSS cart/bell Firebase init skipped:', e); }
})();
