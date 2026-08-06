
function azobssNum(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const AZOBSS_NEVER_EXPIRE_MS = 100 * 365 * 24 * 60 * 60 * 1000;
function azobssExpiryValueIsNever(value){
  if (value === 0 || value === '0') return true;
  const text = String(value ?? '').trim().toLowerCase();
  return !!text && /(never|no\s*expire|no\s*expiry|lifetime|permanent|tidak\s*tamat|tak\s*tamat)/i.test(text);
}
function azobssExpiryHoursFromOrder(order){
  const product = order && order.product || {};
  const hourCandidates = [
    product.expiryHours, product.linkExpiryHours, product.downloadExpiryHours,
    order && order.expiryHours, order && order.linkExpiryHours, order && order.downloadExpiryHours
  ];
  for (const value of hourCandidates) {
    if (value === undefined || value === null || value === '') continue;
    if (azobssExpiryValueIsNever(value)) return 0;
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.min(24 * 30, n));
  }
  const dayCandidates = [
    product.expiryDays, product.linkExpiryDays, product.downloadExpiryDays,
    order && order.expiryDays, order && order.linkExpiryDays, order && order.downloadExpiryDays
  ];
  for (const value of dayCandidates) {
    if (value === undefined || value === null || value === '') continue;
    if (azobssExpiryValueIsNever(value)) return 0;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.max(0, Math.min(30, n)) * 24;
  }
  const text = String((product.linkExpiry || product.expiry || product.expiryLabel || order && (order.linkExpiry || order.expiry || order.expiryLabel) || '') || '').toLowerCase();
  if (azobssExpiryValueIsNever(text)) return 0;
  const m = text.match(/(\d+(?:\.\d+)?)\s*(day|days|hari|hour|hours|jam)/i);
  if(m){
    const value = Number(m[1]);
    const unit = String(m[2] || '').toLowerCase();
    if(Number.isFinite(value) && value > 0){
      return /hour|jam/.test(unit) ? value : value * 24;
    }
  }
  return 24;
}
function azobssOrderNeverExpire(order){
  if (!order) return false;
  return order.expiresNever === true
    || order.neverExpire === true
    || order.downloadNeverExpire === true
    || azobssExpiryHoursFromOrder(order || {}) === 0;
}
function azobssTokenExpiresAtMsFromOrder(order, now = Date.now()){
  const expiryHours = azobssExpiryHoursFromOrder(order || {});
  if (expiryHours === 0) return now + AZOBSS_NEVER_EXPIRE_MS;
  return now + Math.max(1, Math.min(24 * 30, Number(expiryHours) || 24)) * 60 * 60 * 1000;
}
function azobssTokenIsExpired(row = {}, now = Date.now()){
  if (!row) return true;
  if (row.expiresNever === true || row.neverExpire === true || row.downloadNeverExpire === true) return false;
  const expiresAt = Number(row.expiresAt || row.expiresAtMs || 0) || 0;
  return !!(expiresAt && expiresAt < now);
}
function azobssExpiryLabelForOrder(order){
  if (azobssOrderNeverExpire(order || {})) return 'Never expire';
  if (order && order.tokenExpiresAt) {
    try { return new Date(order.tokenExpiresAt).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }); } catch (_) {}
  }
  return '24 jam';
}
function azobssDownloadLimitFromOrder(order){
  const product = order && order.product || {};
  const candidates = [
    product.downloadLimit, product.maxDownloads, product.maxDownload, product.download_limit,
    order && order.downloadLimit, order && order.maxDownloads, order && order.maxDownload, order && order.download_limit
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.min(20, n));
  }
  return 1;
}


// JUPEM SSL bypass is now scoped only to JUPEM fetch requests.
// Do not set NODE_TLS_REJECT_UNAUTHORIZED globally because it weakens all HTTPS calls.

// AZOBSS Render Backend Server
// Supports: website hosting + affiliate online sync + JUPEM PA hold system

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const url = require("url");
const crypto = require("crypto");
const { Readable } = require("stream");

let azJupemInsecureDispatcher = null;
function azGetJupemDispatcher() {
  if (String(process.env.AZOBSS_STRICT_JUPEM_TLS || "") === "1") return null;
  if (azJupemInsecureDispatcher) return azJupemInsecureDispatcher;
  try {
    const { Agent } = require("undici");
    azJupemInsecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    return azJupemInsecureDispatcher;
  } catch (err) {
    console.warn("AZOBSS JUPEM scoped TLS dispatcher unavailable:", err && (err.message || err));
    return null;
  }
}
function azJupemFetchOptions(options = {}) {
  const out = Object.assign({}, options);
  const dispatcher = azGetJupemDispatcher();
  if (dispatcher) out.dispatcher = dispatcher;
  return out;
}

let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { nodemailer = null; }
let sharp = null;
let PDFDocument = null;
let QRCode = null;

function azobssLoadBackendModule(moduleName) {
  const candidates = [
    moduleName,
    path.join(__dirname, "node_modules", moduleName),
    path.join(__dirname, "backend", "node_modules", moduleName)
  ];

  const errors = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      errors.push(candidate + " => " + (err && err.message ? err.message.split("\n")[0] : String(err)));
    }
  }

  console.warn("AZOBSS module load failed for " + moduleName + ":", errors);
  return null;
}

function azobssEnsurePdfDependencies() {
  sharp = azobssLoadBackendModule("sharp");
  PDFDocument = azobssLoadBackendModule("pdfkit");

  if (sharp && PDFDocument) return;

  // Render Free sometimes reuses an old build/cache or skips native optional packages.
  // Runtime self-heal installs only when the PDF converter dependencies are missing.
  if (process.env.AZOBSS_DISABLE_RUNTIME_NPM === "1") return;

  try {
    const childProcess = require("child_process");
    console.warn("AZOBSS PDF deps missing. Running one-time runtime install for sharp/pdfkit...");
    childProcess.execSync(
      "npm install --no-audit --no-fund --include=optional sharp@0.32.6 pdfkit@0.15.0",
      { cwd: __dirname, stdio: "inherit", env: Object.assign({}, process.env, { npm_config_registry: "https://registry.npmjs.org/" }) }
    );
  } catch (installErr) {
    console.error("AZOBSS runtime install for PDF deps failed:", installErr && installErr.message ? installErr.message : installErr);
  }

  sharp = azobssLoadBackendModule("sharp");
  PDFDocument = azobssLoadBackendModule("pdfkit");
}

azobssEnsurePdfDependencies();

console.log("PDF converter dependencies:", {
  sharp: !!sharp,
  pdfkit: !!PDFDocument,
  rootNodeModules: fs.existsSync(path.join(__dirname, "node_modules")),
  backendNodeModules: fs.existsSync(path.join(__dirname, "backend", "node_modules")),
  nodeVersion: process.version
});

async function convertTifBufferToPdfBuffer(tifBuffer, safeName) {
  if (!sharp || !PDFDocument) {
    const missing = !sharp && !PDFDocument ? "sharp and pdfkit" : (!sharp ? "sharp" : "pdfkit");
    throw new Error("PDF converter dependency missing: " + missing);
  }

  const pages = [];
  const meta = await sharp(tifBuffer, { pages: -1 }).metadata();
  const pageCount = Math.max(1, Number(meta.pages || 1));

  for (let i = 0; i < pageCount; i++) {
    const imageBuffer = await sharp(tifBuffer, { page: i, limitInputPixels: false })
      .rotate()
      .png()
      .toBuffer();
    const imgMeta = await sharp(imageBuffer).metadata();
    pages.push({
      buffer: imageBuffer,
      width: Math.max(1, Number(imgMeta.width || meta.width || 595)),
      height: Math.max(1, Number(imgMeta.height || meta.height || 842))
    });
  }

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      margin: 0,
      info: {
        Title: safeName || "PA PDF",
        Creator: "AZOBSS PA Converter"
      }
    });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (const page of pages) {
      const width = page.width;
      const height = page.height;
      doc.addPage({ size: [width, height], margin: 0 });
      doc.image(page.buffer, 0, 0, { width, height });
    }

    doc.end();
  });
}

const TOYYIB_SECRET_KEY=process.env.TOYYIB_SECRET_KEY;
const TOYYIB_CATEGORY_CODE=process.env.TOYYIB_CATEGORY_CODE;

const TOYYIB_BASE_URL = (process.env.TOYYIB_BASE_URL || (String(process.env.TOYYIB_SANDBOX || "").toLowerCase() === "true" ? "https://dev.toyyibpay.com" : "https://toyyibpay.com")).replace(/\/$/, "");
const TOYYIB_RETURN_URL = process.env.TOYYIB_RETURN_URL || "";
const TOYYIB_CALLBACK_URL = process.env.TOYYIB_CALLBACK_URL || "";
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || process.env.SITE_BASE_URL || "https://www.azobss.com").replace(/\/$/, "");
const PUBLIC_BASE_URL_ENV = (process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");

function publicBaseUrlFromReq(req) {
  if (PUBLIC_BASE_URL_ENV) return PUBLIC_BASE_URL_ENV;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = req.headers.host || "azobss-backend.onrender.com";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function parseAmountToSen(value) {
  const n = Number(String(value || "").replace(/rm/ig, "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}


// AZOBSS priority hardening: never trust Software/CAD price or download URL from the browser.
// Normal purchase price/file is resolved by backend from Firestore/local product list.
const AZOBSS_LOCAL_SOFTWARE_EXPORT = path.join(__dirname, "azobss-software-tools-export (5).json");
const AZOBSS_ADMIN_TEST_USERNAMES = String(process.env.AZOBSS_ADMIN_TEST_USERNAMES || "zedan91,zedan0001").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
const AZOBSS_ADMIN_TEST_EMAILS = String(process.env.AZOBSS_ADMIN_TEST_EMAILS || "zedan91@azobss.local,zedan9107@gmail.com").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
const AZOBSS_ADMIN_KEY = String(process.env.ADMIN_KEY || "").trim();
const AZOBSS_COMMISSION_API_SECRET = String(process.env.AZOBSS_COMMISSION_API_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || AZOBSS_ADMIN_KEY || "").trim();
const AZOBSS_ADMIN_API_SECRET = String(process.env.AZOBSS_ADMIN_API_SECRET || AZOBSS_ADMIN_KEY || "").trim();

function azProductKey(v){ return String(v || "").trim().toLowerCase(); }
function azProductIdFromAny(product = {}, data = {}) {
  return cleanPremiumText(product.productId || product.id || product.sku || data.productId || data.id || "", 180);
}
function azIsAdminTestUser(user = {}, data = {}, product = {}) {
  const username = azProductKey(user.username || data.username || data.usernameKey || data.user?.username || data.user?.usernameKey || product.ownerUsername || "");
  const email = azProductKey(user.email || data.email || data.buyerEmail || data.user?.email || "");
  return (username && AZOBSS_ADMIN_TEST_USERNAMES.includes(username)) || (email && AZOBSS_ADMIN_TEST_EMAILS.includes(email));
}
function azIsAdminTestPurchase(data = {}, product = {}) {
  const flag = product.isAdminTestPurchase === true || data.isAdminTestPurchase === true || String(product.adminTestPurchase || data.adminTestPurchase || "") === "1";
  const priceSen = parseAmountToSen(product.price || data.amount || data.price || "");
  return flag && priceSen === 100;
}
function azProductIsPremium(item = {}) {
  const type = String(item.type || item.productType || item.statusType || "").toLowerCase();
  const priceSen = parseAmountToSen(item.price || item.amount || item.productPrice || "");
  return type.includes("premium") || priceSen > 0;
}
function azNormalizeTrustedProduct(item = {}, source = "trusted") {
  const id = cleanPremiumText(item.productId || item.id || item.sku || item.docId || "", 180);
  const name = cleanPremiumText(item.name || item.title || item.productName || "AZOBSS Digital Product", 160);
  const price = cleanPremiumText(item.price || item.amount || item.productPrice || "", 40);
  const downloadLink = cleanPremiumUrl(item.secureDownloadLink || item.premiumDownloadFileLink || item.privateDownloadLink || item.downloadLink || item.fileUrl || "");
  const r2ObjectKey = azSafeR2ObjectKey(item.r2ObjectKey || item.r2Key || item.downloadObjectKey || item.privateObjectKey || "");
  return {
    ...item,
    id,
    productId: id,
    name,
    productName: name,
    price,
    source: item.source || source,
    secureDownloadLink: cleanPremiumUrl(item.secureDownloadLink || item.premiumDownloadFileLink || item.privateDownloadLink || item.downloadLink || item.fileUrl || ""),
    premiumDownloadFileLink: cleanPremiumUrl(item.premiumDownloadFileLink || item.secureDownloadLink || item.privateDownloadLink || item.downloadLink || item.fileUrl || ""),
    privateDownloadLink: cleanPremiumUrl(item.privateDownloadLink || item.secureDownloadLink || item.premiumDownloadFileLink || item.downloadLink || item.fileUrl || ""),
    downloadLink,
    r2ObjectKey,
    r2Key: r2ObjectKey,
    downloadObjectKey: r2ObjectKey,
    privateObjectKey: r2ObjectKey,
    downloadLimit: Number(item.downloadLimit || item.maxDownload || item.maxDownloads || 1) || 1,
    expiryHours: azobssExpiryHoursFromOrder({ product: item }),
    linkExpiryHours: azobssExpiryHoursFromOrder({ product: item }),
    expiresNever: azobssExpiryHoursFromOrder({ product: item }) === 0
  };
}
function azFindLocalSoftwareProduct(productId = "") {
  const key = azProductKey(productId);
  if (!key || !fs.existsSync(AZOBSS_LOCAL_SOFTWARE_EXPORT)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(AZOBSS_LOCAL_SOFTWARE_EXPORT, "utf8"));
    const items = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.softwareTools) ? raw.softwareTools : []));
    const found = items.find(item => [item.productId, item.id, item.sku, item.name].map(azProductKey).includes(key));
    return found ? azNormalizeTrustedProduct(found, "local-software-export") : null;
  } catch (err) {
    console.warn("AZOBSS local product lookup failed:", err && (err.message || err));
    return null;
  }
}
async function azFindFirestoreProduct(productId = "") {
  const key = azProductKey(productId);
  if (!key) return null;
  const db = getAzobssBackendDb();
  if (!db) return null;
  const collections = ["softwareTools", "cadTools", "cadToolsResources", "staffSoftwareSubmissions", "staffCADSubmissions"];
  for (const col of collections) {
    try {
      const docSnap = await db.collection(col).doc(productId).get();
      if (docSnap.exists) return azNormalizeTrustedProduct({ docId: docSnap.id, ...(docSnap.data() || {}) }, "firestore:" + col);
    } catch (_) {}
    for (const field of ["productId", "id", "sku", "name", "title", "productName"]) {
      for (const value of Array.from(new Set([productId, String(productId || "").trim(), String(productId || "").trim().toUpperCase(), String(productId || "").trim().toLowerCase()].filter(Boolean)))) {
        try {
          const qs = await db.collection(col).where(field, "==", value).limit(1).get();
          if (!qs.empty) {
            const doc = qs.docs[0];
            return azNormalizeTrustedProduct({ docId: doc.id, ...(doc.data() || {}) }, "firestore:" + col);
          }
        } catch (_) {}
      }
    }
  }
  return null;
}

// AZOBSS PATCH 399: Subscription activation code plans for Software Tools.
const AZOBSS_SUBSCRIPTION_PLAN_DEFS = [
  { id:'1m', months:1, durationDays:31, label:'1 Month Activation Code', price:'RM29.90', priceSen:2990, saveText:'', monthlyText:'RM29.90/month' },
  { id:'3m', months:3, durationDays:93, label:'3 Months Activation Code', price:'RM69.90', priceSen:6990, saveText:'Save RM19.80', monthlyText:'RM23.30/month' },
  { id:'12m', months:12, durationDays:366, label:'12 Months Activation Code', price:'RM239.00', priceSen:23900, saveText:'Save RM119.80', monthlyText:'RM19.92/month' }
];
function azSubscriptionPlanDefs(){ return AZOBSS_SUBSCRIPTION_PLAN_DEFS.map(x => ({...x})); }
function azSubscriptionPlanId(v=''){
  const s = String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  if(['1','1m','month','1month','monthly'].includes(s)) return '1m';
  if(['3','3m','3month','3months','quarter','quarterly'].includes(s)) return '3m';
  if(['12','12m','year','yearly','annual','annually','12month','12months'].includes(s)) return '12m';
  return s;
}
function azSubscriptionProductEnabled(product = {}){
  return product && (product.subscriptionCodeEnabled === true || product.subscriptionProduct === true || product.activationCodeSale === true || String(product.subscriptionCodeEnabled||'').toLowerCase()==='true');
}
function azSubscriptionPlansFromProduct(product = {}){
  const raw = Array.isArray(product.subscriptionPlans) ? product.subscriptionPlans : [];
  const base = azSubscriptionPlanDefs();
  if(!raw.length) return base;
  return base.map(def => {
    const r = raw.find(x => azSubscriptionPlanId(x && (x.id || x.planId || x.months || x.durationMonths)) === def.id) || {};
    const price = cleanPremiumText(r.price || r.amount || def.price, 40);
    const priceSen = Number(r.priceSen || parseAmountToSen(price) || def.priceSen) || def.priceSen;
    return {...def, ...r, id:def.id, price, priceSen, months:Number(r.months || def.months), durationDays:Number(r.durationDays || def.durationDays), label:cleanPremiumText(r.label || def.label, 80), monthlyText:cleanPremiumText(r.monthlyText || def.monthlyText, 40), saveText:cleanPremiumText(r.saveText || def.saveText, 60)};
  });
}
function azSubscriptionSelectedPlan(data = {}, product = {}){
  if(!azSubscriptionProductEnabled(product)) return null;
  const requested = azSubscriptionPlanId(data.subscriptionPlanId || data.planId || (data.subscriptionPlan && data.subscriptionPlan.id) || (data.product && (data.product.subscriptionPlanId || data.product.selectedSubscriptionPlanId || data.product.planId)) || '1m');
  const plans = azSubscriptionPlansFromProduct(product);
  return plans.find(p => azSubscriptionPlanId(p.id) === requested) || plans[0] || null;
}
function azActivationCodePrefix(product = {}){
  return cleanPremiumText(product.activationCodePrefix || product.subscriptionCodePrefix || product.productId || product.id || 'AZOBSS', 18).toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,12) || 'AZOBSS';
}
function azActivationCodeMs(value){
  if(!value) return 0;
  if(typeof value === 'number') return value;
  if(typeof value === 'string') return Date.parse(value) || 0;
  if(typeof value.toMillis === 'function') return value.toMillis();
  if(typeof value._seconds === 'number') return value._seconds * 1000;
  return 0;
}
function azEnsureSubscriptionActivation(order = {}){
  if(!azSubscriptionProductEnabled(order) && !azSubscriptionProductEnabled(order.product || {})) return order;
  if(String(order.status || '').toLowerCase() !== 'paid') return order;
  if(order.activationCode && order.activationCodeExpiresAtMs) return order;
  const plan = order.subscriptionPlan || azSubscriptionSelectedPlan({subscriptionPlanId:order.subscriptionPlanId || order.planId}, order.product || order) || azSubscriptionPlanDefs()[0];
  const paidMs = Number(order.paidAtMs || 0) || azActivationCodeMs(order.paidAt) || Date.now();
  const durationDays = Math.max(1, Number(plan.durationDays || 31));
  const expiresAtMs = paidMs + durationDays * 24 * 60 * 60 * 1000;
  const prefix = azActivationCodePrefix(order.product || order);
  const planTag = String(plan.id || '1m').toUpperCase();
  const code = `${prefix}-${planTag}-${makeId('PRO').replace(/[^A-Z0-9]/gi,'').toUpperCase().slice(0,6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  return upsertPremiumOrder({
    ...order,
    subscriptionCodeEnabled:true,
    activationCodeSale:true,
    subscriptionPlan:plan,
    subscriptionPlanId:plan.id,
    subscriptionPlanLabel:plan.label,
    subscriptionDurationDays:durationDays,
    subscriptionMonths:Number(plan.months || 1),
    activationCode:code,
    activationCodeHash:azSubscriptionCodeHash(code),
    activationCodeStatus:'active',
    activationCodeIssuedAt:new Date(paidMs).toISOString(),
    activationCodeIssuedAtMs:paidMs,
    activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
    activationCodeExpiresAtMs:expiresAtMs,
    deviceLimit:AZOBSS_SUBSCRIPTION_DEVICE_LIMIT,
    activeDeviceId:'',
    previousDeviceId:'',
    transferLimitPerYear:AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR,
    transferCountByYear:{},
    deviceTransferHistory:[],
    graceDays:AZOBSS_SUBSCRIPTION_GRACE_DAYS
  });
}
function azSubscriptionActivationHtml(order = {}){
  if(!order.activationCode) return '';
  const exp = order.activationCodeExpiresAt || (order.activationCodeExpiresAtMs ? new Date(Number(order.activationCodeExpiresAtMs)).toISOString() : '');
  return `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:14px;padding:16px;margin:16px 0;color:#111"><h3 style="margin:0 0 8px;color:#854d0e">Your Pro Activation Code</h3><div style="font-family:Consolas,monospace;font-size:22px;font-weight:900;letter-spacing:1px;background:#111827;color:#facc15;border-radius:10px;padding:12px;text-align:center">${String(order.activationCode)}</div><p style="margin:10px 0 0"><b>Plan:</b> ${String(order.subscriptionPlanLabel || order.subscriptionPlan?.label || '-')}<br><b>Valid until:</b> ${String(exp || '-')}</p><p style="font-size:13px;color:#713f12;margin:10px 0 0">Open the software, paste this activation code in the Subscription / Pro Version screen, then the software can verify it through the AZOBSS backend.</p></div>`;
}

// AZOBSS PATCH 411: Online Subscription License Server with one-device binding + transfer.
const AZOBSS_SUBSCRIPTION_DEVICE_LIMIT = Math.max(1, Number(process.env.AZOBSS_SUBSCRIPTION_DEVICE_LIMIT || 1) || 1);
const AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR = Math.max(0, Number(process.env.AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR || 3) || 3);
const AZOBSS_SUBSCRIPTION_GRACE_DAYS = Math.max(0, Number(process.env.AZOBSS_SUBSCRIPTION_GRACE_DAYS || 3) || 3);

function azSubscriptionHashSecret(){
  return String(process.env.AZOBSS_SUBSCRIPTION_HASH_SECRET || process.env.AZOBSS_DOWNLOAD_HASH_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || process.env.ADMIN_KEY || "azobss-subscription-local-secret").trim();
}
function azSubscriptionCleanCode(v=''){
  return cleanPremiumText(v || "", 180).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_-]+/g, "").slice(0, 180);
}
function azSubscriptionCodeHash(code=''){
  const safe = azSubscriptionCleanCode(code);
  if(!safe) return "";
  return crypto.createHash("sha256").update(safe + "::" + azSubscriptionHashSecret()).digest("hex");
}
function azSubscriptionCleanDeviceId(v=''){
  return cleanPremiumText(v || "", 220).replace(/[^a-zA-Z0-9._:@-]+/g, "").slice(0, 180);
}
function azSubscriptionCleanEmail(v=''){
  return cleanPremiumText(v || "", 180).trim().toLowerCase();
}
function azSubscriptionCleanUsername(v=''){
  return cleanPremiumText(v || "", 100).trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "");
}
function azSubscriptionOrderBuyerEmail(order={}){
  return azSubscriptionCleanEmail(order.buyerEmail || order.email || order.user?.email || order.customerEmail || order.ownerEmail || "");
}
function azSubscriptionOrderUsername(order={}){
  return azSubscriptionCleanUsername(order.username || order.usernameKey || order.user?.username || order.user?.usernameKey || order.buyerUsername || "");
}
function azSubscriptionRequestEmail(body={}, parsedQuery={}){
  return azSubscriptionCleanEmail(body.email || body.buyerEmail || body.userEmail || body.accountEmail || parsedQuery.email || parsedQuery.buyerEmail || parsedQuery.userEmail || parsedQuery.accountEmail || "");
}
function azSubscriptionRequestUsername(body={}, parsedQuery={}){
  return azSubscriptionCleanUsername(body.username || body.usernameKey || body.accountUsername || parsedQuery.username || parsedQuery.usernameKey || parsedQuery.accountUsername || "");
}
function azSubscriptionEmailAllowed(orderEmail='', requestEmail=''){
  if(!orderEmail || !requestEmail) return true;
  return String(orderEmail).toLowerCase() === String(requestEmail).toLowerCase();
}
function azSubscriptionUsernameAllowed(orderUsername='', requestUsername=''){
  if(!orderUsername || !requestUsername) return true;
  return String(orderUsername).toLowerCase() === String(requestUsername).toLowerCase();
}
function azSubscriptionMaskDevice(id=''){
  const s = String(id || "");
  if(!s) return "";
  if(s.length <= 8) return "***" + s.slice(-3);
  return s.slice(0, 4) + "..." + s.slice(-5);
}
function azSubscriptionYearKey(ms=Date.now()){
  const d = new Date(Number(ms || Date.now()) || Date.now());
  return String(d.getUTCFullYear());
}
function azSubscriptionTransferCount(order={}, yearKey=azSubscriptionYearKey()){
  const byYear = order.transferCountByYear && typeof order.transferCountByYear === "object" ? order.transferCountByYear : {};
  const explicit = Number(byYear[yearKey] || 0) || 0;
  const history = Array.isArray(order.deviceTransferHistory) ? order.deviceTransferHistory : [];
  const counted = history.filter(x => azSubscriptionYearKey(Number(x.transferAtMs || Date.parse(x.transferAt || "") || 0) || Date.now()) === yearKey).length;
  return Math.max(explicit, counted);
}
function azSubscriptionMakeCode(prefix='AZOBSS', planId='1m'){
  const p = cleanPremiumText(prefix || "AZOBSS", 18).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "AZOBSS";
  const plan = cleanPremiumText(planId || "1m", 12).toUpperCase().replace(/[^A-Z0-9]+/g, "") || "1M";
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  const c = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${p}-${plan}-${a}-${b}-${c}`;
}
function azSubscriptionDevicePublic(order={}, extra={}){
  const nowMs = Date.now();
  const expiresAtMs = Number(order.activationCodeExpiresAtMs || 0) || azActivationCodeMs(order.activationCodeExpiresAt);
  const yearKey = azSubscriptionYearKey(nowMs);
  return {
    ok: true,
    valid: !!extra.valid,
    pro: !!extra.valid,
    status: extra.status || "",
    reason: extra.reason || "",
    message: extra.message || "",
    transferRequired: !!extra.transferRequired,
    transferAllowed: extra.transferAllowed !== false,
    productId: order.productId || order.product?.productId || order.product?.id || "",
    productName: order.productName || order.product?.name || "",
    plan: order.subscriptionPlanLabel || order.subscriptionPlan?.label || "",
    planId: order.subscriptionPlanId || order.subscriptionPlan?.id || "",
    months: Number(order.subscriptionMonths || order.subscriptionPlan?.months || 0) || 0,
    expiresAt: order.activationCodeExpiresAt || (expiresAtMs ? new Date(expiresAtMs).toISOString() : ""),
    expiresAtMs,
    serverTime: new Date(nowMs).toISOString(),
    serverTimeMs: nowMs,
    graceDays: AZOBSS_SUBSCRIPTION_GRACE_DAYS,
    graceUntil: new Date(nowMs + AZOBSS_SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    graceUntilMs: nowMs + AZOBSS_SUBSCRIPTION_GRACE_DAYS * 24 * 60 * 60 * 1000,
    deviceLimit: Number(order.deviceLimit || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT) || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT,
    activeDeviceMasked: azSubscriptionMaskDevice(order.activeDeviceId || ""),
    currentDeviceMasked: azSubscriptionMaskDevice(extra.deviceId || ""),
    transferCountThisYear: azSubscriptionTransferCount(order, yearKey),
    transferLimitPerYear: Number(order.transferLimitPerYear || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR) || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR,
    orderId: cleanPremiumText(order.orderId || "", 160)
  };
}
function azSubscriptionAdminRow(order={}){
  const expiresAtMs = Number(order.activationCodeExpiresAtMs || 0) || azActivationCodeMs(order.activationCodeExpiresAt);
  const yearKey = azSubscriptionYearKey();
  const code = azSubscriptionCleanCode(order.activationCode || "");
  return {
    orderId: cleanPremiumText(order.orderId || "", 160),
    billCode: cleanPremiumText(order.billCode || "", 120),
    activationCode: code,
    codeHash: cleanPremiumText(order.activationCodeHash || azSubscriptionCodeHash(code), 100),
    codeStatus: cleanPremiumText(order.activationCodeStatus || "active", 40),
    status: cleanPremiumText(order.status || "", 40),
    productId: order.productId || order.product?.productId || order.product?.id || "",
    productName: order.productName || order.product?.name || "",
    plan: order.subscriptionPlanLabel || order.subscriptionPlan?.label || "",
    planId: order.subscriptionPlanId || order.subscriptionPlan?.id || "",
    months: Number(order.subscriptionMonths || order.subscriptionPlan?.months || 0) || 0,
    buyerEmail: azSubscriptionOrderBuyerEmail(order),
    username: azSubscriptionOrderUsername(order),
    expiresAt: order.activationCodeExpiresAt || (expiresAtMs ? new Date(expiresAtMs).toISOString() : ""),
    expiresAtMs,
    activeDeviceMasked: azSubscriptionMaskDevice(order.activeDeviceId || ""),
    previousDeviceMasked: azSubscriptionMaskDevice(order.previousDeviceId || ""),
    deviceLimit: Number(order.deviceLimit || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT) || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT,
    transferCountThisYear: azSubscriptionTransferCount(order, yearKey),
    transferLimitPerYear: Number(order.transferLimitPerYear || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR) || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR,
    activatedAt: order.activatedAt || "",
    lastVerifiedAt: order.lastVerifiedAt || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    source: cleanPremiumText(order.source || "", 80)
  };
}
async function azPersistSubscriptionCodeRecord(order={}){
  try{
    const db = getAzobssBackendDb();
    if(!db) return { ok:false, reason:"firebase-not-ready" };
    const code = azSubscriptionCleanCode(order.activationCode || "");
    const hash = cleanPremiumText(order.activationCodeHash || azSubscriptionCodeHash(code), 100);
    const docId = hash || cleanPremiumText(order.orderId || code || makeId("sub"), 180);
    if(!docId) return { ok:false, reason:"missing-doc-id" };
    const safe = azJsonSafe({
      ...order,
      activationCode: code,
      activationCodeHash: hash,
      subscriptionLicenseVersion: 411,
      codeStatus: order.activationCodeStatus || "active",
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now()
    });
    await db.collection("subscriptionCodes").doc(docId).set(safe, { merge:true });
    return { ok:true, docId };
  }catch(err){
    console.warn("AZOBSS subscriptionCodes persist failed:", err && (err.message || err));
    return { ok:false, error:err && err.message ? err.message : String(err) };
  }
}
async function azSaveSubscriptionOrder(order={}, patch={}){
  const merged = {
    ...order,
    ...patch,
    activationCode: azSubscriptionCleanCode(patch.activationCode || order.activationCode || ""),
    activationCodeHash: patch.activationCodeHash || order.activationCodeHash || azSubscriptionCodeHash(patch.activationCode || order.activationCode || ""),
    subscriptionCodeEnabled: true,
    activationCodeSale: true,
    deviceLimit: Number(patch.deviceLimit || order.deviceLimit || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT) || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT,
    transferLimitPerYear: Number(patch.transferLimitPerYear || order.transferLimitPerYear || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR) || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR,
    graceDays: AZOBSS_SUBSCRIPTION_GRACE_DAYS,
    updatedAt: new Date().toISOString(),
    updatedAtMs: Date.now()
  };
  const saved = upsertPremiumOrder(merged);
  azFireAndForget(azPersistSubscriptionCodeRecord(saved), "AZOBSS subscriptionCodes backup failed:");
  return saved;
}
async function azFindSubscriptionOrderByCode(code=''){
  const safeCode = azSubscriptionCleanCode(code);
  const hash = azSubscriptionCodeHash(safeCode);
  const rows = [];
  const push = (x, source="") => {
    if(!x || typeof x !== "object") return;
    rows.push({ ...x, _source: source || x._source || "" });
  };
  try { readPremiumOrders().forEach(x => push(x, "local-premiumOrders")); } catch (_) {}
  const db = getAzobssBackendDb();
  if(db){
    try{
      const snap = await db.collection("premiumOrders").where("activationCodeHash", "==", hash).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders-hash"));
    }catch(err){ console.warn("Subscription premiumOrders hash lookup skipped:", err && (err.message || err)); }
    try{
      const snap = await db.collection("premiumOrders").where("activationCode", "==", safeCode).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders-code"));
    }catch(err){ console.warn("Subscription premiumOrders code lookup skipped:", err && (err.message || err)); }
    try{
      const doc = await db.collection("subscriptionCodes").doc(hash).get();
      if(doc.exists) push({ docId:doc.id, ...(doc.data() || {}) }, "firestore-subscriptionCodes-doc");
    }catch(err){ console.warn("Subscription code doc lookup skipped:", err && (err.message || err)); }
    try{
      const snap = await db.collection("subscriptionCodes").where("activationCode", "==", safeCode).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-subscriptionCodes-code"));
    }catch(err){ console.warn("Subscription code direct lookup skipped:", err && (err.message || err)); }
  }
  const seen = new Set();
  const candidates = rows.filter(x => {
    const codeOk = azSubscriptionCleanCode(x.activationCode || "") === safeCode;
    const hashOk = cleanPremiumText(x.activationCodeHash || "", 100) === hash;
    if(!codeOk && !hashOk) return false;
    const key = String(x.orderId || x.billCode || x.docId || x.activationCodeHash || x.activationCode || Math.random());
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  candidates.sort((a,b) => Number(b.updatedAtMs || b.createdAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || 0));
  return candidates[0] || null;
}
async function azFindSubscriptionOrderByAdminRef(ref={}){
  const code = azSubscriptionCleanCode(ref.activationCode || ref.code || "");
  if(code) return await azFindSubscriptionOrderByCode(code);
  const orderId = cleanPremiumText(ref.orderId || "", 180);
  const billCode = cleanPremiumText(ref.billCode || "", 120);
  if(orderId || billCode){
    const found = await findPremiumOrderByAnyDeep({ orderId, billCode });
    if(found && (found.activationCode || found.activationCodeHash || found.subscriptionCodeEnabled)) return found;
  }
  return null;
}
async function azLoadSubscriptionAdminRows(search='', limitRows=300){
  const out = [];
  const push = (x, source="") => { if(x && (x.activationCode || x.activationCodeHash || x.subscriptionCodeEnabled || x.activationCodeSale)) out.push({ ...x, _source: source || x._source || "" }); };
  try { readPremiumOrders().forEach(x => push(x, "local-premiumOrders")); } catch (_) {}
  const db = getAzobssBackendDb();
  if(db){
    try{
      const snap = await db.collection("premiumOrders").limit(Math.min(500, limitRows)).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders"));
    }catch(err){ console.warn("Admin subscription premiumOrders list skipped:", err && (err.message || err)); }
    try{
      const snap = await db.collection("subscriptionCodes").limit(Math.min(500, limitRows)).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-subscriptionCodes"));
    }catch(err){ console.warn("Admin subscriptionCodes list skipped:", err && (err.message || err)); }
  }
  const q = String(search || "").trim().toLowerCase();
  const seen = new Set();
  const filtered = [];
  for(const x of out){
    const key = String(x.orderId || x.billCode || x.docId || x.activationCodeHash || x.activationCode || Math.random());
    if(seen.has(key)) continue;
    seen.add(key);
    const hay = [
      x.activationCode, x.activationCodeHash, x.orderId, x.billCode, x.productId, x.productName,
      x.buyerEmail, x.email, x.username, x.usernameKey, x.user?.email, x.user?.username, x.activationCodeStatus
    ].map(v => String(v || "").toLowerCase()).join(" ");
    if(q && !hay.includes(q)) continue;
    filtered.push(x);
  }
  filtered.sort((a,b) => Number(b.updatedAtMs || b.createdAtMs || b.activationCodeIssuedAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || a.activationCodeIssuedAtMs || 0));
  return filtered.slice(0, limitRows).map(azSubscriptionAdminRow);
}

async function azResolveTrustedPremiumProduct(data = {}, req = null) {
  let clientProduct = data.product || {};

  // AZOBSS PATCH 422:
  // Cart checkout UI used a pseudo product id "CART-CHECKOUT".
  // For a cart with 1 item, backend must validate the real item inside cartItems.
  // Multiple-product checkout needs separate multi-download fulfilment, so it is blocked clearly.
  const isCartCheckout = clientProduct.isCartCheckout === true || data.isCartCheckout === true || Array.isArray(clientProduct.cartItems) || Array.isArray(data.cartItems);
  const cartItems = Array.isArray(clientProduct.cartItems) ? clientProduct.cartItems : (Array.isArray(data.cartItems) ? data.cartItems : []);
  if (isCartCheckout) {
    const cleanItems = cartItems.filter(Boolean);
    if (cleanItems.length === 1) {
      clientProduct = { ...cleanItems[0], cartItems:cleanItems, isCartCheckout:true };
      data = { ...data, product:clientProduct, productId:clientProduct.productId || clientProduct.id || clientProduct.sku || data.productId || "" };
    } else if (cleanItems.length > 1) {
      throw new Error("Cart checkout currently supports one product per payment. Please checkout one product at a time.");
    } else if (String(clientProduct.id || clientProduct.productId || "").toUpperCase() === "CART-CHECKOUT") {
      throw new Error("Cart item productId missing. Please remove the item and Add to Cart again.");
    }
  }

  const user = getPremiumUser(data);
  const productId = azProductIdFromAny(clientProduct, data);
  if (!productId) {
    throw new Error("Missing productId. Backend price validation requires productId.");
  }

  let trusted = await azFindFirestoreProduct(productId);
  if (!trusted && String(productId).toUpperCase() === "CART-CHECKOUT" && cartItems.length === 1) {
    const realId = azProductIdFromAny(cartItems[0], data);
    if (realId) trusted = await azFindFirestoreProduct(realId);
    if (!trusted && realId) trusted = azFindLocalSoftwareProduct(realId);
  }
  if (!trusted) trusted = azFindLocalSoftwareProduct(productId);

  // Admin-only RM1 test purchase: keep real product metadata/file if found, but lock test amount to RM1.
  if (azIsAdminTestPurchase(data, clientProduct)) {
    if (!azIsAdminTestUser(user, data, clientProduct)) {
      throw new Error("Admin test purchase RM1 is not allowed for this account.");
    }
    const base = trusted || azNormalizeTrustedProduct(clientProduct, "admin-test-client-metadata");
    const testDownload = cleanPremiumUrl(base.secureDownloadLink || base.premiumDownloadFileLink || base.privateDownloadLink || base.downloadLink || clientProduct.secureDownloadLink || clientProduct.premiumDownloadFileLink || clientProduct.privateDownloadLink || clientProduct.downloadLink || data.downloadLink || "");
    const testR2ObjectKey = azSafeR2ObjectKey(base.r2ObjectKey || base.r2Key || clientProduct.r2ObjectKey || clientProduct.r2Key || data.r2ObjectKey || data.r2Key || "");
    if (!testDownload && !testR2ObjectKey) throw new Error("Premium Download File Link atau Cloudflare R2 Private Object Key belum diset untuk produk ini.");
    return {
      product: { ...base, id: productId, productId, name: cleanPremiumText((base.name || clientProduct.name || "AZOBSS Digital Product") + " (Admin Test RM1)", 160), price: "RM1", isAdminTestPurchase: true, secureDownloadLink: testDownload, premiumDownloadFileLink: testDownload, privateDownloadLink: testDownload, downloadLink: testDownload, r2ObjectKey:testR2ObjectKey, r2Key:testR2ObjectKey },
      amountText: "RM1",
      amountSen: 100,
      downloadLink: testDownload,
      r2ObjectKey: testR2ObjectKey,
      trustedSource: base.source || "admin-test",
      isAdminTestPurchase: true
    };
  }

  if (!trusted) {
    throw new Error("Product not found on backend. Please sync Software/CAD product to Firestore or backend product list before accepting payment.");
  }
  if (!azProductIsPremium(trusted)) {
    throw new Error("Product is not marked as premium on backend.");
  }
  const subscriptionPlan = azSubscriptionSelectedPlan(data, trusted);
  let amountSen = subscriptionPlan ? Number(subscriptionPlan.priceSen || 0) : parseAmountToSen(trusted.price || trusted.amount || "");
  if (!amountSen) throw new Error("Backend product price is invalid.");
  const amountText = subscriptionPlan ? cleanPremiumText(subscriptionPlan.price || `RM${(amountSen/100).toFixed(2)}`, 40) : cleanPremiumText(trusted.price || `RM${(amountSen/100).toFixed(2)}`, 40);
  const downloadLink = cleanPremiumUrl(trusted.secureDownloadLink || trusted.premiumDownloadFileLink || trusted.privateDownloadLink || trusted.downloadLink || trusted.fileUrl || "");
  const r2ObjectKey = azSafeR2ObjectKey(trusted.r2ObjectKey || trusted.r2Key || trusted.downloadObjectKey || trusted.privateObjectKey || "");
  if (!downloadLink && !r2ObjectKey) throw new Error("Premium Download File Link atau Cloudflare R2 Private Object Key belum diset untuk produk ini.");
  const saleProductBase = { ...trusted, r2ObjectKey, r2Key:r2ObjectKey };
  const saleProduct = subscriptionPlan ? { ...saleProductBase, subscriptionCodeEnabled:true, activationCodeSale:true, subscriptionPlan, subscriptionPlanId:subscriptionPlan.id, selectedSubscriptionPlan:subscriptionPlan, price:amountText } : saleProductBase;
  return {
    product: saleProduct,
    amountText,
    amountSen,
    downloadLink,
    r2ObjectKey,
    subscriptionCodeEnabled: !!subscriptionPlan,
    subscriptionPlan,
    trustedSource: trusted.source || "backend",
    isAdminTestPurchase: false
  };
}
function azRequestHasCommissionSecret(req, parsed) {
  if (!AZOBSS_COMMISSION_API_SECRET) return false;
  const h = req.headers["x-azobss-api-key"] || req.headers["x-api-key"] || req.headers.authorization || "";
  const token = String(h).replace(/^Bearer\s+/i, "").trim() || String(parsed.query.key || parsed.query.secret || "").trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(AZOBSS_COMMISSION_API_SECRET));
  } catch (_) {
    return token === AZOBSS_COMMISSION_API_SECRET;
  }
}
function azRequestHasAdminSecret(req, parsed) {
  const secret = AZOBSS_ADMIN_API_SECRET || AZOBSS_COMMISSION_API_SECRET;
  if (!secret) return false;
  const h = req.headers["x-admin-key"] || req.headers["x-azobss-api-key"] || req.headers["x-api-key"] || req.headers.authorization || "";
  const token = String(h).replace(/^Bearer\s+/i, "").trim() || String(parsed.query.adminKey || parsed.query.key || parsed.query.secret || "").trim();
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch (_) {
    return token === secret;
  }
}
function azAdminAllowedEmailSet() {
  const defaults = ["zedan91@azobss.local", "zedan9107@gmail.com"];
  const extra = String(process.env.ADMIN_ALLOWED_EMAILS || process.env.AZOBSS_ADMIN_EMAILS || "").split(/[;,\s]+/).map(v => v.trim()).filter(Boolean);
  return new Set(defaults.concat(extra).map(v => String(v || "").trim().toLowerCase()).filter(Boolean));
}
function azAdminAllowedUidSet() {
  return new Set(String(process.env.ADMIN_ALLOWED_UIDS || process.env.AZOBSS_ADMIN_UIDS || "").split(/[;,\s]+/).map(v => String(v || "").trim()).filter(Boolean));
}
function azIdentityTrustedForBackendAdmin(identity = {}) {
  const emails = azAdminAllowedEmailSet();
  const uids = azAdminAllowedUidSet();
  const authEmail = String(identity.authEmail || identity.email || "").trim().toLowerCase();
  const profileEmail = String(identity.profileEmail || "").trim().toLowerCase();
  const uid = String(identity.uid || "").trim();
  if (authEmail && emails.has(authEmail)) return true;
  if (profileEmail && emails.has(profileEmail) && authEmail && emails.has(authEmail)) return true;
  if (uid && uids.has(uid)) return true;
  return false;
}
async function azCommissionIdentityFromRequest(req) {
  try {
    if (!initFirebaseAdmin() || !firebaseAdmin || !firebaseAdmin.auth) return null;
    const h = String(req.headers.authorization || "");
    const token = h.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const db = getAzobssBackendDb();
    const decodedEmail = String(decoded.email || "").toLowerCase();
    const identity = {
      uid: String(decoded.uid || ""),
      email: decodedEmail,
      authEmail: decodedEmail,
      profileEmail: "",
      username: "",
      role: "",
      isAdmin: false
    };
    if (db && identity.uid) {
      try {
        const qs = await db.collection("users").where("uid", "==", identity.uid).limit(1).get();
        qs.forEach(doc => {
          const x = doc.data() || {};
          identity.username = String(x.usernameKey || x.username || doc.id || "").toLowerCase();
          identity.role = String(x.role || "").toLowerCase();
          identity.profileEmail = String(x.email || x.authEmail || "").toLowerCase();
          identity.email = identity.authEmail || identity.profileEmail || identity.email;
          identity.userDocId = String(doc.id || identity.username || identity.uid || "");
          identity.adminPriceAdjustmentOverride = x.adminPriceAdjustmentOverride === true;
          identity.adminPriceAdjustmentPercent = azNormalizeUserPriceAdjustment(x.adminPriceAdjustmentPercent ?? x.priceAdjustmentPercent ?? 0);
          identity.priceAdjustmentPercent = azNormalizeUserPriceAdjustment(x.priceAdjustmentPercent ?? x.adminPriceAdjustmentPercent ?? 0);
          identity.adminPriceAdjustmentByCategory = x.adminPriceAdjustmentByCategory && typeof x.adminPriceAdjustmentByCategory === "object" ? { ...x.adminPriceAdjustmentByCategory } : null;
          identity.priceAdjustmentByCategory = x.priceAdjustmentByCategory && typeof x.priceAdjustmentByCategory === "object" ? { ...x.priceAdjustmentByCategory } : null;
          identity.adminPaBmPriceAdjustmentPercent = x.adminPaBmPriceAdjustmentPercent;
          identity.paBmPriceAdjustmentPercent = x.paBmPriceAdjustmentPercent;
          identity.adminLotKadasterPriceAdjustmentPercent = x.adminLotKadasterPriceAdjustmentPercent;
          identity.lotKadasterPriceAdjustmentPercent = x.lotKadasterPriceAdjustmentPercent;
          identity.adminPublicPaPriceAdjustmentPercent = x.adminPublicPaPriceAdjustmentPercent;
          identity.publicPaPriceAdjustmentPercent = x.publicPaPriceAdjustmentPercent;
          identity.adminSoftwarePriceAdjustmentPercent = x.adminSoftwarePriceAdjustmentPercent;
          identity.softwarePriceAdjustmentPercent = x.softwarePriceAdjustmentPercent;
          identity.adminCadToolsPriceAdjustmentPercent = x.adminCadToolsPriceAdjustmentPercent;
          identity.cadToolsPriceAdjustmentPercent = x.cadToolsPriceAdjustmentPercent;
          identity.priceAdjustmentManagedBy = String(x.priceAdjustmentManagedBy || "");
        });
      } catch (err) {
        console.warn("Commission identity profile lookup failed:", err && (err.message || err));
      }
    }
    // Strict backend-admin identity: do not trust arbitrary Firestore role/name for admin-level reads.
    // Admin is allowed only by server-side allow-list email/UID. This prevents staff/semi-admin
    // or old test usernames (for example zedan0001) from being treated as backend admin.
    identity.isAdmin = azIdentityTrustedForBackendAdmin(identity);
    return identity;
  } catch (err) {
    console.warn("Commission Firebase token verify failed:", err && (err.message || err));
    return null;
  }
}
async function azFastTrustedAdminIdentityFromRequest(req) {
  try {
    const h = String(req.headers.authorization || "");
    const token = h.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    const identity = { uid:String(decoded.uid || ""), email, authEmail:email, profileEmail:"", username:"", role:"admin", isAdmin:false };
    if (!azIdentityTrustedForBackendAdmin(identity)) return null;
    identity.isAdmin = true;
    identity.authMethod = "firebase-admin-token-fast";
    return identity;
  } catch (err) {
    console.warn("Fast backend admin token verify failed:", err && (err.message || err));
    return null;
  }
}
async function azAdminIdentityFromRequest(req, parsed) {
  const hasSecret = azRequestHasAdminSecret(req, parsed);
  const fastIdentity = await azFastTrustedAdminIdentityFromRequest(req);
  if (fastIdentity) return Object.assign({}, fastIdentity, { role:"admin", isAdmin:true, authMethod:hasSecret ? "firebase-admin-token-fast+api-secret" : "firebase-admin-token-fast" });
  const identity = await azCommissionIdentityFromRequest(req);

  // Preferred flow: browser sends Firebase ID token only. Backend verifies the token
  // with Firebase Admin and trusts only the server allow-list emails/UIDs.
  // This means ADMIN_KEY stays private in Render ENV and never has to be saved in browser.
  if (identity && azIdentityTrustedForBackendAdmin(identity)) {
    return Object.assign({}, identity, {
      role: "admin",
      isAdmin: true,
      authMethod: hasSecret ? "firebase-admin-token+api-secret" : "firebase-admin-token"
    });
  }

  // Backward-compatible emergency/manual fallback: a correct server secret can still unlock
  // backend admin routes even without a Firebase browser session.
  if (hasSecret) {
    return { uid: "api-secret", email: "", authEmail: "", username: "api-secret", role: "admin", isAdmin: true, authMethod: "api-secret" };
  }

  return null;
}
function azIdentityHasStaffDashboardAccess(identity = {}) {
  if (!identity || !identity.uid) return false;
  if (azIdentityTrustedForBackendAdmin(identity)) return true;
  const role = String(identity.role || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return ['staff', 'semiadmin', 'seller', 'editor'].includes(role);
}
function azAdminBypassEnabled() {
  // Emergency only. Keep unset in production. This reopens the old public manual completion endpoint.
  return String(process.env.AZOBSS_ALLOW_PUBLIC_COMPLETE_PURCHASE || "") === "1";
}
function azCommissionRecordBelongsToIdentity(x = {}, identity = {}) {
  if (!identity || !identity.uid) return false;
  if (identity.isAdmin) return true;
  const needles = [identity.uid, identity.email, identity.username].map(v => String(v || "").toLowerCase()).filter(Boolean);
  if (!needles.length) return false;
  const vals = [
    x.uid, x.createdByUid, x.ownerUid, x.staffUid, x.sellerUid, x.memberUid, x.sharerUid,
    x.username, x.usernameKey, x.createdByUsername, x.ownerUsername, x.staffUsername, x.sellerUsername, x.sharerUsername,
    x.email, x.createdByEmail, x.ownerEmail, x.staffEmail, x.sellerEmail, x.sharerEmail,
    x.shareReferral && x.shareReferral.username, x.shareReferral && x.shareReferral.ref, x.shareReferral && x.shareReferral.staffUsername
  ].map(v => String(v || "").toLowerCase()).filter(Boolean);
  return needles.some(n => vals.includes(n));
}
function azCommissionPayoutStatus(value) {
  const s = String(value || "").trim().toLowerCase();
  if (["pending", "approved", "paid", "rejected"].includes(s)) return s;
  return "";
}
function azCommissionPayoutPatch(body = {}, identity = {}) {
  const now = Date.now();
  const status = azCommissionPayoutStatus(body.payoutStatus || body.status);
  if (!status) throw new Error("Invalid payout status. Use pending, approved, paid or rejected.");
  const patch = {
    payoutStatus: status,
    status,
    payoutNote: cleanPremiumText(body.payoutNote || body.note || "", 500),
    payoutReference: cleanPremiumText(body.payoutReference || body.reference || "", 160),
    payoutMethod: cleanPremiumText(body.payoutMethod || body.method || "", 80),
    payoutUpdatedAt: new Date(now).toISOString(),
    payoutUpdatedAtMs: now,
    payoutUpdatedByUid: cleanPremiumText(identity.uid || "", 140),
    payoutUpdatedByUsername: cleanPremiumText(identity.username || "", 80),
    payoutUpdatedByRole: cleanPremiumText(identity.role || (identity.isAdmin ? "admin" : ""), 40),
    payoutUpdatedByAuthMethod: cleanPremiumText(identity.authMethod || "firebase", 40)
  };
  if (status === "approved") {
    patch.payoutApprovedAt = patch.payoutUpdatedAt;
    patch.payoutApprovedAtMs = now;
    patch.payoutApprovedBy = patch.payoutUpdatedByUsername || patch.payoutUpdatedByUid || "admin";
  }
  if (status === "paid") {
    patch.payoutPaidAt = patch.payoutUpdatedAt;
    patch.payoutPaidAtMs = now;
    patch.payoutPaidBy = patch.payoutUpdatedByUsername || patch.payoutUpdatedByUid || "admin";
  }
  if (status === "rejected") {
    patch.payoutRejectedAt = patch.payoutUpdatedAt;
    patch.payoutRejectedAtMs = now;
    patch.payoutRejectedBy = patch.payoutUpdatedByUsername || patch.payoutUpdatedByUid || "admin";
  }
  Object.keys(patch).forEach(k => { if (patch[k] === "") delete patch[k]; });
  return patch;
}
function azCommissionSafeRecord(x = {}, docId = "") {
  const safeReferral = x.shareReferral && typeof x.shareReferral === "object" ? {
    username: cleanPremiumText(x.shareReferral.username || x.shareReferral.ref || "", 80),
    ref: cleanPremiumText(x.shareReferral.ref || x.shareReferral.username || "", 80),
    productId: cleanPremiumText(x.shareReferral.productId || "", 160),
    sourcePage: cleanPremiumText(x.shareReferral.sourcePage || "", 40),
    source: cleanPremiumText(x.shareReferral.source || "", 60)
  } : null;
  return {
    docId: cleanPremiumText(docId || x.docId || x.id || "", 120),
    orderId: cleanPremiumText(x.orderId || "", 140),
    billCode: cleanPremiumText(x.billCode || "", 100),
    productId: cleanPremiumText(x.productId || "", 160),
    productName: cleanPremiumText(x.productName || x.product || x.title || "", 180),
    username: azCommissionUsername(x.username || x.ownerUsername || ""),
    ownerUsername: azCommissionUsername(x.ownerUsername || x.username || ""),
    commissionType: cleanPremiumText(x.commissionType || "", 80),
    commissionRate: Number(x.commissionRate || x.rate || 0) || 0,
    rate: Number(x.rate || x.commissionRate || 0) || 0,
    saleAmount: Number(x.saleAmount || 0) || 0,
    saleAmountText: cleanPremiumText(x.saleAmountText || "", 40),
    commissionAmount: Number(x.commissionAmount || x.amount || 0) || 0,
    amount: Number(x.amount || x.commissionAmount || 0) || 0,
    amountText: cleanPremiumText(x.amountText || "", 40),
    azobssShareAmount: Number(x.azobssShareAmount || 0) || 0,
    azobssShareRate: Number(x.azobssShareRate || 0) || 0,
    ownerShareAmount: Number(x.ownerShareAmount || 0) || 0,
    sharerShareAmount: Number(x.sharerShareAmount || 0) || 0,
    status: cleanPremiumText(x.status || "", 40),
    payoutStatus: cleanPremiumText(x.payoutStatus || x.status || "", 40),
    payoutNote: cleanPremiumText(x.payoutNote || "", 260),
    payoutReference: cleanPremiumText(x.payoutReference || "", 160),
    payoutMethod: cleanPremiumText(x.payoutMethod || "", 80),
    payoutUpdatedAt: cleanPremiumText(x.payoutUpdatedAt || "", 80),
    payoutApprovedAt: cleanPremiumText(x.payoutApprovedAt || "", 80),
    payoutPaidAt: cleanPremiumText(x.payoutPaidAt || "", 80),
    payoutRejectedAt: cleanPremiumText(x.payoutRejectedAt || "", 80),
    paymentStatus: cleanPremiumText(x.paymentStatus || "", 40),
    sourcePage: cleanPremiumText(x.sourcePage || (safeReferral && safeReferral.sourcePage) || "", 40),
    note: cleanPremiumText(x.note || "", 260),
    createdAt: cleanPremiumText(x.createdAt || "", 80),
    createdAtMs: Number(x.createdAtMs || 0) || 0,
    shareReferral: safeReferral
  };
}


// =========================
// STAFF PAYOUT PROFILE / REQUEST HELPERS
// Backend-only writes so no Firebase Rules update is required.
// =========================
function maskEmail(value) {
  const s = String(value || '').trim();
  if (!s || !s.includes('@')) return s ? 'configured' : '';
  const [name, domain] = s.split('@');
  return (name.slice(0, 2) || '*') + '***@' + (domain || '');
}
function azPayoutCleanAccountNo(value) {
  return cleanPremiumText(String(value || '').replace(/[^0-9A-Za-z+\-\s]/g, '').replace(/\s+/g, ' ').trim(), 80);
}
function azPayoutMaskAccount(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const compact = s.replace(/\s+/g, '');
  if (compact.length <= 4) return '••••';
  return '•••• ' + compact.slice(-4);
}
function azPayoutIdentityDocId(identity = {}) {
  return cleanPremiumText(identity.uid || identity.username || identity.email || 'unknown', 140).replace(/[\\/#?\[\]]/g, '_') || 'unknown';
}
function azPayoutProfileFromBody(body = {}, identity = {}) {
  const now = Date.now();
  const methodRaw = String(body.payoutMethod || body.method || 'bank').trim().toLowerCase();
  const allowed = ['bank','duitnow','tng','ewallet','paypal','cash','other'];
  const method = allowed.includes(methodRaw) ? methodRaw : 'bank';
  const profile = {
    uid: cleanPremiumText(identity.uid || '', 140),
    username: cleanPremiumText(identity.username || '', 80),
    email: cleanPremiumText(identity.email || '', 160),
    payoutMethod: method,
    bankName: cleanPremiumText(body.bankName || body.bank || '', 120),
    accountName: cleanPremiumText(body.accountName || body.name || '', 140),
    accountNo: azPayoutCleanAccountNo(body.accountNo || body.accountNumber || ''),
    duitNowId: cleanPremiumText(body.duitNowId || body.duitnow || '', 120),
    ewalletName: cleanPremiumText(body.ewalletName || body.walletName || '', 120),
    payoutPhone: cleanPremiumText(body.payoutPhone || body.phone || '', 60),
    payoutEmail: cleanPremiumText(body.payoutEmail || body.email || identity.email || '', 160),
    note: cleanPremiumText(body.note || '', 300),
    updatedAt: new Date(now).toISOString(),
    updatedAtMs: now
  };
  if (!profile.accountName) throw new Error('Account holder name is required.');
  if (profile.payoutMethod === 'bank' && (!profile.bankName || !profile.accountNo)) throw new Error('Bank name and account number are required for bank payout.');
  if (profile.payoutMethod === 'duitnow' && !profile.duitNowId && !profile.payoutPhone) throw new Error('DuitNow ID or phone number is required.');
  if ((profile.payoutMethod === 'tng' || profile.payoutMethod === 'ewallet') && !profile.payoutPhone && !profile.payoutEmail) throw new Error('Phone or email is required for eWallet payout.');
  return profile;
}
function azPayoutProfilePublic(x = {}, adminView = false) {
  return {
    uid: cleanPremiumText(x.uid || '', 140),
    username: cleanPremiumText(x.username || '', 80),
    email: adminView ? cleanPremiumText(x.email || '', 160) : maskEmail(x.email || ''),
    payoutMethod: cleanPremiumText(x.payoutMethod || '', 40),
    bankName: cleanPremiumText(x.bankName || '', 120),
    accountName: cleanPremiumText(x.accountName || '', 140),
    accountNo: adminView ? cleanPremiumText(x.accountNo || '', 80) : '',
    accountNoMasked: azPayoutMaskAccount(x.accountNo || ''),
    duitNowId: adminView ? cleanPremiumText(x.duitNowId || '', 120) : (x.duitNowId ? 'configured' : ''),
    ewalletName: cleanPremiumText(x.ewalletName || '', 120),
    payoutPhone: adminView ? cleanPremiumText(x.payoutPhone || '', 60) : (x.payoutPhone ? azPayoutMaskAccount(x.payoutPhone) : ''),
    payoutEmail: adminView ? cleanPremiumText(x.payoutEmail || '', 160) : maskEmail(x.payoutEmail || ''),
    note: cleanPremiumText(x.note || '', 300),
    updatedAt: cleanPremiumText(x.updatedAt || '', 80),
    updatedAtMs: Number(x.updatedAtMs || 0) || 0
  };
}
async function azGetStaffPayoutProfile(identity = {}, adminView = false) {
  const db = getAzobssBackendDb();
  if (!db) return null;
  const id = azPayoutIdentityDocId(identity);
  const doc = await db.collection('staffPayoutProfiles').doc(id).get();
  if (!doc.exists) return null;
  return azPayoutProfilePublic(doc.data() || {}, adminView);
}
async function azGetCommissionRowsForIdentity(identity = {}, maxRows = 500) {
  const db = getAzobssBackendDb();
  const rows = [];
  if (db) {
    const snap = await db.collection('commissionRecords').orderBy('createdAtMs', 'desc').limit(Math.max(1, Math.min(800, maxRows))).get();
    snap.forEach(doc => {
      const x = doc.data() || {};
      if (azCommissionRecordBelongsToIdentity(x, identity)) rows.push({ docId: doc.id, ...x });
    });
    return rows;
  }
  const localRows = readPremiumJson(COMMISSION_RECORDS_FILE, []);
  if (Array.isArray(localRows)) {
    localRows.forEach((x, i) => { if (azCommissionRecordBelongsToIdentity(x, identity)) rows.push({ docId: x.docId || x.id || `local_${i}`, ...x }); });
  }
  return rows.slice(0, maxRows);
}
function azPayoutStatusBucketValue(x = {}) {
  const s = String(x.payoutStatus || x.status || '').toLowerCase();
  if (['paid','settled','released'].includes(s)) return 'paid';
  if (s === 'approved') return 'approved';
  if (['rejected','cancelled','void'].includes(s)) return 'rejected';
  return 'pending';
}
function azCommissionAmountValue(x = {}) {
  return Math.max(0, Number(x.commissionAmount || x.amount || x.totalCommission || 0) || 0);
}
function azPayoutRequestSafe(x = {}, docId = '', adminView = false) {
  const profile = x.profileSnapshot || x.profile || {};
  return {
    docId: cleanPremiumText(docId || x.docId || x.id || '', 140),
    requestId: cleanPremiumText(x.requestId || docId || '', 140),
    uid: cleanPremiumText(x.uid || '', 140),
    username: cleanPremiumText(x.username || '', 80),
    email: adminView ? cleanPremiumText(x.email || '', 160) : maskEmail(x.email || ''),
    amount: Number(x.amount || 0) || 0,
    amountText: `RM${(Number(x.amount || 0) || 0).toFixed(2)}`,
    eligibleAmount: Number(x.eligibleAmount || 0) || 0,
    recordCount: Number(x.recordCount || 0) || 0,
    commissionDocIds: Array.isArray(x.commissionDocIds) ? x.commissionDocIds.map(v => cleanPremiumText(v, 140)).slice(0, 100) : [],
    status: cleanPremiumText(x.status || 'requested', 40),
    note: cleanPremiumText(x.note || '', 500),
    adminNote: cleanPremiumText(x.adminNote || '', 500),
    payoutReference: cleanPremiumText(x.payoutReference || '', 160),
    payoutMethod: cleanPremiumText(x.payoutMethod || '', 80),
    profile: azPayoutProfilePublic(profile, adminView),
    createdAt: cleanPremiumText(x.createdAt || '', 80),
    createdAtMs: Number(x.createdAtMs || 0) || 0,
    updatedAt: cleanPremiumText(x.updatedAt || '', 80),
    updatedAtMs: Number(x.updatedAtMs || 0) || 0,
    timeline: azPayoutTimelineSafe(x.timeline || x.events || [], adminView)
  };
}
function azPayoutRequestReceiptHtml(x = {}, docId = '', identity = {}) {
  const adminView = !!(identity && identity.isAdmin);
  const requestId = cleanPremiumText(x.requestId || docId || '', 160);
  const status = cleanPremiumText(x.status || 'requested', 40).toUpperCase();
  const amount = Number(x.amount || 0) || 0;
  const profile = azPayoutProfilePublic(x.profileSnapshot || x.profile || {}, adminView);
  const accountParts = [
    profile.payoutMethod,
    profile.bankName || profile.ewalletName,
    profile.accountName,
    adminView ? (profile.accountNo || profile.accountNoMasked) : profile.accountNoMasked,
    profile.duitNowId,
    profile.payoutPhone,
    profile.payoutEmail
  ].filter(Boolean);
  const timeline = azPayoutTimelineSafe(x.timeline || x.events || [], adminView);
  const issuedAt = new Date().toISOString();
  const rows = [
    ['Receipt Type', 'AZOBSS Commission Payout'],
    ['Request ID', requestId],
    ['Status', status],
    ['Amount', azMoneyRm(amount)],
    ['Staff', cleanPremiumText(x.username || x.email || '-', 160)],
    ['Record Count', String(Number(x.recordCount || 0) || 0)],
    ['Requested At', cleanPremiumText(x.createdAt || '', 80)],
    ['Updated At', cleanPremiumText(x.updatedAt || '', 80)],
    ['Paid At', cleanPremiumText(x.paidAt || x.payoutPaidAt || '', 80)],
    ['Payout Method', cleanPremiumText(x.payoutMethod || profile.payoutMethod || '', 80)],
    ['Payment Reference', cleanPremiumText(x.payoutReference || '', 160)],
    ['Payout Account', accountParts.join(' • ')],
    ['Admin Note', cleanPremiumText(x.adminNote || '', 500)],
    ['Staff Note', cleanPremiumText(x.note || '', 500)]
  ];
  const safeRows = rows.filter(([,v]) => String(v || '').trim()).map(([k,v]) => `<tr><th>${azHtmlEscape(k)}</th><td>${azHtmlEscape(v)}</td></tr>`).join('');
  const timelineHtml = timeline.length ? timeline.map(ev => `<li><b>${azHtmlEscape(ev.status || ev.type || 'update')}</b> — ${azHtmlEscape(ev.note || '')} ${ev.actorUsername ? 'by ' + azHtmlEscape(ev.actorUsername) : ''} ${ev.createdAt ? '<small>(' + azHtmlEscape(ev.createdAt) + ')</small>' : ''}</li>`).join('') : '<li>No timeline events.</li>';
  const commissionIds = Array.isArray(x.commissionDocIds) ? x.commissionDocIds.map(v => cleanPremiumText(v, 140)).filter(Boolean).slice(0, 80) : [];
  const commissionHtml = commissionIds.length ? commissionIds.map(v => `<span class="pill">${azHtmlEscape(v)}</span>`).join(' ') : '<span class="muted">No linked commission record IDs.</span>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AZOBSS Payout Receipt ${azHtmlEscape(requestId)}</title><style>body{font-family:Arial,sans-serif;background:#f6f7fb;color:#111;margin:0;padding:24px}.wrap{max-width:900px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.08);overflow:hidden}.head{background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;padding:24px}.head h1{margin:0 0 8px;font-size:26px}.badge{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);padding:6px 10px;border-radius:999px}.content{padding:24px}.amount{font-size:34px;font-weight:800;margin:10px 0}.status{font-weight:800}.status.PAID{color:#059669}.status.REJECTED,.status.CANCELLED{color:#dc2626}.status.APPROVED{color:#2563eb}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{text-align:left;border-bottom:1px solid #e5e7eb;padding:10px;vertical-align:top}th{width:210px;background:#f8fafc;color:#334155}.muted{color:#64748b}.pill{display:inline-block;background:#eef2ff;color:#1e40af;border:1px solid #c7d2fe;border-radius:999px;padding:4px 8px;margin:2px;font-size:12px}ul{padding-left:20px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}button{border:0;border-radius:10px;background:#111827;color:#fff;padding:10px 14px;font-weight:700;cursor:pointer}.foot{font-size:12px;color:#64748b;margin-top:22px}@media print{body{background:#fff;padding:0}.wrap{box-shadow:none;border:0}.actions{display:none}}</style></head><body><div class="wrap"><div class="head"><h1>AZOBSS Payout Receipt</h1><div class="badge">${azHtmlEscape(requestId)}</div></div><div class="content"><div class="muted">Amount</div><div class="amount">${azHtmlEscape(azMoneyRm(amount))}</div><div>Status: <span class="status ${azHtmlEscape(status)}">${azHtmlEscape(status)}</span></div><table>${safeRows}</table><h2>Linked Commission Records</h2><div>${commissionHtml}</div><h2>Timeline</h2><ul>${timelineHtml}</ul><div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div><div class="foot">Generated at ${azHtmlEscape(issuedAt)}. This page is protected by AZOBSS login token and is intended for payout reference only.</div></div></div></body></html>`;
}

function azPayoutRequestStatus(value) {
  const s = String(value || '').trim().toLowerCase();
  if (['requested','reviewing','approved','paid','rejected','cancelled'].includes(s)) return s;
  return '';
}

function azPayoutMinAmountRm() {
  const raw = process.env.AZOBSS_PAYOUT_MIN_AMOUNT_RM || process.env.AZOBSS_PAYOUT_MIN_RM || "0.01";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0.01;
}
function azPayoutMaxAmountRm() {
  const raw = process.env.AZOBSS_PAYOUT_MAX_AMOUNT_RM || process.env.AZOBSS_PAYOUT_MAX_RM || "";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
function azPayoutRequirePaidReference() {
  return String(process.env.AZOBSS_PAYOUT_REQUIRE_PAID_REFERENCE || "").trim() === "1";
}
function azPayoutAllowReopenFinal() {
  return String(process.env.AZOBSS_PAYOUT_ALLOW_REOPEN_FINAL || "").trim() === "1";
}
function azPayoutConfigPublic() {
  const minAmount = azPayoutMinAmountRm();
  const maxAmount = azPayoutMaxAmountRm();
  return {
    minAmount,
    minAmountText: `RM${minAmount.toFixed(2)}`,
    maxAmount,
    maxAmountText: maxAmount ? `RM${maxAmount.toFixed(2)}` : "",
    requirePaidReference: azPayoutRequirePaidReference(),
    finalStatusGuard: !azPayoutAllowReopenFinal()
  };
}
function azPayoutTimelineEvent(type, actor = {}, note = '', extra = {}) {
  const now = Date.now();
  return {
    type: cleanPremiumText(type || 'update', 60),
    note: cleanPremiumText(note || '', 360),
    status: cleanPremiumText(extra.status || '', 40),
    actorUid: cleanPremiumText(actor.uid || '', 140),
    actorUsername: cleanPremiumText(actor.username || '', 80),
    actorRole: cleanPremiumText(actor.role || (actor.isAdmin ? 'admin' : 'staff'), 40),
    actorEmailMasked: maskEmail(actor.email || ''),
    createdAt: new Date(now).toISOString(),
    createdAtMs: now
  };
}
function azPayoutTimelineSafe(list = [], adminView = false) {
  if (!Array.isArray(list)) return [];
  return list.slice(-30).map(x => ({
    type: cleanPremiumText(x && x.type || 'update', 60),
    status: cleanPremiumText(x && x.status || '', 40),
    note: cleanPremiumText(x && x.note || '', 360),
    actorUsername: cleanPremiumText(x && x.actorUsername || '', 80),
    actorRole: cleanPremiumText(x && x.actorRole || '', 40),
    actorEmailMasked: cleanPremiumText(x && x.actorEmailMasked || '', 160),
    createdAt: cleanPremiumText(x && x.createdAt || '', 80),
    createdAtMs: Number(x && x.createdAtMs || 0) || 0
  }));
}
function azPayoutAppendTimeline(oldRequest = {}, event = {}) {
  const prev = Array.isArray(oldRequest.timeline) ? oldRequest.timeline : (Array.isArray(oldRequest.events) ? oldRequest.events : []);
  return [...prev.slice(-24), event].filter(Boolean);
}
function azPayoutAdminNotifyEmails() {
  return String(process.env.AZOBSS_ADMIN_NOTIFY_EMAILS || process.env.AZOBSS_PAYOUT_ADMIN_EMAILS || '')
    .split(/[;,]/).map(x => x.trim()).filter(x => x && x.includes('@')).slice(0, 5);
}
async function azMaybeSendPayoutEmail({ to, subject, html, text, requestId, kind }) {
  const recipients = Array.isArray(to) ? to : [to];
  if (!mailReady()) return { ok:false, skipped:'mail-not-ready' };
  const sent = [];
  for (const email of recipients.map(x => cleanPremiumText(x, 180)).filter(x => x && x.includes('@'))) {
    try {
      if (brevoApiReady()) await sendBrevoApiEmail({ to: email, subject, html, text });
      else {
        const transporter = makeMailer();
        if (!transporter) throw new Error('SMTP not configured');
        await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER, to: email, subject, html, text });
      }
      sent.push(maskEmail(email));
    } catch (err) {
      console.warn('AZOBSS payout email failed:', JSON.stringify({ requestId, kind, email: maskEmail(email), error: err && (err.message || err) }).slice(0, 700));
    }
  }
  return { ok: sent.length > 0, sent };
}
async function azNotifyPayoutSubmitted(req, requestRow = {}, identity = {}) {
  const adminEmails = azPayoutAdminNotifyEmails();
  if (!adminEmails.length) return { ok:false, skipped:'no-admin-notify-emails' };
  const base = publicBaseUrlFromReq(req);
  const subject = `AZOBSS Payout Request - ${requestRow.amountText || ('RM' + Number(requestRow.amount || 0).toFixed(2))}`;
  const body = `A staff payout request has been submitted.\n\nStaff: ${requestRow.username || requestRow.email || '-'}\nAmount: ${requestRow.amountText || requestRow.amount || '-'}\nRecords: ${requestRow.recordCount || 0}\nRequest ID: ${requestRow.requestId || '-'}\n\nOpen Admin Dashboard: ${base}/admin/`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>AZOBSS Payout Request</h2><p>A staff payout request has been submitted.</p><p><b>Staff:</b> ${cleanPremiumText(requestRow.username || requestRow.email || '-', 160)}<br><b>Amount:</b> ${cleanPremiumText(requestRow.amountText || ('RM' + Number(requestRow.amount || 0).toFixed(2)), 40)}<br><b>Records:</b> ${Number(requestRow.recordCount || 0) || 0}<br><b>Request ID:</b> ${cleanPremiumText(requestRow.requestId || '-', 120)}</p><p><a href="${base}/admin/">Open Admin Dashboard</a></p></div>`;
  return azMaybeSendPayoutEmail({ to: adminEmails, subject, html, text: body, requestId: requestRow.requestId, kind:'payout-submitted-admin' });
}
async function azNotifyPayoutStatusToStaff(req, requestRow = {}, status = '', patch = {}) {
  const email = cleanPremiumText(requestRow.email || (requestRow.profileSnapshot && requestRow.profileSnapshot.payoutEmail) || '', 180);
  if (!email || !email.includes('@')) return { ok:false, skipped:'no-staff-email' };
  const label = String(status || requestRow.status || '').toUpperCase();
  const base = publicBaseUrlFromReq(req);
  const amountText = requestRow.amountText || ('RM' + Number(requestRow.amount || 0).toFixed(2));
  const note = cleanPremiumText(patch.adminNote || requestRow.adminNote || '', 500);
  const ref = cleanPremiumText(patch.payoutReference || requestRow.payoutReference || '', 160);
  const method = cleanPremiumText(patch.payoutMethod || requestRow.payoutMethod || '', 80);
  const subject = `AZOBSS Payout ${label} - ${amountText}`;
  const body = `Your AZOBSS payout request status has been updated.\n\nStatus: ${label}\nAmount: ${amountText}\nRequest ID: ${requestRow.requestId || ''}\n${ref ? `Reference: ${ref}\n` : ''}${method ? `Method: ${method}\n` : ''}${note ? `Admin note: ${note}\n` : ''}\nOpen Staff Dashboard: ${base}/staff/`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>AZOBSS Payout ${label}</h2><p>Your payout request status has been updated.</p><p><b>Status:</b> ${label}<br><b>Amount:</b> ${cleanPremiumText(amountText, 40)}<br><b>Request ID:</b> ${cleanPremiumText(requestRow.requestId || '', 120)}${ref?`<br><b>Reference:</b> ${ref}`:''}${method?`<br><b>Method:</b> ${method}`:''}${note?`<br><b>Admin note:</b> ${note}`:''}</p><p><a href="${base}/staff/">Open Staff Dashboard</a></p></div>`;
  return azMaybeSendPayoutEmail({ to: email, subject, html, text: body, requestId: requestRow.requestId, kind:'payout-status-staff' });
}

function azPayoutRequestBelongsToIdentity(x = {}, identity = {}) {
  if (!identity || !identity.uid) return false;
  if (identity.isAdmin) return true;
  const needles = [identity.uid, identity.email, identity.username].map(v => String(v || '').toLowerCase()).filter(Boolean);
  if (!needles.length) return false;
  const vals = [
    x.uid, x.staffUid, x.ownerUid, x.requestByUid, x.createdByUid,
    x.username, x.staffUsername, x.ownerUsername, x.requestByUsername, x.createdByUsername,
    x.email, x.staffEmail, x.ownerEmail, x.requestByEmail, x.createdByEmail
  ].map(v => String(v || '').toLowerCase()).filter(Boolean);
  return needles.some(n => vals.includes(n));
}
function azPayoutRequestPatch(body = {}, identity = {}) {
  const now = Date.now();
  const status = azPayoutRequestStatus(body.status || body.payoutRequestStatus || '');
  if (!status) throw new Error('Invalid payout request status.');
  const patch = {
    status,
    adminNote: cleanPremiumText(body.adminNote || body.note || '', 500),
    payoutReference: cleanPremiumText(body.payoutReference || body.reference || '', 160),
    payoutMethod: cleanPremiumText(body.payoutMethod || body.method || '', 80),
    updatedAt: new Date(now).toISOString(),
    updatedAtMs: now,
    updatedByUid: cleanPremiumText(identity.uid || '', 140),
    updatedByUsername: cleanPremiumText(identity.username || '', 80),
    updatedByRole: cleanPremiumText(identity.role || (identity.isAdmin ? 'admin' : ''), 40)
  };
  if (status === 'reviewing') { patch.reviewedAt = patch.updatedAt; patch.reviewedAtMs = now; }
  if (status === 'approved') { patch.approvedAt = patch.updatedAt; patch.approvedAtMs = now; }
  if (status === 'paid') { patch.paidAt = patch.updatedAt; patch.paidAtMs = now; }
  if (status === 'rejected') { patch.rejectedAt = patch.updatedAt; patch.rejectedAtMs = now; }
  if (status === 'cancelled') { patch.cancelledAt = patch.updatedAt; patch.cancelledAtMs = now; }
  return patch;
}
function azCommissionPatchForPayoutRequest(status, body = {}, identity = {}) {
  const now = Date.now();
  const patch = {
    payoutRequestStatus: status,
    payoutRequestUpdatedAt: new Date(now).toISOString(),
    payoutRequestUpdatedAtMs: now,
    payoutRequestUpdatedByUid: cleanPremiumText(identity.uid || '', 140),
    payoutRequestUpdatedByUsername: cleanPremiumText(identity.username || '', 80)
  };
  if (status === 'paid') {
    patch.status = 'paid';
    patch.payoutStatus = 'paid';
    patch.payoutPaidAt = patch.payoutRequestUpdatedAt;
    patch.payoutPaidAtMs = now;
    patch.payoutUpdatedAt = patch.payoutRequestUpdatedAt;
    patch.payoutUpdatedAtMs = now;
    patch.payoutReference = cleanPremiumText(body.payoutReference || body.reference || '', 160);
    patch.payoutMethod = cleanPremiumText(body.payoutMethod || body.method || '', 80);
    patch.payoutUpdatedByUid = cleanPremiumText(identity.uid || '', 140);
    patch.payoutUpdatedByUsername = cleanPremiumText(identity.username || '', 80);
  }
  return patch;
}

function azMakeReceiptToken(order = {}) {
  const secret = String(process.env.AZOBSS_RECEIPT_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "azobss-receipt-fallback-secret");
  const base = `${order.orderId || ""}|${order.billCode || ""}|${order.createdAt || ""}|${order.amountSen || ""}`;
  return crypto.createHmac("sha256", secret).update(base).digest("hex").slice(0, 24);
}
function azReceiptUrl(base, order = {}) {
  const orderId = encodeURIComponent(order.orderId || "");
  return `${base}/api/premium/receipt/${orderId}?rt=${encodeURIComponent(azMakeReceiptToken(order))}`;
}
function azReceiptTokenOk(order = {}, supplied = "") {
  const expected = azMakeReceiptToken(order);
  // New premium orders created after hardening require receipt token by default.
  // Old historical orders/fallback commission receipts can still be opened unless AZOBSS_REQUIRE_RECEIPT_TOKEN=1.
  const requireForThisOrder = process.env.AZOBSS_REQUIRE_RECEIPT_TOKEN === "1" || order.receiptTokenRequired === true || String(order.receiptTokenRequired || "") === "1";
  if (!supplied) return requireForThisOrder ? false : true;
  try { return crypto.timingSafeEqual(Buffer.from(String(supplied)), Buffer.from(expected)); } catch (_) { return String(supplied) === expected; }
}


const AZOBSS_ADMIN_AUDIT_FILE = path.join(__dirname, "admin-audit-logs.json");
function azAuditSafeText(value, max = 260) {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
function azAuditRedactValue(key, value) {
  const k = String(key || "").toLowerCase();
  if (/token|secret|password|private|key|authorization|api/i.test(k)) return "***redacted***";
  if (/email/i.test(k)) return azMaskEmail(value);
  if (typeof value === "string") return azAuditSafeText(value, 260);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return value;
}
function azAuditSanitizeDetails(details = {}, depth = 0) {
  if (!details || typeof details !== "object" || depth > 2) return {};
  if (Array.isArray(details)) return details.slice(0, 30).map((v, i) => azAuditRedactValue(String(i), v));
  const out = {};
  Object.entries(details).slice(0, 50).forEach(([key, value]) => {
    const k = azAuditSafeText(key, 80);
    if (!k) return;
    if (value && typeof value === "object" && !Array.isArray(value)) out[k] = azAuditSanitizeDetails(value, depth + 1);
    else out[k] = azAuditRedactValue(k, value);
  });
  return out;
}
function azReadLocalAuditLogs() {
  try {
    if (!fs.existsSync(AZOBSS_ADMIN_AUDIT_FILE)) return [];
    const rows = JSON.parse(fs.readFileSync(AZOBSS_ADMIN_AUDIT_FILE, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch (_) { return []; }
}
function azWriteLocalAuditLog(row) {
  try {
    const rows = azReadLocalAuditLogs();
    rows.unshift(row);
    fs.writeFileSync(AZOBSS_ADMIN_AUDIT_FILE, JSON.stringify(rows.slice(0, 500), null, 2), "utf8");
  } catch (err) {
    console.warn("AZOBSS local audit log write failed:", err && (err.message || err));
  }
}
function azAuditIdentitySafe(identity = {}) {
  return {
    uid: azAuditSafeText(identity.uid || "", 120),
    username: azAuditSafeText(identity.username || "", 80),
    email: identity.email ? azMaskEmail(identity.email) : "",
    role: azAuditSafeText(identity.role || (identity.isAdmin ? "admin" : ""), 40),
    authMethod: azAuditSafeText(identity.authMethod || "firebase", 40),
    isAdmin: !!identity.isAdmin
  };
}
async function azWriteAdminAuditLog(req, identity = {}, action = "admin_action", targetType = "general", targetId = "", details = {}, status = "success") {
  const now = Date.now();
  const row = {
    id: makeId("aud"),
    action: azAuditSafeText(action, 100),
    targetType: azAuditSafeText(targetType, 80),
    targetId: azAuditSafeText(targetId, 180),
    status: azAuditSafeText(status || "success", 40),
    details: azAuditSanitizeDetails(details || {}),
    admin: azAuditIdentitySafe(identity || {}),
    ipHash: crypto.createHash("sha256").update(azClientIp(req) || "unknown").digest("hex").slice(0, 24),
    userAgent: azAuditSafeText(req && req.headers && req.headers["user-agent"] || "", 180),
    createdAt: new Date(now).toISOString(),
    createdAtMs: now
  };
  let firestoreOk = false;
  try {
    const db = getAzobssBackendDb();
    if (db) {
      await db.collection("adminAuditLogs").doc(row.id).set(azJsonSafe(row), { merge: true });
      firestoreOk = true;
    }
  } catch (err) {
    console.warn("AZOBSS Firestore audit log write failed:", err && (err.message || err));
  }
  if (!firestoreOk) azWriteLocalAuditLog(row);
  return { ok: true, firestoreOk, id: row.id };
}
function azAuditLogPublicRow(x = {}, docId = "") {
  const admin = x.admin && typeof x.admin === "object" ? x.admin : {};
  return {
    id: azAuditSafeText(docId || x.id || "", 120),
    action: azAuditSafeText(x.action || "", 100),
    targetType: azAuditSafeText(x.targetType || "", 80),
    targetId: azAuditSafeText(x.targetId || "", 180),
    status: azAuditSafeText(x.status || "", 40),
    details: azAuditSanitizeDetails(x.details || {}),
    admin: {
      username: azAuditSafeText(admin.username || "", 80),
      email: azAuditSafeText(admin.email || "", 120),
      role: azAuditSafeText(admin.role || "", 40),
      authMethod: azAuditSafeText(admin.authMethod || "", 40)
    },
    createdAt: azAuditSafeText(x.createdAt || "", 80),
    createdAtMs: Number(x.createdAtMs || 0) || 0
  };
}



function azPaBmPurchaseRecordPublic(x = {}, docId = "") {
  const createdAtMs = Number(x.createdAtMs || x.timestampMs || 0)
    || azobssFirestoreMs(x.createdAtClient)
    || azobssFirestoreMs(x.createdAt)
    || 0;
  const paidAtMs = Number(x.paidAtMs || x.verifiedAtMs || x.paymentVerifiedAtMs || 0)
    || azobssFirestoreMs(x.paidAtClient)
    || azobssFirestoreMs(x.verifiedAtClient)
    || azobssFirestoreMs(x.paidAt)
    || 0;
  const updatedAtMs = Number(x.updatedAtMs || 0)
    || azobssFirestoreMs(x.updatedAtClient)
    || azobssFirestoreMs(x.updatedAt)
    || 0;
  const downloadExpiresAtMs = Number(x.downloadExpiresAtMs || x.expiresAtMs || 0)
    || azobssFirestoreMs(x.downloadExpiresAtClient)
    || azobssFirestoreMs(x.expiresAt)
    || 0;
  return {
    id: azExportSafeText(docId || x.firestoreId || x.purchaseLogId || x.id || x.recordId || "", 180),
    firestoreId: azExportSafeText(docId || x.firestoreId || x.purchaseLogId || x.id || x.recordId || "", 180),
    purchaseLogId: azExportSafeText(x.purchaseLogId || docId || "", 180),
    usernameKey: azExportSafeText(x.usernameKey || x.username || x.displayName || "", 120).toLowerCase(),
    username: azExportSafeText(x.username || x.usernameKey || x.displayName || "", 120),
    displayName: azExportSafeText(x.displayName || x.username || x.usernameKey || "", 120),
    uid: azExportSafeText(x.uid || "", 180),
    email: azExportSafeText(x.email || x.buyerEmail || "", 180),
    phone: azExportSafeText(x.phone || x.phoneNumber || "", 80),
    productType: azExportSafeText(x.productType || x.product || x.type || "PA", 40).toUpperCase(),
    itemCode: azExportSafeText(x.itemCode || x.noPa || x.noPA || x.noBM || x.stesen || x.stationNo || "", 140),
    negeri: azExportSafeText(x.negeri || x.state || "", 100),
    amount: azExportAmount(x.amount || x.price || 0),
    status: azExportSafeText(x.status || x.paymentStatus || "pending", 60).toLowerCase(),
    orderId: azExportSafeText(x.orderId || x.paymentOrderId || "", 180),
    billCode: azExportSafeText(x.billCode || x.billcode || "", 140),
    paymentReference: azExportSafeText(x.paymentReference || x.transactionId || "", 180),
    paymentMethod: azExportSafeText(x.paymentMethod || "toyyibpay", 80),
    downloadUrl: azExportSafeText(x.downloadUrl || x.url || x.fileUrl || "", 1000),
    downloadCount: Number(x.downloadCount || x.usedCount || x.downloadsUsed || 0) || 0,
    usedCount: Number(x.usedCount || x.downloadCount || x.downloadsUsed || 0) || 0,
    downloadsUsed: Number(x.downloadsUsed || x.downloadCount || x.usedCount || 0) || 0,
    maxDownloads: Number(x.maxDownloads || x.maxDownload || x.downloadLimit || 5) || 5,
    downloadExpiresAtMs,
    downloadExpiresAtClient: azExportSafeText(x.downloadExpiresAtClient || x.expiresAt || "", 120),
    createdAtMs,
    createdAtClient: azExportSafeText(x.createdAtClient || x.createdAt || "", 140),
    paidAtMs,
    paidAtClient: azExportSafeText(x.paidAtClient || x.verifiedAtClient || x.paidAt || "", 140),
    updatedAtMs,
    updatedAtClient: azExportSafeText(x.updatedAtClient || x.updatedAt || "", 140),
    source: azExportSafeText(x.__source || "purchaseLogs", 40)
  };
}
function azPaBmPurchaseRecordSortMs(x = {}) {
  return Number(x.createdAtMs || x.paidAtMs || x.updatedAtMs || 0) || 0;
}
async function azLoadAdminPaBmPurchaseRecords(maxRows = 1000) {
  const db = getAzobssBackendDb();
  const limitRows = Math.max(1, Math.min(5000, Number(maxRows || 1000) || 1000));
  if (!db) return { firestoreOk:false, source:"none", records:[], error:"Firebase Admin not configured" };
  const merged = [];
  const seen = new Set();
  function add(row, docId, source) {
    if (!row) return;
    const clean = azPaBmPurchaseRecordPublic(Object.assign({}, row, { __source: source || row.__source || "purchaseLogs" }), docId);
    const key = String(clean.firestoreId || clean.id || `${clean.usernameKey}|${clean.productType}|${clean.itemCode}|${clean.negeri}|${clean.createdAtMs}`).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(clean);
  }
  const loadPurchaseLogs = async () => {
    try { return await db.collection("purchaseLogs").orderBy("createdAtMs", "desc").limit(limitRows).get(); }
    catch (_) { return db.collection("purchaseLogs").limit(limitRows).get(); }
  };
  const [purchaseResult, usersResult] = await Promise.allSettled([
    loadPurchaseLogs(),
    db.collection("users").limit(2000).get()
  ]);
  const errors = [];
  const resetMap = {};
  if (purchaseResult.status === "fulfilled") {
    purchaseResult.value.forEach(doc => add(doc.data() || {}, doc.id, "purchaseLogs"));
  } else {
    const err = purchaseResult.reason;
    errors.push("purchaseLogs: " + (err && err.message ? err.message : String(err)));
  }
  // Compatibility: older PA/BM records may live inside users/{username}.purchaseRecords only.
  if (usersResult.status === "fulfilled") {
    const usersSnap = usersResult.value;
    usersSnap.forEach(userDoc => {
      const userData = userDoc.data() || {};
      const userKey = String(userData.usernameKey || userData.username || userDoc.id || "").trim().toLowerCase();
      const resetAtMs = Number(userData.purchaseTotalResetAtMs || 0) || (userData.purchaseTotalResetAtClient ? Date.parse(userData.purchaseTotalResetAtClient) : 0) || 0;
      if (userKey && resetAtMs) resetMap[userKey] = resetAtMs;
      const records = Array.isArray(userData.purchaseRecords) ? userData.purchaseRecords : [];
      records.forEach((r, idx) => {
        const docId = String(r && (r.firestoreId || r.purchaseLogId || r.id || r.recordId) || `${userDoc.id}-embedded-${idx}`);
        add(Object.assign({}, r || {}, {
          usernameKey: (r && (r.usernameKey || r.username)) || userData.usernameKey || userData.username || userDoc.id,
          username: (r && r.username) || userData.username || userData.usernameKey || userDoc.id,
          displayName: (r && r.displayName) || userData.displayName || userData.usernameKey || userDoc.id,
          uid: (r && r.uid) || userData.uid || "",
          email: (r && (r.email || r.buyerEmail)) || userData.email || userData.authEmail || "",
          phone: (r && (r.phone || r.phoneNumber)) || userData.phone || userData.phoneNumber || "",
          __source: "users.purchaseRecords"
        }), docId, "users.purchaseRecords");
      });
    });
  } else {
    const err = usersResult.reason;
    errors.push("users.purchaseRecords: " + (err && err.message ? err.message : String(err)));
  }
  merged.sort((a, b) => azPaBmPurchaseRecordSortMs(b) - azPaBmPurchaseRecordSortMs(a));
  return { firestoreOk: errors.length === 0 || merged.length > 0, source: merged.length ? "firestore-admin" : "empty", records: merged.slice(0, limitRows), resetMap, error: errors.join(" | ") };
}

const AZOBSS_ADMIN_EXPORT_TYPES = {
  premiumOrders: { label: "Premium Orders", firestore: "premiumOrders" },
  premiumDownloadTokens: { label: "Premium Download Tokens", firestore: "premiumDownloadTokens" },
  commissionRecords: { label: "Commission Records", firestore: "commissionRecords" },
  purchaseLogs: { label: "PA/BM Purchase Logs", firestore: "purchaseLogs" },
  softwareStats: { label: "Software Stats", firestore: "softwareStats" },
  adminAuditLogs: { label: "Admin Audit Logs", firestore: "adminAuditLogs" },
  payoutRequests: { label: "Payout Requests", firestore: "payoutRequests" },
  staffPayoutProfiles: { label: "Staff Payout Profiles", firestore: "staffPayoutProfiles" }
};
function azExportTypeKey(value = "") {
  const key = String(value || "").trim();
  if (key === "all") return "all";
  return AZOBSS_ADMIN_EXPORT_TYPES[key] ? key : "";
}
function azExportSafeText(value, max = 500) {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
function azExportAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function azExportSafePremiumOrder(x = {}, docId = "") {
  const user = x.user && typeof x.user === "object" ? x.user : {};
  return {
    docId: azExportSafeText(docId || x.docId || x.id || "", 160),
    orderId: azExportSafeText(x.orderId || "", 160),
    billCode: azExportSafeText(x.billCode || x.billcode || "", 120),
    status: azExportSafeText(x.status || "", 60),
    paymentMethod: azExportSafeText(x.paymentMethod || "", 80),
    paymentReference: azExportSafeText(x.paymentReference || "", 160),
    productId: azExportSafeText(x.productId || (x.product && x.product.productId) || "", 180),
    productName: azExportSafeText(x.productName || x.productTitle || (x.product && (x.product.productName || x.product.name || x.product.title)) || "", 220),
    category: azExportSafeText(x.category || x.productCategory || "", 80),
    amount: azExportSafeText(x.amount || x.amountText || "", 80),
    amountSen: Number(x.amountSen || 0) || 0,
    saleAmount: azExportAmount(x.saleAmount || (Number(x.amountSen || 0) ? Number(x.amountSen || 0) / 100 : 0)),
    username: azExportSafeText(user.username || x.username || x.usernameKey || "", 100),
    email: azExportSafeText(user.email || x.email || x.buyerEmail || "", 180),
    phone: azExportSafeText(user.phone || x.phone || "", 80),
    downloadTokenMasked: azMaskToken(x.downloadToken || ""),
    tokenExpiresAt: Number(x.tokenExpiresAt || 0) || 0,
    maxDownload: Number(x.maxDownload || x.downloadLimit || 0) || 0,
    usedCount: Number(x.usedCount || 0) || 0,
    receiptTokenRequired: x.receiptTokenRequired === true || String(x.receiptTokenRequired || "") === "1",
    emailSentAt: azExportSafeText(x.emailSentAt || "", 120),
    emailError: azExportSafeText(x.emailError || "", 260),
    commissionCheckedAt: azExportSafeText(x.commissionCheckedAt || "", 120),
    createdAt: azExportSafeText(x.createdAt || "", 120),
    createdAtMs: Number(x.createdAtMs || 0) || 0,
    paidAt: azExportSafeText(x.paidAt || "", 120),
    updatedAt: azExportSafeText(x.updatedAt || "", 120)
  };
}
function azExportSafePremiumToken(x = {}, docId = "") {
  return {
    docId: azExportSafeText(docId || x.docId || x.id || "", 160),
    tokenMasked: azMaskToken(x.token || x.downloadToken || ""),
    orderId: azExportSafeText(x.orderId || "", 160),
    billCode: azExportSafeText(x.billCode || "", 120),
    productName: azExportSafeText(x.productName || "", 220),
    downloadUrlHost: azSafeUrlInfo(x.downloadUrl || x.fileUrl || x.downloadLink || "").host,
    downloadUrlPath: azSafeUrlInfo(x.downloadUrl || x.fileUrl || x.downloadLink || "").pathname,
    usedCount: Number(x.usedCount || 0) || 0,
    maxDownload: Number(x.maxDownload || x.downloadLimit || 0) || 0,
    expiresAt: Number(x.expiresAt || 0) || 0,
    createdAt: azExportSafeText(x.createdAt || "", 120),
    createdAtMs: Number(x.createdAtMs || 0) || 0
  };
}
function azExportSafePurchaseLog(x = {}, docId = "") {
  return {
    docId: azExportSafeText(docId || x.docId || x.id || "", 160),
    username: azExportSafeText(x.username || x.usernameKey || "", 100),
    uid: azExportSafeText(x.uid || "", 160),
    email: azExportSafeText(x.email || x.buyerEmail || "", 180),
    productType: azExportSafeText(x.productType || x.type || "", 60),
    itemCode: azExportSafeText(x.itemCode || x.noPa || x.noBm || "", 120),
    negeri: azExportSafeText(x.negeri || "", 80),
    amount: azExportAmount(x.amount || x.price || 0),
    status: azExportSafeText(x.status || "", 60),
    orderId: azExportSafeText(x.orderId || "", 160),
    billCode: azExportSafeText(x.billCode || "", 120),
    paymentReference: azExportSafeText(x.paymentReference || "", 160),
    createdAt: azExportSafeText(x.createdAt || "", 120),
    createdAtMs: Number(x.createdAtMs || 0) || 0,
    updatedAt: azExportSafeText(x.updatedAt || "", 120),
    paidAt: azExportSafeText(x.paidAt || "", 120)
  };
}
function azExportSafeSoftwareStats(stats = {}) {
  const rows = [];
  Object.entries(stats || {}).forEach(([productId, value]) => {
    const x = normalizeSoftwareStats(value || {});
    rows.push({ productId: cleanSoftwareId(productId), downloads: x.downloads, likes: x.likes, ratingAverage: x.ratingAverage, ratingVotes: x.ratingVotes, ratingTotal: x.ratingTotal, updatedAt: azExportSafeText(value && value.updatedAt || "", 120) });
  });
  rows.sort((a,b)=>String(a.productId).localeCompare(String(b.productId)));
  return rows;
}
function azExportSafeRow(type, row = {}, docId = "") {
  if (type === "premiumOrders") return azExportSafePremiumOrder(row, docId);
  if (type === "premiumDownloadTokens") return azExportSafePremiumToken(row, docId);
  if (type === "commissionRecords") return azCommissionSafeRecord(row, docId);
  if (type === "purchaseLogs") return azExportSafePurchaseLog(row, docId);
  if (type === "adminAuditLogs") return azAuditLogPublicRow(row, docId);
  if (type === "payoutRequests") return azPayoutRequestSafe(row, docId, false);
  if (type === "staffPayoutProfiles") return azPayoutProfilePublic(row, false);
  return azJsonSafe(row);
}
async function azExportFirestoreRows(collectionName, maxRows = 500) {
  const db = getAzobssBackendDb();
  if (!db) return { firestoreOk:false, rows:[], error:"Firebase Admin not configured" };
  try {
    let snap;
    try { snap = await db.collection(collectionName).orderBy("createdAtMs", "desc").limit(maxRows).get(); }
    catch (_) { snap = await db.collection(collectionName).limit(maxRows).get(); }
    const rows = [];
    snap.forEach(doc => rows.push({ docId: doc.id, ...(doc.data() || {}) }));
    return { firestoreOk:true, rows, error:"" };
  } catch (err) {
    return { firestoreOk:false, rows:[], error: err && err.message ? err.message : String(err) };
  }
}
async function azLoadAdminExportRows(type, maxRows = 500) {
  const limitRows = Math.max(1, Math.min(5000, Number(maxRows || 500) || 500));
  if (type === "softwareStats") {
    const fsRows = await azExportFirestoreRows("softwareStats", limitRows);
    if (fsRows.rows.length) return { rows: fsRows.rows.map(x => azJsonSafe(x)).slice(0, limitRows), firestoreOk: fsRows.firestoreOk, source:"firestore", error: fsRows.error || "" };
    return { rows: azExportSafeSoftwareStats(readSoftwareStats()).slice(0, limitRows), firestoreOk:false, source:"local-json", error: fsRows.error || "" };
  }
  if (type === "premiumOrders") return azLoadPremiumOrdersMerged(limitRows);
  const cfg = AZOBSS_ADMIN_EXPORT_TYPES[type];
  if (!cfg) return { rows:[], firestoreOk:false, source:"none", error:"Unsupported export type" };
  const fsRows = await azExportFirestoreRows(cfg.firestore, limitRows);
  if (fsRows.rows.length) return { rows: fsRows.rows.slice(0, limitRows).map(x => azExportSafeRow(type, x, x.docId)), firestoreOk: fsRows.firestoreOk, source:"firestore", error: fsRows.error || "" };
  let local = [];
  if (type === "premiumOrders") local = readPremiumOrders();
  else if (type === "premiumDownloadTokens") local = readPremiumJson(PREMIUM_TOKENS_FILE, []);
  else if (type === "commissionRecords") local = readPremiumJson(COMMISSION_RECORDS_FILE, []);
  else if (type === "adminAuditLogs") local = azReadLocalAuditLogs();
  const rows = Array.isArray(local) ? local.slice(0, limitRows).map((x,i)=>azExportSafeRow(type, x, x.docId || x.id || `local_${i}`)) : [];
  return { rows, firestoreOk:false, source: rows.length ? "local-json" : "empty", error: fsRows.error || "" };
}
function azFlattenForCsv(obj = {}, prefix = "", out = {}) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) azFlattenForCsv(value, name, out);
    else out[name] = Array.isArray(value) ? JSON.stringify(value) : value;
  });
  return out;
}
function azRowsToCsv(rows = []) {
  const flat = rows.map(r => azFlattenForCsv(r));
  const headers = Array.from(new Set(flat.flatMap(r => Object.keys(r))));
  const escCsv = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return [headers.join(",")].concat(flat.map(r => headers.map(h => escCsv(r[h])).join(","))).join("\n");
}
function azExportFileName(type, format) {
  const d = new Date().toISOString().slice(0,10);
  return `azobss-${type}-export-${d}.${format === "csv" ? "csv" : "json"}`;
}


function azPremiumOrderMergeKey(row = {}, docId = "") {
  return String(row.orderId || row.billCode || row.billcode || docId || row.id || "").trim().toLowerCase();
}
function azPremiumOrderSortMs(row = {}) {
  return Number(row.paidAtMs || row.updatedAtMs || row.createdAtMs || Date.parse(row.paidAt || row.updatedAt || row.createdAt || "") || 0) || 0;
}

// AZOBSS PATCH 420: Admin Payment Logs bulk delete helpers.
function azAdminDeleteLogSafeText(v = "", max = 180) {
  return cleanPremiumText(v || "", max);
}
function azAdminDeleteLogRefs(input = {}) {
  const r = input && typeof input === "object" ? input : {};
  const refs = {
    source: azAdminDeleteLogSafeText(r.source || r._azSource || r.collection || "", 80),
    collection: azAdminDeleteLogSafeText(r.collection || "", 80),
    docId: azAdminDeleteLogSafeText(r.docId || r.id || r.firestoreId || "", 180),
    orderId: azAdminDeleteLogSafeText(r.orderId || "", 180),
    billCode: azAdminDeleteLogSafeText(r.billCode || r.billcode || "", 160),
    paymentReference: azAdminDeleteLogSafeText(r.paymentReference || r.transactionId || r.txnId || "", 180),
    productId: azAdminDeleteLogSafeText(r.productId || r.softwareId || r.cadId || "", 180),
    status: azAdminDeleteLogSafeText(r.status || r.paymentStatus || "", 80)
  };
  const src = refs.source.toLowerCase();
  if (!refs.collection) refs.collection = src === "premiumorders" ? "premiumOrders" : "purchaseLogs";
  if (refs.collection !== "premiumOrders" && refs.collection !== "purchaseLogs") refs.collection = "purchaseLogs";
  return refs;
}
async function azAdminDeleteFirestoreRecordByRefs(db, collectionName, refs = {}) {
  const deleted = [];
  const seen = new Set();
  async function delDoc(id, why) {
    const safeId = azAdminDeleteLogSafeText(id || "", 180);
    if (!safeId || seen.has(safeId)) return;
    seen.add(safeId);
    try {
      const ref = db.collection(collectionName).doc(safeId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
        deleted.push({ collection:collectionName, docId:safeId, via:why || "docId" });
      }
    } catch (err) {
      throw new Error(collectionName + "/" + safeId + ": " + (err && err.message ? err.message : String(err)));
    }
  }
  await delDoc(refs.docId, "docId");
  const fields = [
    ["orderId", refs.orderId],
    ["billCode", refs.billCode],
    ["billcode", refs.billCode],
    ["paymentReference", refs.paymentReference],
    ["transactionId", refs.paymentReference],
    ["txnId", refs.paymentReference]
  ].filter(pair => pair[1]);
  for (const [field, value] of fields) {
    try {
      const qs = await db.collection(collectionName).where(field, "==", value).limit(20).get();
      for (const docSnap of qs.docs) {
        if (!seen.has(docSnap.id)) {
          await docSnap.ref.delete();
          seen.add(docSnap.id);
          deleted.push({ collection:collectionName, docId:docSnap.id, via:field });
        }
      }
    } catch (err) {
      console.warn("Admin payment log delete query skipped:", collectionName, field, err && (err.message || err));
    }
  }
  return deleted;
}
function azAdminDeleteLocalPremiumOrderByRefs(refs = {}) {
  let deleted = 0;
  try {
    const orders = readPremiumOrders() || [];
    const match = (o = {}) => {
      const vals = [
        o.docId, o.id, o.orderId, o.billCode, o.billcode, o.paymentReference, o.transactionId, o.txnId
      ].map(v => String(v || "").trim()).filter(Boolean);
      const needles = [refs.docId, refs.orderId, refs.billCode, refs.paymentReference].map(v => String(v || "").trim()).filter(Boolean);
      return needles.length && needles.some(n => vals.includes(n));
    };
    const next = orders.filter(o => {
      const m = match(o);
      if (m) deleted++;
      return !m;
    });
    if (deleted) writePremiumOrders(next);
  } catch (err) {
    throw new Error("local premium-orders.json: " + (err && err.message ? err.message : String(err)));
  }
  return deleted;
}
async function azAdminDeletePaymentLogRecords(req, parsed, body = {}) {
  const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
  if (!adminIdentity || !adminIdentity.isAdmin) {
    return { ok:false, statusCode:403, error:"Admin authorization required to delete payment logs." };
  }
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, statusCode:500, error:"Firebase Admin is not configured." };
  const rows = Array.isArray(body.records) ? body.records.slice(0, 200) : [];
  if (!rows.length) return { ok:false, statusCode:400, error:"No records selected." };
  const result = { ok:true, deleted:0, requested:rows.length, details:[], errors:[] };
  for (const row of rows) {
    const refs = azAdminDeleteLogRefs(row);
    try {
      let deletedDetails = [];
      if (refs.collection === "premiumOrders") {
        deletedDetails = deletedDetails.concat(await azAdminDeleteFirestoreRecordByRefs(db, "premiumOrders", refs));
        const localDeleted = azAdminDeleteLocalPremiumOrderByRefs(refs);
        if (localDeleted) deletedDetails.push({ collection:"premium-orders.json", count:localDeleted, via:"local-json" });
      } else {
        deletedDetails = deletedDetails.concat(await azAdminDeleteFirestoreRecordByRefs(db, "purchaseLogs", refs));
      }
      if (!deletedDetails.length) {
        result.errors.push({ refs, error:"Record not found or already deleted." });
      } else {
        result.deleted += deletedDetails.reduce((sum, d) => sum + (Number(d.count || 0) || 1), 0);
        result.details.push({ refs, deleted:deletedDetails });
      }
    } catch (err) {
      result.errors.push({ refs, error:err && err.message ? err.message : String(err) });
    }
  }
  azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_payment_logs_bulk_delete", "paymentLogs", "bulk", { requested:result.requested, deleted:result.deleted, errors:result.errors.length }, result.errors.length ? "partial" : "success"), "Admin payment log bulk delete audit failed");
  return result;
}

async function azLoadPremiumOrdersMerged(maxRows = 500) {
  const limitRows = Math.max(1, Math.min(5000, Number(maxRows || 500) || 500));
  const merged = [];
  const seen = new Set();
  let firestoreOk = false;
  let error = "";
  const sources = new Set();
  const add = (row, docId, source) => {
    if (!row) return;
    const key = azPremiumOrderMergeKey(row, docId);
    if (!key || seen.has(key)) return;
    seen.add(key);
    sources.add(source || "unknown");
    merged.push({ ...(row || {}), docId: docId || row.docId || row.id || "", _backupSource: source || "unknown" });
  };
  try {
    const fsRows = await azExportFirestoreRows("premiumOrders", limitRows);
    firestoreOk = !!fsRows.firestoreOk;
    error = fsRows.error || "";
    (Array.isArray(fsRows.rows) ? fsRows.rows : []).forEach(row => add(row, row.docId || row.id || row.orderId || row.billCode || "", "firestore"));
  } catch (err) {
    error = err && err.message ? err.message : String(err);
  }
  try {
    (readPremiumOrders() || []).slice(0, limitRows).forEach((row, idx) => add(row, row.docId || row.id || row.orderId || row.billCode || `local_${idx}`, "local-json"));
  } catch (err) {
    error = [error, "local-json: " + (err && err.message ? err.message : String(err))].filter(Boolean).join(" | ");
  }
  merged.sort((a, b) => azPremiumOrderSortMs(b) - azPremiumOrderSortMs(a));
  const source = sources.size ? Array.from(sources).join("+") : "empty";
  return { rows: merged.slice(0, limitRows).map((x, i) => azExportSafePremiumOrder(x, x.docId || x.orderId || x.billCode || `merged_${i}`)), firestoreOk, source, error };
}


const AZOBSS_SYSTEM_HEALTH_COLLECTIONS = [
  "users",
  "premiumOrders",
  "premiumDownloadTokens",
  "commissionRecords",
  "purchaseLogs",
  "softwareStats",
  "adminAuditLogs",
  "notifications",
  "adminNotifications",
  "supportMessages"
];
const AZOBSS_SYSTEM_HEALTH_FILES = [
  "premium-orders.json",
  "premium-download-tokens.json",
  "commission-records.json",
  "software-stats.json",
  "admin-audit-logs.json",
  "stesen-tanda-aras-records.json"
];
function azHealthEnvFlag(name, recommended = false, note = "") {
  const raw = process.env[name];
  const present = raw !== undefined && String(raw).trim() !== "";
  return {
    name,
    present,
    recommended: !!recommended,
    value: present && !/SECRET|KEY|TOKEN|PASSWORD|SERVICE_ACCOUNT/i.test(name) ? String(raw).slice(0, 180) : (present ? "configured" : ""),
    note: azAuditSafeText(note || "", 220)
  };
}
function azHealthFileRow(filename) {
  const safeName = path.basename(String(filename || ""));
  const fp = path.join(__dirname, safeName);
  try {
    const st = fs.existsSync(fp) ? fs.statSync(fp) : null;
    return { file: safeName, exists: !!st, sizeBytes: st ? st.size : 0, modifiedAt: st ? st.mtime.toISOString() : "" };
  } catch (err) {
    return { file: safeName, exists: false, sizeBytes: 0, modifiedAt: "", error: err && err.message ? err.message : String(err) };
  }
}
async function azHealthFirestoreCollectionRow(db, name) {
  const row = { name, ok: false, sampleCount: 0, latestCreatedAt: "", latestCreatedAtMs: 0, error: "" };
  if (!db) { row.error = "Firebase Admin not configured"; return row; }
  try {
    let snap;
    try { snap = await db.collection(name).orderBy("createdAtMs", "desc").limit(1).get(); }
    catch (_) { snap = await db.collection(name).limit(1).get(); }
    row.ok = true;
    row.sampleCount = snap.size;
    snap.forEach(docSnap => {
      const x = docSnap.data() || {};
      row.latestCreatedAt = azAuditSafeText(x.createdAt || x.updatedAt || x.paidAt || "", 90);
      row.latestCreatedAtMs = Number(x.createdAtMs || x.updatedAtMs || x.paidAtMs || 0) || 0;
    });
  } catch (err) {
    row.error = err && err.message ? err.message : String(err);
  }
  return row;
}
async function azBuildAdminSystemHealth(req, identity = {}) {
  const started = Date.now();
  const db = getAzobssBackendDb();
  const env = [
    azHealthEnvFlag("FIREBASE_SERVICE_ACCOUNT_JSON", true, "Required for backend Firestore read/write."),
    azHealthEnvFlag("TOYYIBPAY_SECRET_KEY", true, "Required for ToyyibPay bill/payment verification."),
    azHealthEnvFlag("TOYYIBPAY_CATEGORY_CODE", true, "Required for ToyyibPay bill creation."),
    azHealthEnvFlag("BREVO_API_KEY", true, "Required for premium download/receipt email sending."),
    azHealthEnvFlag("AZOBSS_FROM_EMAIL", true, "Recommended sender email for customer emails."),
    azHealthEnvFlag("AZOBSS_CORS_ORIGIN", false, "Recommended production value: https://www.azobss.com"),
    azHealthEnvFlag("ADMIN_KEY", false, "Optional fallback admin backend secret. Admin Dashboard normally uses Firebase admin token."),
    azHealthEnvFlag("AZOBSS_ADMIN_API_SECRET", false, "Optional backup admin API secret; ADMIN_KEY is accepted as fallback."),
    azHealthEnvFlag("AZOBSS_COMMISSION_API_SECRET", false, "Optional backup commission/admin API secret."),
    azHealthEnvFlag("AZOBSS_REQUIRE_RECEIPT_TOKEN", false, "Optional strict receipt token mode."),
    azHealthEnvFlag("AZOBSS_VERIFY_TOYYIB_CALLBACK", false, "Default ON. Set 0 only for emergency ToyyibPay verification bypass."),
    azHealthEnvFlag("AZOBSS_DISABLE_RATE_LIMIT", false, "Emergency only. Keep unset for production."),
    azHealthEnvFlag("AZOBSS_DISABLE_RUNTIME_NPM", false, "Recommended ON after Render build dependencies are stable.")
  ];
  const collections = [];
  if (db) {
    for (const col of AZOBSS_SYSTEM_HEALTH_COLLECTIONS) {
      collections.push(await azHealthFirestoreCollectionRow(db, col));
    }
  } else {
    for (const col of AZOBSS_SYSTEM_HEALTH_COLLECTIONS) collections.push({ name: col, ok:false, sampleCount:0, error: firebaseAdminInitError || "Firebase Admin not configured" });
  }
  const missingRequired = env.filter(x => x.recommended && !x.present).map(x => x.name);
  const collectionErrors = collections.filter(x => !x.ok && x.error).map(x => x.name);
  const processInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.round(process.uptime()),
    memoryMB: Math.round((process.memoryUsage().rss || 0) / 1024 / 1024),
    pid: process.pid,
    disableRuntimeNpm: String(process.env.AZOBSS_DISABLE_RUNTIME_NPM || "") === "1",
    rateLimitDisabled: String(process.env.AZOBSS_DISABLE_RATE_LIMIT || "") === "1",
    toyyibCallbackVerifyEnabled: azVerifyToyyibCallbackEnabled(),
    receiptStrictAllOrders: String(process.env.AZOBSS_REQUIRE_RECEIPT_TOKEN || "") === "1",
    corsOrigin: azCorsOrigin()
  };
  let status = "ok";
  if (missingRequired.length || !db) status = "critical";
  else if (collectionErrors.length) status = "warning";
  return {
    ok: status !== "critical",
    status,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    admin: azAuditIdentitySafe(identity || {}),
    firebase: {
      configured: !!db,
      initError: db ? "" : azAuditSafeText(firebaseAdminInitError || "Firebase Admin not configured", 260),
      collectionErrors
    },
    env,
    missingRequired,
    process: processInfo,
    files: AZOBSS_SYSTEM_HEALTH_FILES.map(azHealthFileRow),
    collections
  };
}




function azMaintenanceStatusPaid(x = {}) {
  const s = String(x.status || x.paymentStatus || x.billpaymentStatus || x.toyyibStatus || "").toLowerCase();
  return ["paid", "success", "completed", "settled", "verified", "1"].includes(s) || String(x.paid || "").toLowerCase() === "true";
}
function azMaintenanceHasDownloadTarget(x = {}) {
  return !!cleanPremiumUrl(x.downloadLink || x.premiumDownloadFileLink || x.secureDownloadLink || x.privateDownloadLink || x.downloadUrl || "");
}
function azMaintenanceTokenExpired(x = {}, now = Date.now()) {
  const expires = Number(x.expiresAtMs || x.expiresAt || x.expireAtMs || x.expiredAtMs || 0) || 0;
  if (!expires) return false;
  if (String(x.status || "").toLowerCase() === "expired") return false;
  return expires <= now;
}
function azMaintenancePublicIssue(type, severity, label, count, note = "") {
  return { type, severity, label, count:Number(count||0), note:azAuditSafeText(note, 260) };
}
function azMaintenanceRetentionDays(envName, fallbackDays) {
  const raw = Number(process.env[envName] || fallbackDays);
  if (!Number.isFinite(raw) || raw <= 0) return Number(fallbackDays || 0) || 0;
  return Math.max(1, Math.min(3650, Math.floor(raw)));
}
function azMaintenanceTimeMs(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value || 0);
  if (Number.isFinite(n) && n > 0) return n;
  const t = Date.parse(String(value || ""));
  return Number.isFinite(t) && t > 0 ? t : 0;
}
function azMaintenanceRowAgeMs(x = {}) {
  return azMaintenanceTimeMs(x.createdAtMs || x.createdAt || x.updatedAtMs || x.updatedAt || x.paidAtMs || x.paidAt || 0);
}
function azMaintenanceExpiredTokenPrunable(x = {}, now = Date.now()) {
  const days = azMaintenanceRetentionDays("AZOBSS_DOWNLOAD_TOKEN_RETENTION_DAYS", 90);
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  const expiryMs = azMaintenanceTimeMs(x.expiredAtMs || x.expiredAt || x.expiresAtMs || x.expiresAt || x.expireAtMs || 0);
  const expired = String(x.status || "").toLowerCase() === "expired" || (!!expiryMs && expiryMs <= now);
  return expired && !!expiryMs && expiryMs <= cutoff;
}
function azMaintenanceOldAuditLogPrunable(x = {}, now = Date.now()) {
  const days = azMaintenanceRetentionDays("AZOBSS_AUDIT_LOG_RETENTION_DAYS", 365);
  const t = azMaintenanceRowAgeMs(x);
  return !!t && t <= now - (days * 24 * 60 * 60 * 1000);
}
function azMaintenanceOldNotificationPrunable(x = {}, now = Date.now()) {
  const days = azMaintenanceRetentionDays("AZOBSS_NOTIFICATION_RETENTION_DAYS", 180);
  const t = azMaintenanceRowAgeMs(x);
  return !!t && t <= now - (days * 24 * 60 * 60 * 1000);
}
function azMaintenanceDestructiveAction(action = "") {
  const a = String(action || "").trim().toLowerCase();
  return a === "prune-expired-download-tokens" || a === "prune-old-audit-logs" || a === "prune-old-notifications";
}
function azMaintenanceConfirmPhrase() {
  return "CONFIRM CLEANUP";
}
function azMaintenanceDestructiveConfirmOk(body = {}) {
  if (String(process.env.AZOBSS_MAINTENANCE_SKIP_CONFIRM || "") === "1") return true;
  const phrase = azMaintenanceConfirmPhrase();
  return String(body.confirmText || body.confirmPhrase || "").trim() === phrase;
}
async function azAdminMaintenanceScan(req, identity = {}, options = {}) {
  const started = Date.now();
  const db = getAzobssBackendDb();
  const limitRows = Math.max(50, Math.min(1000, Number(options.limit || 500) || 500));
  const now = Date.now();
  const result = {
    ok:true,
    generatedAt:new Date(now).toISOString(),
    firestoreConfigured:!!db,
    scanned:{ premiumOrders:0, localPremiumOrders:0, premiumDownloadTokens:0, commissionRecords:0, adminAuditLogs:0, notifications:0 },
    retention:{
      downloadTokenDays:azMaintenanceRetentionDays("AZOBSS_DOWNLOAD_TOKEN_RETENTION_DAYS", 90),
      auditLogDays:azMaintenanceRetentionDays("AZOBSS_AUDIT_LOG_RETENTION_DAYS", 365),
      notificationDays:azMaintenanceRetentionDays("AZOBSS_NOTIFICATION_RETENTION_DAYS", 180)
    },
    issues:[],
    actions:[
      { action:"repair-paid-order-tokens", label:"Repair paid orders missing download token", safe:true },
      { action:"repair-receipt-flags", label:"Add receipt-token requirement to paid premium orders", safe:true },
      { action:"expire-old-download-tokens", label:"Mark expired download tokens as expired", safe:true },
      { action:"repair-commission-payout-status", label:"Set missing commission payout status to pending", safe:true },
      { action:"sync-local-premium-orders-firestore", label:"Backup local premiumOrders to Firestore", safe:true },
      { action:"hydrate-local-premium-orders-firestore", label:"Restore local premium-orders.json from Firestore", safe:true },
      { action:"prune-expired-download-tokens", label:"Delete expired download tokens older than retention", safe:true, destructive:true, confirmPhrase:azMaintenanceConfirmPhrase() },
      { action:"prune-old-audit-logs", label:"Delete audit logs older than retention", safe:true, destructive:true, confirmPhrase:azMaintenanceConfirmPhrase() },
      { action:"prune-old-notifications", label:"Delete notifications older than retention", safe:true, destructive:true, confirmPhrase:azMaintenanceConfirmPhrase() }
    ],
    samples:{ paidOrdersMissingToken:[], paidOrdersMissingReceiptFlag:[], localPremiumOrdersMissingFirestore:[], firestorePremiumOrdersMissingLocal:[], expiredDownloadTokens:[], commissionMissingPayoutStatus:[], prunableExpiredDownloadTokens:[], oldAuditLogs:[], oldNotifications:[] },
    warnings:[],
    latencyMs:0
  };
  const localPremiumOrders = (readPremiumOrders() || []).slice(0, limitRows);
  result.scanned.localPremiumOrders = localPremiumOrders.length;
  const localPremiumOrderKeys = new Set(localPremiumOrders.map(x => azPremiumOrderMergeKey(x, x && (x.docId || x.id))).filter(Boolean));
  const firestorePremiumOrderKeys = new Set();
  if (!db) {
    result.ok = false;
    result.warnings.push("Firebase Admin is not configured. Maintenance scan can only run when FIREBASE_SERVICE_ACCOUNT_JSON is configured.");
    result.latencyMs = Date.now() - started;
    return result;
  }
  try {
    const ordersSnap = await db.collection("premiumOrders").limit(limitRows).get();
    ordersSnap.forEach(docSnap => {
      const x = { id:docSnap.id, ...(docSnap.data() || {}) };
      result.scanned.premiumOrders += 1;
      const fsKey = azPremiumOrderMergeKey(x, docSnap.id);
      if (fsKey) {
        firestorePremiumOrderKeys.add(fsKey);
        if (!localPremiumOrderKeys.has(fsKey)) {
          result.samples.firestorePremiumOrdersMissingLocal.push({ id:docSnap.id, orderId:cleanPremiumText(x.orderId || docSnap.id, 160), productName:cleanPremiumText(x.productName || "", 120), status:cleanPremiumText(x.status || "", 60) });
        }
      }
      const paid = azMaintenanceStatusPaid(x);
      if (paid && !x.downloadToken && azMaintenanceHasDownloadTarget(x)) {
        result.samples.paidOrdersMissingToken.push({ id:docSnap.id, orderId:cleanPremiumText(x.orderId || docSnap.id, 160), productName:cleanPremiumText(x.productName || "", 120), email:azMaskEmail(x.buyerEmail || x.email || (x.user && x.user.email) || "") });
      }
      if (paid && x.receiptTokenRequired !== true && String(x.receiptTokenRequired || "") !== "1") {
        result.samples.paidOrdersMissingReceiptFlag.push({ id:docSnap.id, orderId:cleanPremiumText(x.orderId || docSnap.id, 160), productName:cleanPremiumText(x.productName || "", 120) });
      }
    });
  } catch (err) {
    result.warnings.push("premiumOrders scan failed: " + (err && err.message ? err.message : String(err)));
  }
  try {
    localPremiumOrders.forEach((x) => {
      const key = azPremiumOrderMergeKey(x, x && (x.docId || x.id));
      if (key && !firestorePremiumOrderKeys.has(key)) {
        result.samples.localPremiumOrdersMissingFirestore.push({ orderId:cleanPremiumText(x.orderId || "", 160), billCode:cleanPremiumText(x.billCode || "", 120), productName:cleanPremiumText(x.productName || "", 120), status:cleanPremiumText(x.status || "", 60) });
      }
    });
  } catch (err) {
    result.warnings.push("local premiumOrders compare failed: " + (err && err.message ? err.message : String(err)));
  }

  try {
    const tokensSnap = await db.collection("premiumDownloadTokens").limit(limitRows).get();
    tokensSnap.forEach(docSnap => {
      const x = { id:docSnap.id, ...(docSnap.data() || {}) };
      result.scanned.premiumDownloadTokens += 1;
      if (azMaintenanceTokenExpired(x, now)) {
        result.samples.expiredDownloadTokens.push({ id:docSnap.id, token:azMaskToken(x.token || docSnap.id), orderId:cleanPremiumText(x.orderId || "", 160), expiresAt:cleanPremiumText(x.expiresAt || x.expiresAtMs || "", 80) });
      }
      if (azMaintenanceExpiredTokenPrunable(x, now)) {
        result.samples.prunableExpiredDownloadTokens.push({ id:docSnap.id, token:azMaskToken(x.token || docSnap.id), orderId:cleanPremiumText(x.orderId || "", 160), expiresAt:cleanPremiumText(x.expiresAt || x.expiresAtMs || x.expiredAt || "", 80) });
      }
    });
  } catch (err) {
    result.warnings.push("premiumDownloadTokens scan failed: " + (err && err.message ? err.message : String(err)));
  }
  try {
    const comSnap = await db.collection("commissionRecords").limit(limitRows).get();
    comSnap.forEach(docSnap => {
      const x = { id:docSnap.id, ...(docSnap.data() || {}) };
      result.scanned.commissionRecords += 1;
      if (!azCommissionPayoutStatus(x.payoutStatus || x.status)) {
        result.samples.commissionMissingPayoutStatus.push({ id:docSnap.id, orderId:cleanPremiumText(x.orderId || "", 160), productName:cleanPremiumText(x.productName || "", 120), amountText:cleanPremiumText(x.amountText || x.commissionAmountText || "", 40) });
      }
    });
  } catch (err) {
    result.warnings.push("commissionRecords scan failed: " + (err && err.message ? err.message : String(err)));
  }
  try {
    const auditSnap = await db.collection("adminAuditLogs").limit(limitRows).get();
    auditSnap.forEach(docSnap => {
      const x = { id:docSnap.id, ...(docSnap.data() || {}) };
      result.scanned.adminAuditLogs += 1;
      if (azMaintenanceOldAuditLogPrunable(x, now)) {
        result.samples.oldAuditLogs.push({ id:docSnap.id, action:cleanPremiumText(x.action || "", 100), createdAt:cleanPremiumText(x.createdAt || x.createdAtMs || "", 80) });
      }
    });
  } catch (err) {
    result.warnings.push("adminAuditLogs scan failed: " + (err && err.message ? err.message : String(err)));
  }
  try {
    const notifSnap = await db.collection("notifications").limit(limitRows).get();
    notifSnap.forEach(docSnap => {
      const x = { id:docSnap.id, ...(docSnap.data() || {}) };
      result.scanned.notifications += 1;
      if (azMaintenanceOldNotificationPrunable(x, now)) {
        result.samples.oldNotifications.push({ id:docSnap.id, title:cleanPremiumText(x.title || "Notification", 120), createdAt:cleanPremiumText(x.createdAt || x.createdAtMs || "", 80) });
      }
    });
  } catch (err) {
    result.warnings.push("notifications scan failed: " + (err && err.message ? err.message : String(err)));
  }
  result.issues = [
    azMaintenancePublicIssue("paidOrdersMissingToken", "high", "Paid orders missing download token", result.samples.paidOrdersMissingToken.length, "Can stop customer download/email recovery."),
    azMaintenancePublicIssue("paidOrdersMissingReceiptFlag", "medium", "Paid orders missing receipt token requirement", result.samples.paidOrdersMissingReceiptFlag.length, "Hardens old/new premium receipt privacy."),
    azMaintenancePublicIssue("expiredDownloadTokens", "low", "Expired download tokens not marked expired", result.samples.expiredDownloadTokens.length, "Keeps token collection cleaner."),
    azMaintenancePublicIssue("commissionMissingPayoutStatus", "medium", "Commission records missing payout status", result.samples.commissionMissingPayoutStatus.length, "Keeps payout workflow consistent."),
    azMaintenancePublicIssue("localPremiumOrdersMissingFirestore", "high", "Local premiumOrders not backed up to Firestore", result.samples.localPremiumOrdersMissingFirestore.length, "Run sync-local-premium-orders-firestore to protect Software/CAD payment records from Render restart/deploy loss."),
    azMaintenancePublicIssue("firestorePremiumOrdersMissingLocal", "low", "Firestore premiumOrders not cached locally", result.samples.firestorePremiumOrdersMissingLocal.length, "Run hydrate-local-premium-orders-firestore when local JSON needs restore after restart."),
    azMaintenancePublicIssue("prunableExpiredDownloadTokens", "low", "Expired download tokens older than retention", result.samples.prunableExpiredDownloadTokens.length, `Retention: ${result.retention.downloadTokenDays} days.`),
    azMaintenancePublicIssue("oldAuditLogs", "low", "Old admin audit logs older than retention", result.samples.oldAuditLogs.length, `Retention: ${result.retention.auditLogDays} days.`),
    azMaintenancePublicIssue("oldNotifications", "low", "Old notifications older than retention", result.samples.oldNotifications.length, `Retention: ${result.retention.notificationDays} days.`)
  ];
  result.latencyMs = Date.now() - started;
  return result;
}
async function azAdminMaintenanceRun(req, identity = {}, action = "", options = {}) {
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, error:"Firebase Admin is not configured." };
  const started = Date.now();
  const now = Date.now();
  const limitRows = Math.max(10, Math.min(500, Number(options.limit || 200) || 200));
  const out = { ok:true, action:cleanPremiumText(action, 80), destructive:azMaintenanceDestructiveAction(action), processed:0, changed:0, skipped:0, errors:[], samples:[], generatedAt:new Date(now).toISOString(), latencyMs:0 };
  const addSample = (x) => { if (out.samples.length < 20) out.samples.push(x); };
  try {
    if (action === "sync-local-premium-orders-firestore") {
      const sync = await azSyncLocalPremiumOrdersToFirestore({ limit: limitRows });
      out.processed = sync.processed || 0;
      out.changed = sync.changed || 0;
      out.skipped = sync.skipped || 0;
      out.errors = sync.errors || (sync.error ? [sync.error] : []);
      out.samples = sync.samples || [];
      out.ok = sync.ok !== false;
    } else if (action === "hydrate-local-premium-orders-firestore") {
      const sync = await azHydrateLocalPremiumOrdersFromFirestore({ limit: limitRows });
      out.processed = sync.processed || 0;
      out.changed = sync.changed || 0;
      out.skipped = sync.skipped || 0;
      out.errors = sync.errors || (sync.error ? [sync.error] : []);
      out.samples = sync.samples || [];
      out.ok = sync.ok !== false;
    } else if (action === "repair-receipt-flags") {
      const snap = await db.collection("premiumOrders").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceStatusPaid(x) || x.receiptTokenRequired === true || String(x.receiptTokenRequired || "") === "1") { out.skipped += 1; continue; }
        await docSnap.ref.set({ receiptTokenRequired:true, receiptTokenVersion:2, maintenanceUpdatedAt:new Date().toISOString(), maintenanceUpdatedAtMs:Date.now() }, { merge:true });
        out.changed += 1; addSample({ orderId:cleanPremiumText(x.orderId || docSnap.id, 160), change:"receiptTokenRequired=true" });
      }
    } else if (action === "expire-old-download-tokens") {
      const snap = await db.collection("premiumDownloadTokens").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceTokenExpired(x, now)) { out.skipped += 1; continue; }
        await docSnap.ref.set({ status:"expired", expiredAt:new Date(now).toISOString(), expiredAtMs:now, maintenanceUpdatedAt:new Date().toISOString(), maintenanceUpdatedAtMs:Date.now() }, { merge:true });
        out.changed += 1; addSample({ token:azMaskToken(x.token || docSnap.id), orderId:cleanPremiumText(x.orderId || "", 160), change:"status=expired" });
      }
    } else if (action === "repair-commission-payout-status") {
      const snap = await db.collection("commissionRecords").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (azCommissionPayoutStatus(x.payoutStatus || x.status)) { out.skipped += 1; continue; }
        await docSnap.ref.set({ payoutStatus:"pending", status:"pending", payoutUpdatedAt:new Date().toISOString(), payoutUpdatedAtMs:Date.now(), payoutUpdatedByUid:cleanPremiumText(identity.uid || "", 140), payoutUpdatedByUsername:cleanPremiumText(identity.username || "admin", 80), payoutUpdatedByAuthMethod:cleanPremiumText(identity.authMethod || "firebase", 40) }, { merge:true });
        out.changed += 1; addSample({ id:docSnap.id, orderId:cleanPremiumText(x.orderId || "", 160), change:"payoutStatus=pending" });
      }
    } else if (action === "repair-paid-order-tokens") {
      const snap = await db.collection("premiumOrders").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceStatusPaid(x) || x.downloadToken || !azMaintenanceHasDownloadTarget(x)) { out.skipped += 1; continue; }
        const order = { ...x, orderId:cleanPremiumText(x.orderId || docSnap.id, 160), status:x.status || "paid", paidAt:x.paidAt || new Date().toISOString(), receiptTokenRequired:true, receiptTokenVersion:2 };
        const repaired = makeDownloadForOrder(order);
        await docSnap.ref.set(azJsonSafe({ ...repaired, maintenanceUpdatedAt:new Date().toISOString(), maintenanceUpdatedAtMs:Date.now() }), { merge:true });
        out.changed += 1; addSample({ orderId:cleanPremiumText(repaired.orderId || docSnap.id, 160), token:azMaskToken(repaired.downloadToken || ""), change:"downloadToken created" });
      }
    } else if (action === "prune-expired-download-tokens") {
      const snap = await db.collection("premiumDownloadTokens").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceExpiredTokenPrunable(x, now)) { out.skipped += 1; continue; }
        await docSnap.ref.delete();
        out.changed += 1; addSample({ token:azMaskToken(x.token || docSnap.id), orderId:cleanPremiumText(x.orderId || "", 160), change:"deleted old expired token" });
      }
    } else if (action === "prune-old-audit-logs") {
      const snap = await db.collection("adminAuditLogs").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceOldAuditLogPrunable(x, now)) { out.skipped += 1; continue; }
        await docSnap.ref.delete();
        out.changed += 1; addSample({ id:docSnap.id, action:cleanPremiumText(x.action || "", 100), change:"deleted old audit log" });
      }
    } else if (action === "prune-old-notifications") {
      const snap = await db.collection("notifications").limit(limitRows).get();
      for (const docSnap of snap.docs) {
        out.processed += 1;
        const x = { id:docSnap.id, ...(docSnap.data() || {}) };
        if (!azMaintenanceOldNotificationPrunable(x, now)) { out.skipped += 1; continue; }
        await docSnap.ref.delete();
        out.changed += 1; addSample({ id:docSnap.id, title:cleanPremiumText(x.title || "Notification", 120), change:"deleted old notification" });
      }
    } else {
      return { ok:false, error:"Unknown maintenance action." };
    }
  } catch (err) {
    out.ok = false;
    out.errors.push(err && err.message ? err.message : String(err));
  }
  out.latencyMs = Date.now() - started;
  return out;
}
function azMaskEmail(value = "") {
  const email = String(value || "").trim();
  const at = email.indexOf("@");
  if (at <= 1) return email ? "***" : "";
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  return name.slice(0, 2) + "***@" + domain;
}
function azMaskToken(value = "") {
  const t = String(value || "").trim();
  if (!t) return "";
  if (t.length <= 8) return "***";
  return t.slice(0, 4) + "…" + t.slice(-4);
}
function azSafeUrlInfo(value = "") {
  try {
    const u = new URL(String(value || ""));
    return { host: u.host, pathname: u.pathname ? u.pathname.slice(0, 80) : "" };
  } catch (_) {
    return { host: "", pathname: "" };
  }
}
function azVerifyToyyibCallbackEnabled() {
  // Default ON: callback cannot mark an order paid unless ToyyibPay API also confirms it.
  // Emergency bypass only if ToyyibPay verification endpoint is down: AZOBSS_VERIFY_TOYYIB_CALLBACK=0
  return String(process.env.AZOBSS_VERIFY_TOYYIB_CALLBACK || "1") !== "0";
}

function cleanForToyyib(value, max = 100) {
  return String(value || "").replace(/[^a-zA-Z0-9 _.,@+\-()]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// ToyyibPay documents billName/billDescription as alphanumeric, spaces and underscores only.
// Keep this stricter helper separate because email, phone and optional message fields have different formats.
function cleanToyyibBillText(value, max = 100) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9 _]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
function cleanToyyibEmail(value, max = 80) {
  const email = String(value || "").trim().toLowerCase().slice(0, max);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
function cleanToyyibPhone(value, max = 20) {
  let digits = String(value || "").replace(/\D/g, "");
  // ToyyibPay examples use a local Malaysian number (01...). Convert +60/60 format when possible.
  if (/^60\d{8,10}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return digits.slice(0, max);
}
function azToyyibExtractBillCode(result) {
  const candidates = [];
  const push = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) return value.forEach(push);
    if (typeof value === "object") {
      candidates.push(value.BillCode, value.billCode, value.billcode, value.bill_code);
      ["data", "result", "response", "bill"].forEach((key) => push(value[key]));
      return;
    }
  };
  push(result);
  return cleanPremiumText(candidates.find(Boolean) || "", 120);
}
function azToyyibApiMessage(result, fallback = "ToyyibPay did not return a Bill Code.") {
  const objects = azToyyibResultCandidates(result);
  for (const item of objects) {
    const text = item && (item.message || item.Message || item.msg || item.error || item.Error || item.result || item.reason || item.status);
    if (text && typeof text !== "object") return cleanPremiumText(text, 350);
  }
  if (typeof result === "string" && result.trim()) return cleanPremiumText(result, 350);
  try {
    const text = JSON.stringify(result);
    if (text && text !== "[]" && text !== "{}" && text !== "null") return cleanPremiumText(text, 350);
  } catch (_) {}
  return fallback;
}
let azToyyibDuitNowStatusCache = { checkedAtMs:0, activated:false };
async function azToyyibDuitNowActivated() {
  const now = Date.now();
  if (now - Number(azToyyibDuitNowStatusCache.checkedAtMs || 0) < 15 * 60 * 1000) {
    return !!azToyyibDuitNowStatusCache.activated;
  }
  try {
    const result = await postToyyib("checkDuitNowQRStatus", { userSecretKey:TOYYIB_SECRET_KEY });
    const item = Array.isArray(result) ? (result[0] || {}) : (result || {});
    const activated = item.duitnowqr_activated === true || String(item.duitnowqr_activated || "").toLowerCase() === "true" || String(item.duitnowqr_activated || "") === "1";
    azToyyibDuitNowStatusCache = { checkedAtMs:now, activated };
    return activated;
  } catch (err) {
    console.warn("ToyyibPay DuitNow QR status check skipped:", err && (err.message || err));
    azToyyibDuitNowStatusCache = { checkedAtMs:now, activated:false };
    return false;
  }
}

async function postToyyib(endpoint, payload) {
  const body = new URLSearchParams();
  Object.entries(payload || {}).forEach(([k, v]) => body.append(k, String(v ?? "")));
  const r = await fetch(`${TOYYIB_BASE_URL}/index.php/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  if (!r.ok) throw new Error(`ToyyibPay API ${r.status}: ${text.slice(0, 250)}`);
  return json || text;
}

function readPremiumOrders() { return readPremiumJson(PREMIUM_ORDERS_FILE, []); }
function writePremiumOrders(orders) { writePremiumJson(PREMIUM_ORDERS_FILE, (orders || []).slice(0, 500)); }
function upsertPremiumOrder(order) {
  const orders = readPremiumOrders();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const idx = orders.findIndex(o => o.orderId === order.orderId || (order.billCode && o.billCode === order.billCode));
  const previous = idx >= 0 ? (orders[idx] || {}) : {};
  const merged = {
    ...previous,
    ...order,
    createdAt: order.createdAt || previous.createdAt || nowIso,
    createdAtMs: Number(order.createdAtMs || previous.createdAtMs || Date.parse(order.createdAt || previous.createdAt || "") || nowMs) || nowMs,
    paidAtMs: Number(order.paidAtMs || previous.paidAtMs || Date.parse(order.paidAt || previous.paidAt || "") || 0) || 0,
    updatedAt: nowIso,
    updatedAtMs: nowMs
  };
  if (idx >= 0) orders[idx] = merged;
  else orders.unshift(merged);
  writePremiumOrders(orders);
  const saved = idx >= 0 ? orders[idx] : orders[0];
  azFireAndForget(azPersistPremiumOrder(saved), "AZOBSS premium order Firestore persist failed:");
  return saved;
}
function findPremiumOrderByAny(ref = {}) {
  return readPremiumOrders().find(o => (ref.orderId && o.orderId === ref.orderId) || (ref.billCode && o.billCode === ref.billCode) || (ref.billcode && o.billCode === ref.billcode)) || null;
}
async function findPremiumOrderByAnyDeep(ref = {}) {
  const local = findPremiumOrderByAny(ref);
  if (local) return local;
  try {
    const persistent = await azFindPremiumOrderPersistent(ref);
    if (persistent) {
      const hydrated = { ...persistent, orderId: persistent.orderId || ref.orderId || "", billCode: persistent.billCode || ref.billCode || ref.billcode || "" };
      try { upsertPremiumOrder(hydrated); } catch (_) {}
      return hydrated;
    }
  } catch (err) {
    console.warn("Premium order Firestore lookup failed:", err && (err.message || err));
  }
  return null;
}
function azToyyibResultCandidates(result) {
  const out = [];
  const push = (x) => {
    if (!x) return;
    if (Array.isArray(x)) return x.forEach(push);
    if (typeof x === "object") out.push(x);
  };
  push(result);
  if (result && typeof result === "object" && !Array.isArray(result)) {
    ["data", "result", "results", "transactions", "transaction", "bill", "response"].forEach((key) => push(result[key]));
  }
  return out;
}
function azToyyibIsPaymentStatusField(fieldName = "") {
  const key = String(fieldName || "").trim().toLowerCase();
  // Only true payment transaction fields may unlock software/CAD downloads.
  // Generic fields such as status/status_id/billStatus can mean the bill exists or a page/API request succeeded,
  // so those fields must never be treated as paid.
  return /(billpayment|bill_payment|paymentstatus|payment_status|transactionstatus|transaction_status)/i.test(key);
}
function azToyyibPaidStatusValue(value, fieldName = "") {
  const v = String(value ?? "").trim().toLowerCase();
  const key = String(fieldName || "").trim().toLowerCase();
  if (!v) return false;
  if (["0", "2", "3", "cancel", "cancelled", "canceled", "failed", "fail", "unpaid", "pending", "processing", "void", "expired", "declined", "rejected"].includes(v)) return false;

  // CRITICAL: numeric 1/success is only accepted from explicit payment/transaction status fields.
  // Do not accept generic status_id/status/billStatus because cancelled return/callbacks can still carry them.
  if (!azToyyibIsPaymentStatusField(key)) return false;
  if (["1", "paid", "successful", "completed", "settled", "success"].includes(v)) return true;
  return false;
}
function azToyyibTxPaid(tx = {}) {
  if (!tx || typeof tx !== "object") return false;
  const negativeFields = [tx.billpaymentStatus, tx.billPaymentStatus, tx.billpayment_status, tx.paymentStatus, tx.payment_status, tx.transaction_status, tx.transactionStatus, tx.transaction_status_id];
  if (negativeFields.some(v => ["0", "2", "3", "cancel", "cancelled", "canceled", "failed", "fail", "unpaid", "pending", "processing", "void", "expired", "declined", "rejected"].includes(String(v ?? "").trim().toLowerCase()))) return false;
  const fields = [
    ["billpaymentStatus", tx.billpaymentStatus],
    ["billPaymentStatus", tx.billPaymentStatus],
    ["billpayment_status", tx.billpayment_status],
    ["paymentStatus", tx.paymentStatus],
    ["payment_status", tx.payment_status],
    ["transaction_status", tx.transaction_status],
    ["transactionStatus", tx.transactionStatus],
    ["transaction_status_id", tx.transaction_status_id]
  ];
  return fields.some(([key, value]) => azToyyibPaidStatusValue(value, key));
}
function azToyyibTxBillCode(tx = {}) {
  return cleanPremiumText(tx.billCode || tx.billcode || tx.BillCode || tx.bill_code || tx.refno || tx.billcode_id || "", 100);
}
function azToyyibTxReference(tx = {}, fallback = "") {
  return cleanPremiumText(tx.billpaymentInvoiceNo || tx.transaction_id || tx.transactionId || tx.refno || tx.referenceNo || tx.payment_reference || fallback || "", 180);
}
async function azVerifyToyyibPaidTransaction(order = {}) {
  const billCode = cleanPremiumText(order.billCode || order.billcode || "", 100);
  if (!billCode) return { paid:false, reason:"missing_bill_code" };
  const payloads = [
    { billCode, userSecretKey: TOYYIB_SECRET_KEY || "" },
    { billcode: billCode, userSecretKey: TOYYIB_SECRET_KEY || "" },
    { billCode },
    { billcode: billCode }
  ];
  const seen = new Set();
  let lastReason = "not_paid";
  for (const payload of payloads) {
    const sig = JSON.stringify(payload);
    if (seen.has(sig)) continue;
    seen.add(sig);
    try {
      const result = await postToyyib("getBillTransactions", payload);
      const candidates = azToyyibResultCandidates(result);
      for (const tx of candidates) {
        const txBillCode = azToyyibTxBillCode(tx);
        const sameBill = !txBillCode || txBillCode === billCode;
        if (sameBill && azToyyibTxPaid(tx)) {
          return { paid:true, tx, paymentReference:azToyyibTxReference(tx, order.paymentReference || ""), payloadUsed:Object.keys(payload).join(",") };
        }
      }
      if (!candidates.length) lastReason = "empty_transactions";
    } catch (err) {
      lastReason = err && err.message ? err.message : String(err);
    }
  }
  return { paid:false, reason:lastReason };
}
function getBrevoApiKey() {
  return String(process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || "").trim();
}
function brevoApiReady() { return !!getBrevoApiKey(); }
function smtpReady() { return !!(nodemailer && process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS); }
function mailReady() { return brevoApiReady() || smtpReady(); }
function makeMailer() {
  if (!smtpReady()) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = secureEnv ? ["1", "true", "yes", "on"].includes(secureEnv) : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: port === 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
  });
}
async function sendBrevoApiEmail({ to, subject, html, text, attachments }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) throw new Error("BREVO_API_KEY missing");
  const fromEmail = cleanPremiumText(process.env.MAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || "", 180);
  if (!fromEmail) throw new Error("MAIL_FROM missing");

  const payload = {
    sender: { name: process.env.MAIL_FROM_NAME || "AZOBSS", email: fromEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text
  };
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachment = attachments.map(a => ({ name: a.name || a.filename || "azobss-receipt.pdf", content: a.content || a.base64 || "" })).filter(a => a.content);
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await response.text();
  let bodyJson = null;
  try { bodyJson = JSON.parse(bodyText); } catch (_) {}
  if (!response.ok) {
    const message = bodyJson && (bodyJson.message || bodyJson.error) ? (bodyJson.message || bodyJson.error) : bodyText;
    throw new Error(`Brevo API ${response.status}: ${String(message).slice(0, 500)}`);
  }
  return bodyJson || { raw: bodyText };
}
async function azSendEmailWithOptionalPdf({ to, subject, html, text, pdfBuffer, filename }) {
  const cleanTo = cleanPremiumText(to || "", 180);
  if (!cleanTo) throw new Error("Recipient email missing");
  const safeFilename = cleanPremiumText(filename || "azobss-receipt.pdf", 120) || "azobss-receipt.pdf";
  if (brevoApiReady()) {
    return await sendBrevoApiEmail({
      to: cleanTo, subject, html, text,
      attachments: pdfBuffer ? [{ name: safeFilename, content: Buffer.from(pdfBuffer).toString("base64") }] : []
    });
  }
  if (!mailReady()) throw new Error("Email not ready. Set BREVO_API_KEY + MAIL_FROM, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.");
  const transporter = makeMailer();
  await transporter.verify();
  return await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: cleanTo,
    subject,
    html,
    text,
    attachments: pdfBuffer ? [{ filename: safeFilename, content: pdfBuffer, contentType: "application/pdf" }] : []
  });
}

async function azHydratePremiumOrderExpiryFromCurrentProduct(order = {}) {
  try {
    if (!order || isPaBmPremiumOrder(order)) return order;
    const productId = cleanPremiumText(order.productId || order.product?.productId || order.product?.id || '', 180);
    if (!productId) return order;
    let trusted = await azFindFirestoreProduct(productId);
    if (!trusted) trusted = azFindLocalSoftwareProduct(productId);
    if (!trusted) return order;
    const expiryHours = azobssExpiryHoursFromOrder({ product: trusted });
    const downloadLimit = azobssDownloadLimitFromOrder({ product: trusted });
    const never = expiryHours === 0;
    return {
      ...order,
      product: {
        ...(order.product || {}),
        ...trusted,
        expiryHours,
        linkExpiryHours: expiryHours,
        downloadExpiryHours: expiryHours,
        downloadLimit,
        maxDownload: downloadLimit,
        maxDownloads: downloadLimit,
        expiresNever: never
      },
      expiryHours,
      linkExpiryHours: expiryHours,
      downloadExpiryHours: expiryHours,
      downloadLimit,
      maxDownload: downloadLimit,
      maxDownloads: downloadLimit,
      expiresNever: never
    };
  } catch (err) {
    console.warn('AZOBSS premium expiry hydrate skipped:', err && (err.message || err));
    return order;
  }
}

function buildAzobssDownloadEmail(order, downloadUrl, receiptUrl) {
  const neverExpire = azobssOrderNeverExpire(order || {});
  const expires = azobssExpiryLabelForOrder(order || {});
  const expirySentence = neverExpire ? "This link is set to Never expire, but download limit still applies." : `If it is not used, the link will expire on ${expires}.`;
  const receiptPdfUrl = receiptUrl + (receiptUrl.includes("?") ? "&" : "?") + "format=pdf";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#111"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px"><h2 style="margin-top:0">AZOBSS Download Ready ✅</h2><p>Thank you for your purchase. Your payment has been verified successfully.</p><p><b>Product:</b> ${String(order.productName || "AZOBSS Digital Product")}<br><b>Order ID:</b> ${String(order.orderId || "-")}<br><b>Amount:</b> ${String(order.amount || "-")}</p>${azSubscriptionActivationHtml(order)}<p><a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700">Download Now</a></p><p style="color:#374151;font-size:13px">This secure button will open a confirmation page first. Download quota is used only once when this secure session starts. IDM/browser Range requests inside the same session will not add extra quota.</p><p style="color:#b45309"><b>Important:</b> This link opens a confirmation page first. Download quota is used only once when this secure session starts. IDM/browser Range requests inside the same session will not add extra quota. ${expirySentence}</p><p><a href="${receiptUrl}">View receipt</a> &nbsp;|&nbsp; <a href="${receiptPdfUrl}">Download PDF receipt</a></p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="font-size:12px;color:#6b7280">AZOBSS Digital Store</p></div></body></html>`;
}
// AZOBSS PATCH 319: Admin resend receipt email should also include Software/CAD download link.
async function azEnsurePremiumDownloadResendLink(order = {}, req = null) {
  try {
    let current = order || {};
    const category = azReceiptCategory(current);
    if (String(category || '').toLowerCase().includes('pa/bm') || isPaBmPremiumOrder(current)) return '';
    if (azReceiptStatusBucket(current) !== 'paid') return '';
    const orderId = cleanPremiumText(current.orderId || current.receiptNo || '', 180);
    const billCode = cleanPremiumText(current.billCode || '', 120);
    try {
      const latestLocal = findPremiumOrderByAny({ orderId, billCode });
      if (latestLocal) current = { ...current, ...latestLocal };
    } catch (_) {}
    try {
      const latestPersistent = await azFindPremiumOrderPersistent({ orderId, billCode });
      if (latestPersistent) current = { ...current, ...latestPersistent };
    } catch (_) {}

    current = await azHydratePremiumOrderExpiryFromCurrentProduct(current);
    const realDownloadLink = cleanPremiumUrl(current.downloadLink || current.premiumDownloadFileLink || current.secureDownloadLink || current.privateDownloadLink || current.downloadUrl || '');
    const r2Info = azResolvePremiumR2Object(current);
    const r2ObjectKey = r2Info ? r2Info.key : '';
    if (!realDownloadLink && !r2ObjectKey) return '';

    const base = req ? publicBaseUrlFromReq(req) : publicBaseUrlFromReq({ headers:{} });
    const existingToken = cleanPremiumText(current.downloadToken || current.token || '', 220);
    if (existingToken) {
      let tokenRow = null;
      try { tokenRow = findPremiumToken(existingToken); } catch (_) {}
      if (!tokenRow) { try { tokenRow = await azFindPremiumTokenPersistent(existingToken); } catch (_) {} }
      const expiresAt = Number(tokenRow && tokenRow.expiresAt || 0) || Date.parse(String(current.tokenExpiresAt || current.expiresAt || '')) || 0;
      const used = Number(tokenRow && tokenRow.usedCount || current.usedCount || current.downloadCount || 0) || 0;
      const max = Math.max(1, Number(tokenRow && tokenRow.maxDownload || current.maxDownload || current.maxDownloads || 1) || 1);
      if ((!expiresAt || expiresAt > Date.now()) && used < max) {
        if (r2ObjectKey) {
          savePremiumToken({
            ...(tokenRow || {}),
            token: existingToken,
            orderId: current.orderId || orderId,
            billCode: current.billCode || billCode,
            productId: current.productId || current.receiptProductId || '',
            productName: current.productName || current.receiptProductName || 'AZOBSS Digital Product',
            user: current.user || {},
            downloadLink: realDownloadLink,
            premiumDownloadFileLink: realDownloadLink,
            r2ObjectKey,
            r2Key: r2ObjectKey,
            product: { ...(current.product || {}), r2ObjectKey, r2Key: r2ObjectKey }
          });
          upsertPremiumOrder({ ...current, r2ObjectKey, r2Key:r2ObjectKey, product:{ ...(current.product || {}), r2ObjectKey, r2Key:r2ObjectKey } });
        }
        return azPreferredPremiumDownloadUrl({ ...current, ...(tokenRow || {}), token: existingToken, downloadToken: existingToken, r2ObjectKey, r2Key:r2ObjectKey }, base);
      }
    }

    const token = makeId('dl').replace(/[^a-zA-Z0-9_-]/g, '');
    const now = Date.now();
    const expiryHours = azobssExpiryHoursFromOrder(current);
    const expiresAtMs = azobssTokenExpiresAtMsFromOrder(current, now);
    const maxDownload = azobssDownloadLimitFromOrder(current);
    const expiresNever = expiryHours === 0;
    const tokenData = {
      token,
      orderId: current.orderId || orderId,
      billCode: current.billCode || billCode,
      productId: current.productId || current.receiptProductId || '',
      productName: current.productName || current.receiptProductName || 'AZOBSS Digital Product',
      user: current.user || { email: current.email || current.buyerEmail || current.receiptBuyerEmail || '', username: current.username || current.usernameKey || current.receiptBuyerUsername || '' },
      downloadLink: realDownloadLink,
      premiumDownloadFileLink: realDownloadLink,
      r2ObjectKey,
      r2Key: r2ObjectKey,
      product: { ...(current.product || {}), r2ObjectKey, r2Key: r2ObjectKey },
      createdAt: now,
      expiresAt: expiresAtMs,
      expiresNever,
      expiryHours,
      usedCount: 0,
      maxDownload
    };
    savePremiumToken(tokenData);
    upsertPremiumOrder({
      ...current,
      orderId: current.orderId || orderId,
      billCode: current.billCode || billCode,
      downloadLink: realDownloadLink,
      premiumDownloadFileLink: realDownloadLink,
      r2ObjectKey,
      r2Key: r2ObjectKey,
      product: { ...(current.product || {}), r2ObjectKey, r2Key: r2ObjectKey },
      downloadToken: token,
      tokenExpiresAt: new Date(expiresAtMs).toISOString(),
      expiresNever,
      expiryHours,
      linkExpiryHours: expiryHours,
      maxDownload,
      lastAdminResendDownloadLinkAt: new Date(now).toISOString()
    });
    return azPreferredPremiumDownloadUrl({ ...current, ...tokenData, token, downloadToken:token, r2ObjectKey, r2Key:r2ObjectKey }, base);
  } catch (err) {
    console.warn('AZOBSS admin receipt+download resend link failed:', err && (err.message || err));
    return '';
  }
}

async function maybeSendDownloadEmail(order, req) {
  try {
    let current = order || {};

    // Idempotency guard: ToyyibPay can call callback more than once and users can also press verify/status.
    // Avoid duplicate Brevo/SMTP emails while still allowing retry if a previous send failed.
    try {
      const latestLocal = findPremiumOrderByAny({ orderId: current.orderId, billCode: current.billCode }) || null;
      if (latestLocal) current = { ...current, ...latestLocal };
      if (!current.emailSentAt && current.orderId) {
        const latestPersistent = await azFindPremiumOrderPersistent({ orderId: current.orderId, billCode: current.billCode });
        if (latestPersistent) current = { ...current, ...latestPersistent };
      }
    } catch (_emailGuardLookupError) {}
    if (current.emailSentAt) return current;
    const sendStartedMs = Date.parse(current.emailSendStartedAt || "") || 0;
    if (sendStartedMs && (Date.now() - sendStartedMs) < 2 * 60 * 1000 && !current.emailError) {
      console.log("AZOBSS email send skipped: already in progress", JSON.stringify({ orderId: current.orderId || "", startedAt: current.emailSendStartedAt || "" }).slice(0, 500));
      return current;
    }
    if (current.orderId || current.billCode) {
      current = upsertPremiumOrder({ ...current, emailSendStartedAt: new Date().toISOString(), emailSendAttemptCount: Number(current.emailSendAttemptCount || 0) + 1 });
    }

    // PA/BM purchases are downloaded from Latest Purchase List with controlled 5x/7-day access.
    // Do not run Premium Software email/token logic for PA/BM; it creates misleading NO_DOWNLOAD_LINK logs.
    if (isPaBmPremiumOrder(current)) {
      console.log("AZOBSS PA/BM email skipped: download is managed inside Latest Purchase List", JSON.stringify({ orderId: current.orderId || "", billCode: current.billCode || "" }).slice(0, 500));
      return upsertPremiumOrder({ ...current, emailSkippedForPaBm: true, emailError: null });
    }

    // Critical safety gate: Software/CAD ToyyibPay orders must be verified by ToyyibPay API before any email/token is generated.
    // This prevents cancelled/abandoned payment pages or stale localStorage from sending download links.
    const currentPaymentMethod = String(current.paymentMethod || "").toLowerCase();
    const isToyyibSoftwareCadOrder = !!current.billCode || currentPaymentMethod.includes("toyyib");
    if (isToyyibSoftwareCadOrder && !(current.toyyibVerifiedAt || current.paymentVerificationSource === "toyyibpay-api")) {
      console.warn("AZOBSS download email blocked: ToyyibPay order not API-verified", JSON.stringify({ orderId: current.orderId || "", billCode: current.billCode || "", status: current.status || "" }).slice(0, 500));
      return upsertPremiumOrder({
        ...current,
        emailError: "Blocked: ToyyibPay payment not verified by API",
        emailErrorAt: new Date().toISOString(),
        emailSendStartedAt: ""
      });
    }
    // Refresh the trusted product first so R2-only products can recover their current
    // Cloudflare R2 object key even when the paid order contains no HTTPS fallback link.
    current = await azHydratePremiumOrderExpiryFromCurrentProduct(current);

    const email = cleanPremiumText(azPickPremiumBuyerEmailFromOrder(current), 180);
    const realDownloadLink = cleanPremiumUrl(
      current.downloadLink ||
      current.premiumDownloadFileLink ||
      current.secureDownloadLink ||
      current.privateDownloadLink ||
      current.downloadUrl ||
      ""
    );
    const r2Info = azResolvePremiumR2Object(current);
    const r2ObjectKey = r2Info ? r2Info.key : "";
    const downloadSourceType = r2ObjectKey ? "cloudflare-r2-private" : (realDownloadLink ? "https-fallback" : "missing");

    console.log("AZOBSS EMAIL TARGET:", email ? azMaskEmail(email) : "NO_EMAIL");
    console.log("AZOBSS DOWNLOAD SOURCE:", downloadSourceType);
    console.log("AZOBSS DOWNLOAD LINK:", realDownloadLink ? azSafeUrlInfo(realDownloadLink) : (r2ObjectKey ? "R2_PRIVATE_OBJECT" : "NO_DOWNLOAD_SOURCE"));
    console.log("AZOBSS MAIL READY:", mailReady() ? "YES" : "NO", JSON.stringify({
      brevoApi: brevoApiReady(),
      nodemailer: !!nodemailer,
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT,
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASS: !!process.env.SMTP_PASS,
      BREVO_API_KEY: !!getBrevoApiKey()
    }));

    if (!email) return upsertPremiumOrder({ ...current, emailError: "Buyer email missing", emailErrorAt: new Date().toISOString(), emailSendStartedAt: "" });
    if (!realDownloadLink && !r2ObjectKey) return upsertPremiumOrder({ ...current, emailError: "Premium Download File Link / Cloudflare R2 Private Object Key missing", emailErrorAt: new Date().toISOString(), emailSendStartedAt: "" });
    if (current.emailSentAt) return current;
    if (!mailReady()) return upsertPremiumOrder({ ...current, emailError: "Email not ready. Set BREVO_API_KEY + MAIL_FROM, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.", emailErrorAt: new Date().toISOString(), emailSendStartedAt: "" });

    // Persist only the internal R2 key on the order/token. The email still receives the
    // secure AZOBSS confirmation URL, never the raw r2ObjectKey value.
    current = upsertPremiumOrder({
      ...current,
      email,
      buyerEmail: email,
      downloadLink: realDownloadLink,
      premiumDownloadFileLink: realDownloadLink,
      r2ObjectKey,
      r2Key: r2ObjectKey,
      product: { ...(current.product || {}), r2ObjectKey, r2Key: r2ObjectKey },
      emailError: null
    });
    current = makeDownloadForOrder(current);

    const base = publicBaseUrlFromReq(req);
    const downloadUrl = azPreferredPremiumDownloadUrl({ ...current, token:current.downloadToken, downloadToken:current.downloadToken, expiresAt:current.tokenExpiresAtMs || Date.parse(String(current.tokenExpiresAt || "")) || current.expiresAt, maxDownload:current.maxDownload || current.maxDownloads || current.downloadLimit || 1, r2ObjectKey, r2Key:r2ObjectKey }, base);
    const receiptUrl = azReceiptUrl(base, current);
    console.log("AZOBSS SENDING DOWNLOAD EMAIL", JSON.stringify({ orderId:current.orderId, email:azMaskEmail(email), downloadToken:azMaskToken(current.downloadToken), downloadSource:downloadSourceType, downloadTarget:realDownloadLink ? azSafeUrlInfo(realDownloadLink) : "R2_PRIVATE_OBJECT" }).slice(0,800));

    const subject = `AZOBSS Download Ready - ${cleanPremiumText(current.productName || "Digital Product", 80)}`;
    const html = buildAzobssDownloadEmail(current, downloadUrl, receiptUrl);
    const text = `AZOBSS Download Ready

Product: ${current.productName}
Order ID: ${current.orderId}
Download: ${downloadUrl}
Receipt: ${receiptUrl}${current.activationCode ? `
Activation Code: ${current.activationCode}
Plan: ${current.subscriptionPlanLabel || current.subscriptionPlan?.label || '-'}
Valid Until: ${current.activationCodeExpiresAt || '-'}` : ''}

This link opens a confirmation page first. Download quota is used only once when this secure session starts. IDM/browser Range requests inside the same session will not add extra quota.`;

    let sendInfo = null;
    if (brevoApiReady()) {
      console.log("AZOBSS BREVO API SEND START", JSON.stringify({ orderId: current.orderId, email:azMaskEmail(email), from: process.env.MAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || "" }).slice(0,500));
      sendInfo = await sendBrevoApiEmail({ to: email, subject, html, text });
      console.log("AZOBSS BREVO API SENT OK", JSON.stringify({ orderId: current.orderId, email:azMaskEmail(email), response: sendInfo }).slice(0,800));
    } else {
      const transporter = makeMailer();
      console.log("AZOBSS SMTP CONFIG", JSON.stringify({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "").trim().toLowerCase() || (Number(process.env.SMTP_PORT || 587) === 465 ? "auto-true" : "auto-false"),
        requireTLS: Number(process.env.SMTP_PORT || 587) === 587
      }));

      await transporter.verify();
      console.log("AZOBSS SMTP VERIFY OK");

      sendInfo = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
        text
      });
      console.log("AZOBSS SMTP EMAIL SENT OK", JSON.stringify({ orderId: current.orderId, email:azMaskEmail(email), messageId: sendInfo && sendInfo.messageId || null }).slice(0,500));
    }

    console.log("AZOBSS EMAIL SENT OK", JSON.stringify({ orderId: current.orderId, email:azMaskEmail(email), via: brevoApiReady() ? "brevo-api" : "smtp" }).slice(0,500));
    return upsertPremiumOrder({ ...current, emailSentAt: new Date().toISOString(), emailTo: email, emailError: null, emailSendStartedAt: "", lastEmailProvider: brevoApiReady() ? "brevo-api" : "smtp" });
  } catch (e) {
    console.error("AZOBSS email send failed:", e && (e.stack || e.message || e));
    return upsertPremiumOrder({ ...(order || {}), emailError: e.message || String(e), emailErrorAt: new Date().toISOString(), emailSendStartedAt: "" });
  }
}
function makeDownloadForOrder(order) {
  if (!order) return order;
  if (order.downloadToken) {
    const existingR2Info = azResolvePremiumR2Object(order);
    const existingR2ObjectKey = existingR2Info ? existingR2Info.key : "";
    if (existingR2ObjectKey) {
      const existingToken = findPremiumToken(order.downloadToken) || {};
      const now = Date.now();
      const expiryHours = azobssExpiryHoursFromOrder(order);
      const expiresAtMs = Number(existingToken.expiresAt || order.tokenExpiresAtMs || (order.tokenExpiresAt ? Date.parse(order.tokenExpiresAt) : 0)) || azobssTokenExpiresAtMsFromOrder(order, now);
      const maxDownload = azobssDownloadLimitFromOrder(order);
      const realDownloadLink = cleanPremiumUrl(order.downloadLink || order.premiumDownloadFileLink || order.secureDownloadLink || order.privateDownloadLink || order.downloadUrl || "");
      savePremiumToken({ ...existingToken, token:order.downloadToken, orderId:order.orderId, productId:order.productId, productName:order.productName, user:order.user||{}, downloadLink:realDownloadLink, premiumDownloadFileLink:realDownloadLink, r2ObjectKey:existingR2ObjectKey, r2Key:existingR2ObjectKey, product:{...(order.product||{}),r2ObjectKey:existingR2ObjectKey,r2Key:existingR2ObjectKey}, createdAt:Number(existingToken.createdAt||now), expiresAt:expiresAtMs, expiresNever:expiryHours===0, expiryHours, usedCount:Number(existingToken.usedCount||0), maxDownload });
      return upsertPremiumOrder({ ...order, r2ObjectKey:existingR2ObjectKey, r2Key:existingR2ObjectKey, product:{...(order.product||{}),r2ObjectKey:existingR2ObjectKey,r2Key:existingR2ObjectKey} });
    }
    return order;
  }
  const token = makeId("dl").replace(/[^a-zA-Z0-9_-]/g, "");
  const now = Date.now();
  const expiryHours = azobssExpiryHoursFromOrder(order);
  const expiresAtMs = azobssTokenExpiresAtMsFromOrder(order, now);
  const expiresNever = expiryHours === 0;
  const maxDownload = azobssDownloadLimitFromOrder(order);
  const realDownloadLink = cleanPremiumUrl(order.downloadLink || order.premiumDownloadFileLink || order.secureDownloadLink || order.privateDownloadLink || order.downloadUrl || "");
  const r2Info = azResolvePremiumR2Object(order);
  const r2ObjectKey = r2Info ? r2Info.key : "";
  if (!realDownloadLink && !r2ObjectKey) throw new Error("No premium download source is configured for this paid order.");
  savePremiumToken({ token, orderId: order.orderId, productId: order.productId, productName: order.productName, user: order.user || {}, downloadLink: realDownloadLink, premiumDownloadFileLink: realDownloadLink, r2ObjectKey, r2Key:r2ObjectKey, product:{...(order.product||{}),r2ObjectKey,r2Key:r2ObjectKey}, createdAt: now, expiresAt: expiresAtMs, expiresNever, expiryHours, usedCount: 0, maxDownload });
  return upsertPremiumOrder({ ...order, downloadLink: realDownloadLink, premiumDownloadFileLink: realDownloadLink, r2ObjectKey, r2Key:r2ObjectKey, product:{...(order.product||{}),r2ObjectKey,r2Key:r2ObjectKey}, downloadToken: token, tokenExpiresAt: new Date(expiresAtMs).toISOString(), expiresNever, expiryHours, linkExpiryHours: expiryHours, downloadExpiryHours: expiryHours, downloadLimit:maxDownload, maxDownloads:maxDownload, maxDownload, receiptTokenRequired: order.receiptTokenRequired === false ? false : true, receiptTokenVersion: order.receiptTokenVersion || 2 });
}

const AZOBSS_ORDER_FINALIZE_LOCKS = new Map();
async function azWithOrderFinalizeLock(order, task) {
  const key = cleanPremiumText((order && (order.orderId || order.billCode)) || makeId("order"), 180);
  const previous = AZOBSS_ORDER_FINALIZE_LOCKS.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const chained = previous.then(() => current).catch(() => current);
  AZOBSS_ORDER_FINALIZE_LOCKS.set(key, chained);
  try {
    await previous.catch(() => {});
    return await task();
  } finally {
    release();
    setTimeout(() => {
      if (AZOBSS_ORDER_FINALIZE_LOCKS.get(key) === chained) AZOBSS_ORDER_FINALIZE_LOCKS.delete(key);
    }, 1000).unref?.();
  }
}
async function azReloadPremiumOrder(order = {}) {
  let latest = order || {};
  try {
    const local = findPremiumOrderByAny({ orderId: latest.orderId, billCode: latest.billCode });
    if (local) latest = { ...latest, ...local };
  } catch (_localReloadError) {}
  try {
    const persistent = await azFindPremiumOrderPersistent({ orderId: latest.orderId, billCode: latest.billCode });
    if (persistent) latest = { ...latest, ...persistent };
  } catch (_persistentReloadError) {}
  return latest;
}
async function azFinalizePaidOrderOnce(order = {}, req, opts = {}) {
  if (!order) return order;
  return azWithOrderFinalizeLock(order, async () => {
    const tx = opts.toyyibTransaction || opts.tx || order.toyyibTransaction || null;
    const callbackData = opts.toyyibCallback || order.toyyibCallback || null;
    let latest = await azReloadPremiumOrder(order);
    const nowIso = new Date().toISOString();
    const paidAt = latest.paidAt || opts.paidAt || nowIso;
    const paymentReference = opts.paymentReference || (tx && (tx.billpaymentInvoiceNo || tx.transaction_id || tx.refno)) || latest.paymentReference || "";
    const requestedPaymentMethod = cleanPremiumText(opts.paymentMethod || latest.paymentMethod || (tx ? "toyyibpay" : ""), 40).toLowerCase() || "toyyibpay";
    const verifiedPayment = opts.verified === true || !!tx;
    const verifiedByToyyib = verifiedPayment && requestedPaymentMethod.includes("toyyib");
    const verifiedByStripe = verifiedPayment && requestedPaymentMethod.includes("stripe");
    const stripeSession = opts.stripeSession || latest.stripeSession || null;
    latest = upsertPremiumOrder({
      ...latest,
      status: "paid",
      paymentMethod: requestedPaymentMethod,
      paymentReference,
      toyyibTransaction: tx || latest.toyyibTransaction || undefined,
      toyyibCallback: callbackData || latest.toyyibCallback || undefined,
      stripeSession: stripeSession || latest.stripeSession || undefined,
      stripeCheckoutSessionId: cleanPremiumText((stripeSession && stripeSession.id) || latest.stripeCheckoutSessionId || latest.stripeSessionId || "", 220),
      stripeSessionId: cleanPremiumText((stripeSession && stripeSession.id) || latest.stripeSessionId || latest.stripeCheckoutSessionId || "", 220),
      stripePaymentIntentId: cleanPremiumText((stripeSession && stripeSession.payment_intent) || latest.stripePaymentIntentId || "", 220),
      stripeVerifiedAt: verifiedByStripe ? (latest.stripeVerifiedAt || nowIso) : latest.stripeVerifiedAt || "",
      paidAt,
      paidFinalizedAt: latest.paidFinalizedAt || nowIso,
      toyyibVerifiedAt: verifiedByToyyib ? (latest.toyyibVerifiedAt || nowIso) : latest.toyyibVerifiedAt || "",
      paymentVerifiedAt: verifiedPayment ? (latest.paymentVerifiedAt || nowIso) : latest.paymentVerifiedAt || "",
      paymentVerificationSource: verifiedByStripe ? (opts.verificationSource || "stripe-api") : (verifiedByToyyib ? "toyyibpay-api" : (latest.paymentVerificationSource || "")),
      callbackTrustBypass: opts.callbackTrustBypass || latest.callbackTrustBypass || false
    });

    if (!azIsManualSalesInvoiceOrder(latest) && !latest.commissionCheckedAt) {
      try { await azFinalizeCommissionForOrder(latest); } catch (commissionError) { console.warn("Commission finalize skipped:", commissionError && (commissionError.message || commissionError)); }
      latest = findPremiumOrderByAny({ orderId: latest.orderId, billCode: latest.billCode }) || latest;
    }

    if (!azIsManualSalesInvoiceOrder(latest) && !latest.paBmPaidSyncedAt) {
      try {
        const syncResult = await azobssUpdatePaBmPurchaseLogsForOrder(latest, "paid", { paymentReference: latest.paymentReference, toyyibTransaction: tx, toyyibCallback: callbackData });
        if (syncResult && syncResult.ok) latest = upsertPremiumOrder({ ...latest, paBmPaidSyncedAt: new Date().toISOString(), paBmPaidSyncedCount: syncResult.updated || 0 });
      } catch (syncError) { console.warn("PA/BM purchaseLogs paid sync failed:", syncError && (syncError.message || syncError)); }
    }

    latest = azEnsureSubscriptionActivation(latest);
    if (azIsManualSalesInvoiceOrder(latest)) {
      try {
        const manualSync = await azSyncManualSalesInvoicePaid(latest, { paymentReference:latest.paymentReference, toyyibTransaction:tx, toyyibCallback:callbackData });
        latest = upsertPremiumOrder({ ...latest, manualInvoicePaidSyncedAt:new Date().toISOString(), manualReceiptNo:manualSync && manualSync.receiptNo || latest.manualReceiptNo || "" });
      } catch (manualSyncError) {
        console.error("Manual sales invoice paid sync failed:", manualSyncError && (manualSyncError.stack || manualSyncError.message || manualSyncError));
        throw manualSyncError;
      }
    } else if (!isPaBmPremiumOrder(latest)) {
      latest = await azHydratePremiumOrderExpiryFromCurrentProduct(latest);
      if (!latest.downloadToken) latest = makeDownloadForOrder(latest);
      if (!latest.emailSentAt) {
        await maybeSendDownloadEmail(latest, req);
        latest = findPremiumOrderByAny({ orderId: latest.orderId, billCode: latest.billCode }) || latest;
      }
    } else if (isPublicPaPremiumOrder(latest)) {
      if (!latest.emailSentAt) latest = await maybeSendPublicPaEmail(latest, req);
      latest = findPremiumOrderByAny({ orderId: latest.orderId, billCode: latest.billCode }) || latest;
    } else if (!latest.emailSkippedForPaBm) {
      latest = upsertPremiumOrder({ ...latest, emailSkippedForPaBm: true, emailError: null });
    }

    try {
      const notifResult = await azCreateAdminPaymentNotification(req, latest);
      if (notifResult && notifResult.ok && !latest.adminPaymentNotificationAt) {
        latest = upsertPremiumOrder({ ...latest, adminPaymentNotificationAt: new Date().toISOString(), adminPaymentNotificationId: notifResult.docId || "" });
      }
    } catch (notifError) {
      console.warn("Admin payment notification skipped:", notifError && (notifError.message || notifError));
    }
    return findPremiumOrderByAny({ orderId: latest.orderId, billCode: latest.billCode }) || latest;
  });
}
async function refreshToyyibOrder(order, req) {
  if (!order || !order.billCode) return order;
  try {
    const verify = await azVerifyToyyibPaidTransaction(order);
    if (!verify || !verify.paid) {
      console.warn("ToyyibPay refresh not paid yet:", JSON.stringify({ orderId: order.orderId || "", billCode: order.billCode || "", reason: verify && verify.reason || "not_paid" }).slice(0, 500));
      return order;
    }
    return await azFinalizePaidOrderOnce(order, req, {
      verified: true,
      toyyibTransaction: verify.tx,
      paymentReference: verify.paymentReference || order.paymentReference || ""
    });
  } catch (e) {
    console.error("ToyyibPay refresh failed:", e && (e.message || e));
    return order;
  }
}
function paidPayload(order, req) {
  const base = publicBaseUrlFromReq(req);
  const o = makeDownloadForOrder(order);
  return { ok: true, success: true, paid: true, orderId: o.orderId, status: o.status, downloadUrl: azPreferredPremiumDownloadUrl({ ...o, token:o.downloadToken }, base), receiptUrl: azReceiptUrl(base, o), expiresAt: o.tokenExpiresAt, maxDownload: azobssDownloadLimitFromOrder(o) };
}

// =========================
// SOFTWARE STATS JSON HELPERS
// =========================
const SOFTWARE_STATS_FILE = path.join(__dirname, "backend", "data", "software-stats.json");
function cleanSoftwareId(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "software-item"; }
function normalizeSoftwareStats(raw = {}) {
  const downloads = Math.max(0, Math.round(Number(raw.downloads || 0)));
  const likes = Math.max(0, Math.round(Number(raw.likes || 0)));
  const ratings = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  if (raw.ratings && typeof raw.ratings === "object") {
    for (let star = 1; star <= 5; star += 1) {
      ratings[String(star)] = Math.max(0, Math.round(Number(raw.ratings[String(star)] || 0)));
    }
  } else {
    const oldVotes = Math.max(0, Math.round(Number(raw.ratingVotes || raw.votes || 0)));
    const oldTotal = Math.max(0, Number(raw.ratingTotal || 0));
    const oldAvg = oldVotes ? oldTotal / oldVotes : Math.max(0, Math.min(5, Number(raw.ratingAverage || raw.rating || 0)));
    if (oldVotes > 0 && oldAvg > 0) {
      const bucket = String(Math.max(1, Math.min(5, Math.round(oldAvg))));
      ratings[bucket] = oldVotes;
    }
  }

  const ratedBy = (raw.ratedBy && typeof raw.ratedBy === "object") ? raw.ratedBy : {};
  const cleanRatedBy = {};
  Object.entries(ratedBy).forEach(([voter, value]) => {
    const safeVoter = cleanSoftwareId(voter).slice(0, 160);
    const star = Math.max(1, Math.min(5, Math.round(Number(value || 0))));
    if (safeVoter && star) cleanRatedBy[safeVoter] = star;
  });

  const ratingVotes = ratings["1"] + ratings["2"] + ratings["3"] + ratings["4"] + ratings["5"];
  const ratingTotal = (1 * ratings["1"]) + (2 * ratings["2"]) + (3 * ratings["3"]) + (4 * ratings["4"]) + (5 * ratings["5"]);
  const ratingAverage = ratingVotes ? Math.round((ratingTotal / ratingVotes) * 10) / 10 : 0;

  return { downloads, likes, ratings, ratedBy: cleanRatedBy, ratingTotal, ratingVotes, ratingAverage };
}
function readSoftwareStats() {
  try { if (!fs.existsSync(SOFTWARE_STATS_FILE)) return {}; return JSON.parse(fs.readFileSync(SOFTWARE_STATS_FILE, "utf8")); } catch { return {}; }
}
function writeSoftwareStats(stats) {
  fs.mkdirSync(path.dirname(SOFTWARE_STATS_FILE), { recursive: true });
  fs.writeFileSync(SOFTWARE_STATS_FILE, JSON.stringify(stats || {}, null, 2), "utf8");
}
function softwareStatsPayload(stats) {
  const normalized = {};
  Object.entries(stats || {}).forEach(([key, value]) => normalized[cleanSoftwareId(key)] = normalizeSoftwareStats(value));
  return normalized;
}


function getRatingVoterIdFromBody(req, body) {
  const bodyVoter = cleanSoftwareId(body.voterId || body.userId || body.uid || body.username || body.email || "");
  if (bodyVoter && bodyVoter !== "software-item") return `client_${bodyVoter}`;
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  return "ip_" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
}
let firebaseAdmin = null;
try {
  firebaseAdmin = require("firebase-admin");
} catch (error) {
  firebaseAdmin = null;
}

let firebaseAdminReady = false;
let firebaseAdminInitError = "";
function azobssNormalizePrivateKey(value) {
  return String(value || "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\n/g, "\n")
    .trim();
}
function azobssParseFirebaseServiceAccount() {
  const jsonText = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || process.env.FIREBASE_SERVICE_ACCOUNT
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    || "";

  if (jsonText) {
    const parsed = JSON.parse(jsonText);
    if (parsed.private_key) parsed.private_key = azobssNormalizePrivateKey(parsed.private_key);
    return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = azobssNormalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || "");

  if (projectId && clientEmail && privateKey) {
    return {
      type: "service_account",
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey
    };
  }

  return null;
}
function initFirebaseAdmin() {
  if (!firebaseAdmin) {
    firebaseAdminInitError = "firebase-admin package is not installed.";
    return false;
  }
  if (firebaseAdminReady) return true;

  try {
    if (firebaseAdmin.apps && firebaseAdmin.apps.length) {
      firebaseAdminReady = true;
      return true;
    }

    const serviceAccount = azobssParseFirebaseServiceAccount();
    if (serviceAccount) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount)
      });
      firebaseAdminReady = true;
      console.log("Firebase Admin ready: service account configured.");
      return true;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.applicationDefault()
      });
      firebaseAdminReady = true;
      console.log("Firebase Admin ready: application default credentials.");
      return true;
    }

    firebaseAdminInitError = "Missing Firebase Admin env. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";
  } catch (error) {
    firebaseAdminInitError = error && (error.stack || error.message || String(error)) || "Unknown Firebase Admin init error.";
    console.error("Firebase Admin init failed:", firebaseAdminInitError);
  }

  return false;
}


const AZOBSS_PA_BM_MAX_DOWNLOADS = 5;
const AZOBSS_PA_BM_VALID_MS = 7 * 24 * 60 * 60 * 1000;
function azobssPaidStatus(value) {
  return ["paid", "success", "completed", "settled"].includes(String(value || "").trim().toLowerCase());
}
function azobssPaBmRecordType(record) {
  const raw = String(record && (record.productType || record.product || record.type) || "").trim().toUpperCase();
  const compact = raw.replace(/[\s-]+/g, "_");
  if (["SYIT_PIAWAI", "SYIT_PIAWAI_(GAMBAR)", "SYIT_PIAWAI_GAMBAR"].includes(compact)) return "SYIT_PIAWAI";
  if (["NDCDB_C3", "LOT_KADASTER_BERDIGIT_C3"].includes(compact)) return "NDCDB_C3";
  if (["NDCDB", "LOT_KADASTER_BERDIGIT"].includes(compact)) return "NDCDB";
  return compact;
}
function azobssPaBmRecordCode(record) {
  const value = String(record && (record.itemCode || record.pa || record.noPA || record.stesen || record.stationNo || record.code) || "").trim();
  const type = azobssPaBmRecordType(record);
  return type === "NDCDB" || type === "NDCDB_C3" ? value : value.toUpperCase();
}

// AZOBSS PATCH 696: Show only the specific JUPEM document category in orders and admin payment alerts.
function azobssJupemPurchaseTypeLabel(rawType) {
  const type = azobssPaBmRecordType({ productType: rawType });
  if (type === "PA") return "PA";
  if (type === "BM") return "BM";
  if (type === "SBM") return "SBM";
  if (type === "GPS") return "GPS";
  if (type === "SYIT_PIAWAI") return "Syit Piawai";
  if (type === "NDCDB" || type === "NDCDB_C3") return "Lot Kadaster Berdigit";
  return cleanPremiumText(type || "JUPEM", 60);
}
function azobssJupemPurchaseProductName(items = []) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return "";
  const counts = new Map();
  for (const item of rows) {
    const label = azobssJupemPurchaseTypeLabel(item && (item.productType || item.product || item.type));
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  if (!counts.size) return "";
  const preferredOrder = ["PA", "BM", "SBM", "GPS", "Syit Piawai", "Lot Kadaster Berdigit"];
  const labels = [...counts.keys()].sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi) || a.localeCompare(b);
  });
  const detail = labels.map(label => `${label} (${counts.get(label)} unit)`).join(" + ");
  return cleanPremiumText(detail, 240);
}
function azobssShouldUseSpecificJupemProductName(order = {}) {
  const productId = String(order.productId || (order.product && (order.product.productId || order.product.id)) || "").trim().toLowerCase();
  const productName = String(order.productName || order.productTitle || (order.product && (order.product.name || order.product.title)) || "").trim();
  return productId === "pa-bm-purchase-records" || /^JUPEM Document Purchase(?:\s|\()/i.test(productName) || /^(?:PA|BM|SBM|GPS|Syit Piawai|Lot Kadaster Berdigit)\s*\(\d+\s+unit\)/i.test(productName);
}

function azobssSafeJupemDownloadUrl(rawUrl, productType) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  const type = azobssPaBmRecordType({ productType });
  const allowedPaths = {
    PA: ["/MuatTurunPembelian/MuatTurunPelanAkui"],
    BM: ["/MuatTurunPembelian/MuatTurunStesenTandaAras/"],
    SBM: ["/MuatTurunPembelian/MuatTurunStesenTandaAras/"],
    GPS: ["/MuatTurunPembelian/MuatTurunStesenGPS/"],
    SYIT_PIAWAI: ["/MuatTurunPembelian/MuatTurunLembarPiawai/"],
    NDCDB: ["/MuatTurunPembelian/MuatTurunLotKadasterBerdigitCrop/"],
    NDCDB_C3: ["/MuatTurunPembelian/MuatTurunLotKadasterBerdigitCropc3/"]
  };
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "ebiz.jupem.gov.my") return "";
    const prefixes = allowedPaths[type] || [];
    if (!prefixes.some(prefix => url.pathname.startsWith(prefix))) return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}
function azobssFirestoreMs(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return 0;
}
function azobssRecordPaidAtMs(record) {
  return Number(record.paidAtMs || 0)
    || azobssFirestoreMs(record.paidAt)
    || azobssFirestoreMs(record.paidAtClient)
    || azobssFirestoreMs(record.updatedAt)
    || Number(record.createdAtMs || 0)
    || azobssFirestoreMs(record.createdAtClient)
    || azobssFirestoreMs(record.createdAt)
    || Date.now();
}
function azobssRecordMaxDownloads(record) {
  const max = Number(record.maxDownloads || record.maxDownload || 0);
  return max > 0 ? max : AZOBSS_PA_BM_MAX_DOWNLOADS;
}
function azobssRecordDownloadCount(record) {
  return Math.max(0, Number(record.downloadCount || record.usedCount || 0));
}
function azobssRecordExpiresAtMs(record) {
  const explicit = Number(record.downloadExpiresAtMs || record.expiresAtMs || 0)
    || azobssFirestoreMs(record.downloadExpiresAtClient)
    || azobssFirestoreMs(record.expiresAt);
  return explicit || (azobssRecordPaidAtMs(record) + AZOBSS_PA_BM_VALID_MS);
}

function azobssFirestoreReadRetryable(error) {
  const code = String(error && error.code || "").trim().toLowerCase();
  const message = String(error && (error.message || error.details) || error || "").toLowerCase();
  return ["4", "8", "10", "13", "14", "deadline-exceeded", "resource-exhausted", "aborted", "internal", "unavailable"].includes(code)
    || /deadline|resource.?exhausted|quota|too many requests|unavailable|temporar|econnreset|socket hang up|network|429|500|502|503|504/.test(message);
}

async function azobssFirestoreReadWithRetry(read, label, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !azobssFirestoreReadRetryable(error)) throw error;
      console.warn("PA/BM Firestore read retry:", JSON.stringify({ label, attempt, code:error && error.code || "", message:String(error && error.message || error || "").slice(0, 180) }));
      await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 250 : 750));
    }
  }
  throw lastError || new Error("Firestore read failed");
}

async function azobssGetPurchaseRecord(recordId) {
  if (!initFirebaseAdmin()) {
    throw new Error("Firebase Admin is not configured on backend. " + (firebaseAdminInitError || ""));
  }

  const db = firebaseAdmin.firestore();
  const id = String(recordId || "").trim();
  const ref = db.collection("purchaseLogs").doc(id);

  if (!id) return { ref, record: null };

  // 1) Normal path: purchaseLogs/{recordId}
  const snap = await azobssFirestoreReadWithRetry(() => ref.get(), "purchaseLogs/" + id);
  if (snap.exists) {
    return { ref, record: Object.assign({ firestoreId: snap.id }, snap.data() || {}) };
  }

  // 2) Compatibility path:
  // Older AZOBSS builds saved paid/pending PA-BM records inside users/{username}.purchaseRecords
  // but did not always create purchaseLogs. If Download button sends that embedded id,
  // migrate it into purchaseLogs automatically so 5x/7-day limit can work.
  let found = null;
  let foundUser = null;

  const usersSnap = await azobssFirestoreReadWithRetry(() => db.collection("users").get(), "users embedded purchase fallback");
  usersSnap.forEach((userDoc) => {
    if (found) return;
    const userData = userDoc.data() || {};
    const records = Array.isArray(userData.purchaseRecords) ? userData.purchaseRecords : [];
    for (const r of records) {
      if (!r) continue;
      const ids = [
        r.firestoreId,
        r.purchaseLogId,
        r.id,
        r.recordId,
        r.localId
      ].filter(Boolean).map(v => String(v));
      if (ids.includes(id)) {
        found = Object.assign({}, r);
        foundUser = Object.assign({ firestoreUserId: userDoc.id }, userData);
        break;
      }
    }
  });

  if (!found) {
    console.warn("PA/BM purchase record not found in purchaseLogs or embedded users.purchaseRecords:", id);
    return { ref, record: null };
  }

  const createdAtMs = Number(found.createdAtMs || 0)
    || azobssFirestoreMs(found.createdAtClient)
    || azobssFirestoreMs(found.createdAt)
    || Date.now();

  const resetAtMs = Number(foundUser && foundUser.purchaseTotalResetAtMs || 0)
    || azobssFirestoreMs(foundUser && foundUser.purchaseTotalResetAtClient);

  const status = azobssPaidStatus(found.status)
    ? String(found.status || "paid").toLowerCase()
    : (resetAtMs && createdAtMs && createdAtMs <= resetAtMs ? "paid" : String(found.status || "pending").toLowerCase());

  const paidAtMs = Number(found.paidAtMs || 0)
    || azobssFirestoreMs(found.paidAtClient)
    || azobssFirestoreMs(found.paidAt)
    || (status === "paid" ? (resetAtMs || Date.now()) : 0);

  const migrated = Object.assign({}, found, {
    firestoreId: id,
    id: found.id || id,
    uid: String(found.uid || (foundUser && foundUser.uid) || ""),
    usernameKey: String(found.usernameKey || (foundUser && (foundUser.usernameKey || foundUser.firestoreUserId)) || "").trim().toLowerCase(),
    displayName: String(found.displayName || (foundUser && (foundUser.displayName || foundUser.usernameKey || foundUser.firestoreUserId)) || ""),
    phone: String(found.phone || found.phoneNumber || (foundUser && (foundUser.phone || foundUser.phoneNumber)) || ""),
    email: String(found.email || (foundUser && foundUser.email) || ""),
    status,
    createdAtMs,
    createdAtClient: found.createdAtClient || new Date(createdAtMs).toISOString(),
    paidAtMs: paidAtMs || undefined,
    paidAtClient: paidAtMs ? new Date(paidAtMs).toISOString() : undefined,
    downloadCount: Math.max(0, Number(found.downloadCount || found.usedCount || 0)),
    maxDownloads: azobssRecordMaxDownloads(found),
    downloadExpiresAtMs: Number(found.downloadExpiresAtMs || found.expiresAtMs || 0)
      || azobssFirestoreMs(found.downloadExpiresAtClient)
      || azobssFirestoreMs(found.expiresAt)
      || (paidAtMs ? paidAtMs + AZOBSS_PA_BM_VALID_MS : undefined),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    migratedFromEmbeddedPurchaseRecords: true
  });

  Object.keys(migrated).forEach((key) => {
    if (migrated[key] === undefined) delete migrated[key];
  });

  await ref.set(migrated, { merge: true });
  console.log("PA/BM embedded purchase record migrated to purchaseLogs:", id);

  return { ref, record: Object.assign({ firestoreId: id }, migrated) };
}

async function azobssIncrementPurchaseDownload(ref, record, nowMs) {
  const used = azobssRecordDownloadCount(record);
  const max = azobssRecordMaxDownloads(record);
  await ref.set({
    downloadCount: used + 1,
    usedCount: used + 1,
    downloadsUsed: used + 1,
    maxDownloads: max,
    maxDownload: max,
    downloadExpiresAtMs: azobssRecordExpiresAtMs(record),
    downloadExpiresAtClient: new Date(azobssRecordExpiresAtMs(record)).toISOString(),
    lastDownloadedAtMs: nowMs,
    lastDownloadedAtClient: new Date(nowMs).toISOString(),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function azobssResetPurchaseDownloadCounter(ref, record, adminIdentity = {}, nowMs = Date.now()) {
  if (!ref || !record) return { ok:false, error:"record_missing" };
  const max = azobssRecordMaxDownloads(record) || AZOBSS_PA_BM_MAX_DOWNLOADS;
  const expiresAtMs = nowMs + AZOBSS_PA_BM_VALID_MS;
  const patch = {
    downloadCount: 0,
    usedCount: 0,
    downloadsUsed: 0,
    maxDownloads: max,
    maxDownload: max,
    downloadExpiresAtMs: expiresAtMs,
    downloadExpiresAtClient: new Date(expiresAtMs).toISOString(),
    lastDownloadedAtMs: null,
    lastDownloadedAtClient: "",
    adminDownloadResetAtMs: nowMs,
    adminDownloadResetAtClient: new Date(nowMs).toISOString(),
    adminDownloadResetByUid: cleanPremiumText(adminIdentity.uid || "", 120),
    adminDownloadResetByUsername: cleanPremiumText(adminIdentity.username || adminIdentity.email || "admin", 120),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(patch, { merge:true });
  return { ok:true, downloadCount:0, usedCount:0, maxDownloads:max, downloadExpiresAtMs:expiresAtMs, downloadExpiresAtClient:patch.downloadExpiresAtClient };
}

async function azobssResetEmbeddedPurchaseDownloadCounter(record = {}, adminIdentity = {}, nowMs = Date.now()) {
  // Compatibility only: older builds duplicated PA/BM rows inside users/{username}.purchaseRecords.
  // Update matching embedded rows too, so dashboards that fall back to user profile data also show 0/5.
  try {
    if (!initFirebaseAdmin()) return { ok:false, updated:0, reason:"firebase_admin_not_configured" };
    const db = firebaseAdmin.firestore();
    const uid = String(record.uid || "").trim();
    const usernameKey = String(record.usernameKey || record.displayName || "").trim().toLowerCase();
    const targetIds = [record.firestoreId, record.id, record.purchaseLogId, record.recordId, record.localId].map(v => String(v || "").trim()).filter(Boolean);
    const type = String(record.productType || record.product || "").trim().toUpperCase();
    const code = String(record.itemCode || record.stesen || record.stationNo || record.productId || "").trim().toUpperCase();
    const createdAtMs = Number(record.createdAtMs || 0);
    const max = azobssRecordMaxDownloads(record) || AZOBSS_PA_BM_MAX_DOWNLOADS;
    const expiresAtMs = nowMs + AZOBSS_PA_BM_VALID_MS;

    const refs = new Map();
    if (uid) {
      try {
        const qs = await db.collection("users").where("uid", "==", uid).limit(5).get();
        qs.forEach(doc => refs.set(doc.ref.path, doc.ref));
      } catch (_) {}
    }
    if (usernameKey) refs.set(db.collection("users").doc(usernameKey).path, db.collection("users").doc(usernameKey));

    let updated = 0;
    for (const userRef of refs.values()) {
      const snap = await userRef.get();
      if (!snap.exists) continue;
      const data = snap.data() || {};
      const rows = Array.isArray(data.purchaseRecords) ? data.purchaseRecords : [];
      let changed = false;
      const next = rows.map((row) => {
        if (!row) return row;
        const rowIds = [row.firestoreId, row.id, row.purchaseLogId, row.recordId, row.localId].map(v => String(v || "").trim()).filter(Boolean);
        const idMatch = targetIds.length && rowIds.some(id => targetIds.includes(id));
        const rowType = String(row.productType || row.product || "").trim().toUpperCase();
        const rowCode = String(row.itemCode || row.stesen || row.stationNo || row.productId || "").trim().toUpperCase();
        const rowCreated = Number(row.createdAtMs || 0);
        const fuzzyMatch = !idMatch && type && code && rowType === type && rowCode === code && (!createdAtMs || !rowCreated || Math.abs(rowCreated - createdAtMs) < 5000);
        if (!idMatch && !fuzzyMatch) return row;
        changed = true;
        return Object.assign({}, row, {
          downloadCount: 0,
          usedCount: 0,
          downloadsUsed: 0,
          maxDownloads: max,
          maxDownload: max,
          downloadExpiresAtMs: expiresAtMs,
          downloadExpiresAtClient: new Date(expiresAtMs).toISOString(),
          lastDownloadedAtMs: null,
          lastDownloadedAtClient: "",
          adminDownloadResetAtMs: nowMs,
          adminDownloadResetAtClient: new Date(nowMs).toISOString(),
          adminDownloadResetByUsername: cleanPremiumText(adminIdentity.username || adminIdentity.email || "admin", 120)
        });
      });
      if (changed) {
        await userRef.set({ purchaseRecords: next, purchaseRecordsUpdatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(), updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp() }, { merge:true });
        updated += 1;
      }
    }
    return { ok:true, updated };
  } catch (err) {
    console.warn("PA/BM embedded download counter reset skipped:", err && (err.message || err));
    return { ok:false, updated:0, error:err && err.message ? err.message : String(err) };
  }
}


async function azobssUpdatePaBmPurchaseLogsForOrder(order, status = "pending", extra = {}) {
  if (!order || !Array.isArray(order.paBmItems) || !order.paBmItems.length) return { ok: false, updated: 0, reason: "no_pa_bm_items" };
  if (!initFirebaseAdmin()) {
    console.warn("PA/BM purchaseLogs update skipped: Firebase Admin not configured.", firebaseAdminInitError || "");
    return { ok: false, updated: 0, reason: "firebase_admin_not_configured" };
  }

  const db = firebaseAdmin.firestore();
  const nowMs = Number(extra.nowMs || Date.now());
  const paidAtMs = Number(extra.paidAtMs || nowMs);
  const paid = azobssPaidStatus(status);
  const baseUpdate = {
    paymentOrderId: String(order.orderId || ""),
    orderId: String(order.orderId || ""),
    billCode: String(order.billCode || ""),
    paymentUrl: String(order.paymentUrl || ""),
    paymentMethod: String(order.paymentMethod || "toyyibpay"),
    isAdminTestPayment: order.isAdminTestPayment === true,
    testPayment: order.isAdminTestPayment === true,
    paymentSource: String(order.source || ""),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
  };

  if (status) baseUpdate.status = String(status).toLowerCase();
  if (paid) {
    baseUpdate.paidAtMs = paidAtMs;
    baseUpdate.paidAtClient = new Date(paidAtMs).toISOString();
    baseUpdate.downloadCount = 0;
    baseUpdate.maxDownloads = AZOBSS_PA_BM_MAX_DOWNLOADS;
    baseUpdate.downloadExpiresAtMs = paidAtMs + AZOBSS_PA_BM_VALID_MS;
    baseUpdate.downloadExpiresAtClient = new Date(paidAtMs + AZOBSS_PA_BM_VALID_MS).toISOString();
  }
  if (extra.paymentReference) baseUpdate.paymentReference = String(extra.paymentReference || "");
  if (extra.toyyibCallback) baseUpdate.toyyibCallback = extra.toyyibCallback;
  if (extra.toyyibTransaction) baseUpdate.toyyibTransaction = extra.toyyibTransaction;

  const findPurchaseLogRefs = async (item) => {
    const id = String(item && (item.id || item.firestoreId || item.purchaseLogId || item.recordId) || "").trim();
    if (id && !id.startsWith("local-")) return [db.collection("purchaseLogs").doc(id)];

    const productType = String(item && (item.productType || item.product) || "").trim().toUpperCase();
    const rawItemCode = String(item && (item.itemCode || item.code) || "").trim();
    const itemCode = productType === "NDCDB" || productType === "NDCDB_C3" ? rawItemCode : rawItemCode.toUpperCase();
    if (!itemCode) return [];
    const negeri = String(item && (item.negeri || item.state) || "").trim().toUpperCase();
    const variant = String(item && (item.variant || item.areaSize) || "").trim().toUpperCase();
    const uid = String(order.user && order.user.uid || order.uid || "").trim();
    const usernameKey = String(order.user && (order.user.username || order.user.usernameKey) || order.usernameKey || "").trim().toLowerCase();
    try {
      const snap = await db.collection("purchaseLogs").where("itemCode", "==", itemCode).limit(30).get();
      const matches = [];
      snap.forEach((docSnap) => {
        const x = docSnap.data() || {};
        const xType = String(x.productType || x.product || "").trim().toUpperCase();
        const xNegeri = String(x.negeri || x.state || "").trim().toUpperCase();
        const xVariant = String(x.variant || x.areaSize || "").trim().toUpperCase();
        const xUid = String(x.uid || "").trim();
        const xUsername = String(x.usernameKey || x.username || "").trim().toLowerCase();
        const userOk = (uid && xUid === uid) || (usernameKey && xUsername === usernameKey) || (!uid && !usernameKey);
        const typeOk = !productType || !xType || xType === productType;
        const negeriOk = !negeri || !xNegeri || xNegeri === negeri;
        const variantOk = !variant || !xVariant || xVariant === variant;
        if (userOk && typeOk && negeriOk && variantOk) matches.push(docSnap.ref);
      });
      return matches.slice(0, 1);
    } catch (err) {
      console.warn("PA/BM purchaseLogs fallback lookup failed:", err && (err.message || err));
      return [];
    }
  };

  const preparedItems = [];
  const lookupConcurrency = 8;
  for (let offset = 0; offset < order.paBmItems.length; offset += lookupConcurrency) {
    const chunk = order.paBmItems.slice(offset, offset + lookupConcurrency);
    const preparedChunk = await Promise.all(chunk.map(async (item) => ({
      item,
      refs: await findPurchaseLogRefs(item)
    })));
    preparedItems.push(...preparedChunk);
  }

  const batch = db.batch();
  let updated = 0;
  for (const prepared of preparedItems) {
    const item = prepared.item;
    const refs = prepared.refs;
    const updateProductType = String(item.productType || item.product || "").toUpperCase();
    const updateItemCodeRaw = String(item.itemCode || item.code || "");
    const update = {
      ...baseUpdate,
      productType: updateProductType || undefined,
      itemCode: (updateProductType === "NDCDB" || updateProductType === "NDCDB_C3" ? updateItemCodeRaw : updateItemCodeRaw.toUpperCase()) || undefined,
      negeri: String(item.negeri || item.state || "") || undefined,
      amount: Number(item.amount || 0) || undefined,
      productId: String(item.productId || "") || undefined,
      stationNo: String(item.stationNo || "") || undefined,
      jenis: String(item.jenis || "") || undefined,
      filename: String(item.filename || "") || undefined,
      downloadUrl: azobssSafeJupemDownloadUrl(item.downloadUrl || item.url, item.productType || item.product) || undefined,
      variant: String(item.variant || item.areaSize || "").toUpperCase() || undefined,
      areaRatio: Number(item.areaRatio || 0) > 0 ? Number(item.areaRatio) : undefined
    };
    Object.keys(update).forEach((key) => { if (update[key] === undefined || update[key] === "") delete update[key]; });
    if (!refs.length) {
      const orderUser = order.user || {};
      const createdRef = db.collection("purchaseLogs").doc();
      batch.set(createdRef, {
        ...update,
        uid: String(orderUser.uid || order.uid || ""),
        usernameKey: String(orderUser.username || orderUser.usernameKey || order.usernameKey || "").trim().toLowerCase(),
        displayName: String(orderUser.username || orderUser.usernameKey || order.usernameKey || "").trim(),
        email: String(orderUser.email || order.email || "").trim(),
        phone: String(orderUser.phone || order.phone || "").trim(),
        createdAtMs: Number(item.createdAtMs || nowMs),
        createdAtClient: new Date(Number(item.createdAtMs || nowMs)).toISOString(),
        createdAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        downloadCount: paid ? 0 : Number(item.downloadCount || 0),
        maxDownloads: AZOBSS_PA_BM_MAX_DOWNLOADS
      }, { merge: true });
      updated += 1;
      continue;
    }
    for (const ref of refs) {
      batch.set(ref, update, { merge: true });
      updated += 1;
    }
  }

  if (updated) await batch.commit();

  console.log("PA/BM purchaseLogs order sync:", JSON.stringify({ orderId: order.orderId || "", billCode: order.billCode || "", status, updated }).slice(0, 500));
  return { ok: updated > 0, updated };
}

function azobssPaBmDownloadError(res, status, message) {
  return send(res, status, JSON.stringify({ ok: false, error: message }, null, 2), "application/json");
}

function azobssPaBmDownloadPreparing(res, jobStatus, message) {
  return send(res, 202, JSON.stringify({
    ok: false,
    preparing: true,
    jobStatus: String(jobStatus || "esriJobUnknown"),
    retryAfterMs: 4000,
    error: message || "Backend AZOBSS sedang menyediakan fail ZIP. Muat turun akan dicuba semula secara automatik."
  }, null, 2), "application/json", {
    "Cache-Control": "no-store",
    "Retry-After": "4"
  });
}

function buildUserEmail(usernameKey) {
  return `${usernameKey}@azobss.local`;
}


const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

const AFFILIATE_JSON = path.join(ROOT, "affiliate-products.json");
const TEMP_DIR = path.join(ROOT, "temp");
const AZOBSS_LOT_CACHE_DIR = path.join(TEMP_DIR, "jupem-lot-cache");
const AZOBSS_LOT_CACHE_TTL_MS = Math.max(
  24 * 60 * 60 * 1000,
  Number(process.env.AZOBSS_LOT_CACHE_TTL_MS || 8 * 24 * 60 * 60 * 1000) || 8 * 24 * 60 * 60 * 1000
);
const azobssLotCachePending = new Map();
const azobssLotCacheTasks = new Map();
const DOWNLOAD_TOKENS = new Map();

const PREMIUM_ORDERS_FILE = path.join(ROOT, "premium-orders.json");
const PREMIUM_TOKENS_FILE = path.join(ROOT, "premium-download-tokens.json");
const PREMIUM_DOWNLOAD_SESSIONS_FILE = path.join(ROOT, "premium-download-sessions.json");
const COMMISSION_RECORDS_FILE = path.join(ROOT, "commission-records.json");

function readPremiumJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("Read premium json failed:", file, error.message);
    return fallback;
  }
}

function writePremiumJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Write premium json failed:", file, error.message);
  }
}

function makeId(prefix = "az") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanPremiumText(value, max = 300) {
  return String(value || "").replace(/[<>]/g, "").trim().slice(0, max);
}
function azHtmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[ch]));
}
function azMoneyRm(value) {
  const n = Number(value || 0) || 0;
  return "RM" + n.toFixed(2);
}

function cleanPremiumUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return "";
}

function azIsLocalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return !!email && (email.endsWith("@azobss.local") || email.endsWith(".local"));
}
function azValidEmailLike(value) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function azPickPremiumBuyerEmail(data = {}) {
  const user = (data.user && typeof data.user === "object") ? data.user : {};
  const email = cleanPremiumText(user.email || data.buyerEmail || data.email || data.customerEmail || data.billEmail || "", 180);
  const authEmail = cleanPremiumText(user.authEmail || data.authEmail || user.loginEmail || data.loginEmail || "", 180);
  const contactEmail = cleanPremiumText(user.contactEmail || data.contactEmail || user.realEmail || data.realEmail || user.emailAddress || data.emailAddress || "", 180);

  // Requested AZOBSS priority:
  // 1) Use normal email if it is a real email.
  // 2) If email is an AZOBSS local/login alias, try authEmail.
  // 3) If authEmail is missing/unusable, use contactEmail.
  // Safety: .local addresses are kept only as a last fallback because they cannot receive customer emails.
  if (azValidEmailLike(email) && !azIsLocalEmail(email)) return email;
  if (azIsLocalEmail(email)) {
    if (azValidEmailLike(authEmail) && !azIsLocalEmail(authEmail)) return authEmail;
    if (azValidEmailLike(contactEmail) && !azIsLocalEmail(contactEmail)) return contactEmail;
    if (azValidEmailLike(authEmail)) return authEmail;
    if (azValidEmailLike(contactEmail)) return contactEmail;
    return email;
  }
  if (azValidEmailLike(email)) return email;
  if (azValidEmailLike(authEmail) && !azIsLocalEmail(authEmail)) return authEmail;
  if (azValidEmailLike(contactEmail) && !azIsLocalEmail(contactEmail)) return contactEmail;
  return authEmail || contactEmail || email || "";
}
function azPickPremiumBuyerEmailFromOrder(order = {}) {
  const user = (order.user && typeof order.user === "object") ? order.user : {};
  return azPickPremiumBuyerEmail({
    user,
    buyerEmail: order.buyerEmail,
    email: order.email,
    customerEmail: order.customerEmail,
    billEmail: order.billEmail,
    contactEmail: order.contactEmail || order.receiptBuyerEmail,
    authEmail: order.authEmail
  });
}

function getPremiumUser(data) {
  const user = data.user || {};
  const email = azPickPremiumBuyerEmail(data);
  return {
    uid: cleanPremiumText(user.uid || data.uid, 120),
    username: cleanPremiumText(user.username || user.usernameKey || data.username, 80),
    email: cleanPremiumText(email, 160),
    authEmail: cleanPremiumText(user.authEmail || data.authEmail || user.loginEmail || data.loginEmail || "", 160),
    contactEmail: cleanPremiumText(user.contactEmail || data.contactEmail || user.realEmail || data.realEmail || user.emailAddress || data.emailAddress || "", 160),
    rawEmail: cleanPremiumText(user.email || data.buyerEmail || data.email || data.customerEmail || data.billEmail || "", 160),
    phone: cleanPremiumText(user.phone || data.phone || data.buyerPhone || '01135600723', 40)
  };
}

function azNormalizeUserPriceAdjustment(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-99, Math.min(500, Math.round(n * 100) / 100));
}
function azPriceAdjustmentCategory(value = "software") {
  const key = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["lot","lotkadaster","lotkadasterberdigit","ndcdb","ndcdbc3"].includes(key)) return "lotKadaster";
  if (["pabm","jupem"].includes(key)) return "paBm";
  if (["publicpa","paawam","pelanakui","pelanakuiawam"].includes(key)) return "publicPa";
  if (["cad","cadtools","cadtool"].includes(key)) return "cadTools";
  return "software";
}
function azIdentityPriceAdjustments(identity = {}) {
  const keys = ["paBm","lotKadaster","publicPa","software","cadTools"];
  const out = { paBm:0, lotKadaster:0, publicPa:0, software:0, cadTools:0 };
  const managed = identity.adminPriceAdjustmentOverride === true || String(identity.priceAdjustmentManagedBy || '').toLowerCase() === 'admin';
  const managedMap = identity.adminPriceAdjustmentByCategory && typeof identity.adminPriceAdjustmentByCategory === "object" ? identity.adminPriceAdjustmentByCategory : null;
  const publicMap = identity.priceAdjustmentByCategory && typeof identity.priceAdjustmentByCategory === "object" ? identity.priceAdjustmentByCategory : null;
  const map = managed ? (managedMap || publicMap) : (publicMap || managedMap);
  const direct = {
    paBm: managed ? (identity.adminPaBmPriceAdjustmentPercent ?? identity.paBmPriceAdjustmentPercent) : (identity.paBmPriceAdjustmentPercent ?? identity.adminPaBmPriceAdjustmentPercent),
    lotKadaster: managed ? (identity.adminLotKadasterPriceAdjustmentPercent ?? identity.lotKadasterPriceAdjustmentPercent) : (identity.lotKadasterPriceAdjustmentPercent ?? identity.adminLotKadasterPriceAdjustmentPercent),
    publicPa: managed ? (identity.adminPublicPaPriceAdjustmentPercent ?? identity.publicPaPriceAdjustmentPercent) : (identity.publicPaPriceAdjustmentPercent ?? identity.adminPublicPaPriceAdjustmentPercent),
    software: managed ? (identity.adminSoftwarePriceAdjustmentPercent ?? identity.softwarePriceAdjustmentPercent) : (identity.softwarePriceAdjustmentPercent ?? identity.adminSoftwarePriceAdjustmentPercent),
    cadTools: managed ? (identity.adminCadToolsPriceAdjustmentPercent ?? identity.cadToolsPriceAdjustmentPercent) : (identity.cadToolsPriceAdjustmentPercent ?? identity.adminCadToolsPriceAdjustmentPercent)
  };
  const hasSpecific = !!map || Object.values(direct).some(value => value !== undefined && value !== null && value !== "");
  if (hasSpecific) {
    for (const key of keys) {
      let raw = map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : direct[key];
      if (key === "lotKadaster" && (raw === undefined || raw === null || raw === "")) raw = map && Object.prototype.hasOwnProperty.call(map, "paBm") ? map.paBm : direct.paBm;
      out[key] = azNormalizeUserPriceAdjustment(raw ?? 0);
    }
    return out;
  }
  const legacy = azNormalizeUserPriceAdjustment(managed ? (identity.adminPriceAdjustmentPercent ?? identity.priceAdjustmentPercent ?? 0) : (identity.priceAdjustmentPercent ?? identity.adminPriceAdjustmentPercent ?? 0));
  for (const key of keys) out[key] = legacy;
  return out;
}
function azIdentityPriceAdjustment(identity = {}, category = "software") {
  return azIdentityPriceAdjustments(identity)[azPriceAdjustmentCategory(category)] || 0;
}
function azApplyUserPriceAdjustment(amount, identity = {}, category = "software") {
  const base = Number(amount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const percent = azIdentityPriceAdjustment(identity, category);
  return Math.max(0.01, Math.round((base * (1 + percent / 100) + Number.EPSILON) * 100) / 100);
}
function azTrustedPremiumPriceCategory(trustedResolved = {}, product = {}) {
  const hint = [trustedResolved.trustedSource, product.source, product.productSource, product.category, product.type, product.collection].map(v => String(v || "").toLowerCase()).join(" ");
  return /firestore:cad|staffcad|cadtools|cad-tools|cad tool/.test(hint) ? "cadTools" : "software";
}
function azAdjustedMoneyText(amount) {
  const n = Number(amount || 0);
  return `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function azBuildAdminPaBmTestCheckout(data = {}, identity = {}) {
  const checkoutError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  };
  if (!identity || !identity.uid) checkoutError("Admin login session is not ready.", 401);
  const submittedUser = getPremiumUser(data);
  const user = {
    uid: cleanPremiumText(identity.uid, 120),
    username: cleanPremiumText(identity.username || data.usernameKey || submittedUser.username || "", 80).toLowerCase(),
    email: cleanPremiumText(identity.authEmail || identity.email || submittedUser.email || "", 160),
    authEmail: cleanPremiumText(identity.authEmail || identity.email || "", 160),
    phone: cleanPremiumText(submittedUser.phone || "", 40)
  };
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length || rawItems.length > 50) checkoutError("Cart must contain between 1 and 50 documents.");

  const allowedStates = new Set([
    "JOHOR","KEDAH","KELANTAN","MELAKA","NEGERI SEMBILAN","PAHANG","PERAK","PERLIS",
    "PULAU PINANG","SABAH","SARAWAK","SELANGOR","TERENGGANU",
    "WILAYAH PERSEKUTUAN KUALA LUMPUR","WILAYAH PERSEKUTUAN LABUAN","WILAYAH PERSEKUTUAN PUTRAJAYA"
  ]);
  const allowedProductTypes = new Set(["PA","BM","SBM","GPS","NDCDB","NDCDB_C3","SYIT_PIAWAI"]);
  const areaProductTypes = new Set(["NDCDB","NDCDB_C3"]);
  const seenItems = new Set();
  const items = [];

  for (const rawItem of rawItems) {
    const productType = cleanPremiumText(rawItem.productType || "PA", 20).toUpperCase();
    if (!allowedProductTypes.has(productType)) checkoutError("Unsupported JUPEM document category.");
    const negeri = cleanPremiumText(rawItem.negeri || "", 80).toUpperCase();
    if (!allowedStates.has(negeri)) checkoutError("Please select a valid state for every document.");
    const rawItemCode = cleanPremiumText(rawItem.itemCode || rawItem.stationNo || rawItem.productId || "", 80);
    let itemCode = areaProductTypes.has(productType) ? rawItemCode : rawItemCode.toUpperCase();
    if (productType === "PA") itemCode = itemCode.replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
    if (!itemCode || (productType === "PA" && !/^\d{1,12}$/.test(itemCode))) checkoutError("A valid document number is required for every cart item.");
    let variant = areaProductTypes.has(productType)
      ? cleanPremiumText(rawItem.variant || rawItem.areaSize || "", 30).toUpperCase()
      : "";
    if (areaProductTypes.has(productType) && variant !== "FULL_SHEET" && variant !== "AREA_BASED") {
      checkoutError("Lot Kadaster area pricing is invalid. Open the selection map again.");
    }
    const verifiedLot = areaProductTypes.has(productType)
      ? azobssVerifiedLotCheckout(rawItem, productType, negeri, itemCode)
      : null;
    if (areaProductTypes.has(productType) && !verifiedLot) checkoutError("Lot Kadaster selection is missing or has expired. Open the selection map again.");
    if (verifiedLot) variant = verifiedLot.variant;
    let amount = 0;
    if (productType === "PA") amount = 5;
    else if (productType === "BM" || productType === "SBM") amount = 3;
    else if (productType === "GPS") amount = 9;
    else if (productType === "SYIT_PIAWAI") amount = 7;
    else if (areaProductTypes.has(productType)) amount = verifiedLot.amount;
    const uniqueKey = `${productType}|${itemCode}|${negeri}|${variant}`;
    if (seenItems.has(uniqueKey)) continue;
    seenItems.add(uniqueKey);
    items.push({
      productType,
      itemCode,
      negeri,
      amount,
      variant,
      areaRatio: areaProductTypes.has(productType) ? Number(verifiedLot && verifiedLot.areaRatio || 0) : undefined,
      productId: cleanPremiumText(verifiedLot && verifiedLot.jobId || rawItem.productId || "", 120),
      stationNo: cleanPremiumText(rawItem.stationNo || "", 80).toUpperCase(),
      jenis: productType === "SBM" ? "2" : "1",
      filename: cleanPremiumText(rawItem.filename || "", 180),
      downloadUrl: verifiedLot ? verifiedLot.downloadUrl : azobssSafeJupemDownloadUrl(rawItem.downloadUrl || rawItem.url, productType),
      createdAtMs: Number(rawItem.createdAtMs || 0) || Date.now()
    });
  }

  if (!items.length) checkoutError("No valid JUPEM documents were found in the cart.");
  const totalAmount = Math.round((items.reduce((sum, item) => sum + item.amount, 0) + Number.EPSILON) * 100) / 100;
  if (totalAmount <= 0) checkoutError("Invalid cart total.");
  return { user, items, totalAmount, amountSen: Math.round(totalAmount * 100) };
}


function getAzobssBackendDb() {
  if (!initFirebaseAdmin()) return null;
  return firebaseAdmin.firestore();
}

function azJsonSafe(value) {
  try { return JSON.parse(JSON.stringify(value || {})); } catch (_e) { return value || {}; }
}
function azFireAndForget(promise, label) {
  try {
    if (promise && typeof promise.catch === "function") promise.catch(err => console.warn(label || "AZOBSS async task failed:", err && (err.message || err)));
  } catch (err) {
    console.warn(label || "AZOBSS async task setup failed:", err && (err.message || err));
  }
}

function azPremiumOrderCategoryForBackup(order = {}) {
  const raw = String(order.category || order.productCategory || order.productType || order.type || order.source || "").toLowerCase();
  const productId = String(order.productId || (order.product && (order.product.productId || order.product.id)) || "").toLowerCase();
  const productName = String(order.productName || order.productTitle || (order.product && (order.product.name || order.product.title)) || "").toLowerCase();
  if (raw.includes("cad") || productId.includes("cad") || productName.includes("cad")) return "cad";
  if (raw.includes("pa") || raw.includes("bm") || productId.includes("pa-bm") || Array.isArray(order.paBmItems)) return "pa-bm";
  return "software";
}
function azPremiumOrderStatusForBackup(order = {}) {
  return cleanPremiumText(order.status || order.paymentStatus || "pending", 60).toLowerCase() || "pending";
}
function azPremiumOrderIsPaid(order = {}) {
  return ["paid", "verified", "success", "completed", "settled", "approved", "confirmed"].includes(azPremiumOrderStatusForBackup(order));
}
function azPremiumOrderAmountSenForBackup(order = {}) {
  const sen = Number(order.amountSen || order.billAmount || order.priceSen || 0) || 0;
  if (sen > 0) return Math.round(sen);
  const rm = Number(order.saleAmount || order.amountRm || order.amount || order.price || 0) || 0;
  return Math.max(0, Math.round(rm * 100));
}
function azNormalizePremiumOrderForFirestore(order = {}) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const safe = azJsonSafe(order || {});
  const user = safe.user && typeof safe.user === "object" ? safe.user : {};
  const orderId = cleanPremiumText(safe.orderId || safe.id || "", 160);
  const billCode = cleanPremiumText(safe.billCode || safe.billcode || "", 120);
  const product = safe.product && typeof safe.product === "object" ? safe.product : {};
  const productId = cleanPremiumText(safe.productId || product.productId || product.id || "", 180);
  const productName = cleanPremiumText(safe.productName || safe.productTitle || product.productName || product.name || product.title || productId || "AZOBSS Premium Product", 240);
  const createdAt = cleanPremiumText(safe.createdAt || safe.createdAtClient || "", 140);
  const paidAt = cleanPremiumText(safe.paidAt || safe.verifiedAt || safe.paymentVerifiedAt || "", 140);
  const updatedAt = cleanPremiumText(safe.updatedAt || nowIso, 140) || nowIso;
  const createdAtMs = Number(safe.createdAtMs || Date.parse(createdAt || "") || nowMs) || nowMs;
  const paidAtMs = Number(safe.paidAtMs || Date.parse(paidAt || "") || 0) || 0;
  const updatedAtMs = Number(safe.updatedAtMs || Date.parse(updatedAt || "") || nowMs) || nowMs;
  const amountSen = azPremiumOrderAmountSenForBackup(safe);
  const statusLower = azPremiumOrderStatusForBackup(safe);
  return {
    ...safe,
    orderId,
    billCode,
    billcode: billCode || safe.billcode || "",
    status: statusLower,
    statusLower,
    isPaid: azPremiumOrderIsPaid({ status: statusLower }),
    category: azPremiumOrderCategoryForBackup(safe),
    productId,
    productName,
    amountSen,
    saleAmount: Number(safe.saleAmount || (amountSen ? amountSen / 100 : 0)) || 0,
    username: cleanPremiumText(safe.username || safe.usernameKey || user.username || user.usernameKey || "", 100),
    usernameKey: cleanPremiumText(safe.usernameKey || safe.username || user.usernameKey || user.username || "", 100).toLowerCase(),
    email: cleanPremiumText(safe.email || safe.buyerEmail || user.email || "", 180),
    buyerEmail: cleanPremiumText(safe.buyerEmail || safe.email || user.email || "", 180),
    createdAt: createdAt || new Date(createdAtMs || nowMs).toISOString(),
    createdAtMs,
    paidAt,
    paidAtMs,
    updatedAt: nowIso,
    updatedAtMs: nowMs,
    firestoreBackupVersion: 2,
    firestoreSyncedAt: nowIso,
    firestoreSyncedAtMs: nowMs,
    backupSource: cleanPremiumText(safe.backupSource || "render-premium-orders", 80)
  };
}
function azPremiumOrderFirestoreDocId(order = {}) {
  return cleanPremiumText(order.orderId || order.billCode || order.billcode || "", 180);
}

function azAdminPaymentNotificationCategory(order = {}) {
  const cat = azPremiumOrderCategoryForBackup(order);
  if (cat === "pa-bm") return "pabm";
  if (cat === "cad") return "cad";
  return "software";
}
function azAdminPaymentNotificationAmountRm(order = {}) {
  const sen = azPremiumOrderAmountSenForBackup(order);
  if (sen > 0) return Math.round((sen / 100) * 100) / 100;
  const rm = Number(order.saleAmount || order.amountRm || order.amount || 0) || 0;
  return Math.max(0, Math.round(rm * 100) / 100);
}
function azAdminPaymentNotificationDocId(order = {}) {
  const raw = cleanPremiumText(order.orderId || order.billCode || order.billcode || order.paymentReference || "", 180);
  const key = (raw || makeId("payalert")).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150);
  return `payment_${key || makeId("payalert")}`;
}
function azAdminPaymentNotificationPublic(row = {}, docId = "") {
  const safe = azJsonSafe(row || {});
  return {
    id: cleanPremiumText(docId || safe.id || safe.docId || "", 180),
    docId: cleanPremiumText(docId || safe.docId || safe.id || "", 180),
    type: cleanPremiumText(safe.type || "payment_paid", 80),
    category: cleanPremiumText(safe.category || "software", 60),
    title: cleanPremiumText(safe.title || "Payment received", 180),
    body: cleanPremiumText(safe.body || "", 500),
    status: cleanPremiumText(safe.status || "paid", 60),
    severity: cleanPremiumText(safe.severity || "success", 40),
    read: !!safe.read,
    active: safe.active !== false,
    orderId: cleanPremiumText(safe.orderId || "", 160),
    billCode: cleanPremiumText(safe.billCode || "", 120),
    paymentReference: cleanPremiumText(safe.paymentReference || "", 180),
    productId: cleanPremiumText(safe.productId || "", 180),
    productName: cleanPremiumText(safe.productName || "", 240),
    username: cleanPremiumText(safe.username || "", 100),
    email: cleanPremiumText(safe.email || safe.buyerEmail || "", 180),
    amountRm: Number(safe.amountRm || safe.saleAmount || 0) || 0,
    amountText: cleanPremiumText(safe.amountText || (Number(safe.amountRm || safe.saleAmount || 0) ? `RM${Number(safe.amountRm || safe.saleAmount || 0).toFixed(2)}` : ""), 80),
    targetTab: cleanPremiumText(safe.targetTab || "purchases", 60),
    targetLabel: cleanPremiumText(safe.targetLabel || "Open Payment Logs", 120),
    createdAt: cleanPremiumText(safe.createdAt || "", 140),
    createdAtMs: Number(safe.createdAtMs || 0) || 0,
    readAt: cleanPremiumText(safe.readAt || "", 140),
    readAtMs: Number(safe.readAtMs || 0) || 0,
    source: cleanPremiumText(safe.source || "render-payment-finalize", 80)
  };
}
async function azCreateAdminPaymentNotification(req, order = {}) {
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, reason:"firebase-not-ready" };
  if (!order) return { ok:false, reason:"missing-order" };
  const status = String(order.status || "").toLowerCase();
  if (!azPremiumOrderIsPaid({ status })) return { ok:false, reason:"order-not-paid" };
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const docId = azAdminPaymentNotificationDocId(order);
  const ref = db.collection("adminNotifications").doc(docId);
  const oldSnap = await ref.get();
  const category = azAdminPaymentNotificationCategory(order);
  const amountRm = azAdminPaymentNotificationAmountRm(order);
  const specificJupemName = azobssShouldUseSpecificJupemProductName(order)
    ? azobssJupemPurchaseProductName(order.paBmItems)
    : "";
  const productName = specificJupemName || cleanPremiumText(order.productName || (order.product && (order.product.name || order.product.title)) || "AZOBSS Product", 200);
  if (oldSnap.exists) {
    const username = cleanPremiumText(order.username || order.usernameKey || (order.user && (order.user.username || order.user.usernameKey)) || "", 100);
    const updatePayload = { updatedAt: nowIso, updatedAtMs: nowMs, lastSeenOrderStatus: status, active:true };
    if (specificJupemName) {
      updatePayload.productName = productName;
      updatePayload.body = `${productName}${amountRm ? ` • RM${amountRm.toFixed(2)}` : ""}${username ? ` • ${username}` : ""}`;
    }
    await ref.set(updatePayload, { merge:true });
    return { ok:true, docId, existed:true, created:false };
  }
  const categoryLabel = category === "pabm" ? "PA/BM" : (category === "cad" ? "CAD Tools" : "Software");
  const username = cleanPremiumText(order.username || order.usernameKey || (order.user && (order.user.username || order.user.usernameKey)) || "", 100);
  const email = cleanPremiumText(order.email || order.buyerEmail || (order.user && order.user.email) || "", 180);
  const orderId = cleanPremiumText(order.orderId || "", 160);
  const billCode = cleanPremiumText(order.billCode || order.billcode || "", 120);
  const payload = {
    id: docId,
    type: "payment_paid",
    category,
    title: `New ${categoryLabel} payment paid`,
    body: `${productName}${amountRm ? ` • RM${amountRm.toFixed(2)}` : ""}${username ? ` • ${username}` : ""}`,
    status: "paid",
    severity: "success",
    active: true,
    read: false,
    orderId,
    billCode,
    paymentReference: cleanPremiumText(order.paymentReference || "", 180),
    productId: cleanPremiumText(order.productId || (order.product && (order.product.productId || order.product.id)) || "", 180),
    productName,
    username,
    email,
    buyerEmail: email,
    amountRm,
    saleAmount: amountRm,
    amountText: amountRm ? `RM${amountRm.toFixed(2)}` : cleanPremiumText(order.amount || "", 80),
    targetTab: "purchases",
    targetLabel: "Open Payment Logs",
    source: "render-payment-finalize",
    createdAt: nowIso,
    createdAtMs: nowMs,
    updatedAt: nowIso,
    updatedAtMs: nowMs
  };
  await ref.set(azJsonSafe(payload), { merge:false });
  azFireAndForget(azWriteAdminAuditLog(req, { uid:"system", username:"system", role:"system", isAdmin:true }, "admin_payment_notification_create", "adminNotifications", docId, { category, amountRm, orderId, billCode, productName }, "success"), "Admin payment notification audit log failed");
  return { ok:true, docId, existed:false, created:true };
}
async function azBackfillAdminPaymentNotificationJupemNames(db, records = []) {
  if (!db || !Array.isArray(records) || !records.length) return records;
  for (const row of records) {
    if (!row || String(row.category || "").toLowerCase() !== "pabm") continue;
    if (!azobssShouldUseSpecificJupemProductName(row)) continue;
    const orderId = cleanPremiumText(row.orderId || "", 160);
    if (!orderId) continue;
    try {
      const orderSnap = await db.collection("premiumOrders").doc(orderId).get();
      if (!orderSnap.exists) continue;
      const order = orderSnap.data() || {};
      const specificName = azobssJupemPurchaseProductName(order.paBmItems);
      if (!specificName || specificName === row.productName) continue;
      row.productName = specificName;
      row.body = `${specificName}${Number(row.amountRm || 0) ? ` • RM${Number(row.amountRm).toFixed(2)}` : ""}${row.username ? ` • ${row.username}` : ""}`;
      await db.collection("adminNotifications").doc(row.docId || row.id).set({
        productName: specificName,
        body: row.body,
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now(),
        nameBackfilledBy: "patch-696"
      }, { merge:true });
    } catch (error) {
      console.warn("Admin JUPEM alert name backfill failed:", orderId, error && (error.message || error));
    }
  }
  return records;
}

async function azLoadAdminPaymentNotifications(options = {}) {
  const db = getAzobssBackendDb();
  const limitRows = Math.max(1, Math.min(500, Number(options.limit || 80) || 80));
  const unreadOnly = !!options.unreadOnly;
  if (!db) return { ok:false, error:"Firebase Admin is not configured.", records:[], unreadCount:0, total:0 };
  const records = [];
  let snap;
  try {
    snap = await db.collection("adminNotifications").orderBy("createdAtMs", "desc").limit(limitRows).get();
  } catch (_) {
    snap = await db.collection("adminNotifications").limit(limitRows).get();
  }
  snap.forEach(docSnap => {
    const row = azAdminPaymentNotificationPublic(docSnap.data() || {}, docSnap.id);
    if (row.active === false) return;
    if (unreadOnly && row.read) return;
    records.push(row);
  });
  await azBackfillAdminPaymentNotificationJupemNames(db, records);
  records.sort((a,b)=>(Number(b.createdAtMs||0)-Number(a.createdAtMs||0)));
  const unreadCount = records.filter(x => !x.read).length;
  return { ok:true, records, unreadCount, total:records.length };
}
async function azAdminPaymentNotificationAction(req, identity = {}, body = {}) {
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, error:"Firebase Admin is not configured.", changed:0 };
  const action = cleanPremiumText(body.action || "", 60);
  const id = cleanPremiumText(body.id || body.notificationId || "", 180);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let changed = 0;
  if (action === "mark-read") {
    if (!id) return { ok:false, error:"Missing notification ID.", changed:0 };
    await db.collection("adminNotifications").doc(id).set({ read:true, readAt:nowIso, readAtMs:nowMs, readBy:identity.email || identity.username || "admin", updatedAt:nowIso, updatedAtMs:nowMs }, { merge:true });
    changed = 1;
  } else if (action === "mark-all-read") {
    const snap = await db.collection("adminNotifications").limit(300).get();
    const batch = db.batch();
    snap.forEach(docSnap => { const x = docSnap.data() || {}; if (x.active !== false && !x.read) { batch.set(docSnap.ref, { read:true, readAt:nowIso, readAtMs:nowMs, readBy:identity.email || identity.username || "admin", updatedAt:nowIso, updatedAtMs:nowMs }, { merge:true }); changed += 1; } });
    if (changed) await batch.commit();
  } else if (action === "clear-read") {
    const snap = await db.collection("adminNotifications").limit(300).get();
    const batch = db.batch();
    snap.forEach(docSnap => { const x = docSnap.data() || {}; if (x.read || x.active === false) { batch.delete(docSnap.ref); changed += 1; } });
    if (changed) await batch.commit();
  } else {
    return { ok:false, error:"Unknown admin notification action.", changed:0 };
  }
  azFireAndForget(azWriteAdminAuditLog(req, identity, "admin_payment_notification_" + action.replace(/[^a-z0-9_-]+/gi, "_"), "adminNotifications", id || "bulk", { action, changed }, "success"), "Admin payment notification action audit log failed");
  return { ok:true, action, changed };
}

async function azPersistPremiumOrder(order = {}) {
  if (!order) return { ok:false, reason:"missing-order" };
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, reason:"firebase-not-ready" };
  const safe = azNormalizePremiumOrderForFirestore(order);
  const docId = azPremiumOrderFirestoreDocId(safe);
  if (!docId) return { ok:false, reason:"missing-order-id-or-bill-code" };
  await db.collection("premiumOrders").doc(String(docId)).set(safe, { merge:true });
  return { ok:true, docId, orderId:safe.orderId || "", billCode:safe.billCode || "" };
}
async function azFindPremiumOrderPersistent(ref = {}) {
  const db = getAzobssBackendDb();
  if (!db) return null;
  const orderId = cleanPremiumText(ref.orderId || "", 160);
  const billCode = cleanPremiumText(ref.billCode || ref.billcode || "", 120);
  if (orderId) {
    const snap = await db.collection("premiumOrders").doc(orderId).get();
    if (snap.exists) return snap.data() || null;
  }
  if (billCode) {
    const q = await db.collection("premiumOrders").where("billCode", "==", billCode).limit(1).get();
    if (!q.empty) return q.docs[0].data() || null;
  }
  return null;
}

async function azSyncLocalPremiumOrdersToFirestore(options = {}) {
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, error:"Firebase Admin is not configured.", processed:0, changed:0, skipped:0, samples:[] };
  const limitRows = Math.max(1, Math.min(1000, Number(options.limit || 500) || 500));
  const local = (readPremiumOrders() || []).slice(0, limitRows);
  const out = { ok:true, direction:"local-json-to-firestore", processed:0, changed:0, skipped:0, errors:[], samples:[] };
  for (const row of local) {
    out.processed += 1;
    try {
      const safe = azNormalizePremiumOrderForFirestore({ ...row, backupSource:"local-json-sync" });
      const docId = azPremiumOrderFirestoreDocId(safe);
      if (!docId) { out.skipped += 1; continue; }
      await db.collection("premiumOrders").doc(docId).set(safe, { merge:true });
      out.changed += 1;
      if (out.samples.length < 20) out.samples.push({ orderId:safe.orderId || "", billCode:safe.billCode || "", productName:safe.productName || "", status:safe.status || "", change:"synced to Firestore" });
    } catch (err) {
      out.errors.push(err && err.message ? err.message : String(err));
    }
  }
  if (out.errors.length) out.ok = false;
  return out;
}
async function azHydrateLocalPremiumOrdersFromFirestore(options = {}) {
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, error:"Firebase Admin is not configured.", processed:0, changed:0, skipped:0, samples:[] };
  const limitRows = Math.max(1, Math.min(1000, Number(options.limit || 500) || 500));
  const out = { ok:true, direction:"firestore-to-local-json", processed:0, changed:0, skipped:0, errors:[], samples:[] };
  let snap;
  try { snap = await db.collection("premiumOrders").orderBy("updatedAtMs", "desc").limit(limitRows).get(); }
  catch (_) { snap = await db.collection("premiumOrders").limit(limitRows).get(); }
  const local = readPremiumOrders() || [];
  const merged = local.slice();
  const index = new Map();
  merged.forEach((row, idx) => {
    const key = azPremiumOrderMergeKey(row, row && (row.docId || row.id));
    if (key) index.set(key, idx);
  });
  for (const docSnap of snap.docs) {
    out.processed += 1;
    try {
      const row = { docId:docSnap.id, ...(docSnap.data() || {}), backupSource:"firestore-hydrate" };
      const key = azPremiumOrderMergeKey(row, docSnap.id);
      if (!key) { out.skipped += 1; continue; }
      if (index.has(key)) {
        const idx = index.get(key);
        merged[idx] = { ...(merged[idx] || {}), ...row, updatedAt: row.updatedAt || (merged[idx] && merged[idx].updatedAt) || new Date().toISOString() };
      } else {
        merged.unshift(row);
        index.set(key, 0);
      }
      out.changed += 1;
      if (out.samples.length < 20) out.samples.push({ orderId:cleanPremiumText(row.orderId || docSnap.id, 160), billCode:cleanPremiumText(row.billCode || "", 120), productName:cleanPremiumText(row.productName || "", 120), change:"hydrated local JSON" });
    } catch (err) {
      out.errors.push(err && err.message ? err.message : String(err));
    }
  }
  merged.sort((a, b) => azPremiumOrderSortMs(b) - azPremiumOrderSortMs(a));
  writePremiumOrders(merged);
  if (out.errors.length) out.ok = false;
  return out;
}
async function azPersistPremiumToken(tokenData = {}) {
  if (!tokenData || !tokenData.token) return { ok:false, reason:"missing-token" };
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, reason:"firebase-not-ready" };
  const safe = azJsonSafe({ ...tokenData, updatedAt: new Date().toISOString() });
  await db.collection("premiumDownloadTokens").doc(String(tokenData.token)).set(safe, { merge:true });
  return { ok:true };
}
async function azFindPremiumTokenPersistent(token) {
  const db = getAzobssBackendDb();
  if (!db || !token) return null;
  const snap = await db.collection("premiumDownloadTokens").doc(String(token)).get();
  return snap.exists ? (snap.data() || null) : null;
}
async function azUpdatePremiumTokenPersistent(token, patch = {}) {
  const db = getAzobssBackendDb();
  if (!db || !token) return null;
  const ref = db.collection("premiumDownloadTokens").doc(String(token));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const next = { ...(snap.data() || {}), ...(patch || {}), updatedAt: new Date().toISOString() };
  await ref.set(azJsonSafe(next), { merge:true });
  return next;
}
async function azFindReceiptOrder(orderId) {
  const cleanId = cleanPremiumText(orderId || "", 160);
  if (!cleanId) return null;
  let order = findPremiumOrderByAny({ orderId: cleanId });
  if (order) return order;
  try { order = await azFindPremiumOrderPersistent({ orderId: cleanId }); } catch (err) { console.warn("Receipt premiumOrders lookup failed:", err && (err.message || err)); }
  if (order) return order;

  // Fallback: rebuild a receipt from commissionRecords so receipt remains available even after Render restarts.
  try {
    const db = getAzobssBackendDb();
    if (db) {
      const q = await db.collection("commissionRecords").where("orderId", "==", cleanId).limit(5).get();
      if (!q.empty) {
        const rows = q.docs.map(d => d.data() || {});
        const x = rows[0] || {};
        const saleAmount = Number(x.saleAmount || 0) || Number(x.amount || 0) || 0;
        return {
          orderId: cleanId,
          status: x.paymentStatus || "paid",
          productName: x.productName || "AZOBSS Digital Product",
          amount: x.saleAmountText || (saleAmount ? azCommissionAmountText(saleAmount) : x.amountText || "-"),
          paymentMethod: x.paymentMethod || "toyyibpay",
          paymentReference: x.paymentReference || x.billCode || "-",
          billCode: x.billCode || "",
          user: { username: x.buyerUsername || "-", email: x.buyerEmail || "-" },
          paidAt: x.createdAt || new Date(Number(x.createdAtMs || Date.now())).toISOString(),
          createdAt: x.createdAt || new Date(Number(x.createdAtMs || Date.now())).toISOString(),
          receiptFromCommission: true
        };
      }
    }
  } catch (err) { console.warn("Receipt commissionRecords lookup failed:", err && (err.message || err)); }

  const localRows = readPremiumJson(COMMISSION_RECORDS_FILE, []);
  const x = Array.isArray(localRows) ? localRows.find(r => String(r.orderId || "") === cleanId) : null;
  if (x) {
    const saleAmount = Number(x.saleAmount || 0) || Number(x.amount || 0) || 0;
    return {
      orderId: cleanId,
      status: x.paymentStatus || "paid",
      productName: x.productName || "AZOBSS Digital Product",
      amount: x.saleAmountText || (saleAmount ? azCommissionAmountText(saleAmount) : x.amountText || "-"),
      paymentMethod: x.paymentMethod || "toyyibpay",
      paymentReference: x.paymentReference || x.billCode || "-",
      billCode: x.billCode || "",
      user: { username: x.buyerUsername || "-", email: x.buyerEmail || "-" },
      paidAt: x.createdAt || new Date(Number(x.createdAtMs || Date.now())).toISOString(),
      createdAt: x.createdAt || new Date(Number(x.createdAtMs || Date.now())).toISOString(),
      receiptFromCommission: true
    };
  }
  return null;
}
function azCommissionUsername(v){ return String(v || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 80); }
function azCommissionMoney(v){ const m = String(v || '').replace(/,/g,'').match(/[0-9]+(?:\.[0-9]{1,2})?/); return m ? Number(m[0]) : 0; }
function azCommissionAmountText(n){ return 'RM' + Number(n || 0).toFixed(2); }
function azCleanOwnerField(v, max=160){ return cleanPremiumText(v, max); }
function azProductOwnerFrom(product = {}, order = {}){
  const p = product || order.product || {};
  const ownerUsername = azCommissionUsername(p.ownerUsername || p.createdByUsername || p.staffUsername || p.sellerUsername || order.ownerUsername || '');
  const ownerUid = azCleanOwnerField(p.ownerUid || p.createdByUid || p.staffUid || p.sellerUid || order.ownerUid || '', 140);
  const ownerEmail = azCleanOwnerField(p.ownerEmail || p.createdByEmail || p.staffEmail || p.sellerEmail || order.ownerEmail || '', 180);
  const ownerKey = azCleanOwnerField(p.ownerKey || p.createdByKey || p.staffOwnerKey || p.sellerKey || ownerUsername || ownerUid || ownerEmail || '', 180);
  const ownerRole = azCleanOwnerField(p.ownerRole || p.createdByRole || p.staffRole || p.role || order.ownerRole || order.createdByRole || '', 40);
  const adminNames = new Set(['zedan91','admin','azobss']);
  const isAdminOwner = !ownerUsername || adminNames.has(ownerUsername) || (/admin/i.test(ownerRole) && !/semi/i.test(ownerRole));
  return { ownerUsername, ownerUid, ownerEmail, ownerKey, ownerRole, isAdminOwner };
}
function azOwnerRoleIsSemiAdmin(role=''){
  // AZOBSS PATCH 400: only dropdown role value semiAdmin gets 90%; staff remains old rate.
  const r = String(role || '').toLowerCase().replace(/[\s_-]+/g, '');
  return r === 'semiadmin';
}
function azCommissionOwnerRateForProduct(product = {}, owner = {}, order = {}){
  const raw = Number(product.ownerShare ?? product.commissionRate ?? product.rate ?? order.ownerShare ?? order.commissionRate ?? 0) || 0;
  if (raw > 0) return Math.max(0, Math.min(100, raw));
  return azOwnerRoleIsSemiAdmin(owner.ownerRole) ? 90 : 70;
}
function azCommissionOwnerPolicyText(rate){
  const r = Number(rate || 0) || 0;
  const az = Math.max(0, 100 - r);
  return `${r}% owner / ${az}% AZOBSS`;
}

function azReferralFromUrl(value = '', product = {}, order = {}){
  try{
    const rawUrl = String(value || '').trim();
    if(!rawUrl) return null;
    const u = /^https?:\/\//i.test(rawUrl) ? new URL(rawUrl) : new URL(rawUrl, 'https://www.azobss.com');
    const ref = azCommissionUsername(u.searchParams.get('r') || u.searchParams.get('ref') || u.searchParams.get('staff') || u.searchParams.get('staffRef') || u.searchParams.get('affiliate') || '');
    if(!ref) return null;
    return {
      username: ref,
      productId: cleanPremiumText(u.searchParams.get('p') || u.searchParams.get('product') || product.id || product.productId || order.productId || '', 160),
      sourcePage: /cad-tools/i.test(u.pathname) ? 'CAD Tools' : 'Software',
      openedAt: '',
      source: 'return-url-ref'
    };
  }catch(_e){ return null; }
}
function azReferralFrom(data = {}, product = {}, order = {}){
  const raw = data.staffReferral || data.staffRef || data.ref || product.staffReferral || product.staffRef || product.ref || order.staffReferral || order.shareReferral || {};
  if (typeof raw === 'string') return { username: azCommissionUsername(raw), productId: cleanPremiumText(product.id || order.productId || '', 160), source: 'link' };
  const normalized = {
    username: azCommissionUsername(raw.username || raw.ref || raw.staffUsername || raw.usernameKey || ''),
    productId: cleanPremiumText(raw.productId || product.id || product.productId || order.productId || '', 160),
    sourcePage: cleanPremiumText(raw.sourcePage || raw.source || '', 40),
    openedAt: cleanPremiumText(raw.openedAt || raw.at || '', 80),
    source: cleanPremiumText(raw.source || 'share-link', 60)
  };
  if(normalized.username) return normalized;
  return azReferralFromUrl(data.returnUrl || data.pageUrl || data.sourceUrl || product.pageUrl || order.returnUrl || order.pageUrl || order.sourceUrl || '', product, order) || normalized;
}
function azBuildCommissionLines(order = {}){
  const product = order.product || {};
  const owner = azProductOwnerFrom(product, order);
  const referral = azReferralFrom({}, product, order);
  const buyer = azCommissionUsername(order.user?.username || order.username || '');
  const saleAmount = Number(order.amountSen || 0) > 0 ? Number(order.amountSen) / 100 : azCommissionMoney(order.amount || product.price);
  if (!saleAmount) return [];
  const productId = cleanPremiumText(order.productId || product.id || product.productId || '', 160);
  const productName = cleanPremiumText(order.productName || product.name || '', 180);
  const ownerDirectRate = azCommissionOwnerRateForProduct(product, owner, order);
  const ownerDirectAzRate = Math.max(0, 100 - ownerDirectRate);
  const ownerDirectPolicy = azCommissionOwnerPolicyText(ownerDirectRate);
  const base = {
    orderId: order.orderId || '', billCode: order.billCode || '', productId, productName,
    saleAmount, saleAmountText: azCommissionAmountText(saleAmount), buyerUsername: buyer,
    buyerEmail: cleanPremiumText(order.user?.email || '', 180), paymentStatus: order.status || 'paid',
    paymentMethod: order.paymentMethod || '', paymentReference: order.paymentReference || '',
    createdAt: new Date().toISOString(), createdAtMs: Date.now(), status: 'pending', payoutStatus: 'pending',
    source: 'software-cad-auto-commission',
    ownerRole: owner.ownerRole || product.ownerRole || product.createdByRole || '',
    ownerShare: ownerDirectRate,
    platformShare: ownerDirectAzRate,
    commissionPolicy: ownerDirectPolicy
  };
  const lines = [];
  const sharer = referral.username;
  const ownerName = owner.ownerUsername;
  const hasStaffOwner = !!(ownerName && !owner.isAdminOwner);
  const validSharer = !!(sharer && sharer !== buyer && (!ownerName || sharer !== ownerName));
  function add(kind, username, uid, email, rate, note, opts = {}){
    if(!username || !rate) return;
    const amount = Math.round((saleAmount * rate / 100) * 100) / 100;
    const azRate = opts.azobssShareRate != null ? Math.max(0, Number(opts.azobssShareRate || 0)) : Math.max(0, 100 - Number(rate || 0));
    const azobssShareAmount = Math.round((saleAmount * azRate / 100) * 100) / 100;
    const line = { ...base, commissionType: kind, username, uid: uid || '', ownerUid: uid || '', ownerUsername: username, ownerEmail: email || '', commissionRate: rate, rate, commissionAmount: amount, amount, amountText: azCommissionAmountText(amount), azobssShareRate: azRate, azobssShareAmount, azobssShareText: azCommissionAmountText(azobssShareAmount), ownerShareAmount: String(kind).includes('share') ? 0 : amount, sharerShareAmount: String(kind).includes('share') ? amount : 0, note, shareReferral: referral, productOwner: owner };
    lines.push(line);
  }
  if (hasStaffOwner && validSharer) {
    const semiOwner = ownerDirectRate >= 90;
    const sharerRate = semiOwner ? 4 : 10;
    const ownerSplitRate = semiOwner ? 90 : 60;
    const splitAzRate = Math.max(0, 100 - ownerSplitRate - sharerRate);
    const splitNote = semiOwner
      ? 'Produk semi-admin terjual melalui share link staff lain. Semi-admin owner 90%, sharer 4%, AZOBSS 6%.'
      : 'Produk staff terjual melalui share link staff lain. Owner 60%, sharer 10%, AZOBSS 30%.';
    const shareNote = semiOwner
      ? 'Staff share link berjaya menjual produk semi-admin. Sharer 4%, AZOBSS 6%.'
      : 'Staff share link berjaya menjual produk staff lain. Sharer 10%.';
    add('owner_sale_split', ownerName, owner.ownerUid, owner.ownerEmail, ownerSplitRate, splitNote, { azobssShareRate: splitAzRate });
    add('share_referral', sharer, '', '', sharerRate, shareNote, { azobssShareRate: splitAzRate });
  } else if (hasStaffOwner) {
    add('owner_sale', ownerName, owner.ownerUid, owner.ownerEmail, ownerDirectRate, `Produk owner terjual. ${ownerDirectPolicy}.`);
  } else if (validSharer) {
    add('admin_product_share_referral', sharer, '', '', 20, 'Staff share link berjaya menjual produk admin/AZOBSS. Sharer 20%, AZOBSS 80%.');
  }
  return lines;
}
async function azSaveCommissionLinesForOrder(order = {}){
  try{
    if (!order || order.status !== 'paid') return { ok:false, skipped:true, reason:'order-not-paid' };
    const lines = azBuildCommissionLines(order);
    if (!lines.length) return { ok:true, skipped:true, reason:'no-staff-commission' };
    const db = getAzobssBackendDb();
    if (db) {
      for (const line of lines) {
        const idBase = `${line.orderId || line.billCode || Date.now()}_${line.commissionType}_${line.username}`.replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,180);
        await db.collection('commissionRecords').doc(idBase).set(line, { merge: true });
      }
      return { ok:true, storage:'firestore', count:lines.length };
    }
    const all = readPremiumJson(COMMISSION_RECORDS_FILE, []);
    for (const line of lines) {
      const key = `${line.orderId || line.billCode}_${line.commissionType}_${line.username}`;
      if (!all.some(x => `${x.orderId || x.billCode}_${x.commissionType}_${x.username}` === key)) all.unshift(line);
    }
    writePremiumJson(COMMISSION_RECORDS_FILE, all.slice(0, 5000));
    return { ok:true, storage:'json', count:lines.length };
  }catch(err){
    console.warn('AZOBSS commission record failed:', err && err.message ? err.message : err);
    return { ok:false, error:err && err.message ? err.message : String(err) };
  }
}
async function azFinalizeCommissionForOrder(order = {}){
  const result = await azSaveCommissionLinesForOrder(order);
  try{
    if(order && (order.orderId || order.billCode)){
      upsertPremiumOrder({ ...order, commissionResult: result, commissionCheckedAt: new Date().toISOString(), commissionStorage: result && result.storage ? result.storage : '' });
    }
  }catch(_e){}
  return result;
}

function savePremiumOrder(order) {
  if (!order || !order.orderId) return;
  upsertPremiumOrder(order);
}

function savePremiumToken(tokenData) {
  const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []);
  const now = Date.now();
  const active = tokens.filter(t => t.token !== tokenData.token && Number(t.expiresAt || 0) > now && Number(t.usedCount || 0) < Number(t.maxDownload || 3));
  active.unshift(tokenData);
  writePremiumJson(PREMIUM_TOKENS_FILE, active.slice(0, 200));
  azFireAndForget(azPersistPremiumToken(tokenData), "AZOBSS premium token Firestore persist failed:");
}

function findPremiumToken(token) {
  const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []);
  return tokens.find(t => t.token === token);
}

function updatePremiumToken(token, updater) {
  const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []);
  const index = tokens.findIndex(t => t.token === token);
  if (index >= 0) {
    tokens[index] = updater(tokens[index]);
    writePremiumJson(PREMIUM_TOKENS_FILE, tokens);
  }
  return index >= 0 ? tokens[index] : null;
}


// AZOBSS PATCH 378: Keep My Purchases download status in sync with real secure token usage.
// The customer purchase card is based on premiumOrders, while the secure download route updates premiumDownloadTokens.
// Sync the used/max/expired fields back to premiumOrders whenever a real download session is created or reused.
function azPremiumDownloadUsagePatch(saved = {}, token = "", used = 0, sessionId = "", sessionExpiresAt = 0, now = Date.now()) {
  const max = Math.max(1, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1);
  const tokenExpiresAtMs = Number(saved.expiresAt || saved.expiresAtMs || 0) || 0;
  const expiredByTime = !!(tokenExpiresAtMs && tokenExpiresAtMs <= now && !azobssOrderNeverExpire(saved));
  const exhausted = Number(used || 0) >= max;
  return {
    orderId: cleanPremiumText(saved.orderId || "", 180),
    billCode: cleanPremiumText(saved.billCode || saved.billcode || "", 120),
    productId: cleanPremiumText(saved.productId || "", 180),
    productName: cleanPremiumText(saved.productName || "AZOBSS Digital Product", 240),
    downloadToken: cleanPremiumText(token || saved.downloadToken || saved.token || "", 220),
    tokenExpiresAt: tokenExpiresAtMs ? new Date(tokenExpiresAtMs).toISOString() : (saved.tokenExpiresAt || saved.expiresAtIso || ""),
    tokenExpiresAtMs,
    downloadExpiresAtMs: tokenExpiresAtMs,
    downloadExpiresAtClient: tokenExpiresAtMs ? new Date(tokenExpiresAtMs).toISOString() : "",
    downloadCount: Math.max(0, Number(used || 0) || 0),
    usedCount: Math.max(0, Number(used || 0) || 0),
    downloadsUsed: Math.max(0, Number(used || 0) || 0),
    maxDownload: max,
    maxDownloads: max,
    downloadLimit: max,
    downloadExpired: expiredByTime || exhausted,
    downloadActive: !(expiredByTime || exhausted),
    downloadStatus: exhausted ? "used" : (expiredByTime ? "expired" : "active"),
    activeDownloadSessionId: cleanPremiumText(sessionId || saved.activeDownloadSessionId || "", 160),
    activeDownloadSessionExpiresAt: Number(sessionExpiresAt || saved.activeDownloadSessionExpiresAt || 0) || 0,
    lastDownloadedAt: new Date(now).toISOString(),
    lastDownloadedAtMs: now,
    lastDownloadUsageSyncAt: new Date(now).toISOString(),
    lastDownloadUsageSyncAtMs: now,
    secureDownloadPatch: AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH,
    azobssPatch378: true
  };
}
function azSyncPremiumOrderDownloadUsage(saved = {}, token = "", used = 0, sessionId = "", sessionExpiresAt = 0, now = Date.now()) {
  try {
    if (!saved || !(saved.orderId || saved.billCode || saved.billcode)) return null;
    const patch = azPremiumDownloadUsagePatch(saved, token, used, sessionId, sessionExpiresAt, now);
    const merged = upsertPremiumOrder({ ...(saved || {}), ...(patch || {}) });
    return merged;
  } catch (err) {
    console.warn("AZOBSS premium order download usage sync failed:", err && (err.message || err));
    return null;
  }
}


// AZOBSS PATCH 373: Secure premium download session stream.
// Goal: IDM/browser must never receive the real premium file URL.
// A one-time token creates ONE short-lived backend session; Range/resume requests are allowed only inside that session.
const AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH = "AZOBSS_SECURE_PREMIUM_DOWNLOAD_IDM_HANDOFF_20260626";
function azPremiumSessionTtlMs() {
  const n = Number(process.env.AZOBSS_DOWNLOAD_SESSION_TTL_MS || process.env.AZOBSS_DOWNLOAD_SESSION_TTL || 15 * 60 * 1000);
  return Number.isFinite(n) && n >= 60 * 1000 ? Math.min(n, 6 * 60 * 60 * 1000) : 15 * 60 * 1000;
}
function azSecureDownloadSecret() {
  return String(
    process.env.AZOBSS_DOWNLOAD_HASH_SECRET ||
    process.env.AZOBSS_RECEIPT_SECRET ||
    process.env.AZOBSS_ADMIN_API_SECRET ||
    process.env.ADMIN_KEY ||
    process.env.TOYYIB_SECRET_KEY ||
    "azobss-secure-download-fallback-change-this-secret"
  );
}
function azHashDownloadValue(value = "") {
  return crypto.createHmac("sha256", azSecureDownloadSecret()).update(String(value || "")).digest("hex");
}
function azPremiumClientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.socket && req.socket.remoteAddress || "unknown");
}
function azPremiumClientKey(req) {
  // Audit-only client key. Do not hard-block session by User-Agent/IP here.
  // IDM often starts after the browser request and can present different headers/proxy behavior.
  return azHashDownloadValue(azPremiumClientIp(req));
}
function azSafeDownloadFilename(value = "azobss-download.bin") {
  const raw = String(value || "azobss-download.bin").trim() || "azobss-download.bin";
  return raw.replace(/[\\/:*?"<>|\r\n\t]/g, "_").replace(/\s+/g, " ").slice(0, 180) || "azobss-download.bin";
}
function azPremiumDownloadSource(saved = {}) {
  return cleanPremiumUrl(
    saved.privateFileUrl || saved.sourceFileUrl || saved.downloadLink || saved.premiumDownloadFileLink ||
    saved.secureDownloadLink || saved.privateDownloadLink || saved.downloadUrl || saved.url || ""
  );
}
function azPremiumDownloadFilename(saved = {}, source = "") {
  try {
    const direct = saved.filename || saved.fileName || saved.productFilename || saved.softwareFilename || saved.productName || "";
    if (direct) {
      const ext = path.extname(String(direct));
      if (ext) return azSafeDownloadFilename(direct);
      const srcExt = path.extname(new URL(source).pathname || "");
      return azSafeDownloadFilename(srcExt ? `${direct}${srcExt}` : direct);
    }
  } catch (_) {}
  try {
    const u = new URL(source);
    const base = decodeURIComponent(path.basename(u.pathname || ""));
    if (base) return azSafeDownloadFilename(base);
  } catch (_) {}
  return azSafeDownloadFilename("azobss-download.bin");
}
function azPremiumAllowedDownloadHost(hostname = "") {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  if (host === "::1" || host === "[::1]") return false;
  const rawAllow = String(process.env.AZOBSS_PREMIUM_ALLOWED_FILE_HOSTS || "").trim();
  if (!rawAllow) return true; // Backward compatible: allow public HTTPS hosts unless admin locks this in Render ENV.
  const allowed = rawAllow.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  return allowed.includes("*") || allowed.some(rule => host === rule || (rule.startsWith("*.") && host.endsWith(rule.slice(1))));
}
function azValidatePremiumSource(source = "") {
  const target = cleanPremiumUrl(source);
  if (!target) throw Object.assign(new Error("Premium file URL is missing."), { statusCode: 404 });
  if (target.startsWith("/")) return { type: "local", target };
  const u = new URL(target);
  if (u.protocol !== "https:") throw Object.assign(new Error("Premium file source must use HTTPS."), { statusCode: 403 });
  if (!azPremiumAllowedDownloadHost(u.hostname)) throw Object.assign(new Error("Premium file source host is not allowed."), { statusCode: 403 });
  return { type: "remote", target: u.toString() };
}
function readPremiumDownloadSessions() {
  const now = Date.now();
  const rows = readPremiumJson(PREMIUM_DOWNLOAD_SESSIONS_FILE, []);
  return (Array.isArray(rows) ? rows : []).filter(x => Number(x.expiresAt || 0) > now - 60 * 60 * 1000).slice(0, 500);
}
function writePremiumDownloadSessions(rows) {
  writePremiumJson(PREMIUM_DOWNLOAD_SESSIONS_FILE, (rows || []).slice(0, 500));
}
function findPremiumDownloadSession(sessionId) {
  return readPremiumDownloadSessions().find(x => x && x.sessionId === sessionId) || null;
}
function savePremiumDownloadSession(session = {}) {
  const rows = readPremiumDownloadSessions().filter(x => x.sessionId !== session.sessionId);
  rows.unshift(session);
  writePremiumDownloadSessions(rows);
  azFireAndForget(azPersistPremiumDownloadSession(session), "AZOBSS premium download session Firestore persist failed:");
  return session;
}
function updatePremiumDownloadSession(sessionId, patch = {}) {
  const rows = readPremiumDownloadSessions();
  const idx = rows.findIndex(x => x.sessionId === sessionId);
  if (idx >= 0) {
    rows[idx] = { ...(rows[idx] || {}), ...(patch || {}), updatedAt: new Date().toISOString(), updatedAtMs: Date.now() };
    writePremiumDownloadSessions(rows);
    azFireAndForget(azUpdatePremiumDownloadSessionPersistent(sessionId, patch), "AZOBSS premium download session Firestore update failed:");
    return rows[idx];
  }
  return null;
}
async function azPersistPremiumDownloadSession(session = {}) {
  const db = getAzobssBackendDb();
  if (!db || !session || !session.sessionId) return { ok:false };
  await db.collection("premiumDownloadSessions").doc(String(session.sessionId)).set(azJsonSafe({ ...session, updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }), { merge:true });
  return { ok:true };
}
async function azFindPremiumDownloadSessionPersistent(sessionId) {
  const db = getAzobssBackendDb();
  if (!db || !sessionId) return null;
  const snap = await db.collection("premiumDownloadSessions").doc(String(sessionId)).get();
  return snap.exists ? (snap.data() || null) : null;
}
async function azUpdatePremiumDownloadSessionPersistent(sessionId, patch = {}) {
  const db = getAzobssBackendDb();
  if (!db || !sessionId) return null;
  await db.collection("premiumDownloadSessions").doc(String(sessionId)).set(azJsonSafe({ ...(patch || {}), updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }), { merge:true });
  return { ok:true };
}
async function azFindPremiumSessionDeep(sessionId) {
  let s = findPremiumDownloadSession(sessionId);
  if (s) return s;
  try {
    s = await azFindPremiumDownloadSessionPersistent(sessionId);
    if (s) {
      savePremiumDownloadSession({ ...s, sessionId: s.sessionId || sessionId });
      return { ...s, sessionId: s.sessionId || sessionId };
    }
  } catch (err) {
    console.warn("Premium download session Firestore lookup failed:", err && (err.message || err));
  }
  return null;
}


// AZOBSS PATCH 698: Private Cloudflare R2 download gateway.
// The backend signs a short-lived HMAC token; Cloudflare Worker validates it and serves
// the private R2 object with Range/Resume support. Existing backend streaming remains
// as a fallback for products that have not been migrated to R2.
const AZOBSS_R2_DOWNLOAD_PATCH = "AZOBSS_R2_WORKER_DIRECT_GATE_NO_RENDER_COLD_START_707_20260731";
function azR2DownloadBaseUrl() {
  const raw = String(process.env.AZOBSS_R2_DOWNLOAD_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return "";
    return parsed.toString().replace(/\/+$/, "");
  } catch (_) { return ""; }
}
function azR2TokenSecret() {
  return String(process.env.AZOBSS_R2_TOKEN_SECRET || "").trim();
}
function azR2TokenTtlSeconds() {
  const n = Number(process.env.AZOBSS_R2_TOKEN_TTL_SECONDS || 7200);
  return Number.isFinite(n) ? Math.max(60, Math.min(24 * 60 * 60, Math.floor(n))) : 7200;
}
function azR2Configured() {
  return Boolean(azR2DownloadBaseUrl() && azR2TokenSecret());
}


// AZOBSS PATCH 720: R2-only Tech Vault. The bundled website copy was removed.
const AZOBSS_TECH_VAULT_PATCH = "AZOBSS_TECH_VAULT_R2_ONLY_NO_BUILTIN_720_20260803";
const AZOBSS_TECH_VAULT_LOCAL_DIR = path.join(ROOT, "_private-tech-vault");
const AZOBSS_TECH_VAULT_META_FILE = path.join(AZOBSS_TECH_VAULT_LOCAL_DIR, "tech-vault-files.json");

function azTechVaultPassword() {
  return String(
    process.env.AZOBSS_TECH_VAULT_PASSWORD ||
    process.env.TECH_VAULT_PASSWORD ||
    process.env.ADMIN_KEY ||
    process.env.AZOBSS_ADMIN_API_SECRET ||
    ""
  ).trim();
}
function azTechVaultSessionSecret() {
  return String(
    process.env.AZOBSS_TECH_VAULT_SESSION_SECRET ||
    process.env.AZOBSS_TECH_VAULT_PASSWORD ||
    process.env.TECH_VAULT_PASSWORD ||
    process.env.AZOBSS_ADMIN_API_SECRET ||
    process.env.ADMIN_KEY ||
    ""
  ).trim();
}
function azTechVaultSessionHours() {
  const n = Number(process.env.AZOBSS_TECH_VAULT_SESSION_HOURS || 12);
  return Number.isFinite(n) ? Math.max(1, Math.min(72, Math.floor(n))) : 12;
}
function azTechVaultMaxFileBytes() {
  const n = Number(process.env.AZOBSS_TECH_VAULT_MAX_FILE_MB || 25);
  const mb = Number.isFinite(n) ? Math.max(1, Math.min(250, n)) : 25;
  return Math.floor(mb * 1024 * 1024);
}
function azTechVaultBase64Url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function azTechVaultDecodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, "base64");
}
function azTechVaultSignPayload(payload = {}, secret = azTechVaultSessionSecret()) {
  if (!secret) return "";
  const part = azTechVaultBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(part).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part}.${sig}`;
}
function azTechVaultVerifySignedToken(token = "", secret = azTechVaultSessionSecret()) {
  if (!secret) return null;
  const parts = String(token || "").trim().split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null;
  } catch (_) { return null; }
  try {
    const payload = JSON.parse(azTechVaultDecodeBase64Url(parts[0]).toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    if (Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) { return null; }
}
function azTechVaultTokenFromRequest(req) {
  const header = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return header || String(req.headers["x-tech-vault-token"] || "").trim();
}
function azTechVaultSessionFromRequest(req) {
  const payload = azTechVaultVerifySignedToken(azTechVaultTokenFromRequest(req), azTechVaultSessionSecret());
  return payload && payload.scope === "tech-vault" ? payload : null;
}
function azTechVaultPasswordMatches(value = "") {
  const expected = azTechVaultPassword();
  const supplied = String(value || "");
  if (!expected || !supplied) return false;
  try { return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)); }
  catch (_) { return supplied === expected; }
}
function azTechVaultSafeFilename(value = "") {
  const clean = path.basename(String(value || "AZOBSS-Tool.bat"))
    .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  if (!clean || !/\.bat$/i.test(clean)) return "";
  return clean;
}
function azTechVaultSafeObjectKey(value = "") {
  const key = String(value || "").trim().replace(/^\/+/, "");
  if (!key || key.length > 600 || key.includes("..") || key.includes("\\")) return "";
  return /^tech-vault\/[a-zA-Z0-9._/-]+$/i.test(key) ? key : "";
}
function azTechVaultJsonRows() {
  try {
    if (!fs.existsSync(AZOBSS_TECH_VAULT_META_FILE)) return [];
    const rows = JSON.parse(fs.readFileSync(AZOBSS_TECH_VAULT_META_FILE, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch (_) { return []; }
}
function azTechVaultWriteJsonRows(rows = []) {
  try {
    fs.writeFileSync(AZOBSS_TECH_VAULT_META_FILE, JSON.stringify(rows, null, 2));
    return true;
  } catch (err) {
    console.warn("Tech Vault local metadata write failed:", err && (err.message || err));
    return false;
  }
}
async function azTechVaultListFiles() {
  const output = [];
  const seen = new Set();
  const db = getAzobssBackendDb();
  if (db) {
    try {
      const snap = await db.collection("techVaultFiles").limit(500).get();
      snap.forEach(doc => {
        const row = doc.data() || {};
        const id = String(row.id || doc.id || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (row.deleted === true) return;
        output.push({ ...row, id });
      });
    } catch (err) {
      console.warn("Tech Vault Firestore list failed:", err && (err.message || err));
    }
  }
  for (const row of azTechVaultJsonRows()) {
    const id = String(row && row.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (row.deleted === true) continue;
    output.push(row);
  }
  return output
    .filter(row => row && azTechVaultSafeFilename(row.filename || row.name))
    .sort((a, b) => {
      const nameA = String(a.filename || a.name || "");
      const nameB = String(b.filename || b.name || "");
      const byName = nameA.localeCompare(nameB, "en", { numeric:true, sensitivity:"base" });
      if (byName) return byName;
      return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
    });
}
async function azTechVaultFindFile(id = "") {
  const wanted = cleanPremiumText(id || "", 180);
  const rows = await azTechVaultListFiles();
  return rows.find(row => String(row.id || "") === wanted) || null;
}
async function azTechVaultSaveFile(row = {}) {
  const id = cleanPremiumText(row.id || makeId("tvf"), 180).replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = azTechVaultSafeFilename(row.filename || row.name);
  const objectKey = azTechVaultSafeObjectKey(row.objectKey || row.key);
  if (!id || !filename || !objectKey) throw new Error("Invalid Tech Vault file metadata.");
  const saved = {
    id,
    name: filename,
    filename,
    objectKey,
    size: Math.max(0, Number(row.size || 0) || 0),
    contentType: cleanPremiumText(row.contentType || "application/x-bat", 120),
    source: "cloudflare-r2",
    createdAtMs: Number(row.createdAtMs || Date.now()) || Date.now(),
    createdAt: row.createdAt || new Date().toISOString(),
    uploadedBy: "password-session",
    patch: AZOBSS_TECH_VAULT_PATCH
  };
  const db = getAzobssBackendDb();
  if (db) {
    try {
      await db.collection("techVaultFiles").doc(id).set(saved, { merge: true });
    } catch (err) {
      console.warn("Tech Vault Firestore save failed:", err && (err.message || err));
    }
  }
  const rows = azTechVaultJsonRows().filter(item => item && item.id !== id);
  rows.unshift(saved);
  azTechVaultWriteJsonRows(rows.slice(0, 500));
  return saved;
}
function azTechVaultUploadToken(filename = "", size = 0, contentType = "") {
  const safeName = azTechVaultSafeFilename(filename);
  const safeSize = Math.floor(Number(size || 0));
  if (!safeName) throw Object.assign(new Error("Only .bat files are allowed."), { statusCode: 400 });
  if (!Number.isFinite(safeSize) || safeSize <= 0) throw Object.assign(new Error("The selected BAT file is empty."), { statusCode: 400 });
  if (safeSize > azTechVaultMaxFileBytes()) throw Object.assign(new Error(`File exceeds the ${Math.floor(azTechVaultMaxFileBytes()/1024/1024)} MB limit.`), { statusCode: 413 });
  if (!azR2Configured()) throw Object.assign(new Error("Cloudflare R2 Worker is not configured on the backend."), { statusCode: 503 });
  const id = makeId("tvf").replace(/[^a-zA-Z0-9_-]/g, "");
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const slug = safeName.replace(/\.bat$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "AZOBSS-Tool";
  const key = `tech-vault/${stamp}-${id}-${slug}.bat`;
  const payload = {
    mode: "vault-upload",
    id,
    key,
    name: safeName,
    size: safeSize,
    type: cleanPremiumText(contentType || "application/x-bat", 120),
    exp: Math.floor(Date.now()/1000) + 15 * 60,
    patch: "720"
  };
  const token = azTechVaultSignPayload(payload, azR2TokenSecret());
  if (!token) throw Object.assign(new Error("R2 upload token could not be created."), { statusCode: 503 });
  return {
    ...payload,
    token,
    uploadUrl: `${azR2DownloadBaseUrl()}/vault-upload/${encodeURIComponent(token)}`
  };
}
function azTechVaultVerifyUploadToken(token = "") {
  const payload = azTechVaultVerifySignedToken(token, azR2TokenSecret());
  if (!payload || payload.mode !== "vault-upload") return null;
  if (!azTechVaultSafeObjectKey(payload.key) || !azTechVaultSafeFilename(payload.name)) return null;
  return payload;
}
function azTechVaultDownloadUrl(row = {}) {
  const key = azTechVaultSafeObjectKey(row.objectKey || row.key);
  const name = azTechVaultSafeFilename(row.filename || row.name);
  if (!key || !name || !azR2Configured()) return "";
  const token = azTechVaultSignPayload({
    key,
    name,
    exp: Math.floor(Date.now()/1000) + 60 * 60,
    sid: "tech-vault",
    oid: cleanPremiumText(row.id || "", 160)
  }, azR2TokenSecret());
  return token ? `${azR2DownloadBaseUrl()}/dl/${encodeURIComponent(token)}` : "";
}

function azTechVaultDeleteUrl(row = {}) {
  const key = azTechVaultSafeObjectKey(row.objectKey || row.key);
  const id = cleanPremiumText(row.id || "", 180).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!key || !id || !azR2Configured()) return "";
  const token = azTechVaultSignPayload({
    mode: "vault-delete",
    key,
    id,
    exp: Math.floor(Date.now()/1000) + 10 * 60,
    patch: "720"
  }, azR2TokenSecret());
  return token ? `${azR2DownloadBaseUrl()}/vault-delete/${encodeURIComponent(token)}` : "";
}
async function azTechVaultWriteDeletedRecord(row = {}) {
  const id = cleanPremiumText(row.id || "", 180).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!id) throw new Error("Invalid Tech Vault file ID.");
  const tombstone = {
    ...row,
    id,
    deleted: true,
    deletedAtMs: Date.now(),
    deletedAt: new Date().toISOString(),
    deletedBy: "password-session",
    patch: AZOBSS_TECH_VAULT_PATCH
  };
  const db = getAzobssBackendDb();
  if (db) {
    try {
      await db.collection("techVaultFiles").doc(id).set(tombstone, { merge:true });
    } catch (err) {
      console.warn("Tech Vault Firestore delete marker failed:", err && (err.message || err));
    }
  }
  const rows = azTechVaultJsonRows().filter(item => item && String(item.id || "") !== id);
  rows.unshift(tombstone);
  azTechVaultWriteJsonRows(rows.slice(0, 500));
  return tombstone;
}
async function azTechVaultDeleteFile(row = {}) {
  if (!row) throw Object.assign(new Error("File not found."), { statusCode:404 });
  const id = cleanPremiumText(row.id || "", 180).replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = azTechVaultSafeFilename(row.filename || row.name);
  const objectKey = azTechVaultSafeObjectKey(row.objectKey || row.key);
  if (!id || !filename || !objectKey) throw Object.assign(new Error("Invalid Tech Vault file record."), { statusCode:400 });
  const deleteUrl = azTechVaultDeleteUrl(row);
  if (!deleteUrl) throw Object.assign(new Error("Private R2 delete gateway is not configured."), { statusCode:503 });
  const response = await fetch(deleteUrl, { method:"DELETE", headers:{ Accept:"application/json" } });
  const responseText = await response.text();
  if (!response.ok) {
    let detail = responseText;
    try { detail = JSON.parse(responseText).error || detail; } catch (_) {}
    throw Object.assign(new Error(cleanPremiumText(detail, 300) || `R2 delete failed (HTTP ${response.status}).`), { statusCode:response.status || 502 });
  }
  await azTechVaultWriteDeletedRecord({ ...row, id, filename, objectKey });
  return { id, filename, objectKey, deleted:true };
}
function azTechVaultPublicInfo() {
  return {
    ok: true,
    service: "azobss-tech-vault",
    patch: AZOBSS_TECH_VAULT_PATCH,
    passwordConfigured: Boolean(azTechVaultPassword()),
    r2Configured: azR2Configured(),
    maxFileMb: Math.floor(azTechVaultMaxFileBytes()/1024/1024),
    allowedExtensions: [".bat"],
    time: new Date().toISOString()
  };
}


// AZOBSS PATCH 735: Admin Sales PDF/ZIP direct share links via Cloudflare R2.
// The browser uploads the already-generated document directly to the Worker,
// then WhatsApp/Telegram receive a normal HTTPS link instead of Windows Share.
const AZOBSS_SALES_SHARE_PATCH = "AZOBSS_ADMIN_SALES_DIRECT_APP_COPY_PDF_LINK_735_20260804";
function azSalesShareMaxBytes() {
  const mb = Number(process.env.AZOBSS_SALES_SHARE_MAX_MB || 20);
  return Math.floor(Math.max(1, Math.min(50, Number.isFinite(mb) ? mb : 20)) * 1024 * 1024);
}
function azSalesShareLinkDays() {
  const days = Number(process.env.AZOBSS_SALES_SHARE_LINK_DAYS || 365);
  return Math.max(1, Math.min(730, Number.isFinite(days) ? Math.floor(days) : 365));
}
function azSalesShareSafeFilename(value = "", contentType = "application/pdf") {
  const fallback = /zip/i.test(String(contentType || "")) ? "AZOBSS-Documents.zip" : "AZOBSS-Receipt.pdf";
  const clean = path.basename(String(value || fallback))
    .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || fallback;
  if (/zip/i.test(String(contentType || ""))) return /\.zip$/i.test(clean) ? clean : `${clean.replace(/\.[^.]+$/, "")}.zip`;
  return /\.pdf$/i.test(clean) ? clean : `${clean.replace(/\.[^.]+$/, "")}.pdf`;
}
function azSalesShareSafeObjectKey(value = "") {
  const key = String(value || "").trim().replace(/^\/+/, "");
  if (!key || key.length > 600 || key.includes("..") || key.includes("\\")) return "";
  return /^sales-documents\/[a-zA-Z0-9._/-]+$/i.test(key) ? key : "";
}
function azSalesShareSlug(value = "document") {
  return String(value || "document")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "document";
}
function azSalesShareIssue(meta = {}) {
  if (!azR2Configured()) throw Object.assign(new Error("Cloudflare R2 Worker is not configured on the backend."), { statusCode:503 });
  const contentType = String(meta.contentType || meta.type || "application/pdf").toLowerCase();
  const isZip = /application\/zip|application\/x-zip-compressed/.test(contentType) || /\.zip$/i.test(String(meta.filename || meta.name || ""));
  const normalizedType = isZip ? "application/zip" : "application/pdf";
  const filename = azSalesShareSafeFilename(meta.filename || meta.name, normalizedType);
  const size = Math.floor(Number(meta.size || 0));
  if (!Number.isFinite(size) || size <= 0) throw Object.assign(new Error("Generated document is empty."), { statusCode:400 });
  if (size > azSalesShareMaxBytes()) throw Object.assign(new Error(`Generated document exceeds the ${Math.floor(azSalesShareMaxBytes()/1024/1024)} MB share limit.`), { statusCode:413 });
  if (isZip && !/\.zip$/i.test(filename)) throw Object.assign(new Error("Bulk share bundle must be a ZIP file."), { statusCode:400 });
  if (!isZip && !/\.pdf$/i.test(filename)) throw Object.assign(new Error("Only PDF receipt/invoice links are supported."), { statusCode:400 });
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth()+1).padStart(2,"0");
  const documentNo = cleanPremiumText(meta.documentNo || meta.reference || filename.replace(/\.[^.]+$/, ""), 180);
  const fingerprint = crypto.createHash("sha256").update(`${documentNo}|${filename}|${normalizedType}`).digest("hex").slice(0,16);
  const ext = isZip ? "zip" : "pdf";
  const key = azSalesShareSafeObjectKey(`sales-documents/${yyyy}/${mm}/${azSalesShareSlug(documentNo)}-${fingerprint}.${ext}`);
  if (!key) throw Object.assign(new Error("Could not create a safe R2 document key."), { statusCode:500 });
  const uploadPayload = {
    mode:"sales-file-upload", key, name:filename, size, type:normalizedType,
    exp:Math.floor(Date.now()/1000)+15*60, patch:"735"
  };
  const uploadToken = azTechVaultSignPayload(uploadPayload, azR2TokenSecret());
  const shareExpiresAt = Math.floor(Date.now()/1000) + azSalesShareLinkDays()*24*60*60;
  const sharePayload = {
    mode:"sales-file", key, name:filename, type:normalizedType,
    exp:shareExpiresAt, patch:"735"
  };
  const shareToken = azTechVaultSignPayload(sharePayload, azR2TokenSecret());
  if (!uploadToken || !shareToken) throw Object.assign(new Error("R2 share token could not be created."), { statusCode:503 });
  const base = azR2DownloadBaseUrl();
  return {
    ok:true,
    patch:AZOBSS_SALES_SHARE_PATCH,
    filename,
    contentType:normalizedType,
    objectKey:key,
    uploadUrl:`${base}/sales-file-upload/${encodeURIComponent(uploadToken)}`,
    shareUrl:`${base}/sales-file/${encodeURIComponent(shareToken)}/${encodeURIComponent(filename)}`,
    expiresAt:new Date(shareExpiresAt*1000).toISOString(),
    expiresInDays:azSalesShareLinkDays()
  };
}


// AZOBSS PATCH 746: short-lived backend storage for generated admin PDF/ZIP files.
// Files live only in the Render temporary directory, not Firestore/R2. Native Share
// deletes immediately after navigator.share() succeeds. Public links are removed after
// first access plus a safety window, or at the hard maximum expiry time.

const AZOBSS_MANUAL_INVOICE_TOYYIB_PATCH = "AZOBSS_MANUAL_INVOICE_TOYYIBPAY_FALLBACK_EMAIL_PRIVATE_PDF_FIX_769_20260804";
const AZOBSS_MANUAL_PAYOR_PREFILL_VERSION = 769;
const AZOBSS_MANUAL_BILL_AMOUNT_VERSION = 765;
function azManualInvoicePayableAmount(invoice = {}) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotalFromItems = items.reduce((sum, item) => {
    const qty = Math.max(0, Number(item && (item.qty ?? item.quantity) || 0) || 0);
    const unitPrice = Math.max(0, Number(item && (item.unitPrice ?? item.price) || 0) || 0);
    return sum + (qty * unitPrice);
  }, 0);
  const discount = Math.max(0, Number(invoice.discount || 0) || 0);
  const shippingCharge = Math.max(0, Number(invoice.shippingCharge || 0) || 0);
  const calculatedFromItems = Math.max(0, subtotalFromItems - discount + shippingCharge);
  const amountDue = Math.max(0, Number(invoice.amountDue || 0) || 0);
  const gross = Math.max(0, Number(invoice.gross || 0) || 0);
  // For Pending invoices, the saved item list is the safest source of truth. Older
  // records may have a stale `gross` value from before another item was added.
  if (calculatedFromItems > 0) return Math.round(calculatedFromItems * 100) / 100;
  if (amountDue > 0) return Math.round(amountDue * 100) / 100;
  return Math.round(gross * 100) / 100;
}
function azIsManualSalesInvoiceOrder(order = {}) {
  return order && (order.isManualSalesInvoice === true || String(order.source || "").toLowerCase() === "admin-manual-invoice" || String(order.productId || "").toLowerCase() === "manual-sales-invoice");
}
function azManualInvoiceReceiptNo(invoiceNo = "") {
  const value = cleanPremiumText(invoiceNo || "", 180);
  if (/^AZI-/i.test(value)) return value.replace(/^AZI-/i, "AZR-");
  if (/^INV-/i.test(value)) return value.replace(/^INV-/i, "RCP-");
  return value ? `RCP-${value}` : "";
}
function azManualInvoiceExpiryDays() {
  const raw = Number(process.env.AZOBSS_MANUAL_INVOICE_EXPIRY_DAYS || 7);
  return Math.max(1, Math.min(100, Number.isFinite(raw) ? Math.round(raw) : 7));
}
function azManualInvoiceToyyibFallbackEmail() {
  // Used only in the ToyyibPay createBill payload when the customer has no email.
  // It is deliberately never copied into receipt.customerEmail, invoice PDF or receipt PDF.
  const candidates = [
    process.env.AZOBSS_TOYYIBPAY_FALLBACK_EMAIL,
    process.env.TOYYIBPAY_FALLBACK_EMAIL,
    "zedan9107@gmail.com"
  ];
  for (const candidate of candidates) {
    const email = cleanToyyibEmail(candidate || "", 80);
    if (email) return email;
  }
  return "";
}
async function azManualInvoiceQrJpeg(paymentUrl = "") {
  const value = cleanPremiumUrl(paymentUrl || "");
  if (!value) throw new Error("ToyyibPay payment URL is missing.");
  if (!QRCode) QRCode = azobssLoadBackendModule("qrcode");
  if (!sharp) sharp = azobssLoadBackendModule("sharp");
  if (!QRCode || !sharp) throw new Error("QR generator dependency is unavailable on the backend.");
  const svg = await QRCode.toString(value, { type:"svg", errorCorrectionLevel:"M", margin:2, width:300, color:{ dark:"#111827", light:"#FFFFFF" } });
  const jpeg = await sharp(Buffer.from(svg)).flatten({ background:"#ffffff" }).jpeg({ quality:92, chromaSubsampling:"4:4:4" }).toBuffer();
  return jpeg;
}
async function azLoadManualInvoiceReceipt(receiptId = "") {
  const id = cleanPremiumText(receiptId || "", 180);
  if (!id) throw Object.assign(new Error("Manual invoice record ID is required."), { statusCode:400 });
  if (!initFirebaseAdmin()) throw Object.assign(new Error("Firebase Admin is not configured on the backend."), { statusCode:503 });
  const db = getAzobssBackendDb();
  if (!db) throw Object.assign(new Error("Firestore backend is unavailable."), { statusCode:503 });
  const ref = db.collection("receipts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error("Manual invoice record was not found."), { statusCode:404 });
  const data = snap.data() || {};
  if (String(data.source || "") !== "admin-manual-sale") throw Object.assign(new Error("Only manual Sales & Receipts invoices can use this ToyyibPay bill."), { statusCode:400 });
  return { id, ref, data };
}
async function azEnsureManualInvoiceToyyibBill(req, receiptId, adminIdentity = {}) {
  if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) throw Object.assign(new Error("ToyyibPay credentials/category are not configured in Render ENV."), { statusCode:503 });
  const record = await azLoadManualInvoiceReceipt(receiptId);
  const invoice = record.data;
  const status = String(invoice.status || "pending").trim().toLowerCase();
  if (status === "paid") {
    return { ok:true, alreadyPaid:true, receiptId:record.id, invoiceNo:invoice.invoiceNo || "", receiptNo:invoice.receiptNo || azManualInvoiceReceiptNo(invoice.invoiceNo), status:"paid", billCode:invoice.billCode || invoice.toyyibBillCode || "", paymentUrl:invoice.paymentUrl || invoice.toyyibPaymentUrl || "" };
  }
  if (status !== "pending") throw Object.assign(new Error("ToyyibPay QR is available only for Pending invoices."), { statusCode:409 });
  const amount = azManualInvoicePayableAmount(invoice);
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Invoice total must be more than RM0.00 before creating a ToyyibPay bill."), { statusCode:400 });
  const invoiceNo = cleanPremiumText(invoice.invoiceNo || invoice.documentNo || `AZI-${record.id.slice(0,10).toUpperCase()}`, 180);
  const existingBillCode = cleanPremiumText(invoice.billCode || invoice.toyyibBillCode || "", 120);
  const existingPaymentUrl = cleanPremiumUrl(invoice.paymentUrl || invoice.toyyibPaymentUrl || "");
  let order = findPremiumOrderByAny({ orderId:invoice.toyyibOrderId || `manual-invoice-${record.id}`, billCode:existingBillCode });
  let billCode = existingBillCode || cleanPremiumText(order && order.billCode || "", 120);
  let paymentUrl = existingPaymentUrl || cleanPremiumUrl(order && order.paymentUrl || "");
  const savedInvoiceBillAmount = Number(invoice.toyyibBillAmount || 0) || (Number(invoice.toyyibBillAmountSen || 0) / 100) || 0;
  const savedOrderAmount = Number(order && (order.saleAmount || order.amount) || 0);
  const savedBillAmount = savedInvoiceBillAmount > 0 ? savedInvoiceBillAmount : savedOrderAmount;
  const amountChanged = Boolean((billCode || paymentUrl || order) && savedBillAmount > 0 && Math.abs(savedBillAmount - amount) > 0.005);
  const currentCustomerName = cleanToyyibBillText(invoice.customerName || "", 30);
  const currentCustomerEmail = cleanToyyibEmail(invoice.customerEmail || "", 80);
  const currentCustomerPhone = cleanToyyibPhone(invoice.customerPhone || "", 20);
  const fallbackEmail = azManualInvoiceToyyibFallbackEmail();
  const usingFallbackEmail = Boolean(currentCustomerName && currentCustomerPhone && !currentCustomerEmail && fallbackEmail);
  const emailSentToToyyib = currentCustomerEmail || (usingFallbackEmail ? fallbackEmail : "");
  // Name and phone remain the customer's real details. When only customer email is absent,
  // use AZOBSS' fallback email for ToyyibPay so the payer does not need to type anything.
  // If name or phone is missing, keep an open bill and let the payer complete all fields.
  const currentPayorInfoMode = (currentCustomerName && currentCustomerPhone && emailSentToToyyib) ? 1 : 0;
  const currentPrefillName = currentPayorInfoMode ? currentCustomerName : "";
  const currentPrefillEmail = currentPayorInfoMode ? emailSentToToyyib : "";
  const currentPrefillPhone = currentPayorInfoMode ? currentCustomerPhone : "";
  const savedOrderUser = order && order.user && typeof order.user === "object" ? order.user : {};
  const legacySavedEmail = cleanToyyibEmail(invoice.toyyibPrefilledCustomerEmail || savedOrderUser.email || order && (order.buyerEmail || order.email) || "", 80);
  const savedPayorInfoModeRaw = invoice.toyyibPayorInfoMode ?? (order && order.manualPayorInfoMode);
  const savedPayorInfoMode = savedPayorInfoModeRaw === 0 || savedPayorInfoModeRaw === "0"
    ? 0
    : (savedPayorInfoModeRaw === 1 || savedPayorInfoModeRaw === "1" ? 1 : (legacySavedEmail ? 1 : 0));
  // Internal order.user fields keep the customer record even for an open bill. Compare
  // only details that were actually sent to ToyyibPay, otherwise an open bill would be
  // incorrectly recreated on every PDF/share request.
  const savedCustomerName = savedPayorInfoMode
    ? cleanToyyibBillText(invoice.toyyibPrefilledCustomerName || savedOrderUser.displayName || savedOrderUser.username || "", 30)
    : "";
  const savedCustomerEmail = savedPayorInfoMode ? legacySavedEmail : "";
  const savedCustomerPhone = savedPayorInfoMode
    ? cleanToyyibPhone(invoice.toyyibPrefilledCustomerPhone || savedOrderUser.phone || order && order.phone || "", 20)
    : "";
  const hasSavedCustomerSnapshot = Boolean(savedCustomerName || savedCustomerEmail || savedCustomerPhone || savedPayorInfoModeRaw !== undefined);
  const payorModeChanged = Boolean((billCode || paymentUrl || order) && savedPayorInfoMode !== currentPayorInfoMode);
  const customerChanged = Boolean((billCode || paymentUrl || order) && hasSavedCustomerSnapshot && (
    savedCustomerName !== currentPrefillName ||
    savedCustomerEmail !== currentPrefillEmail ||
    savedCustomerPhone !== currentPrefillPhone
  ));
  const savedPrefillVersion = Number(invoice.toyyibPayorPrefillVersion || order && order.manualPayorPrefillVersion || 0);
  const prefillUpgradeRequired = Boolean((billCode || paymentUrl) && currentPayorInfoMode === 1 && savedPrefillVersion < AZOBSS_MANUAL_PAYOR_PREFILL_VERSION);
  const savedBillAmountVersion = Number(invoice.toyyibBillAmountVersion || order && order.manualBillAmountVersion || 0);
  // Recreate legacy Pending bills once so an old RM250 Bill Code cannot be reused
  // after the invoice total has already become RM270.
  const amountSyncUpgradeRequired = Boolean((billCode || paymentUrl) && savedBillAmountVersion < AZOBSS_MANUAL_BILL_AMOUNT_VERSION);
  const recreateBill = amountChanged || payorModeChanged || customerChanged || prefillUpgradeRequired || amountSyncUpgradeRequired;
  if (recreateBill) {
    const reason = amountChanged
      ? "manual-invoice-amount-changed"
      : (payorModeChanged
          ? "manual-invoice-payor-mode-changed"
          : (customerChanged
              ? "manual-invoice-customer-changed"
              : (prefillUpgradeRequired ? "manual-invoice-payor-prefill-upgrade" : "manual-invoice-bill-amount-sync-upgrade")));
    if (order) order = upsertPremiumOrder({ ...order, status:"superseded", supersededAt:new Date().toISOString(), supersededReason:reason });
    billCode = ""; paymentUrl = "";
  }
  let orderId = cleanPremiumText(invoice.toyyibOrderId || (order && order.orderId) || `manual-invoice-${record.id}`, 180);
  if (recreateBill) orderId = cleanPremiumText(`manual-invoice-${record.id}-p769-${Date.now().toString(36)}`, 180);
  if (order && billCode && !amountChanged) {
    const refreshed = await refreshToyyibOrder(order, req);
    if (String(refreshed && refreshed.status || "").toLowerCase() === "paid") {
      const paidRecord = await azLoadManualInvoiceReceipt(record.id);
      const paidData = paidRecord.data || {};
      return { ok:true, alreadyPaid:true, receiptId:record.id, invoiceNo:paidData.invoiceNo || invoiceNo, receiptNo:paidData.receiptNo || azManualInvoiceReceiptNo(invoiceNo), status:"paid", amount, billCode:refreshed.billCode || billCode, paymentUrl:refreshed.paymentUrl || paymentUrl };
    }
    order = refreshed || order;
  }
  const apiBase = publicBaseUrlFromReq(req);
  const returnUrl = `${apiBase}/payment/manual-invoice-return?orderId=${encodeURIComponent(orderId)}`;
  if (!billCode || !paymentUrl) {
    const itemText = Array.isArray(invoice.items)
      ? invoice.items.map(x => cleanToyyibBillText(x && x.name || "", 50)).filter(Boolean).slice(0,3).join(" ")
      : "";
    const customerEmail = currentPrefillEmail;
    const customerPhone = currentPrefillPhone;
    const customerName = currentPrefillName;
    // Prefill customer name and phone. If customer email is blank, use the private
    // AZOBSS fallback email only in ToyyibPay; customerEmail in Firestore/PDF stays blank.
    // If name or phone is absent, use an open bill and send blank payer fields.
    const payorInfo = currentPayorInfoMode;
    const billPayload = {
      userSecretKey:TOYYIB_SECRET_KEY,
      categoryCode:TOYYIB_CATEGORY_CODE,
      billName:cleanToyyibBillText(`Invoice ${invoiceNo}`,30) || "AZOBSS Invoice",
      billDescription:cleanToyyibBillText(`AZOBSS ${invoiceNo} ${itemText || "Customer invoice"}`,100) || "AZOBSS Customer Invoice",
      billPriceSetting:1,
      billPayorInfo:payorInfo,
      billAmount:Math.round(amount * 100),
      billReturnUrl:returnUrl,
      billCallbackUrl:TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`,
      billExternalReferenceNo:orderId,
      billTo:customerName,
      billEmail:customerEmail,
      billPhone:customerPhone,
      billSplitPayment:0,
      billSplitPaymentArgs:"",
      billPaymentChannel:0,
      billContentEmail:cleanPremiumText(`Payment for AZOBSS invoice ${invoiceNo}.`,1000),
      billChargeToCustomer:1,
      billExpiryDays:azManualInvoiceExpiryDays()
    };
    const duitNowActivated = await azToyyibDuitNowActivated();
    if (duitNowActivated) {
      billPayload.enableDuitNowQR = 1;
      billPayload.chargeDuitNowQR = 0;
    }
    let apiResult = await postToyyib("createBill", billPayload);
    billCode = azToyyibExtractBillCode(apiResult);
    // Some accounts report DuitNow QR as activated but reject it for a specific category/package.
    // Retry once without the optional DuitNow fields only when the API response points to QR/DuitNow.
    if (!billCode && duitNowActivated && /duit\s*now|duitnow|qr|activat/i.test(azToyyibApiMessage(apiResult, ""))) {
      const fallbackPayload = { ...billPayload };
      delete fallbackPayload.enableDuitNowQR;
      delete fallbackPayload.chargeDuitNowQR;
      apiResult = await postToyyib("createBill", fallbackPayload);
      billCode = azToyyibExtractBillCode(apiResult);
    }
    if (!billCode) {
      const detail = azToyyibApiMessage(apiResult);
      console.error("Manual invoice ToyyibPay createBill failed:", JSON.stringify({ receiptId:record.id, invoiceNo, detail, response:apiResult }).slice(0, 1800));
      throw Object.assign(new Error(`ToyyibPay createBill failed: ${detail}`), { statusCode:502 });
    }
    paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
  }
  const now = new Date();
  const amountText = amount.toFixed(2);
  order = upsertPremiumOrder({
    ...(order || {}), orderId, billCode, paymentUrl, returnUrl,
    productId:"manual-sales-invoice", productName:`Invoice ${invoiceNo}`,
    amount:amountText, amountSen:Math.round(amount*100), saleAmount:amount, saleAmountText:amountText,
    status:"pending", paymentMethod:"toyyibpay", paymentReference:"",
    source:"admin-manual-invoice", isManualSalesInvoice:true, manualReceiptDocId:record.id,
    manualInvoiceNo:invoiceNo, manualReceiptNo:invoice.receiptNo || azManualInvoiceReceiptNo(invoiceNo),
    user:{ uid:invoice.uid || invoice.createdByUid || "", username:invoice.customerName || "", email:invoice.customerEmail || "", phone:invoice.customerPhone || "", displayName:invoice.customerName || "" },
    email:invoice.customerEmail || "", buyerEmail:invoice.customerEmail || "", phone:invoice.customerPhone || "",
    manualPayorPrefillVersion:AZOBSS_MANUAL_PAYOR_PREFILL_VERSION,
    manualPayorInfoMode:currentPayorInfoMode,
    manualBillAmountVersion:AZOBSS_MANUAL_BILL_AMOUNT_VERSION,
    manualBillAmount:amount, manualBillAmountSen:Math.round(amount*100),
    commissionSkippedReason:"manual-sales-invoice", commissionCheckedAt:(order && order.commissionCheckedAt) || now.toISOString(),
    createdAt:(order && order.createdAt) || now.toISOString(), createdAtMs:(order && order.createdAtMs) || now.getTime()
  });
  await record.ref.set({
    paymentMethod:"ToyyibPay", toyyibOrderId:orderId, billCode, toyyibBillCode:billCode,
    paymentUrl, toyyibPaymentUrl:paymentUrl, toyyibBillCreatedAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    toyyibBillCreatedAtMs:Date.now(), toyyibBillExpiryDays:azManualInvoiceExpiryDays(),
    toyyibPayorPrefillVersion:AZOBSS_MANUAL_PAYOR_PREFILL_VERSION,
    toyyibPayorInfoMode:currentPayorInfoMode,
    toyyibBillAmountVersion:AZOBSS_MANUAL_BILL_AMOUNT_VERSION,
    toyyibBillAmount:amount, toyyibBillAmountSen:Math.round(amount*100),
    toyyibPrefilledCustomerName:currentPrefillName, toyyibPrefilledCustomerPhone:currentPrefillPhone,
    toyyibPrefilledCustomerEmail:currentPrefillEmail,
    toyyibFallbackEmailUsed:usingFallbackEmail,
    toyyibPayorEmailSource:currentPayorInfoMode ? (usingFallbackEmail ? "azobss-fallback" : "customer") : "open-bill",
    updatedAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(), updatedAtMs:Date.now()
  }, { merge:true });
  const qrJpeg = await azManualInvoiceQrJpeg(paymentUrl);
  return { ok:true, patch:AZOBSS_MANUAL_INVOICE_TOYYIB_PATCH, receiptId:record.id, invoiceNo, status:"pending", amount, amountSen:Math.round(amount*100), orderId, billCode, paymentUrl, qrJpegBase64:qrJpeg.toString("base64"), expiryDays:azManualInvoiceExpiryDays(), toyyibPayorInfoMode:currentPayorInfoMode, toyyibPayorPrefillVersion:AZOBSS_MANUAL_PAYOR_PREFILL_VERSION, toyyibBillAmountVersion:AZOBSS_MANUAL_BILL_AMOUNT_VERSION };
}
async function azSyncManualSalesInvoicePaid(order = {}, opts = {}) {
  if (!azIsManualSalesInvoiceOrder(order)) return { ok:false, skipped:true };
  const record = await azLoadManualInvoiceReceipt(order.manualReceiptDocId || "");
  const current = record.data || {};
  if (String(current.status || "").toLowerCase() === "paid" && current.toyyibPaidSyncedAt) return { ok:true, alreadyPaid:true, receiptId:record.id };
  const currentBillCode = cleanPremiumText(current.billCode || current.toyyibBillCode || "", 120);
  const paidBillCode = cleanPremiumText(order.billCode || "", 120);
  if (currentBillCode && paidBillCode && currentBillCode !== paidBillCode) {
    console.warn("Manual invoice stale ToyyibPay bill ignored:", JSON.stringify({ receiptId:record.id, currentBillCode, paidBillCode }).slice(0,500));
    return { ok:false, skipped:true, staleBill:true, receiptId:record.id };
  }
  const invoiceNo = cleanPremiumText(current.invoiceNo || order.manualInvoiceNo || current.documentNo || "", 180);
  const receiptNo = cleanPremiumText(current.receiptNo || order.manualReceiptNo || azManualInvoiceReceiptNo(invoiceNo), 180);
  const gross = azManualInvoicePayableAmount(current) || Number(order.saleAmount || order.amount || 0) || 0;
  const gatewayFee = Math.max(Number(current.paymentFee || 0) || 0, Number(process.env.AZOBSS_TOYYIBPAY_FEE_RM || 1) || 1);
  const totalCost = (Number(current.productCost || 0)||0) + (Number(current.shippingCost || 0)||0) + gatewayFee + (Number(current.commission || 0)||0) + (Number(current.otherCost || 0)||0);
  const profit = gross - totalCost;
  const paidAtMs = Date.now();
  const paymentReference = cleanPremiumText(opts.paymentReference || order.paymentReference || "", 180);
  await record.ref.set({
    status:"paid", documentType:"receipt", documentNo:receiptNo, invoiceNo, receiptNo,
    paymentMethod:"ToyyibPay", paymentRecognized:true, amountDue:0, paidGross:gross,
    paymentFee:gatewayFee, totalCost, profit, recognizedTotalCost:totalCost, recognizedProfit:profit,
    paidAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(), paidAtMs,
    paymentReference, billCode:order.billCode || current.billCode || "", toyyibBillCode:order.billCode || current.toyyibBillCode || "",
    paymentUrl:order.paymentUrl || current.paymentUrl || "", toyyibPaymentUrl:order.paymentUrl || current.toyyibPaymentUrl || "",
    toyyibVerifiedAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(), toyyibVerifiedAtMs:paidAtMs,
    toyyibPaidSyncedAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(), toyyibPaidSyncedAtMs:paidAtMs,
    updatedAt:firebaseAdmin.firestore.FieldValue.serverTimestamp(), updatedAtMs:paidAtMs
  }, { merge:true });
  const sourceBookingId = cleanPremiumText(current.sourceBookingId || "", 100);
  if (sourceBookingId) {
    try {
      const db = getAzobssBackendDb();
      if (db) await db.collection("serviceBookings").doc(sourceBookingId).set({
        status:"confirmed", documentStage:"invoice_paid", invoiceDocId:record.id, invoiceNo, receiptNo,
        invoiceStatus:"paid", paymentStatus:"paid", finalPrice:gross, finalPriceConfirmed:true, estimateFinal:true,
        paymentReference, paidAt:new Date(paidAtMs).toISOString(), paidAtMs,
        updatedAt:new Date(paidAtMs).toISOString(), updatedAtMs:paidAtMs, updatedBy:"toyyibpay-callback"
      }, { merge:true });
    } catch (serviceSyncError) {
      console.warn("Service booking paid sync failed:", sourceBookingId, serviceSyncError && serviceSyncError.message);
    }
  }
  return { ok:true, receiptId:record.id, invoiceNo, receiptNo, gross, totalCost, profit, sourceBookingId };
}

const AZOBSS_SALES_TEMP_PATCH = "AZOBSS_ADMIN_SALES_TEMP_QUOTA_SAVER_759_20260804";
const AZOBSS_SALES_TEMP_DIR = path.join(os.tmpdir(), "azobss-sales-temp-documents");
const azSalesTempFiles = new Map();
function azSalesTempMaxBytes() {
  const mb = Number(process.env.AZOBSS_SALES_TEMP_MAX_MB || 20);
  return Math.floor(Math.max(1, Math.min(50, Number.isFinite(mb) ? mb : 20)) * 1024 * 1024);
}
function azSalesTempHardTtlMs() {
  const minutes = Number(process.env.AZOBSS_SALES_TEMP_MAX_MINUTES || 120);
  return Math.max(10, Math.min(720, Number.isFinite(minutes) ? minutes : 120)) * 60 * 1000;
}
function azSalesTempAfterAccessMs() {
  const minutes = Number(process.env.AZOBSS_SALES_TEMP_AFTER_ACCESS_MINUTES || 30);
  return Math.max(5, Math.min(120, Number.isFinite(minutes) ? minutes : 30)) * 60 * 1000;
}
function azSalesTempEnsureDir() {
  try { fs.mkdirSync(AZOBSS_SALES_TEMP_DIR, { recursive:true }); } catch (_) {}
}
function azSalesTempSafeId(value = "") {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,32}$/.test(id) ? id : "";
}
function azSalesTempNewId() {
  return crypto.randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12);
}
function azSalesTempDelete(id) {
  id = azSalesTempSafeId(id);
  if (!id) return false;
  const row = azSalesTempFiles.get(id);
  if (row && row.deleteTimer) clearTimeout(row.deleteTimer);
  azSalesTempFiles.delete(id);
  const filePath = row && row.filePath ? row.filePath : path.join(AZOBSS_SALES_TEMP_DIR, id);
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
  return Boolean(row);
}
function azSalesTempScheduleDelete(row, delayMs) {
  if (!row || !row.id) return;
  if (row.deleteTimer) clearTimeout(row.deleteTimer);
  const delay = Math.max(1000, Number(delayMs) || azSalesTempAfterAccessMs());
  row.deleteAt = Date.now() + delay;
  row.deleteTimer = setTimeout(() => azSalesTempDelete(row.id), delay);
  if (row.deleteTimer && typeof row.deleteTimer.unref === "function") row.deleteTimer.unref();
}
function azSalesTempSweep() {
  const now = Date.now();
  for (const row of azSalesTempFiles.values()) {
    if (!row || Number(row.expiresAt || 0) <= now || (row.deleteAt && row.deleteAt <= now)) azSalesTempDelete(row && row.id);
  }
  try {
    azSalesTempEnsureDir();
    for (const name of fs.readdirSync(AZOBSS_SALES_TEMP_DIR)) {
      const filePath = path.join(AZOBSS_SALES_TEMP_DIR, name);
      try { const stat = fs.statSync(filePath); if (now - stat.mtimeMs > azSalesTempHardTtlMs()) fs.unlinkSync(filePath); } catch (_) {}
    }
  } catch (_) {}
}
azSalesTempEnsureDir();
try { azSalesTempSweep(); } catch (_) {}
const azSalesTempSweepTimer = setInterval(azSalesTempSweep, 5 * 60 * 1000);
if (azSalesTempSweepTimer && typeof azSalesTempSweepTimer.unref === "function") azSalesTempSweepTimer.unref();
function azSalesTempFilenameHeader(req, contentType) {
  let raw = String(req.headers["x-azobss-filename"] || "");
  try { raw = decodeURIComponent(raw); } catch (_) {}
  return azSalesShareSafeFilename(raw, contentType);
}
function azSalesTempDocumentNoHeader(req, filename) {
  let raw = String(req.headers["x-azobss-document-no"] || "");
  try { raw = decodeURIComponent(raw); } catch (_) {}
  return cleanPremiumText(raw || filename.replace(/\.[^.]+$/, ""), 180);
}
function azSalesTempIssue(req, buffer) {
  const rawType = String(req.headers["content-type"] || "application/pdf").split(";")[0].trim().toLowerCase();
  const isZip = /application\/zip|application\/x-zip-compressed/.test(rawType);
  const contentType = isZip ? "application/zip" : "application/pdf";
  if (!isZip && rawType !== "application/pdf") throw Object.assign(new Error("Only PDF or ZIP temporary files are supported."), { statusCode:415 });
  if (!buffer || !buffer.length) throw Object.assign(new Error("Generated document is empty."), { statusCode:400 });
  if (buffer.length > azSalesTempMaxBytes()) throw Object.assign(new Error(`Generated document exceeds the ${Math.floor(azSalesTempMaxBytes()/1024/1024)} MB temporary limit.`), { statusCode:413 });
  if (isZip && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw Object.assign(new Error("Invalid ZIP file."), { statusCode:400 });
  if (!isZip && buffer.subarray(0,5).toString("ascii") !== "%PDF-") throw Object.assign(new Error("Invalid PDF file."), { statusCode:400 });
  azSalesTempEnsureDir();
  let id = azSalesTempNewId(); while (azSalesTempFiles.has(id)) id = azSalesTempNewId();
  const filename = azSalesTempFilenameHeader(req, contentType);
  const documentNo = azSalesTempDocumentNoHeader(req, filename);
  const filePath = path.join(AZOBSS_SALES_TEMP_DIR, id);
  fs.writeFileSync(filePath, buffer, { mode:0o600 });
  const now = Date.now();
  const row = { id, filename, documentNo, contentType, size:buffer.length, filePath, createdAt:now, expiresAt:now + azSalesTempHardTtlMs(), firstAccessAt:0, lastAccessAt:0, accessCount:0, deleteAt:0, deleteTimer:null };
  azSalesTempFiles.set(id, row);
  azSalesTempScheduleDelete(row, azSalesTempHardTtlMs());
  const base = publicBaseUrlFromReq(req);
  const encodedName = encodeURIComponent(filename);
  return {
    ok:true, patch:AZOBSS_SALES_TEMP_PATCH, id, filename, documentNo, contentType, size:buffer.length,
    viewUrl:`${base}/t/${id}/${encodedName}`,
    shareUrl:`${base}/t/${id}/${encodedName}`,
    downloadUrl:`${base}/t/${id}/${encodedName}?download=1`,
    printUrl:`${base}/t/${id}/${encodedName}`,
    deleteUrl:`${base}/api/admin/sales-document/temp/${id}`,
    expiresAt:new Date(row.expiresAt).toISOString(),
    expiresInMinutes:Math.floor(azSalesTempHardTtlMs()/60000),
    deleteAfterAccessMinutes:Math.floor(azSalesTempAfterAccessMs()/60000)
  };
}
function azSalesTempPublicRow(id) {
  id = azSalesTempSafeId(id);
  const row = id ? azSalesTempFiles.get(id) : null;
  if (!row || Number(row.expiresAt || 0) <= Date.now() || !fs.existsSync(row.filePath)) {
    if (id) azSalesTempDelete(id);
    return null;
  }
  return row;
}
function azSalesTempServe(req, res, parsed, id) {
  const row = azSalesTempPublicRow(id);
  if (!row) return send(res, 404, "Temporary document expired or was deleted.", "text/plain; charset=utf-8", { "Cache-Control":"no-store" });
  row.accessCount += 1; row.lastAccessAt = Date.now(); if (!row.firstAccessAt) row.firstAccessAt = row.lastAccessAt;
  azSalesTempScheduleDelete(row, azSalesTempAfterAccessMs());
  const stat = fs.statSync(row.filePath); const total = stat.size;
  const disposition = String(parsed.query.download || "") === "1" ? "attachment" : "inline";
  const headers = azSecurityHeaders({
    "Content-Type":row.contentType,
    "Content-Disposition":`${disposition}; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
    "Accept-Ranges":"bytes",
    "Cache-Control":"no-store, private, max-age=0",
    "X-AZOBSS-Temporary-File":"1",
    "X-AZOBSS-Delete-After-Access-Minutes":String(Math.floor(azSalesTempAfterAccessMs()/60000))
  });
  const range = String(req.headers.range || "");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/i);
    if (!match) { res.writeHead(416, { ...headers, "Content-Range":`bytes */${total}` }); return res.end(); }
    let start = match[1] ? Number(match[1]) : 0; let end = match[2] ? Number(match[2]) : total - 1;
    if (!match[1] && match[2]) { const suffix = Number(match[2]); start = Math.max(0, total - suffix); end = total - 1; }
    start = Math.max(0, Math.min(total - 1, start)); end = Math.max(start, Math.min(total - 1, end));
    res.writeHead(206, { ...headers, "Content-Range":`bytes ${start}-${end}/${total}`, "Content-Length":String(end-start+1) });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(row.filePath, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "Content-Length":String(total) });
  if (req.method === "HEAD") return res.end();
  return fs.createReadStream(row.filePath).pipe(res);
}

function azR2LookupKey(value = "") {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function azSafeR2ObjectKey(value = "") {
  const key = String(value || "").trim()
    .replace(/^r2\s*object\s*key\s*:\s*/i, "")
    .replace(/^r2\s*:\s*/i, "")
    .replace(/^\/+/, "");
  if (!key || key.length > 600 || key.includes("..") || key.includes("\\")) return "";
  if (!/^software\//i.test(key) && !/^cad\//i.test(key)) return "";
  return key;
}
function azR2ObjectMapFromEnv() {
  const raw = String(process.env.AZOBSS_R2_OBJECT_MAP || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    console.warn("AZOBSS_R2_OBJECT_MAP is not valid JSON:", err && (err.message || err));
    return {};
  }
}
function azBuiltInR2ObjectKey(text = "") {
  const key = azR2LookupKey(text);
  if (!key) return "";
  if (key.includes("connectivity repair")) return "software/AZOBSS-Connectivity-Repair.exe";
  if (key.includes("windows update oneclick fix") || key.includes("windows update one click fix")) return "software/AZOBSS-Windows-Update-OneClick-Fix.exe";
  if (key.includes("anydesk ads remover")) return "software/AnyDesk-Ads-Remover-v2.1.0.exe";
  if (key.includes("solattime") || key.includes("solat time")) return "software/Azobss_SolatTime_Setup_v1_0_2.exe";
  if (key.includes("printer oneclick fix") || key.includes("printer one click fix")) return "software/Printer-OneClick-Fix.exe";
  return "";
}
function azResolvePremiumR2Object(saved = {}) {
  const product = saved && typeof saved.product === "object" ? saved.product : {};
  const explicit = [
    saved.r2ObjectKey, saved.r2Key, saved.downloadObjectKey, saved.privateObjectKey,
    product.r2ObjectKey, product.r2Key, product.downloadObjectKey, product.privateObjectKey,
    saved.secureDownloadLink, saved.privateDownloadLink, saved.premiumDownloadFileLink,
    product.secureDownloadLink, product.privateDownloadLink, product.premiumDownloadFileLink
  ];
  for (const value of explicit) {
    const valid = azSafeR2ObjectKey(value);
    if (valid) return { key: valid, source: "explicit" };
  }

  const source = azPremiumDownloadSource(saved);
  let sourceFilename = "";
  try { sourceFilename = decodeURIComponent(path.basename(new URL(source).pathname || "")); } catch (_) {}
  const directFilename = String(saved.filename || saved.fileName || saved.productFilename || saved.softwareFilename || product.filename || product.fileName || "");
  const candidates = [
    saved.productId, saved.softwareId, saved.cadId, saved.id,
    saved.productName, saved.productTitle, saved.itemName, saved.title,
    product.productId, product.id, product.name, product.title,
    directFilename, sourceFilename
  ].filter(Boolean).map(v => String(v));

  const envMap = azR2ObjectMapFromEnv();
  for (const candidate of candidates) {
    const direct = azSafeR2ObjectKey(envMap[candidate]);
    if (direct) return { key: direct, source: "env-map" };
    const normalized = azR2LookupKey(candidate);
    const normalizedValue = azSafeR2ObjectKey(envMap[normalized]);
    if (normalizedValue) return { key: normalizedValue, source: "env-map-normalized" };
  }
  for (const [mapKey, mapValue] of Object.entries(envMap)) {
    if (!candidates.some(candidate => azR2LookupKey(candidate) === azR2LookupKey(mapKey))) continue;
    const valid = azSafeR2ObjectKey(mapValue);
    if (valid) return { key: valid, source: "env-map-scan" };
  }

  for (const candidate of candidates) {
    const builtIn = azSafeR2ObjectKey(azBuiltInR2ObjectKey(candidate));
    if (builtIn) return { key: builtIn, source: "built-in-698" };
  }
  return null;
}
function azBase64Url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function azCreateR2SignedToken(session = {}) {
  const secret = azR2TokenSecret();
  const key = azSafeR2ObjectKey(session.sourceTarget || session.r2ObjectKey || "");
  const exp = Math.floor(Number(session.expiresAt || 0) / 1000);
  if (!secret || !key || !Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return "";
  const payload = {
    key,
    name: azSafeDownloadFilename(session.filename || path.basename(key) || "AZOBSS-Download.bin"),
    exp,
    sid: String(session.sessionId || "").slice(0, 160),
    oid: String(session.orderId || "").slice(0, 180)
  };
  const payloadPart = azBase64Url(JSON.stringify(payload));
  const signaturePart = crypto.createHmac("sha256", secret).update(payloadPart).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${payloadPart}.${signaturePart}`;
}
function azR2DownloadUrlForSession(session = {}) {
  const base = azR2DownloadBaseUrl();
  const token = azCreateR2SignedToken(session);
  return base && token ? `${base}/dl/${encodeURIComponent(token)}` : "";
}

// AZOBSS PATCH 707: Cloudflare Worker confirmation gate.
// R2 customers open the Worker directly, so a sleeping Render Free instance is not
// in the customer download path. The Worker creates the short /dl/ token itself.
function azR2GateTtlSeconds() {
  const n = Number(process.env.AZOBSS_R2_GATE_TTL_SECONDS || 7 * 24 * 60 * 60);
  return Number.isFinite(n) ? Math.max(60 * 60, Math.min(Math.floor(n), 30 * 24 * 60 * 60)) : 7 * 24 * 60 * 60;
}
function azR2GateExpirySeconds(saved = {}) {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const capSec = nowSec + azR2GateTtlSeconds();
  const raw = [
    saved.expiresAtMs, saved.expiresAt, saved.tokenExpiresAtMs,
    saved.downloadExpiresAtMs, saved.activeDownloadSessionExpiresAt
  ];
  let expiryMs = 0;
  for (const value of raw) {
    const n = Number(value || 0);
    if (Number.isFinite(n) && n > nowMs) { expiryMs = n; break; }
  }
  if (!expiryMs) {
    for (const value of [saved.tokenExpiresAt, saved.expiresAtIso, saved.downloadExpiresAtClient]) {
      const n = Date.parse(String(value || ""));
      if (Number.isFinite(n) && n > nowMs) { expiryMs = n; break; }
    }
  }
  if (saved.expiresNever === true || azobssOrderNeverExpire(saved)) return capSec;
  if (!expiryMs) return capSec;
  return Math.max(nowSec + 60, Math.min(Math.floor(expiryMs / 1000), capSec));
}
function azR2GateUsageId(saved = {}) {
  const seed = String(saved.token || saved.downloadToken || saved.orderId || saved.billCode || saved.productId || makeId("r2g"));
  return crypto.createHmac("sha256", azR2TokenSecret()).update(`azobss-r2-gate:${seed}`).digest("hex").slice(0, 48);
}
function azCreateR2GateSignedToken(saved = {}) {
  const secret = azR2TokenSecret();
  const r2Info = azResolvePremiumR2Object(saved);
  const key = r2Info && azSafeR2ObjectKey(r2Info.key);
  if (!secret || !key) return "";
  const backendToken = cleanPremiumText(saved.token || saved.downloadToken || "", 220);
  const payload = {
    mode: "gate",
    key,
    name: azSafeDownloadFilename(saved.filename || saved.fileName || saved.productFilename || saved.softwareFilename || path.basename(key) || "AZOBSS-Download.bin"),
    title: cleanPremiumText(saved.productName || (saved.product && saved.product.name) || "AZOBSS Digital Product", 180),
    exp: azR2GateExpirySeconds(saved),
    tid: azR2GateUsageId(saved),
    oid: cleanPremiumText(saved.orderId || "", 180),
    pid: cleanPremiumText(saved.productId || "", 180),
    bt: backendToken,
    max: Math.max(1, Math.min(100, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1)),
    used: Math.max(0, Number(saved.usedCount || saved.downloadCount || saved.downloadsUsed || 0) || 0)
  };
  const payloadPart = azBase64Url(JSON.stringify(payload));
  const signaturePart = crypto.createHmac("sha256", secret).update(payloadPart).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${payloadPart}.${signaturePart}`;
}
function azR2GateUrlForSaved(saved = {}) {
  const base = azR2DownloadBaseUrl();
  const token = azCreateR2GateSignedToken(saved);
  return base && token ? `${base}/gate/${encodeURIComponent(token)}` : "";
}
function azPreferredPremiumDownloadUrl(saved = {}, base = "") {
  const gate = azR2GateUrlForSaved(saved);
  if (gate) return gate;
  const token = cleanPremiumText(saved.token || saved.downloadToken || "", 220);
  return token && base ? `${String(base).replace(/\/+$/, "")}/api/premium/download/${encodeURIComponent(token)}` : "";
}

// AZOBSS PATCH 708: Verify a claimed Free Promo unit before issuing a private R2 gate.
function azPromoFreeTruth(value) {
  return value === true || value === 1 || value === "1" || /^(true|yes|y|on|enabled|aktif)$/i.test(String(value || "").trim());
}
function azPromoFreeSlug(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "software-item";
}
function azPromoFreeConfig(product = {}) {
  const productId = cleanPremiumText(product.productId || product.id || product.sku || "", 180);
  const batchId = cleanPremiumText(product.promoFreeBatchId || product.promoBatchId || product.promoFreeStartedAtMs || "default", 120) || "default";
  const rawLimit = Number(product.promoFreeLimit ?? product.promoFreeUnits ?? product.freePromoUnits ?? product.promoDownloadUnits ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.max(0, Math.floor(rawLimit)) : 0;
  const enabled = azPromoFreeTruth(product.promoFreeEnabled || product.freePromoEnabled || product.promoFreeDownloadEnabled) && limit > 0;
  return { productId, batchId, limit, enabled, statsKey:"promo-free-" + azPromoFreeSlug(`${productId}-${batchId}`) };
}
async function azVerifyPromoFreeClaim(product = {}, identity = {}, data = {}) {
  const config = azPromoFreeConfig(product);
  if (!config.enabled) throw Object.assign(new Error("Free Promo is not active for this product."), { statusCode:403 });
  const db = getAzobssBackendDb();
  if (!db) throw Object.assign(new Error("Firebase backend is not configured for Free Promo verification."), { statusCode:503 });
  const claimId = cleanPremiumText(data.claimId || "", 140).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!claimId) throw Object.assign(new Error("Free Promo claim ID is missing."), { statusCode:400 });
  const snap = await db.collection("settings").doc("softwareStats").get();
  const rootData = snap.exists ? (snap.data() || {}) : {};
  const row = rootData.items && rootData.items[config.statsKey] ? rootData.items[config.statsKey] : {};
  const claims = row.claims && typeof row.claims === "object" ? row.claims : {};
  const claim = claims[claimId] || null;
  if (!claim) throw Object.assign(new Error("Free Promo claim was not found. Please press the promo button again."), { statusCode:409 });
  const identityUid = String(identity.uid || "").trim();
  const claimUid = String(claim.uid || "").trim();
  if (!identityUid || !claimUid || identityUid !== claimUid) throw Object.assign(new Error("This Free Promo claim belongs to another account."), { statusCode:403 });
  const claimNo = Math.max(1, Math.floor(Number(claim.claimNo || data.claimed || row.claimed || 1) || 1));
  if (claimNo > config.limit) throw Object.assign(new Error("Free Promo claim exceeds the configured unit limit."), { statusCode:409 });
  return { ...config, claimId, claimNo, claim };
}
function azR2PreflightMode() {
  const explicit = String(process.env.AZOBSS_R2_PREFLIGHT_MODE || "").trim().toLowerCase();
  if (["blocking", "sync", "wait"].includes(explicit)) return "blocking";
  if (["background", "async", "1", "true", "on"].includes(explicit)) return "background";
  if (["off", "0", "false", "disabled"].includes(explicit)) return "off";

  // Backward compatibility: the old AZOBSS_R2_PREFLIGHT_HEAD=1 setting now runs
  // in the background so it never delays the customer redirect. Blocking checks
  // must be requested explicitly with AZOBSS_R2_PREFLIGHT_MODE=blocking.
  const legacy = String(process.env.AZOBSS_R2_PREFLIGHT_HEAD || "").trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(legacy)) return "background";
  return "off";
}
async function azPreflightR2Session(session = {}) {
  const target = azR2DownloadUrlForSession(session);
  if (!target) throw Object.assign(new Error("R2 download gateway is not configured."), { statusCode: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(target, { method: "HEAD", redirect: "manual", signal: controller.signal });
    if (response.status === 200 || response.status === 206) return true;
    if (response.status === 404) throw Object.assign(new Error("The private R2 file for this product was not found."), { statusCode: 404 });
    if (response.status === 403) throw Object.assign(new Error("R2 token verification failed. Check that the Worker and Render secrets are identical."), { statusCode: 503 });
    throw Object.assign(new Error(`R2 gateway preflight failed with HTTP ${response.status}.`), { statusCode: 503 });
  } catch (err) {
    if (err && err.statusCode) throw err;
    const message = err && err.name === "AbortError" ? "R2 gateway preflight timed out." : `R2 gateway preflight failed: ${err && err.message ? err.message : err}`;
    throw Object.assign(new Error(message), { statusCode: 503 });
  } finally {
    clearTimeout(timer);
  }
}
function azStartR2Preflight(session = {}) {
  const mode = azR2PreflightMode();
  if (mode === "off") return Promise.resolve(true);
  if (mode === "blocking") return azPreflightR2Session(session);
  azFireAndForget(azPreflightR2Session(session), "AZOBSS R2 background preflight failed:");
  return Promise.resolve(true);
}

async function azCreatePremiumDownloadSession(req, token, saved = {}) {
  const now = Date.now();
  const clientKey = azPremiumClientKey(req);
  const activeSessionId = cleanPremiumText(saved.activeDownloadSessionId || "", 140);
  const activeExpiresAt = Number(saved.activeDownloadSessionExpiresAt || 0) || 0;
  if (activeSessionId && activeExpiresAt > now) {
    const active = await azFindPremiumSessionDeep(activeSessionId);
    if (active && ["active", "completed"].includes(String(active.status || "active")) && Number(active.expiresAt || 0) > now) {
      updatePremiumDownloadSession(activeSessionId, {
        status: "active",
        lastSeenAt: new Date(now).toISOString(),
        lastSeenAtMs: now,
        tokenRouteHits: Number(active.tokenRouteHits || 0) + 1,
        idmHandoffReuse: true
      });
      azSyncPremiumOrderDownloadUsage(saved, token, Math.max(0, Number(saved.usedCount || saved.downloadCount || 0) || 0), activeSessionId, activeExpiresAt, now);
      return activeSessionId;
    }
  }
  if (azobssTokenIsExpired(saved, now) || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
    throw Object.assign(new Error("Download link expired or already used too many times."), { statusCode: 403 });
  }

  const r2Info = azResolvePremiumR2Object(saved);
  let sourceInfo;
  if (r2Info && azR2Configured()) sourceInfo = { type: "r2", target: r2Info.key, mapSource: r2Info.source };
  else sourceInfo = azValidatePremiumSource(azPremiumDownloadSource(saved));

  const sessionId = makeId("dls").replace(/[^a-zA-Z0-9_-]/g, "");
  const ttlMs = sourceInfo.type === "r2"
    ? Math.min(azPremiumSessionTtlMs(), azR2TokenTtlSeconds() * 1000)
    : azPremiumSessionTtlMs();
  const expiresAt = now + ttlMs;
  const filename = sourceInfo.type === "r2"
    ? azSafeDownloadFilename(saved.filename || saved.fileName || saved.productFilename || saved.softwareFilename || path.basename(sourceInfo.target))
    : azPremiumDownloadFilename(saved, sourceInfo.target);
  const nextUsed = Number(saved.usedCount || 0) + 1;
  const session = {
    sessionId,
    token,
    orderId: saved.orderId || "",
    productId: saved.productId || "",
    productName: saved.productName || "AZOBSS Digital Product",
    sourceType: sourceInfo.type,
    sourceTarget: sourceInfo.target,
    r2ObjectKey: sourceInfo.type === "r2" ? sourceInfo.target : "",
    r2MapSource: sourceInfo.mapSource || "",
    filename,
    status: "active",
    clientKey,
    ipHash: azHashDownloadValue(azPremiumClientIp(req)),
    createdAt: new Date(now).toISOString(),
    createdAtMs: now,
    expiresAt,
    expiresAtIso: new Date(expiresAt).toISOString(),
    requestCount: 0,
    rangeRequestCount: 0,
    tokenRouteHits: 1,
    deliveryMode: sourceInfo.type === "r2" ? "cloudflare-r2-worker" : "backend-stream",
    patch: sourceInfo.type === "r2" ? AZOBSS_R2_DOWNLOAD_PATCH : AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH
  };

  // The signed Worker URL is generated locally and should redirect immediately.
  // Optional R2 verification is non-blocking by default; only explicit
  // AZOBSS_R2_PREFLIGHT_MODE=blocking waits before redirecting the customer.
  if (sourceInfo.type === "r2") await azStartR2Preflight(session);

  savePremiumDownloadSession(session);
  const lastMethod = sourceInfo.type === "r2" ? "R2_WORKER_SESSION" : "SESSION_STREAM";
  updatePremiumToken(token, t => ({
    ...t,
    usedCount: nextUsed,
    lastUsedAt: now,
    lastMethod,
    activeDownloadSessionId: sessionId,
    activeDownloadSessionExpiresAt: expiresAt,
    r2ObjectKey: sourceInfo.type === "r2" ? sourceInfo.target : (t.r2ObjectKey || ""),
    secureDownloadPatch: sourceInfo.type === "r2" ? AZOBSS_R2_DOWNLOAD_PATCH : AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH
  }));
  azFireAndForget(azUpdatePremiumTokenPersistent(token, {
    usedCount: nextUsed,
    lastUsedAt: now,
    lastMethod,
    activeDownloadSessionId: sessionId,
    activeDownloadSessionExpiresAt: expiresAt,
    r2ObjectKey: sourceInfo.type === "r2" ? sourceInfo.target : "",
    secureDownloadPatch: sourceInfo.type === "r2" ? AZOBSS_R2_DOWNLOAD_PATCH : AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH
  }), "Premium token Firestore session update failed:");
  azSyncPremiumOrderDownloadUsage(saved, token, nextUsed, sessionId, expiresAt, now);
  return sessionId;
}

function azNoStoreDownloadHeaders(extra = {}) {
  return azSecurityHeaders(Object.assign({
    "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-AZOBSS-Secure-Download": "1"
  }, extra || {}));
}
function azCopyFetchHeader(srcHeaders, out, name, outName = name) {
  try {
    const v = srcHeaders.get(name);
    if (v) out[outName] = v;
  } catch (_) {}
}
function azPremiumContentDisposition(filename = "azobss-download.bin") {
  const safe = azSafeDownloadFilename(filename);
  return `attachment; filename="${safe.replace(/"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
function azParseRange(rangeHeader = "", size = 0) {
  const m = String(rangeHeader || "").match(/^bytes=(\d*)-(\d*)$/);
  if (!m || !size) return null;
  let start = m[1] === "" ? null : Number(m[1]);
  let end = m[2] === "" ? null : Number(m[2]);
  if (start === null && end !== null) { start = Math.max(0, size - end); end = size - 1; }
  if (start !== null && end === null) end = size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}
async function azStreamLocalPremiumSession(req, res, session) {
  const filePath = safePath(session.sourceTarget || "");
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "File not found");
  const st = fs.statSync(filePath);
  const range = String(req.headers.range || "").trim();
  const parsed = range ? azParseRange(range, st.size) : null;
  const filename = azSafeDownloadFilename(session.filename || path.basename(filePath));
  if (range && !parsed) {
    res.writeHead(416, azNoStoreDownloadHeaders({ "Content-Range": `bytes */${st.size}`, "Accept-Ranges": "bytes" }));
    return res.end();
  }
  if (parsed) {
    res.writeHead(206, azNoStoreDownloadHeaders({
      "Content-Type": mimeType(filePath),
      "Content-Disposition": azPremiumContentDisposition(filename),
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${parsed.start}-${parsed.end}/${st.size}`,
      "Content-Length": String(parsed.end - parsed.start + 1)
    }));
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath, { start: parsed.start, end: parsed.end }).pipe(res);
    return;
  }
  res.writeHead(200, azNoStoreDownloadHeaders({
    "Content-Type": mimeType(filePath),
    "Content-Disposition": azPremiumContentDisposition(filename),
    "Accept-Ranges": "bytes",
    "Content-Length": String(st.size)
  }));
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(filePath).pipe(res);
}
async function azStreamRemotePremiumSession(req, res, session) {
  const range = String(req.headers.range || "").trim();
  const headers = {};
  if (range) headers.Range = range;
  const upstream = await fetch(session.sourceTarget, { method: req.method === "HEAD" ? "HEAD" : "GET", headers, redirect: "follow" });
  if (![200, 206].includes(upstream.status)) {
    return send(res, 502, "File source cannot be reached right now.");
  }
  // If IDM asks for a range, the upstream should reply 206. A 200 here means the host ignored Range,
  // so we return 502 instead of sending a wrong full-file chunk that may corrupt IDM download.
  if (range && upstream.status !== 206) {
    return send(res, 502, "File host does not support resume/Range for this download. Please try normal browser download or move file to files.azobss.com/private storage with Range support.");
  }
  const out = {
    "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
    "Content-Disposition": azPremiumContentDisposition(session.filename || "azobss-download.bin"),
    "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes"
  };
  azCopyFetchHeader(upstream.headers, out, "content-length");
  azCopyFetchHeader(upstream.headers, out, "content-range");
  azCopyFetchHeader(upstream.headers, out, "etag");
  azCopyFetchHeader(upstream.headers, out, "last-modified");
  res.writeHead(upstream.status, azNoStoreDownloadHeaders(out));
  if (req.method === "HEAD" || !upstream.body) return res.end();
  const nodeStream = Readable.fromWeb(upstream.body);
  await new Promise((resolve, reject) => {
    nodeStream.on("error", reject);
    res.on("finish", resolve);
    res.on("close", resolve);
    nodeStream.pipe(res);
  });
}
async function azHandlePremiumDownloadSession(req, res, sessionId) {
  const cleanSessionId = cleanPremiumText(String(sessionId || "").replace(/[^a-zA-Z0-9_-]/g, ""), 140);
  if (!cleanSessionId) return send(res, 400, "Invalid download session.");
  const now = Date.now();
  let session = await azFindPremiumSessionDeep(cleanSessionId);
  if (!session) return send(res, 404, "Download session not found.");
  const sessionStatus = String(session.status || "active");
  if (!["active", "completed"].includes(sessionStatus) || Number(session.expiresAt || 0) <= now) {
    updatePremiumDownloadSession(cleanSessionId, { status: Number(session.expiresAt || 0) <= now ? "expired" : session.status || "closed", expiredAt: new Date(now).toISOString(), expiredAtMs: now });
    return send(res, 410, "Download session expired. Please request a new token from admin if needed.");
  }
  if (sessionStatus === "completed") updatePremiumDownloadSession(cleanSessionId, { status: "active", reopenedForIdmAt: new Date(now).toISOString(), reopenedForIdmAtMs: now });
  const clientKey = azPremiumClientKey(req);
  const clientKeyChanged = Boolean(session.clientKey && session.clientKey !== clientKey);
  // IDM/browser handoff: do not 403 just because the second downloader uses different headers/IP key.
  // Security relies on short TTL + random sessionId + token cannot create a new session after TTL.
  updatePremiumDownloadSession(cleanSessionId, {
    lastSeenAt: new Date(now).toISOString(),
    lastSeenAtMs: now,
    requestCount: Number(session.requestCount || 0) + 1,
    rangeRequestCount: Number(session.rangeRequestCount || 0) + (req.headers.range ? 1 : 0),
    lastRange: req.headers.range ? String(req.headers.range).slice(0, 120) : "",
    clientKeyChangedDuringSession: clientKeyChanged
  });
  session = { ...session, requestCount: Number(session.requestCount || 0) + 1 };
  if (session.sourceType === "r2") {
    const r2Location = azR2DownloadUrlForSession(session);
    if (!r2Location) return send(res, 503, "R2 download gateway is not configured.");
    updatePremiumDownloadSession(cleanSessionId, { r2RedirectAt: new Date().toISOString(), r2RedirectAtMs: Date.now(), deliveryMode: "cloudflare-r2-worker" });
    res.writeHead(302, azNoStoreDownloadHeaders({ Location: r2Location, "X-AZOBSS-Download-Mode": "r2-worker" }));
    return res.end();
  }
  try {
    if (session.sourceType === "local" || String(session.sourceTarget || "").startsWith("/")) await azStreamLocalPremiumSession(req, res, session);
    else await azStreamRemotePremiumSession(req, res, session);
    // IDM handoff fix: do NOT close the session after the browser's first non-Range request.
    // IDM may take over immediately after that first request. Keep the session active until TTL.
    if (!req.headers.range) updatePremiumDownloadSession(cleanSessionId, { lastFullRequestCompletedAt: new Date().toISOString(), lastFullRequestCompletedAtMs: Date.now() });
  } catch (err) {
    console.error("AZOBSS secure premium session stream failed:", err && (err.stack || err.message || err));
    updatePremiumDownloadSession(cleanSessionId, { lastError: err && err.message ? err.message : String(err), lastErrorAt: new Date().toISOString(), lastErrorAtMs: Date.now() });
    if (!res.headersSent) return send(res, 500, "Download failed. Please contact admin.");
    try { res.destroy(err); } catch (_) {}
  }
}

function azReceiptAmountNumber(order = {}) {
  const direct = Number(order.saleAmount || order.amountRm || order.amountValue || order.total || order.price || 0);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
  const sen = Number(order.amountSen || order.paymentAmountSen || 0);
  if (Number.isFinite(sen) && sen > 0) return Math.round(sen) / 100;
  const raw = String(order.amount || order.amountText || order.saleAmountText || order.priceText || "").replace(/,/g, "");
  const m = raw.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
  return m ? Number(m[1]) : 0;
}
function azReceiptStatusBucket(order = {}) {
  const status = String(order.status || order.paymentStatus || order.payment_state || "").toLowerCase();
  if (["paid","verified","success","completed","approved","confirmed","settled"].includes(status) || order.paid === true || order.isPaid === true) return "paid";
  if (status.includes("cancel") || ["cancelled","canceled","void","aborted"].includes(status)) return "cancelled";
  if (status.includes("fail") || status.includes("reject") || ["failed","declined","rejected","expired"].includes(status)) return "failed";
  return status || "pending";
}
function azReceiptCategory(order = {}) {
  const raw = [order.category, order.productCategory, order.productType, order.itemType, order.type, order.source, order.productName, order.itemName, order.title].map(v => String(v || "").toLowerCase()).join(" ");
  if (raw.includes("cad") || raw.includes("lisp") || raw.includes("autocad") || raw.includes("dwg")) return "CAD Tools";
  if (raw.includes("software") || raw.includes("premium") || raw.includes("license") || raw.includes("download")) return "Software";
  if (raw.includes("pa") || raw.includes("bm") || raw.includes("pabm") || raw.includes("lot") || raw.includes("kadaster")) return "PA/BM";
  if (isPaBmPremiumOrder(order)) return "PA/BM";
  return "Digital Product";
}
function azReceiptNo(order = {}) {
  return cleanPremiumText(order.receiptNo || order.orderId || order.billCode || order.paymentReference || order.transactionId || order.txnId || order.docId || order.id || "AZOBSS-RECEIPT", 160) || "AZOBSS-RECEIPT";
}
function azReceiptProductName(order = {}) {
  return cleanPremiumText(order.productName || order.productTitle || order.itemName || order.title || order.name || order.filename || order.itemCode || (order.product && (order.product.name || order.product.title || order.product.productName)) || "AZOBSS Digital Product", 220);
}
function azReceiptProductId(order = {}) {
  return cleanPremiumText(order.productId || order.softwareId || order.cadId || order.itemCode || order.noPa || order.noBm || (order.product && (order.product.id || order.product.productId)) || "", 180);
}
function azReceiptBuyerUsername(order = {}) {
  const user = order.user && typeof order.user === "object" ? order.user : {};
  return cleanPremiumText(user.username || order.username || order.usernameKey || order.displayName || order.buyerName || "", 120);
}
function azReceiptBuyerEmail(order = {}) {
  const user = order.user && typeof order.user === "object" ? order.user : {};
  return cleanPremiumText(azPickPremiumBuyerEmailFromOrder(order), 180);
}
function azReceiptDate(order = {}) {
  const raw = order.paidAt || order.completedAt || order.updatedAt || order.createdAt || order.created_at || "";
  const ms = Number(order.paidAtMs || order.completedAtMs || order.updatedAtMs || order.createdAtMs || 0) || Date.parse(raw || "") || Date.now();
  return new Date(ms).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: true });
}
function azNormalizePaymentReceiptOrder(order = {}, source = "") {
  const amount = azReceiptAmountNumber(order);
  const out = {
    ...(order || {}),
    receiptNo: azReceiptNo(order),
    receiptStatus: azReceiptStatusBucket(order),
    receiptCategory: azReceiptCategory(order),
    receiptProductName: azReceiptProductName(order),
    receiptProductId: azReceiptProductId(order),
    receiptAmount: amount,
    receiptAmountText: amount ? azMoneyRm(amount) : cleanPremiumText(order.amount || order.amountText || order.saleAmountText || "RM0.00", 80),
    receiptBuyerUsername: azReceiptBuyerUsername(order),
    receiptBuyerEmail: azReceiptBuyerEmail(order),
    receiptDateText: azReceiptDate(order),
    receiptSource: source || order._azSource || order.__source || order.source || "payment-record"
  };
  return out;
}
function azReceiptHtmlRows(rows = []) {
  return rows.map(([k, v]) => `<tr><th>${azHtmlEscape(k)}</th><td>${azHtmlEscape(v || "-")}</td></tr>`).join("");
}
function buildReceiptHtml(order) {
  const o = azNormalizePaymentReceiptOrder(order || {}, order && order.receiptSource || "");
  const status = String(o.receiptStatus || "pending").toUpperCase();
  const issuedAt = new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: true });
  const rows = azReceiptHtmlRows([
    ["Receipt / Invoice No", o.receiptNo],
    ["Status", status],
    ["Category", o.receiptCategory],
    ["Product", o.receiptProductName],
    ["Product ID", o.receiptProductId || "-"],
    ["Amount", o.receiptAmountText],
    ["Payment Method", o.paymentMethod || "toyyibpay"],
    ["Payment Reference", o.paymentReference || o.billCode || o.transactionId || o.txnId || "-"],
    ["Bill Code", o.billCode || "-"],
    ["Username", o.receiptBuyerUsername || "-"],
    ["Email", o.receiptBuyerEmail || "-"],
    ["Payment Date", o.receiptDateText],
    ["Source", o.receiptSource || "-"]
  ]);
  const paidClass = o.receiptStatus === "paid" ? "ok" : (o.receiptStatus === "pending" ? "warn" : "bad");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AZOBSS Receipt ${azHtmlEscape(o.receiptNo)}</title><style>body{font-family:Arial,sans-serif;background:#f6f7fb;color:#111;margin:0;padding:24px}.receipt{max-width:860px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 20px 60px rgba(15,23,42,.10);overflow:hidden}.head{background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#fff;padding:26px}.head h1{margin:0 0 8px;font-size:28px}.head p{margin:0;color:#dbeafe}.content{padding:24px}.amount{font-size:34px;font-weight:900;margin:6px 0 12px}.badge{display:inline-block;border-radius:999px;padding:6px 10px;font-weight:800}.ok{color:#047857;background:#ecfdf5;border:1px solid #a7f3d0}.warn{color:#a16207;background:#fefce8;border:1px solid #fde68a}.bad{color:#b91c1c;background:#fef2f2;border:1px solid #fecaca}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;border-bottom:1px solid #e5e7eb;padding:11px;vertical-align:top}th{width:210px;background:#f8fafc;color:#334155}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}button{border:0;border-radius:10px;background:#111827;color:#fff;padding:11px 15px;font-weight:800;cursor:pointer}.muted{font-size:12px;color:#64748b;margin-top:18px}@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border:0}.actions{display:none}}</style></head><body><div class="receipt"><div class="head"><h1>AZOBSS Payment Receipt / Invoice</h1><p>${azHtmlEscape(o.receiptNo)}</p></div><div class="content"><div class="badge ${paidClass}">${azHtmlEscape(status)}</div><div class="amount">${azHtmlEscape(o.receiptAmountText)}</div><table>${rows}</table><div class="actions"><button onclick="window.print()">Print / Save PDF</button><button onclick="window.close()">Close</button></div><p class="muted">Generated at ${azHtmlEscape(issuedAt)}. This receipt is generated from AZOBSS payment records for purchase verification.</p></div></div></body></html>`;
}
async function buildReceiptPdfBuffer(order = {}) {
  if (!PDFDocument) throw new Error("PDFKit dependency missing. Deploy backend with pdfkit installed.");
  const o = azNormalizePaymentReceiptOrder(order || {}, order && order.receiptSource || "");
  const rows = [
    ["Receipt / Invoice No", o.receiptNo],
    ["Status", String(o.receiptStatus || "pending").toUpperCase()],
    ["Category", o.receiptCategory],
    ["Product", o.receiptProductName],
    ["Product ID", o.receiptProductId || "-"],
    ["Amount", o.receiptAmountText],
    ["Payment Method", o.paymentMethod || "toyyibpay"],
    ["Payment Reference", o.paymentReference || o.billCode || o.transactionId || o.txnId || "-"],
    ["Bill Code", o.billCode || "-"],
    ["Username", o.receiptBuyerUsername || "-"],
    ["Email", o.receiptBuyerEmail || "-"],
    ["Payment Date", o.receiptDateText],
    ["Source", o.receiptSource || "-"]
  ];
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `AZOBSS Receipt ${o.receiptNo}`, Creator: "AZOBSS" } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.rect(0, 0, doc.page.width, 118).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(24).text("AZOBSS Payment Receipt / Invoice", 48, 36, { width: 500 });
    doc.fontSize(11).fillColor("#dbeafe").text(String(o.receiptNo || "-"), 48, 70);
    doc.moveDown(3);
    doc.y = 142;
    doc.fillColor("#111827").fontSize(12).text("Amount", 48, doc.y);
    doc.fontSize(30).fillColor("#111827").text(String(o.receiptAmountText || "RM0.00"), 48, doc.y + 4);
    doc.fontSize(12).fillColor(o.receiptStatus === "paid" ? "#047857" : (o.receiptStatus === "pending" ? "#a16207" : "#b91c1c")).text("Status: " + String(o.receiptStatus || "pending").toUpperCase(), 48, doc.y + 8);
    doc.moveDown(1.5);
    const labelW = 165;
    const valueW = doc.page.width - 96 - labelW;
    let y = doc.y + 12;
    rows.forEach(([label, value], idx) => {
      const rowH = Math.max(28, doc.heightOfString(String(value || "-"), { width: valueW }) + 14);
      if (y + rowH > doc.page.height - 70) { doc.addPage({ margin: 48 }); y = 48; }
      if (idx % 2 === 0) doc.rect(48, y, doc.page.width - 96, rowH).fill("#f8fafc");
      doc.fillColor("#334155").fontSize(10).text(String(label), 58, y + 8, { width: labelW - 12 });
      doc.fillColor("#111827").fontSize(10).text(String(value || "-"), 48 + labelW, y + 8, { width: valueW });
      doc.strokeColor("#e5e7eb").moveTo(48, y + rowH).lineTo(doc.page.width - 48, y + rowH).stroke();
      y += rowH;
    });
    const issuedAt = new Date().toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", hour12: true });
    doc.fillColor("#64748b").fontSize(9).text("Generated at " + issuedAt + ". This receipt is generated from AZOBSS payment records for purchase verification.", 48, doc.page.height - 52, { width: doc.page.width - 96 });
    doc.end();
  });
}
function azReceiptFilename(order = {}, ext = "pdf") {
  const base = String(azReceiptNo(order) || "azobss-receipt").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "azobss-receipt";
  return `${base}.${ext === "html" ? "html" : "pdf"}`;
}
async function azFindPaBmReceiptRecord(identifier = "") {
  const id = cleanPremiumText(identifier || "", 180);
  if (!id) return null;
  const db = getAzobssBackendDb();
  if (!db) return null;
  try {
    const direct = await db.collection("purchaseLogs").doc(id).get();
    if (direct.exists) return azNormalizePaymentReceiptOrder({ docId: direct.id, ...(direct.data() || {}) }, "purchaseLogs");
  } catch (_) {}
  const fields = ["orderId", "billCode", "paymentReference", "transactionId", "txnId", "receiptNo", "itemCode"];
  for (const field of fields) {
    try {
      const q = await db.collection("purchaseLogs").where(field, "==", id).limit(1).get();
      if (!q.empty) { const d = q.docs[0]; return azNormalizePaymentReceiptOrder({ docId: d.id, ...(d.data() || {}) }, "purchaseLogs"); }
    } catch (_) {}
  }
  try {
    const usersSnap = await db.collection("users").limit(300).get();
    let found = null;
    usersSnap.forEach(userDoc => {
      if (found) return;
      const u = userDoc.data() || {};
      const list = Array.isArray(u.purchaseRecords) ? u.purchaseRecords : [];
      const row = list.find(r => [r && r.id, r && r.recordId, r && r.purchaseLogId, r && r.orderId, r && r.billCode, r && r.paymentReference, r && r.itemCode].some(v => String(v || "") === id));
      if (row) found = azNormalizePaymentReceiptOrder({ ...(row || {}), username: row.username || u.username || userDoc.id, usernameKey: row.usernameKey || u.usernameKey || userDoc.id, email: row.email || u.email || u.authEmail || "", docId: row.id || id }, "users.purchaseRecords");
    });
    if (found) return found;
  } catch (_) {}
  return null;
}
async function azFindAdminPaymentReceiptRecord(identifier = "", source = "") {
  const id = cleanPremiumText(identifier || "", 180);
  const src = String(source || "").toLowerCase();
  if (!id) return null;
  if (!src || src.includes("premium")) {
    let order = null;
    try { order = await azFindReceiptOrder(id); } catch (_) {}
    if (!order) { try { order = await azFindPremiumOrderPersistent({ orderId:id, billCode:id }); } catch (_) {} }
    if (order) return azNormalizePaymentReceiptOrder(order, "premiumOrders");
  }
  if (!src || src.includes("purchase") || src.includes("pabm") || src.includes("log")) {
    const rec = await azFindPaBmReceiptRecord(id);
    if (rec) return rec;
  }
  if (src && !src.includes("premium")) {
    let order = null;
    try { order = await azFindReceiptOrder(id); } catch (_) {}
    if (order) return azNormalizePaymentReceiptOrder(order, "premiumOrders");
  }
  return null;
}


// AZOBSS PATCH 307: Customer My Purchases Pro backend helpers.
function azMyPurchasesIdentityNeedles(identity = {}) {
  const out = new Set();
  [identity.uid, identity.email, identity.authEmail, identity.profileEmail, identity.username]
    .forEach(v => { const s = String(v || "").trim().toLowerCase(); if (s) out.add(s); });
  return out;
}
function azMyPurchasesRecordValues(row = {}) {
  const user = row.user && typeof row.user === "object" ? row.user : {};
  const product = row.product && typeof row.product === "object" ? row.product : {};
  return [
    row.uid, row.userUid, row.buyerUid, row.customerUid, row.createdByUid, row.memberUid, user.uid,
    row.email, row.buyerEmail, row.customerEmail, row.billEmail, row.userEmail, user.email,
    row.username, row.usernameKey, row.displayName, row.buyerName, row.customerName, user.username, user.usernameKey, user.displayName,
    row.receiptBuyerEmail, row.receiptBuyerUsername,
    product.email, product.username, product.usernameKey
  ].map(v => String(v || "").trim().toLowerCase()).filter(Boolean);
}
function azMyPurchasesBelongsToIdentity(row = {}, identity = {}) {
  // AZOBSS PATCH 415:
  // My Purchases is an own-account customer view.
  // Admin all-user viewing remains in Admin Dashboard > Payment Logs / Sales Overview.
  if (!identity || !identity.uid) return false;
  const needles = azMyPurchasesIdentityNeedles(identity);
  if (!needles.size) return false;
  const vals = azMyPurchasesRecordValues(row);
  return vals.some(v => needles.has(v));
}
function azMyPurchasesHiddenKeys(identity = {}) {
  return Array.from(azMyPurchasesIdentityNeedles(identity));
}
function azMyPurchasesIsHiddenForIdentity(row = {}, identity = {}) {
  if (!row || !identity || !identity.uid) return false;
  const keys = azMyPurchasesHiddenKeys(identity);
  if (!keys.length) return false;
  const hidden = []
    .concat(Array.isArray(row.myPurchasesDeletedForKeys) ? row.myPurchasesDeletedForKeys : [])
    .concat(Array.isArray(row.myPurchasesHiddenForKeys) ? row.myPurchasesHiddenForKeys : [])
    .concat(Array.isArray(row.hiddenFor) ? row.hiddenFor : [])
    .concat(Array.isArray(row.deletedFor) ? row.deletedFor : []);
  const hiddenSet = new Set(hidden.map(v => String(v || "").trim().toLowerCase()).filter(Boolean));
  return keys.some(k => hiddenSet.has(k));
}
async function azSoftDeleteMyPurchaseForIdentity(identifier = "", source = "", identity = {}) {
  const id = cleanPremiumText(identifier || "", 180);
  if (!id || !identity || !identity.uid) return { ok:false, error:"Missing purchase id." };
  const src = String(source || "").toLowerCase();
  const keys = azMyPurchasesHiddenKeys(identity);
  const db = getAzobssBackendDb();
  let hidden = false;

  async function markDoc(col, docId, data) {
    if (!db || !docId || !data || !azMyPurchasesBelongsToIdentity(data, identity)) return false;
    try {
      await db.collection(col).doc(docId).set({
        myPurchasesDeletedForKeys: firebaseAdmin.firestore.FieldValue.arrayUnion(...keys),
        myPurchasesDeletedAtMs: Date.now(),
        myPurchasesDeletedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
      }, { merge:true });
      return true;
    } catch (_) { return false; }
  }

  if (db) {
    const cols = src.includes("premium") ? ["premiumOrders"] : src.includes("purchase") ? ["purchaseLogs"] : ["premiumOrders", "purchaseLogs"];
    for (const col of cols) {
      try {
        const direct = await db.collection(col).doc(id).get();
        if (direct.exists && await markDoc(col, direct.id, direct.data() || {})) hidden = true;
      } catch (_) {}
      if (hidden) break;
      for (const field of ["orderId","billCode","paymentReference","transactionId","txnId","itemCode","productId"]) {
        try {
          const snap = await db.collection(col).where(field, "==", id).limit(5).get();
          for (const d of snap.docs) {
            if (await markDoc(col, d.id, d.data() || {})) hidden = true;
          }
        } catch (_) {}
        if (hidden) break;
      }
      if (hidden) break;
    }
  }

  if (src.includes("premium") || !src) {
    try {
      const orders = readPremiumOrders();
      let changed = false;
      const next = orders.map(o => {
        const match = [o.orderId, o.billCode, o.paymentReference, o.transactionId, o.txnId, o.productId, o.id].some(v => String(v || "") === id);
        if (match && azMyPurchasesBelongsToIdentity(o, identity)) {
          const list = new Set([].concat(Array.isArray(o.myPurchasesDeletedForKeys) ? o.myPurchasesDeletedForKeys : []).map(v => String(v || "").trim().toLowerCase()).filter(Boolean));
          keys.forEach(k => list.add(k));
          changed = true; hidden = true;
          return { ...o, myPurchasesDeletedForKeys:Array.from(list), myPurchasesDeletedAtMs:Date.now(), updatedAtMs:Date.now() };
        }
        return o;
      });
      if (changed) writePremiumOrders(next);
    } catch (_) {}
  }

  return { ok:true, hidden, localFallback:true };
}
function azMyPurchasesMs(row = {}) {
  const direct = Number(row.paidAtMs || row.completedAtMs || row.updatedAtMs || row.createdAtMs || row.createdMs || row.timestampMs || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const dates = [row.paidAt, row.completedAt, row.updatedAt, row.createdAt, row.createdAtClient, row.date, row.time];
  for (const d of dates) {
    if (d && typeof d.toMillis === "function") return d.toMillis();
    const ms = Date.parse(String(d || ""));
    if (ms) return ms;
  }
  return 0;
}
function azMyPurchasesPaBmDownloadMeta(row = {}) {
  const paid = azReceiptStatusBucket(row) === "paid";
  const used = Math.max(0, Number(row.downloadCount || row.usedDownloads || 0) || 0);
  const max = Math.max(1, Number(row.maxDownloads || row.maxDownload || 5) || 5);
  let expiresAtMs = Number(row.downloadExpiresAtMs || row.expiresAtMs || 0) || 0;
  const paidAtMs = Number(row.paidAtMs || row.downloadResetAtMs || row.updatedAtMs || row.createdAtMs || 0) || 0;
  if (!expiresAtMs && paidAtMs) expiresAtMs = paidAtMs + (7 * 24 * 60 * 60 * 1000);
  const expired = !!(expiresAtMs && Date.now() > expiresAtMs);
  return { used, max, expiresAtMs, expired, active: !!(paid && used < max && !expired) };
}
function azMyPurchasesPremiumDownloadMeta(row = {}, req = null) {
  const paid = azReceiptStatusBucket(row) === "paid";
  const token = cleanPremiumText(row.downloadToken || row.token || "", 220);
  const used = Math.max(0, Number(row.downloadCount || row.usedCount || row.downloadsUsed || row.usedDownloads || 0) || 0);
  const max = Math.max(1, Number(row.maxDownload || row.maxDownloads || row.downloadLimit || 1) || 1);
  let expiresAtMs = Number(row.tokenExpiresAtMs || row.downloadExpiresAtMs || row.expiresAtMs || 0) || 0;
  if (!expiresAtMs && row.tokenExpiresAt) expiresAtMs = Date.parse(String(row.tokenExpiresAt || "")) || 0;
  if (!expiresAtMs && row.expiresAt) expiresAtMs = Date.parse(String(row.expiresAt || "")) || 0;
  const expiredByTime = !!(expiresAtMs && Date.now() > expiresAtMs);
  const exhausted = used >= max || row.downloadStatus === "used" || row.downloadExpired === true;
  const expired = expiredByTime || exhausted;
  const base = req ? publicBaseUrlFromReq(req) : "";
  return { used, max, expiresAtMs, expired, active: !!(paid && token && used < max && !expiredByTime && !exhausted), url: token && base ? azPreferredPremiumDownloadUrl({ ...row, token, downloadToken:token, usedCount:used, maxDownload:max, expiresAt:expiresAtMs }, base) : "" };
}

// AZOBSS PATCH 382: Reconcile My Purchases Software/CAD download state from premiumDownloadTokens.
// My Purchases cards are based on premiumOrders, but real one-time usage is stored on premiumDownloadTokens.
// This makes used/expired tokens show as Downloaded 1/1 or Download expired, not stale Download 0/1.
function azMyPurchasesTokenMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && n > 100000000000) return n;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return 0;
}
function azExtractPremiumDownloadTokenFromUrl(url = "") {
  try {
    const m = String(url || "").match(/\/api\/premium\/download\/([^?#\/]+)/i);
    return m ? decodeURIComponent(m[1]).replace(/[^a-zA-Z0-9_-]/g, "") : "";
  } catch (_) { return ""; }
}
function azPremiumTokenSortMs(t = {}) {
  return Math.max(
    azMyPurchasesTokenMs(t.lastUsedAt),
    azMyPurchasesTokenMs(t.updatedAtMs || t.updatedAt),
    azMyPurchasesTokenMs(t.createdAtMs || t.createdAt),
    azMyPurchasesTokenMs(t.expiresAtMs || t.expiresAt || t.tokenExpiresAtMs || t.tokenExpiresAt)
  );
}
async function azFindPremiumTokenForMyPurchaseRow(row = {}) {
  const token = cleanPremiumText(row.downloadToken || row.token || azExtractPremiumDownloadTokenFromUrl(row.downloadUrl || ""), 220);
  const orderId = cleanPremiumText(row.orderId || row.recordId || row.receiptNo || "", 180);
  const billCode = cleanPremiumText(row.billCode || "", 120);
  const productId = cleanPremiumText(row.productId || "", 180);
  const candidates = [];
  const push = (x) => { if (x && typeof x === "object") candidates.push({ ...(x || {}), token: x.token || token || "" }); };

  try { if (token) push(findPremiumToken(token)); } catch (_) {}
  try {
    const localTokens = readPremiumJson(PREMIUM_TOKENS_FILE, []);
    (Array.isArray(localTokens) ? localTokens : []).forEach(t => {
      if (!t) return;
      if ((token && t.token === token) || (orderId && t.orderId === orderId) || (billCode && t.billCode === billCode) || (productId && t.productId === productId && t.orderId === orderId)) push(t);
    });
  } catch (_) {}

  try { if (token) push(await azFindPremiumTokenPersistent(token)); } catch (_) {}

  const db = getAzobssBackendDb();
  if (db) {
    async function q(field, value) {
      if (!value) return;
      try {
        const snap = await db.collection("premiumDownloadTokens").where(field, "==", value).limit(5).get();
        snap.forEach(d => push({ docId:d.id, ...(d.data() || {}), token:(d.data() || {}).token || d.id }));
      } catch (_) {}
    }
    await q("orderId", orderId);
    await q("billCode", billCode);
  }

  candidates.sort((a, b) => azPremiumTokenSortMs(b) - azPremiumTokenSortMs(a));
  return candidates[0] || null;
}
function azApplyPremiumTokenToMyPurchasePublicRow(row = {}, tokenData = {}, req = null) {
  if (!row || !tokenData) return row;
  const token = cleanPremiumText(tokenData.token || row.downloadToken || azExtractPremiumDownloadTokenFromUrl(row.downloadUrl || ""), 220);
  const used = Math.max(0, Number(tokenData.usedCount || tokenData.downloadCount || tokenData.downloadsUsed || 0) || 0);
  const max = Math.max(1, Number(tokenData.maxDownload || tokenData.maxDownloads || tokenData.downloadLimit || row.downloadMax || 1) || 1);
  const expiresNever = tokenData.expiresNever === true || azobssOrderNeverExpire(tokenData);
  let expiresAtMs = azMyPurchasesTokenMs(tokenData.expiresAtMs || tokenData.expiresAt || tokenData.tokenExpiresAtMs || tokenData.tokenExpiresAt || row.downloadExpiresAtMs);
  const expiredByTime = !expiresNever && !!(expiresAtMs && Date.now() > expiresAtMs);
  const exhausted = used >= max || String(tokenData.downloadStatus || "").toLowerCase() === "used" || tokenData.downloadExpired === true;
  const expired = expiredByTime || exhausted;
  const base = req ? publicBaseUrlFromReq(req) : "";
  row.downloadUsed = used;
  row.downloadMax = max;
  row.downloadExpiresAtMs = expiresAtMs || row.downloadExpiresAtMs || 0;
  row.downloadExpired = expired;
  row.downloadActive = !!(row.isPaid && token && used < max && !expired);
  row.downloadStatus = exhausted ? "used" : (expiredByTime ? "expired" : (row.downloadActive ? "active" : "unavailable"));
  row.downloadUrl = row.downloadActive && base ? azPreferredPremiumDownloadUrl({ ...row, ...tokenData, token, downloadToken:token, usedCount:used, maxDownload:max, expiresAt:expiresAtMs }, base) : "";
  if (token) row.downloadToken = token;
  return row;
}
function azSyncPremiumOrderTokenState(saved = {}, token = "", now = Date.now()) {
  try {
    if (!saved || !(saved.orderId || saved.billCode || saved.billcode)) return null;
    const used = Math.max(0, Number(saved.usedCount || saved.downloadCount || saved.downloadsUsed || 0) || 0);
    const max = Math.max(1, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1);
    const expiresAtMs = azMyPurchasesTokenMs(saved.expiresAtMs || saved.expiresAt || saved.tokenExpiresAtMs || saved.tokenExpiresAt);
    const expiredByTime = !azobssOrderNeverExpire(saved) && !!(expiresAtMs && now > expiresAtMs);
    const exhausted = used >= max || String(saved.downloadStatus || "").toLowerCase() === "used" || saved.downloadExpired === true;
    const patch = {
      orderId: cleanPremiumText(saved.orderId || "", 180),
      billCode: cleanPremiumText(saved.billCode || saved.billcode || "", 120),
      downloadToken: cleanPremiumText(token || saved.token || saved.downloadToken || "", 220),
      tokenExpiresAtMs: expiresAtMs,
      downloadExpiresAtMs: expiresAtMs,
      downloadCount: used,
      usedCount: used,
      downloadsUsed: used,
      maxDownload: max,
      maxDownloads: max,
      downloadLimit: max,
      downloadExpired: expiredByTime || exhausted,
      downloadActive: !(expiredByTime || exhausted),
      downloadStatus: exhausted ? "used" : (expiredByTime ? "expired" : "active"),
      lastDownloadUsageSyncAt: new Date(now).toISOString(),
      lastDownloadUsageSyncAtMs: now,
      azobssPatch382: true
    };
    const existing = findPremiumOrderByAny({ orderId: patch.orderId, billCode: patch.billCode }) || saved;
    return upsertPremiumOrder({ ...(existing || {}), ...(patch || {}) });
  } catch (err) {
    console.warn("AZOBSS premium order token state sync failed:", err && (err.message || err));
    return null;
  }
}
async function azReconcileMyPurchasePremiumRows(rows = [], req = null) {
  for (const row of rows || []) {
    if (!row || String(row.source || "").toLowerCase() !== "premiumorders") continue;
    try {
      const tokenData = await azFindPremiumTokenForMyPurchaseRow(row);
      if (tokenData) {
        azApplyPremiumTokenToMyPurchasePublicRow(row, tokenData, req);
        azSyncPremiumOrderTokenState({ ...(tokenData || {}), orderId: tokenData.orderId || row.recordId || "", billCode: tokenData.billCode || row.billCode || "", productId: tokenData.productId || row.productId || "", productName: tokenData.productName || row.productName || "" }, tokenData.token || row.downloadToken || "");
      }
    } catch (err) {
      console.warn("AZOBSS My Purchases premium token reconcile skipped:", err && (err.message || err));
    }
  }
  return rows;
}

function azMyPurchasesPublicRow(row = {}, source = "", docId = "", req = null) {
  const src = cleanPremiumText(source || row.__source || row._azSource || "", 80);
  const isPremium = src.toLowerCase().includes("premium");
  const normalized = azNormalizePaymentReceiptOrder({ docId, id: docId, ...row }, isPremium ? "premiumOrders" : "purchaseLogs");
  const category = azReceiptCategory({ ...row, receiptCategory: normalized.receiptCategory, source: src });
  const recordId = cleanPremiumText(docId || row.orderId || row.billCode || row.paymentReference || row.transactionId || row.txnId || row.id || row.itemCode || normalized.receiptNo, 180);
  const amount = azReceiptAmountNumber(row) || Number(normalized.receiptAmount || 0) || 0;
  const status = azReceiptStatusBucket(row);
  const download = isPremium ? azMyPurchasesPremiumDownloadMeta(row, req) : azMyPurchasesPaBmDownloadMeta(row);
  const createdAtMs = azMyPurchasesMs(row);
  const paidAtMs = Number(row.paidAtMs || row.completedAtMs || 0) || (row.paidAt ? Date.parse(String(row.paidAt)) || 0 : 0) || (status === "paid" ? createdAtMs : 0);
  const receiptPath = `/api/my-purchases/receipt/${encodeURIComponent(recordId)}?source=${encodeURIComponent(isPremium ? "premiumOrders" : "purchaseLogs")}`;
  const receiptAvailable = status === "paid";
  return {
    recordId,
    source: isPremium ? "premiumOrders" : "purchaseLogs",
    category,
    status,
    isPaid: status === "paid",
    productName: normalized.receiptProductName || azReceiptProductName(row),
    productId: normalized.receiptProductId || azReceiptProductId(row),
    itemCode: cleanPremiumText(row.itemCode || row.noPa || row.noBm || "", 120),
    state: cleanPremiumText(row.negeri || row.state || row.stateName || "", 120),
    amount,
    amountText: normalized.receiptAmountText || azMoneyRm(amount),
    username: normalized.receiptBuyerUsername || azReceiptBuyerUsername(row),
    email: normalized.receiptBuyerEmail || azReceiptBuyerEmail(row),
    createdAtMs,
    paidAtMs,
    dateText: normalized.receiptDateText || "-",
    downloadUsed: download.used,
    downloadMax: download.max,
    downloadExpiresAtMs: download.expiresAtMs,
    downloadExpired: download.expired,
    downloadActive: download.active,
    downloadUrl: download.url || "",
    receiptUrl: receiptAvailable ? receiptPath : "",
    receiptPdfUrl: receiptAvailable ? `${receiptPath}&format=pdf` : "",
    isSubscriptionCode: !!(row.subscriptionCodeEnabled || row.activationCodeSale || row.activationCode),
    activationCode: receiptAvailable ? cleanPremiumText(row.activationCode || "", 120) : "",
    activationPlanLabel: receiptAvailable ? cleanPremiumText(row.subscriptionPlanLabel || row.subscriptionPlan?.label || "", 100) : "",
    activationCodeExpiresAtMs: receiptAvailable ? (Number(row.activationCodeExpiresAtMs || 0) || azActivationCodeMs(row.activationCodeExpiresAt)) : 0,
    activationCodeExpiresAt: receiptAvailable ? cleanPremiumText(row.activationCodeExpiresAt || "", 140) : "",
    raw: isPremium ? null : {
      id: docId || row.id || "",
      firestoreId: docId || row.firestoreId || row.purchaseLogId || row.id || "",
      purchaseLogId: docId || row.purchaseLogId || row.firestoreId || row.id || "",
      productType: row.productType || row.type || "PA",
      itemCode: row.itemCode || row.noPa || row.noBm || "",
      negeri: row.negeri || row.state || "",
      amount: row.amount || row.saleAmount || amount,
      status: row.status || row.paymentStatus || "",
      uid: row.uid || "",
      usernameKey: row.usernameKey || row.username || "",
      displayName: row.displayName || row.username || row.usernameKey || "",
      email: row.email || row.buyerEmail || "",
      createdAtMs: row.createdAtMs || createdAtMs,
      paidAtMs: row.paidAtMs || paidAtMs,
      downloadUrl: row.downloadUrl || row.fileUrl || "",
      filename: row.filename || "",
      downloadCount: row.downloadCount || 0,
      maxDownloads: row.maxDownloads || row.maxDownload || 5,
      downloadExpiresAtMs: row.downloadExpiresAtMs || download.expiresAtMs,
      paymentOrderId: row.paymentOrderId || row.orderId || "",
      billCode: row.billCode || ""
    }
  };
}
async function azLoadMyPurchasesForIdentity(req, identity = {}, limitRows = 300) {
  const rows = [];
  const seen = new Set();
  const db = getAzobssBackendDb();
  const push = (row, source, docId) => {
    if (!row || !azMyPurchasesBelongsToIdentity(row, identity)) return;
    if (azMyPurchasesIsHiddenForIdentity(row, identity)) return;

    // AZOBSS FIX 377:
    // Customer My Purchases must not show abandoned/halfway checkout invoices.
    // Creating a ToyyibPay bill is only "pending invoice", not a purchase yet.
    // Keep pending rows internally for callback/verification, but show the customer only paid/verified records.
    if (azReceiptStatusBucket(row) !== "paid") return;

    const pub = azMyPurchasesPublicRow(row, source, docId, req);
    const key = `${pub.source}:${pub.recordId || docId || rows.length}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(pub);
  };
  const uid = cleanPremiumText(identity.uid || "", 160);
  const username = cleanPremiumText(identity.username || "", 120).toLowerCase();
  const emails = Array.from(new Set([identity.email, identity.authEmail, identity.profileEmail].map(v => String(v || "").trim().toLowerCase()).filter(Boolean)));

  if (db) {
    const queryTasks = [];
    function addQuery(col, field, value, source) {
      if (!value) return;
      queryTasks.push((async () => {
        try {
          const snap = await db.collection(col).where(field, "==", value).limit(limitRows).get();
          snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, source, d.id));
        } catch (_) {}
      })());
    }
    addQuery("purchaseLogs", "uid", uid, "purchaseLogs");
    addQuery("purchaseLogs", "usernameKey", username, "purchaseLogs");
    emails.forEach(e => addQuery("purchaseLogs", "email", e, "purchaseLogs"));
    addQuery("premiumOrders", "uid", uid, "premiumOrders");
    addQuery("premiumOrders", "user.uid", uid, "premiumOrders");
    addQuery("premiumOrders", "username", username, "premiumOrders");
    addQuery("premiumOrders", "usernameKey", username, "premiumOrders");
    addQuery("premiumOrders", "user.usernameKey", username, "premiumOrders");
    emails.forEach(e => {
      addQuery("premiumOrders", "email", e, "premiumOrders");
      addQuery("premiumOrders", "buyerEmail", e, "premiumOrders");
      addQuery("premiumOrders", "user.email", e, "premiumOrders");
    });
    await Promise.all(queryTasks);

    // Embedded PA/BM fallback inside user profile.
    try {
      let userDocs = [];
      if (uid) {
        const q = await db.collection("users").where("uid", "==", uid).limit(3).get();
        q.forEach(d => userDocs.push(d));
      }
      if (username) {
        const d = await db.collection("users").doc(username).get();
        if (d.exists) userDocs.push(d);
      }
      const userSeen = new Set();
      userDocs.forEach(d => {
        if (!d || !d.exists || userSeen.has(d.id)) return;
        userSeen.add(d.id);
        const u = d.data() || {};
        const list = Array.isArray(u.purchaseRecords) ? u.purchaseRecords : [];
        list.forEach((r, i) => push({ ...(r || {}), usernameKey:r.usernameKey || u.usernameKey || d.id, username:r.username || u.usernameKey || d.id, email:r.email || u.email || u.authEmail || "", uid:r.uid || u.uid || "", docId:r.firestoreId || r.purchaseLogId || r.id || `embedded_${i}` }, "purchaseLogs", r.firestoreId || r.purchaseLogId || r.id || `embedded_${i}`));
      });
    } catch (_) {}
  }

  // Render local JSON fallback for premium orders, then owner-filter strictly before returning.
  try {
    const localPremium = readPremiumOrders();
    localPremium.forEach((x, i) => push(x || {}, "premiumOrders", x.orderId || x.billCode || `local_${i}`));
  } catch (_) {}

  await azReconcileMyPurchasePremiumRows(rows, req);
  rows.sort((a,b) => Number(b.paidAtMs || b.createdAtMs || 0) - Number(a.paidAtMs || a.createdAtMs || 0));
  return rows.slice(0, limitRows);
}
async function azFindMyPurchaseReceiptRecord(identifier = "", source = "", identity = {}) {
  const id = cleanPremiumText(identifier || "", 180);
  if (!id) return null;
  const src = String(source || "").toLowerCase();
  let order = await azFindAdminPaymentReceiptRecord(id, src);
  if (order && azMyPurchasesBelongsToIdentity(order, identity)) return order;

  // The normalized receipt can lose UID fields, so retry through the full customer rows.
  const fakeReq = null;
  const rows = await azLoadMyPurchasesForIdentity(fakeReq, identity, 500);
  const match = rows.find(r => [r.recordId, r.productId, r.itemCode].some(v => String(v || "") === id) && (!src || String(r.source || "").toLowerCase().includes(src.includes("premium") ? "premium" : "purchase")));
  if (!match) return null;
  order = await azFindAdminPaymentReceiptRecord(match.recordId, match.source);
  if (order && azMyPurchasesBelongsToIdentity(order, identity)) return order;
  // Last resort: build receipt from public row fields.
  return azNormalizePaymentReceiptOrder({
    receiptNo: match.recordId,
    status: match.status,
    category: match.category,
    productName: match.productName,
    productId: match.productId,
    saleAmount: match.amount,
    username: match.username || identity.username || "",
    email: match.email || identity.email || identity.authEmail || "",
    paidAtMs: match.paidAtMs,
    createdAtMs: match.createdAtMs,
    receiptSource: match.source
  }, match.source);
}
function azReceiptEmailHtml(order = {}, options = {}) {
  const o = azNormalizePaymentReceiptOrder(order || {}, order && order.receiptSource || "");
  const downloadUrl = cleanPremiumUrl(options.downloadUrl || "");
  const downloadBlock = downloadUrl ? `<p><a href="${azHtmlEscape(downloadUrl)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:800">Download Software/CAD File</a></p><p style="color:#b45309;font-size:13px"><b>Important:</b> This secure link opens a confirmation page first. Download count is only used after the customer presses Start Download.</p>` : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#111"><div style="max-width:720px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px"><h2 style="margin-top:0">AZOBSS Payment Receipt / Invoice</h2><p>Your purchase receipt is attached as PDF.</p><p><b>Receipt:</b> ${azHtmlEscape(o.receiptNo)}<br><b>Product:</b> ${azHtmlEscape(o.receiptProductName)}<br><b>Amount:</b> ${azHtmlEscape(o.receiptAmountText)}<br><b>Status:</b> ${azHtmlEscape(String(o.receiptStatus||'').toUpperCase())}<br><b>Date:</b> ${azHtmlEscape(o.receiptDateText)}</p>${downloadBlock}<p style="font-size:12px;color:#64748b">AZOBSS Digital Store</p></div></body></html>`;
}

// AUTO DELETE FILE > 30 DAYS
const FILE_EXPIRE_MS =
  30 * 24 * 60 * 60 * 1000;

// AZOBSS security hardening: optional stricter CORS + common browser security headers.
const AZOBSS_CORS_ORIGIN = String(process.env.AZOBSS_CORS_ORIGIN || "*").trim() || "*";
function azCorsOrigin() { return AZOBSS_CORS_ORIGIN; }
function azSecurityHeaders(extra = {}) {
  return Object.assign({
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": azCorsOrigin(),
    "Access-Control-Allow-Methods": "GET, POST, DELETE, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Range, If-Range, x-admin-key, x-api-key, x-azobss-api-key, X-AZOBSS-Filename, X-AZOBSS-Document-No",
    "Access-Control-Max-Age": "600",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  }, extra || {});
}
function azStaticCacheHeaders(filePath = "") {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  // HTML must stay fresh because AZOBSS pages are patched often. Static assets can be cached briefly for speed.
  if ([".html", ".htm", ""].includes(ext)) return { "Cache-Control": "no-store" };
  if ([".js", ".css", ".json"].includes(ext)) return { "Cache-Control": "public, max-age=300, must-revalidate" };
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot"].includes(ext)) return { "Cache-Control": "public, max-age=86400" };
  if ([".zip", ".exe", ".msi", ".pdf", ".tif", ".tiff"].includes(ext)) return { "Cache-Control": "private, no-store" };
  return { "Cache-Control": "public, max-age=300, must-revalidate" };
}

const AZOBSS_RATE_BUCKETS = new Map();
function azClientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.socket && req.socket.remoteAddress || "unknown");
}
function azRateLimit(req, name, maxHits, windowMs) {
  if (String(process.env.AZOBSS_DISABLE_RATE_LIMIT || "") === "1") return { ok:true, remaining:maxHits };
  const now = Date.now();
  const ip = azClientIp(req);
  const key = `${name}:${ip}`;
  let bucket = AZOBSS_RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count:0, resetAt: now + windowMs };
  bucket.count += 1;
  AZOBSS_RATE_BUCKETS.set(key, bucket);

  // Lightweight cleanup so long-running Render instance does not keep old IP buckets forever.
  if (AZOBSS_RATE_BUCKETS.size > 2000) {
    for (const [k, v] of AZOBSS_RATE_BUCKETS.entries()) {
      if (!v || v.resetAt <= now) AZOBSS_RATE_BUCKETS.delete(k);
      if (AZOBSS_RATE_BUCKETS.size <= 1500) break;
    }
  }

  const remaining = Math.max(0, maxHits - bucket.count);
  if (bucket.count > maxHits) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { ok:false, retryAfter, remaining:0 };
  }
  return { ok:true, retryAfter:0, remaining };
}
function azRateLimitOrSend(req, res, name, maxHits, windowMs) {
  const r = azRateLimit(req, name, maxHits, windowMs);
  if (r.ok) return false;
  send(res, 429, JSON.stringify({ ok:false, error:"Too many requests. Please try again later.", retryAfter:r.retryAfter }, null, 2), "application/json", { "Retry-After": String(r.retryAfter) });
  return true;
}
  
function send(res, status, body, type = "text/plain; charset=utf-8", extraHeaders = {}) {

  res.writeHead(status, azSecurityHeaders(Object.assign({
    "Content-Type": type
  }, extraHeaders || {})));

  res.end(body);
}

function readBody(req) {

  return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {

      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
      }

    });

    req.on("end", () => resolve(body));
    req.on("error", reject);

  });
}

function readBinaryBody(req, maxBytes = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Body too large"), { statusCode:413 }));
        req.destroy();
        return;
      }
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseRequestBody(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return {};

  // JSON body
  try { return JSON.parse(text); } catch (_) {}

  // ToyyibPay sometimes posts callback as multipart/form-data.
  // The old URLSearchParams parser treated the whole multipart body as one key,
  // causing billCode/orderId/status to be empty and showing "order not found".
  if (/Content-Disposition:\s*form-data/i.test(text)) {
    const out = {};
    const nameRegex = /name="([^"]+)"\s*\r?\n\r?\n([\s\S]*?)(?=\r?\n--[^\r\n]+|$)/gi;
    let match;
    while ((match = nameRegex.exec(text))) {
      const key = String(match[1] || "").trim();
      let value = String(match[2] || "");
      value = value.replace(/\r?\n$/g, "").trim();
      if (key) out[key] = value;
    }
    if (Object.keys(out).length) return out;
  }

  // URL encoded body / querystring style body
  const out = {};
  try {
    const params = new URLSearchParams(text);
    for (const [key, value] of params.entries()) out[key] = value;
  } catch (_) {}
  return out;
}

function isPaBmPremiumOrder(order = {}) {
  return !!(order && (Array.isArray(order.paBmItems) && order.paBmItems.length || String(order.productId || "") === "pa-bm-purchase-records"));
}
function isPublicPaPremiumOrder(order = {}) {
  return !!(order && (order.publicPaPurchase === true || ['public-pa-rm30','public-pa-rm50'].includes(String(order.productId || ''))));
}
function azPublicPaRecordId(order = {}) {
  return cleanPremiumText(order.publicPaRecordId || (order.orderId ? `${order.orderId}-1` : ''), 180);
}
function azPublicPaDownloadUrl(order = {}, req = null) {
  const base = req ? publicBaseUrlFromReq(req) : publicBaseUrlFromReq({ headers:{} });
  const recordId = azPublicPaRecordId(order);
  return recordId ? `${base}/api/pa-bm-download?recordId=${encodeURIComponent(recordId)}` : '';
}
async function maybeSendPublicPaEmail(order = {}, req = null) {
  try {
    let current = await azReloadPremiumOrder(order || {});
    if (!isPublicPaPremiumOrder(current) || current.emailSentAt) return current;
    if (current.isAdminTestPayment === true && current.emailSkippedForPaBm === true) return upsertPremiumOrder({ ...current, publicPaEmailSkipped:true, emailError:null });
    if (!(current.toyyibVerifiedAt || current.paymentVerificationSource === 'toyyibpay-api' || current.isAdminTestPayment === true)) {
      return upsertPremiumOrder({ ...current, emailError:'Blocked: ToyyibPay payment not verified by API', emailErrorAt:new Date().toISOString() });
    }
    const email = azPickPremiumBuyerEmailFromOrder(current);
    if (!azValidEmailLike(email) || azIsLocalEmail(email)) return upsertPremiumOrder({ ...current, emailError:'Valid buyer email is missing.' });
    const downloadUrl = azPublicPaDownloadUrl(current, req);
    if (!downloadUrl) return upsertPremiumOrder({ ...current, emailError:'Public PA download record is missing.' });
    const base = req ? publicBaseUrlFromReq(req) : publicBaseUrlFromReq({ headers:{} });
    const receiptUrl = azReceiptUrl(base, current);
    const item = Array.isArray(current.paBmItems) ? (current.paBmItems[0] || {}) : {};
    const paLabel = `PA${String(item.itemCode || '').replace(/^PA/i,'')}`;
    const subject = `AZOBSS Pelan Akui Ready - ${paLabel}`;
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f6fb;padding:24px;color:#111"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4ef;border-radius:16px;padding:24px"><h2 style="margin-top:0;color:#15803d">Pelan Akui Sedia ✅</h2><p>Pembayaran anda telah disahkan.</p><p><b>Pelan Akui:</b> ${azHtmlEscape(paLabel)}<br><b>Negeri:</b> ${azHtmlEscape(item.negeri || '-')}<br><b>Order ID:</b> ${azHtmlEscape(current.orderId || '-')}<br><b>Jumlah:</b> RM30.00</p><p><a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:11px;font-weight:700">Download PA PDF</a></p><p style="color:#b45309"><b>Penting:</b> Link ini boleh digunakan maksimum 5 kali dalam tempoh 7 hari.</p><p><a href="${receiptUrl}">Lihat resit</a></p><hr style="border:0;border-top:1px solid #e5e7eb"><p style="font-size:12px;color:#64748b">AZOBSS Public Pelan Akui Purchase</p></div></body></html>`;
    const text = `AZOBSS Pelan Akui Sedia\n\nPelan Akui: ${paLabel}\nNegeri: ${item.negeri || '-'}\nOrder ID: ${current.orderId}\nJumlah: RM30.00\nDownload: ${downloadUrl}\nResit: ${receiptUrl}\n\nMaksimum 5 kali download dalam 7 hari.`;
    await azSendEmailWithOptionalPdf({ to:email, subject, html, text });
    return upsertPremiumOrder({ ...current, emailSentAt:new Date().toISOString(), emailTo:email, emailError:null, emailSkippedForPaBm:false, publicPaEmailSent:true });
  } catch (err) {
    console.error('Public PA email failed:', err && (err.stack || err.message || err));
    return upsertPremiumOrder({ ...order, emailError:err && err.message ? err.message : String(err), emailErrorAt:new Date().toISOString() });
  }
}

function toyyibStatusIsPaid(data = {}) {
  // Callback is NOT trusted by generic status/status_id. It only opens a verification attempt,
  // and even then /getBillTransactions must confirm paid before email/token/receipt unlock.
  const statusPairs = [
    ["billpaymentStatus", data.billpaymentStatus],
    ["billPaymentStatus", data.billPaymentStatus],
    ["billpayment_status", data.billpayment_status],
    ["payment_status", data.payment_status],
    ["paymentStatus", data.paymentStatus],
    ["transaction_status", data.transaction_status],
    ["transactionStatus", data.transactionStatus],
    ["transaction_status_id", data.transaction_status_id]
  ];
  return statusPairs.some(([key, value]) => azToyyibPaidStatusValue(value, key));
}

function getToyyibBillCode(data = {}) {
  return cleanPremiumText(data.billcode || data.billCode || data.bill_code || data.BillCode || data.billcode_id || data.refno || "", 80);
}

function getToyyibOrderId(data = {}) {
  return cleanPremiumText(data.order_id || data.orderId || data.externalReferenceNo || data.billExternalReferenceNo || data.bill_external_reference_no || data.referenceNo || "", 120);
}

function mimeType(filePath) {

  const ext = path.extname(filePath).toLowerCase();

  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".pdf": "application/pdf"
  };

  return types[ext] || "application/octet-stream";
}

function safePath(requestPath) {

  let cleanPath =
    decodeURIComponent(requestPath.split("?")[0]);

  if (cleanPath === "/") {
    cleanPath = "/index.html";
  }

  const resolved =
    path.normalize(path.join(ROOT, cleanPath));

  if (!resolved.startsWith(ROOT)) {
    return null;
  }

  return resolved;
}

function cleanPA(noPA) {

  let v = String(noPA || "")
    .trim()
    .toUpperCase();

  v = v.replace(/\.TIF$/i, "");
  v = v.replace(/[^A-Z0-9_-]/g, "");

  return v;
}

function cleanState(negeri) {

  let v = String(negeri || "")
    .trim()
    .toUpperCase();

  v = v.replace(/[^A-Z0-9 _-]/g, "");

  return v;
}



function cleanBenchmarkProduct(value) {
  const v = String(value || '').trim().toUpperCase();
  return v === 'SBM' ? 'SBM' : 'BM';
}

function cleanSearch(value) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 120);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeJupemUrl(rawUrl) {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) return 'https://ebiz.jupem.gov.my' + rawUrl;
  return 'https://ebiz.jupem.gov.my/' + rawUrl.replace(/^\/+/, '');
}

function parseBenchmarkRows(html, produkFallback, negeriFallback) {
  const rows = [];
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = tableRowPattern.exec(html))) {
    const rowHtml = rowMatch[1];
    const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (cellMatches.length < 5) continue;
    const cells = cellMatches.map(item => stripHtml(item[1]));
    const joined = cells.join(' ').toLowerCase();
    if (joined.includes('no. stesen') || joined.includes('tambah ke troli')) continue;

    const linkMatch = rowHtml.match(/href=["']([^"']*(?:Lokasi|Peta|Map|Koordinat|location)[^"']*)["']/i) || rowHtml.match(/href=["']([^"']*)["']/i);
    const stationNo = cells[1] || cells[0] || '';
    if (!stationNo || /^no\.?$/i.test(stationNo)) continue;

    rows.push({
      product: produkFallback,
      stationNo,
      negeri: cells[2] || negeriFallback,
      daerah: cells[3] || '',
      bandar: cells[4] || '',
      huraian: cells[5] || '',
      harga: cells[6] || '',
      locationUrl: linkMatch ? absolutizeJupemUrl(linkMatch[1]) : '',
      raw: cells
    });
  }
  return rows.slice(0, 60);
}

const AZOBSS_JUPEM_LOT_STATE_CODES = Object.freeze({
  JOHOR: "01",
  KEDAH: "02",
  KELANTAN: "03",
  MELAKA: "04",
  "NEGERI SEMBILAN": "05",
  PAHANG: "06",
  "PULAU PINANG": "07",
  PERAK: "08",
  PERLIS: "09",
  SELANGOR: "10",
  TERENGGANU: "11",
  SABAH: "12",
  SARAWAK: "13",
  "WILAYAH PERSEKUTUAN KUALA LUMPUR": "14",
  "WILAYAH PERSEKUTUAN LABUAN": "15",
  "WILAYAH PERSEKUTUAN PUTRAJAYA": "16"
});

const AZOBSS_JUPEM_LOT_STATE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(AZOBSS_JUPEM_LOT_STATE_CODES).map(([name, code]) => [code, name]))
);

const azobssLotSearchCache = new Map();

function cleanLotProduct(value) {
  return String(value || "").trim() === "2" || String(value || "").trim().toUpperCase() === "NDCDB_C3" ? "2" : "1";
}

function cleanLotStateCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (/^(0[1-9]|1[0-6])$/.test(raw)) return raw;
  return AZOBSS_JUPEM_LOT_STATE_CODES[cleanState(raw)] || "";
}

function cleanLotNumber(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9/_-]/g, "")
    .slice(0, 48);
}

function extractJupemAttributeUrl(rowHtml, pattern) {
  const match = String(rowHtml || "").match(pattern);
  return match && match[1] ? absolutizeJupemUrl(decodeHtmlEntities(match[1])) : "";
}

function parseJupemLotRows(html, productCode, stateCode) {
  const tableMatch = String(html || "").match(/<table[^>]+id=["']example["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(tableMatch[1]))) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 9 || /^no\.?\s*lot$/i.test(cells[1] || "")) continue;
    const lotNo = String(cells[1] || "").trim();
    const paNo = String(cells[2] || "").trim().toUpperCase();
    if (!lotNo || !paNo) continue;

    const viewPaUrl = extractJupemAttributeUrl(
      rowHtml,
      /createModal\(\s*["']([^"']*\/Produk\/PelanAkuiDetail\/[^"']+)["']/i
    );
    const mapUrl = extractJupemAttributeUrl(
      rowHtml,
      /href=["']([^"']*\/PetaInteraktif\?[^"']+)["']/i
    );
    const selectionUrl = extractJupemAttributeUrl(
      rowHtml,
      /href=["']([^"']*\/Produk\/ExtractLotPage\?[^"']+)["']/i
    );
    const objectMatch = (mapUrl || selectionUrl || viewPaUrl).match(/(?:PelanAkuiDetail\/|[?&](?:no|code)=)(\d+)/i);

    rows.push({
      lotNo,
      paNo,
      negeri: String(cells[3] || AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "").replace(/^Negeri\s+/i, "").trim(),
      daerah: String(cells[4] || "").replace(/^Daerah\s+/i, "").trim(),
      mukim: String(cells[5] || "").trim(),
      seksyen: String(cells[6] || "").trim(),
      objectId: objectMatch ? objectMatch[1] : "",
      productCode,
      stateCode,
      viewPaUrl,
      mapUrl,
      selectionUrl
    });
  }
  return rows.slice(0, 500);
}

async function searchJupemLotCadastre(productCode, stateCode, lotNo) {
  const cacheKey = [productCode, stateCode, lotNo].join("|");
  const cached = azobssLotSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sourceUrl = "https://ebiz.jupem.gov.my/Produk/LotKadasterBerdigit";
  const commonHeaders = azobssJupemBaseHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": sourceUrl
  });
  const pageResponse = await fetch(sourceUrl, azJupemFetchOptions({
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: commonHeaders
  }));
  if (!pageResponse.ok) throw new Error(`JUPEM lot search page returned HTTP ${pageResponse.status}.`);
  const cookie = azobssExtractCookieHeader(pageResponse.headers);
  const pageHtml = await pageResponse.text();
  const formMatch = pageHtml.match(/<form[^>]+action=["']\/Produk\/LotKadasterBerdigit["'][\s\S]*?<\/form>/i);
  const tokenMatch = formMatch && formMatch[0].match(/<input[^>]+name=["']__RequestVerificationToken["'][^>]+value=["']([^"']+)["']/i);
  if (!tokenMatch || !tokenMatch[1]) throw new Error("JUPEM lot search token is unavailable.");

  const body = new URLSearchParams({
    __RequestVerificationToken: decodeHtmlEntities(tokenMatch[1]),
    produk: productCode,
    negeri: stateCode,
    searchString: lotNo
  });
  const postHeaders = azobssJupemBaseHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": sourceUrl,
    "Origin": "https://ebiz.jupem.gov.my"
  });
  if (cookie) postHeaders.Cookie = cookie;
  const resultResponse = await fetch(sourceUrl, azJupemFetchOptions({
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: postHeaders,
    body: body.toString()
  }));
  if (!resultResponse.ok) throw new Error(`JUPEM lot search returned HTTP ${resultResponse.status}.`);
  const resultHtml = await resultResponse.text();
  const value = {
    sourceUrl,
    results: parseJupemLotRows(resultHtml, productCode, stateCode)
  };
  if (azobssLotSearchCache.size > 120) azobssLotSearchCache.clear();
  azobssLotSearchCache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
  return value;
}


// 578: PA-prefix search uses JUPEM's Pelan Akui search form instead of sending
// "PAxxxx" to the Lot Kadaster form (which only searches lot numbers).
const azobssPaMapSearchCache = new Map();

function parseJupemPaRows(html, stateCode) {
  const tableMatch = String(html || "").match(/<table[^>]+id=["']example["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const rows = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(tableMatch[1]))) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 6 || /^no\.?\s*pa$/i.test(cells[1] || "")) continue;
    const paNo = String(cells[1] || "").trim().toUpperCase();
    if (!/^PA[0-9A-Z/_-]+$/i.test(paNo)) continue;
    const viewPaUrl = extractJupemAttributeUrl(
      rowHtml,
      /createModal\(\s*["']([^"']*\/Produk\/PelanAkuiDetail\/[^"']+)["']/i
    );
    rows.push({
      lotNo: "",
      paNo,
      negeri: String(cells[2] || AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "").replace(/^Negeri\s+/i, "").trim(),
      daerah: String(cells[3] || "").replace(/^Daerah\s+/i, "").trim(),
      mukim: String(cells[4] || "").trim(),
      seksyen: String(cells[5] || "").trim(),
      objectId: "",
      productCode: "1",
      stateCode,
      viewPaUrl,
      mapUrl: "",
      selectionUrl: ""
    });
  }
  return rows.slice(0, 100);
}

async function searchJupemPaCadastre(stateCode, paNo) {
  const cleanStateCode = cleanLotStateCode(stateCode);
  const cleanPaDigits = cleanLotNumber(paNo).replace(/^PA/i, "");
  if (!cleanStateCode || !cleanPaDigits) return { sourceUrl: "", results: [] };
  const cacheKey = `${cleanStateCode}|${cleanPaDigits}`;
  const cached = azobssPaMapSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const sourceUrl = "https://ebiz.jupem.gov.my/Produk/PelanAkui";
  let cookie = "";
  try {
    const pageResponse = await fetch(sourceUrl, azJupemFetchOptions({
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: azobssJupemBaseHeaders({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": sourceUrl
      })
    }));
    if (pageResponse.ok) {
      cookie = azobssExtractCookieHeader(pageResponse.headers);
      try { await pageResponse.arrayBuffer(); } catch (_) {}
    }
  } catch (_) {}

  const body = new URLSearchParams({
    negeri: String(Number(cleanStateCode)),
    noPa: cleanPaDigits,
    cetak: "0"
  });
  const headers = azobssJupemBaseHeaders({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": sourceUrl,
    "Origin": "https://ebiz.jupem.gov.my"
  });
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(sourceUrl, azJupemFetchOptions({
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
    headers,
    body: body.toString()
  }));
  if (!response.ok) throw new Error(`JUPEM PA search returned HTTP ${response.status}.`);
  const html = await response.text();
  const wanted = azobssFocusedLotComparable(cleanPaDigits);
  const results = parseJupemPaRows(html, cleanStateCode)
    .filter((row) => azobssFocusedLotComparable(String(row && row.paNo || "").replace(/^PA/i, "")).startsWith(wanted))
    .slice(0, 24);
  const value = { sourceUrl, results };
  if (azobssPaMapSearchCache.size > 180) azobssPaMapSearchCache.clear();
  azobssPaMapSearchCache.set(cacheKey, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
  return value;
}

function azobssJupemBaseHeaders(extraHeaders = {}) {
  return Object.assign({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Accept": "application/pdf,image/tiff,image/*,application/octet-stream,*/*",
    "Accept-Language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://ebiz.jupem.gov.my/",
    "Origin": "https://ebiz.jupem.gov.my"
  }, extraHeaders || {});
}

async function fetchJupem(jupemUrl, options = {}) {
  const extraHeaders = Object.assign({}, options.headers || {});
  const fetchOptions = Object.assign({}, options, {
    redirect: options.redirect || "follow",
    headers: azobssJupemBaseHeaders(extraHeaders)
  });
  return await fetch(jupemUrl, azJupemFetchOptions(fetchOptions));
}

function azobssExtractCookieHeader(headers) {
  try {
    if (headers && typeof headers.getSetCookie === "function") {
      const arr = headers.getSetCookie() || [];
      return arr.map(v => String(v || "").split(";")[0]).filter(Boolean).join("; ");
    }
  } catch (_err) {}
  try {
    const raw = headers && typeof headers.get === "function" ? headers.get("set-cookie") : "";
    if (!raw) return "";
    return String(raw).split(/,(?=[^;,]+=[^;,]+)/g).map(v => v.split(";")[0].trim()).filter(Boolean).join("; ");
  } catch (_err) {
    return "";
  }
}

let azobssJupemSessionCache = { cookie: "", expiresAt: 0 };
async function azobssGetJupemSessionCookie(force = false) {
  const now = Date.now();
  if (!force && azobssJupemSessionCache.cookie && azobssJupemSessionCache.expiresAt > now) {
    return azobssJupemSessionCache.cookie;
  }
  const bootUrls = [
    "https://ebiz.jupem.gov.my/",
    "https://ebiz.jupem.gov.my/Produk/StesenTandaAras"
  ];
  for (const bootUrl of bootUrls) {
    try {
      const r = await fetch(bootUrl, azJupemFetchOptions({
        redirect: "follow",
        headers: azobssJupemBaseHeaders({
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        })
      }));
      const cookie = azobssExtractCookieHeader(r.headers);
      // Consume body so undici can reuse the connection cleanly.
      try { await r.arrayBuffer(); } catch (_err) {}
      if (cookie) {
        azobssJupemSessionCache = { cookie, expiresAt: now + 10 * 60 * 1000 };
        return cookie;
      }
    } catch (err) {
      console.warn("AZOBSS JUPEM session bootstrap failed:", bootUrl, err && (err.message || err));
    }
  }
  return "";
}

async function fetchJupemWithSession(jupemUrl) {
  const cookie = await azobssGetJupemSessionCookie(false);
  if (!cookie) return await fetchJupem(jupemUrl);
  return await fetchJupem(jupemUrl, { headers: { "Cookie": cookie } });
}

function azobssMergeCookieHeaders(current, incoming) {
  const values = new Map();
  [current, incoming].forEach((header) => {
    String(header || "").split(/;\s*/).forEach((part) => {
      const index = part.indexOf("=");
      if (index > 0) values.set(part.slice(0, index).trim(), part.slice(index + 1).trim());
    });
  });
  return Array.from(values.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
}

async function azobssJupemAuthFetch(url, options = {}, cookie = "") {
  let target = new URL(url, "https://ebiz.jupem.gov.my").toString();
  let method = String(options.method || "GET").toUpperCase();
  let body = options.body;
  let activeCookie = cookie;
  for (let redirectCount = 0; redirectCount < 6; redirectCount += 1) {
    const response = await fetch(target, azJupemFetchOptions({
      method,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      redirect: "manual",
      signal: AbortSignal.timeout(Number(options.timeoutMs || 30000)),
      headers: azobssJupemBaseHeaders({
        "Accept": options.accept || "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...(options.contentType ? { "Content-Type": options.contentType } : {}),
        ...(activeCookie ? { "Cookie": activeCookie } : {}),
        ...(options.referer ? { "Referer": options.referer } : {}),
        ...(options.ajax ? { "X-Requested-With": "XMLHttpRequest" } : {})
      })
    }));
    activeCookie = azobssMergeCookieHeaders(activeCookie, azobssExtractCookieHeader(response.headers));
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      target = new URL(location, target).toString();
      if (![307, 308].includes(response.status)) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    return { response, cookie: activeCookie, url: target };
  }
  throw new Error("JUPEM login redirected too many times.");
}

let azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
let azobssJupemCartMutationQueue = Promise.resolve();

function azobssWithJupemCartMutationLock(task) {
  const current = azobssJupemCartMutationQueue.then(task, task);
  azobssJupemCartMutationQueue = current.catch(() => undefined);
  return current;
}

async function azobssGetJupemAuthenticatedSession(force = false) {
  const now = Date.now();
  if (!force && azobssJupemAuthenticatedCache.cookie && azobssJupemAuthenticatedCache.userId && azobssJupemAuthenticatedCache.expiresAt > now) {
    return azobssJupemAuthenticatedCache;
  }
  const username = String(process.env.JUPEM_EBIZ_USERNAME || "").trim();
  const password = String(process.env.JUPEM_EBIZ_PASSWORD || "");
  if (!username || !password) throw new Error("JUPEM server login is not configured.");

  const loginUrl = "https://ebiz.jupem.gov.my/Home/LogMasuk";
  const first = await azobssJupemAuthFetch(loginUrl);
  const firstHtml = await first.response.text();
  const firstCsrf = (firstHtml.match(/name=["']__RequestVerificationToken["'][^>]+value=["']([^"']+)["']/i) || [])[1];
  if (!firstCsrf) throw new Error("JUPEM login verification token is unavailable.");

  const firstBody = new URLSearchParams({
    __RequestVerificationToken: decodeHtmlEntities(firstCsrf),
    IDPengguna: username,
    controller: "",
    action: "",
    returnUrl: ""
  });
  const second = await azobssJupemAuthFetch(loginUrl, {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    referer: loginUrl,
    body: firstBody.toString()
  }, first.cookie);
  const secondHtml = await second.response.text();
  const action = decodeHtmlEntities((secondHtml.match(/<form[^>]+action=["']([^"']+)["']/i) || [])[1] || "");
  const secondCsrf = (secondHtml.match(/name=["']__RequestVerificationToken["'][^>]+value=["']([^"']+)["']/i) || [])[1];
  const hiddenId = (secondHtml.match(/name=["']IDPengguna["'][^>]+value=["']([^"']*)["']/i) || [])[1] || username;
  const phrase = (secondHtml.match(/name=["']FrasaRahsia["'][^>]+value=["']([^"']*)["']/i) || [])[1] || "";
  if (!action || !secondCsrf) throw new Error("JUPEM password form is unavailable.");

  const passwordBody = new URLSearchParams({
    __RequestVerificationToken: decodeHtmlEntities(secondCsrf),
    IDPengguna: decodeHtmlEntities(hiddenId),
    FrasaRahsia: decodeHtmlEntities(phrase),
    returnUrl: "",
    KataLaluan: password
  });
  const loggedIn = await azobssJupemAuthFetch(action, {
    method: "POST",
    contentType: "application/x-www-form-urlencoded",
    referer: second.url,
    body: passwordBody.toString()
  }, second.cookie);
  const dashboardHtml = await loggedIn.response.text();
  const userIdMatch = dashboardHtml.match(/MyTroliDetailXTerhad\/(\d+)/i);
  if (!userIdMatch || /<title>\s*Log Masuk/i.test(dashboardHtml)) throw new Error("JUPEM server login failed.");
  azobssJupemAuthenticatedCache = {
    cookie: loggedIn.cookie,
    userId: userIdMatch[1],
    expiresAt: now + (15 * 60 * 1000)
  };
  return azobssJupemAuthenticatedCache;
}

let azobssJupemMapAuthCache = { token: "", cookie: "", expiresAt: 0 };
let azobssJupemMapAuthPending = null;
const azobssJupemPointLocationCache = new Map();

const AZOBSS_JUPEM_LOT_CONFIG = Object.freeze({
  "1": Object.freeze({
    "01": { lotLayer: 1, sheetLayer: 3, gp: "Kadaster/ndcdb_johor_clip_select_v2/GPServer/johorclip" },
    "02": { lotLayer: 5, sheetLayer: 7, gp: "Kadaster/kedahclip/GPServer/kedahclip" },
    "03": { lotLayer: 9, sheetLayer: 11, gp: "Kadaster/kelantanclip/GPServer/kelantanclip" },
    "04": { lotLayer: 17, sheetLayer: 19, gp: "Kadaster/melakaclip/GPServer/melakaclip" },
    "05": { lotLayer: 21, sheetLayer: 23, gp: "Kadaster/Kadaster_Negeri_Sembilan_Clip_Select/GPServer/negerisembilanclip" },
    "06": { lotLayer: 25, sheetLayer: 27, gp: "Kadaster/pahangclip/GPServer/pahangclip" },
    "07": { lotLayer: 37, sheetLayer: 39, gp: "Kadaster/penangclip/GPServer/penangclip" },
    "08": { lotLayer: 29, sheetLayer: 31, gp: "Kadaster/perakclip/GPServer/perakclip" },
    "09": { lotLayer: 33, sheetLayer: 35, gp: "Kadaster/perlisclip/GPServer/perlisclip" },
    "10": { lotLayer: 41, sheetLayer: 43, gp: "Kadaster/selangorclip/GPServer/selangorclip" },
    "11": { lotLayer: 45, sheetLayer: 47, gp: "Kadaster/terengganuclip/GPServer/terengganuclip" },
    "14": { lotLayer: 49, sheetLayer: 51, gp: "Kadaster/wpklclip/GPServer/wpklclip" },
    "15": { lotLayer: 13, sheetLayer: 15, gp: "Kadaster/labuanclip/GPServer/labuanclip" },
    "16": { lotLayer: 49, sheetLayer: 51, gp: "Kadaster/wpklclip/GPServer/wpklclip" }
  }),
  "2": Object.freeze({
    "01": { lotLayer: 2, sheetLayer: 3, gp: "Kadaster/johorclipc3/GPServer/johorclipc3" },
    "02": { lotLayer: 6, sheetLayer: 7, gp: "Kadaster/kedahclipc3/GPServer/kedahclipc3" },
    "03": { lotLayer: 10, sheetLayer: 11, gp: "Kadaster/kelantanclipc3/GPServer/kelantanclipc3" },
    "04": { lotLayer: 18, sheetLayer: 19, gp: "Kadaster/melakaclipc3/GPServer/melakaclipc3" },
    "05": { lotLayer: 22, sheetLayer: 23, gp: "Kadaster/negerisembilanclipc3/GPServer/negerisembilanclipc3" },
    "06": { lotLayer: 26, sheetLayer: 27, gp: "Kadaster/pahangclipc3/GPServer/pahangclipc3" },
    "07": { lotLayer: 38, sheetLayer: 39, gp: "Kadaster/penangclipc3/GPServer/penangclipc3" },
    "08": { lotLayer: 30, sheetLayer: 31, gp: "Kadaster/perakclipc3/GPServer/perakclipc3" },
    "09": { lotLayer: 34, sheetLayer: 35, gp: "Kadaster/perlisclipc3/GPServer/perlisclipc3" },
    "10": { lotLayer: 42, sheetLayer: 43, gp: "Kadaster/selangorclipc3/GPServer/selangorclipc3" },
    "11": { lotLayer: 46, sheetLayer: 47, gp: "Kadaster/terengganuclipc3/GPServer/terengganuclipc3" },
    "14": { lotLayer: 50, sheetLayer: 51, gp: "Kadaster/wpklclipc3/GPServer/wpklclipc3" },
    "15": { lotLayer: 14, sheetLayer: 15, gp: "Kadaster/labuanclipc3/GPServer/labuanclipc3" },
    "16": { lotLayer: 50, sheetLayer: 51, gp: "Kadaster/wpklclipc3/GPServer/wpklclipc3" }
  })
});

const AZOBSS_JUPEM_LOT_BOUNDS = Object.freeze({
  "01": [[1.15, 102.45], [2.85, 104.65]],
  "02": [[5.05, 99.55], [6.75, 101.05]],
  "03": [[4.45, 101.25], [6.30, 102.75]],
  "04": [[2.00, 101.80], [2.65, 102.65]],
  "05": [[2.35, 101.70], [3.25, 102.80]],
  "06": [[2.45, 101.65], [4.85, 104.65]],
  "07": [[5.10, 100.10], [5.65, 100.60]],
  "08": [[3.65, 100.30], [5.90, 101.80]],
  "09": [[6.15, 100.05], [6.75, 100.55]],
  "10": [[2.55, 100.75], [3.90, 102.10]],
  "11": [[3.80, 102.90], [5.90, 103.80]],
  "14": [[2.849, 101.578], [3.259, 101.790]],
  "15": [[5.20, 115.05], [5.45, 115.35]],
  "16": [[2.849, 101.578], [3.259, 101.790]]
});

function azobssGetLotMapConfig(productCode, stateCode) {
  const product = cleanLotProduct(productCode);
  const state = cleanLotStateCode(stateCode);
  const config = AZOBSS_JUPEM_LOT_CONFIG[product] && AZOBSS_JUPEM_LOT_CONFIG[product][state];
  if (!config) throw new Error("JUPEM does not provide this Lot Kadaster layer for the selected state.");
  return { product, state, bounds: AZOBSS_JUPEM_LOT_BOUNDS[state], ...config };
}


// 574: Resolve one exact JUPEM lot and return its geometry for the internal
// focused-lot viewer. The map URL is parsed only for identifiers; it is never
// fetched directly, so arbitrary URLs cannot turn this endpoint into a proxy.
function azobssParseFocusedLotMapTarget(rawUrl) {
  const value = String(rawUrl || "").trim().slice(0, 1200);
  if (!value) return {};
  try {
    const target = new URL(value, "https://ebiz.jupem.gov.my/");
    if (!/(^|\.)ebiz\.jupem\.gov\.my$/i.test(target.hostname)) return {};
    const type = String(target.searchParams.get("type") || "").trim();
    const typeMatch = type.match(/^(\d{2})lot/i);
    return {
      objectId: String(
        target.searchParams.get("no") ||
        target.searchParams.get("id") ||
        target.searchParams.get("objectId") ||
        ""
      ).trim(),
      productCode: String(
        target.searchParams.get("produk") ||
        (/c3/i.test(type) ? "2" : "1")
      ).trim(),
      stateCode: String(
        target.searchParams.get("neg") ||
        target.searchParams.get("negeri") ||
        target.searchParams.get("state") ||
        (typeMatch && typeMatch[1]) ||
        ""
      ).trim(),
      lotNo: String(
        target.searchParams.get("lot") ||
        target.searchParams.get("lotNo") ||
        target.searchParams.get("noLot") ||
        ""
      ).trim(),
      paNo: String(
        target.searchParams.get("pa") ||
        target.searchParams.get("paNo") ||
        target.searchParams.get("noPA") ||
        ""
      ).trim()
    };
  } catch (_) {
    return {};
  }
}

function azobssCleanLotObjectId(value) {
  const clean = String(value || "").trim();
  return /^\d{1,18}$/.test(clean) ? clean : "";
}

function azobssNormalizeFieldToken(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function azobssFindFocusedLotAttribute(attributes, patterns) {
  const source = attributes && typeof attributes === "object" ? attributes : {};
  const entries = Object.entries(source);
  for (const pattern of patterns) {
    const wanted = azobssNormalizeFieldToken(pattern);
    const match = entries.find(([key]) => azobssNormalizeFieldToken(key) === wanted);
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  for (const pattern of patterns) {
    const wanted = azobssNormalizeFieldToken(pattern);
    if (wanted.length < 4) continue;
    const match = entries.find(([key]) => {
      const token = azobssNormalizeFieldToken(key);
      return token.startsWith(wanted) || token.endsWith(wanted);
    });
    if (match && String(match[1] ?? "").trim()) return String(match[1]).trim();
  }
  return "";
}


function azobssFocusedLotComparable(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function azobssFocusedLotAttributeValue(feature) {
  return azobssFindFocusedLotAttribute(feature && feature.attributes, [
    "NO_LOT", "NOLOT", "LOT_NO", "LOTNO", "NOMBOR_LOT", "LOT"
  ]);
}

function azobssFocusedPaAttributeValue(feature) {
  return azobssFindFocusedLotAttribute(feature && feature.attributes, [
    "NO_PA", "NOPA", "PA_NO", "PANO", "PELAN_AKUI"
  ]);
}

function azobssFocusedFeatureMatchesExactTarget(feature, lotNo, paNo) {
  const wantedLot = azobssFocusedLotComparable(cleanLotNumber(lotNo));
  const actualLot = azobssFocusedLotComparable(azobssFocusedLotAttributeValue(feature));
  if (wantedLot && (!actualLot || actualLot !== wantedLot)) return false;
  const wantedPa = azobssFocusedLotComparable(paNo).replace(/^PA/, "");
  const actualPa = azobssFocusedLotComparable(azobssFocusedPaAttributeValue(feature)).replace(/^PA/, "");
  if (wantedPa && actualPa && actualPa !== wantedPa) return false;
  return true;
}

function azobssFocusedLotFeatureScore(feature, context = {}) {
  const attributes = feature && feature.attributes || {};
  const checks = [
    [context.lotNo, azobssFindFocusedLotAttribute(attributes, ["NO_LOT", "NOLOT", "LOT_NO", "LOTNO", "NOMBOR_LOT", "LOT"]), 20],
    [context.paNo, azobssFindFocusedLotAttribute(attributes, ["NO_PA", "NOPA", "PA_NO", "PANO", "PELAN_AKUI"]), 12],
    [context.daerah, azobssFindFocusedLotAttribute(attributes, ["DAERAH", "DISTRICT"]), 5],
    [context.mukim, azobssFindFocusedLotAttribute(attributes, ["MUKIM", "BANDAR", "PEKAN"]), 4],
    [context.seksyen, azobssFindFocusedLotAttribute(attributes, ["SEKSYEN", "SECTION"]), 3]
  ];
  let score = 0;
  for (const [wantedRaw, actualRaw, weight] of checks) {
    const wanted = azobssFocusedLotComparable(wantedRaw);
    const actual = azobssFocusedLotComparable(actualRaw);
    if (!wanted || !actual) continue;
    if (wanted === actual) score += weight;
    else if (wanted.includes(actual) || actual.includes(wanted)) score += Math.max(1, Math.floor(weight / 2));
    else if (weight >= 12) score -= weight * 2;
  }
  return score;
}

function azobssChooseFocusedLotFeature(features, context = {}) {
  const rows = Array.isArray(features) ? features.filter(Boolean) : [];
  if (!rows.length) return null;
  return rows
    .map((feature, index) => ({ feature, index, score: azobssFocusedLotFeatureScore(feature, context) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0].feature;
}

function azobssFocusedLotBounds(geometry) {
  const rings = geometry && Array.isArray(geometry.rings) ? geometry.rings : [];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  rings.forEach((ring) => {
    if (!Array.isArray(ring)) return;
    ring.forEach((point) => {
      const longitude = Number(point && point[0]);
      const latitude = Number(point && point[1]);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      west = Math.min(west, longitude);
      south = Math.min(south, latitude);
      east = Math.max(east, longitude);
      north = Math.max(north, latitude);
    });
  });
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error("Geometri lot JUPEM tidak dapat dibaca.");
  }
  return {
    bounds: [[south, west], [north, east]],
    center: {
      latitude: Number(((south + north) / 2).toFixed(8)),
      longitude: Number(((west + east) / 2).toFixed(8))
    }
  };
}

async function azobssQueryFocusedLotByObjectId(config, objectId, auth) {
  const cleanObjectId = azobssCleanLotObjectId(objectId);
  if (!cleanObjectId) return null;
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.lotLayer}`;
  const result = await azobssJupemArcGisJson(`${layerUrl}/query`, {
    objectIds: cleanObjectId,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326"
  }, auth, 30000);
  return Array.isArray(result.features) && result.features[0] ? result.features[0] : null;
}

async function azobssQueryFocusedLotByNumber(config, lotNo, auth, context = {}) {
  const cleanNumber = cleanLotNumber(lotNo);
  if (!cleanNumber) return null;
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.lotLayer}`;
  const metadata = await azobssJupemArcGisJson(layerUrl, {}, auth, 30000);
  const fields = Array.isArray(metadata.fields) ? metadata.fields : [];
  const candidates = fields.filter((field) => {
    const token = azobssNormalizeFieldToken(`${field && field.name || ""} ${field && field.alias || ""}`);
    return /(?:^|NO)(?:LOT|LOTT|LOTNUMBER)|LOTNO|NOMBORLOT/.test(token);
  }).slice(0, 8);
  const escaped = cleanNumber.replace(/'/g, "''");
  for (const field of candidates) {
    const fieldName = String(field && field.name || "").trim();
    if (!fieldName) continue;
    const numeric = /Integer|Double|Single|SmallInteger/i.test(String(field.type || ""));
    if (numeric && !/^\d+(?:\.\d+)?$/.test(cleanNumber)) continue;
    const where = numeric ? `${fieldName} = ${cleanNumber}` : `${fieldName} = '${escaped}'`;
    try {
      const result = await azobssJupemArcGisJson(`${layerUrl}/query`, {
        where,
        outFields: "*",
        returnGeometry: "true",
        outSR: "4326",
        resultRecordCount: "50"
      }, auth, 30000);
      const features = Array.isArray(result.features) ? result.features : [];
      const wantedPa = azobssFocusedLotComparable(context && context.paNo).replace(/^PA/, "");
      const exactPaFeatures = wantedPa ? features.filter((feature) => {
        const actualPa = azobssFocusedLotComparable(azobssFocusedPaAttributeValue(feature)).replace(/^PA/, "");
        return actualPa && actualPa === wantedPa;
      }) : [];
      const selectionPool = exactPaFeatures.length ? exactPaFeatures : features;
      const selected = azobssChooseFocusedLotFeature(selectionPool, { ...context, lotNo: cleanNumber });
      if (selected && azobssFocusedFeatureMatchesExactTarget(selected, cleanNumber, exactPaFeatures.length ? context.paNo : "")) return selected;
    } catch (_) {}
  }
  return null;
}


function azobssFocusedPaComparable(value) {
  return azobssFocusedLotComparable(value).replace(/^PA/, "");
}

async function azobssQueryFocusedLotsByPa(config, paNo, auth, context = {}) {
  const cleanPa = cleanLotNumber(paNo);
  const wanted = azobssFocusedPaComparable(cleanPa);
  if (!wanted) return [];
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.lotLayer}`;
  const metadata = await azobssJupemArcGisJson(layerUrl, {}, auth, 30000);
  const fields = Array.isArray(metadata.fields) ? metadata.fields : [];
  const candidates = fields.filter((field) => {
    const token = azobssNormalizeFieldToken(`${field && field.name || ""} ${field && field.alias || ""}`);
    return /NOPA|PANO|PELANAKUI|PELANAKUINO|NOPELANAKUI/.test(token);
  }).slice(0, 10);
  const values = [...new Set([`PA${wanted}`, wanted])];
  for (const field of candidates) {
    const fieldName = String(field && field.name || "").trim();
    if (!fieldName) continue;
    const numeric = /Integer|Double|Single|SmallInteger/i.test(String(field.type || ""));
    for (const value of values) {
      if (numeric && !/^\d+(?:\.\d+)?$/.test(value)) continue;
      const escaped = value.replace(/'/g, "''");
      const where = numeric ? `${fieldName} = ${value}` : `${fieldName} = '${escaped}'`;
      try {
        const result = await azobssJupemArcGisJson(`${layerUrl}/query`, {
          where,
          outFields: "*",
          returnGeometry: "true",
          outSR: "4326",
          resultRecordCount: "500"
        }, auth, 40000);
        const features = (Array.isArray(result.features) ? result.features : []).filter((feature) => {
          const actual = azobssFindFocusedLotAttribute(feature && feature.attributes, [
            "NO_PA", "NOPA", "PA_NO", "PANO", "PELAN_AKUI"
          ]);
          return !actual || azobssFocusedPaComparable(actual) === wanted;
        });
        if (features.length) {
          return features
            .map((feature, index) => ({ feature, index, score: azobssFocusedLotFeatureScore(feature, { ...context, paNo: `PA${wanted}` }) }))
            .sort((left, right) => right.score - left.score || left.index - right.index)
            .map((row) => row.feature);
        }
      } catch (_) {}
    }
  }
  return [];
}

function azobssMergeFocusedLotFeatures(features) {
  const rows = Array.isArray(features) ? features.filter((feature) => feature && feature.geometry && Array.isArray(feature.geometry.rings)) : [];
  if (!rows.length) return null;
  const rings = rows.flatMap((feature) => feature.geometry.rings.filter((ring) => Array.isArray(ring) && ring.length >= 3));
  if (!rings.length) return null;
  return {
    attributes: rows[0].attributes || {},
    geometry: {
      rings,
      polygons: rows.map((feature) => feature.geometry.rings),
      spatialReference: { wkid: 4326 }
    },
    featureCount: rows.length,
    sourceFeatures: rows
  };
}

async function azobssResolveFocusedLot(productCode, stateCode, objectId, lotNo, context = {}) {
  const config = azobssGetLotMapConfig(productCode, stateCode);
  const auth = await azobssGetJupemMapAuth(false);
  let resolvedObjectId = azobssCleanLotObjectId(objectId);
  let feature = null;
  if (resolvedObjectId) {
    try {
      const byObjectId = await azobssQueryFocusedLotByObjectId(config, resolvedObjectId, auth);
      // A JUPEM URL/object ID is used only when its attributes confirm the
      // requested lot. This prevents an old or ambiguous object ID from
      // displaying a neighbouring lot on the first click.
      if (byObjectId && azobssFocusedFeatureMatchesExactTarget(byObjectId, lotNo, context && context.paNo)) {
        feature = byObjectId;
      }
    } catch (_) {}
  }

  if (!feature && lotNo) {
    try { feature = await azobssQueryFocusedLotByNumber(config, lotNo, auth, context); } catch (_) {}
  }

  if (!feature && lotNo) {
    try {
      const search = await searchJupemLotCadastre(config.product, config.state, cleanLotNumber(lotNo));
      const wanted = cleanLotNumber(lotNo);
      const row = (search.results || []).find((item) => cleanLotNumber(item && item.lotNo) === wanted)
        || (search.results || [])[0];
      const rowTarget = azobssParseFocusedLotMapTarget(row && row.mapUrl);
      resolvedObjectId = azobssCleanLotObjectId(rowTarget.objectId || (row && row.objectId));
      if (resolvedObjectId) {
        const searchedFeature = await azobssQueryFocusedLotByObjectId(config, resolvedObjectId, auth);
        if (searchedFeature && azobssFocusedFeatureMatchesExactTarget(searchedFeature, lotNo, context && context.paNo)) {
          feature = searchedFeature;
        }
      }
    } catch (_) {}
  }

  let paFeatures = [];
  if (!feature && !lotNo && context && context.paNo) {
    try {
      paFeatures = await azobssQueryFocusedLotsByPa(config, context.paNo, auth, context);
      feature = azobssMergeFocusedLotFeatures(paFeatures);
    } catch (_) {}
  }

  if (!feature || !feature.geometry || !Array.isArray(feature.geometry.rings)) {
    throw new Error(context && context.paNo
      ? "PA JUPEM yang dipilih tidak dapat dikenal pasti pada peta."
      : "Lot JUPEM yang dipilih tidak dapat dikenal pasti pada peta.");
  }

  const attributes = feature.attributes || {};
  const objectIdFromAttributes = azobssFindFocusedLotAttribute(attributes, [
    "OBJECTID", "OBJECTID_1", "FID"
  ]);
  const resolvedLotNo = paFeatures.length > 1 ? "" : (azobssFindFocusedLotAttribute(attributes, [
    "NO_LOT", "NOLOT", "LOT_NO", "LOTNO", "NOMBOR_LOT", "LOT"
  ]) || cleanLotNumber(lotNo));
  const paNo = azobssFindFocusedLotAttribute(attributes, [
    "NO_PA", "NOPA", "PA_NO", "PANO", "PELAN_AKUI"
  ]) || String(context && context.paNo || "").trim().toUpperCase();
  const daerah = azobssFindFocusedLotAttribute(attributes, ["DAERAH", "DISTRICT"]);
  const mukim = azobssFindFocusedLotAttribute(attributes, ["MUKIM", "BANDAR", "PEKAN"]);
  const seksyen = azobssFindFocusedLotAttribute(attributes, ["SEKSYEN", "SECTION"]);
  const spatial = azobssFocusedLotBounds(feature.geometry);

  return {
    config,
    objectId: azobssCleanLotObjectId(resolvedObjectId || objectIdFromAttributes),
    lotNo: resolvedLotNo,
    paNo,
    daerah,
    mukim,
    seksyen,
    geometry: {
      rings: feature.geometry.rings,
      ...(Array.isArray(feature.geometry.polygons) ? { polygons: feature.geometry.polygons } : {}),
      spatialReference: { wkid: 4326 }
    },
    bounds: spatial.bounds,
    center: spatial.center,
    lotCount: paFeatures.length || 1
  };
}

// 572: Malaysia place-name suggestions with Photon HTTP 400 fallback.
// The provider stays behind this backend endpoint so it can be changed without
// requiring a website update. Requests are cached and serialised to keep public
// geocoder usage modest.
const AZOBSS_LOCATION_SEARCH_BASE = String(
  process.env.AZOBSS_LOCATION_SEARCH_BASE || "https://photon.komoot.io"
).replace(/\/+$/, "");
const azobssLocationSearchCache = new Map();
let azobssLocationSearchQueue = Promise.resolve();
let azobssLocationSearchLastRequestAt = 0;

function azobssCleanLocationQuery(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function azobssLocationTextParts(properties = {}) {
  const values = [
    properties.name,
    properties.street,
    properties.district,
    properties.locality,
    properties.city,
    properties.county,
    properties.state,
    properties.postcode,
    properties.country
  ];
  const seen = new Set();
  return values.map((value) => String(value || "").trim()).filter((value) => {
    if (!value) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function azobssQueueLocationSearch(task) {
  const current = azobssLocationSearchQueue.then(async () => {
    const waitMs = Math.max(0, 450 - (Date.now() - azobssLocationSearchLastRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    try {
      return await task();
    } finally {
      azobssLocationSearchLastRequestAt = Date.now();
    }
  });
  azobssLocationSearchQueue = current.catch(() => undefined);
  return current;
}

function azobssBuildPhotonLocationUrl(query, stateCode, mode) {
  const requestUrl = new URL(`${AZOBSS_LOCATION_SEARCH_BASE}/api`);
  requestUrl.searchParams.set("q", query);
  requestUrl.searchParams.set("limit", "8");
  if (mode !== "bare") requestUrl.searchParams.set("countrycode", "MY");

  const bounds = AZOBSS_JUPEM_LOT_BOUNDS[stateCode];
  if (mode !== "minimal" && mode !== "bare" && Array.isArray(bounds) && bounds.length === 2) {
    const south = Number(bounds[0] && bounds[0][0]);
    const west = Number(bounds[0] && bounds[0][1]);
    const north = Number(bounds[1] && bounds[1][0]);
    const east = Number(bounds[1] && bounds[1][1]);
    if ([south, west, north, east].every(Number.isFinite)) {
      if (mode === "bounded") requestUrl.searchParams.set("bbox", [west, south, east, north].join(","));
      requestUrl.searchParams.set("lat", String((south + north) / 2));
      requestUrl.searchParams.set("lon", String((west + east) / 2));
      requestUrl.searchParams.set("zoom", "10");
      requestUrl.searchParams.set("location_bias_scale", "0.15");
    }
  }
  return requestUrl;
}

async function azobssFetchPhotonLocations(query, stateCode, mode) {
  const requestUrl = azobssBuildPhotonLocationUrl(query, stateCode, mode || "bounded");
  return await azobssQueueLocationSearch(async () => {
    const response = await fetch(requestUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Accept": "application/geo+json,application/json;q=0.9,*/*;q=0.5",
        "User-Agent": "AZOBSS-Lot-Selection-Map/572 (https://www.azobss.com/)"
      }
    });
    const responseText = await response.text();
    if (!response.ok) {
      const detail = String(responseText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
      const error = new Error(`Photon returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      error.statusCode = response.status;
      throw error;
    }
    try {
      return responseText ? JSON.parse(responseText) : { features: [] };
    } catch (_) {
      throw new Error("Photon returned an invalid location response.");
    }
  });
}

function azobssNormaliseLocationFeatures(payload, stateCode) {
  const stateName = AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "";
  const features = Array.isArray(payload && payload.features) ? payload.features : [];
  const seen = new Set();
  const results = [];

  for (const feature of features) {
    const coordinates = feature && feature.geometry && feature.geometry.coordinates;
    const longitude = Number(Array.isArray(coordinates) ? coordinates[0] : NaN);
    const latitude = Number(Array.isArray(coordinates) ? coordinates[1] : NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (latitude < 0.5 || latitude > 7.7 || longitude < 99 || longitude > 120.5) continue;

    const properties = feature && feature.properties || {};
    const countryCode = String(properties.countrycode || properties.country_code || "").trim().toUpperCase();
    if (countryCode && countryCode !== "MY") continue;

    const key = `${latitude.toFixed(6)}|${longitude.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const parts = azobssLocationTextParts(properties);
    const label = parts.join(", ") || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    const extent = Array.isArray(properties.extent) && properties.extent.length === 4
      ? properties.extent.map(Number)
      : null;
    results.push({
      id: String(properties.osm_type || "") + String(properties.osm_id || key),
      label,
      name: String(properties.name || parts[0] || label).trim(),
      detail: parts.slice(1).join(", "),
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
      extent: extent && extent.every(Number.isFinite) ? extent : null,
      state: String(properties.state || stateName).trim(),
      country: String(properties.country || "Malaysia").trim()
    });
    if (results.length >= 8) break;
  }
  return results;
}

async function azobssSearchMalaysiaLocations(queryValue, stateValue) {
  const query = azobssCleanLocationQuery(queryValue);
  if (query.length < 3) throw new Error("Taip sekurang-kurangnya 3 huruf untuk mencari lokasi.");
  const stateCode = cleanLotStateCode(stateValue);
  if (!stateCode) throw new Error("Negeri pilihan tidak sah.");

  const cacheKey = `${stateCode}|${query.toLowerCase()}`;
  const cached = azobssLocationSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const stateName = AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "";
  const focusedQuery = [query, stateName, "Malaysia"].filter(Boolean).join(", ");
  const attempts = [
    { query, mode: "bounded" },
    { query: focusedQuery, mode: "biased" },
    { query: focusedQuery, mode: "minimal" },
    { query: focusedQuery, mode: "bare" }
  ];
  let results = [];
  let successfulRequest = false;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const payload = await azobssFetchPhotonLocations(attempt.query, stateCode, attempt.mode);
      successfulRequest = true;
      results = azobssNormaliseLocationFeatures(payload, stateCode);
      if (results.length) break;
    } catch (error) {
      lastError = error;
      console.warn("AZOBSS location provider attempt failed:", attempt.mode, error && error.message || error);
    }
  }

  if (!successfulRequest && lastError) {
    throw new Error("Carian lokasi sementara tidak tersedia. Sila cuba semula sebentar lagi.");
  }

  if (azobssLocationSearchCache.size > 250) azobssLocationSearchCache.clear();
  azobssLocationSearchCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + (15 * 60 * 1000)
  });
  return results;
}


// 576: One map search box now recognises Malaysian place names, lot numbers and PA numbers.
// Cadastre searches try the selected state first. If no result exists there, the backend
// checks the remaining states in small batches and returns the state on every suggestion.
const azobssMapCadastreSuggestionCache = new Map();

function azobssClassifyMapSearchQuery(value) {
  const query = azobssCleanLocationQuery(value);
  const upper = query.toUpperCase();
  const paMatch = upper.match(/^(?:NO\.?\s*)?PA\s*[:#-]?\s*([A-Z0-9/_-]{1,40})$/i);
  if (paMatch) {
    const paValue = cleanLotNumber(paMatch[1]);
    return { query, searchType: "pa", cadastre: Boolean(paValue), searchValue: paValue ? `PA${paValue.replace(/^PA/i, "")}` : "" };
  }
  const lotMatch = upper.match(/^(?:(?:NO\.?\s*)?LOT|NO\.?\s*LOT)\s*[:#-]?\s*([A-Z0-9/_-]{1,40})$/i);
  if (lotMatch) {
    const lotValue = cleanLotNumber(lotMatch[1]);
    return { query, searchType: "lot", cadastre: Boolean(lotValue), searchValue: lotValue };
  }
  if (/^\d{3,12}$/.test(upper)) {
    return { query, searchType: "lot", cadastre: true, searchValue: cleanLotNumber(upper) };
  }
  return { query, searchType: "location", cadastre: false, searchValue: query };
}

function azobssCadastreSuggestionRows(found, classification, productCode, stateCode) {
  const rows = Array.isArray(found && found.results) ? found.results : [];
  const stateName = AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "";
  const wanted = azobssFocusedLotComparable(classification.searchValue.replace(/^PA/i, ""));
  let filtered = rows;
  if (classification.searchType === "pa") {
    const exact = rows.filter((row) => {
      const pa = azobssFocusedLotComparable(String(row && row.paNo || "").replace(/^PA/i, ""));
      return pa && pa === wanted;
    });
    if (exact.length) filtered = exact;
  } else {
    const exact = rows.filter((row) => azobssFocusedLotComparable(row && row.lotNo) === wanted);
    if (exact.length) filtered = exact;
  }

  return filtered.slice(0, 12).map((row, index) => {
    const lotNo = String(row && row.lotNo || "").trim();
    const paNo = String(row && row.paNo || "").trim().toUpperCase();
    const rowStateName = String(row && row.negeri || stateName).replace(/^Negeri\s+/i, "").trim() || stateName;
    const daerah = String(row && row.daerah || "").trim();
    const mukim = String(row && row.mukim || "").trim();
    const seksyen = String(row && row.seksyen || "").trim();
    const context = [
      rowStateName && `Negeri: ${rowStateName}`,
      daerah && `Daerah: ${daerah}`,
      mukim && `Mukim/Bandar: ${mukim}`,
      seksyen && `Seksyen: ${seksyen}`
    ].filter(Boolean).join(" · ");
    return {
      id: `jupem-${productCode}-${stateCode}-${row && row.objectId || lotNo}-${paNo}-${index}`,
      kind: classification.searchType,
      name: classification.searchType === "pa"
        ? `${paNo || `PA${classification.searchValue.replace(/^PA/i, "")}`}${lotNo ? ` · Lot ${lotNo}` : ""}`
        : `Lot ${lotNo || classification.searchValue}${paNo ? ` · ${paNo}` : ""}`,
      label: classification.searchType === "pa"
        ? `${paNo || classification.searchValue}${lotNo ? ` · Lot ${lotNo}` : ""} · ${rowStateName}`
        : `Lot ${lotNo || classification.searchValue}${paNo ? ` · ${paNo}` : ""} · ${rowStateName}`,
      detail: context || `Negeri: ${rowStateName}`,
      productCode,
      stateCode,
      state: rowStateName,
      negeri: rowStateName,
      lotNo,
      paNo,
      daerah,
      mukim,
      seksyen,
      objectId: String(row && row.objectId || "").trim(),
      mapUrl: String(row && row.mapUrl || "").trim(),
      selectionUrl: String(row && row.selectionUrl || "").trim()
    };
  });
}

async function azobssSearchCadastreMapSuggestions(queryValue, stateValue, productValue) {
  const classification = azobssClassifyMapSearchQuery(queryValue);
  if (!classification.cadastre || !classification.searchValue) return [];
  const preferredState = cleanLotStateCode(stateValue);
  if (!preferredState) throw new Error("Negeri pilihan tidak sah.");
  const productCode = cleanLotProduct(productValue);
  const cacheKey = `${productCode}|${preferredState}|${classification.searchType}|${classification.searchValue}`;
  const cached = azobssMapCadastreSuggestionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  async function searchState(stateCode) {
    try {
      const found = classification.searchType === "pa"
        ? await searchJupemPaCadastre(stateCode, classification.searchValue)
        : await searchJupemLotCadastre(productCode, stateCode, classification.searchValue);
      return azobssCadastreSuggestionRows(found, classification, productCode, stateCode);
    } catch (error) {
      console.warn("AZOBSS map lot/PA suggestion state failed:", stateCode, error && error.message || error);
      return [];
    }
  }

  let results = await searchState(preferredState);
  if (!results.length) {
    const remainingStates = Object.keys(AZOBSS_JUPEM_LOT_STATE_NAMES).filter((code) => code !== preferredState);
    for (let index = 0; index < remainingStates.length && !results.length; index += 4) {
      const batch = remainingStates.slice(index, index + 4);
      const batchRows = await Promise.all(batch.map(searchState));
      results = batchRows.flat().slice(0, 12);
    }
  }

  if (azobssMapCadastreSuggestionCache.size > 180) azobssMapCadastreSuggestionCache.clear();
  azobssMapCadastreSuggestionCache.set(cacheKey, {
    results,
    expiresAt: Date.now() + (10 * 60 * 1000)
  });
  return results;
}

async function azobssSearchMapSuggestions(queryValue, stateValue, productValue) {
  const classification = azobssClassifyMapSearchQuery(queryValue);
  if (classification.query.length < 3) {
    throw new Error("Taip sekurang-kurangnya 3 aksara untuk mencari lokasi, lot atau PA.");
  }
  if (classification.cadastre) {
    return {
      searchType: classification.searchType,
      results: await azobssSearchCadastreMapSuggestions(classification.query, stateValue, productValue),
      provider: "JUPEM eBiz",
      attribution: "JUPEM eBiz"
    };
  }
  return {
    searchType: "location",
    results: await azobssSearchMalaysiaLocations(classification.query, stateValue),
    provider: "Photon",
    attribution: "OpenStreetMap contributors"
  };
}

function azobssGetAllLotMapLayerIds(productCode) {
  const product = cleanLotProduct(productCode);
  const stateConfigs = Object.values(AZOBSS_JUPEM_LOT_CONFIG[product] || {});
  return [...new Set(stateConfigs.flatMap((config) => [config.lotLayer, config.sheetLayer]))]
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
}

function azobssGetAllLotMapLayerIdsByType(productCode, layerType) {
  const product = cleanLotProduct(productCode);
  const stateConfigs = Object.values(AZOBSS_JUPEM_LOT_CONFIG[product] || {});
  const key = layerType === "sheets" ? "sheetLayer" : "lotLayer";
  return [...new Set(stateConfigs.map((config) => config[key]))]
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
}

function azobssNormalizeLotPolygon(value) {
  const geometry = value && value.geometry ? value.geometry : value;
  const sourceRings = geometry && Array.isArray(geometry.rings) ? geometry.rings : [];
  let pointCount = 0;
  const rings = sourceRings.map((ring) => {
    if (!Array.isArray(ring) || ring.length < 3) throw new Error("Selection polygon is invalid.");
    const cleanRing = ring.map((point) => {
      const longitude = Number(point && point[0]);
      const latitude = Number(point && point[1]);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < 95 || longitude > 125 || latitude < -2 || latitude > 8.5) {
        throw new Error("Selection polygon is outside Malaysia.");
      }
      pointCount += 1;
      return [Number(longitude.toFixed(8)), Number(latitude.toFixed(8))];
    });
    const first = cleanRing[0];
    const last = cleanRing[cleanRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) cleanRing.push(first.slice());
    return cleanRing;
  });
  if (!rings.length || pointCount > 1000) throw new Error("Selection polygon is missing or too complex.");
  return { rings, spatialReference: { wkid: 4326 } };
}

function azobssRingAreaM2(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const radius = 6378137;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const point1 = ring[index];
    const point2 = ring[index + 1];
    const lon1 = Number(point1[0]) * Math.PI / 180;
    const lon2 = Number(point2[0]) * Math.PI / 180;
    const lat1 = Number(point1[1]) * Math.PI / 180;
    const lat2 = Number(point2[1]) * Math.PI / 180;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return area * radius * radius / 2;
}

function azobssPolygonAreaM2(geometry) {
  const rings = geometry && Array.isArray(geometry.rings) ? geometry.rings : [];
  return Math.abs(rings.reduce((sum, ring) => sum + azobssRingAreaM2(ring), 0));
}

async function azobssJupemArcGisJson(serviceUrl, params, auth, timeoutMs = 30000) {
  const requestUrl = new URL(serviceUrl);
  const requestParams = new URLSearchParams({ ...(params || {}), f: "json", token: auth.token });
  const usePost = /\/query\/?$/i.test(requestUrl.pathname) || requestParams.toString().length > 1800;
  if (!usePost) requestUrl.search = requestParams.toString();
  const response = await fetch(requestUrl, azJupemFetchOptions({
    method: usePost ? "POST" : "GET",
    body: usePost ? requestParams.toString() : undefined,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: azobssJupemBaseHeaders({
      "Accept": "application/json,*/*",
      ...(usePost ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}),
      "Cookie": auth.cookie,
      "Referer": "https://ebiz.jupem.gov.my/PetaInteraktif"
    })
  }));
  if (!response.ok) throw new Error(`JUPEM ArcGIS returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload && payload.error) throw new Error(payload.error.message || `JUPEM ArcGIS error ${payload.error.code || ""}.`);
  return payload;
}

async function azobssQueryLotObjectIds(config, geometry, auth) {
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.lotLayer}`;
  const common = {
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects"
  };
  return await azobssJupemArcGisJson(`${layerUrl}/query`, { ...common, returnIdsOnly: "true" }, auth);
}

async function azobssQueryLotFeatureSet(config, geometry, auth, knownIdResult) {
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.lotLayer}`;
  const idResult = knownIdResult || await azobssQueryLotObjectIds(config, geometry, auth);
  const objectIds = Array.isArray(idResult.objectIds) ? idResult.objectIds : [];
  if (!objectIds.length) throw new Error("Tiada lot JUPEM ditemui dalam kawasan pilihan.");
  if (objectIds.length > 20000) throw new Error("Pilihan melebihi 20,000 lot. Sila kecilkan kawasan pilihan.");

  const features = [];
  let fields = [];
  let geometryType = "esriGeometryPolygon";
  for (let offset = 0; offset < objectIds.length; offset += 200) {
    const batch = await azobssJupemArcGisJson(`${layerUrl}/query`, {
      objectIds: objectIds.slice(offset, offset + 200).join(","),
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326"
    }, auth, 45000);
    if (!fields.length && Array.isArray(batch.fields)) fields = batch.fields;
    if (batch.geometryType) geometryType = batch.geometryType;
    if (Array.isArray(batch.features)) features.push(...batch.features);
  }
  if (!features.length) throw new Error("Geometri lot JUPEM tidak dapat dibaca.");
  return {
    objectIdFieldName: String(idResult.objectIdFieldName || "OBJECTID"),
    geometryType,
    spatialReference: { wkid: 4326 },
    fields,
    features
  };
}

async function azobssDetectLotMapConfig(productCode, requestedStateCode, geometry, auth) {
  const product = cleanLotProduct(productCode);
  const requestedConfig = azobssGetLotMapConfig(product, requestedStateCode);
  const seenLayers = new Set([requestedConfig.lotLayer]);
  const candidates = Object.keys(AZOBSS_JUPEM_LOT_CONFIG[product] || {})
    .map((state) => azobssGetLotMapConfig(product, state))
    .filter((config) => {
      if (seenLayers.has(config.lotLayer)) return false;
      seenLayers.add(config.lotLayer);
      return true;
    });
  let bestMatch = null;
  for (let offset = 0; offset < candidates.length; offset += 4) {
    const batch = await Promise.all(candidates.slice(offset, offset + 4).map(async (config) => {
      try {
        const idResult = await azobssQueryLotObjectIds(config, geometry, auth);
        const count = Array.isArray(idResult.objectIds) ? idResult.objectIds.length : 0;
        return count ? { config, idResult, count } : null;
      } catch (_) {
        return null;
      }
    }));
    batch.filter(Boolean).forEach((match) => {
      if (!bestMatch || match.count > bestMatch.count) bestMatch = match;
    });
  }
  return bestMatch;
}

async function azobssQueryLotSheets(config, geometry, auth) {
  const layerUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/${config.sheetLayer}/query`;
  const result = await azobssJupemArcGisJson(layerUrl, {
    geometry: JSON.stringify(geometry),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326"
  }, auth);
  return Array.isArray(result.features) ? result.features : [];
}

function azobssLotPricingForRatio(value) {
  const areaRatio = Number(value);
  if (!Number.isFinite(areaRatio) || areaRatio <= 0 || areaRatio > 1.1) return null;
  if (areaRatio >= 0.9) return { variant: "FULL_SHEET", amount: 50 };
  const proportionalAmount = (areaRatio / 0.25) * 15;
  // AZOBSS 565: Lot Kadaster uses whole-ringgit half-up rounding and a RM5 minimum.
  // Examples: RM34.16 -> RM34, RM34.50 -> RM35, any smaller selection -> at least RM5.
  const roundedAmount = Math.floor(proportionalAmount + 0.5 + Number.EPSILON);
  return {
    variant: "AREA_BASED",
    amount: Math.max(5, roundedAmount)
  };
}

function azobssLotSheetName(feature, index) {
  const attributes = feature && feature.attributes || {};
  const key = Object.keys(attributes).find((name) => /^(?:NAMA|NAME|NO_?SYIT|SYIT|LEMBAR|PIAWAI)$/i.test(name));
  return String(key ? attributes[key] : `Syit ${index + 1}`).trim();
}

async function azobssEstimateLotSelection(productCode, stateCode, rawGeometry) {
  const requestedConfig = azobssGetLotMapConfig(productCode, stateCode);
  let config = requestedConfig;
  const geometry = azobssNormalizeLotPolygon(rawGeometry);
  const auth = await azobssGetJupemMapAuth(false);
  let idResult = await azobssQueryLotObjectIds(config, geometry, auth);
  if (!Array.isArray(idResult.objectIds) || !idResult.objectIds.length) {
    const detected = await azobssDetectLotMapConfig(productCode, stateCode, geometry, auth);
    if (!detected) throw new Error("Tiada lot JUPEM ditemui dalam kawasan pilihan.");
    config = detected.config;
    idResult = detected.idResult;
  }
  const [featureSet, sheets] = await Promise.all([
    azobssQueryLotFeatureSet(config, geometry, auth, idResult),
    azobssQueryLotSheets(config, geometry, auth)
  ]);
  const selectedAreaM2 = featureSet.features.reduce((sum, feature) => sum + azobssPolygonAreaM2(feature.geometry), 0);
  const drawnAreaM2 = azobssPolygonAreaM2(geometry);
  const sheetRows = sheets.map((feature, index) => ({
    name: azobssLotSheetName(feature, index),
    areaM2: azobssPolygonAreaM2(feature.geometry)
  })).filter((row) => row.areaM2 > 0);
  if (!sheetRows.length) throw new Error("Keluasan rujukan satu syit JUPEM tidak dapat ditentukan.");
  const sheetAreas = sheetRows.map((row) => row.areaM2).sort((left, right) => left - right);
  const middle = Math.floor(sheetAreas.length / 2);
  const referenceSheetAreaM2 = sheetAreas.length % 2
    ? sheetAreas[middle]
    : (sheetAreas[middle - 1] + sheetAreas[middle]) / 2;
  const areaRatio = drawnAreaM2 / referenceSheetAreaM2;
  const pricing = azobssLotPricingForRatio(areaRatio);
  if (!pricing) {
    throw new Error("Kawasan pilihan melebihi anggaran keluasan satu syit. Sila kecilkan kawasan pilihan.");
  }
  const { variant, amount } = pricing;
  return {
    config,
    auth,
    geometry,
    featureSet,
    lotCount: featureSet.features.length,
    drawnAreaM2,
    selectedAreaM2,
    sheetCount: sheetRows.length,
    sheets: sheetRows,
    referenceSheetAreaM2,
    areaRatio,
    variant,
    amount,
    requestedStateCode: requestedConfig.state,
    stateAutoDetected: config.state !== requestedConfig.state
  };
}

async function azobssSubmitLotGpJob(estimate) {
  const serviceUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/${estimate.config.gp}`;
  let auth = estimate.auth;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt) {
      await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 1200 : 3000));
      try { auth = await azobssGetJupemMapAuth(true); } catch (_) {}
    }
    const submitBody = new URLSearchParams({
      f: "json",
      token: auth.token,
      Layers_to_Clip: JSON.stringify([]),
      Area_of_Interest: JSON.stringify(estimate.featureSet),
      Feature_Format: "Shapefile - SHP - .shp"
    });
    try {
      const submitResponse = await fetch(`${serviceUrl}/submitJob`, azJupemFetchOptions({
        method: "POST",
        redirect: "follow",
        signal: AbortSignal.timeout(60000),
        headers: azobssJupemBaseHeaders({
          "Accept": "application/json,*/*",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Cookie": auth.cookie,
          "Referer": "https://ebiz.jupem.gov.my/PetaInteraktif"
        }),
        body: submitBody.toString()
      }));
      if (!submitResponse.ok) {
        const responseError = new Error(`JUPEM GP returned HTTP ${submitResponse.status}.`);
        responseError.status = submitResponse.status;
        throw responseError;
      }
      const submitted = await submitResponse.json();
      if (submitted.error || !submitted.jobId) throw new Error(submitted.error && submitted.error.message || "JUPEM did not return a job ID.");
      return {
        jobId: String(submitted.jobId),
        jobStatus: String(submitted.jobStatus || "esriJobSubmitted")
      };
    } catch (error) {
      lastError = error;
      const status = Number(error && error.status || 0);
      if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 408 && status !== 429) break;
    }
  }
  throw lastError || new Error("Sambungan JUPEM terputus sebelum Job ID diterima.");
}

function azobssIsTransientJupemError(error) {
  const message = String(error && (error.message || error) || "");
  const code = String(error && error.code || "");
  return /fetch failed|network|socket|timed?\s*out|timeout|ECONN|EAI_AGAIN|ENOTFOUND|UND_ERR|did not register|not register|masih (?:menyediakan|menyelaraskan)/i.test(message)
    || /^AZOBSS_JUPEM_LOT_/i.test(code);
}

async function azobssGetLotGpJobStatus(productCode, stateCode, jobId) {
  const config = azobssGetLotMapConfig(productCode, stateCode);
  const auth = await azobssGetJupemMapAuth(false);
  const serviceUrl = `https://ebiz.jupem.gov.my/arcgis/rest/services/${config.gp}`;
  const job = await azobssJupemArcGisJson(
    `${serviceUrl}/jobs/${encodeURIComponent(String(jobId || ""))}`,
    {},
    auth,
    30000
  );
  return String(job.jobStatus || "esriJobUnknown");
}


async function azobssWaitForLotGpJobReady(productCode, stateCode, jobId, timeoutMs = 4 * 60 * 1000) {
  const startedAt = Date.now();
  let lastStatus = "esriJobUnknown";
  let lastError = null;
  let pollCount = 0;

  while (Date.now() - startedAt < timeoutMs) {
    pollCount += 1;
    try {
      lastStatus = await azobssGetLotGpJobStatus(productCode, stateCode, jobId);
      if (/^esriJobSucceeded$/i.test(lastStatus)) {
        console.log("JUPEM Lot GP job ready:", {
          jobId: String(jobId || ""),
          stateCode: String(stateCode || ""),
          productCode: String(productCode || ""),
          status: lastStatus,
          elapsedMs: Date.now() - startedAt,
          polls: pollCount
        });
        return lastStatus;
      }
      if (/^esriJob(?:Failed|Cancelled|TimedOut|Deleted)$/i.test(lastStatus)) {
        throw new Error(`JUPEM gagal menyediakan Lot Kadaster (${lastStatus}).`);
      }
      lastError = null;
    } catch (error) {
      if (/JUPEM gagal menyediakan Lot Kadaster/i.test(String(error && error.message || ""))) throw error;
      lastError = error;
      // A stale ArcGIS token can make a valid job look unavailable. Force a fresh map session on the next poll.
      azobssJupemMapAuthCache = { token: "", cookie: "", expiresAt: 0 };
    }

    const elapsed = Date.now() - startedAt;
    const delayMs = elapsed < 15000 ? 1500 : elapsed < 60000 ? 3000 : 5000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const timeoutError = new Error(
    lastError
      ? `JUPEM masih menyediakan Lot Kadaster dan semakan status terakhir gagal: ${lastError.message || lastError}`
      : `JUPEM masih menyediakan Lot Kadaster (${lastStatus}). Sila tunggu dan cuba semula.`
  );
  timeoutError.code = "AZOBSS_JUPEM_LOT_JOB_NOT_READY";
  timeoutError.jobStatus = lastStatus;
  throw timeoutError;
}

function azobssSplitJupemCallArguments(source) {
  const args = [];
  let value = "";
  let quote = "";
  let escaped = false;
  for (const character of String(source || "")) {
    if (quote) {
      if (escaped) {
        value += character;
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      } else {
        value += character;
      }
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === ",") {
      args.push(decodeHtmlEntities(value.trim()));
      value = "";
      continue;
    }
    value += character;
  }
  args.push(decodeHtmlEntities(value.trim()));
  return args;
}

function azobssParseJupemCartRows(html) {
  const rows = [];
  const seen = new Set();
  const pattern = /AddQuantity\s*\(([\s\S]*?)\)/gi;
  let match;
  while ((match = pattern.exec(String(html || "")))) {
    const args = azobssSplitJupemCallArguments(match[1]);
    if (args.length < 3) continue;
    const deleteIndex = args.findIndex((value) => /^delete$/i.test(String(value || "").trim()));
    if (deleteIndex < 0) continue;
    const productSelectedId = String(args[0] || "").trim();
    const userId = String(args[1] || "").trim();
    const cartDetailId = String(args[2] || "").trim();
    const type = String(args[deleteIndex + 1] || args[4] || "").trim();
    const categoryId = String(args[deleteIndex + 2] || args[5] || "").trim();
    if (!productSelectedId || !cartDetailId) continue;
    const key = `${productSelectedId}:${cartDetailId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      productSelectedId,
      userId,
      cartDetailId,
      type,
      categoryId,
      key
    });
  }
  return rows;
}

function azobssJupemIsLoginPage(html, url = "") {
  const source = String(html || "");
  return /\/Home\/LogMasuk(?:[/?#]|$)/i.test(String(url || ""))
    || /<title>\s*Log\s*Masuk/i.test(source)
    || (/name=["']KataLaluan["']/i.test(source) && /name=["']IDPengguna["']/i.test(source));
}

function azobssJupemRegistrationAccepted(html, url = "", status = 0) {
  const source = String(html || "");
  const responseUrl = String(url || "");
  const responseStatus = Number(status || 0);
  if (azobssJupemIsLoginPage(source, responseUrl)) return false;
  if (responseStatus && (responseStatus < 200 || responseStatus >= 400)) return false;

  const explicitFailure = /(?:ralat|gagal|tidak\s+berjaya|invalid|exception)[^<\r\n]{0,160}(?:troli|produk|kadaster|lot)/i.test(source);
  if (explicitFailure) return false;

  return /\/Transaksi\/KadasterLotBerdigitCrop/i.test(responseUrl)
    || /telah\s+ditambah\s+(?:ke|di\s+dalam)\s+Troli/i.test(source)
    || /berjaya[^<\r\n]{0,120}(?:tambah|daftar)[^<\r\n]{0,120}Troli/i.test(source)
    || /["']?(?:Success|success|Succeeded|succeeded)["']?\s*:\s*true/i.test(source)
    // JUPEM also uses this authenticated product endpoint as the registration trigger.
    // A successful non-login response is usable even when it returns an empty/partial body.
    || (/\/Produk\/LotKadasterBerdigitCrop/i.test(responseUrl)
      && (!responseStatus || (responseStatus >= 200 && responseStatus < 300)));
}

function azobssJupemSubmissionLooksUsable(html, url = "", status = 0) {
  const source = String(html || "");
  const responseStatus = Number(status || 0);
  if (responseStatus < 200 || responseStatus >= 400) return false;
  if (azobssJupemIsLoginPage(source, url)) return false;
  return !/(?:ralat|gagal|tidak\s+berjaya|invalid|exception)[^<\r\n]{0,120}(?:troli|produk|kadaster|lot)/i.test(source);
}

function azobssJupemPurchaseCandidateIds(purchaseForm, jobId, ...htmlSources) {
  const candidates = new Set([String(jobId || "").trim()].filter(Boolean));
  if (purchaseForm && purchaseForm.body) {
    for (const [name, value] of purchaseForm.body.entries()) {
      if (/Product(?:Selected)?ID|ProductID|KadasterLotBerdigit/i.test(String(name || ""))) {
        const cleaned = String(value || "").trim();
        if (cleaned) candidates.add(cleaned);
      }
    }
  }
  for (const html of htmlSources) {
    const source = String(html || "");
    const pattern = /(?:ProductSelectedID|ProductID)\s*(?:[=:]|value\s*=)\s*["']?([A-Za-z0-9_-]+)/gi;
    let match;
    while ((match = pattern.exec(source))) {
      if (match[1]) candidates.add(String(match[1]).trim());
    }
  }
  return candidates;
}

function azobssFindJupemCartRowByCandidates(rows, candidates) {
  if (!candidates || !candidates.size) return null;
  return rows.find((row) => candidates.has(String(row.productSelectedId || ""))
    || candidates.has(String(row.cartDetailId || ""))) || null;
}

function azobssHtmlAttribute(attributes, name) {
  const match = String(attributes || "").match(new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"));
  return decodeHtmlEntities(match ? (match[1] !== undefined ? match[1] : match[2]) : "");
}

function azobssParseJupemPurchaseForm(html, baseUrl) {
  const forms = [];
  const formPattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch;
  while ((formMatch = formPattern.exec(String(html || "")))) {
    const attributes = formMatch[1] || "";
    const content = formMatch[2] || "";
    if (!/Tambah\s*(?:Ke|ke)?\s*Troli|ProductID|KadasterLotBerdigit/i.test(content + " " + attributes)) continue;
    const body = new URLSearchParams();
    const inputPattern = /<input\b([^>]*)>/gi;
    let inputMatch;
    while ((inputMatch = inputPattern.exec(content))) {
      const inputAttributes = inputMatch[1] || "";
      const name = azobssHtmlAttribute(inputAttributes, "name");
      const type = azobssHtmlAttribute(inputAttributes, "type").toLowerCase();
      if (!name || ["button", "reset", "file", "image"].includes(type)) continue;
      if (["checkbox", "radio"].includes(type) && !/\bchecked(?:\s*=|\s|$)/i.test(inputAttributes)) continue;
      body.append(name, azobssHtmlAttribute(inputAttributes, "value"));
    }
    const selectPattern = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
    let selectMatch;
    while ((selectMatch = selectPattern.exec(content))) {
      const name = azobssHtmlAttribute(selectMatch[1], "name");
      if (!name) continue;
      const options = Array.from(String(selectMatch[2] || "").matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi));
      const selected = options.find((option) => /\bselected(?:\s*=|\s|$)/i.test(option[1])) || options[0];
      if (selected) body.append(name, azobssHtmlAttribute(selected[1], "value") || decodeHtmlEntities(String(selected[2] || "").replace(/<[^>]+>/g, "").trim()));
    }
    const textAreaPattern = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
    let textAreaMatch;
    while ((textAreaMatch = textAreaPattern.exec(content))) {
      const name = azobssHtmlAttribute(textAreaMatch[1], "name");
      if (name) body.append(name, decodeHtmlEntities(textAreaMatch[2] || ""));
    }
    const action = azobssHtmlAttribute(attributes, "action");
    const actionUrl = new URL(action || baseUrl, baseUrl);
    if (actionUrl.protocol !== "https:" || actionUrl.hostname.toLowerCase() !== "ebiz.jupem.gov.my") continue;
    forms.push({
      action: actionUrl.toString(),
      method: String(azobssHtmlAttribute(attributes, "method") || "POST").toUpperCase() === "GET" ? "GET" : "POST",
      body
    });
  }
  return forms[0] || null;
}

async function azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, loginRetried = false) {
  const session = await azobssGetJupemAuthenticatedSession(false);
  const cartUrl = `https://ebiz.jupem.gov.my/Transaksi/MyTroliDetailXTerhad/${encodeURIComponent(session.userId)}`;
  const beforeResult = await azobssJupemAuthFetch(
    cartUrl,
    { referer: "https://ebiz.jupem.gov.my/Home/Dashboard" },
    session.cookie
  );
  session.cookie = beforeResult.cookie;
  azobssJupemAuthenticatedCache.cookie = session.cookie;
  const beforeHtml = await beforeResult.response.text();
  if (azobssJupemIsLoginPage(beforeHtml, beforeResult.url) && !loginRetried) {
    azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
    return await azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, true);
  }
  const beforeRows = azobssParseJupemCartRows(beforeHtml);
  const beforeKeys = new Set(beforeRows.map((row) => row.key));

  const productUrl = `https://ebiz.jupem.gov.my/Produk/LotKadasterBerdigitCrop?id=${encodeURIComponent(jobId)}&Negeri=${encodeURIComponent(stateCode)}&type=${encodeURIComponent(productCode)}`;
  const registered = await azobssJupemAuthFetch(productUrl, {
    ajax: true,
    referer: `https://ebiz.jupem.gov.my/PetaInteraktif?type=${encodeURIComponent(stateCode)}lot&c=pl&jenis=Lot&produk=${encodeURIComponent(productCode)}&neg=${encodeURIComponent(stateCode)}`
  }, session.cookie);
  session.cookie = registered.cookie;
  azobssJupemAuthenticatedCache.cookie = session.cookie;
  const registeredHtml = await registered.response.text();
  if (azobssJupemIsLoginPage(registeredHtml, registered.url) && !loginRetried) {
    azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
    return await azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, true);
  }

  const purchaseForm = azobssParseJupemPurchaseForm(registeredHtml, registered.url || productUrl);
  let submittedHtml = "";
  let submittedUrl = "";
  let submittedStatus = 0;
  if (purchaseForm) {
    const submitUrl = purchaseForm.method === "GET"
      ? `${purchaseForm.action}${purchaseForm.action.includes("?") ? "&" : "?"}${purchaseForm.body.toString()}`
      : purchaseForm.action;
    const submitted = await azobssJupemAuthFetch(submitUrl, {
      method: purchaseForm.method,
      ajax: true,
      contentType: purchaseForm.method === "GET" ? "" : "application/x-www-form-urlencoded; charset=UTF-8",
      referer: registered.url || productUrl,
      body: purchaseForm.method === "GET" ? undefined : purchaseForm.body.toString()
    }, session.cookie);
    session.cookie = submitted.cookie;
    azobssJupemAuthenticatedCache.cookie = session.cookie;
    submittedUrl = submitted.url || submitUrl;
    submittedStatus = submitted.response.status;
    submittedHtml = await submitted.response.text();
    if (azobssJupemIsLoginPage(submittedHtml, submittedUrl) && !loginRetried) {
      azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
      return await azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, true);
    }
  }

  const candidateIds = azobssJupemPurchaseCandidateIds(
    purchaseForm,
    jobId,
    registeredHtml,
    submittedHtml
  );
  let added = null;
  let existing = null;
  let afterRows = [];
  const retryDelaysMs = [0, 1000, 2500, 5000, 7500];
  for (const delayMs of retryDelaysMs) {
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    const afterResult = await azobssJupemAuthFetch(
      cartUrl,
      { referer: submittedUrl || registered.url || productUrl },
      session.cookie
    );
    session.cookie = afterResult.cookie;
    azobssJupemAuthenticatedCache.cookie = session.cookie;
    const afterHtml = await afterResult.response.text();
    if (azobssJupemIsLoginPage(afterHtml, afterResult.url) && !loginRetried) {
      azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
      return await azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, true);
    }
    afterRows = azobssParseJupemCartRows(afterHtml);
    added = afterRows.find((row) => !beforeKeys.has(row.key)) || null;
    existing = azobssFindJupemCartRowByCandidates(afterRows, candidateIds);
    if (added || existing) break;
  }

  const registrationAccepted = azobssJupemRegistrationAccepted(
    submittedHtml || registeredHtml,
    submittedUrl || registered.url || productUrl,
    submittedStatus || registered.response.status
  ) || azobssJupemRegistrationAccepted(
    registeredHtml,
    registered.url || productUrl,
    registered.response.status
  );
  const submissionCompleted = Boolean(purchaseForm)
    && azobssJupemSubmissionLooksUsable(submittedHtml, submittedUrl, submittedStatus);

  if (!added && !existing && !registrationAccepted && !submissionCompleted) {
    console.warn("JUPEM lot purchase form did not create a verifiable cart row:", {
      responseUrl: registered.url || productUrl,
      responseStatus: registered.response.status,
      purchaseFormFound: Boolean(purchaseForm),
      purchaseFormAction: purchaseForm ? new URL(purchaseForm.action).pathname : "",
      submittedUrl,
      submittedStatus,
      beforeRows: beforeRows.length,
      afterRows: afterRows.length,
      candidateIds: Array.from(candidateIds)
    });
    const registrationError = new Error("JUPEM masih menyelaraskan produk Lot Kadaster dengan troli. Backend akan cuba semula.");
    registrationError.code = "AZOBSS_JUPEM_LOT_REGISTRATION_PENDING";
    throw registrationError;
  }

  if (!added && !existing) {
    console.warn("JUPEM lot registration accepted without a visible cart row; continuing with download verification:", {
      submittedUrl: submittedUrl || registered.url || productUrl,
      submittedStatus: submittedStatus || registered.response.status,
      registrationAccepted,
      submissionCompleted,
      beforeRows: beforeRows.length,
      afterRows: afterRows.length
    });
  }

  return {
    registered: true,
    session,
    added,
    existing: Boolean(existing && beforeKeys.has(existing.key)),
    registrationAccepted: Boolean(registrationAccepted || submissionCompleted)
  };
}

async function azobssRemoveRegisteredJupemLotUnlocked(registration) {
  const session = registration && registration.session;
  const added = registration && registration.added;
  if (!session || !added) return { removedFromCart: false };
  const deleteResult = await azobssJupemAuthFetch("https://ebiz.jupem.gov.my/Transaksi/TroliDetailXTerhad", {
    method: "POST",
    ajax: true,
    accept: "application/json,*/*",
    contentType: "application/json; charset=utf-8",
    referer: `https://ebiz.jupem.gov.my/Transaksi/MyTroliDetailXTerhad/${encodeURIComponent(session.userId)}`,
    body: JSON.stringify({
      userid: Number(added.userId),
      Troliid: Number(added.cartDetailId),
      ProductSelectedID: Number(added.productSelectedId),
      name: "delete",
      type: added.type,
      CategoryID: added.categoryId
    })
  }, session.cookie);
  session.cookie = deleteResult.cookie;
  azobssJupemAuthenticatedCache.cookie = session.cookie;
  const deletePayload = JSON.parse(await deleteResult.response.text() || "{}");
  if (!deletePayload.Success) throw new Error("JUPEM cart cleanup failed.");
  return { removedFromCart: true };
}

async function azobssWithRegisteredJupemLot(productCode, stateCode, jobId, task) {
  // ArcGIS returns a Job ID before the ZIP job is actually complete. Registering that ID too early
  // is the main cause of intermittent "did not register" failures, so wait outside the cart lock.
  await azobssWaitForLotGpJobReady(productCode, stateCode, jobId);

  let registration = null;
  let registrationError = null;
  const registrationRetryDelaysMs = [0, 3000, 7000];
  for (const delayMs of registrationRetryDelaysMs) {
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      registration = await azobssWithJupemCartMutationLock(
        () => azobssRegisterJupemLotUnlocked(productCode, stateCode, jobId, false)
      );
      break;
    } catch (error) {
      registrationError = error;
      if (!azobssIsTransientJupemError(error)) throw error;
      console.warn("JUPEM Lot registration pending; retrying:", {
        jobId: String(jobId || ""),
        stateCode: String(stateCode || ""),
        productCode: String(productCode || ""),
        error: String(error && error.message || error)
      });
    }
  }
  if (!registration) throw registrationError || new Error("JUPEM Lot registration is unavailable.");

  try {
    return await task(registration.session.cookie);
  } finally {
    if (registration.added) {
      try {
        await azobssWithJupemCartMutationLock(
          () => azobssRemoveRegisteredJupemLotUnlocked(registration)
        );
      } catch (error) {
        console.warn("JUPEM temporary lot cart cleanup failed:", error && (error.message || error));
      }
    }
  }
}

function azobssLotDownloadUrl(productCode, jobId, stateCode) {
  const stateName = AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "";
  const pathName = cleanLotProduct(productCode) === "2"
    ? "MuatTurunLotKadasterBerdigitCropc3"
    : "MuatTurunLotKadasterBerdigitCrop";
  return `https://ebiz.jupem.gov.my/MuatTurunPembelian/${pathName}/${encodeURIComponent(jobId)}?negeri=${encodeURIComponent(stateName)}`;
}


// 569: Register the completed JUPEM Job ID in eBiz, then verify the public direct URL
// by reading only the first bytes. The complete ZIP is still downloaded by the user's
// browser directly from JUPEM and is never buffered/proxied through Render.
const azobssLotDirectReadyCache = new Map();
const azobssLotCleanupTimers = new Map();

function azobssLotDirectReadyKey(productCode, stateCode, jobId) {
  return `${cleanLotProduct(productCode)}|${cleanLotStateCode(stateCode)}|${String(jobId || "").trim()}`;
}

async function azobssProbeJupemLotDirectZip(directUrl, timeoutMs = 25000) {
  const response = await fetch(directUrl, azJupemFetchOptions({
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: azobssJupemBaseHeaders({
      "Accept": "application/zip,application/x-zip-compressed,application/octet-stream,*/*",
      "Accept-Language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
      "Range": "bytes=0-31",
      "Referer": "https://ebiz.jupem.gov.my/"
    })
  }));

  const finalUrl = String(response.url || directUrl);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const disposition = String(response.headers.get("content-disposition") || "").toLowerCase();
  const chunks = [];
  let total = 0;
  try {
    if (response.body && typeof response.body.getReader === "function") {
      const reader = response.body.getReader();
      try {
        while (total < 32) {
          const part = await reader.read();
          if (part.done) break;
          if (part.value && part.value.length) {
            const value = Buffer.from(part.value);
            chunks.push(value);
            total += value.length;
          }
        }
      } finally {
        try { await reader.cancel(); } catch (_) {}
      }
    } else {
      const smallBuffer = Buffer.from(await response.arrayBuffer());
      chunks.push(smallBuffer.slice(0, 32));
      total = Math.min(smallBuffer.length, 32);
    }
  } catch (error) {
    try { if (response.body && typeof response.body.cancel === "function") await response.body.cancel(); } catch (_) {}
    throw error;
  }

  const head = Buffer.concat(chunks).slice(0, 32);
  const isZip = azobssBufferIsZip(head);
  const looksLogin = /\/Home\/LogMasuk(?:[/?#]|$)/i.test(finalUrl);
  const looksHtml = contentType.includes("text/html") || /^\s*(?:<!doctype|<html|<head|<body)/i.test(head.toString("utf8"));
  const headerLooksZip = /(?:application\/(?:zip|x-zip-compressed)|application\/octet-stream)/i.test(contentType)
    || /filename[^;=]*=\s*["']?[^"';]+\.zip/i.test(disposition);
  // Do not trust HTTP 200 or an octet-stream header alone: JUPEM's Error page can
  // still be returned successfully. A real ZIP must begin with the PK signature.
  const ready = Boolean(response.ok && !looksLogin && !looksHtml && isZip);

  return {
    ready,
    status: response.status,
    contentType,
    disposition,
    finalUrl,
    isZip,
    headHex: head.slice(0, 8).toString("hex")
  };
}

function azobssScheduleRegisteredLotCleanup(registration, cacheKey, delayMs = 15 * 60 * 1000) {
  if (!registration || !registration.added || azobssLotCleanupTimers.has(cacheKey)) return;
  const timer = setTimeout(async () => {
    azobssLotCleanupTimers.delete(cacheKey);
    try {
      await azobssWithJupemCartMutationLock(
        () => azobssRemoveRegisteredJupemLotUnlocked(registration)
      );
    } catch (error) {
      console.warn("JUPEM delayed Lot cart cleanup failed:", error && (error.message || error));
    }
  }, delayMs);
  if (timer && typeof timer.unref === "function") timer.unref();
  azobssLotCleanupTimers.set(cacheKey, timer);
}

async function azobssEnsureJupemLotDirectReady(productCode, stateCode, jobId) {
  const cleanProduct = cleanLotProduct(productCode);
  const cleanStateCode = cleanLotStateCode(stateCode);
  const cleanJobId = String(jobId || "").trim();
  const cacheKey = azobssLotDirectReadyKey(cleanProduct, cleanStateCode, cleanJobId);
  const cached = azobssLotDirectReadyCache.get(cacheKey);
  if (cached && cached.ready && cached.expiresAt > Date.now()) return cached.result;
  if (cached && cached.promise) return await cached.promise;

  const promise = (async () => {
    const jobStatus = await azobssGetLotGpJobStatus(cleanProduct, cleanStateCode, cleanJobId);
    if (/^esriJob(?:Failed|Cancelled|TimedOut|Deleted)$/i.test(jobStatus)) {
      throw new Error(`JUPEM gagal menyediakan Lot Kadaster (${jobStatus}).`);
    }
    if (!/^esriJobSucceeded$/i.test(jobStatus)) {
      const waitingError = new Error(`JUPEM masih menyediakan Lot Kadaster (${jobStatus}).`);
      waitingError.code = "AZOBSS_JUPEM_LOT_JOB_NOT_READY";
      waitingError.jobStatus = jobStatus;
      throw waitingError;
    }
    const directUrl = azobssLotDownloadUrl(cleanProduct, cleanJobId, cleanStateCode);

    // Already registered/public from an earlier attempt: avoid touching the shared cart.
    try {
      const initialProbe = await azobssProbeJupemLotDirectZip(directUrl, 10000);
      if (initialProbe.ready) {
        return { ready: true, directUrl, jobStatus, registered: false, probe: initialProbe };
      }
    } catch (error) {
      console.warn("JUPEM direct ZIP pre-registration probe failed:", error && (error.message || error));
    }

    let registration = null;
    try {
      registration = await azobssWithJupemCartMutationLock(
        () => azobssRegisterJupemLotUnlocked(cleanProduct, cleanStateCode, cleanJobId, false)
      );
    } catch (error) {
      if (!azobssIsTransientJupemError(error)) throw error;
      error.code = error.code || "AZOBSS_JUPEM_LOT_REGISTRATION_PENDING";
      error.jobStatus = jobStatus;
      throw error;
    }

    // Keep a newly created cart row temporarily. Removing it immediately can make the
    // public direct URL return JUPEM's HTML Error page before the user's browser opens it.
    azobssScheduleRegisteredLotCleanup(registration, cacheKey);

    let lastProbe = null;
    for (const delayMs of [0, 1200, 3000]) {
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      try {
        lastProbe = await azobssProbeJupemLotDirectZip(directUrl, 12000);
        if (lastProbe.ready) {
          return { ready: true, directUrl, jobStatus, registered: true, probe: lastProbe };
        }
      } catch (error) {
        lastProbe = { ready: false, error: String(error && error.message || error) };
      }
    }

    const pendingError = new Error("JUPEM masih menyelaraskan fail ZIP Lot Kadaster. Sila tunggu sebentar.");
    pendingError.code = "AZOBSS_JUPEM_LOT_DIRECT_NOT_READY";
    pendingError.jobStatus = jobStatus;
    pendingError.probe = lastProbe;
    throw pendingError;
  })();

  azobssLotDirectReadyCache.set(cacheKey, { promise });
  try {
    const result = await promise;
    azobssLotDirectReadyCache.set(cacheKey, {
      ready: true,
      result,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    return result;
  } catch (error) {
    azobssLotDirectReadyCache.delete(cacheKey);
    throw error;
  }
}

function azobssCreateLotSelectionToken(payload) {
  const body = Buffer.from(JSON.stringify(payload || {}), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", azSecureDownloadSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

const AZOBSS_LOT_SELECTION_CHECKOUT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function azobssDecodeSignedLotSelectionToken(value) {
  try {
    const [body, signature] = String(value || "").split(".");
    if (!body || !signature) return null;
    const expected = crypto.createHmac("sha256", azSecureDownloadSecret()).update(body).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch (_err) {
    return null;
  }
}

function azobssDecodeLotSelectionToken(value) {
  const payload = azobssDecodeSignedLotSelectionToken(value);
  if (!payload || Number(payload.expiresAtMs || 0) < Date.now()) return null;
  return payload;
}

function azobssVerifyLotSelectionToken(value) {
  try {
    const payload = azobssDecodeLotSelectionToken(value);
    if (!payload || payload.ready !== true) return null;
    return payload;
  } catch (_error) {
    return null;
  }
}

function azobssVerifiedLotCheckout(rawItem, productType, negeri, itemCode) {
  const payload = azobssDecodeSignedLotSelectionToken(rawItem && rawItem.selectionToken);
  if (!payload || payload.ready !== true) return null;
  const preparedAtMs = Number(payload.preparedAtMs || 0);
  if (!preparedAtMs || Date.now() - preparedAtMs > AZOBSS_LOT_SELECTION_CHECKOUT_TTL_MS) return null;
  const expectedType = String(productType || "").toUpperCase();
  const expectedState = String(negeri || "").toUpperCase();
  const expectedCode = String(itemCode || "").toUpperCase();
  if (String(payload.productType || "").toUpperCase() !== expectedType) return null;
  if (String(payload.negeri || "").toUpperCase() !== expectedState) return null;
  if (String(payload.jobId || "").toUpperCase() !== expectedCode) return null;
  const variant = String(payload.variant || "").toUpperCase();
  const pricing = azobssLotPricingForRatio(payload.areaRatio);
  // Always recalculate the trusted price from the signed area ratio. This also migrates
  // valid pre-565 selection tokens that stored a decimal amount such as RM34.16.
  if (!pricing || variant !== pricing.variant) return null;
  const downloadUrl = azobssSafeJupemDownloadUrl(payload.downloadUrl, expectedType);
  if (!downloadUrl) return null;
  return { ...payload, variant: pricing.variant, amount: pricing.amount, downloadUrl };
}

async function azobssGetJupemMapAuth(force = false) {
  const now = Date.now();
  if (!force && azobssJupemMapAuthCache.token && azobssJupemMapAuthCache.cookie && azobssJupemMapAuthCache.expiresAt > now) {
    return azobssJupemMapAuthCache;
  }
  if (!force && azobssJupemMapAuthPending) return azobssJupemMapAuthPending;

  azobssJupemMapAuthPending = (async () => {
    const mapUrl = "https://ebiz.jupem.gov.my/PetaInteraktif?no=1&type=bm&c=pt";
    const pageResponse = await fetch(mapUrl, azJupemFetchOptions({
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: azobssJupemBaseHeaders({
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://ebiz.jupem.gov.my/"
      })
    }));
    if (!pageResponse.ok) throw new Error(`JUPEM map session returned HTTP ${pageResponse.status}`);

    const cookie = azobssExtractCookieHeader(pageResponse.headers);
    const html = await pageResponse.text();
    const csrfMatch = html.match(/<input[^>]+name=["']__RequestVerificationToken["'][^>]+value=["']([^"']+)["']/i);
    if (!cookie || !csrfMatch || !csrfMatch[1]) throw new Error("JUPEM map session token is unavailable");

    const csrf = decodeHtmlEntities(csrfMatch[1]);
    const body = new URLSearchParams({ __RequestVerificationToken: csrf });
    const tokenResponse = await fetch("https://ebiz.jupem.gov.my/PetaInteraktif/GetArcGISToken", azJupemFetchOptions({
      method: "POST",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: azobssJupemBaseHeaders({
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookie,
        "Referer": mapUrl,
        "X-CSRF-TOKEN": csrf,
        "X-Requested-With": "XMLHttpRequest"
      }),
      body: body.toString()
    }));
    if (!tokenResponse.ok) throw new Error(`JUPEM map token returned HTTP ${tokenResponse.status}`);

    const payload = await tokenResponse.json();
    if (!payload || !payload.success || !payload.token) throw new Error("JUPEM ArcGIS token is unavailable");
    const expiresInSeconds = Math.max(60, Number(payload.expiresIn) || 600);
    azobssJupemMapAuthCache = {
      token: String(payload.token),
      cookie,
      expiresAt: Date.now() + Math.max(60 * 1000, (expiresInSeconds * 1000) - 60 * 1000)
    };
    return azobssJupemMapAuthCache;
  })();

  try {
    return await azobssJupemMapAuthPending;
  } finally {
    azobssJupemMapAuthPending = null;
  }
}

function azobssDmsToDecimal(degrees, minutes, seconds) {
  const d = Number(degrees);
  const m = Number(minutes);
  const s = Number(seconds);
  if (![d, m, s].every(Number.isFinite)) return NaN;
  const sign = d < 0 ? -1 : 1;
  return sign * (Math.abs(d) + (Math.abs(m) / 60) + (Math.abs(s) / 3600));
}

async function azobssResolveJupemPointCoordinates(productId, pointType, forceAuth = false) {
  const id = String(productId || "").replace(/\D/g, "").slice(0, 20);
  const normalizedType = ["bm", "bmpiawai", "gps"].includes(String(pointType || "").toLowerCase())
    ? String(pointType).toLowerCase()
    : "bm";
  if (!id) throw new Error("A valid JUPEM product ID is required");

  const cacheKey = `${normalizedType}|${id}`;
  const cached = azobssJupemPointLocationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const auth = await azobssGetJupemMapAuth(forceAuth);
  const layer = normalizedType === "gps" ? "0" : (normalizedType === "bmpiawai" ? "2" : "1");
  const queryUrl = new URL(`https://ebiz.jupem.gov.my/arcgis/rest/services/Geodetik/Produk_Geodetik/MapServer/${layer}/query`);
  queryUrl.search = new URLSearchParams({
    where: `IdStn=${id}`,
    outFields: "*",
    returnGeometry: "true",
    f: "json",
    token: auth.token
  }).toString();

  const queryResponse = await fetch(queryUrl, azJupemFetchOptions({
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: azobssJupemBaseHeaders({
      "Accept": "application/json,*/*",
      "Cookie": auth.cookie,
      "Referer": `https://ebiz.jupem.gov.my/PetaInteraktif?no=${encodeURIComponent(id)}&type=${encodeURIComponent(normalizedType)}&c=pt`
    })
  }));
  if (!queryResponse.ok) throw new Error(`JUPEM coordinate query returned HTTP ${queryResponse.status}`);

  const payload = await queryResponse.json();
  if (payload && payload.error && !forceAuth && [498, 499].includes(Number(payload.error.code))) {
    azobssJupemMapAuthCache = { token: "", cookie: "", expiresAt: 0 };
    return azobssResolveJupemPointCoordinates(id, normalizedType, true);
  }
  const feature = payload && Array.isArray(payload.features) ? payload.features[0] : null;
  if (!feature) throw new Error("JUPEM station coordinates were not found");

  const attributes = feature.attributes || {};
  let latitude = azobssDmsToDecimal(attributes.WGS_LatD, attributes.WGS_LatM, attributes.WGS_LatS);
  let longitude = azobssDmsToDecimal(attributes.WGS_LonD, attributes.WGS_LonM, attributes.WGS_LonS);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    latitude = Number(feature.geometry && feature.geometry.y);
    longitude = Number(feature.geometry && feature.geometry.x);
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("JUPEM station coordinates are invalid");

  const value = {
    latitude,
    longitude,
    stationNo: String(attributes.NoStn || "").trim(),
    negeri: String(attributes.Negeri || "").trim(),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude.toFixed(7)},${longitude.toFixed(7)}`)}`
  };
  if (azobssJupemPointLocationCache.size > 5000) azobssJupemPointLocationCache.clear();
  azobssJupemPointLocationCache.set(cacheKey, { value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return value;
}

function azobssResolveBenchmarkCoordinates(productId, jenis, forceAuth = false) {
  const pointType = String(jenis || "1") === "2" ? "bmpiawai" : "bm";
  return azobssResolveJupemPointCoordinates(productId, pointType, forceAuth);
}

// =========================
// PA/BM JUPEM DOWNLOAD RESOLVER
// Fixes false "PA/BM not found" during paid download by:
// 1) avoiding backend self-fetch loops,
// 2) rebuilding BM/SBM URL from local stesen JSON,
// 3) trying PA variants with and without spacing.
// =========================

let azobssStesenRecordsCache = null;
let azobssStesenRecordsMtime = 0;

function azobssReadStesenRecords() {
  const fp = path.join(__dirname, "stesen-tanda-aras-records.json");
  try {
    const st = fs.existsSync(fp) ? fs.statSync(fp) : null;
    if (!st) return [];
    if (azobssStesenRecordsCache && azobssStesenRecordsMtime === st.mtimeMs) return azobssStesenRecordsCache;
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    azobssStesenRecordsCache = Array.isArray(parsed) ? parsed : [];
    azobssStesenRecordsMtime = st.mtimeMs;
    return azobssStesenRecordsCache;
  } catch (err) {
    console.warn("AZOBSS stesen records read failed:", err && (err.message || err));
    return azobssStesenRecordsCache || [];
  }
}

function azobssUnique(values) {
  const out = [];
  const seen = new Set();
  (values || []).forEach((value) => {
    const v = String(value || "").trim();
    if (!v) return;
    const key = v.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(v);
  });
  return out;
}

function azobssStationKey(value) {
  // Paid purchase rows sometimes store benchmark items as "BM H 0109" / "SBM 201064",
  // while the local JUPEM database stores only the station code "H 0109" / "201064".
  // If we compare them raw, the backend cannot rebuild the JUPEM productId and the
  // user gets a false "BM/SBM not found" after payment. Normalize product prefixes here.
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/^STESEN\s+TANDA\s+ARAS[\s:_-]*/i, "")
    .replace(/^TANDA\s+ARAS[\s:_-]*/i, "")
    .replace(/^(BM|SBM)[\s:_-]+/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

function azobssStationKeyVariants(value) {
  const raw = String(value || "").trim().toUpperCase();
  const variants = [raw];
  variants.push(raw.replace(/^(BM|SBM)(?=[A-Z0-9])/i, ""));
  variants.push(raw.replace(/^(BM|SBM)[\s:_-]+/i, ""));
  return azobssUnique(variants.map(azobssStationKey).filter(Boolean));
}

function azobssDirectBmUrl(productId, jenis) {
  const pid = String(productId || "").replace(/[^0-9]/g, "");
  if (!pid) return "";
  const j = String(jenis || "1").trim() === "2" ? "2" : "1";
  return `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenTandaAras/${encodeURIComponent(pid)}?jenis=${encodeURIComponent(j)}`;
}

function azobssExtractBmUrlInfo(rawUrl) {
  const info = { productId: "", jenis: "" };
  const value = String(rawUrl || "").trim();
  if (!value) return info;
  try {
    const u = new URL(value, "https://azobss.com");
    info.productId = String(u.searchParams.get("productId") || u.searchParams.get("id") || "").replace(/[^0-9]/g, "");
    info.jenis = String(u.searchParams.get("jenis") || "").trim();
    const pathMatch = u.pathname.match(/MuatTurunStesenTandaAras\/(\d+)/i);
    if (!info.productId && pathMatch) info.productId = pathMatch[1];
  } catch (_err) {}
  return info;
}

function azobssFindStesenRecordForPurchase(record) {
  const rows = azobssReadStesenRecords();
  if (!rows.length) return null;

  const urls = [record && record.downloadUrl, record && record.url].filter(Boolean);
  const urlInfo = urls.map(azobssExtractBmUrlInfo).find(x => x && x.productId) || {};
  const wantedProductId = String((record && (record.productId || record.id)) || urlInfo.productId || "").replace(/[^0-9]/g, "");
  const wantedJenis = String((record && record.jenis) || urlInfo.jenis || ((String(record && (record.productType || record.product) || "").toUpperCase() === "SBM") ? "2" : "1")).trim() === "2" ? "2" : "1";
  const wantedStationValues = azobssUnique([
    record && record.itemCode,
    record && record.stationNo,
    record && record.stesen,
    record && record.code
  ]);
  const wantedStationKeys = azobssUnique(wantedStationValues.flatMap(azobssStationKeyVariants));
  const wantedStation = wantedStationKeys[0] || "";
  const wantedState = String(record && (record.negeri || record.state) || "").trim().toUpperCase();

  if (wantedProductId) {
    const exact = rows.find(r => String(r.productId || r.id || "").replace(/[^0-9]/g, "") === wantedProductId && String(r.jenis || wantedJenis) === wantedJenis);
    if (exact) return exact;
  }

  if (wantedStationKeys.length) {
    return rows.find((r) => {
      const rowKeys = azobssStationKeyVariants(r.stesen || r.stationNo || r.itemCode || r.code);
      const stationOk = rowKeys.some((key) => wantedStationKeys.includes(key));
      const stateOk = !wantedState || String(r.negeri || r.state || "").trim().toUpperCase() === wantedState;
      const jenisOk = !wantedJenis || String(r.jenis || wantedJenis) === wantedJenis;
      return stationOk && stateOk && jenisOk;
    }) || null;
  }

  return null;
}

function azobssLooksHtmlOrJsonError(buffer) {
  const firstText = Buffer.from(buffer || Buffer.alloc(0)).slice(0, 240).toString("utf8").trim().toLowerCase();
  return !buffer || !buffer.length ||
    firstText.includes("<html") ||
    firstText.includes("<!doctype") ||
    firstText.includes("not found") ||
    firstText.includes("tiada dalam simpanan") ||
    firstText.includes("object moved") ||
    (firstText.startsWith("{") && (firstText.includes('"ok":false') || firstText.includes('"error"')));
}

function azobssHeaderGet(headersObj, name) {
  const wanted = String(name || "").toLowerCase();
  const found = (headersObj || []).find(([key]) => String(key || "").toLowerCase() === wanted);
  return found ? String(found[1] || "") : "";
}

async function azobssCurlFetchFile(candidate, cookie) {
  const childProcess = require("child_process");
  const headerFile = path.join(TEMP_DIR, "azobss-jupem-h-" + crypto.randomBytes(8).toString("hex") + ".txt");
  const bodyFile = path.join(TEMP_DIR, "azobss-jupem-b-" + crypto.randomBytes(8).toString("hex") + ".bin");
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const args = [
    "-sS", "-L", "--insecure", "--compressed", "--max-time", "28",
    "-D", headerFile, "-o", bodyFile,
    "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "-H", "Accept: application/zip,application/x-zip-compressed,application/pdf,image/tiff,image/*,application/octet-stream,*/*",
    "-H", "Accept-Language: ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
    "-H", "Referer: https://ebiz.jupem.gov.my/"
  ];
  if (cookie) args.push("--cookie", cookie);
  args.push(candidate);

  try {
    await new Promise((resolve, reject) => {
      childProcess.execFile("curl", args, { timeout: 35000, maxBuffer: 1024 * 1024 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });

    const headerText = fs.existsSync(headerFile) ? fs.readFileSync(headerFile, "utf8") : "";
    const buffer = fs.existsSync(bodyFile) ? fs.readFileSync(bodyFile) : Buffer.alloc(0);
    const headerBlocks = headerText.split(/\r?\n\r?\n/).filter(Boolean);
    const lastBlock = headerBlocks[headerBlocks.length - 1] || "";
    const statusMatch = lastBlock.match(/HTTP\/\S+\s+(\d+)/i);
    const status = statusMatch ? Number(statusMatch[1]) : (buffer.length ? 200 : 0);
    const headerPairs = lastBlock.split(/\r?\n/).slice(1).map(line => {
      const idx = line.indexOf(":");
      return idx > 0 ? [line.slice(0, idx).trim(), line.slice(idx + 1).trim()] : null;
    }).filter(Boolean);
    const contentType = azobssHeaderGet(headerPairs, "content-type") || "application/octet-stream";
    const response = {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (key) => azobssHeaderGet(headerPairs, key) }
    };
    const firstText = buffer.slice(0, 240).toString("utf8").toLowerCase();
    const validFile = !!(response.ok && buffer.length > 80 && !azobssLooksHtmlOrJsonError(buffer));
    return { response, buffer, url: candidate, firstText, contentType, validFile, mode: cookie ? "curl-session" : "curl" };
  } finally {
    try { if (fs.existsSync(headerFile)) fs.unlinkSync(headerFile); } catch (_e) {}
    try { if (fs.existsSync(bodyFile)) fs.unlinkSync(bodyFile); } catch (_e) {}
  }
}

async function azobssFetchValidFileCandidates(candidates, label) {
  let lastResult = null;

  async function tryCandidate(candidate, mode) {
    if (mode === "curl" || mode === "curl-session") {
      const cookie = mode === "curl-session" ? await azobssGetJupemSessionCookie(false) : "";
      return await azobssCurlFetchFile(candidate, cookie);
    }
    const response = mode === "session" ? await fetchJupemWithSession(candidate) : await fetchJupem(candidate);
    const buffer = Buffer.from(await response.arrayBuffer());
    const firstText = buffer.slice(0, 240).toString("utf8").toLowerCase();
    const contentType = response.headers && response.headers.get ? String(response.headers.get("content-type") || "") : "";
    const validFile = !!(response && response.ok && buffer.length > 80 && !azobssLooksHtmlOrJsonError(buffer));
    return { response, buffer, url: candidate, firstText, contentType, validFile, mode };
  }

  for (const candidate of azobssUnique(candidates)) {
    for (const mode of ["direct", "session", "curl", "curl-session"]) {
      try {
        lastResult = await tryCandidate(candidate, mode);
        if (lastResult.validFile) return lastResult;
        console.warn("AZOBSS paid download candidate invalid:", JSON.stringify({ label, mode, status: lastResult.response && lastResult.response.status, type: lastResult.contentType, url: candidate, head: String(lastResult.firstText || "").slice(0, 80) }).slice(0, 650));
      } catch (err) {
        console.warn("AZOBSS paid download candidate failed:", label, mode, candidate, err && (err.message || err));
        lastResult = { response: null, buffer: Buffer.alloc(0), url: candidate, firstText: "", validFile: false, error: err, mode };
      }
    }
  }
  return lastResult || { response: null, buffer: Buffer.alloc(0), url: "", firstText: "", validFile: false };
}

function azobssBufferIsPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.slice(0, 5).toString("ascii") === "%PDF-";
}

function azobssBufferIsTiff(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  return (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00)
    || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a);
}

function azobssBufferIsPng(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 8
    && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function azobssBufferIsJpeg(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 3
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function azobssBufferIsZip(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b
    && ((buffer[2] === 0x03 && buffer[3] === 0x04)
      || (buffer[2] === 0x05 && buffer[3] === 0x06)
      || (buffer[2] === 0x07 && buffer[3] === 0x08));
}

function azobssLotCacheKey(productCode, stateCode, jobId) {
  return crypto.createHash("sha256")
    .update(`${cleanLotProduct(productCode)}|${cleanLotStateCode(stateCode)}|${String(jobId || "").trim()}`)
    .digest("hex");
}

function azobssLotCachePath(productCode, stateCode, jobId) {
  return path.join(AZOBSS_LOT_CACHE_DIR, `${azobssLotCacheKey(productCode, stateCode, jobId)}.zip`);
}

function azobssReadLotCachedZip(productCode, stateCode, jobId) {
  try {
    const cachePath = azobssLotCachePath(productCode, stateCode, jobId);
    if (!fs.existsSync(cachePath)) return null;
    const buffer = fs.readFileSync(cachePath);
    if (!azobssBufferIsZip(buffer)) {
      try { fs.unlinkSync(cachePath); } catch (_) {}
      return null;
    }
    return buffer;
  } catch (error) {
    console.warn("Lot ZIP cache read failed:", error && (error.message || error));
    return null;
  }
}

function azobssWriteLotCachedZip(productCode, stateCode, jobId, buffer) {
  if (!azobssBufferIsZip(buffer)) throw new Error("JUPEM did not return a valid ZIP file.");
  fs.mkdirSync(AZOBSS_LOT_CACHE_DIR, { recursive: true });
  const cachePath = azobssLotCachePath(productCode, stateCode, jobId);
  const temporaryPath = `${cachePath}.${process.pid}.${crypto.randomBytes(5).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, buffer);
    fs.renameSync(temporaryPath, cachePath);
  } finally {
    try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_) {}
  }
  return cachePath;
}

async function azobssEnsureLotCachedZip(record, type, sessionCookie = "") {
  const productCode = type === "NDCDB_C3" ? "2" : "1";
  const jobId = azobssLotRecordJobId(record);
  const stateCode = cleanLotStateCode(record && (record.negeri || record.state) || "");
  if (!jobId || !stateCode) return null;

  const cached = azobssReadLotCachedZip(productCode, stateCode, jobId);
  if (cached) return cached;

  const cacheKey = azobssLotCacheKey(productCode, stateCode, jobId);
  if (azobssLotCachePending.has(cacheKey)) return await azobssLotCachePending.get(cacheKey);

  const pending = (async () => {
    const result = await azobssFetchLotRecordFile(record, type, sessionCookie);
    if (!result || !result.validFile || !azobssBufferIsZip(result.buffer)) return null;
    azobssWriteLotCachedZip(productCode, stateCode, jobId, result.buffer);
    return result.buffer;
  })();
  azobssLotCachePending.set(cacheKey, pending);
  try {
    return await pending;
  } finally {
    azobssLotCachePending.delete(cacheKey);
  }
}

async function azobssWaitForLotJobAndCache(record, type) {
  const productCode = type === "NDCDB_C3" ? "2" : "1";
  const jobId = azobssLotRecordJobId(record);
  const stateCode = cleanLotStateCode(record && (record.negeri || record.state) || "");
  let lastError = null;

  if (!jobId || !stateCode) {
    throw new Error("Maklumat ID atau negeri Lot Kadaster tidak lengkap.");
  }

  return await azobssWithRegisteredJupemLot(productCode, stateCode, jobId, async (sessionCookie) => {
    const deadline = Date.now() + (4 * 60 * 1000);
    while (Date.now() < deadline) {
      const cached = azobssReadLotCachedZip(productCode, stateCode, jobId);
      if (cached) return cached;

      try {
        const buffer = await azobssEnsureLotCachedZip(record, type, sessionCookie);
        if (buffer && azobssBufferIsZip(buffer)) return buffer;
        lastError = new Error("Pautan ID pilihan belum memulangkan fail ZIP.");
      } catch (error) {
        lastError = error;
      }

      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    throw lastError || new Error("Backend AZOBSS tidak sempat menyediakan fail ZIP dalam tempoh yang ditetapkan.");
  });
}

function azobssStartLotCacheTask(record, type) {
  const productCode = type === "NDCDB_C3" ? "2" : "1";
  const jobId = azobssLotRecordJobId(record);
  const stateCode = cleanLotStateCode(record && (record.negeri || record.state) || "");
  if (!jobId || !stateCode) return { status: "failed", attempts: 3, error: "Maklumat fail Lot Kadaster tidak lengkap." };

  if (azobssReadLotCachedZip(productCode, stateCode, jobId)) {
    return { status: "ready", attempts: 1 };
  }

  const cacheKey = azobssLotCacheKey(productCode, stateCode, jobId);
  let current = azobssLotCacheTasks.get(cacheKey) || null;
  if (current && current.status === "downloading") return current;
  if (current && current.status === "failed" && Number(current.nextRetryAt || 0) > Date.now()) return current;
  if (current && current.status === "failed" && current.attempts >= 6) return current;
  if (current && current.status === "ready") current = null;

  const task = {
    status: "downloading",
    attempts: Number(current && current.attempts || 0) + 1,
    startedAt: Number(current && current.startedAt || 0) || Date.now(),
    attemptStartedAt: Date.now(),
    error: ""
  };
  azobssLotCacheTasks.set(cacheKey, task);

  Promise.resolve()
    .then(() => azobssWaitForLotJobAndCache(record, type))
    .then((buffer) => {
      if (buffer && azobssBufferIsZip(buffer)) {
        azobssLotCacheTasks.set(cacheKey, { ...task, status: "ready", completedAt: Date.now() });
        return;
      }
      azobssLotCacheTasks.set(cacheKey, {
        ...task,
        status: "failed",
        error: "Backend AZOBSS belum selesai menyediakan fail ZIP.",
        nextRetryAt: Date.now() + 15000
      });
    })
    .catch((error) => {
      console.warn("Background Lot ZIP cache failed:", error && (error.stack || error.message || error));
      azobssLotCacheTasks.set(cacheKey, {
        ...task,
        status: "failed",
        error: azobssIsTransientJupemError(error) ? "Sambungan sumber data terputus sementara." : String(error && error.message || "Backend AZOBSS belum selesai menyediakan fail ZIP."),
        nextRetryAt: Date.now() + 15000
      });
    });

  return task;
}

function cleanupLotCacheFiles() {
  try {
    if (!fs.existsSync(AZOBSS_LOT_CACHE_DIR)) return;
    const now = Date.now();
    for (const file of fs.readdirSync(AZOBSS_LOT_CACHE_DIR)) {
      const fullPath = path.join(AZOBSS_LOT_CACHE_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && now - stat.mtimeMs > AZOBSS_LOT_CACHE_TTL_MS) fs.unlinkSync(fullPath);
      } catch (error) {
        console.warn("Lot ZIP cache cleanup failed:", file, error && (error.message || error));
      }
    }
  } catch (error) {
    console.warn("Lot ZIP cache directory cleanup failed:", error && (error.message || error));
  }
}

function azobssBufferIsConvertibleImage(buffer) {
  return azobssBufferIsTiff(buffer) || azobssBufferIsPng(buffer) || azobssBufferIsJpeg(buffer);
}

const azobssPaidIndexCache = new Map();
function azobssReadPaidIndex(filename) {
  if (azobssPaidIndexCache.has(filename)) return azobssPaidIndexCache.get(filename);
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, filename), "utf8"));
    const safeRows = Array.isArray(rows) ? rows : [];
    azobssPaidIndexCache.set(filename, safeRows);
    return safeRows;
  } catch (error) {
    console.warn("AZOBSS paid index could not be read:", filename, error && (error.message || error));
    return [];
  }
}

function azobssFindGpsRecordForPurchase(record) {
  const code = String(record && (record.stationNo || record.itemCode || record.code) || "").trim().toUpperCase();
  const productId = String(record && (record.productId || record.id) || "").trim();
  const state = String(record && (record.negeri || record.state) || "").trim().toUpperCase();
  return azobssReadPaidIndex("stesen-gps-records.json").find((row) => {
    const codeOk = code && String(row.stationNo || row.itemCode || "").trim().toUpperCase() === code;
    const idOk = productId && String(row.productId || row.id || "").trim() === productId;
    const stateOk = !state || String(row.negeri || row.state || "").trim().toUpperCase() === state;
    return stateOk && (codeOk || idOk);
  }) || null;
}

function azobssBuildGpsDownloadCandidates(record) {
  const local = azobssFindGpsRecordForPurchase(record) || {};
  const code = String(record && (record.stationNo || record.itemCode || record.code) || local.stationNo || "").trim().toUpperCase();
  return azobssUnique([
    azobssSafeJupemDownloadUrl(record && (record.downloadUrl || record.url), "GPS"),
    azobssSafeJupemDownloadUrl(local.downloadUrl || local.url, "GPS"),
    code ? `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenGPS/${encodeURIComponent(code)}` : ""
  ]);
}

async function azobssFetchGpsRecordFile(record) {
  return await azobssFetchValidFileCandidates(azobssBuildGpsDownloadCandidates(record), "GPS");
}

function azobssFindSyitRecordForPurchase(record) {
  const sheetName = String(record && (record.itemCode || record.sheetName || record.code) || "").trim().toUpperCase();
  const productId = String(record && (record.productId || record.id) || "").trim();
  const state = String(record && (record.negeri || record.state) || "").trim().toUpperCase();
  return azobssReadPaidIndex("lembar-piawai-records.json").find((row) => {
    const nameOk = sheetName && String(row.sheetName || row.itemCode || "").trim().toUpperCase() === sheetName;
    const idOk = productId && String(row.productId || row.id || "").trim() === productId;
    const stateOk = !state || String(row.negeri || row.state || "").trim().toUpperCase() === state;
    return stateOk && (nameOk || idOk);
  }) || null;
}

function azobssBuildSyitDownloadCandidates(record) {
  const local = azobssFindSyitRecordForPurchase(record) || {};
  const productId = String(record && (record.productId || record.id) || local.productId || local.id || "").trim();
  const sheetName = String(record && (record.itemCode || record.sheetName || record.code) || local.sheetName || "").trim().toUpperCase();
  const negeri = String(record && (record.negeri || record.state) || local.negeri || "").trim().toUpperCase();
  const direct = productId && sheetName && negeri
    ? `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunLembarPiawai/${encodeURIComponent(productId)}?piawai=${encodeURIComponent(sheetName + "_20200904")}&negeri=${encodeURIComponent(negeri)}`
    : "";
  return azobssUnique([
    azobssSafeJupemDownloadUrl(record && (record.downloadUrl || record.url), "SYIT_PIAWAI"),
    direct
  ]);
}

async function azobssFetchSyitRecordFile(record) {
  return await azobssFetchValidFileCandidates(azobssBuildSyitDownloadCandidates(record), "Syit Piawai");
}

function azobssBuildLotDownloadCandidates(record, type) {
  const rawUrls = azobssUnique([
    record && record.downloadUrl,
    record && record.url
  ]);
  let urlJobId = "";
  for (const rawUrl of rawUrls) {
    try {
      const url = new URL(String(rawUrl || ""));
      const match = url.pathname.match(/\/MuatTurunLotKadasterBerdigitCrop(?:c3)?\/([^/?#]+)/i);
      if (match && match[1]) {
        urlJobId = decodeURIComponent(match[1]);
        break;
      }
    } catch (_) {}
  }
  const jobId = String(urlJobId || record && (record.productId || record.jobId || record.itemCode || record.code) || "").trim();
  const stateCode = cleanLotStateCode(record && (record.negeri || record.state) || "");
  const productCode = type === "NDCDB_C3" ? "2" : "1";
  const generatedUrl = jobId && stateCode ? azobssLotDownloadUrl(productCode, jobId, stateCode) : "";
  return azobssUnique([
    ...rawUrls.map((rawUrl) => azobssSafeJupemDownloadUrl(rawUrl, type)),
    azobssSafeJupemDownloadUrl(generatedUrl, type)
  ]);
}

function azobssLotRecordJobId(record) {
  const candidates = azobssBuildLotDownloadCandidates(record, azobssPaBmRecordType(record));
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const match = url.pathname.match(/\/MuatTurunLotKadasterBerdigitCrop(?:c3)?\/([^/?#]+)/i);
      if (match && match[1]) return decodeURIComponent(match[1]);
    } catch (_) {}
  }
  return String(record && (record.productId || record.jobId || record.itemCode || record.code) || "").trim();
}

async function azobssFetchLotRecordFile(record, type, sessionCookie = "") {
  const candidates = azobssBuildLotDownloadCandidates(record, type);
  let lastResult = null;
  const retryDelays = [0, 1200, 3000];
  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt]) {
      await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
    }
    const session = sessionCookie
      ? { cookie: sessionCookie }
      : await azobssGetJupemAuthenticatedSession(attempt > 0);
    for (const candidate of candidates) {
      lastResult = await azobssCurlFetchFile(candidate, session.cookie);
      if (lastResult.validFile && azobssBufferIsZip(lastResult.buffer)) return lastResult;
      console.warn("AZOBSS Lot direct download invalid:", JSON.stringify({
        attempt: attempt + 1,
        status: lastResult.response && lastResult.response.status,
        contentType: lastResult.contentType,
        bytes: lastResult.buffer && lastResult.buffer.length || 0,
        url: candidate,
        head: String(lastResult.firstText || "").replace(/\s+/g, " ").slice(0, 140)
      }).slice(0, 850));
    }
    if (!sessionCookie) azobssJupemAuthenticatedCache = { cookie: "", userId: "", expiresAt: 0 };
  }
  return lastResult || { response: null, buffer: Buffer.alloc(0), url: "", firstText: "", validFile: false };
}

function azobssBuildBmDownloadCandidates(record) {
  const local = azobssFindStesenRecordForPurchase(record) || {};
  const rawUrls = azobssUnique([
    record && record.downloadUrl,
    record && record.url,
    local.downloadUrl,
    local.url
  ]);
  const candidates = [];

  rawUrls.forEach((raw) => {
    const info = azobssExtractBmUrlInfo(raw);
    if (info.productId) candidates.push(azobssDirectBmUrl(info.productId, info.jenis || local.jenis || record.jenis));
    if (/^https?:\/\//i.test(String(raw || "")) && !/azobss-backend\.onrender\.com|www\.azobss\.com|azobss\.com/i.test(String(raw || ""))) {
      candidates.push(raw);
    }
  });

  const productIds = azobssUnique([
    record && record.productId,
    record && record.id,
    local.productId,
    local.id,
    (azobssExtractBmUrlInfo(record && record.downloadUrl) || {}).productId
  ]);
  productIds.forEach((pid) => candidates.push(azobssDirectBmUrl(pid, record && record.jenis || local.jenis)));

  return azobssUnique(candidates);
}

async function azobssFetchBenchmarkRecordFile(record) {
  const candidates = azobssBuildBmDownloadCandidates(record);
  return await azobssFetchValidFileCandidates(candidates, "BM/SBM");
}

function azobssExtractNoPaFromUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const u = new URL(value, "https://azobss.com");
    return String(u.searchParams.get("noPA") || u.searchParams.get("noPa") || u.searchParams.get("NoPA") || "").trim();
  } catch (_err) {
    return "";
  }
}

function azobssPaNameVariants(noPA) {
  const raw = String(noPA || "").trim().replace(/\.tif$/i, "").replace(/^PA/i, "").trim();
  const digits = raw.replace(/[^0-9]/g, "");
  const compactRaw = raw.replace(/\s+/g, "");
  const baseNoSpace = digits ? `PA${digits}` : (compactRaw ? `PA${compactRaw}` : "");
  const baseWithSpace = digits ? `PA ${digits}` : (raw ? `PA ${raw}` : "");
  return azobssUnique([
    baseNoSpace && `${baseNoSpace}.TIF`,
    baseNoSpace && `${baseNoSpace}.tif`,
    baseNoSpace,
    baseWithSpace && `${baseWithSpace}.TIF`,
    baseWithSpace && `${baseWithSpace}.tif`,
    baseWithSpace,
    raw && `PA${raw}.TIF`,
    raw && `PA${raw}.tif`
  ].filter(Boolean));
}

function azobssStateVariants(negeri) {
  const raw = String(negeri || "").trim();
  const upper = raw.toUpperCase();
  const title = upper ? upper.charAt(0) + upper.slice(1).toLowerCase() : "";
  return azobssUnique([upper, title, raw]);
}

function azobssBuildPaDownloadCandidates(noPA, negeri) {
  const paVariants = azobssPaNameVariants(noPA);
  const stateVariants = azobssStateVariants(negeri);
  const paramNames = ["noPa", "noPA", "NoPA"];
  const stateParamNames = ["negeri", "Negeri"];
  const candidates = [];

  paVariants.forEach((paName) => {
    stateVariants.forEach((stateName) => {
      paramNames.forEach((paParam) => {
        stateParamNames.forEach((stateParam) => {
          candidates.push(`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?${paParam}=${encodeURIComponent(paName)}&${stateParam}=${encodeURIComponent(stateName)}`);
        });
      });
    });
  });

  return azobssUnique(candidates);
}

async function fetchPelanAkuiCandidates(noPA, negeri) {
  return await azobssFetchValidFileCandidates(azobssBuildPaDownloadCandidates(noPA, negeri), "PA");
}

async function azobssFetchPaRecordFile(record, itemCode, negeri) {
  const inputs = azobssUnique([
    azobssExtractNoPaFromUrl(record && record.downloadUrl),
    azobssExtractNoPaFromUrl(record && record.url),
    record && record.noPA,
    record && record.noPa,
    record && record.pa,
    record && record.itemCode,
    itemCode && `PA${itemCode}.TIF`,
    itemCode && `PA ${itemCode}.TIF`
  ]);
  let last = null;
  for (const input of inputs) {
    last = await fetchPelanAkuiCandidates(input, negeri);
    if (last && last.validFile) return last;
  }
  return last || { response: null, buffer: Buffer.alloc(0), url: "", firstText: "", validFile: false };
}

function azobssDirectFallbackEnabled() {
  return String(process.env.AZOBSS_DISABLE_PABM_DIRECT_FALLBACK || "") !== "1";
}

// PA files from JUPEM are usually .TIF. AZOBSS PA paid downloads are expected to be
// converted to PDF by the backend first. Browser-direct fallback is useful for BM/SBM,
// but for PA it gives the user the raw .TIF and looks like the PDF converter failed.
// Keep PA raw-TIF fallback disabled by default; enable only for emergency/debug.
function azobssPaOriginalTifFallbackEnabled() {
  return String(process.env.AZOBSS_ALLOW_PA_TIF_FALLBACK || "") === "1";
}

function azobssFirstPaFallbackUrl(record, itemCode, negeri) {
  const inputs = azobssUnique([
    azobssExtractNoPaFromUrl(record && record.downloadUrl),
    azobssExtractNoPaFromUrl(record && record.url),
    record && record.noPA,
    record && record.noPa,
    record && record.pa,
    record && record.itemCode,
    itemCode && `PA${itemCode}.TIF`,
    itemCode && `PA ${itemCode}.TIF`
  ]);
  for (const input of inputs) {
    const list = azobssBuildPaDownloadCandidates(input, negeri);
    if (list && list[0]) return list[0];
  }
  return "";
}

function azobssFirstBmFallbackUrl(record) {
  const list = azobssBuildBmDownloadCandidates(record);
  return (list || []).find(u => /^https:\/\/ebiz\.jupem\.gov\.my\//i.test(String(u || ""))) || (list && list[0]) || "";
}

async function azobssReturnBrowserFallbackDownload(req, res, ref, record, nowMs, kind, openUrl, filename) {
  if (!azobssDirectFallbackEnabled() || !openUrl) return false;

  const upperKind = String(kind || "").toUpperCase();
  if (upperKind === "PA" && !azobssPaOriginalTifFallbackEnabled()) {
    // Do not open the original JUPEM .TIF for PA by default. Paid PA downloads must
    // come back as AZOBSS-converted PDF. Also do not consume the 5x quota here.
    return false;
  }

  try {
    await azobssIncrementPurchaseDownload(ref, record, nowMs);
  } catch (e) {
    console.error("Download counter update failed before browser fallback:", e && (e.stack || e.message || e));
  }

  const safeKind = String(kind || "File").replace(/[<>]/g, "");
  const safeFilename = String(filename || "download").replace(/[\r\n"<>]/g, "").trim() || "download";
  const safeHtmlFilename = "AZOBSS-Open-JUPEM-Download.html";
  const fallbackHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": `inline; filename="${safeHtmlFilename}"`,
    "Cache-Control": "no-store",
    "X-AZOBSS-Browser-Fallback": "1",
    "X-AZOBSS-Open-Url": encodeURIComponent(openUrl),
    "X-AZOBSS-Filename": encodeURIComponent(safeFilename),
    "Access-Control-Expose-Headers": "Content-Disposition, X-AZOBSS-Browser-Fallback, X-AZOBSS-Open-Url, X-AZOBSS-Filename"
  };

  // IMPORTANT:
  // Never return JSON for PA/BM JUPEM fallback on GET. Some Android browsers/download managers
  // treat the server response as a downloadable file and save it as .pdf.json. Returning an
  // HTML redirect page keeps both direct navigation and JS fetch fallback safe.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="1;url=${azHtmlEscape(openUrl)}">
<title>AZOBSS Open JUPEM Download</title>
<style>
body{margin:0;background:#07111f;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:18px;box-sizing:border-box}.card{width:min(560px,100%);border:1px solid rgba(34,197,94,.45);background:#111827;border-radius:18px;padding:22px;box-shadow:0 20px 45px rgba(0,0,0,.35)}h1{margin:0 0 10px;font-size:22px}.muted{color:#a9b4c7;line-height:1.45}.btn{display:inline-flex;margin-top:16px;padding:13px 18px;border-radius:11px;background:#16a34a;color:#fff;font-weight:900;text-decoration:none}.small{margin-top:14px;color:#8fa0b8;font-size:12px;word-break:break-word}.warn{color:#fbbf24;font-weight:800}</style>
</head>
<body>
<div class="card">
<h1>AZOBSS Download Ready ✅</h1>
<p class="muted">The AZOBSS proxy cannot fetch this ${azHtmlEscape(safeKind)} file from JUPEM right now, so this page will open the original JUPEM download link directly.</p>
<p class="warn">If nothing happens, tap the green button below.</p>
<a class="btn" id="openBtn" rel="noopener" href="${azHtmlEscape(openUrl)}">Open Original JUPEM Download</a>
<p class="small">File: ${azHtmlEscape(safeFilename)}</p>
<p class="small">This page is HTML, not the PDF/TIF file. Your browser should open the original JUPEM link after this page appears.</p>
</div>
<script>
(function(){
  var url = ${JSON.stringify(openUrl)};
  function go(){ try{ window.location.replace(url); }catch(e){ try{ window.location.href = url; }catch(_){} } }
  setTimeout(go, 450);
})();
</script>
</body>
</html>`;
  res.writeHead(200, azSecurityHeaders(fallbackHeaders));
  res.end(html);
  return true;
}


function normalizeAffiliateUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) return 'https://' + value;
  return value;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
}

function pickTitleFromHtml(html) {
  return decodeHtmlEntities(
    pickMeta(html, 'og:title') ||
    pickMeta(html, 'twitter:title') ||
    ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
  ).replace(/\s*\|\s*Shopee.*$/i, '').replace(/\s*-\s*Shopee.*$/i, '').trim();
}

function shortenDescription(text, fallbackTitle) {
  const clean = decodeHtmlEntities(text || '').replace(/\s+/g, ' ').trim();
  if (clean && !/^Shopee/i.test(clean)) return clean.slice(0, 260);
  return `${fallbackTitle || 'Produk ini'} sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.`;
}


function titleRule(title) {
  const t = String(title || '').toLowerCase();
  const has = (re) => re.test(t);

  if (has(/tefal|supercook|cookware|frypan|frying pan|wok|stewpot|soup pot|casserole|saucepan|pan\b|\bpot\b|spatula|ladle|knife|chopper|cutlery|kitchen|dapur|periuk|kuali|penggoreng|senduk|pinggan|mangkuk|bekas makanan|food container|lunch box|tupperware|thermos|flask/)) {
    return { category:'home-living', badge:'Kitchen Essentials', icon:'🍳', meta:'Best for cooking and daily kitchen use' };
  }
  if (has(/air fryer|rice cooker|pressure cooker|multi cooker|slow cooker|induction cooker|microwave|oven|toaster|blender|mixer|food processor|meat grinder|grinder|kettle|water dispenser|coffee maker|juicer|appliance|mesin basuh|washing machine|refrigerator|fridge|freezer|iron|steam iron/)) {
    return { category:'home-appliances', badge:'Home Appliance', icon:'🔌', meta:'Best for easier daily home use' };
  }
  if (has(/vacuum|cordless vacuum|handheld vacuum|cleaner|mop|spin mop|robot vacuum|penyapu|habuk|dust|lint remover|washer|cleaning|pembersih|detergent|sabun lantai|trash bin|tong sampah/)) {
    return { category:'home-living', badge:'Cleaning Gadget', icon:'🧹', meta:'Best for home and car cleaning' };
  }
  if (has(/ssd|nvme|m\.2|hard disk|hdd|ram|ddr4|ddr5|gpu|rtx|gtx|radeon|processor|cpu|motherboard|pc case|power supply|psu|monitor|keyboard|mouse|gaming mouse|printer|scanner|webcam|usb hub|type-c hub|laptop stand|thermal paste|cooling fan|cooler|speaker|headset|earphone|microphone|mic|capture card/)) {
    return { category:'computer', badge: has(/ssd|nvme|m\.2|storage/) ? 'Fast Storage' : 'Computer & Accessories', icon:'💻', meta: has(/ssd|nvme|m\.2/) ? 'Best for Windows and game loading' : 'Best for PC setup and daily use' };
  }
  if (has(/router|wifi|wi-fi|mesh|modem|lan cable|ethernet|network|5g router|4g router|repeater|extender|switch hub/)) {
    return { category:'computer', badge:'Networking', icon:'5G', meta:'Best for stronger home internet setup' };
  }
  if (has(/iphone|android|smartphone|phone|telefon|phone case|casing|screen protector|tempered glass|charger|fast charger|powerbank|power bank|usb c|type c|lightning cable|cable|adapter|magsafe|holder phone|phone holder|tripod phone/)) {
    return { category:'mobile', badge:'Daily Tech', icon:'📱', meta:'Useful mobile gadget for daily use' };
  }
  if (has(/dashcam|dash cam|car camera|car vacuum|car charger|jump starter|tyre|tire|tayar|automotive|kereta|motor|motorcycle|car mat|carpet car|seat cover|car holder|windshield|wiper|engine oil|minyak hitam|polish|wax|coating/)) {
    return { category:'automotive', badge:'Car Essential', icon:'🚗', meta:'Best for daily car use' };
  }
  if (has(/camera|dslr|mirrorless|action cam|gopro|drone|dji|cctv|ip camera|webcam|lens|tripod|gimbal|stabilizer|ring light|lighting/)) {
    return { category:'camera', badge:'Camera Gear', icon:'CAM', meta:'Best for photo, video and content setup' };
  }
  if (has(/ps5|ps4|xbox|nintendo|switch|console|controller|gamepad|gaming chair|gaming desk|game\b|games\b/)) {
    return { category:'gaming', badge:'Gaming Gear', icon:'🎮', meta:'Best for gaming setup' };
  }
  if (has(/watch|smartwatch|smart watch|jam tangan|casio|seiko|g-shock|gshock/)) return { category:'watches', badge:'Watch Pick', icon:'⌚', meta:'Daily watch and style item' };
  if (has(/handbag|tote bag|women bag|beg wanita|purse|sling bag wanita|shoulder bag/)) return { category:'womens-bags', badge:'Bag Pick', icon:'👜', meta:'Useful bag for daily carry' };
  if (has(/wallet|dompet|men bag|beg lelaki|sling bag lelaki|crossbody bag|card holder/)) return { category:'mens-bags', badge:'Daily Carry', icon:'👝', meta:'Best for wallet and daily carry' };
  if (has(/dress|blouse|skirt|women clothes|baju perempuan|kurung|kebaya|abaya|jubah wanita/)) return { category:'women-clothes', badge:'Women Fashion', icon:'👗', meta:'Popular fashion item' };
  if (has(/shirt|tshirt|t-shirt|polo|men clothes|baju lelaki|seluar lelaki|pants|jeans|shorts|hoodie|jacket/)) return { category:'men-clothes', badge:'Men Fashion', icon:'👕', meta:'Daily men fashion item' };
  if (has(/tudung|hijab|shawl|telekung|kopiah|sejadah|muslim|jubah|abaya/)) return { category:'muslim', badge:'Muslim Fashion', icon:'🧕', meta:'Useful Muslim fashion item' };
  if (has(/women shoe|heels|high heel|flat shoe|kasut wanita|sandal wanita/)) return { category:'women-shoes', badge:'Women Shoes', icon:'👠', meta:'Daily footwear pick' };
  if (has(/shoe|shoes|sneaker|kasut|sandal|slipper|boots/)) return { category:'men-shoes', badge:'Shoes Pick', icon:'👟', meta:'Daily footwear pick' };
  if (has(/beauty|skincare|skin care|makeup|serum|sunscreen|moisturizer|cleanser|lipstick|perfume|health|supplement|masker|facial|shampoo|hair dryer|trimmer|shaver/)) return { category:'health', badge:'Self Care', icon:'✨', meta:'Best for self care and daily routine' };
  if (has(/baby|kids|kid|toy|toys|mainan|stroller|milk bottle|botol susu|diaper|lampin|school bag|beg sekolah/)) return { category:'baby', badge:'Baby & Kids', icon:'🧸', meta:'Useful for baby and kids' };
  if (has(/food|coklat|chocolate|snack|biscuit|cookies|kopi|coffee|tea|grocery|groceries|minuman|makanan|instant noodle|pet food|cat food|dog food|kibble/)) return { category:'groceries', badge: has(/chocolate|coklat/) ? 'Chocolate' : 'Groceries', icon:'🍫', meta:'Best for snack, grocery or daily stock' };
  if (has(/gym|dumbbell|fitness|yoga|cycling|bicycle|sport|sports|outdoor|camping|camp|tent|hiking|fishing|badminton|football/)) return { category:'sports', badge:'Sports & Outdoor', icon:'🏕️', meta:'Best for workout and outdoor activity' };
  if (has(/book|books|novel|komik|comic|stationery|alat tulis|hobby|puzzle|lego|model kit/)) return { category:'books', badge:'Books & Hobby', icon:'📚', meta:'Best for reading and hobby' };
  if (has(/travel|luggage|bagasi|suitcase|passport holder|neck pillow|travel bag|organizer travel/)) return { category:'travel', badge:'Travel Essential', icon:'🧳', meta:'Best for travel and packing' };
  if (has(/ticket|voucher|coupon|topup|reload|gift card/)) return { category:'tickets', badge:'Voucher', icon:'🎟️', meta:'Ticket, voucher or digital item' };
  return { category:'others', badge:'Useful Item', icon:'🛒', meta:'Best for useful daily item' };
}

function titleToIcon(title) {
  return titleRule(title).icon;
}

function titleToCategory(title) {
  return titleRule(title).category;
}

function titleToBadge(title, category) {
  return titleRule(title).badge;
}

function titleToMeta(title, category) {
  return titleRule(title).meta;
}

function cleanShopeeTitle(title) {
  return decodeHtmlEntities(String(title || ''))
    .replace(/^Shopee\s+/i, '')
    .replace(/\s*\|\s*Shopee.*$/i, '')
    .replace(/\s*-\s*Shopee.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function extractShopeeIds(productUrl) {
  const u = String(productUrl || '');
  let m = u.match(/\/product\/(\d+)\/(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/-i\.(\d+)\.(\d+)/i) || u.match(/i\.(\d+)\.(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/[?&]itemid=(\d+).*?[?&]shopid=(\d+)/i);
  if (m) return { shopid: m[2], itemid: m[1] };
  return null;
}

function normalizeShopeeImage(img) {
  if (!img) return '';
  const v = Array.isArray(img) ? img[0] : img;
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://down-my.img.susercontent.com/file/${v}`;
}

function makeShopeeDescription(title, rawDesc) {
  const d = decodeHtmlEntities(rawDesc || '').replace(/\s+/g, ' ').trim();
  if (d && d.length > 20) return d.slice(0, 280);
  const t = title || 'Produk ini';
  return `${t} sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.`;
}

async function fetchJsonSafe(apiUrl, refererUrl) {
  try {
    const r = await fetch(apiUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8',
        'Referer': refererUrl || 'https://shopee.com.my/',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    const text = await r.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function unwrapShopeeItemJson(json) {
  if (!json) return null;
  // /api/v4/item/get usually: { data: { name, description, image, categories... } }
  if (json.data && (json.data.name || json.data.item)) return json.data.item || json.data;
  // /api/v4/pdp/get_pc variants
  if (json.data && json.data.item) return json.data.item;
  if (json.item) return json.item;
  if (json.name) return json;
  return null;
}

async function detectFromShopeeApi(finalUrl, ids) {
  if (!ids) return null;
  const { shopid, itemid } = ids;
  const apis = [
    `https://shopee.com.my/api/v4/item/get?itemid=${encodeURIComponent(itemid)}&shopid=${encodeURIComponent(shopid)}`,
    `https://shopee.com.my/api/v4/pdp/get_pc?shop_id=${encodeURIComponent(shopid)}&item_id=${encodeURIComponent(itemid)}`,
    `https://shopee.com.my/api/v2/item/get?itemid=${encodeURIComponent(itemid)}&shopid=${encodeURIComponent(shopid)}`
  ];

  for (const api of apis) {
    const json = await fetchJsonSafe(api, finalUrl);
    const item = unwrapShopeeItemJson(json);
    if (!item) continue;
    const title = cleanShopeeTitle(item.name || item.title || item.item_name || '');
    if (!title || /^product$/i.test(title)) continue;
    const description = makeShopeeDescription(title, item.description || item.desc || '');
    const categoryText = Array.isArray(item.categories)
      ? item.categories.map(c => c.display_name || c.name || '').filter(Boolean).join(' > ')
      : '';
    const image = normalizeShopeeImage(item.image || item.images || item.image_url);
    return { title, description, image, categoryText, source: 'shopee-api' };
  }
  return null;
}

async function detectFromJinaReader(finalUrl) {
  try {
    // r.jina.ai can convert public pages into readable text.  It is only a
    // fallback because Shopee sometimes returns a generic/captcha page.
    const cleanUrl = String(finalUrl || '').replace(/^https?:\/\//i, '');
    const readerUrls = [
      'https://r.jina.ai/http://' + cleanUrl,
      'https://r.jina.ai/http://http://' + cleanUrl.replace(/^http:\/\//i, ''),
      'https://r.jina.ai/http://https://' + cleanUrl.replace(/^https:\/\//i, '')
    ];

    for (const readerUrl of readerUrls) {
      const r = await fetch(readerUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 AZOBSS Product Detector',
          'Accept': 'text/plain,*/*'
        }
      });
      const text = await r.text();
      if (!text || text.trim().startsWith('<')) continue;

      const titleLine = (text.match(/^Title:\s*(.+)$/mi) || [])[1] || '';
      let title = cleanShopeeTitle(titleLine);

      if (!title || /Shopee Malaysia|Free Shipping Across Malaysia|Malaysia\s*\|\s*Free Shipping/i.test(title)) {
        const h1 = (text.match(/^#\s+(.+)$/mi) || [])[1] || '';
        title = cleanShopeeTitle(h1);
      }

      // Reject generic Shopee reader pages. Do not use these as product title.
      if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) continue;

      return {
        title,
        description: makeShopeeDescription(title, ''),
        image: '',
        categoryText: '',
        source: 'reader'
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function detectFromPlaywright(finalUrl) {
  let chromium;
  try {
    chromium = require('playwright-chromium').chromium;
  } catch (e) {
    try { chromium = require('playwright').chromium; } catch (e2) { return null; }
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-MY',
      timezoneId: 'Asia/Kuala_Lumpur',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-MY,en;q=0.9,ms-MY;q=0.8,ms;q=0.7',
        'Referer': 'https://shopee.com.my/'
      }
    });

    const page = await context.newPage();

    // Reduce heavy resources but keep scripts/styles because Shopee renders product data with JS.
    await page.route('**/*', route => {
      const type = route.request().resourceType();
      if (['font', 'media'].includes(type)) return route.abort().catch(() => {});
      return route.continue().catch(() => {});
    });

    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (e) {}
    try { await page.waitForSelector('meta[property="og:title"], h1, [data-sqe="name"], div[class*="product"]', { timeout: 15000 }); } catch (e) {}

    // Trigger lazy React rendering.
    await page.mouse.move(300, 300).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 650)).catch(() => {});
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const pickMeta = (name) => {
        const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
        return el ? (el.getAttribute('content') || '').trim() : '';
      };

      const txt = (el) => el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      const visibleText = (selector) => txt(document.querySelector(selector));

      const selectors = [
        'h1',
        '[data-sqe="name"]',
        'section h1',
        'main h1',
        'div[class*="product-briefing"] h1',
        'div[class*="ProductBriefing"] h1',
        'div[class*="product"] h1',
        'div[class*="title"]',
        'span[class*="title"]',
        'div[class*="name"]',
        'span[class*="name"]'
      ];

      const titleCandidates = [
        pickMeta('og:title'),
        pickMeta('twitter:title'),
        ...selectors.map(visibleText),
        document.title || ''
      ].filter(Boolean);

      // Last resort: scan visible body text for a product-like line.
      const bodyLines = (document.body?.innerText || '')
        .split('\n')
        .map(s => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter(s => s.length >= 12 && s.length <= 180);

      const badLine = /^(shopee|search|cart|login|sign up|free shipping|malaysia|categories|sold|rating|voucher|add to cart|buy now|chat|share|report)$/i;
      const productLine = bodyLines.find(line => {
        if (badLine.test(line)) return false;
        if (/^RM\s?\d/i.test(line)) return false;
        if (/^\d+(\.\d+)?k? sold$/i.test(line)) return false;
        if (/^(shipping|quantity|variation|product ratings|description)$/i.test(line)) return false;
        return /[a-zA-Z]/.test(line) && (line.includes(' ') || line.includes('-'));
      }) || '';

      const descCandidates = [
        pickMeta('og:description'),
        pickMeta('description'),
        visibleText('[data-sqe="product-description"]'),
        visibleText('div[class*="product-detail"]'),
        visibleText('section[class*="description"]')
      ].filter(Boolean);

      return {
        title: titleCandidates.find(Boolean) || productLine || '',
        productLine,
        description: descCandidates.find(Boolean) || '',
        image: pickMeta('og:image') || pickMeta('twitter:image') || '',
        pageTitle: document.title || '',
        bodySample: bodyLines.slice(0, 30)
      };
    });

    const rejectTitle = (value) => {
      const t = cleanShopeeTitle(value || '');
      if (!t) return '';
      if (/^product$/i.test(t)) return '';
      if (/^shopee$/i.test(t)) return '';
      if (/^malaysia\s*\|\s*free shipping/i.test(t)) return '';
      if (/free shipping across malaysia/i.test(t)) return '';
      if (/^\d+$/.test(t)) return '';
      if (t.length < 8) return '';
      return t;
    };

    let title = rejectTitle(data.title);
    if (!title) title = rejectTitle(data.productLine);
    if (!title) title = rejectTitle(data.pageTitle);
    if (!title && Array.isArray(data.bodySample)) {
      for (const line of data.bodySample) {
        title = rejectTitle(line);
        if (title) break;
      }
    }

    if (!title) return null;

    return {
      title,
      description: makeShopeeDescription(title, data.description || ''),
      image: data.image || '',
      categoryText: '',
      source: 'playwright-browser'
    };

  } catch (e) {
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

async function detectAffiliateProduct(rawUrl) {
  const targetUrl = normalizeAffiliateUrl(rawUrl);
  if (!targetUrl) throw new Error('Missing URL');

  let finalUrl = targetUrl;
  let html = '';

  // First request is mainly to resolve Shopee shortlink and get meta if available.
  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': 'https://shopee.com.my/'
      }
    });
    finalUrl = response.url || targetUrl;
    html = await response.text();
  } catch (e) {}

  const ids = extractShopeeIds(finalUrl) || extractShopeeIds(targetUrl);

  // Stronger detection: Shopee item APIs by shop_id + item_id.
  const apiResult = await detectFromShopeeApi(finalUrl, ids);
  let title = apiResult?.title || '';
  let description = apiResult?.description || '';
  let image = apiResult?.image || '';
  let source = apiResult?.source || '';
  let categoryText = apiResult?.categoryText || '';

  // Fallback: HTML metadata if Shopee allows it.
  if (!title && html) {
    title = cleanShopeeTitle(pickTitleFromHtml(html));
    description = shortenDescription(pickMeta(html, 'og:description') || pickMeta(html, 'description'), title);
    image = pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image');
    source = title ? 'meta' : '';

    const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ldMatches) {
      try {
        const json = JSON.parse(m[1]);
        const arr = Array.isArray(json) ? json : [json];
        for (const obj of arr) {
          if (obj && obj.name && (!title || title.toLowerCase() === 'shopee')) {
            title = cleanShopeeTitle(obj.name);
            source = 'jsonld';
          }
          if (obj && obj.description && (!description || description.includes('Semak detail'))) {
            description = shortenDescription(obj.description, title);
          }
          if (obj && obj.image && !image) image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
        }
      } catch(e) {}
    }
  }

  // Last external fallback: reader service can sometimes read JS-heavy pages as markdown.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title)) {
    const reader = await detectFromJinaReader(finalUrl);
    if (reader?.title && !/^\d+$/.test(reader.title)) {
      title = reader.title;
      description = reader.description;
      image = image || reader.image;
      source = reader.source;
    }
  }

  // Strongest fallback: Playwright opens Shopee like a real browser.
  // Use this after API/meta/reader because it is slower but can read JS-rendered pages.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    const browserResult = await detectFromPlaywright(finalUrl);
    if (browserResult?.title && !/^\d+$/.test(browserResult.title)) {
      title = browserResult.title;
      description = browserResult.description;
      image = image || browserResult.image;
      source = browserResult.source;
    }
  }

  // Fallback from old Shopee slug format: product-name-i.shopid.itemid
  // This cannot help with /product/shopid/itemid links because they have no title,
  // but it is useful for older/full product URLs that include the product name.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    try {
      const pathPart = new URL(finalUrl).pathname || '';
      const slugMatch = pathPart.match(/\/([^\/]+)-i\.\d+\.\d+/i);
      if (slugMatch && slugMatch[1]) {
        const slugTitle = cleanShopeeTitle(decodeURIComponent(slugMatch[1]).replace(/-/g, ' '));
        if (slugTitle && !/^product$/i.test(slugTitle) && !/^shopee$/i.test(slugTitle)) {
          title = slugTitle;
          description = makeShopeeDescription(title, '');
          source = 'url-slug';
        }
      }
    } catch(e) {}
  }

  // Clean fallback: do NOT use item id or generic Shopee page as a fake title. Let user know if Shopee blocks.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    title = '';
    description = 'Shopee tidak benarkan sistem baca nama produk penuh. Paste tajuk produk atau isi manual sebelum Save.';
    source = 'blocked';
  }

  const category = titleToCategory((categoryText ? categoryText + ' ' : '') + title);
  return {
    ok: true,
    url: targetUrl,
    finalUrl,
    shopid: ids?.shopid || '',
    itemid: ids?.itemid || '',
    source,
    title,
    description,
    category,
    badge: title ? titleToBadge(title, category) : 'Useful Item',
    icon: title ? titleToIcon(title) : '🛒',
    meta: title ? titleToMeta(title, category) : 'Semak manual sebelum Save',
    image: image || '',
    note: source === 'shopee-api'
      ? 'Auto filled daripada Shopee item API. Sila semak sebelum Save.'
      : source === 'blocked'
        ? 'Shopee block metadata produk. Sistem tidak guna ID sebagai title. Paste tajuk produk atau isi manual.'
        : source === 'reader'
          ? 'Auto filled guna reader fallback. Sila semak sebelum Save.'
          : source === 'url-slug'
            ? 'Auto filled guna nama produk daripada URL slug. Sila semak sebelum Save.'
            : source === 'playwright-browser'
              ? 'Auto filled guna Playwright browser mode. Sila semak sebelum Save.'
              : 'Auto filled daripada metadata page + keyword mapping. Sila semak sebelum Save.'
  };
}


// =========================
// AZOBSS 674: STRIPE CHECKOUT FOR PREMIUM SOFTWARE / CAD ONLY
// The backend resolves the trusted product, price and download target.
// Brownies / food ordering is intentionally not connected to Stripe.
// =========================
function azStripeDigitalSecret() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}
function azStripeDigitalConfigured() {
  return /^sk_(test|live)_/.test(azStripeDigitalSecret());
}
function azStripeDigitalMode() {
  const secret = azStripeDigitalSecret();
  return secret.startsWith('sk_test_') ? 'test' : (secret.startsWith('sk_live_') ? 'live' : 'not-configured');
}
function azStripeDigitalSource(data = {}) {
  const joined = [
    data.source,
    data.sourcePage,
    data.pageUrl,
    data.returnUrl,
    data.product && data.product.source,
    data.product && data.product.sourcePage
  ].map(v => String(v || '').toLowerCase()).join(' ');
  return joined.includes('cad') ? 'CAD Tools' : 'Software';
}
function azStripeDigitalReturnPage(data = {}) {
  const requested = cleanPremiumUrl(data.returnUrl || data.pageUrl || data.sourceUrl || '');
  if (requested) {
    try {
      const u = new URL(requested);
      const host = String(u.hostname || '').toLowerCase();
      const allowed = host === 'azobss.com' || host.endsWith('.azobss.com') || host === 'zedan91.github.io' || host.endsWith('.zedan91.github.io');
      if (allowed) {
        u.hash = '';
        u.search = '';
        return u.toString();
      }
    } catch (_) {}
  }
  return azStripeDigitalSource(data) === 'CAD Tools'
    ? `${FRONTEND_BASE_URL}/CAD-Tools-&-Resources/`
    : `${FRONTEND_BASE_URL}/Software-Tools/`;
}
function azStripeDigitalUrlWithQuery(baseUrl, values = {}) {
  const u = new URL(baseUrl);
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') u.searchParams.set(key, String(value));
  });
  return u.toString().replace(/%7BCHECKOUT_SESSION_ID%7D/gi, '{CHECKOUT_SESSION_ID}');
}
async function azStripeDigitalRequest(pathname, options = {}) {
  const secret = azStripeDigitalSecret();
  if (!/^sk_(test|live)_/.test(secret)) {
    const err = new Error('STRIPE_SECRET_KEY belum dikonfigurasi pada Render.');
    err.statusCode = 503;
    throw err;
  }
  const headers = { Authorization: `Bearer ${secret}`, ...(options.headers || {}) };
  const response = await fetch(`https://api.stripe.com/v1${pathname}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanPremiumText(data && data.error && data.error.message, 400) || 'Stripe API request failed.';
    const err = new Error(message);
    err.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    err.stripeResponse = data;
    throw err;
  }
  return data;
}
async function azCreateDigitalStripeCheckout(data = {}, req = null) {
  if (!azStripeDigitalConfigured()) {
    const err = new Error('STRIPE_SECRET_KEY belum dikonfigurasi pada Render.');
    err.statusCode = 503;
    throw err;
  }

  const requestedProduct = data.product || {};
  const trustedResolved = await azResolveTrustedPremiumProduct(data, req);
  const product = trustedResolved.product || {};
  const activationPlan = trustedResolved.subscriptionPlan || product.subscriptionPlan || product.selectedSubscriptionPlan || null;
  const baseProductName = cleanPremiumText(product.name || product.productName || data.productName || data.title || 'AZOBSS Digital Product', 130);
  const productName = cleanPremiumText(activationPlan ? `${baseProductName} (${activationPlan.label || activationPlan.id})` : baseProductName, 160);
  const productId = cleanPremiumText(product.productId || product.id || data.productId || requestedProduct.productId || requestedProduct.id || productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 160);
  const baseAmountText = cleanPremiumText(trustedResolved.amountText || product.price || '', 40);
  const baseAmountSen = Number(trustedResolved.amountSen || parseAmountToSen(baseAmountText));
  const baseAmount = baseAmountSen / 100;
  const identity = await azCommissionIdentityFromRequest(req);
  const priceAdjustmentCategory = azTrustedPremiumPriceCategory(trustedResolved, product);
  const priceAdjustmentPercent = identity ? azIdentityPriceAdjustment(identity, priceAdjustmentCategory) : 0;
  const adjustedAmount = identity ? azApplyUserPriceAdjustment(baseAmount, identity, priceAdjustmentCategory) : baseAmount;
  const amountSen = Math.round(adjustedAmount * 100);
  const amountText = azAdjustedMoneyText(adjustedAmount);
  const downloadLink = cleanPremiumUrl(trustedResolved.downloadLink || product.secureDownloadLink || product.premiumDownloadFileLink || product.privateDownloadLink || product.downloadLink || '');
  const r2ObjectKey = azSafeR2ObjectKey(trustedResolved.r2ObjectKey || product.r2ObjectKey || product.r2Key || requestedProduct.r2ObjectKey || requestedProduct.r2Key || data.r2ObjectKey || data.r2Key || '');
  const submittedUser = getPremiumUser(data);
  const user = identity ? { ...submittedUser, uid:identity.uid || submittedUser.uid, username:identity.username || submittedUser.username, email:identity.authEmail || identity.email || submittedUser.email } : submittedUser;
  const buyerEmail = cleanPremiumText(user.email || data.buyerEmail || data.email || '', 180);
  const requestedLimit = azobssDownloadLimitFromOrder({ ...data, product });
  const requestedExpiryHours = azobssExpiryHoursFromOrder({ ...data, product });
  if (!productName || !productId || !amountSen) {
    const err = new Error('Missing backend product name, product ID or valid backend amount.');
    err.statusCode = 400;
    throw err;
  }
  if (!downloadLink && !r2ObjectKey) {
    const err = new Error('Premium Download File Link atau Cloudflare R2 Private Object Key belum diset untuk produk ini.');
    err.statusCode = 400;
    throw err;
  }

  const source = azStripeDigitalSource(data);
  const orderId = makeId('stripe');
  const returnPage = azStripeDigitalReturnPage(data);
  const successUrl = azStripeDigitalUrlWithQuery(returnPage, {
    payment:'stripe_return',
    stripe:'success',
    orderId,
    session_id:'{CHECKOUT_SESSION_ID}'
  });
  const cancelUrl = azStripeDigitalUrlWithQuery(returnPage, {
    payment:'stripe_cancelled',
    stripe:'cancelled',
    orderId
  });

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', successUrl);
  params.set('cancel_url', cancelUrl);
  params.set('client_reference_id', orderId);
  // AZOBSS 697: Stripe Checkout is reserved for card payments.
  // FPX is handled by the separate Bank Transfer / FPX flow, and forcing
  // `fpx` here causes Checkout Session creation to fail when FPX is not
  // activated or the Stripe account is still awaiting business verification.
  params.append('payment_method_types[]', 'card');
  params.set('locale', 'auto');
  params.set('metadata[orderId]', orderId);
  params.set('metadata[productId]', productId);
  params.set('metadata[source]', source);
  params.set('metadata[buyerEmail]', buyerEmail);
  if (azValidEmailLike(buyerEmail)) params.set('customer_email', buyerEmail);
  params.set('line_items[0][price_data][currency]', 'myr');
  params.set('line_items[0][price_data][unit_amount]', String(amountSen));
  params.set('line_items[0][price_data][product_data][name]', productName);
  params.set('line_items[0][price_data][product_data][description]', `${source} premium digital purchase`);
  params.set('line_items[0][quantity]', '1');

  const stripeData = await azStripeDigitalRequest('/checkout/sessions', {
    method:'POST',
    headers:{
      'Content-Type':'application/x-www-form-urlencoded',
      'Idempotency-Key':`azobss-digital-${orderId}`
    },
    body:params.toString()
  });
  if (!stripeData || !stripeData.id || !stripeData.url) {
    const err = new Error('Stripe Checkout gagal dicipta.');
    err.statusCode = 502;
    throw err;
  }

  upsertPremiumOrder({
    orderId,
    productId,
    productName,
    amount:amountText,
    amountSen,
    baseAmount,
    baseAmountSen,
    saleAmount:adjustedAmount,
    saleAmountText:amountText,
    priceAdjustmentPercent,
    priceAdjustmentCategory,
    status:'pending',
    paymentMethod:'stripe',
    paymentReference:'',
    stripeCheckoutSessionId:stripeData.id,
    stripeSessionId:stripeData.id,
    paymentUrl:stripeData.url,
    returnUrl:returnPage,
    sourceUrl:data.sourceUrl || data.pageUrl || returnPage,
    pageUrl:data.pageUrl || data.sourceUrl || returnPage,
    source,
    user,
    email:buyerEmail,
    buyerEmail,
    product:{
      ...product,
      id:productId,
      productId,
      name:productName,
      basePrice:baseAmountText,
      price:amountText,
      priceAdjustmentPercent,
      priceAdjustmentCategory,
      downloadLimit:requestedLimit,
      maxDownload:requestedLimit,
      maxDownloads:requestedLimit,
      expiryHours:requestedExpiryHours,
      linkExpiryHours:requestedExpiryHours,
      subscriptionCodeEnabled:!!trustedResolved.subscriptionCodeEnabled,
      activationCodeSale:!!trustedResolved.subscriptionCodeEnabled,
      subscriptionPlan:activationPlan,
      subscriptionPlanId:activationPlan && activationPlan.id,
      activationCodePrefix:azActivationCodePrefix(product),
      r2ObjectKey,
      r2Key:r2ObjectKey
    },
    subscriptionCodeEnabled:!!trustedResolved.subscriptionCodeEnabled,
    activationCodeSale:!!trustedResolved.subscriptionCodeEnabled,
    subscriptionPlan:activationPlan,
    subscriptionPlanId:activationPlan && activationPlan.id,
    subscriptionPlanLabel:activationPlan && (activationPlan.label || activationPlan.id),
    subscriptionDurationDays:activationPlan && activationPlan.durationDays,
    subscriptionMonths:activationPlan && activationPlan.months,
    activationCodePrefix:azActivationCodePrefix(product),
    trustedProductSource:trustedResolved.trustedSource || 'backend',
    isAdminTestPurchase:!!trustedResolved.isAdminTestPurchase,
    clientPriceIgnored:cleanPremiumText(requestedProduct.price || data.amount || data.price || '', 40),
    shareReferral:azReferralFrom(data, product, { productId, returnUrl:returnPage }),
    productOwner:azProductOwnerFrom(product, { productId }),
    premiumDownloadFileLink:downloadLink,
    downloadLink,
    r2ObjectKey,
    r2Key:r2ObjectKey,
    downloadLimit:requestedLimit,
    maxDownload:requestedLimit,
    maxDownloads:requestedLimit,
    expiryHours:requestedExpiryHours,
    linkExpiryHours:requestedExpiryHours,
    receiptTokenRequired:true,
    receiptTokenVersion:2,
    createdAt:new Date().toISOString()
  });

  return {
    id:stripeData.id,
    sessionId:stripeData.id,
    orderId,
    paymentUrl:stripeData.url,
    url:stripeData.url,
    redirectUrl:stripeData.url,
    status:'pending',
    amount:adjustedAmount,
    amountSen,
    baseAmount,
    baseAmountSen,
    priceAdjustmentPercent,
    priceAdjustmentCategory,
    source,
    mode:azStripeDigitalMode()
  };
}
async function azVerifyDigitalStripeOrder(order = {}) {
  const sessionId = cleanPremiumText(order.stripeCheckoutSessionId || order.stripeSessionId || '', 220);
  if (!sessionId) return { paid:false, reason:'stripe_session_missing' };
  const session = await azStripeDigitalRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, { method:'GET' });
  const paid = String(session.payment_status || '').toLowerCase() === 'paid';
  return {
    paid,
    session,
    reason:paid ? 'paid' : (session.payment_status || session.status || 'pending'),
    paymentReference:cleanPremiumText(session.payment_intent || session.id || '', 220)
  };
}


// AZOBSS 676: STRIPE SIGNED WEBHOOK FOR PREMIUM SOFTWARE / CAD
function azStripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}
function azStripeWebhookConfigured() {
  return /^whsec_/.test(azStripeWebhookSecret());
}
function azReadStripeWebhookBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Webhook body too large.'), { statusCode:413 }));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function azStripeWebhookSignatureValid(rawBody, signatureHeader, toleranceSeconds = 300) {
  const secret = azStripeWebhookSecret();
  if (!/^whsec_/.test(secret)) return { ok:false, reason:'webhook_secret_not_configured' };
  const header = String(signatureHeader || '').trim();
  if (!header) return { ok:false, reason:'stripe_signature_missing' };
  const pairs = header.split(',').map(part => part.trim()).filter(Boolean);
  let timestamp = 0;
  const signatures = [];
  for (const part of pairs) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') timestamp = Number(value) || 0;
    if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (!timestamp || !signatures.length) return { ok:false, reason:'stripe_signature_invalid_format' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > Math.max(30, Number(toleranceSeconds) || 300)) {
    return { ok:false, reason:'stripe_signature_timestamp_outside_tolerance' };
  }
  const payload = Buffer.concat([Buffer.from(String(timestamp) + '.', 'utf8'), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '')]);
  const expectedHex = crypto.createHmac('sha256', secret).update(payload).digest('hex').toLowerCase();
  const expected = Buffer.from(expectedHex, 'hex');
  const matched = signatures.some((value) => {
    try {
      const received = Buffer.from(value, 'hex');
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch (_) { return false; }
  });
  return matched ? { ok:true, timestamp } : { ok:false, reason:'stripe_signature_mismatch' };
}
async function azHandleStripeDigitalWebhookEvent(event = {}, req = null) {
  const eventType = cleanPremiumText(event.type || '', 120);
  const session = event && event.data && event.data.object && typeof event.data.object === 'object' ? event.data.object : null;
  if (!session) return { ok:true, ignored:true, reason:'missing_event_object', eventType };
  const supported = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed'
  ]);
  if (!supported.has(eventType)) return { ok:true, ignored:true, reason:'event_not_used', eventType };

  const orderId = cleanPremiumText((session.metadata && session.metadata.orderId) || session.client_reference_id || '', 160);
  if (!orderId) return { ok:true, ignored:true, reason:'order_id_missing', eventType, sessionId:cleanPremiumText(session.id || '', 220) };
  let order = await findPremiumOrderByAnyDeep({ orderId });
  if (!order) {
    console.warn('Stripe webhook order not found:', orderId, cleanPremiumText(session.id || '', 220));
    return { ok:true, ignored:true, reason:'order_not_found', eventType, orderId };
  }

  const expectedSessionId = cleanPremiumText(order.stripeCheckoutSessionId || order.stripeSessionId || '', 220);
  const receivedSessionId = cleanPremiumText(session.id || '', 220);
  if (expectedSessionId && receivedSessionId && expectedSessionId !== receivedSessionId) {
    console.warn('Stripe webhook session mismatch:', orderId, expectedSessionId, receivedSessionId);
    return { ok:true, ignored:true, reason:'session_mismatch', eventType, orderId };
  }

  const expectedAmountSen = Number(order.amountSen || 0) || 0;
  const receivedAmountSen = Number(session.amount_total || session.amount_subtotal || 0) || 0;
  const currency = String(session.currency || '').toLowerCase();
  if (expectedAmountSen && receivedAmountSen && expectedAmountSen !== receivedAmountSen) {
    console.warn('Stripe webhook amount mismatch:', orderId, expectedAmountSen, receivedAmountSen);
    return { ok:true, ignored:true, reason:'amount_mismatch', eventType, orderId };
  }
  if (currency && currency !== 'myr') {
    console.warn('Stripe webhook currency mismatch:', orderId, currency);
    return { ok:true, ignored:true, reason:'currency_mismatch', eventType, orderId };
  }

  if (eventType === 'checkout.session.async_payment_failed') {
    order = upsertPremiumOrder({
      ...order,
      status:String(order.status || '').toLowerCase() === 'paid' ? 'paid' : 'pending',
      stripePaymentFailedAt:new Date().toISOString(),
      stripePaymentFailureEventId:cleanPremiumText(event.id || '', 220),
      stripeLastWebhookEventType:eventType,
      stripeLastWebhookEventId:cleanPremiumText(event.id || '', 220)
    });
    return { ok:true, handled:true, paid:false, eventType, orderId:order.orderId || orderId };
  }

  const paymentStatus = String(session.payment_status || '').toLowerCase();
  if (paymentStatus !== 'paid') {
    order = upsertPremiumOrder({
      ...order,
      stripeLastWebhookEventType:eventType,
      stripeLastWebhookEventId:cleanPremiumText(event.id || '', 220),
      stripeWebhookPendingAt:new Date().toISOString(),
      stripeWebhookPaymentStatus:paymentStatus || 'unknown'
    });
    return { ok:true, handled:true, paid:false, eventType, orderId:order.orderId || orderId, paymentStatus:paymentStatus || 'unknown' };
  }

  order = await azFinalizePaidOrderOnce(order, req, {
    verified:true,
    paymentMethod:'stripe',
    verificationSource:'stripe-webhook',
    stripeSession:session,
    paymentReference:cleanPremiumText(session.payment_intent || session.id || '', 220)
  });
  order = upsertPremiumOrder({
    ...order,
    stripeWebhookVerifiedAt:order.stripeWebhookVerifiedAt || new Date().toISOString(),
    stripeLastWebhookEventType:eventType,
    stripeLastWebhookEventId:cleanPremiumText(event.id || '', 220),
    stripeWebhookEventId:cleanPremiumText(event.id || '', 220)
  });
  return { ok:true, handled:true, paid:true, eventType, orderId:order.orderId || orderId, status:order.status || 'paid' };
}



// AZOBSS 773: Service booking with LCD price ranges and fixed pickup/delivery charges.
const AZ_SERVICE_BOOKING_CATALOG = Object.freeze({
  "format-windows": { name:"Format Windows 10 / 11", min:30, max:30 },
  "cleaning-thermal": { name:"Pembersihan + Thermal Paste", min:80, max:80 },
  "keyboard": { name:"Tukar Keyboard Laptop", min:150, max:150 },
  "lcd-replacement": { name:"Tukar LCD Laptop", dynamic:true },
  // Legacy IDs remain accepted for old cached forms.
  "lcd-14": { name:"Tukar LCD Laptop 14.0 inci", min:260, max:400 },
  "lcd-15": { name:"Tukar LCD Laptop 15.6 inci", min:270, max:450 },
  "lcd-16": { name:"Tukar LCD Laptop 16.0 inci", min:400, max:600 }
});
const AZ_SERVICE_LCD_PRICES = Object.freeze({
  "13.3 / 13.4 inci": { standard:{ min:250,max:380,plus:false }, touch:{ min:550,max:850,plus:false } },
  "14.0 inci": { standard:{ min:260,max:400,plus:false }, touch:{ min:500,max:750,plus:false } },
  "15.6 inci": { standard:{ min:270,max:450,plus:false }, touch:{ min:550,max:850,plus:false } },
  "16.0 inci": { standard:{ min:400,max:600,plus:false }, touch:{ min:700,max:1000,plus:true } },
  "17.3 inci": { standard:{ min:350,max:650,plus:false }, touch:{ min:850,max:1200,plus:true } }
});
const AZ_SERVICE_LOGISTICS = Object.freeze({
  "Hantar sendiri ke Kedai": { pickupFee:0, deliveryFee:0, transportFee:0, onsiteFee:0 },
  "Pengambilan / Penghantaran": { pickupFee:0, deliveryFee:0, transportFee:30, onsiteFee:0, itemName:"Kos pengambilan atau penghantaran" },
  "Pengambilan & Penghantaran": { pickupFee:30, deliveryFee:30, transportFee:0, onsiteFee:0 },
  "Servis On-site": { pickupFee:0, deliveryFee:0, transportFee:0, onsiteFee:50, itemName:"Caj servis On-site" },
  // Legacy values remain accepted for old cached forms and existing records.
  "Hantar & ambil sendiri": { pickupFee:0, deliveryFee:0, transportFee:0, onsiteFee:0 },
  "Hantar sendiri + penghantaran AZOBSS": { pickupFee:0, deliveryFee:30, transportFee:0, onsiteFee:0 },
  "Pengambilan AZOBSS + ambil sendiri": { pickupFee:30, deliveryFee:0, transportFee:0, onsiteFee:0 },
  "Pengambilan & penghantaran AZOBSS": { pickupFee:30, deliveryFee:30, transportFee:0, onsiteFee:0 },
  "On-site": { pickupFee:0, deliveryFee:0, transportFee:0, onsiteFee:50, itemName:"Caj servis On-site" },
  "Bincang melalui WhatsApp": { pickupFee:0, deliveryFee:0, transportFee:0, onsiteFee:0 }
});
const AZ_SERVICE_BOOKING_CENTER = Object.freeze({ lat:3.255511332218502, lng:101.69410874034087, label:"Kedai AZOBSS" });
const AZ_SERVICE_BOOKING_RADIUS_KM = 10;
function azServiceBookingCoordinate(value, min, max) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return NaN;
  const number = Number(text);
  return Number.isFinite(number) && number >= min && number <= max ? number : NaN;
}
function azServiceBookingDistanceKm(lat1, lng1, lat2, lng2) {
  const radius = 6371;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function azServiceBookingText(value, max = 300) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function azServiceBookingPhone(value) {
  return azServiceBookingText(value, 30).replace(/[^0-9+()\-\s]/g, "").slice(0, 24);
}
function azServiceBookingEmail(value) {
  const email = azServiceBookingText(value, 180).toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}
function azServiceBookingId(clientRequestId) {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const seed = azServiceBookingText(clientRequestId, 160) || crypto.randomBytes(18).toString("hex");
  const suffix = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `AZS-${date}-${suffix}`;
}
function azServiceBookingRangeLabel(min, max, plus) {
  const a = `RM${Number(min || 0).toFixed(0)}`;
  const b = `RM${Number(max || 0).toFixed(0)}`;
  return Number(min || 0) === Number(max || 0) ? a : `${a} – ${b}${plus ? "+" : ""}`;
}
function azServiceBookingLcdEstimate(screenSize, screenType) {
  const size = azServiceBookingText(screenSize, 60);
  const type = azServiceBookingText(screenType, 60);
  const row = AZ_SERVICE_LCD_PRICES[size];
  const wantTouch = type === "Touch Screen";
  const wantStandard = type === "Standard (Non-Touch)";
  let groups;
  if (row && wantStandard) groups = [row.standard];
  else if (row && wantTouch) groups = [row.touch];
  else if (row) groups = [row.standard, row.touch];
  else {
    const rows = Object.values(AZ_SERVICE_LCD_PRICES);
    groups = wantStandard ? rows.map(x => x.standard) : wantTouch ? rows.map(x => x.touch) : rows.flatMap(x => [x.standard, x.touch]);
  }
  const min = Math.min(...groups.map(x => Number(x.min || 0)));
  const max = Math.max(...groups.map(x => Number(x.max || 0)));
  const plus = groups.some(x => Boolean(x.plus));
  const detail = `${size || "Saiz tidak pasti"} • ${type || "Jenis skrin tidak pasti"}`;
  return { id:"lcd-replacement", name:`Tukar LCD Laptop — ${detail}`, minPrice:min, maxPrice:max, price:min, plus, suffix:plus?"+":"", priceLabel:azServiceBookingRangeLabel(min,max,plus) };
}
function azServiceBookingEstimate(serviceIds, screenSize, screenType, serviceMethod) {
  const ids = Array.isArray(serviceIds) ? [...new Set(serviceIds.map(v => azServiceBookingText(v, 60)).filter(v => AZ_SERVICE_BOOKING_CATALOG[v]))].slice(0, 12) : [];
  const services = ids.map(id => {
    if (id === "lcd-replacement") return azServiceBookingLcdEstimate(screenSize, screenType);
    const item = AZ_SERVICE_BOOKING_CATALOG[id];
    const min = Number(item.min ?? item.price ?? 0), max = Number(item.max ?? item.price ?? min);
    return { id, name:item.name, minPrice:min, maxPrice:max, price:min, plus:false, suffix:"", priceLabel:azServiceBookingRangeLabel(min,max,false) };
  });
  const logisticsConfig = AZ_SERVICE_LOGISTICS[azServiceBookingText(serviceMethod, 80)] || AZ_SERVICE_LOGISTICS["Hantar sendiri ke Kedai"];
  const logistics = [];
  if (logisticsConfig.pickupFee) logistics.push({ id:"pickup", name:"Kos pengambilan oleh AZOBSS", price:logisticsConfig.pickupFee, minPrice:logisticsConfig.pickupFee, maxPrice:logisticsConfig.pickupFee, priceLabel:`RM${logisticsConfig.pickupFee}` });
  if (logisticsConfig.deliveryFee) logistics.push({ id:"delivery", name:"Kos penghantaran semula oleh AZOBSS", price:logisticsConfig.deliveryFee, minPrice:logisticsConfig.deliveryFee, maxPrice:logisticsConfig.deliveryFee, priceLabel:`RM${logisticsConfig.deliveryFee}` });
  if (logisticsConfig.transportFee) logistics.push({ id:"transport", name:logisticsConfig.itemName || "Kos pengambilan atau penghantaran", price:logisticsConfig.transportFee, minPrice:logisticsConfig.transportFee, maxPrice:logisticsConfig.transportFee, priceLabel:`RM${logisticsConfig.transportFee}` });
  if (logisticsConfig.onsiteFee) logistics.push({ id:"onsite", name:logisticsConfig.itemName || "Caj servis On-site", price:logisticsConfig.onsiteFee, minPrice:logisticsConfig.onsiteFee, maxPrice:logisticsConfig.onsiteFee, priceLabel:`RM${logisticsConfig.onsiteFee}` });
  const all = services.concat(logistics);
  const minimum = all.reduce((sum, item) => sum + Number(item.minPrice || 0), 0);
  const maximum = all.reduce((sum, item) => sum + Number(item.maxPrice || item.minPrice || 0), 0);
  const plus = services.some(item => Boolean(item.plus));
  const pickupFee = Number(logisticsConfig.pickupFee || 0);
  const deliveryFee = Number(logisticsConfig.deliveryFee || 0);
  const transportFee = Number(logisticsConfig.transportFee || 0);
  const onsiteFee = Number(logisticsConfig.onsiteFee || 0);
  return { services, logistics, minimum:Math.round(minimum*100)/100, maximum:Math.round(maximum*100)/100, total:Math.round(minimum*100)/100, suffix:plus?"+":"", plus, pickupFee, deliveryFee, transportFee, onsiteFee, logisticsTotal:pickupFee+deliveryFee+transportFee+onsiteFee, display:azServiceBookingRangeLabel(minimum,maximum,plus) };
}
function azServiceBookingDirectionsUrl(originLat, originLng) {
  const lat = Number(originLat), lng = Number(originLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `https://www.google.com/maps/dir/?api=1&origin=${lat.toFixed(7)},${lng.toFixed(7)}&destination=${AZ_SERVICE_BOOKING_CENTER.lat},${AZ_SERVICE_BOOKING_CENTER.lng}&travelmode=driving&dir_action=navigate`;
}
function azServiceBookingWhatsappNumber() {
  const raw = String(process.env.AZOBSS_SERVICE_WHATSAPP || "601135600723").replace(/\D/g, "");
  // Auto-migrate the previous AZOBSS service number if it is still stored in Render ENV.
  if (!raw || raw === "60175099983") return "601135600723";
  return raw;
}
function azServiceBookingMessage(row) {
  const serviceLines = (row.services || []).map((item, index) => `*${index + 1}. ${item.name} — ${item.priceLabel || azServiceBookingRangeLabel(item.minPrice ?? item.price, item.maxPrice ?? item.price, item.plus)}*`);
  const logisticLines = (row.logistics || []).map(item => `*- ${item.name} — ${item.priceLabel || `RM${Number(item.price || 0).toFixed(0)}`}*`);
  const estimateDisplay = row.estimateDisplay || azServiceBookingRangeLabel(row.estimatedMinimum, row.estimatedMaximum ?? row.estimatedMinimum, row.estimateHasPlus);
  return [
    "Salam AZOBSS, saya ingin membuat tempahan servis laptop / PC.",
    "",
    `ID Tempahan: ${row.bookingId}`,
    `Nama: ${row.customerName}`,
    `Telefon: ${row.customerPhone}`,
    `E-mel: ${row.customerEmail || "-"}`,
    `Alamat : *${row.fullAddress || row.customerArea || "-"}*`,
    `Jarak dari kedai AZOBSS: ${Number.isFinite(Number(row.locationDistanceKm)) ? Number(row.locationDistanceKm).toFixed(2) + " km" : "-"}`,
    `Lokasi Kedai: ${row.locationMapUrl || "-"}`,
    `Cara serahan: *${row.serviceMethod || '-'}*`,
    "",
    `Peranti : *${row.deviceType} — ${row.deviceBrand} ${row.deviceModel}*`,
    `Saiz skrin : *${row.screenSize || "-"}*`,
    `Jenis skrin : *${row.screenType || "-"}*`,
    `Serial : *${row.deviceSerial || "-"}*`,
    `Keadaan : *${row.devicePowerState || "-"}*`,
    "",
    "Servis dipilih:",
    ...(serviceLines.length ? serviceLines : ["- Pemeriksaan / harga belum dipilih"]),
    "",
    "Kos logistik:",
    ...(logisticLines.length ? logisticLines : ["*- Tiada caj pickup/penghantaran dipilih*"]),
    `Anggaran Keseluruhan: *${(serviceLines.length || logisticLines.length) ? estimateDisplay : "Perlu pemeriksaan"}*`,
    "",
    `Masalah: ${(row.issues || []).join(", ") || "-"}`,
    "",
    `Tarikh / masa : *${row.preferredDate || "Fleksibel"} • ${row.preferredTime || "Fleksibel"}*`,
    `Keutamaan: ${row.urgency || "Biasa"}`,
    `Data / backup : *${row.backupRequirement || "Tidak pasti"}*`,
    `Catatan masalah: ${row.problemDetails || "-"}`,
    `Permintaan tambahan: ${row.extraRequests || "-"}`,
    "",
    "Anggaran ini bukan harga final. Admin AZOBSS akan mengesahkan harga sebenar selepas menyemak model, panel/komponen, stok dan keadaan peranti."
  ].join("\n");
}
async function azCreatePublicServiceBooking(req, body = {}) {
  if (azServiceBookingText(body.companyWebsite, 120)) {
    return { ok:true, ignored:true, bookingId:"AZS-RECEIVED", whatsappUrl:`https://wa.me/${azServiceBookingWhatsappNumber()}` };
  }
  const customerName = azServiceBookingText(body.customerName, 100);
  const customerPhone = azServiceBookingPhone(body.customerPhone);
  const phoneDigits = customerPhone.replace(/\D/g, "");
  const customerEmailRaw = azServiceBookingText(body.customerEmail, 180);
  const customerEmail = azServiceBookingEmail(customerEmailRaw);
  const locationName = azServiceBookingText(body.locationName || body.customerArea, 180);
  const locationLatitude = azServiceBookingCoordinate(body.locationLatitude, -90, 90);
  const locationLongitude = azServiceBookingCoordinate(body.locationLongitude, -180, 180);
  const locationDistanceKm = Number.isFinite(locationLatitude) && Number.isFinite(locationLongitude)
    ? azServiceBookingDistanceKm(AZ_SERVICE_BOOKING_CENTER.lat, AZ_SERVICE_BOOKING_CENTER.lng, locationLatitude, locationLongitude)
    : NaN;
  const customerArea = locationName;
  const deviceType = azServiceBookingText(body.deviceType, 60);
  const deviceBrand = azServiceBookingText(body.deviceBrand, 80);
  const deviceModel = azServiceBookingText(body.deviceModel, 120);
  if (customerName.length < 2) throw Object.assign(new Error("Nama pelanggan diperlukan."), { statusCode:400 });
  if (phoneDigits.length < 8 || phoneDigits.length > 15) throw Object.assign(new Error("Nombor telefon tidak sah."), { statusCode:400 });
  if (customerEmailRaw && !customerEmail) throw Object.assign(new Error("Format e-mel tidak sah."), { statusCode:400 });
  if (customerArea.length < 2) throw Object.assign(new Error("Nama lokasi diperlukan. Sila pilih lokasi pada peta."), { statusCode:400 });
  if (!Number.isFinite(locationLatitude) || !Number.isFinite(locationLongitude)) throw Object.assign(new Error("Koordinat WGS84 tidak sah. Sila pilih lokasi semula pada peta."), { statusCode:400 });
  if (!Number.isFinite(locationDistanceKm) || locationDistanceKm > AZ_SERVICE_BOOKING_RADIUS_KM) throw Object.assign(new Error(`Lokasi berada di luar radius servis ${AZ_SERVICE_BOOKING_RADIUS_KM} km dari kedai AZOBSS.`), { statusCode:400 });
  if (!deviceType || !deviceBrand || !deviceModel) throw Object.assign(new Error("Jenis, jenama dan model peranti diperlukan."), { statusCode:400 });
  const requestedServiceMethod = azServiceBookingText(body.serviceMethod, 80);
  const serviceMethod = AZ_SERVICE_LOGISTICS[requestedServiceMethod] ? requestedServiceMethod : "Hantar sendiri ke Kedai";
  const screenSize = azServiceBookingText(body.screenSize, 60);
  const screenType = azServiceBookingText(body.screenType, 60);
  const estimate = azServiceBookingEstimate(body.services, screenSize, screenType, serviceMethod);
  const issues = Array.isArray(body.issues) ? [...new Set(body.issues.map(v => azServiceBookingText(v, 140)).filter(Boolean))].slice(0, 25) : [];
  if (!estimate.services.length && !issues.length) throw Object.assign(new Error("Pilih sekurang-kurangnya satu servis atau masalah."), { statusCode:400 });
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const bookingId = azServiceBookingId(body.clientRequestId);
  const row = {
    bookingId,
    clientRequestId:azServiceBookingText(body.clientRequestId, 160),
    status:"new",
    source:"azobss-service-booking-form",
    recordType:"service_order",
    documentStage:"booking",
    customerName, customerPhone, customerPhoneDigits:phoneDigits, customerEmail, customerArea,
    locationName:customerArea,
    locationLatitude:Number(locationLatitude.toFixed(7)),
    locationLongitude:Number(locationLongitude.toFixed(7)),
    locationWgs84:`${locationLatitude.toFixed(6)}, ${locationLongitude.toFixed(6)}`,
    locationDistanceKm:Number(locationDistanceKm.toFixed(3)),
    locationRadiusKm:AZ_SERVICE_BOOKING_RADIUS_KM,
    locationCenterLabel:AZ_SERVICE_BOOKING_CENTER.label,
    locationCenterLatitude:AZ_SERVICE_BOOKING_CENTER.lat,
    locationCenterLongitude:AZ_SERVICE_BOOKING_CENTER.lng,
    locationMapUrl:azServiceBookingDirectionsUrl(locationLatitude, locationLongitude),
    fullAddress:azServiceBookingText(body.fullAddress, 400),
    deviceType, deviceBrand, deviceModel,
    screenSize,
    screenType,
    deviceSerial:azServiceBookingText(body.deviceSerial, 120),
    devicePowerState:azServiceBookingText(body.devicePowerState, 80),
    services:estimate.services,
    issues,
    estimatedMinimum:estimate.minimum,
    estimatedMaximum:estimate.maximum,
    estimateDisplay:estimate.display,
    estimateSuffix:estimate.suffix,
    estimateHasPlus:estimate.plus,
    estimateFinal:false,
    logistics:estimate.logistics,
    pickupFee:estimate.pickupFee,
    deliveryFee:estimate.deliveryFee,
    transportFee:estimate.transportFee,
    onsiteFee:estimate.onsiteFee,
    logisticsTotal:estimate.logisticsTotal,
    serviceMethod,
    preferredDate:azServiceBookingText(body.preferredDate, 30),
    preferredTime:azServiceBookingText(body.preferredTime, 80),
    urgency:azServiceBookingText(body.urgency, 40) || "Biasa",
    backupRequirement:azServiceBookingText(body.backupRequirement, 100),
    problemDetails:azServiceBookingText(body.problemDetails, 1200),
    extraRequests:azServiceBookingText(body.extraRequests, 800),
    createdAt:nowIso, createdAtMs:nowMs, updatedAt:nowIso, updatedAtMs:nowMs,
    clientIpHash:crypto.createHash("sha256").update(azClientIp(req) + String(process.env.AZOBSS_SERVICE_BOOKING_HASH_SECRET || "azobss-service-booking")).digest("hex").slice(0, 24)
  };
  const db = getAzobssBackendDb();
  if (!db) throw Object.assign(new Error("Sistem rekod servis belum tersedia. Sila cuba semula atau gunakan WhatsApp."), { statusCode:503 });
  const ref = db.collection("serviceBookings").doc(bookingId);
  const existing = await ref.get();
  if (existing.exists) {
    const old = existing.data() || {};
    row.createdAt = old.createdAt || row.createdAt;
    row.createdAtMs = Number(old.createdAtMs || row.createdAtMs) || row.createdAtMs;
    row.status = old.status || row.status;
    row.documentStage = old.documentStage || row.documentStage;
    row.finalPrice = Number(old.finalPrice || 0) || null;
    row.finalPriceConfirmed = old.finalPriceConfirmed === true;
    row.invoiceDocId = azServiceBookingText(old.invoiceDocId, 180);
    row.invoiceNo = azServiceBookingText(old.invoiceNo, 180);
    row.receiptNo = azServiceBookingText(old.receiptNo, 180);
    row.invoiceStatus = azServiceBookingText(old.invoiceStatus, 40) || (row.invoiceDocId ? "pending" : "not_created");
    row.paymentStatus = azServiceBookingText(old.paymentStatus, 40) || "unpaid";
  } else {
    row.finalPrice = null;
    row.finalPriceConfirmed = false;
    row.invoiceDocId = "";
    row.invoiceNo = "";
    row.receiptNo = "";
    row.invoiceStatus = "not_created";
    row.paymentStatus = "unpaid";
  }
  row.whatsappMessage = azServiceBookingMessage(row);
  row.whatsappNumber = azServiceBookingWhatsappNumber();
  await ref.set(azJsonSafe(row), { merge:true });
  const notificationId = `service_${bookingId.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
  const notificationPayload = azJsonSafe({
    id:notificationId,
    docId:notificationId,
    type:"service_booking",
    category:"service",
    title:`Tempahan servis IT baharu • ${bookingId}`,
    body:`${customerName} • ${customerPhone} • ${customerArea} (${locationDistanceKm.toFixed(2)} km) • ${deviceBrand} ${deviceModel} • ${estimate.services.map(x => x.name).join(", ") || issues.slice(0, 3).join(", ")}`.slice(0, 500),
    status:"new",
    severity:"info",
    active:true,
    read:false,
    orderId:bookingId,
    productName:`${deviceBrand} ${deviceModel}`.trim(),
    username:customerName,
    email:customerEmail,
    targetTab:"servicebookings",
    targetLabel:"Open Service Bookings",
    source:"service-booking-form",
    createdAt:nowIso,
    createdAtMs:nowMs,
    updatedAt:nowIso,
    updatedAtMs:nowMs
  });
  // The main serviceBookings write is the only operation that blocks the customer.
  // Admin notification is queued after the response path so WhatsApp can open faster.
  setImmediate(() => {
    db.collection("adminNotifications").doc(notificationId).set(notificationPayload, { merge:true })
      .catch(error => console.warn("AZOBSS service booking notification background save failed:", error && (error.message || error)));
  });
  const whatsappUrl = `https://wa.me/${row.whatsappNumber}?text=${encodeURIComponent(row.whatsappMessage)}`;
  return { ok:true, bookingId, existed:existing.exists, estimatedMinimum:estimate.minimum, estimatedMaximum:estimate.maximum, estimateDisplay:estimate.display, estimateSuffix:estimate.suffix, estimateHasPlus:estimate.plus, pickupFee:estimate.pickupFee, deliveryFee:estimate.deliveryFee, transportFee:estimate.transportFee, onsiteFee:estimate.onsiteFee, logisticsTotal:estimate.logisticsTotal, whatsappUrl };
}


async function handler(req, res) {

  try {

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || "/";

    // AZOBSS PATCH 413: emergency subscription route diagnostics before all other route logic.
    if (pathname === "/api/subscription/health" || pathname === "/api/subscription/ping") {
      return send(res, 200, JSON.stringify({
        ok:true,
        service:"azobss-backend",
        patch:"413",
        route:"subscription",
        runningFile:"deploy-server.js",
        verify:"/api/subscription/verify",
        time:new Date().toISOString()
      }, null, 2), "application/json");
    }
    if (pathname === "/api/subscription/verify" && (req.method === "GET" || req.method === "HEAD")) {
      const quickCode = azSubscriptionCleanCode((parsed.query && (parsed.query.code || parsed.query.activationCode)) || "");
      if (!quickCode) {
        return send(res, 400, JSON.stringify({
          ok:false,
          valid:false,
          pro:false,
          status:"missing_code",
          error:"Activation code is required.",
          patch:"413",
          runningFile:"deploy-server.js"
        }, null, 2), "application/json");
      }
      // If code exists, continue to the full verify handler below.
    }

    if (req.method === "OPTIONS") {
      return send(res, 204, "");
    }

    // AZOBSS sensitive endpoint rate limits. These protect payment, receipt, download and commission APIs
    // without affecting normal static website browsing. Disable only for emergency debugging with AZOBSS_DISABLE_RATE_LIMIT=1.
    if (pathname === "/api/service-bookings" && req.method === "POST" && azRateLimitOrSend(req, res, "public-service-booking", 10, 60 * 60 * 1000)) return;
    if (pathname === "/api/admin/service-bookings" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-service-bookings-read", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/service-bookings-action" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-service-bookings-action", 50, 10 * 60 * 1000)) return;
    if (pathname === "/api/toyyib/create-pa-bm-bill" && req.method === "POST" && azRateLimitOrSend(req, res, "create-pa-bm-bill", 10, 5 * 60 * 1000)) return;
    if (pathname === "/api/admin/sales-invoice/toyyibpay-bill" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-manual-invoice-toyyib-bill", 30, 10 * 60 * 1000)) return;
    if (pathname === "/api/toyyib/create-public-pa-bill" && req.method === "POST" && azRateLimitOrSend(req, res, "create-public-pa-bill", 8, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/test-pa-bm-payment" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-test-pa-bm-payment", 12, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/test-public-pa-payment" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-test-public-pa-payment", 12, 10 * 60 * 1000)) return;
    if ((pathname === "/api/toyyib/create-bill" || pathname === "/api/create-payment") && req.method === "POST" && azRateLimitOrSend(req, res, "create-premium-bill", 12, 5 * 60 * 1000)) return;
    if (pathname === "/api/stripe/digital-checkout" && req.method === "POST" && azRateLimitOrSend(req, res, "stripe-digital-checkout", 12, 5 * 60 * 1000)) return;
    if (pathname === "/api/premium/free-promo-download" && req.method === "POST" && azRateLimitOrSend(req, res, "premium-free-promo-download", 30, 10 * 60 * 1000)) return;
    if (pathname === "/api/premium/complete-purchase" && req.method === "POST" && azRateLimitOrSend(req, res, "premium-complete-purchase", 8, 10 * 60 * 1000)) return;
    if (pathname === "/api/commission/status" && req.method === "GET" && parsed.query && parsed.query.records && azRateLimitOrSend(req, res, "commission-records", 60, 60 * 1000)) return;
    if (pathname === "/api/commission/retry-order" && req.method === "POST" && azRateLimitOrSend(req, res, "commission-retry", 10, 10 * 60 * 1000)) return;
    if (pathname === "/api/commission/payout-status" && req.method === "POST" && azRateLimitOrSend(req, res, "commission-payout-status", 30, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/api/premium/download/") && req.method === "GET" && azRateLimitOrSend(req, res, "premium-download-gate", 40, 60 * 1000)) return;
    if (pathname.startsWith("/api/premium/download/") && req.method === "POST" && azRateLimitOrSend(req, res, "premium-download-start", 15, 60 * 1000)) return;
    if (pathname.startsWith("/api/premium/download-session/") && (req.method === "GET" || req.method === "HEAD") && azRateLimitOrSend(req, res, "premium-download-session", 500, 60 * 1000)) return;
    if (pathname.startsWith("/api/premium/receipt/") && req.method === "GET" && azRateLimitOrSend(req, res, "premium-receipt", 40, 5 * 60 * 1000)) return;
    if (pathname === "/api/my-purchases" && req.method === "GET" && azRateLimitOrSend(req, res, "my-purchases-read", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/stesen-tanda-aras/maps" && req.method === "GET" && azRateLimitOrSend(req, res, "benchmark-maps", 120, 10 * 60 * 1000)) return;
    if (pathname === "/api/stesen-gps/maps" && req.method === "GET" && azRateLimitOrSend(req, res, "gps-maps", 120, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/api/my-purchases/delete/") && req.method === "DELETE" && azRateLimitOrSend(req, res, "my-purchases-delete", 40, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/api/my-purchases/receipt/") && req.method === "GET" && azRateLimitOrSend(req, res, "my-purchases-receipt", 60, 10 * 60 * 1000)) return;
    if (pathname === "/api/software-stats" && req.method === "GET" && azRateLimitOrSend(req, res, "software-stats-read", 240, 60 * 1000)) return;
    if (pathname === "/api/software-stats/download" && req.method === "POST" && azRateLimitOrSend(req, res, "software-stats-download", 60, 10 * 60 * 1000)) return;
    if (pathname === "/api/software-stats/like" && req.method === "POST" && azRateLimitOrSend(req, res, "software-stats-like", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/software-stats/rate" && req.method === "POST" && azRateLimitOrSend(req, res, "software-stats-rate", 40, 10 * 60 * 1000)) return;
    if (pathname === "/api/software-stats/admin-set" && req.method === "POST" && azRateLimitOrSend(req, res, "software-stats-admin-set", 10, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/audit-logs" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-audit-read", 60, 60 * 1000)) return;
    if (pathname === "/api/admin/audit-log" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-audit-write", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/pa-bm-purchase-records" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-pabm-records-read", 60, 60 * 1000)) return;
    if (pathname === "/api/admin/sales-document/share-link" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-sales-document-share-link", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/sales-document/temp" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-sales-document-temp-upload", 100, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/api/admin/sales-document/temp/") && req.method === "DELETE" && azRateLimitOrSend(req, res, "admin-sales-document-temp-delete", 160, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/t/") && (req.method === "GET" || req.method === "HEAD") && azRateLimitOrSend(req, res, "sales-document-temp-public", 600, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/payment-logs/delete" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-payment-logs-delete", 20, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/export" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-export", 30, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/system-health" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-system-health", 30, 10 * 60 * 1000)) return;
    if (pathname === "/api/tech-vault/login" && req.method === "POST" && azRateLimitOrSend(req, res, "tech-vault-login", 10, 15 * 60 * 1000)) return;
    if (pathname.startsWith("/api/tech-vault/") && pathname !== "/api/tech-vault/login" && azRateLimitOrSend(req, res, "tech-vault-api", 180, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/maintenance-scan" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-maintenance-scan", 40, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/maintenance-run" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-maintenance-run", 10, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/payment-notifications" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-payment-notifications-read", 80, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/payment-notifications-action" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-payment-notifications-action", 40, 10 * 60 * 1000)) return;
    if ((pathname === "/api/staff/payout-profile" || pathname === "/api/staff/payout-requests") && req.method === "GET" && azRateLimitOrSend(req, res, "staff-payout-read", 80, 10 * 60 * 1000)) return;
    if ((pathname === "/api/staff/payout-profile" || pathname === "/api/staff/payout-request") && req.method === "POST" && azRateLimitOrSend(req, res, "staff-payout-write", 20, 10 * 60 * 1000)) return;
    if (pathname === "/api/staff/payout-request-cancel" && req.method === "POST" && azRateLimitOrSend(req, res, "staff-payout-cancel", 12, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/payout-requests" && req.method === "GET" && azRateLimitOrSend(req, res, "admin-payout-requests-read", 60, 10 * 60 * 1000)) return;
    if (pathname === "/api/admin/payout-request-status" && req.method === "POST" && azRateLimitOrSend(req, res, "admin-payout-request-status", 30, 10 * 60 * 1000)) return;
    if (pathname.startsWith("/api/payout/receipt/") && req.method === "GET" && azRateLimitOrSend(req, res, "payout-receipt", 50, 10 * 60 * 1000)) return;



    if (pathname === "/api/admin/service-bookings" && req.method === "GET") {
      try {
        const identity = await azAdminIdentityFromRequest(req, parsed);
        if (!identity || !identity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) throw new Error("Firebase Admin is not configured.");
        const maxRows = Math.max(1, Math.min(300, Number(parsed.query.limit || 150) || 150));
        let snap;
        try { snap = await db.collection("serviceBookings").orderBy("createdAtMs", "desc").limit(maxRows).get(); }
        catch (_) { snap = await db.collection("serviceBookings").limit(maxRows).get(); }
        const records = [];
        snap.forEach(docSnap => records.push(azJsonSafe(Object.assign({ id:docSnap.id }, docSnap.data() || {}))));
        records.sort((a,b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
        return send(res, 200, JSON.stringify({ ok:true, records, count:records.length }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        return send(res, 500, JSON.stringify({ ok:false, error:azServiceBookingText(error && error.message, 300) || "Unable to load service bookings.", records:[] }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/service-bookings-action" && req.method === "POST") {
      try {
        const identity = await azAdminIdentityFromRequest(req, parsed);
        if (!identity || !identity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const body = parseRequestBody(await readBody(req));
        const bookingId = azServiceBookingText(body.bookingId || body.id, 100);
        const action = azServiceBookingText(body.action, 40).toLowerCase();
        if (!bookingId) return send(res, 400, JSON.stringify({ ok:false, error:"Booking ID is required." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) throw new Error("Firebase Admin is not configured.");
        const ref = db.collection("serviceBookings").doc(bookingId);
        if (action === "delete") {
          await ref.delete();
          return send(res, 200, JSON.stringify({ ok:true, action, bookingId }, null, 2), "application/json");
        }
        if (action === "status") {
          const allowed = new Set(["new","contacted","inspection","quoted","confirmed","in-progress","completed","cancelled"]);
          const status = azServiceBookingText(body.status, 40).toLowerCase();
          if (!allowed.has(status)) return send(res, 400, JSON.stringify({ ok:false, error:"Invalid booking status." }, null, 2), "application/json");
          const nowMs = Date.now();
          await ref.set({ status, updatedAt:new Date(nowMs).toISOString(), updatedAtMs:nowMs, updatedBy:azServiceBookingText(identity.email || identity.username || "admin", 120) }, { merge:true });
          return send(res, 200, JSON.stringify({ ok:true, action, bookingId, status }, null, 2), "application/json");
        }
        if (action === "final-price") {
          const finalPrice = Math.round((Number(body.finalPrice || body.amount || 0) || 0) * 100) / 100;
          if (!Number.isFinite(finalPrice) || finalPrice <= 0 || finalPrice > 1000000) return send(res, 400, JSON.stringify({ ok:false, error:"Final price must be more than RM0." }, null, 2), "application/json");
          const nowMs = Date.now();
          await ref.set({ finalPrice, finalPriceConfirmed:true, estimateFinal:true, status:"quoted", documentStage:"price_confirmed", quotedAt:new Date(nowMs).toISOString(), quotedAtMs:nowMs, updatedAt:new Date(nowMs).toISOString(), updatedAtMs:nowMs, updatedBy:azServiceBookingText(identity.email || identity.username || "admin", 120) }, { merge:true });
          return send(res, 200, JSON.stringify({ ok:true, action, bookingId, finalPrice, status:"quoted" }, null, 2), "application/json");
        }
        if (action === "link-invoice") {
          const invoiceDocId = azServiceBookingText(body.invoiceDocId, 180);
          const invoiceNo = azServiceBookingText(body.invoiceNo, 180);
          const receiptNo = azServiceBookingText(body.receiptNo, 180);
          const amount = Math.round((Number(body.amount || body.finalPrice || 0) || 0) * 100) / 100;
          if (!invoiceDocId || !invoiceNo) return send(res, 400, JSON.stringify({ ok:false, error:"Invoice document ID and invoice number are required." }, null, 2), "application/json");
          const invoiceStatusRaw = azServiceBookingText(body.invoiceStatus, 40).toLowerCase();
          const paymentStatusRaw = azServiceBookingText(body.paymentStatus, 40).toLowerCase();
          const invoiceStatus = new Set(["pending","paid","cancelled","refunded"]).has(invoiceStatusRaw) ? invoiceStatusRaw : "pending";
          const paymentStatus = new Set(["unpaid","paid","cancelled","refunded"]).has(paymentStatusRaw) ? paymentStatusRaw : (invoiceStatus === "paid" ? "paid" : "unpaid");
          const nowMs = Date.now();
          const serviceStatus = paymentStatus === "paid" ? "confirmed" : (invoiceStatus === "cancelled" ? "cancelled" : "quoted");
          await ref.set({ invoiceDocId, invoiceNo, receiptNo, invoiceStatus, paymentStatus, finalPrice:amount > 0 ? amount : null, finalPriceConfirmed:amount > 0, estimateFinal:amount > 0, status:serviceStatus, documentStage:paymentStatus === "paid" ? "invoice_paid" : "invoice_created", invoiceCreatedAt:new Date(nowMs).toISOString(), invoiceCreatedAtMs:nowMs, updatedAt:new Date(nowMs).toISOString(), updatedAtMs:nowMs, updatedBy:azServiceBookingText(identity.email || identity.username || "admin", 120) }, { merge:true });
          return send(res, 200, JSON.stringify({ ok:true, action, bookingId, invoiceDocId, invoiceNo, receiptNo, invoiceStatus, paymentStatus, amount, status:serviceStatus }, null, 2), "application/json");
        }
        return send(res, 400, JSON.stringify({ ok:false, error:"Unknown action." }, null, 2), "application/json");
      } catch (error) {
        return send(res, Number(error && error.statusCode) || 500, JSON.stringify({ ok:false, error:azServiceBookingText(error && error.message, 300) || "Service booking action failed." }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/service-bookings" && req.method === "POST") {
      try {
        const body = parseRequestBody(await readBody(req));
        const result = await azCreatePublicServiceBooking(req, body || {});
        return send(res, 200, JSON.stringify(result, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        const statusCode = Number(error && error.statusCode) || 500;
        return send(res, statusCode, JSON.stringify({ ok:false, error:azServiceBookingText(error && error.message, 300) || "Tempahan servis gagal disimpan." }, null, 2), "application/json", { "Cache-Control":"no-store" });
      }
    }

    // =========================
    // AZOBSS TECH VAULT 720 — R2 ONLY
    // =========================
    if (pathname === "/api/tech-vault/health" && req.method === "GET") {
      return send(res, 200, JSON.stringify(azTechVaultPublicInfo(), null, 2), "application/json", { "Cache-Control":"no-store" });
    }
    if (pathname === "/api/tech-vault/login" && req.method === "POST") {
      try {
        if (!azTechVaultPassword()) return send(res, 503, JSON.stringify({ ok:false, error:"AZOBSS_TECH_VAULT_PASSWORD is not configured on Render." }, null, 2), "application/json");
        const data = parseRequestBody(await readBody(req));
        if (!azTechVaultPasswordMatches(data.password)) return send(res, 401, JSON.stringify({ ok:false, error:"Incorrect password." }, null, 2), "application/json");
        const now = Math.floor(Date.now()/1000);
        const expiresAt = now + azTechVaultSessionHours() * 60 * 60;
        const token = azTechVaultSignPayload({ scope:"tech-vault", iat:now, exp:expiresAt, nonce:crypto.randomBytes(12).toString("hex") });
        return send(res, 200, JSON.stringify({ ok:true, token, expiresAt, expiresIn:expiresAt-now, patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        return send(res, 500, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || "Login failed." }, null, 2), "application/json");
      }
    }
    if (pathname === "/api/tech-vault/session" && req.method === "GET") {
      const session = azTechVaultSessionFromRequest(req);
      return send(res, session ? 200 : 401, JSON.stringify({ ok:Boolean(session), expiresAt:session ? session.exp : 0, patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
    }
    if (pathname === "/api/tech-vault/files" && req.method === "GET") {
      if (!azTechVaultSessionFromRequest(req)) return send(res, 401, JSON.stringify({ ok:false, error:"Tech Vault session required." }, null, 2), "application/json");
      const files = await azTechVaultListFiles();
      return send(res, 200, JSON.stringify({ ok:true, files, count:files.length, uploadEnabled:azR2Configured(), maxFileMb:Math.floor(azTechVaultMaxFileBytes()/1024/1024), patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
    }
    if (pathname === "/api/tech-vault/upload-token" && req.method === "POST") {
      if (!azTechVaultSessionFromRequest(req)) return send(res, 401, JSON.stringify({ ok:false, error:"Tech Vault session required." }, null, 2), "application/json");
      try {
        const data = parseRequestBody(await readBody(req));
        const upload = azTechVaultUploadToken(data.filename || data.name, data.size, data.contentType || data.type);
        return send(res, 200, JSON.stringify({ ok:true, upload, patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        const status = Number(error && error.statusCode) || 500;
        return send(res, status, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || "Upload token failed." }, null, 2), "application/json");
      }
    }
    if (pathname === "/api/tech-vault/register" && req.method === "POST") {
      if (!azTechVaultSessionFromRequest(req)) return send(res, 401, JSON.stringify({ ok:false, error:"Tech Vault session required." }, null, 2), "application/json");
      try {
        const data = parseRequestBody(await readBody(req));
        const upload = azTechVaultVerifyUploadToken(data.uploadToken || data.token);
        if (!upload) return send(res, 403, JSON.stringify({ ok:false, error:"Invalid or expired upload confirmation." }, null, 2), "application/json");
        const saved = await azTechVaultSaveFile({ id:upload.id, filename:upload.name, objectKey:upload.key, size:upload.size, contentType:upload.type, createdAtMs:Date.now(), createdAt:new Date().toISOString() });
        return send(res, 200, JSON.stringify({ ok:true, file:saved, patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        return send(res, 500, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || "File registration failed." }, null, 2), "application/json");
      }
    }
    if (pathname === "/api/tech-vault/delete" && req.method === "POST") {
      if (!azTechVaultSessionFromRequest(req)) return send(res, 401, JSON.stringify({ ok:false, error:"Tech Vault session required." }, null, 2), "application/json");
      try {
        const data = parseRequestBody(await readBody(req));
        const ids = Array.from(new Set((Array.isArray(data.ids) ? data.ids : [data.id]).map(value => cleanPremiumText(value || "", 180)).filter(Boolean))).slice(0, 100);
        if (!ids.length) return send(res, 400, JSON.stringify({ ok:false, error:"Select at least one R2 file to delete." }, null, 2), "application/json");
        const deleted = [];
        const failed = [];
        for (const id of ids) {
          try {
            const file = await azTechVaultFindFile(id);
            if (!file) throw Object.assign(new Error("File not found or already deleted."), { statusCode:404 });
            const result = await azTechVaultDeleteFile(file);
            deleted.push(result);
          } catch (error) {
            failed.push({ id, error:cleanPremiumText(error && error.message, 300) || "Delete failed." });
          }
        }
        const status = deleted.length ? 200 : 400;
        return send(res, status, JSON.stringify({ ok:Boolean(deleted.length), error:deleted.length ? "" : (failed[0] && failed[0].error) || "No files were deleted.", deleted, failed, deletedCount:deleted.length, failedCount:failed.length, patch:AZOBSS_TECH_VAULT_PATCH }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        return send(res, 500, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || "Delete request failed." }, null, 2), "application/json");
      }
    }
    if (pathname === "/api/tech-vault/download-token" && req.method === "POST") {
      if (!azTechVaultSessionFromRequest(req)) return send(res, 401, JSON.stringify({ ok:false, error:"Tech Vault session required." }, null, 2), "application/json");
      try {
        const data = parseRequestBody(await readBody(req));
        const file = await azTechVaultFindFile(data.id);
        if (!file) return send(res, 404, JSON.stringify({ ok:false, error:"File not found." }, null, 2), "application/json");
        const downloadUrl = azTechVaultDownloadUrl(file);
        if (!downloadUrl) return send(res, 503, JSON.stringify({ ok:false, error:"Private R2 download is not configured." }, null, 2), "application/json");
        return send(res, 200, JSON.stringify({ ok:true, mode:"r2", filename:file.filename, downloadUrl, expiresIn:3600 }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        return send(res, 500, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || "Download token failed." }, null, 2), "application/json");
      }
    }


    // AZOBSS 674: Stripe Checkout for premium Software / CAD only.
    if (pathname === "/api/stripe/digital-checkout-health" && req.method === "GET") {
      const configured = azStripeDigitalConfigured();
      return send(res, configured ? 200 : 503, JSON.stringify({
        ok:configured,
        service:'azobss-software-cad-stripe-checkout',
        configured,
        mode:azStripeDigitalMode(),
        scope:['Software','CAD Tools'],
        foodCheckout:false,
        webhookConfigured:azStripeWebhookConfigured(),
        webhookEndpoint:'/api/stripe/webhook',
        patch:'676',
        time:new Date().toISOString()
      }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
    }
    if (pathname === "/api/stripe/webhook-health" && req.method === "GET") {
      const configured = azStripeWebhookConfigured();
      return send(res, configured ? 200 : 503, JSON.stringify({
        ok:configured,
        service:'azobss-stripe-webhook',
        configured,
        mode:azStripeDigitalMode(),
        endpoint:'/api/stripe/webhook',
        events:[
          'checkout.session.completed',
          'checkout.session.async_payment_succeeded',
          'checkout.session.async_payment_failed'
        ],
        scope:['Software','CAD Tools'],
        patch:'676',
        time:new Date().toISOString()
      }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
    }
    if (pathname === "/api/stripe/webhook" && req.method === "POST") {
      try {
        if (!azStripeWebhookConfigured()) {
          return send(res, 503, JSON.stringify({ ok:false, error:'STRIPE_WEBHOOK_SECRET belum dikonfigurasi.' }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
        }
        const rawBody = await azReadStripeWebhookBody(req);
        const signatureCheck = azStripeWebhookSignatureValid(rawBody, req.headers['stripe-signature']);
        if (!signatureCheck.ok) {
          console.warn('Stripe webhook signature rejected:', signatureCheck.reason);
          return send(res, 400, JSON.stringify({ ok:false, error:'Invalid Stripe webhook signature.', reason:signatureCheck.reason }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
        }
        let event;
        try { event = JSON.parse(rawBody.toString('utf8')); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:'Invalid webhook JSON.' }, null, 2), 'application/json', { 'Cache-Control':'no-store' }); }
        const result = await azHandleStripeDigitalWebhookEvent(event, req);
        console.log('Stripe webhook handled:', cleanPremiumText(event && event.id, 220), cleanPremiumText(event && event.type, 120), result && result.reason ? result.reason : (result && result.paid ? 'paid' : 'ok'));
        return send(res, 200, JSON.stringify({ received:true, ...result }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
      } catch (error) {
        console.error('Stripe webhook error:', error && (error.stack || error.message || error));
        const status = Number(error && error.statusCode) || 500;
        return send(res, status, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message, 300) || 'Stripe webhook failed.' }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
      }
    }

    if (pathname === "/api/stripe/digital-checkout" && req.method === "POST") {
      try {
        const data = parseRequestBody(await readBody(req));
        const checkout = await azCreateDigitalStripeCheckout(data, req);
        return send(res, 200, JSON.stringify({ ok:true, success:true, ...checkout }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
      } catch (error) {
        console.error('Stripe digital checkout error:', error && (error.message || error));
        const status = Number(error && error.statusCode) || 500;
        return send(res, status, JSON.stringify({
          ok:false,
          success:false,
          error:cleanPremiumText(error && error.message, 400) || 'Stripe Checkout gagal dicipta.'
        }, null, 2), 'application/json', { 'Cache-Control':'no-store' });
      }
    }

    // =========================
    // TOYYIBPAY DYNAMIC PAYMENT ROUTES (Render deploy-server.js)
    // =========================

    if (pathname === "/api/pa-bm-checkout-capabilities" && req.method === "GET") {
      return send(res, 200, JSON.stringify({
        ok:true,
        version:8,
        purchaseLogAreaRatio:true,
        paidDownloadRouting:"category-specific-v1",
        perUserPriceCategories:["paBm","lotKadaster","publicPa","software","cadTools"],
        firestoreReadRetry:3,
        fastAdminTestPayment:true,
        lotSelectionCheckoutTtlDays:7,
        runningFile:"deploy-server.js",
        productTypes:["PA","BM","SBM","GPS","NDCDB","NDCDB_C3","SYIT_PIAWAI"],
        prices:{
          PA:5,
          BM:3,
          SBM:3,
          GPS:9,
          NDCDB_AREA_REFERENCE:{ ratioPercent:25, amount:15, minimumAmount:5, rounding:"nearest-ringgit-half-up" },
          NDCDB_FULL_SHEET_DISCOUNT:{ minimumRatioPercent:90, amount:50 },
          NDCDB_C3_AREA_REFERENCE:{ ratioPercent:25, amount:15, minimumAmount:5, rounding:"nearest-ringgit-half-up" },
          NDCDB_C3_FULL_SHEET_DISCOUNT:{ minimumRatioPercent:90, amount:50 },
          SYIT_PIAWAI:7
        },
        adminTestPayment:true,
        publicPaAdminTestPayment:true,
        publicPaAdminTestPaymentPatch:"516"
      }, null, 2), "application/json");
    }


    if (pathname === "/api/admin/test-pa-bm-payment" && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (_error) { return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Invalid request body" }), "application/json"); }
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, success:false, error:"Admin authorization required." }, null, 2), "application/json");
        }
        const checkout = azBuildAdminPaBmTestCheckout(data, adminIdentity);
        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const orderId = makeId("pabmtest");
        const paymentReference = `ADMIN-TEST-${nowMs}`;
        let order = upsertPremiumOrder({
          orderId,
          productId:"pa-bm-purchase-records",
          productName:`JUPEM Document Test Purchase (${checkout.items.length} unit)`,
          amount:`RM${checkout.totalAmount}`,
          amountSen:checkout.amountSen,
          status:"paid",
          paymentMethod:"admin-test",
          paymentReference,
          user:checkout.user,
          usernameKey:checkout.user.username,
          paBmItems:checkout.items,
          maxDownload:0,
          expiryHours:0,
          isAdminTestPayment:true,
          source:"admin-test-payment",
          createdByAdmin:adminIdentity.username || adminIdentity.email || adminIdentity.uid,
          createdAt:nowIso,
          createdAtMs:nowMs,
          paidAt:nowIso,
          paidAtMs:nowMs,
          paidFinalizedAt:nowIso,
          paymentVerifiedAt:nowIso,
          paymentVerificationSource:"admin-test-endpoint",
          commissionCheckedAt:nowIso,
          commissionSkippedReason:"admin-test-payment",
          emailSkippedForPaBm:true
        });
        const startedAtMs = Date.now();
        const [, syncResult] = await Promise.all([
          azPersistPremiumOrder(order),
          azobssUpdatePaBmPurchaseLogsForOrder(order, "paid", { paymentReference, paidAtMs:nowMs, nowMs })
        ]);
        const purchaseSyncMs = Date.now() - startedAtMs;
        order = upsertPremiumOrder({
          ...order,
          paBmPaidSyncedAt:nowIso,
          paBmPaidSyncedCount:Number(syncResult && syncResult.updated || 0)
        });
        await azPersistPremiumOrder(order);
        azFireAndForget(
          azWriteAdminAuditLog(req, adminIdentity, "admin_test_pa_bm_payment", "premiumOrders", orderId, {
            itemCount:checkout.items.length,
            totalAmount:checkout.totalAmount,
            paymentReference
          }, "success"),
          "Admin PA/BM test payment audit log failed"
        );
        return send(res, 200, JSON.stringify({
          ok:true,
          success:true,
          paid:true,
          status:"paid",
          testPayment:true,
          orderId,
          paymentReference,
          amount:checkout.totalAmount,
          amountSen:checkout.amountSen,
          unit:checkout.items.length,
          updatedCount:Number(syncResult && syncResult.updated || 0),
          processingMs:Date.now() - startedAtMs,
          purchaseSyncMs
        }, null, 2), "application/json");
      } catch (error) {
        const statusCode = Math.max(400, Math.min(500, Number(error && error.statusCode || 500)));
        console.error("Admin PA/BM test payment failed:", error && (error.stack || error.message || error));
        return send(res, statusCode, JSON.stringify({ ok:false, success:false, error:error.message || "Admin test payment failed." }, null, 2), "application/json");
      }
    }


    if (pathname === "/api/admin/test-public-pa-payment" && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (_) { return send(res, 400, JSON.stringify({ok:false,success:false,error:"Invalid request body"}), "application/json"); }
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ok:false,success:false,error:"Admin authorization required."}), "application/json");

        const paNumber = String(data.paNumber || data.noPA || data.pa || '').replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'').slice(0,12);
        const negeri = cleanState(data.negeri || data.state || '');
        const allowedStates = new Set(["JOHOR","KEDAH","KELANTAN","MELAKA","NEGERI SEMBILAN","PAHANG","PERAK","PERLIS","PULAU PINANG","SABAH","SARAWAK","SELANGOR","TERENGGANU","WILAYAH PERSEKUTUAN KUALA LUMPUR","WILAYAH PERSEKUTUAN LABUAN","WILAYAH PERSEKUTUAN PUTRAJAYA"]);
        if (!/^\d{1,12}$/.test(paNumber)) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nombor PA yang sah."}), "application/json");
        if (!allowedStates.has(negeri)) return send(res, 400, JSON.stringify({ok:false,error:"Pilih negeri yang sah."}), "application/json");
        const check = await fetchPelanAkuiCandidates(`PA${paNumber}.TIF`, negeri);
        if (!check || !check.validFile) return send(res, 404, JSON.stringify({ok:false,error:`PA ${paNumber} tidak ditemui untuk negeri yang dipilih.`}), "application/json");

        const submitted = getPremiumUser(data);
        const buyerName = cleanPremiumText(data.buyerName || data.name || adminIdentity.username || submitted.username || 'Admin Test',80);
        const buyerEmail = cleanPremiumText(data.buyerEmail || data.email || adminIdentity.authEmail || adminIdentity.email || submitted.email || '',180).toLowerCase();
        const buyerPhone = cleanPremiumText(data.buyerPhone || data.phone || submitted.phone || '',30).replace(/[^0-9+]/g,'');
        if (buyerName.length < 2) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nama pembeli."}), "application/json");
        if (!azValidEmailLike(buyerEmail) || azIsLocalEmail(buyerEmail)) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan alamat e-mel sebenar yang sah."}), "application/json");
        if (buyerPhone.replace(/\D/g,'').length < 8) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nombor telefon yang sah."}), "application/json");

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const orderId = makeId('publicpatest');
        const recordId = `${orderId}-1`;
        const paymentReference = `ADMIN-PUBLIC-PA-TEST-${nowMs}`;
        const apiBase = publicBaseUrlFromReq(req);
        const usernameKey = cleanPremiumText(adminIdentity.username || submitted.username || 'admin',80).toLowerCase();
        const uid = cleanPremiumText(adminIdentity.uid || 'admin-test',120);
        const item = {id:recordId,firestoreId:recordId,productType:'PA',itemCode:paNumber,negeri,amount:30,filename:`PA${paNumber}.pdf`,downloadUrl:`${apiBase}/api/pa-pdf?noPA=PA${encodeURIComponent(paNumber)}.TIF&negeri=${encodeURIComponent(negeri)}`,createdAtMs:nowMs,publicPaPurchase:true};
        let order = upsertPremiumOrder({
          orderId,productId:'public-pa-rm30',productName:`Pelan Akui PA${paNumber}`,amount:'RM30',amountSen:3000,saleAmount:30,saleAmountText:'RM30.00',
          status:'paid',paymentMethod:'admin-test',paymentReference,billCode:'',paymentUrl:'',returnUrl:'',
          user:{uid,username:usernameKey,usernameKey,email:buyerEmail,authEmail:adminIdentity.authEmail || adminIdentity.email || '',phone:buyerPhone,displayName:buyerName},
          email:buyerEmail,buyerEmail,phone:buyerPhone,paBmItems:[item],publicPaPurchase:true,publicPaRecordId:recordId,publicPaPriceRm:30,
          source:'admin-test-public-pa',maxDownload:5,maxDownloads:5,expiryHours:168,isAdminTestPayment:true,testPayment:true,
          createdByAdmin:adminIdentity.username || adminIdentity.email || adminIdentity.uid || 'admin',createdAt:nowIso,createdAtMs:nowMs,paidAt:nowIso,paidAtMs:nowMs,
          paidFinalizedAt:nowIso,paymentVerifiedAt:nowIso,paymentVerificationSource:'admin-test-endpoint',commissionCheckedAt:nowIso,
          commissionSkippedReason:'admin-test-payment',emailSkippedForPaBm:true,publicPaEmailSkipped:true
        });
        const startedAtMs = Date.now();
        const [, syncResult] = await Promise.all([
          azPersistPremiumOrder(order),
          azobssUpdatePaBmPurchaseLogsForOrder(order,'paid',{paymentReference,paidAtMs:nowMs,nowMs})
        ]);
        order = upsertPremiumOrder({...order,paBmPaidSyncedAt:nowIso,paBmPaidSyncedCount:Number(syncResult && syncResult.updated || 0)});
        await azPersistPremiumOrder(order);
        azFireAndForget(azWriteAdminAuditLog(req,adminIdentity,'admin_test_public_pa_payment','premiumOrders',orderId,{paNumber,negeri,amount:30,paymentReference},'success'),'Admin public PA test payment audit log failed');
        return send(res, 200, JSON.stringify({
          ok:true,success:true,paid:true,status:'paid',testPayment:true,publicPa:true,paBm:true,routeVersion:'559',orderId,recordId,paymentReference,
          amount:30,amountSen:3000,unit:1,updatedCount:Number(syncResult && syncResult.updated || 0),
          downloadUrl:azPublicPaDownloadUrl(order,req),receiptUrl:azReceiptUrl(apiBase,order),emailSent:false,commissionCreated:false,
          processingMs:Date.now()-startedAtMs
        }, null, 2), "application/json");
      } catch (error) {
        const statusCode = Math.max(400, Math.min(500, Number(error && error.statusCode || 500)));
        console.error("Admin public PA test payment failed:", error && (error.stack || error.message || error));
        return send(res, statusCode, JSON.stringify({ok:false,success:false,error:error && error.message ? error.message : "Admin public PA test payment failed."}, null, 2), "application/json");
      }
    }

    if (pathname === "/api/toyyib/create-public-pa-bill" && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (_) { return send(res, 400, JSON.stringify({ok:false,error:"Invalid request body"}), "application/json"); }
      try {
        if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) return send(res, 500, JSON.stringify({ok:false,error:"ToyyibPay env belum lengkap di Render."}), "application/json");
        const paNumber = String(data.paNumber || data.noPA || data.pa || '').replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'').slice(0,12);
        const negeri = cleanState(data.negeri || data.state || '');
        const allowedStates = new Set(["JOHOR","KEDAH","KELANTAN","MELAKA","NEGERI SEMBILAN","PAHANG","PERAK","PERLIS","PULAU PINANG","SABAH","SARAWAK","SELANGOR","TERENGGANU","WILAYAH PERSEKUTUAN KUALA LUMPUR","WILAYAH PERSEKUTUAN LABUAN","WILAYAH PERSEKUTUAN PUTRAJAYA"]);
        if (!/^\d{1,12}$/.test(paNumber)) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nombor PA yang sah."}), "application/json");
        if (!allowedStates.has(negeri)) return send(res, 400, JSON.stringify({ok:false,error:"Pilih negeri yang sah."}), "application/json");
        const check = await fetchPelanAkuiCandidates(`PA${paNumber}.TIF`, negeri);
        if (!check || !check.validFile) return send(res, 404, JSON.stringify({ok:false,error:`PA ${paNumber} tidak ditemui untuk negeri yang dipilih.`}), "application/json");
        let identity = null;
        try { identity = await azCommissionIdentityFromRequest(req); } catch (_) { identity = null; }
        const submitted = getPremiumUser(data);
        const buyerName = cleanPremiumText(data.buyerName || data.name || identity?.username || submitted.username || 'Guest', 80);
        const buyerEmail = cleanPremiumText(identity?.authEmail || identity?.email || data.buyerEmail || data.email || submitted.email || '', 180).toLowerCase();
        const buyerPhone = cleanPremiumText(data.buyerPhone || data.phone || submitted.phone || '', 30).replace(/[^0-9+]/g,'');
        if (buyerName.length < 2) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nama pembeli."}), "application/json");
        if (!azValidEmailLike(buyerEmail) || azIsLocalEmail(buyerEmail)) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan alamat e-mel sebenar yang sah."}), "application/json");
        if (buyerPhone.replace(/\D/g,'').length < 8) return send(res, 400, JSON.stringify({ok:false,error:"Masukkan nombor telefon yang sah."}), "application/json");
        const emailHash = crypto.createHash('sha256').update(buyerEmail).digest('hex').slice(0,18);
        const usernameKey = cleanPremiumText(identity?.username || submitted.username || `publicpa_${emailHash}`, 80).toLowerCase();
        const uid = cleanPremiumText(identity?.uid || `guest_${emailHash}`, 120);
        const orderId = makeId('publicpa');
        const recordId = `${orderId}-1`;
        const baseAmount = 30;
        const priceAdjustmentPercent = identity ? azIdentityPriceAdjustment(identity, "publicPa") : 0;
        const amount = identity ? azApplyUserPriceAdjustment(baseAmount, identity, "publicPa") : baseAmount;
        const amountSen = Math.round(amount * 100);
        const apiBase = publicBaseUrlFromReq(req);
        const returnUrl = `${FRONTEND_BASE_URL}/Beli-Pelan-Akui/?payment=return&orderId=${encodeURIComponent(orderId)}`;
        const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
        const item = { id:recordId, firestoreId:recordId, productType:'PA', itemCode:paNumber, negeri, baseAmount, amount, priceAdjustmentPercent, filename:`PA${paNumber}.pdf`, downloadUrl:`${apiBase}/api/pa-pdf?noPA=PA${encodeURIComponent(paNumber)}.TIF&negeri=${encodeURIComponent(negeri)}`, createdAtMs:Date.now(), publicPaPurchase:true };
        const billPayload = { userSecretKey:TOYYIB_SECRET_KEY, categoryCode:TOYYIB_CATEGORY_CODE, billName:cleanForToyyib(`Pelan Akui PA${paNumber}`,30), billDescription:cleanForToyyib(`AZOBSS Public Pelan Akui PA${paNumber} - ${azAdjustedMoneyText(amount)}`,100), billPriceSetting:1, billPayorInfo:1, billAmount:amountSen, billReturnUrl:returnUrl, billCallbackUrl:callbackUrl, billExternalReferenceNo:orderId, billTo:cleanForToyyib(buyerName,30), billEmail:cleanForToyyib(buyerEmail,80), billPhone:cleanForToyyib(buyerPhone,20), billSplitPayment:0, billSplitPaymentArgs:'', billPaymentChannel:0, billContentEmail:`Terima kasih. Pembelian Pelan Akui PA${paNumber} berjumlah ${azAdjustedMoneyText(amount)}.`, billChargeToCustomer:1, billExpiryDays:3, enableDuitNowQR:1, chargeDuitNowQR:0 };
        const apiResult = await postToyyib('createBill', billPayload);
        const billCode = Array.isArray(apiResult) ? (apiResult[0] && (apiResult[0].BillCode || apiResult[0].billCode)) : (apiResult && (apiResult.BillCode || apiResult.billCode));
        if (!billCode) return send(res, 502, JSON.stringify({ok:false,error:"ToyyibPay tidak return BillCode.",raw:apiResult}), "application/json");
        const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
        let order = upsertPremiumOrder({ orderId, productId:'public-pa-rm30', productName:`Pelan Akui PA${paNumber}`, amount:azAdjustedMoneyText(amount), amountSen, baseAmount, baseAmountSen:3000, saleAmount:amount, saleAmountText:azAdjustedMoneyText(amount), priceAdjustmentPercent, status:'pending', paymentMethod:'toyyibpay', paymentReference:'', billCode, paymentUrl, returnUrl, user:{uid,username:usernameKey,usernameKey,email:buyerEmail,authEmail:identity?.authEmail||'',phone:buyerPhone,displayName:buyerName}, email:buyerEmail, buyerEmail, phone:buyerPhone, paBmItems:[item], publicPaPurchase:true, publicPaRecordId:recordId, publicPaPriceRm:amount, source:'public-pa-rm30', maxDownload:5, maxDownloads:5, expiryHours:168, createdAt:new Date().toISOString(), createdAtMs:Date.now(), commissionSkippedReason:'public-pa-service' });
        try { await azPersistPremiumOrder(order); } catch (e) { console.warn('Public PA order persist skipped:',e&&e.message); }
        try { await azobssUpdatePaBmPurchaseLogsForOrder(order,'pending'); } catch (e) { console.warn('Public PA pending log sync skipped:',e&&e.message); }
        return send(res, 200, JSON.stringify({ok:true,success:true,orderId,billCode,paymentUrl,url:paymentUrl,redirectUrl:paymentUrl,status:'pending',amount,amountSen,unit:1,productId:'public-pa-rm30'}), "application/json");
      } catch (e) {
        console.error('Create public PA bill failed:', e && (e.stack || e.message || e));
        return send(res, 500, JSON.stringify({ok:false,error:e&&e.message?e.message:'Failed create public PA bill'}), "application/json");
      }
    }

    if (pathname === "/api/toyyib/create-pa-bm-bill" && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (e) { return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Invalid request body" }), "application/json"); }
      try {
        if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
          return send(res, 500, JSON.stringify({ ok:false, success:false, error:"ToyyibPay env belum lengkap. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." }, null, 2), "application/json");
        }
        const identity = await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) {
          return send(res, 401, JSON.stringify({ ok:false, success:false, error:"Please login again before proceeding to payment." }, null, 2), "application/json");
        }
        const submittedUser = getPremiumUser(data);
        const user = {
          uid: cleanPremiumText(identity.uid, 120),
          username: cleanPremiumText(identity.username || data.usernameKey || submittedUser.username || "", 80).toLowerCase(),
          email: cleanPremiumText(identity.authEmail || identity.email || submittedUser.email || "", 160),
          authEmail: cleanPremiumText(identity.authEmail || identity.email || "", 160),
          phone: cleanPremiumText(submittedUser.phone || "", 40)
        };
        const usernameKey = user.username;
        const uid = user.uid;
        const rawItems = Array.isArray(data.items) ? data.items : [];
        if (!rawItems.length || rawItems.length > 50) {
          return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Cart must contain between 1 and 50 documents." }, null, 2), "application/json");
        }
        const allowedStates = new Set([
          "JOHOR","KEDAH","KELANTAN","MELAKA","NEGERI SEMBILAN","PAHANG","PERAK","PERLIS",
          "PULAU PINANG","SABAH","SARAWAK","SELANGOR","TERENGGANU",
          "WILAYAH PERSEKUTUAN KUALA LUMPUR","WILAYAH PERSEKUTUAN LABUAN","WILAYAH PERSEKUTUAN PUTRAJAYA"
        ]);
        const allowedProductTypes = new Set(["PA","BM","SBM","GPS","NDCDB","NDCDB_C3","SYIT_PIAWAI"]);
        const areaProductTypes = new Set(["NDCDB","NDCDB_C3"]);
        const seenItems = new Set();
        const items = [];
        const priceAdjustmentByCategory = {
          paBm: azIdentityPriceAdjustment(identity, "paBm"),
          lotKadaster: azIdentityPriceAdjustment(identity, "lotKadaster")
        };
        for (const rawItem of rawItems) {
          const productType = cleanPremiumText(rawItem.productType || "PA", 20).toUpperCase();
          if (!allowedProductTypes.has(productType)) {
            return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Unsupported JUPEM document category." }, null, 2), "application/json");
          }
          const negeri = cleanPremiumText(rawItem.negeri || "", 80).toUpperCase();
          if (!allowedStates.has(negeri)) {
            return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Please select a valid state for every document." }, null, 2), "application/json");
          }
          const rawItemCode = cleanPremiumText(rawItem.itemCode || rawItem.stationNo || rawItem.productId || "", 80);
          let itemCode = areaProductTypes.has(productType) ? rawItemCode : rawItemCode.toUpperCase();
          if (productType === "PA") itemCode = itemCode.replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
          if (!itemCode || (productType === "PA" && !/^\d{1,12}$/.test(itemCode))) {
            return send(res, 400, JSON.stringify({ ok:false, success:false, error:"A valid document number is required for every cart item." }, null, 2), "application/json");
          }
          let variant = areaProductTypes.has(productType)
            ? cleanPremiumText(rawItem.variant || rawItem.areaSize || "", 30).toUpperCase()
            : "";
          if (areaProductTypes.has(productType) && variant !== "FULL_SHEET" && variant !== "AREA_BASED") {
            return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Lot Kadaster area pricing is invalid. Open the selection map again." }, null, 2), "application/json");
          }
          const verifiedLot = areaProductTypes.has(productType)
            ? azobssVerifiedLotCheckout(rawItem, productType, negeri, itemCode)
            : null;
          if (areaProductTypes.has(productType) && !verifiedLot) {
            return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Lot Kadaster selection is missing or has expired. Open the selection map again." }, null, 2), "application/json");
          }
          if (verifiedLot) variant = verifiedLot.variant;
          let amount = 0;
          if (productType === "PA") amount = 5;
          else if (productType === "BM" || productType === "SBM") amount = 3;
          else if (productType === "GPS") amount = 9;
          else if (productType === "SYIT_PIAWAI") amount = 7;
          else if (areaProductTypes.has(productType)) amount = verifiedLot.amount;
          const baseAmount = amount;
          const priceAdjustmentCategory = areaProductTypes.has(productType) ? "lotKadaster" : "paBm";
          const priceAdjustmentPercent = priceAdjustmentByCategory[priceAdjustmentCategory] || 0;
          amount = azApplyUserPriceAdjustment(baseAmount, identity, priceAdjustmentCategory);
          const uniqueKey = `${productType}|${itemCode}|${negeri}|${variant}`;
          if (seenItems.has(uniqueKey)) continue;
          seenItems.add(uniqueKey);
          items.push({
            productType,
            itemCode,
            negeri,
            baseAmount,
            amount,
            priceAdjustmentCategory,
            priceAdjustmentPercent,
            variant,
            areaRatio: areaProductTypes.has(productType) ? Number(verifiedLot && verifiedLot.areaRatio || 0) : undefined,
            productId: cleanPremiumText(verifiedLot && verifiedLot.jobId || rawItem.productId || "", 120),
            stationNo: cleanPremiumText(rawItem.stationNo || "", 80).toUpperCase(),
            jenis: productType === "SBM" ? "2" : "1",
            filename: cleanPremiumText(rawItem.filename || "", 180),
            downloadUrl: verifiedLot ? verifiedLot.downloadUrl : azobssSafeJupemDownloadUrl(rawItem.downloadUrl || rawItem.url, productType),
            createdAtMs: Number(rawItem.createdAtMs || 0) || Date.now()
          });
        }
        if (!items.length) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"No valid JUPEM documents were found in the cart." }, null, 2), "application/json");
        const baseTotalAmount = Math.round((items.reduce((sum, item) => sum + Number(item.baseAmount || 0), 0) + Number.EPSILON) * 100) / 100;
        const totalAmount = Math.round((items.reduce((sum, item) => sum + item.amount, 0) + Number.EPSILON) * 100) / 100;
        if (totalAmount <= 0) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Total bayaran tidak sah." }, null, 2), "application/json");
        const amountSen = Math.round(totalAmount * 100);
        const orderId = makeId("pabm");
        const apiBase = publicBaseUrlFromReq(req);
        const returnUrl = TOYYIB_RETURN_URL || `${FRONTEND_BASE_URL}/PA-BM/?payment=return&orderId=${encodeURIComponent(orderId)}`;
        const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
        const productName = azobssJupemPurchaseProductName(items) || `PA/BM (${items.length} unit)`;
        const billPayload = {
          userSecretKey: TOYYIB_SECRET_KEY,
          categoryCode: TOYYIB_CATEGORY_CODE,
          billName: cleanForToyyib("AZOBSS JUPEM", 30),
          billDescription: cleanForToyyib(`AZOBSS JUPEM Payment - ${items.length} unit - RM${totalAmount}`, 100),
          billPriceSetting: 1,
          billPayorInfo: 1,
          billAmount: amountSen,
          billReturnUrl: returnUrl,
          billCallbackUrl: callbackUrl,
          billExternalReferenceNo: orderId,
          billTo: cleanForToyyib(user.username || usernameKey || user.email || "AZOBSS Customer", 30),
          billEmail: cleanForToyyib(user.email || data.buyerEmail || data.email || "customer@azobss.com", 80),
          billPhone: cleanForToyyib(user.phone || data.buyerPhone || data.phone || "01135600723", 20),
          billSplitPayment: 0,
          billSplitPaymentArgs: "",
          billPaymentChannel: 0,
          billContentEmail: `Thank you for your AZOBSS JUPEM document payment. Total: RM${totalAmount}.`,
          billChargeToCustomer: 1,
          billExpiryDays: 3,
          enableDuitNowQR: 1,
          chargeDuitNowQR: 0
        };
        const apiResult = await postToyyib("createBill", billPayload);
        const billCode = Array.isArray(apiResult) ? (apiResult[0] && (apiResult[0].BillCode || apiResult[0].billCode)) : (apiResult && apiResult.BillCode);
        if (!billCode) {
          const detail = Array.isArray(apiResult) ? (apiResult[0] || {}) : apiResult;
          const msg = (detail && (detail.msg || detail.Message || detail.error || detail.Error || detail.status)) || "ToyyibPay tidak return BillCode.";
          return send(res, 502, JSON.stringify({ ok:false, success:false, error:String(msg), raw: apiResult }, null, 2), "application/json");
        }
        const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
        const usedPercents = [...new Set(items.map(item => Number(item.priceAdjustmentPercent || 0)))];
        const priceAdjustmentPercent = usedPercents.length === 1 ? usedPercents[0] : 0;
        const paBmOrder = upsertPremiumOrder({ orderId, productId:"pa-bm-purchase-records", productName, amount:azAdjustedMoneyText(totalAmount), amountSen, baseAmount:baseTotalAmount, baseAmountSen:Math.round(baseTotalAmount*100), saleAmount:totalAmount, saleAmountText:azAdjustedMoneyText(totalAmount), priceAdjustmentPercent, priceAdjustmentByCategory, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, user:{...user, username: usernameKey || user.username, uid}, paBmItems:items, maxDownload:0, expiryHours:0, createdAt:new Date().toISOString() });
        try { await azPersistPremiumOrder(paBmOrder); } catch (persistError) { console.warn("PA/BM premium order Firestore persist failed before redirect:", persistError && (persistError.message || persistError)); }
        try { await azobssUpdatePaBmPurchaseLogsForOrder(paBmOrder, "pending"); } catch (syncError) { console.warn("PA/BM purchaseLogs pending sync failed:", syncError && (syncError.message || syncError)); }
        return send(res, 200, JSON.stringify({ ok:true, success:true, orderId, billCode, paymentUrl, url:paymentUrl, redirectUrl:paymentUrl, amount:totalAmount, amountSen, baseAmount:baseTotalAmount, baseAmountSen:Math.round(baseTotalAmount*100), priceAdjustmentPercent, priceAdjustmentByCategory, unit:items.length, status:"pending" }, null, 2), "application/json");
      } catch (e) {
        console.error("Create PA/BM ToyyibPay bill failed:", e.message);
        return send(res, 500, JSON.stringify({ ok:false, success:false, error:e.message || "Failed create PA/BM ToyyibPay bill" }, null, 2), "application/json");
      }
    }

    if ((pathname === "/api/toyyib/create-bill" || pathname === "/api/create-payment") && req.method === "GET") {
      return send(res, 405, JSON.stringify({ ok:false, error:"Use POST for this endpoint." }, null, 2), "application/json");
    }

    if ((pathname === "/api/toyyib/create-bill" || pathname === "/api/create-payment") && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (e) { return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Invalid request body" }), "application/json"); }

      try {
        if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
          return send(res, 500, JSON.stringify({ ok:false, success:false, error:"ToyyibPay env belum lengkap. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." }, null, 2), "application/json");
        }
        const requestedProduct = data.product || {};
        const trustedResolved = await azResolveTrustedPremiumProduct(data, req);
        const product = trustedResolved.product || {};
        const activationPlan = trustedResolved.subscriptionPlan || product.subscriptionPlan || product.selectedSubscriptionPlan || null;
        const baseProductName = cleanPremiumText(product.name || product.productName || data.productName || data.title || "AZOBSS Digital Product", 130);
        const productName = cleanPremiumText(activationPlan ? `${baseProductName} (${activationPlan.label || activationPlan.id})` : baseProductName, 160);
        const productId = cleanPremiumText(product.productId || product.id || data.productId || requestedProduct.productId || requestedProduct.id || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), 160);
        const baseAmountText = cleanPremiumText(trustedResolved.amountText || product.price || "", 40);
        const baseAmountSen = Number(trustedResolved.amountSen || parseAmountToSen(baseAmountText));
        const baseAmount = baseAmountSen / 100;
        const identity = await azCommissionIdentityFromRequest(req);
        const priceAdjustmentCategory = azTrustedPremiumPriceCategory(trustedResolved, product);
        const priceAdjustmentPercent = identity ? azIdentityPriceAdjustment(identity, priceAdjustmentCategory) : 0;
        const adjustedAmount = identity ? azApplyUserPriceAdjustment(baseAmount, identity, priceAdjustmentCategory) : baseAmount;
        const amountSen = Math.round(adjustedAmount * 100);
        const amountText = azAdjustedMoneyText(adjustedAmount);
        const downloadLink = cleanPremiumUrl(trustedResolved.downloadLink || product.secureDownloadLink || product.premiumDownloadFileLink || product.privateDownloadLink || product.downloadLink || "");
        const r2ObjectKey = azSafeR2ObjectKey(trustedResolved.r2ObjectKey || product.r2ObjectKey || product.r2Key || requestedProduct.r2ObjectKey || requestedProduct.r2Key || data.r2ObjectKey || data.r2Key || "");
        const submittedUser = getPremiumUser(data);
        const user = identity ? { ...submittedUser, uid:identity.uid || submittedUser.uid, username:identity.username || submittedUser.username, email:identity.authEmail || identity.email || submittedUser.email } : submittedUser;
        const requestedLimit = azobssDownloadLimitFromOrder({ ...data, product });
        const requestedExpiryHours = azobssExpiryHoursFromOrder({ ...data, product });
        if (!productName || !amountSen) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Missing backend product name or valid backend amount." }, null, 2), "application/json");
        if (!downloadLink && !r2ObjectKey) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Premium Download File Link atau Cloudflare R2 Private Object Key belum diset untuk produk ini." }, null, 2), "application/json");
        const orderId = makeId("tp");
        const apiBase = publicBaseUrlFromReq(req);
        const requestedReturnUrl = cleanPremiumUrl(data.returnUrl || data.redirectUrl || data.successUrl || "");
        const returnUrl = requestedReturnUrl || TOYYIB_RETURN_URL || `${FRONTEND_BASE_URL}/Software-Tools/?payment=return&orderId=${encodeURIComponent(orderId)}`;
        const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
        const billPayload = {
          userSecretKey: TOYYIB_SECRET_KEY,
          categoryCode: TOYYIB_CATEGORY_CODE,
          billName: cleanForToyyib(productName, 30) || "AZOBSS Digital",
          billDescription: cleanForToyyib(`AZOBSS Digital Software & Tools Payment - ${productName}`, 100),
          billPriceSetting: 1,
          billPayorInfo: 1,
          billAmount: amountSen,
          billReturnUrl: returnUrl,
          billCallbackUrl: callbackUrl,
          billExternalReferenceNo: orderId,
          billTo: cleanForToyyib(user.username || user.email || "AZOBSS Customer", 30),
          billEmail: cleanForToyyib(user.email || data.buyerEmail || data.email || "customer@azobss.com", 80),
          billPhone: cleanForToyyib(user.phone || data.buyerPhone || data.phone || "01135600723", 20),
          billSplitPayment: 0,
          billSplitPaymentArgs: "",
          billPaymentChannel: 0,
          billContentEmail: `Thank you for purchasing ${cleanForToyyib(productName, 60)} from AZOBSS.`,
          billChargeToCustomer: 1,
          billExpiryDays: 3,
          enableDuitNowQR: 1,
          chargeDuitNowQR: 0
        };
        const apiResult = await postToyyib("createBill", billPayload);
        console.log("ToyyibPay createBill response:", JSON.stringify(apiResult).slice(0, 1000));
        const billCode = Array.isArray(apiResult) ? (apiResult[0] && (apiResult[0].BillCode || apiResult[0].billCode)) : (apiResult && apiResult.BillCode);
        if (!billCode) {
          const detail = Array.isArray(apiResult) ? (apiResult[0] || {}) : apiResult;
          const msg = (detail && (detail.msg || detail.Message || detail.error || detail.Error || detail.status)) || "ToyyibPay tidak return BillCode.";
          console.error("ToyyibPay no BillCode detail:", JSON.stringify(apiResult).slice(0, 1500));
          return send(res, 502, JSON.stringify({ ok:false, success:false, error:String(msg), raw: apiResult }, null, 2), "application/json");
        }
        const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
        upsertPremiumOrder({ orderId, productId, productName, amount: amountText, amountSen, baseAmount, baseAmountSen, saleAmount: adjustedAmount, saleAmountText: amountText, priceAdjustmentPercent, priceAdjustmentCategory, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, returnUrl, sourceUrl: data.sourceUrl || data.pageUrl || "", pageUrl: data.pageUrl || data.sourceUrl || "", user, email:user.email || data.buyerEmail || data.email || "", buyerEmail:user.email || data.buyerEmail || data.email || "", product:{ ...product, id:productId, productId, name:productName, basePrice:baseAmountText, price:amountText, priceAdjustmentPercent, priceAdjustmentCategory, downloadLimit:requestedLimit, maxDownload:requestedLimit, maxDownloads:requestedLimit, expiryHours:requestedExpiryHours, linkExpiryHours:requestedExpiryHours, subscriptionCodeEnabled:!!trustedResolved.subscriptionCodeEnabled, activationCodeSale:!!trustedResolved.subscriptionCodeEnabled, subscriptionPlan:activationPlan, subscriptionPlanId:activationPlan&&activationPlan.id, activationCodePrefix:azActivationCodePrefix(product), r2ObjectKey, r2Key:r2ObjectKey }, subscriptionCodeEnabled:!!trustedResolved.subscriptionCodeEnabled, activationCodeSale:!!trustedResolved.subscriptionCodeEnabled, subscriptionPlan:activationPlan, subscriptionPlanId:activationPlan&&activationPlan.id, subscriptionPlanLabel:activationPlan&&(activationPlan.label||activationPlan.id), subscriptionDurationDays:activationPlan&&activationPlan.durationDays, subscriptionMonths:activationPlan&&activationPlan.months, activationCodePrefix:azActivationCodePrefix(product), trustedProductSource: trustedResolved.trustedSource || "backend", isAdminTestPurchase: !!trustedResolved.isAdminTestPurchase, clientPriceIgnored: cleanPremiumText(requestedProduct.price || data.amount || data.price || "", 40), shareReferral:azReferralFrom(data, product, {productId, returnUrl}), productOwner:azProductOwnerFrom(product, {productId}), premiumDownloadFileLink: downloadLink, downloadLink, r2ObjectKey, r2Key:r2ObjectKey, downloadLimit:requestedLimit, maxDownload:requestedLimit, maxDownloads:requestedLimit, expiryHours:requestedExpiryHours, linkExpiryHours:requestedExpiryHours, receiptTokenRequired:true, receiptTokenVersion:2, createdAt:new Date().toISOString() });
        return send(res, 200, JSON.stringify({ ok:true, success:true, orderId, billCode, paymentUrl, url: paymentUrl, redirectUrl: paymentUrl, status:"pending", amount:adjustedAmount, amountSen, baseAmount, baseAmountSen, priceAdjustmentPercent, priceAdjustmentCategory }, null, 2), "application/json");
      } catch (e) {
        console.error("Create ToyyibPay bill failed:", e.message);
        return send(res, 500, JSON.stringify({ ok:false, success:false, error:e.message || "Failed create ToyyibPay bill" }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/verify-payment" && req.method === "GET") {
      const billCode = cleanPremiumText(parsed.query.billCode || parsed.query.billcode || "", 100);
      const orderId = cleanPremiumText(parsed.query.orderId || parsed.query.order_id || "", 160);
      let order = await findPremiumOrderByAnyDeep({ orderId, billCode });
      if (!order) return send(res, 404, JSON.stringify({ ok:false, paid:false, verified:false, status:"order_not_found", error:"Order not found" }, null, 2), "application/json");

      const isToyyibOrder = !!(order.billCode || billCode || String(order.paymentMethod || "").toLowerCase().includes("toyyib"));
      const isStripeOrder = !isToyyibOrder && !!(order.stripeCheckoutSessionId || order.stripeSessionId || String(order.paymentMethod || "").toLowerCase().includes("stripe"));
      let verified = false;
      let verifyResult = null;

      if (isToyyibOrder) {
        verifyResult = await azVerifyToyyibPaidTransaction({ ...order, billCode: order.billCode || billCode });
        if (verifyResult && verifyResult.paid) {
          verified = true;
          order = await azFinalizePaidOrderOnce(order, req, {
            verified: true,
            toyyibTransaction: verifyResult.tx,
            paymentReference: verifyResult.paymentReference || order.paymentReference || ""
          });
          order = await findPremiumOrderByAnyDeep({ orderId: order.orderId || orderId, billCode: order.billCode || billCode }) || order;
        } else {
          // Safety: local status can never unlock software/CAD unless ToyyibPay API confirms paid.
          // This prevents cancelled/abandoned payment returns from sending download links or receipts.
          if (String(order.status || "").toLowerCase() === "paid" && !order.toyyibVerifiedAt) {
            try {
              order = upsertPremiumOrder({ ...order, status:"pending", paymentVerificationBlockedAt:new Date().toISOString(), previousUnsafeStatus:"paid", paymentVerificationReason:(verifyResult && verifyResult.reason) || "not_paid" });
            } catch (_) {}
          }
          return send(res, 200, JSON.stringify({
            ok:true,
            paid:false,
            verified:false,
            paymentConfirmed:false,
            orderId:order.orderId,
            status:"pending",
            billCode:order.billCode || billCode,
            paymentUrl:order.paymentUrl,
            reason:(verifyResult && verifyResult.reason) || "not_paid"
          }, null, 2), "application/json");
        }
      } else if (isStripeOrder) {
        try {
          verifyResult = await azVerifyDigitalStripeOrder(order);
          if (verifyResult && verifyResult.paid) {
            verified = true;
            order = await azFinalizePaidOrderOnce(order, req, {
              verified:true,
              paymentMethod:'stripe',
              verificationSource:'stripe-api',
              stripeSession:verifyResult.session,
              paymentReference:verifyResult.paymentReference || order.paymentReference || ''
            });
            order = await findPremiumOrderByAnyDeep({ orderId:order.orderId || orderId }) || order;
          } else {
            return send(res, 200, JSON.stringify({
              ok:true,
              paid:false,
              verified:false,
              paymentConfirmed:false,
              orderId:order.orderId,
              status:'pending',
              stripeSessionId:order.stripeCheckoutSessionId || order.stripeSessionId || '',
              paymentUrl:order.paymentUrl,
              reason:(verifyResult && verifyResult.reason) || 'not_paid'
            }, null, 2), 'application/json');
          }
        } catch (stripeVerifyError) {
          console.error('Stripe payment verification failed:', stripeVerifyError && (stripeVerifyError.message || stripeVerifyError));
          return send(res, 200, JSON.stringify({
            ok:true,
            paid:false,
            verified:false,
            paymentConfirmed:false,
            orderId:order.orderId,
            status:'pending',
            reason:'stripe_verification_failed'
          }, null, 2), 'application/json');
        }
      } else if (String(order.status || "").toLowerCase() === "paid") {
        verified = true;
      }

      if (String(order.status || "").toLowerCase() === "paid" && verified) {
        if (isPaBmPremiumOrder(order)) {
          if (isPublicPaPremiumOrder(order)) {
            if (!order.emailSentAt) order = await maybeSendPublicPaEmail(order, req);
            return send(res, 200, JSON.stringify({
              ok:true, success:true, paid:true, verified:true, paymentConfirmed:true, paBm:true, publicPa:true, paBmUpdated:true,
              orderId:order.orderId, status:order.status, billCode:order.billCode, amountSen:Number(order.amountSen || 3000), unit:1,
              downloadUrl:azPublicPaDownloadUrl(order, req), receiptUrl:azReceiptUrl(publicBaseUrlFromReq(req), order),
              emailSent:!!order.emailSentAt, emailError:order.emailError || null, emailTo:order.emailTo || azPickPremiumBuyerEmailFromOrder(order) || null,
              updatedCount:Number(order.paBmPaidSyncedCount || 0), paymentReference:order.paymentReference || ""
            }, null, 2), "application/json");
          }
          return send(res, 200, JSON.stringify({
            ok:true, success:true, paid:true, verified:true, paymentConfirmed:true, paBm:true, paBmUpdated:true,
            orderId:order.orderId, status:order.status, billCode:order.billCode,
            updatedCount:Number(order.paBmPaidSyncedCount || 0),
            paymentReference:order.paymentReference || ""
          }, null, 2), "application/json");
        }
        if (!order.downloadToken) order = makeDownloadForOrder(order);
        if (!order.emailSentAt) order = await maybeSendDownloadEmail(order, req);
        return send(res, 200, JSON.stringify({ ...paidPayload(order, req), verified:true, paymentConfirmed:true, emailSent: !!order.emailSentAt, emailError: order.emailError || null, emailTo: order.emailTo || azPickPremiumBuyerEmailFromOrder(order) || null }, null, 2), "application/json");
      }
      return send(res, 200, JSON.stringify({ ok:true, paid:false, verified:false, paymentConfirmed:false, orderId:order.orderId, status:order.status || "pending", billCode:order.billCode, paymentUrl:order.paymentUrl }, null, 2), "application/json");
    }

    if (pathname === "/payment/manual-invoice-return" && req.method === "GET") {
      try {
        const orderId = cleanPremiumText(parsed.query.orderId || parsed.query.order_id || "", 180);
        const billCode = cleanPremiumText(parsed.query.billCode || parsed.query.billcode || "", 120);
        let order = findPremiumOrderByAny({ orderId, billCode }) || await azFindPremiumOrderPersistent({ orderId, billCode });
        if (order && order.billCode) order = await refreshToyyibOrder(order, req);
        const paid = String(order && order.status || "").toLowerCase() === "paid";
        const invoiceNo = cleanPremiumText(order && order.manualInvoiceNo || "Invoice", 180);
        const receiptNo = cleanPremiumText(order && order.manualReceiptNo || azManualInvoiceReceiptNo(invoiceNo), 180);
        const title = paid ? "Payment Successful" : "Payment Pending";
        const message = paid ? `Thank you. Invoice ${invoiceNo} has been converted to receipt ${receiptNo}.` : `Payment for ${invoiceNo} has not been verified yet. Please wait a moment or contact AZOBSS.`;
        return send(res, 200, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:Arial,sans-serif;background:#07111f;color:#eefdf5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:20px}.box{max-width:620px;background:#101b2d;border:1px solid ${paid?'#22c55e':'#eab308'};border-radius:20px;padding:30px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{color:${paid?'#4ade80':'#fde047'};margin-top:0}.muted{color:#b6c3d6;line-height:1.6}.ref{font-weight:800;color:#fff}</style></head><body><div class="box"><h1>${paid?'Payment Successful ✅':'Payment Pending'}</h1><p class="ref">${invoiceNo}</p><p class="muted">${message}</p><p class="muted">You may close this page.</p></div></body></html>`, "text/html; charset=utf-8", {"Cache-Control":"no-store"});
      } catch (err) {
        return send(res, 500, "Payment status could not be checked.", "text/plain; charset=utf-8", {"Cache-Control":"no-store"});
      }
    }

    if (pathname === "/api/toyyib-callback" && (req.method === "POST" || req.method === "GET")) {
      let data = { ...(parsed.query || {}) };
      if (req.method === "POST") {
        const raw = await readBody(req);
        data = { ...data, ...parseRequestBody(raw) };
      }
      console.log("ToyyibPay callback received:", JSON.stringify({ keys:Object.keys(data || {}).slice(0,20), billCode:getToyyibBillCode(data), orderId:getToyyibOrderId(data), status:data.status || data.status_id || data.billpaymentStatus || "" }).slice(0, 800));

      const billCode = getToyyibBillCode(data);
      const orderId = getToyyibOrderId(data);
      console.log("ToyyibPay callback parsed:", JSON.stringify({ orderId, billCode, status: data.status || data.status_id || "", transaction_id: data.transaction_id || "" }).slice(0, 500));
      let order = await findPremiumOrderByAnyDeep({ orderId, billCode });

      if (!order) {
        console.warn("ToyyibPay callback order not found:", JSON.stringify({ orderId, billCode }).slice(0, 500));
        return send(res, 200, JSON.stringify({ ok:true, status:"received", note:"order_not_found" }), "application/json");
      }

      if (toyyibStatusIsPaid(data)) {
        if (azVerifyToyyibCallbackEnabled()) {
          const verifiedOrder = await refreshToyyibOrder(order, req);
          const latestVerified = await findPremiumOrderByAnyDeep({ orderId: verifiedOrder.orderId, billCode: verifiedOrder.billCode }) || verifiedOrder;
          if (latestVerified && latestVerified.status === "paid") {
            console.log("ToyyibPay callback verified paid:", JSON.stringify({ orderId: latestVerified.orderId, billCode: latestVerified.billCode, isPaBm: isPaBmPremiumOrder(latestVerified), emailSentAt: latestVerified.emailSentAt || null, emailError: latestVerified.emailError || null }).slice(0, 1000));
            return send(res, 200, JSON.stringify({ ok:true, status:"paid", verified:true, paBmUpdated: isPaBmPremiumOrder(latestVerified), emailSent: !!latestVerified.emailSentAt, emailError: latestVerified.emailError || null }), "application/json");
          }
          console.warn("ToyyibPay callback claimed paid but API verification not paid yet:", JSON.stringify({ orderId: order.orderId, billCode: order.billCode }).slice(0, 500));
          return send(res, 200, JSON.stringify({ ok:true, status:"received", paid:false, verification:"pending" }), "application/json");
        }

        if (String(process.env.AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK || "0") !== "1") {
          console.warn("ToyyibPay callback claimed paid but strict verification is required; not finalizing without API verification:", JSON.stringify({ orderId: order.orderId, billCode: order.billCode }).slice(0, 500));
          return send(res, 200, JSON.stringify({ ok:true, status:"received", paid:false, verified:false, verification:"required" }), "application/json");
        }
        order = await azFinalizePaidOrderOnce(order, req, {
          paymentReference: data.transaction_id || data.billpaymentInvoiceNo || data.refno || data.order_id || order.paymentReference || "",
          toyyibCallback: data,
          callbackTrustBypass: true
        });
        const latest = await findPremiumOrderByAnyDeep({ orderId: order.orderId, billCode: order.billCode }) || order;
        console.log("ToyyibPay callback processed paid with explicit trust bypass:", JSON.stringify({ orderId: latest.orderId, billCode: latest.billCode, isPaBm: isPaBmPremiumOrder(latest), emailSentAt: latest.emailSentAt || null, emailError: latest.emailError || null }).slice(0, 1000));
        return send(res, 200, JSON.stringify({ ok:true, status:"paid", verified:false, trustBypass:true, paBmUpdated: isPaBmPremiumOrder(latest), emailSent: !!latest.emailSentAt, emailError: latest.emailError || null }), "application/json");
      }

      order = await refreshToyyibOrder(order, req);
      if (order.status === "paid") {
        return send(res, 200, JSON.stringify({ ok:true, status:"paid", finalized:true, emailSent: !!order.emailSentAt, emailError: order.emailError || null }), "application/json");
      }
      return send(res, 200, JSON.stringify({ ok:true, status:"received", paid:false }), "application/json");
    }






    if (pathname === "/api/subscription/admin/create-code" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const body = parseRequestBody(await readBody(req));
        const productId = cleanPremiumText(body.productId || "", 180);
        const productName = cleanPremiumText(body.productName || body.name || productId || "AZOBSS Software", 220);
        const buyerEmail = azSubscriptionCleanEmail(body.buyerEmail || body.email || "");
        const username = azSubscriptionCleanUsername(body.username || body.usernameKey || "");
        const prefix = cleanPremiumText(body.activationCodePrefix || body.prefix || productId || "AZOBSS", 18).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "AZOBSS";
        const plan = azSubscriptionPlanDefs().find(p => p.id === azSubscriptionPlanId(body.planId || body.subscriptionPlanId || body.months || "1m")) || azSubscriptionPlanDefs()[0];
        const nowMs = Date.now();
        const durationDays = Math.max(1, Number(plan.durationDays || 31) || 31);
        const expiresAtMs = nowMs + durationDays * 24 * 60 * 60 * 1000;
        const activationCode = azSubscriptionMakeCode(prefix, plan.id);
        const orderId = cleanPremiumText(body.orderId || makeId("sub"), 160);
        const deviceLimit = Math.max(1, Math.min(5, Number(body.deviceLimit || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT) || AZOBSS_SUBSCRIPTION_DEVICE_LIMIT));
        const transferLimitPerYear = Math.max(0, Math.min(20, Number(body.transferLimitPerYear || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR) || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR));
        const order = await azSaveSubscriptionOrder({
          orderId,
          billCode: cleanPremiumText(body.billCode || "", 120),
          productId,
          productName,
          product:{ productId, id:productId, name:productName, subscriptionCodeEnabled:true, activationCodeSale:true, activationCodePrefix:prefix },
          amount: plan.price,
          amountSen: Number(plan.priceSen || 0) || 0,
          saleAmount: Number(plan.priceSen || 0) / 100,
          saleAmountText: plan.price,
          status:"paid",
          isPaid:true,
          paymentMethod:"manual-subscription-code",
          paymentReference: cleanPremiumText(body.paymentReference || "admin-manual-code", 160),
          source:"admin-manual-subscription-code",
          manualSubscriptionCode:true,
          subscriptionCodeEnabled:true,
          activationCodeSale:true,
          subscriptionPlan:plan,
          subscriptionPlanId:plan.id,
          subscriptionPlanLabel:plan.label,
          subscriptionDurationDays:durationDays,
          subscriptionMonths:Number(plan.months || 1) || 1,
          activationCodePrefix:prefix,
          activationCode,
          activationCodeHash:azSubscriptionCodeHash(activationCode),
          activationCodeStatus:"active",
          activationCodeIssuedAt:new Date(nowMs).toISOString(),
          activationCodeIssuedAtMs:nowMs,
          activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
          activationCodeExpiresAtMs:expiresAtMs,
          activeDeviceId:"",
          previousDeviceId:"",
          deviceLimit,
          transferLimitPerYear,
          transferCountByYear:{},
          deviceTransferHistory:[],
          graceDays:AZOBSS_SUBSCRIPTION_GRACE_DAYS,
          buyerEmail,
          email:buyerEmail,
          username,
          usernameKey:username,
          user:{ email:buyerEmail, username, usernameKey:username },
          adminNote: cleanPremiumText(body.note || body.adminNote || "", 500),
          createdByAdmin: adminIdentity.username || adminIdentity.email || adminIdentity.uid || "admin",
          createdAt:new Date(nowMs).toISOString(),
          createdAtMs:nowMs,
          paidAt:new Date(nowMs).toISOString(),
          paidAtMs:nowMs
        });
        return send(res, 200, JSON.stringify({ ok:true, code:activationCode, activationCode, verifyApi:"https://azobss-backend.onrender.com/api/subscription/verify", record:azSubscriptionAdminRow(order) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/subscription/admin/list" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const search = cleanPremiumText(parsed.query.search || parsed.query.q || "", 160);
        const limitRows = Math.max(1, Math.min(500, Number(parsed.query.limit || 250) || 250));
        const records = await azLoadSubscriptionAdminRows(search, limitRows);
        return send(res, 200, JSON.stringify({ ok:true, count:records.length, records }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err), records:[] }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/subscription/admin/reset-device" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const body = parseRequestBody(await readBody(req));
        const order = await azFindSubscriptionOrderByAdminRef(body);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Subscription code not found." }, null, 2), "application/json");
        const oldDevice = azSubscriptionCleanDeviceId(order.activeDeviceId || "");
        const saved = await azSaveSubscriptionOrder(order, {
          previousDeviceId: oldDevice || order.previousDeviceId || "",
          activeDeviceId:"",
          lastDeviceResetAt:new Date().toISOString(),
          lastDeviceResetAtMs:Date.now(),
          lastDeviceResetBy:adminIdentity.username || adminIdentity.email || adminIdentity.uid || "admin",
          lastDeviceResetReason:cleanPremiumText(body.reason || "admin reset", 300)
        });
        return send(res, 200, JSON.stringify({ ok:true, action:"reset-device", record:azSubscriptionAdminRow(saved) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/subscription/admin/revoke" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const body = parseRequestBody(await readBody(req));
        const order = await azFindSubscriptionOrderByAdminRef(body);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Subscription code not found." }, null, 2), "application/json");
        const status = String(body.status || body.activationCodeStatus || "revoked").toLowerCase() === "active" ? "active" : "revoked";
        const saved = await azSaveSubscriptionOrder(order, {
          activationCodeStatus:status,
          revokedAt:status === "revoked" ? new Date().toISOString() : (order.revokedAt || ""),
          revokedAtMs:status === "revoked" ? Date.now() : (order.revokedAtMs || 0),
          revokedBy:status === "revoked" ? (adminIdentity.username || adminIdentity.email || adminIdentity.uid || "admin") : (order.revokedBy || ""),
          revokeReason:cleanPremiumText(body.reason || body.revokeReason || "", 300)
        });
        return send(res, 200, JSON.stringify({ ok:true, action:status === "active" ? "reactivate" : "revoke", record:azSubscriptionAdminRow(saved) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/subscription/admin/extend" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required." }, null, 2), "application/json");
        const body = parseRequestBody(await readBody(req));
        const order = await azFindSubscriptionOrderByAdminRef(body);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Subscription code not found." }, null, 2), "application/json");
        const days = Math.max(1, Math.min(3660, Number(body.days || body.extendDays || 0) || 0));
        if (!days) return send(res, 400, JSON.stringify({ ok:false, error:"Enter extend days." }, null, 2), "application/json");
        const currentExp = Number(order.activationCodeExpiresAtMs || 0) || azActivationCodeMs(order.activationCodeExpiresAt) || Date.now();
        const base = Math.max(currentExp, Date.now());
        const expiresAtMs = base + days * 24 * 60 * 60 * 1000;
        const saved = await azSaveSubscriptionOrder(order, {
          activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
          activationCodeExpiresAtMs:expiresAtMs,
          lastExtendedAt:new Date().toISOString(),
          lastExtendedAtMs:Date.now(),
          lastExtendedBy:adminIdentity.username || adminIdentity.email || adminIdentity.uid || "admin",
          lastExtendedDays:days
        });
        return send(res, 200, JSON.stringify({ ok:true, action:"extend", days, record:azSubscriptionAdminRow(saved) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/subscription/verify" && (req.method === "GET" || req.method === "POST")) {
      try {
        let body = {};
        if (req.method === "POST") {
          try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        }
        const code = azSubscriptionCleanCode(body.code || parsed.query.code || body.activationCode || parsed.query.activationCode || "");
        const productId = cleanPremiumText(body.productId || parsed.query.productId || "", 180);
        const deviceId = azSubscriptionCleanDeviceId(body.deviceId || body.machineId || body.hardwareId || parsed.query.deviceId || parsed.query.machineId || parsed.query.hardwareId || "");
        const appVersion = cleanPremiumText(body.appVersion || parsed.query.appVersion || "", 80);
        const requestEmail = azSubscriptionRequestEmail(body, parsed.query);
        const requestUsername = azSubscriptionRequestUsername(body, parsed.query);
        const transferRequested = body.transfer === true || body.confirmTransfer === true || String(body.transfer || parsed.query.transfer || body.confirmTransfer || parsed.query.confirmTransfer || "").toLowerCase() === "true" || String(body.transfer || parsed.query.transfer || "").toLowerCase() === "1";

        if (!code) return send(res, 400, JSON.stringify({ ok:false, valid:false, pro:false, status:"missing_code", error:"Activation code is required." }, null, 2), "application/json");

        let order = await azFindSubscriptionOrderByCode(code);
        if (!order) return send(res, 404, JSON.stringify({ ok:true, valid:false, pro:false, status:"not_found", reason:"not_found", error:"Activation code not found." }, null, 2), "application/json");

        if (productId && ![order.productId, order.product?.productId, order.product?.id].some(v => String(v || "") === productId)) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"product_mismatch", reason:"product_mismatch", message:"This activation code is for a different product.", deviceId }), null, 2), "application/json");
        }

        const orderEmail = azSubscriptionOrderBuyerEmail(order);
        const orderUsername = azSubscriptionOrderUsername(order);
        if (!azSubscriptionEmailAllowed(orderEmail, requestEmail)) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"email_mismatch", reason:"email_mismatch", message:"This activation code belongs to a different email/account.", deviceId }), null, 2), "application/json");
        }
        if (!azSubscriptionUsernameAllowed(orderUsername, requestUsername)) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"account_mismatch", reason:"account_mismatch", message:"This activation code belongs to a different username/account.", deviceId }), null, 2), "application/json");
        }

        const codeStatus = String(order.activationCodeStatus || order.codeStatus || "active").toLowerCase();
        if (["revoked", "disabled", "blocked", "suspended"].includes(codeStatus)) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:codeStatus, reason:codeStatus, message:"This activation code has been disabled by admin.", deviceId }), null, 2), "application/json");
        }

        const paid = String(order.status || "").toLowerCase() === "paid" || String(order.status || "").toLowerCase() === "active" || order.isPaid === true || order.manualSubscriptionCode === true;
        const expiresAtMs = Number(order.activationCodeExpiresAtMs || 0) || azActivationCodeMs(order.activationCodeExpiresAt);
        const expired = !!expiresAtMs && Date.now() > expiresAtMs;
        if (!paid) return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"not_paid", reason:"not_paid", message:"Payment is not verified for this activation code.", deviceId }), null, 2), "application/json");
        if (expired) return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"expired", reason:"expired", message:"Subscription expired.", deviceId }), null, 2), "application/json");

        if (!deviceId) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:false, status:"device_required", reason:"device_required", message:"Device ID is required to activate Pro version.", deviceId }), null, 2), "application/json");
        }

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();
        const activeDevice = azSubscriptionCleanDeviceId(order.activeDeviceId || "");
        const yearKey = azSubscriptionYearKey(nowMs);
        const transferLimit = Number(order.transferLimitPerYear || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR) || AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR;
        const transferCount = azSubscriptionTransferCount(order, yearKey);

        if (!activeDevice) {
          order = await azSaveSubscriptionOrder(order, {
            activeDeviceId: deviceId,
            activatedAt: order.activatedAt || nowIso,
            activatedAtMs: order.activatedAtMs || nowMs,
            lastVerifiedAt: nowIso,
            lastVerifiedAtMs: nowMs,
            lastVerifiedDeviceId: deviceId,
            lastVerifiedAppVersion: appVersion,
            activationCodeStatus:"active",
            activationCodeHash: order.activationCodeHash || azSubscriptionCodeHash(code),
            deviceHistory: [{ deviceId, firstActivatedAt: nowIso, firstActivatedAtMs: nowMs, appVersion }]
          });
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:true, status:"active", reason:"activated", message:"Subscription activated on this device.", deviceId }), null, 2), "application/json");
        }

        if (activeDevice === deviceId) {
          order = await azSaveSubscriptionOrder(order, {
            lastVerifiedAt: nowIso,
            lastVerifiedAtMs: nowMs,
            lastVerifiedDeviceId: deviceId,
            lastVerifiedAppVersion: appVersion,
            activationCodeStatus:"active",
            activationCodeHash: order.activationCodeHash || azSubscriptionCodeHash(code)
          });
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:true, status:"active", reason:"same_device", message:"Subscription active on this device.", deviceId }), null, 2), "application/json");
        }

        if (!transferRequested) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, {
            valid:false,
            status:"transfer_required",
            reason:"active_on_other_device",
            message:"This activation code is already active on another device. Confirm transfer to use it on this PC.",
            transferRequired:true,
            transferAllowed: transferCount < transferLimit,
            deviceId
          }), null, 2), "application/json");
        }

        if (transferCount >= transferLimit) {
          return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, {
            valid:false,
            status:"transfer_limit_reached",
            reason:"transfer_limit_reached",
            message:"Transfer limit reached for this year. Please contact admin to reset the device.",
            transferRequired:true,
            transferAllowed:false,
            deviceId
          }), null, 2), "application/json");
        }

        const history = Array.isArray(order.deviceTransferHistory) ? order.deviceTransferHistory.slice(-30) : [];
        history.push({
          fromDeviceId: activeDevice,
          toDeviceId: deviceId,
          fromDeviceMasked: azSubscriptionMaskDevice(activeDevice),
          toDeviceMasked: azSubscriptionMaskDevice(deviceId),
          transferAt: nowIso,
          transferAtMs: nowMs,
          appVersion,
          requestEmail,
          requestUsername
        });
        const byYear = order.transferCountByYear && typeof order.transferCountByYear === "object" ? { ...order.transferCountByYear } : {};
        byYear[yearKey] = transferCount + 1;

        order = await azSaveSubscriptionOrder(order, {
          previousDeviceId: activeDevice,
          activeDeviceId: deviceId,
          lastVerifiedAt: nowIso,
          lastVerifiedAtMs: nowMs,
          lastVerifiedDeviceId: deviceId,
          lastVerifiedAppVersion: appVersion,
          activationCodeStatus:"active",
          activationCodeHash: order.activationCodeHash || azSubscriptionCodeHash(code),
          deviceTransferHistory: history,
          transferCountByYear: byYear,
          lastTransferAt: nowIso,
          lastTransferAtMs: nowMs
        });

        return send(res, 200, JSON.stringify(azSubscriptionDevicePublic(order, { valid:true, status:"active", reason:"transferred", message:"Subscription transferred to this device. The old device is revoked.", deviceId }), null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, valid:false, pro:false, status:"server_error", error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/my-purchases" && req.method === "GET") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Login token required to view My Purchases." }, null, 2), "application/json");
        }
        const maxRows = Math.max(1, Math.min(500, Number(parsed.query.limit || 300) || 300));
        const records = await azLoadMyPurchasesForIdentity(req, identity, maxRows);
        return send(res, 200, JSON.stringify({ ok:true, scope:"own-account-only", patch:"415", count:records.length, records }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err), records:[] }, null, 2), "application/json");
      }
    }

    if (pathname.startsWith("/api/my-purchases/delete/") && req.method === "DELETE") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Login token required to delete a My Purchases record." }, null, 2), "application/json");
        }
        const purchaseId = decodeURIComponent(path.basename(pathname));
        const source = cleanPremiumText(parsed.query.source || "", 80);
        const result = await azSoftDeleteMyPurchaseForIdentity(purchaseId, source, identity);
        return send(res, 200, JSON.stringify(result, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname.startsWith("/api/my-purchases/receipt/") && req.method === "GET") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Login token required to view your receipt." }, null, 2), "application/json");
        }
        const receiptId = decodeURIComponent(path.basename(pathname));
        const source = cleanPremiumText(parsed.query.source || "", 80);
        const format = String(parsed.query.format || "html").toLowerCase();
        const order = await azFindMyPurchaseReceiptRecord(receiptId, source, identity);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Receipt not found for this account." }, null, 2), "application/json");
        if (azReceiptStatusBucket(order) !== "paid") return send(res, 403, JSON.stringify({ ok:false, error:"Receipt locked until payment is verified." }, null, 2), "application/json");
        if (format === "json") return send(res, 200, JSON.stringify({ ok:true, receipt:order }, null, 2), "application/json");
        if (format === "pdf") {
          const pdf = await buildReceiptPdfBuffer(order);
          const disposition = String(parsed.query.download || "") === "1" ? "attachment" : "inline";
          res.writeHead(200, azSecurityHeaders({
            "Content-Type":"application/pdf",
            "Content-Disposition": `${disposition}; filename="${azReceiptFilename(order, "pdf")}"`
          }));
          res.end(pdf);
          return;
        }
        return send(res, 200, buildReceiptHtml(order), "text/html; charset=utf-8", { "Content-Disposition": `inline; filename="${azReceiptFilename(order, "html")}"` });
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payment-notifications" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view payment notifications." }, null, 2), "application/json");
        }
        const maxRows = Math.max(1, Math.min(300, Number(parsed.query.limit || 80) || 80));
        const unreadOnly = String(parsed.query.unreadOnly || "0") === "1";
        const result = await azLoadAdminPaymentNotifications({ limit:maxRows, unreadOnly });
        return send(res, 200, JSON.stringify(result, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err), records:[] }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payment-notifications-action" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to update payment notifications." }, null, 2), "application/json");
        }
        let body = {};
        try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        const result = await azAdminPaymentNotificationAction(req, adminIdentity, body);
        return send(res, result.ok ? 200 : 400, JSON.stringify(result, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err), changed:0 }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/audit-logs" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view audit logs." }, null, 2), "application/json");
        }
        const maxRows = Math.max(1, Math.min(200, Number(parsed.query.limit || 100) || 100));
        const rows = [];
        let firestoreOk = false;
        let error = "";
        const db = getAzobssBackendDb();
        if (db) {
          try {
            const snap = await db.collection("adminAuditLogs").orderBy("createdAtMs", "desc").limit(maxRows).get();
            firestoreOk = true;
            snap.forEach(doc => rows.push(azAuditLogPublicRow(doc.data() || {}, doc.id)));
          } catch (err) {
            error = err && err.message ? err.message : String(err);
          }
        }
        if (!rows.length) {
          azReadLocalAuditLogs().slice(0, maxRows).forEach((x, i) => rows.push(azAuditLogPublicRow(x, x.id || `local_${i}`)));
        }
        return send(res, 200, JSON.stringify({ ok:true, firestoreOk, count:rows.length, records:rows, error }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/audit-log" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to write audit log." }, null, 2), "application/json");
        }
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const saved = await azWriteAdminAuditLog(req, adminIdentity, body.action || "admin_frontend_action", body.targetType || "frontend", body.targetId || "", body.details || {}, body.status || "success");
        return send(res, 200, JSON.stringify({ ok:true, audit:saved }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }


    if (pathname === "/api/admin/pa-bm-purchase-records" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view PA/BM purchase records." }, null, 2), "application/json");
        }
        const maxRows = Math.max(1, Math.min(5000, Number(parsed.query.limit || 1000) || 1000));
        const result = await azLoadAdminPaBmPurchaseRecords(maxRows);
        return send(res, 200, JSON.stringify({ ok:true, count:result.records.length, source:result.source, firestoreOk:result.firestoreOk, error:result.error || "", resetMap:result.resetMap || {}, records:result.records }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname.startsWith("/api/admin/payment-receipt/") && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view payment receipts." }, null, 2), "application/json");
        }
        const receiptId = decodeURIComponent(path.basename(pathname));
        const source = cleanPremiumText(parsed.query.source || "", 80);
        const format = String(parsed.query.format || "html").toLowerCase();
        const order = await azFindAdminPaymentReceiptRecord(receiptId, source);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Payment receipt record not found." }, null, 2), "application/json");
        if (String(order.receiptStatus || "").toLowerCase() !== "paid") {
          return send(res, 403, JSON.stringify({ ok:false, error:"Receipt/PDF is only available after payment is Paid/Verified." }, null, 2), "application/json");
        }
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_payment_receipt_view", order.receiptSource || source || "payment", order.receiptNo || receiptId, { source, format, category:order.receiptCategory, amount:order.receiptAmount }, "success"), "Admin payment receipt audit log failed");
        if (format === "json") {
          return send(res, 200, JSON.stringify({ ok:true, receipt:order }, null, 2), "application/json");
        }
        if (format === "pdf") {
          const pdf = await buildReceiptPdfBuffer(order);
          const disposition = String(parsed.query.download || "") === "1" ? "attachment" : "inline";
          res.writeHead(200, azSecurityHeaders({
            "Content-Type":"application/pdf",
            "Content-Disposition": `${disposition}; filename="${azReceiptFilename(order, "pdf")}"`
          }));
          res.end(pdf);
          return;
        }
        return send(res, 200, buildReceiptHtml(order), "text/html; charset=utf-8", { "Content-Disposition": `inline; filename="${azReceiptFilename(order, "html")}"` });
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payment-receipt-email" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to email payment receipts." }, null, 2), "application/json");
        }
        let body = {};
        try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        const receiptId = cleanPremiumText(body.recordId || body.orderId || body.billCode || body.id || "", 180);
        const source = cleanPremiumText(body.source || "", 80);
        const order = await azFindAdminPaymentReceiptRecord(receiptId, source);
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:"Payment receipt record not found." }, null, 2), "application/json");
        if (String(order.receiptStatus || "").toLowerCase() !== "paid") {
          return send(res, 403, JSON.stringify({ ok:false, error:"Receipt email/download link is only available after payment is Paid/Verified." }, null, 2), "application/json");
        }
        const to = cleanPremiumText(body.email || order.receiptBuyerEmail || "", 180);
        if (!to) return send(res, 400, JSON.stringify({ ok:false, error:"Buyer email missing. Enter email manually." }, null, 2), "application/json");
        const pdf = await buildReceiptPdfBuffer(order);
        const downloadUrl = await azEnsurePremiumDownloadResendLink(order, req);
        const subject = downloadUrl
          ? `AZOBSS Receipt + Download Link - ${cleanPremiumText(order.receiptProductName || order.receiptNo || "Purchase", 80)}`
          : `AZOBSS Receipt - ${cleanPremiumText(order.receiptProductName || order.receiptNo || "Purchase", 80)}`;
        const html = azReceiptEmailHtml(order, { downloadUrl });
        const text = `AZOBSS Payment Receipt / Invoice\n\nReceipt: ${order.receiptNo}\nProduct: ${order.receiptProductName}\nAmount: ${order.receiptAmountText}\nStatus: ${String(order.receiptStatus||"").toUpperCase()}\nDate: ${order.receiptDateText}${downloadUrl ? `\n\nDownload Software/CAD File: ${downloadUrl}\nImportant: This secure link opens a confirmation page first. Download count is only used after Start Download is pressed.` : ""}\n\nPDF receipt is attached.`;
        const info = await azSendEmailWithOptionalPdf({ to, subject, html, text, pdfBuffer:pdf, filename:azReceiptFilename(order, "pdf") });
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_payment_receipt_email", order.receiptSource || source || "payment", order.receiptNo || receiptId, { source, to:maskEmail(to), category:order.receiptCategory, amount:order.receiptAmount, downloadLinkIncluded:!!downloadUrl }, "success"), "Admin receipt email audit log failed");
        return send(res, 200, JSON.stringify({ ok:true, sent:true, to:maskEmail(to), receiptNo:order.receiptNo, downloadLinkIncluded:!!downloadUrl, messageId:info && (info.messageId || info.messageIdHeader || info.messageId || "") || "" }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }



    if (pathname.startsWith("/t/") && (req.method === "GET" || req.method === "HEAD")) {
      try {
        const parts = pathname.split("/").filter(Boolean);
        return azSalesTempServe(req, res, parsed, parts[1] || "");
      } catch (err) {
        return send(res, 500, "Temporary document could not be opened.", "text/plain; charset=utf-8", { "Cache-Control":"no-store" });
      }
    }

    if (pathname === "/api/admin/sales-invoice/toyyibpay-bill" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to create ToyyibPay invoice QR." }, null, 2), "application/json");
        let body = {};
        try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        const receiptId = cleanPremiumText(body.receiptId || body.docId || body.id || "", 180);
        const result = await azEnsureManualInvoiceToyyibBill(req, receiptId, adminIdentity);
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_manual_invoice_toyyib_bill", "receipts", receiptId, { invoiceNo:result.invoiceNo, billCode:result.billCode, amount:result.amount }, "success"), "Manual invoice ToyyibPay audit log failed");
        return send(res, 200, JSON.stringify(result, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (err) {
        const status = Number(err && err.statusCode || 500);
        return send(res, status, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err), patch:"766" }, null, 2), "application/json", { "Cache-Control":"no-store" });
      }
    }

    if (pathname === "/api/admin/sales-document/temp" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to create temporary documents." }, null, 2), "application/json");
        const buffer = await readBinaryBody(req, azSalesTempMaxBytes());
        const result = azSalesTempIssue(req, buffer);
        // Temporary PDF/ZIP files are ephemeral; do not consume a Firestore audit write for every share/download.
        return send(res, 200, JSON.stringify(result, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (err) {
        const status = Number(err && err.statusCode || 500);
        return send(res, status, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err), patch:"759" }, null, 2), "application/json", { "Cache-Control":"no-store" });
      }
    }

    if (pathname.startsWith("/api/admin/sales-document/temp/") && req.method === "DELETE") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to delete temporary documents." }, null, 2), "application/json");
        const id = azSalesTempSafeId(path.basename(pathname));
        if (!id) return send(res, 400, JSON.stringify({ ok:false, error:"Invalid temporary document ID." }, null, 2), "application/json");
        const existed = azSalesTempDelete(id);
        return send(res, existed ? 200 : 404, JSON.stringify({ ok:existed, deleted:existed, id, patch:"759" }, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err), patch:"759" }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/sales-document/share-link" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to create document share links." }, null, 2), "application/json");
        }
        let body = {};
        try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        const result = azSalesShareIssue(body);
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_sales_document_share_link", "salesDocument", cleanPremiumText(body.documentNo || result.filename, 180), { filename:result.filename, contentType:result.contentType, size:Number(body.size||0), expiresAt:result.expiresAt }, "success"), "Sales document share-link audit log failed");
        return send(res, 200, JSON.stringify(result, null, 2), "application/json", { "Cache-Control":"no-store" });
      } catch (err) {
        const status = Number(err && err.statusCode || 500);
        return send(res, status, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err), patch:"735" }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payment-logs/delete" && req.method === "POST") {
      try {
        const body = parseRequestBody(await readBody(req));
        const result = await azAdminDeletePaymentLogRecords(req, parsed, body);
        result.patch = result.patch || "424";
        result.runningFile = result.runningFile || "deploy-server.js";
        return send(res, result.statusCode || 200, JSON.stringify(result, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error:err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/export" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to export reports." }, null, 2), "application/json");
        }
        const type = azExportTypeKey(parsed.query.type || "");
        const format = String(parsed.query.format || "json").toLowerCase() === "csv" ? "csv" : "json";
        const maxRows = Math.max(1, Math.min(5000, Number(parsed.query.limit || 500) || 500));
        if (!type) return send(res, 400, JSON.stringify({ ok:false, error:"Unsupported export type." }, null, 2), "application/json");
        if (type === "all") {
          const all = {};
          const meta = {};
          for (const key of Object.keys(AZOBSS_ADMIN_EXPORT_TYPES)) {
            const result = await azLoadAdminExportRows(key, maxRows);
            all[key] = result.rows;
            meta[key] = { count: result.rows.length, source: result.source, firestoreOk: result.firestoreOk, error: result.error || "" };
          }
          azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_export_download", "allReports", "all", { type:"all", format:"json", limit:maxRows, meta }, "success"), "Admin export audit log failed");
          return send(res, 200, JSON.stringify({ ok:true, exportedAt:new Date().toISOString(), type:"all", meta, data:all }, null, 2), "application/json", { "Content-Disposition": `attachment; filename="${azExportFileName("all", "json")}"` });
        }
        const result = await azLoadAdminExportRows(type, maxRows);
        const filename = azExportFileName(type, format);
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_export_download", type, type, { type, format, limit:maxRows, count:result.rows.length, source:result.source, firestoreOk:result.firestoreOk }, "success"), "Admin export audit log failed");
        if (format === "csv") {
          return send(res, 200, azRowsToCsv(result.rows), "text/csv; charset=utf-8", { "Content-Disposition": `attachment; filename="${filename}"` });
        }
        return send(res, 200, JSON.stringify({ ok:true, exportedAt:new Date().toISOString(), type, label:AZOBSS_ADMIN_EXPORT_TYPES[type].label, count:result.rows.length, source:result.source, firestoreOk:result.firestoreOk, error:result.error || "", records:result.rows }, null, 2), "application/json", { "Content-Disposition": `attachment; filename="${filename}"` });
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }


    if (pathname === "/api/admin/system-health" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view system health." }, null, 2), "application/json");
        }
        const health = await azBuildAdminSystemHealth(req, adminIdentity);
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_system_health_check", "system", "backend", { status: health.status, missingRequired: health.missingRequired, collectionErrors: health.firebase.collectionErrors, latencyMs: health.latencyMs }, "success"), "Admin system health audit log failed");
        return send(res, 200, JSON.stringify(health, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }


    if (pathname === "/api/admin/maintenance-scan" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to scan maintenance status." }, null, 2), "application/json");
        }
        const scan = await azAdminMaintenanceScan(req, adminIdentity, { limit: parsed.query.limit || 500 });
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_maintenance_scan", "system", "maintenance", { issues: scan.issues, warnings: scan.warnings, latencyMs: scan.latencyMs }, "success"), "Admin maintenance scan audit log failed");
        return send(res, 200, JSON.stringify(scan, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/maintenance-run" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to run maintenance." }, null, 2), "application/json");
        }
        let body = {};
        try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
        const action = cleanPremiumText(body.action || parsed.query.action || "", 90);
        if (azMaintenanceDestructiveAction(action) && !azMaintenanceDestructiveConfirmOk(body)) {
          return send(res, 400, JSON.stringify({ ok:false, error:`Destructive cleanup requires confirmation phrase: ${azMaintenanceConfirmPhrase()}`, destructive:true, confirmPhrase:azMaintenanceConfirmPhrase() }, null, 2), "application/json");
        }
        const result = await azAdminMaintenanceRun(req, adminIdentity, action, { limit: body.limit || parsed.query.limit || 200 });
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_maintenance_run", "system", action || "maintenance", { action, changed: result.changed, processed: result.processed, skipped: result.skipped, ok: result.ok, errors: result.errors }, result.ok ? "success" : "error"), "Admin maintenance run audit log failed");
        return send(res, result.ok ? 200 : 400, JSON.stringify(result, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }



    // =========================
    // STAFF / ADMIN PAYOUT REQUEST ROUTES
    // These routes were rate-limited earlier; this block wires the actual protected backend handlers.
    // =========================
    if (pathname === "/api/staff/payout-profile" && req.method === "GET") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!azIdentityHasStaffDashboardAccess(identity)) return send(res, 403, JSON.stringify({ ok:false, error:"Staff role required for this backend API." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        const profile = await azGetStaffPayoutProfile(identity, false);
        return send(res, 200, JSON.stringify({ ok:true, profile: profile || null }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/staff/payout-profile" && req.method === "POST") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!azIdentityHasStaffDashboardAccess(identity)) return send(res, 403, JSON.stringify({ ok:false, error:"Staff role required for this backend API." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const docId = azPayoutIdentityDocId(identity);
        const ref = db.collection("staffPayoutProfiles").doc(docId);
        const oldSnap = await ref.get();
        const oldData = oldSnap.exists ? (oldSnap.data() || {}) : {};
        const mergedBody = { ...body };
        if (!String(mergedBody.accountNo || '').trim() && oldData.accountNo) mergedBody.accountNo = oldData.accountNo;
        if (!String(mergedBody.duitNowId || '').trim() && oldData.duitNowId) mergedBody.duitNowId = oldData.duitNowId;
        if (!String(mergedBody.payoutPhone || '').trim() && oldData.payoutPhone) mergedBody.payoutPhone = oldData.payoutPhone;
        if (!String(mergedBody.payoutEmail || '').trim() && oldData.payoutEmail) mergedBody.payoutEmail = oldData.payoutEmail;
        const profile = azPayoutProfileFromBody(mergedBody, identity);
        const now = Date.now();
        const saveRow = { ...oldData, ...profile, docId, createdAt: oldData.createdAt || new Date(now).toISOString(), createdAtMs: oldData.createdAtMs || now };
        await ref.set(azJsonSafe(saveRow), { merge:true });
        azFireAndForget(azWriteAdminAuditLog(req, identity, "staff_payout_profile_save", "staffPayoutProfiles", docId, { username: identity.username || '', method: profile.payoutMethod || '', bankName: profile.bankName || profile.ewalletName || '' }, "success"), "Staff payout profile audit log failed");
        return send(res, 200, JSON.stringify({ ok:true, profile: azPayoutProfilePublic(saveRow, false) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname.startsWith("/api/payout/receipt/") && req.method === "GET") {
      try {
        const requestId = cleanPremiumText(decodeURIComponent(pathname.replace(/^\/api\/payout\/receipt\//, "")), 160);
        if (!requestId) return send(res, 400, JSON.stringify({ ok:false, error:"Missing payout request ID." }, null, 2), "application/json");
        const identity = azRequestHasAdminSecret(req, parsed)
          ? { uid:"api-secret", username:"api-secret", role:"admin", isAdmin:true, authMethod:"api-secret" }
          : await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) return send(res, 403, JSON.stringify({ ok:false, error:"Login token required to view payout receipt." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        const snap = await db.collection("payoutRequests").doc(requestId).get();
        if (!snap.exists) return send(res, 404, JSON.stringify({ ok:false, error:"Payout request not found." }, null, 2), "application/json");
        const row = snap.data() || {};
        if (!identity.isAdmin && !azPayoutRequestBelongsToIdentity(row, identity)) {
          return send(res, 403, JSON.stringify({ ok:false, error:"You can only view your own payout receipt." }, null, 2), "application/json");
        }
        azFireAndForget(azWriteAdminAuditLog(req, identity, "payout_receipt_view", "payoutRequests", requestId, { status: row.status || '', amount: row.amount || 0, adminView: !!identity.isAdmin }, "success"), "Payout receipt audit log failed");
        const html = azPayoutRequestReceiptHtml(row, requestId, identity);
        return send(res, 200, html, "text/html; charset=utf-8", {
          "Cache-Control":"private, no-store",
          "Content-Disposition":`inline; filename="azobss-payout-receipt-${requestId}.html"`
        });
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/staff/payout-requests" && req.method === "GET") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!azIdentityHasStaffDashboardAccess(identity)) return send(res, 403, JSON.stringify({ ok:false, error:"Staff role required for this backend API." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        const maxRows = Math.max(1, Math.min(200, Number(parsed.query.limit || 100) || 100));
        let snap;
        try { snap = await db.collection("payoutRequests").orderBy("createdAtMs", "desc").limit(Math.max(maxRows, 200)).get(); }
        catch (_) { snap = await db.collection("payoutRequests").limit(Math.max(maxRows, 200)).get(); }
        const rows = [];
        snap.forEach(doc => {
          const x = doc.data() || {};
          if (azPayoutRequestBelongsToIdentity(x, identity)) rows.push(azPayoutRequestSafe(x, doc.id, false));
        });
        rows.sort((a,b)=>(Number(b.createdAtMs||0)-Number(a.createdAtMs||0)));
        return send(res, 200, JSON.stringify({ ok:true, requests: rows.slice(0, maxRows), config: azPayoutConfigPublic() }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/staff/payout-request-cancel" && req.method === "POST") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!azIdentityHasStaffDashboardAccess(identity)) return send(res, 403, JSON.stringify({ ok:false, error:"Staff role required for this backend API." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const requestId = cleanPremiumText(body.requestId || body.docId || body.id || "", 160);
        if (!requestId) return send(res, 400, JSON.stringify({ ok:false, error:"Missing payout request ID." }, null, 2), "application/json");
        const ref = db.collection("payoutRequests").doc(requestId);
        const snap = await ref.get();
        if (!snap.exists) return send(res, 404, JSON.stringify({ ok:false, error:"Payout request not found." }, null, 2), "application/json");
        const old = snap.data() || {};
        if (!azPayoutRequestBelongsToIdentity(old, identity)) return send(res, 403, JSON.stringify({ ok:false, error:"You can only cancel your own payout request." }, null, 2), "application/json");
        const oldStatus = String(old.status || "requested").toLowerCase();
        if (!["requested", "reviewing"].includes(oldStatus)) {
          return send(res, 400, JSON.stringify({ ok:false, error:"Only requested/reviewing payout requests can be cancelled by staff.", status: oldStatus }, null, 2), "application/json");
        }
        const now = Date.now();
        const patch = {
          status: "cancelled",
          adminNote: cleanPremiumText(body.note || old.adminNote || "Cancelled by staff.", 500),
          cancelledAt: new Date(now).toISOString(),
          cancelledAtMs: now,
          updatedAt: new Date(now).toISOString(),
          updatedAtMs: now,
          cancelledByUid: cleanPremiumText(identity.uid || "", 140),
          cancelledByUsername: cleanPremiumText(identity.username || "", 80),
          updatedByUid: cleanPremiumText(identity.uid || "", 140),
          updatedByUsername: cleanPremiumText(identity.username || "", 80),
          updatedByRole: cleanPremiumText(identity.role || "staff", 40),
          timeline: azPayoutAppendTimeline(old, azPayoutTimelineEvent('cancelled', identity, 'Payout request cancelled by staff.', { status:'cancelled' }))
        };
        const docIds = Array.isArray(old.commissionDocIds) ? old.commissionDocIds.map(v => cleanPremiumText(v, 160)).filter(Boolean) : [];
        const batch = db.batch();
        batch.set(ref, azJsonSafe(patch), { merge:true });
        const cpatch = azCommissionPatchForPayoutRequest("cancelled", body, identity);
        cpatch.payoutRequestCancelledAt = patch.cancelledAt;
        cpatch.payoutRequestCancelledAtMs = now;
        docIds.forEach(id => batch.set(db.collection("commissionRecords").doc(id), azJsonSafe(cpatch), { merge:true }));
        await batch.commit();
        const updatedSnap = await ref.get();
        const updated = updatedSnap.exists ? (updatedSnap.data() || { ...old, ...patch }) : { ...old, ...patch };
        azFireAndForget(azWriteAdminAuditLog(req, identity, "staff_payout_request_cancel", "payoutRequests", requestId, { requestId, oldStatus, recordCount: docIds.length, amount: old.amount || 0 }, "success"), "Staff payout request cancel audit log failed");
        return send(res, 200, JSON.stringify({ ok:true, request: azPayoutRequestSafe(updated, requestId, false), updatedCommissionRecords: docIds.length }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/staff/payout-request" && req.method === "POST") {
      try {
        const identity = await azCommissionIdentityFromRequest(req);
        if (!azIdentityHasStaffDashboardAccess(identity)) return send(res, 403, JSON.stringify({ ok:false, error:"Staff role required for this backend API." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const profileId = azPayoutIdentityDocId(identity);
        const profileSnap = await db.collection("staffPayoutProfiles").doc(profileId).get();
        if (!profileSnap.exists) return send(res, 400, JSON.stringify({ ok:false, error:"Please save your payout profile before submitting a payout request." }, null, 2), "application/json");
        // Duplicate guard: staff should not accidentally submit a second active payout request
        // for the same approved commission records while an earlier request is still being reviewed.
        try {
          let activeSnap;
          try { activeSnap = await db.collection("payoutRequests").orderBy("createdAtMs", "desc").limit(200).get(); }
          catch (_) { activeSnap = await db.collection("payoutRequests").limit(200).get(); }
          let activeRequest = null;
          activeSnap.forEach(doc => {
            if (activeRequest) return;
            const x = doc.data() || {};
            const st = String(x.status || "requested").toLowerCase();
            if (!azPayoutRequestBelongsToIdentity(x, identity)) return;
            if (["requested", "reviewing", "approved"].includes(st)) activeRequest = { docId: doc.id, ...x };
          });
          if (activeRequest) {
            return send(res, 409, JSON.stringify({
              ok:false,
              error:"You already have an active payout request. Please wait for admin action or cancel the request first.",
              activeRequest: azPayoutRequestSafe(activeRequest, activeRequest.docId, false)
            }, null, 2), "application/json");
          }
        } catch (guardErr) {
          console.warn("AZOBSS payout duplicate guard warning:", guardErr && (guardErr.message || guardErr));
        }
        const profileSnapshot = azPayoutProfilePublic(profileSnap.data() || {}, true);
        const rows = (await azGetCommissionRowsForIdentity(identity, 800))
          .filter(x => azPayoutStatusBucketValue(x) === 'approved')
          .filter(x => !x.payoutRequestId || ['rejected','cancelled'].includes(String(x.payoutRequestStatus || '').toLowerCase()))
          .filter(x => cleanPremiumText(x.docId || x.id || '', 160));
        const eligibleAmount = rows.reduce((sum, x) => sum + azCommissionAmountValue(x), 0);
        if (eligibleAmount <= 0) return send(res, 400, JSON.stringify({ ok:false, error:"No approved unpaid commission is available for payout request." }, null, 2), "application/json");
        const requested = Math.max(0, Number(body.amount || 0) || 0);
        const target = requested > 0 ? Math.min(requested, eligibleAmount) : eligibleAmount;
        let amount = 0;
        const selected = [];
        rows.sort((a,b)=>(Number(a.createdAtMs||0)-Number(b.createdAtMs||0)));
        for (const row of rows) {
          if (amount >= target && selected.length) break;
          const v = azCommissionAmountValue(row);
          if (v <= 0) continue;
          selected.push(row);
          amount += v;
        }
        amount = Math.round(amount * 100) / 100;
        const minPayoutAmount = azPayoutMinAmountRm();
        const maxPayoutAmount = azPayoutMaxAmountRm();
        if (!selected.length || amount <= 0) return send(res, 400, JSON.stringify({ ok:false, error:"No valid commission records were selected for payout." }, null, 2), "application/json");
        if (amount + 0.0001 < minPayoutAmount) {
          return send(res, 400, JSON.stringify({ ok:false, error:`Minimum payout request amount is RM${minPayoutAmount.toFixed(2)}.`, eligibleAmount: Math.round(eligibleAmount * 100) / 100, minAmount:minPayoutAmount }, null, 2), "application/json");
        }
        if (maxPayoutAmount > 0 && amount - 0.0001 > maxPayoutAmount) {
          return send(res, 400, JSON.stringify({ ok:false, error:`Maximum payout request amount is RM${maxPayoutAmount.toFixed(2)} per request.`, eligibleAmount: Math.round(eligibleAmount * 100) / 100, maxAmount:maxPayoutAmount }, null, 2), "application/json");
        }
        const now = Date.now();
        const requestId = makeId("payreq");
        const docIds = selected.map(x => cleanPremiumText(x.docId || x.id || '', 160)).filter(Boolean);
        const requestRow = {
          requestId,
          uid: cleanPremiumText(identity.uid || '', 140),
          username: cleanPremiumText(identity.username || '', 80),
          email: cleanPremiumText(identity.email || '', 160),
          amount,
          amountText: `RM${amount.toFixed(2)}`,
          eligibleAmount: Math.round(eligibleAmount * 100) / 100,
          minPayoutAmount,
          maxPayoutAmount,
          recordCount: docIds.length,
          commissionDocIds: docIds,
          status: 'requested',
          note: cleanPremiumText(body.note || '', 500),
          profileSnapshot,
          createdAt: new Date(now).toISOString(),
          createdAtMs: now,
          updatedAt: new Date(now).toISOString(),
          updatedAtMs: now,
          timeline: [azPayoutTimelineEvent('requested', identity, 'Payout request submitted by staff.', { status:'requested' })]
        };
        const batch = db.batch();
        batch.set(db.collection("payoutRequests").doc(requestId), azJsonSafe(requestRow), { merge:true });
        docIds.forEach(id => batch.set(db.collection("commissionRecords").doc(id), azJsonSafe({ payoutRequestId: requestId, payoutRequestStatus: 'requested', payoutRequestedAt: requestRow.createdAt, payoutRequestedAtMs: now }), { merge:true }));
        await batch.commit();
        azFireAndForget(azWriteAdminAuditLog(req, identity, "staff_payout_request_submit", "payoutRequests", requestId, { amount, recordCount: docIds.length, username: identity.username || '' }, "success"), "Staff payout request audit log failed");
        azFireAndForget(azNotifyPayoutSubmitted(req, requestRow, identity), "Staff payout admin notification failed");
        return send(res, 200, JSON.stringify({ ok:true, request: azPayoutRequestSafe(requestRow, requestId, false) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payout-requests" && req.method === "GET") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to view payout requests." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        const maxRows = Math.max(1, Math.min(300, Number(parsed.query.limit || 120) || 120));
        let snap;
        try { snap = await db.collection("payoutRequests").orderBy("createdAtMs", "desc").limit(maxRows).get(); }
        catch (_) { snap = await db.collection("payoutRequests").limit(maxRows).get(); }
        const rows = [];
        snap.forEach(doc => rows.push(azPayoutRequestSafe(doc.data() || {}, doc.id, true)));
        rows.sort((a,b)=>(Number(b.createdAtMs||0)-Number(a.createdAtMs||0)));
        return send(res, 200, JSON.stringify({ ok:true, requests: rows }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/admin/payout-request-status" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to update payout request." }, null, 2), "application/json");
        const db = getAzobssBackendDb();
        if (!db) return send(res, 500, JSON.stringify({ ok:false, error:"Firebase Admin is not configured." }, null, 2), "application/json");
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const requestId = cleanPremiumText(body.requestId || body.docId || body.id || '', 160);
        if (!requestId) return send(res, 400, JSON.stringify({ ok:false, error:"Missing payout request ID." }, null, 2), "application/json");
        const status = azPayoutRequestStatus(body.status || body.payoutRequestStatus || '');
        if (!status) return send(res, 400, JSON.stringify({ ok:false, error:"Invalid payout request status." }, null, 2), "application/json");
        const ref = db.collection("payoutRequests").doc(requestId);
        const snap = await ref.get();
        if (!snap.exists) return send(res, 404, JSON.stringify({ ok:false, error:"Payout request not found." }, null, 2), "application/json");
        const old = snap.data() || {};
        const oldStatus = String(old.status || 'requested').toLowerCase();
        if (['paid', 'cancelled'].includes(oldStatus) && oldStatus !== status && !azPayoutAllowReopenFinal()) {
          return send(res, 409, JSON.stringify({ ok:false, error:`Payout request is already ${oldStatus}. Set AZOBSS_PAYOUT_ALLOW_REOPEN_FINAL=1 only if you intentionally need to reopen final requests.`, status: oldStatus }, null, 2), "application/json");
        }
        if (status === 'paid' && azPayoutRequirePaidReference() && !cleanPremiumText(body.payoutReference || body.reference || '', 160)) {
          return send(res, 400, JSON.stringify({ ok:false, error:'Payment/reference number is required before marking payout as paid.' }, null, 2), "application/json");
        }
        const patch = azPayoutRequestPatch({ ...body, status }, adminIdentity);
        patch.timeline = azPayoutAppendTimeline(old, azPayoutTimelineEvent('status_update', adminIdentity, `Admin updated payout request to ${status}.`, { status }));
        const batch = db.batch();
        batch.set(ref, azJsonSafe(patch), { merge:true });
        const docIds = Array.isArray(old.commissionDocIds) ? old.commissionDocIds.map(v => cleanPremiumText(v, 160)).filter(Boolean) : [];
        const cpatch = azCommissionPatchForPayoutRequest(status, body, adminIdentity);
        docIds.forEach(id => batch.set(db.collection("commissionRecords").doc(id), azJsonSafe(cpatch), { merge:true }));
        await batch.commit();
        const updatedSnap = await ref.get();
        const updated = updatedSnap.exists ? (updatedSnap.data() || { ...old, ...patch }) : { ...old, ...patch };
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "admin_payout_request_status_update", "payoutRequests", requestId, { requestId, status, amount: old.amount || 0, recordCount: docIds.length, payoutReference: patch.payoutReference || '', payoutMethod: patch.payoutMethod || '' }, "success"), "Admin payout request audit log failed");
        azFireAndForget(azNotifyPayoutStatusToStaff(req, { ...old, ...updated, requestId }, status, patch), "Staff payout status email failed");
        return send(res, 200, JSON.stringify({ ok:true, status, updatedCommissionRecords: docIds.length, request: azPayoutRequestSafe(updated, requestId, true) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/commission/status" && req.method === "GET") {
      try {
        const db = getAzobssBackendDb();
        let firestoreOk = false;
        let sampleCount = 0;
        let error = "";
        const wantRecords = String(parsed.query.records || parsed.query.list || '') === '1';
        const hasCommissionSecret = wantRecords && azRequestHasCommissionSecret(req, parsed);
        const commissionIdentity = wantRecords && !hasCommissionSecret ? await azCommissionIdentityFromRequest(req) : null;
        if (wantRecords && !hasCommissionSecret && !commissionIdentity) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Commission records are protected. Use Firebase login token or admin API secret." }, null, 2), "application/json");
        }
        const maxRecords = Math.max(1, Math.min(300, Number(parsed.query.limit || 100) || 100));
        let records = [];
        if (db) {
          try {
            const snap = wantRecords
              ? await db.collection('commissionRecords').orderBy('createdAtMs', 'desc').limit(maxRecords).get()
              : await db.collection('commissionRecords').limit(1).get();
            firestoreOk = true;
            sampleCount = snap.size;
            if (wantRecords) {
              snap.forEach(doc => {
                const x = doc.data() || {};
                if (wantRecords && !hasCommissionSecret && !azCommissionRecordBelongsToIdentity(x, commissionIdentity)) return;
                records.push(azCommissionSafeRecord(x, doc.id));
              });
            }
          } catch (err) {
            error = err && err.message ? err.message : String(err);
          }
        } else {
          error = firebaseAdminInitError || "Firebase Admin not configured.";
        }
        const localRows = readPremiumJson(COMMISSION_RECORDS_FILE, []);
        if (wantRecords && !records.length && Array.isArray(localRows)) {
          const visibleLocalRows = hasCommissionSecret ? localRows : localRows.filter(x => azCommissionRecordBelongsToIdentity(x, commissionIdentity));
          records = visibleLocalRows.slice(0, maxRecords).map((x, i) => azCommissionSafeRecord(x, x.docId || x.id || `local_${i}`));
        }
        return send(res, 200, JSON.stringify({
          ok: true,
          firestoreConfigured: !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS),
          firestoreOk,
          firestoreSampleCount: sampleCount,
          localJsonCount: Array.isArray(localRows) ? localRows.length : 0,
          envHasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
          recordsReturned: records.length,
          records: wantRecords ? records : undefined,
          error
        }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/commission/retry-order" && req.method === "POST") {
      try {
        const hasCommissionSecret = azRequestHasCommissionSecret(req, parsed);
        const commissionIdentity = hasCommissionSecret ? { isAdmin:true, uid:'api-secret' } : await azCommissionIdentityFromRequest(req);
        if (!hasCommissionSecret && (!commissionIdentity || !commissionIdentity.isAdmin)) {
          return send(res, 403, JSON.stringify({ ok:false, error:'Admin authorization required to retry commission generation.' }, null, 2), "application/json");
        }
        const raw = await readBody(req);
        const body = parseRequestBody(raw);
        const orderId = cleanPremiumText(body.orderId || parsed.query.orderId || '', 140);
        const billCode = cleanPremiumText(body.billCode || parsed.query.billCode || '', 100);
        let order = findPremiumOrderByAny({ orderId, billCode });
        if (!order) {
          try { order = await azFindPremiumOrderPersistent({ orderId, billCode }); } catch (err) { console.warn('Commission retry persistent order lookup failed:', err && (err.message || err)); }
        }
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:'Order not found' }, null, 2), "application/json");
        if (order.status !== 'paid') return send(res, 400, JSON.stringify({ ok:false, error:'Order is not paid', status: order.status || 'unknown' }, null, 2), "application/json");
        const result = await azFinalizeCommissionForOrder(order);
        azFireAndForget(azWriteAdminAuditLog(req, commissionIdentity, "commission_retry_order", "premiumOrder", order.orderId || order.billCode || "", { orderId: order.orderId || "", billCode: order.billCode || "", productName: order.productName || "", result }, "success"), "Commission retry audit log failed");
        return send(res, 200, JSON.stringify({ ok:true, orderId: order.orderId, billCode: order.billCode, commission: result, referral: azReferralFrom({}, order.product || {}, order), owner: azProductOwnerFrom(order.product || {}, order) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }


    if (pathname === "/api/commission/payout-status" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to update commission payout status." }, null, 2), "application/json");
        }
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const ids = []
          .concat(body.docIds || [])
          .concat(body.docId || body.id || [])
          .map(v => cleanPremiumText(v, 160))
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i);
        if (!ids.length) return send(res, 400, JSON.stringify({ ok:false, error:"Missing commission docId/docIds." }, null, 2), "application/json");
        const patch = azCommissionPayoutPatch(body, adminIdentity);
        let updated = 0;
        let storage = "";
        const db = getAzobssBackendDb();
        if (db) {
          storage = "firestore";
          for (const id of ids) {
            await db.collection("commissionRecords").doc(id).set(azJsonSafe(patch), { merge:true });
            updated += 1;
          }
        } else {
          storage = "json";
          const all = readPremiumJson(COMMISSION_RECORDS_FILE, []);
          if (!Array.isArray(all)) return send(res, 500, JSON.stringify({ ok:false, error:"Commission JSON fallback is not available." }, null, 2), "application/json");
          for (const row of all) {
            const rowId = cleanPremiumText(row.docId || row.id || `${row.orderId || ""}_${row.commissionType || ""}_${row.username || ""}`, 160);
            if (ids.includes(rowId)) { Object.assign(row, patch); updated += 1; }
          }
          writePremiumJson(COMMISSION_RECORDS_FILE, all.slice(0, 5000));
        }
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "commission_payout_status_update", "commissionRecords", ids.join(",").slice(0, 180), { docIds: ids, payoutStatus: patch.payoutStatus, payoutReference: patch.payoutReference || "", payoutMethod: patch.payoutMethod || "", updated, storage }, "success"), "Commission payout audit log failed");
        return send(res, 200, JSON.stringify({ ok:true, updated, storage, payoutStatus: patch.payoutStatus }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    // =========================
    // SOFTWARE STATS BACKEND SYNC
    // Public read/increment endpoints are rate-limited. Admin-set is protected by admin Firebase token/API secret.
    // =========================
    if (pathname === "/api/software-stats" && req.method === "GET") {
      const normalized = softwareStatsPayload(readSoftwareStats());
      writeSoftwareStats(normalized);
      return send(res, 200, JSON.stringify({ ok: true, stats: normalized, updatedAt: new Date().toISOString() }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/download" && req.method === "POST") {
      let body = {};
      try { body = JSON.parse((await readBody(req)) || "{}"); }
      catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      if (!key) return send(res, 400, JSON.stringify({ ok:false, error:"Missing productId" }, null, 2), "application/json");
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.downloads = Math.min(9999999, Math.max(0, Math.round(Number(item.downloads || 0))) + 1);
      item.updatedAt = new Date().toISOString();
      stats[key] = item;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, stats: item }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/like" && req.method === "POST") {
      let body = {};
      try { body = JSON.parse((await readBody(req)) || "{}"); }
      catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      if (!key) return send(res, 400, JSON.stringify({ ok:false, error:"Missing productId" }, null, 2), "application/json");
      const delta = Number(body.delta || 1) < 0 ? -1 : 1;
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.likes = Math.min(9999999, Math.max(0, Math.round(Number(item.likes || 0)) + delta));
      item.updatedAt = new Date().toISOString();
      stats[key] = item;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, stats: item }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/rate" && req.method === "POST") {
      let body = {};
      try { body = JSON.parse((await readBody(req)) || "{}"); }
      catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
      const rating = Math.round(Number(body.rating || 0));
      if (rating < 1 || rating > 5) return send(res, 400, JSON.stringify({ ok:false, error:"Invalid rating" }, null, 2), "application/json");
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      if (!key) return send(res, 400, JSON.stringify({ ok:false, error:"Missing productId" }, null, 2), "application/json");
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.ratings = item.ratings && typeof item.ratings === "object" ? item.ratings : { "1":0,"2":0,"3":0,"4":0,"5":0 };
      for (const star of ["1","2","3","4","5"]) item.ratings[star] = Math.max(0, Math.round(Number(item.ratings[star] || 0)));
      item.ratedBy = item.ratedBy && typeof item.ratedBy === "object" ? item.ratedBy : {};
      const voterId = getRatingVoterIdFromBody(req, body);
      const previous = Math.max(0, Math.min(5, Math.round(Number(item.ratedBy[voterId] || 0))));
      if (previous >= 1 && previous <= 5) item.ratings[String(previous)] = Math.max(0, item.ratings[String(previous)] - 1);
      item.ratings[String(rating)] = Math.min(9999999, Math.max(0, Math.round(Number(item.ratings[String(rating)] || 0))) + 1);
      item.ratedBy[voterId] = rating;
      const updated = normalizeSoftwareStats(item);
      updated.updatedAt = new Date().toISOString();
      stats[key] = updated;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, voterId, stats: updated }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/admin-set" && req.method === "POST") {
      try {
        const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
        if (!adminIdentity || !adminIdentity.isAdmin) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to update software stats." }, null, 2), "application/json");
        }
        let body = {};
        try { body = JSON.parse((await readBody(req)) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid request body" }, null, 2), "application/json"); }
        const stats = readSoftwareStats();
        const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
        let updatedCount = 0;
        for (const raw of items) {
          const key = cleanSoftwareId(raw.productId || raw.id || raw.name);
          if (!key) continue;
          stats[key] = normalizeSoftwareStats({
            downloads: Math.max(0, Math.min(9999999, Math.round(Number(raw.downloads || 0)))),
            likes: Math.max(0, Math.min(9999999, Math.round(Number(raw.likes || 0)))),
            ratings: raw.ratings,
            ratingAverage: Math.max(0, Math.min(5, Number(raw.ratingAverage ?? raw.rating ?? 0))),
            ratingVotes: Math.max(0, Math.min(9999999, Math.round(Number(raw.ratingVotes ?? raw.votes ?? 0)))),
            ratingTotal: Math.max(0, Math.min(49999995, Number(raw.ratingTotal || 0)))
          });
          stats[key].updatedAt = new Date().toISOString();
          stats[key].updatedBy = cleanPremiumText(adminIdentity.username || adminIdentity.email || adminIdentity.uid || "admin", 120);
          updatedCount += 1;
        }
        writeSoftwareStats(stats);
        azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "software_stats_admin_set", "softwareStats", "bulk", { updatedCount, productIds: items.map(x => cleanSoftwareId(x.productId || x.id || x.name)).filter(Boolean).slice(0, 50) }, "success"), "Software stats admin-set audit log failed");
        return send(res, 200, JSON.stringify({ ok: true, updatedCount, stats }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    // =========================
    // HEALTH
    // =========================

    if (pathname === "/health") {

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          server: "AZOBSS Backend Running",
          jupemStoreVersion: 32,
          jupemSelectionReady: Boolean(
            String(process.env.JUPEM_EBIZ_USERNAME || "").trim() &&
            String(process.env.JUPEM_EBIZ_PASSWORD || "")
          ),
          port: PORT
        }, null, 2),
        "application/json"
      );
    }


    // =========================
    // AFFILIATE PRODUCT AUTO DETECT
    // =========================

    // =========================
    // ADMIN RESET FIREBASE USER PASSWORD
    // =========================

    if (
      pathname === "/api/admin-reset-user-password" &&
      req.method === "POST"
    ) {

      const body = await readBody(req);
      let data;

      try {
        data = JSON.parse(body || "{}");
      } catch (err) {
        return send(
          res,
          400,
          JSON.stringify({ ok: false, error: "Invalid JSON" }),
          "application/json"
        );
      }

      const usernameKey = String(data.usernameKey || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");

      const newPassword = String(data.newPassword || "");

      if (!usernameKey || usernameKey === "zedan91") {
        return send(
          res,
          400,
          JSON.stringify({ ok: false, error: "Invalid username" }),
          "application/json"
        );
      }

      if (newPassword.length < 6) {
        return send(
          res,
          400,
          JSON.stringify({ ok: false, error: "Password must be at least 6 characters" }),
          "application/json"
        );
      }

      if (!initFirebaseAdmin()) {
        return send(
          res,
          500,
          JSON.stringify({
            ok: false,
            error: "Firebase Admin not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Render environment variables."
          }),
          "application/json"
        );
      }

      try {
        const email = buildUserEmail(usernameKey);
        const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        await firebaseAdmin.auth().updateUser(userRecord.uid, {
          password: newPassword
        });

        return send(
          res,
          200,
          JSON.stringify({ ok: true, usernameKey }),
          "application/json"
        );
      } catch (error) {
        return send(
          res,
          500,
          JSON.stringify({ ok: false, error: error.message || "Reset password failed" }),
          "application/json"
        );
      }
    }

    if (
      pathname === "/api/detect-product" &&
      (req.method === "GET" || req.method === "POST")
    ) {
      let productUrl = parsed.query.url || parsed.query.link || "";

      if (req.method === "POST") {
        try {
          const body = await readBody(req);
          const data = JSON.parse(body || "{}");
          productUrl = data.url || data.link || productUrl;
        } catch (e) {}
      }

      try {
        const detected = await detectAffiliateProduct(productUrl);
        return send(res, 200, JSON.stringify(detected, null, 2), "application/json");
      } catch (err) {
        return send(res, 502, JSON.stringify({
          ok: false,
          error: err.message || "Auto detect failed",
          note: "Shopee mungkin block request. Paste product title atau isi manual jika gagal."
        }, null, 2), "application/json");
      }
    }

    // =========================
    // LOAD AFFILIATES
    // =========================

    if (
      pathname === "/api/affiliates" &&
      req.method === "GET"
    ) {

      if (!fs.existsSync(AFFILIATE_JSON)) {
        fs.writeFileSync(
          AFFILIATE_JSON,
          "[]",
          "utf8"
        );
      }

      return send(
        res,
        200,
        fs.readFileSync(AFFILIATE_JSON, "utf8"),
        "application/json"
      );
    }

    // =========================
    // SAVE AFFILIATES
    // =========================

    if (
      pathname === "/api/save-affiliates" &&
      req.method === "POST"
    ) {

      const body = await readBody(req);

      let data;

      try {
        data = JSON.parse(body);
      } catch (err) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Invalid JSON"
          }),
          "application/json"
        );
      }

      fs.writeFileSync(
        AFFILIATE_JSON,
        JSON.stringify(data, null, 2),
        "utf8"
      );

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          saved: data.length
        }),
        "application/json"
      );
    }


    // =========================
    // JUPEM LOT KADASTER MAP + VERIFIED SELECTION
    // =========================

    if (pathname === "/api/map-location-suggestions" && req.method === "GET") {
      if (azRateLimitOrSend(req, res, "map-location-suggestions", 45, 60 * 1000)) return;
      try {
        const query = parsed.query.q || parsed.query.query || "";
        const stateCode = parsed.query.negeri || parsed.query.state || parsed.query.stateCode || "";
        const productCode = parsed.query.produk || parsed.query.product || parsed.query.productCode || "1";
        const search = await azobssSearchMapSuggestions(query, stateCode, productCode);
        return send(res, 200, JSON.stringify({
          ok: true,
          query: azobssCleanLocationQuery(query),
          stateCode: cleanLotStateCode(stateCode),
          negeri: AZOBSS_JUPEM_LOT_STATE_NAMES[cleanLotStateCode(stateCode)] || "",
          results: search.results,
          searchType: search.searchType,
          provider: search.provider,
          attribution: search.attribution
        }), "application/json");
      } catch (error) {
        const message = error && error.message || "Carian peta tidak tersedia.";
        const status = /sekurang-kurangnya|tidak sah|masukkan/i.test(message) ? 400 : 502;
        return send(res, status, JSON.stringify({ ok: false, error: message }), "application/json");
      }
    }

    if (pathname === "/api/jupem-lot-map/config" && req.method === "GET") {
      try {
        const config = azobssGetLotMapConfig(
          parsed.query.produk || parsed.query.product || parsed.query.type,
          parsed.query.negeri || parsed.query.state || parsed.query.stateCode
        );
        return send(res, 200, JSON.stringify({
          ok: true,
          productCode: config.product,
          productType: config.product === "2" ? "NDCDB_C3" : "NDCDB",
          stateCode: config.state,
          negeri: AZOBSS_JUPEM_LOT_STATE_NAMES[config.state] || "",
          bounds: config.bounds,
          minSelectionZoom: 13
        }), "application/json");
      } catch (error) {
        return send(res, 400, JSON.stringify({ ok: false, error: error.message || "Unsupported JUPEM lot map." }), "application/json");
      }
    }


    if (pathname === "/api/jupem-lot-map/focus" && req.method === "GET") {
      if (azRateLimitOrSend(req, res, "jupem-lot-map-focus", 60, 60 * 1000)) return;
      try {
        const fromUrl = azobssParseFocusedLotMapTarget(
          parsed.query.url || parsed.query.mapUrl || parsed.query.jupemUrl
        );
        const productCode = cleanLotProduct(
          parsed.query.produk || parsed.query.product || parsed.query.productCode || fromUrl.productCode
        );
        const stateCode = cleanLotStateCode(
          parsed.query.negeri || parsed.query.state || parsed.query.stateCode || fromUrl.stateCode
        );
        const objectId = azobssCleanLotObjectId(
          parsed.query.objectId || parsed.query.id || parsed.query.no || fromUrl.objectId
        );
        const lotNo = cleanLotNumber(parsed.query.lot || parsed.query.lotNo || parsed.query.noLot || fromUrl.lotNo);
        const focusContext = {
          paNo: String(parsed.query.pa || parsed.query.paNo || fromUrl.paNo || "").trim().toUpperCase().slice(0, 48),
          daerah: String(parsed.query.daerah || parsed.query.district || "").trim().slice(0, 120),
          mukim: String(parsed.query.mukim || parsed.query.bandar || "").trim().slice(0, 120),
          seksyen: String(parsed.query.seksyen || parsed.query.section || "").trim().slice(0, 80)
        };
        if (!stateCode) throw new Error("Negeri bagi lot atau PA ini tidak dapat dikenal pasti.");
        if (!objectId && !lotNo && !focusContext.paNo) throw new Error("ID, nombor lot atau nombor PA tidak tersedia.");

        const focused = await azobssResolveFocusedLot(productCode, stateCode, objectId, lotNo, focusContext);
        return send(res, 200, JSON.stringify({
          ok: true,
          productCode: focused.config.product,
          productType: focused.config.product === "2" ? "NDCDB_C3" : "NDCDB",
          stateCode: focused.config.state,
          negeri: AZOBSS_JUPEM_LOT_STATE_NAMES[focused.config.state] || "",
          objectId: focused.objectId,
          lotNo: focused.lotNo || lotNo,
          paNo: focused.paNo,
          daerah: focused.daerah,
          mukim: focused.mukim,
          seksyen: focused.seksyen,
          geometry: focused.geometry,
          bounds: focused.bounds,
          center: focused.center,
          lotCount: focused.lotCount || 1
        }), "application/json");
      } catch (error) {
        const message = error && error.message || "Lot JUPEM tidak dapat dipaparkan.";
        const status = /tidak dapat dikenal pasti|tidak tersedia|unsupported|missing/i.test(message) ? 400 : 502;
        return send(res, status, JSON.stringify({ ok: false, error: message }), "application/json");
      }
    }

    const lotTileMatch = pathname.match(/^\/api\/jupem-lot-map\/tile\/(\d+)\/(\d+)\/(\d+)\.png$/);
    if (lotTileMatch && req.method === "GET") {
      if (azRateLimitOrSend(req, res, "jupem-lot-map-tile", 500, 60 * 1000)) return;
      try {
        const config = azobssGetLotMapConfig(
          parsed.query.produk || parsed.query.product || parsed.query.type,
          parsed.query.negeri || parsed.query.state || parsed.query.stateCode
        );
        const showAllStates = /^(?:1|true|all)$/i.test(String(parsed.query.allStates || parsed.query.scope || ""));
        const layerMode = String(parsed.query.layerMode || "").trim().toLowerCase();
        const layerIds = showAllStates
          ? (layerMode === "sheets" || layerMode === "lots"
            ? azobssGetAllLotMapLayerIdsByType(config.product, layerMode)
            : azobssGetAllLotMapLayerIds(config.product))
          : (layerMode === "sheets"
            ? [config.sheetLayer]
            : (layerMode === "lots" ? [config.lotLayer] : [config.lotLayer, config.sheetLayer]));
        const zoom = Number(lotTileMatch[1]);
        const tileX = Number(lotTileMatch[2]);
        const tileY = Number(lotTileMatch[3]);
        if (!Number.isInteger(zoom) || !Number.isInteger(tileX) || !Number.isInteger(tileY) || zoom < 0 || zoom > 22) {
          throw new Error("Invalid map tile.");
        }
        const tileCount = Math.pow(2, zoom);
        if (tileX < 0 || tileY < 0 || tileX >= tileCount || tileY >= tileCount) throw new Error("Invalid map tile.");
        const world = 20037508.342789244;
        const tileSize = (world * 2) / tileCount;
        const xmin = -world + (tileX * tileSize);
        const xmax = xmin + tileSize;
        const ymax = world - (tileY * tileSize);
        const ymin = ymax - tileSize;
        const auth = await azobssGetJupemMapAuth(false);
        const exportUrl = new URL("https://ebiz.jupem.gov.my/arcgis/rest/services/Kadaster/Produk_Kadaster/MapServer/export");
        exportUrl.search = new URLSearchParams({
          bbox: [xmin, ymin, xmax, ymax].join(","),
          bboxSR: "3857",
          imageSR: "3857",
          size: "256,256",
          layers: `show:${layerIds.join(",")}`,
          format: "png32",
          transparent: "true",
          dpi: "96",
          f: "image",
          token: auth.token
        }).toString();
        const imageResponse = await fetch(exportUrl, azJupemFetchOptions({
          redirect: "follow",
          signal: AbortSignal.timeout(25000),
          headers: azobssJupemBaseHeaders({
            "Accept": "image/png,image/*,*/*",
            "Cookie": auth.cookie,
            "Referer": "https://ebiz.jupem.gov.my/PetaInteraktif"
          })
        }));
        const contentType = String(imageResponse.headers.get("content-type") || "").toLowerCase();
        if (!imageResponse.ok || !contentType.includes("image/")) throw new Error("JUPEM map tile is unavailable.");
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        return send(res, 200, imageBuffer, contentType || "image/png", { "Cache-Control": "public, max-age=300" });
      } catch (error) {
        console.warn("JUPEM lot map tile failed:", error && (error.message || error));
        return send(res, 502, "", "image/png", { "Cache-Control": "no-store" });
      }
    }

    if ((pathname === "/api/jupem-lot-selection/estimate" || pathname === "/api/jupem-lot-selection/prepare") && req.method === "POST") {
      const preparing = pathname.endsWith("/prepare");
      if (azRateLimitOrSend(req, res, preparing ? "jupem-lot-prepare" : "jupem-lot-estimate", preparing ? 8 : 30, 10 * 60 * 1000)) return;
      try {
        if (preparing) {
          const identity = await azCommissionIdentityFromRequest(req);
          const localRequest = /^(?:127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)$/.test(azClientIp(req));
          if ((!identity || !identity.uid) && !localRequest) {
            return send(res, 401, JSON.stringify({ ok: false, error: "Sila log masuk sebelum menyediakan pembelian Lot Kadaster." }), "application/json");
          }
        }
        const bodyText = await readBody(req);
        const body = JSON.parse(bodyText || "{}");
        const productCode = cleanLotProduct(body.produk || body.product || body.productCode || body.productType);
        const requestedStateCode = cleanLotStateCode(body.negeri || body.state || body.stateCode);
        const estimate = await azobssEstimateLotSelection(productCode, requestedStateCode, body.geometry);
        const stateCode = estimate.config.state;
        const publicResult = {
          productCode,
          productType: productCode === "2" ? "NDCDB_C3" : "NDCDB",
          stateCode,
          negeri: AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "",
          lotCount: estimate.lotCount,
          drawnAreaM2: Number(estimate.drawnAreaM2.toFixed(2)),
          selectedAreaM2: Number(estimate.selectedAreaM2.toFixed(2)),
          sheetCount: estimate.sheetCount,
          sheets: estimate.sheets.map((row) => ({ name: row.name, areaM2: Number(row.areaM2.toFixed(2)) })),
          areaRatio: Number(estimate.areaRatio.toFixed(6)),
          variant: estimate.variant,
          amount: estimate.amount,
          requestedStateCode: estimate.requestedStateCode,
          stateAutoDetected: estimate.stateAutoDetected
        };
        if (!preparing) return send(res, 200, JSON.stringify({ ok: true, ...publicResult }), "application/json");

        const job = await azobssSubmitLotGpJob(estimate);
        const downloadUrl = azobssLotDownloadUrl(productCode, job.jobId, stateCode);
        const initialJobStatus = String(job.jobStatus || "esriJobSubmitted");
        // 569: even an immediately succeeded ArcGIS job is not considered downloadable
        // until the status endpoint completes eBiz registration and verifies the public ZIP.
        const jobReady = false;
        const selectionPayload = {
          ready: jobReady,
          directDownload: true,
          cached: false,
          productType: publicResult.productType,
          productCode,
          stateCode,
          negeri: publicResult.negeri,
          jobId: job.jobId,
          jobStatus: initialJobStatus,
          variant: publicResult.variant,
          amount: publicResult.amount,
          areaRatio: estimate.areaRatio,
          drawnAreaM2: estimate.drawnAreaM2,
          referenceSheetAreaM2: estimate.referenceSheetAreaM2,
          downloadUrl,
          lotCount: publicResult.lotCount,
          selectedAreaM2: publicResult.selectedAreaM2,
          preparedAtMs: Date.now(),
          expiresAtMs: Date.now() + AZOBSS_LOT_SELECTION_CHECKOUT_TTL_MS
        };
        const selectionToken = azobssCreateLotSelectionToken(selectionPayload);
        return send(res, jobReady ? 200 : 202, JSON.stringify({
          ok: true,
          ready: jobReady,
          preparing: !jobReady,
          directDownload: true,
          cached: false,
          ...publicResult,
          jobId: job.jobId,
          jobStatus: initialJobStatus,
          downloadUrl: jobReady ? downloadUrl : "",
          selectionToken,
          message: jobReady ? "Fail Lot Kadaster telah berjaya disediakan." : "Tengah Proses...",
          filename: `${publicResult.productType}-${job.jobId}.zip`
        }), "application/json", { "Cache-Control": "no-store" });
      } catch (error) {
        const message = error && error.name === "AbortError"
          ? "Sambungan JUPEM mengambil masa terlalu lama. Sila cuba lagi."
          : (azobssIsTransientJupemError(error)
              ? "Sambungan JUPEM terputus sementara selepas beberapa percubaan. Sila tekan semula Sediakan & Tambah ke Troli."
              : (error.message || "Pilihan Lot Kadaster tidak dapat diproses."));
        console.error("JUPEM lot selection failed:", error && (error.stack || error.message || error));
        return send(res, /invalid|missing|outside|unsupported|tidak ditemui|tiada lot|melebihi/i.test(message) ? 400 : 502, JSON.stringify({ ok: false, error: message }), "application/json");
      }
    }

    if (pathname === "/api/jupem-lot-selection/status" && req.method === "POST") {
      if (azRateLimitOrSend(req, res, "jupem-lot-status", 240, 10 * 60 * 1000)) return;
      let bodyTextForStatus = "";
      try {
        bodyTextForStatus = await readBody(req);
        const body = JSON.parse(bodyTextForStatus || "{}");
        const pending = azobssDecodeLotSelectionToken(body.selectionToken);
        if (!pending || !pending.jobId) {
          return send(res, 400, JSON.stringify({ ok: false, error: "Token pilihan JUPEM tidak sah atau telah tamat." }), "application/json");
        }

        const directReady = await azobssEnsureJupemLotDirectReady(
          pending.productCode,
          pending.stateCode,
          pending.jobId
        );
        const jobStatus = directReady.jobStatus || "esriJobSucceeded";
        const downloadUrl = directReady.directUrl;
        const readyPayload = {
          ...pending,
          ready: true,
          zipReady: true,
          directDownload: true,
          cached: false,
          jobStatus,
          downloadUrl,
          preparedAtMs: Date.now(),
          expiresAtMs: Date.now() + AZOBSS_LOT_SELECTION_CHECKOUT_TTL_MS
        };
        return send(res, 200, JSON.stringify({
          ok: true,
          ready: true,
          zipReady: true,
          preparing: false,
          directDownload: true,
          cached: false,
          jobStatus,
          selectionToken: azobssCreateLotSelectionToken(readyPayload),
          jobId: readyPayload.jobId,
          productType: readyPayload.productType,
          productCode: readyPayload.productCode,
          stateCode: readyPayload.stateCode,
          negeri: readyPayload.negeri,
          variant: readyPayload.variant,
          amount: readyPayload.amount,
          downloadUrl,
          lotCount: readyPayload.lotCount,
          selectedAreaM2: readyPayload.selectedAreaM2,
          message: "Fail Lot Kadaster telah berjaya disediakan.",
          filename: `${readyPayload.productType}-${readyPayload.jobId}.zip`
        }), "application/json", { "Cache-Control": "no-store" });
      } catch (error) {
        console.error("JUPEM lot job status failed:", error && (error.stack || error.message || error));
        if (azobssIsTransientJupemError(error)) {
          // 570: Never drop the signed selection token during a temporary JUPEM delay.
          // The frontend needs the same token for the next status poll.
          let retryToken = "";
          let retryPayload = null;
          try {
            const retryBody = JSON.parse(bodyTextForStatus || "{}");
            retryToken = String(retryBody.selectionToken || "").trim();
            retryPayload = azobssDecodeLotSelectionToken(retryToken);
          } catch (_retryTokenError) {}
          return send(res, 202, JSON.stringify({
            ok: true,
            ready: false,
            preparing: true,
            transient: true,
            selectionToken: retryToken,
            jobId: retryPayload && retryPayload.jobId || "",
            jobStatus: error && error.jobStatus || retryPayload && retryPayload.jobStatus || "esriJobExecuting",
            productType: retryPayload && retryPayload.productType || "",
            productCode: retryPayload && retryPayload.productCode || "",
            stateCode: retryPayload && retryPayload.stateCode || "",
            negeri: retryPayload && retryPayload.negeri || "",
            variant: retryPayload && retryPayload.variant || "",
            amount: retryPayload && retryPayload.amount || 0,
            lotCount: retryPayload && retryPayload.lotCount || 0,
            selectedAreaM2: retryPayload && retryPayload.selectedAreaM2 || 0,
            message: "Tengah Proses..."
          }), "application/json", { "Cache-Control": "no-store", "Retry-After": "3" });
        }
        const statusCode = /not configured/i.test(String(error && error.message || "")) ? 503 : 502;
        return send(res, statusCode, JSON.stringify({ ok: false, error: error.message || "Status pilihan JUPEM tidak dapat disemak." }), "application/json");
      }
    }

    // =========================
    // JUPEM LOT KADASTER SEARCH
    // =========================

    if (
      pathname === "/api/search-lot-kadaster" &&
      req.method === "GET"
    ) {
      if (azRateLimitOrSend(req, res, "jupem-lot-search", 30, 60 * 1000)) return;
      const productCode = cleanLotProduct(parsed.query.produk || parsed.query.product || parsed.query.type);
      const stateCode = cleanLotStateCode(parsed.query.negeri || parsed.query.state || parsed.query.stateCode);
      const lotNo = cleanLotNumber(parsed.query.lot || parsed.query.noLot || parsed.query.q);
      if (!stateCode) {
        return send(res, 400, JSON.stringify({ ok: false, error: "Missing or unsupported state." }), "application/json");
      }
      if (!lotNo) {
        return send(res, 400, JSON.stringify({ ok: false, error: "Enter a lot number." }), "application/json");
      }
      try {
        const found = await searchJupemLotCadastre(productCode, stateCode, lotNo);
        return send(res, 200, JSON.stringify({
          ok: true,
          productCode,
          productType: productCode === "2" ? "NDCDB_C3" : "NDCDB",
          negeri: AZOBSS_JUPEM_LOT_STATE_NAMES[stateCode] || "",
          stateCode,
          lotNo,
          sourceUrl: found.sourceUrl,
          results: found.results
        }), "application/json");
      } catch (error) {
        console.error("JUPEM lot search failed:", error && (error.stack || error.message || error));
        return send(res, 502, JSON.stringify({
          ok: false,
          error: "JUPEM lot search is temporarily unavailable. Please try again."
        }), "application/json");
      }
    }

    // =========================
    // JUPEM STESEN TANDA ARAS SEARCH
    // =========================

    if (
      pathname === "/api/stesen-tanda-aras" &&
      req.method === "GET"
    ) {
      const produk = cleanBenchmarkProduct(parsed.query.produk);
      const negeri = cleanState(parsed.query.negeri);
      const q = cleanSearch(parsed.query.q || parsed.query.carian);

      if (!negeri) {
        return send(
          res,
          400,
          JSON.stringify({ ok: false, error: "Missing negeri" }),
          "application/json"
        );
      }

      const sourceUrl =
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?produk=${encodeURIComponent(produk)}&negeri=${encodeURIComponent(negeri)}&carian=${encodeURIComponent(q)}`;

      const candidates = [
        sourceUrl,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?jenis=${encodeURIComponent(produk)}&negeri=${encodeURIComponent(negeri)}&carian=${encodeURIComponent(q)}`,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?product=${encodeURIComponent(produk)}&state=${encodeURIComponent(negeri)}&search=${encodeURIComponent(q)}`,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras`
      ];

      let lastError = "";

      for (const targetUrl of candidates) {
        try {
          console.log("Benchmark search:", targetUrl);
          const response = await fetch(targetUrl, azJupemFetchOptions({
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Referer": "https://ebiz.jupem.gov.my/Produk/StesenTandaAras"
            }
          }));

          if (!response.ok) {
            lastError = `HTTP ${response.status}`;
            continue;
          }

          const html = await response.text();
          const results = parseBenchmarkRows(html, produk, negeri);

          if (results.length || targetUrl === candidates[candidates.length - 1]) {
            return send(
              res,
              200,
              JSON.stringify({
                ok: true,
                produk,
                negeri,
                q,
                sourceUrl,
                results,
                note: results.length ? "Results parsed from JUPEM eBiz page." : "No parsable table returned. Open sourceUrl to continue in eBiz JUPEM."
              }, null, 2),
              "application/json"
            );
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      return send(
        res,
        502,
        JSON.stringify({ ok: false, error: lastError || "Benchmark search failed", sourceUrl }),
        "application/json"
      );
    }

    if (pathname === "/api/stesen-tanda-aras/maps" && req.method === "GET") {
      const productId = String(parsed.query.productId || "").replace(/\D/g, "").slice(0, 20);
      const jenis = String(parsed.query.jenis || "1") === "2" ? "2" : "1";
      if (!productId) {
        return send(res, 400, "A valid BM/SBM product ID is required.", "text/plain; charset=utf-8");
      }
      try {
        const location = await azobssResolveBenchmarkCoordinates(productId, jenis);
        res.writeHead(302, azSecurityHeaders({
          "Location": location.mapsUrl,
          "Cache-Control": "private, max-age=86400"
        }));
        res.end();
        return;
      } catch (error) {
        console.error("JUPEM BM/SBM Google Maps redirect failed:", error && (error.stack || error.message || error));
        return send(res, 502, "The station coordinates are temporarily unavailable. Please try again.", "text/plain; charset=utf-8");
      }
    }

    if (pathname === "/api/stesen-gps/maps" && req.method === "GET") {
      const productId = String(parsed.query.productId || "").replace(/\D/g, "").slice(0, 20);
      if (!productId) {
        return send(res, 400, "A valid GPS product ID is required.", "text/plain; charset=utf-8");
      }
      try {
        const location = await azobssResolveJupemPointCoordinates(productId, "gps");
        res.writeHead(302, azSecurityHeaders({
          "Location": location.mapsUrl,
          "Cache-Control": "private, max-age=86400"
        }));
        res.end();
        return;
      } catch (error) {
        console.error("JUPEM GPS Google Maps redirect failed:", error && (error.stack || error.message || error));
        return send(res, 502, "The GPS station coordinates are temporarily unavailable. Please try again.", "text/plain; charset=utf-8");
      }
    }

    // =========================
    // JUPEM PA HOLD SYSTEM
    // =========================

    if (
      pathname === "/api/pa" &&
      req.method === "GET"
    ) {

      const noPA =
        cleanPA(parsed.query.noPA);

      const negeri =
        cleanState(parsed.query.negeri);

      // Legacy /api/pa used to stage and return a raw .TIF download. Redirect it to
      // the PDF converter so PA output is consistent everywhere. /api/check-pa remains
      // the lightweight existence check endpoint.
      if (noPA && negeri && String(parsed.query.rawTif || "") !== "1") {
        const target = `/api/pa-pdf?noPA=${encodeURIComponent(noPA)}&negeri=${encodeURIComponent(negeri)}`;
        res.writeHead(302, azSecurityHeaders({ Location: target, "Cache-Control": "no-store" }));
        res.end();
        return;
      }

      if (!noPA) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Missing noPA"
          }),
          "application/json"
        );
      }

      if (!negeri) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Missing negeri"
          }),
          "application/json"
        );
      }

      fs.mkdirSync(
        TEMP_DIR,
        { recursive: true }
      );

      const paCleanForFile =
        String(noPA || "")
          .trim()
          .replace(/\.TIF$/i, "")
          .replace(/^PA/i, "");

      const fileName =
        `PA${paCleanForFile}.TIF`;

      const jupemUrl =
`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`;

      console.log(
        "Fetching:",
        jupemUrl
      );

      const response =
        await fetchJupem(jupemUrl);

      if (!response.ok) {

        return send(
          res,
          404,
          JSON.stringify({
            ok: false,
            error: "PA not found"
          }),
          "application/json"
        );
      }

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      const firstText =
        buffer
          .slice(0, 120)
          .toString("utf8")
          .toLowerCase();

      const looksHTML =
        firstText.includes("<html");

      if (
        !buffer.length ||
        looksHTML
      ) {

        return send(
          res,
          404,
          JSON.stringify({
            ok: false,
            error: "Invalid PA file"
          }),
          "application/json"
        );
      }

      const tempName =
`PA${paCleanForFile}.tif`;

      const tempPath =
        path.join(
          TEMP_DIR,
          tempName
        );

      // HOLD FILE
      fs.writeFileSync(
        tempPath,
        buffer
      );

      console.log(
        "PA Held:",
        tempName
      );

      const token =
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      DOWNLOAD_TOKENS.set(token, {
        file: tempName,
        expires: Date.now() + 5 * 60 * 1000
      });

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          noPA,
          negeri,
          filename: tempName,
          size: buffer.length,
          download:
            `/api/download-pa/${tempName}?token=${token}`
        }, null, 2),
        "application/json"
      );
    }



// =========================
// JUPEM BM / SBM SECURE DOWNLOAD PROXY
// =========================

if (
  pathname === "/api/download-stesen-tanda-aras" &&
  req.method === "GET"
) {
  const productId = String(parsed.query.productId || parsed.query.id || "")
    .trim()
    .replace(/[^0-9]/g, "");

  const jenis = String(parsed.query.jenis || "1").trim() === "2" ? "2" : "1";

  if (!productId) {
    return send(
      res,
      400,
      JSON.stringify({ ok: false, error: "Missing productId" }),
      "application/json"
    );
  }

  const jupemUrl =
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenTandaAras/${encodeURIComponent(productId)}?jenis=${encodeURIComponent(jenis)}`;

  console.log("Fetching BM/SBM:", jupemUrl);

  const bmResult = await azobssFetchValidFileCandidates([jupemUrl], "BM/SBM direct");
  if (!bmResult || !bmResult.validFile || !bmResult.buffer || !bmResult.buffer.length) {
    return send(
      res,
      502,
      JSON.stringify({ ok: false, error: "BM/SBM file is temporarily unavailable from JUPEM. Please try again in a moment." }),
      "application/json"
    );
  }

  const response = bmResult.response;
  const buffer = bmResult.buffer;

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const safePrefix = jenis === "2" ? "SBM" : "BM";
  const ext = contentType.includes("pdf") ? "pdf" : (contentType.includes("zip") ? "zip" : "dat");

  res.writeHead(200, azSecurityHeaders({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safePrefix}-${productId}.${ext}"`
  }));

  res.end(buffer);
  return;
}


// =========================
// JUPEM PA EXISTENCE CHECK (NO PDF CONVERT)
// =========================

if (
  (pathname === "/api/check-pa" || pathname === "/api/pa") &&
  req.method === "GET"
) {
  const noPA = cleanPA(parsed.query.noPA || parsed.query.pa || parsed.query.noPa);
  const negeri = cleanState(parsed.query.negeri || parsed.query.state);

  if (!noPA) {
    return send(res, 400, JSON.stringify({ ok: false, error: "Missing noPA" }), "application/json");
  }
  if (!negeri) {
    return send(res, 400, JSON.stringify({ ok: false, error: "Missing negeri" }), "application/json");
  }

  try {
    const result = await fetchPelanAkuiCandidates(noPA, negeri);
    if (!result || !result.validFile) {
      return send(res, 404, JSON.stringify({ ok: false, error: "PA not found" }), "application/json");
    }

    return send(res, 200, JSON.stringify({
      ok: true,
      noPA: `PA${String(noPA || "").replace(/^PA/i, "").replace(/\.TIF$/i, "")}.TIF`,
      negeri,
      size: result.buffer ? result.buffer.length : 0
    }), "application/json");
  } catch (error) {
    console.error("PA check failed:", error && (error.stack || error.message || error));
    return send(res, 500, JSON.stringify({ ok: false, error: "PA check failed" }), "application/json");
  }
}


// =========================
// PA/BM CONTROLLED DOWNLOAD (5 DOWNLOADS / 7 DAYS)
// =========================


if (pathname === "/api/pa-bm-download/reset-count" && req.method === "POST") {
  if (azRateLimitOrSend(req, res, "pa-bm-download-reset", 40, 60 * 1000)) return;
  const adminIdentity = await azAdminIdentityFromRequest(req, parsed);
  if (!adminIdentity || !adminIdentity.isAdmin) {
    return send(res, 403, JSON.stringify({ ok:false, error:"Admin authorization required to reset PA/BM download counter." }, null, 2), "application/json");
  }

  let body = {};
  try { body = parseRequestBody(await readBody(req)); } catch (_) { body = {}; }
  const recordId = String(body.recordId || parsed.query.recordId || body.firestoreId || body.id || "").trim();
  if (!recordId) return send(res, 400, JSON.stringify({ ok:false, error:"Missing recordId" }, null, 2), "application/json");

  try {
    const result = await azobssGetPurchaseRecord(recordId);
    const ref = result.ref;
    const record = result.record;
    if (!record) return send(res, 404, JSON.stringify({ ok:false, error:"Purchase record not found." }, null, 2), "application/json");

    const nowMs = Date.now();
    const reset = await azobssResetPurchaseDownloadCounter(ref, record, adminIdentity, nowMs);
    const embedded = await azobssResetEmbeddedPurchaseDownloadCounter(Object.assign({}, record, { firestoreId: recordId }), adminIdentity, nowMs);
    azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "pa_bm_download_counter_reset", "purchaseLogs", recordId, { recordId, itemCode: record.itemCode || record.stesen || record.stationNo || "", productType: record.productType || record.product || "", usernameKey: record.usernameKey || "", oldDownloadCount: azobssRecordDownloadCount(record), maxDownloads: reset.maxDownloads, embeddedUpdated: embedded && embedded.updated || 0 }, "success"), "PA/BM download reset audit log failed");
    return send(res, 200, JSON.stringify(Object.assign({ ok:true, recordId }, reset, { embeddedUpdated: embedded && embedded.updated || 0 }), null, 2), "application/json");
  } catch (error) {
    console.error("PA/BM download counter reset failed:", error && (error.stack || error.message || error));
    return send(res, 500, JSON.stringify({ ok:false, error:error && error.message ? error.message : "Reset failed" }, null, 2), "application/json");
  }
}

if (pathname === "/api/pa-bm-download" && req.method === "GET") {
  const recordId = String(parsed.query.recordId || "").trim();
  if (!recordId) return azobssPaBmDownloadError(res, 400, "Missing recordId");

  let ref, record;
  try {
    const result = await azobssGetPurchaseRecord(recordId);
    ref = result.ref;
    record = result.record;
  } catch (error) {
    console.error("PA/BM controlled download Firebase error:", error && (error.stack || error.message || error));
    const message = azobssFirestoreReadRetryable(error)
      ? "Download verification is temporarily busy. Please try again in a moment. Your download quota was not used."
      : "Download verification failed because backend Firebase access is unavailable. Your download quota was not used.";
    return azobssPaBmDownloadError(res, 500, message);
  }

  if (!record) return azobssPaBmDownloadError(res, 404, "Purchase record not found.");
  if (!azobssPaidStatus(record.status)) return azobssPaBmDownloadError(res, 403, "Payment is still pending.");

  const nowMs = Date.now();
  const expiresAtMs = azobssRecordExpiresAtMs(record);
  const used = azobssRecordDownloadCount(record);
  const max = azobssRecordMaxDownloads(record);

  if (nowMs > expiresAtMs) return azobssPaBmDownloadError(res, 403, "Tempoh download telah tamat.");
  if (used >= max) return azobssPaBmDownloadError(res, 403, "Had download telah digunakan.");

  const type = azobssPaBmRecordType(record);
  const code = azobssPaBmRecordCode(record);
  const prepareOnly = String(parsed.query.prepare || parsed.query.status || "") === "1";

  if (prepareOnly) {
    if (type !== "NDCDB" && type !== "NDCDB_C3") {
      return send(res, 200, JSON.stringify({ ok: true, ready: true, preparing: false }), "application/json");
    }
    const productCode = type === "NDCDB_C3" ? "2" : "1";
    const jobId = azobssLotRecordJobId(record);
    const stateCode = cleanLotStateCode(record.negeri || record.state || "");
    if (!jobId || !stateCode) return azobssPaBmDownloadError(res, 400, "Maklumat ID atau negeri Lot Kadaster tidak lengkap.");
    try {
      const directReady = await azobssEnsureJupemLotDirectReady(productCode, stateCode, jobId);
      const jobStatus = directReady.jobStatus || "esriJobSucceeded";
      const directUrl = directReady.directUrl;
      return send(res, 200, JSON.stringify({
        ok: true,
        ready: true,
        preparing: false,
        delivery: "jupem-direct",
        registered: Boolean(directReady.registered),
        zipVerified: true,
        jobStatus,
        jobId,
        stateCode,
        directUrl,
        openUrl: directUrl
      }), "application/json", { "Cache-Control": "no-store" });
    } catch (error) {
      console.warn("NDCDB readiness check failed:", error && (error.message || error));
      return send(res, 202, JSON.stringify({
        ok: true,
        ready: false,
        preparing: true,
        transient: true,
        message: "Tengah Proses..."
      }), "application/json", { "Cache-Control": "no-store", "Retry-After": "3" });
    }
  }

  if (type === "PA") {
    const itemCode = String(code || "").replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
    const negeri = cleanState(record.negeri || record.state || "");
    if (!itemCode || !negeri) return azobssPaBmDownloadError(res, 400, "Invalid PA record.");

    const paResult = await azobssFetchPaRecordFile(record, itemCode, negeri);
    if (!paResult || !paResult.validFile || !azobssBufferIsConvertibleImage(paResult.buffer)) {
      const fallbackUrl = azobssFirstPaFallbackUrl(record, itemCode, negeri);
      const fallbackSent = await azobssReturnBrowserFallbackDownload(req, res, ref, record, nowMs, "PA", fallbackUrl, `PA${itemCode}.TIF`);
      if (fallbackSent) return;
      return azobssPaBmDownloadError(res, 502, "PA PDF is not ready yet. AZOBSS could not fetch the JUPEM TIF for conversion right now. Please try again in a moment. Your download quota was not used.");
    }

    const safeName = ("PA" + itemCode).replace(/[^A-Z0-9_-]/gi, "");
    let pdfBuffer;
    try {
      pdfBuffer = await convertTifBufferToPdfBuffer(paResult.buffer, safeName);
    } catch (convertError) {
      console.error("PA controlled PDF conversion failed:", convertError && (convertError.stack || convertError.message || convertError));
      return azobssPaBmDownloadError(res, 500, "PA PDF conversion failed.");
    }
    if (!azobssBufferIsPdf(pdfBuffer)) {
      return azobssPaBmDownloadError(res, 500, "PA PDF conversion produced an invalid file. Your download quota was not used.");
    }

    try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }

    res.writeHead(200, azSecurityHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Access-Control-Expose-Headers": "Content-Disposition"
    }));
    res.end(pdfBuffer);
    return;
  }

  if (type === "GPS") {
    let gpsResult;
    try {
      gpsResult = await azobssFetchGpsRecordFile(record);
    } catch (fetchError) {
      console.error("GPS controlled fetch failed:", fetchError && (fetchError.stack || fetchError.message || fetchError));
    }
    if (!gpsResult || !gpsResult.validFile || !azobssBufferIsPdf(gpsResult.buffer)) {
      return azobssPaBmDownloadError(res, 502, "GPS PDF is temporarily unavailable from JUPEM. Please try again in a moment. Your download quota was not used.");
    }

    try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }
    const safeCode = String(code || record.stationNo || record.itemCode || "GPS").replace(/[^A-Z0-9_-]/gi, "-");
    res.writeHead(200, azSecurityHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeCode}.pdf"`,
      "Access-Control-Expose-Headers": "Content-Disposition"
    }));
    res.end(gpsResult.buffer);
    return;
  }

  if (type === "SYIT_PIAWAI") {
    let syitResult;
    try {
      syitResult = await azobssFetchSyitRecordFile(record);
    } catch (fetchError) {
      console.error("Syit Piawai controlled fetch failed:", fetchError && (fetchError.stack || fetchError.message || fetchError));
    }
    if (!syitResult || !syitResult.validFile || (!azobssBufferIsPdf(syitResult.buffer) && !azobssBufferIsConvertibleImage(syitResult.buffer))) {
      return azobssPaBmDownloadError(res, 502, "Syit Piawai source image is temporarily unavailable from JUPEM. Please try again in a moment. Your download quota was not used.");
    }

    const safeCode = String(code || record.itemCode || record.productId || "Syit-Piawai").replace(/[^A-Z0-9_-]/gi, "-");
    let syitPdf = syitResult.buffer;
    if (!azobssBufferIsPdf(syitPdf)) {
      try {
        syitPdf = await convertTifBufferToPdfBuffer(syitResult.buffer, safeCode);
      } catch (convertError) {
        console.error("Syit Piawai PDF conversion failed:", convertError && (convertError.stack || convertError.message || convertError));
        return azobssPaBmDownloadError(res, 500, "Syit Piawai PDF conversion failed. Your download quota was not used.");
      }
    }
    if (!azobssBufferIsPdf(syitPdf)) {
      return azobssPaBmDownloadError(res, 500, "Syit Piawai conversion produced an invalid PDF. Your download quota was not used.");
    }

    try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }
    res.writeHead(200, azSecurityHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeCode}.pdf"`,
      "Access-Control-Expose-Headers": "Content-Disposition"
    }));
    res.end(syitPdf);
    return;
  }

  if (type === "NDCDB" || type === "NDCDB_C3") {
    // 569: direct JUPEM delivery is issued only after eBiz registration and public ZIP signature verification.
    // No quota is consumed while the job is Submitted/Executing or while status checking is unavailable.
    const productCode = type === "NDCDB_C3" ? "2" : "1";
    const jobId = azobssLotRecordJobId(record);
    const stateCode = cleanLotStateCode(record.negeri || record.state || "");
    if (!jobId || !stateCode) {
      return azobssPaBmDownloadError(res, 400, "Maklumat ID atau negeri Lot Kadaster tidak lengkap.");
    }
    let directReady;
    try {
      directReady = await azobssEnsureJupemLotDirectReady(productCode, stateCode, jobId);
    } catch (error) {
      console.warn("NDCDB final registration/readiness check failed:", error && (error.message || error));
      return send(res, 202, JSON.stringify({
        ok: true,
        ready: false,
        preparing: true,
        transient: true,
        jobStatus: String(error && error.jobStatus || "esriJobUnknown"),
        message: "Tengah Proses..."
      }), "application/json", { "Cache-Control": "no-store", "Retry-After": "3" });
    }
    const jobStatus = directReady.jobStatus || "esriJobSucceeded";
    const directUrl = directReady.directUrl;
    try {
      await azobssIncrementPurchaseDownload(ref, record, nowMs);
    } catch (error) {
      console.error("NDCDB direct-link counter update failed:", error && (error.stack || error.message || error));
      return azobssPaBmDownloadError(res, 500, "Pengesahan kuota download gagal. Sila cuba semula; kuota tidak digunakan.");
    }
    return send(res, 200, JSON.stringify({
      ok: true,
      ready: true,
      zipReady: true,
      preparing: false,
      delivery: "jupem-direct",
      registered: Boolean(directReady.registered),
      jobStatus,
      openUrl: directUrl,
      directUrl,
      jobId,
      stateCode,
      downloadCount: used + 1,
      maxDownloads: max,
      expiresAtMs
    }), "application/json", {
      "Cache-Control": "no-store",
      "Access-Control-Expose-Headers": "Content-Disposition"
    });
  }

  if (type !== "BM" && type !== "SBM") {
    return azobssPaBmDownloadError(res, 400, "Unsupported JUPEM document category. Your download quota was not used.");
  }

  // Rebuild BM/SBM candidates from the paid record + local stesen JSON.
  // Do not fetch the AZOBSS backend URL from inside the same backend; convert it to the real JUPEM URL.
  let bmResult;
  try {
    bmResult = await azobssFetchBenchmarkRecordFile(record);
  } catch (fetchError) {
    console.error("BM/SBM controlled fetch failed:", fetchError && (fetchError.stack || fetchError.message || fetchError));
    const fallbackUrl = azobssFirstBmFallbackUrl(record);
    const fallbackSent = await azobssReturnBrowserFallbackDownload(req, res, ref, record, nowMs, "BM/SBM", fallbackUrl, `BM-SBM-${String(code || record.itemCode || record.productId || "download").replace(/[^A-Z0-9_-]/gi, "-")}.pdf`);
    if (fallbackSent) return;
    return azobssPaBmDownloadError(res, 502, "BM/SBM file is temporarily unavailable from JUPEM. Please try again in a moment.");
  }

  if (!bmResult || !bmResult.validFile || !azobssBufferIsPdf(bmResult.buffer)) {
    const fallbackUrl = azobssFirstBmFallbackUrl(record);
    const fallbackSent = await azobssReturnBrowserFallbackDownload(req, res, ref, record, nowMs, "BM/SBM", fallbackUrl, `BM-SBM-${String(code || record.itemCode || record.productId || "download").replace(/[^A-Z0-9_-]/gi, "-")}.pdf`);
    if (fallbackSent) return;
    return azobssPaBmDownloadError(res, 502, "BM/SBM file is temporarily unavailable from JUPEM. Please try again in a moment.");
  }

  const bmBuffer = bmResult.buffer;

  try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }

  const contentType = "application/pdf";
  const productType = String(record.productType || record.product || type || "BM").trim().toUpperCase();
  const safeCode = String(code || record.itemCode || record.stesen || "download").replace(/[^A-Z0-9_-]/gi, "-");
  const ext = "pdf";
  const safePrefix = productType === "SBM" ? "SBM" : "BM";

  res.writeHead(200, azSecurityHeaders({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safePrefix}-${safeCode}.${ext}"`,
    "Access-Control-Expose-Headers": "Content-Disposition"
  }));
  res.end(bmBuffer);
  return;
}

// =========================
// JUPEM PA DIRECT DOWNLOAD (NO SHARP)
// =========================

if (
  pathname === "/api/pa-pdf" &&
  req.method === "GET"
) {

  const noPA =
    cleanPA(parsed.query.noPA);

  const negeri =
    cleanState(parsed.query.negeri);

  if (!noPA) {
    return send(
      res,
      400,
      JSON.stringify({
        ok: false,
        error: "Missing noPA"
      }),
      "application/json"
    );
  }

  if (!negeri) {
    return send(
      res,
      400,
      JSON.stringify({
        ok: false,
        error: "Missing negeri"
      }),
      "application/json"
    );
  }

  const paCleanForFile =
    String(noPA || "")
      .trim()
      .replace(/\.TIF$/i, "")
      .replace(/^PA/i, "");

  // Use the same multi-candidate PA fetcher as the check/cart flow.
  // This prevents false "PA not found" caused by noPa/noPA casing or state formatting.
  const paResult = await fetchPelanAkuiCandidates(noPA, negeri);

  if (!paResult || !paResult.validFile || !paResult.buffer || !paResult.buffer.length) {
    return send(
      res,
      404,
      JSON.stringify({
        ok: false,
        error: "PA not found"
      }),
      "application/json"
    );
  }

  const tifBuffer = paResult.buffer;

  const safeName =
    `PA${paCleanForFile}`.replace(/[^A-Z0-9_-]/gi, "");

  let pdfBuffer;
  try {
    pdfBuffer = await convertTifBufferToPdfBuffer(tifBuffer, safeName);
  } catch (convertError) {
    console.error("PA PDF conversion failed:", convertError && (convertError.stack || convertError.message || convertError));
    return send(
      res,
      500,
      JSON.stringify({
        ok: false,
        error: "PA PDF conversion failed. Please make sure sharp and pdfkit are installed on the backend."
      }),
      "application/json"
    );
  }

  res.writeHead(200, azSecurityHeaders({
    "Content-Type": "application/pdf",
    "Content-Disposition":
      `attachment; filename="${safeName}.pdf"`
  }));

  res.end(pdfBuffer);
  return;
}

// =========================
// SECURE PA DOWNLOAD
// =========================

if (
  pathname.startsWith("/api/download-pa/") &&
  req.method === "GET"
) {

  const fileName =
    path.basename(pathname);

  const token =
    parsed.query.token;

  const saved =
    DOWNLOAD_TOKENS.get(token);

  if (
    !saved ||
    saved.file !== fileName ||
    saved.expires < Date.now()
  ) {

    return send(
      res,
      403,
      "Unauthorized"
    );
  }

  // DOWNLOAD_TOKENS.delete(token); // allow IDM/browser retry

const filePath =
    path.join(TEMP_DIR, fileName);

  if (!fs.existsSync(filePath)) {

    return send(
      res,
      404,
      "File not found"
    );
  }

  res.writeHead(200, azSecurityHeaders({
    "Content-Type": "image/tiff",
    "Content-Disposition":
      `attachment; filename="${fileName}"`
  }));

  fs.createReadStream(filePath)
    .pipe(res);

  return;
}



    // =========================
    // AZOBSS PREMIUM SOFTWARE/CAD PURCHASE FLOW
    // =========================


    if (pathname === "/api/premium/free-promo-download" && req.method === "POST") {
      try {
        let data = {};
        try { data = JSON.parse(await readBody(req) || "{}"); }
        catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid JSON" }), "application/json"); }
        const identity = await azCommissionIdentityFromRequest(req);
        if (!identity || !identity.uid) return send(res, 401, JSON.stringify({ ok:false, error:"Login session could not be verified. Please login again." }), "application/json");
        const productId = cleanPremiumText(data.productId || data.id || "", 180);
        if (!productId) return send(res, 400, JSON.stringify({ ok:false, error:"Product ID is required." }), "application/json");
        const trustedResolved = await azResolveTrustedPremiumProduct({ productId, product:{ productId } }, req);
        const product = trustedResolved.product || {};
        const claim = await azVerifyPromoFreeClaim(product, identity, data);
        const r2ObjectKey = azSafeR2ObjectKey(trustedResolved.r2ObjectKey || product.r2ObjectKey || product.r2Key || "");
        if (!r2ObjectKey) return send(res, 400, JSON.stringify({ ok:false, error:"Cloudflare R2 Private Object Key is not configured for this Free Promo product." }), "application/json");
        if (!azR2Configured()) return send(res, 503, JSON.stringify({ ok:false, error:"Private R2 download gateway is not configured." }), "application/json");
        const now = Date.now();
        const ttlSeconds = Math.max(300, Math.min(Number(process.env.AZOBSS_PROMO_FREE_GATE_TTL_SECONDS || 7200) || 7200, 24 * 60 * 60));
        const saved = {
          orderId:cleanPremiumText(`promo-${productId}-${claim.batchId}-${claim.claimId}`,180),
          productId,
          productName:cleanPremiumText(product.name || product.productName || "AZOBSS Free Promo",180),
          r2ObjectKey,
          r2Key:r2ObjectKey,
          product:{...product,r2ObjectKey,r2Key:r2ObjectKey},
          maxDownload:1,
          maxDownloads:1,
          downloadLimit:1,
          usedCount:0,
          expiresAtMs:now + ttlSeconds * 1000,
          promoFree:true,
          promoFreeClaimId:claim.claimId,
          promoFreeClaimNo:claim.claimNo,
          promoFreeUid:identity.uid
        };
        const downloadUrl = azR2GateUrlForSaved(saved);
        if (!downloadUrl) return send(res, 503, JSON.stringify({ ok:false, error:"Secure Free Promo link could not be generated." }), "application/json");
        return send(res, 200, JSON.stringify({ ok:true, downloadUrl, expiresAt:new Date(saved.expiresAtMs).toISOString(), maxDownload:1, patch:"708" }), "application/json", { "Cache-Control":"no-store" });
      } catch (error) {
        const status = Number(error && error.statusCode) || 500;
        return send(res, status, JSON.stringify({ ok:false, error:cleanPremiumText(error && error.message,300) || "Free Promo download failed." }), "application/json", { "Cache-Control":"no-store" });
      }
    }

    if (pathname === "/api/premium/complete-purchase" && req.method === "POST") {
      let data = {};
      try { data = JSON.parse(await readBody(req) || "{}"); }
      catch (error) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid JSON" }), "application/json"); }

      const adminIdentity = azAdminBypassEnabled() ? { isAdmin:true, uid:"public-bypass", username:"public-bypass", authMethod:"env-bypass" } : await azAdminIdentityFromRequest(req, parsed);
      if (!adminIdentity || !adminIdentity.isAdmin) {
        return send(res, 403, JSON.stringify({ ok:false, error:"Manual complete-purchase is admin protected. Use Firebase admin login token, ADMIN_KEY, or AZOBSS_ADMIN_API_SECRET." }, null, 2), "application/json");
      }

      const requestedProduct = data.product || {};
      const trustedResolved = await azResolveTrustedPremiumProduct(data, req);
      const product = trustedResolved.product || {};
      const productName = cleanPremiumText(product.name || product.productName || data.productName, 160);
      const productId = cleanPremiumText(product.productId || product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
      const amount = cleanPremiumText(trustedResolved.amountText || product.price || "", 40);
      const amountSen = Number(trustedResolved.amountSen || parseAmountToSen(amount));
      const downloadLink = cleanPremiumUrl(trustedResolved.downloadLink || product.secureDownloadLink || product.premiumDownloadFileLink || product.privateDownloadLink || product.downloadLink || "");
      const r2ObjectKey = azSafeR2ObjectKey(trustedResolved.r2ObjectKey || product.r2ObjectKey || product.r2Key || requestedProduct.r2ObjectKey || requestedProduct.r2Key || data.r2ObjectKey || data.r2Key || "");
      const paymentMethod = cleanPremiumText(data.paymentMethod || "manual", 40);
      const paymentReference = cleanPremiumText(data.paymentReference || data.reference || "", 200);
      const requestedLimit = Math.max(1, Math.min(20, Number(product.downloadLimit || data.downloadLimit || product.maxDownload || 3)));
      const requestedExpiryHours = azobssExpiryHoursFromOrder({ ...data, product });
      const expiresNever = requestedExpiryHours === 0;
      const expiresAtMs = azobssTokenExpiresAtMsFromOrder({ ...data, product, expiryHours: requestedExpiryHours, expiresNever }, Date.now());
      const user = getPremiumUser(data);

      if (!productName || !amount || !amountSen) {
        return send(res, 400, JSON.stringify({ ok:false, error:"Missing backend product name or backend amount" }), "application/json");
      }
      if (!downloadLink && !r2ObjectKey) {
        return send(res, 400, JSON.stringify({ ok:false, error:"Premium Download File Link atau Cloudflare R2 Private Object Key belum diset untuk produk ini. Sila hubungi admin." }), "application/json");
      }

      const orderId = makeId("ord");
      const token = makeId("dl").replace(/[^a-zA-Z0-9_-]/g, "");
      const now = Date.now();
      const order = {
        orderId,
        productId,
        productName,
        amount,
        amountSen,
        saleAmount: Number(amountSen)/100,
        saleAmountText: amount,
        status: "paid",
        paymentMethod,
        paymentReference,
        user,
        product:{ ...product, id:productId, productId, name:productName, price:amount, r2ObjectKey, r2Key:r2ObjectKey },
        downloadLink,
        premiumDownloadFileLink: downloadLink,
        r2ObjectKey,
        r2Key:r2ObjectKey,
        trustedProductSource: trustedResolved.trustedSource || "backend",
        isAdminTestPurchase: !!trustedResolved.isAdminTestPurchase,
        clientPriceIgnored: cleanPremiumText(requestedProduct.price || data.amount || data.price || "", 40),
        shareReferral:azReferralFrom(data, product, {productId}),
        productOwner:azProductOwnerFrom(product, {productId}),
        createdAt: new Date(now).toISOString(),
        paidAt: new Date(now).toISOString(),
        downloadToken: token,
        tokenExpiresAt: new Date(expiresAtMs).toISOString(),
        expiresNever,
        expiryHours: requestedExpiryHours,
        linkExpiryHours: requestedExpiryHours,
        maxDownload: requestedLimit,
        completedByUid: cleanPremiumText(adminIdentity.uid || "", 120),
        completedByUsername: cleanPremiumText(adminIdentity.username || "", 80),
        completedByRole: cleanPremiumText(adminIdentity.role || "admin", 40),
        completedByAuthMethod: cleanPremiumText(adminIdentity.authMethod || "firebase", 40),
        completedAt: new Date(now).toISOString(),
        receiptTokenRequired: true,
        receiptTokenVersion: 2
      };
      savePremiumOrder(order);
      await azFinalizeCommissionForOrder(order);
      savePremiumToken({
        token,
        orderId,
        productId,
        productName,
        user,
        downloadLink,
        premiumDownloadFileLink: downloadLink,
        r2ObjectKey,
        r2Key:r2ObjectKey,
        product:{ ...product, r2ObjectKey, r2Key:r2ObjectKey },
        createdAt: now,
        expiresAt: expiresAtMs,
        expiresNever,
        expiryHours: requestedExpiryHours,
        usedCount: 0,
        maxDownload: requestedLimit
      });
      azFireAndForget(azWriteAdminAuditLog(req, adminIdentity, "manual_complete_purchase", "premiumOrder", orderId, { orderId, productId, productName, saleAmount: order.saleAmount, paymentMethod, paymentReference, trustedProductSource: order.trustedProductSource, isAdminTestPurchase: order.isAdminTestPurchase }, "success"), "Manual complete purchase audit log failed");

      return send(res, 200, JSON.stringify({
        ok: true,
        orderId,
        status: "paid",
        message: "Purchase completed. A temporary download link has been generated.",
        downloadUrl: azPreferredPremiumDownloadUrl({ ...order, token, downloadToken:token, expiresAt:expiresAtMs, maxDownload:requestedLimit, r2ObjectKey, r2Key:r2ObjectKey }, publicBaseUrlFromReq(req)),
        receiptUrl: `/api/premium/receipt/${encodeURIComponent(orderId)}?rt=${encodeURIComponent(azMakeReceiptToken(order))}`,
        expiresAt: order.tokenExpiresAt,
        maxDownload: requestedLimit
      }, null, 2), "application/json");
    }

    if (pathname === "/api/premium/r2-usage-sync" && req.method === "POST") {
      const raw = await readBody(req);
      const supplied = String(req.headers["x-azobss-r2-signature"] || "").trim();
      const expected = crypto.createHmac("sha256", azR2TokenSecret()).update(String(raw || "")).digest("base64")
        .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      const a = Buffer.from(supplied);
      const b = Buffer.from(expected);
      if (!supplied || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return send(res, 403, JSON.stringify({ ok:false, error:"INVALID_R2_SYNC_SIGNATURE" }), "application/json");
      }
      let data = {};
      try { data = JSON.parse(raw || "{}"); } catch (_) { return send(res, 400, JSON.stringify({ ok:false, error:"INVALID_JSON" }), "application/json"); }
      const token = cleanPremiumText(data.token || data.backendToken || "", 220).replace(/[^a-zA-Z0-9_-]/g, "");
      if (!token) return send(res, 400, JSON.stringify({ ok:false, error:"TOKEN_REQUIRED" }), "application/json");
      let saved = findPremiumToken(token);
      if (!saved) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (_) {}
        if (saved) { try { savePremiumToken({ ...saved, token:saved.token || token }); } catch (_) {} }
      }
      if (!saved) return send(res, 404, JSON.stringify({ ok:false, error:"TOKEN_NOT_FOUND" }), "application/json");
      const used = Math.max(Number(saved.usedCount || 0), Math.max(0, Number(data.usedCount || 0) || 0));
      const max = Math.max(1, Number(data.maxDownload || saved.maxDownload || saved.maxDownloads || 1) || 1);
      const now = Date.now();
      const patch = { usedCount:used, downloadCount:used, downloadsUsed:used, maxDownload:max, maxDownloads:max, downloadLimit:max, lastUsedAt:now, lastMethod:"R2_WORKER_DIRECT_GATE", r2WorkerUsageId:cleanPremiumText(data.usageId || "", 100), r2WorkerUsageSyncedAt:new Date(now).toISOString(), r2WorkerUsageSyncedAtMs:now, secureDownloadPatch:AZOBSS_R2_DOWNLOAD_PATCH };
      const updated = updatePremiumToken(token, row => ({ ...row, ...patch })) || { ...saved, ...patch, token };
      if (!findPremiumToken(token)) { try { savePremiumToken(updated); } catch (_) {} }
      azFireAndForget(azUpdatePremiumTokenPersistent(token, patch), "R2 Worker usage persistent sync failed:");
      try { azSyncPremiumOrderDownloadUsage(updated, token, used, "", 0, now); } catch (_) {}
      return send(res, 200, JSON.stringify({ ok:true, token:azMaskToken(token), usedCount:used, maxDownload:max }), "application/json");
    }

    if (pathname.startsWith("/api/premium/download/") && req.method === "POST") {
      const token = decodeURIComponent(path.basename(pathname)).replace(/[^a-zA-Z0-9_-]/g, "");
      let saved = findPremiumToken(token);
      if (!saved) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (err) { console.warn("Premium token Firestore lookup failed:", err && (err.message || err)); }
        if (saved) {
          try { savePremiumToken({ ...saved, token: saved.token || token }); } catch (_) {}
        }
      }
      if (!saved) return send(res, 403, "Download link expired or already used too many times.");
      try {
        const sessionId = await azCreatePremiumDownloadSession(req, token, { ...saved, token });
        const session = await azFindPremiumSessionDeep(sessionId);
        const location = session && session.sourceType === "r2"
          ? azR2DownloadUrlForSession(session)
          : `/api/premium/download-session/${encodeURIComponent(sessionId)}`;
        if (!location) throw Object.assign(new Error("R2 download gateway is not configured."), { statusCode: 503 });
        if (session && session.sourceType === "r2") updatePremiumDownloadSession(sessionId, { r2RedirectAt: new Date().toISOString(), r2RedirectAtMs: Date.now(), deliveryMode: "cloudflare-r2-worker" });
        res.writeHead(303, azNoStoreDownloadHeaders({ Location: location, "X-AZOBSS-Download-Mode": session && session.sourceType === "r2" ? "r2-worker" : "backend-stream" }));
        res.end();
        return;
      } catch (err) {
        try { if (saved) azSyncPremiumOrderTokenState({ ...saved, token }, token); } catch (_) {}
        const status = err && err.statusCode ? err.statusCode : 500;
        const message = status >= 500 ? "Download cannot start. Please contact admin." : (err && err.message ? err.message : "Download cannot start.");
        console.warn("AZOBSS secure premium download start failed:", err && (err.message || err));
        return send(res, status, message);
      }
    }

    if (pathname.startsWith("/api/premium/download/") && req.method === "GET") {
      const token = decodeURIComponent(path.basename(pathname));
      let saved = findPremiumToken(token);
      if (!saved) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (err) { console.warn("Premium token Firestore lookup failed:", err && (err.message || err)); }
      }
      if (!saved || azobssTokenIsExpired(saved) || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
        if (saved) azSyncPremiumOrderTokenState({ ...saved, token }, token);
        return send(res, 403, "Download link expired or already used too many times.");
      }

      // Email scanners/prefetchers use GET. GET now always shows a safe gate and never consumes quota.
      // The real download only starts after a human presses the POST form button.
      const order = findPremiumOrderByAny({ orderId: saved.orderId }) || {}; // Patch 707: never wait for Firestore just to render the confirmation label.
      const expiresNever = saved.expiresNever === true || azobssOrderNeverExpire(order);
      const expires = expiresNever ? "Never expire" : (saved.expiresAt ? new Date(Number(saved.expiresAt)).toLocaleString("en-MY", { timeZone:"Asia/Kuala_Lumpur" }) : "-");
      const actionUrl = `/api/premium/download/${encodeURIComponent(token)}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>AZOBSS Download Confirm</title><style>body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;padding:24px}.box{max-width:680px;margin:40px auto;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px}button.btn{border:0;cursor:pointer;background:#16a34a;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:800;font-size:16px}.muted{color:#94a3b8}.warn{color:#fbbf24}.small{font-size:12px}</style></head><body><div class="box"><h1>AZOBSS Download Ready ✅</h1><p><b>Product:</b> ${String(order.productName || saved.productName || "AZOBSS Digital Product")}</p><p class="muted">Click the button below to start the actual download. This preview page does not use your download quota.</p><form method="POST" action="${actionUrl}"><button class="btn" type="submit">Start Download</button></form><p class="warn">Download quota is used only once when this secure session starts. IDM/browser Range requests inside the same session will not add extra quota.</p><p class="muted">Used: ${Number(saved.usedCount||0)} / ${Number(saved.maxDownload||1)}<br>Expires: ${expires}</p><p class="muted small">Security: GET/email previews will not consume the token. POST creates a short secure session. Migrated products use a temporary signed private R2 Worker link; the bucket URL and storage credentials are never exposed.</p></div></body></html>`;
      return send(res, 200, html, "text/html; charset=utf-8");
    }


    if (pathname.startsWith("/api/premium/download-status/") && req.method === "GET") {
      const token = decodeURIComponent(path.basename(pathname)).replace(/[^a-zA-Z0-9_-]/g, "");
      let saved = token ? findPremiumToken(token) : null;
      if (!saved && token) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (err) { console.warn("Premium token status Firestore lookup failed:", err && (err.message || err)); }
        if (saved) {
          try { savePremiumToken({ ...saved, token: saved.token || token }); } catch (_) {}
        }
      }
      if (!saved) {
        return send(res, 404, JSON.stringify({ ok:false, error:"TOKEN_NOT_FOUND" }), "application/json");
      }
      const now = Date.now();
      const used = Math.max(0, Number(saved.usedCount || saved.downloadCount || saved.downloadsUsed || 0) || 0);
      const max = Math.max(1, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1);
      const expiresNever = saved.expiresNever === true || azobssOrderNeverExpire(saved);
      const expiresAtMs = azMyPurchasesTokenMs(saved.expiresAtMs || saved.expiresAt || saved.tokenExpiresAtMs || saved.tokenExpiresAt || saved.downloadExpiresAtMs);
      const expiredByTime = !expiresNever && !!(expiresAtMs && now > expiresAtMs);
      const exhausted = used >= max || String(saved.downloadStatus || "").toLowerCase() === "used" || saved.downloadExpired === true;
      const expired = expiredByTime || exhausted;
      try { azSyncPremiumOrderTokenState({ ...saved, token }, token, now); } catch (_) {}
      return send(res, 200, JSON.stringify({
        ok: true,
        token,
        usedCount: used,
        downloadCount: used,
        downloadsUsed: used,
        maxDownload: max,
        maxDownloads: max,
        downloadLimit: max,
        expiresAtMs,
        tokenExpiresAtMs: expiresAtMs,
        downloadExpiresAtMs: expiresAtMs,
        expiredByTime,
        exhausted,
        downloadExpired: expired,
        downloadActive: !expired && used < max,
        downloadStatus: exhausted ? "used" : (expiredByTime ? "expired" : "active"),
        downloadUrl: (!expired && used < max) ? azPreferredPremiumDownloadUrl({ ...saved, token, downloadToken:token, usedCount:used, maxDownload:max, expiresAt:expiresAtMs }, publicBaseUrlFromReq(req)) : "",
        patch: "AZOBSS_MY_PURCHASES_TOKEN_STATUS_383"
      }), "application/json");
    }

    if (pathname === "/api/premium/download-health" && req.method === "GET") {
      return send(res, 200, JSON.stringify({
        ok: true,
        patch: AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH,
        mode: azR2Configured() ? "private-r2-worker-with-backend-stream-fallback" : "backend-stream-fallback",
        rangeSupport: true,
        sessionTtlMs: azPremiumSessionTtlMs(),
        r2Configured: azR2Configured(),
        r2BaseUrl: azR2DownloadBaseUrl(),
        r2TokenTtlSeconds: azR2TokenTtlSeconds(),
        r2PreflightMode: azR2PreflightMode(),
        r2PreflightBlocking: azR2PreflightMode() === "blocking",
        r2Patch: AZOBSS_R2_DOWNLOAD_PATCH,
        sessionStore: "local-json+firestore-if-configured",
        workerDirectGate: true,
        r2GateTtlSeconds: azR2GateTtlSeconds(),
        note: "R2 products use a signed Cloudflare Worker confirmation gate so Render Free cold-start is removed from the customer download click. Legacy/backend-stream products retain the existing fallback."
      }, null, 2), "application/json");
    }

    if (pathname.startsWith("/api/premium/download-session/") && (req.method === "GET" || req.method === "HEAD")) {
      const sessionId = decodeURIComponent(path.basename(pathname));
      return await azHandlePremiumDownloadSession(req, res, sessionId);
    }

    if (pathname.startsWith("/api/premium/receipt/") && req.method === "GET") {
      const orderId = decodeURIComponent(path.basename(pathname));
      const order = await azFindReceiptOrder(orderId);
      if (!order) return send(res, 404, "Receipt not found");
      if (azReceiptStatusBucket(order) !== "paid") return send(res, 403, "Receipt locked until payment is verified.");
      const rt = cleanPremiumText(parsed.query.rt || parsed.query.token || "", 80);
      if (!azReceiptTokenOk(order, rt)) return send(res, 403, "Receipt token required or invalid.");
      if ((order.billCode || String(order.paymentMethod || "").toLowerCase().includes("toyyib")) && !isPaBmPremiumOrder(order) && !(order.toyyibVerifiedAt || order.paymentVerificationSource === "toyyibpay-api")) {
        return send(res, 403, "Receipt locked until ToyyibPay confirms paid.");
      }
      if (String(parsed.query.format || "").toLowerCase() === "pdf") {
        const pdf = await buildReceiptPdfBuffer(azNormalizePaymentReceiptOrder(order, "premiumOrders"));
        const disposition = String(parsed.query.download || "") === "1" ? "attachment" : "inline";
        res.writeHead(200, azSecurityHeaders({
          "Content-Type":"application/pdf",
          "Content-Disposition": `${disposition}; filename="${azReceiptFilename(order, "pdf")}"`
        }));
        res.end(pdf);
        return;
      }
      return send(res, 200, buildReceiptHtml(azNormalizePaymentReceiptOrder(order, "premiumOrders")), "text/html; charset=utf-8");
    }

    // =========================
    // BLOCK DIRECT TEMP ACCESS
    // =========================

    if (
      pathname === "/temp" ||
      pathname.startsWith("/temp/") ||
      pathname === "/private-tech-vault" ||
      pathname.startsWith("/private-tech-vault/") ||
      pathname === "/_private-tech-vault" ||
      pathname.startsWith("/_private-tech-vault/") ||
      pathname === "/tech-vault-files.json"
    ) {
      return send(
        res,
        403,
        "Forbidden"
      );
    }

    // =========================
    // STATIC FILES
    // =========================

    const filePath =
      safePath(pathname);

    if (!filePath) {
      return send(res, 403, "Forbidden");
    }

    if (
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {

      return send(
        res,
        404,
        "File Not Found"
      );
    }

    const data =
      fs.readFileSync(filePath);

    return send(
      res,
      200,
      data,
      mimeType(filePath),
      azStaticCacheHeaders(filePath)
    );

  } catch (err) {

    console.error(err);

return send(
  res,
  500,
  JSON.stringify({
    ok: false,
    error: err.message,
    name: err.name,
    cause: err.cause
      ? String(err.cause)
      : null,
    stack: err.stack
  }, null, 2),
  "application/json"
);
  }
}

// =========================
// AUTO CLEAN TEMP FILES
// =========================

function cleanupTempFiles() {

  try {

    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    const files =
      fs.readdirSync(TEMP_DIR);

    const now = Date.now();

    for (const file of files) {

      const fullPath =
        path.join(TEMP_DIR, file);

      try {

        const stat =
          fs.statSync(fullPath);

        const age =
          now - stat.mtimeMs;

        // DELETE FILE > 30 DAYS
        if (stat.isFile() && age > FILE_EXPIRE_MS) {

          fs.unlinkSync(fullPath);

          console.log(
            "Deleted old file:",
            file
          );
        }

      } catch (err) {

        console.error(
          "Cleanup file error:",
          file,
          err.message
        );
      }
    }

  } catch (err) {

    console.error(
      "Cleanup temp error:",
      err.message
    );
  }
}

// RUN EVERY 12 HOURS
setInterval(
  () => {
    cleanupTempFiles();
    cleanupLotCacheFiles();
  },
  12 * 60 * 60 * 1000
);

// RUN ON STARTUP
cleanupTempFiles();
cleanupLotCacheFiles();

const HOST = "0.0.0.0";
const SERVER_PORT = Number(process.env.PORT || PORT || 10000);

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Unhandled request error:", error && (error.stack || error.message) || error);
    if (!res.headersSent) {
      res.writeHead(500, azSecurityHeaders({ "Content-Type": "application/json" }));
      res.end(JSON.stringify({ ok: false, error: "Internal server error" }));
    } else {
      try { res.end(); } catch (_) {}
    }
  });
});

server.on("error", (error) => {
  console.error("Server listen error:", error && (error.stack || error.message) || error);
  process.exitCode = 1;
});

server.listen(SERVER_PORT, HOST, () => {

  console.log("");
  console.log("================================");
  console.log(" AZOBSS BACKEND RUNNING");
  console.log("================================");
  console.log("HOST:", HOST);
  console.log("PORT:", SERVER_PORT);
  console.log("ROOT:", ROOT);
  console.log("HEALTH:", `/api/create-payment`);
  console.log("SUBSCRIPTION_HEALTH:", `/api/subscription/health`);
  console.log("AZOBSS_PATCH:", "413-subscription-route-diagnostic");
  console.log("STRIPE_DIGITAL_HEALTH:", `/api/stripe/digital-checkout-health`);
  console.log("STRIPE_WEBHOOK:", `/api/stripe/webhook`);
  console.log("STRIPE_WEBHOOK_HEALTH:", `/api/stripe/webhook-health`);
  console.log("================================");
  console.log("");

});
