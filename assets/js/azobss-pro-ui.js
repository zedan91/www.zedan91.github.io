
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
          '<a class="user-dropdown-item" href="/affiliate-shop/#likes" role="menuitem">Likes</a>'+
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
