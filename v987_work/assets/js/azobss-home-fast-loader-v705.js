/* AZOBSS Patch 705 - non-blocking homepage startup */
(function(){
  'use strict';
  if(window.__azobssHomeFastLoader705) return;
  window.__azobssHomeFastLoader705 = true;

  const jobs = new Map();
  const ready = new Set();
  const later = (fn, timeout) => {
    if('requestIdleCallback' in window) return requestIdleCallback(fn, {timeout: timeout || 1800});
    return setTimeout(fn, Math.min(timeout || 800, 1200));
  };
  const importOnce = (key, url) => {
    if(jobs.has(key)) return jobs.get(key);
    const p = import(url).then(value=>{ready.add(key);return value;}).catch(err => { jobs.delete(key); console.warn('AZOBSS deferred module skipped:', key, err); throw err; });
    jobs.set(key, p);
    return p;
  };
  const loadAuth = () => importOnce('auth','/assets/js/azobss-global-auth.js?v=705');
  const loadLikes = () => importOnce('likes','/assets/js/azobss-home-likes-lite.js?v=705');
  const loadCart = () => importOnce('cart','/assets/js/home-deferred/cart-firestore-sync-v705.js?v=705');
  const loadPromo = () => importOnce('promo','/assets/js/home-deferred/home-software-promo-v705.js?v=705');
  const loadRadio = () => {
    if(jobs.has('radio')) return jobs.get('radio');
    const p = new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='/assets/js/azobss-radio-player.js?v=705';
      s.async=true;
      s.onload=()=>{ready.add('radio');resolve();};
      s.onerror=(err)=>{jobs.delete('radio');reject(err);};
      document.head.appendChild(s);
    });
    jobs.set('radio',p);
    return p;
  };
  const loadSupport = () => {
    if(jobs.has('support-all')) return jobs.get('support-all');
    const p = importOnce('support-main','/assets/js/home-deferred/support-notification-v705.js?v=705')
      .then(()=>Promise.allSettled([
        importOnce('bell-badge','/assets/js/home-deferred/bell-badge-v705.js?v=705'),
        importOnce('chat-badge','/assets/js/home-deferred/chat-badge-v705.js?v=705'),
        importOnce('admin-clear','/assets/js/home-deferred/admin-clear-notifications-v705.js?v=705'),
        importOnce('support-delete','/assets/js/home-deferred/support-delete-message-v705.js?v=705')
      ]));
    p.then(()=>ready.add('support-all')).catch(()=>jobs.delete('support-all'));
    jobs.set('support-all',p);
    return p;
  };

  // Make login/register responsive even if the auth bundle has not finished loading.
  document.addEventListener('click', function(event){
    const button=event.target && event.target.closest ? event.target.closest('#siteSignInButton,#siteSignUpButton,[data-open-auth],[data-auth-mode]') : null;
    if(!button || ready.has('auth')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    loadAuth().then(()=>setTimeout(()=>button.click(),0)).catch(()=>{});
  }, true);

  // Notification/chat modules are fetched on demand, not during the first paint.
  document.addEventListener('click', function(event){
    const target=event.target && event.target.closest ? event.target.closest('[aria-label="Notifications"],[title="Notifications"],[data-az-notification-toggle],[aria-label="Chat"],[aria-label="Contact Admin / Support"],[title="Contact Admin / Support"],[data-az-open-support]') : null;
    if(!target || ready.has('support-all')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    loadSupport().then(()=>setTimeout(()=>target.click(),0)).catch(()=>{});
  }, true);

  // Radio is loaded on first use. Existing playback is restored shortly after paint.
  document.addEventListener('click', function(event){
    const target=event.target && event.target.closest ? event.target.closest('#azRadioToggle,.az-radio-pill,[data-az-radio-toggle]') : null;
    if(!target || ready.has('radio')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    loadRadio().then(()=>setTimeout(()=>target.click(),0)).catch(()=>{});
  }, true);

  function startAfterFirstPaint(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      loadAuth().catch(()=>{});
      later(()=>loadLikes().catch(()=>{}), 1500);
      later(()=>loadCart().catch(()=>{}), 2800);
      later(()=>loadSupport().catch(()=>{}), 6500);

      const promo=document.getElementById('azHomeSoftwarePromo529');
      if(promo && 'IntersectionObserver' in window){
        const io=new IntersectionObserver(entries=>{
          if(entries.some(x=>x.isIntersecting || x.intersectionRatio>0)){
            io.disconnect();
            loadPromo().catch(()=>{});
          }
        },{rootMargin:'500px 0px'});
        io.observe(promo);
        setTimeout(()=>{io.disconnect();loadPromo().catch(()=>{});},5000);
      }else{
        later(()=>loadPromo().catch(()=>{}),4200);
      }

      try{
        const raw=localStorage.getItem('azobss_radio_state_v1') || localStorage.getItem('azobssRadioState') || '';
        if(raw && /"playing"\s*:\s*true/i.test(raw)) setTimeout(()=>loadRadio().catch(()=>{}),700);
      }catch(_e){}
    }));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startAfterFirstPaint,{once:true});
  else startAfterFirstPaint();
})();
