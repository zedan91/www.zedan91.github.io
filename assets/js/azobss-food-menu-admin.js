import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, onSnapshot, setDoc, serverTimestamp
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
const CONFIG_REF = doc(db, 'foodMenuConfig', 'brownies');
const ADMIN_EMAILS = new Set(['zedan91@azobss.local', 'zedan9107@gmail.com']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const roundMoney = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const money = value => {
  const amount = roundMoney(value);
  return `RM${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
};
const escapeHtml = value => clean(value).replace(/[&<>'"]/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
})[char]);


const ADMIN_USERNAMES = new Set(['zedan91', 'zedan9107']);
const ACCESS_PROFILE_KEYS = [
  'azobssCurrentUser','azobssUser','azobss_user','azobss_current_user',
  'azobssSavedUser','azobss_user_profile','azobssProfile','currentUser',
  'userProfile','azobss_auth_user','azobssLoginUser','azobss_logged_user'
];

function storedProfiles(){
  const profiles = [];
  ACCESS_PROFILE_KEYS.forEach(key => {
    for(const storage of [localStorage, sessionStorage]){
      try{
        const raw = storage.getItem(key);
        if(!raw) continue;
        const value = JSON.parse(raw);
        if(value && typeof value === 'object') profiles.push(value);
      }catch(_){ }
    }
  });
  return profiles;
}

function profileUsername(profile){
  return lower(
    profile?.username || profile?.usernameKey || profile?.userName ||
    profile?.displayName || profile?.name || profile?.id
  ).replace(/^@/, '');
}

function profileRole(profile){
  return lower(profile?.role || profile?.userRole || profile?.accountRole || profile?.type || profile?.accessRole);
}

function isAdminProfile(profile){
  const permissions = profile?.permissions || {};
  return ADMIN_USERNAMES.has(profileUsername(profile))
    || ADMIN_EMAILS.has(lower(profile?.email || profile?.authEmail || profile?.userEmail))
    || profileRole(profile) === 'admin'
    || profile?.isAdmin === true
    || profile?.admin === true
    || profile?.owner === true
    || permissions?.isAdmin === true;
}

function pageShowsAdmin(){
  try{
    if(document.body?.classList.contains('is-admin') || document.body?.classList.contains('az-role-is-admin')) return true;
    if(lower(document.body?.dataset?.role) === 'admin') return true;
    if(localStorage.getItem('azobss_admin_role_cache') === '1') return true;
    const visible = lower([
      document.querySelector('.azobss-user-name')?.textContent,
      document.querySelector('.user-name')?.textContent,
      document.querySelector('#userName')?.textContent,
      document.querySelector('[data-current-username]')?.textContent,
      document.querySelector('.azobss-nav-user')?.textContent,
      document.querySelector('.azUserMenuButton')?.textContent
    ].filter(Boolean).join(' '));
    if([...ADMIN_USERNAMES].some(name => visible.includes(name))) return true;
  }catch(_){ }
  return storedProfiles().some(isAdminProfile);
}

const menuSection = document.getElementById('menu');
const gallery = document.querySelector('.brownies-showcase.brownies-original-only');
const defaultRows = new Map();
const defaultImages = new Map();
let currentConfig = { items:{}, uploadedImages:[], hiddenDefaultImages:[], cloudinary:{ cloudName:'', uploadPreset:'', folder:'azobss/food-menu' } };
let currentAccess = { allowed:false, role:'none', user:null };
let configLoaded = false;
let managerOpen = false;
let unsubscribeConfig = null;

function defaultFourPrice(name){
  if(/pistachio(?: cookie crumbs| nibs)/i.test(name)) return 16;
  if(/almond/i.test(name)) return 14;
  return 13;
}

function captureDefaults(){
  document.querySelectorAll('.brownie-order-item').forEach((row, index) => {
    const stepper = row.querySelector('.brownie-qty-stepper');
    if(!stepper) return;
    const id = clean(stepper.dataset.itemId) || `brownie-item-${index + 1}`;
    const name = clean(stepper.dataset.product || row.querySelector('.brownie-item-name')?.textContent);
    const category = clean(stepper.dataset.category);
    const price8 = roundMoney(stepper.dataset.price || 0);
    const available4 = stepper.dataset.available4 === 'true';
    const price4 = available4
      ? roundMoney(stepper.dataset.price4 || defaultFourPrice(name))
      : 0;
    defaultRows.set(id, { id, row, stepper, category, name, price8, price4, available4, deleted:false });
  });

  gallery?.querySelectorAll('img').forEach((image, index) => {
    const id = clean(image.dataset.galleryId) || `default-${index + 1}`;
    image.dataset.galleryId = id;
    defaultImages.set(id, {
      id,
      image,
      src:image.getAttribute('src') || '',
      alt:image.getAttribute('alt') || `Gambar brownies ${index + 1}`
    });
  });
}

function normalizeItem(id, value = {}){
  const fallback = defaultRows.get(id);
  if(!fallback) return null;
  const name = clean(value.name) || fallback.name;
  const price8 = Number.isFinite(Number(value.price8)) ? roundMoney(value.price8) : fallback.price8;
  const available4 = typeof value.available4 === 'boolean' ? value.available4 : fallback.available4;
  const price4 = available4
    ? (Number.isFinite(Number(value.price4)) && Number(value.price4) > 0
      ? roundMoney(value.price4)
      : fallback.price4 || defaultFourPrice(name))
    : 0;
  return {
    id,
    name:name.slice(0, 160),
    price8:Math.max(0, price8),
    price4:Math.max(0, price4),
    available4,
    deleted:value.deleted === true
  };
}

function normalizedConfig(data = {}){
  const items = {};
  defaultRows.forEach((fallback, id) => {
    items[id] = normalizeItem(id, data?.items?.[id] || fallback);
  });

  const uploadedImages = Array.isArray(data.uploadedImages)
    ? data.uploadedImages.slice(0, 40).map(image => ({
        id:clean(image?.id).slice(0, 120),
        url:clean(image?.url).slice(0, 2000),
        provider:clean(image?.provider || (/res\.cloudinary\.com/i.test(image?.url || '') ? 'cloudinary' : 'legacy')).slice(0, 40),
        publicId:clean(image?.publicId).slice(0, 500),
        assetId:clean(image?.assetId).slice(0, 180),
        name:clean(image?.name).slice(0, 140),
        createdAtMs:Number(image?.createdAtMs || 0)
      })).filter(image => image.id && image.url)
    : [];

  const hiddenDefaultImages = Array.isArray(data.hiddenDefaultImages)
    ? [...new Set(data.hiddenDefaultImages.map(clean).filter(id => defaultImages.has(id)))].slice(0, 30)
    : [];

  const cloudinary = {
    cloudName:clean(data?.cloudinary?.cloudName).slice(0, 120),
    uploadPreset:clean(data?.cloudinary?.uploadPreset).slice(0, 160),
    folder:clean(data?.cloudinary?.folder || 'azobss/food-menu').slice(0, 240) || 'azobss/food-menu'
  };

  return { items, uploadedImages, hiddenDefaultImages, cloudinary };
}

function applyMenuConfig(config){
  defaultRows.forEach((fallback, id) => {
    const item = normalizeItem(id, config.items?.[id] || fallback);
    if(!item) return;
    const { row, stepper } = fallback;
    stepper.dataset.product = item.name;
    stepper.dataset.product8 = item.name;
    stepper.dataset.product4 = item.name;
    stepper.dataset.price = String(item.price8);
    stepper.dataset.price4 = String(item.price4 || '');
    stepper.dataset.available4 = item.available4 ? 'true' : 'false';
    stepper.dataset.enabled = item.deleted ? 'false' : 'true';

    row.dataset.product = item.name;
    row.dataset.product8 = item.name;
    row.dataset.product4 = item.name;
    row.dataset.price = String(item.price8);
    row.dataset.price4 = String(item.price4 || '');
    row.dataset.available4 = item.available4 ? 'true' : 'false';
    row.dataset.enabled = item.deleted ? 'false' : 'true';
    row.classList.toggle('food-menu-item-deleted', item.deleted);
    row.hidden = item.deleted;
    row.setAttribute('aria-hidden', item.deleted ? 'true' : 'false');

    const nameLabel = row.querySelector('.brownie-item-name');
    if(nameLabel) nameLabel.textContent = item.name;
  });

  const activeItems = Object.values(config.items || {}).filter(item => item && !item.deleted);
  const allPrices = [];
  activeItems.forEach(item => {
    if(Number(item.price8) > 0) allPrices.push(Number(item.price8));
    if(item.available4 && Number(item.price4) > 0) allPrices.push(Number(item.price4));
  });
  const minPrice = allPrices.length ? Math.min(...allPrices) : 0;
  const heroPriceBadge = Array.from(document.querySelectorAll('.hero .badges span'))
    .find(node => /harga\s+dari/i.test(node.textContent || ''));
  if(heroPriceBadge && minPrice > 0) heroPriceBadge.textContent = `Harga dari ${money(minPrice)}`;

  const fourPrices = activeItems
    .filter(item => item.available4 && Number(item.price4) > 0)
    .map(item => Number(item.price4));
  const sizeHelp = document.getElementById('brownieSizeHelp');
  if(sizeHelp){
    if(fourPrices.length){
      const min4 = Math.min(...fourPrices);
      const max4 = Math.max(...fourPrices);
      sizeHelp.dataset.help4 = min4 === max4
        ? `Saiz 4 inci mengandungi 9 pcs. Semua pilihan berharga ${money(min4)}.`
        : `Saiz 4 inci mengandungi 9 pcs. Harga ${money(min4)} hingga ${money(max4)} mengikut pilihan.`;
    }
    sizeHelp.dataset.help8 = 'Saiz 8 inci menyediakan semua pilihan brownies yang aktif.';
  }

  window.AZOBSSBrownieOrder?.refresh?.();
}

function applyGalleryConfig(config){
  if(!gallery) return;
  const hidden = new Set(config.hiddenDefaultImages || []);
  defaultImages.forEach(({ image }, id) => {
    image.hidden = hidden.has(id);
    image.setAttribute('aria-hidden', hidden.has(id) ? 'true' : 'false');
  });

  gallery.querySelectorAll('[data-uploaded-food-image="true"]').forEach(node => node.remove());
  (config.uploadedImages || []).forEach(image => {
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.name || 'Gambar brownies';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.dataset.uploadedFoodImage = 'true';
    img.dataset.galleryId = image.id;
    img.dataset.imageProvider = image.provider || '';
    img.dataset.cloudinaryPublicId = image.publicId || '';
    gallery.appendChild(img);
  });
  window.dispatchEvent(new CustomEvent('azobss-food-menu-updated'));
}

function applyConfig(config){
  currentConfig = normalizedConfig(config);
  configLoaded = true;
  applyMenuConfig(currentConfig);
  applyGalleryConfig(currentConfig);
  if(managerOpen) renderManager();
}

function showToast(message, type = ''){
  document.querySelectorAll('.food-menu-admin-toast').forEach(node => node.remove());
  const toast = document.createElement('div');
  toast.className = `food-menu-admin-toast ${type}`.trim();
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4300);
}

async function resolveAccess(user){
  const effectiveUser = user || auth.currentUser || null;
  const adminDetected = pageShowsAdmin()
    || ADMIN_EMAILS.has(lower(effectiveUser?.email))
    || storedProfiles().some(isAdminProfile);

  // The AZOBSS navigation/profile may finish rendering slightly after Firebase Auth.
  // Keep the admin toolbar visible for the known owner account, while writes still
  // require the real authenticated Firebase user and Firestore rules.
  if(adminDetected){
    return { allowed:true, role:'admin', user:effectiveUser };
  }
  if(!effectiveUser) return { allowed:false, role:'none', user:null };

  try{
    const snap = await getDoc(doc(db, 'foodOrderStaffAccess', effectiveUser.uid));
    const data = snap.exists() ? snap.data() : null;
    if(data?.active === true && data?.canViewFoodOrders === true){
      return { allowed:true, role:'access', user:effectiveUser, accessDocument:data };
    }
  }catch(error){
    console.warn('[AZOBSS Food Menu] Access lookup failed:', error);
  }
  return { allowed:false, role:'none', user:effectiveUser };
}

let accessRefreshToken = 0;
async function refreshAccess(user = auth.currentUser){
  const token = ++accessRefreshToken;
  const resolved = await resolveAccess(user);
  if(token !== accessRefreshToken) return;
  currentAccess = resolved;
  updateManagerVisibility();
}

function injectStyles(){
  if(document.getElementById('azobssFoodMenuAdminStyles')) return;
  const style = document.createElement('style');
  style.id = 'azobssFoodMenuAdminStyles';
  style.textContent = `
.food-menu-admin-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-4px 0 16px;padding:12px 14px;border:1px solid rgba(34,197,94,.45);border-radius:15px;background:linear-gradient(135deg,rgba(5,46,22,.72),rgba(6,24,42,.88));color:#dcfce7}
.food-menu-admin-toolbar[hidden]{display:none!important}.food-menu-admin-toolbar-copy{display:grid;gap:3px}.food-menu-admin-toolbar-copy strong{font-size:14px}.food-menu-admin-toolbar-copy span{font-size:12px;color:#a7f3d0}.food-menu-admin-open{border:1px solid #22c55e;border-radius:11px;background:#16a34a;color:#fff;padding:10px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;white-space:nowrap}
.food-menu-admin-modal{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.82);backdrop-filter:blur(8px)}.food-menu-admin-modal[hidden]{display:none!important}.food-menu-admin-dialog{width:min(1080px,100%);max-height:92vh;overflow:auto;border:1px solid rgba(34,197,94,.55);border-radius:20px;background:#0b1424;color:#f8fafc;box-shadow:0 28px 90px rgba(0,0,0,.55)}
.food-menu-admin-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.1);background:rgba(11,20,36,.96);backdrop-filter:blur(10px)}.food-menu-admin-head h2{margin:0;font-size:21px}.food-menu-admin-close{width:38px;height:38px;border:1px solid #475569;border-radius:10px;background:#172033;color:#fff;font-size:22px;cursor:pointer}
.food-menu-admin-body{display:grid;gap:22px;padding:18px}.food-menu-admin-section{display:grid;gap:12px}.food-menu-admin-section h3{margin:0;font-size:18px;color:#fde68a}.food-menu-admin-help{margin:0;color:#94a3b8;font-size:12px;line-height:1.5}.food-menu-admin-list{display:grid;gap:10px}.food-menu-admin-item{display:grid;grid-template-columns:minmax(190px,1.7fr) 110px 110px 120px auto;gap:10px;align-items:end;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:#0f1b2e}.food-menu-admin-item.is-deleted{opacity:.58;border-style:dashed}.food-menu-admin-field{display:grid;gap:5px;min-width:0}.food-menu-admin-field label{font-size:11px;font-weight:850;color:#cbd5e1}.food-menu-admin-field input{min-width:0;height:40px;padding:8px 10px;border:1px solid #475569;border-radius:9px;background:#061022;color:#fff;font:inherit}.food-menu-admin-category{font-size:11px;color:#fbbf24;margin-bottom:3px}.food-menu-admin-check{display:flex;align-items:center;gap:7px;min-height:40px;color:#e2e8f0;font-size:12px;font-weight:800}.food-menu-admin-check input{width:17px;height:17px}.food-menu-admin-delete{height:40px;border:1px solid #ef4444;border-radius:9px;background:#7f1d1d;color:#fff;padding:0 11px;font-weight:900;cursor:pointer}.food-menu-admin-delete.restore{border-color:#22c55e;background:#166534}
.food-menu-admin-actions{display:flex;justify-content:flex-end;gap:10px;position:sticky;bottom:0;padding:13px 18px;border-top:1px solid rgba(255,255,255,.1);background:rgba(11,20,36,.97)}.food-menu-admin-save{border:0;border-radius:11px;background:#16a34a;color:#fff;padding:11px 18px;font:inherit;font-weight:950;cursor:pointer}.food-menu-admin-save:disabled{opacity:.5;cursor:wait}
.food-menu-cloudinary-settings{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px;border:1px solid rgba(56,189,248,.28);border-radius:13px;background:rgba(7,89,133,.12)}.food-menu-cloudinary-settings .food-menu-admin-field input{height:42px}.food-menu-cloudinary-link{display:inline-flex;align-items:center;justify-content:center;border:1px solid #38bdf8;border-radius:10px;background:#0c4a6e;color:#fff;padding:10px 14px;text-decoration:none;font-size:12px;font-weight:900}.food-menu-image-upload{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.food-menu-image-upload input{max-width:360px}.food-menu-upload-btn{border:1px solid #38bdf8;border-radius:10px;background:#075985;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer}.food-menu-upload-btn:disabled{opacity:.5;cursor:wait}.food-menu-upload-status{font-size:12px;color:#a7f3d0}.food-menu-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.food-menu-image-card{position:relative;overflow:hidden;border:1px solid rgba(251,191,36,.35);border-radius:13px;background:#061022}.food-menu-image-card img{display:block;width:100%;height:125px;object-fit:cover}.food-menu-image-card.is-hidden img{opacity:.3;filter:grayscale(1)}.food-menu-image-meta{display:grid;gap:7px;padding:9px}.food-menu-image-meta span{font-size:11px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.food-menu-image-delete{border:1px solid #ef4444;border-radius:8px;background:#7f1d1d;color:#fff;padding:7px 8px;font-size:11px;font-weight:900;cursor:pointer}.food-menu-image-delete.restore{border-color:#22c55e;background:#166534}
.food-menu-admin-toast{position:fixed;right:20px;bottom:20px;z-index:100001;max-width:min(430px,calc(100vw - 40px));padding:13px 16px;border:1px solid #38bdf8;border-radius:13px;background:#0c4a6e;color:#fff;font-weight:850;box-shadow:0 16px 45px rgba(0,0,0,.42)}.food-menu-admin-toast.success{border-color:#22c55e;background:#14532d}.food-menu-admin-toast.warning{border-color:#f59e0b;background:#78350f}.food-menu-item-deleted{display:none!important}.brownies-showcase.brownies-original-only img[hidden]{display:none!important}
@media(max-width:820px){.food-menu-cloudinary-settings{grid-template-columns:1fr}.food-menu-admin-item{grid-template-columns:1fr 1fr}.food-menu-admin-field.name{grid-column:1/-1}.food-menu-admin-delete{grid-column:2}.food-menu-admin-toolbar{align-items:flex-start;flex-direction:column}.food-menu-admin-open{width:100%}}
@media(max-width:520px){.food-menu-admin-modal{padding:0}.food-menu-admin-dialog{height:100vh;max-height:none;border-radius:0}.food-menu-admin-item{grid-template-columns:1fr}.food-menu-admin-field.name,.food-menu-admin-delete{grid-column:auto}.food-menu-admin-actions{flex-direction:column}.food-menu-admin-save{width:100%}}
`;
  document.head.appendChild(style);
}

function ensureManagerUi(){
  if(!menuSection || document.getElementById('foodMenuAdminToolbar')) return;
  injectStyles();
  const sizePicker = menuSection.querySelector('.brownie-size-picker');
  const toolbar = document.createElement('div');
  toolbar.id = 'foodMenuAdminToolbar';
  toolbar.className = 'food-menu-admin-toolbar';
  toolbar.hidden = true;
  toolbar.innerHTML = `
    <div class="food-menu-admin-toolbar-copy">
      <strong>Pengurusan Menu & Gambar Cloudinary</strong>
      <span>Untuk admin dan pengguna yang akses Tempahan Makanan diaktifkan.</span>
    </div>
    <button class="food-menu-admin-open" id="foodMenuAdminOpen" type="button">✎ Edit Menu & Gambar</button>`;
  sizePicker?.insertAdjacentElement('afterend', toolbar);

  const modal = document.createElement('div');
  modal.id = 'foodMenuAdminModal';
  modal.className = 'food-menu-admin-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <div class="food-menu-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="foodMenuAdminTitle">
      <div class="food-menu-admin-head">
        <h2 id="foodMenuAdminTitle">Edit Menu & Gambar Brownies (Cloudinary)</h2>
        <button class="food-menu-admin-close" id="foodMenuAdminClose" type="button" aria-label="Tutup">×</button>
      </div>
      <div class="food-menu-admin-body" id="foodMenuAdminBody"></div>
      <div class="food-menu-admin-actions">
        <button class="food-menu-admin-save" id="foodMenuAdminSave" type="button">Simpan Semua Perubahan</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('foodMenuAdminOpen')?.addEventListener('click', () => {
    managerOpen = true;
    renderManager();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  });
  const close = () => {
    managerOpen = false;
    modal.hidden = true;
    document.body.style.overflow = '';
  };
  document.getElementById('foodMenuAdminClose')?.addEventListener('click', close);
  modal.addEventListener('click', event => { if(event.target === modal) close(); });
  document.addEventListener('keydown', event => { if(event.key === 'Escape' && !modal.hidden) close(); });
  document.getElementById('foodMenuAdminSave')?.addEventListener('click', saveManagerChanges);
}

function renderManager(){
  const body = document.getElementById('foodMenuAdminBody');
  if(!body) return;
  if(!configLoaded){
    body.innerHTML = '<p class="food-menu-admin-help">Konfigurasi menu sedang dimuatkan...</p>';
    return;
  }

  const itemsHtml = [...defaultRows.values()].map(fallback => {
    const item = currentConfig.items[fallback.id] || normalizeItem(fallback.id, fallback);
    const deleted = item.deleted === true;
    return `
      <div class="food-menu-admin-item${deleted ? ' is-deleted' : ''}" data-editor-item="${escapeHtml(fallback.id)}">
        <div class="food-menu-admin-field name">
          <span class="food-menu-admin-category">${escapeHtml(fallback.category)}</span>
          <label>Nama pilihan</label>
          <input maxlength="160" data-field="name" value="${escapeHtml(item.name)}" ${deleted ? 'disabled' : ''} />
        </div>
        <div class="food-menu-admin-field">
          <label>Harga 8 inci (RM)</label>
          <input min="0" max="9999" step="0.01" type="number" data-field="price8" value="${escapeHtml(item.price8)}" ${deleted ? 'disabled' : ''} />
        </div>
        <div class="food-menu-admin-field">
          <label>Harga 4 inci (RM)</label>
          <input min="0" max="9999" step="0.01" type="number" data-field="price4" value="${escapeHtml(item.price4 || '')}" ${(!item.available4 || deleted) ? 'disabled' : ''} />
        </div>
        <label class="food-menu-admin-check">
          <input type="checkbox" data-field="available4" ${item.available4 ? 'checked' : ''} ${deleted ? 'disabled' : ''}/>
          Ada pilihan 4 inci
        </label>
        <button class="food-menu-admin-delete${deleted ? ' restore' : ''}" data-action="toggle-delete" type="button">${deleted ? 'Pulihkan' : 'Padam'}</button>
      </div>`;
  }).join('');

  const hiddenSet = new Set(currentConfig.hiddenDefaultImages || []);
  const defaultImageHtml = [...defaultImages.values()].map(image => {
    const hidden = hiddenSet.has(image.id);
    return `
      <div class="food-menu-image-card${hidden ? ' is-hidden' : ''}" data-image-kind="default" data-image-id="${escapeHtml(image.id)}">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"/>
        <div class="food-menu-image-meta"><span>${escapeHtml(image.alt)}</span>
          <button class="food-menu-image-delete${hidden ? ' restore' : ''}" data-action="toggle-default-image" type="button">${hidden ? 'Pulihkan' : 'Padam dari paparan'}</button>
        </div>
      </div>`;
  }).join('');
  const uploadedHtml = (currentConfig.uploadedImages || []).map(image => `
    <div class="food-menu-image-card" data-image-kind="uploaded" data-image-id="${escapeHtml(image.id)}">
      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.name || 'Gambar brownies')}"/>
      <div class="food-menu-image-meta"><span>${escapeHtml(image.name || image.id)}</span>
        <button class="food-menu-image-delete" data-action="delete-uploaded-image" type="button">Padam dari website</button>
      </div>
    </div>`).join('');

  body.innerHTML = `
    <section class="food-menu-admin-section">
      <h3>Nama dan harga menu</h3>
      <p class="food-menu-admin-help">Harga 8 inci dan 4 inci boleh ditetapkan berasingan. Butang Padam menyembunyikan pilihan daripada pelanggan; pilihan itu masih boleh dipulihkan.</p>
      <div class="food-menu-admin-list">${itemsHtml}</div>
    </section>
    <section class="food-menu-admin-section">
      <h3>Gambar brownies — Cloudinary</h3>
      <p class="food-menu-admin-help">Gambar baharu dihantar terus ke Cloudinary, bukan Firebase Storage. Cipta <b>Unsigned Upload Preset</b> dalam Cloudinary Console, kemudian masukkan maklumatnya di bawah. Jangan masukkan API Secret.</p>
      <div class="food-menu-cloudinary-settings">
        <div class="food-menu-admin-field"><label>Cloud name</label><input id="foodMenuCloudName" maxlength="120" value="${escapeHtml(currentConfig.cloudinary?.cloudName || '')}" placeholder="Contoh: azobss" /></div>
        <div class="food-menu-admin-field"><label>Unsigned upload preset</label><input id="foodMenuUploadPreset" maxlength="160" value="${escapeHtml(currentConfig.cloudinary?.uploadPreset || '')}" placeholder="Nama preset Cloudinary" /></div>
        <div class="food-menu-admin-field"><label>Folder Cloudinary</label><input id="foodMenuCloudFolder" maxlength="240" value="${escapeHtml(currentConfig.cloudinary?.folder || 'azobss/food-menu')}" placeholder="azobss/food-menu" /></div>
      </div>
      <div class="food-menu-image-upload">
        <input id="foodMenuImageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        <button class="food-menu-upload-btn" id="foodMenuUploadBtn" type="button">⬆ Upload ke Cloudinary</button>
        <a class="food-menu-cloudinary-link" href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer">Buka Cloudinary Console ↗</a>
        <span class="food-menu-upload-status" id="foodMenuUploadStatus"></span>
      </div>
      <div class="food-menu-image-grid">${defaultImageHtml}${uploadedHtml}</div>
    </section>`;

  body.querySelectorAll('[data-editor-item]').forEach(card => {
    const available4 = card.querySelector('[data-field="available4"]');
    const price4 = card.querySelector('[data-field="price4"]');
    available4?.addEventListener('change', () => {
      if(price4) price4.disabled = !available4.checked;
    });
  });
  body.addEventListener('click', handleManagerAction, { once:true });
  document.getElementById('foodMenuUploadBtn')?.addEventListener('click', uploadSelectedImages);
}

function handleManagerAction(event){
  const button = event.target.closest('[data-action]');
  if(!button){
    const body = document.getElementById('foodMenuAdminBody');
    body?.addEventListener('click', handleManagerAction, { once:true });
    return;
  }
  const action = button.dataset.action;
  currentConfig.items = collectEditorItems();
  if(action === 'toggle-delete'){
    const card = button.closest('[data-editor-item]');
    const id = clean(card?.dataset.editorItem);
    const item = currentConfig.items[id];
    if(item){ item.deleted = !item.deleted; renderManager(); }
  }else if(action === 'toggle-default-image'){
    const card = button.closest('[data-image-id]');
    const id = clean(card?.dataset.imageId);
    const hidden = new Set(currentConfig.hiddenDefaultImages || []);
    hidden.has(id) ? hidden.delete(id) : hidden.add(id);
    currentConfig.hiddenDefaultImages = [...hidden];
    renderManager();
  }else if(action === 'delete-uploaded-image'){
    const card = button.closest('[data-image-id]');
    deleteUploadedImage(clean(card?.dataset.imageId));
  }
}

function collectEditorItems(){
  const next = { ...currentConfig.items };
  document.querySelectorAll('[data-editor-item]').forEach(card => {
    const id = clean(card.dataset.editorItem);
    const old = next[id] || normalizeItem(id, {});
    if(!old) return;
    const name = clean(card.querySelector('[data-field="name"]')?.value) || old.name;
    const price8 = Number(card.querySelector('[data-field="price8"]')?.value);
    const available4 = Boolean(card.querySelector('[data-field="available4"]')?.checked);
    const price4Value = Number(card.querySelector('[data-field="price4"]')?.value);
    next[id] = normalizeItem(id, {
      ...old,
      name,
      price8:Number.isFinite(price8) && price8 >= 0 ? price8 : old.price8,
      available4,
      price4:available4 && Number.isFinite(price4Value) && price4Value > 0
        ? price4Value
        : (available4 ? old.price4 || defaultFourPrice(name) : 0)
    });
  });
  return next;
}

function collectCloudinarySettings(){
  const old = currentConfig.cloudinary || {};
  const cloudName = clean(document.getElementById('foodMenuCloudName')?.value ?? old.cloudName).replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  const uploadPreset = clean(document.getElementById('foodMenuUploadPreset')?.value ?? old.uploadPreset);
  const folder = clean(document.getElementById('foodMenuCloudFolder')?.value ?? old.folder || 'azobss/food-menu').replace(/^\/+|\/+$/g, '') || 'azobss/food-menu';
  currentConfig.cloudinary = { cloudName:cloudName.slice(0,120), uploadPreset:uploadPreset.slice(0,160), folder:folder.slice(0,240) };
  return currentConfig.cloudinary;
}

async function persistConfig(message = 'Perubahan menu berjaya disimpan.'){
  if(!currentAccess.allowed) throw new Error('Akses pengurusan menu tidak dibenarkan.');
  await setDoc(CONFIG_REF, {
    version:680,
    items:currentConfig.items,
    uploadedImages:currentConfig.uploadedImages,
    hiddenDefaultImages:currentConfig.hiddenDefaultImages,
    cloudinary:currentConfig.cloudinary || { cloudName:'', uploadPreset:'', folder:'azobss/food-menu' },
    imageProvider:'cloudinary',
    updatedAt:serverTimestamp(),
    updatedAtMs:Date.now(),
    updatedByUid:currentAccess.user?.uid || '',
    updatedByEmail:lower(currentAccess.user?.email || '')
  }, { merge:true });
  showToast(message, 'success');
}

async function saveManagerChanges(){
  const button = document.getElementById('foodMenuAdminSave');
  try{
    if(button){ button.disabled = true; button.textContent = 'Menyimpan...'; }
    currentConfig.items = collectEditorItems();
    collectCloudinarySettings();
    await persistConfig();
    applyConfig(currentConfig);
  }catch(error){
    console.error('[AZOBSS Food Menu] Save failed:', error);
    showToast(error?.code === 'permission-denied'
      ? 'Akses Firestore ditolak. Publish Firebase Rules 679 terlebih dahulu.'
      : `Gagal menyimpan perubahan: ${clean(error?.message) || 'ralat tidak diketahui'}`, 'warning');
  }finally{
    if(button){ button.disabled = false; button.textContent = 'Simpan Semua Perubahan'; }
  }
}

function safeFileName(name){
  return clean(name).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'brownies';
}

async function compressImage(file){
  if(file.type === 'image/webp' && file.size < 1200000) return file;
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha:false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Gambar gagal dimampatkan.')), 'image/webp', .86));
  return new File([blob], `${safeFileName(file.name.replace(/\.[^.]+$/, ''))}.webp`, { type:'image/webp' });
}

async function uploadOneImage(file, index, total){
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error(`${file.name}: format tidak disokong.`);
  if(file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: saiz melebihi 5 MB.`);
  const settings = collectCloudinarySettings();
  if(!settings.cloudName || !settings.uploadPreset){
    throw new Error('Masukkan Cloud name dan Unsigned upload preset terlebih dahulu.');
  }
  const optimized = await compressImage(file);
  const form = new FormData();
  form.append('file', optimized, optimized.name);
  form.append('upload_preset', settings.uploadPreset);
  if(settings.folder) form.append('folder', settings.folder);
  form.append('tags', 'azobss,food-menu,brownies');
  form.append('context', `original_name=${file.name.replace(/[|=]/g, '-')}`);
  const status = document.getElementById('foodMenuUploadStatus');
  if(status) status.textContent = `Menghantar gambar ${index}/${total} ke Cloudinary...`;
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName)}/image/upload`;
  const response = await fetch(endpoint, { method:'POST', body:form });
  const data = await response.json().catch(() => ({}));
  if(!response.ok || !data.secure_url){
    throw new Error(data?.error?.message || `Cloudinary menolak upload (${response.status}).`);
  }
  return {
    id:`cloudinary-${clean(data.asset_id || data.public_id || Date.now()).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100)}`,
    url:clean(data.secure_url),
    provider:'cloudinary',
    publicId:clean(data.public_id),
    assetId:clean(data.asset_id),
    name:file.name.slice(0,140),
    createdAtMs:Date.now()
  };
}

async function uploadSelectedImages(){
  const input = document.getElementById('foodMenuImageInput');
  const button = document.getElementById('foodMenuUploadBtn');
  const status = document.getElementById('foodMenuUploadStatus');
  const files = Array.from(input?.files || []).slice(0, 10);
  currentConfig.items = collectEditorItems();
  collectCloudinarySettings();
  if(!files.length){ showToast('Pilih sekurang-kurangnya satu gambar.', 'warning'); return; }
  try{
    if(button) button.disabled = true;
    const added = [];
    for(let index = 0; index < files.length; index += 1){
      added.push(await uploadOneImage(files[index], index + 1, files.length));
    }
    currentConfig.uploadedImages = [...(currentConfig.uploadedImages || []), ...added].slice(-40);
    await persistConfig(`${added.length} gambar berjaya dimuat naik.`);
    if(input) input.value = '';
    if(status) status.textContent = 'Selesai';
    applyConfig(currentConfig);
  }catch(error){
    console.error('[AZOBSS Food Menu] Upload failed:', error);
    if(status) status.textContent = '';
    showToast(`Gagal upload ke Cloudinary: ${clean(error?.message) || 'ralat tidak diketahui'}`, 'warning');
  }finally{
    if(button) button.disabled = false;
  }
}

async function deleteUploadedImage(id){
  currentConfig.items = collectEditorItems();
  collectCloudinarySettings();
  const image = (currentConfig.uploadedImages || []).find(item => item.id === id);
  if(!image) return;
  const publicIdText = image.publicId ? `\n\nPublic ID Cloudinary: ${image.publicId}` : '';
  if(!confirm(`Padam gambar “${image.name || id}” daripada website?${publicIdText}\n\nFail asal masih kekal dalam Cloudinary dan boleh dipadam melalui Cloudinary Console.`)) return;
  try{
    currentConfig.uploadedImages = currentConfig.uploadedImages.filter(item => item.id !== id);
    await persistConfig('Gambar dikeluarkan daripada website. Fail asal masih berada dalam Cloudinary.');
    applyConfig(currentConfig);
  }catch(error){
    console.error('[AZOBSS Food Menu] Delete image reference failed:', error);
    showToast(`Gagal memadam gambar daripada website: ${clean(error?.message) || 'ralat tidak diketahui'}`, 'warning');
  }
}

function updateManagerVisibility(){
  ensureManagerUi();
  const toolbar = document.getElementById('foodMenuAdminToolbar');
  if(toolbar) toolbar.hidden = !currentAccess.allowed;
  if(!currentAccess.allowed){
    const modal = document.getElementById('foodMenuAdminModal');
    if(modal) modal.hidden = true;
    document.body.style.overflow = '';
  }
}

function startConfigListener(){
  if(unsubscribeConfig) return;
  unsubscribeConfig = onSnapshot(CONFIG_REF, snapshot => {
    applyConfig(snapshot.exists() ? snapshot.data() : {});
  }, error => {
    console.warn('[AZOBSS Food Menu] Config read failed, using built-in menu:', error);
    applyConfig({});
  });
}

captureDefaults();
ensureManagerUi();
startConfigListener();
onAuthStateChanged(auth, user => { refreshAccess(user); });
window.addEventListener('azobss-auth-changed', () => setTimeout(() => refreshAccess(auth.currentUser), 60));
window.addEventListener('storage', () => setTimeout(() => refreshAccess(auth.currentUser), 60));
window.addEventListener('focus', () => refreshAccess(auth.currentUser));
[120, 500, 1200, 2500, 5000].forEach(delay => setTimeout(() => refreshAccess(auth.currentUser), delay));
