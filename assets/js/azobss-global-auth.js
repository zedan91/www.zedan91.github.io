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
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
        <input id="siteSignupInviteCode" placeholder="Example: ZX6186 (optional)" type="text">
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
function hasPaBmTabAccess(user){
  const code = String(user?.invitedByCode || user?.memberCode || user?.paMemberCode || '').trim().toUpperCase();
  return !!(user && (isAzobssAdmin(user) || code === AZOBSS_PA_MEMBER_CODE));
}

function syncHeader(user){
  const authActions = $('siteAuthActions');
  const tools = $('marketUserTools');
  const name = $('signedInName');
  const avatar = $('userAvatar');
  const paBm = $('paBmNavButton');
  const display = user && (user.usernameKey || user.name || (user.email ? String(user.email).split('@')[0] : ''));
  const canShowPaBm = hasPaBmTabAccess(user);
  if (paBm) { paBm.hidden = !canShowPaBm; paBm.classList.toggle('is-hidden', !canShowPaBm); }
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
  const profile={uid:firebaseUser.uid,usernameKey,email:fallback.email||firebaseUser.email||'',phone:fallback.phone||'',inviteCode:buildInviteCode(usernameKey),invitedByCode:fallback.invitedByCode||'',memberCode:fallback.invitedByCode||'',role:'member',createdAt:serverTimestamp()};
  await setDoc(ref,profile,{merge:true});
  return profile;
}

function bindAuth() {
  addStyle(); injectModal(); injectProfileSettingsModal(); normalizeUserMenu(); syncActiveNav(); syncHeader(getSavedUser());

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
      saveUser({uid:credential.user.uid,...profile,usernameKey}); syncHeader({uid:credential.user.uid,...profile,usernameKey}); closeSiteAuth();
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
      const profile={uid:credential.user.uid,usernameKey,email,phone,inviteCode:buildInviteCode(usernameKey),invitedByCode,memberCode:invitedByCode,role:'member',createdAt:serverTimestamp()};
      await setDoc(doc(db,'users',usernameKey),profile,{merge:true});
      saveUser({uid:credential.user.uid,usernameKey,email,phone,inviteCode:buildInviteCode(usernameKey),invitedByCode,memberCode:invitedByCode,role:'member'});
      syncHeader({usernameKey,email,phone,invitedByCode}); closeSiteAuth();
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
    if(!firebaseUser){ syncHeader(getSavedUser()); return; }
    try{ const profile=await ensureUserProfile(firebaseUser); saveUser({uid:firebaseUser.uid,...profile}); syncHeader({uid:firebaseUser.uid,...profile}); }
    catch{ syncHeader(getSavedUser()); }
  });

  const hash = String(location.hash || '').toLowerCase();
  if (['#login','#signin'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signin'); }
  if (['#signup','#register'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signup'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAuth);
else bindAuth();
