import { getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const CART_PREFIX = 'azobss_pabm_store_cart_v1_';
const BACKEND_BASE = window.AZOBSS_BACKEND_URL || (
  /^(?:127\.0\.0\.1|localhost)$/.test(window.location.hostname)
    ? window.location.origin
    : 'https://azobss-backend.onrender.com'
);
const CHECKOUT_API_VERSION = 2;
const CART_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_CART_ITEMS = 50;
const PRODUCT_TYPES = new Set(['PA', 'BM', 'SBM', 'GPS', 'NDCDB', 'NDCDB_C3', 'SYIT_PIAWAI']);
const PRODUCT_LABELS = {
  PA: 'PA',
  BM: 'BM',
  SBM: 'SBM',
  GPS: 'GPS',
  NDCDB: 'Lot Kadaster Berdigit',
  NDCDB_C3: 'Lot Kadaster Berdigit C3',
  SYIT_PIAWAI: 'Syit Piawai (Gambar)'
};
const AREA_LABELS = {
  FULL_SHEET: '90%+ keluasan 1 syit',
  AREA_BASED: 'Harga mengikut peratus keluasan'
};
const STATE_LABELS = {
  JOHOR: 'Johor',
  KEDAH: 'Kedah',
  KELANTAN: 'Kelantan',
  MELAKA: 'Melaka',
  'NEGERI SEMBILAN': 'N. Sembilan',
  PAHANG: 'Pahang',
  PERAK: 'Perak',
  PERLIS: 'Perlis',
  'PULAU PINANG': 'P. Pinang',
  SABAH: 'Sabah',
  SARAWAK: 'Sarawak',
  SELANGOR: 'Selangor',
  TERENGGANU: 'Terengganu',
  'WILAYAH PERSEKUTUAN KUALA LUMPUR': 'W.P. KL',
  'WILAYAH PERSEKUTUAN LABUAN': 'W.P. Labuan',
  'WILAYAH PERSEKUTUAN PUTRAJAYA': 'W.P. Putrajaya'
};
const JUPEM_STATE_CODES = {
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
  SABAH: '12',
  SARAWAK: '13',
  'WILAYAH PERSEKUTUAN KUALA LUMPUR': '14',
  'WILAYAH PERSEKUTUAN LABUAN': '15',
  'WILAYAH PERSEKUTUAN PUTRAJAYA': '16'
};

let auth = null;
let paymentButton = null;
let adminTestPaymentButton = null;
let totalObserver = null;
let cartButtonObserver = null;
let cartButtonSyncTimer = null;

function savedUser() {
  try {
    return typeof window.getSavedUser === 'function' ? (window.getSavedUser() || null) : null;
  } catch (_) {
    return null;
  }
}

function userKey() {
  const firebaseUser = auth && auth.currentUser;
  const localUser = savedUser() || {};
  return String((firebaseUser && firebaseUser.uid) || localUser.uid || localUser.usernameKey || localUser.username || '').trim();
}

function cartKey() {
  return CART_PREFIX + (userKey() || 'guest');
}

function openLogin() {
  if (typeof window.openSiteAuth === 'function') {
    window.openSiteAuth('signin');
    return;
  }
  const button = document.getElementById('siteSignInButton');
  if (button) button.click();
}

function requireLogin() {
  if (auth && auth.currentUser) return true;
  openLogin();
  return false;
}

function guardCartAction(event) {
  const target = event.target.closest('#downloadTifButton, [data-benchmark-record], [data-pabm-product-add]');
  if (!target || (auth && auth.currentUser)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const message = target.id === 'downloadTifButton'
    ? document.getElementById('paError')
    : target.matches('[data-pabm-product-add]')
      ? target.closest('[data-pa-bm-panel]')?.querySelector('.request-error')
      : document.getElementById('benchmarkError');
  if (message) message.textContent = 'Sila log masuk sebelum menambah item ke troli anda.';
  openLogin();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function normalizeType(value) {
  const type = String(value || 'PA').trim().toUpperCase();
  if (!PRODUCT_TYPES.has(type)) throw new Error('Unsupported document category.');
  return type;
}

function normalizeCode(value, type) {
  const raw = String(value || '').trim();
  if (type === 'PA') return raw.toUpperCase().replace(/^PA/i, '').replace(/\.TIF$/i, '').replace(/[^0-9]/g, '');
  if (type === 'NDCDB' || type === 'NDCDB_C3') return raw.replace(/\s+/g, ' ');
  return raw.toUpperCase().replace(/\s+/g, ' ');
}

function normalizeVariant(value, type) {
  if (type !== 'NDCDB' && type !== 'NDCDB_C3') return '';
  const variant = String(value || '').trim().toUpperCase();
  if (variant !== 'FULL_SHEET' && variant !== 'AREA_BASED') {
    throw new Error('Harga keluasan Lot Kadaster tidak sah. Buka semula peta pilihan.');
  }
  return variant;
}

function productPrice(type, variant = '', suppliedAmount = 0) {
  if (type === 'PA') return 5;
  if (type === 'BM' || type === 'SBM') return 3;
  if (type === 'GPS') return 9;
  if (type === 'SYIT_PIAWAI') return 7;
  if (type === 'NDCDB' || type === 'NDCDB_C3') {
    const dynamicAmount = Number(suppliedAmount);
    if (Number.isFinite(dynamicAmount) && dynamicAmount > 0) return Math.round((dynamicAmount + Number.EPSILON) * 100) / 100;
    return variant === 'FULL_SHEET' ? 50 : 15;
  }
  throw new Error('Unsupported document category.');
}

function normalizeItem(payload) {
  const type = normalizeType(payload && (payload.productType || payload.product || payload.type));
  const code = normalizeCode(payload && (payload.itemCode || payload.stationNo || payload.stesen || payload.productId || payload.id), type);
  const negeri = String(payload && (payload.negeri || payload.state) || '').trim().toUpperCase();
  const variant = normalizeVariant(payload && (payload.variant || payload.areaSize), type);
  if (!code || !negeri) throw new Error('Select a state and enter a valid document number.');
  return {
    id: [type, code, negeri, variant].filter(Boolean).join('|'),
    productType: type,
    itemCode: code,
    negeri,
    variant,
    amount: productPrice(type, variant, payload && payload.amount),
    productId: String(payload && (payload.productId || payload.id) || '').trim(),
    stationNo: String(payload && (payload.stationNo || payload.stesen) || '').trim().toUpperCase(),
    jenis: String(payload && payload.jenis || (type === 'SBM' ? '2' : '1')) === '2' ? '2' : '1',
    downloadUrl: String(payload && (payload.downloadUrl || payload.url) || '').trim(),
    filename: String(payload && payload.filename || '').trim(),
    selectionToken: String(payload && payload.selectionToken || '').trim(),
    addedAtMs: Date.now()
  };
}

function readCart() {
  try {
    const rows = JSON.parse(localStorage.getItem(cartKey()) || '[]');
    const now = Date.now();
    return Array.isArray(rows)
      ? rows
        .filter((item) => item && now - Number(item.addedAtMs || now) <= CART_MAX_AGE_MS)
        .sort((a, b) => Number(b.addedAtMs || 0) - Number(a.addedAtMs || 0))
        .slice(0, MAX_CART_ITEMS)
      : [];
  } catch (_) {
    return [];
  }
}

function writeCart(items) {
  const clean = Array.isArray(items) ? items.filter(Boolean).slice(0, MAX_CART_ITEMS) : [];
  localStorage.setItem(cartKey(), JSON.stringify(clean));
  renderCart();
  window.dispatchEvent(new CustomEvent('azobss:pabm-cart-updated', { detail: { count: clean.length } }));
}

const TABLE_CART_BUTTON_SELECTOR = [
  '.pabm-table-cart-button[data-benchmark-record]',
  '.pabm-table-cart-button[data-pa-search-record]',
  '.pabm-table-cart-button[data-gps-record]',
  '.pabm-table-cart-button[data-syit-record]'
].join(',');

function decodeCartButtonPayload(button) {
  if (!button) return null;
  const raw = button.dataset.benchmarkRecord
    || button.dataset.paSearchRecord
    || button.dataset.gpsRecord
    || button.dataset.syitRecord
    || '';
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch (_) {
    return null;
  }
}

function cartButtonItemId(button) {
  const payload = decodeCartButtonPayload(button);
  if (!payload) return '';
  try {
    return normalizeItem(payload).id;
  } catch (_) {
    return '';
  }
}

function syncTableCartButtons() {
  const cartIds = new Set(readCart().map((item) => String(item && item.id || '')).filter(Boolean));
  document.querySelectorAll(TABLE_CART_BUTTON_SELECTOR).forEach((button) => {
    const itemId = cartButtonItemId(button);
    const isInCart = !!itemId && cartIds.has(itemId);
    button.classList.toggle('is-in-cart', isInCart);
    button.setAttribute('aria-pressed', isInCart ? 'true' : 'false');
    button.title = isInCart ? 'Tekan lagi untuk buang daripada Troli' : 'Tambah ke Troli';
    const currentLabel = String(button.getAttribute('aria-label') || '').trim();
    if (isInCart) {
      if (!button.dataset.cartOriginalAriaLabel) button.dataset.cartOriginalAriaLabel = currentLabel || 'Tambah ke Troli';
      button.setAttribute('aria-label', 'Item sudah dalam troli. Tekan lagi untuk buang daripada troli');
    } else {
      button.setAttribute('aria-label', button.dataset.cartOriginalAriaLabel || currentLabel || 'Tambah ke Troli');
      delete button.dataset.cartOriginalAriaLabel;
    }
  });
}

function scheduleTableCartButtonSync() {
  if (cartButtonSyncTimer) window.clearTimeout(cartButtonSyncTimer);
  cartButtonSyncTimer = window.setTimeout(() => {
    cartButtonSyncTimer = null;
    syncTableCartButtons();
  }, 20);
}

async function toggleTableCartButton(event) {
  const button = event.target.closest && event.target.closest(TABLE_CART_BUTTON_SELECTOR);
  if (!button || button.dataset.cartToggleBusy === '1') return;

  const payload = decodeCartButtonPayload(button);
  if (!payload) return;

  let itemId = '';
  try {
    itemId = normalizeItem(payload).id;
  } catch (_) {
    return;
  }

  const items = readCart();
  const index = items.findIndex((item) => String(item && item.id || '') === itemId);
  if (index < 0) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const removedItem = items[index];
  items.splice(index, 1);
  button.dataset.cartToggleBusy = '1';
  button.disabled = true;
  writeCart(items);
  setCartSyncStatus('Item berjaya dibuang daripada troli.');

  if (typeof window.azShowToast === 'function') {
    window.azShowToast('Item berjaya dibuang daripada troli.');
  }

  try {
    const removedCount = await removePendingPurchaseItems(removedItem);
    setCartSyncStatus(removedCount
      ? 'Item dan rekod Pending Payment berjaya dibuang.'
      : 'Item berjaya dibuang daripada troli.');
  } catch (error) {
    setCartSyncStatus(error && error.message
      ? error.message
      : 'Item telah dibuang daripada troli, tetapi rekod Pending Payment belum dapat disegerakkan.');
  } finally {
    delete button.dataset.cartToggleBusy;
    button.disabled = false;
    scheduleTableCartButtonSync();
  }
}

function watchTableCartButtons() {
  if (!window.MutationObserver || cartButtonObserver) return;
  cartButtonObserver = new MutationObserver((mutations) => {
    const hasRelevantAddition = mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => {
      if (!(node instanceof Element)) return false;
      return node.matches?.(TABLE_CART_BUTTON_SELECTOR) || !!node.querySelector?.(TABLE_CART_BUTTON_SELECTOR);
    }));
    if (hasRelevantAddition) scheduleTableCartButtonSync();
  });
  cartButtonObserver.observe(document.body, { childList: true, subtree: true });
}

function hasStoredCartSnapshot() {
  try {
    return localStorage.getItem(cartKey()) !== null;
  } catch (_) {
    return false;
  }
}

function setCartSyncStatus(message) {
  const status = document.getElementById('paBmToyyibStatus');
  if (status) status.textContent = message || '';
}

async function waitForPendingCartRemover(attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (typeof window.azobssRemovePendingCartItems === 'function') return window.azobssRemovePendingCartItems;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function removePendingPurchaseItems(payload) {
  const remover = await waitForPendingCartRemover();
  if (!remover) throw new Error('Sistem rekod pembelian belum tersedia. Sila muat semula halaman.');
  return remover(payload);
}

async function reconcileEmptyStoredCart() {
  if (!hasStoredCartSnapshot() || readCart().length || !(auth && auth.currentUser)) return 0;
  const remover = await waitForPendingCartRemover();
  if (!remover) return 0;
  const count = await remover({ all: true });
  if (count) setCartSyncStatus(`${count} rekod Pending Payment telah dibuang.`);
  return count;
}

function formatMoney(value) {
  return 'RM' + Number(value || 0).toFixed(2);
}

function cartTotal(items = readCart()) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function renderCart() {
  const items = readCart();
  const list = document.getElementById('pabmStoreCartItems');
  const count = document.getElementById('pabmStoreCartCount');
  const total = document.getElementById('pabmStoreCartTotal');
  const paymentTotal = document.getElementById('paBmToyyibTotal');
  const amount = cartTotal(items);

  if (count) count.textContent = items.length + ' item';
  if (total) total.textContent = formatMoney(amount);
  if (paymentTotal && paymentTotal.textContent !== formatMoney(amount)) paymentTotal.textContent = formatMoney(amount);

  if (list) {
    list.innerHTML = items.length ? items.map((item, index) => `
      <div class="pabm-cart-item">
        <div>
          <strong>${escapeHtml(PRODUCT_LABELS[item.productType] || item.productType)} ${escapeHtml(item.itemCode)}</strong>
          <small>${escapeHtml(STATE_LABELS[item.negeri] || item.negeri)}${item.variant ? ' &middot; ' + escapeHtml(AREA_LABELS[item.variant] || item.variant) : ''}</small>
        </div>
        <div class="pabm-cart-item-side">
          <span class="pabm-cart-item-price">${formatMoney(item.amount)}</span>
          <button class="pabm-cart-remove" type="button" data-pabm-remove="${index}" aria-label="Buang ${escapeHtml(item.productType)} ${escapeHtml(item.itemCode)}" title="Buang">&times;</button>
        </div>
      </div>`).join('') : '<div class="pabm-cart-empty">Troli anda kosong.</div>';
  }

  if (paymentButton) {
    const loggedIn = !!(auth && auth.currentUser);
    paymentButton.disabled = !items.length;
    paymentButton.textContent = loggedIn ? 'Teruskan Pembayaran' : 'Log Masuk untuk Membayar';
    if (!items.length) paymentButton.textContent = 'Troli Kosong';
  }
  if (adminTestPaymentButton) {
    const loggedIn = !!(auth && auth.currentUser);
    adminTestPaymentButton.disabled = !items.length || !loggedIn;
    adminTestPaymentButton.textContent = items.length ? 'Test Payment (Admin)' : 'Test Payment (Empty Cart)';
  }
  scheduleTableCartButtonSync();
}

async function addToStoreCart(payload) {
  if (!requireLogin()) throw new Error('Sila log masuk sebelum menambah item ke troli anda.');
  const item = normalizeItem(payload || {});
  const items = readCart();
  const exists = items.some((row) => row.id === item.id);
  if (!exists) {
    if (items.length >= MAX_CART_ITEMS) throw new Error('Cart limit reached. Remove an item before adding another.');
    items.unshift(item);
    writeCart(items);
  } else {
    renderCart();
  }
  return { ...item, __azobssAlreadyInCart: exists };
}

function hydrateStateSelects() {
  const source = document.getElementById('negeri');
  if (!source) return;
  const sourceOptions = Array.from(source.options).filter((option) => option.value);
  document.querySelectorAll('select[data-copy-states]').forEach((select) => {
    if (select.options.length > 1) return;
    sourceOptions.forEach((sourceOption) => {
      const option = document.createElement('option');
      option.value = sourceOption.value;
      option.textContent = sourceOption.textContent;
      select.appendChild(option);
    });
  });
}

function setupStatePicker(holder) {
  const select = document.getElementById(holder.dataset.statePickerFor || '');
  if (!select) return;
  const options = Array.from(select.options).filter((option) => option.value);
  holder.innerHTML = options.map((option) => `
    <button class="pabm-state-button${select.value === option.value ? ' is-active' : ''}" type="button" data-state-value="${escapeHtml(option.value)}">${escapeHtml(STATE_LABELS[option.value] || option.textContent)}</button>
  `).join('');
  holder.addEventListener('click', (event) => {
    const button = event.target.closest('[data-state-value]');
    if (!button) return;
    select.value = button.dataset.stateValue || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    holder.querySelectorAll('.pabm-state-button').forEach((row) => row.classList.toggle('is-active', row === button));
  });
}

function setupProductPicker(holder) {
  const select = document.getElementById(holder.dataset.productPickerFor || '');
  if (!select) return;
  holder.innerHTML = Array.from(select.options).map((option) => `
    <button class="pabm-product-button${select.value === option.value ? ' is-active' : ''}" type="button" data-product-value="${escapeHtml(option.value)}">${escapeHtml(option.textContent || option.value)}</button>
  `).join('');
  holder.addEventListener('click', (event) => {
    const button = event.target.closest('[data-product-value]');
    if (!button) return;
    select.value = button.dataset.productValue || 'BM';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    holder.querySelectorAll('.pabm-product-button').forEach((row) => row.classList.toggle('is-active', row === button));
  });
}

function updateConfiguredPrice(button) {
  const type = normalizeType(button.dataset.productType || 'PA');
  const variantSelect = document.getElementById(button.dataset.variantId || '');
  const variant = variantSelect ? variantSelect.value : '';
  const price = productPrice(type, variant);
  const priceNode = button.querySelector('.pabm-button-price');
  if (priceNode) priceNode.textContent = formatMoney(price).replace('.00', '');
}

function setPanelStatus(status, message, state) {
  if (!status) return;
  status.textContent = message || '';
  status.classList.remove('is-checking', 'is-success', 'is-unavailable');
  if (state) status.classList.add(`is-${state}`);
}

async function addConfiguredProduct(button) {
  const panel = button.closest('[data-pa-bm-panel]');
  const error = panel?.querySelector('.request-error');
  const status = panel?.querySelector('.request-status');
  const input = document.getElementById(button.dataset.inputId || '');
  const state = document.getElementById(button.dataset.stateId || '');
  const variant = document.getElementById(button.dataset.variantId || '');
  if (error) error.textContent = '';
  try {
    button.disabled = true;
    const item = await addToStoreCart({
      productType: button.dataset.productType || '',
      itemCode: input?.value || '',
      negeri: state?.value || '',
      variant: variant?.value || ''
    });
    setPanelStatus(status, item.__azobssAlreadyInCart
      ? 'Dokumen ini sudah ada dalam troli anda.'
      : `${PRODUCT_LABELS[item.productType] || item.productType} ditambah ke troli anda.`, 'success');
  } catch (addError) {
    if (error) error.textContent = addError.message || 'Dokumen ini tidak dapat ditambah ke troli anda.';
    setPanelStatus(status, addError.message || 'Dokumen ini tidak dapat ditambah ke troli anda.', 'unavailable');
  } finally {
    button.disabled = false;
    updateConfiguredPrice(button);
  }
}

async function openJupemLotMap(button) {
  const panel = button.closest('[data-pa-bm-panel]');
  const error = panel?.querySelector('[data-lot-error]');
  const status = panel?.querySelector('[data-lot-status]');
  const state = document.getElementById(button.dataset.stateId || '');
  const stateName = String(state?.value || '').trim().toUpperCase();
  const stateCode = JUPEM_STATE_CODES[stateName] || '';
  const productCode = String(button.dataset.jupemProduct || '1') === '2' ? '2' : '1';
  if (error) error.textContent = '';
  setPanelStatus(status, '', '');
  if (!stateCode) {
    setPanelStatus(status, 'Pilih negeri sebelum membuka peta pilihan.', 'unavailable');
    return;
  }
  if (typeof window.azobssOpenLotSelectionMap === 'function') {
    button.disabled = true;
    setPanelStatus(status, 'Menyediakan peta pilihan Lot Kadaster...', 'checking');
    try {
      const prepared = await window.azobssOpenLotSelectionMap({
        productCode,
        stateCode,
        stateName,
        getAuthToken: async () => auth && auth.currentUser ? auth.currentUser.getIdToken() : ''
      });
      const item = await addToStoreCart({
        productType: prepared.productType,
        itemCode: prepared.jobId,
        negeri: prepared.negeri || stateName,
        variant: prepared.variant,
        amount: prepared.amount,
        productId: prepared.jobId,
        downloadUrl: prepared.downloadUrl,
        filename: prepared.filename,
        selectionToken: prepared.selectionToken
      });
      const confirmationMessage = item.__azobssAlreadyInCart
        ? 'Pilihan Lot Kadaster ini sudah ada dalam troli anda.'
        : `Berjaya: ${prepared.lotCount.toLocaleString('ms-MY')} lot telah dimasukkan ke Troli AZOBSS pada harga RM${prepared.amount}.`;
      setPanelStatus(status, confirmationMessage, 'success');
      setCartSyncStatus(confirmationMessage);
      if (typeof window.azShowToast === 'function') window.azShowToast(confirmationMessage);
      const cartPanel = document.getElementById('pabmStoreCartPanel');
      if (cartPanel) {
        cartPanel.classList.remove('is-cart-updated');
        window.requestAnimationFrame(() => cartPanel.classList.add('is-cart-updated'));
        window.setTimeout(() => cartPanel.classList.remove('is-cart-updated'), 1800);
      }
    } catch (mapError) {
      if (mapError && mapError.code !== 'MAP_CLOSED') {
        setPanelStatus(status, mapError.message || 'Peta pilihan tidak dapat dibuka.', 'unavailable');
      }
    } finally {
      button.disabled = false;
    }
    return;
  }

  setPanelStatus(status, 'Membuka peta pilihan JUPEM...', 'checking');
  const params = new URLSearchParams({
    type: `${stateCode}lot${productCode === '2' ? 'C3' : ''}`,
    c: 'pl',
    jenis: 'Lot',
    produk: productCode,
    neg: stateCode
  });
  const popup = window.open(
    `https://ebiz.jupem.gov.my/PetaInteraktif?${params.toString()}`,
    'azobssJupemLotSelection',
    'popup=yes,width=1200,height=800,resizable=yes,scrollbars=yes'
  );
  if (!popup) {
    setPanelStatus(status, 'Allow popups for AZOBSS, then open the selection map again.', 'unavailable');
    return;
  }
  try { popup.focus(); } catch (_) {}
  setPanelStatus(status, 'Peta JUPEM dibuka. Sesi JUPEM sedia ada akan digunakan.', 'success');
}

function checkoutPayload(items) {
  const user = savedUser() || {};
  return {
    usernameKey: String(user.usernameKey || user.username || user.displayName || '').trim().toLowerCase(),
    uid: String(user.uid || (auth && auth.currentUser && auth.currentUser.uid) || ''),
    user,
    items: items.map((item) => ({
      productType: item.productType,
      itemCode: item.itemCode,
      negeri: item.negeri,
      amount: item.amount,
      productId: item.productId,
      stationNo: item.stationNo,
      jenis: item.jenis,
      downloadUrl: item.downloadUrl,
      filename: item.filename,
      selectionToken: item.selectionToken,
      variant: item.variant,
      createdAtMs: item.addedAtMs
    }))
  };
}

async function ensureCheckoutBackend(items) {
  let response;
  try {
    response = await fetch(`${BACKEND_BASE}/api/pa-bm-checkout-capabilities?_=${Date.now()}`, { cache: 'no-store' });
  } catch (_) {
    throw new Error('Perkhidmatan pembayaran tidak tersedia buat sementara waktu. Sila cuba sebentar lagi.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || Number(data.version || 0) < CHECKOUT_API_VERSION) {
    throw new Error('Perkhidmatan pembayaran sedang dikemas kini. Tiada pembayaran dibuat. Sila cuba sebentar lagi.');
  }
  const supported = new Set(Array.isArray(data.productTypes) ? data.productTypes.map((type) => String(type || '').toUpperCase()) : []);
  const missing = items.map((item) => item.productType).filter((type) => !supported.has(String(type || '').toUpperCase()));
  if (missing.length) throw new Error(`Perkhidmatan pembayaran tidak menyokong: ${Array.from(new Set(missing)).join(', ')}.`);
  return data;
}

function assertCheckoutResponse(data, items) {
  const expectedAmountSen = Math.round(cartTotal(items) * 100);
  const receivedAmountSen = Number(data.amountSen || 0) || Math.round(Number(data.amount || 0) * 100);
  const receivedUnits = Number(data.unit || 0);
  if (receivedAmountSen !== expectedAmountSen || receivedUnits !== items.length) {
    throw new Error(`Jumlah pembayaran tidak sepadan. Jumlah sepatutnya ${formatMoney(expectedAmountSen / 100)} untuk ${items.length} item. Tiada pengalihan dibuat.`);
  }
}

async function proceedToPayment() {
  if (!requireLogin()) return;
  const items = readCart();
  if (!items.length) return;
  const status = document.getElementById('paBmToyyibStatus');
  const oldText = paymentButton ? paymentButton.textContent : '';
  try {
    if (!auth || !auth.currentUser) throw new Error('Sesi log masuk anda belum tersedia. Sila log masuk semula.');
    if (paymentButton) {
      paymentButton.disabled = true;
      paymentButton.textContent = 'Menyediakan Pembayaran...';
    }
    if (status) status.textContent = 'Menyemak troli dan menyediakan bil pembayaran selamat...';
    await ensureCheckoutBackend(items);
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_BASE}/api/toyyib/create-pa-bm-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(checkoutPayload(items))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Bil pembayaran tidak dapat dibuat.');
    assertCheckoutResponse(data, items);
    if (data.orderId) sessionStorage.setItem('azobss_pa_bm_pending_order_id', String(data.orderId));
    if (data.billCode) sessionStorage.setItem('azobss_pa_bm_pending_bill_code', String(data.billCode));
    if (status) status.textContent = 'Sedang pergi ke ToyyibPay...';
    window.location.href = data.paymentUrl || data.url || data.redirectUrl;
  } catch (error) {
    if (status) status.textContent = error.message || 'Bil pembayaran tidak dapat dibuat.';
    alert(error.message || 'Bil pembayaran tidak dapat dibuat.');
  } finally {
    if (paymentButton) {
      paymentButton.disabled = false;
      paymentButton.textContent = oldText || 'Teruskan Pembayaran';
      renderCart();
    }
  }
}

async function proceedAdminTestPayment() {
  if (!requireLogin()) return;
  const items = readCart();
  if (!items.length) return;
  const status = document.getElementById('paBmToyyibStatus');
  const oldText = adminTestPaymentButton ? adminTestPaymentButton.textContent : '';
  try {
    if (!auth || !auth.currentUser) throw new Error('Your admin login session is not ready. Please login again.');
    if (adminTestPaymentButton) {
      adminTestPaymentButton.disabled = true;
      adminTestPaymentButton.textContent = 'Creating Test Payment...';
    }
    if (status) status.textContent = 'Creating an admin-only paid test order...';
    const sendTestPayment = async (forceTokenRefresh = false) => {
      const token = await auth.currentUser.getIdToken(forceTokenRefresh);
      return fetch(`${BACKEND_BASE}/api/admin/test-pa-bm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(checkoutPayload(items))
      });
    };
    let response = await sendTestPayment(false);
    if (response.status === 401 || response.status === 403) response = await sendTestPayment(true);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok || !data.paid) throw new Error(data.error || 'Unable to complete the admin test payment.');
    assertCheckoutResponse(data, items);
    localStorage.removeItem(cartKey());
    renderCart();
    if (data.orderId) sessionStorage.setItem('azobss_pa_bm_pending_order_id', String(data.orderId));
    sessionStorage.removeItem('azobss_pa_bm_pending_bill_code');
    if (status) status.textContent = 'Admin test payment successful. Refreshing Latest Purchase List...';
    if (typeof window.azobssRenderPurchaseRecords === 'function') {
      await window.azobssRenderPurchaseRecords();
    } else if (typeof window.azobssRefreshPaBmPurchasesNow === 'function') {
      window.azobssRefreshPaBmPurchasesNow();
    }
    const latestPurchase = document.getElementById('userPaPurchasePanel') || document.getElementById('purchaseSummaryList');
    if (latestPurchase) latestPurchase.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (status) {
      const seconds = Number(data.processingMs || 0) > 0 ? ` in ${(Number(data.processingMs) / 1000).toFixed(1)}s` : '';
      status.textContent = `Admin test payment successful${seconds}. Latest Purchase List is ready.`;
    }
  } catch (error) {
    if (status) status.textContent = error.message || 'Unable to complete the admin test payment.';
    alert(error.message || 'Unable to complete the admin test payment.');
  } finally {
    if (adminTestPaymentButton) {
      adminTestPaymentButton.disabled = false;
      adminTestPaymentButton.textContent = oldText || 'Test Payment (Admin)';
      renderCart();
    }
  }
}

function bindPaymentButton() {
  const current = document.getElementById('payPaBmToyyibButton');
  if (!current) return;
  const clone = current.cloneNode(true);
  current.replaceWith(clone);
  paymentButton = clone;
  paymentButton.addEventListener('click', proceedToPayment);
}

function bindAdminTestPaymentButton() {
  const current = document.getElementById('adminTestPaBmPaymentButton');
  if (!current) return;
  const clone = current.cloneNode(true);
  current.replaceWith(clone);
  adminTestPaymentButton = clone;
  adminTestPaymentButton.addEventListener('click', proceedAdminTestPayment);
}

async function clearCartAfterPaidReturn() {
  const params = new URLSearchParams(window.location.search || '');
  const orderId = params.get('orderId') || params.get('order_id') || sessionStorage.getItem('azobss_pa_bm_pending_order_id') || '';
  const billCode = params.get('billCode') || params.get('billcode') || sessionStorage.getItem('azobss_pa_bm_pending_bill_code') || '';
  if (!orderId && !billCode) return;
  try {
    const response = await fetch('https://azobss-backend.onrender.com/api/verify-payment?orderId=' + encodeURIComponent(orderId) + '&billCode=' + encodeURIComponent(billCode), { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (data && (data.paid || data.status === 'paid' || data.status === 'success')) {
      localStorage.removeItem(cartKey());
      renderCart();
    }
  } catch (_) {}
}

function watchPaymentTotal() {
  const total = document.getElementById('paBmToyyibTotal');
  if (!total || !window.MutationObserver) return;
  if (totalObserver) totalObserver.disconnect();
  totalObserver = new MutationObserver(() => {
    const expected = formatMoney(cartTotal());
    if (total.textContent !== expected) total.textContent = expected;
  });
  totalObserver.observe(total, { childList: true, characterData: true, subtree: true });
}

function init() {
  const apps = getApps();
  auth = apps.length ? getAuth(apps[0]) : null;
  document.body.classList.add('pabm-store-ready');
  watchTableCartButtons();
  hydrateStateSelects();
  document.querySelectorAll('[data-state-picker-for]').forEach(setupStatePicker);
  document.querySelectorAll('[data-product-picker-for]').forEach(setupProductPicker);
  document.querySelectorAll('[data-pabm-product-add]').forEach((button) => {
    updateConfiguredPrice(button);
    const variant = document.getElementById(button.dataset.variantId || '');
    if (variant) variant.addEventListener('change', () => updateConfiguredPrice(button));
  });
  bindPaymentButton();
  bindAdminTestPaymentButton();
  window.azobssRecordPurchase = addToStoreCart;
  window.azobssPaBmStoreCart = { read: readCart, add: addToStoreCart, clear: () => writeCart([]), render: renderCart };
  document.addEventListener('click', guardCartAction, true);
  document.addEventListener('click', toggleTableCartButton, true);
  document.addEventListener('click', async (event) => {
    const mapButton = event.target.closest('[data-jupem-lot-map]');
    if (mapButton) {
      event.preventDefault();
      openJupemLotMap(mapButton);
      return;
    }
    const addButton = event.target.closest('[data-pabm-product-add]');
    if (addButton) {
      event.preventDefault();
      addConfiguredProduct(addButton);
      return;
    }
    const button = event.target.closest('[data-pabm-remove]');
    if (!button) return;
    const items = readCart();
    const index = Number(button.dataset.pabmRemove);
    const removedItem = items[index];
    if (!removedItem) return;
    items.splice(index, 1);
    writeCart(items);
    setCartSyncStatus('Sedang membuang rekod Pending Payment...');
    try {
      const removedCount = await removePendingPurchaseItems(items.length ? removedItem : { all: true });
      setCartSyncStatus(removedCount
        ? 'Item dan rekod Pending Payment telah dibuang.'
        : 'Item telah dibuang daripada troli.');
    } catch (error) {
      setCartSyncStatus(error.message || 'Troli telah dikemas kini, tetapi rekod pembelian belum dapat disegerakkan.');
    }
  });
  window.addEventListener('storage', renderCart);
  window.addEventListener('azobss:pabm-cart-updated', renderCart);
  watchPaymentTotal();
  renderCart();
  if (auth) onAuthStateChanged(auth, (user) => {
    renderCart();
    if (user) setTimeout(() => reconcileEmptyStoredCart().catch(() => {}), 500);
  });
  [1500, 4000].forEach((delay) => setTimeout(() => reconcileEmptyStoredCart().catch(() => {}), delay));
  [1200, 3500, 7000].forEach((delay) => setTimeout(clearCartAfterPaidReturn, delay));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
