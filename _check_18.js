
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azobssAdminStaffNotifBadgeFirestoreFix) return;
  window.__azobssAdminStaffNotifBadgeFirestoreFix = true;

  const firebaseConfig={
    apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain:'azobss.firebaseapp.com',
    projectId:'azobss',
    storageBucket:'azobss.firebasestorage.app',
    messagingSenderId:'159277716405',
    appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
  };

  const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
  const db=getFirestore(app);

  function ensureBadge(){
    const bell=document.querySelector('a[aria-label="Notifications"]');
    if(!bell) return null;
    bell.setAttribute('href','#');
    bell.removeAttribute('target');
    bell.removeAttribute('rel');
    bell.style.position='relative';

    let badge=bell.querySelector('[data-az-notification-badge]');
    if(!badge){
      badge=document.createElement('span');
      badge.className='az-notification-badge';
      badge.setAttribute('data-az-notification-badge','1');
      bell.insertBefore(badge,bell.firstChild);
    }
    return badge;
  }

  function setBadge(n){
    const badge=ensureBadge();
    if(!badge) return;
    n=Number(n||0);
    if(!Number.isFinite(n) || n<0) n=0;
    badge.textContent=n>99?'99+':String(n);
    badge.classList.toggle('is-visible', n>0);
    badge.style.display=n>0?'inline-flex':'none';
  }

  async function refreshBadge(){
    try{
      let snap;
      try{
        snap=await getDocs(query(collection(db,'notifications'),where('active','==',true),orderBy('createdAtMs','desc'),limit(99)));
      }catch(e){
        snap=await getDocs(query(collection(db,'notifications'),limit(99)));
      }
      let count=0;
      snap.forEach(d=>{
        const x=d.data()||{};
        if(x.active===false) return;
        count++;
      });
      setBadge(count);
    }catch(err){
      console.warn('AZOBSS notification badge failed:',err);
      setBadge(0);
    }
  }

  window.azobssRefreshNotificationBadge = refreshBadge;

  document.addEventListener('DOMContentLoaded',()=>{ ensureBadge(); refreshBadge(); });
  window.addEventListener('load',()=>{ ensureBadge(); refreshBadge(); });
  window.addEventListener('focus', refreshBadge);
  if(document.readyState!=='loading'){ ensureBadge(); refreshBadge(); }

  document.addEventListener('click', e=>{
    const bell=e.target.closest('a[aria-label="Notifications"]');
    if(!bell) return;
    setTimeout(refreshBadge, 800);
  }, true);
})();
