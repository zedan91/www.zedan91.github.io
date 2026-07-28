import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy,
  limit, onSnapshot, setDoc, updateDoc, serverTimestamp
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
let unsubscribeOrders = null;
let currentAccess = { allowed: false, role: 'none', user: null, profile: null };

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

function clean(value){
  return String(value ?? '').trim();
}

function lower(value){
  return clean(value).toLowerCase();
}

function escapeHtml(value){
  return clean(value).replace(/[&<>'"]/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[char]);
}

function money(value){
  return `RM${Number(value || 0).toFixed(0)}`;
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

async function submitOrder(payload, whatsappUrl, submitButton){
  const popup = window.open('', '_blank');
  if(popup){
    try{
      popup.document.title = 'Membuka WhatsApp';
      popup.document.body.style.cssText = 'margin:0;display:grid;place-items:center;min-height:100vh;background:#07101f;color:#fff;font:700 16px Arial';
      popup.document.body.textContent = 'Menyimpan rekod tempahan dan membuka WhatsApp...';
    }catch(_){}
  }

  const originalText = submitButton?.textContent || '';
  if(submitButton){
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan rekod...';
  }

  const clientOrderId = generateOrderId();
  const user = auth.currentUser;
  const record = {
    clientOrderId,
    customerName: clean(payload.customerName).slice(0, 100),
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
    await setDoc(doc(db, COLLECTION, clientOrderId), record);
    saved = true;
    toast('Rekod tempahan telah disimpan. WhatsApp sedang dibuka.', 'success');
  }catch(error){
    console.error('[AZOBSS Food Orders] Save failed:', error);
    toast('WhatsApp dibuka, tetapi rekod gagal disimpan. Sila semak Firebase Rules.', 'warning');
  }finally{
    if(submitButton){
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'Tempah melalui WhatsApp';
    }
    try{
      if(popup && !popup.closed) popup.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
    }catch(_){
      window.location.href = whatsappUrl;
    }
  }

  return { saved, clientOrderId };
}

window.AZOBSSFoodOrders = Object.freeze({ submitOrder });

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
    permissions?.canViewFoodOrders === true ||
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

  const profile = await loadUserProfile(user);
  const profileRole = roleFromProfile(profile);
  if(profileRole !== 'none'){
    return { allowed:true, role:profileRole, user, profile };
  }

  for(const stored of parseStoredProfiles()){
    const storedRole = roleFromProfile(stored);
    if(storedRole !== 'none'){
      return { allowed:true, role:storedRole, user, profile:stored };
    }
  }

  if(document.body.classList.contains('az-role-is-admin') || document.body.classList.contains('is-admin')){
    return { allowed:true, role:'admin', user, profile:null };
  }
  if(document.body.classList.contains('az-role-is-staff') || document.body.classList.contains('az-role-is-stafflike')){
    return { allowed:true, role:'staff', user, profile:null };
  }

  return { allowed:false, role:'none', user, profile };
}

function itemSummary(order){
  const items = Array.isArray(order.items) ? order.items : [];
  if(!items.length) return '-';
  return items.map(item => `${item.category} — ${item.product} × ${item.qty}`).join('; ');
}

function searchableText(order){
  return lower([
    order.clientOrderId, order.customerName, order.requiredDate,
    order.requiredDateLabel, order.notes, order.status, itemSummary(order)
  ].join(' '));
}

function applyFilters(){
  const term = lower(searchInput?.value || '');
  const wantedStatus = statusFilter?.value || 'all';

  filteredOrders = allOrders.filter(order => {
    const matchesSearch = !term || searchableText(order).includes(term);
    const matchesStatus = wantedStatus === 'all' || (order.status || 'new') === wantedStatus;
    return matchesSearch && matchesStatus;
  });

  renderTable();
}

function renderTable(){
  if(!tbody) return;
  countLabel.textContent = `${filteredOrders.length} rekod`;

  if(!filteredOrders.length){
    tbody.innerHTML = '<tr><td colspan="8" class="food-orders-empty">Tiada rekod yang sepadan.</td></tr>';
    return;
  }

  tbody.innerHTML = filteredOrders.map(order => {
    const orderId = escapeHtml(order.id || order.clientOrderId || '-');
    const items = Array.isArray(order.items) ? order.items : [];
    const preview = items.slice(0, 2).map(item =>
      `${escapeHtml(item.product)} × ${Number(item.qty || 0)}`
    ).join('<br>');
    const extra = items.length > 2 ? `<br><small>+${items.length - 2} menu lagi</small>` : '';
    const note = escapeHtml(order.notes || '-');
    const status = order.status || 'new';

    return `
      <tr data-order-id="${orderId}">
        <td>
          <span class="food-order-id">${orderId.slice(0, 17)}</span>
          <span class="food-order-recorded">${escapeHtml(formatDateTime(order.createdAt, order.createdAtMs))}</span>
        </td>
        <td>
          <span class="food-order-customer">${escapeHtml(order.customerName || '-')}</span>
          <span class="food-order-note-preview" title="${note}">${note}</span>
        </td>
        <td>${escapeHtml(order.requiredDateLabel || order.requiredDate || '-')}</td>
        <td><span class="food-order-items-preview">${preview || '-'}${extra}</span></td>
        <td>${Number(order.totalBoxes || 0)}</td>
        <td><span class="food-order-money">${money(order.totalPrice)}</span></td>
        <td>
          <select class="food-order-status-select" data-status-order-id="${orderId}" aria-label="Status tempahan ${orderId}">
            ${['new','contacted','confirmed','completed','cancelled'].map(value =>
              `<option value="${value}" ${value === status ? 'selected' : ''}>${orderStatusLabel(value)}</option>`
            ).join('')}
          </select>
        </td>
        <td><button class="food-order-detail-btn" data-detail-order-id="${orderId}" type="button">Lihat Detail</button></td>
      </tr>`;
  }).join('');
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
      <div class="food-order-detail-field"><span>Direkodkan</span><strong>${escapeHtml(formatDateTime(order.createdAt, order.createdAtMs))}</strong></div>
      <div class="food-order-detail-field"><span>Tarikh Diperlukan</span><strong>${escapeHtml(order.requiredDateLabel || order.requiredDate || '-')}</strong></div>
      <div class="food-order-detail-field"><span>Jumlah Kotak</span><strong>${Number(order.totalBoxes || 0)}</strong></div>
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
    </div>`;
  detailModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDetail(){
  if(!detailModal) return;
  detailModal.hidden = true;
  document.body.style.overflow = '';
}

async function updateStatus(orderId, status, select){
  const previous = allOrders.find(item => (item.id || item.clientOrderId) === orderId)?.status || 'new';
  select.disabled = true;
  try{
    await updateDoc(doc(db, COLLECTION, orderId), {
      status,
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedAtMs: Date.now(),
      statusUpdatedByUid: currentAccess.user?.uid || '',
      statusUpdatedByEmail: lower(currentAccess.user?.email || '')
    });
    toast(`Status ditukar kepada ${orderStatusLabel(status)}.`, 'success');
  }catch(error){
    console.error('[AZOBSS Food Orders] Status update failed:', error);
    select.value = previous;
    toast('Status gagal dikemas kini. Semak Firebase Rules.', 'warning');
  }finally{
    select.disabled = false;
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
    'ID Rekod','Direkodkan','Nama Pelanggan','Tarikh Diperlukan',
    'Tempahan','Jumlah Kotak','Anggaran Jumlah RM','Catatan','Status'
  ]];

  filteredOrders.forEach(order => {
    rows.push([
      order.id || order.clientOrderId || '',
      formatDateTime(order.createdAt, order.createdAtMs),
      order.customerName || '',
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
    : (currentAccess.role === 'semi-admin' ? 'SEMI-ADMIN' : 'STAFF');
  liveStatus.textContent = 'Menyambung ke rekod masa nyata...';
  showError('');

  const recordsQuery = query(
    collection(db, COLLECTION),
    orderBy('createdAtMs', 'desc'),
    limit(500)
  );

  unsubscribeOrders = onSnapshot(recordsQuery, snapshot => {
    allOrders = snapshot.docs.map(snap => ({ id:snap.id, ...snap.data() }));
    liveStatus.textContent = `Live • dikemas kini ${new Intl.DateTimeFormat('ms-MY', {hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
    showError('');
    applyFilters();
  }, error => {
    console.error('[AZOBSS Food Orders] Realtime load failed:', error);
    liveStatus.textContent = 'Gagal memuatkan rekod';
    tbody.innerHTML = '<tr><td colspan="8" class="food-orders-empty">Rekod tidak dapat dimuatkan.</td></tr>';
    showError('Akses Firestore ditolak atau Rules belum dikemas kini. Gabungkan FIREBASE-RULES-ADDON-FOOD-ORDERS-640.txt ke Firebase Rules dan Publish.');
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

searchInput?.addEventListener('input', applyFilters);
statusFilter?.addEventListener('change', applyFilters);
el('foodOrdersExportBtn')?.addEventListener('click', exportCsv);
el('foodOrdersRefreshBtn')?.addEventListener('click', () => {
  if(unsubscribeOrders){
    unsubscribeOrders();
    unsubscribeOrders = null;
  }
  startRealtimeTable();
});

tbody?.addEventListener('click', event => {
  const button = event.target.closest('[data-detail-order-id]');
  if(button) openDetail(button.dataset.detailOrderId);
});

tbody?.addEventListener('change', event => {
  const select = event.target.closest('[data-status-order-id]');
  if(select) updateStatus(select.dataset.statusOrderId, select.value, select);
});

el('foodOrderDetailClose')?.addEventListener('click', closeDetail);
detailModal?.addEventListener('click', event => {
  if(event.target === detailModal) closeDetail();
});
document.addEventListener('keydown', event => {
  if(event.key === 'Escape' && detailModal && !detailModal.hidden) closeDetail();
});

onAuthStateChanged(auth, user => initializeAccess(user));
setTimeout(() => initializeAccess(auth.currentUser), 1200);
setTimeout(() => initializeAccess(auth.currentUser), 3500);
