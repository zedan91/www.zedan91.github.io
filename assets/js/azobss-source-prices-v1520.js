(function(){
'use strict';
const backend='https://azobss-backend.onrender.com/api/admin/pc-shop/';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'RM'+Number(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
let records=new Map(),errors=new Set(),pending=new Set(),controllers=new Set(),generation=0,active=false,pdfUrl='';
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
const scopeFor=id=>String(id).startsWith('VNP-')?'upgrade':records.get(String(id))?.scope||'pc';
function dateLabel(value){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value||''))return value.split('-').reverse().join('/');
 const d=new Date(value||'');return Number.isFinite(d.getTime())?d.toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}):'Tarikh tidak tersedia';
}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch(_){return '';}}
function panel(product){
 if(!isAdmin())return '';
 const publicProduct={id:String(product.id),options:product.options||[{label:'Seunit',price:Number(product.price)}]};
 return `<div data-pc-admin-source data-source-price-product="${esc(JSON.stringify(publicProduct))}">${panelContent(publicProduct)}</div>`;
}
function panelContent(product){
 if(!isAdmin())return '';
 const id=String(product.id),r=records.get(id),scope=scopeFor(id),options=product.options||[{label:'Seunit',price:Number(product.price)}];
 const unavailable=`<aside class="az-source-price" data-pc-admin-source><b>Harga asal · Admin</b><p>${pending.has(scope)||(!active&&!errors.has(scope))?'Memuatkan harga asal…':'Harga asal belum dapat disahkan untuk item ini.'}</p><button type="button" data-source-price-retry>Cuba semula</button></aside>`;
 if(!r)return unavailable;
 const exact=r.options?.length===options.length&&r.options.every((o,i)=>scope!=='upgrade'||o.label===options[i].label);
 if(!exact)return '<aside class="az-source-price" data-pc-admin-source><b>Semakan diperlukan</b><p>Varian pricelist tidak sepadan. Rujuk model dan kapasiti asal.</p></aside>';
 const complete=r.options.every(o=>valid(o.cost)&&valid(o.expectedPrice));
 const matching=complete&&options.every((o,i)=>Math.abs(o.price-r.options[i].expectedPrice)<0.005);
 const label=!complete?'Harga belum disahkan':matching?'Harga jual sepadan dengan rekod':'Harga jual tidak sepadan dengan rekod';
 const sourceUrl=safeUrl(r.sourceUrl);
 return `<aside class="az-source-price" data-pc-admin-source><div class="az-source-price-heading"><b>Harga asal · Admin</b><span class="${matching?'is-match':'is-warning'}">${esc(label)}</span></div><div class="az-source-price-scroll"><table><thead><tr><th>Pilihan</th><th>Asal</th><th>Jual</th><th>Beza</th></tr></thead><tbody>${options.map((o,i)=>{
  const original=r.options[i],difference=valid(original.cost)?o.price-original.cost:null;
  return `<tr><th>${esc(o.label==='Harga'?'Seunit':o.label)}</th><td>${valid(original.cost)?money(original.cost):'Belum disahkan'}</td><td>${money(o.price)}</td><td>${difference===null?'—':(difference>=0?'+':'−')+money(Math.abs(difference))}</td></tr>${valid(original.expectedPrice)&&Math.abs(o.price-original.expectedPrice)>=0.005?`<tr class="az-source-price-warning"><td colspan="4">Harga jual mengikut rekod: ${money(original.expectedPrice)} · Perbezaan: ${money(Math.abs(o.price-original.expectedPrice))}</td></tr>`:''}`;
 }).join('')}</tbody></table></div><p>${esc(r.sourceName||'Sumber asal')} · ${esc(dateLabel(r.sourceDate))}${r.sourcePage?' · Muka surat '+esc(r.sourcePage):''}</p><p class="az-source-price-note">${r.priceStatus==='live'&&r.available?'Harga sumber disemak oleh server pada masa di atas.':'Harga asal ialah rekod bertarikh. Belum disemak semula dengan sumber terkini; bukan sync automatik.'} Beza ialah tambahan harga jual.</p>${sourceUrl?`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Bandingkan produk asal ↗</a>`:''}${scope==='upgrade'?`<button type="button" data-source-price-pdf="${Number(r.sourcePage)||1}">Buka pricelist asal · m/s ${Number(r.sourcePage)||1} ↗</button>`:''}${r.sourceLine?`<details><summary>Baris asal dalam pricelist</summary><p>${esc(r.sourceLine)}</p></details>`:''}</aside>`;
}
async function request(path,signal){
 if(!isAdmin())throw Error('admin_required');
 const headers=await window.azobssGetFirebaseAuthHeaders?.(false);
 if(!headers?.Authorization)throw Error('login_required');
 if(!isAdmin()||signal.aborted)throw Error('admin_required');
 const response=await fetch(backend+path,{headers,cache:'no-store',signal});
 if(!response.ok)throw Error('source_unavailable');return response;
}
async function load(scope){
 const token=generation,controller=new AbortController();controllers.add(controller);pending.add(scope);errors.delete(scope);
 const timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await request('source-prices?scope='+encodeURIComponent(scope),controller.signal),data=await response.json();
  if(!data.ok||!Array.isArray(data.records))throw Error('invalid_source_prices');
  if(token!==generation||!isAdmin())return;
  for(const row of data.records)records.set(String(row.id),{...row,scope});
 }catch(_){if(token===generation&&isAdmin())errors.add(scope);}
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
 document.addEventListener('click',e=>{const retry=e.target.closest('[data-source-price-retry]');if(retry){sync(true);return;}const button=e.target.closest('[data-source-price-pdf]');if(button&&isAdmin())openPdf(button);});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
