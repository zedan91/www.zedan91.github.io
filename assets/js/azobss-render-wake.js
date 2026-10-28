/* AZOBSS v1056 - Smart Render Wake / Cold-Start Prewarm
   Starts the Render cold-start as early as possible on every AZOBSS page.
   It never blocks page actions and uses cross-page cooldowns to avoid request spam. */
(function(){
  'use strict';

  if (window.__AZOBSS_RENDER_WAKE_V1056__) return;
  window.__AZOBSS_RENDER_WAKE_V1056__ = true;

  var VERSION = '1056';
  var MAIN_DEFAULT = 'https://azobss-backend.onrender.com';
  var LUCKY_DEFAULT = 'https://azobss-lucky-draw-api.onrender.com';
  var SUCCESS_TTL = 7 * 60 * 1000;      // Refresh before a typical idle sleep window.
  var ATTEMPT_COOLDOWN = 30 * 1000;     // Cross-page anti-spam guard.
  var ACTIVE_WINDOW = 5 * 60 * 1000;    // Only maintain warmth for an actively used tab.
  var REQUEST_TIMEOUT = 25 * 1000;       // Cold start can take a while on free hosting.

  var mainInFlight = null;
  var luckyInFlight = null;
  var lastUserActivityAt = Date.now();

  function safeGet(key){
    try { return localStorage.getItem(key); } catch(_e) { return null; }
  }
  function safeSet(key, value){
    try { localStorage.setItem(key, String(value)); } catch(_e) {}
  }
  function apiBase(){
    var saved = safeGet('azobssPremiumBackendUrl') || safeGet('azobssSoftwareStatsBackendUrl') || MAIN_DEFAULT;
    return String(saved || MAIN_DEFAULT).replace(/\/$/, '');
  }
  function now(){ return Date.now(); }
  function pathReason(){
    var p = String(location.pathname || '/').replace(/[^a-zA-Z0-9/_-]+/g, '').slice(0, 90);
    return p || '/';
  }
  function keyPrefix(service){ return 'azobssRenderWakeV1056:' + service + ':'; }

  function isStillWarm(service){
    var success = Number(safeGet(keyPrefix(service) + 'success') || 0) || 0;
    return success > 0 && (now() - success) < SUCCESS_TTL;
  }
  function attemptedRecently(service){
    var attempt = Number(safeGet(keyPrefix(service) + 'attempt') || 0) || 0;
    return attempt > 0 && (now() - attempt) < ATTEMPT_COOLDOWN;
  }

  function fetchWake(url, service, reason, force, keepalive){
    if (!force && isStillWarm(service)) return Promise.resolve(false);
    if (!force && attemptedRecently(service)) return Promise.resolve(false);

    safeSet(keyPrefix(service) + 'attempt', now());
    safeSet(keyPrefix(service) + 'reason', String(reason || 'page-entry').slice(0, 120));

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function(){ try{ controller.abort(); }catch(_e){} }, REQUEST_TIMEOUT) : null;
    var opts = {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      keepalive: !!keepalive
    };
    if (controller) opts.signal = controller.signal;

    return fetch(url, opts).then(function(res){
      if (res && res.ok) {
        safeSet(keyPrefix(service) + 'success', now());
        return true;
      }
      return false;
    }).catch(function(){
      return false;
    }).finally(function(){
      if (timer) clearTimeout(timer);
    });
  }

  function wakeMain(reason, force, keepalive){
    if (mainInFlight && !force) return mainInFlight;
    var base = apiBase();
    var url = base + '/health?azobssWake=' + VERSION +
      '&reason=' + encodeURIComponent(String(reason || 'page-entry').slice(0, 100)) +
      '&page=' + encodeURIComponent(pathReason()) + '&t=' + now();
    mainInFlight = fetchWake(url, 'main', reason, !!force, !!keepalive)
      .finally(function(){ mainInFlight = null; });
    return mainInFlight;
  }

  function isLuckyDrawPage(){
    return /(^|\/)lucky-draw(\/|$)/i.test(String(location.pathname || ''));
  }
  function wakeLucky(reason, force, keepalive){
    if (!isLuckyDrawPage()) return Promise.resolve(false);
    if (luckyInFlight && !force) return luckyInFlight;
    var url = LUCKY_DEFAULT + '/api/health?azobssWake=' + VERSION +
      '&reason=' + encodeURIComponent(String(reason || 'page-entry').slice(0, 100)) + '&t=' + now();
    luckyInFlight = fetchWake(url, 'lucky', reason, !!force, !!keepalive)
      .finally(function(){ luckyInFlight = null; });
    return luckyInFlight;
  }

  function wakeAll(reason, force, keepalive){
    var jobs = [wakeMain(reason, force, keepalive)];
    if (isLuckyDrawPage()) jobs.push(wakeLucky(reason, force, keepalive));
    return Promise.all(jobs).then(function(v){ return v.some(Boolean); });
  }

  // Public helper. v1040 alias keeps the existing Software Tools prewarm code compatible.
  window.azobssWakeRenderSmart1056 = function(reason, force){
    return wakeAll(reason || 'manual', !!force, false);
  };
  window.azobssWakeRenderSmart1040 = function(reason, force){
    return window.azobssWakeRenderSmart1056(reason || 'legacy-1040', !!force);
  };
  window.azobssRenderWakeStatus1056 = function(){
    return {
      version: VERSION,
      page: pathReason(),
      mainBase: apiBase(),
      mainLastAttempt: Number(safeGet(keyPrefix('main') + 'attempt') || 0) || 0,
      mainLastSuccess: Number(safeGet(keyPrefix('main') + 'success') || 0) || 0,
      luckyLastSuccess: Number(safeGet(keyPrefix('lucky') + 'success') || 0) || 0,
      active: document.visibilityState === 'visible' && (now() - lastUserActivityAt) < ACTIVE_WINDOW
    };
  };

  // Earliest possible wake: this file is intentionally loaded synchronously near the top of <head>.
  wakeAll('page-entry', false, false);

  // A bfcache restore or returning from ToyyibPay/banking app should refresh the warm state.
  window.addEventListener('pageshow', function(ev){
    if (ev && ev.persisted) wakeAll('pageshow-bfcache', false, false);
  }, {passive:true});

  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') {
      lastUserActivityAt = now();
      wakeAll('tab-visible', false, false);
    }
  });

  function markActivity(){ lastUserActivityAt = now(); }
  ['pointerdown','keydown','touchstart'].forEach(function(type){
    document.addEventListener(type, markActivity, {passive:true, capture:true});
  });

  function isBackendIntent(el){
    if (!el || !el.closest) return false;
    var target = el.closest('a,button,input[type="submit"],[role="button"]');
    if (!target) return false;
    var text = String((target.textContent || target.value || '') + ' ' + (target.getAttribute('aria-label') || '') + ' ' + (target.getAttribute('title') || '')).toLowerCase();
    var href = String(target.getAttribute('href') || '').toLowerCase();
    var cls = String(target.className || '').toLowerCase();
    return /(search|cari|download|muat turun|buy|beli|pay|bayar|payment|checkout|purchase|order|receipt|invoice|verify|submit|generate|export|open payment|complete payment)/i.test(text + ' ' + href + ' ' + cls);
  }

  // Warm on intent before a search/download/payment action is actually clicked.
  document.addEventListener('pointerover', function(e){
    if (isBackendIntent(e.target)) wakeAll('action-hover', false, false);
  }, {passive:true, capture:true});
  document.addEventListener('focusin', function(e){
    if (isBackendIntent(e.target)) wakeAll('action-focus', false, false);
  }, true);
  document.addEventListener('touchstart', function(e){
    if (isBackendIntent(e.target)) wakeAll('action-touch', false, false);
  }, {passive:true, capture:true});

  // Start waking while an internal navigation is already being pressed. keepalive allows
  // the request to continue while the browser leaves the current page.
  document.addEventListener('pointerdown', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin === location.origin) wakeAll('internal-nav', false, true);
    } catch(_e) {}
  }, {passive:true, capture:true});

  // If the customer is actively using a page for a long time, refresh before the backend
  // becomes cold. An unattended/background tab does not keep Render awake indefinitely.
  window.azobssLongSessionInterval(function(){
    if (document.visibilityState !== 'visible') return;
    if ((now() - lastUserActivityAt) > ACTIVE_WINDOW) return;
    if (!isStillWarm('main')) wakeAll('active-session-refresh', false, false);
  }, 60 * 1000);
})();
/* AZOBSS v1324 - Software Tools interaction performance patch */
(function(){
  'use strict';
  var path = String(location.pathname || '');
  if(!/(^|\/)Software-Tools\/?$/i.test(path)) return;
  if(window.__AZOBSS_SOFTWARE_PERF_1324__) return;
  window.__AZOBSS_SOFTWARE_PERF_1324__ = true;

  var nativeRIC = typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback.bind(window)
    : null;
  var nativeCIC = typeof window.cancelIdleCallback === 'function'
    ? window.cancelIdleCallback.bind(window)
    : null;
  var nativeSetTimeout1324 = window.setTimeout.bind(window);
  var nativeClearTimeout1324 = window.clearTimeout.bind(window);
  var nativeRAF1324 = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : function(cb){ return nativeSetTimeout1324(cb, 16); };

  function afterPaint1324(fn){
    nativeRAF1324(function(){
      nativeSetTimeout1324(function(){
        try{ fn(); }catch(_e){}
      }, 0);
    });
  }

  function installPerformanceCss1324(){
    if(document.getElementById('azobss-software-performance-1324-css')) return;
    var style = document.createElement('style');
    style.id = 'azobss-software-performance-1324-css';
    style.textContent = [
      'html.az-software-perf-1324 #softwareAdminModal.software-admin-modal{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(2,6,23,.88)!important;}',
      'html.az-software-perf-1324 #softwareAdminModal .software-admin-panel{contain:layout style;transform:translateZ(0);backface-visibility:hidden;}',
      'html.az-software-perf-1324 .software-category-group-dropdown-475,html.az-software-perf-1324 .software-category-dropdown-474{contain:layout style;backface-visibility:hidden;transform:translateZ(0);}',
      'html.az-software-perf-1324 .software-category-group-wrap-475:not(.is-open) .software-category-group-dropdown-475{visibility:hidden!important;pointer-events:none!important;}',
      'html.az-software-perf-1324 .software-category-group-wrap-475.is-open .software-category-group-dropdown-475{visibility:visible!important;}',
      'html.az-software-perf-1324.az-software-menu-moving-1324 .software-category-group-dropdown-475,html.az-software-perf-1324.az-software-menu-moving-1324 .software-category-group-trigger-475{transition:none!important;animation:none!important;}',
      'html.az-software-perf-1324.az-software-edit-opening-1324 #softwareAdminModal,html.az-software-perf-1324.az-software-edit-opening-1324 #softwareAdminModal *{transition:none!important;animation:none!important;}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add('az-software-perf-1324');
  }
  installPerformanceCss1324();

  // The complete ~catalog hydration is intentionally an idle task. Give the first
  // interactive paint more room when the page uses the old 650ms timeout.
  if(nativeRIC){
    try{
      window.requestIdleCallback = function(callback, options){
        if(typeof callback !== 'function') return nativeRIC(callback, options);
        var timeout = Number(options && options.timeout);
        if(Number.isFinite(timeout) && timeout === 650){
          var next = {};
          if(options && typeof options === 'object'){
            Object.keys(options).forEach(function(k){ next[k] = options[k]; });
          }
          next.timeout = 1600;
          return nativeRIC(callback, next);
        }
        return nativeRIC(callback, options);
      };
      if(nativeCIC) window.cancelIdleCallback = nativeCIC;
    }catch(_e){}
  }

  // Search used to run the full filter/sort pass on every key event. Debouncing
  // avoids repeated work while typing but keeps the field feeling immediate.
  var searchTimer1324 = 0;
  var replaySearch1324 = false;
  document.addEventListener('input', function(event){
    var target = event && event.target;
    if(replaySearch1324 || !target || target.id !== 'softwareSearchInput') return;
    try{ event.stopImmediatePropagation(); }catch(_e){}
    nativeClearTimeout1324(searchTimer1324);
    searchTimer1324 = nativeSetTimeout1324(function(){
      if(!target || !target.isConnected) return;
      replaySearch1324 = true;
      try{ target.dispatchEvent(new Event('input', {bubbles:true})); }
      finally{ replaySearch1324 = false; }
    }, 90);
  }, true);

  // Let the native select value paint first, then allow the expensive catalogue
  // refresh on the following frame. This removes the "select froze before changing" feel.
  var replayChange1324 = false;
  var queuedChanges1324 = new WeakMap();
  document.addEventListener('change', function(event){
    if(replayChange1324) return;
    var target = event && event.target;
    if(!target || !target.matches) return;
    if(!target.matches('#softwareSortSelect,#softwareOwnerAccountFilter')) return;
    try{ event.stopImmediatePropagation(); }catch(_e){}
    var old = queuedChanges1324.get(target);
    if(old) nativeClearTimeout1324(old);
    var timer = nativeSetTimeout1324(function(){
      queuedChanges1324.delete(target);
      if(!target.isConnected) return;
      replayChange1324 = true;
      try{ target.dispatchEvent(new Event('change', {bubbles:true})); }
      finally{ replayChange1324 = false; }
    }, 0);
    queuedChanges1324.set(target, timer);
  }, true);

  // Opening a grouped category menu should be paint-only. During pointer movement
  // briefly disable inherited transitions/animations that otherwise trigger extra style work.
  var menuMoveTimer1324 = 0;
  document.addEventListener('pointerover', function(event){
    var target = event && event.target;
    if(!target || !target.closest || !target.closest('.software-category-group-wrap-475')) return;
    document.documentElement.classList.add('az-software-menu-moving-1324');
    nativeClearTimeout1324(menuMoveTimer1324);
    menuMoveTimer1324 = nativeSetTimeout1324(function(){
      document.documentElement.classList.remove('az-software-menu-moving-1324');
    }, 140);
  }, {passive:true, capture:true});

  // AZDM adds extra editor work inside openModal(). It is non-essential to the
  // first modal paint, so run it immediately after the modal has had a chance to render.
  var wrappedAzdm1324 = false;
  var hookTimer1324 = 0;
  function wrapAzdmEditor1324(){
    if(wrappedAzdm1324) return true;
    var original = window.azdmSoftwareEditorLoad;
    if(typeof original !== 'function' || original.__azobssPerf1324) return false;
    function deferredAzdm1324(){
      var self = this;
      var args = arguments;
      afterPaint1324(function(){ original.apply(self, args); });
    }
    deferredAzdm1324.__azobssPerf1324 = true;
    deferredAzdm1324.__azobssOriginal = original;
    window.azdmSoftwareEditorLoad = deferredAzdm1324;
    wrappedAzdm1324 = true;
    return true;
  }
  function pollAzdm1324(){
    if(wrapAzdmEditor1324()) return;
    hookTimer1324 = nativeSetTimeout1324(pollAzdm1324, 120);
  }
  pollAzdm1324();
  nativeSetTimeout1324(function(){ nativeClearTimeout1324(hookTimer1324); }, 12000);

  // Remove costly modal transition effects for only the short opening window.
  document.addEventListener('click', function(event){
    var target = event && event.target;
    if(!target || !target.closest || !target.closest('[data-software-edit],#softwareAdminAddButton')) return;
    document.documentElement.classList.add('az-software-edit-opening-1324');
    nativeSetTimeout1324(function(){
      document.documentElement.classList.remove('az-software-edit-opening-1324');
    }, 220);
  }, {passive:true, capture:true});

  try{
    window.dispatchEvent(new CustomEvent('azobss:software-performance-ready', {detail:{version:1324}}));
  }catch(_e){}
})();
