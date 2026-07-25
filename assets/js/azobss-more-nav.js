/* AZOBSS 588: add Bina Website beside Affiliate Shop and keep More hover dropdown. */
(function () {
  'use strict';

  function normalisePath(path) {
    return String(path || '').replace(/\/+$/, '') || '/';
  }

  function buildMoreMenu(link, index) {
    if (!link || link.dataset.azMoreConverted === '1') return;

    var nav = link.closest('.market-nav');
    if (!nav) return;

    var href = link.getAttribute('href') || '/tools/';
    var currentPath = normalisePath(window.location.pathname);
    var toolsPath = normalisePath(new URL(href, window.location.href).pathname);
    var isToolsPage = currentPath === toolsPath || currentPath.indexOf(toolsPath + '/') === 0;
    var inheritedActive = link.classList.contains('is-active') ||
      link.classList.contains('is-current') ||
      link.classList.contains('market-nav-active');

    var wrap = document.createElement('div');
    wrap.className = 'az-more-nav';
    wrap.dataset.azMoreMenu = '1';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'az-more-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'azMoreDropdown' + index);
    trigger.setAttribute('aria-label', 'More menu');
    if (isToolsPage || inheritedActive) trigger.classList.add('is-active');
    trigger.innerHTML = '' +
      '<svg class="az-more-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<circle cx="5" cy="12" r="1.8"></circle>' +
        '<circle cx="12" cy="12" r="1.8"></circle>' +
        '<circle cx="19" cy="12" r="1.8"></circle>' +
      '</svg>' +
      '<span>More</span>' +
      '<span class="az-more-chevron" aria-hidden="true">▾</span>';

    var dropdown = document.createElement('div');
    dropdown.className = 'az-more-dropdown';
    dropdown.id = 'azMoreDropdown' + index;
    dropdown.setAttribute('role', 'menu');

    var toolsLink = document.createElement('a');
    toolsLink.href = href;
    toolsLink.setAttribute('role', 'menuitem');
    if (isToolsPage || inheritedActive) toolsLink.classList.add('is-active');
    toolsLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="14" y="14" width="7" height="7" rx="1.5"></rect>' +
      '</svg>' +
      '<span>Mini Web Tools</span>';

    dropdown.appendChild(toolsLink);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);

    link.dataset.azMoreConverted = '1';
    link.replaceWith(wrap);
    nav.classList.add('az-more-enabled');

    function setOpen(open) {
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.az-more-nav.is-open').forEach(function (other) {
        if (other !== wrap) {
          other.classList.remove('is-open');
          var otherTrigger = other.querySelector('.az-more-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      setOpen(!wrap.classList.contains('is-open'));
    });

    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        toolsLink.focus();
      } else if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });

    dropdown.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      }
    });
  }

  function ensureWebsiteOrderLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var websitePath = normalisePath('/Tempah-Website/').toLowerCase();

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      var existingLink = nav.querySelector('a[data-az-website-order-link="1"], a[href="/Tempah-Website/"], a[href="/Tempah-Website"]');
      if (existingLink) {
        existingLink.dataset.azWebsiteOrderLink = '1';
        if (currentPath === websitePath || currentPath.indexOf(websitePath + '/') === 0) {
          existingLink.classList.add('market-nav-active', 'is-active', 'is-current');
          existingLink.setAttribute('aria-current', 'page');
        }
        return;
      }

      var affiliateLink = Array.prototype.find.call(nav.querySelectorAll('a[href]'), function (link) {
        try {
          return normalisePath(new URL(link.getAttribute('href'), window.location.href).pathname).toLowerCase() === '/affiliate-shop';
        } catch (error) {
          return false;
        }
      });
      if (!affiliateLink) return;

      var websiteLink = document.createElement('a');
      websiteLink.href = '/Tempah-Website/';
      websiteLink.textContent = 'Bina Website';
      websiteLink.title = 'Tempah Website untuk Bisnes';
      websiteLink.setAttribute('aria-label', 'Bina Website');
      websiteLink.dataset.azWebsiteOrderLink = '1';
      websiteLink.className = 'az-website-order-link';

      if (currentPath === websitePath || currentPath.indexOf(websitePath + '/') === 0) {
        websiteLink.classList.add('market-nav-active', 'is-active', 'is-current');
        websiteLink.setAttribute('aria-current', 'page');
      }

      affiliateLink.insertAdjacentElement('afterend', websiteLink);
    });
  }

  function initialise() {
    ensureWebsiteOrderLink();

    var links = Array.prototype.slice.call(document.querySelectorAll(
      '.market-sticky-bar .market-nav a[href="/tools/"], ' +
      '.market-sticky-bar .market-nav a[href="/tools"], ' +
      '.market-sticky-bar .market-nav a[href$="/tools/"]'
    ));

    links.filter(function (link) {
      return /mini\s*web\s*tools/i.test((link.textContent || '').trim());
    }).forEach(buildMoreMenu);
  }

  document.addEventListener('click', function (event) {
    document.querySelectorAll('.az-more-nav.is-open').forEach(function (menu) {
      if (!menu.contains(event.target)) {
        menu.classList.remove('is-open');
        var trigger = menu.querySelector('.az-more-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
