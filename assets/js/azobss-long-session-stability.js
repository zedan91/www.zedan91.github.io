/* AZOBSS v1223 Long Session Stability Fix
 * Firefox/Chromium long-idle self-heal:
 * - pauses/throttles AZOBSS polling while hidden/idle
 * - refreshes auth token after a long background sleep
 * - clears orphan hidden overlays that can block every click
 * - emits azobss:session-resume and wakes resize/focus listeners
 */
(function(){
  'use strict';
  if(window.__AZOBSS_LONG_SESSION_STABILITY_1223__) return;
  window.__AZOBSS_LONG_SESSION_STABILITY_1223__ = true;

  var nativeSetInterval = window.setInterval.bind(window);
  var nativeSetTimeout = window.setTimeout.bind(window);
  var lastInteraction = Date.now();
  var hiddenAt = document.hidden ? Date.now() : 0;
  var lastRecovery = 0;
  var LONG_SLEEP_MS = 5 * 60 * 1000;

  function touch(){ lastInteraction = Date.now(); }
  ['pointerdown','keydown','touchstart','wheel','mousemove'].forEach(function(type){
    try{ window.addEventListener(type, touch, {passive:true, capture:true}); }catch(_e){}
  });

  window.azobssLongSessionInterval = function(callback, delay){
    var args = Array.prototype.slice.call(arguments, 2);
    var ms = Math.max(10, Number(delay) || 0);
    if(typeof callback !== 'function') return nativeSetInterval(callback, ms);
    var lastRun = 0;
    return nativeSetInterval(function(){
      if(document.hidden) return;
      var now = Date.now();
      var idle = now - lastInteraction;
      var minGap = ms;
      // DOM/layout polling does not need to run every second while nobody is using the page.
      if(idle > 10 * 60 * 1000 && ms < 15000) minGap = 15000;
      else if(idle > 3 * 60 * 1000 && ms < 5000) minGap = 5000;
      if(now - lastRun + 4 < minGap) return;
      lastRun = now;
      try{ callback.apply(window, args); }
      catch(error){ nativeSetTimeout(function(){ throw error; }, 0); }
    }, ms);
  };

  function activeModalExists(){
    try{
      return !!document.querySelector([
        '.auth-modal.is-open:not([aria-hidden="true"])',
        '.azobss-modal-lite.is-open',
        '#azobssMyPurchasesModal.is-open',
        'dialog[open]',
        '.swal2-container.swal2-shown',
        '.modal.show'
      ].join(','));
    }catch(_e){ return false; }
  }

  function markNoPointer(el){
    if(!el || el === document.body || el === document.documentElement) return false;
    try{
      el.style.setProperty('pointer-events','none','important');
      el.dataset.azobssOrphanOverlayRecovered = '1223';
      return true;
    }catch(_e){ return false; }
  }

  function cleanupKnownHiddenOverlays(){
    var fixed = 0;
    var selectors = [
      '.auth-modal[aria-hidden="true"]',
      '.auth-modal:not(.is-open)',
      '.azobss-modal-lite:not(.is-open)',
      '#azobssMyPurchasesModal:not(.is-open)',
      '.food-menu-admin-modal[hidden]',
      '.az1197-staff-crop-modal[hidden]',
      '.modal-backdrop[aria-hidden="true"]',
      '[data-azobss-overlay][aria-hidden="true"]'
    ];
    try{
      document.querySelectorAll(selectors.join(',')).forEach(function(el){
        if(markNoPointer(el)) fixed++;
      });
      document.querySelectorAll('[hidden]').forEach(function(el){
        try{
          var cs = getComputedStyle(el);
          if(cs.pointerEvents !== 'none' && (cs.position === 'fixed' || cs.position === 'absolute')){
            if(markNoPointer(el)) fixed++;
          }
        }catch(_e){}
      });
    }catch(_e){}
    return fixed;
  }

  function looksLikeOrphanBlocker(el){
    if(!el || el === document.body || el === document.documentElement) return false;
    try{
      var node = el;
      for(var i=0; i<5 && node && node !== document.body; i++, node=node.parentElement){
        var cs = getComputedStyle(node);
        var r = node.getBoundingClientRect();
        var covers = r.width >= innerWidth * 0.72 && r.height >= innerHeight * 0.72;
        var fixed = cs.position === 'fixed' || cs.position === 'absolute';
        var semanticHidden = node.hidden || node.getAttribute('aria-hidden') === 'true';
        var known = node.matches && node.matches('.auth-modal,.azobss-modal-lite,.modal-backdrop,[class*="overlay"],[class*="backdrop"]');
        var inactiveKnown = known && !node.classList.contains('is-open') && !node.classList.contains('show') && !node.classList.contains('open') && !node.classList.contains('active');
        if(covers && fixed && cs.pointerEvents !== 'none' && (semanticHidden || inactiveKnown)) return node;
      }
    }catch(_e){}
    return false;
  }

  function cleanupViewportBlocker(){
    var points = [
      [innerWidth * .5, innerHeight * .5],
      [innerWidth * .25, innerHeight * .35],
      [innerWidth * .75, innerHeight * .35]
    ];
    var fixed = 0;
    points.forEach(function(p){
      try{
        var top = document.elementFromPoint(p[0], p[1]);
        var orphan = looksLikeOrphanBlocker(top);
        if(orphan && markNoPointer(orphan)) fixed++;
      }catch(_e){}
    });
    return fixed;
  }

  function restorePagePointerState(){
    if(activeModalExists()) return;
    try{
      var html = document.documentElement;
      var body = document.body;
      if(html && getComputedStyle(html).pointerEvents === 'none') html.style.setProperty('pointer-events','auto','important');
      if(body && getComputedStyle(body).pointerEvents === 'none') body.style.setProperty('pointer-events','auto','important');
    }catch(_e){}
  }

  async function refreshAuthAfterSleep(){
    try{
      if(typeof window.azobssGetFirebaseAuthHeaders === 'function'){
        await Promise.race([
          window.azobssGetFirebaseAuthHeaders(true),
          new Promise(function(resolve){ nativeSetTimeout(resolve, 8000); })
        ]);
      }else if(window.firebase && window.firebase.auth){
        var u = window.firebase.auth().currentUser;
        if(u && typeof u.getIdToken === 'function') await u.getIdToken(true);
      }
    }catch(_e){}
  }

  function softRecover(reason, sleptMs){
    var now = Date.now();
    if(now - lastRecovery < 1500) return;
    lastRecovery = now;
    cleanupKnownHiddenOverlays();
    cleanupViewportBlocker();
    restorePagePointerState();
    try{ window.dispatchEvent(new Event('resize')); }catch(_e){}
    try{ window.dispatchEvent(new Event('focus')); }catch(_e){}
    try{
      document.dispatchEvent(new CustomEvent('azobss:session-resume', {detail:{reason:reason || 'resume', sleptMs:Number(sleptMs)||0, version:1223}}));
    }catch(_e){}
    if((Number(sleptMs)||0) >= LONG_SLEEP_MS) refreshAuthAfterSleep();
    nativeSetTimeout(function(){ cleanupKnownHiddenOverlays(); cleanupViewportBlocker(); restorePagePointerState(); }, 350);
    nativeSetTimeout(function(){ cleanupKnownHiddenOverlays(); cleanupViewportBlocker(); restorePagePointerState(); }, 1800);
  }

  function onVisibility(){
    if(document.hidden){ hiddenAt = Date.now(); return; }
    var slept = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    touch();
    if(slept >= 30000) softRecover('visibility', slept);
    else { cleanupKnownHiddenOverlays(); cleanupViewportBlocker(); }
  }

  try{ document.addEventListener('visibilitychange', onVisibility, {passive:true}); }catch(_e){}
  try{ window.addEventListener('pageshow', function(e){ softRecover(e && e.persisted ? 'bfcache' : 'pageshow', 0); }, {passive:true}); }catch(_e){}
  try{ window.addEventListener('online', function(){ softRecover('online', 0); }, {passive:true}); }catch(_e){}

  // Conservative watchdog. It only disables semantically hidden/inactive full-screen blockers.
  nativeSetInterval(function(){
    if(document.hidden) return;
    cleanupKnownHiddenOverlays();
    cleanupViewportBlocker();
  }, 30000);

  function installCssGuard(){
    if(document.getElementById('azobss-long-session-style-1223')) return;
    var style = document.createElement('style');
    style.id = 'azobss-long-session-style-1223';
    style.textContent = '[hidden]{pointer-events:none!important}.auth-modal[aria-hidden="true"],.auth-modal:not(.is-open),.azobss-modal-lite:not(.is-open),#azobssMyPurchasesModal:not(.is-open){pointer-events:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }
  installCssGuard();
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ cleanupKnownHiddenOverlays(); cleanupViewportBlocker(); }, {once:true});
  else { cleanupKnownHiddenOverlays(); cleanupViewportBlocker(); }
})();
