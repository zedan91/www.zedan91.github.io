import { getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { applyPriceAdjustment, formatAdjustedMoney, getCachedPriceAdjustment, waitForPriceAdjustment } from './azobss-user-price-adjustment.js?v=593';

const BACKEND = String(window.AZOBSS_BACKEND_URL || (/^(?:localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin : 'https://azobss-backend.onrender.com')).replace(/\/+$/, '');
const BASE_PRICE_SEN = 3000;
let priceAdjustmentPercent = Number(getCachedPriceAdjustment('publicPa').percent || 0);
function currentPrice(){ return applyPriceAdjustment(BASE_PRICE_SEN/100, priceAdjustmentPercent); }
function currentPriceSen(){ return Math.round(currentPrice()*100); }
function currentPriceText(){ return formatAdjustedMoney(currentPrice()); }
const MYLOT_BASE = 'https://jupem2u.kul.jupem.gov.my/mylot/negeri.html';
const states = new Set(['JOHOR','KEDAH','KELANTAN','MELAKA','NEGERI SEMBILAN','PAHANG','PERAK','PERLIS','PULAU PINANG','SABAH','SARAWAK','SELANGOR','TERENGGANU','WILAYAH PERSEKUTUAN KUALA LUMPUR','WILAYAH PERSEKUTUAN LABUAN','WILAYAH PERSEKUTUAN PUTRAJAYA']);
let verifiedKey = '';
let verifyingReturn = false;
let myLotLastAutoKey = '';
let myLotCurrentUrl = MYLOT_BASE;
let myLotCurrentPayload = null;

const $ = (id) => document.getElementById(id);
function cleanPa(v){ return String(v||'').toUpperCase().replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'').slice(0,12); }
function cleanPhone(v){ return String(v||'').replace(/[^0-9+]/g,'').slice(0,20); }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); }
function currentSavedUser(){ try{return typeof window.getSavedUser==='function' ? (window.getSavedUser()||null) : JSON.parse(localStorage.getItem('azobssCurrentUser')||'null');}catch(_){return null;} }
function roleKey(user){ return String(user?.role||user?.userRole||user?.accountRole||'').toLowerCase().replace(/[\s_-]+/g,''); }
function userKey(user){ return String(user?.usernameKey||user?.username||user?.name||(user?.email?String(user.email).split('@')[0]:'')||'').trim().toLowerCase(); }
function isAdminUser(user){ const r=roleKey(user), key=userKey(user), email=String(user?.email||user?.authEmail||'').trim().toLowerCase(); return !!(user && (r==='admin' || key==='zedan91' || key==='zedan9107' || email==='zedan91@azobss.local' || email==='zedan9107@gmail.com')); }
function isStaffish(user){ const r=roleKey(user); return r.includes('staff') || r==='semiadmin' || r==='admin'; }
function isRestricted(user){ if(isAdminUser(user)) return false; try{ if(user && typeof window.azobssHasPaBmAccess==='function' && window.azobssHasPaBmAccess(user)) return true; }catch(_){} return !!(user && isStaffish(user)); }
function showStatus(type,text){ const el=$('publicPaStatus'); if(!el)return; el.className='public-pa-status show '+type; el.textContent=text; }
function applyDisplayedPrice(){ const text=currentPriceText(); const pay=$('publicPaPayButton'); if(pay)pay.textContent='Bayar '+text+' melalui FPX'; document.querySelectorAll('.public-pa-price strong').forEach(el=>el.textContent=text); const span=document.querySelector('.public-pa-price span'); if(span)span.textContent=priceAdjustmentPercent?('Harga khas akaun anda ('+(priceAdjustmentPercent<0?'':'+')+priceAdjustmentPercent+'%)'):'Harga tetap pada sistem pembayaran'; }
function showMyLotStatus(type,text){ const el=$('publicPaMyLotStatus'); if(!el)return; if(!text){el.className='public-pa-coordinate-status';el.textContent='';return;} el.className='public-pa-coordinate-status show '+type; el.textContent=text; }
function parseCoordinates(value){
  const raw=String(value||'').trim().replace(/[º°]/g,' ');
  if(!raw)return null;
  const matches=raw.match(/[-+]?\d{1,3}(?:\.\d+)?/g);
  if(!matches||matches.length<2)return null;
  let lat=Number(matches[0]),lng=Number(matches[1]);
  if(Math.abs(lat)>90&&Math.abs(lng)<=90){const swap=lat;lat=lng;lng=swap;}
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  return {lat:Number(lat.toFixed(7)),lng:Number(lng.toFixed(7))};
}
function myLotPayload(){ return {coords:parseCoordinates($('publicPaCoordinates')?.value)}; }
function buildMyLotUrl(payload){
  const {coords}=payload;
  const url=new URL(MYLOT_BASE);
  const lat=String(coords.lat),lng=String(coords.lng),coordinate=`${lat},${lng}`;
  [['lat',lat],['latitude',lat],['lng',lng],['lon',lng],['longitude',lng],['q',coordinate],['coordinate',coordinate],['zoom','19']].forEach(([key,value])=>url.searchParams.set(key,value));
  url.hash=`lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&zoom=19`;
  return url.toString();
}
function validateMyLotPayload(payload,{quiet=false}={}){
  if(!payload.coords){if(!quiet)showMyLotStatus('info','Masukkan koordinat lengkap, contoh: 3.139003, 101.686855');return false;}
  return true;
}
function updateMyLotButton(){ const payload=myLotPayload(),button=$('publicPaOpenMyLotButton'); const valid=validateMyLotPayload(payload,{quiet:true}); if(button)button.disabled=!valid; return {payload,valid}; }
function postCoordinateToMyLot(){
  const frame=$('publicPaMyLotFrame');
  if(!frame?.contentWindow||!myLotCurrentPayload)return;
  const {coords}=myLotCurrentPayload;
  const messages=[
    {type:'AZOBSS_MYLOT_COORDINATE',lat:coords.lat,lng:coords.lng,latitude:coords.lat,longitude:coords.lng,zoom:19},
    {type:'SET_COORDINATE',latitude:coords.lat,longitude:coords.lng,zoom:19},
    {action:'searchCoordinate',lat:coords.lat,lon:coords.lng,zoom:19}
  ];
  messages.forEach(message=>{try{frame.contentWindow.postMessage(message,'https://jupem2u.kul.jupem.gov.my');}catch(_){}});
}
function openMyLotFloat(){
  myLotCurrentPayload=null;
  myLotCurrentUrl=MYLOT_BASE;
  const modal=$('publicPaMyLotModal'),frame=$('publicPaMyLotFrame');
  if($('publicPaMyLotSummary'))$('publicPaMyLotSummary').textContent='Carian lokasi dan lot';
  if(frame){frame.classList.remove('is-loaded');frame.src=myLotCurrentUrl;}
  if(modal)modal.hidden=false;
  document.body.classList.add('public-pa-mylot-open');
}
function closeMyLotFloat(){ const modal=$('publicPaMyLotModal'),frame=$('publicPaMyLotFrame'); if(modal)modal.hidden=true; if(frame){frame.src='about:blank';frame.classList.remove('is-loaded');} document.body.classList.remove('public-pa-mylot-open'); }
function handleCoordinateInput(){
  const {payload,valid}=updateMyLotButton();
  const raw=String($('publicPaCoordinates')?.value||'').trim();
  if(!raw){showMyLotStatus('','');return;}
  if(!payload.coords){showMyLotStatus('info','Lengkapkan koordinat dalam format latitud, longitud.');return;}
  if(valid)showMyLotStatus('info','Koordinat sah. Tekan Enter atau butang Buka MyLot.');
}
function handleCoordinateKeydown(event){
  if(event.key!=='Enter')return;
  event.preventDefault();
  event.stopPropagation();
  openMyLotFloat({automatic:false});
}

function setBusy(busy,text=''){ const check=$('publicPaCheckButton'),pay=$('publicPaPayButton'),test=$('publicPaTestPaymentButton'); if(check)check.disabled=busy; if(pay)pay.disabled=busy || !verifiedKey; if(test)test.disabled=busy || !verifiedKey; if(text)showStatus('info',text); }
function formData(){ return { paNumber:cleanPa($('publicPaNumber')?.value), negeri:String($('publicPaState')?.value||'').trim().toUpperCase(), buyerName:String($('publicPaName')?.value||'').trim(), buyerEmail:String($('publicPaEmail')?.value||'').trim().toLowerCase(), buyerPhone:cleanPhone($('publicPaPhone')?.value) }; }
function validatePa(data){ if(!/^\d{1,12}$/.test(data.paNumber)) throw new Error('Masukkan nombor PA yang sah.'); if(!states.has(data.negeri)) throw new Error('Pilih negeri yang sah.'); }
function validate(data){ validatePa(data); if(data.buyerName.length<2) throw new Error('Masukkan nama pembeli.'); if(!validEmail(data.buyerEmail)) throw new Error('Masukkan alamat e-mel yang sah.'); if(data.buyerPhone.replace(/\D/g,'').length<8) throw new Error('Masukkan nombor telefon yang sah.'); }
function invalidate(){ verifiedKey=''; const pay=$('publicPaPayButton'),test=$('publicPaTestPaymentButton'); if(pay)pay.disabled=true; if(test)test.disabled=true; }
async function firebaseToken(forceRefresh=false){
  try{
    const apps=getApps();
    if(!apps.length)return '';
    const auth=getAuth(apps[0]);
    if(typeof auth.authStateReady==='function')await Promise.race([auth.authStateReady(),new Promise(resolve=>setTimeout(resolve,4000))]);
    const user=auth.currentUser;
    return user ? await user.getIdToken(!!forceRefresh) : '';
  }catch(_){return '';}
}
async function parseBackendResponse(response){
  const raw=await response.text().catch(()=> '');
  let data={};
  if(raw){try{data=JSON.parse(raw);}catch(_){data={raw};}}
  return {response,data,raw};
}
async function sendAdminPublicPaTest(data,forceRefresh=false){
  const token=await firebaseToken(forceRefresh);
  if(!token)throw new Error('Sesi Firebase admin tidak ditemui. Log keluar dan login semula sebagai admin.');
  let response;
  try{
    response=await fetch(`${BACKEND}/api/admin/test-public-pa-payment`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({...data,sourcePage:location.href,frontendPatch:'559'}),
      cache:'no-store'
    });
  }catch(_){
    throw new Error('Tidak dapat menghubungi backend Render. Cuba semula selepas backend aktif.');
  }
  return parseBackendResponse(response);
}
function applyUser(){ const user=currentSavedUser(); const workspace=$('publicPaWorkspace'),restricted=$('publicPaRestricted'),test=$('publicPaTestPaymentButton'); const admin=isAdminUser(user); if(test){test.hidden=!admin;test.classList.toggle('show',admin);test.disabled=!admin||!verifiedKey;} if(isRestricted(user)){ if(workspace)workspace.style.display='none'; if(restricted)restricted.classList.add('show'); return; } if(workspace)workspace.style.removeProperty('display'); if(restricted)restricted.classList.remove('show'); if(!user)return; const name=String(user.usernameKey||user.username||user.displayName||user.name||'').trim(); const email=String(user.email||user.authEmail||'').trim(); const phone=String(user.phone||user.phoneNumber||'').trim(); if(name && !$('publicPaName').value)$('publicPaName').value=name; if(email && !/@azobss\.local$/i.test(email) && !$('publicPaEmail').value){$('publicPaEmail').value=email;$('publicPaEmail').readOnly=true;} if(phone && !$('publicPaPhone').value)$('publicPaPhone').value=phone; }
async function checkPa(){ try{ const data=formData(); validatePa(data); setBusy(true,'Menyemak kewujudan PA...'); const url=`${BACKEND}/api/check-pa?noPA=${encodeURIComponent('PA'+data.paNumber+'.TIF')}&negeri=${encodeURIComponent(data.negeri)}`; const response=await fetch(url,{cache:'no-store'}); const result=await response.json().catch(()=>({})); if(!response.ok||!result.ok)throw new Error('PA '+data.paNumber+' tidak ditemui untuk negeri yang dipilih.'); verifiedKey=data.paNumber+'|'+data.negeri; showStatus('success','PA '+data.paNumber+' ditemui. Anda boleh teruskan pembayaran '+currentPriceText()+'.'); }catch(error){invalidate();showStatus('error',error.message||'Semakan PA gagal.');}finally{setBusy(false);} }
async function pay(event){ event?.preventDefault(); try{ const data=formData(); validate(data); if(verifiedKey!==data.paNumber+'|'+data.negeri)throw new Error('Tekan Semak PA semula sebelum membuat bayaran.'); setBusy(true,'Menyediakan bil FPX yang selamat...'); const token=await firebaseToken(); const headers={'Content-Type':'application/json'}; if(token)headers.Authorization='Bearer '+token; const response=await fetch(`${BACKEND}/api/toyyib/create-public-pa-bill`,{method:'POST',headers,body:JSON.stringify({...data,sourcePage:location.href})}); const result=await response.json().catch(()=>({})); if(!response.ok||!result.ok)throw new Error(result.error||'Bil pembayaran tidak dapat dibuat.'); if(Number(result.amountSen)!==currentPriceSen()||Number(result.unit)!==1)throw new Error('Jumlah pembayaran backend tidak sepadan. Pengalihan dibatalkan.'); if(result.orderId)sessionStorage.setItem('azobss_public_pa_pending_order_id',String(result.orderId)); if(result.billCode)sessionStorage.setItem('azobss_public_pa_pending_bill_code',String(result.billCode)); location.href=result.paymentUrl||result.url||result.redirectUrl; }catch(error){showStatus('error',error.message||'Pembayaran tidak dapat dimulakan.');setBusy(false);} }
async function testPayment(){
  try{
    const user=currentSavedUser();
    if(!isAdminUser(user))throw new Error('Fungsi Test Payment hanya untuk admin.');
    const data=formData();
    validate(data);
    if(verifiedKey!==data.paNumber+'|'+data.negeri)throw new Error('Tekan Semak PA semula sebelum menjalankan Test Payment.');
    setBusy(true,'Menjalankan Test Payment admin tanpa membuka ToyyibPay...');

    let packet=await sendAdminPublicPaTest(data,false);
    if(packet.response.status===401||packet.response.status===403){
      packet=await sendAdminPublicPaTest(data,true);
    }
    const {response,resultRaw}= {response:packet.response,resultRaw:packet.raw};
    const result=packet.data||{};
    if(response.status===404||response.status===405){
      throw new Error('Endpoint Test Payment belum aktif di Render. Redeploy backend menggunakan versi (559), kemudian cuba semula.');
    }
    if(!response.ok){
      const htmlResponse=/^\s*</.test(resultRaw||'');
      if(htmlResponse)throw new Error(`Backend Render belum menggunakan endpoint Test Payment versi baharu (HTTP ${response.status}). Redeploy backend (559).`);
      throw new Error(result.error||result.message||`Test Payment admin gagal (HTTP ${response.status}).`);
    }
    if(!result.ok||!result.paid||!result.publicPa)throw new Error(result.error||result.message||'Backend tidak mengesahkan rekod Test Payment.');
    if(Number(result.amountSen)<=0||Number(result.unit)!==1)throw new Error('Rekod Test Payment backend tidak sepadan untuk satu Pelan Akui.');

    const orderId=String(result.orderId||'').trim();
    const recordId=String(result.recordId||(orderId?`${orderId}-1`: '')).trim();
    const downloadUrl=String(result.downloadUrl||(recordId?`${BACKEND}/api/pa-bm-download?recordId=${encodeURIComponent(recordId)}`:'')).trim();
    const receiptUrl=String(result.receiptUrl||(orderId?`${BACKEND}/api/premium/receipt/${encodeURIComponent(orderId)}`:'')).trim();
    if(!downloadUrl)throw new Error('Rekod paid berjaya dibuat tetapi link PDF tidak diterima daripada backend.');

    $('publicPaResult')?.classList.add('show');
    if($('publicPaResultTitle'))$('publicPaResultTitle').textContent='Test Payment Admin Berjaya ✅';
    $('publicPaDownload').href=downloadUrl;
    $('publicPaReceipt').href=receiptUrl||'#';
    $('publicPaReceipt').style.display=receiptUrl?'':'none';
    $('publicPaResultText').textContent='Rekod ujian berstatus paid telah dibuat. Tiada bayaran sebenar, e-mel pelanggan atau komisen dikira.';
    showStatus('success','Test Payment admin berjaya. Pelan Akui PDF dan resit ujian sudah tersedia.');
    $('publicPaResult')?.scrollIntoView({behavior:'smooth',block:'center'});
  }catch(error){
    const message=error?.message||'Test Payment admin gagal.';
    showStatus('error',message);
    alert(message);
  }finally{setBusy(false);}
}

function returnRefs(){ const p=new URLSearchParams(location.search); return {orderId:p.get('orderId')||p.get('order_id')||sessionStorage.getItem('azobss_public_pa_pending_order_id')||'',billCode:p.get('billCode')||p.get('billcode')||sessionStorage.getItem('azobss_public_pa_pending_bill_code')||''}; }
async function verifyReturn(){ if(verifyingReturn)return; const refs=returnRefs(); if(!refs.orderId&&!refs.billCode)return; verifyingReturn=true; showStatus('info','Mengesahkan pembayaran dengan ToyyibPay...'); for(let i=0;i<8;i++){ try{ const url=`${BACKEND}/api/verify-payment?orderId=${encodeURIComponent(refs.orderId)}&billCode=${encodeURIComponent(refs.billCode)}`; const response=await fetch(url,{cache:'no-store'}); const data=await response.json().catch(()=>({})); if(response.ok&&data.paid&&data.publicPa&&data.downloadUrl){ $('publicPaResult')?.classList.add('show'); if($('publicPaResultTitle'))$('publicPaResultTitle').textContent='Pembayaran Berjaya ✅'; $('publicPaDownload').href=data.downloadUrl; $('publicPaReceipt').href=data.receiptUrl||'#'; $('publicPaResultText').textContent=data.emailSent ? 'PDF sudah tersedia dan link turut dihantar ke e-mel anda.' : 'PDF sudah tersedia. Simpan link ini; penghantaran e-mel mungkin masih diproses.'; showStatus('success','Pembayaran berjaya disahkan. Pelan Akui anda sudah tersedia.'); sessionStorage.removeItem('azobss_public_pa_pending_order_id');sessionStorage.removeItem('azobss_public_pa_pending_bill_code'); $('publicPaResult')?.scrollIntoView({behavior:'smooth',block:'center'}); verifyingReturn=false; return; } if(data.status==='failed'||data.status==='cancelled')throw new Error('Pembayaran tidak berjaya atau telah dibatalkan.'); }catch(error){ if(i===7){showStatus('error',error.message||'Pengesahan pembayaran belum selesai. Cuba muat semula halaman sebentar lagi.');verifyingReturn=false;return;} } await new Promise(r=>setTimeout(r,1800+i*600)); } showStatus('info','Pembayaran masih diproses. Muat semula halaman sebentar lagi.'); verifyingReturn=false; }
async function init(){ const adjustment=await waitForPriceAdjustment('publicPa').catch(()=>({percent:0})); priceAdjustmentPercent=Number(adjustment?.percent||0); applyDisplayedPrice(); applyUser(); $('publicPaCheckButton')?.addEventListener('click',checkPa); $('publicPaTestPaymentButton')?.addEventListener('click',testPayment); $('publicPaForm')?.addEventListener('submit',pay); ['publicPaNumber','publicPaState'].forEach(id=>$(id)?.addEventListener('input',invalidate)); $('publicPaOpenMyLotButton')?.addEventListener('click',openMyLotFloat); $('publicPaMyLotClose')?.addEventListener('click',closeMyLotFloat); $('publicPaMyLotModal')?.addEventListener('click',event=>{if(event.target===$('publicPaMyLotModal'))closeMyLotFloat();}); $('publicPaMyLotFrame')?.addEventListener('load',()=>{$('publicPaMyLotFrame')?.classList.add('is-loaded');}); document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('publicPaMyLotModal')?.hidden)closeMyLotFloat();}); window.addEventListener('storage',()=>setTimeout(applyUser,80)); window.addEventListener('azobss-auth-changed',()=>setTimeout(applyUser,80)); window.addEventListener('azobss:price-adjustment-change',event=>{priceAdjustmentPercent=Number(event.detail?.percentByCategory?.publicPa||0);applyDisplayedPrice();}); [300,900,1800].forEach(ms=>setTimeout(applyUser,ms)); verifyReturn(); }
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
