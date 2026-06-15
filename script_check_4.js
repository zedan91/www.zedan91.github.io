
/* AZOBSS cart persistence:
   - Guest buyers: localStorage only.
   - Logged-in Firebase users: localStorage + Firestore sync.
*/
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

(function(){
  if(window.__azobssCartFirestoreSyncReady) return;
  window.__azobssCartFirestoreSyncReady = true;

  let CART_KEY = 'azobss_shop_cart_guest_v1';
  window.__azobssCurrentCartKey = CART_KEY;
  const metaKey = () => CART_KEY + '_meta';
  const COLLECTION = 'userCarts';
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

  let currentUid = '';
  let syncTimer = null;
  let loadingFromCloud = false;
  let cloudPulling = false;
  let cloudReady = false;

  try{
    // Remove old shared cart key so logged-in cart cannot leak into guest view.
    if(localStorage.getItem('azobss_shop_cart_v1') !== null){
      localStorage.removeItem('azobss_shop_cart_v1');
      localStorage.removeItem('azobss_shop_cart_v1_meta');
    }
  }catch(e){}

  function readCart(){
    try{
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    }catch(e){ return []; }
  }

  function saveCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(Array.isArray(items) ? items.filter(Boolean) : []));
    window.dispatchEvent(new Event('azobss-shop-cart-updated'));
  }

  function localUpdatedAt(){
    try{
      const meta = JSON.parse(localStorage.getItem(metaKey()) || '{}');
      return Number(meta.updatedAt || 0);
    }catch(e){ return 0; }
  }

  function markLocalUpdated(){
    if(loadingFromCloud) return;
    try{ localStorage.setItem(metaKey(), JSON.stringify({updatedAt:Date.now()})); }catch(e){}
  }

  function itemKey(i){
    return String(i?.source || '') + '::' + String(i?.id || i?.name || '');
  }

  function mergeCart(a,b){
    const map = new Map();
    [...(Array.isArray(a)?a:[]), ...(Array.isArray(b)?b:[])].filter(Boolean).forEach(item=>{
      const key = itemKey(item);
      if(!key || key === '::') return;
      const old = map.get(key);
      if(!old) map.set(key, {...item, qty:Number(item.qty||1)});
      else{
        const oldQty = Number(old.qty||1);
        const newQty = Number(item.qty||1);
        map.set(key, {...old, ...item, qty:Math.max(oldQty, newQty)});
      }
    });
    return Array.from(map.values());
  }

  async function pushCloud(){
    if(!currentUid || loadingFromCloud || cloudPulling || !cloudReady) return;
    const items = readCart();
    const totalQty = items.reduce((s,i)=>s+Number(i.qty||1),0);
    try{
      await setDoc(doc(db, COLLECTION, currentUid), {
        uid: currentUid,
        items,
        totalQty,
        updatedAtMs: Date.now(),
        updatedAt: serverTimestamp()
      }, {merge:true});
    }catch(err){
      console.warn('AZOBSS cart Firestore sync skipped:', err);
    }
  }

  async function pullCloud(user){
    currentUid = user?.uid || '';
    if(!currentUid) return;
    cloudPulling = true;
    cloudReady = false;
    try{
      const ref = doc(db, COLLECTION, currentUid);
      const snap = await getDoc(ref);
      const localItems = readCart();
      const localTime = localUpdatedAt();
      if(snap.exists()){
        const data = snap.data() || {};
        const now = Date.now();
        const maxAge = 60*24*60*60*1000;
        const cloudItems = (Array.isArray(data.items) ? data.items.filter(Boolean) : [])
          .filter(i => !i.addedAt || (now - Number(i.addedAt)) <= maxAge);
        const cloudTime = Number(data.updatedAtMs || 0);
        loadingFromCloud = true;
        localStorage.setItem(CART_KEY, JSON.stringify(cloudItems));
        localStorage.setItem(metaKey(), JSON.stringify({updatedAt:cloudTime || Date.now()}));
        loadingFromCloud = false;
        cloudReady = true;
        if(Array.isArray(data.items) && data.items.length !== cloudItems.length){
          setTimeout(pushCloud, 300);
        }
        window.dispatchEvent(new Event('azobss-shop-cart-updated'));
      }else if(localItems.length){
        cloudReady = true;
        await pushCloud();
      }else{
        loadingFromCloud = true;
        localStorage.setItem(CART_KEY, JSON.stringify([]));
        localStorage.setItem(metaKey(), JSON.stringify({updatedAt:Date.now()}));
        loadingFromCloud = false;
        cloudReady = true;
        window.dispatchEvent(new Event('azobss-shop-cart-updated'));
      }
      if(typeof window.azobssOpenShopCart === 'function'){
        window.dispatchEvent(new Event('azobss-shop-cart-updated'));
      }
    }catch(err){
      console.warn('AZOBSS cart Firestore load skipped:', err);
    }finally{
      loadingFromCloud = false;
      cloudPulling = false;
    }
  }

  window.azobssCartDebug=function(){
    return {uid: currentUid, key: CART_KEY, items: readCart()};
  };
  window.addEventListener('azobss-shop-cart-updated', ()=>{
    markLocalUpdated();
    clearTimeout(syncTimer);
    syncTimer = setTimeout(pushCloud, 150);
  });

  onAuthStateChanged(auth, user => {
    if(user){
      CART_KEY = 'azobss_shop_cart_user_' + user.uid + '_v1';
      window.__azobssCurrentCartKey = CART_KEY;
      pullCloud(user);
      window.dispatchEvent(new Event('azobss-shop-cart-updated'));
    }else{
      currentUid = '';
      CART_KEY = 'azobss_shop_cart_guest_v1';
      window.__azobssCurrentCartKey = CART_KEY;
      window.dispatchEvent(new Event('azobss-shop-cart-updated'));
    }
  });
})();
