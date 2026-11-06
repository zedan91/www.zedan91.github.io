(function(){'use strict';
const root=document.getElementById('azUpgradeCatalog');if(!root)return;
const money=n=>'RM'+Number(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const search=root.querySelector('[data-vnp-search]'),category=root.querySelector('[data-vnp-category]'),sort=root.querySelector('[data-vnp-sort]'),cards=root.querySelector('[data-vnp-cards]'),status=root.querySelector('[data-vnp-status]'),pager=root.querySelector('[data-vnp-pager]'),viewer=root.querySelector('dialog');let rows=[],page=1,lastFocus=null;const size=36;
const canZoom=p=>p.imageKind==='model'||p.imageKind==='series';
const mediaLabel=p=>p.imageKind==='model'?'Foto model':p.imageKind==='series'?'Foto siri':'Gambar model belum tersedia';
function media(p,i){const tag=canZoom(p)?'button':'div',attrs=canZoom(p)?`type="button" data-vnp-image="${esc(p.id)}" aria-label="Besarkan gambar ${esc(p.name)}"`:'';return `<${tag} class="vnp-photo" ${attrs}><img src="${esc(p.image)}" alt="${esc(canZoom(p)?p.name:'Ilustrasi kategori '+p.category+'; gambar model belum tersedia')}" width="350" height="180" loading="${i<4?'eager':'lazy'}" decoding="async"><span>${esc(mediaLabel(p))}${canZoom(p)?' ⤢':''}</span></${tag}>`;}

function draw(){
 const q=search.value.trim().toLowerCase(),cat=category.value;
 let list=rows.filter(p=>(cat==='all'||p.category===cat)&&(!q||[p.name,p.category,p.specification,...p.options.map(o=>o.label)].join(' ').toLowerCase().includes(q)));
 const min=p=>Math.min(...p.options.map(o=>o.price));if(sort.value==='low')list.sort((a,b)=>min(a)-min(b));else if(sort.value==='high')list.sort((a,b)=>min(b)-min(a));else if(sort.value==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);const start=(page-1)*size;
 cards.innerHTML=list.slice(start,start+size).map((p,i)=>`<article class="vnp-card">${media(p,i)}<div class="vnp-detail"><span class="vnp-category">${esc(p.category)}</span><h2>${esc(p.name)}</h2>${p.specification?`<p class="vnp-spec">${esc(p.specification)}</p>`:''}<ul>${p.options.map(o=>`<li><span>${o.label==='Harga'?'Seunit':esc(o.label)}</span><strong>${money(o.price)}</strong></li>`).join('')}</ul>${window.AZOBSSSourcePrices?.panel(p)||''}${p.note?`<small>${esc(p.note)}</small>`:''}<a class="vnp-ask" target="_blank" rel="noopener" href="https://wa.me/601135600723?text=${encodeURIComponent('Salam, saya ingin semak stok dan keserasian '+p.name+' ('+p.id+').')}">Semak / tempah ↗</a></div></article>`).join('')||'<p class="vnp-empty">Tiada model sepadan. Cuba carian lain.</p>';
 status.textContent=list.length?`${start+1}–${Math.min(start+size,list.length)} daripada ${list.length.toLocaleString('ms-MY')} model`:'0 model';
 pager.innerHTML=`<button type="button" data-vnp-page="${page-1}" ${page===1?'disabled':''}>← Sebelum</button><span>${page} / ${pages}</span><button type="button" data-vnp-page="${page+1}" ${page>=pages?'disabled':''}>Seterusnya →</button>`;
}
window.addEventListener('azobss:source-prices-change',()=>{if(rows.length)draw();});
for(const input of [search,category,sort])input.addEventListener(input===search?'input':'change',()=>{page=1;draw();});
pager.addEventListener('click',e=>{const b=e.target.closest('[data-vnp-page]');if(!b||b.disabled)return;page=Number(b.dataset.vnpPage);draw();root.querySelector('.vnp-tools').scrollIntoView({block:'start'});});
cards.addEventListener('click',e=>{const b=e.target.closest('[data-vnp-image]');if(!b)return;const p=rows.find(p=>p.id===b.dataset.vnpImage);if(!p||!canZoom(p))return;lastFocus=b;viewer.querySelector('img').src=p.image;viewer.querySelector('img').alt=mediaLabel(p)+' '+p.name;viewer.querySelector('h2').textContent=p.name;viewer.showModal();document.body.classList.add('vnp-viewer-open');});
viewer.querySelector('[data-vnp-close]').addEventListener('click',()=>viewer.close());viewer.addEventListener('click',e=>{if(e.target===viewer){const r=viewer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)viewer.close();}});viewer.addEventListener('close',()=>{document.body.classList.remove('vnp-viewer-open');if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});});
fetch('/Upgrade-Parts/catalog-v1518.json?v=1524',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(d=>{
 rows=(d.products||[]).filter(p=>p.name&&p.image&&Array.isArray(p.options)&&p.options.length&&p.options.every(o=>Number.isFinite(o.price)&&o.price>0));
 category.innerHTML='<option value="all">Semua kategori</option>'+[...new Set(rows.map(p=>p.category))].sort().map(c=>`<option>${esc(c)}</option>`).join('');root.querySelector('[data-vnp-count]').textContent=rows.length.toLocaleString('ms-MY');draw();
}).catch(()=>{status.textContent='Katalog belum dapat dimuatkan. Senarai PDF masih boleh dimuat turun.';cards.innerHTML='<a href="/Upgrade-Parts/downloads/AZOBSS-Upgrade-Parts-2026-11-05.pdf">Muat turun senarai PDF</a>';});
})();
