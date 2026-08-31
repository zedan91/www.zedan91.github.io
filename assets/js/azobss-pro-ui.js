
/* Logout is handled only by azobss-global-auth.js. Do not bind it here. */

(function(){
  'use strict';
  function lockPaBmTab(){
    if(document.getElementById('azobss-pa-bm-js-lock')) return;
    var style=document.createElement('style');
    style.id='azobss-pa-bm-js-lock';
    style.textContent='.market-nav .nav-pa-bm-link[hidden],.market-nav .nav-pa-bm-link.is-hidden,a#paBmNavButton[hidden],a#paBmNavButton.is-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important;}';
    document.head.appendChild(style);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', lockPaBmTab); else lockPaBmTab();
})();


(function(){
  'use strict';
  var folderMap = {
    '/PA-BM/':'/PA-BM/',
    '/Software-Tools/':'/Software-Tools/',
    '/CAD-Tools-&-Resources/':'/CAD-Tools-&-Resources/',
    '/affiliate-shop/':'/affiliate-shop/',
    '/lucky-draw/':'/lucky-draw/',
    '/tools/':'/tools/'
  };
  var path = window.location.pathname;
  if (folderMap[path]) {
    history.replaceState(null, document.title, folderMap[path] + window.location.search + window.location.hash);
    path = window.location.pathname;
  }
  if (window.location.hash === '/') {
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }
  function cleanLinks(){
    document.querySelectorAll('a[href]').forEach(function(a){
      var href = a.getAttribute('href') || '';
      Object.keys(folderMap).forEach(function(oldPath){
        var clean = folderMap[oldPath];
        href = href.replace(oldPath, clean).replace(oldPath.replace(/^\//,''), clean.replace(/^\//,''));
      });
      if (href === '/') href = '/';
      a.setAttribute('href', href);
    });
  }
  function setActive(){
    var p = window.location.pathname.replace(/index\.html$/,'');
    document.querySelectorAll('.market-nav a').forEach(function(a){
      var h = (a.getAttribute('href') || '').replace(/https?:\/\/[^/]+/,'').replace(/index\.html$/,'');
      a.classList.remove('is-active','market-nav-primary');
      if ((p === '/' && h === '/') || (h !== '/' && p.indexOf(h) === 0)) a.classList.add('is-active');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ cleanLinks(); setActive(); });
  } else { cleanLinks(); setActive(); }
})();



/* Account dropdown click/menu/logout is handled only by assets/js/azobss-global-auth.js.
   Removed duplicate azobss-pro-ui dropdown handler to prevent conflicts. */

(function(){
  'use strict';
  var ACCOUNT_NUMBER = '162405194110';

  function fallbackCopy(text){
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch(e) { ok = false; }
    textarea.remove();
    return ok;
  }

  async function copyText(text){
    if(navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return true;
    }
    return fallbackCopy(text);
  }

  function showStatus(statusEl, message, isError){
    if(!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    statusEl.style.opacity = '1';
    statusEl.style.color = isError ? '#ffb4b4' : '#86efac';
    window.clearTimeout(statusEl._azobssTimer);
    statusEl._azobssTimer = window.setTimeout(function(){
      statusEl.style.opacity = '0';
    }, 2200);
  }

  function isCopyAccountButton(el){
    if(!el) return false;
    if(el.id === 'copyAccountButton' || el.id === 'copyAccountBtn') return true;
    if(el.matches && el.matches('[data-copy-account-number]')) return true;
    var text = (el.textContent || '').trim().toLowerCase();
    return text === 'copy account number' || text === 'copy account no.' || text === 'copy account no';
  }

  function bindCopyAccountButtons(){
    document.addEventListener('click', async function(event){
      var btn = event.target.closest('button, a');
      if(!isCopyAccountButton(btn)) return;

      event.preventDefault();
      event.stopPropagation();

      var oldText = btn.textContent;
      var statusEl = document.getElementById('qrCopyStatus') || btn.closest('.payment-qr-card, .purchase-qr-card, aside, section')?.querySelector('.qr-copy-status');

      try{
        var copied = await copyText(ACCOUNT_NUMBER);
        if(!copied) throw new Error('copy_failed');
        btn.textContent = '✓ Copied';
        showStatus(statusEl, 'Account number copied: ' + ACCOUNT_NUMBER, false);
      }catch(error){
        console.error('Copy account number failed:', error);
        btn.textContent = 'Copy failed';
        showStatus(statusEl, 'Failed to copy. Account number: ' + ACCOUNT_NUMBER, true);
        window.prompt('Copy account number manually:', ACCOUNT_NUMBER);
      }finally{
        window.clearTimeout(btn._azobssCopyTimer);
        btn._azobssCopyTimer = window.setTimeout(function(){
          btn.textContent = oldText || 'Copy Account Number';
        }, 1600);
      }
    }, false);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindCopyAccountButtons);
  else bindCopyAccountButtons();
})();


// AZOBSS 1052: delayed PRO UI dropdown CSS injection disabled; static stable CSS is loaded in <head>.





