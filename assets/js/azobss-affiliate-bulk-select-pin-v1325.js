/* AZOBSS v1325 - Affiliate Shop Admin Bulk Select + Pin
 * Scope: /affiliate-shop/ only
 *
 * Features
 * - Admin-only checkbox on every affiliate product card
 * - Tick All / Untick All
 * - Delete Selected
 * - Pin Selected / Unpin Selected
 * - Pinned products are raised to the top for all visitors when Firestore allows it
 * - Selection API exposed for future bulk actions:
 *     window.AZOBSSAffiliateSelection1325
 *
 * Existing Edit/Delete/Add/Import/Export logic remains untouched.
 */
(async function(){
  'use strict';

  if(!/^\/affiliate-shop\/?$/i.test(location.pathname)) return;
  if(window.__AZOBSS_AFFILIATE_BULK_SELECT_PIN_1325__) return;
  window.__AZOBSS_AFFILIATE_BULK_SELECT_PIN_1325__ = true;

  const VERSION = '1325';
  const PRODUCT_COLLECTION = 'affiliateProducts';
  const PIN_COLLECTION = 'affiliateShopPins';
  const LOCAL_PRODUCTS_KEY = 'azobss_admin_added_products_v1';
  const LOCAL_HIDDEN_KEY = 'azobss_admin_hidden_affiliate_products_v1';
  const LOCAL_PINS_KEY = 'azobss_affiliate_pinned_products_v1325';

  const firebaseConfig = {
    apiKey: 'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
    authDomain: 'azobss.firebaseapp.com',
    projectId: 'azobss',
    storageBucket: 'azobss.firebasestorage.app',
    messagingSenderId: '159277716405',
    appId: '1:159277716405:web:17d8924b6b6380e2b77ffc'
  };

  let firebase = null;
  try{
    const [appMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js')
    ]);
    const app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(firebaseConfig);
    firebase = {
      db: fsMod.getFirestore(app),
      collection: fsMod.collection,
      doc: fsMod.doc,
      getDocs: fsMod.getDocs,
      setDoc: fsMod.setDoc,
      updateDoc: fsMod.updateDoc,
      deleteDoc: fsMod.deleteDoc,
      serverTimestamp: fsMod.serverTimestamp
    };
  }catch(err){
    console.warn('AZOBSS v1325: Firebase module unavailable. Local fallback only.', err);
  }

  const selected = new Set();
  const pinned = new Map(); // id -> {priority,pinnedAtMs}
  let pinLoadDone = false;
  let mutationQueued = false;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[ch]);
  }

  function isAdmin(){
    return document.body?.classList.contains('az-aff-admin') === true;
  }

  function grid(){
    return document.getElementById('productGrid');
  }

  function cards(){
    const g = grid();
    return g ? Array.from(g.querySelectorAll(':scope > .card[data-product-id]')) : [];
  }

  function visibleCards(){
    return cards().filter(card => {
      const cs = getComputedStyle(card);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && card.getClientRects().length > 0;
    });
  }

  function cardInfo(card){
    return {
      card,
      id: String(card?.dataset?.productId || '').trim(),
      source: String(card?.dataset?.productSource || 'static').trim().toLowerCase(),
      title: String(card?.querySelector('h2')?.textContent || card?.dataset?.name || '').trim()
    };
  }

  function readArray(key){
    try{
      const data = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(data) ? data : [];
    }catch(_e){ return []; }
  }

  function writeArray(key, values){
    try{
      localStorage.setItem(key, JSON.stringify(Array.from(new Set((values || []).map(String)))));
      return true;
    }catch(_e){ return false; }
  }

  function readLocalPins(){
    try{
      const raw = JSON.parse(localStorage.getItem(LOCAL_PINS_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    }catch(_e){ return {}; }
  }

  function saveLocalPins(){
    try{
      const out = {};
      pinned.forEach((meta,id) => {
        out[id] = {
          priority: Number(meta?.priority || 0),
          pinnedAtMs: Number(meta?.pinnedAtMs || 0)
        };
      });
      localStorage.setItem(LOCAL_PINS_KEY, JSON.stringify(out));
    }catch(_e){}
  }

  function pinDocId(id){
    // Stable Firestore-safe id derived from UTF-8 bytes.
    try{
      const bytes = new TextEncoder().encode(String(id || ''));
      let hex = '';
      bytes.forEach(b => { hex += b.toString(16).padStart(2,'0'); });
      return ('product_' + hex).slice(0, 1450);
    }catch(_e){
      return 'product_' + String(id || '').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,1200);
    }
  }

  function toast(message, type='ok'){
    let el = document.getElementById('azAffiliateBulkToast1325');
    if(!el){
      el = document.createElement('div');
      el.id = 'azAffiliateBulkToast1325';
      el.className = 'az-aff-bulk-toast-1325';
      document.body.appendChild(el);
    }
    el.dataset.type = type;
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(window.__azAffiliateBulkToastTimer1325);
    window.__azAffiliateBulkToastTimer1325 = setTimeout(() => el.classList.remove('is-show'), 2800);
  }

  function installStyle(){
    if(document.getElementById('az-aff-bulk-style-1325')) return;
    const style = document.createElement('style');
    style.id = 'az-aff-bulk-style-1325';
    style.textContent = `
      .az-aff-bulk-toolbar-1325{
        display:none;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
        margin:10px 0 14px;
        padding:10px 12px;
        border:1px solid rgba(34,197,94,.34);
        border-radius:15px;
        background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(8,17,31,.96));
        box-shadow:0 12px 28px rgba(0,0,0,.18);
      }
      body.az-aff-admin .az-aff-bulk-toolbar-1325{display:flex}
      .az-aff-bulk-btn-1325{
        min-height:36px;
        border:1px solid rgba(148,163,184,.32);
        border-radius:999px;
        background:#0b1424;
        color:#e5e7eb;
        padding:0 12px;
        font:900 11.5px/1 Arial,Helvetica,sans-serif;
        cursor:pointer;
        white-space:nowrap;
      }
      .az-aff-bulk-btn-1325:hover{border-color:#22c55e;color:#bbf7d0}
      .az-aff-bulk-btn-1325.pin{border-color:rgba(250,204,21,.46);color:#fde68a}
      .az-aff-bulk-btn-1325.delete{border-color:rgba(239,68,68,.48);color:#fecaca}
      .az-aff-bulk-btn-1325:disabled{opacity:.42;cursor:not-allowed;filter:none}
      .az-aff-selected-count-1325{
        margin-left:auto;
        min-width:112px;
        text-align:right;
        color:#93c5fd;
        font-size:11.5px;
        font-weight:900;
      }

      body.az-aff-admin #productGrid > .card[data-product-id]{position:relative}
      .az-aff-card-select-1325{
        display:none;
        position:absolute;
        top:13px;
        left:13px;
        z-index:25;
        width:31px;
        height:31px;
        border:1px solid rgba(148,163,184,.46);
        border-radius:10px;
        background:rgba(2,6,23,.86);
        align-items:center;
        justify-content:center;
        box-shadow:0 8px 20px rgba(0,0,0,.26);
      }
      body.az-aff-admin .az-aff-card-select-1325{display:flex}
      .az-aff-card-select-1325 input{
        width:18px;
        height:18px;
        margin:0;
        accent-color:#22c55e;
        cursor:pointer;
      }
      body.az-aff-admin #productGrid > .card.az-aff-selected-1325{
        outline:2px solid rgba(34,197,94,.92)!important;
        outline-offset:1px!important;
        box-shadow:0 0 0 4px rgba(34,197,94,.10),0 18px 42px rgba(0,0,0,.28)!important;
      }

      .az-aff-pin-btn-1325{
        display:none;
        position:absolute;
        top:13px;
        left:51px;
        z-index:25;
        width:31px;
        height:31px;
        border:1px solid rgba(250,204,21,.42);
        border-radius:999px;
        background:rgba(2,6,23,.86);
        color:#fde68a;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        font-size:14px;
        box-shadow:0 8px 20px rgba(0,0,0,.24);
      }
      body.az-aff-admin .az-aff-pin-btn-1325{display:inline-flex}
      .az-aff-pin-btn-1325.is-pinned{
        background:linear-gradient(145deg,#854d0e,#166534);
        border-color:#facc15;
        color:#fff;
        box-shadow:0 0 16px rgba(250,204,21,.24);
      }
      .az-aff-pinned-chip-1325{
        display:none;
        position:absolute;
        left:13px;
        bottom:12px;
        z-index:6;
        border:1px solid rgba(250,204,21,.36);
        border-radius:999px;
        background:rgba(69,26,3,.84);
        color:#fde68a;
        padding:3px 7px;
        font-size:9px;
        font-weight:950;
        pointer-events:none;
      }
      body.az-aff-admin .az-aff-pinned-chip-1325{display:inline-flex}

      .az-aff-bulk-toast-1325{
        position:fixed;
        left:50%;
        bottom:24px;
        z-index:2147483600;
        transform:translate(-50%,14px);
        opacity:0;
        pointer-events:none;
        max-width:min(560px,calc(100vw - 28px));
        border:1px solid rgba(34,197,94,.42);
        border-radius:999px;
        background:#07111f;
        color:#dcfce7;
        padding:10px 15px;
        font:900 12px/1.3 Arial,Helvetica,sans-serif;
        box-shadow:0 18px 55px rgba(0,0,0,.5);
        transition:opacity .16s ease,transform .16s ease;
      }
      .az-aff-bulk-toast-1325[data-type="error"]{border-color:rgba(239,68,68,.55);color:#fecaca}
      .az-aff-bulk-toast-1325.is-show{opacity:1;transform:translate(-50%,0)}

      @media(max-width:760px){
        .az-aff-bulk-toolbar-1325{gap:6px;padding:9px}
        .az-aff-bulk-btn-1325{min-height:34px;padding:0 10px;font-size:10.5px}
        .az-aff-selected-count-1325{width:100%;margin-left:0;text-align:left}
        .az-aff-card-select-1325{top:10px;left:10px;width:29px;height:29px}
        .az-aff-pin-btn-1325{top:10px;left:45px;width:29px;height:29px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureToolbar(){
    const g = grid();
    if(!g || document.getElementById('azAffiliateBulkToolbar1325')) return;
    const bar = document.createElement('div');
    bar.id = 'azAffiliateBulkToolbar1325';
    bar.className = 'az-aff-bulk-toolbar-1325';
    bar.innerHTML = `
      <button class="az-aff-bulk-btn-1325" type="button" data-aff-bulk-action="select-all">☑ Tick All</button>
      <button class="az-aff-bulk-btn-1325" type="button" data-aff-bulk-action="clear">☐ Untick All</button>
      <button class="az-aff-bulk-btn-1325 pin" type="button" data-aff-bulk-action="pin">📌 Pin Selected</button>
      <button class="az-aff-bulk-btn-1325 pin" type="button" data-aff-bulk-action="unpin">📍 Unpin Selected</button>
      <button class="az-aff-bulk-btn-1325 delete" type="button" data-aff-bulk-action="delete">🗑 Delete Selected</button>
      <span class="az-aff-selected-count-1325" id="azAffiliateSelectedCount1325">0 selected</span>
    `;
    g.parentNode.insertBefore(bar, g);
    bar.addEventListener('click', onToolbarClick);
  }

  function updateSelectionUI(){
    cards().forEach(card => {
      const id = String(card.dataset.productId || '');
      const checked = selected.has(id);
      card.classList.toggle('az-aff-selected-1325', checked);
      const box = card.querySelector('.az-aff-select-input-1325');
      if(box) box.checked = checked;
    });
    const count = document.getElementById('azAffiliateSelectedCount1325');
    if(count) count.textContent = selected.size + (selected.size === 1 ? ' selected' : ' selected');
    document.querySelectorAll('#azAffiliateBulkToolbar1325 [data-aff-bulk-action="pin"],#azAffiliateBulkToolbar1325 [data-aff-bulk-action="unpin"],#azAffiliateBulkToolbar1325 [data-aff-bulk-action="delete"]').forEach(btn => {
      btn.disabled = selected.size === 0;
    });
  }

  function enhanceCard(card){
    if(!card || !card.matches('.card[data-product-id]')) return;
    const id = String(card.dataset.productId || '').trim();
    if(!id) return;

    if(!card.querySelector('.az-aff-card-select-1325')){
      const wrap = document.createElement('label');
      wrap.className = 'az-aff-card-select-1325';
      wrap.title = 'Select item';
      wrap.innerHTML = `<input class="az-aff-select-input-1325" type="checkbox" aria-label="Select ${esc(card.querySelector('h2')?.textContent || id)}">`;
      wrap.addEventListener('click', e => e.stopPropagation());
      wrap.querySelector('input').addEventListener('change', e => {
        e.stopPropagation();
        if(e.target.checked) selected.add(id); else selected.delete(id);
        updateSelectionUI();
      });
      card.appendChild(wrap);
    }

    if(!card.querySelector('.az-aff-pin-btn-1325')){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'az-aff-pin-btn-1325';
      btn.dataset.affPinOne = id;
      btn.title = 'Pin / unpin item';
      btn.setAttribute('aria-label','Pin / unpin item');
      btn.textContent = '📌';
      btn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();
        if(!isAdmin()) return;
        btn.disabled = true;
        try{
          if(pinned.has(id)) await unpinIds([id]);
          else await pinIds([id]);
        }finally{
          btn.disabled = false;
        }
      });
      card.appendChild(btn);
    }
  }

  function applyPinnedUI(){
    const ordered = Array.from(pinned.entries()).sort((a,b) => {
      const pa = Number(a[1]?.priority || a[1]?.pinnedAtMs || 0);
      const pb = Number(b[1]?.priority || b[1]?.pinnedAtMs || 0);
      return pb - pa;
    });
    const rank = new Map(ordered.map(([id],idx) => [id,idx]));

    cards().forEach(card => {
      const id = String(card.dataset.productId || '');
      const isPinned = pinned.has(id);
      // CSS order works with both grid and flex layouts and preserves normal DOM order.
      card.style.order = isPinned ? String(-100000 + (rank.get(id) || 0)) : '';
      card.dataset.affPinned1325 = isPinned ? '1' : '0';

      const pinBtn = card.querySelector('.az-aff-pin-btn-1325');
      if(pinBtn){
        pinBtn.classList.toggle('is-pinned',isPinned);
        pinBtn.title = isPinned ? 'Unpin item' : 'Pin item to top';
      }

      let chip = card.querySelector('.az-aff-pinned-chip-1325');
      if(isPinned && isAdmin()){
        if(!chip){
          chip = document.createElement('span');
          chip.className = 'az-aff-pinned-chip-1325';
          chip.textContent = '📌 PINNED';
          card.appendChild(chip);
        }
      }else if(chip){
        chip.remove();
      }
    });
  }

  function enhanceAll(){
    ensureToolbar();
    if(isAdmin()) cards().forEach(enhanceCard);
    applyPinnedUI();
    updateSelectionUI();
  }

  function queueEnhance(){
    if(mutationQueued) return;
    mutationQueued = true;
    requestAnimationFrame(() => {
      mutationQueued = false;
      enhanceAll();
    });
  }

  async function loadPins(){
    // Start with same-browser fallback immediately.
    const local = readLocalPins();
    Object.entries(local).forEach(([id,meta]) => {
      pinned.set(String(id), {
        priority:Number(meta?.priority || 0),
        pinnedAtMs:Number(meta?.pinnedAtMs || 0)
      });
    });
    applyPinnedUI();

    if(!firebase){ pinLoadDone = true; return; }

    let registryWorked = false;
    try{
      const snap = await firebase.getDocs(firebase.collection(firebase.db, PIN_COLLECTION));
      snap.forEach(d => {
        const data = d.data() || {};
        const id = String(data.productId || '').trim();
        if(!id || data.pinned === false) return;
        pinned.set(id,{
          priority:Number(data.priority || data.pinnedAtMs || 0),
          pinnedAtMs:Number(data.pinnedAtMs || 0)
        });
      });
      registryWorked = true;
    }catch(err){
      console.warn('AZOBSS v1325: pin registry read blocked; using product/local fallback.',err);
    }

    // Also recognise pinned=true stored directly on Firestore affiliate products.
    try{
      const snap = await firebase.getDocs(firebase.collection(firebase.db, PRODUCT_COLLECTION));
      snap.forEach(d => {
        const data = d.data() || {};
        if(data.pinned !== true) return;
        const id = String(d.id || data.id || '').trim();
        if(!id) return;
        pinned.set(id,{
          priority:Number(data.pinPriority || data.pinnedAtMs || 0),
          pinnedAtMs:Number(data.pinnedAtMs || 0)
        });
      });
    }catch(err){
      if(!registryWorked) console.warn('AZOBSS v1325: affiliate product pin fallback read failed.',err);
    }

    saveLocalPins();
    pinLoadDone = true;
    applyPinnedUI();
  }

  async function writePinRegistry(id, yes, priority){
    if(!firebase) throw new Error('Firebase unavailable');
    const ref = firebase.doc(firebase.db, PIN_COLLECTION, pinDocId(id));
    if(yes){
      await firebase.setDoc(ref,{
        productId:String(id),
        pinned:true,
        priority:Number(priority || Date.now()),
        pinnedAtMs:Date.now(),
        updatedAt:firebase.serverTimestamp(),
        version:VERSION
      },{merge:true});
    }else{
      await firebase.deleteDoc(ref);
    }
  }

  async function updateProductPinIfFirestore(id, yes, priority){
    if(!firebase) return false;
    const card = cards().find(c => String(c.dataset.productId || '') === String(id));
    const source = String(card?.dataset?.productSource || '').toLowerCase();
    if(source !== 'firestore') return false;
    try{
      await firebase.updateDoc(firebase.doc(firebase.db, PRODUCT_COLLECTION, String(id)),{
        pinned:!!yes,
        pinPriority:yes ? Number(priority || Date.now()) : 0,
        pinnedAtMs:yes ? Date.now() : 0,
        updatedAt:firebase.serverTimestamp()
      });
      return true;
    }catch(err){
      console.warn('AZOBSS v1325: direct affiliateProducts pin update failed.',err);
      return false;
    }
  }

  async function pinIds(ids){
    if(!isAdmin()) return;
    const cleanIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
    if(!cleanIds.length) return;

    const base = Date.now();
    let remoteFail = 0;

    cleanIds.forEach((id,index) => {
      pinned.set(id,{priority:base + (cleanIds.length-index),pinnedAtMs:base});
    });
    saveLocalPins();
    applyPinnedUI();

    if(firebase){
      for(let i=0;i<cleanIds.length;i++){
        const id = cleanIds[i];
        const priority = base + (cleanIds.length-i);
        let ok = false;
        try{
          await writePinRegistry(id,true,priority);
          ok = true;
        }catch(err){
          console.warn('AZOBSS v1325 pin registry write failed',id,err);
        }
        const direct = await updateProductPinIfFirestore(id,true,priority);
        if(!ok && !direct) remoteFail++;
      }
    }else{
      remoteFail = cleanIds.length;
    }

    selected.clear();
    updateSelectionUI();
    toast(remoteFail
      ? `Pinned ${cleanIds.length} item. ${remoteFail} pin disimpan local kerana Firestore block.`
      : `Pinned ${cleanIds.length} item ke bahagian paling atas.`,
      remoteFail ? 'error' : 'ok'
    );
  }

  async function unpinIds(ids){
    if(!isAdmin()) return;
    const cleanIds = Array.from(new Set((ids || []).map(String).filter(Boolean)));
    if(!cleanIds.length) return;

    cleanIds.forEach(id => pinned.delete(id));
    saveLocalPins();
    applyPinnedUI();

    let remoteFail = 0;
    if(firebase){
      for(const id of cleanIds){
        let ok = false;
        try{
          await writePinRegistry(id,false,0);
          ok = true;
        }catch(err){
          console.warn('AZOBSS v1325 unpin registry delete failed',id,err);
        }
        const direct = await updateProductPinIfFirestore(id,false,0);
        if(!ok && !direct) remoteFail++;
      }
    }else{
      remoteFail = cleanIds.length;
    }

    selected.clear();
    updateSelectionUI();
    toast(remoteFail
      ? `Unpinned ${cleanIds.length} item. Sebahagian perubahan hanya local.`
      : `Unpinned ${cleanIds.length} item.`,
      remoteFail ? 'error' : 'ok'
    );
  }

  function removeLocalProduct(id){
    try{
      const list = JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || '[]');
      const next = (Array.isArray(list) ? list : []).filter(x => String(x?.id || '') !== String(id));
      localStorage.setItem(LOCAL_PRODUCTS_KEY,JSON.stringify(next));
      return true;
    }catch(_e){ return false; }
  }

  function hideStaticProduct(id){
    const current = readArray(LOCAL_HIDDEN_KEY).map(String);
    current.push(String(id));
    return writeArray(LOCAL_HIDDEN_KEY,current);
  }

  async function deleteSelected(){
    if(!isAdmin() || !selected.size) return;
    const ids = Array.from(selected);
    const infos = new Map(cards().map(card => {
      const info = cardInfo(card);
      return [info.id,info];
    }));

    if(!confirm(`Delete ${ids.length} selected affiliate item(s)?\n\nFirestore items akan dipadam. Static/local items akan ikut kaedah delete sedia ada.`)) return;

    const toolbar = document.getElementById('azAffiliateBulkToolbar1325');
    toolbar?.querySelectorAll('button').forEach(b => b.disabled = true);

    let failed = 0;
    let hiddenFallback = 0;

    for(const id of ids){
      const info = infos.get(id) || {id,source:'static'};
      try{
        if(info.source === 'firestore'){
          if(!firebase) throw new Error('Firebase unavailable');
          await firebase.deleteDoc(firebase.doc(firebase.db, PRODUCT_COLLECTION, id));
        }else if(info.source === 'local'){
          if(!removeLocalProduct(id)) throw new Error('Local delete failed');
        }else{
          hideStaticProduct(id);
        }
      }catch(err){
        console.warn('AZOBSS v1325 bulk delete failed; local hide fallback:',id,err);
        hideStaticProduct(id);
        hiddenFallback++;
        failed++;
      }

      pinned.delete(id);
      try{
        if(firebase) await firebase.deleteDoc(firebase.doc(firebase.db, PIN_COLLECTION, pinDocId(id)));
      }catch(_e){}
    }

    saveLocalPins();
    selected.clear();
    toast(
      hiddenFallback
        ? `Delete selesai. ${hiddenFallback} item guna local-hide fallback.`
        : `Deleted ${ids.length} selected item(s).`,
      failed ? 'error' : 'ok'
    );

    // Existing page module owns the products[] array. Reload is the safest way
    // to force that owner to rebuild from Firestore/local/static data once.
    setTimeout(() => location.reload(), 650);
  }

  async function onToolbarClick(e){
    const btn = e.target.closest('[data-aff-bulk-action]');
    if(!btn || !isAdmin()) return;
    const action = btn.dataset.affBulkAction;

    if(action === 'select-all'){
      visibleCards().forEach(card => {
        const id = String(card.dataset.productId || '');
        if(id) selected.add(id);
      });
      updateSelectionUI();
      return;
    }
    if(action === 'clear'){
      selected.clear();
      updateSelectionUI();
      return;
    }
    if(action === 'pin'){
      await pinIds(Array.from(selected));
      return;
    }
    if(action === 'unpin'){
      await unpinIds(Array.from(selected));
      return;
    }
    if(action === 'delete'){
      await deleteSelected();
    }
  }

  // Generic selection API so future operations can reuse the same tick system.
  window.AZOBSSAffiliateSelection1325 = Object.freeze({
    version: VERSION,
    getSelectedIds: () => Array.from(selected),
    getSelectedCards: () => cards().filter(c => selected.has(String(c.dataset.productId || ''))),
    select: id => { if(id) selected.add(String(id)); updateSelectionUI(); },
    unselect: id => { selected.delete(String(id)); updateSelectionUI(); },
    selectAllVisible: () => {
      visibleCards().forEach(c => {
        const id = String(c.dataset.productId || '');
        if(id) selected.add(id);
      });
      updateSelectionUI();
    },
    clear: () => { selected.clear(); updateSelectionUI(); },
    pinSelected: () => pinIds(Array.from(selected)),
    unpinSelected: () => unpinIds(Array.from(selected))
  });

  installStyle();
  ensureToolbar();

  const g = grid();
  if(g){
    new MutationObserver(queueEnhance).observe(g,{childList:true,subtree:false});
  }
  if(document.body){
    new MutationObserver(queueEnhance).observe(document.body,{attributes:true,attributeFilter:['class']});
  }

  document.addEventListener('azobss-affiliate-products-rendered',queueEnhance);
  window.addEventListener('storage',e => {
    if([LOCAL_PINS_KEY,LOCAL_HIDDEN_KEY,LOCAL_PRODUCTS_KEY].includes(e.key)) queueEnhance();
  });

  queueEnhance();
  await loadPins();
  queueEnhance();
})();
