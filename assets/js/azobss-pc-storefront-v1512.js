(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(Number(n)||0);
const useGroups={office:'Office',drone:'Drones',nas:'NAS & Servers',workstation:'Workstation','gaming-entry':'Gaming · Entry level','gaming-mid':'Gaming · Mid range','gaming-high':'Gaming · High end','gaming-other':'Gaming · Accessories / other'};
const storeName=p=>window.AZOBSSPcModel?.stores?.[p.storeId]||p.storeName||p.storeId||'Other';
let sharedFocused='';
const PAGE_SIZE=24;let page=1,lastFilter='',rows=[],actions={},bound=false;
const HUB_GROUPS=new Set(['all','prebuilt','components','accessories']);
function hubGroupFromUrl(href){
 const section=new URL(href).searchParams.get('section');
 return HUB_GROUPS.has(section)?section:'all';
}
let hubGroup=hubGroupFromUrl(window.location?.href||'https://www.azobss.com/PC-Build/');
const COMPONENT_CATEGORIES=new Set(['CPU','Motherboard','RAM','SSD','Hard Drive','Power Supply','Cooling','Casing','Case','GPU','Intel CPUs','AMD CPUs','Desktop Memory','Laptop Memory','Sound Cards','Optical Drives','CPU Coolers','Liquid Cooling','Cases','Case Fans','SATA SSDs','NVMe SSDs','External SSDs','Hard Drives','Portable Hard Drives','Desktop External Drives','Power Supplies','Intel Motherboards','AMD Motherboards','Graphics Cards','Workstation Graphics','NAS & Servers','NAS Enclosures']);
function productGroup(p){if(window.AZOBSSPcModel?.category(p)==='NAS & Servers')return 'components';if(['prebuilt','components','accessories'].includes(p.catalogGroup))return p.catalogGroup;if(p.type==='laptop'||p.type==='desktop'||/WORKSTATION PC PACKAGE/i.test(p.name||''))return 'prebuilt';return COMPONENT_CATEGORIES.has(p.category)?'components':'accessories';}
function syncHubNav(){document.querySelectorAll('[data-pc-hub-group]').forEach(a=>{if(a.dataset.pcHubGroup===hubGroup)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function setHubGroup(group){if(!HUB_GROUPS.has(group))return;hubGroup=group;page=1;const u=new URL(location.href);u.searchParams.set('section',group);u.searchParams.delete('model');u.searchParams.delete('catalog');u.searchParams.delete('q');u.hash='';history.replaceState(null,'',u);for(const id of ['azPcShopCategory','azPcShopBrand','azPcShopStore','azPcShopUse']){const e=document.getElementById(id);if(e)e.value='all';}const q=document.getElementById('azPcShopSearch');if(q)q.value='';syncHubNav();draw();}
function manufacturerLink(p){try{const u=new URL(p.specSourceUrl||'');if(u.protocol==='https:'&&/(?:^|\.)(?:intel\.com|amd\.com|asus\.com|gigabyte\.com|msi\.com|tp-link\.com|logitech\.com|epson\.com(?:\.(?:my|sg|br|ph|mt))?|brother\.com\.my|canon|dlink\.com|totolink\.tw|sony\.com|sony\.co\.jp|sony\.jp|audio-technica\.co\.jp|creative\.com|razer\.com|logitechg\.com|netgear\.com|dji\.com|synology\.com|synologydownload\.com|ugreen\.com|kingston\.com|samsung\.com|seagate\.com|westerndigital\.com|coolermaster\.com|deepcool\.com|arctic\.de|corsair\.com|nzxt\.com|tryxzone\.com|tcomastech\.com|invasion\.com\.my)$/.test(u.hostname))return `<a class="az-store-spec-source" href="${esc(u.href)}" target="_blank" rel="noopener">Manufacturer specifications ↗</a>`;}catch(_){}return '';}
function matchesSearch(p,q){if(!q)return true;const clean=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');const hay=clean([p.name,p.displayName,p.category,brand(p),...(actions.isAdmin?.()===true?[storeName(p)]:[]),...(p.specs||[])].join(' '));return q.split(/\s+/).filter(Boolean).every(s=>hay.includes(clean(s)));}
function brand(p){
 const title=String(p.name||p.displayName||'');
 if(productGroup(p)==='prebuilt'){
  if(/\bMicrosoft\s+Surface\b/i.test(title))return 'MICROSOFT';
  if(/\bJOI\s+(?:IDEA|GAMING\s+PC)\b/i.test(title))return 'JOI';
 }
 return String(p.brand||title.split(/\s+/)[0]||'Lain-lain').replace(/[^\w.-]/g,'').toUpperCase();
}
function adminSourceMetadata(p){
 if(actions.isAdmin?.()!==true)return '';
 const audit=window.AZOBSSSourcePrices?.panel?.(p);if(audit)return audit;
 let url='';try{const u=new URL(String(p.sourceUrl||''));if(u.protocol==='https:')url=u.href;}catch{}
 const date=new Date(p.priceCheckedAt||p.sourceCheckedAt||'');
 return `<details class="az-store-source" data-pc-admin-source><summary>${esc(p.sourceName||p.storeName||'Sumber asal')}</summary>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Produk asal ↗</a>`:''}${Number.isFinite(date.getTime())?`<div>Harga sumber direkod: ${esc(date.toLocaleString('ms-MY'))}</div>`:''}</details>`;
}
function title(p){return String(p.displayName||p.name||'');}
function facts(p){
 const groups=new Map(),other=[];
 for(const raw of p.specs||[]){const s=String(raw).trim();if(!s||/^Model:|Spesifikasi dan konfigurasi tepat|WE APP|general specifications$/i.test(s))continue;let key='';
  if(/^(?:CPU(?: \/ Processor)?|Processor)\s*:/i.test(s))key='CPU';
  else if(/^(?:RAM|Memory)\s*:/i.test(s))key='RAM';
  else if(/^(?:Storage|Storan)\s*:/i.test(s))key='Storage';
  else if(/^(?:Graphics?|Graphic Card|Grafik)\s*:/i.test(s))key='Graphics';
  else if(/^(?:Operating System|Operation System|Sistem operasi|OS)\s*:/i.test(s))key='OS';
  if(key){const previous=groups.get(key);if(!previous||s.length>previous.length)groups.set(key,s);}else if(!/^Konfigurasi:\s*(?:Intel|ATI|H&S|HS\+M365)$/i.test(s))other.push(s);
 }
 return [...['CPU','RAM','Storage','Graphics','OS'].filter(k=>groups.has(k)).map(k=>groups.get(k)),...other.filter((s,i,a)=>a.indexOf(s)===i)];
}
function card(p){
 const status='Reference price · Supplier stock confirmation required';
 const specs=facts(p);
 const share='<button class="az-store-share" type="button" title="Share product" aria-label="Share '+esc(title(p))+'" data-store-share="'+esc(p.id)+'"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 12l8-5m-8 5 8 5"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/></svg></button>';
 const compare=actions.isAdmin?.()===true?'<button type="button" class="az-store-details" data-store-compare="'+esc(p.id)+'">Compare suppliers</button>':'';

 return `<article class="az-store-product" data-store-product="${esc(p.id)}">${p.photoUnavailable?'<div class="az-store-photo is-unavailable">':`<button class="az-store-photo" type="button" data-store-image="${esc(p.id)}" aria-label="Enlarge photo of ${esc(title(p))}">`}<img src="${esc(p.image)}" alt="${p.photoUnavailable?'Model photo pending':esc(title(p))}" width="640" height="640" loading="lazy" decoding="async">${p.photoUnavailable?'<span class="az-store-photo-note">Photo pending</span></div>':(p.imageKind==='series'?'<span class="az-store-photo-note">Series photo</span></button>':'</button>')}<div class="az-store-product-copy"><div class="az-store-category">${esc(p.category)} <span>${esc(brand(p))}</span></div><div class="az-store-name"><h3>${esc(title(p))}</h3>${share}</div>${actions.isAdmin?.()===true?`<small class="az-store-supplier">${esc(storeName(p))}</small>`:''}<ul>${specs.slice(0,4).map(s=>`<li>${esc(s)}</li>`).join('')}</ul><button type="button" class="az-store-details" data-store-details="${esc(p.id)}">Specifications &amp; details ↗</button>${compare}<div class="az-store-price">${money(p.price)}</div><div class="az-store-stock">${esc(status)}</div>${adminSourceMetadata(p)}<div class="az-store-actions"><button type="button" data-store-add="${esc(p.id)}">＋ Add to List</button><button type="button" class="primary" data-store-buy="${esc(p.id)}">Request Quote</button></div></div></article>`;
}
function listRow(p){
 const id=esc(p.id),name=esc(title(p));
 const img='<img src="'+esc(p.image)+'" alt="'+(p.photoUnavailable?'Model photo pending':name)+'" width="48" height="48" loading="lazy" decoding="async">';
 const photo=p.photoUnavailable
  ? '<div class="az-store-list-photo">'+img+'</div>'
  : '<button class="az-store-list-photo" type="button" data-store-image="'+id+'" aria-label="Enlarge photo of '+name+'">'+img+'</button>';
 return '<article class="az-store-product az-store-list-row" data-store-product="'+id+'">'+photo+
  '<div class="az-store-list-identity"><span class="az-store-category">'+esc(p.category)+'</span><h3>'+name+'</h3></div>'+
  '<div class="az-store-price">'+money(p.price)+'</div><button type="button" class="az-store-details" data-store-details="'+id+'">Specifications &amp; details ↗</button></article>';
}
async function shareProduct(p,button){
 const url=new URL(window.AZOBSSPcModel.productUrl(p),location.origin).href;
 try{
   if(navigator.share)await navigator.share({title:title(p),url});
   else {await navigator.clipboard.writeText(url);button.title='Link copied';}
 }catch(error){if(error.name!=='AbortError')prompt('Copy product link',url);}
}
function compareProduct(p){
 if(actions.isAdmin?.()!==true)return;
 const model=window.AZOBSSPcModel,keys=new Set(model.comparisonKeys(p));
 const matches=rows.filter(row=>row.id===p.id||model.comparisonKeys(row).some(key=>keys.has(key)));
 const root=actions.modal('Compare suppliers · '+title(p),'<label>Sort prices <select data-compare-sort><option value="low">Low to high</option><option value="high">High to low</option></select></label><p>Sort by recorded supplier price. AZOBSS selling prices are shown separately.</p><div data-compare-list></div>');
 const select=root.querySelector('[data-compare-sort]'),list=root.querySelector('[data-compare-list]');
 const drawPrices=()=>{
   if(actions.isAdmin?.()!==true){list.replaceChildren();return;}
   const quote=row=>window.AZOBSSSourcePrices?.quote?.(row.id,row.optionLabel);
   const ordered=matches.slice().sort((a,b)=>{const x=quote(a)?.cost,y=quote(b)?.cost;return x==null?(y==null?0:1):y==null?-1:(x-y)*(select.value==='low'?1:-1);});
   list.innerHTML=(new Set(matches.map(storeName)).size<2?'<p>No matching model or part number found at another supplier.</p>':'')+ordered.map(row=>'<div class="az-store-compare-row"><a href="'+esc(model.productUrl(row))+'">'+esc(storeName(row))+' · '+esc(title(row))+'</a><b>'+(quote(row)?money(quote(row).cost)+' · '+esc(String(quote(row).date||'').slice(0,10)):'Supplier price unavailable')+'</b><small>AZOBSS: '+money(row.price)+'</small>'+adminSourceMetadata(row)+'</div>').join('');
 };
 select.onchange=drawPrices;drawPrices();
 const refresh=()=>{if(list.isConnected)drawPrices();else window.removeEventListener('azobss:source-prices-change',refresh);};
 window.addEventListener('azobss:source-prices-change',refresh);
}
function details(p){
 const verified=facts(p).filter(spec=>!/^(?:option|pilihan|purchase (?:note|option))\s*:/i.test(spec));
 const modelFacts=[['Model',p.name],['Brand',brand(p)],['Category',p.category],['Variant',p.optionLabel],...(actions.isAdmin?.()===true?[['Supplier',storeName(p)]]:[])].filter(([,v])=>v);
 const specRows=verified.map(spec=>'<li>'+esc(spec)+'</li>').join('');
 const description=String(p.description||'').trim();

 const root=actions.modal(title(p),`<div class="az-store-detail"><img src="${esc(p.image)}" alt="${esc(title(p))}"><div><span class="az-store-category">${esc(p.category)}</span><h3>${esc(title(p))}</h3><div class="az-store-price">${money(p.price)}</div>${adminSourceMetadata(p)}${description?'<p>'+esc(description)+'</p>':''}<h4>Specifications</h4><dl class="az-store-facts">${modelFacts.map(([label,value])=>'<dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd>').join('')}</dl>${manufacturerLink(p)}${specRows?'<ul>'+specRows+'</ul>':'<p>Detailed specifications are awaiting confirmation for this model.</p>'}<div class="az-store-actions"><button type="button" data-detail-add>＋ Add to List</button><button type="button" class="primary" data-detail-buy>Request Quote</button></div></div></div>`);
 const buttons=root.querySelector('.az-store-actions');
 const extra=document.createElement('div');
 extra.className='az-store-detail-actions';
 const share=document.createElement('button');
 share.type='button';share.className='az-store-details';share.textContent='Share product';
 share.onclick=()=>shareProduct(p,share);
 extra.append(share);
 if(actions.isAdmin?.()===true){
  const compare=document.createElement('button');
  compare.type='button';compare.className='az-store-details';compare.textContent='Compare suppliers';
  compare.onclick=()=>compareProduct(p);
  extra.append(compare);
 }
 buttons?.after(extra);
 buttons?.insertAdjacentHTML('beforebegin','<label class="az-store-quantity">Quantity <input type="number" min="1" max="20" value="1" data-detail-qty></label>');
 const selected=()=>({...p,qty:Math.max(1,Math.min(20,Math.floor(Number(root.querySelector('[data-detail-qty]')?.value)||1)))});
 root.querySelector('[data-detail-add]')?.addEventListener('click',()=>actions.add(selected(),false));
 root.querySelector('[data-detail-buy]')?.addEventListener('click',()=>actions.add(selected(),true));
}
function render(next,callbacks){
 rows=next.map(p=>({...p,category:window.AZOBSSPcModel?.category(p)||p.category,storeId:window.AZOBSSPcModel?.storeKey(p)||p.storeId}));actions=callbacks;window.AZOBSSPcVisibility?.setRows(rows,actions.isAdmin?.());syncHubNav();
 const grid=document.querySelector('#azPcShopGrid');if(!grid)return;
 const toolbar=document.querySelector('.az-pc-shop-toolbar');
 if(!document.querySelector('#azPcShopBrand')){
  toolbar?.insertAdjacentHTML('beforeend','<select class="az-pc-shop-control" id="azPcShopBrand" aria-label="Brand"><option value="all">All brands</option></select><select class="az-pc-shop-control" id="azPcShopStore" aria-label="Supplier" hidden disabled></select><select class="az-pc-shop-control" id="azPcShopUse" aria-label="Use"></select><select class="az-pc-shop-control" id="azPcShopLayout" aria-label="View switcher"><option value="medium">Grid · Medium</option><option value="large">Grid · Large</option><option value="list">List · Details</option></select>');
  const controlsMarkup='<div class="az-store-page-row"><div class="az-store-results" role="status" aria-live="polite" id="azStoreResults"></div><nav class="az-store-pagination" id="azStorePageTop" aria-label="Product pages"></nav></div>';
  if(toolbar){
   toolbar.insertAdjacentHTML('beforebegin','<div id="azStoreControls"></div>');
   const controls=toolbar.previousElementSibling;
   controls.append(toolbar);
   controls.insertAdjacentHTML('beforeend',controlsMarkup);
  }else{
   grid.insertAdjacentHTML('beforebegin',controlsMarkup);
  }
  grid.insertAdjacentHTML('afterend','<nav class="az-store-pagination" id="azStorePageBottom" aria-label="Product pages below results"></nav>');
 }
 const brands=document.querySelector('#azPcShopBrand'),previous=brands.value;
 brands.innerHTML='<option value="all">All brands</option>'+[...new Set(rows.map(brand))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 if([...brands.options].some(x=>x.value===previous))brands.value=previous;
 if(!bound){
  const initialQuery=new URL(location.href).searchParams.get('q');if(initialQuery){const search=document.getElementById('azPcShopSearch');if(search)search.value=initialQuery;}
  bound=true;brands.addEventListener('change',draw);
  const clearShared=event=>{if(!['azPcShopSearch','azPcShopCategory','azPcShopBrand','azPcShopStore','azPcShopUse'].includes(event.target.id))return;const u=new URL(location.href);if(u.searchParams.has('model')||/^#VNP-/.test(u.hash)){u.searchParams.delete('model');if(/^#VNP-/.test(u.hash))u.hash='';history.replaceState(null,'',u);}};
  toolbar?.addEventListener?.('input',clearShared,true);toolbar?.addEventListener?.('change',clearShared,true);
  const layout=document.getElementById('azPcShopLayout');
  try{layout.value=localStorage.getItem('azobss-pc-catalog-layout')||'medium';}catch{}
  layout.onchange=()=>{try{localStorage.setItem('azobss-pc-catalog-layout',layout.value);}catch{}draw();};
  for(const id of ['azPcShopStore','azPcShopUse'])document.getElementById(id).onchange=draw;
  const header=document.querySelector('.market-sticky-bar');
  const controls=document.getElementById('azStoreControls');
  const hardware=controls?.parentElement;
  const hub=document.querySelector('.az-pc-hub-nav');
  if(header&&hardware&&hub){
   const size=()=>{
    hub.style.setProperty('--az-pc-nav-top',header.getBoundingClientRect().bottom+'px');
    hardware.style.setProperty('--az-store-header',(header.getBoundingClientRect().bottom+hub.getBoundingClientRect().height)+'px');
   };
   size();
   if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(size);
    observer.observe(header);
    observer.observe(hub);
   }
  }

  document.addEventListener('click',e=>{
   const a=e.target.closest('[data-pc-hub-group]');
   if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   e.preventDefault();
   setHubGroup(a.dataset.pcHubGroup);
   if(hardware&&controls.getBoundingClientRect().top>hardware.getBoundingClientRect().top+1)
    hardware.scrollIntoView({block:'start',behavior:'instant'});
  });
  window.addEventListener('popstate',()=>{hubGroup=hubGroupFromUrl(location.href);page=1;syncHubNav();draw();});
  document.querySelector('#az-pc-hardware-shop').addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(button.dataset.storePage){
    if(button.getAttribute('aria-current')==='page')return;
    const pager=button.closest('.az-store-pagination'),step=button.dataset.storeStep;
    const fromTop=controls?.contains(button);
    page=Number(button.dataset.storePage);
    draw();
    const nextFocus=step&&pager?.querySelector('[data-store-step="'+step+'"]:not(:disabled)');
    (nextFocus||pager?.querySelector('[aria-current="page"]'))?.focus({preventScroll:true});
    if(hardware&&(!fromTop||controls.getBoundingClientRect().top>hardware.getBoundingClientRect().top+1)){
     hardware.scrollIntoView({block:'start',behavior:'instant'});
    }else if(!hardware){
     document.querySelector('#azStoreResults').scrollIntoView({block:'nearest'});
    }
    return;
   }
   for(const [key,fn] of [['storeAdd',p=>actions.add(p,false)],['storeBuy',p=>actions.add(p,true)],['storeImage',p=>actions.image(p)],['storeDetails',details],['storeShare',p=>shareProduct(p,button)],['storeCompare',compareProduct]]){
    if(button.dataset[key]){const p=rows.find(x=>String(x.id)===button.dataset[key]);if(p)fn(p);return;}
   }
  });
 }
 draw();
}
function paginationMarkup(page,pages){
 const first=Math.max(1,Math.min(page-2,pages-4));
 const numbers=Array.from({length:Math.min(5,pages)},(_,index)=>{
  const number=first+index;
  return `<button type="button" data-store-page="${number}" aria-label="Page ${number}" ${number===page?'aria-current="page"':''}>${number}</button>`;
 }).join('');
 return `<button class="az-store-page-step" type="button" data-store-step="prev" data-store-page="${page-1}" aria-label="Previous page" ${page===1?'disabled':''}><span aria-hidden="true">‹</span> PREV</button>
 <div class="az-store-page-numbers">${numbers}</div>
 <button class="az-store-page-step" type="button" data-store-step="next" data-store-page="${page+1}" aria-label="Next page" ${page===pages?'disabled':''}>NEXT <span aria-hidden="true">›</span></button>`;
}
function draw(){
 const grid=document.querySelector('#azPcShopGrid');if(!grid)return;
 const policy=window.AZOBSSPcVisibility?.status?.()||'ready';
 const loading=policy==='loading'||actions.catalogMode==='loading';
 const blocked=policy!=='ready'||(!rows.length&&actions.catalogMode==='unavailable');
 for(const id of ['azStorePageTop','azStorePageBottom']){
  const pagination=document.getElementById(id);if(pagination)pagination.hidden=loading||blocked;
 }
 if(loading||blocked){
  document.querySelector('#azStoreResults').textContent='';
  grid.innerHTML=loading?'<div class="az-pc-shop-empty" role="status">Memuatkan katalog…</div>':'<div class="az-pc-shop-empty" role="status">Katalog belum dapat dimuatkan. <button class="az-pc-shop-btn" type="button" data-store-retry>Cuba Lagi</button></div>';
  grid.querySelector?.('[data-store-retry]')?.addEventListener('click',event=>{
   event.currentTarget.disabled=true;
   event.currentTarget.textContent='Memuatkan…';
   actions.retry?.();
  });
  return;
 }
 const q=(document.querySelector('#azPcShopSearch')?.value||'').trim().toLowerCase();
 let cat=document.querySelector('#azPcShopCategory')?.value||'all',b=document.querySelector('#azPcShopBrand')?.value||'all';const sort=document.querySelector('#azPcShopSort')?.value||'recommended';
 const u=new URL(location.href),priceList=u.searchParams.get('catalog')==='pricelist',model=u.searchParams.get('model')||(/^#VNP-/.test(u.hash)?u.hash.slice(1):'');
 if(model){const target=rows.find(p=>p.sourceRecordId===model||p.id===model);if(target){const group=productGroup(target);if(hubGroup!==group){hubGroup=group;page=1;syncHubNav();u.searchParams.set('section',group);history.replaceState(null,'',u);}}}
 const groupRows=rows.filter(p=>(hubGroup==='all'||productGroup(p)===hubGroup)&&(!priceList||!!p.sourceRecordId));
 for(const [id,values,label,current] of [['azPcShopCategory',[...new Set(groupRows.map(p=>p.category))].sort(),'All categories',cat],['azPcShopBrand',[...new Set(groupRows.map(brand))].sort(),'All brands',b]]){
  const select=document.getElementById(id);if(!select)continue;
  select.innerHTML=`<option value="all">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  select.value=values.includes(current)?current:'all';if(id==='azPcShopCategory')cat=select.value;else b=select.value;
 }
 const storeSelect=document.getElementById('azPcShopStore'),useSelect=document.getElementById('azPcShopUse');
 const eligible=groupRows.filter(p=>!window.AZOBSSPcVisibility||window.AZOBSSPcVisibility.visible(p,actions.isAdmin?.()));
 const isAdmin=actions.isAdmin?.()===true;
 const suppliers=isAdmin?new Map(eligible.map(p=>[p.storeId,storeName(p)])):new Map();
 const groupKeys=new Set(eligible.map(p=>window.AZOBSSPcModel?.useGroup(p)));
 function populate(select,entries,label){
   if(!select)return 'all';
   const previous=select.value;
   select.innerHTML='<option value="all">'+label+'</option>'+entries.map(([id,name])=>'<option value="'+esc(id)+'">'+esc(name)+'</option>').join('');
   select.value=entries.some(([id])=>id===previous)?previous:'all';return select.value;
 }
 let store='all';
 if(storeSelect){
  storeSelect.hidden=!isAdmin;
  storeSelect.disabled=!isAdmin;
  if(isAdmin){
   store=populate(storeSelect,[...suppliers].filter(([id])=>id).sort((a,b)=>a[1].localeCompare(b[1])),'All suppliers');
  }else{
   storeSelect.innerHTML='';
  }
 }
 const use=populate(useSelect,Object.entries(useGroups).filter(([id])=>groupKeys.has(id)||id==='drone'&&['accessories','all'].includes(hubGroup)),'All uses');
 const filter=JSON.stringify([q,cat,b,sort,hubGroup,priceList,model,store,use]);if(filter!==lastFilter){page=1;lastFilter=filter;}
 let result=rows.filter(p=>(!window.AZOBSSPcVisibility||window.AZOBSSPcVisibility.visible(p,actions.isAdmin?.()))&&(hubGroup==='all'||productGroup(p)===hubGroup)&&(!priceList||!!p.sourceRecordId)&&(!model||p.sourceRecordId===model||p.id===model)&&(model||(cat==='all'||p.category===cat)&&(b==='all'||brand(p)===b))&&(model||(store==='all'||p.storeId===store)&&(use==='all'||window.AZOBSSPcModel?.useGroup(p)===use))&&(model||matchesSearch(p,q)));
 const priority={laptop:0,desktop:1,hardware:2};
 const categoryRank=p=>window.AZOBSSPcModel?.rank(p)??8;
 result.sort(sort==='recommended'?(a,b)=>(priority[a.type]??2)-(priority[b.type]??2)||(hubGroup==='components'?categoryRank(a)-categoryRank(b):0)||a.price-b.price:sort==='price-desc'?(a,b)=>b.price-a.price:sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>a.price-b.price);
 const pages=Math.max(1,Math.ceil(result.length/PAGE_SIZE));page=Math.max(1,Math.min(page,pages));
 const start=(page-1)*PAGE_SIZE,shown=result.slice(start,start+PAGE_SIZE);
 const layout=document.getElementById('azPcShopLayout')?.value||'medium';
 grid.classList.add('az-store-grid');if(grid.dataset)grid.dataset.layout=layout;
 grid.innerHTML=shown.length?(actions.catalogMode==='unavailable'?'<div class="az-pc-shop-empty">Memaparkan harga rujukan. <button class="az-pc-shop-btn" type="button" data-store-retry>Cuba Lagi</button></div>':'')+shown.map(layout==='list'?listRow:card).join(''):'<div class="az-pc-shop-empty">No matching products. Try another category or search.</div>';
 grid.querySelector?.('[data-store-retry]')?.addEventListener('click',()=>actions.retry?.());
 document.querySelector('#azStoreResults').textContent=result.length?`${start+1}–${Math.min(start+PAGE_SIZE,result.length)} of ${result.length.toLocaleString('ms-MY')} options`:'0 options';
 const nav=paginationMarkup(page,pages);
 for(const id of ['azStorePageTop','azStorePageBottom']){
  const pager=document.getElementById(id),key=page+'/'+pages;
  if(pager.dataset?.pagination===key)continue;
  pager.innerHTML=nav;
  if(pager.dataset)pager.dataset.pagination=key;
 }
 const target=model&&[...(grid.querySelectorAll?.('[data-store-product]')||[])].find(el=>el.dataset.storeProduct===model||shown.find(p=>p.id===el.dataset.storeProduct)?.sourceRecordId===model);
 if(target){target.classList.add('az-store-shared');if(sharedFocused!==model){sharedFocused=model;requestAnimationFrame(()=>grid.querySelector('.az-store-shared')?.scrollIntoView({block:'center'}));}}
 else if(!model)sharedFocused='';
 window.dispatchEvent?.(new CustomEvent('azobss:pc-catalog-render'));
}
window.addEventListener?.('azobss:pc-visibility-change',draw);
window.addEventListener?.('azobss:source-prices-change',()=>{if(rows.length)draw();});
window.AZOBSSPcStorefront={render};Object.assign(window.AZOBSSPcStorefront,{productGroup,setHubGroup});
})();
