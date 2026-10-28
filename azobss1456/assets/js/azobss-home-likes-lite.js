// AZOBSS 704 HOME PERFORMANCE: likes-only Firebase module.
// The old azobss-firebase-live-likes-sync.js duplicated the full authentication
// and PA/BM runtime already provided by azobss-global-auth.js.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp, collection, getDocs, query, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',
  authDomain: 'azobss.firebaseapp.com',
  projectId: 'azobss',
  storageBucket: 'azobss.firebasestorage.app',
  messagingSenderId: '159277716405',
  appId: '1:159277716405:web:17d8924b6b6380e2b77ffc'
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* AZOBSS low-quota item likes buttons (restored)
   - Injects bookmark buttons into Affiliate / Software / CAD item cards.
   - Uses one Firestore path only: users/{usernameKey}/likes/{itemId}
   - Reads once, writes only when user toggles a like. No live listener. */
(function(){
  const STYLE_ID = 'azobss-low-quota-like-style';
  const CACHE_PREFIX = 'azobss_low_quota_likes:';
  const PAGE_MAP = {
    '/affiliate-shop': 'Affiliate Shop',
    '/software-tools': 'Software Tools',
    '/cad-tools-&-resources': 'CAD Tools & Resources',
    '/cad-tools-and-resources': 'CAD Tools & Resources'
  };
  const state = { loadedFor: '', ids: new Set(), busy: new Set(), loading: null };
  const likesPageState = { usernameKey: '', rows: [], lastDoc: null, hasMore: false, loading: false, pageSize: 20 };

  function addLikeStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .az-item-like-btn{position:absolute!important;top:14px!important;right:14px!important;z-index:20!important;width:38px!important;height:38px!important;border-radius:999px!important;border:1px solid rgba(14,165,233,.42)!important;background:rgba(5,10,22,.78)!important;color:#e0f2fe!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:20px!important;font-weight:900!important;line-height:1!important;cursor:pointer!important;box-shadow:0 10px 26px rgba(0,0,0,.32)!important;backdrop-filter:blur(8px)!important;transition:transform .18s ease, background .18s ease, border-color .18s ease!important;}
      .az-item-like-btn:hover{transform:scale(1.07)!important;border-color:#38bdf8!important;background:rgba(14,165,233,.14)!important;}
      .az-item-like-btn.is-liked{background:rgba(250,204,21,.18)!important;border-color:#facc15!important;color:#facc15!important;text-shadow:0 0 14px rgba(250,204,21,.42)!important;}
      .az-item-like-btn[disabled]{opacity:.62!important;cursor:wait!important;transform:none!important;}
      .az-item-like-btn .az-bookmark-icon{width:20px!important;height:20px!important;display:block!important;pointer-events:none!important;}
      .az-item-like-btn .az-bookmark-icon path{fill:none!important;stroke:currentColor!important;stroke-width:2.15!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
      .az-item-like-btn.is-liked .az-bookmark-icon path{fill:currentColor!important;stroke:currentColor!important;}
      /* AZOBSS 448: align bookmark, share and preview controls in one vertical rail. */
      .download-card > .az-item-like-btn,.software-card > .az-item-like-btn,.software-product-card > .az-item-like-btn,.cad-card > .az-item-like-btn,.cad-item > .az-item-like-btn,.cad-resource-card > .az-item-like-btn,.cad-tool-card > .az-item-like-btn{top:16px!important;right:16px!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important;padding:0!important;margin:0!important;}
      .download-card > .az-lucky-product-share-btn,.software-card > .az-lucky-product-share-btn,.software-product-card > .az-lucky-product-share-btn,.cad-card > .az-lucky-product-share-btn,.cad-item > .az-lucky-product-share-btn,.cad-resource-card > .az-lucky-product-share-btn,.cad-tool-card > .az-lucky-product-share-btn{top:64px!important;right:16px!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important;padding:0!important;margin:0!important;}
      .download-card > .azobss-preview-float-155,.software-card > .azobss-preview-float-155,.software-product-card > .azobss-preview-float-155,.cad-card > .azobss-preview-float-155,.cad-item > .azobss-preview-float-155,.cad-resource-card > .azobss-preview-float-155,.cad-tool-card > .azobss-preview-float-155{top:112px!important;right:16px!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important;padding:0!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;opacity:1!important;transform:none!important;}
      @media(max-width:700px){.download-card > .az-item-like-btn,.software-card > .az-item-like-btn,.software-product-card > .az-item-like-btn,.cad-card > .az-item-like-btn,.cad-item > .az-item-like-btn,.cad-resource-card > .az-item-like-btn,.cad-tool-card > .az-item-like-btn{top:16px!important;right:14px!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important}.download-card > .az-lucky-product-share-btn,.software-card > .az-lucky-product-share-btn,.software-product-card > .az-lucky-product-share-btn,.cad-card > .az-lucky-product-share-btn,.cad-item > .az-lucky-product-share-btn,.cad-resource-card > .az-lucky-product-share-btn,.cad-tool-card > .az-lucky-product-share-btn{top:60px!important;right:14px!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important}.download-card > .azobss-preview-float-155,.software-card > .azobss-preview-float-155,.software-product-card > .azobss-preview-float-155,.cad-card > .azobss-preview-float-155,.cad-item > .azobss-preview-float-155,.cad-resource-card > .azobss-preview-float-155,.cad-tool-card > .azobss-preview-float-155{top:104px!important;right:14px!important;width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;max-width:34px!important;max-height:34px!important;display:inline-flex!important;visibility:visible!important;opacity:1!important;transform:none!important}}
      .card,.download-card,.cad-card{position:relative!important;}
      .az-has-like-btn.card .top{padding-right:54px!important;}
      .az-has-like-btn.card .badge{max-width:calc(100% - 62px)!important;white-space:normal!important;text-align:center!important;overflow-wrap:anywhere!important;}
      .az-has-like-btn.card h2{padding-right:8px!important;}
      .az-has-like-btn.download-card h2,.az-has-like-btn.download-card h3,.az-has-like-btn.cad-card h2,.az-has-like-btn.cad-card h3{padding-right:54px!important;}
      .az-like-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;border:1px solid rgba(34,197,94,.22);border-radius:14px;background:rgba(15,23,42,.7);padding:14px;color:#fff;cursor:pointer;}
      .az-like-card-main{min-width:0;}
      .az-like-card-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;}
      .az-bookmark-add-cart-btn{border:1px solid rgba(34,197,94,.55);border-radius:999px;background:linear-gradient(135deg,#16a34a,#22c55e);color:#052e16;font-weight:950;padding:9px 16px;cursor:pointer;box-shadow:0 8px 18px rgba(34,197,94,.20);white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .az-bookmark-add-cart-btn:hover{filter:brightness(1.07);transform:translateY(-1px);}
      .az-bookmark-add-cart-btn:disabled{opacity:.62;cursor:not-allowed;transform:none;}
      .az-like-card-title{font-weight:950;color:#fff;font-size:16px;display:flex;align-items:center;gap:8px;min-width:0;}
      .az-like-page-bookmark-icon{width:20px!important;height:20px!important;flex:0 0 20px!important;color:#facc15!important;display:inline-block!important;}
      .az-like-page-bookmark-icon path{fill:currentColor!important;stroke:currentColor!important;stroke-width:2.15!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
      .az-like-card-meta{font-size:12px;color:#93c5fd;font-weight:800;margin-top:6px;}
      .az-like-card-url{font-size:12px;color:#86efac;word-break:break-all;margin-top:8px;}
      .az-like-unlike-btn{border:0;border-radius:999px;background:#ef4444;color:#fff;font-weight:950;padding:9px 16px;cursor:pointer;box-shadow:0 8px 18px rgba(239,68,68,.22);white-space:normal;display:inline-flex;align-items:center;justify-content:center;gap:7px;}
      .az-like-unlike-btn:hover{filter:brightness(1.08);transform:translateY(-1px);}
      .az-like-unlike-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;}
      .az-like-empty{border:1px solid rgba(148,163,184,.2);border-radius:14px;padding:18px;color:#cbd5e1;}
      @media(max-width:640px){.az-like-card{grid-template-columns:1fr}.az-like-card-actions{width:100%;justify-content:stretch;display:grid;grid-template-columns:1fr 1fr}.az-bookmark-add-cart-btn,.az-like-unlike-btn{width:100%;padding-left:10px;padding-right:10px;}}
    `;
    document.head.appendChild(style);
  }

  function safeJson(value){ try{return JSON.parse(value || 'null');}catch(e){return null;} }
  function cleanKey(value){ return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,''); }
  function getSavedUser(){
    return safeJson(sessionStorage.getItem('azobssUser')) ||
      safeJson(localStorage.getItem('azobssUser')) ||
      safeJson(sessionStorage.getItem('azobssCurrentUser')) ||
      safeJson(localStorage.getItem('azobssCurrentUser')) || null;
  }
  function getUsernameKey(){
    const u = getSavedUser();
    const key = cleanKey(u?.usernameKey || u?.username || u?.name || u?.id || '');
    if(key) return key;
    const authUser = auth.currentUser;
    if(authUser && authUser.uid) return cleanKey(authUser.uid);
    return '';
  }
  function isLoggedIn(){ return !!(auth.currentUser || sessionStorage.getItem('azobssLoggedIn') === '1' || localStorage.getItem('azobssLoggedIn') === '1'); }
  function openLogin(){
    try{ if(typeof window.openSiteAuth === 'function'){ window.openSiteAuth('signin'); return; } }catch(e){}
    const btn = document.querySelector('[data-auth-open="login"], #siteLoginButton, .site-auth-actions .site-auth-btn, #openLoginBtn, .login-btn');
    if(btn) btn.click();
    else alert('Please login/register first to save this bookmark.');
  }
  function cacheKey(usernameKey){ return CACHE_PREFIX + usernameKey; }
  function loadCache(usernameKey){
    const arr = safeJson(localStorage.getItem(cacheKey(usernameKey))) || [];
    state.ids = new Set(Array.isArray(arr) ? arr.map(String) : []);
  }
  function saveCache(usernameKey){
    try{ localStorage.setItem(cacheKey(usernameKey), JSON.stringify(Array.from(state.ids))); }catch(e){}
  }
  async function loadLikesOnce(){
    const usernameKey = getUsernameKey();
    if(!usernameKey) return state.ids;
    if(state.loadedFor === usernameKey) return state.ids;
    if(state.loading) return state.loading;
    loadCache(usernameKey);
    state.loading = (async()=>{
      try{
        const snap = await getDocs(collection(db, 'users', usernameKey, 'likes'));
        const ids = new Set(state.ids);
        snap.forEach(d=>ids.add(String(d.id)));
        state.ids = ids;
        state.loadedFor = usernameKey;
        saveCache(usernameKey);
      }catch(err){
        console.warn('AZOBSS likes load skipped:', err);
        state.loadedFor = usernameKey;
      }finally{
        state.loading = null;
      }
      return state.ids;
    })();
    return state.loading;
  }
  function azBookmarkIconHtml434(){
    return '<svg class="az-bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4.5C6 3.7 6.7 3 7.5 3h9c.8 0 1.5.7 1.5 1.5V21l-6-3.4L6 21V4.5Z"></path></svg>';
  }
  function bookmarkIconForLikePage(){
    return '<svg class="az-like-page-bookmark-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4.5C6 3.7 6.7 3 7.5 3h9c.8 0 1.5.7 1.5 1.5V21l-6-3.4L6 21V4.5Z"></path></svg>';
  }
  function setButtonState(btn, liked){
    if(!btn) return;
    btn.classList.toggle('is-liked', !!liked);
    btn.innerHTML = azBookmarkIconHtml434();
    btn.setAttribute('aria-label', liked ? 'Remove bookmark' : 'Add bookmark');
    btn.title = liked ? 'Remove bookmark' : 'Add bookmark';
  }
  function isBookmarksRoute439(){
    const path = String(location.pathname || '').toLowerCase();
    return path.includes('/bookmarks');
  }
  function pageType(){
    const path = String(location.pathname || '').toLowerCase().replace(/\/$/,'');
    for(const key of Object.keys(PAGE_MAP)) if(path.includes(key)) return PAGE_MAP[key];
    if(path.includes('cad')) return 'CAD Tools & Resources';
    if(path.includes('software')) return 'Software Tools';
    if(path.includes('affiliate')) return 'Affiliate Shop';
    return 'AZOBSS';
  }
  function normalizeLikeUrl(url, page){
    let raw = String(url || '').trim();
    if(!raw || raw === '#') return '';
    if(/^(https?:|mailto:|tel:|blob:|data:)/i.test(raw)) return raw;
    raw = raw.replace(/\\/g, '/');
    if(raw.startsWith('/')) return location.origin + raw;

    const lowerRaw = raw.toLowerCase();
    if(lowerRaw.startsWith('software-tools/')) return location.origin + '/' + raw.replace(/^\/+/, '');
    if(lowerRaw.startsWith('cad-tools-&-resources/') || lowerRaw.startsWith('cad-tools-and-resources/')) return location.origin + '/' + raw.replace(/^\/+/, '');
    if(lowerRaw.startsWith('affiliate-shop/') || lowerRaw.startsWith('bookmarks/')) return location.origin + '/' + raw.replace(/^\/+/, '');

    const pageName = String(page || pageType() || '').toLowerCase();
    if(pageName.includes('software')) return location.origin + '/Software-Tools/' + raw.replace(/^\/+/, '');
    if(pageName.includes('cad')) return location.origin + '/CAD-Tools-&-Resources/' + raw.replace(/^\/+/, '');
    if(pageName.includes('affiliate')) return location.origin + '/affiliate-shop/' + raw.replace(/^\/+/, '');
    return location.origin + '/' + raw.replace(/^\/+/, '');
  }
  function bookmarkProductUrl439(productId, page, type){
    const id = String(productId || '').trim();
    const pageName = String(page || '').toLowerCase();
    const typeName = String(type || '').toLowerCase();
    if(!id) return '';
    const route = (pageName.includes('cad') || typeName.includes('cad'))
      ? '/CAD-Tools-&-Resources/'
      : (pageName.includes('affiliate') || typeName.includes('affiliate'))
        ? '/affiliate-shop/'
        : '/Software-Tools/';
    try{
      const url = new URL(location.origin + route);
      url.searchParams.set('p', id);
      return url.toString();
    }catch(e){
      return location.origin + route + '?p=' + encodeURIComponent(id);
    }
  }
  function bookmarkOpenUrlForRow439(row){
    const page = String(row?.page || row?.category || '').toLowerCase();
    const type = String(row?.type || '').toLowerCase();
    const id = String(row?.productId || row?.softwareId || row?.cadId || row?.itemId || row?.id || '').trim();
    if(id && (page.includes('software') || type.includes('software') || page.includes('cad') || type.includes('cad') || page.includes('affiliate') || type.includes('affiliate'))){
      return bookmarkProductUrl439(id, row.page || row.category || '', row.type || '');
    }
    return normalizeLikeUrl(row?.pageUrl || row?.url || row?.downloadUrl || '', row?.page || row?.category || row?.type || '');
  }
  function azReadCardMonetization443(card){
    const btn = card?.querySelector?.('.download-btn,[data-azobss-premium-buy],.buy-btn,.premium-buy-btn,.az-card-cart-btn');
    const typeText = String(card?.dataset?.type || card?.dataset?.softwareType || card?.dataset?.cadType || '').trim().toLowerCase();
    const cardText = String(card?.innerText || '').toLowerCase();
    const btnPrice = btn ? String(btn.dataset?.productPrice || btn.dataset?.price || btn.getAttribute('data-product-price') || '').trim() : '';
    const premiumFlag = !!(btn && (btn.dataset?.azobssPremiumBuy === '1' || btn.getAttribute('data-azobss-premium-buy') === '1'));
    const hasBuy = /buy\s+now|premium|activation\s+code|rm\s*\d/i.test(cardText);
    const hasFree = /free|download\s+now/i.test(cardText) && !hasBuy && !premiumFlag;
    const price = btnPrice || (hasFree ? 'FREE' : '');
    const isPremium = premiumFlag || typeText === 'premium' || typeText === 'paid' || (!!btnPrice && azMoneyValue443(btnPrice) > 0) || hasBuy;
    const isFree = !isPremium && (typeText === 'free' || hasFree || /^free$/i.test(price) || azMoneyValue443(price) === 0);
    return {
      productType: isPremium ? 'premium' : (isFree ? 'free' : typeText),
      price: isPremium ? (btnPrice || '') : (isFree ? 'FREE' : price),
      productPrice: isPremium ? (btnPrice || '') : (isFree ? 'FREE' : price),
      isPremium,
      isFree,
      paymentLink: btn ? String(btn.dataset?.paymentLink || '').trim() : '',
      stripeLink: btn ? String(btn.dataset?.stripeLink || '').trim() : '',
      secureDownloadLink: btn ? String(btn.dataset?.downloadLink || btn.dataset?.premiumDownloadFileLink || '').trim() : '',
      premiumDownloadFileLink: btn ? String(btn.dataset?.premiumDownloadFileLink || '').trim() : '',
      downloadLink: btn ? String(btn.dataset?.downloadLink || '').trim() : ''
    };
  }
  function getCardInfo(card){
    const isAff = card.matches('.card');
    const isSw = card.matches('.download-card');
    const isCad = card.matches('.cad-card');
    const rawId = String(card.dataset.productId || card.dataset.softwareId || card.dataset.cadId || card.dataset.docId || card.dataset.id || '').trim() || cleanKey(card.querySelector('h2,h3')?.textContent || 'item');
    const id = cleanKey(rawId) || ('item-' + Date.now());
    const title = String(card.querySelector('h2,h3')?.textContent || rawId || id).trim();
    const desc = String(card.querySelector('p')?.textContent || '').trim();
    const category = String(card.dataset.category || card.querySelector('.badge,.software-badge,.cad-badge,.meta')?.textContent || pageType()).trim();
    const page = pageType();
    const type = isAff ? 'affiliate' : (isSw ? 'software' : (isCad ? 'cad' : 'item'));
    const productPageUrl = bookmarkProductUrl439(rawId || id, page, type);
    const moneyInfo = (isSw || isCad) ? azReadCardMonetization443(card) : {productType:'',price:'',productPrice:'',isPremium:false,isFree:false,paymentLink:'',stripeLink:'',secureDownloadLink:'',premiumDownloadFileLink:'',downloadLink:''};
    return {
      id,
      productId: rawId || id,
      title, desc, category,
      page,
      type,
      productType: moneyInfo.productType,
      softwareType: isSw ? moneyInfo.productType : '',
      cadType: isCad ? moneyInfo.productType : '',
      price: moneyInfo.price,
      productPrice: moneyInfo.productPrice,
      isPremium: moneyInfo.isPremium,
      isFree: moneyInfo.isFree,
      paymentLink: moneyInfo.paymentLink,
      stripeLink: moneyInfo.stripeLink,
      secureDownloadLink: moneyInfo.secureDownloadLink,
      premiumDownloadFileLink: moneyInfo.premiumDownloadFileLink,
      downloadLink: moneyInfo.downloadLink,
      url: productPageUrl || normalizeLikeUrl(location.pathname, page),
      pageUrl: productPageUrl || normalizeLikeUrl(location.pathname, page),
      savedAt: Date.now()
    };
  }
  function getCards(){
    const cards = [];
    document.querySelectorAll('.card[data-product-id], .download-card, .cad-card').forEach(card=>{
      if(card.closest('.auth-modal,.azobss-pay-modal,.admin-modal,.cad-admin-modal,.software-admin-modal')) return;
      // AZOBSS 287: do not skip cards that already include a first-paint like button.
      // Bind/update the existing button in place so the control is visible immediately and never blinks.
      const info = getCardInfo(card);
      if(!info.id || !info.title) return;
      cards.push({card, info});
    });
    return cards;
  }
  async function toggleLike(btn, info){
    if(!isLoggedIn()) { openLogin(); return; }
    const usernameKey = getUsernameKey();
    if(!usernameKey){ openLogin(); return; }
    await loadLikesOnce();
    const id = String(info.id);
    if(state.busy.has(id)) return;
    state.busy.add(id);
    btn.disabled = true;
    const nextLiked = !state.ids.has(id);
    if(nextLiked) state.ids.add(id); else state.ids.delete(id);
    setButtonState(btn, nextLiked);
    saveCache(usernameKey);
    try{
      if(nextLiked){
        await setDoc(doc(db, 'users', usernameKey, 'likes', id), {
          ...info,
          itemId: id,
          usernameKey,
          uid: auth.currentUser?.uid || getSavedUser()?.uid || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, {merge:true});
      }else{
        await deleteDoc(doc(db, 'users', usernameKey, 'likes', id));
      }
      // AZOBSS 432: top-right control is bookmark/save only.
      // Software like count is handled separately by the footer like button.
    }catch(err){
      console.warn('AZOBSS like save failed:', err);
      if(nextLiked) state.ids.delete(id); else state.ids.add(id);
      setButtonState(btn, !nextLiked);
      saveCache(usernameKey);
      alert('Unable to update Bookmarks right now. Please try again later.');
    }finally{
      state.busy.delete(id);
      btn.disabled = false;
      renderLikesPage(true);
    }
  }
  // AZOBSS 294: delegated fallback for first-paint like buttons.
  // Some shop cards render the bookmark button immediately before the injector binds per-button events.
  // This keeps the button usable: guest gets login/register prompt, logged-in users toggle like.
  document.addEventListener('click', function(event){
    const btn = event.target && event.target.closest ? event.target.closest('.az-item-like-btn') : null;
    if(!btn || isBookmarksRoute439()) return;
    // If the normal per-button listener is already bound, it stops propagation before this bubble listener.
    // So reaching here means fallback is needed.
    const card = btn.closest('.card[data-product-id], .download-card, .cad-card');
    if(!card) return;
    event.preventDefault();
    event.stopPropagation();
    toggleLike(btn, getCardInfo(card));
  }, false);

  async function injectLikeButtons(){
    if(isBookmarksRoute439()) return;
    addLikeStyle();
    const usernameKey = getUsernameKey();
    if(usernameKey && state.loadedFor !== usernameKey) loadCache(usernameKey);
    const currentCards = getCards();
    currentCards.forEach(({card, info})=>{
      card.classList.add('az-has-like-btn');
      let btn = card.querySelector(':scope > .az-item-like-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'az-item-like-btn';
        card.appendChild(btn);
      }
      btn.dataset.likeItemId = info.id;
      if(btn.dataset.azLikeBound !== '1'){
        btn.dataset.azLikeBound = '1';
        btn.addEventListener('click', (event)=>{
          event.preventDefault();
          event.stopPropagation();
          toggleLike(btn, getCardInfo(card));
        });
      }
      setButtonState(btn, state.ids.has(info.id));
    });
    if(usernameKey){
      try{
        await loadLikesOnce();
        document.querySelectorAll('.az-item-like-btn').forEach(btn=>{
          const id = String(btn.dataset.likeItemId || '');
          if(id) setButtonState(btn, state.ids.has(id));
        });
      }catch(e){}
    }
  }
  function bookmarkRowKind(row){
    const page = String(row?.page || row?.category || '').toLowerCase();
    const type = String(row?.type || '').toLowerCase();
    if(page.includes('cad') || type.includes('cad')) return 'cad';
    if(page.includes('software') || type.includes('software')) return 'software';
    return '';
  }
  function azText443(value){ return String(value == null ? '' : value).trim(); }
  function azMoneyValue443(value){
    const raw = azText443(value);
    const text = raw.toLowerCase();
    if(!text || /^free$/.test(text) || text === 'rm0' || text === 'rm0.00' || text === '0') return 0;
    // AZOBSS 444: Be strict. Do not treat product IDs, version numbers, file sizes,
    // URLs, or download filenames as prices. Old bookmarks sometimes store a URL in
    // price-like fields, causing free software to incorrectly show Add to Cart.
    if(/https?:\/\//i.test(raw) || /[\/]/.test(raw) || /\.(exe|zip|rar|7z|msi|dmg|pkg|gif|png|jpe?g|webp|pdf)(?:$|[?#])/i.test(raw)) return NaN;
    const cleaned = raw.replace(/,/g,'').trim();
    let m = cleaned.match(/(?:rm|myr)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if(m) return Number(m[1]);
    // Plain numeric values are accepted only if the entire field is numeric, not if
    // it contains text such as v1.0.9, 41MB, AZSW-CMP003 or a file name.
    if(/^[0-9]+(?:\.[0-9]{1,2})?$/.test(cleaned)) return Number(cleaned);
    return NaN;
  }
  function azBookmarkIsFreeItem443(row){
    const productType = azText443(row?.productType || row?.softwareType || row?.cadType || row?.planType || row?.saleType || row?.pricingType || '').toLowerCase();
    const typeText = azText443(row?.type || '').toLowerCase();
    const priceText = azText443(row?.productPrice || row?.price || row?.priceText || row?.amount || row?.salePrice || row?.finalPrice || '').toLowerCase();
    if(row?.isFree === true || row?.free === true) return true;
    if(productType === 'free' || productType === 'free software' || productType === 'free cad') return true;
    if(typeText === 'free' || typeText === 'free software' || typeText === 'free cad') return true;
    if(priceText && (/^free$/.test(priceText) || /^rm\s*0(?:\.00)?$/i.test(priceText) || priceText === '0')) return true;
    return false;
  }
  function azBookmarkIsPaidItem443(row){
    if(azBookmarkIsFreeItem443(row)) return false;
    const productType = azText443(row?.productType || row?.softwareType || row?.cadType || row?.planType || row?.saleType || row?.pricingType || '').toLowerCase();
    const typeText = azText443(row?.type || '').toLowerCase();
    const explicitPremium = row?.isPremium === true || row?.premium === true || row?.isPaid === true || row?.paid === true
      || productType === 'premium' || productType === 'paid' || productType === 'premium software' || productType === 'premium cad'
      || typeText === 'premium' || typeText === 'paid' || typeText === 'premium software' || typeText === 'premium cad';
    if(explicitPremium) return true;
    const priceFields = [row?.productPrice, row?.price, row?.priceText, row?.amount, row?.salePrice, row?.finalPrice];
    const money = priceFields.map(azMoneyValue443).find(v => Number.isFinite(v) && v > 0);
    if(Number.isFinite(money) && money > 0) return true;
    // AZOBSS 444: Do not mark an old bookmark as paid just because it has paymentLink
    // or a direct download URL. Premium cart button must require a clear premium flag
    // or a real RM/MYR price. This prevents Free Software like Bandizip/TBana free from
    // showing Add to Cart after old bookmark data is reused.
    return false;
  }
  function shouldShowBookmarkCartButton(row){
    const kind = bookmarkRowKind(row);
    if(kind !== 'software' && kind !== 'cad') return false;
    // AZOBSS 443: Bookmarks Add to Cart is only for paid/premium Software/CAD.
    // Free items are direct-download/share items, so the cart button is hidden.
    return azBookmarkIsPaidItem443(row);
  }
  function bookmarkCartPayload441(row){
    const kind = bookmarkRowKind(row);
    const id = String(row?.productId || row?.softwareId || row?.cadId || row?.itemId || row?.id || '').trim();
    const title = String(row?.title || row?.name || id || 'Bookmarked item').trim();
    const url = bookmarkOpenUrlForRow439(row);
    const price = String(row?.productPrice || row?.price || row?.priceText || row?.amount || row?.salePrice || 'RM0').trim() || 'RM0';
    const source = kind === 'cad' ? 'CAD Tools' : 'Software';
    const category = String(row?.category || row?.page || source).trim() || source;
    const link = String(row?.secureDownloadLink || row?.premiumDownloadFileLink || row?.downloadLink || row?.url || '').trim();
    return {
      id: id || (source + ':' + title),
      productId: id,
      name: title,
      title,
      price,
      source,
      category,
      type: kind || String(row?.type || ''),
      image: String(row?.image || row?.img || row?.thumbnail || row?.logo || '').trim(),
      pageUrl: url || String(row?.pageUrl || ''),
      paymentLink: String(row?.paymentLink || '').trim(),
      stripeLink: String(row?.stripeLink || '').trim(),
      secureDownloadLink: link,
      premiumDownloadFileLink: String(row?.premiumDownloadFileLink || link).trim(),
      downloadLink: String(row?.downloadLink || link).trim(),
      qty: 1,
      maxQty: 1,
      fromBookmarks: true
    };
  }
  function encodeBookmarkCartPayload441(row){
    try{ return encodeURIComponent(JSON.stringify(bookmarkCartPayload441(row))); }catch(e){ return ''; }
  }

  function likeCardHtml(row){
    const title = String(row.title || row.name || row.itemId || 'Bookmarked item');
    const meta = [row.page, row.category, row.type].filter(Boolean).join(' • ');
    const url = bookmarkOpenUrlForRow439(row);
    const itemId = String(row.itemId || row.id || '');
    return `<div class="az-like-card liked-item" data-url="${escapeHtml(url)}" data-type="${escapeHtml(row.type || '')}" data-like-id="${escapeHtml(itemId)}">
      <div class="az-like-card-main">
        <div class="az-like-card-title">${bookmarkIconForLikePage()}<span>${escapeHtml(title)}</span></div>
        <div class="az-like-card-meta">${escapeHtml(meta || 'AZOBSS')}</div>
        ${url ? `<div class="az-like-card-url">${escapeHtml(url)}</div>` : ''}
      </div>
      <div class="az-like-card-actions">
        ${shouldShowBookmarkCartButton(row) ? `<button class="az-bookmark-add-cart-btn" type="button" data-bookmark-add-cart="${escapeHtml(encodeBookmarkCartPayload441(row))}" aria-label="Add bookmark item to cart">🛒 Add to Cart</button>` : ''}
        <button class="az-like-unlike-btn" type="button" data-unlike-id="${escapeHtml(itemId)}" aria-label="Remove bookmark">Remove</button>
      </div>
    </div>`;
  }
  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }
  function addBookmarkItemToCart441(btn){
    if(!btn || btn.dataset.azBookmarkCartBusy === '1') return;
    btn.dataset.azBookmarkCartBusy = '1';
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    try{
      const payload = JSON.parse(decodeURIComponent(String(btn.dataset.bookmarkAddCart || '')) || '{}');
      if(!payload || !payload.id){ throw new Error('Missing bookmark cart payload'); }
      payload.qty = 1;
      payload.maxQty = 1;
      payload.addedAt = Date.now();
      if(typeof window.azobssAddShopCart === 'function'){
        window.azobssAddShopCart(payload);
      }else{
        const key = window.__azobssCurrentCartKey || 'azobss_shop_cart_guest_v1';
        let items = [];
        try{ items = JSON.parse(localStorage.getItem(key) || '[]').filter(Boolean); }catch(e){ items = []; }
        const found = items.find(x => String(x.id) === String(payload.id) && String(x.source || '') === String(payload.source || ''));
        if(found){ found.qty = 1; found.maxQty = 1; found.addedAt = found.addedAt || Date.now(); }
        else items.push(payload);
        localStorage.setItem(key, JSON.stringify(items.slice(0,100)));
        window.dispatchEvent(new Event('azobss-shop-cart-updated'));
        if(typeof window.azobssOpenShopCart === 'function') window.azobssOpenShopCart();
      }
      btn.innerHTML = '✓ Added';
      setTimeout(()=>{ btn.innerHTML = oldHtml; btn.disabled = false; btn.dataset.azBookmarkCartBusy = '0'; }, 900);
    }catch(err){
      console.warn('AZOBSS bookmark add to cart failed:', err);
      btn.disabled = false;
      btn.dataset.azBookmarkCartBusy = '0';
      alert('Unable to add this bookmark to cart. Please open the product page and add it again.');
    }
  }

  document.addEventListener('click', function(event){
    const btn = event.target.closest && event.target.closest('[data-bookmark-add-cart]');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if(event.stopImmediatePropagation) event.stopImmediatePropagation();
    addBookmarkItemToCart441(btn);
  }, true);

  async function unlikeFromLikesPage(itemId, btn){
    const usernameKey = getUsernameKey();
    const id = String(itemId || '').trim();
    if(!usernameKey || !id) return;
    if(state.busy.has(id)) return;
    state.busy.add(id);
    if(btn) btn.disabled = true;
    try{
      await deleteDoc(doc(db, 'users', usernameKey, 'likes', id));
      state.ids.delete(id);
      saveCache(usernameKey);
      const card = btn?.closest?.('.az-like-card');
      if(card) card.remove();
      renderLikesPage(false);
    }catch(err){
      console.warn('AZOBSS bookmark remove failed:', err);
      alert('Unable to remove this item from Bookmarks right now. Please try again later.');
    }finally{
      state.busy.delete(id);
      if(btn) btn.disabled = false;
    }
  }

  function sortAndFilterLikesRows(rows){
    let out = [...rows];
    const q = String(document.getElementById('likesSearchInput')?.value || '').trim().toLowerCase();
    if(q){
      out = out.filter(r=>[r.title,r.category,r.page,r.type,r.url,r.pageUrl,r.productId,r.itemId].join(' ').toLowerCase().includes(q));
    }
    const sort = document.getElementById('likesSortSelect')?.value || 'newest';
    if(sort==='software') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('software'));
    else if(sort==='cad') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('cad'));
    else if(sort==='affiliate') out=out.filter(r=>String(r.type||r.category||r.page||'').toLowerCase().includes('affiliate'));
    else if(sort==='category') out.sort((a,b)=>String(a.category||a.page||'').localeCompare(String(b.category||b.page||'')));
    else if(sort==='az') out.sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    else if(sort==='za') out.sort((a,b)=>String(b.title||'').localeCompare(String(a.title||'')));
    else if(sort==='oldest') out.sort((a,b)=>Number(a.savedAt||a.createdAtMs||0)-Number(b.savedAt||b.createdAtMs||0));
    else out.sort((a,b)=>Number(b.savedAt||b.createdAtMs||0)-Number(a.savedAt||a.createdAtMs||0));
    return out;
  }

  function renderLikesList(){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    const rows = sortAndFilterLikesRows(likesPageState.rows);
    if(!rows.length){
      list.innerHTML = '<div class="az-like-empty">No bookmarks yet. Tap the bookmark button on Software, CAD or Affiliate items.</div>';
      return;
    }
    const more = likesPageState.hasMore
      ? '<div class="az-like-loadmore-wrap"><button id="azLikesLoadMoreBtn" class="az-like-loadmore" type="button">Load More</button></div>'
      : '';
    list.innerHTML = rows.map(likeCardHtml).join('') + more;
  }

  async function loadLikesPage(reset){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    const usernameKey = getUsernameKey();
    if(!usernameKey) return;
    if(likesPageState.loading) return;
    likesPageState.loading = true;
    if(reset || likesPageState.usernameKey !== usernameKey){
      likesPageState.usernameKey = usernameKey;
      likesPageState.rows = [];
      likesPageState.lastDoc = null;
      likesPageState.hasMore = false;
      list.innerHTML = '<div class="az-like-empty">Loading bookmarks...</div>';
    }
    try{
      const baseRef = collection(db, 'users', usernameKey, 'likes');
      const pageLimit = likesPageState.pageSize;
      const q = likesPageState.lastDoc
        ? query(baseRef, orderBy('savedAt','desc'), startAfter(likesPageState.lastDoc), limit(pageLimit))
        : query(baseRef, orderBy('savedAt','desc'), limit(pageLimit));
      const snap = await getDocs(q);
      const incoming = snap.docs.map(d=>({itemId:d.id, ...d.data()}));
      const seen = new Set(likesPageState.rows.map(r=>String(r.itemId || r.id || '')));
      incoming.forEach(row=>{
        const id = String(row.itemId || row.id || '');
        if(id && !seen.has(id)) likesPageState.rows.push(row);
      });
      likesPageState.lastDoc = snap.docs[snap.docs.length-1] || likesPageState.lastDoc;
      likesPageState.hasMore = snap.docs.length === pageLimit;
      renderLikesList();
    }catch(err){
      console.warn('AZOBSS paged likes load failed, using cache fallback:', err);
      const fallbackRows = Array.from(state.ids).map(id=>({itemId:id, title:id, page:'AZOBSS', savedAt:0}));
      likesPageState.rows = fallbackRows;
      likesPageState.hasMore = false;
      renderLikesList();
    }finally{
      likesPageState.loading = false;
    }
  }

  async function renderLikesPage(skipLoad){
    const list = document.getElementById('azobssLikesList');
    if(!list) return;
    addLikeStyle();
    if(!isLoggedIn()){
      list.innerHTML = '<div class="az-like-empty">Please login to view your bookmarks.</div>';
      return;
    }
    const usernameKey = getUsernameKey();
    if(!usernameKey){ list.innerHTML = '<div class="az-like-empty">Please login again to load Bookmarks.</div>'; return; }
    if(!skipLoad) await loadLikesPage(true);
    else renderLikesList();
  }
  function scheduleInject(){
    clearTimeout(scheduleInject.t);
    scheduleInject.t = setTimeout(injectLikeButtons, 80);
  }
  function initHomeLikesLite705(){
    if(window.__azobssHomeLikesLiteUi705) return;
    window.__azobssHomeLikesLiteUi705 = true;
    injectLikeButtons();
    renderLikesPage(false);
    document.getElementById('likesSearchInput')?.addEventListener('input', ()=>renderLikesPage(true));
    document.getElementById('likesSortSelect')?.addEventListener('change', ()=>renderLikesPage(true));
    document.getElementById('azobssLikesList')?.addEventListener('click', (event)=>{
      const loadMoreBtn = event.target.closest('#azLikesLoadMoreBtn');
      if(loadMoreBtn){
        event.preventDefault();
        event.stopPropagation();
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
        loadLikesPage(false);
        return;
      }
      const unlikeBtn = event.target.closest('.az-like-unlike-btn');
      if(unlikeBtn){
        event.preventDefault();
        event.stopPropagation();
        unlikeFromLikesPage(unlikeBtn.dataset.unlikeId, unlikeBtn);
        return;
      }
      const card = event.target.closest('.az-like-card[data-url]');
      const url = card?.dataset?.url || '';
      if(url){
        event.preventDefault();
        window.location.href = normalizeLikeUrl(url, card.dataset.type || '');
      }
    });
    const obs = new MutationObserver(scheduleInject);
    obs.observe(document.body, {childList:true, subtree:true});
    setTimeout(injectLikeButtons, 600);
    setTimeout(injectLikeButtons, 1500);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHomeLikesLite705, {once:true});
  else initHomeLikesLite705();
  onAuthStateChanged(auth, ()=>{
    state.loadedFor = '';
    state.ids = new Set();
    likesPageState.usernameKey = '';
    likesPageState.rows = [];
    likesPageState.lastDoc = null;
    likesPageState.hasMore = false;
    setTimeout(()=>{ injectLikeButtons(); renderLikesPage(false); }, 200);
  });
})();
