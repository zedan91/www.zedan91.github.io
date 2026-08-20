import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azCleanSupportNotificationFinal) return;
  window.__azCleanSupportNotificationFinal=true;

  const firebaseConfig={
    apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain:'azobss.firebaseapp.com',
    projectId:'azobss',
    storageBucket:'azobss.firebasestorage.app',
    messagingSenderId:'159277716405',
    appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
  };

  const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
  const auth=getAuth(app);
  const db=getFirestore(app);
  const ADMIN_EMAIL='zedan91@azobss.local';
  let currentUser=null;
  let isAdmin=false;

  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function toast(msg){ if(window.azShowToast) window.azShowToast(msg); else if(window.showToast) window.showToast(msg); else alert(msg); }
  function adminNow(){
    const email=String(currentUser?.email||auth.currentUser?.email||'').toLowerCase();
    return isAdmin || email===ADMIN_EMAIL || document.body.classList.contains('azobss-support-admin') || (document.body.innerText||'').toLowerCase().includes('hello, zedan91');
  }
  function openModal(id){document.getElementById(id)?.classList.add('is-open');}
  function closeModal(id){document.getElementById(id)?.classList.remove('is-open');}

  function ensureStyle(){
    if(document.getElementById('azobss-clean-support-css')) return;
    const st=document.createElement('style');
    st.id='azobss-clean-support-css';
    st.textContent=`
.azobss-modal-lite{position:fixed;inset:0;z-index:9999999;display:none;align-items:center;justify-content:center;background:rgba(2,6,23,.72);backdrop-filter:blur(8px);padding:18px}
.azobss-modal-lite.is-open{display:flex}
.azobss-modal-card{width:min(560px,calc(100vw - 26px));max-height:86vh;overflow:auto;border-radius:22px;border:1px solid rgba(148,163,184,.3);background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98));box-shadow:0 30px 90px rgba(0,0,0,.55);color:#fff;padding:18px}
.azobss-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.azobss-modal-head h3{margin:0;font-size:20px;font-weight:950}
.azobss-modal-close{border:0;background:rgba(255,255,255,.08);color:#fff;width:34px;height:34px;border-radius:12px;cursor:pointer;font-size:18px}
.azobss-lite-input,.azobss-lite-textarea,.azobss-lite-select{width:100%;box-sizing:border-box;margin:7px 0 10px;padding:11px 12px;border-radius:13px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.85);color:#fff;outline:none}
.azobss-lite-textarea{min-height:95px;resize:vertical}
.azobss-lite-btn{border:0;border-radius:13px;padding:11px 14px;font-weight:900;cursor:pointer;background:#22c55e;color:#052e16}
.azobss-lite-btn.secondary{background:rgba(148,163,184,.18);color:#e5e7eb}
.azobss-lite-list{display:grid;gap:10px;margin-top:12px}
.azobss-lite-item{border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.62);border-radius:15px;padding:12px}
.azobss-lite-item strong{display:block;margin-bottom:5px}
.azobss-lite-meta{font-size:12px;color:#93c5fd;margin-top:6px}
.azobss-lite-reply{margin-top:8px;padding:9px;border-radius:12px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25)}
.azobss-lite-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.azobss-admin-only-lite{display:none}
body.azobss-support-admin .azobss-admin-only-lite{display:block}
`;
    document.head.appendChild(st);
  }

  function ensureModals(){
    ensureStyle();
    if(document.getElementById('azSupportModal')) return;
    const div=document.createElement('div');
    div.innerHTML=`
<div id="azSupportModal" class="azobss-modal-lite">
  <div class="azobss-modal-card">
    <div class="azobss-modal-head"><h3>💬 Contact Admin / Support</h3><button class="azobss-modal-close" data-close="azSupportModal">×</button></div>
    <form id="azSupportForm" novalidate>
      <input id="azSupportSubject" class="azobss-lite-input" maxlength="90" placeholder="Subject">
      <textarea id="azSupportMessage" class="azobss-lite-textarea" maxlength="1000" placeholder="Write your message to admin..."></textarea>
      <button class="azobss-lite-btn" type="submit">Send Message</button>
    </form>
    <div class="azobss-admin-only-lite"><hr style="border-color:rgba(148,163,184,.2);margin:16px 0"><h3 style="margin:0 0 8px">Admin Support Inbox</h3></div>
    <div id="azSupportList" class="azobss-lite-list"></div>
  </div>
</div>

<div id="azBellModal" class="azobss-modal-lite">
  <div class="azobss-modal-card">
    <div class="azobss-modal-head"><h3>🔔 Notifications</h3><button class="azobss-modal-close" data-close="azBellModal">×</button></div>
    <div class="azobss-admin-only-lite">
      <h4 style="margin:0 0 8px">Create Announcement</h4>
      <form id="azNotificationForm" novalidate>
        <select id="azNotificationType" class="azobss-lite-select">
          <option value="lucky_started">Lucky Draw Started</option>
          <option value="lucky_ending">Lucky Draw Ending Soon</option>
          <option value="maintenance">Website Maintenance Tonight</option>
          <option value="payment_verified">Payment Verified</option>
          <option value="download_ready">Download Ready</option>
        </select>
        <input id="azNotificationTitle" class="azobss-lite-input" maxlength="100" placeholder="Notification title">
        <textarea id="azNotificationBody" class="azobss-lite-textarea" maxlength="700" placeholder="Notification message"></textarea>
        <button id="azPublishNotificationBtn" class="azobss-lite-btn" type="button">Publish Notification</button>
      </form>
      <hr style="border-color:rgba(148,163,184,.2);margin:16px 0">
    </div>
    <div id="azNotificationList" class="azobss-lite-list"></div>
  </div>
</div>`;
    document.body.appendChild(div);
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
    document.querySelectorAll('.azobss-modal-lite').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('is-open')}));
    document.getElementById('azSupportForm').addEventListener('submit',submitSupport);
    document.getElementById('azPublishNotificationBtn').addEventListener('click',publishNotification);
  }

  async function submitSupport(e){
    e.preventDefault();
    if(!currentUser){toast('Please login first.');return;}
    const subject=document.getElementById('azSupportSubject').value.trim()||'Support Request';
    const message=document.getElementById('azSupportMessage').value.trim();
    if(!message){toast('Please write your message.');return;}
    try{
      await addDoc(collection(db,'supportMessages'),{
        uid:currentUser.uid,email:currentUser.email||'',username:window.azobssCurrentUsername||currentUser.displayName||currentUser.email||'User',
        subject,message,reply:'',status:'open',createdAt:serverTimestamp(),createdAtMs:Date.now(),repliedAt:null
      });
      document.getElementById('azSupportSubject').value='';
      document.getElementById('azSupportMessage').value='';
      toast('Message sent to admin.');
      loadSupport(); if(window.azUpdateChatBadge) setTimeout(window.azUpdateChatBadge,800);
    }catch(err){console.error('AZOBSS support send failed:',err);alert('Support message failed: '+(err.message||err.code||err));}
  }

  async function loadSupport(){
    const box=document.getElementById('azSupportList');
    if(!box) return;
    if(!currentUser){box.innerHTML='<div class="azobss-lite-item">Please login to contact admin.</div>';return;}
    box.innerHTML='<div class="azobss-lite-item">Loading...</div>';
    try{
      let snap;
      if(adminNow()) snap=await getDocs(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)));
      else snap=await getDocs(query(collection(db,'supportMessages'),where('uid','==',currentUser.uid),orderBy('createdAtMs','desc'),limit(20)));
      const rows=[];
      snap.forEach(d=>{
        const x=d.data();
        rows.push(`<div class="azobss-lite-item" data-support-id="${d.id}" data-support-uid="${esc(x.uid||'')}"><strong>${esc(x.subject||'Support Request')}</strong><div>${esc(x.message||'')}</div>${x.reply?`<div class="azobss-lite-reply"><b>Admin Reply:</b><br>${esc(x.reply)}</div>`:''}<div class="azobss-lite-meta">${esc(x.status||'open')} • ${esc(x.email||'')}</div>${adminNow()?`<div class="azobss-lite-row" style="margin-top:8px"><input class="azobss-lite-input" id="reply_${d.id}" placeholder="Reply..." style="margin:0;flex:1"><button class="azobss-lite-btn secondary" data-reply-id="${d.id}" type="button">Reply</button></div>`:''}</div>`);
      });
      box.innerHTML=rows.join('')||'<div class="azobss-lite-item">No support messages.</div>';
      box.querySelectorAll('[data-reply-id]').forEach(btn=>btn.addEventListener('click',async()=>{
        const id=btn.dataset.replyId, inp=document.getElementById('reply_'+id), reply=(inp?.value||'').trim();
        if(!reply){toast('Write a reply first.');return;}
        await updateDoc(doc(db,'supportMessages',id),{reply,status:'replied',repliedAt:serverTimestamp(),repliedAtMs:Date.now()});
        toast('Reply saved.'); loadSupport(); if(window.azUpdateChatBadge) setTimeout(window.azUpdateChatBadge,800);
      }));
    }catch(err){console.error('AZOBSS support load failed:',err);box.innerHTML='<div class="azobss-lite-item">Unable to load support messages: '+esc(err.message||err.code||err)+'</div>';}
  }

  async function publishNotification(e){
    if(e){e.preventDefault();e.stopPropagation();}
    console.log('AZOBSS CLEAN Publish Notification clicked');
    if(!adminNow()){alert('Admin only. Please login as zedan91.');return;}
    const type=document.getElementById('azNotificationType').value||'maintenance';
    const title=document.getElementById('azNotificationTitle').value.trim();
    const body=document.getElementById('azNotificationBody').value.trim();
    if(!title && !body){alert('Please write notification title or message.');return;}
    try{
      const payload={active:true,scope:'all',type,title:title||type.replaceAll('_',' '),body,createdAtMs:Date.now(),createdAt:serverTimestamp(),createdBy:currentUser?.email||'admin',createdByUid:currentUser?.uid||''};
      const ref=await addDoc(collection(db,'notifications'),payload);
      console.log('AZOBSS CLEAN notification published OK:',ref.id,payload);
      toast('Notification published.');
      document.getElementById('azNotificationTitle').value='';
      document.getElementById('azNotificationBody').value='';
      loadNotifications(); if(window.azobssUpdateBellBadge) setTimeout(window.azobssUpdateBellBadge,800);
    }catch(err){console.error('AZOBSS notification publish failed:',err);alert('Notification publish failed: '+(err.message||err.code||err));}
  }

  async function loadNotifications(){
    const box=document.getElementById('azNotificationList');
    if(!box) return;
    box.innerHTML='<div class="azobss-lite-item">Loading...</div>';
    try{
      let snap;
      try{snap=await getDocs(query(collection(db,'notifications'),where('active','==',true),orderBy('createdAtMs','desc'),limit(20)));}
      catch(e){console.warn('AZOBSS notification indexed query failed, fallback:',e);snap=await getDocs(collection(db,'notifications'));}
      const rows=[];
      snap.forEach(d=>{
        const x=d.data();
        if(x.active!==true) return;
        if(x.scope==='user' && x.uid && currentUser?.uid!==x.uid && !adminNow()) return;
        rows.push(x);
      });
      rows.sort((a,b)=>Number(b.createdAtMs||0)-Number(a.createdAtMs||0));
      box.innerHTML=rows.slice(0,20).map(x=>`<div class="azobss-lite-item"><strong>${esc(x.title||'Notification')}</strong><div>${esc(x.body||'')}</div><div class="azobss-lite-meta">${esc(x.type||'system')}</div></div>`).join('')||'<div class="azobss-lite-item">No notifications available.</div>';
    }catch(err){console.error('AZOBSS notification load failed:',err);box.innerHTML='<div class="azobss-lite-item">Unable to load notifications: '+esc(err.message||err.code||err)+'</div>';}
  }

  function bindIcons(){
    const bell=document.querySelector(
      '.market-user-tools [aria-label="Notifications"],header [aria-label="Notifications"],[data-az-notification-toggle],[title="Notifications"]:not(#azRadioToggle):not(.az-radio-pill)'
    );
    const chat=document.querySelector(
      '.market-user-tools [aria-label="Chat"],.market-user-tools [aria-label="Contact Admin / Support"],header [aria-label="Chat"],[data-az-open-support],[title="Contact Admin / Support"]:not(#azRadioToggle):not(.az-radio-pill)'
    );
    if(bell && !bell.closest('.az-radio-player') && bell.dataset.azCleanBell!=='1'){
      bell.dataset.azCleanBell='1';
      bell.title='Notifications';
      bell.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openModal('azBellModal');loadNotifications();},true);
    }
    if(chat && !chat.closest('.az-radio-player') && chat.dataset.azCleanChat!=='1'){
      chat.dataset.azCleanChat='1';
      chat.title='Contact Admin / Support';
      chat.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openModal('azSupportModal');loadSupport();},true);
    }
  }

  window.azobssLoadNotifications=loadNotifications;
  window.azobssLoadSupportMessages=loadSupport;
  window.azobssPublishNotificationDirect=publishNotification;

  onAuthStateChanged(auth,user=>{
    currentUser=user||null;
    isAdmin=!!(user && String(user.email||'').toLowerCase()===ADMIN_EMAIL);
    document.body.classList.toggle('azobss-support-admin',adminNow());
    ensureModals(); bindIcons();
  });

  document.addEventListener('DOMContentLoaded',()=>{ensureModals();bindIcons();});
  if(document.readyState!=='loading'){ensureModals();bindIcons();}
  [300,800,1500,3000].forEach(t=>setTimeout(()=>{ensureModals();bindIcons();},t));
  new MutationObserver(()=>{ensureModals();bindIcons();}).observe(document.documentElement,{childList:true,subtree:true});
})();
//# sourceURL=/assets/js/home-deferred/support-notification-v705.js
