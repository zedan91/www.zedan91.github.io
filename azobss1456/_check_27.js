
(function(){
  const API='https://azobss-backend.onrender.com';
  const CACHE_MS=90*1000;
  let cache=[],lastLoadedAt=0,loadingPromise=null;
  const selectedBookings=new Set();
  const expandedBookings=new Set();
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function money(v){const n=Number(v||0)||0;return 'RM'+(Number.isInteger(n)?n.toFixed(0):n.toFixed(2));}
  function date(v){const d=new Date(Number(v||0));return Number.isNaN(d.getTime())?'-':new Intl.DateTimeFormat('ms-MY',{dateStyle:'medium',timeStyle:'short'}).format(d);}
  function statusLabel(v){return ({new:'Baharu',contacted:'Dihubungi',inspection:'Pemeriksaan',quoted:'Harga diberi',confirmed:'Disahkan','in-progress':'Sedang dibaiki',completed:'Selesai',cancelled:'Dibatalkan'})[v]||v||'Baharu';}
  function phoneWa(v){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('0'))d='60'+d.slice(1);return d;}
  function rangeMoney(min,max,plus=false){const a=money(min),b=money(max==null?min:max);return Number(min||0)===Number(max==null?min:max)?a:`${a} – ${b}${plus?'+':''}`;}
  function bookingEstimate(x){return x?.estimateDisplay||rangeMoney(x?.estimatedMinimum,x?.estimatedMaximum??x?.estimatedMinimum,Boolean(x?.estimateHasPlus));}
  function servicePrice(s){return s?.priceLabel||rangeMoney(s?.minPrice??s?.price,s?.maxPrice??s?.price,Boolean(s?.plus));}
  async function request(path,opt={}){
    // PATCH 802: Never fall back to an unauthenticated fetch. The authenticated
    // helper lives in the main ES module and is exposed through window after
    // Firebase admin initialization. Wait briefly if the module is still starting.
    for(let i=0;i<40&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(r=>setTimeout(r,50));
    if(typeof window.azAdminFetchJson!=='function')throw new Error('Admin authentication helper is not ready. Refresh the page and try again.');
    return await window.azAdminFetchJson(API+path,opt);
  }
  function filtered(){const q=String($('serviceBookingSearch')?.value||'').trim().toLowerCase(),f=String($('serviceBookingStatusFilter')?.value||'all');return cache.filter(x=>{if(f!=='all'&&String(x.status||'new')!==f)return false;const hay=[x.bookingId,x.customerName,x.customerPhone,x.customerArea,x.floorUnit,x.locationWgs84,x.fullAddress,x.deviceBrand,x.deviceModel,x.problemDetails,x.invoiceNo,x.receiptNo,x.invoiceStatus,x.paymentStatus,(x.issues||[]).join(' '),(x.services||[]).map(s=>s.name).join(' ')].join(' ').toLowerCase();return !q||hay.includes(q);});}
  const AZOBSS_SHOP_CENTER={lat:3.255511332218502,lng:101.69410874034087};
  function bookingDistanceToShop(x){
    const lat=Number(x&&x.locationLatitude),lng=Number(x&&x.locationLongitude);
    if(Number.isFinite(lat)&&Number.isFinite(lng)){
      const r=6371,toRad=v=>v*Math.PI/180,dLat=toRad(lat-AZOBSS_SHOP_CENTER.lat),dLng=toRad(lng-AZOBSS_SHOP_CENTER.lng);
      const a=Math.sin(dLat/2)**2+Math.cos(toRad(AZOBSS_SHOP_CENTER.lat))*Math.cos(toRad(lat))*Math.sin(dLng/2)**2;
      return 2*r*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    const saved=Number(x&&x.locationDistanceKm);return Number.isFinite(saved)?saved:NaN;
  }
  function invoiceState(x){
    if(!x.invoiceDocId&&!x.invoiceNo)return '<div class="az798-invoice-state"><b>Draf tempahan</b><span>Belum dijadikan invois.</span></div>';
    const paid=String(x.paymentStatus||'').toLowerCase()==='paid'||String(x.invoiceStatus||'').toLowerCase()==='paid';
    return `<div class="az798-invoice-state"><b>${paid?'Resit dibayar':'Invois tersedia'} • ${esc(x.receiptNo||x.invoiceNo||'-')}</b><span>${paid?'Bayaran telah disahkan.':'Status bayaran: '+esc(x.paymentStatus||'belum dibayar')}</span></div>`;
  }
  function updateBulkUi(rows=filtered()){
    const visibleIds=rows.map(x=>String(x.bookingId||x.id||'')).filter(Boolean);
    const visibleSet=new Set(visibleIds);
    for(const id of [...selectedBookings])if(!visibleSet.has(id))selectedBookings.delete(id);
    const selectAll=$('serviceBookingSelectAll'),count=$('serviceBookingSelectedCount'),del=$('deleteSelectedServiceBookings');
    const selectedVisible=visibleIds.filter(id=>selectedBookings.has(id)).length;
    if(selectAll){selectAll.checked=Boolean(visibleIds.length)&&selectedVisible===visibleIds.length;selectAll.indeterminate=selectedVisible>0&&selectedVisible<visibleIds.length;selectAll.disabled=!visibleIds.length;}
    if(count)count.textContent=`${selectedVisible} dipilih`;
    if(del){del.disabled=!selectedVisible;del.textContent=selectedVisible?`Delete Selected (${selectedVisible})`:'Delete Selected';}
  }
  function render(){
    const box=$('serviceBookingList'),rows=filtered();if(!box)return;
    const badge=$('serviceBookingNavBadge'),newCount=cache.filter(x=>String(x.status||'new')==='new').length;if(badge){badge.textContent=String(newCount);badge.hidden=!newCount;}
    box.innerHTML=rows.map(x=>{
      const services=(x.services||[]).map(s=>esc(s.name)+' — '+esc(servicePrice(s))).join('<br>')||'<span style="color:#facc15">Pemeriksaan diperlukan</span>';
      const logistics=(x.logistics||[]).map(s=>esc(s.name)+' — '+esc(s.priceLabel||money(s.price))).join('<br>');
      const issues=(x.issues||[]).join(', ')||'-',wa=phoneWa(x.customerPhone),rawId=String(x.bookingId||x.id||''),id=esc(rawId),hasInvoice=Boolean(x.invoiceDocId||x.invoiceNo);
      const finalPrice=Number(x.finalPrice)>0?Number(x.finalPrice):'';
      const isExpanded=expandedBookings.has(rawId),isSelected=selectedBookings.has(rawId);
      const compactEstimate=(x.services?.length||x.logistics?.length)?bookingEstimate(x):'Perlu pemeriksaan';
      return `<article class="az770-service-booking-row az840-booking-card ${String(x.status||'new')==='new'?'is-new':''} ${isExpanded?'is-expanded':''}" data-booking-card="${id}">
        <div class="az840-booking-compact" data-service-booking-toggle="${id}" role="button" tabindex="0" aria-expanded="${isExpanded?'true':'false'}">
          <label class="az840-booking-check" title="Pilih untuk delete"><input type="checkbox" data-service-booking-select="${id}" ${isSelected?'checked':''} aria-label="Pilih tempahan ${id}"></label>
          <div class="az840-compact-primary"><div class="az840-compact-id">${id}</div><div class="az840-compact-line">${esc(date(x.createdAtMs))} • ${esc(x.customerName)} • ${esc(x.customerPhone)}</div><div class="az840-compact-line">${esc(x.customerArea||x.fullAddress||'-')}</div></div>
          <div class="az840-compact-device"><strong>${esc(x.deviceBrand)} ${esc(x.deviceModel)}</strong><div class="az840-compact-line">${esc(x.deviceType)} • ${esc(x.screenSize||'Saiz tidak dinyatakan')} • ${esc(x.serviceMethod||'-')}</div></div>
          <div class="az840-compact-price"><span class="az770-booking-chip">${esc(statusLabel(x.status))}</span><span class="az770-booking-price">Anggaran: ${esc(compactEstimate)}</span>${Number(x.finalPrice)>0?`<span class="az770-booking-price">Harga akhir: ${money(x.finalPrice)}</span>`:''}</div>
          <button class="btn gray az840-toggle-btn" data-service-booking-toggle-button="${id}" type="button">${isExpanded?'Tutup':'Lihat semua'}</button>
        </div>
        <div class="az840-booking-expanded" ${isExpanded?'':'hidden'}>
          <div><div class="az770-booking-title">Pelanggan</div><div class="az770-booking-meta">${esc(x.customerName)}<br>${esc(x.customerPhone)}<br>${esc(x.customerEmail||'-')}<br>${esc(x.customerArea||'-')}</div><span class="az770-booking-chip">${esc(statusLabel(x.status))}</span></div>
          <div><div class="az770-booking-title">${esc(x.deviceBrand)} ${esc(x.deviceModel)}</div><div class="az770-booking-meta">${esc(x.deviceType)} • ${esc(x.screenSize||'Saiz tidak dinyatakan')}<br>Jenis skrin: ${esc(x.screenType||'Tidak dinyatakan')}<br>${esc(x.devicePowerState||'-')}<br>Serahan: ${esc(x.serviceMethod||'-')}</div></div>
          <div class="az770-booking-services">${services}${logistics?`<br><br><strong>Logistik</strong><br>${logistics}`:''}<span class="az770-booking-price">Anggaran: ${esc(compactEstimate)}</span>${Number(x.finalPrice)>0?`<span class="az770-booking-price">Harga akhir: ${money(x.finalPrice)}</span>`:''}<div class="az770-booking-meta">Harga sebenar perlu disahkan admin.<br>Masalah: ${esc(issues)}</div></div>
          <div class="az770-booking-actions"><select data-service-booking-status="${id}"><option value="new" ${x.status==='new'?'selected':''}>Baharu</option><option value="contacted" ${x.status==='contacted'?'selected':''}>Dihubungi</option><option value="inspection" ${x.status==='inspection'?'selected':''}>Pemeriksaan</option><option value="quoted" ${x.status==='quoted'?'selected':''}>Harga diberi</option><option value="confirmed" ${x.status==='confirmed'?'selected':''}>Disahkan</option><option value="in-progress" ${x.status==='in-progress'?'selected':''}>Sedang dibaiki</option><option value="completed" ${x.status==='completed'?'selected':''}>Selesai</option><option value="cancelled" ${x.status==='cancelled'?'selected':''}>Dibatalkan</option></select><label class="az798-final-price-label">Harga akhir (RM)<input data-service-booking-final-price="${id}" min="0" step="0.01" type="number" value="${finalPrice}" placeholder="Contoh: 280"></label><div class="az798-booking-action-row"><button class="btn gray" data-service-booking-save-price="${id}" type="button">Simpan Harga</button>${hasInvoice?`<button class="btn green" data-service-booking-open-invoice="${id}" type="button">Buka Invois</button>`:`<button class="btn green" data-service-booking-create-invoice="${id}" type="button">Buat Draf Invois</button>`}</div>${invoiceState(x)}${wa?`<a class="btn green" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:''}<button class="btn red" data-service-booking-delete="${id}" type="button">Delete</button><div class="az798-quota-note">Satu rekod tempahan sahaja. Invois hanya dicipta selepas admin menekan Simpan Invois.</div></div>
          <div class="az770-booking-detail az840-full-info"><strong>Maklumat penuh</strong>\nFloor / unit: ${esc(x.floorUnit||'-')}\nAlamat: ${esc(x.fullAddress||'-')}\nWGS84: ${esc(x.locationWgs84||'-')}\nJarak dari kedai AZOBSS: ${Number.isFinite(bookingDistanceToShop(x))?bookingDistanceToShop(x).toFixed(2)+' km':'-'}\n${x.locationMapUrl?`Peta: <a href="${esc(x.locationMapUrl)}" target="_blank" rel="noopener">Buka Google Maps</a>`:'Peta: -'}\nTarikh / masa: ${esc(x.preferredDate||'Fleksibel')} • ${esc(x.preferredTime||'Fleksibel')}\nKeutamaan: ${esc(x.urgency||'Biasa')}\nData / backup: ${esc(x.backupRequirement||'Tidak pasti')}\nSerial: ${esc(x.deviceSerial||'-')}\nE-mel: ${esc(x.customerEmail||'-')}\nKos pengambilan: ${money(x.pickupFee||0)}\nKos penghantaran: ${money(x.deliveryFee||0)}\nInvois: ${esc(x.invoiceNo||'-')}\nResit: ${esc(x.receiptNo||'-')}\nStatus bayaran: ${esc(x.paymentStatus||'belum dibayar')}\n\nCatatan masalah: ${esc(x.problemDetails||'-')}\nPermintaan tambahan: ${esc(x.extraRequests||'-')}</div>
        </div>
      </article>`;
    }).join('')||'<div class="az770-booking-empty">Tiada rekod yang sepadan.</div>';
    updateBulkUi(rows);
    const n=$('serviceBookingNotice');if(n)n.textContent=`${rows.length} dipaparkan daripada ${cache.length} rekod • ${newCount} baharu • cache 90 saat untuk jimat kuota`;
  }
  async function load({force=false}={}){
    if(!force&&cache.length&&Date.now()-lastLoadedAt<CACHE_MS){render();return cache;}
    if(loadingPromise)return loadingPromise;
    const n=$('serviceBookingNotice');if(n)n.textContent='Loading service bookings...';
    loadingPromise=(async()=>{try{const j=await request('/api/admin/service-bookings?limit=120',{cache:'no-store'});cache=Array.isArray(j.records)?j.records:[];lastLoadedAt=Date.now();render();return cache;}catch(e){cache=[];render();if(n)n.textContent='Gagal memuatkan rekod: '+(e.message||e);return [];}finally{loadingPromise=null;}})();
    return loadingPromise;
  }
  async function action(bookingId,action,extra={}){await request('/api/admin/service-bookings-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId,action,...extra})});lastLoadedAt=0;await load({force:true});}
  async function deleteSelectedBookings(){
    const ids=[...selectedBookings];if(!ids.length)return;
    if(!confirm(`Delete ${ids.length} service booking(s) permanently?`))return;
    const btn=$('deleteSelectedServiceBookings');if(btn)btn.disabled=true;
    try{await request('/api/admin/service-bookings-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bulk-delete',bookingIds:ids})});selectedBookings.clear();ids.forEach(id=>expandedBookings.delete(id));lastLoadedAt=0;await load({force:true});}
    catch(err){alert(err.message||err);updateBulkUi();}
    finally{if(btn)btn.disabled=false;}
  }
  async function waitInvoiceModule(){for(let i=0;i<80;i++){if(typeof window.azSalesReceiptsOpenFromServiceBooking==='function')return true;await new Promise(r=>setTimeout(r,75));}return false;}
  async function openInvoiceForBooking(row,existing=false){
    const tab=[...document.querySelectorAll('[data-tab="salesreceipts"]')][0];if(tab)tab.click();
    if(!(await waitInvoiceModule())){alert('Modul Sales & Receipts belum siap. Refresh dengan Ctrl + F5 dan cuba lagi.');return;}
    if(existing&&row.invoiceDocId&&typeof window.azSalesReceiptsOpenServiceInvoice==='function')await window.azSalesReceiptsOpenServiceInvoice(row.invoiceDocId);
    else window.azSalesReceiptsOpenFromServiceBooking(row);
  }
  function exportCsv(){const rows=filtered();const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const head=['Booking ID','Created','Status','Customer','Phone','Email','Area','Floor / Unit','WGS84','Distance from AZOBSS Shop (km)','Map URL','Full Address','Device','Screen Size','Screen Type','Services','Estimate Min','Estimate Max','Estimate Display','Final Price','Invoice No','Receipt No','Invoice Status','Payment Status','Pickup Fee','Delivery Fee','Issues','Method','Preferred Date','Preferred Time','Backup','Problem Details','Extra Requests'];const lines=[head.map(q).join(',')];rows.forEach(x=>lines.push([x.bookingId,date(x.createdAtMs),statusLabel(x.status),x.customerName,x.customerPhone,x.customerEmail,x.customerArea,x.floorUnit,x.locationWgs84,bookingDistanceToShop(x),x.locationMapUrl,x.fullAddress,[x.deviceType,x.deviceBrand,x.deviceModel].join(' '),x.screenSize,x.screenType,(x.services||[]).map(s=>s.name+' ('+servicePrice(s)+')').join(' | '),x.estimatedMinimum,x.estimatedMaximum,bookingEstimate(x),x.finalPrice,x.invoiceNo,x.receiptNo,x.invoiceStatus,x.paymentStatus,x.pickupFee||0,x.deliveryFee||0,(x.issues||[]).join(' | '),x.serviceMethod,x.preferredDate,x.preferredTime,x.backupRequirement,x.problemDetails,x.extraRequests].map(q).join(',')));const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AZOBSS-Service-Bookings-Invoice-Ready.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener('click',async e=>{
    const tab=e.target.closest('[data-tab="servicebookings"]');if(tab)setTimeout(()=>load(),0);
    if(e.target.id==='refreshServiceBookings'){load({force:true});return;}
    if(e.target.id==='exportServiceBookings'){exportCsv();return;}
    if(e.target.id==='deleteSelectedServiceBookings'){await deleteSelectedBookings();return;}
    const toggleBtn=e.target.closest('[data-service-booking-toggle-button]');
    const compact=e.target.closest('[data-service-booking-toggle]');
    if(toggleBtn||compact){
      if(e.target.closest('input,select,a,label')&&!toggleBtn)return;
      const id=String((toggleBtn?.dataset.serviceBookingToggleButton)||(compact?.dataset.serviceBookingToggle)||'');
      if(id){expandedBookings.has(id)?expandedBookings.delete(id):expandedBookings.add(id);render();}
      return;
    }
    const del=e.target.closest('[data-service-booking-delete]');if(del&&confirm('Delete this service booking permanently?')){const id=String(del.dataset.serviceBookingDelete||'');selectedBookings.delete(id);expandedBookings.delete(id);action(id,'delete');return;}
    const save=e.target.closest('[data-service-booking-save-price]');if(save){const input=save.closest('.az770-booking-actions')?.querySelector('[data-service-booking-final-price]'),value=Number(input?.value||0);if(!(value>0)){alert('Masukkan harga akhir yang lebih daripada RM0.');input?.focus();return;}save.disabled=true;try{await action(save.dataset.serviceBookingSavePrice,'final-price',{finalPrice:value});}catch(err){alert(err.message||err);}finally{save.disabled=false;}return;}
    const create=e.target.closest('[data-service-booking-create-invoice]');if(create){const row=cache.find(x=>String(x.bookingId||x.id)===String(create.dataset.serviceBookingCreateInvoice));if(row)openInvoiceForBooking(row,false);return;}
    const open=e.target.closest('[data-service-booking-open-invoice]');if(open){const row=cache.find(x=>String(x.bookingId||x.id)===String(open.dataset.serviceBookingOpenInvoice));if(row)openInvoiceForBooking(row,true);return;}
  });
  document.addEventListener('keydown',e=>{const compact=e.target.closest?.('[data-service-booking-toggle]');if(compact&&(e.key==='Enter'||e.key===' ')){if(e.target.matches('input,select,a,button'))return;e.preventDefault();const id=String(compact.dataset.serviceBookingToggle||'');if(id){expandedBookings.has(id)?expandedBookings.delete(id):expandedBookings.add(id);render();}}});
  document.addEventListener('change',e=>{
    if(e.target.id==='serviceBookingStatusFilter'){selectedBookings.clear();render();return;}
    if(e.target.id==='serviceBookingSelectAll'){const rows=filtered();selectedBookings.clear();if(e.target.checked)rows.forEach(x=>selectedBookings.add(String(x.bookingId||x.id)));render();return;}
    if(e.target.matches('[data-service-booking-select]')){const id=String(e.target.dataset.serviceBookingSelect||'');if(e.target.checked)selectedBookings.add(id);else selectedBookings.delete(id);updateBulkUi();return;}
    if(e.target.matches('[data-service-booking-status]'))action(e.target.dataset.serviceBookingStatus,'status',{status:e.target.value});
  });
  document.addEventListener('input',e=>{if(e.target.id==='serviceBookingSearch'){selectedBookings.clear();render();}});
  window.loadServiceBookings=(force=false)=>load({force});
})();
