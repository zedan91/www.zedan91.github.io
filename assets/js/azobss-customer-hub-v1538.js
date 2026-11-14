(function(){
'use strict';if(window.AZOBSSCustomerHub1538)return;
const API='https://azobss-backend.onrender.com',LEGACY='azobss_pc_hardware_cart_v1473',GUEST='azobss_pc_list_guest_v1538';
const CART_URL='/cart/';
const CART_TOGGLE='header [data-az-shop-cart-toggle],header [aria-label="Cart"],header [data-action="cart"],header #cartBtn,header #cartBtnGlobal,header #btnCartGlobal';
let cartPreview=null,previewTrigger=null,previewKey='',renderedCart='',previewCloseTimer;
let uid=null,authSettled=false,generation=0,notices=[],unread=0,partial=false,error='',loading=false,backfilled=false,abort=null,lastFetch=0,bypass=false,lastFocus=null,generalAllowed=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'RM'+Number(v||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const amount=v=>Number(String(v||0).replace(/[^0-9.]/g,''))||0;
function read(key){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a.filter(x=>x&&typeof x==='object'):[];}catch{return [];}}
function write(key,items){localStorage.setItem(key,JSON.stringify(items));}
const techKey=()=>uid?'azobss_pc_list_user_'+uid+'_v1538':GUEST,digitalKey=()=>uid?'azobss_shop_cart_user_'+uid+'_v1':'azobss_shop_cart_guest_v1';
const itemKey=p=>String(p.source||'')+'::'+String(p.productId||p.id||p.name||'');
function mergeTech(a,b){const result=new Map();for(const p of [...a,...b]){const id=String(p.productId||p.id||'');if(id&&!result.has(id))result.set(id,p);}return [...result.values()].slice(0,40);}
function syncIdentity(){let next=null;try{const actual=window.azobssGetCurrentFirebaseUid?.();if(actual)next=String(actual);else if(authSettled)next='';}catch{}if(next===null||next===uid)return;const previous=uid;uid=next;generation++;abort?.abort();notices=[];unread=0;partial=false;error='';loading=false;backfilled=false;lastFetch=0;window.__azobssCurrentCartKey=digitalKey();document.querySelectorAll('header #azBellUnreadBadge,header .az-bell-badge').forEach(b=>b.style.display='none');
 try{const owner=localStorage.getItem('azobss_pc_legacy_owner_v1538');if(owner===null){const original=read(LEGACY);write(techKey(),mergeTech(read(techKey()),original));localStorage.setItem('azobss_pc_legacy_owner_v1538',uid||'guest');localStorage.removeItem(LEGACY);}if(uid&&(previous===null||previous==='')){const guest=read(GUEST);if(guest.length){write(techKey(),mergeTech(read(techKey()),guest));write(GUEST,[]);}}}catch{}
 update();if(uid)refreshNotices();
}
function readTech(){syncIdentity();return read(techKey());}
function saveTech(items){syncIdentity();write(techKey(),items.slice(0,40));window.dispatchEvent(new Event('azobss-pc-list-updated'));update();}
function readDigital(){syncIdentity();const now=Date.now();return read(digitalKey()).filter(p=>!p.addedAt||now-Number(p.addedAt)<60*86400000).map(p=>({...p,qty:1}));}
function saveDigital(items){write(digitalKey(),items);window.dispatchEvent(new Event('azobss-shop-cart-updated'));update();}
function picture(url){const s=String(url||'');return /^(?:https:\/\/|\/(?!\/))/.test(s)?s:'';}
function panel(kind){let el=document.getElementById('azCustomer'+kind+'1538');if(el)return el;el=document.createElement('section');el.id='azCustomer'+kind+'1538';el.className='az-customer-panel1538';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-labelledby',el.id+'Title');el.innerHTML='<div class="az-hub-head1538"><h2 id="'+el.id+'Title">'+'Notifications'+'</h2><button type="button" data-hub-close aria-label="Close">×</button></div><div data-hub-body></div>';document.body.append(el);el.addEventListener('click',handlePanel);return el;}
function close(){generalAllowed=false;const wasOpen=!!document.querySelector('.az-customer-panel1538:not([hidden])');for(const el of document.querySelectorAll('.az-customer-panel1538'))el.hidden=true;document.querySelectorAll('.az-bell-panel,#azBellModal').forEach(el=>el.classList.remove('is-open','open'));if(wasOpen){try{lastFocus?.focus({preventScroll:true});}catch{}lastFocus=null;}}
function position(el){const header=document.querySelector('header.market-sticky-bar,#marketHomeTopbar,header'),bottom=header?header.getBoundingClientRect().bottom:64;el.style.top=Math.max(8,Math.min(innerHeight-160,bottom+8))+'px';el.style.maxHeight=Math.max(120,innerHeight-parseFloat(el.style.top)-12)+'px';}
function showBell(){
 if(!document.body)return;
 hidePreview();
 const el=panel('Bell'),wasOpen=!el.hidden;
 close();
 document.querySelectorAll('.az-shop-cart-panel,.az-bell-panel,#azBellModal').forEach(e=>e.classList.remove('is-open'));
 if(wasOpen)return;
 lastFocus=document.activeElement;renderBell();el.style.removeProperty('pointer-events');delete el.dataset.azobssOrphanOverlayRecovered;
 el.hidden=false;position(el);el.querySelector('[data-hub-close]').focus();refreshNotices(true);
}
const itemName=p=>p.name||p.productName||'Product';
const techPrice=p=>amount(p.unitPrice??p.price);
const quantity=p=>Math.max(1,Number(p.qty)||1);
const techId=p=>String(p.productId||p.id||'');
function safeImage(p){
 const source=p.image||p.imageUrl||'';
 return picture(source)||(/^\.\//.test(source)?picture('/'+source.slice(2)):'')||'/assets/images/pc-product-unavailable.svg';
}
function productImage(p,css){
 return '<img class="'+css+'" src="'+esc(safeImage(p))+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
}
function recoverProductImage(event){
 const image=event.target;
 if(image.matches?.('img')&&!image.src.endsWith('/assets/images/pc-product-unavailable.svg'))image.src='/assets/images/pc-product-unavailable.svg';
}
function goCart(){
 if(!/^\/cart\/?$/i.test(location.pathname))location.href=CART_URL;
 else {hidePreview();document.getElementById('azCartTitle')?.focus({preventScroll:true});window.scrollTo(0,0);}
}
function productLink(p,isTech){
 const id=isTech?techId(p):String(p.productId||p.id||p.sku||'');
 if(!id)return '';
 if(isTech)return window.AZOBSSPcModel?.productUrl(p)||'/PC-Build/?section=all&model='+encodeURIComponent(id);
 const route=/cad/i.test(p.source||p.category||'')?'/CAD-Tools-&-Resources/':'/Software-Tools/';
 return route+'?p='+encodeURIComponent(id);
}
function cancelPreviewClose(){clearTimeout(previewCloseTimer);}
function deferPreviewClose(){
 cancelPreviewClose();
 previewCloseTimer=setTimeout(()=>{if(!cartPreview?.matches(':hover,:focus-within')&&!previewTrigger?.matches(':hover'))hidePreview();},240);
}
function hidePreview(){
 cancelPreviewClose();
 if(cartPreview)cartPreview.hidden=true;
 previewTrigger=null;
}
function renderPreview(digital,tech){
 if(!cartPreview||cartPreview.hidden)return;
 const items=[...digital.map(p=>({p,link:productLink(p,false),price:money(amount(p.price))})),...tech.map(p=>({p,link:productLink(p,true),price:techPrice(p)?money(techPrice(p)):'Request quote'}))];
 const key=JSON.stringify(items.map(({p,link,price})=>[itemName(p),safeImage(p),link,price]));
 if(key===previewKey)return;
 previewKey=key;
 const rows=items.map(({p,link,price})=>{
  const content=productImage(p,'az-hub-thumb1538')+'<strong>'+esc(itemName(p))+'</strong><span>'+price+'</span>';
  return link?'<a class="az-cart-preview-item" href="'+esc(link)+'">'+content+'</a>':'<div class="az-cart-preview-item">'+content+'</div>';
 }).join('');
 cartPreview.innerHTML=(rows?'<div class="az-cart-preview-items">'+rows+'</div>':'<p>Your cart is empty.</p>')+
  '<div class="az-cart-preview-actions"><a href="/cart/">View Cart</a>'+(items.length?'<a href="/checkout/">Checkout</a>':'')+'</div>';
}
function showPreview(trigger){
 if(document.querySelector('.az-customer-panel1538:not([hidden])'))return;
 syncIdentity();
 if(!cartPreview){
  cartPreview=document.createElement('div');cartPreview.id='azCartPreview';cartPreview.className='az-cart-preview';cartPreview.hidden=true;
  cartPreview.setAttribute('role','region');cartPreview.setAttribute('aria-label','My Cart preview');
  cartPreview.addEventListener('error',recoverProductImage,true);
  cartPreview.addEventListener('pointerenter',cancelPreviewClose);
  cartPreview.addEventListener('pointerleave',deferPreviewClose);
  cartPreview.addEventListener('focusout',deferPreviewClose);
  document.body.append(cartPreview);
 }
 cancelPreviewClose();previewTrigger=trigger;cartPreview.hidden=false;
 const rect=trigger.getBoundingClientRect();
 cartPreview.style.right=Math.min(Math.max(12,innerWidth-rect.right),Math.max(12,innerWidth-357))+'px';
 cartPreview.style.top=Math.max(8,rect.bottom+9)+'px';
 renderPreview(readDigital(),readTech());
}
function bindCartToggle(el){
 if(el.tagName==='A'&&el.getAttribute('href')!==CART_URL)el.href=CART_URL;
 if(el.dataset.cartPreviewBound)return;
 el.dataset.cartPreviewBound='true';
 el.setAttribute('aria-label','My Cart');
 el.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')showPreview(el);});
 el.addEventListener('pointerleave',()=>{if(previewTrigger===el)deferPreviewClose();});
 el.addEventListener('keydown',event=>{
  if(event.key!=='ArrowDown')return;
  event.preventDefault();showPreview(el);cartPreview?.querySelector('a')?.focus();
 });
}
function cartRow(p,isTech){
 const id=esc(isTech?techId(p):itemKey(p)),name=esc(itemName(p)),qty=isTech?quantity(p):1;
 const price=isTech?techPrice(p):amount(p.price),linePrice=isTech&&!price?'Request quote':money(price*qty);
 const link=productLink(p,isTech);
 const specs=isTech&&Array.isArray(p.specs)?p.specs.filter(spec=>typeof spec==='string'&&spec.trim()):[];
 const category=esc(isTech?p.category||'Tech Products':p.category||p.source||'Digital product');
 const controls=isTech?'<div class="az-cart-qty" role="group" aria-label="Quantity for '+name+'">'+
   '<button type="button" data-tech-qty="'+id+'" data-delta="-1" '+(qty<=1?'disabled':'')+' aria-label="Decrease quantity">−</button>'+
   '<output aria-label="Quantity">'+qty+'</output>'+
   '<button type="button" data-tech-qty="'+id+'" data-delta="1" '+(qty>=20?'disabled':'')+' aria-label="Increase quantity">+</button></div>':
   '<button type="button" class="az-cart-checkout" data-digital-checkout="'+id+'">Checkout</button>';
 return '<li class="az-cart-row"><div class="az-cart-product">'+productImage(p,'az-cart-image')+
   '<div><div class="az-cart-category">'+category+'</div><h3>'+(link?'<a href="'+esc(link)+'">'+name+'</a>':name)+'</h3>'+
   (isTech&&price?'<p class="az-cart-unit">'+money(price)+' per unit</p>':'')+
   (specs.length?'<ul class="az-cart-specs">'+specs.map(spec=>'<li>'+esc(spec)+'</li>').join('')+'</ul>':'')+
   '</div></div><div class="az-cart-controls">'+controls+'<button type="button" class="az-cart-remove" '+(isTech?'data-tech-remove':'data-digital-remove')+
   '="'+id+'" aria-label="Remove '+name+'">Remove</button></div><strong class="az-cart-price">'+linePrice+'</strong></li>';
}
function renderCart(digital,tech){
 const el=document.getElementById('azCartContents');
 if(!el)return;
 const key=JSON.stringify([digital,tech]);
 if(renderedCart===key)return;
 renderedCart=key;
 const digitalTotal=digital.reduce((sum,p)=>sum+amount(p.price),0);
 const techSubtotal=tech.reduce((sum,p)=>sum+techPrice(p)*quantity(p),0);
 el.innerHTML=(tech.length?'<section class="az-cart-section"><h2>Tech Products</h2><ul class="az-cart-rows">'+
   tech.map(p=>cartRow(p,true)).join('')+'</ul><div class="az-cart-summary"><p>Reference subtotal <strong>'+money(techSubtotal)+'</strong></p>'+
   '<small>Stock, final price and delivery are confirmed in your quote.</small><button type="button" class="az-cart-checkout" data-tech-request>Request Quote</button></div></section>':'')+
  (digital.length?'<section class="az-cart-section"><h2>Software &amp; CAD Tools</h2><ul class="az-cart-rows">'+
   digital.map(p=>cartRow(p,false)).join('')+'</ul><div class="az-cart-summary"><p>Digital subtotal <strong>'+money(digitalTotal)+'</strong></p>'+
   '<small>Checkout is available for each digital item.</small></div></section>':'')+
  (!digital.length&&!tech.length?'<div class="az-cart-empty"><h2>Your cart is empty</h2><a href="/PC-Build/">Browse Tech Products</a><a href="/Software-Tools/">Browse Software</a><a href="/CAD-Tools-&amp;-Resources/">Browse CAD Tools</a></div>':'');
}
function generalUnread(){return Math.max(0,...[...document.querySelectorAll('header #azBellUnreadBadge,header .az-bell-badge')].filter(b=>b.style.display!=='none').map(b=>Number(b.textContent)||0));}
function renderBell(){const el=document.getElementById('azCustomerBell1538');if(!el)return;let content;if(uid===null)content='<p class="az-hub-empty1538">Checking your account…</p>';else if(!uid)content='<p class="az-hub-empty1538">Sign in to see your quote and order updates.</p><a class="az-hub-primary1538" href="/?next='+encodeURIComponent('/PC-Build/?requests=1')+'#login">Sign in</a>';else content=(error?'<p role="status" class="az-hub-error1538">'+esc(error)+'</p>':'')+(loading&&!notices.length?'<p>Loading your updates…</p>':notices.length?notices.map(n=>'<button type="button" class="az-hub-notice1538 '+(!n.readAtMs?'is-unread':'')+'" data-hub-notice="'+esc(n.id)+'"><strong>'+esc(n.kind==='quote'&&n.expiresAtMs<=Date.now()?'Quote expired':n.title)+'</strong><span>'+esc(n.body)+'</span><small>'+esc(new Date(n.atMs).toLocaleString('en-MY'))+' · '+(n.readAtMs?'Notification read':'Unread')+'</small><span class="az-hub-notice-action1541">'+esc(({quote:'View Quote',invoice:'View Invoice',receipt:'View Receipt',tracking:'Track Order'})[n.kind]||'View Order')+' →</span></button>').join(''):error?'':'<p class="az-hub-empty1538">No quote or order updates yet.</p>')+'<button type="button" class="az-hub-action1538" data-hub-refresh>Refresh updates</button>';el.querySelector('[data-hub-body]').innerHTML='<h3 class="az-hub-section-title1538">Quotes & Orders</h3>'+content+'<button type="button" class="az-hub-quotes1538" data-hub-requests>My Requests & Orders ↗</button><button type="button" class="az-hub-general1538" data-hub-general>General announcements'+(generalUnread()?' · '+generalUnread()+' unread':'')+' ↗</button>';}
async function headers(){if(window.AZOBSSCustomerSession1546)return window.AZOBSSCustomerSession1546.headers();const h=await window.azobssGetFirebaseAuthHeaders?.(false);if(h?.Authorization)return h;const token=await window.azobssWaitForFirebaseAuthToken?.(false,12000);if(token)return{Authorization:'Bearer '+token};throw Error('Your account is still loading. Please retry.');}
async function refreshNotices(force=false){syncIdentity();if(!uid||loading||(!force&&Date.now()-lastFetch<15000))return;const ownUid=uid,token=generation;loading=true;lastFetch=Date.now();abort=new AbortController();const controller=abort,timer=setTimeout(()=>controller.abort(),15000);renderBell();try{const h=await headers();if(token!==generation)return;const r=await fetch(API+'/api/pc-shop/notifications'+(!backfilled?'?includeLegacy=1':''),{headers:h,cache:'no-store',signal:controller.signal}),d=await r.json();if(token!==generation||uid!==ownUid)return;if(!r.ok||!d.ok||!Array.isArray(d.items))throw Error(d.message||'Your updates could not be loaded. Please retry.');const records=new Map(notices.map(n=>[n.id,n]));for(const id of d.removedIds||[])records.delete(id);for(const n of d.items)records.set(n.id,n);notices=[...records.values()].sort((a,b)=>Number(!b.readAtMs)-Number(!a.readAtMs)||b.atMs-a.atMs).slice(0,100);unread=Math.max(Number(d.unreadCount)||0,notices.filter(n=>!n.readAtMs).length);partial=d.unreadCountIsLowerBound===true;backfilled=true;error='';}catch(e){if(token===generation)error=e.name==='AbortError'?'Notifications are taking longer to load. Please retry.':e instanceof TypeError||/Failed to fetch|NetworkError|fetch resource/i.test(String(e.message))?'Unable to connect to notifications. Please retry.':e.message||'Your updates could not be loaded. Please retry.';}finally{clearTimeout(timer);if(token===generation){loading=false;update();renderBell();}}}
function badge(button,kind,count){if(!button)return;let b=button.querySelector('[data-hub-count="'+kind+'"]');if(!b){b=document.createElement('span');b.className='az-hub-badge1538';b.dataset.hubCount=kind;button.append(b);}const text=String(count)+(kind==='notice'&&partial?'+':'');if(b.textContent!==text)b.textContent=text;b.hidden=count<=0;button.classList.add('az-hub-owned1538');}
function update(){
 if(!document.body)return;
 const digital=read(digitalKey()).filter(p=>!p.addedAt||Date.now()-Number(p.addedAt)<60*86400000);
 const tech=read(techKey()),count=digital.length+tech.reduce((n,p)=>n+quantity(p),0);
 for(const el of document.querySelectorAll(CART_TOGGLE+',header [aria-label="My Cart"]')){badge(el,'cart',count);bindCartToggle(el);}
 for(const el of document.querySelectorAll('header [aria-label="Notifications"],header [data-az-notification-toggle]'))badge(el,'notice',unread+generalUnread());
 renderCart(digital,tech);renderPreview(digital,tech);
}
function goRequests(id='',kind=''){close();if(id&&kind==='invoice'&&!/^\/checkout\/?$/i.test(location.pathname)){location.href='/checkout/?order='+encodeURIComponent(id)+'&document=invoice';return;}const menu=document.querySelector('#userMenu');if(menu){menu.classList.remove('is-open');menu.setAttribute('aria-expanded','false');}if(/^\/(PC-Build|Upgrade-Parts|cart|checkout)\//i.test(location.pathname)&&window.azobssOpenPcRequests)window.azobssOpenPcRequests(id,kind);else location.href='/PC-Build/?requests=1'+(id?'&order='+encodeURIComponent(id)+(kind?'&document='+encodeURIComponent(kind):''):'');}
function techCheckout(){close();if(window.azobssPcRequestQuote)window.azobssPcRequestQuote();else location.href='/cart/?quote=1';}
async function checkoutDigital(key){const item=readDigital().find(p=>itemKey(p)===key);if(!item)return;if(typeof window.azobssOpenPremiumPay==='function'){close();window.azobssOpenPremiumPay({...item,id:item.productId||item.id||item.sku||'',productId:item.productId||item.id||item.sku||'',sku:item.sku||item.productId||item.id||'',name:item.name||item.productName||'Cart item',productName:item.productName||item.name||'Cart item',qty:1,downloadLink:item.downloadLink||item.secureDownloadLink||item.premiumDownloadFileLink||'',secureDownloadLink:item.secureDownloadLink||item.downloadLink||item.premiumDownloadFileLink||'',premiumDownloadFileLink:item.premiumDownloadFileLink||item.secureDownloadLink||item.downloadLink||'',cartItems:[item],isCartCheckout:true});return;}const target=/cad/i.test(item.source||'')?'/CAD-Tools-&-Resources/':'/Software-Tools/';location.href=target+'?cartItem='+encodeURIComponent(key);}
async function openNotice(id){const n=notices.find(p=>p.id===id);if(!n)return;const token=generation;try{const r=await fetch(API+'/api/pc-shop/notifications/read',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},body:JSON.stringify({items:[{id:n.id,version:n.version}]}),signal:AbortSignal.timeout(8000)}),d=await r.json();if(token!==generation)return;if(r.ok&&d.acknowledged?.includes(n.id)){if(!n.readAtMs)unread=Math.max(0,unread-1);n.readAtMs=Date.now();update();}}catch{}if(token===generation)goRequests(n.orderId,n.kind==='tracking'?'order':n.kind);}
function handlePanel(e){const b=e.target.closest('button');if(!b)return;if(b.matches('[data-hub-close]'))return close();if(b.matches('[data-hub-requests]'))return goRequests();if(b.matches('[data-tech-request]'))return techCheckout();if(b.dataset.digitalCheckout)return checkoutDigital(b.dataset.digitalCheckout);if(b.dataset.digitalRemove)return saveDigital(readDigital().filter(p=>itemKey(p)!==b.dataset.digitalRemove));if(b.dataset.techRemove)return saveTech(readTech().filter(p=>String(p.productId||p.id)!==b.dataset.techRemove));if(b.dataset.techQty){const items=readTech(),p=items.find(p=>String(p.productId||p.id)===b.dataset.techQty);if(p)p.qty=Math.max(1,Math.min(20,(Number(p.qty)||1)+Number(b.dataset.delta)));saveTech(items);
 const replacement=[...document.querySelectorAll('[data-tech-qty]')].find(el=>el.dataset.techQty===b.dataset.techQty&&el.dataset.delta===b.dataset.delta&&!el.disabled)
   ||[...document.querySelectorAll('[data-tech-qty]')].find(el=>el.dataset.techQty===b.dataset.techQty&&!el.disabled);
 replacement?.focus({preventScroll:true});
 return;
 }if(b.dataset.hubNotice){b.disabled=true;return openNotice(b.dataset.hubNotice);}if(b.matches('[data-hub-refresh]'))return refreshNotices(true);if(b.matches('[data-hub-general]')){close();const bell=document.querySelector('header [aria-label="Notifications"]');if(bell){generalAllowed=true;bell.addEventListener('click',e=>e.preventDefault(),{once:true,capture:true});bypass=true;try{bell.click();}finally{bypass=false;}}}}
window.addEventListener('click',e=>{if(bypass||!e.target?.closest)return;const owned=e.target.closest('.az-customer-panel1538');if(owned&&!owned.hidden){if(e.target.closest('button'))e.preventDefault();e.stopImmediatePropagation();handlePanel(e);return;}const account=e.target.closest('[data-hub-account-orders]');if(account){e.preventDefault();e.stopImmediatePropagation();goRequests();return;}if(e.target.closest('#azCartPreview'))return;const cart=e.target.closest(CART_TOGGLE+',header [aria-label="My Cart"],#azPcShopCartFab'),bell=e.target.closest('header [aria-label="Notifications"],header [data-az-notification-toggle]');if(cart||bell){
 if(cart?.tagName==='A'&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)){e.stopImmediatePropagation();return;}
 e.preventDefault();e.stopImmediatePropagation();syncIdentity();if(cart)goCart();else showBell();return;
 }if(document.querySelector('.az-customer-panel1538:not([hidden])')&&!e.target.closest('.az-customer-panel1538')&&!document.querySelector('.az-customer-panel1538:not([hidden]) [data-hub-notice]:disabled'))close();},{capture:true});
window.addEventListener('keydown',e=>{const el=document.querySelector('.az-customer-panel1538:not([hidden])');if(!el){if(e.key==='Escape'&&previewTrigger){const trigger=previewTrigger;hidePreview();trigger.focus();}return;}if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const links=[...el.querySelectorAll('button:not(:disabled),a[href]')];if(e.shiftKey&&document.activeElement===links[0]){e.preventDefault();links.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===links.at(-1)){e.preventDefault();links[0]?.focus();}}});
window.addEventListener('azobss:auth-state-ready',()=>{authSettled=true;syncIdentity();renderBell();update();});for(const event of ['azobss-shop-cart-updated','azobss-pc-list-updated','storage'])window.addEventListener(event,()=>{syncIdentity();update();});window.addEventListener('focus',()=>{syncIdentity();refreshNotices();update();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncIdentity();refreshNotices();update();}});window.addEventListener('resize',()=>{hidePreview();document.querySelectorAll('.az-customer-panel1538:not([hidden])').forEach(position);});window.addEventListener('scroll',hidePreview,{passive:true});
let checkoutStarted=false;function boot(){syncIdentity();update();const cart=document.getElementById('azCartContents');
 if(cart&&!cart.dataset.cartBound){
  cart.dataset.cartBound='true';cart.addEventListener('click',handlePanel);cart.addEventListener('error',recoverProductImage,true);
  const header=document.querySelector('header');
  if(header&&typeof ResizeObserver==='function'){
   const measure=()=>document.body.style.setProperty('--az-cart-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
   new ResizeObserver(measure).observe(header);measure();
  }
  try{
   const from=new URL(document.referrer);
   if(from.origin===location.origin&&/^\/(?:PC-Build|Upgrade-Parts|Software-Tools|CAD-Tools-&-Resources)(?:\/|$)/i.test(from.pathname)){
    for(const key of ['cartItem','requests','quote','list'])from.searchParams.delete(key);
    document.querySelector('[data-cart-continue]').href=from.pathname+from.search;
   }
  }catch{}
 }
 const menu=document.querySelector('#userDropdown');if(menu&&!menu.querySelector('[data-hub-account-orders]')){const a=document.createElement('a');a.className='user-dropdown-item';a.href='/PC-Build/?requests=1';a.setAttribute('role','menuitem');a.dataset.hubAccountOrders='';a.textContent='My Requests & Orders';menu.prepend(a);}for(const el of document.querySelectorAll('.az-shop-cart-panel.is-open')){el.classList.remove('is-open');}const key=new URL(location.href).searchParams.get('cartItem');if(key&&!checkoutStarted&&window.azobssOpenPremiumPay&&uid!==null){checkoutStarted=true;const u=new URL(location.href);u.searchParams.delete('cartItem');history.replaceState(null,'',u);checkoutDigital(key);}}
// Old page modules may reopen their bell asynchronously after a shared-panel action.
// Only the explicit General announcements action owns the legacy inbox.
function watchLegacyPanels(){new MutationObserver(records=>{for(const record of records){const el=record.target;if(!(el instanceof Element))continue;if(el.matches('.az-bell-panel.is-open,.az-bell-panel.open,#azBellModal.is-open,#azBellModal.open')&&!generalAllowed){el.classList.remove('is-open','open');}if(el.classList.contains('az-shop-cart-panel')&&el.classList.contains('is-open')){el.classList.remove('is-open');}}if(generalAllowed&&!document.querySelector('.az-bell-panel.is-open,#azBellModal.is-open'))generalAllowed=false;}).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watchLegacyPanels,{once:true}):watchLegacyPanels();
window.AZOBSSCustomerHub1538={openCart:goCart,openNotifications:showBell,readTech,readDigital,saveTech,techKey,productLink,checkoutDigital: item=>checkoutDigital(itemKey(item)),refreshNotifications:refreshNotices,close};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();setInterval(()=>{if(!document.hidden)boot();},1500);setInterval(()=>{if(!document.hidden)refreshNotices();},20000);
})();
