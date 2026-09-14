(function () {
  'use strict';

  const BACKEND_BASE = window.AZOBSS_BACKEND_URL || (
    /^(?:127\.0\.0\.1|localhost)$/.test(window.location.hostname)
      ? window.location.origin
      : 'https://azobss-backend.onrender.com'
  );
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const STATE_CODES = Object.freeze({
    JOHOR: '01', KEDAH: '02', KELANTAN: '03', MELAKA: '04', 'NEGERI SEMBILAN': '05',
    PAHANG: '06', 'PULAU PINANG': '07', PERAK: '08', PERLIS: '09', SELANGOR: '10',
    TERENGGANU: '11', SABAH: '12', SARAWAK: '13',
    'WILAYAH PERSEKUTUAN KUALA LUMPUR': '14',
    'WILAYAH PERSEKUTUAN LABUAN': '15',
    'WILAYAH PERSEKUTUAN PUTRAJAYA': '16'
  });

  let leafletPromise = null;
  let activeModal = null;
  let activeController = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  function addStyles() {
    if (document.getElementById('azobssPabmMapSearchStyles1108')) return;
    const style = document.createElement('style');
    style.id = 'azobssPabmMapSearchStyles1108';
    style.textContent = `
      .pabm-map-search-block{margin-top:12px;padding-top:2px}
      .pabm-map-search-block label{display:block;margin:0}
      .pabm-map-search-block .pabm-map-button{width:100%;margin-top:9px;min-height:44px;border:1px solid #46617f;border-radius:6px;background:#1b2d46;color:#f8fafc;font-weight:900;font-size:15px;cursor:pointer}
      .pabm-map-search-block .pabm-map-button:hover{background:#24405f;border-color:#5b7ca2}
      .pabm-map-search-block .pabm-map-button:disabled{opacity:.55;cursor:wait}
      .pabm-map-search-block .pabm-map-inline-status{display:block;min-height:18px;margin:7px 0 0;color:#a9bad0;font-size:12px}
      .pabm-map-search-block .pabm-map-inline-status.is-error{color:#fda4af}
      .pabm-map-search-block .pabm-map-inline-status.is-success{color:#86efac}
      .az-pabm-map-modal{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(2,6,23,.86);backdrop-filter:blur(5px)}
      .az-pabm-map-dialog{width:min(1200px,calc(100vw - 20px));height:min(820px,calc(100vh - 20px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid #38506f;border-radius:9px;background:#0d1729;color:#f8fafc;box-shadow:0 24px 80px rgba(0,0,0,.68)}
      .az-pabm-map-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;border-bottom:1px solid #2d405b;background:#111f34}
      .az-pabm-map-head h2{margin:0;font-size:19px;line-height:1.2}
      .az-pabm-map-head small{display:block;margin-top:3px;color:#9fb3cf;font-size:12px}
      .az-pabm-map-close{flex:0 0 38px;width:38px;height:38px;border:1px solid #4b607d;border-radius:6px;background:#1d2c43;color:#fff;font-size:24px;line-height:1;cursor:pointer}
      .az-pabm-map-body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 350px}
      .az-pabm-map-stage{position:relative;min-width:0;min-height:420px;background:#172033}
      .az-pabm-map-canvas{position:absolute;inset:0}
      .az-pabm-map-searchbox{position:absolute;z-index:1000;top:10px;left:52px;width:min(500px,calc(100% - 120px));padding:7px;border:1px solid rgba(51,65,85,.95);border-radius:7px;background:rgba(255,255,255,.97);box-shadow:0 3px 12px rgba(15,23,42,.35)}
      .az-pabm-map-searchform{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
      .az-pabm-map-searchform input{width:100%;min-width:0;height:36px;padding:0 10px;border:1px solid #94a3b8;border-radius:5px;background:#fff;color:#0f172a;font-size:13px;outline:none}
      .az-pabm-map-searchform input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.18)}
      .az-pabm-map-searchform button{height:36px;padding:0 14px;border:0;border-radius:5px;background:#1d4ed8;color:#fff;font-weight:900;cursor:pointer}
      .az-pabm-map-searchform button:disabled{opacity:.78;cursor:wait}
      .az-pabm-map-searchform button.is-loading{display:inline-flex;align-items:center;justify-content:center;gap:7px}
      .az-pabm-map-searchform button.is-loading::before{content:"";width:13px;height:13px;flex:0 0 13px;border:2px solid rgba(255,255,255,.42);border-top-color:#fff;border-radius:50%;animation:az-pabm-spin .72s linear infinite}
      .az-pabm-map-searchhint{margin:5px 2px 0;color:#334155;font-size:11px;line-height:1.25}
      .az-pabm-map-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid #2d405b;background:#0f1b2e}
      .az-pabm-map-status{position:relative;padding:10px 12px;border-bottom:1px solid #263951;color:#bfd0e6;font-size:12px;line-height:1.35;background:#111f34;overflow:hidden}
      .az-pabm-map-status.is-loading{padding-left:38px;color:#dbeafe;background:#10213a;font-weight:800}
      .az-pabm-map-status.is-loading::before{content:"";position:absolute;left:13px;top:50%;width:14px;height:14px;margin-top:-9px;border:2px solid rgba(147,197,253,.32);border-top-color:#60a5fa;border-right-color:#93c5fd;border-radius:50%;animation:az-pabm-spin .72s linear infinite}
      .az-pabm-map-status.is-loading::after{content:"";position:absolute;left:-35%;bottom:0;width:35%;height:2px;background:linear-gradient(90deg,transparent,#60a5fa,#bfdbfe,transparent);animation:az-pabm-progress 1.15s ease-in-out infinite}
      .az-pabm-map-status.is-error{color:#fecdd3;background:#301822}
      .az-pabm-map-status.is-success{color:#bbf7d0;background:#10291f}
      .az-pabm-map-results{min-height:0;overflow:auto;padding:10px}
      .az-pabm-map-empty{padding:16px 10px;text-align:center;color:#94a3b8;font-size:13px;line-height:1.5}
      .az-pabm-map-result{display:block;width:100%;margin:0 0 8px;padding:10px;border:1px solid #324965;border-radius:7px;background:#142239;color:#eaf2ff;text-align:left;cursor:pointer}
      .az-pabm-map-result:hover,.az-pabm-map-result.is-selected{border-color:#60a5fa;background:#193252}
      .az-pabm-map-result strong{display:block;color:#fff;font-size:14px;line-height:1.25}
      .az-pabm-map-result span{display:block;margin-top:4px;color:#a9bad0;font-size:11px;line-height:1.35}
      .az-pabm-map-result .az-pabm-map-distance{color:#93c5fd;font-weight:800}
      .az-pabm-map-detail{padding:10px 12px;border-top:1px solid #263951;background:#111f34}
      .az-pabm-map-detail-grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 9px;margin-bottom:9px;font-size:11px;line-height:1.35}
      .az-pabm-map-detail-grid b{color:#94a3b8;font-weight:700}.az-pabm-map-detail-grid span{color:#e2e8f0;overflow-wrap:anywhere}
      .az-pabm-wgs84-value{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap}
      .az-pabm-google-maps-link{display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px;width:24px;height:24px;border:1px solid #3b82f6;border-radius:5px;background:#173b6d;color:#dbeafe;text-decoration:none;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:background .15s ease,border-color .15s ease,transform .15s ease}
      .az-pabm-google-maps-link:hover{background:#1d4ed8;border-color:#93c5fd;transform:translateY(-1px)}
      .az-pabm-google-maps-link:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}
      .az-pabm-google-maps-link svg{width:15px;height:15px;display:block;fill:currentColor}
      .az-pabm-map-cart{width:100%;min-height:42px;border:0;border-radius:6px;background:#059669;color:#fff;font-weight:900;font-size:14px;cursor:pointer}
      .az-pabm-map-cart:disabled{opacity:.55;cursor:not-allowed}
      .az-pabm-map-footstatus{min-height:16px;margin-top:6px;color:#a9bad0;font-size:11px;line-height:1.3}
      .az-pabm-map-footstatus.is-error{color:#fda4af}.az-pabm-map-footstatus.is-success{color:#86efac}
      .az-pabm-map-target-label{padding:2px 5px;border-radius:4px;background:#0f172a;color:#fff;font-size:11px;font-weight:800;white-space:nowrap}
      .az-pabm-reference-label{padding:3px 7px;border:2px solid #facc15;border-radius:5px;background:rgba(15,23,42,.94);color:#fde68a;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 2px 7px rgba(0,0,0,.4)}
      .az-pabm-search-pin-icon{background:transparent!important;border:0!important}
      .az-pabm-search-pin{display:block;position:relative;width:28px;height:28px;border:3px solid #fff;border-radius:50% 50% 50% 0;background:#ef4444;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,.55)}
      .az-pabm-search-pin::after{content:"";position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;background:#fff;transform:translate(-50%,-50%)}
      .az-pabm-search-origin-label{padding:3px 7px;border:1px solid rgba(255,255,255,.75);border-radius:5px;background:#7f1d1d;color:#fff;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 2px 7px rgba(0,0,0,.35)}
      .az-pabm-distance-line-label{padding:3px 7px;border:1px solid rgba(255,255,255,.75);border-radius:5px;background:#92400e;color:#fff;font-size:11px;font-weight:900;white-space:nowrap;box-shadow:0 2px 7px rgba(0,0,0,.35)}
      .az-pabm-station-label{padding:1px 4px;border:1px solid rgba(15,23,42,.55);border-radius:4px;background:rgba(15,23,42,.88);color:#fff;font-size:10px;font-weight:900;line-height:1.15;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.28)}
      .az-pabm-station-label.is-selected{font-size:11px;border-width:2px;background:#0f172a}
      .az-pabm-map-layer-switch{position:absolute;z-index:1002;top:10px;right:10px;display:flex;align-items:center;gap:6px}
      .az-pabm-map-layer-button,.az-pabm-map-mylot-button{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 11px;border:1px solid rgba(255,255,255,.72);border-radius:6px;background:rgba(15,23,42,.91);color:#fff;font-size:12px;font-weight:900;line-height:1;text-decoration:none;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);backdrop-filter:blur(5px)}
      .az-pabm-map-layer-button:hover,.az-pabm-map-mylot-button:hover{background:#1e3a5f;border-color:#93c5fd}
      .az-pabm-map-layer-button.is-earth{background:#166534;border-color:#86efac;color:#ecfdf5}
      .az-pabm-map-earth-legend{position:absolute;z-index:1001;top:53px;right:10px;display:none;min-width:198px;max-width:250px;padding:8px 10px;border:1px solid rgba(255,255,255,.7);border-radius:6px;background:rgba(15,23,42,.9);color:#e2e8f0;font-size:10px;line-height:1.45;box-shadow:0 2px 8px rgba(0,0,0,.35);backdrop-filter:blur(5px)}
      .az-pabm-map-earth-legend.is-visible{display:block}
      .az-pabm-map-earth-legend strong{display:block;margin-bottom:3px;color:#fff;font-size:11px}
      .az-pabm-map-earth-legend span{display:block;color:#cbd5e1}
      .az-pabm-map-earth-legend .my-lot-note{margin-top:4px;color:#93c5fd}
      .az-pabm-lot-info-popup .leaflet-popup-content-wrapper,.az-pabm-lot-info-popup .leaflet-popup-tip{background:#0f172a;color:#e2e8f0}
      .az-pabm-lot-info-popup .leaflet-popup-content{margin:10px 12px;min-width:210px;font-size:11px;line-height:1.45}
      .az-pabm-lot-info-popup .lot-title{margin-bottom:6px;color:#fde68a;font-size:13px;font-weight:900}
      .az-pabm-lot-info-popup .lot-grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 8px}
      .az-pabm-lot-info-popup .lot-grid b{color:#94a3b8}.az-pabm-lot-info-popup .lot-grid span{color:#f8fafc;overflow-wrap:anywhere}
      @keyframes az-pabm-spin{to{transform:rotate(360deg)}}
      @keyframes az-pabm-progress{0%{left:-35%}55%{left:55%}100%{left:110%}}
      @media(max-width:800px){
        .az-pabm-map-modal{padding:4px}.az-pabm-map-dialog{width:calc(100vw - 8px);height:calc(100vh - 8px)}
        .az-pabm-map-body{grid-template-columns:1fr;grid-template-rows:minmax(330px,55vh) minmax(0,1fr)}
        .az-pabm-map-side{border-left:0;border-top:1px solid #2d405b}.az-pabm-map-searchbox{left:46px;width:calc(100% - 94px)}
        .az-pabm-map-layer-switch{top:92px;right:6px}.az-pabm-map-earth-legend{top:134px;right:6px;max-width:220px}
      }
    `;
    document.head.appendChild(style);
  }

  function loadLeaflet() {
    if (window.L && typeof window.L.map === 'function') return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
      if (existing) {
        const wait = () => window.L ? resolve(window.L) : window.setTimeout(wait, 40);
        wait();
        return;
      }
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet gagal dimuatkan.'));
      script.onerror = () => reject(new Error('Leaflet gagal dimuatkan.'));
      document.head.appendChild(script);
    });
    return leafletPromise;
  }

  function parseCoordinates(value) {
    const numbers = String(value || '').trim().match(/-?\d+(?:\.\d+)?/g) || [];
    if (numbers.length < 2) return null;
    let lat = Number(numbers[0]);
    let lng = Number(numbers[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Accept both common clipboard orders: Latitude, Longitude and Longitude, Latitude.
    if (!(lat >= -2 && lat <= 8.5 && lng >= 95 && lng <= 125)
        && (lng >= -2 && lng <= 8.5 && lat >= 95 && lat <= 125)) {
      const swap = lat; lat = lng; lng = swap;
    }
    if (lat < -2 || lat > 8.5 || lng < 95 || lng > 125) return null;
    return { lat, lng };
  }

  function createSearchTargetMarker(L, map, target, label) {
    if (!target || !Number.isFinite(Number(target.lat)) || !Number.isFinite(Number(target.lng))) return null;
    const icon = L.divIcon({
      className: 'az-pabm-search-pin-icon',
      html: '<span class="az-pabm-search-pin" aria-hidden="true"></span>',
      iconSize: [28, 36],
      iconAnchor: [14, 32],
      tooltipAnchor: [0, -30]
    });
    const marker = L.marker([Number(target.lat), Number(target.lng)], {
      icon,
      zIndexOffset: 3000,
      keyboard: false,
      interactive: false
    }).addTo(map);
    marker.bindTooltip(String(label || 'Lokasi carian'), {
      permanent: true,
      direction: 'top',
      offset: [0, -2],
      className: 'az-pabm-search-origin-label',
      opacity: 1
    }).openTooltip();
    return marker;
  }

  function cleanLotQuery(value) {
    return String(value || '').trim().replace(/^\s*(?:NO\.?\s*)?LOT\s*/i, '').replace(/[^A-Za-z0-9/_-]/g, '').slice(0, 48);
  }

  function setInlineStatus(element, text, kind) {
    if (!element) return;
    element.textContent = text || '';
    element.classList.toggle('is-error', kind === 'error');
    element.classList.toggle('is-success', kind === 'success');
  }

  async function fetchJson(url, signal) {
    const response = await fetch(url, { cache: 'no-store', signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data || data.ok === false) throw new Error(data && data.error || `HTTP ${response.status}`);
    return data;
  }

  function closeActiveModal() {
    if (activeController) {
      try { activeController.abort(); } catch (_) {}
      activeController = null;
    }
    if (!activeModal) return;
    try {
      if (activeModal._azobssMap) activeModal._azobssMap.remove();
    } catch (_) {}
    try { activeModal.remove(); } catch (_) {}
    activeModal = null;
    document.documentElement.style.removeProperty('overflow');
  }

  function createModal(title, subtitle, placeholder, hint) {
    closeActiveModal();
    const modal = document.createElement('div');
    modal.className = 'az-pabm-map-modal';
    modal.innerHTML = `
      <section class="az-pabm-map-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header class="az-pabm-map-head">
          <div><h2>${escapeHtml(title)}</h2><small>${escapeHtml(subtitle)}</small></div>
          <button class="az-pabm-map-close" type="button" aria-label="Tutup">&times;</button>
        </header>
        <div class="az-pabm-map-body">
          <div class="az-pabm-map-stage">
            <div class="az-pabm-map-canvas"></div>
            <div class="az-pabm-map-searchbox">
              <form class="az-pabm-map-searchform">
                <input type="search" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(placeholder)}">
                <button type="submit">Cari</button>
              </form>
              <div class="az-pabm-map-searchhint">${escapeHtml(hint)}</div>
            </div>
          </div>
          <aside class="az-pabm-map-side">
            <div class="az-pabm-map-status">Sedia.</div>
            <div class="az-pabm-map-results"><div class="az-pabm-map-empty">Masukkan carian untuk memaparkan pilihan pada peta.</div></div>
            <div class="az-pabm-map-detail" hidden>
              <div class="az-pabm-map-detail-grid"></div>
              <button class="az-pabm-map-cart" type="button">Tambah ke Troli</button>
              <div class="az-pabm-map-footstatus"></div>
            </div>
          </aside>
        </div>
      </section>`;
    document.body.appendChild(modal);
    activeModal = modal;
    document.documentElement.style.overflow = 'hidden';
    modal.querySelector('.az-pabm-map-close').addEventListener('click', closeActiveModal);
    modal.addEventListener('mousedown', (event) => {
      if (event.target === modal) closeActiveModal();
    });
    return {
      modal,
      canvas: modal.querySelector('.az-pabm-map-canvas'),
      form: modal.querySelector('.az-pabm-map-searchform'),
      input: modal.querySelector('.az-pabm-map-searchform input'),
      searchButton: modal.querySelector('.az-pabm-map-searchform button'),
      status: modal.querySelector('.az-pabm-map-status'),
      results: modal.querySelector('.az-pabm-map-results'),
      detail: modal.querySelector('.az-pabm-map-detail'),
      detailGrid: modal.querySelector('.az-pabm-map-detail-grid'),
      cartButton: modal.querySelector('.az-pabm-map-cart'),
      footStatus: modal.querySelector('.az-pabm-map-footstatus')
    };
  }

  function setModalStatus(ui, text, kind) {
    ui.status.textContent = text || '';
    ui.status.classList.toggle('is-error', kind === 'error');
    ui.status.classList.toggle('is-success', kind === 'success');
    ui.status.classList.toggle('is-loading', kind === 'loading');
    ui.status.setAttribute('aria-busy', kind === 'loading' ? 'true' : 'false');
  }

  function setSearchBusy(ui, busy, label) {
    if (!ui || !ui.searchButton) return;
    ui.searchButton.disabled = Boolean(busy);
    ui.searchButton.classList.toggle('is-loading', Boolean(busy));
    ui.searchButton.textContent = busy ? (label || 'Mencari...') : 'Cari';
  }

  function setFootStatus(ui, text, kind) {
    ui.footStatus.textContent = text || '';
    ui.footStatus.classList.toggle('is-error', kind === 'error');
    ui.footStatus.classList.toggle('is-success', kind === 'success');
  }

  function addBaseMap(L, map) {
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function createEarthBaseMap(L) {
    // Stable satellite imagery for AZOBSS Earth mode. MyLot's documented UI offers
    // a Google Satellite basemap; we deliberately avoid hot-linking undocumented
    // Google/MyLot tile URLs and keep the cadastral data on official JUPEM services.
    return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      attribution: 'Tiles &copy; Esri &mdash; Earth imagery'
    });
  }

  function addJupemLotOverlay(L, map, stateCode, productCode = '1', opacity = 0.82) {
    try {
      const product = String(productCode || '1') === '2' ? '2' : '1';
      return L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=${product}&negeri=${encodeURIComponent(stateCode)}&scope=all&layerMode=lots&layerSet=3`, {
        minZoom: 11,
        maxZoom: 20,
        opacity,
        pane: 'overlayPane'
      }).addTo(map);
    } catch (_) { return null; }
  }

  function createBenchmarkEarthControl(L, map, stage, streetLayer, stateCode) {
    if (!stage || !streetLayer) return null;
    const wrap = document.createElement('div');
    wrap.className = 'az-pabm-map-layer-switch';
    wrap.innerHTML = `
      <button class="az-pabm-map-layer-button" type="button" aria-pressed="false" title="Tukar Map / Earth">&#127758; Earth</button>
      <a class="az-pabm-map-mylot-button" href="https://jupem2u.kul.jupem.gov.my/mylot/negeri.html" target="_blank" rel="noopener noreferrer" title="Buka MyLot JUPEM rasmi">MyLot &#8599;</a>`;
    const legend = document.createElement('div');
    legend.className = 'az-pabm-map-earth-legend';
    legend.innerHTML = `
      <strong>Earth + Kadaster JUPEM</strong>
      <span>NDCDB + C3 dipaparkan di atas imej satelit.</span>
      <span class="my-lot-note">Klik sekali pada lot untuk info. Double-click untuk pindah lokasi carian.</span>`;
    stage.appendChild(wrap);
    stage.appendChild(legend);
    try {
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
      }
    } catch (_) {}
    const button = wrap.querySelector('.az-pabm-map-layer-button');
    let earthLayer = null;
    let c3Layer = null;
    let earth = false;

    function applyMode(nextEarth) {
      earth = Boolean(nextEarth);
      if (earth) {
        if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
        if (!earthLayer) earthLayer = createEarthBaseMap(L);
        if (!map.hasLayer(earthLayer)) earthLayer.addTo(map);
        if (typeof earthLayer.bringToBack === 'function') earthLayer.bringToBack();
        // MyLot documents NDCDB and C3 as cadastral layer choices. AZOBSS loads
        // both official JUPEM cadastral products in Earth mode. Relative NDCDB
        // is not exposed by the existing authenticated eBiz map endpoint.
        if (stateCode) {
          if (!c3Layer) c3Layer = addJupemLotOverlay(L, map, stateCode, '2', 0.74);
          else if (!map.hasLayer(c3Layer)) c3Layer.addTo(map);
        }
        button.classList.add('is-earth');
        button.setAttribute('aria-pressed', 'true');
        button.innerHTML = '&#128506; Map';
        legend.classList.add('is-visible');
      } else {
        if (earthLayer && map.hasLayer(earthLayer)) map.removeLayer(earthLayer);
        if (c3Layer && map.hasLayer(c3Layer)) map.removeLayer(c3Layer);
        if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
        if (typeof streetLayer.bringToBack === 'function') streetLayer.bringToBack();
        button.classList.remove('is-earth');
        button.setAttribute('aria-pressed', 'false');
        button.innerHTML = '&#127758; Earth';
        legend.classList.remove('is-visible');
      }
    }

    button.addEventListener('click', () => applyMode(!earth));
    return { isEarth: () => earth, setEarth: applyMode };
  }

  function paCartPayload(row, state) {
    const paNo = String(row && row.paNo || '').trim().toUpperCase();
    const itemCode = paNo.replace(/^PA/i, '');
    const actualState = String(row && row.negeri || state || '').trim().toUpperCase();
    return {
      productType: 'PA',
      itemCode,
      negeri: actualState,
      amount: 5,
      downloadUrl: `${BACKEND_BASE}/api/pa-pdf?noPA=${encodeURIComponent(paNo + '.TIF')}&negeri=${encodeURIComponent(actualState)}`,
      filename: `${paNo}.pdf`,
      azobssCartValidated: true,
      azobssCartValidatedBy: 'jupem-pa-wgs84-map'
    };
  }

  function benchmarkCartPayload(row, product, state) {
    const jenis = product === 'SBM' ? '2' : '1';
    const stationNo = String(row && (row.stationNo || row.stesen) || '').trim();
    const productId = String(row && (row.productId || row.id) || '').trim();
    const downloadUrl = String(row && row.downloadUrl || (productId ? `${BACKEND_BASE}/api/download-stesen-tanda-aras?productId=${encodeURIComponent(productId)}&jenis=${jenis}` : '')).trim();
    return {
      productType: product,
      product,
      itemCode: stationNo || productId,
      stationNo,
      productId,
      jenis,
      negeri: String(row && row.negeri || state || '').trim(),
      daerah: String(row && row.daerah || '').trim(),
      bandar: String(row && row.bandar || '').trim(),
      huraian: String(row && row.huraian || '').trim(),
      amount: 3,
      url: downloadUrl,
      downloadUrl,
      azobssCartValidated: true,
      azobssCartValidatedBy: 'jupem-benchmark-wgs84-map'
    };
  }

  async function addToCart(payload, ui, externalStatus) {
    if (typeof window.azobssRecordPurchase !== 'function') throw new Error('Troli belum sedia. Refresh halaman dan cuba semula.');
    ui.cartButton.disabled = true;
    setFootStatus(ui, 'Sedang menambah ke troli...', '');
    try {
      const saved = await window.azobssRecordPurchase(payload);
      const label = payload.productType === 'PA'
        ? `PA${payload.itemCode}`
        : `${payload.productType} ${payload.stationNo || payload.productId}`;
      const message = saved && saved.__azobssAlreadyInCart
        ? `${label} sudah ada dalam troli.`
        : `${label} berjaya ditambah ke troli.`;
      setFootStatus(ui, message, 'success');
      setInlineStatus(externalStatus, message, 'success');
    } finally {
      ui.cartButton.disabled = false;
    }
  }

  async function openPaMap(initialValue) {
    const stateEl = document.getElementById('negeri');
    const externalStatus = document.getElementById('paMapSearchStatus');
    const state = String(stateEl && stateEl.value || '').trim().toUpperCase();
    const stateCode = STATE_CODES[state] || '';
    if (!stateCode) {
      setInlineStatus(externalStatus, 'Pilih negeri terlebih dahulu.', 'error');
      stateEl && stateEl.focus();
      return;
    }
    const value = String(initialValue || '').trim();
    if (!value) {
      setInlineStatus(externalStatus, 'Masukkan Nombor Lot atau WGS84 terlebih dahulu.', 'error');
      document.getElementById('paMapSearchInput')?.focus();
      return;
    }

    setInlineStatus(externalStatus, 'Membuka Peta Pilihan PA...', '');
    const L = await loadLeaflet();
    addStyles();
    const ui = createModal(
      'Peta Pilihan PA',
      `${state} • Nombor Lot ikut negeri • WGS84 auto-detect negeri`,
      'Contoh: Lot 1122 atau 3.1390, 101.6869',
      'Klik lot yang ditemui untuk lihat maklumat. Klik sekali lokasi pada peta untuk menetapkan titik carian WGS84 baharu.'
    );
    ui.input.value = value;
    const map = L.map(ui.canvas, { zoomControl: true, doubleClickZoom: false }).setView([4.2, 102.1], 7);
    ui.modal._azobssMap = map;
    const streetLayer = addBaseMap(L, map);
    addJupemLotOverlay(L, map, stateCode);
    // v1108: PA now has the same Earth + JUPEM cadastral overlay switch as BM/SBM.
    // The normal NDCDB overlay remains visible; Earth mode swaps the base map to
    // satellite imagery and adds the C3 cadastral overlay.
    createBenchmarkEarthControl(L, map, ui.canvas.parentElement, streetLayer, stateCode);
    window.setTimeout(() => map.invalidateSize(), 60);

    const layerGroup = L.featureGroup().addTo(map);
    let targetMarker = null;
    let selectedRow = null;
    let selectedLayer = null;
    let rows = [];

    function clearSelection() {
      selectedRow = null;
      selectedLayer = null;
      ui.detail.hidden = true;
      ui.detailGrid.innerHTML = '';
      setFootStatus(ui, '', '');
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.remove('is-selected'));
    }

    function selectRow(index, pan = true) {
      const row = rows[index];
      if (!row) return;
      selectedRow = row;
      selectedLayer = row._layer || null;
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.toggle('is-selected', Number(node.dataset.index) === index));
      ui.detail.hidden = false;
      ui.detailGrid.innerHTML = `
        <b>Nombor PA</b><span>${escapeHtml(row.paNo || 'Belum ditemui')}</span>
        <b>Nombor Lot</b><span>${escapeHtml(row.lotNo || '-')}</span>
        <b>Negeri</b><span>${escapeHtml(row.negeri || state)}</span>
        <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
        <b>Mukim</b><span>${escapeHtml(row.mukim || '-')}</span>
        <b>Seksyen</b><span>${escapeHtml(row.seksyen || '-')}</span>
        <b>Status PA</b><span>Tiada</span>`;
      ui.cartButton.textContent = row.paNo ? `Tambah ${row.paNo} ke Troli` : 'Nombor PA belum ditemui';
      ui.cartButton.disabled = !row.paNo;
      if (!row.paNo) setFootStatus(ui, row.paLookupMessage || 'Lot ditemui, tetapi nombor PA belum dapat dipadankan dengan selamat.', 'error');
      else setFootStatus(ui, '', '');
      if (pan && row._layer) {
        try { map.fitBounds(row._layer.getBounds(), { padding: [35, 35], maxZoom: 18 }); } catch (_) {}
      }
    }

    function renderRows(newRows, coordinate, preserveViewport = false) {
      layerGroup.clearLayers();
      rows = Array.isArray(newRows) ? newRows : [];
      clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} targetMarker = null; }
      if (coordinate) {
        targetMarker = createSearchTargetMarker(L, map, coordinate, 'Lokasi carian');
      }
      if (!rows.length) {
        ui.results.innerHTML = '<div class="az-pabm-map-empty">Tiada lot / PA ditemui pada carian ini. Cuba klik sedikit ke dalam sempadan lot atau semak negeri yang dipilih.</div>';
        if (coordinate) {
          if (preserveViewport) map.setView([coordinate.lat, coordinate.lng], map.getZoom(), { animate: false });
          else map.setView([coordinate.lat, coordinate.lng], 17);
        }
        return;
      }
      ui.results.innerHTML = rows.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-index="${index}">
          <strong>${escapeHtml(row.paNo || 'PA belum ditemui')} • Lot ${escapeHtml(row.lotNo || '-')}</strong>
          <span>${escapeHtml([row.daerah, row.mukim, row.seksyen].filter(Boolean).join(' • ') || state)}</span>
        </button>`).join('');
      rows.forEach((row, index) => {
        const rings = row && row.geometry && Array.isArray(row.geometry.rings) ? row.geometry.rings : [];
        if (!rings.length) return;
        const latLngRings = rings.map((ring) => ring.map((point) => [Number(point[1]), Number(point[0])]).filter((point) => point.every(Number.isFinite))).filter((ring) => ring.length >= 3);
        if (!latLngRings.length) return;
        const polygon = L.polygon(latLngRings, { weight: 3, fillOpacity: 0.18, bubblingMouseEvents: false }).addTo(layerGroup);
        row._layer = polygon;
        polygon.bindTooltip(`${row.paNo || 'PA?'} • Lot ${row.lotNo || '-'}`);
        polygon.on('click', (event) => {
          if (event && event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          selectRow(index);
        });
      });
      const bounds = layerGroup.getBounds();
      if (preserveViewport && coordinate) {
        // v1112: lokasi WGS84 yang ditetapkan terus pada peta tidak boleh
        // mengubah tahap zoom pengguna. Pusatkan titik baru sahaja.
        map.setView([coordinate.lat, coordinate.lng], map.getZoom(), { animate: false });
      } else if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
      } else if (coordinate) {
        map.setView([coordinate.lat, coordinate.lng], 17);
      }
      selectRow(0, !preserveViewport);
    }

    async function runSearch(searchValue, explicitCoordinate, preserveViewport = false) {
      const raw = String(searchValue || '').trim();
      const looksLikeLot = /^\s*(?:NO\.?\s*)?LOT\b/i.test(raw) || (raw.includes('/') && !raw.includes(','));
      const coordinate = explicitCoordinate || (looksLikeLot ? null : parseCoordinates(raw));
      const lot = coordinate ? '' : cleanLotQuery(raw);
      if (!coordinate && !lot) {
        setModalStatus(ui, 'Masukkan Nombor Lot atau WGS84 yang sah.', 'error');
        return;
      }
      if (activeController) { try { activeController.abort(); } catch (_) {} }
      activeController = new AbortController();
      setSearchBusy(ui, true, 'Mencari Lot...');
      setModalStatus(ui, coordinate ? 'Mencari lot pada koordinat WGS84...' : `Mencari Lot ${lot}...`, 'loading');
      try {
        const params = new URLSearchParams({ negeri: stateCode });
        if (coordinate) {
          params.set('lat', String(coordinate.lat));
          params.set('lng', String(coordinate.lng));
        } else {
          params.set('lot', lot);
        }
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-pa-map-search?${params.toString()}`, activeController.signal);
        renderRows(data.results, coordinate, preserveViewport);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        const actualState = String(data.negeri || (data.results && data.results[0] && data.results[0].negeri) || '').trim();
        const requestedStateCode = String(data.requestedStateCode || stateCode || '');
        const actualStateCode = String(data.stateCode || (data.results && data.results[0] && data.results[0].stateCode) || '');
        const stateAutoDetected = Boolean(coordinate && count && actualStateCode && requestedStateCode && actualStateCode !== requestedStateCode);
        const foundMessage = stateAutoDetected
          ? `${count} lot ditemui. Lokasi WGS84 ini berada di ${actualState}, bukan ${state}.`
          : `${count} pilihan lot ditemui. Klik lot atau pilih daripada senarai.`;
        setModalStatus(ui, count ? foundMessage : 'Tiada lot / PA ditemui untuk carian ini.', count ? 'success' : 'error');
        setInlineStatus(externalStatus, count ? foundMessage : 'Tiada PA/lot ditemui.', count ? 'success' : 'error');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        renderRows([], coordinate, preserveViewport);
        setModalStatus(ui, error.message || 'Carian PA pada peta gagal.', 'error');
        setInlineStatus(externalStatus, error.message || 'Carian PA pada peta gagal.', 'error');
      } finally {
        setSearchBusy(ui, false);
      }
    }

    ui.form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(ui.input.value);
    });
    ui.results.addEventListener('click', (event) => {
      const button = event.target.closest('[data-index]');
      if (button) selectRow(Number(button.dataset.index));
    });
    ui.cartButton.addEventListener('click', async () => {
      if (!selectedRow || !selectedRow.paNo) return;
      try {
        await addToCart(paCartPayload(selectedRow, state), ui, externalStatus);
      } catch (error) {
        setFootStatus(ui, error.message || 'PA tidak dapat ditambah ke troli.', 'error');
      }
    });
    // v1110: PA sahaja menggunakan single-click untuk menetapkan titik carian
    // WGS84 baharu. BM/SBM/GPS kekal dengan double-click seperti sebelumnya.
    map.on('click', (event) => {
      if (!event || !event.latlng) return;
      const coordinate = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      ui.input.value = `${coordinate.lat}, ${coordinate.lng}`;
      runSearch(ui.input.value, coordinate, true);
    });
    runSearch(value);
  }

  async function openBenchmarkMap(initialValue) {
    const stateEl = document.getElementById('benchmarkState');
    const productEl = document.getElementById('benchmarkProduct');
    const externalStatus = document.getElementById('benchmarkMapStatus');
    const state = String(stateEl && stateEl.value || '').trim().toUpperCase();
    const product = String(productEl && productEl.value || 'BM').trim().toUpperCase() === 'SBM' ? 'SBM' : 'BM';
    const rawInitial = String(initialValue || '').trim();
    const coordinate = parseCoordinates(rawInitial);
    if (!state) {
      setInlineStatus(externalStatus, 'Pilih negeri terlebih dahulu.', 'error');
      stateEl && stateEl.focus();
      return;
    }
    if (!rawInitial) {
      setInlineStatus(externalStatus, 'Masukkan Nombor Lot, Nombor PA atau WGS84 terlebih dahulu.', 'error');
      document.getElementById('benchmarkMapWgs84Input')?.focus();
      return;
    }

    setInlineStatus(externalStatus, `Membuka Peta Pilihan ${product}...`, '');
    const L = await loadLeaflet();
    addStyles();
    const ui = createModal(
      `Peta Pilihan ${product}`,
      `${state} • Cari ${product} terdekat menggunakan Nombor Lot, Nombor PA atau WGS84`,
      'Contoh: Lot 1122 / PA2131 / 3.1390, 101.6869',
      `Nombor biasa dianggap sebagai Lot. Untuk Pelan Akui, gunakan awalan PA. Double-click lokasi pada peta untuk menetapkan titik carian ${product} baharu.`
    );
    ui.input.value = coordinate ? `${coordinate.lat}, ${coordinate.lng}` : rawInitial;
    const initialCenter = coordinate ? [coordinate.lat, coordinate.lng] : [4.2, 102.1];
    const initialZoom = coordinate ? 11 : 7;
    const map = L.map(ui.canvas, { zoomControl: true, doubleClickZoom: false }).setView(initialCenter, initialZoom);
    ui.modal._azobssMap = map;
    const streetLayer = addBaseMap(L, map);
    // v1106: BM/SBM used to show only the OSM basemap plus the single resolved
    // reference polygon. Add the same JUPEM cadastral lot tile overlay used by
    // Peta Pilihan PA / Lot Kadaster so surrounding lot boundaries and lot
    // numbers remain visible while comparing nearby BM/SBM stations.
    const benchmarkStateCode = STATE_CODES[state] || '';
    if (benchmarkStateCode) addJupemLotOverlay(L, map, benchmarkStateCode, '1', 0.84);
    // v1107: Earth switch. Satellite imagery is combined with official JUPEM
    // NDCDB + C3 overlays. The MyLot button opens the native JUPEM application.
    const earthControl = createBenchmarkEarthControl(L, map, ui.canvas.parentElement, streetLayer, benchmarkStateCode);
    // v1103: keep cadastral reference geometry above normal vector layers so
    // the selected lot/PA boundary remains visible when BM/SBM markers overlap it.
    if (!map.getPane('azobssReferencePane')) {
      const referencePane = map.createPane('azobssReferencePane');
      referencePane.style.zIndex = '575';
      referencePane.style.pointerEvents = 'none';
    }
    window.setTimeout(() => map.invalidateSize(), 60);

    const stationGroup = L.featureGroup().addTo(map);
    const referenceGroup = L.featureGroup().addTo(map);
    let targetMarker = null;
    let rows = [];
    let selectedRow = null;
    let stationMarkers = [];
    // v1113: pilihan BM/SBM manual kekal terkunci apabila WGS84 diubah pada peta.
    let lockedStationRow = null;
    let lockedStationKey = '';
    let currentReference = null;
    let currentTarget = coordinate || null;
    let candidateReferences = [];
    let distanceLine = null;

    function referenceLabel(reference) {
      if (!reference) return 'WGS84';
      return String(reference.label || (
        reference.referenceType === 'pa'
          ? reference.paNo
          : `Lot ${reference.lotNo || '-'}`
      ) || 'Lokasi rujukan').trim();
    }

    function referenceLatLng(reference) {
      const lat = Number(reference && (reference.latitude ?? reference.lat));
      const lng = Number(reference && (reference.longitude ?? reference.lng));
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }

    function stationKey(row) {
      if (!row) return '';
      const stationNo = String(row.stationNo || '').trim().toUpperCase();
      const productId = String(row.productId || row.id || '').trim().toUpperCase();
      const identity = stationNo || productId;
      return identity ? `${String(product || '').trim().toUpperCase()}|${identity}` : '';
    }

    function lockStation(row) {
      const key = stationKey(row);
      if (!key) return;
      lockedStationKey = key;
      lockedStationRow = { ...(row || {}) };
    }

    function clearStationLock() {
      lockedStationKey = '';
      lockedStationRow = null;
    }

    function geometryLatLngs(reference) {
      const rings = reference && reference.geometry && Array.isArray(reference.geometry.rings)
        ? reference.geometry.rings
        : [];
      return rings.map((ring) => Array.isArray(ring)
        ? ring.map((point) => [Number(point && point[1]), Number(point && point[0])])
          .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
        : []).filter((ring) => ring.length >= 3);
    }

    function drawReference(reference, selected) {
      const latLng = referenceLatLng(reference);
      const rings = geometryLatLngs(reference);
      let layer = null;
      if (rings.length) {
        layer = L.polygon(rings, {
          pane: 'azobssReferencePane',
          color: selected ? '#facc15' : '#f59e0b',
          fillColor: '#fde047',
          weight: selected ? 5 : 3,
          fillOpacity: selected ? 0.24 : 0.12,
          opacity: 1,
          lineJoin: 'round',
          interactive: !selected
        }).addTo(referenceGroup);
      } else if (latLng) {
        layer = L.circleMarker([latLng.lat, latLng.lng], {
          pane: 'azobssReferencePane',
          radius: selected ? 11 : 7,
          color: '#facc15',
          fillColor: '#f59e0b',
          weight: selected ? 4 : 2,
          fillOpacity: selected ? 0.9 : 0.65
        }).addTo(referenceGroup);
      }
      if (layer) {
        layer.bindTooltip(referenceLabel(reference), {
          permanent: !!selected,
          direction: 'top',
          offset: [0, selected ? -5 : 0],
          className: selected ? 'az-pabm-reference-label' : 'az-pabm-map-target-label',
          opacity: 1
        });
        if (selected && typeof layer.bringToFront === 'function') layer.bringToFront();
      }
      return layer;
    }

    function clearDistanceGuide() {
      if (distanceLine) {
        try { map.removeLayer(distanceLine); } catch (_) {}
        distanceLine = null;
      }
    }

    function drawDistanceGuide(row) {
      clearDistanceGuide();
      if (!row || !currentTarget) return;
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      const targetLat = Number(currentTarget.lat);
      const targetLng = Number(currentTarget.lng);
      if (![lat, lng, targetLat, targetLng].every(Number.isFinite)) return;
      const distanceKm = Number(row.distanceKm);
      const distanceText = Number.isFinite(distanceKm)
        ? `${distanceKm.toFixed(3)} km`
        : `${(map.distance([targetLat, targetLng], [lat, lng]) / 1000).toFixed(3)} km`;
      distanceLine = L.polyline([[targetLat, targetLng], [lat, lng]], {
        weight: 3,
        opacity: 0.95,
        dashArray: '9 8',
        lineCap: 'round',
        interactive: false
      }).addTo(map);
      distanceLine.bindTooltip(distanceText, {
        permanent: true,
        direction: 'center',
        className: 'az-pabm-distance-line-label',
        opacity: 1
      }).openTooltip();
      if (typeof distanceLine.bringToFront === 'function') distanceLine.bringToFront();
    }

    function setSelectedMarker(index) {
      stationMarkers.forEach((marker, markerIndex) => {
        if (!marker) return;
        const selected = markerIndex === index;
        try {
          marker.setStyle({ radius: selected ? 11 : 7, weight: selected ? 4 : 2, fillOpacity: selected ? 1 : 0.8 });
          if (selected && typeof marker.bringToFront === 'function') marker.bringToFront();
          const tooltip = marker.getTooltip && marker.getTooltip();
          const tooltipEl = tooltip && tooltip.getElement ? tooltip.getElement() : null;
          if (tooltipEl) tooltipEl.classList.toggle('is-selected', selected);
          if (selected && marker.openTooltip) marker.openTooltip();
        } catch (_) {}
      });
    }

    function clearSelection() {
      selectedRow = null;
      ui.detail.hidden = true;
      ui.detailGrid.innerHTML = '';
      setFootStatus(ui, '', '');
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.remove('is-selected'));
      setSelectedMarker(-1);
      clearDistanceGuide();
    }

    function selectRow(index, pan, lockSelection = false) {
      const row = rows[index];
      if (!row) return;
      selectedRow = row;
      if (lockSelection) lockStation(row);
      ui.results.querySelectorAll('.az-pabm-map-result[data-index]').forEach((node) => node.classList.toggle('is-selected', Number(node.dataset.index) === index));
      setSelectedMarker(index);
      drawDistanceGuide(row);
      ui.detail.hidden = false;
      const refText = currentReference ? referenceLabel(currentReference) : 'WGS84';
      const stationLat = Number(row.latitude);
      const stationLng = Number(row.longitude);
      const hasStationCoords = Number.isFinite(stationLat) && Number.isFinite(stationLng);
      const stationWgs84 = hasStationCoords ? `${stationLat}, ${stationLng}` : '-';
      const googleMapsUrl = hasStationCoords
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stationLat},${stationLng}`)}`
        : '';
      const googleMapsLink = googleMapsUrl
        ? `<a class="az-pabm-google-maps-link" href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" title="Buka lokasi ini di Google Maps" aria-label="Buka lokasi ${escapeHtml(row.stationNo || product)} di Google Maps"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg></a>`
        : '';
      ui.detailGrid.innerHTML = `
        <b>Produk</b><span>${escapeHtml(product)}</span>
        <b>No. Stesen</b><span>${escapeHtml(row.stationNo || '-')}</span>
        <b>Jarak</b><span>${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km</span>
        <b>Rujukan</b><span>${escapeHtml(refText)}</span>
        <b>Negeri</b><span>${escapeHtml(row.negeri || state)}</span>
        <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
        <b>Bandar</b><span>${escapeHtml(row.bandar || '-')}</span>
        <b>Huraian</b><span>${escapeHtml(row.huraian || '-')}</span>
        <b>WGS84</b><span class="az-pabm-wgs84-value">${escapeHtml(stationWgs84)}${googleMapsLink}</span>`;
      ui.cartButton.textContent = `Tambah ${product} ${row.stationNo || row.productId || ''} ke Troli`;
      ui.cartButton.disabled = !(row.stationNo || row.productId);
      if (pan && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))) {
        const stationLatLng = [Number(row.latitude), Number(row.longitude)];
        if (currentTarget && Number.isFinite(Number(currentTarget.lat)) && Number.isFinite(Number(currentTarget.lng))) {
          map.fitBounds([[Number(currentTarget.lat), Number(currentTarget.lng)], stationLatLng], { padding: [80, 80], maxZoom: 15 });
        } else {
          map.setView(stationLatLng, Math.max(map.getZoom(), 14));
        }
      }
    }

    function chooseReference(index) {
      const reference = candidateReferences[index];
      if (!reference) return;
      clearStationLock();
      const target = referenceLatLng(reference);
      if (!target) return;
      ui.input.value = `${target.lat}, ${target.lng}`;
      runSearch(ui.input.value, target, reference);
    }

    function renderReferenceMatches(references) {
      stationGroup.clearLayers();
      referenceGroup.clearLayers();
      stationMarkers = [];
      rows = [];
      currentReference = null;
      currentTarget = null;
      clearSelection();
      if (targetMarker) {
        try { map.removeLayer(targetMarker); } catch (_) {}
        targetMarker = null;
      }
      const matches = Array.isArray(references) ? references : [];
      candidateReferences = matches;
      ui.results.innerHTML = matches.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-reference-index="${index}">
          <strong>${escapeHtml(referenceLabel(row))}</strong>
          <span>${escapeHtml([row.daerah, row.mukim, row.seksyen].filter(Boolean).join(' • ') || row.negeri || state)}</span>
          <span class="az-pabm-map-distance">Pilih lot ini untuk cari ${escapeHtml(product)} terdekat</span>
        </button>`).join('');
      matches.forEach((row, index) => {
        const layer = drawReference(row, false);
        if (layer) layer.on('click', () => chooseReference(index));
      });
      const bounds = referenceGroup.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
      setModalStatus(ui, `${matches.length} padanan lot ditemui. Pilih lot yang betul daripada senarai atau pada kawasan peta.`, 'success');
    }

    function renderRows(newRows, target, reference, preserveViewport = false) {
      stationGroup.clearLayers();
      referenceGroup.clearLayers();
      stationMarkers = [];

      const incomingRows = Array.isArray(newRows)
        ? newRows.map((row) => ({ ...(row || {}) }))
        : [];

      // v1113: apabila WGS84 sahaja berubah, jangan tukar BM/SBM yang pengguna
      // telah pilih. Jika stesen itu tiada dalam senarai nearest baharu, kekalkan
      // salinannya dan kira semula jarak dari titik WGS84 baharu.
      if (preserveViewport && lockedStationKey && lockedStationRow) {
        const existingIndex = incomingRows.findIndex((row) => stationKey(row) === lockedStationKey);
        if (existingIndex >= 0) {
          lockedStationRow = { ...lockedStationRow, ...incomingRows[existingIndex] };
          rows = incomingRows;
        } else {
          const lockedCopy = { ...lockedStationRow, _azobssLockedStation: true };
          const stationLat = Number(lockedCopy.latitude);
          const stationLng = Number(lockedCopy.longitude);
          const targetLat = Number(target && target.lat);
          const targetLng = Number(target && target.lng);
          if ([stationLat, stationLng, targetLat, targetLng].every(Number.isFinite)) {
            lockedCopy.distanceKm = map.distance([targetLat, targetLng], [stationLat, stationLng]) / 1000;
          }
          rows = [lockedCopy, ...incomingRows.filter((row) => stationKey(row) !== lockedStationKey)];
        }
      } else {
        rows = incomingRows;
      }

      currentReference = reference || null;
      currentTarget = target || null;
      clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} }
      const targetLabel = currentReference ? referenceLabel(currentReference) : 'WGS84 dicari';
      if (currentReference) drawReference(currentReference, true);
      targetMarker = createSearchTargetMarker(L, map, target, currentReference ? `${targetLabel} • Lokasi carian` : 'Lokasi carian');
      if (!rows.length) {
        ui.results.innerHTML = `<div class="az-pabm-map-empty">Tiada ${escapeHtml(product)} ditemui berdekatan ${escapeHtml(currentReference ? referenceLabel(currentReference) : 'koordinat ini')} dalam ${escapeHtml(state)}.</div>`;
        if (preserveViewport) map.setView([target.lat, target.lng], map.getZoom(), { animate: false });
        else map.setView([target.lat, target.lng], 12);
        return;
      }
      const distanceFrom = currentReference ? referenceLabel(currentReference) : 'WGS84';
      ui.results.innerHTML = rows.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-index="${index}">
          <strong>${escapeHtml(product)} ${escapeHtml(row.stationNo || row.productId || '-')}${stationKey(row) === lockedStationKey ? ' • Dipilih' : ''}</strong>
          <span class="az-pabm-map-distance">${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km dari ${escapeHtml(distanceFrom)}</span>
          <span>${escapeHtml([row.daerah, row.bandar].filter(Boolean).join(' • ') || row.negeri || state)}</span>
        </button>`).join('');
      rows.slice(0, 30).forEach((row, index) => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const marker = L.circleMarker([lat, lng], { radius: 7, weight: 2, fillOpacity: 0.8, bubblingMouseEvents: false }).addTo(stationGroup);
        const stationLabel = String(row.stationNo || row.productId || '-').trim();
        marker.bindTooltip(stationLabel, { permanent: true, direction: 'top', offset: [0, -8], className: 'az-pabm-station-label' });
        marker.on('click', () => selectRow(index, false, true));
        stationMarkers[index] = marker;
      });
      const bounds = stationGroup.getBounds();
      const refBounds = referenceGroup.getBounds();
      if (preserveViewport) {
        // v1112: double-click WGS84 hanya menukar titik carian.
        // Zoom semasa pengguna dikekalkan; jangan fit semua BM/SBM terdekat.
        map.setView([target.lat, target.lng], map.getZoom(), { animate: false });
      } else if (currentReference && refBounds.isValid()) {
        // v1103: a cadastral lot is only a few metres wide. Fitting all nearby
        // BM/SBM stations at once zoomed the map out so far that the real lot
        // polygon became only 1–2 pixels and looked as if it had disappeared.
        // Start by showing the true lot/PA shape clearly; clicking a BM/SBM
        // result still fits the origin + selected station and draws the distance line.
        map.fitBounds(refBounds, { padding: [85, 85], maxZoom: 18 });
        if (map.getZoom() < 16) map.setZoom(16);
      } else if (bounds.isValid()) {
        const combined = L.latLngBounds(bounds);
        combined.extend([target.lat, target.lng]);
        map.fitBounds(combined, { padding: [35, 35], maxZoom: 13 });
      } else map.setView([target.lat, target.lng], 12);

      if (preserveViewport && lockedStationKey) {
        const lockedIndex = rows.findIndex((row) => stationKey(row) === lockedStationKey);
        if (lockedIndex >= 0) {
          selectRow(lockedIndex, false, false);
        } else {
          selectRow(0, false, false);
        }
      } else {
        selectRow(0, false, false);
      }
    }

    async function runSearch(searchValue, explicitCoordinate, explicitReference, preserveViewport = false) {
      const typedValue = String(searchValue || '').trim();
      const target = explicitCoordinate || parseCoordinates(typedValue);
      if (!target && !typedValue) {
        setModalStatus(ui, 'Masukkan Nombor Lot, Nombor PA atau koordinat WGS84 yang sah.', 'error');
        return;
      }
      if (activeController) { try { activeController.abort(); } catch (_) {} }
      activeController = new AbortController();
      setSearchBusy(ui, true, `Mencari ${product}...`);
      setModalStatus(ui, `Mencari ${product} terdekat...`, 'loading');
      try {
        const params = new URLSearchParams({ product, negeri: state });
        if (target) {
          params.set('lat', String(target.lat));
          params.set('lng', String(target.lng));
        } else {
          params.set('q', typedValue);
        }
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-benchmark-nearby?${params.toString()}`, activeController.signal);

        if (data.needsReferenceSelection && Array.isArray(data.referenceMatches) && data.referenceMatches.length) {
          renderReferenceMatches(data.referenceMatches);
          setInlineStatus(externalStatus, `${data.referenceMatches.length} padanan lot ditemui. Pilih lot pada peta.`, 'success');
          return;
        }

        const resolvedTarget = target || {
          lat: Number(data.latitude ?? data.target?.latitude),
          lng: Number(data.longitude ?? data.target?.longitude)
        };
        if (!resolvedTarget || !Number.isFinite(resolvedTarget.lat) || !Number.isFinite(resolvedTarget.lng)) {
          throw new Error('Lokasi rujukan tidak mempunyai koordinat WGS84 yang sah.');
        }
        const resolvedReference = explicitReference || data.reference || null;
        renderRows(data.results, resolvedTarget, resolvedReference, preserveViewport);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        const warning = data.warning ? ' Data live JUPEM tidak tersedia; senarai fallback digunakan.' : '';
        const sourceText = resolvedReference ? ` berhampiran ${referenceLabel(resolvedReference)}` : '';
        setModalStatus(ui, count ? `${count} ${product} terdekat${sourceText} ditemui.${warning}` : `Tiada ${product} ditemui berdekatan lokasi ini.`, count ? 'success' : 'error');
        setInlineStatus(externalStatus, count ? `${count} ${product} terdekat ditemui pada peta.` : `Tiada ${product} ditemui.`, count ? 'success' : 'error');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        stationGroup.clearLayers();
        referenceGroup.clearLayers();
        rows = [];
        stationMarkers = [];
        clearSelection();
        setModalStatus(ui, error.message || `Carian ${product} gagal.`, 'error');
        setInlineStatus(externalStatus, error.message || `Carian ${product} gagal.`, 'error');
      } finally {
        setSearchBusy(ui, false);
      }
    }

    ui.form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearStationLock();
      runSearch(ui.input.value);
    });
    ui.results.addEventListener('click', (event) => {
      const referenceButton = event.target.closest('[data-reference-index]');
      if (referenceButton) {
        chooseReference(Number(referenceButton.dataset.referenceIndex));
        return;
      }
      const button = event.target.closest('[data-index]');
      if (button) selectRow(Number(button.dataset.index), true, true);
    });
    ui.cartButton.addEventListener('click', async () => {
      if (!selectedRow) return;
      try {
        await addToCart(benchmarkCartPayload(selectedRow, product, state), ui, externalStatus);
      } catch (error) {
        setFootStatus(ui, error.message || `${product} tidak dapat ditambah ke troli.`, 'error');
      }
    });

    // v1107: MyLot-style lot inspection in Earth mode. A single click reads the
    // official JUPEM cadastral feature at that WGS84 point without moving the
    // BM/SBM search origin. Double-click remains reserved for setting a new origin.
    let lotInspectController = null;
    let lotClickTimer = null;
    async function inspectLotAtPoint(latlng) {
      if (!earthControl || !earthControl.isEarth() || !latlng) return;
      if (lotInspectController) { try { lotInspectController.abort(); } catch (_) {} }
      lotInspectController = new AbortController();
      const lat = Number(latlng.lat);
      const lng = Number(latlng.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const loadingPopup = L.popup({ className: 'az-pabm-lot-info-popup', maxWidth: 310 })
        .setLatLng(latlng)
        .setContent('<div class="lot-title">Mencari info lot JUPEM...</div>')
        .openOn(map);
      try {
        const params = new URLSearchParams({
          negeri: benchmarkStateCode,
          lat: String(lat),
          lng: String(lng)
        });
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-pa-map-search?${params.toString()}`, lotInspectController.signal);
        const row = Array.isArray(data.results) && data.results.length ? data.results[0] : null;
        if (!row) {
          loadingPopup.setContent('<div class="lot-title">Tiada lot JUPEM ditemui pada titik ini.</div>');
          return;
        }
        const html = `
          <div class="lot-title">Lot ${escapeHtml(row.lotNo || '-')} ${row.paNo ? `&#8226; ${escapeHtml(row.paNo)}` : ''}</div>
          <div class="lot-grid">
            <b>Nombor Lot</b><span>${escapeHtml(row.lotNo || '-')}</span>
            <b>Nombor PA</b><span>${escapeHtml(row.paNo || 'Tiada')}</span>
            <b>Negeri</b><span>${escapeHtml(row.negeri || data.negeri || state || '-')}</span>
            <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
            <b>Mukim/Bandar</b><span>${escapeHtml(row.mukim || '-')}</span>
            <b>Seksyen</b><span>${escapeHtml(row.seksyen || '-')}</span>
            <b>WGS84</b><span>${escapeHtml(`${lat.toFixed(7)}, ${lng.toFixed(7)}`)}</span>
          </div>`;
        loadingPopup.setContent(html);
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        loadingPopup.setContent(`<div class="lot-title">${escapeHtml(error.message || 'Info lot JUPEM tidak tersedia.')}</div>`);
      }
    }

    map.on('click', (event) => {
      if (!earthControl || !earthControl.isEarth() || !event || !event.latlng) return;
      if (lotClickTimer) window.clearTimeout(lotClickTimer);
      lotClickTimer = window.setTimeout(() => {
        lotClickTimer = null;
        inspectLotAtPoint(event.latlng);
      }, 280);
    });
    map.on('dblclick', (event) => {
      if (lotClickTimer) { window.clearTimeout(lotClickTimer); lotClickTimer = null; }
      if (!event || !event.latlng) return;
      const target = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      ui.input.value = `${target.lat}, ${target.lng}`;
      runSearch(ui.input.value, target, null, true);
    });

    runSearch(ui.input.value, coordinate);
  }


  function gpsCartPayload(row, state) {
    const stationNo = String(row && (row.stationNo || row.itemCode) || '').trim().toUpperCase();
    const productId = String(row && (row.productId || row.id) || '').trim();
    return {
      productType: 'GPS',
      product: 'GPS',
      itemCode: stationNo || productId,
      stationNo,
      productId,
      negeri: String(row && row.negeri || state || '').trim().toUpperCase(),
      amount: 9,
      downloadUrl: String(row && row.downloadUrl || (stationNo ? `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenGPS/${encodeURIComponent(stationNo)}` : '')).trim(),
      filename: stationNo ? `${stationNo}.pdf` : 'GPS.pdf',
      azobssCartValidated: true,
      azobssCartValidatedBy: 'official-stesen-gps-map'
    };
  }

  async function openGpsMap(initialValue) {
    const stateEl = document.getElementById('gpsState');
    const externalStatus = document.getElementById('gpsMapSearchStatus');
    const state = String(stateEl && stateEl.value || '').trim().toUpperCase();
    const stateCode = STATE_CODES[state] || '';
    const rawInitial = String(initialValue || '').trim();
    const coordinate = parseCoordinates(rawInitial);
    if (!stateCode) {
      setInlineStatus(externalStatus, 'Pilih negeri terlebih dahulu.', 'error');
      stateEl && stateEl.focus();
      return;
    }
    if (!rawInitial) {
      setInlineStatus(externalStatus, 'Masukkan Nombor Lot, Nombor PA atau WGS84 terlebih dahulu.', 'error');
      document.getElementById('gpsMapSearchInput')?.focus();
      return;
    }

    setInlineStatus(externalStatus, 'Membuka Peta Pilihan GPS...', '');
    const L = await loadLeaflet();
    addStyles();
    const ui = createModal(
      'Peta Pilihan GPS',
      `${state} • Cari GPS terdekat menggunakan Nombor Lot, Nombor PA atau WGS84`,
      'Contoh: Lot 1122 / PA2131 / 3.1390, 101.6869',
      'Nombor biasa dianggap sebagai Lot. Untuk Pelan Akui, gunakan awalan PA. Double-click lokasi pada peta untuk menetapkan titik carian GPS baharu.'
    );
    ui.input.value = coordinate ? `${coordinate.lat}, ${coordinate.lng}` : rawInitial;
    const initialCenter = coordinate ? [coordinate.lat, coordinate.lng] : [4.2, 102.1];
    const initialZoom = coordinate ? 11 : 7;
    const map = L.map(ui.canvas, { zoomControl: true, doubleClickZoom: false }).setView(initialCenter, initialZoom);
    ui.modal._azobssMap = map;
    const streetLayer = addBaseMap(L, map);
    addJupemLotOverlay(L, map, stateCode, '1', 0.84);
    const earthControl = createBenchmarkEarthControl(L, map, ui.canvas.parentElement, streetLayer, stateCode);
    if (!map.getPane('azobssGpsReferencePane')) {
      const pane = map.createPane('azobssGpsReferencePane');
      pane.style.zIndex = '575';
      pane.style.pointerEvents = 'none';
    }
    window.setTimeout(() => map.invalidateSize(), 60);

    const stationGroup = L.featureGroup().addTo(map);
    const referenceGroup = L.featureGroup().addTo(map);
    let targetMarker = null;
    let rows = [];
    let selectedRow = null;
    let stationMarkers = [];
    let currentReference = null;
    let currentTarget = coordinate || null;
    let candidateReferences = [];
    let distanceLine = null;

    function referenceLabel(reference) {
      if (!reference) return 'WGS84';
      return String(reference.label || (reference.referenceType === 'pa' ? reference.paNo : `Lot ${reference.lotNo || '-'}`) || 'Lokasi rujukan').trim();
    }
    function referenceLatLng(reference) {
      const lat = Number(reference && (reference.latitude ?? reference.lat));
      const lng = Number(reference && (reference.longitude ?? reference.lng));
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    function geometryLatLngs(reference) {
      const rings = reference && reference.geometry && Array.isArray(reference.geometry.rings) ? reference.geometry.rings : [];
      return rings.map((ring) => Array.isArray(ring)
        ? ring.map((point) => [Number(point && point[1]), Number(point && point[0])]).filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
        : []).filter((ring) => ring.length >= 3);
    }
    function drawReference(reference, selected) {
      const latLng = referenceLatLng(reference);
      const rings = geometryLatLngs(reference);
      let layer = null;
      if (rings.length) {
        layer = L.polygon(rings, {
          pane: 'azobssGpsReferencePane', color: selected ? '#facc15' : '#f59e0b', fillColor: '#fde047',
          weight: selected ? 5 : 3, fillOpacity: selected ? 0.24 : 0.12, opacity: 1, lineJoin: 'round', interactive: true
        }).addTo(referenceGroup);
      } else if (latLng) {
        layer = L.circleMarker([latLng.lat, latLng.lng], { radius: selected ? 9 : 7, weight: selected ? 4 : 2, fillOpacity: selected ? 0.9 : 0.65 }).addTo(referenceGroup);
      }
      if (layer) {
        layer.bindTooltip(referenceLabel(reference), {
          permanent: !!selected, direction: 'top', offset: [0, selected ? -5 : 0],
          className: selected ? 'az-pabm-reference-label' : 'az-pabm-map-target-label', opacity: 1
        });
        if (selected && typeof layer.bringToFront === 'function') layer.bringToFront();
      }
      return layer;
    }
    function clearDistanceGuide() {
      if (!distanceLine) return;
      try { map.removeLayer(distanceLine); } catch (_) {}
      distanceLine = null;
    }
    function drawDistanceGuide(row) {
      clearDistanceGuide();
      if (!row || !currentTarget) return;
      const lat = Number(row.latitude), lng = Number(row.longitude);
      const targetLat = Number(currentTarget.lat), targetLng = Number(currentTarget.lng);
      if (![lat, lng, targetLat, targetLng].every(Number.isFinite)) return;
      const distanceKm = Number(row.distanceKm);
      const distanceText = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(3)} km` : `${(map.distance([targetLat, targetLng], [lat, lng]) / 1000).toFixed(3)} km`;
      distanceLine = L.polyline([[targetLat, targetLng], [lat, lng]], { weight: 3, opacity: 0.95, dashArray: '9 8', lineCap: 'round', interactive: false }).addTo(map);
      distanceLine.bindTooltip(distanceText, { permanent: true, direction: 'center', className: 'az-pabm-distance-line-label', opacity: 1 }).openTooltip();
      if (typeof distanceLine.bringToFront === 'function') distanceLine.bringToFront();
    }
    function setSelectedMarker(index) {
      stationMarkers.forEach((marker, markerIndex) => {
        if (!marker) return;
        const selected = markerIndex === index;
        try {
          marker.setStyle({ radius: selected ? 11 : 7, weight: selected ? 4 : 2, fillOpacity: selected ? 1 : 0.8 });
          if (selected && typeof marker.bringToFront === 'function') marker.bringToFront();
          const tooltip = marker.getTooltip && marker.getTooltip();
          const tooltipEl = tooltip && tooltip.getElement ? tooltip.getElement() : null;
          if (tooltipEl) tooltipEl.classList.toggle('is-selected', selected);
          if (selected && marker.openTooltip) marker.openTooltip();
        } catch (_) {}
      });
    }
    function clearSelection() {
      selectedRow = null;
      ui.detail.hidden = true;
      ui.detailGrid.innerHTML = '';
      setFootStatus(ui, '', '');
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.remove('is-selected'));
      setSelectedMarker(-1);
      clearDistanceGuide();
    }
    function selectRow(index, pan) {
      const row = rows[index];
      if (!row) return;
      selectedRow = row;
      ui.results.querySelectorAll('.az-pabm-map-result[data-index]').forEach((node) => node.classList.toggle('is-selected', Number(node.dataset.index) === index));
      setSelectedMarker(index);
      drawDistanceGuide(row);
      ui.detail.hidden = false;
      const refText = currentReference ? referenceLabel(currentReference) : 'WGS84';
      const lat = Number(row.latitude), lng = Number(row.longitude);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const wgs84 = hasCoords ? `${lat}, ${lng}` : '-';
      const mapsUrl = hasCoords ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}` : '';
      const mapsLink = mapsUrl
        ? `<a class="az-pabm-google-maps-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" title="Buka lokasi ini di Google Maps" aria-label="Buka lokasi ${escapeHtml(row.stationNo || 'GPS')} di Google Maps"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg></a>`
        : '';
      ui.detailGrid.innerHTML = `
        <b>Produk</b><span>GPS</span>
        <b>No. Stesen</b><span>${escapeHtml(row.stationNo || '-')}</span>
        <b>Jarak</b><span>${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km</span>
        <b>Rujukan</b><span>${escapeHtml(refText)}</span>
        <b>Negeri</b><span>${escapeHtml(row.negeri || state)}</span>
        <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
        <b>Tempat</b><span>${escapeHtml(row.tempat || '-')}</span>
        <b>WGS84</b><span class="az-pabm-wgs84-value">${escapeHtml(wgs84)}${mapsLink}</span>`;
      ui.cartButton.textContent = `Tambah GPS ${row.stationNo || row.productId || ''} ke Troli`;
      ui.cartButton.disabled = !(row.stationNo || row.productId);
      if (pan && hasCoords) {
        if (currentTarget) map.fitBounds([[Number(currentTarget.lat), Number(currentTarget.lng)], [lat, lng]], { padding: [80, 80], maxZoom: 15 });
        else map.setView([lat, lng], Math.max(map.getZoom(), 14));
      }
    }
    function chooseReference(index) {
      const reference = candidateReferences[index];
      if (!reference) return;
      const target = referenceLatLng(reference);
      if (!target) return;
      ui.input.value = `${target.lat}, ${target.lng}`;
      runSearch(ui.input.value, target, reference);
    }
    function renderReferenceMatches(references) {
      stationGroup.clearLayers(); referenceGroup.clearLayers(); stationMarkers = []; rows = []; currentReference = null; currentTarget = null; clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} targetMarker = null; }
      const matches = Array.isArray(references) ? references : [];
      candidateReferences = matches;
      ui.results.innerHTML = matches.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-reference-index="${index}">
          <strong>${escapeHtml(referenceLabel(row))}</strong>
          <span>${escapeHtml([row.daerah, row.mukim, row.seksyen].filter(Boolean).join(' • ') || row.negeri || state)}</span>
          <span class="az-pabm-map-distance">Pilih lot ini untuk cari GPS terdekat</span>
        </button>`).join('');
      matches.forEach((row, index) => { const layer = drawReference(row, false); if (layer) layer.on('click', () => chooseReference(index)); });
      const bounds = referenceGroup.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
      setModalStatus(ui, `${matches.length} padanan lot ditemui. Pilih lot yang betul daripada senarai atau pada kawasan peta.`, 'success');
    }
    function renderRows(newRows, target, reference, preserveViewport = false) {
      stationGroup.clearLayers(); referenceGroup.clearLayers(); stationMarkers = [];
      rows = Array.isArray(newRows) ? newRows : [];
      currentReference = reference || null; currentTarget = target || null; clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} }
      const targetLabel = currentReference ? referenceLabel(currentReference) : 'WGS84 dicari';
      if (currentReference) drawReference(currentReference, true);
      targetMarker = createSearchTargetMarker(L, map, target, currentReference ? `${targetLabel} • Lokasi carian` : 'Lokasi carian');
      if (!rows.length) {
        ui.results.innerHTML = `<div class="az-pabm-map-empty">Tiada GPS ditemui berdekatan ${escapeHtml(currentReference ? referenceLabel(currentReference) : 'koordinat ini')} dalam ${escapeHtml(state)}.</div>`;
        if (preserveViewport) map.setView([target.lat, target.lng], map.getZoom(), { animate: false });
        else map.setView([target.lat, target.lng], 12);
        return;
      }
      const distanceFrom = currentReference ? referenceLabel(currentReference) : 'WGS84';
      ui.results.innerHTML = rows.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-index="${index}">
          <strong>GPS ${escapeHtml(row.stationNo || row.productId || '-')}</strong>
          <span class="az-pabm-map-distance">${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km dari ${escapeHtml(distanceFrom)}</span>
          <span>${escapeHtml([row.daerah, row.tempat].filter(Boolean).join(' • ') || row.negeri || state)}</span>
        </button>`).join('');
      rows.slice(0, 30).forEach((row, index) => {
        const lat = Number(row.latitude), lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const marker = L.circleMarker([lat, lng], { radius: 7, weight: 2, fillOpacity: 0.8, bubblingMouseEvents: false }).addTo(stationGroup);
        marker.bindTooltip(String(row.stationNo || row.productId || '-').trim(), { permanent: true, direction: 'top', offset: [0, -8], className: 'az-pabm-station-label' });
        marker.on('click', () => selectRow(index, false)); stationMarkers[index] = marker;
      });
      const bounds = stationGroup.getBounds(); const refBounds = referenceGroup.getBounds();
      if (preserveViewport) {
        // v1112: double-click WGS84 hanya menukar titik carian GPS.
        // Kekalkan zoom semasa dan pusatkan titik baru tanpa auto zoom-out.
        map.setView([target.lat, target.lng], map.getZoom(), { animate: false });
      } else if (currentReference && refBounds.isValid()) {
        map.fitBounds(refBounds, { padding: [85, 85], maxZoom: 18 }); if (map.getZoom() < 16) map.setZoom(16);
      } else if (bounds.isValid()) {
        const combined = L.latLngBounds(bounds); combined.extend([target.lat, target.lng]); map.fitBounds(combined, { padding: [35, 35], maxZoom: 13 });
      } else map.setView([target.lat, target.lng], 12);
      selectRow(0, false);
    }
    async function runSearch(searchValue, explicitCoordinate, explicitReference, preserveViewport = false) {
      const typedValue = String(searchValue || '').trim();
      const target = explicitCoordinate || parseCoordinates(typedValue);
      if (!target && !typedValue) { setModalStatus(ui, 'Masukkan Nombor Lot, Nombor PA atau koordinat WGS84 yang sah.', 'error'); return; }
      if (activeController) { try { activeController.abort(); } catch (_) {} }
      activeController = new AbortController(); setSearchBusy(ui, true, 'Mencari GPS...'); setModalStatus(ui, 'Mencari GPS terdekat...', 'loading');
      try {
        const params = new URLSearchParams({ negeri: state });
        if (target) { params.set('lat', String(target.lat)); params.set('lng', String(target.lng)); }
        else params.set('q', typedValue);
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-gps-nearby?${params.toString()}`, activeController.signal);
        if (data.needsReferenceSelection && Array.isArray(data.referenceMatches) && data.referenceMatches.length) {
          renderReferenceMatches(data.referenceMatches); setInlineStatus(externalStatus, `${data.referenceMatches.length} padanan lot ditemui. Pilih lot pada peta.`, 'success'); return;
        }
        const resolvedTarget = target || { lat: Number(data.latitude ?? data.target?.latitude), lng: Number(data.longitude ?? data.target?.longitude) };
        if (!resolvedTarget || !Number.isFinite(resolvedTarget.lat) || !Number.isFinite(resolvedTarget.lng)) throw new Error('Lokasi rujukan tidak mempunyai koordinat WGS84 yang sah.');
        const resolvedReference = explicitReference || data.reference || null;
        renderRows(data.results, resolvedTarget, resolvedReference, preserveViewport);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        const sourceText = resolvedReference ? ` berhampiran ${referenceLabel(resolvedReference)}` : '';
        setModalStatus(ui, count ? `${count} GPS terdekat${sourceText} ditemui.` : 'Tiada GPS ditemui berdekatan lokasi ini.', count ? 'success' : 'error');
        setInlineStatus(externalStatus, count ? `${count} GPS terdekat ditemui pada peta.` : 'Tiada GPS ditemui.', count ? 'success' : 'error');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        stationGroup.clearLayers(); referenceGroup.clearLayers(); rows = []; stationMarkers = []; clearSelection();
        setModalStatus(ui, error.message || 'Carian GPS tidak tersedia.', 'error'); setInlineStatus(externalStatus, error.message || 'Carian GPS tidak tersedia.', 'error');
      } finally { setSearchBusy(ui, false); }
    }

    ui.form.addEventListener('submit', (event) => { event.preventDefault(); runSearch(ui.input.value); });
    ui.results.addEventListener('click', (event) => {
      const referenceButton = event.target.closest('[data-reference-index]'); if (referenceButton) { chooseReference(Number(referenceButton.dataset.referenceIndex)); return; }
      const button = event.target.closest('[data-index]'); if (button) selectRow(Number(button.dataset.index), true);
    });
    ui.cartButton.addEventListener('click', async () => {
      if (!selectedRow) return;
      try { await addToCart(gpsCartPayload(selectedRow, state), ui, externalStatus); }
      catch (error) { setFootStatus(ui, error.message || 'GPS tidak dapat ditambah ke troli.', 'error'); }
    });

    let lotInspectController = null;
    let lotClickTimer = null;
    async function inspectLotAtPoint(latlng) {
      if (!earthControl || !earthControl.isEarth() || !latlng) return;
      if (lotInspectController) { try { lotInspectController.abort(); } catch (_) {} }
      lotInspectController = new AbortController();
      const lat = Number(latlng.lat), lng = Number(latlng.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const popup = L.popup({ className: 'az-pabm-lot-info-popup', maxWidth: 310 }).setLatLng(latlng).setContent('<div class="lot-title">Mencari info lot JUPEM...</div>').openOn(map);
      try {
        const params = new URLSearchParams({ negeri: stateCode, lat: String(lat), lng: String(lng) });
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-pa-map-search?${params.toString()}`, lotInspectController.signal);
        const row = Array.isArray(data.results) && data.results.length ? data.results[0] : null;
        if (!row) { popup.setContent('<div class="lot-title">Tiada lot JUPEM ditemui pada titik ini.</div>'); return; }
        popup.setContent(`<div class="lot-title">Lot ${escapeHtml(row.lotNo || '-')} ${row.paNo ? `&#8226; ${escapeHtml(row.paNo)}` : ''}</div><div class="lot-grid"><b>Nombor Lot</b><span>${escapeHtml(row.lotNo || '-')}</span><b>Nombor PA</b><span>${escapeHtml(row.paNo || 'Tiada')}</span><b>Negeri</b><span>${escapeHtml(row.negeri || data.negeri || state || '-')}</span><b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span><b>Mukim/Bandar</b><span>${escapeHtml(row.mukim || '-')}</span><b>Seksyen</b><span>${escapeHtml(row.seksyen || '-')}</span><b>WGS84</b><span>${escapeHtml(`${lat.toFixed(7)}, ${lng.toFixed(7)}`)}</span></div>`);
      } catch (error) { if (error && error.name === 'AbortError') return; popup.setContent(`<div class="lot-title">${escapeHtml(error.message || 'Info lot JUPEM tidak tersedia.')}</div>`); }
    }
    map.on('click', (event) => {
      if (!earthControl || !earthControl.isEarth() || !event || !event.latlng) return;
      if (lotClickTimer) window.clearTimeout(lotClickTimer);
      lotClickTimer = window.setTimeout(() => { lotClickTimer = null; inspectLotAtPoint(event.latlng); }, 280);
    });
    map.on('dblclick', (event) => {
      if (lotClickTimer) { window.clearTimeout(lotClickTimer); lotClickTimer = null; }
      if (!event || !event.latlng) return;
      const target = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      ui.input.value = `${target.lat}, ${target.lng}`; runSearch(ui.input.value, target, null, true);
    });
    runSearch(ui.input.value, coordinate);
  }

  function bind() {
    addStyles();
    const paInput = document.getElementById('paMapSearchInput');
    const paButton = document.getElementById('paMapSearchButton');
    const bmInput = document.getElementById('benchmarkMapWgs84Input');
    const bmButton = document.getElementById('benchmarkMapOpenButton');
    const bmProduct = document.getElementById('benchmarkProduct');
    const gpsInput = document.getElementById('gpsMapSearchInput');
    const gpsButton = document.getElementById('gpsMapOpenButton');

    paButton?.addEventListener('click', () => openPaMap(paInput && paInput.value).catch((error) => {
      setInlineStatus(document.getElementById('paMapSearchStatus'), error.message || 'Peta Pilihan PA tidak dapat dibuka.', 'error');
    }));
    paInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      paButton?.click();
    });

    function syncBenchmarkLabel() {
      if (!bmButton) return;
      const product = String(bmProduct && bmProduct.value || 'BM').toUpperCase() === 'SBM' ? 'SBM' : 'BM';
      bmButton.textContent = `Buka Peta Pilihan ${product}`;
    }
    bmProduct?.addEventListener('change', syncBenchmarkLabel);
    syncBenchmarkLabel();
    bmButton?.addEventListener('click', () => openBenchmarkMap(bmInput && bmInput.value).catch((error) => {
      setInlineStatus(document.getElementById('benchmarkMapStatus'), error.message || 'Peta Pilihan BM/SBM tidak dapat dibuka.', 'error');
    }));
    bmInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      bmButton?.click();
    });

    gpsButton?.addEventListener('click', () => openGpsMap(gpsInput && gpsInput.value).catch((error) => {
      setInlineStatus(document.getElementById('gpsMapSearchStatus'), error.message || 'Peta Pilihan GPS tidak dapat dibuka.', 'error');
    }));
    gpsInput?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      gpsButton?.click();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeModal) closeActiveModal();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
