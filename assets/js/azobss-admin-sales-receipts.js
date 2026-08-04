/* AZOBSS PATCH 739: unique daily document numbers and Malaysia current date/time */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',authDomain:'azobss.firebaseapp.com',projectId:'azobss',storageBucket:'azobss.firebasestorage.app',messagingSenderId:'159277716405',appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const BACKEND='https://azobss-backend.onrender.com';
const MANUAL_SOURCE='admin-manual-sale';
const PAGE_SIZE=10;

let manualRows=[];
let websiteRows=[];
let visibleRows=[];
let currentPage=1;
let editingDocId='';
let editingOriginalStatus='';
let editingInvoiceNo='';
let editingReceiptNo='';
let loadingPromise=null;
const selectedRowIds=new Set();

const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const money=v=>'RM'+num(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const clampMoney=v=>Math.round(Math.max(0,num(v))*100)/100;

function notify(message,error=false){
  let n=el('azSalesReceiptNotice');
  if(!n){n=document.createElement('div');n.id='azSalesReceiptNotice';n.className='az-sr-notice';document.body.appendChild(n)}
  n.textContent=message;n.classList.toggle('error',!!error);n.hidden=false;
  clearTimeout(notify._t);notify._t=setTimeout(()=>{n.hidden=true},4200);
}
const MY_TIME_ZONE='Asia/Kuala_Lumpur';
function malaysiaDateParts(ms=Date.now()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:MY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
  const out={};parts.forEach(part=>{if(part.type!=='literal')out[part.type]=part.value});return out;
}
function localDateInput(ms=Date.now()){
  const p=malaysiaDateParts(ms);return `${p.year}-${p.month}-${p.day}`;
}
function localDateTimeInput(ms=Date.now()){
  const p=malaysiaDateParts(ms);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function malaysiaDateKey(ms=Date.now()){
  const p=malaysiaDateParts(ms);return `${p.year}${p.month}${p.day}`;
}
function parseMalaysiaDateTime(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);if(!m)return Date.now();
  const year=Number(m[1]),month=Number(m[2])-1,day=Number(m[3]),hour=Number(m[4]||0),minute=Number(m[5]||0);
  return Date.UTC(year,month,day,hour-8,minute,0,0);
}
function sameMalaysiaDate(a,b){return !!a&&!!b&&malaysiaDateKey(a)===malaysiaDateKey(b)}
function isLegacyArtificialNoon(ms){if(!ms)return false;const p=malaysiaDateParts(ms);return p.hour==='12'&&p.minute==='00'&&p.second==='00'}
function actualManualDateMs(primary,row={}){
  const raw=parseMs(primary);if(!raw)return parseMs(row.createdAtMs||row.createdAt||row.updatedAtMs||row.updatedAt);
  if(num(row.dateTimeVersion)>=739)return raw;
  const created=parseMs(row.createdAtMs||row.createdAt);
  return isLegacyArtificialNoon(raw)&&created&&sameMalaysiaDate(raw,created)?created:raw;
}
function parseMs(v){
  if(!v)return 0;if(typeof v==='number'&&Number.isFinite(v))return v;
  if(v?.toDate){const d=v.toDate();return d?.getTime?.()||0}
  if(typeof v==='object'){if(Number(v.seconds)>0)return Number(v.seconds)*1000;if(Number(v._seconds)>0)return Number(v._seconds)*1000}
  const t=Date.parse(String(v));return Number.isNaN(t)?0:t;
}
function rowDateMs(x={}){
  for(const v of [x.saleDateMs,x.paidAtMs,x.paymentPaidAtMs,x.createdAtMs,x.updatedAtMs,x.paidAt,x.paymentDate,x.createdAt,x.date,x.timestamp]){const ms=parseMs(v);if(ms)return ms}
  return 0;
}
function formatDate(ms){if(!ms)return '-';try{return new Date(ms).toLocaleString('en-MY',{timeZone:MY_TIME_ZONE,dateStyle:'medium',timeStyle:'short'})}catch(_e){return new Date(ms).toLocaleString('en-MY',{timeZone:MY_TIME_ZONE})}}
function normalizeStatus(v,paidFlag=false){
  const s=String(v||'').trim().toLowerCase();
  if(paidFlag||['paid','verified','success','successful','completed','complete','approved','confirmed','settled'].includes(s))return 'paid';
  if(s.includes('refund'))return 'refunded';
  if(s.includes('cancel')||['void','aborted'].includes(s))return 'cancelled';
  if(s.includes('fail')||s.includes('reject')||s.includes('declin')||s.includes('error')||s.includes('expired'))return 'failed';
  return 'pending';
}
function documentKindForStatus(value){
  const status=normalizeStatus(value);
  return status==='paid'||status==='refunded'?'receipt':'invoice';
}
function isRecognizedPayment(value){return normalizeStatus(value)==='paid'}
function deriveInvoiceNo(value){
  const source=String(value||'').trim();if(!source)return '';
  if(/^AZI-/i.test(source)||/^INV-/i.test(source))return source;
  if(/^AZR-/i.test(source))return source.replace(/^AZR-/i,'AZI-');
  return 'INV-'+source;
}
function deriveReceiptNo(value){
  const source=String(value||'').trim();if(!source)return '';
  if(/^AZR-/i.test(source))return source;
  if(/^AZI-/i.test(source))return source.replace(/^AZI-/i,'AZR-');
  if(/^INV-/i.test(source))return source.replace(/^INV-/i,'RCP-');
  return source;
}
function invoiceNoForRow(row={}){
  const explicit=String(row.invoiceNo||'').trim();if(explicit)return explicit;
  const stored=String(row.documentNo||'').trim();if(documentKindForStatus(row.status)==='invoice'&&stored)return deriveInvoiceNo(stored);
  return deriveInvoiceNo(row.receiptNo||row.orderId||row.paymentOrderId||row.billCode||row.paymentReference||row.id||'');
}
function receiptNoForRow(row={}){
  const explicit=String(row.receiptNo||'').trim();if(explicit&&!/^AZI-/i.test(explicit)&&!/^INV-/i.test(explicit))return explicit;
  const stored=String(row.documentNo||'').trim();if(documentKindForStatus(row.status)==='receipt'&&stored)return deriveReceiptNo(stored);
  return deriveReceiptNo(row.invoiceNo||explicit||row.orderId||row.paymentOrderId||row.billCode||row.paymentReference||row.id||'');
}
function currentDocumentNo(row={}){return documentKindForStatus(row.status)==='receipt'?receiptNoForRow(row):invoiceNoForRow(row)}
function currentDocumentDateMs(row={}){const receipt=documentKindForStatus(row.status)==='receipt';const primary=receipt?(parseMs(row.paidAtMs||row.paymentPaidAtMs||row.paidAt)||num(row.saleDateMs)||rowDateMs(row)):(parseMs(row.invoiceDateMs)||num(row.saleDateMs)||rowDateMs(row));return row.source==='manual'?actualManualDateMs(primary,row):primary}
function recognizedGross(row={}){return isRecognizedPayment(row.status)?num(row.gross):0}
function recognizedCosts(row={}){return isRecognizedPayment(row.status)?num(row.totalCost):0}
function recognizedProfit(row={}){return isRecognizedPayment(row.status)?num(row.profit):0}
function detectCategory(x={}){
  const product=x.product||{};
  const hay=[x.category,x.productCategory,x.productType,x.type,x.source,x.sourcePage,x.productName,x.productTitle,x.itemName,x.title,x.name,x.filename,x.productId,x.softwareId,x.cadId,product.category,product.type,product.name,product.title].map(v=>String(v||'').toLowerCase()).join(' ');
  if(/computer|komputer|desktop|laptop|notebook|monitor|printer|scanner|ram|memory|ssd|hdd|nvme|gpu|graphic card|graphics card|cpu|processor|motherboard|mainboard|keyboard|mouse|adapter|charger|battery|bateri|router|switch|network|networking|nas|server|hardware|pc\b/.test(hay))return 'computer-it';
  if(/brownie|food|makanan|physical|barang fizikal/.test(hay))return 'physical';
  if(/service|servis|repair|format|clone|cleaning|installation/.test(hay))return 'service';
  if(/pa\s*[/+-]?\s*bm|pabm|pelan akui|kadaster|jupem|batu sempadan/.test(hay))return 'pabm';
  if(/cad|autocad|lisp|vlx|dwg/.test(hay))return 'cad';
  if(/software|license|lesen|installer|download/.test(hay))return 'software';
  return 'other';
}
function categoryLabel(v){return ({physical:'Physical','computer-it':'Computer & IT',software:'Software',service:'Service',cad:'CAD Tools',pabm:'PA/BM',mixed:'Mixed',other:'Other'})[v]||'Other'}
function extractAmount(x={}){
  for(const k of ['amount','saleAmount','total','totalAmount','price','paymentAmount','amountValue']){const n=num(x[k]);if(n>0)return n}
  const sen=num(x.amountSen||x.paymentAmountSen);return sen>0?sen/100:0;
}
function extractCost(x,keys){for(const k of keys){const n=num(x?.[k]);if(n>0)return n}return 0}
function normalizeJupemType(raw){
  const value=String(raw||'').trim().toUpperCase().replace(/[\s-]+/g,'_');
  if(['PA','PELAN_AKUI'].includes(value))return 'PA';
  if(['BM','BATU_ARAS','BATU_TANDA_ARAS'].includes(value))return 'BM';
  if(['SBM','STESEN_BATU_ARAS','STESEN_TANDA_ARAS'].includes(value))return 'SBM';
  if(['GPS','STESEN_GPS'].includes(value))return 'GPS';
  if(['SYIT_PIAWAI','SYIT_PIAWAI_(GAMBAR)','SYIT_PIAWAI_GAMBAR','LEMBAR_PIAWAI'].includes(value))return 'SYIT_PIAWAI';
  if(['NDCDB_C3','LOT_KADASTER_BERDIGIT_C3'].includes(value))return 'NDCDB_C3';
  if(['NDCDB','LOT_KADASTER_BERDIGIT','KADASTER'].includes(value))return 'NDCDB';
  return '';
}
function jupemTypeLabel(type){
  return ({PA:'Pelan Akui',BM:'BM',SBM:'SBM',GPS:'GPS',SYIT_PIAWAI:'Syit Piawai',NDCDB:'Lot Kadaster Berdigit',NDCDB_C3:'Lot Kadaster Berdigit C3'})[type]||'';
}
function detailedJupemProductName(x={}){
  const p=x.product||{};
  const arrays=[x.paBmItems,x.items,x.cartItems,x.selectedItems,x.purchaseItems,x.documents,x.orderItems,p.paBmItems,p.items].filter(Array.isArray);
  const counts=new Map();
  const add=(rawType,qty=1)=>{const type=normalizeJupemType(rawType);if(!type)return;const amount=Math.max(1,Math.round(num(qty)||1));counts.set(type,(counts.get(type)||0)+amount)};
  arrays.forEach(rows=>rows.forEach(item=>add(item?.productType||item?.product||item?.type||item?.itemType||item?.documentType||item?.category,item?.qty||item?.quantity||item?.units||1)));
  if(!counts.size)add(x.productType||x.product||x.type||x.itemType||x.documentType||x.category,1);
  if(!counts.size){
    const code=String(x.itemCode||x.code||x.noPA||x.noPa||x.noBM||x.noBm||x.stationNo||'').trim().toUpperCase();
    if(/^PA[-_\s]?\d/.test(code)||x.noPA||x.noPa)add('PA');
    else if(/^BM[-_\s]?\d/.test(code)||x.noBM||x.noBm)add('BM');
  }
  if(!counts.size){
    const rawName=String(x.productName||x.productTitle||x.itemName||x.title||x.name||p.name||p.title||'');
    const lower=rawName.toLowerCase();
    if(lower.includes('lot kadaster berdigit c3'))add('NDCDB_C3');
    else if(lower.includes('lot kadaster')||lower.includes('ndcdb'))add('NDCDB');
    if(lower.includes('pelan akui'))add('PA');
    if(/(^|[^a-z])sbm([^a-z]|$)/i.test(rawName))add('SBM');
    else if(/(^|[^a-z])bm([^a-z]|$)/i.test(rawName)&&!lower.includes('pa/bm'))add('BM');
    if(/(^|[^a-z])gps([^a-z]|$)/i.test(rawName))add('GPS');
    if(lower.includes('syit piawai')||lower.includes('lembar piawai'))add('SYIT_PIAWAI');
  }
  if(!counts.size)return '';
  const order=['PA','BM','SBM','GPS','SYIT_PIAWAI','NDCDB','NDCDB_C3'];
  return [...counts.entries()].sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0])).map(([type,count])=>`${jupemTypeLabel(type)} (${count} unit)`).join(' + ');
}
function isAdminTestRecord(x={}){
  if(x.isAdminTestPayment===true||x.testPayment===true||x.isTestPayment===true||x.adminTest===true)return true;
  const p=x.product||{};
  const fields=[x.orderId,x.id,x.docId,x.paymentOrderId,x.paymentReference,x.billCode,x.paymentMethod,x.paymentSource,x.paymentVerificationSource,x.source,x.createdBy,x.createdByAdmin,x.commissionSkippedReason,x.productName,x.productTitle,x.itemName,x.title,x.name,p.id,p.name,p.title];
  const hay=fields.map(v=>String(v||'').trim().toLowerCase()).join(' ');
  return /(^|[^a-z0-9])admin[-_ ]?test([^a-z0-9]|$)/.test(hay)||/(^|[^a-z0-9])pabmtest[-_a-z0-9]*/.test(hay)||hay.includes('jupem document test purchase');
}
function productName(x={}){const exact=detailedJupemProductName(x);if(exact)return exact;const p=x.product||{};return String(x.productName||x.productTitle||x.itemName||x.title||x.name||x.filename||x.itemCode||p.name||p.title||x.productId||'Website Purchase')}
function customerName(x={}){const u=x.user||{};return String(x.customerName||x.buyerName||x.displayName||x.username||x.usernameKey||u.displayName||u.username||x.email||x.buyerEmail||u.email||'Customer')}
function customerEmail(x={}){const u=x.user||{};return String(x.customerEmail||x.email||x.buyerEmail||u.email||'')}
function customerPhone(x={}){const u=x.user||{};return String(x.customerPhone||x.phone||x.phoneNumber||x.buyerPhone||u.phone||u.phoneNumber||'')}
function automaticReceiptNo(x,id){return String(x.receiptNo||x.invoiceNo||x.orderId||x.paymentOrderId||x.billCode||x.paymentReference||('WEB-'+String(id||'').slice(0,10).toUpperCase()))}
function websiteDeleteRef(x={},id='',sourceName='purchaseLogs'){
  const collectionName=sourceName==='premiumOrders'?'premiumOrders':'purchaseLogs';
  return {
    source:sourceName,
    collection:collectionName,
    docId:String(x.docId||x.firestoreId||(collectionName==='purchaseLogs'?id:'')||''),
    id:String(x.id||id||''),
    orderId:String(x.orderId||x.paymentOrderId||''),
    billCode:String(x.billCode||x.billcode||''),
    paymentReference:String(x.paymentReference||x.transactionId||x.txnId||''),
    productId:String(x.productId||x.softwareId||x.cadId||x.itemCode||x.product?.id||''),
    status:String(x.status||x.paymentStatus||''),
    category:String(x.category||''),
    amount:num(x.amount||x.total||x.totalAmount||x.price||0)
  };
}
function mergeDeleteRefs(...groups){
  const out=[];const seen=new Set();
  groups.flat().filter(Boolean).forEach(ref=>{
    const key=[ref.collection,ref.docId,ref.id,ref.orderId,ref.billCode,ref.paymentReference].map(v=>String(v||'').trim()).join('|');
    if(!key||seen.has(key))return;seen.add(key);out.push(ref);
  });
  return out;
}
function manualCalc(items=[],extras={}){
  const clean=items.map(i=>({category:String(i.category||'other'),name:String(i.name||'Item'),qty:Math.max(0,num(i.qty)),unitPrice:clampMoney(i.unitPrice),unitCost:clampMoney(i.unitCost)}));
  const subtotal=clean.reduce((s,i)=>s+i.qty*i.unitPrice,0);
  const productCost=clean.reduce((s,i)=>s+i.qty*i.unitCost,0);
  const discount=clampMoney(extras.discount);
  const shippingCharge=clampMoney(extras.shippingCharge);
  const shippingCost=clampMoney(extras.shippingCost);
  const paymentFee=clampMoney(extras.paymentFee);
  const commission=clampMoney(extras.commission);
  const otherCost=clampMoney(extras.otherCost);
  const gross=Math.max(0,subtotal-discount+shippingCharge);
  const totalCost=productCost+shippingCost+paymentFee+commission+otherCost;
  return {items:clean,subtotal,productCost,discount,shippingCharge,shippingCost,paymentFee,commission,otherCost,gross,totalCost,profit:gross-totalCost};
}
function normalizeManual(id,x={}){
  const fallbackItems=[{category:x.category||'other',name:x.productName||x.itemName||'Item',qty:num(x.quantity)||1,unitPrice:num(x.unitPrice||x.price||x.gross),unitCost:num(x.unitCost||x.productCost)}];
  const c=manualCalc(Array.isArray(x.items)&&x.items.length?x.items:fallbackItems,x);
  const categories=[...new Set(c.items.map(i=>i.category))];
  const status=normalizeStatus(x.status);const legacyNo=String(x.documentNo||x.receiptNo||x.invoiceNo||'').trim();
  const invoiceNo=String(x.invoiceNo||deriveInvoiceNo(legacyNo||('AZR-'+id.slice(0,8).toUpperCase())));
  const receiptNo=String(x.receiptNo||((status==='paid'||status==='refunded')?deriveReceiptNo(legacyNo||invoiceNo):''));
  const row={...x,...c,id,docId:id,source:'manual',editable:true,invoiceNo,receiptNo,documentType:documentKindForStatus(status),paymentRecognized:isRecognizedPayment(status),customerName:String(x.customerName||'Customer'),customerPhone:String(x.customerPhone||''),customerEmail:String(x.customerEmail||''),status,paymentMethod:String(x.paymentMethod||'Bank Transfer'),saleDateMs:actualManualDateMs(rowDateMs(x),x)||Date.now(),categories,category:categories.length===1?categories[0]:'mixed'};
  row.documentNo=currentDocumentNo(row);row.paidGross=recognizedGross(row);row.recognizedTotalCost=recognizedCosts(row);row.recognizedProfit=recognizedProfit(row);row.amountDue=isRecognizedPayment(status)?0:num(row.gross);return row;
}
function normalizeWebsite(id,x={},sourceName='purchaseLogs'){
  const status=normalizeStatus(x.status||x.paymentStatus,x.paid===true);
  const gross=clampMoney(extractAmount(x));
  const category=detectCategory(x);
  const explicitFee=extractCost(x,['paymentFee','gatewayFee','transactionFee','toyyibPayFee','processingFee']);
  const method=String(x.paymentMethod||x.paymentSource||x.gateway||'ToyyibPay');
  const paymentFee=explicitFee>0?explicitFee:(status==='paid'&&/toyyib|online|gateway/i.test(method)?1:0);
  const commission=extractCost(x,['commission','commissionAmount','staffCommission','affiliateCommission']);
  const otherCost=extractCost(x,['otherCost','cost']);
  const totalCost=paymentFee+commission+otherCost;
  const baseNo=automaticReceiptNo(x,id);
  const row={
    ...x,id:`${sourceName}:${id}`,docId:id,source:'website',sourceName,editable:false,
    deleteRefs:[websiteDeleteRef(x,id,sourceName)],
    invoiceNo:String(x.invoiceNo||deriveInvoiceNo(baseNo)),receiptNo:String(x.receiptNo||deriveReceiptNo(baseNo)),
    documentType:documentKindForStatus(status),paymentRecognized:isRecognizedPayment(status),
    customerName:customerName(x),customerPhone:customerPhone(x),customerEmail:customerEmail(x),status,paymentMethod:method,
    saleDateMs:rowDateMs(x),items:[{category,name:productName(x),qty:1,unitPrice:gross,unitCost:0}],categories:[category],category,
    subtotal:gross,discount:0,productCost:0,shippingCost:0,paymentFee,commission,otherCost,gross,totalCost,profit:gross-totalCost
  };
  row.documentNo=currentDocumentNo(row);row.paidGross=recognizedGross(row);row.recognizedTotalCost=recognizedCosts(row);row.recognizedProfit=recognizedProfit(row);row.amountDue=isRecognizedPayment(status)?0:gross;return row;
}
function websiteDedupKey(row){
  const raw=row.raw||row;
  return String(raw.orderId||raw.paymentOrderId||raw.billCode||raw.paymentReference||raw.receiptNo||row.receiptNo||row.id).toLowerCase();
}
async function waitForUser(){
  if(auth.currentUser)return auth.currentUser;
  return await new Promise(resolve=>{let done=false;let off=()=>{};off=onAuthStateChanged(auth,u=>{if(done)return;done=true;off();resolve(u)});setTimeout(()=>{if(done)return;done=true;off();resolve(auth.currentUser)},7000)});
}
async function loadPremiumOrders(user){
  try{
    const headers={};
    if(user){headers.Authorization='Bearer '+await user.getIdToken()}
    try{const key=sessionStorage.getItem('azobssAdminApiKey')||localStorage.getItem('azobssAdminApiKey')||localStorage.getItem('azobssLuckyDrawAdminKey')||'';if(key)headers['x-admin-key']=key}catch(_e){}
    const res=await fetch(BACKEND+'/api/admin/export?type=premiumOrders&format=json&limit=500',{headers,cache:'no-store'});
    if(!res.ok)throw new Error('premiumOrders HTTP '+res.status);
    const data=await res.json();return Array.isArray(data.records)?data.records:[];
  }catch(e){console.warn('Sales & Receipts premiumOrders read skipped:',e);return []}
}
async function loadData(){
  if(loadingPromise)return loadingPromise;
  loadingPromise=(async()=>{
    const info=el('salesReceiptResultInfo');if(info)info.textContent='Loading manual invoices, receipts and website sales...';
    const user=await waitForUser();if(!user)throw new Error('Admin login not ready. Please sign in again.');
    const [receiptSnap,purchaseSnap,premium]=await Promise.all([
      getDocs(query(collection(db,'receipts'),limit(1000))),
      getDocs(query(collection(db,'purchaseLogs'),limit(1000))),
      loadPremiumOrders(user)
    ]);
    manualRows=[];receiptSnap.forEach(d=>{const x=d.data()||{};if(String(x.source||'')===MANUAL_SOURCE)manualRows.push(normalizeManual(d.id,x))});
    let repairedCount=0;
    try{repairedCount=await repairDuplicateManualNumbers()}catch(repairError){console.warn('Duplicate document number repair skipped:',repairError)}
    if(repairedCount)manualRows=await freshManualRows();
    const map=new Map();
    purchaseSnap.forEach(d=>{const x=d.data()||{};if(isAdminTestRecord(x))return;const row=normalizeWebsite(d.id,x,'purchaseLogs');map.set(websiteDedupKey(row),row)});
    premium.forEach((x,i)=>{
      if(isAdminTestRecord(x))return;
      const id=String(x.orderId||x.docId||x.id||x.billCode||('premium-'+i));const row=normalizeWebsite(id,x,'premiumOrders');const k=websiteDedupKey(row);const existing=map.get(k);
      if(!existing){map.set(k,row);return}
      existing.deleteRefs=mergeDeleteRefs(existing.deleteRefs,row.deleteRefs);
      const exactName=detailedJupemProductName(x);
      if(exactName){
        existing.items=[{...(existing.items?.[0]||{}),category:'pabm',name:exactName,qty:1,unitPrice:existing.gross,unitCost:0}];
        existing.categories=['pabm'];existing.category='pabm';
      }
      if(existing.status!=='paid'&&row.status==='paid')existing.status='paid';
      existing.customerName=existing.customerName||row.customerName;existing.customerPhone=existing.customerPhone||row.customerPhone;existing.customerEmail=existing.customerEmail||row.customerEmail;
    });
    websiteRows=[...map.values()].filter(row=>!isAdminTestRecord(row));
    selectedRowIds.clear();
    currentPage=1;applyFilters();
    if(info)info.textContent=`Loaded ${manualRows.length} manual invoice / receipt record(s) and ${websiteRows.length} website sale record(s).`;
  })().catch(e=>{notify(e.message||'Failed to load sales receipts.',true);const info=el('salesReceiptResultInfo');if(info)info.textContent='Load failed: '+(e.message||e);throw e}).finally(()=>{loadingPromise=null});
  return loadingPromise;
}
function categoriesForRow(row){return Array.isArray(row.categories)&&row.categories.length?row.categories:[row.category||'other']}
function rowMatchesCategory(row,filter){if(filter==='all')return true;if(filter==='digital')return categoriesForRow(row).some(c=>['software','cad','pabm'].includes(c));return categoriesForRow(row).includes(filter)}
function paidRows(rows){return rows.filter(r=>r.status==='paid')}
function categoryGross(row,categorySet){
  const subtotal=num(row.subtotal)||num(row.gross);if(subtotal<=0)return 0;
  const gross=num(row.gross);const factor=gross/subtotal;
  return (row.items||[]).filter(i=>categorySet.has(i.category)).reduce((s,i)=>s+num(i.qty)*num(i.unitPrice)*factor,0);
}
function updateKpis(rows){
  const paid=paidRows(rows);const gross=paid.reduce((s,r)=>s+num(r.gross),0);const costs=paid.reduce((s,r)=>s+num(r.totalCost),0);const profit=paid.reduce((s,r)=>s+num(r.profit),0);
  const physical=paid.reduce((s,r)=>s+categoryGross(r,new Set(['physical','computer-it'])),0);
  const digital=paid.reduce((s,r)=>s+categoryGross(r,new Set(['software','cad','pabm'])),0);
  const pending=rows.filter(r=>r.status==='pending').length;
  const set=(id,v)=>{if(el(id))el(id).textContent=v};
  set('srGrossSales',money(gross));set('srTotalCosts',money(costs));set('srNetProfit',money(profit));set('srPhysicalSales',money(physical));set('srSoftwareSales',money(digital));set('srPendingCount',String(pending));
}
function getFilters(){return {q:String(el('salesReceiptSearch')?.value||'').trim().toLowerCase(),category:el('salesReceiptCategory')?.value||'all',status:el('salesReceiptStatus')?.value||'all',source:el('salesReceiptSource')?.value||'all',sort:el('salesReceiptSort')?.value||'newest',from:el('salesReceiptFrom')?.value||'',to:el('salesReceiptTo')?.value||''}}
function applyFilters(){
  const f=getFilters();let rows=[...manualRows,...websiteRows];
  const from=f.from?new Date(f.from+'T00:00:00').getTime():0;const to=f.to?new Date(f.to+'T23:59:59.999').getTime():0;
  rows=rows.filter(r=>{
    const hay=[r.documentNo,r.invoiceNo,r.receiptNo,r.customerName,r.customerEmail,r.customerPhone,r.paymentMethod,r.status,r.sourceName,...(r.items||[]).map(i=>i.name),...categoriesForRow(r)].join(' ').toLowerCase();
    return (!f.q||hay.includes(f.q))&&(f.status==='all'||r.status===f.status)&&(f.source==='all'||r.source===f.source)&&rowMatchesCategory(r,f.category)&&(!from||r.saleDateMs>=from)&&(!to||r.saleDateMs<=to);
  });
  rows.sort((a,b)=>{
    if(f.sort==='oldest')return a.saleDateMs-b.saleDateMs;
    if(f.sort==='gross-high')return recognizedGross(b)-recognizedGross(a);
    if(f.sort==='profit-high')return recognizedProfit(b)-recognizedProfit(a);
    if(f.sort==='az')return String(a.customerName).localeCompare(String(b.customerName));
    return b.saleDateMs-a.saleDateMs;
  });
  visibleRows=rows;
  const visibleIds=new Set(rows.map(r=>r.id));for(const id of [...selectedRowIds])if(!visibleIds.has(id))selectedRowIds.delete(id);
  const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));if(currentPage>pages)currentPage=pages;
  updateKpis(rows);renderTable();
}
function statusPill(status){return `<span class="az-sr-pill ${esc(status)}">${esc(status.toUpperCase())}</span>`}
function sourcePill(row){return `<span class="az-sr-pill ${row.source==='manual'?'manual':'website'}">${row.source==='manual'?'MANUAL':'WEBSITE'}</span>`}
function currentPageRows(){const start=(currentPage-1)*PAGE_SIZE;return visibleRows.slice(start,start+PAGE_SIZE)}
function getSelectedRows(){return [...selectedRowIds].map(findRow).filter(Boolean)}
function updateBulkUI(){
  const count=selectedRowIds.size;const page=currentPageRows();
  const countEl=el('salesReceiptSelectedCount');if(countEl)countEl.textContent=`${count} selected`;
  ['salesReceiptBulkDownload','salesReceiptBulkCopyLink','salesReceiptBulkShare','salesReceiptBulkDelete'].forEach(id=>{const button=el(id);if(button)button.disabled=count===0});
  const allFiltered=el('salesReceiptSelectAllFiltered');if(allFiltered){const selectedVisible=visibleRows.filter(r=>selectedRowIds.has(r.id)).length;allFiltered.checked=visibleRows.length>0&&selectedVisible===visibleRows.length;allFiltered.indeterminate=selectedVisible>0&&selectedVisible<visibleRows.length;allFiltered.disabled=visibleRows.length===0}
  const selectPage=el('salesReceiptSelectPage');if(selectPage){const selectedPage=page.filter(r=>selectedRowIds.has(r.id)).length;selectPage.checked=page.length>0&&selectedPage===page.length;selectPage.indeterminate=selectedPage>0&&selectedPage<page.length;selectPage.disabled=page.length===0}
  document.querySelectorAll('[data-sr-select]').forEach(cb=>{cb.checked=selectedRowIds.has(cb.dataset.srSelect||'');cb.closest('tr')?.classList.toggle('az-sr-row-selected',cb.checked)});
}
function setRowsSelected(rows,checked){rows.forEach(r=>{if(checked)selectedRowIds.add(r.id);else selectedRowIds.delete(r.id)});updateBulkUI()}
function actionIcon(name){
  const icons={
    download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>',
    invoice:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 11h6M9 15h6M9 19h4"/></svg>',
    link:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>',
    share:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>',
    whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.4 2.1 4 4.5 4.9l1.2-1.2 1.8.9c-.5 1.6-1.6 2.4-3.2 2-3.7-.9-6-3.2-6.8-6.8-.4-1.6.4-2.7 2-3.2l.9 1.8L9 8.5Z"/></svg>',
    telegram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 17-7-4 16-5-6-4 3 1-5 9-6-11 5Z"/></svg>',
    print:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7Z"/></svg>',
    edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16ZM13.5 6.5l4 4"/></svg>',
    delete:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></svg>'
  };
  return icons[name]||'';
}
function iconActionButton(kind,title,attrs=''){
  // Avoid the global `.whatsapp` floating-button style used elsewhere on the site.
  // The action still keeps the WhatsApp icon/behaviour, but uses a scoped class.
  const cssKind=kind==='whatsapp'?'wa':(kind==='copylink'?'link':kind);
  return `<button class="az-sr-icon-btn ${cssKind}" ${attrs} type="button" title="${esc(title)}" aria-label="${esc(title)}">${actionIcon(kind==='copylink'?'link':kind)}<span class="az-sr-visually-hidden">${esc(title)}</span></button>`;
}
function renderTable(){
  const tbody=el('salesReceiptTableBody');if(!tbody)return;
  const pages=Math.max(1,Math.ceil(visibleRows.length/PAGE_SIZE));const start=(currentPage-1)*PAGE_SIZE;const pageRows=visibleRows.slice(start,start+PAGE_SIZE);
  tbody.innerHTML=pageRows.map(r=>{
    const itemNames=(r.items||[]).map(i=>i.name).filter(Boolean);const itemText=itemNames.slice(0,2).join(', ')+(itemNames.length>2?` +${itemNames.length-2}`:'');
    const docType=documentKindForStatus(r.status);const docLabel=docType==='invoice'?'INVOICE':'RECEIPT';const docNo=currentDocumentNo(r);const rowId=esc(r.id);const label=docType==='invoice'?'Invoice':'Receipt';const selected=selectedRowIds.has(r.id);
    const actions=[];
    if(isRecognizedPayment(r.status)){
      actions.push(iconActionButton('invoice','Download original Invoice PDF',`data-sr-doc-download="invoice" data-sr-row="${rowId}"`));
    }
    actions.push(
      iconActionButton('download',`Download ${label} PDF`,`data-sr-doc-download="${docType}" data-sr-row="${rowId}"`),
      iconActionButton('copylink',`Copy ${label} PDF link`,`data-sr-doc-copy="${docType}" data-sr-row="${rowId}"`),
      iconActionButton('share',`Share ${label} PDF`,`data-sr-doc-share="native" data-sr-doc-type="${docType}" data-sr-row="${rowId}"`),
      iconActionButton('print',`Print ${label}`,`data-sr-doc-print="${docType}" data-sr-row="${rowId}"`)
    );
    if(r.editable)actions.push(iconActionButton('edit',`Edit ${label}`,`data-sr-edit="${rowId}"`));
    actions.push(iconActionButton('delete',`Delete ${label}`,`data-sr-delete-row="${rowId}"`));
    const paid=isRecognizedPayment(r.status);
    const grossCell=paid?money(r.gross):`<span class="az-sr-unrecognized">${money(0)}</span><div class="az-sr-subtext az-sr-due">Due ${money(r.gross)}</div>`;
    const costCell=paid?money(r.totalCost):`<span class="az-sr-unrecognized">${money(0)}</span>`;
    const profitValue=paid?num(r.profit):0;
    const profitCell=paid?money(profitValue):`<span class="az-sr-unrecognized">${money(0)}</span><div class="az-sr-subtext">Not recognized</div>`;
    return `<tr class="${selected?'az-sr-row-selected':''}" data-sr-table-row="${rowId}"><td class="az-sr-select-cell"><input class="az-sr-row-select" type="checkbox" data-sr-select="${rowId}" aria-label="Select ${esc(label)} ${esc(docNo)}"${selected?' checked':''}></td><td><div class="az-sr-doc-kind ${docType}">${docLabel}</div><div class="az-sr-receipt-no">${esc(docNo)}</div><div class="az-sr-subtext">${formatDate(currentDocumentDateMs(r))}</div></td><td><div class="az-sr-customer">${esc(r.customerName)}</div><div class="az-sr-subtext">${esc(r.customerPhone||r.customerEmail||'-')}</div></td><td>${sourcePill(r)}<div class="az-sr-subtext">${esc(categoryLabel(r.category))}</div></td><td><div>${esc(itemText||'Purchase')}</div><div class="az-sr-subtext">${esc(r.paymentMethod||'-')}</div></td><td>${statusPill(r.status)}</td><td class="az-sr-money">${grossCell}</td><td class="az-sr-money">${costCell}</td><td class="az-sr-money ${profitValue>=0?'az-sr-profit':'az-sr-loss'}">${profitCell}</td><td><div class="az-sr-actions">${actions.join('')}</div></td></tr>`;
  }).join('')||'<tr><td colspan="10"><div class="az-sr-empty">No sales or receipts match the current filter.</div></td></tr>';
  if(el('salesReceiptPageInfo'))el('salesReceiptPageInfo').textContent=`Page ${currentPage} / ${pages} • ${visibleRows.length} record(s)`;
  if(el('salesReceiptPrev'))el('salesReceiptPrev').disabled=currentPage<=1;if(el('salesReceiptNext'))el('salesReceiptNext').disabled=currentPage>=pages;
  updateBulkUI();
}
function parseManualDocumentSequence(value){
  const match=String(value||'').trim().match(/^AZ([IR])-(\d{8})-(\d{4,})$/i);if(!match)return null;
  return {kind:match[1].toUpperCase()==='I'?'invoice':'receipt',dateKey:match[2],sequence:Number(match[3])||0};
}
function sequenceState(rows=manualRows,excludeId=''){
  const used=new Set();const maxByDate=new Map();
  rows.forEach(row=>{
    if(excludeId&&String(row.docId||row.id)===String(excludeId))return;
    const rowKeys=new Set();
    [row.invoiceNo,row.receiptNo,row.documentNo,currentDocumentNo(row)].filter(Boolean).forEach(value=>{
      const parsed=parseManualDocumentSequence(value);if(!parsed)return;const key=`${parsed.dateKey}-${parsed.sequence}`;rowKeys.add(key);maxByDate.set(parsed.dateKey,Math.max(maxByDate.get(parsed.dateKey)||0,parsed.sequence));
    });
    rowKeys.forEach(key=>used.add(key));
  });
  return {used,maxByDate};
}
function nextDocumentNo(type='receipt',dateMs=Date.now(),rows=manualRows,excludeId=''){
  const kind=type==='invoice'?'invoice':'receipt';const prefix=kind==='invoice'?'AZI':'AZR';const date=malaysiaDateKey(dateMs);const state=sequenceState(rows,excludeId);const next=(state.maxByDate.get(date)||0)+1;
  return `${prefix}-${date}-${String(next).padStart(4,'0')}`;
}
async function freshManualRows(){
  const snap=await getDocs(query(collection(db,'receipts'),limit(1000)));const rows=[];
  snap.forEach(d=>{const data=d.data()||{};if(String(data.source||'')===MANUAL_SOURCE)rows.push(normalizeManual(d.id,data))});return rows;
}
async function ensureUniqueManualNumbers(kind,dateMs,excludeId=''){
  const rows=await freshManualRows();const state=sequenceState(rows,excludeId);const dateKey=malaysiaDateKey(dateMs);const current=kind==='invoice'?editingInvoiceNo:editingReceiptNo;const parsed=parseManualDocumentSequence(current);
  let sequence=parsed&&parsed.dateKey===dateKey?parsed.sequence:0;
  if(!sequence||state.used.has(`${dateKey}-${sequence}`))sequence=(state.maxByDate.get(dateKey)||0)+1;
  const suffix=`${dateKey}-${String(sequence).padStart(4,'0')}`;
  if(kind==='invoice'||editingInvoiceNo)editingInvoiceNo=`AZI-${suffix}`;
  if(kind==='receipt'||editingReceiptNo)editingReceiptNo=`AZR-${suffix}`;
  return kind==='invoice'?editingInvoiceNo:editingReceiptNo;
}
async function repairDuplicateManualNumbers(){
  const rows=[...manualRows].sort((a,b)=>(parseMs(a.createdAtMs||a.createdAt)||a.saleDateMs||0)-(parseMs(b.createdAtMs||b.createdAt)||b.saleDateMs||0));
  const seen=new Set();const maxByDate=new Map();
  rows.forEach(row=>{const parsed=parseManualDocumentSequence(currentDocumentNo(row));if(parsed)maxByDate.set(parsed.dateKey,Math.max(maxByDate.get(parsed.dateKey)||0,parsed.sequence))});
  const updates=[];
  for(const row of rows){
    const parsed=parseManualDocumentSequence(currentDocumentNo(row));if(!parsed)continue;const key=`${parsed.dateKey}-${parsed.sequence}`;
    if(!seen.has(key)){seen.add(key);continue}
    const next=(maxByDate.get(parsed.dateKey)||0)+1;maxByDate.set(parsed.dateKey,next);const suffix=`${parsed.dateKey}-${String(next).padStart(4,'0')}`;const kind=documentKindForStatus(row.status);const payload={documentNo:kind==='invoice'?`AZI-${suffix}`:`AZR-${suffix}`,updatedAt:serverTimestamp(),updatedAtMs:Date.now()};
    if(row.invoiceNo||kind==='invoice')payload.invoiceNo=`AZI-${suffix}`;
    if(row.receiptNo||kind==='receipt')payload.receiptNo=`AZR-${suffix}`;
    updates.push(updateDoc(doc(db,'receipts',row.docId),payload));seen.add(`${parsed.dateKey}-${next}`);
  }
  if(updates.length){await Promise.all(updates);notify(`${updates.length} duplicate document number(s) corrected automatically.`);return updates.length}
  return 0;
}
function categoryOptions(selected='physical'){return ['physical','computer-it','software','service','cad','pabm','other'].map(v=>`<option value="${v}"${v===selected?' selected':''}>${categoryLabel(v)}</option>`).join('')}
function addItemRow(item={}){
  const box=el('salesReceiptItems');if(!box)return;
  const row=document.createElement('div');row.className='az-sr-item-row';
  row.innerHTML=`<label>Category<select data-sr-item-category>${categoryOptions(item.category||'physical')}</select></label><label class="az-sr-item-name">Product / Service<input data-sr-item-name value="${esc(item.name||'')}" placeholder="Product name"></label><label>Quantity<input data-sr-item-qty type="number" min="0.01" step="0.01" value="${num(item.qty)||1}"></label><label>Unit price (RM)<input data-sr-item-price type="number" min="0" step="0.01" value="${num(item.unitPrice)||0}"></label><label>Unit cost (RM)<input data-sr-item-cost type="number" min="0" step="0.01" value="${num(item.unitCost)||0}"></label><button class="az-sr-remove-item" type="button" title="Remove item">×</button>`;
  box.appendChild(row);row.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',recalcForm));row.querySelector('.az-sr-remove-item').addEventListener('click',()=>{if(box.children.length<=1)return notify('At least one item is required.',true);row.remove();recalcForm()});recalcForm();
}
function collectFormItems(){return [...document.querySelectorAll('#salesReceiptItems .az-sr-item-row')].map(row=>({category:row.querySelector('[data-sr-item-category]')?.value||'other',name:String(row.querySelector('[data-sr-item-name]')?.value||'').trim(),qty:num(row.querySelector('[data-sr-item-qty]')?.value)||1,unitPrice:num(row.querySelector('[data-sr-item-price]')?.value),unitCost:num(row.querySelector('[data-sr-item-cost]')?.value)}))}
function formExtras(){return {discount:num(el('salesReceiptDiscount')?.value),shippingCharge:num(el('salesReceiptShippingCharge')?.value),shippingCost:num(el('salesReceiptShippingCost')?.value),paymentFee:num(el('salesReceiptPaymentFee')?.value),commission:num(el('salesReceiptCommission')?.value),otherCost:num(el('salesReceiptOtherCost')?.value)}}
function recalcForm(){
  const c=manualCalc(collectFormItems(),formExtras());const status=normalizeStatus(el('salesReceiptFormStatus')?.value);const recognized=isRecognizedPayment(status);
  const set=(id,v)=>{if(el(id))el(id).textContent=money(v)};
  set('salesReceiptCalcSubtotal',c.subtotal);set('salesReceiptCalcProductCost',c.productCost);set('salesReceiptCalcGross',c.gross);set('salesReceiptCalcCosts',recognized?c.totalCost:0);set('salesReceiptCalcProfit',recognized?c.profit:0);
  if(el('salesReceiptCalcGrossLabel'))el('salesReceiptCalcGrossLabel').textContent=recognized?'Total Paid':'Amount Due';
  if(el('salesReceiptCalcCostsLabel'))el('salesReceiptCalcCostsLabel').textContent=recognized?'Recognized Costs':'Costs (after Paid)';
  if(el('salesReceiptCalcProfitLabel'))el('salesReceiptCalcProfitLabel').textContent=recognized?'Net Profit':'Net Profit (after Paid)';
}
function syncFormDocumentMode(initial=false){
  const input=el('salesReceiptReceiptNo');if(!input)return;
  const previous=input.dataset.mode||'';
  if(!initial&&previous==='invoice')editingInvoiceNo=String(input.value||editingInvoiceNo).trim();
  if(!initial&&previous==='receipt')editingReceiptNo=String(input.value||editingReceiptNo).trim();
  const status=normalizeStatus(el('salesReceiptFormStatus')?.value);const kind=documentKindForStatus(status);const label=kind==='invoice'?'Invoice':'Receipt';
  if(kind==='invoice'){if(!editingInvoiceNo)editingInvoiceNo=editingReceiptNo?deriveInvoiceNo(editingReceiptNo):nextDocumentNo('invoice');input.value=editingInvoiceNo}
  else{if(!editingReceiptNo)editingReceiptNo=editingInvoiceNo?deriveReceiptNo(editingInvoiceNo):nextDocumentNo('receipt');input.value=editingReceiptNo}
  input.dataset.mode=kind;
  if(el('salesReceiptDocumentNoLabel'))el('salesReceiptDocumentNoLabel').textContent=label+' No';
  if(el('salesReceiptDialogTitle'))el('salesReceiptDialogTitle').textContent=`${editingDocId?'Edit':'Create'} Manual ${label}`;
  if(el('salesReceiptItemsTitle'))el('salesReceiptItemsTitle').textContent=label+' Items';
  if(el('salesReceiptSave'))el('salesReceiptSave').textContent='Save '+label;
  recalcForm();
}
function openForm(row=null){
  editingDocId=row?.docId||'';editingOriginalStatus=normalizeStatus(row?.status||'pending');editingInvoiceNo=row?invoiceNoForRow(row):'';editingReceiptNo=row?receiptNoForRow(row):'';
  el('salesReceiptSaleDate').value=localDateTimeInput(row?currentDocumentDateMs(row):Date.now());el('salesReceiptFormStatus').value=row?.status||'pending';el('salesReceiptPaymentMethod').value=row?.paymentMethod||'Bank Transfer';el('salesReceiptCustomerName').value=row?.customerName||'';el('salesReceiptCustomerPhone').value=row?.customerPhone||'';el('salesReceiptCustomerEmail').value=row?.customerEmail||'';el('salesReceiptDiscount').value=num(row?.discount)||0;el('salesReceiptShippingCharge').value=num(row?.shippingCharge)||0;el('salesReceiptShippingCost').value=num(row?.shippingCost)||0;el('salesReceiptPaymentFee').value=num(row?.paymentFee)||0;el('salesReceiptCommission').value=num(row?.commission)||0;el('salesReceiptOtherCost').value=num(row?.otherCost)||0;el('salesReceiptNotes').value=row?.notes||'';
  const numberInput=el('salesReceiptReceiptNo');numberInput.value='';numberInput.dataset.mode='';syncFormDocumentMode(true);
  const box=el('salesReceiptItems');box.innerHTML='';(row?.items?.length?row.items:[{category:'physical',name:'',qty:1,unitPrice:0,unitCost:0}]).forEach(addItemRow);recalcForm();el('salesReceiptDialog').hidden=false;document.body.style.overflow='hidden';setTimeout(()=>el('salesReceiptCustomerName')?.focus(),50);
}
function closeForm(){el('salesReceiptDialog').hidden=true;document.body.style.overflow='';editingDocId='';editingOriginalStatus='';editingInvoiceNo='';editingReceiptNo=''}
async function saveForm(){
  const user=await waitForUser();if(!user)return notify('Admin login not ready.',true);
  const customer=String(el('salesReceiptCustomerName')?.value||'').trim();const items=collectFormItems();if(!customer)return notify('Enter customer name.',true);if(!items.length||items.some(i=>!i.name))return notify('Enter a name for every item.',true);if(items.some(i=>i.qty<=0))return notify('Quantity must be more than zero.',true);
  const status=normalizeStatus(el('salesReceiptFormStatus')?.value);const kind=documentKindForStatus(status);const recognized=isRecognizedPayment(status);const numberInput=el('salesReceiptReceiptNo');
  if(kind==='invoice')editingInvoiceNo=String(numberInput?.value||editingInvoiceNo||(editingReceiptNo?deriveInvoiceNo(editingReceiptNo):nextDocumentNo('invoice'))).trim();else editingReceiptNo=String(numberInput?.value||editingReceiptNo||(editingInvoiceNo?deriveReceiptNo(editingInvoiceNo):nextDocumentNo('receipt'))).trim();
  const c=manualCalc(items,formExtras());const dateRaw=el('salesReceiptSaleDate')?.value||localDateTimeInput();const saleDateMs=parseMalaysiaDateTime(dateRaw);const categories=[...new Set(c.items.map(i=>i.category))];
  const existing=manualRows.find(r=>r.docId===editingDocId);const transitionedToPaid=status==='paid'&&editingOriginalStatus!=='paid';
  await ensureUniqueManualNumbers(kind,saleDateMs,editingDocId);if(numberInput)numberInput.value=kind==='invoice'?editingInvoiceNo:editingReceiptNo;
  const documentNo=kind==='invoice'?editingInvoiceNo:editingReceiptNo;
  const payload={uid:user.uid,source:MANUAL_SOURCE,documentType:kind,documentNo,invoiceNo:editingInvoiceNo||'',receiptNo:editingReceiptNo||'',paymentRecognized:recognized,amountDue:recognized?0:c.gross,paidGross:recognized?c.gross:0,recognizedTotalCost:recognized?c.totalCost:0,recognizedProfit:recognized?c.profit:0,invoiceDateMs:num(existing?.invoiceDateMs)||(kind==='invoice'?saleDateMs:(num(existing?.saleDateMs)||saleDateMs)),customerName:customer,customerPhone:String(el('salesReceiptCustomerPhone')?.value||'').trim(),customerEmail:String(el('salesReceiptCustomerEmail')?.value||'').trim(),status,paymentMethod:String(el('salesReceiptPaymentMethod')?.value||'Other'),saleDate:dateRaw.slice(0,10),saleDateTime:dateRaw,saleDateMs,dateTimeVersion:739,items:c.items,categories,category:categories.length===1?categories[0]:'mixed',subtotal:c.subtotal,discount:c.discount,shippingCharge:c.shippingCharge,gross:c.gross,productCost:c.productCost,shippingCost:c.shippingCost,paymentFee:c.paymentFee,commission:c.commission,otherCost:c.otherCost,totalCost:c.totalCost,profit:c.profit,notes:String(el('salesReceiptNotes')?.value||'').trim(),updatedAt:serverTimestamp(),updatedAtMs:Date.now(),createdByUid:user.uid,createdByEmail:user.email||''};
  if(recognized){payload.paidAtMs=num(existing?.paidAtMs)||(transitionedToPaid?Date.now():saleDateMs);if(transitionedToPaid||!editingDocId)payload.paidAt=serverTimestamp()}
  const wasEditing=Boolean(editingDocId);const editId=editingDocId;const btn=el('salesReceiptSave');const label=kind==='invoice'?'Invoice':'Receipt';btn.disabled=true;btn.textContent='Saving...';
  try{
    if(wasEditing)await updateDoc(doc(db,'receipts',editId),payload);else await addDoc(collection(db,'receipts'),{...payload,createdAt:serverTimestamp(),createdAtMs:Date.now()});
    closeForm();
    if(transitionedToPaid)notify('Payment marked Paid. Invoice converted to Receipt and included in sales, costs and net profit.');
    else notify(`${label} ${wasEditing?'updated':'created'}.`);
    await loadData();
  }
  catch(e){console.error(e);notify('Save failed: '+(e.message||e),true)}finally{btn.disabled=false;btn.textContent='Save '+label}
}
function findRow(id){return [...manualRows,...websiteRows].find(r=>r.id===id)}
async function deleteManual(id){const row=manualRows.find(r=>r.id===id);if(!row)return;const label=documentKindForStatus(row.status)==='invoice'?'invoice':'receipt';if(!confirm(`Delete ${label} ${currentDocumentNo(row)}? This cannot be undone.`))return;try{await deleteDoc(doc(db,'receipts',row.docId));notify(`${label[0].toUpperCase()+label.slice(1)} deleted.`);await loadData()}catch(e){notify('Delete failed: '+(e.message||e),true)}}
async function adminBackendHeaders(){
  const headers={'Content-Type':'application/json'};const user=await waitForUser();
  if(user)headers.Authorization='Bearer '+await user.getIdToken();
  try{const key=sessionStorage.getItem('azobssAdminApiKey')||localStorage.getItem('azobssAdminApiKey')||localStorage.getItem('azobssLuckyDrawAdminKey')||'';if(key)headers['x-admin-key']=key}catch(_e){}
  return headers;
}
async function deleteWebsiteRecord(id,button=null){
  const row=websiteRows.find(r=>r.id===id);if(!row)return;
  const label=documentKindForStatus(row.status)==='invoice'?'invoice':'receipt';const paidWarning=isRecognizedPayment(row.status)?'\n\nWarning: this is a Paid record and deleting it removes it from sales and profit totals.':'';
  if(!confirm(`Delete website ${label} ${currentDocumentNo(row)}?\n\nThis permanently removes the related website payment record(s).${paidWarning}`))return;
  const refs=mergeDeleteRefs(row.deleteRefs||[websiteDeleteRef(row,row.docId,row.sourceName)]);
  if(!refs.length)return notify('No deletable website record reference was found.',true);
  if(button){button.disabled=true;button.classList.add('busy')}
  try{
    const res=await fetch(BACKEND+'/api/admin/payment-logs/delete',{method:'POST',headers:await adminBackendHeaders(),body:JSON.stringify({records:refs}),cache:'no-store'});
    const text=await res.text();let data={};try{data=JSON.parse(text)}catch(_e){throw new Error('Invalid backend response while deleting the website record.')}if(!res.ok||data.ok===false)throw new Error(data.error||`Delete HTTP ${res.status}`);
    notify(`Deleted ${data.deleted||refs.length} website payment record(s).`);await loadData();
  }catch(error){
    console.warn('Backend website record delete failed:',error);
    let removed=0;const errors=[];
    for(const ref of refs){
      if(ref.collection!=='purchaseLogs'||!ref.docId)continue;
      try{await deleteDoc(doc(db,'purchaseLogs',ref.docId));removed++}catch(e){errors.push(e?.message||String(e))}
    }
    if(removed){notify(`Deleted ${removed} Firestore purchase record(s). Render backend is still required to remove any premium-order backup.`);await loadData()}
    else notify('Website record delete failed: '+(error?.message||error)+(errors.length?' • '+errors[0]:''),true);
  }finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
async function deleteRow(id,button=null){
  const row=findRow(id);if(!row)return;
  if(row.source==='manual')return deleteManual(id);
  return deleteWebsiteRecord(id,button);
}
function documentType(value){return String(value||'').toLowerCase()==='invoice'?'invoice':'receipt'}
function documentNo(row,type){
  const api=pdfApi();if(api?.documentNumber)return api.documentNumber(row,type);
  return documentType(type)==='invoice'?invoiceNoForRow(row):receiptNoForRow(row);
}
function customerDocumentHtml(row,type='receipt'){
  const docType=documentType(type);const isInvoice=docType==='invoice';const title=isInvoice?'INVOICE':'RECEIPT';const docNo=documentNo(row,docType);
  const itemRows=(row.items||[]).map((i,index)=>`<tr><td class="no">${index+1}</td><td class="description">${esc(i.name)}</td><td>${esc(categoryLabel(i.category))}</td><td>${num(i.qty)}</td><td class="amount">${money(i.unitPrice)}</td><td class="amount strong">${money(num(i.qty)*num(i.unitPrice))}</td></tr>`).join('');
  const finalLabel=isInvoice?'Total Payable':(String(row.status||'').toLowerCase()==='paid'?'Total Paid':'Total');
  const rightTitle=isInvoice?'Billing Details':'Payment Details';
  const rightBody=isInvoice?`<div><b>Payment Terms</b><div>${esc(row.paymentTerms||'Due upon receipt')}</div></div><div style="margin-top:8px"><b>Status</b><div><span class="status">${esc(String(row.status||'pending').toUpperCase())}</span></div></div>`:`<div><b>Payment Method</b><div>${esc(row.paymentMethod||'-')}</div></div>${row.invoiceNo?`<div style="margin-top:8px"><b>Invoice Reference</b><div>${esc(row.invoiceNo)}</div></div>`:''}<div style="margin-top:8px"><b>Status</b><div><span class="status">${esc(String(row.status||'pending').toUpperCase())}</span></div></div>`;
  const footer=isInvoice?'This invoice requests payment and is not proof that payment has been received.':'Thank you for your purchase. This computer-generated receipt records the payment status shown above.';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docNo)}</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#4b5563;margin:0}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #cbd5e1;padding-bottom:14px}.brandline{display:flex;align-items:center;gap:10px}.brand-logo{width:36px;height:36px;display:block;border-radius:7px;object-fit:cover}.brand{font-size:36px;line-height:36px;font-weight:900;letter-spacing:.2px}.muted{color:#64748b;font-size:12px}.doc-title{text-align:right}.doc-title h2{margin:0;font-size:24px;color:#334155}.status{display:inline-block;border:1px solid #94a3b8;border-radius:999px;padding:5px 10px;font-weight:800}.info{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0}.box{border:1px solid #cbd5e1;border-radius:10px;padding:12px}.box b{display:block;color:#475569;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed}th,td{border:1px solid #d7dee8;padding:9px 7px;font-size:12px;vertical-align:middle;text-align:center}th{background:#e2e8f0;color:#334155;text-transform:uppercase;font-size:10px;letter-spacing:.04em;height:38px}.no{width:6%}.description{width:37%;text-align:center;font-weight:700;line-height:1.35}.amount{text-align:right}.strong{font-weight:900;color:#047857}.totals{width:360px;max-width:100%;margin:18px 0 0 auto;border:1px solid #a7f3d0;padding:10px 14px;background:#ecfdf5}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{font-size:18px;font-weight:900;border-top:2px solid #94a3b8;margin-top:6px;padding-top:10px!important;color:#047857}.foot{margin-top:34px;text-align:center;color:#64748b;font-size:11px}.note{margin-top:22px;background:#fffbeb;border-color:#fbbf24}@media print{button{display:none}}</style></head><body><div class="head"><div><div class="brandline"><img class="brand-logo" src="/favicon-192x192.png" alt="AZOBSS logo"><div class="brand">AZOBSS</div></div><div class="muted">www.azobss.com</div></div><div class="doc-title"><h2>${title}</h2><div>${esc(docNo)}</div><div class="muted">${formatDate(docType==='receipt'?currentDocumentDateMs(row):(num(row.invoiceDateMs)||row.saleDateMs))}</div></div></div><div class="info"><div class="box"><b>${isInvoice?'Bill To':'Customer'}</b><div>${esc(row.customerName)}</div><div class="muted">${esc(row.customerPhone||'')}</div><div class="muted">${esc(row.customerEmail||'')}</div></div><div class="box"><b>${rightTitle}</b>${rightBody}</div></div><table><thead><tr><th style="width:6%">No.</th><th style="width:37%">Description</th><th style="width:15%">Category</th><th style="width:8%">Qty</th><th style="width:16%">Unit Price</th><th style="width:18%">Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="totals"><div><span>Subtotal</span><b>${money(row.subtotal)}</b></div>${num(row.discount)>0?`<div><span>Discount</span><b>- ${money(row.discount)}</b></div>`:''}${num(row.shippingCharge)>0?`<div><span>Shipping</span><b>${money(row.shippingCharge)}</b></div>`:''}<div class="grand"><span>${finalLabel}</span><span>${money(row.gross)}</span></div></div>${row.notes?`<div class="box note"><b>Notes</b><div>${esc(row.notes)}</div></div>`:''}<div class="foot">${footer}</div><script>setTimeout(()=>{window.focus();window.print()},350)<\/script></body></html>`;
}
function printDocument(row,type='receipt'){const w=window.open('','_blank','width=900,height=750');if(!w)return notify('Popup blocked. Allow popups to print the document.',true);try{w.opener=null}catch(_e){}w.document.open();w.document.write(customerDocumentHtml(row,type));w.document.close()}
function pdfApi(){return window.AZOBSSAdminSalesReceiptPDF||null}
function documentShareText(row,type,fileName=''){
  const docType=documentType(type);const label=docType==='invoice'?'Invoice':'Receipt';
  return [`AZOBSS ${label} ${documentNo(row,docType)}`,`Customer: ${row.customerName}`,`${docType==='invoice'?'Amount Due':'Total'}: ${money(row.gross)}`,`Status: ${String(row.status||'pending').toUpperCase()}`,fileName?`PDF: ${fileName}`:''].filter(Boolean).join('\n');
}
function downloadDocumentPdf(row,type='receipt',button=null){
  const api=pdfApi();if(!api)return notify('PDF generator is unavailable. Refresh this page and try again.',true);
  try{if(button){button.disabled=true;button.classList.add('busy')}const name=api.download(row,type);notify(`PDF downloaded: ${name}`);return name}
  catch(e){console.error(e);notify('PDF generation failed: '+(e.message||e),true);return ''}
  finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
function normalizeWhatsAppPhone(value){let phone=String(value||'').replace(/\D/g,'');if(phone.startsWith('0'))phone='60'+phone.slice(1);return phone}
async function copyPlainText(value){
  const text=String(value||'');if(!text)throw new Error('Nothing to copy.');
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return}
  const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';area.style.pointerEvents='none';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('Clipboard access was blocked by the browser.');
}
async function uploadShareBlob(blob,filename,reference,contentType='application/pdf'){
  if(!blob||!Number(blob.size))throw new Error('Generated file is empty.');
  const res=await fetch(BACKEND+'/api/admin/sales-document/share-link',{method:'POST',headers:await adminBackendHeaders(),body:JSON.stringify({filename,size:blob.size,contentType,documentNo:reference}),cache:'no-store'});
  const text=await res.text();let data={};try{data=JSON.parse(text)}catch(_e){}
  if(!res.ok||data.ok===false||!data.uploadUrl||!data.shareUrl)throw new Error(data.error||`Share-link HTTP ${res.status}`);
  const upload=await fetch(data.uploadUrl,{method:'PUT',headers:{'Content-Type':contentType},body:blob,cache:'no-store'});
  const uploadText=await upload.text();if(!upload.ok){let detail=uploadText;try{detail=JSON.parse(uploadText).error||detail}catch(_e){}throw new Error(detail||`R2 upload HTTP ${upload.status}`)}
  return data;
}
async function createDocumentShareLink(row,type='receipt'){
  const api=pdfApi();if(!api)throw new Error('PDF generator is unavailable. Refresh this page and try again.');
  const file=api.createFile(row,type);return uploadShareBlob(file,file.name,documentNo(row,type),'application/pdf');
}
async function copyDocumentShareLink(row,type='receipt',button=null){
  if(button){button.disabled=true;button.classList.add('busy')}
  try{const data=await createDocumentShareLink(row,type);await copyPlainText(data.shareUrl);notify(`PDF link copied. Link valid until ${new Date(data.expiresAt).toLocaleDateString('en-MY')}.`);return data.shareUrl}
  catch(e){console.error(e);notify('Could not create/copy PDF link: '+(e.message||e),true);return ''}
  finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
function setDirectShareWindow(targetWindow,url){
  if(targetWindow&&!targetWindow.closed){try{targetWindow.location.replace(url);return true}catch(_e){try{targetWindow.location.href=url;return true}catch(__e){}}}
  const opened=window.open(url,'_blank','noopener');return !!opened;
}
function directShareUrl(row,type,target,shareUrl){
  const label=documentType(type)==='invoice'?'Invoice':'Receipt';
  const text=[`AZOBSS ${label} ${documentNo(row,type)}`,`Customer: ${row.customerName}`,`${documentType(type)==='invoice'?'Amount Due':'Total'}: ${money(row.gross)}`,`Status: ${String(row.status||'pending').toUpperCase()}`,`PDF: ${shareUrl}`].join('\n');
  if(target==='whatsapp'){
    const phone=normalizeWhatsAppPhone(row.customerPhone);return phone?`https://wa.me/${phone}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
  }
  return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text.replace(`PDF: ${shareUrl}`,'').trim())}`;
}
function nativeFileShareSupported(files){
  if(!navigator.share)return false;
  try{return !navigator.canShare||navigator.canShare({files})}catch(_e){return false}
}
async function shareDocumentPdf(row,type,button=null){
  const api=pdfApi();
  if(!api)return notify('PDF generator is unavailable. Refresh this page and try again.',true);
  if(button){button.disabled=true;button.classList.add('busy')}
  try{
    const file=api.createFile(row,type);
    if(nativeFileShareSupported([file])){
      await navigator.share({files:[file],title:`AZOBSS ${documentType(type)==='invoice'?'Invoice':'Receipt'} ${documentNo(row,type)}`,text:documentShareText(row,type)});
      notify('PDF file sent to the Windows/phone share panel. Choose any available app.');
      return;
    }
    api.download(row,type);
    notify('This browser cannot share the PDF file directly. The PDF was downloaded for manual attachment.',true);
  }catch(e){
    if(e&&e.name==='AbortError')return;
    console.error(e);notify('PDF file sharing failed: '+(e.message||e),true)
  }finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
const AZ_SR_CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0}return table})();
function crc32(bytes){let crc=0xffffffff;for(const value of bytes)crc=AZ_SR_CRC_TABLE[(crc^value)&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0}
function zipDosTime(ms=Date.now()){const d=new Date(ms);const year=Math.max(1980,d.getFullYear());return {time:((d.getHours()&31)<<11)|((d.getMinutes()&63)<<5)|((Math.floor(d.getSeconds()/2))&31),date:(((year-1980)&127)<<9)|(((d.getMonth()+1)&15)<<5)|(d.getDate()&31)}}
function write16(view,offset,value){view.setUint16(offset,value&0xffff,true)}
function write32(view,offset,value){view.setUint32(offset,value>>>0,true)}
function concatUint8(parts){const size=parts.reduce((sum,p)=>sum+p.length,0);const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length}return out}
function buildStoredZip(entries){
  const encoder=new TextEncoder();const locals=[];const centrals=[];let offset=0;
  for(const entry of entries){const nameBytes=encoder.encode(entry.name);const data=entry.bytes instanceof Uint8Array?entry.bytes:new Uint8Array(entry.bytes);const crc=crc32(data);const dt=zipDosTime(entry.lastModified||Date.now());
    const local=new Uint8Array(30+nameBytes.length);const lv=new DataView(local.buffer);write32(lv,0,0x04034b50);write16(lv,4,20);write16(lv,6,0x0800);write16(lv,8,0);write16(lv,10,dt.time);write16(lv,12,dt.date);write32(lv,14,crc);write32(lv,18,data.length);write32(lv,22,data.length);write16(lv,26,nameBytes.length);write16(lv,28,0);local.set(nameBytes,30);locals.push(local,data);
    const central=new Uint8Array(46+nameBytes.length);const cv=new DataView(central.buffer);write32(cv,0,0x02014b50);write16(cv,4,20);write16(cv,6,20);write16(cv,8,0x0800);write16(cv,10,0);write16(cv,12,dt.time);write16(cv,14,dt.date);write32(cv,16,crc);write32(cv,20,data.length);write32(cv,24,data.length);write16(cv,28,nameBytes.length);write16(cv,30,0);write16(cv,32,0);write16(cv,34,0);write16(cv,36,0);write32(cv,38,0);write32(cv,42,offset);central.set(nameBytes,46);centrals.push(central);offset+=local.length+data.length;
  }
  const centralBytes=concatUint8(centrals);const end=new Uint8Array(22);const ev=new DataView(end.buffer);write32(ev,0,0x06054b50);write16(ev,4,0);write16(ev,6,0);write16(ev,8,entries.length);write16(ev,10,entries.length);write32(ev,12,centralBytes.length);write32(ev,16,offset);write16(ev,20,0);return concatUint8([...locals,centralBytes,end]);
}
function uniquePdfEntries(rows){const api=pdfApi();if(!api)throw new Error('PDF generator is unavailable.');const used=new Map();return rows.map(row=>{const type=documentKindForStatus(row.status);let name=api.filename(row,type);const count=(used.get(name)||0)+1;used.set(name,count);if(count>1)name=name.replace(/\.pdf$/i,`-${count}.pdf`);return {name,bytes:api.buildBytes(row,type),row,type,lastModified:Date.now()}})}
function bulkZipName(count){return `AZOBSS-Invoices-Receipts-${localDateInput()}-${count}-files.zip`}
function downloadBytes(bytes,name,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);return name}
async function bulkDownloadSelected(button=null){const rows=getSelectedRows();if(!rows.length)return notify('Select at least one record first.',true);if(button){button.disabled=true;button.classList.add('busy')}try{const entries=uniquePdfEntries(rows);const zip=buildStoredZip(entries);const name=downloadBytes(zip,bulkZipName(entries.length),'application/zip');notify(`Downloaded ${entries.length} selected PDF(s) in ${name}.`)}catch(e){console.error(e);notify('Bulk download failed: '+(e.message||e),true)}finally{if(button){button.classList.remove('busy');updateBulkUI()}}}
function bulkShareSummary(rows){const docs=rows.slice(0,8).map(r=>`${documentKindForStatus(r.status)==='invoice'?'Invoice':'Receipt'} ${currentDocumentNo(r)} - ${r.customerName}`);return [`AZOBSS selected documents: ${rows.length}`,...docs,rows.length>8?`+${rows.length-8} more document(s)`:'' ].filter(Boolean).join('\n')}
async function createSelectedBundleShareLink(rows){
  const entries=uniquePdfEntries(rows);const zipBytes=buildStoredZip(entries);const zipName=bulkZipName(entries.length);const blob=new Blob([zipBytes],{type:'application/zip'});return uploadShareBlob(blob,zipName,`BULK-${localDateInput()}-${entries.length}`,'application/zip');
}
async function bulkCopyLinkSelected(button=null){
  const rows=getSelectedRows();if(!rows.length)return notify('Select at least one record first.',true);if(button){button.disabled=true;button.classList.add('busy')}
  try{const data=await createSelectedBundleShareLink(rows);await copyPlainText(data.shareUrl);notify(`Bulk ZIP link copied for ${rows.length} selected document(s).`)}catch(e){console.error(e);notify('Bulk link failed: '+(e.message||e),true)}finally{if(button){button.classList.remove('busy');updateBulkUI()}}
}
async function bulkShareSelected(button=null){
  const rows=getSelectedRows();if(!rows.length)return notify('Select at least one record first.',true);
  const customers=new Set(rows.map(r=>normalizeWhatsAppPhone(r.customerPhone)||String(r.customerEmail||r.customerName||'').toLowerCase()));
  if(customers.size>1&&!confirm(`${rows.length} selected documents belong to ${customers.size} different customers. They will be shared together. Continue?`))return;
  if(button){button.disabled=true;button.classList.add('busy')}
  try{
    const entries=uniquePdfEntries(rows);const files=entries.map(entry=>new File([entry.bytes],entry.name,{type:'application/pdf',lastModified:entry.lastModified||Date.now()}));
    if(nativeFileShareSupported(files)){
      await navigator.share({files,title:`AZOBSS ${rows.length} selected document(s)`,text:bulkShareSummary(rows)});
      notify(`${rows.length} PDF file(s) sent to the share panel. Choose any available app.`);
      return;
    }
    const zipBytes=buildStoredZip(entries);downloadBytes(zipBytes,bulkZipName(entries.length),'application/zip');
    notify('This browser cannot share multiple PDF files directly. A ZIP was downloaded for manual attachment.',true);
  }catch(e){
    if(e&&e.name==='AbortError')return;
    console.error(e);notify('Bulk PDF sharing failed: '+(e.message||e),true)
  }finally{if(button){button.disabled=false;button.classList.remove('busy');updateBulkUI()}}
}
async function bulkDeleteSelected(button=null){
  const rows=getSelectedRows();if(!rows.length)return notify('Select at least one record first.',true);const paid=rows.filter(r=>isRecognizedPayment(r.status)).length;const manual=rows.filter(r=>r.source==='manual');const website=rows.filter(r=>r.source==='website');const warning=paid?`\n\nWarning: ${paid} Paid record(s) will be removed from sales and profit totals.`:'';
  if(!confirm(`Delete ${rows.length} selected record(s)?\n\nManual: ${manual.length}\nWebsite: ${website.length}${warning}\n\nThis cannot be undone.`))return;if(button){button.disabled=true;button.classList.add('busy')}
  let deleted=0;const errors=[];
  try{
    const manualResults=await Promise.allSettled(manual.map(row=>deleteDoc(doc(db,'receipts',row.docId))));manualResults.forEach(result=>{if(result.status==='fulfilled')deleted++;else errors.push(result.reason?.message||String(result.reason))});
    const refs=mergeDeleteRefs(...website.map(row=>row.deleteRefs||[websiteDeleteRef(row,row.docId,row.sourceName)]));
    if(refs.length){try{const res=await fetch(BACKEND+'/api/admin/payment-logs/delete',{method:'POST',headers:await adminBackendHeaders(),body:JSON.stringify({records:refs}),cache:'no-store'});const text=await res.text();let data={};try{data=JSON.parse(text)}catch(_e){}if(!res.ok||data.ok===false)throw new Error(data.error||`Delete HTTP ${res.status}`);deleted+=website.length}catch(error){console.warn('Bulk backend website delete failed:',error);let fallbackDeleted=0;for(const ref of refs){if(ref.collection!=='purchaseLogs'||!ref.docId)continue;try{await deleteDoc(doc(db,'purchaseLogs',ref.docId));fallbackDeleted++}catch(e){errors.push(e?.message||String(e))}}const websiteWithPurchaseRef=website.filter(row=>(row.deleteRefs||[]).some(ref=>ref.collection==='purchaseLogs'&&ref.docId)).length;deleted+=Math.min(fallbackDeleted,websiteWithPurchaseRef);if(!fallbackDeleted)errors.push(error?.message||String(error))}}
    selectedRowIds.clear();await loadData();if(errors.length)notify(`Deleted ${deleted} record(s). ${errors.length} operation(s) could not be completed.`,true);else notify(`Deleted ${rows.length} selected record(s).`)
  }catch(e){console.error(e);notify('Bulk delete failed: '+(e.message||e),true)}finally{if(button){button.classList.remove('busy');updateBulkUI()}}
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
function exportCsv(){
  const headers=['Document Type','Document No','Invoice No','Receipt No','Date','Source','Status','Customer','Phone','Email','Categories','Items','Payment Method','Invoice Amount / Total','Paid Gross','Product Cost','Shipping Charged','Shipping Cost','Payment Fee','Commission','Other Cost','Recognized Costs','Net Profit'];
  const rows=visibleRows.map(r=>[documentKindForStatus(r.status),currentDocumentNo(r),r.invoiceNo||'',r.receiptNo||'',new Date(r.saleDateMs||0).toISOString(),r.source,r.status,r.customerName,r.customerPhone,r.customerEmail,categoriesForRow(r).map(categoryLabel).join(' | '),(r.items||[]).map(i=>`${i.name} x${i.qty}`).join(' | '),r.paymentMethod,num(r.gross).toFixed(2),recognizedGross(r).toFixed(2),num(r.productCost).toFixed(2),num(r.shippingCharge).toFixed(2),num(r.shippingCost).toFixed(2),num(r.paymentFee).toFixed(2),num(r.commission).toFixed(2),num(r.otherCost).toFixed(2),recognizedCosts(r).toFixed(2),recognizedProfit(r).toFixed(2)]);
  const csv='\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='AZOBSS-Sales-Invoices-Receipts-'+localDateInput()+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);notify('CSV exported.')
}
function clearFilters(){['salesReceiptSearch','salesReceiptFrom','salesReceiptTo'].forEach(id=>{if(el(id))el(id).value=''});if(el('salesReceiptCategory'))el('salesReceiptCategory').value='all';if(el('salesReceiptStatus'))el('salesReceiptStatus').value='all';if(el('salesReceiptSource'))el('salesReceiptSource').value='all';if(el('salesReceiptSort'))el('salesReceiptSort').value='newest';currentPage=1;applyFilters()}
function bind(){
  if(window.__azSalesReceiptsBound)return;window.__azSalesReceiptsBound=true;
  ['salesReceiptSearch','salesReceiptCategory','salesReceiptStatus','salesReceiptSource','salesReceiptSort','salesReceiptFrom','salesReceiptTo'].forEach(id=>el(id)?.addEventListener(id==='salesReceiptSearch'?'input':'change',()=>{currentPage=1;applyFilters()}));
  el('salesReceiptNew')?.addEventListener('click',()=>openForm());el('salesReceiptRefresh')?.addEventListener('click',loadData);el('salesReceiptExport')?.addEventListener('click',exportCsv);el('salesReceiptClearFilters')?.addEventListener('click',clearFilters);el('salesReceiptPrev')?.addEventListener('click',()=>{if(currentPage>1){currentPage--;renderTable()}});el('salesReceiptNext')?.addEventListener('click',()=>{const p=Math.ceil(visibleRows.length/PAGE_SIZE);if(currentPage<p){currentPage++;renderTable()}});
  el('salesReceiptSelectAllFiltered')?.addEventListener('change',e=>setRowsSelected(visibleRows,e.target.checked));el('salesReceiptSelectPage')?.addEventListener('change',e=>setRowsSelected(currentPageRows(),e.target.checked));
  el('salesReceiptBulkDownload')?.addEventListener('click',e=>bulkDownloadSelected(e.currentTarget));el('salesReceiptBulkCopyLink')?.addEventListener('click',e=>bulkCopyLinkSelected(e.currentTarget));el('salesReceiptBulkShare')?.addEventListener('click',e=>bulkShareSelected(e.currentTarget));el('salesReceiptBulkDelete')?.addEventListener('click',e=>bulkDeleteSelected(e.currentTarget));
  el('salesReceiptAddItem')?.addEventListener('click',()=>addItemRow({category:'physical',name:'',qty:1,unitPrice:0,unitCost:0}));el('salesReceiptDialogClose')?.addEventListener('click',closeForm);el('salesReceiptCancel')?.addEventListener('click',closeForm);el('salesReceiptSave')?.addEventListener('click',saveForm);el('salesReceiptDialog')?.addEventListener('click',e=>{if(e.target===el('salesReceiptDialog'))closeForm()});
  ['salesReceiptDiscount','salesReceiptShippingCharge','salesReceiptShippingCost','salesReceiptPaymentFee','salesReceiptCommission','salesReceiptOtherCost'].forEach(id=>el(id)?.addEventListener('input',recalcForm));
  el('salesReceiptFormStatus')?.addEventListener('change',()=>syncFormDocumentMode(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('salesReceiptDialog')?.hidden)closeForm()});
  document.addEventListener('change',e=>{const checkbox=e.target.closest('[data-sr-select]');if(!checkbox)return;const id=checkbox.dataset.srSelect;if(checkbox.checked)selectedRowIds.add(id);else selectedRowIds.delete(id);updateBulkUI()});
  document.addEventListener('click',e=>{const edit=e.target.closest('[data-sr-edit]');if(edit){const row=manualRows.find(r=>r.id===edit.dataset.srEdit);if(row)openForm(row);return}const del=e.target.closest('[data-sr-delete-row]');if(del){deleteRow(del.dataset.srDeleteRow,del);return}const dl=e.target.closest('[data-sr-doc-download]');if(dl){const row=findRow(dl.dataset.srRow);if(row)downloadDocumentPdf(row,dl.dataset.srDocDownload,dl);return}const cp=e.target.closest('[data-sr-doc-copy]');if(cp){const row=findRow(cp.dataset.srRow);if(row)copyDocumentShareLink(row,cp.dataset.srDocCopy,cp);return}const pr=e.target.closest('[data-sr-doc-print]');if(pr){const row=findRow(pr.dataset.srRow);if(row)printDocument(row,pr.dataset.srDocPrint);return}const share=e.target.closest('[data-sr-doc-share]');if(share){const row=findRow(share.dataset.srRow);if(row)shareDocumentPdf(row,share.dataset.srDocType,share)}});
}
let salesReceiptsAutoLoadQueued=false;
async function autoLoadSalesReceiptsWhenActive(){
  const section=el('salesreceipts');
  if(!section?.classList.contains('active'))return;
  if(salesReceiptsAutoLoadQueued)return loadingPromise||Promise.resolve();
  salesReceiptsAutoLoadQueued=true;
  try{
    bind();
    return await loadData();
  }catch(error){
    console.error('Sales & Receipts automatic load failed:',error);
  }finally{
    salesReceiptsAutoLoadQueued=false;
  }
}
window.azSalesReceiptsLoad=async function(){bind();return loadData()};
bind();

// The admin tab can be opened before this ES module finishes importing Firebase.
// Load immediately when the section is already active, when auth becomes ready,
// and whenever the section later receives the active class.
const queueSalesReceiptsAutoLoad=()=>setTimeout(()=>autoLoadSalesReceiptsWhenActive(),0);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueSalesReceiptsAutoLoad,{once:true});
else queueSalesReceiptsAutoLoad();
onAuthStateChanged(auth,user=>{if(user)queueSalesReceiptsAutoLoad()});
const salesReceiptsSection=el('salesreceipts');
if(salesReceiptsSection){
  new MutationObserver(()=>{
    if(salesReceiptsSection.classList.contains('active'))queueSalesReceiptsAutoLoad();
  }).observe(salesReceiptsSection,{attributes:true,attributeFilter:['class']});
}
