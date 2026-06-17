
function azobssNum(v, fallback){
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function azobssExpiryHoursFromOrder(order){
  const direct = azobssNum(order && (order.expiryHours || order.linkExpiryHours || order.downloadExpiryHours), 0);
  if(direct) return direct;
  const days = azobssNum(order && (order.expiryDays || order.linkExpiryDays || order.downloadExpiryDays), 0);
  if(days) return days * 24;
  const text = String(order && (order.linkExpiry || order.expiry || order.expiryLabel || '') || '').toLowerCase();
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
function azobssDownloadLimitFromOrder(order){
  return azobssNum(order && (order.downloadLimit || order.maxDownloads || order.maxDownload || order.download_limit), 1);
}


// Allow PA/BM download proxy to fetch JUPEM resources even when the remote SSL chain is incomplete on Render/Node.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0";

// AZOBSS Render Backend Server
// Supports: website hosting + affiliate online sync + JUPEM PA hold system

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const crypto = require("crypto");
let nodemailer = null;
try { nodemailer = require("nodemailer"); } catch (e) { nodemailer = null; }
let sharp = null;
let PDFDocument = null;

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
const AZOBSS_COMMISSION_API_SECRET = String(process.env.AZOBSS_COMMISSION_API_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || "").trim();

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
    downloadLimit: Number(item.downloadLimit || item.maxDownload || item.maxDownloads || 1) || 1,
    expiryHours: Number(item.expiryHours ?? item.linkExpiryHours ?? item.downloadExpiryHours ?? 24) || 24
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
    for (const field of ["productId", "id", "sku"]) {
      try {
        const qs = await db.collection(col).where(field, "==", productId).limit(1).get();
        if (!qs.empty) {
          const doc = qs.docs[0];
          return azNormalizeTrustedProduct({ docId: doc.id, ...(doc.data() || {}) }, "firestore:" + col);
        }
      } catch (_) {}
    }
  }
  return null;
}
async function azResolveTrustedPremiumProduct(data = {}, req = null) {
  const clientProduct = data.product || {};
  const user = getPremiumUser(data);
  const productId = azProductIdFromAny(clientProduct, data);
  if (!productId) {
    throw new Error("Missing productId. Backend price validation requires productId.");
  }

  let trusted = await azFindFirestoreProduct(productId);
  if (!trusted) trusted = azFindLocalSoftwareProduct(productId);

  // Admin-only RM1 test purchase: keep real product metadata/file if found, but lock test amount to RM1.
  if (azIsAdminTestPurchase(data, clientProduct)) {
    if (!azIsAdminTestUser(user, data, clientProduct)) {
      throw new Error("Admin test purchase RM1 is not allowed for this account.");
    }
    const base = trusted || azNormalizeTrustedProduct(clientProduct, "admin-test-client-metadata");
    const testDownload = cleanPremiumUrl(base.secureDownloadLink || base.premiumDownloadFileLink || base.privateDownloadLink || base.downloadLink || clientProduct.secureDownloadLink || clientProduct.premiumDownloadFileLink || clientProduct.privateDownloadLink || clientProduct.downloadLink || data.downloadLink || "");
    if (!testDownload) throw new Error("Download link belum diset untuk produk ini.");
    return {
      product: { ...base, id: productId, productId, name: cleanPremiumText((base.name || clientProduct.name || "AZOBSS Digital Product") + " (Admin Test RM1)", 160), price: "RM1", isAdminTestPurchase: true, secureDownloadLink: testDownload, premiumDownloadFileLink: testDownload, privateDownloadLink: testDownload, downloadLink: testDownload },
      amountText: "RM1",
      amountSen: 100,
      downloadLink: testDownload,
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
  const amountSen = parseAmountToSen(trusted.price || trusted.amount || "");
  if (!amountSen) throw new Error("Backend product price is invalid.");
  const downloadLink = cleanPremiumUrl(trusted.secureDownloadLink || trusted.premiumDownloadFileLink || trusted.privateDownloadLink || trusted.downloadLink || trusted.fileUrl || "");
  if (!downloadLink) throw new Error("Download link belum diset untuk produk ini.");
  return {
    product: trusted,
    amountText: cleanPremiumText(trusted.price || `RM${(amountSen/100).toFixed(2)}`, 40),
    amountSen,
    downloadLink,
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
  if (!supplied) return process.env.AZOBSS_REQUIRE_RECEIPT_TOKEN === "1" ? false : true;
  try { return crypto.timingSafeEqual(Buffer.from(String(supplied)), Buffer.from(expected)); } catch (_) { return String(supplied) === expected; }
}

function cleanForToyyib(value, max = 100) {
  return String(value || "").replace(/[^a-zA-Z0-9 _.,@+\-()]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
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
  const idx = orders.findIndex(o => o.orderId === order.orderId || (order.billCode && o.billCode === order.billCode));
  if (idx >= 0) orders[idx] = { ...orders[idx], ...order, updatedAt: new Date().toISOString() };
  else orders.unshift({ ...order, updatedAt: new Date().toISOString() });
  writePremiumOrders(orders);
  const saved = idx >= 0 ? orders[idx] : orders[0];
  azFireAndForget(azPersistPremiumOrder(saved), "AZOBSS premium order Firestore persist failed:");
  return saved;
}
function findPremiumOrderByAny(ref = {}) {
  return readPremiumOrders().find(o => (ref.orderId && o.orderId === ref.orderId) || (ref.billCode && o.billCode === ref.billCode) || (ref.billcode && o.billCode === ref.billcode)) || null;
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
async function sendBrevoApiEmail({ to, subject, html, text }) {
  const apiKey = getBrevoApiKey();
  if (!apiKey) throw new Error("BREVO_API_KEY missing");
  const fromEmail = cleanPremiumText(process.env.MAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || "", 180);
  if (!fromEmail) throw new Error("MAIL_FROM missing");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: process.env.MAIL_FROM_NAME || "AZOBSS", email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
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
function buildAzobssDownloadEmail(order, downloadUrl, receiptUrl) {
  const expires = order.tokenExpiresAt ? new Date(order.tokenExpiresAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "24 jam";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#111"><div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px"><h2 style="margin-top:0">AZOBSS Download Ready ✅</h2><p>Thank you for your purchase. Your payment has been verified successfully.</p><p><b>Product:</b> ${String(order.productName || "AZOBSS Digital Product")}<br><b>Order ID:</b> ${String(order.orderId || "-")}<br><b>Amount:</b> ${String(order.amount || "-")}</p><p><a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700">Download Now</a></p><p style="color:#374151;font-size:13px">This secure button will open a confirmation page first. Download count is only used after you press Start Download.</p><p style="color:#b45309"><b>Important:</b> This link opens a confirmation page first. Download count is only used after you press Start Download. If it is not used, the link will expire on ${expires}.</p><p><a href="${receiptUrl}">View receipt</a></p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="font-size:12px;color:#6b7280">AZOBSS Digital Store</p></div></body></html>`;
}
async function maybeSendDownloadEmail(order, req) {
  try {
    let current = order || {};

    // PA/BM purchases are downloaded from Latest Purchase List with controlled 5x/7-day access.
    // Do not run Premium Software email/token logic for PA/BM; it creates misleading NO_DOWNLOAD_LINK logs.
    if (isPaBmPremiumOrder(current)) {
      console.log("AZOBSS PA/BM email skipped: download is managed inside Latest Purchase List", JSON.stringify({ orderId: current.orderId || "", billCode: current.billCode || "" }).slice(0, 500));
      return upsertPremiumOrder({ ...current, emailSkippedForPaBm: true, emailError: null });
    }
    const email = cleanPremiumText(current?.user?.email || current?.buyerEmail || current?.email || current?.billEmail || "", 180);
    const realDownloadLink = cleanPremiumUrl(
      current.downloadLink ||
      current.premiumDownloadFileLink ||
      current.secureDownloadLink ||
      current.privateDownloadLink ||
      current.downloadUrl ||
      ""
    );

    console.log("AZOBSS EMAIL TARGET:", email || "NO_EMAIL");
    console.log("AZOBSS DOWNLOAD LINK:", realDownloadLink || "NO_DOWNLOAD_LINK");
    console.log("AZOBSS MAIL READY:", mailReady() ? "YES" : "NO", JSON.stringify({
      brevoApi: brevoApiReady(),
      nodemailer: !!nodemailer,
      SMTP_HOST: !!process.env.SMTP_HOST,
      SMTP_PORT: !!process.env.SMTP_PORT,
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASS: !!process.env.SMTP_PASS,
      BREVO_API_KEY: !!getBrevoApiKey()
    }));

    if (!email) return upsertPremiumOrder({ ...current, emailError: "Buyer email missing", emailErrorAt: new Date().toISOString() });
    if (!realDownloadLink) return upsertPremiumOrder({ ...current, emailError: "Premium Download File Link missing", emailErrorAt: new Date().toISOString() });
    if (current.emailSentAt) return current;
    if (!mailReady()) return upsertPremiumOrder({ ...current, emailError: "Email not ready. Set BREVO_API_KEY + MAIL_FROM, or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.", emailErrorAt: new Date().toISOString() });

    // Ensure the order and token always carry the real premium download target.
    current = upsertPremiumOrder({ ...current, email, buyerEmail: email, downloadLink: realDownloadLink, premiumDownloadFileLink: realDownloadLink });
    current = makeDownloadForOrder(current);

    const base = publicBaseUrlFromReq(req);
    const downloadUrl = `${base}/api/premium/download/${encodeURIComponent(current.downloadToken)}`;
    const receiptUrl = azReceiptUrl(base, current);
    console.log("AZOBSS SENDING DOWNLOAD EMAIL", JSON.stringify({orderId:current.orderId,email,downloadToken:current.downloadToken,downloadLink:realDownloadLink}).slice(0,800));

    const subject = `AZOBSS Download Ready - ${cleanPremiumText(current.productName || "Digital Product", 80)}`;
    const html = buildAzobssDownloadEmail(current, downloadUrl, receiptUrl);
    const text = `AZOBSS Download Ready

Product: ${current.productName}
Order ID: ${current.orderId}
Download: ${downloadUrl}
Receipt: ${receiptUrl}

This link opens a confirmation page first. Download count is only used after you press Start Download.`;

    let sendInfo = null;
    if (brevoApiReady()) {
      console.log("AZOBSS BREVO API SEND START", JSON.stringify({ orderId: current.orderId, email, from: process.env.MAIL_FROM || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || "" }).slice(0,500));
      sendInfo = await sendBrevoApiEmail({ to: email, subject, html, text });
      console.log("AZOBSS BREVO API SENT OK", JSON.stringify({ orderId: current.orderId, email, response: sendInfo }).slice(0,800));
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
      console.log("AZOBSS SMTP EMAIL SENT OK", JSON.stringify({ orderId: current.orderId, email, messageId: sendInfo && sendInfo.messageId || null }).slice(0,500));
    }

    console.log("AZOBSS EMAIL SENT OK", JSON.stringify({ orderId: current.orderId, email, via: brevoApiReady() ? "brevo-api" : "smtp" }).slice(0,500));
    return upsertPremiumOrder({ ...current, emailSentAt: new Date().toISOString(), emailTo: email, emailError: null });
  } catch (e) {
    console.error("AZOBSS email send failed:", e && (e.stack || e.message || e));
    return upsertPremiumOrder({ ...(order || {}), emailError: e.message || String(e), emailErrorAt: new Date().toISOString() });
  }
}
function makeDownloadForOrder(order) {
  if (!order || order.downloadToken) return order;
  const token = makeId("dl").replace(/[^a-zA-Z0-9_-]/g, "");
  const now = Date.now();
  const expiryHours = Math.max(1, Math.min(24 * 30, Number(order.expiryHours || 24)));
  const expiresAtMs = now + expiryHours * 60 * 60 * 1000;
  const realDownloadLink = cleanPremiumUrl(order.downloadLink || order.premiumDownloadFileLink || order.secureDownloadLink || order.privateDownloadLink || order.downloadUrl || "");
  savePremiumToken({ token, orderId: order.orderId, productId: order.productId, productName: order.productName, user: order.user || {}, downloadLink: realDownloadLink, premiumDownloadFileLink: realDownloadLink, createdAt: now, expiresAt: expiresAtMs, usedCount: 0, maxDownload: 1 });
  return upsertPremiumOrder({ ...order, downloadLink: realDownloadLink, premiumDownloadFileLink: realDownloadLink, downloadToken: token, tokenExpiresAt: new Date(expiresAtMs).toISOString(), maxDownload: 1 });
}
async function refreshToyyibOrder(order, req) {
  if (!order || !order.billCode) return order;
  try {
    const result = await postToyyib("getBillTransactions", { billCode: order.billCode });
    const tx = Array.isArray(result) ? result[0] : null;
    const paid = !!(tx && String(tx.billpaymentStatus || tx.billStatus || tx.status || "") === "1");
    if (!paid) return order;
    let paidOrder = upsertPremiumOrder({ ...order, status: "paid", paymentMethod: "toyyibpay", paymentReference: tx.billpaymentInvoiceNo || tx.transaction_id || tx.refno || order.paymentReference || "", toyyibTransaction: tx, paidAt: new Date().toISOString() });
    try { await azFinalizeCommissionForOrder(paidOrder); } catch (commissionError) { console.warn("Commission finalize skipped:", commissionError && (commissionError.message || commissionError)); }
    try { await azobssUpdatePaBmPurchaseLogsForOrder(paidOrder, "paid", { paymentReference: paidOrder.paymentReference, toyyibTransaction: tx }); } catch (syncError) { console.warn("PA/BM purchaseLogs paid sync failed:", syncError && (syncError.message || syncError)); }
    if (!isPaBmPremiumOrder(paidOrder)) {
      paidOrder = makeDownloadForOrder(paidOrder);
      await maybeSendDownloadEmail(paidOrder, req);
    }
    return findPremiumOrderByAny({ orderId: paidOrder.orderId }) || paidOrder;
  } catch (e) {
    console.error("ToyyibPay refresh failed:", e.message);
    return order;
  }
}
function paidPayload(order, req) {
  const base = publicBaseUrlFromReq(req);
  const o = makeDownloadForOrder(order);
  return { ok: true, success: true, paid: true, orderId: o.orderId, status: o.status, downloadUrl: `${base}/api/premium/download/${encodeURIComponent(o.downloadToken)}`, receiptUrl: azReceiptUrl(base, o), expiresAt: o.tokenExpiresAt, maxDownload: 1 };
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
  return String(record && (record.productType || record.product || record.type) || "").trim().toUpperCase();
}
function azobssPaBmRecordCode(record) {
  return String(record && (record.itemCode || record.pa || record.noPA || record.stesen || record.stationNo || record.code) || "").trim().toUpperCase();
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
async function azobssGetPurchaseRecord(recordId) {
  if (!initFirebaseAdmin()) {
    throw new Error("Firebase Admin is not configured on backend. " + (firebaseAdminInitError || ""));
  }

  const db = firebaseAdmin.firestore();
  const id = String(recordId || "").trim();
  const ref = db.collection("purchaseLogs").doc(id);

  if (!id) return { ref, record: null };

  // 1) Normal path: purchaseLogs/{recordId}
  const snap = await ref.get();
  if (snap.exists) {
    return { ref, record: Object.assign({ firestoreId: snap.id }, snap.data() || {}) };
  }

  // 2) Compatibility path:
  // Older AZOBSS builds saved paid/pending PA-BM records inside users/{username}.purchaseRecords
  // but did not always create purchaseLogs. If Download button sends that embedded id,
  // migrate it into purchaseLogs automatically so 5x/7-day limit can work.
  let found = null;
  let foundUser = null;

  const usersSnap = await db.collection("users").get();
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
    maxDownloads: max,
    downloadExpiresAtMs: azobssRecordExpiresAtMs(record),
    downloadExpiresAtClient: new Date(azobssRecordExpiresAtMs(record)).toISOString(),
    lastDownloadedAtMs: nowMs,
    lastDownloadedAtClient: new Date(nowMs).toISOString(),
    updatedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
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
    paymentMethod: "toyyibpay",
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

  let updated = 0;
  for (const item of order.paBmItems) {
    const id = String(item && (item.id || item.firestoreId || item.purchaseLogId || item.recordId) || "").trim();
    if (!id || id.startsWith("local-")) continue;
    const update = {
      ...baseUpdate,
      productType: String(item.productType || item.product || "").toUpperCase() || undefined,
      itemCode: String(item.itemCode || item.code || "").toUpperCase() || undefined,
      negeri: String(item.negeri || item.state || "") || undefined,
      amount: Number(item.amount || 0) || undefined
    };
    Object.keys(update).forEach((key) => { if (update[key] === undefined || update[key] === "") delete update[key]; });
    try {
      await db.collection("purchaseLogs").doc(id).set(update, { merge: true });
      updated += 1;
    } catch (error) {
      console.error("PA/BM purchaseLogs item update failed:", id, error && (error.stack || error.message || error));
    }
  }

  console.log("PA/BM purchaseLogs order sync:", JSON.stringify({ orderId: order.orderId || "", billCode: order.billCode || "", status, updated }).slice(0, 500));
  return { ok: updated > 0, updated };
}

function azobssPaBmDownloadError(res, status, message) {
  return send(res, status, JSON.stringify({ ok: false, error: message }, null, 2), "application/json");
}

function buildUserEmail(usernameKey) {
  return `${usernameKey}@azobss.local`;
}


const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

const AFFILIATE_JSON = path.join(ROOT, "affiliate-products.json");
const TEMP_DIR = path.join(ROOT, "temp");
const DOWNLOAD_TOKENS = new Map();

const PREMIUM_ORDERS_FILE = path.join(ROOT, "premium-orders.json");
const PREMIUM_TOKENS_FILE = path.join(ROOT, "premium-download-tokens.json");
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

function cleanPremiumUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return "";
}

function getPremiumUser(data) {
  const user = data.user || {};
  return {
    uid: cleanPremiumText(user.uid || data.uid, 120),
    username: cleanPremiumText(user.username || user.usernameKey || data.username, 80),
    email: cleanPremiumText(user.email || data.buyerEmail || data.email || data.customerEmail || data.billEmail, 160),
    phone: cleanPremiumText(user.phone || data.phone || data.buyerPhone || '01135600723', 40)
  };
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
async function azPersistPremiumOrder(order = {}) {
  if (!order || !order.orderId) return { ok:false, reason:"missing-order-id" };
  const db = getAzobssBackendDb();
  if (!db) return { ok:false, reason:"firebase-not-ready" };
  const safe = azJsonSafe({ ...order, updatedAt: new Date().toISOString() });
  await db.collection("premiumOrders").doc(String(order.orderId)).set(safe, { merge:true });
  return { ok:true };
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
  const ownerRole = azCleanOwnerField(p.ownerRole || p.createdByRole || p.staffRole || p.role || '', 40);
  const adminNames = new Set(['zedan91','admin','azobss']);
  const isAdminOwner = !ownerUsername || adminNames.has(ownerUsername) || /admin/i.test(ownerRole);
  return { ownerUsername, ownerUid, ownerEmail, ownerKey, ownerRole, isAdminOwner };
}
function azReferralFromUrl(value = '', product = {}, order = {}){
  try{
    const rawUrl = String(value || '').trim();
    if(!rawUrl) return null;
    const u = /^https?:\/\//i.test(rawUrl) ? new URL(rawUrl) : new URL(rawUrl, 'https://www.azobss.com');
    const ref = azCommissionUsername(u.searchParams.get('ref') || u.searchParams.get('staff') || u.searchParams.get('staffRef') || u.searchParams.get('affiliate') || '');
    if(!ref) return null;
    return {
      username: ref,
      productId: cleanPremiumText(u.searchParams.get('product') || product.id || product.productId || order.productId || '', 160),
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
  const base = {
    orderId: order.orderId || '', billCode: order.billCode || '', productId, productName,
    saleAmount, saleAmountText: azCommissionAmountText(saleAmount), buyerUsername: buyer,
    buyerEmail: cleanPremiumText(order.user?.email || '', 180), paymentStatus: order.status || 'paid',
    paymentMethod: order.paymentMethod || '', paymentReference: order.paymentReference || '',
    createdAt: new Date().toISOString(), createdAtMs: Date.now(), status: 'pending', payoutStatus: 'pending',
    source: 'software-cad-auto-commission'
  };
  const lines = [];
  const sharer = referral.username;
  const ownerName = owner.ownerUsername;
  const hasStaffOwner = !!(ownerName && !owner.isAdminOwner);
  const validSharer = !!(sharer && sharer !== buyer && (!ownerName || sharer !== ownerName));
  function add(kind, username, uid, email, rate, note){
    if(!username || !rate) return;
    const amount = Math.round((saleAmount * rate / 100) * 100) / 100;
    const azRate = Math.max(0, 100 - Number(rate || 0));
    const azobssShareAmount = Math.round((saleAmount * azRate / 100) * 100) / 100;
    const line = { ...base, commissionType: kind, username, uid: uid || '', ownerUid: uid || '', ownerUsername: username, ownerEmail: email || '', commissionRate: rate, rate, commissionAmount: amount, amount, amountText: azCommissionAmountText(amount), azobssShareRate: azRate, azobssShareAmount, azobssShareText: azCommissionAmountText(azobssShareAmount), ownerShareAmount: 0, sharerShareAmount: 0, note, shareReferral: referral, productOwner: owner };
    if (String(kind).includes('share')) line.sharerShareAmount = amount;
    else line.ownerShareAmount = amount;
    if (kind === 'owner_sale_split') { line.ownerShareAmount = amount; line.azobssShareRate = 30; line.azobssShareAmount = Math.round((saleAmount * 0.30) * 100) / 100; line.azobssShareText = azCommissionAmountText(line.azobssShareAmount); }
    if (kind === 'share_referral') { line.sharerShareAmount = amount; line.azobssShareRate = 30; line.azobssShareAmount = Math.round((saleAmount * 0.30) * 100) / 100; line.azobssShareText = azCommissionAmountText(line.azobssShareAmount); }
    lines.push(line);
  }
  if (hasStaffOwner && validSharer) {
    add('owner_sale_split', ownerName, owner.ownerUid, owner.ownerEmail, 60, 'Produk staff terjual melalui share link staff lain. Owner 60%, sharer 10%, AZOBSS 30%.');
    add('share_referral', sharer, '', '', 10, 'Staff share link berjaya menjual produk staff lain. Sharer 10%.');
  } else if (hasStaffOwner) {
    add('owner_sale', ownerName, owner.ownerUid, owner.ownerEmail, 70, 'Produk staff sendiri terjual. Owner 70%, AZOBSS 30%.');
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
  const orders = readPremiumJson(PREMIUM_ORDERS_FILE, []);
  orders.unshift(order);
  writePremiumJson(PREMIUM_ORDERS_FILE, orders.slice(0, 200));
}

function savePremiumToken(tokenData) {
  const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []);
  const now = Date.now();
  const active = tokens.filter(t => Number(t.expiresAt || 0) > now && Number(t.usedCount || 0) < Number(t.maxDownload || 3));
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

function buildReceiptHtml(order) {
  const lines = [
    ["Receipt No", order.orderId],
    ["Status", order.status],
    ["Product", order.productName],
    ["Amount", order.amount],
    ["Payment Method", order.paymentMethod],
    ["Reference", order.paymentReference || "-"],
    ["Username", order.user?.username || "-"],
    ["Email", order.user?.email || "-"],
    ["Date", new Date(order.paidAt || order.createdAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })]
  ];
  const rows = lines.map(([k,v]) => `<tr><th>${String(k)}</th><td>${String(v || "-")}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>AZOBSS Receipt ${order.orderId}</title><style>body{font-family:Arial,sans-serif;background:#f6f7fb;color:#111;padding:24px}.receipt{max-width:720px;margin:auto;background:#fff;border:1px solid #ddd;border-radius:14px;padding:24px}h1{margin-top:0}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #eee;text-align:left}th{width:180px;color:#555}.ok{color:#16a34a;font-weight:700}.print{margin-top:20px}</style></head><body><div class="receipt"><h1>AZOBSS Payment Receipt</h1><p class="ok">Payment Successful ✅</p><table>${rows}</table><p class="print"><button onclick="window.print()">Print / Save PDF</button></p></div></body></html>`;
}


// AUTO DELETE FILE > 30 DAYS
const FILE_EXPIRE_MS =
  30 * 24 * 60 * 60 * 1000;
  
function send(res, status, body, type = "text/plain; charset=utf-8") {

  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-admin-key"
  });

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

function toyyibStatusIsPaid(data = {}) {
  const values = [
    data.status_id,
    data.status,
    data.billpaymentStatus,
    data.billPaymentStatus,
    data.payment_status,
    data.paymentStatus,
    data.transaction_status
  ].map(v => String(v ?? "").trim().toLowerCase());
  return values.some(v => v === "1" || v === "paid" || v === "success" || v === "successful");
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

async function fetchJupem(jupemUrl) {
  return await fetch(jupemUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "image/tiff,image/*,*/*",
      "Referer": "https://ebiz.jupem.gov.my/"
    }
  });
}


async function fetchPelanAkuiCandidates(noPA, negeri) {
  const cleanPA = String(noPA || "")
    .trim()
    .replace(/\.tif$/i, "")
    .replace(/^PA/i, "");

  const paUpper = `PA${cleanPA}.TIF`;
  const paLower = `PA${cleanPA}.tif`;
  const paRaw = `PA${cleanPA}`;
  const stateUpper = String(negeri || "").toUpperCase();
  const stateTitle = stateUpper.charAt(0) + stateUpper.slice(1).toLowerCase();

  const candidates = [
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(paUpper)}&negeri=${encodeURIComponent(stateUpper)}`,
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPA=${encodeURIComponent(paUpper)}&negeri=${encodeURIComponent(stateUpper)}`,
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(paLower)}&negeri=${encodeURIComponent(stateUpper)}`,
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(paRaw)}&negeri=${encodeURIComponent(stateUpper)}`,
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(paUpper)}&negeri=${encodeURIComponent(stateTitle)}`,
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?NoPA=${encodeURIComponent(paUpper)}&Negeri=${encodeURIComponent(stateUpper)}`
  ];

  let lastResult = null;

  for (const url of candidates) {
    try {
      console.log("Fetching PA candidate:", url);
      const response = await fetchJupem(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const firstText = buffer.slice(0, 200).toString("utf8").toLowerCase();
      const looksHTML = firstText.includes("<html") || firstText.includes("<!doctype") || firstText.includes("not found");
      const validFile = response.ok && buffer.length > 100 && !looksHTML;

      lastResult = { response, buffer, url, firstText, validFile };

      if (validFile) {
        return lastResult;
      }
    } catch (err) {
      console.error("PA candidate failed:", url, err && err.message ? err.message : err);
      lastResult = { response: null, buffer: Buffer.alloc(0), url, firstText: "", validFile: false, error: err };
    }
  }

  return lastResult || { response: null, buffer: Buffer.alloc(0), url: "", firstText: "", validFile: false };
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


async function handler(req, res) {

  try {

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || "/";

    if (req.method === "OPTIONS") {
      return send(res, 204, "");
    }


    // =========================
    // TOYYIBPAY DYNAMIC PAYMENT ROUTES (Render deploy-server.js)
    // =========================


    if (pathname === "/api/toyyib/create-pa-bm-bill" && req.method === "POST") {
      let data = {};
      try { data = parseRequestBody(await readBody(req)); }
      catch (e) { return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Invalid request body" }), "application/json"); }
      try {
        if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
          return send(res, 500, JSON.stringify({ ok:false, success:false, error:"ToyyibPay env belum lengkap. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." }, null, 2), "application/json");
        }
        const user = getPremiumUser(data);
        const usernameKey = cleanPremiumText(data.usernameKey || user.username || "", 80).toLowerCase();
        const uid = cleanPremiumText(data.uid || user.uid || "", 120);
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items = rawItems.map((item) => ({
          id: cleanPremiumText(item.id || "", 120),
          productType: cleanPremiumText(item.productType || "PA", 20).toUpperCase(),
          itemCode: cleanPremiumText(item.itemCode || "", 80),
          negeri: cleanPremiumText(item.negeri || "", 80),
          amount: Math.max(0, Math.round(Number(item.amount || 0))),
          createdAtMs: Number(item.createdAtMs || 0) || 0
        })).filter((item) => item.itemCode && (item.amount === 3 || item.amount === 5));
        if (!items.length) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Tiada rekod PA/BM yang sah untuk dibayar." }, null, 2), "application/json");
        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        if (totalAmount <= 0) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Total bayaran tidak sah." }, null, 2), "application/json");
        const amountSen = totalAmount * 100;
        const orderId = makeId("pabm");
        const apiBase = publicBaseUrlFromReq(req);
        const returnUrl = TOYYIB_RETURN_URL || `${FRONTEND_BASE_URL}/PA-BM/?payment=return&orderId=${encodeURIComponent(orderId)}`;
        const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
        const productName = `PA/BM Purchase Records (${items.length} unit)`;
        const billPayload = {
          userSecretKey: TOYYIB_SECRET_KEY,
          categoryCode: TOYYIB_CATEGORY_CODE,
          billName: cleanForToyyib("AZOBSS PA BM", 30),
          billDescription: cleanForToyyib(`AZOBSS PA/BM Payment - ${items.length} unit - RM${totalAmount}`, 100),
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
          billContentEmail: `Thank you for your AZOBSS PA/BM payment. Total: RM${totalAmount}.`,
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
        const paBmOrder = upsertPremiumOrder({ orderId, productId:"pa-bm-purchase-records", productName, amount:`RM${totalAmount}`, amountSen, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, user:{...user, username: usernameKey || user.username, uid}, paBmItems:items, maxDownload:0, expiryHours:0, createdAt:new Date().toISOString() });
        try { await azobssUpdatePaBmPurchaseLogsForOrder(paBmOrder, "pending"); } catch (syncError) { console.warn("PA/BM purchaseLogs pending sync failed:", syncError && (syncError.message || syncError)); }
        return send(res, 200, JSON.stringify({ ok:true, success:true, orderId, billCode, paymentUrl, url:paymentUrl, redirectUrl:paymentUrl, amount:totalAmount, amountSen, unit:items.length, status:"pending" }, null, 2), "application/json");
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
        const productName = cleanPremiumText(product.name || product.productName || data.productName || data.title || "AZOBSS Digital Product", 160);
        const productId = cleanPremiumText(product.productId || product.id || data.productId || requestedProduct.productId || requestedProduct.id || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), 160);
        const amountText = cleanPremiumText(trustedResolved.amountText || product.price || "", 40);
        const amountSen = Number(trustedResolved.amountSen || parseAmountToSen(amountText));
        const downloadLink = cleanPremiumUrl(trustedResolved.downloadLink || product.secureDownloadLink || product.premiumDownloadFileLink || product.privateDownloadLink || product.downloadLink || "");
        const user = getPremiumUser(data);
        if (!productName || !amountSen) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Missing backend product name or valid backend amount." }, null, 2), "application/json");
        if (!downloadLink) return send(res, 400, JSON.stringify({ ok:false, success:false, error:"Download link belum diset untuk produk ini." }, null, 2), "application/json");
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
        upsertPremiumOrder({ orderId, productId, productName, amount: amountText, amountSen, saleAmount: Number(amountSen)/100, saleAmountText: amountText, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, returnUrl, sourceUrl: data.sourceUrl || data.pageUrl || "", pageUrl: data.pageUrl || data.sourceUrl || "", user, email:user.email || data.buyerEmail || data.email || "", buyerEmail:user.email || data.buyerEmail || data.email || "", product:{ ...product, id:productId, productId, name:productName, price:amountText }, trustedProductSource: trustedResolved.trustedSource || "backend", isAdminTestPurchase: !!trustedResolved.isAdminTestPurchase, clientPriceIgnored: cleanPremiumText(requestedProduct.price || data.amount || data.price || "", 40), shareReferral:azReferralFrom(data, product, {productId, returnUrl}), productOwner:azProductOwnerFrom(product, {productId}), premiumDownloadFileLink: downloadLink, downloadLink, maxDownload:1, expiryHours:24, createdAt:new Date().toISOString() });
        return send(res, 200, JSON.stringify({ ok:true, success:true, orderId, billCode, paymentUrl, url: paymentUrl, redirectUrl: paymentUrl, status:"pending" }, null, 2), "application/json");
      } catch (e) {
        console.error("Create ToyyibPay bill failed:", e.message);
        return send(res, 500, JSON.stringify({ ok:false, success:false, error:e.message || "Failed create ToyyibPay bill" }, null, 2), "application/json");
      }
    }

    if (pathname === "/api/verify-payment" && req.method === "GET") {
      const billCode = cleanPremiumText(parsed.query.billCode || parsed.query.billcode || "", 80);
      const orderId = cleanPremiumText(parsed.query.orderId || parsed.query.order_id || "", 120);
      let order = findPremiumOrderByAny({ orderId, billCode });
      if (!order) return send(res, 404, JSON.stringify({ ok:false, paid:false, status:"order_not_found", error:"Order not found" }, null, 2), "application/json");
      if (order.status !== "paid") order = await refreshToyyibOrder(order, req);
      if (order.status === "paid") {
        order = makeDownloadForOrder(order);
        if (!order.emailSentAt) order = await maybeSendDownloadEmail(order, req);
        return send(res, 200, JSON.stringify({ ...paidPayload(order, req), emailSent: !!order.emailSentAt, emailError: order.emailError || null, emailTo: order.emailTo || order.user?.email || order.email || null }, null, 2), "application/json");
      }
      return send(res, 200, JSON.stringify({ ok:true, paid:false, orderId:order.orderId, status:order.status || "pending", billCode:order.billCode, paymentUrl:order.paymentUrl }, null, 2), "application/json");
    }

    if (pathname === "/api/toyyib-callback" && (req.method === "POST" || req.method === "GET")) {
      let data = { ...(parsed.query || {}) };
      if (req.method === "POST") {
        const raw = await readBody(req);
        data = { ...data, ...parseRequestBody(raw) };
      }
      console.log("ToyyibPay callback received:", JSON.stringify(data).slice(0, 1500));

      const billCode = getToyyibBillCode(data);
      const orderId = getToyyibOrderId(data);
      console.log("ToyyibPay callback parsed:", JSON.stringify({ orderId, billCode, status: data.status || data.status_id || "", transaction_id: data.transaction_id || "" }).slice(0, 500));
      let order = findPremiumOrderByAny({ orderId, billCode });

      if (!order) {
        console.warn("ToyyibPay callback order not found:", JSON.stringify({ orderId, billCode }).slice(0, 500));
        return send(res, 200, JSON.stringify({ ok:true, status:"received", note:"order_not_found" }), "application/json");
      }

      if (toyyibStatusIsPaid(data)) {
        order = upsertPremiumOrder({
          ...order,
          status: "paid",
          paymentMethod: "toyyibpay",
          paymentReference: data.transaction_id || data.billpaymentInvoiceNo || data.refno || data.order_id || order.paymentReference || "",
          toyyibCallback: data,
          paidAt: new Date().toISOString()
        });
        try { await azFinalizeCommissionForOrder(order); } catch (commissionError) { console.warn("Commission finalize skipped:", commissionError && (commissionError.message || commissionError)); }
        try { await azobssUpdatePaBmPurchaseLogsForOrder(order, "paid", { paymentReference: order.paymentReference, toyyibCallback: data }); } catch (syncError) { console.warn("PA/BM purchaseLogs paid sync failed:", syncError && (syncError.message || syncError)); }
        if (!isPaBmPremiumOrder(order)) {
          order = makeDownloadForOrder(order);
          await maybeSendDownloadEmail(order, req);
        } else {
          order = upsertPremiumOrder({ ...order, emailSkippedForPaBm: true, emailError: null });
        }
        const latest = findPremiumOrderByAny({ orderId: order.orderId }) || order;
        console.log("ToyyibPay callback processed paid:", JSON.stringify({ orderId: latest.orderId, billCode: latest.billCode, isPaBm: isPaBmPremiumOrder(latest), emailSentAt: latest.emailSentAt || null, emailError: latest.emailError || null }).slice(0, 1000));
        return send(res, 200, JSON.stringify({ ok:true, status:"paid", paBmUpdated: isPaBmPremiumOrder(latest), emailSent: !!latest.emailSentAt, emailError: latest.emailError || null }), "application/json");
      }

      order = await refreshToyyibOrder(order, req);
      if (order.status === "paid") {
        try { await azFinalizeCommissionForOrder(order); } catch (commissionError) { console.warn("Commission finalize skipped:", commissionError && (commissionError.message || commissionError)); }
        try { await azobssUpdatePaBmPurchaseLogsForOrder(order, "paid", { paymentReference: order.paymentReference }); } catch (syncError) { console.warn("PA/BM purchaseLogs paid sync failed:", syncError && (syncError.message || syncError)); }
        return send(res, 200, JSON.stringify({ ok:true, status:"paid" }), "application/json");
      }
      return send(res, 200, JSON.stringify({ ok:true, status:"received", paid:false }), "application/json");
    }



    if (pathname === "/api/commission/status" && req.method === "GET") {
      try {
        const db = getAzobssBackendDb();
        let firestoreOk = false;
        let sampleCount = 0;
        let error = "";
        const wantRecords = String(parsed.query.records || parsed.query.list || '') === '1';
        if (wantRecords && !azRequestHasCommissionSecret(req, parsed)) {
          return send(res, 403, JSON.stringify({ ok:false, error:"Commission records are protected. Use /api/commission/status for health check only." }, null, 2), "application/json");
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
                const safeReferral = x.shareReferral && typeof x.shareReferral === 'object' ? {
                  username: cleanPremiumText(x.shareReferral.username || x.shareReferral.ref || '', 80),
                  ref: cleanPremiumText(x.shareReferral.ref || x.shareReferral.username || '', 80),
                  productId: cleanPremiumText(x.shareReferral.productId || '', 160),
                  sourcePage: cleanPremiumText(x.shareReferral.sourcePage || '', 40),
                  source: cleanPremiumText(x.shareReferral.source || '', 60)
                } : null;
                records.push({
                  docId: doc.id,
                  orderId: cleanPremiumText(x.orderId || '', 140),
                  billCode: cleanPremiumText(x.billCode || '', 100),
                  productId: cleanPremiumText(x.productId || '', 160),
                  productName: cleanPremiumText(x.productName || x.product || x.title || '', 180),
                  username: azCommissionUsername(x.username || x.ownerUsername || ''),
                  ownerUsername: azCommissionUsername(x.ownerUsername || x.username || ''),
                  commissionType: cleanPremiumText(x.commissionType || '', 80),
                  commissionRate: Number(x.commissionRate || x.rate || 0) || 0,
                  rate: Number(x.rate || x.commissionRate || 0) || 0,
                  saleAmount: Number(x.saleAmount || 0) || 0,
                  saleAmountText: cleanPremiumText(x.saleAmountText || '', 40),
                  commissionAmount: Number(x.commissionAmount || x.amount || 0) || 0,
                  amount: Number(x.amount || x.commissionAmount || 0) || 0,
                  amountText: cleanPremiumText(x.amountText || '', 40),
                  azobssShareAmount: Number(x.azobssShareAmount || 0) || 0,
                  azobssShareRate: Number(x.azobssShareRate || 0) || 0,
                  ownerShareAmount: Number(x.ownerShareAmount || 0) || 0,
                  sharerShareAmount: Number(x.sharerShareAmount || 0) || 0,
                  status: cleanPremiumText(x.status || '', 40),
                  payoutStatus: cleanPremiumText(x.payoutStatus || '', 40),
                  paymentStatus: cleanPremiumText(x.paymentStatus || '', 40),
                  sourcePage: cleanPremiumText(x.sourcePage || (safeReferral && safeReferral.sourcePage) || '', 40),
                  note: cleanPremiumText(x.note || '', 260),
                  createdAt: cleanPremiumText(x.createdAt || '', 80),
                  createdAtMs: Number(x.createdAtMs || 0) || 0,
                  shareReferral: safeReferral
                });
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
          records = localRows.slice(0, maxRecords).map((x, i) => ({
            docId: cleanPremiumText(x.docId || x.id || `local_${i}`, 120),
            orderId: cleanPremiumText(x.orderId || '', 140),
            billCode: cleanPremiumText(x.billCode || '', 100),
            productId: cleanPremiumText(x.productId || '', 160),
            productName: cleanPremiumText(x.productName || x.product || x.title || '', 180),
            username: azCommissionUsername(x.username || x.ownerUsername || ''),
            ownerUsername: azCommissionUsername(x.ownerUsername || x.username || ''),
            commissionType: cleanPremiumText(x.commissionType || '', 80),
            commissionRate: Number(x.commissionRate || x.rate || 0) || 0,
            rate: Number(x.rate || x.commissionRate || 0) || 0,
            saleAmount: Number(x.saleAmount || 0) || 0,
            commissionAmount: Number(x.commissionAmount || x.amount || 0) || 0,
            amount: Number(x.amount || x.commissionAmount || 0) || 0,
            amountText: cleanPremiumText(x.amountText || '', 40),
            azobssShareAmount: Number(x.azobssShareAmount || 0) || 0,
            azobssShareRate: Number(x.azobssShareRate || 0) || 0,
            ownerShareAmount: Number(x.ownerShareAmount || 0) || 0,
            sharerShareAmount: Number(x.sharerShareAmount || 0) || 0,
            status: cleanPremiumText(x.status || '', 40),
            payoutStatus: cleanPremiumText(x.payoutStatus || '', 40),
            paymentStatus: cleanPremiumText(x.paymentStatus || '', 40),
            sourcePage: cleanPremiumText(x.sourcePage || '', 40),
            note: cleanPremiumText(x.note || '', 260),
            createdAt: cleanPremiumText(x.createdAt || '', 80),
            createdAtMs: Number(x.createdAtMs || 0) || 0,
            shareReferral: x.shareReferral || null
          }));
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
        const raw = await readBody(req);
        const body = parseRequestBody(raw);
        const orderId = cleanPremiumText(body.orderId || parsed.query.orderId || '', 140);
        const billCode = cleanPremiumText(body.billCode || parsed.query.billCode || '', 100);
        const order = findPremiumOrderByAny({ orderId, billCode });
        if (!order) return send(res, 404, JSON.stringify({ ok:false, error:'Order not found' }, null, 2), "application/json");
        if (order.status !== 'paid') return send(res, 400, JSON.stringify({ ok:false, error:'Order is not paid', status: order.status || 'unknown' }, null, 2), "application/json");
        const result = await azFinalizeCommissionForOrder(order);
        return send(res, 200, JSON.stringify({ ok:true, orderId: order.orderId, billCode: order.billCode, commission: result, referral: azReferralFrom({}, order.product || {}, order), owner: azProductOwnerFrom(order.product || {}, order) }, null, 2), "application/json");
      } catch (err) {
        return send(res, 500, JSON.stringify({ ok:false, error: err && err.message ? err.message : String(err) }, null, 2), "application/json");
      }
    }

    // =========================
    // SOFTWARE STATS BACKEND SYNC
    // =========================
    if (pathname === "/api/software-stats" && req.method === "GET") {
      const normalized = softwareStatsPayload(readSoftwareStats());
      writeSoftwareStats(normalized);
      return send(res, 200, JSON.stringify({ ok: true, stats: normalized, updatedAt: new Date().toISOString() }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/download" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.downloads += 1;
      item.updatedAt = new Date().toISOString();
      stats[key] = item;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, stats: item }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/like" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      const delta = Number(body.delta || 1) < 0 ? -1 : 1;
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.likes = Math.max(0, item.likes + delta);
      item.updatedAt = new Date().toISOString();
      stats[key] = item;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, stats: item }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/rate" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const rating = Math.round(Number(body.rating || 0));
      if (rating < 1 || rating > 5) return send(res, 400, JSON.stringify({ ok:false, error:"Invalid rating" }), "application/json");
      const key = cleanSoftwareId(body.productId || body.id || body.name);
      const stats = readSoftwareStats();
      const item = normalizeSoftwareStats(stats[key] || {});
      item.ratings = item.ratings && typeof item.ratings === "object" ? item.ratings : { "1":0,"2":0,"3":0,"4":0,"5":0 };
      for (const star of ["1","2","3","4","5"]) item.ratings[star] = Math.max(0, Math.round(Number(item.ratings[star] || 0)));
      item.ratedBy = item.ratedBy && typeof item.ratedBy === "object" ? item.ratedBy : {};
      const voterId = getRatingVoterIdFromBody(req, body);
      const previous = Math.max(0, Math.min(5, Math.round(Number(item.ratedBy[voterId] || 0))));
      if (previous >= 1 && previous <= 5) item.ratings[String(previous)] = Math.max(0, item.ratings[String(previous)] - 1);
      item.ratings[String(rating)] += 1;
      item.ratedBy[voterId] = rating;
      const updated = normalizeSoftwareStats(item);
      updated.updatedAt = new Date().toISOString();
      stats[key] = updated;
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, productId: key, voterId, stats: updated }, null, 2), "application/json");
    }

    if (pathname === "/api/software-stats/admin-set" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const stats = readSoftwareStats();
      const items = Array.isArray(body.items) ? body.items : [];
      for (const raw of items) {
        const key = cleanSoftwareId(raw.productId || raw.id || raw.name);
        stats[key] = normalizeSoftwareStats({
          downloads: raw.downloads,
          likes: raw.likes,
          ratings: raw.ratings,
          ratingAverage: raw.ratingAverage ?? raw.rating,
          ratingVotes: raw.ratingVotes ?? raw.votes,
          ratingTotal: raw.ratingTotal
        });
        stats[key].updatedAt = new Date().toISOString();
      }
      writeSoftwareStats(stats);
      return send(res, 200, JSON.stringify({ ok: true, stats }, null, 2), "application/json");
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
          const response = await fetch(targetUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Referer": "https://ebiz.jupem.gov.my/Produk/StesenTandaAras"
            }
          });

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

  const response = await fetchJupem(jupemUrl);

  if (!response.ok) {
    return send(
      res,
      404,
      JSON.stringify({ ok: false, error: "BM/SBM not found" }),
      "application/json"
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const firstText = buffer.slice(0, 160).toString("utf8").toLowerCase();

  if (!buffer.length || firstText.includes("<html")) {
    return send(
      res,
      404,
      JSON.stringify({ ok: false, error: "Invalid BM/SBM file" }),
      "application/json"
    );
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const safePrefix = jenis === "2" ? "SBM" : "BM";
  const ext = contentType.includes("pdf") ? "pdf" : (contentType.includes("zip") ? "zip" : "dat");

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safePrefix}-${productId}.${ext}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

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
    return azobssPaBmDownloadError(res, 500, "Download verification failed.");
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

  if (type === "PA") {
    const itemCode = String(code || "").replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
    const negeri = cleanState(record.negeri || record.state || "");
    if (!itemCode || !negeri) return azobssPaBmDownloadError(res, 400, "Invalid PA record.");

    const paResult = await fetchPelanAkuiCandidates("PA" + itemCode + ".TIF", negeri);
    if (!paResult || !paResult.validFile || !paResult.buffer || !paResult.buffer.length) {
      return azobssPaBmDownloadError(res, 404, "PA not found.");
    }

    const safeName = ("PA" + itemCode).replace(/[^A-Z0-9_-]/gi, "");
    let pdfBuffer;
    try {
      pdfBuffer = await convertTifBufferToPdfBuffer(paResult.buffer, safeName);
    } catch (convertError) {
      console.error("PA controlled PDF conversion failed:", convertError && (convertError.stack || convertError.message || convertError));
      return azobssPaBmDownloadError(res, 500, "PA PDF conversion failed.");
    }

    try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Disposition"
    });
    res.end(pdfBuffer);
    return;
  }

  const downloadUrl = String(record.downloadUrl || record.url || "").trim();
  if (!downloadUrl) return azobssPaBmDownloadError(res, 400, "Download URL missing.");

  // Proxy BM/SBM through AZOBSS backend so users never see the Render cold-start page
  // or the raw onrender.com / JUPEM endpoint. This also ensures the 5x/7-day counter
  // only increases after a real file is successfully prepared.
  let bmResponse;
  try {
    bmResponse = await fetchJupem(downloadUrl);
  } catch (fetchError) {
    console.error("BM/SBM controlled fetch failed:", fetchError && (fetchError.stack || fetchError.message || fetchError));
    return azobssPaBmDownloadError(res, 502, "Fail sedang disediakan. Sila cuba semula sebentar lagi.");
  }

  if (!bmResponse || !bmResponse.ok) {
    return azobssPaBmDownloadError(res, 404, "BM/SBM not found.");
  }

  const bmBuffer = Buffer.from(await bmResponse.arrayBuffer());
  const bmFirstText = bmBuffer.slice(0, 160).toString("utf8").toLowerCase();
  if (!bmBuffer.length || bmFirstText.includes("<html")) {
    return azobssPaBmDownloadError(res, 404, "Invalid BM/SBM file.");
  }

  try { await azobssIncrementPurchaseDownload(ref, record, nowMs); } catch (e) { console.error("Download counter update failed:", e && (e.stack || e.message || e)); }

  const contentType = bmResponse.headers.get("content-type") || "application/octet-stream";
  const productType = String(record.productType || record.product || type || "BM").trim().toUpperCase();
  const safeCode = String(code || record.itemCode || record.stesen || "download").replace(/[^A-Z0-9_-]/gi, "-");
  const ext = contentType.includes("pdf") ? "pdf" : (contentType.includes("zip") ? "zip" : (contentType.includes("tif") ? "tif" : "dat"));
  const safePrefix = productType === "SBM" ? "SBM" : "BM";

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safePrefix}-${safeCode}.${ext}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Disposition"
  });
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

  res.writeHead(200, {
    "Content-Type": "application/pdf",
    "Content-Disposition":
      `attachment; filename="${safeName}.pdf"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

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

  res.writeHead(200, {
    "Content-Type": "image/tiff",
    "Content-Disposition":
      `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  fs.createReadStream(filePath)
    .pipe(res);

  return;
}



    // =========================
    // AZOBSS PREMIUM SOFTWARE/CAD PURCHASE FLOW
    // =========================

    if (pathname === "/api/premium/complete-purchase" && req.method === "POST") {
      let data = {};
      try { data = JSON.parse(await readBody(req) || "{}"); }
      catch (error) { return send(res, 400, JSON.stringify({ ok:false, error:"Invalid JSON" }), "application/json"); }

      const requestedProduct = data.product || {};
      const trustedResolved = await azResolveTrustedPremiumProduct(data, req);
      const product = trustedResolved.product || {};
      const productName = cleanPremiumText(product.name || product.productName || data.productName, 160);
      const productId = cleanPremiumText(product.productId || product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
      const amount = cleanPremiumText(trustedResolved.amountText || product.price || "", 40);
      const amountSen = Number(trustedResolved.amountSen || parseAmountToSen(amount));
      const downloadLink = cleanPremiumUrl(trustedResolved.downloadLink || product.secureDownloadLink || product.premiumDownloadFileLink || product.privateDownloadLink || product.downloadLink || "");
      const paymentMethod = cleanPremiumText(data.paymentMethod || "manual", 40);
      const paymentReference = cleanPremiumText(data.paymentReference || data.reference || "", 200);
      const requestedLimit = Math.max(1, Math.min(20, Number(product.downloadLimit || data.downloadLimit || product.maxDownload || 3)));
      const requestedExpiryHours = Math.max(0, Math.min(24 * 30, Number(product.expiryHours ?? data.expiryHours ?? 24)));
      const expiresAtMs = requestedExpiryHours === 0 ? Date.now() + (100 * 365 * 24 * 60 * 60 * 1000) : Date.now() + requestedExpiryHours * 60 * 60 * 1000;
      const user = getPremiumUser(data);

      if (!productName || !amount || !amountSen) {
        return send(res, 400, JSON.stringify({ ok:false, error:"Missing backend product name or backend amount" }), "application/json");
      }
      if (!downloadLink) {
        return send(res, 400, JSON.stringify({ ok:false, error:"Download link belum diset untuk produk ini. Sila hubungi admin." }), "application/json");
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
        product:{ ...product, id:productId, productId, name:productName, price:amount },
        trustedProductSource: trustedResolved.trustedSource || "backend",
        isAdminTestPurchase: !!trustedResolved.isAdminTestPurchase,
        clientPriceIgnored: cleanPremiumText(requestedProduct.price || data.amount || data.price || "", 40),
        shareReferral:azReferralFrom(data, product, {productId}),
        productOwner:azProductOwnerFrom(product, {productId}),
        createdAt: new Date(now).toISOString(),
        paidAt: new Date(now).toISOString(),
        downloadToken: token,
        tokenExpiresAt: new Date(expiresAtMs).toISOString(),
        maxDownload: requestedLimit
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
        createdAt: now,
        expiresAt: expiresAtMs,
        usedCount: 0,
        maxDownload: requestedLimit
      });

      return send(res, 200, JSON.stringify({
        ok: true,
        orderId,
        status: "paid",
        message: "Purchase completed. A temporary download link has been generated.",
        downloadUrl: `/api/premium/download/${encodeURIComponent(token)}`,
        receiptUrl: `/api/premium/receipt/${encodeURIComponent(orderId)}?rt=${encodeURIComponent(azMakeReceiptToken(order))}`,
        expiresAt: order.tokenExpiresAt,
        maxDownload: requestedLimit
      }, null, 2), "application/json");
    }

    if (pathname.startsWith("/api/premium/download/") && req.method === "POST") {
      const token = decodeURIComponent(path.basename(pathname));
      let saved = findPremiumToken(token);
      if (!saved) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (err) { console.warn("Premium token Firestore lookup failed:", err && (err.message || err)); }
      }
      if (!saved || Number(saved.expiresAt || 0) < Date.now() || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
        return send(res, 403, "Download link expired or already used too many times.");
      }
      const nextUsed = Number(saved.usedCount || 0) + 1;
      updatePremiumToken(token, t => ({ ...t, usedCount: nextUsed, lastUsedAt: Date.now(), lastMethod: "POST" }));
      try { await azUpdatePremiumTokenPersistent(token, { usedCount: nextUsed, lastUsedAt: Date.now(), lastMethod: "POST" }); } catch (err) { console.warn("Premium token Firestore update failed:", err && (err.message || err)); }
      const target = saved.downloadLink || saved.premiumDownloadFileLink || "";
      if (/^https?:\/\//i.test(target)) {
        res.writeHead(303, { Location: target, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
        res.end();
        return;
      }
      if (target.startsWith("/")) {
        const filePath = safePath(target);
        if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "File not found");
        res.writeHead(200, { "Content-Type": mimeType(filePath), "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`, "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      return send(res, 404, "Invalid download link");
    }

    if (pathname.startsWith("/api/premium/download/") && req.method === "GET") {
      const token = decodeURIComponent(path.basename(pathname));
      let saved = findPremiumToken(token);
      if (!saved) {
        try { saved = await azFindPremiumTokenPersistent(token); } catch (err) { console.warn("Premium token Firestore lookup failed:", err && (err.message || err)); }
      }
      if (!saved || Number(saved.expiresAt || 0) < Date.now() || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
        return send(res, 403, "Download link expired or already used too many times.");
      }

      // Email scanners/prefetchers use GET. GET now always shows a safe gate and never consumes quota.
      // The real download only starts after a human presses the POST form button.
      const order = findPremiumOrderByAny({ orderId: saved.orderId }) || await azFindPremiumOrderPersistent({ orderId: saved.orderId }) || {};
      const expires = saved.expiresAt ? new Date(Number(saved.expiresAt)).toLocaleString("en-MY", { timeZone:"Asia/Kuala_Lumpur" }) : "-";
      const actionUrl = `/api/premium/download/${encodeURIComponent(token)}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>AZOBSS Download Confirm</title><style>body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;padding:24px}.box{max-width:680px;margin:40px auto;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px}button.btn{border:0;cursor:pointer;background:#16a34a;color:white;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:800;font-size:16px}.muted{color:#94a3b8}.warn{color:#fbbf24}.small{font-size:12px}</style></head><body><div class="box"><h1>AZOBSS Download Ready ✅</h1><p><b>Product:</b> ${String(order.productName || saved.productName || "AZOBSS Digital Product")}</p><p class="muted">Klik butang di bawah untuk mula download sebenar. Paparan ini tidak menggunakan kuota download.</p><form method="POST" action="${actionUrl}"><button class="btn" type="submit">Start Download</button></form><p class="warn">Download count hanya dikira selepas butang Start Download ditekan.</p><p class="muted">Used: ${Number(saved.usedCount||0)} / ${Number(saved.maxDownload||1)}<br>Expires: ${expires}</p><p class="muted small">Security: GET/email preview tidak akan consume token. Download sebenar guna POST confirmation.</p></div></body></html>`;
      return send(res, 200, html, "text/html; charset=utf-8");
    }

    if (pathname.startsWith("/api/premium/receipt/") && req.method === "GET") {
      const orderId = decodeURIComponent(path.basename(pathname));
      const order = await azFindReceiptOrder(orderId);
      if (!order) return send(res, 404, "Receipt not found");
      const rt = cleanPremiumText(parsed.query.rt || parsed.query.token || "", 80);
      if (!azReceiptTokenOk(order, rt)) return send(res, 403, "Receipt token required or invalid.");
      return send(res, 200, buildReceiptHtml(order), "text/html; charset=utf-8");
    }

    // =========================
    // BLOCK DIRECT TEMP ACCESS
    // =========================

    if (
      pathname === "/temp" ||
      pathname.startsWith("/temp/")
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
      mimeType(filePath)
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
        if (age > FILE_EXPIRE_MS) {

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
  cleanupTempFiles,
  12 * 60 * 60 * 1000
);

// RUN ON STARTUP
cleanupTempFiles();

const HOST = "0.0.0.0";
const SERVER_PORT = Number(process.env.PORT || PORT || 10000);

const server = http.createServer((req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Unhandled request error:", error && (error.stack || error.message) || error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
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
  console.log("================================");
  console.log("");

});



