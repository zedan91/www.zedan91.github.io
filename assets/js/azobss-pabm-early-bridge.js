(function () {
  'use strict';

  const STATE_LABELS = {
    JOHOR: 'Johor', KEDAH: 'Kedah', KELANTAN: 'Kelantan', MELAKA: 'Melaka',
    'NEGERI SEMBILAN': 'N. Sembilan', PAHANG: 'Pahang', PERAK: 'Perak', PERLIS: 'Perlis',
    'PULAU PINANG': 'P. Pinang', SABAH: 'Sabah', SARAWAK: 'Sarawak', SELANGOR: 'Selangor',
    TERENGGANU: 'Terengganu', 'WILAYAH PERSEKUTUAN KUALA LUMPUR': 'W.P. KL',
    'WILAYAH PERSEKUTUAN LABUAN': 'W.P. Labuan', 'WILAYAH PERSEKUTUAN PUTRAJAYA': 'W.P. Putrajaya'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[ch];
    });
  }

  function hydrateStateSelects() {
    const source = document.getElementById('negeri');
    if (!source) return;
    const sourceOptions = Array.from(source.options || []).filter(function (option) { return option.value; });
    document.querySelectorAll('select[data-copy-states]').forEach(function (select) {
      if (Array.from(select.options || []).some(function (option) { return option.value; })) return;
      sourceOptions.forEach(function (sourceOption) {
        const option = document.createElement('option');
        option.value = sourceOption.value;
        option.textContent = sourceOption.textContent;
        select.appendChild(option);
      });
    });
  }

  function syncStateButtonActive(holder, select) {
    if (!holder || !select) return;
    const selected = String(select.value || '');
    holder.querySelectorAll('.pabm-state-button').forEach(function (row) {
      const isActive = String(row.getAttribute('data-state-value') || '') === selected;
      row.classList.toggle('is-active', isActive);
      row.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderStateButtons(holder, select) {
    if (!holder || !select) return;
    const options = Array.from(select.options || []).filter(function (option) { return option.value; });
    if (!options.length) return;
    holder.innerHTML = options.map(function (option) {
      const isActive = select.value === option.value;
      const active = isActive ? ' is-active' : '';
      return '<button class="pabm-state-button' + active + '" type="button" aria-pressed="' + (isActive ? 'true' : 'false') + '" data-state-value="' + escapeHtml(option.value) + '">' +
        escapeHtml(STATE_LABELS[option.value] || option.textContent) + '</button>';
    }).join('');
    syncStateButtonActive(holder, select);
  }

  function bindStatePicker(holder) {
    const select = document.getElementById(holder.getAttribute('data-state-picker-for') || '');
    if (!select) return;
    renderStateButtons(holder, select);
    if (holder.dataset.pabmStateBound === '1') return;
    holder.dataset.pabmStateBound = '1';
    holder.addEventListener('click', function (event) {
      const button = event.target.closest('[data-state-value]');
      if (!button || !holder.contains(button)) return;
      event.preventDefault();
      select.value = button.getAttribute('data-state-value') || '';
      // v1252: mark by VALUE before dispatching change. The change listener
      // rebuilds the button DOM synchronously, so comparing against the old
      // clicked node after dispatch caused every button to lose is-active.
      syncStateButtonActive(holder, select);
      select.dispatchEvent(new Event('change', { bubbles:true }));
      syncStateButtonActive(holder, select);
    });
    select.addEventListener('change', function () { renderStateButtons(holder, select); });
  }

  function activateStateGrid() {
    hydrateStateSelects();
    if (document.body) document.body.classList.add('pabm-store-ready', 'pabm-state-picker-ready');
    document.querySelectorAll('[data-state-picker-for]').forEach(bindStatePicker);
  }

  function resolveCartAdd() {
    if (window.azobssPaBmStoreCart && typeof window.azobssPaBmStoreCart.add === 'function') {
      return window.azobssPaBmStoreCart.add.bind(window.azobssPaBmStoreCart);
    }
    if (typeof window.__AZOBSS_PABM_CART_RECORD_PURCHASE__ === 'function') {
      return window.__AZOBSS_PABM_CART_RECORD_PURCHASE__;
    }
    return null;
  }

  window.azobssAddToPaBmCart = async function (payload) {
    let add = resolveCartAdd();
    if (add) return add(payload);

    add = await new Promise(function (resolve, reject) {
      let settled = false;
      const finish = function (fn) {
        if (settled) return;
        settled = true;
        window.removeEventListener('azobss:pabm-store-cart-ready', onReady);
        clearInterval(poll);
        clearTimeout(timeout);
        fn();
      };
      const onReady = function () {
        const current = resolveCartAdd();
        if (current) finish(function () { resolve(current); });
      };
      window.addEventListener('azobss:pabm-store-cart-ready', onReady);
      const poll = setInterval(onReady, 100);
      const timeout = setTimeout(function () {
        finish(function () { reject(new Error('Troli belum dapat dimuatkan. Sila muat semula halaman dan cuba sekali lagi.')); });
      }, 15000);
      onReady();
    });
    return add(payload);
  };

  // Do this immediately after the PA/BM markup has been parsed. This keeps the
  // modern all-state button grid visible even while module/Firebase scripts are loading.
  activateStateGrid();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activateStateGrid, { once:true });
  window.addEventListener('pageshow', activateStateGrid);
})();
