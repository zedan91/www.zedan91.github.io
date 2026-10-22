
(function(){
  const API='https://azobss-backend.onrender.com';
  const CACHE_MS=60*1000;
  const AUTO_REFRESH_MS=10*1000;
  const PAGE_SIZE=3;
  let cache=[],lastLoadedAt=0,loadingPromise=null;
  let currentPage=1;
  const selected=new Set();
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const text=v=>String(v??'').trim();
  const digits=v=>text(v).replace(/\D+/g,'');
  function formatMalaysiaPhone(v){
    const original=String(v??'').trim();
    if(!original)return '';
    const all=original.replace(/\D+/g,'');
    let local='';
    if(all.startsWith('60'))local=all.slice(2);
    else if(all.startsWith('0'))local=all.slice(1);
    else if(/^1\d{8,9}$/.test(all))local=all;
    else return original;
    if(!/^1\d{8,9}$/.test(local))return original;
    const prefix=local.slice(0,2),subscriber=local.slice(2);
    if(subscriber.length===8)return `+60 ${prefix}-${subscriber.slice(0,4)} ${subscriber.slice(4)}`;
    if(subscriber.length===7)return `+60 ${prefix}-${subscriber.slice(0,3)} ${subscriber.slice(3)}`;
    return original;
  }
  function formatTimeAmPm(d){return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true}).format(d).replace(/\s+/g,' ').toUpperCase();}
  function dt(v){
    const n=Number(v||0),d=n?new Date(n):new Date(v||0);
    if(Number.isNaN(d.getTime()))return '-';
    return `${new Intl.DateTimeFormat('ms-MY',{dateStyle:'medium'}).format(d)}, ${formatTimeAmPm(d)}`;
  }
  function dateTimeParts(v){
    const n=Number(v||0),d=n?new Date(n):new Date(v||0);
    if(Number.isNaN(d.getTime()))return {date:'-',time:'-'};
    return {
      date:new Intl.DateTimeFormat('ms-MY',{dateStyle:'medium'}).format(d),
      time:formatTimeAmPm(d)
    };
  }
  function timeValue(row,kind='updated'){
    const value=kind==='created'?(row?.createdAtMs||row?.createdAt):(row?.updatedAtMs||row?.updatedAt||row?.createdAtMs||row?.createdAt);
    const numeric=Number(value||0);if(Number.isFinite(numeric)&&numeric>0)return numeric;
    const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:0;
  }
  function compareText(a,b){return text(a).localeCompare(text(b),'ms',{sensitivity:'base',numeric:true});}
  function compareOptionalText(a,b,direction=1){
    const left=text(a),right=text(b);
    if(!left&&!right)return 0;
    if(!left)return 1;
    if(!right)return -1;
    return direction*compareText(left,right);
  }
  function sortRows(rows){
    const mode=text($('softwareKeySort')?.value)||'updated-desc';
    const copy=[...rows];
    const tie=(a,b)=>timeValue(b)-timeValue(a)||compareText(a.recordId||a.id,b.recordId||b.id);
    copy.sort((a,b)=>{
      if(mode==='updated-asc')return timeValue(a)-timeValue(b)||tie(a,b);
      if(mode==='created-desc')return timeValue(b,'created')-timeValue(a,'created')||tie(a,b);
      if(mode==='created-asc')return timeValue(a,'created')-timeValue(b,'created')||tie(a,b);
      if(mode==='customer-asc')return compareOptionalText(a.customerName,b.customerName,1)||tie(a,b);
      if(mode==='customer-desc')return compareOptionalText(a.customerName,b.customerName,-1)||tie(a,b);
      if(mode==='pc-asc')return compareText(a.computerName,b.computerName)||tie(a,b);
      if(mode==='pc-desc')return compareText(b.computerName,a.computerName)||tie(a,b);
      if(mode==='status-complete')return (captureStatus(a)==='complete'?0:1)-(captureStatus(b)==='complete'?0:1)||tie(a,b);
      if(mode==='status-pending')return (captureStatus(a)==='pending-key'?0:1)-(captureStatus(b)==='pending-key'?0:1)||tie(a,b);
      return timeValue(b)-timeValue(a)||tie(a,b);
    });
    return copy;
  }
  async function request(path,opt={}){
    for(let i=0;i<50&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(r=>setTimeout(r,50));
    if(typeof window.azAdminFetchJson!=='function')throw new Error('Admin authentication helper is not ready. Refresh the page and try again.');
    return window.azAdminFetchJson(API+path,opt);
  }
  try{
    const savedSort=localStorage.getItem('azobssSoftwareKeySort');
    const sort=$('softwareKeySort');
    if(sort&&savedSort&&[...sort.options].some(option=>option.value===savedSort))sort.value=savedSort;
  }catch(_){ }
  function filtered(){
    const q=text($('softwareKeySearch')?.value).toLowerCase();
    const qDigits=digits(q);
    const rows=!q?cache:cache.filter(x=>{
      const values=[x.recordId,x.computerName,x.customerName,x.customerPhone,x.customerPhoneDigits,x.systemId,x.systemCode,x.serialKey,x.motherboardId,x.motherboardManufacturer,x.motherboardProduct];
      return values.some(v=>text(v).toLowerCase().includes(q))||(qDigits&&values.some(v=>digits(v).includes(qDigits)));
    });
    return sortRows(rows);
  }
  function paginate(rows){
    const totalPages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
    currentPage=Math.min(Math.max(1,currentPage),totalPages);
    const start=(currentPage-1)*PAGE_SIZE;
    return {rows:rows.slice(start,start+PAGE_SIZE),totalPages};
  }
  function currentPageRows(){return paginate(filtered()).rows;}
  function renderPager(totalRows,totalPages){
    const pager=$('softwareKeyPager');if(!pager)return;
    if(totalRows<=PAGE_SIZE){pager.hidden=true;pager.innerHTML='';return;}
    const candidates=[1,currentPage-1,currentPage,currentPage+1,totalPages].filter(page=>page>=1&&page<=totalPages);
    const pages=[...new Set(candidates)].sort((a,b)=>a-b);
    let previous=0;
    const numbered=pages.map(page=>{
      const gap=previous&&page-previous>1?'<span class="az894-page-gap" aria-hidden="true">…</span>':'';
      previous=page;
      return `${gap}<button type="button" class="${page===currentPage?'is-current':''}" data-software-key-page="${page}" ${page===currentPage?'aria-current="page"':''}>${page}</button>`;
    }).join('');
    pager.hidden=false;
    pager.innerHTML=`<button type="button" data-software-key-page="${currentPage-1}" ${currentPage<=1?'disabled':''} aria-label="Halaman sebelumnya">←</button>${numbered}<span class="az894-page-count">Halaman ${currentPage} / ${totalPages}</span><button type="button" data-software-key-page="${currentPage+1}" ${currentPage>=totalPages?'disabled':''} aria-label="Halaman seterusnya">→</button>`;
  }
  function updateBulk(rows=currentPageRows()){
    const visibleIds=new Set(rows.map(x=>x.recordId||x.id).filter(Boolean));
    for(const id of [...selected])if(!cache.some(x=>(x.recordId||x.id)===id))selected.delete(id);
    const chosen=[...visibleIds].filter(id=>selected.has(id)).length;
    const all=visibleIds.size>0&&chosen===visibleIds.size;
    const sel=$('softwareKeySelectAll');if(sel){sel.checked=all;sel.indeterminate=chosen>0&&!all;}
    const n=$('softwareKeySelectedCount');if(n)n.textContent=`${selected.size} dipilih`;
    const btn=$('deleteSelectedSoftwareKeys');if(btn)btn.disabled=!selected.size;
  }
  function field(label,value,wide=false){
    const v=text(value)||'-';
    return `<div class="az880-key-field${wide?' is-wide':''}"><div class="az880-key-label">${esc(label)}</div><div class="az880-key-value-row"><div class="az880-key-value">${esc(v)}</div>${v!=='-'?`<button class="az880-key-copy" type="button" data-copy="${esc(v)}">Copy</button>`:''}</div></div>`;
  }
  function captureStatus(row){return text(row?.serialKey)?'complete':'pending-key';}
  function render(){
    const allRows=filtered();
    const page=paginate(allRows),rows=page.rows;
    const list=$('softwareKeyList');if(!list)return;
    $('softwareKeyCount')&&($('softwareKeyCount').textContent=String(cache.length));
    $('softwareKeySerialCount')&&($('softwareKeySerialCount').textContent=String(cache.filter(x=>text(x.serialKey)).length));
    $('softwareKeyPendingCount')&&($('softwareKeyPendingCount').textContent=String(cache.filter(x=>captureStatus(x)==='pending-key').length));
    list.innerHTML=rows.map(x=>{
      const id=text(x.recordId||x.id);
      const board=[text(x.motherboardManufacturer),text(x.motherboardProduct)].filter(Boolean).join(' • ');
      const status=captureStatus(x),pending=status==='pending-key';
      const customerName=text(x.customerName),customerPhone=text(x.customerPhone),customerPhoneDisplay=formatMalaysiaPhone(customerPhone);
      const customerHtml=customerName||customerPhone
        ? `${customerName?`<span class="az893-customer-name" title="Nama pelanggan">${esc(customerName)}</span>`:''}${customerPhone?`<span class="az893-customer-phone" title="No. telefon pelanggan">☎ ${esc(customerPhoneDisplay)}</span>`:''}`
        : '<span class="az893-customer-empty">Pelanggan belum diisi</span>';
      const stamp=dateTimeParts(x.createdAtMs||x.createdAt||x.updatedAtMs||x.updatedAt);
      return `<article class="az880-key-card az900-key-dark${pending?' is-pending':''}" data-record="${esc(id)}">
        <div class="az880-key-head"><div class="az880-key-title"><input type="checkbox" data-key-select="${esc(id)}" ${selected.has(id)?'checked':''}><div class="az894-key-identity"><div class="az894-customer-line">${customerHtml}</div><div class="az894-key-date-time"><span>Tarikh <b>${esc(stamp.date)}</b></span><span>Masa <b>${esc(stamp.time)}</b></span></div><div class="az894-key-spec az897-pc-info-line"><span class="az880-key-pc">${esc(text(x.computerName)||'Unknown PC')}</span><span class="az894-pc-spec" title="${esc(board||'Spec PC belum direkod')}">PC: ${esc(board||'Spec belum direkod')}</span><span class="az894-record-id">ID: ${esc(id)}</span></div></div></div><div class="az880-key-actions">${pending?'<span class="az891-key-status is-pending">Menunggu</span>':''}<button class="btn az893-customer-edit-btn" type="button" data-key-customer="${esc(id)}" title="Edit semua maklumat Software Key">Edit</button><button class="btn red" type="button" data-key-delete="${esc(id)}">Delete</button></div></div>
        <div class="az880-key-grid">
          ${field('System ID',x.systemId)}${field('Systemcode',x.systemCode)}
          ${field('Motherboard ID',x.motherboardId)}
          ${field('Key Serial',x.serialKey)}
        </div>
      </article>`;
    }).join('')||'<div class="az880-key-empty">Tiada rekod Software Key yang sepadan.</div>';
    renderPager(allRows.length,page.totalPages);
    const n=$('softwareKeyNotice');if(n)n.textContent=`${rows.length} dipaparkan • halaman ${currentPage}/${page.totalPages} • ${allRows.length} sepadan daripada ${cache.length} rekod • auto refresh 10 saat`;
    updateBulk(rows);
  }
  async function load({force=false}={}){
    if(!force&&cache.length&&Date.now()-lastLoadedAt<CACHE_MS){render();return cache;}
    if(loadingPromise)return loadingPromise;
    const n=$('softwareKeyNotice');if(n)n.textContent='Loading Software Key records...';
    loadingPromise=(async()=>{try{const j=await request('/api/admin/software-keys?limit=300',{cache:'no-store'});cache=Array.isArray(j.records)?j.records:[];lastLoadedAt=Date.now();render();return cache;}catch(e){cache=[];render();if(n)n.textContent='Gagal memuatkan rekod: '+(e.message||e);return [];}finally{loadingPromise=null;}})();
    return loadingPromise;
  }
  async function remove(ids){
    ids=[...new Set(ids.filter(Boolean))];if(!ids.length)return;
    if(!confirm(`Delete ${ids.length} Software Key record(s) permanently?`))return;
    const body=ids.length===1?{action:'delete',recordId:ids[0]}:{action:'bulk-delete',recordIds:ids};
    await request('/api/admin/software-keys-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    ids.forEach(id=>selected.delete(id));lastLoadedAt=0;await load({force:true});
  }
  function manualModal(open){
    const modal=$('manualSoftwareKeyModal');if(!modal)return;
    modal.classList.toggle('is-open',!!open);modal.setAttribute('aria-hidden',open?'false':'true');
    if(open){setTimeout(()=>$('manualKeyComputerName')?.focus(),50);}else{$('manualSoftwareKeyError')?.classList.remove('is-show');}
  }
  function manualValue(id){return text($(id)?.value);}
  function manualDigits(v){return text(v).replace(/\D+/g,'');}
  async function saveManual(){
    const errorBox=$('manualSoftwareKeyError'),saveBtn=$('saveManualSoftwareKey');
    const payload={
      action:'create-manual',
      computerName:manualValue('manualKeyComputerName'),
      customerName:manualValue('manualKeyCustomerName'),
      customerPhone:manualValue('manualKeyCustomerPhone'),
      motherboardId:manualValue('manualKeyMotherboardId'),
      systemId:manualValue('manualKeySystemId'),
      systemCode:manualValue('manualKeySystemCode'),
      serialKey:manualValue('manualKeySerial'),
      motherboardManufacturer:manualValue('manualKeyBoardManufacturer'),
      motherboardProduct:manualValue('manualKeyBoardProduct')
    };
    const sid=manualDigits(payload.systemId),scode=manualDigits(payload.systemCode),phone=manualDigits(payload.customerPhone);
    let msg='';
    if(sid.length!==12||/^([0-9])\1{11}$/.test(sid))msg='System ID mesti tepat 12 digit yang sah.';
    else if(scode.length!==12||/^([0-9])\1{11}$/.test(scode))msg='Systemcode mesti tepat 12 digit yang sah.';
    else if(sid===scode)msg='System ID dan Systemcode mesti berbeza.';
    else if(!payload.motherboardId||payload.motherboardId.length<2)msg='Motherboard ID wajib diisi.';
    else if(!payload.serialKey)msg='Key Serial wajib diisi.';
    else if(payload.customerPhone&&(phone.length<9||phone.length>15))msg='No. telefon pelanggan mesti mengandungi 9 hingga 15 digit.';
    if(msg){if(errorBox){errorBox.textContent=msg;errorBox.classList.add('is-show');}return;}
    if(errorBox){errorBox.textContent='';errorBox.classList.remove('is-show');}
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving...';}
    try{
      const result=await request('/api/admin/software-keys-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      $('manualSoftwareKeyForm')?.reset();manualModal(false);lastLoadedAt=0;await load({force:true});
      const notice=$('softwareKeyNotice');if(notice)notice.textContent=(result?.existed?'Rekod sedia ada dikemas kini secara manual.':'Rekod manual berjaya ditambah.');
    }catch(err){if(errorBox){errorBox.textContent=err.message||String(err);errorBox.classList.add('is-show');}}
    finally{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save Manual';}}
  }
  function customerModal(open,row=null){
    const modal=$('softwareKeyCustomerModal');if(!modal)return;
    modal.classList.toggle('is-open',!!open);modal.setAttribute('aria-hidden',open?'false':'true');
    if(open&&row){
      const id=text(row.recordId||row.id);
      $('softwareKeyCustomerRecordId').value=id;
      $('softwareKeyComputerName').value=text(row.computerName);
      $('softwareKeyCustomerName').value=text(row.customerName);
      $('softwareKeyCustomerPhone').value=text(row.customerPhone);
      $('softwareKeyMotherboardId').value=text(row.motherboardId);
      $('softwareKeySystemId').value=text(row.systemId);
      $('softwareKeySystemCode').value=text(row.systemCode);
      $('softwareKeySerial').value=text(row.serialKey);
      $('softwareKeyBoardManufacturer').value=text(row.motherboardManufacturer);
      $('softwareKeyBoardProduct').value=text(row.motherboardProduct);
      $('softwareKeyCustomerRecord').textContent=`${text(row.computerName)||'Unknown PC'} • ${id}`;
      setTimeout(()=>$('softwareKeyComputerName')?.focus(),50);
    }else if(!open){
      $('softwareKeyCustomerForm')?.reset();
      if($('softwareKeyCustomerRecord'))$('softwareKeyCustomerRecord').textContent='';
      $('softwareKeyCustomerError')?.classList.remove('is-show');
    }
  }
  async function saveCustomer(){
    const errorBox=$('softwareKeyCustomerError'),saveBtn=$('saveSoftwareKeyCustomer');
    const payload={
      action:'update-record',
      recordId:manualValue('softwareKeyCustomerRecordId'),
      computerName:manualValue('softwareKeyComputerName'),
      customerName:manualValue('softwareKeyCustomerName'),
      customerPhone:manualValue('softwareKeyCustomerPhone'),
      motherboardId:manualValue('softwareKeyMotherboardId'),
      systemId:manualValue('softwareKeySystemId'),
      systemCode:manualValue('softwareKeySystemCode'),
      serialKey:manualValue('softwareKeySerial'),
      motherboardManufacturer:manualValue('softwareKeyBoardManufacturer'),
      motherboardProduct:manualValue('softwareKeyBoardProduct')
    };
    const sid=manualDigits(payload.systemId),scode=manualDigits(payload.systemCode),phone=manualDigits(payload.customerPhone);
    let msg='';
    if(!payload.recordId)msg='Rekod Software Key tidak ditemui.';
    else if(sid.length!==12||/^([0-9])\1{11}$/.test(sid))msg='System ID mesti tepat 12 digit yang sah.';
    else if(scode.length!==12||/^([0-9])\1{11}$/.test(scode))msg='Systemcode mesti tepat 12 digit yang sah.';
    else if(sid===scode)msg='System ID dan Systemcode mesti berbeza.';
    else if(!payload.motherboardId||payload.motherboardId.length<2)msg='Motherboard ID wajib diisi.';
    else if(payload.customerPhone&&(phone.length<9||phone.length>15))msg='No. telefon mesti mengandungi 9 hingga 15 digit.';
    if(msg){if(errorBox){errorBox.textContent=msg;errorBox.classList.add('is-show');}return;}
    if(errorBox){errorBox.textContent='';errorBox.classList.remove('is-show');}
    if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Saving...';}
    try{
      const result=await request('/api/admin/software-keys-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      customerModal(false);lastLoadedAt=0;await load({force:true});
      const notice=$('softwareKeyNotice');if(notice)notice.textContent=result?.recordIdChanged?'Software Key berjaya dikemas kini dan Record ID diselaraskan.':'Software Key berjaya dikemas kini.';
    }catch(err){if(errorBox){errorBox.textContent=err.message||String(err);errorBox.classList.add('is-show');}}
    finally{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save Changes';}}
  }
  function exportCsv(){
    const rows=filtered(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const head=['Record ID','Created','Updated','Status','Computer Name','Customer Name','Customer Phone','System ID','Systemcode','Key Serial','Motherboard ID','Motherboard Manufacturer','Motherboard Product','Source'];
    const lines=[head.map(q).join(',')];rows.forEach(x=>lines.push([x.recordId||x.id,dt(x.createdAtMs||x.createdAt),dt(x.updatedAtMs||x.updatedAt||x.createdAtMs),captureStatus(x),x.computerName,x.customerName,formatMalaysiaPhone(x.customerPhone),x.systemId,x.systemCode,x.serialKey,x.motherboardId,x.motherboardManufacturer,x.motherboardProduct,x.source].map(q).join(',')));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`AZOBSS-Software-Keys-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('submit',async e=>{
    if(e.target?.id==='manualSoftwareKeyForm'){e.preventDefault();await saveManual();return;}
    if(e.target?.id==='softwareKeyCustomerForm'){e.preventDefault();await saveCustomer();}
  });
  document.addEventListener('input',e=>{if(e.target?.id==='softwareKeySearch'){currentPage=1;render();}});
  document.addEventListener('change',e=>{
    if(e.target?.matches('[data-key-select]')){const id=e.target.getAttribute('data-key-select');if(e.target.checked)selected.add(id);else selected.delete(id);updateBulk(currentPageRows());return;}
    if(e.target?.id==='softwareKeySelectAll'){const rows=currentPageRows();rows.forEach(x=>{const id=x.recordId||x.id;if(id){if(e.target.checked)selected.add(id);else selected.delete(id);}});render();}
    if(e.target?.id==='softwareKeySort'){currentPage=1;try{localStorage.setItem('azobssSoftwareKeySort',e.target.value);}catch(_){}render();}
  });
  document.addEventListener('click',async e=>{
    const pageButton=e.target.closest('[data-software-key-page]');
    if(pageButton&&!pageButton.disabled){const page=Number(pageButton.getAttribute('data-software-key-page'));if(Number.isFinite(page)){currentPage=page;render();$('softwarekeys')?.scrollIntoView({behavior:'smooth',block:'start'});}return;}
    if(e.target.closest('#addManualSoftwareKey')){manualModal(true);return;}
    if(e.target.closest('#closeManualSoftwareKey')||e.target.closest('#cancelManualSoftwareKey')){manualModal(false);return;}
    if(e.target?.id==='manualSoftwareKeyModal'){manualModal(false);return;}
    if(e.target.closest('#closeSoftwareKeyCustomer')||e.target.closest('#cancelSoftwareKeyCustomer')){customerModal(false);return;}
    if(e.target?.id==='softwareKeyCustomerModal'){customerModal(false);return;}
    const copy=e.target.closest('[data-copy]');if(copy){try{await navigator.clipboard.writeText(copy.getAttribute('data-copy')||'');copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy',900);}catch(_){alert('Copy failed.');}return;}
    const edit=e.target.closest('[data-key-customer]');if(edit){const id=edit.getAttribute('data-key-customer');const row=cache.find(x=>text(x.recordId||x.id)===text(id));if(row)customerModal(true,row);return;}
    const del=e.target.closest('[data-key-delete]');if(del){try{await remove([del.getAttribute('data-key-delete')]);}catch(err){alert(err.message||err);}return;}
    if(e.target.closest('#refreshSoftwareKeys')){await load({force:true});return;}
    if(e.target.closest('#exportSoftwareKeys')){exportCsv();return;}
    if(e.target.closest('#deleteSelectedSoftwareKeys')){try{await remove([...selected]);}catch(err){alert(err.message||err);}return;}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('manualSoftwareKeyModal')?.classList.contains('is-open'))manualModal(false);if($('softwareKeyCustomerModal')?.classList.contains('is-open'))customerModal(false);}});
  window.azobssLongSessionInterval(()=>{const tab=$('softwarekeys');if(document.visibilityState==='visible'&&tab?.classList.contains('active')&&!$('surveycadKeyPanel')?.hidden&&!loadingPromise)load({force:true});},AUTO_REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{const tab=$('softwarekeys');if(document.visibilityState==='visible'&&tab?.classList.contains('active')&&!$('surveycadKeyPanel')?.hidden)load({force:true});});
  window.azSoftwareKeysLoad=load;
})();
