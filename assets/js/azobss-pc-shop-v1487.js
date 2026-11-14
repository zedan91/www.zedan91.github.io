(function(){
'use strict';
if(window.__azobssPcShop1509)return;window.__azobssPcShop1509=true;
const CATALOG_API='https://azobss-backend.onrender.com/api/pc-shop/catalog';
const HEALTH_API='https://azobss-backend.onrender.com/api/pc-shop/health';
const BACKEND='https://azobss-backend.onrender.com';
const CART_KEY='azobss_pc_hardware_cart_v1473';
let catalogRequest=null,catalogRetry;let shownRequestedBuild1537=false;let storefrontSnapshot=[];let presentationById=new Map();let blockedProductImages=new Set();let catalog=[];let externalBuilds=new Map();let externalBuildsLoaded=false;let currentView='hardware';let modalAbort=null;let modalLastFocus=null;let catalogMeta={mode:'loading',fetchedAt:'',stats:{}};let backendState={checkedAt:0,ready:false,message:'Belum disemak',release:'',apiVersion:'',capabilities:{}};
function timeoutError(label='Request'){const e=new Error(label+' mengambil masa terlalu lama. Cuba lagi.');e.code='AZOBSS_TIMEOUT';return e}
function withTimeout(promise,ms,label='Request'){let t;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{t=setTimeout(()=>reject(timeoutError(label)),ms)})]).finally(()=>clearTimeout(t))}
async function fetchWithTimeout(url,options={},ms=22000,label='Server'){const ctrl=new AbortController();const external=options.signal;let externalAbort=null;if(external){if(external.aborted)ctrl.abort(external.reason);else{externalAbort=()=>ctrl.abort(external.reason);external.addEventListener('abort',externalAbort,{once:true})}}const timer=setTimeout(()=>ctrl.abort('timeout'),ms);try{return await fetch(url,{...options,signal:ctrl.signal})}catch(e){if(ctrl.signal.aborted&&!external?.aborted)throw timeoutError(label);throw e}finally{clearTimeout(timer);if(external&&externalAbort)external.removeEventListener('abort',externalAbort)}}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0);
const readCart=()=>{if(window.AZOBSSCustomerHub1538)return window.AZOBSSCustomerHub1538.readTech();try{const x=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}};
const saveCart=x=>{if(window.AZOBSSCustomerHub1538){window.AZOBSSCustomerHub1538.saveTech(x);updateCartFab();return;}try{localStorage.setItem(CART_KEY,JSON.stringify(x.slice(0,40)))}catch(_){}updateCartFab()};
function toast(t){let n=document.querySelector('.az-pc-shop-toast');if(!n){n=document.createElement('div');n.className='az-pc-shop-toast';document.body.appendChild(n)}n.textContent=t;n.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>n.hidden=true,3600)}
function getSavedUser(){for(const st of [localStorage,sessionStorage])for(const k of ['azobssCurrentUser','azobssUser','azobss_user','azobss_current_user','siteUser','currentUser']){try{const x=JSON.parse(st.getItem(k)||'null');if(x)return x}catch(_){}}return{}}
async function authHeaders(force=false){try{if(typeof window.azobssGetFirebaseAuthHeaders==='function')return await withTimeout(window.azobssGetFirebaseAuthHeaders(force),12000,'Login')}catch(e){if(e?.code==='AZOBSS_TIMEOUT')throw e}return{}}
async function requireLogin(){try{if(window.AZOBSSCustomerSession1546)return await window.AZOBSSCustomerSession1546.headers();const h=await authHeaders(false);if(h.Authorization)return h;const token=await window.azobssWaitForFirebaseAuthToken?.(false,12000);if(token)return{Authorization:'Bearer '+token};throw Object.assign(Error('Please sign in to continue.'),{code:'login_required'});}catch(e){if(e.code==='login_required'){const btn=document.querySelector('[data-auth-open="login"],#siteSignInButton');if(btn)btn.click();toast('Sila login untuk menghantar permintaan atau melihat My Requests.');}else toast(e.message||'Unable to verify your session. Please retry.');throw e;}}
function localImageNameKey(v){return String(v||'').toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function localImageUrlKey(v){try{const u=new URL(String(v||''),location.origin);u.search='';u.hash='';return u.toString()}catch(_e){return String(v||'')}}
function applyLocalProductImage(raw){
 const p={...(raw||{})},m=window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES||{};
 const edited=m.byId?.[String(p.id||'')];if(m.version==='1509'&&/^\/PC-Build\/images\/products\/[a-zA-Z0-9._-]+\.webp$/.test(String(edited||''))){p.image=edited;p.photoUnavailable=false;p.localImageVerified=true;return p;}
 const media=window.AZOBSS_PC_MEDIA_1537?.byId?.[String(p.id||p.productId||'')];if(media){if(media.name)p.name=media.name;if(media.displayName)p.displayName=media.displayName;if(media.brand)p.brand=media.brand;if(media.specs?.length){p.specs=media.specs;p.specSourceUrl=media.specSourceUrl||p.specSourceUrl;}if(media.image){p.image=media.image;p.images=media.images;p.imageKind=media.imageKind||p.imageKind;p.photoUnavailable=false;p.localImageVerified=true;return p;}}
 const presentation=typeof presentationById!=='undefined'?presentationById.get(String(p.id||'')):null;
 if(presentation){p.displayName=presentation.displayName||p.displayName;p.specs=presentation.specs||p.specs;if(presentation.replacedImage===p.image){p.image=presentation.image;p.photoUnavailable=presentation.photoUnavailable;}if(presentation.photoUnavailable&&p.image===presentation.image)p.photoUnavailable=true;}
 if(typeof blockedProductImages!=='undefined'&&blockedProductImages.has(p.image)){p.image='/assets/images/pc-product-unavailable.svg';p.photoUnavailable=true;}
 if(p.photoUnavailable===true){p.image='/assets/images/pc-product-unavailable.svg';p.localImageVerified=true;return p;}
 if(p.category==='Case')p.category='Casing';
 if(p.localImageVerified===true&&/^\/PC-Build\/images\/shop\/[a-f0-9]{24}\.webp$/.test(String(p.image||'')))return p;
 let local='';
 if(m.ready===true){
   for(const id of [String(p.id||''),String(p.productId||'')]){if(id&&m.byId?.[id]){local=m.byId[id];break}}
   if(!local){const n=localImageNameKey(p.name);if(n)local=m.byName?.[n]||''}
 }
 if(local){p.image=local;p.imageUrl=local;p.imageFallback='';p.sourceImage=local;p.mediaVerified=true;p.localImageLocked=true;p.imageType='exact-hardware-image-local-v1505'}
 else {p.image='';p.imageUrl='';p.imageFallback='';p.sourceImage='';p.mediaVerified=false;p.localImageLocked=true;p.imageType='hardware-local-image-missing-v1505'}
 return p;
}
function normalizedItem(raw){return{productId:String(raw?.productId||raw?.id||''),name:String(raw?.name||'Item'),category:String(raw?.category||'PC / Hardware'),qty:Math.max(1,Number(raw?.qty||1)||1),unitPrice:Math.max(0,Number(raw?.unitPrice??raw?.price)||0),image:String(raw?.image||''),priceMode:String(raw?.priceMode||'azobss-selling'),priceStatus:String(raw?.priceStatus||'snapshot'),priceCheckedAt:String(raw?.priceCheckedAt||raw?.sourceCheckedAt||''),requiresConfirmation:raw?.requiresConfirmation===true||String(raw?.priceStatus||'snapshot')!=='live',itemType:String(raw?.itemType||raw?.type||'hardware'),sourceName:String(raw?.sourceName||raw?.storeName||''),sourceUrl:String(raw?.sourceUrl||''),specs:Array.isArray(raw?.specs)?raw.specs:(Array.isArray(raw?.parts)?raw.parts.map(x=>Array.isArray(x)?`${x[0]}: ${x[1]}`:String(x)):[])}}
function addCart(raw,buyNow=false){
 const item=normalizedItem(raw);if(!item.productId){toast('Model tidak dijumpai.');return}
 const c=readCart(),found=c.find(x=>x.productId===item.productId);
 if(!found&&c.length>=24){toast('Maksimum24 model bagi satu permintaan. Hantar senarai ini dahulu.');return}
 if(found){const qty=Math.min(20,Number(found.qty||1)+item.qty);Object.assign(found,item,{qty})}else c.push(item);
 saveCart(c);if(buyNow){openCheckout('quote',[item]);return}
 toast('Disimpan dalam senarai permintaan. Stok dan harga akhir perlu disahkan pembekal.');
}
function syncCartPrices(strict=false){const by=new Map(catalog.map(x=>[String(x.id),x]));for(const [id,b] of externalBuilds)by.set(id,b);const before=readCart(),next=before.map(x=>{const p=by.get(String(x.productId));return p&&Number(p.price)>0?{...normalizedItem({...p,qty:x.qty,itemType:p.itemType||p.type||x.itemType}),requiresConfirmation:true}:{...x,requiresConfirmation:true}});if(JSON.stringify(next)!==JSON.stringify(before))saveCart(next);return 0}
window.azobssPcShopAddExternalItem=(raw,buyNow=false)=>addCart(raw,buyNow);
function openRequestedBuild1537(){
 if(shownRequestedBuild1537)return;const id=new URL(location.href).searchParams.get('model'),b=externalBuilds.get(id);if(!b||catalog.some(p=>String(p.id)===id)||window.AZOBSSPcVisibility&&!window.AZOBSSPcVisibility.visible(b,pcShopIsAdmin()))return;shownRequestedBuild1537=true;const parts=(b.parts||b.specs||[]).map(x=>Array.isArray(x)?x.join(': '):typeof x==='string'?x:JSON.stringify(x));const root=modal(b.name||'Requested model',`<div class="az-store-detail">${b.image?`<img src="${esc(b.image)}" alt="${esc(b.name)}">`:''}<div><h3>${esc(b.name)}</h3><div class="az-store-price">${money(b.price)}</div><p>Reference price · Supplier stock and final price require confirmation.</p><ul>${parts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><button type="button" class="az-pc-shop-btn primary" data-requested-build-orders>My Requests & Orders</button></div></div>`);root.querySelector('[data-requested-build-orders]').onclick=openOrders;
}
window.addEventListener('azobss:pc-visibility-change',openRequestedBuild1537);
window.azobssPcShopRegisterBuildCatalog=(rows)=>{externalBuildsLoaded=true;externalBuilds=new Map((Array.isArray(rows)?rows:[]).filter(x=>x&&x.id).map(x=>[String(x.id),{...x,itemType:'pc-build',category:'PC Build',unitPrice:Number(x.price)||0,requiresConfirmation:String(x.priceStatus||'snapshot')!=='live'||String(x.availability||'')!=='available'}]));syncCartPrices(false);updateCartFab();openRequestedBuild1537()};
if(Array.isArray(window.__azobssPcBuildCatalog))window.azobssPcShopRegisterBuildCatalog(window.__azobssPcBuildCatalog);
function updateCartFab(){const c=readCart(),qty=c.reduce((s,x)=>s+Number(x.qty||1),0);const b=document.querySelector('#azPcShopCartFab');if(b)b.querySelector('.az-pc-shop-cart-count').textContent=qty}
function shellHtml(){return `<section class="az-pc-shop-shell" id="az-pc-hardware-shop" aria-label="Tech Products catalogue"><div class="az-pc-shop-head"><div class="az-pc-price-sync" id="azPcPriceSync" role="status">Harga produk: menyemak sumber rasmi…</div><div class="az-pc-shop-tabs"><button class="az-pc-shop-tab" data-pcshop-orders type="button">My Requests & Orders</button></div></div><div id="azPcShopHardware"><div class="az-pc-shop-toolbar"><input class="az-pc-shop-control" id="azPcShopSearch" aria-label="Search products" type="search" placeholder="Search PCs, laptops, components and accessories…"><select class="az-pc-shop-control" id="azPcShopCategory" aria-label="Product category"><option value="all">All categories</option></select><select class="az-pc-shop-control" id="azPcShopSort" aria-label="Sort products"><option value="recommended">Recommended</option><option value="price-asc">Price: Low → High</option><option value="price-desc">Price: High → Low</option><option value="name">Name A → Z</option></select></div><div class="az-pc-shop-grid" id="azPcShopGrid"><div class="az-pc-shop-empty">Menyemak harga hardware live…</div></div></div></section>`}
function ensureShell(){if(document.querySelector('#az-pc-hardware-shop'))return;const anchor=document.querySelector('.az-pc-hub-nav')||document.querySelector('.hero');if(!anchor)return;anchor.insertAdjacentHTML('afterend',shellHtml());document.body.insertAdjacentHTML('beforeend','<button id="azPcShopCartFab" class="az-pc-shop-cart-fab" type="button" aria-label="Open request list">🛒 <span class="az-pc-shop-cart-count">0</span></button>');document.querySelector('#azPcShopCartFab').addEventListener('click',()=>openCart(false));document.querySelector('[data-pcshop-jump-builds]')?.addEventListener('click',()=>{window.AZOBSSPcStorefront?.setHubGroup('prebuilt');document.querySelector('#azStoreResults')?.scrollIntoView({behavior:'smooth',block:'nearest'})});document.querySelector('[data-pcshop-orders]').addEventListener('click',openOrders);document.querySelector('#azPcShopSearch').addEventListener('input',renderHardware);document.querySelector('#azPcShopCategory').addEventListener('change',renderHardware);document.querySelector('#azPcShopSort').addEventListener('change',renderHardware);updateCartFab()}

window.retryProductImage=function(img){if(!img)return;const media=img.closest('.az-pc-product-media');if(media){const repl=document.createElement('div');repl.className='az-pc-product-media az-pc-no-image';repl.textContent='Gambar produk belum tersedia';media.replaceWith(repl)}};
function ageLabel(v){if(!v)return'';const t=Date.parse(v);if(!Number.isFinite(t))return'';const mins=Math.max(0,Math.round((Date.now()-t)/60000));if(mins<2)return'baru dikemas kini';if(mins<60)return`${mins} min lalu`;const h=Math.round(mins/60);if(h<24)return`${h} jam lalu`;return`${Math.round(h/24)} hari lalu`}
function pcShopIsAdmin(){try{return typeof window.isAdminViewer==='function'&&window.isAdminViewer()===true}catch(_){return false}}
function productCard(p){const stock=String(p.stock||'check').replace(/-/g,' '),img=esc(p.image||''),status=String(p.priceStatus||''),live=status==='live'&&p.available===true&&String(p.availability||'')==='available'&&p.requiresConfirmation!==true,source=pcShopIsAdmin()&&p.sourceUrl?`<div class="az-pc-product-source-label" data-pc-admin-source>Sumber kedai: <b>${esc(p.sourceName||'Produk rasmi')}</b></div><a class="az-pc-product-source" data-pc-admin-source href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">Lihat produk asal ↗</a>`:'',media=img?`<button class="az-pc-product-media ${esc(p.imageCrop||'product-focus')}" data-shop-image="${esc(p.id)}" type="button" aria-label="Lihat gambar ${esc(p.name)} lebih besar"><img src="${img}" alt="${esc(p.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="retryProductImage(this)"></button>`:`<div class="az-pc-product-media az-pc-no-image">Gambar produk belum tersedia</div>`,actions=Number(p.price)>0?`<button class="az-pc-shop-btn" data-shop-add="${esc(p.id)}" type="button">Add to List</button><button class="az-pc-shop-btn primary" data-shop-buy="${esc(p.id)}" type="button">Request Quote</button><a class="az-pc-shop-btn quote" href="https://alvo.chat/6nZ2" target="_blank" rel="noopener">Tanya / Tempah</a>`:'';return `<article class="az-pc-product" data-shop-product="${esc(p.id)}">${media}<div class="az-pc-product-body"><div class="az-pc-product-cat">${esc(p.category)}</div><h3>${esc(p.name)}</h3><div class="az-pc-product-price">${money(p.price)}</div><ul class="az-pc-product-specs">${(p.specs||[]).slice(0,14).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${source}${pcShopIsAdmin()?(window.AZOBSSSourcePrices?.panel(p)||''):''}<div class="az-pc-product-stock">Status: ${esc('Reference price · Stok pembekal perlu disahkan')}</div><div class="az-pc-product-actions">${actions}</div></div></article>`}
function renderHardware(){if(window.AZOBSSPcStorefront){window.AZOBSSPcStorefront.render(catalog.filter(p=>p.image),{add:addCart,image:openImageViewer,modal,isAdmin:pcShopIsAdmin,catalogMode:catalogMeta.mode,retry:retryCatalogue});return;}const q=String(document.querySelector('#azPcShopSearch')?.value||'').trim().toLowerCase(),cat=document.querySelector('#azPcShopCategory')?.value||'all',sort=document.querySelector('#azPcShopSort')?.value||'price-asc';let list=catalog.filter(p=>(cat==='all'||p.category===cat)&&(!q||JSON.stringify(p).toLowerCase().includes(q)));if(sort==='price-desc')list.sort((a,b)=>Number(b.price)-Number(a.price));else if(sort==='name')list.sort((a,b)=>String(a.name).localeCompare(String(b.name)));else list.sort((a,b)=>Number(a.price)-Number(b.price));const box=document.querySelector('#azPcShopGrid');if(!box)return;box.innerHTML=list.length?list.map(productCard).join(''):'<div class="az-pc-shop-empty">Tiada hardware yang lulus semakan live buat masa ini.<div style="margin-top:12px"><button class="az-pc-shop-btn primary" data-shop-retry type="button">Cuba Semula</button></div></div>';box.querySelectorAll('[data-shop-add]').forEach(b=>b.addEventListener('click',()=>addCart(catalog.find(x=>x.id===b.dataset.shopAdd))));box.querySelectorAll('[data-shop-buy]').forEach(b=>b.addEventListener('click',()=>addCart(catalog.find(x=>x.id===b.dataset.shopBuy),true)));box.querySelectorAll('[data-shop-image]').forEach(b=>b.addEventListener('click',()=>openImageViewer(catalog.find(x=>x.id===b.dataset.shopImage))));box.querySelector('[data-shop-retry]')?.addEventListener('click',()=>loadCatalog(1),{once:true})}
function setSyncStatus(){
 const el=document.querySelector('#azPcPriceSync');if(!el)return;
 const shown=catalog.filter(p=>p.image&&(!window.AZOBSSPcVisibility||window.AZOBSSPcVisibility.visible(p,pcShopIsAdmin()))).length;
 if(catalogMeta.mode==='loading')el.textContent='Memuatkan katalog…';
 else if(catalogMeta.mode==='snapshot')el.textContent='Harga rujukan · Menyemak kemas kini…';
 else if(catalogMeta.mode==='unavailable')el.textContent=shown?'Harga rujukan · Semakan terkini belum tersedia.':'Katalog belum dapat dimuatkan.';
 else el.textContent=`${shown.toLocaleString('ms-MY')} pilihan · Stok pembekal dan harga akhir perlu disahkan.`;
}
function retryCatalogue(){
 window.AZOBSSPcVisibility?.refresh();
 loadCatalog();
}
async function reloadAdminCatalogue(){
 if(catalogRequest)await catalogRequest;
 return loadCatalog();
}
function loadCatalog(attempt=0){
 if(catalogRequest)return catalogRequest;
 clearTimeout(catalogRetry);
 catalogRequest=updateCatalog(attempt).finally(()=>{catalogRequest=null;});
 return catalogRequest;
}
async function updateCatalog(attempt){
 let shouldRetry=false;
 try{
  const h=pcShopIsAdmin()?await authHeaders(true):{},includeHidden=pcShopIsAdmin()&&!!h.Authorization;
  const r=await fetch(CATALOG_API+(includeHidden?'?includeHidden=1':''),{cache:'no-store',headers:h,signal:AbortSignal.timeout(12000)});
  const d=await r.json();
  if(!r.ok||!d.ok||!Array.isArray(d.products))throw new Error(d.message||d.error||'Catalog unavailable');
  const rows=d.capabilities?.expandedCatalog1512===true?d.products:[...storefrontSnapshot,...d.products];
  if(d.capabilities?.unifiedPcHardware1526!==true)rows.push(...storefrontSnapshot.filter(p=>p.sourceRecordId));
  catalog=[...new Map(rows.map(p=>[String(p.id),p])).values()].filter(p=>['hardware','laptop','desktop'].includes(String(p.type||'').toLowerCase())&&Number(p.price)>0&&String(p.priceStatus||'')!=='unavailable').map(applyLocalProductImage);
  catalogMeta={mode:'live',hasLiveCatalogue:true,fetchedAt:d.fetchedAt||'',stats:d.stats||{total:catalog.length}};
  window.AZOBSSPcVisibility?.accept(d.visibility);
  shouldRetry=!catalog.length&&Number(catalogMeta.stats?.total||0)>0&&attempt<1;
 }catch(e){
  console.warn('AZOBSS hardware catalog unavailable:',e);
  if(!catalogMeta.hasLiveCatalogue)catalog=storefrontSnapshot.map(applyLocalProductImage);
  catalogMeta={...catalogMeta,mode:'unavailable'};
  shouldRetry=attempt<1;
 }
 const sel=document.querySelector('#azPcShopCategory');const previousCategory=sel?.value;
 if(sel){
  sel.innerHTML='<option value="all">All categories</option>'+[...new Set(catalog.filter(p=>p.image).map(x=>x.category).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
  if([...sel.options].some(x=>x.value===previousCategory))sel.value=previousCategory;
 }
 syncCartPrices(catalogMeta.mode==='live');
 setSyncStatus();renderHardware();
 if(shouldRetry)catalogRetry=setTimeout(()=>loadCatalog(attempt+1),2000);
}
async function loadStorefrontSnapshot(){
 const files=['pc-shop-storefront-v1512.json','viewnet-storefront-v1526.json'];
 const results=await Promise.allSettled(files.map(async file=>{
  const response=await fetch('/PC-Build/'+file,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Storefront snapshot unavailable');
  return response.json();
 }));
 const sources=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
 const products=sources.flatMap(data=>data.products||[]);
 const presentation=products.filter(p=>p.presentationVersion===1517);
 presentationById=new Map(presentation.map(p=>[String(p.id),p]));
 blockedProductImages=new Set(sources.flatMap(data=>data.blockedImagePaths||[]));
 storefrontSnapshot=products.filter(p=>Number(p.price)>0&&Date.now()-Date.parse(p.priceCheckedAt||'')<14*24*60*60*1000);
 if(catalogMeta.hasLiveCatalogue)catalog=catalog.map(applyLocalProductImage);
 else {
  if(catalog.length)return;
  catalog=storefrontSnapshot.map(applyLocalProductImage);
  if(catalogMeta.mode==='loading'&&catalog.length)catalogMeta={mode:'snapshot',stats:{total:catalog.length}};
 }
 setSyncStatus();renderHardware();
}
function pcItemFromCard(card){const id=String(card?.dataset.productId||''),name=card?.querySelector('h2')?.textContent?.trim()||'PC Build',price=Number(card?.dataset.price||0)||0,image=card?.dataset.image||card?.querySelector('.build-media img')?.getAttribute('src')||'';return{productId:id,name,category:'PC Build',qty:1,unitPrice:price,image,priceMode:'azobss-selling',priceStatus:'live',requiresConfirmation:false,itemType:'pc-build'}}
function enhancePcCards(){/* v1480: G2 PC Builds owns its own actions. Hardware Shop no longer injects duplicate Add to Cart / Buy Now controls into PC cards. */}
function watchPcCards(){/* intentionally no-op in v1480 */}

let imageViewerKeyHandler=null,imageViewerAbort=null,imageViewerLastFocus=null;
function closeDedicatedImageViewer(restoreFocus=true){try{imageViewerAbort?.abort()}catch(_e){}imageViewerAbort=null;document.querySelectorAll('.az-pc-image-backdrop').forEach(x=>{x.classList.remove('is-open');x.setAttribute('aria-hidden','true');x.style.setProperty('pointer-events','none','important');x.remove()});document.body.classList.remove('az-pc-image-modal-open');if(imageViewerKeyHandler){document.removeEventListener('keydown',imageViewerKeyHandler,true);imageViewerKeyHandler=null}const focusTarget=imageViewerLastFocus;imageViewerLastFocus=null;if(restoreFocus&&focusTarget?.isConnected){requestAnimationFrame(()=>{try{focusTarget.focus({preventScroll:true})}catch(_e){}})}}
function dedicatedImageViewer(title,url,source,crop='product-focus',productKind='',productId='',photos=[]){
  if(!url)return;
  closeDedicatedImageViewer(false);
  imageViewerLastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  imageViewerAbort=new AbortController();
  const sig=imageViewerAbort.signal,root=document.createElement('div');
  root.className='az-pc-image-backdrop is-open';root.setAttribute('aria-hidden','false');
  root.setAttribute('data-azobss-image-viewer','1509');
  const pictures=[...new Set([url,...photos].filter(x=>typeof x==='string'&&(/^(?:https:\/\/|\/PC-Build\/images\/)/.test(x))))];let angle=0;
  const canEdit=window.azobssPcImageEditor?.isAdministrator?.()===true;
  root.innerHTML=`<section class="az-pc-image-lightbox" role="dialog" aria-modal="true" aria-label="${esc(title||'Product Image')}"><button class="az-pc-image-close" data-pc-image-close type="button" aria-label="Tutup gambar">×</button>${canEdit?'<button class="az-pc-image-edit" data-pc-image-edit type="button" aria-label="Edit gambar (Administrator)">🎨 Edit Gambar</button>':''}<div class="az-pc-image-stage ${esc(crop||'product-focus')}"><img src="${esc(url)}" alt="${esc(title||'Product')}" referrerpolicy="no-referrer"></div><div class="az-pc-gallery-nav1537"><button type="button" data-gallery-prev aria-label="Previous photo">← Previous</button><span data-gallery-count aria-live="polite">1 / ${pictures.length}</span><button type="button" data-gallery-next aria-label="Next photo">Next →</button></div><div class="az-pc-image-caption"><strong>${esc(title||'Product Image')}</strong></div></section>`;
  document.body.appendChild(root);document.body.classList.add('az-pc-image-modal-open');
  const stage=root.querySelector('.az-pc-image-stage'),closeBtn=root.querySelector('[data-pc-image-close]');
  const image=stage.querySelector('img'),previous=root.querySelector('[data-gallery-prev]'),next=root.querySelector('[data-gallery-next]'),count=root.querySelector('[data-gallery-count]');
  function showAngle(index){angle=Math.max(0,Math.min(pictures.length-1,index));stage.classList.remove('is-zoomed');image.src=pictures[angle];image.alt=(title||'Product')+' · photo '+(angle+1);count.textContent=(angle+1)+' / '+pictures.length;previous.disabled=angle===0;next.disabled=angle===pictures.length-1;}
  previous.addEventListener('click',()=>showAngle(angle-1),{signal:sig});next.addEventListener('click',()=>showAngle(angle+1),{signal:sig});showAngle(0);
  const closeFromUi=e=>{if(e){e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation()}stage?.classList.remove('is-zoomed');closeDedicatedImageViewer()};
  const isCloseTarget=e=>{const t=e?.target;return t instanceof Element&&!!t.closest('[data-pc-image-close]')};
  root.addEventListener('pointerup',e=>{if(isCloseTarget(e))closeFromUi(e)},{capture:true,signal:sig});
  root.addEventListener('click',e=>{if(isCloseTarget(e)){closeFromUi(e);return}if(e.target===root)closeFromUi(e)},{capture:true,signal:sig});
  stage?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();stage.classList.toggle('is-zoomed')},{signal:sig});
  root.querySelector('[data-pc-image-edit]')?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(!window.azobssPcImageEditor?.isAdministrator?.())return;
    const returnFocus=imageViewerLastFocus;
    stage?.classList.remove('is-zoomed');
    closeDedicatedImageViewer(false);
    window.azobssPcImageEditor.open({title:title||'Product Image',url:pictures[angle],source,returnFocus,productKind,productId}).catch(err=>console.warn('AZOBSS Photo Editor:',err));
  },{signal:sig});
  imageViewerKeyHandler=e=>{if(e.key==='ArrowRight'){e.preventDefault();showAngle(angle+1);}else if(e.key==='ArrowLeft'){e.preventDefault();showAngle(angle-1);}else if(e.key==='Escape'){e.preventDefault();closeFromUi(e)}};
  document.addEventListener('keydown',imageViewerKeyHandler,{capture:true,signal:sig});
  requestAnimationFrame(()=>{try{closeBtn?.focus({preventScroll:true})}catch(_e){}});
}
function openImageViewer(p){if(!p?.image)return;dedicatedImageViewer(p.name||'Product Image',p.image,p.sourceName||'sumber rasmi',p.imageCrop||'product-focus','hardware',String(p.id||p.productId||''),window.AZOBSSPcModel?.gallery(p)||p.images||[])}
window.azobssOpenPcProductImage=function(title,url,source,crop,productId){if(!url)return;dedicatedImageViewer(title||'Product Image',url,source||'sumber rasmi',crop||'pc-focus','build',String(productId||''),window.AZOBSS_PC_MEDIA_1537?.byId?.[String(productId||'')]?.images||[])};
function cleanupPcShopModalState(reason='watchdog'){const overlays=[...document.querySelectorAll('.az-pc-shop-backdrop')];let active=overlays.filter(x=>x.classList.contains('is-open')&&x.getAttribute('aria-hidden')!=='true'&&x.querySelector('.az-pc-shop-modal'));if(active.length>1){active.slice(0,-1).forEach(x=>x.remove());active=active.slice(-1)}for(const x of overlays){if(!x.isConnected)continue;const valid=x.classList.contains('is-open')&&x.getAttribute('aria-hidden')!=='true'&&!!x.querySelector('.az-pc-shop-modal');if(!valid){x.remove();continue}if(x.style.pointerEvents==='none'||x.dataset.azobssOrphanOverlayRecovered){x.style.removeProperty('pointer-events');delete x.dataset.azobssOrphanOverlayRecovered}x.style.setProperty('pointer-events','auto','important')}const live=document.querySelector('.az-pc-shop-backdrop.is-open[aria-hidden="false"] .az-pc-shop-modal');document.body.classList.toggle('az-pc-shop-modal-open',!!live);return !!live}
function modal(title,body){
 const checkout=document.getElementById('azCheckoutStage');
 if(checkout){
  modalAbort?.abort();modalAbort=new AbortController();
  checkout.innerHTML='<h2 tabindex="-1">'+esc(title)+'</h2><div class="az-pc-shop-modal-body">'+body+'</div>';
  checkout.firstElementChild.focus();
  return checkout;
 }
 closeModal(false);cleanupPcShopModalState('before-open');modalLastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;modalAbort=new AbortController();const root=document.createElement('div');root.className='az-pc-shop-backdrop is-open';root.id='azPcShopModal';root.setAttribute('aria-hidden','false');root.setAttribute('data-azobss-overlay','pc-shop');root.dataset.azPcModalOwner='1507';root.innerHTML=`<section class="az-pc-shop-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="az-pc-shop-modal-head"><h3>${esc(title)}</h3><button class="az-pc-shop-close" type="button" aria-label="Close">×</button></div><div class="az-pc-shop-modal-body">${body}</div></section>`;document.body.appendChild(root);document.body.classList.add('az-pc-shop-modal-open');const sig=modalAbort.signal;root.querySelector('.az-pc-shop-close').addEventListener('click',()=>closeModal(),{signal:sig});root.addEventListener('click',e=>{if(e.target===root)closeModal()},{signal:sig});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.az-pc-shop-backdrop.is-open')){e.preventDefault();closeModal()}},{signal:sig});queueMicrotask(()=>cleanupPcShopModalState('after-open'));setTimeout(()=>{cleanupPcShopModalState('focus');root.querySelector('.az-pc-shop-close')?.focus()},0);return root}
function closeModal(restoreFocus=true){try{modalAbort?.abort()}catch(_){}modalAbort=null;document.querySelectorAll('.az-pc-shop-backdrop').forEach(x=>{x.classList.remove('is-open');x.setAttribute('aria-hidden','true');x.style.setProperty('pointer-events','none','important');x.remove()});document.body.classList.remove('az-pc-shop-modal-open');cleanupPcShopModalState('close');if(restoreFocus&&modalLastFocus?.isConnected){try{modalLastFocus.focus({preventScroll:true})}catch(_){}}modalLastFocus=null}
function cartTotals(c){return c.reduce((s,x)=>s+Number(x.unitPrice||0)*Number(x.qty||1),0)}
function cartRows(c){return c.map((x,i)=>`<div class="az-pc-cart-row"><div class="az-pc-cart-thumb">${x.image?`<img src="${esc(x.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:'🖥️'}</div><div><div class="az-pc-cart-title">${esc(x.name)}</div><div class="az-pc-cart-meta">${esc(x.category)} • reference price</div></div><div><div class="az-pc-cart-price">${x.unitPrice?money(x.unitPrice*x.qty):'Quote'}</div><div class="az-pc-cart-qty"><button data-cart-minus="${i}" type="button">−</button><span>${Number(x.qty||1)}</span><button data-cart-plus="${i}" type="button">+</button></div></div><button class="az-pc-cart-remove" data-cart-remove="${i}" type="button">×</button></div>`).join('')}
function openCart(goCheckout=false){if(window.AZOBSSCustomerHub1538){window.AZOBSSCustomerHub1538.openCart();return;}
 const c=readCart(),tabs=`<div class="az-pc-cart-actions"><button type="button" class="az-pc-shop-btn primary" data-pc-list-tab>My List (${c.reduce((s,x)=>s+x.qty,0)})</button><button type="button" class="az-pc-shop-btn" data-pc-requests-tab>My Requests & Orders ↗</button></div>`;
 const content=c.length?`${cartRows(c)}<div class="az-pc-cart-summary"><div class="az-pc-cart-summary-row total"><span>Reference subtotal</span><b>${money(cartTotals(c))}</b></div></div><div class="az-pc-shop-note">Your list is saved until submitted. Supplier stock and final prices will be confirmed before payment.</div><div class="az-pc-cart-actions"><button class="az-pc-shop-btn primary" data-cart-quote type="button">Request Quote — No Payment</button></div>`:'<div class="az-pc-shop-empty">Your list is empty. Submitted requests and final quotes are available in My Requests & Orders.</div>';
 const root=modal('PC List & Quotes',tabs+content);root.querySelector('[data-pc-requests-tab]').onclick=openOrders;bindCart(root);
}

function bindCart(root){root.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>mutateQty(Number(b.dataset.cartMinus),-1));root.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>mutateQty(Number(b.dataset.cartPlus),1));root.querySelectorAll('[data-cart-remove]').forEach(b=>b.onclick=()=>{const c=readCart();c.splice(Number(b.dataset.cartRemove),1);saveCart(c);closeModal();openCart(false)});root.querySelector('[data-cart-quote]')?.addEventListener('click',()=>openCheckout('quote'));}
function mutateQty(i,d){const c=readCart();if(!c[i])return;c[i].qty=Math.max(1,Math.min(20,Number(c[i].qty||1)+d));saveCart(c);closeModal();openCart(false)}
function profileDefaults(){const u=getSavedUser();return{name:u.displayName||u.name||u.username||'',phone:u.phone||u.phoneNumber||'',email:u.email||u.authEmail||'',address:u.address||u.fullAddress||u.customerAddress||'',firstName:u.firstName||'',lastName:u.lastName||'',company:u.company||'',city:u.city||'',state:u.state||'',postcode:u.postcode||u.postalCode||''}}
function choiceCards(name,items,selected){return `<div class="az-pc-choice-group">${items.map(x=>`<label class="az-pc-choice"><input type="radio" name="${name}" value="${esc(x.value)}" ${x.value===selected?'checked':''}><span><b>${esc(x.label)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:''}</span></label>`).join('')}</div>`}
function agreedLinePrice(item){
 if(!Number.isFinite(item.confirmedUnitPrice))return '';
 const qty=Number(item.qty)||1;
 return ' · '+money(item.confirmedUnitPrice)+' seunit'+(qty>1?' · '+money(item.confirmedUnitPrice*qty):'');
}
function quoteSummary(items,total,label){
 return '<aside class="az-pc-checkout-summary"><h4>Order summary</h4><ul>'+items.map(item=>
   '<li><strong>'+esc(item.name)+'</strong> × '+Number(item.qty||1)+(item.optionLabel?' · '+esc(item.optionLabel):'')+agreedLinePrice(item)+'</li>'
 ).join('')+'</ul><div class="az-pc-cart-summary-row total"><span>'+label+'</span><b>'+money(total)+'</b></div></aside>';
}
function checkoutHtml(items){
 return '<div class="az-pc-checkout-layout"><div><p>AZOBSS will check stock and item prices. Choose delivery or self pickup when you’re ready to proceed.</p>'+
   '<label>Notes (optional)<textarea id="azPcNotes" rows="3" maxlength="800" placeholder="Anything we should know about your request?"></textarea></label>'+
   '<p id="azPcBackendStatus" role="status"></p><div class="az-pc-cart-actions"><button class="az-pc-shop-btn" data-checkout-back type="button">Back</button>'+
   '<button class="az-pc-shop-btn primary" data-submit-order type="button">Send Quote Request</button></div></div>'+
   quoteSummary(items,cartTotals(items),'Reference subtotal')+'</div>';
}
function checkoutFields(profile,order){
 const name=String(order.customerName||profile.name||'').trim().split(/\s+/);
 const [first,...last]=name;
 const input=(field,label,auto,value='',extra='')=>'<label>'+label+'<input name="'+field+'" autocomplete="'+auto+'" value="'+esc(value)+'" maxlength="100" '+extra+'></label>';
 return '<div class="az-pc-checkout-grid">'+
  input('firstName','First name *','given-name',profile.firstName||first,'required')+
  input('lastName','Last name','family-name',profile.lastName||last.join(' '))+
  input('company','Company','organization',profile.company)+
  input('email','Email *','email',String(order.customerEmail||profile.email||'').endsWith('@azobss.local')?'':(order.customerEmail||profile.email),'type="email" required')+
  '</div>';
}
function deliveryCheckoutHtml(order){
 const profile=profileDefaults();
 const dedicated=!!document.getElementById('azCheckoutStage');
 const shipping=choiceCards('azPcShipping',[{value:'Courier',label:'Penghantaran ke Alamat',sub:order.fixedDeliveryOffer?money(order.fixedDeliveryOffer.charge)+' · kadar tetap':'Caj disahkan dalam sebut harga'},{value:'Pickup at AZOBSS',label:'Ambil Sendiri',sub:'Percuma · Tiada minimum'}],'Courier');
 return '<div class="az-pc-checkout-layout"><form data-delivery-checkout><h4>Contact &amp; delivery</h4>'+(dedicated?checkoutFields(profile,order):'')+
   '<div class="az-pc-checkout-grid"><label class="span-2">Phone<input id="azPcCustomerPhone" type="tel" autocomplete="tel" required maxlength="60" value="'+esc(order.customerPhone||profile.phone)+'"></label>'+
   '<div class="span-2 az-pc-choice-section"><div class="az-pc-choice-title">Kaedah penerimaan</div>'+shipping+'</div>'+
   '<label id="azPcAddressField" class="span-2"><span id="azPcAddressLabel">Delivery address</span><textarea id="azPcCustomerAddress" autocomplete="street-address" rows="3" maxlength="500">'+esc(profile.address)+'</textarea></label>'+
   (dedicated?'<div class="span-2 az-checkout-address" data-checkout-address><label>Town / City *<input name="city" autocomplete="address-level2" maxlength="80" value="'+esc(profile.city)+'"></label><label>State / Federal territory *<select name="state" autocomplete="address-level1"><option value="">Select state</option>'+['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya'].map(state=>'<option'+(state===profile.state?' selected':'')+'>'+state+'</option>').join('')+'</select></label><label>Postcode *<input name="postcode" autocomplete="postal-code" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" value="'+esc(profile.postcode)+'"></label><div>Country / Region<br><strong>Malaysia</strong></div></div>':'')+
   (window.AZOBSSTechDelivery?.checkout||'')+'</div><p role="status" data-delivery-message></p>'+
   '<div class="az-pc-cart-actions"><button class="az-pc-shop-btn" type="button" data-back-to-quote>Back to quote</button>'+
   '<button class="az-pc-shop-btn primary" type="submit" disabled>Save &amp; continue</button></div></form>'+
   quoteSummary(order.items||[],order.confirmedItemTotal,'Quoted items').replace('</aside>','<div class="az-pc-cart-summary-row"><span>Penghantaran</span><b id="azPcShippingSummary"></b></div><div class="az-pc-cart-summary-row total"><span>Jumlah</span><b id="azPcCheckoutTotal"></b></div></aside>')+'</div>';
}
function openDeliveryCheckout(order){
 const root=modal('Checkout · Delivery or Pickup',deliveryCheckoutHtml(order));
 root.dataset.pcCustomerOwner=currentCustomerUid();
 const form=root.querySelector('form'),button=form.querySelector('[type=submit]'),message=form.querySelector('[data-delivery-message]');
 const sync=()=>{
   syncCheckoutShipping(root,order.items||[]);
   const shippingSummary=root.querySelector('#azPcShippingSummary'),totalSummary=root.querySelector('#azPcCheckoutTotal');
   const pickup=root.querySelector('input[name="azPcShipping"]:checked')?.value==='Pickup at AZOBSS';
   const addressFields=form.querySelector('[data-checkout-address]');
   if(addressFields){
     addressFields.hidden=pickup;
     for(const field of addressFields.querySelectorAll('input,select')){field.disabled=pickup;field.required=!pickup;}
   }
   const slot=root.querySelector('#azTechPickupSlot');
   if(slot){slot.required=pickup;slot.disabled=!pickup;}
   if(pickup||order.fixedDeliveryOffer){
     const fee=pickup?0:Number(order.fixedDeliveryOffer.charge);
     const total=Math.round((Number(order.confirmedItemTotal)+fee)*100)/100;
     if(shippingSummary)shippingSummary.textContent=money(fee);
     if(totalSummary)totalSummary.textContent=money(total);
     button.textContent='Setuju · '+money(total);
     message.textContent=pickup?'Ambil sendiri percuma. AZOBSS akan sahkan masa pengambilan.':'Caj penghantaran sudah termasuk. Invois tersedia selepas semakan stok akhir.';
   }else{
     button.textContent='Save & continue';
     message.textContent='AZOBSS akan hantar jumlah akhir termasuk caj penghantaran untuk persetujuan anda.';
   }
 };
 sync();
 const module=window.AZOBSSTechDelivery;
 if(module)module.attachCheckout(root,currentCustomerUid(),requireLogin,()=>{sync();button.disabled=!root.querySelector('input[name="azPcShipping"]:checked:not(:disabled)');});
 else message.textContent='Delivery options could not load. Reload the page and try again.';
 root.querySelector('[data-back-to-quote]').onclick=()=>openOrders(order.orderId,'quote');
 form.onsubmit=async event=>{
   event.preventDefault();button.disabled=true;
   try{
     const shippingMethod=root.querySelector('input[name="azPcShipping"]:checked')?.value;
     const payload={action:'delivery-details',quoteVersion:order.quoteVersion,shippingMethod,customerPhone:root.querySelector('#azPcCustomerPhone').value.trim()};
     if(form.elements.firstName){
       payload.checkoutContact={firstName:form.elements.firstName.value,lastName:form.elements.lastName.value,company:form.elements.company.value,email:form.elements.email.value};
     }
     if(shippingMethod==='Courier'){
       if(form.elements.city)Object.assign(payload.checkoutContact,{city:form.elements.city.value,state:form.elements.state.value,postcode:form.elements.postcode.value});
       if(order.fixedDeliveryOffer)payload.acceptedTotal=Math.round((Number(order.confirmedItemTotal)+Number(order.fixedDeliveryOffer.charge))*100)/100;
       payload.customerAddress=root.querySelector('#azPcCustomerAddress').value.trim();
       payload.deliveryPin=module.pin(root);
     }else payload.pickupRequestedSlot=root.querySelector('#azTechPickupSlot').value;
     const headers={...await requireLogin(),'Content-Type':'application/json'};
     const response=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders/'+encodeURIComponent(order.orderId)+'/decision',{method:'POST',headers,body:JSON.stringify(payload)},25000,'Delivery details');
     const result=await response.json();
     if(!response.ok||!result.ok)throw Error(orderErrorMessage(response,result));
     if(root.isConnected)await openOrders(order.orderId,shippingMethod==='Courier'&&!order.fixedDeliveryOffer?'order':'quote');
   }catch(error){message.textContent=error.message||'Unable to save details.';button.disabled=false;}
 };
}
function syncCheckoutShipping(root,items){const ship=root.querySelector('input[name="azPcShipping"]:checked')?.value||'Courier',needs=items.some(x=>x.requiresConfirmation||!Number(x.unitPrice)),subtotal=cartTotals(items),s=root.querySelector('#azPcShippingSummary'),t=root.querySelector('#azPcCheckoutTotal'),addr=root.querySelector('#azPcCustomerAddress'),label=root.querySelector('#azPcAddressLabel'),courier=ship==='Courier';const pickup=ship==='Pickup at AZOBSS';const field=root.querySelector('#azPcAddressField'),pickupBox=root.querySelector('#azTechPickup'),deliveryBox=root.querySelector('#azTechDelivery');if(field)field.hidden=pickup;if(pickupBox)pickupBox.hidden=!pickup;if(deliveryBox)deliveryBox.hidden=!courier;if(addr){addr.required=courier;addr.setAttribute('aria-required',courier?'true':'false');addr.placeholder=ship==='Pickup at AZOBSS'?'Alamat tidak diperlukan untuk pickup':(courier?'Masukkan alamat penghantaran (wajib untuk Courier)':'Alamat jika diperlukan untuk urusan penghantaran')}if(label)label.textContent=courier?'Delivery Address *':'Delivery Address';if(s)s.textContent=ship==='Pickup at AZOBSS'?'PERCUMA':(courier?'Dikira selepas alamat':'Akan diatur dengan AZOBSS');if(t)t.textContent=needs?'Semakan diperlukan':money(subtotal)}
async function checkBackend(force=false){const now=Date.now();if(!force&&backendState.checkedAt&&now-backendState.checkedAt<60000)return backendState;try{const r=await fetchWithTimeout(HEALTH_API+'?t='+now,{cache:'no-store'},12000,'Backend PC Shop');const d=await r.json().catch(()=>({}));const caps=d&&typeof d.capabilities==='object'?d.capabilities:{};const ready=!!(r.ok&&d.ok&&String(d.apiVersion||'')==='pc-shop-v1'&&caps.catalog===true&&caps.orders===true&&caps.requestOnly===true&&caps.customerQuoteApproval===true&&caps.strictAvailability===true&&caps.staleCartReject===true);backendState={checkedAt:Date.now(),ready,release:String(d.release||d.version||''),apiVersion:String(d.apiVersion||''),capabilities:caps,message:ready?'Server PC Shop sedia.':(r.status===404||r.status===405?'Backend PC Shop API belum dipasang pada runtime Render. Deploy backend terbaru.':(d.message||d.error||`Backend PC Shop tidak serasi (HTTP ${r.status}).`))}}catch(e){backendState={checkedAt:Date.now(),ready:false,release:'',apiVersion:'',capabilities:{},message:e?.message||'Backend PC Shop tidak dapat dicapai.'}}return backendState}
async function refreshCheckoutBackendStatus(root,force=false){const el=root?.querySelector('#azPcBackendStatus'),btn=root?.querySelector('[data-submit-order]');if(btn)btn.disabled=true;if(el){el.textContent='Server request: menyemak…';el.style.color=''}const st=await checkBackend(force);if(st.ready){if(el){el.textContent=`Server request: sedia${st.release?' • v'+st.release:''}`;el.style.color='#86efac'}if(btn)btn.disabled=false;return st}if(el){el.innerHTML=`Server request: ${esc(st.message)} <button type="button" data-backend-retry style="margin-left:8px">Cuba Lagi</button>`;el.style.color='#fca5a5';el.querySelector('[data-backend-retry]')?.addEventListener('click',()=>refreshCheckoutBackendStatus(root,true),{once:true})}if(btn)btn.disabled=true;return st}
async function requireBackendReady(force=false){const st=await checkBackend(force);if(!st.ready)throw new Error(st.message||'Backend PC Shop belum sedia.');return st}
async function openCheckout(intent='quote',itemsOverride=null){
 const items=Array.isArray(itemsOverride)&&itemsOverride.length?itemsOverride:readCart();if(!items.length)return;
 try{await requireLogin()}catch(_){return}
 const root=modal('Request Quote',checkoutHtml(items));
 root.dataset.pcCustomerOwner=currentCustomerUid();
 root.querySelector('[data-checkout-back]').onclick=()=>{if(root.id==='azCheckoutStage')location.href='/cart/';else closeModal();};
 root.querySelector('[data-submit-order]').onclick=()=>submitOrder(root,items);
 refreshCheckoutBackendStatus(root,false)
}
function orderErrorMessage(r,d){if(r.status===404||r.status===405)return'Backend PC Shop API belum deploy pada runtime Render. Deploy backend terbaru kemudian cuba semula.';if(r.status===401)return'Sesi login tidak sah. Sign out dan login semula.';if(r.status===503)return'Backend / Firestore belum tersedia. Cuba semula selepas Render aktif.';return d?.message||d?.error||`Order gagal dibuat (HTTP ${r.status})`}
async function submitOrder(root,items){
 const btn=root.querySelector('[data-submit-order]');btn.disabled=true;btn.textContent='Sending…';
 const slow=setTimeout(()=>{if(btn?.isConnected)btn.textContent='Server sedang aktif…'},8000);
 try{
  await requireBackendReady(false);const headers=Object.assign({'Content-Type':'application/json'},await requireLogin());
  const owner=root.dataset.pcCustomerOwner;
  if(owner!==currentCustomerUid())throw Error('Your account changed. Open My Cart and try again.');
  const profile=profileDefaults();
  const payload={intent:'quote',deferDelivery:true,items:items.map(x=>({productId:x.productId,qty:x.qty})),
    customerName:profile.name,customerPhone:profile.phone,customerEmail:profile.email,notes:root.querySelector('#azPcNotes').value.trim()};
  const r=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders',{method:'POST',headers,body:JSON.stringify(payload)},75000,'Request server');const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.ok)throw new Error(orderErrorMessage(r,d));
  if(d.order?.requestOnly!==true||d.order.invoiceIssued||d.order.deliveryDetailsPending!==true)throw new Error('Server request belum serasi. Senarai pilihan masih disimpan.');
  if(owner!==currentCustomerUid())return;
  const remaining=readCart().map(x=>{const sent=items.find(y=>y.productId===x.productId);return sent?{...x,qty:Math.max(0,Number(x.qty||1)-Number(sent.qty||1))}:x}).filter(x=>x.qty>0);saveCart(remaining);
  if(!root.isConnected)return;
  const note=d.duplicate?'Permintaan yang sama sudah disimpan. Rekod sedia ada digunakan untuk mengelakkan pendua.':'Model dan kuantiti telah disimpan dalam akaun. Admin akan semak stok pembekal, spesifikasi dan harga akhir. Tiada invois atau bayaran dibuat.';
  modal('Request Saved',`<div class="az-pc-order-card" data-customer-order="${esc(d.order.orderId)}"><div class="az-pc-order-id">${esc(d.order.quoteNo||d.order.orderId)}</div><div class="az-pc-shop-note">${esc(note)} Buka My Requests apabila sebut harga tersedia.</div><div class="az-pc-cart-actions"><button class="az-pc-shop-btn primary" data-view-orders type="button">View My Requests & Orders</button></div></div>`).querySelector('[data-view-orders]').onclick=openOrders;
 }catch(e){toast(e.message||String(e));if(root?.isConnected){btn.disabled=false;btn.textContent='Send Quote Request';refreshCheckoutBackendStatus(root,true)}}finally{clearTimeout(slow)}
}
async function requestSingleQuote(raw){addCart(raw,true)}
const flow=['order-received','processing','packed','shipped','in-transit','delivered','completed'];
function statusLabel(s){return String(s||'').replace(/-/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function legacyOrderCard(o){const idx=Math.max(0,flow.indexOf(o.fulfillmentStatus||'order-received')),doc=o.receiptNo||o.invoiceNo||o.quoteNo||'',docText=doc?esc(doc):'Order sahaja • Invoice belum dikeluarkan';return `<div class="az-pc-order-card" data-customer-order="${esc(o.orderId)}"><div class="az-pc-order-top"><div><div class="az-pc-order-id">${esc(o.orderId)}</div><div class="az-pc-cart-meta">${docText} • ${new Date(o.createdAtMs||Date.now()).toLocaleString('en-MY')}</div></div><span class="az-pc-order-state">${esc(statusLabel(o.status))}</span></div><div class="az-pc-order-items">${(o.items||[]).map(x=>`${esc(x.name)} × ${x.qty}`).join('<br>')}</div><div class="az-pc-order-timeline">${flow.map((x,i)=>`<span class="az-pc-order-step ${i<=idx?'done':''}" title="${esc(statusLabel(x))}"></span>`).join('')}</div><div class="az-pc-order-foot"><span>Payment: ${esc(statusLabel(o.paymentStatus))}</span><span>${o.trackingNumber?`${esc(o.courier||'Courier')}: ${esc(o.trackingNumber)}`:'Tracking: -'}</span><span>${o.priceConfirmed?`Total semasa: ${money(o.confirmedTotal||o.referenceSubtotal)}`:`Current: ${money(o.referenceSubtotal)}`}</span></div></div>`}
function requestOrderCard(o){
 if(!o.requestOnly)return legacyOrderCard(o);
 const expired=Number(o.quoteExpiresAtMs)>0&&Number(o.quoteExpiresAtMs)<=Date.now(),offered=o.status==='quote-ready'&&!expired;
 const notes={'quote-requested':'Permintaan disimpan. Admin sedang menyemak stok pembekal dan harga akhir.','quote-ready':'Semak jumlah akhir dan penghantaran sebelum bersetuju. Persetujuan ini belum mengenakan bayaran.','quote-accepted':'Anda telah setuju. Admin akan semak stok sekali lagi sebelum mengeluarkan invois.','quote-declined':'Sebutharga ditolak. Admin boleh menyemak semula pilihan atau harga.','awaiting-payment':'Invois telah dikeluarkan selepas persetujuan anda. Ikut arahan bayaran AZOBSS.'};
 const note=o.deliveryDetailsPending&&offered?'Harga item tersedia. Teruskan ke checkout untuk pilih penghantaran atau ambil sendiri.':expired&&!o.invoiceNo?'Sebutharga tamat. Minta admin semak stok dan harga semula.':notes[o.status]||statusLabel(o.status);
 const buttons=!o.invoiceNo&&!['cancelled','refunded'].includes(o.status)?`<div class="az-pc-cart-actions">${offered?`<button type="button" class="az-pc-shop-btn primary" data-request-action="${o.deliveryDetailsPending?'delivery':'accept'}" data-request-id="${esc(o.orderId)}" data-quote-version="${Number(o.quoteVersion)}" data-quote-total="${Number(o.confirmedTotal)}">${o.deliveryDetailsPending?'Continue to Checkout':'Accept Quote'}</button><button type="button" class="az-pc-shop-btn" data-request-action="decline" data-request-id="${esc(o.orderId)}" data-quote-version="${Number(o.quoteVersion)}">Decline</button>`:''}<button type="button" class="az-pc-shop-btn" data-request-action="cancel" data-request-id="${esc(o.orderId)}" data-quote-version="${Number(o.quoteVersion)}">Cancel Request</button></div>`:'';
 return `<div class="az-pc-order-card" data-customer-order="${esc(o.orderId)}"><div class="az-pc-order-top"><div><div class="az-pc-order-id">${esc(o.quoteNo||o.orderId)}</div><div class="az-pc-cart-meta">${esc(o.orderId)} · ${new Date(o.createdAtMs).toLocaleString('en-MY')}</div></div><span class="az-pc-order-state">${esc(statusLabel(o.status))}</span></div><div class="az-pc-order-items">${(o.items||[]).map(x=>`${esc(x.name)}${x.optionLabel?` · ${esc(x.optionLabel)}`:''} × ${Number(x.qty)}${agreedLinePrice(x)}`).join('<br>')}</div><div class="az-pc-cart-summary"><div class="az-pc-cart-summary-row"><span>Reference subtotal</span><b>${money(o.referenceSubtotal)}</b></div>${o.priceConfirmed?`<div class="az-pc-cart-summary-row"><span>Quoted items</span><b>${money(o.confirmedItemTotal)}</b></div><div class="az-pc-cart-summary-row"><span>Delivery</span><b>${o.deliveryDetailsPending?(o.fixedDeliveryOffer?money(o.fixedDeliveryOffer.charge)+' / RM0 ambil sendiri':'To be confirmed'):money(o.shippingCharge)}</b></div><div class="az-pc-cart-summary-row total"><span>${o.deliveryDetailsPending?'Items subtotal':'Final quote'}</span><b>${money(o.confirmedTotal)}</b></div>`:''}</div><div class="az-pc-shop-note">${esc(note)}${o.quoteExpiresAtMs&&!o.invoiceNo?`<br>Quote valid until: ${new Date(o.quoteExpiresAtMs).toLocaleString('en-MY')}. Stok belum ditempah.`:''}${o.invoiceNo?`<br>Invoice: ${esc(o.invoiceNo)} · ${esc(statusLabel(o.paymentStatus))}`:''}</div>${buttons}</div>`
}
async function requestDecision(button){
 const action=button.dataset.requestAction,id=button.dataset.requestId,quoteVersion=Number(button.dataset.quoteVersion);
 const prompt=action==='accept'?`Setuju dengan jumlah akhir ${money(button.dataset.quoteTotal)}? Admin akan sahkan stok semula sebelum invois.`:action==='decline'?'Tolak sebut harga ini?':'Batalkan permintaan ini?';if(!confirm(prompt))return;
 button.disabled=true;try{const headers=Object.assign({'Content-Type':'application/json'},await requireLogin()),r=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders/'+encodeURIComponent(id)+'/decision',{method:'POST',headers,body:JSON.stringify({action,quoteVersion})},25000,'Quote decision'),d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.message||d.error||'Request failed');toast(action==='accept'?'Persetujuan disimpan. Tunggu pengesahan akhir admin.':'Pilihan anda telah disimpan.');await openOrders(id,'quote')}catch(e){toast(e.message||e);button.disabled=false}
}
let customerViewGeneration=0;
const currentCustomerUid=()=>String(window.azobssGetCurrentFirebaseUid?.()||'');
function orderCard(o){return (o.requestOnly?requestOrderCard(o):legacyOrderCard(o))+(window.AZOBSSTechDelivery?.orderDelivery(o)||'')+(window.AZOBSSPcDocuments1541?.actions(o)||'');}
async function openOrders(selectedOrderId,selectedDocument=''){
 const entry=new URL(location.href),focused=typeof selectedOrderId==='string'?selectedOrderId:selectedOrderId===undefined?entry.searchParams.get('order')||'':'',kind=selectedDocument||(!selectedOrderId?entry.searchParams.get('document')||'':'');
 const generation=++customerViewGeneration,root=modal('My Requests & Orders','<div class="az-pc-shop-empty">Loading your requests and orders…</div>');let owner='';
 const live=()=>root.isConnected&&generation===customerViewGeneration&&owner===currentCustomerUid();
 try{
  const h=await requireLogin();owner=currentCustomerUid();root.dataset.pcCustomerOwner=owner;
  const r=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders'+(focused?'/'+encodeURIComponent(focused):''),{headers:h,cache:'no-store'},22000,'Requests server'),d=await r.json().catch(()=>({}));if(!live())return;if(!r.ok||!d.ok)throw new Error(orderErrorMessage(r,d));
  const orders=focused?[d.order]:d.orders||[],body=root.querySelector('.az-pc-shop-modal-body');
  body.innerHTML='<div class="az-pc-cart-actions"><button type="button" class="az-pc-shop-btn" data-open-pc-list>← My Cart</button><button type="button" class="az-pc-shop-btn" data-all-requests>All Requests & Orders</button><button type="button" class="az-pc-shop-btn" data-refresh-requests>Refresh</button></div>'+(orders.length?'<div class="az-pc-orders-list">'+orders.map(o=>focused?'<div class="az-pc-order-card az-pc-request-focused1538" data-customer-order="'+esc(o.orderId)+'" tabindex="-1">'+(window.AZOBSSPcDocuments1541?.details(o,kind)||orderCard(o))+(kind==='quote'||!o.invoiceNo?requestOrderCard(o):'')+(window.AZOBSSTechDelivery?.orderDelivery(o)||'')+'</div>':orderCard(o)).join('')+'</div>':'<div class="az-pc-shop-empty">No requests yet. Add products to My Cart, then Request Quote.</div>');
  body.querySelectorAll('[data-request-action]').forEach(b=>b.onclick=()=>{
   if(b.dataset.requestAction!=='delivery')return requestDecision(b);
   if(root.id==='azCheckoutStage')return openDeliveryCheckout(orders.find(o=>o.orderId===b.dataset.requestId));
   location.href='/checkout/?order='+encodeURIComponent(b.dataset.requestId)+'&document=quote';
  });
  body.querySelectorAll('[data-open-document]').forEach(b=>b.onclick=()=>{
   if(b.dataset.openDocument==='invoice'&&root.id!=='azCheckoutStage'){location.href='/checkout/?order='+encodeURIComponent(b.dataset.documentOrder)+'&document=invoice';return;}
   openOrders(b.dataset.documentOrder,b.dataset.openDocument);
  });
  body.querySelectorAll('[data-download-document]').forEach(b=>b.onclick=async()=>{const message=body.querySelector('[data-document-message]');b.disabled=true;try{const h=await requireLogin();if(!live())return;const r=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders/'+encodeURIComponent(b.dataset.documentOrder)+'/documents/'+b.dataset.downloadDocument,{headers:h,cache:'no-store'},22000,'Document server'),d=await r.json();if(!live())return;if(!r.ok||!d.ok)throw Error(d.message||'Document unavailable. Refresh this order.');const pdf=await window.AZOBSSPcDocuments1541.pdf();if(live())pdf.download(d.document.pdf,d.document.kind==='quote'?'quotation':d.document.kind);}catch(e){if(live()&&message)message.textContent=e.message||'Download failed. Please retry.';}finally{b.disabled=false;}});
  body.querySelector('[data-payment-report]')?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,b=form.querySelector('button'),message=body.querySelector('[data-document-message]');b.disabled=true;try{const h=await requireLogin();if(!live())return;const r=await fetchWithTimeout(BACKEND+'/api/pc-shop/orders/'+encodeURIComponent(focused)+'/payment-report',{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({reference:form.elements.reference.value})},22000,'Payment reference'),d=await r.json();if(!live())return;if(!r.ok||!d.ok)throw Error(d.message||'Unable to submit reference.');await openOrders(focused,'invoice');}catch(e){if(live()&&message)message.textContent=e.message||'Unable to submit reference.';b.disabled=false;}});
  body.querySelector('[data-open-pc-list]').onclick=()=>openCart(false);
  body.querySelector('[data-all-requests]').onclick=()=>{const u=new URL(location.href);u.searchParams.delete('order');u.searchParams.delete('document');history.replaceState(null,'',u);openOrders('');};
  body.querySelector('[data-refresh-requests]').onclick=()=>openOrders(focused,kind);
  if(focused&&d.order?.canPay){const delay=Math.max(0,Number(d.order.invoiceExpiresAtMs)-Date.now());const timer=setTimeout(()=>{if(!live())return;body.querySelector('.az-pc-payment1541')?.remove();const badge=body.querySelector('[data-document-status]');if(badge&&body.querySelector('[data-document-kind="invoice"]')){badge.dataset.documentStatus='expired';badge.textContent='Expired';}const message=body.querySelector('[data-document-message]');if(message)message.textContent='This invoice has expired. Contact AZOBSS to recheck supplier stock before making payment.';},Math.min(delay,2147483647));modalAbort?.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});}
  if(focused)body.querySelector('[data-customer-order]')?.focus({preventScroll:true});
 }catch(e){if(!root.isConnected||generation!==customerViewGeneration)return;const body=root.querySelector('.az-pc-shop-modal-body');if(body)body.innerHTML='<div class="az-pc-shop-empty">'+esc(e.message||e)+'<div class="az-pc-cart-actions"><button class="az-pc-shop-btn primary" data-orders-retry type="button">Try again</button><a class="az-pc-shop-btn" href="/?next='+encodeURIComponent('/PC-Build/?requests=1')+'#login">Sign in</a></div></div>';body?.querySelector('[data-orders-retry]')?.addEventListener('click',()=>openOrders(focused,kind),{once:true});}
}
window.addEventListener('azobss:auth-state-ready',()=>{const root=document.querySelector('[data-pc-customer-owner]');if(root&&root.dataset.pcCustomerOwner!==currentCustomerUid()){customerViewGeneration++;if(root.id==='azCheckoutStage'){delete root.dataset.pcCustomerOwner;root.replaceChildren();window.dispatchEvent(new Event('azobss:checkout-account-change'));}else closeModal(false);}});
window.azobssPcRequestQuote=()=>openCheckout('quote');window.addEventListener('azobss-pc-list-updated',updateCartFab);window.azobssOpenPcCart=()=>openCart(false);window.azobssOpenPcRequests=openOrders;

async function preflight(){const st=await checkBackend(true);if(!st.ready)console.warn('AZOBSS PC Shop backend not ready:',st.message);else if(st.release&&st.release!=='1506')console.info('AZOBSS PC Shop compatible backend release:',st.release)}
function init(){if(document.getElementById('azCheckoutStage'))return;if(/^\/cart\/?$/i.test(location.pathname)){
 const entry=new URL(location.href);
 if(entry.searchParams.get('quote')==='1'){
  const url=new URL(location.href);url.searchParams.delete('quote');history.replaceState(null,'',url);openCheckout();
 }
 if(entry.searchParams.get('requests')==='1')openOrders();
 return;
 }ensureShell();document.addEventListener('click',e=>{const b=e.target.closest?.('[data-az-shop-cart-toggle],#cartBtn,[data-action="cart"],#cartBtnGlobal,#btnCartGlobal,button[aria-label="Cart"],a[aria-label="Cart"]');if(b){e.preventDefault();e.stopImmediatePropagation();openCart(false);}},{capture:true});const entry=new URL(location.href).searchParams;if(entry.get('requests')==='1')openOrders();else if(entry.get('quote')==='1'){
 let openingQuote=false;
 const consumeQuote=async()=>{
   if(openingQuote)return;
   openingQuote=true;
   try{await requireLogin();}catch{openingQuote=false;return;}
   if(!readCart().length){location.replace('/cart/');return;}
   openCheckout('quote').then(()=>{
     openingQuote=false;
     if(!document.querySelector('[data-submit-order]'))return;
     const url=new URL(location.href);url.searchParams.delete('quote');history.replaceState(null,'',url);
   });
 };
 consumeQuote();
 window.addEventListener('azobss:auth-state-ready',()=>{
   if(new URL(location.href).searchParams.get('quote')==='1'&&currentCustomerUid()&&!document.querySelector('[data-submit-order]'))consumeQuote();
 });
}else if(entry.get('list')==='1')openCart(false);window.addEventListener('azobss:pc-admin-view-change',()=>{document.querySelectorAll('[data-pc-admin-source]').forEach(el=>el.remove());renderHardware();reloadAdminCatalogue()});try{cleanupPcShopModalState('init')}catch(e){console.warn('AZOBSS modal cleanup init:',e)}window.addEventListener('azobss:pc-visibility-change',setSyncStatus);renderHardware();loadCatalog();loadStorefrontSnapshot();watchPcCards();preflight();window.addEventListener('storage',e=>{if(e.key===CART_KEY){if(catalogMeta.mode==='live')syncCartPrices(true);updateCartFab()}});window.addEventListener('focus',()=>{try{cleanupPcShopModalState('focus')}catch(_){}});window.addEventListener('pageshow',()=>{try{cleanupPcShopModalState('pageshow')}catch(_){}});document.addEventListener('visibilitychange',()=>{if(!document.hidden)try{cleanupPcShopModalState('visible')}catch(_){}});document.addEventListener('azobss:session-resume',()=>{try{cleanupPcShopModalState('session-resume')}catch(_){}});setInterval(()=>{try{if(document.querySelector('.az-pc-shop-backdrop')||document.body.classList.contains('az-pc-shop-modal-open'))cleanupPcShopModalState('interval')}catch(_){}},2500);if(typeof window.azobssLongSessionInterval==='function')window.azobssLongSessionInterval(loadCatalog,10*60*1000);else setInterval(loadCatalog,10*60*1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
