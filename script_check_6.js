
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azBellBadgeFirestoreFinal) return;
  window.__azBellBadgeFirestoreFinal = true;

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
  const SEEN_KEY = 'azobss_notifications_seen_at_v2';

  function getBell(){
    let bell = document.querySelector('[title="Notifications"][data-az-clean-bell="1"],[title="Notifications"]');
    if(bell) return bell;

    const candidates=[...document.querySelectorAll('header button,header a,.topbar button,.topbar a,.floating-nav button,.floating-nav a,.market-icon-btn,.nav-icon,.icon-btn,[role="button"]')].filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width>=12 && r.height>=12 && r.top<95 && r.left>window.innerWidth*0.55;
    });
    const iconEls=candidates.filter(el=>el.querySelector('svg') || (el.textContent||'').trim()==='');
    if(iconEls.length>=2) return iconEls[iconEls.length-2];
    return null;
  }

  function ensureBadge(){
    const bell=getBell();
    if(!bell) return null;
    let b=bell.querySelector('#azBellUnreadBadge');
    if(!b){
      b=document.createElement('span');
      b.id='azBellUnreadBadge';
      b.style.cssText='position:absolute;z-index:999999999;display:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;line-height:18px;text-align:center;box-shadow:0 0 0 2px rgba(2,6,23,.95);pointer-events:none;top:-7px;right:-8px;';
      bell.style.position='relative';
      bell.appendChild(b);
    }
    return b;
  }

  function positionBadge(){
    return;
  }

  async function fetchUnreadCount(){
    const seen=Number(localStorage.getItem(SEEN_KEY)||0);
    let snap;
    try{
      snap=await getDocs(query(collection(db,'notifications'),where('active','==',true),orderBy('createdAtMs','desc'),limit(50)));
    }catch(e){
      console.warn('AZOBSS bell badge indexed read failed, fallback:',e);
      snap=await getDocs(collection(db,'notifications'));
    }

    let count=0;
    const uid=auth.currentUser?.uid||'';
    snap.forEach(d=>{
      const x=d.data();
      if(x.active!==true) return;
      if(x.scope==='user' && x.uid && x.uid!==uid) return;
      const ms=Number(x.createdAtMs||0);
      if(ms>seen) count++;
    });
    return count;
  }

  async function updateBadge(){
    const bell=getBell();
    const badge=ensureBadge();
    if(!bell){badge.style.display='none';return;}
    positionBadge();
    try{
      const count=await fetchUnreadCount();
      if(count>0){
        badge.textContent=String(Math.min(count,99));
        badge.style.display='block';
      }else{
        badge.style.display='none';
      }
    }catch(err){
      console.warn('AZOBSS bell badge update failed:',err);
      badge.style.display='none';
    }
  }

  function markSeen(){
    localStorage.setItem(SEEN_KEY,String(Date.now()));
    const badge=ensureBadge();
    badge.style.display='none';
  }

  document.addEventListener('click',function(e){
    const bell=getBell();
    if(bell && (e.target===bell || bell.contains(e.target))){
      markSeen();
      setTimeout(updateBadge,1200);
    }
  },true);

  window.azobssUpdateBellBadge = updateBadge;
  window.azobssMarkNotificationsSeen = markSeen;

  document.addEventListener('DOMContentLoaded',()=>setTimeout(updateBadge,1000));
  if(document.readyState!=='loading') setTimeout(updateBadge,1000);
  window.addEventListener('resize',positionBadge);
  window.addEventListener('scroll',positionBadge,true);
  setInterval(updateBadge,60000);
  setTimeout(updateBadge,2500);
  setTimeout(updateBadge,5000);
})();
