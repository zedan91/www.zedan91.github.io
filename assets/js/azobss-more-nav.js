/* AZOBSS v1347: Ebook Generator added to More dropdown; keeps existing More/Repair behavior. */
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
    var webPicksPath = normalisePath('/Web-Pilihan/');
    var isWebPicksSection = currentPath === webPicksPath || currentPath.indexOf(webPicksPath + '/') === 0;
    var makanPath = normalisePath('/Makan-Malaysia/');
    var isMakanSection = currentPath === makanPath || currentPath.indexOf(makanPath + '/') === 0;
    var webPicksSourceLink = nav.querySelector('a[data-az-web-pilihan-link="1"], a[href="/Web-Pilihan/"], a[href="/Web-Pilihan"]');
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
    if (isToolsPage || isSoundSection || isWebsiteSection || isFoodSection || isTvSection || isWebPicksSection || isMakanSection || inheritedActive) trigger.classList.add('market-nav-active', 'is-active', 'is-current');
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

    var webPicksLink = document.createElement('a');
    webPicksLink.href = webPicksSourceLink ? (webPicksSourceLink.getAttribute('href') || '/Web-Pilihan/') : '/Web-Pilihan/';
    webPicksLink.setAttribute('role', 'menuitem');
    webPicksLink.dataset.azWebPilihanLink = '1';
    webPicksLink.title = 'Useful websites and tools curated by AZOBSS';
    webPicksLink.setAttribute('aria-label', 'Web Picks');
    if (isWebPicksSection || (webPicksSourceLink && (
      webPicksSourceLink.classList.contains('is-active') ||
      webPicksSourceLink.classList.contains('is-current') ||
      webPicksSourceLink.classList.contains('market-nav-active')
    ))) {
      webPicksLink.classList.add('market-nav-active', 'is-active', 'is-current');
      webPicksLink.setAttribute('aria-current', 'page');
    }
    webPicksLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M5 4h14v16l-7-4-7 4z"></path>' +
      '</svg>' +
      '<span>Web Picks</span>';

    var makanLink = document.createElement('a');
    makanLink.href = '/Makan-Malaysia/';
    makanLink.setAttribute('role', 'menuitem');
    makanLink.dataset.azMakanMalaysiaLink = '1';
    makanLink.title = 'Tempat makan recommended di Malaysia';
    if (isMakanSection) { makanLink.classList.add('market-nav-active','is-active','is-current'); makanLink.setAttribute('aria-current','page'); }
    makanLink.innerHTML = '' +
      '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
        '<path d="M7 3v8"></path><path d="M4 3v5a3 3 0 0 0 6 0V3"></path><path d="M7 11v10"></path><path d="M17 3v18"></path><path d="M17 3c2.3 2 3 4.2 3 7h-3"></path>' +
      '</svg>' +
      '<span>Makan Malaysia</span>';

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
    dropdown.appendChild(webPicksLink);
    dropdown.appendChild(makanLink);
    dropdown.appendChild(soundLink);
    dropdown.appendChild(websiteLink);
    dropdown.appendChild(foodLink);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);

    link.dataset.azMoreConverted = '1';
    link.replaceWith(wrap);
    if (websiteSourceLink && websiteSourceLink.isConnected) websiteSourceLink.remove();
    if (webPicksSourceLink && webPicksSourceLink.isConnected) webPicksSourceLink.remove();
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

    webPicksLink.addEventListener('click', function () {
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
    var overviewPath = normalisePath('/PC-IT-Services/').toLowerCase();
    var buildPath = normalisePath('/PC-Build/').toLowerCase();
    var physicalPath = normalisePath('/Tempah-Servis-IT/').toLowerCase();
    var upgradePath = normalisePath('/Upgrade-Parts/').toLowerCase();
    var onlinePath = normalisePath('/Troubleshoot-PC-Online/').toLowerCase();
    function inSection(sectionPath) {
      return currentPath === sectionPath || currentPath.indexOf(sectionPath + '/') === 0;
    }
    var isOverviewPage = inSection(overviewPath);
    var isOverviewLanding = isOverviewPage;
    var isBuildPage = inSection(buildPath);
    var isPhysicalPage = inSection(physicalPath);
    var isUpgradePage = inSection(upgradePath);
    var isOnlinePage = inSection(onlinePath);
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
    trigger.setAttribute('aria-label', 'Menu PC & IT Services');
    if (isOverviewPage || isBuildPage || isPhysicalPage || isUpgradePage || isOnlinePage || inheritedActive) {
      trigger.classList.add('market-nav-active', 'is-active', 'is-current');
    }
    trigger.innerHTML = '' +
      '<span>PC &amp; IT Services</span>' +
      '<span class="az-more-chevron" aria-hidden="true">▾</span>';

    var dropdown = document.createElement('div');
    dropdown.className = 'az-more-dropdown az-repair-dropdown';
    dropdown.id = 'azRepairDropdown' + index;
    dropdown.setAttribute('role', 'menu');
    dropdown.setAttribute('aria-label', 'Pilihan PC & IT Services');

    function makeLink(href, dataName, iconClass, iconSvg, title, note, active) {
      var item = document.createElement('a');
      item.href = href;
      item.setAttribute('role', 'menuitem');
      item.dataset[dataName] = '1';
      if (active) {
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'page');
      }
      item.innerHTML = '<svg class="az-more-item-icon ' + iconClass + '" aria-hidden="true" viewBox="0 0 24 24">' + iconSvg + '</svg>' +
        '<span class="az-repair-item-copy"><strong>' + title + '</strong><small>' + note + '</small></span>';
      return item;
    }

    var overviewLink = makeLink('/PC-IT-Services/', 'azPcitOverviewLink', 'az-pcit-overview-icon',
      '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 9h18M8 4v5"></path>',
      'Semua PC &amp; IT Services', 'Semua servis build, repair, upgrade &amp; parts', isOverviewLanding);
    var buildLink = makeLink('/PC-Build/', 'azPcitBuildLink', 'az-pcit-build-icon',
      '<rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4M8 9h8M12 6v6"></path>',
      'PC Build &amp; Hardware', 'Build siap + Build Sendiri dengan harga Malaysia', isBuildPage);
    var physicalLink = makeLink('/Tempah-Servis-IT/', 'azRepairPhysicalLink', 'az-repair-physical-icon',
      '<path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0-.6-5.4z"></path>',
      'Servis PC &amp; Laptop', 'Repair, format, cleaning, LCD dan keyboard', isPhysicalPage);
    var upgradeLink = makeLink('/Upgrade-Parts/', 'azPcitUpgradeLink', 'az-pcit-upgrade-icon',
      '<path d="M12 3v18M3 12h18"></path><circle cx="12" cy="12" r="8"></circle>',
      'Upgrade &amp; Parts', 'RAM, SSD, GPU, PSU, bateri &amp; adapter', isUpgradePage);
    var onlineLink = makeLink('/Troubleshoot-PC-Online/', 'azRepairOnlineLink', 'az-repair-online-icon',
      '<rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path>',
      'Troubleshoot PC Online', 'Pemeriksaan dan pembaikan Windows dari jauh', isOnlinePage);

    [overviewLink, buildLink, physicalLink, upgradeLink, onlineLink].forEach(function (item) {
      dropdown.appendChild(item);
    });
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
      var dropdownWidth = Math.min(390, Math.max(250, viewportWidth - 16));
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

    dropdown.querySelectorAll('a[role="menuitem"]').forEach(function (item) {
      item.addEventListener('click', function () { setOpen(false); });
    });
  }

  function isPcitOverviewPage() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var overviewPath = normalisePath('/PC-IT-Services/').toLowerCase();
    return currentPath === overviewPath || currentPath.indexOf(overviewPath + '/') === 0;
  }

  function scrollToUpgradeParts(behavior) {
    if (!isPcitOverviewPage()) return false;
    if (String(window.location.hash || '').toLowerCase() !== '#upgrade-parts') return false;
    var target = document.getElementById('upgrade-parts');
    if (!target) return false;

    function run() {
      var sticky = document.querySelector('.market-sticky-bar');
      var stickyHeight = sticky ? Math.ceil(sticky.getBoundingClientRect().height || sticky.offsetHeight || 0) : 0;
      var top = Math.max(0, target.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - stickyHeight - 12);
      try {
        window.scrollTo({ top: top, behavior: behavior || 'auto' });
      } catch (error) {
        window.scrollTo(0, top);
      }
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(run);
    });
    return true;
  }

  function activateUpgradeParts(wrap, behavior) {
    if (!isPcitOverviewPage()) return false;
    var next = window.location.pathname + window.location.search + '#upgrade-parts';
    if (String(window.location.hash || '').toLowerCase() !== '#upgrade-parts') {
      window.history.pushState(null, document.title, next);
    }
    document.querySelectorAll('.az-repair-nav').forEach(syncRepairMenuActive);
    scrollToUpgradeParts(behavior || 'smooth');
    return true;
  }

  function syncRepairMenuActive(wrap) {
    if (!wrap || !wrap.classList || !wrap.classList.contains('az-repair-nav')) return;
    var trigger = wrap.querySelector(':scope > .az-repair-trigger');
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var hash = String(window.location.hash || '').toLowerCase();
    var overviewPath = normalisePath('/PC-IT-Services/').toLowerCase();
    var buildPath = normalisePath('/PC-Build/').toLowerCase();
    var physicalPath = normalisePath('/Tempah-Servis-IT/').toLowerCase();
    var upgradePath = normalisePath('/Upgrade-Parts/').toLowerCase();
    var onlinePath = normalisePath('/Troubleshoot-PC-Online/').toLowerCase();
    function inSection(sectionPath) {
      return currentPath === sectionPath || currentPath.indexOf(sectionPath + '/') === 0;
    }
    var overview = inSection(overviewPath);
    var upgrade = inSection(upgradePath) || (overview && hash === '#upgrade-parts');
    var states = [
      ['[data-az-pcit-overview-link="1"]', overview && !upgrade, 'page'],
      ['[data-az-pcit-build-link="1"]', inSection(buildPath), 'page'],
      ['[data-az-repair-physical-link="1"]', inSection(physicalPath), 'page'],
      ['[data-az-pcit-upgrade-link="1"]', upgrade, 'page'],
      ['[data-az-repair-online-link="1"]', inSection(onlinePath), 'page']
    ];
    var anyActive = false;
    states.forEach(function (entry) {
      var item = wrap.querySelector(entry[0]);
      if (!item) return;
      var active = !!entry[1];
      item.classList.toggle('is-active', active);
      item.classList.toggle('is-current', active);
      item.classList.remove('market-nav-active');
      if (active) {
        item.setAttribute('aria-current', entry[2]);
        anyActive = true;
      } else {
        item.removeAttribute('aria-current');
      }
    });
    if (trigger) {
      trigger.classList.toggle('market-nav-active', anyActive);
      trigger.classList.toggle('is-active', anyActive);
      trigger.classList.toggle('is-current', anyActive);
    }
  }

  function wireStaticMenu(wrap) {
    if (!wrap || wrap.dataset.azStaticWired === '1') return;
    var trigger = wrap.querySelector(':scope > .az-more-trigger');
    var dropdown = wrap.querySelector(':scope > .az-more-dropdown');
    if (!trigger || !dropdown) return;
    wrap.dataset.azStaticWired = '1';
    syncRepairMenuActive(wrap);

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
      var baseWidth = wrap.classList.contains('az-repair-nav') ? 390 : 232;
      var minWidth = wrap.classList.contains('az-repair-nav') ? 230 : 190;
      var dropdownWidth = Math.min(baseWidth, Math.max(minWidth, viewportWidth - 16));
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
    function items() {
      return Array.prototype.slice.call(dropdown.querySelectorAll('a[role="menuitem"]'));
    }
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      document.querySelectorAll('.az-more-nav.is-open').forEach(function (other) {
        if (other !== wrap) {
          other.classList.remove('is-open');
          var otherTrigger = other.querySelector(':scope > .az-more-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      setOpen(!wrap.classList.contains('is-open'));
    });
    trigger.addEventListener('keydown', function (event) {
      var menuItems = items();
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
        if (menuItems[0]) menuItems[0].focus();
      } else if (event.key === 'Escape') {
        setOpen(false);
        trigger.focus();
      }
    });
    dropdown.addEventListener('keydown', function (event) {
      var menuItems = items();
      if (!menuItems.length) return;
      var currentIndex = menuItems.indexOf(document.activeElement);
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        menuItems[(currentIndex + 1 + menuItems.length) % menuItems.length].focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length].focus();
      }
    });
    dropdown.querySelectorAll('a[role="menuitem"]').forEach(function (item) {
      item.addEventListener('click', function () { setOpen(false); });
    });
    window.addEventListener('resize', function () {
      if (wrap.classList.contains('is-open')) positionMobileDropdown();
    }, { passive: true });
    window.addEventListener('orientationchange', function () {
      if (wrap.classList.contains('is-open')) positionMobileDropdown();
    }, { passive: true });
    if (wrap.classList.contains('az-repair-nav')) {
      window.addEventListener('hashchange', function () { syncRepairMenuActive(wrap); scrollToUpgradeParts('smooth'); }, { passive: true });
    }
  }

  function ensureWebPilihanLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var webPilihanPath = normalisePath('/Web-Pilihan/').toLowerCase();
    var isWebPilihan = currentPath === webPilihanPath || currentPath.indexOf(webPilihanPath + '/') === 0;

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      var topLink = nav.querySelector(':scope > a[data-az-web-pilihan-link="1"], :scope > a[href="/Web-Pilihan/"], :scope > a[href="/Web-Pilihan"]');
      var moreWrap = nav.querySelector(':scope > .az-more-nav[data-az-more-menu="1"]');
      var dropdown = moreWrap && moreWrap.querySelector(':scope > .az-more-dropdown');

      if (dropdown) {
        var webLink = dropdown.querySelector('a[data-az-web-pilihan-link="1"], a[href="/Web-Pilihan/"], a[href="/Web-Pilihan"]');
        if (!webLink) {
          webLink = document.createElement('a');
          webLink.href = '/Web-Pilihan/';
          webLink.setAttribute('role', 'menuitem');
          webLink.dataset.azWebPilihanLink = '1';
          webLink.title = 'Useful websites and tools curated by AZOBSS';
          webLink.setAttribute('aria-label', 'Web Picks');
          webLink.innerHTML = '' +
            '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
              '<path d="M5 4h14v16l-7-4-7 4z"></path>' +
            '</svg>' +
            '<span>Web Picks</span>';
          var toolsLink = dropdown.querySelector('a[data-az-more-tools-link="1"]');
          if (toolsLink) toolsLink.insertAdjacentElement('afterend', webLink);
          else dropdown.appendChild(webLink);
          webLink.addEventListener('click', function () {
            moreWrap.classList.remove('is-open');
            var trigger = moreWrap.querySelector(':scope > .az-more-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
          });
        }

        webLink.dataset.azWebPilihanLink = '1';
        if (isWebPilihan) {
          webLink.classList.add('market-nav-active', 'is-active', 'is-current');
          webLink.setAttribute('aria-current', 'page');
          var moreTrigger = moreWrap.querySelector(':scope > .az-more-trigger');
          if (moreTrigger) moreTrigger.classList.add('market-nav-active', 'is-active', 'is-current');
        } else {
          webLink.classList.remove('market-nav-active', 'is-active', 'is-current');
          webLink.removeAttribute('aria-current');
        }
        if (topLink && topLink.isConnected) topLink.remove();
        return;
      }

      // Legacy fallback: keep a temporary direct link until buildMoreMenu converts Mini Web Tools into More.
      if (!topLink) {
        topLink = document.createElement('a');
        topLink.href = '/Web-Pilihan/';
        topLink.textContent = 'Web Picks';
        topLink.title = 'Useful websites and tools curated by AZOBSS';
        topLink.dataset.azWebPilihanLink = '1';
        nav.appendChild(topLink);
      }
      if (isWebPilihan) {
        topLink.classList.add('market-nav-active', 'is-active', 'is-current');
        topLink.setAttribute('aria-current', 'page');
      }
    });
  }


  function ensureEbookGeneratorLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var softwarePath = normalisePath('/Software-Tools/').toLowerCase();
    var isEbook = currentPath === softwarePath && String(window.location.hash || '').toLowerCase() === '#ebook';

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      var moreWrap = nav.querySelector(':scope > .az-more-nav[data-az-more-menu="1"]');
      var dropdown = moreWrap && moreWrap.querySelector(':scope > .az-more-dropdown');
      if (!dropdown) return;

      var ebookLink = dropdown.querySelector('a[data-az-ebook-generator-link="1"], a[href="/Software-Tools/#ebook"]');
      if (!ebookLink) {
        ebookLink = document.createElement('a');
        ebookLink.href = '/Software-Tools/#ebook';
        ebookLink.setAttribute('role', 'menuitem');
        ebookLink.dataset.azEbookGeneratorLink = '1';
        ebookLink.title = 'AZOBSS Ebook Generator';
        ebookLink.innerHTML = '' +
          '<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24">' +
            '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path>' +
            '<path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"></path>' +
          '</svg>' +
          '<span>Ebook Generator</span>';
        var toolsLink = dropdown.querySelector('a[data-az-more-tools-link="1"]');
        if (toolsLink) toolsLink.insertAdjacentElement('afterend', ebookLink);
        else dropdown.appendChild(ebookLink);
        ebookLink.addEventListener('click', function () {
          moreWrap.classList.remove('is-open');
          var trigger = moreWrap.querySelector(':scope > .az-more-trigger');
          if (trigger) trigger.setAttribute('aria-expanded', 'false');
        });
      }

      var softwareTop = nav.querySelector(':scope > a[href="/Software-Tools/"], :scope > a[href="/Software-Tools"]');
      if (isEbook) {
        ebookLink.classList.add('market-nav-active', 'is-active', 'is-current');
        ebookLink.setAttribute('aria-current', 'page');
        var trigger = moreWrap.querySelector(':scope > .az-more-trigger');
        if (trigger) trigger.classList.add('market-nav-active', 'is-active', 'is-current');
        if (softwareTop) { softwareTop.classList.remove('market-nav-active', 'is-active', 'is-current'); softwareTop.removeAttribute('aria-current'); }
      } else {
        ebookLink.classList.remove('market-nav-active', 'is-active', 'is-current');
        ebookLink.removeAttribute('aria-current');
        if (currentPath === softwarePath && softwareTop) { softwareTop.classList.add('market-nav-active', 'is-active'); softwareTop.setAttribute('aria-current','page'); }
      }
    });
  }


  function ensureMakanMalaysiaLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var makanPath = normalisePath('/Makan-Malaysia/').toLowerCase();
    var isMakan = currentPath === makanPath || currentPath.indexOf(makanPath + '/') === 0;
    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      var moreWrap = nav.querySelector(':scope > .az-more-nav[data-az-more-menu="1"]');
      var dropdown = moreWrap && moreWrap.querySelector(':scope > .az-more-dropdown');
      if (!dropdown) return;
      var link = dropdown.querySelector('a[data-az-makan-malaysia-link="1"], a[href="/Makan-Malaysia/"], a[href="/Makan-Malaysia"]');
      if (!link) {
        link = document.createElement('a');
        link.href = '/Makan-Malaysia/';
        link.setAttribute('role','menuitem');
        link.dataset.azMakanMalaysiaLink='1';
        link.title='Tempat makan recommended di Malaysia';
        link.innerHTML='<svg class="az-more-item-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 3v8"></path><path d="M4 3v5a3 3 0 0 0 6 0V3"></path><path d="M7 11v10"></path><path d="M17 3v18"></path><path d="M17 3c2.3 2 3 4.2 3 7h-3"></path></svg><span>Makan Malaysia</span>';
        var webPicks = dropdown.querySelector('a[data-az-web-pilihan-link="1"]');
        if (webPicks) webPicks.insertAdjacentElement('afterend',link); else dropdown.appendChild(link);
        link.addEventListener('click',function(){moreWrap.classList.remove('is-open');var trigger=moreWrap.querySelector(':scope > .az-more-trigger');if(trigger)trigger.setAttribute('aria-expanded','false')});
      }
      if (isMakan) {
        link.classList.add('market-nav-active','is-active','is-current');link.setAttribute('aria-current','page');
        var trigger=moreWrap.querySelector(':scope > .az-more-trigger');if(trigger)trigger.classList.add('market-nav-active','is-active','is-current');
      } else { link.classList.remove('market-nav-active','is-active','is-current');link.removeAttribute('aria-current'); }
    });
  }

  function ensureWebsiteOrderLink() {
    var currentPath = normalisePath(window.location.pathname).toLowerCase();
    var websitePath = normalisePath('/Tempah-Website/').toLowerCase();

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      if (nav.querySelector(':scope > .az-more-nav[data-az-more-menu="1"]')) return;
      var existingLink = nav.querySelector(':scope > a[data-az-website-order-link="1"], :scope > a[href="/Tempah-Website/"], :scope > a[href="/Tempah-Website"]');
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
    var overviewPath = normalisePath('/PC-IT-Services/').toLowerCase();
    var buildPath = normalisePath('/PC-Build/').toLowerCase();
    var repairPath = normalisePath('/Tempah-Servis-IT/').toLowerCase();
    var onlineRepairPath = normalisePath('/Troubleshoot-PC-Online/').toLowerCase();
    function inSection(sectionPath) {
      return currentPath === sectionPath || currentPath.indexOf(sectionPath + '/') === 0;
    }
    var isRepairSection = inSection(overviewPath) || inSection(buildPath) || inSection(repairPath) || inSection(onlineRepairPath);

    document.querySelectorAll('.market-sticky-bar .market-nav').forEach(function (nav) {
      if (nav.querySelector(':scope > .az-repair-nav[data-az-repair-menu="1"]')) return;
      var existingLink = nav.querySelector(':scope > a[data-az-repair-service-link="1"], :scope > a[href="/PC-IT-Services/"], :scope > a[href="/PC-IT-Services"], :scope > a[href="/Tempah-Servis-IT/"], :scope > a[href="/Tempah-Servis-IT"]');
      if (existingLink) {
        existingLink.dataset.azRepairServiceLink = '1';
        existingLink.href = '/PC-IT-Services/';
        existingLink.textContent = 'PC & IT Services';
        existingLink.title = 'PC Build, Repair, Upgrade & IT Services';
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
      repairLink.href = '/PC-IT-Services/';
      repairLink.textContent = 'PC & IT Services';
      repairLink.title = 'PC Build, Repair, Upgrade & IT Services';
      repairLink.setAttribute('aria-label', 'PC & IT Services');
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
    document.querySelectorAll('.market-sticky-bar .market-nav > .az-more-nav[data-az-static-menu="1"]').forEach(wireStaticMenu);

    // Legacy fallback only: pages not yet pre-rendered may still be upgraded.
    ensureWebPilihanLink();
    ensureEbookGeneratorLink();
    ensureMakanMalaysiaLink();
    ensureWebsiteOrderLink();
    ensureRepairServiceLink();

    Array.prototype.slice.call(document.querySelectorAll(
      '.market-sticky-bar .market-nav > a[data-az-repair-service-link="1"]'
    )).forEach(buildRepairMenu);

    var links = Array.prototype.slice.call(document.querySelectorAll(
      '.market-sticky-bar .market-nav > a[href="/tools/"], ' +
      '.market-sticky-bar .market-nav > a[href="/tools"], ' +
      '.market-sticky-bar .market-nav > a[href$="/tools/"]'
    ));

    links.filter(function (candidate) {
      return /mini\s*web\s*tools/i.test((candidate.textContent || '').trim());
    }).forEach(buildMoreMenu);
    ensureEbookGeneratorLink();
    ensureMakanMalaysiaLink();

    if (String(window.location.hash || '').toLowerCase() === '#upgrade-parts') {
      scrollToUpgradeParts('auto');
      window.setTimeout(function () { scrollToUpgradeParts('auto'); }, 120);
      window.setTimeout(function () { scrollToUpgradeParts('auto'); }, 420);
    }
  }

  window.addEventListener('hashchange', function () { ensureEbookGeneratorLink(); }, { passive: true });

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
