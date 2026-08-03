// AZOBSS Cloudflare R2 Download + Tech Vault Upload/Delete Gateway - Patch 719
// Required existing bindings:
//   R2 bucket binding: AZOBSS_FILES
//   Worker secret:     AZOBSS_R2_TOKEN_SECRET
// Optional Worker variable:
//   AZOBSS_BACKEND_SYNC_URL=https://azobss-backend.onrender.com/api/premium/r2-usage-sync

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_BACKEND_SYNC_URL = "https://azobss-backend.onrender.com/api/premium/r2-usage-sync";
const DELIVERY_TTL_SECONDS = 2 * 60 * 60;
const ALLOWED_PREFIXES = ["software/", "cad/", "tech-vault/"];
const TECH_VAULT_MAX_BYTES = 250 * 1024 * 1024;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if (url.pathname === "/health") {
        return json({
          ok: true,
          patch: "AZOBSS_R2_WORKER_TECH_VAULT_DELETE_719_20260803",
          bucketBinding: Boolean(env.AZOBSS_FILES),
          tokenSecretConfigured: Boolean(env.AZOBSS_R2_TOKEN_SECRET),
          directGate: true,
          rangeSupported: true,
          techVaultUpload: true,
          techVaultDelete: true,
          allowedPrefixes: ALLOWED_PREFIXES
        });
      }


      if (url.pathname.startsWith("/vault-upload/")) {
        return await handleVaultUpload(request, env, url);
      }

      if (url.pathname.startsWith("/vault-delete/")) {
        return await handleVaultDelete(request, env, url);
      }

      if (url.pathname.startsWith("/gate/")) {
        return await handleGate(request, env, ctx, url);
      }

      if (url.pathname.startsWith("/dl/")) {
        return await handleDownload(request, env, url);
      }

      return text("AZOBSS private download gateway", 200);
    } catch (error) {
      const vaultWriteRequest = (() => { try { const p = new URL(request.url).pathname; return p.startsWith("/vault-upload/") || p.startsWith("/vault-delete/"); } catch (_) { return false; } })();
      const extra = vaultWriteRequest ? Object.fromEntries(corsHeaders()) : {};
      return text(error?.message || "Gateway error", Number(error?.status || 500), extra);
    }
  }
};



async function handleVaultDelete(request, env, url) {
  ensureConfigured(env);
  if (!["DELETE", "POST"].includes(request.method)) return text("Method not allowed", 405, { Allow:"DELETE, POST, OPTIONS", ...Object.fromEntries(corsHeaders()) });
  const signed = decodeURIComponent(url.pathname.slice("/vault-delete/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "vault-delete") throw httpError(403, "Invalid Tech Vault delete token.");
  validateObjectKey(payload.key);
  if (!String(payload.key || "").toLowerCase().startsWith("tech-vault/")) throw httpError(403, "Tech Vault object key is required.");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "Delete token expired.");
  await env.AZOBSS_FILES.delete(payload.key);
  return json({ ok:true, deleted:true, key:payload.key, id:cleanText(payload.id || "", 120), patch:"719" }, 200, corsHeaders());
}

async function handleVaultUpload(request, env, url) {
  ensureConfigured(env);
  if (request.method !== "PUT") return text("Method not allowed", 405, { Allow: "PUT, OPTIONS", ...Object.fromEntries(corsHeaders()) });
  const signed = decodeURIComponent(url.pathname.slice("/vault-upload/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "vault-upload") throw httpError(403, "Invalid Tech Vault upload token.");
  validateObjectKey(payload.key);
  if (!String(payload.key || "").toLowerCase().startsWith("tech-vault/")) throw httpError(403, "Tech Vault object key is required.");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "Upload token expired.");
  const expectedSize = Number(payload.size || 0);
  if (!Number.isFinite(expectedSize) || expectedSize <= 0 || expectedSize > TECH_VAULT_MAX_BYTES) throw httpError(413, "Invalid or excessive file size.");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength && contentLength !== expectedSize) throw httpError(400, "Uploaded file size does not match the signed request.");
  if (!request.body) throw httpError(400, "Upload body is empty.");
  const name = safeFilename(payload.name || "AZOBSS-Tool.bat");
  if (!/\.bat$/i.test(name)) throw httpError(400, "Only BAT files are allowed in Tech Vault.");
  const contentType = cleanText(request.headers.get("content-type") || payload.type || "application/x-bat", 120);
  const stored = await env.AZOBSS_FILES.put(payload.key, request.body, {
    httpMetadata: { contentType, cacheControl: "private, no-store" },
    customMetadata: {
      purpose: "azobss-tech-vault",
      originalFilename: name,
      uploadId: cleanText(payload.id || "", 120),
      patch: "719"
    }
  });
  const storedSize = Number(stored?.size || 0);
  if (storedSize > TECH_VAULT_MAX_BYTES || (storedSize > 0 && storedSize !== expectedSize)) {
    await env.AZOBSS_FILES.delete(payload.key);
    throw httpError(storedSize > TECH_VAULT_MAX_BYTES ? 413 : 400, "Stored file size did not match the signed upload request.");
  }
  return json({ ok:true, key:payload.key, name, size:storedSize || expectedSize, etag:stored?.httpEtag || "", patch:"719" }, 200, corsHeaders());
}

async function handleGate(request, env, ctx, url) {
  ensureConfigured(env);
  const signed = decodeURIComponent(url.pathname.slice("/gate/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "gate") throw httpError(403, "Invalid confirmation token.");
  validateObjectKey(payload.key);

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "This download link has expired.");

  const max = clampInt(payload.max, 1, 100, 1);
  const startingUsed = clampInt(payload.used, 0, max, 0);
  const usageId = safeUsageId(payload.tid || await sha256Hex(signed));
  const usage = await readUsage(env, usageId, startingUsed, max);
  const used = Math.max(startingUsed, clampInt(usage.usedCount, 0, max, 0));

  if (request.method === "GET" || request.method === "HEAD") {
    const expired = used >= max;
    const page = gateHtml({
      title: payload.title || payload.name || "AZOBSS Digital Product",
      used,
      max,
      expiresAt: payload.exp,
      expired,
      action: url.pathname
    });
    return new Response(request.method === "HEAD" ? null : page, {
      status: expired ? 410 : 200,
      headers: htmlHeaders()
    });
  }

  if (request.method !== "POST") return text("Method not allowed", 405, { Allow: "GET, HEAD, POST" });
  if (used >= max) throw httpError(410, "Download limit has been reached.");

  const nextUsed = used + 1;
  await writeUsage(env, usageId, {
    usedCount: nextUsed,
    maxDownload: max,
    orderId: cleanText(payload.oid, 180),
    productId: cleanText(payload.pid, 180),
    objectKey: payload.key,
    updatedAt: new Date().toISOString(),
    updatedAtMs: Date.now()
  });

  const deliveryPayload = {
    key: payload.key,
    name: safeFilename(payload.name || payload.title || "AZOBSS-Download.bin"),
    exp: Math.min(payload.exp, now + DELIVERY_TTL_SECONDS),
    sid: usageId,
    oid: cleanText(payload.oid, 180)
  };
  const deliveryToken = await signPayload(deliveryPayload, env.AZOBSS_R2_TOKEN_SECRET);

  if (payload.bt) {
    ctx.waitUntil(syncUsageToBackend(env, {
      token: cleanText(payload.bt, 220),
      usedCount: nextUsed,
      maxDownload: max,
      usageId,
      orderId: cleanText(payload.oid, 180),
      updatedAtMs: Date.now()
    }));
  }

  return new Response(null, {
    status: 303,
    headers: noStoreHeaders({
      Location: `${url.origin}/dl/${encodeURIComponent(deliveryToken)}`,
      "X-AZOBSS-Download-Mode": "r2-worker-direct-gate"
    })
  });
}

async function handleDownload(request, env, url) {
  ensureConfigured(env);
  if (!["GET", "HEAD"].includes(request.method)) return text("Method not allowed", 405, { Allow: "GET, HEAD" });

  const signed = decodeURIComponent(url.pathname.slice("/dl/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  validateObjectKey(payload.key);

  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "Temporary download link expired.");

  const rangeHeader = request.headers.get("Range");
  const options = rangeHeader ? { range: request.headers } : {};
  const object = await env.AZOBSS_FILES.get(payload.key, options);
  if (!object) throw httpError(404, "Private file not found.");

  const headers = noStoreHeaders();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Disposition", contentDisposition(payload.name || payload.key.split("/").pop()));
  headers.set("X-AZOBSS-Download-Mode", "cloudflare-r2");

  let status = 200;
  if (object.range) {
    status = 206;
    const start = Number(object.range.offset || 0);
    const length = Number(object.range.length || 0);
    const end = start + Math.max(0, length - 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
    headers.set("Content-Length", String(length));
  } else {
    headers.set("Content-Length", String(object.size));
  }

  return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
}

async function readUsage(env, usageId, startingUsed, max) {
  const key = `__azobss_usage/${usageId}.json`;
  const object = await env.AZOBSS_FILES.get(key);
  if (!object) return { usedCount: startingUsed, maxDownload: max };
  try {
    const data = await object.json();
    return data && typeof data === "object" ? data : { usedCount: startingUsed, maxDownload: max };
  } catch {
    return { usedCount: startingUsed, maxDownload: max };
  }
}

async function writeUsage(env, usageId, data) {
  const key = `__azobss_usage/${usageId}.json`;
  await env.AZOBSS_FILES.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json; charset=utf-8", cacheControl: "no-store" },
    customMetadata: { purpose: "azobss-private-download-usage", patch: "707" }
  });
}

async function syncUsageToBackend(env, data) {
  const endpoint = String(env.AZOBSS_BACKEND_SYNC_URL || DEFAULT_BACKEND_SYNC_URL).trim();
  if (!endpoint || !env.AZOBSS_R2_TOKEN_SECRET) return;
  const raw = JSON.stringify(data);
  const signature = await hmacBase64Url(raw, env.AZOBSS_R2_TOKEN_SECRET);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-azobss-r2-signature": signature
      },
      body: raw,
      signal: controller.signal
    });
  } catch {
    // Customer delivery must never wait for Render usage synchronization.
  } finally {
    clearTimeout(timer);
  }
}

async function verifySignedToken(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) throw httpError(403, "Invalid token.");
  const [payloadPart, suppliedSignature] = parts;
  const expectedSignature = await hmacBase64Url(payloadPart, secret);
  if (!timingSafeEqual(suppliedSignature, expectedSignature)) throw httpError(403, "Token verification failed.");
  let payload;
  try { payload = JSON.parse(decoder.decode(base64UrlDecode(payloadPart))); }
  catch { throw httpError(403, "Invalid token payload."); }
  return payload || {};
}

async function signPayload(payload, secret) {
  const payloadPart = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacBase64Url(payloadPart, secret);
  return `${payloadPart}.${signature}`;
}

async function hmacBase64Url(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(String(value || "")));
  return base64UrlEncode(new Uint8Array(signature));
}

async function sha256Hex(value) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value || ""))));
  return [...hash].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function ensureConfigured(env) {
  if (!env.AZOBSS_FILES) throw httpError(503, "R2 bucket binding AZOBSS_FILES is missing.");
  if (!env.AZOBSS_R2_TOKEN_SECRET) throw httpError(503, "Worker secret AZOBSS_R2_TOKEN_SECRET is missing.");
}

function validateObjectKey(key) {
  const value = String(key || "");
  if (!value || value.includes("..") || value.includes("\\") || !ALLOWED_PREFIXES.some(prefix => value.toLowerCase().startsWith(prefix))) {
    throw httpError(403, "Object key is not allowed.");
  }
}

function gateHtml({ title, used, max, expiresAt, expired, action }) {
  const expiry = new Date(Number(expiresAt || 0) * 1000).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
  const button = expired
    ? `<button class="btn disabled" disabled>Download Limit Reached</button>`
    : `<form method="POST" action="${escapeHtml(action)}"><button class="btn" type="submit">Start Download</button></form>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AZOBSS Download Ready</title><style>body{font-family:Arial,sans-serif;background:#0f172a;color:#e5e7eb;padding:24px}.box{max-width:680px;margin:40px auto;background:#111827;border:1px solid #334155;border-radius:18px;padding:28px}.btn{border:0;cursor:pointer;background:#16a34a;color:#fff;padding:14px 20px;border-radius:12px;font-weight:800;font-size:16px}.disabled{background:#64748b;cursor:not-allowed}.muted{color:#94a3b8}.warn{color:#fbbf24}.fast{color:#86efac;font-weight:700}</style></head><body><div class="box"><h1>AZOBSS Download Ready ✅</h1><p><b>Product:</b> ${escapeHtml(title)}</p><p class="fast">Private file is delivered directly by Cloudflare R2.</p>${button}<p class="warn">Download quota is counted once when Start Download is pressed. Browser/IDM Range requests do not add another count.</p><p class="muted">Used: ${used} / ${max}<br>Expires: ${escapeHtml(expiry)}</p></div></body></html>`;
}

function htmlHeaders() {
  return noStoreHeaders({ "content-type": "text/html; charset=utf-8", "x-frame-options": "DENY", "referrer-policy": "no-referrer" });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: noStoreHeaders({ "content-type": "application/json; charset=utf-8", ...Object.fromEntries(extraHeaders instanceof Headers ? extraHeaders : new Headers(extraHeaders)) }) });
}

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Content-Length",
    "Access-Control-Max-Age": "86400"
  });
}

function text(message, status = 200, extra = {}) {
  return new Response(String(message || ""), { status, headers: noStoreHeaders({ "content-type": "text/plain; charset=utf-8", ...extra }) });
}

function noStoreHeaders(extra = {}) {
  const headers = new Headers(extra);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

function contentDisposition(filename) {
  const safe = safeFilename(filename || "AZOBSS-Download.bin");
  return `attachment; filename="${safe.replace(/"/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function safeFilename(value) {
  return String(value || "AZOBSS-Download.bin").replace(/[\\/:*?"<>|\r\n\t]/g, "_").replace(/\s+/g, " ").slice(0, 180) || "AZOBSS-Download.bin";
}

function safeUsageId(value) {
  const safe = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
  if (!safe) throw httpError(403, "Invalid usage token.");
  return safe;
}

function cleanText(value, max = 200) {
  return String(value || "").replace(/[<>\r\n]/g, "").trim().slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function clampInt(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function timingSafeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
