import { getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';

const CART_PREFIX = 'azobss_pabm_store_cart_v1_';
const BACKEND_BASE = 'https://azobss-backend.onrender.com';
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
  FULL_SHEET: '1 Sheet Area',
  QUARTER_SHEET: '1/4 Sheet Area'
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
  if (message) message.textContent = 'Please login before adding an item to your cart.';
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
  const raw = String(value || '').trim().toUpperCase();
  if (type === 'PA') return raw.replace(/^PA/i, '').replace(/\.TIF$/i, '').replace(/[^0-9]/g, '');
  return raw.replace(/\s+/g, ' ');
}

function normalizeVariant(value, type) {
  if (type !== 'NDCDB' && type !== 'NDCDB_C3') return '';
  const variant = String(value || '').trim().toUpperCase();
  if (variant !== 'FULL_SHEET' && variant !== 'QUARTER_SHEET') {
    throw new Error('Select either 1 sheet area or 1/4 sheet area.');
  }
  return variant;
}

function productPrice(type, variant = '') {
  if (type === 'PA') return 5;
  if (type === 'BM' || type === 'SBM') return 3;
  if (type === 'GPS') return 9;
  if (type === 'SYIT_PIAWAI') return 7;
  if (type === 'NDCDB' || type === 'NDCDB_C3') return variant === 'QUARTER_SHEET' ? 15 : 50;
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
    amount: productPrice(type, variant),
    productId: String(payload && (payload.productId || payload.id) || '').trim(),
    stationNo: String(payload && (payload.stationNo || payload.stesen) || '').trim().toUpperCase(),
    jenis: String(payload && payload.jenis || (type === 'SBM' ? '2' : '1')) === '2' ? '2' : '1',
    downloadUrl: String(payload && (payload.downloadUrl || payload.url) || '').trim(),
    filename: String(payload && payload.filename || '').trim(),
    addedAtMs: Date.now()
  };
}

function readCart() {
  try {
    const rows = JSON.parse(localStorage.getItem(cartKey()) || '[]');
    const now = Date.now();
    return Array.isArray(rows)
      ? rows.filter((item) => item && now - Number(item.addedAtMs || now) <= CART_MAX_AGE_MS).slice(0, MAX_CART_ITEMS)
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

  if (count) count.textContent = items.length + (items.length === 1 ? ' item' : ' items');
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
          <button class="pabm-cart-remove" type="button" data-pabm-remove="${index}" aria-label="Remove ${escapeHtml(item.productType)} ${escapeHtml(item.itemCode)}" title="Remove">&times;</button>
        </div>
      </div>`).join('') : '<div class="pabm-cart-empty">Your cart is empty.</div>';
  }

  if (paymentButton) {
    const loggedIn = !!(auth && auth.currentUser);
    paymentButton.disabled = !items.length;
    paymentButton.textContent = loggedIn ? 'Proceed to Payment' : 'Login to Checkout';
    if (!items.length) paymentButton.textContent = 'Cart is Empty';
  }
  if (adminTestPaymentButton) {
    const loggedIn = !!(auth && auth.currentUser);
    adminTestPaymentButton.disabled = !items.length || !loggedIn;
    adminTestPaymentButton.textContent = items.length ? 'Test Payment (Admin)' : 'Test Payment (Empty Cart)';
  }
}

async function addToStoreCart(payload) {
  if (!requireLogin()) throw new Error('Please login before adding an item to your cart.');
  const item = normalizeItem(payload || {});
  const items = readCart();
  const exists = items.some((row) => row.id === item.id);
  if (!exists) {
    if (items.length >= MAX_CART_ITEMS) throw new Error('Cart limit reached. Remove an item before adding another.');
    items.push(item);
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
      ? 'This document is already in your cart.'
      : `${PRODUCT_LABELS[item.productType] || item.productType} added to your cart.`, 'success');
  } catch (addError) {
    if (error) error.textContent = addError.message || 'Unable to add this document to your cart.';
    setPanelStatus(status, addError.message || 'Unable to add this document to your cart.', 'unavailable');
  } finally {
    button.disabled = false;
    updateConfiguredPrice(button);
  }
}

function openJupemLotMap(button) {
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
    setPanelStatus(status, 'Select a state before opening the selection map.', 'unavailable');
    return;
  }
  setPanelStatus(status, 'Opening JUPEM selection map...', 'checking');
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
  setPanelStatus(status, 'JUPEM selection map opened successfully. Your existing JUPEM session will be reused.', 'success');
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
    throw new Error('Payment service is temporarily unavailable. Please try again shortly.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok || Number(data.version || 0) < CHECKOUT_API_VERSION) {
    throw new Error('Payment service is being updated. No payment was created. Please try again shortly.');
  }
  const supported = new Set(Array.isArray(data.productTypes) ? data.productTypes.map((type) => String(type || '').toUpperCase()) : []);
  const missing = items.map((item) => item.productType).filter((type) => !supported.has(String(type || '').toUpperCase()));
  if (missing.length) throw new Error(`Payment service does not support: ${Array.from(new Set(missing)).join(', ')}.`);
  return data;
}

function assertCheckoutResponse(data, items) {
  const expectedAmountSen = Math.round(cartTotal(items) * 100);
  const receivedAmountSen = Number(data.amountSen || 0) || Math.round(Number(data.amount || 0) * 100);
  const receivedUnits = Number(data.unit || 0);
  if (receivedAmountSen !== expectedAmountSen || receivedUnits !== items.length) {
    throw new Error(`Payment total mismatch. Expected ${formatMoney(expectedAmountSen / 100)} for ${items.length} items. No redirect was made.`);
  }
}

async function proceedToPayment() {
  if (!requireLogin()) return;
  const items = readCart();
  if (!items.length) return;
  const status = document.getElementById('paBmToyyibStatus');
  const oldText = paymentButton ? paymentButton.textContent : '';
  try {
    if (!auth || !auth.currentUser) throw new Error('Your login session is not ready. Please login again.');
    if (paymentButton) {
      paymentButton.disabled = true;
      paymentButton.textContent = 'Preparing Payment...';
    }
    if (status) status.textContent = 'Verifying cart and creating a secure payment bill...';
    await ensureCheckoutBackend(items);
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(`${BACKEND_BASE}/api/toyyib/create-pa-bm-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(checkoutPayload(items))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to create the payment bill.');
    assertCheckoutResponse(data, items);
    if (data.orderId) sessionStorage.setItem('azobss_pa_bm_pending_order_id', String(data.orderId));
    if (data.billCode) sessionStorage.setItem('azobss_pa_bm_pending_bill_code', String(data.billCode));
    if (status) status.textContent = 'Redirecting to ToyyibPay...';
    window.location.href = data.paymentUrl || data.url || data.redirectUrl;
  } catch (error) {
    if (status) status.textContent = error.message || 'Unable to create the payment bill.';
    alert(error.message || 'Unable to create the payment bill.');
  } finally {
    if (paymentButton) {
      paymentButton.disabled = false;
      paymentButton.textContent = oldText || 'Proceed to Payment';
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
  document.addEventListener('click', (event) => {
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
    items.splice(Number(button.dataset.pabmRemove), 1);
    writeCart(items);
  });
  window.addEventListener('storage', renderCart);
  window.addEventListener('azobss:pabm-cart-updated', renderCart);
  watchPaymentTotal();
  renderCart();
  if (auth) onAuthStateChanged(auth, () => renderCart());
  [1200, 3500, 7000].forEach((delay) => setTimeout(clearCartAfterPaidReturn, delay));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
