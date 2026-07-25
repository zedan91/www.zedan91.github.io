import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, limit, query, where } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
const PRICE_CATEGORIES = Object.freeze(['paBm','publicPa','software','cadTools']);
const emptyPercents = () => ({ paBm:0, publicPa:0, software:0, cadTools:0 });
const state = { ready:false, percent:0, percentByCategory:emptyPercents(), uid:'', username:'', source:'default' };
let readyResolve;
let readyPromise = new Promise(resolve => { readyResolve = resolve; });

function normalisePercent(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(-99, Math.min(500, Math.round(n * 100) / 100));
}
function categoryKey(value){
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  if(['pabm','jupem','lot','lotkadaster','ndcdb'].includes(key)) return 'paBm';
  if(['publicpa','paawam','pelanakui','pelanakuiawam'].includes(key)) return 'publicPa';
  if(['cad','cadtools','cadtool'].includes(key)) return 'cadTools';
  if(['software','softwaretools','subscription','activation'].includes(key)) return 'software';
  return PRICE_CATEGORIES.includes(value) ? value : '';
}
function profilePercents(profile){
  const result = emptyPercents();
  if(!profile || typeof profile !== 'object') return result;
  const managed = profile.adminPriceAdjustmentOverride === true || String(profile.priceAdjustmentManagedBy || '').toLowerCase() === 'admin';
  const managedMap = profile.adminPriceAdjustmentByCategory && typeof profile.adminPriceAdjustmentByCategory === 'object'
    ? profile.adminPriceAdjustmentByCategory : null;
  const publicMap = profile.priceAdjustmentByCategory && typeof profile.priceAdjustmentByCategory === 'object'
    ? profile.priceAdjustmentByCategory : null;
  const map = managed ? (managedMap || publicMap) : (publicMap || managedMap);
  const direct = {
    paBm: managed ? (profile.adminPaBmPriceAdjustmentPercent ?? profile.paBmPriceAdjustmentPercent) : (profile.paBmPriceAdjustmentPercent ?? profile.adminPaBmPriceAdjustmentPercent),
    publicPa: managed ? (profile.adminPublicPaPriceAdjustmentPercent ?? profile.publicPaPriceAdjustmentPercent) : (profile.publicPaPriceAdjustmentPercent ?? profile.adminPublicPaPriceAdjustmentPercent),
    software: managed ? (profile.adminSoftwarePriceAdjustmentPercent ?? profile.softwarePriceAdjustmentPercent) : (profile.softwarePriceAdjustmentPercent ?? profile.adminSoftwarePriceAdjustmentPercent),
    cadTools: managed ? (profile.adminCadToolsPriceAdjustmentPercent ?? profile.cadToolsPriceAdjustmentPercent) : (profile.cadToolsPriceAdjustmentPercent ?? profile.adminCadToolsPriceAdjustmentPercent)
  };
  const hasSpecific = !!map || Object.values(direct).some(value => value !== undefined && value !== null && value !== '');
  if(hasSpecific){
    for(const key of PRICE_CATEGORIES){
      const raw = map && Object.prototype.hasOwnProperty.call(map,key) ? map[key] : direct[key];
      result[key] = normalisePercent(raw ?? 0);
    }
    return result;
  }
  // Compatibility for users saved by version 591 before the controls were separated.
  const legacyRaw = managed
    ? (profile.adminPriceAdjustmentPercent ?? profile.priceAdjustmentPercent ?? 0)
    : (profile.priceAdjustmentPercent ?? profile.adminPriceAdjustmentPercent ?? 0);
  const legacy = normalisePercent(legacyRaw);
  for(const key of PRICE_CATEGORIES) result[key] = legacy;
  return result;
}
function savedUser(){
  try{
    if(typeof window.getSavedUser === 'function') return window.getSavedUser() || {};
    for(const key of ['azobssCurrentUser','azobssUser']){
      for(const store of [sessionStorage, localStorage]){
        const raw = store.getItem(key);
        if(raw){ const parsed = JSON.parse(raw); if(parsed && typeof parsed === 'object') return parsed; }
      }
    }
  }catch(_){ }
  return {};
}
async function loadProfile(user){
  if(!user) return null;
  const local = savedUser();
  const directIds = [local.usernameKey, local.username, user.uid].map(v=>String(v||'').trim()).filter(Boolean);
  for(const id of [...new Set(directIds)]){
    try{ const snap = await getDoc(doc(db,'users',id)); if(snap.exists()) return {docId:snap.id,...snap.data()}; }catch(_){ }
  }
  try{
    const snap = await getDocs(query(collection(db,'users'),where('uid','==',user.uid),limit(1)));
    if(!snap.empty){ const d=snap.docs[0]; return {docId:d.id,...d.data()}; }
  }catch(_){ }
  return null;
}
function snapshot(category=''){
  const key = categoryKey(category);
  return { ...state, percentByCategory:{...state.percentByCategory}, category:key, percent:key ? state.percentByCategory[key] : 0 };
}
function emit(){
  const detail = snapshot();
  window.AZOBSS_USER_PRICE_ADJUSTMENT = detail;
  window.dispatchEvent(new CustomEvent('azobss:price-adjustment-change',{detail}));
}
async function refresh(user = auth.currentUser){
  state.ready = false;
  state.uid = user?.uid || '';
  state.username = '';
  state.percent = 0;
  state.percentByCategory = emptyPercents();
  state.source = user ? 'profile-unavailable' : 'guest';
  if(user){
    const profile = await loadProfile(user);
    if(profile){
      state.percentByCategory = profilePercents(profile);
      state.username = String(profile.usernameKey || profile.username || profile.docId || '');
      state.source = 'users';
    }
  }
  state.ready = true;
  emit();
  if(readyResolve){ readyResolve(snapshot()); readyResolve = null; }
  return snapshot();
}
export function getPriceAdjustmentPercent(category){
  const key = categoryKey(category);
  return key ? normalisePercent(state.percentByCategory[key]) : 0;
}
export function getCachedPriceAdjustment(category=''){ return snapshot(category); }
export async function waitForPriceAdjustment(category=''){
  if(!state.ready) await readyPromise;
  return snapshot(category);
}
export function applyPriceAdjustment(amount, percent = 0){
  const base = Number(amount);
  if(!Number.isFinite(base)) return 0;
  const adjusted = base * (1 + normalisePercent(percent) / 100);
  return Math.max(0.01, Math.round((adjusted + Number.EPSILON) * 100) / 100);
}
export function formatAdjustedMoney(amount){
  const n = Number(amount || 0);
  return 'RM' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}
export function adjustPriceText(value, percent = 0){
  const text = String(value || '').trim();
  if(!text || /^free$/i.test(text)) return text;
  const match = text.replace(/,/g,'').match(/(?:RM\s*)?([0-9]+(?:\.[0-9]{1,2})?)/i);
  if(!match) return text;
  return formatAdjustedMoney(applyPriceAdjustment(Number(match[1]), percent));
}
export function priceAdjustmentLabel(percent = 0){
  const p = normalisePercent(percent);
  if(!p) return '';
  return p < 0 ? `Harga khas ${Math.abs(p)}% lebih rendah` : `Pelarasan harga +${p}%`;
}
window.azobssWaitForPriceAdjustment = waitForPriceAdjustment;
window.azobssGetPriceAdjustment = getCachedPriceAdjustment;
window.azobssGetPriceAdjustmentPercent = getPriceAdjustmentPercent;
window.azobssApplyPriceAdjustment = applyPriceAdjustment;
window.azobssAdjustPriceText = adjustPriceText;
window.azobssPriceAdjustmentLabel = priceAdjustmentLabel;
onAuthStateChanged(auth, user => refresh(user));
setTimeout(()=>{ if(!state.ready) refresh(auth.currentUser); }, 4500);
