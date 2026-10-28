
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp, getCountFromServer } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig = {"apiKey": "AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8", "authDomain": "azobss.firebaseapp.com", "projectId": "azobss", "storageBucket": "azobss.firebasestorage.app", "messagingSenderId": "159277716405", "appId": "1:159277716405:web:17d8924b6b6380e2b77ffc"};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ADMIN_EMAIL='zedan91@azobss.local';
const ADMIN_EMAILS=['zedan9107@gmail.com','zedan91@azobss.local'];
const OWNER_USERNAME='zedan91';
const AZOBSS_BACKEND_API='https://azobss-backend.onrender.com';

function azAdminGetApiKey(){
  try{
    return sessionStorage.getItem('azobssAdminApiKey') || localStorage.getItem('azobssAdminApiKey') || localStorage.getItem('azobssLuckyDrawAdminKey') || '';
  }catch(_e){return '';}
}
function azAdminApiKeyHeaders(){
  const key=String(azAdminGetApiKey()||'').trim();
  return key ? {'x-admin-key':key} : {};
}
function azAdminRenderApiKeyStatus(){
  const box=$('#adminApiKeyStatus');
  const input=$('#adminApiKeyInput');
  if(!box&&!input)return;
  let source='not saved', key='';
  try{
    key=sessionStorage.getItem('azobssAdminApiKey')||'';
    if(key)source='saved for this session';
    else{key=localStorage.getItem('azobssAdminApiKey')||''; if(key)source='saved in this browser';}
    if(!key){key=localStorage.getItem('azobssLuckyDrawAdminKey')||''; if(key)source='using old lucky draw admin key fallback';}
  }catch(_e){}
  if(input) input.value=key||'';
  if(box) box.textContent = key ? ('Admin auth status: fallback key '+source+' • length '+String(key.length)+' • Auto Firebase admin auth still preferred.') : 'Admin auth status: Auto Firebase admin login mode. No browser ADMIN_KEY required.';
}
function azAdminSaveApiKey(mode){
  const key=String($('#adminApiKeyInput')?.value||'').trim();
  if(!key)return toast('Paste ADMIN_KEY first.');
  if(key.length<24 && !confirm('ADMIN_KEY nampak pendek. Simpan juga?'))return;
  try{
    if(mode==='session') sessionStorage.setItem('azobssAdminApiKey',key);
    else localStorage.setItem('azobssAdminApiKey',key);
    azAdminRenderApiKeyStatus();
    toast(mode==='session'?'Fallback admin key saved for this session.':'Fallback admin key saved in this browser.');
  }catch(e){toast('Cannot save admin key: '+(e?.message||e));}
}
function azAdminClearApiKey(){
  try{sessionStorage.removeItem('azobssAdminApiKey');localStorage.removeItem('azobssAdminApiKey');}
  catch(_e){}
  azAdminRenderApiKeyStatus();
  toast('Fallback admin key cleared from this browser/session. Auto Firebase admin auth remains available.');
}
async function azAdminTestApiKey(){
  const box=$('#adminApiKeyStatus');
  if(box) box.textContent='Admin auth status: testing backend with Firebase admin login...';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/system-health',{cache:'no-store'});
    const status=String(j?.status||'ok').toUpperCase();
    const method=String(j?.admin?.authMethod||'firebase-admin-token');
    const generated=j?.generatedAt?(' • checked '+fmtDate(j.generatedAt)):'';
    const key=String(azAdminGetApiKey()||'').trim();
    const fallback=key?' • fallback key saved':' • no browser ADMIN_KEY needed';
    if(box) box.textContent='Admin auth status: OK • backend '+status+' • '+method+fallback+generated;
    toast('Admin backend auth OK. No browser ADMIN_KEY needed when logged in as zedan91/admin.');
  }catch(e){
    const msg=e?.message||String(e||'Admin auth test failed.');
    if(box) box.textContent='Admin auth test failed: '+msg;
    toast('Admin auth test failed: '+msg);
  }
}

let currentUser=null;
let adminProfile=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* AZOBSS PATCH 310: Generic admin list pagination helper. */
const AZ_ADMIN_DEFAULT_PAGER_SIZE = 8;
window.azAdminPagerState = window.azAdminPagerState || {};
function azAdminPagerSafeKey(key){
  return String(key||'list').replace(/[^a-z0-9_-]/gi,'_').slice(0,80)||'list';
}
function azAdminApplyPager(selector, options={}){
  const list = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if(!list) return;
  const key = azAdminPagerSafeKey(options.key || list.id || 'azlist');
  const pageSize = Math.max(1, Number(options.pageSize || AZ_ADMIN_DEFAULT_PAGER_SIZE) || AZ_ADMIN_DEFAULT_PAGER_SIZE);
  const pagerId = 'azAdminPager_' + key;
  let pager = document.getElementById(pagerId);
  if(!pager){
    pager = document.createElement('div');
    pager.id = pagerId;
    pager.className = 'az-admin-pager';
    pager.setAttribute('data-az-pager-for', key);
    list.insertAdjacentElement('afterend', pager);
  }
  const items = Array.from(list.children).filter(el => !el.classList.contains('az-admin-pager'));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const state = window.azAdminPagerState[key] || {page:1};
  if(options.reset === true) state.page = 1;
  state.page = Math.min(Math.max(1, Number(state.page||1)), totalPages);
  window.azAdminPagerState[key] = state;
  const start = (state.page - 1) * pageSize;
  const end = start + pageSize;
  items.forEach((el, i) => { el.style.display = (i >= start && i < end) ? '' : 'none'; });
  const label = options.label || 'records';
  const pageLabel = totalItems ? `${start+1}-${Math.min(end,totalItems)} / ${totalItems}` : `0 / 0`;
  pager.hidden = totalItems <= pageSize && options.hideWhenSingle !== false;
  pager.innerHTML = `
    <button type="button" data-az-pager-prev ${state.page<=1?'disabled':''}>‹ Prev</button>
    <span class="az-admin-pager-info">Page ${state.page} / ${totalPages} • <span class="az-admin-pager-count">${pageLabel}</span> ${esc(label)}</span>
    <button type="button" data-az-pager-next ${state.page>=totalPages?'disabled':''}>Next ›</button>`;
  pager.querySelector('[data-az-pager-prev]')?.addEventListener('click',()=>{state.page=Math.max(1,state.page-1);azAdminApplyPager(list,{...options,reset:false});});
  pager.querySelector('[data-az-pager-next]')?.addEventListener('click',()=>{state.page=Math.min(totalPages,state.page+1);azAdminApplyPager(list,{...options,reset:false});});
}
window.azAdminApplyPager = azAdminApplyPager;

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
  if(status===403){
    const err=String(data?.error||'').toLowerCase();
    if(err.includes('admin_authorization') || err.includes('admin_key')) return 'Admin backend auth required. Login as zedan91/admin. ADMIN_KEY browser storage is optional fallback only.';
    return 'Admin permission required. Please login with an authorised admin account.';
  }
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
async function azAdminParseJsonResponse(res, url=''){
  const text = await res.text().catch(()=>'');
  try{
    return text ? JSON.parse(text) : {};
  }catch(_){
    const short = String(text || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
    const isPaymentDelete = String(url||'').includes('/api/admin/payment-logs/delete');
    const hint = isPaymentDelete
      ? 'Payment Logs delete endpoint belum aktif / belum deploy di Render backend. Deploy Render backend, kemudian cuba lagi.'
      : 'Backend returned non-JSON response.';
    return {ok:false,error: hint + (short ? ' Response: '+short : ''), nonJson:true, status:res.status};
  }
}
async function azAdminFetchJson(url,options={}){
  const baseHeaders=options.headers||{};
  const adminKeyHeaders=azAdminApiKeyHeaders();
  let authHeaders=await azAdminAuthHeaders(false);
  let res=await fetch(url,{...options,headers:{...baseHeaders,...adminKeyHeaders,...authHeaders}});
  let data=await azAdminParseJsonResponse(res,url);
  if((res.status===401 || res.status===403) && Object.keys(authHeaders).length){
    authHeaders=await azAdminAuthHeaders(true);
    res=await fetch(url,{...options,headers:{...baseHeaders,...adminKeyHeaders,...authHeaders}});
    data=await azAdminParseJsonResponse(res,url);
  }
  if(!res.ok) throw new Error(azAdminApiErrorMessage(res.status,data));
  return data;
}
async function azAdminFetchBlob(url,options={}){
  const baseHeaders=options.headers||{};
  const adminKeyHeaders=azAdminApiKeyHeaders();
  let authHeaders=await azAdminAuthHeaders(false);
  let res=await fetch(url,{...options,headers:{...baseHeaders,...adminKeyHeaders,...authHeaders}});
  if((res.status===401 || res.status===403) && Object.keys(authHeaders).length){
    authHeaders=await azAdminAuthHeaders(true);
    res=await fetch(url,{...options,headers:{...baseHeaders,...adminKeyHeaders,...authHeaders}});
  }
  if(!res.ok){
    const text=await res.text().catch(()=>'');
    let data={};
    try{data=JSON.parse(text)}catch(_){data={error:text||'Request failed.'}}
    throw new Error(azAdminApiErrorMessage(res.status,data));
  }
  return {blob:await res.blob(), filename:azFilenameFromDisposition(res.headers.get('content-disposition'))};
}
// AZOBSS PATCH 802: Expose the authenticated admin request helpers to later
// classic scripts. The main admin controller is an ES module, so its function
// declarations are not automatically attached to window. Service Bookings is
// a classic script and must use this bridge to include the Firebase ID token.
window.azAdminAuthHeaders = azAdminAuthHeaders;
window.azAdminFetchJson = azAdminFetchJson;
window.azAdminFetchBlob = azAdminFetchBlob;

async function viewAdminPayoutReceipt(requestId){
  try{
    if(!requestId) return toast('Missing payout request ID.');
    const out=await azAdminFetchBlob(AZOBSS_BACKEND_API+'/api/payout/receipt/'+encodeURIComponent(requestId),{cache:'no-store'});
    const url=URL.createObjectURL(out.blob);
    const w=window.open(url,'_blank','noopener');
    if(!w){const a=document.createElement('a');a.href=url;a.download=out.filename||('azobss-payout-receipt-'+requestId+'.html');document.body.appendChild(a);a.click();a.remove();}
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){toast(e?.message||'Failed to open payout receipt.');}
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
    azAdminApplyPager('#adminAuditLogsList',{key:'adminAuditLogsList',pageSize:10,label:'audit logs',reset:true});
  }catch(e){
    if(notice) notice.textContent=e?.message||'Failed to load audit logs.';
    if(list) list.innerHTML=`<div class="item"><div class="item-title">⚠️ Audit log error</div><div class="item-meta">${esc(e?.message||e)}</div></div>`;
  }
}
function azHealthBadge(ok,labelOk='OK',labelBad='Issue'){
  return ok ? `<span class="ok">✅ ${labelOk}</span>` : `<span class="bad">⚠️ ${labelBad}</span>`;
}
function azHealthSize(bytes){
  const n=Number(bytes||0);
  if(!n) return '0 B';
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}

function azDiagLine(ok,title,meta){
  const cls = ok === true ? 'ok' : (ok === false ? 'danger' : 'warn');
  const icon = ok === true ? '✅' : (ok === false ? '⚠️' : 'ℹ️');
  return `<div class="item"><div class="item-title ${cls}">${icon} ${esc(title)}</div><div class="item-meta">${meta||''}</div></div>`;
}
function azAdminApiKeySummary(){
  let source='not saved', key='';
  try{
    key=sessionStorage.getItem('azobssAdminApiKey')||'';
    if(key) source='sessionStorage';
    else{ key=localStorage.getItem('azobssAdminApiKey')||''; if(key) source='localStorage'; }
    if(!key){ key=localStorage.getItem('azobssLuckyDrawAdminKey')||''; if(key) source='legacy lucky draw fallback'; }
  }catch(_e){}
  return {saved:!!key, source, length:String(key||'').length};
}
async function runAdminFrontendDiagnostics(){
  const list=$('#adminFrontendDiagnosticsList');
  const notice=$('#adminFrontendDiagnosticsNotice');
  if(list) list.innerHTML='<div class="item">Running admin dashboard check...</div>';
  if(notice) notice.textContent='Checking admin dashboard...';
  const rows=[];
  const start=Date.now();
  try{
    const u=currentUser||auth.currentUser;
    rows.push(azDiagLine(!!u,'Firebase login session',u?`Signed in as ${esc(u.email||u.uid||'user')} • uid ${esc(String(u.uid||'').slice(0,10))}...`:'No Firebase user session. Re-login admin.'));
    const adminOk=!!(adminProfile && (ADMIN_EMAILS.includes(String(u?.email||'').toLowerCase()) || adminProfile.role==='admin' || adminProfile.isAdmin===true));
    rows.push(azDiagLine(adminOk,'Admin profile guard',adminOk?`Profile accepted: ${esc(adminProfile?.username||adminProfile?.email||u?.email||'admin')}`:'Admin profile not confirmed. /admin/ should stay locked.'));
    const keyInfo=azAdminApiKeySummary();
    const autoAuthOk=!!u && !!adminOk;
    rows.push(azDiagLine(autoAuthOk || keyInfo.saved,'Backend admin auth mode',autoAuthOk?`Auto via Firebase admin token. No browser ADMIN_KEY required.${keyInfo.saved?` Optional fallback saved via ${esc(keyInfo.source)} • length ${esc(keyInfo.length)}.`:''}`:(keyInfo.saved?`Fallback saved via ${esc(keyInfo.source)} • length ${esc(keyInfo.length)}.`:'No admin session and no fallback key. Login as admin first.')));
    const requiredSections=['overview','users','online','activity','support','notifications','adminalerts','purchases','payments','commissions','auditlogs','exports','systemhealth','maintenance','staffroles','settings'];
    const missingSections=requiredSections.filter(id=>!document.getElementById(id));
    rows.push(azDiagLine(!missingSections.length,'Admin section DOM',missingSections.length?`Missing: ${esc(missingSections.join(', '))}`:`${requiredSections.length} required sections found.`));
    const requiredButtons=['refreshSystemHealth','runAdminFrontendDiagnostics','saveAdminApiKeyLocal','testAdminApiKey'];
    const missingButtons=requiredButtons.filter(id=>!document.getElementById(id));
    rows.push(azDiagLine(!missingButtons.length,'Admin helper buttons',missingButtons.length?`Missing: ${esc(missingButtons.join(', '))}`:'System Health and admin auth helper buttons found.'));
    rows.push(azDiagLine(typeof loadAdminActivity==='function','Activity tab function',typeof loadAdminActivity==='function'?'loadAdminActivity() is available.':'loadAdminActivity() missing.'));
    rows.push(azDiagLine(typeof loadActivity==='undefined','Old broken loadActivity check',typeof loadActivity==='undefined'?'Old undefined loadActivity() is not being used.':'loadActivity exists unexpectedly; audit tab routing.'));
    try{
      const usersCount=await safeCount(collection(db,'users'),'Diagnostics: users count');
      rows.push(azDiagLine(Number.isFinite(usersCount),'Firestore users count',Number.isFinite(usersCount)?`users collection count returned ${esc(usersCount)}.`:'Count unavailable. Check Firestore Rules/index.'));
    }catch(e){ rows.push(azDiagLine(false,'Firestore users count',esc(e?.message||e))); }
    try{
      const health=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/system-health',{cache:'no-store'});
      const status=String(health?.status||'ok').toUpperCase();
      const missing=(health?.missingRequired||[]).length||0;
      const errors=(health?.firebase?.collectionErrors||[]).length||0;
      rows.push(azDiagLine(status==='OK' || status==='HEALTHY','Backend system-health',`Status ${esc(status)} • missing ENV ${esc(missing)} • collection errors ${esc(errors)} • latency ${esc(health?.latencyMs||0)}ms`));
    }catch(e){ rows.push(azDiagLine(false,'Backend system-health',esc(e?.message||e))); }
    try{
      const res=await fetch('/admin/index.html',{method:'HEAD',cache:'no-store'});
      rows.push(azDiagLine(res.ok,'GitHub Pages admin file',res.ok?`/admin/index.html reachable • HTTP ${esc(res.status)}`:`/admin/index.html returned HTTP ${esc(res.status)}`));
    }catch(e){ rows.push(azDiagLine(false,'GitHub Pages admin file',esc(e?.message||e))); }
    const existingWarnings=adminQueryErrors.length;
    rows.push(azDiagLine(existingWarnings===0,'Current query warning buffer',existingWarnings?`${esc(existingWarnings)} warning(s) currently recorded above.`:'No Firestore warning currently recorded.'));
    if(list) list.innerHTML=rows.join('');
    if(notice) notice.textContent='Admin dashboard check completed in '+(Date.now()-start)+'ms.';
  }catch(e){
    if(list) list.innerHTML=rows.join('')+azDiagLine(false,'Diagnostics failed',esc(e?.message||e));
    if(notice) notice.textContent='Admin dashboard check failed.';
  }
}
function clearAdminFrontendDiagnostics(){
  const list=$('#adminFrontendDiagnosticsList');
  const notice=$('#adminFrontendDiagnosticsNotice');
  if(list) list.innerHTML='';
  if(notice) notice.textContent='No check run yet.';
}

async function loadSystemHealth(){
  const notice=$('#systemHealthNotice');
  if(notice) notice.textContent='Checking backend health...';
  ['healthOverallStatus','healthFirebaseStatus','healthMissingEnv','healthCollectionErrors'].forEach(id=>{const el=$('#'+id); if(el) el.textContent='...';});
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/system-health',{cache:'no-store'});
    const status=String(j.status||'unknown').toUpperCase();
    if($('#healthOverallStatus')) $('#healthOverallStatus').textContent=status;
    if($('#healthFirebaseStatus')) $('#healthFirebaseStatus').textContent=j.firebase?.configured?'OK':'ERROR';
    if($('#healthMissingEnv')) $('#healthMissingEnv').textContent=String((j.missingRequired||[]).length||0);
    if($('#healthCollectionErrors')) $('#healthCollectionErrors').textContent=String((j.firebase?.collectionErrors||[]).length||0);
    if(notice) notice.textContent='Last checked: '+fmtDate(j.generatedAt)+' • Backend latency: '+esc(j.latencyMs||0)+'ms';

    const envRows=Array.isArray(j.env)?j.env:[];
    if($('#systemHealthEnvList')) $('#systemHealthEnvList').innerHTML=envRows.map(x=>{
      const required=x.recommended?'Required/Recommended':'Optional';
      const state=x.present?azHealthBadge(true,'Configured','Missing'):azHealthBadge(!x.recommended,'Optional not set','Missing');
      const value=x.value?` • ${esc(x.value)}`:'';
      return item(`${state} ${esc(x.name||'ENV')}`,`${esc(required)}${value}${x.note?' • '+esc(x.note):''}`);
    }).join('') || '<div class="item">No ENV data.</div>';

    const p=j.process||{};
    if($('#systemHealthRuntime')) $('#systemHealthRuntime').innerHTML=[
      item('Node Version',esc(p.nodeVersion||'-')),
      item('Platform / PID',esc((p.platform||'-')+' / '+(p.pid||'-'))),
      item('Uptime',esc((p.uptimeSeconds||0)+' seconds')),
      item('Memory RSS',esc((p.memoryMB||0)+' MB')),
      item('CORS Origin',esc(p.corsOrigin||'-')),
      item('ToyyibPay Callback Verify',p.toyyibCallbackVerifyEnabled?'<span class="ok">ON</span>':'<span class="bad">OFF / Emergency bypass</span>'),
      item('Rate Limit',p.rateLimitDisabled?'<span class="bad">Disabled</span>':'<span class="ok">Enabled</span>'),
      item('Receipt Strict All Orders',p.receiptStrictAllOrders?'<span class="ok">Enabled</span>':'Optional / legacy allowed')
    ].join('');

    const cols=Array.isArray(j.collections)?j.collections:[];
    if($('#systemHealthCollections')) $('#systemHealthCollections').innerHTML=cols.map(x=>{
      const state=x.ok?azHealthBadge(true,'Readable','Error'):azHealthBadge(false,'Readable','Error');
      const meta=`sample: ${esc(x.sampleCount||0)}${x.latestCreatedAt?(' • latest: '+esc(x.latestCreatedAt)):''}${x.error?(' • '+esc(x.error)):''}`;
      return item(`${state} ${esc(x.name||'collection')}`,meta);
    }).join('') || '<div class="item">No collection data.</div>';

    const files=Array.isArray(j.files)?j.files:[];
    if($('#systemHealthFiles')) $('#systemHealthFiles').innerHTML=files.map(x=>{
      const state=x.exists?azHealthBadge(true,'Exists','Missing'):azHealthBadge(true,'Not found','Missing');
      const meta=`size: ${esc(azHealthSize(x.sizeBytes))}${x.modifiedAt?(' • modified: '+fmtDate(x.modifiedAt)):''}${x.error?(' • '+esc(x.error)):''}`;
      return item(`${state} ${esc(x.file||'file')}`,meta);
    }).join('') || '<div class="item">No file data.</div>';
  }catch(e){
    if(notice) notice.textContent=e?.message||'System health check failed.';
    ['systemHealthEnvList','systemHealthRuntime','systemHealthCollections','systemHealthFiles'].forEach(id=>{const el=$('#'+id); if(el) el.innerHTML=`<div class="item"><div class="item-title">⚠️ Health check error</div><div class="item-meta">${esc(e?.message||e)}</div></div>`;});
  }
}


function azMaintIssueCount(j,type){
  const issues=Array.isArray(j?.issues)?j.issues:[];
  const row=issues.find(x=>x.type===type);
  return Number(row?.count||0)||0;
}
function azMaintSeverityClass(sev){
  const s=String(sev||'').toLowerCase();
  if(s==='high')return 'danger';
  if(s==='medium')return 'warn';
  if(s==='info')return 'info';
  return 'ok';
}
function azMaintOkLabel(type,label){
  const map={
    paidOrdersMissingToken:'Paid orders download token',
    paidOrdersMissingReceiptFlag:'Paid order receipt protection',
    expiredDownloadTokens:'Download token expiry status',
    commissionMissingPayoutStatus:'Commission payout status',
    localPremiumOrdersMissingFirestore:'Premium orders Firestore backup',
    firestorePremiumOrdersMissingLocal:'Local premiumOrders cache',
    prunableExpiredDownloadTokens:'Expired token retention',
    oldAuditLogs:'Admin audit log retention',
    oldNotifications:'Notification retention'
  };
  return map[String(type||'')]||String(label||type||'Maintenance check');
}
function azMaintIssueHtml(x){
  const count=Math.max(0,Number(x?.count||0)||0);
  const type=String(x?.type||'');
  if(count===0){
    return item(`<span class="ok">✅ ${esc(azMaintOkLabel(type,x?.label))} — OK</span>`,'No issue found.');
  }
  if(type==='firestorePremiumOrdersMissingLocal'){
    return item(`<span class="info">INFO</span> ${esc(x?.label||'Local cache incomplete — Firestore data safe')}`,`Count: ${esc(count)}${x?.note?' • '+esc(x.note):' • Firestore data remains safe.'}`);
  }
  return item(`<span class="${azMaintSeverityClass(x?.severity)}">${esc((x?.severity||'info').toUpperCase())}</span> ${esc(x?.label||type)}`,`Count: ${esc(count)}${x?.note?' • '+esc(x.note):''}`);
}
function azMaintSamplesHtml(samples){
  const groups=samples&&typeof samples==='object'?samples:{};
  const rows=[];
  Object.entries(groups).forEach(([key,list])=>{
    if(!Array.isArray(list)||!list.length)return;
    rows.push(`<div class="item"><div class="item-title">${esc(key)} (${list.length})</div><div class="item-meta">${list.slice(0,8).map(x=>esc(Object.entries(x||{}).map(([k,v])=>`${k}: ${v}`).join(' • '))).join('<br>')}</div></div>`);
  });
  return rows.join('')||'<div class="item"><div class="item-title ok">No sample issues found.</div><div class="item-meta">Maintenance scan did not find repairable sample rows.</div></div>';
}
async function loadMaintenanceScan(){
  const notice=$('#maintenanceNotice');
  if(notice) notice.textContent='Scanning backend maintenance status...';
  ['maintMissingToken','maintReceiptFlag','maintExpiredTokens','maintCommissionStatus','maintLocalPremiumOrdersCount','maintLocalOrdersMissingFirestore','maintFirestoreOrdersMissingLocal','maintPrunableTokens','maintOldAuditLogs','maintOldNotifications'].forEach(id=>{const el=$('#'+id); if(el) el.textContent='...';});
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/maintenance-scan',{cache:'no-store'});
    if($('#maintMissingToken')) $('#maintMissingToken').textContent=String(azMaintIssueCount(j,'paidOrdersMissingToken'));
    if($('#maintReceiptFlag')) $('#maintReceiptFlag').textContent=String(azMaintIssueCount(j,'paidOrdersMissingReceiptFlag'));
    if($('#maintExpiredTokens')) $('#maintExpiredTokens').textContent=String(azMaintIssueCount(j,'expiredDownloadTokens'));
    if($('#maintCommissionStatus')) $('#maintCommissionStatus').textContent=String(azMaintIssueCount(j,'commissionMissingPayoutStatus'));
    if($('#maintLocalPremiumOrdersCount')) $('#maintLocalPremiumOrdersCount').textContent=String((j.scanned&&j.scanned.localPremiumOrders)||0);
    if($('#maintLocalOrdersMissingFirestore')) $('#maintLocalOrdersMissingFirestore').textContent=String(azMaintIssueCount(j,'localPremiumOrdersMissingFirestore'));
    if($('#maintFirestoreOrdersMissingLocal')) $('#maintFirestoreOrdersMissingLocal').textContent=String(azMaintIssueCount(j,'firestorePremiumOrdersMissingLocal'));
    if($('#maintPrunableTokens')) $('#maintPrunableTokens').textContent=String(azMaintIssueCount(j,'prunableExpiredDownloadTokens'));
    if($('#maintOldAuditLogs')) $('#maintOldAuditLogs').textContent=String(azMaintIssueCount(j,'oldAuditLogs'));
    if($('#maintOldNotifications')) $('#maintOldNotifications').textContent=String(azMaintIssueCount(j,'oldNotifications'));
    const ret=j.retention||{};
    if($('#maintenanceRetentionNote')) $('#maintenanceRetentionNote').textContent=`Retention cleanup: download tokens ${esc(ret.downloadTokenDays||90)} days • audit logs ${esc(ret.auditLogDays||365)} days • notifications ${esc(ret.notificationDays||180)} days.`;
    if(notice) notice.textContent='Last scanned: '+fmtDate(j.generatedAt)+' • Firestore orders: '+esc((j.scanned&&j.scanned.premiumOrders)||0)+' • Local orders: '+esc((j.scanned&&j.scanned.localPremiumOrders)||0)+' • latency: '+esc(j.latencyMs||0)+'ms';
    const issues=Array.isArray(j.issues)?j.issues:[];
    if($('#maintenanceIssueList')) $('#maintenanceIssueList').innerHTML=issues.map(azMaintIssueHtml).join('')||'<div class="item"><div class="item-title ok">✅ Maintenance checks — OK</div><div class="item-meta">No issues data.</div></div>';
    if($('#maintenanceSampleList')) $('#maintenanceSampleList').innerHTML=azMaintSamplesHtml(j.samples||{});
    const warnings=Array.isArray(j.warnings)?j.warnings:[];
    if($('#maintenanceWarningList')) $('#maintenanceWarningList').innerHTML=warnings.map(w=>item('<span class="warn">Warning</span>',esc(w))).join('')||'<div class="item"><div class="item-title ok">No warnings.</div></div>';
  }catch(e){
    if(notice) notice.textContent=e?.message||'Maintenance scan failed.';
    ['maintenanceIssueList','maintenanceSampleList','maintenanceWarningList'].forEach(id=>{const el=$('#'+id); if(el) el.innerHTML=`<div class="item"><div class="item-title danger">Maintenance error</div><div class="item-meta">${esc(e?.message||e)}</div></div>`;});
  }
}
async function runMaintenanceAction(){
  const action=$('#maintenanceAction')?.value||'';
  if(!action)return toast('Please choose maintenance action first.');
  const isPrune=String(action||'').startsWith('prune-');
  let confirmText='';
  const isSync=String(action||'').includes('premium-orders-firestore');
  const msg=isPrune
    ? 'Run this retention cleanup now?\n\n'+action+'\n\nThis may DELETE old Firestore rows that are already outside retention. Export backup first if needed.'
    : (isSync ? 'Run Premium Orders Firestore Backup / Sync now?\n\n'+action+'\n\nThis is safe. It merges records and does not delete payment data.' : 'Run this maintenance repair now?\n\n'+action+'\n\nThis will write changes to Firestore where needed.');
  if(!confirm(msg))return;
  if(isPrune){
    confirmText=prompt('Type CONFIRM CLEANUP to continue this destructive cleanup action.','')||'';
    if(confirmText.trim()!=='CONFIRM CLEANUP'){
      toast('Cleanup cancelled. Confirmation phrase did not match.');
      return;
    }
  }
  const notice=$('#maintenanceNotice');
  if(notice) notice.textContent='Running maintenance action: '+action+' ...';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/maintenance-run',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,limit:200,confirmText})
    });
    if($('#maintenanceResultList')) $('#maintenanceResultList').innerHTML=[
      item(j.ok?'<span class="ok">Maintenance completed</span>':'<span class="danger">Maintenance failed</span>',`Action: ${esc(j.action||action)}${j.destructive?' • destructive cleanup':''} • processed: ${esc(j.processed||0)} • changed: ${esc(j.changed||0)} • skipped: ${esc(j.skipped||0)} • latency: ${esc(j.latencyMs||0)}ms`),
      ...(Array.isArray(j.samples)?j.samples.slice(0,10).map(x=>item('Changed row',esc(Object.entries(x||{}).map(([k,v])=>`${k}: ${v}`).join(' • ')))):[]),
      ...(Array.isArray(j.errors)?j.errors.slice(0,5).map(x=>item('<span class="danger">Error</span>',esc(x))):[])
    ].join('');
    if(notice) notice.textContent='Maintenance finished. Changed '+(j.changed||0)+' row(s). Scan refreshed.';
    await loadMaintenanceScan();
  }catch(e){
    if(notice) notice.textContent=e?.message||'Maintenance repair failed.';
    if($('#maintenanceResultList')) $('#maintenanceResultList').innerHTML=`<div class="item"><div class="item-title danger">Repair failed</div><div class="item-meta">${esc(e?.message||e)}</div></div>`;
  }
}

function azAdminClean(v){return String(v||'').trim().toLowerCase();}
function azAdminIsOwnerEmail(email){return ADMIN_EMAILS.includes(azAdminClean(email));}
function azAdminProfileBelongsToUser(profile,user){
  if(!profile || !user) return false;
  const uid=azAdminClean(profile.uid||profile.authUid||profile.userUid||profile.firebaseUid);
  const email=azAdminClean(profile.email||profile.authEmail||profile.realEmail||profile.userEmail);
  if(uid && uid===azAdminClean(user.uid)) return true;
  if(email && azAdminClean(user.email) && email===azAdminClean(user.email)) return true;
  return false;
}
function isAdminUser(){
  const user=currentUser||auth.currentUser;
  const email=azAdminClean(user?.email||adminProfile?.email||adminProfile?.authEmail);
  if(azAdminIsOwnerEmail(email)) return true;
  if(!azAdminProfileBelongsToUser(adminProfile,user)) return false;
  const role=azAdminClean(adminProfile?.role||adminProfile?.accountRole||adminProfile?.userRole||adminProfile?.accessRole);
  const username=azAdminClean(adminProfile?.username||adminProfile?.usernameKey||adminProfile?.name||adminProfile?.id);
  const profileEmail=azAdminClean(adminProfile?.email||adminProfile?.authEmail||adminProfile?.realEmail||adminProfile?.userEmail);
  return role==='admin' || adminProfile?.isAdmin===true || adminProfile?.admin===true || adminProfile?.owner===true || username===OWNER_USERNAME || azAdminIsOwnerEmail(profileEmail);
}
function azAdminStoredUsernameCandidates(){
  const keys=['azobssCurrentUser','azobssUser','azobss_current_user','azobssSavedUser','azobss_user_profile','azobssProfile','currentUser','userProfile','azobss_auth_user','azobssLoginUser','azobss_logged_user'];
  const out=[];
  keys.forEach(k=>{
    try{
      const raw=localStorage.getItem(k)||sessionStorage.getItem(k);
      if(!raw) return;
      let obj=null;
      try{obj=JSON.parse(raw);}catch(_e){obj={username:raw};}
      out.push(obj?.usernameKey,obj?.username,obj?.userName,obj?.id,obj?.name,obj?.displayName);
    }catch(_e){}
  });
  return out;
}
async function getAdminProfile(user){
  if(!user)return null;
  const email=azAdminClean(user.email);
  const candidates=[
    ...(azAdminIsOwnerEmail(email)?[OWNER_USERNAME]:[]),
    user.email?.split('@')[0],
    user.displayName,
    user.uid,
    ...azAdminStoredUsernameCandidates()
  ].map(azAdminClean).filter(Boolean);
  const seen=new Set();
  for(const c of candidates){
    if(seen.has(c)) continue;
    seen.add(c);
    try{
      const snap=await getDoc(doc(db,'users',c));
      if(!snap.exists()) continue;
      const profile={id:snap.id,...snap.data()};
      if(azAdminIsOwnerEmail(email) || azAdminProfileBelongsToUser(profile,user)) return profile;
    }catch(e){}
  }
  return null;
}
function item(title,meta='',actions=''){
  return `<div class="item"><div class="item-row"><div><div class="item-title">${title}</div>${meta?`<div class="item-meta">${meta}</div>`:''}</div><div class="item-actions">${actions}</div></div></div>`;
}
let adminQueryErrors=[];
function azAdminFriendlyFirestoreError(e){
  const code=String(e?.code||'').trim();
  const msg=String(e?.message||e||'Unknown Firestore error').replace(/\s+/g,' ').slice(0,260);
  if(code==='permission-denied') return 'Permission denied. Semak Firebase Rules dan pastikan email admin sudah diselaraskan.';
  if(code==='failed-precondition') return 'Index/query requirement belum lengkap. Semak link index dalam console browser jika ada.';
  if(code==='unavailable') return 'Firestore temporarily unavailable. Cuba refresh selepas beberapa saat.';
  if(code==='unauthenticated') return 'Session belum sah. Logout/login semula sebagai admin.';
  return (code?code+': ':'')+msg;
}
function azAdminReportQueryError(label,e){
  const message=azAdminFriendlyFirestoreError(e);
  const key=String(label||'Firestore query')+'|'+message;
  if(!adminQueryErrors.some(x=>x.key===key)){
    adminQueryErrors.push({key,label:String(label||'Firestore query'),message});
    if(adminQueryErrors.length>8) adminQueryErrors=adminQueryErrors.slice(-8);
  }
  azAdminRenderQueryErrors();
}
function azAdminClearQueryErrors(){
  adminQueryErrors=[];
  azAdminRenderQueryErrors();
}
function azAdminRenderQueryErrors(){
  const box=$('#adminQueryAlert');
  if(!box) return;
  if(!adminQueryErrors.length){
    box.classList.remove('show');
    box.innerHTML='';
    return;
  }
  box.classList.add('show');
  box.innerHTML='<h3>⚠️ Admin dashboard query warning</h3><div>Data mungkin nampak 0/kosong kerana query Firestore gagal, bukan semestinya tiada rekod.</div><ul>'+
    adminQueryErrors.map(x=>`<li><b>${esc(x.label)}</b>: ${esc(x.message)}</li>`).join('')+
    '</ul>';
}
async function safeGet(q,label){
  try{return await getDocs(q)}catch(e){console.warn('Admin dashboard query failed:',label||'',e);azAdminReportQueryError(label||'Firestore query',e);return null}
}
async function safeCount(ref,label){
  try{
    if(typeof getCountFromServer === 'function'){
      const snap = await getCountFromServer(ref);
      const n = Number(snap?.data?.()?.count || 0);
      return Number.isFinite(n) ? n : 0;
    }
  }catch(e){
    console.warn('Admin dashboard count failed:',label||'',e);
    azAdminReportQueryError(label||'Firestore count',e);
  }
  return null;
}

function azAdminIsPaBmRecord(x){
  x=x||{};
  const hay=[x.productType,x.product,x.category,x.source,x.itemType,x.type,x.title,x.name,x.itemName,x.filename,x.itemCode].map(v=>String(v||'').toLowerCase()).join(' ');
  return hay.includes('pa') || hay.includes('bm') || hay.includes('pabm') || hay.includes('lot') || hay.includes('kadaster');
}
function azAdminIsPaidRecord(x){
  const status=String(x?.status || x?.paymentStatus || '').toLowerCase();
  return ['paid','verified','success','completed','approved','confirmed'].includes(status);
}
function azAdminDownloadCount(x){
  // v1109: preserve an explicit 0/5 instead of falling through to stale aliases.
  const raw=x?.downloadCount ?? x?.usedCount ?? x?.downloadsUsed ?? 0;
  return Math.max(0, Number(raw) || 0);
}
function azAdminMaxDownloads(x){
  const n=Number(x?.maxDownloads || x?.maxDownload || 0) || 0;
  return n>0?n:5;
}
function azAdminPaBmResetActions(x){
  if(!x || !x.id || !azAdminIsPaBmRecord(x) || !azAdminIsPaidRecord(x)) return '';
  const used=azAdminDownloadCount(x);
  const max=azAdminMaxDownloads(x);
  return `<span class="az-admin-pabm-dl-badge">⬇ ${esc(String(used))}/${esc(String(max))}</span><button class="az-admin-reset-pabm-download-btn" data-reset-pabm-download="${esc(x.id)}" title="Reset PA/BM download limit to 0/5">Reset 0/5</button>`;
}
function azAdminPaymentReceiptId(x){
  return String(x?.orderId || x?.billCode || x?.paymentReference || x?.transactionId || x?.txnId || x?.receiptNo || x?.id || x?.docId || '').trim();
}
function azAdminPaymentReceiptSource(x){
  return x?._azSource === 'premiumOrders' ? 'premiumOrders' : 'purchaseLogs';
}
function azAdminCanIssuePaymentReceipt(x){
  // AZOBSS PATCH 385:
  // Pending/cancelled/failed payment logs must not show receipt, PDF or email+download-link actions.
  return azAdminStatusBucket(x) === 'paid';
}
function azAdminPaymentReceiptActions(x,key){
  const id=azAdminPaymentReceiptId(x);
  if(!id) return '';
  if(!azAdminCanIssuePaymentReceipt(x)){
    return '<span class="az-paylog-receipt-locked" title="Receipt/PDF available only after payment is verified">Receipt locked</span>';
  }
  const safeKey=esc(key||x?._azDetailKey||id);
  return `<button class="btn" data-paylog-receipt="${safeKey}" data-format="html" title="View receipt" type="button">Rcpt</button><button class="btn green" data-paylog-receipt="${safeKey}" data-format="pdf" data-download="1" title="Download PDF receipt" type="button">PDF</button><button class="btn gray" data-paylog-email-receipt="${safeKey}" title="Email receipt plus Software/CAD download link when available" type="button">Email+Link</button>`;
}


/* AZOBSS PATCH 297A: Admin dashboard must count Software/CAD premium orders.
   Root cause: Software/CAD ToyyibPay orders are stored in backend/Firestore premiumOrders,
   while older dashboard totals only read purchaseLogs (PA/BM). */
function azAdminParseFlexibleDateMs(v){
  if(!v) return 0;
  if(typeof v==='number' && Number.isFinite(v) && v>0) return v;
  if(v && typeof v.toDate==='function'){
    const d=v.toDate();
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }
  if(v && typeof v==='object'){
    if(Number.isFinite(Number(v.seconds)) && Number(v.seconds)>0) return Number(v.seconds)*1000;
    if(Number.isFinite(Number(v._seconds)) && Number(v._seconds)>0) return Number(v._seconds)*1000;
  }
  const raw=String(v||'').trim();
  if(!raw) return 0;

  const direct=Date.parse(raw);
  if(!Number.isNaN(direct) && direct>0) return direct;

  // AZOBSS PATCH 416:
  // Support Malaysian/common display dates stored in old records:
  // 28/06/2026, 12:31 am
  // 28-06-2026 12:31
  // 28/06/26 12:31 PM
  const m=raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[,\s]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm|AM|PM)?)?/);
  if(m){
    let day=Number(m[1]);
    let month=Number(m[2])-1;
    let year=Number(m[3]);
    if(year<100) year+=2000;
    let hour=Number(m[4]||0);
    const minute=Number(m[5]||0);
    const second=Number(m[6]||0);
    const ap=String(m[7]||'').toLowerCase();
    if(ap==='pm' && hour<12) hour+=12;
    if(ap==='am' && hour===12) hour=0;
    const d=new Date(year,month,day,hour,minute,second);
    if(!Number.isNaN(d.getTime()) && d.getFullYear()===year && d.getMonth()===month && d.getDate()===day) return d.getTime();
  }

  // Support YYYY/MM/DD or YYYY-MM-DD with optional time if browser failed direct parse.
  const y=raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:[T,\s]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm|AM|PM)?)?/);
  if(y){
    let year=Number(y[1]);
    let month=Number(y[2])-1;
    let day=Number(y[3]);
    let hour=Number(y[4]||0);
    const minute=Number(y[5]||0);
    const second=Number(y[6]||0);
    const ap=String(y[7]||'').toLowerCase();
    if(ap==='pm' && hour<12) hour+=12;
    if(ap==='am' && hour===12) hour=0;
    const d=new Date(year,month,day,hour,minute,second);
    if(!Number.isNaN(d.getTime())) return d.getTime();
  }

  return 0;
}
function azAdminPaymentMs(x){
  if(!x) return 0;
  const product=x.product||{};
  const user=x.user||{};
  const candidates=[
    x.paidAtMs,x.paymentPaidAtMs,x.paidMs,x.paymentDateMs,x.createdAtMs,x.timeMs,x.updatedAtMs,x.completedAtMs,x.emailSentAtMs,
    x.billPaidAtMs,x.billCreatedAtMs,x.transactionTimeMs,x.timestampMs,
    x.paidAt,x.paymentPaidAt,x.paidDate,x.paymentDate,x.createdAt,x.createdDate,x.date,x.time,x.timestamp,x.updatedAt,x.completedAt,x.emailSentAt,
    x.billPaidAt,x.billCreatedAt,x.transactionTime,x.createdAtText,x.dateText,x.displayDate,x.paidDateText,x.paymentDateText,
    product.createdAtMs,product.createdAt,product.updatedAtMs,product.updatedAt,
    user.createdAtMs,user.createdAt
  ];
  for(const v of candidates){
    const ms=azAdminParseFlexibleDateMs(v);
    if(ms>0) return ms;
  }
  return 0;
}
function azAdminDetectPaymentCategory(x, fallback='Others'){
  x=x||{};
  const product=x.product||{};
  const rawFields=[
    x.category,x.productCategory,x.sourcePage,x.sourceUrl,x.pageUrl,x.productId,x.productName,x.productTitle,
    x.productType,x.source,x.itemType,x.type,x.title,x.name,x.itemName,x.filename,x.itemCode,x.softwareId,x.cadId,
    x.noPa,x.noPA,x.noBm,x.noBM,x.paNo,x.bmNo,x.orderId,x.billCode,x.collection,
    product.category,product.type,product.toolType,product.productType,product.badge,product.id,product.name,product.title
  ];
  const hay=rawFields.map(v=>String(v||'').toLowerCase()).join(' ').replace(/[._]+/g,' ');
  const compact=hay.replace(/[^a-z0-9]+/g,'');

  // PA/BM must be detected before Software because some PA/BM rows can carry generic
  // product/category words like "purchase record" or accidentally come from premiumOrders.
  const isPabm = (
    /\bpa\s*[/+-]?\s*bm\b/.test(hay) ||
    /\bpabm\b/.test(hay) ||
    compact.includes('pabm') ||
    compact.includes('nopabm') ||
    compact.includes('nopa') ||
    compact.includes('nobm') ||
    /\bpa[-\s]*\d{2,}/.test(hay) ||
    /\bbm[-\s]*\d{2,}/.test(hay) ||
    hay.includes('pelan akui') ||
    hay.includes('batu sempadan') ||
    hay.includes('kadaster') ||
    hay.includes('jupem')
  );
  if(isPabm) return 'PA/BM';

  if(/\bcad\b/.test(hay) || hay.includes('cad tools') || hay.includes('lisp') || hay.includes('vlx') || hay.includes('autocad') || hay.includes('dwg')) return 'CAD Tools';
  if(hay.includes('software') || hay.includes('license') || hay.includes('download') || String(fallback||'').toLowerCase()==='software') return 'Software';
  return fallback || 'Others';
}
function azAdminPremiumCategory(x){
  return azAdminDetectPaymentCategory(x, 'Software');
}
function azAdminPremiumAmount(x){
  const n=Number(x?.saleAmount || x?.total || x?.totalAmount || x?.price || x?.amountValue || 0);
  if(Number.isFinite(n) && n>0) return n;
  const sen=Number(x?.amountSen || 0);
  if(Number.isFinite(sen) && sen>0) return Math.round(sen)/100;
  const raw=String(x?.amount || x?.saleAmountText || x?.amountText || x?.product?.price || '').replace(/,/g,'');
  const m=raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? Number(m[1]) : 0;
}
function azAdminPaymentAmount(x){
  x=x||{};
  const keys=['amount','total','totalAmount','price','paymentAmount','amountValue','saleAmount'];
  for(const k of keys){
    const v=x[k];
    if(typeof v==='number' && Number.isFinite(v) && v>0) return v;
    if(typeof v==='string'){
      const m=v.replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)/);
      if(m) return Number(m[1]) || 0;
    }
  }
  const sen=Number(x.amountSen || x.paymentAmountSen || 0);
  if(Number.isFinite(sen) && sen>0) return Math.round(sen)/100;
  return 0;
}
function azAdminIsTestPaymentRecord(x){
  x=x||{};
  if(x.isAdminTestPayment===true || x.testPayment===true || x.isTestPayment===true) return true;
  const product=x.product||{};
  const hay=[
    x.orderId,x.id,x.docId,x.paymentOrderId,x.paymentReference,x.billCode,
    x.paymentMethod,x.paymentSource,x.source,x.createdBy,x.createdByAdmin,
    x.productName,x.productTitle,x.itemName,x.title,x.name,
    product.id,product.name,product.title
  ].map(v=>String(v||'').trim().toLowerCase()).join(' ');
  return /(^|\s)pabmtest[-_a-z0-9]*/.test(hay)
    || hay.includes('admin-test')
    || hay.includes('admin test')
    || hay.includes('jupem document test purchase');
}
function azAdminPurchaseLogToPaymentRecord(id, data){
  const x = {id:id || data?.id || '', ...(data||{}), _azSource:'purchaseLogs'};
  if(azAdminIsTestPaymentRecord(x)) return null;
  const category = azAdminDetectPaymentCategory(x, 'Others');

  const amount = azAdminPaymentAmount(x);
  const status = String(x.status || x.paymentStatus || '').toLowerCase();
  const paid = ['paid','verified','success','completed','approved','confirmed'].includes(status);
  const pending = !paid && (!status || ['pending','unpaid','waiting','manual','review'].includes(status));
  return {...x, category, amount, paid, pending, createdAtMs:azAdminPaymentMs(x)};
}
function azAdminStatusBucket(x){
  const status=String(x?.status || x?.paymentStatus || x?.payment_state || '').toLowerCase();
  const hay=[status,x?.resultCode,x?.reason,x?.message,x?.verification,x?.paymentStatus].map(v=>String(v||'').toLowerCase()).join(' ');
  if(['paid','verified','success','completed','approved','confirmed','settled'].includes(status) || x?.paid === true) return 'paid';
  if(hay.includes('cancel') || status === 'void' || status === 'aborted') return 'cancelled';
  if(hay.includes('fail') || hay.includes('error') || hay.includes('reject') || hay.includes('expired') || ['failed','unsuccessful','declined','rejected','expired'].includes(status)) return 'failed';
  return 'pending';
}
function azAdminPaymentRecordSearchHay(x){
  const user=x?.user||{};
  const product=x?.product||{};
  return [
    x?.id,x?.docId,x?.orderId,x?.billCode,x?.paymentReference,x?.transactionId,x?.txnId,x?.invoiceNo,x?.refNo,x?.receiptNo,
    x?.usernameKey,x?.username,x?.displayName,x?.buyerName,x?.customerName,x?.email,x?.buyerEmail,user?.username,user?.email,user?.displayName,
    x?.title,x?.name,x?.itemName,x?.filename,x?.itemCode,x?.productName,x?.productTitle,x?.productId,x?.softwareId,x?.cadId,product?.id,product?.name,product?.title,product?.category,
    x?.category,x?.status,x?.paymentStatus,x?._azSource
  ].map(v=>String(v||'').toLowerCase()).join(' ');
}
function azAdminNormalizeDateInput(v,endOfDay=false){
  const raw=String(v||'').trim();
  if(!raw) return 0;
  const d=new Date(raw+'T00:00:00');
  if(Number.isNaN(d.getTime())) return 0;
  if(endOfDay) d.setHours(23,59,59,999);
  return d.getTime();
}
function azAdminPaymentLogDateRange(dateFilter){
  const f=String(dateFilter||'all');
  const now=new Date();
  const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  if(f==='today') return {from:startToday,to:startToday+86400000-1,label:'Today'};
  if(f==='thisMonth'){
    const from=new Date(now.getFullYear(),now.getMonth(),1).getTime();
    const to=new Date(now.getFullYear(),now.getMonth()+1,1).getTime()-1;
    return {from,to,label:'This Month'};
  }
  if(f==='lastMonth'){
    const from=new Date(now.getFullYear(),now.getMonth()-1,1).getTime();
    const to=new Date(now.getFullYear(),now.getMonth(),1).getTime()-1;
    return {from,to,label:'Last Month'};
  }
  if(f==='custom'){
    const from=azAdminNormalizeDateInput($('#paymentLogsDateFrom')?.value,false);
    const to=azAdminNormalizeDateInput($('#paymentLogsDateTo')?.value,true);
    return {from,to,label:'Custom Date'};
  }
  return {from:0,to:0,label:'All Dates'};
}
function azAdminFilterPaymentRecords(records, categoryFilter, statusFilter, searchText, dateFilter){
  const filter = String(categoryFilter || 'all').toLowerCase();
  const status = String(statusFilter || 'all').toLowerCase();
  const q = String(searchText || '').trim().toLowerCase();
  const dateRange = azAdminPaymentLogDateRange(dateFilter || 'all');
  const terms = q.split(/\s+/).filter(Boolean);
  return (records||[]).filter(x=>{
    if(azAdminIsTestPaymentRecord(x)) return false;
    if(filter === 'pabm' && x.category !== 'PA/BM') return false;
    if(filter === 'software' && x.category !== 'Software') return false;
    if(filter === 'cad' && x.category !== 'CAD Tools') return false;
    const bucket=azAdminStatusBucket(x);
    if(status !== 'all' && bucket !== status) return false;
    if(dateRange.from || dateRange.to){
      const ms=azAdminPaymentMs(x);
      if(dateRange.from && (!ms || ms < dateRange.from)) return false;
      if(dateRange.to && (!ms || ms > dateRange.to)) return false;
    }
    if(terms.length){
      const hay=azAdminPaymentRecordSearchHay(x);
      if(!terms.every(t=>hay.includes(t))) return false;
    }
    return true;
  });
}
function azAdminSetPaymentLogCustomDateState(){
  const custom=String($('#paymentLogsDateFilter')?.value||'all')==='custom';
  ['#paymentLogsDateFrom','#paymentLogsDateTo'].forEach(sel=>{const el=$(sel); if(el) el.disabled=!custom;});
}
function azAdminPremiumToPaymentRecord(x){
  x=x||{};
  if(azAdminIsTestPaymentRecord(x)) return null;
  const user=x.user||{};
  const status=String(x.status||'pending').toLowerCase();
  const paid=['paid','verified','success','completed','approved','confirmed'].includes(status);
  const pending=!paid && (!status || ['pending','unpaid','waiting','manual','review'].includes(status));
  const id=String(x.orderId || x.docId || x.id || x.billCode || 'premium-'+Math.random()).trim();
  return {
    ...x,
    id,
    category:azAdminPremiumCategory(x),
    amount:azAdminPremiumAmount(x),
    status,
    paid,
    pending,
    usernameKey:user.username || x.username || x.usernameKey || '',
    username:user.username || x.username || x.usernameKey || '',
    email:user.email || x.email || x.buyerEmail || '',
    title:x.productName || x.productTitle || x.product?.name || x.product?.title || x.productId || 'Premium Order',
    itemName:x.productName || x.productTitle || x.product?.name || x.product?.title || x.productId || 'Premium Order',
    createdAtMs:azAdminPaymentMs(x),
    _azSource:'premiumOrders'
  };
}
async function azAdminLoadPremiumOrdersViaBackend(limitRows=300){
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/export?type=premiumOrders&format=json&limit='+encodeURIComponent(limitRows),{cache:'no-store'});
    const rows=Array.isArray(j?.records)?j.records:[];
    return rows.map(azAdminPremiumToPaymentRecord).filter(Boolean);
  }catch(e){
    console.warn('Admin premiumOrders backend read failed:', e);
    azAdminReportQueryError('Sales Overview/Payment Logs: premiumOrders backend', e);
    return [];
  }
}
async function azAdminResetPaBmDownloadCount(recordId, btn){
  recordId=String(recordId||'').trim();
  if(!recordId){ alert('Record ID tidak ditemui.'); return; }
  if(!confirm('Reset download limit rekod ini kembali ke 0/5 dan renew tempoh 7 hari?')) return;
  const old=btn?btn.textContent:'';
  try{
    if(btn){ btn.disabled=true; btn.textContent='Resetting...'; }
    await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/pa-bm-download/reset-count',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({recordId})
    });
    alert('Download limit sudah reset ke 0/5. Tempoh download diperbaharui 7 hari.');
    try{ await loadPayments(); }catch(_){ }
    try{ await loadPurchases(); }catch(_){ }
  }catch(e){
    alert(e?.message || 'Reset download limit gagal.');
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=old||'Reset 0/5'; }
  }
}
window.azAdminResetPaBmDownloadCount = azAdminResetPaBmDownloadCount;



const AZ_ADMIN_OVERVIEW_SALES_CACHE_KEY = 'az_admin_overview_sales_summary_v418';

const AZ_ADMIN_ACTIVE_PENDING_WINDOW_MS = 24 * 60 * 60 * 1000;
function azAdminIsPendingStatus(status){
  const s = String(status || '').trim().toLowerCase();
  return !s || ['pending','unpaid','waiting','processing','created','checkout','initiated'].includes(s);
}
function azAdminIsFinalOrPaidStatus(status){
  const s = String(status || '').trim().toLowerCase();
  return ['paid','verified','success','successful','completed','complete','settled','approved','cancelled','canceled','failed','fail','expired','void','refunded','deleted'].includes(s);
}
function azAdminPendingAgeMs(row){
  const ms = azAdminPaymentMs(row);
  return ms ? (Date.now() - ms) : Number.POSITIVE_INFINITY;
}
function azAdminIsActivePendingPayment(row){
  // AZOBSS PATCH 419:
  // Overview pending KPI should not count abandoned old checkout/payment records.
  // It counts only pending/unpaid/waiting payments that are still recent and actionable.
  if(!row) return false;
  const status = row.status || row.paymentStatus || row.billStatus || row.toyyibStatus || row.raw?.status || row.raw?.paymentStatus;
  if(azAdminIsFinalOrPaidStatus(status)) return false;
  if(!azAdminIsPendingStatus(status)) return false;

  const amount = azAdminPaymentAmount(row);
  // If amount exists, it is a payment attempt; if no amount but status is pending, still allow only if recent.
  const age = azAdminPendingAgeMs(row);
  return age >= 0 && age <= AZ_ADMIN_ACTIVE_PENDING_WINDOW_MS && (amount >= 0);
}

function azAdminOverviewSalesMoneyText(v){
  const n = Number(v || 0);
  return 'RM' + (Number.isFinite(n) ? n.toFixed(2) : '0.00');
}
function azAdminOverviewSalesValueEls(){
  return [
    document.getElementById('statTodayNetSales'),
    document.getElementById('statThisMonthNetSales'),
    document.getElementById('statThisMonthSales')
  ].filter(Boolean);
}
function azAdminSetOverviewSalesLoading(isLoading){
  azAdminOverviewSalesValueEls().forEach(el=>{
    el.classList.toggle('az-overview-sales-updating', !!isLoading);
    el.classList.toggle('az-overview-sales-loading', !!isLoading);
  });
}
function azAdminApplyOverviewSalesCache(){
  let cached = null;
  try{ cached = JSON.parse(localStorage.getItem(AZ_ADMIN_OVERVIEW_SALES_CACHE_KEY) || 'null'); }catch(_){ cached = null; }
  const hasCache = cached && Number(cached.savedAt || 0) > 0 && (Date.now() - Number(cached.savedAt || 0)) < (30 * 24 * 60 * 60 * 1000);
  const todayEl = document.getElementById('statTodayNetSales');
  const netEl = document.getElementById('statThisMonthNetSales');
  const grossEl = document.getElementById('statThisMonthSales');

  if(hasCache){
    if(todayEl && cached.todayNet !== undefined) todayEl.textContent = azAdminOverviewSalesMoneyText(cached.todayNet);
    if(netEl && cached.netAfterFee !== undefined) netEl.textContent = azAdminOverviewSalesMoneyText(cached.netAfterFee);
    if(grossEl && cached.allGross !== undefined) grossEl.textContent = azAdminOverviewSalesMoneyText(cached.allGross);
  }else{
    [todayEl, netEl, grossEl].filter(Boolean).forEach(el=>{
      if(!/^RM/i.test(String(el.textContent || '').trim())) el.textContent = 'Loading…';
    });
  }
}
function azAdminSaveOverviewSalesCache(payload = {}){
  try{
    const old = JSON.parse(localStorage.getItem(AZ_ADMIN_OVERVIEW_SALES_CACHE_KEY) || 'null') || {};
    const next = {
      ...old,
      ...payload,
      version:418,
      savedAt:Date.now(),
      savedAtText:new Date().toISOString()
    };
    localStorage.setItem(AZ_ADMIN_OVERVIEW_SALES_CACHE_KEY, JSON.stringify(next));
  }catch(e){
    console.warn('Overview sales cache save skipped:', e);
  }
}

let azAdminOverviewHasLoaded = false;
function azAdminPrepareOverviewManualMode(){
  const notice = $('#overviewLoadNotice');
  if(notice && !azAdminOverviewHasLoaded){
    notice.innerHTML = 'Overview data is not loaded. Press <b>Load Overview Data</b> only when you need the latest summary.';
  }
  if(!azAdminOverviewHasLoaded){
    ['statTodayNetSales','statThisMonthNetSales','statThisMonthSales','statUsers','statOnline','statLogins','statVisits','statMonthVisits','statTotalVisits','statSupport','statNotifications','statPurchases','statGuests'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.textContent = '—';
    });
    const support = $('#overviewSupport');
    const activity = $('#overviewActivity');
    if(support) support.innerHTML = '<div class="item">Overview data has not been loaded.</div>';
    if(activity) activity.innerHTML = '<div class="item">Overview data has not been loaded.</div>';
  }
}

async function loadOverview(forceLoad=false){
  if(forceLoad !== true){
    azAdminPrepareOverviewManualMode();
    return;
  }
  const overviewNotice = $('#overviewLoadNotice');
  if(overviewNotice) overviewNotice.textContent = 'Loading Overview data…';
  try{
    azAdminApplyOverviewSalesCache();
    azAdminSetOverviewSalesLoading(true);
  }catch(e){
    console.warn('Overview cached sales preload skipped:', e);
  }
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

  const users=await safeGet(query(collection(db,'users'),limit(50)),'Overview: users');
  const online=await safeGet(query(collection(db,'onlineUsers'),limit(50)),'Overview: onlineUsers');
  const logins=await safeGet(query(collection(db,'loginHistory'),orderBy('createdAtMs','desc'),limit(200)),'Overview: loginHistory');
  const guests=await safeGet(query(collection(db,'guestHistory'),orderBy('createdAtMs','desc'),limit(200)),'Overview: guestHistory');
  const support=await safeGet(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)),'Overview: supportMessages');
  const notif=await safeGet(query(collection(db,'notifications'),orderBy('createdAtMs','desc'),limit(50)),'Overview: notifications');
  const purchases=await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(300)),'Overview: purchaseLogs');
  const premiumOverviewOrders=await azAdminLoadPremiumOrdersViaBackend(500);
  const paymentAlertOverview=await azAdminLoadPaymentAlertSummaryOnly();

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
  async function azAdminOverviewCount(ref,label){
    return await safeCount(ref,label||'Overview count');
  }
  async function azAdminOverviewMonthGuestCount(){
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth()+1, 1).getTime();
    const counted = await azAdminOverviewCount(query(collection(db,'guestHistory'), where('createdAtMs','>=',start), where('createdAtMs','<',end)),'Overview: month guest count');
    return counted === null ? azAdminOverviewMonthCount(guests) : counted;
  }

  const overviewMonthVisits = await azAdminOverviewMonthGuestCount();
  const overviewTotalVisits = await azAdminOverviewCount(collection(db,'guestHistory'),'Overview: total visits count');
  const overviewTotalUsers = await azAdminOverviewCount(collection(db,'users'),'Overview: total users count');

  $('#statUsers').textContent=overviewTotalUsers === null ? (users?.size??0) : overviewTotalUsers;
  $('#statOnline').textContent=String(window.azAdminRealOnlineCount || 0);
  $('#statLogins').textContent=azAdminOverviewTodayCount(logins);
  $('#statVisits').textContent=azAdminOverviewTodayCount(guests);
  $('#statMonthVisits').textContent=overviewMonthVisits;
  $('#statTotalVisits').textContent=overviewTotalVisits === null ? (guests?.size??0) : overviewTotalVisits;
  let openSupportCount=0;
  support?.forEach(d=>{const x=d.data(); const status=String(x.status||'open').toLowerCase(); const reply=String(x.reply||'').trim(); if(status==='open' || !reply) openSupportCount++;});
  let pendingPurchaseCount=0;
  purchases?.forEach(d=>{
    const record=azAdminPurchaseLogToPaymentRecord(d.id,d.data());
    if(record && azAdminIsActivePendingPayment(record)) pendingPurchaseCount++;
  });
  premiumOverviewOrders.forEach(x=>{
    if(azAdminIsActivePendingPayment(x)) pendingPurchaseCount++;
  });
  $('#statSupport').textContent=openSupportCount;
  let azOverviewActiveNotifications=0; notif?.forEach(d=>{if(d.data()?.active===true)azOverviewActiveNotifications++;}); $('#statNotifications').textContent=String(azOverviewActiveNotifications);
  azAdminSetPaymentAlertBadge(paymentAlertOverview?.unreadCount||0);
  $('#statPurchases').textContent=pendingPurchaseCount;
  $('#statGuests').textContent=overviewTotalVisits === null ? (guests?.size??0) : overviewTotalVisits;

  // AZOBSS PATCH 388:
  // Overview "This Month Sales" now uses the same paid-only records logic as Sales Overview.
  // Previous patch missed amounts stored as strings like "RM20.00".
  function azAdminOverviewNormalizeSaleRecord(x){
    const amount = azAdminPaymentAmount(x);
    const createdAtMs = azAdminPaymentMs(x);
    return {...(x||{}), amount, createdAtMs};
  }
  const azOverviewRecords=[];
  purchases?.forEach(d=>{
    const record=azAdminPurchaseLogToPaymentRecord(d.id,d.data());
    if(record) azOverviewRecords.push(record);
  });
  premiumOverviewOrders.forEach(x=>azOverviewRecords.push(azAdminOverviewNormalizeSaleRecord(x)));
  const azOverviewNow=new Date();
  const azOverviewMonthStart=new Date(azOverviewNow.getFullYear(),azOverviewNow.getMonth(),1).getTime();
  const azOverviewMonthEnd=new Date(azOverviewNow.getFullYear(),azOverviewNow.getMonth()+1,1).getTime();
  const azOverviewTodayStart=new Date(azOverviewNow.getFullYear(),azOverviewNow.getMonth(),azOverviewNow.getDate()).getTime();
  const azOverviewTomorrowStart=new Date(azOverviewNow.getFullYear(),azOverviewNow.getMonth(),azOverviewNow.getDate()+1).getTime();
  const azOverviewAllPaid=azAdminPaidRevenueRecords(azOverviewRecords);

  // AZOBSS PATCH 417:
  // Overview Admin top sales cards must mirror the primary Sales Overview totals:
  // All Paid Gross / Net After Fee. They should not reset to RM0.00 simply because
  // the calendar month changed. Detailed month/today analytics remain in Sales Overview.
  const azOverviewTodayPaid=azOverviewAllPaid.filter(x=>{
    const ms=azAdminPaymentMs(x);
    return ms && ms>=azOverviewTodayStart && ms<azOverviewTomorrowStart;
  });
  const azOverviewTodaySales=azOverviewTodayPaid.reduce((sum,x)=>sum+(Number(x.amount||0)||0),0);
  const azOverviewTodayNet=azAdminNetAfterToyyibPay(azOverviewTodaySales, azOverviewTodayPaid.length);

  const azOverviewAllGross=azOverviewAllPaid.reduce((sum,x)=>sum+(Number(x.amount||0)||0),0);
  const azOverviewAllNet=azAdminNetAfterToyyibPay(azOverviewAllGross, azOverviewAllPaid.length);

  const azTodayNetSalesEl=$('#statTodayNetSales');
  if(azTodayNetSalesEl) azTodayNetSalesEl.textContent='RM'+azAdminMoney(azOverviewTodayNet);
  const azMonthSalesEl=$('#statThisMonthSales');
  if(azMonthSalesEl) azMonthSalesEl.textContent='RM'+azAdminMoney(azOverviewAllGross);
  const azMonthNetSalesEl=$('#statThisMonthNetSales');
  if(azMonthNetSalesEl) azMonthNetSalesEl.textContent='RM'+azAdminMoney(azOverviewAllNet);
  azAdminSaveOverviewSalesCache({
    todayNet:azOverviewTodayNet,
    allGross:azOverviewAllGross,
    netAfterFee:azOverviewAllNet,
    paidCount:azOverviewAllPaid.length,
    source:'overview-admin'
  });
  azAdminSetOverviewSalesLoading(false);

  const supportRows=[];
  support?.forEach(d=>{if(supportRows.length<5){const x=d.data();supportRows.push(item(esc(x.subject||'Support Request'),`${esc(x.email||'')} • ${esc(x.status||'open')}`))}});
  $('#overviewSupport').innerHTML=supportRows.join('')||'<div class="item">No support messages.</div>';

  const activityRows=[];
  logins?.forEach(d=>{if(activityRows.length<5){const x=d.data();activityRows.push(item(esc(x.username||x.email||'Login'),`${esc(x.email||'')} • ${fmtDate(x.createdAtMs||x.createdAt)}`))}});
  $('#overviewActivity').innerHTML=activityRows.join('')||'<div class="item">No activity.</div>';

  try{ if(window.azSetRealOnlineCount) window.azSetRealOnlineCount(window.azAdminRealOnlineCount || 0); }catch(e){}

  azAdminOverviewHasLoaded = true;
  if(overviewNotice){
    overviewNotice.textContent = 'Overview data loaded at ' + new Date().toLocaleString('en-MY', { timeZone:'Asia/Kuala_Lumpur' }) + '. Press Load Overview Data again to refresh manually.';
  }
}

async function loadUsers(){ return; }

async function loadSupport(){
  const snap=await safeGet(query(collection(db,'supportMessages'),orderBy('createdAtMs','desc'),limit(50)),'Support Inbox');
  const rows=[];
  snap?.forEach(d=>{
    const x=d.data();
    rows.push(`<div class="item">
      <div class="item-row"><div><div class="item-title">${esc(x.subject||'Support Request')}</div><div>${esc(x.message||'')}</div>${x.reply?`<div class="item-meta ok">Reply: ${esc(x.reply)}</div>`:''}<div class="item-meta">${esc(x.email||'')} • ${esc(x.status||'open')} • ${fmtDate(x.createdAtMs||x.createdAt)}</div></div><div class="item-actions"><button class="btn red" data-del-support="${d.id}">Delete</button></div></div>
      <div class="toolbar"><input id="reply_${d.id}" placeholder="Reply..." style="flex:1"><button class="btn green" data-reply-support="${d.id}">Reply</button></div>
    </div>`);
  });
  $('#supportList').innerHTML=rows.join('')||'<div class="item">No support messages.</div>';
  azAdminApplyPager('#supportList',{key:'supportList',pageSize:8,label:'support',reset:true});
}
async function loadNotifications(){
  let snap=await safeGet(query(collection(db,'notifications'),orderBy('createdAtMs','desc'),limit(50)),'Notifications: latest');
  const rows=[];
  snap?.forEach(d=>{const x=d.data();if(x.active!==true)return;rows.push(item(esc(x.title||'Notification'),`${esc(x.body||'')} • ${esc(x.type||'system')} • ${fmtDate(x.createdAtMs||x.createdAt)}`,`<button class="btn red" data-del-notif="${d.id}">Delete</button>`))});
  $('#notificationsList').innerHTML=rows.join('')||'<div class="item">No notifications available.</div>';
  azAdminApplyPager('#notificationsList',{key:'notificationsList',pageSize:8,label:'notifications',reset:true});
}


/* AZOBSS PATCH 305: Admin Payment Alerts / Notification Center. */
let azAdminPaymentAlertsCache=[];
let azAdminPaymentAlertSummary={unreadCount:0,total:0};
function azAdminSetPaymentAlertBadge(n){
  n=Math.max(0,Number(n||0)||0);
  const badge=$('#adminPaymentAlertBadge');
  if(badge){ badge.textContent=String(n); badge.hidden=!n; }
  const stat=$('#statPaymentAlerts');
  if(stat) stat.textContent=String(n);
  const unread=$('#alertUnreadCount');
  if(unread) unread.textContent=String(n);
}
function azPaymentAlertCategoryLabel(cat){
  cat=String(cat||'').toLowerCase();
  if(cat==='pabm'||cat==='pa-bm')return 'PA/BM';
  if(cat==='cad')return 'CAD Tools';
  if(cat==='service')return 'Service';
  return 'Software';
}
function azPaymentAlertSearchText(x){
  return [x.title,x.body,x.category,x.productName,x.productId,x.username,x.email,x.orderId,x.billCode,x.paymentReference,x.amountText].map(v=>String(v||'').toLowerCase()).join(' ');
}
function azPaymentAlertFilteredRows(){
  const q=String($('#adminPaymentAlertSearch')?.value||'').trim().toLowerCase();
  const f=String($('#adminPaymentAlertFilter')?.value||'all').toLowerCase();
  return (azAdminPaymentAlertsCache||[]).filter(x=>{
    if(f==='unread' && x.read) return false;
    if(['pabm','software','cad','service'].includes(f) && String(x.category||'').toLowerCase()!==f) return false;
    if(q && !azPaymentAlertSearchText(x).includes(q)) return false;
    return true;
  });
}
function renderAdminPaymentAlerts(){
  const rows=azPaymentAlertFilteredRows();
  const box=$('#adminPaymentAlertsList');
  const notice=$('#adminPaymentAlertsNotice');
  const unreadCount=Number(azAdminPaymentAlertSummary.unreadCount||0)||0;
  const totalRm=rows.reduce((sum,x)=>sum+(Number(x.amountRm||x.saleAmount||0)||0),0);
  azAdminSetText('#alertLoadedCount',rows.length);
  azAdminSetText('#alertSalesTotal',azAdminMoney(totalRm));
  azAdminSetPaymentAlertBadge(unreadCount);
  if(notice) notice.textContent=`${rows.length} alert loaded • ${unreadCount} unread`;
  if(!box) return;
  box.innerHTML=rows.map(x=>{
    const id=esc(x.id||x.docId||'');
    const unread=!x.read;
    const cat=azPaymentAlertCategoryLabel(x.category);
    const catKey=String(x.category||'').toLowerCase();
    const icon=(catKey==='pabm'||catKey==='pa-bm')?'🗺️':(catKey==='cad'?'📐':(catKey==='service'?'🛠️':'💻'));
    const rm=Number(x.amountRm||x.saleAmount||0)||0;
    const title=esc(x.title||('New '+cat+' payment paid'));
    const product=esc(x.body||x.productName||'Payment received');
    const when=fmtDate(x.createdAtMs||x.createdAt);
    const meta=[];
    if(x.username) meta.push(`<span>👤 ${esc(x.username)}</span>`);
    if(x.email) meta.push(`<span>✉ ${esc(x.email)}</span>`);
    if(x.orderId) meta.push(`<span>Order ${esc(x.orderId)}</span>`);
    if(x.billCode) meta.push(`<span>Bill ${esc(x.billCode)}</span>`);
    return `<article class="az-payment-alert-row ${unread?'is-unread':''}">
      <div class="az-payment-alert-icon" aria-hidden="true">${icon}</div>
      <div class="az-payment-alert-main">
        <div class="az-payment-alert-titleline">
          <span class="az-payment-alert-title">${title}</span>
          <span class="az-alert-chip success">${esc(cat)}</span>
          ${unread?'<span class="az-alert-chip unread">Unread</span>':''}
        </div>
        <div class="az-payment-alert-product">${product}</div>
        <div class="az-payment-alert-meta">${meta.join('')}</div>
      </div>
      <div class="az-payment-alert-side">
        <div class="az-payment-alert-amount">${rm?'RM'+azAdminMoney(rm):'—'}</div>
        <time class="az-payment-alert-time">${esc(when)}</time>
        <div class="az-payment-alert-actions">
          ${unread?`<button class="btn az-payment-alert-action is-read" data-admin-alert-read="${id}" type="button" title="Mark as read" aria-label="Mark as read">✓</button>`:''}
          ${catKey==='service'?`<button class="btn az-payment-alert-action is-log" data-tab="servicebookings" type="button" title="Open Service Bookings" aria-label="Open Service Bookings">🛠️</button>`:`<button class="btn az-payment-alert-action is-log" data-tab="purchases" type="button" title="Open Payment Logs" aria-label="Open Payment Logs">🧾</button><button class="btn az-payment-alert-action is-sales" data-tab="payments" type="button" title="Open Sales Overview" aria-label="Open Sales Overview">▥</button>`}
        </div>
      </div>
    </article>`;
  }).join('') || '<div class="az-sales-empty">No payment alerts found for the selected filter.</div>';
  azAdminApplyPager('#adminPaymentAlertsList',{key:'adminPaymentAlertsList',pageSize:8,label:'alerts',reset:true});
}
async function loadAdminPaymentAlerts(){
  const notice=$('#adminPaymentAlertsNotice');
  if(notice) notice.textContent='Loading admin payment alerts...';
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payment-notifications?limit=120',{cache:'no-store'});
    azAdminPaymentAlertsCache=Array.isArray(j.records)?j.records:[];
    azAdminPaymentAlertSummary={unreadCount:Number(j.unreadCount||0)||0,total:Number(j.total||azAdminPaymentAlertsCache.length)||azAdminPaymentAlertsCache.length};
    renderAdminPaymentAlerts();
    return azAdminPaymentAlertSummary;
  }catch(e){
    console.warn('Admin payment alerts load failed',e);
    azAdminPaymentAlertsCache=[];
    azAdminPaymentAlertSummary={unreadCount:0,total:0,error:e?.message||String(e||'')};
    azAdminSetPaymentAlertBadge(0);
    if(notice) notice.textContent='Unable to load payment alerts: '+(e?.message||e);
    if($('#adminPaymentAlertsList')) $('#adminPaymentAlertsList').innerHTML='<div class="item">Unable to load admin payment alerts.</div>';
    return azAdminPaymentAlertSummary;
  }
}
async function azAdminPaymentAlertAction(action,id){
  try{
    await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payment-notifications-action',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})
    });
    await loadAdminPaymentAlerts();
    if(action==='mark-read') toast('Payment alert marked as read.');
    if(action==='mark-all-read') toast('All payment alerts marked as read.');
    if(action==='clear-read') toast('Read payment alerts cleared.');
  }catch(e){toast(e?.message||'Payment alert action failed.');}
}
async function azAdminLoadPaymentAlertSummaryOnly(){
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payment-notifications?limit=120',{cache:'no-store'});
    azAdminPaymentAlertsCache=Array.isArray(j.records)?j.records:[];
    azAdminPaymentAlertSummary={unreadCount:Number(j.unreadCount||0)||0,total:Number(j.total||azAdminPaymentAlertsCache.length)||azAdminPaymentAlertsCache.length};
    azAdminSetPaymentAlertBadge(azAdminPaymentAlertSummary.unreadCount||0);
    return azAdminPaymentAlertSummary;
  }catch(e){
    console.warn('Overview payment alert summary skipped',e);
    azAdminSetPaymentAlertBadge(0);
    return {unreadCount:0,total:0,error:e?.message||String(e||'')};
  }
}


/* AZOBSS PATCH 301: Lightweight Sales Overview analytics charts (no external library). */
function azAdminMoney(n){
  const num=Number(n||0);
  return Number.isFinite(num)?num.toFixed(2):'0.00';
}
function azAdminSetText(sel,val){
  const el=$(sel);
  if(el) el.textContent=String(val);
}
function azAdminMonthKeyFromDate(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function azAdminMonthLabel(key){
  const parts=String(key||'').split('-');
  const y=Number(parts[0]||0);
  const m=Number(parts[1]||1)-1;
  const d=new Date(y,m,1);
  if(Number.isNaN(d.getTime())) return key||'-';
  return d.toLocaleDateString('en-MY',{month:'short',year:'2-digit'});
}
function azAdminLastMonthKeys(count=6){
  const now=new Date();
  const out=[];
  for(let i=count-1;i>=0;i--){
    out.push(azAdminMonthKeyFromDate(new Date(now.getFullYear(),now.getMonth()-i,1)));
  }
  return out;
}
function azAdminToyyibPayFeePerTransaction(){return 1;}
function azAdminNetAfterToyyibPay(gross, transactionCount){const fee=(Number(transactionCount||0)||0)*azAdminToyyibPayFeePerTransaction();return Math.max(0,(Number(gross||0)||0)-fee);}
function azAdminPaidRevenueRecords(records){return (records||[]).filter(x=>!azAdminIsTestPaymentRecord(x)&&azAdminStatusBucket(x)==='paid'&&(Number(x.amount||0)||0)>0);}
function azAdminLedgerNum(v){
  const n=Number(String(v??'').replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:0;
}
function azAdminLedgerStatus(row={}){
  return String(row.status||row.paymentStatus||'').trim().toLowerCase();
}
function azAdminLedgerIsPaid(row={}){ return azAdminLedgerStatus(row)==='paid'; }
function azAdminLedgerDateMs(row={}){
  const direct=azAdminLedgerNum(row.saleDateMs||row.paidAtMs||row.createdAtMs||row.updatedAtMs);
  if(direct>0)return direct;
  const raw=row.saleDateTime||row.saleDate||row.paidAt||row.createdAt||row.updatedAt||'';
  const ms=Date.parse(raw);return Number.isFinite(ms)?ms:0;
}
function azAdminLedgerItems(row={}){ return Array.isArray(row.items)?row.items:[]; }
function azAdminLedgerCategories(row={}){
  if(Array.isArray(row.categories)&&row.categories.length)return row.categories.map(x=>String(x||'other').toLowerCase());
  return [String(row.category||'other').toLowerCase()];
}
function azAdminLedgerCategoryGross(row={}, wanted=[]){
  const set=new Set(Array.isArray(wanted)?wanted:[wanted]);
  const subtotal=azAdminLedgerNum(row.subtotal)||azAdminLedgerNum(row.gross);
  const gross=azAdminLedgerNum(row.gross);
  if(subtotal<=0||gross<=0)return 0;
  const items=azAdminLedgerItems(row);
  if(items.length){
    const factor=gross/subtotal;
    return items.filter(i=>set.has(String(i.category||'other').toLowerCase())).reduce((sum,i)=>sum+(azAdminLedgerNum(i.qty)||1)*azAdminLedgerNum(i.unitPrice)*factor,0);
  }
  return azAdminLedgerCategories(row).some(c=>set.has(c))?gross:0;
}
function azAdminLedgerCostParts(row={}){
  const productCost=azAdminLedgerNum(row.productCost);
  const shippingCost=azAdminLedgerNum(row.shippingCost);
  const paymentFee=azAdminLedgerNum(row.paymentFee);
  const commission=azAdminLedgerNum(row.commission);
  const otherCost=azAdminLedgerNum(row.otherCost);
  const calculated=productCost+shippingCost+paymentFee+commission+otherCost;
  const stored=azAdminLedgerNum(row.totalCost);
  const totalCost=stored>0||calculated===0?stored:calculated;
  return {productCost,shippingCost,paymentFee,commission,otherCost,totalCost};
}
function azAdminLedgerProfit(row={}){
  const gross=azAdminLedgerNum(row.gross);
  const stored=Number(row.profit);
  return Number.isFinite(stored)?stored:gross-azAdminLedgerCostParts(row).totalCost;
}
function azAdminLedgerStatusBucket(row={}){
  const s=azAdminLedgerStatus(row);
  if(s.startsWith('quote'))return 'quotation';
  if(s==='paid')return 'paid';
  if(['pending','deposit-paid','unpaid','waiting','processing','created','checkout','initiated'].includes(s)||!s)return 'pending';
  if(['cancelled','canceled','refunded','void'].includes(s))return 'cancelled';
  if(['failed','fail','expired'].includes(s))return 'failed';
  return 'other';
}
function azAdminLedgerProductName(row={}){
  const items=azAdminLedgerItems(row);
  if(items.length)return String(items[0]?.name||'Purchase').trim()||'Purchase';
  return String(row.productName||row.productTitle||row.itemName||row.title||row.name||row.filename||row.itemCode||'Purchase').trim()||'Purchase';
}
function azAdminLedgerPrimaryCategory(row={}){
  const cats=azAdminLedgerCategories(row);
  const labels={pabm:'PA/BM',software:'Software',cad:'CAD Tools',physical:'Hardware','computer-it':'Computer & IT',service:'Service',other:'Other',mixed:'Mixed'};
  return cats.length===1?(labels[cats[0]]||'Other'):'Mixed';
}
function azAdminLedgerSummary(rows=[]){
  const all=Array.isArray(rows)?rows:[];
  const paid=all.filter(azAdminLedgerIsPaid);
  const out={gross:0,subtotal:0,discount:0,shippingCharge:0,productCost:0,shippingCost:0,paymentFee:0,commission:0,otherCost:0,totalCost:0,profit:0,paid:paid.length,pending:0,quotation:0,total:all.length,categories:{pabm:0,software:0,cad:0,hardware:0,service:0,other:0}};
  all.forEach(row=>{const b=azAdminLedgerStatusBucket(row);if(b==='pending')out.pending++;if(b==='quotation')out.quotation++;});
  paid.forEach(row=>{
    const gross=azAdminLedgerNum(row.gross);const c=azAdminLedgerCostParts(row);
    out.gross+=gross;out.subtotal+=azAdminLedgerNum(row.subtotal);out.discount+=azAdminLedgerNum(row.discount);out.shippingCharge+=azAdminLedgerNum(row.shippingCharge);
    out.productCost+=c.productCost;out.shippingCost+=c.shippingCost;out.paymentFee+=c.paymentFee;out.commission+=c.commission;out.otherCost+=c.otherCost;out.totalCost+=c.totalCost;out.profit+=azAdminLedgerProfit(row);
    out.categories.pabm+=azAdminLedgerCategoryGross(row,['pabm']);
    out.categories.software+=azAdminLedgerCategoryGross(row,['software']);
    out.categories.cad+=azAdminLedgerCategoryGross(row,['cad']);
    out.categories.hardware+=azAdminLedgerCategoryGross(row,['physical','computer-it']);
    out.categories.service+=azAdminLedgerCategoryGross(row,['service']);
    const known=out.categories; // marker only; Other is calculated per-row below.
    const allocated=azAdminLedgerCategoryGross(row,['pabm','software','cad','physical','computer-it','service']);
    out.categories.other+=Math.max(0,gross-allocated);
  });
  return out;
}
async function azAdminWaitForSalesLedgerBridge(timeoutMs=7000){
  const started=Date.now();
  while(typeof window.azSalesReceiptsAnalyticsSnapshot!=='function'&&Date.now()-started<timeoutMs){await new Promise(r=>setTimeout(r,100));}
  return typeof window.azSalesReceiptsAnalyticsSnapshot==='function';
}
async function azAdminLoadCanonicalSalesLedger(force=false){
  const ready=await azAdminWaitForSalesLedgerBridge();
  if(!ready)throw new Error('Sales & Receipts ledger module is not ready.');
  const snapshot=await window.azSalesReceiptsAnalyticsSnapshot({force});
  const rows=Array.isArray(snapshot?.rows)?snapshot.rows:[];
  return {rows,source:snapshot?.source||'sales-receipts-ledger',generatedAt:snapshot?.generatedAt||Date.now()};
}
function azAdminRenderBarRows(targetSel, rows, opts={}){
  const box=$(targetSel);if(!box)return;rows=Array.isArray(rows)?rows:[];const empty=opts.empty||'No data yet.';
  if(!rows.length){box.innerHTML='<div class="az-sales-empty">'+esc(empty)+'</div>';return;}
  const max=Math.max(...rows.map(r=>Number(r.value||0)||0),1);
  box.innerHTML=rows.map(r=>{const pct=Math.max(3,Math.min(100,((Number(r.value||0)||0)/max)*100));const fillClass=r.fillClass?(' '+String(r.fillClass).replace(/[^a-z0-9_-]/gi,'')):'';const label=esc(r.label||'-');const value=esc(r.valueText||String(r.value||0));return `<div class="az-sales-chart-row"><div class="az-sales-chart-label" title="${label}">${label}</div><div class="az-sales-chart-track"><div class="az-sales-chart-fill${fillClass}" style="width:${pct.toFixed(1)}%"></div></div><div class="az-sales-chart-value">${value}</div></div>`;}).join('')+(opts.note?'<div class="az-sales-small-note">'+esc(opts.note)+'</div>':'');
}
function azAdminRenderTopProducts(rows){
  const box=$('#salesTopProducts');if(!box)return;if(!rows.length){box.innerHTML='<div class="az-sales-empty">No paid product sales yet.</div>';return;}
  box.innerHTML=rows.slice(0,5).map((r,i)=>{const meta=[r.category,(r.count||0)+' item'+((r.count||0)>1?'s':'')].filter(Boolean).join(' • ');return `<div class="az-sales-top-product"><div class="az-sales-rank">${i+1}</div><div><div class="az-sales-product-title">${esc(r.name)}</div><div class="az-sales-product-meta">${esc(meta)}</div></div><div class="az-sales-product-amount">RM${azAdminMoney(r.amount)}</div></div>`;}).join('');
}
function azAdminLedgerPeriod(rows,startMs=0){
  const paid=(rows||[]).filter(row=>azAdminLedgerIsPaid(row)&&(!startMs||azAdminLedgerDateMs(row)>=startMs));
  return paid.reduce((o,row)=>{const c=azAdminLedgerCostParts(row);o.gross+=azAdminLedgerNum(row.gross);o.cost+=c.totalCost;o.profit+=azAdminLedgerProfit(row);o.fee+=c.paymentFee;o.orders++;return o;},{gross:0,cost:0,profit:0,fee:0,orders:0});
}

const AZ_ADMIN_SALES_TREND_STORAGE='azobss_admin_sales_trend_v1381';
function azAdminSalesTrendDefaultSettings(){return {range:'6',type:'line',gross:true,profit:true,cost:false,values:false};}
function azAdminSalesTrendReadSettings(){
  const d=azAdminSalesTrendDefaultSettings();
  try{Object.assign(d,JSON.parse(localStorage.getItem(AZ_ADMIN_SALES_TREND_STORAGE)||'{}')||{});}catch(_){}
  const range=$('#salesTrendRange'),type=$('#salesTrendType'),gross=$('#salesTrendGross'),profit=$('#salesTrendProfit'),cost=$('#salesTrendCost'),values=$('#salesTrendValues');
  if(range)d.range=range.value||d.range;
  if(type)d.type=type.value||d.type;
  if(gross)d.gross=!!gross.checked;
  if(profit)d.profit=!!profit.checked;
  if(cost)d.cost=!!cost.checked;
  if(values)d.values=!!values.checked;
  return d;
}
function azAdminSalesTrendApplySettings(s){
  const d={...azAdminSalesTrendDefaultSettings(),...(s||{})};
  const range=$('#salesTrendRange'),type=$('#salesTrendType'),gross=$('#salesTrendGross'),profit=$('#salesTrendProfit'),cost=$('#salesTrendCost'),values=$('#salesTrendValues');
  if(range)range.value=d.range;
  if(type)type.value=d.type;
  if(gross)gross.checked=!!d.gross;
  if(profit)profit.checked=!!d.profit;
  if(cost)cost.checked=!!d.cost;
  if(values)values.checked=!!d.values;
}
function azAdminSalesTrendSaveSettings(s){try{localStorage.setItem(AZ_ADMIN_SALES_TREND_STORAGE,JSON.stringify(s));}catch(_){}}
function azAdminSalesTrendMonthKeys(range){
  if(String(range)==='year'){
    const now=new Date(),out=[];
    for(let m=0;m<=now.getMonth();m++)out.push(azAdminMonthKeyFromDate(new Date(now.getFullYear(),m,1)));
    return out;
  }
  return azAdminLastMonthKeys(Math.max(1,Math.min(36,Number(range)||6)));
}
function azAdminSalesTrendCompactRM(v){
  const raw=Number(v)||0,n=Math.abs(raw),sign=raw<0?'-':'';
  if(n>=1000000)return sign+'RM'+(n/1000000).toFixed(n>=10000000?0:1)+'m';
  if(n>=1000)return sign+'RM'+(n/1000).toFixed(n>=10000?0:1)+'k';
  return sign+'RM'+n.toFixed(n>=100?0:2);
}
function azAdminSalesTrendEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function azAdminSalesTrendData(records,range){
  const keys=azAdminSalesTrendMonthKeys(range);
  const totals=Object.fromEntries(keys.map(k=>[k,{key:k,label:azAdminMonthLabel(k),gross:0,cost:0,profit:0,orders:0}]));
  (records||[]).filter(azAdminLedgerIsPaid).forEach(row=>{
    const ms=azAdminLedgerDateMs(row);if(!ms)return;
    const key=azAdminMonthKeyFromDate(new Date(ms));if(!(key in totals))return;
    const c=azAdminLedgerCostParts(row);
    totals[key].gross+=azAdminLedgerNum(row.gross);
    totals[key].cost+=c.totalCost;
    totals[key].profit+=azAdminLedgerProfit(row);
    totals[key].orders++;
  });
  return keys.map(k=>totals[k]);
}
function azAdminSalesTrendEnabled(s){
  const out=[];
  if(s.gross)out.push({key:'gross',label:'Gross Sales',cls:'gross'});
  if(s.profit)out.push({key:'profit',label:'Net Profit',cls:'profit'});
  if(s.cost)out.push({key:'cost',label:'Total Costs',cls:'cost'});
  return out;
}
function azAdminRenderMonthlySalesProfitTrend(records){
  const box=$('#salesMonthlyTrend'),legend=$('#salesTrendLegend'),summary=$('#salesTrendSummary');if(!box)return;
  const s=azAdminSalesTrendReadSettings(),data=azAdminSalesTrendData(records,s.range),series=azAdminSalesTrendEnabled(s);
  if(!series.length){
    box.innerHTML='<div class="az-sales-empty" style="margin:12px">Pilih sekurang-kurangnya satu metric: Gross Sales, Net Profit atau Total Costs.</div>';
    if(legend)legend.innerHTML='';if(summary)summary.innerHTML='';return;
  }
  const W=860,H=300,L=62,R=18,T=24,B=48,plotW=W-L-R,plotH=H-T-B,vals=[];
  data.forEach(d=>series.forEach(x=>vals.push(Number(d[x.key]||0))));
  let min=Math.min(0,...vals),max=Math.max(0,...vals);if(max===min)max=min+1;
  const pad=(max-min)*.08;max+=pad;if(min<0)min-=pad;
  const y=v=>T+((max-Number(v||0))/(max-min))*plotH;
  const zeroY=y(0),stepX=data.length>1?plotW/(data.length-1):plotW/2;
  const x=i=>data.length>1?L+i*stepX:L+plotW/2;
  let svg=`<svg class="az-sales-trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly Sales and Profit Trend">`;
  for(let i=0;i<=4;i++){
    const yy=T+(plotH*i/4),val=max-((max-min)*i/4);
    svg+=`<line class="az-sales-trend-grid" x1="${L}" y1="${yy.toFixed(1)}" x2="${W-R}" y2="${yy.toFixed(1)}"></line><text class="az-sales-trend-axis-label" x="${L-8}" y="${(yy+3).toFixed(1)}" text-anchor="end">${azAdminSalesTrendEsc(azAdminSalesTrendCompactRM(val))}</text>`;
  }
  svg+=`<line class="az-sales-trend-axis" x1="${L}" y1="${zeroY.toFixed(1)}" x2="${W-R}" y2="${zeroY.toFixed(1)}"></line>`;
  data.forEach((d,i)=>{svg+=`<text class="az-sales-trend-x-label" x="${x(i).toFixed(1)}" y="${H-17}" text-anchor="middle">${azAdminSalesTrendEsc(d.label)}</text>`;});
  if(s.type==='bar'){
    const slot=data.length?plotW/data.length:plotW;
    const groupW=Math.min(58,slot*.72),barGap=3,barW=Math.max(4,(groupW-(series.length-1)*barGap)/series.length);
    data.forEach((d,i)=>{
      const center=data.length>1?x(i):L+plotW/2;
      series.forEach((meta,j)=>{
        const v=Number(d[meta.key]||0),yy=y(v),top=Math.min(yy,zeroY),height=Math.max(1,Math.abs(zeroY-yy)),bx=center-groupW/2+j*(barW+barGap);
        svg+=`<rect class="az-sales-trend-bar-${meta.cls}" x="${bx.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${height.toFixed(1)}" rx="3"><title>${azAdminSalesTrendEsc(d.label+' • '+meta.label+': RM'+azAdminMoney(v))}</title></rect>`;
        if(s.values&&data.length<=12)svg+=`<text class="az-sales-trend-value-label az-sales-trend-value-${meta.cls}" x="${(bx+barW/2).toFixed(1)}" y="${Math.max(12,top-5).toFixed(1)}">${azAdminSalesTrendEsc(azAdminSalesTrendCompactRM(v))}</text>`;
      });
    });
  }else{
    series.forEach(meta=>{
      const pts=data.map((d,i)=>`${x(i).toFixed(1)},${y(d[meta.key]).toFixed(1)}`).join(' ');
      svg+=`<polyline class="az-sales-trend-line-${meta.cls}" points="${pts}"></polyline>`;
      data.forEach((d,i)=>{
        const xx=x(i),yy=y(d[meta.key]),v=Number(d[meta.key]||0);
        svg+=`<circle class="az-sales-trend-point-${meta.cls}" cx="${xx.toFixed(1)}" cy="${yy.toFixed(1)}" r="4"><title>${azAdminSalesTrendEsc(d.label+' • '+meta.label+': RM'+azAdminMoney(v))}</title></circle>`;
        if(s.values&&data.length<=12)svg+=`<text class="az-sales-trend-value-label az-sales-trend-value-${meta.cls}" x="${xx.toFixed(1)}" y="${Math.max(12,yy-(meta.key==='profit'?9:18)).toFixed(1)}">${azAdminSalesTrendEsc(azAdminSalesTrendCompactRM(v))}</text>`;
      });
    });
  }
  svg+='</svg>';box.innerHTML=svg;
  if(legend)legend.innerHTML=series.map(meta=>`<span class="az-sales-trend-legend-item"><span class="az-sales-trend-dot ${meta.cls}"></span>${azAdminSalesTrendEsc(meta.label)}</span>`).join('');
  const totals=data.reduce((o,d)=>{o.gross+=d.gross;o.cost+=d.cost;o.profit+=d.profit;o.orders+=d.orders;return o;},{gross:0,cost:0,profit:0,orders:0});
  const margin=totals.gross?totals.profit/totals.gross*100:0;
  if(summary)summary.innerHTML=`<span>Gross <b>RM${azAdminMoney(totals.gross)}</b></span><span>Costs <b>RM${azAdminMoney(totals.cost)}</b></span><span>Net Profit <b>RM${azAdminMoney(totals.profit)}</b></span><span>Margin <b>${margin.toFixed(1)}%</b></span><span>Paid Orders <b>${totals.orders}</b></span>`;
}
function azAdminInitSalesTrendControls(){
  if(window.__azAdminSalesTrendControlsBound)return;
  window.__azAdminSalesTrendControlsBound=true;
  let saved=azAdminSalesTrendDefaultSettings();
  try{saved={...saved,...JSON.parse(localStorage.getItem(AZ_ADMIN_SALES_TREND_STORAGE)||'{}')};}catch(_){}
  azAdminSalesTrendApplySettings(saved);
  ['#salesTrendRange','#salesTrendType','#salesTrendGross','#salesTrendProfit','#salesTrendCost','#salesTrendValues'].forEach(sel=>{
    const el=$(sel);if(!el)return;
    el.addEventListener('change',()=>{
      const s=azAdminSalesTrendReadSettings();azAdminSalesTrendSaveSettings(s);
      azAdminRenderMonthlySalesProfitTrend(window.__azAdminSalesTrendRecords||[]);
    });
  });
  $('#salesTrendReset')?.addEventListener('click',()=>{
    const d=azAdminSalesTrendDefaultSettings();
    azAdminSalesTrendApplySettings(d);azAdminSalesTrendSaveSettings(d);
    azAdminRenderMonthlySalesProfitTrend(window.__azAdminSalesTrendRecords||[]);
  });
}

function azAdminRenderSalesOverviewCharts(records){
  records=Array.isArray(records)?records:[];const paid=records.filter(azAdminLedgerIsPaid);const now=new Date();
  const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();const monthStart=new Date(now.getFullYear(),now.getMonth(),1).getTime();const yearStart=new Date(now.getFullYear(),0,1).getTime();
  const today=azAdminLedgerPeriod(records,todayStart),month=azAdminLedgerPeriod(records,monthStart),year=azAdminLedgerPeriod(records,yearStart),all=azAdminLedgerPeriod(records,0);
  azAdminSetText('#salesTodayTotal',azAdminMoney(today.gross));azAdminSetText('#salesTodayCostTotal',azAdminMoney(today.cost));azAdminSetText('#salesTodayNetTotal',azAdminMoney(today.profit));
  azAdminSetText('#salesThisMonthTotal',azAdminMoney(month.gross));azAdminSetText('#salesThisMonthCostTotal',azAdminMoney(month.cost));azAdminSetText('#salesThisMonthNetTotal',azAdminMoney(month.profit));
  azAdminSetText('#salesThisYearGrossTotal',azAdminMoney(year.gross));azAdminSetText('#salesThisYearCostTotal',azAdminMoney(year.cost));azAdminSetText('#salesThisYearNetTotal',azAdminMoney(year.profit));
  azAdminSetText('#salesThisMonthFeeTotal',azAdminMoney(month.fee));azAdminSetText('#salesThisMonthOrders',month.orders);azAdminSetText('#salesAverageOrder',azAdminMoney(all.orders?all.gross/all.orders:0));

  window.__azAdminSalesTrendRecords=records;
  azAdminRenderMonthlySalesProfitTrend(records);

  const sum=azAdminLedgerSummary(records);const cats=[['PA/BM',sum.categories.pabm],['Software',sum.categories.software],['CAD Tools',sum.categories.cad],['Hardware / PC',sum.categories.hardware],['Service',sum.categories.service],['Other',sum.categories.other]];
  azAdminRenderBarRows('#salesCategoryBreakdown',cats.filter(([,v])=>v>0).map(([label,value])=>({label,value,valueText:'RM'+azAdminMoney(value)})),{empty:'No paid category sales yet.'});

  const statusCounts={paid:0,pending:0,quotation:0,cancelled:0,failed:0,other:0};records.forEach(row=>{const b=azAdminLedgerStatusBucket(row);statusCounts[b]=(statusCounts[b]||0)+1;});
  azAdminRenderBarRows('#salesStatusBreakdown',[{label:'Paid',value:statusCounts.paid,valueText:String(statusCounts.paid)},{label:'Pending / Deposit',value:statusCounts.pending,valueText:String(statusCounts.pending),fillClass:'warning'},{label:'Quotation',value:statusCounts.quotation,valueText:String(statusCounts.quotation)},{label:'Cancelled / Refunded',value:statusCounts.cancelled,valueText:String(statusCounts.cancelled),fillClass:'bad'},{label:'Failed / Expired',value:statusCounts.failed,valueText:String(statusCounts.failed),fillClass:'bad'}].filter(r=>r.value>0),{empty:'No ledger status data yet.',note:'Counts use the same normalized ledger as Sales Records.'});

  const products=new Map();paid.forEach(row=>{const items=azAdminLedgerItems(row);const subtotal=azAdminLedgerNum(row.subtotal)||azAdminLedgerNum(row.gross);const factor=subtotal>0?azAdminLedgerNum(row.gross)/subtotal:1;if(items.length){items.forEach(item=>{const name=String(item.name||'Purchase').trim()||'Purchase';const category=String(item.category||'other');const key=(name+'|'+category).toLowerCase();const old=products.get(key)||{name,category,amount:0,count:0};old.amount+=(azAdminLedgerNum(item.qty)||1)*azAdminLedgerNum(item.unitPrice)*factor;old.count+=(azAdminLedgerNum(item.qty)||1);products.set(key,old);});}else{const name=azAdminLedgerProductName(row),category=azAdminLedgerPrimaryCategory(row),key=(name+'|'+category).toLowerCase();const old=products.get(key)||{name,category,amount:0,count:0};old.amount+=azAdminLedgerNum(row.gross);old.count++;products.set(key,old);}});
  azAdminRenderTopProducts([...products.values()].sort((a,b)=>(b.amount-a.amount)||(b.count-a.count)));
}
function azAdminLedgerMatchesQuickFilter(row,filter){
  filter=String(filter||'all').toLowerCase();if(filter==='all')return true;const bucket=azAdminLedgerStatusBucket(row);if(filter==='paid'||filter==='pending')return bucket===filter;
  const cats=azAdminLedgerCategories(row);if(filter==='hardware')return cats.some(c=>['physical','computer-it'].includes(c));if(filter==='service')return cats.includes('service');if(filter==='other')return cats.every(c=>!['pabm','software','cad','physical','computer-it','service'].includes(c));return cats.includes(filter);
}
async function loadPayments(forceLoad=false){
  const notice=$('#analyticsSourceNotice');if(notice)notice.textContent='Syncing canonical Sales & Receipts ledger…';
  let ledger;
  try{ledger=await azAdminLoadCanonicalSalesLedger(forceLoad===true);}catch(error){console.error('Analytics canonical ledger load failed:',error);if(notice)notice.textContent='Analytics gagal sync dengan Sales Records: '+(error?.message||error);throw error;}
  const records=ledger.rows||[];const totals=azAdminLedgerSummary(records);
  if(notice)notice.textContent=`Source: Sales & Receipts canonical ledger • ${records.length} record(s) • last sync ${new Date(ledger.generatedAt||Date.now()).toLocaleTimeString('en-MY')}`;

  azAdminSetText('#payTotalPABM',azAdminMoney(totals.categories.pabm));azAdminSetText('#payTotalSoftware',azAdminMoney(totals.categories.software));azAdminSetText('#payTotalCAD',azAdminMoney(totals.categories.cad));azAdminSetText('#payTotalHardware',azAdminMoney(totals.categories.hardware));azAdminSetText('#payTotalService',azAdminMoney(totals.categories.service));azAdminSetText('#payTotalOther',azAdminMoney(totals.categories.other));
  azAdminSetText('#payTotalAll',azAdminMoney(totals.gross));azAdminSetText('#payTotalProductCost',azAdminMoney(totals.productCost));azAdminSetText('#payTotalShippingCost',azAdminMoney(totals.shippingCost));azAdminSetText('#payTotalFee',azAdminMoney(totals.paymentFee));azAdminSetText('#payTotalCommission',azAdminMoney(totals.commission));azAdminSetText('#payTotalOtherCost',azAdminMoney(totals.otherCost));azAdminSetText('#payTotalCost',azAdminMoney(totals.totalCost));azAdminSetText('#payTotalNet',azAdminMoney(totals.profit));azAdminSetText('#payTotalDiscount',azAdminMoney(totals.discount));azAdminSetText('#payTotalShippingCharge',azAdminMoney(totals.shippingCharge));
  azAdminSetText('#payPendingCount',totals.pending);azAdminSetText('#payPaidCount',totals.paid);azAdminSetText('#payQuotationCount',totals.quotation);azAdminSetText('#payRecordCount',totals.total);
  azAdminInitSalesTrendControls();
  azAdminRenderSalesOverviewCharts(records);
  try{azAdminSaveOverviewSalesCache({allGross:totals.gross,netAfterFee:totals.profit,paidCount:totals.paid,source:'sales-receipts-canonical-ledger'});}catch(e){console.warn('Analytics cache bridge skipped:',e);}

  const filter=($('#paymentCategoryFilter')?.value||'paid').toLowerCase();const filtered=records.filter(row=>azAdminLedgerMatchesQuickFilter(row,filter)).sort((a,b)=>azAdminLedgerDateMs(b)-azAdminLedgerDateMs(a)).slice(0,5);
  const rows=filtered.map(row=>{const amount=azAdminLedgerNum(row.gross);const buyer=esc(row.customerName||row.customerEmail||row.customerPhone||'-');const itemName=esc(azAdminLedgerProductName(row));const category=esc(azAdminLedgerPrimaryCategory(row));const status=esc(azAdminLedgerStatus(row)||'-');const method=esc(row.paymentMethod||'-');const source=esc(row.source==='manual'?'Manual':'Website');return item(`${category} • RM${azAdminMoney(amount)}`,`${buyer} • ${itemName} • ${status} • ${method} • ${source} • ${fmtDate(azAdminLedgerDateMs(row))}`,'');});
  $('#paymentsList').innerHTML=rows.join('')||'<div class="item">No matching ledger records found.</div>';
}


function azAdminPaymentLogStableId(x){
  return [
    x?._azSource || '',
    x?.docId || '',
    x?.id || '',
    x?.orderId || '',
    x?.billCode || x?.billcode || '',
    x?.paymentReference || x?.transactionId || x?.txnId || ''
  ].map(v=>String(v||'').trim()).join('|');
}
function azAdminPaymentLogRecordDeletePayload(x){
  x=x||{};
  return {
    source:x._azSource || (x.docId && String(x.docId).startsWith('premium') ? 'premiumOrders' : 'purchaseLogs'),
    collection:x._azSource === 'premiumOrders' ? 'premiumOrders' : 'purchaseLogs',
    docId:x.docId || x.firestoreId || x.id || '',
    id:x.id || '',
    orderId:x.orderId || '',
    billCode:x.billCode || x.billcode || '',
    paymentReference:x.paymentReference || x.transactionId || x.txnId || '',
    productId:x.productId || x.softwareId || x.cadId || x.itemCode || x.product?.id || '',
    status:x.status || x.paymentStatus || azAdminStatusBucket(x),
    category:x.category || '',
    amount:Number(x.amount || 0) || 0
  };
}
function azAdminPaymentLogSelectedKeys(){
  return Array.from(document.querySelectorAll('.az-paylog-select:checked')).map(el=>el.getAttribute('data-paylog-select')).filter(Boolean);
}
function azAdminUpdatePaymentLogSelectionUI(){
  const checked = new Set(azAdminPaymentLogSelectedKeys());
  document.querySelectorAll('.az-payment-log-row').forEach(row=>{
    const cb = row.querySelector('.az-paylog-select');
    row.classList.toggle('is-selected', !!(cb && checked.has(cb.getAttribute('data-paylog-select'))));
  });
  const countEl = document.getElementById('paymentLogsSelectedCount');
  if(countEl) countEl.textContent = checked.size + ' selected';
  const selectAll = document.getElementById('paymentLogsSelectAllFiltered');
  if(selectAll){
    const total = Array.isArray(window.azAdminPaymentLogsFiltered) ? window.azAdminPaymentLogsFiltered.length : 0;
    selectAll.checked = total > 0 && checked.size >= total;
    selectAll.indeterminate = checked.size > 0 && checked.size < total;
  }
}
function azAdminSetPaymentLogSelectionByFilter(statusFilter){
  const status = String(statusFilter || 'all').toLowerCase();
  const rows = Array.isArray(window.azAdminPaymentLogsFiltered) ? window.azAdminPaymentLogsFiltered : [];
  const map = window.azAdminPaymentLogsKeyByStableId || {};
  const wanted = new Set();
  rows.forEach(x=>{
    const bucket = azAdminStatusBucket(x);
    if(status === 'all' || bucket === status){
      const stable = azAdminPaymentLogStableId(x);
      const key = map[stable];
      if(key) wanted.add(key);
    }
  });
  document.querySelectorAll('.az-paylog-select').forEach(cb=>{
    cb.checked = wanted.has(cb.getAttribute('data-paylog-select'));
  });
  azAdminUpdatePaymentLogSelectionUI();
  return wanted.size;
}

async function azAdminDeleteByClientFirestoreQuery(collectionName, field, value, max=20){
  const deleted=[];
  if(!value) return deleted;
  try{
    const qs=await getDocs(query(collection(db,collectionName), where(field,'==',value), limit(max)));
    for(const snap of qs.docs){
      await deleteDoc(doc(db,collectionName,snap.id));
      deleted.push(collectionName+'/'+snap.id+' via '+field);
    }
  }catch(err){
    console.warn('Client delete query skipped', collectionName, field, err && (err.message || err));
  }
  return deleted;
}
async function azAdminDeletePaymentLogsClientFallback(records=[]){
  // AZOBSS PATCH 423:
  // Fallback for GitHub frontend updated before Render backend endpoint is deployed.
  // This can remove Firestore purchaseLogs/premiumOrders if Firebase Rules allow admin delete.
  // It cannot remove local premium-orders.json; Render backend deploy is still required for full cleanup.
  const details=[];
  const errors=[];
  const seen=new Set();
  for(const row of records){
    const payload=azAdminPaymentLogRecordDeletePayload(row);
    const collectionName = payload.collection === 'premiumOrders' ? 'premiumOrders' : 'purchaseLogs';
    const directIds=[payload.docId,payload.id].map(v=>String(v||'').trim()).filter(Boolean);
    for(const id of directIds){
      const key=collectionName+'/'+id;
      if(seen.has(key)) continue;
      seen.add(key);
      try{
        await deleteDoc(doc(db,collectionName,id));
        details.push(key+' via docId');
      }catch(err){
        errors.push(key+': '+(err?.message||String(err)));
      }
    }
    for(const [field,value] of [['orderId',payload.orderId],['billCode',payload.billCode],['billcode',payload.billCode],['paymentReference',payload.paymentReference],['transactionId',payload.paymentReference],['txnId',payload.paymentReference]]){
      const rows=await azAdminDeleteByClientFirestoreQuery(collectionName, field, value, 20);
      rows.forEach(x=>{ if(!seen.has(x)){ seen.add(x); details.push(x); } });
    }
  }
  return {ok:details.length>0, deleted:details.length, details, errors};
}
function azAdminIsBackendDeleteEndpointNotReady(error){
  const msg=String(error?.message||error||'').toLowerCase();
  return msg.includes('endpoint belum aktif') || msg.includes('non-json') || msg.includes('not found') || msg.includes('cannot post') || msg.includes('invalid backend response') || msg.includes('html');
}

async function azAdminDeleteSelectedPaymentLogs(mode='selected'){
  let keys = azAdminPaymentLogSelectedKeys();
  if(mode && mode !== 'selected'){
    const n = azAdminSetPaymentLogSelectionByFilter(mode);
    keys = azAdminPaymentLogSelectedKeys();
    if(!n){ toast('No '+mode+' records found in current filter.'); return; }
  }
  const records = keys.map(k=>window.azAdminPaymentLogsMap?.[k]).filter(Boolean);
  if(!records.length){ toast('Select payment log records first.'); return; }
  const paidCount = records.filter(x=>azAdminStatusBucket(x)==='paid').length;
  const label = mode === 'selected' ? 'selected record(s)' : mode + ' record(s)';
  const paidWarn = paidCount ? `\n\n⚠️ ${paidCount} paid/verified record(s) selected. This can affect audit history.` : '';
  if(!confirm(`Delete ${records.length} ${label} from Payment Logs?${paidWarn}\n\nThis action removes admin payment log records, not cart items.`)) return;

  const btn = document.getElementById(mode === 'pending' ? 'clearPendingPaymentLogs' : mode === 'cancelled' ? 'clearCancelledPaymentLogs' : mode === 'failed' ? 'clearFailedPaymentLogs' : 'deleteSelectedPaymentLogs');
  const oldText = btn ? btn.textContent : '';
  try{
    if(btn){ btn.disabled = true; btn.textContent = 'Deleting...'; }
    const payload = { records: records.map(azAdminPaymentLogRecordDeletePayload) };
    const res = await azAdminFetchJson(AZOBSS_BACKEND_API + '/api/admin/payment-logs/delete', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    toast(`Deleted ${res.deleted || 0} item(s).` + (res.errors?.length ? ` ${res.errors.length} not found/failed.` : ''));
    try{ await loadPurchases(); }catch(_){}
    try{ await loadPayments(); }catch(_){}
    try{ await loadOverview(); }catch(_){}
  }catch(e){
    if(azAdminIsBackendDeleteEndpointNotReady(e)){
      try{
        if(btn) btn.textContent='Firebase fallback...';
        const fb=await azAdminDeletePaymentLogsClientFallback(records);
        if(fb.ok){
          toast(`Deleted ${fb.deleted || 0} Firestore item(s) using fallback. Render backend still needs deploy to clear local premium-orders backup.`);
          try{ await loadPurchases(); }catch(_){}
          try{ await loadPayments(); }catch(_){}
          try{ await loadOverview(); }catch(_){}
        }else{
          toast((e?.message || 'Backend delete endpoint not ready.') + '\n\nFallback also failed or no Firestore records matched. Deploy Render backend for full delete support.');
        }
      }catch(fallbackErr){
        toast((e?.message || 'Backend delete endpoint not ready.') + '\n\nFirebase fallback failed: ' + (fallbackErr?.message || String(fallbackErr)) + '\n\nDeploy Render backend and try again.');
      }
    }else{
      toast(e?.message || 'Delete payment logs failed.');
    }
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = oldText || 'Delete'; }
  }
}

async function loadPurchases(){
  azAdminSetPaymentLogCustomDateState();
  const catFilter = ($('#paymentLogsCategoryFilter')?.value || 'all').toLowerCase();
  const statusFilter = ($('#paymentLogsStatusFilter')?.value || 'all').toLowerCase();
  const dateFilter = ($('#paymentLogsDateFilter')?.value || 'all');
  const searchText = $('#paymentLogsSearch')?.value || '';
  const logs=await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(300)),'Payment Logs: purchaseLogs');
  const premiumRecords=await azAdminLoadPremiumOrdersViaBackend(500);
  const records=[];

  logs?.forEach(d=>{
    const record=azAdminPurchaseLogToPaymentRecord(d.id,d.data());
    if(record) records.push(record);
  });
  premiumRecords.forEach(x=>records.push(x));
  records.forEach(x=>{
    const bucket=azAdminStatusBucket(x);
    x._azStatusBucket=bucket;
    x.paid=bucket==='paid';
    x.pending=bucket==='pending';
  });
  records.sort((a,b)=>azAdminPaymentMs(b)-azAdminPaymentMs(a));

  const filtered = azAdminFilterPaymentRecords(records, catFilter, statusFilter, searchText, dateFilter);
  window.azAdminPaymentLogsRecords = records;
  window.azAdminPaymentLogsFiltered = filtered;
  window.azAdminPaymentLogsMap = {};
  window.azAdminPaymentLogsKeyByStableId = {};
  const visible = filtered; // PATCH 310: render all filtered records; paginator controls display per page.

  const lr=visible.map((x,idx)=>{
    const key='paylog_'+idx+'_'+String(x.docId||x.id||x.orderId||x.billCode||'x').replace(/[^a-z0-9_-]/gi,'').slice(0,48);
    x._azDetailKey=key;
    window.azAdminPaymentLogsMap[key]=x;
    window.azAdminPaymentLogsKeyByStableId[azAdminPaymentLogStableId(x)] = key;
    const bucket=azAdminStatusBucket(x);
    const statusText = esc(x.status || x.paymentStatus || bucket);
    const buyer = esc(x.usernameKey || x.username || x.displayName || x.email || '-');
    const buyerEmail = x.email || x.buyerEmail ? ' • '+esc(x.email || x.buyerEmail) : '';
    const itemName = esc(x.title || x.name || x.itemName || x.filename || x.itemCode || x.productType || x.productName || 'Purchase');
    const productId = esc(x.productId || x.softwareId || x.cadId || x.itemCode || x.product?.id || '');
    const orderId = esc(x.orderId || x.billCode || x.paymentReference || x.transactionId || x.txnId || x.id || '');
    const sourceBadge = x._azSource === 'premiumOrders' ? 'premiumOrders' : 'purchaseLogs';
    const dateText = fmtDate(azAdminPaymentMs(x)||x.createdAtMs||x.createdAt);
    const reset = x._azSource === 'premiumOrders' ? '' : azAdminPaBmResetActions(x);
    const receiptBtns = azAdminPaymentReceiptActions(x,key);
    const actions = `<button class="btn gray" data-paylog-detail="${esc(key)}" title="View details" type="button">Detail</button>${receiptBtns}${reset}`;
    return `<div class="item az-payment-log-row" data-paylog-row="${esc(key)}"><div class="item-row"><label class="az-paylog-check" title="Select record"><input class="az-paylog-select" type="checkbox" data-paylog-select="${esc(key)}"></label><div class="az-payment-log-main"><div class="item-title">${esc(x.category)} • RM${Number(x.amount || 0).toFixed(2)} <span class="az-pay-badge ${esc(bucket)}">${esc(bucket.toUpperCase())}</span></div><div class="item-meta">${buyer}${buyerEmail} • ${itemName}${productId?' • Product ID: '+productId:''} • ${sourceBadge}${orderId?' • Order/Bill: '+orderId:''} • ${dateText}</div></div><div class="item-actions">${actions}</div></div></div>`;
  });

  const summaryMap=new Map();
  records.filter(x=>x.category==='PA/BM' && azAdminStatusBucket(x)==='paid').forEach(x=>{
    const key=String(x.usernameKey||x.username||x.email||'Unknown').trim()||'Unknown';
    const old=summaryMap.get(key)||{total:0,unit:0};
    old.total+=Number(x.amount||0)||0;
    old.unit+=1;
    summaryMap.set(key,old);
  });
  const sr=[...summaryMap.entries()]
    .sort((a,b)=>(b[1].total-a[1].total)||a[0].localeCompare(b[0]))
    .map(([key,x])=>item(esc(key),`Total: RM${esc(Number(x.total||0).toFixed(2))} • Unit: ${esc(x.unit)}`));
  $('#purchaseLogsList').innerHTML=lr.join('')||'<div class="item">No payment logs found.</div>';
  $('#purchaseSummariesList').innerHTML=sr.join('')||'<div class="item">No PA/BM purchase summaries.</div>';
  azAdminApplyPager('#purchaseLogsList',{key:'purchaseLogsList',pageSize:8,label:'payment logs',reset:true});
  azAdminApplyPager('#purchaseSummariesList',{key:'purchaseSummariesList',pageSize:8,label:'summaries',reset:true});
  const info=$('#paymentLogsResultInfo');
  if(info){
    const range=azAdminPaymentLogDateRange(dateFilter).label;
    const shown=Math.min(visible.length, filtered.length);
    info.textContent=`Showing ${filtered.length} matched records from ${records.length} loaded records • Date: ${range} • Pagination enabled`;
  }
  const selectAll = document.getElementById('paymentLogsSelectAllFiltered');
  if(selectAll) selectAll.checked = false;
  azAdminUpdatePaymentLogSelectionUI();
}

function azAdminPaymentLogCsvValue(v){
  const s=String(v??'').replace(/\r?\n/g,' ').trim();
  return '"'+s.replace(/"/g,'""')+'"';
}
function azAdminExportPaymentLogsCsv(){
  const rows=Array.isArray(window.azAdminPaymentLogsFiltered)?window.azAdminPaymentLogsFiltered:[];
  if(!rows.length){ toast('No payment logs to export.'); return; }
  const header=['category','status','amount_rm','username','email','product_name','product_id','order_or_bill_id','source','payment_date','download_used','download_max'];
  const lines=[header.map(azAdminPaymentLogCsvValue).join(',')];
  rows.forEach(x=>{
    const vals=[
      x.category||'',
      x.status||x.paymentStatus||azAdminStatusBucket(x),
      Number(x.amount||0).toFixed(2),
      x.usernameKey||x.username||x.displayName||'',
      x.email||x.buyerEmail||x.user?.email||'',
      x.title||x.name||x.itemName||x.productName||x.productTitle||'',
      x.productId||x.softwareId||x.cadId||x.itemCode||x.product?.id||'',
      x.orderId||x.billCode||x.paymentReference||x.transactionId||x.txnId||x.id||'',
      x._azSource||'',
      fmtDate(azAdminPaymentMs(x)||x.createdAtMs||x.createdAt),
      azAdminDownloadCount(x),
      azAdminMaxDownloads(x)
    ];
    lines.push(vals.map(azAdminPaymentLogCsvValue).join(','));
  });
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10);
  a.href=url; a.download='azobss-payment-logs-'+stamp+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function azAdminOpenPaymentLogDetail(key){
  const rec=window.azAdminPaymentLogsMap?.[key];
  if(!rec){ toast('Payment record not found. Refresh logs and try again.'); return; }
  const modal=$('#paymentLogDetailModal');
  const body=$('#paymentLogDetailBody');
  const sub=$('#paymentLogDetailSubtitle');
  if(!modal||!body) return;
  const fields=[
    ['Category',rec.category||'-'],
    ['Status',rec.status||rec.paymentStatus||azAdminStatusBucket(rec)],
    ['Amount RM',Number(rec.amount||0).toFixed(2)],
    ['Username',rec.usernameKey||rec.username||rec.displayName||'-'],
    ['Email',rec.email||rec.buyerEmail||rec.user?.email||'-'],
    ['Product',rec.title||rec.name||rec.itemName||rec.productName||rec.productTitle||'-'],
    ['Product ID',rec.productId||rec.softwareId||rec.cadId||rec.itemCode||rec.product?.id||'-'],
    ['Order / Bill ID',rec.orderId||rec.billCode||rec.paymentReference||rec.transactionId||rec.txnId||rec.id||'-'],
    ['Source',rec._azSource||'-'],
    ['Payment Date',fmtDate(azAdminPaymentMs(rec)||rec.createdAtMs||rec.createdAt)],
    ['Download Used',azAdminDownloadCount(rec)],
    ['Download Max',azAdminMaxDownloads(rec)]
  ];
  const receiptActions=azAdminPaymentReceiptActions(rec,key);
  body.innerHTML='<div class="toolbar" style="margin:0 0 12px">'+receiptActions+'</div><div class="az-payment-detail-grid">'+fields.map(([k,v])=>`<div class="az-payment-detail-cell"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')+'</div><h3 style="margin:10px 0 8px">Raw Debug Data</h3><pre class="az-payment-detail-raw">'+esc(JSON.stringify(rec,(k,v)=>k==='_azDetailKey'?undefined:v,2))+'</pre>';
  if(sub) sub.textContent=(rec.category||'Payment')+' • '+(rec.orderId||rec.billCode||rec.id||'No ID');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden','false');
  azAdminSyncDetailModalScrollLock();
  requestAnimationFrame(()=>{ const scroller=modal.querySelector('.az-payment-detail-body'); if(scroller) scroller.scrollTop=0; });
}
function azAdminSyncDetailModalScrollLock(){
  const anyOpen=!!document.querySelector('.az-payment-detail-modal.is-open');
  document.documentElement.classList.toggle('az-admin-detail-modal-open',anyOpen);
  document.body.classList.toggle('az-admin-detail-modal-open',anyOpen);
}
function azAdminClosePaymentLogDetail(){
  const modal=$('#paymentLogDetailModal');
  if(modal){ modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); }
  azAdminSyncDetailModalScrollLock();
}
function azAdminPaymentRecordByKey(key){
  const rec=window.azAdminPaymentLogsMap?.[key];
  if(rec) return rec;
  return (window.azAdminPaymentLogsRecords||[]).find(x=>String(x._azDetailKey||azAdminPaymentReceiptId(x))===String(key));
}
async function azAdminOpenPaymentReceipt(key, format='html', download=false){
  const rec=azAdminPaymentRecordByKey(key);
  if(!rec) return toast('Payment record not found. Refresh Payment Logs and try again.');
  if(!azAdminCanIssuePaymentReceipt(rec)) return toast('Receipt/PDF hanya tersedia selepas payment Paid/Verified.');
  const id=azAdminPaymentReceiptId(rec);
  if(!id) return toast('Receipt ID not found for this record.');
  const source=azAdminPaymentReceiptSource(rec);
  const fmt=String(format||'html').toLowerCase()==='pdf'?'pdf':'html';
  try{
    const url=AZOBSS_BACKEND_API+'/api/admin/payment-receipt/'+encodeURIComponent(id)+'?source='+encodeURIComponent(source)+'&format='+encodeURIComponent(fmt)+(download?'&download=1':'');
    const out=await azAdminFetchBlob(url,{cache:'no-store'});
    const blobUrl=URL.createObjectURL(out.blob);
    if(fmt==='pdf' && download){
      azSaveBlob(out.blob,out.filename||('azobss-receipt-'+id+'.pdf'));
      setTimeout(()=>URL.revokeObjectURL(blobUrl),1500);
      return;
    }
    const w=window.open(blobUrl,'_blank','noopener');
    if(!w){
      const a=document.createElement('a'); a.href=blobUrl; a.download=out.filename||('azobss-receipt-'+id+'.'+(fmt==='pdf'?'pdf':'html')); document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);
  }catch(e){ toast(e?.message||'Failed to open receipt.'); }
}
async function azAdminEmailPaymentReceipt(key){
  const rec=azAdminPaymentRecordByKey(key);
  if(!rec) return toast('Payment record not found. Refresh Payment Logs and try again.');
  if(!azAdminCanIssuePaymentReceipt(rec)) return toast('Email receipt/download link hanya tersedia selepas payment Paid/Verified.');
  const id=azAdminPaymentReceiptId(rec);
  if(!id) return toast('Receipt ID not found for this record.');
  const currentEmail=rec.email||rec.buyerEmail||rec.user?.email||'';
  const email=prompt('Send PDF receipt + Software/CAD download link jika ada kepada email:', currentEmail||'');
  if(!email) return;
  if(!confirm('Send AZOBSS PDF receipt + download link jika ada kepada '+email+'?')) return;
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payment-receipt-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({recordId:id,source:azAdminPaymentReceiptSource(rec),email})
    });
    toast((j.downloadLinkIncluded?'Receipt + download link sent to ':'Receipt email sent to ')+(j.to||email));
  }catch(e){ toast(e?.message||'Failed to email receipt.'); }
}

async function loadStaffRoles(){
  const snap = await safeGet(query(collection(db,'users'),limit(100)),'Staff Roles: users');
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
    if(r==='admin')return 'Administrator';
    if(r==='semiadmin'||r==='semi-admin')return 'Manager';
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
    const role=String(x.role||'user').toLowerCase();
    if(!['admin','semiadmin','semi-admin','staff'].includes(role) && !x.permissions) return;
    rows.push(`<div class="staff-role-card" data-staff-username="${esc(d.id)}">
      <div class="staff-role-name">👤 ${esc(d.id)}</div>
      <div class="staff-role-meta">Role: <b>${esc(roleLabel(role))}</b></div>
      ${badgeHtml(x.permissions||{})}
      <div class="staff-role-actions">
        <button class="staff-role-edit" data-staff-edit="${esc(d.id)}">Edit</button>
        <button class="staff-role-reset" data-staff-reset="${esc(d.id)}">Reset</button>
      </div>
    </div>`);
  });
  $('#staffRolesList').classList.add('staff-role-list');
  $('#staffRolesList').innerHTML=rows.join('')||'<div class="staff-role-card">No staff users found.</div>';
  azAdminApplyPager('#staffRolesList',{key:'staffRolesList',pageSize:8,label:'staff users',reset:true});
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
let az1192CommissionStaffContext='';
let az1192CommissionContextMode='overview';
let az1192CommissionContextUrlApplied=false;
let adminCommissionFilteredCache = [];
let adminCommissionSelectedDocIds = new Set();
let azCommissionSearchTimer = null;

function commissionUsernameOf(x){
  return String(x.username || x.ownerUsername || x.createdByUsername || x.staffUsername || x.sellerUsername || x.sharerUsername || x.email || x.ownerEmail || '').trim();
}
function commissionRecordTitle(x){ return esc(commissionUsernameOf(x) || 'Unknown'); }
function commissionProductName(x){ return String(x.productName || x.product || x.productTitle || x.itemName || x.saleRef || x.title || '-').trim(); }
function commissionAmountOf(x){ return Number(x.commissionAmount ?? x.amount ?? x.totalCommission ?? 0) || 0; }
function commissionSaleAmountOf(x){ return Number(x.saleAmount ?? x.orderAmount ?? x.totalSale ?? 0) || 0; }
function commissionRateOf(x){ const explicit=Number(x.commissionRate ?? x.rate ?? 0) || 0; if(explicit) return explicit; const sale=commissionSaleAmountOf(x), amt=commissionAmountOf(x); return sale>0 ? (amt/sale)*100 : 0; }
function commissionCreatedMs(x){ const v=x.createdAtMs || x.paidAtMs || x.updatedAtMs || x.createdAt || x.paidAt || x.updatedAt || 0; if(typeof v==='number') return v; if(v?.toMillis) return v.toMillis(); if(v?.toDate) return v.toDate().getTime(); const d=new Date(v); return isNaN(d)?0:d.getTime(); }
function commissionPayoutStatus(x){ if(x?.voided===true) return 'void'; return String(x.payoutStatus || x.status || 'pending').toLowerCase() || 'pending'; }
function commissionStatusBucket(x){ const s=commissionPayoutStatus(x); if(s==='void'||x?.voided===true) return 'void'; if(['paid','settled','released'].includes(s)) return 'paid'; if(s==='approved') return 'approved'; if(['rejected','cancelled'].includes(s)) return 'rejected'; return 'pending'; }
function commissionStatusBadge(status){ const s=String(status||'pending').toLowerCase(); if(s==='paid') return '✅ paid'; if(s==='approved') return '🟦 approved'; if(s==='rejected') return '⛔ rejected'; if(s==='void') return '⚪ void'; return '⏳ pending'; }
function commissionTypeBucket(x){
  const raw=String(x.commissionType || x.type || x.source || '').toLowerCase();
  if(raw==='owner_sale'||raw.includes('owner_sale_direct')) return 'owner_sale';
  if(raw.includes('owner_sale_split')) return 'owner_sale_split';
  if(raw.includes('admin_product_share_referral')) return 'admin_product_share_referral';
  if(raw.includes('share_referral') || raw.includes('referral')) return 'share_referral';
  if(raw.includes('manual') || raw.includes('adjustment') || raw.includes('admin')) return 'manual';
  return raw || 'manual';
}
function commissionTypeLabel(x){
  const t=commissionTypeBucket(x);
  if(t==='owner_sale') return 'Owner Direct Sale';
  if(t==='owner_sale_split') return 'Owner Split Sale';
  if(t==='admin_product_share_referral') return 'AZOBSS Referral 20%';
  if(t==='share_referral') return commissionRateOf(x)===4 ? 'Other Staff Referral 4%' : 'Other Staff Referral';
  if(t==='manual') return 'Manual Adjustment';
  return String(x.commissionType || x.type || 'Commission');
}
function commissionSourceBucket(x){
  const raw=String([x.sourcePage,x.source,x.productType,x.category,commissionProductName(x)].filter(Boolean).join(' ')).toLowerCase();
  if(raw.includes('cad')) return 'cad';
  return 'software';
}
function commissionOrderKey(x){
  const order=String(x.orderId||'').trim(), bill=String(x.billCode||'').trim();
  if(order) return 'order:'+order;
  if(bill) return 'bill:'+bill;
  return '';
}
function commissionIsManual(x){ return commissionTypeBucket(x)==='manual'; }
function commissionIsVoid(x){ return commissionStatusBucket(x)==='void'; }
function commissionSearchText(x){ return [x.docId,x.orderId,x.billCode,x.productId,commissionProductName(x),commissionUsernameOf(x),x.ownerUsername,x.ownerEmail,x.email,x.commissionType,x.type,x.payoutStatus,x.status,x.payoutReference,x.note,x.payoutNote,x.sourcePage,x._source,x.voidReason,x.parentDocId,x.adjustmentParentDocId,x.shareReferral&&(x.shareReferral.username+' '+x.shareReferral.ref+' '+x.shareReferral.productId)].filter(Boolean).join(' ').toLowerCase(); }

function azAdminCommissionDateRange(){
  const mode=String($('#commissionMonthFilter')?.value||'all'); const now=new Date(); let start=null,end=null;
  if(mode==='today'){ start=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime(); }
  else if(mode==='thisMonth'){ start=new Date(now.getFullYear(),now.getMonth(),1).getTime(); end=new Date(now.getFullYear(),now.getMonth()+1,1).getTime(); }
  else if(mode==='lastMonth'){ start=new Date(now.getFullYear(),now.getMonth()-1,1).getTime(); end=new Date(now.getFullYear(),now.getMonth(),1).getTime(); }
  else if(mode==='custom'){ const f=$('#commissionDateFrom')?.value||''; const t=$('#commissionDateTo')?.value||''; if(f) start=new Date(f+'T00:00:00').getTime(); if(t) end=new Date(t+'T23:59:59').getTime()+1; }
  return {start,end};
}
function azAdminSetCommissionDateState(){ const custom=String($('#commissionMonthFilter')?.value||'all')==='custom'; if($('#commissionDateFrom')) $('#commissionDateFrom').disabled=!custom; if($('#commissionDateTo')) $('#commissionDateTo').disabled=!custom; }

function getFilteredAdminCommissions(){
  const q=String($('#commissionSearch')?.value||'').trim().toLowerCase();
  const staff=String($('#commissionStaffFilter')?.value||'').trim().toLowerCase();
  const product=String($('#commissionProductFilter')?.value||'').trim().toLowerCase();
  const status=String($('#commissionPayoutFilter')?.value||'all').toLowerCase();
  const type=String($('#commissionTypeFilter')?.value||'all').toLowerCase();
  const source=String($('#commissionSourceFilter')?.value||'all').toLowerCase();
  const minRaw=String($('#commissionMinAmount')?.value||'').trim(), maxRaw=String($('#commissionMaxAmount')?.value||'').trim();
  const minAmt=minRaw===''?null:Number(minRaw), maxAmt=maxRaw===''?null:Number(maxRaw);
  const {start,end}=azAdminCommissionDateRange();
  return adminCommissionCache.filter(x=>{
    const text=commissionSearchText(x);
    if(q && !text.includes(q)) return false;
    if(staff && !String([commissionUsernameOf(x),x.ownerUsername,x.ownerEmail,x.email,x.uid,x.ownerUid].filter(Boolean).join(' ')).toLowerCase().includes(staff)) return false;
    if(product && !String([commissionProductName(x),x.productId,x.orderId,x.billCode].filter(Boolean).join(' ')).toLowerCase().includes(product)) return false;
    if(status!=='all' && commissionStatusBucket(x)!==status) return false;
    if(type!=='all' && commissionTypeBucket(x)!==type) return false;
    if(source!=='all' && commissionSourceBucket(x)!==source) return false;
    const amt=commissionAmountOf(x);
    if(minAmt!==null && Number.isFinite(minAmt) && amt<minAmt) return false;
    if(maxAmt!==null && Number.isFinite(maxAmt) && amt>maxAmt) return false;
    const ms=commissionCreatedMs(x);
    if(start!==null && (!ms || ms<start)) return false;
    if(end!==null && (!ms || ms>=end)) return false;
    if(az1192CommissionStaffContext){
      const t=commissionTypeBucket(x);
      if(az1192CommissionContextMode==='sales' && !['owner_sale','owner_sale_split'].includes(t)) return false;
      if(az1192CommissionContextMode==='share' && !['admin_product_share_referral','share_referral'].includes(t)) return false;
      if(az1192CommissionContextMode==='payout' && ['rejected','void'].includes(commissionStatusBucket(x))) return false;
    }
    return true;
  });
}

function azCommissionUniqueSalesStats(rows){
  const byOrder=new Map();
  let autoCommission=0;
  rows.forEach(x=>{
    if(commissionIsVoid(x)||commissionIsManual(x)) return;
    const st=commissionStatusBucket(x);
    if(!['pending','approved','paid'].includes(st)) return;
    const sale=commissionSaleAmountOf(x), key=commissionOrderKey(x);
    if(sale>0 && key){
      const prev=byOrder.get(key)||0;
      byOrder.set(key,Math.max(prev,sale));
    }
    autoCommission += commissionAmountOf(x);
  });
  const sales=[...byOrder.values()].reduce((a,b)=>a+b,0);
  return {count:byOrder.size,sales,autoCommission,avgRate:sales>0?(autoCommission/sales)*100:0};
}
function azAdminUpdateCommissionSelectedInfo(){
  const ids=[...document.querySelectorAll('[data-commission-select]:checked')].map(el=>el.value).filter(Boolean);
  adminCommissionSelectedDocIds=new Set(ids);
  const selected=adminCommissionCache.filter(x=>ids.includes(String(x.docId||'')));
  const amount=selected.reduce((a,x)=>a+commissionAmountOf(x),0);
  const staff=new Set(selected.map(commissionUsernameOf).filter(Boolean));
  if($('#commissionSelectedInfo')) $('#commissionSelectedInfo').textContent=`Selected: ${ids.length} • RM${amount.toFixed(2)} • ${staff.size} Staff`;
  const bar=$('#az1198CommissionSelectionBar'); if(bar) bar.hidden=!ids.length;
}
function az1198PayoutWho(r){return String(r?.username||r?.staffUsername||r?.email||r?.staffEmail||'').trim();}
function az1198LatestPayoutForStaff(name){const key=String(name||'').trim().toLowerCase();return adminPayoutRequestCache.filter(r=>az1198PayoutWho(r).toLowerCase()===key).sort((a,b)=>(Number(b.createdAtMs||0)||Date.parse(b.createdAt||'')||0)-(Number(a.createdAtMs||0)||Date.parse(a.createdAt||'')||0))[0]||null;}
function azRenderCommissionStaffSummary(rows){
  const map=new Map();
  rows.forEach(x=>{
    if(commissionIsVoid(x)) return;
    const name=commissionUsernameOf(x)||'Unknown',key=name.toLowerCase();
    if(!map.has(key)) map.set(key,{name,pending:0,approved:0,paid:0,rejected:0,lastPaid:0,records:0});
    const r=map.get(key),amt=commissionAmountOf(x),st=commissionStatusBucket(x);r.records++;
    if(st==='pending')r.pending+=amt;else if(st==='approved')r.approved+=amt;else if(st==='paid'){r.paid+=amt;r.lastPaid=Math.max(r.lastPaid,Date.parse(x.payoutPaidAt||'')||Number(x.payoutPaidAtMs||0)||commissionCreatedMs(x));}else if(st==='rejected')r.rejected+=amt;
  });
  let list=[...map.values()].sort((a,b)=>(b.approved+b.pending)-(a.approved+a.pending)||b.paid-a.paid);
  const q=String($('#commissionStaffTableSearch')?.value||'').trim().toLowerCase(),mode=String($('#commissionStaffTableStatus')?.value||'attention');
  list=list.filter(r=>{if(q&&!r.name.toLowerCase().includes(q))return false;if(mode==='ready')return r.approved>0;if(mode==='pending')return r.pending>0;if(mode==='paid')return r.paid>0;if(mode==='attention')return r.pending>0||r.approved>0;return true;});
  const box=$('#commissionStaffSummaryList');if(!box)return;
  if($('#az1198StaffCount'))$('#az1198StaffCount').textContent=`${list.length} staff`;
  box.innerHTML=list.map(r=>{const latest=az1198LatestPayoutForStaff(r.name),qr=!!latest?.profile?.qrImageDataUrl,attention=(r.pending+r.approved)>0;return `<div class="az1198-table-row az1198-staff-grid"><div class="az1198-person"><strong>${attention?'<span class="az1198-attention-dot"></span>':'<span class="az1198-ok-dot"></span>'}${esc(r.name)}</strong><span class="az1198-sub">${r.records} commission record${r.records===1?'':'s'}</span></div><span class="az1198-money pending">RM${r.pending.toFixed(2)}</span><span class="az1198-money ready">RM${r.approved.toFixed(2)}</span><span class="az1198-money">RM${r.paid.toFixed(2)}</span><span class="${qr?'az1198-qr-ok':'az1198-qr-missing'}">${qr?'✓ Ready':'! Missing'}</span><span class="az1198-sub">${r.lastPaid?esc(fmtDate(r.lastPaid)):'-'}</span><button class="az1198-open-btn" type="button" data-commission-staff-drawer="${esc(r.name)}">View ›</button></div>`;}).join('')||'<div class="az1198-empty">Tiada Staff/Manager untuk filter ini.</div>';
  azAdminApplyPager('#commissionStaffSummaryList',{key:'commissionStaffSummaryList',pageSize:12,label:'staff',reset:true});
}


function az1192CommissionModeLabel(mode){return ({overview:'Overview',sales:'Sales View',share:'Share Link',payout:'Payout'})[mode]||'Overview';}
function az1192SyncCommissionContextUi(){
  const box=$('#commissionStaffContext'),name=$('#commissionStaffContextName'),meta=$('#commissionStaffContextMeta');
  if(box) box.hidden=!az1192CommissionStaffContext;
  if(name) name.textContent=az1192CommissionStaffContext||'-';
  if(meta) meta.textContent=az1192CommissionStaffContext?('↔ Staff Dashboard: '+az1192CommissionModeLabel(az1192CommissionContextMode)):'';
  document.querySelectorAll('[data-commission-context-mode]').forEach(b=>b.classList.toggle('active',b.dataset.commissionContextMode===az1192CommissionContextMode));
}
function az1192SetCommissionContext(staff,mode='overview',{updateUrl=true,scroll=true}={}){
  az1192CommissionStaffContext=String(staff||'').trim();
  az1192CommissionContextMode=['overview','sales','share','payout'].includes(mode)?mode:'overview';
  if($('#commissionStaffFilter')) $('#commissionStaffFilter').value=az1192CommissionStaffContext;
  if($('#commissionTypeFilter')) $('#commissionTypeFilter').value='all';
  if($('#commissionPayoutFilter')) $('#commissionPayoutFilter').value='all';
  if($('#payoutRequestStaffFilter')) $('#payoutRequestStaffFilter').value=az1192CommissionStaffContext;if($('#payoutRequestFilter')&&az1192CommissionContextMode==='payout')$('#payoutRequestFilter').value='needs_action';
  az1192SyncCommissionContextUi();
  renderAdminCommissions(); renderAdminPayoutRequests();
  if(updateUrl){try{const u=new URL(location.href);u.searchParams.set('tab','commissions');if(az1192CommissionStaffContext)u.searchParams.set('staff',az1192CommissionStaffContext);else u.searchParams.delete('staff');u.searchParams.set('mode',az1192CommissionContextMode);history.replaceState({},'',u.pathname+'?'+u.searchParams.toString()+u.hash);}catch(_e){}}
  if(scroll){
    az1198CloseDrawers?.();
    if(az1192CommissionContextMode==='payout'){const c=$('#adminPayoutRequestsCard');c?.classList.add('az1192-payout-context');c?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>c?.classList.remove('az1192-payout-context'),1800);}
    else $('#commissionRecordsCard')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
}
function az1192ClearCommissionContext(){
  az1192CommissionStaffContext='';az1192CommissionContextMode='overview';
  if($('#commissionStaffFilter'))$('#commissionStaffFilter').value='';
  if($('#payoutRequestStaffFilter'))$('#payoutRequestStaffFilter').value='';
  az1192SyncCommissionContextUi();renderAdminCommissions();renderAdminPayoutRequests();
  try{const u=new URL(location.href);u.searchParams.delete('staff');u.searchParams.delete('mode');u.searchParams.set('tab','commissions');history.replaceState({},'',u.pathname+'?'+u.searchParams.toString()+u.hash);}catch(_e){}
}
function az1192ApplyCommissionContextFromUrl(){
  if(az1192CommissionContextUrlApplied)return;az1192CommissionContextUrlApplied=true;
  try{const u=new URL(location.href),staff=u.searchParams.get('staff')||'',mode=u.searchParams.get('mode')||'overview';if(staff)az1192SetCommissionContext(staff,mode,{updateUrl:false,scroll:false});}catch(_e){}
}
function renderAdminCommissions(){
  azAdminSetCommissionDateState();adminCommissionFilteredCache=getFilteredAdminCommissions();
  let total=0,pending=0,approved=0,paid=0,rejected=0,voidCount=0,activeCount=0;
  adminCommissionFilteredCache.forEach(x=>{const amt=commissionAmountOf(x),b=commissionStatusBucket(x);if(b==='void'){voidCount++;return;}activeCount++;if(b==='paid'){paid+=amt;total+=amt;}else if(b==='approved'){approved+=amt;total+=amt;}else if(b==='rejected')rejected+=amt;else{pending+=amt;total+=amt;}});
  const unique=azCommissionUniqueSalesStats(adminCommissionFilteredCache);
  if($('#adminComTotal'))$('#adminComTotal').textContent=total.toFixed(2);if($('#adminComSalesTotal'))$('#adminComSalesTotal').textContent=unique.sales.toFixed(2);if($('#adminComUniqueSalesCount'))$('#adminComUniqueSalesCount').textContent=String(unique.count);if($('#adminComAvgRate'))$('#adminComAvgRate').textContent=unique.avgRate?unique.avgRate.toFixed(1)+'%':'0%';if($('#adminComPending'))$('#adminComPending').textContent=pending.toFixed(2);if($('#adminComApproved'))$('#adminComApproved').textContent=approved.toFixed(2);if($('#adminComPaid'))$('#adminComPaid').textContent=paid.toFixed(2);if($('#adminComCount'))$('#adminComCount').textContent=activeCount+' / '+voidCount;if($('#adminComRejectedNote'))$('#adminComRejectedNote').textContent='Rejected RM'+rejected.toFixed(2)+' • Total '+adminCommissionCache.length+' records';if($('#commissionResultInfo'))$('#commissionResultInfo').textContent=`Showing ${adminCommissionFilteredCache.length} of ${adminCommissionCache.length} • Active RM${total.toFixed(2)} • Unique sales ${unique.count} / RM${unique.sales.toFixed(2)}`;
  azRenderCommissionStaffSummary(adminCommissionFilteredCache);
  const rows=adminCommissionFilteredCache.map(x=>{
    const amt=commissionAmountOf(x).toFixed(2),sale=commissionSaleAmountOf(x),owner=commissionRecordTitle(x),product=esc(commissionProductName(x)),statusRaw=commissionPayoutStatus(x),statusBucket=commissionStatusBucket(x),docId=esc(x.docId||''),rowKey=esc(x._azRowKey||x.docId||''),typeLabel=esc(commissionTypeLabel(x)),rate=commissionRateOf(x),selectDisabled=!docId||statusBucket==='void'||statusBucket==='paid'?'disabled':'',isManual=commissionIsManual(x);
    let actions=`<button class="btn" data-commission-detail="${rowKey}">Detail</button>`;
    if(statusBucket==='pending')actions+=`<button class="btn" data-commission-payout="approved" data-commission-doc="${docId}">Approve</button><button class="btn red" data-commission-payout="rejected" data-commission-doc="${docId}">Reject</button>`;
    else if(statusBucket==='approved')actions+=`<button class="btn green" data-commission-payout="paid" data-commission-doc="${docId}">Paid</button><button class="btn gray" data-commission-payout="pending" data-commission-doc="${docId}">Pending</button><button class="btn red" data-commission-payout="rejected" data-commission-doc="${docId}">Reject</button>`;
    else if(statusBucket==='rejected')actions+=`<button class="btn gray" data-commission-payout="pending" data-commission-doc="${docId}">Reopen</button>`;
    if(statusBucket!=='void'){actions+=isManual?`<button class="btn gray" data-edit-commission="${docId}">Edit Adjustment</button>`:`<button class="btn gray" data-adjust-commission="${docId}">Adjustment</button>`;actions+=`<button class="btn red" data-void-commission="${docId}">Void</button>`;}
    return `<div class="az1198-table-row az1198-commission-grid is-${statusBucket}"><input type="checkbox" value="${docId}" data-commission-select ${selectDisabled}><div class="az1198-person"><strong>${owner}</strong><span class="az1198-sub">${product} • ${typeLabel} • ${fmtDate(commissionCreatedMs(x))}</span></div><span class="az1198-money">${sale?'RM'+sale.toFixed(2):'-'}</span><span class="az1198-money ready">RM${amt}${rate?' • '+rate.toFixed(1)+'%':''}</span><span class="az1198-status ${statusBucket}">${commissionStatusBadge(statusRaw)}</span><details class="az1198-row-menu"><summary>⋮</summary><div class="az1198-row-menu-pop">${actions}</div></details></div>`;
  });
  const notice=adminApiNotice?`<div class="az1198-empty">⚠️ ${esc(adminApiNotice)}</div>`:'';const list=$('#adminCommissionList');if(list){list.innerHTML=rows.join('')||notice||'<div class="az1198-empty">Tiada commission records.</div>';azAdminApplyPager(list,{key:'adminCommissionList',pageSize:10,label:'commission records',reset:true});}
  azAdminUpdateCommissionSelectedInfo();
}

async function fetchAdminCommissionsFromApi(){
  adminApiNotice='';
  const chip=$('#commissionApiStatus');
  if(chip){chip.className='az-commission-api-chip checking';chip.textContent='● Menyambung Commission API...';}
  try{
    const rows=[]; const seen=new Set(); let cursor=0; let cursorDocId=''; let pages=0; let hasMore=true;
    while(hasMore && pages<8 && rows.length<2000){
      const url=AZOBSS_BACKEND_API+'/api/commission/status?records=1&limit=300'
        +(cursor?('&beforeMs='+encodeURIComponent(cursor)):'')
        +(cursorDocId?('&cursorDocId='+encodeURIComponent(cursorDocId)):'');
      const j=await azAdminFetchJson(url,{cache:'no-store'});
      const page=Array.isArray(j.records)?j.records:[];
      page.forEach((x,i)=>{
        const key=String(x.docId||x.id||`${x.orderId||''}_${x.commissionType||''}_${x.username||''}_${x.createdAtMs||i}`);
        if(!seen.has(key)){seen.add(key);rows.push({...x,_source:'backend-api',_azRowKey:key});}
      });
      pages++;
      hasMore=!!j.hasMore;
      const next=Number(j.nextCursorMs||0)||0;
      const nextDoc=String(j.nextCursorDocId||'');
      if(!hasMore||(!next&&!nextDoc)||(next===cursor&&nextDoc===cursorDocId)) break;
      cursor=next; cursorDocId=nextDoc;
    }
    if(chip){chip.className='az-commission-api-chip ok';chip.textContent=`● Commission API Connected • ${rows.length} records`;}
    return rows;
  }catch(e){
    adminApiNotice=e?.message||'Commission backend API gagal.';
    if(chip){chip.className='az-commission-api-chip fail';chip.textContent='● Commission API Error';chip.title=adminApiNotice;}
    console.warn('Admin commission API failed',e);
    return [];
  }
}
async function loadAdminCommissions(){
  adminCommissionSelectedDocIds=new Set();
  adminCommissionCache=await fetchAdminCommissionsFromApi();
  adminCommissionCache.sort((a,b)=>commissionCreatedMs(b)-commissionCreatedMs(a));
  renderAdminCommissions();
  az1192ApplyCommissionContextFromUrl();
}
function resetCommissionForm(){
  $('#commissionEditDocId').value=''; if($('#commissionParentDocId')) $('#commissionParentDocId').value='';
  $('#commissionUsername').value=''; $('#commissionProduct').value=''; if($('#commissionSaleAmount')) $('#commissionSaleAmount').value=''; if($('#commissionPercent')) $('#commissionPercent').value=''; $('#commissionAmount').value=''; $('#commissionStatus').value='pending'; $('#commissionOwnerUid').value=''; $('#commissionOwnerUsername').value=''; $('#commissionOwnerEmail').value=''; $('#commissionNote').value='';
  if($('#commissionFormTitle')) $('#commissionFormTitle').textContent='Tambah Manual Adjustment';
}
function clearCommissionFilters(){
  ['commissionSearch','commissionStaffFilter','commissionProductFilter','commissionMinAmount','commissionMaxAmount'].forEach(id=>{const el=$('#'+id); if(el) el.value='';});
  if($('#commissionSourceFilter')) $('#commissionSourceFilter').value='all';
  if($('#commissionTypeFilter')) $('#commissionTypeFilter').value='all';
  if($('#commissionPayoutFilter')) $('#commissionPayoutFilter').value='all';
  if($('#commissionMonthFilter')) $('#commissionMonthFilter').value='all';
  if($('#commissionDateFrom')) $('#commissionDateFrom').value='';
  if($('#commissionDateTo')) $('#commissionDateTo').value='';
  renderAdminCommissions();
}
function exportCommissionCsv(){
  const rows=(adminCommissionFilteredCache.length?adminCommissionFilteredCache:getFilteredAdminCommissions()).map(x=>({docId:x.docId||'',orderId:x.orderId||'',billCode:x.billCode||'',productId:x.productId||'',username:commissionUsernameOf(x),ownerEmail:x.ownerEmail||x.email||'',product:commissionProductName(x),source:commissionSourceBucket(x),commissionType:commissionTypeLabel(x),saleAmount:commissionSaleAmountOf(x),commissionRate:commissionRateOf(x).toFixed(2),commissionAmount:commissionAmountOf(x),payoutStatus:commissionPayoutStatus(x),payoutReference:x.payoutReference||'',payoutMethod:x.payoutMethod||'',payoutNote:x.payoutNote||'',voided:!!x.voided,voidReason:x.voidReason||'',parentDocId:x.parentDocId||x.adjustmentParentDocId||'',createdAt:x.createdAt||x.createdAtMs||''}));
  const headers=['docId','orderId','billCode','productId','username','ownerEmail','product','source','commissionType','saleAmount','commissionRate','commissionAmount','payoutStatus','payoutReference','payoutMethod','payoutNote','voided','voidReason','parentDocId','createdAt'];
  const csv=[headers.join(',')].concat(rows.map(r=>headers.map(h=>'"'+String(r[h]??'').replace(/"/g,'""')+'"').join(','))).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='azobss-commission-records-'+new Date().toISOString().slice(0,10)+'.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function saveCommissionRecord(){
  const docId=$('#commissionEditDocId')?.value||'', parentDocId=$('#commissionParentDocId')?.value||'', saleAmount=Number($('#commissionSaleAmount')?.value||0), pct=Number($('#commissionPercent')?.value||0), amount=Number($('#commissionAmount')?.value||0), productName=$('#commissionProduct')?.value.trim()||'', username=$('#commissionUsername')?.value.trim()||'';
  if(!username) return toast('Username Staff/Manager diperlukan.');
  if(!productName) return toast('Produk / rujukan diperlukan.');
  if(!Number.isFinite(amount)||amount===0) return toast('Adjustment RM mesti bukan 0.');
  const payload={docId,parentDocId,username,productName,saleAmount,amount,commissionRate:pct||((saleAmount&&amount)?(amount/saleAmount*100):0),payoutStatus:$('#commissionStatus')?.value||'pending',note:$('#commissionNote')?.value.trim()||'',ownerUid:$('#commissionOwnerUid')?.value.trim()||'',ownerUsername:$('#commissionOwnerUsername')?.value.trim()||username,ownerEmail:$('#commissionOwnerEmail')?.value.trim()||''};
  try{
    await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/adjustment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    toast(docId?'Adjustment dikemas kini.':'Adjustment ditambah.');
    resetCommissionForm(); await loadAdminCommissions();
  }catch(e){toast(e?.message||'Gagal menyimpan adjustment.');}
}
function editCommissionRecord(docId){
  const x=adminCommissionCache.find(r=>String(r.docId||'')===String(docId||'')); if(!x) return;
  if(!commissionIsManual(x)) return beginCommissionAdjustment(docId);
  const panel=$('#commissionManualEntryPanel'); if(panel) panel.open=true;
  $('#commissionEditDocId').value=x.docId; if($('#commissionParentDocId')) $('#commissionParentDocId').value=x.parentDocId||x.adjustmentParentDocId||'';
  $('#commissionUsername').value=commissionUsernameOf(x); $('#commissionProduct').value=commissionProductName(x); if($('#commissionSaleAmount')) $('#commissionSaleAmount').value=commissionSaleAmountOf(x)||''; if($('#commissionPercent')) $('#commissionPercent').value=commissionRateOf(x)||''; $('#commissionAmount').value=commissionAmountOf(x); $('#commissionStatus').value=['pending','approved','rejected'].includes(commissionStatusBucket(x))?commissionStatusBucket(x):'pending'; $('#commissionOwnerUid').value=x.ownerUid||''; $('#commissionOwnerUsername').value=x.ownerUsername||x.username||''; $('#commissionOwnerEmail').value=x.ownerEmail||''; $('#commissionNote').value=x.note||x.payoutNote||'';
  if($('#commissionFormTitle')) $('#commissionFormTitle').textContent='Edit Manual Adjustment'; panel?.scrollIntoView({behavior:'smooth',block:'start'});
}
function beginCommissionAdjustment(docId){
  const x=adminCommissionCache.find(r=>String(r.docId||'')===String(docId||'')); if(!x) return toast('Commission record tidak dijumpai.');
  resetCommissionForm();
  const panel=$('#commissionManualEntryPanel'); if(panel) panel.open=true;
  if($('#commissionParentDocId')) $('#commissionParentDocId').value=x.docId||'';
  $('#commissionUsername').value=commissionUsernameOf(x); $('#commissionProduct').value='Adjustment — '+commissionProductName(x); if($('#commissionSaleAmount')) $('#commissionSaleAmount').value=commissionSaleAmountOf(x)||''; $('#commissionOwnerUid').value=x.ownerUid||''; $('#commissionOwnerUsername').value=x.ownerUsername||x.username||''; $('#commissionOwnerEmail').value=x.ownerEmail||'';
  $('#commissionNote').value=`Adjustment untuk commission ${x.docId||''} / order ${x.orderId||x.billCode||'-'}. Sebab: `;
  if($('#commissionFormTitle')) $('#commissionFormTitle').textContent='Tambah Adjustment untuk Rekod Sedia Ada';
  panel?.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(()=>$('#commissionAmount')?.focus(),250);
}
async function voidCommissionRecord(docId){
  if(!docId) return toast('Missing commission record ID.');
  const rec=adminCommissionCache.find(x=>String(x.docId||'')===String(docId));
  if(rec&&commissionIsVoid(rec)) return toast('Rekod ini sudah void.');
  const reason=String(prompt('Sebab Void / Reverse (wajib):','')||'').trim();
  if(!reason) return toast('Sebab Void diperlukan. Rekod tidak diubah.');
  if(!confirm('Void rekod ini? Rekod akan kekal untuk audit dan tidak akan dipadam.')) return;
  try{
    await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/void',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({docId,reason})});
    toast('Commission record telah di-void dan dikekalkan untuk audit.'); await loadAdminCommissions();
  }catch(e){toast(e?.message||'Gagal void commission record.');}
}
async function updateCommissionPayoutStatus(docId,status){
  if(!docId) return toast('Missing commission record ID.');
  const rec=adminCommissionCache.find(x=>String(x.docId||'')===String(docId));
  if(!rec) return toast('Commission record tidak dijumpai.');
  const current=commissionStatusBucket(rec), label=String(status||'').toUpperCase();
  if(status==='paid'&&current!=='approved') return toast('Komisen mesti Approved dahulu sebelum Mark Paid.');
  if(current==='paid') return toast('Rekod Paid adalah final. Gunakan Void/Reverse jika ada kesilapan.');
  if(!confirm(`Update payout ${commissionUsernameOf(rec)||''} daripada ${current.toUpperCase()} kepada ${label}?`)) return;
  let payoutReference='',payoutMethod='',payoutNote='';
  if(status==='paid'){
    payoutReference=String(prompt('Payment / transfer reference (WAJIB):','')||'').trim();
    if(!payoutReference) return toast('Payment reference wajib untuk rekod bayaran manual.');
    payoutMethod=String(prompt('Payout method manual (WAJIB):','Manual Bank Transfer')||'').trim();
    if(!payoutMethod) return toast('Payout method wajib sebelum Mark Paid.');
  }
  if(status==='rejected'){payoutNote=String(prompt('Sebab reject (digalakkan):','')||'').trim();}
  if(status==='approved'){payoutNote=String(prompt('Approval note (optional):','')||'').trim();}
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/payout-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({docId,payoutStatus:status,payoutReference,payoutMethod,payoutNote})});
    toast('Payout status: '+(j.payoutStatus||status)); await loadAdminCommissions();
  }catch(e){toast(e?.message||'Gagal update payout status.');}
}
async function azAdminBulkCommissionStatus(status){
  const ids=[...document.querySelectorAll('[data-commission-select]:checked')].map(el=>el.value).filter(Boolean);
  if(!ids.length) return toast('Pilih commission records dahulu.');
  const selected=adminCommissionCache.filter(x=>ids.includes(String(x.docId||'')));
  const staff=new Set(selected.map(x=>commissionUsernameOf(x).toLowerCase()).filter(Boolean));
  if(status==='paid'){
    if(staff.size!==1) return toast('Mark Paid mesti dibuat untuk seorang Staff/Manager pada satu masa.');
    const notApproved=selected.filter(x=>commissionStatusBucket(x)!=='approved');
    if(notApproved.length) return toast(`${notApproved.length} rekod belum Approved. Approve dahulu sebelum Paid.`);
  }
  if(selected.some(x=>commissionStatusBucket(x)==='paid') && status!=='paid') return toast('Rekod Paid tidak boleh diubah secara batch. Gunakan Void/Reverse jika perlu.');
  if(!confirm(`Update ${ids.length} record(s) kepada ${String(status).toUpperCase()}?`)) return;
  let payoutReference='',payoutMethod='',payoutNote='';
  if(status==='paid'){
    payoutReference=String(prompt('Payment / transfer reference untuk payout ini (WAJIB):','')||'').trim();
    if(!payoutReference) return toast('Payment reference wajib.');
    payoutMethod=String(prompt('Payout method manual (WAJIB):','Manual Bank Transfer')||'').trim();
    if(!payoutMethod) return toast('Payout method wajib.');
  }
  if(status==='rejected') payoutNote=String(prompt('Sebab reject (optional):','')||'').trim();
  if(status==='approved') payoutNote=String(prompt('Approval note (optional):','')||'').trim();
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/payout-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({docIds:ids,payoutStatus:status,payoutReference,payoutMethod,payoutNote})});
    toast('Bulk commission updated: '+(j.updated||ids.length)+' record(s).'); await loadAdminCommissions();
  }catch(e){toast(e?.message||'Bulk update gagal.');}
}
function azAdminOpenCommissionDetail(key){
  const rec=adminCommissionCache.find(x=>String(x.docId||'')===String(key)||String(x._azRowKey||'')===String(key)); if(!rec) return toast('Commission record not found.');
  const fields=[['Staff / Username',commissionUsernameOf(rec)||'-'],['Product',commissionProductName(rec)],['Product ID',rec.productId||'-'],['Order ID',rec.orderId||'-'],['Bill Code',rec.billCode||'-'],['Type',commissionTypeLabel(rec)],['Sale Amount',commissionSaleAmountOf(rec)?('RM'+commissionSaleAmountOf(rec).toFixed(2)):'-'],['Commission','RM'+commissionAmountOf(rec).toFixed(2)],['Rate',commissionRateOf(rec)?commissionRateOf(rec).toFixed(2)+'%':'-'],['Status',commissionPayoutStatus(rec)],['Payout Method',rec.payoutMethod||'-'],['Payout Reference',rec.payoutReference||'-'],['Parent / Adjustment Ref',rec.parentDocId||rec.adjustmentParentDocId||'-'],['Void Reason',rec.voidReason||'-'],['Created',fmtDate(commissionCreatedMs(rec))],['Source',rec._source||rec.sourcePage||'-']];
  const body=$('#commissionDetailBody');
  if(body){body.innerHTML='<div class="az-payment-detail-grid">'+fields.map(([k,v])=>`<div class="az-payment-detail-cell"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')+'</div><h3 style="margin:10px 0 8px">Raw Debug Data</h3><pre class="az-payment-detail-raw">'+esc(JSON.stringify(rec,(k,v)=>k==='_azRowKey'?undefined:v,2))+'</pre>';}
  const modal=$('#commissionDetailModal');
  if(modal){
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden','false');
    azAdminSyncDetailModalScrollLock();
    requestAnimationFrame(()=>{ const scroller=modal.querySelector('.az-payment-detail-body'); if(scroller) scroller.scrollTop=0; });
  }
}
function azAdminCloseCommissionDetail(){
  const modal=$('#commissionDetailModal');
  if(modal){ modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true'); }
  azAdminSyncDetailModalScrollLock();
}
document.addEventListener('keydown',(e)=>{
  if(e.key!=='Escape') return;
  if($('#commissionDetailModal')?.classList.contains('is-open')){ e.preventDefault(); azAdminCloseCommissionDetail(); return; }
  if($('#paymentLogDetailModal')?.classList.contains('is-open')){ e.preventDefault(); azAdminClosePaymentLogDetail(); }
});
async function retryCommissionForOrder(){
  const raw=String($('#commissionRetryOrderId')?.value||'').trim(); if(!raw) return toast('Masukkan Order ID atau Bill Code dahulu.');
  const box=$('#commissionRetryResult'); if(box) box.textContent='Menyemak paid order dan menjana commission...';
  try{ const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/commission/retry-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:raw,billCode:raw})}); const msg='Commission repair OK: '+(j.commission?.created||j.commission?.updated||j.commission?.count||0)+' line(s) processed.'; if(box) box.textContent=msg; toast(msg); await loadAdminCommissions(); }
  catch(e){const msg=e?.message||'Commission repair gagal.';if(box) box.textContent=msg;toast(msg);}
}
function runCommissionAudit(){
  const rows=adminCommissionFilteredCache.length?adminCommissionFilteredCache:getFilteredAdminCommissions();
  const issues=[]; const dupMap=new Map(); let manual=0,voided=0,paidNoRef=0,rateMismatch=0;
  rows.forEach(x=>{
    if(commissionIsManual(x)) manual++;
    if(commissionIsVoid(x)){voided++;return;}
    const key=[commissionOrderKey(x),commissionTypeBucket(x),commissionUsernameOf(x).toLowerCase()].join('|');
    if(commissionOrderKey(x)){dupMap.set(key,(dupMap.get(key)||0)+1);}
    const sale=commissionSaleAmountOf(x),rate=commissionRateOf(x),amt=commissionAmountOf(x);
    if(sale>0&&rate>0&&Math.abs((sale*rate/100)-amt)>0.06){rateMismatch++;issues.push(`Rate mismatch: ${commissionUsernameOf(x)} • ${commissionProductName(x)} • expected RM${(sale*rate/100).toFixed(2)} vs RM${amt.toFixed(2)}`);}
    if(commissionStatusBucket(x)==='paid'&&!String(x.payoutReference||'').trim()){paidNoRef++;issues.push(`Paid tanpa reference: ${commissionUsernameOf(x)} • ${x.orderId||x.billCode||x.docId||'-'}`);}
  });
  let duplicates=0; dupMap.forEach((n,key)=>{if(n>1){duplicates+=n-1;issues.push(`Possible duplicate (${n} records): ${key.replace(/\|/g,' • ')}`);}});
  const summary=`Duplicate ${duplicates} • Rate mismatch ${rateMismatch} • Paid tanpa reference ${paidNoRef} • Manual adjustment ${manual} • Void ${voided}`;
  if($('#commissionAuditSummary')) $('#commissionAuditSummary').textContent=summary;
  const box=$('#commissionAuditList');
  if(box) box.innerHTML=issues.slice(0,30).map(t=>`<div class="item az-commission-audit-issue"><div class="item-meta">${esc(t)}</div></div>`).join('')||'<div class="item"><div class="item-title az-commission-audit-ok">✅ Tiada isu audit asas ditemui untuk rekod semasa.</div></div>';
}

let adminPayoutRequestCache=[];
function adminPayoutTimelineHtml(r){
 const rows=Array.isArray(r?.timeline)?r.timeline.slice(-6):[];
 if(!rows.length) return '';
 return `<div class="item-meta" style="margin-top:8px"><b>Timeline:</b>${rows.map(x=>`<div>• ${esc(x.status||x.type||'update')} — ${esc(x.note||'')} ${x.actorUsername?`by ${esc(x.actorUsername)}`:''} ${x.createdAt?`(${esc(fmtDate(x.createdAtMs||x.createdAt))})`:''}</div>`).join('')}</div>`;
}
function payoutRequestStatusBadge(status){
  const s=String(status||'requested').toLowerCase();
  if(s==='paid') return '✅ paid';
  if(s==='processing') return '🏦 processing';
  if(s==='refunded') return '↩️ refunded';
  if(s==='approved') return '🟦 approved';
  if(s==='rejected') return '⛔ rejected';
  if(s==='cancelled') return '🚫 cancelled';
  if(s==='reviewing') return '🔎 reviewing';
  return '📨 requested';
}

let adminPayoutGateway={ready:false};
async function loadAdminPayoutGatewayStatus(){
 adminPayoutGateway={ready:false,manual:true};
 if($('#payoutGatewayBadge'))$('#payoutGatewayBadge').textContent='MANUAL';
 if($('#payoutGatewayText'))$('#payoutGatewayText').textContent='Manual Bank / DuitNow payout is the primary flow.';
 return;
 /* legacy Billplz compatibility retained */
 try{
  const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-gateway-status?limit=1',{cache:'no-store'}); adminPayoutGateway=j||{};
  const badge=$('#payoutGatewayBadge'),txt=$('#payoutGatewayText');
  if(badge){badge.textContent=j.ready?(j.mode==='production'?'LIVE READY':'SANDBOX READY'):(j.enabled?'SETUP INCOMPLETE':'DISABLED');badge.style.color=j.ready?'#34d399':'#f59e0b';}
  if(txt){const bits=[j.ready?'Billplz Payment Order sedia digunakan.':'Direct payout belum sedia.',j.limit?.text?('Payment Order Limit: '+j.limit.text):'',j.limitError?('Limit check: '+j.limitError):'',j.mode?('Mode: '+j.mode):'',j.callbackUrl?('Callback: '+j.callbackUrl):''].filter(Boolean);txt.textContent=bits.join(' • ');}
 }catch(e){adminPayoutGateway={ready:false};if($('#payoutGatewayBadge'))$('#payoutGatewayBadge').textContent='ERROR';if($('#payoutGatewayText'))$('#payoutGatewayText').textContent=e?.message||'Unable to check direct payout gateway.';}
}
async function payPayoutRequestToBank(requestId){
 const row=adminPayoutRequestCache.find(x=>String(x.docId||x.requestId||'')===String(requestId)); if(!row)return toast('Payout request not found.');
 const p=row.profile||{}; const account=p.accountNoMasked||'bank account';
 if(!adminPayoutGateway?.ready) return toast('Direct bank payout belum ready. Semak Direct Bank Payout / Render environment dahulu.');
 if(!confirm(`Pay ${row.amountText||('RM'+Number(row.amount||0).toFixed(2))} to ${p.bankName||'bank'} ${account} for ${row.username||row.email||'staff'}?\n\nThis will create a real Billplz Payment Order when gateway mode is production.`)) return;
 try{toast('Creating bank payout...');const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-request-pay-bank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId})});toast('Bank payout: '+(j.providerStatus||j.status||'processing'));await Promise.all([loadAdminPayoutRequests(),loadAdminCommissions(),loadAdminPayoutGatewayStatus()]);}catch(e){toast(e?.message||'Pay to Bank failed.');await loadAdminPayoutRequests();}
}
async function syncPayoutBankStatus(requestId){
 try{toast('Syncing bank status...');const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-request-sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId})});toast('Bank status: '+(j.providerStatus||j.status||''));await Promise.all([loadAdminPayoutRequests(),loadAdminCommissions()]);}catch(e){toast(e?.message||'Unable to sync bank status.');}
}

async function copyAdminPayoutDetails(requestId){
 const row=adminPayoutRequestCache.find(x=>String(x.docId||x.requestId||'')===String(requestId));if(!row)return toast('Payout request not found.');
 const p=row.profile||{};const lines=[`Staff: ${row.username||row.email||'-'}`,`Amount: ${row.amountText||('RM'+Number(row.amount||0).toFixed(2))}`,`Method: ${p.payoutMethod||'-'}`,p.bankName?`Bank: ${p.bankName}`:'',p.accountName?`Account Name: ${p.accountName}`:'',p.accountNo?`Account / DuitNow: ${p.accountNo}`:(p.duitNowId?`DuitNow: ${p.duitNowId}`:''),p.payoutPhone?`Phone: ${p.payoutPhone}`:''].filter(Boolean);
 try{await navigator.clipboard.writeText(lines.join('\n'));toast('Payout details copied.');}catch(_){toast('Unable to copy payout details.');}
}
let adminPayoutQrDraft='';
let adminPayoutQrCropState=null;
let adminPayoutQrCropDirty=false;
function adminPayoutRowById(requestId){return adminPayoutRequestCache.find(x=>String(x.docId||x.requestId||'')===String(requestId));}
function adminPayoutQrImageFromDataUrl(dataUrl){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('QR image tidak sah.'));i.src=String(dataUrl||'');});}
async function adminReadPayoutQrFile(file){
 if(!file)return'';if(!/^image\/(png|jpeg|webp)$/i.test(file.type||''))throw new Error('QR mesti PNG, JPG atau WebP.');if(file.size>6*1024*1024)throw new Error('QR terlalu besar. Maksimum 6MB.');
 return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Gagal membaca QR.'));r.readAsDataURL(file);});
}
function adminPayoutQrCropEls(){const modal=ensureAdminPayoutQrModal();return{modal,box:modal.querySelector('#az1197QrCropper'),canvas:modal.querySelector('#az1197QrCropCanvas'),zoom:modal.querySelector('#az1197QrCropZoom'),info:modal.querySelector('#az1196QrEditorInfo')}}
function adminRenderPayoutQrCrop(){
 const {canvas}=adminPayoutQrCropEls(),st=adminPayoutQrCropState;if(!canvas||!st?.img)return;const ctx=canvas.getContext('2d');ctx.save();ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;const scale=st.baseScale*st.zoom;ctx.drawImage(st.img,st.x,st.y,st.img.naturalWidth*scale,st.img.naturalHeight*scale);ctx.restore();
}
async function adminStartPayoutQrCrop(dataUrl,{dirty=false}={}){
 const {box,canvas,zoom,info}=adminPayoutQrCropEls();if(!dataUrl||!canvas)return;const img=await adminPayoutQrImageFromDataUrl(dataUrl);const baseScale=Math.min(canvas.width/(img.naturalWidth||1),canvas.height/(img.naturalHeight||1));const w=img.naturalWidth*baseScale,h=img.naturalHeight*baseScale;adminPayoutQrCropState={img,sourceDataUrl:String(dataUrl),baseScale,zoom:1,x:(canvas.width-w)/2,y:(canvas.height-h)/2};adminPayoutQrCropDirty=!!dirty;if(zoom)zoom.value='1';if(box)box.hidden=false;adminRenderPayoutQrCrop();if(info)info.textContent=dirty?'Gambar baru dimuatkan. Drag gambar + Zoom, kemudian tekan ✂️ Crop & Guna.':'QR semasa sedia untuk crop. Drag gambar + Zoom jika mahu ubah crop.';
}
function adminResetPayoutQrCrop(){const st=adminPayoutQrCropState,{canvas,zoom}=adminPayoutQrCropEls();if(!st?.img||!canvas)return;st.zoom=1;const w=st.img.naturalWidth*st.baseScale,h=st.img.naturalHeight*st.baseScale;st.x=(canvas.width-w)/2;st.y=(canvas.height-h)/2;if(zoom)zoom.value='1';adminPayoutQrCropDirty=true;adminRenderPayoutQrCrop();}
function adminSetPayoutQrCropZoom(nextZoom){const st=adminPayoutQrCropState,{canvas}=adminPayoutQrCropEls();if(!st?.img||!canvas)return;const oldScale=st.baseScale*st.zoom,newZoom=Math.max(1,Math.min(12,Number(nextZoom)||1)),newScale=st.baseScale*newZoom;const cx=(canvas.width/2-st.x)/oldScale,cy=(canvas.height/2-st.y)/oldScale;st.zoom=newZoom;st.x=canvas.width/2-cx*newScale;st.y=canvas.height/2-cy*newScale;adminPayoutQrCropDirty=true;adminRenderPayoutQrCrop();}
function adminApplyPayoutQrCrop(){
 const st=adminPayoutQrCropState,{canvas,info}=adminPayoutQrCropEls();if(!st?.img||!canvas)return toast('Pilih QR image dahulu.');const out=document.createElement('canvas'),size=900,f=size/canvas.width;out.width=size;out.height=size;const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.imageSmoothingEnabled=false;const scale=st.baseScale*st.zoom*f;ctx.drawImage(st.img,st.x*f,st.y*f,st.img.naturalWidth*scale,st.img.naturalHeight*scale);let data=out.toDataURL('image/png');if(data.length>420000)data=out.toDataURL('image/jpeg',.92);if(data.length>520000){toast('Hasil crop masih terlalu besar. Crop lebih dekat pada QR.');return;}adminPayoutQrDraft=data;adminPayoutQrCropDirty=false;const img=document.querySelector('#az1196QrModalImage');if(img){img.src=data;img.style.visibility='visible';}if(info)info.textContent='Crop digunakan • '+Math.round(data.length/1024)+' KB • tekan 💾 Simpan QR.';toast('Crop QR digunakan.');
}
function adminBindPayoutQrCropPointer(canvas){
 if(!canvas||canvas.dataset.cropBound==='1')return;canvas.dataset.cropBound='1';let dragging=false,lastX=0,lastY=0;const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};canvas.addEventListener('pointerdown',e=>{if(!adminPayoutQrCropState)return;dragging=true;canvas.classList.add('is-dragging');const p=point(e);lastX=p.x;lastY=p.y;canvas.setPointerCapture?.(e.pointerId);e.preventDefault();});canvas.addEventListener('pointermove',e=>{if(!dragging||!adminPayoutQrCropState)return;const p=point(e);adminPayoutQrCropState.x+=p.x-lastX;adminPayoutQrCropState.y+=p.y-lastY;lastX=p.x;lastY=p.y;adminPayoutQrCropDirty=true;adminRenderPayoutQrCrop();e.preventDefault();});const stop=e=>{dragging=false;canvas.classList.remove('is-dragging');try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);
}
function ensureAdminPayoutQrModal(){
 let modal=document.getElementById('az1196PayoutQrModal');
 if(modal)return modal;
 modal=document.createElement('div');modal.id='az1196PayoutQrModal';modal.className='az1196-qr-modal';modal.hidden=true;
 modal.innerHTML=`<div class="az1196-qr-modal-card" role="dialog" aria-modal="true" aria-labelledby="az1196QrTitle"><div class="az1196-qr-modal-head"><b id="az1196QrTitle">Payout QR</b><button class="btn" type="button" data-payout-qr-close>✕ Close</button></div><div class="az1196-qr-modal-preview"><img id="az1196QrModalImage" alt="Payout QR large preview"></div><div id="az1196QrEditor" class="az1196-qr-modal-editor" hidden><label><b>✏️ Edit / Tukar QR + Crop</b></label><input id="az1196QrFile" type="file" accept="image/png,image/jpeg,image/webp"><div id="az1197QrCropper" class="az1197-cropper" hidden><div class="az1197-crop-stage"><canvas id="az1197QrCropCanvas" class="az1197-crop-canvas" width="390" height="390"></canvas></div><div class="az1197-crop-hint">Drag gambar untuk alih kedudukan. Gunakan Zoom supaya hanya QR + sedikit ruang putih berada dalam kotak.</div><div class="az1197-crop-controls"><label>Zoom <input id="az1197QrCropZoom" type="range" min="1" max="12" step="0.05" value="1"></label><button class="btn" type="button" data-payout-qr-crop-reset>↺ Reset</button><button class="btn green" type="button" data-payout-qr-crop-apply>✂️ Crop & Guna</button></div></div><div id="az1196QrEditorInfo" class="az1196-qr-modal-note">Pilih QR baru atau crop QR semasa sebelum Simpan.</div><div class="az1196-qr-modal-actions"><button class="btn red" type="button" data-payout-qr-remove>Remove QR</button><button class="btn" type="button" data-payout-qr-cancel-edit>Cancel Edit</button><button class="btn green" type="button" data-payout-qr-save>💾 Simpan QR</button></div></div></div>`;
 document.body.appendChild(modal);
 const file=modal.querySelector('#az1196QrFile');
 file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;try{const info=modal.querySelector('#az1196QrEditorInfo');if(info)info.textContent='Membuka crop editor...';const raw=await adminReadPayoutQrFile(f);await adminStartPayoutQrCrop(raw,{dirty:true});}catch(e){const info=modal.querySelector('#az1196QrEditorInfo');if(info)info.textContent=e?.message||'QR gagal diproses.';file.value='';}});
 const zoom=modal.querySelector('#az1197QrCropZoom');zoom?.addEventListener('input',()=>adminSetPayoutQrCropZoom(zoom.value));
 modal.querySelector('[data-payout-qr-crop-reset]')?.addEventListener('click',adminResetPayoutQrCrop);
 modal.querySelector('[data-payout-qr-crop-apply]')?.addEventListener('click',adminApplyPayoutQrCrop);
 adminBindPayoutQrCropPointer(modal.querySelector('#az1197QrCropCanvas'));
 modal.addEventListener('click',e=>{if(e.target===modal)closeAdminPayoutQrModal();});
 return modal;
}
function openAdminPayoutQrModal(requestId,edit=false){
 const row=adminPayoutRowById(requestId);if(!row)return toast('Payout request not found.');const p=row.profile||{};const modal=ensureAdminPayoutQrModal();modal.dataset.requestId=String(requestId);modal.dataset.originalQr=String(p.qrImageDataUrl||'');adminPayoutQrDraft=String(p.qrImageDataUrl||'');adminPayoutQrCropState=null;adminPayoutQrCropDirty=false;const img=modal.querySelector('#az1196QrModalImage');if(img){img.src=adminPayoutQrDraft||'';img.style.visibility=adminPayoutQrDraft?'visible':'hidden';}const title=modal.querySelector('#az1196QrTitle');if(title)title.textContent=`Payout QR • ${row.username||row.email||'Staff'}`;const editor=modal.querySelector('#az1196QrEditor');if(editor)editor.hidden=!edit;const crop=modal.querySelector('#az1197QrCropper');if(crop)crop.hidden=true;const file=modal.querySelector('#az1196QrFile');if(file)file.value='';const info=modal.querySelector('#az1196QrEditorInfo');if(info)info.textContent=adminPayoutQrDraft?'QR semasa dimuatkan. Crop terus atau pilih fail baru.':'Belum ada QR. Pilih fail QR untuk upload dan crop.';modal.hidden=false;document.body.style.overflow='hidden';if(edit&&adminPayoutQrDraft)setTimeout(()=>adminStartPayoutQrCrop(adminPayoutQrDraft,{dirty:false}).catch(()=>{}),0);
}
function closeAdminPayoutQrModal(){const modal=document.getElementById('az1196PayoutQrModal');if(!modal)return;modal.hidden=true;modal.dataset.requestId='';document.body.style.overflow='';adminPayoutQrDraft='';adminPayoutQrCropState=null;adminPayoutQrCropDirty=false;}
function cancelAdminPayoutQrEdit(){const modal=ensureAdminPayoutQrModal();const original=String(modal.dataset.originalQr||'');adminPayoutQrDraft=original;adminPayoutQrCropState=null;adminPayoutQrCropDirty=false;const img=modal.querySelector('#az1196QrModalImage');if(img){img.src=original;img.style.visibility=original?'visible':'hidden';}const editor=modal.querySelector('#az1196QrEditor');if(editor)editor.hidden=true;const crop=modal.querySelector('#az1197QrCropper');if(crop)crop.hidden=true;const file=modal.querySelector('#az1196QrFile');if(file)file.value='';}
async function saveAdminPayoutQr(remove=false){
 const modal=ensureAdminPayoutQrModal(),requestId=String(modal.dataset.requestId||'');if(!requestId)return toast('Missing payout request ID.');if(!remove&&!adminPayoutQrDraft)return toast('Pilih QR image dahulu.');if(!remove&&adminPayoutQrCropDirty)return toast('Crop belum digunakan. Tekan ✂️ Crop & Guna dahulu.');if(remove&&!confirm('Remove QR payout untuk Staff/Manager ini?'))return;
 try{const info=modal.querySelector('#az1196QrEditorInfo');if(info)info.textContent='Saving QR...';await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-profile-qr',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,qrImageDataUrl:remove?'':adminPayoutQrDraft,removeQrImage:!!remove})});toast(remove?'QR payout removed.':'QR payout updated.');closeAdminPayoutQrModal();await loadAdminPayoutRequests();}catch(e){const info=modal.querySelector('#az1196QrEditorInfo');if(info)info.textContent=e?.message||'Gagal simpan QR.';toast(e?.message||'Gagal simpan QR.');}
}

async function loadAdminPayoutRequests(){
  try{const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-requests?limit=120',{cache:'no-store'});adminPayoutRequestCache=Array.isArray(j.requests)?j.requests:[];renderAdminPayoutRequests();if(adminCommissionFilteredCache?.length)azRenderCommissionStaffSummary(adminCommissionFilteredCache);}
  catch(e){if($('#adminPayoutRequestList'))$('#adminPayoutRequestList').innerHTML='<div class="az1198-empty">'+esc(e?.message||'Failed to load payout requests.')+'</div>';}
}
function az1198PayoutFilterMatch(status,mode){status=String(status||'requested').toLowerCase();mode=String(mode||'needs_action').toLowerCase();if(mode==='all')return true;if(mode==='needs_action')return ['requested','reviewing','approved','processing'].includes(status);if(mode==='history')return ['paid','refunded','rejected','cancelled'].includes(status);return status===mode;}
function az1198UpdatePayoutTabs(staffFilter=''){const all=adminPayoutRequestCache.filter(r=>{const who=String([r.username,r.staffUsername,r.email,r.staffEmail,r.uid,r.staffUid].filter(Boolean).join(' ')).toLowerCase();return !staffFilter||who.includes(staffFilter);});const counts={all:all.length,needs_action:0,requested:0,approved:0,paid:0,history:0};all.forEach(r=>{const st=String(r.status||'requested').toLowerCase();if(['requested','reviewing','approved','processing'].includes(st))counts.needs_action++;if(st==='requested')counts.requested++;if(st==='approved')counts.approved++;if(st==='paid')counts.paid++;if(['paid','refunded','rejected','cancelled'].includes(st))counts.history++;});Object.entries(counts).forEach(([k,v])=>{document.querySelector(`[data-payout-count="${k}"]`)?.replaceChildren(document.createTextNode(String(v)));});const mode=String($('#payoutRequestFilter')?.value||'needs_action');document.querySelectorAll('[data-payout-view]').forEach(b=>b.classList.toggle('active',b.getAttribute('data-payout-view')===mode));}
function az1198PayoutMethodText(p){return String(p?.payoutMethod||p?.bankName||p?.ewalletName||p?.duitNowType||'-');}
function renderAdminPayoutRequests(){
  const mode=String($('#payoutRequestFilter')?.value||'needs_action').toLowerCase(),staffFilter=String($('#payoutRequestStaffFilter')?.value||az1192CommissionStaffContext||'').trim().toLowerCase();az1198UpdatePayoutTabs(staffFilter);
  const rows=adminPayoutRequestCache.filter(r=>{const who=String([r.username,r.staffUsername,r.email,r.staffEmail,r.uid,r.staffUid].filter(Boolean).join(' ')).toLowerCase();return az1198PayoutFilterMatch(r.status,mode)&&(!staffFilter||who.includes(staffFilter));});
  const sum=rows.reduce((a,r)=>{a.total+=Number(r.amount||0)||0;a.count++;return a;},{total:0,count:0});if($('#adminPayoutRequestSummary'))$('#adminPayoutRequestSummary').textContent=`${rows.length} request • RM${sum.total.toFixed(2)}${staffFilter?' • '+staffFilter:''}`;
  const box=$('#adminPayoutRequestList');if(!box)return;
  box.innerHTML=rows.map(r=>{const p=r.profile||{},rid=esc(r.docId||r.requestId),st=String(r.status||'requested').toLowerCase(),who=esc(r.username||r.staffUsername||r.email||'staff'),amount=esc(r.amountText||('RM'+Number(r.amount||0).toFixed(2))),canSelect=['requested','reviewing','approved'].includes(st),qr=!!p.qrImageDataUrl,requested=r.createdAt?fmtDate(r.createdAtMs||r.createdAt):'-';return `<div class="az1198-table-row az1198-payout-grid"><input type="checkbox" data-payout-select="${rid}" ${canSelect?'':'disabled'}><div class="az1198-person"><strong>${who}</strong><span class="az1198-sub">${r.recordCount||0} record${Number(r.recordCount||0)===1?'':'s'} • ${qr?'QR ready':'QR missing'}</span></div><span class="az1198-money ready">${amount}</span><span class="az1198-status ${st}">${esc(st.replace('_',' '))}</span><span class="az1198-sub">${esc(requested)}</span><span class="az1198-sub">${esc(az1198PayoutMethodText(p))}</span><button class="az1198-open-btn" type="button" data-payout-drawer="${rid}">View ›</button></div>`;}).join('')||'<div class="az1198-empty">Tiada payout request dalam view ini.</div>';
  azAdminApplyPager(box,{key:'adminPayoutRequestList',pageSize:10,label:'payout requests',reset:true});az1198UpdatePayoutSelection();
}
async function updatePayoutRequestStatus(requestId,status){
  if(!requestId) return toast('Missing payout request ID.');
  const row=adminPayoutRequestCache.find(x=>String(x.docId||x.requestId||'')===String(requestId));
  const current=String(row?.status||'requested').toLowerCase();
  if(status==='paid'&&current!=='approved') return toast('Payout request mesti Approved dahulu sebelum rekod bayaran manual.');
  if(['paid','cancelled','refunded'].includes(current)&&current!==status) return toast('Payout request final tidak boleh diubah.');
  if(current==='processing') return toast('Payout sedang diproses bank. Gunakan Sync Bank Status.');
  if(!confirm('Update payout request daripada '+current.toUpperCase()+' kepada '+String(status).toUpperCase()+'?')) return;
  let payoutReference='', payoutMethod='', adminNote='';
  if(status==='paid'){
    payoutReference=String(prompt('Payment / transfer reference (WAJIB):','')||'').trim();
    if(!payoutReference) return toast('Payment reference wajib untuk rekod bayaran manual.');
    payoutMethod=String(prompt('Payout method manual (WAJIB):','Manual Bank Transfer')||'').trim();
    if(!payoutMethod) return toast('Payout method wajib sebelum Mark Paid.');
  }
  if(status==='rejected') adminNote=String(prompt('Sebab reject (optional):','')||'').trim();
  if(status==='approved'||status==='reviewing') adminNote=String(prompt('Admin note (optional):','')||'').trim();
  try{
    const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-request-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,status,payoutReference,payoutMethod,adminNote})});
    toast('Payout request updated: '+(j.status||status));
    az1198CloseDrawers?.();
    await Promise.all([loadAdminPayoutRequests(), loadAdminCommissions()]);
  }catch(e){ toast(e?.message||'Failed to update payout request.'); }
}


function az1198CloseDrawers(){const b=$('#az1198DrawerBackdrop'),sd=$('#az1198StaffDrawer'),pd=$('#az1198PayoutDrawer');if(b)b.hidden=true;if(sd)sd.hidden=true;if(pd)pd.hidden=true;document.body.style.overflow='';}
function az1198ShowDrawer(which){az1198CloseDrawers();const b=$('#az1198DrawerBackdrop'),d=$(which);if(b)b.hidden=false;if(d)d.hidden=false;document.body.style.overflow='hidden';}
function az1198Money(n){return 'RM'+(Number(n||0)||0).toFixed(2);}
function az1198OpenStaffDrawer(name){
  const key=String(name||'').trim().toLowerCase();if(!key)return;const comm=adminCommissionCache.filter(x=>commissionUsernameOf(x).toLowerCase()===key&&!commissionIsVoid(x));const payouts=adminPayoutRequestCache.filter(r=>az1198PayoutWho(r).toLowerCase()===key).sort((a,b)=>(Number(b.createdAtMs||0)||0)-(Number(a.createdAtMs||0)||0));let pending=0,ready=0,paid=0;comm.forEach(x=>{const st=commissionStatusBucket(x),a=commissionAmountOf(x);if(st==='pending')pending+=a;else if(st==='approved')ready+=a;else if(st==='paid')paid+=a;});const latest=payouts.find(r=>r.profile&&Object.keys(r.profile).length)||payouts[0]||null,p=latest?.profile||{},rid=latest?String(latest.docId||latest.requestId||''):'';
  if($('#az1198StaffDrawerTitle'))$('#az1198StaffDrawerTitle').textContent=name;if($('#az1198StaffDrawerSubtitle'))$('#az1198StaffDrawerSubtitle').textContent=`${comm.length} commission • ${payouts.length} payout request`;
  const account=[p.bankName||p.ewalletName,p.accountName,p.accountNo||p.accountNoMasked,p.duitNowId,p.payoutPhone,p.payoutEmail].filter(Boolean).map(esc).join(' • ');
  const qr=p.qrImageDataUrl&&rid?`<div class="az1198-drawer-qr"><button class="az1196-qr-image-btn" type="button" data-payout-qr-view="${esc(rid)}"><img src="${esc(p.qrImageDataUrl)}" alt="Payout QR"></button><div class="az1198-drawer-actions"><button class="btn" type="button" data-payout-qr-view="${esc(rid)}">🔍 Besarkan QR</button><button class="btn" type="button" data-payout-qr-edit="${esc(rid)}">✏️ Edit / Crop QR</button></div></div>`:(rid?`<div class="az1198-empty">Belum ada QR payout.<br><button class="btn" type="button" data-payout-qr-edit="${esc(rid)}" style="margin-top:8px">Upload / Crop QR</button></div>`:'<div class="az1198-empty">Belum ada payout request/profile untuk QR.</div>');
  const recentComm=comm.sort((a,b)=>commissionCreatedMs(b)-commissionCreatedMs(a)).slice(0,6).map(x=>`<div class="az1198-drawer-item"><div><strong>${esc(commissionProductName(x))}</strong><small>${esc(commissionTypeLabel(x))} • ${fmtDate(commissionCreatedMs(x))}</small></div><span class="az1198-status ${commissionStatusBucket(x)}">${az1198Money(commissionAmountOf(x))}</span></div>`).join('')||'<div class="az1198-empty">Tiada commission.</div>';
  const recentPay=payouts.slice(0,5).map(r=>`<div class="az1198-drawer-item"><div><strong>${az1198Money(r.amount)}</strong><small>${esc(String(r.status||'requested'))} • ${r.createdAt?fmtDate(r.createdAtMs||r.createdAt):'-'}</small></div><button class="az1198-open-btn" type="button" data-payout-drawer="${esc(r.docId||r.requestId)}">View</button></div>`).join('')||'<div class="az1198-empty">Tiada payout request.</div>';
  const body=$('#az1198StaffDrawerBody');if(body)body.innerHTML=`<div class="az1198-drawer-metrics"><div class="az1198-drawer-metric"><span>Pending</span><b>${az1198Money(pending)}</b></div><div class="az1198-drawer-metric"><span>Ready</span><b>${az1198Money(ready)}</b></div><div class="az1198-drawer-metric"><span>Paid</span><b>${az1198Money(paid)}</b></div></div><div class="az1198-drawer-actions"><button class="btn" type="button" data-commission-staff-mode="overview" data-commission-staff-name="${esc(name)}">Filter Commission</button><button class="btn" type="button" data-commission-staff-mode="payout" data-commission-staff-name="${esc(name)}">Filter Payout</button></div><div class="az1198-drawer-section"><h3>💳 Payout Profile</h3><div class="az1198-drawer-line"><span>Method</span><b>${esc(p.payoutMethod||'-')}</b></div><div class="az1198-drawer-line"><span>Details</span><b>${account||'-'}</b></div>${qr}</div><div class="az1198-drawer-section"><h3>Recent Commission</h3><div class="az1198-drawer-list">${recentComm}</div></div><div class="az1198-drawer-section"><h3>Payout History</h3><div class="az1198-drawer-list">${recentPay}</div></div>`;az1198ShowDrawer('#az1198StaffDrawer');
}
function az1198OpenPayoutDrawer(requestId){
  const r=adminPayoutRowById(requestId);if(!r)return toast('Payout request not found.');const p=r.profile||{},st=String(r.status||'requested').toLowerCase(),rid=esc(r.docId||r.requestId),who=esc(r.username||r.staffUsername||r.email||'staff'),account=[p.bankName||p.ewalletName,p.accountName,p.accountNo||p.accountNoMasked,p.duitNowId,p.payoutPhone,p.payoutEmail].filter(Boolean).map(esc).join(' • '),receiptLabel=st==='paid'?'View Receipt':'View Statement';
  if($('#az1198PayoutDrawerTitle'))$('#az1198PayoutDrawerTitle').textContent=`${r.username||r.staffUsername||r.email||'Staff'} • ${az1198Money(r.amount)}`;if($('#az1198PayoutDrawerSubtitle'))$('#az1198PayoutDrawerSubtitle').textContent=`${st.toUpperCase()} • ${r.createdAt?fmtDate(r.createdAtMs||r.createdAt):''}`;
  const qr=p.qrImageDataUrl?`<div class="az1198-drawer-qr"><button class="az1196-qr-image-btn" type="button" data-payout-qr-view="${rid}"><img src="${esc(p.qrImageDataUrl)}" alt="Payout QR ${who}"></button><div class="az1198-drawer-actions"><button class="btn" type="button" data-payout-qr-view="${rid}">🔍 Besarkan</button><button class="btn" type="button" data-payout-qr-edit="${rid}">✏️ Edit / Crop QR</button></div></div>`:`<div class="az1198-empty">Belum ada QR.<br><button class="btn" type="button" data-payout-qr-edit="${rid}" style="margin-top:8px">Upload / Crop QR</button></div>`;
  const copyBtn=account?`<button class="btn" data-payout-copy-details="${rid}">📋 Copy Details</button>`:'',paidBtn=st==='approved'?`<button class="btn green" data-payout-request-status="paid" data-payout-request-id="${rid}">✓ Record Payment</button>`:'',approveBtn=['requested','reviewing'].includes(st)?`<button class="btn" data-payout-request-status="approved" data-payout-request-id="${rid}">Approve</button>`:'',reviewBtn=st==='requested'?`<button class="btn" data-payout-request-status="reviewing" data-payout-request-id="${rid}">Review</button>`:'',rejectBtn=!['paid','cancelled','rejected','processing','refunded'].includes(st)?`<button class="btn red" data-payout-request-status="rejected" data-payout-request-id="${rid}">Reject</button>`:'';
  const body=$('#az1198PayoutDrawerBody');if(body)body.innerHTML=`<div class="az1198-drawer-metrics"><div class="az1198-drawer-metric"><span>Amount</span><b>${az1198Money(r.amount)}</b></div><div class="az1198-drawer-metric"><span>Records</span><b>${esc(r.recordCount||0)}</b></div><div class="az1198-drawer-metric"><span>Status</span><b>${esc(st)}</b></div></div><div class="az1198-drawer-section"><h3>Payment Details</h3><div class="az1198-drawer-line"><span>Staff</span><b>${who}</b></div><div class="az1198-drawer-line"><span>Method</span><b>${esc(p.payoutMethod||'-')}</b></div><div class="az1198-drawer-line"><span>Account</span><b>${account||'-'}</b></div><div class="az1198-drawer-line"><span>Reference</span><b>${esc(r.payoutReference||'-')}</b></div><div class="az1198-drawer-line"><span>Note</span><b>${esc(r.note||r.adminNote||'-')}</b></div></div><div class="az1198-drawer-section"><h3>QR Payout</h3>${qr}</div><div class="az1198-drawer-section"><h3>Timeline</h3>${adminPayoutTimelineHtml(r)}</div><div class="az1198-drawer-actions"><button class="btn" data-payout-receipt="${rid}">${receiptLabel}</button><button class="btn" type="button" data-payout-open-commission="${who}">Commission</button>${copyBtn}${reviewBtn}${approveBtn}${paidBtn}${rejectBtn}</div>`;az1198ShowDrawer('#az1198PayoutDrawer');
}
function az1198UpdatePayoutSelection(){const checked=[...document.querySelectorAll('[data-payout-select]:checked')],bar=$('#az1198PayoutBulkBar');if(bar)bar.hidden=!checked.length;if($('#az1198PayoutSelectedInfo'))$('#az1198PayoutSelectedInfo').textContent=`${checked.length} selected • ${az1198Money(checked.reduce((a,c)=>{const r=adminPayoutRowById(c.getAttribute('data-payout-select'));return a+(Number(r?.amount||0)||0)},0))}`;}
async function az1198BulkPayoutStatus(status){const ids=[...document.querySelectorAll('[data-payout-select]:checked')].map(c=>c.getAttribute('data-payout-select')).filter(Boolean);if(!ids.length)return toast('Pilih payout request dahulu.');const allowed=status==='approved'?['requested','reviewing']:['requested','reviewing','approved'],targets=ids.map(adminPayoutRowById).filter(r=>r&&allowed.includes(String(r.status||'requested').toLowerCase()));if(!targets.length)return toast('Tiada request dipilih yang boleh dikemas kini.');let adminNote='';if(status==='rejected')adminNote=String(prompt('Sebab reject untuk semua dipilih (optional):','')||'').trim();if(!confirm(`${status==='approved'?'Approve':'Reject'} ${targets.length} payout request?`))return;let ok=0,fail=0;for(const r of targets){try{await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/payout-request-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:r.docId||r.requestId,status,adminNote})});ok++;}catch(_e){fail++;}}toast(`Bulk payout: ${ok} updated${fail?' • '+fail+' failed':''}.`);await Promise.all([loadAdminPayoutRequests(),loadAdminCommissions()]);}


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
    const snap=await safeGet(query(collection(db,AZ_ADMIN_ONLINE_COLLECTION),limit(100)),'Online Users: '+AZ_ADMIN_ONLINE_COLLECTION);
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
  azAdminApplyPager(box,{key:'onlineList',pageSize:10,label:'online users',reset:true});

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
let adminRegisteredUsersTotalCount=null;
let adminFoodOrderAccessCache=new Map();
const ADMIN_REGISTERED_PAGE_SIZE=10;
const ADMIN_REGISTERED_LOAD_LIMIT=500;
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
function azRegAccountRoleLabel(value){
  const r=String(value||'user').trim().toLowerCase().replace(/[\s_-]+/g,'');
  if(r==='admin')return 'Administrator';
  if(r==='semiadmin')return 'Manager';
  if(r==='staff')return 'Staff';
  // Legacy role=member means a normal registered user. Paid Membership is separate.
  return 'User';
}
function azRegSub(x){
  return [x.email||x.authEmail||'', x.phone||x.phoneNumber||''].filter(Boolean).join(' • ');
}
function azRegPaAllowed(x){
  const managed = x?.adminPaBmOverride === true || String(x?.paBmManagedBy || '').toLowerCase() === 'admin';
  if(managed){
    return x.adminPaBmAllowed === true;
  }
  return x.paBmAllowed===true||x.paAccessAllowed===true||x.allowPABM===true||x.allowPaBm===true||x.canAccessPaBm===true||x.showPaBmTab===true||x.permissions?.paBmAllowed===true;
}
function azRegUid(x){
  return String(x?.uid||x?.authUid||x?.userUid||x?.firebaseUid||'').trim();
}
function azRegFoodOrdersAllowed(x){
  if(typeof x?.__foodAllowed==='boolean')return x.__foodAllowed;
  const uid=azRegUid(x);
  if(!uid)return false;
  const access=adminFoodOrderAccessCache.get(uid);
  return !!(access&&access.active===true&&access.canViewFoodOrders===true);
}
function azRegFoodOrdersPillHtml(allowed){
  return `<span class="az-admin-reg-food-pill ${allowed?'on':'off'}"><span class="az-pabm-dot ${allowed?'on':'off'}"></span>Tempahan ${allowed?'allowed':'off'}</span>`;
}
function azRegRole(x){const r=String(x.role||'user').trim().toLowerCase().replace(/[^a-z]/g,'');return r==='member'?'user':r;}
function azRegRoleClass(x){
  const r=azRegRole(x);
  if(r==='admin')return 'role-admin';
  if(r==='semiadmin')return 'role-semiadmin';
  if(r==='staff')return 'role-staff';
  if(r==='user')return 'role-user';
  return 'role-unknown';
}
function azRegRoleLabel(x){
  return azRegAccountRoleLabel(x?.role);
}
function azRegMembershipInfo(x){
  const expiry=Number(x?.membershipBenefitExpiresAtMs||0)||azRegMs(x?.membershipBenefitExpiresAt);
  const active=x?.membershipBenefitActive===true && (!expiry || expiry>Date.now());
  const name=String(x?.membershipBenefitPackageName||x?.membershipBenefitPackageId||'Membership').trim();
  return {active,expiry,name};
}
function azRegMembershipPillHtml(x){
  const m=azRegMembershipInfo(x);
  if(!m.active)return '<span class="az-admin-reg-membership-pill off">Membership: None</span>';
  const exp=m.expiry?new Date(m.expiry).toLocaleDateString():'Active';
  return `<span class="az-admin-reg-membership-pill on">Membership: ${esc(m.name)} • ${esc(exp)}</span>`;
}
function azRegPaDotHtml(pa){
  return `<span class="az-admin-reg-pabm-pill ${pa?'on':'off'}"><span class="az-pabm-dot ${pa?'on':'off'}"></span>PA/BM ${pa?'allowed':'off'}</span>`;
}
const AZ_REG_PRICE_CATEGORIES=[
  ['paBm','PA/BM'],
  ['lotKadaster','Lot Kadaster'],
  ['publicPa','PA Awam'],
  ['software','Software'],
  ['cadTools','CAD Tools']
];
function azRegNormalisePricePercent(value){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(-99,Math.min(500,Math.round(n*100)/100)):0;
}
function azRegPricePercents(x){
  if(x?.__pricePercents&&typeof x.__pricePercents==='object')return {...x.__pricePercents};
  const managed=x?.adminPriceAdjustmentOverride===true||String(x?.priceAdjustmentManagedBy||'').toLowerCase()==='admin';
  const managedMap=x?.adminPriceAdjustmentByCategory&&typeof x.adminPriceAdjustmentByCategory==='object'?x.adminPriceAdjustmentByCategory:null;
  const publicMap=x?.priceAdjustmentByCategory&&typeof x.priceAdjustmentByCategory==='object'?x.priceAdjustmentByCategory:null;
  const map=managed?(managedMap||publicMap):(publicMap||managedMap);
  const direct={
    paBm:managed?(x?.adminPaBmPriceAdjustmentPercent??x?.paBmPriceAdjustmentPercent):(x?.paBmPriceAdjustmentPercent??x?.adminPaBmPriceAdjustmentPercent),
    lotKadaster:managed?(x?.adminLotKadasterPriceAdjustmentPercent??x?.lotKadasterPriceAdjustmentPercent):(x?.lotKadasterPriceAdjustmentPercent??x?.adminLotKadasterPriceAdjustmentPercent),
    publicPa:managed?(x?.adminPublicPaPriceAdjustmentPercent??x?.publicPaPriceAdjustmentPercent):(x?.publicPaPriceAdjustmentPercent??x?.adminPublicPaPriceAdjustmentPercent),
    software:managed?(x?.adminSoftwarePriceAdjustmentPercent??x?.softwarePriceAdjustmentPercent):(x?.softwarePriceAdjustmentPercent??x?.adminSoftwarePriceAdjustmentPercent),
    cadTools:managed?(x?.adminCadToolsPriceAdjustmentPercent??x?.cadToolsPriceAdjustmentPercent):(x?.cadToolsPriceAdjustmentPercent??x?.adminCadToolsPriceAdjustmentPercent)
  };
  const hasSpecific=!!map||Object.values(direct).some(v=>v!==undefined&&v!==null&&v!=='');
  if(hasSpecific){
    return Object.fromEntries(AZ_REG_PRICE_CATEGORIES.map(([key])=>{
      let raw=map&&Object.prototype.hasOwnProperty.call(map,key)?map[key]:direct[key];
      if(key==='lotKadaster'&&(raw===undefined||raw===null||raw==='')) raw=map&&Object.prototype.hasOwnProperty.call(map,'paBm')?map.paBm:direct.paBm;
      return [key,azRegNormalisePricePercent(raw??0)];
    }));
  }
  const legacy=azRegNormalisePricePercent(managed?(x?.adminPriceAdjustmentPercent??x?.priceAdjustmentPercent??0):(x?.priceAdjustmentPercent??x?.adminPriceAdjustmentPercent??0));
  return Object.fromEntries(AZ_REG_PRICE_CATEGORIES.map(([key])=>[key,legacy]));
}
function azRegPricePillHtml(x){
  const values=azRegPricePercents(x);
  const changed=AZ_REG_PRICE_CATEGORIES.filter(([key])=>values[key]!==0);
  if(!changed.length)return '<span class="az-admin-reg-price-pill">Semua harga asal</span>';
  return changed.map(([key,label])=>{
    const p=values[key];
    const cls=p<0?'discount':'markup';
    const text=p<0?`${label} -${Math.abs(p)}%`:`${label} +${p}%`;
    return `<span class="az-admin-reg-price-pill ${cls}">${text}</span>`;
  }).join('');
}
function azRegNameEmail(x){return String((azRegUser(x)||'')+' '+(x.email||x.authEmail||'')).toLowerCase();}
function azRegEmail(x){
  const raw=String(x?.email||x?.authEmail||x?.realEmail||x?.contactEmail||x?.googleEmail||'').trim().toLowerCase();
  return raw.includes('@')?raw:'';
}
function azRegLoginMethod(x){
  const rows=Array.isArray(x?.__records)&&x.__records.length?x.__records:[x||{}];
  let google=false, normal=false;
  rows.forEach(r=>{
    const provider=String(r?.authProvider||r?.providerId||r?.loginProvider||r?.signInProvider||'').toLowerCase();
    if(provider.includes('google.com')||r?.googleSignIn===true||r?.googleProfileConfirmed===true||String(r?.googleEmail||'').trim()) google=true;
    if(provider.includes('password')||provider.includes('email')||r?.passwordSignIn===true||r?.emailPasswordSignIn===true) normal=true;
  });
  if(google&&normal)return 'hybrid';
  if(google)return 'google';
  return 'normal';
}
function azRegLoginBadgeHtml(x){
  const method=azRegLoginMethod(x);
  if(method==='google')return '<span class="az1363-login-badge google">G • Google</span>';
  if(method==='hybrid')return '<span class="az1363-login-badge hybrid">G + 🔑 • Google + Biasa</span>';
  return '<span class="az1363-login-badge">🔑 • Login Biasa</span>';
}
function azRegSearchText(x){
  return [
    x.docId,x.usernameKey,x.username,x.name,x.displayName,x.email,x.authEmail,x.realEmail,
    x.phone,x.phoneNumber,x.uid,x.authUid,x.userUid,x.firebaseUid,x.role,x.accountRole,
    x.memberCode,x.inviteCode,x.accessCode,x.signupCode,x.authProvider,azRegLoginMethod(x),
    azRegFoodOrdersAllowed(x)?'food orders access allowed tempahan on':'food orders access off tempahan off'
  ].map(v=>String(v||'').toLowerCase()).join(' ');
}
function azRegIsOnline(x){
  const rows=Array.isArray(x?.__records)&&x.__records.length?x.__records:[x||{}];
  return rows.some(r=>{
    const online = r.online===true || r.isOnline===true || r.loggedIn===true || String(r.status||'').toLowerCase()==='online';
    const seen = azRegMs(r.lastSeenAtMs||r.lastActiveAtMs||r.lastLoginAtMs||r.updatedAtMs||r.lastSeenAt||r.lastActiveAt||r.updatedAt);
    return online || (seen && (Date.now()-seen) < 10*60*1000);
  });
}
function azRegDateValue(x){
  const rows=Array.isArray(x?.__records)&&x.__records.length?x.__records:[x||{}];
  return Math.max(0,...rows.map(r=>azRegMs(r.createdAtMs||r.registeredAtMs||r.createdAt||r.registeredAt||r.updatedAtMs||r.updatedAt)));
}
function azRegRoleRank(x){
  const r=azRegRole(x);return r==='admin'?4:r==='semiadmin'?3:r==='staff'?2:1;
}
function azRegMergeIdentityRecords(records){
  const rows=[...(records||[])].sort((a,b)=>azRegDateValue(b)-azRegDateValue(a));
  const base={...(rows[0]||{})};
  if(!rows.length)return base;
  const roleRow=[...rows].sort((a,b)=>azRegRoleRank(b)-azRegRoleRank(a)||azRegDateValue(b)-azRegDateValue(a))[0]||base;
  base.role=azRegRole(roleRow);
  base.__records=rows;
  base.__sourceCount=rows.length;
  base.__uids=Array.from(new Set(rows.map(azRegUid).filter(Boolean)));
  if(base.__uids.length)base.uid=base.__uids[0];
  base.__foodAllowed=rows.some(r=>azRegFoodOrdersAllowed(r));
  const paRow=rows.find(r=>azRegPaAllowed(r));
  if(paRow){
    base.adminPaBmOverride=true;base.adminPaBmAllowed=true;base.paBmManagedBy='admin';base.paBmAllowed=true;
  }
  const activeMembership=rows.map(r=>({r,m:azRegMembershipInfo(r)})).filter(o=>o.m.active).sort((a,b)=>(b.m.expiry||Number.MAX_SAFE_INTEGER)-(a.m.expiry||Number.MAX_SAFE_INTEGER))[0];
  if(activeMembership){
    const r=activeMembership.r;
    ['membershipBenefitActive','membershipBenefitExpiresAtMs','membershipBenefitExpiresAt','membershipBenefitPackageName','membershipBenefitPackageId'].forEach(k=>{if(r[k]!==undefined)base[k]=r[k];});
  }
  const mergedPrices={};
  AZ_REG_PRICE_CATEGORIES.forEach(([key])=>{
    let chosen=0;
    for(const r of rows){const v=azRegPricePercents(r)[key];if(v!==0){chosen=v;break;}}
    mergedPrices[key]=chosen;
  });
  base.__pricePercents=mergedPrices;
  if(!base.phone&&!base.phoneNumber){const r=rows.find(v=>v.phone||v.phoneNumber);if(r){base.phone=r.phone||r.phoneNumber;base.phoneNumber=r.phoneNumber||r.phone;}}
  if(!base.email&&!base.authEmail){const r=rows.find(v=>azRegEmail(v));if(r){base.email=azRegEmail(r);base.authEmail=azRegEmail(r);}}
  return base;
}
function azRegGroupKey(x){
  const email=azRegEmail(x);if(email)return 'email:'+email;
  const uid=azRegUid(x);if(uid)return 'uid:'+uid.toLowerCase();
  return 'user:'+String(azRegUser(x)||x.docId||Math.random()).trim().toLowerCase();
}
function azRegBuildEmailGroups(rows){
  const groups=new Map();
  (rows||[]).forEach(r=>{
    const key=azRegGroupKey(r);
    if(!groups.has(key))groups.set(key,{key,email:azRegEmail(r),records:[]});
    groups.get(key).records.push(r);
  });
  return [...groups.values()].map(g=>{
    const byUser=new Map();
    g.records.forEach(r=>{
      const user=String(azRegUser(r)||r.docId||'unknown').trim().toLowerCase();
      if(!byUser.has(user))byUser.set(user,[]);
      byUser.get(user).push(r);
    });
    const identities=[...byUser.values()].map(azRegMergeIdentityRecords).sort((a,b)=>azRegDateValue(b)-azRegDateValue(a));
    return {...g,identities,__isGroup:true,__dateNewest:Math.max(0,...identities.map(azRegDateValue)),__dateOldest:Math.min(...identities.map(v=>azRegDateValue(v)||Date.now()))};
  });
}
function azRegGroupSearchText(g){
  return [g.email,...g.identities.map(azRegSearchText)].join(' ').toLowerCase();
}
function azRegGroupMatchesMode(g,mode){
  const ids=g.identities||[];
  if(mode==='online')return ids.some(azRegIsOnline);
  if(mode==='pabm')return ids.some(azRegPaAllowed);
  if(mode==='foodorders')return ids.some(azRegFoodOrdersAllowed);
  if(mode.startsWith('role-')){const want=mode.replace('role-','');return ids.some(x=>azRegRole(x)===want);}
  return true;
}
function azRegSortGroups(groups){
  const mode=String($('#registeredUsersSort')?.value||'newest').toLowerCase();
  let out=(groups||[]).filter(g=>azRegGroupMatchesMode(g,mode));
  if(mode==='oldest')out.sort((a,b)=>(a.__dateOldest||0)-(b.__dateOldest||0));
  else if(mode==='az')out.sort((a,b)=>String(a.email||azRegUser(a.identities?.[0])||'').localeCompare(String(b.email||azRegUser(b.identities?.[0])||'')));
  else out.sort((a,b)=>(b.__dateNewest||0)-(a.__dateNewest||0));
  return out;
}
function azRegRankBadgeHtml(x){
  const role=azRegRole(x);
  const map={
    admin:{cls:'admin',icon:'👑',short:'Admin',label:'Administrator'},
    semiadmin:{cls:'manager',icon:'◆',short:'Manager',label:'Manager'},
    staff:{cls:'staff',icon:'★',short:'Staff',label:'Staff'},
    user:{cls:'user',icon:'●',short:'User',label:'User'}
  };
  const v=map[role]||map.user;
  return `<span class="az1364-rank-badge ${v.cls}" title="Pangkat: ${esc(v.label)}" aria-label="Pangkat ${esc(v.label)}">${v.icon}<span class="az1364-rank-short">${v.short}</span></span>`;
}
function azRegChangedStatusHtml(x){
  const bits=[];
  const role=azRegRole(x);
  if(azRegPaAllowed(x))bits.push(azRegPaDotHtml(true));
  if(azRegMembershipInfo(x).active)bits.push(azRegMembershipPillHtml(x));
  if(azRegFoodOrdersAllowed(x))bits.push(azRegFoodOrdersPillHtml(true));
  const prices=azRegPricePillHtml(x);
  if(!/Semua harga asal/.test(prices))bits.push(prices);
  return bits.length?bits.join(''):'<span class="az1363-default-pill">Default settings</span>';
}
function azRegIdentityRowHtml(x,sharedEmail){
  const id=esc(x.docId||azRegUser(x));
  const foodAccess=azRegFoodOrdersAllowed(x),userUid=azRegUid(x),roleClass=azRegRoleClass(x);
  const phone=String(x.phone||x.phoneNumber||'').trim();
  const email=azRegEmail(x);
  const contact=sharedEmail?(phone||'Tiada telefon direkod'):[email,phone].filter(Boolean).join(' • ');
  const uidList=Array.isArray(x.__uids)&&x.__uids.length?x.__uids:(userUid?[userUid]:[]);
  const uidText=uidList.length>1?`${uidList[0]} (+${uidList.length-1} UID)`:uidList[0]||'';
  return `<div class="az-admin-reg-row ${roleClass}">
    ${azRegRankBadgeHtml(x)}
    <div class="az1361-user-identity">
      <div class="az-admin-reg-title">${esc(azRegUser(x))}${azRegLoginBadgeHtml(x)}${x.__sourceCount>1?`<span class="az1363-source-count">${x.__sourceCount} rekod digabung</span>`:''}</div>
      <span class="az1363-user-contact">${esc(contact||'Tiada email / telefon direkod')}</span>
      ${uidText?`<div class="az1361-user-uid" title="Firebase UID${uidList.length>1?'s':''}">UID: ${esc(uidText)}</div>`:''}
    </div>
    <div class="az1361-user-status"><div class="az-admin-reg-meta-line">${azRegChangedStatusHtml(x)}</div></div>
    <div class="az-admin-reg-time"><span>Registered</span>${esc(azRegTime(x))}</div>
    <div class="az-reg-actions">
      <button class="az-reg-edit az1366-icon-action" data-reg-edit="${id}" title="Edit ${esc(azRegUser(x))}" aria-label="Edit ${esc(azRegUser(x))}">✎</button>
      <button class="az-reg-delete az1366-icon-action danger" data-reg-delete="${id}" title="Delete ${esc(azRegUser(x))}" aria-label="Delete ${esc(azRegUser(x))}">×</button>
    </div>
  </div>`;
}
function azRegGroupRankIdentity(g){
  const ids=[...(g?.identities||[])];
  ids.sort((a,b)=>azRegRoleRank(b)-azRegRoleRank(a)||azRegDateValue(b)-azRegDateValue(a));
  return ids[0]||{};
}
function azRegGroupPricePillsHtml(ids){
  const byCategory=new Map();
  AZ_REG_PRICE_CATEGORIES.forEach(([key,label])=>byCategory.set(key,{label,values:new Map()}));
  (ids||[]).forEach(x=>{
    const username=azRegUser(x);
    const values=azRegPricePercents(x);
    AZ_REG_PRICE_CATEGORIES.forEach(([key])=>{
      const p=Number(values[key]||0);
      if(!p)return;
      const bucket=byCategory.get(key);
      const valueKey=String(p);
      if(!bucket.values.has(valueKey))bucket.values.set(valueKey,{percent:p,users:[]});
      bucket.values.get(valueKey).users.push(username);
    });
  });
  const out=[];
  byCategory.forEach(bucket=>{
    const values=[...bucket.values.values()];
    values.forEach(v=>{
      const p=v.percent,cls=p<0?'discount':'markup';
      const amount=p<0?`-${Math.abs(p)}%`:`+${p}%`;
      const conflict=values.length>1;
      const users=[...new Set(v.users)].join(', ');
      const who=conflict?` · ${users}`:'';
      out.push(`<span class="az-admin-reg-price-pill ${cls}" title="${esc(users)}">${esc(bucket.label)} ${amount}${esc(who)}</span>`);
    });
  });
  return out.join('');
}
function azRegGroupChangedStatusHtml(g){
  const ids=g?.identities||[];
  const bits=[];
  if(ids.some(azRegPaAllowed))bits.push(azRegPaDotHtml(true));
  const memberships=new Map();
  ids.forEach(x=>{
    const m=azRegMembershipInfo(x);
    if(!m.active)return;
    const key=`${m.name}|${m.expiry||0}`;
    if(!memberships.has(key))memberships.set(key,x);
  });
  memberships.forEach(x=>bits.push(azRegMembershipPillHtml(x)));
  if(ids.some(azRegFoodOrdersAllowed))bits.push(azRegFoodOrdersPillHtml(true));
  const prices=azRegGroupPricePillsHtml(ids);
  if(prices)bits.push(prices);
  return bits.length?bits.join(''):'<span class="az1367-settings-empty" title="Semua setting kekal default">—</span>';
}
function azRegGroupIdentityHtml(g){
  const ids=g?.identities||[];
  const email=g?.email||'Tanpa email';
  const count=ids.length;
  return `<div class="az1367-identity-block">
    <div class="az1367-email-line"><span class="az1367-primary-email">${esc(email)}</span>${count>1?`<span class="az1367-shared-badge">${count} username dalam email sama</span>`:''}</div>
    <div class="az1367-usernames">${ids.map(x=>`<div class="az1367-username-line"><strong>${esc(azRegUser(x))}</strong>${azRegLoginBadgeHtml(x)}</div>`).join('')}</div>
  </div>`;
}
function azRegGroupActionMenuHtml(g){
  const ids=g?.identities||[];
  const editRows=ids.map(x=>{
    const id=esc(x.docId||azRegUser(x)),username=esc(azRegUser(x));
    return `<button type="button" data-reg-edit="${id}" title="Edit ${username}">✎ Edit ${username}</button>`;
  }).join('');
  const deleteRows=ids.map(x=>{
    const id=esc(x.docId||azRegUser(x)),username=esc(azRegUser(x));
    return `<button type="button" class="danger" data-reg-delete="${id}" title="Delete ${username}">× Delete ${username}</button>`;
  }).join('');
  return `<div class="az1367-action-wrap">
    <button class="az1367-edit-menu-btn" type="button" data-reg-menu-toggle aria-haspopup="menu" aria-expanded="false">Edit ▾</button>
    <div class="az1367-action-menu" role="menu">
      <div class="az1367-menu-label">Edit username</div>${editRows}
      <div class="az1367-menu-sep"></div>
      <div class="az1367-menu-label">Delete username</div>${deleteRows}
    </div>
  </div>`;
}
function azRegCloseActionMenus(exceptWrap){
  document.querySelectorAll('.az1367-action-wrap.is-open').forEach(w=>{
    if(w===exceptWrap)return;
    w.classList.remove('is-open');
    w.closest('.az1367-email-card')?.classList.remove('is-menu-open');
    const b=w.querySelector('[data-reg-menu-toggle]');if(b)b.setAttribute('aria-expanded','false');
  });
}
function renderRegisteredUsersAdmin(){
  const box=$('#registeredUsersAdminList'); if(!box)return;
  const q=String($('#registeredUsersSearch')?.value||'').toLowerCase().trim();
  let groups=azRegBuildEmailGroups(adminRegisteredUsersCache);
  if(q)groups=groups.filter(g=>azRegGroupSearchText(g).includes(q));
  groups=azRegSortGroups(groups);
  const totalPages=Math.max(1,Math.ceil(groups.length/ADMIN_REGISTERED_PAGE_SIZE));
  adminRegisteredUsersPage=Math.min(Math.max(1,adminRegisteredUsersPage),totalPages);
  const start=(adminRegisteredUsersPage-1)*ADMIN_REGISTERED_PAGE_SIZE;
  const page=groups.slice(start,start+ADMIN_REGISTERED_PAGE_SIZE);
  box.innerHTML=page.map(g=>{
    const rankIdentity=azRegGroupRankIdentity(g);
    const latest=g.__dateNewest?new Date(g.__dateNewest).toLocaleString():'-';
    return `<div class="az-admin-reg-row az1367-email-card">
      ${azRegRankBadgeHtml(rankIdentity)}
      ${azRegGroupIdentityHtml(g)}
      <div class="az1367-setting-block"><div class="az-admin-reg-meta-line">${azRegGroupChangedStatusHtml(g)}</div></div>
      <div class="az1367-right">
        <div class="az1367-date"><span>Terbaru</span><strong>${esc(latest)}</strong></div>
        ${azRegGroupActionMenuHtml(g)}
      </div>
    </div>`;
  }).join('')||'<div class="az-admin-reg-row role-unknown"><div><div class="az-admin-reg-title">No registered users found.</div></div></div>';
  if($('#registeredUsersPageInfo')){
    const loaded=adminRegisteredUsersCache.length,total=adminRegisteredUsersTotalCount;
    const identityCount=groups.reduce((n,g)=>n+(g.identities?.length||0),0);
    const loadedText=total===null?`${loaded} rekod dimuatkan`:`${loaded} rekod dimuatkan / ${total} total`;
    $('#registeredUsersPageInfo').textContent=`Page ${adminRegisteredUsersPage} / ${totalPages} • ${groups.length} kad email • ${identityCount} username • ${loadedText}`;
    const summary=$('#registeredUsersSummaryChip');
    if(summary)summary.textContent=`${groups.length} kad • ${identityCount} username`;
  }
  if($('#registeredUsersPrevBtn'))$('#registeredUsersPrevBtn').disabled=adminRegisteredUsersPage<=1;
  if($('#registeredUsersNextBtn'))$('#registeredUsersNextBtn').disabled=adminRegisteredUsersPage>=totalPages;
}

async function azRegRenderMembershipAdmin(x){
  const status=$('#azRegMembershipStatus'),sel=$('#azRegMembershipPackage');if(!status||!sel)return;
  const m=azRegMembershipInfo(x||{});status.textContent=m.active?`Active: ${m.name}${m.expiry?' • until '+new Date(m.expiry).toLocaleDateString():''}`:'No active Membership.';
  try{const rows=adminMembershipPackagesCache.length?adminMembershipPackagesCache:await loadMembershipPackagesAdmin(false);const current=String(x?.membershipBenefitPackageId||'');sel.innerHTML='<option value="">Select package</option>'+rows.map(r=>`<option value="${esc(r.packageId||'')}" ${String(r.packageId||'')===current?'selected':''}>${esc(r.packageName||r.packageId||'Membership')} • RM${Number(r.packagePriceRM||0).toFixed(2)} • ${Number(r.durationMonths||1)} month(s)</option>`).join('');}catch(_){sel.innerHTML='<option value="">Unable to load packages</option>';}
}
async function azRegMembershipAdminAction(action){
  const id=String($('#azRegEditDocId')?.value||'').trim();if(!id)return toast('User not found.');
  const packageId=String($('#azRegMembershipPackage')?.value||'').trim();
  if(action==='grant'&&!packageId)return toast('Select a Membership package first.');
  const label=action==='grant'?`Activate / extend Membership ${packageId} for ${id}?`:`End Membership for ${id}?`;
  if(!confirm(label+'\n\nAccount Role and PA/BM access will not change.'))return;
  try{
    const out=await azAdminFetchJson(AZOBSS_BACKEND_API+(action==='grant'?'/api/membership/admin/grant':'/api/membership/admin/revoke'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userDocId:id,packageId})});
    toast(action==='grant'?'Membership activated/extended.':'Membership ended.');
    await loadRegisteredUsersAdmin();
    const fresh=adminRegisteredUsersCache.find(r=>String(r.docId)===id||String(azRegUser(r))===id)||out.user||{};
    await azRegRenderMembershipAdmin(fresh);
  }catch(e){toast(e?.message||'Membership action failed.');}
}
function openRegisteredEdit(id){
  azRegCloseActionMenus();
  const x=adminRegisteredUsersCache.find(r=>String(r.docId)===String(id)||String(azRegUser(r))===String(id));
  if(!x)return toast('User not found.');
  $('#azRegEditDocId').value=x.docId||azRegUser(x);
  $('#azRegEditUsername').value=azRegUser(x);
  const identityInfo=$('#azRegEditIdentityInfo');
  if(identityInfo){const m=azRegLoginMethod(x);identityInfo.textContent=`Login: ${m==='google'?'Google':m==='hybrid'?'Google + Biasa':'Biasa'} • Firebase UID: ${azRegUid(x)||'Tiada'}`;}
  $('#azRegEditEmail').value=x.email||x.authEmail||'';
  $('#azRegEditPhone').value=x.phone||x.phoneNumber||'';
  $('#azRegEditRole').value=azRegRole(x);
  $('#azRegEditPa').value=azRegPaAllowed(x)?'true':'false';
  $('#azRegEditFood').value=azRegFoodOrdersAllowed(x)?'true':'false';
  const pricePercents=azRegPricePercents(x);
  $('#azRegEditPricePaBm').value=String(pricePercents.paBm);
  $('#azRegEditPriceLotKadaster').value=String(pricePercents.lotKadaster);
  $('#azRegEditPricePublicPa').value=String(pricePercents.publicPa);
  $('#azRegEditPriceSoftware').value=String(pricePercents.software);
  $('#azRegEditPriceCad').value=String(pricePercents.cadTools);
  azRegRenderMembershipAdmin(x);
  $('#azRegEditModal')?.classList.add('is-open');
}
async function saveRegisteredEdit(){
  let id=$('#azRegEditDocId')?.value||'';
  if(!id)return;
  const originalX=adminRegisteredUsersCache.find(r=>String(r.docId)===String(id)||String(azRegUser(r))===String(id))||{};
  const rawUsername=String($('#azRegEditUsername')?.value||'').trim().toLowerCase();
  const usernameKey=rawUsername.replace(/[^a-z0-9_]/g,'').slice(0,80);
  if(!usernameKey){toast('Username tidak sah. Gunakan huruf, nombor atau underscore.');return;}
  if(usernameKey!==rawUsername){
    $('#azRegEditUsername').value=usernameKey;
    toast('Username dinormalisasi kepada '+usernameKey+'. Tekan Save sekali lagi jika betul.');
    return;
  }
  const pa=$('#azRegEditPa')?.value==='true';
  const foodAllowed=$('#azRegEditFood')?.value==='true';
  const priceInputs={
    paBm:Number($('#azRegEditPricePaBm')?.value||0),
    lotKadaster:Number($('#azRegEditPriceLotKadaster')?.value||0),
    publicPa:Number($('#azRegEditPricePublicPa')?.value||0),
    software:Number($('#azRegEditPriceSoftware')?.value||0),
    cadTools:Number($('#azRegEditPriceCad')?.value||0)
  };
  if(Object.values(priceInputs).some(value=>!Number.isFinite(value)||value<-99||value>500)){
    toast('Setiap pelarasan harga mesti antara -99% hingga +500%.');return;
  }
  const priceAdjustmentByCategory=Object.fromEntries(Object.entries(priceInputs).map(([key,value])=>[key,Math.round(value*100)/100]));

  if(usernameKey!==id){
    const x=originalX;
    const uid=azRegUid(x);
    const ok=confirm(`Tukar username ${id} → ${usernameKey}?\n\nSistem akan merge/move profil Firestore, usernameAuthEmails, purchase summary, referral mapping dan data user berkaitan sambil mengekalkan UID yang sama.`);
    if(!ok)return;
    try{
      const moved=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/user/rename',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({oldUsername:id,newUsername:usernameKey,expectedUid:uid||''})
      });
      id=String(moved?.userDocId||usernameKey);
      $('#azRegEditDocId').value=id;
    }catch(error){
      toast(error?.message||'Username gagal ditukar.');
      return;
    }
  }

  await updateDoc(doc(db,'users',id),{
    username:id,
    usernameKey:id,
    name:id,
    displayName:id,
    email:$('#azRegEditEmail')?.value.trim()||'',
    phoneNumber:$('#azRegEditPhone')?.value.trim()||'',
    phone:$('#azRegEditPhone')?.value.trim()||'',
    role:$('#azRegEditRole')?.value||'user',

    // Per-user price adjustment kept separately for every paid section.
    adminPriceAdjustmentOverride:true,
    adminPriceAdjustmentByCategory:priceAdjustmentByCategory,
    priceAdjustmentByCategory:priceAdjustmentByCategory,
    adminPaBmPriceAdjustmentPercent:priceAdjustmentByCategory.paBm,
    paBmPriceAdjustmentPercent:priceAdjustmentByCategory.paBm,
    adminLotKadasterPriceAdjustmentPercent:priceAdjustmentByCategory.lotKadaster,
    lotKadasterPriceAdjustmentPercent:priceAdjustmentByCategory.lotKadaster,
    adminPublicPaPriceAdjustmentPercent:priceAdjustmentByCategory.publicPa,
    publicPaPriceAdjustmentPercent:priceAdjustmentByCategory.publicPa,
    adminSoftwarePriceAdjustmentPercent:priceAdjustmentByCategory.software,
    softwarePriceAdjustmentPercent:priceAdjustmentByCategory.software,
    adminCadToolsPriceAdjustmentPercent:priceAdjustmentByCategory.cadTools,
    cadToolsPriceAdjustmentPercent:priceAdjustmentByCategory.cadTools,
    // Neutralise the old one-value setting so legacy scripts cannot apply it globally.
    adminPriceAdjustmentPercent:0,
    priceAdjustmentPercent:0,
    priceAdjustmentManagedBy:'admin',

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

    updatedAt:serverTimestamp(),updatedAtMs:Date.now(),updatedByAdmin:'admin-dashboard'
  });

  // v1366: Tempahan access is edited inside the user dialog. OFF stays visually silent in the list.
  const foodUid=azRegUid(originalX);
  if(foodUid){
    await setDoc(doc(db,'foodOrderStaffAccess',foodUid),{
      active:foodAllowed,
      canViewFoodOrders:foodAllowed,
      role:azRegRoleLabel({...originalX,role:$('#azRegEditRole')?.value||azRegRole(originalX)}),
      username:id,
      userDocId:id,
      email:$('#azRegEditEmail')?.value.trim()||originalX.email||originalX.authEmail||'',
      uid:foodUid,
      managedBy:'admin-dashboard',
      updatedAt:serverTimestamp(),
      updatedAtMs:Date.now()
    },{merge:true});
  }else if(foodAllowed){
    toast('Tempahan ON tidak dapat disimpan kerana Firebase UID user tiada. Setting lain tetap disimpan.');
  }

  $('#azRegEditModal')?.classList.remove('is-open');
  await loadRegisteredUsersAdmin();

}
async function toggleRegisteredFoodOrderAccess(id){
  const x=adminRegisteredUsersCache.find(r=>String(r.docId)===String(id)||String(azRegUser(r))===String(id));
  if(!x){toast('User not found.');return;}
  const uid=azRegUid(x);
  if(!uid){toast('Akses tidak boleh ditetapkan kerana Firebase Auth UID user tiada.');return;}
  const current=azRegFoodOrdersAllowed(x);
  const next=!current;
  const username=azRegUser(x);
  const confirmed=confirm(`${next?'Benarkan':'Tutup'} akses Rekod Tempahan Makanan untuk ${username}?`);
  if(!confirmed)return;
  try{
    await setDoc(doc(db,'foodOrderStaffAccess',uid),{
      active:next,
      canViewFoodOrders:next,
      role:azRegRoleLabel(x),
      username:username,
      userDocId:x.docId||'',
      email:x.email||x.authEmail||'',
      uid:uid,
      managedBy:'admin-dashboard',
      updatedAt:serverTimestamp(),
      updatedAtMs:Date.now()
    },{merge:true});
    toast(next?'Akses rekod tempahan dibenarkan.':'Akses rekod tempahan ditutup.');
    await loadRegisteredUsersAdmin();
  }catch(error){
    console.error('food order access update failed',error);
    toast('Akses rekod tempahan gagal dikemas kini. Semak Firebase Rules.');
  }
}
async function deleteRegisteredUser(id){
  azRegCloseActionMenus();
  const x=adminRegisteredUsersCache.find(r=>String(r.docId)===String(id)||String(azRegUser(r))===String(id));
  if(!x){toast('User not found.');return;}
  const docId=String(x.docId||azRegUser(x));
  const username=azRegUser(x);
  const email=azRegEmail(x);
  const siblings=email?adminRegisteredUsersCache.filter(r=>azRegEmail(r)===email&&String(r.docId||azRegUser(r))!==docId):[];
  let message=`Delete username ${username}?`;
  if(email&&siblings.length){
    message+=`\n\nEmail ${email} masih digunakan oleh ${siblings.length} username lain. Hanya username ${username} akan dipadam; username lain dalam email ini kekal.`;
  }
  if(!confirm(message))return;
  await deleteDoc(doc(db,'users',docId));
  await loadRegisteredUsersAdmin();
  if(typeof loadOnlineUsers === 'function') await loadOnlineUsers();
  await loadOverview();
}
async function loadRegisteredUsersAdmin(){
  const rows=[];
  adminFoodOrderAccessCache=new Map();
  adminRegisteredUsersTotalCount = null;
  adminRegisteredUsersTotalCount = await safeCount(collection(db,'users'),'Registered Users: total count');
  try{
    const snap = await safeGet(query(collection(db,'users'),limit(ADMIN_REGISTERED_LOAD_LIMIT)),'Registered Users: list');
    snap?.forEach(d=>rows.push({docId:d.id,usernameKey:d.id,...d.data()}));
  }catch(e){console.warn('registered users load failed',e);azAdminReportQueryError('Registered Users: list',e);}
  try{
    const accessSnap=await safeGet(query(collection(db,'foodOrderStaffAccess'),limit(ADMIN_REGISTERED_LOAD_LIMIT)),'Food Orders Access: list');
    accessSnap?.forEach(d=>adminFoodOrderAccessCache.set(d.id,{uid:d.id,...d.data()}));
  }catch(e){console.warn('food order access load failed',e);azAdminReportQueryError('Food Orders Access: list',e);}
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
      const snap = await safeGet(query(collection(db,col), limit(40)),'Activity: '+col);
      snap?.forEach(d=>rows.push({docId:d.id, collection:col, type, ...d.data()}));
    }catch(e){}
  }
  rows.sort((a,b)=>Number(b.createdAtMs||b.updatedAtMs||b.createdAt?.seconds*1000||0)-Number(a.createdAtMs||a.updatedAtMs||a.createdAt?.seconds*1000||0));
  adminActivityCache = rows;
  adminActivityPage = 1;
  renderAdminActivity();
}

let adminMembershipPackagesCache=[];
function membershipBenefitsFromText(value){return [...new Set(String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))].slice(0,12);}
function membershipFormPayload(){
  const n=v=>Math.max(0,Math.min(99,Number(v||0)||0));
  return {
    packageId:String($('#membershipPackageId')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,''),
    packageName:String($('#membershipPackageName')?.value||'').trim(),
    packagePriceRM:Math.max(0,Number($('#membershipPackagePrice')?.value||0)||0),
    durationMonths:Math.max(1,Math.min(60,Number($('#membershipDurationMonths')?.value||1)||1)),
    sortOrder:Number($('#membershipSortOrder')?.value||0)||0,
    active:!!$('#membershipPackageActive')?.checked,
    discounts:{paBm:0,lotKadaster:0,publicPa:0,software:n($('#membershipDiscountSoftware')?.value),cadTools:n($('#membershipDiscountCad')?.value)},
    benefits:membershipBenefitsFromText($('#membershipBenefitsText')?.value),
    extraNote:String($('#membershipExtraNote')?.value||'').trim()
  };
}
function clearMembershipPackageForm(){
  if($('#membershipPackageId'))$('#membershipPackageId').value='';if($('#membershipPackageName'))$('#membershipPackageName').value='';if($('#membershipPackagePrice'))$('#membershipPackagePrice').value='';if($('#membershipDurationMonths'))$('#membershipDurationMonths').value='1';if($('#membershipSortOrder'))$('#membershipSortOrder').value='0';
  if($('#membershipDiscountSoftware'))$('#membershipDiscountSoftware').value='0';if($('#membershipDiscountCad'))$('#membershipDiscountCad').value='0';if($('#membershipPackageActive'))$('#membershipPackageActive').checked=true;if($('#membershipBenefitsText'))$('#membershipBenefitsText').value='';if($('#membershipExtraNote'))$('#membershipExtraNote').value='';
}
function editMembershipPackageFromRow(encoded){
  let row={};try{row=JSON.parse(decodeURIComponent(encoded));}catch(_){return;}const d=row.discounts||{};
  $('#membershipPackageId').value=row.packageId||'';$('#membershipPackageName').value=row.packageName||'';$('#membershipPackagePrice').value=row.packagePriceRM||0;$('#membershipDurationMonths').value=row.durationMonths||1;$('#membershipSortOrder').value=row.sortOrder||0;$('#membershipPackageActive').checked=row.active!==false;$('#membershipDiscountSoftware').value=d.software||0;$('#membershipDiscountCad').value=d.cadTools||0;if($('#membershipBenefitsText'))$('#membershipBenefitsText').value=Array.isArray(row.benefits)?row.benefits.join('\n'):'';$('#membershipExtraNote').value=row.extraNote||'';$('#membershipPackageId').scrollIntoView({behavior:'smooth',block:'center'});
}
async function loadMembershipPackagesAdmin(force=false){
  const box=$('#membershipPackageAdminList');
  try{
    if(force||!adminMembershipPackagesCache.length){const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/membership/admin/list',{cache:'no-store'});adminMembershipPackagesCache=Array.isArray(j.records)?j.records:[];}
    const rows=adminMembershipPackagesCache;
    if(box)box.innerHTML=rows.map(r=>{const enc=encodeURIComponent(JSON.stringify(r));const d=r.discounts||{};const benefits=Array.isArray(r.benefits)?r.benefits:[];const benefitHtml=benefits.length?`<div class="item-meta"><b>Benefits:</b> ${benefits.map(x=>esc(x)).join(' • ')}</div>`:'';return `<div class="item"><div class="item-title"><b>${esc(r.packageId||'')}</b> • ${esc(r.packageName||'Membership')} • ${r.active!==false?'ACTIVE':'OFF'}</div><div class="item-meta">RM${Number(r.packagePriceRM||0).toFixed(2)} • ${r.durationMonths||1} month(s) • Software ${d.software||0}% • CAD ${d.cadTools||0}% • PA/BM: NO ACCESS</div>${benefitHtml}${r.extraNote?`<div class="item-meta"><b>Note:</b> ${esc(r.extraNote)}</div>`:''}<div class="toolbar"><button class="btn" type="button" onclick="editMembershipPackageFromRow('${enc}')">Edit</button><button class="btn red" type="button" onclick="deleteMembershipPackage('${esc(r.packageId||'')}')">Delete</button></div></div>`}).join('')||'<div class="item">No Membership packages yet.</div>';
    return rows;
  }catch(e){if(box)box.innerHTML='<div class="item">Unable to load Membership packages: '+esc(e?.message||'error')+'</div>';throw e;}
}
async function saveMembershipPackageAdmin(){const payload=membershipFormPayload();if(!payload.packageId)return toast('Enter Package ID.');if(!payload.packageName)return toast('Enter package name.');if(!(payload.packagePriceRM>0))return toast('Enter package price.');try{await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/membership/admin/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});toast('Membership package saved.');adminMembershipPackagesCache=[];clearMembershipPackageForm();await loadMembershipPackagesAdmin(true);}catch(e){toast(e?.message||'Failed to save Membership package.');}}
async function deleteMembershipPackage(packageId){if(!confirm('Delete Membership package '+packageId+'?'))return;try{await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/membership/admin/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({packageId})});toast('Membership package deleted.');adminMembershipPackagesCache=[];await loadMembershipPackagesAdmin(true);}catch(e){toast(e?.message||'Delete failed.');}}
window.editMembershipPackageFromRow=editMembershipPackageFromRow;window.deleteMembershipPackage=deleteMembershipPackage;
async function loadReferralSettingsAdmin(){try{const j=await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/referral/admin/settings',{cache:'no-store'});const x=j.settings||{};if($('#referralRewardRM'))$('#referralRewardRM').value=Number(x.rewardRM??2);if($('#referralMaxAccountAgeDays'))$('#referralMaxAccountAgeDays').value=Number(x.maxAccountAgeDays??14);if($('#referralProgramActive'))$('#referralProgramActive').checked=x.active!==false;if($('#referralSettingsStatus'))$('#referralSettingsStatus').textContent=`Current reward: RM${Number(x.rewardRM||0).toFixed(2)} per successful new registration.`;}catch(e){if($('#referralSettingsStatus'))$('#referralSettingsStatus').textContent='Unable to load referral settings: '+(e?.message||'error');}}
async function saveReferralSettingsAdmin(){const payload={rewardRM:Math.max(0,Number($('#referralRewardRM')?.value||0)||0),maxAccountAgeDays:Math.max(1,Math.min(90,Number($('#referralMaxAccountAgeDays')?.value||14)||14)),active:!!$('#referralProgramActive')?.checked};try{await azAdminFetchJson(AZOBSS_BACKEND_API+'/api/referral/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});toast('Referral settings saved.');await loadReferralSettingsAdmin();}catch(e){toast(e?.message||'Failed to save referral settings.');}}
document.addEventListener('click',(event)=>{if(event.target.closest('#saveMembershipPackage'))saveMembershipPackageAdmin();if(event.target.closest('#clearMembershipPackageForm'))clearMembershipPackageForm();if(event.target.closest('#generateMembershipPackageId')){const id='MEM'+Math.random().toString(36).slice(2,7).toUpperCase();if($('#membershipPackageId'))$('#membershipPackageId').value=id;}if(event.target.closest('#saveReferralSettings'))saveReferralSettingsAdmin();});

async function loadSettings(){
  const snap=await getDoc(doc(db,'settings','signupGate')).catch(e=>{azAdminReportQueryError('Settings: signupGate',e);return null});
  if(snap?.exists()){$('#settingsBox').innerHTML=item('Signup Gate',`<pre>${esc(JSON.stringify(snap.data(),null,2))}</pre>`)}
  else $('#settingsBox').innerHTML='<div class="item">No signupGate settings found.</div>';
  await loadReferralSettingsAdmin();
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
  const snap=await safeGet(query(collection(db,'notifications'),orderBy('createdAtMs','desc'),limit(50)),'Notifications: clear latest');
  const jobs=[]; snap?.forEach(d=>jobs.push(deleteDoc(doc(db,'notifications',d.id))));
  await Promise.all(jobs); azAdminLogAction('notification_clear_latest','notifications','latest',{count:jobs.length}); await loadNotifications(); await loadOverview(); toast('Notifications cleared.');
}


/* AZOBSS PATCH 304: Website Health Report / Export */
let azWebsiteReportLast=null;
function azReportStatusClass(status){
  status=String(status||'').toLowerCase();
  if(status==='critical'||status==='error'||status==='failed') return 'critical';
  if(status==='warning'||status==='warn') return 'warning';
  return 'ok';
}
function azReportStatusLabel(status){
  const cls=azReportStatusClass(status);
  return cls==='ok'?'OK':(cls==='warning'?'WARNING':'CRITICAL');
}
function azReportChip(status,label){
  const cls=azReportStatusClass(status);
  return `<span class="az-report-chip ${cls}">${esc(label||azReportStatusLabel(cls))}</span>`;
}
function azReportAdd(arr,status,module,message,details='',action=''){
  arr.push({status:azReportStatusClass(status),module:String(module||''),message:String(message||''),details:String(details||''),action:String(action||'')});
}
function azReportDownload(name,mime,content){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800);
}
function azReportFileStamp(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}
async function azReportCheckPage(page){
  const started=Date.now();
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),9000);
  try{
    const res=await fetch(page.path,{cache:'no-store',signal:ctrl.signal});
    const text=await res.text().catch(()=>'');
    const ok=res.ok && /<html|<!doctype html/i.test(text.slice(0,700));
    return {name:page.name,path:page.path,ok,status:res.status,latencyMs:Date.now()-started,bytes:text.length,reason:ok?'OK':('HTTP '+res.status+' / unexpected response')};
  }catch(e){
    return {name:page.name,path:page.path,ok:false,status:0,latencyMs:Date.now()-started,bytes:0,reason:e?.name==='AbortError'?'Timeout':(e?.message||String(e))};
  }finally{clearTimeout(timer);}
}
async function azReportLoadPaymentSummary(){
  const out={ok:false,totalRecords:0,paidRecords:0,pendingRecords:0,cancelledRecords:0,failedRecords:0,totalRevenue:0,pabmRevenue:0,softwareRevenue:0,cadRevenue:0,premiumOrders:0,purchaseLogs:0,error:''};
  try{
    const logs=await safeGet(query(collection(db,'purchaseLogs'),orderBy('createdAtMs','desc'),limit(300)),'Website Report: purchaseLogs');
    const premium=await azAdminLoadPremiumOrdersViaBackend(500);
    const records=[];
    logs?.forEach(d=>{
      const record=azAdminPurchaseLogToPaymentRecord(d.id,d.data());
      if(record) records.push(record);
    });
    premium.forEach(x=>records.push(x));
    out.premiumOrders=premium.length;
    out.purchaseLogs=records.filter(x=>x._azSource==='purchaseLogs').length;
    out.totalRecords=records.length;
    records.forEach(x=>{
      const bucket=azAdminStatusBucket(x);
      if(bucket==='paid'){
        out.paidRecords++;
        const amount=Number(x.amount||0)||0;
        out.totalRevenue+=amount;
        if(x.category==='PA/BM') out.pabmRevenue+=amount;
        else if(x.category==='Software') out.softwareRevenue+=amount;
        else if(x.category==='CAD Tools') out.cadRevenue+=amount;
      }else if(bucket==='pending') out.pendingRecords++;
      else if(bucket==='cancelled') out.cancelledRecords++;
      else if(bucket==='failed') out.failedRecords++;
    });
    out.ok=true;
  }catch(e){out.error=e?.message||String(e);}
  return out;
}
async function azReportLoadCommissionSummary(){
  const out={ok:false,totalRecords:0,pending:0,approved:0,paid:0,rejected:0,totalCommission:0,error:''};
  try{
    const snap=await safeGet(query(collection(db,'commissionRecords'),orderBy('createdAtMs','desc'),limit(500)),'Website Report: commissionRecords');
    snap?.forEach(d=>{
      const x=d.data()||{}; out.totalRecords++;
      const st=String(x.payoutStatus||x.status||'pending').toLowerCase();
      const amount=Number(x.commissionAmount||x.amount||x.commission||0)||0;
      out.totalCommission+=amount;
      if(st==='paid') out.paid++; else if(st==='approved') out.approved++; else if(st==='rejected') out.rejected++; else out.pending++;
    });
    out.ok=true;
  }catch(e){out.error=e?.message||String(e);}
  return out;
}
async function azReportLoadSupportSummary(){
  const out={ok:false,supportOpen:0,notificationsActive:0,error:''};
  try{
    const support=await safeGet(query(collection(db,'supportMessages'),limit(200)),'Website Report: supportMessages');
    support?.forEach(d=>{const x=d.data()||{}; const st=String(x.status||'open').toLowerCase(); if(st!=='closed'&&st!=='resolved') out.supportOpen++;});
    const notif=await safeGet(query(collection(db,'notifications'),limit(200)),'Website Report: notifications');
    notif?.forEach(d=>{const x=d.data()||{}; if(x.active!==false) out.notificationsActive++;});
    out.ok=true;
  }catch(e){out.error=e?.message||String(e);}
  return out;
}
function azReportOverallFromRows(rows){
  const critical=rows.filter(x=>x.status==='critical').length;
  const warning=rows.filter(x=>x.status==='warning').length;
  return critical?'critical':(warning?'warning':'ok');
}
function azReportBuildText(report){
  const lines=[];
  lines.push('AZOBSS WEBSITE HEALTH REPORT');
  lines.push('Overall: '+azReportStatusLabel(report.overallStatus));
  lines.push('Generated: '+fmtDate(report.generatedAtMs));
  lines.push('Admin: '+(report.admin||'-'));
  lines.push('');
  lines.push('SUMMARY');
  lines.push('- Pages OK: '+report.summary.pagesOk+'/'+report.summary.pagesTotal);
  lines.push('- Backend Status: '+(report.backend.status||'-'));
  lines.push('- Firebase Admin: '+(report.backend.firebaseConfigured?'OK':'ISSUE'));
  lines.push('- Missing Required ENV: '+report.backend.missingRequired);
  lines.push('- Collection Errors: '+report.backend.collectionErrors);
  lines.push('- Payment Records Loaded: '+report.payments.totalRecords+' (Paid '+report.payments.paidRecords+', Pending '+report.payments.pendingRecords+', Cancelled '+report.payments.cancelledRecords+', Failed '+report.payments.failedRecords+')');
  lines.push('- Confirmed Revenue: RM'+azAdminMoney(report.payments.totalRevenue)+' | PA/BM RM'+azAdminMoney(report.payments.pabmRevenue)+' | Software RM'+azAdminMoney(report.payments.softwareRevenue)+' | CAD RM'+azAdminMoney(report.payments.cadRevenue));
  lines.push('- Premium Orders: '+report.payments.premiumOrders+' | PA/BM purchaseLogs: '+report.payments.purchaseLogs);
  lines.push('- Commission Records: '+report.commissions.totalRecords+' | Pending '+report.commissions.pending+' | Approved '+report.commissions.approved+' | Paid '+report.commissions.paid+' | Rejected '+report.commissions.rejected);
  lines.push('- Support Open: '+report.support.supportOpen+' | Active Notifications: '+report.support.notificationsActive);
  lines.push('- Maintenance Issues: '+report.maintenance.issuesCount+' | Warnings: '+report.maintenance.warningsCount);
  lines.push('');
  lines.push('PAGE CHECK');
  report.pages.forEach(p=>lines.push('- '+p.name+': '+(p.ok?'OK':'ISSUE')+' • '+p.path+' • '+(p.status||'-')+' • '+p.latencyMs+'ms'+(p.ok?'':' • '+p.reason)));
  lines.push('');
  lines.push('MODULE CHECKLIST');
  report.rows.forEach(r=>lines.push('- ['+azReportStatusLabel(r.status)+'] '+r.module+': '+r.message+(r.details?' • '+r.details:'')));
  lines.push('');
  lines.push('ISSUES / RECOMMENDED ACTION');
  const bad=report.rows.filter(r=>r.status!=='ok');
  if(!bad.length) lines.push('- No critical issue found. Website looks OK based on this automated check.');
  bad.forEach(r=>lines.push('- ['+azReportStatusLabel(r.status)+'] '+r.module+': '+(r.action||r.details||r.message)));
  return lines.join('\n');
}
function azReportRowsToCsv(report){
  const csvEsc=v=>'"'+String(v??'').replace(/"/g,'""').replace(/\r?\n/g,' ').trim()+'"';
  const lines=[['status','module','message','details','action'].map(csvEsc).join(',')];
  (report?.rows||[]).forEach(r=>lines.push([azReportStatusLabel(r.status),r.module,r.message,r.details,r.action].map(csvEsc).join(',')));
  return lines.join('\n');
}
async function runWebsiteHealthReport(){
  const notice=$('#websiteReportNotice');
  if(notice) notice.textContent='Running full website check...';
  const rows=[];
  const started=Date.now();
  try{
    const pagesDef=[
      {name:'Home',path:'/'},{name:'Affiliate Shop',path:'/affiliate-shop/'},{name:'Software Tools',path:'/Software-Tools/'},{name:'CAD Tools',path:'/CAD-Tools-&-Resources/'},{name:'Lucky Draw',path:'/lucky-draw/'},{name:'PA/BM',path:'/PA-BM/'},{name:'Mini Web Tools',path:'/tools/'},{name:'Admin Dashboard',path:'/admin/'},{name:'Staff Dashboard',path:'/staff/'}
    ];
    const [healthRes,maintenanceRes,pages,payments,commissions,support]=await Promise.allSettled([
      azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/system-health',{cache:'no-store'}),
      azAdminFetchJson(AZOBSS_BACKEND_API+'/api/admin/maintenance-scan?limit=500',{cache:'no-store'}),
      Promise.all(pagesDef.map(azReportCheckPage)),
      azReportLoadPaymentSummary(),
      azReportLoadCommissionSummary(),
      azReportLoadSupportSummary()
    ]);
    const health=healthRes.status==='fulfilled'?healthRes.value:null;
    const maintenance=maintenanceRes.status==='fulfilled'?maintenanceRes.value:null;
    const pageRows=pages.status==='fulfilled'?pages.value:[];
    const paymentSummary=payments.status==='fulfilled'?payments.value:{ok:false,error:payments.reason?.message||String(payments.reason||'')};
    const commissionSummary=commissions.status==='fulfilled'?commissions.value:{ok:false,error:commissions.reason?.message||String(commissions.reason||'')};
    const supportSummary=support.status==='fulfilled'?support.value:{ok:false,error:support.reason?.message||String(support.reason||'')};

    const pagesOk=pageRows.filter(x=>x.ok).length;
    pageRows.forEach(p=>azReportAdd(rows,p.ok?'ok':'critical','Page: '+p.name,p.ok?'Reachable':'Not reachable',p.path+' • '+(p.status||'-')+' • '+p.latencyMs+'ms'+(p.ok?'':' • '+p.reason),p.ok?'':'Check GitHub Pages route/path or deploy status.'));

    if(health){
      azReportAdd(rows,health.status==='ok'?'ok':(health.status==='warning'?'warning':'critical'),'Backend / Firebase','Backend health status: '+String(health.status||'-').toUpperCase(),'Latency '+(health.latencyMs||0)+'ms • Firebase Admin '+(health.firebase?.configured?'configured':'not configured'),health.status==='ok'?'':'Open System Health and fix missing ENV / Firebase Admin issue.');
      const missing=(health.missingRequired||[]).length;
      azReportAdd(rows,missing?'critical':'ok','Required ENV',missing?('Missing '+missing+' required ENV'):'All required ENV configured',(health.missingRequired||[]).join(', ')||'OK',missing?'Update Render ENV and redeploy backend.':'');
      const colErr=(health.firebase?.collectionErrors||[]).length;
      azReportAdd(rows,colErr?'warning':'ok','Firestore Collections',colErr?('Collection errors: '+colErr):'Important collections readable',(health.firebase?.collectionErrors||[]).join(', ')||'OK',colErr?'Open System Health list and check Firestore/Admin SDK.':'');
    }else{
      azReportAdd(rows,'critical','Backend / Firebase','System health endpoint failed',healthRes.reason?.message||String(healthRes.reason||'Unknown error'),'Check Render backend / admin auth.');
    }

    if(maintenance){
      const issueCount=Number(maintenance.issuesCount || (Array.isArray(maintenance.issues)?maintenance.issues.reduce((a,x)=>a+Number(x.count||0),0):0) || 0);
      const warnCount=Array.isArray(maintenance.warnings)?maintenance.warnings.length:Number(maintenance.warningsCount||0)||0;
      azReportAdd(rows,issueCount?'warning':'ok','Maintenance Scan',issueCount?('Repairable issue count: '+issueCount):'No repairable issue detected','Warnings: '+warnCount+' • latency '+(maintenance.latencyMs||0)+'ms',issueCount?'Open Maintenance / Repair, run Scan, then run recommended repair only.':'');
      const needBackup=Number(maintenance?.samples?.localPremiumOrdersMissingFirestore?.length || maintenance?.counts?.localPremiumOrdersMissingFirestore || 0);
      const needRestore=Number(maintenance?.samples?.firestorePremiumOrdersMissingLocal?.length || maintenance?.counts?.firestorePremiumOrdersMissingLocal || 0);
      azReportAdd(rows,needBackup?'warning':'ok','Premium Orders Firestore Backup',needBackup?('Need backup: '+needBackup):'Local premiumOrders backed up or no missing sample','Need local restore sample: '+needRestore,needBackup?'Run Backup local premiumOrders to Firestore.':'');
    }else{
      azReportAdd(rows,'warning','Maintenance Scan','Maintenance scan failed',maintenanceRes.reason?.message||String(maintenanceRes.reason||'Unknown error'),'Open Maintenance tab and scan manually.');
    }

    azReportAdd(rows,paymentSummary.ok?'ok':'warning','Payment Data',paymentSummary.ok?'Payment records loaded':'Payment summary failed','Records '+(paymentSummary.totalRecords||0)+' • Premium '+(paymentSummary.premiumOrders||0)+' • purchaseLogs '+(paymentSummary.purchaseLogs||0)+' • revenue RM'+azAdminMoney(paymentSummary.totalRevenue||0),paymentSummary.ok?'':'Open Payment Logs / check backend premiumOrders export.');
    azReportAdd(rows,commissionSummary.ok?'ok':'warning','Commission Manager',commissionSummary.ok?'Commission records loaded':'Commission summary failed','Records '+(commissionSummary.totalRecords||0)+' • pending '+(commissionSummary.pending||0)+' • paid '+(commissionSummary.paid||0),commissionSummary.ok?'':'Open Commission Manager Pro and refresh.');
    azReportAdd(rows,supportSummary.ok?'ok':'warning','Support / Notifications',supportSummary.ok?'Support and notifications readable':'Support/notification summary failed','Open support '+(supportSummary.supportOpen||0)+' • active notifications '+(supportSummary.notificationsActive||0),supportSummary.ok?'':'Open Support Inbox / Notifications and check Firestore access.');

    const overall=azReportOverallFromRows(rows);
    const report={
      ok:overall!=='critical',overallStatus:overall,generatedAt:new Date().toISOString(),generatedAtMs:Date.now(),durationMs:Date.now()-started,admin:adminProfile?.username||currentUser?.email||'admin',
      summary:{pagesOk,pagesTotal:pageRows.length,warnings:rows.filter(x=>x.status==='warning').length,critical:rows.filter(x=>x.status==='critical').length},
      backend:{status:health?.status||'error',firebaseConfigured:!!health?.firebase?.configured,missingRequired:(health?.missingRequired||[]).length,collectionErrors:(health?.firebase?.collectionErrors||[]).length,latencyMs:health?.latencyMs||0},
      maintenance:{issuesCount:Number(maintenance?.issuesCount || (Array.isArray(maintenance?.issues)?maintenance.issues.reduce((a,x)=>a+Number(x.count||0),0):0) || 0),warningsCount:Array.isArray(maintenance?.warnings)?maintenance.warnings.length:0,raw:maintenance||null},
      payments:paymentSummary,commissions:commissionSummary,support:supportSummary,pages:pageRows,rows
    };
    report.text=azReportBuildText(report);
    azWebsiteReportLast=report;
    renderWebsiteReport(report);
    if(notice) notice.textContent='Report generated: '+fmtDate(report.generatedAtMs)+' • Overall '+azReportStatusLabel(report.overallStatus)+' • '+report.durationMs+'ms';
  }catch(e){
    if(notice) notice.textContent=e?.message||'Website report failed.';
    toast(e?.message||'Website report failed.');
  }
}
function renderWebsiteReport(report){
  azAdminSetText('#websiteReportOverall',azReportStatusLabel(report.overallStatus));
  const overallEl=$('#websiteReportOverall');
  if(overallEl){ overallEl.className='stat-value az-report-status-'+azReportStatusClass(report.overallStatus); }
  azAdminSetText('#websiteReportPagesOk',(report.summary.pagesOk||0)+'/'+(report.summary.pagesTotal||0));
  azAdminSetText('#websiteReportWarnings',report.summary.warnings||0);
  azAdminSetText('#websiteReportCritical',report.summary.critical||0);
  const text=$('#websiteReportText'); if(text) text.value=report.text||'';
  const json=$('#websiteReportJsonPreview'); if(json) json.textContent=JSON.stringify({...report,text:undefined},null,2);
  const checklist=$('#websiteReportChecklist');
  if(checklist){
    checklist.innerHTML=report.rows.map(r=>item(`${azReportChip(r.status)} ${esc(r.module)}`,`${esc(r.message)}${r.details?' • '+esc(r.details):''}`)).join('')||'<div class="item">No checklist rows.</div>';
  }
  const actions=$('#websiteReportActions');
  if(actions){
    const bad=report.rows.filter(r=>r.status!=='ok');
    actions.innerHTML=bad.length?bad.map(r=>item(`${azReportChip(r.status)} ${esc(r.module)}`,esc(r.action||r.details||r.message))).join(''):'<div class="item"><div class="item-title ok">✅ No important issue found</div><div class="item-meta">Website looks OK based on automated checks.</div></div>';
  }
}
function azAdminInitSiteReport(){
  if(azWebsiteReportLast) renderWebsiteReport(azWebsiteReportLast);
  else{
    const notice=$('#websiteReportNotice');
    if(notice) notice.textContent='Tekan Run Full Website Check untuk jana report terbaru.';
  }
}
async function copyWebsiteReport(){
  if(!azWebsiteReportLast){ toast('Run Full Website Check first.'); return; }
  const text=azWebsiteReportLast.text||'';
  try{ await navigator.clipboard.writeText(text); toast('Website report copied. Paste dekat ChatGPT.'); }
  catch(_e){ const box=$('#websiteReportText'); box?.select?.(); document.execCommand('copy'); toast('Website report copied from textarea.'); }
}
function downloadWebsiteReportTxt(){
  if(!azWebsiteReportLast){ toast('Run Full Website Check first.'); return; }
  azReportDownload('azobss-health-report-'+azReportFileStamp()+'.txt','text/plain;charset=utf-8',azWebsiteReportLast.text||'');
}
function downloadWebsiteReportJson(){
  if(!azWebsiteReportLast){ toast('Run Full Website Check first.'); return; }
  azReportDownload('azobss-health-report-'+azReportFileStamp()+'.json','application/json;charset=utf-8',JSON.stringify(azWebsiteReportLast,null,2));
}
function downloadWebsiteReportCsv(){
  if(!azWebsiteReportLast){ toast('Run Full Website Check first.'); return; }
  azReportDownload('azobss-health-report-'+azReportFileStamp()+'.csv','text/csv;charset=utf-8',azReportRowsToCsv(azWebsiteReportLast));
}
function printWebsiteReport(){
  if(!azWebsiteReportLast){ toast('Run Full Website Check first.'); return; }
  const w=window.open('','_blank','noopener,noreferrer,width=900,height=700');
  if(!w){ window.print(); return; }

  // Keep the printable report HTML self-contained. Do not inject global page styles
  // into this JavaScript string because an unescaped newline can break the whole
  // admin module and leave the dashboard stuck at "Checking admin access...".
  const reportText = esc(azWebsiteReportLast.text || '');
  const reportHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>AZOBSS Health Report</title>
  <style>
    body{font-family:Arial,sans-serif;margin:24px;white-space:pre-wrap;line-height:1.45}
    pre{font-family:Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
  </style>
</head>
<body><pre>${reportText}</pre></body>
</html>`;

  w.document.open();
  w.document.write(reportHtml);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),250);
}


/* AZOBSS PATCH 1314: Debt list no-slide + manual +/- + editable due dates + seeded payment schedule. */
const AZ_DEBT_STORAGE_KEY='azobssAdminDebtLoanTrackerV1314';
const AZ_DEBT_LEGACY_STORAGE_KEY='azobssAdminDebtLoanTrackerV1313';
const AZ_DEBT_LEGACY_STORAGE_KEY_2='azobssAdminDebtLoanTrackerV1312';
const AZ_DEBT_CLOUD_COLLECTION='adminFinance';
const AZ_DEBT_CLOUD_DOC='debtLoanTracker';
const AZ_DEBT_SHOPEE_BRIDGE_ID='azobss-shopee-finance-bridge-v1313';
const AZ_DEBT_SHOPEE_READY_EVENT='azobss-shopee-finance-ready';
const AZ_DEBT_SHOPEE_ACK_EVENT='azobss-shopee-finance-ack';
let azDebtState=null;
let azDebtCloudAttempted=false;
let azDebtBridgeTimer=0;

function azDebtDefaultFinance(kind){
  const sp=kind==='spaylater';
  if(sp){
    return {id:'shopee-spaylater',type:'spaylater',creditor:'Shopee Finance',title:'SPayLater',balance:3469,balanceAvailable:true,originalAmount:3469,monthly:157.68,currentDue:0,nextDue:'2026-11-01',principalBalance:0,interestRate:0,remainingInstallments:22,originalTenure:22,lateCharges:0,lastPaymentDate:'',note:'Baseline manual v1314: total baki RM3,469 ÷ 22 bayaran = purata RM157.68/bulan. Due 1hb. Auto sync Shopee boleh kemas kini baki sebenar.',status:'active',linked:false,managedSync:true,syncProvider:'shopee-browser',lastSyncAtMs:0,lastCaptureId:'',syncConfidence:'manual baseline',bankMatchKeywords:'SPAYLATER|SPAY LATER'};
  }
  return {id:'shopee-sloan',type:'sloan',creditor:'Shopee Finance',title:'SLoan / SPay Loan',balance:7146,balanceAvailable:true,originalAmount:7146,monthly:397,currentDue:397,nextDue:'2026-11-11',principalBalance:0,interestRate:0,remainingInstallments:18,originalTenure:18,lateCharges:0,lastPaymentDate:'',note:'Baseline manual v1314: 18 bulan × RM397 = anggaran jadual baki RM7,146. Due 11hb. Auto sync Shopee boleh gantikan dengan baki sebenar.',status:'active',linked:false,managedSync:true,syncProvider:'shopee-browser',lastSyncAtMs:0,lastCaptureId:'',syncConfidence:'manual baseline',bankMatchKeywords:'SLOAN|SPAY LOAN|SHOPEE LOAN'};
}
function azDebtDefaultState(){
  return {
    version:3,v1314SeedApplied:true,plannerMonths:12,updatedAtMs:Date.now(),
    debts:[
      {id:'ambank-vdd5378',type:'vehicle',creditor:'AmBank',title:'HP Act - Fixed • VDD5378',balance:11896.15,balanceAvailable:true,originalAmount:0,monthly:479,currentDue:479,nextDue:'2026-11-14',principalBalance:11188.35,interestRate:3.61,remainingInstallments:26,originalTenure:114,lateCharges:8.15,lastPaymentDate:'2026-10-14',note:'Loan kereta. Baki bank semasa berdasarkan paparan AmOnline 14 Oct 2026.',status:'active',linked:true,managedSync:false,bankMatchKeywords:'AMBANK HP|HIRE PURCHASE'},
      azDebtDefaultFinance('spaylater'),azDebtDefaultFinance('sloan'),
      {id:'nava-pos',type:'person',creditor:'Nava Shankara',title:'Bayaran POS Sistem',balance:600,balanceAvailable:true,originalAmount:600,monthly:0,currentDue:0,nextDue:'',principalBalance:0,interestRate:0,remainingInstallments:0,originalTenure:0,lateCharges:0,lastPaymentDate:'',note:'Aku kena bayar Nava Shankara untuk bayaran POS Sistem.',status:'active',linked:true,managedSync:false,bankMatchKeywords:''},
      {id:'omar-family',type:'person',creditor:'Omar bin Akasah',title:'Pinjaman Ayah',balance:5000,balanceAvailable:true,originalAmount:5000,monthly:0,currentDue:0,nextDue:'',principalBalance:0,interestRate:0,remainingInstallments:0,originalTenure:0,lateCharges:0,lastPaymentDate:'',note:'Pinjaman Ayah.',status:'active',linked:true,managedSync:false,bankMatchKeywords:''}
    ],payments:[],syncEvents:[],bankImports:[]
  };
}
function azDebtClone(x){try{return JSON.parse(JSON.stringify(x));}catch(_e){return x;}}
function azDebtEsc(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function azDebtNum(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function azDebtMoney(v){return 'RM'+azDebtNum(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});}
function azDebtDate(v){if(!v)return '-';const d=new Date(String(v)+'T00:00:00');if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'});}
function azDebtDateTime(ms){const d=new Date(azDebtNum(ms)||0);if(!azDebtNum(ms)||Number.isNaN(d.getTime()))return '-';return d.toLocaleString('en-MY',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function azDebtMonthYear(v){if(!v)return '-';const d=new Date(String(v)+'T00:00:00');if(Number.isNaN(d.getTime()))return '-';return d.toLocaleDateString('en-MY',{month:'short',year:'numeric'});}
function azDebtAddMonths(dateStr,months){if(!dateStr)return '';const d=new Date(String(dateStr)+'T00:00:00');if(Number.isNaN(d.getTime()))return '';const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+Number(months||0));const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`;}
function azDebtToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function azDebtHash(s){let h=2166136261;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function azDebtEnsureManaged(debts){const arr=Array.isArray(debts)?debts:[];for(const kind of ['spaylater','sloan']){const seed=azDebtDefaultFinance(kind);const i=arr.findIndex(x=>String(x?.id)===seed.id||x?.type===kind);if(i<0)arr.push(seed);else arr[i]={...seed,...arr[i],id:seed.id,type:kind,managedSync:true};}return arr;}
function azDebtApplyV1314Migration(out,sourceVersion){
  if(sourceVersion>=3&&out.v1314SeedApplied)return out;
  const car=(out.debts||[]).find(d=>String(d.id)==='ambank-vdd5378'||d.type==='vehicle');
  if(car){car.monthly=479;car.currentDue=479;car.nextDue='2026-11-14';car.note=car.note||'Loan kereta. Due 14hb.';}
  const sp=(out.debts||[]).find(d=>String(d.id)==='shopee-spaylater'||d.type==='spaylater');
  if(sp&&!azDebtNum(sp.lastSyncAtMs)){
    Object.assign(sp,{balance:3469,balanceAvailable:true,originalAmount:Math.max(3469,azDebtNum(sp.originalAmount)),monthly:157.68,currentDue:0,nextDue:'2026-11-01',remainingInstallments:22,originalTenure:Math.max(22,azDebtNum(sp.originalTenure)),status:'active',syncConfidence:'manual baseline'});
    sp.note='Baseline manual v1314: total baki RM3,469 ÷ 22 bayaran = purata RM157.68/bulan. Due 1hb. Auto sync Shopee boleh kemas kini baki sebenar.';
  }
  const sl=(out.debts||[]).find(d=>String(d.id)==='shopee-sloan'||d.type==='sloan');
  if(sl&&!azDebtNum(sl.lastSyncAtMs)){
    Object.assign(sl,{balance:7146,balanceAvailable:true,originalAmount:Math.max(7146,azDebtNum(sl.originalAmount)),monthly:397,currentDue:397,nextDue:'2026-11-11',remainingInstallments:18,originalTenure:Math.max(18,azDebtNum(sl.originalTenure)),status:'active',syncConfidence:'manual baseline'});
    sl.note='Baseline manual v1314: 18 bulan × RM397 = anggaran jadual baki RM7,146. Due 11hb. Auto sync Shopee boleh gantikan dengan baki sebenar.';
  }
  out.version=3;out.v1314SeedApplied=true;return out;
}
function azDebtSafeState(raw){
  const def=azDebtDefaultState();if(!raw||typeof raw!=='object')return def;const sourceVersion=Math.max(0,parseInt(raw.version||0,10)||0);const out={...def,...raw};out.version=3;out.plannerMonths=Math.max(1,Math.min(120,parseInt(out.plannerMonths||12,10)||12));
  const allowed=['person','vehicle','spaylater','sloan','other'];
  out.debts=Array.isArray(raw.debts)?raw.debts.map((d,i)=>({
    id:String(d?.id||('debt-'+Date.now()+'-'+i)),type:allowed.includes(d?.type)?d.type:'other',creditor:String(d?.creditor||''),title:String(d?.title||''),balance:Math.max(0,azDebtNum(d?.balance)),balanceAvailable:d?.balanceAvailable!==false,originalAmount:Math.max(0,azDebtNum(d?.originalAmount)),monthly:Math.max(0,azDebtNum(d?.monthly)),currentDue:Math.max(0,azDebtNum(d?.currentDue)),nextDue:String(d?.nextDue||''),principalBalance:Math.max(0,azDebtNum(d?.principalBalance)),interestRate:Math.max(0,azDebtNum(d?.interestRate)),remainingInstallments:Math.max(0,Math.round(azDebtNum(d?.remainingInstallments))),originalTenure:Math.max(0,Math.round(azDebtNum(d?.originalTenure))),lateCharges:Math.max(0,azDebtNum(d?.lateCharges)),lastPaymentDate:String(d?.lastPaymentDate||''),note:String(d?.note||''),status:String(d?.status||((azDebtNum(d?.balance)<=0)?'paid':'active')),linked:d?.linked!==false,managedSync:!!d?.managedSync,syncProvider:String(d?.syncProvider||''),lastSyncAtMs:Math.max(0,azDebtNum(d?.lastSyncAtMs)),lastCaptureId:String(d?.lastCaptureId||''),syncConfidence:String(d?.syncConfidence||''),bankMatchKeywords:String(d?.bankMatchKeywords||'')
  })):def.debts;
  out.debts=azDebtEnsureManaged(out.debts);out.payments=Array.isArray(raw.payments)?raw.payments.slice(0,300):[];out.syncEvents=Array.isArray(raw.syncEvents)?raw.syncEvents.slice(0,200):[];out.bankImports=Array.isArray(raw.bankImports)?raw.bankImports.slice(0,1000):[];return azDebtApplyV1314Migration(out,sourceVersion);
}
function azDebtReadLocal(){try{let raw=localStorage.getItem(AZ_DEBT_STORAGE_KEY);if(!raw)raw=localStorage.getItem(AZ_DEBT_LEGACY_STORAGE_KEY);if(!raw)raw=localStorage.getItem(AZ_DEBT_LEGACY_STORAGE_KEY_2);return raw?azDebtSafeState(JSON.parse(raw)):null;}catch(_e){return null;}}
function azDebtWriteLocal(){if(!azDebtState)return;azDebtState.updatedAtMs=Date.now();try{localStorage.setItem(AZ_DEBT_STORAGE_KEY,JSON.stringify(azDebtState));}catch(_e){}}
async function azDebtSaveCloud(){if(!azDebtState||!currentUser)return false;try{await setDoc(doc(db,AZ_DEBT_CLOUD_COLLECTION,AZ_DEBT_CLOUD_DOC),{...azDebtClone(azDebtState),updatedAtMs:Date.now(),updatedAt:serverTimestamp(),updatedBy:currentUser.email||currentUser.uid||'admin'},{merge:false});const n=document.getElementById('azDebtStorageMode');if(n)n.textContent='☁ Synced to Firestore';return true;}catch(e){const n=document.getElementById('azDebtStorageMode');if(n)n.textContent='💻 Browser local (Firestore not available)';return false;}}
async function azDebtSave(){azDebtWriteLocal();azDebtRender();await azDebtSaveCloud();}
async function azDebtLoadCloud(){if(azDebtCloudAttempted||!currentUser)return;azDebtCloudAttempted=true;try{const snap=await getDoc(doc(db,AZ_DEBT_CLOUD_COLLECTION,AZ_DEBT_CLOUD_DOC));if(snap.exists()){const cloud=azDebtSafeState(snap.data());const local=azDebtReadLocal();azDebtState=(!local||azDebtNum(cloud.updatedAtMs)>=azDebtNum(local.updatedAtMs))?cloud:local;azDebtWriteLocal();const n=document.getElementById('azDebtStorageMode');if(n)n.textContent='☁ Synced to Firestore';azDebtRender();if(local&&azDebtNum(local.updatedAtMs)>azDebtNum(cloud.updatedAtMs))await azDebtSaveCloud();}else await azDebtSaveCloud();}catch(e){const n=document.getElementById('azDebtStorageMode');if(n)n.textContent='💻 Browser local (Firestore not available)';}}
function azDebtActive(){return (azDebtState?.debts||[]).filter(d=>d.balanceAvailable!==false&&azDebtNum(d.balance)>0&&d.status!=='paid');}
function azDebtFind(id){return (azDebtState?.debts||[]).find(d=>String(d.id)===String(id));}
function azDebtCalc(){const debts=azDebtActive();const total=debts.reduce((a,d)=>a+azDebtNum(d.balance),0);const vehicle=debts.filter(d=>d.type==='vehicle').reduce((a,d)=>a+azDebtNum(d.balance),0);const spaylater=debts.filter(d=>d.type==='spaylater').reduce((a,d)=>a+azDebtNum(d.balance),0);const sloan=debts.filter(d=>d.type==='sloan').reduce((a,d)=>a+azDebtNum(d.balance),0);const people=debts.filter(d=>d.type==='person').reduce((a,d)=>a+azDebtNum(d.balance),0);const other=debts.filter(d=>d.type==='other').reduce((a,d)=>a+azDebtNum(d.balance),0);const monthlyKnown=debts.reduce((a,d)=>a+Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue)),0);const months=Math.max(1,parseInt(azDebtState?.plannerMonths||12,10)||12);const peopleTarget=people/months;const fixedNonPeople=debts.filter(d=>d.type!=='person').reduce((a,d)=>a+Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue)),0);const targetMonthly=fixedNonPeople+peopleTarget;const due=debts.filter(d=>d.nextDue).sort((a,b)=>String(a.nextDue).localeCompare(String(b.nextDue)))[0]||null;return {debts,total,vehicle,spaylater,sloan,people,other,monthlyKnown,months,peopleTarget,targetMonthly,due};}
function azDebtSetText(id,text){const n=document.getElementById(id);if(n)n.textContent=text;}
function azDebtTypeLabel(t){return t==='vehicle'?'Loan Kereta':t==='person'?'Hutang Orang':t==='spaylater'?'SPayLater':t==='sloan'?'SLoan / SPay Loan':'Lain-lain';}
function azDebtProgress(d){if(d.type==='vehicle'&&azDebtNum(d.originalTenure)>0){const done=Math.max(0,azDebtNum(d.originalTenure)-azDebtNum(d.remainingInstallments));return Math.min(100,(done/azDebtNum(d.originalTenure))*100);}const orig=azDebtNum(d.originalAmount);if(orig>0&&d.balanceAvailable!==false)return Math.min(100,Math.max(0,((orig-azDebtNum(d.balance))/orig)*100));return d.balanceAvailable!==false&&azDebtNum(d.balance)<=0?100:0;}
function azDebtSyncBox(kind){const d=(azDebtState?.debts||[]).find(x=>x.type===kind);const money=document.getElementById(kind==='spaylater'?'azDebtSpaySyncMoney':'azDebtSloanSyncMoney');const meta=document.getElementById(kind==='spaylater'?'azDebtSpaySyncMeta':'azDebtSloanSyncMeta');if(!d||!money||!meta)return;money.textContent=d.balanceAvailable!==false?(azDebtMoney(d.balance)):(d.linked?'Baki belum dikesan':'Belum linked');meta.innerHTML=`<span>Current due</span><b>${azDebtNum(d.currentDue)>0?azDebtMoney(d.currentDue):'-'}</b><span>Next due</span><b>${d.nextDue?azDebtDate(d.nextDue):'-'}</b><span>Last sync</span><b>${d.lastSyncAtMs?azDebtDateTime(d.lastSyncAtMs):'-'}</b><span>Confidence</span><b>${azDebtEsc(d.syncConfidence||'-')}</b>`;}
function azDebtRender(){
  if(!azDebtState)azDebtState=azDebtReadLocal()||azDebtDefaultState();const c=azDebtCalc();
  azDebtSetText('azDebtTotal',azDebtMoney(c.total));azDebtSetText('azDebtVehicleTotal',azDebtMoney(c.vehicle));azDebtSetText('azDebtPeopleTotal',azDebtMoney(c.people));azDebtSetText('azDebtMonthlyKnown',azDebtMoney(c.monthlyKnown));azDebtSetText('azDebtTargetMonthly',azDebtMoney(c.targetMonthly));
  const sp=azDebtFind('shopee-spaylater'),sl=azDebtFind('shopee-sloan');azDebtSetText('azDebtSpayLaterTotal',sp?.balanceAvailable!==false?azDebtMoney(sp.balance):'—');azDebtSetText('azDebtSloanTotal',sl?.balanceAvailable!==false?azDebtMoney(sl.balance):'—');azDebtSetText('azDebtSpayLaterNote',sp?.linked?(sp.lastSyncAtMs?'Last sync '+azDebtDateTime(sp.lastSyncAtMs):'Linked'):(sp?.balanceAvailable!==false?'Manual baseline • due '+(sp.nextDue?azDebtDate(sp.nextDue):'-'):'Belum linked.'));azDebtSetText('azDebtSloanNote',sl?.linked?(sl.lastSyncAtMs?'Last sync '+azDebtDateTime(sl.lastSyncAtMs):'Linked'):(sl?.balanceAvailable!==false?'Manual baseline • due '+(sl.nextDue?azDebtDate(sl.nextDue):'-'):'Belum linked.'));
  azDebtSetText('azDebtTargetNote',`Komitmen finance + hutang orang ÷ ${c.months} bulan.`);azDebtSetText('azDebtNextDue',c.due?azDebtDate(c.due.nextDue):'-');azDebtSetText('azDebtNextDueNote',c.due?`${c.due.creditor||azDebtTypeLabel(c.due.type)} • ${c.due.title||''}`:'Tiada tarikh ditetapkan.');const pm=document.getElementById('azDebtPlannerMonths');if(pm&&document.activeElement!==pm)pm.value=String(c.months);azDebtSyncBox('spaylater');azDebtSyncBox('sloan');azDebtRefreshBridgeStatus();
  const car=(azDebtState.debts||[]).find(d=>d.type==='vehicle'&&azDebtNum(d.balance)>0)||(azDebtState.debts||[]).find(d=>d.type==='vehicle');const carMetrics=document.getElementById('azDebtCarMetrics'),loanCalc=document.getElementById('azDebtLoanCalc');
  if(car&&carMetrics){const completed=Math.max(0,azDebtNum(car.originalTenure)-azDebtNum(car.remainingInstallments));const tenurePct=azDebtNum(car.originalTenure)>0?(completed/azDebtNum(car.originalTenure))*100:0;const scheduled=azDebtNum(car.monthly)*azDebtNum(car.remainingInstallments);const gap=azDebtNum(car.balance)-azDebtNum(car.principalBalance);const scheduleGap=scheduled-azDebtNum(car.balance);const finalDue=car.nextDue&&azDebtNum(car.remainingInstallments)>0?azDebtAddMonths(car.nextDue,Math.max(0,azDebtNum(car.remainingInstallments)-1)):'';carMetrics.innerHTML=`<div class="az-debt-metric is-money"><span>Outstanding Balance</span><b>${azDebtMoney(car.balance)}</b></div><div class="az-debt-metric"><span>Principal Balance</span><b>${azDebtMoney(car.principalBalance)}</b></div><div class="az-debt-metric is-money"><span>Installment / Month</span><b>${azDebtMoney(car.monthly)}</b></div><div class="az-debt-metric"><span>Interest Rate</span><b>${azDebtNum(car.interestRate).toFixed(2)}%</b></div><div class="az-debt-metric"><span>Remaining Installment</span><b>${Math.round(azDebtNum(car.remainingInstallments))}</b></div><div class="az-debt-metric"><span>Original Tenure</span><b>${Math.round(azDebtNum(car.originalTenure))} bulan</b></div><div class="az-debt-metric is-warn"><span>Late Payment Charges</span><b>${azDebtMoney(car.lateCharges)}</b></div><div class="az-debt-metric"><span>Next Payment Due</span><b>${azDebtDate(car.nextDue)}</b></div><div class="az-debt-metric"><span>Last Payment Date</span><b>${azDebtDate(car.lastPaymentDate)}</b></div><div class="az-debt-metric"><span>Tenure Selesai</span><b>${completed}/${Math.round(azDebtNum(car.originalTenure))} (${tenurePct.toFixed(1)}%)</b></div><div class="az-debt-metric"><span>Anggaran Bayaran Akhir</span><b>${azDebtMonthYear(finalDue)}</b></div><div class="az-debt-metric"><span>Vehicle</span><b>${String(car.title||'').includes('VDD5378')?'VDD5378':'Loan Kereta'}</b></div>`;if(loanCalc)loanCalc.innerHTML=`<div class="az-debt-plan-line"><span><strong>Baki bank semasa</strong><br><em>Outstanding Balance</em></span><b>${azDebtMoney(car.balance)}</b></div><div class="az-debt-plan-line"><span><strong>Baki principal</strong><br><em>Principal Balance</em></span><b>${azDebtMoney(car.principalBalance)}</b></div><div class="az-debt-plan-line"><span><strong>Perbezaan outstanding vs principal</strong><br><em>Bukan ditambah semula ke total hutang</em></span><b>${azDebtMoney(gap)}</b></div><div class="az-debt-plan-line"><span><strong>${Math.round(azDebtNum(car.remainingInstallments))} × ${azDebtMoney(car.monthly)}</strong><br><em>Jumlah jadual ansuran berbaki jika amaun kekal sama</em></span><b>${azDebtMoney(scheduled)}</b></div><div class="az-debt-plan-line"><span><strong>Jadual ansuran − outstanding</strong><br><em>Perbezaan kiraan, bukan caj tambahan</em></span><b>${azDebtMoney(scheduleGap)}</b></div><div class="az-debt-plan-line"><span><strong>Progress tenure</strong><br><em>${completed} bulan selesai, ${Math.round(azDebtNum(car.remainingInstallments))} berbaki</em></span><b>${tenurePct.toFixed(1)}%</b></div>`;}else{if(carMetrics)carMetrics.innerHTML='<div class="tabs-note">Tiada loan kereta aktif.</div>';if(loanCalc)loanCalc.innerHTML='<div class="tabs-note">Tiada data loan kereta.</div>';}
  const breakdown=document.getElementById('azDebtBreakdown');if(breakdown){const parts=[['Loan Kereta',c.vehicle],['SPayLater',c.spaylater],['SLoan',c.sloan],['Hutang Orang',c.people],['Lain-lain',c.other]].filter(x=>x[1]>0||['Loan Kereta','Hutang Orang'].includes(x[0]));breakdown.innerHTML=parts.map(([name,val])=>{const pct=c.total>0?(val/c.total*100):0;return `<div class="az-debt-breakdown-item"><small>${name}</small><b>${azDebtMoney(val)}</b><small>${pct.toFixed(1)}% daripada total</small><div class="az-debt-bar"><span style="width:${Math.min(100,pct).toFixed(1)}%"></span></div></div>`}).join('');}
  const tbody=document.getElementById('azDebtTableBody');if(tbody){const rows=[...(azDebtState.debts||[])].sort((a,b)=>(a.managedSync?0:1)-(b.managedSync?0:1)||(azDebtNum(b.balance)>0?1:0)-(azDebtNum(a.balance)>0?1:0)||azDebtNum(b.balance)-azDebtNum(a.balance));tbody.innerHTML=rows.length?rows.map(d=>{const pct=azDebtProgress(d),known=d.balanceAvailable!==false,paid=known&&azDebtNum(d.balance)<=0,unlinked=d.managedSync&&!d.linked;const pill=unlinked?'unlinked':(d.type==='person'?'person':d.type);const state=paid?'Paid':unlinked?'Manual / belum sync':azDebtTypeLabel(d.type);const sync=d.managedSync?(d.lastSyncAtMs?`Synced ${azDebtDateTime(d.lastSyncAtMs)}`:(d.syncConfidence||'Manual baseline')):`${pct.toFixed(1)}%`;const amount=known?`<span class="az-debt-money-line">${azDebtMoney(d.balance)}</span>`:'<span class="az-debt-sub">Belum dikesan</span>';const dueAmt=Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue));const remain=azDebtNum(d.remainingInstallments)>0?`<div class="az-debt-sub">${Math.round(azDebtNum(d.remainingInstallments))} bayaran berbaki</div>`:'';return `<tr data-debt-id="${azDebtEsc(String(d.id))}"><td data-label="Jenis / Pemiutang"><span class="az-debt-pill ${pill} ${paid?'paid':''}">${state}</span><div class="az-debt-name" style="margin-top:6px">${azDebtEsc(d.creditor||'-')}</div></td><td data-label="Keterangan"><div class="az-debt-name">${azDebtEsc(d.title||'-')}</div><div class="az-debt-sub">${azDebtEsc(d.note||'')}</div></td><td data-label="Baki" class="az-debt-amount">${amount}${remain}</td><td data-label="Bulanan / Due">${dueAmt>0?azDebtMoney(dueAmt):'<span class="az-debt-sub">Belum ditetapkan</span>'}</td><td data-label="Tarikh Due"><div class="az-debt-due-editor"><input type="date" value="${azDebtEsc(d.nextDue||'')}" data-debt-due-input data-id="${azDebtEsc(String(d.id))}" aria-label="Edit due date ${azDebtEsc(d.title||d.creditor||'hutang')}"><span class="az-debt-sub">${d.nextDue?azDebtDate(d.nextDue):'Pilih due date'}</span></div></td><td data-label="Sync / Progress"><b>${azDebtEsc(sync)}</b>${d.managedSync?`<div class="az-debt-sub">${azDebtEsc(d.syncConfidence||'')}</div>`:`<div class="az-debt-bar" style="width:100%;max-width:115px"><span style="width:${pct.toFixed(1)}%"></span></div>`}</td><td data-label="Tindakan"><div class="az-debt-actions"><button class="btn green" type="button" data-debt-action="pay" data-id="${azDebtEsc(String(d.id))}" ${!known||paid?'disabled':''}>− Tolak / Bayar</button><button class="btn gray" type="button" data-debt-action="add-balance" data-id="${azDebtEsc(String(d.id))}">＋ Tambah</button><button class="btn" type="button" data-debt-action="edit" data-id="${azDebtEsc(String(d.id))}">Edit</button>${d.managedSync?`<button class="btn gray" type="button" data-debt-action="reset-sync" data-id="${azDebtEsc(String(d.id))}">Reset Sync</button>`:`<button class="btn red" type="button" data-debt-action="delete" data-id="${azDebtEsc(String(d.id))}">Delete</button>`}</div></td></tr>`}).join(''):'<tr><td colspan="7" class="tabs-note">Tiada rekod hutang.</td></tr>';}
  const plan=document.getElementById('azDebtPlanTable');if(plan){const people=azDebtActive().filter(d=>d.type==='person');const lines=[];const fixed=azDebtActive().filter(d=>d.type!=='person'&&Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue))>0);fixed.forEach(d=>{const amt=Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue));lines.push(`<div class="az-debt-plan-line"><span><strong>${azDebtEsc(d.creditor||azDebtTypeLabel(d.type))}</strong><br><em>${azDebtEsc(d.title||'Komitmen tetap')}</em></span><b>${azDebtMoney(amt)}/bln</b></div>`)});people.forEach(d=>lines.push(`<div class="az-debt-plan-line"><span><strong>${azDebtEsc(d.creditor||'Hutang Orang')}</strong><br><em>${azDebtEsc(d.title||'')} • baki ${azDebtMoney(d.balance)} ÷ ${c.months} bulan</em></span><b>${azDebtMoney(azDebtNum(d.balance)/c.months)}/bln</b></div>`));if(!lines.length)lines.push('<div class="tabs-note">Tiada komitmen aktif.</div>');plan.innerHTML=lines.join('');}azDebtSetText('azDebtPlanTotal',azDebtMoney(c.targetMonthly));
  const hist=document.getElementById('azDebtHistory');if(hist){const items=(azDebtState.payments||[]).slice().sort((a,b)=>azDebtNum(b.atMs)-azDebtNum(a.atMs)).slice(0,20);hist.innerHTML=items.length?items.map(x=>{const add=x.direction==='increase';return `<div class="az-debt-history-row"><small>${new Date(azDebtNum(x.atMs)||Date.now()).toLocaleDateString('en-MY',{day:'2-digit',month:'short',year:'numeric'})}</small><div><b>${azDebtEsc(x.creditor||'')}</b><div class="az-debt-sub">${azDebtEsc(x.title||'')} ${x.note?'• '+azDebtEsc(x.note):''}</div></div><b class="az-debt-amount ${add?'is-add':''}">${add?'+':'−'}${azDebtMoney(x.amount)}</b></div>`}).join(''):'<div class="tabs-note">Belum ada rekod bayaran / pelarasan.</div>';}
}
function azDebtClearEditor(){const vals={azDebtEditId:'',azDebtType:'person',azDebtCreditor:'',azDebtTitle:'',azDebtBalance:'',azDebtOriginal:'',azDebtMonthly:'',azDebtCurrentDue:'',azDebtDue:'',azDebtPrincipal:'',azDebtRate:'',azDebtRemaining:'',azDebtTenure:'',azDebtLate:'',azDebtLastPayment:'',azDebtBankKeywords:'',azDebtNote:''};Object.entries(vals).forEach(([id,v])=>{const n=document.getElementById(id);if(n)n.value=v;});azDebtSetText('azDebtEditorTitle','＋ Tambah Hutang');}
function azDebtEdit(id){const d=azDebtFind(id);if(!d)return;const vals={azDebtEditId:d.id,azDebtType:d.type,azDebtCreditor:d.creditor,azDebtTitle:d.title,azDebtBalance:d.balanceAvailable!==false?d.balance:'',azDebtOriginal:d.originalAmount||'',azDebtMonthly:d.monthly||'',azDebtCurrentDue:d.currentDue||'',azDebtDue:d.nextDue||'',azDebtPrincipal:d.principalBalance||'',azDebtRate:d.interestRate||'',azDebtRemaining:d.remainingInstallments||'',azDebtTenure:d.originalTenure||'',azDebtLate:d.lateCharges||'',azDebtLastPayment:d.lastPaymentDate||'',azDebtBankKeywords:d.bankMatchKeywords||'',azDebtNote:d.note||''};Object.entries(vals).forEach(([id2,v])=>{const n=document.getElementById(id2);if(n)n.value=v;});azDebtSetText('azDebtEditorTitle','✏️ Edit Hutang');document.getElementById('azDebtEditorCard')?.scrollIntoView({behavior:'smooth',block:'start'});}
async function azDebtSaveEditor(){if(!azDebtState)azDebtState=azDebtDefaultState();const id=String(document.getElementById('azDebtEditId')?.value||'').trim();const creditor=String(document.getElementById('azDebtCreditor')?.value||'').trim(),title=String(document.getElementById('azDebtTitle')?.value||'').trim();if(!creditor)return toast('Masukkan nama pemiutang / orang.');if(!title)return toast('Masukkan keterangan hutang.');const type=String(document.getElementById('azDebtType')?.value||'other');const rawBal=String(document.getElementById('azDebtBalance')?.value||'').trim();const obj={id:id||('debt-'+Date.now()),type,creditor,title,balance:Math.max(0,azDebtNum(rawBal)),balanceAvailable:rawBal!==''||!['spaylater','sloan'].includes(type),originalAmount:Math.max(0,azDebtNum(document.getElementById('azDebtOriginal')?.value)),monthly:Math.max(0,azDebtNum(document.getElementById('azDebtMonthly')?.value)),currentDue:Math.max(0,azDebtNum(document.getElementById('azDebtCurrentDue')?.value)),nextDue:String(document.getElementById('azDebtDue')?.value||''),principalBalance:Math.max(0,azDebtNum(document.getElementById('azDebtPrincipal')?.value)),interestRate:Math.max(0,azDebtNum(document.getElementById('azDebtRate')?.value)),remainingInstallments:Math.max(0,Math.round(azDebtNum(document.getElementById('azDebtRemaining')?.value))),originalTenure:Math.max(0,Math.round(azDebtNum(document.getElementById('azDebtTenure')?.value))),lateCharges:Math.max(0,azDebtNum(document.getElementById('azDebtLate')?.value)),lastPaymentDate:String(document.getElementById('azDebtLastPayment')?.value||''),bankMatchKeywords:String(document.getElementById('azDebtBankKeywords')?.value||'').trim(),note:String(document.getElementById('azDebtNote')?.value||'').trim(),status:'active',linked:true};if(obj.balanceAvailable&&obj.balance<=0)obj.status='paid';if(!obj.originalAmount&&obj.balanceAvailable&&obj.type!=='vehicle')obj.originalAmount=obj.balance;const idx=(azDebtState.debts||[]).findIndex(d=>String(d.id)===String(obj.id));if(idx>=0)azDebtState.debts[idx]={...azDebtState.debts[idx],...obj};else azDebtState.debts.push(obj);azDebtClearEditor();await azDebtSave();toast(idx>=0?'Hutang dikemas kini.':'Hutang ditambah.');}
async function azDebtPay(id,amountOverride=0,noteOverride='',source='manual'){
  const d=azDebtFind(id);if(!d||d.balanceAvailable===false||azDebtNum(d.balance)<=0)return false;
  let amount=azDebtNum(amountOverride);
  if(!(amount>0)){
    const suggested=Math.max(azDebtNum(d.monthly),azDebtNum(d.currentDue));
    const raw=prompt(`Tolak / bayar untuk ${d.creditor} — ${d.title}\nBaki sekarang: ${azDebtMoney(d.balance)}\nDue: ${d.nextDue?azDebtDate(d.nextDue):'belum ditetapkan'}\n\nMasukkan jumlah (RM):`,suggested>0?String(suggested.toFixed(2)):'');
    if(raw===null)return false;amount=azDebtNum(String(raw).replace(/,/g,''));
    if(!(amount>0))return toast('Jumlah bayaran tidak sah.');
    if(amount>azDebtNum(d.balance)&&!confirm('Jumlah lebih besar daripada baki. Baki akan jadi RM0.00. Teruskan?'))return false;
  }
  const applied=Math.min(amount,azDebtNum(d.balance));
  d.balance=Math.max(0,azDebtNum(d.balance)-applied);d.status=d.balance<=0?'paid':'active';d.lastPaymentDate=azDebtToday();
  const fixedSchedule=(d.type==='vehicle'||d.type==='sloan')&&azDebtNum(d.monthly)>0;
  if(fixedSchedule&&applied>=azDebtNum(d.monthly)*0.8){
    const count=Math.max(1,Math.min(Math.max(1,Math.round(azDebtNum(d.remainingInstallments)||1)),Math.floor((applied+azDebtNum(d.monthly)*0.2)/azDebtNum(d.monthly))));
    if(azDebtNum(d.remainingInstallments)>0)d.remainingInstallments=Math.max(0,azDebtNum(d.remainingInstallments)-count);
    if(d.nextDue)d.nextDue=azDebtAddMonths(d.nextDue,count);
  }
  azDebtState.payments.unshift({id:'pay-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),debtId:d.id,creditor:d.creditor,title:d.title,amount:applied,direction:'decrease',atMs:Date.now(),source,note:noteOverride||(fixedSchedule?'Bayaran manual; due date dan baki ansuran tetap digerakkan automatik jika cukup satu ansuran.':'Bayaran / pelarasan manual.')});
  azDebtState.payments=azDebtState.payments.slice(0,300);await azDebtSave();if(!amountOverride)toast(`Baki ditolak ${azDebtMoney(applied)}. Baki baru ${azDebtMoney(d.balance)}.`);return true;
}
async function azDebtAddBalance(id){
  const d=azDebtFind(id);if(!d)return false;
  const raw=prompt(`Tambah hutang untuk ${d.creditor} — ${d.title}\nBaki sekarang: ${d.balanceAvailable!==false?azDebtMoney(d.balance):'belum dikesan'}\n\nMasukkan jumlah tambahan (RM):`,'');
  if(raw===null)return false;const amount=azDebtNum(String(raw).replace(/,/g,''));if(!(amount>0))return toast('Jumlah tambahan tidak sah.');
  const reason=prompt('Catatan (optional):','Tambah hutang / caj baru')||'Tambah hutang / caj baru';
  d.balanceAvailable=true;d.balance=Math.max(0,azDebtNum(d.balance))+amount;d.originalAmount=Math.max(0,azDebtNum(d.originalAmount))+amount;d.status='active';
  azDebtState.payments.unshift({id:'add-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),debtId:d.id,creditor:d.creditor,title:d.title,amount,direction:'increase',atMs:Date.now(),source:'manual-add',note:reason});
  azDebtState.payments=azDebtState.payments.slice(0,300);await azDebtSave();toast(`Hutang ditambah ${azDebtMoney(amount)}. Baki baru ${azDebtMoney(d.balance)}.`);return true;
}
async function azDebtUpdateDue(id,value){
  const d=azDebtFind(id);if(!d)return;const next=String(value||'').trim();d.nextDue=next;await azDebtSave();toast(next?`Due date ${d.title} ditukar ke ${azDebtDate(next)}.`:`Due date ${d.title} dikosongkan.`);
}
async function azDebtDelete(id){const d=azDebtFind(id);if(!d)return;if(d.managedSync)return azDebtResetSync(id);if(!confirm(`Delete rekod hutang ini?\n\n${d.creditor} — ${d.title}\nBaki: ${azDebtMoney(d.balance)}`))return;azDebtState.debts=(azDebtState.debts||[]).filter(x=>String(x.id)!==String(id));await azDebtSave();toast('Rekod hutang dibuang.');}
async function azDebtResetSync(id){const d=azDebtFind(id);if(!d||!d.managedSync)return;if(!confirm(`Reset link ${d.title}?\n\nData sync Shopee akan dibuang dan rekod ini kembali ke baseline manual v1314. Rekod payment history tidak dipadam.`))return;const seed=azDebtDefaultFinance(d.type);const i=azDebtState.debts.findIndex(x=>String(x.id)===String(id));azDebtState.debts[i]={...seed};await azDebtSave();toast(`${seed.title} sync direset ke baseline manual.`);}
function azDebtExportCsv(){if(!azDebtState)return;const rows=[['Type','Creditor','Description','Balance RM','Balance Available','Monthly RM','Current Due RM','Next Due','Principal RM','Interest %','Remaining Installments','Original Tenure','Late Charges RM','Last Payment','Linked','Last Sync','Note']];(azDebtState.debts||[]).forEach(d=>rows.push([azDebtTypeLabel(d.type),d.creditor,d.title,azDebtNum(d.balance).toFixed(2),d.balanceAvailable!==false?'Yes':'No',azDebtNum(d.monthly).toFixed(2),azDebtNum(d.currentDue).toFixed(2),d.nextDue||'',azDebtNum(d.principalBalance).toFixed(2),azDebtNum(d.interestRate).toFixed(2),d.remainingInstallments||'',d.originalTenure||'',azDebtNum(d.lateCharges).toFixed(2),d.lastPaymentDate||'',d.linked?'Yes':'No',d.lastSyncAtMs?new Date(d.lastSyncAtMs).toISOString():'',d.note||'']));const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='AZOBSS-Debt-Loan-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function azDebtBridgeMeta(){return document.getElementById(AZ_DEBT_SHOPEE_BRIDGE_ID);}
function azDebtRefreshBridgeStatus(){const n=document.getElementById('azDebtShopeeBridgeStatus');if(!n)return;const ready=azDebtBridgeMeta()?.getAttribute('data-extension')==='ready';n.textContent=ready?'Extension finance v1313 ready ✅':'Extension finance v1313 belum dikesan';n.classList.toggle('ready',ready);n.classList.toggle('wait',!ready);}
async function azDebtReadShopeeBridge(){azDebtRefreshBridgeStatus();const el=azDebtBridgeMeta();const raw=el?.getAttribute('data-payload')||'';if(!raw)return false;let data=null;try{data=JSON.parse(decodeURIComponent(raw));}catch(_e){return false;}if(!data||data.payloadType!=='finance')return false;const done=await azDebtApplyFinanceSnapshot(data);if(done)document.dispatchEvent(new Event(AZ_DEBT_SHOPEE_ACK_EVENT,{bubbles:true}));return done;}
function azDebtNormalizeDate(v){const s=String(v||'').trim();if(!s)return '';let m=s.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/);if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;m=s.match(/([0-3]?\d)[\/\-]([01]?\d)[\/\-](20\d{2})/);if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;const d=new Date(s);if(!Number.isNaN(d.getTime()))return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return '';}
function azDebtParseFinanceText(raw,forcedKind=''){const text=String(raw||'').replace(/\u00a0/g,' ').replace(/\r/g,'\n');const flat=text.replace(/[ \t]+/g,' ');const kind=forcedKind||(/\bS\s*Loan\b|SPay\s*Loan|Shopee\s*Loan/i.test(flat)?'sloan':(/SPay\s*Later|PayLater/i.test(flat)?'spaylater':''));if(!kind)return null;const money=(labels)=>{for(const label of labels){const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');let m=flat.match(new RegExp(esc+'[\\s\\S]{0,90}?(?:RM\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)','i'));if(m)return azDebtNum(m[1].replace(/,/g,''));m=flat.match(new RegExp('(?:RM\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)[\\s\\S]{0,45}?'+esc,'i'));if(m)return azDebtNum(m[1].replace(/,/g,''));}return null;};const date=(labels)=>{for(const label of labels){const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=flat.match(new RegExp(esc+'[\\s:–-]{0,30}([0-3]?\\d[\\/-][01]?\\d[\\/-]20\\d{2}|20\\d{2}[\\/-][01]?\\d[\\/-][0-3]?\\d|[0-3]?\\d\\s+[A-Za-z]{3,9}\\s+20\\d{2})','i'));if(m)return azDebtNormalizeDate(m[1]);}return '';};const num=(labels)=>{for(const label of labels){const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=flat.match(new RegExp(esc+'[^0-9]{0,30}(\\d{1,3})','i'));if(m)return parseInt(m[1],10);}return 0;};const balance=kind==='spaylater'?money(['Total Outstanding','Outstanding Balance','Total Balance','Jumlah Tertunggak','Baki Tertunggak','Total Amount Due']):money(['Outstanding Balance','Total Outstanding','Outstanding Amount','Remaining Balance','Baki Pinjaman','Loan Balance','Principal Outstanding']);const currentDue=money(['Current Bill','Current Due','Amount Due','Total Due','Bil Semasa','Jumlah Bil','Bayaran Bulan Ini','Next Payment Amount','Instalment Amount','Installment Amount']);const monthly=money(['Monthly Instalment','Monthly Installment','Instalment Amount','Installment Amount','Monthly Payment','Bayaran Bulanan']);const nextDue=date(['Due Date','Next Due','Payment Due Date','Tarikh Akhir Pembayaran','Tarikh Bayaran','Next Payment Due']);const remainingInstallments=num(['Remaining Installment','Remaining Instalment','Installments Remaining','Instalments Remaining','Baki Ansuran']);const usable=balance!==null||currentDue!==null||monthly!==null||!!nextDue||remainingInstallments>0;if(!usable)return null;const captureId='manual-'+azDebtHash(kind+'|'+flat.slice(0,6000));return {bridgeVersion:1313,payloadType:'finance',financeType:kind,balance:balance===null?null:balance,currentDue:currentDue===null?0:currentDue,monthly:monthly===null?0:monthly,nextDue,remainingInstallments,capturedAt:new Date().toISOString(),captureId,confidence:balance!==null?'manual-good':'manual-partial',source:'azobss-manual-paste'};}
async function azDebtApplyFinanceSnapshot(data){const kind=data?.financeType;if(!['spaylater','sloan'].includes(kind))return false;if(!azDebtState)azDebtState=azDebtReadLocal()||azDebtDefaultState();const id=kind==='spaylater'?'shopee-spaylater':'shopee-sloan';let d=azDebtFind(id);if(!d){d=azDebtDefaultFinance(kind);azDebtState.debts.push(d);}const captureId=String(data.captureId||azDebtHash(JSON.stringify(data)));if(d.lastCaptureId===captureId)return false;const oldKnown=d.balanceAvailable!==false,oldBalance=azDebtNum(d.balance);const newBalance=(data.balance===null||data.balance===undefined||data.balance==='')?null:Math.max(0,azDebtNum(data.balance));let autoPaid=0,changeNote='';if(newBalance!==null){if(d.linked&&oldKnown&&newBalance<oldBalance-0.009){autoPaid=oldBalance-newBalance;azDebtState.payments.unshift({id:'auto-'+Date.now()+'-'+captureId.slice(-6),debtId:d.id,creditor:d.creditor,title:d.title,amount:autoPaid,direction:'decrease',atMs:Date.now(),source:'shopee-reconcile',captureId,note:'Auto reconcile: baki Shopee turun '+azDebtMoney(autoPaid)});changeNote='Baki turun '+azDebtMoney(autoPaid)+' → auto payment direkod.';}else if(d.linked&&oldKnown&&newBalance>oldBalance+0.009){changeNote='Baki naik '+azDebtMoney(newBalance-oldBalance)+' (contoh pembelian/caj baru).';}else if(!d.linked||!oldKnown){changeNote='Initial balance linked.';}d.balance=newBalance;d.balanceAvailable=true;d.originalAmount=Math.max(azDebtNum(d.originalAmount),newBalance);d.status=newBalance<=0?'paid':'active';}
  if(azDebtNum(data.currentDue)>0)d.currentDue=Math.max(0,azDebtNum(data.currentDue));if(azDebtNum(data.monthly)>0)d.monthly=Math.max(0,azDebtNum(data.monthly));if(data.nextDue)d.nextDue=azDebtNormalizeDate(data.nextDue)||String(data.nextDue);if(azDebtNum(data.remainingInstallments)>0)d.remainingInstallments=Math.round(azDebtNum(data.remainingInstallments));d.linked=true;d.managedSync=true;d.syncProvider='shopee-browser';d.lastSyncAtMs=Date.now();d.lastCaptureId=captureId;d.syncConfidence=String(data.confidence||'captured');if(autoPaid>0)d.lastPaymentDate=azDebtToday();azDebtState.syncEvents.unshift({id:'sync-'+Date.now(),debtId:d.id,kind,captureId,atMs:Date.now(),oldBalance:oldKnown?oldBalance:null,newBalance,source:String(data.source||'shopee-browser'),note:changeNote});azDebtState.syncEvents=azDebtState.syncEvents.slice(0,200);azDebtState.payments=azDebtState.payments.slice(0,300);await azDebtSave();toast(autoPaid>0?`${d.title}: ${azDebtMoney(autoPaid)} auto ditolak selepas reconcile.`:`${d.title} synced${newBalance!==null?' — '+azDebtMoney(newBalance):''}.`);return true;}
async function azDebtManualParse(kind){const t=document.getElementById('azDebtShopeePaste')?.value||'';if(!t.trim())return toast('Paste teks ringkasan Shopee dahulu.');const data=azDebtParseFinanceText(t,kind);if(!data)return toast('Tak dapat kesan angka kewangan. Pastikan teks ada baki / current due / due date.');const ok=await azDebtApplyFinanceSnapshot(data);if(ok){const n=document.getElementById('azDebtShopeePaste');if(n)n.value='';}}
function azDebtOpenShopee(){window.open('https://shopee.com.my/','_blank','noopener,noreferrer');toast('Buka SPayLater / SLoan dalam Shopee web. Extension akan capture apabila ringkasan kewangan kelihatan.');}
function azDebtExtractBankAmount(line){const neg=[...String(line).matchAll(/(?:RM\s*)?-\s*([0-9][0-9,]*\.\d{2})/gi)];if(neg.length)return azDebtNum(neg[0][1].replace(/,/g,''));if(!/(?:debit|payment|bayar|paid|repayment)/i.test(line))return 0;const arr=[...String(line).matchAll(/(?:RM\s*)?([0-9][0-9,]*\.\d{2})/gi)].map(m=>azDebtNum(m[1].replace(/,/g,''))).filter(x=>x>0);return arr[0]||0;}
async function azDebtImportBankFile(file){if(!file)return;let txt='';try{txt=await file.text();}catch(_e){return toast('Tak dapat baca file bank.');}const lines=txt.split(/\r?\n/).filter(Boolean);let matched=0,skipped=0;azDebtState.bankImports=Array.isArray(azDebtState.bankImports)?azDebtState.bankImports:[];for(const line of lines){const key='bank-'+azDebtHash(line.trim());if(azDebtState.bankImports.includes(key)){skipped++;continue;}for(const d of (azDebtState.debts||[]).filter(x=>['spaylater','sloan'].includes(x.type)&&x.linked&&x.balanceAvailable!==false&&azDebtNum(x.balance)>0)){const kws=String(d.bankMatchKeywords||'').split('|').map(x=>x.trim()).filter(Boolean);if(!kws.length||!kws.some(k=>line.toUpperCase().includes(k.toUpperCase())))continue;const amount=azDebtExtractBankAmount(line);if(!(amount>0))continue;const applied=Math.min(amount,azDebtNum(d.balance));if(!(applied>0))continue;d.balance=Math.max(0,azDebtNum(d.balance)-applied);d.status=d.balance<=0?'paid':'active';d.lastPaymentDate=azDebtToday();azDebtState.payments.unshift({id:'bank-'+Date.now()+'-'+matched,debtId:d.id,creditor:d.creditor,title:d.title,amount:applied,direction:'decrease',atMs:Date.now(),source:'bank-csv-estimate',note:'Auto-match bank CSV (provisional; Shopee capture akan reconcile).'});azDebtState.bankImports.push(key);matched++;break;}}azDebtState.bankImports=azDebtState.bankImports.slice(-1000);azDebtState.payments=azDebtState.payments.slice(0,300);await azDebtSave();toast(matched?`${matched} transaksi bank auto-match. Baki provisional akan disahkan oleh Shopee capture.`:`Tiada transaksi SPayLater/SLoan yang match secara selamat.${skipped?' '+skipped+' rekod duplicate diabaikan.':''}`);}
function azDebtBind(){const root=document.getElementById('debtsloans');if(!root||root.dataset.bound==='1')return;root.dataset.bound='1';document.getElementById('azDebtAddNew')?.addEventListener('click',()=>{azDebtClearEditor();document.getElementById('azDebtEditorCard')?.scrollIntoView({behavior:'smooth',block:'start'});});document.getElementById('azDebtEditorClear')?.addEventListener('click',azDebtClearEditor);document.getElementById('azDebtSave')?.addEventListener('click',azDebtSaveEditor);document.getElementById('azDebtExportCsv')?.addEventListener('click',azDebtExportCsv);document.getElementById('azDebtPlannerMonths')?.addEventListener('change',async e=>{azDebtState.plannerMonths=Math.max(1,Math.min(120,parseInt(e.target.value||12,10)||12));await azDebtSave();});root.querySelectorAll('.az-debt-plan-preset').forEach(b=>b.addEventListener('click',async()=>{azDebtState.plannerMonths=Math.max(1,parseInt(b.dataset.months||12,10));await azDebtSave();}));root.addEventListener('click',e=>{const open=e.target.closest('[data-open-shopee]');if(open){azDebtOpenShopee();return;}const b=e.target.closest('[data-debt-action]');if(!b)return;const id=b.dataset.id;if(b.dataset.debtAction==='edit')azDebtEdit(id);else if(b.dataset.debtAction==='pay')azDebtPay(id);else if(b.dataset.debtAction==='add-balance')azDebtAddBalance(id);else if(b.dataset.debtAction==='delete')azDebtDelete(id);else if(b.dataset.debtAction==='reset-sync')azDebtResetSync(id);});root.addEventListener('change',e=>{const input=e.target.closest('[data-debt-due-input]');if(input)azDebtUpdateDue(input.dataset.id,input.value);});document.getElementById('azDebtClearHistory')?.addEventListener('click',async()=>{if(!azDebtState?.payments?.length)return;if(!confirm('Clear semua rekod bayaran? Baki hutang tidak berubah.'))return;azDebtState.payments=[];await azDebtSave();toast('Rekod bayaran dikosongkan.');});document.getElementById('azDebtParseSpay')?.addEventListener('click',()=>azDebtManualParse('spaylater'));document.getElementById('azDebtParseSloan')?.addEventListener('click',()=>azDebtManualParse('sloan'));document.getElementById('azDebtSyncNow')?.addEventListener('click',async()=>{const ok=await azDebtReadShopeeBridge();if(!ok)toast('Tiada capture finance baru. Buka halaman SPayLater/SLoan di Shopee web dahulu.');});document.getElementById('azDebtBankCsv')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f)await azDebtImportBankFile(f);e.target.value='';});document.addEventListener(AZ_DEBT_SHOPEE_READY_EVENT,()=>setTimeout(azDebtReadShopeeBridge,0));if(!azDebtBridgeTimer)azDebtBridgeTimer=setInterval(()=>{if(document.getElementById('debtsloans')?.classList.contains('active'))azDebtReadShopeeBridge();},1800);}
async function loadDebtsLoans(){if(!azDebtState)azDebtState=azDebtReadLocal()||azDebtDefaultState();azDebtState=azDebtSafeState(azDebtState);azDebtBind();azDebtRender();await azDebtLoadCloud();setTimeout(azDebtReadShopeeBridge,150);}

async function initSection(id){
  azAdminClearQueryErrors();
  if(id==='overview')return loadOverview();
  if(id==='users'){ return loadRegisteredUsersAdmin(); }
  if(id==='online')return loadOnline();
  if(id==='support')return loadSupport();
  if(id==='notifications')return loadNotifications();
  if(id==='adminalerts')return loadAdminPaymentAlerts();
  if(id==='debtsloans')return loadDebtsLoans();
  if(id==='purchases')return loadPurchases();
  if(id==='payments')return loadPayments();
  if(id==='salesreceipts'){
    const info=$('#salesReceiptResultInfo');
    if(typeof window.azSalesReceiptsLoad==='function')return window.azSalesReceiptsLoad();
    if(info)info.textContent='Loading Sales & Receipts module...';
    for(let attempt=0;attempt<100;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      if(typeof window.azSalesReceiptsLoad==='function')return window.azSalesReceiptsLoad();
    }
    if(info)info.textContent='Sales & Receipts module failed to load. Press Ctrl + F5 and open this section again.';
    return;
  }
  if(id==='activity')return loadAdminActivity();
  if(id==='commissions')return Promise.all([loadAdminCommissions(),loadAdminPayoutRequests(),loadAdminPayoutGatewayStatus()]);
  if(id==='salesstaffapps' && typeof window.azSalesStaffApplicationsLoad==='function') return window.azSalesStaffApplicationsLoad();
  if(id==='auditlogs')return loadAdminAuditLogs();
  if(id==='exports'){ const n=$('#adminExportNotice'); if(n) n.textContent='Choose a report, then download. All export requests are recorded in Audit Logs.'; return; }
  if(id==='systemhealth')return loadSystemHealth();
  if(id==='frontendcheck')return;
  if(id==='sitereport')return azAdminInitSiteReport();
  if(id==='maintenance')return loadMaintenanceScan();
  if(id==='staffroles')return loadStaffRoles();
  if(id==='softwarekeys'){if(typeof window.azSoftwareKeyTabsLoad==='function')return window.azSoftwareKeyTabsLoad();if(typeof window.azSoftwareKeysLoad==='function')return window.azSoftwareKeysLoad({force:false});}
  if(id==='membership')return loadMembershipPackagesAdmin(true);
  if(id==='settings')return loadSettings();
}
document.addEventListener('click',async e=>{
  const serviceBookingsShortcut=e.target.closest('#salesReceiptServiceBookingsShortcut');
  if(serviceBookingsShortcut){
    const serviceBookingsNav=document.querySelector('.sidebar .nav [data-tab="servicebookings"]');
    if(serviceBookingsNav)serviceBookingsNav.click();
    return;
  }
  const tab=e.target.closest('[data-tab]');
  if(tab){
    const id=String(tab.dataset.tab||'');
    const parentMap={
      salesreceipts:'salesreceipts',payments:'salesreceipts',purchases:'salesreceipts',adminalerts:'salesreceipts',debtsloans:'salesreceipts',
      users:'users',online:'users',staffroles:'users',
      activity:'activity',auditlogs:'activity',
      systemhealth:'systemhealth',frontendcheck:'systemhealth',sitereport:'systemhealth'
    };
    const parent=parentMap[id]||id;
    document.querySelectorAll('.sidebar .nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===parent));
    document.querySelectorAll('.az-admin-subtabs [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    document.querySelectorAll('.section').forEach(sec=>sec.classList.remove('active'));
    const section=$('#'+id);
    if(section)section.classList.add('active');
    await initSection(id);
    return;
  }
  const overviewLoadButton=e.target.closest('#loadOverviewData');
  if(overviewLoadButton){
    if(overviewLoadButton.disabled)return;
    overviewLoadButton.disabled=true;
    const oldText=overviewLoadButton.textContent;
    overviewLoadButton.textContent='⏳ Loading Overview…';
    try{
      await loadOverview(true);
    }catch(error){
      console.error('Manual Overview load failed:',error);
      const notice=$('#overviewLoadNotice');
      if(notice)notice.textContent='Overview could not be loaded. Check quota/backend, then press the button again.';
      toast('Overview load failed. Check Firestore quota or backend.');
    }finally{
      overviewLoadButton.disabled=false;
      overviewLoadButton.textContent=oldText||'📥 Load Dashboard Data';
    }
    return;
  }
  if(!e.target.closest('.az1367-action-wrap'))azRegCloseActionMenus();
  const regMenuToggle=e.target.closest('[data-reg-menu-toggle]');
  if(regMenuToggle){
    const wrap=regMenuToggle.closest('.az1367-action-wrap');
    const opening=!wrap?.classList.contains('is-open');
    azRegCloseActionMenus(wrap);
    wrap?.classList.toggle('is-open',opening);
    wrap?.closest('.az1367-email-card')?.classList.toggle('is-menu-open',opening);
    regMenuToggle.setAttribute('aria-expanded',opening?'true':'false');
    return;
  }
  const regFoodAccess=e.target.closest('[data-reg-food-access]');
  if(regFoodAccess){await toggleRegisteredFoodOrderAccess(regFoodAccess.getAttribute('data-reg-food-access'));return;}
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
  const alertRead=e.target.closest('[data-admin-alert-read]');
  if(alertRead){await azAdminPaymentAlertAction('mark-read',alertRead.getAttribute('data-admin-alert-read'));return;}
  const payDetail=e.target.closest('[data-paylog-detail]');
  if(payDetail){azAdminOpenPaymentLogDetail(payDetail.getAttribute('data-paylog-detail'));return;}
  const payReceipt=e.target.closest('[data-paylog-receipt]');
  if(payReceipt){await azAdminOpenPaymentReceipt(payReceipt.getAttribute('data-paylog-receipt'), payReceipt.getAttribute('data-format')||'html', payReceipt.getAttribute('data-download')==='1');return;}
  const payEmailReceipt=e.target.closest('[data-paylog-email-receipt]');
  if(payEmailReceipt){await azAdminEmailPaymentReceipt(payEmailReceipt.getAttribute('data-paylog-email-receipt'));return;}
  const closePayDetail=e.target.closest('[data-close-payment-detail]');
  if(closePayDetail){azAdminClosePaymentLogDetail();return;}
  const close1198=e.target.closest('[data-az1198-close-drawer]');if(close1198){az1198CloseDrawers();return;}
  const staffDrawerBtn=e.target.closest('[data-commission-staff-drawer]');if(staffDrawerBtn){az1198OpenStaffDrawer(staffDrawerBtn.getAttribute('data-commission-staff-drawer'));return;}
  const payoutDrawerBtn=e.target.closest('[data-payout-drawer]');if(payoutDrawerBtn){az1198OpenPayoutDrawer(payoutDrawerBtn.getAttribute('data-payout-drawer'));return;}
  const payoutViewBtn=e.target.closest('[data-payout-view]');if(payoutViewBtn){const v=payoutViewBtn.getAttribute('data-payout-view')||'needs_action';if($('#payoutRequestFilter'))$('#payoutRequestFilter').value=v;renderAdminPayoutRequests();return;}
  const payoutBulkBtn=e.target.closest('[data-payout-bulk]');if(payoutBulkBtn){await az1198BulkPayoutStatus(payoutBulkBtn.getAttribute('data-payout-bulk'));return;}
  if(e.target.closest('[data-payout-bulk-clear]')){document.querySelectorAll('[data-payout-select]').forEach(c=>c.checked=false);az1198UpdatePayoutSelection();return;}
  const comDetailBtn = e.target.closest('[data-commission-detail]');
  if(comDetailBtn){azAdminOpenCommissionDetail(comDetailBtn.getAttribute('data-commission-detail'));return;}
  const closeComDetail=e.target.closest('[data-close-commission-detail]');
  if(closeComDetail){azAdminCloseCommissionDetail();return;}
  const comBulkBtn=e.target.closest('[data-commission-bulk]');
  if(comBulkBtn){await azAdminBulkCommissionStatus(comBulkBtn.getAttribute('data-commission-bulk'));return;}
  const payoutReceiptBtn = e.target.closest('[data-payout-receipt]');
  if(payoutReceiptBtn){await viewAdminPayoutReceipt(payoutReceiptBtn.getAttribute('data-payout-receipt'));return;}
  const bankPayBtn=e.target.closest('[data-payout-pay-bank]');
  if(bankPayBtn){await payPayoutRequestToBank(bankPayBtn.getAttribute('data-payout-pay-bank'));return;}
  const bankSyncBtn=e.target.closest('[data-payout-sync-bank]');
  if(bankSyncBtn){await syncPayoutBankStatus(bankSyncBtn.getAttribute('data-payout-sync-bank'));return;}
  const payoutQrViewBtn=e.target.closest('[data-payout-qr-view]');
  if(payoutQrViewBtn){openAdminPayoutQrModal(payoutQrViewBtn.getAttribute('data-payout-qr-view'),false);return;}
  const payoutQrEditBtn=e.target.closest('[data-payout-qr-edit]');
  if(payoutQrEditBtn){openAdminPayoutQrModal(payoutQrEditBtn.getAttribute('data-payout-qr-edit'),true);return;}
  if(e.target.closest('[data-payout-qr-close]')){closeAdminPayoutQrModal();return;}
  if(e.target.closest('[data-payout-qr-cancel-edit]')){cancelAdminPayoutQrEdit();return;}
  if(e.target.closest('[data-payout-qr-remove]')){await saveAdminPayoutQr(true);return;}
  if(e.target.closest('[data-payout-qr-save]')){await saveAdminPayoutQr(false);return;}
  const payoutCopyBtn=e.target.closest('[data-payout-copy-details]');
  if(payoutCopyBtn){await copyAdminPayoutDetails(payoutCopyBtn.getAttribute('data-payout-copy-details'));return;}
  const payoutReqBtn = e.target.closest('[data-payout-request-status]');
  if(payoutReqBtn){await updatePayoutRequestStatus(payoutReqBtn.getAttribute('data-payout-request-id'), payoutReqBtn.getAttribute('data-payout-request-status'));return;}
  const payoutBtn = e.target.closest('[data-commission-payout]');
  if(payoutBtn){await updateCommissionPayoutStatus(payoutBtn.getAttribute('data-commission-doc'), payoutBtn.getAttribute('data-commission-payout'));return;}
  const editBtn = e.target.closest('[data-edit-commission]');
  if(editBtn){editCommissionRecord(editBtn.getAttribute('data-edit-commission'));return;}
  const adjustBtn = e.target.closest('[data-adjust-commission]');
  if(adjustBtn){beginCommissionAdjustment(adjustBtn.getAttribute('data-adjust-commission'));return;}
  const voidBtn = e.target.closest('[data-void-commission]');
  if(voidBtn){await voidCommissionRecord(voidBtn.getAttribute('data-void-commission'));return;}
  const staffModeBtn=e.target.closest('[data-commission-staff-mode]');
  if(staffModeBtn){e.stopPropagation();az1192SetCommissionContext(staffModeBtn.getAttribute('data-commission-staff-name')||'',staffModeBtn.getAttribute('data-commission-staff-mode')||'overview');return;}
  const contextModeBtn=e.target.closest('[data-commission-context-mode]');
  if(contextModeBtn){az1192SetCommissionContext(az1192CommissionStaffContext||$('#commissionStaffFilter')?.value||'',contextModeBtn.getAttribute('data-commission-context-mode')||'overview');return;}
  const contextClearBtn=e.target.closest('[data-commission-context-clear]');
  if(contextClearBtn){az1192ClearCommissionContext();return;}
  const payoutCommissionBtn=e.target.closest('[data-payout-open-commission]');
  if(payoutCommissionBtn){az1192SetCommissionContext(payoutCommissionBtn.getAttribute('data-payout-open-commission')||'','payout');return;}
  const staffFocusBtn = e.target.closest('[data-commission-staff-focus]');
  if(staffFocusBtn){const v=staffFocusBtn.getAttribute('data-commission-staff-focus')||'';az1192SetCommissionContext(v,'overview');return;}
});


$('#refreshOnline').addEventListener('click',loadOnline);
$('#refreshSupport').addEventListener('click',loadSupport);
$('#publishNotif').addEventListener('click',publishNotification);
$('#clearNotif').addEventListener('click',clearNotifications);
$('#refreshAdminPaymentAlerts')?.addEventListener('click',loadAdminPaymentAlerts);
$('#adminPaymentAlertFilter')?.addEventListener('change',renderAdminPaymentAlerts);
$('#adminPaymentAlertSearch')?.addEventListener('input',()=>{clearTimeout(window.azPaymentAlertSearchTimer);window.azPaymentAlertSearchTimer=setTimeout(renderAdminPaymentAlerts,160);});
$('#markAllAdminPaymentAlertsRead')?.addEventListener('click',()=>azAdminPaymentAlertAction('mark-all-read'));
$('#clearReadAdminPaymentAlerts')?.addEventListener('click',()=>{if(confirm('Clear all read payment alerts?')) azAdminPaymentAlertAction('clear-read');});
// AZOBSS PATCH 384: default Sales Overview to Paid/Verified Only.
// Some browsers restore old select state, so force this tab's default on fresh admin load.
if($('#paymentCategoryFilter')) $('#paymentCategoryFilter').value='paid';
$('#refreshPayments')?.addEventListener('click',()=>loadPayments(true));
$('#paymentCategoryFilter')?.addEventListener('change',loadPayments);
$('#refreshPaymentLogs')?.addEventListener('click',loadPurchases);
$('#paymentLogsCategoryFilter')?.addEventListener('change',loadPurchases);
$('#paymentLogsStatusFilter')?.addEventListener('change',loadPurchases);
$('#paymentLogsDateFilter')?.addEventListener('change',()=>{azAdminSetPaymentLogCustomDateState();loadPurchases();});
$('#paymentLogsDateFrom')?.addEventListener('change',loadPurchases);
$('#paymentLogsDateTo')?.addEventListener('change',loadPurchases);
$('#clearPaymentLogsFilters')?.addEventListener('click',()=>{
  if($('#paymentLogsSearch')) $('#paymentLogsSearch').value='';
  if($('#paymentLogsCategoryFilter')) $('#paymentLogsCategoryFilter').value='all';
  if($('#paymentLogsStatusFilter')) $('#paymentLogsStatusFilter').value='all';
  if($('#paymentLogsDateFilter')) $('#paymentLogsDateFilter').value='all';
  if($('#paymentLogsDateFrom')) $('#paymentLogsDateFrom').value='';
  if($('#paymentLogsDateTo')) $('#paymentLogsDateTo').value='';
  azAdminSetPaymentLogCustomDateState();
  loadPurchases();
});
$('#exportPaymentLogsCsv')?.addEventListener('click',azAdminExportPaymentLogsCsv);
$('#paymentLogsSelectAllFiltered')?.addEventListener('change',e=>{
  const checked = !!e.target.checked;
  const rows = Array.isArray(window.azAdminPaymentLogsFiltered) ? window.azAdminPaymentLogsFiltered : [];
  const wanted = new Set(rows.map(x=>window.azAdminPaymentLogsKeyByStableId?.[azAdminPaymentLogStableId(x)]).filter(Boolean));
  document.querySelectorAll('.az-paylog-select').forEach(cb=>{ cb.checked = checked && wanted.has(cb.getAttribute('data-paylog-select')); });
  azAdminUpdatePaymentLogSelectionUI();
});
document.getElementById('purchaseLogsList')?.addEventListener('change',e=>{
  if(e.target && e.target.classList && e.target.classList.contains('az-paylog-select')) azAdminUpdatePaymentLogSelectionUI();
});
$('#deleteSelectedPaymentLogs')?.addEventListener('click',()=>azAdminDeleteSelectedPaymentLogs('selected'));
$('#clearPendingPaymentLogs')?.addEventListener('click',()=>azAdminDeleteSelectedPaymentLogs('pending'));
$('#clearCancelledPaymentLogs')?.addEventListener('click',()=>azAdminDeleteSelectedPaymentLogs('cancelled'));
$('#clearFailedPaymentLogs')?.addEventListener('click',()=>azAdminDeleteSelectedPaymentLogs('failed'));
$('#paymentLogsSearch')?.addEventListener('input',()=>{ clearTimeout(window.azPaymentLogsSearchTimer); window.azPaymentLogsSearchTimer=setTimeout(loadPurchases,180); });
$('#saveStaffRole')?.addEventListener('click',saveStaffRole);
$('#registeredUsersSearch')?.addEventListener('input',()=>{adminRegisteredUsersPage=1;renderRegisteredUsersAdmin();});
$('#registeredUsersSort')?.addEventListener('change',()=>{adminRegisteredUsersPage=1;renderRegisteredUsersAdmin();});
$('#registeredUsersRefreshBtn')?.addEventListener('click',loadRegisteredUsersAdmin);
$('#registeredUsersPrevBtn')?.addEventListener('click',()=>{adminRegisteredUsersPage--;renderRegisteredUsersAdmin();});
$('#registeredUsersNextBtn')?.addEventListener('click',()=>{adminRegisteredUsersPage++;renderRegisteredUsersAdmin();});
$('#azRegCancelBtn')?.addEventListener('click',()=>$('#azRegEditModal')?.classList.remove('is-open'));
$('#azRegSaveBtn')?.addEventListener('click',saveRegisteredEdit);
$('#azRegMembershipGrantBtn')?.addEventListener('click',()=>azRegMembershipAdminAction('grant'));
$('#azRegMembershipEndBtn')?.addEventListener('click',()=>azRegMembershipAdminAction('revoke'));
function syncCommissionAdjustmentFromPercent(){const sale=Number($('#commissionSaleAmount')?.value||0)||0,pct=Number($('#commissionPercent')?.value||0)||0;if($('#commissionAmount')&&sale>0)$('#commissionAmount').value=(sale*pct/100).toFixed(2);}
function syncCommissionAdjustmentPercentFromAmount(){const sale=Number($('#commissionSaleAmount')?.value||0)||0,amt=Number($('#commissionAmount')?.value||0)||0;if($('#commissionPercent'))$('#commissionPercent').value=sale?((amt/sale)*100).toFixed(2):'';}
$('#commissionPercent')?.addEventListener('input',syncCommissionAdjustmentFromPercent);$('#commissionSaleAmount')?.addEventListener('input',()=>{if(String($('#commissionPercent')?.value||'').trim())syncCommissionAdjustmentFromPercent();});$('#commissionAmount')?.addEventListener('input',syncCommissionAdjustmentPercentFromAmount);
$('#saveCommissionRecord')?.addEventListener('click', saveCommissionRecord);
$('#resetCommissionForm')?.addEventListener('click', resetCommissionForm);
$('#refreshCommissionRecords')?.addEventListener('click', loadAdminCommissions);
$('#commissionPayoutFilter')?.addEventListener('change', renderAdminCommissions);
$('#commissionTypeFilter')?.addEventListener('change', renderAdminCommissions);
$('#commissionSourceFilter')?.addEventListener('change', renderAdminCommissions);
$('#commissionMonthFilter')?.addEventListener('change', ()=>{azAdminSetCommissionDateState();renderAdminCommissions();});
$('#commissionDateFrom')?.addEventListener('change', renderAdminCommissions);
$('#commissionDateTo')?.addEventListener('change', renderAdminCommissions);
$('#commissionSearch')?.addEventListener('input',()=>{clearTimeout(azCommissionSearchTimer);azCommissionSearchTimer=setTimeout(renderAdminCommissions,160);});
$('#commissionStaffFilter')?.addEventListener('input',()=>{clearTimeout(azCommissionSearchTimer);azCommissionSearchTimer=setTimeout(renderAdminCommissions,160);});
$('#commissionProductFilter')?.addEventListener('input',()=>{clearTimeout(azCommissionSearchTimer);azCommissionSearchTimer=setTimeout(renderAdminCommissions,160);});
$('#commissionMinAmount')?.addEventListener('input',()=>{clearTimeout(azCommissionSearchTimer);azCommissionSearchTimer=setTimeout(renderAdminCommissions,160);});
$('#commissionMaxAmount')?.addEventListener('input',()=>{clearTimeout(azCommissionSearchTimer);azCommissionSearchTimer=setTimeout(renderAdminCommissions,160);});
$('#clearCommissionFilters')?.addEventListener('click', clearCommissionFilters);
$('#retryCommissionOrder')?.addEventListener('click', retryCommissionForOrder);
$('#runCommissionAudit')?.addEventListener('click', runCommissionAudit);
$('#selectAllVisibleCommissions')?.addEventListener('click',()=>{document.querySelectorAll('[data-commission-select]:not(:disabled)').forEach(el=>{if(el.closest('.az1198-table-row')?.style.display!=='none')el.checked=true;});azAdminUpdateCommissionSelectedInfo();});
$('#clearSelectedCommissions')?.addEventListener('click',()=>{document.querySelectorAll('[data-commission-select]').forEach(el=>{el.checked=false;});azAdminUpdateCommissionSelectedInfo();});
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-commission-select]')) azAdminUpdateCommissionSelectedInfo();});
$('#payoutRequestFilter')?.addEventListener('change', renderAdminPayoutRequests);
$('#commissionStaffTableSearch')?.addEventListener('input',()=>{clearTimeout(window.az1198StaffTimer);window.az1198StaffTimer=setTimeout(()=>azRenderCommissionStaffSummary(adminCommissionFilteredCache),120);});
$('#commissionStaffTableStatus')?.addEventListener('change',()=>azRenderCommissionStaffSummary(adminCommissionFilteredCache));
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-payout-select]'))az1198UpdatePayoutSelection();});
$('#payoutRequestStaffFilter')?.addEventListener('input',()=>{clearTimeout(window.az1192PayoutStaffTimer);window.az1192PayoutStaffTimer=setTimeout(renderAdminPayoutRequests,160);});
$('#refreshPayoutRequestsAdmin')?.addEventListener('click', loadAdminPayoutRequests);
$('#refreshPayoutGateway')?.addEventListener('click', loadAdminPayoutGatewayStatus);
$('#exportCommissionCsv')?.addEventListener('click', exportCommissionCsv);
$('#refreshAuditLogs')?.addEventListener('click', loadAdminAuditLogs);
$('#downloadAdminExport')?.addEventListener('click', ()=>downloadAdminExport(false));
$('#downloadAdminExportAll')?.addEventListener('click', ()=>downloadAdminExport(true));
$('#refreshSystemHealth')?.addEventListener('click', loadSystemHealth);
$('#refreshMaintenanceScan')?.addEventListener('click', loadMaintenanceScan);
$('#runMaintenanceAction')?.addEventListener('click', runMaintenanceAction);
$('#runWebsiteReport')?.addEventListener('click', runWebsiteHealthReport);
$('#copyWebsiteReport')?.addEventListener('click', copyWebsiteReport);
$('#downloadWebsiteReportTxt')?.addEventListener('click', downloadWebsiteReportTxt);
$('#downloadWebsiteReportJson')?.addEventListener('click', downloadWebsiteReportJson);
$('#downloadWebsiteReportCsv')?.addEventListener('click', downloadWebsiteReportCsv);
$('#printWebsiteReport')?.addEventListener('click', printWebsiteReport);
$('#saveAdminApiKeyLocal')?.addEventListener('click',()=>azAdminSaveApiKey('local'));
$('#saveAdminApiKeySession')?.addEventListener('click',()=>azAdminSaveApiKey('session'));
$('#clearAdminApiKey')?.addEventListener('click',azAdminClearApiKey);
$('#testAdminApiKey')?.addEventListener('click',azAdminTestApiKey);
$('#runAdminFrontendDiagnostics')?.addEventListener('click',runAdminFrontendDiagnostics);
$('#clearAdminFrontendDiagnostics')?.addEventListener('click',clearAdminFrontendDiagnostics);
azAdminRenderApiKeyStatus();

// AZOBSS PATCH 386: prevent admin dashboard from staying forever at "Checking admin access..."
function azAdminPromiseTimeout(promise, ms, label='request'){
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms))
  ]);
}
let azAdminAuthResolved = false;
const azAdminAuthWatchdog = setTimeout(() => {
  if(azAdminAuthResolved) return;
  const st = $('#loginState');
  if(st){
    st.innerHTML = 'Admin access check is taking too long.<br><br>Try open <b>https://www.azobss.com/admin/</b>, refresh, or login again from main website.';
  }
}, 12000);

onAuthStateChanged(auth, async user => {
  try{
    currentUser = user;
    if(!user){
      azAdminAuthResolved = true;
      clearTimeout(azAdminAuthWatchdog);
      const st=$('#loginState');
      if(st) st.textContent='Please login as admin from main website first.';
      return;
    }

    const st=$('#loginState');
    if(st) st.textContent='Checking admin profile...';

    try{
      adminProfile = await azAdminPromiseTimeout(getAdminProfile(user), 12000, 'Admin profile check');
    }catch(profileErr){
      console.warn('[AZOBSS admin] profile check slow/failed:', profileErr);
      adminProfile = null;
    }

    // Owner email may pass even if profile lookup is slow.
    if(!isAdminUser()){
      azAdminAuthResolved = true;
      clearTimeout(azAdminAuthWatchdog);
      const st2=$('#loginState');
      if(st2) st2.textContent='Access denied. Admin only.';
      return;
    }

    azAdminAuthResolved = true;
    clearTimeout(azAdminAuthWatchdog);
    $('#loginCover')?.classList.add('hidden');
    $('#adminName').textContent=adminProfile?.username||adminProfile?.name||user.email||'Admin';
    $('#adminAvatar').textContent=($('#adminName').textContent||'Z').slice(0,1).toUpperCase();
    azAdminPrepareOverviewManualMode();
    let az1192Target='salesreceipts';
    try{
      const requested=String(new URL(location.href).searchParams.get('tab')||'').trim().toLowerCase();
      const allowed=new Set(['salesreceipts','users','overview','support','servicebookings','notifications','commissions','salesstaffapps','subscriptions','membership','softwarekeys','activity','exports','systemhealth','maintenance','settings','online','staffroles','auditlogs','payments','purchases','adminalerts','frontendcheck','sitereport']);
      if(allowed.has(requested)) az1192Target=requested;
    }catch(_e){}
    const targetBtn=[...document.querySelectorAll('[data-tab="'+az1192Target+'"]')][0];
    if(targetBtn) targetBtn.click(); else await initSection(az1192Target);
  }catch(e){
    azAdminAuthResolved = true;
    clearTimeout(azAdminAuthWatchdog);
    console.error('[AZOBSS admin] access check failed:', e);
    const st=$('#loginState');
    if(st) st.innerHTML='Admin access check failed.<br><br>Please refresh or login again as admin.';
  }
}, err => {
  azAdminAuthResolved = true;
  clearTimeout(azAdminAuthWatchdog);
  console.error('[AZOBSS admin] auth listener failed:', err);
  const st=$('#loginState');
  if(st) st.innerHTML='Firebase admin login check failed.<br><br>Please refresh or login again.';
});
