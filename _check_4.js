
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azAdminAccessGuard) return;
  window.__azAdminAccessGuard = true;

  const firebaseConfig = {
    apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain:'azobss.firebaseapp.com',
    projectId:'azobss',
    storageBucket:'azobss.firebasestorage.app',
    messagingSenderId:'159277716405',
    appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
  };

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ADMIN_EMAILS = ['zedan9107@gmail.com','zedan91@azobss.local'];
  const OWNER_USERNAME = 'zedan91';

  const clean = v => String(v || '').trim().toLowerCase();
  const unique = arr => [...new Set(arr.map(clean).filter(Boolean))];
  const isOwnerEmail = email => ADMIN_EMAILS.includes(clean(email));

  function clearAdminCache(){
    try{
      localStorage.removeItem('azobss_admin_role_cache');
      localStorage.removeItem('azobssAdminRoleCache');
    }catch(_e){}
    document.body.classList.remove('az-admin-access-ok','az-role-is-admin','is-admin','azobss-support-admin');
    document.body.setAttribute('data-az-current-role','none');
  }

  function markAdminCache(){
    try{ localStorage.setItem('azobss_admin_role_cache','1'); }catch(_e){}
    document.body.classList.add('az-admin-access-ok','az-role-is-admin','is-admin');
    document.body.setAttribute('data-az-current-role','admin');
  }

  function profileBelongsToUser(profile,user){
    if(!profile || !user) return false;
    const uid = clean(profile.uid || profile.authUid || profile.userUid || profile.firebaseUid);
    const docEmail = clean(profile.email || profile.authEmail || profile.realEmail || profile.userEmail);
    if(uid && uid === clean(user.uid)) return true;
    if(docEmail && clean(user.email) && docEmail === clean(user.email)) return true;
    return false;
  }

  function profileLooksAdmin(profile,docId,user){
    if(!profileBelongsToUser(profile,user)) return false;
    const role = clean(profile.role || profile.accountRole || profile.userRole || profile.accessRole);
    const username = clean(profile.username || profile.usernameKey || profile.name || docId);
    const docEmail = clean(profile.email || profile.authEmail || profile.realEmail || profile.userEmail);
    return role === 'admin' || profile.isAdmin === true || profile.admin === true || profile.owner === true || username === OWNER_USERNAME || isOwnerEmail(docEmail);
  }

  function storedUsernameCandidates(){
    const keys=['azobssCurrentUser','azobssUser','azobss_current_user','azobssSavedUser','azobss_user_profile','azobssProfile','currentUser','userProfile','azobss_auth_user','azobssLoginUser','azobss_logged_user'];
    const out=[];
    keys.forEach(k=>{
      try{
        const raw=localStorage.getItem(k)||sessionStorage.getItem(k);
        if(!raw) return;
        let obj=null;
        try{ obj=JSON.parse(raw); }catch(_e){ obj={username:raw}; }
        out.push(obj?.usernameKey,obj?.username,obj?.userName,obj?.id,obj?.name,obj?.displayName);
      }catch(_e){}
    });
    return out;
  }

  async function readCandidateProfile(id){
    try{
      const snap = await getDoc(doc(db,'users',clean(id)));
      if(!snap.exists()) return null;
      return { id:snap.id, ...snap.data() };
    }catch(_e){ return null; }
  }

  async function isAdmin(user){
    if(!user) return false;
    const email = clean(user.email);

    // Owner email is allowed, but normal users are no longer allowed to pass by reading users/zedan91.
    if(isOwnerEmail(email)) return true;

    const candidates = unique([
      user.email ? user.email.split('@')[0] : '',
      user.displayName || '',
      user.uid || '',
      ...storedUsernameCandidates()
    ]);

    for(const id of candidates){
      const profile = await readCandidateProfile(id);
      if(profile && profileLooksAdmin(profile,id,user)) return true;
    }
    return false;
  }

  function azAdminWhenBodyReady(fn){
    if(document.body) return fn();
    document.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  function showDenied(message){
    clearAdminCache();
    azAdminWhenBodyReady(() => {
      let box = document.getElementById('azAdminAccessDenied');
      if(!box){
        box = document.createElement('div');
        box.id = 'azAdminAccessDenied';
        box.innerHTML = '<div class="box"><h2>🔐 Admin Only</h2><p id="azAdminAccessMessage"></p><a href="/">Back to Home</a></div>';
        document.body.appendChild(box);
      }
      const msg = document.getElementById('azAdminAccessMessage');
      if(msg) msg.textContent = message || 'You do not have permission to access this page.';
    });
  }

  function showAdmin(){
    markAdminCache();
    const box = document.getElementById('azAdminAccessDenied');
    if(box) box.remove();
    window.__azobssVerifiedAdmin = true;
  }

  showDenied('Checking admin access...');

  // PATCH 881: never leave the admin overlay on an endless "Checking..." state.
  const azAdminAccessTimeout = setTimeout(() => {
    if(!window.__azAdminTopGuardResolved){
      showDenied('Admin access check is taking too long. Press Ctrl + F5 or login again.');
    }
  }, 12000);

  onAuthStateChanged(auth, async user => {
    clearTimeout(azAdminAccessTimeout);
    window.__azAdminTopGuardResolved = true;
    if(!user){
      window.__azobssVerifiedAdmin = false;
      showDenied('Please login as admin first.');
      return;
    }

    const ok = await isAdmin(user);
    if(ok) showAdmin();
    else{
      window.__azobssVerifiedAdmin = false;
      showDenied('Access denied. Admin account required.');
    }
  }, err => {
    clearTimeout(azAdminAccessTimeout);
    window.__azAdminTopGuardResolved = true;
    window.__azobssVerifiedAdmin = false;
    showDenied('Admin access check failed. Please refresh or login again.');
    console.warn('[AZOBSS admin access guard]', err);
  });
})();

