import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
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

const modal = document.getElementById('siteAuthModal');
const title = document.getElementById('siteAuthTitle');
const signInForm = document.getElementById('siteSignInForm');
const signUpForm = document.getElementById('siteSignUpForm');
const loginError = document.getElementById('siteLoginError');
const signupError = document.getElementById('siteSignupError');
const closeBtn = document.getElementById('siteAuthClose');
const signInSubmitButton = document.getElementById('siteSignInSubmitButton');

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function buildUserEmail(usernameKey) {
  return `${usernameKey}@azobss.local`;
}

function cleanPhone(value) {
  return String(value || '').replace(/[^0-9]/g, '').replace(/^60/, '').replace(/^0+/, '');
}

function buildInviteCode(usernameKey) {
  return `AZ${String(usernameKey || 'USER').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6)}`;
}

function initials(name) {
  return String(name || 'AZ').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AZ';
}

function markLoggedIn() {
  sessionStorage.setItem('azobssLoggedIn', '1');
  localStorage.setItem('azobssLoggedIn', '1');
}

function saveCurrentUser(user) {
  const value = JSON.stringify(user);
  sessionStorage.setItem('azobssCurrentUser', value);
  localStorage.setItem('azobssCurrentUser', value);
  markLoggedIn();
  window.dispatchEvent(new Event('storage'));
}

function syncHeader(user) {
  const authActions = document.getElementById('siteAuthActions');
  const tools = document.getElementById('marketUserTools');
  const name = document.getElementById('signedInName');
  const avatar = document.getElementById('userAvatar');
  const paBm = document.getElementById('paBmNavButton');
  const display = user && (user.usernameKey || user.name || '');
  const usernameKey = String(user?.usernameKey || user?.name || '').trim().toLowerCase();
  const memberCode = String(user?.invitedByCode || user?.memberCode || user?.paMemberCode || user?.code || '').trim().toUpperCase();
  const canShowPaBm = Boolean(user && (usernameKey === 'zedan91' || user.paAccess === true || memberCode === 'ZX6186'));

  if (paBm) {
    paBm.hidden = !canShowPaBm;
    paBm.classList.toggle('is-hidden', !canShowPaBm);
  }

  if (!display) return;

  document.body.classList.add('is-authenticated');
  if (name) name.textContent = display;
  if (avatar) avatar.textContent = initials(display);
  if (authActions) authActions.style.setProperty('display', 'none', 'important');
  if (tools) tools.style.setProperty('display', 'flex', 'important');
}

function clearAuthErrors() {
  if (loginError) loginError.textContent = '';
  if (signupError) signupError.textContent = '';
}

function openSiteAuth(mode = 'signin') {
  const isSignup = mode === 'signup' || mode === 'register';
  if (!modal || !signInForm || !signUpForm) return;

  if (title) title.textContent = isSignup ? 'Sign up' : 'Sign in';
  signInForm.hidden = isSignup;
  signUpForm.hidden = !isSignup;
  clearAuthErrors();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');

  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (error) {}

  setTimeout(() => {
    document.getElementById(isSignup ? 'siteSignupName' : 'siteLoginName')?.focus();
  }, 50);
}

function closeSiteAuth() {
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch (error) {}
}

function setButtonLoading(button, isLoading, loadingText, defaultText) {
  if (!button) return;
  button.disabled = isLoading;
  button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  button.textContent = isLoading ? loadingText : defaultText;
}

async function signInSiteUser() {
  if (loginError) loginError.textContent = '';

  const usernameKey = normalizeUsername(document.getElementById('siteLoginName')?.value);
  const password = document.getElementById('siteLoginPassword')?.value || '';

  if (!usernameKey || !password) {
    if (loginError) loginError.textContent = 'Please enter username and password.';
    return;
  }

  try {
    await setPersistence(auth, browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, buildUserEmail(usernameKey), password);
    const snap = await getDoc(doc(db, 'users', usernameKey));
    const data = snap.exists() ? snap.data() : {};

    if (data.disabled || data.deleted) {
      if (loginError) loginError.textContent = 'This account has been removed by admin.';
      return;
    }

    const user = {
      ...data,
      uid: credential.user.uid,
      usernameKey,
      name: data.name || usernameKey,
      lastLoginMs: Date.now()
    };

    await setDoc(doc(db, 'users', usernameKey), {
      lastLoginAt: serverTimestamp(),
      lastLoginMs: Date.now()
    }, { merge: true });

    saveCurrentUser(user);
    syncHeader(user);
    closeSiteAuth();
  } catch (error) {
    if (loginError) loginError.textContent = 'Username or password is incorrect. Please try again.';
  }
}

async function signUpSiteUser() {
  if (signupError) signupError.textContent = '';

  const usernameKey = normalizeUsername(document.getElementById('siteSignupName')?.value);
  const password = document.getElementById('siteSignupPassword')?.value || '';
  const phone = cleanPhone(document.getElementById('siteSignupPhone')?.value);
  const contactEmail = (document.getElementById('siteSignupEmail')?.value || '').trim();
  const invitedByCode = (document.getElementById('siteSignupInviteCode')?.value || '').trim().toUpperCase();

  if (!usernameKey || !password || !phone || !contactEmail) {
    if (signupError) signupError.textContent = 'Please complete all required fields.';
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    if (signupError) signupError.textContent = 'Please enter a valid email address.';
    return;
  }

  if (password.length < 6) {
    if (signupError) signupError.textContent = 'Password mesti sekurang-kurangnya 6 aksara.';
    return;
  }

  try {
    await setPersistence(auth, browserSessionPersistence);
    const credential = await createUserWithEmailAndPassword(auth, buildUserEmail(usernameKey), password);
    const now = Date.now();
    const user = {
      uid: credential.user.uid,
      usernameKey,
      name: usernameKey,
      phone: `+60${phone}`,
      phoneLocal: phone,
      countryCode: '+60',
      contactEmail,
      invitedByCode,
      inviteCode: buildInviteCode(usernameKey),
      createdAtMs: now,
      lastLoginMs: now
    };

    await setDoc(doc(db, 'users', usernameKey), {
      ...user,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    }, { merge: true });

    saveCurrentUser(user);
    syncHeader(user);
    closeSiteAuth();
  } catch (error) {
    if (!signupError) return;
    signupError.textContent = error?.code === 'auth/email-already-in-use'
      ? 'This username is already registered. Please sign in.'
      : 'Sign up failed. Please try again.';
  }
}

window.openSiteAuth = openSiteAuth;
window.openLoginModal = () => openSiteAuth('signin');
window.openSignupModal = () => openSiteAuth('signup');

document.addEventListener('click', (event) => {
  const loginTrigger = event.target.closest('[data-auth="login"], [data-auth="signin"], #siteSignInButton');
  const signupTrigger = event.target.closest('[data-auth="signup"], [data-auth="register"], #siteSignUpButton');

  if (loginTrigger) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openSiteAuth('signin');
  }

  if (signupTrigger) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openSiteAuth('signup');
  }
}, true);

closeBtn?.addEventListener('click', closeSiteAuth);
modal?.addEventListener('click', (event) => {
  if (event.target === modal) closeSiteAuth();
});

document.getElementById('switchToSiteSignup')?.addEventListener('click', () => openSiteAuth('signup'));
document.getElementById('switchToSiteSignin')?.addEventListener('click', () => openSiteAuth('signin'));

signInForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  setButtonLoading(signInSubmitButton, true, 'Signing in...', 'Sign in');

  try {
    await signInSiteUser();
  } finally {
    setButtonLoading(signInSubmitButton, false, 'Signing in...', 'Sign in');
  }
}, true);

signUpForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  await signUpSiteUser();
}, true);

if (location.hash === '#login' || location.hash === '#signin') openSiteAuth('signin');
if (location.hash === '#signup' || location.hash === '#register') openSiteAuth('signup');
