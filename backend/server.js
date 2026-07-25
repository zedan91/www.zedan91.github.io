
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
import admin from "firebase-admin";
import { Readable } from "stream";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "").trim();
const ADMIN_ALLOWED_EMAILS = new Set((["zedan91@azobss.local", "zedan9107@gmail.com"])
  .concat(String(process.env.ADMIN_ALLOWED_EMAILS || process.env.AZOBSS_ADMIN_EMAILS || "").split(/[;,\s]+/))
  .map((v) => String(v || "").trim().toLowerCase())
  .filter(Boolean));
const ADMIN_ALLOWED_UIDS = new Set(String(process.env.ADMIN_ALLOWED_UIDS || process.env.AZOBSS_ADMIN_UIDS || "").split(/[;,\s]+/).map((v) => String(v || "").trim()).filter(Boolean));
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "data");
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || "uploads");

const LUCKY_DRAW_STORAGE = String(process.env.LUCKY_DRAW_STORAGE || process.env.AZOBSS_LUCKY_DRAW_STORAGE || "json").toLowerCase();
let luckyDrawDb = null;
let luckyDrawFieldValue = null;

function initLuckyDrawFirestore() {
  if (!/^firestore|firebase$/i.test(LUCKY_DRAW_STORAGE)) return null;
  try {
    if (!admin.apps.length) {
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
      const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
      if (rawJson || rawB64) {
        const serviceAccount = JSON.parse(rawJson || Buffer.from(rawB64, "base64").toString("utf8"));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
      } else {
        console.warn("AZOBSS Lucky Draw Firestore requested but no service account/env found. Falling back to JSON storage.");
        return null;
      }
    }
    luckyDrawFieldValue = admin.firestore.FieldValue;
    return admin.firestore();
  } catch (err) {
    console.warn("AZOBSS Lucky Draw Firestore init failed. Falling back to JSON storage:", err && err.message ? err.message : err);
    return null;
  }
}

luckyDrawDb = initLuckyDrawFirestore();
function useLuckyDrawFirestore(){ return !!luckyDrawDb; }

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
const PREMIUM_DOWNLOAD_SESSIONS_FILE = path.join(DATA_DIR, "premium-download-sessions.json");
const SOFTWARE_STATS_FILE = path.join(DATA_DIR, "software-stats.json");
const COMMISSION_RECORDS_FILE = path.join(DATA_DIR, "commission-records.json");

function initAzobssBackendFirestore() {
  try {
    if (admin.apps.length) return admin.firestore();
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
    const rawB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
    if (rawJson || rawB64) {
      const serviceAccount = JSON.parse(rawJson || Buffer.from(rawB64, "base64").toString("utf8"));
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return admin.firestore();
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID) {
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
      return admin.firestore();
    }
  } catch (err) {
    console.warn("AZOBSS backend Firestore init skipped:", err && err.message ? err.message : err);
  }
  return null;
}

let azobssBackendDb = null;
function getAzobssBackendDb(){
  if (azobssBackendDb) return azobssBackendDb;
  azobssBackendDb = initAzobssBackendFirestore();
  return azobssBackendDb;
}
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

function azobssNormalizeUserPriceAdjustment(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-99, Math.min(500, Math.round(n * 100) / 100));
}
function azobssPriceAdjustmentCategory(value = "software") {
  const key = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["lot","lotkadaster","lotkadasterberdigit","ndcdb","ndcdbc3"].includes(key)) return "lotKadaster";
  if (["pabm","jupem"].includes(key)) return "paBm";
  if (["publicpa","paawam","pelanakui","pelanakuiawam"].includes(key)) return "publicPa";
  if (["cad","cadtools","cadtool"].includes(key)) return "cadTools";
  return "software";
}
function azobssIdentityPriceAdjustments(identity = {}) {
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
      out[key] = azobssNormalizeUserPriceAdjustment(raw ?? 0);
    }
    return out;
  }
  const legacy = azobssNormalizeUserPriceAdjustment(managed ? (identity.adminPriceAdjustmentPercent ?? identity.priceAdjustmentPercent ?? 0) : (identity.priceAdjustmentPercent ?? identity.adminPriceAdjustmentPercent ?? 0));
  for (const key of keys) out[key] = legacy;
  return out;
}
function azobssIdentityPriceAdjustment(identity = {}, category = "software") {
  return azobssIdentityPriceAdjustments(identity)[azobssPriceAdjustmentCategory(category)] || 0;
}
function azobssApplyUserPriceAdjustment(amount, identity = {}, category = "software") {
  const base = Number(amount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const percent = azobssIdentityPriceAdjustment(identity, category);
  return Math.max(0.01, Math.round((base * (1 + percent / 100) + Number.EPSILON) * 100) / 100);
}
async function azobssResolvePremiumPriceCategory(data = {}, product = {}, productId = "") {
  const id = cleanPremiumText(productId || product.productId || product.id || data.productId || "", 180);
  const db = getAzobssBackendDb();
  if (db && id) {
    const groups = [
      ["cadTools", ["cadTools", "cadToolsResources", "staffCADSubmissions"]],
      ["software", ["softwareTools", "staffSoftwareSubmissions"]]
    ];
    for (const [category, collections] of groups) {
      for (const col of collections) {
        try { const snap = await db.collection(col).doc(id).get(); if (snap.exists) return category; } catch (_) {}
        for (const field of ["productId","id","sku"]) {
          try { const qs = await db.collection(col).where(field, "==", id).limit(1).get(); if (!qs.empty) return category; } catch (_) {}
        }
      }
    }
  }
  const hint = [product.source, product.productSource, product.category, product.type, data.returnUrl, data.pageUrl, data.sourceUrl].map(v => String(v || "").toLowerCase()).join(" ");
  return /cad[\s_-]*tools|cadtools|cad-tool|cad tool/.test(hint) ? "cadTools" : "software";
}
function azobssMoneyText(amount) {
  const n = Number(amount || 0);
  return `RM${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

const AZOBSS_JUPEM_PRODUCT_TYPES = new Set(["PA", "BM", "SBM", "GPS", "NDCDB", "NDCDB_C3", "SYIT_PIAWAI"]);
const AZOBSS_JUPEM_AREA_TYPES = new Set(["NDCDB", "NDCDB_C3"]);
const AZOBSS_JUPEM_STATES = new Set([
  "JOHOR", "KEDAH", "KELANTAN", "MELAKA", "NEGERI SEMBILAN", "PAHANG", "PERAK", "PERLIS",
  "PULAU PINANG", "SABAH", "SARAWAK", "SELANGOR", "TERENGGANU",
  "WILAYAH PERSEKUTUAN KUALA LUMPUR", "WILAYAH PERSEKUTUAN LABUAN", "WILAYAH PERSEKUTUAN PUTRAJAYA"
]);
const AZOBSS_PA_BM_MAX_DOWNLOADS = 5;
const AZOBSS_PA_BM_VALID_MS = 7 * 24 * 60 * 60 * 1000;

function azobssCheckoutError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function azobssJupemItemAmount(productType, variant) {
  if (productType === "PA") return 5;
  if (productType === "BM" || productType === "SBM") return 3;
  if (productType === "GPS") return 9;
  if (productType === "SYIT_PIAWAI") return 7;
  if (AZOBSS_JUPEM_AREA_TYPES.has(productType)) return variant === "QUARTER_SHEET" ? 15 : 50;
  azobssCheckoutError("Unsupported JUPEM document category.");
}

function azobssBuildJupemCheckout(data = {}, identity = {}) {
  if (!identity || !identity.uid) azobssCheckoutError("Please login again before proceeding to payment.", 401);
  const submittedUser = getPremiumUser(data);
  const user = {
    uid: cleanPremiumText(identity.uid, 120),
    username: cleanPremiumText(identity.username || data.usernameKey || submittedUser.username || "", 80).toLowerCase(),
    email: cleanPremiumText(identity.authEmail || identity.email || submittedUser.email || "", 160),
    authEmail: cleanPremiumText(identity.authEmail || identity.email || "", 160),
    phone: cleanPremiumText(submittedUser.phone || "", 40)
  };
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length || rawItems.length > 50) azobssCheckoutError("Cart must contain between 1 and 50 documents.");

  const seen = new Set();
  const items = [];
  const priceAdjustmentByCategory = {
    paBm: azobssIdentityPriceAdjustment(identity, "paBm"),
    lotKadaster: azobssIdentityPriceAdjustment(identity, "lotKadaster")
  };
  for (const rawItem of rawItems) {
    const productType = cleanPremiumText(rawItem.productType || "PA", 20).toUpperCase();
    if (!AZOBSS_JUPEM_PRODUCT_TYPES.has(productType)) azobssCheckoutError("Unsupported JUPEM document category.");
    const negeri = cleanPremiumText(rawItem.negeri || "", 80).toUpperCase();
    if (!AZOBSS_JUPEM_STATES.has(negeri)) azobssCheckoutError("Please select a valid state for every document.");
    let itemCode = cleanPremiumText(rawItem.itemCode || rawItem.stationNo || rawItem.productId || "", 80).toUpperCase();
    if (productType === "PA") itemCode = itemCode.replace(/^PA/i, "").replace(/\.TIF$/i, "").replace(/[^0-9]/g, "");
    if (!itemCode || (productType === "PA" && !/^\d{1,12}$/.test(itemCode))) {
      azobssCheckoutError("A valid document number is required for every cart item.");
    }
    const variant = AZOBSS_JUPEM_AREA_TYPES.has(productType)
      ? cleanPremiumText(rawItem.variant || rawItem.areaSize || "", 30).toUpperCase()
      : "";
    if (AZOBSS_JUPEM_AREA_TYPES.has(productType) && variant !== "FULL_SHEET" && variant !== "QUARTER_SHEET") {
      azobssCheckoutError("Select either 1 sheet area or 1/4 sheet area.");
    }
    const uniqueKey = `${productType}|${itemCode}|${negeri}|${variant}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    const baseAmount = azobssJupemItemAmount(productType, variant);
    const priceAdjustmentCategory = AZOBSS_JUPEM_AREA_TYPES.has(productType) ? "lotKadaster" : "paBm";
    const priceAdjustmentPercent = priceAdjustmentByCategory[priceAdjustmentCategory] || 0;
    const amount = azobssApplyUserPriceAdjustment(baseAmount, identity, priceAdjustmentCategory);
    items.push({
      productType,
      itemCode,
      negeri,
      variant,
      baseAmount,
      amount,
      priceAdjustmentCategory,
      priceAdjustmentPercent,
      productId: cleanPremiumText(rawItem.productId || "", 120),
      stationNo: cleanPremiumText(rawItem.stationNo || "", 80).toUpperCase(),
      jenis: productType === "SBM" ? "2" : "1",
      downloadUrl: cleanPremiumUrl(rawItem.downloadUrl || ""),
      filename: cleanPremiumText(rawItem.filename || "", 180),
      createdAtMs: Number(rawItem.createdAtMs || 0) || Date.now()
    });
  }
  if (!items.length) azobssCheckoutError("No valid JUPEM documents were found in the cart.");
  const baseTotalAmount = Math.round((items.reduce((sum, item) => sum + Number(item.baseAmount || 0), 0) + Number.EPSILON) * 100) / 100;
  const totalAmount = Math.round((items.reduce((sum, item) => sum + Number(item.amount || 0), 0) + Number.EPSILON) * 100) / 100;
  const usedPercents = [...new Set(items.map(item => Number(item.priceAdjustmentPercent || 0)))];
  const priceAdjustmentPercent = usedPercents.length === 1 ? usedPercents[0] : 0;
  return { user, items, baseTotalAmount, totalAmount, amountSen: Math.round(totalAmount * 100), priceAdjustmentPercent, priceAdjustmentByCategory };
}

async function azobssPersistJupemOrder(order = {}) {
  const saved = upsertPremiumOrder(order);
  const db = getAzobssBackendDb();
  if (!db || !saved.orderId) return saved;
  try {
    const safe = JSON.parse(JSON.stringify(saved));
    safe.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("premiumOrders").doc(cleanPremiumText(saved.orderId, 180)).set(safe, { merge: true });
  } catch (error) {
    console.warn("JUPEM premium order Firestore persist skipped:", error && (error.message || error));
  }
  return saved;
}

async function azobssSyncJupemPurchaseLogs(order = {}, status = "pending", extra = {}) {
  if (!Array.isArray(order.paBmItems) || !order.paBmItems.length) return { ok: false, updated: 0 };
  const db = getAzobssBackendDb();
  if (!db) return { ok: false, updated: 0, reason: "firebase_not_configured" };
  const nowMs = Number(extra.nowMs || Date.now());
  const paid = ["paid", "verified", "success", "completed"].includes(String(status || "").toLowerCase());
  const paidAtMs = Number(extra.paidAtMs || nowMs);
  let updated = 0;

  for (let index = 0; index < order.paBmItems.length; index += 1) {
    const item = order.paBmItems[index] || {};
    const itemCode = String(item.itemCode || "").trim().toUpperCase();
    if (!itemCode) continue;
    let targetRef = null;
    try {
      const snap = await db.collection("purchaseLogs").where("itemCode", "==", itemCode).limit(30).get();
      snap.forEach((docSnap) => {
        if (targetRef) return;
        const row = docSnap.data() || {};
        const sameUser = (order.user?.uid && String(row.uid || "") === String(order.user.uid))
          || (order.user?.username && String(row.usernameKey || row.username || "").toLowerCase() === String(order.user.username).toLowerCase());
        const sameType = String(row.productType || row.product || "").toUpperCase() === String(item.productType || "").toUpperCase();
        const sameState = String(row.negeri || row.state || "").toUpperCase() === String(item.negeri || "").toUpperCase();
        if (sameUser && sameType && sameState) targetRef = docSnap.ref;
      });
    } catch (error) {
      console.warn("JUPEM purchase log lookup skipped:", error && (error.message || error));
    }
    if (!targetRef) targetRef = db.collection("purchaseLogs").doc(`${cleanPremiumText(order.orderId, 120)}-${index + 1}`);

    const payload = {
      uid: String(order.user?.uid || ""),
      usernameKey: String(order.user?.username || "").trim().toLowerCase(),
      displayName: String(order.user?.username || "").trim(),
      email: String(order.user?.email || "").trim(),
      phone: String(order.user?.phone || "").trim(),
      productType: String(item.productType || "").toUpperCase(),
      itemCode,
      negeri: String(item.negeri || "").toUpperCase(),
      variant: String(item.variant || "").toUpperCase(),
      amount: Number(item.amount || 0),
      productId: String(item.productId || ""),
      stationNo: String(item.stationNo || ""),
      jenis: String(item.jenis || ""),
      downloadUrl: String(item.downloadUrl || ""),
      filename: String(item.filename || ""),
      status: String(status || "pending").toLowerCase(),
      orderId: String(order.orderId || ""),
      paymentOrderId: String(order.orderId || ""),
      billCode: String(order.billCode || ""),
      paymentUrl: String(order.paymentUrl || ""),
      paymentMethod: String(order.paymentMethod || "toyyibpay"),
      paymentReference: String(extra.paymentReference || order.paymentReference || ""),
      isAdminTestPayment: order.isAdminTestPayment === true,
      testPayment: order.isAdminTestPayment === true,
      paymentSource: String(order.source || ""),
      createdAtMs: Number(item.createdAtMs || nowMs),
      createdAtClient: new Date(Number(item.createdAtMs || nowMs)).toISOString(),
      maxDownloads: AZOBSS_PA_BM_MAX_DOWNLOADS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (paid) {
      payload.paidAtMs = paidAtMs;
      payload.paidAtClient = new Date(paidAtMs).toISOString();
      payload.downloadCount = 0;
      payload.downloadExpiresAtMs = paidAtMs + AZOBSS_PA_BM_VALID_MS;
      payload.downloadExpiresAtClient = new Date(paidAtMs + AZOBSS_PA_BM_VALID_MS).toISOString();
    }
    Object.keys(payload).forEach((key) => {
      if (payload[key] === "" || payload[key] === undefined) delete payload[key];
    });
    try {
      await targetRef.set(payload, { merge: true });
      updated += 1;
    } catch (error) {
      console.error("JUPEM purchase log sync failed:", error && (error.message || error));
    }
  }
  return { ok: updated > 0, updated };
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
    orderId: order.orderId || '',
    billCode: order.billCode || '',
    productId, productName,
    saleAmount,
    saleAmountText: azCommissionAmountText(saleAmount),
    buyerUsername: buyer,
    buyerEmail: cleanPremiumText(order.user?.email || '', 180),
    paymentStatus: order.status || 'paid',
    paymentMethod: order.paymentMethod || '',
    paymentReference: order.paymentReference || '',
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now(),
    status: 'pending',
    payoutStatus: 'pending',
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
    const line = {
      ...base,
      commissionType: kind,
      username,
      uid: uid || '',
      ownerUid: uid || '',
      ownerUsername: username,
      ownerEmail: email || '',
      commissionRate: rate,
      rate,
      commissionAmount: amount,
      amount,
      amountText: azCommissionAmountText(amount),
      azobssShareRate: azRate,
      azobssShareAmount,
      azobssShareText: azCommissionAmountText(azobssShareAmount),
      ownerShareAmount: String(kind).includes('share') ? 0 : amount,
      sharerShareAmount: String(kind).includes('share') ? amount : 0,
      note,
      shareReferral: referral,
      productOwner: owner
    };
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
      upsertPremiumOrder({
        ...order,
        commissionResult: result,
        commissionCheckedAt: new Date().toISOString(),
        commissionStorage: result && result.storage ? result.storage : ''
      });
    }
  }catch(_e){}
  return result;
}
function savePremiumOrder(order) { const orders = readPremiumJson(PREMIUM_ORDERS_FILE, []); orders.unshift(order); writePremiumJson(PREMIUM_ORDERS_FILE, orders.slice(0, 200)); }
function savePremiumToken(tokenData) { const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []); const now = Date.now(); const active = tokens.filter(t => Number(t.expiresAt || 0) > now && Number(t.usedCount || 0) < Number(t.maxDownload || 3)); active.unshift(tokenData); writePremiumJson(PREMIUM_TOKENS_FILE, active.slice(0, 200)); }
function findPremiumToken(token) { return readPremiumJson(PREMIUM_TOKENS_FILE, []).find(t => t.token === token); }
function updatePremiumToken(token, updater) { const tokens = readPremiumJson(PREMIUM_TOKENS_FILE, []); const index = tokens.findIndex(t => t.token === token); if (index >= 0) { tokens[index] = updater(tokens[index]); writePremiumJson(PREMIUM_TOKENS_FILE, tokens); return tokens[index]; } return null; }

// AZOBSS PATCH 378: sync secure token usage back to premiumOrders so My Purchases shows 1/1 or expired after real download starts.
function azSyncPremiumOrderDownloadUsage(saved={}, token="", used=0, sessionId="", sessionExpiresAt=0, now=Date.now()){
  try{
    if(!saved || !(saved.orderId || saved.billCode)) return null;
    const max=Math.max(1,Number(saved.maxDownload||saved.maxDownloads||saved.downloadLimit||1)||1);
    const tokenExpiresAtMs=Number(saved.expiresAt||saved.expiresAtMs||0)||0;
    const exhausted=Number(used||0)>=max;
    const expiredByTime=!!(tokenExpiresAtMs&&tokenExpiresAtMs<=now&&saved.expiresNever!==true&&saved.neverExpire!==true&&saved.downloadNeverExpire!==true);
    return upsertPremiumOrder({
      ...saved,
      downloadToken:token||saved.downloadToken||saved.token||"",
      tokenExpiresAt:tokenExpiresAtMs?new Date(tokenExpiresAtMs).toISOString():(saved.tokenExpiresAt||""),
      tokenExpiresAtMs,
      downloadExpiresAtMs:tokenExpiresAtMs,
      downloadExpiresAtClient:tokenExpiresAtMs?new Date(tokenExpiresAtMs).toISOString():"",
      downloadCount:Math.max(0,Number(used||0)||0),
      usedCount:Math.max(0,Number(used||0)||0),
      downloadsUsed:Math.max(0,Number(used||0)||0),
      maxDownload:max,
      maxDownloads:max,
      downloadLimit:max,
      downloadExpired:expiredByTime||exhausted,
      downloadActive:!(expiredByTime||exhausted),
      downloadStatus:exhausted?"used":(expiredByTime?"expired":"active"),
      activeDownloadSessionId:sessionId||saved.activeDownloadSessionId||"",
      activeDownloadSessionExpiresAt:Number(sessionExpiresAt||saved.activeDownloadSessionExpiresAt||0)||0,
      lastDownloadedAt:new Date(now).toISOString(),
      lastDownloadedAtMs:now,
      lastDownloadUsageSyncAt:new Date(now).toISOString(),
      lastDownloadUsageSyncAtMs:now,
      secureDownloadPatch:AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH,
      azobssPatch378:true
    });
  }catch(err){ console.warn("AZOBSS legacy premium order download usage sync failed:", err&&err.message?err.message:err); return null; }
}


// AZOBSS PATCH 373: secure premium download session stream for legacy backend/server.js too.
const AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH = "AZOBSS_SECURE_PREMIUM_DOWNLOAD_20260626";
function azSecureDownloadSecret(){ return String(process.env.AZOBSS_DOWNLOAD_HASH_SECRET || process.env.AZOBSS_RECEIPT_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || process.env.ADMIN_KEY || process.env.TOYYIB_SECRET_KEY || "azobss-secure-download-fallback-change-this-secret"); }
function azHashDownloadValue(value=""){ return crypto.createHmac("sha256", azSecureDownloadSecret()).update(String(value||"")).digest("hex"); }
function azPremiumSessionTtlMs(){ const n=Number(process.env.AZOBSS_DOWNLOAD_SESSION_TTL_MS || 15*60*1000); return Number.isFinite(n)&&n>=60000?Math.min(n,6*60*60*1000):15*60*1000; }
function azPremiumClientIp(req){ const fwd=String(req.headers["x-forwarded-for"]||"").split(",")[0].trim(); return fwd || req.ip || req.socket?.remoteAddress || "unknown"; }
function azPremiumClientKey(req){ return azHashDownloadValue(azPremiumClientIp(req)); } // audit only; IDM handoff may change headers/IP key
function azSafeDownloadFilename(value="azobss-download.bin"){ return String(value||"azobss-download.bin").replace(new RegExp('[\\\/:*?"<>|\\r\\n\\t]', "g"), "_").replace(/\s+/g," ").slice(0,180) || "azobss-download.bin"; }
function azPremiumDownloadSource(saved={}){ return cleanPremiumUrl(saved.privateFileUrl || saved.sourceFileUrl || saved.downloadLink || saved.premiumDownloadFileLink || saved.secureDownloadLink || saved.privateDownloadLink || saved.downloadUrl || saved.url || ""); }
function azPremiumAllowedDownloadHost(hostname=""){ const host=String(hostname||"").toLowerCase(); if(!host||host==="localhost"||host.endsWith(".local")||/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)||/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false; const raw=String(process.env.AZOBSS_PREMIUM_ALLOWED_FILE_HOSTS||"").trim(); if(!raw) return true; const allowed=raw.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean); return allowed.includes("*") || allowed.some(rule=>host===rule || (rule.startsWith("*.") && host.endsWith(rule.slice(1)))); }
function azValidatePremiumSource(source=""){ const target=cleanPremiumUrl(source); if(!target) throw Object.assign(new Error("Premium file URL is missing."),{statusCode:404}); if(target.startsWith("/")) return {type:"local",target}; const u=new URL(target); if(u.protocol!=="https:") throw Object.assign(new Error("Premium file source must use HTTPS."),{statusCode:403}); if(!azPremiumAllowedDownloadHost(u.hostname)) throw Object.assign(new Error("Premium file source host is not allowed."),{statusCode:403}); return {type:"remote",target:u.toString()}; }
function azPremiumDownloadFilename(saved={},source=""){ const direct=saved.filename||saved.fileName||saved.productFilename||saved.softwareFilename||saved.productName||""; if(direct){ try{ const ext=path.extname(String(direct)); if(ext) return azSafeDownloadFilename(direct); const srcExt=path.extname(new URL(source).pathname||""); return azSafeDownloadFilename(srcExt?`${direct}${srcExt}`:direct); }catch{ return azSafeDownloadFilename(direct); } } try{ return azSafeDownloadFilename(decodeURIComponent(path.basename(new URL(source).pathname||""))||"azobss-download.bin"); }catch{ return "azobss-download.bin"; } }
function readPremiumDownloadSessions(){ const now=Date.now(); const rows=readPremiumJson(PREMIUM_DOWNLOAD_SESSIONS_FILE, []); return (Array.isArray(rows)?rows:[]).filter(x=>Number(x.expiresAt||0)>now-60*60*1000).slice(0,500); }
function savePremiumDownloadSession(session={}){ const rows=readPremiumDownloadSessions().filter(x=>x.sessionId!==session.sessionId); rows.unshift(session); writePremiumJson(PREMIUM_DOWNLOAD_SESSIONS_FILE, rows.slice(0,500)); return session; }
function findPremiumDownloadSession(sessionId){ return readPremiumDownloadSessions().find(x=>x.sessionId===sessionId) || null; }
function updatePremiumDownloadSession(sessionId, patch={}){ const rows=readPremiumDownloadSessions(); const idx=rows.findIndex(x=>x.sessionId===sessionId); if(idx>=0){ rows[idx]={...(rows[idx]||{}),...(patch||{}),updatedAt:new Date().toISOString(),updatedAtMs:Date.now()}; writePremiumJson(PREMIUM_DOWNLOAD_SESSIONS_FILE, rows); return rows[idx]; } return null; }
function azCreatePremiumDownloadSession(req, token, saved={}){ const now=Date.now(); const clientKey=azPremiumClientKey(req); const activeSessionId=String(saved.activeDownloadSessionId||""); const activeExpiresAt=Number(saved.activeDownloadSessionExpiresAt||0)||0; if(activeSessionId&&activeExpiresAt>now){ const active=findPremiumDownloadSession(activeSessionId); if(active&&["active","completed"].includes(String(active.status||"active"))&&Number(active.expiresAt||0)>now){ updatePremiumDownloadSession(activeSessionId,{status:"active",lastSeenAt:new Date(now).toISOString(),lastSeenAtMs:now,idmHandoffReuse:true}); azSyncPremiumOrderDownloadUsage(saved,token,Math.max(0,Number(saved.usedCount||saved.downloadCount||0)||0),activeSessionId,activeExpiresAt,now); return activeSessionId; } } if(Number(saved.expiresAt||0)<now || Number(saved.usedCount||0)>=Number(saved.maxDownload||1)) throw Object.assign(new Error("Download link expired or already used too many times."),{statusCode:403}); const src=azValidatePremiumSource(azPremiumDownloadSource(saved)); const sessionId=makePremiumId("dls").replace(/[^a-zA-Z0-9_-]/g,""); const expiresAt=now+azPremiumSessionTtlMs(); const filename=azPremiumDownloadFilename(saved, src.target); savePremiumDownloadSession({sessionId,token,orderId:saved.orderId||"",productName:saved.productName||"AZOBSS Digital Product",sourceType:src.type,sourceTarget:src.target,filename,status:"active",clientKey,ipHash:azHashDownloadValue(azPremiumClientIp(req)),createdAt:new Date(now).toISOString(),createdAtMs:now,expiresAt,expiresAtIso:new Date(expiresAt).toISOString(),requestCount:0,rangeRequestCount:0,patch:AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH}); const nextUsed=Number(saved.usedCount||0)+1; updatePremiumToken(token,t=>({...t,usedCount:nextUsed,lastUsedAt:now,lastMethod:"SESSION_STREAM",activeDownloadSessionId:sessionId,activeDownloadSessionExpiresAt:expiresAt,secureDownloadPatch:AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH})); azSyncPremiumOrderDownloadUsage(saved,token,nextUsed,sessionId,expiresAt,now); return sessionId; }
function azPremiumContentDisposition(filename="azobss-download.bin"){ const safe=azSafeDownloadFilename(filename); return `attachment; filename="${safe.replace(/"/g,"_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`; }
function azParseRange(rangeHeader="", size=0){ const m=String(rangeHeader||"").match(/^bytes=(\d*)-(\d*)$/); if(!m||!size) return null; let start=m[1]===""?null:Number(m[1]); let end=m[2]===""?null:Number(m[2]); if(start===null&&end!==null){start=Math.max(0,size-end);end=size-1;} if(start!==null&&end===null) end=size-1; if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||start>=size) return null; return {start,end:Math.min(end,size-1)}; }
function azNoStoreDownloadHeaders(res){ res.set({"Cache-Control":"no-store, no-cache, must-revalidate, private, max-age=0","Pragma":"no-cache","Expires":"0","X-AZOBSS-Secure-Download":"1"}); }
async function azStreamLocalPremiumSession(req,res,session){ const filePath=path.resolve(path.join(__dirname,"..", session.sourceTarget||"")); if(!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()) return res.status(404).send("File not found"); const st=fs.statSync(filePath); const range=String(req.headers.range||""); const parsed=range?azParseRange(range,st.size):null; azNoStoreDownloadHeaders(res); res.set({"Content-Type":"application/octet-stream","Content-Disposition":azPremiumContentDisposition(session.filename||path.basename(filePath)),"Accept-Ranges":"bytes"}); if(range&&!parsed){ res.status(416).set("Content-Range",`bytes */${st.size}`).end(); return; } if(parsed){ res.status(206).set({"Content-Range":`bytes ${parsed.start}-${parsed.end}/${st.size}`,"Content-Length":String(parsed.end-parsed.start+1)}); if(req.method==="HEAD") return res.end(); fs.createReadStream(filePath,{start:parsed.start,end:parsed.end}).pipe(res); return; } res.status(200).set("Content-Length",String(st.size)); if(req.method==="HEAD") return res.end(); fs.createReadStream(filePath).pipe(res); }
async function azStreamRemotePremiumSession(req,res,session){ const range=String(req.headers.range||""); const headers={}; if(range) headers.Range=range; const upstream=await fetch(session.sourceTarget,{method:req.method==="HEAD"?"HEAD":"GET",headers,redirect:"follow"}); if(![200,206].includes(upstream.status)) return res.status(502).send("File source cannot be reached right now."); if(range&&upstream.status!==206) return res.status(502).send("File host does not support resume/Range for this download."); azNoStoreDownloadHeaders(res); res.status(upstream.status); res.set({"Content-Type":upstream.headers.get("content-type")||"application/octet-stream","Content-Disposition":azPremiumContentDisposition(session.filename||"azobss-download.bin"),"Accept-Ranges":upstream.headers.get("accept-ranges")||"bytes"}); for(const h of ["content-length","content-range","etag","last-modified"]){ const v=upstream.headers.get(h); if(v) res.set(h,v); } if(req.method==="HEAD"||!upstream.body) return res.end(); await new Promise((resolve,reject)=>{ const ns=Readable.fromWeb(upstream.body); ns.on("error",reject); res.on("finish",resolve); res.on("close",resolve); ns.pipe(res); }); }
async function azHandlePremiumDownloadSession(req,res){ const sessionId=String(req.params.sessionId||"").replace(/[^a-zA-Z0-9_-]/g,""); const now=Date.now(); const session=findPremiumDownloadSession(sessionId); if(!session) return res.status(404).send("Download session not found."); const sessionStatus=String(session.status||"active"); if(!["active","completed"].includes(sessionStatus)||Number(session.expiresAt||0)<=now){ updatePremiumDownloadSession(sessionId,{status:"expired",expiredAt:new Date().toISOString(),expiredAtMs:now}); return res.status(410).send("Download session expired."); } if(sessionStatus==="completed") updatePremiumDownloadSession(sessionId,{status:"active",reopenedForIdmAt:new Date(now).toISOString(),reopenedForIdmAtMs:now}); const clientKeyChanged=Boolean(session.clientKey&&session.clientKey!==azPremiumClientKey(req)); updatePremiumDownloadSession(sessionId,{lastSeenAt:new Date().toISOString(),lastSeenAtMs:now,requestCount:Number(session.requestCount||0)+1,rangeRequestCount:Number(session.rangeRequestCount||0)+(req.headers.range?1:0),lastRange:req.headers.range?String(req.headers.range).slice(0,120):"",clientKeyChangedDuringSession:clientKeyChanged}); try{ if(session.sourceType==="local"||String(session.sourceTarget||"").startsWith("/")) await azStreamLocalPremiumSession(req,res,session); else await azStreamRemotePremiumSession(req,res,session); if(!req.headers.range) updatePremiumDownloadSession(sessionId,{lastFullRequestCompletedAt:new Date().toISOString(),lastFullRequestCompletedAtMs:Date.now()}); }catch(err){ console.error("AZOBSS legacy secure download stream failed:",err&&err.stack||err); updatePremiumDownloadSession(sessionId,{lastError:err&&err.message?err.message:String(err),lastErrorAt:new Date().toISOString()}); if(!res.headersSent) res.status(500).send("Download failed. Please contact admin."); else { try{res.destroy(err);}catch{} } } }
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

function isPublicPaPremiumOrder(order = {}) {
  return !!(order && (order.publicPaPurchase === true || ['public-pa-rm30','public-pa-rm50'].includes(String(order.productId || ''))));
}
function publicPaRecordId(order = {}) {
  return cleanPremiumText(order.publicPaRecordId || (order.orderId ? `${order.orderId}-1` : ''), 180);
}
function publicPaDownloadUrl(order = {}, req = null) {
  const base = req ? publicBaseUrl(req) : (PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  const recordId = publicPaRecordId(order);
  return base && recordId ? `${base}/api/pa-bm-download?recordId=${encodeURIComponent(recordId)}` : '';
}
async function sendPublicPaEmailForOrder(order, req) {
  try {
    if (!order || order.emailSentAt) return order;
    if (order.isAdminTestPayment === true && order.emailSkippedForPaBm === true) return upsertPremiumOrder({ ...order, publicPaEmailSkipped:true, emailError:null });
    const email = cleanPremiumText(order.user?.email || order.email || '', 180).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || /@azobss\.local$/i.test(email)) return order;
    if (!mailEnabled()) return upsertPremiumOrder({ ...order, emailError:'Email service is not configured.' });
    const downloadUrl = publicPaDownloadUrl(order, req);
    if (!downloadUrl) return upsertPremiumOrder({ ...order, emailError:'Public PA record is missing.' });
    const base = req ? publicBaseUrl(req) : (PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
    const receiptUrl = `${base}/api/premium/receipt/${encodeURIComponent(order.orderId)}`;
    const item = Array.isArray(order.paBmItems) ? (order.paBmItems[0] || {}) : {};
    const paLabel = `PA${String(item.itemCode || '').replace(/^PA/i,'')}`;
    const transporter = createMailer();
    await transporter.sendMail({ from:mailFrom(), to:email, subject:`AZOBSS Pelan Akui Ready - ${paLabel}`, html:`<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f3f6fb;padding:24px"><div style="max-width:680px;margin:auto;background:#fff;border-radius:16px;padding:24px"><h2 style="color:#15803d">Pelan Akui Sedia ✅</h2><p><b>${paLabel}</b> (${item.negeri || '-'}) telah tersedia selepas pembayaran RM30 disahkan.</p><p><a href="${downloadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:13px 18px;border-radius:11px;font-weight:700">Download PA PDF</a></p><p>Maksimum 5 kali download dalam 7 hari.</p><p><a href="${receiptUrl}">Lihat resit</a></p></div></body></html>`, text:`AZOBSS Pelan Akui Sedia\n${paLabel}\nDownload: ${downloadUrl}\nResit: ${receiptUrl}\nMaksimum 5 kali download dalam 7 hari.` });
    return upsertPremiumOrder({ ...order, emailSentAt:new Date().toISOString(), emailTo:email, emailError:null, publicPaEmailSent:true });
  } catch (err) { return upsertPremiumOrder({ ...order, emailError:err.message, emailErrorAt:new Date().toISOString() }); }
}

async function sendDownloadEmailForOrder(order, req) {
  try {
    if (isPublicPaPremiumOrder(order)) return await sendPublicPaEmailForOrder(order, req);
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

// AZOBSS PATCH 424: Express backend payment logs delete endpoint.
function azExpressDeleteLogSafeText(v = "", max = 180) {
  return cleanPremiumText(v || "", max);
}
function azExpressDeleteLogRefs(input = {}) {
  const r = input && typeof input === "object" ? input : {};
  const refs = {
    source: azExpressDeleteLogSafeText(r.source || r._azSource || r.collection || "", 80),
    collection: azExpressDeleteLogSafeText(r.collection || "", 80),
    docId: azExpressDeleteLogSafeText(r.docId || r.id || r.firestoreId || "", 180),
    orderId: azExpressDeleteLogSafeText(r.orderId || "", 180),
    billCode: azExpressDeleteLogSafeText(r.billCode || r.billcode || "", 160),
    paymentReference: azExpressDeleteLogSafeText(r.paymentReference || r.transactionId || r.txnId || "", 180),
    productId: azExpressDeleteLogSafeText(r.productId || r.softwareId || r.cadId || "", 180),
    status: azExpressDeleteLogSafeText(r.status || r.paymentStatus || "", 80)
  };
  const src = refs.source.toLowerCase();
  if (!refs.collection) refs.collection = src === "premiumorders" ? "premiumOrders" : "purchaseLogs";
  if (refs.collection !== "premiumOrders" && refs.collection !== "purchaseLogs") refs.collection = "purchaseLogs";
  return refs;
}
async function azExpressDeleteFirestoreRecordByRefs(db, collectionName, refs = {}) {
  const deleted = [];
  const seen = new Set();
  async function delDoc(id, why) {
    const safeId = azExpressDeleteLogSafeText(id || "", 180);
    if (!safeId || seen.has(safeId)) return;
    seen.add(safeId);
    const ref = db.collection(collectionName).doc(safeId);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      deleted.push({ collection:collectionName, docId:safeId, via:why || "docId" });
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
      console.warn("Express payment log delete query skipped:", collectionName, field, err && (err.message || err));
    }
  }
  return deleted;
}
function azExpressDeleteLocalPremiumOrderByRefs(refs = {}) {
  let deleted = 0;
  const orders = readPremiumOrders() || [];
  const needles = [refs.docId, refs.orderId, refs.billCode, refs.paymentReference].map(v => String(v || "").trim()).filter(Boolean);
  if (!needles.length) return 0;
  const next = orders.filter(o => {
    const vals = [o.docId, o.id, o.orderId, o.billCode, o.billcode, o.paymentReference, o.transactionId, o.txnId].map(v => String(v || "").trim()).filter(Boolean);
    const match = needles.some(n => vals.includes(n));
    if (match) deleted++;
    return !match;
  });
  if (deleted) writePremiumOrders(next);
  return deleted;
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
      let paid = upsertPremiumOrder({
        ...order,
        status: "paid",
        paymentMethod: "toyyibpay",
        paymentReference: tx.billpaymentInvoiceNo || tx.transaction_id || tx.refno || order.paymentReference || "",
        toyyibTransaction: tx,
        paidAt: new Date().toISOString()
      });
      if (Array.isArray(paid.paBmItems) && paid.paBmItems.length) {
        paid = await azobssPersistJupemOrder(paid);
        await azobssSyncJupemPurchaseLogs(paid, "paid", {
          paymentReference: paid.paymentReference,
          paidAtMs: Date.now(),
          toyyibTransaction: tx
        });
      }
      paid = await azSubEnsurePaidOrderCode(paid);
      const withDownload = makePremiumDownloadForOrder(paid);
      await azFinalizeCommissionForOrder(withDownload);
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
  if (isPublicPaPremiumOrder(order)) {
    return { ok:true, paid:true, publicPa:true, paBm:true, orderId:order.orderId, status:order.status, amountSen:Number(order.amountSen || 3000), unit:1, downloadUrl:publicPaDownloadUrl(order, req), receiptUrl:`${base}/api/premium/receipt/${encodeURIComponent(order.orderId)}`, emailSent:!!order.emailSentAt, emailError:order.emailError || null };
  }
  const withToken = makePremiumDownloadForOrder(order);
  return {
    ok: true,
    paid: true,
    orderId: withToken.orderId,
    status: withToken.status,
    downloadUrl: `${base}/api/premium/download/${encodeURIComponent(withToken.downloadToken)}`,
    receiptUrl: `${base}/api/premium/receipt/${encodeURIComponent(withToken.orderId)}`,
    expiresAt: withToken.tokenExpiresAt,
    maxDownload: withToken.maxDownload,
    activationCode: withToken.activationCode || "",
    activationCodeStatus: withToken.activationCodeStatus || "",
    activationCodeExpiresAt: withToken.activationCodeExpiresAt || "",
    subscriptionPlanLabel: withToken.subscriptionPlanLabel || withToken.subscriptionPlan?.label || "",
    subscriptionVerifyApi: "https://azobss-backend.onrender.com/api/subscription/verify"
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

function cleanShareUsername(value, max = 40) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, max);
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

function getReferralFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-referrals", `${key}.json`);
}

function getProductReferralFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-product-referrals", `${key}.json`);
}

function getAbuseFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-abuse-logs", `${key}.json`);
}

function logLuckyDrawAbuse(key, type, details = {}) {
  try {
    const file = getAbuseFile(key);
    const rows = readJson(file, []);
    rows.push({
      id: `${key}_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      monthKey: key,
      type: cleanText(type, 80),
      ref: cleanShareUsername(details.ref),
      usernameKey: cleanShareUsername(details.usernameKey),
      visitorUsernameKey: cleanShareUsername(details.visitorUsernameKey),
      reason: cleanText(details.reason, 180),
      deviceFingerprint: cleanText(details.deviceFingerprint, 160),
      ipAddress: cleanText(details.ipAddress, 80),
      userAgent: cleanText(details.userAgent, 300),
      createdAtMs: Date.now(),
      createdAt: new Date().toISOString(),
      deleted: false
    });
    writeJson(file, rows.slice(-1000));
  } catch (err) {
    console.warn("Lucky Draw abuse log failed:", err && err.message ? err.message : err);
  }
}

function buildLuckyDrawAbuseAudit(key = monthKey()) {
  const rows = readJson(getAbuseFile(key), []).filter((r) => !r.deleted && r.monthKey === key);
  const byType = {};
  for (const row of rows) byType[row.type] = (byType[row.type] || 0) + 1;
  return {
    monthKey: key,
    summary: { total: rows.length, byType },
    logs: rows
      .slice()
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      .map((r) => ({
        id: r.id || "",
        monthKey: key,
        type: r.type || "",
        ref: r.ref || "",
        usernameKey: r.usernameKey || "",
        visitorUsernameKey: r.visitorUsernameKey || "",
        reason: r.reason || "",
        createdAt: r.createdAt || "",
        deviceFingerprint: maskAuditText(r.deviceFingerprint, 14),
        ipAddress: maskAuditText(r.ipAddress, 9),
        userAgent: maskAuditText(r.userAgent, 80)
      }))
  };
}

function countValidReferralClicks(key, ref) {
  const cleanRef = cleanShareUsername(ref);
  if (!cleanRef) return 0;
  const clicks = readJson(getReferralFile(key), []);
  return clicks.filter((c) => !c.deleted && c.ref === cleanRef).length;
}

function countValidProductShareClicks(key, ref) {
  const cleanRef = cleanShareUsername(ref);
  if (!cleanRef) return 0;
  const clicks = readJson(getProductReferralFile(key), []);
  return clicks.filter((c) => !c.deleted && c.ref === cleanRef).length;
}


function maskAuditText(value, keep = 8) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= keep) return text;
  return `${text.slice(0, keep)}…`;
}

function buildReferralAudit(key = monthKey()) {
  const clicks = readJson(getReferralFile(key), []);
  const active = clicks.filter((c) => !c.deleted && c.monthKey === key);
  const seenDevice = new Map();
  const seenIp = new Map();
  let validClicks = 0;
  let selfClicks = 0;
  let duplicateClicks = 0;
  const uniqueSharers = new Set();

  const rows = active
    .slice()
    .sort((a, b) => Number(b.clickedAtMs || 0) - Number(a.clickedAtMs || 0))
    .map((c) => {
      const ref = cleanShareUsername(c.ref);
      const visitorUsernameKey = cleanShareUsername(c.visitorUsernameKey);
      let reason = "VALID_CLICK";
      let valid = true;
      let duplicate = false;

      if (visitorUsernameKey && visitorUsernameKey === ref) {
        valid = false;
        reason = "SELF_CLICK";
        selfClicks += 1;
      }

      const deviceKey = c.deviceFingerprint ? `${ref}|${c.deviceFingerprint}` : "";
      const ipKey = c.ipAddress ? `${ref}|${c.ipAddress}` : "";
      if (valid && ((deviceKey && seenDevice.has(deviceKey)) || (ipKey && seenIp.has(ipKey)))) {
        valid = false;
        duplicate = true;
        reason = "DUPLICATE_DEVICE_OR_IP";
        duplicateClicks += 1;
      }

      if (valid) {
        validClicks += 1;
        if (ref) uniqueSharers.add(ref);
      }
      if (deviceKey && !seenDevice.has(deviceKey)) seenDevice.set(deviceKey, c.id || c.clickedAtMs || true);
      if (ipKey && !seenIp.has(ipKey)) seenIp.set(ipKey, c.id || c.clickedAtMs || true);

      return {
        id: c.id || "",
        monthKey: key,
        ref,
        visitorUsernameKey,
        valid,
        duplicate,
        reason,
        clickedAtMs: Number(c.clickedAtMs || c.clickedAtMs === 0 ? c.clickedAtMs : c.clickedAtMs || 0) || Number(c.clickedAtMs || 0),
        clickedAt: c.clickedAt || "",
        deviceFingerprint: maskAuditText(c.deviceFingerprint, 14),
        ipAddress: maskAuditText(c.ipAddress, 9),
        userAgent: maskAuditText(c.userAgent, 80)
      };
    });

  return {
    monthKey: key,
    summary: {
      totalRecords: active.length,
      validClicks,
      uniqueSharers: uniqueSharers.size,
      selfClicks,
      duplicateClicks
    },
    clicks: rows
  };
}

function getWinnerFile(key = monthKey()) {
  return path.join(DATA_DIR, "lucky-draw-winners", `${key}.json`);
}

function listWinnerHistory() {
  const dir = path.join(DATA_DIR, "lucky-draw-winners");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}\.json$/.test(name))
    .map((name) => {
      const key = name.replace(/\.json$/, "");
      const winner = readJson(path.join(dir, name), null);
      if (!winner) return null;
      const entries = readJson(getEntriesFile(key), []);
      const participantTotal = entries.filter((e) => !e.deleted && e.monthKey === key).length;
      return {
        monthKey: key,
        monthName: winner.monthName || monthName(key),
        usernameKey: winner.usernameKey || "",
        name: winner.name || winner.usernameKey || "Winner",
        phone: winner.phone || "",
        contactEmail: winner.contactEmail || "",
        selectedAtMs: winner.selectedAtMs || 0,
        selectedAt: winner.selectedAt || "",
        selectedBy: winner.selectedBy || "admin",
        participantTotal: Number(winner.participantTotal || participantTotal || 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
}

const ADMIN_KEY_PLACEHOLDERS = new Set(["", "change-this-admin-key", "optional-no-password-mode", "optional", "admin", "password", "123456", "changeme"]);

function hasConfiguredAdminKey() {
  return !!ADMIN_KEY && !ADMIN_KEY_PLACEHOLDERS.has(String(ADMIN_KEY || "").trim().toLowerCase());
}

function getAdminRequestKey(req) {
  const auth = String(req.header("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return String(
    req.header("x-admin-key") ||
    req.header("x-azobss-api-key") ||
    req.header("x-api-key") ||
    auth ||
    req.query.adminKey ||
    req.query.key ||
    req.query.secret ||
    ""
  ).trim();
}

function safeAdminKeyEqual(inputKey, expectedKey) {
  const a = String(inputKey || "");
  const b = String(expectedKey || "");
  if (!a || !b) return false;
  try {
    const ah = crypto.createHash("sha256").update(a).digest();
    const bh = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(ah, bh);
  } catch (_) {
    return a === b;
  }
}

function isAdmin(req) {
  return hasConfiguredAdminKey() && safeAdminKeyEqual(getAdminRequestKey(req), ADMIN_KEY);
}

function getFirebaseBearerToken(req) {
  const auth = String(req.header("authorization") || "");
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return token && token !== getAdminRequestKey(req) ? token : token;
}

function azBackendTrustedAdminIdentity(identity = {}) {
  const authEmail = String(identity.authEmail || identity.email || "").trim().toLowerCase();
  const profileEmail = String(identity.profileEmail || "").trim().toLowerCase();
  const uid = String(identity.uid || "").trim();
  if (authEmail && ADMIN_ALLOWED_EMAILS.has(authEmail)) return true;
  if (profileEmail && ADMIN_ALLOWED_EMAILS.has(profileEmail) && authEmail && ADMIN_ALLOWED_EMAILS.has(authEmail)) return true;
  if (uid && ADMIN_ALLOWED_UIDS.has(uid)) return true;
  return false;
}

async function getFirebaseAdminIdentity(req) {
  try {
    const token = getFirebaseBearerToken(req);
    if (!token) return null;
    const db = getAzobssBackendDb();
    if (!admin.apps.length || !admin.auth) return null;
    const decoded = await admin.auth().verifyIdToken(token);
    const authEmail = String(decoded.email || "").toLowerCase();
    const identity = {
      uid: String(decoded.uid || ""),
      email: authEmail,
      authEmail,
      profileEmail: "",
      username: "",
      role: "",
      authMethod: "firebase-admin-token"
    };
    if (db && identity.uid) {
      try {
        const qs = await db.collection("users").where("uid", "==", identity.uid).limit(1).get();
        qs.forEach((doc) => {
          const x = doc.data() || {};
          identity.username = String(x.usernameKey || x.username || doc.id || "").toLowerCase();
          identity.role = String(x.role || "").toLowerCase();
          identity.profileEmail = String(x.email || x.authEmail || "").toLowerCase();
          identity.email = identity.authEmail || identity.profileEmail || identity.email;
          identity.userDocId = String(doc.id || identity.username || identity.uid || "");
          identity.adminPriceAdjustmentOverride = x.adminPriceAdjustmentOverride === true;
          identity.adminPriceAdjustmentPercent = azobssNormalizeUserPriceAdjustment(x.adminPriceAdjustmentPercent ?? x.priceAdjustmentPercent ?? 0);
          identity.priceAdjustmentPercent = azobssNormalizeUserPriceAdjustment(x.priceAdjustmentPercent ?? x.adminPriceAdjustmentPercent ?? 0);
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
        console.warn("AZOBSS admin profile lookup skipped:", err && (err.message || err));
      }
    }
    return identity;
  } catch (err) {
    console.warn("AZOBSS Firebase admin token rejected:", err && (err.message || err));
    return null;
  }
}

async function requireAdmin(req, res, next) {
  if (isAdmin(req)) {
    req.azobssAdminIdentity = { uid: "api-secret", username: "api-secret", role: "admin", isAdmin: true, authMethod: "api-secret" };
    return next();
  }

  const identity = await getFirebaseAdminIdentity(req);
  if (identity && azBackendTrustedAdminIdentity(identity)) {
    req.azobssAdminIdentity = Object.assign({}, identity, { role: "admin", isAdmin: true });
    return next();
  }

  return res.status(403).json({
    ok: false,
    error: "admin_authorization_required",
    message: "Admin authorization required. Login as zedan91/admin account. Browser ADMIN_KEY is optional fallback only."
  });
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


async function uploadLuckyPrizeImagePersistent(file) {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
  if (!file || !cloudName || !uploadPreset) return null;
  try {
    const buffer = fs.readFileSync(file.path);
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: file.mimetype || "image/jpeg" }), file.originalname || file.filename || "lucky-draw-prize.jpg");
    form.append("upload_preset", uploadPreset);
    form.append("folder", process.env.CLOUDINARY_FOLDER || "azobss/lucky-draw");
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    const response = await fetch(endpoint, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.secure_url) throw new Error(data.error?.message || "Cloudinary upload failed");
    return data.secure_url;
  } catch (err) {
    console.warn("AZOBSS Cloudinary prize upload failed:", err.message || err);
    return null;
  }
}


async function uploadLuckyPrizeRemoteUrlPersistent(remoteUrl, fallbackName) {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadPreset = String(process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
  if (!remoteUrl || !cloudName || !uploadPreset) return null;
  try {
    const response = await fetch(remoteUrl, { method: "GET" });
    if (!response.ok) throw new Error(`Fetch image failed: ${response.status}`);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!/^image\//i.test(contentType)) throw new Error("Remote file is not an image");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("Remote image is empty");
    const form = new FormData();
    const urlName = (() => {
      try { return path.basename(new URL(remoteUrl).pathname) || fallbackName || "lucky-draw-prize.jpg"; }
      catch(e) { return fallbackName || "lucky-draw-prize.jpg"; }
    })();
    form.append("file", new Blob([buffer], { type: contentType }), urlName);
    form.append("upload_preset", uploadPreset);
    form.append("folder", process.env.CLOUDINARY_FOLDER || "azobss/lucky-draw");
    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
    const uploadRes = await fetch(endpoint, { method: "POST", body: form });
    const data = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !data.secure_url) throw new Error(data.error?.message || "Cloudinary remote upload failed");
    return data.secure_url;
  } catch (err) {
    console.warn("AZOBSS Cloudinary remote prize upload failed:", err.message || err);
    return null;
  }
}

function resolvePublicUrl(baseUrl, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { return new URL(raw, baseUrl).toString(); } catch(e) { return ""; }
}

function resolveLuckyDrawPublicImageUrl(baseUrl, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:image/")) return raw;
  if (raw.startsWith("/")) return resolvePublicUrl(baseUrl, raw);
  // Prize JSON is stored in /lucky-draw/giveaway-prize.json, so relative image names
  // such as hadiah1.jpg must resolve to /lucky-draw/hadiah1.jpg, not /hadiah1.jpg.
  return resolvePublicUrl(baseUrl, "/lucky-draw/" + raw.replace(/^\/+/, ""));
}

function uniqueList(list) {
  const out = [];
  const seen = new Set();
  for (const item of list || []) {
    const v = String(item || "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

async function imageUrlExists(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") || "";
    return /^image\//i.test(type);
  } catch(e) { return false; }
}
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





app.post("/api/admin/payment-logs/delete", requireAdmin, async (req, res) => {
  try {
    const db = getAzobssBackendDb();
    if (!db) return res.status(500).json({ ok:false, error:"Firebase Admin is not configured.", patch:"424", runningFile:"backend/server.js" });
    const rows = Array.isArray(req.body?.records) ? req.body.records.slice(0, 200) : [];
    if (!rows.length) return res.status(400).json({ ok:false, error:"No records selected.", patch:"424", runningFile:"backend/server.js" });

    const result = { ok:true, patch:"424", runningFile:"backend/server.js", requested:rows.length, deleted:0, details:[], errors:[] };
    for (const row of rows) {
      const refs = azExpressDeleteLogRefs(row);
      try {
        let deletedDetails = [];
        if (refs.collection === "premiumOrders") {
          deletedDetails = deletedDetails.concat(await azExpressDeleteFirestoreRecordByRefs(db, "premiumOrders", refs));
          const localDeleted = azExpressDeleteLocalPremiumOrderByRefs(refs);
          if (localDeleted) deletedDetails.push({ collection:"premium-orders.json", count:localDeleted, via:"local-json" });
        } else {
          deletedDetails = deletedDetails.concat(await azExpressDeleteFirestoreRecordByRefs(db, "purchaseLogs", refs));
        }
        if (!deletedDetails.length) result.errors.push({ refs, error:"Record not found or already deleted." });
        else {
          result.deleted += deletedDetails.reduce((sum, d) => sum + (Number(d.count || 0) || 1), 0);
          result.details.push({ refs, deleted:deletedDetails });
        }
      } catch (err) {
        result.errors.push({ refs, error:err && err.message ? err.message : String(err) });
      }
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err), patch:"424", runningFile:"backend/server.js" });
  }
});


app.get("/api/pa-bm-checkout-capabilities", (req, res) => {
  res.json({
    ok: true,
    version: 4,
    runningFile: "backend/server.js",
    perUserPriceCategories: ["paBm","lotKadaster","publicPa","software","cadTools"],
    productTypes: Array.from(AZOBSS_JUPEM_PRODUCT_TYPES),
    prices: { PA: 5, BM: 3, SBM: 3, GPS: 9, NDCDB_FULL_SHEET: 50, NDCDB_QUARTER_SHEET: 15, NDCDB_C3_FULL_SHEET: 50, NDCDB_C3_QUARTER_SHEET: 15, SYIT_PIAWAI: 7 },
    adminTestPayment: true,
    publicPaAdminTestPayment: true,
    publicPaAdminTestPaymentPatch: "516"
  });
});

app.post("/api/admin/test-pa-bm-payment", requireAdmin, async (req, res) => {
  try {
    const checkout = azobssBuildJupemCheckout(req.body || {}, req.azobssAdminIdentity || {});
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const orderId = makePremiumId("pabmtest");
    const paymentReference = `ADMIN-TEST-${nowMs}`;
    let order = await azobssPersistJupemOrder({
      orderId,
      productId: "pa-bm-purchase-records",
      productName: `JUPEM Document Test Purchase (${checkout.items.length} unit)`,
      amount: `RM${checkout.totalAmount}`,
      amountSen: checkout.amountSen,
      status: "paid",
      paymentMethod: "admin-test",
      paymentReference,
      user: checkout.user,
      usernameKey: checkout.user.username,
      paBmItems: checkout.items,
      maxDownload: 0,
      expiryHours: 0,
      isAdminTestPayment: true,
      source: "admin-test-payment",
      createdByAdmin: req.azobssAdminIdentity?.username || req.azobssAdminIdentity?.email || req.azobssAdminIdentity?.uid || "admin",
      createdAt: nowIso,
      createdAtMs: nowMs,
      paidAt: nowIso,
      paidAtMs: nowMs,
      paymentVerifiedAt: nowIso,
      paymentVerificationSource: "admin-test-endpoint",
      commissionSkippedReason: "admin-test-payment",
      emailSkippedForPaBm: true
    });
    const sync = await azobssSyncJupemPurchaseLogs(order, "paid", { paymentReference, paidAtMs: nowMs, nowMs });
    order = await azobssPersistJupemOrder({ ...order, paBmPaidSyncedAt: nowIso, paBmPaidSyncedCount: Number(sync.updated || 0) });
    return res.json({
      ok: true,
      success: true,
      paid: true,
      status: "paid",
      testPayment: true,
      orderId,
      paymentReference,
      amount: checkout.totalAmount,
      amountSen: checkout.amountSen,
      unit: checkout.items.length,
      updatedCount: Number(sync.updated || 0)
    });
  } catch (error) {
    const statusCode = Math.max(400, Math.min(500, Number(error?.statusCode || 500)));
    console.error("Admin JUPEM test payment failed:", error && (error.stack || error.message || error));
    return res.status(statusCode).json({ ok: false, success: false, error: error.message || "Admin test payment failed." });
  }
});

app.post("/api/admin/test-public-pa-payment", requireAdmin, async (req, res) => {
  try {
    const data = req.body || {};
    const paNumber = String(data.paNumber || data.noPA || data.pa || '').replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'').slice(0,12);
    const negeri = cleanPaState(data.negeri || data.state || '');
    if (!/^\d{1,12}$/.test(paNumber)) return res.status(400).json({ok:false,error:"Masukkan nombor PA yang sah."});
    if (!AZOBSS_JUPEM_STATES.has(negeri)) return res.status(400).json({ok:false,error:"Pilih negeri yang sah."});

    const fileName = `PA${paNumber}.TIF`;
    const candidates = [
      `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`,
      `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPA=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`
    ];
    let exists = false;
    for (const u of candidates) {
      const r = await fetchJupemFile(u);
      if (!r.ok) continue;
      const b = Buffer.from(await r.arrayBuffer());
      const t = b.slice(0,160).toString('utf8').toLowerCase();
      if (b.length > 100 && !t.includes('<html')) { exists = true; break; }
    }
    if (!exists) return res.status(404).json({ok:false,error:`PA ${paNumber} tidak ditemui untuk negeri yang dipilih.`});

    const identity = req.azobssAdminIdentity || {};
    const submitted = getPremiumUser(data);
    const buyerName = cleanPremiumText(data.buyerName || data.name || identity.username || submitted.username || 'Admin Test',80);
    const buyerEmail = cleanPremiumText(data.buyerEmail || data.email || identity.authEmail || identity.email || submitted.email || '',180).toLowerCase();
    const buyerPhone = cleanPremiumText(data.buyerPhone || data.phone || submitted.phone || '',30).replace(/[^0-9+]/g,'');
    if (buyerName.length < 2) return res.status(400).json({ok:false,error:"Masukkan nama pembeli."});
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail) || /@azobss\.local$/i.test(buyerEmail)) return res.status(400).json({ok:false,error:"Masukkan alamat e-mel sebenar yang sah."});
    if (buyerPhone.replace(/\D/g,'').length < 8) return res.status(400).json({ok:false,error:"Masukkan nombor telefon yang sah."});

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const orderId = makePremiumId('publicpatest');
    const recordId = `${orderId}-1`;
    const paymentReference = `ADMIN-PUBLIC-PA-TEST-${nowMs}`;
    const apiBase = publicBaseUrl(req);
    const user = {
      uid:cleanPremiumText(identity.uid || 'admin-test',120),
      username:cleanPremiumText(identity.username || submitted.username || 'admin',80).toLowerCase(),
      usernameKey:cleanPremiumText(identity.username || submitted.username || 'admin',80).toLowerCase(),
      email:buyerEmail,
      authEmail:identity.authEmail || identity.email || '',
      phone:buyerPhone,
      displayName:buyerName
    };
    const item = {id:recordId,firestoreId:recordId,productType:'PA',itemCode:paNumber,negeri,amount:30,filename:`PA${paNumber}.pdf`,downloadUrl:`${apiBase}/api/pa-pdf?noPA=PA${paNumber}.TIF&negeri=${encodeURIComponent(negeri)}`,createdAtMs:nowMs,publicPaPurchase:true};
    let order = await azobssPersistJupemOrder({
      orderId,productId:'public-pa-rm30',productName:`Pelan Akui PA${paNumber}`,amount:'RM30',amountSen:3000,saleAmount:30,saleAmountText:'RM30.00',
      status:'paid',paymentMethod:'admin-test',paymentReference,billCode:'',paymentUrl:'',returnUrl:'',user,email:buyerEmail,buyerEmail,phone:buyerPhone,
      paBmItems:[item],publicPaPurchase:true,publicPaRecordId:recordId,publicPaPriceRm:30,source:'admin-test-public-pa',maxDownload:5,maxDownloads:5,expiryHours:168,
      isAdminTestPayment:true,testPayment:true,createdByAdmin:identity.username || identity.email || identity.uid || 'admin',
      createdAt:nowIso,createdAtMs:nowMs,paidAt:nowIso,paidAtMs:nowMs,paidFinalizedAt:nowIso,paymentVerifiedAt:nowIso,paymentVerificationSource:'admin-test-endpoint',
      commissionCheckedAt:nowIso,commissionSkippedReason:'admin-test-payment',emailSkippedForPaBm:true,publicPaEmailSkipped:true
    });
    const sync = await azobssSyncJupemPurchaseLogs(order,'paid',{paymentReference,paidAtMs:nowMs,nowMs});
    order = await azobssPersistJupemOrder({...order,paBmPaidSyncedAt:nowIso,paBmPaidSyncedCount:Number(sync.updated || 0)});
    return res.json({
      ok:true,success:true,paid:true,status:'paid',testPayment:true,publicPa:true,paBm:true,routeVersion:'559',orderId,recordId,paymentReference,
      amount:30,amountSen:3000,unit:1,updatedCount:Number(sync.updated || 0),downloadUrl:publicPaDownloadUrl(order,req),
      receiptUrl:`${apiBase}/api/premium/receipt/${encodeURIComponent(orderId)}`,emailSent:false,commissionCreated:false
    });
  } catch (error) {
    const statusCode = Math.max(400, Math.min(500, Number(error?.statusCode || 500)));
    console.error("Admin public PA test payment failed:", error && (error.stack || error.message || error));
    return res.status(statusCode).json({ok:false,success:false,error:error.message || "Admin public PA test payment failed."});
  }
});

app.post("/api/toyyib/create-public-pa-bill", async (req, res) => {
  try {
    if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) return res.status(500).json({ok:false,error:"ToyyibPay env belum lengkap."});
    const data = req.body || {};
    const paNumber = String(data.paNumber || data.noPA || data.pa || '').replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'').slice(0,12);
    const negeri = cleanPaState(data.negeri || data.state || '');
    if (!/^\d{1,12}$/.test(paNumber)) return res.status(400).json({ok:false,error:"Masukkan nombor PA yang sah."});
    if (!AZOBSS_JUPEM_STATES.has(negeri)) return res.status(400).json({ok:false,error:"Pilih negeri yang sah."});
    const fileName = `PA${paNumber}.TIF`;
    const candidates = [`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`,`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPA=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`];
    let exists = false;
    for (const u of candidates) { const r = await fetchJupemFile(u); if (!r.ok) continue; const b=Buffer.from(await r.arrayBuffer()); const t=b.slice(0,160).toString('utf8').toLowerCase(); if(b.length>100&&!t.includes('<html')){exists=true;break;} }
    if (!exists) return res.status(404).json({ok:false,error:`PA ${paNumber} tidak ditemui untuk negeri yang dipilih.`});
    let identity = null; try { identity = await getFirebaseAdminIdentity(req); } catch (_) {}
    const submitted = getPremiumUser(data);
    const buyerName = cleanPremiumText(data.buyerName || data.name || identity?.username || submitted.username || 'Guest',80);
    const buyerEmail = cleanPremiumText(identity?.authEmail || identity?.email || data.buyerEmail || data.email || submitted.email || '',180).toLowerCase();
    const buyerPhone = cleanPremiumText(data.buyerPhone || data.phone || submitted.phone || '',30).replace(/[^0-9+]/g,'');
    if (buyerName.length<2) return res.status(400).json({ok:false,error:"Masukkan nama pembeli."});
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)||/@azobss\.local$/i.test(buyerEmail)) return res.status(400).json({ok:false,error:"Masukkan alamat e-mel sebenar yang sah."});
    if (buyerPhone.replace(/\D/g,'').length<8) return res.status(400).json({ok:false,error:"Masukkan nombor telefon yang sah."});
    const emailHash=crypto.createHash('sha256').update(buyerEmail).digest('hex').slice(0,18);
    const baseAmount=30;
    const priceAdjustmentPercent=identity ? azobssIdentityPriceAdjustment(identity, "publicPa") : 0;
    const amount=identity ? azobssApplyUserPriceAdjustment(baseAmount,identity,"publicPa") : baseAmount;
    const amountSen=Math.round(amount*100);
    const orderId=makePremiumId('publicpa'); const recordId=`${orderId}-1`; const apiBase=publicBaseUrl(req);
    const returnUrl=`${frontendBaseUrl(req)}/Beli-Pelan-Akui/?payment=return&orderId=${encodeURIComponent(orderId)}`; const callbackUrl=TOYYIB_CALLBACK_URL||`${apiBase}/api/toyyib-callback`;
    const user={uid:cleanPremiumText(identity?.uid||`guest_${emailHash}`,120),username:cleanPremiumText(identity?.username||submitted.username||`publicpa_${emailHash}`,80).toLowerCase(),email:buyerEmail,authEmail:identity?.authEmail||'',phone:buyerPhone,displayName:buyerName};
    const item={id:recordId,firestoreId:recordId,productType:'PA',itemCode:paNumber,negeri,baseAmount,amount,priceAdjustmentPercent,filename:`PA${paNumber}.pdf`,downloadUrl:`${apiBase}/api/pa-pdf?noPA=PA${paNumber}.TIF&negeri=${encodeURIComponent(negeri)}`,createdAtMs:Date.now(),publicPaPurchase:true};
    const billPayload={userSecretKey:TOYYIB_SECRET_KEY,categoryCode:TOYYIB_CATEGORY_CODE,billName:toyyibClean(`Pelan Akui PA${paNumber}`,30),billDescription:toyyibClean(`AZOBSS Public Pelan Akui PA${paNumber} - ${azobssMoneyText(amount)}`,100),billPriceSetting:1,billPayorInfo:1,billAmount:amountSen,billReturnUrl:returnUrl,billCallbackUrl:callbackUrl,billExternalReferenceNo:orderId,billTo:toyyibClean(buyerName,30),billEmail:toyyibClean(buyerEmail,80),billPhone:toyyibClean(buyerPhone,20),billSplitPayment:0,billSplitPaymentArgs:'',billPaymentChannel:0,billContentEmail:`Pembelian Pelan Akui PA${paNumber} ${azobssMoneyText(amount)}.`,billChargeToCustomer:1,billExpiryDays:3,enableDuitNowQR:1,chargeDuitNowQR:0};
    const apiResult=await toyyibPost('createBill',billPayload); const billCode=Array.isArray(apiResult)?(apiResult[0]?.BillCode||apiResult[0]?.billCode):(apiResult?.BillCode||apiResult?.billCode); if(!billCode)return res.status(502).json({ok:false,error:"ToyyibPay tidak return BillCode.",raw:apiResult});
    const paymentUrl=`${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
    const order=await azobssPersistJupemOrder({orderId,productId:'public-pa-rm30',productName:`Pelan Akui PA${paNumber}`,amount:azobssMoneyText(amount),amountSen,baseAmount,baseAmountSen:3000,saleAmount:amount,saleAmountText:azobssMoneyText(amount),priceAdjustmentPercent,status:'pending',paymentMethod:'toyyibpay',paymentReference:'',billCode,paymentUrl,returnUrl,user,email:buyerEmail,buyerEmail,paBmItems:[item],publicPaPurchase:true,publicPaRecordId:recordId,publicPaPriceRm:amount,source:'public-pa-rm30',maxDownload:5,maxDownloads:5,expiryHours:168,createdAt:new Date().toISOString(),createdAtMs:Date.now(),commissionSkippedReason:'public-pa-service'});
    await azobssSyncJupemPurchaseLogs(order,'pending');
    return res.json({ok:true,success:true,orderId,billCode,paymentUrl,url:paymentUrl,redirectUrl:paymentUrl,status:'pending',amount,amountSen,unit:1,productId:'public-pa-rm30'});
  } catch (err) { console.error('Create public PA bill failed:',err); return res.status(500).json({ok:false,error:err.message||'Failed create public PA bill'}); }
});

app.post("/api/toyyib/create-pa-bm-bill", async (req, res) => {
  try {
    const identity = await getFirebaseAdminIdentity(req);
    if (!identity || !identity.uid) {
      return res.status(401).json({ ok:false, success:false, error:"Please login again before proceeding to payment." });
    }
    if (!TOYYIB_SECRET_KEY || !TOYYIB_CATEGORY_CODE) {
      return res.status(500).json({ ok:false, error:"ToyyibPay env belum diset. Set TOYYIB_SECRET_KEY dan TOYYIB_CATEGORY_CODE di Render." });
    }
    const data = req.body || {};
    const checkout = azobssBuildJupemCheckout(data, identity);
    const { user, items, totalAmount, amountSen } = checkout;
    const usernameKey = user.username;
    const orderId = makePremiumId("pabm");
    const apiBase = publicBaseUrl(req);
    const returnUrl = TOYYIB_RETURN_URL || `${frontendBaseUrl(req)}/PA-BM/?payment=return&orderId=${encodeURIComponent(orderId)}`;
    const callbackUrl = TOYYIB_CALLBACK_URL || `${apiBase}/api/toyyib-callback`;
    const billPayload = {
      userSecretKey: TOYYIB_SECRET_KEY,
      categoryCode: TOYYIB_CATEGORY_CODE,
      billName: toyyibClean("AZOBSS JUPEM", 30),
      billDescription: toyyibClean(`AZOBSS JUPEM Payment - ${items.length} unit - RM${totalAmount}`, 100),
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
      billContentEmail: `Thank you for your AZOBSS JUPEM document payment. Total: RM${totalAmount}.`,
      billChargeToCustomer: 1,
      billExpiryDays: 3,
      enableDuitNowQR: 1,
      chargeDuitNowQR: 0
    };
    const apiResult = await toyyibPost("createBill", billPayload);
    const billCode = Array.isArray(apiResult) ? (apiResult[0]?.BillCode || apiResult[0]?.billCode) : apiResult?.BillCode;
    if (!billCode) return res.status(502).json({ ok:false, error:"ToyyibPay tidak return BillCode.", raw: apiResult });
    const paymentUrl = `${TOYYIB_BASE_URL}/${encodeURIComponent(billCode)}`;
    const order = await azobssPersistJupemOrder({ orderId, productId:"pa-bm-purchase-records", productName:`JUPEM Document Purchase (${items.length} unit)`, amount:azobssMoneyText(totalAmount), amountSen, baseAmount:checkout.baseTotalAmount, baseAmountSen:Math.round(Number(checkout.baseTotalAmount||0)*100), saleAmount:totalAmount, saleAmountText:azobssMoneyText(totalAmount), priceAdjustmentPercent:checkout.priceAdjustmentPercent, priceAdjustmentByCategory:checkout.priceAdjustmentByCategory, status:"pending", paymentMethod:"toyyibpay", paymentReference:"", billCode, paymentUrl, user:{...user, username: usernameKey || user.username}, paBmItems:items, maxDownload:0, expiryHours:0, createdAt:new Date().toISOString(), createdAtMs:Date.now() });
    await azobssSyncJupemPurchaseLogs(order, "pending");
    res.json({ ok:true, orderId, billCode, paymentUrl, status:"pending", amount:totalAmount, amountSen, baseAmount:checkout.baseTotalAmount, baseAmountSen:Math.round(Number(checkout.baseTotalAmount||0)*100), priceAdjustmentPercent:checkout.priceAdjustmentPercent, priceAdjustmentByCategory:checkout.priceAdjustmentByCategory, unit:items.length });
  } catch (err) {
    const statusCode = Math.max(400, Math.min(500, Number(err?.statusCode || 500)));
    res.status(statusCode).json({ ok:false, error: err.message || "Failed to create JUPEM ToyyibPay bill" });
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
    const productId = cleanPremiumText(product.productId || product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
    const identity = await getFirebaseAdminIdentity(req);
    const submittedAmountText = cleanPremiumText(product.basePrice || data.basePrice || product.price || data.amount || data.price || "RM0", 40);
    const baseAmountSen = toyyibAmountSen(submittedAmountText);
    const baseAmount = baseAmountSen / 100;
    const priceAdjustmentCategory = await azobssResolvePremiumPriceCategory(data, product, productId);
    const priceAdjustmentPercent = identity ? azobssIdentityPriceAdjustment(identity, priceAdjustmentCategory) : 0;
    const adjustedAmount = identity ? azobssApplyUserPriceAdjustment(baseAmount, identity, priceAdjustmentCategory) : baseAmount;
    const amountSen = Math.round(adjustedAmount * 100);
    const amountText = azobssMoneyText(adjustedAmount);
    const downloadLink = cleanPremiumUrl(product.secureDownloadLink || product.downloadLink || data.downloadLink);
    const submittedUser = getPremiumUser(data);
    const user = identity ? { ...submittedUser, uid:identity.uid || submittedUser.uid, username:identity.username || submittedUser.username, email:identity.authEmail || identity.email || submittedUser.email } : submittedUser;
    const requestedLimit = 1; // auto-expire after first download
    const requestedExpiryHours = Math.max(0, Math.min(24 * 30, Number(product.expiryHours ?? data.expiryHours ?? 24)));
    if (!productName || !amountSen) return res.status(400).json({ ok:false, error:"Missing product name or valid amount." });
    if (!downloadLink && !azSubIsSaleProduct(product, data)) return res.status(400).json({ ok:false, error:"Premium download link belum diset untuk produk ini." });

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
      baseAmount,
      baseAmountSen,
      saleAmount: adjustedAmount,
      saleAmountText: amountText,
      priceAdjustmentPercent,
      priceAdjustmentCategory,
      status: "pending",
      paymentMethod: "toyyibpay",
      paymentReference: "",
      billCode,
      paymentUrl,
      user,
      product: { ...product, id: productId, name: productName, basePrice: submittedAmountText, price: amountText, priceAdjustmentPercent, priceAdjustmentCategory },
      ...(azSubIsSaleProduct(product, data) ? azSubPatchFromProduct(product, data) : {}),
      staffReferral: azReferralFrom(data, product, { productId, returnUrl: data.returnUrl || '' }),
      shareReferral: azReferralFrom(data, product, { productId, returnUrl: data.returnUrl || '' }),
      productOwner: azProductOwnerFrom(product, { productId }),
      returnUrl: cleanPremiumUrl(data.returnUrl || data.pageUrl || ''),
      downloadLink,
      maxDownload: requestedLimit,
      expiryHours: requestedExpiryHours,
      createdAt: new Date(now).toISOString()
    };
    upsertPremiumOrder(order);
    res.json({ ok:true, orderId, billCode, paymentUrl, status:"pending", amount:adjustedAmount, amountSen, baseAmount, baseAmountSen, priceAdjustmentPercent, priceAdjustmentCategory });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message || "Failed create ToyyibPay bill" });
  }
});

app.get("/api/toyyib/order/:orderId", async (req, res) => {
  let order = findPremiumOrderByAny({ orderId: req.params.orderId });
  if (!order) return res.status(404).json({ ok:false, error:"Order not found" });
  if (order.status !== "paid") order = await refreshToyyibOrderStatus(order);
  if (order.status === "paid") { await azFinalizeCommissionForOrder(order); return res.json(toyyibPaidResponse(order, req)); }
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
      if (order.status === "paid") { await azFinalizeCommissionForOrder(order); return res.json(toyyibPaidResponse(order, req)); }
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
    if (Array.isArray(order.paBmItems) && order.paBmItems.length) {
      order = await azobssPersistJupemOrder(order);
      await azobssSyncJupemPurchaseLogs(order, order.status, {
        paymentReference: order.paymentReference,
        paidAtMs: Date.now()
      });
    }
    if (order.status === "paid") {
      const withDownload = makePremiumDownloadForOrder(order);
      await azFinalizeCommissionForOrder(withDownload);
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
  if (paid) {
    order = makePremiumDownloadForOrder(order);
    await azFinalizeCommissionForOrder(order);
    order = await sendDownloadEmailForOrder(order, req);
  }
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
  const productId = cleanPremiumText(product.productId || product.id || data.productId || productName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""), 160);
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
  const order = { orderId, productId, productName, amount, status:"paid", paymentMethod, paymentReference, user, product:{...product,id:productId,name:productName,price:amount}, shareReferral:azReferralFrom(data, product, {productId}), productOwner:azProductOwnerFrom(product, {productId}), createdAt:new Date(now).toISOString(), paidAt:new Date(now).toISOString(), downloadToken:token, tokenExpiresAt:new Date(expiresAtMs).toISOString(), maxDownload:requestedLimit };
  savePremiumOrder(order);
  savePremiumToken({ token, orderId, productId, productName, user, downloadLink, createdAt:now, expiresAt:expiresAtMs, usedCount:0, maxDownload:requestedLimit });
  await azFinalizeCommissionForOrder(order);
  await sendDownloadEmailForOrder(order, req);
  res.json({ ok:true, orderId, status:"paid", message:"Purchase completed. A temporary download link has been generated and an email will be sent if SMTP is enabled.", downloadUrl:`/api/premium/download/${encodeURIComponent(token)}`, receiptUrl:`/api/premium/receipt/${encodeURIComponent(orderId)}`, expiresAt:order.tokenExpiresAt, maxDownload:requestedLimit });
});


app.get("/api/commission/status", async (req, res) => {
  try {
    const db = getAzobssBackendDb();
    let firestoreOk = false;
    let sampleCount = 0;
    let error = "";
    if (db) {
      try {
        const snap = await db.collection('commissionRecords').limit(1).get();
        firestoreOk = true;
        sampleCount = snap.size;
      } catch (err) {
        error = err && err.message ? err.message : String(err);
      }
    }
    const localCount = Array.isArray(readPremiumJson(COMMISSION_RECORDS_FILE, [])) ? readPremiumJson(COMMISSION_RECORDS_FILE, []).length : 0;
    res.json({
      ok: true,
      firestoreConfigured: !!(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID),
      firestoreOk,
      firestoreSampleCount: sampleCount,
      localJsonCount: localCount,
      envHasServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      error
    });
  } catch (err) {
    res.status(500).json({ ok:false, error: err && err.message ? err.message : String(err) });
  }
});

app.post("/api/commission/retry-order", async (req, res) => {
  try {
    const orderId = cleanPremiumText(req.body?.orderId || req.query.orderId || '', 140);
    const billCode = cleanPremiumText(req.body?.billCode || req.query.billCode || '', 100);
    const order = findPremiumOrderByAny({ orderId, billCode });
    if (!order) return res.status(404).json({ ok:false, error:'Order not found' });
    if (order.status !== 'paid') return res.status(400).json({ ok:false, error:'Order is not paid', status: order.status || 'unknown' });
    const result = await azFinalizeCommissionForOrder(order);
    res.json({ ok:true, orderId: order.orderId, billCode: order.billCode, commission: result, referral: azReferralFrom({}, order.product || {}, order), owner: azProductOwnerFrom(order.product || {}, order) });
  } catch (err) {
    res.status(500).json({ ok:false, error: err && err.message ? err.message : String(err) });
  }
});


function azSyncPremiumOrderTokenStateLegacy(saved = {}, token = "") {
  try {
    if (!saved || !saved.orderId) return null;
    const used = Math.max(0, Number(saved.usedCount || saved.downloadCount || saved.downloadsUsed || 0) || 0);
    const max = Math.max(1, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1);
    const expiresAtMs = Number(saved.expiresAtMs || saved.expiresAt || 0) || Date.parse(String(saved.tokenExpiresAt || "")) || 0;
    const expiredByTime = !!(expiresAtMs && Date.now() > expiresAtMs);
    const exhausted = used >= max;
    const existing = findPremiumOrderByAny({ orderId:saved.orderId, billCode:saved.billCode }) || saved;
    return upsertPremiumOrder({
      ...(existing || {}),
      downloadToken: token || saved.token || saved.downloadToken || "",
      tokenExpiresAtMs: expiresAtMs,
      downloadExpiresAtMs: expiresAtMs,
      downloadCount: used,
      usedCount: used,
      downloadsUsed: used,
      maxDownload: max,
      maxDownloads: max,
      downloadExpired: expiredByTime || exhausted,
      downloadActive: !(expiredByTime || exhausted),
      downloadStatus: exhausted ? "used" : (expiredByTime ? "expired" : "active"),
      lastDownloadUsageSyncAt: new Date().toISOString(),
      lastDownloadUsageSyncAtMs: Date.now(),
      azobssPatch382: true
    });
  } catch (_) { return null; }
}


app.get("/api/premium/download-status/:token", (req, res) => {
  const token = String(req.params.token || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const saved = token ? findPremiumToken(token) : null;
  if (!saved) return res.status(404).json({ ok:false, error:"TOKEN_NOT_FOUND" });
  const now = Date.now();
  const used = Math.max(0, Number(saved.usedCount || saved.downloadCount || saved.downloadsUsed || 0) || 0);
  const max = Math.max(1, Number(saved.maxDownload || saved.maxDownloads || saved.downloadLimit || 1) || 1);
  const expiresAtMs = Number(saved.expiresAtMs || saved.expiresAt || saved.tokenExpiresAtMs || saved.downloadExpiresAtMs || 0) || 0;
  const expiredByTime = !!(expiresAtMs && now > expiresAtMs && saved.expiresNever !== true && saved.neverExpire !== true && saved.downloadNeverExpire !== true);
  const exhausted = used >= max || String(saved.downloadStatus || "").toLowerCase() === "used" || saved.downloadExpired === true;
  const expired = expiredByTime || exhausted;
  try { azSyncPremiumOrderTokenStateLegacy(saved, token); } catch (_) {}
  res.json({ ok:true, token, usedCount:used, downloadCount:used, downloadsUsed:used, maxDownload:max, maxDownloads:max, downloadLimit:max, expiresAtMs, tokenExpiresAtMs:expiresAtMs, downloadExpiresAtMs:expiresAtMs, expiredByTime, exhausted, downloadExpired:expired, downloadActive:!expired && used < max, downloadStatus:exhausted?"used":(expiredByTime?"expired":"active"), downloadUrl:(!expired && used < max)?`/api/premium/download/${encodeURIComponent(token)}`:"", patch:"AZOBSS_MY_PURCHASES_TOKEN_STATUS_383_LEGACY" });
});

app.get("/api/premium/download-health", (req, res) => {
  res.json({ ok:true, patch:AZOBSS_SECURE_PREMIUM_DOWNLOAD_PATCH, mode:"one-token-one-session-backend-stream", rangeSupport:true, sessionTtlMs:azPremiumSessionTtlMs() });
});

app.get("/api/premium/download-session/:sessionId", azHandlePremiumDownloadSession);
app.head("/api/premium/download-session/:sessionId", azHandlePremiumDownloadSession);

app.post("/api/premium/download/:token", (req, res) => {
  const token = String(req.params.token || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const saved = findPremiumToken(token);
  if (!saved) return res.status(403).send("Download link expired or already used too many times.");
  try {
    const sessionId = azCreatePremiumDownloadSession(req, token, saved);
    return res.redirect(303, `/api/premium/download-session/${encodeURIComponent(sessionId)}`);
  } catch (err) {
    try { if (saved) azSyncPremiumOrderTokenStateLegacy(saved, token); } catch (_) {}
    return res.status(err.statusCode || 500).send(err.statusCode ? err.message : "Download cannot start. Please contact admin.");
  }
});

app.get("/api/premium/download/:token", (req, res) => {
  const token = req.params.token;
  const saved = findPremiumToken(token);
  if (!saved || Number(saved.expiresAt || 0) < Date.now() || Number(saved.usedCount || 0) >= Number(saved.maxDownload || 1)) {
    if (saved) azSyncPremiumOrderTokenStateLegacy(saved, token);
    return res.status(403).send("Download link expired or already used too many times.");
  }
  const productName = String(saved.productName || "AZOBSS Digital Product").replace(/[<>]/g, "");
  const expires = saved.expiresAt ? new Date(Number(saved.expiresAt)).toLocaleString("en-MY", { timeZone:"Asia/Kuala_Lumpur" }) : "-";
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>AZOBSS Download Confirm</title><style>body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;padding:24px}.box{max-width:680px;margin:40px auto;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px}button.btn{border:0;cursor:pointer;background:#16a34a;color:white;padding:14px 20px;border-radius:12px;font-weight:800;font-size:16px}.muted{color:#94a3b8}.warn{color:#fbbf24}.small{font-size:12px}</style></head><body><div class="box"><h1>AZOBSS Download Ready ✅</h1><p><b>Product:</b> ${productName}</p><p class="muted">This preview page does not use your download quota.</p><form method="POST" action="/api/premium/download/${encodeURIComponent(token)}"><button class="btn" type="submit">Start Download</button></form><p class="warn">Download quota is used only once when this secure session starts. IDM/browser Range requests inside the same session will not add extra quota.</p><p class="muted">Used: ${Number(saved.usedCount||0)} / ${Number(saved.maxDownload||1)}<br>Expires: ${expires}</p><p class="muted small">Backend stream session active. The real file URL is not exposed.</p></div></body></html>`);
});

app.get("/api/premium/receipt/:orderId", (req, res) => {
  const orders = readPremiumJson(PREMIUM_ORDERS_FILE, []);
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) return res.status(404).send("Receipt not found");
  if (String(order.status || "").toLowerCase() !== "paid") return res.status(403).send("Receipt locked until payment is verified.");
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


async function syncLuckyDrawPrizeFromPublicFolder(options = {}) {
  const key = cleanText(options.monthKey || monthKey(), 32) || monthKey();
  const baseUrl = String(options.baseUrl || PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "").trim();
  if (!baseUrl) return { ok:false, error:"baseUrl tidak ditemui." };

  const previous = readJson(getPrizeFile(key), {});
  const jsonPath = options.prizeJsonPath || "/lucky-draw/giveaway-prize.json";
  const jsonUrl = resolvePublicUrl(baseUrl, jsonPath);
  let jsonData = {};
  let jsonFound = false;
  try {
    const jsonRes = await fetch(jsonUrl, { method:"GET", headers:{ "Cache-Control":"no-cache" } });
    if (jsonRes.ok) {
      jsonData = await jsonRes.json();
      jsonFound = true;
    }
  } catch(e) {
    jsonData = {};
  }

  const rawImageValues = [];
  const addRaw = (v) => {
    if (Array.isArray(v)) v.forEach(addRaw);
    else if (typeof v === "string") String(v).split(/[\n,]+/).forEach(x => { if (x.trim()) rawImageValues.push(x.trim()); });
  };
  addRaw(jsonData.imageUrls || jsonData.images || []);
  addRaw(jsonData.imageUrl || jsonData.image || "");

  const prefix = String(options.imagePrefix || "/lucky-draw/hadiah").trim();
  const maxImages = Math.min(50, Math.max(1, Number(options.maxImages || 20) || 20));
  const exts = ["jpg", "jpeg", "png", "webp", "gif"];
  for (let i = 1; i <= maxImages; i++) {
    for (const ext of exts) {
      const candidate = resolvePublicUrl(baseUrl, `${prefix}${i}.${ext}`);
      if (candidate && await imageUrlExists(candidate)) rawImageValues.push(candidate);
    }
  }

  const normalizedRawUrls = [];
  for (const raw of rawImageValues) {
    const url = resolveLuckyDrawPublicImageUrl(baseUrl, raw);
    if (url && await imageUrlExists(url)) normalizedRawUrls.push(url);
  }

  const sourceUrls = uniqueList(normalizedRawUrls.map(v => resolvePublicUrl(baseUrl, v)).filter(Boolean));
  if (!sourceUrls.length) {
    return { ok:false, notFound:true, error:"Tiada gambar folder dijumpai.", jsonFound, sourceJsonUrl: jsonUrl, sourceImageUrls: [] };
  }

  const previousSources = Array.isArray(previous.sourceImageUrls) ? previous.sourceImageUrls : [];
  const sameSources = JSON.stringify(previousSources) === JSON.stringify(sourceUrls);
  if (sameSources && Array.isArray(previous.imageUrls) && previous.imageUrls.length) {
    return { ok:true, skipped:true, prize: previous, syncedImages: previous.imageUrls, sourceImageUrls: sourceUrls, sourceJsonUrl: jsonUrl };
  }

  const syncedImages = [];
  // Sync up to maxImages (default 20). Previous patches accidentally capped the final saved images at 10,
  // so folder scans could find hadiah1..hadiah20 but only part of them were saved to the prize carousel.
  const saveLimit = Math.min(50, Math.max(1, maxImages || 20));
  for (let i = 0; i < sourceUrls.length && syncedImages.length < saveLimit; i++) {
    const sourceUrl = sourceUrls[i];
    const uploaded = await uploadLuckyPrizeRemoteUrlPersistent(sourceUrl, `hadiah${i+1}.jpg`);
    syncedImages.push(uploaded || sourceUrl);
  }

  const prize = {
    monthKey: key,
    title: cleanText(jsonData.title || previous.title || "Hadiah Lucky Draw", 300),
    description: cleanText(jsonData.description || previous.description || "", 8000),
    imageUrl: syncedImages[0] || "",
    image: syncedImages[0] || "",
    imageUrls: syncedImages,
    images: syncedImages,
    imageStorage: syncedImages.some(u => /res\.cloudinary\.com/i.test(u)) ? "cloudinary-auto-folder-sync" : "public-folder-url",
    updatedAt: new Date().toISOString(),
    updatedBy: cleanText(options.updatedBy || "auto-folder-sync", 80),
    sourceJsonUrl: jsonUrl,
    sourceImageUrls: sourceUrls,
    autoSynced: true
  };
  writeJson(getPrizeFile(key), prize);
  return { ok:true, prize, syncedImages, sourceImageUrls: sourceUrls, sourceJsonUrl: jsonUrl, jsonFound };
}

app.post("/api/lucky-draw/prize/sync-folder", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const result = await syncLuckyDrawPrizeFromPublicFolder({
      monthKey: body.monthKey,
      baseUrl: body.baseUrl,
      prizeJsonPath: body.prizeJsonPath,
      imagePrefix: body.imagePrefix,
      maxImages: body.maxImages,
      updatedBy: body.updatedBy || "admin"
    });
    if (!result.ok) return res.status(result.notFound ? 404 : 400).json({ ok:false, error: result.error || "Sync folder gagal" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message || "Sync folder prize failed" });
  }
});

app.get("/api/lucky-draw/prize", async (req, res) => {
  const key = req.query.monthKey || monthKey();
  let autoSyncResult = null;
  const wantsAutoSync = String(req.query.autoFolderSync || req.query.autoSync || "") === "1";
  if (wantsAutoSync) {
    try {
      let frontendOrigin = "";
      try {
        const originHeader = req.get("origin") || "";
        if (originHeader) frontendOrigin = originHeader;
        else {
          const refererHeader = req.get("referer") || "";
          if (refererHeader) frontendOrigin = new URL(refererHeader).origin;
        }
      } catch(e) {}
      autoSyncResult = await syncLuckyDrawPrizeFromPublicFolder({
        monthKey: key,
        baseUrl: req.query.baseUrl || PUBLIC_BASE_URL || frontendOrigin || `${req.protocol}://${req.get("host")}`,
        updatedBy: "auto-folder-sync"
      });
    } catch (err) {
      autoSyncResult = { ok:false, error: err.message || "Auto folder sync failed" };
    }
  }
  const prize = readJson(getPrizeFile(key), {
    monthKey: key,
    title: "Hadiah belum diumumkan",
    description: "Admin belum upload hadiah Lucky Draw bulan ini.",
    imageUrl: "",
    updatedAt: ""
  });
  res.json({ ok: true, prize, monthName: monthName(key), autoSync: autoSyncResult });
});

app.post("/api/lucky-draw/prize", requireAdmin, upload.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 10 }]), async (req, res) => {
  try {
    const key = req.body.monthKey || monthKey();
    const previous = readJson(getPrizeFile(key), {});
    const manualImageUrl = cleanText(req.body.imageUrl, 1200);
    let manualImageUrls = [];
    try {
      const raw = req.body.imageUrls;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) manualImageUrls = parsed.map(v => cleanText(v, 1200)).filter(Boolean);
      }
    } catch(e) {
      manualImageUrls = String(req.body.imageUrls || "").split(/[\n,]+/).map(v => cleanText(v, 1200)).filter(Boolean);
    }
    if (manualImageUrl && !manualImageUrls.includes(manualImageUrl)) manualImageUrls.unshift(manualImageUrl);

    const previousUrls = Array.isArray(previous.imageUrls) ? previous.imageUrls.filter(Boolean) : [];
    if (!previousUrls.length && (previous.imageUrl || previous.image)) previousUrls.push(previous.imageUrl || previous.image);

    let imageUrls = manualImageUrls.length ? manualImageUrls.slice() : previousUrls.slice();
    let imageStorage = previous.imageStorage || (imageUrls.length ? "url" : "");

    const uploadFiles = [];
    if (req.files) {
      if (Array.isArray(req.files.image)) uploadFiles.push(...req.files.image);
      if (Array.isArray(req.files.images)) uploadFiles.push(...req.files.images);
    }

    if (uploadFiles.length) {
      const uploadedUrls = [];
      for (const file of uploadFiles.slice(0, 10)) {
        const persistentUrl = await uploadLuckyPrizeImagePersistent(file);
        if (persistentUrl) {
          uploadedUrls.push(persistentUrl);
          try { fs.unlinkSync(file.path); } catch(e) {}
        } else {
          uploadedUrls.push(`${PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`}/uploads/lucky-draw/${file.filename}`);
        }
      }
      if (uploadedUrls.length) {
        imageUrls = uploadedUrls;
        imageStorage = uploadedUrls.some(u => /res\.cloudinary\.com/i.test(u)) ? "cloudinary" : "backend-upload";
      }
    }

    const imageUrl = imageUrls[0] || "";
    const prize = {
      monthKey: key,
      title: req.body.title || previous.title || "Hadiah Lucky Draw",
      description: req.body.description || previous.description || "",
      imageUrl,
      image: imageUrl,
      imageUrls,
      images: imageUrls,
      imageStorage,
      updatedAt: new Date().toISOString(),
      updatedBy: req.body.updatedBy || "admin"
    };

    writeJson(getPrizeFile(key), prize);
    res.json({ ok: true, prize, persistentImage: imageStorage === "cloudinary" || imageStorage === "url" });
  } catch (err) {
    res.status(500).json({ ok:false, error: err.message || "Save prize failed" });
  }
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
    if (!Array.isArray(prize.imageUrls)) prize.imageUrls = [prize.imageUrl || prize.image].filter(Boolean);
    if (!Array.isArray(prize.images)) prize.images = prize.imageUrls;

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

app.get("/api/lucky-draw/product-referral-status", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const ref = cleanShareUsername(req.query.ref);
  const deviceFingerprint = cleanText(req.query.deviceFingerprint || "", 160);
  const ipAddress = getClientIp(req);
  if (!ref) return res.status(400).json({ ok: false, error: "ref required" });

  const count = countValidProductShareClicks(key, ref);
  const entries = readJson(getEntriesFile(key), []);
  const activeEntries = entries.filter((e) => e.monthKey === key && !e.deleted);
  const sameUser = activeEntries.find((e) => e.usernameKey === ref);
  const sameDevice = deviceFingerprint ? activeEntries.find((e) => e.deviceFingerprint && e.deviceFingerprint === deviceFingerprint) : null;
  const sameIp = ipAddress ? activeEntries.find((e) => e.ipAddress && e.ipAddress === ipAddress) : null;

  let blockCode = "";
  let blockReason = "";
  if (sameUser) {
    blockCode = "ALREADY_JOINED";
    blockReason = "Akaun ini sudah join Lucky Draw bulan ini.";
  } else if (sameDevice) {
    blockCode = "DUPLICATE_DEVICE";
    blockReason = "Device ini sudah digunakan untuk join Lucky Draw bulan ini.";
  } else if (sameIp) {
    blockCode = "DUPLICATE_IP";
    blockReason = "IP address ini sudah digunakan untuk join Lucky Draw bulan ini.";
  }

  res.json({
    ok: true,
    monthKey: key,
    ref,
    count,
    valid: count >= 1,
    eligible: count >= 1 && !blockCode,
    blockCode,
    blockReason
  });
});

app.post("/api/lucky-draw/product-referral-click", (req, res) => {
  const key = req.body.monthKey || monthKey();
  const ref = cleanShareUsername(req.body.ref);
  const visitorUsernameKey = cleanShareUsername(req.body.visitorUsernameKey);
  const productId = cleanText(req.body.productId || req.body.product || "", 120).replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 120);
  const productName = cleanText(req.body.productName || "", 180);
  const sourcePage = cleanText(req.body.sourcePage || "", 40).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const deviceFingerprint = cleanText(req.body.deviceFingerprint, 160);
  const ipAddress = getClientIp(req);

  if (!ref) return res.status(400).json({ ok: false, error: "ref required" });
  if (!productId) return res.status(400).json({ ok: false, error: "productId required" });
  if (visitorUsernameKey && visitorUsernameKey === ref) {
    logLuckyDrawAbuse(key, "SELF_PRODUCT_SHARE_CLICK", { ref, visitorUsernameKey, usernameKey: ref, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "User opened own paid product share link" });
    return res.json({ ok: true, ignored: true, reason: "SELF_CLICK", count: countValidProductShareClicks(key, ref) });
  }

  const file = getProductReferralFile(key);
  const clicks = readJson(file, []);
  const active = clicks.filter((c) => !c.deleted && c.ref === ref && c.productId === productId);
  const sameDevice = deviceFingerprint ? active.find((c) => c.deviceFingerprint && c.deviceFingerprint === deviceFingerprint) : null;
  const sameIp = ipAddress ? active.find((c) => c.ipAddress && c.ipAddress === ipAddress) : null;

  if (sameDevice || sameIp) {
    logLuckyDrawAbuse(key, "DUPLICATE_PRODUCT_SHARE_CLICK", { ref, visitorUsernameKey, usernameKey: ref, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: sameDevice ? "Duplicate product share device" : "Duplicate product share IP" });
    return res.json({ ok: true, duplicate: true, ref, productId, count: countValidProductShareClicks(key, ref) });
  }

  const click = {
    id: `${key}_${ref}_${productId}_${Date.now()}`,
    monthKey: key,
    ref,
    productId,
    productName,
    sourcePage,
    visitorUsernameKey,
    deviceFingerprint,
    ipAddress,
    userAgent: cleanText(req.get("user-agent"), 300),
    clickedAtMs: Date.now(),
    clickedAt: new Date().toISOString(),
    deleted: false
  };
  clicks.push(click);
  writeJson(file, clicks);
  res.json({ ok: true, ref, productId, count: countValidProductShareClicks(key, ref), click });
});

app.get("/api/lucky-draw/referral-status", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const ref = cleanShareUsername(req.query.ref);
  if (!ref) return res.status(400).json({ ok: false, error: "ref required" });
  const count = countValidReferralClicks(key, ref);
  res.json({ ok: true, monthKey: key, ref, count, valid: count >= 1 });
});

app.post("/api/lucky-draw/referral-click", (req, res) => {
  const key = req.body.monthKey || monthKey();
  const ref = cleanShareUsername(req.body.ref);
  const visitorUsernameKey = cleanShareUsername(req.body.visitorUsernameKey);
  const deviceFingerprint = cleanText(req.body.deviceFingerprint, 160);
  const ipAddress = getClientIp(req);

  if (!ref) return res.status(400).json({ ok: false, error: "ref required" });
  if (visitorUsernameKey && visitorUsernameKey === ref) {
    logLuckyDrawAbuse(key, "SELF_REFERRAL_CLICK", { ref, visitorUsernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "User opened own share link" });
    return res.json({ ok: true, ignored: true, reason: "SELF_CLICK", count: countValidReferralClicks(key, ref) });
  }

  const file = getReferralFile(key);
  const clicks = readJson(file, []);
  const active = clicks.filter((c) => !c.deleted && c.ref === ref);
  const sameDevice = deviceFingerprint ? active.find((c) => c.deviceFingerprint && c.deviceFingerprint === deviceFingerprint) : null;
  const sameIp = ipAddress ? active.find((c) => c.ipAddress && c.ipAddress === ipAddress) : null;

  if (sameDevice || sameIp) {
    logLuckyDrawAbuse(key, "DUPLICATE_REFERRAL_CLICK", { ref, visitorUsernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: sameDevice ? "Duplicate device" : "Duplicate IP" });
    return res.json({ ok: true, duplicate: true, ref, count: active.length });
  }

  const click = {
    id: `${key}_${ref}_${Date.now()}`,
    monthKey: key,
    ref,
    visitorUsernameKey,
    deviceFingerprint,
    ipAddress,
    userAgent: cleanText(req.get("user-agent"), 300),
    clickedAtMs: Date.now(),
    clickedAt: new Date().toISOString(),
    deleted: false
  };
  clicks.push(click);
  writeJson(file, clicks);
  const count = clicks.filter((c) => !c.deleted && c.ref === ref).length;
  res.json({ ok: true, ref, count, click });
});


app.get("/api/lucky-draw/referral-audit", requireAdmin, (req, res) => {
  const key = req.query.monthKey || monthKey();
  const limit = Math.max(1, Math.min(300, Number(req.query.limit || 120)));
  const audit = buildReferralAudit(key);
  res.json({
    ok: true,
    monthKey: key,
    summary: audit.summary,
    clicks: audit.clicks.slice(0, limit)
  });
});

app.get("/api/lucky-draw/abuse-audit", requireAdmin, (req, res) => {
  const key = req.query.monthKey || monthKey();
  const limit = Math.max(1, Math.min(300, Number(req.query.limit || 120)));
  const audit = buildLuckyDrawAbuseAudit(key);
  res.json({
    ok: true,
    monthKey: key,
    summary: audit.summary,
    logs: audit.logs.slice(0, limit)
  });
});


function luckyDrawMonthRef(key){
  return luckyDrawDb.collection("luckyDrawMonths").doc(String(key || monthKey()));
}
function luckyDrawParticipantsRef(key){
  return luckyDrawMonthRef(key).collection("participants");
}
function luckyDrawWinnerRef(key){
  return luckyDrawMonthRef(key).collection("meta").doc("winner");
}
function luckyDrawCleanEntryForClient(entry){
  if (!entry || typeof entry !== "object") return entry;
  return { ...entry };
}
async function luckyDrawCountParticipantsFirestore(key){
  const snap = await luckyDrawParticipantsRef(key).where("deleted", "==", false).count().get();
  return Number(snap.data().count || 0);
}
async function luckyDrawListEntriesFirestore(key, opts = {}){
  const limit = Math.max(1, Math.min(500, Number(opts.limit || 20)));
  const page = Math.max(1, Number(opts.page || 1));
  const offset = Math.max(0, Number(opts.offset || ((page - 1) * limit)));
  let query = luckyDrawParticipantsRef(key).orderBy("joinedAtMs", "desc");
  if (offset) query = query.offset(offset);
  query = query.limit(limit);
  const [snap, total] = await Promise.all([query.get(), luckyDrawCountParticipantsFirestore(key)]);
  const entries = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!data.deleted) entries.push(luckyDrawCleanEntryForClient({ id: doc.id, ...data }));
  });
  return { entries, total, page, limit, offset, hasMore: offset + entries.length < total };
}
async function luckyDrawAllEntriesFirestore(key){
  const snap = await luckyDrawParticipantsRef(key).where("deleted", "==", false).get();
  const rows = [];
  snap.forEach((doc) => rows.push(luckyDrawCleanEntryForClient({ id: doc.id, ...doc.data() })));
  rows.sort((a,b) => Number(b.joinedAtMs || 0) - Number(a.joinedAtMs || 0));
  return rows;
}
async function luckyDrawFindFirstParticipantFirestore(key, field, value){
  if (!value) return null;
  const snap = await luckyDrawParticipantsRef(key).where(field, "==", value).where("deleted", "==", false).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return luckyDrawCleanEntryForClient({ id: doc.id, ...doc.data() });
}
async function luckyDrawWriteParticipantFirestore(key, entry){
  const ref = luckyDrawParticipantsRef(key).doc(entry.usernameKey);
  await ref.create(entry);
  await luckyDrawMonthRef(key).set({
    monthKey: key,
    participantCount: luckyDrawFieldValue.increment(1),
    updatedAt: new Date().toISOString(),
    updatedAtMs: Date.now()
  }, { merge: true });
}
async function luckyDrawPatchParticipantFirestore(key, id, patch){
  const ref = luckyDrawParticipantsRef(key).doc(String(id || ""));
  const snap = await ref.get();
  if (!snap.exists) return null;
  const next = { ...patch, editedAt: new Date().toISOString(), editedAtMs: Date.now() };
  await ref.set(next, { merge: true });
  const fresh = await ref.get();
  return luckyDrawCleanEntryForClient({ id: fresh.id, ...fresh.data() });
}
async function luckyDrawSoftDeleteParticipantFirestore(key, id){
  const ref = luckyDrawParticipantsRef(key).doc(String(id || ""));
  const snap = await ref.get();
  if (!snap.exists || snap.data().deleted) return false;
  await ref.set({ deleted: true, deletedAt: new Date().toISOString(), deletedAtMs: Date.now() }, { merge: true });
  await luckyDrawMonthRef(key).set({ participantCount: luckyDrawFieldValue.increment(-1), updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }, { merge: true });
  return true;
}
async function luckyDrawResetParticipantsFirestore(key){
  let count = 0;
  while (true) {
    const snap = await luckyDrawParticipantsRef(key).where("deleted", "==", false).limit(400).get();
    if (snap.empty) break;
    const batch = luckyDrawDb.batch();
    snap.docs.forEach((doc) => {
      count += 1;
      batch.set(doc.ref, { deleted: true, resetAt: new Date().toISOString(), resetAtMs: Date.now() }, { merge: true });
    });
    await batch.commit();
    if (snap.size < 400) break;
  }
  await luckyDrawMonthRef(key).set({ participantCount: 0, resetAt: new Date().toISOString(), resetAtMs: Date.now(), updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }, { merge: true });
  return count;
}
async function luckyDrawGetWinnerFirestore(key){
  const snap = await luckyDrawWinnerRef(key).get();
  return snap.exists ? snap.data() : null;
}
async function luckyDrawSetWinnerFirestore(key, payload){
  await luckyDrawWinnerRef(key).set(payload, { merge: false });
  await luckyDrawMonthRef(key).set({ winnerUsername: payload.usernameKey || "", winnerSelectedAt: payload.selectedAt || new Date().toISOString(), drawStatus: "closed", updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }, { merge: true });
}
async function luckyDrawResetWinnerFirestore(key){
  await luckyDrawWinnerRef(key).delete().catch(() => {});
  await luckyDrawMonthRef(key).set({ winnerUsername: "", drawStatus: "open", winnerResetAt: new Date().toISOString(), updatedAt: new Date().toISOString(), updatedAtMs: Date.now() }, { merge: true });
}
async function luckyDrawWinnerHistoryFirestore(limit = 24){
  const monthsSnap = await luckyDrawDb.collection("luckyDrawMonths").limit(80).get();
  const winners = [];
  for (const monthDoc of monthsSnap.docs) {
    const win = await monthDoc.ref.collection("meta").doc("winner").get();
    if (win.exists) winners.push(win.data());
  }
  winners.sort((a,b) => Number(b.selectedAtMs || 0) - Number(a.selectedAtMs || 0));
  return winners.slice(0, limit);
}

app.get("/api/lucky-draw/entries", async (req, res) => {
  const key = req.query.monthKey || monthKey();
  const exportAll = req.query.all === "1" || req.query.all === "true" || req.query.export === "1";
  try {
    if (useLuckyDrawFirestore()) {
      if (exportAll) {
        const entries = await luckyDrawAllEntriesFirestore(key);
        return res.json({ ok: true, storage: "firestore", monthKey: key, total: entries.length, entries });
      }
      const result = await luckyDrawListEntriesFirestore(key, {
        limit: req.query.limit || 20,
        page: req.query.page || 1,
        offset: req.query.offset || 0
      });
      return res.json({ ok: true, storage: "firestore", monthKey: key, ...result });
    }

    const entries = readJson(getEntriesFile(key), []);
    const active = entries.filter((e) => !e.deleted);
    active.sort((a,b) => Number(b.joinedAtMs || 0) - Number(a.joinedAtMs || 0));
    if (exportAll) return res.json({ ok: true, storage: "json", monthKey: key, total: active.length, entries: active });
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 20)));
    const page = Math.max(1, Number(req.query.page || 1));
    const offset = Math.max(0, Number(req.query.offset || ((page - 1) * limit)));
    const slice = active.slice(offset, offset + limit);
    res.json({ ok: true, storage: "json", monthKey: key, total: active.length, entries: slice, page, limit, offset, hasMore: offset + slice.length < active.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message ? err.message : "Entries load failed" });
  }
});

app.get("/api/lucky-draw/entries/export", requireAdmin, async (req, res) => {
  const key = req.query.monthKey || monthKey();
  try {
    const entries = useLuckyDrawFirestore()
      ? await luckyDrawAllEntriesFirestore(key)
      : readJson(getEntriesFile(key), []).filter((e) => !e.deleted);
    const winner = useLuckyDrawFirestore() ? await luckyDrawGetWinnerFirestore(key) : readJson(getWinnerFile(key), null);
    const winnerUsername = winner && winner.usernameKey ? String(winner.usernameKey).toLowerCase() : "";
    const headers = ["No","Month","Name","Username","Email","Phone","Referral Valid Count","Joined Date MY","Joined At ISO","Device Hash","IP Hash","Eligible Status","Winner"];
    const rows = [headers].concat(entries.map((entry, index) => {
      const username = String(entry.usernameKey || "").toLowerCase();
      const referralCount = Number(entry.referralCount || entry.productShareCount || 0);
      const eligible = referralCount >= 1 && !entry.deleted ? "ELIGIBLE" : "NOT_ELIGIBLE";
      const joinedDate = entry.joinedAt ? new Date(entry.joinedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "";
      const short = (v, n) => String(v || "").length > n ? String(v || "").slice(0, n) + "..." : String(v || "");
      return [index + 1, entry.monthKey || key, entry.name || "", entry.usernameKey || "", entry.contactEmail || "", entry.phone || "", referralCount, joinedDate, entry.joinedAt || "", short(entry.deviceFingerprint, 16), short(entry.ipAddress, 10), eligible, winnerUsername && username === winnerUsername ? "YES" : "NO"];
    }));
    const csv = rows.map((row) => row.map((value) => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="AZOBSS-Lucky-Draw-Participants-${key}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message ? err.message : "Export failed" });
  }
});

app.post("/api/lucky-draw/entries", async (req, res) => {
  const key = req.body.monthKey || monthKey();
  const usernameKey = cleanText(req.body.usernameKey, 80).toLowerCase();
  if (!usernameKey) return res.status(400).json({ ok: false, error: "usernameKey required" });
  const inviteCode = cleanShareUsername(req.body.inviteCode || usernameKey);
  const inviteUrl = cleanText(req.body.inviteUrl, 500);
  const shareConfirmed = req.body.shareConfirmed === true || req.body.shareConfirmed === "true" || req.body.shareConfirmed === "1";
  const deviceFingerprint = cleanText(req.body.deviceFingerprint, 160);
  const ipAddress = getClientIp(req);

  if (!inviteCode || !inviteUrl || !shareConfirmed) {
    return res.status(400).json({ ok: false, error: "Share link username dahulu sebelum join Lucky Draw." });
  }

  const productShareCount = countValidProductShareClicks(key, usernameKey);
  const referralCount = productShareCount;
  if (productShareCount < 1) {
    return res.status(403).json({ ok: false, code: "PRODUCT_SHARE_REQUIRED", error: "Belum ada klik valid dari link produk berbayar. Share mana-mana Software/CAD berbayar dahulu.", referralCount, productShareCount });
  }

  if (!deviceFingerprint) {
    return res.status(400).json({ ok: false, error: "Device fingerprint required" });
  }

  const uid = cleanText(req.body.uid, 120);

  try {
    const existingWinner = useLuckyDrawFirestore() ? await luckyDrawGetWinnerFirestore(key) : readJson(getWinnerFile(key), null);
    if (existingWinner) {
      return res.status(403).json({ ok: false, code: "DRAW_CLOSED", error: "Lucky Draw bulan ini sudah selesai. Join telah ditutup.", winner: existingWinner });
    }

    if (useLuckyDrawFirestore()) {
      const sameUserSnap = await luckyDrawParticipantsRef(key).doc(usernameKey).get();
      const sameUser = sameUserSnap.exists && !sameUserSnap.data().deleted ? { id: sameUserSnap.id, ...sameUserSnap.data() } : null;
      if (sameUser) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_USER", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "Username already joined this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_USER", error: "Username ini sudah join Lucky Draw bulan ini.", entry: sameUser });
      }
      const sameUid = uid ? await luckyDrawFindFirstParticipantFirestore(key, "uid", uid) : null;
      if (sameUid) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_UID", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "UID already joined this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_UID", error: "Akaun ini sudah join Lucky Draw bulan ini.", entry: sameUid });
      }
      const sameInviteCode = inviteCode ? await luckyDrawFindFirstParticipantFirestore(key, "inviteCode", inviteCode) : null;
      if (sameInviteCode) {
        return res.status(409).json({ ok: false, code: "DUPLICATE_INVITE_CODE", error: "Invite code ini sudah join Lucky Draw bulan ini.", entry: sameInviteCode });
      }
      const sameDevice = await luckyDrawFindFirstParticipantFirestore(key, "deviceFingerprint", deviceFingerprint);
      if (sameDevice) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_DEVICE", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "Device already used to join this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_DEVICE", error: "Device ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameDevice });
      }
      const sameIp = ipAddress ? await luckyDrawFindFirstParticipantFirestore(key, "ipAddress", ipAddress) : null;
      if (sameIp) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_IP", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "IP already used to join this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_IP", error: "IP address ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameIp });
      }
    } else {
      const file = getEntriesFile(key);
      const entries = readJson(file, []);
      const activeEntries = entries.filter((e) => e.monthKey === key && !e.deleted);
      const sameUser = activeEntries.find((e) => e.usernameKey === usernameKey);
      if (sameUser) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_USER", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "Username already joined this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_USER", error: "Username ini sudah join Lucky Draw bulan ini.", entry: sameUser });
      }
      const sameUid = uid ? activeEntries.find((e) => e.uid && e.uid === uid) : null;
      if (sameUid) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_UID", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "UID already joined this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_UID", error: "Akaun ini sudah join Lucky Draw bulan ini.", entry: sameUid });
      }
      const sameInviteCode = inviteCode ? activeEntries.find((e) => e.inviteCode && e.inviteCode === inviteCode) : null;
      if (sameInviteCode) {
        return res.status(409).json({ ok: false, code: "DUPLICATE_INVITE_CODE", error: "Invite code ini sudah join Lucky Draw bulan ini.", entry: sameInviteCode });
      }
      const sameDevice = activeEntries.find((e) => e.deviceFingerprint && e.deviceFingerprint === deviceFingerprint);
      if (sameDevice) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_DEVICE", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "Device already used to join this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_DEVICE", error: "Device ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameDevice });
      }
      const sameIp = activeEntries.find((e) => e.ipAddress && ipAddress && e.ipAddress === ipAddress);
      if (sameIp) {
        logLuckyDrawAbuse(key, "DUPLICATE_JOIN_IP", { usernameKey, deviceFingerprint, ipAddress, userAgent: req.get("user-agent"), reason: "IP already used to join this month" });
        return res.status(409).json({ ok: false, code: "DUPLICATE_IP", error: "IP address ini sudah digunakan untuk join Lucky Draw bulan ini.", entry: sameIp });
      }
    }

    const entry = {
      id: `${key}_${usernameKey}`,
      monthKey: key,
      usernameKey,
      uid,
      name: cleanText(req.body.name, 160) || usernameKey,
      phone: cleanText(req.body.phone, 60),
      contactEmail: cleanText(req.body.contactEmail, 180),
      inviteCode,
      inviteUrl,
      invitedByCode: cleanShareUsername(req.body.invitedByCode),
      referralCount,
      productShareCount,
      productShareRequired: true,
      deviceFingerprint,
      ipAddress,
      userAgent: cleanText(req.get("user-agent"), 300),
      shareConfirmed: true,
      joinedAtMs: Date.now(),
      joinedAt: new Date().toISOString(),
      deleted: false
    };

    if (useLuckyDrawFirestore()) {
      await luckyDrawWriteParticipantFirestore(key, entry);
      const total = await luckyDrawCountParticipantsFirestore(key).catch(() => 0);
      return res.json({ ok: true, storage: "firestore", entry, total });
    }

    const file = getEntriesFile(key);
    const entries = readJson(file, []);
    entries.push(entry);
    writeJson(file, entries);
    res.json({ ok: true, storage: "json", entry, total: entries.filter((e) => !e.deleted).length });
  } catch (err) {
    if (String(err && err.code || "") === "6" || /already exists/i.test(String(err && err.message || ""))) {
      return res.status(409).json({ ok: false, code: "DUPLICATE_USER", error: "Username ini sudah join Lucky Draw bulan ini." });
    }
    res.status(500).json({ ok: false, error: err && err.message ? err.message : "Join Lucky Draw gagal" });
  }
});

app.patch("/api/lucky-draw/entries/:id", requireAdmin, async (req, res) => {
  const key = req.body.monthKey || req.query.monthKey || monthKey();
  try {
    if (useLuckyDrawFirestore()) {
      const entry = await luckyDrawPatchParticipantFirestore(key, req.params.id, req.body);
      if (!entry) return res.status(404).json({ ok: false, error: "Entry not found" });
      return res.json({ ok: true, storage: "firestore", entry });
    }
    const file = getEntriesFile(key);
    const entries = readJson(file, []);
    const index = entries.findIndex((e) => e.id === req.params.id || `${e.monthKey}_${e.usernameKey}` === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "Entry not found" });
    entries[index] = { ...entries[index], ...req.body, editedAt: new Date().toISOString() };
    writeJson(file, entries);
    res.json({ ok: true, storage: "json", entry: entries[index] });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Patch failed" }); }
});

app.delete("/api/lucky-draw/entries/:id", requireAdmin, async (req, res) => {
  const key = req.query.monthKey || monthKey();
  try {
    if (useLuckyDrawFirestore()) {
      const ok = await luckyDrawSoftDeleteParticipantFirestore(key, req.params.id);
      if (!ok) return res.status(404).json({ ok: false, error: "Entry not found" });
      return res.json({ ok: true, storage: "firestore" });
    }
    const file = getEntriesFile(key);
    const entries = readJson(file, []);
    const index = entries.findIndex((e) => e.id === req.params.id || `${e.monthKey}_${e.usernameKey}` === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, error: "Entry not found" });
    entries[index].deleted = true;
    entries[index].deletedAt = new Date().toISOString();
    writeJson(file, entries);
    res.json({ ok: true, storage: "json" });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Delete failed" }); }
});

app.delete("/api/lucky-draw/entries", requireAdmin, async (req, res) => {
  const key = req.query.monthKey || monthKey();
  try {
    if (useLuckyDrawFirestore()) {
      const count = await luckyDrawResetParticipantsFirestore(key);
      return res.json({ ok: true, storage: "firestore", reset: count, monthKey: key });
    }
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
    res.json({ ok: true, storage: "json", reset: count, monthKey: key });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Reset failed" }); }
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

app.get("/api/lucky-draw/winner", async (req, res) => {
  const key = req.query.monthKey || monthKey();
  try {
    const winner = useLuckyDrawFirestore() ? await luckyDrawGetWinnerFirestore(key) : readJson(getWinnerFile(key), null);
    res.json({ ok: true, storage: useLuckyDrawFirestore() ? "firestore" : "json", monthKey: key, winner });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Winner load failed" }); }
});

app.get("/api/lucky-draw/winner-history", async (req, res) => {
  const limit = Math.max(1, Math.min(60, Number(req.query.limit || 24)));
  try {
    const winners = useLuckyDrawFirestore() ? await luckyDrawWinnerHistoryFirestore(limit) : listWinnerHistory().slice(0, limit);
    res.json({ ok: true, storage: useLuckyDrawFirestore() ? "firestore" : "json", winners });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Winner history failed" }); }
});

app.post("/api/lucky-draw/winner/spin", async (req, res) => {
  const key = req.body.monthKey || req.query.monthKey || monthKey();
  try {
    const existing = useLuckyDrawFirestore() ? await luckyDrawGetWinnerFirestore(key) : readJson(getWinnerFile(key), null);
    if (existing && !req.body.force) return res.json({ ok: true, storage: useLuckyDrawFirestore() ? "firestore" : "json", winner: existing, alreadySelected: true });

    const entries = useLuckyDrawFirestore() ? await luckyDrawAllEntriesFirestore(key) : readJson(getEntriesFile(key), []);
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
      participantTotal: entries.filter((e) => !e.deleted && e.monthKey === key).length,
      selectedAtMs: Date.now(),
      selectedAt: new Date().toISOString()
    };

    if (useLuckyDrawFirestore()) await luckyDrawSetWinnerFirestore(key, payload);
    else writeJson(getWinnerFile(key), payload);
    res.json({ ok: true, storage: useLuckyDrawFirestore() ? "firestore" : "json", winner: payload });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Run draw failed" }); }
});

app.delete("/api/lucky-draw/winner", requireAdmin, async (req, res) => {
  const key = req.query.monthKey || monthKey();
  try {
    if (useLuckyDrawFirestore()) await luckyDrawResetWinnerFirestore(key);
    else {
      const file = getWinnerFile(key);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    res.json({ ok: true, storage: useLuckyDrawFirestore() ? "firestore" : "json", reset: true, monthKey: key });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || "Reset winner failed" }); }
});

cron.schedule("* * * * *", async () => {
  const now = new Date();
  const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isLastDay = nextDay.getDate() === 1;
  const isTenPm = now.getHours() === 22 && now.getMinutes() === 0;
  if (!isLastDay || !isTenPm) return;

  const key = monthKey(now);
  const existing = useLuckyDrawFirestore() ? await luckyDrawGetWinnerFirestore(key).catch(() => null) : readJson(getWinnerFile(key), null);
  if (existing) return;
  const entries = useLuckyDrawFirestore() ? await luckyDrawAllEntriesFirestore(key).catch(() => []) : readJson(getEntriesFile(key), []);
  const winner = chooseWinner(entries, key);
  if (!winner) return;

  const payload = {
    monthKey: key,
    monthName: monthName(key),
    usernameKey: winner.usernameKey,
    name: winner.name || winner.usernameKey,
    participantTotal: entries.filter((e) => !e.deleted && e.monthKey === key).length,
    selectedAtMs: Date.now(),
    selectedAt: new Date().toISOString(),
    selectedBy: "cron"
  };
  if (useLuckyDrawFirestore()) await luckyDrawSetWinnerFirestore(key, payload).catch((err) => console.warn("Lucky Draw Firestore cron winner failed", err && err.message ? err.message : err));
  else writeJson(getWinnerFile(key), payload);
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





// =====================================================
// AZOBSS PATCH 412: SUBSCRIPTION API MIRROR FOR backend/server.js
// Reason: Render may be running backend/server.js, not deploy-server.js.
// =====================================================
const AZOBSS_BACKEND_SUB_DEVICE_LIMIT = Math.max(1, Number(process.env.AZOBSS_SUBSCRIPTION_DEVICE_LIMIT || 1) || 1);
const AZOBSS_BACKEND_SUB_TRANSFER_LIMIT = Math.max(0, Number(process.env.AZOBSS_SUBSCRIPTION_TRANSFER_LIMIT_PER_YEAR || 3) || 3);
const AZOBSS_BACKEND_SUB_GRACE_DAYS = Math.max(0, Number(process.env.AZOBSS_SUBSCRIPTION_GRACE_DAYS || 3) || 3);

function azSubCleanCode(v = "") {
  return cleanPremiumText(v || "", 180).toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_-]+/g, "").slice(0, 180);
}
function azSubCleanDevice(v = "") {
  return cleanPremiumText(v || "", 220).replace(/[^a-zA-Z0-9._:@-]+/g, "").slice(0, 180);
}
function azSubCleanEmail(v = "") {
  return cleanPremiumText(v || "", 180).trim().toLowerCase();
}
function azSubCleanUsername(v = "") {
  return cleanPremiumText(v || "", 120).trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "");
}
function azSubHashSecret() {
  return String(process.env.AZOBSS_SUBSCRIPTION_HASH_SECRET || process.env.AZOBSS_DOWNLOAD_HASH_SECRET || process.env.AZOBSS_ADMIN_API_SECRET || ADMIN_KEY || "azobss-subscription-local-secret").trim();
}
function azSubCodeHash(code = "") {
  const safe = azSubCleanCode(code);
  if (!safe) return "";
  return crypto.createHash("sha256").update(safe + "::" + azSubHashSecret()).digest("hex");
}
function azSubMakeCode(prefix = "AZOBSS", planId = "1m") {
  const p = cleanPremiumText(prefix || "AZOBSS", 18).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "AZOBSS";
  const plan = cleanPremiumText(planId || "1m", 12).toUpperCase().replace(/[^A-Z0-9]+/g, "") || "1M";
  return `${p}-${plan}-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}
function azSubPlanDefs() {
  return [
    { id:"1m", months:1, durationDays:31, label:"1 Month Activation Code", price:"RM29.90", priceSen:2990, monthlyText:"RM29.90/month", saveText:"" },
    { id:"3m", months:3, durationDays:93, label:"3 Months Activation Code", price:"RM69.90", priceSen:6990, monthlyText:"RM23.30/month", saveText:"Save RM19.80" },
    { id:"12m", months:12, durationDays:366, label:"12 Months Activation Code", price:"RM239.00", priceSen:23900, monthlyText:"RM19.92/month", saveText:"Save RM119.80" }
  ];
}
function azSubPlanId(v = "1m") {
  const s = String(v || "1m").toLowerCase().replace(/\s+/g, "");
  if (s.includes("12") || s === "12m" || s === "year" || s === "annual") return "12m";
  if (s.includes("3") || s === "3m" || s === "quarter") return "3m";
  return "1m";
}
function azSubPlanById(v = "1m") {
  const id = azSubPlanId(v);
  return azSubPlanDefs().find(p => p.id === id) || azSubPlanDefs()[0];
}
function azSubExpiryMs(value) {
  const n = Number(value || 0);
  if (Number.isFinite(n) && n > 0) return n;
  const t = Date.parse(String(value || ""));
  return Number.isFinite(t) ? t : 0;
}
function azSubBuyerEmail(order = {}) {
  return azSubCleanEmail(order.buyerEmail || order.email || order.user?.email || order.customerEmail || "");
}
function azSubUsername(order = {}) {
  return azSubCleanUsername(order.username || order.usernameKey || order.user?.username || order.user?.usernameKey || order.buyerUsername || "");
}
function azSubMaskDevice(id = "") {
  const s = String(id || "");
  if (!s) return "";
  if (s.length <= 8) return "***" + s.slice(-3);
  return s.slice(0, 4) + "..." + s.slice(-5);
}
function azSubYearKey(ms = Date.now()) {
  return String(new Date(Number(ms || Date.now()) || Date.now()).getUTCFullYear());
}
function azSubTransferCount(order = {}, yearKey = azSubYearKey()) {
  const byYear = order.transferCountByYear && typeof order.transferCountByYear === "object" ? order.transferCountByYear : {};
  const explicit = Number(byYear[yearKey] || 0) || 0;
  const hist = Array.isArray(order.deviceTransferHistory) ? order.deviceTransferHistory : [];
  const counted = hist.filter(x => azSubYearKey(Number(x.transferAtMs || Date.parse(x.transferAt || "") || 0) || Date.now()) === yearKey).length;
  return Math.max(explicit, counted);
}
function azSubPublic(order = {}, extra = {}) {
  const nowMs = Date.now();
  const expMs = Number(order.activationCodeExpiresAtMs || 0) || azSubExpiryMs(order.activationCodeExpiresAt);
  const yearKey = azSubYearKey(nowMs);
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
    expiresAt: order.activationCodeExpiresAt || (expMs ? new Date(expMs).toISOString() : ""),
    expiresAtMs: expMs,
    serverTime: new Date(nowMs).toISOString(),
    serverTimeMs: nowMs,
    graceDays: AZOBSS_BACKEND_SUB_GRACE_DAYS,
    graceUntil: new Date(nowMs + AZOBSS_BACKEND_SUB_GRACE_DAYS * 86400000).toISOString(),
    graceUntilMs: nowMs + AZOBSS_BACKEND_SUB_GRACE_DAYS * 86400000,
    deviceLimit: Number(order.deviceLimit || AZOBSS_BACKEND_SUB_DEVICE_LIMIT) || AZOBSS_BACKEND_SUB_DEVICE_LIMIT,
    activeDeviceMasked: azSubMaskDevice(order.activeDeviceId || ""),
    currentDeviceMasked: azSubMaskDevice(extra.deviceId || ""),
    transferCountThisYear: azSubTransferCount(order, yearKey),
    transferLimitPerYear: Number(order.transferLimitPerYear || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT) || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT,
    orderId: cleanPremiumText(order.orderId || "", 160)
  };
}
function azSubAdminRow(order = {}) {
  const expMs = Number(order.activationCodeExpiresAtMs || 0) || azSubExpiryMs(order.activationCodeExpiresAt);
  const code = azSubCleanCode(order.activationCode || "");
  const yearKey = azSubYearKey();
  return {
    orderId: cleanPremiumText(order.orderId || "", 160),
    billCode: cleanPremiumText(order.billCode || "", 120),
    activationCode: code,
    codeHash: cleanPremiumText(order.activationCodeHash || azSubCodeHash(code), 100),
    codeStatus: cleanPremiumText(order.activationCodeStatus || order.codeStatus || "active", 40),
    status: cleanPremiumText(order.status || "", 40),
    productId: order.productId || order.product?.productId || order.product?.id || "",
    productName: order.productName || order.product?.name || "",
    plan: order.subscriptionPlanLabel || order.subscriptionPlan?.label || "",
    planId: order.subscriptionPlanId || order.subscriptionPlan?.id || "",
    months: Number(order.subscriptionMonths || order.subscriptionPlan?.months || 0) || 0,
    buyerEmail: azSubBuyerEmail(order),
    username: azSubUsername(order),
    expiresAt: order.activationCodeExpiresAt || (expMs ? new Date(expMs).toISOString() : ""),
    expiresAtMs: expMs,
    activeDeviceMasked: azSubMaskDevice(order.activeDeviceId || ""),
    previousDeviceMasked: azSubMaskDevice(order.previousDeviceId || ""),
    deviceLimit: Number(order.deviceLimit || AZOBSS_BACKEND_SUB_DEVICE_LIMIT) || AZOBSS_BACKEND_SUB_DEVICE_LIMIT,
    transferCountThisYear: azSubTransferCount(order, yearKey),
    transferLimitPerYear: Number(order.transferLimitPerYear || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT) || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT,
    activatedAt: order.activatedAt || "",
    lastVerifiedAt: order.lastVerifiedAt || "",
    createdAt: order.createdAt || "",
    updatedAt: order.updatedAt || "",
    source: cleanPremiumText(order.source || "", 80)
  };
}
function azSubIsSaleProduct(product = {}, data = {}) {
  return !!(
    product.subscriptionCodeEnabled || product.subscriptionProduct || product.activationCodeSale ||
    data.subscriptionCodeEnabled || data.subscriptionProduct || data.activationCodeSale ||
    data.subscriptionPlanId || product.subscriptionPlanId || product.subscriptionPlan
  );
}
function azSubPatchFromProduct(product = {}, data = {}) {
  const plan = azSubPlanById(data.subscriptionPlanId || product.subscriptionPlanId || data.subscriptionPlan?.id || product.subscriptionPlan?.id || product.subscriptionMonths || data.subscriptionMonths || "1m");
  const durationDays = Math.max(1, Number(data.subscriptionDurationDays || product.subscriptionDurationDays || plan.durationDays || 31) || 31);
  const prefix = cleanPremiumText(data.activationCodePrefix || product.activationCodePrefix || product.subscriptionCodePrefix || "AZOBSS", 18).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "AZOBSS";
  return {
    subscriptionCodeEnabled:true,
    subscriptionProduct:true,
    activationCodeSale:true,
    subscriptionPlan:plan,
    subscriptionPlanId:plan.id,
    subscriptionPlanLabel:data.subscriptionPlanLabel || product.subscriptionPlanLabel || plan.label,
    subscriptionMonths:Number(data.subscriptionMonths || product.subscriptionMonths || plan.months || 1) || 1,
    subscriptionDurationDays:durationDays,
    subscriptionMonthlyText:data.subscriptionMonthlyText || product.subscriptionMonthlyText || plan.monthlyText,
    subscriptionSaveText:data.subscriptionSaveText || product.subscriptionSaveText || plan.saveText,
    activationCodePrefix:prefix,
    deviceLimit:AZOBSS_BACKEND_SUB_DEVICE_LIMIT,
    transferLimitPerYear:AZOBSS_BACKEND_SUB_TRANSFER_LIMIT,
    graceDays:AZOBSS_BACKEND_SUB_GRACE_DAYS
  };
}
function azSubLocalUpsert(order = {}) {
  const saved = upsertPremiumOrder(order);
  return saved || order;
}
async function azSubPersist(order = {}) {
  try {
    const db = getAzobssBackendDb();
    if (!db) return { ok:false, reason:"firebase-not-ready" };
    const code = azSubCleanCode(order.activationCode || "");
    const hash = cleanPremiumText(order.activationCodeHash || azSubCodeHash(code), 100);
    const docId = hash || cleanPremiumText(order.orderId || code || ("sub_" + Date.now()), 180);
    const safe = { ...order, activationCode:code, activationCodeHash:hash, updatedAt:new Date().toISOString(), updatedAtMs:Date.now(), subscriptionLicenseVersion:412 };
    await db.collection("subscriptionCodes").doc(docId).set(safe, { merge:true });
    if (order.orderId) await db.collection("premiumOrders").doc(cleanPremiumText(order.orderId, 180)).set(safe, { merge:true }).catch(()=>{});
    return { ok:true, docId };
  } catch (err) {
    console.warn("AZOBSS backend/server subscription persist failed:", err && (err.message || err));
    return { ok:false, error:err && err.message ? err.message : String(err) };
  }
}
async function azSubSave(order = {}, patch = {}) {
  const merged = {
    ...order,
    ...patch,
    activationCode: azSubCleanCode(patch.activationCode || order.activationCode || ""),
    activationCodeHash: patch.activationCodeHash || order.activationCodeHash || azSubCodeHash(patch.activationCode || order.activationCode || ""),
    subscriptionCodeEnabled:true,
    activationCodeSale:true,
    deviceLimit:Number(patch.deviceLimit || order.deviceLimit || AZOBSS_BACKEND_SUB_DEVICE_LIMIT) || AZOBSS_BACKEND_SUB_DEVICE_LIMIT,
    transferLimitPerYear:Number(patch.transferLimitPerYear || order.transferLimitPerYear || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT) || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT,
    graceDays:AZOBSS_BACKEND_SUB_GRACE_DAYS,
    updatedAt:new Date().toISOString(),
    updatedAtMs:Date.now()
  };
  const saved = azSubLocalUpsert(merged);
  azSubPersist(saved);
  return saved;
}
async function azSubFindByCode(code = "") {
  const safe = azSubCleanCode(code);
  const hash = azSubCodeHash(safe);
  const rows = [];
  const push = (x, source="") => { if (x && typeof x === "object") rows.push({ ...x, _source:source || x._source || "" }); };

  try { readPremiumOrders().forEach(x => push(x, "local-premiumOrders")); } catch (_) {}

  const db = getAzobssBackendDb();
  if (db) {
    try {
      const doc = await db.collection("subscriptionCodes").doc(hash).get();
      if (doc.exists) push({ docId:doc.id, ...(doc.data() || {}) }, "firestore-subscriptionCodes-doc");
    } catch (err) { console.warn("subscriptionCodes doc lookup skipped:", err && (err.message || err)); }
    try {
      const snap = await db.collection("subscriptionCodes").where("activationCode", "==", safe).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-subscriptionCodes-code"));
    } catch (err) { console.warn("subscriptionCodes code lookup skipped:", err && (err.message || err)); }
    try {
      const snap = await db.collection("premiumOrders").where("activationCodeHash", "==", hash).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders-hash"));
    } catch (err) { console.warn("premiumOrders hash lookup skipped:", err && (err.message || err)); }
    try {
      const snap = await db.collection("premiumOrders").where("activationCode", "==", safe).limit(5).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders-code"));
    } catch (err) { console.warn("premiumOrders code lookup skipped:", err && (err.message || err)); }
  }

  const seen = new Set();
  const filtered = rows.filter(x => {
    const ok = azSubCleanCode(x.activationCode || "") === safe || cleanPremiumText(x.activationCodeHash || "", 100) === hash;
    if (!ok) return false;
    const key = String(x.orderId || x.billCode || x.docId || x.activationCodeHash || x.activationCode || Math.random());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  filtered.sort((a,b) => Number(b.updatedAtMs || b.createdAtMs || b.activationCodeIssuedAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || a.activationCodeIssuedAtMs || 0));
  return filtered[0] || null;
}
async function azSubFindByRef(ref = {}) {
  const code = azSubCleanCode(ref.activationCode || ref.code || "");
  if (code) return await azSubFindByCode(code);
  const orderId = cleanPremiumText(ref.orderId || "", 180);
  const billCode = cleanPremiumText(ref.billCode || "", 120);
  if (orderId || billCode) {
    const local = findPremiumOrderByAny({ orderId, billCode });
    if (local) return local;
    const db = getAzobssBackendDb();
    if (db && orderId) {
      try {
        const doc = await db.collection("premiumOrders").doc(orderId).get();
        if (doc.exists) return { docId:doc.id, ...(doc.data() || {}) };
      } catch (_) {}
    }
  }
  return null;
}
async function azSubAdminList(search = "", limitRows = 300) {
  const out = [];
  const push = (x, source="") => { if (x && (x.activationCode || x.activationCodeHash || x.subscriptionCodeEnabled || x.activationCodeSale)) out.push({ ...x, _source:source }); };
  try { readPremiumOrders().forEach(x => push(x, "local-premiumOrders")); } catch (_) {}
  const db = getAzobssBackendDb();
  if (db) {
    try {
      const snap = await db.collection("subscriptionCodes").limit(Math.min(500, limitRows)).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-subscriptionCodes"));
    } catch (err) { console.warn("subscriptionCodes list skipped:", err && (err.message || err)); }
    try {
      const snap = await db.collection("premiumOrders").limit(Math.min(500, limitRows)).get();
      snap.forEach(d => push({ docId:d.id, ...(d.data() || {}) }, "firestore-premiumOrders"));
    } catch (err) { console.warn("premiumOrders list skipped:", err && (err.message || err)); }
  }

  const q = String(search || "").trim().toLowerCase();
  const seen = new Set();
  const filtered = [];
  for (const x of out) {
    const key = String(x.orderId || x.billCode || x.docId || x.activationCodeHash || x.activationCode || Math.random());
    if (seen.has(key)) continue;
    seen.add(key);
    const hay = [
      x.activationCode, x.activationCodeHash, x.orderId, x.billCode, x.productId, x.productName,
      x.buyerEmail, x.email, x.username, x.usernameKey, x.user?.email, x.user?.username, x.activationCodeStatus
    ].map(v => String(v || "").toLowerCase()).join(" ");
    if (q && !hay.includes(q)) continue;
    filtered.push(x);
  }
  filtered.sort((a,b) => Number(b.updatedAtMs || b.createdAtMs || b.activationCodeIssuedAtMs || 0) - Number(a.updatedAtMs || a.createdAtMs || a.activationCodeIssuedAtMs || 0));
  return filtered.slice(0, limitRows).map(azSubAdminRow);
}
async function azSubEnsurePaidOrderCode(order = {}) {
  if (!order || order.activationCode) return order;
  const product = order.product || {};
  if (!azSubIsSaleProduct(product, order)) return order;
  const patch = azSubPatchFromProduct(product, order);
  const paidMs = Date.now();
  const expiresAtMs = paidMs + Math.max(1, Number(patch.subscriptionDurationDays || 31) || 31) * 86400000;
  const code = azSubMakeCode(patch.activationCodePrefix || "AZOBSS", patch.subscriptionPlanId || "1m");
  return await azSubSave(order, {
    ...patch,
    activationCode:code,
    activationCodeHash:azSubCodeHash(code),
    activationCodeStatus:"active",
    activationCodeIssuedAt:new Date(paidMs).toISOString(),
    activationCodeIssuedAtMs:paidMs,
    activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
    activationCodeExpiresAtMs:expiresAtMs,
    activeDeviceId:"",
    previousDeviceId:"",
    transferCountByYear:{},
    deviceTransferHistory:[],
    subscriptionLicenseVersion:412
  });
}

async function azSubVerifyHandler(req, res) {
  try {
    const body = req.method === "POST" ? (req.body || {}) : {};
    const code = azSubCleanCode(body.code || req.query.code || body.activationCode || req.query.activationCode || "");
    const productId = cleanPremiumText(body.productId || req.query.productId || "", 180);
    const deviceId = azSubCleanDevice(body.deviceId || body.machineId || body.hardwareId || req.query.deviceId || req.query.machineId || req.query.hardwareId || "");
    const appVersion = cleanPremiumText(body.appVersion || req.query.appVersion || "", 80);
    const reqEmail = azSubCleanEmail(body.email || body.buyerEmail || body.userEmail || req.query.email || req.query.buyerEmail || req.query.userEmail || "");
    const reqUsername = azSubCleanUsername(body.username || body.usernameKey || req.query.username || req.query.usernameKey || "");
    const transfer = body.transfer === true || body.confirmTransfer === true || ["true","1","yes"].includes(String(body.transfer || req.query.transfer || body.confirmTransfer || req.query.confirmTransfer || "").toLowerCase());

    if (!code) return res.status(400).json({ ok:false, valid:false, pro:false, status:"missing_code", error:"Activation code is required." });

    let order = await azSubFindByCode(code);
    if (!order) return res.status(404).json({ ok:true, valid:false, pro:false, status:"not_found", reason:"not_found", error:"Activation code not found." });

    if (productId && ![order.productId, order.product?.productId, order.product?.id].some(v => String(v || "") === productId)) {
      return res.json(azSubPublic(order, { valid:false, status:"product_mismatch", reason:"product_mismatch", message:"This activation code is for a different product.", deviceId }));
    }

    const orderEmail = azSubBuyerEmail(order);
    if (orderEmail && reqEmail && orderEmail !== reqEmail) {
      return res.json(azSubPublic(order, { valid:false, status:"email_mismatch", reason:"email_mismatch", message:"This activation code belongs to a different email/account.", deviceId }));
    }
    const orderUsername = azSubUsername(order);
    if (orderUsername && reqUsername && orderUsername !== reqUsername) {
      return res.json(azSubPublic(order, { valid:false, status:"account_mismatch", reason:"account_mismatch", message:"This activation code belongs to a different username/account.", deviceId }));
    }

    const codeStatus = String(order.activationCodeStatus || order.codeStatus || "active").toLowerCase();
    if (["revoked", "disabled", "blocked", "suspended"].includes(codeStatus)) {
      return res.json(azSubPublic(order, { valid:false, status:codeStatus, reason:codeStatus, message:"This activation code has been disabled by admin.", deviceId }));
    }

    const paid = ["paid","active","success","completed","verified"].includes(String(order.status || "").toLowerCase()) || order.isPaid === true || order.manualSubscriptionCode === true;
    const expMs = Number(order.activationCodeExpiresAtMs || 0) || azSubExpiryMs(order.activationCodeExpiresAt);
    if (!paid) return res.json(azSubPublic(order, { valid:false, status:"not_paid", reason:"not_paid", message:"Payment is not verified for this activation code.", deviceId }));
    if (expMs && Date.now() > expMs) return res.json(azSubPublic(order, { valid:false, status:"expired", reason:"expired", message:"Subscription expired.", deviceId }));
    if (!deviceId) return res.json(azSubPublic(order, { valid:false, status:"device_required", reason:"device_required", message:"Device ID is required to activate Pro version.", deviceId }));

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const activeDevice = azSubCleanDevice(order.activeDeviceId || "");
    const yearKey = azSubYearKey(nowMs);
    const transferLimit = Number(order.transferLimitPerYear || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT) || AZOBSS_BACKEND_SUB_TRANSFER_LIMIT;
    const transferCount = azSubTransferCount(order, yearKey);

    if (!activeDevice) {
      order = await azSubSave(order, {
        activeDeviceId:deviceId,
        activatedAt:order.activatedAt || nowIso,
        activatedAtMs:order.activatedAtMs || nowMs,
        lastVerifiedAt:nowIso,
        lastVerifiedAtMs:nowMs,
        lastVerifiedDeviceId:deviceId,
        lastVerifiedAppVersion:appVersion,
        activationCodeStatus:"active"
      });
      return res.json(azSubPublic(order, { valid:true, status:"active", reason:"activated", message:"Subscription activated on this device.", deviceId }));
    }

    if (activeDevice === deviceId) {
      order = await azSubSave(order, {
        lastVerifiedAt:nowIso,
        lastVerifiedAtMs:nowMs,
        lastVerifiedDeviceId:deviceId,
        lastVerifiedAppVersion:appVersion,
        activationCodeStatus:"active"
      });
      return res.json(azSubPublic(order, { valid:true, status:"active", reason:"same_device", message:"Subscription active on this device.", deviceId }));
    }

    if (!transfer) {
      return res.json(azSubPublic(order, {
        valid:false,
        status:"transfer_required",
        reason:"active_on_other_device",
        message:"This activation code is already active on another device. Confirm transfer to use it on this PC.",
        transferRequired:true,
        transferAllowed:transferCount < transferLimit,
        deviceId
      }));
    }

    if (transferCount >= transferLimit) {
      return res.json(azSubPublic(order, {
        valid:false,
        status:"transfer_limit_reached",
        reason:"transfer_limit_reached",
        message:"Transfer limit reached for this year. Please contact admin to reset the device.",
        transferRequired:true,
        transferAllowed:false,
        deviceId
      }));
    }

    const history = Array.isArray(order.deviceTransferHistory) ? order.deviceTransferHistory.slice(-30) : [];
    history.push({
      fromDeviceId:activeDevice,
      toDeviceId:deviceId,
      fromDeviceMasked:azSubMaskDevice(activeDevice),
      toDeviceMasked:azSubMaskDevice(deviceId),
      transferAt:nowIso,
      transferAtMs:nowMs,
      appVersion,
      requestEmail:reqEmail,
      requestUsername:reqUsername
    });
    const byYear = order.transferCountByYear && typeof order.transferCountByYear === "object" ? { ...order.transferCountByYear } : {};
    byYear[yearKey] = transferCount + 1;

    order = await azSubSave(order, {
      previousDeviceId:activeDevice,
      activeDeviceId:deviceId,
      lastVerifiedAt:nowIso,
      lastVerifiedAtMs:nowMs,
      lastVerifiedDeviceId:deviceId,
      lastVerifiedAppVersion:appVersion,
      activationCodeStatus:"active",
      deviceTransferHistory:history,
      transferCountByYear:byYear,
      lastTransferAt:nowIso,
      lastTransferAtMs:nowMs
    });
    return res.json(azSubPublic(order, { valid:true, status:"active", reason:"transferred", message:"Subscription transferred to this device. The old device is revoked.", deviceId }));
  } catch (err) {
    return res.status(500).json({ ok:false, valid:false, pro:false, status:"server_error", error:err && err.message ? err.message : String(err) });
  }
}

app.get("/api/subscription/health", (req, res) => res.json({
  ok:true,
  service:"azobss-backend",
  patch:"413",
  route:"subscription",
  runningFile:"backend/server.js",
  verify:"/api/subscription/verify",
  time:new Date().toISOString()
}));

app.all("/api/subscription/verify", azSubVerifyHandler);

app.post("/api/subscription/admin/create-code", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const productId = cleanPremiumText(body.productId || "", 180);
    const productName = cleanPremiumText(body.productName || body.name || productId || "AZOBSS Software", 220);
    const buyerEmail = azSubCleanEmail(body.buyerEmail || body.email || "");
    const username = azSubCleanUsername(body.username || body.usernameKey || "");
    if (!productId) return res.status(400).json({ ok:false, error:"Product ID is required." });
    if (!buyerEmail) return res.status(400).json({ ok:false, error:"Buyer email is required." });

    const plan = azSubPlanById(body.planId || body.subscriptionPlanId || body.months || "1m");
    const nowMs = Date.now();
    const expiresAtMs = nowMs + Math.max(1, Number(plan.durationDays || 31) || 31) * 86400000;
    const prefix = cleanPremiumText(body.activationCodePrefix || body.prefix || "AZOBSS", 18).toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "AZOBSS";
    const activationCode = azSubMakeCode(prefix, plan.id);
    const orderId = cleanPremiumText(body.orderId || makePremiumId("sub"), 160);

    const order = await azSubSave({
      orderId,
      billCode:cleanPremiumText(body.billCode || "", 120),
      productId,
      productName,
      product:{ productId, id:productId, name:productName, subscriptionCodeEnabled:true, activationCodeSale:true, activationCodePrefix:prefix },
      amount:plan.price,
      amountSen:Number(plan.priceSen || 0) || 0,
      saleAmount:Number(plan.priceSen || 0) / 100,
      saleAmountText:plan.price,
      status:"paid",
      isPaid:true,
      paymentMethod:"manual-subscription-code",
      paymentReference:cleanPremiumText(body.paymentReference || "admin-manual-code", 160),
      source:"admin-manual-subscription-code",
      manualSubscriptionCode:true,
      subscriptionCodeEnabled:true,
      activationCodeSale:true,
      subscriptionPlan:plan,
      subscriptionPlanId:plan.id,
      subscriptionPlanLabel:plan.label,
      subscriptionDurationDays:plan.durationDays,
      subscriptionMonths:plan.months,
      activationCodePrefix:prefix,
      activationCode,
      activationCodeHash:azSubCodeHash(activationCode),
      activationCodeStatus:"active",
      activationCodeIssuedAt:new Date(nowMs).toISOString(),
      activationCodeIssuedAtMs:nowMs,
      activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
      activationCodeExpiresAtMs:expiresAtMs,
      activeDeviceId:"",
      previousDeviceId:"",
      deviceLimit:AZOBSS_BACKEND_SUB_DEVICE_LIMIT,
      transferLimitPerYear:AZOBSS_BACKEND_SUB_TRANSFER_LIMIT,
      transferCountByYear:{},
      deviceTransferHistory:[],
      graceDays:AZOBSS_BACKEND_SUB_GRACE_DAYS,
      buyerEmail,
      email:buyerEmail,
      username,
      usernameKey:username,
      user:{ email:buyerEmail, username, usernameKey:username },
      adminNote:cleanPremiumText(body.note || body.adminNote || "", 500),
      createdByAdmin:req.azobssAdminIdentity?.username || req.azobssAdminIdentity?.email || "admin",
      createdAt:new Date(nowMs).toISOString(),
      createdAtMs:nowMs,
      paidAt:new Date(nowMs).toISOString(),
      paidAtMs:nowMs
    });
    return res.json({ ok:true, code:activationCode, activationCode, verifyApi:"https://azobss-backend.onrender.com/api/subscription/verify", record:azSubAdminRow(order) });
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err) });
  }
});

app.get("/api/subscription/admin/list", requireAdmin, async (req, res) => {
  try {
    const search = cleanPremiumText(req.query.search || req.query.q || "", 160);
    const limitRows = Math.max(1, Math.min(500, Number(req.query.limit || 250) || 250));
    const records = await azSubAdminList(search, limitRows);
    return res.json({ ok:true, count:records.length, records });
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err), records:[] });
  }
});

app.post("/api/subscription/admin/reset-device", requireAdmin, async (req, res) => {
  try {
    const order = await azSubFindByRef(req.body || {});
    if (!order) return res.status(404).json({ ok:false, error:"Subscription code not found." });
    const oldDevice = azSubCleanDevice(order.activeDeviceId || "");
    const saved = await azSubSave(order, {
      previousDeviceId:oldDevice || order.previousDeviceId || "",
      activeDeviceId:"",
      lastDeviceResetAt:new Date().toISOString(),
      lastDeviceResetAtMs:Date.now(),
      lastDeviceResetBy:req.azobssAdminIdentity?.username || req.azobssAdminIdentity?.email || "admin",
      lastDeviceResetReason:cleanPremiumText(req.body?.reason || "admin reset", 300)
    });
    return res.json({ ok:true, action:"reset-device", record:azSubAdminRow(saved) });
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err) });
  }
});

app.post("/api/subscription/admin/revoke", requireAdmin, async (req, res) => {
  try {
    const order = await azSubFindByRef(req.body || {});
    if (!order) return res.status(404).json({ ok:false, error:"Subscription code not found." });
    const status = String(req.body?.status || req.body?.activationCodeStatus || "revoked").toLowerCase() === "active" ? "active" : "revoked";
    const saved = await azSubSave(order, {
      activationCodeStatus:status,
      revokedAt:status === "revoked" ? new Date().toISOString() : (order.revokedAt || ""),
      revokedAtMs:status === "revoked" ? Date.now() : (order.revokedAtMs || 0),
      revokedBy:status === "revoked" ? (req.azobssAdminIdentity?.username || req.azobssAdminIdentity?.email || "admin") : (order.revokedBy || ""),
      revokeReason:cleanPremiumText(req.body?.reason || req.body?.revokeReason || "", 300)
    });
    return res.json({ ok:true, action:status === "active" ? "reactivate" : "revoke", record:azSubAdminRow(saved) });
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err) });
  }
});

app.post("/api/subscription/admin/extend", requireAdmin, async (req, res) => {
  try {
    const order = await azSubFindByRef(req.body || {});
    if (!order) return res.status(404).json({ ok:false, error:"Subscription code not found." });
    const days = Math.max(1, Math.min(3660, Number(req.body?.days || req.body?.extendDays || 0) || 0));
    if (!days) return res.status(400).json({ ok:false, error:"Enter extend days." });
    const currentExp = Number(order.activationCodeExpiresAtMs || 0) || azSubExpiryMs(order.activationCodeExpiresAt) || Date.now();
    const base = Math.max(currentExp, Date.now());
    const expiresAtMs = base + days * 86400000;
    const saved = await azSubSave(order, {
      activationCodeExpiresAt:new Date(expiresAtMs).toISOString(),
      activationCodeExpiresAtMs:expiresAtMs,
      lastExtendedAt:new Date().toISOString(),
      lastExtendedAtMs:Date.now(),
      lastExtendedBy:req.azobssAdminIdentity?.username || req.azobssAdminIdentity?.email || "admin",
      lastExtendedDays:days
    });
    return res.json({ ok:true, action:"extend", days, record:azSubAdminRow(saved) });
  } catch (err) {
    return res.status(500).json({ ok:false, error:err && err.message ? err.message : String(err) });
  }
});


// Legacy /api/create-toyyib-bill removed. Use /api/toyyib/create-bill.

app.use((err, req, res, next) => {
  res.status(400).json({ ok: false, error: err.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`AZOBSS Lucky Draw Backend running on port ${PORT}`);
  console.log("AZOBSS_PATCH: 424-payment-logs-delete-backend-entrypoints");
});
