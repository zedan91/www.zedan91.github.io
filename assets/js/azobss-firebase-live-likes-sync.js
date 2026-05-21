// AZOBSS Firebase Sync: online users, login history, guest visits, and likes.
// This file is intentionally standalone so it can run on every page without depending on internal module scope.
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getFirestore, doc, setDoc, collection, addDoc, getDocs, serverTimestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

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
  return String(u.usernameKey || u.name || u.displayName || (u.email ? String(u.email).split('@')[0] : '') || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g,'');
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
  let html = `<button type="button" class="guest-history-page-btn" data-page="prev" ${current <= 1 ? 'disabled' : ''}>Previous</button>`;
  for(let i=1;i<=pages;i++) html += `<button type="button" class="guest-history-page-btn ${i===current?'is-active':''}" data-page="${i}">${i}</button>`;
  html += `<button type="button" class="guest-history-page-btn" data-page="next" ${current >= pages ? 'disabled' : ''}>Next</button>`;
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
  return `<div class="purchase-summary-item admin-purchase-user-card"><div class="admin-purchase-user-top"><strong>${escapeHtml(user.displayName || user.usernameKey || 'User')}</strong><span>${formatDateTime(ms)}</span></div><div class="admin-purchase-user-details"><span>Email: ${escapeHtml(user.email || '-')}</span><span>Phone: ${escapeHtml(user.phone || '-')}</span><span>Status: online / recently active</span></div></div>`;
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
function likeItemFromButton(btn){
  const card = btn.closest('.product-card,.card,.tool-card,.software-card,.lisp-row,tr,.purchase-summary-item') || btn.parentElement;
  const path = location.pathname.replace(/^\//,'').split('/')[0] || 'home';
  let title = '';
  const titleEl = card?.querySelector('h1,h2,h3,h4,.product-title,.tool-title,.program-title,strong,b');
  if(titleEl) title = titleEl.textContent;
  if(!title) title = (card?.innerText || '').split('\n').map(s=>s.trim()).filter(Boolean).find(s=>!/^♡|❤️|sold|buyer protection$/i.test(s)) || 'AZOBSS Item';
  title = title.replace(/[♡❤️]/g,'').trim().slice(0,120) || 'AZOBSS Item';
  const category = path || 'home';
  const itemId = btoa(unescape(encodeURIComponent(category + '|' + title))).replace(/[=+/]/g,'').slice(0,80);
  return { itemId, title, category, pageUrl: location.pathname, createdAtClient: new Date().toISOString(), createdAtMs: Date.now() };
}
async function getFirebaseLikeIds(){
  const user = getSavedUser();
  const key = userKey(user);
  if(!user || !key) return new Set();
  const ids = new Set();
  try{
    const snap = await getDocs(collection(db, 'users', key, 'likes'));
    snap.forEach(d => ids.add(d.id));
  }catch(error){ console.warn('AZOBSS read likes failed:', error); }
  return ids;
}
async function setLike(item, liked){
  const user = getSavedUser();
  const key = userKey(user);
  const local = localLikes();
  const title = item.title;
  let next = local.filter(x => String(x) !== title);
  if(liked) next.unshift(title);
  saveLocalLikes(next.slice(0,500));
  if(!user || !key){
    if(window.openSiteAuth) window.openSiteAuth('signin');
    return;
  }
  try{
    const ref = doc(db, 'users', key, 'likes', item.itemId);
    const globalRef = doc(db, USER_LIKES_COLLECTION, key + '_' + item.itemId);
    if(liked){
      const payload = { ...item, uid:String(user.uid||''), usernameKey:key, displayName:String(user.usernameKey||user.name||key), email:String(user.email||''), phone:String(user.phone||''), createdAt:serverTimestamp(), updatedAt:serverTimestamp() };
      await setDoc(ref, payload, { merge:true });
      await setDoc(globalRef, payload, { merge:true });
    }else{
      await deleteDoc(ref).catch(()=>{});
      await deleteDoc(globalRef).catch(()=>{});
    }
  }catch(error){ console.warn('AZOBSS save like failed:', error); }
}
async function refreshLikeButtons(){
  const firebaseIds = await getFirebaseLikeIds();
  const local = new Set(localLikes().map(String));
  document.querySelectorAll('.azlike').forEach(btn => {
    const item = likeItemFromButton(btn);
    const liked = firebaseIds.has(item.itemId) || local.has(item.title);
    btn.textContent = liked ? ' ❤️' : ' 🤍';
    btn.title = liked ? 'Unlike' : 'Like';
    btn.style.cursor = 'pointer';
  });
}
function bindLikeClick(){
  document.addEventListener('click', async (event) => {
    const btn = event.target.closest?.('.azlike');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    const item = likeItemFromButton(btn);
    const willLike = !String(btn.textContent || '').includes('❤️');
    btn.textContent = willLike ? ' ❤️' : ' 🤍';
    await setLike(item, willLike);
    refreshLikesPage();
  }, true);
}
async function refreshLikesPage(){
  const list = document.getElementById('azobssLikesList') || document.getElementById('list');
  if(!list || !/\/likes\/?$/i.test(location.pathname)) return;
  const user = getSavedUser();
  const key = userKey(user);
  let rows = [];
  if(user && key){
    try{
      const snap = await getDocs(collection(db, 'users', key, 'likes'));
      snap.forEach(d => rows.push({id:d.id, ...d.data()}));
      rows.sort((a,b)=>(firestoreMs(b.updatedAt)||Number(b.createdAtMs||0))-(firestoreMs(a.updatedAt)||Number(a.createdAtMs||0)));
    }catch(error){ console.warn('AZOBSS likes page Firebase read failed:', error); }
  }
  if(!rows.length){
    rows = localLikes().map((title, i) => ({ title, category:'local', pageUrl:'#', createdAtMs: Date.now()-i }));
  }
  list.innerHTML = rows.map(item => `<div class="az-like-list-item"><div><strong>❤️ ${escapeHtml(item.title || 'AZOBSS Item')}</strong><br><span>${escapeHtml(item.category || '')}</span></div><a href="${escapeHtml(item.pageUrl || '#')}">Open</a></div>`).join('') || '<div class="az-like-empty">No likes yet.</div>';
}
function addLikesPageStyle(){
  if(document.getElementById('azobss-live-likes-style')) return;
  const style = document.createElement('style');
  style.id = 'azobss-live-likes-style';
  style.textContent = `.az-like-list-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;margin:10px 0;border:1px solid rgba(56,189,248,.25);border-radius:14px;background:#111c2e;color:#fff}.az-like-list-item span{color:#9fb0c9;font-size:13px}.az-like-list-item a{background:#2563eb;color:#fff;text-decoration:none;padding:8px 14px;border-radius:10px;font-weight:800}.az-like-empty{padding:16px;border:1px solid rgba(148,163,184,.3);border-radius:14px;background:#111c2e}`;
  document.head.appendChild(style);
}

async function boot(){
  addLikesPageStyle();
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
      .azlike.card-like-btn.is-liked{color:#ff4b6e!important;}
      #lispList tr.az-like-host .azlike.card-like-btn{top:50%!important;right:8px!important;transform:translateY(-50%)!important;}
      #lispList tr.az-like-host .azlike.card-like-btn:hover{transform:translateY(-50%) scale(1.08)!important;}
      #lispList tr.az-like-host td:last-child{padding-right:48px!important;}
      @media(max-width:640px){.azlike.card-like-btn{width:32px!important;height:32px!important;font-size:16px!important;top:8px!important;right:8px!important;}}
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
      b.textContent='🤍';
      b.setAttribute('aria-label','Like item');
      card.appendChild(b);
    });
    if(typeof refreshLikeButtons === 'function') refreshLikeButtons();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectAllowedLikeButtons);
  else injectAllowedLikeButtons();
  setTimeout(injectAllowedLikeButtons, 350);
  setTimeout(injectAllowedLikeButtons, 1200);
  const mo = new MutationObserver(() => injectAllowedLikeButtons());
  if(document.body) mo.observe(document.body, {childList:true, subtree:true});
})();
