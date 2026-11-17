(() => {
  'use strict';
  const base = 'https://azobss-backend.onrender.com/api/admin/pc-diagnostics';
  const el = id => document.getElementById(id);
  const section = el('pcdiagnostics');
  if (!section) return;
  let cursor = '', busy = false, requestNumber = 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function notice(message) { el('pcDiagStatus').textContent = message; }
  async function api(url) {
    if (typeof window.azAdminFetchJson !== 'function') throw Error('Sila log masuk sebagai admin dahulu.');
    return window.azAdminFetchJson(url,{cache:'no-store'});
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
      el('pcDiagDialog').showModal();
    } catch (error) { notice(error.message); }
    finally { button.disabled = false; }
  }
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
