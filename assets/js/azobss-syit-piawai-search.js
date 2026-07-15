(function () {
  'use strict';

  const ROWS_PER_PAGE = 5;
  const DATA_URL = '/lembar-piawai-records.json';
  const stateEl = document.getElementById('syitPiawaiState');
  const inputEl = document.getElementById('syitPiawaiReference');
  const generalEl = document.getElementById('syitPiawaiGeneralSearch');
  const searchButton = document.getElementById('syitPiawaiSearchButton');
  const quickAddButton = document.getElementById('syitPiawaiQuickAddButton');
  const errorEl = document.getElementById('syitPiawaiError');
  const statusEl = document.getElementById('syitPiawaiStatus');
  const resultWrap = document.getElementById('syitPiawaiResultWrap');
  const resultsBody = document.getElementById('syitPiawaiResultsBody');
  const pagination = document.getElementById('syitPiawaiPagination');
  if (!stateEl || !inputEl || !generalEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

  let recordsCache = null;
  let allRows = [];
  let matchingRows = [];
  let currentPage = 1;
  const syitSorter = window.azobssTableSort && window.azobssTableSort.create({
    root: resultWrap,
    attribute: 'data-syit-sort',
    onChange: () => {
      matchingRows = syitSorter.sort(matchingRows);
      renderResults(1);
    }
  });

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function encodeRecord(record) {
    const sheetName = String(record.sheetName || '').trim().toUpperCase();
    const productId = String(record.productId || '').trim();
    const negeri = String(record.negeri || stateEl.value || '').trim().toUpperCase();
    const downloadUrl = 'https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunLembarPiawai/' +
      encodeURIComponent(productId) + '?piawai=' + encodeURIComponent(sheetName + '_20200904') + '&negeri=' + encodeURIComponent(negeri);
    return encodeURIComponent(JSON.stringify({
      productType: 'SYIT_PIAWAI',
      itemCode: sheetName,
      productId,
      negeri,
      amount: 7,
      downloadUrl,
      filename: sheetName + '.pdf',
      azobssCartValidated: true,
      azobssCartValidatedBy: 'official-lembar-piawai-index'
    }));
  }

  function setQuickStatus(message, state) {
    if (!statusEl) return;
    statusEl.style.removeProperty('display');
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-checking', 'is-success', 'is-unavailable');
    if (state) statusEl.classList.add(`is-${state}`);
  }

  function ensureSheetModal() {
    let modal = document.getElementById('syitPiawaiViewModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'syitPiawaiViewModal';
    modal.className = 'syit-sheet-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <button class="syit-sheet-modal-backdrop" type="button" aria-label="Close sheet preview"></button>
      <div class="syit-sheet-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="syitSheetModalTitle">
        <div class="syit-sheet-modal-head">
          <strong id="syitSheetModalTitle">View Sheet</strong>
          <button class="syit-sheet-modal-close" type="button" aria-label="Close sheet preview">&times;</button>
        </div>
        <div class="syit-sheet-modal-body">
          <span class="syit-sheet-modal-loading">Loading sheet...</span>
          <img alt="" hidden>
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
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
    return modal;
  }

  function openSheetPreview(button) {
    const productId = String(button.dataset.syitView || '').trim();
    const stateCode = String(button.dataset.syitStateCode || '').trim();
    const sheetName = String(button.dataset.syitSheetName || '').trim();
    if (!productId || !stateCode) return;
    const modal = ensureSheetModal();
    const title = modal.querySelector('#syitSheetModalTitle');
    const loading = modal.querySelector('.syit-sheet-modal-loading');
    const image = modal.querySelector('img');
    title.textContent = sheetName || 'View Sheet';
    loading.hidden = false;
    loading.textContent = 'Loading sheet...';
    image.hidden = true;
    image.alt = `${sheetName || 'Syit Piawai'} sheet preview`;
    image.onload = () => {
      loading.hidden = true;
      image.hidden = false;
    };
    image.onerror = () => {
      image.hidden = true;
      loading.hidden = false;
      loading.textContent = 'Unable to load this sheet preview.';
    };
    image.src = 'https://ebiz.jupem.gov.my/Produk/RenderImageSyit/' + encodeURIComponent(productId) + '?negeri=' + encodeURIComponent(stateCode);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pabm-modal-open');
    modal.querySelector('.syit-sheet-modal-close').focus();
  }

  async function loadRecords() {
    if (recordsCache) return recordsCache;
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Syit Piawai database is unavailable.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Syit Piawai database format is invalid.');
    recordsCache = data;
    return recordsCache;
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      pagination.hidden = true;
      pagination.innerHTML = '';
      return;
    }
    pagination.hidden = false;
    const buttons = [];
    buttons.push(`<button class="benchmark-page-btn" type="button" data-syit-page="first" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-syit-page="prev" ${currentPage === 1 ? 'disabled' : ''}>P</button>`);
    let start = Math.max(1, currentPage - 4);
    let end = Math.min(totalPages, start + 9);
    start = Math.max(1, end - 9);
    for (let page = start; page <= end; page += 1) {
      buttons.push(`<button class="benchmark-page-btn${page === currentPage ? ' is-active' : ''}" type="button" data-syit-page="${page}">${page}</button>`);
    }
    buttons.push(`<button class="benchmark-page-btn" type="button" data-syit-page="next" ${currentPage === totalPages ? 'disabled' : ''}>N</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-syit-page="last" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`);
    pagination.innerHTML = buttons.join('');
  }

  function renderResults(page) {
    if (syitSorter) matchingRows = syitSorter.sort(matchingRows);
    const totalPages = Math.max(1, Math.ceil(matchingRows.length / ROWS_PER_PAGE));
    currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
    if (!matchingRows.length) {
      resultWrap.hidden = true;
      resultsBody.innerHTML = '';
      renderPagination(1);
      return;
    }

    resultWrap.hidden = false;
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    resultsBody.innerHTML = matchingRows.slice(startIndex, startIndex + ROWS_PER_PAGE).map((record, index) => {
      const mapLink = record.mapUrl
        ? `<a class="btn pabm-location-text-button pabm-location-icon-button" href="${escapeHtml(record.mapUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View ${escapeHtml(record.sheetName || 'sheet')} map in JUPEM eBiz" title="JUPEM eBiz"><span aria-hidden="true">&#128269;</span></a>`
        : '-';
      return `<tr>
        <td>${startIndex + index + 1}</td>
        <td class="pabm-action-cell pabm-cart-action-cell"><button class="btn blue pabm-table-cart-button" type="button" data-syit-record="${encodeRecord(record)}" aria-label="Add ${escapeHtml(record.sheetName || 'sheet')} to cart" title="Add to Cart"><span aria-hidden="true">&#128722;</span></button></td>
        <td><strong>${escapeHtml(record.sheetName || '-')}</strong></td>
        <td>${escapeHtml(record.negeri || '-')}</td>
        <td class="pabm-action-cell pabm-preview-action-cell"><button class="btn pabm-preview-icon-button" type="button" data-syit-view="${escapeHtml(record.productId)}" data-syit-state-code="${escapeHtml(record.stateCode)}" data-syit-sheet-name="${escapeHtml(record.sheetName)}" aria-label="View ${escapeHtml(record.sheetName || 'sheet')}" title="View Sheet"><span aria-hidden="true">&#128269;</span></button></td>
        <td class="pabm-action-cell pabm-location-text-cell">${mapLink}</td>
      </tr>`;
    }).join('');
    renderPagination(totalPages);
  }

  function clearResults() {
    allRows = [];
    matchingRows = [];
    currentPage = 1;
    generalEl.value = '';
    generalEl.disabled = true;
    renderResults(1);
  }

  function updateStatus() {
    if (!statusEl) return;
    const query = normalize(generalEl.value);
    statusEl.textContent = query
      ? `${matchingRows.length.toLocaleString('en-MY')} of ${allRows.length.toLocaleString('en-MY')} Syit Piawai records found`
      : `${allRows.length.toLocaleString('en-MY')} Syit Piawai records found`;
  }

  function applyGeneralFilter() {
    const query = normalize(generalEl.value);
    matchingRows = !query ? allRows.slice() : allRows.filter((record) => [
      normalize(record.sheetName),
      normalize(record.negeri),
      normalize(record.productId),
      normalize(record.stateCode)
    ].some((value) => value.includes(query)));
    renderResults(1);
    updateStatus();
  }

  async function addSheetRecord(record, direct) {
    if (typeof window.azobssRecordPurchase !== 'function') throw new Error('Cart is not ready. Refresh the page and try again.');
    const payload = record?.productType === 'SYIT_PIAWAI'
      ? record
      : JSON.parse(decodeURIComponent(encodeRecord(record)));
    const saved = await window.azobssRecordPurchase(payload);
    setQuickStatus(saved && saved.__azobssAlreadyInCart
      ? 'This Syit Piawai is already in your cart.'
      : (direct
        ? `Success: ${payload.itemCode} has been added to your cart.`
        : `${payload.itemCode} added to your cart.`), 'success');
    return saved;
  }

  async function search() {
    const selectedState = String(stateEl.value || '').trim().toUpperCase();
    const query = normalize(inputEl.value);
    if (errorEl) errorEl.textContent = '';
    setQuickStatus('', '');
    if (!selectedState) {
      if (errorEl) errorEl.textContent = 'Select a state before searching.';
      return;
    }

    searchButton.disabled = true;
    if (statusEl) statusEl.textContent = 'Searching Syit Piawai database...';
    try {
      const records = await loadRecords();
      allRows = records.filter((record) => {
        if (String(record.negeri || '').trim().toUpperCase() !== selectedState) return false;
        if (!query) return true;
        return normalize(record.sheetName).includes(query) || normalize(record.productId).includes(query);
      }).map((record, index) => ({ ...record, _sourceIndex: index, harga: 7 }));
      matchingRows = allRows.slice();
      generalEl.disabled = !allRows.length;
      renderResults(1);
      if (statusEl) {
        statusEl.textContent = allRows.length
          ? `${allRows.length.toLocaleString('en-MY')} Syit Piawai records found`
          : 'No Syit Piawai record found';
      }
    } catch (error) {
      clearResults();
      if (errorEl) errorEl.textContent = error.message || 'Syit Piawai search failed.';
      if (statusEl) statusEl.textContent = '';
    } finally {
      searchButton.disabled = false;
    }
  }

  async function quickAdd() {
    const selectedState = String(stateEl.value || '').trim().toUpperCase();
    const query = normalize(inputEl.value);
    if (errorEl) errorEl.textContent = '';
    setQuickStatus('', '');
    if (!selectedState) {
      setQuickStatus('Select a state before using Quick Add.', 'unavailable');
      return;
    }
    if (!query) {
      setQuickStatus('Enter a sheet name or product ID before using Quick Add.', 'unavailable');
      return;
    }
    const label = quickAddButton?.querySelector('span');
    const oldText = label?.textContent || 'Quick Add to Cart';
    try {
      if (quickAddButton) quickAddButton.disabled = true;
      if (label) label.textContent = 'Checking Sheet...';
      const requestedCode = String(inputEl.value || '').trim().toUpperCase();
      setQuickStatus(`Checking ${requestedCode} availability. Please wait...`, 'checking');
      const records = await loadRecords();
      const exact = records.find((record) =>
        String(record.negeri || '').trim().toUpperCase() === selectedState
        && (normalize(record.sheetName) === query || normalize(record.productId) === query)
      );
      if (!exact) {
        const unavailable = new Error(`${requestedCode} is not available in ${selectedState}.`);
        unavailable.isUnavailable = true;
        throw unavailable;
      }
      await addSheetRecord(exact, true);
    } catch (error) {
      setQuickStatus(error?.isUnavailable
        ? error.message
        : 'Unable to check sheet availability right now. Please try again.', 'unavailable');
    } finally {
      if (quickAddButton) quickAddButton.disabled = false;
      if (label) label.textContent = oldText;
    }
  }

  searchButton.addEventListener('click', search);
  quickAddButton?.addEventListener('click', quickAdd);
  generalEl.addEventListener('input', applyGeneralFilter);
  generalEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
  inputEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    search();
  });
  stateEl.addEventListener('change', () => {
    clearResults();
    if (errorEl) errorEl.textContent = '';
    if (statusEl) statusEl.textContent = '';
  });
  inputEl.addEventListener('input', () => {
    clearResults();
    if (errorEl) errorEl.textContent = '';
    if (statusEl) statusEl.textContent = '';
  });

  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('[data-syit-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.max(1, Math.ceil(matchingRows.length / ROWS_PER_PAGE));
    const target = button.dataset.syitPage;
    if (target === 'first') currentPage = 1;
    else if (target === 'prev') currentPage -= 1;
    else if (target === 'next') currentPage += 1;
    else if (target === 'last') currentPage = totalPages;
    else currentPage = Number(target) || currentPage;
    renderResults(currentPage);
    resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  resultsBody.addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-syit-view]');
    if (viewButton) {
      openSheetPreview(viewButton);
      return;
    }
    const button = event.target.closest('[data-syit-record]');
    if (!button) return;
    if (errorEl) errorEl.textContent = '';
    try {
      button.disabled = true;
      const payload = JSON.parse(decodeURIComponent(button.dataset.syitRecord || ''));
      await addSheetRecord(payload, false);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to add this Syit Piawai to your cart.';
    } finally {
      button.disabled = false;
    }
  });
})();
