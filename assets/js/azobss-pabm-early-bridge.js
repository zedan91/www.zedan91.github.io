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

  // v1254: hard cart owner lives in this classic (non-module) bridge.
  // v1253 still placed the table-cart capture handler inside the ES-module
  // storefront. If that module was still importing Firebase / price-adjustment
  // dependencies, the blue cart button had no owner yet and a click could do
  // nothing. This bridge is already parsed before the search scripts, so it owns
  // table cart clicks immediately and writes the SAME localStorage cart format.
  const CART_PREFIX = 'azobss_pabm_store_cart_v1_';
  const CART_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
  const MAX_CART_ITEMS = 50;
  const TABLE_CART_BUTTON_SELECTOR = [
    '.pabm-table-cart-button[data-benchmark-record]',
    '.pabm-table-cart-button[data-pa-search-record]',
    '.pabm-table-cart-button[data-gps-record]',
    '.pabm-table-cart-button[data-syit-record]'
  ].join(',');
  const PRODUCT_TYPES = new Set(['PA','BM','SBM','GPS','NDCDB','NDCDB_C3','SYIT_PIAWAI']);
  const PRODUCT_LABELS = {
    PA:'PA', BM:'BM', SBM:'SBM', GPS:'GPS', NDCDB:'Lot Kadaster Berdigit',
    NDCDB_C3:'Lot Kadaster Berdigit C3', SYIT_PIAWAI:'Syit Piawai (Gambar)'
  };

  function safeJson(raw) {
    try { const value = JSON.parse(raw || 'null'); return value && typeof value === 'object' ? value : null; }
    catch (_) { return null; }
  }
  function bridgeSavedUser() {
    try {
      if (typeof window.getSavedUser === 'function') {
        const current = window.getSavedUser();
        if (current && typeof current === 'object') return current;
      }
    } catch (_) {}
    const stores = [window.sessionStorage, window.localStorage];
    const keys = ['azobssCurrentUser','azobssUser'];
    for (const key of keys) {
      for (const store of stores) {
        try {
          const value = safeJson(store.getItem(key));
          if (value) return value;
        } catch (_) {}
      }
    }
    return null;
  }
  function bridgeUserKey() {
    const user = bridgeSavedUser() || {};
    return String(user.uid || user.usernameKey || user.username || user.email || '').trim();
  }
  function bridgeCartKey() { return CART_PREFIX + (bridgeUserKey() || 'guest'); }
  function bridgeHasLogin() {
    try { if (typeof window.hasSavedLogin === 'function' && window.hasSavedLogin()) return true; } catch (_) {}
    return !!bridgeSavedUser();
  }
  function bridgeOpenLogin() {
    if (typeof window.openSiteAuth === 'function') { window.openSiteAuth('signin'); return; }
    const button = document.getElementById('siteSignInButton');
    if (button) button.click();
  }
  function normalizeType(value) {
    const type = String(value || 'PA').trim().toUpperCase();
    if (!PRODUCT_TYPES.has(type)) throw new Error('Kategori dokumen tidak disokong.');
    return type;
  }
  function normalizeCode(value, type) {
    const raw = String(value || '').trim();
    if (type === 'PA') return raw.toUpperCase().replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'');
    if (type === 'NDCDB' || type === 'NDCDB_C3') return raw.replace(/\s+/g,' ');
    return raw.toUpperCase().replace(/\s+/g,' ');
  }
  function normalizeVariant(value, type) {
    if (type !== 'NDCDB' && type !== 'NDCDB_C3') return '';
    const variant = String(value || '').trim().toUpperCase();
    return variant === 'FULL_SHEET' || variant === 'AREA_BASED' ? variant : '';
  }
  function basePrice(type, variant, supplied) {
    if (type === 'PA') return 5;
    if (type === 'BM' || type === 'SBM') return 3;
    if (type === 'GPS') return 9;
    if (type === 'SYIT_PIAWAI') return 7;
    if (type === 'NDCDB' || type === 'NDCDB_C3') {
      const amount = Number(supplied);
      if (Number.isFinite(amount) && amount > 0) return Math.max(5, Math.floor(amount + 0.5 + Number.EPSILON));
      return variant === 'FULL_SHEET' ? 50 : 15;
    }
    return Number(supplied || 0) || 0;
  }
  function priceCategory(type) { return type === 'NDCDB' || type === 'NDCDB_C3' ? 'lotKadaster' : 'paBm'; }
  function adjustmentPercent(type) {
    const category = priceCategory(type);
    try {
      if (typeof window.azobssGetPriceAdjustmentPercent === 'function') {
        const value = Number(window.azobssGetPriceAdjustmentPercent(category));
        if (Number.isFinite(value)) return value;
      }
    } catch (_) {}
    try {
      const map = window.AZOBSS_USER_PRICE_ADJUSTMENT && window.AZOBSS_USER_PRICE_ADJUSTMENT.percentByCategory;
      const value = Number(map && map[category]);
      if (Number.isFinite(value)) return value;
    } catch (_) {}
    return 0;
  }
  function applyAdjustment(amount, percent) {
    const base = Number(amount || 0);
    const p = Number(percent || 0);
    return Math.max(0.01, Math.round((base * (1 + p / 100) + Number.EPSILON) * 100) / 100);
  }
  function selectionAreaRatio(payload) {
    const direct = Number(payload && payload.areaRatio);
    return Number.isFinite(direct) && direct > 0 ? direct : 0;
  }
  function bridgeNormalizeItem(payload) {
    const type = normalizeType(payload && (payload.productType || payload.product || payload.type));
    const code = normalizeCode(payload && (payload.itemCode || payload.stationNo || payload.stesen || payload.productId || payload.id), type);
    const negeri = String(payload && (payload.negeri || payload.state) || '').trim().toUpperCase();
    const variant = normalizeVariant(payload && (payload.variant || payload.areaSize), type);
    if (!code || !negeri) throw new Error('Pilih negeri dan masukkan nombor dokumen yang sah.');
    const baseAmount = basePrice(type, variant, payload && (payload.baseAmount ?? payload.amount));
    const percent = adjustmentPercent(type);
    return {
      id: [type, code, negeri, variant].filter(Boolean).join('|'),
      productType:type,
      itemCode:code,
      negeri,
      variant,
      baseAmount,
      amount:applyAdjustment(baseAmount, percent),
      priceAdjustmentCategory:priceCategory(type),
      priceAdjustmentPercent:percent,
      productId:String(payload && (payload.productId || payload.id) || '').trim(),
      stationNo:String(payload && (payload.stationNo || payload.stesen) || '').trim().toUpperCase(),
      jenis:String(payload && payload.jenis || (type === 'SBM' ? '2' : '1')) === '2' ? '2' : '1',
      downloadUrl:String(payload && (payload.downloadUrl || payload.url) || '').trim(),
      filename:String(payload && payload.filename || '').trim(),
      selectionToken:String(payload && payload.selectionToken || '').trim(),
      areaRatio:selectionAreaRatio(payload),
      addedAtMs:Date.now()
    };
  }
  function bridgeReadCart() {
    try {
      const rows = JSON.parse(localStorage.getItem(bridgeCartKey()) || '[]');
      const now = Date.now();
      if (!Array.isArray(rows)) return [];
      return rows.filter(function (item) {
        return item && now - Number(item.addedAtMs || now) <= CART_MAX_AGE_MS;
      }).slice(0, MAX_CART_ITEMS);
    } catch (_) { return []; }
  }
  function money(value) {
    const n = Number(value || 0);
    return 'RM' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
  }
  function bridgeRenderCart() {
    const items = bridgeReadCart();
    const list = document.getElementById('pabmStoreCartItems');
    const count = document.getElementById('pabmStoreCartCount');
    const total = document.getElementById('pabmStoreCartTotal');
    const paymentTotal = document.getElementById('paBmToyyibTotal');
    const amount = items.reduce(function (sum, item) { return sum + Number(item.amount || 0); }, 0);
    if (count) count.textContent = items.length + ' item';
    if (total) total.textContent = money(amount);
    if (paymentTotal) paymentTotal.textContent = money(amount);
    if (list) {
      if (!items.length) list.innerHTML = '<div class="pabm-cart-empty">Troli anda kosong.</div>';
      else list.innerHTML = items.map(function (item, index) {
        const title = (PRODUCT_LABELS[item.productType] || item.productType) + ' ' + item.itemCode;
        const state = STATE_LABELS[item.negeri] || item.negeri;
        return '<div class="pabm-cart-item"><div><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(state) + '</small></div>' +
          '<div class="pabm-cart-item-side"><span class="pabm-cart-item-price">' + money(item.amount) + '</span>' +
          '<button class="pabm-cart-remove" type="button" data-pabm-remove="' + index + '" aria-label="Buang ' + escapeHtml(title) + '" title="Buang">&times;</button></div></div>';
      }).join('');
    }
    const pay = document.getElementById('payPaBmToyyibButton');
    if (pay && !window.azobssPaBmStoreCart) {
      pay.disabled = !items.length;
      pay.textContent = items.length ? 'Teruskan Pembayaran' : 'Troli Kosong';
    }
    bridgeSyncTableButtons(items);
  }
  function bridgeWriteCart(items) {
    const clean = Array.isArray(items) ? items.filter(Boolean).slice(0, MAX_CART_ITEMS) : [];
    localStorage.setItem(bridgeCartKey(), JSON.stringify(clean));
    bridgeRenderCart();
    try { window.dispatchEvent(new CustomEvent('azobss:pabm-cart-updated', { detail:{ count:clean.length, source:'early-bridge-v1254' } })); } catch (_) {}
    return clean;
  }
  function bridgeAdd(payload) {
    if (!bridgeHasLogin()) { bridgeOpenLogin(); throw new Error('Sila log masuk sebelum menambah item ke troli anda.'); }
    const item = bridgeNormalizeItem(payload || {});
    const items = bridgeReadCart();
    const exists = items.some(function (row) { return String(row && row.id || '') === item.id; });
    if (!exists) {
      if (items.length >= MAX_CART_ITEMS) throw new Error('Troli sudah mencapai had maksimum.');
      items.unshift(item);
      bridgeWriteCart(items);
    } else bridgeRenderCart();
    return Object.assign({}, item, { __azobssAlreadyInCart:exists, __azobssEarlyBridge:true });
  }
  function decodeButtonPayload(button) {
    const raw = button && (button.dataset.benchmarkRecord || button.dataset.paSearchRecord || button.dataset.gpsRecord || button.dataset.syitRecord || '');
    if (!raw) return null;
    try { return JSON.parse(decodeURIComponent(raw)); } catch (_) { return null; }
  }
  function bridgeButtonItemId(button) {
    try { const payload = decodeButtonPayload(button); return payload ? bridgeNormalizeItem(payload).id : ''; } catch (_) { return ''; }
  }
  function bridgeSyncTableButtons(items) {
    const rows = Array.isArray(items) ? items : bridgeReadCart();
    const ids = new Set(rows.map(function (row) { return String(row && row.id || ''); }).filter(Boolean));
    document.querySelectorAll(TABLE_CART_BUTTON_SELECTOR).forEach(function (button) {
      const active = ids.has(bridgeButtonItemId(button));
      button.classList.toggle('is-in-cart', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.title = active ? 'Tekan lagi untuk buang daripada Troli' : 'Tambah ke Troli';
    });
  }
  function bridgeStatus(message) {
    const status = document.getElementById('paBmToyyibStatus');
    if (status) status.textContent = message || '';
    try { if (typeof window.azShowToast === 'function' && message) window.azShowToast(message); } catch (_) {}
  }
  function bridgeToggleTableButton(event) {
    const target = event.target;
    const button = target && target.closest ? target.closest(TABLE_CART_BUTTON_SELECTOR) : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    const payload = decodeButtonPayload(button);
    if (!payload) { bridgeStatus('Data item troli tidak sah.'); return; }
    try {
      if (!bridgeHasLogin()) { bridgeOpenLogin(); bridgeStatus('Sila log masuk sebelum menambah item ke troli anda.'); return; }
      const item = bridgeNormalizeItem(payload);
      const items = bridgeReadCart();
      const index = items.findIndex(function (row) { return String(row && row.id || '') === item.id; });
      if (index >= 0) {
        items.splice(index, 1);
        bridgeWriteCart(items);
        bridgeStatus('Item berjaya dibuang daripada Troli Anda.');
      } else {
        if (items.length >= MAX_CART_ITEMS) throw new Error('Troli sudah mencapai had maksimum.');
        items.unshift(item);
        bridgeWriteCart(items);
        bridgeStatus('Item berjaya ditambah ke Troli Anda.');
      }
    } catch (error) {
      bridgeStatus(error && error.message ? error.message : 'Item ini tidak dapat dimasukkan ke Troli Anda.');
    }
  }

  function resolveCartAdd() {
    if (window.azobssPaBmStoreCart && typeof window.azobssPaBmStoreCart.add === 'function') {
      return window.azobssPaBmStoreCart.add.bind(window.azobssPaBmStoreCart);
    }
    if (typeof window.__AZOBSS_PABM_CART_RECORD_PURCHASE__ === 'function') return window.__AZOBSS_PABM_CART_RECORD_PURCHASE__;
    return null;
  }

  // Search flows may call this before the storefront module exists. v1254 no
  // longer waits 15 seconds: it writes immediately via the classic bridge and
  // the storefront will read/re-price the same stored cart when it finishes.
  window.azobssAddToPaBmCart = async function (payload) {
    const add = resolveCartAdd();
    return add ? add(payload) : bridgeAdd(payload);
  };
  window.__AZOBSS_PABM_EARLY_CART_OWNER__ = true;
  window.__AZOBSS_PABM_EARLY_CART_RENDER__ = bridgeRenderCart;
  document.addEventListener('click', bridgeToggleTableButton, true);
  window.addEventListener('storage', bridgeRenderCart);
  window.addEventListener('azobss:pabm-cart-updated', function () { if (!window.azobssPaBmStoreCart) bridgeRenderCart(); });
  // Do this immediately after the PA/BM markup has been parsed. This keeps the
  // modern all-state button grid visible even while module/Firebase scripts are loading.
  activateStateGrid();
  bridgeRenderCart();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateStateGrid, { once:true });
    document.addEventListener('DOMContentLoaded', bridgeRenderCart, { once:true });
  }
  window.addEventListener('pageshow', activateStateGrid);
})();
