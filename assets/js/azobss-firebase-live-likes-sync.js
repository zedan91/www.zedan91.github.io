// AZOBSS Firebase Sync: online users, login history, guest visits, and likes.
// This file is intentionally standalone so it can run on every page without depending on internal module scope.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, addDoc, getDocs, getDoc, updateDoc, serverTimestamp, deleteDoc, deleteField, query, where } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
const auth = getAuth(app);
const authReady = new Promise(resolve => { try{ onAuthStateChanged(auth, user => resolve(user || null)); }catch{ resolve(null); } });

const ONLINE_COLLECTION = 'onlineUsers';
const LOGIN_HISTORY_COLLECTION = 'loginHistory';
const GUEST_HISTORY_COLLECTION = 'guestHistory';
const USER_LIKES_COLLECTION = 'userLikes';
const ONLINE_WINDOW_MS = 20 * 60 * 1000;
const PAGE_SIZE = 4;

function safeJson(raw){ try { return JSON.parse(raw || 'null'); } catch { return null; } }
function getSavedUser(){
  return safeJson(sessionStorage.getItem('azobssCurrentUser')) ||
         safeJson(localStorage.getItem('azobssCurrentUser')) ||
         safeJson(sessionStorage.getItem('azobssUser')) ||
         safeJson(localStorage.getItem('azobssUser'));
}
function userKey(user){
  const u = user || getSavedUser() || {};
  // IMPORTANT: AZOBSS user profiles are stored using usernameKey as the document id.
  // Use uid only as a fallback; otherwise likes can be saved under a uid doc and look empty later.
  return String(u.usernameKey || u.name || u.displayName || (u.email ? String(u.email).split('@')[0] : '') || u.uid || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g,'');
}
function likeKeyCandidates(user){
  const u = user || getSavedUser() || {};
  const savedKey = userKey(u);
  const uid = String(auth.currentUser?.uid || u.uid || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g,'');
  const out = [];
  [savedKey, uid].forEach(k => { if(k && !out.includes(k)) out.push(k); });
  return out;
}
function likeGlobalId(key, itemId){
  return String(key + '_' + itemId).replace(/[^a-zA-Z0-9_\-]/g,'').slice(0,180);
}
function compactLikePayload(item, user, key){
  return {
    ...item,
    uid:String(auth.currentUser?.uid || user.uid || ''),
    usernameKey:key,
    displayName:String(user.usernameKey||user.name||user.displayName||key),
    email:String(user.email||auth.currentUser?.email||''),
    phone:String(user.phone||''),
    createdAtMs:Number(item.createdAtMs || Date.now()),
    updatedAtMs:Date.now(),
    createdAtClient:item.createdAtClient || new Date().toISOString(),
    updatedAtClient:new Date().toISOString()
  };
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function firestoreMs(value){
  if(!value) return 0;
  if(typeof value.toMillis === 'function') return value.toMillis();
  if(typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
function formatDateTime(ms){
  if(!ms) return '-';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB') + ' • ' + d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', hour12:true});
}
function todayMonthCounts(rows){
  const now = new Date();
  let today = 0, month = 0;
  (rows || []).forEach(row => {
    const ms = firestoreMs(row.createdAt) || Number(row.createdAtMs || 0) || firestoreMs(row.lastSeenAt);
    if(!ms) return;
    const d = new Date(ms);
    if(d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()){
      month++;
      if(d.getDate() === now.getDate()) today++;
    }
  });
  return {today, month};
}
function pager(el, current, total, size, cb){
  if(!el) return;
  const pages = Math.max(1, Math.ceil((total || 0) / size));
  if(total <= size){ el.innerHTML = ''; return; }
  current = Math.min(Math.max(1, current), pages);
  const pageList = [];
  const add = (value) => { if(value >= 1 && value <= pages && !pageList.includes(value)) pageList.push(value); };
  add(1); add(current - 1); add(current); add(current + 1); add(pages);
  pageList.sort((a,b)=>a-b);
  let last = 0;
  let html = `<button type="button" class="guest-history-page-btn is-compact" data-page="prev" ${current <= 1 ? 'disabled' : ''}>‹</button>`;
  pageList.forEach(i => {
    if(last && i - last > 1) html += `<span class="guest-history-page-dots">…</span>`;
    html += `<button type="button" class="guest-history-page-btn is-compact ${i===current?'is-active':''}" data-page="${i}">${i}</button>`;
    last = i;
  });
  html += `<button type="button" class="guest-history-page-btn is-compact" data-page="next" ${current >= pages ? 'disabled' : ''}>›</button>`;
  el.innerHTML = html;
  el.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.page;
    if(v === 'prev') cb(Math.max(1, current - 1));
    else if(v === 'next') cb(Math.min(pages, current + 1));
    else cb(Number(v) || 1);
  }));
}

async function syncOnlineUser(){
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) return;
  try{
    await setDoc(doc(db, ONLINE_COLLECTION, key), {
      uid: String(user.uid || ''),
      usernameKey: key,
      displayName: String(user.usernameKey || user.name || user.displayName || key),
      email: String(user.email || ''),
      phone: String(user.phone || ''),
      role: String(user.role || 'member'),
      page: location.pathname,
      userAgent: navigator.userAgent,
      lastSeenAt: serverTimestamp(),
      lastSeenClient: new Date().toISOString(),
      lastSeenMs: Date.now(),
      online: true
    }, { merge:true });
  }catch(error){ console.warn('AZOBSS online sync failed:', error); }
}
async function markOffline(){
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) return;
  try{
    await setDoc(doc(db, ONLINE_COLLECTION, key), {
      online:false,
      lastSeenAt: serverTimestamp(),
      lastSeenClient: new Date().toISOString(),
      lastSeenMs: Date.now()
    }, { merge:true });
  }catch(error){}
}
async function syncLoginHistory(){
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) return;
  const sessionKey = 'azobssFirebaseLoginHistorySynced:' + key;
  if(sessionStorage.getItem(sessionKey)) return;
  sessionStorage.setItem(sessionKey, '1');
  try{
    await addDoc(collection(db, LOGIN_HISTORY_COLLECTION), {
      uid: String(user.uid || ''),
      usernameKey: key,
      displayName: String(user.usernameKey || user.name || user.displayName || key),
      email: String(user.email || ''),
      phone: String(user.phone || ''),
      role: String(user.role || 'member'),
      action: 'login',
      page: location.pathname,
      createdAt: serverTimestamp(),
      createdAtClient: new Date().toISOString(),
      createdAtMs: Date.now()
    });
  }catch(error){ console.warn('AZOBSS login history sync failed:', error); }
}
async function syncGuestVisit(){
  if(getSavedUser()) return;
  const sessionId = sessionStorage.getItem('azobssGuestSessionId') || ('guest-' + Date.now() + '-' + Math.random().toString(36).slice(2,8));
  sessionStorage.setItem('azobssGuestSessionId', sessionId);
  const key = 'azobssGuestVisitSaved:' + location.pathname;
  if(sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  try{
    await addDoc(collection(db, GUEST_HISTORY_COLLECTION), {
      sessionId,
      page: location.pathname,
      referrer: document.referrer || '',
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      createdAtClient: new Date().toISOString(),
      createdAtMs: Date.now()
    });
  }catch(error){ console.warn('AZOBSS guest visit sync failed:', error); }
}

let livePage = 1, loginPage = 1, guestPage = 1;
function liveHtml(user){
  const ms = firestoreMs(user.lastSeenAt) || Number(user.lastSeenMs || 0);
  return `<div class="purchase-summary-item admin-purchase-user-card"><div class="admin-purchase-user-top"><strong>${escapeHtml(user.displayName || user.usernameKey || 'User')}</strong><span>${formatDateTime(ms)}</span></div><div class="admin-purchase-user-details"><span>Email: ${escapeHtml(user.email || '-')}</span><span>Phone: ${escapeHtml(user.phone || '-')}</span><span>Status: ${Date.now()-ms<30000?'online':'recently active'}</span></div></div>`;
}
function loginHtml(row){
  const ms = firestoreMs(row.createdAt) || Number(row.createdAtMs || 0);
  return `<div class="purchase-summary-item admin-purchase-user-card"><div class="admin-purchase-user-top"><strong>${escapeHtml(row.displayName || row.usernameKey || 'User')}</strong><span>${formatDateTime(ms)}</span></div><div class="admin-purchase-user-details"><span>Email: ${escapeHtml(row.email || '-')}</span><span>Phone: ${escapeHtml(row.phone || '-')}</span><span>Action: ${escapeHtml(row.action || 'login')}</span></div></div>`;
}
function guestHtml(row){
  const ms = firestoreMs(row.createdAt) || Number(row.createdAtMs || 0);
  return `<div class="purchase-summary-item admin-purchase-user-card"><div class="admin-purchase-user-top"><strong>Guest</strong><span>${formatDateTime(ms)}</span></div><div class="admin-purchase-user-details"><span>Page: ${escapeHtml(row.page || '-')}</span><span>Session: ${escapeHtml(String(row.sessionId || '').slice(0,22))}</span></div></div>`;
}
async function renderFirebaseLivePanels(){
  if(!document.body.classList.contains('is-admin')) return;
  try{
    const liveRows = [];
    const snap = await getDocs(collection(db, ONLINE_COLLECTION));
    snap.forEach(d => liveRows.push({id:d.id, ...d.data()}));
    const now = Date.now();
    const live = liveRows.filter(u => {
      const ms = firestoreMs(u.lastSeenAt) || Number(u.lastSeenMs || 0);
      return ms && (now - ms) <= ONLINE_WINDOW_MS && u.online !== false;
    }).sort((a,b)=>(firestoreMs(b.lastSeenAt)||Number(b.lastSeenMs||0))-(firestoreMs(a.lastSeenAt)||Number(a.lastSeenMs||0)));
    const list = document.getElementById('liveUsersList');
    if(list){
      const visible = live.slice((livePage-1)*PAGE_SIZE, livePage*PAGE_SIZE);
      list.innerHTML = visible.map(liveHtml).join('') || '<div class="purchase-summary-item">No users are online right now.</div>';
      pager(document.getElementById('liveUsersPagination'), livePage, live.length, PAGE_SIZE, p => { livePage = p; renderFirebaseLivePanels(); });
    }
    const count = document.getElementById('onlineUserCount');
    if(count) count.textContent = String(live.length);
  }catch(error){ console.warn('AZOBSS live admin render failed:', error); }

  try{
    const rows = [];
    const snap = await getDocs(collection(db, LOGIN_HISTORY_COLLECTION));
    snap.forEach(d => rows.push({id:d.id, ...d.data()}));
    rows.sort((a,b)=>(firestoreMs(b.createdAt)||Number(b.createdAtMs||0))-(firestoreMs(a.createdAt)||Number(a.createdAtMs||0)));
    const list = document.getElementById('loginHistoryList');
    if(list){
      const visible = rows.slice((loginPage-1)*PAGE_SIZE, loginPage*PAGE_SIZE);
      list.innerHTML = visible.map(loginHtml).join('') || '<div class="purchase-summary-item">No login history yet.</div>';
      pager(document.getElementById('loginHistoryPagination'), loginPage, rows.length, PAGE_SIZE, p => { loginPage = p; renderFirebaseLivePanels(); });
    }
    const c = todayMonthCounts(rows);
    const today = document.getElementById('loginHistoryToday'); if(today) today.textContent = String(c.today);
    const month = document.getElementById('loginHistoryMonth'); if(month) month.textContent = String(c.month);
  }catch(error){ console.warn('AZOBSS login history admin render failed:', error); }

  try{
    const rows = [];
    const snap = await getDocs(collection(db, GUEST_HISTORY_COLLECTION));
    snap.forEach(d => rows.push({id:d.id, ...d.data()}));
    rows.sort((a,b)=>(firestoreMs(b.createdAt)||Number(b.createdAtMs||0))-(firestoreMs(a.createdAt)||Number(a.createdAtMs||0)));
    const list = document.getElementById('guestHistoryList');
    if(list){
      const visible = rows.slice((guestPage-1)*PAGE_SIZE, guestPage*PAGE_SIZE);
      list.innerHTML = visible.map(guestHtml).join('') || '<div class="purchase-summary-item">No guest history yet.</div>';
      pager(document.getElementById('guestHistoryPagination'), guestPage, rows.length, PAGE_SIZE, p => { guestPage = p; renderFirebaseLivePanels(); });
    }
    const c = todayMonthCounts(rows);
    const today = document.getElementById('guestVisitsToday'); if(today) today.textContent = String(c.today);
    const month = document.getElementById('guestVisitsMonth'); if(month) month.textContent = String(c.month);
  }catch(error){ console.warn('AZOBSS guest history admin render failed:', error); }
}

function localLikes(){ return safeJson(localStorage.getItem('azLikes')) || []; }
function saveLocalLikes(arr){ try{ localStorage.setItem('azLikes', JSON.stringify(arr || [])); }catch{} }
function setUserLikeCache(key, rows){
  if(!key) return;
  try{ localStorage.setItem('azLikes:' + key, JSON.stringify(rows || [])); }catch{}
}
function getUserLikeCache(key){
  if(!key) return [];
  return safeJson(localStorage.getItem('azLikes:' + key)) || [];
}
function paintLikeButton(btn, liked){
  if(!btn) return;
  const nextText = liked ? '❤️' : '♡';
  if((btn.textContent || '').trim() !== nextText) btn.textContent = nextText;
  if(btn.classList.contains('is-liked') !== !!liked) btn.classList.toggle('is-liked', !!liked);
  if(btn.classList.contains('liked') !== !!liked) btn.classList.toggle('liked', !!liked);
  const pressed = liked ? 'true' : 'false';
  if(btn.getAttribute('aria-pressed') !== pressed) btn.setAttribute('aria-pressed', pressed);
  btn.title = liked ? 'Unlike' : 'Like';
  btn.style.color = liked ? '#ff3b5c' : '#ffffff';
}
function makeLikeId(raw){
  return btoa(unescape(encodeURIComponent(String(raw || 'azobss-item'))))
    .replace(/[=+/]/g,'')
    .slice(0,110);
}
function cleanLikeTitle(text){
  return String(text || '')
    .replace(/[♡❤️🤍]/g,'')
    .replace(/\b(like|unlike|open|download now|buyer protection|sold)\b/ig,'')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,120);
}
function pageLikeCategory(){
  const path = location.pathname.toLowerCase();
  if(path.includes('/affiliate-shop/')) return 'affiliate';
  if(path.includes('/software-tools/')) return 'software';
  if(path.includes('/cad-tools-&-resources/')) return 'cad';
  return location.pathname.replace(/^\//,'').split('/')[0] || 'local';
}
function likeTitleFromCard(card){
  if(!card) return 'AZOBSS Item';
  const titleEl = card.querySelector?.('h1,h2,h3,h4,.product-title,.tool-title,.program-title,.download-title,[data-title],strong,b,a');
  let title = titleEl ? (titleEl.getAttribute('data-title') || titleEl.textContent) : '';
  if(!cleanLikeTitle(title)){
    title = (card.innerText || '')
      .split('\n')
      .map(cleanLikeTitle)
      .filter(Boolean)
      .find(s => !/^rm\s*\d+/i.test(s) && !/^search$/i.test(s)) || 'AZOBSS Item';
  }
  return cleanLikeTitle(title) || 'AZOBSS Item';
}
function getLikeSourceUrl(card, category){
  if(category === 'cad') return '/CAD-Tools-&-Resources/';
  const a = card?.querySelector?.('a[href]');
  const href = a ? String(a.getAttribute('href') || '').trim() : '';
  if(!href || href === '#' || href.toLowerCase().startsWith('javascript:')) return location.pathname;
  try{ return new URL(href, location.origin).href; }catch{ return href; }
}
function normalizeLikeRow(value, index=0){
  if(value && typeof value === 'object'){
    const title = cleanLikeTitle(value.title || value.name || 'AZOBSS Item') || 'AZOBSS Item';
    const category = String(value.category || value.type || 'local');
    const pageUrl = String(value.pageUrl || value.url || '#');
    const createdAtMs = Number(value.createdAtMs || value.updatedAtMs || (Date.parse(value.createdAtClient || '') || (Date.now()-index)));
    const itemId = String(value.itemId || value.id || makeLikeId(category + '|' + title + '|' + pageUrl));
    return { itemId, title, category, pageUrl, createdAtClient:value.createdAtClient || new Date(createdAtMs).toISOString(), createdAtMs, updatedAtMs:Number(value.updatedAtMs || createdAtMs) };
  }
  const title = cleanLikeTitle(value);
  if(!title) return null;
  const category = 'local';
  const itemId = makeLikeId(category + '|' + title);
  return { itemId, title, category, pageUrl:'#', createdAtClient:new Date(Date.now()-index).toISOString(), createdAtMs:Date.now()-index, updatedAtMs:Date.now()-index };
}
function likeItemFromButton(btn){
  const selector = '.product-card,.tool-card,.software-card,.download-card,.affiliate-card,.lisp-row,tr,.card';
  const card = btn.closest(selector) || btn.parentElement;
  const category = pageLikeCategory();
  const title = cleanLikeTitle(btn.dataset.title) || likeTitleFromCard(card);
  const sourceUrl = getLikeSourceUrl(card, category);
  let itemId = String(btn.dataset.likeId || card?.dataset?.likeId || card?.getAttribute?.('data-like-id') || '').trim();
  if(!itemId){
    const allCards = [...document.querySelectorAll(selector)].filter(el => el.classList.contains('az-like-host') || el.querySelector?.(':scope > .azlike.card-like-btn'));
    const cardIndex = Math.max(0, allCards.indexOf(card));
    itemId = makeLikeId([category, location.pathname, cardIndex, title, sourceUrl].join('|'));
    if(btn) btn.dataset.likeId = itemId;
    if(card?.dataset) card.dataset.likeId = itemId;
  }
  return { itemId, title, category, pageUrl:sourceUrl || location.pathname, createdAtClient:new Date().toISOString(), createdAtMs:Date.now(), updatedAtMs:Date.now() };
}
async function readLikesFromFirebase(){
  await authReady.catch(()=>null);
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) return [];
  const rows = [];
  try{
    const snap = await getDocs(query(collection(db, USER_LIKES_COLLECTION), where('usernameKey','==',key)));
    snap.forEach(d => rows.push(normalizeLikeRow({ id:d.id, ...d.data() })));
    setUserLikeCache(key, rows);
    return rows;
  }catch(error){
    console.warn('AZOBSS read likes failed:', error);
    return getUserLikeCache(key).map(normalizeLikeRow).filter(Boolean);
  }
}
async function writeLikeToFirebase(item){
  await authReady.catch(()=>null);
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) throw new Error('Please login first to save likes.');
  const row = normalizeLikeRow(item);
  const payload = compactLikePayload(row, user, key);
  await setDoc(doc(db, USER_LIKES_COLLECTION, likeGlobalId(key,row.itemId)), {
    ...payload,
    itemId:row.itemId,
    title:row.title,
    category:row.category,
    pageUrl:row.pageUrl,
    createdAt:serverTimestamp(),
    updatedAt:serverTimestamp(),
    createdAtMs:row.createdAtMs || Date.now(),
    updatedAtMs:Date.now()
  }, { merge:true });
  const cached = getUserLikeCache(key).map(normalizeLikeRow).filter(Boolean).filter(x => x.itemId !== row.itemId);
  cached.unshift({ ...row, updatedAtMs:Date.now() });
  setUserLikeCache(key, cached);
  return true;
}
async function deleteLikeFromFirebase(item){
  await authReady.catch(()=>null);
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) throw new Error('Please login first.');
  const row = normalizeLikeRow(item);
  await deleteDoc(doc(db, USER_LIKES_COLLECTION, likeGlobalId(key,row.itemId)));
  const cached = getUserLikeCache(key).map(normalizeLikeRow).filter(Boolean).filter(x => x.itemId !== row.itemId);
  setUserLikeCache(key, cached);
  return true;
}
async function getFirebaseLikeIds(){
  const rows = await readLikesFromFirebase();
  return new Set(rows.map(x => x.itemId).filter(Boolean));
}
async function setLike(item, liked){
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key){
    if(window.openSiteAuth) window.openSiteAuth('signin');
    else alert('Please login first to save likes.');
    return false;
  }
  try{
    if(liked) await writeLikeToFirebase(item);
    else await deleteLikeFromFirebase(item);
    return true;
  }catch(error){
    console.warn('AZOBSS online like save failed:', error);
    alert('Like tidak berjaya disimpan ke Firebase. Sila cuba semula.');
    return false;
  }
}
async function refreshLikeButtons(){
  const firebaseIds = await getFirebaseLikeIds();
  document.querySelectorAll('.azlike').forEach(btn => {
    const item = likeItemFromButton(btn);
    const liked = firebaseIds.has(item.itemId);
    paintLikeButton(btn, liked);
    btn.style.cursor = 'pointer';
  });
}
function bindLikeClick(){
  if(document.documentElement.dataset.azobssLikeClickBound === '1') return;
  document.documentElement.dataset.azobssLikeClickBound = '1';
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest?.('.azlike');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    const item = likeItemFromButton(btn);
    const wasLiked = btn.classList.contains('is-liked') || String(btn.textContent || '').includes('❤️');
    const willLike = !wasLiked;
    paintLikeButton(btn, willLike);
    const ok = await setLike(item, willLike);
    if(!ok){
      paintLikeButton(btn, wasLiked);
      return;
    }
    await refreshLikesPage();
  }, true);
}
let azobssLikesCache = [];
async function refreshLikesPage(){
  const list = document.getElementById('azobssLikesList') || document.getElementById('list');
  if(!list || !/\/likes\/?$/i.test(location.pathname)) return;
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key){
    azobssLikesCache = [];
    renderLikesRows();
    return;
  }
  azobssLikesCache = await readLikesFromFirebase();
  renderLikesRows();
}
function getLikeSortMs(item){
  return firestoreMs(item.updatedAt) || Number(item.updatedAtMs || 0) || firestoreMs(item.createdAt) || Number(item.createdAtMs || 0) || 0;
}
function applyLikesSearchSort(rows){
  const q = String(document.getElementById('likesSearchInput')?.value || '').trim().toLowerCase();
  const sort = String(document.getElementById('likesSortSelect')?.value || 'newest');
  let out = Array.isArray(rows) ? [...rows] : [];
  if(q){
    out = out.filter(item => [item.title, item.category, item.pageUrl].some(v => String(v || '').toLowerCase().includes(q)));
  }
  out.sort((a,b)=>{
    if(sort === 'oldest') return getLikeSortMs(a) - getLikeSortMs(b);
    if(sort === 'az') return String(a.title || '').localeCompare(String(b.title || ''));
    if(sort === 'za') return String(b.title || '').localeCompare(String(a.title || ''));
    if(sort === 'category') return String(a.category || '').localeCompare(String(b.category || '')) || String(a.title || '').localeCompare(String(b.title || ''));
    return getLikeSortMs(b) - getLikeSortMs(a);
  });
  return out;
}
function renderLikesRows(){
  const list = document.getElementById('azobssLikesList') || document.getElementById('list');
  if(!list) return;
  const rows = applyLikesSearchSort(azobssLikesCache).map(normalizeLikeRow).filter(Boolean);
  list.innerHTML = rows.map(item => {
    const id = escapeHtml(item.itemId || item.id || '');
    const url = escapeHtml(item.pageUrl || '#');
    return `<div class="az-like-list-item" data-like-id="${id}" data-url="${url}">
      <div class="az-like-info"><strong>❤️ ${escapeHtml(item.title || 'AZOBSS Item')}</strong><br><span>${escapeHtml(item.category || '')}</span></div>
      <div class="az-like-actions">
        <a class="az-like-open-btn" href="${url}">Open</a>
        <button class="az-like-unlike-btn" type="button" data-like-id="${id}">Unlike</button>
      </div>
    </div>`;
  }).join('') || '<div class="az-like-empty">No liked items found.</div>';
}
function bindLikesControls(){
  const search = document.getElementById('likesSearchInput');
  const sort = document.getElementById('likesSortSelect');
  if(search && !search.dataset.bound){
    search.dataset.bound = '1';
    search.addEventListener('input', renderLikesRows);
  }
  if(sort && !sort.dataset.bound){
    sort.dataset.bound = '1';
    sort.addEventListener('change', renderLikesRows);
  }
  const list = document.getElementById('azobssLikesList') || document.getElementById('list');
  if(list && !list.dataset.unlikeBound){
    list.dataset.unlikeBound = '1';
    list.addEventListener('click', async (event) => {
      const btn = event.target.closest?.('.az-like-unlike-btn');
      if(!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const id = String(btn.dataset.likeId || btn.closest('.az-like-list-item')?.dataset.likeId || '').trim();
      const item = azobssLikesCache.map(normalizeLikeRow).filter(Boolean).find(x => x.itemId === id);
      if(!item) return;
      btn.disabled = true;
      btn.textContent = 'Removing...';
      await setLike(item, false);
      azobssLikesCache = azobssLikesCache.map(normalizeLikeRow).filter(Boolean).filter(x => x.itemId !== item.itemId);
      renderLikesRows();
      await refreshLikeButtons();
    });
  }
}
function addLikesPageStyle(){
  if(document.getElementById('azobss-live-likes-style')) return;
  const style = document.createElement('style');
  style.id = 'azobss-live-likes-style';
  style.textContent = `.az-like-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;margin:10px 0;border:1px solid rgba(56,189,248,.25);border-radius:14px;background:#111c2e;color:#fff}.az-like-list-item span{color:#9fb0c9;font-size:13px}.az-like-info{min-width:0}.az-like-actions{display:flex;gap:8px;align-items:center;flex-shrink:0}.az-like-list-item a,.az-like-unlike-btn{border:0;text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:800;cursor:pointer}.az-like-list-item a{background:#2563eb;color:#fff}.az-like-unlike-btn{background:#ef4444;color:#fff}.az-like-unlike-btn:disabled{opacity:.65;cursor:wait}.az-like-empty{padding:16px;border:1px solid rgba(148,163,184,.3);border-radius:14px;background:#111c2e}@media(max-width:640px){.az-like-list-item{align-items:flex-start}.az-like-actions{flex-direction:column;align-items:stretch}.az-like-list-item a,.az-like-unlike-btn{padding:7px 11px;font-size:12px;text-align:center}}`;
  document.head.appendChild(style);
}

async function boot(){
  addLikesPageStyle();
  bindLikesControls();
  bindLikeClick();
  await syncGuestVisit();
  await syncOnlineUser();
  await syncLoginHistory();
  await renderFirebaseLivePanels();
  await refreshLikeButtons();
  await refreshLikesPage();
  setInterval(syncOnlineUser, 30000);
  setInterval(renderFirebaseLivePanels, 45000);
  window.addEventListener('storage', () => { syncOnlineUser(); syncLoginHistory(); refreshLikeButtons(); refreshLikesPage(); });
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') { syncOnlineUser(); renderFirebaseLivePanels(); refreshLikeButtons(); refreshLikesPage(); }
  });
  window.addEventListener('beforeunload', () => { markOffline(); });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();



// Robust navbar likes link: always go to /likes/ and never to Lucky Draw.
function normalizeNavbarLikesLink(){
  document.querySelectorAll('a[aria-label="Likes"], .market-icon-btn').forEach(a => {
    const label = String(a.getAttribute('aria-label') || '').toLowerCase();
    const href = String(a.getAttribute('href') || '');
    const isHeart = label === 'likes' || a.querySelector('svg path[d*="20.8 4.6"]');
    if(isHeart){
      a.setAttribute('href','/likes/');
      a.classList.add('az-navbar-likes-link');
    }
  });
}
normalizeNavbarLikesLink();
setTimeout(normalizeNavbarLikesLink, 300);
setTimeout(normalizeNavbarLikesLink, 1200);
document.addEventListener('click', function(event){
  const a = event.target.closest?.('a[aria-label="Likes"], a.az-navbar-likes-link');
  if(!a || event.target.closest?.('.azlike')) return;
  event.preventDefault();
  event.stopPropagation();
  if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  window.location.href = '/likes/';
}, true);


// Auto inject like buttons only on allowed pages: Affiliate Shop, Software, and CAD Tools.
(function(){
  const allowedLikePages = [
    { test:/\/affiliate-shop\//i, selector:'.card,.product-card,.affiliate-card' },
    { test:/\/software-tools\//i, selector:'.download-card,.software-card' },
    { test:/\/cad-tools-&-resources\//i, selector:'#lispList tr,.lisp-row' }
  ];
  function currentConfig(){
    return allowedLikePages.find(x => x.test.test(location.pathname));
  }
  function ensureLikeStyle(){
    if(document.getElementById('azobss-card-like-style')) return;
    const style=document.createElement('style');
    style.id='azobss-card-like-style';
    style.textContent = `
      .az-like-host{position:relative!important;}
      .azlike.card-like-btn{
        position:absolute!important;top:10px!important;right:10px!important;
        width:36px!important;height:36px!important;border-radius:50%!important;
        border:1px solid rgba(255,255,255,.18)!important;background:rgba(2,6,23,.72)!important;
        color:#fff!important;z-index:50!important;font-size:18px!important;line-height:1!important;
        display:flex!important;align-items:center!important;justify-content:center!important;
        cursor:pointer!important;box-shadow:0 8px 22px rgba(0,0,0,.35)!important;transition:.2s!important;
      }
      .azlike.card-like-btn:hover{transform:scale(1.08)!important;background:rgba(15,23,42,.9)!important;}
      .azlike.card-like-btn.is-liked{color:#ff3b5c!important;background:rgba(255,59,92,.14)!important;border-color:rgba(255,59,92,.45)!important;}
      .azlike.card-like-btn.is-liked::after{content:'';position:absolute;inset:-3px;border-radius:999px;box-shadow:0 0 0 2px rgba(255,59,92,.12),0 0 16px rgba(255,59,92,.35);pointer-events:none;}
      #lispList tr.az-like-host .azlike.card-like-btn{top:50%!important;right:8px!important;transform:translateY(-50%)!important;}
      #lispList tr.az-like-host .azlike.card-like-btn:hover{transform:translateY(-50%) scale(1.08)!important;}
      #lispList tr.az-like-host td:last-child{padding-right:48px!important;}
       .az-like-host .tag,.az-like-host .category-badge,.az-like-host [class*="tag"],.az-like-host [class*="badge"]{margin-right:48px!important;}
@media(max-width:640px){.azlike.card-like-btn{width:32px!important;height:32px!important;font-size:16px!important;top:8px!important;right:8px!important;}.az-like-host .tag,.az-like-host .category-badge,.az-like-host [class*="tag"],.az-like-host [class*="badge"]{margin-right:40px!important;}}
    `;
    document.head.appendChild(style);
  }
  function injectAllowedLikeButtons(){
    const cfg=currentConfig();
    if(!cfg) return;
    ensureLikeStyle();
    document.querySelectorAll(cfg.selector).forEach((card,i)=>{
      if(!card || card.querySelector(':scope > .azlike.card-like-btn')) return;
      if(card.tagName === 'TR' && (!card.dataset.id && !card.querySelector('.program-link'))) return;
      card.classList.add('az-like-host');
      const b=document.createElement('button');
      b.type='button';
      b.className='azlike card-like-btn';
      b.textContent='♡';
      b.setAttribute('aria-label','Like item');
      card.appendChild(b);
      const itemPreview = likeItemFromButton(b);
      b.dataset.likeId = itemPreview.itemId;
      b.dataset.title = itemPreview.title;
      b.dataset.category = itemPreview.category;
    });
    if(typeof refreshLikeButtons === 'function') refreshLikeButtons();
  }
  function scheduleLikeInjection(){
    injectAllowedLikeButtons();
    [350, 900, 1600, 2800].forEach(ms => setTimeout(injectAllowedLikeButtons, ms));
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleLikeInjection, { once:true });
  else scheduleLikeInjection();
  // Do not use a body-wide MutationObserver here. It can loop when like buttons repaint
  // and causes Software/CAD/Affiliate tabs to freeze on some browsers.
})();

if(document.readyState==='loading'){
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(refreshLikeButtons,500);setTimeout(refreshLikeButtons,1500);setTimeout(refreshLikeButtons,3000);});
}else{
 setTimeout(refreshLikeButtons,500);setTimeout(refreshLikeButtons,1500);setTimeout(refreshLikeButtons,3000);
}
window.addEventListener('focus',()=>setTimeout(refreshLikeButtons,300));
