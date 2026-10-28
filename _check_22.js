
(function(){
  if(window.__azobssAdminChatUseNormalIconFlowFix) return;
  window.__azobssAdminChatUseNormalIconFlowFix = true;

  function apply(){
    if(document.body.getAttribute('data-dashboard-page') !== 'admin'
      && !document.body.classList.contains('is-admin')
      && !document.body.classList.contains('az-role-is-admin')) return;

    var tools=document.querySelector('.market-user-tools');
    if(tools){
      tools.style.setProperty('display','flex','important');
      tools.style.setProperty('align-items','center','important');
      tools.style.setProperty('gap','8px','important');
    }

    document.querySelectorAll('.market-user-tools a[aria-label="Chat"]').forEach(function(el){
      el.classList.add('market-icon-btn');
      el.style.setProperty('display','inline-flex','important');
      el.style.setProperty('align-items','center','important');
      el.style.setProperty('justify-content','center','important');
      el.style.setProperty('position','relative','important');
      el.style.setProperty('flex','0 0 auto','important');
      el.style.setProperty('width','32px','important');
      el.style.setProperty('min-width','32px','important');
      el.style.setProperty('max-width','32px','important');
      el.style.setProperty('height','32px','important');
      el.style.setProperty('min-height','32px','important');
      el.style.setProperty('max-height','32px','important');
      el.style.setProperty('padding','0','important');
      el.style.setProperty('margin','0','important');
      el.style.setProperty('border','0','important');
      el.style.setProperty('background','transparent','important');
      el.style.setProperty('visibility','visible','important');
      el.style.setProperty('opacity','1','important');
      el.style.setProperty('pointer-events','auto','important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('transform','none','important');
      el.removeAttribute('aria-hidden');
      el.tabIndex=0;

      var svg=el.querySelector('svg');
      if(svg){
        svg.style.setProperty('width','23px','important');
        svg.style.setProperty('height','23px','important');
        svg.style.setProperty('display','block','important');
        svg.style.setProperty('margin','0','important');
      }
    });
  }

  document.addEventListener('DOMContentLoaded',apply);
  if(document.readyState!=='loading') apply();
  window.addEventListener('focus',apply);
  setTimeout(apply,200);
  setTimeout(apply,800);
  setTimeout(apply,1500);
})();
