(function(){
  const CART_KEY = 'azobss_benchmark_cart_v1';
  const form = document.getElementById('benchmarkForm');
  const productEl = document.getElementById('benchmarkProduct');
  const stateEl = document.getElementById('benchmarkState');
  const searchEl = document.getElementById('benchmarkSearch');
  const searchBtn = document.getElementById('benchmarkSearchButton');
  const statusEl = document.getElementById('benchmarkStatus');
  const errorEl = document.getElementById('benchmarkError');
  const resultsWrap = document.getElementById('benchmarkResultWrap');
  const resultsBody = document.getElementById('benchmarkResultsBody');
  const cartList = document.getElementById('benchmarkCartList');
  const clearCartBtn = document.getElementById('benchmarkClearCartButton');
  const openEbizBtn = document.getElementById('benchmarkOpenEbizButton');

  if (!form) return;


  const BM_SBM_BACKEND_BASE = 'https://azobss-backend.onrender.com/api/download-stesen-tanda-aras';

  function buildBenchmarkDownloadUrl(productId, jenis){
    productId = String(productId || '').trim();
    jenis = String(jenis || '1').trim() === '2' ? '2' : '1';
    if (!productId) return '';
    return `${BM_SBM_BACKEND_BASE}?productId=${encodeURIComponent(productId)}&jenis=${encodeURIComponent(jenis)}`;
  }

  function esc(value){
    return String(value || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];
    });
  }

  function benchmarkSafeFilename(value){
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function benchmarkDownloadFilename(item){
    const productType = item.product || (String(item.jenis || '1') === '2' ? 'SBM' : 'BM');
    const code = item.stationNo || item.stesen || item.itemCode || item.productId || item.id || 'download';
    const baseName = benchmarkSafeFilename(`${productType}-${code}`) || 'BM-SBM-download';
    return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
  }

  async function triggerBenchmarkDownload(anchor){
    const url = anchor.getAttribute('href');
    const filename = anchor.dataset.benchmarkFilename || 'BM-SBM-download.pdf';
    if (!url) return;

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = `Downloading ${filename}...`;
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(objectUrl); }, 1000);
      if (statusEl) statusEl.textContent = `Downloaded as ${filename}`;
    } catch (error) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (statusEl) statusEl.textContent = `Download opened. If browser still shows ID name, backend must allow file rename/CORS.`;
    }
  }

  function benchmarkRecordPayload(item){
    return encodeURIComponent(JSON.stringify({
      productType: item.product || (String(item.jenis || '1') === '2' ? 'SBM' : 'BM'),
      itemCode: item.stationNo || item.stesen || item.productId || item.id || '',
      stationNo: item.stationNo || item.stesen || '',
      negeri: item.negeri || '',
      daerah: item.daerah || '',
      bandar: item.bandar || '',
      amount: 3,
      url: item.downloadUrl || ''
    }));
  }

  function readCart(){
    try{
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }catch(error){
      return [];
    }
  }

  function saveCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function getOpenEbizUrl(){
    const params = new URLSearchParams();
    if (productEl.value) params.set('produk', productEl.value);
    if (stateEl.value) params.set('negeri', stateEl.value);
    if (searchEl.value.trim()) params.set('carian', searchEl.value.trim());
    const query = params.toString();
    return 'https://ebiz.jupem.gov.my/Produk/StesenTandaAras' + (query ? '?' + query : '');
  }

  function updateOpenEbizLink(){
    if (openEbizBtn) openEbizBtn.href = getOpenEbizUrl();
  }

  function renderCart(){
    const items = readCart();
    if (!cartList) return;
    if (!items.length) {
      cartList.innerHTML = '';
      return;
    }
    cartList.innerHTML = items.map(function(item, index){
      return `
        <div class="benchmark-cart-item">
          <div><strong>${esc(item.stationNo || '-')}</strong><br>${esc(item.product || '')}</div>
          <div>${esc(item.negeri || '-')}<br>${esc(item.daerah || '')}</div>
          <div>${esc(item.harga || 'RM3')}</div>
          <div>${item.downloadUrl ? `<a class="small-action-btn blue bm-record-download" data-benchmark-record="${benchmarkRecordPayload(item)}" data-benchmark-filename="${esc(benchmarkDownloadFilename(item))}" download="${esc(benchmarkDownloadFilename(item))}" style="text-decoration:none;" href="${esc(item.downloadUrl)}">Download</a>` : ''}</div>
          <button class="small-action-btn" type="button" data-remove-benchmark-cart="${index}">Remove</button>
        </div>`;
    }).join('');
  }

  function addCart(item){
    const items = readCart();
    const key = [item.product, item.id || item.stationNo, item.negeri, item.daerah].join('|').toLowerCase();
    const exists = items.some(function(existing){
      return [existing.product, existing.id || existing.stationNo, existing.negeri, existing.daerah].join('|').toLowerCase() === key;
    });
    if (!exists) {
      items.push({ ...item, addedAtMs: Date.now() });
      saveCart(items);
    }
    renderCart();
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = exists ? 'Item already in benchmark cart.' : 'Benchmark item added to cart.';
    }
  }

  function renderResults(rows){
    if (!resultsBody || !resultsWrap) return;
    if (!rows.length) {
      resultsWrap.hidden = true;
      return;
    }
    resultsWrap.hidden = false;
    resultsBody.innerHTML = rows.map(function(row, index){
      const locationLink = row.locationUrl ? `<a class="btn blue" style="margin:0;padding:7px 9px;font-size:12px;" href="${esc(row.locationUrl)}" target="_blank" rel="noopener">Lokasi</a>` : '';
      const bmId = row.productId || row.id || '';
      const bmJenis = row.jenis || (row.product === 'SBM' ? '2' : '1');
      const bmDownloadUrl = bmId ? buildBenchmarkDownloadUrl(bmId, bmJenis) : ''; // always use backend link
      const downloadButton = bmDownloadUrl
        ? `<a class="small-action-btn blue bm-download-btn bm-record-download" data-benchmark-record="${benchmarkRecordPayload({ ...row, downloadUrl: bmDownloadUrl })}" data-benchmark-filename="${esc(benchmarkDownloadFilename(row))}" download="${esc(benchmarkDownloadFilename(row))}" style="text-decoration:none;display:inline-block;padding:6px 10px;font-size:12px;white-space:nowrap;" href="${esc(bmDownloadUrl)}">Download</a>`
        : '<span style="color:#94a3b8;">-</span>';
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${downloadButton}</td>
          <td><strong>${esc(row.stationNo || row.stesen || '-')}</strong></td>
          <td>${esc(row.negeri || '-')}</td>
          <td>${esc(row.daerah || '-')}</td>
          <td>${esc(row.bandar || '-')}</td>
          <td>${esc(row.huraian || '-')}${locationLink ? '<br>' + locationLink : ''}</td>
          <td>${esc(row.harga || '-')}</td>
        </tr>`;
    }).join('');
  }

  let benchmarkDbCache = null;

  function normalizeBenchmarkText(value){
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
  }

  function normalizeBenchmarkQuery(value){
    const text = normalizeBenchmarkText(value);
    if (!text) return '';
    if (/^\d{3,6}$/.test(text)) return 'H' + text;
    if (/^H\d{3,6}$/.test(text)) return text;
    return text;
  }

  function wantedJenis(){
    return productEl && productEl.value === 'SBM' ? '2' : '1';
  }

  async function loadBenchmarkDb(){
    if (benchmarkDbCache) return benchmarkDbCache;
    const response = await fetch('data/stesen-tanda-aras-records.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Database BM/SBM tidak dijumpai. Pastikan data/stesen-tanda-aras-records.json ada dalam GitHub.');
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Format database BM/SBM tidak sah.');
    }
    benchmarkDbCache = data;
    return benchmarkDbCache;
  }

  function toBenchmarkRow(item){
    const productId = item.productId || item.id || '';
    const jenis = String(item.jenis || wantedJenis());
    return {
      id: productId,
      productId,
      jenis,
      product: jenis === '2' ? 'SBM' : 'BM',
      stationNo: item.stesen || item.stationNo || '',
      stesen: item.stesen || item.stationNo || '',
      negeri: item.negeri || '',
      daerah: item.daerah || '',
      bandar: item.bandar || '',
      huraian: item.huraian || '',
      harga: item.harga || 'RM3',
      locationUrl: item.locationUrl || '',
      downloadUrl: productId ? buildBenchmarkDownloadUrl(productId, jenis) : ''
    };
  }

  function searchBenchmarkDb(data){
    const qRaw = searchEl.value.trim();
    const qNorm = normalizeBenchmarkQuery(qRaw);
    const qPlain = normalizeBenchmarkText(qRaw);
    const stateNorm = normalizeBenchmarkText(stateEl.value);
    const jenis = wantedJenis();

    const directIdMatch = qRaw.match(/(?:ProductID\s*=|MuatTurunStesenTandaAras\/)(\d{1,12})/i) || qRaw.match(/^([1-9]\d{2,11})$/);
    if (directIdMatch) {
      const id = directIdMatch[1];
      return [{
        id,
        productId: id,
        jenis,
        product: jenis === '2' ? 'SBM' : 'BM',
        stationNo: qRaw,
        negeri: stateEl.value,
        daerah: '',
        bandar: '',
        huraian: 'Direct ProductID',
        harga: '5',
        downloadUrl: buildBenchmarkDownloadUrl(id, jenis)
      }];
    }

    return data.filter(function(item){
      const itemStation = normalizeBenchmarkText(item.stesen || item.stationNo);
      const itemState = normalizeBenchmarkText(item.negeri);
      const itemJenis = String(item.jenis || '1');
      const itemText = [item.stesen, item.negeri, item.daerah, item.bandar, item.huraian, item.productId]
        .map(normalizeBenchmarkText)
        .join(' ');

      const matchProduct = itemJenis === jenis;
      const matchState = !stateNorm || itemState === stateNorm;
      const matchQuery = !qPlain || itemStation === qNorm || itemStation.includes(qNorm) || itemText.includes(qPlain) || itemText.includes(qNorm);

      return matchProduct && matchState && matchQuery;
    }).slice(0, 50).map(toBenchmarkRow);
  }

  form.addEventListener('submit', async function(event){
    event.preventDefault();
    updateOpenEbizLink();
    if (errorEl) errorEl.textContent = '';
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = 'Searching BM/SBM database...';
    }
    if (searchBtn) searchBtn.disabled = true;
    try {
      const db = await loadBenchmarkDb();
      const rows = searchBenchmarkDb(db);
      renderResults(rows);
      if (statusEl) {
        statusEl.textContent = rows.length
          ? `${rows.length} BM/SBM record found`
          : 'No BM/SBM record found in local database.';
      }
    } catch (error) {
      renderResults([]);
      if (errorEl) errorEl.textContent = error.message || 'BM/SBM search failed.';
      if (statusEl) statusEl.textContent = 'Search gagal. Pastikan data/stesen-tanda-aras-records.json ada dalam GitHub.';
    } finally {
      if (searchBtn) searchBtn.disabled = false;
    }
  });

  document.addEventListener('click', function(event){
    const benchmarkDownload = event.target.closest('[data-benchmark-record]');
    if (benchmarkDownload) {
      event.preventDefault();
      if (typeof window.azobssRecordPurchase === 'function') {
        try {
          const payload = JSON.parse(decodeURIComponent(benchmarkDownload.dataset.benchmarkRecord || '{}'));
          window.azobssRecordPurchase(payload).catch(function(error){
            if (statusEl) {
              statusEl.style.display = 'block';
              statusEl.textContent = error.message || 'Failed to save BM/SBM purchase record.';
            }
          });
        } catch (error) {}
      }
      triggerBenchmarkDownload(benchmarkDownload);
      return;
    }
    const addButton = event.target.closest('[data-add-benchmark]');
    if (addButton) {
      try {
        addCart(JSON.parse(decodeURIComponent(addButton.dataset.addBenchmark || '{}')));
      } catch(error) {}
      return;
    }
    const removeButton = event.target.closest('[data-remove-benchmark-cart]');
    if (removeButton) {
      const index = Number(removeButton.dataset.removeBenchmarkCart);
      const items = readCart();
      if (Number.isFinite(index)) {
        items.splice(index, 1);
        saveCart(items);
        renderCart();
      }
    }
  });

  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', function(){
      saveCart([]);
      renderCart();
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = '';
      }
    });
  }

  ['change','input'].forEach(function(evt){
    productEl.addEventListener(evt, updateOpenEbizLink);
    stateEl.addEventListener(evt, updateOpenEbizLink);
    searchEl.addEventListener(evt, updateOpenEbizLink);
  });

  updateOpenEbizLink();
  renderCart();
})();
