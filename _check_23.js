
(function(){
 if(window.__azobssAdminStaffBadgeRestore039)return;window.__azobssAdminStaffBadgeRestore039=true;
 function make(a,id){if(!a)return null;var b=a.querySelector('#'+id);if(b)return b;b=document.createElement('span');b.id=id;b.textContent='0';a.appendChild(b);return b}
 function paint(b,n){if(!b)return;n=Math.max(0,Number(n||0));b.textContent=String(n);b.classList.toggle('is-show',n>0);b.style.display=n>0?'inline-flex':'none'}
 function arr(keys){for(var i=0;i<keys.length;i++){try{var raw=localStorage.getItem(keys[i])||sessionStorage.getItem(keys[i]);if(raw){var a=JSON.parse(raw);if(Array.isArray(a))return a}}catch(e){}}return[]}
 function unread(rows,seenKeys){var seen=0;seenKeys.forEach(function(k){seen=Math.max(seen,Number(localStorage.getItem(k)||sessionStorage.getItem(k)||0))});return (rows||[]).filter(function(x){if(!x||x.deleted||x.archived)return false;var t=Number(x.createdAtMs||x.createdAt||x.timeMs||x.timestamp||0);return !t||t>seen}).length}
 function cacheUpdate(){
   var bell=document.querySelector('a[aria-label="Notifications"],button[aria-label="Notifications"]');
   var chat=document.querySelector('a[aria-label="Chat"],button[aria-label="Chat"],a[aria-label="Support"],button[aria-label="Support"]');
   paint(make(bell,'azBellUnreadBadge'),unread(arr(['azobss_notifications_cache','azobss_notifications','notifications_cache','az_notifications_cache']),['azobss_notifications_seen_at_v2','az_notifications_seen_at']));
   paint(make(chat,'supportBadge'),unread(arr(['azobss_support_cache','azobss_support_messages_cache','supportMessages_cache','az_support_cache']),['azobss_support_seen_at_v2','az_support_seen_at']));
 }
 async function liveUpdate(){
   try{
     var db=window.__azFirebaseDb,f=window.__azFirestoreFns||{}; if(!db||!f.collection||!f.getDocs)return;
     async function c(name){try{var ref=f.collection(db,name),q=ref;if(f.query&&f.orderBy&&f.limit)q=f.query(ref,f.orderBy('createdAtMs','desc'),f.limit(30));var s=await f.getDocs(q),n=0;s.forEach(function(){n++});return n}catch(e){console.warn('AZOBSS badge count failed:',name,e&&e.message?e.message:e);return null}}
     var n=await c('notifications'),m=await c('supportMessages');
     var bell=document.querySelector('a[aria-label="Notifications"],button[aria-label="Notifications"]');
     var chat=document.querySelector('a[aria-label="Chat"],button[aria-label="Chat"],a[aria-label="Support"],button[aria-label="Support"]');
     if(typeof n==='number')paint(make(bell,'azBellUnreadBadge'),n);
     if(typeof m==='number')paint(make(chat,'supportBadge'),m);
   }catch(e){}
 }
 function update(){cacheUpdate();setTimeout(liveUpdate,300)}
 document.addEventListener('DOMContentLoaded',update);if(document.readyState!=='loading')update();
 window.addEventListener('focus',update);window.addEventListener('storage',update);window.addEventListener('azobss-notification-updated',update);window.addEventListener('azobss-support-updated',update);
 setTimeout(update,500);setTimeout(update,1800);setTimeout(update,3500);window.azobssLongSessionInterval(update,60000);
})();
