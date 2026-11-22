(()=>{'use strict';
const root=document.getElementById('laptopParts');if(!root)return;
const $=id=>document.getElementById(id),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let rows=[],page=1,selected=null;const size=12;
const key=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const brands=p=>['ACER','ASUS','DELL','HP','LENOVO','MSI','APPLE','HUAWEI','SAMSUNG','TOSHIBA','SONY'].filter(b=>new RegExp('\\b'+b+'\\b','i').test(p.name));
function draw(){
 const q=key($('partsSearch').value),cat=$('partsCategory').value,brand=$('partsBrand').value;
 const scoped=rows.filter(p=>!cat||p.category===cat);const available=[...new Set(scoped.flatMap(brands))].sort();
 $('partsBrand').innerHTML='<option value="">Semua jenama laptop</option>'+available.map(b=>'<option>'+b+'</option>').join('');$('partsBrand').value=available.includes(brand)?brand:'';
 const matches=scoped.filter(p=>(!q||key(p.name).includes(q))&&(!$('partsBrand').value||brands(p).includes($('partsBrand').value)));const pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages);
 $('partsCount').textContent=matches.length+' pilihan rujukan';$('partsGrid').innerHTML=matches.slice((page-1)*size,page*size).map(p=>`<article class="part-card"><button class="part-photo" data-part="${esc(p.id)}" aria-label="Lihat ${esc(p.name)}"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)}"></button><div class="part-copy"><small>${esc(p.category)}</small><h3>${esc(p.name.replace(/^REPLACEMENT LAPTOP\/?NOTEBOOK\s*/i,''))}</h3><p>Harga & keserasian perlu disahkan</p><button class="btn secondary" data-part="${esc(p.id)}">Butiran & semak harga</button></div></article>`).join('')||'<div class="parts-empty"><h3>Belum ada padanan dalam pilihan ini</h3><p>Kami masih boleh semak alat ganti anda. Berikan model penuh laptop atau gambar part number melalui WhatsApp.</p><button class="btn secondary" data-part="enquiry">Tanya alat ganti '+esc(cat||'laptop')+'</button></div>';
 $('partsPage').textContent=page+' / '+pages;$('partsPrev').disabled=page===1;$('partsNext').disabled=page===pages;
}
function open(p){selected=p;const cat=$('partsCategory').value;$('partTitle').textContent=p?p.name:(cat||'Alat ganti laptop');$('partImage').hidden=!p;if(p){$('partImage').src=p.image;$('partImage').alt=p.name;}$('partFit').textContent=p?.category==='Skrin'?'Sahkan part number panel, saiz, resolusi, jumlah pin, kedudukan connector, refresh rate dan touch.':p?.category==='Bateri'?'Sahkan kod bateri, voltan, bentuk dan connector. Model laptop sahaja belum menjamin padanan.':p?.category==='Adapter'?'Sahkan voltan, watt, saiz connector dan polariti.':'Sahkan model penuh, part number dan gambar komponen asal. Semak pilihan backlight, layout, mounting dan connector jika berkaitan.';updateLink();$('partDialog').showModal();}
function updateLink(){const text=['Salam AZOBSS, saya ingin semak alat ganti laptop.',selected?selected.name:($('partsCategory').value||'Alat ganti lain'),'Model laptop / part number: '+($('partModel').value.trim()||'Belum pasti — saya akan beri gambar'), 'Keperluan: '+$('partNeed').value,'Mohon sahkan keserasian, stok, harga dan kos pemasangan sebelum saya buat keputusan.'].join('\n');$('partWhatsapp').href='https://wa.me/601135600723?text='+encodeURIComponent(text);}
root.addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(b)open(rows.find(p=>p.id===b.dataset.part)||null);});
for(const id of ['partsSearch','partsCategory','partsBrand'])$(id).addEventListener(id==='partsSearch'?'input':'change',()=>{page=1;draw();});
 root.querySelector('[data-parts-clear]').onclick=()=>{$('partsSearch').value='';page=1;draw();$('partsSearch').focus();};
 $('partsPrev').onclick=()=>{page--;draw();root.scrollIntoView({block:'start'});};$('partsNext').onclick=()=>{page++;draw();root.scrollIntoView({block:'start'});};
 $('partClose').onclick=()=>$('partDialog').close();$('partDialog').addEventListener('click',e=>{if(e.target===$('partDialog'))$('partDialog').close();});
 for(const id of ['partModel','partNeed'])$(id).addEventListener('input',updateLink);
 document.querySelectorAll('[data-open-service]').forEach(b=>b.addEventListener('click',()=>{$('serviceBooking').open=true;$('serviceBooking').scrollIntoView({block:'start',behavior:'smooth'});}));
 async function load(){try{const r=await fetch('/Tempah-Servis-IT/laptop-parts.json?v=1604');if(!r.ok)throw Error();const d=await r.json();rows=d.products||[];$('partsCategory').innerHTML='<option value="">Semua alat ganti</option>'+d.categories.map(c=>'<option>'+esc(c)+'</option>').join('');draw();}catch{ $('partsCount').textContent='Katalog belum dapat dimuatkan';$('partsGrid').innerHTML='<button class="btn secondary" id="partsRetry">Cuba lagi</button>';$('partsRetry').onclick=load;}}
 load();
})();
