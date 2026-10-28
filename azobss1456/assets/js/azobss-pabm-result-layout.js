(function () {
  'use strict';

  function init() {
    const storeLayout = document.querySelector('.pabm-store-layout');
    if (!storeLayout || document.getElementById('pabmFullWidthResults')) return;

    const host = document.createElement('div');
    host.id = 'pabmFullWidthResults';
    host.className = 'pabm-full-results';
    host.hidden = true;
    storeLayout.append(host);

    function syncHost() {
      host.hidden = !host.querySelector('.pabm-results-card.is-active.has-results');
    }

    function addResultCard(panel, key, generalInput, resultWrap, pagination) {
      const generalLabel = generalInput?.closest('label');
      if (!panel || !generalLabel || !resultWrap || !pagination) return;

      const card = document.createElement('section');
      card.className = 'pabm-results-card benchmark-form';
      card.dataset.paBmResults = key;
      card.append(generalLabel, resultWrap, pagination);
      host.append(card);

      function syncCard() {
        const hasResults = !resultWrap.hidden;
        card.classList.toggle('has-results', hasResults);
        card.classList.toggle('is-active', panel.classList.contains('is-active'));
        syncHost();
      }

      new MutationObserver(syncCard).observe(resultWrap, {
        attributes: true,
        attributeFilter: ['hidden']
      });
      new MutationObserver(syncCard).observe(panel, {
        attributes: true,
        attributeFilter: ['class']
      });
      syncCard();
    }

    addResultCard(
      document.querySelector('[data-pa-bm-panel="pa"]'),
      'pa',
      document.getElementById('paGeneralSearch'),
      document.getElementById('paResultWrap'),
      document.getElementById('paPagination')
    );
    addResultCard(
      document.querySelector('[data-pa-bm-panel="bm-sbm"]'),
      'bm-sbm',
      document.getElementById('benchmarkGeneralSearch'),
      document.getElementById('benchmarkResultWrap'),
      document.getElementById('benchmarkPagination')
    );
    addResultCard(
      document.querySelector('[data-pa-bm-panel="gps"]'),
      'gps',
      document.getElementById('gpsGeneralSearch'),
      document.getElementById('gpsResultWrap'),
      document.getElementById('gpsPagination')
    );
    addResultCard(
      document.querySelector('[data-pa-bm-panel="syit-piawai"]'),
      'syit-piawai',
      document.getElementById('syitPiawaiGeneralSearch'),
      document.getElementById('syitPiawaiResultWrap'),
      document.getElementById('syitPiawaiPagination')
    );

    document.querySelectorAll('[data-lot-search-panel]').forEach((panel) => {
      addResultCard(
        panel,
        panel.getAttribute('data-pa-bm-panel') || '',
        panel.querySelector('[data-lot-general-search]'),
        panel.querySelector('[data-lot-result-wrap]'),
        panel.querySelector('[data-lot-pagination]')
      );
    });
    syncHost();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
