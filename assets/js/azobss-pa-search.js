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
  if (!form || !stateEl || !inputEl || !generalEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

  let allRows = [];
  let filteredRows = [];
  let currentPage = 1;
  let sortKey = '_sourceIndex';
  let sortDirection = 'asc';
  let activeSearchTask = null;
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

  function setSearchBusy(isBusy) {
    searchButton.disabled = false;
    searchButton.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    const label = searchButton.querySelector('span');
    if (label) label.textContent = isBusy ? 'Cancel PA Search' : 'Search PA';
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
        ? '<tr><td colspan="8" style="padding:18px;text-align:center;">No matching PA record found.</td></tr>'
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
        <td class="pabm-action-cell pabm-cart-action-cell"><button class="btn blue pabm-table-cart-button" type="button" data-pa-search-record="${encodeRecord(record)}" aria-label="Add ${escapeHtml(row.paNo || 'PA item')} to cart" title="Add to Cart"><span aria-hidden="true">&#128722;</span></button></td>
        <td><strong>${escapeHtml(row.paNo)}</strong></td>
        <td>${escapeHtml(row.negeri || '-')}</td>
        <td>${escapeHtml(row.daerah || '-')}</td>
        <td>${escapeHtml(row.mukim || '-')}</td>
        <td>${escapeHtml(row.seksyen || '-')}</td>
        <td>${row.viewPaUrl ? `<a class="btn blue" href="${escapeHtml(row.viewPaUrl)}" target="_blank" rel="noopener noreferrer" style="padding:6px 10px;font-size:12px;margin:0;display:inline-block;text-decoration:none;border-radius:8px;white-space:nowrap;">View PA</a>` : '-'}</td>
      </tr>`;
    }).join('');
    resultWrap.hidden = false;
    renderPagination(totalPages);
  }

  function updateStatus() {
    if (!statusEl) return;
    const query = normalize(generalEl.value);
    statusEl.textContent = query
      ? `${filteredRows.length.toLocaleString('en-MY')} of ${allRows.length.toLocaleString('en-MY')} PA records found`
      : `${allRows.length.toLocaleString('en-MY')} PA records found`;
  }

  function applyGeneralFilter() {
    const query = normalize(generalEl.value).replace(/^PA/, '');
    filteredRows = !query ? allRows.slice() : allRows.filter((record) =>
      normalize(record.paNo).replace(/^PA/, '').startsWith(query));
    sortRows(filteredRows);
    renderResults(1);
    updateStatus();
  }

  async function search(event) {
    if (event) event.preventDefault();
    if (activeSearchTask) {
      cancelActiveSearch('PA search cancelled. Enter a PA number and search again.');
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
      if (errorEl) errorEl.textContent = 'Select a supported state before searching.';
      return;
    }
    if (!number) {
      setQuickStatus('Enter a PA number before searching.', 'unavailable');
      return;
    }
    if (number.length < 3) {
      if (errorEl) errorEl.textContent = 'Enter at least 3 digits of a PA number.';
      return;
    }

    const controller = new AbortController();
    const task = { controller, timeout: 0 };
    task.timeout = window.setTimeout(() => controller.abort(), 30000);
    activeSearchTask = task;
    setSearchBusy(true);
    setQuickStatus(`Searching for PA ${number}. Click Cancel PA Search to stop.`, 'checking');
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
        ? `${allRows.length.toLocaleString('en-MY')} PA records found`
        : 'No PA record found', allRows.length ? 'success' : 'unavailable');
    } catch (error) {
      if (activeSearchTask !== task) return;
      setQuickStatus(error && error.name === 'AbortError'
        ? 'PA search was cancelled after 30 seconds. Enter a PA number and try again.'
        : 'PA search is temporarily unavailable. Please try again.', 'unavailable');
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
      setQuickStatus('Select a supported state before using Quick Add.', 'unavailable');
      return;
    }
    if (number.length < 3) {
      setQuickStatus('Enter a complete PA number before using Quick Add.', 'unavailable');
      return;
    }
    if (typeof window.azobssRecordPurchase !== 'function') {
      setQuickStatus('Cart is not ready. Refresh the page and try again.', 'unavailable');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    const oldText = quickAddButton?.querySelector('span')?.textContent || 'Quick Add to Cart';
    try {
      if (quickAddButton) {
        quickAddButton.disabled = true;
        const label = quickAddButton.querySelector('span');
        if (label) label.textContent = 'Checking PA...';
      }
      setQuickStatus(`Checking PA${number} availability. Please wait...`, 'checking');
      const rows = await fetchOfficialResults(number, stateCode, controller.signal);
      const wanted = normalize(`PA${number}`);
      const exact = rows.find((row) => normalize(row.paNo) === wanted);
      if (!exact) {
        const unavailable = new Error(`PA${number} is not available in ${state}.`);
        unavailable.isUnavailable = true;
        throw unavailable;
      }
      const payload = buildPaCartRecord(exact, state);
      const saved = await window.azobssRecordPurchase(payload);
      setQuickStatus(saved && saved.__azobssAlreadyInCart
        ? `PA${payload.itemCode} is already in your cart.`
        : `Success: PA${payload.itemCode} has been added to your cart.`, 'success');
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
    setQuickStatus(wasActive ? 'PA search cancelled because the state changed.' : '', wasActive ? 'unavailable' : '');
  });
  inputEl.addEventListener('input', () => {
    const wasActive = cancelActiveSearch();
    clearResults();
    if (errorEl) errorEl.textContent = '';
    if (wasActive) {
      setQuickStatus(cleanNumber(inputEl.value)
        ? 'PA search cancelled because the PA number changed.'
        : 'Enter a PA number before searching.', 'unavailable');
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
          ? `PA${payload.itemCode} is already in your cart.`
          : `PA${payload.itemCode} added to your cart.`;
      }
    } catch (error) {
      if (errorEl) errorEl.textContent = error.message || 'Unable to add this PA to your cart.';
    } finally {
      button.disabled = false;
    }
  });
})();
