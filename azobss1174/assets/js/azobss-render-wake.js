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
  setInterval(function(){
    if (document.visibilityState !== 'visible') return;
    if ((now() - lastUserActivityAt) > ACTIVE_WINDOW) return;
    if (!isStillWarm('main')) wakeAll('active-session-refresh', false, false);
  }, 60 * 1000);
})();
