
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





/* AZOBSS SAFE YOUTUBE-STYLE SCROLL NAV FIX (NO-JAM)
   CSS-only: no scroll listener, no MutationObserver, no inline style loop.
*/
(function azobssSafeYoutubeScrollNavFix(){
  try{
    if(document.getElementById('azobss-safe-youtube-scroll-nav-fix')) return;
    var st=document.createElement('style');
    st.id='azobss-safe-youtube-scroll-nav-fix';
    st.textContent = `
      html,body{overflow-x:hidden!important;}
      .market-sticky-bar,
      .market-sticky-bar.scrolled,
      .market-sticky-bar.is-scrolled,
      .market-sticky-bar.shrink,
      .market-sticky-bar.is-shrink,
      .market-sticky-bar.az-shrink,
      .market-sticky-bar.compact,
      body.scrolled .market-sticky-bar,
      body.is-scrolled .market-sticky-bar,
      body.shrink .market-sticky-bar{
        position:fixed!important;
        top:0!important;left:0!important;right:0!important;width:100%!important;
        transform:none!important;scale:1!important;
        min-height:49px!important;height:auto!important;
        transition:background-color .18s ease,box-shadow .18s ease!important;
        z-index:99999!important;
      }
      .market-sticky-bar.scrolled *,
      .market-sticky-bar.is-scrolled *,
      .market-sticky-bar.shrink *,
      .market-sticky-bar.is-shrink *,
      body.scrolled .market-sticky-bar *,
      body.is-scrolled .market-sticky-bar *,
      body.shrink .market-sticky-bar *{
        transform:none!important;scale:1!important;
      }
      .market-bar-inner{min-height:49px!important;transform:none!important;}
      .market-main-row{min-height:48px!important;height:48px!important;align-items:center!important;transform:none!important;}
      .market-nav{
        display:flex!important;flex:1 1 auto!important;min-width:0!important;
        flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;
        white-space:nowrap!important;-webkit-overflow-scrolling:touch!important;scrollbar-width:none!important;
        gap:7px!important;transform:none!important;
      }
      .market-nav::-webkit-scrollbar{display:none!important;}
      .market-nav a,.market-nav button{
        flex:0 0 auto!important;white-space:nowrap!important;
        height:34px!important;min-height:34px!important;max-height:34px!important;
        padding:0 12px!important;font-size:13px!important;line-height:1!important;
        transform:none!important;scale:1!important;
      }
      .market-brand{flex:0 0 auto!important;transform:none!important;}
      .market-user-tools,.site-auth-actions{flex:0 0 auto!important;min-width:max-content!important;transform:none!important;}
      .market-icon-btn,.site-auth-btn,.user-menu{flex:0 0 auto!important;transform:none!important;scale:1!important;}
      @media(max-width:980px){
        body{padding-top:92px!important;}
        .market-sticky-bar{min-height:92px!important;}
        .market-bar-inner{min-height:92px!important;}
        .market-main-row{height:auto!important;min-height:48px!important;flex-wrap:wrap!important;}
        .market-nav{order:3!important;flex:0 0 100%!important;width:100%!important;padding:4px 0 2px!important;}
        .market-nav a,.market-nav button{height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 10px!important;font-size:12px!important;}
      }
      @media(max-width:560px){
        body{padding-top:96px!important;}
        .market-sticky-bar{min-height:96px!important;}
        .market-bar-inner{min-height:96px!important;}
      }
    `;
    (document.head || document.documentElement).appendChild(st);
  }catch(e){}
})();
