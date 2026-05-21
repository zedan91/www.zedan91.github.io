
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


(function(){
  'use strict';
  function ensureAccountMenu(){
    document.querySelectorAll('.user-menu').forEach(function(menu){
      var dropdown = menu.querySelector('.user-dropdown');
      if (!dropdown) return;
      if (!dropdown.dataset.azobssNormalized) {
        dropdown.dataset.azobssNormalized = '1';
        dropdown.innerHTML = '<div class="user-dropdown-section">Buying</div>'+
          '<a class="user-dropdown-item" href="/#purchases" role="menuitem">My purchases</a>'+
          '<a class="user-dropdown-item" href="/likes/" role="menuitem">Likes</a>'+
          '<div class="user-dropdown-section">Account</div>'+
          '<button class="user-dropdown-item" id="profileSettingsButton" type="button" role="menuitem">Settings</button>'+
          '<button class="user-dropdown-item" id="logoutButton" type="button" role="menuitem">Log out</button>';
      }
    });
  }
  function closeAll(except){
    document.querySelectorAll('.user-menu.is-open').forEach(function(menu){
      if (menu !== except) {
        menu.classList.remove('is-open');
        menu.setAttribute('aria-expanded','false');
      }
    });
  }
  function injectDropdownFixCss(){
    if (document.getElementById('azobss-account-dropdown-fix')) return;
    var style = document.createElement('style');
    style.id = 'azobss-account-dropdown-fix';
    style.textContent = '.market-sticky-bar,.market-bar-inner,.market-main-row,.market-user-tools,.user-menu{overflow:visible!important;}'+
      '.user-menu{position:relative!important;cursor:pointer!important;}'+
      '.user-menu .user-dropdown{position:absolute!important;top:calc(100% + 10px)!important;right:0!important;display:none!important;z-index:99999!important;min-width:220px!important;border-radius:14px!important;background:#08111f!important;border:1px solid rgba(148,163,184,.25)!important;box-shadow:0 18px 50px rgba(0,0,0,.55)!important;padding:8px!important;}'+
      '.user-menu.is-open .user-dropdown{display:block!important;}'+
      '.user-dropdown-item{box-sizing:border-box!important;}';
    document.head.appendChild(style);
  }
  function bindAccountDropdown(){
    injectDropdownFixCss();
    ensureAccountMenu();
    document.addEventListener('click', function(event){
      var menu = event.target.closest('.user-menu');
      if (menu) {
        if (event.target.closest('.user-dropdown')) return;
        event.preventDefault();
        event.stopPropagation();
        var opened = menu.classList.toggle('is-open');
        menu.setAttribute('aria-expanded', opened ? 'true' : 'false');
        closeAll(menu);
        return;
      }
      closeAll(null);
    }, false);
    document.addEventListener('keydown', function(event){
      if (event.key === 'Escape') closeAll(null);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAccountDropdown);
  else bindAccountDropdown();
})();

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
    }, true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindCopyAccountButtons);
  else bindCopyAccountButtons();
})();


// AZOBSS_FINAL_MOBILE_DROPDOWN_FIX_PRO_UI
(function(){
  try{
    var css='\n/* AZOBSS FINAL MOBILE ACCOUNT DROPDOWN FIX */\n.market-sticky-bar,\n.market-bar-inner,\n.market-main-row,\n.market-user-tools,\n.user-menu{\n  overflow:visible !important;\n}\n.user-menu{\n  position:relative !important;\n  z-index:100000 !important;\n}\n.user-menu .user-dropdown,\n#userDropdown{\n  position:absolute !important;\n  top:calc(100% + 10px) !important;\n  right:0 !important;\n  left:auto !important;\n  width:220px !important;\n  min-width:220px !important;\n  max-width:calc(100vw - 16px) !important;\n  padding:8px !important;\n  border-radius:14px !important;\n  background:#08111f !important;\n  border:1px solid rgba(148,163,184,.28) !important;\n  box-shadow:0 18px 50px rgba(0,0,0,.58) !important;\n  z-index:100001 !important;\n  transform:none !important;\n}\n.user-menu:not(.is-open) .user-dropdown{display:none !important;}\n.user-menu.is-open .user-dropdown{display:block !important;}\n.user-dropdown-section{\n  padding:7px 10px 4px !important;\n  font-size:11px !important;\n  line-height:1.1 !important;\n}\n.user-dropdown-item{\n  min-height:38px !important;\n  padding:9px 10px !important;\n  font-size:13px !important;\n  line-height:1.15 !important;\n  border-radius:10px !important;\n}\n@media (max-width:768px){\n  .user-menu .user-dropdown,\n  #userDropdown{\n    position:fixed !important;\n    top:92px !important;\n    right:8px !important;\n    left:auto !important;\n    width:210px !important;\n    min-width:210px !important;\n    max-width:calc(100vw - 16px) !important;\n    max-height:68vh !important;\n    overflow-y:auto !important;\n    border-radius:14px !important;\n  }\n  .user-dropdown-section{\n    padding:7px 10px 4px !important;\n    font-size:10.5px !important;\n  }\n  .user-dropdown-item{\n    padding:9px 10px !important;\n    font-size:13px !important;\n    min-height:36px !important;\n  }\n}\n@media (max-width:420px){\n  .user-menu .user-dropdown,\n  #userDropdown{\n    top:88px !important;\n    right:6px !important;\n    width:196px !important;\n    min-width:196px !important;\n  }\n}\n';
    function apply(){
      if(document.getElementById('azobss-final-mobile-dropdown-fix-pro-ui')) return;
      var style=document.createElement('style');
      style.id='azobss-final-mobile-dropdown-fix-pro-ui';
      style.textContent=css;
      document.head.appendChild(style);
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
  }catch(e){}
})();
