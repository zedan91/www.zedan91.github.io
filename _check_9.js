
(function(){
  if(window.__azAdminOnlineCountSourceFix) return;
  window.__azAdminOnlineCountSourceFix = true;
  window.azAdminRealOnlineCount = 0;
  window.azSetRealOnlineCount = function(n){
    n = Number(n || 0);
    if(!Number.isFinite(n) || n < 0) n = 0;
    window.azAdminRealOnlineCount = n;
    var el = document.getElementById('statOnline');
    if(el) el.textContent = String(n);
  };
})();
