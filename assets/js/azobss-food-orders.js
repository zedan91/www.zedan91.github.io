import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy,
  limit, onSnapshot, setDoc, updateDoc, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
  authDomain: 'azobss.firebaseapp.com',
  projectId: 'azobss',
  storageBucket: 'azobss.firebasestorage.app',
  messagingSenderId: '159277716405',
  appId: '1:159277716405:web:17d8924b6b6380e2b77ffc'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const COLLECTION = 'foodOrders';
const ADMIN_EMAILS = new Set(['zedan91@azobss.local', 'zedan9107@gmail.com']);
const ALLOWED_ROLES = new Set(['admin', 'staff', 'semiadmin', 'semi-admin', 'semi_admin']);

let allOrders = [];
let filteredOrders = [];
const PAGE_SIZE = 5;
let currentPage = 1;
let unsubscribeOrders = null;
let currentAccess = { allowed: false, role: 'none', user: null, profile: null };
const selectedOrderIds = new Set();

const el = id => document.getElementById(id);
const panel = el('foodOrdersAdminPanel');
const tbody = el('foodOrdersTableBody');
const searchInput = el('foodOrdersSearchInput');
const statusFilter = el('foodOrdersStatusFilter');
const errorBox = el('foodOrdersError');
const liveStatus = el('foodOrdersLiveStatus');
const countLabel = el('foodOrdersVisibleCount');
const roleBadge = el('foodOrdersRoleBadge');
const detailModal = el('foodOrderDetailModal');
const detailContent = el('foodOrderDetailContent');
const selectAllCheckbox = el('foodOrdersSelectAll');
const selectionBar = el('foodOrdersSelectionBar');
const selectedCount = el('foodOrdersSelectedCount');
const completeSelectedButton = el('foodOrdersCompleteSelectedBtn');
const deleteSelectedButton = el('foodOrdersDeleteSelectedBtn');
const pagination = el('foodOrdersPagination');
const paginationSummary = el('foodOrdersPaginationSummary');
const paginationPages = el('foodOrdersPaginationPages');
const paginationPrev = el('foodOrdersPaginationPrev');
const paginationNext = el('foodOrdersPaginationNext');
const customerNameInput = el('customerName');
const customerPhoneInput = el('customerPhone');

let lastCustomerAutofillIdentity = '';

function clean(value){
  return String(value ?? '').trim();
}

function lower(value){
  return clean(value).toLowerCase();
}

function phoneDigits(value){
  return clean(value).replace(/\D/g, '');
}

function phoneSearchText(value){
  const digits = phoneDigits(value);
  if(!digits) return '';
  const variants = new Set([digits]);
  if(digits.startsWith('60') && digits.length > 2) variants.add(`0${digits.slice(2)}`);
  if(digits.startsWith('0') && digits.length > 1) variants.add(`60${digits.slice(1)}`);
  return [...variants].join(' ');
}

function escapeHtml(value){
  return clean(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[char]);
}

function money(value){
  const amount = Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  return `RM${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function orderStatusLabel(status){
  return ({
    new: 'Baharu',
    contacted: 'Dihubungi',
    confirmed: 'Disahkan',
    completed: 'Selesai',
    cancelled: 'Dibatalkan'
  })[status] || 'Baharu';
}

function formatDateTime(value, fallbackMs){
  let date = null;
  if(value && typeof value.toDate === 'function') date = value.toDate();
  else if(value instanceof Date) date = value;
  else if(fallbackMs) date = new Date(Number(fallbackMs));
  if(!date || Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ms-MY', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit'
  }).format(date);
}

function toast(message, type = ''){
  document.querySelectorAll('.food-order-toast').forEach(node => node.remove());
  const node = document.createElement('div');
  node.className = `food-order-toast ${type}`.trim();
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function generateOrderId(){
  if(globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'){
    return `FOOD-${globalThis.crypto.randomUUID()}`;
  }
  return `FOOD-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

async function waitForAuthReady(){
  try{
    if(typeof auth.authStateReady === 'function') await auth.authStateReady();
  }catch(error){
    console.warn('[AZOBSS Food Orders] Auth readiness check skipped:', error);
  }
}

function isPermissionError(error){
  const code = clean(error?.code).toLowerCase();
  return code.includes('permission-denied') || code.includes('unauthenticated');
}

async function saveOrderRecord(orderRef, record){
  let lastError = null;
  for(let attempt = 1; attempt <= 2; attempt += 1){
    try{
      await setDoc(orderRef, record);
      return;
    }catch(error){
      lastError = error;
      if(isPermissionError(error)) break;
      if(attempt < 2) await new Promise(resolve => setTimeout(resolve, 650));
    }
  }
  throw lastError || new Error('Rekod tempahan gagal disimpan.');
}

async function saveOrderRecordCompatible(orderRef, record){
  try{
    await saveOrderRecord(orderRef, record);
    return { compatibilityMode:false };
  }catch(error){
    if(!isPermissionError(error)) throw error;

    // Rules lama (versi 640/645) belum membenarkan dua field telefon khusus.
    // Cuba semula menggunakan struktur lama. Nombor telefon masih selamat
    // berada dalam whatsappMessage dan akan diterbitkan semula ketika rekod dibaca.
    const legacyRecord = { ...record };
    delete legacyRecord.customerPhone;
    delete legacyRecord.customerPhoneDigits;
    await saveOrderRecord(orderRef, legacyRecord);
    return { compatibilityMode:true };
  }
}

function extractPhoneFromWhatsappMessage(message){
  const text = clean(message);
  if(!text) return '';
  const match = text.match(/(?:No\.?\s*telefon|Nombor\s*telefon|Telefon|No\.?\s*HP)\s*:\s*([+0-9][+0-9() \t-]{7,24})/i);
  return match ? clean(match[1]) : '';
}

function normalizeLoadedOrder(order){
  const phone = firstFilled(order?.customerPhone, extractPhoneFromWhatsappMessage(order?.whatsappMessage));
  return {
    ...order,
    customerPhone: phone,
    customerPhoneDigits: firstFilled(order?.customerPhoneDigits, phoneDigits(phone))
  };
}

async function submitOrder(payload, whatsappUrl, submitButton){
  const popup = window.open('', '_blank');
  if(popup){
    try{
      popup.document.title = 'Menyimpan Rekod Tempahan';
      popup.document.body.style.cssText = 'margin:0;display:grid;place-items:center;min-height:100vh;background:#07101f;color:#fff;font:700 16px Arial;text-align:center;padding:24px';
      popup.document.body.textContent = 'Sila tunggu. Rekod tempahan sedang disimpan sebelum WhatsApp dibuka...';
    }catch(_){}
  }

  const originalText = submitButton?.textContent || '';
  if(submitButton){
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan rekod...';
  }

  await waitForAuthReady();

  const clientOrderId = generateOrderId();
  const user = auth.currentUser;
  const record = {
    clientOrderId,
    customerName: clean(payload.customerName).slice(0, 100),
    customerPhone: clean(payload.customerPhone).slice(0, 20),
    customerPhoneDigits: phoneDigits(payload.customerPhone).slice(0, 15),
    requiredDate: clean(payload.requiredDate).slice(0, 20),
    requiredDateLabel: clean(payload.requiredDateLabel).slice(0, 120),
    notes: clean(payload.notes).slice(0, 800),
    items: Array.isArray(payload.items) ? payload.items.slice(0, 30).map(item => ({
      category: clean(item.category).slice(0, 100),
      product: clean(item.product).slice(0, 160),
      price: Number(item.price || 0),
      qty: Number(item.qty || 0),
      subtotal: Number(item.subtotal || 0)
    })) : [],
    totalBoxes: Number(payload.totalBoxes || 0),
    totalPrice: Number(payload.totalPrice || 0),
    whatsappMessage: clean(payload.whatsappMessage).slice(0, 5000),
    whatsappNumber: '60178809488',
    status: 'new',
    source: 'whatsapp',
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    createdByUid: user?.uid || '',
    createdByEmail: lower(user?.email || '')
  };

  let saved = false;
  try{
    const saveResult = await saveOrderRecordCompatible(doc(db, COLLECTION, clientOrderId), record);
    saved = true;
    if(saveResult.compatibilityMode){
      console.info('[AZOBSS Food Orders] Saved using legacy Firebase Rules compatibility mode.');
    }
    toast('Rekod tempahan berjaya disimpan. WhatsApp sedang dibuka.', 'success');

    try{
      if(popup && !popup.closed) popup.location.replace(whatsappUrl);
      else window.location.href = whatsappUrl;
    }catch(_){
      window.location.href = whatsappUrl;
    }
  }catch(error){
    console.error('[AZOBSS Food Orders] Save failed:', error);
    try{ if(popup && !popup.closed) popup.close(); }catch(_){}

    const code = clean(error?.code).toLowerCase();
    const detail = code.includes('permission-denied')
      ? ' Akses Firestore masih ditolak walaupun mod keserasian telah dicuba.'
      : '';
    toast(`Rekod gagal disimpan. WhatsApp tidak dibuka supaya tempahan tidak tercicir.${detail}`, 'warning');
  }finally{
    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'Tempah melalui WhatsApp';
    }
  }

  return { saved, clientOrderId };
}
window.AZOBSSFoodOrders = Object.freeze({ submitOrder });

function firstFilled(...values){
  for(const value of values){
    const text = clean(value);
    if(text) return text;
  }
  return '';
}

function savedLoginProfile(){
  try{
    if(typeof window.getSavedUser === 'function'){
      const saved = window.getSavedUser();
      if(saved && typeof saved === 'object') return saved;
    }
  }catch(_){}
  return parseStoredProfiles()[0] || null;
}

async function loadCustomerProfile(user, saved){
  if(user){
    const profile = await loadUserProfile(user);
    if(profile) return profile;
  }

  const usernameKey = lower(
    saved?.usernameKey || saved?.username || saved?.displayName || saved?.name
  );
  if(usernameKey){
    try{
      const direct = await getDoc(doc(db, 'users', usernameKey));
      if(direct.exists()) return { id:direct.id, ...direct.data() };
    }catch(_){}
  }

  return null;
}

function fillCustomerInput(input, value){
  if(!input || clean(input.value) || !clean(value)) return false;
  input.value = clean(value);
  input.dispatchEvent(new Event('input', { bubbles:true }));
  input.dispatchEvent(new Event('change', { bubbles:true }));
  return true;
}

async function autofillLoggedInCustomer(user = auth.currentUser){
  if(!customerNameInput && !customerPhoneInput) return;

  const saved = savedLoginProfile();
  if(!user && !saved) return;

  const identity = firstFilled(
    user?.uid,
    saved?.uid,
    saved?.usernameKey,
    saved?.username,
    saved?.email
  );
  if(identity && identity === lastCustomerAutofillIdentity
    && clean(customerNameInput?.value) && clean(customerPhoneInput?.value)) return;

  const profile = await loadCustomerProfile(user, saved);
  const name = firstFilled(
    profile?.fullName,
    profile?.customerName,
    profile?.name,
    profile?.displayName,
    profile?.username,
    profile?.usernameKey,
    saved?.fullName,
    saved?.name,
    saved?.displayName,
    saved?.username,
    saved?.usernameKey,
    user?.displayName,
    user?.email ? String(user.email).split('@')[0] : ''
  );
  const phone = firstFilled(
    profile?.phone,
    profile?.phoneNumber,
    profile?.whatsapp,
    profile?.whatsApp,
    profile?.whatsappNumber,
    profile?.mobile,
    profile?.mobileNumber,
    saved?.phone,
    saved?.phoneNumber,
    saved?.whatsapp,
    saved?.whatsApp,
    saved?.whatsappNumber,
    saved?.mobile,
    saved?.mobileNumber
  );

  fillCustomerInput(customerNameInput, name);
  fillCustomerInput(customerPhoneInput, phone);
  if(identity) lastCustomerAutofillIdentity = identity;
}

function scheduleCustomerAutofill(){
  autofillLoggedInCustomer(auth.currentUser).catch(error => {
    console.warn('[AZOBSS Food Orders] Customer autofill skipped:', error);
  });
}

window.addEventListener('azobss-auth-changed', scheduleCustomerAutofill);
window.addEventListener('storage', scheduleCustomerAutofill);
window.addEventListener('focus', scheduleCustomerAutofill);
setTimeout(scheduleCustomerAutofill, 250);
setTimeout(scheduleCustomerAutofill, 1200);
setTimeout(scheduleCustomerAutofill, 3000);

function parseStoredProfiles(){
  const profiles = [];
  const keys = [
    'azobssCurrentUser','azobssUser','azobss_user','azobss_current_user',
    'azobssSavedUser','azobss_user_profile','azobssProfile','currentUser',
    'userProfile','azobss_auth_user','azobssLoginUser','azobss_logged_user'
  ];
  keys.forEach(key => {
    try{
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if(!raw) return;
      const value = JSON.parse(raw);
      if(value && typeof value === 'object') profiles.push(value);
    }catch(_){}
  });
  return profiles;
}

function roleFromProfile(profile){
  const role = lower(
    profile?.role || profile?.userRole || profile?.accountRole ||
    profile?.type || profile?.accessRole
  );
  const permissions = profile?.permissions || {};
  if(ALLOWED_ROLES.has(role)) return role === 'admin' ? 'admin' : (role.includes('semi') ? 'semi-admin' : 'staff');
  if(
    profile?.isAdmin === true || profile?.admin === true || profile?.owner === true
  ) return 'admin';
  if(
    profile?.isStaff === true || profile?.staff === true ||
    profile?.staffDashboard === true ||
    permissions?.canAccessStaffDashboard === true ||
    permissions?.canViewPayments === true
  ) return 'staff';
  return 'none';
}

async function loadUserProfile(user){
  if(!user) return null;

  try{
    const direct = await getDoc(doc(db, 'users', user.uid));
    if(direct.exists()) return { id: direct.id, ...direct.data() };
  }catch(_){}

  try{
    const byUid = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid), limit(1)));
    if(!byUid.empty){
      const snap = byUid.docs[0];
      return { id: snap.id, ...snap.data() };
    }
  }catch(_){}

  return null;
}

async function resolveAccess(user){
  if(!user) return { allowed:false, role:'none', user:null, profile:null };

  const email = lower(user.email);
  if(ADMIN_EMAILS.has(email)){
    return { allowed:true, role:'admin', user, profile:null };
  }

  // AZOBSS 671: bukan semua staff/semi-admin boleh membaca rekod.
  // Akses mesti diberikan secara khusus oleh admin melalui
  // foodOrderStaffAccess/{Firebase Auth UID}.
  let accessDocument = null;
  try{
    const accessSnap = await getDoc(doc(db, 'foodOrderStaffAccess', user.uid));
    if(accessSnap.exists()) accessDocument = accessSnap.data();
  }catch(error){
    console.warn('[AZOBSS Food Orders] Explicit access lookup failed:', error);
  }

  const allowed = accessDocument?.active === true
    && accessDocument?.canViewFoodOrders === true;
  if(!allowed){
    return { allowed:false, role:'none', user, profile:null };
  }

  const profile = await loadUserProfile(user);
  const profileRole = roleFromProfile(profile);
  const role = profileRole === 'semi-admin'
    ? 'semi-admin'
    : (profileRole === 'staff' ? 'staff' : 'allowed');
  return { allowed:true, role, user, profile, accessDocument };
}

function itemSummary(order){
  const items = Array.isArray(order.items) ? order.items : [];
  if(!items.length) return '-';
  return items.map(item => `${item.category} — ${item.product} × ${item.qty}`).join('; ');
}

function searchableText(order){
  return lower([
    order.clientOrderId, order.customerName, order.customerPhone,
    order.customerPhoneDigits, phoneSearchText(order.customerPhone || order.customerPhoneDigits),
    order.requiredDate, order.requiredDateLabel, order.notes, order.status, itemSummary(order)
  ].join(' '));
}

function totalPageCount(){
  return Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
}

function currentPageOrders(){
  const start = (currentPage - 1) * PAGE_SIZE;
  return filteredOrders.slice(start, start + PAGE_SIZE);
}

function applyFilters(resetPage = false){
  const term = lower(searchInput?.value || '');
  const termDigits = phoneDigits(term);
  const wantedStatus = statusFilter?.value || 'all';

  filteredOrders = allOrders.filter(order => {
    const haystack = searchableText(order);
    const phoneMatches = termDigits.length >= 3 && phoneSearchText(order.customerPhone || order.customerPhoneDigits).includes(termDigits);
    const matchesSearch = !term || haystack.includes(term) || phoneMatches;
    const matchesStatus = wantedStatus === 'all' || (order.status || 'new') === wantedStatus;
    return matchesSearch && matchesStatus;
  });

  if(resetPage) currentPage = 1;
  currentPage = Math.min(Math.max(1, currentPage), totalPageCount());
  renderTable();
}

function visibleOrderIds(){
  return currentPageOrders()
    .map(order => order.id || order.clientOrderId)
    .filter(Boolean);
}

function paginationTokens(totalPages, activePage){
  if(totalPages <= 7) return Array.from({ length:totalPages }, (_, index) => index + 1);
  const tokens = [1];
  const start = Math.max(2, activePage - 1);
  const end = Math.min(totalPages - 1, activePage + 1);
  if(start > 2) tokens.push('ellipsis-left');
  for(let page = start; page <= end; page += 1) tokens.push(page);
  if(end < totalPages - 1) tokens.push('ellipsis-right');
  tokens.push(totalPages);
  return tokens;
}

function renderPagination(){
  if(!pagination) return;

  const totalRecords = filteredOrders.length;
  const totalPages = totalPageCount();
  const start = totalRecords ? ((currentPage - 1) * PAGE_SIZE) + 1 : 0;
  const end = totalRecords ? Math.min(currentPage * PAGE_SIZE, totalRecords) : 0;

  pagination.hidden = totalRecords === 0;
  if(paginationSummary){
    paginationSummary.textContent = totalRecords
      ? `Memaparkan ${start}–${end} daripada ${totalRecords} rekod`
      : 'Tiada rekod';
  }
  if(paginationPrev) paginationPrev.disabled = currentPage <= 1;
  if(paginationNext) paginationNext.disabled = currentPage >= totalPages;

  if(paginationPages){
    paginationPages.innerHTML = paginationTokens(totalPages, currentPage).map(token => {
      if(typeof token !== 'number') return '<span class="food-orders-page-ellipsis" aria-hidden="true">…</span>';
      return `<button class="food-orders-page-number ${token === currentPage ? 'is-active' : ''}" data-food-orders-page="${token}" type="button" ${token === currentPage ? 'aria-current="page"' : ''}>${token}</button>`;
    }).join('');
  }
}

function syncSelectionControls(){
  const visibleIds = visibleOrderIds();
  const selectedVisible = visibleIds.filter(id => selectedOrderIds.has(id));
  const totalSelected = selectedOrderIds.size;

  if(selectAllCheckbox){
    selectAllCheckbox.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
    selectAllCheckbox.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    selectAllCheckbox.disabled = visibleIds.length === 0;
  }

  if(selectedCount) selectedCount.textContent = `${totalSelected} rekod dipilih`;
  if(selectionBar) selectionBar.hidden = totalSelected === 0;
  if(completeSelectedButton) completeSelectedButton.disabled = totalSelected === 0;
  if(deleteSelectedButton){
    deleteSelectedButton.hidden = currentAccess.role !== 'admin';
    deleteSelectedButton.disabled = currentAccess.role !== 'admin' || totalSelected === 0;
  }
}

function renderTable(){
  if(!tbody) return;
  countLabel.textContent = `${filteredOrders.length} rekod`;

  const existingIds = new Set(allOrders.map(order => order.id || order.clientOrderId).filter(Boolean));
  for(const id of [...selectedOrderIds]){
    if(!existingIds.has(id)) selectedOrderIds.delete(id);
  }

  if(!filteredOrders.length){
    tbody.innerHTML = '<tr><td colspan="10" class="food-orders-empty">Tiada rekod yang sepadan.</td></tr>';
    renderPagination();
    syncSelectionControls();
    return;
  }

  const pageOrders = currentPageOrders();
  tbody.innerHTML = pageOrders.map(order => {
    const rawOrderId = order.id || order.clientOrderId || '-';
    const orderId = escapeHtml(rawOrderId);
    const items = Array.isArray(order.items) ? order.items : [];
    const preview = items.slice(0, 2).map(item =>
      `${escapeHtml(item.product)} × ${Number(item.qty || 0)}`
    ).join('<br>');
    const extra = items.length > 2 ? `<br><small>+${items.length - 2} menu lagi</small>` : '';
    const note = escapeHtml(order.notes || '-');
    const status = order.status || 'new';
    const isCompleted = status === 'completed';
    const isSelected = selectedOrderIds.has(rawOrderId);

    return `
      <tr class="${isCompleted ? 'is-completed' : ''} ${isSelected ? 'is-selected' : ''}" data-order-id="${orderId}">
        <td class="food-order-check-col">
          <input
            aria-label="Pilih rekod ${orderId}"
            class="food-order-check"
            data-select-order-id="${orderId}"
            type="checkbox"
            ${isSelected ? 'checked' : ''}
          />
        </td>
        <td>
          <span class="food-order-id">${orderId.slice(0, 17)}</span>
          <span class="food-order-recorded">${escapeHtml(formatDateTime(order.createdAt, order.createdAtMs))}</span>
          ${isCompleted ? '<span class="food-order-complete-badge">✓ Urusan selesai</span>' : ''}
        </td>
        <td>
          <span class="food-order-customer">${escapeHtml(order.customerName || '-')}</span>
          <span class="food-order-phone">Tel: ${escapeHtml(order.customerPhone || '-')}</span>
          <span class="food-order-note-preview" title="${note}">${note}</span>
        </td>
        <td>${escapeHtml(order.requiredDateLabel || order.requiredDate || '-')}</td>
        <td><span class="food-order-items-preview">${preview || '-'}${extra}</span></td>
        <td class="food-order-quantity-col">${Number(order.totalBoxes || 0)}</td>
        <td><span class="food-order-money">${money(order.totalPrice)}</span></td>
        <td class="food-order-complete-cell">
          <input
            aria-label="Tandakan urusan ${orderId} sebagai selesai"
            class="food-order-completed-check"
            data-complete-order-id="${orderId}"
            title="${isCompleted ? 'Urusan telah selesai. Buang tanda untuk kembali kepada Disahkan.' : 'Tandakan urusan sebagai selesai'}"
            type="checkbox"
            ${isCompleted ? 'checked' : ''}
          />
        </td>
        <td>
          <select class="food-order-status-select" data-status-order-id="${orderId}" aria-label="Status tempahan ${orderId}">
            ${['new','contacted','confirmed','completed','cancelled'].map(value =>
              `<option value="${value}" ${value === status ? 'selected' : ''}>${orderStatusLabel(value)}</option>`
            ).join('')}
          </select>
        </td>
        <td><div class="food-order-actions"><button class="food-order-detail-btn" data-detail-order-id="${orderId}" type="button">Lihat Detail</button><button class="food-order-receipt-btn" data-receipt-order-id="${orderId}" type="button">⬇ Resit PDF</button></div></td>
      </tr>`;
  }).join('');

  renderPagination();
  syncSelectionControls();
}

function showError(message){
  if(!errorBox) return;
  errorBox.hidden = !message;
  errorBox.textContent = message || '';
}

function openDetail(orderId){
  const order = allOrders.find(item => (item.id || item.clientOrderId) === orderId);
  if(!order || !detailModal || !detailContent) return;

  const items = Array.isArray(order.items) ? order.items : [];
  detailContent.innerHTML = `
    <div class="food-order-detail-grid">
      <div class="food-order-detail-field"><span>ID Rekod</span><strong>${escapeHtml(order.id || order.clientOrderId || '-')}</strong></div>
      <div class="food-order-detail-field"><span>Status</span><strong>${escapeHtml(orderStatusLabel(order.status || 'new'))}</strong></div>
      <div class="food-order-detail-field"><span>Nama Pelanggan</span><strong>${escapeHtml(order.customerName || '-')}</strong></div>
      <div class="food-order-detail-field"><span>No. Telefon</span><strong>${escapeHtml(order.customerPhone || '-')}</strong></div>
      <div class="food-order-detail-field"><span>Direkodkan</span><strong>${escapeHtml(formatDateTime(order.createdAt, order.createdAtMs))}</strong></div>
      <div class="food-order-detail-field"><span>Tarikh Diperlukan</span><strong>${escapeHtml(order.requiredDateLabel || order.requiredDate || '-')}</strong></div>
      <div class="food-order-detail-field"><span>Kuantiti</span><strong>${Number(order.totalBoxes || 0)}</strong></div>
      <div class="food-order-detail-field" style="grid-column:1/-1"><span>Catatan</span><p>${escapeHtml(order.notes || '-')}</p></div>
    </div>
    <div class="food-order-detail-items">
      ${items.map((item, index) => `
        <div class="food-order-detail-item">
          <span>${index + 1}. ${escapeHtml(item.category)} — ${escapeHtml(item.product)}<br><small>${money(item.price)} × ${Number(item.qty || 0)}</small></span>
          <strong>${money(item.subtotal)}</strong>
        </div>`).join('') || '<p>Tiada butiran menu.</p>'}
    </div>
    <div class="food-order-detail-total">
      <strong>Anggaran Jumlah</strong>
      <strong>${money(order.totalPrice)}</strong>
    </div>
    <div class="food-order-detail-receipt-wrap">
      <button class="food-order-receipt-btn" data-receipt-order-id="${escapeHtml(order.id || order.clientOrderId || '')}" type="button">⬇ Muat Turun Resit PDF</button>
    </div>`;
  detailModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetail(){
  if(!detailModal) return;
  detailModal.hidden = true;
  document.body.style.overflow = '';
}

async function downloadReceipt(orderId, control){
  const order = allOrders.find(item => (item.id || item.clientOrderId) === orderId);
  if(!order){
    toast('Rekod tempahan tidak ditemui.', 'warning');
    return;
  }
  if(!window.AZOBSSFoodReceipt || typeof window.AZOBSSFoodReceipt.download !== 'function'){
    toast('Penjana resit PDF belum dimuatkan. Sila muat semula halaman.', 'warning');
    return;
  }

  const originalText = control?.textContent || '';
  if(control){
    control.disabled = true;
    control.textContent = 'Menjana PDF...';
  }

  try{
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
    window.AZOBSSFoodReceipt.download(order);
    toast('Resit PDF telah dimuat turun.', 'success');
  }catch(error){
    console.error('[AZOBSS Food Orders] Receipt PDF failed:', error);
    toast('Resit PDF gagal dijana. Sila cuba lagi.', 'warning');
  }finally{
    if(control){
      control.disabled = false;
      control.textContent = originalText || '⬇ Resit PDF';
    }
  }
}

async function updateStatus(orderId, status, control){
  const previous = allOrders.find(item => (item.id || item.clientOrderId) === orderId)?.status || 'new';
  if(control) control.disabled = true;

  try{
    await updateDoc(doc(db, COLLECTION, orderId), {
      status,
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedAtMs: Date.now(),
      statusUpdatedByUid: currentAccess.user?.uid || '',
      statusUpdatedByEmail: lower(currentAccess.user?.email || '')
    });
    toast(
      status === 'completed'
        ? 'Urusan tempahan telah ditandakan selesai.'
        : `Status ditukar kepada ${orderStatusLabel(status)}.`,
      'success'
    );
  }catch(error){
    console.error('[AZOBSS Food Orders] Status update failed:', error);
    if(control){
      if(control.matches('select')) control.value = previous;
      if(control.matches('[data-complete-order-id]')) control.checked = previous === 'completed';
    }
    toast('Status gagal dikemas kini. Semak Firebase Rules.', 'warning');
  }finally{
    if(control) control.disabled = false;
  }
}

async function markSelectedCompleted(){
  const ids = [...selectedOrderIds];
  if(!ids.length) return;

  const targetIds = ids.filter(id => {
    const order = allOrders.find(item => (item.id || item.clientOrderId) === id);
    return order && order.status !== 'completed';
  });

  if(!targetIds.length){
    toast('Semua rekod yang dipilih sudah selesai.', 'success');
    return;
  }

  completeSelectedButton.disabled = true;
  const originalText = completeSelectedButton.textContent;
  completeSelectedButton.textContent = `Memproses ${targetIds.length} rekod...`;

  try{
    const batch = writeBatch(db);
    const nowMs = Date.now();

    targetIds.forEach(id => {
      batch.update(doc(db, COLLECTION, id), {
        status: 'completed',
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedAtMs: nowMs,
        statusUpdatedByUid: currentAccess.user?.uid || '',
        statusUpdatedByEmail: lower(currentAccess.user?.email || '')
      });
    });

    await batch.commit();
    selectedOrderIds.clear();
    toast(`${targetIds.length} rekod ditandakan selesai.`, 'success');
    syncSelectionControls();
  }catch(error){
    console.error('[AZOBSS Food Orders] Bulk complete failed:', error);
    toast('Rekod gagal ditandakan selesai. Semak Firebase Rules.', 'warning');
  }finally{
    completeSelectedButton.textContent = originalText;
    syncSelectionControls();
  }
}

async function deleteSelectedOrders(){
  if(currentAccess.role !== 'admin'){
    toast('Hanya admin boleh memadam rekod.', 'warning');
    return;
  }

  const ids = [...selectedOrderIds];
  if(!ids.length) return;

  const confirmed = window.confirm(
    `Padam ${ids.length} rekod yang dipilih secara kekal?\n\nTindakan ini tidak boleh dibuat asal.`
  );
  if(!confirmed){
    toast('Pemadaman dibatalkan.', 'warning');
    return;
  }

  deleteSelectedButton.disabled = true;
  const originalText = deleteSelectedButton.textContent;
  deleteSelectedButton.textContent = `Memadam ${ids.length} rekod...`;

  try{
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, COLLECTION, id)));
    await batch.commit();

    selectedOrderIds.clear();
    toast(`${ids.length} rekod telah dipadam secara kekal.`, 'success');
    syncSelectionControls();
  }catch(error){
    console.error('[AZOBSS Food Orders] Delete failed:', error);
    toast('Rekod gagal dipadam. Pastikan anda login sebagai admin dan Rules sudah diterbitkan.', 'warning');
  }finally{
    deleteSelectedButton.textContent = originalText;
    syncSelectionControls();
  }
}

function csvCell(value){
  const text = clean(value).replace(/\r?\n/g, ' ');
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(){
  if(!filteredOrders.length){
    toast('Tiada rekod untuk dieksport.', 'warning');
    return;
  }

  const rows = [[
    'ID Rekod','Direkodkan','Nama Pelanggan','No. Telefon','Tarikh Diperlukan',
    'Tempahan','Kuantiti','Anggaran Jumlah RM','Catatan','Status'
  ]];

  filteredOrders.forEach(order => {
    rows.push([
      order.id || order.clientOrderId || '',
      formatDateTime(order.createdAt, order.createdAtMs),
      order.customerName || '',
      order.customerPhone || '',
      order.requiredDateLabel || order.requiredDate || '',
      itemSummary(order),
      Number(order.totalBoxes || 0),
      Number(order.totalPrice || 0),
      order.notes || '',
      orderStatusLabel(order.status || 'new')
    ]);
  });

  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = new Date().toISOString().slice(0,10);
  anchor.href = url;
  anchor.download = `AZOBSS-Rekod-Tempahan-Makanan-${date}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function startRealtimeTable(){
  if(!panel || unsubscribeOrders) return;

  panel.hidden = false;
  roleBadge.textContent = currentAccess.role === 'admin'
    ? 'ADMIN'
    : (currentAccess.role === 'semi-admin' ? 'SEMI-ADMIN' : (currentAccess.role === 'staff' ? 'STAFF' : 'ACCESS'));
  if(deleteSelectedButton){
    deleteSelectedButton.hidden = currentAccess.role !== 'admin';
  }
  liveStatus.textContent = 'Menyambung ke rekod masa nyata...';
  showError('');

  const recordsQuery = query(
    collection(db, COLLECTION),
    orderBy('createdAtMs', 'desc'),
    limit(500)
  );

  unsubscribeOrders = onSnapshot(recordsQuery, snapshot => {
    allOrders = snapshot.docs.map(snap => normalizeLoadedOrder({ id:snap.id, ...snap.data() }));
    liveStatus.textContent = `Live • dikemas kini ${new Intl.DateTimeFormat('ms-MY', {hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
    showError('');
    applyFilters();
  }, error => {
    console.error('[AZOBSS Food Orders] Realtime load failed:', error);
    liveStatus.textContent = 'Gagal memuatkan rekod';
    tbody.innerHTML = '<tr><td colspan="10" class="food-orders-empty">Rekod tidak dapat dimuatkan.</td></tr>';
    showError('Akses Firestore ditolak atau Firebase Rules 671 belum diterbitkan. Gunakan AZOBSS-Developer-Files/FIREBASE-RULES-MERGED-FOOD-ORDERS-671-ACCESS-CONTROL.txt dan Publish.');
  });
}

async function initializeAccess(user){
  currentAccess = await resolveAccess(user);

  if(!currentAccess.allowed){
    if(panel) panel.hidden = true;
    if(unsubscribeOrders){
      unsubscribeOrders();
      unsubscribeOrders = null;
    }
    return;
  }

  startRealtimeTable();
}

searchInput?.addEventListener('input', () => applyFilters(true));
statusFilter?.addEventListener('change', () => applyFilters(true));
el('foodOrdersExportBtn')?.addEventListener('click', exportCsv);
el('foodOrdersRefreshBtn')?.addEventListener('click', () => {
  if(unsubscribeOrders){
    unsubscribeOrders();
    unsubscribeOrders = null;
  }
  startRealtimeTable();
});

tbody?.addEventListener('click', event => {
  const receiptButton = event.target.closest('[data-receipt-order-id]');
  if(receiptButton){
    downloadReceipt(receiptButton.dataset.receiptOrderId, receiptButton);
    return;
  }
  const button = event.target.closest('[data-detail-order-id]');
  if(button) openDetail(button.dataset.detailOrderId);
});

tbody?.addEventListener('change', event => {
  const selection = event.target.closest('[data-select-order-id]');
  if(selection){
    const orderId = selection.dataset.selectOrderId;
    if(selection.checked) selectedOrderIds.add(orderId);
    else selectedOrderIds.delete(orderId);
    selection.closest('tr')?.classList.toggle('is-selected', selection.checked);
    syncSelectionControls();
    return;
  }

  const complete = event.target.closest('[data-complete-order-id]');
  if(complete){
    const nextStatus = complete.checked ? 'completed' : 'confirmed';
    updateStatus(complete.dataset.completeOrderId, nextStatus, complete);
    return;
  }

  const select = event.target.closest('[data-status-order-id]');
  if(select) updateStatus(select.dataset.statusOrderId, select.value, select);
});

selectAllCheckbox?.addEventListener('change', () => {
  visibleOrderIds().forEach(id => {
    if(selectAllCheckbox.checked) selectedOrderIds.add(id);
    else selectedOrderIds.delete(id);
  });
  renderTable();
});

paginationPrev?.addEventListener('click', () => {
  if(currentPage <= 1) return;
  currentPage -= 1;
  renderTable();
});

paginationNext?.addEventListener('click', () => {
  if(currentPage >= totalPageCount()) return;
  currentPage += 1;
  renderTable();
});

paginationPages?.addEventListener('click', event => {
  const button = event.target.closest('[data-food-orders-page]');
  if(!button) return;
  const requestedPage = Number(button.dataset.foodOrdersPage || 1);
  if(!Number.isFinite(requestedPage)) return;
  currentPage = Math.min(Math.max(1, requestedPage), totalPageCount());
  renderTable();
});

completeSelectedButton?.addEventListener('click', markSelectedCompleted);
deleteSelectedButton?.addEventListener('click', deleteSelectedOrders);

el('foodOrderDetailClose')?.addEventListener('click', closeDetail);
detailModal?.addEventListener('click', event => {
  const receiptButton = event.target.closest('[data-receipt-order-id]');
  if(receiptButton){
    downloadReceipt(receiptButton.dataset.receiptOrderId, receiptButton);
    return;
  }
  if(event.target === detailModal) closeDetail();
});
document.addEventListener('keydown', event => {
  if(event.key === 'Escape' && detailModal && !detailModal.hidden) closeDetail();
});

onAuthStateChanged(auth, user => {
  initializeAccess(user);
  autofillLoggedInCustomer(user).catch(error => {
    console.warn('[AZOBSS Food Orders] Customer autofill skipped:', error);
  });
});
setTimeout(() => initializeAccess(auth.currentUser), 1200);
setTimeout(() => initializeAccess(auth.currentUser), 3500);
