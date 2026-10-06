var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/payments.js
var encoder = new TextEncoder();
var UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
var HEX = /^[a-f0-9]{64}$/;
var MAIL = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$/;
var plans = [
  { id: "annual", name: "AZDM 1 Tahun", days: 365, amount_cents: 2500 },
  { id: "lifetime", name: "AZDM Lifetime", days: 0, amount_cents: 5e3, bulk_minimum: 2, bulk_unit_cents: 4e3 }
];
var PaymentError = class extends Error {
  static {
    __name(this, "PaymentError");
  }
  constructor(status2, message) {
    super(message);
    this.status = status2;
  }
};
var now = /* @__PURE__ */ __name(() => Math.floor(Date.now() / 1e3), "now");
var digest = /* @__PURE__ */ __name(async (algorithm, value) => Array.from(new Uint8Array(await crypto.subtle.digest(algorithm, encoder.encode(value))), (x) => x.toString(16).padStart(2, "0")).join(""), "digest");
var bytes64 = /* @__PURE__ */ __name((value) => btoa(String.fromCharCode(...new Uint8Array(value))), "bytes64");
var from64 = /* @__PURE__ */ __name((value) => Uint8Array.from(atob(value), (x) => x.charCodeAt(0)), "from64");
var safe = /* @__PURE__ */ __name((value) => String(value).replace(/[&<>"']/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]), "safe");
var gateway = /* @__PURE__ */ __name((env) => env.TOYYIBPAY_SANDBOX === "true" ? "https://dev.toyyibpay.com" : "https://toyyibpay.com", "gateway");
function fulfilReady(env) {
  return !!env.TOYYIBPAY_SECRET && !!env.TOYYIBPAY_CATEGORY && !!env.RESEND_API_KEY && MAIL.test(env.EMAIL_FROM || "") && HEX.test(env.ORDER_CIPHER_KEY || "");
}
__name(fulfilReady, "fulfilReady");
function ready(env) {
  return env.SHOP_ENABLED === "true" && fulfilReady(env) && HEX.test(env.SHOP_SERVICE_TOKEN || "");
}
__name(ready, "ready");
function requireReady(env) {
  if (!ready(env)) throw new PaymentError(503, "Pembelian lesen belum dibuka. Hubungi support AZDM.");
}
__name(requireReady, "requireReady");
var support = /* @__PURE__ */ __name((env) => ({ email: env.SUPPORT_EMAIL || "zedan9107@gmail.com", whatsapp: env.SUPPORT_WHATSAPP || "601135600723", website: "https://www.azobss.com/?azdmSupport=1" }), "support");
function quote(planId, quantity) {
  const plan = plans.find((p) => p.id === planId);
  if (!plan || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new PaymentError(400, "Pilih pakej dan bilangan PC antara 1 hingga 100.");
  const unit = plan.id === "lifetime" && quantity >= 2 ? 4e3 : plan.amount_cents;
  return { ...plan, quantity, unit_cents: unit, total_cents: unit * quantity };
}
__name(quote, "quote");
function quoteFromTrustedBackend(body) {
  if (!body.trusted_quote) return quote(body.product_id, body.quantity);
  const q = body.trusted_quote;
  if (!q || !/^[-A-Za-z0-9_:]{1,144}$/.test(q.id || "") || typeof q.name !== "string" || !q.name.trim() || q.name.length > 160 || /[\x00-\x1f]/.test(q.name) || !Number.isInteger(q.days) || q.days < 0 || q.days > 36500 || !Number.isInteger(q.quantity) || q.quantity !== body.quantity || q.quantity < 1 || q.quantity > 100 || !Number.isInteger(q.unit_cents) || q.unit_cents < 0 || q.unit_cents > 1e7 || !Number.isInteger(q.total_cents) || q.total_cents < 100 || q.total_cents > 1e9)
    throw new PaymentError(400, "Tetapan pakej server tidak sah.");
  return { id: q.id, name: q.name, days: q.days, quantity: q.quantity, unit_cents: q.unit_cents, total_cents: q.total_cents };
}
__name(quoteFromTrustedBackend, "quoteFromTrustedBackend");
function accountUid(value) {
  if (typeof value !== "string" || !value || value.length > 128 || /[\x00-\x1f\x7f]/.test(value)) throw new PaymentError(401, "Sila sign in ke akaun AZOBSS.");
  return value;
}
__name(accountUid, "accountUid");
async function requireService(request, env) {
  if (!HEX.test(env.SHOP_SERVICE_TOKEN || "")) throw new PaymentError(503, "Sambungan pembelian belum tersedia.");
  const supplied = request.headers.get("Authorization") || "";
  const [actual, expected] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(supplied.slice(0, 513))), crypto.subtle.digest("SHA-256", encoder.encode("Bearer " + env.SHOP_SERVICE_TOKEN))]);
  if (supplied.length > 512 || !crypto.subtle.timingSafeEqual(actual, expected) || request.headers.has("Origin")) throw new PaymentError(401, "Unauthorized.");
}
__name(requireService, "requireService");
function checkName(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) throw new PaymentError(400, "Masukkan nama yang sah.");
  return value.trim();
}
__name(checkName, "checkName");
function checkEmail(value) {
  if (typeof value !== "string" || value.length > 254 || !MAIL.test(value.trim())) throw new PaymentError(400, "Masukkan satu alamat email yang sah.");
  return value.trim();
}
__name(checkEmail, "checkEmail");
function money(value) {
  if (typeof value !== "string" || !/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
__name(money, "money");
async function bounded(request) {
  if (Number(request.headers.get("Content-Length")) > 8192) throw new PaymentError(413, "Permintaan terlalu besar.");
  const reader = request.body?.getReader();
  if (!reader) throw new PaymentError(400, "Maklumat diperlukan.");
  const pieces = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new PaymentError(413, "Permintaan terlalu besar.");
    }
    pieces.push(value);
  }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const piece of pieces) {
    joined.set(piece, offset);
    offset += piece.length;
  }
  return joined;
}
__name(bounded, "bounded");
async function bodyFor(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new PaymentError(415, "JSON required.");
  try {
    const body = JSON.parse(new TextDecoder().decode(await bounded(request)));
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error();
    return body;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(400, "Maklumat tidak sah.");
  }
}
__name(bodyFor, "bodyFor");
async function formFor(request) {
  const type = request.headers.get("Content-Type") || "";
  if (!type.startsWith("application/x-www-form-urlencoded") && !type.startsWith("multipart/form-data")) throw new PaymentError(415, "Form required.");
  let form;
  try {
    form = await new Response(await bounded(request), { headers: { "Content-Type": type } }).formData();
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    throw new PaymentError(400, "Invalid callback.");
  }
  const body = {};
  for (const [key, value] of form.entries()) {
    if (typeof value !== "string" || key in body) throw new PaymentError(400, "Invalid callback.");
    body[key] = value;
  }
  return body;
}
__name(formFor, "formFor");
async function api(env, action, fields) {
  const response = await fetch(gateway(env) + "/index.php/api/" + action, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields), signal: AbortSignal.timeout(15e3), redirect: "manual" });
  if (!response.ok) throw new PaymentError(503, "Servis bayaran belum tersedia. Cuba semula sebentar lagi.");
  const raw = await response.text();
  if (raw.length > 128e3) throw new PaymentError(503, "Respons bayaran tidak sah.");
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new PaymentError(503, "Servis bayaran belum tersedia.");
  }
  if (!Array.isArray(result)) throw new PaymentError(503, "Servis bayaran belum tersedia.");
  return result;
}
__name(api, "api");
async function cipherKey(env) {
  return crypto.subtle.importKey("raw", Uint8Array.from(env.ORDER_CIPHER_KEY.match(/../g), (x) => parseInt(x, 16)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(cipherKey, "cipherKey");
async function encrypt(env, orderId, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(orderId) }, await cipherKey(env), encoder.encode(JSON.stringify(message)));
  return bytes64(iv) + "." + bytes64(cipher);
}
__name(encrypt, "encrypt");
async function decrypt(env, orderId, cipher) {
  const [iv, payload] = cipher.split(".");
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: from64(iv), additionalData: encoder.encode(orderId) }, await cipherKey(env), from64(payload));
  return JSON.parse(new TextDecoder().decode(raw));
}
__name(decrypt, "decrypt");
function serialKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  return "AZDM-" + Array.from(crypto.getRandomValues(new Uint8Array(30)), (x) => alphabet[x & 31]).join("").match(/.{5}/g).join("-");
}
__name(serialKey, "serialKey");
function emailMessage(env, order, serials, expires) {
  const expiry = expires ? new Date(expires * 1e3).toLocaleDateString("ms-MY", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "long", year: "numeric" }) : "Lifetime";
  const contact = support(env);
  const keys = serials.map((serial, i) => `PC ${i + 1}: ${serial}`).join("\n");
  const text = `Hai ${order.customer},

Bayaran ${order.product_name}, ${order.quantity} PC, sebanyak RM${(order.amount_cents / 100).toFixed(2)} sudah diterima.

${keys}

Tarikh tamat: ${expiry}
No. pesanan: ${order.id}

Cara aktifkan:
1. Sign in di https://www.azobss.com/ dan download AZDM.
2. Pasang dan buka AZDM pada PC anda. Sambungkan internet.
3. Masukkan satu serial bagi setiap PC dan tekan Activate.
4. Selepas berjaya, tekan Continue.

Satu serial untuk satu PC aktif. Tempoh lesen bermula apabila bayaran disahkan. Simpan email ini.

Support: ${contact.email}
WhatsApp: https://wa.me/${contact.whatsapp}
Nyatakan no. pesanan apabila meminta bantuan.

Terima kasih,
AZDM / AZOBSS`;
  const html = `<!doctype html><html lang="ms"><body style="margin:0;background:#f4f8f7;font-family:Arial,sans-serif;color:#173c3a"><div style="max-width:600px;margin:32px auto;padding:32px;background:white;border-radius:16px"><h1 style="color:#087f72">AZDM</h1><h2>Serial anda sudah siap</h2><p>Hai ${safe(order.customer)}, bayaran <strong>${safe(order.product_name)}, ${order.quantity} PC</strong> sebanyak <strong>RM${(order.amount_cents / 100).toFixed(2)}</strong> sudah diterima.</p>${serials.map((serial, i) => `<p>PC ${i + 1}</p><p style="padding:16px;background:#edf7f4;border-radius:8px;font-family:monospace;font-weight:bold;overflow-wrap:anywhere">${serial}</p>`).join("")}<p>Tarikh tamat: <strong>${safe(expiry)}</strong><br>No. pesanan: ${order.id}</p><h3>Cara aktifkan</h3><ol><li>Sign in di <a href="https://www.azobss.com/Software-Tools/">AZOBSS</a> dan download AZDM.</li><li>Pasang dan buka AZDM. Sambungkan internet.</li><li>Masukkan satu serial bagi setiap PC dan tekan <strong>Activate</strong>.</li><li>Tekan <strong>Continue</strong> selepas berjaya.</li></ol><p>Satu serial untuk satu PC aktif. Tempoh lesen bermula apabila bayaran disahkan. Simpan email ini.</p><h3>Perlukan bantuan?</h3><p><a href="mailto:${safe(contact.email)}">${safe(contact.email)}</a> \xC2\xB7 <a href="https://wa.me/${contact.whatsapp}">WhatsApp support</a><br>Nyatakan no. pesanan apabila meminta bantuan.</p><p>Terima kasih,<br>AZDM / AZOBSS</p></div></body></html>`;
  return { from: `AZDM <${env.EMAIL_FROM}>`, to: [order.email], reply_to: contact.email, subject: `Serial AZDM anda \xE2\u20AC\u201D ${order.product_name} (${order.quantity} PC)`, text, html };
}
__name(emailMessage, "emailMessage");
async function checkout(request, env) {
  requireReady(env);
  const body = await bodyFor(request), plan = quoteFromTrustedBackend(body);
  if (!UUID.test(body.request_id || "")) throw new PaymentError(400, "Pesanan tidak sah.");
  const uid = accountUid(body.account_uid), customer = checkName(body.customer), email = checkEmail(body.email);
  if (email.endsWith(".local")) throw new PaymentError(400, "Sila sahkan email sebenar dalam akaun AZOBSS.");
  const phone = typeof body.phone === "string" ? body.phone.replace(/[^0-9]/g, "") : "";
  if (phone && !/^\d{8,15}$/.test(phone)) throw new PaymentError(400, "Semak nombor telefon dalam akaun AZOBSS.");
  const id = crypto.randomUUID(), licenseId = crypto.randomUUID(), time = now();
  await env.DB.prepare("INSERT OR IGNORE INTO purchase_orders(id,request_id,status_hash,product_id,product_name,days,amount_cents,customer,email,phone,license_id,status,created,account_uid,quantity,unit_cents,entitlement_days) VALUES(?,?,'',?,?,?,?,?,?,?,?,'creating',?,?,?,?,?)").bind(id, body.request_id, plan.id, plan.name, plan.days ? 365 : 0, plan.total_cents, customer, email, phone, licenseId, time, uid, plan.quantity, plan.unit_cents, plan.days).run();
  const order = await env.DB.prepare("SELECT * FROM purchase_orders WHERE request_id=?").bind(body.request_id).first();
  if (order.account_uid !== uid || order.product_id !== plan.id || order.quantity !== plan.quantity) throw new PaymentError(409, "Pesanan sudah berubah. Mulakan pesanan baharu.");
  if (body.trusted_quote && (order.amount_cents !== plan.total_cents || (order.entitlement_days ?? order.days) !== plan.days)) throw new PaymentError(409, "Pesanan sudah berubah. Muatkan pakej semula untuk pembelian baharu.");
  if (order.status === "paid") throw new PaymentError(409, "Pesanan ini sudah dibayar. Semak pesanan anda sebelum membuat pembelian baharu.");
  if (time - order.created >= 4 * 86400) throw new PaymentError(409, "Bil terdahulu tamat. Cuba pembelian baharu.");
  if (order.bill_code) return { order_id: order.id, payment_url: gateway(env) + "/" + order.bill_code, amount_cents: order.amount_cents };
  if (order.status === "creation_failed") throw new PaymentError(409, "Bil terdahulu gagal dicipta. Cuba pembelian baharu.");
  if (order.id !== id) throw new PaymentError(409, "Pesanan sedang diproses. Semak pesanan anda sebelum cuba semula.");
  const slots = Array.from({ length: plan.quantity }, (_, slot) => ({ slot, id: slot === 0 ? licenseId : crypto.randomUUID() }));
  await env.DB.prepare("INSERT INTO order_licenses(order_id,slot,license_id) SELECT ?,json_extract(value,'$.slot'),json_extract(value,'$.id') FROM json_each(?)").bind(id, JSON.stringify(slots)).run();
  try {
    const result = await api(env, "createBill", { userSecretKey: env.TOYYIBPAY_SECRET, categoryCode: env.TOYYIBPAY_CATEGORY, billName: plan.name.slice(0, 30), billDescription: (plan.name + " " + plan.quantity + " PC").slice(0, 100), billPriceSetting: "1", billPayorInfo: "1", billAmount: String(plan.total_cents), billReturnUrl: "https://www.azobss.com/Software-Tools/?azdm_order=" + id + "&azdm_software=" + encodeURIComponent(plan.id.includes(":") ? plan.id.split(":")[0] : "AZDM") + "#azdm-license", billCallbackUrl: new URL(request.url).origin + "/payments/toyyibpay/callback", billExternalReferenceNo: id, billTo: customer.slice(0, 30), billEmail: email, billPhone: phone, billPaymentChannel: "0", billExpiryDays: "3", billContentEmail: "Serial AZDM akan dihantar ke email akaun selepas bayaran disahkan." });
    const code = result[0]?.BillCode;
    if (result.length !== 1 || typeof code !== "string" || !/^[a-zA-Z0-9_-]{4,80}$/.test(code)) throw new PaymentError(503, "Servis bayaran belum tersedia.");
    await env.DB.prepare("UPDATE purchase_orders SET bill_code=?,status='pending' WHERE id=? AND status='creating'").bind(code, id).run();
    return { order_id: id, payment_url: gateway(env) + "/" + code, amount_cents: plan.total_cents };
  } catch (error) {
    await env.DB.prepare("UPDATE purchase_orders SET status='creation_failed' WHERE id=? AND status='creating'").bind(id).run();
    throw error;
  }
}
__name(checkout, "checkout");
async function confirmOrder(env, order) {
  if (order.status !== "pending") return order.status === "paid";
  const transactions = await api(env, "getBillTransactions", { billCode: order.bill_code, billpaymentStatus: "1" });
  const verified = transactions.find((t) => String(t.billpaymentStatus) === "1" && t.billExternalReferenceNo === order.id && money(t.billpaymentAmount) === order.amount_cents && typeof t.billpaymentInvoiceNo === "string" && t.billpaymentInvoiceNo.length > 0 && t.billpaymentInvoiceNo.length <= 120);
  if (!verified) return false;
  const { results: slots } = await env.DB.prepare("SELECT slot,license_id FROM order_licenses WHERE order_id=? ORDER BY slot").bind(order.id).all();
  if (slots.length !== order.quantity) throw new PaymentError(503, "Order not ready.");
  const days = order.entitlement_days ?? order.days;
  const time = now(), expires = days ? time + days * 86400 : 0;
  const serials = slots.map(() => serialKey());
  await ensureLicenseSerialSupport(env.DB);
  const entries = await Promise.all(slots.map(async (slot, i) => ({ id: slot.license_id, hash: await digest("SHA-256", serials[i]), cipher: await sealLicenseSerial(env, slot.license_id, serials[i]), customer: order.customer + (order.quantity > 1 ? " / PC " + (i + 1) : "") })));
  const encrypted = await encrypt(env, order.id, emailMessage(env, order, serials, expires));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO licenses(id,serial_hash,serial_cipher,customer,customer_key,expires,status,created) SELECT json_extract(j.value,'$.id'),json_extract(j.value,'$.hash'),json_extract(j.value,'$.cipher'),json_extract(j.value,'$.customer'),lower(json_extract(j.value,'$.customer')),?,'active',? FROM json_each(?) j JOIN purchase_orders o ON o.id=? WHERE o.status='pending'").bind(expires, time, JSON.stringify(entries), order.id),
    env.DB.prepare("INSERT INTO email_outbox(order_id,payload_cipher,state,next_attempt) SELECT id,?,'queued',? FROM purchase_orders WHERE id=? AND status='pending'").bind(encrypted, time, order.id),
    env.DB.prepare("UPDATE purchase_orders SET status='paid',invoice=?,paid_at=? WHERE id=? AND status='pending'").bind(verified.billpaymentInvoiceNo, time, order.id)
  ]);
  await deliverOrder(env, order.id);
  return true;
}
__name(confirmOrder, "confirmOrder");
async function callback(request, env) {
  if (!fulfilReady(env)) throw new PaymentError(503, "Payment service unavailable.");
  const body = await formFor(request);
  if (!UUID.test(body.order_id || "") || !["1", "2", "3"].includes(body.status) || typeof body.refno !== "string" || !body.refno || body.refno.length > 120 || !/^[a-fA-F0-9]{32}$/.test(body.hash || "")) throw new PaymentError(400, "Invalid callback.");
  const expected = await digest("MD5", env.TOYYIBPAY_SECRET + body.status + body.order_id + body.refno + "ok");
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(expected)), crypto.subtle.digest("SHA-256", encoder.encode(body.hash.toLowerCase()))]);
  if (!crypto.subtle.timingSafeEqual(a, b)) throw new PaymentError(401, "Invalid callback.");
  const order = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(body.order_id).first();
  if (!order) throw new PaymentError(404, "Order not found.");
  if (!order.bill_code) throw new PaymentError(503, "Order not ready.");
  if (body.billcode !== order.bill_code) throw new PaymentError(400, "Bill does not match order.");
  if (body.status !== "1") return { ok: true };
  if (order.status === "paid") {
    await deliverOrder(env, order.id);
    return { ok: true };
  }
  if (!await confirmOrder(env, order)) throw new PaymentError(409, "Payment not confirmed.");
  return { ok: true };
}
__name(callback, "callback");
async function deliverOrder(env, orderId) {
  if (!env.RESEND_API_KEY || !HEX.test(env.ORDER_CIPHER_KEY || "")) return;
  const time = now();
  const entry = await env.DB.prepare("UPDATE email_outbox SET state='sending',lease_until=?,attempts=attempts+1,first_attempt=coalesce(first_attempt,?) WHERE order_id=? AND next_attempt<=? AND lease_until<=? AND state IN ('queued','sending') RETURNING *").bind(time + 90, time, orderId, time, time).first();
  if (!entry) return;
  if (time - entry.first_attempt >= 23 * 3600 || entry.attempts > 12) {
    await env.DB.prepare("UPDATE email_outbox SET state='review',lease_until=0,last_error='delivery_review_required' WHERE order_id=?").bind(orderId).run();
    return;
  }
  let permanent = false, errorCode = "delivery_unavailable";
  try {
    const message = await decrypt(env, orderId, entry.payload_cipher);
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json", "Idempotency-Key": "azdm-order/" + orderId }, body: JSON.stringify(message), signal: AbortSignal.timeout(15e3), redirect: "manual" });
    if (!response.ok) {
      permanent = response.status >= 400 && response.status < 500 && ![408, 409, 429].includes(response.status);
      errorCode = "email_http_" + response.status;
      throw new Error();
    }
    const result = await response.json();
    if (typeof result.id !== "string" || !result.id || result.id.length > 200) throw new Error();
    await env.DB.prepare("UPDATE email_outbox SET state='accepted',payload_cipher='',provider_id=?,accepted_at=?,lease_until=0,last_error='' WHERE order_id=? AND state='sending'").bind(result.id, time, orderId).run();
  } catch {
    await env.DB.prepare("UPDATE email_outbox SET state=?,lease_until=0,next_attempt=?,last_error=? WHERE order_id=? AND state='sending'").bind(permanent ? "review" : "queued", time + Math.min(3600, 60 * 2 ** Math.min(entry.attempts, 6)), errorCode, orderId).run();
  }
}
__name(deliverOrder, "deliverOrder");
async function retryEmails(env) {
  if (!env.RESEND_API_KEY || !HEX.test(env.ORDER_CIPHER_KEY || "")) return;
  const time = now();
  const { results } = await env.DB.prepare("SELECT order_id FROM email_outbox WHERE state IN ('queued','sending') AND next_attempt<=? AND lease_until<=? ORDER BY next_attempt LIMIT 5").bind(time, time).all();
  for (const entry of results) await deliverOrder(env, entry.order_id);
}
__name(retryEmails, "retryEmails");
async function adminPayments(path, body, env) {
  if (path === "/admin/orders") {
    const limit = body.limit ?? 25, search = body.search ?? "";
    if (!Number.isInteger(limit) || limit < 1 || limit > 50 || typeof search !== "string" || search.length > 120) throw new PaymentError(400, "Carian tidak sah.");
    let cursor = null;
    if (body.cursor) {
      try {
        cursor = JSON.parse(atob(body.cursor));
        if (!Array.isArray(cursor) || !Number.isSafeInteger(cursor[0]) || !UUID.test(cursor[1])) throw new Error();
      } catch {
        throw new PaymentError(400, "Halaman tidak sah.");
      }
    }
    const clauses = [], binds = [];
    if (search.trim()) {
      clauses.push("(o.id=? OR instr(lower(o.customer),lower(?))=1 OR o.email=?)");
      binds.push(search.trim(), search.trim(), search.trim());
    }
    if (cursor) {
      clauses.push("(o.created<? OR (o.created=? AND o.id<?))");
      binds.push(cursor[0], cursor[0], cursor[1]);
    }
    const { results } = await env.DB.prepare("SELECT o.id,o.customer,o.email,o.product_name,o.amount_cents,o.status,o.created,o.paid_at,o.license_id,o.quantity,o.unit_cents,e.state AS email_status,e.last_error FROM purchase_orders o LEFT JOIN email_outbox e ON e.order_id=o.id" + (clauses.length ? " WHERE " + clauses.join(" AND ") : "") + " ORDER BY o.created DESC,o.id DESC LIMIT ?").bind(...binds, limit + 1).all();
    const orders = results.slice(0, limit), last = orders.at(-1);
    return { enabled: ready(env), orders, next_cursor: results.length > limit ? btoa(JSON.stringify([last.created, last.id])) : null };
  }
  if (!UUID.test(body.order_id || "")) throw new PaymentError(400, "Pesanan tidak sah.");
  const entry = await env.DB.prepare("UPDATE email_outbox SET state='queued',attempts=0,first_attempt=NULL,next_attempt=?,lease_until=0 WHERE order_id=? AND state='review' AND payload_cipher<>'' RETURNING order_id").bind(now(), body.order_id).first();
  if (!entry) throw new PaymentError(409, "Email sedang diproses atau sudah dihantar.");
  await deliverOrder(env, body.order_id);
  return { ok: true };
}
__name(adminPayments, "adminPayments");
async function status(request, env) {
  const body = await bodyFor(request), uid = accountUid(body.account_uid);
  if (!UUID.test(body.order_id || "")) throw new PaymentError(404, "Pesanan tidak ditemui.");
  let order = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=? AND account_uid=?").bind(body.order_id, uid).first();
  if (!order) throw new PaymentError(404, "Pesanan tidak ditemui.");
  if (order.status === "pending" && fulfilReady(env)) {
    const claimed = await env.DB.prepare("UPDATE purchase_orders SET last_check=? WHERE id=? AND status='pending' AND last_check<? RETURNING id").bind(now(), order.id, now() - 30).first();
    if (claimed) {
      try {
        await confirmOrder(env, order);
      } catch {
      }
    }
    order = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(order.id).first();
  }
  const entry = await env.DB.prepare("SELECT state FROM email_outbox WHERE order_id=?").bind(order.id).first();
  return { order_id: order.id, status: order.status, email_status: entry?.state || null, product_name: order.product_name, quantity: order.quantity, amount_cents: order.amount_cents, email: order.email };
}
__name(status, "status");
async function customerOrders(request, env) {
  const body = await bodyFor(request), uid = accountUid(body.account_uid);
  const { results } = await env.DB.prepare("SELECT o.id AS order_id,o.status,o.product_name,o.quantity,o.amount_cents,o.created,e.state AS email_status FROM purchase_orders o LEFT JOIN email_outbox e ON e.order_id=o.id WHERE o.account_uid=? ORDER BY o.created DESC,o.id DESC LIMIT 25").bind(uid).all();
  return { orders: results };
}
__name(customerOrders, "customerOrders");
async function recoverPayments(env) {
  if (!fulfilReady(env)) return;
  const { results } = await env.DB.prepare("SELECT * FROM purchase_orders WHERE status='pending' AND created>? AND last_check<? ORDER BY last_check LIMIT 3").bind(now() - 7 * 86400, now() - 300).all();
  for (const order of results) {
    await env.DB.prepare("UPDATE purchase_orders SET last_check=? WHERE id=?").bind(now(), order.id).run();
    try {
      await confirmOrder(env, order);
    } catch {
    }
  }
}
__name(recoverPayments, "recoverPayments");
async function paymentDispatch(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method !== "POST") throw new PaymentError(405, "POST required.");
  if (path === "/payments/toyyibpay/callback") return callback(request, env);
  await requireService(request, env);
  if (path === "/integration/catalog") return { enabled: ready(env), sandbox: env.TOYYIBPAY_SANDBOX === "true", plans, support: support(env) };
  if (path === "/integration/checkout") return checkout(request, env);
  if (path === "/integration/status") return status(request, env);
  if (path === "/integration/orders") return customerOrders(request, env);
  throw new PaymentError(404, "Not found.");
}
__name(paymentDispatch, "paymentDispatch");

// src/worker.js
var encoder2 = new TextEncoder();
var HEX2 = /^[a-f0-9]{64}$/;
var UUID2 = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
var SERIAL = /^AZDM-(?:[A-Z2-7]{5}-){5}[A-Z2-7]{5}$/;
var OFFLINE = 30 * 86400;
var headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
var Denied = class extends Error {
  static {
    __name(this, "Denied");
  }
  constructor(status2, message) {
    super(message);
    this.status = status2;
  }
};
var json = /* @__PURE__ */ __name((value, status2 = 200) => Response.json(value, { status: status2, headers: { ...headers, ...status2 === 429 ? { "Retry-After": "60" } : {} } }), "json");
var bytes642 = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))), "bytes64");
var from642 = /* @__PURE__ */ __name((value) => Uint8Array.from(atob(value), (x) => x.charCodeAt(0)), "from64");
var randomHex = /* @__PURE__ */ __name(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join(""), "randomHex");
var sha = /* @__PURE__ */ __name(async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder2.encode(value))), (x) => x.toString(16).padStart(2, "0")).join(""), "sha");
var signing;
var signingSecret;
var signingPublic;
async function keyFor(env) {
  if (!env.LICENSE_SIGNING_KEY || !HEX2.test(env.PUBLIC_KEY || "") || !env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32)
    throw new Denied(503, "Activation service is not configured.");
  if (signingSecret !== env.LICENSE_SIGNING_KEY || signingPublic !== env.PUBLIC_KEY) {
    signingSecret = env.LICENSE_SIGNING_KEY;
    signingPublic = env.PUBLIC_KEY;
    signing = (async () => {
      const key = await crypto.subtle.importKey("pkcs8", from642(env.LICENSE_SIGNING_KEY), "Ed25519", false, ["sign"]);
      const publicKey = await crypto.subtle.importKey("raw", Uint8Array.from(env.PUBLIC_KEY.match(/../g), (x) => parseInt(x, 16)), "Ed25519", false, ["verify"]);
      const proof = encoder2.encode("AZDM signing identity v1");
      const sig = await crypto.subtle.sign("Ed25519", key, proof);
      if (!await crypto.subtle.verify("Ed25519", publicKey, sig, proof)) throw new Error("Wrong identity");
      return key;
    })();
  }
  return signing;
}
__name(keyFor, "keyFor");
async function lease(env, row, now2) {
  const duration = row.expires ? Math.ceil((row.expires - row.created) / 86400) : 0;
  const raw = encoder2.encode(JSON.stringify({
    v: 1,
    product: "azdm",
    license_id: row.id,
    machine: row.machine,
    issued: now2,
    expires: row.expires ? Math.min(now2 + OFFLINE, row.expires) : now2 + OFFLINE,
    kind: row.kind === "trial" ? "trial" : "paid",
    license_plan: row.kind === "trial" ? "trial" : !row.expires ? "lifetime" : duration === 365 ? "one_year" : "fixed_term",
    license_expires: row.expires,
    license_duration_days: duration,
    ...row.kind === "trial" ? { trial_expires: row.expires } : {}
  }));
  return { payload: bytes642(raw), signature: bytes642(await crypto.subtle.sign("Ed25519", await keyFor(env), raw)) };
}
__name(lease, "lease");
async function bodyFor2(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new Denied(415, "JSON required.");
  const length = Number(request.headers.get("Content-Length"));
  if (length > 8192) throw new Denied(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Denied(400, "Invalid request.");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value: value2, done } = await reader.read();
      if (done) break;
      size += value2.length;
      if (size > 8192) {
        await reader.cancel();
        throw new Denied(413, "Request too large.");
      }
      chunks.push(value2);
    }
    const raw = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      raw.set(chunk, offset);
      offset += chunk.length;
    }
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid");
    return value;
  } catch (error) {
    if (error instanceof Denied) throw error;
    throw new Denied(400, "Invalid request.");
  }
}
__name(bodyFor2, "bodyFor");
function checkRow(row, now2, machine) {
  if (!row) throw new Denied(401, "Activation not found.");
  if (row.status !== "active") throw new Denied(403, "License blocked.");
  if (row.expires && now2 >= row.expires) throw new Denied(410, "License expired.");
  if (machine && row.machine && row.machine !== machine) throw new Denied(409, "Already activated on another PC.");
  if (!row.machine && row.transfer_after > now2) throw new Denied(409, "Transfer cooldown. Contact seller.");
}
__name(checkRow, "checkRow");
function customerName(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 120 || /[\x00-\x1f\x7f]/.test(value)) throw new Denied(400, "Enter a customer name (maximum 120 characters).");
  return value.trim();
}
__name(customerName, "customerName");
function serialKey2() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(30)), (x) => alphabet[x & 31]).join("");
  return "AZDM-" + chars.match(/.{5}/g).join("-");
}
__name(serialKey2, "serialKey");
var serialVaultKey;
var serialVaultSecret;
async function serialKeyForVault(env) {
  if (!env.LICENSE_SIGNING_KEY) throw new Denied(503, "Serial vault is not configured.");
  if (serialVaultSecret !== env.LICENSE_SIGNING_KEY) {
    serialVaultSecret = env.LICENSE_SIGNING_KEY;
    serialVaultKey = (async () => {
      const raw = await crypto.subtle.digest("SHA-256", encoder2.encode("AZDM serial vault v1\0" + env.LICENSE_SIGNING_KEY));
      return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    })();
  }
  return serialVaultKey;
}
__name(serialKeyForVault, "serialKeyForVault");
async function sealLicenseSerial(env, licenseId, serial) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = encoder2.encode("AZDM license serial v1:" + licenseId);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, await serialKeyForVault(env), encoder2.encode(serial));
  return "v1." + bytes642(iv) + "." + bytes642(cipher);
}
__name(sealLicenseSerial, "sealLicenseSerial");
async function openLicenseSerial(env, licenseId, cipher) {
  if (!cipher || typeof cipher !== "string") return null;
  try {
    const [version, iv64, payload64] = cipher.split(".");
    if (version !== "v1" || !iv64 || !payload64) return null;
    const aad = encoder2.encode("AZDM license serial v1:" + licenseId);
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: from642(iv64), additionalData: aad }, await serialKeyForVault(env), from642(payload64));
    const serial = new TextDecoder().decode(raw);
    return SERIAL.test(serial) ? serial : null;
  } catch {
    return null;
  }
}
__name(openLicenseSerial, "openLicenseSerial");
async function ensureLicenseSerialSupport(db) {
  const info = await db.prepare("PRAGMA table_info(licenses)").all();
  if (!Array.isArray(info.results) || !info.results.some((column) => column.name === "serial_cipher")) {
    try {
      await db.prepare("ALTER TABLE licenses ADD COLUMN serial_cipher TEXT NOT NULL DEFAULT ''").run();
    } catch {
      const again = await db.prepare("PRAGMA table_info(licenses)").all();
      if (!Array.isArray(again.results) || !again.results.some((column) => column.name === "serial_cipher")) throw new Denied(503, "Serial storage migration failed.");
    }
  }
  try {
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_azdm_licenses_serial_hash_unique ON licenses(serial_hash)").run();
  } catch {
    throw new Denied(409, "Duplicate serial data exists. Resolve the duplicate before editing serial keys.");
  }
}
__name(ensureLicenseSerialSupport, "ensureLicenseSerialSupport");
async function uniqueSerial(db) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const serial = serialKey2();
    const hash = await sha(serial);
    if (!await db.prepare("SELECT id FROM licenses WHERE serial_hash=? LIMIT 1").bind(hash).first()) return { serial, hash };
  }
  throw new Denied(503, "Unable to generate a unique serial. Try again.");
}
__name(uniqueSerial, "uniqueSerial");
function normalizeSerial(value) {
  if (typeof value !== "string") throw new Denied(400, "Invalid serial key.");
  const serial = value.trim().toUpperCase();
  if (!SERIAL.test(serial)) throw new Denied(400, "Serial must use the AZDM-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX format.");
  return serial;
}
__name(normalizeSerial, "normalizeSerial");
function cursorFor(row) {
  return btoa(JSON.stringify([row.created, row.id]));
}
__name(cursorFor, "cursorFor");
function cursorFrom(value) {
  try {
    if (typeof value !== "string" || value.length > 180) throw new Error();
    const [created, id] = JSON.parse(atob(value));
    if (!Number.isSafeInteger(created) || created < 0 || !UUID2.test(id)) throw new Error();
    return [created, id];
  } catch {
    throw new Denied(400, "Invalid page.");
  }
}
__name(cursorFrom, "cursorFrom");
async function admin(path, body, db, now2, env) {
  await ensureLicenseSerialSupport(db);
  if (path === "/admin/issue") {
    const customer = customerName(body.customer);
    const days = body.days ?? 365;
    if (!Number.isInteger(days) || days < 0 || days > 36500) throw new Denied(400, "Invalid duration.");
    const { serial, hash } = await uniqueSerial(db);
    const id = crypto.randomUUID();
    const expires = days ? now2 + days * 86400 : 0;
    const cipher = await sealLicenseSerial(env, id, serial);
    await db.prepare("INSERT INTO licenses(id,serial_hash,serial_cipher,customer,customer_key,expires,status,created) VALUES(?,?,?,?,?,?,?,?)").bind(id, hash, cipher, customer, customer.toLowerCase(), expires, "active", now2).run();
    return { license_id: id, serial, expires };
  }
  if (path === "/admin/list") {
    const limit = body.limit ?? 50;
    const query = body.search ?? "";
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || typeof query !== "string" || query.length > 120) throw new Denied(400, "Invalid search.");
    const parts = [];
    const binds = [];
    const search = query.trim().toLowerCase();
    if (UUID2.test(search)) {
      parts.push("id=?");
      binds.push(search);
    } else if (search) {
      parts.push("customer_key>=? AND customer_key<?");
      binds.push(search, search + "\uFFFF");
    }
    if (body.cursor) {
      const [date, id] = cursorFrom(body.cursor);
      parts.push("(created < ? OR (created = ? AND id < ?))");
      binds.push(date, date, id);
    }
    const sql = "SELECT id,customer,expires,status,activated,created,serial_cipher,CASE WHEN machine='' THEN 0 ELSE 1 END AS device_count FROM licenses" + (parts.length ? " WHERE " + parts.join(" AND ") : "") + " ORDER BY created DESC,id DESC LIMIT ?";
    const { results } = await db.prepare(sql).bind(...binds, limit + 1).all();
    const rows = [];
    for (const row of results.slice(0, limit)) {
      const serial = await openLicenseSerial(env, row.id, row.serial_cipher);
      const { serial_cipher, ...safeRow } = row;
      rows.push({ ...safeRow, serial, serial_state: serial ? "available" : serial_cipher ? "unreadable" : "legacy" });
    }
    return { licenses: rows, next_cursor: results.length > limit ? cursorFor(rows.at(-1)) : null };
  }
  if (!["/admin/reset", "/admin/revoke", "/admin/restore", "/admin/update", "/admin/delete"].includes(path)) throw new Denied(404, "Not found.");
  if (!UUID2.test(body.license_id || "")) throw new Denied(400, "Invalid license.");
  let statement;
  if (path === "/admin/reset") statement = db.prepare("UPDATE licenses SET machine='',token_hash='',transfer_after=0 WHERE id=? RETURNING id").bind(body.license_id);
  if (path === "/admin/revoke") statement = db.prepare("UPDATE licenses SET status='revoked',token_hash='' WHERE id=? RETURNING id").bind(body.license_id);
  if (path === "/admin/restore") statement = db.prepare("UPDATE licenses SET status='active',token_hash='' WHERE id=? RETURNING id").bind(body.license_id);
  if (path === "/admin/delete") {
    const expected = customerName(body.confirm_customer);
    const current = await db.prepare("SELECT id,customer FROM licenses WHERE id=?").bind(body.license_id).first();
    if (!current) throw new Denied(404, "Not found.");
    if (current.customer.trim().toLowerCase() !== expected.trim().toLowerCase()) throw new Denied(409, "Customer name confirmation does not match.");
    statement = db.prepare("DELETE FROM licenses WHERE id=? AND lower(customer)=lower(?) RETURNING id").bind(body.license_id, current.customer);
  }
  if (path === "/admin/update") {
    const name = customerName(body.customer);
    const expires = body.expires;
    if (!Number.isSafeInteger(expires) || expires < 0 || expires > now2 + 36500 * 86400) throw new Denied(400, "Invalid expiry date.");
    if (body.serial !== undefined && body.serial !== null && String(body.serial).trim() !== "") {
      const serial = normalizeSerial(body.serial);
      const hash = await sha(serial);
      const current = await db.prepare("SELECT id,serial_hash FROM licenses WHERE id=?").bind(body.license_id).first();
      if (!current) throw new Denied(404, "Not found.");
      if (current.serial_hash === hash) throw new Denied(409, "New serial must be different from the current serial.");
      const duplicate = await db.prepare("SELECT id,customer FROM licenses WHERE serial_hash=? AND id<>? LIMIT 1").bind(hash, body.license_id).first();
      if (duplicate) throw new Denied(409, "Serial key is already used by another customer.");
      const cipher = await sealLicenseSerial(env, body.license_id, serial);
      statement = db.prepare("UPDATE licenses SET customer=?,customer_key=?,expires=?,serial_hash=?,serial_cipher=?,machine='',token_hash='',transfer_after=0,activated=0 WHERE id=? RETURNING id").bind(name, name.toLowerCase(), expires, hash, cipher, body.license_id);
    } else {
      statement = db.prepare("UPDATE licenses SET customer=?,customer_key=?,expires=? WHERE id=? RETURNING id").bind(name, name.toLowerCase(), expires, body.license_id);
    }
  }
  if (!await statement.first()) throw new Denied(404, "Not found.");
  return { ok: true };
}
__name(admin, "admin");
async function dispatch(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/integration/") || path === "/payments/toyyibpay/callback") {
    if (path === "/integration/checkout" || path === "/payments/toyyibpay/callback") await keyFor(env);
    return json(await paymentDispatch(request, env));
  }
  if (request.method === "GET") {
    if (path === "/v1/release") return json({ product: "azdm", version: "0.9.6", download_page: "https://www.azobss.com/Software-Tools/" });
    if (path === "/health") {
      await keyFor(env);
      await env.DB.prepare("SELECT 1 AS ready").first();
      return json({ ok: true, product: "azdm" });
    }
    if (["/", "/admin", "/admin/", "/admin.js", "/admin.css", "/app.svg"].includes(path)) {
      const assetUrl = new URL(url);
      if (["/", "/admin", "/admin/"].includes(path)) assetUrl.pathname = "/admin.html";
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
      const out = new Response(asset.body, asset);
      for (const [key, value] of Object.entries(headers)) out.headers.set(key, value);
      return out;
    }
    throw new Denied(404, "Not found.");
  }
  if (request.method !== "POST") throw new Denied(405, "POST required.");
  const paths = ["/v1/activate", "/v1/trial", "/v1/renew", "/v1/deactivate", "/admin/issue", "/admin/list", "/admin/update", "/admin/reset", "/admin/revoke", "/admin/restore", "/admin/delete", "/admin/orders", "/admin/order-email-retry"];
  if (!paths.includes(path)) throw new Denied(404, "Not found.");
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) throw new Denied(403, "Origin not allowed.");
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  if (!env.IP_LIMIT || !env.ACTOR_LIMIT) throw new Denied(503, "Service unavailable.");
  if (!(await env.IP_LIMIT.limit({ key: "azdm:ip:" + ip })).success) throw new Denied(429, "Try again later.");
  if (path.startsWith("/admin/")) {
    if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) throw new Denied(503, "Service unavailable.");
    const supplied = request.headers.get("Authorization") || "";
    const [actual, expected] = await Promise.all([crypto.subtle.digest("SHA-256", encoder2.encode(supplied.slice(0, 513))), crypto.subtle.digest("SHA-256", encoder2.encode("Bearer " + env.ADMIN_TOKEN))]);
    if (supplied.length > 512 || !crypto.subtle.timingSafeEqual(actual, expected))
      throw new Denied(401, "Unauthorized.");
  }
  const body = await bodyFor2(request);
  const actor = path.startsWith("/admin/") ? "owner" : await sha(String(body.activation_token || body.serial || body.machine || ip).slice(0, 200));
  if (!path.startsWith("/admin/") && !(await env.ACTOR_LIMIT.limit({ key: "azdm:actor:" + actor })).success) throw new Denied(429, "Try again later.");
  const now2 = Math.floor(Date.now() / 1e3);
  const db = env.DB;
  if (path.startsWith("/admin/")) {
    await keyFor(env);
    if (path === "/admin/orders" || path === "/admin/order-email-retry") return json(await adminPayments(path, body, env));
    return json(await admin(path, body, db, now2, env));
  }
  if (body.product !== "azdm" || typeof body.machine !== "string" || !HEX2.test(body.machine)) throw new Denied(400, "Invalid product or PC.");
  await keyFor(env);
  if (path === "/v1/trial") {
    const token = randomHex();
    const row2 = await db.prepare("INSERT INTO device_trials(id,machine,token_hash,created,expires,status) VALUES(?,?,?,?,?,'active') ON CONFLICT(machine) DO UPDATE SET token_hash=excluded.token_hash WHERE device_trials.status='active' AND device_trials.expires>? RETURNING id,machine,created,expires,status").bind(crypto.randomUUID(), body.machine, await sha(token), now2, now2 + OFFLINE, now2).first();
    if (!row2) throw new Denied(410, "The 30-day trial has ended on this PC. Activate a purchased serial key.");
    return json({ activation_token: token, lease: await lease(env, { ...row2, kind: "trial" }, now2) });
  }
  if (path === "/v1/activate") {
    const serial = typeof body.serial === "string" ? body.serial.trim().toUpperCase() : "";
    if (!SERIAL.test(serial)) throw new Denied(400, "Invalid serial.");
    const hash2 = await sha(serial);
    const token = randomHex();
    const row2 = await db.prepare("UPDATE licenses SET machine=?,token_hash=?,activated=? WHERE serial_hash=? AND status='active' AND (expires=0 OR expires>?) AND (machine=? OR (machine='' AND transfer_after<=?)) RETURNING id,machine,expires,created").bind(body.machine, await sha(token), now2, hash2, now2, body.machine, now2).first();
    if (!row2) {
      checkRow(await db.prepare("SELECT status,expires,machine,transfer_after FROM licenses WHERE serial_hash=?").bind(hash2).first(), now2, body.machine);
      throw new Denied(409, "Activation changed. Try again.");
    }
    return json({ activation_token: token, lease: await lease(env, row2, now2) });
  }
  if (typeof body.activation_token !== "string" || !HEX2.test(body.activation_token)) throw new Denied(401, "Activation not found.");
  const hash = await sha(body.activation_token);
  if (path === "/v1/deactivate") {
    const row2 = await db.prepare("UPDATE licenses SET machine='',token_hash='',transfer_after=? WHERE token_hash=? AND token_hash<>'' AND machine=? AND status='active' AND (expires=0 OR expires>?) RETURNING id").bind(now2 + 86400, hash, body.machine, now2).first();
    if (!row2) throw new Denied(401, "Activation not found.");
    return json({ ok: true });
  }
  let row = await db.prepare("SELECT id,machine,expires,created,status,transfer_after FROM licenses WHERE token_hash=? AND token_hash<>'' AND machine=?").bind(hash, body.machine).first();
  if (!row) {
    row = await db.prepare("SELECT id,machine,expires,created,status FROM device_trials WHERE token_hash=? AND machine=?").bind(hash, body.machine).first();
    if (row) row.kind = "trial";
  }
  checkRow(row, now2, body.machine);
  return json({ lease: await lease(env, row, now2) });
}
__name(dispatch, "dispatch");
var worker_default = {
  async fetch(request, env) {
    try {
      return await dispatch(request, env);
    } catch (error) {
      const known = error instanceof Denied || error instanceof PaymentError;
      return json({ error: known ? error.message : "Service unavailable." }, known ? error.status : 503);
    }
  },
  async scheduled(controller, env) {
    await recoverPayments(env);
    await retryEmails(env);
    if (controller.cron === "15 1 * * *") await env.DB.prepare("DELETE FROM audit WHERE id IN (SELECT id FROM audit WHERE time<? ORDER BY time LIMIT 1000)").bind(Math.floor(Date.now() / 1e3) - 180 * 86400).run();
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
