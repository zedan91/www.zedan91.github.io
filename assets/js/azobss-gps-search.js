(function () {
  'use strict';

  const ROWS_PER_PAGE = 5;
  const DATA_URL = '/stesen-gps-records.json';
  const stateEl = document.getElementById('gpsState');
  const inputEl = document.getElementById('gpsStation');
  const generalEl = document.getElementById('gpsGeneralSearch');
  const searchButton = document.getElementById('gpsSearchButton');
  const quickAddButton = document.getElementById('gpsQuickAddButton');
  const errorEl = document.getElementById('gpsSearchError');
  const statusEl = document.getElementById('gpsSearchStatus');
  const resultWrap = document.getElementById('gpsResultWrap');
  const resultsBody = document.getElementById('gpsResultsBody');
  const pagination = document.getElementById('gpsPagination');
  if (!stateEl || !inputEl || !generalEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

  let recordsCache = null;
  let allRows = [];
  let matchingRows = [];
  let currentPage = 1;
  const gpsSorter = window.azobssTableSort && window.azobssTableSort.create({
    root: resultWrap,
    attribute: 'data-gps-sort',
    onChange: () => {
      matchingRows = gpsSorter.sort(matchingRows);
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
    const stationNo = String(record.stationNo || '').trim().toUpperCase();
    return encodeURIComponent(JSON.stringify({
      productType: 'GPS',
      itemCode: stationNo,
      stationNo,
      productId: String(record.productId || '').trim(),
      negeri: String(record.negeri || stateEl.value || '').trim().toUpperCase(),
      amount: 9,
      downloadUrl: String(record.downloadUrl || '').trim(),
      filename: stationNo + '.pdf',
      azobssCartValidated: true,
      azobssCartValidatedBy: 'official-stesen-gps-index'
    }));
  }

  async function loadRecords() {
    if (recordsCache) return recordsCache;
    const response = await fetch(DATA_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('GPS station database is unavailable.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('GPS station database format is invalid.');
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
    buttons.push(`<button class="benchmark-page-btn" type="button" data-gps-page="first" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-gps-page="prev" ${currentPage === 1 ? 'disabled' : ''}>P</button>`);
    let start = Math.max(1, currentPage - 4);
    let end = Math.min(totalPages, start + 9);
    start = Math.max(1, end - 9);
    for (let page = start; page <= end; page += 1) {
      buttons.push(`<button class="benchmark-page-btn${page === currentPage ? ' is-active' : ''}" type="button" data-gps-page="${page}">${page}</button>`);
    }
    buttons.push(`<button class="benchmark-page-btn" type="button" data-gps-page="next" ${currentPage === totalPages ? 'disabled' : ''}>N</button>`);
    buttons.push(`<button class="benchmark-page-btn" type="button" data-gps-page="last" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`);
    pagination.innerHTML = buttons.join('');
  }

  function renderResults(page) {
    if (gpsSorter) matchingRows = gpsSorter.sort(matchingRows);
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
        ? `<a class="btn blue" href="${escapeHtml(record.mapUrl)}" target="_blank" rel="noopener noreferrer" style="padding:6px 10px;font-size:12px;margin:0;display:inline-block;white-space:nowrap;text-decoration:none;border-radius:8px;">View Location</a>`
        : '-';
      return `<tr>
        <td>${startIndex + index + 1}</td>
        <td class="pabm-action-cell"><button class="btn blue" type="button" data-gps-record="${encodeRecord(record)}" style="padding:6px 12px;font-size:12px;margin:0;border-radius:8px;white-space:nowrap;">Add to Cart</button></td>
        <td><strong>${escapeHtml(record.stationNo || '-')}</strong></td>
        <td>${escapeHtml(record.negeri || '-')}</td>
        <td>${escapeHtml(record.daerah || '-')}</td>
        <td>${escapeHtml(record.tempat || '-')}</td>
        <td>${mapLink}</td>
        <td>RM9</td>
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
      ? `${matchingRows.length.toLocaleString('en-MY')} of ${allRows.length.toLocaleString('en-MY')} GPS station records found`
      : `${allRows.length.toLocaleString('en-MY')} GPS station records found`;
  }

  function applyGeneralFilter() {
    const query = normalize(generalEl.value);
    matchingRows = !query ? allRows.slice() : allRows.filter((record) => [
      record.stationNo, record.negeri, record.daerah, record.tempat, record.productId
    ].some((value) => normalize(value).includes(query)));
    renderResults(1);
    updateStatus();
  }

  async function addGpsRecord(record, direct) {
    if (typeof window.azobssRecordPurchase !== 'function') throw new Error('Cart is not ready. Refresh the page and try again.');
    const payload = JSON.parse(decodeURIComponent(encodeRecord(record)));
    const saved = await window.azobssRecordPurchase(payload);
    if (statusEl) {
      statusEl.textContent = saved && saved.__azobssAlreadyInCart
        ? 'This GPS station is already in your cart.'
        : `${payload.itemCode} added ${direct ? 'directly ' : ''}to your cart.`;
    }
    return saved;
  }

  async function search() {
    const selectedState = String(stateEl.value || '').trim().toUpperCase();
    const query = normalize(inputEl.value);
    if (errorEl) errorEl.textContent = '';
    if (!selectedState) {
      if (errorEl) errorEl.textContent = 'Select a state before searching.';
      return;
    }

    searchButton.disabled = true;
    if (statusEl) statusEl.textContent = 'Searching GPS station database...';
    try {
      const records = await loadRecords();
      allRows = records.filter((record) => {
        if (String(record.negeri || '').trim().toUpperCase() !== selectedState) return false;
        if (!query) return true;
        return [record.stationNo, record.daerah, record.tempat]
          .some((value) => normalize(value).includes(query));
      }).map((record, index) => ({ ...record, _sourceIndex: index, harga: 9 }));
      matchingRows = allRows.slice();
      generalEl.disabled = !allRows.length;
      renderResults(1);
      if (statusEl) {
        statusEl.textContent = allRows.length
          ? `${allRows.length.toLocaleString('en-MY')} GPS station records found`
          : 'No GPS station record found';
      }
    } catch (error) {
      clearResults();
      if (errorEl) errorEl.textContent = error.message || 'GPS station search failed.';
      if (statusEl) statusEl.textContent = '';
    } finally {
      searchButton.disabled = false;
    }
  }

  async function quickAdd() {
    const selectedState = String(stateEl.value || '').trim().toUpperCase();
    const query = normalize(inputEl.value);
    if (errorEl) errorEl.textContent = '';
    if (statusEl) statusEl.textContent = '';
    if (!selectedState) {
      if (errorEl) errorEl.textContent = 'Select a state before using Quick Add.';
      return;
    }
    if (!query) {
      if (errorEl) errorEl.textContent = 'Enter a GPS station code before using Quick Add.';
      return;
    }
    const label = quickAddButton?.querySelector('span');
    const oldText = label?.textContent || 'Quick Add to Cart';
    try {
      if (quickAddButton) quickAddButton.disabled = true;
      if (label) label.textContent = 'Checking GPS...';
      if (statusEl) statusEl.textContent = `Checking GPS ${String(inputEl.value || '').trim().toUpperCase()}...`;
      const records = await loadRecords();
      const exact = records.find((record) =>
        String(record.negeri || '').trim().toUpperCase() === selectedState
        && (normalize(record.stationNo) === query || normalize(record.productId) === query)
      );
      if (!exact) throw new Error(`GPS station ${String(inputEl.value || '').trim().toUpperCase()} was not found in ${selectedState}.`);
      await addGpsRecord(exact, true);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to add this GPS station directly to cart.';
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
    const button = event.target.closest('[data-gps-page]');
    if (!button || button.disabled) return;
    const totalPages = Math.max(1, Math.ceil(matchingRows.length / ROWS_PER_PAGE));
    const target = button.dataset.gpsPage;
    if (target === 'first') currentPage = 1;
    else if (target === 'prev') currentPage -= 1;
    else if (target === 'next') currentPage += 1;
    else if (target === 'last') currentPage = totalPages;
    else currentPage = Number(target) || currentPage;
    renderResults(currentPage);
    resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  resultsBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-gps-record]');
    if (!button) return;
    if (errorEl) errorEl.textContent = '';
    try {
      button.disabled = true;
      const payload = JSON.parse(decodeURIComponent(button.dataset.gpsRecord || ''));
      await addGpsRecord(payload, false);
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to add this GPS station to your cart.';
    } finally {
      button.disabled = false;
    }
  });
})();
