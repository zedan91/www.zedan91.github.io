
(function(){
  if(window.__azobssAdminWhatsappCleanUpdater) return;
  window.__azobssAdminWhatsappCleanUpdater = true;

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

  function hideWhatsapp(){
    document.querySelectorAll('.market-nav a').forEach(function(a){
      if(!a.matches('a[href*="alvo.chat"]') && !a.querySelector('.nav-whatsapp-circle')) return;
      a.style.setProperty('display','none','important');
      a.style.setProperty('visibility','hidden','important');
      a.style.setProperty('width','0','important');
      a.style.setProperty('min-width','0','important');
      a.style.setProperty('height','0','important');
      a.style.setProperty('min-height','0','important');
      a.style.setProperty('padding','0','important');
      a.style.setProperty('margin','0','important');
      a.style.setProperty('border','0','important');
      a.style.setProperty('overflow','hidden','important');
      a.style.setProperty('pointer-events','none','important');
      a.style.setProperty('opacity','0','important');
      a.setAttribute('aria-hidden','true');
      a.tabIndex=-1;
    });
  }

  function apply(){
    try{
      if(adminNow()){
        localStorage.setItem('azobss_admin_role_cache','1');
        document.documentElement.classList.add('azobss-admin-cache');
        hideWhatsapp();
      }else{
        setTimeout(function(){
          if(!adminNow()){
            localStorage.removeItem('azobss_admin_role_cache');
            document.documentElement.classList.remove('azobss-admin-cache');
          }
        },2500);
      }
    }catch(e){}
  }

  document.addEventListener('DOMContentLoaded',apply);
  if(document.readyState!=='loading') apply();
  window.addEventListener('focus',apply);
  setTimeout(apply,120);
  setTimeout(apply,500);
  setTimeout(apply,1200);
})();
