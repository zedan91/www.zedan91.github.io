// AZOBSS Cloudflare R2 Download + Tech Vault + Sales PDF Share Gateway - Patch 735
// Required existing bindings:
//   R2 bucket binding: AZOBSS_FILES
//   Worker secret:     AZOBSS_R2_TOKEN_SECRET
// Optional Worker variable:
//   AZOBSS_BACKEND_SYNC_URL=https://azobss-backend.onrender.com/api/premium/r2-usage-sync

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_BACKEND_SYNC_URL = "https://azobss-backend.onrender.com/api/premium/r2-usage-sync";
const DELIVERY_TTL_SECONDS = 2 * 60 * 60;
const ALLOWED_PREFIXES = ["software/", "cad/", "tech-vault/", "sales-documents/"];
const TECH_VAULT_MAX_BYTES = 250 * 1024 * 1024;
const SALES_SHARE_MAX_BYTES = 50 * 1024 * 1024;

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      if(url.pathname==='/pc-diagnostics-storage')return await controlPcDiagnostics1590(request,env);
      if(url.pathname==='/pc-catalog-admin')return await controlPcCatalogue1537(request,env);
      if(url.pathname==='/software-availability-admin')return await controlAvailability1536(request,env);
      if(url.pathname==='/software-availability'&&request.method==='GET')return json(await publicAvailability1536(env));
      if (url.pathname === "/health") {
        return json({
          ok: true,
          patch: "AZOBSS_R2_WORKER_SALES_PDF_SHARE_735_20260804",
          bucketBinding: Boolean(env.AZOBSS_FILES),
          tokenSecretConfigured: Boolean(env.AZOBSS_R2_TOKEN_SECRET),
          directGate: true,
          softwarePause1534: true,
          softwareAvailabilityR2Store1536: true,
          pcCatalogVisibility1537: true,
          rangeSupported: true,
          techVaultUpload: true,
          techVaultDelete: true,
          salesPdfShare: true,
          allowedPrefixes: ALLOWED_PREFIXES
        });
      }



      if (url.pathname.startsWith("/sales-file-upload/")) {
        return await handleSalesFileUpload(request, env, url);
      }

      if (url.pathname.startsWith("/sales-file/")) {
        return await handleSalesFile(request, env, url);
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
      const vaultWriteRequest = (() => { try { const p = new URL(request.url).pathname; return p.startsWith("/vault-upload/") || p.startsWith("/vault-delete/") || p.startsWith("/sales-file-upload/"); } catch (_) { return false; } })();
      const extra = vaultWriteRequest ? Object.fromEntries(corsHeaders()) : {};
      return text(error?.message || "Gateway error", Number(error?.status || 500), extra);
    }
  }
};



async function handleSalesFileUpload(request, env, url) {
  ensureConfigured(env);
  if (request.method !== "PUT") return text("Method not allowed", 405, { Allow:"PUT, OPTIONS", ...Object.fromEntries(corsHeaders()) });
  const signed = decodeURIComponent(url.pathname.slice("/sales-file-upload/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "sales-file-upload") throw httpError(403, "Invalid sales document upload token.");
  validateObjectKey(payload.key);
  if (!String(payload.key || "").toLowerCase().startsWith("sales-documents/")) throw httpError(403, "Sales document object key is required.");
  const now = Math.floor(Date.now()/1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "Upload token expired.");
  const expectedSize = Number(payload.size || 0);
  if (!Number.isFinite(expectedSize) || expectedSize <= 0 || expectedSize > SALES_SHARE_MAX_BYTES) throw httpError(413, "Invalid or excessive document size.");
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength && contentLength !== expectedSize) throw httpError(400, "Uploaded document size does not match the signed request.");
  if (!request.body) throw httpError(400, "Upload body is empty.");
  const name = safeFilename(payload.name || "AZOBSS-Receipt.pdf");
  const signedType = cleanText(payload.type || "application/pdf", 120).toLowerCase();
  const isZip = signedType === "application/zip" || /\.zip$/i.test(name);
  const contentType = isZip ? "application/zip" : "application/pdf";
  if (isZip ? !/\.zip$/i.test(name) : !/\.pdf$/i.test(name)) throw httpError(400, "Only PDF documents or ZIP bundles are allowed.");
  const stored = await env.AZOBSS_FILES.put(payload.key, request.body, {
    httpMetadata:{ contentType, cacheControl:"private, no-store" },
    customMetadata:{ purpose:"azobss-sales-document-share", originalFilename:name, expiresAt:String(payload.exp || ""), patch:"735" }
  });
  const storedSize = Number(stored?.size || 0);
  if (storedSize > SALES_SHARE_MAX_BYTES || (storedSize > 0 && storedSize !== expectedSize)) {
    await env.AZOBSS_FILES.delete(payload.key);
    throw httpError(storedSize > SALES_SHARE_MAX_BYTES ? 413 : 400, "Stored document size did not match the signed upload request.");
  }
  return json({ ok:true, key:payload.key, name, size:storedSize || expectedSize, contentType, etag:stored?.httpEtag || "", patch:"735" }, 200, corsHeaders());
}

async function handleSalesFile(request, env, url) {
  ensureConfigured(env);
  if (!["GET","HEAD"].includes(request.method)) return text("Method not allowed", 405, { Allow:"GET, HEAD, OPTIONS" });
  const remainder = url.pathname.slice("/sales-file/".length);
  const slash = remainder.indexOf("/");
  const tokenPart = slash >= 0 ? remainder.slice(0, slash) : remainder;
  const signed = decodeURIComponent(tokenPart);
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "sales-file") throw httpError(403, "Invalid sales document link.");
  validateObjectKey(payload.key);
  if (!String(payload.key || "").toLowerCase().startsWith("sales-documents/")) throw httpError(403, "Sales document object key is required.");
  const now = Math.floor(Date.now()/1000);
  if (!Number.isInteger(payload.exp) || payload.exp <= now) throw httpError(410, "This document link has expired.");
  const object = await env.AZOBSS_FILES.get(payload.key);
  if (!object) throw httpError(404, "Shared document not found.");
  const name = safeFilename(payload.name || object.customMetadata?.originalFilename || payload.key.split("/").pop() || "AZOBSS-Receipt.pdf");
  const type = String(payload.type || object.httpMetadata?.contentType || (/\.zip$/i.test(name)?"application/zip":"application/pdf")).toLowerCase();
  const isPdf = type.includes("pdf") || /\.pdf$/i.test(name);
  const headers = noStoreHeaders({
    "Content-Type": isPdf ? "application/pdf" : "application/zip",
    "Content-Disposition": `${isPdf ? "inline" : "attachment"}; filename="${name.replace(/"/g,"_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "Content-Length": String(object.size),
    "ETag": object.httpEtag,
    "Accept-Ranges":"bytes",
    "X-AZOBSS-Share-Mode":"signed-r2-sales-document",
    "Referrer-Policy":"no-referrer"
  });
  return new Response(request.method === "HEAD" ? null : object.body, { status:200, headers });
}


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
  const name = safeFilename(payload.name || "AZOBSS-Tool.bin");
  if (!name || name === "." || name === "..") throw httpError(400, "Invalid Tech Vault file name.");
  const contentType = cleanText(request.headers.get("content-type") || payload.type || "application/octet-stream", 120);
  const stored = await env.AZOBSS_FILES.put(payload.key, request.body, {
    httpMetadata: { contentType, cacheControl: "private, no-store" },
    customMetadata: {
      purpose: "azobss-tech-vault",
      originalFilename: name,
      uploadId: cleanText(payload.id || "", 120),
      patch: "850"
    }
  });
  const storedSize = Number(stored?.size || 0);
  if (storedSize > TECH_VAULT_MAX_BYTES || (storedSize > 0 && storedSize !== expectedSize)) {
    await env.AZOBSS_FILES.delete(payload.key);
    throw httpError(storedSize > TECH_VAULT_MAX_BYTES ? 413 : 400, "Stored file size did not match the signed upload request.");
  }
  return json({ ok:true, key:payload.key, name, size:storedSize || expectedSize, etag:stored?.httpEtag || "", patch:"719" }, 200, corsHeaders());
}

async function controlPcCatalogue1537(request,env){
 ensureConfigured(env);if(request.method!=='POST')throw httpError(405,'Method not allowed.');const raw=await request.text();if(raw.length>900000)throw httpError(413,'Policy too large.');const signature=request.headers.get('x-azobss-availability-signature')||'',expected=await hmacBase64Url('azobss-pc-catalog-v1537\n'+raw,env.AZOBSS_R2_TOKEN_SECRET);if(!timingSafeEqual(signature,expected))throw httpError(403,'Gateway authorization required.');let data;try{data=JSON.parse(raw);}catch{throw httpError(400,'Invalid JSON.');}if(!Number.isFinite(data.atMs)||Math.abs(Date.now()-data.atMs)>60000)throw httpError(403,'Gateway request expired.');
 const key='__azobss_pc_catalog/policy-v1537.json',object=await env.AZOBSS_FILES.get(key),state=object?await object.json():{items:{},stores:{},revision:0};
 if(data.action==='read')return json({ok:true,state});
 if(data.action!=='write'||!Number.isSafeInteger(data.expectedRevision)||data.state?.revision!==data.expectedRevision+1||!data.state.items||!data.state.stores||Object.keys(data.state.items).length>20000)throw httpError(400,'Invalid catalogue policy.');
 for(const table of [data.state.items,data.state.stores])for(const [id,row] of Object.entries(table))if(!/^[-a-z0-9_]{1,180}$/.test(id)||typeof row.paused!=='boolean')throw httpError(400,'Invalid visibility entry.');
 if(state.revision!==data.expectedRevision)throw httpError(409,'Policy changed. Retry.');const onlyIf=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'}),saved=await env.AZOBSS_FILES.put(key,JSON.stringify(data.state),{onlyIf,httpMetadata:{contentType:'application/json',cacheControl:'no-store'},customMetadata:{purpose:'pc-catalog-visibility-v1537'}});if(!saved)throw httpError(409,'Policy changed. Retry.');return json({ok:true,state:data.state});
}
const AVAILABILITY_KEY1536='__azobss_software_availability/policy-v1536.json';
async function readAvailability1536(env) {
  const object=await env.AZOBSS_FILES.get(AVAILABILITY_KEY1536);
  if(!object)return {state:{items:{},revision:0},object:null};
  const state=await object.json();
  if(!state||typeof state.items!=='object'||!Number.isSafeInteger(state.revision))throw httpError(503,'Software availability is temporarily unavailable.');
  return {state,object};
}
async function publicAvailability1536(env) {
  const {state}=await readAvailability1536(env),paused=Object.entries(state.items).filter(([,x])=>x.paused===true);
  return {ok:true,pausedIds:paused.map(([id])=>id),pausedObjectHashes:[...new Set(await Promise.all(paused.flatMap(([,x])=>x.objectKeys||[]).map(sha256Hex)))],revision:state.revision};
}
async function controlAvailability1536(request,env) {
  ensureConfigured(env);
  if(request.method!=='POST')throw httpError(405,'Method not allowed.');
  const raw=await request.text();if(raw.length>900000)throw httpError(413,'Policy too large.');
  const signature=request.headers.get('x-azobss-availability-signature')||'',expected=await hmacBase64Url('azobss-availability-v1536\n'+raw,env.AZOBSS_R2_TOKEN_SECRET);
  if(!timingSafeEqual(signature,expected))throw httpError(403,'Administrator gateway authorization required.');
  let data;try{data=JSON.parse(raw);}catch{throw httpError(400,'Invalid JSON.');}
  if(!Number.isFinite(data.atMs)||Math.abs(Date.now()-data.atMs)>60000)throw httpError(403,'Gateway request expired.');
  const {state,object}=await readAvailability1536(env);
  if(data.action==='read')return json({ok:true,state});
  if(data.action!=='write'||!Number.isSafeInteger(data.expectedRevision)||!data.state?.items||Object.keys(data.state.items).length>2000||data.state.revision!==data.expectedRevision+1)throw httpError(400,'Invalid availability update.');
  for(const [id,row] of Object.entries(data.state.items))if(!/^[a-z0-9][a-z0-9_. -]{0,179}$/.test(id)||typeof row.paused!=='boolean'||String(row.reason||'').length>240||!Array.isArray(row.objectKeys)||row.objectKeys.length>4||row.objectKeys.some(k=>typeof k!=='string'||k.length>600||k.includes('..')))throw httpError(400,'Invalid policy entry.');
  if(state.revision!==data.expectedRevision)throw httpError(409,'Availability changed. Retry the update.');
  const onlyIf=new Headers(object?{'If-Match':object.httpEtag}:{'If-None-Match':'*'});
  const saved=await env.AZOBSS_FILES.put(AVAILABILITY_KEY1536,JSON.stringify(data.state),{onlyIf,httpMetadata:{contentType:'application/json',cacheControl:'no-store'},customMetadata:{purpose:'software-availability-v1536'}});
  if(!saved)throw httpError(409,'Availability changed. Retry the update.');
  return json({ok:true,state:data.state});
}
async function softwarePauseGuard1534(payload,env) {
  if(!String(payload.key||'').toLowerCase().startsWith('software/'))return;
  let policy;try{policy=await publicAvailability1536(env);}catch{throw httpError(503,'Software availability could not be checked. Please try again shortly.');}
  const id=String(payload.pid||'').trim().toLowerCase(),hash=await sha256Hex(String(payload.key));
  if((id&&policy.pausedIds.includes(id))||policy.pausedObjectHashes.includes(hash))throw httpError(423,'This software is temporarily unavailable while it is being updated. Please try again later.');
}

async function handleGate(request, env, ctx, url) {
  ensureConfigured(env);
  const signed = decodeURIComponent(url.pathname.slice("/gate/".length));
  const payload = await verifySignedToken(signed, env.AZOBSS_R2_TOKEN_SECRET);
  if (payload.mode !== "gate") throw httpError(403, "Invalid confirmation token.");
  validateObjectKey(payload.key);
  await softwarePauseGuard1534(payload,env);

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
    oid: cleanText(payload.oid, 180),
    pid: cleanText(payload.pid, 180)
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
  await softwarePauseGuard1534(payload,env);

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


// Derive display-only hardware fields from the customer's saved Windows report.
// Never resolve a short board code to a guessed commercial model.
function diagnosticHardware1597(row) {
  const text=String(row?.report||'').replace(/\r\n/g,'\n');
  const tidy=value=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim();
  const usable=value=>!/^$|^(?:tidak (?:tersedia|diketahui)|unknown|none|n\/?a|default string|system product name|to be filled by o\.?e\.?m\.?)$/i.test(tidy(value));
  const field=label=>tidy(text.match(new RegExp('^'+label+'[ \\t]*:[ \\t]*(.*)$','im'))?.[1]);
  const rawModel=tidy(row?.model)||field('Model');
  const board=field('Motherboard Product');
  const version=field('Motherboard Version');
  const explicit=field('Device Type');
  let deviceType=/^(?:Laptop|Desktop|Server)$/i.test(explicit) ? explicit[0].toUpperCase()+explicit.slice(1).toLowerCase() : '';
  if(!deviceType){
    if(/\b(?:laptop|notebook|thinkpad|ideapad|latitude|elitebook|probook|vivobook|zenbook|macbook|raider|katana|cyborg|stealth)\b|\b(?:GE|GF|GS|GL|GP|GT|GV)\d{2}\b/i.test(rawModel))deviceType='Laptop';
    else if(/\b(?:desktop|tower|thinkcentre|thinkstation|optiplex|prodesk|elitedesk|veriton)\b/i.test(rawModel) || /\b(?:[BHZ][3456789]\d{2}|[AX][356789]\d{2}|TRX\d{2})[A-Z-]*\b/i.test(board))deviceType='Desktop';
    else deviceType='Peranti';
  }
  let model=deviceType==='Desktop' && usable(board) ? board : rawModel;
  if(deviceType==='Desktop' && usable(board) && usable(version) && version.length<=24){
    const escaped=version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(!new RegExp('(?:^|[\\s(:])'+escaped+'(?:$|[\\s)])','i').test(model)){
      if(/\([^)]*MS-\w+[^)]*\)$/i.test(model))model=model.replace(/\)$/, ' '+version+')');
      else model+=' · Rev '+version;
    }
  }
  // Older uploads appended product.Version to the system model but may lack the board version label.
  if(deviceType==='Desktop' && /\(MS-[A-Z0-9]+\)$/i.test(model)){
    const revision=rawModel.match(/\bMS-[A-Z0-9]+\s+(\d+(?:\.\d+)+)\b/i)?.[1];
    if(revision)model=model.replace(/\)$/, ' '+revision+')');
  }
  let cpu=field('CPU');
  if(!usable(cpu)){
    const section=text.match(/^4\. CPU\s*$([\s\S]*?)(?=^5\. |$(?![\s\S]))/im)?.[1]||'';
    const value=label=>tidy(section.match(new RegExp('^'+label+'[ \\t]*:[ \\t]*(.*)$','im'))?.[1]);
    const name=value('Name'), clock=value('Maximum Clock'), cores=value('Cores / Logical').match(/(\d+)\s*\/\s*(\d+)/);
    cpu=usable(name)?[name,usable(clock)?clock:'',cores?cores[1]+'C / '+cores[2]+'T':''].filter(Boolean).join(' '):'';
  }
  cpu=tidy(cpu.replace(/\((?:R|TM|C)\)/gi,''));
  return {schema:1,deviceType,displayModel:usable(model)?model.slice(0,180):'',cpuSummary:usable(cpu)?cpu.slice(0,180):''};
}

async function controlPcDiagnostics1590(request, env) {
  ensureConfigured(env);
  if (request.method !== 'POST') throw httpError(405, 'Method not allowed.');
  const raw = await request.text();
  if (encoder.encode(raw).length > 800000) throw httpError(413, 'Report too large.');
  const signature = request.headers.get('x-azobss-diagnostic-signature') || '';
  const expected = await hmacBase64Url('azobss-pc-diagnostics-v1590\n' + raw, env.AZOBSS_R2_TOKEN_SECRET);
  if (!timingSafeEqual(signature, expected)) throw httpError(403, 'Gateway authorization required.');
  let data;
  try { data = JSON.parse(raw); } catch { throw httpError(400, 'Invalid JSON.'); }
  if (!Number.isFinite(data.atMs) || Math.abs(Date.now() - data.atMs) > 60000) throw httpError(403, 'Request expired.');
  const dealerPrefix = '__azobss_pc_diagnostic_dealers/';
  if (data.action === 'dealer-list') {
    const dealers = [];
    let cursor;
    do {
      const page = await env.AZOBSS_FILES.list({prefix:dealerPrefix,limit:1000,include:['customMetadata'],...(cursor ? {cursor} : {})});
      for (const object of page.objects) {
        const {name,phone} = object.customMetadata || {};
        if (name && /^[1-9][0-9]{6,14}$/.test(phone)) dealers.push({name,phone});
      }
      cursor = page.truncated ? page.cursor : '';
    } while (cursor);
    return json({ok:true,dealers});
  }
  if (data.action === 'dealer-add') {
    const {name,phone} = data.dealer || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\x00-\x1f\x7f]/.test(name) ||
        typeof phone !== 'string' || !/^[1-9][0-9]{6,14}$/.test(phone)) throw httpError(400,'Invalid dealer.');
    const key = dealerPrefix + phone + '.json';
    const dealer = {name,phone};
    const saved = await env.AZOBSS_FILES.put(key,JSON.stringify(dealer),{
      onlyIf:new Headers({'If-None-Match':'*'}),
      httpMetadata:{contentType:'application/json',cacheControl:'no-store'},
      customMetadata:dealer
    });
    if (!saved) {
      const existing = await env.AZOBSS_FILES.head(key);
      if (existing?.customMetadata?.name !== name) throw httpError(409,'Nombor ini sudah ada dalam senarai dealer.');
    }
    return json({ok:true,dealer});
  }
  const prefix = '__azobss_pc_diagnostics/';
  const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
  const statePrefix = '__azobss_pc_diagnostic_states/';
  const stateKey = id => statePrefix + id + '.json';
  const readState = async id => {
    const object = await env.AZOBSS_FILES.get(stateKey(id));
    return {object,state:object ? await object.json() : {sent:false,manualRevision:0,revision:0,receiptIds:[]}};
  };
  const mutate = async (id,change) => {
    for (let attempt=0;attempt<6;attempt++) {
      const {object,state} = await readState(id);
      const next = change(state);
      if (!next) return state;
      next.revision = (state.revision || 0) + 1;
      const saved = await env.AZOBSS_FILES.put(stateKey(id),JSON.stringify(next),{
        onlyIf:object ? {etagMatches:object.etag} : new Headers({'If-None-Match':'*'}),
        httpMetadata:{contentType:'application/json',cacheControl:'no-store'}
      });
      if (saved) return next;
    }
    throw httpError(409,'Status berubah. Refresh dan cuba lagi.');
  };
  const publicState = state => ({sent:state.sent===true,manualRevision:state.manualRevision||0,
    sentAt:state.sentAt||'',dealerPhone:state.dealerPhone||'',source:state.source||''});
  if (data.action === 'delete') {
    if (!Array.isArray(data.ids) || !data.ids.length || data.ids.length>50 || !data.ids.every(validId)) throw httpError(400,'Invalid report selection.');
    const deleted=[],failed=[];
    for (const id of new Set(data.ids)) {
      try {
        await mutate(id,state=>state.deletedAt ? null : {...state,deletedAt:new Date().toISOString()});
        await env.AZOBSS_FILES.delete(prefix+id+'.json');
        deleted.push(id);
      } catch { failed.push({id,error:'Gagal memadam laporan. Cuba lagi.'}); }
    }
    return json({ok:true,deleted,failed});
  }
  if (data.action === 'sent') {
    if (!validId(data.id) || typeof data.sent !== 'boolean') throw httpError(400,'Invalid sent status.');
    if (!await env.AZOBSS_FILES.head(prefix+data.id+'.json')) throw httpError(404,'PC report not found.');
    if (data.automatic && (data.sent!==true || !validId(data.eventId) || !Number.isSafeInteger(data.manualRevision) || data.manualRevision<0 || !/^[1-9][0-9]{6,14}$/.test(data.phone||''))) throw httpError(400,'Invalid send confirmation.');
    const status=await mutate(data.id,state=>{
      if (state.deletedAt) throw httpError(410,'PC report deleted.');
      if (data.automatic && (state.receiptIds||[]).includes(data.eventId)) return null;
      const next={...state};
      if (data.automatic) {
        next.receiptIds=[...(state.receiptIds||[]),data.eventId].slice(-200);
        // A delayed confirmation must never override a newer manual untick.
        if ((state.manualRevision||0)!==data.manualRevision) return next;
      } else next.manualRevision=(state.manualRevision||0)+1;
      next.sent=data.sent;
      next.sentAt=data.sent ? new Date().toISOString() : '';
      next.dealerPhone=data.automatic ? data.phone : '';
      next.source=data.automatic ? 'bridge' : 'manual';
      return next;
    });
    return json({ok:true,status:publicState(status)});
  }
  if (data.action === 'list') {
    if (data.cursor && (typeof data.cursor !== 'string' || data.cursor.length > 2048)) throw httpError(400, 'Invalid cursor.');
    const page = await env.AZOBSS_FILES.list({prefix,limit:25,include:['customMetadata'],...(data.cursor ? {cursor:data.cursor} : {})});
    return json({ok:true,reports:(await Promise.all(page.objects.map(async item => {
      let summary = {};
      try { summary = JSON.parse(item.customMetadata?.summary || '{}'); } catch {}
      const id=item.key.slice(prefix.length,-5), {state}=await readState(id);
      if(state.deletedAt)return null;
      if(summary.hardware?.schema!==1){
        const object=await env.AZOBSS_FILES.get(prefix+id+'.json');
        if(!object)return null;
        summary.hardware=diagnosticHardware1597(await object.json());
      }
      return {...summary,id,status:publicState(state)};
    }))).filter(Boolean),nextCursor:page.truncated ? page.cursor : ''});
  }
  const row = data.row;
  const id = data.id || row?.id;
  if (!validId(id)) throw httpError(400, 'Invalid report ID.');
  const key = prefix + id + '.json';
  const {state}=await readState(id);
  if (state.deletedAt) throw httpError(410,'PC report deleted.');
  if (data.action === 'read') {
    const object = await env.AZOBSS_FILES.get(key);
    if (!object) throw httpError(404, 'PC report not found.');
    const saved=await object.json();
    return json({ok:true,row:{...saved,hardware:saved.hardware?.schema===1?saved.hardware:diagnosticHardware1597(saved),status:publicState(state)}});
  }
  if (data.action !== 'write' || typeof row?.report !== 'string' || !row.report.includes('AZOBSS CUSTOMER PC DIAGNOSTIC') ||
      encoder.encode(row.report).length > 262144 || row.report.includes('\0')) throw httpError(400, 'Invalid PC report.');
  const short = value => String(value || '').slice(0,180);
  const stored = {id,report:row.report,manufacturer:short(row.manufacturer),model:short(row.model),serial:short(row.serial),
    batteries:Array.isArray(row.batteries) ? row.batteries.slice(0,8).map(x=>({name:short(x?.name),manufacturer:short(x?.manufacturer),serial:short(x?.serial)})) : [],
    receivedAt:new Date().toISOString(),source:'customer-pc-diagnostic'};
  const hash = await sha256Hex(JSON.stringify({id:stored.id,report:stored.report,manufacturer:stored.manufacturer,model:stored.model,serial:stored.serial,batteries:stored.batteries}));
  stored.hardware=diagnosticHardware1597(stored);
  const {report,...summary} = stored;
  summary.batteries = stored.batteries.slice(0,4).map(x=>({name:x.name.slice(0,30)}));
  for (const field of ['manufacturer','model','serial']) summary[field] = stored[field].slice(0,60);
  // R2 custom metadata is capped at 2 KB. Keep the complete derived fields in the private body.
  const byteLimit=(value,limit)=>{let out='';for(const char of String(value||'')){if(encoder.encode(out+char).length>limit)break;out+=char;}return out;};
  summary.hardware={...stored.hardware,displayModel:byteLimit(stored.hardware.displayModel,180),cpuSummary:byteLimit(stored.hardware.cpuSummary,180)};
  if(encoder.encode(JSON.stringify(summary)).length>1800){
    for(const field of ['manufacturer','model','serial'])summary[field]=byteLimit(summary[field],90);
    summary.batteries=summary.batteries.slice(0,2).map(x=>({name:byteLimit(x.name,40)}));
  }
  const saved = await env.AZOBSS_FILES.put(key,JSON.stringify(stored),{
    onlyIf:new Headers({'If-None-Match':'*'}),
    httpMetadata:{contentType:'application/json',cacheControl:'no-store'},
    customMetadata:{summary:JSON.stringify(summary),sha256:hash}
  });
  if (!saved) {
    const old = await env.AZOBSS_FILES.head(key);
    if (!old || old.customMetadata?.sha256 !== hash) throw httpError(409, 'Report ID already belongs to different content.');
  }
  if ((await readState(id)).state.deletedAt) {
    await env.AZOBSS_FILES.delete(key);
    throw httpError(410,'PC report deleted.');
  }
  return json({ok:true,id});
}
