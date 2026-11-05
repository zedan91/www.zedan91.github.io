(function(){'use strict';
const root=document.getElementById('azUpgradeCatalog');if(!root)return;
const money=n=>'RM'+Number(n).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const search=root.querySelector('[data-vnp-search]'),category=root.querySelector('[data-vnp-category]'),sort=root.querySelector('[data-vnp-sort]'),body=root.querySelector('tbody'),status=root.querySelector('[data-vnp-status]'),pager=root.querySelector('[data-vnp-pager]');let rows=[],page=1;const size=35;
function draw(){
 const q=search.value.trim().toLowerCase(),cat=category.value;
 let list=rows.filter(p=>(cat==='all'||p.category===cat)&&(!q||[p.name,p.category,p.specification,...p.options.map(o=>o.label)].join(' ').toLowerCase().includes(q)));
 const min=p=>Math.min(...p.options.map(o=>o.price));if(sort.value==='low')list.sort((a,b)=>min(a)-min(b));else if(sort.value==='high')list.sort((a,b)=>min(b)-min(a));else if(sort.value==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
 const pages=Math.max(1,Math.ceil(list.length/size));page=Math.min(page,pages);const start=(page-1)*size;
 body.innerHTML=list.slice(start,start+size).map(p=>`<tr><td><span class="vnp-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3>${p.specification?`<p>${esc(p.specification)}</p>`:''}${p.note?`<small>${esc(p.note)}</small>`:''}</td><td><ul>${p.options.map(o=>`<li><span>${o.label==='Harga'?'':esc(o.label)}</span><strong>${money(o.price)}</strong></li>`).join('')}</ul></td><td><a class="vnp-ask" target="_blank" rel="noopener" href="https://wa.me/601135600723?text=${encodeURIComponent('Salam, saya ingin semak stok dan keserasian '+p.name+' ('+p.id+').')}">Semak / tempah ↗</a></td></tr>`).join('')||'<tr><td colspan="3" class="vnp-empty">Tiada model sepadan. Cuba carian lain.</td></tr>';
 status.textContent=list.length?`${(start+1).toLocaleString('ms-MY')}–${Math.min(start+size,list.length).toLocaleString('ms-MY')} daripada ${list.length.toLocaleString('ms-MY')} model`:'0 model';
 pager.innerHTML=`<button type="button" data-vnp-page="${page-1}" ${page===1?'disabled':''}>← Sebelum</button><span>Halaman ${page} / ${pages}</span><button type="button" data-vnp-page="${page+1}" ${page>=pages?'disabled':''}>Seterusnya →</button>`;
}
for(const input of [search,category,sort])input.addEventListener(input===search?'input':'change',()=>{page=1;draw();});
pager.addEventListener('click',e=>{const b=e.target.closest('[data-vnp-page]');if(!b||b.disabled)return;page=Number(b.dataset.vnpPage);draw();status.scrollIntoView({block:'nearest'});});
fetch('/Upgrade-Parts/catalog-v1517.json?v=1517',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('catalog');return r.json();}).then(d=>{
 rows=(d.products||[]).filter(p=>p.name&&Array.isArray(p.options)&&p.options.length&&p.options.every(o=>Number.isFinite(o.price)&&o.price>0));
 category.innerHTML='<option value="all">Semua kategori</option>'+[...new Set(rows.map(p=>p.category))].sort().map(c=>`<option>${esc(c)}</option>`).join('');
 const count=root.querySelector('[data-vnp-count]');if(count)count.textContent=rows.length.toLocaleString('ms-MY');draw();
}).catch(()=>{status.textContent='Katalog belum dapat dimuatkan. Senarai PDF masih boleh dimuat turun.';body.innerHTML='<tr><td colspan="3" class="vnp-empty"><a href="/Upgrade-Parts/downloads/AZOBSS-Upgrade-Parts-2026-11-05.pdf">Muat turun senarai PDF</a></td></tr>';});
})();
