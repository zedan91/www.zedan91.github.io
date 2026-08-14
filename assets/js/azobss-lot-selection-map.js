(function () {
  'use strict';

  const BACKEND_BASE = window.AZOBSS_BACKEND_URL || (
    /^(?:127\.0\.0\.1|localhost)$/.test(window.location.hostname)
      ? window.location.origin
      : 'https://azobss-backend.onrender.com'
  );
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_DRAW_JS = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js';
  const LEAFLET_DRAW_CSS = 'https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css';
  let libraryPromise = null;
  let lotFocusOpenSerial = 0;
  let lotFocusPrefetchController = null;

  function userAdjustedAmount(amount) {
    try {
      const percent = typeof window.azobssGetPriceAdjustmentPercent === 'function'
        ? Number(window.azobssGetPriceAdjustmentPercent('lotKadaster') || 0)
        : Number(window.azobssGetPriceAdjustment?.('lotKadaster')?.percent || 0);
      return typeof window.azobssApplyPriceAdjustment === 'function'
        ? window.azobssApplyPriceAdjustment(Number(amount || 0), percent)
        : Number(amount || 0);
    } catch (_) { return Number(amount || 0); }
  }

  function createLotFocusParams(input, productCode, stateCode) {
    const source = input && typeof input === 'object' ? input : {};
    const params = new URLSearchParams();
    params.set('produk', String(productCode || source.productCode || '1') === '2' ? '2' : '1');
    if (stateCode) params.set('negeri', String(stateCode).padStart(2, '0'));
    const lotNo = String(source.lotNo || source.lot || '').trim();
    const paNo = String(source.paNo || source.pa || '').trim();
    const objectId = String(source.objectId || '').trim();
    const mapUrl = String(source.mapUrl || source.url || '').trim();
    if (lotNo) params.set('lot', lotNo);
    if (paNo) params.set('paNo', paNo);
    if (objectId) params.set('objectId', objectId);
    if (mapUrl) params.set('url', mapUrl);
    if (source.daerah || source.district) params.set('daerah', String(source.daerah || source.district));
    if (source.mukim) params.set('mukim', String(source.mukim));
    if (source.seksyen || source.section) params.set('seksyen', String(source.seksyen || source.section));
    return params;
  }

  async function fetchExactLotFocus(input, productCode, stateCode, signal) {
    const params = createLotFocusParams(input, productCode, stateCode);
    const response = await fetch(`${BACKEND_BASE}/api/jupem-lot-map/focus?${params.toString()}`, {
      cache: 'no-store',
      signal
    });
    const focused = await response.json().catch(() => ({}));
    if (!response.ok || !focused.ok) throw new Error(focused.error || 'Lot JUPEM tidak dapat dipaparkan.');
    return focused;
  }

  function addStyles() {
    if (document.getElementById('azobssLotSelectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'azobssLotSelectionStyles';
    style.textContent = `
      .az-lot-map-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,23,.84);backdrop-filter:blur(5px)}
      .az-lot-map-dialog{width:min(1180px,calc(100vw - 24px));height:min(820px,calc(100vh - 24px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid #38506f;border-radius:8px;background:#0d1729;color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.65)}
      .az-lot-map-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid #2d405b;background:#111f34}
      .az-lot-map-head h2{margin:0;font-size:19px;line-height:1.2;letter-spacing:0}
      .az-lot-map-head small{display:block;margin-top:3px;color:#9fb3cf;font-size:12px}
      .az-lot-map-close{flex:0 0 38px;width:38px;height:38px;border:1px solid #4b607d;border-radius:6px;background:#1d2c43;color:#fff;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 2px 0 #07101e}
      .az-lot-map-body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px}
      .az-lot-map-stage{position:relative;min-width:0;min-height:420px;background:#172033}
      .az-lot-map-canvas{position:absolute;inset:0}
      .az-lot-coordinate-search{position:absolute;z-index:1000;top:10px;left:52px;width:min(440px,calc(100% - 170px));padding:6px;border:1px solid rgba(51,65,85,.9);border-radius:6px;background:rgba(255,255,255,.97);box-shadow:0 2px 8px rgba(15,23,42,.3);overflow:visible}
      .az-lot-coordinate-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
      .az-lot-coordinate-input{width:100%;min-width:0;height:34px;padding:0 10px;border:1px solid #94a3b8;border-radius:4px;background:#fff;color:#0f172a;font-size:13px;letter-spacing:0;outline:none}
      .az-lot-coordinate-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.2)}
      .az-lot-coordinate-input[aria-invalid="true"]{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.15)}
      .az-lot-coordinate-submit{height:34px;padding:0 13px;border:1px solid #1d4ed8;border-radius:4px;background:#2563eb;color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #1e3a8a}
      .az-lot-coordinate-submit:active{transform:translateY(1px);box-shadow:0 1px 0 #1e3a8a}
      .az-lot-coordinate-feedback{display:none;margin:5px 2px 0;color:#b91c1c;font-size:11px;font-weight:700;line-height:1.25}
      .az-lot-coordinate-feedback.is-visible{display:block}
      .az-lot-coordinate-feedback.is-info,.az-lot-coordinate-feedback.is-loading{color:#1d4ed8}
      .az-lot-coordinate-feedback.is-success{color:#047857}
      .az-lot-location-results[hidden]{display:none!important}
      .az-lot-location-results{position:absolute;left:0;right:0;top:calc(100% + 5px);max-height:min(310px,48vh);overflow:auto;border:1px solid #64748b;border-radius:7px;background:#fff;color:#0f172a;box-shadow:0 14px 34px rgba(15,23,42,.34)}
      .az-lot-location-option{display:block;width:100%;padding:9px 11px;border:0;border-bottom:1px solid #e2e8f0;background:#fff;color:#0f172a;text-align:left;cursor:pointer}
      .az-lot-location-option:last-of-type{border-bottom:0}
      .az-lot-location-option:hover,.az-lot-location-option.is-active{background:#dbeafe}
      .az-lot-location-option strong{display:flex;align-items:center;gap:7px;overflow:hidden;color:#0f172a;font-size:13px;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
      .az-lot-location-kind{flex:0 0 auto;padding:2px 5px;border:1px solid #93c5fd;border-radius:4px;background:#dbeafe;color:#1e3a8a;font-size:9px;font-style:normal;font-weight:900;line-height:1.1}
      .az-lot-location-kind.is-pa{border-color:#c4b5fd;background:#ede9fe;color:#5b21b6}
      .az-lot-location-option span{display:block;margin-top:2px;overflow:hidden;color:#475569;font-size:11px;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
      .az-lot-location-option strong>span{min-width:0;margin:0;color:#0f172a;font-size:13px;font-weight:800}
      .az-lot-location-attribution{padding:6px 10px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:10px;text-align:right}
      .az-lot-map-side{min-height:0;overflow:auto;padding:14px;border-left:1px solid #2d405b;background:#101c2f}
      .az-lot-map-status{min-height:42px;margin:0 0 12px;padding:10px 11px;border:1px solid #405574;border-radius:6px;background:#15233a;color:#d9e8ff;font-size:13px;line-height:1.45;white-space:pre-line}
      .az-lot-map-status.is-loading{border-color:#b97713;color:#ffe0a3;background:#2a2118}
      .az-lot-map-status.is-error{border-color:#c44949;color:#ffb7b7;background:#2b171d}
      .az-lot-map-status.is-success{border-color:#12855c;color:#74f5b7;background:#102b27}
      .az-lot-map-summary{display:grid;grid-template-columns:1fr auto;gap:0;border:1px solid #30445f;border-radius:6px;overflow:hidden;background:#142238}
      .az-lot-map-summary dt,.az-lot-map-summary dd{margin:0;padding:9px 10px;border-bottom:1px solid rgba(148,163,184,.16);font-size:13px}
      .az-lot-map-summary dt{color:#aebed4}.az-lot-map-summary dd{text-align:right;font-weight:800;color:#fff}
      .az-lot-map-summary dt:last-of-type,.az-lot-map-summary dd:last-of-type{border-bottom:0}
      .az-lot-map-price{margin:14px 0 10px;padding:11px;border:1px solid #e0b100;border-radius:6px;background:#ffd400;color:#111827;text-align:center;font-size:16px;font-weight:900}
      .az-lot-map-add{width:100%;min-height:48px;border:1px solid #4ff0b1;border-radius:6px;background:#0c9f72;color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 3px 0 #056a4c}
      .az-lot-map-add:disabled{cursor:not-allowed;opacity:.45;box-shadow:none}
      .az-lot-map-add.is-cart-success{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:8px 48px;background:#087f5b;border-color:#5cf2b5;line-height:1.15;text-align:center;cursor:pointer}
      .az-lot-map-add.is-cart-success:hover,.az-lot-map-add.is-cart-success:focus-visible{background:#07966b;box-shadow:0 0 0 3px rgba(92,242,181,.22)}
      .az-lot-map-cart-success-main{display:block;width:100%;text-align:center}
      .az-lot-map-cart-success-tick{position:absolute;right:12px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border:2px solid #fff;border-radius:50%;font-size:17px;font-weight:1000;line-height:1}
      .az-lot-map-cart-success-sub{display:block;width:100%;color:#d7fff0;font-size:12px;font-weight:800;text-align:center}
      .az-lot-map-reset{width:100%;min-height:40px;margin-top:9px;border:1px solid #49607e;border-radius:6px;background:#1c2d46;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #07101e}
      .az-lot-map-modal .leaflet-container{font-family:Arial,sans-serif;background:#d8e1eb}
      .az-lot-map-modal .leaflet-draw-toolbar a{background-color:#fff}
      .az-lot-map-modal .leaflet-control-layers{border-radius:6px}
      .az-lot-focus-dialog .az-lot-map-body{grid-template-columns:minmax(0,1fr) 300px}
      .az-lot-focus-dialog .az-lot-map-stage{min-height:460px}
      .az-lot-focus-details{display:grid;grid-template-columns:minmax(0,1fr) auto;margin:0;border:1px solid #30445f;border-radius:6px;overflow:hidden;background:#142238}
      .az-lot-focus-details dt,.az-lot-focus-details dd{margin:0;padding:10px;border-bottom:1px solid rgba(148,163,184,.16);font-size:13px}
      .az-lot-focus-details dt{color:#aebed4}.az-lot-focus-details dd{text-align:right;font-weight:800;color:#fff;overflow-wrap:anywhere}
      .az-lot-focus-details dt:last-of-type,.az-lot-focus-details dd:last-of-type{border-bottom:0}
      .az-lot-focus-open{display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;margin-top:12px;border:1px solid #60a5fa;border-radius:6px;background:#1d4ed8;color:#fff!important;font-weight:900;text-decoration:none!important;box-shadow:0 2px 0 #172554}
      .az-lot-focus-note{margin:12px 0 0;color:#9fb3cf;font-size:12px;line-height:1.45}
      .az-lot-search-tooltip{border:1px solid #b91c1c!important;background:#fff7cc!important;color:#7f1d1d!important;font-weight:900!important;box-shadow:0 2px 8px rgba(15,23,42,.3)!important}
      .az-lot-focus-dialog .az-lot-map-canvas.is-loading:after{content:'Sedang memuatkan lot JUPEM...';position:absolute;z-index:500;left:50%;top:50%;transform:translate(-50%,-50%);padding:10px 14px;border-radius:6px;background:rgba(15,23,42,.9);color:#fff;font-weight:800;white-space:nowrap}
      @media(max-width:760px){
        .az-lot-map-modal{padding:0;align-items:stretch}
        .az-lot-map-dialog{width:100vw;height:100dvh;border:0;border-radius:0}
        .az-lot-map-body{display:flex;flex-direction:column;overflow:auto}
        .az-lot-map-stage{flex:0 0 56vh;min-height:360px}
        .az-lot-coordinate-search{top:58px;left:52px;width:calc(100% - 64px)}
        .az-lot-map-side{overflow:visible;border-left:0;border-top:1px solid #2d405b}
        .az-lot-map-head h2{font-size:16px}
      }
    `;
    document.head.appendChild(style);
  }

  function loadStyle(href, id) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src, id) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === '1') resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.addEventListener('load', () => {
        script.dataset.loaded = '1';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error('Komponen peta tidak dapat dimuatkan.')), { once: true });
      document.head.appendChild(script);
    });
  }

  function loadMapLibraries() {
    if (window.L && window.L.Control && window.L.Control.Draw) return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    loadStyle(LEAFLET_CSS, 'azobssLeafletCss');
    loadStyle(LEAFLET_DRAW_CSS, 'azobssLeafletDrawCss');
    libraryPromise = loadScript(LEAFLET_JS, 'azobssLeafletJs')
      .then(() => loadScript(LEAFLET_DRAW_JS, 'azobssLeafletDrawJs'));
    return libraryPromise;
  }

  function formatNumber(value, decimals) {
    return Number(value || 0).toLocaleString('ms-MY', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function geometryFromLayer(layer) {
    const geoJson = layer && layer.toGeoJSON ? layer.toGeoJSON() : null;
    const geometry = geoJson && geoJson.geometry;
    if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      throw new Error('Gunakan pilihan polygon atau segi empat tepat.');
    }
    const rings = geometry.type === 'MultiPolygon'
      ? geometry.coordinates.flatMap((polygon) => Array.isArray(polygon) ? polygon : [])
      : geometry.coordinates;
    return {
      rings: Array.isArray(rings) ? rings : [],
      spatialReference: { wkid: 4326 }
    };
  }

  function parseWgs84Coordinates(value) {
    const match = String(value || '').trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(?:,\s*|\s+)([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  }

  function isPaNumberSearch(value) {
    return /^(?:NO\.?\s*)?PA\s*[:#-]?\s*\d{1,12}$/i.test(String(value || '').trim());
  }

  function setStatus(node, message, state) {
    node.textContent = message || '';
    node.classList.remove('is-loading', 'is-error', 'is-success');
    if (state) node.classList.add(`is-${state}`);
  }

  async function postJson(path, payload, token, signal) {
    const response = await fetch(`${BACKEND_BASE}${path}`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Pilihan tidak dapat diproses.');
    return data;
  }

  window.azobssOpenLotSelectionMap = async function (options) {
    const inputOptions = options && typeof options === 'object' ? options : {};
    const productCode = String(inputOptions.productCode || '1') === '2' ? '2' : '1';
    const rawStateCode = String(inputOptions.stateCode || '').trim();
    const stateCode = rawStateCode ? rawStateCode.padStart(2, '0') : '';
    const stateName = String(inputOptions.stateName || '').trim();
    const initialFocus = inputOptions.initialFocus && typeof inputOptions.initialFocus === 'object'
      ? { ...inputOptions.initialFocus }
      : null;
    const initialResolvedFocus = initialFocus && initialFocus.resolvedFocus && typeof initialFocus.resolvedFocus === 'object'
      ? initialFocus.resolvedFocus
      : null;
    const isDirectLotFocus = Boolean(initialFocus && (initialFocus.lotNo || initialFocus.paNo || initialFocus.mapUrl || initialFocus.objectId || initialResolvedFocus));
    if (!stateCode) throw new Error('Pilih negeri sebelum membuka peta.');

    if (typeof window.azobssCloseLotSelectionMap === 'function') {
      try { window.azobssCloseLotSelectionMap(); } catch (_) {}
    }
    addStyles();
    await loadMapLibraries();
    const configResponse = await fetch(`${BACKEND_BASE}/api/jupem-lot-map/config?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}`, { cache: 'no-store' });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.ok) throw new Error(config.error || 'Peta JUPEM tidak tersedia untuk negeri ini.');

    return await new Promise((resolve, reject) => {
      let settled = false;
      let map = null;
      let jupemLotsLayer = null;
      let jupemSheetsLayer = null;
      let jupemLayer = null;
      let jupemRefreshTimer = null;
      let jupemRecoveryTimer = null;
      let jupemRecoveryAttempts = 0;
      let jupemRecoveryWindowStartedAt = 0;
      let selectedGeometry = null;
      let estimate = null;
      let estimateController = null;
      let operationController = null;
      let activeStateCode = stateCode;
      let activeStateName = stateName || config.negeri;

      const previousBodyOverflow = document.body.style.overflow;
      const modal = document.createElement('div');
      modal.className = `az-lot-map-modal${isDirectLotFocus ? ' az-lot-focus-modal az-lot-unified-focus-modal' : ''}`;
      modal.innerHTML = `
        <section class="az-lot-map-dialog" role="dialog" aria-modal="true" aria-labelledby="azLotMapTitle">
          <header class="az-lot-map-head">
            <div><h2 id="azLotMapTitle">Peta Pilihan Lot Kadaster</h2><small data-map-state>${activeStateName} &middot; ${productCode === '2' ? 'Lot Kadaster Berdigit C3' : 'Lot Kadaster Berdigit'}</small></div>
            <button class="az-lot-map-close" type="button" aria-label="Tutup" title="Tutup">&times;</button>
          </header>
          <div class="az-lot-map-body">
            <div class="az-lot-map-stage">
              <div class="az-lot-map-canvas"></div>
              <div class="az-lot-coordinate-search">
                <form class="az-lot-coordinate-form" role="search">
                  <input class="az-lot-coordinate-input" type="text" inputmode="text" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="azLotLocationResults" aria-label="Cari koordinat WGS84, nama tempat atau nombor lot" placeholder="WGS84, nama tempat atau No. Lot">
                  <button class="az-lot-coordinate-submit" type="submit" title="Cari koordinat, lokasi atau lot">Cari</button>
                </form>
                <div class="az-lot-coordinate-feedback" role="status" aria-live="polite"></div>
                <div class="az-lot-location-results" id="azLotLocationResults" role="listbox" hidden></div>
              </div>
            </div>
            <aside class="az-lot-map-side">
              <p class="az-lot-map-status" role="status" aria-live="polite">${isDirectLotFocus ? 'Sedang memaparkan lot yang dipilih. Carian dan alat pilihan kawasan masih boleh digunakan.' : 'Zum masuk, kemudian pilih kawasan menggunakan alat polygon atau segi empat.'}</p>
              <dl class="az-lot-map-summary">
                <dt>Jumlah lot</dt><dd data-lot-count>-</dd>
                <dt>Keluasan pilihan</dt><dd data-lot-area>-</dd>
                <dt>Garisan syit dilintasi</dt><dd data-sheet-count>-</dd>
                <dt>Nisbah saiz 1 syit</dt><dd data-sheet-ratio>-</dd>
              </dl>
              <div class="az-lot-map-price" data-lot-price>Harga akan dikira automatik</div>
              <button class="az-lot-map-add" type="button" disabled>Sediakan &amp; Tambah ke Troli</button>
              <button class="az-lot-map-reset" type="button">Padam Pilihan</button>
            </aside>
          </div>
        </section>`;
      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      const canvas = modal.querySelector('.az-lot-map-canvas');
      const mapTitleNode = modal.querySelector('#azLotMapTitle');
      const coordinateForm = modal.querySelector('.az-lot-coordinate-form');
      const coordinateInput = modal.querySelector('.az-lot-coordinate-input');
      const coordinateFeedback = modal.querySelector('.az-lot-coordinate-feedback');
      const locationResultsNode = modal.querySelector('.az-lot-location-results');
      const status = modal.querySelector('.az-lot-map-status');
      const addButton = modal.querySelector('.az-lot-map-add');
      const resetButton = modal.querySelector('.az-lot-map-reset');
      const countNode = modal.querySelector('[data-lot-count]');
      const areaNode = modal.querySelector('[data-lot-area]');
      const sheetNode = modal.querySelector('[data-sheet-count]');
      const ratioNode = modal.querySelector('[data-sheet-ratio]');
      const priceNode = modal.querySelector('[data-lot-price]');
      const mapStateNode = modal.querySelector('[data-map-state]');
      const drawnItems = new window.L.FeatureGroup();
      if (isDirectLotFocus && mapTitleNode) {
        const directLotNo = String(initialFocus.lotNo || '').trim();
        mapTitleNode.textContent = directLotNo ? `Peta Pilihan Lot ${directLotNo}` : 'Peta Pilihan Lot Kadaster';
      }
      let coordinateMarker = null;
      let cadastreFocusLayer = null;
      let cadastreFocusController = null;
      let cadastreFocusSerial = 0;
      let cadastreRefitTimers = [];
      let locationSuggestions = [];
      let activeLocationIndex = -1;
      let locationSearchTimer = null;
      let locationSearchController = null;
      let locationSearchSerial = 0;

      function setCoordinateFeedback(message, state = 'error') {
        coordinateFeedback.textContent = message || '';
        coordinateFeedback.classList.toggle('is-visible', Boolean(message));
        coordinateFeedback.classList.remove('is-info', 'is-loading', 'is-success');
        if (message && state && state !== 'error') coordinateFeedback.classList.add(`is-${state}`);
        coordinateInput.setAttribute('aria-invalid', message && state === 'error' ? 'true' : 'false');
      }

      function refreshJupemOverlay(delay = 100, forceReload = true) {
        if (jupemRefreshTimer) window.clearTimeout(jupemRefreshTimer);
        jupemRefreshTimer = window.setTimeout(() => {
          jupemRefreshTimer = null;
          if (!map || !jupemLayer || !map.hasLayer(jupemLayer)) return;
          try { map.invalidateSize({ pan: false }); } catch (_) {}
          [jupemLotsLayer, jupemSheetsLayer].forEach((layer) => {
            if (!layer || !map.hasLayer(layer)) return;
            try {
              if (forceReload && typeof layer.redraw === 'function') layer.redraw();
            } catch (_) {}
            try { layer.bringToFront(); } catch (_) {}
          });
          try { if (cadastreFocusLayer) cadastreFocusLayer.bringToFront(); } catch (_) {}
          try { drawnItems.bringToFront(); } catch (_) {}
          try { if (coordinateMarker) coordinateMarker.bringToFront(); } catch (_) {}
        }, Math.max(0, Number(delay) || 0));
      }

      function scheduleJupemTileRecovery() {
        const now = Date.now();
        if (!jupemRecoveryWindowStartedAt || now - jupemRecoveryWindowStartedAt > 15000) {
          jupemRecoveryWindowStartedAt = now;
          jupemRecoveryAttempts = 0;
        }
        if (jupemRecoveryAttempts >= 2 || jupemRecoveryTimer) return;
        jupemRecoveryAttempts += 1;
        jupemRecoveryTimer = window.setTimeout(() => {
          jupemRecoveryTimer = null;
          refreshJupemOverlay(0, true);
        }, 450 + (jupemRecoveryAttempts * 350));
      }

      function hideLocationSuggestions(clear = false) {
        activeLocationIndex = -1;
        coordinateInput.setAttribute('aria-expanded', 'false');
        coordinateInput.removeAttribute('aria-activedescendant');
        locationResultsNode.hidden = true;
        locationResultsNode.querySelectorAll('.az-lot-location-option').forEach((node) => {
          node.classList.remove('is-active');
          node.setAttribute('aria-selected', 'false');
        });
        if (clear) {
          locationSuggestions = [];
          locationResultsNode.replaceChildren();
        }
      }

      function setActiveLocationIndex(index) {
        if (!locationSuggestions.length) return;
        activeLocationIndex = ((index % locationSuggestions.length) + locationSuggestions.length) % locationSuggestions.length;
        const optionsNodes = Array.from(locationResultsNode.querySelectorAll('.az-lot-location-option'));
        optionsNodes.forEach((node, optionIndex) => {
          const isActive = optionIndex === activeLocationIndex;
          node.classList.toggle('is-active', isActive);
          node.setAttribute('aria-selected', isActive ? 'true' : 'false');
          if (isActive) {
            coordinateInput.setAttribute('aria-activedescendant', node.id);
            node.scrollIntoView({ block: 'nearest' });
          }
        });
      }

      function clearCadastreFocus(invalidateRequest = true) {
        if (invalidateRequest) cadastreFocusSerial += 1;
        cadastreRefitTimers.forEach((timer) => window.clearTimeout(timer));
        cadastreRefitTimers = [];
        if (cadastreFocusController) {
          try { cadastreFocusController.abort(); } catch (_) {}
          cadastreFocusController = null;
        }
        if (cadastreFocusLayer && map) {
          try { map.removeLayer(cadastreFocusLayer); } catch (_) {}
        }
        cadastreFocusLayer = null;
      }

      async function focusCadastreSuggestion(suggestion, keepLabel = true) {
        const lotNo = String(suggestion && suggestion.lotNo || '').trim();
        const paNo = String(suggestion && suggestion.paNo || '').trim();
        const suggestionStateCode = String(suggestion && suggestion.stateCode || activeStateCode).padStart(2, '0');
        const suggestionStateName = String(suggestion && (suggestion.negeri || suggestion.stateName || suggestion.state) || '').trim();
        if (!lotNo && !paNo) return;
        clearCadastreFocus(false);
        // A lot opened from Cari Lot must become the active purchase selection.
        // Remove any older hand-drawn rectangle/polygon so its large estimate
        // cannot remain attached to the newly focused lot.
        drawnItems.clearLayers();
        if (estimateController) {
          try { estimateController.abort(); } catch (_) {}
          estimateController = null;
        }
        clearSummary();
        const focusSerial = ++cadastreFocusSerial;
        if (coordinateMarker) {
          try { map.removeLayer(coordinateMarker); } catch (_) {}
          coordinateMarker = null;
        }
        cadastreFocusController = new AbortController();
        hideLocationSuggestions(false);
        setCoordinateFeedback(`Mencari lokasi tepat ${paNo || `Lot ${lotNo}`} di JUPEM...`, 'loading');
        try {
          const preResolved = suggestion && suggestion.resolvedFocus && typeof suggestion.resolvedFocus === 'object'
            ? suggestion.resolvedFocus
            : null;
          const focused = preResolved || await fetchExactLotFocus(
            suggestion,
            String(suggestion && suggestion.productCode || productCode) === '2' ? '2' : '1',
            suggestionStateCode,
            cadastreFocusController.signal
          );
          if (focusSerial !== cadastreFocusSerial || settled || !map) return;
          const focusedLotCount = Math.max(1, Number(focused.lotCount || 1));
          const convertRing = (ring) => (Array.isArray(ring) ? ring.map((point) => {
            const latitude = Number(point && point[1]);
            const longitude = Number(point && point[0]);
            return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null;
          }).filter(Boolean) : []).filter(Boolean);
          const sourcePolygons = focused.geometry && Array.isArray(focused.geometry.polygons) ? focused.geometry.polygons : [];
          const leafletPolygons = sourcePolygons.map((polygon) => (Array.isArray(polygon)
            ? polygon.map(convertRing).filter((ring) => ring.length >= 3)
            : [])).filter((polygon) => polygon.length);
          const rings = focused.geometry && Array.isArray(focused.geometry.rings) ? focused.geometry.rings : [];
          const leafletRings = rings.map(convertRing).filter((ring) => ring.length >= 3);
          const focusShape = leafletPolygons.length ? leafletPolygons : leafletRings;
          if (!focusShape.length) throw new Error('Geometri lot JUPEM tidak tersedia.');
          cadastreFocusLayer = window.L.polygon(focusShape, {
            color: '#ef4444',
            weight: 4,
            opacity: 1,
            fillColor: '#facc15',
            fillOpacity: 0.3,
            interactive: true
          }).addTo(map);
          const focusedLot = String(focused.lotNo || lotNo || '').trim();
          const focusedPa = String(focused.paNo || paNo || '').trim();
          const focusedStateCode = String(focused.stateCode || suggestionStateCode || activeStateCode).padStart(2, '0');
          const focusedStateName = String(focused.negeri || suggestionStateName || activeStateName).trim();
          const tooltip = focusedLot
            ? [`Lot ${focusedLot}`, focusedPa].filter(Boolean).join(' · ')
            : [focusedPa, focusedLotCount > 1 ? `${focusedLotCount} lot` : ''].filter(Boolean).join(' · ');
          cadastreFocusLayer.bindTooltip(tooltip || 'Lot JUPEM', {
            permanent: true,
            direction: 'center',
            className: 'az-lot-search-tooltip'
          }).openTooltip();
          activeStateCode = focusedStateCode;
          activeStateName = focusedStateName || activeStateName;
          if (mapStateNode) {
            mapStateNode.textContent = `${activeStateName} · ${productCode === '2' ? 'Lot Kadaster Berdigit C3' : 'Lot Kadaster Berdigit'}`;
          }
          const applyExactFocus = () => {
            if (focusSerial !== cadastreFocusSerial || settled || !map || !cadastreFocusLayer) return;
            try { map.stop(); } catch (_) {}
            try { map.invalidateSize({ pan: false }); } catch (_) {}
            // The rendered polygon is the source of truth. Using its live Leaflet
            // bounds avoids a stale initial state view or server-bound conversion
            // from winning on the first click.
            const exactBounds = cadastreFocusLayer.getBounds();
            if (!exactBounds || !exactBounds.isValid || !exactBounds.isValid()) return;
            map.fitBounds(exactBounds, { padding: [70, 70], maxZoom: 19, animate: false, duration: 0 });
            try { cadastreFocusLayer.bringToFront(); } catch (_) {}
          };
          applyExactFocus();
          // Re-lock the same lot after the modal and tile pane finish their first
          // layout. These are position locks, not a second network lookup.
          cadastreRefitTimers = [80, 240, 650].map((delay) => window.setTimeout(applyExactFocus, delay));
          if (keepLabel) coordinateInput.value = [
            focusedPa,
            focusedLot ? `Lot ${focusedLot}` : '',
            !focusedLot && focusedLotCount > 1 ? `${focusedLotCount} lot` : '',
            focusedStateName
          ].filter(Boolean).join(' · ');
          hideLocationSuggestions(true);
          const paLotNotice = !focusedLot && focusedLotCount > 1 ? ` · ${focusedLotCount} lot dalam PA dipaparkan` : (focusedLot && focusedPa ? ` · Lot ${focusedLot}` : '');
          setCoordinateFeedback(`${focusedPa || `Lot ${focusedLot}`} ditemui di ${focusedStateName || 'negeri berkenaan'}${paLotNotice}.`, 'success');

          // Use the exact JUPEM polygon as the active selection immediately.
          // This makes LIHAT PETA from Cari Lot behave like Buka Peta Pilihan,
          // without requiring the customer to draw a second rectangle manually.
          await estimateLayer(cadastreFocusLayer);
          if (focusSerial !== cadastreFocusSerial || settled || !map) return;
          if (estimate && selectedGeometry) {
            setStatus(status, `${focusedLot ? `Lot ${focusedLot}` : focusedPa} telah dipilih tepat dan sedia disediakan. Kamu masih boleh melukis kawasan lain menggunakan polygon atau segi empat.`, 'success');
          } else {
            setStatus(status, `${focusedLot ? `Lot ${focusedLot}` : focusedPa} dipaparkan tepat pada peta, tetapi anggaran pilihan belum berjaya. Sila cuba semula atau lukis kawasan secara manual.`, 'error');
          }
          refreshJupemOverlay(120, true);
        } catch (error) {
          if (error && error.name === 'AbortError') return;
          if (focusSerial !== cadastreFocusSerial) return;
          clearCadastreFocus();
          setCoordinateFeedback(error.message || 'Lot atau PA tidak dapat dipaparkan.', 'error');
        }
      }

      function selectMapSuggestion(suggestion, keepLabel = true) {
        const kind = String(suggestion && suggestion.kind || 'location').toLowerCase();
        if (kind === 'lot' || kind === 'pa') {
          focusCadastreSuggestion(suggestion, keepLabel);
          return;
        }
        placeLocationMarker(suggestion, keepLabel);
      }

      function placeLocationMarker(location, keepLabel = true) {
        clearCadastreFocus();
        const latitude = Number(location && location.latitude);
        const longitude = Number(location && location.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const point = [latitude, longitude];
        if (coordinateMarker) map.removeLayer(coordinateMarker);
        coordinateMarker = window.L.circleMarker(point, {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: '#dc2626',
          fillOpacity: 1
        }).addTo(map);
        const label = String(location.label || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`).trim();
        coordinateMarker.bindTooltip(label, {
          direction: 'top',
          offset: [0, -8]
        }).openTooltip();

        const extent = Array.isArray(location.extent) ? location.extent.map(Number) : null;
        try { map.stop(); } catch (_) {}
        if (extent && extent.length === 4 && extent.every(Number.isFinite)) {
          const west = Math.min(extent[0], extent[2]);
          const east = Math.max(extent[0], extent[2]);
          const south = Math.min(extent[1], extent[3]);
          const north = Math.max(extent[1], extent[3]);
          const bounds = [[south, west], [north, east]];
          map.fitBounds(bounds, { padding: [42, 42], maxZoom: 17, animate: false });
          const targetZoom = Math.max(16, Math.min(17, map.getZoom()));
          map.setView(point, targetZoom, { animate: false });
        } else {
          map.setView(point, Math.max(17, map.getZoom()), { animate: false });
        }
        refreshJupemOverlay(140, true);
        if (keepLabel) coordinateInput.value = label;
        hideLocationSuggestions(true);
        setCoordinateFeedback(`Lokasi dipilih: ${label}`, 'success');
      }

      function renderLocationSuggestions(results) {
        locationSuggestions = (Array.isArray(results) ? results : []).filter((item) => String(item && item.kind || '').toLowerCase() !== 'pa');
        activeLocationIndex = -1;
        locationResultsNode.replaceChildren();
        if (!locationSuggestions.length) {
          hideLocationSuggestions(false);
          return;
        }

        locationSuggestions.forEach((location, index) => {
          const option = document.createElement('button');
          option.type = 'button';
          option.className = 'az-lot-location-option';
          option.id = `azLotLocationOption${index}`;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          const title = document.createElement('strong');
          const kind = String(location.kind || 'location').toLowerCase();
          if (kind === 'lot') {
            const badge = document.createElement('em');
            badge.className = 'az-lot-location-kind';
            badge.textContent = 'LOT';
            title.appendChild(badge);
          }
          const titleText = document.createElement('span');
          titleText.textContent = String(location.name || location.label || 'Lokasi');
          title.appendChild(titleText);
          const detail = document.createElement('span');
          detail.textContent = String(location.detail || location.label || 'Malaysia');
          option.append(title, detail);
          option.addEventListener('mousedown', (event) => event.preventDefault());
          option.addEventListener('click', () => selectMapSuggestion(location, true));
          locationResultsNode.appendChild(option);
        });
        const attribution = document.createElement('div');
        attribution.className = 'az-lot-location-attribution';
        const hasCadastre = locationSuggestions.some((item) => String(item && item.kind || '').toLowerCase() === 'lot');
        attribution.textContent = hasCadastre ? 'Carian lot: JUPEM eBiz' : 'Carian lokasi: © OpenStreetMap contributors';
        locationResultsNode.appendChild(attribution);
        locationResultsNode.hidden = false;
        coordinateInput.setAttribute('aria-expanded', 'true');
      }

      async function searchLocationSuggestions(queryValue, chooseFirst = false) {
        const query = String(queryValue || '').replace(/\s+/g, ' ').trim();
        if (isPaNumberSearch(query)) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Gunakan WGS84, nama tempat atau No. Lot untuk carian peta.', 'info');
          return;
        }
        if (query.length < 3) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Taip sekurang-kurangnya 3 aksara untuk mencari lokasi atau lot.', 'info');
          return;
        }
        if (locationSearchController) locationSearchController.abort();
        locationSearchController = new AbortController();
        const serial = ++locationSearchSerial;
        setCoordinateFeedback('Mencari lokasi atau nombor lot...', 'loading');
        try {
          const response = await fetch(`${BACKEND_BASE}/api/map-location-suggestions?q=${encodeURIComponent(query)}&negeri=${encodeURIComponent(activeStateCode)}&produk=${encodeURIComponent(productCode)}`, {
            cache: 'no-store',
            signal: locationSearchController.signal
          });
          const data = await response.json().catch(() => ({}));
          if (serial !== locationSearchSerial) return;
          if (!response.ok || !data.ok) throw new Error(data.error || 'Carian peta tidak tersedia.');
          renderLocationSuggestions(data.results || []);
          if (!locationSuggestions.length) {
            setCoordinateFeedback(`Tiada lokasi atau lot ditemui untuk “${query}”.`, 'error');
            return;
          }
          const hasCadastre = locationSuggestions.some((item) => String(item && item.kind || '').toLowerCase() === 'lot');
          setCoordinateFeedback(hasCadastre ? 'Pilih lot daripada cadangan. Negeri dipaparkan pada setiap hasil.' : 'Pilih lokasi daripada cadangan atau gunakan ↑ ↓ dan Enter.', 'info');
          if (chooseFirst && locationSuggestions.length === 1) selectMapSuggestion(locationSuggestions[0], true);
          else if (chooseFirst && !hasCadastre) selectMapSuggestion(locationSuggestions[0], true);
        } catch (error) {
          if (error && error.name === 'AbortError') return;
          if (serial !== locationSearchSerial) return;
          hideLocationSuggestions(true);
          setCoordinateFeedback(error.message || 'Carian peta tidak tersedia.', 'error');
        }
      }

      function findCoordinateOrLocation() {
        const raw = String(coordinateInput.value || '').trim();
        if (isPaNumberSearch(raw)) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Gunakan WGS84, nama tempat atau No. Lot untuk carian peta.', 'info');
          return;
        }
        const coordinate = parseWgs84Coordinates(raw);
        if (coordinate) {
          placeLocationMarker({
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            label: `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
          }, false);
          coordinateInput.value = raw;
          setCoordinateFeedback('Koordinat WGS84 ditemui dan penanda telah diletakkan.', 'success');
          return;
        }
        if (activeLocationIndex >= 0 && locationSuggestions[activeLocationIndex]) {
          selectMapSuggestion(locationSuggestions[activeLocationIndex], true);
          return;
        }
        if (locationSuggestions.length === 1) {
          selectMapSuggestion(locationSuggestions[0], true);
          return;
        }
        if (locationSuggestions.length) {
          const hasCadastre = locationSuggestions.some((item) => String(item && item.kind || '').toLowerCase() === 'lot');
          if (!hasCadastre) {
            selectMapSuggestion(locationSuggestions[0], true);
            return;
          }
          setCoordinateFeedback('Terdapat beberapa hasil lot. Pilih hasil yang betul berdasarkan negeri dan butiran kawasan.', 'info');
          return;
        }
        searchLocationSuggestions(raw, true);
      }

      function scheduleLocationSuggestions() {
        const raw = String(coordinateInput.value || '').trim();
        if (locationSearchTimer) window.clearTimeout(locationSearchTimer);
        if (locationSearchController) locationSearchController.abort();
        hideLocationSuggestions(true);
        if (!raw) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('');
          return;
        }
        if (isPaNumberSearch(raw)) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Gunakan WGS84, nama tempat atau No. Lot untuk carian peta.', 'info');
          return;
        }
        if (parseWgs84Coordinates(raw)) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Koordinat sah. Tekan Enter atau Cari untuk meletakkan penanda.', 'info');
          return;
        }
        if (raw.length < 3) {
          hideLocationSuggestions(true);
          setCoordinateFeedback('Taip sekurang-kurangnya 3 aksara untuk cadangan lokasi atau lot.', 'info');
          return;
        }
        locationSearchTimer = window.setTimeout(() => searchLocationSuggestions(raw, false), 450);
      }

      function cleanup() {
        if (estimateController) estimateController.abort();
        if (operationController) operationController.abort();
        if (locationSearchTimer) window.clearTimeout(locationSearchTimer);
        if (locationSearchController) locationSearchController.abort();
        clearCadastreFocus();
        if (jupemRefreshTimer) window.clearTimeout(jupemRefreshTimer);
        if (jupemRecoveryTimer) window.clearTimeout(jupemRecoveryTimer);
        locationSearchSerial += 1;
        document.removeEventListener('keydown', onDocumentKeyDown);
        try { if (map) map.remove(); } catch (_) {}
        modal.remove();
        document.body.style.overflow = previousBodyOverflow;
        if (window.azobssCloseLotSelectionMap === close) window.azobssCloseLotSelectionMap = null;
      }

      function close() {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Object.assign(new Error('Peta pilihan ditutup.'), { code: 'MAP_CLOSED' }));
      }

      function onDocumentKeyDown(event) {
        if (event.key !== 'Escape') return;
        if (document.activeElement === coordinateInput && !locationResultsNode.hidden) return;
        close();
      }

      window.azobssCloseLotSelectionMap = close;
      document.addEventListener('keydown', onDocumentKeyDown);

      function setAddButtonDefault() {
        addButton.classList.remove('is-cart-success');
        addButton.removeAttribute('title');
        addButton.removeAttribute('aria-label');
        addButton.textContent = 'Sediakan & Tambah ke Troli';
      }

      function setAddButtonSuccess() {
        addButton.classList.add('is-cart-success');
        addButton.disabled = false;
        addButton.setAttribute('aria-label', 'Telah dimasukkan ke troli anda. Tekan untuk pergi ke Troli anda.');
        addButton.title = 'Tekan untuk pergi ke Troli anda';
        addButton.innerHTML = '<span class="az-lot-map-cart-success-main">Sudah Masuk Troli</span><span class="az-lot-map-cart-success-tick" aria-hidden="true">✓</span><small class="az-lot-map-cart-success-sub">(Sila tekan untuk ke Troli)</small>';
      }

      function focusCartPanel() {
        const cartPanel = document.getElementById('pabmStoreCartPanel');
        close();
        window.setTimeout(() => {
          if (!cartPanel) return;
          cartPanel.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          cartPanel.setAttribute('tabindex', '-1');
          try { cartPanel.focus({ preventScroll: true }); } catch (_) { try { cartPanel.focus(); } catch (_) {} }
          cartPanel.classList.remove('is-cart-updated');
          window.requestAnimationFrame(() => cartPanel.classList.add('is-cart-updated'));
          window.setTimeout(() => cartPanel.classList.remove('is-cart-updated'), 2200);
        }, 60);
      }

      function clearSummary() {
        selectedGeometry = null;
        estimate = null;
        addButton.disabled = true;
        setAddButtonDefault();
        countNode.textContent = '-';
        areaNode.textContent = '-';
        sheetNode.textContent = '-';
        ratioNode.textContent = '-';
        priceNode.textContent = 'Harga akan dikira automatik';
      }

      async function estimateLayer(layer) {
        clearSummary();
        selectedGeometry = geometryFromLayer(layer);
        if (estimateController) estimateController.abort();
        estimateController = new AbortController();
        setStatus(status, 'Menyemak polygon, lot dan keluasan syit', 'loading');
        try {
          estimate = await postJson('/api/jupem-lot-selection/estimate', {
            productCode,
            stateCode: activeStateCode,
            geometry: selectedGeometry
          });
          const previousStateCode = activeStateCode;
          activeStateCode = String(estimate.stateCode || activeStateCode).padStart(2, '0');
          activeStateName = String(estimate.negeri || activeStateName).trim();
          if (mapStateNode) {
            mapStateNode.textContent = `${activeStateName} · ${productCode === '2' ? 'Lot Kadaster Berdigit C3' : 'Lot Kadaster Berdigit'}`;
          }
          countNode.textContent = formatNumber(estimate.lotCount, 0);
          areaNode.textContent = `${formatNumber(estimate.drawnAreaM2, 2)} m2`;
          sheetNode.textContent = formatNumber(estimate.sheetCount, 0);
          ratioNode.textContent = `${formatNumber(Number(estimate.areaRatio || 0) * 100, 2)}%`;
          const ratioPercent = Number(estimate.areaRatio || 0) * 100;
          const adjustedMapAmount = userAdjustedAmount(estimate.amount);
          priceNode.textContent = estimate.variant === 'FULL_SHEET'
            ? `${formatNumber(ratioPercent, 2)}% - Harga 1 Syit RM${formatNumber(userAdjustedAmount(50), 2).replace(/\.00$/, '')}`
            : `${formatNumber(ratioPercent, 2)}% - RM${formatNumber(adjustedMapAmount, 2).replace(/\.00$/, '')}`;
          addButton.disabled = false;
          const stateNotice = activeStateCode !== previousStateCode
            ? ` Negeri dikesan secara automatik: ${activeStateName}.`
            : '';
          setStatus(status, `${formatNumber(estimate.lotCount, 0)} lot disahkan.${stateNotice} Harga berdasarkan saiz kawasan pilihan, bukan garisan syit.`, 'success');
        } catch (error) {
          clearSummary();
          setStatus(status, error.message || 'Kawasan pilihan tidak dapat disemak.', 'error');
        }
      }

      try {
        map = window.L.map(canvas, { zoomControl: true, preferCanvas: true });
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 20,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        jupemLotsLayer = window.L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}&scope=all&layerMode=lots&layerSet=3`, {
          minZoom: Number(config.minSelectionZoom || 13),
          maxZoom: 20,
          opacity: 0.88,
          updateWhenIdle: false,
          updateWhenZooming: true,
          keepBuffer: 4,
          attribution: 'JUPEM eBiz'
        });
        jupemSheetsLayer = window.L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}&layerMode=sheets&layerSet=4`, {
          minZoom: Number(config.minSelectionZoom || 13),
          maxZoom: 20,
          opacity: 1,
          updateWhenIdle: false,
          updateWhenZooming: true,
          keepBuffer: 4,
          attribution: 'JUPEM eBiz'
        });
        jupemLotsLayer.on('tileerror', scheduleJupemTileRecovery);
        jupemSheetsLayer.on('tileerror', scheduleJupemTileRecovery);
        jupemLayer = window.L.layerGroup([jupemLotsLayer, jupemSheetsLayer]).addTo(map);
        const selectedStateLabel = stateName || config.negeri || 'Negeri Dipilih';
        window.L.control.layers(null, { [`Lot Semua Negeri & Garisan Syit ${selectedStateLabel}`]: jupemLayer }, { collapsed: false }).addTo(map);
        drawnItems.addTo(map);
        map.addControl(new window.L.Control.Draw({
          position: 'topleft',
          draw: {
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#ef4444', weight: 2, fillColor: '#facc15', fillOpacity: 0.22 } },
            rectangle: { shapeOptions: { color: '#ef4444', weight: 2, fillColor: '#facc15', fillOpacity: 0.22 } }
          },
          edit: { featureGroup: drawnItems, edit: true, remove: true }
        }));
        const bounds = Array.isArray(config.bounds) ? config.bounds : [[1, 99], [7, 120]];
        const initialExactBounds = initialResolvedFocus && Array.isArray(initialResolvedFocus.bounds) && initialResolvedFocus.bounds.length === 2
          ? initialResolvedFocus.bounds
          : null;
        if (isDirectLotFocus && initialExactBounds) {
          // Start at the requested lot immediately. Do not first fly to the whole
          // state, because that initial movement can overwrite the first focus.
          map.fitBounds(initialExactBounds, { padding: [70, 70], maxZoom: 19, animate: false, duration: 0 });
        } else {
          map.fitBounds(bounds, { padding: [16, 16], animate: false, duration: 0 });
        }
        map.on(window.L.Draw.Event.CREATED, (event) => {
          drawnItems.clearLayers();
          drawnItems.addLayer(event.layer);
          estimateLayer(event.layer);
        });
        map.on(window.L.Draw.Event.EDITED, (event) => {
          const layers = [];
          event.layers.eachLayer((layer) => layers.push(layer));
          if (layers[0]) estimateLayer(layers[0]);
        });
        map.on(window.L.Draw.Event.DELETED, () => {
          clearSummary();
          setStatus(status, 'Pilihan dipadam. Lukis kawasan baharu.', '');
        });
        map.on('overlayadd', (event) => {
          if (event && event.layer === jupemLayer) refreshJupemOverlay(80, true);
        });
        window.setTimeout(() => {
          map.invalidateSize();
          refreshJupemOverlay(80, true);
        }, 100);
        if (isDirectLotFocus) {
          const launchInitialFocus = () => {
            if (!map || settled) return;
            try { map.stop(); } catch (_) {}
            try { map.invalidateSize({ pan: false }); } catch (_) {}
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
              if (!map || settled) return;
              focusCadastreSuggestion({
                ...initialFocus,
                resolvedFocus: initialResolvedFocus,
                stateCode: String(initialFocus.stateCode || stateCode).padStart(2, '0'),
                stateName: String(initialFocus.stateName || stateName || config.negeri || '').trim(),
                productCode
              }, true);
            }));
          };
          map.whenReady(() => window.setTimeout(launchInitialFocus, 60));
        }
      } catch (error) {
        cleanup();
        settled = true;
        reject(error);
        return;
      }

      modal.querySelector('.az-lot-map-close').addEventListener('click', close);
      coordinateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        findCoordinateOrLocation();
      });
      coordinateInput.addEventListener('input', scheduleLocationSuggestions);
      coordinateInput.addEventListener('focus', () => {
        if (locationSuggestions.length) {
          locationResultsNode.hidden = false;
          coordinateInput.setAttribute('aria-expanded', 'true');
        }
      });
      coordinateInput.addEventListener('blur', () => {
        window.setTimeout(() => hideLocationSuggestions(false), 140);
      });
      coordinateInput.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && locationSuggestions.length) {
          event.preventDefault();
          setActiveLocationIndex(activeLocationIndex + 1);
          return;
        }
        if (event.key === 'ArrowUp' && locationSuggestions.length) {
          event.preventDefault();
          setActiveLocationIndex(activeLocationIndex < 0 ? locationSuggestions.length - 1 : activeLocationIndex - 1);
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          hideLocationSuggestions(false);
          setCoordinateFeedback('Cadangan carian ditutup. Tekan Cari untuk mencari semula.', 'info');
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          findCoordinateOrLocation();
        }
      });
      modal.addEventListener('pointerdown', (event) => {
        if (!event.target.closest('.az-lot-coordinate-search')) hideLocationSuggestions(false);
      });
      resetButton.addEventListener('click', () => {
        drawnItems.clearLayers();
        clearCadastreFocus();
        if (coordinateMarker && map) {
          try { map.removeLayer(coordinateMarker); } catch (_) {}
          coordinateMarker = null;
        }
        coordinateInput.value = '';
        hideLocationSuggestions(true);
        setCoordinateFeedback('');
        clearSummary();
        setStatus(status, 'Pilihan dipadam. Cari lot lain atau lukis kawasan baharu.', '');
      });
      addButton.addEventListener('click', async () => {
        if (addButton.classList.contains('is-cart-success')) {
          focusCartPanel();
          return;
        }
        if (!selectedGeometry || !estimate || addButton.disabled) return;
        addButton.disabled = true;
        addButton.classList.remove('is-cart-success');
        addButton.textContent = 'Mendapatkan lot pilihan...';
        setStatus(status, 'Mendapatkan lot pilihan...', 'loading');
        try {
          operationController = new AbortController();
          const token = typeof options.getAuthToken === 'function' ? await options.getAuthToken() : '';
          if (!token) throw new Error('Sesi log masuk tidak tersedia. Sila log masuk semula.');
          let prepared = await postJson('/api/jupem-lot-selection/prepare', {
            productCode,
            stateCode: activeStateCode,
            geometry: selectedGeometry
          }, token, operationController.signal);
          if (!prepared.jobId || !prepared.selectionToken) {
            throw new Error('ID pilihan Lot Kadaster tidak berjaya diperoleh. Sila cuba semula.');
          }

          while (!prepared.ready) {
            addButton.disabled = true;
            addButton.textContent = 'Sedang Diproses...';
            setStatus(status, 'Sedang proses fail Lot Kadaster...\n(Mengambil masa sekitar 1~2 minit)', 'loading');
            await new Promise((resolveDelay, rejectDelay) => {
              const timer = window.setTimeout(resolveDelay, 2500);
              if (operationController && operationController.signal) {
                operationController.signal.addEventListener('abort', () => {
                  window.clearTimeout(timer);
                  rejectDelay(new DOMException('Operasi dibatalkan.', 'AbortError'));
                }, { once: true });
              }
            });
            const previousPrepared = prepared;
            const statusUpdate = await postJson('/api/jupem-lot-selection/status', {
              selectionToken: previousPrepared.selectionToken
            }, token, operationController.signal);
            // 570: A temporary 202 response may contain only status fields. Merge it
            // instead of replacing the signed token and trusted selection metadata.
            prepared = {
              ...previousPrepared,
              ...statusUpdate,
              selectionToken: String(statusUpdate.selectionToken || previousPrepared.selectionToken || '').trim(),
              jobId: String(statusUpdate.jobId || previousPrepared.jobId || '').trim(),
              productCode: String(statusUpdate.productCode || previousPrepared.productCode || productCode || '').trim(),
              stateCode: String(statusUpdate.stateCode || previousPrepared.stateCode || activeStateCode || '').trim()
            };
            if (!prepared.selectionToken) {
              throw new Error('Token pilihan Lot Kadaster hilang semasa semakan status. Sila cuba semula.');
            }
          }

          if (!/^esriJobSucceeded$/i.test(String(prepared.jobStatus || '')) || !prepared.downloadUrl) {
            throw new Error('Fail Lot Kadaster belum berjaya disediakan. Sila tunggu dan cuba semula.');
          }
          let confirmationMessage = 'Fail Lot Kadaster berjaya disediakan.';
          if (typeof inputOptions.onPrepared === 'function') {
            const confirmation = await inputOptions.onPrepared(prepared);
            confirmationMessage = String(
              confirmation && typeof confirmation === 'object'
                ? (confirmation.message || confirmation.confirmationMessage || '')
                : (confirmation || '')
            ).trim() || confirmationMessage;
          }
          setAddButtonSuccess();
          setStatus(status, `✓ ${confirmationMessage} Sila cek di Troli anda. Tekan X apabila selesai.`, 'success');
          // Resolve the caller after the cart is updated, but keep the Leaflet
          // modal alive. The close button will perform cleanup later.
          resolve(prepared);
        } catch (error) {
          addButton.disabled = false;
          setAddButtonDefault();
          setStatus(status, error.message || 'JUPEM tidak dapat menyediakan pilihan ini.', 'error');
        }
      });
    });
  };

  window.azobssOpenLotFocusMap = async function (options) {
    const input = options && typeof options === 'object' ? options : {};
    const openSerial = ++lotFocusOpenSerial;
    if (lotFocusPrefetchController) {
      try { lotFocusPrefetchController.abort(); } catch (_) {}
    }
    // Close any previous map before resolving the next target. This prevents an
    // old modal or old moveend event from shifting the newly requested lot.
    if (typeof window.azobssCloseLotSelectionMap === 'function') {
      try { window.azobssCloseLotSelectionMap(); } catch (_) {}
    }

    let stateCode = String(input.stateCode || '').trim();
    const mapUrl = String(input.mapUrl || input.url || '').trim();
    if (!stateCode && mapUrl) {
      try {
        const parsed = new URL(mapUrl, 'https://ebiz.jupem.gov.my/');
        stateCode = String(parsed.searchParams.get('neg') || parsed.searchParams.get('negeri') || parsed.searchParams.get('state') || '').trim();
        if (!stateCode) {
          const typeMatch = String(parsed.searchParams.get('type') || '').match(/^(\d{2})lot/i);
          stateCode = typeMatch ? typeMatch[1] : '';
        }
      } catch (_) {}
    }
    stateCode = stateCode ? stateCode.padStart(2, '0') : '';
    const productCode = String(input.productCode || '1') === '2' ? '2' : '1';
    const lotNo = String(input.lotNo || input.lot || '').trim();
    const paNo = String(input.paNo || input.pa || '').trim();
    const focusInput = {
      mapUrl,
      objectId: String(input.objectId || '').trim(),
      lotNo,
      paNo,
      stateCode,
      stateName: String(input.stateName || input.negeri || '').trim(),
      productCode,
      daerah: String(input.daerah || input.district || '').trim(),
      mukim: String(input.mukim || '').trim(),
      seksyen: String(input.seksyen || input.section || '').trim()
    };

    lotFocusPrefetchController = new AbortController();
    const prefetchController = lotFocusPrefetchController;
    try {
      // Resolve and verify the exact JUPEM geometry before creating Leaflet.
      // Therefore the very first visible map position is already the chosen lot.
      const resolvedFocus = await fetchExactLotFocus(focusInput, productCode, stateCode, prefetchController.signal);
      if (openSerial !== lotFocusOpenSerial) return null;

      const prepared = await window.azobssOpenLotSelectionMap({
        productCode,
        stateCode: String(resolvedFocus.stateCode || stateCode).padStart(2, '0'),
        stateName: String(resolvedFocus.negeri || focusInput.stateName || '').trim(),
        initialFocus: {
          ...focusInput,
          stateCode: String(resolvedFocus.stateCode || stateCode).padStart(2, '0'),
          stateName: String(resolvedFocus.negeri || focusInput.stateName || '').trim(),
          lotNo: String(resolvedFocus.lotNo || lotNo || '').trim(),
          paNo: String(resolvedFocus.paNo || paNo || '').trim(),
          objectId: String(resolvedFocus.objectId || focusInput.objectId || '').trim(),
          resolvedFocus
        },
        getAuthToken: async () => {
          try {
            // PA/BM uses Firebase modular auth. Use the token bridge exposed by
            // the storefront first; the compat global is only a fallback.
            if (typeof window.azobssGetPaBmAuthToken === 'function') {
              const token = await window.azobssGetPaBmAuthToken(false);
              if (token) return token;
            }
            if (window.firebase && typeof window.firebase.auth === 'function') {
              const currentUser = window.firebase.auth().currentUser;
              return currentUser ? await currentUser.getIdToken() : '';
            }
          } catch (_) {}
          return '';
        },
        onPrepared: async (readySelection) => {
          if (typeof window.azobssAddPreparedLotSelectionToCart !== 'function') {
            throw new Error('Fungsi Troli AZOBSS belum tersedia. Muat semula halaman dan cuba lagi.');
          }
          return window.azobssAddPreparedLotSelectionToCart(
            readySelection,
            String(resolvedFocus.negeri || focusInput.stateName || '').trim()
          );
        }
      });
      if (openSerial !== lotFocusOpenSerial) return null;
      return prepared;
    } catch (error) {
      if (error && (error.name === 'AbortError' || error.code === 'MAP_CLOSED')) return null;
      const message = error && error.message ? error.message : 'Peta lot JUPEM tidak dapat dibuka.';
      try {
        if (typeof window.azShowToast === 'function') window.azShowToast(message);
      } catch (_) {}
      console.error('[AZOBSS lot map]', error);
      return null;
    } finally {
      if (lotFocusPrefetchController === prefetchController) lotFocusPrefetchController = null;
    }
  };

})();
