
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import cron from "node-cron";
import { fileURLToPath } from "url";
import crypto from "crypto";
import nodemailer from "nodemailer";
import sharp from "sharp";
import PDFDocument from "pdfkit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "data");
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || "uploads");

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

app.use(express.json());
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "*").split(",").map((v) => v.trim()).filter(Boolean);

// CORS must be registered before API routes.
app.use(cors({
  origin(origin, cb) {
    if (!origin || CORS_ORIGIN.includes("*") || CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  }
}));

app.set("trust proxy", true);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, "lucky-draw"), { recursive: true });

const PREMIUM_ORDERS_FILE = path.join(DATA_DIR, "premium-orders.json");
const PREMIUM_TOKENS_FILE = path.join(DATA_DIR, "premium-download-tokens.json");
const SOFTWARE_STATS_FILE = path.join(DATA_DIR, "software-stats.json");
function cleanSoftwareId(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "software-item"; }
function cleanLogoFileName(value) { return String(value || "software-logo").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "software-logo"; }
function softwareLogoDir() {
  const envRoot = process.env.AZOBSS_REPO_ROOT || process.env.REPO_ROOT || "";
  const winRoot = "C:/Users/USER/Documents/GitHub/www.zedan91.github.io";
  const root = envRoot ? path.resolve(envRoot) : (fs.existsSync(winRoot) ? winRoot : path.resolve(__dirname, ".."));
  return path.join(root, "Software-Tools", "images", "logo");
}
function faviconFromUrl(value) {
  try {
    const u = new URL(String(value || ""));
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname.replace(/^www\./, ""))}&sz=128`;
  } catch { return ""; }
}
function publicLogoPath(fileName) { return `images/logo/${fileName}`; }
function normalizeSoftwareStats(raw = {}) {
  const downloads = Math.max(0, Math.round(Number(raw.downloads || 0)));
  const likes = Math.max(0, Math.round(Number(raw.likes || 0)));
  const ratings = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  if (raw.ratings && typeof raw.ratings === "object") {
    for (const star of ["1", "2", "3", "4", "5"]) {
      ratings[star] = Math.max(0, Math.round(Number(raw.ratings[star] || 0)));
    }
  } else {
    const oldVotes = Math.max(0, Math.round(Number(raw.ratingVotes || 0)));
    const oldAverage = Math.max(0, Math.min(5, Number(raw.ratingAverage || raw.rating || 0)));
    if (oldVotes > 0 && oldAverage > 0) {
      const roundedStar = String(Math.max(1, Math.min(5, Math.round(oldAverage))));
      ratings[roundedStar] = oldVotes;
    }
  }

  const ratedBy = (raw.ratedBy && typeof raw.ratedBy === "object") ? raw.ratedBy : {};
  const cleanRatedBy = {};
  for (const [voter, value] of Object.entries(ratedBy)) {
    const safeVoter = cleanSoftwareId(voter).slice(0, 160);
    const star = Math.max(1, Math.min(5, Math.round(Number(value || 0))));
    if (safeVoter && star) cleanRatedBy[safeVoter] = star;
  }

  let ratingTotal = 0;
  let ratingVotes = 0;
  for (const star of [1, 2, 3, 4, 5]) {
    const count = ratings[String(star)];
    ratingVotes += count;
    ratingTotal += star * count;
  }

  const ratingAverage = ratingVotes
    ? Math.round((ratingTotal / ratingVotes) * 10) / 10
    : Math.max(0, Math.min(5, Number(raw.ratingAverage || raw.rating || 0)));

  return { downloads, likes, ratings, ratedBy: cleanRatedBy, ratingTotal, ratingVotes, ratingAverage };
}
function readSoftwareStats() { return readPremiumJson(SOFTWARE_STATS_FILE, {}); }
function writeSoftwareStats(stats) { writePremiumJson(SOFTWARE_STATS_FILE, stats || {}); }
function getSoftwareStatsItem(stats, productId) {
  const key = cleanSoftwareId(productId);
  stats[key] = normalizeSoftwareStats(stats[key] || {});
  return { key, item: stats[key] };
}

function getRatingVoterId(req) {
  const bodyVoter = cleanSoftwareId(req.body?.voterId || req.body?.userId || req.body?.uid || req.body?.username || req.body?.email || "");
  if (bodyVoter && bodyVoter !== "software-item") return `client_${bodyVoter}`;
  const ip = String(req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  return "ip_" + crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

function readPremiumJson(file, fallback) { try { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; } }
function writePremiumJson(file, data) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8"); }
function makePremiumId(prefix = "az") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
function cleanPremiumText(value, max = 300) { return String(value || "").replace(/[<>]/g, "").trim().slice(0, max); }
function cleanPremiumUrl(value) { const v = String(value || "").trim(); if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; if (v.startsWith("/")) return v; return ""; }
function getPremiumUser(data) { const user = data.user || {}; return { uid: cleanPremiumText(user.uid || data.uid, 120), username: cleanPremiumText(user.username || user.usernameKey || data.username, 80), email: cleanPremiumText(user.email || data.email, 160), phone: cleanPremiumText(user.phone || data.phone, 40) }; }
function savePremiumOrder(order) { const orders = readPremiumJson(PREMIUM_ORDERS_FILE, []); orders.unshift(order); writePremiumJson(PREMIUM_ORDERS_FILE, orders.slice(0, 200)); }
function savePremiumToken(tokenData) { const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []); const now = Date.now(); const active = tokens.filter(t => Number(t.expiresAt || 0) > now && Number(t.usedCount || 0) < Number(t.maxDownload || 3)); active.unshift(tokenData); writePremiumJson(PREMIUM_TOKENS_FILE, active.slice(0, 200)); }
function findPremiumToken(token) { return readPremiumJson(PREMIUM_TOKENS_FILE, []).find(t => t.token === token); }
function updatePremiumToken(token, updater) { const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []); const index = tokens.findIndex(t => t.token === token); if (index >= 0) { tokens[index] = updater(tokens[index]); writePremiumJson(PREMIUM_TOKENS_FILE, tokens); return tokens[index]; } return null; }
function buildReceiptHtml(order) { const rows = [["Receipt No", order.orderId], ["Status", order.status], ["Product", order.productName], ["Amount", order.amount], ["Payment Method", order.paymentMethod], ["Reference", order.paymentReference || "-"], ["Username", order.user?.username || "-"], ["Email", order.user?.email || "-"], ["Date", new Date(order.paidAt || order.createdAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })]].map(([k,v]) => `<tr><th>${k}</th><td>${v || "-"}</td></tr>`).join(""); return `<!doctype html><html><head><meta charset="utf-8"><title>AZOBSS Receipt</title><style>body{font-family:Arial,sans-serif;background:#f6f7fb;color:#111;padding:24px}.receipt{max-width:720px;margin:auto;background:#fff;border:1px solid #ddd;border-radius:14px;padding:24px}h1{margin-top:0}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #eee;text-align:left}th{width:180px;color:#555}.ok{color:#16a34a;font-weight:700}.print{margin-top:20px}</style></head><body><div class="receipt"><h1>AZOBSS Payment Receipt</h1><p class="ok">Payment Successful ✅</p><table>${rows}</table><p class="print"><button onclick="window.print()">Print / Save PDF</button></p></div></body></html>`; }


function mailEnabled() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function mailFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || "";
}

function createMailer() {
  if (!mailEnabled()) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function buildDownloadEmailHtml(order, downloadUrl, receiptUrl) {
  const productName = cleanPremiumText(order.productName || "AZOBSS Digital Product", 160);
  const expires = order.tokenExpiresAt ? new Date(order.tokenExpiresAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "24 jam";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;color:#111">
    <div style="max-width:680px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px">
      <h2 style="margin-top:0">AZOBSS Download Ready ✅</h2>
      <p>Thank you for your purchase. Your payment has been verified successfully.</p>
      <p><b>Product:</b> ${productName}<br><b>Order ID:</b> ${order.orderId}<br><b>Amount:</b> ${order.amount || "-"}</p>
      <p><a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:12px;font-weight:700">Download Now</a></p>
      <p style="color:#b45309"><b>Important:</b> This link will automatically expire after the first download. If it is not used, the link will expire on ${expires}.</p>
      <p><a href="${receiptUrl}">View receipt</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
      <p style="font-size:12px;color:#6b7280">AZOBSS Digital Store</p>
    </div>
  </body></html>`;
}

async function sendDownloadEmailForOrder(order, req) {
  try {
    if (!order || order.emailSentAt || !order.downloadToken) return order;
    const email = cleanPremiumText(order.user?.email || order.email || "", 180);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return order;
    if (!mailEnabled()) {
      console.warn("SMTP env not configured; download email not sent for", order.orderId);
      return order;
    }
    const base = req ? publicBaseUrl(req) : (PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
    if (!base) {
      console.warn("PUBLIC_BASE_URL missing; download email not sent for", order.orderId);
      return order;
    }
    const downloadUrl = `${base}/api/premium/download/${encodeURIComponent(order.downloadToken)}`;
    const receiptUrl = `${base}/api/premium/receipt/${encodeURIComponent(order.orderId)}`;
    const transporter = createMailer();
    await transporter.sendMail({
      from: mailFrom(),
      to: email,
      subject: `AZOBSS Download Ready - ${cleanPremiumText(order.productName || "Digital Product", 80)}`,
      html: buildDownloadEmailHtml(order, downloadUrl, receiptUrl),
      text: `AZOBSS Download Ready\n\nProduct: ${order.productName}\nOrder ID: ${order.orderId}\nDownload: ${downloadUrl}\nReceipt: ${receiptUrl}\n\nImportant: This link will automatically expire after the first download.`
    });
    return upsertPremiumOrder({ ...order, emailSentAt: new Date().toISOString(), emailTo: email });
  } catch (err) {
    console.error("Download email failed:", err.message);
    return upsertPremiumOrder({ ...order, emailError: err.message, emailErrorAt: new Date().toISOString() });
  }
}


// =========================
// TOYYIBPAY PAYMENT GATEWAY
// =========================
const TOYYIB_SECRET_KEY = process.env.TOYYIB_SECRET_KEY || process.env.TOYYIBPAY_SECRET_KEY || "";
const TOYYIB_CATEGORY_CODE = process.env.TOYYIB_CATEGORY_CODE || process.env.TOYYIBPAY_CATEGORY_CODE || "";
const TOYYIB_BASE_URL = (process.env.TOYYIB_BASE_URL || (String(process.env.TOYYIB_SANDBOX || "").toLowerCase() === "true" ? "https://dev.toyyibpay.com" : "https://toyyibpay.com")).replace(/\/$/, "");
const TOYYIB_RETURN_URL = process.env.TOYYIB_RETURN_URL || "";
const TOYYIB_CALLBACK_URL = process.env.TOYYIB_CALLBACK_URL || "";

function publicBaseUrl(req) {
  const env = (PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (env) return env;
  return `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
}
function frontendBaseUrl(req) {
  return (process.env.FRONTEND_BASE_URL || process.env.SITE_BASE_URL || "https://www.azobss.com").replace(/\/$/, "");
}
function toyyibAmountSen(value) {
  const n = Number(String(value || "").replace(/rm/ig, "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}
function toyyibClean(value, max = 100) {
  return String(value || "").replace(/[^a-zA-Z0-9 _.,@+\-()]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
async function toyyibPost(endpoint, payload) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(payload || {})) body.append(k, String(v ?? ""));
  const response = await fetch(`${TOYYIB_BASE_URL}/index.php/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!response.ok) throw new Error(`ToyyibPay API error ${response.status}: ${text.slice(0, 200)}`);
  return json ?? text;
}
function readPremiumOrders() { return readPremiumJson(PREMIUM_ORDERS_FILE, []); }
function writePremiumOrders(orders) { writePremiumJson(PREMIUM_ORDERS_FILE, (orders || []).slice(0, 500)); }
function upsertPremiumOrder(order) {
  const orders = readPremiumOrders();
  const idx = orders.findIndex(o => o.orderId === order.orderId);
  if (idx >= 0) orders[idx] = { ...orders[idx], ...order };
  else orders.unshift(order);
  writePremiumOrders(orders);
  return idx >= 0 ? orders[idx] : order;
}
function findPremiumOrderByAny({ orderId = "", billCode = "" } = {}) {
  const orders = readPremiumOrders();
  return orders.find(o => (orderId && o.orderId === orderId) || (billCode && o.billCode === billCode));
}
function makePremiumDownloadForOrder(order) {
  if (!order || order.status !== "paid") return null;
  if (order.downloadToken) return order;
  const token = makePremiumId("dl").replace(/[^a-zA-Z0-9_-]/g, "");
  const now = Date.now();
  const maxDownload = azobssDownloadLimitFromOrder(order); // secure digital delivery: expire after first download
  const expiryHours = Math.max(0, Math.min(24 * 30, Number(order.expiryHours ?? 24)));
  const expiresAtMs = expiryHours === 0 ? now + (100 * 365 * 24 * 60 * 60 * 1000) : now + expiryHours * 60 * 60 * 1000;
  savePremiumToken({
    token,
    orderId: order.orderId,
    productId: order.productId,
    productName: order.productName,
    user: order.user || {},
    downloadLink: order.downloadLink,
    createdAt: now,
    expiresAt: expiresAtMs,
    usedCount: 0,
    maxDownload
  });
  return upsertPremiumOrder({ ...order, downloadToken: token, tokenExpiresAt: new Date(expiresAtMs).toISOString(), maxDownload });
}
async function refreshToyyibOrderStatus(order) {
  if (!order?.billCode) return order;
  try {
    const result = await toyyibPost("getBillTransactions", { billCode: order.billCode, billpaymentStatus: "1" });
    const tx = Array.isArray(result) ? result[0] : null;
    if (tx && String(tx.billpaymentStatus || tx.billStatus || "") === "1") {
      const paid = upsertPremiumOrder({
        ...order,
        status: "paid",
        paymentMethod: "toyyibpay",
        paymentReference: tx.billpaymentInvoiceNo || tx.transaction_id || tx.refno || order.paymentReference || "",
        toyyibTransaction: tx,
        paidAt: new Date().toISOString()
      });
      const withDownload = makePremiumDownloadForOrder(paid);
      await sendDownloadEmailForOrder(withDownload);
      return withDownload;
    }
  } catch (err) {
    console.warn("ToyyibPay status check failed:", err.message);
  }
  return findPremiumOrderByAny({ orderId: order.orderId }) || order;
}
function verifyToyyibHash(data) {
  const received = String(data.hash || "").trim().toLowerCase();
  if (!received) return true; // Some channels may not send hash; status check endpoint remains available.
  const status = String(data.status || data.status_id || "");
  const orderId = String(data.order_id || "");
  const refno = String(data.refno || data.transaction_id || "");
  const expected = crypto.createHash("md5").update(TOYYIB_SECRET_KEY + status + orderId + refno + "ok").digest("hex");
  return expected === received;
}
function toyyibPaidResponse(order, req) {
  const base = publicBaseUrl(req);
  const withToken = makePremiumDownloadForOrder(order);
  return {
    ok: true,
    paid: true,
    orderId: withToken.orderId,
    status: withToken.status,
    downloadUrl: `${base}/api/premium/download/${encodeURIComponent(withToken.downloadToken)}`,
    receiptUrl: `${base}/api/premium/receipt/${encodeURIComponent(withToken.orderId)}`,
    expiresAt: withToken.tokenExpiresAt,
    maxDownload: withToken.maxDownload
  };
}


app.use(cors({
  origin(origin, cb) {
    if (!origin || CORS_ORIGIN.includes("*") || CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  }
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", etag: true }));

function cleanText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "";
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(key = monthKey()) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString("ms-MY", { month: "long", year: "numeric" });
}

function getPrizeFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-prizes", `${key}.json`);
}

function getEntriesFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-entries", `${key}.json`);
}

function getWinnerFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-winners", `${key}.json`);
}

function isAdmin(req) {
  const key = req.header("x-admin-key") || req.query.adminKey || "";
  return key && key === ADMIN_KEY;
}

function requireAdmin(req, res, next) {
  // NO PASSWORD MODE:
  // Admin actions are allowed without ADMIN_KEY.
  // Keep CORS_ORIGIN restricted to your website domain in Render settings.
  return next();
}

function safeFilename(name) {
  const ext = path.extname(name || "").toLowerCase() || ".jpg";
  const base = path.basename(name || "prize", ext)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 60) || "prize";
  return `${Date.now()}-${base}${ext}`;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOAD_DIR, "lucky-draw");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    cb(null, safeFilename(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image upload allowed"));
    cb(null, true);
  }
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "AZOBSS Lucky Draw Backend",
    message: "Use /api/health, /api/prize or /api/lucky-draw/prize"
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "AZOBSS Lucky Draw Backend", time: new Date().toISOString() });
});




app.post("/api/toyyib/create-pa-bm-bill", async (req, res) => {
  try {
    if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
      return res.status(500).json({ ok:false, error:"ToyyibPay env belum diset. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." });
    }
    const data = req.body || {};
    const user = getPremiumUser(data);
    const usernameKey = cleanPremiumText(data.usernameKey || user.username || "", 80).toLowerCase();
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items = rawItems.map((item) => ({
      id: cleanPremiumText(item.id || "", 120),
      productType: cleanPremiumText(item.productType || "PA", 20).toUpperCase(),
      itemCode: cleanPremiumText(item.itemCode || "", 80),
      negeri: cleanPremiumText(item.negeri || "", 80),
      amount: Math.max(0, Math.round(Number(item.amount || 0))),
      createdAtMs: Number(item.createdAtMs || 0) || 0
    })).filter((item) => item.itemCode && (item.amount === 3 || item.amount === 5));
    if (!items.length) return res.status(400).json({ ok:false, error:"Tiada rekod PA/BM yang sah untuk dibayar." });
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const amountSen = totalAmount * 100;
    const orderId = makePremiumId("pabm");
    const apiBase = publicBaseUrl(req);
    const returnUrl = TOYYIB_RETURN_URL || `${frontendBaseUrl(req)}/PA-BM/?payment=return&orderId=${encodeURIComponent(orderId)}`;
    const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
    const billPayload = {
      userSecretKey: TOYYIB_SECRET_KEY,
      categoryCode: TOYYIB_CATEGORY_CODE,
      billName: toyyibClean("AZOBSS PA BM", 30),
      billDescription: toyyibClean(`AZOBSS PA/BM Payment - ${items.length} unit - RM${totalAmount}`, 100),
      billPriceSetting: 1,
      billPayorInfo: 1,
      billAmount: amountSen,
      billReturnUrl: returnUrl,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: orderId,
      billTo: toyyibClean(user.username || usernameKey || user.email || "AZOBSS Customer", 30),
      billEmail: toyyibClean(user.email || data.buyerEmail || data.email || "customer@azobss.com", 80),
      billPhone: toyyibClean(user.phone || data.buyerPhone || data.phone || "01135600723", 20),
      billSplitPayment: 0,
      billSplitPaymentArgs: "",
      billPaymentChannel: 0,
      billContentEmail: `Thank you for your AZOBSS PA/BM payment. Total: RM${totalAmount}.`,
      billChargeToCustomer: 1,
      billExpiryDays: 3,
      enableDuitNowQR: 1,
      chargeDuitNowQR: 0
    };
    const apiResult = await toyyibPost("createBill", billPayload);
    const billCode = Array.isArray(apiResult) ? (apiResult[0]?.BillCode || apiResult[0]?.billCode) : apiResult?.BillCode;
    if (!billCode) return res.status(502).json({ ok:false, error:"ToyyibPay tidak return BillCode.", raw: apiResult });
    const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
    upsertPremiumOrder({ orderId, productId:"pa-bm-purchase-records", productName:`PA/BM Purchase Records (${items.length} unit)`, amount:`RM${totalAmount}`, amountSen, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, user:{...user, username: usernameKey || user.username}, paBmItems:items, maxDownload:0, expiryHours:0, createdAt:new Date().toISOString() });
    res.json({ ok:true, orderId, billCode, paymentUrl, status:"pending", amount:totalAmount, amountSen, unit:items.length });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message || "Failed create PA/BM ToyyibPay bill" });
  }
});

app.post("/api/toyyib/create-bill", async (req, res) => {
  try {
    if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
      return res.status(500).json({ ok:false, error:"ToyyibPay env belum diset. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." });
    }
    const data = req.body || {};
    const product = data.product || {};
    const productName = cleanPremiumText(product.name || data.productName || "AZOBSS Premium Item", 160);
    const productId = cleanPremiumText(product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
    const amountText = cleanPremiumText(product.price || data.amount || data.price || "RM0", 40);
    const amountSen = toyyibAmountSen(amountText);
    const downloadLink = cleanPremiumUrl(product.secureDownloadLink || product.downloadLink || data.downloadLink);
    const user = getPremiumUser(data);
    const requestedLimit = 1; // auto-expire after first download
    const requestedExpiryHours = Math.max(0, Math.min(24 * 30, Number(product.expiryHours ?? data.expiryHours ?? 24)));
    if (!productName || !amountSen) return res.status(400).json({ ok:false, error:"Missing product name or valid amount." });
    if (!downloadLink) return res.status(400).json({ ok:false, error:"Premium download link belum diset untuk produk ini." });

    const orderId = makePremiumId("tp");
    const apiBase = publicBaseUrl(req);
    const requestedReturnUrl = cleanPremiumUrl(data.returnUrl || data.redirectUrl || data.successUrl);
    const returnUrl = requestedReturnUrl || TOYYIB_RETURN_URL || `${apiBase}/api/toyyib/return`;
    const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
    const billPayload = {
      userSecretKey: TOYYIB_SECRET_KEY,
      categoryCode: TOYYIB_CATEGORY_CODE,
      billName: toyyibClean(productName, 30) || "AZOBSS Premium",
      billDescription: toyyibClean(`AZOBSS ${productName}`, 100),
      billPriceSetting: 1,
      billPayorInfo: 1,
      billAmount: amountSen,
      billReturnUrl: returnUrl,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: orderId,
      billTo: toyyibClean(user.username || user.email || "AZOBSS Customer", 30),
      billEmail: toyyibClean(user.email || "", 80),
      billPhone: toyyibClean(user.phone || "", 20),
      billSplitPayment: 0,
      billSplitPaymentArgs: "",
      billPaymentChannel: 0,
      billContentEmail: `Thank you for purchasing ${toyyibClean(productName, 60)} from AZOBSS.`,
      billChargeToCustomer: 1,
      billExpiryDays: 3,
      enableDuitNowQR: 1,
      chargeDuitNowQR: 0
    };
    const apiResult = await toyyibPost("createBill", billPayload);
    const billCode = Array.isArray(apiResult) ? (apiResult[0]?.BillCode || apiResult[0]?.billCode) : apiResult?.BillCode;
    if (!billCode) return res.status(502).json({ ok:false, error:"ToyyibPay tidak return BillCode.", raw: apiResult });
    const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
    const now = Date.now();
    const order = {
      orderId,
      productId,
      productName,
      amount: amountText,
      amountSen,
      status: "pending",
      paymentMethod: "toyyibpay",
      paymentReference: "",
      billCode,
      paymentUrl,
      user,
      downloadLink,
      maxDownload: requestedLimit,
      expiryHours: requestedExpiryHours,
      createdAt: new Date(now).toISOString()
    };
    upsertPremiumOrder(order);
    res.json({ ok:true, orderId, billCode, paymentUrl, status:"pending" });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message || "Failed create ToyyibPay bill" });
  }
});

app.get("/api/toyyib/order/:orderId", async (req, res) => {
  let order = findPremiumOrderByAny({ orderId: req.params.orderId });
  if (!order) return res.status(404).json({ ok:false, error:"Order not found" });
  if (order.status !== "paid") order = await refreshToyyibOrderStatus(order);
  if (order.status === "paid") return res.json(toyyibPaidResponse(order, req));
  res.json({ ok:true, paid:false, orderId: order.orderId, status: order.status || "pending", billCode: order.billCode, paymentUrl: order.paymentUrl });
});


app.get("/api/verify-payment", async (req, res) => {
  try {
    const billCode = cleanPremiumText(req.query.billCode || req.query.billcode || "", 80);
    const orderId = cleanPremiumText(req.query.orderId || req.query.order_id || "", 120);

    if (!billCode && !orderId) {
      return res.status(400).json({
        ok: false,
        paid: false,
        status: "missing_reference",
        error: "Missing billCode or orderId"
      });
    }

    let order = findPremiumOrderByAny({ orderId, billCode });

    // If local order exists, refresh from ToyyibPay and return download info if paid.
    if (order) {
      if (order.status !== "paid") order = await refreshToyyibOrderStatus(order);
      if (order.status === "paid") return res.json(toyyibPaidResponse(order, req));
      return res.json({
        ok: true,
        paid: false,
        status: order.status || "pending",
        orderId: order.orderId,
        billCode: order.billCode,
        paymentUrl: order.paymentUrl
      });
    }

    // Fallback: verify directly by billCode even if local order file was reset/redeployed.
    if (!billCode) {
      return res.status(404).json({ ok: false, paid: false, status: "order_not_found", error: "Order not found" });
    }

    const result = await toyyibPost("getBillTransactions", { billCode });
    const tx = Array.isArray(result) ? result[0] : null;
    const paid = !!(tx && String(tx.billpaymentStatus || tx.billStatus || "") === "1");

    return res.json({
      ok: true,
      paid,
      status: paid ? "paid" : "pending",
      billCode,
      transaction: tx || null
    });
  } catch (err) {
    console.error("ToyyibPay verify payment failed:", err);
    return res.status(500).json({
      ok: false,
      paid: false,
      status: "error",
      error: err.message || "Failed to verify payment"
    });
  }
});


app.post("/api/toyyib-callback", async (req, res) => {
  try {
    const data = { ...(req.body || {}) };
    const billCode = cleanPremiumText(data.billcode || data.billCode, 80);
    const orderId = cleanPremiumText(data.order_id || data.orderId, 120);
    const status = String(data.status || data.status_id || "");
    let order = findPremiumOrderByAny({ orderId, billCode });
    if (!order) return res.status(404).send("ORDER_NOT_FOUND");
    if (!verifyToyyibHash(data)) return res.status(403).send("INVALID_HASH");
    const update = {
      ...order,
      status: status === "1" ? "paid" : (status === "3" ? "failed" : "pending"),
      paymentReference: cleanPremiumText(data.refno || data.transaction_id || order.paymentReference || "", 200),
      toyyibCallback: data,
      updatedAt: new Date().toISOString()
    };
    if (update.status === "paid") update.paidAt = new Date().toISOString();
    order = upsertPremiumOrder(update);
    if (order.status === "paid") {
      const withDownload = makePremiumDownloadForOrder(order);
      await sendDownloadEmailForOrder(withDownload, req);
    }
    res.send("OK");
  } catch (err) {
    res.status(500).send("ERROR");
  }
});

app.get("/api/toyyib/return", async (req, res) => {
  const billCode = cleanPremiumText(req.query.billcode || req.query.billCode, 80);
  const orderId = cleanPremiumText(req.query.order_id || req.query.orderId, 120);
  let order = findPremiumOrderByAny({ orderId, billCode });
  if (order && order.status !== "paid") order = await refreshToyyibOrderStatus(order);
  const paid = order?.status === "paid";
  if (paid) order = await sendDownloadEmailForOrder(makePremiumDownloadForOrder(order), req);
  const base = publicBaseUrl(req);
  const front = frontendBaseUrl(req);
  const downloadUrl = paid && order.downloadToken ? `${base}/api/premium/download/${encodeURIComponent(order.downloadToken)}` : "";
  const receiptUrl = paid ? `${base}/api/premium/receipt/${encodeURIComponent(order.orderId)}` : "";
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AZOBSS Payment</title><style>body{font-family:Arial,sans-serif;background:#07111f;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}.box{max-width:680px;background:#101b2d;border:1px solid #1f9d55;border-radius:18px;padding:28px;text-align:center}a{display:inline-block;margin:8px;padding:12px 18px;border-radius:12px;background:#22c55e;color:#fff;text-decoration:none;font-weight:700}.muted{color:#a7b6cc}</style></head><body><div class="box"><h1>${paid ? "Payment Successful ✅" : "Payment Pending"}</h1><p class="muted">Order: ${order?.orderId || orderId || "-"}</p>${paid ? `<p>Your download link is ready.</p><a href="${downloadUrl}">Download File</a><a href="${receiptUrl}">Receipt</a>` : `<p>Your payment has not been verified yet. Please return to AZOBSS and check the payment status again.</p>`}<br><a style="background:#2563eb" href="${front}/Software-Tools/">Back to AZOBSS</a></div></body></html>`);
});


app.post("/api/premium/complete-purchase", async (req, res) => {
  const data = req.body || {};
  const product = data.product || {};
  const productName = cleanPremiumText(product.name || data.productName, 160);
  const productId = cleanPremiumText(product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
  const amount = cleanPremiumText(product.price || data.amount || data.price, 40);
  const downloadLink = cleanPremiumUrl(product.secureDownloadLink || product.downloadLink || data.downloadLink);
  const paymentMethod = cleanPremiumText(data.paymentMethod || "manual", 40);
  const paymentReference = cleanPremiumText(data.paymentReference || data.reference || "", 200);
  const requestedLimit = 1; // auto-expire after first download
  const requestedExpiryHours = Math.max(0, Math.min(24 * 30, Number(product.expiryHours ?? data.expiryHours ?? 24)));
  const expiresAtMs = requestedExpiryHours === 0 ? Date.now() + (100 * 365 * 24 * 60 * 60 * 1000) : Date.now() + requestedExpiryHours * 60 * 60 * 1000;
  const user = getPremiumUser(data);
  if (!productName || !amount) return res.status(400).json({ ok:false, error:"Missing product name or amount" });
  if (!downloadLink) return res.status(400).json({ ok:false, error:"Download link belum diset untuk produk ini. Sila hubungi admin." });
  const orderId = makePremiumId("ord");
  const token = makePremiumId("dl").replace(/[^a-zA-Z0-9_-]/g, "");
  const now = Date.now();
  const order = { orderId, productId, productName, amount, status:"paid", paymentMethod, paymentReference, user, createdAt:new Date(now).toISOString(), paidAt:new Date(now).toISOString(), downloadToken:token, tokenExpiresAt:new Date(expiresAtMs).toISOString(), maxDownload:requestedLimit };
  savePremiumOrder(order);
  savePremiumToken({ token, orderId, productId, productName, user, downloadLink, createdAt:now, expiresAt:expiresAtMs, usedCount:0, maxDownload:requestedLimit });
  await sendDownloadEmailForOrder(order, req);
  res.json({ ok:true, orderId, status:"paid", message:"Purchase completed. A temporary download link has been generated and an email will be sent if SMTP is enabled.", downloadUrl:`/api/premium/download/${encodeURIComponent(token)}`, receiptUrl:`/api/premium/receipt/${encodeURIComponent(orderId)}`, expiresAt:order.tokenExpiresAt, maxDownload:requestedLimit });
});

app.get("/api/premium/download/:token", (req, res) => {
  const token = req.params.token;
  const saved = findPremiumToken(token);
  if (!saved || Number(saved.expiresAt || 0) < Date.now() || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
    return res.status(403).send("Download link expired. This secure link can only be used once.");
  }

  // Mark used immediately so the link expires after the first successful access/redirect.
  updatePremiumToken(token, t => ({
    ...t,
    usedCount: Number(t.maxDownload || 1),
    expired: true,
    expiredReason: "first_download",
    lastUsedAt: Date.now()
  }));

  const target = saved.downloadLink;
  if (/^https?:\/\//i.test(target)) return res.redirect(302, target);
  if (target.startsWith("/")) {
    const filePath = path.resolve(path.join(__dirname, "..", target));
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return res.status(404).send("File not found");
    return res.download(filePath);
  }
  res.status(404).send("Invalid download link");
});

app.get("/api/premium/receipt/:orderId", (req, res) => {
  const orders = readPremiumJson(PREMIUM_ORDERS_FILE, []);
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).send("Receipt not found");
  res.type("html").send(buildReceiptHtml(order));
});


// =========================
// SOFTWARE STATS BACKEND SYNC
// Stored in backend/data/software-stats.json
// =========================
app.get("/api/software-stats", (req, res) => {
  const stats = readSoftwareStats();
  const normalized = {};
  Object.entries(stats).forEach(([key, value]) => {
    normalized[cleanSoftwareId(key)] = normalizeSoftwareStats(value);
  });
  writeSoftwareStats(normalized);
  res.json({ ok: true, stats: normalized, updatedAt: new Date().toISOString() });
});

app.post("/api/software-logo/save", requireAdmin, async (req, res) => {
  try {
    const productId = cleanLogoFileName(req.body?.productId || req.body?.id || req.body?.name || "software-logo");
    const sourceUrl = cleanPremiumUrl(req.body?.sourceUrl || req.body?.downloadLink || req.body?.url || "");
    const requestedLogo = cleanPremiumUrl(req.body?.logoUrl || "");
    const logoUrl = requestedLogo || faviconFromUrl(sourceUrl);
    if (!logoUrl) return res.status(400).json({ ok: false, error: "No valid source/logo URL" });

    const dir = softwareLogoDir();
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `${productId}.png`;
    const fullPath = path.join(dir, fileName);

    const response = await fetch(logoUrl, { headers: { "User-Agent": "AZOBSS-Logo-Regenerator/1.0" } });
    if (!response.ok) return res.status(502).json({ ok: false, error: `Logo fetch failed HTTP ${response.status}` });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return res.status(502).json({ ok: false, error: "Logo file empty" });
    fs.writeFileSync(fullPath, buffer);

    res.json({ ok: true, productId, savedPath: publicLogoPath(fileName), fullPath, sourceUrl, logoUrl, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("software-logo/save failed", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to save logo" });
  }
});

app.post("/api/software-stats/download", (req, res) => {
  const stats = readSoftwareStats();
  const { key, item } = getSoftwareStatsItem(stats, req.body?.productId || req.body?.id || req.body?.name);
  item.downloads += 1;
  item.updatedAt = new Date().toISOString();
  stats[key] = item;
  writeSoftwareStats(stats);
  res.json({ ok: true, productId: key, stats: item });
});

app.post("/api/software-stats/like", (req, res) => {
  const stats = readSoftwareStats();
  const { key, item } = getSoftwareStatsItem(stats, req.body?.productId || req.body?.id || req.body?.name);
  const delta = Number(req.body?.delta || 1) < 0 ? -1 : 1;
  item.likes = Math.max(0, item.likes + delta);
  item.updatedAt = new Date().toISOString();
  stats[key] = item;
  writeSoftwareStats(stats);
  res.json({ ok: true, productId: key, stats: item });
});

app.post("/api/software-stats/rate", (req, res) => {
  const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating || 0))));
  if (!rating) return res.status(400).json({ ok: false, error: "Invalid rating" });
  const stats = readSoftwareStats();
  const { key, item } = getSoftwareStatsItem(stats, req.body?.productId || req.body?.id || req.body?.name);
  item.ratings = item.ratings && typeof item.ratings === "object" ? item.ratings : { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const star of ["1", "2", "3", "4", "5"]) item.ratings[star] = Math.max(0, Math.round(Number(item.ratings[star] || 0)));
  item.ratedBy = item.ratedBy && typeof item.ratedBy === "object" ? item.ratedBy : {};

  const voterId = getRatingVoterId(req);
  const previous = Math.max(0, Math.min(5, Math.round(Number(item.ratedBy[voterId] || 0))));
  if (previous >= 1 && previous <= 5) item.ratings[String(previous)] = Math.max(0, item.ratings[String(previous)] - 1);
  item.ratings[String(rating)] += 1;
  item.ratedBy[voterId] = rating;

  const normalized = normalizeSoftwareStats(item);
  normalized.updatedAt = new Date().toISOString();
  stats[key] = normalized;
  writeSoftwareStats(stats);
  res.json({ ok: true, productId: key, voterId, stats: normalized });
});

app.post("/api/software-stats/admin-set", requireAdmin, (req, res) => {
  const stats = readSoftwareStats();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  for (const raw of items) {
    const key = cleanSoftwareId(raw.productId || raw.id || raw.name);
    const ratingAverage = Math.max(0, Math.min(5, Number(raw.ratingAverage ?? raw.rating ?? 0)));
    const ratingVotes = Math.max(0, Math.round(Number(raw.ratingVotes || raw.votes || 0)));
    const ratingTotal = ratingVotes ? ratingAverage * ratingVotes : Number(raw.ratingTotal || 0);
    stats[key] = normalizeSoftwareStats({
      downloads: raw.downloads,
      likes: raw.likes,
      ratingAverage,
      ratingVotes,
      ratingTotal
    });
    stats[key].updatedAt = new Date().toISOString();
  }
  writeSoftwareStats(stats);
  res.json({ ok: true, stats });
});

app.get("/api/lucky-draw/prize", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const prize = readJson(getPrizeFile(key), {
    monthKey: key,
    title: "Hadiah belum diumumkan",
    description: "Admin belum upload hadiah Lucky Draw bulan ini.",
    imageUrl: "",
    updatedAt: ""
  });
  res.json({ ok: true, prize, monthName: monthName(key) });
});

app.post("/api/lucky-draw/prize", requireAdmin, upload.single("image"), (req, res) => {
  const key = req.body.monthKey || monthKey();
  const previous = readJson(getPrizeFile(key), {});
  const imageUrl = req.file
    ? `${PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`}/uploads/lucky-draw/${req.file.filename}`
    : (cleanText(req.body.imageUrl, 600) || previous.imageUrl || previous.image || "");

  const prize = {
    monthKey: key,
    title: req.body.title || previous.title || "Hadiah Lucky Draw",
    description: req.body.description || previous.description || "",
    imageUrl,
    image: imageUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: req.body.updatedBy || "admin"
  };

  writeJson(getPrizeFile(key), prize);
  res.json({ ok: true, prize });
});


// Simple alias for browser test and old frontend code.
// ES module safe: no require().
app.get("/api/prize", (req, res) => {
  try {
    const key = req.query.monthKey || monthKey();

    let prize = readJson(getPrizeFile(key), null);

    // Fallback manual file: backend/data/prize.json
    if (!prize) {
      prize = readJson(path.join(DATA_DIR, "prize.json"), null);
    }

    if (!prize) {
      prize = {
        monthKey: key,
        title: "Hadiah belum diumumkan",
        description: "Admin belum upload hadiah Lucky Draw bulan ini.",
        imageUrl: "",
        image: "",
        updatedAt: ""
      };
    }

    // Support both field names.
    if (!prize.imageUrl && prize.image) prize.imageUrl = prize.image;
    if (!prize.image && prize.imageUrl) prize.image = prize.imageUrl;

    res.json({
      ok: true,
      success: true,
      prize,
      monthName: monthName(key)
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});

app.get("/api/lucky-draw/entries", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const entries = readJson(getEntriesFile(key), []);
  const active = entries.filter((e) => !e.deleted);
  res.json({ ok: true, monthKey: key, total: active.length, entries: active });
});

app.post("/api/lucky-draw/entries", (req, res) => {
  const key = req.body.monthKey || monthKey();
  const file = getEntriesFile(key);
  const entries = readJson(file, []);
  const usernameKey = cleanText(req.body.usernameKey, 80).toLowerCase();
  if (!usernameKey) return res.status(400).json({ ok: false, error: "usernameKey required" });
  const inviteCode = cleanText(req.body.inviteCode, 40).toUpperCase();
  const inviteUrl = cleanText(req.body.inviteUrl, 500);
  const shareConfirmed = req.body.shareConfirmed === true || req.body.shareConfirmed === "true" || req.body.shareConfirmed === "1";
  const deviceFingerprint = cleanText(req.body.deviceFingerprint, 160);
  const ipAddress = getClientIp(req);

  if (!inviteCode || !inviteUrl || !shareConfirmed) {
    return res.status(400).json({ ok: false, error: "Share invite link dahulu sebelum join Lucky Draw." });
  }

  if (!deviceFingerprint) {
    return res.status(400).json({ ok: false, error: "Device fingerprint required" });
  }

  const activeEntries = entries.filter((e) => e.monthKey === key && !e.deleted);
  const sameUser = activeEntries.find((e) => e.usernameKey === usernameKey);
  if (sameUser) {
    return res.status(409).json({ ok: false, error: "Username ini sudah join Lucky Draw bulan ini.", entry: sameUser });
  }

  const sameDevice = activeEntries.find((e) => e.deviceFingerprint && e.deviceFingerprint === deviceFingerprint);
  if (sameDevice) {
    return res.status(409).json({ ok: false, error: "Device ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameDevice });
  }

  const sameIp = activeEntries.find((e) => e.ipAddress && ipAddress && e.ipAddress === ipAddress);
  if (sameIp) {
    return res.status(409).json({ ok: false, error: "IP address ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameIp });
  }

  const entry = {
    id: `${key}_${usernameKey}`,
    monthKey: key,
    usernameKey,
    uid: cleanText(req.body.uid, 120),
    name: cleanText(req.body.name, 160) || usernameKey,
    phone: cleanText(req.body.phone, 60),
    contactEmail: cleanText(req.body.contactEmail, 180),
    inviteCode,
    inviteUrl,
    invitedByCode: cleanText(req.body.invitedByCode, 40).toUpperCase(),
    deviceFingerprint,
    ipAddress,
    userAgent: cleanText(req.get("user-agent"), 300),
    shareConfirmed: true,
    joinedAtMs: Date.now(),
    joinedAt: new Date().toISOString(),
    deleted: false
  };

  entries.push(entry);

  writeJson(file, entries);
  res.json({ ok: true, entry, total: entries.filter((e) => !e.deleted).length });
});

app.patch("/api/lucky-draw/entries/:id", requireAdmin, (req, res) => {
  const key = req.body.monthKey || req.query.monthKey || monthKey();
  const file = getEntriesFile(key);
  const entries = readJson(file, []);
  const index = entries.findIndex((e) => e.id === req.params.id || `${e.monthKey}_${e.usernameKey}` === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, error: "Entry not found" });
  entries[index] = { ...entries[index], ...req.body, editedAt: new Date().toISOString() };
  writeJson(file, entries);
  res.json({ ok: true, entry: entries[index] });
});

app.delete("/api/lucky-draw/entries/:id", requireAdmin, (req, res) => {
  const key = req.query.monthKey || monthKey();
  const file = getEntriesFile(key);
  const entries = readJson(file, []);
  const index = entries.findIndex((e) => e.id === req.params.id || `${e.monthKey}_${e.usernameKey}` === req.params.id);
  if (index < 0) return res.status(404).json({ ok: false, error: "Entry not found" });
  entries[index].deleted = true;
  entries[index].deletedAt = new Date().toISOString();
  writeJson(file, entries);
  res.json({ ok: true });
});

app.delete("/api/lucky-draw/entries", requireAdmin, (req, res) => {
  const key = req.query.monthKey || monthKey();
  const file = getEntriesFile(key);
  const entries = readJson(file, []);
  let count = 0;
  const updated = entries.map((entry) => {
    if (entry.monthKey === key && !entry.deleted) {
      count += 1;
      return { ...entry, deleted: true, resetAt: new Date().toISOString() };
    }
    return entry;
  });
  writeJson(file, updated);
  res.json({ ok: true, reset: count, monthKey: key });
});

function chooseWinner(entries, key = monthKey()) {
  const active = entries.filter((e) => !e.deleted && e.usernameKey)
    .sort((a, b) => String(a.usernameKey).localeCompare(String(b.usernameKey)));
  if (!active.length) return null;
  let seed = 0;
  const text = `${key}|${active.map((e) => e.usernameKey).join("|")}`;
  for (let i = 0; i < text.length; i += 1) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  return active[seed % active.length];
}

app.get("/api/lucky-draw/winner", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const winner = readJson(getWinnerFile(key), null);
  res.json({ ok: true, monthKey: key, winner });
});

app.post("/api/lucky-draw/winner/spin", (req, res) => {
  const key = req.body.monthKey || req.query.monthKey || monthKey();
  const winnerFile = getWinnerFile(key);
  const existing = readJson(winnerFile, null);
  if (existing && !req.body.force) return res.json({ ok: true, winner: existing, alreadySelected: true });

  const entries = readJson(getEntriesFile(key), []);
  const winner = chooseWinner(entries, key);
  if (!winner) return res.status(400).json({ ok: false, error: "No participants" });

  const payload = {
    monthKey: key,
    monthName: monthName(key),
    usernameKey: winner.usernameKey,
    name: winner.name || winner.usernameKey,
    phone: winner.phone || "",
    contactEmail: winner.contactEmail || "",
    inviteCode: winner.inviteCode || "",
    selectedAtMs: Date.now(),
    selectedAt: new Date().toISOString()
  };

  writeJson(winnerFile, payload);
  res.json({ ok: true, winner: payload });
});

app.delete("/api/lucky-draw/winner", requireAdmin, (req, res) => {
  const key = req.query.monthKey || monthKey();
  const file = getWinnerFile(key);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true, reset: true, monthKey: key });
});

cron.schedule("* * * * *", async () => {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isLastDay = nextDay.getDate() === 1;
  const isTenPm = now.getHours() === 22 && now.getMinutes() === 0;
  if (!isLastDay || !isTenPm) return;

  const key = monthKey(now);
  const winnerFile = getWinnerFile(key);
  if (fs.existsSync(winnerFile)) return;
  const entries = readJson(getEntriesFile(key), []);
  const winner = chooseWinner(entries, key);
  if (!winner) return;

  writeJson(winnerFile, {
    monthKey: key,
    monthName: monthName(key),
    usernameKey: winner.usernameKey,
    name: winner.name || winner.usernameKey,
    selectedAtMs: Date.now(),
    selectedAt: new Date().toISOString(),
    selectedBy: "cron"
  });
}, { timezone: "Asia/Kuala_Lumpur" });




// =========================
// PA PDF CONVERTER HELPERS
// =========================
function cleanPaNumber(value) {
  return String(value || "").trim().toUpperCase().replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
}

function cleanPaState(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9 ._\-]/g, " ").replace(/\s+/g, " ");
}

async function fetchJupemFile(targetUrl) {
  return fetch(targetUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "image/tiff,image/*,application/pdf,application/octet-stream,*/*"
    }
  });
}

async function convertTifBufferToPdfBuffer(tifBuffer, safeName) {
  const pages = [];
  const meta = await sharp(tifBuffer, { pages: -1, limitInputPixels: false }).metadata();
  const pageCount = Math.max(1, Number(meta.pages || 1));

  for (let i = 0; i < pageCount; i++) {
    const pngBuffer = await sharp(tifBuffer, { page: i, limitInputPixels: false })
      .rotate()
      .png()
      .toBuffer();
    const imgMeta = await sharp(pngBuffer).metadata();
    pages.push({
      buffer: pngBuffer,
      width: Math.max(1, Number(imgMeta.width || meta.width || 595)),
      height: Math.max(1, Number(imgMeta.height || meta.height || 842))
    });
  }

  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      margin: 0,
      info: { Title: safeName || "PA PDF", Creator: "AZOBSS PA Converter" }
    });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    pages.forEach(page => {
      doc.addPage({ size: [page.width, page.height], margin: 0 });
      doc.image(page.buffer, 0, 0, { width: page.width, height: page.height });
    });

    doc.end();
  });
}


app.get("/api/check-pa", async (req, res) => {
  try {
    const noPA = cleanPaNumber(req.query.noPA || req.query.pa || req.query.noPa);
    const negeri = cleanPaState(req.query.negeri || req.query.state);

    if (!noPA) return res.status(400).json({ ok: false, error: "Missing noPA" });
    if (!negeri) return res.status(400).json({ ok: false, error: "Missing negeri" });

    const fileName = `PA${noPA}.TIF`;
    const candidates = [
      `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`,
      `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPA=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`,
      `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName.toLowerCase())}&negeri=${encodeURIComponent(negeri)}`
    ];

    for (const jupemUrl of candidates) {
      const response = await fetchJupemFile(jupemUrl);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const firstText = buffer.slice(0, 180).toString("utf8").toLowerCase();
      if (buffer.length > 100 && !firstText.includes("<html") && !firstText.includes("<!doctype")) {
        return res.json({ ok: true, noPA: fileName, negeri, size: buffer.length });
      }
    }

    return res.status(404).json({ ok: false, error: "PA not found" });
  } catch (error) {
    console.error("PA check failed:", error);
    res.status(500).json({ ok: false, error: "PA check failed" });
  }
});

app.get("/api/pa-pdf", async (req, res) => {
  try {
    const noPA = cleanPaNumber(req.query.noPA || req.query.pa || req.query.noPa);
    const negeri = cleanPaState(req.query.negeri || req.query.state);

    if (!noPA) return res.status(400).json({ ok: false, error: "Missing noPA" });
    if (!negeri) return res.status(400).json({ ok: false, error: "Missing negeri" });

    const fileName = `PA${noPA}.TIF`;
    const safeName = `PA${noPA}`.replace(/[^A-Z0-9_-]/gi, "");
    const jupemUrl = `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`;

    const response = await fetchJupemFile(jupemUrl);
    if (!response.ok) return res.status(404).json({ ok: false, error: "PA not found" });

    const tifBuffer = Buffer.from(await response.arrayBuffer());
    const firstText = tifBuffer.slice(0, 180).toString("utf8").toLowerCase();

    if (!tifBuffer.length || firstText.includes("<html") || firstText.includes("<!doctype")) {
      return res.status(404).json({ ok: false, error: "Invalid PA file" });
    }

    const pdfBuffer = await convertTifBufferToPdfBuffer(tifBuffer, safeName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(pdfBuffer);
  } catch (error) {
    console.error("PA PDF conversion failed:", error);
    res.status(500).json({ ok: false, error: "PA PDF conversion failed" });
  }
});

app.get("/api/download-stesen-tanda-aras", async (req, res) => {
  try {
    const productId = String(req.query.productId || req.query.id || "").trim().replace(/[^0-9]/g, "");
    const jenis = String(req.query.jenis || "1").trim() === "2" ? "2" : "1";
    if (!productId) return res.status(400).json({ ok: false, error: "Missing productId" });

    const jupemUrl = `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenTandaAras/${encodeURIComponent(productId)}?jenis=${encodeURIComponent(jenis)}`;
    const response = await fetchJupemFile(jupemUrl);
    if (!response.ok) return res.status(404).json({ ok: false, error: "BM/SBM not found" });

    const buffer = Buffer.from(await response.arrayBuffer());
    const firstText = buffer.slice(0, 180).toString("utf8").toLowerCase();
    if (!buffer.length || firstText.includes("<html") || firstText.includes("<!doctype")) {
      return res.status(404).json({ ok: false, error: "Invalid BM/SBM file" });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const safePrefix = jenis === "2" ? "SBM" : "BM";
    const ext = contentType.includes("pdf") ? "pdf" : (contentType.includes("zip") ? "zip" : "dat");

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safePrefix}-${productId}.${ext}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (error) {
    console.error("BM/SBM download failed:", error);
    res.status(500).json({ ok: false, error: "BM/SBM download failed" });
  }
});


// Legacy /api/create-toyyib-bill removed. Use /api/toyyib/create-bill.

app.use((err, req, res, next) => {
  res.status(400).json({ ok: false, error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`AZOBSS Lucky Draw Backend running on port ${PORT}`);
});




