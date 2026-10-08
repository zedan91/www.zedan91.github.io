(function () {
  'use strict';

  const STATE_LABELS = {
    JOHOR: 'Johor', KEDAH: 'Kedah', KELANTAN: 'Kelantan', MELAKA: 'Melaka',
    'NEGERI SEMBILAN': 'N. Sembilan', PAHANG: 'Pahang', PERAK: 'Perak', PERLIS: 'Perlis',
    'PULAU PINANG': 'P. Pinang', SABAH: 'Sabah', SARAWAK: 'Sarawak', SELANGOR: 'Selangor',
    TERENGGANU: 'Terengganu', 'WILAYAH PERSEKUTUAN KUALA LUMPUR': 'W.P. KL',
    'WILAYAH PERSEKUTUAN LABUAN': 'W.P. Labuan', 'WILAYAH PERSEKUTUAN PUTRAJAYA': 'W.P. Putrajaya'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[ch];
    });
  }

  function hydrateStateSelects() {
    const source = document.getElementById('negeri');
    if (!source) return;
    const sourceOptions = Array.from(source.options || []).filter(function (option) { return option.value; });
    document.querySelectorAll('select[data-copy-states]').forEach(function (select) {
      if (Array.from(select.options || []).some(function (option) { return option.value; })) return;
      sourceOptions.forEach(function (sourceOption) {
        const option = document.createElement('option');
        option.value = sourceOption.value;
        option.textContent = sourceOption.textContent;
        select.appendChild(option);
      });
    });
  }

  function syncStateButtonActive(holder, select) {
    if (!holder || !select) return;
    const selected = String(select.value || '');
    holder.querySelectorAll('.pabm-state-button').forEach(function (row) {
      const isActive = String(row.getAttribute('data-state-value') || '') === selected;
      row.classList.toggle('is-active', isActive);
      row.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderStateButtons(holder, select) {
    if (!holder || !select) return;
    const options = Array.from(select.options || []).filter(function (option) { return option.value; });
    if (!options.length) return;
    holder.innerHTML = options.map(function (option) {
      const isActive = select.value === option.value;
      const active = isActive ? ' is-active' : '';
      return '<button class="pabm-state-button' + active + '" type="button" aria-pressed="' + (isActive ? 'true' : 'false') + '" data-state-value="' + escapeHtml(option.value) + '">' +
        escapeHtml(STATE_LABELS[option.value] || option.textContent) + '</button>';
    }).join('');
    syncStateButtonActive(holder, select);
  }

  function bindStatePicker(holder) {
    const select = document.getElementById(holder.getAttribute('data-state-picker-for') || '');
    if (!select) return;
    renderStateButtons(holder, select);
    if (holder.dataset.pabmStateBound === '1') return;
    holder.dataset.pabmStateBound = '1';
    holder.addEventListener('click', function (event) {
      const button = event.target.closest('[data-state-value]');
      if (!button || !holder.contains(button)) return;
      event.preventDefault();
      select.value = button.getAttribute('data-state-value') || '';
      // v1252: mark by VALUE before dispatching change. The change listener
      // rebuilds the button DOM synchronously, so comparing against the old
      // clicked node after dispatch caused every button to lose is-active.
      syncStateButtonActive(holder, select);
      select.dispatchEvent(new Event('change', { bubbles:true }));
      syncStateButtonActive(holder, select);
    });
    select.addEventListener('change', function () { renderStateButtons(holder, select); });
  }

  function activateStateGrid() {
    hydrateStateSelects();
    if (document.body) document.body.classList.add('pabm-store-ready', 'pabm-state-picker-ready');
    document.querySelectorAll('[data-state-picker-for]').forEach(bindStatePicker);
  }


  // v1267: Lot Kadaster map must not depend on the optional storefront ES module.
  // The visible cart/checkout can operate through classic fallbacks, so the map
  // button also needs a classic owner or it can become a dead button whenever
  // azobss-pabm-storefront.js is delayed or fails to initialise.
  const JUPEM_STATE_CODES = {
    JOHOR:'01', KEDAH:'02', KELANTAN:'03', MELAKA:'04', 'NEGERI SEMBILAN':'05',
    PAHANG:'06', 'PULAU PINANG':'07', PERAK:'08', PERLIS:'09', SELANGOR:'10',
    TERENGGANU:'11', SABAH:'12', SARAWAK:'13',
    'WILAYAH PERSEKUTUAN KUALA LUMPUR':'14', 'WILAYAH PERSEKUTUAN LABUAN':'15',
    'WILAYAH PERSEKUTUAN PUTRAJAYA':'16'
  };

  function setLotMapStatus(button, message, state) {
    const panel = button && button.closest ? button.closest('[data-pa-bm-panel]') : null;
    const status = panel ? panel.querySelector('[data-lot-status]') : null;
    const error = panel ? panel.querySelector('[data-lot-error]') : null;
    if (error) error.textContent = '';
    if (!status) return;
    status.textContent = String(message || '');
    status.classList.remove('is-checking', 'is-success', 'is-unavailable', 'is-loading', 'is-error');
    if (state) status.classList.add('is-' + state);
  }

  function waitForFunction(name, timeoutMs) {
    const timeout = Math.max(0, Number(timeoutMs || 0));
    const started = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        if (typeof window[name] === 'function') return resolve(window[name]);
        if (Date.now() - started >= timeout) return resolve(null);
        window.setTimeout(check, 60);
      })();
    });
  }

  function loadFreshLotMapScript1267() {
    return new Promise(function (resolve, reject) {
      if (typeof window.azobssOpenLotSelectionMap === 'function') return resolve(window.azobssOpenLotSelectionMap);
      const existing = document.getElementById('azobssLotSelectionMapRecovery1267');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.azobssOpenLotSelectionMap || null); }, { once:true });
        existing.addEventListener('error', function () { reject(new Error('Komponen peta pilihan tidak dapat dimuatkan.')); }, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'azobssLotSelectionMapRecovery1267';
      script.src = '/assets/js/azobss-lot-selection-map.js?v=1271';
      script.async = true;
      script.addEventListener('load', function () { resolve(window.azobssOpenLotSelectionMap || null); }, { once:true });
      script.addEventListener('error', function () { reject(new Error('Komponen peta pilihan tidak dapat dimuatkan.')); }, { once:true });
      document.head.appendChild(script);
    });
  }

  async function ensureLotMapApi1267() {
    if (typeof window.azobssOpenLotSelectionMap === 'function') return window.azobssOpenLotSelectionMap;
    let fn = await waitForFunction('azobssOpenLotSelectionMap', 1400);
    if (fn) return fn;
    try { fn = await loadFreshLotMapScript1267(); } catch (_) { fn = null; }
    if (fn) return fn;
    return waitForFunction('azobssOpenLotSelectionMap', 2200);
  }

  async function getPaBmAuthTokenClassic1268() {
    const deadline = Date.now() + 10000;
    let lastError = null;

    // v1268: opening the classic Lot Kadaster map must not mean the Firebase
    // session is already hydrated. The navbar can restore the saved AZOBSS
    // profile before Firebase Auth has published currentUser. Wait for the
    // authoritative storefront/global-auth token bridge instead of doing one
    // immediate lookup and incorrectly reporting that the user logged out.
    while (Date.now() < deadline) {
      try {
        if (typeof window.azobssWaitForFirebaseAuthToken === 'function') {
          const token = await window.azobssWaitForFirebaseAuthToken(false, Math.max(1200, deadline - Date.now()));
          if (token) return token;
        }
      } catch (error) { lastError = error; }

      try {
        if (typeof window.azobssGetPaBmAuthToken === 'function') {
          const token = await window.azobssGetPaBmAuthToken(false);
          if (token) return token;
        }
      } catch (error) { lastError = error; }

      try {
        if (typeof window.azobssGetFirebaseAuthHeaders === 'function') {
          let headers = await window.azobssGetFirebaseAuthHeaders(false);
          let authHeader = headers && (headers.Authorization || headers.authorization);
          let match = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
          if (match && match[1]) return match[1];

          // One forced refresh attempt once Firebase has hydrated but the cached
          // token is stale/temporarily unavailable.
          headers = await window.azobssGetFirebaseAuthHeaders(true);
          authHeader = headers && (headers.Authorization || headers.authorization);
          match = String(authHeader || '').match(/^Bearer\s+(.+)$/i);
          if (match && match[1]) return match[1];
        }
      } catch (error) { lastError = error; }

      // Global Auth broadcasts this after its profile/auth state catches up.
      // Polling as well keeps this bridge independent from module load order.
      await new Promise(function (resolve) { window.setTimeout(resolve, 180); });
    }

    try {
      if (typeof window.azShowToast === 'function') {
        window.azShowToast('Sesi akaun masih sedang disediakan. Cuba sekali lagi selepas beberapa saat.');
      }
    } catch (_) {}
    if (lastError) console.warn('AZOBSS v1272 Lot Kadaster auth wait failed:', lastError);
    return '';
  }

  async function addPreparedLotToCart1267(prepared, fallbackStateName) {
    if (typeof window.azobssAddPreparedLotSelectionToCart === 'function') {
      return window.azobssAddPreparedLotSelectionToCart(prepared, fallbackStateName || '');
    }
    if (typeof window.azobssAddToPaBmCart !== 'function') {
      throw new Error('Fungsi Troli AZOBSS belum tersedia. Muat semula halaman dan cuba lagi.');
    }
    const item = await window.azobssAddToPaBmCart({
      productType: prepared && prepared.productType,
      itemCode: prepared && prepared.jobId,
      negeri: (prepared && prepared.negeri) || fallbackStateName || '',
      variant: prepared && prepared.variant,
      amount: prepared && prepared.amount,
      productId: prepared && prepared.jobId,
      downloadUrl: prepared && prepared.downloadUrl,
      filename: prepared && prepared.filename,
      selectionToken: prepared && prepared.selectionToken,
      areaRatio: prepared && prepared.areaRatio
    });
    const lotCount = Number(prepared && prepared.lotCount || 0).toLocaleString('ms-MY');
    const amount = Number(item && item.amount || prepared && prepared.amount || 0);
    const money = 'RM' + (Number.isInteger(amount) ? String(amount) : amount.toFixed(2));
    const message = item && item.__azobssAlreadyInCart
      ? 'Pilihan Lot Kadaster ini sudah ada dalam troli anda.'
      : 'Berjaya: ' + lotCount + ' lot telah dimasukkan ke troli anda pada harga ' + money + '.';
    try { if (typeof window.azShowToast === 'function') window.azShowToast(message); } catch (_) {}
    return { item:item, message:message };
  }

  async function openLotSelectionMapClassic1268(button) {
    if (!button || button.dataset.azLotMapOpening1267 === '1') return;
    const state = document.getElementById(button.getAttribute('data-state-id') || '');
    const stateName = String(state && state.value || '').trim().toUpperCase();
    const stateCode = JUPEM_STATE_CODES[stateName] || '';
    const productCode = String(button.getAttribute('data-jupem-product') || '1') === '2' ? '2' : '1';
    if (!stateCode) {
      setLotMapStatus(button, 'Pilih negeri sebelum membuka peta pilihan.', 'unavailable');
      return;
    }
    button.dataset.azLotMapOpening1267 = '1';
    button.disabled = true;
    setLotMapStatus(button, 'Menyediakan peta pilihan Lot Kadaster...', 'checking');
    try {
      const opener = await ensureLotMapApi1267();
      if (typeof opener !== 'function') throw new Error('Komponen peta pilihan tidak dapat dimuatkan. Sila cuba semula.');
      await opener({
        productCode: productCode,
        stateCode: stateCode,
        stateName: stateName,
        getAuthToken: getPaBmAuthTokenClassic1268,
        onPrepared: async function (prepared) {
          const result = await addPreparedLotToCart1267(prepared, stateName);
          setLotMapStatus(button, result && result.message || 'Pilihan Lot Kadaster dimasukkan ke troli anda.', 'success');
          return result;
        }
      });
    } catch (error) {
      if (!error || error.code !== 'MAP_CLOSED') {
        setLotMapStatus(button, error && error.message || 'Peta pilihan tidak dapat dibuka.', 'unavailable');
      }
    } finally {
      button.disabled = false;
      delete button.dataset.azLotMapOpening1267;
    }
  }

  // Capture this one action before the optional storefront listener. This makes
  // the map button deterministic and prevents two owners from opening two maps.
  document.addEventListener('click', function (event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-jupem-lot-map]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    window.__AZOBSS_PABM_LOT_MAP_OWNER__ = 'early-bridge-v1272';
    openLotSelectionMapClassic1268(button);
  }, true);

  // v1267: classic bridge owns STATE-PICKER + Lot Kadaster map open only.
  // Cart click handling remains on the proven classic cart/storefront path.
  // Do not capture/stop ordinary cart clicks here.
  // v1258: this classic bridge was STATE-PICKER ONLY.
  // Cart click handling is intentionally restored to the proven v1245 path:
  // result-table handler -> window.azobssRecordPurchase -> storefront addToStoreCart.
  // Do not capture/stop cart clicks here.
  activateStateGrid();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateStateGrid, { once:true });
  }
  window.addEventListener('pageshow', activateStateGrid);
})();
