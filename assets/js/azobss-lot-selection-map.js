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
      .az-lot-coordinate-search{position:absolute;z-index:1000;top:10px;left:52px;width:min(390px,calc(100% - 170px));padding:6px;border:1px solid rgba(51,65,85,.9);border-radius:6px;background:rgba(255,255,255,.96);box-shadow:0 2px 8px rgba(15,23,42,.3)}
      .az-lot-coordinate-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
      .az-lot-coordinate-input{width:100%;min-width:0;height:34px;padding:0 10px;border:1px solid #94a3b8;border-radius:4px;background:#fff;color:#0f172a;font-size:13px;letter-spacing:0;outline:none}
      .az-lot-coordinate-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.2)}
      .az-lot-coordinate-input[aria-invalid="true"]{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.15)}
      .az-lot-coordinate-submit{height:34px;padding:0 13px;border:1px solid #1d4ed8;border-radius:4px;background:#2563eb;color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #1e3a8a}
      .az-lot-coordinate-submit:active{transform:translateY(1px);box-shadow:0 1px 0 #1e3a8a}
      .az-lot-coordinate-feedback{display:none;margin:5px 2px 0;color:#b91c1c;font-size:11px;font-weight:700;line-height:1.25}
      .az-lot-coordinate-feedback.is-visible{display:block}
      .az-lot-map-side{min-height:0;overflow:auto;padding:14px;border-left:1px solid #2d405b;background:#101c2f}
      .az-lot-map-status{min-height:42px;margin:0 0 12px;padding:10px 11px;border:1px solid #405574;border-radius:6px;background:#15233a;color:#d9e8ff;font-size:13px;line-height:1.45}
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
      .az-lot-map-reset{width:100%;min-height:40px;margin-top:9px;border:1px solid #49607e;border-radius:6px;background:#1c2d46;color:#fff;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #07101e}
      .az-lot-map-modal .leaflet-container{font-family:Arial,sans-serif;background:#d8e1eb}
      .az-lot-map-modal .leaflet-draw-toolbar a{background-color:#fff}
      .az-lot-map-modal .leaflet-control-layers{border-radius:6px}
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
    if (!geoJson || !geoJson.geometry || geoJson.geometry.type !== 'Polygon') {
      throw new Error('Gunakan pilihan polygon atau segi empat tepat.');
    }
    return {
      rings: geoJson.geometry.coordinates[0] ? geoJson.geometry.coordinates : [],
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
    const productCode = String(options && options.productCode || '1') === '2' ? '2' : '1';
    const stateCode = String(options && options.stateCode || '').padStart(2, '0');
    const stateName = String(options && options.stateName || '').trim();
    if (!stateCode) throw new Error('Pilih negeri sebelum membuka peta.');

    addStyles();
    await loadMapLibraries();
    const configResponse = await fetch(`${BACKEND_BASE}/api/jupem-lot-map/config?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}`, { cache: 'no-store' });
    const config = await configResponse.json().catch(() => ({}));
    if (!configResponse.ok || !config.ok) throw new Error(config.error || 'Peta JUPEM tidak tersedia untuk negeri ini.');

    return await new Promise((resolve, reject) => {
      let settled = false;
      let map = null;
      let selectedGeometry = null;
      let estimate = null;
      let estimateController = null;
      let operationController = null;
      let activeStateCode = stateCode;
      let activeStateName = stateName || config.negeri;

      const modal = document.createElement('div');
      modal.className = 'az-lot-map-modal';
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
                  <input class="az-lot-coordinate-input" type="text" inputmode="decimal" autocomplete="off" aria-label="Cari koordinat WGS84" placeholder="WGS84: 3.23232, 101.21312">
                  <button class="az-lot-coordinate-submit" type="submit" title="Cari koordinat WGS84">Cari</button>
                </form>
                <div class="az-lot-coordinate-feedback" role="status" aria-live="polite"></div>
              </div>
            </div>
            <aside class="az-lot-map-side">
              <p class="az-lot-map-status" role="status" aria-live="polite">Zum masuk, kemudian pilih kawasan menggunakan alat polygon atau segi empat.</p>
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
      const coordinateForm = modal.querySelector('.az-lot-coordinate-form');
      const coordinateInput = modal.querySelector('.az-lot-coordinate-input');
      const coordinateFeedback = modal.querySelector('.az-lot-coordinate-feedback');
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
      let coordinateMarker = null;

      function setCoordinateFeedback(message) {
        coordinateFeedback.textContent = message || '';
        coordinateFeedback.classList.toggle('is-visible', Boolean(message));
        coordinateInput.setAttribute('aria-invalid', message ? 'true' : 'false');
      }

      function findCoordinate() {
        const coordinate = parseWgs84Coordinates(coordinateInput.value);
        if (!coordinate) {
          setCoordinateFeedback('Masukkan koordinat WGS84 seperti 3.23232 101.21312 atau 3.23232,101.21312.');
          coordinateInput.focus();
          return;
        }
        setCoordinateFeedback('');
        const point = [coordinate.latitude, coordinate.longitude];
        if (coordinateMarker) map.removeLayer(coordinateMarker);
        coordinateMarker = window.L.circleMarker(point, {
          radius: 8,
          color: '#ffffff',
          weight: 3,
          fillColor: '#dc2626',
          fillOpacity: 1
        }).addTo(map);
        coordinateMarker.bindTooltip(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`, {
          direction: 'top',
          offset: [0, -8]
        }).openTooltip();
        map.setView(point, Math.max(17, map.getZoom()), { animate: true });
      }

      function cleanup() {
        if (estimateController) estimateController.abort();
        if (operationController) operationController.abort();
        try { if (map) map.remove(); } catch (_) {}
        modal.remove();
        document.body.style.overflow = '';
      }

      function close() {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Object.assign(new Error('Peta pilihan ditutup.'), { code: 'MAP_CLOSED' }));
      }

      function clearSummary() {
        selectedGeometry = null;
        estimate = null;
        addButton.disabled = true;
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
        setStatus(status, 'Menyemak polygon, lot dan keluasan syit JUPEM...', 'loading');
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
          priceNode.textContent = estimate.variant === 'FULL_SHEET'
            ? `${formatNumber(ratioPercent, 2)}% - Harga 1 Syit RM50`
            : `${formatNumber(ratioPercent, 2)}% - RM${formatNumber(estimate.amount, 0)}`;
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
        const jupemLotsLayer = window.L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}&scope=all&layerMode=lots&layerSet=3`, {
          minZoom: Number(config.minSelectionZoom || 13),
          maxZoom: 20,
          opacity: 0.88,
          attribution: 'JUPEM eBiz'
        });
        const jupemSheetsLayer = window.L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=${encodeURIComponent(productCode)}&negeri=${encodeURIComponent(stateCode)}&layerMode=sheets&layerSet=4`, {
          minZoom: Number(config.minSelectionZoom || 13),
          maxZoom: 20,
          opacity: 1,
          attribution: 'JUPEM eBiz'
        });
        const jupemLayer = window.L.layerGroup([jupemLotsLayer, jupemSheetsLayer]).addTo(map);
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
        map.fitBounds(bounds, { padding: [16, 16] });
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
        window.setTimeout(() => map.invalidateSize(), 100);
      } catch (error) {
        cleanup();
        settled = true;
        reject(error);
        return;
      }

      modal.querySelector('.az-lot-map-close').addEventListener('click', close);
      coordinateForm.addEventListener('submit', (event) => {
        event.preventDefault();
        findCoordinate();
      });
      coordinateInput.addEventListener('input', () => {
        if (coordinateFeedback.textContent) setCoordinateFeedback('');
      });
      resetButton.addEventListener('click', () => {
        drawnItems.clearLayers();
        clearSummary();
        setStatus(status, 'Pilihan dipadam. Lukis kawasan baharu.', '');
      });
      addButton.addEventListener('click', async () => {
        if (!selectedGeometry || !estimate || addButton.disabled) return;
        addButton.disabled = true;
        addButton.textContent = 'Menghasilkan ID pilihan...';
        setStatus(status, 'Mendapatkan ID pilihan Lot Kadaster...', 'loading');
        try {
          operationController = new AbortController();
          const token = typeof options.getAuthToken === 'function' ? await options.getAuthToken() : '';
          if (!token) throw new Error('Sesi log masuk tidak tersedia. Sila log masuk semula.');
          const prepared = await postJson('/api/jupem-lot-selection/prepare', {
            productCode,
            stateCode: activeStateCode,
            geometry: selectedGeometry
          }, token, operationController.signal);
          if (!prepared.ready || !prepared.jobId || !prepared.selectionToken) {
            throw new Error('ID pilihan Lot Kadaster tidak berjaya diperoleh. Sila cuba semula.');
          }
          settled = true;
          cleanup();
          resolve(prepared);
        } catch (error) {
          addButton.disabled = false;
          addButton.textContent = 'Sediakan & Tambah ke Troli';
          setStatus(status, error.message || 'JUPEM tidak dapat menyediakan pilihan ini.', 'error');
        }
      });
    });
  };
})();
