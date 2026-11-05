(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(Number(n)||0);
const PAGE_SIZE=24;let page=1,lastFilter='',rows=[],actions={},bound=false;
function brand(p){return String(p.brand||p.name?.split(/\s+/)[0]||'Lain-lain').replace(/[^\w.-]/g,'').toUpperCase();}
function adminSourceMetadata(p){
 if(actions.isAdmin?.()!==true)return '';
 const source=String(p.sourceName||p.storeName||'');let url='';
 try{const u=new URL(String(p.sourceUrl||''));if(u.protocol==='https:')url=u.href}catch(_){}
 const d=new Date(p.priceCheckedAt||p.sourceCheckedAt||'');
 const date=Number.isFinite(d.getTime())?d.toLocaleString('ms-MY'):'';
 if(!source&&!url&&!date)return '';
 return `<div class="az-store-source" data-pc-admin-source>${source?`<div>Sumber kedai: <b>${esc(source)}</b></div>`:''}${url?`<a href="${esc(url)}" target="_blank" rel="noopener">Lihat produk asal ↗</a>`:''}${date?`<div>Harga sumber direkod: ${esc(date)}</div>`:''}</div>`;
}
function card(p){
 const status=p.priceStatus==='live'&&p.available===true?'Stok disahkan':'Stok disemak semasa checkout';
 return `<article class="az-store-product" data-store-product="${esc(p.id)}"><button class="az-store-photo" type="button" data-store-image="${esc(p.id)}" aria-label="Besarkan gambar ${esc(p.name)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" width="640" height="640" loading="lazy" decoding="async"></button><div class="az-store-product-copy"><div class="az-store-category">${esc(p.category)} <span>${esc(brand(p))}</span></div><h3>${esc(p.name)}</h3><ul>${(p.specs||[]).slice(1,4).map(s=>`<li>${esc(s)}</li>`).join('')}</ul><div class="az-store-price">${money(p.price)}<small>Harga AZOBSS</small></div><div class="az-store-stock">${esc(status)}</div>${adminSourceMetadata(p)}<div class="az-store-actions"><button type="button" data-store-add="${esc(p.id)}">＋ Add to Cart</button><button type="button" class="primary" data-store-buy="${esc(p.id)}">Buy Now</button></div><button type="button" class="az-store-details" data-store-details="${esc(p.id)}">Spesifikasi &amp; butiran ↗</button></div></article>`;
}
function details(p){
 const root=actions.modal(p.name,`<div class="az-store-detail"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div><span class="az-store-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3><div class="az-store-price">${money(p.price)}</div>${adminSourceMetadata(p)}<p>Harga jual AZOBSS. Harga dan stok varian ini disemak semula sebelum pengesahan pesanan.</p><ul>${(p.specs||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><div class="az-store-actions"><button type="button" data-detail-add>＋ Add to Cart</button><button type="button" class="primary" data-detail-buy>Buy Now</button></div></div></div>`);
 const buttons=root.querySelector('.az-store-actions');buttons?.insertAdjacentHTML('beforebegin','<label class="az-store-quantity">Bilangan <input type="number" min="1" max="20" value="1" data-detail-qty></label>');
 const selected=()=>({...p,qty:Math.max(1,Math.min(20,Math.floor(Number(root.querySelector('[data-detail-qty]')?.value)||1)))});
 root.querySelector('[data-detail-add]')?.addEventListener('click',()=>actions.add(selected(),false));
 root.querySelector('[data-detail-buy]')?.addEventListener('click',()=>actions.add(selected(),true));
}
function render(next,callbacks){
 rows=next;actions=callbacks;
 const grid=document.querySelector('#azPcShopGrid');if(!grid)return;const heroCount=document.querySelector('#azStoreHeroCount');if(heroCount)heroCount.textContent=rows.length.toLocaleString('ms-MY');
 const toolbar=document.querySelector('.az-pc-shop-toolbar');
 if(!document.querySelector('#azPcShopBrand')){
  toolbar?.insertAdjacentHTML('beforeend','<select class="az-pc-shop-control" id="azPcShopBrand" aria-label="Jenama"><option value="all">Semua jenama</option></select>');
  grid.insertAdjacentHTML('beforebegin','<div class="az-store-categories" id="azStoreCategories" aria-label="Kategori produk"></div><div class="az-store-results" role="status" aria-live="polite" id="azStoreResults"></div><nav class="az-store-pagination" id="azStorePageTop" aria-label="Halaman produk atas"></nav>');
  grid.insertAdjacentHTML('afterend','<nav class="az-store-pagination" id="azStorePageBottom" aria-label="Halaman produk bawah"></nav>');
 }
 const brands=document.querySelector('#azPcShopBrand'),previous=brands.value;
 brands.innerHTML='<option value="all">Semua jenama</option>'+[...new Set(rows.map(brand))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 if([...brands.options].some(x=>x.value===previous))brands.value=previous;
 if(!bound){
  bound=true;brands.addEventListener('change',draw);
  document.querySelector('#az-pc-hardware-shop').addEventListener('click',e=>{
   const button=e.target.closest('button');if(!button)return;
   if(button.dataset.storeCategory!==undefined){document.querySelector('#azPcShopCategory').value=button.dataset.storeCategory;page=1;draw();return;}
   if(button.dataset.storePage){page=Number(button.dataset.storePage);draw();document.querySelector('#azStoreResults').scrollIntoView({block:'nearest'});return;}
   for(const [key,fn] of [['storeAdd',p=>actions.add(p,false)],['storeBuy',p=>actions.add(p,true)],['storeImage',p=>actions.image(p)],['storeDetails',details]]){
    if(button.dataset[key]){const p=rows.find(x=>String(x.id)===button.dataset[key]);if(p)fn(p);return;}
   }
  });
 }
 draw();
}
function draw(){
 const grid=document.querySelector('#azPcShopGrid');if(!grid)return;
 const q=(document.querySelector('#azPcShopSearch')?.value||'').trim().toLowerCase();
 const cat=document.querySelector('#azPcShopCategory')?.value||'all',b=document.querySelector('#azPcShopBrand')?.value||'all',sort=document.querySelector('#azPcShopSort')?.value||'recommended';
 const filter=JSON.stringify([q,cat,b,sort]);if(filter!==lastFilter){page=1;lastFilter=filter;}
 let result=rows.filter(p=>(cat==='all'||p.category===cat)&&(b==='all'||brand(p)===b)&&(!q||[p.name,p.category,...(p.specs||[])].join(' ').toLowerCase().includes(q)));
 const priority={laptop:0,desktop:1,hardware:2};
 result.sort(sort==='recommended'?(a,b)=>(priority[a.type]??2)-(priority[b.type]??2)||a.price-b.price:sort==='price-desc'?(a,b)=>b.price-a.price:sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>a.price-b.price);
 const pages=Math.max(1,Math.ceil(result.length/PAGE_SIZE));page=Math.max(1,Math.min(page,pages));
 const start=(page-1)*PAGE_SIZE,shown=result.slice(start,start+PAGE_SIZE);
 grid.classList.add('az-store-grid');
 grid.innerHTML=shown.length?shown.map(card).join(''):'<div class="az-pc-shop-empty">Tiada produk sepadan. Cuba kategori atau carian lain.</div>';
 document.querySelector('#azStoreResults').textContent=result.length?`${start+1}–${Math.min(start+PAGE_SIZE,result.length)} daripada ${result.length.toLocaleString('ms-MY')} pilihan`:'0 pilihan';
 const cats=[...new Set(rows.map(p=>p.category))].sort();
 document.querySelector('#azStoreCategories').innerHTML=['all',...cats].map(c=>`<button type="button" data-store-category="${esc(c)}" aria-pressed="${c===cat}">${c==='all'?'Semua produk':esc(c)} <span>${c==='all'?rows.length:rows.filter(p=>p.category===c).length}</span></button>`).join('');
 const nav=`<button type="button" data-store-page="${page-1}" ${page<=1?'disabled':''}>← Sebelum</button><span>Halaman ${page} / ${pages}</span><button type="button" data-store-page="${page+1}" ${page>=pages?'disabled':''}>Seterusnya →</button>`;
 for(const id of ['azStorePageTop','azStorePageBottom'])document.getElementById(id).innerHTML=nav;
}
window.AZOBSSPcStorefront={render};
})();
