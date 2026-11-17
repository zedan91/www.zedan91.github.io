(() => {
  'use strict';
  const base = 'https://azobss-backend.onrender.com/api/admin/pc-diagnostics';
  const el = id => document.getElementById(id);
  const section = el('pcdiagnostics');
  if (!section) return;
  let cursor = '', busy = false, requestNumber = 0;
  let dealers = [], selectedDealer = '60182491182';
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
  async function load(reset) {
    if (busy) return;
    busy = true;
    el('pcDiagRefresh').disabled = el('pcDiagMore').disabled = true;
    notice('Memuatkan laporan…');
    try {
      const page = await api(base + (reset || !cursor ? '' : '?cursor=' + encodeURIComponent(cursor)));
      if (reset) el('pcDiagList').replaceChildren();
      const fragment = document.createDocumentFragment();
      for (const row of page.reports || []) {
        const card = document.createElement('article');
        card.className = 'pc-diag-row';
        const date = row.receivedAt ? new Date(row.receivedAt).toLocaleString('ms-MY') : '';
        card.innerHTML = '<div><b>' + esc([row.manufacturer,row.model].filter(Boolean).join(' ') || 'PC Diagnostic') +
          '</b><p>Serial ' + esc(row.serial || 'Tidak tersedia') + ' · Battery ' +
          esc((row.batteries || []).map(x=>x.name).filter(Boolean).join(', ') || 'Tidak dikesan') +
          '</p><small>' + esc(date) + '</small></div><div class="pc-diag-buttons"><button class="btn" data-action="view">Lihat TXT</button><button class="btn" data-action="download">Download TXT</button><button class="btn" data-action="dealer">WhatsApp Dealer</button></div>';
        card.addEventListener('click', event => {
          const button = event.target.closest('[data-action]');
          if (!button) return;
          void action(row.id,button.dataset.action,button);
        });
        fragment.appendChild(card);
      }
      el('pcDiagList').appendChild(fragment);
      cursor = page.nextCursor || '';
      notice(el('pcDiagList').children.length ? 'Laporan diterima daripada PC pelanggan. Semak ketepatan sebelum bertanya stok.' : 'Belum ada laporan.');
    } catch (error) { notice(error.message); }
    finally {
      busy = false;
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
      el('pcDiagReportText').textContent = kind === 'view' ? row.report : row.dealerMessage;
      el('pcDiagDealerControls').hidden = kind !== 'dealer';
      el('pcDiagDealerPhone').value = '';
      el('pcDiagPhoneError').textContent = '';
      el('pcDiagDealerForm').hidden = true;
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
  el('pcDiagOpenWhatsApp').addEventListener('click', () => {
    const raw = el('pcDiagDealerPhone').value.trim();
    let phone = raw.replace(/[\s()+-]/g,'');
    if (phone.startsWith('0')) phone = '60' + phone.slice(1);
    if (phone && !/^[1-9][0-9]{6,14}$/.test(phone)) {
      el('pcDiagPhoneError').textContent = 'Masukkan nombor dealer yang sah, termasuk kod negara.';
      return;
    }
    el('pcDiagPhoneError').textContent = '';
    const url = new URL('https://web.whatsapp.com/send');
    if (phone) url.searchParams.set('phone',phone);
    url.searchParams.set('text',el('pcDiagReportText').textContent);
    window.open(url.href,'azobssDealerWhatsApp');
  });
  el('pcDiagClose').addEventListener('click',()=>{requestNumber++;el('pcDiagDialog').close();});
  el('pcDiagRefresh').addEventListener('click',()=>void load(true));
  el('pcDiagMore').addEventListener('click',()=>void load(false));
  document.addEventListener('click',event=>{
    if (event.target.closest('[data-tab="pcdiagnostics"]')) setTimeout(()=>void load(true),0);
  });
})();
