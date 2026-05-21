(function () {
  'use strict';

  var HOME_SIGNUP = '../index.html#signup';
  var HOME_LOGIN = '../index.html#login';
  var USER_KEYS = ['azobssCurrentUser', 'azobssUser'];

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
    var cleanName = String(name || 'AZ').trim();
    if (!cleanName) return 'AZ';
    return cleanName.slice(0, 2).toUpperCase();
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
    renderAuthState();

    var userMenu = document.getElementById('userMenu');
    if (userMenu && !userMenu.dataset.subpageAuthReady) {
      userMenu.dataset.subpageAuthReady = 'true';
      userMenu.addEventListener('click', function (event) {
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
        window.location.assign(authHomeLink);
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
  renderAuthState();
})();
