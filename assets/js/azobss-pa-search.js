(function () {
  'use strict';

  const CHECK_API = 'https://azobss-backend.onrender.com/api/check-pa';
  const PDF_API = 'https://azobss-backend.onrender.com/api/pa-pdf';
  const form = document.getElementById('paSearchForm');
  const stateEl = document.getElementById('negeri');
  const inputEl = document.getElementById('paNumber');
  const searchButton = document.getElementById('paSearchButton');
  const errorEl = document.getElementById('paError');
  const statusEl = document.getElementById('paStatus');
  const resultWrap = document.getElementById('paResultWrap');
  const resultsBody = document.getElementById('paResultsBody');
  if (!form || !stateEl || !inputEl || !searchButton || !resultWrap || !resultsBody) return;

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function cleanNumber(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/^PA/, '')
      .replace(/\.TIF$/, '')
      .replace(/[^0-9]/g, '');
  }

  function buildUrls(number, state) {
    const paFile = `PA${number}.TIF`;
    const params = new URLSearchParams({ noPA: paFile, negeri: state });
    return {
      checkUrl: `${CHECK_API}?${params.toString()}`,
      downloadUrl: `${PDF_API}?${params.toString()}`
    };
  }

  function clearResults() {
    resultWrap.hidden = true;
    resultsBody.innerHTML = '';
  }

  function encodeRecord(record) {
    return encodeURIComponent(JSON.stringify(record));
  }

  function renderResult(number, state, downloadUrl) {
    const record = {
      productType: 'PA',
      itemCode: number,
      negeri: state,
      amount: 5,
      downloadUrl,
      filename: `PA${number}.pdf`,
      azobssCartValidated: true,
      azobssCartValidatedBy: 'pa-search-check'
    };
    resultsBody.innerHTML = `<tr>
      <td>1</td>
      <td><button class="btn blue" type="button" data-pa-search-record="${encodeRecord(record)}" style="padding:6px 12px;font-size:12px;margin:0;border-radius:8px;">Add to Cart</button></td>
      <td><strong>PA${escapeHtml(number)}</strong></td>
      <td>${escapeHtml(state)}</td>
      <td>Available</td>
      <td>RM5</td>
    </tr>`;
    resultWrap.hidden = false;
  }

  async function search(event) {
    if (event) event.preventDefault();
    const number = cleanNumber(inputEl.value);
    const state = String(stateEl.value || '').trim().toUpperCase();
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.removeAttribute('style');
    }
    if (statusEl) statusEl.textContent = '';
    clearResults();

    if (!state) {
      if (errorEl) errorEl.textContent = 'Select a state before searching.';
      return;
    }
    if (!number) {
      if (errorEl) errorEl.textContent = 'Enter a PA number before searching.';
      return;
    }

    const urls = buildUrls(number, state);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    searchButton.disabled = true;
    if (statusEl) statusEl.textContent = `Searching for PA${number}...`;
    try {
      const response = await fetch(urls.checkUrl, { cache: 'no-store', signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok !== true) {
        if (statusEl) statusEl.textContent = 'No PA record found';
        return;
      }
      renderResult(number, state, urls.downloadUrl);
      if (statusEl) statusEl.textContent = '1 PA record found';
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error && error.name === 'AbortError'
          ? 'PA search took too long. Please try again.'
          : 'PA search is temporarily unavailable. Please try again.';
      }
      if (statusEl) statusEl.textContent = '';
    } finally {
      window.clearTimeout(timeout);
      searchButton.disabled = false;
    }
  }

  form.addEventListener('submit', search);
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
