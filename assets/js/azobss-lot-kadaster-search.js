(function () {
  'use strict';

  const API_URL = 'https://azobss-backend.onrender.com/api/search-lot-kadaster';
  const ROWS_PER_PAGE = 5;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function normalize(value) {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
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
        <td>${actionLink(record.viewPaUrl, 'View PA')}</td>
        <td>${actionLink(record.mapUrl, 'View Map')}</td>
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
      if (statusEl) {
        statusEl.textContent = query
          ? `${filteredRows.length.toLocaleString('en-MY')} of ${allRows.length.toLocaleString('en-MY')} lot records found`
          : `${allRows.length.toLocaleString('en-MY')} lot records found`;
      }
    }

    async function search() {
      const state = String(stateEl.value || '').trim().toUpperCase();
      const lotNo = String(lotEl.value || '').trim();
      if (errorEl) errorEl.textContent = '';
      if (statusEl) statusEl.textContent = '';
      clearResults();
      if (!state) {
        if (errorEl) errorEl.textContent = 'Select a state before searching.';
        return;
      }
      if (!lotNo) {
        if (errorEl) errorEl.textContent = 'Enter a lot number before searching.';
        return;
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90000);
      const params = new URLSearchParams({ produk: productCode, negeri: state, lot: lotNo });
      searchButton.disabled = true;
      if (statusEl) statusEl.textContent = `Searching lot ${lotNo}...`;
      try {
        const response = await fetch(`${API_URL}?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Lot search failed.');
        allRows = Array.isArray(data.results) ? data.results : [];
        filteredRows = allRows.slice();
        generalEl.disabled = !allRows.length;
        renderResults(1);
        if (statusEl) statusEl.textContent = allRows.length
          ? `${allRows.length.toLocaleString('en-MY')} lot records found`
          : 'No lot record found';
      } catch (error) {
        if (errorEl) {
          errorEl.textContent = error && error.name === 'AbortError'
            ? 'Lot search took too long. Please try again.'
            : (error.message || 'Lot search is temporarily unavailable.');
        }
        if (statusEl) statusEl.textContent = '';
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
      if (statusEl) statusEl.textContent = '';
    });
    stateEl.addEventListener('change', () => {
      clearResults();
      if (errorEl) errorEl.textContent = '';
      if (statusEl) statusEl.textContent = '';
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
