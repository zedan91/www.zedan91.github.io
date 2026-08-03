/* AZOBSS PATCH 722: Unified Admin Sales & Receipts + real PDF download/share */
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
let loadingPromise=null;

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
function localDateInput(ms=Date.now()){
  const d=new Date(ms);const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;
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
function formatDate(ms){if(!ms)return '-';try{return new Date(ms).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'})}catch(_e){return new Date(ms).toLocaleString()}}
function normalizeStatus(v,paidFlag=false){
  const s=String(v||'').trim().toLowerCase();
  if(paidFlag||['paid','verified','success','successful','completed','complete','approved','confirmed','settled'].includes(s))return 'paid';
  if(s.includes('refund'))return 'refunded';
  if(s.includes('cancel')||['void','aborted'].includes(s))return 'cancelled';
  if(s.includes('fail')||s.includes('reject')||s.includes('declin')||s.includes('error')||s.includes('expired'))return 'failed';
  return 'pending';
}
function detectCategory(x={}){
  const product=x.product||{};
  const hay=[x.category,x.productCategory,x.productType,x.type,x.source,x.sourcePage,x.productName,x.productTitle,x.itemName,x.title,x.name,x.filename,x.productId,x.softwareId,x.cadId,product.category,product.type,product.name,product.title].map(v=>String(v||'').toLowerCase()).join(' ');
  if(/brownie|food|makanan|physical|barang fizikal|hardware|laptop|printer|keyboard|battery|bateri/.test(hay))return 'physical';
  if(/service|servis|repair|format|clone|cleaning|installation/.test(hay))return 'service';
  if(/pa\s*[/+-]?\s*bm|pabm|pelan akui|kadaster|jupem|batu sempadan/.test(hay))return 'pabm';
  if(/cad|autocad|lisp|vlx|dwg/.test(hay))return 'cad';
  if(/software|license|lesen|installer|download/.test(hay))return 'software';
  return 'other';
}
function categoryLabel(v){return ({physical:'Physical',software:'Software',service:'Service',cad:'CAD Tools',pabm:'PA/BM',mixed:'Mixed',other:'Other'})[v]||'Other'}
function extractAmount(x={}){
  for(const k of ['amount','saleAmount','total','totalAmount','price','paymentAmount','amountValue']){const n=num(x[k]);if(n>0)return n}
  const sen=num(x.amountSen||x.paymentAmountSen);return sen>0?sen/100:0;
}
function extractCost(x,keys){for(const k of keys){const n=num(x?.[k]);if(n>0)return n}return 0}
function productName(x={}){const p=x.product||{};return String(x.productName||x.productTitle||x.itemName||x.title||x.name||x.filename||x.itemCode||p.name||p.title||x.productId||'Website Purchase')}
function customerName(x={}){const u=x.user||{};return String(x.customerName||x.buyerName||x.displayName||x.username||x.usernameKey||u.displayName||u.username||x.email||x.buyerEmail||u.email||'Customer')}
function customerEmail(x={}){const u=x.user||{};return String(x.customerEmail||x.email||x.buyerEmail||u.email||'')}
function customerPhone(x={}){const u=x.user||{};return String(x.customerPhone||x.phone||x.phoneNumber||x.buyerPhone||u.phone||u.phoneNumber||'')}
function automaticReceiptNo(x,id){return String(x.receiptNo||x.invoiceNo||x.orderId||x.paymentOrderId||x.billCode||x.paymentReference||('WEB-'+String(id||'').slice(0,10).toUpperCase()))}
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
  return {...x,...c,id,docId:id,source:'manual',editable:true,receiptNo:String(x.receiptNo||('AZR-'+id.slice(0,8).toUpperCase())),customerName:String(x.customerName||'Customer'),customerPhone:String(x.customerPhone||''),customerEmail:String(x.customerEmail||''),status:normalizeStatus(x.status),paymentMethod:String(x.paymentMethod||'Bank Transfer'),saleDateMs:rowDateMs(x)||Date.now(),categories,category:categories.length===1?categories[0]:'mixed'};
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
  return {...x,id:`${sourceName}:${id}`,docId:id,source:'website',sourceName,editable:false,receiptNo:automaticReceiptNo(x,id),customerName:customerName(x),customerPhone:customerPhone(x),customerEmail:customerEmail(x),status,paymentMethod:method,saleDateMs:rowDateMs(x),items:[{category,name:productName(x),qty:1,unitPrice:gross,unitCost:0}],categories:[category],category,subtotal:gross,discount:0,productCost:0,shippingCost:0,paymentFee,commission,otherCost,gross,totalCost,profit:gross-totalCost};
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
    const info=el('salesReceiptResultInfo');if(info)info.textContent='Loading manual receipts and website sales...';
    const user=await waitForUser();if(!user)throw new Error('Admin login not ready. Please sign in again.');
    const [receiptSnap,purchaseSnap,premium]=await Promise.all([
      getDocs(query(collection(db,'receipts'),limit(1000))),
      getDocs(query(collection(db,'purchaseLogs'),limit(1000))),
      loadPremiumOrders(user)
    ]);
    manualRows=[];receiptSnap.forEach(d=>{const x=d.data()||{};if(String(x.source||'')===MANUAL_SOURCE)manualRows.push(normalizeManual(d.id,x))});
    const map=new Map();
    purchaseSnap.forEach(d=>{const x=d.data()||{};const row=normalizeWebsite(d.id,x,'purchaseLogs');if(!/admin[- ]?test|pabmtest/i.test(JSON.stringify(x)))map.set(websiteDedupKey(row),row)});
    premium.forEach((x,i)=>{const id=String(x.orderId||x.docId||x.id||x.billCode||('premium-'+i));const row=normalizeWebsite(id,x,'premiumOrders');const k=websiteDedupKey(row);if(!map.has(k))map.set(k,row)});
    websiteRows=[...map.values()];
    currentPage=1;applyFilters();
    if(info)info.textContent=`Loaded ${manualRows.length} manual receipt(s) and ${websiteRows.length} website sale record(s).`;
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
  const physical=paid.reduce((s,r)=>s+categoryGross(r,new Set(['physical'])),0);
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
    const hay=[r.receiptNo,r.customerName,r.customerEmail,r.customerPhone,r.paymentMethod,r.status,r.sourceName,...(r.items||[]).map(i=>i.name),...categoriesForRow(r)].join(' ').toLowerCase();
    return (!f.q||hay.includes(f.q))&&(f.status==='all'||r.status===f.status)&&(f.source==='all'||r.source===f.source)&&rowMatchesCategory(r,f.category)&&(!from||r.saleDateMs>=from)&&(!to||r.saleDateMs<=to);
  });
  rows.sort((a,b)=>{
    if(f.sort==='oldest')return a.saleDateMs-b.saleDateMs;
    if(f.sort==='gross-high')return num(b.gross)-num(a.gross);
    if(f.sort==='profit-high')return num(b.profit)-num(a.profit);
    if(f.sort==='az')return String(a.customerName).localeCompare(String(b.customerName));
    return b.saleDateMs-a.saleDateMs;
  });
  visibleRows=rows;const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));if(currentPage>pages)currentPage=pages;
  updateKpis(rows);renderTable();
}
function statusPill(status){return `<span class="az-sr-pill ${esc(status)}">${esc(status.toUpperCase())}</span>`}
function sourcePill(row){return `<span class="az-sr-pill ${row.source==='manual'?'manual':'website'}">${row.source==='manual'?'MANUAL':'WEBSITE'}</span>`}
function renderTable(){
  const tbody=el('salesReceiptTableBody');if(!tbody)return;
  const pages=Math.max(1,Math.ceil(visibleRows.length/PAGE_SIZE));const start=(currentPage-1)*PAGE_SIZE;const pageRows=visibleRows.slice(start,start+PAGE_SIZE);
  tbody.innerHTML=pageRows.map(r=>{
    const itemNames=(r.items||[]).map(i=>i.name).filter(Boolean);const itemText=itemNames.slice(0,2).join(', ')+(itemNames.length>2?` +${itemNames.length-2}`:'');
    const actions=`<div class="az-sr-actions"><button class="btn green" data-sr-pdf="${esc(r.id)}" type="button">Download PDF</button><button class="btn az-sr-wa-btn" data-sr-whatsapp="${esc(r.id)}" type="button">WhatsApp PDF</button><button class="btn az-sr-tg-btn" data-sr-telegram="${esc(r.id)}" type="button">Telegram PDF</button><button class="btn gray" data-sr-print="${esc(r.id)}" type="button">Print</button>${r.editable?`<button class="btn" data-sr-edit="${esc(r.id)}" type="button">Edit</button><button class="btn red" data-sr-delete="${esc(r.id)}" type="button">Delete</button>`:''}</div>`;
    return `<tr><td><div class="az-sr-receipt-no">${esc(r.receiptNo)}</div><div class="az-sr-subtext">${formatDate(r.saleDateMs)}</div></td><td><div class="az-sr-customer">${esc(r.customerName)}</div><div class="az-sr-subtext">${esc(r.customerPhone||r.customerEmail||'-')}</div></td><td>${sourcePill(r)}<div class="az-sr-subtext">${esc(categoryLabel(r.category))}</div></td><td><div>${esc(itemText||'Purchase')}</div><div class="az-sr-subtext">${esc(r.paymentMethod||'-')}</div></td><td>${statusPill(r.status)}</td><td class="az-sr-money">${money(r.gross)}</td><td class="az-sr-money">${money(r.totalCost)}</td><td class="az-sr-money ${r.profit>=0?'az-sr-profit':'az-sr-loss'}">${money(r.profit)}</td><td>${actions}</td></tr>`;
  }).join('')||'<tr><td colspan="9"><div class="az-sr-empty">No sales or receipts match the current filter.</div></td></tr>';
  if(el('salesReceiptPageInfo'))el('salesReceiptPageInfo').textContent=`Page ${currentPage} / ${pages} • ${visibleRows.length} record(s)`;
  if(el('salesReceiptPrev'))el('salesReceiptPrev').disabled=currentPage<=1;if(el('salesReceiptNext'))el('salesReceiptNext').disabled=currentPage>=pages;
}
function nextReceiptNo(){
  const date=localDateInput().replaceAll('-','');let max=0;
  manualRows.forEach(r=>{const m=String(r.receiptNo||'').match(new RegExp('^AZR-'+date+'-(\\d{4})$'));if(m)max=Math.max(max,Number(m[1])||0)});
  return `AZR-${date}-${String(max+1).padStart(4,'0')}`;
}
function categoryOptions(selected='physical'){return ['physical','software','service','cad','pabm','other'].map(v=>`<option value="${v}"${v===selected?' selected':''}>${categoryLabel(v)}</option>`).join('')}
function addItemRow(item={}){
  const box=el('salesReceiptItems');if(!box)return;
  const row=document.createElement('div');row.className='az-sr-item-row';
  row.innerHTML=`<label>Category<select data-sr-item-category>${categoryOptions(item.category||'physical')}</select></label><label class="az-sr-item-name">Product / Service<input data-sr-item-name value="${esc(item.name||'')}" placeholder="Product name"></label><label>Quantity<input data-sr-item-qty type="number" min="0.01" step="0.01" value="${num(item.qty)||1}"></label><label>Unit price (RM)<input data-sr-item-price type="number" min="0" step="0.01" value="${num(item.unitPrice)||0}"></label><label>Unit cost (RM)<input data-sr-item-cost type="number" min="0" step="0.01" value="${num(item.unitCost)||0}"></label><button class="az-sr-remove-item" type="button" title="Remove item">×</button>`;
  box.appendChild(row);row.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',recalcForm));row.querySelector('.az-sr-remove-item').addEventListener('click',()=>{if(box.children.length<=1)return notify('At least one item is required.',true);row.remove();recalcForm()});recalcForm();
}
function collectFormItems(){return [...document.querySelectorAll('#salesReceiptItems .az-sr-item-row')].map(row=>({category:row.querySelector('[data-sr-item-category]')?.value||'other',name:String(row.querySelector('[data-sr-item-name]')?.value||'').trim(),qty:num(row.querySelector('[data-sr-item-qty]')?.value)||1,unitPrice:num(row.querySelector('[data-sr-item-price]')?.value),unitCost:num(row.querySelector('[data-sr-item-cost]')?.value)}))}
function formExtras(){return {discount:num(el('salesReceiptDiscount')?.value),shippingCharge:num(el('salesReceiptShippingCharge')?.value),shippingCost:num(el('salesReceiptShippingCost')?.value),paymentFee:num(el('salesReceiptPaymentFee')?.value),commission:num(el('salesReceiptCommission')?.value),otherCost:num(el('salesReceiptOtherCost')?.value)}}
function recalcForm(){const c=manualCalc(collectFormItems(),formExtras());const set=(id,v)=>{if(el(id))el(id).textContent=money(v)};set('salesReceiptCalcSubtotal',c.subtotal);set('salesReceiptCalcGross',c.gross);set('salesReceiptCalcCosts',c.totalCost);set('salesReceiptCalcProfit',c.profit);set('salesReceiptCalcProductCost',c.productCost)}
function openForm(row=null){
  editingDocId=row?.docId||'';el('salesReceiptDialogTitle').textContent=row?'Edit Manual Receipt':'Create Manual Receipt';el('salesReceiptReceiptNo').value=row?.receiptNo||nextReceiptNo();el('salesReceiptSaleDate').value=localDateInput(row?.saleDateMs||Date.now());el('salesReceiptFormStatus').value=row?.status||'paid';el('salesReceiptPaymentMethod').value=row?.paymentMethod||'Bank Transfer';el('salesReceiptCustomerName').value=row?.customerName||'';el('salesReceiptCustomerPhone').value=row?.customerPhone||'';el('salesReceiptCustomerEmail').value=row?.customerEmail||'';el('salesReceiptDiscount').value=num(row?.discount)||0;el('salesReceiptShippingCharge').value=num(row?.shippingCharge)||0;el('salesReceiptShippingCost').value=num(row?.shippingCost)||0;el('salesReceiptPaymentFee').value=num(row?.paymentFee)||0;el('salesReceiptCommission').value=num(row?.commission)||0;el('salesReceiptOtherCost').value=num(row?.otherCost)||0;el('salesReceiptNotes').value=row?.notes||'';
  const box=el('salesReceiptItems');box.innerHTML='';(row?.items?.length?row.items:[{category:'physical',name:'',qty:1,unitPrice:0,unitCost:0}]).forEach(addItemRow);recalcForm();el('salesReceiptDialog').hidden=false;document.body.style.overflow='hidden';setTimeout(()=>el('salesReceiptCustomerName')?.focus(),50);
}
function closeForm(){el('salesReceiptDialog').hidden=true;document.body.style.overflow='';editingDocId=''}
async function saveForm(){
  const user=await waitForUser();if(!user)return notify('Admin login not ready.',true);
  const customer=String(el('salesReceiptCustomerName')?.value||'').trim();const items=collectFormItems();if(!customer)return notify('Enter customer name.',true);if(!items.length||items.some(i=>!i.name))return notify('Enter a name for every item.',true);if(items.some(i=>i.qty<=0))return notify('Quantity must be more than zero.',true);
  const c=manualCalc(items,formExtras());const dateRaw=el('salesReceiptSaleDate')?.value||localDateInput();const saleDateMs=new Date(dateRaw+'T12:00:00').getTime();const categories=[...new Set(c.items.map(i=>i.category))];
  const payload={uid:user.uid,source:MANUAL_SOURCE,receiptNo:String(el('salesReceiptReceiptNo')?.value||nextReceiptNo()),customerName:customer,customerPhone:String(el('salesReceiptCustomerPhone')?.value||'').trim(),customerEmail:String(el('salesReceiptCustomerEmail')?.value||'').trim(),status:normalizeStatus(el('salesReceiptFormStatus')?.value),paymentMethod:String(el('salesReceiptPaymentMethod')?.value||'Other'),saleDate:dateRaw,saleDateMs,items:c.items,categories,category:categories.length===1?categories[0]:'mixed',subtotal:c.subtotal,discount:c.discount,shippingCharge:c.shippingCharge,gross:c.gross,productCost:c.productCost,shippingCost:c.shippingCost,paymentFee:c.paymentFee,commission:c.commission,otherCost:c.otherCost,totalCost:c.totalCost,profit:c.profit,notes:String(el('salesReceiptNotes')?.value||'').trim(),updatedAt:serverTimestamp(),updatedAtMs:Date.now(),createdByUid:user.uid,createdByEmail:user.email||''};
  const wasEditing=Boolean(editingDocId);const editId=editingDocId;const btn=el('salesReceiptSave');btn.disabled=true;btn.textContent='Saving...';
  try{if(wasEditing)await updateDoc(doc(db,'receipts',editId),payload);else await addDoc(collection(db,'receipts'),{...payload,createdAt:serverTimestamp(),createdAtMs:Date.now()});closeForm();notify(wasEditing?'Receipt updated.':'Receipt created.');await loadData()}
  catch(e){console.error(e);notify('Save failed: '+(e.message||e),true)}finally{btn.disabled=false;btn.textContent='Save Receipt'}
}
function findRow(id){return [...manualRows,...websiteRows].find(r=>r.id===id)}
async function deleteManual(id){const row=manualRows.find(r=>r.id===id);if(!row)return;if(!confirm(`Delete receipt ${row.receiptNo}? This cannot be undone.`))return;try{await deleteDoc(doc(db,'receipts',row.docId));notify('Receipt deleted.');await loadData()}catch(e){notify('Delete failed: '+(e.message||e),true)}}
function customerReceiptHtml(row){
  const itemRows=(row.items||[]).map(i=>`<tr><td>${esc(i.name)}</td><td>${esc(categoryLabel(i.category))}</td><td>${num(i.qty)}</td><td>${money(i.unitPrice)}</td><td>${money(num(i.qty)*num(i.unitPrice))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(row.receiptNo)}</title><style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;margin:0}.head{display:flex;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:14px}.brand{font-size:28px;font-weight:900}.muted{color:#555;font-size:12px}.status{display:inline-block;border:1px solid #111;border-radius:999px;padding:5px 10px;font-weight:800}.info{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0}.box{border:1px solid #ccc;border-radius:10px;padding:12px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left;font-size:12px}th{background:#f3f4f6}.totals{width:360px;max-width:100%;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:6px 0}.grand{font-size:18px;font-weight:900;border-top:2px solid #111;margin-top:6px;padding-top:10px!important}.foot{margin-top:34px;text-align:center;color:#555;font-size:11px}@media print{button{display:none}}</style></head><body><div class="head"><div><div class="brand">AZOBSS</div><div class="muted">www.azobss.com</div></div><div style="text-align:right"><h2 style="margin:0">RECEIPT</h2><div>${esc(row.receiptNo)}</div><div class="muted">${formatDate(row.saleDateMs)}</div></div></div><div class="info"><div class="box"><b>Customer</b><div>${esc(row.customerName)}</div><div class="muted">${esc(row.customerPhone||'')}</div><div class="muted">${esc(row.customerEmail||'')}</div></div><div class="box"><b>Payment</b><div>${esc(row.paymentMethod||'-')}</div><div style="margin-top:8px"><span class="status">${esc(row.status.toUpperCase())}</span></div></div></div><table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="totals"><div><span>Subtotal</span><b>${money(row.subtotal)}</b></div>${num(row.discount)>0?`<div><span>Discount</span><b>- ${money(row.discount)}</b></div>`:''}${num(row.shippingCharge)>0?`<div><span>Shipping</span><b>${money(row.shippingCharge)}</b></div>`:''}<div class="grand"><span>Total</span><span>${money(row.gross)}</span></div></div>${row.notes?`<div class="box" style="margin-top:22px"><b>Notes</b><div class="muted">${esc(row.notes)}</div></div>`:''}<div class="foot">Thank you for your purchase. This receipt was generated from AZOBSS Admin Sales & Receipts.</div><script>setTimeout(()=>{window.focus();window.print()},350)<\/script></body></html>`;
}
function printReceipt(row){const w=window.open('','_blank','width=900,height=750');if(!w)return notify('Popup blocked. Allow popups to print the receipt.',true);try{w.opener=null}catch(_e){}w.document.open();w.document.write(customerReceiptHtml(row));w.document.close()}
function pdfApi(){return window.AZOBSSAdminSalesReceiptPDF||null}
function receiptShareText(row,fileName=''){
  return [`AZOBSS Receipt ${row.receiptNo}`,`Customer: ${row.customerName}`,`Total: ${money(row.gross)}`,`Status: ${String(row.status||'pending').toUpperCase()}`,fileName?`PDF: ${fileName}`:''].filter(Boolean).join('\n');
}
function downloadReceiptPdf(row,button=null){
  const api=pdfApi();if(!api)return notify('PDF generator is unavailable. Refresh this page and try again.',true);
  try{if(button){button.disabled=true;button.classList.add('busy')}const name=api.download(row);notify(`PDF downloaded: ${name}`);return name}
  catch(e){console.error(e);notify('PDF generation failed: '+(e.message||e),true);return ''}
  finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
function normalizeWhatsAppPhone(value){let phone=String(value||'').replace(/\D/g,'');if(phone.startsWith('0'))phone='60'+phone.slice(1);return phone}
function openShareFallback(row,target,fileName){
  const text=receiptShareText(row,fileName)+'\n\nThe PDF has been downloaded. Attach the downloaded file in this chat.';
  if(target==='whatsapp'){
    const phone=normalizeWhatsAppPhone(row.customerPhone);const url=phone?`https://wa.me/${phone}?text=${encodeURIComponent(text)}`:`https://wa.me/?text=${encodeURIComponent(text)}`;
    const opened=window.open(url,'_blank','noopener');if(!opened)notify('Popup blocked. The PDF was downloaded; open WhatsApp and attach it manually.',true);else notify('PDF downloaded. WhatsApp opened - attach the downloaded PDF.');return;
  }
  const url='https://t.me/share/url?url='+encodeURIComponent('https://www.azobss.com')+'&text='+encodeURIComponent(text);
  const opened=window.open(url,'_blank','noopener');if(!opened)notify('Popup blocked. The PDF was downloaded; open Telegram and attach it manually.',true);else notify('PDF downloaded. Telegram opened - attach the downloaded PDF.');
}
async function shareReceiptPdf(row,target,button=null){
  const api=pdfApi();if(!api)return notify('PDF generator is unavailable. Refresh this page and try again.',true);
  if(button){button.disabled=true;button.classList.add('busy')}
  try{
    const file=api.createFile(row);const shareData={title:`AZOBSS Receipt ${row.receiptNo}`,text:receiptShareText(row,file.name),files:[file]};
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      notify(`Choose ${target==='telegram'?'Telegram':'WhatsApp'} from the share menu.`);
      await navigator.share(shareData);notify('Receipt PDF shared.');return;
    }
    const name=api.download(row);openShareFallback(row,target,name);
  }catch(e){
    if(e?.name==='AbortError')return;
    console.warn('PDF native share failed:',e);
    try{const name=api.download(row);openShareFallback(row,target,name)}catch(fallbackError){console.error(fallbackError);notify('Could not share the PDF. Download it and attach it manually.',true)}
  }finally{if(button){button.disabled=false;button.classList.remove('busy')}}
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}
function exportCsv(){
  const headers=['Receipt No','Date','Source','Status','Customer','Phone','Email','Categories','Items','Payment Method','Gross','Product Cost','Shipping Charged','Shipping Cost','Payment Fee','Commission','Other Cost','Total Cost','Net Profit'];
  const rows=visibleRows.map(r=>[r.receiptNo,new Date(r.saleDateMs||0).toISOString(),r.source,r.status,r.customerName,r.customerPhone,r.customerEmail,categoriesForRow(r).map(categoryLabel).join(' | '),(r.items||[]).map(i=>`${i.name} x${i.qty}`).join(' | '),r.paymentMethod,num(r.gross).toFixed(2),num(r.productCost).toFixed(2),num(r.shippingCharge).toFixed(2),num(r.shippingCost).toFixed(2),num(r.paymentFee).toFixed(2),num(r.commission).toFixed(2),num(r.otherCost).toFixed(2),num(r.totalCost).toFixed(2),num(r.profit).toFixed(2)]);
  const csv='\ufeff'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='AZOBSS-Sales-Receipts-'+localDateInput()+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);notify('CSV exported.')
}
function clearFilters(){['salesReceiptSearch','salesReceiptFrom','salesReceiptTo'].forEach(id=>{if(el(id))el(id).value=''});if(el('salesReceiptCategory'))el('salesReceiptCategory').value='all';if(el('salesReceiptStatus'))el('salesReceiptStatus').value='all';if(el('salesReceiptSource'))el('salesReceiptSource').value='all';if(el('salesReceiptSort'))el('salesReceiptSort').value='newest';currentPage=1;applyFilters()}
function bind(){
  if(window.__azSalesReceiptsBound)return;window.__azSalesReceiptsBound=true;
  ['salesReceiptSearch','salesReceiptCategory','salesReceiptStatus','salesReceiptSource','salesReceiptSort','salesReceiptFrom','salesReceiptTo'].forEach(id=>el(id)?.addEventListener(id==='salesReceiptSearch'?'input':'change',()=>{currentPage=1;applyFilters()}));
  el('salesReceiptNew')?.addEventListener('click',()=>openForm());el('salesReceiptRefresh')?.addEventListener('click',loadData);el('salesReceiptExport')?.addEventListener('click',exportCsv);el('salesReceiptClearFilters')?.addEventListener('click',clearFilters);el('salesReceiptPrev')?.addEventListener('click',()=>{if(currentPage>1){currentPage--;renderTable()}});el('salesReceiptNext')?.addEventListener('click',()=>{const p=Math.ceil(visibleRows.length/PAGE_SIZE);if(currentPage<p){currentPage++;renderTable()}});
  el('salesReceiptAddItem')?.addEventListener('click',()=>addItemRow({category:'physical',name:'',qty:1,unitPrice:0,unitCost:0}));el('salesReceiptDialogClose')?.addEventListener('click',closeForm);el('salesReceiptCancel')?.addEventListener('click',closeForm);el('salesReceiptSave')?.addEventListener('click',saveForm);el('salesReceiptDialog')?.addEventListener('click',e=>{if(e.target===el('salesReceiptDialog'))closeForm()});
  ['salesReceiptDiscount','salesReceiptShippingCharge','salesReceiptShippingCost','salesReceiptPaymentFee','salesReceiptCommission','salesReceiptOtherCost'].forEach(id=>el(id)?.addEventListener('input',recalcForm));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('salesReceiptDialog')?.hidden)closeForm()});
  document.addEventListener('click',e=>{const edit=e.target.closest('[data-sr-edit]');if(edit){const row=manualRows.find(r=>r.id===edit.dataset.srEdit);if(row)openForm(row);return}const del=e.target.closest('[data-sr-delete]');if(del){deleteManual(del.dataset.srDelete);return}const pdf=e.target.closest('[data-sr-pdf]');if(pdf){const row=findRow(pdf.dataset.srPdf);if(row)downloadReceiptPdf(row,pdf);return}const pr=e.target.closest('[data-sr-print]');if(pr){const row=findRow(pr.dataset.srPrint);if(row)printReceipt(row);return}const wa=e.target.closest('[data-sr-whatsapp]');if(wa){const row=findRow(wa.dataset.srWhatsapp);if(row)shareReceiptPdf(row,'whatsapp',wa);return}const tg=e.target.closest('[data-sr-telegram]');if(tg){const row=findRow(tg.dataset.srTelegram);if(row)shareReceiptPdf(row,'telegram',tg)}});
}
window.azSalesReceiptsLoad=async function(){bind();return loadData()};
bind();
