
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

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.join(UPLOAD_DIR, "lucky-draw"), { recursive: true });

app.use(cors({
  origin(origin, cb) {
    if (!origin || CORS_ORIGIN.includes("*") || CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, false);
  }
}));

app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", etag: true }));

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

app.get("/api/lucky-draw/prize", (req, res) => {
  const key = req.query.monthKey || monthKey();
  const prize = readJson(getPrizeFile(key), {
    monthKey: key,
    title: "Hadiah belum diumumkan",
    description: "Admin belum upload hadiah Giveaway bulan ini.",
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
    : (previous.imageUrl || "");

  const prize = {
    monthKey: key,
    title: req.body.title || previous.title || "Hadiah Giveaway",
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
        description: "Admin belum upload hadiah Giveaway bulan ini.",
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
  const usernameKey = String(req.body.usernameKey || "").trim();
  if (!usernameKey) return res.status(400).json({ ok: false, error: "usernameKey required" });

  const existingIndex = entries.findIndex((e) => e.usernameKey === usernameKey && e.monthKey === key);
  const entry = {
    id: `${key}_${usernameKey}`,
    monthKey: key,
    usernameKey,
    uid: req.body.uid || "",
    name: req.body.name || usernameKey,
    phone: req.body.phone || "",
    contactEmail: req.body.contactEmail || "",
    inviteCode: req.body.inviteCode || "",
    inviteUrl: req.body.inviteUrl || "",
    joinedAtMs: Date.now(),
    joinedAt: new Date().toISOString(),
    deleted: false
  };

  if (existingIndex >= 0) entries[existingIndex] = { ...entries[existingIndex], ...entry };
  else entries.push(entry);

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
