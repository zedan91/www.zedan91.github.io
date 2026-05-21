
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
