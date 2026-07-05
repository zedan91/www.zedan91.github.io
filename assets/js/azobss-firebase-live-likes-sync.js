

function getAzobssPhoneDialForInput(input){
  try {
    const row = input && input.closest ? input.closest('[data-country-phone]') : null;
    const hidden = row ? row.querySelector('input[type="hidden"][id$="Dial"]') : null;
    const dial = String(hidden && hidden.value ? hidden.value : '60').replace(/\D/g, '') || '60';
    return dial;
  } catch (e) {
    return '60';
  }
}

function getAzobssMaxLocalDigits(input){
  // ITU E.164: maximum international phone number length is 15 digits including country code.
  const dial = getAzobssPhoneDialForInput(input);
  return Math.max(1, 15 - dial.length);
}

function getPhoneGuideDigits(value, input){
  const max = getAzobssMaxLocalDigits(input);
  let digits = String(value || '').replace(/\D/g, '');
  const dial = getAzobssPhoneDialForInput(input);
  // If user pastes a full international number into local box, remove the country code.
  if (digits.startsWith(dial) && digits.length > dial.length + 3) digits = digits.slice(dial.length);
  // If user pastes a local Malaysia-style 0 prefix after choosing MY +60, remove only that local trunk 0.
  if (dial === '60' && digits.startsWith('0') && digits.length > 1) digits = digits.slice(1);
  return digits.slice(0, max);
}

function formatPhoneGuide(value, input){
  const digits = getPhoneGuideDigits(value, input);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return digits.slice(0, 2) + '-' + digits.slice(2);
  return digits.slice(0, 2) + '-' + digits.slice(2, 6) + ' ' + digits.slice(6);
}

function countPhoneDigitsBefore(value, pos){
  return String(value || '').slice(0, Math.max(0, pos || 0)).replace(/\D/g, '').length;
}

function caretFromPhoneDigitIndex(formatted, digitIndex){
  if (digitIndex <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen >= digitIndex) return i + 1;
    }
  }
  return formatted.length;
}

function setPhoneValueAndCaret(input, digits, caretDigitIndex){
  const formatted = formatPhoneGuide(digits, input);
  input.value = formatted;
  const caret = caretFromPhoneDigitIndex(formatted, Math.max(0, caretDigitIndex));
  requestAnimationFrame(() => {
    try { input.setSelectionRange(caret, caret); } catch (e) {}
  });
}

function bindAzobssPhoneDisplayFormatter(root){
  const scope = root || document;
  const ids = ['siteSignupPhone', 'adminUserEditPhone', 'profileEditPhone'];
  ids.forEach((id) => {
    const input = scope.getElementById ? scope.getElementById(id) : null;
    if (!input || input.dataset.azobssPhoneFormatter === '1') return;
    input.dataset.azobssPhoneFormatter = '1';
    input.placeholder = '10-3560 0723';
    input.setAttribute('maxlength', String(15));

    input.addEventListener('beforeinput', (event) => {
      const type = event.inputType;
      if (type !== 'deleteContentBackward' && type !== 'deleteContentForward') return;
      const value = input.value || '';
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? start;
      const digits = getPhoneGuideDigits(value, input);
      let startDigit = countPhoneDigitsBefore(value, start);
      let endDigit = countPhoneDigitsBefore(value, end);

      event.preventDefault();

      if (start !== end) {
        const nextDigits = digits.slice(0, startDigit) + digits.slice(endDigit);
        setPhoneValueAndCaret(input, nextDigits, startDigit);
      } else if (type === 'deleteContentBackward') {
        if (startDigit <= 0) {
          setPhoneValueAndCaret(input, digits, 0);
        } else {
          const removeIndex = startDigit - 1;
          const nextDigits = digits.slice(0, removeIndex) + digits.slice(removeIndex + 1);
          setPhoneValueAndCaret(input, nextDigits, removeIndex);
        }
      } else {
        if (startDigit >= digits.length) {
          setPhoneValueAndCaret(input, digits, digits.length);
        } else {
          const nextDigits = digits.slice(0, startDigit) + digits.slice(startDigit + 1);
          setPhoneValueAndCaret(input, nextDigits, startDigit);
        }
      }

      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    input.addEventListener('input', () => {
      const oldValue = input.value || '';
      const oldCaret = input.selectionStart ?? oldValue.length;
      const digitIndex = countPhoneDigitsBefore(oldValue, oldCaret);
      const digits = getPhoneGuideDigits(oldValue, input);
      setPhoneValueAndCaret(input, digits, digitIndex);
    });

    input.addEventListener('paste', () => {
      setTimeout(() => {
        const digits = getPhoneGuideDigits(input.value, input);
        setPhoneValueAndCaret(input, digits, digits.length);
      }, 0);
    });

    input.addEventListener('blur', () => {
      input.value = formatPhoneGuide(input.value, input);
    });
  });
}

(function installAzobssPhoneDisplayFormatter(){
  if (window.__azobssPhoneDisplayFormatterInstalled) return;
  window.__azobssPhoneDisplayFormatterInstalled = true;
  document.addEventListener('DOMContentLoaded', () => bindAzobssPhoneDisplayFormatter(document));
  setTimeout(() => bindAzobssPhoneDisplayFormatter(document), 300);
  setTimeout(() => bindAzobssPhoneDisplayFormatter(document), 1200);
  document.addEventListener('click', () => setTimeout(() => bindAzobssPhoneDisplayFormatter(document), 50), true);
})();

function normalizePhoneNumber(phone, countryCode="+60"){
  phone=(phone||"").replace(/\s+/g,"").replace(/-/g,"");
  if(phone.startsWith("+")) return phone;
  if(phone.startsWith("0")) return countryCode + phone.substring(1);
  if(phone.startsWith(countryCode.replace("+",""))) return "+"+phone;
  return countryCode + phone;
}

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
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, sendEmailVerification, deleteUser } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, addDoc, getDocs, query, where, arrayUnion, orderBy, limit, startAfter, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
#siteAuthModal.auth-modal{align-items:center!important;padding:22px!important;}
#siteAuthModal .auth-modal-card{margin:auto!important;}

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
.phone-input-row{display:grid;grid-template-columns:minmax(118px,auto) 1fr;gap:8px;align-items:center;}
.country-code-button{height:48px;border:1px solid rgba(211,223,240,.35);border-radius:10px;background:#0d1628;color:#fff;padding:0 12px;font-weight:800;cursor:pointer;white-space:normal;}
.country-code-button::after{content:'⌄';margin-left:7px;font-size:13px;color:#cbd5e1;}
.country-combo{position:relative;}
.country-code-menu{position:absolute;left:0;top:calc(100% + 8px);width:260px;max-width:calc(100vw - 44px);padding:8px;border:1px solid rgba(211,223,240,.32);border-radius:12px;background:#081326;box-shadow:0 18px 45px rgba(0,0,0,.45);display:none;z-index:10020;}
.country-combo.is-open .country-code-menu{display:block;}
.country-menu-search{width:100%;box-sizing:border-box;margin-bottom:7px;border:1px solid rgba(211,223,240,.35);border-radius:9px;background:#0d1628;color:#fff;padding:10px 11px;font:inherit;outline:none;}
.country-menu-options{max-height:220px;overflow:auto;display:grid;gap:4px;}
.country-code-option{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;border-radius:8px;background:transparent;color:#eaf2ff;padding:9px 10px;text-align:left;font:inherit;font-weight:800;cursor:pointer;}
.country-code-option:hover,.country-code-option:focus{background:rgba(34,197,94,.16);outline:none;}
.country-option-dial{color:#62e6a5;font-weight:900;}
.phone-number-wrap{position:relative;}
/* Phone layout like Android/Google Contacts: country code stays in the country box,
   the phone input shows local number only. Firebase still saves full +countrycode number. */
.phone-prefix{display:none!important;}
.phone-number-wrap input{padding-left:14px!important;}
body.is-authenticated .site-auth-actions{display:none!important;}
body.is-authenticated .market-user-tools{display:flex!important;}
body.is-authenticated .user-menu{display:flex!important;}
body:not(.is-authenticated) .market-user-tools{display:none!important;}
.market-user-tools{align-items:center!important;}
.user-menu{position:relative!important;}
.user-menu.is-open .user-dropdown{display:block!important;}
.user-dropdown{z-index:3300!important;}
.market-nav a.market-nav-active{background:#22c55e!important;border-color:#22c55e!important;color:#052e16!important;text-shadow:none!important;box-shadow:0 0 15px rgba(34,197,94,.34),inset 0 0 0 1px rgba(255,255,255,.12)!important;}
.az-admin-user-edit-btn{border:0;border-radius:9px;background:#2f6bed;color:#fff;padding:9px 14px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.55);}
.az-admin-user-edit-btn:hover{filter:brightness(1.08);}
.az-admin-modal-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}
.az-admin-modal-actions .btn.secondary{background:#64748b;}

.password-toggle-wrap{position:relative;display:block;width:100%;}
.password-toggle-wrap input{padding-right:48px!important;box-sizing:border-box;width:100%;}
.password-eye-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:#9ca3af;font-size:20px;cursor:pointer;padding:4px;line-height:1;z-index:5;}
.password-eye-btn:hover{color:#fff;}

.forgot-password-box{margin-top:10px;padding:12px;border:1px solid rgba(88,166,255,.35);border-radius:14px;background:rgba(15,23,42,.35);display:grid;gap:10px;}
.forgot-password-box[hidden]{display:none!important;}
.forgot-password-box .btn.secondary{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:12px 14px;font-weight:800;cursor:pointer;}
.auth-reset-note{font-size:12px;line-height:1.45;color:#a9c7e8;margin:0;}
`;
  document.head.appendChild(style);
}


function setupPasswordVisibilityToggles() {
  const passwordIds = [
    'siteLoginPassword',
    'siteSignupPassword',
    'profileCurrentPassword',
    'profileNewPassword',
    'profileConfirmPassword'
  ];

  passwordIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input || input.dataset.passwordEyeReady === '1') return;

    const wrapper = document.createElement('span');
    wrapper.className = 'password-toggle-wrap';

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'password-eye-btn';
    btn.setAttribute('aria-label', 'Show password');
    btn.title = 'Show password';
    btn.textContent = '👁';

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.title = show ? 'Hide password' : 'Show password';
      btn.textContent = show ? '🙈' : '👁';
      input.focus();
    });

    wrapper.appendChild(btn);
    input.dataset.passwordEyeReady = '1';
  });
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
      <label for="siteLoginUsername">Username / Email
        <input id="siteLoginUsername" autocomplete="username" placeholder="Enter your username or email" required type="text">
      </label>
      <label for="siteLoginPassword">Password
        <input id="siteLoginPassword" autocomplete="current-password" placeholder="Password" required type="password">
      </label>
      <p class="request-error" id="siteLoginError"></p>
      <button class="btn" type="submit">Login</button>
      <p class="auth-switch-note"><button id="siteForgotPasswordButton" type="button">Forgot password?</button></p>
      <div class="forgot-password-box" id="siteForgotPasswordBox" hidden>
        <label for="siteForgotPasswordInput">Reset password by username or email
          <input id="siteForgotPasswordInput" autocomplete="username email" placeholder="Enter username or email" type="text">
        </label>
        <label class="auth-captcha-row" for="siteForgotPasswordCaptcha"><input id="siteForgotPasswordCaptcha" type="checkbox"> I'm not a robot</label>
        <button class="btn secondary" id="siteSendPasswordResetButton" type="button">Send Reset Link</button>
        <p class="auth-reset-note">Enter your AZOBSS username or registered email. Firebase will send a password reset link to the registered account email.</p>
      </div>
      <p class="auth-switch-note">Don't have an account? <button id="switchToSiteSignup" type="button">Register</button></p>
    </form>
    <form class="auth-modal-form" id="siteSignUpForm" hidden>
      <label for="siteSignupUsername">Username / Email
        <input id="siteSignupUsername" autocomplete="username" placeholder="Choose a username" required type="text">
      </label>
      <label for="siteSignupPassword">Password
        <input id="siteSignupPassword" autocomplete="new-password" placeholder="Minimum 8 characters" minlength="8" required type="password">
      </label>
      <label for="siteSignupPhone">Phone Number
        <div class="phone-input-row" data-country-phone="siteSignup" data-default-dial="60">
          <div class="country-combo">
            <button class="country-code-button" type="button" data-country-button>🇲🇾 +60</button>
            <div class="country-code-menu" data-country-menu>
              <input class="country-menu-search" data-country-search placeholder="Search country / code" type="search">
              <div class="country-menu-options" data-country-options></div>
            </div>
          </div>
          <div class="phone-number-wrap"><span class="phone-prefix" data-phone-prefix>+60</span><input id="siteSignupPhone" inputmode="tel" placeholder="10-3560 0723" required type="tel"><input id="siteSignupDial" type="hidden" value="60"></div>
        </div>
      </label>
      <label for="siteSignupEmail">Email
        <input id="siteSignupEmail" inputmode="email" placeholder="Example: name@email.com" required type="email">
      </label>
      <label for="siteSignupInviteCode">Invite Code
        <input id="siteSignupInviteCode" placeholder="Enter member code if available (optional)" type="text">
      </label>
      <label class="auth-captcha-row" for="siteSignupCaptcha"><input id="siteSignupCaptcha" type="checkbox" required> I'm not a robot</label>
      <p class="request-error" id="siteSignupError"></p>
      <button class="btn signup" type="submit">Create Account</button>
      <p class="auth-switch-note">Already have an account? <button id="switchToSiteSignin" type="button">Sign in</button></p>
    </form>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
  setupCountryPhoneSelectors(document);
  setupPasswordVisibilityToggles();
}

function injectAdminUserEditModal() {
  if (document.getElementById('adminUserEditModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div class="auth-modal" id="adminUserEditModal" aria-hidden="true">
  <div class="auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminUserEditTitle">
    <div class="auth-modal-top">
      <h3 id="adminUserEditTitle">Edit Registered User</h3>
      <button class="auth-close-btn" id="adminUserEditClose" type="button" aria-label="Close">×</button>
    </div>
    <form class="auth-modal-form" id="adminUserEditForm">
      <input id="adminUserEditDocId" type="hidden">
      <label for="adminUserEditUsername">Username / Email / Name
        <input id="adminUserEditUsername" placeholder="Username" required type="text">
      </label>
      <label for="adminUserEditPhone">Phone Number
        <div class="phone-input-row" data-country-phone="adminUserEdit" data-default-dial="60">
          <div class="country-combo">
            <button class="country-code-button" type="button" data-country-button>🇲🇾 +60</button>
            <div class="country-code-menu" data-country-menu>
              <input class="country-menu-search" data-country-search placeholder="Search country / code" type="search">
              <div class="country-menu-options" data-country-options></div>
            </div>
          </div>
          <div class="phone-number-wrap"><span class="phone-prefix" data-phone-prefix>+60</span><input id="adminUserEditPhone" inputmode="tel" placeholder="10-3560 0723" type="tel"><input id="adminUserEditDial" type="hidden" value="60"></div>
        </div>
      </label>
      <label for="adminUserEditEmail">Contact Email
        <input id="adminUserEditEmail" inputmode="email" placeholder="Example: name@email.com" type="email">
      </label>
      <label for="adminUserEditRole">Role
        <select id="adminUserEditRole">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label for="adminUserEditPaAccess">Allow PA/BM Access
        <select id="adminUserEditPaAccess">
          <option value="yes">Yes - allow PA/BM tab</option>
          <option value="no">No - hide PA/BM tab</option>
        </select>
      </label>
      <label for="adminUserEditMemberCode">Invite Code
        <input id="adminUserEditMemberCode" placeholder="Enter member code if available (optional)" type="text">
      </label>
      <p class="request-error" id="adminUserEditError"></p>
      <div class="az-admin-modal-actions">
        <button class="btn signup" type="submit">Save User</button>
        <button class="btn secondary" id="adminUserEditCancel" type="button">Cancel</button>
      </div>
      <p class="auth-switch-note" style="text-align:left">Admin can edit profile records here. Password reset should be done using the reset-password flow.</p>
    </form>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}

const $ = (id) => document.getElementById(id);
function normalizeUsername(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'');}
function buildUserEmail(usernameKey){return `${usernameKey}@azobss.local`;}

const AZOBSS_USERNAME_AUTH_COLLECTION = 'usernameAuthEmails';
async function getAuthEmailForUsername(usernameKey){
  const key = normalizeUsername(usernameKey);
  if(!key) return '';

  // IMPORTANT FIX:
  // Do NOT trust localStorage first. Old builds stored username@azobss.local there,
  // which breaks username login even when Firestore has the real Gmail.
  const localKey = 'azobssAuthEmailMap:' + key;

  async function readFirestoreMapping(){
    try{
      const lookupSnap = await getDoc(doc(db, AZOBSS_USERNAME_AUTH_COLLECTION, key));
      if(lookupSnap.exists()){
        const data = lookupSnap.data() || {};
        const email = String(data.email || data.authEmail || data.contactEmail || '').trim().toLowerCase();
        if(email && email.includes('@') && !email.endsWith('@azobss.local')) return email;
        if(email && email.includes('@')) return email;
      }
    }catch(e){
      console.warn('AZOBSS username auth lookup failed:', e?.code || e?.message || e);
    }
    return '';
  }

  async function readUserProfileEmail(){
    try{
      const userSnap = await getDoc(doc(db, 'users', key));
      if(userSnap.exists()){
        const data = userSnap.data() || {};
        const email = String(data.authEmail || data.email || data.contactEmail || '').trim().toLowerCase();
        if(email && email.includes('@') && !email.endsWith('@azobss.local')){
          try{ localStorage.setItem(localKey, email); }catch(_){}
          try{ await saveUsernameAuthEmail(key, email, data.uid || ''); }catch(_){}
          return email;
        }
        if(email && email.includes('@')) return email;
      }
    }catch(e){
      console.warn('AZOBSS users email lookup failed:', e?.code || e?.message || e);
    }
    return '';
  }

  const mappedEmail = await readFirestoreMapping();
  if(mappedEmail && !mappedEmail.endsWith('@azobss.local')) return mappedEmail;

  const profileEmail = await readUserProfileEmail();
  if(profileEmail && !profileEmail.endsWith('@azobss.local')) return profileEmail;

  // Only use local cache after Firestore. This prevents stale wrong username@azobss.local mapping.
  try{
    const localEmail = String(localStorage.getItem(localKey) || '').trim().toLowerCase();
    if(localEmail && localEmail.includes('@') && !localEmail.endsWith('@azobss.local')) return localEmail;
  }catch(_){}

  return mappedEmail || profileEmail || '';
}

async function saveUsernameAuthEmail(usernameKey, email, uid){
  const key = normalizeUsername(usernameKey);
  const authEmail = String(email || '').trim().toLowerCase();
  if(!key || !authEmail || !authEmail.includes('@')) return;
  try{
    await setDoc(doc(db, AZOBSS_USERNAME_AUTH_COLLECTION, key), {
      username: key,
      usernameKey: key,
      email: authEmail,
      authEmail,
      contactEmail: authEmail,
      uid: uid || null,
      updatedAt: serverTimestamp()
    }, {merge:true});
    try{ localStorage.setItem('azobssAuthEmailMap:' + key, authEmail); }catch(_){}
  }catch(e){
    console.warn('AZOBSS username auth email save failed:', e?.code || e?.message || e);
  }
}
async function migrateUsernameAuthLookupForAdmin(){
  try{
    const saved = getSavedUser && getSavedUser();
    if(!saved || String(saved.email || '').toLowerCase() !== 'zedan91@azobss.local') return;
    const snap = await getDocs(collection(db, 'users'));
    const jobs = [];
    snap.forEach((d)=>{
      const data = d.data() || {};
      const usernameKey = normalizeUsername(data.usernameKey || d.id);
      const email = String(data.authEmail || data.email || '').trim().toLowerCase();
      if(usernameKey && email && email.includes('@')) jobs.push(saveUsernameAuthEmail(usernameKey, email, data.uid || null));
    });
    await Promise.all(jobs.slice(0, 200));
  }catch(e){
    console.warn('AZOBSS username auth lookup migration skipped:', e?.code || e?.message || e);
  }
}

function cleanPhone(value){return String(value||'').replace(/[^0-9]/g,'').replace(/^60/,'').replace(/^0+/,'');}
const AZOBSS_COUNTRY_DIAL_CODES = [
  ["🇲🇾", "Malaysia", "60"],
  ["🇸🇬", "Singapore", "65"],
  ["🇮🇩", "Indonesia", "62"],
  ["🇧🇳", "Brunei", "673"],
  ["🇹🇭", "Thailand", "66"],
  ["🇵🇭", "Philippines", "63"],
  ["🇻🇳", "Vietnam", "84"],
  ["🇨🇳", "China", "86"],
  ["🇭🇰", "Hong Kong", "852"],
  ["🇹🇼", "Taiwan", "886"],
  ["🇯🇵", "Japan", "81"],
  ["🇰🇷", "South Korea", "82"],
  ["🇮🇳", "India", "91"],
  ["🇵🇰", "Pakistan", "92"],
  ["🇧🇩", "Bangladesh", "880"],
  ["🇦🇺", "Australia", "61"],
  ["🇳🇿", "New Zealand", "64"],
  ["🇬🇧", "United Kingdom", "44"],
  ["🇺🇸", "United States", "1"],
  ["🇨🇦", "Canada", "1"],
  ["🇸🇦", "Saudi Arabia", "966"],
  ["🇦🇪", "United Arab Emirates", "971"],
  ["🇦🇫", "Afghanistan", "93"],
  ["🇦🇱", "Albania", "355"],
  ["🇩🇿", "Algeria", "213"],
  ["🇦🇸", "American Samoa", "1684"],
  ["🇦🇴", "Angola", "244"],
  ["🇦🇮", "Anguilla", "1264"],
  ["🇦🇬", "Antigua and Barbuda", "1268"],
  ["🇦🇷", "Argentina", "54"],
  ["🇦🇲", "Armenia", "374"],
  ["🇦🇼", "Aruba", "297"],
  ["🇦🇹", "Austria", "43"],
  ["🇦🇿", "Azerbaijan", "994"],
  ["🇧🇭", "Bahrain", "973"],
  ["🇧🇧", "Barbados", "1246"],
  ["🇧🇾", "Belarus", "375"],
  ["🇧🇪", "Belgium", "32"],
  ["🇧🇿", "Belize", "501"],
  ["🇧🇯", "Benin", "229"],
  ["🇧🇲", "Bermuda", "1441"],
  ["🇧🇹", "Bhutan", "975"],
  ["🇧🇴", "Bolivia", "591"],
  ["🇧🇦", "Bosnia and Herzegovina", "387"],
  ["🇧🇼", "Botswana", "267"],
  ["🇧🇷", "Brazil", "55"],
  ["🇮🇴", "British Indian Ocean Territory", "246"],
  ["🇧🇬", "Bulgaria", "359"],
  ["🇧🇫", "Burkina Faso", "226"],
  ["🇧🇮", "Burundi", "257"],
  ["🇰🇭", "Cambodia", "855"],
  ["🇨🇲", "Cameroon", "237"],
  ["🇨🇻", "Cape Verde", "238"],
  ["🇰🇾", "Cayman Islands", "1345"],
  ["🇨🇫", "Central African Republic", "236"],
  ["🇹🇩", "Chad", "235"],
  ["🇨🇱", "Chile", "56"],
  ["🇨🇽", "Christmas Island", "61"],
  ["🇨🇨", "Cocos (Keeling) Islands", "61"],
  ["🇨🇴", "Colombia", "57"],
  ["🇰🇲", "Comoros", "269"],
  ["🇨🇰", "Cook Islands", "682"],
  ["🇨🇷", "Costa Rica", "506"],
  ["🇭🇷", "Croatia", "385"],
  ["🇨🇺", "Cuba", "53"],
  ["🇨🇾", "Cyprus", "357"],
  ["🇨🇿", "Czech Republic", "420"],
  ["🇨🇩", "Democratic Republic of the Congo", "243"],
  ["🇩🇰", "Denmark", "45"],
  ["🇩🇯", "Djibouti", "253"],
  ["🇩🇲", "Dominica", "1767"],
  ["🇩🇴", "Dominican Republic", "1809"],
  ["🇩🇴", "Dominican Republic", "1829"],
  ["🇩🇴", "Dominican Republic", "1849"],
  ["🇹🇱", "East Timor", "670"],
  ["🇪🇨", "Ecuador", "593"],
  ["🇪🇬", "Egypt", "20"],
  ["🇸🇻", "El Salvador", "503"],
  ["🇬🇶", "Equatorial Guinea", "240"],
  ["🇪🇷", "Eritrea", "291"],
  ["🇪🇪", "Estonia", "372"],
  ["🇪🇹", "Ethiopia", "251"],
  ["🇫🇰", "Falkland Islands", "500"],
  ["🇫🇴", "Faroe Islands", "298"],
  ["🇫🇲", "Federated States of Micronesia", "691"],
  ["🇫🇯", "Fiji", "679"],
  ["🇫🇮", "Finland", "358"],
  ["🇫🇷", "France", "33"],
  ["🇬🇫", "French Guiana", "594"],
  ["🇵🇫", "French Polynesia", "689"],
  ["🇬🇦", "Gabon", "241"],
  ["🇬🇪", "Georgia", "995"],
  ["🇩🇪", "Germany", "49"],
  ["🇬🇭", "Ghana", "233"],
  ["🇬🇮", "Gibraltar", "350"],
  ["🇬🇷", "Greece", "30"],
  ["🇬🇱", "Greenland", "299"],
  ["🇬🇩", "Grenada", "1473"],
  ["🇬🇵", "Guadeloupe", "590"],
  ["🇬🇺", "Guam", "1671"],
  ["🇬🇹", "Guatemala", "502"],
  ["🇬🇬", "Guernsey", "44"],
  ["🇬🇳", "Guinea", "224"],
  ["🇬🇼", "Guinea-Bissau", "245"],
  ["🇬🇾", "Guyana", "592"],
  ["🇭🇹", "Haiti", "509"],
  ["🇭🇳", "Honduras", "504"],
  ["🇭🇺", "Hungary", "36"],
  ["🇮🇸", "Iceland", "354"],
  ["🇮🇷", "Iran", "98"],
  ["🇮🇶", "Iraq", "964"],
  ["🇮🇪", "Ireland", "353"],
  ["🇮🇲", "Isle of Man", "44"],
  ["🇮🇱", "Israel", "972"],
  ["🇮🇹", "Italy", "39"],
  ["🇨🇮", "Ivory Coast", "225"],
  ["🇯🇲", "Jamaica", "1876"],
  ["🇯🇪", "Jersey", "44"],
  ["🇯🇴", "Jordan", "962"],
  ["🇰🇿", "Kazakhstan", "76"],
  ["🇰🇿", "Kazakhstan", "77"],
  ["🇰🇪", "Kenya", "254"],
  ["🇰🇮", "Kiribati", "686"],
  ["🇰🇼", "Kuwait", "965"],
  ["🇰🇬", "Kyrgyzstan", "996"],
  ["🇱🇦", "Laos", "856"],
  ["🇱🇻", "Latvia", "371"],
  ["🇱🇧", "Lebanon", "961"],
  ["🇱🇸", "Lesotho", "266"],
  ["🇱🇷", "Liberia", "231"],
  ["🇱🇾", "Libya", "218"],
  ["🇱🇮", "Liechtenstein", "423"],
  ["🇱🇹", "Lithuania", "370"],
  ["🇱🇺", "Luxembourg", "352"],
  ["🇲🇴", "Macau", "853"],
  ["🇲🇬", "Madagascar", "261"],
  ["🇲🇼", "Malawi", "265"],
  ["🇲🇻", "Maldives", "960"],
  ["🇲🇱", "Mali", "223"],
  ["🇲🇹", "Malta", "356"],
  ["🇲🇭", "Marshall Islands", "692"],
  ["🇲🇶", "Martinique", "596"],
  ["🇲🇷", "Mauritania", "222"],
  ["🇲🇺", "Mauritius", "230"],
  ["🇾🇹", "Mayotte", "262"],
  ["🇲🇽", "Mexico", "52"],
  ["🇲🇩", "Moldova", "373"],
  ["🇲🇨", "Monaco", "377"],
  ["🇲🇳", "Mongolia", "976"],
  ["🇲🇸", "Montserrat", "1664"],
  ["🇲🇦", "Morocco", "212"],
  ["🇲🇿", "Mozambique", "258"],
  ["🇳🇦", "Namibia", "264"],
  ["🇳🇷", "Nauru", "674"],
  ["🇳🇵", "Nepal", "977"],
  ["🇳🇱", "Netherlands", "31"],
  ["🇳🇨", "New Caledonia", "687"],
  ["🇳🇮", "Nicaragua", "505"],
  ["🇳🇪", "Niger", "227"],
  ["🇳🇬", "Nigeria", "234"],
  ["🇳🇺", "Niue", "683"],
  ["🇳🇫", "Norfolk Island", "672"],
  ["🇰🇵", "North Korea", "850"],
  ["🇲🇵", "Northern Mariana Islands", "1670"],
  ["🇳🇴", "Norway", "47"],
  ["🇴🇲", "Oman", "968"],
  ["🇵🇼", "Palau", "680"],
  ["🇵🇦", "Panama", "507"],
  ["🇵🇬", "Papua New Guinea", "675"],
  ["🇵🇾", "Paraguay", "595"],
  ["🇵🇪", "Peru", "51"],
  ["🇵🇳", "Pitcairn Islands", "64"],
  ["🇵🇱", "Poland", "48"],
  ["🇵🇹", "Portugal", "351"],
  ["🇵🇷", "Puerto Rico", "1787"],
  ["🇵🇷", "Puerto Rico", "1939"],
  ["🇶🇦", "Qatar", "974"],
  ["🇲🇰", "Republic of Macedonia", "389"],
  ["🇨🇬", "Republic of the Congo", "242"],
  ["🇷🇴", "Romania", "40"],
  ["🇷🇺", "Russia", "7"],
  ["🇷🇼", "Rwanda", "250"],
  ["🇷🇪", "Réunion", "262"],
  ["🇸🇭", "Saint Helena", "290"],
  ["🇰🇳", "Saint Kitts and Nevis", "1869"],
  ["🇱🇨", "Saint Lucia", "1758"],
  ["🇵🇲", "Saint Pierre and Miquelon", "508"],
  ["🇻🇨", "Saint Vincent and the Grenadines", "1784"],
  ["🇼🇸", "Samoa", "685"],
  ["🇸🇲", "San Marino", "378"],
  ["🇸🇳", "Senegal", "221"],
  ["🇷🇸", "Serbia", "381"],
  ["🇸🇨", "Seychelles", "248"],
  ["🇸🇱", "Sierra Leone", "232"],
  ["🇸🇰", "Slovakia", "421"],
  ["🇸🇮", "Slovenia", "386"],
  ["🇸🇧", "Solomon Islands", "677"],
  ["🇸🇴", "Somalia", "252"],
  ["🇿🇦", "South Africa", "27"],
  ["🇬🇸", "South Georgia", "500"],
  ["🇸🇸", "South Sudan", "211"],
  ["🇪🇸", "Spain", "34"],
  ["🇱🇰", "Sri Lanka", "94"],
  ["🇸🇩", "Sudan", "249"],
  ["🇸🇷", "Suriname", "597"],
  ["🇸🇯", "Svalbard and Jan Mayen", "4779"],
  ["🇸🇿", "Swaziland", "268"],
  ["🇸🇪", "Sweden", "46"],
  ["🇨🇭", "Switzerland", "41"],
  ["🇸🇾", "Syria", "963"],
  ["🇸🇹", "São Tomé and Príncipe", "239"],
  ["🇹🇯", "Tajikistan", "992"],
  ["🇹🇿", "Tanzania", "255"],
  ["🇧🇸", "The Bahamas", "1242"],
  ["🇬🇲", "The Gambia", "220"],
  ["🇹🇬", "Togo", "228"],
  ["🇹🇰", "Tokelau", "690"],
  ["🇹🇴", "Tonga", "676"],
  ["🇹🇹", "Trinidad and Tobago", "1868"],
  ["🇹🇳", "Tunisia", "216"],
  ["🇹🇷", "Turkey", "90"],
  ["🇹🇲", "Turkmenistan", "993"],
  ["🇹🇻", "Tuvalu", "688"],
  ["🇺🇬", "Uganda", "256"],
  ["🇺🇦", "Ukraine", "380"],
  ["🇺🇾", "Uruguay", "598"],
  ["🇺🇿", "Uzbekistan", "998"],
  ["🇻🇺", "Vanuatu", "678"],
  ["🇻🇪", "Venezuela", "58"],
  ["🇼🇫", "Wallis and Futuna", "681"],
  ["🇪🇭", "Western Sahara", "212"],
  ["🇾🇪", "Yemen", "967"],
  ["🇿🇲", "Zambia", "260"],
  ["🇿🇼", "Zimbabwe", "263"]
];
function getCountryByDial(dial){return AZOBSS_COUNTRY_DIAL_CODES.find(c=>c[2]===String(dial||'').replace(/[^0-9]/g,'')) || AZOBSS_COUNTRY_DIAL_CODES[0];}
function setPhoneDial(prefix, dial){
  const row=document.querySelector(`[data-country-phone="${prefix}"]`); if(!row) return;
  const country=getCountryByDial(dial);
  const hidden=$(prefix+'Dial'); if(hidden) hidden.value=country[2];
  const btn=row.querySelector('[data-country-button]'); if(btn) btn.textContent=`${country[0]} +${country[2]}`;
  const pre=row.querySelector('[data-phone-prefix]'); if(pre) pre.textContent=`+${country[2]}`;
}
function normalizeAzobssPhone(value, fallbackDial='60'){
  const dial=String(fallbackDial||'60').replace(/[^0-9]/g,'') || '60';
  let raw=String(value||'').trim();
  if(!raw) return '';
  const hadPlus=/^\s*\+/.test(raw);
  let digits=raw.replace(/[^0-9]/g,'');
  if(!digits) return '';
  if(hadPlus) return '+' + digits;
  if(digits.startsWith('00')) return '+' + digits.slice(2);
  if(digits.startsWith(dial)) return '+' + digits;
  if(digits.startsWith('0')) return '+' + dial + digits.replace(/^0+/,'');
  return '+' + dial + digits;
}
function getPhoneWithDial(prefix){
  const dial=String($(prefix+'Dial')?.value||'60').replace(/[^0-9]/g,'') || '60';
  return normalizeAzobssPhone($(prefix+'Phone')?.value||'', dial);
}

function getSignupPhoneWithDial(){
  // AZOBSS FIX: register phone input has changed names across builds.
  // Read from all possible signup phone inputs, then save one normalized E.164 number.
  const possiblePrefixes = ['siteSignup','signup','register','siteRegister'];
  for(const prefix of possiblePrefixes){
    const input = $(prefix+'Phone');
    if(input && String(input.value||'').replace(/\D/g,'')){
      const dial=String($(prefix+'Dial')?.value||'60').replace(/[^0-9]/g,'') || '60';
      return normalizeAzobssPhone(input.value, dial);
    }
  }
  const input = document.querySelector('#siteSignupPhone,#signupPhone,#registerPhone,#siteRegisterPhone,input[name="signupPhone"],input[name="registerPhone"],input[name="phone"],input[name="phoneNumber"]');
  if(input && String(input.value||'').replace(/\D/g,'')){
    const row = input.closest?.('[data-country-phone]');
    const hidden = row?.querySelector?.('input[type="hidden"][id$="Dial"]');
    const dial=String(hidden?.value||'60').replace(/[^0-9]/g,'') || '60';
    return normalizeAzobssPhone(input.value, dial);
  }
  return '';
}

function mergePhonePreserve(currentPhone, newPhone){
  const next = normalizeAzobssPhone(newPhone || '');
  if(next) return next;
  return normalizeAzobssPhone(currentPhone || '');
}
function splitPhoneToDialLocal(value){
  const digits=String(value||'').replace(/[^0-9]/g,'');
  const sorted=[...AZOBSS_COUNTRY_DIAL_CODES].sort((a,b)=>b[2].length-a[2].length);
  const found=sorted.find(c=>digits.startsWith(c[2]) && digits.length>c[2].length+3);
  if(found) return {dial:found[2], local:digits.slice(found[2].length).replace(/^0+/,'')};
  return {dial:'60', local:digits.replace(/^60/,'').replace(/^0+/,'')};
}
function setupCountryPhoneSelectors(root=document){
  root.querySelectorAll('[data-country-phone]').forEach(row=>{
    if(row.dataset.countryReady==='1') return; row.dataset.countryReady='1';
    const prefix=row.dataset.countryPhone;
    const btn=row.querySelector('[data-country-button]');
    const combo=row.querySelector('.country-combo');
    const search=row.querySelector('[data-country-search]');
    const options=row.querySelector('[data-country-options]');
    const render=(q='')=>{
      if(!options) return; const query=String(q).trim().toLowerCase();
      options.innerHTML=AZOBSS_COUNTRY_DIAL_CODES.filter(c=>!query || c.join(' ').toLowerCase().includes(query) || ('+'+c[2]).includes(query)).map(c=>`<button class="country-code-option" type="button" data-dial="${c[2]}"><span>${c[0]} ${c[1]}</span><span class="country-option-dial">+${c[2]}</span></button>`).join('');
    };
    render(); setPhoneDial(prefix,row.dataset.defaultDial||'60');
    btn?.addEventListener('click',()=>{ combo?.classList.toggle('is-open'); if(combo?.classList.contains('is-open')){ render(search?.value||''); setTimeout(()=>search?.focus(),0); } });
    search?.addEventListener('input',()=>render(search.value));
    options?.addEventListener('click',(event)=>{ const opt=event.target.closest('[data-dial]'); if(!opt) return; setPhoneDial(prefix,opt.dataset.dial); combo?.classList.remove('is-open'); });
  });
}
document.addEventListener('click',(event)=>{ if(!event.target.closest('.country-combo')) document.querySelectorAll('.country-combo.is-open').forEach(el=>el.classList.remove('is-open')); });
function buildInviteCode(usernameKey){return `AZ${String(usernameKey||'USER').replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6)}`;}
function initials(name){return String(name||'AZ').trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('')||'AZ';}
function safeJson(raw){try{return JSON.parse(raw||'null');}catch{return null;}}
function clearSavedUser(){try{localStorage.removeItem('azobssUser');sessionStorage.removeItem('azobssUser');}catch(e){}}
function saveUser(user){
  const value = JSON.stringify(user);
  sessionStorage.setItem('azobssCurrentUser', value);
  localStorage.setItem('azobssCurrentUser', value);
  sessionStorage.setItem('azobssLoggedIn', '1');
  localStorage.setItem('azobssLoggedIn', '1');
  window.dispatchEvent(new Event('storage'));
}
function clearUser(silent=false){
  ['azobssCurrentUser','azobssUser','azobssLoggedIn'].forEach((key)=>{
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  if(!silent) window.dispatchEvent(new Event('storage'));
}

let azobssLogoutInProgress = false;
async function azobssLogoutOnce(){
  if(azobssLogoutInProgress) return;
  azobssLogoutInProgress = true;
  window.__AZOBSS_LOGGING_OUT__ = true;
  try{
    const logoutUser = getSavedUser();
    if(azobssPresenceHeartbeatTimer){ clearInterval(azobssPresenceHeartbeatTimer); azobssPresenceHeartbeatTimer = null; }
    await removeOnlineUser(logoutUser);
    document.querySelectorAll('.user-menu.is-open').forEach(el=>{
      el.classList.remove('is-open');
      el.setAttribute('aria-expanded','false');
    });
    clearUser(true);
    syncHeader(null);
    // Do not let storage/admin render loops run during logout. Redirect once, quickly.
    const redirectTimer = setTimeout(()=>{ window.location.replace('/'); }, 120);
    try{
      await Promise.race([
        signOut(auth),
        new Promise(resolve=>setTimeout(resolve, 900))
      ]);
    }catch(_e){}
    clearTimeout(redirectTimer);
  }finally{
    window.location.replace('/');
  }
}
window.azobssLogoutUser = azobssLogoutOnce;
window.addEventListener('beforeunload', ()=>{ try{ if(azobssPresenceHeartbeatTimer) clearInterval(azobssPresenceHeartbeatTimer); }catch(_e){} });
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
    
    <a class="user-dropdown-item" href="/#purchases" role="menuitem">🧾 My Purchases</a>
    <a class="user-dropdown-item" href="/Bookmarks/" role="menuitem"><svg class="az-user-menu-bookmark-icon" aria-hidden="true" viewBox="0 0 24 24" style="width:20px;height:20px;flex:0 0 20px;color:#facc15;vertical-align:-4px"><path d="M6 4.5C6 3.7 6.7 3 7.5 3h9c.8 0 1.5.7 1.5 1.5V21l-6-3.4L6 21V4.5Z" style="fill:#facc15;stroke:#facc15;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round"></path></svg><span>Bookmarks</span></a>
    
    <button class="user-dropdown-item" id="profileSettingsButton" type="button" role="menuitem">⚙️ Settings</button>
    <button class="user-dropdown-item" id="logoutButton" type="button" role="menuitem">🚪 Log Out</button>`;
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
      <label for="profileEditName">Username / Email / Name<input id="profileEditName" placeholder="Username" required type="text"></label>
      <label for="profileEditPhone">Phone Number
        <div class="phone-input-row" data-country-phone="profileEdit" data-default-dial="60">
          <div class="country-combo">
            <button class="country-code-button" type="button" data-country-button>🇲🇾 +60</button>
            <div class="country-code-menu" data-country-menu>
              <input class="country-menu-search" data-country-search placeholder="Search country / code" type="search">
              <div class="country-menu-options" data-country-options></div>
            </div>
          </div>
          <div class="phone-number-wrap"><span class="phone-prefix" data-phone-prefix>+60</span><input id="profileEditPhone" inputmode="tel" placeholder="10-3560 0723" type="tel"><input id="profileEditDial" type="hidden" value="60"></div>
        </div>
      </label>
      <label for="profileEditEmail">Contact Email<input id="profileEditEmail" inputmode="email" placeholder="Example: name@email.com" type="email"></label>
      
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
  setupCountryPhoneSelectors(document);
  setupPasswordVisibilityToggles();
}

const AZOBSS_ADMIN_USERS = ['zedan91','zedan9107'];
const AZOBSS_ADMIN_EMAILS = ['zedan91@azobss.local','zedan9107@gmail.com'];
const AZOBSS_PA_MEMBER_CODE = 'ZX6186';
function getUserKey(user){ return String(user?.usernameKey || user?.username || user?.name || (user?.email ? String(user.email).split('@')[0] : '') || '').trim().toLowerCase(); }
function isAzobssAdmin(user){
  const key = getUserKey(user);
  const role = String(user?.role || '').trim().toLowerCase();
  const email = String(user?.email || user?.authEmail || '').trim().toLowerCase();
  return !!(user && (role === 'admin' || AZOBSS_ADMIN_USERS.includes(key) || AZOBSS_ADMIN_EMAILS.includes(email)));
}
function normalizePaMemberCode(value){
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function getSignupInviteCodeValue(){
  const selectors = [
    '#siteSignupInviteCode',
    '#signupInviteCode',
    '#signupMemberCode',
    '#memberInviteCode',
    '[name="inviteCode"]',
    '[name="memberCode"]',
    '[data-invite-code-input]',
    'input[placeholder*="Invite Code" i]',
    'input[placeholder*="member code" i]'
  ];
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && String(el.value || '').trim()) return normalizePaMemberCode(el.value);
    } catch (_) {}
  }
  try {
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      if (/invite code|member code/i.test(label.textContent || '')) {
        const el = label.querySelector('input') || document.getElementById(label.getAttribute('for') || '');
        if (el && String(el.value || '').trim()) return normalizePaMemberCode(el.value);
      }
    }
  } catch (_) {}
  return '';
}

function isTruthyPaBmValue(value){
  if(value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['true','yes','y','1','allow','allowed','on','enabled','enable'].includes(text);
}
function isFalseyPaBmValue(value){
  if(value === false || value === 0) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return ['false','no','n','0','off','disabled','disable','hide'].includes(text);
}
function getPaBmFlagAllowed(user){
  const u = user || {};
  const keys = [
    'paBmAccess','paBmAllowed','allowPABM','allowPaBm','allowPabm',
    'allowPaBmTab','paBmTabAllowed','paBmTab','showPaBmTab','canAccessPaBm',
    'paAccess','pa_bm_access','pa_bm_allowed','allow_pa_bm'
  ];
  return keys.some((key)=>isTruthyPaBmValue(u[key]));
}
function buildPaBmAccessPayload(allowed, code=''){
  const normalizedCode = normalizePaMemberCode(code || (allowed ? AZOBSS_PA_MEMBER_CODE : ''));
  return {
    inviteCode: normalizedCode,
    inviteCodeUsed: normalizedCode,
    invitedByCode: normalizedCode,
    memberCode: normalizedCode,
    paMemberCode: normalizedCode,
    paBmAccess: !!allowed,
    paBmAllowed: !!allowed,
    allowPABM: !!allowed,
    allowPaBm: !!allowed,
    allowPaBmTab: !!allowed,
    paBmTabAllowed: !!allowed,
    showPaBmTab: !!allowed,
    canAccessPaBm: !!allowed,
    paAccess: allowed ? 'yes' : 'no'
  };
}

function getPaBmPayloadFromCode(code){
  const normalizedCode = normalizePaMemberCode(code);
  const allowed = normalizedCode === AZOBSS_PA_MEMBER_CODE;
  return buildPaBmAccessPayload(allowed, normalizedCode);
}
function mergePaBmAccessPreserve(existing={}, incomingCode=''){
  const code = normalizePaMemberCode(
    incomingCode || existing.inviteCode || existing.inviteCodeUsed || existing.invitedByCode ||
    existing.memberCode || existing.paMemberCode || existing.accessCode || existing.signupCode || ''
  );
  const codeAllowed = code === AZOBSS_PA_MEMBER_CODE;
  const allowed = codeAllowed || getPaBmFlagAllowed(existing);
  return buildPaBmAccessPayload(allowed, code || normalizePaMemberCode(existing.inviteCode || existing.memberCode || ''));
}
function getPaMemberCodes(user){
  const u = user || {};
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
    u.inviteCode
  ].map(normalizePaMemberCode).filter(Boolean);
}
function hasPaBmTabAccess(user){
  if (!user) return false;
  if (isAzobssAdmin(user)) return true;
  if (getPaBmFlagAllowed(user)) return true;
  return getPaMemberCodes(user).includes(AZOBSS_PA_MEMBER_CODE);
}

function isPaBmProtectedPage(){
  return /\/PA-BM\/?(?:index\.html)?$/i.test(location.pathname) || /\/PA-BM\//i.test(location.pathname);
}
function isAzobssMemberProtectedPage(){
  const path = location.pathname.replace(/\\/g,'/');
  return /\/(purchase-history|member-area|members|my-account)\/?(?:index\.html)?$/i.test(path)
    || /\/(purchase-history|member-area|members|my-account)\//i.test(path);
}
function showPaBmDeniedAndRedirect(){
  // Silent redirect only. Do not show a PA/BM access popup/toast.
  const target = '/';
  if(location.pathname !== target) location.replace(target);
}
function showMemberLoginRequired(){
  try{ sessionStorage.setItem('azobssAccessDeniedMessage','Please login first to access this page.'); }catch(e){}
  if(location.pathname !== '/') location.replace('/#login');
  else setTimeout(()=>openSiteAuth('signin'), 80);
}
function enforcePaBmPageAccess(user, settled){
  if(isAzobssMemberProtectedPage() && !user){
    if(settled) showMemberLoginRequired();
    return;
  }
  if(!isPaBmProtectedPage()) return;
  if(hasPaBmTabAccess(user)) return;
  if(settled) showPaBmDeniedAndRedirect();
}
function showAccessDeniedMessage(){
  let msg = '';
  try{ msg = sessionStorage.getItem('azobssAccessDeniedMessage') || ''; sessionStorage.removeItem('azobssAccessDeniedMessage'); }catch(e){}
  if(!msg) return;
  const box = document.createElement('div');
  box.className = 'azobss-access-denied-toast';
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(()=>box.classList.add('is-visible'), 30);
  setTimeout(()=>{ box.classList.remove('is-visible'); setTimeout(()=>box.remove(), 350); }, 4200);
}

function syncHeader(user){
  const authActions = $('siteAuthActions');
  const tools = $('marketUserTools');
  const name = $('signedInName');
  const avatar = $('userAvatar');
  const paBmButtons = Array.from(document.querySelectorAll('#paBmNavButton, .nav-pa-bm-link, a[href="/PA-BM/"].nav-pa-bm-link'));
  const storedUser = user || (typeof getSavedUser === 'function' ? getSavedUser() : null);
  const display = storedUser && (storedUser.usernameKey || storedUser.name || storedUser.username || (storedUser.email ? String(storedUser.email).split('@')[0] : ''));
  const canShowPaBm = hasPaBmTabAccess(storedUser);
  const isAdminUser = isAzobssAdmin(storedUser);
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
  const parsedPhone=splitPhoneToDialLocal(user.phone || user.phoneNumber || '');
  setPhoneDial('profileEdit', parsedPhone.dial);
  if($('profileEditPhone')) $('profileEditPhone').value=formatPhoneGuide(parsedPhone.local || '');
  if($('profileEditEmail')) $('profileEditEmail').value=user.email || '';
  const err=$('profileSettingsError'); if(err) err.textContent='';
  ['profileCurrentPassword','profileNewPassword','profileConfirmPassword'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false');
}
function closeProfileSettings(){const modal=$('profileSettingsModal'); if(modal){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}}
window.openSiteAuth = openSiteAuth;
window.closeSiteAuth = closeSiteAuth;

async function findExistingUserProfileForAuth(firebaseUser){
  const uid = String(firebaseUser?.uid || '').trim();
  const email = String(firebaseUser?.email || '').trim().toLowerCase();
  const emailLocalKey = normalizeUsername(email ? email.split('@')[0] : '');
  const candidates = [];
  if(uid){
    try{
      const snap = await getDocs(query(collection(db,'users'), where('uid','==',uid)));
      snap.forEach(d=>{
        const data = d.data() || {};
        candidates.push({id:d.id, ...data, usernameKey: normalizeUsername(data.usernameKey || data.username || data.name || d.id)});
      });
    }catch(e){ console.warn('AZOBSS user lookup by uid skipped:', e?.code || e?.message || e); }
  }
  if(!candidates.length && email){
    try{
      const mapSnap = await getDocs(query(collection(db,'usernameAuthEmails'), where('email','==',email)));
      for(const d of mapSnap.docs){
        const key = normalizeUsername(d.id);
        if(!key) continue;
        try{
          const userSnap = await getDoc(doc(db,'users',key));
          if(userSnap.exists()){
            const data = userSnap.data() || {};
            candidates.push({id:key, ...data, usernameKey: normalizeUsername(data.usernameKey || data.username || data.name || key)});
          }
        }catch(e){}
      }
    }catch(e){ console.warn('AZOBSS usernameAuthEmails lookup skipped:', e?.code || e?.message || e); }
  }
  if(!candidates.length) return null;
  candidates.sort((a,b)=>{
    const aId = normalizeUsername(a.id || a.usernameKey || a.username || '');
    const bId = normalizeUsername(b.id || b.usernameKey || b.username || '');
    const score = (r,id)=>{
      let s = 0;
      if(id && id !== emailLocalKey) s += 20;
      if(id && normalizeUsername(r.usernameKey || r.username || '') === id) s += 10;
      if(r.email || r.authEmail) s += 2;
      if(r.phone) s += 1;
      return s;
    };
    return score(b,bId) - score(a,aId);
  });
  return candidates[0];
}

async function ensureUserProfile(firebaseUser, fallback={}){
  const explicitUsernameKey = normalizeUsername(fallback.usernameKey || fallback.username || fallback.name || '');
  const saved = getSavedUser?.() || {};
  const savedUsernameKey = String(saved.uid || '') === String(firebaseUser?.uid || '') ? normalizeUsername(saved.usernameKey || saved.username || saved.name || '') : '';
  const usernameKey = explicitUsernameKey || savedUsernameKey;

  // Important: never create a Firestore username from Gmail prefix (example zedann.0002@gmail.com -> zedann0002).
  // That was the source of duplicate users. If no real username is supplied, locate the existing profile by uid/email mapping instead.
  if(!usernameKey){
    const existingByUid = await findExistingUserProfileForAuth(firebaseUser);
    if(existingByUid) return { uid: firebaseUser.uid, ...existingByUid };
    return {
      uid: firebaseUser.uid,
      usernameKey:'',
      email: firebaseUser.email || '',
      authEmail: firebaseUser.email || '',
      verified: !!firebaseUser.emailVerified,
      emailVerified: !!firebaseUser.emailVerified,
      _profileMissing: true
    };
  }

  const ref = doc(db, 'users', usernameKey);
  const snap = await getDoc(ref);
  if(snap.exists()) return { uid: firebaseUser.uid, id: usernameKey, ...snap.data(), usernameKey: normalizeUsername(snap.data().usernameKey || snap.data().username || usernameKey) };
  const fallbackMemberCode = normalizePaMemberCode(fallback.inviteCode || fallback.inviteCodeUsed || fallback.invitedByCode || fallback.memberCode || fallback.paMemberCode || '');
  const signupPhone = normalizeAzobssPhone(fallback.phone || fallback.phoneNumber || '');
  const profile={uid:firebaseUser.uid,usernameKey,username:usernameKey,email:fallback.email||firebaseUser.email||'',authEmail:fallback.email||firebaseUser.email||'',phone:signupPhone,phoneNumber:signupPhone,...getPaBmPayloadFromCode(fallbackMemberCode),role:'member',verified:!!firebaseUser.emailVerified,emailVerified:!!firebaseUser.emailVerified,createdAt:serverTimestamp()};
  try{
    await setDoc(ref,profile,{merge:true});
    if(profile.email) await setDoc(doc(db,'usernameAuthEmails',usernameKey),{uid:firebaseUser.uid,email:profile.email,username:usernameKey,usernameKey,updatedAt:serverTimestamp()},{merge:true});
  }catch(profileWriteError){
    console.warn('AZOBSS ensureUserProfile write skipped:', profileWriteError?.code || profileWriteError?.message || profileWriteError);
  }
  return profile;
}





// Firebase persistent admin/user records.
const AZOBSS_LOGIN_HISTORY_COLLECTION = 'loginHistory';
const AZOBSS_ONLINE_USERS_COLLECTION = 'onlineUsers';
const AZOBSS_GUEST_HISTORY_COLLECTION = 'guestHistory';
const AZOBSS_ADMIN_PAGE_SIZE = 6;
let azobssRegisteredUsersPage = 1;
let azobssLiveUsersPage = 1;
let azobssLoginHistoryPage = 1;
let azobssGuestHistoryPage = 1;
const AZOBSS_REAL_ONLINE_MS = 180000; // only show users seen within the last 3 minutes
let azobssPresenceHeartbeatTimer = null;


async function azobssCleanupCollection(collectionName){
 try{
 const snap=await getDocs(query(collection(db,collectionName),orderBy("createdAt","desc")));
 if(snap.size<=25) return;
 const extra=snap.docs.slice(25);
 for(const d of extra){ await deleteDoc(d.ref);} 
 }catch(e){console.warn("cleanup",e)}
}
function firestoreMs(value){
  if(!value) return 0;
  if(typeof value.toMillis === 'function') return value.toMillis();
  if(typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
let azobssLastRegisteredUsers = [];
function recordDisplayName(record){
  return escHtml(record.displayName || record.usernameKey || record.name || 'User');
}
function userDocId(user){
  return String(user?.id || user?.usernameKey || user?.name || '').trim().toLowerCase();
}
function dedupeRegisteredUsers(users){
  const best = new Map();
  const scoreUser = (u)=>{
    const id = normalizeUsername(u?.id || u?.usernameKey || u?.username || u?.name || '');
    const email = String(u?.email || u?.authEmail || '').toLowerCase();
    const emailLocalKey = normalizeUsername(email ? email.split('@')[0] : '');
    let s = 0;
    if(id && id !== emailLocalKey) s += 100;
    if(id && normalizeUsername(u?.usernameKey || u?.username || u?.name || '') === id) s += 50;
    if(u?.phone) s += 5;
    if(u?.email || u?.authEmail) s += 3;
    s += Number(firestoreMs(u?.createdAt) || u?.createdAtMs || 0) / 10000000000000;
    return s;
  };
  (users || []).forEach(u=>{
    const key = String(u?.uid || u?.email || u?.authEmail || userDocId(u) || '').trim().toLowerCase();
    if(!key) return;
    const prev = best.get(key);
    if(!prev || scoreUser(u) > scoreUser(prev)) best.set(key,u);
  });
  return Array.from(best.values());
}
function userProfileHtml(user){
  const role = String(user.role || 'member').toLowerCase();
  const hasAccess = registeredUserHasPaAccess(user);
  const id = escHtml(userDocId(user));
  const isSelf = String(getSavedUser()?.usernameKey || '').toLowerCase() === String(id).toLowerCase();
  const createdDate = user.createdAt?.toDate ? user.createdAt.toDate() : (user.createdAt ? new Date(user.createdAt) : null);
  const registeredText = createdDate && !isNaN(createdDate) ? createdDate.toLocaleDateString() + " • " + createdDate.toLocaleTimeString([], {hour:"numeric",minute:"2-digit",hour12:true}) : "Unknown";
  return `<div class="az-admin-user-row-card az-admin-user-compact-card">
    <div class="az-admin-user-compact-name"><strong>${recordDisplayName(user)}</strong></div>
    <span class="az-admin-user-access-badge ${hasAccess ? 'is-allowed' : 'is-blocked'}">${hasAccess ? 'PA/BM allowed' : 'PA/BM off'}</span>
    <span class="az-admin-register-date">${registeredText}</span>
    <div class="az-admin-user-row-actions">
      <button class="az-admin-small-btn az-admin-edit-small" type="button" data-admin-edit-user="${id}">Edit</button>
      <button class="az-admin-small-btn az-admin-delete-small" type="button" data-admin-delete-user="${id}" ${isSelf ? 'disabled title="Cannot delete current admin"' : ''}>Delete</button>
    </div>
  </div>`;
}
function openAdminUserEdit(userId){
  if(!isAzobssAdmin(getSavedUser())) return;
  const id = String(userId || '').toLowerCase();
  const user = azobssLastRegisteredUsers.find(u => userDocId(u) === id);
  if(!user) return;
  const modal = $('adminUserEditModal');
  if(!modal) return;
  $('adminUserEditDocId').value = userDocId(user);
  $('adminUserEditUsername').value = user.usernameKey || user.name || '';
  const adminPhoneParts = splitPhoneToDialLocal(user.phone || user.phoneNumber || '');
  setPhoneDial('adminUserEdit', adminPhoneParts.dial);
  $('adminUserEditPhone').value = formatPhoneGuide(adminPhoneParts.local || '');
  $('adminUserEditEmail').value = user.email || '';
  $('adminUserEditRole').value = String(user.role || 'member').toLowerCase() === 'admin' ? 'admin' : 'member';
  const existingCode = user.invitedByCode || user.memberCode || user.paMemberCode || user.accessCode || user.signupCode || '';
  $('adminUserEditPaAccess').value = (registeredUserHasPaAccess(user) || normalizePaMemberCode(existingCode)===AZOBSS_PA_MEMBER_CODE) ? 'yes' : 'no';
  $('adminUserEditMemberCode').value = existingCode;
  const err = $('adminUserEditError');
  if(err){ err.textContent=''; err.style.color=''; }
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
}
function closeAdminUserEdit(){
  const modal = $('adminUserEditModal');
  if(modal){ modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); }
}
async function saveAdminUserEdit(){
  const err = $('adminUserEditError');
  if(err){ err.textContent=''; err.style.color=''; }
  if(!isAzobssAdmin(getSavedUser())){ if(err) err.textContent='Admin only.'; return; }
  const docId = String($('adminUserEditDocId')?.value || '').trim().toLowerCase();
  const usernameKey = normalizeUsername($('adminUserEditUsername')?.value);
  if(!docId || !usernameKey){ if(err) err.textContent='Username is required.'; return; }
  const allowPaAccess = String($('adminUserEditPaAccess')?.value || 'no') === 'yes';
  const typedCode = normalizePaMemberCode($('adminUserEditMemberCode')?.value || '');
  const code = allowPaAccess ? (typedCode || 'ZX6186') : '';
  const existingAdminUser = azobssLastRegisteredUsers.find(u => userDocId(u) === docId) || {};
  const adminEditedPhone = getPhoneWithDial('adminUserEdit');
  const adminFinalPhone = mergePhonePreserve(existingAdminUser.phone || existingAdminUser.phoneNumber || '', adminEditedPhone);
  const payload = {
    usernameKey,
    name: usernameKey,
    displayName: usernameKey,
    phone: adminFinalPhone,
    phoneNumber: adminFinalPhone,
    email: String($('adminUserEditEmail')?.value || '').trim().toLowerCase(),
    role: String($('adminUserEditRole')?.value || 'member').trim().toLowerCase(),
    invitedByCode: code,
    memberCode: code,
    paMemberCode: code,
    paBmAccess: allowPaAccess,
    paBmAllowed: allowPaAccess,
    allowPABM: allowPaAccess,
    allowPaBm: allowPaAccess,
    allowPaBmTab: allowPaAccess,
    paBmTabAllowed: allowPaAccess,
    showPaBmTab: allowPaAccess,
    canAccessPaBm: allowPaAccess,
    paAccess: allowPaAccess ? 'yes' : 'no',
    updatedAt: serverTimestamp(),
    updatedAtClient: new Date().toISOString(),
    updatedByAdmin: getSavedUser()?.usernameKey || 'admin'
  };
  try{
    await setDoc(doc(db, 'users', docId), payload, { merge:true });
    const current = getSavedUser();
    if(current && String(current.usernameKey || '').toLowerCase() === docId){
      const updated = { ...current, ...payload };
      delete updated.updatedAt;
      saveUser(updated);
      syncHeader(updated);
    }
    if(err){ err.style.color='#62e6a5'; err.textContent='User updated successfully.'; }
    await renderFirebaseAdminRecords();
    setTimeout(closeAdminUserEdit, 650);
  }catch(error){
    console.warn('Admin user edit failed:', error);
    if(err) err.textContent='Failed to save user. Check Firebase rules / internet connection.';
  }
}
async function deleteAdminRegisteredUser(userId){
  if(!isAzobssAdmin(getSavedUser())) return;
  const docId = String(userId || '').trim().toLowerCase();
  if(!docId) return;
  if(String(getSavedUser()?.usernameKey || '').toLowerCase() === docId){
    alert('Current admin account cannot be deleted here.');
    return;
  }
  const user = azobssLastRegisteredUsers.find(u => userDocId(u) === docId);
  const name = user ? recordDisplayName(user).replace(/<[^>]+>/g,'') : docId;
  if(!confirm(`Delete registered user record for ${name}?

This removes the website profile record from Firestore. Firebase Auth login account may still need removal from Firebase Console if required.`)) return;
  try{
    await deleteDoc(doc(db, 'users', docId));
    try{ await deleteDoc(doc(db, AZOBSS_ONLINE_USERS_COLLECTION, docId)); }catch(e){}
    try{ await deleteDoc(doc(db,'purchaseSummaries',docId)); }catch(e){}
    try{
      const cols=['loginHistory','purchaseLogs'];
      for(const c of cols){
        const qs=await getDocs(query(collection(db,c), where('usernameKey','==',docId)));
        for(const d of qs.docs){ await deleteDoc(d.ref); }
      }
    }catch(e){ console.warn('Cascade delete warning',e);}
    azobssLastRegisteredUsers = azobssLastRegisteredUsers.filter(u => userDocId(u) !== docId);
    const maxPage = Math.max(1, Math.ceil(azobssLastRegisteredUsers.length / AZOBSS_ADMIN_PAGE_SIZE));
    azobssRegisteredUsersPage = Math.min(azobssRegisteredUsersPage, maxPage);
    await renderFirebaseAdminRecords();
  }catch(error){
    console.warn('Admin delete user failed:', error);
    alert('Failed to delete user record. Check Firebase rules / internet connection.');
  }
}
function azobssIsRealOnline(user){
  const ms = firestoreMs(user.lastSeenAt) || firestoreMs(user.lastSeenClient) || firestoreMs(user.lastLoginAt);
  return ms > 0 && (Date.now() - ms) <= AZOBSS_REAL_ONLINE_MS;
}
function azobssInlineTime(ms){
  return ms ? new Date(ms).toLocaleString('en-MY',{hour12:false}) : '-';
}
function liveUserHtml(user){
  const ms = firestoreMs(user.lastSeenAt) || firestoreMs(user.lastSeenClient) || firestoreMs(user.lastLoginAt);
  return `<div class="purchase-summary-item admin-purchase-user-card az-admin-inline-card">
    <div class="az-admin-inline-row">
      <strong>${recordDisplayName(user)}</strong>
      <span>Email: ${escHtml(user.email || '-')}</span>
      <span>Phone: ${escHtml(normalizeAzobssPhone(user.phone || user.phoneNumber || '') || '-')}</span>
      <span>Status: <b class="az-status-online">online</b></span>
      <span>Seen: ${azobssInlineTime(ms)}</span>
    </div>
  </div>`;
}
function loginHistoryHtml(row){
  const ms = firestoreMs(row.createdAt) || firestoreMs(row.createdAtClient) || Number(row.createdAtMs || 0);
  return `<div class="purchase-summary-item admin-purchase-user-card az-admin-inline-card">
    <div class="az-admin-inline-row">
      <strong>${recordDisplayName(row)}</strong>
      <span>${row.action === 'signup' ? 'Sign up' : 'Login'}</span>
      <span>Email: ${escHtml(row.email || '-')}</span>
      <span>Phone: ${escHtml(normalizeAzobssPhone(row.phone || row.phoneNumber || '') || '-')}</span>
      <span>Time: ${azobssInlineTime(ms)}</span>
    </div>
  </div>`;
}
function guestHistoryHtml(row){
  const ms = firestoreMs(row.createdAt) || firestoreMs(row.createdAtClient) || Number(row.createdAtMs || 0);
  const ip = row.ipAddress || row.ip || '-';
  const device = row.deviceId || row.deviceFingerprint || '-';
  const page = row.page || row.path || '/';
  return `<div class="purchase-summary-item admin-purchase-user-card az-admin-inline-card">
    <div class="az-admin-inline-row">
      <strong>Guest</strong>
      <span>IP: ${escHtml(ip)}</span>
      <span>Device ID: ${escHtml(device)}</span>
      <span>Page: ${escHtml(page)}</span>
      <span>Time: ${azobssInlineTime(ms)}</span>
    </div>
  </div>`;
}
function azobssBuildCompactPagerHtml(current, totalPages){
  const button = (label, page, disabled, active, title) =>
    `<button class="guest-history-page-btn is-compact${active ? ' is-active' : ''}" type="button" data-page="${page}" title="${title || label}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const pages = [];
  pages.push(button('&lt;&lt;', 1, current <= 1, false, 'First page'));
  pages.push(button('P', Math.max(1, current - 1), current <= 1, false, 'Previous page'));

  // Maximum 10 buttons total: <<, P, 6 page numbers, N, >>
  const maxNumberButtons = 6;
  let start = Math.max(1, current - Math.floor(maxNumberButtons / 2));
  let end = Math.min(totalPages, start + maxNumberButtons - 1);
  start = Math.max(1, end - maxNumberButtons + 1);

  for(let i = start; i <= end; i++){
    pages.push(button(String(i), i, false, current === i, 'Page ' + i));
  }

  pages.push(button('N', Math.min(totalPages, current + 1), current >= totalPages, false, 'Next page'));
  pages.push(button('&gt;&gt;', totalPages, current >= totalPages, false, 'Last page'));
  return pages.join('');
}
function adminPager(el, page, total, size, onPage){
  if(!el) return;
  const totalPages = Math.max(1, Math.ceil((total || 0) / size));
  if(total <= size){ el.innerHTML = ''; return; }
  page = Math.min(Math.max(1, page), totalPages);
  el.innerHTML = azobssBuildCompactPagerHtml(page, totalPages);
  el.querySelectorAll('button[data-page]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      onPage(Number(btn.dataset.page) || page);
    });
  });
}
async function upsertOnlineUser(user){
  const u = user || getSavedUser();
  if(!u || !u.usernameKey) return;
  try{
    await setDoc(doc(db, AZOBSS_ONLINE_USERS_COLLECTION, String(u.usernameKey).toLowerCase()), {
      uid: u.uid || '', usernameKey: String(u.usernameKey).toLowerCase(), displayName: u.usernameKey || u.name || '',
      email: u.email || '', phone: normalizeAzobssPhone(u.phone || u.phoneNumber || ''), phoneNumber: normalizeAzobssPhone(u.phone || u.phoneNumber || ''), role: u.role || 'member',
      invitedByCode: u.invitedByCode || '', memberCode: u.memberCode || '', paMemberCode: u.paMemberCode || '',
      status: 'online',
      lastSeenAt: serverTimestamp(), lastSeenClient: new Date().toISOString(), lastSeenMs: Date.now()
    }, { merge:true });
  }catch(error){ console.warn('Firebase online user save failed:', error); }
}
async function removeOnlineUser(user){
  const u = user || getSavedUser();
  if(!u || !u.usernameKey) return;
  try{ await deleteDoc(doc(db, AZOBSS_ONLINE_USERS_COLLECTION, String(u.usernameKey).toLowerCase())); }
  catch(error){ console.warn('Firebase online user remove failed:', error); }
}
function startAzobssPresenceHeartbeat(user){
  const u = user || getSavedUser();
  if(!u || !u.usernameKey) return;
  if(azobssPresenceHeartbeatTimer) clearInterval(azobssPresenceHeartbeatTimer);
  upsertOnlineUser(u);
  azobssPresenceHeartbeatTimer = setInterval(()=>{
    if(document.visibilityState !== 'hidden') upsertOnlineUser(getSavedUser() || u);
  }, 60000);
}
async function recordLoginHistory(user, action='login'){
  const u = user || getSavedUser();
  if(!u || !u.usernameKey) return;
  const sessionKey = `azobssLoginHistorySaved:${action}:${u.usernameKey}`;
  if(sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');
  try{
    await addDoc(collection(db, AZOBSS_LOGIN_HISTORY_COLLECTION), {
      uid: u.uid || '', usernameKey: String(u.usernameKey).toLowerCase(), displayName: u.usernameKey || u.name || '',
      email: u.email || '', phone: normalizeAzobssPhone(u.phone || u.phoneNumber || ''), phoneNumber: normalizeAzobssPhone(u.phone || u.phoneNumber || ''), role: u.role || 'member', action,
      invitedByCode: u.invitedByCode || '', memberCode: u.memberCode || '', paMemberCode: u.paMemberCode || '',
      createdAt: serverTimestamp(), createdAtClient: new Date().toISOString(), createdAtMs: Date.now()
    });
  }catch(error){ console.warn('Firebase login history save failed:', error); }
}
async function saveProfileToFirebase(user){
  const u = user || getSavedUser();
  if(!u || !u.usernameKey) return;
  try{
    const preservedPhone = normalizeAzobssPhone(u.phone || u.phoneNumber || '');
    const normalizedUser = {...u, phone: preservedPhone, phoneNumber: preservedPhone};
    await setDoc(doc(db, 'users', String(u.usernameKey).toLowerCase()), {
      ...normalizedUser,
      usernameKey: String(u.usernameKey).toLowerCase(),
      updatedAt: serverTimestamp(),
      updatedAtClient: new Date().toISOString()
    }, { merge:true });
  }catch(error){ console.warn('Firebase profile save failed:', error); }
}

let azobssOnlineUserIds = new Set();
function getRegisteredUserControls(){
  return {
    search: document.getElementById('registeredUserSearch'),
    sort: document.getElementById('registeredUserSort'),
    refresh: document.getElementById('refreshUsersButton')
  };
}
function compactSearchValue(value){
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-()+.]/g, '');
}
function registeredUserSearchText(user){
  const rawValues = [
    user.id, user.uid,
    user.usernameKey, user.username, user.displayName, user.name,
    user.email, user.contactEmail, user.emailAddress, user.userEmail,
    user.phone, user.phoneNumber, user.whatsapp, user.whatsApp, user.whatsappNumber, user.mobile, user.mobileNumber,
    user.memberCode, user.invitedByCode, user.paMemberCode, user.accessCode, user.signupCode,
    user.role
  ].filter(v => v !== undefined && v !== null);
  const normalText = rawValues.map(v => String(v).toLowerCase()).join(' ');
  const compactText = rawValues.map(compactSearchValue).join(' ');
  const digitsOnly = rawValues.map(v => String(v || '').replace(/\D/g, '')).filter(Boolean).join(' ');
  return `${normalText} ${compactText} ${digitsOnly}`;
}
function registeredUserHasPaAccess(user){
  if(!user) return false;
  const role = String(user.role || 'member').toLowerCase();
  if(role === 'admin') return true;
  if(getPaBmFlagAllowed(user)) return true;
  return getPaMemberCodes(user).includes(AZOBSS_PA_MEMBER_CODE);
}
function registeredUserCreatedMs(user){
  return firestoreMs(user.createdAt) || firestoreMs(user.createdAtClient) || Number(user.createdAtMs || 0) || firestoreMs(user.updatedAt) || firestoreMs(user.updatedAtClient);
}
function getFilteredRegisteredUsers(users){
  const controls = getRegisteredUserControls();
  const q = String(controls.search?.value || '').trim().toLowerCase();
  const sort = String(controls.sort?.value || 'username');
  let rows = Array.isArray(users) ? users.slice() : [];

  if(q){
    const compactQ = compactSearchValue(q);
    const digitQ = q.replace(/\D/g, '');
    rows = rows.filter(user => {
      const haystack = registeredUserSearchText(user);
      return haystack.includes(q) || (compactQ && haystack.includes(compactQ)) || (digitQ && haystack.includes(digitQ));
    });
  }

  if(sort === 'onlineOnly'){
    rows = rows.filter(user => azobssOnlineUserIds.has(userDocId(user)));
  }else if(sort === 'paAllowed'){
    rows = rows.filter(registeredUserHasPaAccess);
  }

  if(sort === 'dateNewest'){
    rows.sort((a,b)=>registeredUserCreatedMs(b)-registeredUserCreatedMs(a));
  }else if(sort === 'dateOldest'){
    rows.sort((a,b)=>registeredUserCreatedMs(a)-registeredUserCreatedMs(b));
  }else{
    rows.sort((a,b)=>recordDisplayName(a).localeCompare(recordDisplayName(b), undefined, {sensitivity:'base'}));
  }
  return rows;
}
function updateRegisteredUserStats(users){
  const todayEl = document.getElementById('registeredUsersToday');
  const monthEl = document.getElementById('registeredUsersMonth');
  if(!todayEl && !monthEl) return;
  const now = new Date();
  let today = 0, month = 0;
  (users || []).forEach(user => {
    const ms = registeredUserCreatedMs(user);
    if(!ms) return;
    const d = new Date(ms);
    if(d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()){
      month++;
      if(d.getDate() === now.getDate()) today++;
    }
  });
  if(todayEl) todayEl.textContent = String(today);
  if(monthEl) monthEl.textContent = String(month);
}

function renderRegisteredUsersFromCacheOnly(){
  try{
    const users = Array.isArray(azobssLastRegisteredUsers) ? azobssLastRegisteredUsers : [];
    updateRegisteredUserStats(users);
    const filteredUsers = getFilteredRegisteredUsers(users);
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / AZOBSS_ADMIN_PAGE_SIZE));
    azobssRegisteredUsersPage = Math.min(Math.max(1, azobssRegisteredUsersPage), maxPage);
    const regList = document.getElementById('registeredUsersList');
    if(regList){
      const rows = filteredUsers.slice((azobssRegisteredUsersPage-1)*AZOBSS_ADMIN_PAGE_SIZE, azobssRegisteredUsersPage*AZOBSS_ADMIN_PAGE_SIZE);
      regList.innerHTML = rows.map(userProfileHtml).join('') || '<div class="purchase-summary-item">No registered users found.</div>';
      regList.querySelectorAll('[data-admin-edit-user]').forEach(btn=>btn.addEventListener('click',()=>openAdminUserEdit(btn.dataset.adminEditUser)));
      regList.querySelectorAll('[data-admin-delete-user]').forEach(btn=>btn.addEventListener('click',()=>deleteAdminRegisteredUser(btn.dataset.adminDeleteUser)));
      adminPager(document.getElementById('registeredUsersPagination'), azobssRegisteredUsersPage, filteredUsers.length, AZOBSS_ADMIN_PAGE_SIZE, page=>{azobssRegisteredUsersPage=page; renderRegisteredUsersFromCacheOnly();});
    }
    const registeredCount = document.getElementById('registeredUserCount');
    if(registeredCount) registeredCount.textContent = String(users.length);
  }catch(error){
    console.warn('Registered users local filter failed:', error);
  }
}

function bindRegisteredUsersControls(){
  const controls = getRegisteredUserControls();
  [controls.search, controls.sort, controls.refresh].forEach(el => {
    if(!el || el.dataset.azobssRegisteredUsersBind) return;
    el.dataset.azobssRegisteredUsersBind = '1';
    const refreshHandler = () => {
      azobssRegisteredUsersPage = 1;
      renderFirebaseAdminRecords();
    };
    const localFilterHandler = () => {
      azobssRegisteredUsersPage = 1;
      renderRegisteredUsersFromCacheOnly();
    };
    if(el.tagName === 'BUTTON') el.addEventListener('click', refreshHandler);
    else {
      // Do not re-read Firestore on every search keystroke. Filter cached admin rows only.
      el.addEventListener('input', localFilterHandler);
      el.addEventListener('change', localFilterHandler);
    }
  });
}


function getAzobssDeviceId(){
  const key = 'azobssDeviceId';
  let id = localStorage.getItem(key);
  if(!id){
    id = 'device-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10);
    localStorage.setItem(key, id);
  }
  return id;
}
async function getAzobssPublicIp(){
  const cacheKey = 'azobssPublicIpCache';
  try{
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if(cached && cached.ip && Date.now() - Number(cached.time || 0) < 3600000) return cached.ip;
  }catch(_e){}
  try{
    const res = await fetch('https://api.ipify.org?format=json', { cache:'no-store' });
    const data = await res.json();
    const ip = String(data.ip || '').trim();
    if(ip) sessionStorage.setItem(cacheKey, JSON.stringify({ ip, time: Date.now() }));
    return ip || '-';
  }catch(error){
    console.warn('Public IP lookup failed:', error);
    return '-';
  }
}
async function recordGuestHistory(){
  try{
    if(getSavedUser()) return;
    const page = window.location.pathname || '/';
    const sessionKey = 'azobssGuestHistorySaved';
    if(sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    const deviceId = getAzobssDeviceId();
    const ipAddress = await getAzobssPublicIp();
    await addDoc(collection(db, AZOBSS_GUEST_HISTORY_COLLECTION), {
      page,
      ipAddress,
      deviceId,
      platform: navigator.platform || '',
      userAgent: navigator.userAgent || '',
      createdAt: serverTimestamp(),
      createdAtClient: new Date().toISOString(),
      createdAtMs: Date.now()
    });
  }catch(error){ console.warn('Firebase guest history save failed:', error); }
}
async function renderFirebaseAdminRecords(){
  const current = getSavedUser();
  if(!isAzobssAdmin(current)) return;
  bindRegisteredUsersControls();

  let live = [];
  try{
    const liveSnapPre = await getDocs(collection(db, AZOBSS_ONLINE_USERS_COLLECTION));
    liveSnapPre.forEach(d=>live.push({ id:d.id, ...d.data() }));
    azobssOnlineUserIds = new Set(live.map(userDocId).filter(Boolean));
  }catch(error){
    console.warn('Firebase online users pre-read failed:', error);
    azobssOnlineUserIds = new Set();
  }

  try{
    const rawUsers = [];
    const userSnap = await getDocs(collection(db, 'users'));
    userSnap.forEach(d=>rawUsers.push({ id:d.id, ...d.data() }));
    const users = dedupeRegisteredUsers(rawUsers);
    users.sort((a,b)=>recordDisplayName(a).localeCompare(recordDisplayName(b), undefined, {sensitivity:'base'}));
    azobssLastRegisteredUsers = users;
    updateRegisteredUserStats(users);
    const filteredUsers = getFilteredRegisteredUsers(users);
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / AZOBSS_ADMIN_PAGE_SIZE));
    azobssRegisteredUsersPage = Math.min(Math.max(1, azobssRegisteredUsersPage), maxPage);
    const regList = document.getElementById('registeredUsersList');
    if(regList){
      const rows = filteredUsers.slice((azobssRegisteredUsersPage-1)*AZOBSS_ADMIN_PAGE_SIZE, azobssRegisteredUsersPage*AZOBSS_ADMIN_PAGE_SIZE);
      regList.innerHTML = rows.map(userProfileHtml).join('') || '<div class="purchase-summary-item">No registered users found.</div>';
      regList.querySelectorAll('[data-admin-edit-user]').forEach(btn=>btn.addEventListener('click',()=>openAdminUserEdit(btn.dataset.adminEditUser)));
      regList.querySelectorAll('[data-admin-delete-user]').forEach(btn=>btn.addEventListener('click',()=>deleteAdminRegisteredUser(btn.dataset.adminDeleteUser)));
      adminPager(document.getElementById('registeredUsersPagination'), azobssRegisteredUsersPage, filteredUsers.length, AZOBSS_ADMIN_PAGE_SIZE, page=>{azobssRegisteredUsersPage=page; renderFirebaseAdminRecords();});
    }
    const registeredCount = document.getElementById('registeredUserCount');
    if(registeredCount) registeredCount.textContent = String(users.length);
  }catch(error){ console.warn('Firebase registered users read failed:', error); }

  try{
    if(!live.length){
      const liveSnap = await getDocs(collection(db, AZOBSS_ONLINE_USERS_COLLECTION));
      liveSnap.forEach(d=>live.push({ id:d.id, ...d.data() }));
      azobssOnlineUserIds = new Set(live.map(userDocId).filter(Boolean));
    }
    live = live.filter(azobssIsRealOnline);
    live.sort((a,b)=>(firestoreMs(b.lastSeenAt)||firestoreMs(b.lastSeenClient))-(firestoreMs(a.lastSeenAt)||firestoreMs(a.lastSeenClient)));
    const liveMaxPage = Math.max(1, Math.ceil(live.length / AZOBSS_ADMIN_PAGE_SIZE));
    azobssLiveUsersPage = Math.min(Math.max(1, azobssLiveUsersPage), liveMaxPage);
    const liveList = document.getElementById('liveUsersList');
    if(liveList){
      const rows = live.slice((azobssLiveUsersPage-1)*AZOBSS_ADMIN_PAGE_SIZE, azobssLiveUsersPage*AZOBSS_ADMIN_PAGE_SIZE);
      liveList.innerHTML = rows.map(liveUserHtml).join('') || '<div class="purchase-summary-item">No users are online right now.</div>';
      adminPager(document.getElementById('liveUsersPagination'), azobssLiveUsersPage, live.length, AZOBSS_ADMIN_PAGE_SIZE, page=>{azobssLiveUsersPage=page; renderFirebaseAdminRecords();});
    }
    const onlineUserCount = document.getElementById('onlineUserCount');
    if(onlineUserCount) onlineUserCount.textContent = String(live.length);
  }catch(error){ console.warn('Firebase live users read failed:', error); }

  try{
    const rows = [];
    const historySnap = await getDocs(collection(db, AZOBSS_LOGIN_HISTORY_COLLECTION));
    historySnap.forEach(d=>rows.push({ id:d.id, ...d.data() }));
    rows.sort((a,b)=>(firestoreMs(b.createdAt)||Number(b.createdAtMs||0))-(firestoreMs(a.createdAt)||Number(a.createdAtMs||0)));
    const list = document.getElementById('loginHistoryList');
    if(list){
      const visible = rows.slice((azobssLoginHistoryPage-1)*AZOBSS_ADMIN_PAGE_SIZE, azobssLoginHistoryPage*AZOBSS_ADMIN_PAGE_SIZE);
      list.innerHTML = visible.map(loginHistoryHtml).join('') || '<div class="purchase-summary-item">No login history yet.</div>';
      adminPager(document.getElementById('loginHistoryPagination'), azobssLoginHistoryPage, rows.length, AZOBSS_ADMIN_PAGE_SIZE, page=>{azobssLoginHistoryPage=page; renderFirebaseAdminRecords();});
    }
    const now = new Date();
    const todayKey = now.toISOString().slice(0,10);
    const monthKey = now.toISOString().slice(0,7);
    const today = rows.filter(r=>new Date(firestoreMs(r.createdAt)||Number(r.createdAtMs||0)).toISOString().slice(0,10)===todayKey).length;
    const month = rows.filter(r=>new Date(firestoreMs(r.createdAt)||Number(r.createdAtMs||0)).toISOString().slice(0,7)===monthKey).length;
    const todayEl = document.getElementById('loginHistoryToday'); if(todayEl) todayEl.textContent = String(today);
    const monthEl = document.getElementById('loginHistoryMonth'); if(monthEl) monthEl.textContent = String(month);
  }catch(error){ console.warn('Firebase login history read failed:', error); }

  try{
    const rows = [];
    const guestSnap = await getDocs(collection(db, AZOBSS_GUEST_HISTORY_COLLECTION));
    guestSnap.forEach(d=>rows.push({ id:d.id, ...d.data() }));
    rows.sort((a,b)=>(firestoreMs(b.createdAt)||Number(b.createdAtMs||0))-(firestoreMs(a.createdAt)||Number(a.createdAtMs||0)));
    const list = document.getElementById('guestHistoryList');
    if(list){
      const maxPage = Math.max(1, Math.ceil(rows.length / AZOBSS_ADMIN_PAGE_SIZE));
      azobssGuestHistoryPage = Math.min(Math.max(1, azobssGuestHistoryPage), maxPage);
      const visible = rows.slice((azobssGuestHistoryPage-1)*AZOBSS_ADMIN_PAGE_SIZE, azobssGuestHistoryPage*AZOBSS_ADMIN_PAGE_SIZE);
      list.innerHTML = visible.map(guestHistoryHtml).join('') || '<div class="purchase-summary-item">No guest history yet.</div>';
      adminPager(document.getElementById('guestHistoryPagination'), azobssGuestHistoryPage, rows.length, AZOBSS_ADMIN_PAGE_SIZE, page=>{azobssGuestHistoryPage=page; renderFirebaseAdminRecords();});
    }
    const now = new Date();
    const todayKey = now.toISOString().slice(0,10);
    const monthKey = now.toISOString().slice(0,7);
    const today = rows.filter(r=>new Date(firestoreMs(r.createdAt)||Number(r.createdAtMs||0)).toISOString().slice(0,10)===todayKey).length;
    const month = rows.filter(r=>new Date(firestoreMs(r.createdAt)||Number(r.createdAtMs||0)).toISOString().slice(0,7)===monthKey).length;
    const todayEl = document.getElementById('guestVisitsToday'); if(todayEl) todayEl.textContent = String(today);
    const monthEl = document.getElementById('guestVisitsMonth'); if(monthEl) monthEl.textContent = String(month);
  }catch(error){ console.warn('Firebase guest history read failed:', error); }
}
window.azobssRenderFirebaseAdminRecords = renderFirebaseAdminRecords;


// PA/BM purchase records: one shared source for PA + BM/SBM downloads.
const AZOBSS_PURCHASE_LOCAL_KEY = 'azobssPurchaseRecords';
const AZOBSS_PURCHASE_COLLECTION = 'purchaseLogs';
const AZOBSS_PURCHASE_SUMMARIES_COLLECTION = 'purchaseSummaries';
const AZOBSS_PA_BM_MAX_DOWNLOADS = 5;
const AZOBSS_PA_BM_VALID_DAYS = 7;
const AZOBSS_PA_BM_VALID_MS = AZOBSS_PA_BM_VALID_DAYS * 24 * 60 * 60 * 1000;
function clearLegacyPurchaseBrowserCache(){
  try { localStorage.removeItem(AZOBSS_PURCHASE_LOCAL_KEY); } catch {}
}
function readLocalPurchaseRecords(){
  // Firestore is the single source of truth for PA/BM records.
  // Old browser cache caused deleted/old items to reappear and inflate Total.
  clearLegacyPurchaseBrowserCache();
  return [];
}
function writeLocalPurchaseRecords(records){
  // Do not persist PA/BM purchase records in old browser storage.
  // Use a short-lived stable cache only to prevent admin UI flicker when Firestore/backend is still warming up.
  clearLegacyPurchaseBrowserCache();
  try{
    const rows = Array.isArray(records) ? records.filter(Boolean).slice(0, 1000) : [];
    if(rows.length){
      sessionStorage.setItem('azobssPaBmPurchaseStableCacheV2', JSON.stringify({ at: Date.now(), rows }));
      window.__AZOBSS_PABM_LAST_GOOD_PURCHASE_ROWS__ = rows;
    }
  }catch(e){}
}
function readStablePurchaseRecords(){
  try{
    if(Array.isArray(window.__AZOBSS_PABM_LAST_GOOD_PURCHASE_ROWS__) && window.__AZOBSS_PABM_LAST_GOOD_PURCHASE_ROWS__.length){
      return window.__AZOBSS_PABM_LAST_GOOD_PURCHASE_ROWS__.slice();
    }
  }catch(e){}
  try{
    const raw = sessionStorage.getItem('azobssPaBmPurchaseStableCacheV2') || '';
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.rows)) return [];
    const age = Date.now() - Number(parsed.at || 0);
    if(age > 10 * 60 * 1000) return [];
    return parsed.rows.slice();
  }catch(e){ return []; }
}
function getCurrentAdminStablePurchaseRows(key){
  const rows = readStablePurchaseRecords();
  if(!key) return rows;
  return rows.filter(item => String(item.usernameKey || '').toLowerCase() === key || String(item.displayName || '').toLowerCase() === key || String(item.username || '').toLowerCase() === key);
}
function purchaseRecordUser(user){
  const u = user || getSavedUser() || {};
  return {
    uid: String(u.uid || ''),
    usernameKey: String(u.usernameKey || u.name || (u.email ? String(u.email).split('@')[0] : '') || '').trim().toLowerCase(),
    displayName: String(u.usernameKey || u.name || u.usernameKey || u.username || 'Guest').trim(),
    phone: String(u.phone || u.phoneNumber || ''),
    email: String(u.email || '')
  };
}
function normalizePurchasePayload(payload){
  const userInfo = purchaseRecordUser();
  const type = String(payload?.productType || payload?.product || payload?.type || 'PA').trim().toUpperCase();
  const code = String(payload?.itemCode || payload?.code || payload?.station || payload?.stationNo || payload?.stesen || payload?.pa || payload?.noPA || payload?.productId || payload?.id || '').trim().toUpperCase();
  const negeri = String(payload?.negeri || payload?.state || payload?.stateName || '').trim();
  const amount = Number(payload?.amount || payload?.price || (type === 'PA' ? 5 : 3));
  const now = new Date();
  return {
    id: 'local-' + now.getTime() + '-' + Math.random().toString(36).slice(2, 8),
    productType: type,
    itemCode: code,
    stationNo: String(payload?.stationNo || payload?.stesen || payload?.station || '').trim().toUpperCase(),
    productId: String(payload?.productId || payload?.id || '').trim(),
    jenis: String(payload?.jenis || (type === 'SBM' ? '2' : '1')).trim() === '2' ? '2' : '1',
    daerah: String(payload?.daerah || '').trim(),
    bandar: String(payload?.bandar || '').trim(),
    huraian: String(payload?.huraian || '').trim(),
    negeri,
    amount: Number.isFinite(amount) ? amount : (type === 'PA' ? 5 : 3),
    status: String(payload?.status || 'pending').trim().toLowerCase(),
    downloadUrl: String(payload?.downloadUrl || payload?.url || ''),
    filename: String(payload?.filename || ''),
    azobssCartValidated: payload?.azobssCartValidated === true || payload?.cartValidated === true || payload?.skipFileVerify === true,
    azobssCartValidatedBy: String(payload?.azobssCartValidatedBy || payload?.cartValidatedBy || '').trim(),
    uid: userInfo.uid,
    usernameKey: userInfo.usernameKey,
    displayName: userInfo.displayName,
    phone: userInfo.phone,
    email: userInfo.email,
    createdAtClient: now.toISOString(),
    createdAtMs: now.getTime(),
    downloadCount: 0,
    maxDownloads: AZOBSS_PA_BM_MAX_DOWNLOADS
  };
}
function isSamePurchase(a,b){
  return String(a.id||'') && String(a.id||'') === String(b.id||'') ||
    (String(a.usernameKey||'') === String(b.usernameKey||'') &&
     String(a.productType||'') === String(b.productType||'') &&
     String(a.itemCode||'') === String(b.itemCode||'') &&
     Math.abs(Number(a.createdAtMs||0)-Number(b.createdAtMs||0)) < 3000);
}
function purchasePersistDocId(user){
  const key = getUserKey(user || getSavedUser());
  const uid = String((user || getSavedUser() || {}).uid || '').trim();
  return key || uid || '';
}
function purchaseFirestoreSafeRecord(record){
  const safe = { ...record };
  delete safe.id;
  delete safe.firestoreId;
  Object.keys(safe).forEach(key => {
    if(safe[key] === undefined) delete safe[key];
  });
  return safe;
}
async function savePurchaseToFirestoreEverywhere(record){
  const current = getSavedUser() || {};
  const docId = purchasePersistDocId(current);
  const safeRecord = purchaseFirestoreSafeRecord(record);
  const embeddedRecord = {
    ...safeRecord,
    id: record.id || ('purchase-' + Date.now()),
    createdAtMs: Number(record.createdAtMs || Date.now()),
    createdAtClient: record.createdAtClient || new Date().toISOString()
  };

  // 1) Global collection for admin dashboard/reporting and controlled download.
  // This document id is the source for /api/pa-bm-download?recordId=...
  try{
    const ref = await addDoc(collection(db, AZOBSS_PURCHASE_COLLECTION), { ...safeRecord, createdAt: serverTimestamp() });
    record.firestoreId = ref.id;
    embeddedRecord.firestoreId = ref.id;
    embeddedRecord.purchaseLogId = ref.id;
  }catch(error){
    console.warn('Firestore global purchase collection save failed:', error);
  }

  // 2) User profile embedded backup. This fixes records disappearing after browser close
  // even when Firestore rules block collection queries but allow the user's own profile doc.
  // If purchaseLogs create succeeded, embed the firestoreId so backend can still migrate/verify.
  if(docId){
    try{
      await setDoc(doc(db, 'users', docId), {
        usernameKey: docId,
        uid: String(current.uid || record.uid || ''),
        purchaseRecords: arrayUnion(embeddedRecord),
        purchaseRecordsUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }catch(error){
      console.warn('Firestore user embedded purchase save failed:', error);
    }
  }
}

async function azobssVerifyPurchaseFileExists(record){
  const type = String(record && record.productType || '').trim().toUpperCase();
  const url = String(record && record.downloadUrl || '').trim();
  if(!/^PA$|^BM|^SBM/.test(type)) return true;

  // Cart should never download/convert the real file just to add an item.
  // PA and BM/SBM files are re-validated by the backend after payment via the controlled download route.
  // This prevents false "tiada dalam simpanan" caused by Render cold-start, JUPEM temporary errors,
  // or PDF/TIF conversion timing while the user is only adding to cart.
  if(record && record.azobssCartValidated){
    return true;
  }

  // BM/SBM rows already come from /stesen-tanda-aras-records.json on this page.
  // If a row has productId/stationNo or a backend download URL, treat it as cart-valid and defer real file fetch until paid download.
  if(type === 'BM' || type === 'SBM'){
    const hasLocalRow = !!(record.productId || record.stationNo || record.itemCode || /\/api\/download-stesen-tanda-aras/i.test(url));
    if(hasLocalRow) return true;
    throw new Error('BM/SBM tiada dalam simpanan');
  }

  // For PA, use the lightweight check endpoint where possible. Do not call /api/pa-pdf here.
  if(type === 'PA'){
    const code = String(record.itemCode || '').replace(/^PA/i, '').replace(/\.TIF$/i, '').replace(/[^0-9]/g, '');
    const negeri = String(record.negeri || '').trim();
    if(!code || !negeri) throw new Error('PA tiada dalam simpanan');
    try{
      const checkUrl = 'https://azobss-backend.onrender.com/api/check-pa?noPA=' + encodeURIComponent('PA' + code + '.TIF') + '&negeri=' + encodeURIComponent(negeri);
      const response = await fetch(checkUrl, { cache: 'no-store' });
      if(response && response.ok){
        const data = await response.json().catch(function(){ return null; });
        if(data && data.ok === true) return true;
      }
    }catch(error){
      console.warn('AZOBSS PA cart lightweight check skipped:', error);
    }
    // Do not block cart on a temporary JUPEM/check endpoint issue.
    // Actual paid download will still verify the PA file from JUPEM.
    return true;
  }

  if(!url){
    throw new Error(type === 'PA' ? 'PA tiada dalam simpanan' : 'BM/SBM tiada dalam simpanan');
  }
  return true;
}

function azobssPurchaseItemKey(item){
  item = item || {};
  return [
    String(item.usernameKey || '').trim().toLowerCase(),
    String(item.uid || '').trim(),
    String(item.productType || item.product || '').trim().toUpperCase(),
    String(item.itemCode || item.stationNo || item.stesen || item.code || '').trim().toUpperCase(),
    String(item.negeri || item.state || '').trim().toUpperCase()
  ].join('|');
}

function azobssSameCartItem(a, b){
  return azobssPurchaseItemKey(a) === azobssPurchaseItemKey(b);
}

async function azobssFindExistingCartPurchase(record){
  const resetMap = readAzobssPurchaseTotalResetMap ? readAzobssPurchaseTotalResetMap() : {};
  const resetAt = Number((resetMap || {})[String(record.usernameKey || '').toLowerCase()] || 0);
  const current = getSavedUser() || {};
  const candidates = [];

  function pushItem(item){
    if(!item) return;
    let ms = Number(item.createdAtMs || 0);
    if(!ms && item.createdAtClient) ms = Date.parse(item.createdAtClient) || 0;
    if(!ms && item.createdAt && typeof item.createdAt.toMillis === 'function') ms = item.createdAt.toMillis();
    candidates.push({ ...item, createdAtMs: ms });
  }

  function pushSnap(snap){
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      let ms = Number(data.createdAtMs || 0);
      if(!ms && data.createdAtClient) ms = Date.parse(data.createdAtClient) || 0;
      if(!ms && data.createdAt && typeof data.createdAt.toMillis === 'function') ms = data.createdAt.toMillis();
      candidates.push({ id: docSnap.id, firestoreId: docSnap.id, ...data, createdAtMs: ms });
    });
  }

  try{
    const purchaseCol = collection(db, AZOBSS_PURCHASE_COLLECTION);
    if(current && current.uid){
      pushSnap(await getDocs(query(purchaseCol, where('uid', '==', String(current.uid)))));
    }
    if(record.usernameKey){
      pushSnap(await getDocs(query(purchaseCol, where('usernameKey', '==', String(record.usernameKey)))));
    }
  }catch(error){}

  try{
    const key = getUserKey(current);
    if(key){
      const userSnap = await getDoc(doc(db, 'users', key));
      if(userSnap.exists()){
        const data = userSnap.data() || {};
        (Array.isArray(data.purchaseRecords) ? data.purchaseRecords : []).forEach(pushItem);
      }

      const summarySnap = await getDoc(doc(db, AZOBSS_PURCHASE_SUMMARIES_COLLECTION, key));
      if(summarySnap.exists()){
        const data = summarySnap.data() || {};
        (Array.isArray(data.records) ? data.records : []).forEach(pushItem);
      }
    }
  }catch(error){}

  return candidates.find(item =>
    azobssSameCartItem(item, record)
    && purchaseRecordMs(item) > resetAt
    && ['paid','cancelled','deleted'].indexOf(String(item.status || 'pending').toLowerCase()) === -1
  ) || null;
}

async function recordAzobssPurchase(payload){
  const user = getSavedUser();
  if(!user){
    openSiteAuth('signin');
    throw new Error('Please login first before add to cart.');
  }
  const record = normalizePurchasePayload(payload || {});
  // Final safety guard: PA/BM/SBM mesti wujud dahulu sebelum masuk cart/total.
  await azobssVerifyPurchaseFileExists(record);

  // Firestore is the source of truth. If the item is already pending in cart,
  // do not add it again and do not increase total.
  const existingUnpaid = await azobssFindExistingCartPurchase(record);
  if(existingUnpaid){
    const alreadyRecord = { ...existingUnpaid, __azobssAlreadyInCart: true };
    window.dispatchEvent(new CustomEvent('azobssPurchaseRecorded', { detail: alreadyRecord }));
    try{ window.dispatchEvent(new Event('storage')); }catch{}
    return alreadyRecord;
  }

  await savePurchaseToFirestoreEverywhere(record);
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
    normalized.usernameKey = String(normalized.usernameKey || '').trim().toLowerCase();
    normalized.uid = String(normalized.uid || '');
    if(!merged.some(item => isSamePurchase(item, normalized))) merged.push(normalized);
  }
  function pushSnap(snap){
    snap.forEach(docSnap => {
      const data = docSnap.data() || {};
      let ms = Number(data.createdAtMs || 0);
      if(!ms && data.createdAtClient) ms = Date.parse(data.createdAtClient) || 0;
      if(!ms && data.createdAt && typeof data.createdAt.toMillis === 'function') ms = data.createdAt.toMillis();
      push({ id: docSnap.id, firestoreId: docSnap.id, ...data, createdAtMs: ms });
    });
  }

  // Browser cache is intentionally ignored here.
  // Firestore/admin records are the only source for Purchase Records Saya and Total.
  clearLegacyPurchaseBrowserCache();

  try{
    const purchaseCol = collection(db, AZOBSS_PURCHASE_COLLECTION);
    if(isAdminUser){
      // Admin can read all purchase records if Firestore rules allow it.
      pushSnap(await getDocs(purchaseCol));
    }else if(current?.uid){
      // Normal users should only query their own records. This works with stricter Firestore rules.
      pushSnap(await getDocs(query(purchaseCol, where('uid', '==', String(current.uid)))));
    }

    const key = getUserKey(current);
    if(!isAdminUser && key){
      // Compatibility for older records saved before uid was available.
      try{
        pushSnap(await getDocs(query(purchaseCol, where('usernameKey', '==', key))));
      }catch(usernameQueryError){
        console.warn('Firestore purchase usernameKey compatibility query failed:', usernameQueryError);
      }
    }
  }catch(error){
    console.warn('Firestore purchase collection read fallback:', error);
  }

  // Robust persistence path: read embedded records from user profile docs too.
  try{
    if(isAdminUser){
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach(userDoc => {
        const userData = userDoc.data() || {};
        const embedded = Array.isArray(userData.purchaseRecords) ? userData.purchaseRecords : [];
        embedded.forEach(r => push({
          ...r,
          usernameKey: r.usernameKey || userData.usernameKey || userDoc.id,
          displayName: r.displayName || userData.usernameKey || userDoc.id,
          phone: r.phone || r.phoneNumber || userData.phone || userData.phoneNumber || '',
          email: r.email || userData.email || ''
        }));
      });
    }else{
      const docId = purchasePersistDocId(current);
      if(docId){
        const userSnap = await getDoc(doc(db, 'users', docId));
        const userData = userSnap.exists() ? (userSnap.data() || {}) : {};
        const embedded = Array.isArray(userData.purchaseRecords) ? userData.purchaseRecords : [];
        embedded.forEach(r => push({
          ...r,
          usernameKey: r.usernameKey || userData.usernameKey || docId,
          displayName: r.displayName || userData.usernameKey || docId,
          phone: r.phone || r.phoneNumber || userData.phone || userData.phoneNumber || '',
          email: r.email || userData.email || ''
        }));
      }
    }
  }catch(error){
    console.warn('Firestore embedded purchase records read fallback:', error);
  }

  if(isAdminUser){
    try{
      const backendRows = await azobssLoadAdminPaBmPurchaseRecordsFromBackend(false);
      backendRows.forEach(push);
    }catch(backendError){
      console.warn('Admin PA/BM backend records fallback skipped:', backendError);
    }
  }

  const key = getUserKey(current);
  const rows = merged
    .filter(item => isAdminUser || String(item.usernameKey || '').toLowerCase() === key || (current?.uid && String(item.uid||'') === String(current.uid)))
    .sort((a,b) => Number(b.createdAtMs||0) - Number(a.createdAtMs||0));

  // Keep latest successful result in a short-lived stable cache so admin UI does not randomly blank during auth/backend warm-up.
  if(rows.length){
    writeLocalPurchaseRecords(rows.slice(0, 500));
    return rows;
  }
  if(isAdminUser){
    const stableRows = readStablePurchaseRecords();
    if(stableRows.length){
      console.warn('AZOBSS PA/BM admin records using stable cache because live read returned empty.');
      return stableRows;
    }
  }
  return rows;
}
function escHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function formatPurchaseDate(record){
  const ms = Number(record.createdAtMs || (record.createdAtClient ? Date.parse(record.createdAtClient) : 0));
  if(!ms) return '-';
  return new Date(ms).toLocaleString('en-MY', { hour12:true, hour:'numeric', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric' });
}
const AZOBSS_PURCHASE_PAGE_SIZE = 6;
const AZOBSS_ADMIN_PURCHASE_PAGE_SIZE = 6;
const AZOBSS_PURCHASE_DETAIL_PAGE_SIZE = 6;
const azobssPurchaseDetailPages = {};
const azobssPurchaseOpenKeys = {};
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
  currentPage = clampPage(currentPage, totalPages);
  container.hidden = false;
  container.classList.add('azobss-record-pagination');
  container.innerHTML = azobssBuildCompactPagerHtml(currentPage, totalPages);
  container.querySelectorAll('button[data-page]').forEach(btn => {
    btn.addEventListener('click', () => onPage(Number(btn.dataset.page) || currentPage));
  });
}
function renderAzobssPurchaseDetailPager(key, currentPage, totalItems){
  const totalPages = Math.max(1, Math.ceil((Number(totalItems)||0) / AZOBSS_PURCHASE_DETAIL_PAGE_SIZE));
  if(totalItems <= AZOBSS_PURCHASE_DETAIL_PAGE_SIZE) return '';
  currentPage = clampPage(currentPage, totalPages);
  return `<div class="guest-history-pagination az-purchase-detail-pagination" data-purchase-detail-key="${escHtml(key)}">${azobssBuildCompactPagerHtml(currentPage, totalPages)}</div>`;
}
function azobssIsPurchasePaidForDownload(r){
  /*
    095 strict paid logic:
    Download must only appear for records that are explicitly paid/verified.
    Do NOT treat downloadUrl, fileUrl, or user purchaseTotalResetAtMs as paid.
    Those older fallbacks caused unpaid rows to show "Download 0/5".
  */
  try{
    if(!r) return false;
    if(azobssIsPurchaseStatusPaid(r)) return true;

    const status = String(r?.status || r?.paymentStatus || r?.payment_status || '').trim().toLowerCase();
    if(['paid','success','completed','settled','verified','approved'].includes(status)) return true;

    if(r?.paid === true || r?.verified === true || r?.isPaid === true || r?.paymentVerified === true) return true;

    const paidAt = Number(r?.paidAtMs || r?.verifiedAtMs || r?.paymentVerifiedAtMs || 0)
      || (r?.paidAtClient ? Date.parse(r.paidAtClient) : 0)
      || (r?.verifiedAtClient ? Date.parse(r.verifiedAtClient) : 0);
    if(paidAt && Number.isFinite(paidAt)) return true;

    return false;
  }catch(e){
    return false;
  }
}

function azobssCanUncartPurchase(r){
  try{
    const current = getSavedUser() || {};
    if(isAzobssAdmin && isAzobssAdmin(current)) return false; // admin already has Delete controls in admin view
    const status = String(r?.status || 'pending').trim().toLowerCase();
    if(['paid','success','completed','settled','cancelled','deleted'].includes(status)) return false;
    if(azobssIsPurchasePaidForDownload(r)) return false;
    const currentKey = String(current.usernameKey || current.displayName || current.username || '').trim().toLowerCase();
    const rowKey = String(r?.usernameKey || r?.displayName || '').trim().toLowerCase();
    const uidOk = current.uid && String(r?.uid || '') === String(current.uid);
    return !!(uidOk || (currentKey && rowKey && currentKey === rowKey));
  }catch(e){ return false; }
}

function azobssBuildPaidPurchaseDownloadUrl(r){
  r = r || {};
  const recordId = String(r.firestoreId || r.id || '').trim();
  if(recordId){
    return 'https://azobss-backend.onrender.com/api/pa-bm-download?recordId=' + encodeURIComponent(recordId);
  }
  // Fallback only for legacy paid records without Firestore document id.
  const type = String(r.productType || r.product || '').trim().toUpperCase();
  if(type === 'PA'){
    const itemCode = String(r.itemCode || r.pa || r.noPA || '').trim().replace(/^PA/i, '').replace(/\.TIF$/i, '').replace(/[^0-9]/g, '');
    const negeri = String(r.negeri || r.state || '').trim();
    if(itemCode && negeri){
      return 'https://azobss-backend.onrender.com/api/pa-pdf?noPA=PA' + encodeURIComponent(itemCode) + '.TIF&negeri=' + encodeURIComponent(negeri);
    }
  }
  return String(r.downloadUrl || r.url || '').trim();
}
function azobssPaidPurchaseDownloadFilename(r){
  r = r || {};
  const type = String(r.productType || r.product || '').trim().toUpperCase();
  if(type === 'PA'){
    const itemCode = String(r.itemCode || r.pa || r.noPA || '').trim().replace(/^PA/i, '').replace(/\.TIF$/i, '').replace(/[^0-9]/g, '');
    return itemCode ? ('PA' + itemCode + '.pdf') : 'PA.pdf';
  }
  const code = String(r.itemCode || r.stationNo || r.stesen || r.productId || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-');
  const prefix = type || (String(r.jenis || '1') === '2' ? 'SBM' : 'BM');
  return (prefix + (code ? '-' + code : '') + '.pdf').replace(/-+/g, '-');
}

function azobssPurchasePaidAtMs(r){
  return Number(r?.paidAtMs || 0)
    || (r?.paidAtClient ? Date.parse(r.paidAtClient) : 0)
    || (r?.updatedAt && typeof r.updatedAt.toMillis === 'function' ? r.updatedAt.toMillis() : 0)
    || purchaseRecordMs(r)
    || Date.now();
}
function azobssPurchaseDownloadMax(r){
  const max = Number(r?.maxDownloads || r?.maxDownload || 0);
  return max > 0 ? max : AZOBSS_PA_BM_MAX_DOWNLOADS;
}
function azobssPurchaseDownloadCount(r){
  return Math.max(0, Number(r?.downloadCount || r?.usedCount || 0));
}
function azobssPurchaseDownloadExpiresAtMs(r){
  const explicit = Number(r?.downloadExpiresAtMs || r?.expiresAtMs || 0)
    || (r?.downloadExpiresAtClient ? Date.parse(r.downloadExpiresAtClient) : 0)
    || (r?.expiresAt ? Date.parse(r.expiresAt) : 0);
  if(explicit) return explicit;
  return azobssPurchasePaidAtMs(r) + AZOBSS_PA_BM_VALID_MS;
}
function azobssPurchaseDownloadRemainingDays(r){
  const ms = azobssPurchaseDownloadExpiresAtMs(r) - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
function azobssPurchaseDownloadExpired(r){
  return Date.now() > azobssPurchaseDownloadExpiresAtMs(r);
}
function azobssPurchaseDownloadLimitReached(r){
  return azobssPurchaseDownloadCount(r) >= azobssPurchaseDownloadMax(r);
}
function azobssPurchaseDownloadAllowed(r){
  return azobssIsPurchasePaidForDownload(r) && !azobssPurchaseDownloadExpired(r) && !azobssPurchaseDownloadLimitReached(r);
}
function azobssBuildControlledPurchaseDownloadUrl(r){
  // Actual PA/BM file URL. The 5x / 7-day limit is enforced before opening it.
  return azobssBuildPaidPurchaseDownloadUrl(r);
}
function azobssPurchaseDownloadPayload(r){
  try{
    const computedPaid = azobssIsPurchasePaidForDownload(r);
    const createdAtMs = purchaseRecordMs ? purchaseRecordMs(r) : Number(r?.createdAtMs || 0);
    return encodeURIComponent(JSON.stringify({
      firestoreId: r?.firestoreId || r?.id || '',
      id: r?.id || '',
      uid: r?.uid || '',
      usernameKey: r?.usernameKey || '',
      displayName: r?.displayName || '',
      productType: r?.productType || r?.product || '',
      itemCode: r?.itemCode || r?.pa || r?.noPA || r?.stesen || r?.stationNo || '',
      negeri: r?.negeri || r?.state || '',
      amount: r?.amount || '',
      downloadUrl: r?.downloadUrl || r?.url || '',
      status: computedPaid ? 'paid' : (r?.status || ''),
      createdAtMs: createdAtMs || Number(r?.createdAtMs || 0) || 0,
      createdAtClient: r?.createdAtClient || '',
      downloadCount: azobssPurchaseDownloadCount(r),
      maxDownloads: azobssPurchaseDownloadMax(r),
      paidAtMs: azobssPurchasePaidAtMs(r),
      downloadExpiresAtMs: azobssPurchaseDownloadExpiresAtMs(r)
    }));
  }catch(e){ return ''; }
}
function azobssPurchaseResetPayload(r){
  try{
    return encodeURIComponent(JSON.stringify({
      recordId: r?.firestoreId || r?.id || r?.purchaseLogId || '',
      firestoreId: r?.firestoreId || '',
      id: r?.id || '',
      productType: r?.productType || r?.product || '',
      itemCode: r?.itemCode || r?.pa || r?.noPA || r?.stesen || r?.stationNo || '',
      negeri: r?.negeri || r?.state || '',
      usernameKey: r?.usernameKey || ''
    }));
  }catch(e){ return ''; }
}
async function azobssGetFirebaseAuthHeaders(forceRefresh){
  try{
    const u = auth && auth.currentUser ? auth.currentUser : null;
    if(!u || typeof u.getIdToken !== 'function') return {};
    const token = await u.getIdToken(!!forceRefresh);
    return token ? { Authorization: 'Bearer ' + token } : {};
  }catch(e){
    return {};
  }
}
try{ window.azobssGetFirebaseAuthHeaders = azobssGetFirebaseAuthHeaders; }catch(_e){}

async function azobssLoadAdminPaBmPurchaseRecordsFromBackend(forceRefresh){
  const current = getSavedUser && getSavedUser() || {};
  if(!isAzobssAdmin(current)) return [];
  try{
    const base = (typeof azobssGetBackendBaseUrl === 'function') ? azobssGetBackendBaseUrl() : 'https://azobss-backend.onrender.com';
    const headers = Object.assign({ 'Accept':'application/json' }, await azobssGetFirebaseAuthHeaders(!!forceRefresh));
    const response = await fetch(base + '/api/admin/pa-bm-purchase-records?limit=2000', { method:'GET', headers, cache:'no-store' });
    if((response.status === 401 || response.status === 403) && !forceRefresh){
      return azobssLoadAdminPaBmPurchaseRecordsFromBackend(true);
    }
    const data = await response.json().catch(function(){ return null; });
    if(!response.ok || !data || data.ok === false){
      console.warn('Admin PA/BM purchase backend fallback failed:', data && (data.error || data.message) || response.status);
      return [];
    }
    const rows = Array.isArray(data.records) ? data.records : [];
    return rows.map(function(r){
      return Object.assign({}, r, {
        id: r.firestoreId || r.id || r.purchaseLogId || '',
        firestoreId: r.firestoreId || r.id || r.purchaseLogId || '',
        usernameKey: String(r.usernameKey || r.username || r.displayName || '').trim().toLowerCase(),
        createdAtMs: Number(r.createdAtMs || 0) || (r.createdAtClient ? Date.parse(r.createdAtClient) : 0) || 0
      });
    });
  }catch(error){
    console.warn('Admin PA/BM purchase backend fallback error:', error);
    return [];
  }
}

async function azobssAdminResetPaBmDownloadCounter(encodedPayload, btn){
  let payload = {};
  try{ payload = JSON.parse(decodeURIComponent(String(encodedPayload || ''))); }catch(e){ payload = {}; }
  const recordId = String(payload.recordId || payload.firestoreId || payload.id || '').trim();
  if(!recordId){ alert('Record ID tidak ditemui.'); return false; }
  const current = getSavedUser && getSavedUser() || {};
  if(!isAzobssAdmin(current)){ alert('Admin sahaja boleh reset download count.'); return false; }
  if(!confirm('Reset download count untuk item ini kembali ke 0/5 dan renew tempoh 7 hari?')) return false;
  const oldText = btn ? btn.textContent : '';
  try{
    if(btn){ btn.disabled = true; btn.textContent = 'Resetting...'; }
    let headers = Object.assign({ 'Content-Type':'application/json' }, await azobssGetFirebaseAuthHeaders(false));
    let response = await fetch('https://azobss-backend.onrender.com/api/pa-bm-download/reset-count', {
      method:'POST',
      headers,
      body: JSON.stringify({ recordId })
    });
    if(response.status === 401 || response.status === 403){
      headers = Object.assign({ 'Content-Type':'application/json' }, await azobssGetFirebaseAuthHeaders(true));
      response = await fetch('https://azobss-backend.onrender.com/api/pa-bm-download/reset-count', {
        method:'POST',
        headers,
        body: JSON.stringify({ recordId })
      });
    }
    const data = await response.json().catch(function(){ return null; });
    if(!response.ok || !data || data.ok === false){
      alert((data && (data.error || data.message)) || 'Reset download count gagal.');
      return false;
    }
    alert('Download count sudah reset ke 0/5. Tempoh download diperbaharui 7 hari.');
    try{ azobssSchedulePurchaseRecordsRefresh('admin reset download count'); }catch(e){}
    setTimeout(function(){ try{ azobssSchedulePurchaseRecordsRefresh('admin reset download count delayed'); }catch(e){} }, 900);
    return false;
  }catch(error){
    console.error('Admin reset PA/BM download count failed:', error);
    alert('Reset download count gagal. Sila cuba lagi.');
    return false;
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = oldText || 'Reset 0/5'; }
  }
}
window.azobssAdminResetPaBmDownloadCounter = azobssAdminResetPaBmDownloadCounter;

function azobssCanShowPaBmAdminReset(){
  try{
    const saved = (typeof getSavedUser === 'function' && getSavedUser()) || {};
    if(typeof isAzobssAdmin === 'function' && isAzobssAdmin(saved)) return true;
    if(typeof window.azobssIsAdminUser === 'function' && window.azobssIsAdminUser(saved)) return true;
    const email = String((auth && auth.currentUser && auth.currentUser.email) || saved.email || saved.authEmail || '').trim().toLowerCase();
    const username = String(saved.usernameKey || saved.username || saved.name || (email ? email.split('@')[0] : '') || '').trim().toLowerCase();
    const role = String(saved.role || saved.accountRole || saved.userRole || '').trim().toLowerCase();
    if(role === 'admin') return true;
    if(['zedan91','zedan9107'].includes(username)) return true;
    if(['zedan91@azobss.local','zedan9107@gmail.com'].includes(email)) return true;
    try{
      const rawKeys = ['azobss_user','azobssUser','siteUser','currentUser','azobss_current_user'];
      for(const key of rawKeys){
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || '';
        if(!raw) continue;
        const u = JSON.parse(raw);
        const k = String(u.usernameKey || u.username || u.name || (u.email ? String(u.email).split('@')[0] : '') || '').trim().toLowerCase();
        const r = String(u.role || u.accountRole || u.userRole || '').trim().toLowerCase();
        const e = String(u.email || u.authEmail || '').trim().toLowerCase();
        if(r === 'admin' || ['zedan91','zedan9107'].includes(k) || ['zedan91@azobss.local','zedan9107@gmail.com'].includes(e)) return true;
      }
    }catch(_){ }
  }catch(_){ }
  return false;
}
window.azobssCanShowPaBmAdminReset = azobssCanShowPaBmAdminReset;

async function azobssClientControlledDownload(encodedPayload, linkEl, clickEvent){
  try{
    const ev = clickEvent || (window.event || null);
    if(ev){
      if(typeof ev.preventDefault === 'function') ev.preventDefault();
      if(typeof ev.stopPropagation === 'function') ev.stopPropagation();
      if(typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    }
  }catch(e){}
  let r = {};
  try{ r = JSON.parse(decodeURIComponent(String(encodedPayload || ''))); }catch(e){ r = {}; }

  const link = linkEl || (clickEvent && clickEvent.currentTarget) || (window.event && window.event.currentTarget) || null;
  const originalText = link ? link.textContent : '';
  if(link && link.dataset && link.dataset.busy === '1') return false;
  const used = azobssPurchaseDownloadCount(r);
  const max = azobssPurchaseDownloadMax(r);
  const expiresAtMs = azobssPurchaseDownloadExpiresAtMs(r);

  if(Date.now() > expiresAtMs){
    alert('Tempoh download telah tamat.');
    try{ azobssSchedulePurchaseRecordsRefresh('expired download click'); }catch(e){}
    return false;
  }

  if(used >= max){
    alert('Had download telah digunakan.');
    try{ azobssSchedulePurchaseRecordsRefresh('limit download click'); }catch(e){}
    return false;
  }

  const directUrl = azobssBuildPaidPurchaseDownloadUrl(r);
  if(!directUrl){
    alert('Link download tidak tersedia.');
    return false;
  }

  try{
    if(link){
      link.dataset.busy = '1';
      link.textContent = 'Preparing Download...';
      link.style.pointerEvents = 'none';
      link.setAttribute('aria-busy', 'true');
      link.setAttribute('href', '#');
      link.removeAttribute('download');
      link.removeAttribute('target');
    }

    const response = await fetch(directUrl, {
      method: 'GET',
      cache: 'no-store'
    });

    const fallbackFlag = String(response.headers.get('x-azobss-browser-fallback') || '').trim();
    if(fallbackFlag === '1'){
      const encodedOpenUrl = response.headers.get('x-azobss-open-url') || '';
      let openUrl = '';
      try{ openUrl = decodeURIComponent(encodedOpenUrl); }catch(e){ openUrl = encodedOpenUrl; }
      if(!openUrl){
        try{
          const fallbackHtml = await response.text();
          const m = fallbackHtml.match(/id=["']openBtn["'][^>]*href=["']([^"']+)/i) || fallbackHtml.match(/url=([^"'<>\s]+)/i);
          if(m && m[1]) openUrl = m[1].replace(/&amp;/g,'&');
        }catch(e){}
      }
      if(openUrl){
        try{ if(link){ link.textContent = 'Opening Download...'; } }catch(e){}
        try{ window.location.href = openUrl; }
        catch(e){
          const a = document.createElement('a');
          a.href = openUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }else{
        // Last resort: open the AZOBSS fallback HTML page directly instead of downloading it as a PDF/blob.
        try{ window.location.href = directUrl; }catch(e){}
      }
      try{ azobssSchedulePurchaseRecordsRefresh('download browser fallback'); }catch(e){}
      setTimeout(function(){
        try{ azobssSchedulePurchaseRecordsRefresh('download browser fallback delayed'); }catch(e){}
      }, 1600);
      return false;
    }

    const responseType = String(response.headers.get('content-type') || '').toLowerCase();
    if(responseType.includes('application/json')){
      let data = null;
      try{ data = await response.json(); }catch(e){ data = null; }
      if(data && data.openUrl){
        try{
          if(link){
            link.textContent = 'Opening Download...';
          }
          window.location.href = data.openUrl;
        }catch(e){
          const a = document.createElement('a');
          a.href = data.openUrl;
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        try{ azobssSchedulePurchaseRecordsRefresh('download browser fallback'); }catch(e){}
        setTimeout(function(){
          try{ azobssSchedulePurchaseRecordsRefresh('download browser fallback delayed'); }catch(e){}
        }, 1600);
        return false;
      }
      if(!response.ok || (data && data.ok === false)){
        alert((data && (data.error || data.message)) || 'Download gagal. Sila cuba lagi.');
        return false;
      }
    }

    if(!response.ok){
      let message = 'Download gagal. Sila cuba lagi.';
      try{
        const data = await response.json();
        if(data && data.error) message = data.error;
      }catch(e){}
      alert(message);
      return false;
    }

    const blob = await response.blob();
    if(!blob || !blob.size){
      alert('Fail download kosong. Sila cuba lagi.');
      return false;
    }

    let filename = azobssPaidPurchaseDownloadFilename(r);
    const disposition = response.headers.get('content-disposition') || response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
    if(match){
      filename = decodeURIComponent(match[1] || match[2] || filename);
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(blobUrl); }, 15000);

    try{ azobssSchedulePurchaseRecordsRefresh('download success'); }catch(e){}
    setTimeout(function(){
      try{ azobssSchedulePurchaseRecordsRefresh('download success delayed'); }catch(e){}
    }, 1200);

    return false;
  }catch(error){
    console.error('Controlled download failed:', error);
    alert('Download sedang disediakan atau server sedang bangun. Sila cuba semula sebentar lagi.');
    return false;
  }finally{
    if(link){
      link.dataset.busy = '';
      link.textContent = originalText || 'Download';
      link.style.pointerEvents = '';
      link.removeAttribute('aria-busy');
    }
  }
}
window.azobssClientControlledDownload = azobssClientControlledDownload;

(function(){
  if(window.__azobssPaBmDownloadCaptureInstalled) return;
  window.__azobssPaBmDownloadCaptureInstalled = true;
  function findDownloadLink(target){
    try{
      if(!target) return null;
      if(target.closest) return target.closest('.user-pa-download[data-download-url], .user-pa-download[data-download-payload]');
      while(target && target !== document){
        if(target.classList && target.classList.contains('user-pa-download')) return target;
        target = target.parentNode;
      }
    }catch(e){}
    return null;
  }
  document.addEventListener('click', function(ev){
    const link = findDownloadLink(ev.target);
    if(!link || link.classList.contains('is-locked') || link.classList.contains('is-pending-status')) return;
    const payload = link.getAttribute('data-download-payload') || '';
    const url = link.getAttribute('data-download-url') || '';
    if(!payload && !url) return;
    try{
      ev.preventDefault();
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    }catch(e){}
    if(window.azobssClientControlledDownload){
      if(payload){
        window.azobssClientControlledDownload(payload, link, ev);
      }else{
        // Legacy safety: never let Android/Chrome download AZOBSS JSON fallback as .pdf.json.
        link.removeAttribute('download');
        link.setAttribute('href', '#');
        fetch(url, { method:'GET', cache:'no-store' }).then(async function(response){
          const fallbackFlag = String(response.headers.get('x-azobss-browser-fallback') || '').trim();
          if(fallbackFlag === '1'){
            const encodedOpenUrl = response.headers.get('x-azobss-open-url') || '';
            let openUrl = '';
            try{ openUrl = decodeURIComponent(encodedOpenUrl); }catch(e){ openUrl = encodedOpenUrl; }
            if(openUrl){ window.location.href = openUrl; return; }
            window.location.href = url;
            return;
          }
          const type = String(response.headers.get('content-type') || '').toLowerCase();
          if(type.includes('application/json')){
            const data = await response.json().catch(function(){ return null; });
            if(data && data.openUrl){ window.location.href = data.openUrl; return; }
          }
          window.location.href = url;
        }).catch(function(){ window.location.href = url; });
      }
    }
    return false;
  }, true);
})();
function azobssPurchaseDownloadMetaHtml(r){
  if(!azobssIsPurchasePaidForDownload(r)) return '';
  const used = azobssPurchaseDownloadCount(r);
  const max = azobssPurchaseDownloadMax(r);
  const days = azobssPurchaseDownloadRemainingDays(r);
  return `<div class="az-download-meta">Downloads: <strong>${used}/${max}</strong><br>Tempoh sah: <strong>${days} hari</strong></div>`;
}


function azobssShortStateNameForPurchaseMobile(state){
  const raw = String(state || '').trim();
  const s = raw.toUpperCase().replace(/\s+/g,' ');
  if(!raw) return '-';
  if(s.includes('KUALA LUMPUR')) return 'W.P Kuala Lumpur';
  if(s.includes('PUTRAJAYA')) return 'W.P Putrajaya';
  if(s.includes('LABUAN')) return 'W.P Labuan';
  return raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\bWp\b/g,'W.P').replace(/\bW\.p\b/g,'W.P');
}

function purchaseDetailRowHtml(r){
  const item = `${r.productType || 'PA'} ${r.itemCode || '-'}`.trim();
  const amount = Number(r.amount || 0);
  const canUncart = azobssCanUncartPurchase(r);
  const paidDownloadUrl = azobssBuildControlledPurchaseDownloadUrl(r);
  const paidDownloadName = azobssPaidPurchaseDownloadFilename(r);
  const paid = azobssIsPurchasePaidForDownload(r);
  const allowed = azobssPurchaseDownloadAllowed(r);
  const expired = paid && azobssPurchaseDownloadExpired(r);
  const limitReached = paid && azobssPurchaseDownloadLimitReached(r);
  const used = azobssPurchaseDownloadCount(r);
  const max = azobssPurchaseDownloadMax(r);
  const days = azobssPurchaseDownloadRemainingDays(r);
  let actionHtml = '';
  const dlMetaHtml = `<span class="az-action-download-count" title="Muat turun">⬇ ${escHtml(String(used))}/${escHtml(String(max))}</span>`;
  const adminResetHtml = (paid && (window.azobssCanShowPaBmAdminReset ? window.azobssCanShowPaBmAdminReset() : isAzobssAdmin(getSavedUser && getSavedUser() || {})))
    ? `<button type="button" class="az-admin-reset-download-count" title="Admin reset download count to 0/5" onclick="if(event){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();} return window.azobssAdminResetPaBmDownloadCounter && window.azobssAdminResetPaBmDownloadCounter('${azobssPurchaseResetPayload(r)}', this);">Reset 0/5</button>`
    : '';
  if(paid && paidDownloadUrl && allowed){
    actionHtml = `<div class="user-pa-action-with-count"><a class="user-pa-download" href="#" data-download-url="${escHtml(paidDownloadUrl)}" data-download-name="${escHtml(paidDownloadName)}" data-download-payload="${azobssPurchaseDownloadPayload(r)}" onclick="if(event){event.preventDefault();event.stopPropagation();if(event.stopImmediatePropagation)event.stopImmediatePropagation();} if(window.azobssClientControlledDownload){ window.azobssClientControlledDownload('${azobssPurchaseDownloadPayload(r)}', this, event); } return false;">Download</a>${dlMetaHtml}${adminResetHtml}</div>`;
  }else if(paid){
    const reason = limitReached ? 'Digunakan' : (expired ? 'Tamat' : 'Expired');
    actionHtml = `<div class="user-pa-action-with-count"><span class="user-pa-download is-locked">${escHtml(reason)}</span>${dlMetaHtml}${adminResetHtml}</div>`;
  }else{
    actionHtml = `<div class="user-pa-pending-action"><span class="user-pa-download is-locked is-pending-status">⏱ Pending Payment</span>${canUncart ? `<button type="button" class="user-pa-uncart-btn is-cart-remove-btn" title="Remove from cart" aria-label="Remove from cart" onclick="window.azobssUncartPurchaseRecord && window.azobssUncartPurchaseRecord('${azobssPurchaseDeletePayload(r)}')"><span class="cart-x-icon">🛒<span class="cart-x-mark">×</span></span></button>` : ''}</div>`;
  }
  const idx = (window.__azPurchaseRowIndex = (window.__azPurchaseRowIndex||0)+1);
  return `
    <div class="user-pa-item purchase-detail-row compact-purchase-row compact-table-row">
      <div class="col-no">${idx}</div>
      <div class="col-item"><strong>${escHtml(item)}</strong></div>
      <div class="col-state"><strong>${escHtml(azobssShortStateNameForPurchaseMobile(r.negeri || r.state || '-'))}</strong></div>
      <div class="col-price">RM${escHtml(amount || '')}</div>
      <div class="col-date">${escHtml(formatPurchaseDate(r))}</div>
      <div class="col-exp" title="Tempoh">🕒 <strong>${escHtml(String(days))} hari</strong></div>
      <div class="col-action">${actionHtml}</div>
    </div>`;
}

function azobssPurchaseTableHeaderHtml(){
  return `<div class="user-pa-item purchase-detail-row compact-purchase-row compact-table-header">
    <div class="col-no">#</div>
    <div class="col-item">Item</div>
    <div class="col-state">📍 Negeri</div>
    <div class="col-price">RM Harga</div>
    <div class="col-date">📅 Tarikh / Masa</div>
    <div class="col-exp">🕒 Tempoh</div>
    <div class="col-action">Tindakan</div>
  </div>`;
}

function applyPurchaseSort(records, sort){
  const rows = records.slice();
  if(sort === 'oldest') rows.sort((a,b)=>Number(a.createdAtMs||0)-Number(b.createdAtMs||0));
  else if(sort === 'paAsc') rows.sort((a,b)=>String(a.itemCode||'').localeCompare(String(b.itemCode||'')));
  else if(sort === 'paDesc') rows.sort((a,b)=>String(b.itemCode||'').localeCompare(String(a.itemCode||'')));
  else if(sort === 'state') rows.sort((a,b)=>String(a.negeri||'').localeCompare(String(b.negeri||'')) || Number(b.createdAtMs||0)-Number(a.createdAtMs||0));
  else rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));
  return rows;
}
const AZOBSS_PURCHASE_TOTAL_RESET_KEY = 'azobss_purchase_total_reset_map_v1';
function readAzobssPurchaseTotalResetMap(){
  try{ return JSON.parse(localStorage.getItem(AZOBSS_PURCHASE_TOTAL_RESET_KEY) || '{}') || {}; }
  catch(e){ return {}; }
}
function writeAzobssPurchaseTotalResetMap(map){
  try{ localStorage.setItem(AZOBSS_PURCHASE_TOTAL_RESET_KEY, JSON.stringify(map || {})); }
  catch(e){}
}
function purchaseRecordMs(record){
  return Number(record?.createdAtMs || record?.timestampMs || record?.createdAtClientMs || 0) || (record?.createdAtClient ? Date.parse(record.createdAtClient) : 0) || (record?.createdAt ? Date.parse(record.createdAt) : 0) || 0;
}
function azobssPurchaseStatus(r){
  return String(r?.status || 'pending').trim().toLowerCase();
}
function azobssIsPurchaseStatusPaid(r){
  return ['paid','success','completed','settled'].includes(azobssPurchaseStatus(r));
}
function countablePurchaseRows(rows, usernameKey, resetMap){
  const key = String(usernameKey || '').trim().toLowerCase();
  const resetAt = Number((resetMap || {})[key] || 0);
  return (rows || []).filter(r => {
    const status = azobssPurchaseStatus(r);
    if(['paid','success','completed','settled','cancelled','deleted'].includes(status)) return false;
    return !resetAt || purchaseRecordMs(r) > resetAt;
  });
}
async function loadAzobssPurchaseTotalResetMap(){
  const map = readAzobssPurchaseTotalResetMap();
  const current = getSavedUser() || {};
  const isAdminUser = isAzobssAdmin(current);

  function applyUserDoc(docSnap){
    if(!docSnap || !docSnap.exists || !docSnap.exists()) return;
    const data = docSnap.data() || {};
    const key = String(data.usernameKey || data.username || docSnap.id || '').trim().toLowerCase();
    const ms = Number(data.purchaseTotalResetAtMs || 0) || (data.purchaseTotalResetAtClient ? Date.parse(data.purchaseTotalResetAtClient) : 0);
    if(key && ms) map[key] = ms;
  }

  try{
    if(isAdminUser){
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach(applyUserDoc);
    }else{
      const docIds = Array.from(new Set([
        purchasePersistDocId(current),
        String(current.usernameKey || current.username || current.displayName || '').trim().toLowerCase()
      ].filter(Boolean)));
      for(const id of docIds){
        try{ applyUserDoc(await getDoc(doc(db, 'users', id))); }catch(e){}
      }
    }
    writeAzobssPurchaseTotalResetMap(map);
  }catch(error){
    console.warn('Load purchase total reset map failed:', error);
  }
  return map;
}

function sortAdminPurchaseGroups(groupedRows, sort, resetMap){
  const metric = (key, rows) => {
    const countable = countablePurchaseRows(rows, key, resetMap);
    return {
      units: countable.length,
      amount: countable.reduce((sum,r)=>sum + (Number(r.amount)||0), 0),
      updated: Math.max(...rows.map(r=>Number(r.createdAtMs||0)))
    };
  };
  return groupedRows.slice().sort((a,b)=>{
    const am = metric(a[0], a[1]), bm = metric(b[0], b[1]);
    if(sort === 'amountAsc') return am.amount - bm.amount;
    if(sort === 'amountDesc') return bm.amount - am.amount;
    if(sort === 'unitsAsc') return am.units - bm.units;
    if(sort === 'unitsDesc') return bm.units - am.units;
    if(sort === 'username') return String(a[0]).localeCompare(String(b[0]));
    return bm.updated - am.updated;
  });
}
function renderUserPurchaseSummary(records, resetMap){
  const current = getSavedUser() || {};
  const latest = records.slice().sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0))[0] || {};
  const currentKey = String(current.usernameKey || current.displayName || latest.usernameKey || latest.displayName || '').trim().toLowerCase();
  const countableRowsForTotal = countablePurchaseRows(records, currentKey, resetMap);
  const total = countableRowsForTotal.reduce((sum,r)=>sum + (Number(r.amount)||0), 0);
  const username = current.displayName || current.username || current.usernameKey || latest.displayName || latest.usernameKey || 'User';
  const phone = current.phone || latest.phone || '';
  const lastItem = latest.itemCode ? `${latest.productType || 'PA'} ${latest.itemCode}` : '-';
  return `<div class="purchase-summary-item user-purchase-summary-card">
    <div><strong>${escHtml(username)}</strong>${phone ? `<span>${escHtml(phone)}</span>` : ''}</div>
    <div class="user-purchase-summary-meta">
      <span>Last: <strong>${escHtml(lastItem)}</strong></span>
      <span>Unit: <strong>${escHtml(countableRowsForTotal.length)}</strong></span>
      <span>Total: <strong>RM${escHtml(total)}</strong></span>
    </div>
  </div>`;
}


function azobssGetBackendBaseUrl(){
  return String(window.AZOBSS_BACKEND_URL || window.API_BASE_URL || localStorage.getItem('azobssPremiumBackendUrl') || localStorage.getItem('azobssSoftwareStatsBackendUrl') || 'https://azobss-backend.onrender.com').replace(/\/$/, '');
}
function azobssPurchasePaymentRows(records, resetMap){
  const current = getSavedUser() || {};
  const key = String(current.usernameKey || current.displayName || current.username || '').trim().toLowerCase();
  const rows = countablePurchaseRows((records || []).filter(r => {
    const rk = String(r.usernameKey || r.displayName || '').trim().toLowerCase();
    const uidOk = current.uid && String(r.uid || '') === String(current.uid);
    return !key || rk === key || uidOk;
  }), key, resetMap || {});
  return rows;
}
async function azobssRefreshPaBmToyyibTotal(records, resetMap){
  const el = document.getElementById('paBmToyyibTotal');
  if(!el) return 0;
  try{
    const rows = azobssPurchasePaymentRows(records || await loadAzobssPurchaseRecords(), resetMap || await loadAzobssPurchaseTotalResetMap());
    const total = rows.reduce((sum,r)=>sum + (Number(r.amount)||0), 0);
    el.textContent = 'RM' + Number(total || 0).toFixed(2);
    return total;
  }catch(e){
    console.warn('Refresh PA/BM ToyyibPay total failed:', e);
    return 0;
  }
}
async function azobssResetCurrentPurchaseTotalAfterPaid(orderId){
  const current = getSavedUser() || {};
  const key = String(current.usernameKey || current.displayName || current.username || '').trim().toLowerCase();
  if(!key) return;
  const resetAtMs = Date.now();
  const resetAtClient = new Date(resetAtMs).toISOString();
  try{
    const map = readAzobssPurchaseTotalResetMap();
    map[key] = resetAtMs;
    writeAzobssPurchaseTotalResetMap(map);
  }catch(e){ console.warn('Local payment reset failed:', e); }
  try{
    await setDoc(doc(db, 'users', key), {
      purchaseTotalResetAtMs: resetAtMs,
      purchaseTotalResetAtClient: resetAtClient,
      purchaseTotalResetBy: 'toyyibpay',
      lastPaBmPaymentOrderId: String(orderId || ''),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }catch(e){ console.warn('Firebase payment reset failed:', e); }
  const totalEl = document.getElementById('paBmToyyibTotal');
  if(totalEl) totalEl.textContent = 'RM0.00';
  try{
    const records = await loadAzobssPurchaseRecords();
    const unpaidRows = azobssPurchasePaymentRows(records, { [key]: 0 }).filter(r => !azobssIsPurchasePaidForDownload(r));
    for(const r of unpaidRows){
      if(r.firestoreId){
        try{
          await setDoc(doc(db, AZOBSS_PURCHASE_COLLECTION, r.firestoreId), {
            status: 'paid',
            paidAtMs: resetAtMs,
            paidAtClient: resetAtClient,
            paymentOrderId: String(orderId || ''),
            downloadCount: 0,
            maxDownloads: AZOBSS_PA_BM_MAX_DOWNLOADS,
            downloadExpiresAtMs: resetAtMs + AZOBSS_PA_BM_VALID_MS,
            downloadExpiresAtClient: new Date(resetAtMs + AZOBSS_PA_BM_VALID_MS).toISOString(),
            updatedAt: serverTimestamp()
          }, { merge:true });
        }catch(e){}
      }
    }
  }catch(e){ console.warn('Mark purchaseLogs paid failed:', e); }
  try{ await renderAzobssPurchaseRecords(); }catch(e){}
  try{ azobssSchedulePurchaseRecordsRefresh('payment paid'); }catch(e){}
}


function azobssShowPaBmPaymentSuccessPopup(){
  try{
    let modal = document.getElementById('azobssPaBmPaymentSuccessModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'azobssPaBmPaymentSuccessModal';
      modal.className = 'azobss-payment-success-modal';
      modal.innerHTML = `
        <div class="azobss-payment-success-backdrop" data-close="1"></div>
        <div class="azobss-payment-success-box" role="dialog" aria-modal="true" aria-labelledby="azobssPaymentSuccessTitle">
          <button type="button" class="azobss-payment-success-close" aria-label="Close">×</button>
          <div class="azobss-payment-success-icon">✅</div>
          <h3 id="azobssPaymentSuccessTitle">Pembayaran Berjaya!</h3>
          <p>Terima kasih atas pembelian anda.</p>
          <p>Sila muat turun fail anda di bahagian <strong>'Latest Purchase List'</strong>.</p>
          <button type="button" class="azobss-payment-success-go">Go to Latest Purchase List</button>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.classList.remove('show');
      modal.querySelector('.azobss-payment-success-close')?.addEventListener('click', close);
      modal.querySelector('.azobss-payment-success-backdrop')?.addEventListener('click', close);
      modal.querySelector('.azobss-payment-success-go')?.addEventListener('click', () => {
        close();
        const target = document.getElementById('userPaPurchasePanel') || document.getElementById('userPaPurchaseList');
        if(target){ target.scrollIntoView({ behavior:'smooth', block:'start' }); }
      });
    }
    modal.classList.add('show');
  }catch(e){ console.warn('Payment success popup failed:', e); }
}

async function azobssCheckPaBmToyyibReturn(){
  const status = document.getElementById('paBmToyyibStatus');
  const params = new URLSearchParams(window.location.search || '');
  const orderId = params.get('orderId') || params.get('order_id') || sessionStorage.getItem('azobss_pa_bm_pending_order_id') || '';
  const billCode = params.get('billCode') || params.get('billcode') || params.get('BillCode') || sessionStorage.getItem('azobss_pa_bm_pending_bill_code') || '';
  const paymentReturn = params.get('payment') === 'return' || !!params.get('status_id') || !!params.get('billcode') || !!params.get('billCode') || !!orderId || !!billCode;
  if(!paymentReturn) return;

  // Selepas balik dari ToyyibPay, refresh list beberapa kali kerana auth/Firestore callback kadang lambat.
  [300, 900, 1800, 3500, 6500].forEach(function(ms){
    setTimeout(function(){
      try{ startAzobssPurchaseRealtimeSync(); }catch(e){}
      try{ azobssSchedulePurchaseRecordsRefresh('toyyib return retry'); }catch(e){}
    }, ms);
  });

  if(!orderId && !billCode){
    if(status) status.textContent = 'Payment returned. Refreshing purchase list...';
    return;
  }
  const paidResetKey = orderId || billCode;
  if(sessionStorage.getItem('azobss_pa_bm_paid_reset_' + paidResetKey) === '1'){
    try{ azobssSchedulePurchaseRecordsRefresh('already verified return'); }catch(e){}
    return;
  }
  try{
    if(status) status.textContent = 'Checking payment status...';
    const verifyUrl = azobssGetBackendBaseUrl() + '/api/verify-payment?orderId=' + encodeURIComponent(orderId || '') + '&billCode=' + encodeURIComponent(billCode || '');
    const res = await fetch(verifyUrl, { cache:'no-store' });
    const data = await res.json().catch(()=>({}));
    if(data && (data.paid || data.status === 'paid' || data.status === 'success')){
      await azobssResetCurrentPurchaseTotalAfterPaid(orderId);
      sessionStorage.setItem('azobss_pa_bm_paid_reset_' + paidResetKey, '1');
      sessionStorage.removeItem('azobss_pa_bm_pending_order_id');
      sessionStorage.removeItem('azobss_pa_bm_pending_bill_code');
      if(status) status.textContent = 'Pembayaran berjaya. Senarai pembelian dikemaskini.';
      azobssShowPaBmPaymentSuccessPopup();
      [500, 1500, 3000].forEach(ms => setTimeout(() => azobssSchedulePurchaseRecordsRefresh('paid verify retry'), ms));
    }else if(status){
      status.textContent = 'Payment pending. System is syncing again...';
      setTimeout(azobssCheckPaBmToyyibReturn, 3500);
    }
  }catch(e){
    console.warn('PA/BM payment return check failed:', e);
    if(status) status.textContent = 'Unable to verify payment yet. Purchase list will refresh automatically.';
  }
}
async function azobssPayPaBmToyyib(){
  const btn = document.getElementById('payPaBmToyyibButton');
  const status = document.getElementById('paBmToyyibStatus');
  const current = getSavedUser();
  if(!current){ openSiteAuth('signin'); return; }
  const oldText = btn ? btn.textContent : '';
  try{
    if(btn){ btn.disabled = true; btn.textContent = 'Preparing payment...'; }
    if(status) status.textContent = 'Sila tunggu. Sistem sedang kira semula total...';
    const records = await loadAzobssPurchaseRecords();
    const resetMap = await loadAzobssPurchaseTotalResetMap();
    const rows = azobssPurchasePaymentRows(records, resetMap);
    const total = rows.reduce((sum,r)=>sum + (Number(r.amount)||0), 0);
    if(!rows.length || total <= 0) throw new Error('Tiada total pembelian PA/BM untuk dibayar.');
    if(status) status.textContent = 'Total RM' + total + ' dihantar ke payment gateway...';
    const payload = {
      usernameKey: String(current.usernameKey || current.displayName || current.username || '').trim().toLowerCase(),
      uid: String(current.uid || ''),
      user: current,
      items: rows.map(r => ({ id:r.firestoreId || r.id || '', productType:r.productType || 'PA', itemCode:r.itemCode || '', negeri:r.negeri || '', amount:Number(r.amount)||0, createdAtMs:Number(r.createdAtMs)||0 }))
    };
    const res = await fetch(azobssGetBackendBaseUrl() + '/api/toyyib/create-pa-bm-bill', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || !data.ok) throw new Error(data.error || 'Gagal create payment bill.');
    if(data.orderId) sessionStorage.setItem('azobss_pa_bm_pending_order_id', String(data.orderId));
    if(data.billCode) sessionStorage.setItem('azobss_pa_bm_pending_bill_code', String(data.billCode));
    if(status) status.textContent = 'Redirect to payment page...';
    window.location.href = data.paymentUrl || data.url || data.redirectUrl;
  }catch(error){
    console.error('PA/BM payment failed:', error);
    if(status) status.textContent = error.message || 'Gagal create payment bill.';
    alert(error.message || 'Gagal create payment bill.');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = oldText || 'Proceed to Payment'; }
  }
}
function bindAzobssPaBmToyyibButton(){
  const btn = document.getElementById('payPaBmToyyibButton');
  if(btn && !btn.dataset.azobssToyyibBind){
    btn.dataset.azobssToyyibBind = '1';
    btn.addEventListener('click', azobssPayPaBmToyyib);
  }
  azobssRefreshPaBmToyyibTotal();
  azobssCheckPaBmToyyibReturn();
}
window.azobssPayPaBmToyyib = azobssPayPaBmToyyib;

function filterPurchaseRows(records, keyword){
  const q = String(keyword || '').trim().toLowerCase();
  if(!q) return records.slice();
  return records.filter(r => [r.usernameKey,r.displayName,r.phone,r.email,r.productType,r.itemCode,r.negeri,formatPurchaseDate(r)].join(' ').toLowerCase().includes(q));
}

async function resetAzobssPurchaseRecordsForUser(usernameKey){
  const current = getSavedUser();
  if(!isAzobssAdmin(current)) return;
  const key = String(usernameKey || '').trim().toLowerCase();
  if(!key) return;
  if(!confirm('Reset total pembelian untuk ' + key + '?\n\nPurchase history tidak akan dipadam.')) return;

  const resetAtMs = Date.now();
  const resetAtClient = new Date(resetAtMs).toISOString();

  try{
    const map = readAzobssPurchaseTotalResetMap();
    map[key] = resetAtMs;
    writeAzobssPurchaseTotalResetMap(map);
  }catch(e){ console.warn('Local purchase total reset failed:', e); }

  try{
    await setDoc(doc(db, 'users', key), {
      purchaseTotalResetAtMs: resetAtMs,
      purchaseTotalResetAtClient: resetAtClient,
      purchaseTotalResetBy: current.usernameKey || current.displayName || 'admin',
      updatedAt: serverTimestamp()
    }, { merge: true });
  }catch(error){
    console.warn('Firestore purchase total reset failed:', error);
    alert('Reset saved locally only. Firebase update failed.');
  }

  azobssAdminPurchasePage = 1;
  await renderAzobssPurchaseRecords();
}
window.azobssResetPurchaseRecordsForUser = resetAzobssPurchaseRecordsForUser;
window.azobssTogglePurchaseDetails = toggleAzobssPurchaseDetails;

function azobssPurchaseDeletePayload(r){
  return encodeURIComponent(JSON.stringify({
    firestoreId: r.firestoreId || '',
    id: r.id || '',
    usernameKey: r.usernameKey || '',
    uid: r.uid || '',
    productType: r.productType || 'PA',
    itemCode: r.itemCode || '',
    negeri: r.negeri || '',
    amount: Number(r.amount) || 0,
    status: r.status || 'pending',
    createdAtMs: Number(r.createdAtMs) || 0,
    createdAtClient: r.createdAtClient || ''
  }));
}
function azobssPurchaseSameForDelete(a,b){
  if(!a || !b) return false;
  const aid = String(a.firestoreId || a.id || '');
  const bid = String(b.firestoreId || b.id || '');
  if(aid && bid && aid === bid) return true;
  return String(a.usernameKey || '').toLowerCase() === String(b.usernameKey || '').toLowerCase()
    && String(a.productType || '').toUpperCase() === String(b.productType || '').toUpperCase()
    && String(a.itemCode || '').toUpperCase() === String(b.itemCode || '').toUpperCase()
    && String(a.negeri || '').toUpperCase() === String(b.negeri || '').toUpperCase()
    && Number(a.createdAtMs || 0) === Number(b.createdAtMs || 0)
    && Number(a.amount || 0) === Number(b.amount || 0);
}
async function azobssDeletePurchaseRecordByPayload(rawPayload, silent){
  const current = getSavedUser();
  const isAdminUser = isAzobssAdmin(current);
  let target = null;
  try{ target = typeof rawPayload === 'string' ? JSON.parse(decodeURIComponent(rawPayload)) : rawPayload; }catch(e){ target = null; }
  if(!target) return false;
  const key = String(target.usernameKey || target.displayName || '').trim().toLowerCase();
  const currentKey = String(current?.usernameKey || current?.displayName || current?.username || '').trim().toLowerCase();
  const uidOk = current?.uid && String(target.uid || '') === String(current.uid);
  const userOwnPending = !isAdminUser
    && (uidOk || (currentKey && key && currentKey === key))
    && !['paid','cancelled','deleted'].includes(String(target.status || 'pending').trim().toLowerCase())
    && !azobssIsPurchasePaidForDownload(target);
  if(!isAdminUser && !userOwnPending){
    if(!silent) alert('Item ini tidak boleh dibuang kerana bukan pending cart anda.');
    return false;
  }
  const confirmText = isAdminUser
    ? ('Buang rekod ini?\n\n' + String(target.productType || 'PA') + ' ' + String(target.itemCode || '-') + ' · RM' + String(target.amount || ''))
    : ('Buang item ini daripada cart?\n\n' + String(target.productType || 'PA') + ' ' + String(target.itemCode || '-') + ' · RM' + String(target.amount || ''));
  if(!silent && !confirm(confirmText)) return false;

  try{
    const local = readLocalPurchaseRecords().filter(r => !azobssPurchaseSameForDelete(r, target));
    writeLocalPurchaseRecords(local.slice(0, 500));
  }catch(e){ console.warn('Local purchase delete failed:', e); }

  try{
    const directId = String(target.firestoreId || target.id || '');
    if(directId) await deleteDoc(doc(db, AZOBSS_PURCHASE_COLLECTION, directId));
  }catch(e){ console.warn('Direct purchase delete skipped:', e); }

  try{
    const snap = await getDocs(collection(db, AZOBSS_PURCHASE_COLLECTION));
    const deletions = [];
    snap.forEach(d => {
      const data = d.data() || {};
      const candidate = { id:d.id, firestoreId:d.id, ...data, createdAtMs:Number(data.createdAtMs || (data.createdAtClient ? Date.parse(data.createdAtClient) : 0) || 0) };
      if(azobssPurchaseSameForDelete(candidate, target)) deletions.push(deleteDoc(d.ref));
    });
    if(deletions.length) await Promise.allSettled(deletions);
  }catch(e){ console.warn('Purchase collection search delete skipped:', e); }

  if(key){
    try{
      const userRef = doc(db, 'users', key);
      const snap = await getDoc(userRef);
      if(snap.exists()){
        const data = snap.data() || {};
        const embedded = Array.isArray(data.purchaseRecords) ? data.purchaseRecords : [];
        const filtered = embedded.filter(r => !azobssPurchaseSameForDelete({ ...r, usernameKey:r.usernameKey || key }, target));
        if(filtered.length !== embedded.length){
          await setDoc(userRef, { purchaseRecords: filtered, purchaseRecordsUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge:true });
        }
      }
    }catch(e){ console.warn('Embedded purchase delete skipped:', e); }
  }
  if(!silent) await renderAzobssPurchaseRecords();
  return true;
}
async function azobssDeleteOnePurchaseRecord(rawPayload){
  await azobssDeletePurchaseRecordByPayload(rawPayload, false);
}
async function azobssUncartPurchaseRecord(rawPayload){
  const ok = await azobssDeletePurchaseRecordByPayload(rawPayload, false);
  if(ok){
    const status = document.getElementById('paBmToyyibStatus');
    if(status) status.textContent = 'Item telah dibuang daripada cart. Total telah dikemaskini.';
  }
}
async function azobssDeletePendingPurchaseRecordsForUser(usernameKey){
  const current = getSavedUser();
  if(!isAzobssAdmin(current)) return;
  const key = String(usernameKey || '').trim().toLowerCase();
  if(!key) return;
  const records = (await loadAzobssPurchaseRecords()).filter(r => String(r.usernameKey || r.displayName || '').trim().toLowerCase() === key);
  const resetMap = await loadAzobssPurchaseTotalResetMap();
  const pending = countablePurchaseRows(records, key, resetMap);
  if(!pending.length){ alert('Tiada rekod pending untuk ' + key + '.'); return; }
  if(!confirm('Buang semua Pending Payment untuk ' + key + '?\n\nJumlah rekod: ' + pending.length + '\nTindakan ini tidak boleh undo.')) return;
  for(const r of pending){ await azobssDeletePurchaseRecordByPayload(azobssPurchaseDeletePayload(r), true); }
  azobssAdminPurchasePage = 1;
  await renderAzobssPurchaseRecords();
}
async function azobssDeleteAllPurchaseRecordsForUser(usernameKey){
  const current = getSavedUser();
  if(!isAzobssAdmin(current)) return;
  const key = String(usernameKey || '').trim().toLowerCase();
  if(!key) return;
  const records = (await loadAzobssPurchaseRecords()).filter(r => String(r.usernameKey || r.displayName || '').trim().toLowerCase() === key);
  if(!records.length){ alert('Tiada rekod untuk ' + key + '.'); return; }
  if(!confirm('Buang SEMUA rekod purchase list untuk ' + key + '?\n\nJumlah rekod: ' + records.length + '\nTindakan ini tidak boleh undo.')) return;
  for(const r of records){ await azobssDeletePurchaseRecordByPayload(azobssPurchaseDeletePayload(r), true); }
  azobssAdminPurchasePage = 1;
  await renderAzobssPurchaseRecords();
}
window.azobssDeleteOnePurchaseRecord = azobssDeleteOnePurchaseRecord;
window.azobssUncartPurchaseRecord = azobssUncartPurchaseRecord;
window.azobssDeletePendingPurchaseRecordsForUser = azobssDeletePendingPurchaseRecordsForUser;
window.azobssDeleteAllPurchaseRecordsForUser = azobssDeleteAllPurchaseRecordsForUser;

function toggleAzobssPurchaseDetails(button){
  const card = button && button.closest('.admin-purchase-user-card');
  if(!card) return;
  const key = String(card.dataset.userKey || '').toLowerCase();
  const details = card.querySelector('.admin-purchase-user-details');
  if(!details) return;
  const opening = details.hidden || details.style.display === 'none' || !card.classList.contains('is-open');
  if(key) azobssPurchaseOpenKeys[key] = opening;
  details.hidden = !opening;
  details.style.display = opening ? 'grid' : 'none';
  card.classList.toggle('is-open', opening);
  button.textContent = opening ? 'Hide' : 'Show';
}


window.azobssSetPurchaseDetailPage = function(key, page){
  const cleanKey = String(key || '').toLowerCase();
  if(!cleanKey) return;
  azobssPurchaseDetailPages[cleanKey] = Math.max(1, Number(page) || 1);
  azobssPurchaseOpenKeys[cleanKey] = true;
  renderAzobssPurchaseRecords();
};

async function renderAzobssPurchaseRecords(){
  const list = document.getElementById('purchaseSummaryList');
  const userList = document.getElementById('userPaPurchaseList');
  if(!list && !userList) return;
  const renderSeq = (window.__AZOBSS_PABM_PURCHASE_RENDER_SEQ__ = (Number(window.__AZOBSS_PABM_PURCHASE_RENDER_SEQ__ || 0) + 1));
  const current = getSavedUser();
  const isAdminUser = isAzobssAdmin(current);
  const adminSearch = String(document.getElementById('purchaseRecordSearch')?.value || '').trim().toLowerCase();
  const adminSort = String(document.getElementById('purchaseRecordSort')?.value || 'updatedNewest');
  const userSearch = String(document.getElementById('userPaPurchaseSearch')?.value || '').trim().toLowerCase();
  const userSort = String(document.getElementById('userPaPurchaseSort')?.value || 'newest');
  let records = await loadAzobssPurchaseRecords();
  const purchaseResetMap = await loadAzobssPurchaseTotalResetMap();
  if(renderSeq !== Number(window.__AZOBSS_PABM_PURCHASE_RENDER_SEQ__ || 0)) return;

  if(isAdminUser){
    records = filterPurchaseRows(records, adminSearch);
    const groups = new Map();
    records.forEach(r => {
      const k = String(r.usernameKey || r.displayName || 'unknown').toLowerCase();
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    });
    const groupedRows = sortAdminPurchaseGroups(Array.from(groups.entries()), adminSort, purchaseResetMap);
    const totalPages = Math.max(1, Math.ceil(groupedRows.length / AZOBSS_ADMIN_PURCHASE_PAGE_SIZE));
    azobssAdminPurchasePage = clampPage(azobssAdminPurchasePage, totalPages);
    const pageRows = groupedRows.slice((azobssAdminPurchasePage - 1) * AZOBSS_ADMIN_PURCHASE_PAGE_SIZE, azobssAdminPurchasePage * AZOBSS_ADMIN_PURCHASE_PAGE_SIZE);
    if(list){
      if(!pageRows.length){
        const hasExistingGoodRows = !!list.querySelector('.admin-purchase-user-card');
        const stableRows = readStablePurchaseRecords();
        if(hasExistingGoodRows || stableRows.length){
          if(!hasExistingGoodRows && stableRows.length){
            records = stableRows;
            const stableGroups = new Map();
            filterPurchaseRows(records, adminSearch).forEach(r => {
              const k = String(r.usernameKey || r.displayName || 'unknown').toLowerCase();
              if(!stableGroups.has(k)) stableGroups.set(k, []);
              stableGroups.get(k).push(r);
            });
            const stableGroupedRows = sortAdminPurchaseGroups(Array.from(stableGroups.entries()), adminSort, purchaseResetMap);
            const stablePageRows = stableGroupedRows.slice(0, AZOBSS_ADMIN_PURCHASE_PAGE_SIZE);
            if(stablePageRows.length){ pageRows.splice(0, pageRows.length, ...stablePageRows); }
          }
          if(!pageRows.length){
            renderAzobssPager(document.getElementById('purchaseRecordsPagination'), azobssAdminPurchasePage, 0, AZOBSS_ADMIN_PURCHASE_PAGE_SIZE, page => { azobssAdminPurchasePage = page; renderAzobssPurchaseRecords(); });
            return;
          }
        }
      }
      list.innerHTML = pageRows.map(([key, rows]) => {
        rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));
        const first = rows[0] || {};
        const countableRowsForTotal = countablePurchaseRows(rows, key, purchaseResetMap);
        const total = countableRowsForTotal.reduce((sum,r)=>sum + (Number(r.amount)||0), 0);
        const unitCount = countableRowsForTotal.length;
        const lastItem = first.itemCode ? `${first.productType || 'PA'} ${first.itemCode}` : '-';
        const isDetailOpen = !!azobssPurchaseOpenKeys[key];
        return `<div class="purchase-summary-item admin-purchase-user-card az-purchase-mini-card${isDetailOpen ? ' is-open' : ''}" data-user-key="${escHtml(key)}">
          <div class="admin-purchase-user-top az-purchase-mini-top">
            <div class="az-purchase-mini-user"><strong>${escHtml(first.displayName || key)}</strong></div>
            <span class="az-purchase-mini-date">Last buy: <strong>${escHtml(formatPurchaseDate(first)||'-')}</strong></span>
            <span class="az-purchase-mini-last">Last: <strong>${escHtml(lastItem)}</strong></span>
            <span class="az-purchase-mini-unit">Unit: <strong>${unitCount}</strong></span>
            <span class="az-purchase-mini-total">Total: <strong>RM${total}</strong></span>
            <div class="az-purchase-mini-actions">
              <button type="button" class="az-purchase-show-btn" onclick="window.azobssTogglePurchaseDetails && window.azobssTogglePurchaseDetails(this)">${isDetailOpen ? 'Hide' : 'Show'}</button>
              <button type="button" class="az-purchase-pending-btn" onclick="window.azobssDeletePendingPurchaseRecordsForUser && window.azobssDeletePendingPurchaseRecordsForUser('${escHtml(key)}')">Pending</button>
              <button type="button" class="az-purchase-reset-btn" onclick="window.azobssResetPurchaseRecordsForUser && window.azobssResetPurchaseRecordsForUser('${escHtml(key)}')">Reset</button>
              <button type="button" class="az-purchase-delete-all-btn" onclick="window.azobssDeleteAllPurchaseRecordsForUser && window.azobssDeleteAllPurchaseRecordsForUser('${escHtml(key)}')">All</button>
            </div>
          </div>
          <div class="admin-purchase-user-details az-purchase-mini-details" ${isDetailOpen ? '' : 'hidden'} style="display:${isDetailOpen ? 'grid' : 'none'};">
            ${(() => {
              const detailPage = clampPage(azobssPurchaseDetailPages[key] || 1, Math.max(1, Math.ceil(rows.length / AZOBSS_PURCHASE_DETAIL_PAGE_SIZE)));
              azobssPurchaseDetailPages[key] = detailPage;
              const detailRows = rows.slice((detailPage - 1) * AZOBSS_PURCHASE_DETAIL_PAGE_SIZE, detailPage * AZOBSS_PURCHASE_DETAIL_PAGE_SIZE);
              return detailRows.map(r => `<div class="az-purchase-detail-line"><span>• ${escHtml(r.productType)} ${escHtml(r.itemCode || '-')} · ${escHtml(r.negeri || '-')} · RM${escHtml(r.amount || '')} · ${escHtml(formatPurchaseDate(r))}</span><button type="button" class="az-purchase-detail-delete-btn" onclick="window.azobssDeleteOnePurchaseRecord && window.azobssDeleteOnePurchaseRecord('${azobssPurchaseDeletePayload(r)}')">Delete</button></div>`).join('') + renderAzobssPurchaseDetailPager(key, detailPage, rows.length);
            })()}
          </div>
        </div>`;
      }).join('') || '<div class="purchase-summary-item">No purchase records yet.</div>';
    }
    list?.querySelectorAll('.az-purchase-detail-pagination button[data-page]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const holder = btn.closest('.az-purchase-detail-pagination');
        const key = holder?.dataset.purchaseDetailKey || '';
        window.azobssSetPurchaseDetailPage && window.azobssSetPurchaseDetailPage(key, Number(btn.dataset.page) || 1);
      });
    });
    renderAzobssPager(document.getElementById('purchaseRecordsPagination'), azobssAdminPurchasePage, groupedRows.length, AZOBSS_ADMIN_PURCHASE_PAGE_SIZE, page => {
      azobssAdminPurchasePage = page;
      renderAzobssPurchaseRecords();
    });
    if(userList) userList.innerHTML = '';
    const userPanelForAdmin = document.getElementById('userPaPurchasePanel');
    if(userPanelForAdmin) userPanelForAdmin.style.display = 'none';
    renderAzobssPager(document.getElementById('userPaPurchasePagination'), 1, 0, AZOBSS_PURCHASE_PAGE_SIZE, function(){});
  }else{
    const userPanelForUser = document.getElementById('userPaPurchasePanel');
    if(userPanelForUser) userPanelForUser.style.display = '';
    const topRecords = filterPurchaseRows(records, adminSearch);
    if(list){
      list.innerHTML = topRecords.length ? renderUserPurchaseSummary(topRecords, purchaseResetMap) : '<div class="purchase-summary-item">No purchase records yet.</div>';
    }
    const detailRecords = applyPurchaseSort(filterPurchaseRows(records, userSearch), userSort);
    const totalPages = Math.max(1, Math.ceil(detailRecords.length / AZOBSS_PURCHASE_PAGE_SIZE));
    azobssUserPurchasePage = clampPage(azobssUserPurchasePage, totalPages);
    const visibleRecords = detailRecords.slice((azobssUserPurchasePage - 1) * AZOBSS_PURCHASE_PAGE_SIZE, azobssUserPurchasePage * AZOBSS_PURCHASE_PAGE_SIZE);
    if(userList){ window.__azPurchaseRowIndex=(azobssUserPurchasePage - 1) * AZOBSS_PURCHASE_PAGE_SIZE;
      userList.innerHTML = visibleRecords.length ? (azobssPurchaseTableHeaderHtml() + visibleRecords.map(purchaseDetailRowHtml).join('')) : '<div class="purchase-summary-item">No PA purchase list yet.</div>';
    }
    const onUserPage = page => {
      azobssUserPurchasePage = page;
      renderAzobssPurchaseRecords();
    };
    renderAzobssPager(document.getElementById('userPaPurchasePagination'), azobssUserPurchasePage, detailRecords.length, AZOBSS_PURCHASE_PAGE_SIZE, onUserPage);
    renderAzobssPager(document.getElementById('purchaseRecordsPagination'), 1, 0, AZOBSS_PURCHASE_PAGE_SIZE, function(){});
  }
  azobssRefreshPaBmToyyibTotal(records, purchaseResetMap);
}

let azobssPurchaseRealtimeUnsubs = [];
let azobssPurchaseRealtimeKey = '';
let azobssPurchaseRenderTimer = null;
function azobssSchedulePurchaseRecordsRefresh(reason){
  try{
    clearTimeout(azobssPurchaseRenderTimer);
    azobssPurchaseRenderTimer = setTimeout(async function(){
      try{ await renderAzobssPurchaseRecords(); }catch(e){ console.warn('Purchase refresh failed:', reason, e); }
      try{ window.dispatchEvent(new Event('azobss:purchases-updated')); }catch(e){}
    }, 250);
  }catch(e){}
}
function startAzobssPurchaseRealtimeSync(){
  const current = getSavedUser() || {};
  const uid = String(current.uid || '').trim();
  const key = String(current.usernameKey || current.username || current.displayName || '').trim().toLowerCase();
  const syncKey = uid + '|' + key;
  if(!uid && !key) return;
  if(azobssPurchaseRealtimeKey === syncKey && azobssPurchaseRealtimeUnsubs.length) return;
  azobssPurchaseRealtimeUnsubs.forEach(unsub => { try{ unsub(); }catch(e){} });
  azobssPurchaseRealtimeUnsubs = [];
  azobssPurchaseRealtimeKey = syncKey;
  const purchaseCol = collection(db, AZOBSS_PURCHASE_COLLECTION);
  try{
    if(uid){
      azobssPurchaseRealtimeUnsubs.push(onSnapshot(query(purchaseCol, where('uid', '==', uid)), function(){
        azobssSchedulePurchaseRecordsRefresh('purchaseLogs uid snapshot');
      }, function(e){ console.warn('purchase uid snapshot failed:', e); }));
    }
  }catch(e){ console.warn('start uid purchase listener failed:', e); }
  try{
    if(key){
      azobssPurchaseRealtimeUnsubs.push(onSnapshot(query(purchaseCol, where('usernameKey', '==', key)), function(){
        azobssSchedulePurchaseRecordsRefresh('purchaseLogs username snapshot');
      }, function(e){ console.warn('purchase username snapshot failed:', e); }));
      azobssPurchaseRealtimeUnsubs.push(onSnapshot(doc(db, 'users', key), function(){
        azobssSchedulePurchaseRecordsRefresh('user purchase reset snapshot');
      }, function(e){ console.warn('user reset snapshot failed:', e); }));
    }
  }catch(e){ console.warn('start key purchase listener failed:', e); }
}
window.azobssRefreshPaBmPurchasesNow = function(){
  azobssSchedulePurchaseRecordsRefresh('manual');
};
function bindAzobssPurchaseRecordsUI(){
  // PA/BM page loads both azobss-global-auth.js and this live sync module.
  // Let global-auth own Purchase Records UI to prevent duplicate render races.
  if(document.querySelector('script[src*="azobss-global-auth.js"]')){
    if(!window.__AZOBSS_PABM_PURCHASE_UI_OWNER__) window.__AZOBSS_PABM_PURCHASE_UI_OWNER__ = 'global-auth';
    return;
  }
  try{ startAzobssPurchaseRealtimeSync(); }catch(e){}
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
if(!document.querySelector('script[src*="azobss-global-auth.js"]')){
  window.azobssRecordPurchase = recordAzobssPurchase;
  window.azobssLoadPurchaseRecords = loadAzobssPurchaseRecords;
  window.azobssRenderPurchaseRecords = renderAzobssPurchaseRecords;
  window.addEventListener('azobssPurchaseRecorded', renderAzobssPurchaseRecords);
  window.addEventListener('storage', renderAzobssPurchaseRecords);
}

function bindAuth() {
  addStyle(); injectModal(); injectProfileSettingsModal(); injectAdminUserEditModal(); normalizeUserMenu(); syncActiveNav(); syncHeader(getSavedUser());
  bindAzobssPurchaseRecordsUI(); bindAzobssPaBmToyyibButton(); renderFirebaseAdminRecords();

  document.addEventListener('click', async (event) => {
    if (event.target.closest('#logoutButton')) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      azobssLogoutOnce();
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
    if (event.target.closest('#siteAuthClose')) closeSiteAuth();
    if (event.target.closest('#profileSettingsClose') || event.target.closest('#profileSettingsCancelButton')) closeProfileSettings();
    if (event.target.closest('#switchToSiteSignup')) openSiteAuth('signup');
    if (event.target.closest('#switchToSiteSignin')) openSiteAuth('signin');
    const menu = event.target.closest('#userMenu, .user-menu');
    if (menu) {
      if (event.target.closest('.user-dropdown')) return;
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.user-menu.is-open').forEach(el=>{ if(el!==menu){ el.classList.remove('is-open'); el.setAttribute('aria-expanded','false'); } });
      menu.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', menu.classList.contains('is-open') ? 'true' : 'false');
    }
    else document.querySelectorAll('.user-menu.is-open').forEach(el=>{ el.classList.remove('is-open'); el.setAttribute('aria-expanded','false'); });
  }, false);

  document.addEventListener('keydown', (event)=>{
    if (event.key === 'Escape') {
      document.querySelectorAll('.user-menu.is-open').forEach(el=>{el.classList.remove('is-open'); el.setAttribute('aria-expanded','false');});
      closeSiteAuth();
      closeProfileSettings();
      if (typeof closeAdminUserEdit === 'function') closeAdminUserEdit();
    }
  });

  document.querySelectorAll('#userMenu, .user-menu').forEach((menu)=>{
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
    if(event.stopImmediatePropagation) event.stopImmediatePropagation();
    const err=$('siteLoginError'); if(err) err.textContent='';
    const submitButton = event.submitter || $('siteSignInForm')?.querySelector('button[type="submit"]') || $('siteSignInForm')?.querySelector('button');
    const loginInputRaw=String(fieldValue('siteLoginUsername','siteLoginName')).trim().toLowerCase();
    const inputIsEmail = loginInputRaw.includes('@');
    const usernameKey= inputIsEmail ? normalizeUsername(localStorage.getItem('azobssSignupUsernameByEmail:' + loginInputRaw) || loginInputRaw.split('@')[0]) : normalizeUsername(loginInputRaw);
    const password=fieldValue('siteLoginPassword');
    if(!loginInputRaw || !password){ if(err) err.textContent='Please enter username/email and password.'; return; }
    try{
      if(err){
        err.style.color='#ffd54a';
        err.textContent='⏳ Please wait... Setting up your AZOBSS account...';
      }
      if(submitButton){
        submitButton.dataset.originalText = submitButton.dataset.originalText || submitButton.textContent || 'Login';
        submitButton.disabled = true;
        submitButton.textContent = '⏳ Please wait...';
      }
      // Give the browser one frame to paint the Please wait message before Firebase starts.
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      await setPersistence(auth,browserLocalPersistence);
      const lookupEmail = inputIsEmail ? loginInputRaw : await getAuthEmailForUsername(usernameKey);
      const loginEmail = lookupEmail || buildUserEmail(usernameKey);
      let credential;
      try{
        credential = await signInWithEmailAndPassword(auth, loginEmail, password);
      }catch(primaryError){
        if(lookupEmail){
          credential = await signInWithEmailAndPassword(auth, buildUserEmail(usernameKey), password);
        }else{
          throw primaryError;
        }
      }
      try{ await credential.user.reload(); }catch(e){}
      const authUser = auth.currentUser || credential.user;
      let profile;
      try{
        profile = await ensureUserProfile(authUser,{usernameKey, email: lookupEmail || authUser.email || ''});
      }catch(profileError){
        console.warn('AZOBSS login profile recovery skipped:', profileError?.code || profileError?.message || profileError);
        profile = {uid:authUser.uid, usernameKey, username:usernameKey, email: lookupEmail || authUser.email || '', authEmail: lookupEmail || authUser.email || '', role:'member'};
      }
      const realEmail = String(profile.authEmail || profile.email || authUser.email || '').trim().toLowerCase();
      const isOwnerBypass = usernameKey === 'zedan91' || realEmail === 'zedan91@azobss.local';
      if(!authUser.emailVerified && !isOwnerBypass){
        await signOut(auth);
        clearSavedUser();
        syncHeader(null);
        if(err) err.textContent='Please verify your email first.';
        return;
      }
      if(realEmail && realEmail.includes('@')){
        try{ localStorage.setItem('azobssAuthEmailMap:' + usernameKey, realEmail); localStorage.setItem('azobssSignupUsernameByEmail:' + realEmail, usernameKey); }catch(_){}
        await saveUsernameAuthEmail(usernameKey, realEmail, authUser.uid);
      }
      let preservedPhone = normalizeAzobssPhone(profile.phone || profile.phoneNumber || '');
      try{
        const oldProfileSnap = await getDoc(doc(db,'users',usernameKey));
        const oldProfileData = oldProfileSnap.exists() ? (oldProfileSnap.data() || {}) : {};
        preservedPhone = normalizeAzobssPhone(oldProfileData.phone || oldProfileData.phoneNumber || profile.phone || profile.phoneNumber || localStorage.getItem('azobssSignupPhone:' + usernameKey) || localStorage.getItem('azobssSignupPhoneByEmail:' + (realEmail || freshUser.email || '')) || '');
        var mergedPaBmForLogin = mergePaBmAccessPreserve(oldProfileData, profile.inviteCode || profile.memberCode || profile.paMemberCode || profile.inviteCodeUsed || profile.invitedByCode || localStorage.getItem('azobssSignupInviteCode:' + usernameKey) || localStorage.getItem('azobssSignupInviteCodeByEmail:' + (realEmail || freshUser.email || '')) || '');
        await setDoc(doc(db,'users',usernameKey), {uid:authUser.uid, username:usernameKey, usernameKey, verified: !!authUser.emailVerified || isOwnerBypass, emailVerified: !!authUser.emailVerified || isOwnerBypass, verifiedAt: (!!authUser.emailVerified || isOwnerBypass) ? serverTimestamp() : null, authEmail: realEmail || authUser.email || '', email: realEmail || authUser.email || '', phone: preservedPhone, phoneNumber: preservedPhone, ...mergedPaBmForLogin}, {merge:true});
        profile = {...profile, phone: preservedPhone, phoneNumber: preservedPhone, ...mergedPaBmForLogin};
      }catch(loginProfileUpdateError){
        console.warn('AZOBSS login profile update skipped:', loginProfileUpdateError?.code || loginProfileUpdateError?.message || loginProfileUpdateError);
      }
      const signedInUser={uid:authUser.uid,...profile,phone: normalizeAzobssPhone(profile.phone || profile.phoneNumber || preservedPhone || ''),phoneNumber: normalizeAzobssPhone(profile.phone || profile.phoneNumber || preservedPhone || ''),usernameKey,authEmail:realEmail || authUser.email,verified:!!authUser.emailVerified || isOwnerBypass,emailVerified:!!authUser.emailVerified || isOwnerBypass};
      saveUser(signedInUser); syncHeader(signedInUser); startAzobssPresenceHeartbeat(signedInUser); await recordLoginHistory(signedInUser, 'login'); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); renderFirebaseAdminRecords(); migrateUsernameAuthLookupForAdmin(); closeSiteAuth();
    }catch(error){
      console.warn('AZOBSS login failed:', error?.code || error?.message || error);
      if(err) err.textContent = error?.code==='auth/invalid-credential' ? 'Wrong username/email or password. If username login fails, try your Gmail email once.' : ((error?.code || 'Login failed') + ': ' + (error?.message || 'Please try again.'));
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Login';
      }
    }
  });



  $('siteForgotPasswordButton')?.addEventListener('click', (event)=>{
    event.preventDefault();
    const box=$('siteForgotPasswordBox');
    const err=$('siteLoginError');
    if(err) err.textContent='';
    if(box) box.hidden = !box.hidden;
    setTimeout(()=>{ try{ $('siteForgotPasswordInput')?.focus(); }catch(e){} }, 50);
  });

  $('siteSendPasswordResetButton')?.addEventListener('click', async (event)=>{
    if(window.__AZOBSS_MAIN_AUTH_HANDLER_ACTIVE__) return;
    event.preventDefault();
    const err=$('siteLoginError');
    if(err){ err.style.color=''; err.textContent=''; }

    const raw=String($('siteForgotPasswordInput')?.value || fieldValue('siteLoginUsername') || '').trim().toLowerCase();
    if(window.isAzobssCaptchaVerified ? !window.isAzobssCaptchaVerified($('siteForgotPasswordBox') || $('siteSignInForm')) : !$('siteForgotPasswordCaptcha')?.checked){ if(err) err.textContent='Please confirm you are not a robot.'; return; }
    if(!raw){ if(err) err.textContent='Please enter your username or registered email.'; return; }

    try{
      let resetEmail = raw;
      if(!raw.includes('@')){
        const usernameKey = normalizeUsername(raw);
        if(!usernameKey){ if(err) err.textContent='Please enter a valid username or registered email.'; return; }
        resetEmail = await getAuthEmailForUsername(usernameKey);
        if(!resetEmail){
          if(err) err.textContent='No email is linked to this username yet. Please enter your registered email, or login once so the system can sync your email.';
          return;
        }
      }

      await sendPasswordResetEmail(auth, resetEmail);
      if(err){ err.style.color='#62e6a5'; err.textContent='Password reset link sent to '+resetEmail+'. Please check inbox/spam folder.'; }
    }catch(error){
      if(err){
        err.style.color='';
        err.textContent = error?.code==='auth/user-not-found'
          ? 'This email is not found in Firebase Authentication. Try your registered email or contact admin.'
          : 'Unable to send reset email: '+(error?.message || 'Please try again or contact admin.');
      }
    }
  });

  $('siteSignUpForm')?.addEventListener('submit', async (event)=>{
    if(window.__AZOBSS_MAIN_AUTH_HANDLER_ACTIVE__) return;
    event.preventDefault();
    const err=$('siteSignupError'); if(err) err.textContent='';
    const usernameKey=normalizeUsername(fieldValue('siteSignupUsername','siteSignupName'));
    const password=fieldValue('siteSignupPassword');
    const phone=getSignupPhoneWithDial();
    const email=String(fieldValue('siteSignupEmail')).trim().toLowerCase();
    const invitedByCode=getSignupInviteCodeValue();
    if(window.isAzobssCaptchaVerified ? !window.isAzobssCaptchaVerified($('siteSignUpForm')) : !$('siteSignupCaptcha')?.checked){ if(err) err.textContent='Please confirm you are not a robot.'; return; }
    if(!usernameKey || password.length<8 || !phone || !email){ if(err) err.textContent='Please complete all required fields. Password minimum 8 characters.'; return; }
    if(window.__AZOBSS_SIGNUP_BUSY__) return;
    window.__AZOBSS_SIGNUP_BUSY__ = true;
    const submitButton = event.submitter || $('siteSignUpForm')?.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;
    try{
      if(err){
        err.style.color='#ffd54a';
        err.textContent='⏳ Please wait... Setting up your AZOBSS account...';
      }
      if(submitButton){
        submitButton.dataset.originalText = submitButton.dataset.originalText || submitButton.textContent || 'Create Account';
        submitButton.textContent = '⏳ Please wait...';
      }
      // Give the browser one frame to paint the Please wait message before Firebase starts.
      await new Promise(resolve => requestAnimationFrame(() => resolve()));
      await setPersistence(auth,browserLocalPersistence);

      // IMPORTANT FIX:
      // Some Firestore rules block public reads on /users before login.
      // The previous build treated that permission error as a full signup failure.
      // We now try the safe username lookup first, and ignore blocked pre-check reads.
      const existingAuthEmail = await getAuthEmailForUsername(usernameKey);
      if(existingAuthEmail){
        if(err) err.textContent='Username already exists. Please choose another username.';
        return;
      }
      try{
        const existingUsername = await getDoc(doc(db,'users',usernameKey));
        if(existingUsername.exists()){
          if(err) err.textContent='Username already exists. Please choose another username.';
          return;
        }
      }catch(precheckError){
        console.warn('AZOBSS username pre-check skipped:', precheckError?.code || precheckError?.message || precheckError);
      }

      const credential=await createUserWithEmailAndPassword(auth,email,password);
      const newUser = credential.user;
      try{
        localStorage.setItem('azobssAuthEmailMap:' + usernameKey, email);
        localStorage.setItem('azobssSignupUsernameByEmail:' + email, usernameKey);
      }catch(_){}

      // IMPORTANT FIX:
      // Auth account can appear in Firebase before Firestore accepts /users/{username}.
      // Wait for auth state + refresh token, then retry profile writes a few times.
      // Verification email is sent only after profile documents are saved successfully.
      const wait = (ms)=>new Promise(resolve=>setTimeout(resolve,ms));
      try{ await newUser.getIdToken(true); await newUser.reload(); }catch(tokenError){ console.warn('AZOBSS token refresh after signup skipped:', tokenError?.code || tokenError?.message || tokenError); }
      await wait(1200);
      if(auth.currentUser?.uid !== newUser.uid){
        await new Promise(resolve=>{
          const off = onAuthStateChanged(auth, u=>{
            if(u?.uid === newUser.uid){ off(); resolve(); }
          });
          setTimeout(()=>{ try{ off(); }catch(_){} resolve(); }, 2500);
        });
      }
      try{ await auth.currentUser?.getIdToken(true); }catch(_){}

      const finalSignupInviteCode = normalizePaMemberCode(getSignupInviteCodeValue() || invitedByCode || '');
      const finalSignupPhone = normalizeAzobssPhone(getSignupPhoneWithDial() || phone || '');
      try{
        localStorage.setItem('azobssSignupPhone:' + usernameKey, finalSignupPhone || '');
        localStorage.setItem('azobssSignupInviteCode:' + usernameKey, finalSignupInviteCode || '');
        localStorage.setItem('azobssSignupPhoneByEmail:' + email, finalSignupPhone || '');
        localStorage.setItem('azobssSignupInviteCodeByEmail:' + email, finalSignupInviteCode || '');
      }catch(_){}
      const paBmSignupPayload = getPaBmPayloadFromCode(finalSignupInviteCode);
      const profile={
        uid:newUser.uid,
        username:usernameKey,
        usernameKey,
        email,
        authEmail:email,
        contactEmail:email,
        phone: finalSignupPhone,
        phoneNumber: finalSignupPhone,
        ...paBmSignupPayload,
        role:'member',
        verified:false,
        emailVerified:false,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      };

      async function writeSignupProfileWithRetry(){
        let lastError=null;
        for(let attempt=1; attempt<=4; attempt++){
          try{
            await setDoc(doc(db,'users',usernameKey),profile,{merge:true});
            await saveUsernameAuthEmail(usernameKey, email, newUser.uid);
            return;
          }catch(profileError){
            lastError=profileError;
            console.warn('AZOBSS signup profile write retry '+attempt+' failed:', profileError?.code || profileError?.message || profileError);
            try{ await newUser.getIdToken(true); }catch(_){}
            await wait(700 * attempt);
          }
        }
        throw lastError;
      }

      let verificationEmailSent = false;
      try{
        // Send verification first and never auto-delete the Auth account.
        // Previous build deleted the Auth user when Firestore was slow/blocked,
        // causing the user to disappear after ~30 seconds and no Gmail verification.
        if(err){err.style.color='#87ceeb'; err.textContent='📧 Sending verification email...';}
        await sendEmailVerification(newUser, {
          url: location.origin + '/?azobssVerified=1',
          handleCodeInApp: false
        });
        verificationEmailSent = true;
      }catch(verifyError){
        console.warn('AZOBSS verification email send failed:', verifyError?.code || verifyError?.message || verifyError);
      }

      let profileSaved = true;
      try{
        await writeSignupProfileWithRetry();
      }catch(profileError){
        profileSaved = false;
        console.error('AZOBSS signup profile create failed after retries. Auth user is kept; verification email already sent if allowed:', profileError);
        // IMPORTANT: do NOT deleteUser(newUser) here. Keep Auth user for recovery/reset.
        // Continue the flow so the user can verify email and login with Gmail/password.
        // Username lookup will work after Firestore rules are published or after login recovery saves the profile.
      }
      try{ localStorage.removeItem('azobssPaMemberCode'); sessionStorage.removeItem('azobssPaMemberCode'); }catch(_){}
      try{ await saveUsernameAuthEmail(usernameKey, email, newUser.uid); }catch(mapError){ console.warn('AZOBSS username email map save skipped:', mapError?.code || mapError?.message || mapError); }
      await signOut(auth);
      clearSavedUser();
      syncHeader(null);
      if(err){
        err.style.color='#62e6a5';
        err.textContent = '✅ Account created! Please check your Gmail and verify your account before login.';
      }
      if(submitButton){
        submitButton.textContent = submitButton.dataset.originalText || 'Create Account';
      }
      try{ $('siteSignUpForm')?.reset(); }catch(_){}
      // STOP here after signup success. Do not auto-switch/open the login section.
      return;
    }catch(error){
      console.error('AZOBSS signup error:', error);
      if(err){
        err.style.color='';
        const code = String(error?.code || '');
        if(code === 'auth/email-already-in-use') err.textContent = 'This email is already registered. Please use Sign in or Forgot Password.';
        else if(code === 'auth/invalid-email') err.textContent = 'Invalid email address. Please check your email.';
        else if(code === 'auth/weak-password') err.textContent = 'Password is too weak. Use at least 8 characters with uppercase, lowercase and number.';
        else if(code === 'permission-denied') err.textContent = 'Firebase permission blocked one step. Publish the included Firestore rules, then login with your Gmail email first.';
        else if(String(error?.message || '').toLowerCase().includes('permission')) err.textContent = 'Firebase permission blocked one step. Publish the included Firestore rules, then login with your Gmail email first.';
        else err.textContent = 'Sign up failed: ' + (error?.message || 'Please try again.');
      }
    }finally{
      window.__AZOBSS_SIGNUP_BUSY__ = false;
      if(submitButton){
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Create Account';
      }
    }
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
    if(newPassword.length < 8){ if(err) err.textContent='New password must be at least 8 characters.'; return; }
    if(newPassword !== confirmPassword){ if(err) err.textContent='Confirm password does not match.'; return; }
    try{
      const credential=EmailAuthProvider.credential(auth.currentUser.email || buildUserEmail(usernameKey), currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      ['profileCurrentPassword','profileNewPassword','profileConfirmPassword'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
      if(err){ err.style.color='#62e6a5'; err.textContent='Password updated successfully.'; setTimeout(()=>{ if(err.textContent==='Password updated successfully.'){ err.textContent=''; err.style.color=''; } }, 3500); }
    }catch(error){
      if(err){ err.style.color=''; err.textContent = error?.code==='auth/wrong-password' || error?.code==='auth/invalid-credential' ? 'Current password is wrong.' : 'Password reset failed. Please login again and try.'; }
    }
  });

  $('adminUserEditClose')?.addEventListener('click', closeAdminUserEdit);
  $('adminUserEditCancel')?.addEventListener('click', closeAdminUserEdit);
  // AZOBSS FIX: keep Edit Registered User modal open when clicking/dragging outside. Close only X/Cancel/ESC.
  $('adminUserEditForm')?.addEventListener('submit', async (event)=>{ event.preventDefault(); await saveAdminUserEdit(); });

  $('profileSettingsForm')?.addEventListener('submit', async (event)=>{
    event.preventDefault();
    const current=getSavedUser() || {};
    const editedProfilePhone = getPhoneWithDial('profileEdit');
    const finalProfilePhone = mergePhonePreserve(current.phone || current.phoneNumber || '', editedProfilePhone);
    const updated={...current,
      usernameKey: normalizeUsername($('profileEditName')?.value) || current.usernameKey || current.name || '',
      phone: finalProfilePhone,
      phoneNumber: finalProfilePhone,
      email: String($('profileEditEmail')?.value||'').trim().toLowerCase()
    };
    saveUser(updated); await saveProfileToFirebase(updated); startAzobssPresenceHeartbeat(updated); syncHeader(updated); renderFirebaseAdminRecords(); closeProfileSettings();
  });

  onAuthStateChanged(auth, async (firebaseUser)=>{
    if(!firebaseUser){
      if(window.__AZOBSS_LOGGING_OUT__ || azobssLogoutInProgress) return;
      if(azobssPresenceHeartbeatTimer){ clearInterval(azobssPresenceHeartbeatTimer); azobssPresenceHeartbeatTimer = null; }
      clearUser(); syncHeader(null); enforcePaBmPageAccess(null, true); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); setTimeout(renderAzobssPurchaseRecords, 800); recordGuestHistory(); renderFirebaseAdminRecords(); return;
    }
    try{
      try{ await firebaseUser.reload(); }catch(e){}
      const freshUser = auth.currentUser || firebaseUser;
      const ownerBypass = String(freshUser.email || '').toLowerCase() === 'zedan91@azobss.local';
      if(!freshUser.emailVerified && !ownerBypass){
        await signOut(auth);
        clearUser();
        syncHeader(null);
        enforcePaBmPageAccess(null, true);
        return;
      }
      let profile=await ensureUserProfile(freshUser);
      const realEmail = String(profile.authEmail || profile.email || freshUser.email || '').trim().toLowerCase();
      const usernameKey = normalizeUsername(profile.usernameKey || profile.username || profile.name || profile.id || '');
      let preservedPhone = normalizeAzobssPhone(profile.phone || profile.phoneNumber || '');
      try{
        if(usernameKey && !profile._profileMissing){
          const oldProfileSnap = await getDoc(doc(db,'users',usernameKey));
          const oldProfileData = oldProfileSnap.exists() ? (oldProfileSnap.data() || {}) : {};
          preservedPhone = normalizeAzobssPhone(oldProfileData.phone || oldProfileData.phoneNumber || profile.phone || profile.phoneNumber || localStorage.getItem('azobssSignupPhone:' + usernameKey) || localStorage.getItem('azobssSignupPhoneByEmail:' + (realEmail || freshUser.email || '')) || '');
          var mergedPaBmForState = mergePaBmAccessPreserve(oldProfileData, profile.inviteCode || profile.memberCode || profile.paMemberCode || profile.inviteCodeUsed || profile.invitedByCode || localStorage.getItem('azobssSignupInviteCode:' + usernameKey) || localStorage.getItem('azobssSignupInviteCodeByEmail:' + (realEmail || freshUser.email || '')) || '');
          await setDoc(doc(db,'users',usernameKey), {uid:freshUser.uid, username:usernameKey, usernameKey, verified: !!freshUser.emailVerified || ownerBypass, emailVerified: !!freshUser.emailVerified || ownerBypass, verifiedAt: (!!freshUser.emailVerified || ownerBypass) ? serverTimestamp() : null, authEmail: realEmail || freshUser.email || '', email: realEmail || freshUser.email || '', phone: preservedPhone, phoneNumber: preservedPhone, ...mergedPaBmForState}, {merge:true});
          profile = {...profile, phone: preservedPhone, phoneNumber: preservedPhone, ...mergedPaBmForState};
        }
      }catch(stateProfileUpdateError){
        console.warn('AZOBSS auth-state profile update skipped:', stateProfileUpdateError?.code || stateProfileUpdateError?.message || stateProfileUpdateError);
      }
      const fullUser={uid:freshUser.uid,...profile,authEmail: realEmail || freshUser.email || '',email: realEmail || freshUser.email || '',phone: normalizeAzobssPhone(profile.phone || profile.phoneNumber || preservedPhone || ''),phoneNumber: normalizeAzobssPhone(profile.phone || profile.phoneNumber || preservedPhone || ''),usernameKey,verified:!!freshUser.emailVerified || ownerBypass,emailVerified:!!freshUser.emailVerified || ownerBypass};
      saveUser(fullUser); syncHeader(fullUser); enforcePaBmPageAccess(fullUser, true); startAzobssPresenceHeartbeat(fullUser); await recordLoginHistory(fullUser, 'login'); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); setTimeout(renderAzobssPurchaseRecords, 800); renderFirebaseAdminRecords();
    }
    catch{ const fallback=getSavedUser(); syncHeader(fallback); enforcePaBmPageAccess(fallback, true); bindAzobssPurchaseRecordsUI(); renderAzobssPurchaseRecords(); }
  });

  const params = new URLSearchParams(location.search || '');
  if(params.get('azobssVerified') === '1') {
    try{ sessionStorage.setItem('azobssAccessDeniedMessage','Email verified successfully. Please login.'); }catch(e){}
    history.replaceState(null,'',location.pathname + '#login');
    setTimeout(()=>openSiteAuth('signin'), 80);
  }
  const hash = String(location.hash || '').toLowerCase();
  if (['#login','#signin'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signin'); }
  if (['#signup','#register'].includes(hash)) { history.replaceState(null,'',location.pathname+location.search); openSiteAuth('signup'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAuth);
else bindAuth();


// AZOBSS_FINAL_MOBILE_DROPDOWN_FIX_JS
(function injectAzobssFinalMobileDropdownFix(){
  try{
    var css = '\n/* AZOBSS FINAL MOBILE ACCOUNT DROPDOWN FIX */\n.market-sticky-bar,\n.market-bar-inner,\n.market-main-row,\n.market-user-tools,\n.user-menu{\n  overflow:visible !important;\n}\n.user-menu{\n  position:relative !important;\n  z-index:100000 !important;\n}\n.user-menu .user-dropdown,\n#userDropdown{\n  position:absolute !important;\n  top:calc(100% + 10px) !important;\n  right:0 !important;\n  left:auto !important;\n  width:220px !important;\n  min-width:220px !important;\n  max-width:calc(100vw - 16px) !important;\n  padding:8px !important;\n  border-radius:14px !important;\n  background:#08111f !important;\n  border:1px solid rgba(148,163,184,.28) !important;\n  box-shadow:0 18px 50px rgba(0,0,0,.58) !important;\n  z-index:100001 !important;\n  transform:none !important;\n}\n.user-menu:not(.is-open) .user-dropdown{display:none !important;}\n.user-menu.is-open .user-dropdown{display:block !important;}\n.user-dropdown-section{\n  padding:7px 10px 4px !important;\n  font-size:11px !important;\n  line-height:1.1 !important;\n}\n.user-dropdown-item{\n  min-height:38px !important;\n  padding:9px 10px !important;\n  font-size:13px !important;\n  line-height:1.15 !important;\n  border-radius:10px !important;\n}\n@media (max-width:768px){\n  .user-menu .user-dropdown,\n  #userDropdown{\n    position:fixed !important;\n    top:92px !important;\n    right:8px !important;\n    left:auto !important;\n    width:210px !important;\n    min-width:210px !important;\n    max-width:calc(100vw - 16px) !important;\n    max-height:68vh !important;\n    overflow-y:auto !important;\n    border-radius:14px !important;\n  }\n  .user-dropdown-section{\n    padding:7px 10px 4px !important;\n    font-size:10.5px !important;\n  }\n  .user-dropdown-item{\n    padding:9px 10px !important;\n    font-size:13px !important;\n    min-height:36px !important;\n  }\n}\n@media (max-width:420px){\n  .user-menu .user-dropdown,\n  #userDropdown{\n    top:88px !important;\n    right:6px !important;\n    width:196px !important;\n    min-width:196px !important;\n  }\n}\n';
    function apply(){
      if(document.getElementById('azobss-final-mobile-dropdown-fix-js')) return;
      var style=document.createElement('style');
      style.id='azobss-final-mobile-dropdown-fix-js';
      style.textContent=css;
      document.head.appendChild(style);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
  }catch(e){}
})();


// AZOBSS_HOME_STICKBAR_1TO1_GLOBAL_FIX
(function injectAzobssHomeStickbarOneToOne(){
  try{
    var css = `
/* AZOBSS HOME STICKBAR 1:1 GLOBAL FIX - source: Home navbar */
html,body{overflow-x:hidden!important;}
body{padding-top:58px!important;}
.market-sticky-bar{
  position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;
  min-height:49px!important;height:auto!important;z-index:5000!important;
  background:#050807!important;border-bottom:1px solid rgba(234,179,8,.55)!important;
  overflow:visible!important;box-sizing:border-box!important;
  box-shadow:0 10px 24px rgba(0,0,0,.28)!important;
}
.market-bar-inner{width:100%!important;max-width:none!important;margin:0!important;padding:0 8px!important;box-sizing:border-box!important;}
.market-main-row{
  display:flex!important;align-items:center!important;gap:7px!important;min-height:48px!important;height:48px!important;
  flex-wrap:nowrap!important;overflow:visible!important;width:100%!important;box-sizing:border-box!important;
}
.market-brand{
  flex:0 0 auto!important;width:154px!important;min-width:154px!important;max-width:154px!important;height:38px!important;
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  padding:0!important;border-radius:999px!important;overflow:hidden!important;text-decoration:none!important;
  background:transparent!important;border:0!important;margin:0!important;box-sizing:border-box!important;
}
.market-brand img{width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;display:block!important;margin:0!important;padding:0!important;}
.market-nav{
  flex:1 1 auto!important;min-width:0!important;display:flex!important;align-items:center!important;gap:7px!important;
  white-space:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important;
  -webkit-overflow-scrolling:touch!important;padding:0 2px!important;
}
.market-nav::-webkit-scrollbar{display:none!important;}
.market-nav a,.market-nav button{
  flex:0 0 auto!important;height:34px!important;min-height:34px!important;max-height:34px!important;
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  padding:0 12px!important;border-radius:999px!important;box-sizing:border-box!important;
  font-size:13px!important;font-weight:900!important;line-height:1!important;text-decoration:none!important;white-space:nowrap!important;
  background:#0e1729!important;border:1px solid rgba(148,163,184,.28)!important;color:#e5e7eb!important;text-shadow:0 1px 8px rgba(0,0,0,.45)!important;
}
.market-nav a:hover,.market-icon-btn:hover{color:#14b8a6!important;}
.market-nav .nav-pa-bm-link[hidden],.market-nav .nav-pa-bm-link.is-hidden,a#paBmNavButton[hidden],a#paBmNavButton.is-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important;}
.market-nav a:has(.nav-whatsapp-circle){width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;text-shadow:none!important;}
.nav-whatsapp-circle{position:relative!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:#22c55e!important;color:#fff!important;font-size:0!important;box-shadow:0 8px 20px rgba(34,197,94,.25)!important;overflow:visible!important;}
.nav-whatsapp-circle::before{content:""!important;display:block!important;width:18px!important;height:14px!important;border-radius:999px!important;background:#fff!important;line-height:1!important;}
.nav-whatsapp-circle::after{content:""!important;position:absolute!important;left:21px!important;top:23px!important;width:7px!important;height:7px!important;background:#fff!important;clip-path:polygon(0 0,100% 0,0 100%)!important;transform:rotate(-12deg)!important;}
.site-auth-actions{position:static!important;display:flex!important;align-items:center!important;gap:8px!important;margin-left:auto!important;margin-right:0!important;flex:0 0 auto!important;z-index:auto!important;}
.site-auth-btn{height:34px!important;min-height:34px!important;padding:0 12px!important;font-size:13px!important;font-weight:900!important;line-height:1!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;}
.market-user-tools{
  flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:11px!important;margin-left:auto!important;
  min-width:max-content!important;white-space:nowrap!important;overflow:visible!important;color:#fff!important;
}
.user-menu{height:34px!important;display:inline-flex!important;align-items:center!important;gap:7px!important;flex:0 0 auto!important;white-space:nowrap!important;position:relative!important;top:auto!important;right:auto!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;z-index:100000!important;transform:none!important;cursor:pointer!important;}
.user-avatar{width:28px!important;height:28px!important;min-width:28px!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:#020617!important;border:1px solid rgba(20,184,166,.38)!important;color:#d1d5db!important;font-size:12px!important;font-weight:900!important;line-height:1!important;}
.user-name{font-size:14px!important;font-weight:900!important;line-height:1!important;color:#fff!important;white-space:nowrap!important;max-width:140px!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.user-menu::after{content:""!important;width:7px!important;height:7px!important;border-right:2px solid currentColor!important;border-bottom:2px solid currentColor!important;color:#9ca3af!important;transform:rotate(45deg)!important;transition:transform .18s ease!important;}
.user-menu.is-open::after{transform:rotate(225deg)!important;}
.market-icon-btn{width:24px!important;height:34px!important;min-width:24px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;flex:0 0 auto!important;color:#e5e7eb!important;background:transparent!important;border:0!important;margin:0!important;text-decoration:none!important;border-radius:999px!important;}
.market-icon-btn svg{width:23px!important;height:23px!important;stroke:currentColor!important;fill:none!important;stroke-width:2.2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.market-icon-btn svg path{stroke:currentColor!important;fill:none!important;}
.market-icon-btn.is-likes-active svg path{fill:#facc15!important;stroke:#facc15!important;}

@media(max-width:980px){
  body{padding-top:92px!important;}
  .market-main-row{height:auto!important;min-height:48px!important;flex-wrap:wrap!important;align-content:center!important;padding:5px 0!important;}
  .market-brand{width:132px!important;min-width:132px!important;max-width:132px!important;height:34px!important;}
  .market-user-tools{margin-left:auto!important;gap:9px!important;}
  .user-name{max-width:115px!important;font-size:13px!important;}
  .market-nav{order:3!important;flex:0 0 100%!important;width:100%!important;padding:4px 0 2px!important;}
  .market-nav a,.market-nav button{height:32px!important;min-height:32px!important;padding:0 10px!important;font-size:12px!important;}
  .market-nav a:has(.nav-whatsapp-circle){width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;}
  .nav-whatsapp-circle{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;}
}
@media(max-width:560px){
  body{padding-top:96px!important;}
  .market-bar-inner{padding:0 6px!important;}
  .market-brand{width:120px!important;min-width:120px!important;max-width:120px!important;height:32px!important;}
  .market-user-tools{gap:7px!important;}
  .user-name{display:none!important;}
  .market-icon-btn{width:22px!important;min-width:22px!important;}
  .market-icon-btn svg{width:21px!important;height:21px!important;}
  .site-auth-btn{font-size:12px!important;padding:0 9px!important;}
}
`;
    function apply(){
      if(document.getElementById('azobss-home-stickbar-1to1-global-fix')) return;
      var style=document.createElement('style');
      style.id='azobss-home-stickbar-1to1-global-fix';
      style.textContent=css;
      document.head.appendChild(style);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
  }catch(e){}
})();


// AZOBSS compact one-line admin live/history rows
(function injectAzobssCompactAdminHistoryRows(){
  try{
    if(document.getElementById('azobss-compact-admin-history-style')) return;
    const style=document.createElement('style');
    style.id='azobss-compact-admin-history-style';
    style.textContent=`
      #liveUsersList .az-admin-inline-card,
      #loginHistoryList .az-admin-inline-card,
      #guestHistoryList .az-admin-inline-card{
        display:block!important;
        padding:4px 8px!important;
        min-height:0!important;
        border-radius:9px!important;
        margin:0 0 5px!important;
      }
      .az-admin-inline-row{
        display:flex!important;
        align-items:center!important;
        gap:7px!important;
        flex-wrap:wrap!important;
        width:100%!important;
        font-size:11px!important;
        line-height:1.15!important;
      }
      .az-admin-inline-row strong{
        color:#f8fafc!important;
        font-size:11.5px!important;
        margin-right:2px!important;
        line-height:1.15!important;
      }
      .az-admin-inline-row span{
        color:#b9c5d8!important;
        white-space:nowrap!important;
        line-height:1.15!important;
      }
      .az-status-online{color:#4ade80!important;font-weight:900!important;}
      #liveUsersList .admin-purchase-user-top,
      #loginHistoryList .admin-purchase-user-top,
      #guestHistoryList .admin-purchase-user-top,
      #liveUsersList .admin-purchase-user-details,
      #loginHistoryList .admin-purchase-user-details,
      #guestHistoryList .admin-purchase-user-details{display:none!important;}
      @media(max-width:640px){
        .az-admin-inline-row{gap:5px!important;font-size:10px!important;}
        .az-admin-inline-row strong{font-size:10.5px!important;}
      }
    `;
    document.head.appendChild(style);
  }catch(_e){}
})();


// auto-init country selectors for dynamic admin modal
setupCountryPhoneSelectors(document);
new MutationObserver(()=>setupCountryPhoneSelectors(document)).observe(document.body,{childList:true,subtree:true});

setTimeout(()=>{azobssCleanupCollection("loginHistory");azobssCleanupCollection("guestHistory");azobssCleanupCollection("purchaseLogs");},5000);




/* AZOBSS phone local display helper disabled here.
   The single active formatter is bindAzobssPhoneDisplayFormatter() near the top of this file.
   This prevents Backspace from getting stuck on dash/space separators. */
window.azobssFormatLocalPhoneForDisplay = function(value){
  return formatPhoneGuide(value);
};

/* AZOBSS ULTRA-STABLE USER MENU CLICK FIX
   Fixes Hello, username dropdown toggle + dropdown actions after signup/auth patches. */
(function azobssUltraStableUserMenuFix(){
  if (window.__azobssUltraStableUserMenuFixInstalled) return;
  window.__azobssUltraStableUserMenuFixInstalled = true;

  function closeMenus(except){
    document.querySelectorAll('#userMenu, .user-menu').forEach(function(menu){
      if (except && menu === except) return;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-expanded','false');
    });
  }

  function openSettings(){
    try {
      if (typeof openProfileSettings === 'function') return openProfileSettings();
      if (typeof window.openProfileSettings === 'function') return window.openProfileSettings();
      var btn = document.querySelector('[data-open-profile-settings], #profileSettingsOpenButton, #settingsButton');
      if (btn) btn.click();
    } catch(_e) {}
  }

  function logout(){
    try {
      if (typeof azobssLogoutOnce === 'function') return azobssLogoutOnce();
      if (typeof window.azobssLogoutUser === 'function') return window.azobssLogoutUser();
      var old = document.querySelector('[data-auth-logout], #siteLogoutButton');
      if (old) return old.click();
    } catch(_e) {}
  }

  document.addEventListener('click', function(event){
    var dropdownItem = event.target.closest('#userDropdown .user-dropdown-item, .user-dropdown .user-dropdown-item');
    if (dropdownItem) {
      var menuForItem = dropdownItem.closest('#userMenu, .user-menu');
      event.stopPropagation();
      if (dropdownItem.id === 'profileSettingsButton' || /settings/i.test(dropdownItem.textContent || '')) {
        event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        closeMenus();
        openSettings();
        return;
      }
      if (dropdownItem.id === 'logoutButton' || /log\s*out/i.test(dropdownItem.textContent || '')) {
        event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        closeMenus();
        logout();
        return;
      }
      closeMenus();
      return;
    }

    var menu = event.target.closest('#userMenu, .user-menu');
    if (menu) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var willOpen = !menu.classList.contains('is-open');
      closeMenus(menu);
      menu.classList.toggle('is-open', willOpen);
      menu.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    closeMenus();
  }, true);

  document.addEventListener('keydown', function(event){
    var menu = event.target.closest && event.target.closest('#userMenu, .user-menu');
    if (menu && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      var willOpen = !menu.classList.contains('is-open');
      closeMenus(menu);
      menu.classList.toggle('is-open', willOpen);
      menu.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }
    if (event.key === 'Escape') closeMenus();
  }, true);
})();

/* AZOBSS low-quota item likes buttons (restored)
   - Injects bookmark buttons into Affiliate / Software / CAD item cards.
   - Uses one Firestore path only: users/{usernameKey}/likes/{itemId}
   - Reads once, writes only when user toggles a like. No live listener. */
(function(){
  const STYLE_ID = 'azobss-low-quota-like-style';
  const CACHE_PREFIX = 'azobss_low_quota_likes:';
  const PAGE_MAP = {
    '/affiliate-shop': 'Affiliate Shop',
    '/software-tools': 'Software Tools',
    '/cad-tools-&-resources': 'CAD Tools & Resources',
    '/cad-tools-and-resources': 'CAD Tools & Resources'
  };
  const state = { loadedFor: '', ids: new Set(), busy: new Set(), loading: null };
  const likesPageState = { usernameKey: '', rows: [], lastDoc: null, hasMore: false, loading: false, pageSize: 20 };

  function addLikeStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .az-item-like-btn{position:absolute!important;top:14px!important;right:14px!important;z-index:20!important;width:38px!important;height:38px!important;border-radius:999px!important;border:1px solid rgba(14,165,233,.42)!important;background:rgba(5,10,22,.78)!important;color:#e0f2fe!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:20px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important;box-shadow:0 10px 26px rgba(0,0,0,.32)!important;backdrop-filter:blur(8px)!important;transition:transform .18s ease, background .18s ease, border-color .18s ease!important;}
      .az-item-like-btn:hover{transform:scale(1.07)!important;border-color:#38bdf8!important;background:rgba(14,165,233,.14)!important;}
      .az-item-like-btn.is-liked{background:rgba(250,204,21,.18)!important;border-color:#facc15!important;color:#facc15!important;text-shadow:0 0 14px rgba(250,204,21,.42)!important;}
      .az-item-like-btn[disabled]{opacity:.62!important;cursor:wait!important;transform:none!important;}
      .az-item-like-btn .az-bookmark-icon{width:20px!important;height:20px!important;display:block!important;pointer-events:none!important;}
      .az-item-like-btn .az-bookmark-icon path{fill:none!important;stroke:currentColor!important;stroke-width:2.15!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
      .az-item-like-btn.is-liked .az-bookmark-icon path{fill:currentColor!important;stroke:currentColor!important;}
      .card,.download-card,.cad-card{position:relative!important;}
      .az-has-like-btn.card .top{padding-right:54px!important;}
      .az-has-like-btn.card .badge{max-width:calc(100% - 62px)!important;white-space:normal!important;text-align:center!important;overflow-wrap:anywhere!important;}
      .az-has-like-btn.card h2{padding-right:8px!important;}
      .az-has-like-btn.download-card h2,.az-has-like-btn.download-card h3,.az-has-like-btn.cad-card h2,.az-has-like-btn.cad-card h3{padding-right:54px!important;}
      .az-like-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;border:1px solid rgba(34,197,94,.22);border-radius:14px;background:rgba(15,23,42,.7);padding:14px;color:#fff;cursor:pointer;}
      .az-like-card-main{min-width:0;}
      .az-like-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
      .az-bookmark-add-cart-btn{border:1px solid rgba(34,197,94,.55);border-radius:999px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#052e16;font-weight:950;padding:9px 16px;cursor:pointer;box-shadow:0 8px 18px rgba(34,197,94,.20);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .az-bookmark-add-cart-btn:hover{filter:brightness(1.07);transform:translateY(-1px);}
      .az-bookmark-add-cart-btn:disabled{opacity:.62;cursor:not-allowed;transform:none;}
      .az-like-card-title{font-weight:950;color:#fff;font-size:16px;display:flex;align-items:center;gap:8px;min-width:0;}
      .az-like-page-bookmark-icon{width:20px!important;height:20px!important;flex:0 0 20px!important;color:#facc15!important;display:inline-block!important;}
      .az-like-page-bookmark-icon path{fill:currentColor!important;stroke:currentColor!important;stroke-width:2.15!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
      .az-like-card-meta{font-size:12px;color:#93c5fd;font-weight:800;margin-top:6px;}
      .az-like-card-url{font-size:12px;color:#86efac;word-break:break-all;margin-top:8px;}
      .az-like-unlike-btn{border:0;border-radius:999px;background:#ef4444;color:#fff;font-weight:950;padding:9px 16px;cursor:pointer;box-shadow:0 8px 18px rgba(239,68,68,.22);white-space:normal;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .az-like-unlike-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
      .az-like-unlike-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;}
      .az-like-empty{border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:18px;color:#cbd5e1;}
      @media(max-width:640px){.az-like-card{grid-template-columns:1fr}.az-like-card-actions{width:100%;justify-content:stretch;display:grid;grid-template-columns:1fr 1fr}.az-bookmark-add-cart-btn,.az-like-unlike-btn{width:100%;padding-left:10px;padding-right:10px;}}
    `;
    document.head.appendChild(style);
  }

  function safeJson(value){ try{return JSON.parse(value || 'null');}catch(e){return null;} }
  function cleanKey(value){ return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,''); }
  function getSavedUser(){
    return safeJson(sessionStorage.getItem('azobssUser')) ||
      safeJson(localStorage.getItem('azobssUser')) ||
      safeJson(sessionStorage.getItem('azobssCurrentUser')) ||
      safeJson(localStorage.getItem('azobssCurrentUser')) || null;
  }
  function getUsernameKey(){
    const u = getSavedUser();
    const key = cleanKey(u?.usernameKey || u?.username || u?.name || u?.id || '');
    if(key) return key;
    const authUser = auth.currentUser;
    if(authUser && authUser.uid) return cleanKey(authUser.uid);
    return '';
  }
  function isLoggedIn(){ return !!(auth.currentUser || sessionStorage.getItem('azobssLoggedIn') === '1' || localStorage.getItem('azobssLoggedIn') === '1'); }
  function openLogin(){
    try{ if(typeof window.openSiteAuth === 'function'){ window.openSiteAuth('signin'); return; } }catch(e){}
    const btn = document.querySelector('[data-auth-open="login"], #siteLoginButton, .site-auth-actions .site-auth-btn, #openLoginBtn, .login-btn');
    if(btn) btn.click();
    else alert('Please login/register first to save this bookmark.');
  }
  function cacheKey(usernameKey){ return CACHE_PREFIX + usernameKey; }
  function loadCache(usernameKey){
    const arr = safeJson(localStorage.getItem(cacheKey(usernameKey))) || [];
    state.ids = new Set(Array.isArray(arr) ? arr.map(String) : []);
  }
  function saveCache(usernameKey){
    try{ localStorage.setItem(cacheKey(usernameKey), JSON.stringify(Array.from(state.ids))); }catch(e){}
  }
  async function loadLikesOnce(){
    const usernameKey = getUsernameKey();
    if(!usernameKey) return state.ids;
    if(state.loadedFor === usernameKey) return state.ids;
    if(state.loading) return state.loading;
    loadCache(usernameKey);
    state.loading = (async()=>{
      try{
        const snap = await getDocs(collection(db, 'users', usernameKey, 'likes'));
        const ids = new Set(state.ids);
        snap.forEach(d=>ids.add(String(d.id)));
        state.ids = ids;
        state.loadedFor = usernameKey;
        saveCache(usernameKey);
      }catch(err){
        console.warn('AZOBSS likes load skipped:', err);
        state.loadedFor = usernameKey;
      }finally{
        state.loading = null;
      }
      return state.ids;
    })();
    return state.loading;
  }
  function azBookmarkIconHtml434(){
    return '<svg class="az-bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4.5C6 3.7 6.7 3 7.5 3h9c.8 0 1.5.7 1.5 1.5V21l-6-3.4L6 21V4.5Z"></path></svg>';
  }
  function bookmarkIconForLikePage(){
    return '<svg class="az-like-page-bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4.5C6 3.7 6.7 3 7.5 3h9c.8 0 1.5.7 1.5 1.5V21l-6-3.4L6 21V4.5Z"></path></svg>';
  }
  function setButtonState(btn, liked){
    if(!btn) return;
    btn.classList.toggle('is-liked', !!liked);
    btn.innerHTML = azBookmarkIconHtml434();
    btn.setAttribute('aria-label', liked ? 'Remove bookmark' : 'Add bookmark');
    btn.title = liked ? 'Remove bookmark' : 'Add bookmark';
  }
  function isBookmarksRoute439(){
    const path = String(location.pathname || '').toLowerCase();
    return path.includes('/bookmarks');
  }
  function pageType(){
    const path = String(location.pathname || '').toLowerCase().replace(/\/$/,'');
    for(const key of Object.keys(PAGE_MAP)) if(path.includes(key)) return PAGE_MAP[key];
    if(path.includes('cad')) return 'CAD Tools & Resources';
    if(path.includes('software')) return 'Software Tools';
    if(path.includes('affiliate')) return 'Affiliate Shop';
    return 'AZOBSS';
  }
  function normalizeLikeUrl(url, page){
    let raw = String(url || '').trim();
    if(!raw || raw === '#') return '';
    if(/^(https?:|mailto:|tel:|blob:|data:)/i.test(raw)) return raw;
    raw = raw.replace(/\\/g, '/');
    if(raw.startsWith('/')) return location.origin + raw;

    const lowerRaw = raw.toLowerCase();
    if(lowerRaw.startsWith('software-tools/')) return location.origin + '/' + raw.replace(/^\/+/, '');
    if(lowerRaw.startsWith('cad-tools-&-resources/') || lowerRaw.startsWith('cad-tools-and-resources/')) return location.origin + '/' + raw.replace(/^\/+/, '');
    if(lowerRaw.startsWith('affiliate-shop/') || lowerRaw.startsWith('bookmarks/')) return location.origin + '/' + raw.replace(/^\/+/, '');

    const pageName = String(page || pageType() || '').toLowerCase();
    if(pageName.includes('software')) return location.origin + '/Software-Tools/' + raw.replace(/^\/+/, '');
    if(pageName.includes('cad')) return location.origin + '/CAD-Tools-&-Resources/' + raw.replace(/^\/+/, '');
    if(pageName.includes('affiliate')) return location.origin + '/affiliate-shop/' + raw.replace(/^\/+/, '');
    return location.origin + '/' + raw.replace(/^\/+/, '');
  }
  function bookmarkProductUrl439(productId, page, type){
    const id = String(productId || '').trim();
    const pageName = String(page || '').toLowerCase();
    const typeName = String(type || '').toLowerCase();
    if(!id) return '';
    const route = (pageName.includes('cad') || typeName.includes('cad'))
      ? '/CAD-Tools-&-Resources/'
      : (pageName.includes('affiliate') || typeName.includes('affiliate'))
        ? '/affiliate-shop/'
        : '/Software-Tools/';
    try{
      const url = new URL(location.origin + route);
      url.searchParams.set('product', id);
      url.searchParams.set('source', typeName.includes('cad') ? 'cad' : (typeName.includes('affiliate') ? 'affiliate' : 'software'));
      return url.toString();
    }catch(e){
      return location.origin + route + '?product=' + encodeURIComponent(id) + '&source=' + encodeURIComponent(typeName || 'software');
    }
  }
  function bookmarkOpenUrlForRow439(row){
    const page = String(row?.page || row?.category || '').toLowerCase();
    const type = String(row?.type || '').toLowerCase();
    const id = String(row?.productId || row?.softwareId || row?.cadId || row?.itemId || row?.id || '').trim();
    if(id && (page.includes('software') || type.includes('software') || page.includes('cad') || type.includes('cad') || page.includes('affiliate') || type.includes('affiliate'))){
      return bookmarkProductUrl439(id, row.page || row.category || '', row.type || '');
    }
    return normalizeLikeUrl(row?.pageUrl || row?.url || row?.downloadUrl || '', row?.page || row?.category || row?.type || '');
  }
  function azReadCardMonetization443(card){
    const btn = card?.querySelector?.('.download-btn,[data-azobss-premium-buy],.buy-btn,.premium-buy-btn,.az-card-cart-btn');
    const typeText = String(card?.dataset?.type || card?.dataset?.softwareType || card?.dataset?.cadType || '').trim().toLowerCase();
    const cardText = String(card?.innerText || '').toLowerCase();
    const btnPrice = btn ? String(btn.dataset?.productPrice || btn.dataset?.price || btn.getAttribute('data-product-price') || '').trim() : '';
    const premiumFlag = !!(btn && (btn.dataset?.azobssPremiumBuy === '1' || btn.getAttribute('data-azobss-premium-buy') === '1'));
    const hasBuy = /buy\s+now|premium|activation\s+code|rm\s*\d/i.test(cardText);
    const hasFree = /free|download\s+now/i.test(cardText) && !hasBuy && !premiumFlag;
    const price = btnPrice || (hasFree ? 'FREE' : '');
    const isPremium = premiumFlag || typeText === 'premium' || typeText === 'paid' || (!!btnPrice && azMoneyValue443(btnPrice) > 0) || hasBuy;
    const isFree = !isPremium && (typeText === 'free' || hasFree || /^free$/i.test(price) || azMoneyValue443(price) === 0);
    return {
      productType: isPremium ? 'premium' : (isFree ? 'free' : typeText),
      price: isPremium ? (btnPrice || '') : (isFree ? 'FREE' : price),
      productPrice: isPremium ? (btnPrice || '') : (isFree ? 'FREE' : price),
      isPremium,
      isFree,
      paymentLink: btn ? String(btn.dataset?.paymentLink || '').trim() : '',
      stripeLink: btn ? String(btn.dataset?.stripeLink || '').trim() : '',
      secureDownloadLink: btn ? String(btn.dataset?.downloadLink || btn.dataset?.premiumDownloadFileLink || '').trim() : '',
      premiumDownloadFileLink: btn ? String(btn.dataset?.premiumDownloadFileLink || '').trim() : '',
      downloadLink: btn ? String(btn.dataset?.downloadLink || '').trim() : ''
    };
  }
  function getCardInfo(card){
    const isAff = card.matches('.card');
    const isSw = card.matches('.download-card');
    const isCad = card.matches('.cad-card');
    const rawId = String(card.dataset.productId || card.dataset.softwareId || card.dataset.cadId || card.dataset.docId || card.dataset.id || '').trim() || cleanKey(card.querySelector('h2,h3')?.textContent || 'item');
    const id = cleanKey(rawId) || ('item-' + Date.now());
    const title = String(card.querySelector('h2,h3')?.textContent || rawId || id).trim();
    const desc = String(card.querySelector('p')?.textContent || '').trim();
    const category = String(card.dataset.category || card.querySelector('.badge,.software-badge,.cad-badge,.meta')?.textContent || pageType()).trim();
    const page = pageType();
    const type = isAff ? 'affiliate' : (isSw ? 'software' : (isCad ? 'cad' : 'item'));
    const productPageUrl = bookmarkProductUrl439(rawId || id, page, type);
    const moneyInfo = (isSw || isCad) ? azReadCardMonetization443(card) : {productType:'',price:'',productPrice:'',isPremium:false,isFree:false,paymentLink:'',stripeLink:'',secureDownloadLink:'',premiumDownloadFileLink:'',downloadLink:''};
    return {
      id,
      productId: rawId || id,
      title, desc, category,
      page,
      type,
      productType: moneyInfo.productType,
      softwareType: isSw ? moneyInfo.productType : '',
      cadType: isCad ? moneyInfo.productType : '',
      price: moneyInfo.price,
      productPrice: moneyInfo.productPrice,
      isPremium: moneyInfo.isPremium,
      isFree: moneyInfo.isFree,
      paymentLink: moneyInfo.paymentLink,
      stripeLink: moneyInfo.stripeLink,
      secureDownloadLink: moneyInfo.secureDownloadLink,
      premiumDownloadFileLink: moneyInfo.premiumDownloadFileLink,
      downloadLink: moneyInfo.downloadLink,
      url: productPageUrl || normalizeLikeUrl(location.pathname, page),
      pageUrl: productPageUrl || normalizeLikeUrl(location.pathname, page),
      savedAt: Date.now()
    };
  }
  function getCards(){
    const cards = [];
    document.querySelectorAll('.card[data-product-id], .download-card, .cad-card').forEach(card=>{
      if(card.closest('.auth-modal,.azobss-pay-modal,.admin-modal,.cad-admin-modal,.software-admin-modal')) return;
      // AZOBSS 287: do not skip cards that already include a first-paint like button.
      // Bind/update the existing button in place so the control is visible immediately and never blinks.
      const info = getCardInfo(card);
      if(!info.id || !info.title) return;
      cards.push({card, info});
    });
    return cards;
  }
  async function toggleLike(btn, info){
    if(!isLoggedIn()) { openLogin(); return; }
    const usernameKey = getUsernameKey();
    if(!usernameKey){ openLogin(); return; }
    await loadLikesOnce();
    const id = String(info.id);
    if(state.busy.has(id)) return;
    state.busy.add(id);
    btn.disabled = true;
    const nextLiked = !state.ids.has(id);
    if(nextLiked) state.ids.add(id); else state.ids.delete(id);
    setButtonState(btn, nextLiked);
    saveCache(usernameKey);
    try{
      if(nextLiked){
        await setDoc(doc(db, 'users', usernameKey, 'likes', id), {
          ...info,
          itemId: id,
          usernameKey,
          uid: auth.currentUser?.uid || getSavedUser()?.uid || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, {merge:true});
      }else{
        await deleteDoc(doc(db, 'users', usernameKey, 'likes', id));
      }
      // AZOBSS 432: top-right control is bookmark/save only.
      // Software like count is handled separately by the footer like button.
    }catch(err){
      console.warn('AZOBSS like save failed:', err);
      if(nextLiked) state.ids.delete(id); else state.ids.add(id);
      setButtonState(btn, !nextLiked);
      saveCache(usernameKey);
      alert('Unable to update Bookmarks right now. Please try again later.');
    }finally{
      state.busy.delete(id);
      btn.disabled = false;
      renderLikesPage(true);
    }
  }
  // AZOBSS 294: delegated fallback for first-paint like buttons.
  // Some shop cards render the bookmark button immediately before the injector binds per-button events.
  // This keeps the button usable: guest gets login/register prompt, logged-in users toggle like.
  document.addEventListener('click', function(event){
    const btn = event.target && event.target.closest ? event.target.closest('.az-item-like-btn') : null;
    if(!btn || isBookmarksRoute439()) return;
    // If the normal per-button listener is already bound, it stops propagation before this bubble listener.
    // So reaching here means fallback is needed.
    const card = btn.closest('.card[data-product-id], .download-card, .cad-card');
    if(!card) return;
    event.preventDefault();
    event.stopPropagation();
    toggleLike(btn, getCardInfo(card));
  }, false);

  async function injectLikeButtons(){
    if(isBookmarksRoute439()) return;
    addLikeStyle();
    const usernameKey = getUsernameKey();
    if(usernameKey && state.loadedFor !== usernameKey) loadCache(usernameKey);
    const currentCards = getCards();
    currentCards.forEach(({card, info})=>{
      card.classList.add('az-has-like-btn');
      let btn = card.querySelector(':scope > .az-item-like-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'az-item-like-btn';
        card.appendChild(btn);
      }
      btn.dataset.likeItemId = info.id;
      if(btn.dataset.azLikeBound !== '1'){
        btn.dataset.azLikeBound = '1';
        btn.addEventListener('click', (event)=>{
          event.preventDefault();
          event.stopPropagation();
          toggleLike(btn, getCardInfo(card));
        });
      }
      setButtonState(btn, state.ids.has(info.id));
    });
    if(usernameKey){
      try{
        await loadLikesOnce();
        document.querySelectorAll('.az-item-like-btn').forEach(btn=>{
          const id = String(btn.dataset.likeItemId || '');
          if(id) setButtonState(btn, state.ids.has(id));
        });
      }catch(e){}
    }
  }
  function bookmarkRowKind(row){
    const page = String(row?.page || row?.category || '').toLowerCase();
    const type = String(row?.type || '').toLowerCase();
    if(page.includes('cad') || type.includes('cad')) return 'cad';
    if(page.includes('software') || type.includes('software')) return 'software';
    return '';
  }
  function azText443(value){ return String(value == null ? '' : value).trim(); }
  function azMoneyValue443(value){
    const raw = azText443(value);
    const text = raw.toLowerCase();
    if(!text || /^free$/.test(text) || text === 'rm0' || text === 'rm0.00' || text === '0') return 0;
    // AZOBSS 444: Be strict. Do not treat product IDs, version numbers, file sizes,
    // URLs, or download filenames as prices. Old bookmarks sometimes store a URL in
    // price-like fields, causing free software to incorrectly show Add to Cart.
    if(/https?:\/\//i.test(raw) || /[\/]/.test(raw) || /\.(exe|zip|rar|7z|msi|dmg|pkg|gif|png|jpe?g|webp|pdf)(?:$|[?#])/i.test(raw)) return NaN;
    const cleaned = raw.replace(/,/g,'').trim();
    let m = cleaned.match(/(?:rm|myr)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if(m) return Number(m[1]);
    // Plain numeric values are accepted only if the entire field is numeric, not if
    // it contains text such as v1.0.9, 41MB, AZSW-CMP003 or a file name.
    if(/^[0-9]+(?:\.[0-9]{1,2})?$/.test(cleaned)) return Number(cleaned);
    return NaN;
  }
  function azBookmarkIsFreeItem443(row){
    const productType = azText443(row?.productType || row?.softwareType || row?.cadType || row?.planType || row?.saleType || row?.pricingType || '').toLowerCase();
    const typeText = azText443(row?.type || '').toLowerCase();
    const priceText = azText443(row?.productPrice || row?.price || row?.priceText || row?.amount || row?.salePrice || row?.finalPrice || '').toLowerCase();
    if(row?.isFree === true || row?.free === true) return true;
    if(productType === 'free' || productType === 'free software' || productType === 'free cad') return true;
    if(typeText === 'free' || typeText === 'free software' || typeText === 'free cad') return true;
    if(priceText && (/^free$/.test(priceText) || /^rm\s*0(?:\.00)?$/i.test(priceText) || priceText === '0')) return true;
    return false;
  }
  function azBookmarkIsPaidItem443(row){
    if(azBookmarkIsFreeItem443(row)) return false;
    const productType = azText443(row?.productType || row?.softwareType || row?.cadType || row?.planType || row?.saleType || row?.pricingType || '').toLowerCase();
    const typeText = azText443(row?.type || '').toLowerCase();
    const explicitPremium = row?.isPremium === true || row?.premium === true || row?.isPaid === true || row?.paid === true
      || productType === 'premium' || productType === 'paid' || productType === 'premium software' || productType === 'premium cad'
      || typeText === 'premium' || typeText === 'paid' || typeText === 'premium software' || typeText === 'premium cad';
    if(explicitPremium) return true;
    const priceFields = [row?.productPrice, row?.price, row?.priceText, row?.amount, row?.salePrice, row?.finalPrice];
    const money = priceFields.map(azMoneyValue443).find(v => Number.isFinite(v) && v > 0);
    if(Number.isFinite(money) && money > 0) return true;
    // AZOBSS 444: Do not mark an old bookmark as paid just because it has paymentLink
    // or a direct download URL. Premium cart button must require a clear premium flag
    // or a real RM/MYR price. This prevents Free Software like Bandizip/TBana free from
    // showing Add to Cart after old bookmark data is reused.
    return false;
  }
  function shouldShowBookmarkCartButton(row){
    const kind = bookmarkRowKind(row);
    if(kind !== 'software' && kind !== 'cad') return false;
    // AZOBSS 443: Bookmarks Add to Cart is only for paid/premium Software/CAD.
    // Free items are direct-download/share items, so the cart button is hidden.
    return azBookmarkIsPaidItem443(row);
  }
  function bookmarkCartPayload441(row){
    const kind = bookmarkRowKind(row);
    const id = String(row?.productId || row?.softwareId || row?.cadId || row?.itemId || row?.id || '').trim();
    const title = String(row?.title || row?.name || id || 'Bookmarked item').trim();
    const url = bookmarkOpenUrlForRow439(row);
    const price = String(row?.productPrice || row?.price || row?.priceText || row?.amount || row?.salePrice || 'RM0').trim() || 'RM0';
    const source = kind === 'cad' ? 'CAD Tools' : 'Software';
    const category = String(row?.category || row?.page || source).trim() || source;
    const link = String(row?.secureDownloadLink || row?.premiumDownloadFileLink || row?.downloadLink || row?.url || '').trim();
    return {
      id: id || (source + ':' + title),
      productId: id,
      name: title,
      title,
      price,
      source,
      category,
      type: kind || String(row?.type || ''),
      image: String(row?.image || row?.img || row?.thumbnail || row?.logo || '').trim(),
      pageUrl: url || String(row?.pageUrl || ''),
      paymentLink: String(row?.paymentLink || '').trim(),
      stripeLink: String(row?.stripeLink || '').trim(),
      secureDownloadLink: link,
      premiumDownloadFileLink: String(row?.premiumDownloadFileLink || link).trim(),
      downloadLink: String(row?.downloadLink || link).trim(),
      qty: 1,
      maxQty: 1,
      fromBookmarks: true
    };
  }
  function encodeBookmarkCartPayload441(row){
    try{ return encodeURIComponent(JSON.stringify(bookmarkCartPayload441(row))); }catch(e){ return ''; }
  }

  function likeCardHtml(row){
    const title = String(row.title || row.name || row.itemId || 'Bookmarked item');
    const meta = [row.page, row.category, row.type].filter(Boolean).join(' • ');
    const url = bookmarkOpenUrlForRow439(row);
    const itemId = String(row.itemId || row.id || '');
    return `<div class="az-like-card liked-item" data-url="${escapeHtml(url)}" data-type="${escapeHtml(row.type || '')}" data-like-id="${escapeHtml(itemId)}">
      <div class="az-like-card-main">
        <div class="az-like-card-title">${bookmarkIconForLikePage()}<span>${escapeHtml(title)}</span></div>
        <div class="az-like-card-meta">${escapeHtml(meta || 'AZOBSS')}</div>
        ${url ? `<div class="az-like-card-url">${escapeHtml(url)}</div>` : ''}
      </div>
      <div class="az-like-card-actions">
        ${shouldShowBookmarkCartButton(row) ? `<button class="az-bookmark-add-cart-btn" type="button" data-bookmark-add-cart="${escapeHtml(encodeBookmarkCartPayload441(row))}" aria-label="Add bookmark item to cart">🛒 Add to Cart</button>` : ''}
        <button class="az-like-unlike-btn" type="button" data-unlike-id="${escapeHtml(itemId)}" aria-label="Remove bookmark">Remove</button>
      </div>
    </div>`;
  }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function addBookmarkItemToCart441(btn){
    if(!btn || btn.dataset.azBookmarkCartBusy === '1') return;
    btn.dataset.azBookmarkCartBusy = '1';
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    try{
      const payload = JSON.parse(decodeURIComponent(String(btn.dataset.bookmarkAddCart || '')) || '{}');
      if(!payload || !payload.id){ throw new Error('Missing bookmark cart payload'); }
      payload.qty = 1;
      payload.maxQty = 1;
      payload.addedAt = Date.now();
      if(typeof window.azobssAddShopCart === 'function'){
        window.azobssAddShopCart(payload);
      }else{
        const key = window.__azobssCurrentCartKey || 'azobss_shop_cart_guest_v1';
        let items = [];
        try{ items = JSON.parse(localStorage.getItem(key) || '[]').filter(Boolean); }catch(e){ items = []; }
        const found = items.find(x => String(x.id) === String(payload.id) && String(x.source || '') === String(payload.source || ''));
        if(found){ found.qty = 1; found.maxQty = 1; found.addedAt = found.addedAt || Date.now(); }
        else items.push(payload);
        localStorage.setItem(key, JSON.stringify(items.slice(0,100)));
        window.dispatchEvent(new Event('azobss-shop-cart-updated'));
        if(typeof window.azobssOpenShopCart === 'function') window.azobssOpenShopCart();
      }
      btn.innerHTML = '✓ Added';
      setTimeout(()=>{ btn.innerHTML = oldHtml; btn.disabled = false; btn.dataset.azBookmarkCartBusy = '0'; }, 900);
    }catch(err){
      console.warn('AZOBSS bookmark add to cart failed:', err);
      btn.disabled = false;
      btn.dataset.azBookmarkCartBusy = '0';
      alert('Unable to add this bookmark to cart. Please open the product page and add it again.');
    }
  }

  document.addEventListener('click', function(event){
    const btn = event.target.closest && event.target.closest('[data-bookmark-add-cart]');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if(event.stopImmediatePropagation) event.stopImmediatePropagation();
    addBookmarkItemToCart441(btn);
  }, true);

  async function unlikeFromLikesPage(itemId, btn){
    const usernameKey = getUsernameKey();
    const id = String(itemId || '').trim();
    if(!usernameKey || !id) return;
    if(state.busy.has(id)) return;
    state.busy.add(id);
    if(btn) btn.disabled = true;
    try{
      await deleteDoc(doc(db, 'users', usernameKey, 'likes', id));
      state.ids.delete(id);
      saveCache(usernameKey);
      const card = btn?.closest?.('.az-like-card');
      if(card) card.remove();
      renderLikesPage(false);
    }catch(err){
      console.warn('AZOBSS bookmark remove failed:', err);
      alert('Unable to remove this item from Bookmarks right now. Please try again later.');
    }finally{
      state.busy.delete(id);
      if(btn) btn.disabled = false;
    }
  }

  function sortAndFilterLikesRows(rows){
    let out = [...rows];
    const q = String(document.getElementById('likesSearchInput')?.value || '').trim().toLowerCase();
    if(q){
      out = out.filter(r=>[r.title,r.category,r.page,r.type,r.url,r.pageUrl,r.productId,r.itemId].join(' ').toLowerCase().includes(q));
    }
    const sort = document.getElementById('likesSortSelect')?.value || 'newest';
    if(sort==='software') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('software'));
    else if(sort==='cad') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('cad'));
    else if(sort==='affiliate') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('affiliate'));
    else if(sort==='category') out.sort((a,b)=>String(a.category||a.page||'').localeCompare(String(b.category||b.page||'')));
    else if(sort==='az') out.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    else if(sort==='za') out.sort((a,b)=>String(b.title||'').localeCompare(String(a.title||'')));
    else if(sort==='oldest') out.sort((a,b)=>Number(a.savedAt||a.createdAtMs||0)-Number(b.savedAt||b.createdAtMs||0));
    else out.sort((a,b)=>Number(b.savedAt||b.createdAtMs||0)-Number(a.savedAt||a.createdAtMs||0));
    return out;
  }

  function renderLikesList(){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    const rows = sortAndFilterLikesRows(likesPageState.rows);
    if(!rows.length){
      list.innerHTML = '<div class="az-like-empty">No bookmarks yet. Tap the bookmark button on Software, CAD or Affiliate items.</div>';
      return;
    }
    const more = likesPageState.hasMore
      ? '<div class="az-like-loadmore-wrap"><button id="azLikesLoadMoreBtn" class="az-like-loadmore" type="button">Load More</button></div>'
      : '';
    list.innerHTML = rows.map(likeCardHtml).join('') + more;
  }

  async function loadLikesPage(reset){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    const usernameKey = getUsernameKey();
    if(!usernameKey) return;
    if(likesPageState.loading) return;
    likesPageState.loading = true;
    if(reset || likesPageState.usernameKey !== usernameKey){
      likesPageState.usernameKey = usernameKey;
      likesPageState.rows = [];
      likesPageState.lastDoc = null;
      likesPageState.hasMore = false;
      list.innerHTML = '<div class="az-like-empty">Loading bookmarks...</div>';
    }
    try{
      const baseRef = collection(db, 'users', usernameKey, 'likes');
      const pageLimit = likesPageState.pageSize;
      const q = likesPageState.lastDoc
        ? query(baseRef, orderBy('savedAt','desc'), startAfter(likesPageState.lastDoc), limit(pageLimit))
        : query(baseRef, orderBy('savedAt','desc'), limit(pageLimit));
      const snap = await getDocs(q);
      const incoming = snap.docs.map(d=>({itemId:d.id, ...d.data()}));
      const seen = new Set(likesPageState.rows.map(r=>String(r.itemId || r.id || '')));
      incoming.forEach(row=>{
        const id = String(row.itemId || row.id || '');
        if(id && !seen.has(id)) likesPageState.rows.push(row);
      });
      likesPageState.lastDoc = snap.docs[snap.docs.length-1] || likesPageState.lastDoc;
      likesPageState.hasMore = snap.docs.length === pageLimit;
      renderLikesList();
    }catch(err){
      console.warn('AZOBSS paged likes load failed, using cache fallback:', err);
      const fallbackRows = Array.from(state.ids).map(id=>({itemId:id, title:id, page:'AZOBSS', savedAt:0}));
      likesPageState.rows = fallbackRows;
      likesPageState.hasMore = false;
      renderLikesList();
    }finally{
      likesPageState.loading = false;
    }
  }

  async function renderLikesPage(skipLoad){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    addLikeStyle();
    if(!isLoggedIn()){
      list.innerHTML = '<div class="az-like-empty">Please login to view your bookmarks.</div>';
      return;
    }
    const usernameKey = getUsernameKey();
    if(!usernameKey){ list.innerHTML = '<div class="az-like-empty">Please login again to load Bookmarks.</div>'; return; }
    if(!skipLoad) await loadLikesPage(true);
    else renderLikesList();
  }
  function scheduleInject(){
    clearTimeout(scheduleInject.t);
    scheduleInject.t = setTimeout(injectLikeButtons, 80);
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    injectLikeButtons();
    renderLikesPage(false);
    document.getElementById('likesSearchInput')?.addEventListener('input', ()=>renderLikesPage(true));
    document.getElementById('likesSortSelect')?.addEventListener('change', ()=>renderLikesPage(true));
    document.getElementById('azobssLikesList')?.addEventListener('click', (event)=>{
      const loadMoreBtn = event.target.closest('#azLikesLoadMoreBtn');
      if(loadMoreBtn){
        event.preventDefault();
        event.stopPropagation();
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
        loadLikesPage(false);
        return;
      }
      const unlikeBtn = event.target.closest('.az-like-unlike-btn');
      if(unlikeBtn){
        event.preventDefault();
        event.stopPropagation();
        unlikeFromLikesPage(unlikeBtn.dataset.unlikeId, unlikeBtn);
        return;
      }
      const card = event.target.closest('.az-like-card[data-url]');
      const url = card?.dataset?.url || '';
      if(url){
        event.preventDefault();
        window.location.href = normalizeLikeUrl(url, card.dataset.type || '');
      }
    });
    const obs = new MutationObserver(scheduleInject);
    obs.observe(document.body, {childList:true, subtree:true});
    setTimeout(injectLikeButtons, 600);
    setTimeout(injectLikeButtons, 1500);
  });
  onAuthStateChanged(auth, ()=>{
    state.loadedFor = '';
    state.ids = new Set();
    likesPageState.usernameKey = '';
    likesPageState.rows = [];
    likesPageState.lastDoc = null;
    likesPageState.hasMore = false;
    setTimeout(()=>{ injectLikeButtons(); renderLikesPage(false); }, 200);
  });
})();






// AZOBSS PATCH 215: PA/BM owner-only admin records UI final guard helper
(function(){
  if(window.__azobssPabmOwnerOnlyGuard215Installed) return;
  window.__azobssPabmOwnerOnlyGuard215Installed = true;
  window.azobssIsPaBmOwnerAdmin = window.azobssIsPaBmOwnerAdmin || function(){
    var keys=['zedan91','zedan9107'], emails=['zedan9107@gmail.com','zedan91@azobss.local'];
    function clean(v){return String(v||'').trim().toLowerCase();}
    function parse(raw){try{return raw?JSON.parse(raw):null;}catch(_){return null;}}
    var u={};
    try{ if(typeof window.getSavedUser==='function') u=window.getSavedUser()||{}; }catch(_){ }
    if(!u || !Object.keys(u).length){
      ['azobssUser','azobss_user','azobssCurrentUser','azobss_current_user','siteUser','currentUser'].some(function(k){var o=parse(localStorage.getItem(k)||sessionStorage.getItem(k)||''); if(o){u=o; return true;} return false;});
    }
    var email=clean(u.email||u.authEmail||'');
    try{ if(!email && window.firebase && window.firebase.auth) email=clean(window.firebase.auth().currentUser && window.firebase.auth().currentUser.email); }catch(_){ }
    var key=clean(u.usernameKey||u.username||u.displayName||u.name||(email?email.split('@')[0]:''));
    var shown=clean((document.getElementById('signedInName')||{}).textContent||'');
    return keys.indexOf(key)!==-1 || keys.indexOf(shown)!==-1 || emails.indexOf(email)!==-1;
  };
})();
