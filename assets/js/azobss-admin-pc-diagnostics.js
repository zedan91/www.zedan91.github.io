(() => {
  'use strict';
  const base = 'https://azobss-backend.onrender.com/api/admin/pc-diagnostics';
  const el = id => document.getElementById(id);
  const section = el('pcdiagnostics');
  if (!section) return;
  let cursor = '', busy = false, requestNumber = 0;
  let dealers = [], selectedDealer = '60182491182', activeReport = null, deleting = false;
  const reports = new Map(), selected = new Set(), statusBusy = new Set(), updatesWhileLoading = new Map();
  const filters = window.AZOBSSDiagnosticFilters;
  if(!filters){notice('Carian laporan belum dimuatkan. Sila refresh halaman Admin.');return;}
  let visibleIds=[], currentPage=1, inputTimer;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function notice(message) { el('pcDiagStatus').textContent = message; }
  async function api(url,options={}) {
    if (typeof window.azAdminFetchJson !== 'function') throw Error('Sila log masuk sebagai admin dahulu.');
    return window.azAdminFetchJson(url,{cache:'no-store',...options});
  }
  function renderDealers() {
    const select = el('pcDiagDealerSelect');
    select.replaceChildren(new Option('Nombor lain',''));
    for (const dealer of dealers) select.add(new Option(dealer.name + ' · +' + dealer.phone,dealer.phone));
    select.value = selectedDealer;
    el('pcDiagDealerPhone').value = select.value;
  }
  async function loadDealers() {
    const result = await api(base + '/dealers');
    dealers = result.dealers || [];
    renderDealers();
  }
  const post = (url,data) => api(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  function selection() {
    const all=el('pcDiagSelectAll'), count=selected.size;
    all.checked=visibleIds.length>0 && count===visibleIds.length;
    all.indeterminate=count>0 && count<visibleIds.length;
    all.disabled=deleting || busy || !visibleIds.length;
    el('pcDiagSelectedCount').textContent=count+' dipilih';
    el('pcDiagDeleteSelected').disabled=deleting || busy || !count;
  }
  function paintStatus(card,row) {
    const status=row.status||{};
    card.querySelector('[data-sent]').checked=status.sent===true;
    card.classList.toggle('pc-diag-sent',status.sent===true);
    card.querySelector('[data-sent-info]').textContent=status.sent
      ? (status.source==='bridge' ? 'Disahkan WhatsApp' : 'Ditanda manual')+(status.dealerPhone ? ' · +'+status.dealerPhone : '')
        +(status.sentAt ? ' · '+new Date(status.sentAt).toLocaleString('ms-MY') : '')
      : 'Belum ditanda hantar';
  }
  function showStatus(id,status) {
    if(busy) updatesWhileLoading.set(id,status);
    const row=reports.get(id);if(!row)return;
    row.status=status||{sent:false,manualRevision:0};render();
  }
  async function setSent(id,input) {
    const result=await post(base+'/'+encodeURIComponent(id)+'/sent',input);
    showStatus(id,result.status);
    return result;
  }
  async function manualSent(id,box) {
    if (deleting || busy || statusBusy.has(id)) {box.checked=reports.get(id)?.status?.sent===true;return;}
    statusBusy.add(id); box.disabled=true;
    try {await setSent(id,{sent:box.checked});}
    catch(error) {box.checked=reports.get(id)?.status?.sent===true;notice(error.message);}
    finally {statusBusy.delete(id);render();}
  }
  el('pcDiagSelectAll').addEventListener('change',event=>{
    for (const id of visibleIds) event.target.checked ? selected.add(id) : selected.delete(id);
    for (const box of el('pcDiagList').querySelectorAll('[data-select]')) box.checked=selected.has(box.closest('[data-report-id]').dataset.reportId);
    selection();
  });
  el('pcDiagDeleteSelected').addEventListener('click',async()=>{
    const ids=[...selected];
    if (deleting || busy || !ids.length || statusBusy.size || !window.confirm('Padam '+ids.length+' laporan yang dipilih secara kekal? Fail TXT turut dipadam daripada Cloudflare.')) return;
    deleting=true; render();
    el('pcDiagRefresh').disabled=el('pcDiagMore').disabled=true;
    const failed=[];
    try {
      for (let i=0;i<ids.length;i+=50) {
        const result=await post(base+'/delete',{ids:ids.slice(i,i+50)});
        for (const id of result.deleted || []) {
          reports.delete(id);selected.delete(id);
          document.querySelector('[data-report-id="'+id+'"]')?.remove();
          if(activeReport?.id===id) {activeReport=null;requestNumber++;el('pcDiagDialog').close();}
        }
        failed.push(...(result.failed||[]));
      }
      notice(failed.length ? failed.length+' laporan gagal dipadam. Pilihannya dikekalkan untuk cuba lagi.' : ids.length+' laporan dipadam.');
    } catch(error) {notice(error.message+' Pilihan yang belum dipadam dikekalkan.');}
    finally {deleting=false;render();el('pcDiagRefresh').disabled=false;el('pcDiagMore').disabled=!cursor;}
  });
  // Background retains unacknowledged send confirmations when Admin is closed/offline.
  const acknowledgements=new Set();
  window.addEventListener('message',async event=>{
    const message=event.data;
    if(event.source!==window || event.origin!==location.origin || message?.type!=='AZOBSS_PC_DEALER_SENT_1594')return;
    const receipt=message.receipt;
    if(!receipt || !/^[a-f0-9-]{36}$/.test(receipt.reportId||'') || !/^[a-f0-9-]{36}$/.test(receipt.eventId||'') || acknowledgements.has(receipt.eventId))return;
    acknowledgements.add(receipt.eventId);
    try {
      await setSent(receipt.reportId,{sent:true,automatic:true,eventId:receipt.eventId,manualRevision:receipt.manualRevision,phone:receipt.phone});
      window.postMessage({type:'AZOBSS_PC_DEALER_SENT_ACK_1594',eventId:receipt.eventId},location.origin);
    } catch(error) {
      if([404,410].includes(Number(error.status||error.statusCode)) || /PC report (?:not found|deleted)/i.test(error.message||'')) {
        window.postMessage({type:'AZOBSS_PC_DEALER_SENT_ACK_1594',eventId:receipt.eventId},location.origin);
      } else notice('Status hantar belum disimpan. Bridge akan cuba semula: '+error.message);
    } finally {acknowledgements.delete(receipt.eventId);}
  });
  window.postMessage({type:'AZOBSS_PC_DEALER_SENT_READY_1594'},location.origin);
  function render() {
    for(const control of section.querySelectorAll('.pc-diag-filters input,.pc-diag-filters select,.pc-diag-filters button,[data-report-status],#pcDiagPageSize'))control.disabled=deleting;
    const rows=[...reports.values()], chosen=el('pcDiagBrand').value;
    const choices=filters.brands(rows);
    if(chosen && !choices.some(([name])=>name===chosen))choices.push([chosen,0]);
    el('pcDiagBrand').replaceChildren(new Option('Semua jenama',''),...choices.map(([name,count])=>new Option(name+' ('+count+')',name)));
    el('pcDiagBrand').value=chosen;
    const sent=rows.filter(row=>row.status?.sent===true).length;
    el('pcDiagCountAll').textContent='Semua: '+rows.length;
    el('pcDiagCountUnsent').textContent='Belum hantar: '+(rows.length-sent);
    el('pcDiagCountSent').textContent='Sudah hantar: '+sent;
    for(const button of section.querySelectorAll('[data-report-status]'))button.setAttribute('aria-pressed',String(button.dataset.reportStatus===el('pcDiagSentFilter').value));
    const matches=filters.select(rows,{query:el('pcDiagSearch').value,brand:chosen,status:el('pcDiagSentFilter').value,battery:el('pcDiagBatteryFilter').value,sort:el('pcDiagSort').value});
    const size=Number(el('pcDiagPageSize').value), pages=Math.max(1,Math.ceil(matches.length/size));
    currentPage=Math.max(1,Math.min(currentPage,pages));
    const page=matches.slice((currentPage-1)*size,currentPage*size);
    visibleIds=page.map(row=>row.id);
    for(const id of selected)if(!visibleIds.includes(id))selected.delete(id);
    const active=document.activeElement, focusedId=active?.closest?.('[data-report-id]')?.dataset.reportId;
    const focusedKind=active?.hasAttribute?.('data-sent')?'data-sent':active?.hasAttribute?.('data-select')?'data-select':'';
    const fragment=document.createDocumentFragment();
    for(const row of page){
      const card=document.createElement('article');card.className='pc-diag-row';card.dataset.reportId=row.id;
      const date=row.receivedAt?new Date(row.receivedAt).toLocaleString('ms-MY'):'';
      card.innerHTML='<input type="checkbox" data-select aria-label="Pilih laporan '+esc(row.manufacturer+' '+row.model)+' untuk padam"><div class="pc-diag-content"><span class="pc-diag-brand">'+esc(filters.brand(row))+'</span><b>'+esc([row.manufacturer,row.model].filter(Boolean).join(' ')||'PC Diagnostic')+'</b><p>Serial '+esc(row.serial||'Tidak tersedia')+' · Battery '+esc((row.batteries||[]).map(x=>x.name).filter(Boolean).join(', ')||'Tidak dikesan')+'</p><small>'+esc(date)+'</small><label class="pc-diag-sent-label"><input type="checkbox" data-sent> Sudah hantar ke dealer</label><small data-sent-info></small></div><div class="pc-diag-buttons"><button class="btn" data-action="view">Lihat TXT</button><button class="btn" data-action="download">Download TXT</button><button class="btn" data-action="dealer">WhatsApp Dealer</button></div>';
      const box=card.querySelector('[data-select]');box.checked=selected.has(row.id);box.disabled=busy||deleting;
      box.addEventListener('change',event=>{if(deleting||busy)return;event.target.checked?selected.add(row.id):selected.delete(row.id);selection();});
      const sentBox=card.querySelector('[data-sent]');sentBox.disabled=busy||deleting||statusBusy.has(row.id);
      sentBox.addEventListener('change',event=>void manualSent(row.id,event.target));
      card.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)void action(row.id,button.dataset.action,button);});
      paintStatus(card,row);fragment.appendChild(card);
    }
    el('pcDiagList').replaceChildren(fragment);
    if(focusedId&&focusedKind)el('pcDiagList').querySelector('[data-report-id="'+focusedId+'"] ['+focusedKind+']')?.focus({preventScroll:true});
    el('pcDiagClearSearch').hidden=!el('pcDiagSearch').value;
    el('pcDiagResults').textContent=(matches.length ? ((currentPage-1)*size+1)+'–'+Math.min(currentPage*size,matches.length)+' daripada '+matches.length : '0')+' laporan sepadan · '+rows.length+' laporan dimuatkan'+(busy?' · Masih memuatkan…':cursor?' · Senarai belum lengkap; sambung muatkan laporan.':'');
    el('pcDiagEmpty').hidden=page.length>0||busy;
    el('pcDiagPageInfo').textContent='Halaman '+currentPage+' / '+pages;
    el('pcDiagPrev').disabled=currentPage===1||deleting;
    el('pcDiagNext').disabled=currentPage===pages||deleting;
    selection();
  }
  function changeFilters(){currentPage=1;selected.clear();render();}
  for(const id of ['pcDiagBrand','pcDiagSentFilter','pcDiagBatteryFilter','pcDiagSort','pcDiagPageSize'])el(id).addEventListener('change',changeFilters);
  el('pcDiagSearch').addEventListener('input',()=>{clearTimeout(inputTimer);inputTimer=setTimeout(changeFilters,120);});
  function clearSearch(){clearTimeout(inputTimer);el('pcDiagSearch').value='';changeFilters();el('pcDiagSearch').focus();}
  el('pcDiagClearSearch').addEventListener('click',clearSearch);
  el('pcDiagSearch').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();clearSearch();}});
  el('pcDiagResetFilters').addEventListener('click',()=>{clearTimeout(inputTimer);for(const id of ['pcDiagSearch','pcDiagBrand','pcDiagSentFilter','pcDiagBatteryFilter'])el(id).value='';el('pcDiagSort').value='newest';changeFilters();});
  for(const button of section.querySelectorAll('[data-report-status]'))button.addEventListener('click',()=>{el('pcDiagSentFilter').value=button.dataset.reportStatus;changeFilters();});
  el('pcDiagPrev').addEventListener('click',()=>{currentPage--;selected.clear();render();});
  el('pcDiagNext').addEventListener('click',()=>{currentPage++;selected.clear();render();});
  async function load(reset) {
    if(busy||deleting||statusBusy.size)return;
    busy=true;updatesWhileLoading.clear();render();el('pcDiagRefresh').disabled=el('pcDiagMore').disabled=true;
    notice('Memuatkan ringkasan semua laporan…');
    let next=reset?'':cursor, first=true;
    const seen=new Set();
    try {
      do {
        if(seen.has(next))throw Error('Halaman laporan berulang. Cuba Refresh.');seen.add(next);
        const result=await api(base+(next?'?cursor='+encodeURIComponent(next):''));
        if(reset&&first){reports.clear();selected.clear();currentPage=1;}first=false;
        for(const row of result.reports||[]){
          const update=updatesWhileLoading.get(row.id);
          if(update && (update.manualRevision||0)>=(row.status?.manualRevision||0))row.status=update;
          if(!reports.has(row.id))reports.set(row.id,row);
        }
        cursor=result.nextCursor||'';next=cursor;render();
        notice('Memuatkan ringkasan laporan: '+reports.size+' diterima…');
      }while(next);
      notice(reports.size?'Senarai laporan lengkap. Semak ketepatan sebelum bertanya stok.':'Belum ada laporan.');
    }catch(error){notice(error.message+(cursor?' Tekan Sambung muatkan laporan untuk cuba lagi.':''));}
    finally{busy=false;render();el('pcDiagRefresh').disabled=false;el('pcDiagMore').disabled=!cursor;el('pcDiagMore').hidden=!cursor;}
  }
  async function action(id,kind,button) {
    button.disabled = true;
    const sequence = ++requestNumber;
    try {
      if (kind === 'download') {
        const {blob,filename} = await window.azAdminFetchBlob(base + '/' + encodeURIComponent(id) + '?download=1',{cache:'no-store'});
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = filename || 'AZOBSS_PC_Report.txt';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),30000);
        return;
      }
      const {row} = await api(base + '/' + encodeURIComponent(id));
      if (sequence !== requestNumber) return;
      activeReport=row;
      showStatus(id,row.status);
      el('pcDiagReportText').textContent = kind === 'view' ? row.report : row.dealerMessage;
      el('pcDiagDealerControls').hidden = kind !== 'dealer';
      el('pcDiagDealerPhone').value = '';
      el('pcDiagPhoneError').textContent = '';
      el('pcDiagDealerForm').hidden = true;
      el('pcDiagBridgeHelp').hidden = window.AZOBSSCustomerWhatsApp1542?.bridgeDeliveryReady?.() === true;
      el('pcDiagDialog').showModal();
      if (kind === 'dealer') {
        el('pcDiagOpenWhatsApp').disabled = true;
        try { await loadDealers(); }
        catch (error) { el('pcDiagPhoneError').textContent = error.message; }
        finally { el('pcDiagOpenWhatsApp').disabled = false; }
      }
    } catch (error) { notice(error.message); }
    finally { button.disabled = false; }
  }
  el('pcDiagDealerSelect').addEventListener('change',event => {
    selectedDealer = event.target.value;
    el('pcDiagDealerPhone').value = selectedDealer;
    el('pcDiagPhoneError').textContent = '';
  });
  el('pcDiagAddDealer').addEventListener('click',() => {
    el('pcDiagPhoneError').textContent = '';
    el('pcDiagDealerForm').hidden = false;
    el('pcDiagDealerName').value = '';
    el('pcDiagNewDealerPhone').value = '';
    el('pcDiagDealerSaveStatus').textContent = '';
    el('pcDiagDealerName').focus();
  });
  el('pcDiagCancelDealer').addEventListener('click',() => { el('pcDiagDealerForm').hidden = true; });
  el('pcDiagSaveDealer').addEventListener('click',async () => {
    const button = el('pcDiagSaveDealer');
    button.disabled = true;
    el('pcDiagDealerSaveStatus').textContent = 'Menyimpan dealer…';
    try {
      const result = await api(base + '/dealers',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:el('pcDiagDealerName').value.trim(),phone:el('pcDiagNewDealerPhone').value.trim()})
      });
      selectedDealer = result.dealer.phone;
      await loadDealers();
      el('pcDiagDealerForm').hidden = true;
      el('pcDiagPhoneError').textContent = 'Dealer disimpan.';
    } catch (error) { el('pcDiagDealerSaveStatus').textContent = error.message; }
    finally { button.disabled = false; }
  });
  el('pcDiagOpenWhatsApp').addEventListener('click', async () => {
    const raw = el('pcDiagDealerPhone').value.trim();
    let phone = raw.replace(/[\s()+-]/g,'');
    if (phone.startsWith('0')) phone = '60' + phone.slice(1);
    if (!/^[1-9][0-9]{6,14}$/.test(phone)) {
      el('pcDiagPhoneError').textContent = 'Masukkan nombor dealer yang sah, termasuk kod negara.';
      return;
    }
    el('pcDiagPhoneError').textContent = '';
    const button = el('pcDiagOpenWhatsApp');
    button.disabled = true;
    try {
      const bridge = window.AZOBSSCustomerWhatsApp1542;
      if (typeof bridge?.openDraft !== 'function') throw Error('Refresh Admin untuk memuatkan WhatsApp Bridge terkini.');
      const current=await api(base+'/'+encodeURIComponent(activeReport.id));
      activeReport=current.row;showStatus(activeReport.id,activeReport.status);
      const delivery={reportId:activeReport.id,eventId:crypto.randomUUID(),manualRevision:activeReport.status?.manualRevision||0};
      const ready = await bridge.openDraft(phone,activeReport.dealerMessage,{delivery});
      el('pcDiagPhoneError').textContent = ready ? (bridge.bridgeDeliveryReady?.() ? 'Draf tersedia. Tanda hantar akan dikemas kini selepas anda menekan Send di WhatsApp.' : 'Draf tersedia. Tanda automatik memerlukan Bridge 1.3.6; tick manual selepas menghantar.') : 'Semak nombor dealer pada tab WhatsApp sedia ada sebelum menampal nota yang disalin. Autoisi memerlukan Bridge 1.3.5.';
    } catch (error) { el('pcDiagPhoneError').textContent = error.message; }
    finally { button.disabled = false; }
  });
  el('pcDiagClose').addEventListener('click',()=>{requestNumber++;el('pcDiagDialog').close();});
  el('pcDiagRefresh').addEventListener('click',()=>void load(true));
  el('pcDiagMore').addEventListener('click',()=>void load(false));
  document.addEventListener('click',event=>{
    if (event.target.closest('[data-tab="pcdiagnostics"]')) setTimeout(()=>void load(true),0);
  });
})();
