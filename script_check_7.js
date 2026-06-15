
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
 if(window.__azChatBadgeAdminUserFinal) return;
 window.__azChatBadgeAdminUserFinal=true;

 const app=getApps().length?getApps()[0]:initializeApp({
 apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
 authDomain:'azobss.firebaseapp.com',
 projectId:'azobss',
 storageBucket:'azobss.firebasestorage.app',
 messagingSenderId:'159277716405',
 appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'
 });

 const auth=getAuth(app);
 const db=getFirestore(app);
 const USER_KEY='azobss_support_seen_at_user_v2';
 const ADMIN_KEY='azobss_support_seen_at_admin_v2';

 function isAdmin(){
   return document.body.classList.contains('azobss-support-admin')
     || (document.body.innerText||'').toLowerCase().includes('hello, zedan91')
     || String(auth.currentUser?.email||'').toLowerCase()==='zedan91@azobss.local';
 }

 function getChat(){
   let chat=document.querySelector('[title="Contact Admin / Support"],[title="Contact Admin"],[title="Support"]');
   if(chat) return chat;
   const candidates=[...document.querySelectorAll('header button,header a,.topbar button,.topbar a,.floating-nav button,.floating-nav a,.market-icon-btn,.nav-icon,.icon-btn,[role="button"]')].filter(el=>{
     const r=el.getBoundingClientRect();
     return r.width>=12 && r.height>=12 && r.top<95 && r.left>window.innerWidth*0.55;
   });
   const iconEls=candidates.filter(el=>el.querySelector('svg') || (el.textContent||'').trim()==='');
   if(iconEls.length>=1) return iconEls[iconEls.length-1];
   return null;
 }

 function badge(){
   const chat=getChat();
   if(!chat) return null;
   let b=chat.querySelector('#azChatUnreadBadge');
   if(!b){
      chat.style.position='relative';
      b=document.createElement('span');
      b.id='azChatUnreadBadge';
      chat.appendChild(b);
   }
   return b;
 }

 async function update(){
   const b=badge();
   if(!b || !auth.currentUser){ if(b)b.style.display='none'; return; }

   const admin=isAdmin();
   const seen=Number(localStorage.getItem(admin?ADMIN_KEY:USER_KEY)||0);
   let count=0;

   try{
      let snap;
      if(admin){
        try{
          snap=await getDocs(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)));
        }catch(e){
          snap=await getDocs(collection(db,'supportMessages'));
        }
        snap.forEach(d=>{
          const x=d.data();
          const ms=Number(x.createdAtMs||0);
          const status=String(x.status||'open').toLowerCase();
          const reply=String(x.reply||'').trim();
          if(ms>seen && (!reply || status==='open')) count++;
        });
      }else{
        try{
          snap=await getDocs(query(collection(db,'supportMessages'),where('uid','==',auth.currentUser.uid),orderBy('createdAtMs','desc'),limit(50)));
        }catch(e){
          snap=await getDocs(collection(db,'supportMessages'));
        }
        snap.forEach(d=>{
          const x=d.data();
          if(String(x.uid||'')!==String(auth.currentUser.uid)) return;
          const reply=String(x.reply||'').trim();
          const repliedAt=Number(x.repliedAtMs||x.updatedAtMs||x.createdAtMs||0);
          if(reply && repliedAt>seen) count++;
        });
      }

      if(count>0){
        b.textContent=String(Math.min(count,99));
        b.style.display='block';
      }else{
        b.style.display='none';
      }
   }catch(e){
      console.warn('AZOBSS chat badge update failed:',e);
      if(b) b.style.display='none';
   }
 }

 function markSeen(){
   localStorage.setItem(isAdmin()?ADMIN_KEY:USER_KEY,String(Date.now()));
   const b=badge(); if(b) b.style.display='none';
 }

 document.addEventListener('click',e=>{
   const chat=getChat();
   if(chat && (e.target===chat || chat.contains(e.target))){
      markSeen();
      setTimeout(update,1200);
   }
 },true);

 window.azUpdateChatBadge=update;
 window.azMarkSupportSeen=markSeen;

 document.addEventListener('DOMContentLoaded',()=>setTimeout(update,1500));
 if(document.readyState!=='loading') setTimeout(update,1500);
 setTimeout(update,3000);
 setTimeout(update,6000);
 setInterval(update,15000);
})();
