/* AZOBSS v1470 - Phone Mobile/Desktop View Switcher
 * Gives phone users an explicit Desktop View / Mobile View toggle.
 * Preference persists across AZOBSS pages via localStorage.
 */
(function(){
  'use strict';

  var STORAGE_KEY = 'azobssPreferredViewMode';
  var BUTTON_ID = 'azobssViewModeSwitcher';
  var STYLE_ID = 'azobssViewModeSwitcherStyle';
  var DESKTOP_WIDTH = 1280;

  var initialViewportWidth = Math.max(280, Number(window.innerWidth || (window.screen && window.screen.width) || 390));

  function isPhone(){
    var ua = String(navigator.userAgent || '');
    var shortSide = Math.min(
      Number((window.screen && window.screen.width) || initialViewportWidth || 9999),
      Number((window.screen && window.screen.height) || initialViewportWidth || 9999)
    );
    var mobileUa = /iPhone|iPod|Mobile|IEMobile|Opera Mini/i.test(ua) || (/Android/i.test(ua) && shortSide <= 700);
    var coarse = false;
    try { coarse = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch(_e) {}
    return mobileUa || (coarse && shortSide <= 700);
  }

  if(!isPhone()) return;

  function getViewportMeta(){
    var meta = document.querySelector('meta[name="viewport"]');
    if(!meta){
      meta = document.createElement('meta');
      meta.setAttribute('name','viewport');
      (document.head || document.documentElement).appendChild(meta);
    }
    if(!meta.getAttribute('data-azobss-original-content')){
      meta.setAttribute('data-azobss-original-content', meta.getAttribute('content') || 'width=device-width, initial-scale=1, viewport-fit=cover');
    }
    return meta;
  }

  function readMode(){
    try {
      return localStorage.getItem(STORAGE_KEY) === 'desktop' ? 'desktop' : 'mobile';
    } catch(_e) {
      return 'mobile';
    }
  }

  function writeMode(mode){
    try { localStorage.setItem(STORAGE_KEY, mode); } catch(_e) {}
  }

  function desktopScale(){
    return Math.max(0.25, Math.min(0.80, initialViewportWidth / DESKTOP_WIDTH));
  }

  function applyViewport(mode){
    var meta = getViewportMeta();
    if(mode === 'desktop'){
      var scale = desktopScale();
      meta.setAttribute('content',
        'width=' + DESKTOP_WIDTH +
        ', initial-scale=' + scale.toFixed(3) +
        ', minimum-scale=0.25, maximum-scale=5, user-scalable=yes, viewport-fit=cover'
      );
      document.documentElement.setAttribute('data-azobss-view-mode','desktop');
      document.documentElement.classList.add('azobss-phone-desktop-view');
      document.documentElement.classList.remove('azobss-phone-mobile-view');
    }else{
      meta.setAttribute('content', meta.getAttribute('data-azobss-original-content') || 'width=device-width, initial-scale=1, viewport-fit=cover');
      document.documentElement.setAttribute('data-azobss-view-mode','mobile');
      document.documentElement.classList.add('azobss-phone-mobile-view');
      document.documentElement.classList.remove('azobss-phone-desktop-view');
    }
  }

  var currentMode = readMode();
  applyViewport(currentMode);

  function ensureStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ''+
      '#'+BUTTON_ID+'{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:2147469000;display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:9px 12px;border:1px solid rgba(96,165,250,.52);border-radius:999px;background:rgba(8,18,34,.94);color:#f8fafc;box-shadow:0 7px 22px rgba(0,0,0,.32);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.01em;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;}'+
      '#'+BUTTON_ID+':active{filter:brightness(1.12);}'+
      '#'+BUTTON_ID+' .az-view-icon{font-size:16px;line-height:1;}'+
      '#'+BUTTON_ID+' .az-view-label{display:inline-block;}'+
      'html.azobss-phone-desktop-view body{min-width:'+DESKTOP_WIDTH+'px;}'+
      '@media print{#'+BUTTON_ID+'{display:none!important;}}';
    (document.head || document.documentElement).appendChild(style);
  }

  function syncButton(btn){
    var desktop = currentMode === 'desktop';
    var label = desktop ? 'Mobile View' : 'Desktop View';
    var icon = desktop ? '📱' : '🖥️';
    btn.innerHTML = '<span class="az-view-icon" aria-hidden="true">'+icon+'</span><span class="az-view-label">'+label+'</span>';
    btn.setAttribute('aria-label', desktop ? 'Switch to mobile view' : 'Switch to desktop view');
    btn.setAttribute('title', desktop ? 'Kembali ke Mobile View' : 'Tukar ke Desktop View');
    btn.setAttribute('aria-pressed', desktop ? 'true' : 'false');

    if(desktop){
      var scale = desktopScale();
      var inv = 1 / scale;
      btn.style.transformOrigin = 'left bottom';
      btn.style.transform = 'scale('+inv.toFixed(3)+')';
      btn.style.left = (12 * inv).toFixed(1) + 'px';
      btn.style.bottom = (12 * inv).toFixed(1) + 'px';
    }else{
      btn.style.transform = '';
      btn.style.transformOrigin = '';
      btn.style.left = '12px';
      btn.style.bottom = 'calc(12px + env(safe-area-inset-bottom,0px))';
    }
  }

  function mount(){
    ensureStyle();
    var btn = document.getElementById(BUTTON_ID);
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = BUTTON_ID;
      document.body.appendChild(btn);
      btn.addEventListener('click', function(){
        currentMode = currentMode === 'desktop' ? 'mobile' : 'desktop';
        writeMode(currentMode);
        applyViewport(currentMode);
        syncButton(btn);
        // Reload once so every responsive component recalculates from the selected viewport.
        window.setTimeout(function(){ window.location.reload(); }, 80);
      });
    }
    syncButton(btn);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();

  window.addEventListener('pageshow', function(){
    currentMode = readMode();
    applyViewport(currentMode);
    var btn = document.getElementById(BUTTON_ID);
    if(btn) syncButton(btn);
  });
})();
