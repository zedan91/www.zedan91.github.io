
(function(){
  if(window.__azobssHideWhatsappAdminOnlySafeFinal) return;
  window.__azobssHideWhatsappAdminOnlySafeFinal = true;

  function adminNow(){
    try{
      if(document.body.getAttribute('data-dashboard-page')==='admin') return true;
      if(document.body.classList.contains('is-admin') || document.body.classList.contains('az-role-is-admin')) return true;
      if(document.body.getAttribute('data-role')==='admin') return true;
      var signed=String((document.querySelector('#signedInName')||{}).textContent||'').trim().toLowerCase();
      var uname=String((document.querySelector('.user-name')||{}).textContent||'').trim().toLowerCase();
      if(signed==='zedan91' || uname.indexOf('zedan91')!==-1) return true;
    }catch(e){}
    return false;
  }

  function hideEl(el){
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('width','0','important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('max-width','0','important');
    el.style.setProperty('height','0','important');
    el.style.setProperty('min-height','0','important');
    el.style.setProperty('max-height','0','important');
    el.style.setProperty('padding','0','important');
    el.style.setProperty('margin','0','important');
    el.style.setProperty('border','0','important');
    el.style.setProperty('outline','0','important');
    el.style.setProperty('overflow','hidden','important');
    el.style.setProperty('pointer-events','none','important');
    el.style.setProperty('opacity','0','important');
    el.setAttribute('aria-hidden','true');
    el.tabIndex=-1;
  }

  function showChat(){
    document.querySelectorAll('.market-user-tools a[aria-label="Chat"]').forEach(function(el){
      el.style.setProperty('display','inline-flex','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('width','32px','important');
      el.style.setProperty('min-width','32px','important');
      el.style.setProperty('height','32px','important');
      el.style.setProperty('min-height','32px','important');
      el.style.setProperty('padding','0','important');
      el.style.setProperty('margin','0','important');
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('pointer-events','auto','important');
      el.style.setProperty('overflow','visible','important');
      el.removeAttribute('aria-hidden');
      el.tabIndex=0;
    });
  }

  function apply(){
    if(!adminNow()) return;
    try{ localStorage.setItem('azobss_admin_role_cache','1'); }catch(e){}
    document.documentElement.classList.add('azobss-admin-cache');

    // IMPORTANT: hide only WhatsApp inside left .market-nav, not Chat icon inside .market-user-tools
    document.querySelectorAll('.market-nav .nav-whatsapp-circle, .market-nav a[href*="alvo.chat"]').forEach(hideEl);
    document.querySelectorAll('.market-nav a').forEach(function(a){
      if(a.querySelector('.nav-whatsapp-circle')) hideEl(a);
    });

    showChat();
  }

  document.addEventListener('DOMContentLoaded',apply);
  if(document.readyState!=='loading') apply();
  window.addEventListener('focus',apply);
  setTimeout(apply,50);
  setTimeout(apply,200);
  setTimeout(apply,700);
  setTimeout(apply,1500);
})();
