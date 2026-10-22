
(function(){
  if(window.__azobssAdminStaffChatToggleFinalFix) return;
  window.__azobssAdminStaffChatToggleFinalFix = true;

  function modal(){
    return document.getElementById('azSupportModal');
  }

  function setClosed(m){
    if(!m) return;
    m.classList.remove('is-open','open','active');
    m.hidden = false;
    m.removeAttribute('hidden');
  }

  function setOpen(m){
    if(!m) return;
    m.classList.add('is-open');
    m.hidden = false;
    m.removeAttribute('hidden');
    if(typeof window.azobssLoadSupportMessages === 'function'){
      try{ window.azobssLoadSupportMessages(); }catch(e){}
    }
  }

  function toggle(){
    var m = modal();
    if(!m){
      setTimeout(function(){
        var mm = modal();
        if(mm) setOpen(mm);
      }, 120);
      return;
    }
    if(m.classList.contains('is-open')) setClosed(m);
    else setOpen(m);
  }

  function bind(){
    document.querySelectorAll('a[aria-label="Chat"], .market-icon-btn[aria-label="Chat"]').forEach(function(a){
      a.setAttribute('href','#');
      a.removeAttribute('target');
      a.removeAttribute('rel');
      a.removeAttribute('data-az-open-support');

      if(a.dataset.azSupportToggleFinalBound === '1') return;
      a.dataset.azSupportToggleFinalBound = '1';

      a.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        if(e.stopImmediatePropagation) e.stopImmediatePropagation();
        toggle();
        return false;
      }, true);
    });
  }

  document.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('load', bind);
  if(document.readyState !== 'loading') bind();
  setTimeout(bind, 300);
  setTimeout(bind, 1000);
})();
