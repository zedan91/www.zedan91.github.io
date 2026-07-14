(function () {
  'use strict';

  const ROWS_PER_PAGE = 3;
  const DATA_URL = '/lembar-piawai-records.json';
  const stateEl = document.getElementById('syitPiawaiState');
  const inputEl = document.getElementById('syitPiawaiReference');
  const searchButton = document.getElementById('syitPiawaiSearchButton');
  const errorEl = document.getElementById('syitPiawaiError');
  const statusEl = document.getElementById('syitPiawaiStatus');
  const resultWrap = document.getElementById('syitPiawaiResultWrap');
  const resultsBody = document.getElementById('syitPiawaiResultsBody');
  const pagination = document.getElementById('syitPiawaiPagination');
  if (!stateEl || !inputEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

  let recordsCache = null;
  let matchingRows = [];
  let currentPage = 1;

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
        ? `<a class="btn blue" href="${escapeHtml(record.mapUrl)}" target="_blank" rel="noopener noreferrer" style="padding:6px 10px;font-size:12px;margin:0;display:inline-block;text-decoration:none;border-radius:8px;">View Map</a>`
        : '-';
      return `<tr>
        <td>${startIndex + index + 1}</td>
        <td><button class="btn blue" type="button" data-syit-record="${encodeRecord(record)}" style="padding:6px 12px;font-size:12px;margin:0;border-radius:8px;">Add to Cart</button></td>
        <td><strong>${escapeHtml(record.sheetName || '-')}</strong></td>
        <td>${escapeHtml(record.negeri || '-')}</td>
        <td>${escapeHtml(record.productId || '-')}</td>
        <td>${mapLink}</td>
        <td>RM7</td>
      </tr>`;
    }).join('');
    renderPagination(totalPages);
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
    if (statusEl) statusEl.textContent = 'Searching Syit Piawai database...';
    try {
      const records = await loadRecords();
      matchingRows = records.filter((record) => {
        if (String(record.negeri || '').trim().toUpperCase() !== selectedState) return false;
        if (!query) return true;
        return normalize(record.sheetName).includes(query) || normalize(record.productId).includes(query);
      });
      renderResults(1);
      if (statusEl) {
        statusEl.textContent = matchingRows.length
          ? `${matchingRows.length.toLocaleString('en-MY')} Syit Piawai record found`
          : 'No Syit Piawai record found';
      }
    } catch (error) {
      matchingRows = [];
      renderResults(1);
      if (errorEl) errorEl.textContent = error.message || 'Syit Piawai search failed.';
      if (statusEl) statusEl.textContent = '';
    } finally {
      searchButton.disabled = false;
    }
  }

  searchButton.addEventListener('click', search);
  inputEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    search();
  });
  stateEl.addEventListener('change', () => {
    matchingRows = [];
    renderResults(1);
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
    const button = event.target.closest('[data-syit-record]');
    if (!button) return;
    if (errorEl) errorEl.textContent = '';
    try {
      button.disabled = true;
      if (typeof window.azobssRecordPurchase !== 'function') throw new Error('Cart is not ready. Refresh the page and try again.');
      const payload = JSON.parse(decodeURIComponent(button.dataset.syitRecord || ''));
      const saved = await window.azobssRecordPurchase(payload);
      if (statusEl) {
        statusEl.textContent = saved && saved.__azobssAlreadyInCart
          ? 'This Syit Piawai is already in your cart.'
          : `${payload.itemCode} added to your cart.`;
      }
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to add this Syit Piawai to your cart.';
    } finally {
      button.disabled = false;
    }
  });
})();
