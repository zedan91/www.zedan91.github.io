
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, orderBy, limit, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azAdminClearNotificationsFinal) return;
  window.__azAdminClearNotificationsFinal = true;

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

  function isAdmin(){
    return document.body.classList.contains('azobss-support-admin')
      || String(auth.currentUser?.email||'').toLowerCase()==='zedan91@azobss.local'
      || (document.body.innerText||'').toLowerCase().includes('hello, zedan91');
  }

  function toast(msg){
    if(window.azShowToast) window.azShowToast(msg);
    else if(window.showToast) window.showToast(msg);
    else alert(msg);
  }

  async function clearNotifications(){
    if(!isAdmin()){
      alert('Admin only.');
      return;
    }

    const ok = confirm('Delete all notifications? This cannot be undone.');
    if(!ok) return;

    try{
      let total = 0;
      while(true){
        const snap = await getDocs(query(collection(db,'notifications'), orderBy('createdAtMs','desc'), limit(50)));
        if(snap.empty) break;

        const jobs = [];
        snap.forEach(d=>{
          total++;
          jobs.push(deleteDoc(doc(db,'notifications',d.id)));
        });

        await Promise.all(jobs);
        if(snap.size < 50) break;
      }

      localStorage.setItem('azobss_notifications_seen_at_v2', String(Date.now()));

      if(typeof window.azobssLoadNotifications === 'function'){
        await window.azobssLoadNotifications();
      }

      if(typeof window.azobssUpdateBellBadge === 'function'){
        setTimeout(window.azobssUpdateBellBadge, 500);
      }

      const badge = document.getElementById('azBellUnreadBadge');
      if(badge) badge.style.display = 'none';

      toast('Notifications cleared: ' + total);
    }catch(err){
      console.error('AZOBSS clear notifications failed:', err);
      alert('Clear notifications failed: ' + (err.message || err.code || err));
    }
  }

  function ensureButton(){
    const form = document.getElementById('azNotificationForm');
    if(!form || !isAdmin()) return;
    if(document.getElementById('azClearNotificationsBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'azClearNotificationsBtn';
    btn.type = 'button';
    btn.className = 'azobss-lite-btn secondary';
    btn.style.marginLeft = '8px';
    btn.style.background = 'rgba(239,68,68,.18)';
    btn.style.color = '#fecaca';
    btn.style.border = '1px solid rgba(239,68,68,.35)';
    btn.textContent = 'Clear Notifications';
    btn.addEventListener('click', clearNotifications);

    const publish = form.querySelector('#azPublishNotificationBtn, button');
    if(publish && publish.parentNode){
      publish.insertAdjacentElement('afterend', btn);
    }else{
      form.appendChild(btn);
    }
  }

  document.addEventListener('DOMContentLoaded', ensureButton);
  if(document.readyState !== 'loading') ensureButton();
  [500,1500,3000,5000].forEach(t=>setTimeout(ensureButton,t));
  new MutationObserver(ensureButton).observe(document.documentElement,{childList:true,subtree:true});

  window.azobssClearNotifications = clearNotifications;
})();
