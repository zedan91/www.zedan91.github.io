
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azSupportDeleteMessageUserAdminFinal) return;
  window.__azSupportDeleteMessageUserAdminFinal = true;

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

  function canDeleteItem(item){
    if(isAdmin()) return true;
    const uid = String(auth.currentUser?.uid || '');
    const owner = String(item?.dataset?.supportUid || '');
    return !!uid && !!owner && uid === owner;
  }

  function toast(msg){
    if(window.azShowToast) window.azShowToast(msg);
    else if(window.showToast) window.showToast(msg);
    else alert(msg);
  }

  function addDeleteButtons(){
    const uid = String(auth.currentUser?.uid || '');
    if(!uid && !isAdmin()) return;

    document.querySelectorAll('#azSupportList .azobss-lite-item').forEach(item=>{
      if(item.querySelector('.az-support-delete-one')) return;

      const id = item.dataset.supportId || item.querySelector('[data-reply-id]')?.dataset?.replyId;
      if(!id) return;
      if(!canDeleteItem(item)) return;

      item.style.position = 'relative';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'az-support-delete-one';
      btn.dataset.supportDeleteId = id;
      btn.innerHTML = '×';
      btn.title = 'Delete message';
      btn.setAttribute('aria-label','Delete message');
      btn.style.cssText = 'position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:999px;border:1px solid rgba(239,68,68,.45);background:rgba(239,68,68,.16);color:#fecaca;font-size:18px;font-weight:900;line-height:22px;cursor:pointer;z-index:3;display:flex;align-items:center;justify-content:center;';

      btn.addEventListener('click', async function(e){
        e.preventDefault();
        e.stopPropagation();

        if(!canDeleteItem(item)){
          alert('You can only delete your own support message.');
          return;
        }

        const ok = confirm('Delete this support message?');
        if(!ok) return;

        try{
          await deleteDoc(doc(db,'supportMessages',id));
          item.remove();
          toast('Support message deleted.');
          if(typeof window.azobssLoadSupportMessages === 'function'){
            setTimeout(window.azobssLoadSupportMessages, 300);
          }
          if(typeof window.azUpdateChatBadge === 'function'){
            setTimeout(window.azUpdateChatBadge, 600);
          }
        }catch(err){
          console.error('AZOBSS delete support message failed:', err);
          alert('Delete failed: ' + (err.message || err.code || err));
        }
      });

      item.appendChild(btn);
    });
  }

  const mo = new MutationObserver(addDeleteButtons);
  document.addEventListener('DOMContentLoaded',()=>{
    addDeleteButtons();
    const list=document.getElementById('azSupportList');
    if(list) mo.observe(list,{childList:true,subtree:true});
  });
  if(document.readyState !== 'loading'){
    addDeleteButtons();
    const list=document.getElementById('azSupportList');
    if(list) mo.observe(list,{childList:true,subtree:true});
  }

  setInterval(addDeleteButtons, 1200);
})();
