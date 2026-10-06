/* AZOBSS v1040 - Smart global Render pre-warm
   - No immediate wake on ordinary page load.
   - Intent wake on backend-heavy navigation hover/focus/touch.
   - Homepage-only passive wake after 8s if tab is visible.
   - Cross-page localStorage cooldown: 15 min after success, 45s after an attempt.
*/
(function(){
  'use strict';
  if (window.__azobssRenderSmartPrewarm1040) return;
  window.__azobssRenderSmartPrewarm1040 = true;

  var SUCCESS_KEY = 'azobssRenderWakeLastSuccessV1040';
  var ATTEMPT_KEY = 'azobssRenderWakeLastAttemptV1040';
  var SUCCESS_COOLDOWN = 15 * 60 * 1000;
  var ATTEMPT_COOLDOWN = 45 * 1000;
  var PASSIVE_HOME_DELAY = 8000;
  var REQUEST_TIMEOUT = 12000;
  var activePromise = null;

  function num(v){
    var n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function apiBase(){
    try {
      return String(
        localStorage.getItem('azobssPremiumBackendUrl') ||
        localStorage.getItem('azobssSoftwareStatsBackendUrl') ||
        'https://azobss-backend.onrender.com'
      ).replace(/\/$/, '');
    } catch (_) {
      return 'https://azobss-backend.onrender.com';
    }
  }

  function addConnectionHints(){
    var base = apiBase();
    var origin;
    try { origin = new URL(base).origin; } catch (_) { return; }
    if (!document.querySelector('link[data-azobss-render-preconnect="1040"]')) {
      var preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = origin;
      preconnect.crossOrigin = 'anonymous';
      preconnect.setAttribute('data-azobss-render-preconnect', '1040');
      document.head && document.head.appendChild(preconnect);
    }
    if (!document.querySelector('link[data-azobss-render-dns="1040"]')) {
      var dns = document.createElement('link');
      dns.rel = 'dns-prefetch';
      dns.href = origin;
      dns.setAttribute('data-azobss-render-dns', '1040');
      document.head && document.head.appendChild(dns);
    }
  }

  function shouldSkip(now, force){
    if (force) return false;
    try {
      var successAt = num(localStorage.getItem(SUCCESS_KEY));
      if (successAt && (now - successAt) < SUCCESS_COOLDOWN) return true;
      var attemptAt = num(localStorage.getItem(ATTEMPT_KEY));
      if (attemptAt && (now - attemptAt) < ATTEMPT_COOLDOWN) return true;
    } catch (_) {}
    return false;
  }

  function wake(reason, force){
    var now = Date.now();
    if (document.visibilityState === 'hidden' && reason === 'home-passive') return Promise.resolve(false);
    if (shouldSkip(now, !!force)) return activePromise || Promise.resolve(false);
    if (activePromise && !force) return activePromise;

    try { localStorage.setItem(ATTEMPT_KEY, String(now)); } catch (_) {}
    addConnectionHints();

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function(){ try { controller.abort(); } catch (_) {} }, REQUEST_TIMEOUT) : null;
    var url = apiBase() + '/health?azobssWake=1040&reason=' + encodeURIComponent(String(reason || 'intent')) + '&t=' + now;

    activePromise = fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(function(res){
      if (res && res.ok) {
        try { localStorage.setItem(SUCCESS_KEY, String(Date.now())); } catch (_) {}
        return true;
      }
      return false;
    }).catch(function(){
      // Even an aborted cold-start request may still have reached Render and started waking it.
      return false;
    }).finally(function(){
      if (timer) clearTimeout(timer);
      activePromise = null;
    });

    return activePromise;
  }

  function anchorNeedsBackend(anchor){
    if (!anchor || !anchor.getAttribute) return false;
    var raw = String(anchor.getAttribute('href') || '').trim();
    if (!raw || raw.charAt(0) === '#') return false;
    var path = raw;
    try { path = new URL(raw, location.href).pathname; } catch (_) {}
    return /\/(?:Software-Tools|CAD-Tools-&-Resources|PA-BM|Tempah-Servis-IT|Troubleshoot-PC-Online|Perkhidmatan-Ukur-Tanah|Beli-Pelan-Akui)(?:\/|$)/i.test(path);
  }

  function intentFromEvent(event, reason){
    var target = event && event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest('a[href]');
    if (anchorNeedsBackend(anchor)) wake(reason, false);
  }

  addConnectionHints();

  document.addEventListener('pointerover', function(e){ intentFromEvent(e, 'nav-hover'); }, { passive:true });
  document.addEventListener('focusin', function(e){ intentFromEvent(e, 'nav-focus'); });
  document.addEventListener('touchstart', function(e){ intentFromEvent(e, 'nav-touch'); }, { passive:true });

  // A click is stronger intent; still respect the short cross-tab attempt cooldown.
  document.addEventListener('pointerdown', function(e){ intentFromEvent(e, 'nav-pointerdown'); }, { passive:true });

  var path = String(location.pathname || '/').replace(/\/index\.html$/i, '/');
  var isHome = path === '/' || path === '';
  if (isHome) {
    setTimeout(function(){
      if (document.visibilityState === 'visible') wake('home-passive', false);
    }, PASSIVE_HOME_DELAY);
  }

  // Expose for v1039 Software Tools and future pages without creating another wake implementation.
  window.azobssWakeRenderSmart1040 = wake;
  window.azobssRenderWakeKeys1040 = {
    success: SUCCESS_KEY,
    attempt: ATTEMPT_KEY,
    successCooldownMs: SUCCESS_COOLDOWN,
    attemptCooldownMs: ATTEMPT_COOLDOWN
  };
})();
