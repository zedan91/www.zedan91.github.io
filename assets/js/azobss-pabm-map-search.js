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
    if (document.getElementById('azobssPabmMapSearchStyles1093')) return;
    const style = document.createElement('style');
    style.id = 'azobssPabmMapSearchStyles1093';
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
      .az-pabm-map-searchform button:disabled{opacity:.6;cursor:wait}
      .az-pabm-map-searchhint{margin:5px 2px 0;color:#334155;font-size:11px;line-height:1.25}
      .az-pabm-map-side{min-height:0;display:flex;flex-direction:column;border-left:1px solid #2d405b;background:#0f1b2e}
      .az-pabm-map-status{padding:10px 12px;border-bottom:1px solid #263951;color:#bfd0e6;font-size:12px;line-height:1.35;background:#111f34}
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
      .az-pabm-map-cart{width:100%;min-height:42px;border:0;border-radius:6px;background:#059669;color:#fff;font-weight:900;font-size:14px;cursor:pointer}
      .az-pabm-map-cart:disabled{opacity:.55;cursor:not-allowed}
      .az-pabm-map-footstatus{min-height:16px;margin-top:6px;color:#a9bad0;font-size:11px;line-height:1.3}
      .az-pabm-map-footstatus.is-error{color:#fda4af}.az-pabm-map-footstatus.is-success{color:#86efac}
      .az-pabm-map-target-label{padding:2px 5px;border-radius:4px;background:#0f172a;color:#fff;font-size:11px;font-weight:800;white-space:nowrap}
      @media(max-width:800px){
        .az-pabm-map-modal{padding:4px}.az-pabm-map-dialog{width:calc(100vw - 8px);height:calc(100vh - 8px)}
        .az-pabm-map-body{grid-template-columns:1fr;grid-template-rows:minmax(330px,55vh) minmax(0,1fr)}
        .az-pabm-map-side{border-left:0;border-top:1px solid #2d405b}.az-pabm-map-searchbox{left:46px;width:calc(100% - 94px)}
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
  }

  function setFootStatus(ui, text, kind) {
    ui.footStatus.textContent = text || '';
    ui.footStatus.classList.toggle('is-error', kind === 'error');
    ui.footStatus.classList.toggle('is-success', kind === 'success');
  }

  function addBaseMap(L, map) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  }

  function addJupemLotOverlay(L, map, stateCode) {
    try {
      return L.tileLayer(`${BACKEND_BASE}/api/jupem-lot-map/tile/{z}/{x}/{y}.png?produk=1&negeri=${encodeURIComponent(stateCode)}&scope=all&layerMode=lots&layerSet=3`, {
        minZoom: 11,
        maxZoom: 20,
        opacity: 0.82,
        pane: 'overlayPane'
      }).addTo(map);
    } catch (_) { return null; }
  }

  function paCartPayload(row, state) {
    const paNo = String(row && row.paNo || '').trim().toUpperCase();
    const itemCode = paNo.replace(/^PA/i, '');
    return {
      productType: 'PA',
      itemCode,
      negeri: state,
      amount: 5,
      downloadUrl: `${BACKEND_BASE}/api/pa-pdf?noPA=${encodeURIComponent(paNo + '.TIF')}&negeri=${encodeURIComponent(state)}`,
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
      `${state} • Cari melalui Nombor Lot atau WGS84`,
      'Contoh: Lot 1122 atau 3.1390, 101.6869',
      'Klik mana-mana lot pada peta untuk menyemak PA di koordinat tersebut.'
    );
    ui.input.value = value;
    const map = L.map(ui.canvas, { zoomControl: true }).setView([4.2, 102.1], 7);
    ui.modal._azobssMap = map;
    addBaseMap(L, map);
    addJupemLotOverlay(L, map, stateCode);
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

    function selectRow(index) {
      const row = rows[index];
      if (!row) return;
      selectedRow = row;
      selectedLayer = row._layer || null;
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.toggle('is-selected', Number(node.dataset.index) === index));
      ui.detail.hidden = false;
      ui.detailGrid.innerHTML = `
        <b>Nombor PA</b><span>${escapeHtml(row.paNo || 'Tiada')}</span>
        <b>Nombor Lot</b><span>${escapeHtml(row.lotNo || '-')}</span>
        <b>Negeri</b><span>${escapeHtml(row.negeri || state)}</span>
        <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
        <b>Mukim</b><span>${escapeHtml(row.mukim || '-')}</span>
        <b>Seksyen</b><span>${escapeHtml(row.seksyen || '-')}</span>`;
      ui.cartButton.textContent = row.paNo ? `Tambah ${row.paNo} ke Troli` : 'PA tidak tersedia';
      ui.cartButton.disabled = !row.paNo;
      if (row._layer) {
        try { map.fitBounds(row._layer.getBounds(), { padding: [35, 35], maxZoom: 18 }); } catch (_) {}
      }
    }

    function renderRows(newRows, coordinate) {
      layerGroup.clearLayers();
      rows = Array.isArray(newRows) ? newRows : [];
      clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} targetMarker = null; }
      if (coordinate) {
        targetMarker = L.marker([coordinate.lat, coordinate.lng]).addTo(map).bindTooltip('WGS84 dicari', { direction: 'top', className: 'az-pabm-map-target-label' });
      }
      if (!rows.length) {
        ui.results.innerHTML = '<div class="az-pabm-map-empty">Tiada lot / PA ditemui pada carian ini. Cuba klik sedikit ke dalam sempadan lot atau semak negeri yang dipilih.</div>';
        if (coordinate) map.setView([coordinate.lat, coordinate.lng], 17);
        return;
      }
      ui.results.innerHTML = rows.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-index="${index}">
          <strong>${escapeHtml(row.paNo || 'PA tidak tersedia')} • Lot ${escapeHtml(row.lotNo || '-')}</strong>
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
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
      else if (coordinate) map.setView([coordinate.lat, coordinate.lng], 17);
      selectRow(0);
    }

    async function runSearch(searchValue, explicitCoordinate) {
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
      ui.searchButton.disabled = true;
      setModalStatus(ui, coordinate ? 'Mencari lot pada koordinat WGS84...' : `Mencari Lot ${lot}...`, '');
      try {
        const params = new URLSearchParams({ negeri: stateCode });
        if (coordinate) {
          params.set('lat', String(coordinate.lat));
          params.set('lng', String(coordinate.lng));
        } else {
          params.set('lot', lot);
        }
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-pa-map-search?${params.toString()}`, activeController.signal);
        renderRows(data.results, coordinate);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        setModalStatus(ui, count ? `${count} pilihan lot ditemui. Klik lot atau pilih daripada senarai.` : 'Tiada lot / PA ditemui untuk carian ini.', count ? 'success' : 'error');
        setInlineStatus(externalStatus, count ? `${count} pilihan PA/lot ditemui pada peta.` : 'Tiada PA/lot ditemui.', count ? 'success' : 'error');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        renderRows([], coordinate);
        setModalStatus(ui, error.message || 'Carian PA pada peta gagal.', 'error');
        setInlineStatus(externalStatus, error.message || 'Carian PA pada peta gagal.', 'error');
      } finally {
        ui.searchButton.disabled = false;
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
    map.on('click', (event) => {
      if (!event || !event.latlng) return;
      const coordinate = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      ui.input.value = `${coordinate.lat}, ${coordinate.lng}`;
      runSearch(ui.input.value, coordinate);
    });
    runSearch(value);
  }

  async function openBenchmarkMap(initialValue) {
    const stateEl = document.getElementById('benchmarkState');
    const productEl = document.getElementById('benchmarkProduct');
    const externalStatus = document.getElementById('benchmarkMapStatus');
    const state = String(stateEl && stateEl.value || '').trim().toUpperCase();
    const product = String(productEl && productEl.value || 'BM').trim().toUpperCase() === 'SBM' ? 'SBM' : 'BM';
    const coordinate = parseCoordinates(initialValue);
    if (!state) {
      setInlineStatus(externalStatus, 'Pilih negeri terlebih dahulu.', 'error');
      stateEl && stateEl.focus();
      return;
    }
    if (!coordinate) {
      setInlineStatus(externalStatus, 'Masukkan WGS84 yang sah. Contoh: 3.1390, 101.6869', 'error');
      document.getElementById('benchmarkMapWgs84Input')?.focus();
      return;
    }

    setInlineStatus(externalStatus, `Membuka Peta Pilihan ${product}...`, '');
    const L = await loadLeaflet();
    addStyles();
    const ui = createModal(
      `Peta Pilihan ${product}`,
      `${state} • Cari ${product} terdekat menggunakan WGS84`,
      'Contoh: 3.1390, 101.6869',
      `Klik lokasi lain pada peta untuk mencari ${product} terdekat di negeri yang dipilih.`
    );
    ui.input.value = `${coordinate.lat}, ${coordinate.lng}`;
    const map = L.map(ui.canvas, { zoomControl: true }).setView([coordinate.lat, coordinate.lng], 11);
    ui.modal._azobssMap = map;
    addBaseMap(L, map);
    window.setTimeout(() => map.invalidateSize(), 60);

    const stationGroup = L.featureGroup().addTo(map);
    let targetMarker = null;
    let rows = [];
    let selectedRow = null;

    function clearSelection() {
      selectedRow = null;
      ui.detail.hidden = true;
      ui.detailGrid.innerHTML = '';
      setFootStatus(ui, '', '');
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.remove('is-selected'));
    }

    function selectRow(index, pan) {
      const row = rows[index];
      if (!row) return;
      selectedRow = row;
      ui.results.querySelectorAll('.az-pabm-map-result').forEach((node) => node.classList.toggle('is-selected', Number(node.dataset.index) === index));
      ui.detail.hidden = false;
      ui.detailGrid.innerHTML = `
        <b>Produk</b><span>${escapeHtml(product)}</span>
        <b>No. Stesen</b><span>${escapeHtml(row.stationNo || '-')}</span>
        <b>Jarak</b><span>${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km</span>
        <b>Negeri</b><span>${escapeHtml(row.negeri || state)}</span>
        <b>Daerah</b><span>${escapeHtml(row.daerah || '-')}</span>
        <b>Bandar</b><span>${escapeHtml(row.bandar || '-')}</span>
        <b>Huraian</b><span>${escapeHtml(row.huraian || '-')}</span>
        <b>WGS84</b><span>${escapeHtml(`${row.latitude}, ${row.longitude}`)}</span>`;
      ui.cartButton.textContent = `Tambah ${product} ${row.stationNo || row.productId || ''} ke Troli`;
      ui.cartButton.disabled = !(row.stationNo || row.productId);
      if (pan && Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude))) {
        map.setView([Number(row.latitude), Number(row.longitude)], Math.max(map.getZoom(), 14));
      }
    }

    function renderRows(newRows, target) {
      stationGroup.clearLayers();
      rows = Array.isArray(newRows) ? newRows : [];
      clearSelection();
      if (targetMarker) { try { map.removeLayer(targetMarker); } catch (_) {} }
      targetMarker = L.marker([target.lat, target.lng]).addTo(map).bindTooltip('WGS84 dicari', { permanent: false, direction: 'top', className: 'az-pabm-map-target-label' });
      if (!rows.length) {
        ui.results.innerHTML = `<div class="az-pabm-map-empty">Tiada ${escapeHtml(product)} ditemui berdekatan koordinat ini dalam ${escapeHtml(state)}.</div>`;
        map.setView([target.lat, target.lng], 12);
        return;
      }
      ui.results.innerHTML = rows.map((row, index) => `
        <button class="az-pabm-map-result" type="button" data-index="${index}">
          <strong>${escapeHtml(product)} ${escapeHtml(row.stationNo || row.productId || '-')}</strong>
          <span class="az-pabm-map-distance">${escapeHtml(Number(row.distanceKm || 0).toFixed(3))} km dari WGS84</span>
          <span>${escapeHtml([row.daerah, row.bandar].filter(Boolean).join(' • ') || row.negeri || state)}</span>
        </button>`).join('');
      rows.slice(0, 30).forEach((row, index) => {
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const marker = L.circleMarker([lat, lng], { radius: 7, weight: 2, fillOpacity: 0.8, bubblingMouseEvents: false }).addTo(stationGroup);
        marker.bindTooltip(`${product} ${row.stationNo || row.productId || ''} • ${Number(row.distanceKm || 0).toFixed(3)} km`);
        marker.on('click', () => selectRow(index, false));
      });
      const bounds = stationGroup.getBounds();
      if (bounds.isValid()) {
        const combined = L.latLngBounds(bounds);
        combined.extend([target.lat, target.lng]);
        map.fitBounds(combined, { padding: [35, 35], maxZoom: 13 });
      } else map.setView([target.lat, target.lng], 12);
      selectRow(0, false);
    }

    async function runSearch(searchValue, explicitCoordinate) {
      const target = explicitCoordinate || parseCoordinates(searchValue);
      if (!target) {
        setModalStatus(ui, 'Masukkan koordinat WGS84 yang sah.', 'error');
        return;
      }
      if (activeController) { try { activeController.abort(); } catch (_) {} }
      activeController = new AbortController();
      ui.searchButton.disabled = true;
      setModalStatus(ui, `Mencari ${product} terdekat...`, '');
      try {
        const params = new URLSearchParams({
          product,
          negeri: state,
          lat: String(target.lat),
          lng: String(target.lng)
        });
        const data = await fetchJson(`${BACKEND_BASE}/api/pabm-benchmark-nearby?${params.toString()}`, activeController.signal);
        renderRows(data.results, target);
        const count = Array.isArray(data.results) ? data.results.length : 0;
        const warning = data.warning ? ' Data live JUPEM tidak tersedia; senarai fallback digunakan.' : '';
        setModalStatus(ui, count ? `${count} ${product} terdekat ditemui.${warning}` : `Tiada ${product} ditemui berdekatan lokasi ini.`, count ? 'success' : 'error');
        setInlineStatus(externalStatus, count ? `${count} ${product} terdekat ditemui pada peta.` : `Tiada ${product} ditemui.`, count ? 'success' : 'error');
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        renderRows([], target);
        setModalStatus(ui, error.message || `Carian ${product} gagal.`, 'error');
        setInlineStatus(externalStatus, error.message || `Carian ${product} gagal.`, 'error');
      } finally {
        ui.searchButton.disabled = false;
      }
    }

    ui.form.addEventListener('submit', (event) => {
      event.preventDefault();
      runSearch(ui.input.value);
    });
    ui.results.addEventListener('click', (event) => {
      const button = event.target.closest('[data-index]');
      if (button) selectRow(Number(button.dataset.index), true);
    });
    ui.cartButton.addEventListener('click', async () => {
      if (!selectedRow) return;
      try {
        await addToCart(benchmarkCartPayload(selectedRow, product, state), ui, externalStatus);
      } catch (error) {
        setFootStatus(ui, error.message || `${product} tidak dapat ditambah ke troli.`, 'error');
      }
    });
    map.on('click', (event) => {
      if (!event || !event.latlng) return;
      const target = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
      ui.input.value = `${target.lat}, ${target.lng}`;
      runSearch(ui.input.value, target);
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

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeModal) closeActiveModal();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
