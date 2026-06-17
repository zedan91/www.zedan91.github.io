
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {"apiKey": "AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8", "authDomain": "azobss.firebaseapp.com", "projectId": "azobss", "storageBucket": "azobss.firebasestorage.app", "messagingSenderId": "159277716405", "appId": "1:159277716405:web:17d8924b6b6380e2b77ffc"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL='zedan91@azobss.local';
const AZOBSS_BACKEND_API='https://azobss-backend.onrender.com';

let currentUser=null;
let adminProfile=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function fmtDate(v){
  try{
    let d=null;
    if(v?.toDate)d=v.toDate();
    else if(typeof v==='number')d=new Date(v);
    else if(typeof v==='string')d=new Date(v);
    if(!d||isNaN(d))return '-';
    return d.toLocaleString('en-MY',{hour12:true});
  }catch(e){return '-'}
}
function toast(msg){alert(msg)}
let adminApiNotice = '';
function azAdminApiErrorMessage(status,data,fallback){
  const raw=String(data?.error||data?.message||fallback||'Request failed.');
  if(status===401) return 'Session expired. Please login again, then retry.';
  if(status===403) return 'Admin permission required. Please login with an authorised admin account.';
  if(status===429) return 'Too many attempts. '+(data?.retryAfter?('Please wait '+data.retryAfter+' seconds.'):'Please wait a while.');
  if(String(data?.verification||'').toLowerCase()==='pending') return 'Payment verification is still pending. Please wait a moment and check again.';
  return raw;
}
async function azAdminAuthHeaders(forceRefresh=false){
  try{
    const u=currentUser||auth.currentUser;
    if(!u || typeof u.getIdToken!=='function') return {};
    const token=await u.getIdToken(!!forceRefresh);
    return token?{Authorization:'Bearer '+token}:{};
  }catch(_e){return {};}
}
async function azAdminFetchJson(url,options={}){
  const baseHeaders=options.headers||{};
  let authHeaders=await azAdminAuthHeaders(false);
  let res=await fetch(url,{...options,headers:{...baseHeaders,...authHeaders}});
  let data=await res.json().catch(()=>({ok:false,error:'Invalid backend response'}));
  if((res.status===401 || res.status===403) && Object.keys(authHeaders).length){
    authHeaders=await azAdminAuthHeaders(true);
    res=await fetch(url,{...options,headers:{...baseHeaders,...authHeaders}});
    data=await res.json().catch(()=>({ok:false,error:'Invalid backend response'}));
  }
  if(!res.ok) throw new Error(azAdminApiErrorMessage(res.status,data));
  return data;
}
async function azAdminFetchBlob(url,options={}){
  const baseHeaders=options.headers||{};
  let authHeaders=await azAdminAuthHeaders(false);
  let res=await fetch(url,{...options,headers:{...baseHeaders,...authHeaders}});
  if((res.status===401 || res.status===403) && Object.keys(authHeaders).length){
    authHeaders=await azAdminAuthHeaders(true);
    res=await fetch(url,{...options,headers:{...baseHeaders,...authHeaders}});
  }
  if(!res.ok){
    const text=await res.text().catch(()=>'');
    let data={};
    try{data=JSON.parse(text)}catch(_){data={error:text||'Request failed.'}}
    throw new Error(azAdminApiErrorMessage(res.status,data));
  }
  return {blob:await res.blob(), filename:azFilenameFromDisposition(res.headers.get('content-disposition'))};
}
function azFilenameFromDisposition(header){
  const h=String(header||'');
  const m=h.match(/filename=\"?([^\";]+)\"?/i);
  return m?m[1]:'';
}
function azSaveBlob(blob,filename){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename||('azobss-export-'+new Date().toISOString().slice(0,10));
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
async function downloadAdminExport(all=false){
  const notice=$('#adminExportNotice');
  const type=all?'all':($('#adminExportType')?.value||'premiumOrders');
  const format=all?'json':($('#adminExportFormat')?.value||'csv');
  const limit=Math.max(1,Math.min(5000,Number($('#adminExportLimit')?.value||500)||500));
  if(notice) notice.textContent='Preparing export...';
  try{
    const url=AZOBSS_BACKEND_API+'/api/admin/export?type='+encodeURIComponent(type)+'&format='+encodeURIComponent(format)+'&limit='+encodeURIComponent(limit);
    const result=await azAdminFetchBlob(url,{cache:'no-store'});
    const fallback='azobss-'+type+'-export-'+new Date().toISOString().slice(0,10)+'.'+(format==='csv'?'csv':'json');
    azSaveBlob(result.blob,result.filename||fallback);
    if(notice) notice.textContent='Export downloaded: '+(result.filename||fallback);
  }catch(e){
    if(notice) notice.textContent=e?.message||'Export failed.';
    toast(e?.message||'Export failed.');
  }
}
async function azAdminLogAction(action,targetType,targetId,details={},status='success'){
  try{
    await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/audit-log',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,targetType,targetId,details,status})
    });
  }catch(e){console.warn('Admin audit log skipped',e?.message||e);}
}
async function loadAdminAuditLogs(){
  const list=$('#adminAuditLogsList');
  const notice=$('#auditLogsNotice');
  if(list) list.innerHTML='<div class="item">Loading audit logs...</div>';
  if(notice) notice.textContent='';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/audit-logs?limit=120',{cache:'no-store'});
    const rows=Array.isArray(j.records)?j.records:[];
    if(notice) notice.textContent = j.firestoreOk ? 'Firestore audit log loaded.' : 'Using local audit fallback / Firestore unavailable.';
    if(!rows.length){ if(list) list.innerHTML='<div class="item">No audit logs yet.</div>'; return; }
    if(list) list.innerHTML=rows.map(x=>{
      const admin=x.admin||{};
      const who=esc(admin.username||admin.email||admin.authMethod||'admin');
      const details=x.details ? esc(JSON.stringify(x.details)).slice(0,420) : '';
      return `<div class="item">
        <div class="item-title">🧾 ${esc(x.action||'admin_action')} • ${esc(x.status||'success')}</div>
        <div class="item-meta">${esc(x.targetType||'-')} ${x.targetId?('• '+esc(x.targetId)) : ''} • ${who} • ${fmtDate(x.createdAtMs||x.createdAt)}</div>
        ${details?`<div class="item-meta" style="margin-top:4px;word-break:break-word">${details}</div>`:''}
      </div>`;
    }).join('');
  }catch(e){
    if(notice) notice.textContent=e?.message||'Failed to load audit logs.';
    if(list) list.innerHTML=`<div class="item"><div class="item-title">⚠️ Audit log error</div><div class="item-meta">${esc(e?.message||e)}</div></div>`;
  }
}
function isAdminUser(){
  const email=String(currentUser?.email||adminProfile?.email||adminProfile?.authEmail||'').toLowerCase();
  const role=String(adminProfile?.role||'').toLowerCase();
  const username=String(adminProfile?.username||adminProfile?.usernameKey||adminProfile?.name||'').toLowerCase();
  return email===ADMIN_EMAIL || role==='admin' || username==='zedan91';
}
async function getAdminProfile(user){
  if(!user)return null;
  const candidates=['zedan91', user.email?.split('@')[0], user.displayName].filter(Boolean);
  for(const c of candidates){
    try{
      const snap=await getDoc(doc(db,'users',String(c).toLowerCase()));
      if(snap.exists())return {id:snap.id,...snap.data()};
    }catch(e){}
  }
  return null;
}
function item(title,meta='',actions=''){
  return `<div class="item"><div class="item-row"><div><div class="item-title">${title}</div>${meta?`<div class="item-meta">${meta}</div>`:''}</div><div class="item-actions">${actions}</div></div></div>`;
}
async function safeGet(q){
  try{return await getDocs(q)}catch(e){console.warn('Admin dashboard query failed:',e);return null}
}

async function loadOverview(){
  try{
    if(!window.__azOverviewLoadingOnlineUsers && typeof loadOnlineUsers === 'function'){
      window.__azOverviewLoadingOnlineUsers = true;
      await loadOnlineUsers();
      window.__azOverviewLoadingOnlineUsers = false;
    }
  }catch(e){
    window.__azOverviewLoadingOnlineUsers = false;
    console.warn('Overview online users preload skipped:', e);
  }

  const users=await safeGet(query(collection(db,'users'),limit(50)));
  const online=await safeGet(query(collection(db,'onlineUsers'),limit(50)));
  const logins=await safeGet(query(collection(db,'loginHistory'),orderBy('createdAtMs','desc'),limit(200)));
  const guests=await safeGet(query(collection(db,'guestHistory'),orderBy('createdAtMs','desc'),limit(200)));
  const support=await safeGet(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)));
  const notif=await safeGet(query(collection(db,'notifications'),where('active','==',true),orderBy('createdAtMs','desc'),limit(50)));
  const purchases=await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(50)));

  function azAdminOverviewMs(x){
    if(!x) return 0;
    if(typeof x === 'number') return x;
    if(typeof x === 'string'){
      const n = Date.parse(x);
      return Number.isNaN(n) ? 0 : n;
    }
    if(x && typeof x.toDate === 'function'){
      const d = x.toDate();
      return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    }
    return 0;
  }
  function azAdminOverviewTodayCount(snap){
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    let count = 0;
    snap?.forEach(d=>{
      const x = d.data ? d.data() : d;
      const ms = azAdminOverviewMs(x.createdAtMs || x.timeMs || x.updatedAtMs || x.createdAt || x.time || x.updatedAt);
      if(ms >= start && ms < end) count++;
    });
    return count;
  }
  function azAdminOverviewMonthCount(snap){
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1).getTime();
    let count = 0;
    snap?.forEach(d=>{
      const x = d.data ? d.data() : d;
      const ms = azAdminOverviewMs(x.createdAtMs || x.timeMs || x.updatedAtMs || x.createdAt || x.time || x.updatedAt);
      if(ms >= start && ms < end) count++;
    });
    return count;
  }

  $('#statUsers').textContent=users?.size??0;
  $('#statOnline').textContent=String(window.azAdminRealOnlineCount || 0);
  $('#statLogins').textContent=azAdminOverviewTodayCount(logins);
  $('#statVisits').textContent=azAdminOverviewTodayCount(guests);
  let openSupportCount=0;
  support?.forEach(d=>{const x=d.data(); const status=String(x.status||'open').toLowerCase(); const reply=String(x.reply||'').trim(); if(status==='open' || !reply) openSupportCount++;});
  let pendingPurchaseCount=0;
  purchases?.forEach(d=>{const x=d.data(); const status=String(x.status||'').toLowerCase(); if(!status || status==='pending' || status==='unpaid' || status==='waiting') pendingPurchaseCount++;});
  $('#statSupport').textContent=openSupportCount;
  $('#statNotifications').textContent=notif?.size??0;
  $('#statPurchases').textContent=pendingPurchaseCount;
  $('#statGuests').textContent=azAdminOverviewMonthCount(guests);

  const supportRows=[];
  support?.forEach(d=>{if(supportRows.length<5){const x=d.data();supportRows.push(item(esc(x.subject||'Support Request'),`${esc(x.email||'')} • ${esc(x.status||'open')}`))}});
  $('#overviewSupport').innerHTML=supportRows.join('')||'<div class="item">No support messages.</div>';

  const activityRows=[];
  logins?.forEach(d=>{if(activityRows.length<5){const x=d.data();activityRows.push(item(esc(x.username||x.email||'Login'),`${esc(x.email||'')} • ${fmtDate(x.createdAtMs||x.createdAt)}`))}});
  $('#overviewActivity').innerHTML=activityRows.join('')||'<div class="item">No activity.</div>';

  try{ if(window.azSetRealOnlineCount) window.azSetRealOnlineCount(window.azAdminRealOnlineCount || 0); }catch(e){}

}

async function loadUsers(){ return; }

async function loadSupport(){
  const snap=await safeGet(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)));
  const rows=[];
  snap?.forEach(d=>{
    const x=d.data();
    rows.push(`<div class="item">
      <div class="item-row"><div><div class="item-title">${esc(x.subject||'Support Request')}</div><div>${esc(x.message||'')}</div>${x.reply?`<div class="item-meta ok">Reply: ${esc(x.reply)}</div>`:''}<div class="item-meta">${esc(x.email||'')} • ${esc(x.status||'open')} • ${fmtDate(x.createdAtMs||x.createdAt)}</div></div><div class="item-actions"><button class="btn red" data-del-support="${d.id}">Delete</button></div></div>
      <div class="toolbar"><input id="reply_${d.id}" placeholder="Reply..." style="flex:1"><button class="btn green" data-reply-support="${d.id}">Reply</button></div>
    </div>`);
  });
  $('#supportList').innerHTML=rows.join('')||'<div class="item">No support messages.</div>';
}
async function loadNotifications(){
  let snap=await safeGet(query(collection(db,'notifications'),where('active','==',true),orderBy('createdAtMs','desc'),limit(50)));
  if(!snap)snap=await safeGet(query(collection(db,'notifications'),limit(50)));
  const rows=[];
  snap?.forEach(d=>{const x=d.data();if(x.active!==true)return;rows.push(item(esc(x.title||'Notification'),`${esc(x.body||'')} • ${esc(x.type||'system')} • ${fmtDate(x.createdAtMs||x.createdAt)}`,`<button class="btn red" data-del-notif="${d.id}">Delete</button>`))});
  $('#notificationsList').innerHTML=rows.join('')||'<div class="item">No notifications available.</div>';
}

async function loadPayments(){
  const filter = ($('#paymentCategoryFilter')?.value || 'all').toLowerCase();
  let logs = await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(100)));
  const records = [];

  logs?.forEach(d=>{
    const x = {id:d.id, ...d.data()};
    const typeRaw = String(x.productType || x.category || x.source || x.itemType || x.type || '').toLowerCase();
    const nameRaw = String(x.title || x.name || x.itemName || x.filename || x.itemCode || '').toLowerCase();
    const hay = typeRaw + ' ' + nameRaw;

    let category = 'Others';
    if(hay.includes('pa') || hay.includes('bm') || hay.includes('pabm') || hay.includes('lot') || hay.includes('kadaster')) category = 'PA/BM';
    else if(hay.includes('cad') || hay.includes('lisp') || hay.includes('autocad')) category = 'CAD Tools';
    else if(hay.includes('software') || hay.includes('license') || hay.includes('download')) category = 'Software';

    const amount = Number(x.amount || x.total || x.totalAmount || x.price || x.paymentAmount || 0) || 0;
    const status = String(x.status || x.paymentStatus || '').toLowerCase();
    const paid = ['paid','verified','success','completed','approved','confirmed'].includes(status);
    const pending = !paid && (!status || ['pending','unpaid','waiting','manual','review'].includes(status));

    records.push({...x, category, amount, paid, pending});
  });

  const totals = {pabm:0, software:0, cad:0, all:0, pending:0, paid:0};
  records.forEach(x=>{
    totals.all += x.amount;
    if(x.category === 'PA/BM') totals.pabm += x.amount;
    if(x.category === 'Software') totals.software += x.amount;
    if(x.category === 'CAD Tools') totals.cad += x.amount;
    if(x.pending) totals.pending++;
    if(x.paid) totals.paid++;
  });

  if($('#payTotalPABM')) $('#payTotalPABM').textContent = totals.pabm.toFixed(2);
  if($('#payTotalSoftware')) $('#payTotalSoftware').textContent = totals.software.toFixed(2);
  if($('#payTotalCAD')) $('#payTotalCAD').textContent = totals.cad.toFixed(2);
  if($('#payTotalAll')) $('#payTotalAll').textContent = totals.all.toFixed(2);
  if($('#payPendingCount')) $('#payPendingCount').textContent = totals.pending;
  if($('#payPaidCount')) $('#payPaidCount').textContent = totals.paid;
  if($('#payRecordCount')) $('#payRecordCount').textContent = records.length;

  const filtered = records.filter(x=>{
    if(filter === 'all') return true;
    if(filter === 'pabm') return x.category === 'PA/BM';
    if(filter === 'software') return x.category === 'Software';
    if(filter === 'cad') return x.category === 'CAD Tools';
    if(filter === 'pending') return x.pending;
    if(filter === 'paid') return x.paid;
    return true;
  }).slice(0,50);

  const rows = filtered.map(x=>{
    const statusText = esc(x.status || x.paymentStatus || (x.paid ? 'paid' : 'pending'));
    const buyer = esc(x.usernameKey || x.username || x.displayName || x.email || '-');
    const itemName = esc(x.title || x.name || x.itemName || x.filename || x.itemCode || x.productType || 'Purchase');
    return item(
      `${esc(x.category)} • RM${Number(x.amount || 0).toFixed(2)}`,
      `${buyer} • ${itemName} • Status: ${statusText} • ${fmtDate(x.createdAtMs||x.createdAt)}`
    );
  });

  $('#paymentsList').innerHTML = rows.join('') || '<div class="item">No payment records found.</div>';
}

async function loadPurchases(){
  const logs=await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(50)));
  const sums=await safeGet(query(collection(db,'purchaseSummaries'),limit(50)));
  const lr=[]; logs?.forEach(d=>{const x=d.data();lr.push(item(esc(x.usernameKey||x.username||x.email||d.id),`${esc(x.productType||x.itemCode||'Purchase')} • ${esc(x.status||'')} • RM${esc(x.amount||x.total||'')} • ${fmtDate(x.createdAtMs||x.createdAt)}`))});
  const sr=[]; sums?.forEach(d=>{const x=d.data();sr.push(item(esc(d.id),`Total: RM${esc(x.totalAmount||x.total||0)} • Unit: ${esc(x.totalUnit||x.unit||0)}`))});
  $('#purchaseLogsList').innerHTML=lr.join('')||'<div class="item">No purchase logs.</div>';
  $('#purchaseSummariesList').innerHTML=sr.join('')||'<div class="item">No purchase summaries.</div>';
}

async function loadStaffRoles(){
  const snap = await safeGet(query(collection(db,'users'),limit(100)));
  const rows = [];
  const permList = [
    ['canManageSoftware','💻','Software'],
    ['canManageCAD','📐','CAD'],
    ['canViewPayments','💳','View Payments'],
    ['canApprovePayment','✅','Approve Payment'],
    ['canEditUsers','👥','Edit Users']
  ];
  function roleLabel(r){
    r=String(r||'user').toLowerCase();
    if(r==='admin')return 'Admin';
    if(r==='semiadmin'||r==='semi-admin')return 'Semi Admin';
    if(r==='staff')return 'Staff';
    return 'User';
  }
  function badgeHtml(perms){
    perms=perms||{};
    return '<div class="staff-role-badges">'+permList.map(([key,icon,label])=>{
      const on=perms[key]===true;
      return `<span class="staff-role-badge ${on?'':'off'}">${icon} ${on?'✅':'❌'} ${label}</span>`;
    }).join('')+'</div>';
  }
  snap?.forEach(d=>{
    const x=d.data()||{};
    const role=String(x.role||'member').toLowerCase();
    if(!['admin','semiadmin','semi-admin','staff'].includes(role) && !x.permissions) return;
    rows.push(`<div class="staff-role-card" data-staff-username="${esc(d.id)}">
      <div class="staff-role-name">👤 ${esc(d.id)}</div>
      <div class="staff-role-meta">Role: <b>${esc(roleLabel(role))}</b></div>
      ${badgeHtml(x.permissions||{})}
      <div class="staff-role-actions">
        <button class="staff-role-edit" data-staff-edit="${esc(d.id)}">✏️ Edit</button>
        <button class="staff-role-reset" data-staff-reset="${esc(d.id)}">↩️ Reset User</button>
      </div>
    </div>`);
  });
  $('#staffRolesList').classList.add('staff-role-list');
  $('#staffRolesList').innerHTML=rows.join('')||'<div class="staff-role-card">No staff users found.</div>';
}

async function resetStaffRoleToUser(username){
  if(!confirm('Reset role '+username+' kepada user biasa?')) return;
  await updateDoc(doc(db,'users',username),{role:'user',permissions:{}});
  await loadStaffRoles();
}
function fillStaffRoleForm(username){
  const card=document.querySelector(`[data-staff-username="${CSS.escape(username)}"]`);
  const input=$('#staffUsername');
  if(input) input.value=username;
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
  const edit=e.target.closest('[data-staff-edit]');
  if(edit) fillStaffRoleForm(edit.getAttribute('data-staff-edit'));
  const reset=e.target.closest('[data-staff-reset]');
  if(reset) resetStaffRoleToUser(reset.getAttribute('data-staff-reset'));
});

async function saveStaffRole(){
  const username=String($('#staffUsername')?.value||'').trim().toLowerCase();
  if(!username) return alert('Enter username.');
  const role=$('#staffRole')?.value||'semiAdmin';
  const permissions={canManageSoftware:!!$('#permSoftware')?.checked,canManageCAD:!!$('#permCAD')?.checked,canViewPayments:!!$('#permPayments')?.checked,canApprovePayment:!!$('#permApprove')?.checked,canEditUsers:false};
  await updateDoc(doc(db,'users',username),{role,permissions,updatedAt:serverTimestamp(),updatedByAdmin:'admin-dashboard'});
  await loadStaffRoles();
  alert('Staff role saved.');
}


let adminCommissionCache = [];

function commissionRecordTitle(x){
  return esc(x.username || x.ownerUsername || x.createdByUsername || x.email || x.ownerEmail || 'Unknown');
}
function commissionAmountOf(x){
  return Number(x.commissionAmount || x.amount || x.totalCommission || 0) || 0;
}
function commissionSaleAmountOf(x){
  return Number(x.saleAmount || x.orderAmount || x.totalSale || 0) || 0;
}
function commissionPayoutStatus(x){
  return String(x.payoutStatus || x.status || 'pending').toLowerCase() || 'pending';
}
function commissionStatusBucket(x){
  const s = commissionPayoutStatus(x);
  if(['paid','settled','released'].includes(s)) return 'paid';
  if(['approved'].includes(s)) return 'approved';
  if(['rejected','cancelled','void'].includes(s)) return 'rejected';
  return 'pending';
}
function commissionStatusBadge(status){
  const s=String(status||'pending').toLowerCase();
  if(s==='paid') return '✅ paid';
  if(s==='approved') return '🟦 approved';
  if(s==='rejected') return '⛔ rejected';
  return '⏳ pending';
}
async function fetchAdminCommissionsFromApi(){
  adminApiNotice = '';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/status?records=1&limit=300',{cache:'no-store'});
    return Array.isArray(j.records)?j.records:[];
  }catch(e){
    adminApiNotice = e?.message || 'Commission backend API fallback failed.';
    console.warn('Admin commission API fallback failed',e);
    return [];
  }
}
function resetCommissionForm(){
  $('#commissionEditDocId').value = '';
  $('#commissionUsername').value = '';
  $('#commissionProduct').value = '';
  $('#commissionAmount').value = '';
  $('#commissionStatus').value = 'pending';
  $('#commissionOwnerUid').value = '';
  $('#commissionOwnerUsername').value = '';
  $('#commissionOwnerEmail').value = '';
  $('#commissionNote').value = '';
  if($('#commissionFormTitle')) $('#commissionFormTitle').textContent = 'Add / Edit Commission';
}
function renderAdminCommissions(){
  let total=0,pending=0,approved=0,paid=0,rejected=0;
  adminCommissionCache.forEach(x=>{
    const amt=commissionAmountOf(x);
    total += amt;
    const bucket=commissionStatusBucket(x);
    if(bucket==='paid') paid += amt;
    else if(bucket==='approved') approved += amt;
    else if(bucket==='rejected') rejected += amt;
    else pending += amt;
  });
  if($('#adminComTotal')) $('#adminComTotal').textContent = total.toFixed(2);
  if($('#adminComPending')) $('#adminComPending').textContent = pending.toFixed(2);
  if($('#adminComApproved')) $('#adminComApproved').textContent = approved.toFixed(2);
  if($('#adminComPaid')) $('#adminComPaid').textContent = paid.toFixed(2);
  if($('#adminComRejected')) $('#adminComRejected').textContent = rejected.toFixed(2);
  if($('#adminComCount')) $('#adminComCount').textContent = adminCommissionCache.length;

  const filter=String($('#commissionPayoutFilter')?.value||'all').toLowerCase();
  const filtered=adminCommissionCache.filter(x=>filter==='all'||commissionStatusBucket(x)===filter);
  const rows = filtered.map(x=>{
    const amt = commissionAmountOf(x).toFixed(2);
    const sale = commissionSaleAmountOf(x);
    const owner = commissionRecordTitle(x);
    const product = esc(x.productName || x.product || x.productTitle || x.itemName || x.saleRef || '-');
    const statusRaw = commissionPayoutStatus(x);
    const status = esc(statusRaw || 'pending');
    const type = esc(x.commissionType || x.type || 'commission');
    const source = esc(x._source || '');
    const docId = esc(x.docId || '');
    const payoutMeta = [x.payoutReference?('Ref: '+esc(x.payoutReference)):'', x.payoutMethod?('Method: '+esc(x.payoutMethod)):'', x.payoutNote?('Note: '+esc(x.payoutNote)):''].filter(Boolean).join(' • ');
    return `<div class="item">
      <div class="item-title">💸 ${owner} • Commission RM${amt} • ${commissionStatusBadge(statusRaw)}</div>
      <div class="item-meta">${product} • Sale ${sale?('RM'+sale.toFixed(2)):'-'} • ${type} • Status: ${status} • ${fmtDate(x.createdAtMs||x.createdAt)} ${source?('• '+source):''}${payoutMeta?(' • '+payoutMeta):''}</div>
      <div class="toolbar" style="margin:6px 0 0">
        <button class="btn" data-commission-payout="approved" data-commission-doc="${docId}">Approve</button>
        <button class="btn green" data-commission-payout="paid" data-commission-doc="${docId}">Mark Paid</button>
        <button class="btn red" data-commission-payout="rejected" data-commission-doc="${docId}">Reject</button>
        <button class="btn gray" data-commission-payout="pending" data-commission-doc="${docId}">Pending</button>
        <button class="btn gray" data-edit-commission="${docId}">Edit</button>
        <button class="btn red" data-delete-commission="${docId}">Delete</button>
      </div>
    </div>`;
  });
  const notice = adminApiNotice ? `<div class="item"><div class="item-title">⚠️ Backend API notice</div><div class="item-meta">${esc(adminApiNotice)}</div></div>` : '';
  $('#adminCommissionList').innerHTML = rows.join('') || notice || '<div class="item">No commission records.</div>';
}
async function loadAdminCommissions(){
  const snap = await safeGet(query(collection(db,'commissionRecords'), orderBy('createdAtMs','desc'), limit(200)));
  adminCommissionCache = [];
  const seen=new Set();
  snap?.forEach(d=>{
    const x={docId:d.id,...d.data(),_source:'firestore'};
    const key=x.docId||`${x.orderId||''}_${x.commissionType||''}_${x.username||''}`;
    if(!seen.has(key)){seen.add(key);adminCommissionCache.push(x);}
  });
  if(!adminCommissionCache.length){
    const apiRows=await fetchAdminCommissionsFromApi();
    apiRows.forEach((x,i)=>{
      const key=x.docId||x.id||`${x.orderId||''}_${x.commissionType||''}_${x.username||''}`||String(i);
      if(!seen.has(key)){seen.add(key);adminCommissionCache.push({...x,_source:'backend-api'});}
    });
  }
  renderAdminCommissions();
}
async function updateCommissionPayoutStatus(docId,status){
  if(!docId) return toast('Missing commission record ID.');
  const label=String(status||'').toUpperCase();
  if(!confirm('Update this commission payout status to '+label+'?')) return;
  let payoutReference='';
  let payoutMethod='';
  let payoutNote='';
  if(status==='paid'){
    payoutReference = prompt('Payment/reference number (optional):','') || '';
    payoutMethod = prompt('Payout method (optional, e.g. bank transfer):','') || '';
  }
  if(status==='rejected') payoutNote = prompt('Reason / note for rejection (optional):','') || '';
  if(status==='approved') payoutNote = prompt('Approval note (optional):','') || '';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/payout-status',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({docId,payoutStatus:status,payoutReference,payoutMethod,payoutNote})
    });
    toast('Commission payout updated: '+(j.payoutStatus||status));
    await loadAdminCommissions();
  }catch(e){
    toast(e?.message || 'Failed to update commission payout status.');
  }
}
function exportCommissionCsv(){
  const rows=adminCommissionCache.map(x=>({
    docId:x.docId||'', orderId:x.orderId||'', billCode:x.billCode||'', username:x.username||x.ownerUsername||'', product:x.productName||x.product||'', commissionType:x.commissionType||'', saleAmount:commissionSaleAmountOf(x), commissionAmount:commissionAmountOf(x), payoutStatus:commissionPayoutStatus(x), payoutReference:x.payoutReference||'', payoutMethod:x.payoutMethod||'', payoutNote:x.payoutNote||'', createdAt:x.createdAt||x.createdAtMs||''
  }));
  const headers=['docId','orderId','billCode','username','product','commissionType','saleAmount','commissionAmount','payoutStatus','payoutReference','payoutMethod','payoutNote','createdAt'];
  const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>'"'+String(r[h]??'').replace(/"/g,'""')+'"').join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='azobss-commission-records-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function saveCommissionRecord(){
  const docId = $('#commissionEditDocId')?.value || '';
  const amount = Number($('#commissionAmount')?.value || 0);
  const payload = {
    username: $('#commissionUsername')?.value.trim() || '',
    product: $('#commissionProduct')?.value.trim() || '',
    amount,
    status: $('#commissionStatus')?.value || 'pending',
    payoutStatus: $('#commissionStatus')?.value || 'pending',
    note: $('#commissionNote')?.value.trim() || '',
    ownerUid: $('#commissionOwnerUid')?.value.trim() || '',
    ownerUsername: $('#commissionOwnerUsername')?.value.trim() || $('#commissionUsername')?.value.trim() || '',
    ownerEmail: $('#commissionOwnerEmail')?.value.trim() || '',
    ownerShare: 70,
    platformShare: 30,
    commissionRate: 70,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now()
  };
  if(docId){
    await updateDoc(doc(db,'commissionRecords',docId), payload);
    azAdminLogAction('commission_record_update','commissionRecords',docId,{username:payload.username, product:payload.product, amount:payload.amount, status:payload.status});
  }else{
    const added=await addDoc(collection(db,'commissionRecords'), {...payload, createdAt: serverTimestamp(), createdAtMs: Date.now(), createdByAdmin: 'admin-dashboard'});
    azAdminLogAction('commission_record_create','commissionRecords',added.id,{username:payload.username, product:payload.product, amount:payload.amount, status:payload.status});
  }
  resetCommissionForm();
  await loadAdminCommissions();
}
function editCommissionRecord(docId){
  const x = adminCommissionCache.find(r=>r.docId===docId);
  if(!x) return;
  $('#commissionEditDocId').value = x.docId;
  $('#commissionUsername').value = x.username || x.ownerUsername || '';
  $('#commissionProduct').value = x.productName || x.product || x.productTitle || x.itemName || x.saleRef || '';
  $('#commissionAmount').value = commissionAmountOf(x);
  $('#commissionStatus').value = x.payoutStatus || x.status || 'pending';
  $('#commissionOwnerUid').value = x.ownerUid || '';
  $('#commissionOwnerUsername').value = x.ownerUsername || x.username || '';
  $('#commissionOwnerEmail').value = x.ownerEmail || '';
  $('#commissionNote').value = x.note || '';
  if($('#commissionFormTitle')) $('#commissionFormTitle').textContent = 'Editing Commission';
}
async function deleteCommissionRecord(docId){
  if(!confirm('Delete this commission record?')) return;
  await deleteDoc(doc(db,'commissionRecords',docId));
  azAdminLogAction('commission_record_delete','commissionRecords',docId,{});
  await loadAdminCommissions();
}


let adminActivityCache = [];
let adminActivityPage = 1;
const ADMIN_ACTIVITY_PAGE_SIZE = 10;

function azActivityType(x){
  const raw = String(x.type || x.event || x.action || x.category || x.collection || '').toLowerCase();
  const text = String(JSON.stringify(x)).toLowerCase();
  if(raw.includes('payment') || text.includes('payment') || text.includes('purchase')) return ['💳 Payment','az-act-payment'];
  if(raw.includes('software') || text.includes('softwaretools') || text.includes('software')) return ['🔵 Software','az-act-software'];
  if(raw.includes('cad') || text.includes('cadtools') || text.includes('lisp')) return ['🟣 CAD','az-act-cad'];
  if(raw.includes('commission') || text.includes('commission')) return ['🟡 Commission','az-act-commission'];
  if(raw.includes('login') || text.includes('login')) return ['🟢 Login','az-act-login'];
  return ['⚪ Activity','az-act-default'];
}
function azActivityUsername(x){
  return x.username || x.usernameKey || x.ownerUsername || x.createdByUsername || x.email || x.userEmail || x.uid || x.ownerUid || 'Unknown';
}
function azActivityTitle(x){
  return x.title || x.product || x.productTitle || x.itemName || x.action || x.event || x.type || x.message || 'Activity';
}
function azActivitySub(x){
  const parts = [x.status, x.amount ? ('RM'+x.amount) : '', x.productId, x.note].filter(Boolean);
  return parts.join(' • ') || (x.collection || x.source || '');
}
function azActivityTime(x){
  const ms = Number(x.createdAtMs || x.updatedAtMs || x.timestampMs || x.timeMs || 0);
  if(ms) return new Date(ms).toLocaleString();
  try{
    if(x.createdAt?.seconds) return new Date(x.createdAt.seconds*1000).toLocaleString();
    if(x.updatedAt?.seconds) return new Date(x.updatedAt.seconds*1000).toLocaleString();
  }catch(e){}
  return '';
}
function azActivityMatches(x, q){
  if(!q) return true;
  return JSON.stringify(x).toLowerCase().includes(q);
}
function renderAdminActivity(){
  const list = $('#activityList') || $('#adminActivityList') || $('#activityRecords');
  const info = $('#activityPageInfo');
  if(!list) return;
  const q = String($('#activitySearch')?.value || '').toLowerCase().trim();
  const filtered = adminActivityCache.filter(x => azActivityMatches(x,q));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_ACTIVITY_PAGE_SIZE));
  adminActivityPage = Math.min(Math.max(1, adminActivityPage), totalPages);
  const start = (adminActivityPage - 1) * ADMIN_ACTIVITY_PAGE_SIZE;
  const pageItems = filtered.slice(start, start + ADMIN_ACTIVITY_PAGE_SIZE);

  list.classList.add('az-activity-list');
  list.innerHTML = pageItems.map(x=>{
    const [label, cls] = azActivityType(x);
    return `<div class="az-activity-row az-admin-mini-record">
      <span class="az-activity-badge az-admin-mini-label ${cls}">${label}</span>
      <div class="az-activity-main az-admin-mini-main">
        <div class="az-activity-title az-admin-mini-title">${esc(azActivityUsername(x))} — ${esc(azActivityTitle(x))}</div>
        <div class="az-activity-sub az-admin-mini-sub">${esc(azActivitySub(x))}</div>
      </div>
      <div class="az-activity-time az-admin-mini-time">${esc(azActivityTime(x))}</div>
    </div>`;
  }).join('') || '<div class="az-activity-row az-admin-mini-record"><div class="az-activity-main az-admin-mini-main"><div class="az-activity-title">No activity found.</div></div></div>';

  if(info) info.textContent = `Page ${adminActivityPage} / ${totalPages} • ${filtered.length} records`;
  if($('#activityPrevBtn')) $('#activityPrevBtn').disabled = adminActivityPage <= 1;
  if($('#activityNextBtn')) $('#activityNextBtn').disabled = adminActivityPage >= totalPages;
}

const AZ_ADMIN_ONLINE_COLLECTION = 'onlineUsers';
const AZ_ADMIN_ONLINE_MAX_IDLE_MS = 10 * 60 * 1000;
function azAdminToMs(v){
  if(!v)return 0;
  if(typeof v==='number')return v;
  if(v.seconds)return v.seconds*1000;
  const n=Number(v); if(!Number.isNaN(n)&&n>0)return n;
  const d=Date.parse(v); return Number.isNaN(d)?0:d;
}
function azAdminOnlineSeenMs(x){
  return azAdminToMs(x.lastSeenMs||x.lastSeenAtMs||x.seenAtMs||x.updatedAtMs||x.timestampMs||x.lastActiveMs||x.lastSeen||x.seenAt||x.updatedAt||x.timestamp||x.createdAt);
}
function azAdminOnlineIsActive(x){
  const status=String(x.status||x.state||'').toLowerCase();
  const flag=x.online===true||x.isOnline===true||status==='online'||status==='active';
  if(!flag)return false;
  const ms=azAdminOnlineSeenMs(x);
  if(ms && (Date.now()-ms)>AZ_ADMIN_ONLINE_MAX_IDLE_MS)return false;
  return true;
}
function azAdminOnlineName(x){return x.username||x.usernameKey||x.name||x.displayName||x.email||x.userEmail||x.uid||'Unknown';}
function azAdminOnlineEmail(x){return x.email||x.userEmail||x.authEmail||'';}
function azAdminOnlineSeenText(x){const ms=azAdminOnlineSeenMs(x);return ms?new Date(ms).toLocaleString():'-';}
async function loadOnlineUsers(){
  const box=$('#onlineUsersList')||$('#onlineList')||$('#adminOnlineUsersList');
  if(!box)return;
  const rows=[];
  try{
    const snap=await safeGet(query(collection(db,AZ_ADMIN_ONLINE_COLLECTION),limit(100)));
    snap?.forEach(d=>{const x={docId:d.id,...d.data()}; if(azAdminOnlineIsActive(x))rows.push(x);});
  }catch(e){console.warn('online users load failed',e);}
  rows.sort((a,b)=>azAdminOnlineSeenMs(b)-azAdminOnlineSeenMs(a));
  box.classList.add('az-admin-mini-records');
  box.innerHTML=rows.map(x=>`<div class="az-admin-mini-record">
    <span class="az-admin-mini-label az-act-login">🟢 Online</span>
    <div class="az-admin-mini-main">
      <div class="az-admin-mini-title">${esc(azAdminOnlineName(x))}</div>
      <div class="az-admin-mini-sub">${esc(azAdminOnlineEmail(x))} • Status: online</div>
    </div>
    <div class="az-admin-mini-time">${esc(azAdminOnlineSeenText(x))}</div>
  </div>`).join('')||'<div class="az-admin-mini-record"><div class="az-admin-mini-main"><div class="az-admin-mini-title">No users online now.</div><div class="az-admin-mini-sub">Mengikut logic PA/BM + anti stale.</div></div></div>';

  try{
    const renderedRows = Array.from((box && box.children) || []);
    const onlineKeys = new Set();
    renderedRows.forEach(row=>{
      const t = String(row.textContent || '').trim();
      if(!t || /no users|no online/i.test(t)) return;
      if(/\bguest\b/i.test(t)) return;
      if(!/\bonline\b/i.test(t) && !/status:\s*online/i.test(t)) return;
      const strong = row.querySelector('strong');
      const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      const key = String((strong && strong.textContent) || (email && email[0]) || t).trim().toLowerCase();
      if(key && key !== 'guest') onlineKeys.add(key);
    });
    if(window.azSetRealOnlineCount) window.azSetRealOnlineCount(onlineKeys.size);
  }catch(e){}

}
function loadOnline(){return loadOnlineUsers();}


let adminRegisteredUsersCache=[];
let adminRegisteredUsersPage=1;
const ADMIN_REGISTERED_PAGE_SIZE=10;
function azRegMs(v){
  if(!v)return 0;
  if(typeof v==='number')return v;
  if(v.seconds)return v.seconds*1000;
  const n=Number(v); if(!Number.isNaN(n)&&n>0)return n;
  const d=Date.parse(v); return Number.isNaN(d)?0:d;
}
function azRegTime(x){
  const ms=azRegMs(x.createdAtMs||x.registeredAtMs||x.updatedAtMs||x.createdAt||x.registeredAt||x.updatedAt);
  return ms?new Date(ms).toLocaleString():'-';
}
function azRegUser(x){
  return x.usernameKey||x.username||x.name||x.displayName||x.email||x.uid||'Unknown';
}
function azRegSub(x){
  return [x.email||x.authEmail||'', x.phone||x.phoneNumber||'', x.role?('Role: '+x.role):''].filter(Boolean).join(' • ');
}
function azRegPaAllowed(x){
  const managed = x?.adminPaBmOverride === true || String(x?.paBmManagedBy || '').toLowerCase() === 'admin';
  if(managed){
    return x.adminPaBmAllowed === true;
  }
  return x.paBmAllowed===true||x.paAccessAllowed===true||x.allowPABM===true||x.allowPaBm===true||x.canAccessPaBm===true||x.showPaBmTab===true||x.permissions?.paBmAllowed===true;
}
function azRegRole(x){return String(x.role||'member').trim().toLowerCase().replace(/[^a-z]/g,'');}
function azRegNameEmail(x){return String((azRegUser(x)||'')+' '+(x.email||x.authEmail||'')).toLowerCase();}
function azRegIsOnline(x){
  const online = x.online===true || x.isOnline===true || x.loggedIn===true || String(x.status||'').toLowerCase()==='online';
  const seen = azRegMs(x.lastSeenAtMs||x.lastActiveAtMs||x.lastLoginAtMs||x.updatedAtMs||x.lastSeenAt||x.lastActiveAt||x.updatedAt);
  return online || (seen && (Date.now()-seen) < 10*60*1000);
}
function azRegDateValue(x){return azRegMs(x.createdAtMs||x.registeredAtMs||x.createdAt||x.registeredAt||x.updatedAtMs||x.updatedAt);}
function azRegSortFilter(rows){
  const mode=String($('#registeredUsersSort')?.value||'newest').toLowerCase();
  let out=[...rows];
  if(mode==='online') out=out.filter(azRegIsOnline);
  else if(mode==='pabm') out=out.filter(azRegPaAllowed);
  else if(mode.startsWith('role-')){
    const want=mode.replace('role-','');
    out=out.filter(x=>azRegRole(x)===want);
  }
  if(mode==='oldest') out.sort((a,b)=>azRegDateValue(a)-azRegDateValue(b));
  else if(mode==='az') out.sort((a,b)=>azRegNameEmail(a).localeCompare(azRegNameEmail(b)));
  else out.sort((a,b)=>azRegDateValue(b)-azRegDateValue(a));
  return out;
}
function renderRegisteredUsersAdmin(){
  const box=$('#registeredUsersAdminList'); if(!box)return;
  const q=String($('#registeredUsersSearch')?.value||'').toLowerCase().trim();
  const rows=azRegSortFilter(adminRegisteredUsersCache.filter(x=>!q||JSON.stringify(x).toLowerCase().includes(q)));
  const totalPages=Math.max(1,Math.ceil(rows.length/ADMIN_REGISTERED_PAGE_SIZE));
  adminRegisteredUsersPage=Math.min(Math.max(1,adminRegisteredUsersPage),totalPages);
  const start=(adminRegisteredUsersPage-1)*ADMIN_REGISTERED_PAGE_SIZE;
  const page=rows.slice(start,start+ADMIN_REGISTERED_PAGE_SIZE);
  box.innerHTML=page.map(x=>{
    const id=esc(x.docId||azRegUser(x));
    const pa=azRegPaAllowed(x);
    return `<div class="az-admin-reg-row">
      
      <div>
        <div class="az-admin-reg-title">${esc(azRegUser(x))}</div>
        <div class="az-admin-reg-sub">${esc(azRegSub(x))} • ${pa?'PA/BM allowed':'PA/BM off'}</div>
      </div>
      <div class="az-admin-reg-time">${esc(azRegTime(x))}</div>
      <div class="az-reg-actions"><button class="az-reg-edit" data-reg-edit="${id}">Edit</button><button class="az-reg-delete" data-reg-delete="${id}">Delete</button></div>
    </div>`;
  }).join('')||'<div class="az-admin-reg-row"><div><div class="az-admin-reg-title">No registered users found.</div></div></div>';
  if($('#registeredUsersPageInfo'))$('#registeredUsersPageInfo').textContent=`Page ${adminRegisteredUsersPage} / ${totalPages} • ${rows.length} records`;
  if($('#registeredUsersPrevBtn'))$('#registeredUsersPrevBtn').disabled=adminRegisteredUsersPage<=1;
  if($('#registeredUsersNextBtn'))$('#registeredUsersNextBtn').disabled=adminRegisteredUsersPage>=totalPages;
}
function openRegisteredEdit(id){
  const x=adminRegisteredUsersCache.find(r=>String(r.docId)===String(id)||String(azRegUser(r))===String(id));
  if(!x)return toast('User not found.');
  $('#azRegEditDocId').value=x.docId||azRegUser(x);
  $('#azRegEditUsername').value=azRegUser(x);
  $('#azRegEditEmail').value=x.email||x.authEmail||'';
  $('#azRegEditPhone').value=x.phone||x.phoneNumber||'';
  $('#azRegEditRole').value=x.role||'member';
  $('#azRegEditPa').value=azRegPaAllowed(x)?'true':'false';
  $('#azRegEditModal')?.classList.add('is-open');
}
async function saveRegisteredEdit(){
  const id=$('#azRegEditDocId')?.value||'';
  if(!id)return;
  const pa=$('#azRegEditPa')?.value==='true';
  const code = pa ? 'ZX6186' : '';
  await updateDoc(doc(db,'users',id),{
    email:$('#azRegEditEmail')?.value.trim()||'',
    phoneNumber:$('#azRegEditPhone')?.value.trim()||'',
    phone:$('#azRegEditPhone')?.value.trim()||'',
    role:$('#azRegEditRole')?.value||'member',

    // Admin Dashboard is the source of truth for PA/BM access.
    adminPaBmOverride:true,
    adminPaBmAllowed:pa,
    paBmManagedBy:'admin',

    // Keep every old PA/BM flag aligned so no old script can turn it back on.
    paBmAllowed:pa,
    paAccessAllowed:pa,
    paBmAccess:pa,
    allowPABM:pa,
    allowPaBm:pa,
    allowPabm:pa,
    allowPaBmTab:pa,
    paBmTabAllowed:pa,
    paBmTab:pa,
    canAccessPaBm:pa,
    showPaBmTab:pa,
    paAccess:pa?'yes':'no',
    pa_bm_access:pa?'yes':'no',
    pa_bm_allowed:pa,
    allow_pa_bm:pa,

    // Clear old invite/code fields when OFF; otherwise old code makes it Allowed again.
    inviteCode:code,
    inviteCodeUsed:code,
    invitedByCode:code,
    memberCode:code,
    paMemberCode:code,
    accessCode:code,
    signupCode:code,
    member_code:code,
    referralCode:code,

    updatedAt:serverTimestamp(),updatedAtMs:Date.now(),updatedByAdmin:'admin-dashboard'
  });
  $('#azRegEditModal')?.classList.remove('is-open');
  await loadRegisteredUsersAdmin();

}
async function deleteRegisteredUser(id){
  if(!confirm('Delete user '+id+'?'))return;
  await deleteDoc(doc(db,'users',id));
  await loadRegisteredUsersAdmin();
  if(typeof loadOnlineUsers === 'function') await loadOnlineUsers();
  await loadOverview();
}
async function loadRegisteredUsersAdmin(){
  const rows=[];
  try{
    const snap=await safeGet(query(collection(db,'users'),limit(200)));
    snap?.forEach(d=>rows.push({docId:d.id,usernameKey:d.id,...d.data()}));
  }catch(e){console.warn('registered users load failed',e);}
  rows.sort((a,b)=>azRegMs(b.createdAtMs||b.registeredAtMs||b.updatedAtMs||b.createdAt||b.registeredAt||b.updatedAt)-azRegMs(a.createdAtMs||a.registeredAtMs||a.updatedAtMs||a.createdAt||a.registeredAt||a.updatedAt));
  adminRegisteredUsersCache=rows;
  adminRegisteredUsersPage=1;
  renderRegisteredUsersAdmin();
}

async function loadAdminActivity(){
  const collections = [
    ['loginHistory','login'],
    ['guestHistory','guest'],
    ['purchaseLogs','payment'],
    ['commissionRecords','commission'],
    ['staffSoftwareSubmissions','software'],
    ['staffCADSubmissions','cad']
  ];
  const rows = [];
  for(const [col,type] of collections){
    try{
      const snap = await safeGet(query(collection(db,col), limit(40)));
      snap?.forEach(d=>rows.push({docId:d.id, collection:col, type, ...d.data()}));
    }catch(e){}
  }
  rows.sort((a,b)=>Number(b.createdAtMs||b.updatedAtMs||b.createdAt?.seconds*1000||0)-Number(a.createdAtMs||a.updatedAtMs||a.createdAt?.seconds*1000||0));
  adminActivityCache = rows;
  adminActivityPage = 1;
  renderAdminActivity();
}

async function loadSettings(){
  const snap=await getDoc(doc(db,'settings','signupGate')).catch(()=>null);
  if(snap?.exists()){$('#settingsBox').innerHTML=item('Signup Gate',`<pre>${esc(JSON.stringify(snap.data(),null,2))}</pre>`)}
  else $('#settingsBox').innerHTML='<div class="item">No signupGate settings found.</div>';
}
async function publishNotification(){
  const type=$('#notifType').value, title=$('#notifTitle').value.trim(), body=$('#notifBody').value.trim();
  if(!title&&!body)return toast('Please write notification.');
  await addDoc(collection(db,'notifications'),{active:true,scope:'all',type,title:title||type,body,createdAtMs:Date.now(),createdAt:serverTimestamp(),createdBy:currentUser?.email||'admin',createdByUid:currentUser?.uid||''});
  azAdminLogAction('notification_publish','notifications','latest',{type,title:title||type});
  $('#notifTitle').value='';$('#notifBody').value=''; await loadNotifications(); await loadOverview(); toast('Notification published.');
}
async function clearNotifications(){
  if(!confirm('Delete latest notifications?'))return;
  const snap=await safeGet(query(collection(db,'notifications'),orderBy('createdAtMs','desc'),limit(50)));
  const jobs=[]; snap?.forEach(d=>jobs.push(deleteDoc(doc(db,'notifications',d.id))));
  await Promise.all(jobs); azAdminLogAction('notification_clear_latest','notifications','latest',{count:jobs.length}); await loadNotifications(); await loadOverview(); toast('Notifications cleared.');
}
async function initSection(id){
  if(id==='overview')return loadOverview();
  if(id==='users'){ return loadRegisteredUsersAdmin(); }
  if(id==='online')return loadOnline();
  if(id==='activity')return loadActivity();
  if(id==='support')return loadSupport();
  if(id==='notifications')return loadNotifications();
  if(id==='purchases')return loadPurchases();
  if(id==='payments')return loadPayments();
  if(id==='activity')return loadAdminActivity();
  if(id==='commissions')return loadAdminCommissions();
  if(id==='auditlogs')return loadAdminAuditLogs();
  if(id==='exports'){ const n=$('#adminExportNotice'); if(n) n.textContent='Choose a report, then download. All export requests are recorded in Audit Logs.'; return; }
  if(id==='staffroles')return loadStaffRoles();
  if(id==='settings')return loadSettings();
}
document.addEventListener('click',async e=>{
  const tab=e.target.closest('[data-tab]');
  if(tab){document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));tab.classList.add('active');document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));$('#'+tab.dataset.tab).classList.add('active');await initSection(tab.dataset.tab);return;}
  const regEdit=e.target.closest('[data-reg-edit]');
  if(regEdit){openRegisteredEdit(regEdit.getAttribute('data-reg-edit'));return;}
  const regDel=e.target.closest('[data-reg-delete]');
  if(regDel){await deleteRegisteredUser(regDel.getAttribute('data-reg-delete'));return;}
  const edit=e.target.closest('[data-edit-user]');
  if(edit){return;}
  const du=e.target.closest('[data-del-user]');
  if(du){return;}
  const ds=e.target.closest('[data-del-support]');
  if(ds&&confirm('Delete support message?')){await deleteDoc(doc(db,'supportMessages',ds.dataset.delSupport));await loadSupport();await loadOverview();return;}
  const rs=e.target.closest('[data-reply-support]');
  if(rs){const id=rs.dataset.replySupport;const reply=$('#reply_'+id).value.trim();if(!reply)return toast('Write reply first.');await updateDoc(doc(db,'supportMessages',id),{reply,status:'replied',repliedAt:serverTimestamp(),repliedAtMs:Date.now()});await loadSupport();return;}
  const dn=e.target.closest('[data-del-notif]');
  if(dn&&confirm('Delete notification?')){await deleteDoc(doc(db,'notifications',dn.dataset.delNotif));await loadNotifications();await loadOverview();return;}
  const payoutBtn = e.target.closest('[data-commission-payout]');
  if(payoutBtn){await updateCommissionPayoutStatus(payoutBtn.getAttribute('data-commission-doc'), payoutBtn.getAttribute('data-commission-payout'));return;}
  const editBtn = e.target.closest('[data-edit-commission]');
  if(editBtn){editCommissionRecord(editBtn.getAttribute('data-edit-commission'));return;}
  const delBtn = e.target.closest('[data-delete-commission]');
  if(delBtn){deleteCommissionRecord(delBtn.getAttribute('data-delete-commission'));return;}
});


$('#refreshOnline').addEventListener('click',loadOnline);
$('#refreshSupport').addEventListener('click',loadSupport);
$('#publishNotif').addEventListener('click',publishNotification);
$('#clearNotif').addEventListener('click',clearNotifications);
$('#refreshPayments')?.addEventListener('click',loadPayments);
$('#paymentCategoryFilter')?.addEventListener('change',loadPayments);
$('#saveStaffRole')?.addEventListener('click',saveStaffRole);
$('#registeredUsersSearch')?.addEventListener('input',()=>{adminRegisteredUsersPage=1;renderRegisteredUsersAdmin();});
$('#registeredUsersSort')?.addEventListener('change',()=>{adminRegisteredUsersPage=1;renderRegisteredUsersAdmin();});
$('#registeredUsersRefreshBtn')?.addEventListener('click',loadRegisteredUsersAdmin);
$('#registeredUsersPrevBtn')?.addEventListener('click',()=>{adminRegisteredUsersPage--;renderRegisteredUsersAdmin();});
$('#registeredUsersNextBtn')?.addEventListener('click',()=>{adminRegisteredUsersPage++;renderRegisteredUsersAdmin();});
$('#azRegCancelBtn')?.addEventListener('click',()=>$('#azRegEditModal')?.classList.remove('is-open'));
$('#azRegSaveBtn')?.addEventListener('click',saveRegisteredEdit);
$('#saveCommissionRecord')?.addEventListener('click', saveCommissionRecord);
$('#resetCommissionForm')?.addEventListener('click', resetCommissionForm);
$('#refreshCommissionRecords')?.addEventListener('click', loadAdminCommissions);
$('#commissionPayoutFilter')?.addEventListener('change', renderAdminCommissions);
$('#exportCommissionCsv')?.addEventListener('click', exportCommissionCsv);
$('#refreshAuditLogs')?.addEventListener('click', loadAdminAuditLogs);
$('#downloadAdminExport')?.addEventListener('click', ()=>downloadAdminExport(false));
$('#downloadAdminExportAll')?.addEventListener('click', ()=>downloadAdminExport(true));

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){$('#loginState').textContent='Please login as admin from main website first.';return;}
  adminProfile=await getAdminProfile(user);
  if(!isAdminUser()){$('#loginState').textContent='Access denied. Admin only.';return;}
  $('#loginCover').classList.add('hidden');
  $('#adminName').textContent=adminProfile?.username||adminProfile?.name||user.email||'Admin';
  $('#adminAvatar').textContent=($('#adminName').textContent||'Z').slice(0,1).toUpperCase();
  await loadOverview();
});
