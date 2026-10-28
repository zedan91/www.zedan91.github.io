
  import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
  import { getFirestore, collection, addDoc, getDocs, serverTimestamp, query, orderBy, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

  const firebaseConfig = {
    apiKey: 'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain: 'azobss.firebaseapp.com',
    projectId: 'azobss',
    storageBucket: 'azobss.firebasestorage.app',
    messagingSenderId: '159277716405',
    appId: '1:159277716405:web:17d8924b6b6380e2b77ffc'
  };

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const SOFTWARE_COLLECTION = 'softwareTools';
  const LOCAL_KEY = 'azobss_admin_software_tools_v1';

  const grid = document.getElementById('softwareDownloadsGrid');
  const addButton = document.getElementById('softwareAdminAddButton');
  const modal = document.getElementById('softwareAdminModal');
  const form = document.getElementById('softwareAdminForm');
  const typeSelect = document.getElementById('softwareAdminType');
  const priceInput = document.getElementById('softwareAdminPrice');
  const buttonInput = document.getElementById('softwareAdminButtonText');
  const iconInput = document.getElementById('softwareAdminIcon');
  const downloadLinkInput = document.getElementById('softwareAdminDownloadLink');
  const paymentLinkInput = document.getElementById('softwareAdminPaymentLink');
  const secureDownloadInput = document.getElementById('softwareAdminSecureDownloadLink');
  const downloadLinkLabel = document.getElementById('softwareDownloadLinkLabel');
  const paymentLinkLabel = document.getElementById('softwarePaymentLinkLabel');
  const imageUrlInput = document.getElementById('softwareAdminImageUrl');
  const gifUrlInput = document.getElementById('softwareAdminGifUrl');
  const imageFileInput = document.getElementById('softwareAdminImageFile');
  const gifFileInput = document.getElementById('softwareAdminGifFile');
  const mediaPreview = document.getElementById('softwareAdminMediaPreview');
  const productIdInput = document.getElementById('softwareAdminProductId');
  const statusInput = document.getElementById('softwareAdminStatus');
  const versionInput = document.getElementById('softwareAdminVersion');
  const fileSizeInput = document.getElementById('softwareAdminFileSize');
  const downloadLimitInput = document.getElementById('softwareAdminDownloadLimit');
  const expiryInput = document.getElementById('softwareAdminExpiryHours');
  const badgeInput = document.getElementById('softwareAdminBadge');
  const categoryInput = document.getElementById('softwareAdminCategory');
  const platformBox = document.getElementById('softwareAdminPlatforms');
  const searchInput = document.getElementById('softwareSearchInput');
  const sortSelect = document.getElementById('softwareSortSelect');
  const categoryFilter = document.getElementById('softwareCategoryFilter');
  let selectedSoftwareCategory = 'all';
  let softwareDynamicItems = [];
  let editingSoftwareDocId = null;
  let editingSoftwareProductId = null;

  function clean(v){ return String(v || '').trim().toLowerCase(); }
  function esc(value){ return String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  const MAX_MEDIA_BYTES = 900 * 1024;
  function readMediaFile(input){
    return new Promise(resolve => {
      const file = input?.files?.[0];
      if(!file) return resolve('');
      if(file.size > MAX_MEDIA_BYTES){ alert('Image/GIF terlalu besar. Guna URL untuk media besar. Limit upload kecil: 900KB.'); return resolve(''); }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
  function updateMediaPreview(){
    if(!mediaPreview) return;
    const hasMedia = !!(imageUrlInput?.value || gifUrlInput?.value || imageFileInput?.files?.length || gifFileInput?.files?.length);
    mediaPreview.style.display = hasMedia ? 'flex' : 'none';
  }
  function getCurrentUserObject(){ try { return JSON.parse(sessionStorage.getItem('azobssCurrentUser') || 'null'); } catch(e){ return null; } }
  function isAdmin(){
    const currentUser = getCurrentUserObject();
    return sessionStorage.getItem('azobssLoggedIn') === '1' && (
      clean(currentUser?.usernameKey) === 'zedan91' || clean(currentUser?.email) === 'zedan91@azobss.local'
    );
  }

  function makeProductId(prefix){
    const n = Date.now().toString().slice(-6);
    return `${prefix}-${n}`;
  }
  function selectedPlatforms(){
    return Array.from(platformBox?.querySelectorAll('input:checked') || []).map(x => x.value);
  }
  function setSelectedPlatforms(values){
    const set = new Set(Array.isArray(values) && values.length ? values : ['Windows']);
    platformBox?.querySelectorAll('input').forEach(x => { x.checked = set.has(x.value); });
  }
  function normalizeItem(item){
    const type = item.type === 'premium' ? 'premium' : 'free';
    const price = String(item.price || (type === 'free' ? 'FREE' : '')).trim();
    return {
      id: item.id || ('software-' + Date.now() + '-' + Math.random().toString(36).slice(2,8)),
      docId: item.__docId || item.docId || '',
      name: item.name || item.title || 'Untitled Software',
      desc: item.desc || item.description || '',
      type,
      price: type === 'free' ? 'FREE' : (price || 'RM0'),
      category: item.category || item.softwareCategory || 'Tools',
      productId: item.productId || item.sku || item.id || makeProductId('AZSW'),
      status: item.status || 'active',
      version: item.version || '',
      fileSize: item.fileSize || '',
      platforms: Array.isArray(item.platforms) ? item.platforms : (item.platform ? [item.platform] : ['Windows']),
      badge: item.badge || '',
      downloadLimit: Number(item.downloadLimit || item.maxDownload || 3),
      expiryHours: Number(item.expiryHours ?? 24),
      icon: item.icon || (type === 'free' ? 'FREE' : '🛒'),
      downloadLink: item.downloadLink || item.link || item.url || '',
      paymentLink: item.paymentLink || '',
      secureDownloadLink: item.secureDownloadLink || item.privateDownloadLink || '',
      link: item.link || (type === 'premium' ? item.paymentLink : item.downloadLink) || item.url || '#',
      imageUrl: item.imageUrl || item.image || '',
      gifUrl: item.gifUrl || item.gif || '',
      buttonText: item.buttonText || (type === 'free' ? 'Download Now' : 'Buy Now'),
      createdAtMs: item.createdAtMs || (item.createdAt?.toMillis ? item.createdAt.toMillis() : (item.createdAt?.seconds ? item.createdAt.seconds * 1000 : (Number(item.createdAt) || 0)))
    };
  }
  function renderItem(item){
    const isPremium = item.type === 'premium';
    const badgeText = isPremium ? ('🛒 ' + item.price) : 'Free Software';
    const mediaSrc = item.imageUrl || item.gifUrl;
    const mediaHtml = mediaSrc ? `<div class="software-card-media"><img src="${esc(mediaSrc)}" alt="${esc(item.name)} preview" loading="lazy"></div>` : '';
    const gifHtml = item.gifUrl && item.imageUrl ? `<div class="software-media-links"><a class="software-media-demo" href="${esc(item.gifUrl)}" target="_blank" rel="noopener">GIF Demo</a></div>` : '';
    const meta = [item.category, item.productId, item.version, item.fileSize, ...(item.platforms || [])].filter(Boolean);
    const metaHtml = meta.length ? `<div class="software-meta">${meta.map(v=>`<span>${esc(v)}</span>`).join('')}</div>` : '';
    const badgeExtra = item.badge ? `<div class="software-badge extra">${esc(item.badge)}</div>` : '';
    const adminEdit = isAdmin() ? `<div class="software-card-admin-actions"><button class="software-card-edit-btn" type="button" data-software-edit="${esc(item.productId || item.id)}">Edit Details</button></div>` : '';
    return `<div class="download-card software-status-${esc(item.status || 'active')}" data-admin-software="1" data-doc-id="${esc(item.docId || '')}" data-product-id="${esc(item.productId || item.id)}" data-status="${esc(item.status || 'active')}" data-type="${esc(item.type)}" data-created="${esc(item.createdAtMs || Date.now())}" data-name="${esc(item.name.toLowerCase())}" data-search="${esc((item.name + ' ' + item.desc + ' ' + item.type + ' ' + item.price + ' ' + item.category + ' ' + item.productId + ' ' + item.version + ' ' + item.fileSize + ' ' + (item.platforms||[]).join(' ') + ' ' + item.badge).toLowerCase())}" data-category="${esc(item.category || 'Tools')}">
      ${mediaHtml}
      <div class="download-icon">${esc(item.icon)}</div>
      <div class="software-badge ${isPremium ? 'premium' : 'free'}">${esc(badgeText)}</div>
      ${badgeExtra}
      <h3>${esc(item.name)}</h3>
      ${metaHtml}
      <p>${esc(item.desc)}</p>
      ${gifHtml}
      <a class="download-btn ${isPremium ? 'premium' : ''}" data-azobss-premium-buy="${isPremium ? '1' : '0'}" data-product-id="${esc(item.productId || item.id)}" data-product-name="${esc(item.name)}" data-product-price="${esc(item.price)}" data-payment-link="${esc(item.paymentLink)}" data-download-link="${esc(item.secureDownloadLink || item.downloadLink)}" data-download-limit="${esc(item.downloadLimit || 3)}" data-expiry-hours="${esc(item.expiryHours ?? 24)}" href="${esc(isPremium ? '#' : item.link)}" rel="noopener" target="_blank">${esc(item.buttonText)}</a>
      ${adminEdit}
    </div>`;
  }
  function loadLocal(){ try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]').map(normalizeItem); } catch(e){ return []; } }
  async function loadFirestore(){
    try{
      const snap = await getDocs(query(collection(db, SOFTWARE_COLLECTION), orderBy('createdAt','desc')));
      return snap.docs.map(d => normalizeItem({__docId:d.id, ...d.data()}));
    }catch(err){
      console.warn('Software items Firestore load skipped:', err);
      return [];
    }
  }
  function getStaticCards(){
    return Array.from(grid?.querySelectorAll('[data-software-static="1"]') || []);
  }
  function applySoftwareFilters(){
    if(!grid) return;
    grid.querySelectorAll('[data-admin-software="1"], .software-empty-state').forEach(el => el.remove());
    const keyword = clean(searchInput?.value || '');
    const sortMode = sortSelect?.value || 'newest';

    const staticCards = getStaticCards();
    staticCards.forEach(card => { card.style.display = ''; });

    let dynamic = [...softwareDynamicItems].filter(item => isAdmin() || (item.status || 'active') === 'active');
    if(selectedSoftwareCategory !== 'all'){
      dynamic = dynamic.filter(item => clean(item.category || 'Tools') === clean(selectedSoftwareCategory));
      staticCards.forEach(card => {
        card.style.display = clean(card.dataset.category || 'Tools') === clean(selectedSoftwareCategory) ? '' : 'none';
      });
    }
    if(keyword){
      dynamic = dynamic.filter(item => clean(`${item.name} ${item.desc} ${item.type} ${item.price} ${item.imageUrl || ''} ${item.gifUrl || ''}`).includes(keyword));
      staticCards.forEach(card => {
        const text = clean(card.dataset.search || card.textContent || '');
        const categoryOk = selectedSoftwareCategory === 'all' || clean(card.dataset.category || 'Tools') === clean(selectedSoftwareCategory);
        card.style.display = (categoryOk && text.includes(keyword)) ? '' : 'none';
      });
    }

    const typeRank = item => item.type === 'premium' ? 1 : 0;
    dynamic.sort((a,b) => {
      if(sortMode === 'freeFirst') return typeRank(a) - typeRank(b) || String(a.name).localeCompare(String(b.name));
      if(sortMode === 'premiumFirst') return typeRank(b) - typeRank(a) || String(a.name).localeCompare(String(b.name));
      if(sortMode === 'nameAZ') return String(a.name).localeCompare(String(b.name));
      if(sortMode === 'nameZA') return String(b.name).localeCompare(String(a.name));
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });

    if(dynamic.length){
      grid.insertAdjacentHTML('afterbegin', dynamic.map(renderItem).join(''));
    }

    // Sort static cards visually when sorting by name/type. Static free items stay after admin items for newest mode.
    if(sortMode !== 'newest'){
      const sortedStatic = staticCards.slice().sort((a,b) => {
        const an = a.dataset.name || '';
        const bn = b.dataset.name || '';
        if(sortMode === 'nameZA') return bn.localeCompare(an);
        return an.localeCompare(bn);
      });
      sortedStatic.forEach(card => grid.appendChild(card));
    }

    const hasVisibleStatic = staticCards.some(card => card.style.display !== 'none');
    if(!dynamic.length && !hasVisibleStatic){
      grid.insertAdjacentHTML('beforeend', '<div class="software-empty-state">No software item found.</div>');
    }
  }
  async function loadItems(){
    if(!grid) return;
    softwareDynamicItems = [...await loadFirestore(), ...loadLocal()];
    applySoftwareFilters();
  }
  function refreshAdminState(){ if(addButton) addButton.hidden = !isAdmin(); }
  function syncTypeDefaults(){
    const premium = typeSelect?.value === 'premium';
    if(priceInput && (!priceInput.value || /^(free|rm0)$/i.test(priceInput.value.trim()))) priceInput.value = premium ? 'RM10' : 'FREE';
    if(buttonInput && (!buttonInput.value || /^(download now|buy now|open)$/i.test(buttonInput.value.trim()))) buttonInput.value = premium ? 'Buy Now' : 'Download Now';
    if(iconInput && !iconInput.value.trim()) iconInput.value = premium ? 'AZ' : 'FREE';
    if(downloadLinkLabel) downloadLinkLabel.style.display = premium ? 'none' : '';
    if(paymentLinkLabel) paymentLinkLabel.style.display = premium ? '' : 'none';
    if(downloadLinkInput) downloadLinkInput.required = !premium;
    if(paymentLinkInput) paymentLinkInput.required = premium;
  }
  function openModal(editItem = null){
    form?.reset();
    const item = editItem ? normalizeItem(editItem) : null;
    editingSoftwareDocId = item?.docId || null;
    editingSoftwareProductId = item?.productId || item?.id || null;
    const title = document.getElementById('softwareAdminTitle');
    const saveBtn = form?.querySelector('.software-admin-save');
    if(title) title.textContent = item ? 'Edit Software Item' : 'Add Software Item';
    if(saveBtn) saveBtn.textContent = item ? 'Save Changes' : 'Save Item';
    if(typeSelect) typeSelect.value = item?.type || 'free';
    if(priceInput) priceInput.value = item?.price || 'FREE';
    if(buttonInput) buttonInput.value = item?.buttonText || 'Download Now';
    if(iconInput) iconInput.value = item?.icon || 'FREE';
    if(productIdInput) productIdInput.value = item?.productId || makeProductId('AZSW');
    if(statusInput) statusInput.value = item?.status || 'active';
    if(versionInput) versionInput.value = item?.version || 'v1.0.0';
    if(fileSizeInput) fileSizeInput.value = item?.fileSize || '';
    if(downloadLimitInput) downloadLimitInput.value = String(item?.downloadLimit || 3);
    if(expiryInput) expiryInput.value = String(item?.expiryHours ?? 24);
    if(badgeInput) badgeInput.value = item?.badge || '';
    if(categoryInput) categoryInput.value = item?.category || 'Tools';
    setSelectedPlatforms(item?.platforms || ['Windows']);
    document.getElementById('softwareAdminName').value = item?.name || '';
    document.getElementById('softwareAdminDesc').value = item?.desc || '';
    if(downloadLinkInput) downloadLinkInput.value = item?.downloadLink || '';
    if(paymentLinkInput) paymentLinkInput.value = item?.paymentLink || '';
    if(secureDownloadInput) secureDownloadInput.value = item?.secureDownloadLink || '';
    if(imageUrlInput) imageUrlInput.value = item?.imageUrl || '';
    if(gifUrlInput) gifUrlInput.value = item?.gifUrl || '';
    syncTypeDefaults();
    updateMediaPreview();
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden','false');
  }
  function closeModal(){ editingSoftwareDocId = null; editingSoftwareProductId = null; modal?.classList.remove('is-open'); modal?.setAttribute('aria-hidden','true'); }

  searchInput?.addEventListener('input', applySoftwareFilters);
  sortSelect?.addEventListener('change', applySoftwareFilters);
  categoryFilter?.addEventListener('click', e => {
    const btn = e.target.closest('[data-software-category]');
    if(!btn) return;
    selectedSoftwareCategory = btn.getAttribute('data-software-category') || 'all';
    categoryFilter.querySelectorAll('[data-software-category]').forEach(b => b.classList.toggle('is-active', b === btn));
    applySoftwareFilters();
  });

  grid?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-software-edit]');
    if(!editBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const key = editBtn.getAttribute('data-software-edit');
    const item = softwareDynamicItems.find(x => String(x.productId || x.id) === String(key));
    if(!item) return alert('Item data not found. Try refresh page first.');
    openModal(item);
  });

  addButton?.addEventListener('click', () => openModal());
  document.getElementById('softwareAdminClose')?.addEventListener('click', closeModal);
  document.getElementById('softwareAdminCancel')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if(e.target === modal) closeModal(); });
  typeSelect?.addEventListener('change', () => { if(typeSelect.value === 'premium'){ priceInput.value = 'RM10'; buttonInput.value = 'Buy Now'; iconInput.value = '🛒'; } else { priceInput.value = 'FREE'; buttonInput.value = 'Download Now'; iconInput.value = 'FREE'; } syncTypeDefaults(); });
  [imageUrlInput, gifUrlInput, imageFileInput, gifFileInput].forEach(el => el?.addEventListener('input', updateMediaPreview));
  [imageFileInput, gifFileInput].forEach(el => el?.addEventListener('change', updateMediaPreview));

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if(!isAdmin()) return alert('Admin only.');
    syncTypeDefaults();
    const uploadedImage = await readMediaFile(imageFileInput);
    const uploadedGif = await readMediaFile(gifFileInput);
    const item = normalizeItem({
      id: productIdInput?.value.trim() || makeProductId('AZSW'),
      productId: productIdInput?.value.trim() || makeProductId('AZSW'),
      status: statusInput?.value || 'active',
      version: versionInput?.value.trim(),
      fileSize: fileSizeInput?.value.trim(),
      platforms: selectedPlatforms(),
      category: categoryInput?.value || 'Tools',
      badge: badgeInput?.value || '',
      downloadLimit: Math.max(1, Math.min(20, Number(downloadLimitInput?.value || 3))),
      expiryHours: Number(expiryInput?.value ?? 24),
      name: document.getElementById('softwareAdminName').value.trim(),
      desc: document.getElementById('softwareAdminDesc').value.trim(),
      type: typeSelect.value,
      price: priceInput.value.trim(),
      icon: iconInput.value.trim(),
      imageUrl: uploadedImage || imageUrlInput?.value.trim(),
      gifUrl: uploadedGif || gifUrlInput?.value.trim(),
      buttonText: buttonInput.value.trim(),
      downloadLink: downloadLinkInput?.value.trim(),
      paymentLink: paymentLinkInput?.value.trim(),
      secureDownloadLink: secureDownloadInput?.value.trim(),
      link: (typeSelect.value === 'premium' ? paymentLinkInput?.value.trim() : downloadLinkInput?.value.trim())
    });
    try{
      if(editingSoftwareDocId){
        await updateDoc(doc(db, SOFTWARE_COLLECTION, editingSoftwareDocId), {...item, updatedAt: serverTimestamp(), updatedBy: 'zedan91'});
      }else{
        await addDoc(collection(db, SOFTWARE_COLLECTION), {...item, createdAt: serverTimestamp(), createdBy: 'zedan91'});
      }
    }catch(err){
      const saved = loadLocal();
      const key = editingSoftwareProductId || item.productId || item.id;
      const idx = saved.findIndex(x => String(x.productId || x.id) === String(key));
      if(idx >= 0) saved[idx] = {...saved[idx], ...item, productId:key, id:key};
      else saved.unshift(item);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(saved));
      alert(editingSoftwareProductId ? 'Firestore edit failed. Item updated in local fallback only.' : 'Firestore rules belum allow softwareTools. Item disimpan local sementara. Tambah rules softwareTools untuk sync semua device.');
    }
    closeModal();
    await loadItems();
  });

  setInterval(refreshAdminState, 1500);
  refreshAdminState();
  loadItems();
