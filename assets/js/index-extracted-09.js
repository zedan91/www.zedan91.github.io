// Extracted from index.html. Order preserved.

/* =========================================================
   AZOBSS LUCKY DRAW RENDER BACKEND BRIDGE
   Tukar URL ini selepas deploy backend di Render:
========================================================= */
window.AZOBSS_LUCKY_DRAW_API =
localStorage.getItem('azobssLuckyDrawBackendUrl') ||
'https://azobss-lucky-draw-api.onrender.com';

(function(){
  const api = () => (window.AZOBSS_LUCKY_DRAW_API || '').replace(/\/$/, '');

  function getAdminKey(){
    return '';
  }

  async function apiFetch(path, options = {}){
    const headers = options.headers || {};
    // No password mode: backend does not require ADMIN_KEY.
    const baseUrl = api();
    if(!baseUrl) throw new Error('Render backend URL belum diset.');
    try{
      return await fetch(baseUrl + path, { ...options, headers });
    }catch(error){
      throw new Error('NetworkError: Backend tidak dapat dihubungi. Pastikan URL Render betul, bermula https://, service Render sudah live, dan buka /api/health berjaya. URL sekarang: ' + baseUrl);
    }
  }

  function getCurrentUserFromStorage(){
    const raw =
      sessionStorage.getItem('azobssCurrentUser') ||
      localStorage.getItem('azobssCurrentUser') ||
      sessionStorage.getItem('azobssUser') ||
      localStorage.getItem('azobssUser');

    if(!raw) return null;

    try{
      const obj = JSON.parse(raw);
      if(obj && typeof obj === 'object') return obj;
    }catch(e){
      return { name: raw, usernameKey: raw };
    }

    return null;
  }

  function getMonthKey(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function setStatus(message){
    const status = document.getElementById('luckyDrawParticipantsStatus') ||
                   document.getElementById('luckyDrawPrizeSaveStatus') ||
                   document.getElementById('luckyDrawStatus');
    if(status) status.textContent = message || '';
  }

  async function loadPrizeFromBackend(){
    try{
      const res = await apiFetch('/api/lucky-draw/prize?monthKey=' + encodeURIComponent(getMonthKey()));
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Backend prize error');

      const prize = data.prize || {};
      const img = document.getElementById('luckyDrawPrizeImage');
      const title = document.getElementById('luckyDrawPrizeTitle');
      const desc = document.getElementById('luckyDrawPrizeDescription');
      const titleInput = document.getElementById('luckyDrawPrizeTitleInput');
      const descInput = document.getElementById('luckyDrawPrizeDescriptionInput');

      if(img) img.src = prize.imageUrl || 'Lucky-draw/prize-placeholder.svg';
      if(title) title.textContent = prize.title || 'Hadiah Lucky Draw bulan ini masih belum diumumkan.';
      if(desc) desc.innerText = prize.description || '';
      if(titleInput) titleInput.value = prize.title || '';
      if(descInput) descInput.value = prize.description || '';
    }catch(e){
      console.warn('Lucky Draw backend prize load failed:', e);
    }
  }

  async function savePrizeToBackend(event){
    const btn = event.target.closest('#saveLuckyDrawPrizeButton');
    if(!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const fileInput = document.getElementById('luckyDrawPrizeImageFile');
    const titleInput = document.getElementById('luckyDrawPrizeTitleInput');
    const descInput = document.getElementById('luckyDrawPrizeDescriptionInput');
    const status = document.getElementById('luckyDrawPrizeSaveStatus') || document.getElementById('luckyDrawParticipantsStatus');

    try{
      const form = new FormData();
      if(fileInput && fileInput.files && fileInput.files[0]) form.append('image', fileInput.files[0]);
      form.append('monthKey', getMonthKey());
      form.append('title', titleInput ? titleInput.value : '');
      form.append('description', descInput ? descInput.value : '');
      const user = getCurrentUserFromStorage();
      form.append('updatedBy', user ? (user.usernameKey || user.name || 'admin') : 'admin');

      if(status) status.textContent = 'Saving prize to Render backend...';

      const res = await apiFetch('/api/lucky-draw/prize', {
        method:'POST',
        body:form,
        admin:true
      });

      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Save prize failed');

      if(status) status.textContent = 'Hadiah berjaya disimpan ke Render backend.';
      await loadPrizeFromBackend();
    }catch(e){
      if(status) status.textContent = 'Backend save gagal: ' + e.message;
    }
  }


  const LUCKY_DRAW_PUBLIC_LIMIT = 4;

  const LUCKY_DRAW_ADMIN_LIMIT = 4;
  let luckyDrawAdminRows = [];
  let luckyDrawAdminPage = 1;

  function renderLuckyDrawAdminTable(rows){
    const adminBody = document.getElementById('luckyDrawAdminTableBody');
    const pagination = document.getElementById('luckyDrawAdminPagination');
    if(!adminBody) return;

    const list = Array.isArray(rows) ? rows : [];
    const totalPages = Math.max(1, Math.ceil(list.length / LUCKY_DRAW_ADMIN_LIMIT));

    if(luckyDrawAdminPage > totalPages) luckyDrawAdminPage = totalPages;
    if(luckyDrawAdminPage < 1) luckyDrawAdminPage = 1;

    if(!list.length){
      adminBody.innerHTML = '<tr><td colspan="9">Belum ada peserta.</td></tr>';
      if(pagination) pagination.innerHTML = '';
      return;
    }

    const start = (luckyDrawAdminPage - 1) * LUCKY_DRAW_ADMIN_LIMIT;
    const pageRows = list.slice(start, start + LUCKY_DRAW_ADMIN_LIMIT);

    adminBody.innerHTML = pageRows.map((entry, idx) => {
      const no = start + idx + 1;
      return `
        <tr data-backend-entry-id="${escapeLuckyDrawText(entry.id || '')}">
          <td>${no}</td>
          <td>${escapeLuckyDrawText(entry.monthKey || '-')}</td>
          <td>${escapeLuckyDrawText(entry.usernameKey || '-')}</td>
          <td><input data-field="name" value="${escapeLuckyDrawText(entry.name || '')}"></td>
          <td><input data-field="phone" value="${escapeLuckyDrawText(entry.phone || '')}"></td>
          <td><input data-field="contactEmail" value="${escapeLuckyDrawText(entry.contactEmail || '')}"></td>
          <td><input data-field="inviteCode" value="${escapeLuckyDrawText(entry.inviteCode || '')}"></td>
          <td>${escapeLuckyDrawText(formatLuckyDrawJoinDate(entry.joinedAt || entry.createdAt || entry.updatedAt))}</td>
          <td>
            <div class="lucky-draw-admin-actions">
              <button class="lucky-draw-save-btn" type="button">Save</button>
              <button class="lucky-draw-hide-btn" type="button">Buang</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if(!pagination) return;

    const pageButtons = Array.from({length: totalPages}, (_, i) => {
      const page = i + 1;
      return `<button type="button" class="${page === luckyDrawAdminPage ? 'is-active' : ''}" data-admin-page="${page}">${page}</button>`;
    }).join('');

    pagination.innerHTML = `
      <button type="button" data-admin-page="first" ${luckyDrawAdminPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>
      <button type="button" data-admin-page="prev" ${luckyDrawAdminPage === 1 ? 'disabled' : ''}>Previous</button>
      ${pageButtons}
      <button type="button" data-admin-page="next" ${luckyDrawAdminPage === totalPages ? 'disabled' : ''}>Next</button>
      <button type="button" data-admin-page="last" ${luckyDrawAdminPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>
      <button type="button" data-admin-page="show-all">Show All</button>
    `;
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-admin-page]');
    if(!btn) return;

    const action = btn.dataset.adminPage;
    const totalPages = Math.max(1, Math.ceil(luckyDrawAdminRows.length / LUCKY_DRAW_ADMIN_LIMIT));

    if(action === 'first') luckyDrawAdminPage = 1;
    else if(action === 'prev') luckyDrawAdminPage = Math.max(1, luckyDrawAdminPage - 1);
    else if(action === 'next') luckyDrawAdminPage = Math.min(totalPages, luckyDrawAdminPage + 1);
    else if(action === 'last') luckyDrawAdminPage = totalPages;
    else if(action === 'show-all'){
      renderLuckyDrawAdminTable(luckyDrawAdminRows.slice(0, luckyDrawAdminRows.length));
      return;
    }
    else{
      luckyDrawAdminPage = Number(action) || 1;
    }

    renderLuckyDrawAdminTable(luckyDrawAdminRows);
  });

  let luckyDrawPublicRows = [];
  let luckyDrawPublicPage = 1;

  function escapeLuckyDrawText(value){
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function renderLuckyDrawPublicList(rows){
    const publicList = document.getElementById('luckyDrawPublicList');
    const pagination = document.getElementById('luckyDrawPagination');
    if(!publicList) return;

    const list = Array.isArray(rows) ? rows : [];
    const totalPages = Math.max(1, Math.ceil(list.length / LUCKY_DRAW_PUBLIC_LIMIT));

    if(luckyDrawPublicPage > totalPages) luckyDrawPublicPage = totalPages;
    if(luckyDrawPublicPage < 1) luckyDrawPublicPage = 1;

    if(!list.length){
      publicList.innerHTML = '<div class="lucky-draw-empty">Belum ada peserta Lucky Draw.</div>';
      if(pagination) pagination.innerHTML = '';
      return;
    }

    const start = (luckyDrawPublicPage - 1) * LUCKY_DRAW_PUBLIC_LIMIT;
    const pageRows = list.slice(start, start + LUCKY_DRAW_PUBLIC_LIMIT);

    publicList.innerHTML = pageRows.map((entry, idx) => {
      const number = start + idx + 1;
      const name = escapeLuckyDrawText(entry.name || entry.usernameKey || 'User');
      const joinedDate = escapeLuckyDrawText(formatLuckyDrawJoinDate(entry.joinedAt || entry.createdAt || entry.updatedAt));
      const username = escapeLuckyDrawText(entry.usernameKey || '-');
      const id = escapeLuckyDrawText(entry.id || '');

      return `
        <div class="lucky-draw-participant-card" data-backend-entry-id="${id}">
          <div>
            <strong>${number}. ${name}</strong>
            <span>${joinedDate}</span>
          </div>
          <button class="lucky-draw-remove-participant-btn" type="button" data-backend-action="remove-public">Buang</button>
        </div>
      `;
    }).join('');

    if(!pagination) return;

    const pageButtons = Array.from({length: totalPages}, (_, i) => {
      const page = i + 1;
      return `<button type="button" class="${page === luckyDrawPublicPage ? 'is-active' : ''}" data-lucky-page="${page}">${page}</button>`;
    }).join('');

    pagination.innerHTML = `
      <button type="button" data-lucky-page="first" ${luckyDrawPublicPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>
      <button type="button" data-lucky-page="prev" ${luckyDrawPublicPage === 1 ? 'disabled' : ''}>Previous</button>
      ${pageButtons}
      <button type="button" data-lucky-page="next" ${luckyDrawPublicPage === totalPages ? 'disabled' : ''}>Next</button>
      <button type="button" data-lucky-page="last" ${luckyDrawPublicPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>
      <button type="button" data-lucky-page="show-all">Show All</button>
    `;
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-lucky-page]');
    if(!btn) return;

    const action = btn.dataset.luckyPage;
    const totalPages = Math.max(1, Math.ceil(luckyDrawPublicRows.length / LUCKY_DRAW_PUBLIC_LIMIT));

    if(action === 'first') luckyDrawPublicPage = 1;
    else if(action === 'prev') luckyDrawPublicPage = Math.max(1, luckyDrawPublicPage - 1);
    else if(action === 'next') luckyDrawPublicPage = Math.min(totalPages, luckyDrawPublicPage + 1);
    else if(action === 'last') luckyDrawPublicPage = totalPages;
    else if(action === 'show-all'){
      const publicList = document.getElementById('luckyDrawPublicList');
      const pagination = document.getElementById('luckyDrawPagination');
      if(publicList){
        publicList.innerHTML = luckyDrawPublicRows.length
          ? luckyDrawPublicRows.map((entry, i) => `
              <div class="lucky-draw-participant-card" data-backend-entry-id="${escapeLuckyDrawText(entry.id || '')}">
                <div>
                  <strong>${i+1}. ${escapeLuckyDrawText(entry.name || entry.usernameKey || 'User')}</strong>
                  <span>${escapeLuckyDrawText(formatLuckyDrawJoinDate(entry.joinedAt || entry.createdAt || entry.updatedAt))}</span>
                </div>
                <button class="lucky-draw-remove-participant-btn" type="button" data-backend-action="remove-public">Buang</button>
              </div>
            `).join('')
          : '<div class="lucky-draw-empty">Belum ada peserta Lucky Draw.</div>';
      }
      if(pagination){
        pagination.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
      }
      return;
    }
    else{
      luckyDrawPublicPage = Number(action) || 1;
    }

    renderLuckyDrawPublicList(luckyDrawPublicRows);
  });


  function formatLuckyDrawJoinDate(value){
    if(!value) return '-';
    try{
      const d = new Date(value);
      if(!isNaN(d.getTime())){
        return d.toLocaleString('en-MY', {
          day:'2-digit',
          month:'2-digit',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit',
          hour12:true
        });
      }
    }catch(e){}
    return String(value);
  }

  function renderLuckyDrawRecentJoins(rows){
    const box = document.getElementById('luckyDrawRecentJoinList');
    if(!box) return;

    const list = Array.isArray(rows) ? rows.slice(0, 10) : [];
    if(!list.length){
      box.innerHTML = '<div class="recent-join-empty">Belum ada peserta.</div>';
      return;
    }

    box.innerHTML = list.map((entry, i) => {
      const name = escapeLuckyDrawText(entry.name || entry.usernameKey || 'User');
      const joined = formatLuckyDrawJoinDate(entry.joinedAt || entry.createdAt || entry.updatedAt);
      return `
        <div class="recent-join-item">
          <span class="recent-join-no">${i + 1}</span>
          <div>
            <strong>${name}</strong>
            <small>${joined}</small>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadEntriesFromBackend(){
    try{
      const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(getMonthKey()));
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Entries error');

      const rows = data.entries || [];
      renderLuckyDrawRecentJoins(rows);

      const total = document.getElementById('luckyDrawTotalParticipants');
      if(total) total.textContent = String(data.total || rows.length || 0);

      luckyDrawPublicRows = rows;
      luckyDrawPublicPage = 1;
      renderLuckyDrawPublicList(luckyDrawPublicRows);

      luckyDrawAdminRows = rows;
      luckyDrawAdminPage = 1;
      renderLuckyDrawAdminTable(luckyDrawAdminRows);
    }catch(e){
      console.warn('Lucky Draw backend entries load failed:', e);
    }
  }

  async function joinEntryBackend(){
    const user = getCurrentUserFromStorage();
    if(!user || !(user.usernameKey || user.name)) return;

    const payload = {
      monthKey: getMonthKey(),
      usernameKey: user.usernameKey || user.name,
      uid: user.uid || '',
      name: user.name || user.usernameKey,
      phone: user.phone || '',
      contactEmail: user.contactEmail || user.email || '',
      inviteCode: user.inviteCode || '',
      inviteUrl: ''
    };

    try{
      await apiFetch('/api/lucky-draw/entries', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify(payload)
      });
      setTimeout(loadEntriesFromBackend, 500);
    }catch(e){
      console.warn('Backend join entry failed:', e);
    }
  }

  async function saveEntryBackend(row){
    const id = row && row.dataset.backendEntryId;
    if(!id) return;

    const payload = {
      monthKey: getMonthKey(),
      name: row.querySelector('[data-field="name"]')?.value || '',
      phone: row.querySelector('[data-field="phone"]')?.value || '',
      contactEmail: row.querySelector('[data-field="contactEmail"]')?.value || '',
      inviteCode: row.querySelector('[data-field="inviteCode"]')?.value || ''
    };

    const res = await apiFetch('/api/lucky-draw/entries/' + encodeURIComponent(id), {
      method:'PATCH',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(payload),
      admin:true
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'Save entry failed');
    await loadEntriesFromBackend();
  }

  async function hideEntryBackend(row){
    const id = row && row.dataset.backendEntryId;
    if(!id) return;
    if(!confirm('Buang peserta ini dari Lucky Draw bulan ini? User ini boleh join semula selepas dibuang.')) return;

    const res = await apiFetch('/api/lucky-draw/entries/' + encodeURIComponent(id) + '?monthKey=' + encodeURIComponent(getMonthKey()), {
      method:'DELETE',
      admin:true
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || 'Buang peserta gagal');
    await loadEntriesFromBackend();
  }

  async function resetEntriesBackend(event){
    const btn = event.target.closest('#resetLuckyDrawParticipantsButton');
    if(!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if(!confirm('Reset semua peserta bulan ini?')) return;

    try{
      const res = await apiFetch('/api/lucky-draw/entries?monthKey=' + encodeURIComponent(getMonthKey()), {
        method:'DELETE',
        admin:true
      });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Reset failed');
      setStatus(`Reset peserta selesai. Jumlah reset: ${data.reset}`);
      await loadEntriesFromBackend();
    }catch(e){
      setStatus('Backend reset gagal: ' + e.message);
    }
  }

  async function resetWinnerBackend(event){
    const btn = event.target.closest('#resetLuckyDrawWinnerButton');
    if(!btn) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if(!confirm('Reset pemenang bulan ini?')) return;

    try{
      const res = await apiFetch('/api/lucky-draw/winner?monthKey=' + encodeURIComponent(getMonthKey()), {
        method:'DELETE',
        admin:true
      });
      const data = await res.json();
      if(!data.ok) throw new Error(data.error || 'Reset winner failed');

      setStatus('Winner sudah di-reset di backend.');
      const winner = document.getElementById('luckyDrawWinnerName');
      if(winner) winner.textContent = 'Belum dipilih';
    }catch(e){
      setStatus('Backend reset winner gagal: ' + e.message);
    }
  }

  async function backendTableActions(event){
    const btn = event.target.closest('[data-backend-action]');
    if(!btn) return;
    const row = btn.closest('tr[data-backend-entry-id]');
    if(!row) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try{
      if(btn.dataset.backendAction === 'save') await saveEntryBackend(row);
      if(btn.dataset.backendAction === 'hide') await hideEntryBackend(row);
      if(btn.dataset.backendAction === 'remove-public') await hideEntryBackend(row);
      setStatus('Peserta berjaya dikemaskini / dibuang.');
    }catch(e){
      setStatus('Backend peserta gagal: ' + e.message);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    loadPrizeFromBackend();
    loadEntriesFromBackend();
    setInterval(loadEntriesFromBackend, 30000);
  });

  document.addEventListener('click', savePrizeToBackend, true);
  document.addEventListener('click', resetEntriesBackend, true);
  document.addEventListener('click', resetWinnerBackend, true);
  document.addEventListener('click', backendTableActions, true);

  const joinBtn = document.getElementById('joinLuckyDrawButton');
  if(joinBtn){
    joinBtn.addEventListener('click', function(){
      setTimeout(joinEntryBackend, 600);
    }, false);
  }
})();
