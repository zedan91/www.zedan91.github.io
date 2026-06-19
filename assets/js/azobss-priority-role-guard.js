// AZOBSS Priority Role Guard 236P1
// Verifies Admin/Staff Dashboard buttons against the current Firebase auth user instead of stale localStorage caches.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azobssPriorityRoleGuard236P1) return;
  window.__azobssPriorityRoleGuard236P1 = true;

  const firebaseConfig={
    apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain:'azobss.firebaseapp.com',
    projectId:'azobss',
    storageBucket:'azobss.firebasestorage.app',
    messagingSenderId:'159277716405',
    appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
  };
  const ADMIN_EMAILS=['zedan9107@gmail.com','zedan91@azobss.local'];
  const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
  const auth=getAuth(app);
  const db=getFirestore(app);
  let currentRole='pending';

  function lower(v){return String(v||'').trim().toLowerCase();}
  function cleanRole(v){return lower(v).replace(/[^a-z]/g,'');}
  function bySel(sel){return Array.from(document.querySelectorAll(sel));}
  function roleFromProfile(profile,user){
    const email=lower(user && user.email);
    if(ADMIN_EMAILS.includes(email)) return 'admin';
    const p=profile||{};
    const pEmail=lower(p.email||p.authEmail||p.realEmail||p.userEmail);
    const pUid=String(p.uid||'');
    const sameUser=!pUid || !user || pUid===String(user.uid||'');
    const role=cleanRole(p.role||p.userRole||p.accountRole||p.type||p.accessRole);
    const username=lower(p.usernameKey||p.username||p.userName||p.id||p.name||p.displayName);
    if(ADMIN_EMAILS.includes(pEmail) && sameUser) return 'admin';
    if(sameUser && username==='zedan91' && (role==='admin' || ADMIN_EMAILS.includes(email))) return 'admin';
    if(sameUser && (role==='staff' || role==='semiadmin' || role==='seller' || role==='editor' || p.staffDashboard===true || p.canAccessStaffDashboard===true || p.canAddSoftware===true || p.isStaff===true || p.staff===true)) return 'staff';
    if(sameUser && p.permissions && Object.values(p.permissions).some(Boolean)) return 'staff';
    return 'none';
  }
  function safeStoredProfiles(user){
    const out=[];
    const email=lower(user && user.email);
    const uid=String(user && user.uid || '');
    ['azobssCurrentUser','azobssUser','azobss_current_user','azobssSavedUser','azobss_user_profile','azobssProfile','currentUser','userProfile','azobss_auth_user','azobssLoginUser','azobss_logged_user'].forEach(k=>{
      try{
        const raw=localStorage.getItem(k)||sessionStorage.getItem(k);
        if(!raw) return;
        const obj=JSON.parse(raw);
        if(!obj || typeof obj!=='object') return;
        const oUid=String(obj.uid||'');
        const oEmail=lower(obj.email||obj.authEmail||obj.realEmail||obj.userEmail);
        if((uid && oUid===uid) || (email && oEmail===email)) out.push(obj);
      }catch(e){}
    });
    return out;
  }
  async function findProfile(user){
    if(!user) return null;
    const stored=safeStoredProfiles(user);
    const candidates=[];
    stored.forEach(p=>{
      [p.usernameKey,p.username,p.userName,p.id,p.name,p.displayName].forEach(v=>{v=lower(v); if(v) candidates.push(v);});
    });
    if(user.displayName) candidates.push(lower(user.displayName));
    if(user.email) candidates.push(lower(user.email.split('@')[0]));
    const unique=[...new Set(candidates.filter(Boolean))];

    // Try direct user doc reads first because Firestore rules usually allow own document reads.
    for(const id of unique){
      try{
        const snap=await getDoc(doc(db,'users',id));
        if(snap.exists()){
          const p={docId:snap.id,id:snap.id,...snap.data()};
          if(roleFromProfile(p,user)!=='none' || String(p.uid||'')===String(user.uid||'')) return p;
        }
      }catch(e){}
    }

    try{
      const snap=await getDocs(query(collection(db,'users'),where('uid','==',user.uid),limit(1)));
      let found=null;
      snap.forEach(d=>{ if(!found) found={docId:d.id,id:d.id,...d.data()}; });
      if(found) return found;
    }catch(e){}

    return stored[0] || null;
  }
  function setButton(el,show){
    if(!el) return;
    if(show){
      el.style.setProperty('display','inline-flex','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('pointer-events','auto','important');
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.removeAttribute('aria-hidden');
      el.tabIndex=0;
    }else{
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.style.setProperty('pointer-events','none','important');
      el.setAttribute('aria-hidden','true');
      el.tabIndex=-1;
    }
  }
  function setClasses(role){
    document.body.classList.toggle('az-role-is-admin',role==='admin');
    document.body.classList.toggle('is-admin',role==='admin');
    document.body.classList.toggle('az-role-is-staff',role==='staff');
    document.body.classList.toggle('az-role-is-stafflike',role==='staff');
    document.body.setAttribute('data-az-current-role',role);
  }
  function applyRole(role){
    currentRole=role;
    setClasses(role);
    bySel('.azAdminDashboardBtn,.admin-dashboard-btn,.market-nav a[href="/admin/"],a[href="/admin/"].azobss-nav-chip').forEach(el=>setButton(el,role==='admin'));
    bySel('.azStaffDashboardBtn,.staff-dashboard-btn,.market-nav a[href="/staff/"],a[href="/staff/"].azobss-nav-chip').forEach(el=>setButton(el,role==='staff'));
    try{
      if(role==='admin') localStorage.setItem('azobss_admin_role_cache','1'); else localStorage.removeItem('azobss_admin_role_cache');
      if(role==='staff') localStorage.setItem('azobss_staff_role_cache','1'); else localStorage.removeItem('azobss_staff_role_cache');
    }catch(e){}
    window.dispatchEvent(new CustomEvent('azobss-priority-role-applied',{detail:{role}}));
  }
  function ensureDashboardOverlay(){
    const path=location.pathname.toLowerCase();
    const required=(path==='/admin/'||path==='/admin/index.html')?'admin':(path==='/staff/'||path==='/staff/index.html')?'staff':'';
    if(!required) return null;
    let o=document.getElementById('azPriorityDashboardGuard236');
    if(!o){
      o=document.createElement('div');
      o.id='azPriorityDashboardGuard236';
      o.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#050b14;color:#fff;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;padding:18px;text-align:center;';
      o.innerHTML='<div style="width:min(460px,94vw);border:1px solid rgba(148,163,184,.28);background:rgba(15,23,42,.96);border-radius:18px;padding:22px;box-shadow:0 22px 70px rgba(0,0,0,.45)"><h2 style="margin:0 0 8px">Checking access...</h2><p style="margin:0;color:#cbd5e1">AZOBSS dashboard role verification.</p><a href="/" style="display:none;margin-top:14px;color:#052e16;background:#22c55e;border-radius:999px;padding:10px 14px;font-weight:900;text-decoration:none">Go Home</a></div>';
      document.body.appendChild(o);
    }
    return {o,required};
  }
  function updateDashboardOverlay(role,verified){
    const g=ensureDashboardOverlay();
    if(!g) return;
    const h=g.o.querySelector('h2');
    const p=g.o.querySelector('p');
    const a=g.o.querySelector('a');
    if(verified && role===g.required){ g.o.remove(); return; }
    if(verified){
      if(h) h.textContent='Access Restricted';
      if(p) p.textContent='This dashboard is for '+g.required+' only. Current role: '+role+'.';
      if(a) a.style.display='inline-flex';
    }
  }
  function earlyHide(){
    setClasses('none');
    bySel('.azAdminDashboardBtn,.admin-dashboard-btn,.market-nav a[href="/admin/"],a[href="/admin/"].azobss-nav-chip,.azStaffDashboardBtn,.staff-dashboard-btn,.market-nav a[href="/staff/"],a[href="/staff/"].azobss-nav-chip').forEach(el=>setButton(el,false));
  }
  earlyHide();
  ensureDashboardOverlay();
  onAuthStateChanged(auth,async user=>{
    if(!user){ applyRole('none'); updateDashboardOverlay('none',true); return; }
    let profile=null;
    try{ profile=await findProfile(user); }catch(e){ console.warn('AZOBSS priority role lookup skipped:', e?.code||e?.message||e); }
    const role=roleFromProfile(profile,user);
    applyRole(role);
    updateDashboardOverlay(role,true);
  });
  function reapply(){
    if(currentRole==='pending'){ earlyHide(); updateDashboardOverlay('pending',false); return; }
    applyRole(currentRole);
    updateDashboardOverlay(currentRole,true);
  }
  document.addEventListener('DOMContentLoaded',reapply);
  if(document.readyState!=='loading') reapply();
  [80,250,700,1400,2500,5000].forEach(t=>setTimeout(reapply,t));
  new MutationObserver(reapply).observe(document.documentElement,{childList:true,subtree:true});
})();
