(function () {
  'use strict';

  const JUPEM_SEARCH_URL = 'https://ebiz.jupem.gov.my/Produk/PelanAkui';
  const PDF_API = 'https://azobss-backend.onrender.com/api/pa-pdf';
  const ROWS_PER_PAGE = 5;
  const JUPEM_STATE_CODES = Object.freeze({
    JOHOR: '01',
    KEDAH: '02',
    KELANTAN: '03',
    MELAKA: '04',
    'NEGERI SEMBILAN': '05',
    PAHANG: '06',
    'PULAU PINANG': '07',
    PERAK: '08',
    PERLIS: '09',
    SELANGOR: '10',
    TERENGGANU: '11',
    'WILAYAH PERSEKUTUAN KUALA LUMPUR': '14',
    'WILAYAH PERSEKUTUAN LABUAN': '15',
    'WILAYAH PERSEKUTUAN PUTRAJAYA': '16'
  });

  const form = document.getElementById('paSearchForm');
  const stateEl = document.getElementById('negeri');
  const inputEl = document.getElementById('paNumber');
  const generalEl = document.getElementById('paGeneralSearch');
  const searchButton = document.getElementById('paSearchButton');
  const quickAddButton = document.getElementById('paQuickAddButton');
  const errorEl = document.getElementById('paError');
  const statusEl = document.getElementById('paStatus');
  const resultWrap = document.getElementById('paResultWrap');
  const resultsBody = document.getElementById('paResultsBody');
  const pagination = document.getElementById('paPagination');
  const sortButtons = Array.from(form?.querySelectorAll('[data-pa-sort]') || []);

  let allRows = [];
  let filteredRows = [];
  let currentPage = 1;
  let sortKey = '_sourceIndex';
  let sortDirection = 'asc';
  let activeSearchTask = null;
  let lotMapOpenSerial = 0;
  const textCollator = new Intl.Collator('en-MY', { numeric: true, sensitivity: 'base' });

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function cleanNumber(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^PA/, '')
      .replace(/\.TIF$/, '')
      .replace(/[^0-9]/g, '');
  }

  function absoluteJupemUrl(value) {
    const path = String(value || '').trim();
    if (!path) return '';
    try {
      return new URL(path, JUPEM_SEARCH_URL).href;
    } catch (_) {
      return '';
    }
  }

  function buildDownloadUrl(paNo, state) {
    const params = new URLSearchParams({ noPA: `${paNo}.TIF`, negeri: state });
    return `${PDF_API}?${params.toString()}`;
  }

  function encodeRecord(record) {
    return encodeURIComponent(JSON.stringify(record));
  }

  function setQuickStatus(message, state) {
    if (!statusEl) return;
    statusEl.style.removeProperty('display');
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-checking', 'is-success', 'is-unavailable');
    if (state) statusEl.classList.add(`is-${state}`);
  }

  function ensurePaPreviewModal() {
    let modal = document.getElementById('paViewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'paViewModal';
    modal.className = 'syit-sheet-modal pabm-pa-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <button class="syit-sheet-modal-backdrop" type="button" aria-label="Tutup pratonton PA"></button>
      <div class="syit-sheet-modal-dialog pabm-pa-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="paViewModalTitle">
        <div class="syit-sheet-modal-head">
          <strong id="paViewModalTitle">Lihat PA</strong>
          <button class="syit-sheet-modal-close" type="button" aria-label="Tutup pratonton PA">&times;</button>
        </div>
        <div class="syit-sheet-modal-body pabm-pa-modal-body">
          <span class="syit-sheet-modal-loading">Sedang memuatkan butiran PA...</span>
          <div class="pabm-pa-modal-content" hidden>
            <div class="pabm-pa-preview-image"><img alt="" hidden></div>
            <section class="pabm-pa-preview-details" aria-label="PA details"></section>
            <section class="pabm-pa-preview-lots" aria-label="Lot list"></section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('pabm-modal-open');
    };
    modal.querySelector('.syit-sheet-modal-close').addEventListener('click', close);
    modal.querySelector('.syit-sheet-modal-backdrop').addEventListener('click', close);
    modal.querySelector('.pabm-pa-preview-lots').addEventListener('click', async (event) => {
      const lotButton = event.target.closest('[data-lot-focus-map]');
      if (!lotButton) return;
      event.preventDefault();
      if (typeof window.azobssOpenLotFocusMap !== 'function') return;
      const openSerial = ++lotMapOpenSerial;
      modal.querySelectorAll('[data-lot-focus-map]').forEach((button) => { button.disabled = true; });
      lotButton.setAttribute('aria-busy', 'true');
      try {
        await window.azobssOpenLotFocusMap({
          mapUrl: lotButton.dataset.lotMapUrl || '',
          lotNo: lotButton.dataset.lotNumber || '',
          paNo: lotButton.dataset.lotPaNumber || '',
          stateCode: lotButton.dataset.lotStateCode || '',
          stateName: lotButton.dataset.lotStateName || '',
          productCode: lotButton.dataset.lotProductCode || '1',
          daerah: lotButton.dataset.lotDaerah || '',
          mukim: lotButton.dataset.lotMukim || '',
          seksyen: lotButton.dataset.lotSeksyen || ''
        });
      } finally {
        if (openSerial === lotMapOpenSerial) {
          modal.querySelectorAll('[data-lot-focus-map]').forEach((button) => {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          });
        }
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open') && !document.querySelector('.az-lot-focus-modal')) close();
    });
    return modal;
  }

  function parsePaPreview(html, fallbackName) {
    const detailDocument = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const image = detailDocument.querySelector('.modal-body img.loading, .modal-body img[src*="RenderImage"]');
    const detailColumn = Array.from(detailDocument.querySelectorAll('.modal-body .col-md-3'))
      .find((column) => column.querySelector('h3'));
    const title = detailColumn?.querySelector('h3')?.textContent.replace(/\s+/g, ' ').trim() || fallbackName || 'Lihat PA';
    const details = Array.from(detailColumn?.querySelectorAll('h5') || [])
      .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
      .filter((text) => text && !/^Beli Pelan Akui/i.test(text));
    const stateLine = details.find((line) => /^Negeri\s*:/i.test(line)) || '';
    const stateName = stateLine.replace(/^Negeri\s*:\s*/i, '').replace(/^Negeri\s+/i, '').trim().toUpperCase();
    const stateCode = JUPEM_STATE_CODES[stateName] || '';
    const detailValue = (labels) => {
      const line = details.find((text) => labels.some((label) => new RegExp(`^${label}\\s*:`, 'i').test(text))) || '';
      return line.replace(/^[^:]+:\s*/, '').trim();
    };
    const daerah = detailValue(['Daerah', 'District']);
    const mukim = detailValue(['Mukim', 'Bandar', 'Pekan']);
    const seksyen = detailValue(['Seksyen', 'Section']);
    const lots = Array.from(detailDocument.querySelectorAll('#exampleMini tbody a')).map((link) => {
      const url = absoluteJupemUrl(link.getAttribute('href'));
      let productCode = '1';
      let mapStateCode = stateCode;
      try {
        const parsed = new URL(url);
        const type = String(parsed.searchParams.get('type') || '');
        productCode = /c3/i.test(type) || parsed.searchParams.get('produk') === '2' ? '2' : '1';
        mapStateCode = parsed.searchParams.get('neg') || (type.match(/^(\d{2})lot/i) || [])[1] || stateCode;
      } catch (_) {}
      return {
        number: link.textContent.replace(/\s+/g, ' ').trim(),
        url,
        productCode,
        stateCode: mapStateCode
      };
    }).filter((lot) => lot.number);
    return {
      title,
      imageUrl: absoluteJupemUrl(image?.getAttribute('src')),
      details,
      lots,
      stateName,
      stateCode,
      daerah,
      mukim,
      seksyen
    };
  }

  async function openPaPreview(button) {
    const detailUrl = String(button.dataset.paViewUrl || '').trim();
    const fallbackName = String(button.dataset.paViewName || '').trim();
    if (!detailUrl) return;
    const modal = ensurePaPreviewModal();
    const title = modal.querySelector('#paViewModalTitle');
    const loading = modal.querySelector('.syit-sheet-modal-loading');
    const content = modal.querySelector('.pabm-pa-modal-content');
    const image = modal.querySelector('.pabm-pa-preview-image img');
    const details = modal.querySelector('.pabm-pa-preview-details');
    const lots = modal.querySelector('.pabm-pa-preview-lots');
    title.textContent = fallbackName ? `Lihat ${fallbackName}` : 'Lihat PA';
    loading.hidden = false;
    loading.textContent = 'Sedang memuatkan butiran PA...';
    content.hidden = true;
    image.hidden = true;
    image.removeAttribute('src');
    details.innerHTML = '';
    lots.innerHTML = '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pabm-modal-open');
    modal.querySelector('.syit-sheet-modal-close').focus();
    try {
      const response = await fetch(detailUrl, { cache: 'no-store', mode: 'cors' });
      if (!response.ok) throw new Error(`JUPEM returned HTTP ${response.status}.`);
      const preview = parsePaPreview(await response.text(), fallbackName);
      title.textContent = preview.title;
      details.innerHTML = `<h3>${escapeHtml(preview.title)}</h3>` + (preview.details.length
        ? preview.details.map((line) => `<p>${escapeHtml(line)}</p>`).join('')
        : '<p>PA details are unavailable.</p>');
      lots.innerHTML = '<h3>Senarai Lot</h3>' + (preview.lots.length
        ? `<ol>${preview.lots.map((lot) => `<li>${lot.url ? `<button class="pabm-pa-lot-map-button" type="button" data-lot-focus-map data-lot-map-url="${escapeHtml(lot.url)}" data-lot-number="${escapeHtml(lot.number)}" data-lot-pa-number="${escapeHtml(preview.title)}" data-lot-state-code="${escapeHtml(lot.stateCode || preview.stateCode || '')}" data-lot-state-name="${escapeHtml(preview.stateName || '')}" data-lot-product-code="${escapeHtml(lot.productCode || '1')}" data-lot-daerah="${escapeHtml(preview.daerah || '')}" data-lot-mukim="${escapeHtml(preview.mukim || '')}" data-lot-seksyen="${escapeHtml(preview.seksyen || '')}" title="Lihat Lot ${escapeHtml(lot.number)} pada peta">${escapeHtml(lot.number)}</button>` : escapeHtml(lot.number)}</li>`).join('')}</ol>`
        : '<p>Senarai lot tidak tersedia.</p>');
      if (preview.imageUrl) {
        image.alt = `${preview.title} preview`;
        image.onload = () => { image.hidden = false; };
        image.onerror = () => { image.hidden = true; };
        image.src = preview.imageUrl;
      }
      loading.hidden = true;
      content.hidden = false;
    } catch (_) {
      content.hidden = true;
      loading.hidden = false;
      loading.textContent = 'Pratonton PA ini tidak dapat dimuatkan. Sila cuba lagi.';
    }
  }

  window.azobssOpenPaPreview = openPaPreview;

  if (!form || !stateEl || !inputEl || !generalEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

  function setSearchBusy(isBusy) {
    searchButton.disabled = false;
    searchButton.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    const label = searchButton.querySelector('span');
    if (label) label.textContent = isBusy ? 'Batal Carian PA' : 'Cari PA';
  }

  function cancelActiveSearch(message) {
    const task = activeSearchTask;
    if (!task) return false;
    activeSearchTask = null;
    window.clearTimeout(task.timeout);
    task.controller.abort();
    setSearchBusy(false);
    if (message) setQuickStatus(message, 'unavailable');
    return true;
  }

  function buildPaCartRecord(row, state) {
    const paNo = String(row?.paNo || '').trim().toUpperCase();
    const itemCode = paNo.replace(/^PA/i, '');
    return {
      productType: 'PA',
      itemCode,
      negeri: state,
      amount: 5,
      downloadUrl: buildDownloadUrl(paNo, state),
      filename: `${paNo}.pdf`,
      azobssCartValidated: true,
      azobssCartValidatedBy: 'jupem-pa-search'
    };
  }

  function parseOfficialResults(html) {
    const documentResult = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const table = documentResult.querySelector('table#example');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 7) return null;
      const paNo = cells[1]?.textContent.trim().toUpperCase() || '';
      const viewPaTrigger = row.querySelector('[onclick*="PelanAkuiDetail"]');
      const viewPaMatch = String(viewPaTrigger?.getAttribute('onclick') || '').match(/createModal\(\s*['"]([^'"]+)['"]/i);
      return {
        paNo,
        negeri: cells[2]?.textContent.trim() || '',
        daerah: cells[3]?.textContent.trim() || '',
        mukim: cells[4]?.textContent.trim() || '',
        seksyen: cells[5]?.textContent.trim() || '',
        viewPaUrl: absoluteJupemUrl(viewPaMatch?.[1])
      };
    }).filter((record) => record && /^PA\d+$/i.test(record.paNo));
  }

  async function fetchOfficialResults(number, stateCode, signal) {
    const body = new URLSearchParams({
      negeri: String(Number(stateCode)),
      noPa: number,
      cetak: '0'
    });
    const response = await fetch(JUPEM_SEARCH_URL, {
      method: 'POST',
      cache: 'no-store',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal
    });
    if (!response.ok) throw new Error(`JUPEM returned HTTP ${response.status}.`);
    return parseOfficialResults(await response.text());
  }

  function clearResults() {
    allRows = [];
    filteredRows = [];
    currentPage = 1;
    sortKey = '_sourceIndex';
    sortDirection = 'asc';
    resultWrap.hidden = true;
    resultsBody.innerHTML = '';
    pagination.hidden = true;
    pagination.innerHTML = '';
    generalEl.value = '';
    generalEl.disabled = true;
    updateSortHeaders();
  }

  function sortRows(rows) {
    const direction = sortDirection === 'desc' ? -1 : 1;
    return rows.sort((left, right) => {
      if (sortKey === '_sourceIndex') {
        return (Number(left._sourceIndex) - Number(right._sourceIndex)) * direction;
      }
      if (sortKey === 'paNo') {
        const leftNumber = Number(String(left.paNo || '').replace(/\D/g, ''));
        const rightNumber = Number(String(right.paNo || '').replace(/\D/g, ''));
        if (leftNumber !== rightNumber) return (leftNumber - rightNumber) * direction;
      }
      return textCollator.compare(String(left[sortKey] || ''), String(right[sortKey] || '')) * direction;
    });
  }

  function updateSortHeaders() {
    sortButtons.forEach((button) => {
      const active = button.dataset.paSort === sortKey;
      const heading = button.closest('th');
      button.dataset.sortDirection = active ? sortDirection : '';
      button.setAttribute('aria-pressed', String(active));
      if (heading) heading.setAttribute('aria-sort', active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.hidden = true;
      pagination.innerHTML = '';
      return;
    }
    const buttons = [];
    buttons.push(`<button class="benchmark-page-btn" type="button" data-pa-page="first" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-pa-page="prev" ${currentPage === 1 ? 'disabled' : ''}>P</button>`);
    let start = Math.max(1, currentPage - 4);
    let end = Math.min(totalPages, start + 9);
    start = Math.max(1, end - 9);
    for (let page = start; page <= end; page += 1) {
      buttons.push(`<button class="benchmark-page-btn${page === currentPage ? ' is-active' : ''}" type="button" data-pa-page="${page}">${page}</button>`);
    }
    buttons.push(`<button class="benchmark-page-btn" type="button" data-pa-page="next" ${currentPage === totalPages ? 'disabled' : ''}>N</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-pa-page="last" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`);
    pagination.hidden = false;
    pagination.innerHTML = buttons.join('');
  }

  function renderResults(page) {
    if (!filteredRows.length) {
      resultsBody.innerHTML = allRows.length
        ? '<tr><td colspan="8" style="padding:18px;text-align:center;">Tiada rekod PA yang sepadan ditemui.</td></tr>'
        : '';
      resultWrap.hidden = !allRows.length;
      renderPagination(1);
      return;
    }
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
    currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const selectedState = String(stateEl.value || '').trim().toUpperCase();
    resultsBody.innerHTML = filteredRows.slice(startIndex, startIndex + ROWS_PER_PAGE).map((row, index) => {
      const record = buildPaCartRecord(row, selectedState);
      return `<tr>
        <td>${startIndex + index + 1}</td>
        <td class="pabm-action-cell pabm-cart-action-cell"><button class="btn blue pabm-table-cart-button" type="button" data-pa-search-record="${encodeRecord(record)}" aria-label="Tambah ${escapeHtml(row.paNo || 'item PA')} ke troli" title="Tambah ke Troli"><span aria-hidden="true">&#128722;</span></button></td>
        <td><strong>${escapeHtml(row.paNo)}</strong></td>
        <td class="pabm-state-data-cell">${escapeHtml(row.negeri || '-')}</td>
        <td class="pabm-district-data-cell">${escapeHtml(row.daerah || '-')}</td>
        <td class="pabm-area-data-cell">${escapeHtml(row.mukim || '-')}</td>
        <td>${escapeHtml(row.seksyen || '-')}</td>
        <td class="pabm-action-cell pabm-preview-action-cell">${row.viewPaUrl ? `<button class="btn pabm-preview-icon-button" type="button" data-pa-view-url="${escapeHtml(row.viewPaUrl)}" data-pa-view-name="${escapeHtml(row.paNo || '')}" aria-label="Lihat ${escapeHtml(row.paNo || 'item PA')}" title="Lihat PA"><span aria-hidden="true">&#128269;</span></button>` : '-'}</td>
      </tr>`;
    }).join('');
    resultWrap.hidden = false;
    renderPagination(totalPages);
  }

  function updateStatus() {
    if (!statusEl) return;
    const query = normalize(generalEl.value);
    statusEl.textContent = query
      ? `${filteredRows.length.toLocaleString('en-MY')} daripada ${allRows.length.toLocaleString('en-MY')} rekod PA ditemui`
      : `${allRows.length.toLocaleString('en-MY')} rekod PA ditemui`;
  }

  function applyGeneralFilter() {
    const query = normalize(generalEl.value).replace(/^PA/, '');
    filteredRows = !query ? allRows.slice() : allRows.filter((record) => [
      normalize(record.paNo).replace(/^PA/, ''),
      normalize(record.negeri),
      normalize(record.daerah),
      normalize(record.mukim),
      normalize(record.seksyen)
    ].some((value) => value.includes(query)));
    sortRows(filteredRows);
    renderResults(1);
    updateStatus();
  }

  async function search(event) {
    if (event) event.preventDefault();
    if (activeSearchTask) {
      cancelActiveSearch('Carian PA dibatalkan. Masukkan nombor PA dan cari semula.');
      return;
    }
    const number = cleanNumber(inputEl.value);
    const state = String(stateEl.value || '').trim().toUpperCase();
    const stateCode = JUPEM_STATE_CODES[state] || '';
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.removeAttribute('style');
    }
    setQuickStatus('', '');
    clearResults();

    if (!state || !stateCode) {
      if (errorEl) errorEl.textContent = 'Pilih negeri yang disokong sebelum membuat carian.';
      return;
    }
    if (!number) {
      setQuickStatus('Masukkan nombor PA sebelum membuat carian.', 'unavailable');
      return;
    }
    if (number.length < 3) {
      if (errorEl) errorEl.textContent = 'Masukkan sekurang-kurangnya 3 digit nombor PA.';
      return;
    }

    const controller = new AbortController();
    const task = { controller, timeout: 0 };
    task.timeout = window.setTimeout(() => controller.abort(), 30000);
    activeSearchTask = task;
    setSearchBusy(true);
    setQuickStatus(`Sedang mencari PA ${number}. Tekan Batal Carian PA untuk berhenti.`, 'checking');
    try {
      const rows = await fetchOfficialResults(number, stateCode, controller.signal);
      if (activeSearchTask !== task) return;
      const prefixRows = rows
        .filter((row) => cleanNumber(row.paNo).startsWith(number))
        .sort((left, right) => textCollator.compare(cleanNumber(left.paNo), cleanNumber(right.paNo)));
      allRows = prefixRows
        .map((row, index) => ({ ...row, _sourceIndex: index }));
      filteredRows = sortRows(allRows.slice());
      generalEl.disabled = !allRows.length;
      renderResults(1);
      setQuickStatus(allRows.length
        ? `${allRows.length.toLocaleString('en-MY')} rekod PA ditemui`
        : 'Tiada rekod PA ditemui', allRows.length ? 'success' : 'unavailable');
    } catch (error) {
      if (activeSearchTask !== task) return;
      setQuickStatus(error && error.name === 'AbortError'
        ? 'Carian PA dibatalkan selepas 30 saat. Masukkan nombor PA dan cuba lagi.'
        : 'Carian PA tidak tersedia buat sementara waktu. Sila cuba lagi.', 'unavailable');
    } finally {
      window.clearTimeout(task.timeout);
      if (activeSearchTask === task) {
        activeSearchTask = null;
        setSearchBusy(false);
      }
    }
  }

  async function quickAdd() {
    const number = cleanNumber(inputEl.value);
    const state = String(stateEl.value || '').trim().toUpperCase();
    const stateCode = JUPEM_STATE_CODES[state] || '';
    if (errorEl) errorEl.textContent = '';
    setQuickStatus('', '');
    if (!state || !stateCode) {
      setQuickStatus('Pilih negeri yang disokong sebelum menambah terus ke troli.', 'unavailable');
      return;
    }
    if (number.length < 3) {
      setQuickStatus('Masukkan nombor PA yang lengkap sebelum menambah terus ke troli.', 'unavailable');
      return;
    }
    if (typeof window.azobssRecordPurchase !== 'function') {
      setQuickStatus('Cart is not ready. Refresh the page and try again.', 'unavailable');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    const oldText = quickAddButton?.querySelector('span')?.textContent || 'Tambah Terus ke Troli';
    try {
      if (quickAddButton) {
        quickAddButton.disabled = true;
        const label = quickAddButton.querySelector('span');
        if (label) label.textContent = 'Checking PA...';
      }
      setQuickStatus(`Sedang menyemak ketersediaan PA${number}. Sila tunggu...`, 'checking');
      const rows = await fetchOfficialResults(number, stateCode, controller.signal);
      const wanted = normalize(`PA${number}`);
      const exact = rows.find((row) => normalize(row.paNo) === wanted);
      if (!exact) {
        const unavailable = new Error(`PA${number} tidak tersedia di ${state}.`);
        unavailable.isUnavailable = true;
        throw unavailable;
      }
      const payload = buildPaCartRecord(exact, state);
      const saved = await window.azobssRecordPurchase(payload);
      setQuickStatus(saved && saved.__azobssAlreadyInCart
        ? `PA${payload.itemCode} sudah ada dalam troli anda.`
        : `Berjaya: PA${payload.itemCode} telah ditambah ke troli anda.`, 'success');
    } catch (error) {
      const message = error?.isUnavailable
        ? error.message
        : (error && error.name === 'AbortError'
          ? 'PA availability check timed out. Please try again.'
          : 'Unable to check PA availability right now. Please try again.');
      setQuickStatus(message, 'unavailable');
    } finally {
      window.clearTimeout(timeout);
      if (quickAddButton) {
        quickAddButton.disabled = false;
        const label = quickAddButton.querySelector('span');
        if (label) label.textContent = oldText;
      }
    }
  }

  form.addEventListener('submit', search);
  setSearchBusy(false);
  quickAddButton?.addEventListener('click', quickAdd);
  generalEl.addEventListener('input', applyGeneralFilter);
  generalEl.addEventListener('change', applyGeneralFilter);
  generalEl.addEventListener('search', applyGeneralFilter);
  generalEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyGeneralFilter();
    }
  });
  stateEl.addEventListener('change', () => {
    const wasActive = cancelActiveSearch();
    clearResults();
    if (errorEl) errorEl.textContent = '';
    setQuickStatus(wasActive ? 'Carian PA dibatalkan kerana negeri telah berubah.' : '', wasActive ? 'unavailable' : '');
  });
  inputEl.addEventListener('input', () => {
    const wasActive = cancelActiveSearch();
    clearResults();
    if (errorEl) errorEl.textContent = '';
    if (wasActive) {
      setQuickStatus(cleanNumber(inputEl.value)
        ? 'Carian PA dibatalkan kerana nombor PA telah berubah.'
        : 'Masukkan nombor PA sebelum membuat carian.', 'unavailable');
    } else {
      setQuickStatus('', '');
    }
  });

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextKey = button.dataset.paSort;
      if (!nextKey) return;
      if (sortKey === nextKey) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      else {
        sortKey = nextKey;
        sortDirection = 'asc';
      }
      sortRows(filteredRows);
      updateSortHeaders();
      renderResults(1);
    });
  });

  updateSortHeaders();

  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pa-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
    const target = button.dataset.paPage;
    if (target === 'first') currentPage = 1;
    else if (target === 'prev') currentPage -= 1;
    else if (target === 'next') currentPage += 1;
    else if (target === 'last') currentPage = totalPages;
    else currentPage = Number(target) || currentPage;
    renderResults(currentPage);
    resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  resultsBody.addEventListener('click', async (event) => {
    const previewButton = event.target.closest('[data-pa-view-url]');
    if (previewButton) {
      openPaPreview(previewButton);
      return;
    }
    const button = event.target.closest('[data-pa-search-record]');
    if (!button) return;
    if (errorEl) errorEl.textContent = '';
    try {
      button.disabled = true;
      if (typeof window.azobssRecordPurchase !== 'function') {
        throw new Error('Cart is not ready. Refresh the page and try again.');
      }
      const payload = JSON.parse(decodeURIComponent(button.dataset.paSearchRecord || ''));
      const saved = await window.azobssRecordPurchase(payload);
      if (statusEl) {
        statusEl.textContent = saved && saved.__azobssAlreadyInCart
          ? `PA${payload.itemCode} sudah ada dalam troli anda.`
          : `PA${payload.itemCode} ditambah ke troli anda.`;
      }
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'PA ini tidak dapat ditambah ke troli anda.';
    } finally {
      button.disabled = false;
    }
  });
})();
