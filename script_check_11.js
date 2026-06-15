
(function(){
  if(window.__azAffiliateAdminSoftwareCategoryRuntime) return;
  window.__azAffiliateAdminSoftwareCategoryRuntime=true;

  function isCategorySelect(sel){
    if(!sel || sel.tagName!=='SELECT') return false;
    const text=(sel.textContent||'').toLowerCase();
    const id=((sel.id||'')+' '+(sel.name||'')+' '+(sel.className||'')).toLowerCase();
    return id.includes('category') || text.includes('mobile & accessories') || text.includes('computer & accessories');
  }

  function addSoftwareOption(sel){
    if(!isCategorySelect(sel)) return;
    const has=[...sel.options].some(o=>(o.textContent||'').trim().toLowerCase()==='software' || String(o.value||'').toLowerCase()==='software');
    if(has) return;

    const opt=document.createElement('option');
    opt.value='software';
    opt.textContent='Software';

    const mobile=[...sel.options].find(o=>(o.textContent||'').trim().toLowerCase()==='mobile & accessories');
    if(mobile) sel.insertBefore(opt,mobile);
    else sel.insertBefore(opt,sel.firstChild);
  }

  function run(){
    document.querySelectorAll('select').forEach(addSoftwareOption);
  }

  document.addEventListener('DOMContentLoaded',run);
  if(document.readyState!=='loading') run();
  [300,800,1500,3000].forEach(t=>setTimeout(run,t));
  new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
})();
