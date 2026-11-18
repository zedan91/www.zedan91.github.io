(() => {
  'use strict';
  const base = 'https://azobss-backend.onrender.com/api/admin/pc-diagnostics';
  const el = id => document.getElementById(id);
  const section = el('pcdiagnostics');
  if (!section) return;
  let cursor = '', busy = false, requestNumber = 0;
  let dealers = [], selectedDealer = '60182491182', activeReport = null, deleting = false;
  const reports = new Map(), selected = new Set(), statusBusy = new Set();
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
    all.checked=reports.size>0 && count===reports.size;
    all.indeterminate=count>0 && count<reports.size;
    all.disabled=deleting || busy || !reports.size;
    el('pcDiagSelectedCount').textContent=count+' dipilih';
    el('pcDiagDeleteSelected').disabled=deleting || busy || !count;
  }
  function showStatus(id,status) {
    const row=reports.get(id); if (!row) return;
    row.status=status || {sent:false,manualRevision:0};
    const card=document.querySelector('[data-report-id="'+id+'"]');
    if (!card) return;
    card.querySelector('[data-sent]').checked=row.status.sent===true;
    card.classList.toggle('pc-diag-sent',row.status.sent===true);
    card.querySelector('[data-sent-info]').textContent=row.status.sent
      ? (row.status.source==='bridge' ? 'Disahkan WhatsApp' : 'Ditanda manual')+(row.status.dealerPhone ? ' · +'+row.status.dealerPhone : '')
        +(row.status.sentAt ? ' · '+new Date(row.status.sentAt).toLocaleString('ms-MY') : '')
      : 'Belum ditanda hantar';
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
    finally {statusBusy.delete(id);box.disabled=false;}
  }
  el('pcDiagSelectAll').addEventListener('change',event=>{
    for (const id of reports.keys()) event.target.checked ? selected.add(id) : selected.delete(id);
    for (const box of el('pcDiagList').querySelectorAll('[data-select]')) box.checked=selected.has(box.closest('[data-report-id]').dataset.reportId);
    selection();
  });
  el('pcDiagDeleteSelected').addEventListener('click',async()=>{
    const ids=[...selected];
    if (deleting || busy || !ids.length || statusBusy.size || !window.confirm('Padam '+ids.length+' laporan yang dipilih secara kekal? Fail TXT turut dipadam daripada Cloudflare.')) return;
    deleting=true; selection();
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
    finally {deleting=false;selection();el('pcDiagRefresh').disabled=false;el('pcDiagMore').disabled=!cursor;}
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
  async function load(reset) {
    if (busy || deleting || statusBusy.size) return;
    busy = true;
    selection();
    el('pcDiagRefresh').disabled = el('pcDiagMore').disabled = true;
    notice('Memuatkan laporan…');
    try {
      const page = await api(base + (reset || !cursor ? '' : '?cursor=' + encodeURIComponent(cursor)));
      if (reset) {el('pcDiagList').replaceChildren();reports.clear();selected.clear();}
      const fragment = document.createDocumentFragment();
      for (const row of page.reports || []) {
        if(reports.has(row.id)) continue;
        reports.set(row.id,row);
        const card = document.createElement('article');
        card.className = 'pc-diag-row';
        card.dataset.reportId=row.id;
        const date = row.receivedAt ? new Date(row.receivedAt).toLocaleString('ms-MY') : '';
        card.innerHTML = '<input type="checkbox" data-select aria-label="Pilih laporan '+esc(row.manufacturer+' '+row.model)+' untuk padam"><div class="pc-diag-content"><b>' + esc([row.manufacturer,row.model].filter(Boolean).join(' ') || 'PC Diagnostic') +
          '</b><p>Serial ' + esc(row.serial || 'Tidak tersedia') + ' · Battery ' +
          esc((row.batteries || []).map(x=>x.name).filter(Boolean).join(', ') || 'Tidak dikesan') +
          '</p><small>' + esc(date) + '</small><label class="pc-diag-sent-label"><input type="checkbox" data-sent> Sudah hantar ke dealer</label><small data-sent-info></small></div><div class="pc-diag-buttons"><button class="btn" data-action="view">Lihat TXT</button><button class="btn" data-action="download">Download TXT</button><button class="btn" data-action="dealer">WhatsApp Dealer</button></div>';
        card.querySelector('[data-select]').addEventListener('change',event=>{
          if(deleting){event.target.checked=selected.has(row.id);return;}
          event.target.checked ? selected.add(row.id) : selected.delete(row.id);selection();
        });
        card.querySelector('[data-sent]').addEventListener('change',event=>void manualSent(row.id,event.target));
        card.addEventListener('click', event => {
          const button = event.target.closest('[data-action]');
          if (!button) return;
          void action(row.id,button.dataset.action,button);
        });
        fragment.appendChild(card);
      }
      el('pcDiagList').appendChild(fragment);
      for(const row of reports.values())showStatus(row.id,row.status);
      selection();
      cursor = page.nextCursor || '';
      notice(el('pcDiagList').children.length ? 'Laporan diterima daripada PC pelanggan. Semak ketepatan sebelum bertanya stok.' : 'Belum ada laporan.');
    } catch (error) { notice(error.message); }
    finally {
      busy = false;
      selection();
      el('pcDiagRefresh').disabled = false;
      el('pcDiagMore').disabled = !cursor;
      el('pcDiagMore').hidden = !cursor;
    }
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
