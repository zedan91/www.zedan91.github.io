// Clean production URLs: /folder/index.html -> /folder/
(function cleanAzobssIndexHtmlUrl(){
  try {
    var path = window.location.pathname || '';
    if (/\/index\.html$/i.test(path)) {
      var cleanPath = path.replace(/index\.html$/i, '');
      window.history.replaceState(null, document.title, cleanPath + window.location.search + (window.location.hash && window.location.hash !== '/' ? window.location.hash : ''));
    }
  } catch (e) {}
})();

// Remove old / hash if user opens/clicks an old cached logo link
(function(){
  if (window.location.hash === '/') {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
})();

// AZOBSS Global Auth (single source of truth for all pages)
// Use this file on every page: <script type="module" src="/assets/js/azobss-global-auth.js"></script>
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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

function addStyle() {
  if (document.getElementById('azobss-global-auth-style')) return;
  const style = document.createElement('style');
  style.id = 'azobss-global-auth-style';
  style.textContent = `
.auth-modal{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;justify-content:center;padding:6px 16px 18px;background:rgba(3,8,20,.72);backdrop-filter:blur(8px);overflow:auto;}
.auth-modal.is-open{display:flex;}
.auth-modal-card{position:relative;width:min(520px,calc(100vw - 28px));margin:0 auto;padding:26px 22px;border:1px solid rgba(35,211,114,.32);border-radius:12px;background:#1d2a3d;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.45);}
.auth-modal-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;}
.auth-modal-top h3{margin:0;font-size:20px;font-weight:800;}
.auth-close-btn{width:28px;height:28px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-size:24px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.auth-close-btn:hover{background:rgba(255,255,255,.2);}
.auth-modal-form{display:grid;gap:14px;}
.auth-modal-form[hidden]{display:none!important;}
.auth-modal-form label{display:grid;gap:8px;font-weight:800;color:#eaf2ff;}
.auth-modal-form input{width:100%;box-sizing:border-box;border:1px solid rgba(211,223,240,.35);border-radius:10px;background:#0d1628;color:#fff;padding:14px;font:inherit;outline:none;}
.auth-modal-form input:focus{border-color:#fff;}
.auth-modal-form .btn{border:0;border-radius:10px;background:#2f6bed;color:#fff;padding:14px 18px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.6);}
.auth-modal-form .btn.signup{background:#22c55e;color:#fff;}
.auth-modal-form .request-error{min-height:18px;margin:0;color:#ff7b7b;font-weight:700;}
.auth-switch-note{margin:0;color:#c7d2e5;text-align:center;}
.auth-switch-note button{border:0;background:transparent;color:#62e6a5;font-weight:800;cursor:pointer;}
.phone-input-row{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;}
.country-code-button{height:48px;border:1px solid rgba(211,223,240,.35);border-radius:10px;background:#0d1628;color:#fff;padding:0 12px;font-weight:800;}
.phone-number-wrap{position:relative;}
.phone-prefix{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#b9c5d8;font-weight:800;}
.phone-number-wrap input{padding-left:54px!important;}
body.is-authenticated .site-auth-actions{display:none!important;}
body.is-authenticated .market-user-tools{display:flex!important;}
body.is-authenticated .user-menu{display:flex!important;}
body:not(.is-authenticated) .market-user-tools{display:none!important;}
.market-user-tools{align-items:center!important;}
.user-menu{position:relative!important;}
.user-menu.is-open .user-dropdown{display:block!important;}
.user-dropdown{z-index:3300!important;}
.market-nav a.market-nav-active{background:#22c55e!important;border-color:#22c55e!important;color:#052e16!important;text-shadow:none!important;box-shadow:0 0 15px rgba(34,197,94,.34),inset 0 0 0 1px rgba(255,255,255,.12)!important;}
`;
  document.head.appendChild(style);
}

function injectModal() {
  if (document.getElementById('siteAuthModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="auth-modal" id="siteAuthModal" aria-hidden="true">
  <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="siteAuthTitle">
    <div class="auth-modal-top">
      <h3 id="siteAuthTitle">Sign in</h3>
      <button class="auth-close-btn" id="siteAuthClose" type="button" aria-label="Close">×</button>
    </div>
    <form class="auth-modal-form" id="siteSignInForm">
      <label for="siteLoginUsername">Username
        <input id="siteLoginUsername" autocomplete="username" placeholder="Enter your username" required type="text">
      </label>
      <label for="siteLoginPassword">Password
        <input id="siteLoginPassword" autocomplete="current-password" placeholder="Password" required type="password">
      </label>
      <p class="request-error" id="siteLoginError"></p>
      <button class="btn" type="submit">Login</button>
      <p class="auth-switch-note">Don't have an account? <button id="switchToSiteSignup" type="button">Register</button></p>
    </form>
    <form class="auth-modal-form" id="siteSignUpForm" hidden>
      <label for="siteSignupUsername">Username
        <input id="siteSignupUsername" autocomplete="username" placeholder="Choose a username" required type="text">
      </label>
      <label for="siteSignupPassword">Password
        <input id="siteSignupPassword" autocomplete="new-password" placeholder="Minimum 6 characters" minlength="6" required type="password">
      </label>
      <label for="siteSignupPhone">WhatsApp Number
        <div class="phone-input-row">
          <button class="country-code-button" type="button" tabindex="-1">🇲🇾 +60</button>
          <div class="phone-number-wrap"><span class="phone-prefix">+60</span><input id="siteSignupPhone" inputmode="tel" placeholder="12 345 6789" required type="tel"></div>
        </div>
      </label>
      <label for="siteSignupEmail">Email
        <input id="siteSignupEmail" inputmode="email" placeholder="Example: name@email.com" required type="email">
      </label>
      <label for="siteSignupInviteCode">Member / Invite Code
        <input id="siteSignupInviteCode" placeholder="Enter member code if available (optional)" type="text">
      </label>
      <p class="request-error" id="siteSignupError"></p>
      <button class="btn signup" type="submit">Sign up</button>
      <p class="auth-switch-note">Already have an account? <button id="switchToSiteSignin" type="button">Sign in</button></p>
    </form>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}

const $ = (id) => document.getElementById(id);
function normalizeUsername(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');}
function buildUserEmail(usernameKey){return `${usernameKey}@azobss.local`;}
function cleanPhone(value){return String(value||'').replace(/[^0-9]/g,'').replace(/^60/,'').replace(/^0+/,'');}
function buildInviteCode(usernameKey){return `AZ${String(usernameKey||'USER').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6)}`;}
function initials(name){return String(name||'AZ').trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('')||'AZ';}
function safeJson(raw){try{return JSON.parse(raw||'null');}catch{return null;}}
function saveUser(user){
  const value = JSON.stringify(user);
  sessionStorage.setItem('azobssCurrentUser', value);
  localStorage.setItem('azobssCurrentUser', value);
  sessionStorage.setItem('azobssLoggedIn', '1');
  localStorage.setItem('azobssLoggedIn', '1');
  window.dispatchEvent(new Event('storage'));
}
function clearUser(){
  ['azobssCurrentUser','azobssUser','azobssLoggedIn'].forEach((key)=>{
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  window.dispatchEvent(new Event('storage'));
}
function getSavedUser(){
  return safeJson(sessionStorage.getItem('azobssCurrentUser')) ||
    safeJson(localStorage.getItem('azobssCurrentUser')) ||
    safeJson(sessionStorage.getItem('azobssUser')) ||
    safeJson(localStorage.getItem('azobssUser'));
}

// Expose auth helpers for legacy admin panels in index.html and PA-BM/index.html.
window.getSavedUser = getSavedUser;
window.hasSavedLogin = function(){ return !!getSavedUser(); };
window.azobssIsAdminUser = isAzobssAdmin;
window.azobssHasPaBmAccess = hasPaBmTabAccess;
function fieldValue(...ids){
  for (const id of ids) {
    const el = $(id);
    if (el) return el.value || '';
  }
  return '';
}

function normalizeUserMenu() {
  const dropdown = $('userDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = `
    <div class="user-dropdown-section">Buying</div>
    <a class="user-dropdown-item" href="/#purchases" role="menuitem">My purchases</a>
    <a class="user-dropdown-item" href="/affiliate-shop/#likes" role="menuitem">Likes</a>
    <div class="user-dropdown-section">Account</div>
    <button class="user-dropdown-item" id="profileSettingsButton" type="button" role="menuitem">Settings</button>
    <button class="user-dropdown-item" id="logoutButton" type="button" role="menuitem">Log out</button>`;
}

function normalizePath(pathname) {
  return String(pathname || '/')
    .toLowerCase()
    .replace(/\/index\.html$/, '/')
    .replace(/\/+$/, '/');
}

function getActiveNavPath() {
  const path = normalizePath(location.pathname);
  if (path === '/') return '';
  if (path.includes('/pa-bm/')) return '/pa-bm/';
  if (path.includes('/software-tools/')) return '/software-tools/';
  if (path.includes('/cad-tools-&-resources/') || path.includes('/cad-tools-%26-resources/')) return '/cad-tools-&-resources/';
  if (path.includes('/affiliate-shop/')) return '/affiliate-shop/';
  if (path.includes('/lucky-draw/')) return '/lucky-draw/';
  if (path.includes('/tools/')) return '/tools/';
  return '';
}

function syncActiveNav() {
  const activePath = getActiveNavPath();
  document.querySelectorAll('.market-nav a').forEach((link) => {
    link.classList.remove('market-nav-primary', 'is-active', 'market-nav-active');
    if (!activePath) return;

    let linkPath = '';
    try {
      linkPath = normalizePath(new URL(link.getAttribute('href') || '', location.href).pathname);
    } catch {
      linkPath = '';
    }

    if (linkPath.includes(activePath)) {
      link.classList.add('market-nav-active');
    }
  });
}

function injectProfileSettingsModal() {
  if (document.getElementById('profileSettingsModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div aria-hidden="true" class="auth-modal" id="profileSettingsModal">
  <div aria-labelledby="profileSettingsTitle" aria-modal="true" class="auth-modal-card" role="dialog">
    <div class="auth-modal-top">
      <h3 id="profileSettingsTitle">Edit Profile</h3>
      <button aria-label="Close" class="auth-close-btn" id="profileSettingsClose" type="button">×</button>
    </div>
    <form class="auth-modal-form" id="profileSettingsForm">
      <label for="profileEditName">Username / Name<input id="profileEditName" placeholder="Username" required type="text"></label>
      <label for="profileEditPhone">Phone Number<input id="profileEditPhone" inputmode="tel" placeholder="Example: 01135600723" type="tel"></label>
      <label for="profileEditEmail">Contact Email<input id="profileEditEmail" inputmode="email" placeholder="Example: name@email.com" type="email"></label>
      <p class="profile-settings-note">This updates the local profile display on this website.</p>
      <div class="profile-password-box" aria-label="Reset Password">
        <p class="profile-password-title">Reset Password</p>
        <p class="profile-password-help">For security, enter your current password first, then set a new password.</p>
        <label for="profileCurrentPassword">Current Password<input id="profileCurrentPassword" autocomplete="current-password" placeholder="Current password" type="password"></label>
        <label for="profileNewPassword">New Password<input id="profileNewPassword" autocomplete="new-password" minlength="6" placeholder="Minimum 6 characters" type="password"></label>
        <label for="profileConfirmPassword">Confirm New Password<input id="profileConfirmPassword" autocomplete="new-password" minlength="6" placeholder="Re-enter new password" type="password"></label>
        <button class="btn secondary" id="profileResetPasswordButton" type="button">Reset Password</button>
      </div>
      <p class="request-error" id="profileSettingsError"></p>
      <div class="profile-settings-actions">
        <button class="btn" id="profileSettingsSaveButton" type="submit">Save Changes</button>
        <button class="btn" id="profileSettingsCancelButton" type="button">Cancel</button>
      </div>
    </form>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}

const AZOBSS_ADMIN_USERS = ['zedan91'];
const AZOBSS_PA_MEMBER_CODE = 'ZX6186';
function getUserKey(user){ return String(user?.usernameKey || user?.name || (user?.email ? String(user.email).split('@')[0] : '') || '').trim().toLowerCase(); }
function isAzobssAdmin(user){
  const key = getUserKey(user);
  const role = String(user?.role || '').trim().toLowerCase();
  return !!(user && (role === 'admin' || AZOBSS_ADMIN_USERS.includes(key)));
}
function normalizePaMemberCode(value){
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function getPaMemberCodes(user){
  const u = user || {};
  const savedCode = normalizePaMemberCode(localStorage.getItem('azobssPaMemberCode') || sessionStorage.getItem('azobssPaMemberCode') || '');
  return [
    u.invitedByCode,
    u.memberCode,
    u.paMemberCode,
    u.accessCode,
    u.inviteCodeUsed,
    u.signupCode,
    u.member_code,
    u.referralCode,
    // Some older builds stored the entered member code in inviteCode.
    u.inviteCode,
    savedCode
  ].map(normalizePaMemberCode).filter(Boolean);
}
function hasPaBmTabAccess(user){
  if (!user) return false;
  if (isAzobssAdmin(user)) return true;
  return getPaMemberCodes(user).includes(AZOBSS_PA_MEMBER_CODE);
}

function syncHeader(user){
  const authActions = $('siteAuthActions');
  const tools = $('marketUserTools');
  const name = $('signedInName');
  const avatar = $('userAvatar');
  const paBmButtons = Array.from(document.querySelectorAll('#paBmNavButton, .nav-pa-bm-link'));
  const display = user && (user.usernameKey || user.name || (user.email ? String(user.email).split('@')[0] : ''));
  const canShowPaBm = hasPaBmTabAccess(user);
  const isAdminUser = isAzobssAdmin(user);
  document.body.classList.toggle('is-admin', !!isAdminUser);
  document.body.classList.toggle('has-pa-access', !!canShowPaBm);
  paBmButtons.forEach((paBm) => {
    paBm.hidden = !canShowPaBm;
    paBm.classList.toggle('is-hidden', !canShowPaBm);
    paBm.style.setProperty('display', canShowPaBm ? 'inline-flex' : 'none', 'important');
    paBm.style.setProperty('visibility', canShowPaBm ? 'visible' : 'hidden', 'important');
    paBm.style.setProperty('pointer-events', canShowPaBm ? 'auto' : 'none', 'important');
  });
  if (display) {
    document.body.classList.add('is-authenticated');
    if (name) name.textContent = display;
    if (avatar) avatar.textContent = initials(display);
    if (authActions) authActions.style.setProperty('display','none','important');
    if (tools) tools.style.setProperty('display','flex','important');
  } else {
    document.body.classList.remove('is-authenticated');
    if (authActions) authActions.style.removeProperty('display');
    if (tools) tools.style.removeProperty('display');
    document.querySelectorAll('.user-menu.is-open').forEach(el=>{el.classList.remove('is-open'); el.setAttribute('aria-expanded','false');});
  }
}

function openSiteAuth(mode='signin'){
  const modal=$('siteAuthModal'), title=$('siteAuthTitle'), signInForm=$('siteSignInForm'), signUpForm=$('siteSignUpForm');
  if(!modal || !signInForm || !signUpForm) return;
  const isSignup=mode==='signup' || mode==='register';
  if(title) title.textContent=isSignup?'Sign up':'Sign in';
  signInForm.hidden=isSignup;
  signUpForm.hidden=!isSignup;
  const loginError=$('siteLoginError'), signupError=$('siteSignupError');
  if(loginError) loginError.textContent='';
  if(signupError) signupError.textContent='';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  setTimeout(()=>{(isSignup?($('siteSignupUsername')||$('siteSignupName')):($('siteLoginUsername')||$('siteLoginName')))?.focus();},40);
}
function closeSiteAuth(){const modal=$('siteAuthModal'); if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}}
function openProfileSettings(){
  const modal=$('profileSettingsModal'); if(!modal) return;
  const user=getSavedUser() || {};
  if($('profileEditName')) $('profileEditName').value=user.usernameKey || user.name || '';
  if($('profileEditPhone')) $('profileEditPhone').value=user.phone || '';
  if($('profileEditEmail')) $('profileEditEmail').value=user.email || '';
  const err=$('profileSettingsError'); if(err) err.textContent='';
  ['profileCurrentPassword','profileNewPassword','profileConfirmPassword'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false');
}
function closeProfileSettings(){const modal=$('profileSettingsModal'); if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}}
window.openSiteAuth = openSiteAuth;
window.closeSiteAuth = closeSiteAuth;

async function ensureUserProfile(firebaseUser, fallback={}){
  const usernameKey = fallback.usernameKey || normalizeUsername(firebaseUser.email?.split('@')[0] || 'user');
  const ref = doc(db, 'users', usernameKey);
  const snap = await getDoc(ref);
  if(snap.exists()) return { uid: firebaseUser.uid, ...snap.data() };
  const fallbackMemberCode = normalizePaMemberCode(fallback.invitedByCode || fallback.memberCode || fallback.paMemberCode || '');
  const profile={uid:firebaseUser.uid,usernameKey,email:fallback.email||firebaseUser.email||'',phone:fallback.phone||'',inviteCode:buildInviteCode(usernameKey),invitedByCode:fallbackMemberCode,memberCode:fallbackMemberCode,paMemberCode:fallbackMemberCode,role:'member',createdAt:serverTimestamp()};
  await setDoc(ref,profile,{merge:true});
  return profile;
}



// PA/BM purchase records: one shared source for PA + BM/SBM downloads.
const AZOBSS_PURCHASE_LOCAL_KEY = 'azobssPurchaseRecords';
const AZOBSS_PURCHASE_COLLECTION = 'purchaseRecords';
function readLocalPurchaseRecords(){
  try { return JSON.parse(localStorage.getItem(AZOBSS_PURCHASE_LOCAL_KEY) || '[]') || []; }
  catch { return []; }
}
function writeLocalPurchaseRecords(records){
  try { localStorage.setItem(AZOBSS_PURCHASE_LOCAL_KEY, JSON.stringify(records || [])); } catch {}
}
function purchaseRecordUser(user){
  const u = user || getSavedUser() || {};
  return {
    uid: String(u.uid || ''),
    usernameKey: String(u.usernameKey || u.name || (u.email ? String(u.email).split('@')[0] : '') || '').trim().toLowerCase(),
    displayName: String(u.usernameKey || u.name || (u.email ? String(u.email).split('@')[0] : '') || 'Guest').trim(),
    phone: String(u.phone || ''),
    email: String(u.email || '')
  };
}
function normalizePurchasePayload(payload){
  const userInfo = purchaseRecordUser();
  const type = String(payload?.productType || payload?.product || payload?.type || 'PA').trim().toUpperCase();
  const code = String(payload?.itemCode || payload?.code || payload?.station || payload?.pa || payload?.noPA || '').trim().toUpperCase();
  const negeri = String(payload?.negeri || payload?.state || payload?.stateName || '').trim();
  const amount = Number(payload?.amount || payload?.price || (type === 'PA' ? 5 : 3));
  const now = new Date();
  return {
    id: 'local-' + now.getTime() + '-' + Math.random().toString(36).slice(2, 8),
    productType: type,
    itemCode: code,
    negeri,
    amount: Number.isFinite(amount) ? amount : (type === 'PA' ? 5 : 3),
    downloadUrl: String(payload?.downloadUrl || payload?.url || ''),
    filename: String(payload?.filename || ''),
    uid: userInfo.uid,
    usernameKey: userInfo.usernameKey,
    displayName: userInfo.displayName,
    phone: userInfo.phone,
    email: userInfo.email,
    createdAtClient: now.toISOString(),
    createdAtMs: now.getTime()
  };
}
function isSamePurchase(a,b){
  return String(a.id||'') && String(a.id||'') === String(b.id||'') ||
    (String(a.usernameKey||'') === String(b.usernameKey||'') &&
     String(a.productType||'') === String(b.productType||'') &&
     String(a.itemCode||'') === String(b.itemCode||'') &&
     Math.abs(Number(a.createdAtMs||0)-Number(b.createdAtMs||0)) < 3000);
}
async function recordAzobssPurchase(payload){
  const user = getSavedUser();
  if(!user){
    openSiteAuth('signin');
    throw new Error('Please login first before download.');
  }
  const record = normalizePurchasePayload(payload || {});
  const local = readLocalPurchaseRecords();
  if(!local.some(item => isSamePurchase(item, record))){
    local.unshift(record);
    writeLocalPurchaseRecords(local.slice(0, 500));
  }
  try{
    const firestoreRecord = { ...record, createdAt: serverTimestamp() };
    delete firestoreRecord.id;
    const ref = await addDoc(collection(db, AZOBSS_PURCHASE_COLLECTION), firestoreRecord);
    record.firestoreId = ref.id;
  }catch(error){
    console.warn('Firestore purchase record fallback to localStorage:', error);
  }
  window.dispatchEvent(new CustomEvent('azobssPurchaseRecorded', { detail: record }));
  try{ window.dispatchEvent(new Event('storage')); }catch{}
  return record;
}
async function loadAzobssPurchaseRecords(){
  const current = getSavedUser();
  const isAdminUser = isAzobssAdmin(current);
  const merged = [];
  function push(record){
    if(!record) return;
    const normalized = { ...record };
    normalized.createdAtMs = Number(normalized.createdAtMs || (normalized.createdAtClient ? Date.parse(normalized.createdAtClient) : 0) || 0);
    if(!merged.some(item => isSamePurchase(item, normalized))) merged.push(normalized);
  }
  readLocalPurchaseRecords().forEach(push);
  try{
    const snap = await getDocs(collection(db, AZOBSS_PURCHASE_COLLECTION));
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      let ms = Number(data.createdAtMs || 0);
      if(!ms && data.createdAtClient) ms = Date.parse(data.createdAtClient) || 0;
      if(!ms && data.createdAt && typeof data.createdAt.toMillis === 'function') ms = data.createdAt.toMillis();
      push({ id: docSnap.id, firestoreId: docSnap.id, ...data, createdAtMs: ms });
    });
  }catch(error){
    console.warn('Firestore purchase records read fallback to localStorage:', error);
  }
  const key = getUserKey(current);
  return merged
    .filter(item => isAdminUser || String(item.usernameKey || '').toLowerCase() === key || (current?.uid && String(item.uid||'') === String(current.uid)))
    .sort((a,b) => Number(b.createdAtMs||0) - Number(a.createdAtMs||0));
}
function escHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function formatPurchaseDate(record){
  const ms = Number(record.createdAtMs || (record.createdAtClient ? Date.parse(record.createdAtClient) : 0));
  if(!ms) return '-';
  return new Date(ms).toLocaleString('en-MY', { hour12:false });
}
const AZOBSS_PURCHASE_PAGE_SIZE = 4;
let azobssAdminPurchasePage = 1;
let azobssUserPurchasePage = 1;
function clampPage(page, totalPages){
  return Math.max(1, Math.min(Number(page)||1, Math.max(1, totalPages||1)));
}
function renderAzobssPager(container, currentPage, totalItems, pageSize, onPage){
  if(!container) return;
  const totalPages = Math.max(1, Math.ceil((Number(totalItems)||0) / pageSize));
  if(totalItems <= pageSize){
    container.innerHTML = '';
    container.hidden = true;
    return;
  }
  container.hidden = false;
  const button = (label, page, disabled, active) => `<button type="button" class="${active ? 'is-active' : ''}" data-page="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  pages.push(button('← Previous', Math.max(1, currentPage - 1), currentPage === 1, false));
  if(start > 1){
    pages.push(button('1', 1, false, currentPage === 1));
    if(start > 2) pages.push('<span class="pager-dots">...</span>');
  }
  for(let i=start; i<=end; i++) pages.push(button(String(i), i, false, currentPage === i));
  if(end < totalPages){
    if(end < totalPages - 1) pages.push('<span class="pager-dots">...</span>');
    pages.push(button(String(totalPages), totalPages, false, currentPage === totalPages));
  }
  pages.push(button('Next →', Math.min(totalPages, currentPage + 1), currentPage === totalPages, false));
  container.innerHTML = pages.join('');
  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => onPage(Number(btn.dataset.page)));
  });
}
function purchaseRowHtml(r){
  return `
    <div class="purchase-summary-item">
      <strong>${escHtml(r.productType || 'PA')} ${escHtml(r.itemCode || '-')}</strong>
      <span>${escHtml(r.negeri || '-')} · RM${escHtml(r.amount || '')} · ${escHtml(formatPurchaseDate(r))}</span>
      ${r.downloadUrl ? `<a class="small-action-btn blue" href="${escHtml(r.downloadUrl)}" target="_blank" rel="noopener">Download</a>` : ''}
    </div>`;
}
async function renderAzobssPurchaseRecords(){
  const list = document.getElementById('purchaseSummaryList');
  const userList = document.getElementById('userPaPurchaseList');
  if(!list && !userList) return;
  const current = getSavedUser();
  const isAdminUser = isAzobssAdmin(current);
  const search = String(document.getElementById('purchaseRecordSearch')?.value || document.getElementById('userPaPurchaseSearch')?.value || '').trim().toLowerCase();
  const sort = String(document.getElementById('purchaseRecordSort')?.value || document.getElementById('userPaPurchaseSort')?.value || 'newest');
  let records = await loadAzobssPurchaseRecords();
  if(search){
    records = records.filter(r => [r.usernameKey,r.displayName,r.phone,r.email,r.productType,r.itemCode,r.negeri].join(' ').toLowerCase().includes(search));
  }
  if(sort === 'oldest') records.sort((a,b)=>Number(a.createdAtMs||0)-Number(b.createdAtMs||0));
  else records.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));

  if(isAdminUser){
    const groups = new Map();
    records.forEach(r => {
      const k = String(r.usernameKey || r.displayName || 'unknown').toLowerCase();
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    });
    const groupedRows = Array.from(groups.entries());
    const totalPages = Math.max(1, Math.ceil(groupedRows.length / AZOBSS_PURCHASE_PAGE_SIZE));
    azobssAdminPurchasePage = clampPage(azobssAdminPurchasePage, totalPages);
    const pageRows = groupedRows.slice((azobssAdminPurchasePage - 1) * AZOBSS_PURCHASE_PAGE_SIZE, azobssAdminPurchasePage * AZOBSS_PURCHASE_PAGE_SIZE);
    if(list){
      list.innerHTML = pageRows.map(([key, rows]) => {
        const first = rows[0] || {};
        const total = rows.reduce((sum,r)=>sum + (Number(r.amount)||0), 0);
        return `<div class="purchase-summary-item admin-purchase-user-card">
          <div class="admin-purchase-user-top">
            <div><strong>${escHtml(first.displayName || key)}</strong><span>${escHtml(first.phone || '')} ${first.email ? '· '+escHtml(first.email) : ''}</span></div>
            <span>${rows.length} record(s) · RM${total}</span>
          </div>
          <div class="admin-purchase-user-details">
            ${rows.map(r => `<div>• ${escHtml(r.productType)} ${escHtml(r.itemCode || '-')} · ${escHtml(r.negeri || '-')} · RM${escHtml(r.amount || '')} · ${escHtml(formatPurchaseDate(r))}</div>`).join('')}
          </div>
        </div>`;
      }).join('') || '<div class="purchase-summary-item">No purchase records yet.</div>';
    }
    renderAzobssPager(document.getElementById('purchaseRecordsPagination'), azobssAdminPurchasePage, groupedRows.length, AZOBSS_PURCHASE_PAGE_SIZE, page => {
      azobssAdminPurchasePage = page;
      renderAzobssPurchaseRecords();
    });
    if(userList) userList.innerHTML = '';
    renderAzobssPager(document.getElementById('userPaPurchasePagination'), 1, 0, AZOBSS_PURCHASE_PAGE_SIZE, function(){});
  }else{
    const totalPages = Math.max(1, Math.ceil(records.length / AZOBSS_PURCHASE_PAGE_SIZE));
    azobssUserPurchasePage = clampPage(azobssUserPurchasePage, totalPages);
    const visibleRecords = records.slice((azobssUserPurchasePage - 1) * AZOBSS_PURCHASE_PAGE_SIZE, azobssUserPurchasePage * AZOBSS_PURCHASE_PAGE_SIZE);
    const simpleRows = visibleRecords.map(purchaseRowHtml).join('');
    if(userList){
      userList.innerHTML = simpleRows || '<div class="purchase-summary-item">No PA purchase list yet.</div>';
    }
    if(list){
      list.innerHTML = simpleRows || '<div class="purchase-summary-item">No purchase records yet.</div>';
    }
    const onUserPage = page => {
      azobssUserPurchasePage = page;
      renderAzobssPurchaseRecords();
    };
    renderAzobssPager(document.getElementById('userPaPurchasePagination'), azobssUserPurchasePage, records.length, AZOBSS_PURCHASE_PAGE_SIZE, onUserPage);
    renderAzobssPager(document.getElementById('purchaseRecordsPagination'), azobssUserPurchasePage, records.length, AZOBSS_PURCHASE_PAGE_SIZE, onUserPage);
  }
}
function bindAzobssPurchaseRecordsUI(){
  ['refreshPurchaseButton','purchaseRecordSearch','purchaseRecordSort','userPaPurchaseSearch','userPaPurchaseSort'].forEach(id => {
    const el = document.getElementById(id);
    if(!el || el.dataset.azobssPurchaseBind) return;
    el.dataset.azobssPurchaseBind = '1';
    const handler = () => {
      if(id !== 'refreshPurchaseButton'){
        azobssAdminPurchasePage = 1;
        azobssUserPurchasePage = 1;
      }
      renderAzobssPurchaseRecords();
    };
    el.addEventListener(el.tagName === 'BUTTON' ? 'click' : 'input', handler);
    if(el.tagName === 'SELECT') el.addEventListener('change', handler);
  });
  if(document.getElementById('purchaseSummaryList') || document.getElementById('userPaPurchaseList')){
    renderAzobssPurchaseRecords();
  }
}
window.azobssRecordPurchase = recordAzobssPurchase;
window.azobssLoadPurchaseRecords = loadAzobssPurchaseRecords;
window.azobssRenderPurchaseRecords = renderAzobssPurchaseRecords;
window.addEventListener('azobssPurchaseRecorded', renderAzobssPurchaseRecords);
window.addEventListener('storage', renderAzobssPurchaseRecords);

function bindAuth() {
  addStyle(); injectModal(); injectProfileSettingsModal(); normalizeUserMenu(); syncActiveNav(); syncHeader(getSavedUser()); bindAzobssPurchaseRecordsUI();

  document.addEventListener('click', async (event) => {
    if (event.target.closest('#logoutButton')) {
      event.preventDefault();
      event.stopPropagation();
      await signOut(auth).catch(()=>{});
      clearUser();
      syncHeader(null);
      return;
    }

    if (event.target.closest('#profileSettingsButton')) {
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.user-menu.is-open').forEach(el=>{el.classList.remove('is-open'); el.setAttribute('aria-expanded','false');});
      openProfileSettings();
      return;
    }

    const opener = event.target.closest('[data-auth-open], [data-auth], #siteSignInButton, #siteSignUpButton, a[href$="#login"], a[href$="#signin"], a[href$="#signup"], a[href$="#register"]');
    if (opener) {
      event.preventDefault(); event.stopPropagation();
      const value = opener.dataset.authOpen || opener.dataset.auth || opener.getAttribute('href') || opener.id || '';
      openSiteAuth(/sign.?up|register|signup/i.test(value) ? 'signup' : 'signin');
      return;
    }
    if (event.target.closest('#siteAuthClose') || event.target.id === 'siteAuthModal') closeSiteAuth();
    if (event.target.closest('#profileSettingsClose') || event.target.closest('#profileSettingsCancelButton') || event.target.id === 'profileSettingsModal') closeProfileSettings();
    if (event.target.closest('#switchToSiteSignup')) openSiteAuth('signup');
    if (event.target.closest('#switchToSiteSignin')) openSiteAuth('signin');
    const menu = event.target.closest('#userMenu');
    if (menu) {
      event.stopPropagation();
      if (event.target.closest('.user-dropdown')) return;
      menu.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', menu.classList.contains('is-open') ? 'true' : 'false');
    }
    else document.querySelectorAll('.user-menu.is-open').forEach(el=>el.classList.remove('is-open'));
  }, true);

  document.addEventListener('keydown', (event)=>{
    if (event.key === 'Escape') {
      document.querySelectorAll('.user-menu.is-open').forEach(el=>{el.classList.remove('is-open'); el.setAttribute('aria-expanded','false');});
      closeSiteAuth();
      closeProfileSettings();
    }
  });

  document.querySelectorAll('#userMenu').forEach((menu)=>{
    menu.addEventListener('keydown', (event)=>{
      if (event.target.closest('.user-dropdown')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        menu.classList.toggle('is-open');
        menu.setAttribute('aria-expanded', menu.classList.contains('is-open') ? 'true' : 'false');
      }
    });
  });

  $('siteSignInForm')?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    const err=$('siteLoginError'); if(err) err.textContent='';
    const usernameKey=normalizeUsername(fieldValue('siteLoginUsername','siteLoginName'));
    const password=fieldValue('siteLoginPassword');
    if(!usernameKey || !password){ if(err) err.textContent='Please enter username and password.'; return; }
    try{
      await setPersistence(auth,browserSessionPersistence);
      const credential=await signInWithEmailAndPassword(auth,buildUserEmail(usernameKey),password);
      const profile=await ensureUserProfile(credential.user,{usernameKey});
      saveUser({uid:credential.user.uid,...profile,usernameKey}); syncHeader({uid:credential.user.uid,...profile,usernameKey}); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); closeSiteAuth();
    }catch(error){ if(err) err.textContent = error?.code==='auth/invalid-credential' ? 'Wrong username or password.' : 'Login failed. Please try again.'; }
  });

  $('siteSignUpForm')?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    const err=$('siteSignupError'); if(err) err.textContent='';
    const usernameKey=normalizeUsername(fieldValue('siteSignupUsername','siteSignupName'));
    const password=fieldValue('siteSignupPassword');
    const phone=cleanPhone(fieldValue('siteSignupPhone'));
    const email=String(fieldValue('siteSignupEmail')).trim().toLowerCase();
    const invitedByCode=String(fieldValue('siteSignupInviteCode')).trim().toUpperCase();
    if(!usernameKey || password.length<6 || !phone || !email){ if(err) err.textContent='Please complete all required fields.'; return; }
    try{
      await setPersistence(auth,browserSessionPersistence);
      const credential=await createUserWithEmailAndPassword(auth,buildUserEmail(usernameKey),password);
      const profile={uid:credential.user.uid,usernameKey,email,phone,inviteCode:buildInviteCode(usernameKey),invitedByCode,memberCode:invitedByCode,paMemberCode:invitedByCode,role:'member',createdAt:serverTimestamp()};
      await setDoc(doc(db,'users',usernameKey),profile,{merge:true});
      if (invitedByCode === AZOBSS_PA_MEMBER_CODE) {
        localStorage.setItem('azobssPaMemberCode', AZOBSS_PA_MEMBER_CODE);
        sessionStorage.setItem('azobssPaMemberCode', AZOBSS_PA_MEMBER_CODE);
      }
      saveUser({uid:credential.user.uid,usernameKey,email,phone,inviteCode:buildInviteCode(usernameKey),invitedByCode,memberCode:invitedByCode,paMemberCode:invitedByCode,role:'member'});
      syncHeader({usernameKey,email,phone,invitedByCode,memberCode:invitedByCode,paMemberCode:invitedByCode}); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); closeSiteAuth();
    }catch(error){ if(err) err.textContent = error?.code==='auth/email-already-in-use' ? 'Username already exists.' : 'Sign up failed. Please try again.'; }
  });

  $('profileResetPasswordButton')?.addEventListener('click', async (event)=>{
    event.preventDefault();
    const err=$('profileSettingsError'); if(err) err.textContent='';
    const currentPassword=String($('profileCurrentPassword')?.value||'');
    const newPassword=String($('profileNewPassword')?.value||'');
    const confirmPassword=String($('profileConfirmPassword')?.value||'');
    const saved=getSavedUser() || {};
    const usernameKey=normalizeUsername(saved.usernameKey || saved.name || (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : ''));
    if(!auth.currentUser || !usernameKey){ if(err) err.textContent='Please login again before reset password.'; return; }
    if(!currentPassword || !newPassword || !confirmPassword){ if(err) err.textContent='Please enter current password and new password.'; return; }
    if(newPassword.length < 6){ if(err) err.textContent='New password must be at least 6 characters.'; return; }
    if(newPassword !== confirmPassword){ if(err) err.textContent='Confirm password does not match.'; return; }
    try{
      const credential=EmailAuthProvider.credential(buildUserEmail(usernameKey), currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      ['profileCurrentPassword','profileNewPassword','profileConfirmPassword'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
      if(err){ err.style.color='#62e6a5'; err.textContent='Password updated successfully.'; setTimeout(()=>{ if(err.textContent==='Password updated successfully.'){ err.textContent=''; err.style.color=''; } }, 3500); }
    }catch(error){
      if(err){ err.style.color=''; err.textContent = error?.code==='auth/wrong-password' || error?.code==='auth/invalid-credential' ? 'Current password is wrong.' : 'Password reset failed. Please login again and try.'; }
    }
  });

  $('profileSettingsForm')?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    const current=getSavedUser() || {};
    const updated={...current,
      usernameKey: normalizeUsername($('profileEditName')?.value) || current.usernameKey || current.name || '',
      phone: cleanPhone($('profileEditPhone')?.value),
      email: String($('profileEditEmail')?.value||'').trim().toLowerCase()
    };
    saveUser(updated); syncHeader(updated); closeProfileSettings();
  });

  onAuthStateChanged(auth, async (firebaseUser)=>{
    if(!firebaseUser){ syncHeader(getSavedUser()); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); return; }
    try{ const profile=await ensureUserProfile(firebaseUser); saveUser({uid:firebaseUser.uid,...profile}); syncHeader({uid:firebaseUser.uid,...profile}); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); }
    catch{ syncHeader(getSavedUser()); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); }
  });

  const hash = String(location.hash || '').toLowerCase();
  if (['#login','#signin'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signin'); }
  if (['#signup','#register'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signup'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAuth);
else bindAuth();
