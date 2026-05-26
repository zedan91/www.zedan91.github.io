
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import cron from "node-cron";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "data");
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || "uploads");
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "*").split(",").map((v) => v.trim()).filter(Boolean);

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
  const ratingTotal = Math.max(0, Number(raw.ratingTotal || 0));
  const ratingVotes = Math.max(0, Math.round(Number(raw.ratingVotes || 0)));
  const downloads = Math.max(0, Math.round(Number(raw.downloads || 0)));
  const likes = Math.max(0, Math.round(Number(raw.likes || 0)));
  const ratingAverage = ratingVotes ? Math.round((ratingTotal / ratingVotes) * 10) / 10 : Math.max(0, Math.min(5, Number(raw.ratingAverage || raw.rating || 0)));
  return { downloads, likes, ratingTotal, ratingVotes, ratingAverage };
}
function readSoftwareStats() { return readPremiumJson(SOFTWARE_STATS_FILE, {}); }
function writeSoftwareStats(stats) { writePremiumJson(SOFTWARE_STATS_FILE, stats || {}); }
function getSoftwareStatsItem(stats, productId) {
  const key = cleanSoftwareId(productId);
  stats[key] = normalizeSoftwareStats(stats[key] || {});
  return { key, item: stats[key] };
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
function buildReceiptHtml(order) { const rows = [["Receipt No", order.orderId], ["Status", order.status], ["Product", order.productName], ["Amount", order.amount], ["Payment Method", order.paymentMethod], ["Reference", order.paymentReference || "-"], ["Username", order.user?.username || "-"], ["Email", order.user?.email || "-"], ["Date", new Date(order.paidAt || order.createdAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })]].map(([k,v]) => `<tr><th>${k}</th><td>${v || "-"}</td></tr>`).join(""); return `<!doctype html><html><head><meta charset="utf-8"><title>AZOBSS Receipt</title><style>body{font-family:Arial,sans-serif;background:#f6f7fb;color:#111;padding:24px}.receipt{max-width:720px;margin:auto;background:#fff;border:1px solid #ddd;border-radius:14px;padding:24px}h1{margin-top:0}table{width:100%;border-collapse:collapse}th,td{padding:12px;border-bottom:1px solid #eee;text-align:left}th{width:180px;color:#555}.ok{color:#16a34a;font-weight:700}.print{margin-top:20px}</style></head><body><div class="receipt"><h1>AZOBSS Payment Receipt</h1><p class="ok">Pembelian selesai ✅</p><table>${rows}</table><p class="print"><button onclick="window.print()">Print / Save PDF</button></p></div></body></html>`; }


app.use(cors({
  origin(origin, cb) {
    if (!origin || CORS_ORIGIN.includes("*") || CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  }
}));

app.use(express.json({ limit: "2mb" }));
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


app.post("/api/premium/complete-purchase", (req, res) => {
  const data = req.body || {};
  const product = data.product || {};
  const productName = cleanPremiumText(product.name || data.productName, 160);
  const productId = cleanPremiumText(product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
  const amount = cleanPremiumText(product.price || data.amount || data.price, 40);
  const downloadLink = cleanPremiumUrl(product.secureDownloadLink || product.downloadLink || data.downloadLink);
  const paymentMethod = cleanPremiumText(data.paymentMethod || "manual", 40);
  const paymentReference = cleanPremiumText(data.paymentReference || data.reference || "", 200);
  const requestedLimit = Math.max(1, Math.min(20, Number(product.downloadLimit || data.downloadLimit || product.maxDownload || 3)));
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
  res.json({ ok:true, orderId, status:"paid", message:"Pembelian selesai. Link download sementara telah dijana.", downloadUrl:`/api/premium/download/${encodeURIComponent(token)}`, receiptUrl:`/api/premium/receipt/${encodeURIComponent(orderId)}`, expiresAt:order.tokenExpiresAt, maxDownload:requestedLimit });
});

app.get("/api/premium/download/:token", (req, res) => {
  const token = req.params.token;
  const saved = findPremiumToken(token);
  if (!saved || Number(saved.expiresAt || 0) < Date.now() || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 3)) return res.status(403).send("Download link expired or already used too many times.");
  updatePremiumToken(token, t => ({ ...t, usedCount: Number(t.usedCount || 0) + 1, lastUsedAt: Date.now() }));
  const target = saved.downloadLink;
  if (/^https?:\/\//i.test(target)) return res.redirect(302, target);
  if (target.startsWith("/")) { const filePath = path.resolve(path.join(__dirname, "..", target)); if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return res.status(404).send("File not found"); return res.download(filePath); }
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
  const rating = Math.max(1, Math.min(5, Number(req.body?.rating || 0)));
  if (!rating) return res.status(400).json({ ok: false, error: "Invalid rating" });
  const stats = readSoftwareStats();
  const { key, item } = getSoftwareStatsItem(stats, req.body?.productId || req.body?.id || req.body?.name);
  item.ratingTotal = Math.max(0, Number(item.ratingTotal || 0)) + rating;
  item.ratingVotes = Math.max(0, Number(item.ratingVotes || 0)) + 1;
  item.ratingAverage = Math.round((item.ratingTotal / item.ratingVotes) * 10) / 10;
  item.updatedAt = new Date().toISOString();
  stats[key] = item;
  writeSoftwareStats(stats);
  res.json({ ok: true, productId: key, stats: item });
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

app.use((err, req, res, next) => {
  res.status(400).json({ ok: false, error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`AZOBSS Lucky Draw Backend running on port ${PORT}`);
});
