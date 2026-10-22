
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azobssAdminStaffMessageBadgeFirestoreFix) return;
  window.__azobssAdminStaffMessageBadgeFirestoreFix = true;

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
    const chat=document.querySelector('a[aria-label="Chat"]');
    if(!chat) return null;
    chat.setAttribute('href','#');
    chat.removeAttribute('target');
    chat.removeAttribute('rel');
    chat.style.position='relative';

    let badge=chat.querySelector('[data-az-message-badge]');
    if(!badge){
      badge=document.createElement('span');
      badge.className='az-message-badge';
      badge.setAttribute('data-az-message-badge','1');
      badge.textContent='0';
      chat.insertBefore(badge, chat.firstChild);
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

  function isUnreadSupportMessage(x){
    const status=String(x.status||'open').toLowerCase();
    const reply=String(x.reply||x.adminReply||x.response||'').trim();
    const readByAdmin = x.readByAdmin === true || x.adminRead === true || x.isRead === true;
    if(status === 'closed' || status === 'done' || status === 'resolved') return false;
    if(!reply) return true;
    return !readByAdmin && (status === 'open' || status === 'pending' || status === 'new');
  }

  async function refreshBadge(){
    try{
      const snap=await getDocs(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(99)));
      let count=0;
      snap.forEach(d=>{
        const x=d.data()||{};
        if(isUnreadSupportMessage(x)) count++;
      });
      setBadge(count);
    }catch(err){
      console.warn('AZOBSS message badge failed:',err);
      setBadge(0);
    }
  }

  window.azobssRefreshMessageBadge = refreshBadge;

  document.addEventListener('DOMContentLoaded',()=>{ ensureBadge(); refreshBadge(); });
  window.addEventListener('load',()=>{ ensureBadge(); refreshBadge(); });
  window.addEventListener('focus', refreshBadge);
  if(document.readyState!=='loading'){ ensureBadge(); refreshBadge(); }

  document.addEventListener('click', e=>{
    const chat=e.target.closest('a[aria-label="Chat"]');
    if(!chat) return;
    setTimeout(refreshBadge, 800);
  }, true);
})();
