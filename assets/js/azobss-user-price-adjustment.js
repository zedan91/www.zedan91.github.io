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
const state = { ready:false, percent:0, uid:'', username:'', source:'default' };
let readyResolve;
let readyPromise = new Promise(resolve => { readyResolve = resolve; });

function normalisePercent(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return 0;
  return Math.max(-99, Math.min(500, Math.round(n * 100) / 100));
}
function profilePercent(profile){
  if(!profile || typeof profile !== 'object') return 0;
  const managed = profile.adminPriceAdjustmentOverride === true || String(profile.priceAdjustmentManagedBy || '').toLowerCase() === 'admin';
  const raw = managed
    ? (profile.adminPriceAdjustmentPercent ?? profile.priceAdjustmentPercent ?? 0)
    : (profile.priceAdjustmentPercent ?? profile.adminPriceAdjustmentPercent ?? 0);
  return normalisePercent(raw);
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
function emit(){
  window.AZOBSS_USER_PRICE_ADJUSTMENT = {...state};
  window.dispatchEvent(new CustomEvent('azobss:price-adjustment-change',{detail:{...state}}));
}
async function refresh(user = auth.currentUser){
  state.ready = false;
  state.uid = user?.uid || '';
  state.username = '';
  state.percent = 0;
  state.source = user ? 'profile-unavailable' : 'guest';
  if(user){
    const profile = await loadProfile(user);
    if(profile){
      state.percent = profilePercent(profile);
      state.username = String(profile.usernameKey || profile.username || profile.docId || '');
      state.source = 'users';
    }
  }
  state.ready = true;
  emit();
  if(readyResolve){ readyResolve({...state}); readyResolve = null; }
  return {...state};
}
export function getCachedPriceAdjustment(){ return {...state}; }
export async function waitForPriceAdjustment(){ if(state.ready) return {...state}; return readyPromise; }
export function applyPriceAdjustment(amount, percent = state.percent){
  const base = Number(amount);
  if(!Number.isFinite(base)) return 0;
  const adjusted = base * (1 + normalisePercent(percent) / 100);
  return Math.max(0.01, Math.round((adjusted + Number.EPSILON) * 100) / 100);
}
export function formatAdjustedMoney(amount){
  const n = Number(amount || 0);
  return 'RM' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}
export function adjustPriceText(value, percent = state.percent){
  const text = String(value || '').trim();
  if(!text || /^free$/i.test(text)) return text;
  const match = text.replace(/,/g,'').match(/(?:RM\s*)?([0-9]+(?:\.[0-9]{1,2})?)/i);
  if(!match) return text;
  return formatAdjustedMoney(applyPriceAdjustment(Number(match[1]), percent));
}
export function priceAdjustmentLabel(percent = state.percent){
  const p = normalisePercent(percent);
  if(!p) return '';
  return p < 0 ? `Harga khas ${Math.abs(p)}% lebih rendah` : `Pelarasan harga +${p}%`;
}
window.azobssWaitForPriceAdjustment = waitForPriceAdjustment;
window.azobssGetPriceAdjustment = getCachedPriceAdjustment;
window.azobssApplyPriceAdjustment = applyPriceAdjustment;
window.azobssAdjustPriceText = adjustPriceText;
window.azobssPriceAdjustmentLabel = priceAdjustmentLabel;
onAuthStateChanged(auth, user => refresh(user));
setTimeout(()=>{ if(!state.ready) refresh(auth.currentUser); }, 4500);
