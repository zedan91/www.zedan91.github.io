(function () {
  'use strict';

  const JUPEM_SEARCH_URL = 'https://ebiz.jupem.gov.my/Produk/LotKadasterBerdigit';
  const FALLBACK_API_URL = 'https://azobss-backend.onrender.com/api/search-lot-kadaster';
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

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
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

  function parseOfficialResults(html, productCode, stateCode) {
    const documentResult = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const table = documentResult.querySelector('table#example');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 9) return null;
      const viewPaTrigger = row.querySelector('[onclick*="PelanAkuiDetail"]');
      const viewPaMatch = String(viewPaTrigger?.getAttribute('onclick') || '').match(/createModal\(\s*['"]([^'"]+)['"]/i);
      const mapLink = row.querySelector('a[href*="/PetaInteraktif"]');
      return {
        lotNo: cells[1]?.textContent.trim() || '',
        paNo: cells[2]?.textContent.trim().toUpperCase() || '',
        negeri: cells[3]?.textContent.trim() || '',
        daerah: cells[4]?.textContent.trim() || '',
        mukim: cells[5]?.textContent.trim() || '',
        seksyen: cells[6]?.textContent.trim() || '',
        productCode,
        stateCode,
        viewPaUrl: absoluteJupemUrl(viewPaMatch?.[1]),
        mapUrl: absoluteJupemUrl(mapLink?.getAttribute('href'))
      };
    }).filter((record) => record && record.lotNo && record.paNo);
  }

  async function fetchOfficialResults(productCode, stateCode, lotNo, signal) {
    const params = new URLSearchParams({
      produk: productCode,
      negeri: stateCode,
      searchString: lotNo
    });
    const response = await fetch(`${JUPEM_SEARCH_URL}?${params.toString()}`, {
      cache: 'no-store',
      mode: 'cors',
      signal
    });
    if (!response.ok) throw new Error(`JUPEM returned HTTP ${response.status}.`);
    return parseOfficialResults(await response.text(), productCode, stateCode);
  }

  async function fetchFallbackResults(productCode, state, lotNo, signal) {
    const params = new URLSearchParams({ produk: productCode, negeri: state, lot: lotNo });
    const response = await fetch(`${FALLBACK_API_URL}?${params.toString()}`, {
      cache: 'no-store',
      signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Lot search failed.');
    return Array.isArray(data.results) ? data.results : [];
  }

  function setupPanel(panel) {
    const productCode = String(panel.dataset.productCode || '1') === '2' ? '2' : '1';
    const stateEl = panel.querySelector('[data-lot-state]');
    const lotEl = panel.querySelector('[data-lot-number]');
    const generalEl = panel.querySelector('[data-lot-general-search]');
    const searchButton = panel.querySelector('[data-lot-search]');
    const errorEl = panel.querySelector('[data-lot-error]');
    const statusEl = panel.querySelector('[data-lot-status]');
    const resultWrap = panel.querySelector('[data-lot-result-wrap]');
    const resultsBody = panel.querySelector('[data-lot-results]');
    const pagination = panel.querySelector('[data-lot-pagination]');
    if (!stateEl || !lotEl || !generalEl || !searchButton || !resultWrap || !resultsBody || !pagination) return;

    let allRows = [];
    let filteredRows = [];
    let currentPage = 1;

    function setLotStatus(message, state) {
      if (!statusEl) return;
      statusEl.style.removeProperty('display');
      statusEl.textContent = message || '';
      statusEl.classList.remove('is-checking', 'is-success', 'is-unavailable');
      if (state) statusEl.classList.add(`is-${state}`);
    }

    const lotSorter = window.azobssTableSort && window.azobssTableSort.create({
      root: resultWrap,
      attribute: 'data-lot-sort',
      onChange: () => {
        filteredRows = lotSorter.sort(filteredRows);
        renderResults(1);
      }
    });

    function clearResults() {
      allRows = [];
      filteredRows = [];
      currentPage = 1;
      resultsBody.innerHTML = '';
      resultWrap.hidden = true;
      pagination.hidden = true;
      pagination.innerHTML = '';
      generalEl.value = '';
      generalEl.disabled = true;
    }

    function renderPagination(totalPages) {
      if (totalPages <= 1) {
        pagination.hidden = true;
        pagination.innerHTML = '';
        return;
      }
      pagination.hidden = false;
      const buttons = [];
      buttons.push(`<button class="benchmark-page-btn" type="button" data-lot-page="first" ${currentPage === 1 ? 'disabled' : ''}>&lt;&lt;</button>`);
      buttons.push(`<button class="benchmark-page-btn" type="button" data-lot-page="prev" ${currentPage === 1 ? 'disabled' : ''}>P</button>`);
      let start = Math.max(1, currentPage - 4);
      let end = Math.min(totalPages, start + 9);
      start = Math.max(1, end - 9);
      for (let page = start; page <= end; page += 1) {
        buttons.push(`<button class="benchmark-page-btn${page === currentPage ? ' is-active' : ''}" type="button" data-lot-page="${page}">${page}</button>`);
      }
      buttons.push(`<button class="benchmark-page-btn" type="button" data-lot-page="next" ${currentPage === totalPages ? 'disabled' : ''}>N</button>`);
      buttons.push(`<button class="benchmark-page-btn" type="button" data-lot-page="last" ${currentPage === totalPages ? 'disabled' : ''}>&gt;&gt;</button>`);
      pagination.innerHTML = buttons.join('');
    }

    function actionLink(url, label) {
      if (!url) return '-';
      return `<a class="btn blue" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="padding:6px 10px;font-size:12px;margin:0;display:inline-block;text-decoration:none;border-radius:8px;white-space:nowrap;">${label}</a>`;
    }

    function renderResults(page) {
      if (lotSorter) filteredRows = lotSorter.sort(filteredRows);
      if (!filteredRows.length) {
        resultsBody.innerHTML = '';
        resultWrap.hidden = true;
        renderPagination(1);
        return;
      }
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
      currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
      const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
      resultsBody.innerHTML = filteredRows.slice(startIndex, startIndex + ROWS_PER_PAGE).map((record, index) => `<tr>
        <td>${startIndex + index + 1}</td>
        <td><strong>${escapeHtml(record.lotNo || '-')}</strong></td>
        <td>${escapeHtml(record.paNo || '-')}</td>
        <td>${escapeHtml(record.negeri || '-')}</td>
        <td>${escapeHtml(record.daerah || '-')}</td>
        <td>${escapeHtml(record.mukim || '-')}</td>
        <td>${escapeHtml(record.seksyen || '-')}</td>
        <td>${actionLink(record.viewPaUrl, 'Lihat PA')}</td>
        <td>${actionLink(record.mapUrl, 'Lihat Peta')}</td>
      </tr>`).join('');
      resultWrap.hidden = false;
      renderPagination(totalPages);
    }

    function applyGeneralFilter() {
      const query = normalize(generalEl.value);
      filteredRows = !query ? allRows.slice() : allRows.filter((record) => [
        record.lotNo, record.paNo, record.negeri, record.daerah, record.mukim, record.seksyen
      ].some((value) => normalize(value).includes(query)));
      currentPage = 1;
      renderResults(1);
      const message = query
        ? `${filteredRows.length.toLocaleString('en-MY')} daripada ${allRows.length.toLocaleString('en-MY')} rekod lot ditemui`
        : `${allRows.length.toLocaleString('en-MY')} rekod lot ditemui`;
      setLotStatus(message, filteredRows.length ? 'success' : 'unavailable');
    }

    async function search() {
      const state = String(stateEl.value || '').trim().toUpperCase();
      const stateCode = JUPEM_STATE_CODES[state] || '';
      const lotNo = String(lotEl.value || '').trim();
      if (errorEl) errorEl.textContent = '';
      setLotStatus('', '');
      clearResults();
      if (!state || !stateCode) {
        setLotStatus('Pilih negeri sebelum membuat carian.', 'unavailable');
        return;
      }
      if (!lotNo) {
        setLotStatus('Masukkan nombor lot sebelum membuat carian.', 'unavailable');
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90000);
      searchButton.disabled = true;
      setLotStatus(`Sedang mencari lot ${lotNo}. Sila tunggu...`, 'checking');
      try {
        try {
          allRows = await fetchOfficialResults(productCode, stateCode, lotNo, controller.signal);
        } catch (officialError) {
          allRows = await fetchFallbackResults(productCode, state, lotNo, controller.signal);
        }
        allRows = allRows.map((record, index) => ({ ...record, _sourceIndex: index }));
        filteredRows = allRows.slice();
        generalEl.disabled = !allRows.length;
        renderResults(1);
        setLotStatus(allRows.length
          ? `${allRows.length.toLocaleString('en-MY')} rekod lot ditemui`
          : 'Tiada rekod lot ditemui', allRows.length ? 'success' : 'unavailable');
      } catch (error) {
        setLotStatus(error && error.name === 'AbortError'
          ? 'Carian lot mengambil masa terlalu lama. Sila cuba lagi.'
          : (error.message || 'Carian lot tidak tersedia buat sementara waktu.'), 'unavailable');
      } finally {
        window.clearTimeout(timeout);
        searchButton.disabled = false;
      }
    }

    searchButton.addEventListener('click', search);
    lotEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      search();
    });
    lotEl.addEventListener('input', () => {
      clearResults();
      if (errorEl) errorEl.textContent = '';
      setLotStatus('', '');
    });
    stateEl.addEventListener('change', () => {
      clearResults();
      if (errorEl) errorEl.textContent = '';
      setLotStatus('', '');
    });
    generalEl.addEventListener('input', applyGeneralFilter);

    pagination.addEventListener('click', (event) => {
      const button = event.target.closest('[data-lot-page]');
      if (!button || button.disabled) return;
      const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
      const target = button.dataset.lotPage;
      if (target === 'first') currentPage = 1;
      else if (target === 'prev') currentPage -= 1;
      else if (target === 'next') currentPage += 1;
      else if (target === 'last') currentPage = totalPages;
      else currentPage = Number(target) || currentPage;
      renderResults(currentPage);
      resultWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  document.querySelectorAll('[data-lot-search-panel]').forEach(setupPanel);
})();
