/* AZOBSS 964: More menu + Repair PC dropdown; AZOBSSTV moved into More. */
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
    var currentHash = String(window.location.hash || '').toLowerCase();
    var toolsPath = normalisePath(new URL(href, window.location.href).pathname);
    var isToolsPage = currentPath === toolsPath || currentPath.indexOf(toolsPath + '/') === 0;
    var foodPath = normalisePath('/Tempahan-Makanan/');
    var soundPath = normalisePath('/Sound-Effects/');
    var isSoundSection = currentPath === soundPath || currentPath.indexOf(soundPath + '/') === 0;
    var isFoodSection = currentPath === foodPath || currentPath.indexOf(foodPath + '/') === 0 || (currentPath === '/' && currentHash === '#tempahan-makanan');
    var websitePath = normalisePath('/Tempah-Website/');
    var isWebsiteSection = currentPath === websitePath || currentPath.indexOf(websitePath + '/') === 0;
    var tvPath = normalisePath('/AZOBSSTV/');
    var isTvSection = currentPath === tvPath || currentPath.indexOf(tvPath + '/') === 0;
    var websiteSourceLink = nav.querySelector('a[data-az-website-order-link="1"], a[href="/Tempah-Website/"], a[href="/Tempah-Website"]');
    var tvSourceLink = nav.querySelector('a[data-azobsstv-link="1"], a[href="/AZOBSSTV/"], a[href="/AZOBSSTV"]');
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
    if (isToolsPage || isSoundSection || isWebsiteSection || isFoodSection || isTvSection || inheritedActive) trigger.classList.add('market-nav-active', 'is-active', 'is-current');
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

    var tvLink = document.createElement('a');
    tvLink.href = tvSourceLink ? (tvSourceLink.getAttribute('href') || '/AZOBSSTV/') : '/AZOBSSTV/';
    tvLink.setAttribute('role', 'menuitem');
    tvLink.dataset.azobsstvLink = '1';
    tvLink.title = 'AZOBSSTV';
    if (isTvSection || (tvSourceLink && (tvSourceLink.classList.contains('is-active') || tvSourceLink.classList.contains('is-current') || tvSourceLink.classList.contains('market-nav-active')))) {
      tvLink.classList.add('is-active');
      tvLink.setAttribute('aria-current', 'page');
    }
    tvLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<rect x="3" y="5" width="18" height="13" rx="2"></rect>' +
        '<path d="M9 21h6"></path>' +
        '<path d="M12 18v3"></path>' +
        '<path d="m10 9 5 3-5 3z"></path>' +
      '</svg>' +
      '<span>AZOBSSTV</span>';

    var toolsLink = document.createElement('a');
    toolsLink.href = href;
    toolsLink.setAttribute('role', 'menuitem');
    toolsLink.dataset.azMoreToolsLink = '1';
    if (isToolsPage || inheritedActive) {
      toolsLink.classList.add('is-active');
      toolsLink.setAttribute('aria-current', 'page');
    }
    toolsLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<rect x="3" y="3" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="14" y="3" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="3" y="14" width="7" height="7" rx="1.5"></rect>' +
        '<rect x="14" y="14" width="7" height="7" rx="1.5"></rect>' +
      '</svg>' +
      '<span>Mini Web Tools</span>';

    var soundLink = document.createElement('a');
    soundLink.href = '/Sound-Effects/';
    soundLink.setAttribute('role', 'menuitem');
    soundLink.dataset.azSoundEffectsLink = '1';
    soundLink.title = 'AZOBSS Sound Effects';
    soundLink.setAttribute('aria-label', 'Sound Effects');
    if (isSoundSection) {
      soundLink.classList.add('market-nav-active', 'is-active', 'is-current');
      soundLink.setAttribute('aria-current', 'page');
    }
    soundLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M4 10v4"></path>' +
        '<path d="M8 8v8"></path>' +
        '<path d="M12 5v14"></path>' +
        '<path d="M16 8v8"></path>' +
        '<path d="M20 10v4"></path>' +
      '</svg>' +
      '<span>Sound Effects</span>';

    var websiteLink = document.createElement('a');
    websiteLink.href = websiteSourceLink ? (websiteSourceLink.getAttribute('href') || '/Tempah-Website/') : '/Tempah-Website/';
    websiteLink.setAttribute('role', 'menuitem');
    websiteLink.dataset.azWebsiteOrderLink = '1';
    websiteLink.title = 'Tempah Website untuk Bisnes';
    if (isWebsiteSection || (websiteSourceLink && (
      websiteSourceLink.classList.contains('is-active') ||
      websiteSourceLink.classList.contains('is-current') ||
      websiteSourceLink.classList.contains('market-nav-active')
    ))) {
      websiteLink.classList.add('is-active');
      websiteLink.setAttribute('aria-current', 'page');
    }
    websiteLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<rect x="3" y="5" width="18" height="13" rx="2"></rect>' +
        '<path d="M8 21h8"></path>' +
        '<path d="M12 18v3"></path>' +
        '<path d="M7 10h4"></path>' +
        '<path d="M7 13h8"></path>' +
      '</svg>' +
      '<span>Bina Website</span>';

    var foodLink = document.createElement('a');
    foodLink.href = '/Tempahan-Makanan/';
    foodLink.setAttribute('role', 'menuitem');
    foodLink.dataset.azFoodOrderLink = '1';
    foodLink.title = 'Food - Brownies';
    if (isFoodSection) {
      foodLink.classList.add('is-active');
      foodLink.setAttribute('aria-current', 'location');
    }
    foodLink.innerHTML = '' +
      '<svg class="az-more-item-icon az-more-food-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M4 14h16"></path>' +
        '<path d="M6 14a6 6 0 0 1 12 0"></path>' +
        '<path d="M12 6V4"></path>' +
        '<path d="M3 18h18"></path>' +
      '</svg>' +
      '<span>Food - Brownies</span>';

    dropdown.appendChild(tvLink);
    dropdown.appendChild(toolsLink);
    dropdown.appendChild(soundLink);
    dropdown.appendChild(websiteLink);
    dropdown.appendChild(foodLink);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);

    link.dataset.azMoreConverted = '1';
    link.replaceWith(wrap);
    if (websiteSourceLink && websiteSourceLink.isConnected) websiteSourceLink.remove();
    if (tvSourceLink && tvSourceLink.isConnected) tvSourceLink.remove();
    nav.classList.add('az-more-enabled');

    function isMobileStickybar() {
      return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    }

    function positionMobileDropdown() {
      if (!isMobileStickybar()) {
        dropdown.style.removeProperty('--az-more-mobile-top');
        dropdown.style.removeProperty('--az-more-mobile-left');
        dropdown.style.removeProperty('--az-more-mobile-width');
        return;
      }

      var viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var triggerRect = trigger.getBoundingClientRect();
      var dropdownWidth = Math.min(232, Math.max(190, viewportWidth - 16));
      var halfWidth = dropdownWidth / 2;
      var centre = triggerRect.left + (triggerRect.width / 2);
      centre = Math.max(8 + halfWidth, Math.min(viewportWidth - 8 - halfWidth, centre));

      dropdown.style.setProperty('--az-more-mobile-top', Math.round(triggerRect.bottom + 7) + 'px');
      dropdown.style.setProperty('--az-more-mobile-left', Math.round(centre) + 'px');
      dropdown.style.setProperty('--az-more-mobile-width', Math.round(dropdownWidth) + 'px');
    }

    function setOpen(open) {
      if (open) positionMobileDropdown();
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    var dropdownPositionFrame = 0;
    function queueDropdownPosition() {
      if (!wrap.classList.contains('is-open')) return;
      if (dropdownPositionFrame) cancelAnimationFrame(dropdownPositionFrame);
      dropdownPositionFrame = requestAnimationFrame(function () {
        dropdownPositionFrame = 0;
        positionMobileDropdown();
      });
    }

    nav.addEventListener('scroll', queueDropdownPosition, { passive: true });
    window.addEventListener('resize', queueDropdownPosition, { passive: true });
    window.addEventListener('orientationchange', queueDropdownPosition, { passive: true });

    function menuItems() {
      return Array.prototype.slice.call(dropdown.querySelectorAll('a[role="menuitem"]'));
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
        menuItems()[0].focus();
      } else if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });

    dropdown.addEventListener('keydown', function (event) {
      var items = menuItems();
      var currentIndex = items.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1].focus();
      }
    });

    tvLink.addEventListener('click', function () {
      setOpen(false);
    });

    soundLink.addEventListener('click', function () {
      setOpen(false);
    });

    websiteLink.addEventListener('click', function () {
      setOpen(false);
    });

    foodLink.addEventListener('click', function () {
      setOpen(false);
    });
  }

  function buildRepairMenu(link, index) {
    if (!link || link.dataset.azRepairConverted === '1') return;

    var nav = link.closest('.market-nav');
    if (!nav) return;

    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var physicalPath = normalisePath('/Tempah-Servis-IT/').toLowerCase();
    var onlinePath = normalisePath('/Troubleshoot-PC-Online/').toLowerCase();
    var isPhysicalPage = currentPath === physicalPath || currentPath.indexOf(physicalPath + '/') === 0;
    var isOnlinePage = currentPath === onlinePath || currentPath.indexOf(onlinePath + '/') === 0;
    var inheritedActive = link.classList.contains('is-active') ||
      link.classList.contains('is-current') ||
      link.classList.contains('market-nav-active');

    var wrap = document.createElement('div');
    wrap.className = 'az-more-nav az-repair-nav';
    wrap.dataset.azRepairMenu = '1';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'az-more-trigger az-repair-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'azRepairDropdown' + index);
    trigger.setAttribute('aria-label', 'Menu Repair PC');
    if (isPhysicalPage || isOnlinePage || inheritedActive) {
      trigger.classList.add('market-nav-active', 'is-active', 'is-current');
    }
    trigger.innerHTML = '' +
      '<span>Repair PC</span>' +
      '<span class="az-more-chevron" aria-hidden="true">▾</span>';

    var dropdown = document.createElement('div');
    dropdown.className = 'az-more-dropdown az-repair-dropdown';
    dropdown.id = 'azRepairDropdown' + index;
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-label', 'Pilihan servis Repair PC');

    var physicalLink = document.createElement('a');
    physicalLink.href = '/Tempah-Servis-IT/';
    physicalLink.setAttribute('role', 'menuitem');
    physicalLink.dataset.azRepairPhysicalLink = '1';
    if (isPhysicalPage) {
      physicalLink.classList.add('is-active');
      physicalLink.setAttribute('aria-current', 'page');
    }
    physicalLink.innerHTML = '' +
      '<svg class="az-more-item-icon az-repair-physical-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0-.6-5.4z"></path>' +
      '</svg>' +
      '<span class="az-repair-item-copy"><strong>Servis PC &amp; Laptop</strong><small>Pembaikan fizikal, format dan servis kedai</small></span>';

    var onlineLink = document.createElement('a');
    onlineLink.href = '/Troubleshoot-PC-Online/';
    onlineLink.setAttribute('role', 'menuitem');
    onlineLink.dataset.azRepairOnlineLink = '1';
    if (isOnlinePage) {
      onlineLink.classList.add('is-active');
      onlineLink.setAttribute('aria-current', 'page');
    }
    onlineLink.innerHTML = '' +
      '<svg class="az-more-item-icon az-repair-online-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<rect x="3" y="4" width="18" height="12" rx="2"></rect>' +
        '<path d="M8 20h8M12 16v4"></path>' +
      '</svg>' +
      '<span class="az-repair-item-copy"><strong>Troubleshoot PC Online</strong><small>Pemeriksaan dan pembaikan PC dari jauh</small></span>';

    dropdown.appendChild(physicalLink);
    dropdown.appendChild(onlineLink);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);

    link.dataset.azRepairConverted = '1';
    link.replaceWith(wrap);
    nav.classList.add('az-more-enabled');

    function isMobileStickybar() {
      return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    }

    function positionMobileDropdown() {
      if (!isMobileStickybar()) {
        dropdown.style.removeProperty('--az-more-mobile-top');
        dropdown.style.removeProperty('--az-more-mobile-left');
        dropdown.style.removeProperty('--az-more-mobile-width');
        return;
      }

      var viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      var triggerRect = trigger.getBoundingClientRect();
      var dropdownWidth = Math.min(310, Math.max(230, viewportWidth - 16));
      var halfWidth = dropdownWidth / 2;
      var centre = triggerRect.left + (triggerRect.width / 2);
      centre = Math.max(8 + halfWidth, Math.min(viewportWidth - 8 - halfWidth, centre));

      dropdown.style.setProperty('--az-more-mobile-top', Math.round(triggerRect.bottom + 7) + 'px');
      dropdown.style.setProperty('--az-more-mobile-left', Math.round(centre) + 'px');
      dropdown.style.setProperty('--az-more-mobile-width', Math.round(dropdownWidth) + 'px');
    }

    function setOpen(open) {
      if (open) positionMobileDropdown();
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    var dropdownPositionFrame = 0;
    function queueDropdownPosition() {
      if (!wrap.classList.contains('is-open')) return;
      if (dropdownPositionFrame) cancelAnimationFrame(dropdownPositionFrame);
      dropdownPositionFrame = requestAnimationFrame(function () {
        dropdownPositionFrame = 0;
        positionMobileDropdown();
      });
    }

    nav.addEventListener('scroll', queueDropdownPosition, { passive: true });
    window.addEventListener('resize', queueDropdownPosition, { passive: true });
    window.addEventListener('orientationchange', queueDropdownPosition, { passive: true });

    function menuItems() {
      return Array.prototype.slice.call(dropdown.querySelectorAll('a[role="menuitem"]'));
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
      var items = menuItems();
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        if (items[0]) items[0].focus();
      } else if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });

    dropdown.addEventListener('keydown', function (event) {
      var items = menuItems();
      var currentIndex = items.indexOf(document.activeElement);
      if (!items.length) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        items[(currentIndex + 1 + items.length) % items.length].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        items[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        items[items.length - 1].focus();
      }
    });

    physicalLink.addEventListener('click', function () {
      setOpen(false);
    });
    onlineLink.addEventListener('click', function () {
      setOpen(false);
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

      var affiliateLink = Array.prototype.find.call(nav.querySelectorAll('a[href]'), function (candidate) {
        try {
          return normalisePath(new URL(candidate.getAttribute('href'), window.location.href).pathname).toLowerCase() === '/affiliate-shop';
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

  function ensureRepairServiceLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var repairPath = normalisePath('/Tempah-Servis-IT/').toLowerCase();
    var onlineRepairPath = normalisePath('/Troubleshoot-PC-Online/').toLowerCase();
    var isRepairSection = currentPath === repairPath || currentPath.indexOf(repairPath + '/') === 0 ||
      currentPath === onlineRepairPath || currentPath.indexOf(onlineRepairPath + '/') === 0;

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      var existingLink = nav.querySelector('a[data-az-repair-service-link="1"], a[href="/Tempah-Servis-IT/"], a[href="/Tempah-Servis-IT"]');
      if (existingLink) {
        existingLink.dataset.azRepairServiceLink = '1';
        existingLink.textContent = 'Repair PC';
        existingLink.title = 'Tempah Servis Laptop / PC';
        if (isRepairSection) {
          existingLink.classList.add('market-nav-active', 'is-active', 'is-current');
          existingLink.setAttribute('aria-current', 'page');
        } else {
          existingLink.classList.remove('market-nav-active', 'is-active', 'is-current');
          existingLink.removeAttribute('aria-current');
        }
        return;
      }

      var affiliateLink = Array.prototype.find.call(nav.querySelectorAll('a[href]'), function (candidate) {
        try {
          return normalisePath(new URL(candidate.getAttribute('href'), window.location.href).pathname).toLowerCase() === '/affiliate-shop';
        } catch (error) {
          return false;
        }
      });
      if (!affiliateLink) return;

      var repairLink = document.createElement('a');
      repairLink.href = '/Tempah-Servis-IT/';
      repairLink.textContent = 'Repair PC';
      repairLink.title = 'Tempah Servis Laptop / PC';
      repairLink.setAttribute('aria-label', 'Repair PC');
      repairLink.dataset.azRepairServiceLink = '1';
      repairLink.className = 'az-repair-service-link';

      if (isRepairSection) {
        repairLink.classList.add('market-nav-active', 'is-active', 'is-current');
        repairLink.setAttribute('aria-current', 'page');
      }

      affiliateLink.insertAdjacentElement('afterend', repairLink);
    });
  }

  function initialise() {
    ensureWebsiteOrderLink();
    ensureRepairServiceLink();

    Array.prototype.slice.call(document.querySelectorAll(
      '.market-sticky-bar .market-nav a[data-az-repair-service-link="1"]'
    )).forEach(buildRepairMenu);

    var links = Array.prototype.slice.call(document.querySelectorAll(
      '.market-sticky-bar .market-nav a[href="/tools/"], ' +
      '.market-sticky-bar .market-nav a[href="/tools"], ' +
      '.market-sticky-bar .market-nav a[href$="/tools/"]'
    ));

    links.filter(function (candidate) {
      return /mini\s*web\s*tools/i.test((candidate.textContent || '').trim());
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
