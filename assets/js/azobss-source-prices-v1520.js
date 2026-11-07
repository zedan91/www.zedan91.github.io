(function(){
'use strict';
const backend='https://azobss-backend.onrender.com/api/admin/pc-shop/';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'RM'+Number(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
let records=new Map(),errors=new Map(),pending=new Set(),controllers=new Set(),generation=0,active=false,pdfUrl='';
const scopes=location.pathname.toLowerCase().startsWith('/upgrade-parts')?['upgrade']:['pc','builds'];
function isAdmin(){
 try{
  if(typeof window.isAdminViewer==='function')return window.isAdminViewer()===true;
  return document.body?.classList.contains('az-role-is-admin')||document.body?.classList.contains('is-admin')||document.body?.getAttribute('data-role')==='admin';
 }catch(_){return false;}
}
const notify=()=>{
 for(const el of document.querySelectorAll('[data-source-price-product]')){
  try{el.outerHTML=panel(JSON.parse(el.getAttribute('data-source-price-product')));}catch(_){el.remove();}
 }
 window.dispatchEvent(new Event('azobss:source-prices-change'));
};
const isPricelistVariant=id=>/^VNP-[a-zA-Z0-9-]+--\d+$/.test(String(id));
const scopeFor=id=>records.get(String(id))?.scope||(String(id).startsWith('VNP-')&&!isPricelistVariant(id)?'upgrade':'pc');
function dateLabel(value){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value.split('-').reverse().join('/');
 const d=new Date(value||'');return Number.isFinite(d.getTime())?d.toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}):'Tarikh tidak tersedia';
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch(_){return '';}}
function failureMessage(code){
 if(code==='login_required')return 'Sesi login admin belum tersedia. Log masuk semula jika sesi telah tamat.';
 if(code==='admin_required')return 'Server belum mengesahkan akses admin. Sila semak sesi login anda.';
 if(['source_price_key_unavailable','source_price_decryption_failed','source_price_data_missing'].includes(code))return 'Data pricelist asal belum tersedia pada server. Ini masalah pemuatan data, bukan pengesahan harga produk.';
 if(code==='timeout')return 'Sambungan ke server mengambil masa terlalu lama. Cuba semula.';
 return 'Harga asal gagal dimuatkan daripada server. Cuba semula selepas sambungan pulih.';
}
function panel(product){
 if(!isAdmin())return '';
 const publicProduct={id:String(product.id),options:product.options||[{label:product.optionLabel||'Seunit',price:Number(product.price)}]};
 return `<div data-pc-admin-source data-source-price-product="${esc(JSON.stringify(publicProduct))}">${panelContent(publicProduct)}</div>`;
}
function panelContent(product){
 if(!isAdmin())return '';
 const id=String(product.id),r=records.get(id),scope=scopeFor(id),options=product.options||[{label:'Seunit',price:Number(product.price)}];
 const waiting=pending.has(scope)||(!active&&!errors.has(scope));
 const unavailable=`<aside class="az-source-price" data-pc-admin-source><b>Harga asal · Admin</b><p>${esc(waiting?'Memuatkan harga asal…':errors.has(scope)?failureMessage(errors.get(scope)):'Rekod harga asal belum tersedia untuk item ini.')}</p>${waiting?'':'<button type="button" data-source-price-retry>Cuba semula</button>'}</aside>`;
 if(!r)return unavailable;
 const exact=r.options?.length===options.length&&r.options.every((o,i)=>(scope!=='upgrade'&&!isPricelistVariant(id))||o.label===options[i].label);
 if(!exact)return '<aside class="az-source-price" data-pc-admin-source><b>Semakan diperlukan</b><p>Varian pricelist tidak sepadan. Rujuk model dan kapasiti asal.</p></aside>';
 const complete=r.options.every(o=>valid(o.cost)&&valid(o.expectedPrice));
 const matching=complete&&options.every((o,i)=>Math.abs(o.price-r.options[i].expectedPrice)<0.005);
 const label=!complete?'Harga belum disahkan':matching?'Harga jual sepadan dengan rekod':'Harga jual tidak sepadan dengan rekod';
 const sourceUrl=safeUrl(r.sourceUrl);
 return `<aside class="az-source-price is-compact" data-pc-admin-source><div class="az-source-price-heading"><b>Harga asal · Admin</b><span class="${matching?'is-match':'is-warning'}" title="${esc(label)}">${!complete?'Belum disahkan':matching?'Sepadan':'Semak harga'}</span></div><div class="az-source-price-scroll"><table><thead><tr>${options.length>1?'<th>Pilihan</th>':''}<th>Asal</th><th>Jual</th><th>Tambahan</th></tr></thead><tbody>${options.map((o,i)=>{
  const original=r.options[i],difference=valid(original.cost)?o.price-original.cost:null;
  return `<tr>${options.length>1?`<th>${esc(o.label)}</th>`:''}<td>${valid(original.cost)?money(original.cost):'—'}</td><td>${money(o.price)}</td><td>${difference===null?'—':(difference>=0?'+':'−')+money(Math.abs(difference))}</td></tr>${valid(original.expectedPrice)&&Math.abs(o.price-original.expectedPrice)>=0.005?`<tr class="az-source-price-warning"><td colspan="${options.length>1?4:3}">Rekod jual: ${money(original.expectedPrice)} · Perbezaan: ${money(Math.abs(o.price-original.expectedPrice))}</td></tr>`:''}`;
 }).join('')}</tbody></table></div><div class="az-source-price-links">${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">${esc(r.sourceName||'Produk asal')} ↗</a>`:`<span>${esc(r.sourceName||'Sumber asal')}</span>`}${scope==='upgrade'||r.sourceRecordId?`<button type="button" data-source-price-pdf="${Number(r.sourcePage)||1}">Pricelist · m/s ${Number(r.sourcePage)||1} ↗</button>`:''}</div><details><summary>Butiran rekod</summary><p>${esc(dateLabel(r.sourceDate))} · ${r.priceStatus==='live'&&r.available?'Semakan server':'Rekod bertarikh · belum disemak semula; bukan sync automatik'}</p>${r.sourceLine?`<p>${esc(r.sourceLine)}</p>`:''}</details></aside>`;
}
async function authHeaders(force,signal){
 let headers={...await window.azobssGetFirebaseAuthHeaders?.(force)};
 if(!headers.Authorization&&typeof window.azobssWaitForFirebaseAuthToken==='function'){
  const token=await window.azobssWaitForFirebaseAuthToken(force,12000);
  if(token)headers.Authorization='Bearer '+token;
 }
 // Reuse only the administrator's already-configured fallback, just like the
 // existing order dashboard; the server still verifies this credential.
 try{const key=window.sessionStorage?.getItem('azobssAdminApiKey')||window.localStorage?.getItem('azobssAdminApiKey')||window.localStorage?.getItem('azobssLuckyDrawAdminKey');if(key)headers['x-admin-key']=key;}catch(_){}
 if(signal.aborted||!isAdmin())throw Error('admin_required');
 if(!headers.Authorization&&!headers['x-admin-key'])throw Error('login_required');
 return headers;
}
async function request(path,signal){
 if(!isAdmin())throw Error('admin_required');
 let response;
 for(let attempt=0;attempt<2;attempt++){
  const headers=await authHeaders(attempt===1,signal);
  response=await fetch(backend+path,{headers,cache:'no-store',signal});
  if(response.ok)return response;
  if((response.status===401||response.status===403)&&attempt===0)continue;
  const data=await response.json().catch(()=>({}));
  throw Error(response.status===401?'login_required':response.status===403?'admin_required':data.error||'source_unavailable');
 }
 throw Error('admin_required');
}
async function load(scope){
 const token=generation,controller=new AbortController();controllers.add(controller);pending.add(scope);errors.delete(scope);
 const timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await request('source-prices?scope='+encodeURIComponent(scope),controller.signal),data=await response.json();
  if(!data.ok||!Array.isArray(data.records))throw Error('invalid_source_prices');
  if(token!==generation||!isAdmin())return;
  for(const row of data.records)records.set(String(row.id),{...row,scope});
 }catch(e){if(token===generation&&isAdmin())errors.set(scope,controller.signal.aborted?'timeout':e.message);}
 finally{clearTimeout(timer);controllers.delete(controller);if(token===generation){pending.delete(scope);if(isAdmin())notify();}}
}
function sync(force=false){
 const admin=isAdmin();
 if(!admin){
  if(active){generation++;for(const c of controllers)c.abort();controllers.clear();records.clear();pending.clear();errors.clear();if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl='';active=false;document.querySelectorAll('[data-pc-admin-source]').forEach(el=>el.remove());notify();}
  return;
 }
 if(active&&!force)return;
 generation++;for(const c of controllers)c.abort();controllers.clear();pending.clear();active=true;
 for(const scope of scopes)load(scope);notify();
}
async function openPdf(button){
 const controller=new AbortController(),token=generation;controllers.add(controller);button.disabled=true;
 const timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await request('source-pricelist.pdf',controller.signal),blob=await response.blob();
  if(token!==generation||!isAdmin())return;
  if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(blob);
  // An ordinary visible link works even when a browser blocks delayed popups.
  const a=document.createElement('a');a.href=pdfUrl+'#page='+(Number(button.dataset.sourcePricePdf)||1);a.target='_blank';a.rel='noopener';a.textContent='Buka PDF asal ↗';a.dataset.pcAdminSource='';
  button.replaceWith(a);a.click();
 }catch(_){if(token===generation&&isAdmin()){button.disabled=false;button.textContent='PDF asal gagal dimuatkan · Cuba lagi';}}
 finally{clearTimeout(timer);controllers.delete(controller);}
}
window.AZOBSSSourcePrices={panel,isAdmin,refresh:()=>sync(true)};
function init(){
 new MutationObserver(()=>sync()).observe(document.body,{attributes:true,attributeFilter:['class','data-role']});
 window.addEventListener('azobss:pc-admin-view-change',()=>sync());
 window.addEventListener('storage',()=>sync());
 for(const name of ['azobss:auth-state-ready','azobss:global-auth-ready','azobss-auth-changed'])window.addEventListener(name,()=>{if(isAdmin()&&!pending.size&&(!active||errors.size||!records.size))sync(true);else sync();});
 document.addEventListener('click',e=>{const retry=e.target.closest('[data-source-price-retry]');if(retry){sync(true);return;}const button=e.target.closest('[data-source-price-pdf]');if(button&&isAdmin())openPdf(button);});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
