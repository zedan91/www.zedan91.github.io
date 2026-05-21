(function () {
  'use strict';

  var HOME_SIGNUP = '#signup';
  var HOME_LOGIN = '#login';
  var USER_KEYS = ['azobssCurrentUser', 'azobssUser'];
  var STICKY_STYLE_ID = 'azobss-home-sticky-match-style';

  function readJson(storage, key) {
    try {
      var raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getStoredUser() {
    for (var i = 0; i < USER_KEYS.length; i += 1) {
      var sessionUser = readJson(sessionStorage, USER_KEYS[i]);
      if (sessionUser) return sessionUser;

      var localUser = readJson(localStorage, USER_KEYS[i]);
      if (localUser) return localUser;
    }

    return null;
  }

  function getUsername(user) {
    if (!user) return '';
    return user.usernameKey || user.username || user.name || user.displayName || '';
  }

  function getInitials(name) {
    return String(name || 'AZ')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(function (word) { return word[0].toUpperCase(); })
      .join('') || 'AZ';
  }

  function injectStickyMatchStyle() {
    if (document.getElementById(STICKY_STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STICKY_STYLE_ID;
    style.textContent = [
      '.market-brand{width:154px!important;height:38px!important;border:0!important;background:transparent!important;margin-left:0!important;}',
      '.market-brand img{width:100%!important;height:100%!important;object-fit:cover!important;object-position:center!important;border-radius:999px!important;}',
      '.market-nav a{box-shadow:0 0 10px rgba(148,163,184,.18),inset 0 0 0 1px rgba(255,255,255,.03)!important;}',
      '.market-nav a:hover{box-shadow:0 0 14px rgba(20,184,166,.24),inset 0 0 0 1px rgba(255,255,255,.05)!important;}',
      '.market-nav a.market-nav-primary,.market-nav a.is-active{background:#0e1729!important;border-color:rgba(148,163,184,.28)!important;color:#e5e7eb!important;text-shadow:0 1px 8px rgba(0,0,0,.45)!important;box-shadow:0 0 10px rgba(148,163,184,.18),inset 0 0 0 1px rgba(255,255,255,.03)!important;}',
      '.market-user-tools{gap:20px!important;margin-left:auto!important;}',
      '.market-icon-btn{display:inline-grid!important;place-items:center!important;width:24px!important;height:34px!important;color:#e5e7eb!important;text-decoration:none!important;font-size:clamp(11px,1vw,13px)!important;line-height:1!important;}',
      '.market-icon-btn:hover{color:#14b8a6!important;}',
      '.market-icon-btn svg{width:23px!important;height:23px!important;stroke:currentColor!important;fill:none!important;stroke-width:1.9!important;stroke-linecap:round!important;stroke-linejoin:round!important;}',
      '.user-menu{position:relative!important;top:auto!important;right:auto!important;display:none;align-items:center!important;gap:8px!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;z-index:80!important;transform:none!important;cursor:pointer!important;}',
      'body.is-authenticated .user-menu{display:flex!important;}',
      '.user-avatar{display:grid!important;place-items:center!important;width:24px!important;height:24px!important;border-radius:50%!important;background:#020617!important;border:1px solid rgba(20,184,166,.38)!important;color:#d1d5db!important;font-size:7px!important;font-weight:bold!important;text-transform:none!important;}',
      '.user-name{color:#fff!important;font-weight:bold!important;max-width:180px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:14px!important;}',
      '.user-menu::after{content:""!important;width:7px!important;height:7px!important;border-right:2px solid currentColor!important;border-bottom:2px solid currentColor!important;color:#9ca3af!important;transform:rotate(45deg) translateY(-2px)!important;transition:transform .18s ease!important;margin-left:0!important;}',
      '.user-menu.is-open::after{transform:rotate(225deg) translate(-1px,-1px)!important;}',
      '.user-dropdown{position:absolute!important;top:calc(100% + 13px)!important;right:0!important;display:none!important;width:280px!important;min-width:280px!important;padding:10px 0!important;border:1px solid rgba(148,163,184,.22)!important;border-radius:0!important;background:#232526!important;color:#d4d4d4!important;box-shadow:0 18px 36px rgba(0,0,0,.45)!important;cursor:default!important;z-index:3300!important;}',
      '.user-menu.is-open .user-dropdown{display:block!important;}',
      '.user-dropdown-section{padding:10px 16px 6px!important;color:#a3a3a3!important;font-size:14px!important;font-weight:800!important;text-transform:none!important;letter-spacing:0!important;}',
      '.user-dropdown-item{display:grid!important;grid-template-columns:28px 1fr auto!important;align-items:center!important;gap:12px!important;width:100%!important;min-height:41px!important;padding:8px 16px!important;border:0!important;border-radius:0!important;background:transparent!important;color:#d4d4d4!important;text-align:left!important;text-decoration:none!important;font:inherit!important;font-size:15px!important;cursor:pointer!important;}',
      '.user-dropdown-item:hover,.user-dropdown-item:focus-visible{background:rgba(255,255,255,.07)!important;color:#fff!important;outline:none!important;}',
      '.user-dropdown-item svg{width:24px!important;height:24px!important;fill:none!important;stroke:#c7c7c7!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function iconSvg(type) {
    var paths = {
      saved: '<path d="M20.8 4.6c-1.8-1.8-4.6-1.7-6.3.2L12 7.4 9.5 4.8C7.8 2.9 5 2.8 3.2 4.6c-1.9 1.9-1.9 5 0 6.9L12 20l8.8-8.5c1.9-1.9 1.9-5 0-6.9Z"></path>',
      cart: '<path d="M3 4h2l2.5 11h10.8l2-8H7"></path><path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path><path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"></path><path d="M10 21h4"></path>',
      chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 8.6 8.6 0 0 1-3.8-.9L3 20l1.1-4.3A8.2 8.2 0 0 1 3 11.5a8.5 8.5 0 1 1 18 0Z"></path>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24">' + paths[type] + '</svg>';
  }

  function ensureHomeRightIcons() {
    var tools = document.getElementById('marketUserTools');
    var userMenu = document.getElementById('userMenu');
    if (!tools || !userMenu || tools.querySelector('.market-icon-btn')) return;

    [
      { label: 'Saved', href: '../lucky-draw/', type: 'saved' },
      { label: 'Cart', href: '../affiliate-shop/', type: 'cart' },
      { label: 'Notifications', href: '../PA-BM/', type: 'bell' },
      { label: 'Chat', href: 'https://alvo.chat/6nZ2', type: 'chat', external: true }
    ].forEach(function (item) {
      var link = document.createElement('a');
      link.className = 'market-icon-btn';
      link.setAttribute('aria-label', item.label);
      link.href = item.href;
      if (item.external) {
        link.target = '_blank';
        link.rel = 'noopener';
      }
      link.innerHTML = iconSvg(item.type);
      tools.appendChild(link);
    });
  }

  function dropdownIcon(type) {
    var paths = {
      purchase: '<path d="M6 8h12l-1 13H7L6 8Z"></path><path d="M9 8a3 3 0 0 1 6 0"></path>',
      likes: '<path d="M20.8 4.6c-1.8-1.8-4.6-1.7-6.3.2L12 7.4 9.5 4.8C7.8 2.9 5 2.8 3.2 4.6c-1.9 1.9-1.9 5 0 6.9L12 20l8.8-8.5c1.9-1.9 1.9-5 0-6.9Z"></path>',
      settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7.1 5l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.9 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"></path>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24">' + paths[type] + '</svg>';
  }

  function ensureHomeDropdown() {
    var dropdown = document.getElementById('userDropdown');
    if (!dropdown || dropdown.dataset.homeDropdownReady === 'true') return;

    dropdown.dataset.homeDropdownReady = 'true';
    dropdown.innerHTML = [
      '<div class="user-dropdown-section">Buying</div>',
      '<a class="user-dropdown-item" href="../affiliate-shop/" role="menuitem">' + dropdownIcon('purchase') + '<span>My purchases</span></a>',
      '<a class="user-dropdown-item" href="../lucky-draw/" role="menuitem">' + dropdownIcon('likes') + '<span>Likes</span></a>',
      '<div class="user-dropdown-section">Account</div>',
      '<button class="user-dropdown-item" id="profileSettingsButton" role="menuitem" type="button">' + dropdownIcon('settings') + '<span>Settings</span></button>',
      '<button class="user-dropdown-item" id="logoutButton" role="menuitem" type="button">' + dropdownIcon('logout') + '<span>Log out</span></button>'
    ].join('');
  }

  function normalizeNavHighlight() {
    document.querySelectorAll('.market-nav a.market-nav-primary, .market-nav a.is-active').forEach(function (link) {
      link.classList.remove('market-nav-primary', 'is-active');
    });
  }

  function normalizeAuthLinks() {
    var signupButton = document.getElementById('siteSignUpButton');
    var loginButton = document.getElementById('siteSignInButton');

    if (signupButton) {
      signupButton.setAttribute('href', HOME_SIGNUP);
      signupButton.removeAttribute('onclick');
      signupButton.removeAttribute('data-auth');
    }

    if (loginButton) {
      loginButton.setAttribute('href', HOME_LOGIN);
      loginButton.removeAttribute('onclick');
      loginButton.removeAttribute('data-auth');
    }
  }

  function getAuthHomeLink(target) {
    var authButton = target && target.closest && target.closest('#siteSignUpButton, #siteSignInButton');
    if (!authButton) return '';
    return authButton.id === 'siteSignUpButton' ? HOME_SIGNUP : HOME_LOGIN;
  }

  function openLocalAuth(authLink) {
    var mode = authLink === HOME_SIGNUP ? 'signup' : 'signin';

    if (typeof window.openSiteAuth === 'function') {
      window.openSiteAuth(mode);
      return;
    }

    window.location.hash = mode === 'signup' ? 'signup' : 'login';
  }

  function canSeePaBm(user) {
    var username = getUsername(user).toLowerCase();
    var code = String(user && (user.memberCode || user.inviteCode || user.code || '')).toLowerCase();
    return username === 'zedan91' || code === 'zx6186';
  }

  function updatePaBmLink(user) {
    var paLink = document.getElementById('paBmNavButton') || document.querySelector('.nav-pa-bm-link');
    if (!paLink) return;

    var visible = canSeePaBm(user);
    paLink.hidden = !visible;
    paLink.classList.toggle('is-hidden', !visible);
  }

  function renderAuthState() {
    normalizeAuthLinks();

    var user = getStoredUser();
    var username = getUsername(user);
    var isLoggedIn = Boolean(username);
    var signedInName = document.getElementById('signedInName');
    var userAvatar = document.getElementById('userAvatar');

    document.body.classList.toggle('is-authenticated', isLoggedIn);

    if (signedInName) signedInName.textContent = username;
    if (userAvatar) userAvatar.textContent = getInitials(username);

    updatePaBmLink(user);
  }

  function clearStoredUser() {
    USER_KEYS.forEach(function (key) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    });
    sessionStorage.removeItem('azobssLoggedIn');
    localStorage.removeItem('azobssLoggedIn');
  }

  document.addEventListener('DOMContentLoaded', function () {
    injectStickyMatchStyle();
    ensureHomeRightIcons();
    ensureHomeDropdown();
    normalizeNavHighlight();
    renderAuthState();

    var userMenu = document.getElementById('userMenu');
    if (userMenu && !userMenu.dataset.subpageAuthReady) {
      userMenu.dataset.subpageAuthReady = 'true';
      userMenu.addEventListener('click', function (event) {
        if (event.target.closest('.user-dropdown-item')) {
          userMenu.classList.remove('is-open');
          userMenu.setAttribute('aria-expanded', 'false');
          return;
        }
        event.stopPropagation();
        userMenu.classList.toggle('is-open');
        userMenu.setAttribute('aria-expanded', userMenu.classList.contains('is-open') ? 'true' : 'false');
      });
    }
  });

  document.addEventListener('click', function (event) {
    var authHomeLink = getAuthHomeLink(event.target);
    var logoutButton = event.target.closest && event.target.closest('#logoutButton');
    var userMenu = document.getElementById('userMenu');

    if (authHomeLink) {
      event.stopPropagation();

      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        openLocalAuth(authHomeLink);
      }

      return;
    }

    if (logoutButton) {
      clearStoredUser();
      renderAuthState();
      return;
    }

    if (userMenu && !event.target.closest('#userMenu')) {
      userMenu.classList.remove('is-open');
      userMenu.setAttribute('aria-expanded', 'false');
    }
  }, true);

  window.addEventListener('storage', renderAuthState);
  injectStickyMatchStyle();
  ensureHomeRightIcons();
  ensureHomeDropdown();
  normalizeNavHighlight();
  renderAuthState();
})();
