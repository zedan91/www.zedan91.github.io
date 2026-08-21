'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns').promises;
const net = require('net');
const zlib = require('zlib');

function createAZOBSSTVHandler(options = {}) {
  const root = __dirname;
  const dataDir = path.join(root, 'data');
  const cfgPath = path.join(root, 'default-config.json');
  const notifyPath = path.join(dataDir, 'notifications.json');
  const playlistPath = path.join(dataDir, 'free.m3u');
  const epgPath = path.join(dataDir, 'epg.xml');
  const deviceFallbackPath = path.join(dataDir, 'devices.json');
  const heartbeatFallbackPath = path.join(dataDir, 'heartbeats.json');
  const adminToken = String(options.adminToken || process.env.AZOBSSTV_ADMIN_TOKEN || '').trim();
  const getDb = typeof options.getDb === 'function' ? options.getDb : () => null;
  const authorizeAdmin = typeof options.authorizeAdmin === 'function' ? options.authorizeAdmin : null;
  const authorizeUser = typeof options.authorizeUser === 'function' ? options.authorizeUser : null;
  const parentSend = typeof options.send === 'function' ? options.send : null;
  const rateLimitOrSend = typeof options.rateLimitOrSend === 'function' ? options.rateLimitOrSend : null;

  // Curated public broadcaster/CDN hosts only. This is intentionally NOT an open proxy.
  const streamProxyHosts = new Set([
    'd25tgymtnqzu8s.cloudfront.net'
  ]);
  const mana2ScheduleCache = new Map();

  fs.mkdirSync(dataDir, { recursive: true });

  function send(res, status, body, type = 'application/json; charset=utf-8', extraHeaders = {}) {
    if (parentSend) return parentSend(res, status, body, type, extraHeaders);
    res.writeHead(status, Object.assign({
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-azobsstv-admin-token',
      'X-Content-Type-Options': 'nosniff'
    }, extraHeaders || {}));
    res.end(body);
  }

  const sendJson = (res, status, obj, extraHeaders = {}) => send(res, status, JSON.stringify(obj, null, 2), 'application/json; charset=utf-8', extraHeaders);

  function readJsonFile(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
  }
  function writeJsonFile(file, value) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.warn('AZOBSSTV local write failed:', file, err && (err.message || err));
      return false;
    }
  }
  function cleanText(value, max = 200) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  }
  function cleanUrl(value) {
    const text = cleanText(value, 2000);
    if (!text) return '';
    try {
      const u = new URL(text);
      if (!/^https?:$/.test(u.protocol)) return '';
      return u.toString();
    } catch (_) { return ''; }
  }
  function getQueryParam(parsed, name) {
    try {
      if (parsed && parsed.searchParams && typeof parsed.searchParams.get === 'function') {
        const value = parsed.searchParams.get(name);
        if (value != null) return String(value);
      }
      if (parsed && parsed.query && Object.prototype.hasOwnProperty.call(parsed.query, name)) {
        const value = parsed.query[name];
        return Array.isArray(value) ? String(value[0] == null ? '' : value[0]) : String(value == null ? '' : value);
      }
    } catch (_) {}
    return '';
  }

  function normalizeDomains(value) {
    const arr = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(/[\n,]/) : []);
    const out = [];
    for (const raw of arr) {
      let v = cleanText(raw, 300).toLowerCase();
      if (!v) continue;
      v = v.replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '');
      if (!v || !/^[a-z0-9.-]+$/.test(v)) continue;
      if (!out.includes(v)) out.push(v);
    }
    return out.slice(0, 200);
  }
  function cleanConfig(input = {}) {
    const base = readJsonFile(cfgPath, {});
    const merged = Object.assign({}, base, input || {});
    const alias = (primary, alternate) => merged[primary] != null && merged[primary] !== '' ? merged[primary] : merged[alternate];
    const allowAll = merged.allow_all_domains === true || String(merged.mode || '').toLowerCase() === 'all';
    return {
      allow_all_domains: allowAll,
      mode: allowAll ? 'all' : 'allowlist',
      allowed_domains: normalizeDomains(merged.allowed_domains != null ? merged.allowed_domains : merged.domains),
      notification_url: cleanUrl(alias('notification_url', 'notifications_url')),
      epg_url: cleanUrl(merged.epg_url),
      free_playlist_url: cleanUrl(alias('free_playlist_url', 'free_m3u_url')),
      website_url: cleanUrl(alias('website_url', 'about_website_url')),
      telegram_url: cleanUrl(alias('telegram_url', 'about_telegram_url')),
      subscribe_url: cleanUrl(alias('subscribe_url', 'about_subscribe_url')),
      device_ping_url: cleanUrl(alias('device_ping_url', 'device_register_url'))
    };
  }

  async function getConfig() {
    const db = getDb();
    if (db) {
      try {
        const snap = await db.collection('azobsstv').doc('config').get();
        if (snap.exists) return cleanConfig(snap.data() || {});
      } catch (err) {
        console.warn('AZOBSSTV Firestore config read failed:', err && (err.message || err));
      }
    }
    return cleanConfig(readJsonFile(cfgPath, {}));
  }
  async function saveConfig(input) {
    const cfg = cleanConfig(input || {});
    const db = getDb();
    if (db) {
      await db.collection('azobsstv').doc('config').set(Object.assign({}, cfg, { updated_at: Date.now() }), { merge: false });
    }
    writeJsonFile(cfgPath, cfg);
    return cfg;
  }

  function timingSafeEqualText(a, b) {
    const aa = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
  }
  async function ensureAdmin(req, res, parsed) {
    if (authorizeAdmin) {
      try {
        const identity = await authorizeAdmin(req, parsed);
        if (identity && identity.isAdmin) return identity;
      } catch (err) {
        console.warn('AZOBSSTV admin identity check failed:', err && (err.message || err));
      }
    }
    const fallback = cleanText(req.headers['x-azobsstv-admin-token'] || '', 1000);
    if (adminToken && timingSafeEqualText(fallback, adminToken)) return { isAdmin: true, authMethod: 'azobsstv-admin-token' };
    sendJson(res, 403, { ok: false, error: 'Admin authorization required.' });
    return null;
  }

  async function ensureUser(req, res, parsed) {
    if (!authorizeUser) {
      sendJson(res, 503, { ok:false, error:'User authentication service unavailable.' });
      return null;
    }
    try {
      const identity = await authorizeUser(req, parsed);
      if (identity && identity.uid) return identity;
    } catch (err) {
      console.warn('AZOBSSTV user identity check failed:', err && (err.message || err));
    }
    sendJson(res, 401, { ok:false, error:'Sign in required.' });
    return null;
  }

  function cleanLibraryList(value, limit = 500) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(value) ? value : []) {
      const v = cleanText(raw, 600).toLowerCase();
      if (!v || seen.has(v)) continue;
      if (!/^(?:mana2|url|id|name):/.test(v)) continue;
      seen.add(v); out.push(v);
      if (out.length >= limit) break;
    }
    return out;
  }

  async function getUserLibrary(identity) {
    const db = getDb();
    if (!db) return { favorites:[], recent:[] };
    const ref = db.collection('azobsstv_user_library').doc(String(identity.uid));
    const snap = await ref.get();
    if (!snap.exists) return { favorites:[], recent:[] };
    const data = snap.data() || {};
    return {
      favorites: cleanLibraryList(data.favorites, 500),
      recent: cleanLibraryList(data.recent, 60)
    };
  }

  async function saveUserLibraryCloud(identity, input) {
    const db = getDb();
    if (!db) throw Object.assign(new Error('Firestore unavailable'), { statusCode:503 });
    const favorites = cleanLibraryList(input?.favorites, 500);
    const recent = cleanLibraryList(input?.recent, 60);
    await db.collection('azobsstv_user_library').doc(String(identity.uid)).set({
      uid: String(identity.uid),
      username: cleanText(identity.username || '', 100),
      favorites,
      recent,
      updated_at: Date.now()
    }, { merge:true });
    return { favorites, recent };
  }

  function readBody(req, maxBytes = 256 * 1024) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let total = 0;
      req.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          reject(Object.assign(new Error('Body too large'), { statusCode: 413 }));
          req.destroy();
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  async function readJsonBody(req, maxBytes = 256 * 1024) {
    const buf = await readBody(req, maxBytes);
    if (!buf.length) return {};
    try { return JSON.parse(buf.toString('utf8')); }
    catch (_) { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); }
  }

  function clientIp(req) {
    return cleanText(String(req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || '', 120);
  }
  function isPrivateIPv4(ip) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      p[0] >= 224;
  }
  function isPrivateIp(ip) {
    const family = net.isIP(ip);
    if (family === 4) return isPrivateIPv4(ip);
    if (family === 6) {
      const v = ip.toLowerCase();
      return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
    }
    return true;
  }
  async function assertPublicHttpUrl(rawUrl) {
    let u;
    try { u = new URL(rawUrl); } catch (_) { throw Object.assign(new Error('Invalid URL'), { statusCode: 400 }); }
    if (!/^https?:$/.test(u.protocol)) throw Object.assign(new Error('Only HTTP/HTTPS URLs are supported'), { statusCode: 400 });
    if (u.username || u.password) {
      // Credentials are allowed for IPTV playlist URLs, but are never logged or returned by this function.
    }
    const host = u.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') throw Object.assign(new Error('Private/local host is not allowed'), { statusCode: 403 });
    const directFamily = net.isIP(host);
    if (directFamily && isPrivateIp(host)) throw Object.assign(new Error('Private/local IP is not allowed'), { statusCode: 403 });
    if (!directFamily) {
      let records;
      try { records = await dns.lookup(host, { all: true, verbatim: true }); }
      catch (_) { throw Object.assign(new Error('Unable to resolve host'), { statusCode: 502 }); }
      if (!records.length || records.some(r => isPrivateIp(String(r.address || '')))) throw Object.assign(new Error('Host resolves to a private/local IP'), { statusCode: 403 });
    }
    return u;
  }
  function domainAllowed(host, cfg) {
    const h = String(host || '').toLowerCase();
    return (cfg.allowed_domains || []).some(d => h === d || h.endsWith('.' + d));
  }
  async function assertFetchTargetAllowed(rawUrl, purpose, cfg) {
    const u = await assertPublicHttpUrl(rawUrl);
    const canonical = u.toString();
    const exactConfigured = purpose === 'playlist' ? cleanUrl(cfg.free_playlist_url) : cleanUrl(cfg.epg_url);
    if (exactConfigured && canonical === exactConfigured) return u;
    if (domainAllowed(u.hostname, cfg)) return u;
    if (cfg.allow_all_domains && String(process.env.AZOBSSTV_ALLOW_ALL_PROXY || '') === '1') return u;
    throw Object.assign(new Error('Target domain is not allowed for AZOBSSTV fetch'), { statusCode: 403 });
  }
  async function fetchBufferSafe(rawUrl, purpose, cfg, maxBytes, timeoutMs) {
    let current = await assertFetchTargetAllowed(rawUrl, purpose, cfg);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      for (let hop = 0; hop <= 4; hop++) {
        const response = await fetch(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': 'AZOBSSTV/1.0 (+https://www.azobss.com/AZOBSSTV/)', 'Accept': '*/*' }
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (hop === 4) throw Object.assign(new Error('Too many redirects'), { statusCode: 502 });
          const location = response.headers.get('location');
          if (!location) throw Object.assign(new Error('Redirect missing Location header'), { statusCode: 502 });
          current = await assertFetchTargetAllowed(new URL(location, current).toString(), purpose, cfg);
          continue;
        }
        if (!response.ok) throw Object.assign(new Error('Upstream HTTP ' + response.status), { statusCode: response.status === 404 ? 404 : 502 });
        const declared = Number(response.headers.get('content-length') || 0);
        if (declared && declared > maxBytes) throw Object.assign(new Error('Upstream response too large'), { statusCode: 413 });
        const reader = response.body && response.body.getReader ? response.body.getReader() : null;
        if (!reader) {
          const all = Buffer.from(await response.arrayBuffer());
          if (all.length > maxBytes) throw Object.assign(new Error('Upstream response too large'), { statusCode: 413 });
          return { buffer: all, contentType: response.headers.get('content-type') || '', finalUrl: current.toString() };
        }
        const chunks = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > maxBytes) {
            try { await reader.cancel(); } catch (_) {}
            throw Object.assign(new Error('Upstream response too large'), { statusCode: 413 });
          }
          chunks.push(Buffer.from(value));
        }
        return { buffer: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '', finalUrl: current.toString() };
      }
      throw Object.assign(new Error('Unable to fetch upstream content'), { statusCode: 502 });
    } finally { clearTimeout(timer); }
  }
  function proxyStreamUrl(rawUrl) {
    return '/api/azobsstv/stream?url=' + encodeURIComponent(String(rawUrl || ''));
  }
  async function assertStreamProxyTarget(rawUrl) {
    const u = await assertPublicHttpUrl(rawUrl);
    const host = u.hostname.toLowerCase();
    if (!streamProxyHosts.has(host)) throw Object.assign(new Error('Stream relay host is not allowed'), { statusCode: 403 });
    return u;
  }
  function rewriteHlsForRelay(text, baseUrl) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    return lines.map(line => {
      if (!line) return line;
      if (line.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, raw) => {
          try { return 'URI="' + proxyStreamUrl(new URL(raw, baseUrl).toString()) + '"'; }
          catch (_) { return 'URI="' + raw + '"'; }
        });
      }
      try { return proxyStreamUrl(new URL(line.trim(), baseUrl).toString()); }
      catch (_) { return line; }
    }).join('\n');
  }
  async function relayStream(req, res, rawUrl) {
    let current = await assertStreamProxyTarget(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      for (let hop = 0; hop <= 4; hop++) {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          'Accept': req.headers.accept || 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
        };
        // RTM's public HLS CDN is normally requested from the official RTMKlik player.
        // Send the official public page as Referer for compatibility; no token/cookie/credential is added.
        if (current.hostname.toLowerCase() === 'd25tgymtnqzu8s.cloudfront.net') {
          headers.Referer = 'https://rtmklik.rtm.gov.my/';
          headers.Origin = 'https://rtmklik.rtm.gov.my';
          headers['Accept-Language'] = 'ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7';
        }
        if (req.headers.range) headers.Range = cleanText(req.headers.range, 200);
        const upstream = await fetch(current.toString(), {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers
        });
        if ([301, 302, 303, 307, 308].includes(upstream.status)) {
          if (hop === 4) throw Object.assign(new Error('Too many stream redirects'), { statusCode: 502 });
          const location = upstream.headers.get('location');
          if (!location) throw Object.assign(new Error('Stream redirect missing Location'), { statusCode: 502 });
          current = await assertStreamProxyTarget(new URL(location, current).toString());
          continue;
        }
        if (!upstream.ok && upstream.status !== 206) {
          const upstreamStatus = Number(upstream.status) || 502;
          // Preserve normal 4xx codes so the frontend can distinguish an upstream block from a relay failure.
          const publicStatus = upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502;
          throw Object.assign(new Error('Upstream stream HTTP ' + upstreamStatus), { statusCode: publicStatus, publicMessage: 'Upstream stream HTTP ' + upstreamStatus });
        }
        const contentType = upstream.headers.get('content-type') || '';
        const isHls = /mpegurl/i.test(contentType) || /\.m3u8$/i.test(current.pathname);
        if (isHls && req.method !== 'HEAD') {
          const buf = Buffer.from(await upstream.arrayBuffer());
          if (buf.length > 4 * 1024 * 1024) throw Object.assign(new Error('HLS manifest too large'), { statusCode: 413 });
          const body = rewriteHlsForRelay(buf.toString('utf8'), current.toString());
          send(res, 200, body, 'application/vnd.apple.mpegurl; charset=utf-8', {
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          });
          return;
        }
        const outHeaders = {
          'Content-Type': contentType || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          'X-Content-Type-Options': 'nosniff'
        };
        for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
          const v = upstream.headers.get(h);
          if (v) outHeaders[h.split('-').map(x => x.charAt(0).toUpperCase()+x.slice(1)).join('-')] = v;
        }
        res.writeHead(upstream.status, outHeaders);
        if (req.method === 'HEAD' || !upstream.body) { res.end(); return; }
        const reader = upstream.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(Buffer.from(value))) await new Promise(resolve => res.once('drain', resolve));
        }
        res.end();
        return;
      }
      throw Object.assign(new Error('Unable to relay stream'), { statusCode: 502 });
    } finally {
      clearTimeout(timer);
    }
  }

  function maybeGunzip(buffer) {
    if (buffer && buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
      try { return zlib.gunzipSync(buffer); } catch (_) {}
    }
    return buffer;
  }

  async function readNotifications() {
    const db = getDb();
    if (db) {
      try {
        const snap = await db.collection('azobsstvNotifications').orderBy('timestamp', 'asc').limit(100).get();
        return snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
      } catch (err) {
        console.warn('AZOBSSTV notification Firestore read failed:', err && (err.message || err));
      }
    }
    const local = readJsonFile(notifyPath, { items: [] });
    return Array.isArray(local) ? local : (Array.isArray(local.items) ? local.items : []);
  }
  async function readDevices() {
    const now = Date.now();
    const db = getDb();
    let rows = [];
    if (db) {
      try {
        const snap = await db.collection('azobsstvDevices').orderBy('updated_at', 'desc').limit(250).get();
        rows = snap.docs.map(doc => ({ device_id: doc.id, ...(doc.data() || {}) }));
      } catch (err) {
        console.warn('AZOBSSTV device Firestore read failed:', err && (err.message || err));
      }
    }
    if (!rows.length) {
      const local = readJsonFile(deviceFallbackPath, { items: [] });
      rows = Array.isArray(local.items) ? local.items : [];
    }
    return rows.map(x => ({ ...x, online: now - Number(x.updated_at || x.time_ms || 0) <= 90_000 }));
  }
  async function savePing(payload) {
    const db = getDb();
    if (db) {
      await db.collection('azobsstvDevices').doc(payload.device_id).set(payload, { merge: true });
      const expiresAtMs = Date.now() + 14 * 24 * 60 * 60 * 1000;
      await db.collection('azobsstvHeartbeats').add(Object.assign({}, payload, { expires_at: new Date(expiresAtMs), expires_at_ms: expiresAtMs }));
      return;
    }
    const devices = readJsonFile(deviceFallbackPath, { items: [] });
    const items = Array.isArray(devices.items) ? devices.items : [];
    const next = [payload, ...items.filter(x => String(x.device_id) !== payload.device_id)].slice(0, 250);
    writeJsonFile(deviceFallbackPath, { items: next });
    const heartbeats = readJsonFile(heartbeatFallbackPath, { items: [] });
    writeJsonFile(heartbeatFallbackPath, { items: [payload, ...(Array.isArray(heartbeats.items) ? heartbeats.items : [])].slice(0, 1000) });
  }

  function decodeHtmlEntities(text) {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
      if (code[0] === '#') {
        const hex = code[1] && code[1].toLowerCase() === 'x';
        const n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return Object.prototype.hasOwnProperty.call(named, code.toLowerCase()) ? named[code.toLowerCase()] : m;
    });
  }
  function mana2ChannelUrl(raw) {
    const cleaned = cleanUrl(raw);
    if (!cleaned) throw Object.assign(new Error('Valid Mana-Mana channel url required'), { statusCode: 400 });
    const u = new URL(cleaned);
    const host = u.hostname.toLowerCase();
    if (host !== 'mana2.my' && host !== 'www.mana2.my') throw Object.assign(new Error('Only mana2.my channel pages are supported'), { statusCode: 403 });
    if (!u.pathname.startsWith('/channel/')) throw Object.assign(new Error('Only Mana-Mana channel pages are supported'), { statusCode: 403 });
    u.protocol = 'https:'; u.username = ''; u.password = ''; u.hash = '';
    return u;
  }
  function htmlLinesForSchedule(html) {
    let text = String(html || '');
    text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
      .replace(/<\/(?:div|p|li|h[1-6]|section|article|tr|td|th|header|footer|span|strong|b)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    text = decodeHtmlEntities(text).replace(/\r/g, '');
    return text.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  function decodeMana2ScriptText(text) {
    let s = decodeHtmlEntities(String(text || ''));
    // Next.js / React Server Components frequently serialize the useful page text
    // inside script strings. Decode only textual escapes; do not execute scripts.
    s = s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\n|\\r|\\t/g, '\n')
      .replace(/\\\//g, '/')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    return s;
  }
  function collectJsonStrings(value, out, depth = 0) {
    if (depth > 14 || value == null) return;
    if (typeof value === 'string') { if (value.trim()) out.push(value); return; }
    if (Array.isArray(value)) { for (const x of value) collectJsonStrings(x, out, depth + 1); return; }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (typeof k === 'string') out.push(k);
        collectJsonStrings(v, out, depth + 1);
      }
    }
  }
  function mana2EmbeddedLines(html) {
    const out = [];
    const source = String(html || '');
    const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptRe.exec(source)) && out.length < 12000) {
      const raw = String(m[1] || '').trim();
      if (!raw) continue;
      let handled = false;
      // __NEXT_DATA__ and other plain JSON scripts.
      if ((raw[0] === '{' && raw.endsWith('}')) || (raw[0] === '[' && raw.endsWith(']'))) {
        try {
          const strings = []; collectJsonStrings(JSON.parse(raw), strings);
          if (strings.length) { out.push(...strings); handled = true; }
        } catch (_) {}
      }
      // Next.js app-router flight chunks: self.__next_f.push([1,"..."])
      const flightRe = /self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:\\.|[^"\\])*")\s*\]\)/g;
      let f, flightFound = false;
      while ((f = flightRe.exec(raw))) {
        flightFound = true;
        try { out.push(JSON.parse(f[1])); } catch (_) { out.push(f[1].slice(1, -1)); }
      }
      handled = handled || flightFound;
      // Generic textual copy only when the script was not already decoded above.
      if (!handled) out.push(decodeMana2ScriptText(raw));
    }
    const normalized = decodeMana2ScriptText(out.join('\n'))
      .replace(/[{}\[\],]/g, '\n')
      .replace(/(?:\\?"\s*:\s*\\?")/g, '\n')
      .replace(/\\?"/g, ' ')
      .replace(/\r/g, '');
    return normalized.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  function scheduleTimeTokens(text) {
    return String(text || '').match(/\b(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)\b/gi) || [];
  }
  function normalizeScheduleTime(text) {
    const m = String(text || '').match(/\b(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)\b/i);
    return m ? `${Number(m[1])}:${m[2]} ${m[3].toUpperCase()}` : '';
  }
  function minutesFromScheduleTime(text) {
    const m = normalizeScheduleTime(text).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = Number(m[1]) % 12; if (m[3].toUpperCase() === 'PM') h += 12;
    return h * 60 + Number(m[2]);
  }
  function malaysiaMinuteNow() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date());
      const h = parts.find(x => x.type === 'hour')?.value || '12';
      const m = parts.find(x => x.type === 'minute')?.value || '00';
      const p = parts.find(x => x.type === 'dayPeriod')?.value || 'AM';
      return minutesFromScheduleTime(`${h}:${m} ${p}`);
    } catch (_) { const d = new Date(Date.now() + 8 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); }
  }
  function scheduleItemCurrent(item, nowMin) {
    const a = minutesFromScheduleTime(item.start), b = minutesFromScheduleTime(item.end);
    if (a == null || b == null || nowMin == null) return false;
    return a <= b ? nowMin >= a && nowMin < b : (nowMin >= a || nowMin < b);
  }
  function cleanProgramTitle(text) {
    let t = cleanText(decodeHtmlEntities(text), 220)
      .replace(/^[\s:|,;\-–—•·.]+|[\s:|,;\-–—•·]+$/g, '').trim();
    t = t.replace(/\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+[A-Za-z]{3}.*$/i, '').trim();
    t = t.replace(/^(?:LIVE|ON NOW|UP NEXT|TODAY'?S SCHEDULE|READ MORE)\s*/i, '').trim();
    return t.slice(0, 140);
  }
  function isScheduleNoise(text) {
    const t = cleanProgramTitle(text);
    return !t || /^(?:live|on now|up next|today'?s schedule|read more|ch\s*\d+|tv\d?|thu,?\s+\d+\s+aug|mon|tue|wed|thu|fri|sat|sun)$/i.test(t);
  }
  function firstTitleFromSegment(text) {
    let t = cleanProgramTitle(String(text || '').replace(/\s+/g, ' '));
    if (!t) return '';
    t = t.replace(/^(?:CH\s*\d+\s*)/i, '').trim();
    // Search-indexed Mana-Mana text commonly appears as: Title. Description...
    const sentence = t.match(/^(.{2,120}?)(?:\.\s+(?=[A-Z0-9#])|\s+Live\b|\s+Read more\b|$)/i);
    if (sentence && sentence[1]) t = sentence[1].trim();
    return isScheduleNoise(t) ? '' : t.slice(0, 120);
  }
  function parseScheduleFromLines(lines) {
    const schedule = [];
    const startIdx = lines.findIndex(x => /today'?s\s+schedule/i.test(x));
    if (startIdx < 0) return schedule;
    for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 420) && schedule.length < 64; i++) {
      const line = lines[i];
      const times = scheduleTimeTokens(line);
      let start = '', end = '', title = '';
      if (times.length >= 2) {
        start = normalizeScheduleTime(times[0]); end = normalizeScheduleTime(times[1]);
        const secondPos = line.toLowerCase().indexOf(times[1].toLowerCase(), line.toLowerCase().indexOf(times[0].toLowerCase()) + times[0].length);
        title = firstTitleFromSegment(secondPos >= 0 ? line.slice(secondPos + times[1].length) : '');
        if (!title) {
          for (let k = i + 1; k < Math.min(lines.length, i + 7); k++) {
            if (scheduleTimeTokens(lines[k]).length) break;
            const candidate = firstTitleFromSegment(lines[k]);
            if (candidate) { title = candidate; break; }
          }
        }
      } else if (times.length === 1) {
        start = normalizeScheduleTime(times[0]);
        let j = i + 1, between = [];
        for (; j < Math.min(lines.length, i + 9); j++) {
          const t2 = scheduleTimeTokens(lines[j]);
          if (t2.length) { end = normalizeScheduleTime(t2[0]); break; }
          if (!isScheduleNoise(lines[j])) between.push(lines[j]);
        }
        // Support both DOM orders:
        // start -> end -> title, and start -> title -> end.
        if (between.length) title = firstTitleFromSegment(between[0]);
        if (end && !title) {
          for (let k = j + 1; k < Math.min(lines.length, j + 8); k++) {
            if (scheduleTimeTokens(lines[k]).length) break;
            const candidate = firstTitleFromSegment(lines[k]);
            if (candidate) { title = candidate; break; }
          }
        }
        // The time at lines[j] is the end of this row; do not reuse it as the
        // start of a duplicate row on the next loop iteration.
        if (end && j > i) i = j;
      }
      if (start && end && title && !schedule.some(x => x.start === start && x.end === end && x.title === title)) {
        schedule.push({ start, end, title });
      }
    }
    return schedule;
  }
  function parseScheduleFromCorpus(text) {
    const schedule = [];
    const src = String(text || '');
    const marker = src.search(/today'?s\s+schedule/i);
    const body = marker >= 0 ? src.slice(marker, marker + 180000) : src;
    const timeRe = /\b(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)\b/gi;
    const hits = [];
    let m;
    while ((m = timeRe.exec(body)) && hits.length < 160) hits.push({ raw: m[0], index: m.index, end: timeRe.lastIndex });
    // Mana-Mana's public schedule markup/search text exposes start+end as consecutive time tokens.
    for (let i = 0; i + 1 < hits.length && schedule.length < 64; i += 2) {
      const a = hits[i], b = hits[i + 1];
      if (b.index - a.end > 260) { i -= 1; continue; }
      const nextStart = hits[i + 2]?.index ?? Math.min(body.length, b.end + 900);
      const segment = body.slice(b.end, nextStart)
        .replace(/[{}\[\]"']/g, ' ')
        .replace(/\\[nrt]/g, ' ')
        .replace(/\s+/g, ' ');
      const title = firstTitleFromSegment(segment);
      const start = normalizeScheduleTime(a.raw), end = normalizeScheduleTime(b.raw);
      if (start && end && title && !schedule.some(x => x.start === start && x.end === end && x.title === title)) {
        schedule.push({ start, end, title });
      }
    }
    return schedule;
  }
  function extractMana2Schedule(html) {
    const visibleLines = htmlLinesForSchedule(html);
    const embeddedLines = mana2EmbeddedLines(html);
    let schedule = parseScheduleFromLines(visibleLines);
    if (schedule.length < 2) {
      const fromEmbedded = parseScheduleFromLines(embeddedLines);
      if (fromEmbedded.length > schedule.length) schedule = fromEmbedded;
    }
    if (schedule.length < 2) {
      const corpus = [...visibleLines, ...embeddedLines].join(' ');
      const fromCorpus = parseScheduleFromCorpus(corpus);
      if (fromCorpus.length > schedule.length) schedule = fromCorpus;
    }
    const nowMin = malaysiaMinuteNow();
    for (const item of schedule) item.current = scheduleItemCurrent(item, nowMin);
    const active = schedule.find(x => x.current);
    let currentTitle = active?.title || '';
    // Extra ON NOW fallback if schedule timing was incomplete.
    if (!currentTitle) {
      const allLines = [...visibleLines, ...embeddedLines];
      const onNow = allLines.findIndex(x => /^on\s*now$/i.test(x));
      if (onNow >= 0) {
        for (let i = onNow + 1; i < Math.min(allLines.length, onNow + 12); i++) {
          if (scheduleTimeTokens(allLines[i]).length || isScheduleNoise(allLines[i])) continue;
          const candidate = firstTitleFromSegment(allLines[i]);
          if (candidate) { currentTitle = candidate; break; }
        }
      }
    }
    return { current_title: currentTitle, schedule, parser: schedule.length ? 'visible-or-nextjs' : 'none' };
  }

  // v982: Mana-Mana's public page is only the presentation layer. The public
  // WebGrab+Plus siteini for mana2.my documents the Revlet TV-guide service used
  // by Mana-Mana itself. Prefer that structured guide API, then fall back to the
  // v980 HTML/Next.js parser if the upstream guide service changes or is down.
  const MANA2_BOX_ID = '4060504e-85be-09e2-6b03-e55bd34559f1';
  const mana2SessionCache = { sessionId: '', savedAt: 0 };
  const mana2ChannelCache = { items: [], savedAt: 0 };


  // v983+: read programme TEXT from the actually rendered public Mana-Mana page.
  // Only one browser page is created server-side, media is blocked, and audio is muted.
  // This replaces v982's two extra client iframes (the source of duplicate audio).
  let mana2BrowserPromise = null;
  async function getMana2Browser() {
    if (mana2BrowserPromise) return mana2BrowserPromise;
    mana2BrowserPromise = (async () => {
      const puppeteer = require('puppeteer-core');
      const executablePath = process.env.AZOBSSTV_CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
      const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--mute-audio','--autoplay-policy=user-gesture-required','--no-first-run','--no-zygote','--disable-background-networking','--disable-default-apps','--disable-extensions','--disable-sync'],
        defaultViewport: { width: 1280, height: 1080, deviceScaleFactor: 1 }
      });
      browser.on('disconnected', () => { mana2BrowserPromise = null; });
      return browser;
    })().catch(err => { mana2BrowserPromise = null; throw err; });
    return mana2BrowserPromise;
  }

  function parseRenderedMana2Text(bodyText) {
    const lines = String(bodyText || '').replace(/\r/g, '').split(/\n+/).map(x => cleanText(x, 1200).replace(/\s+/g, ' ').trim()).filter(Boolean);
    let schedule = parseScheduleFromLines(lines);
    if (schedule.length < 2) {
      const alt = parseScheduleFromCorpus(lines.join(' '));
      if (alt.length > schedule.length) schedule = alt;
    }
    const nowMin = malaysiaMinuteNow();
    for (const item of schedule) item.current = scheduleItemCurrent(item, nowMin);
    let currentTitle = schedule.find(x => x.current)?.title || '';
    if (!currentTitle) {
      const onNow = lines.findIndex(x => /^ON\s+NOW$/i.test(x));
      if (onNow >= 0) {
        for (let i = onNow + 1; i < Math.min(lines.length, onNow + 14); i++) {
          if (/^CH\s*\d+/i.test(lines[i]) || scheduleTimeTokens(lines[i]).length || isScheduleNoise(lines[i])) continue;
          const candidate = firstTitleFromSegment(lines[i]);
          if (candidate) { currentTitle = candidate; break; }
        }
      }
    }
    return { current_title: currentTitle, schedule };
  }

  async function getMana2RenderedSchedule(rawUrl) {
    const target = mana2ChannelUrl(rawUrl);
    const browser = await getMana2Browser();
    const page = await browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8' });
      await page.setRequestInterception(true);
      page.on('request', req => {
        try {
          const type = req.resourceType(), u = req.url();
          if (type === 'media' || type === 'image' || type === 'font' || /\.(?:m3u8?|mpd|mp4|m4s|ts|webm|mp3|aac)(?:$|[?#])/i.test(u)) return req.abort();
          req.continue();
        } catch (_) { try { req.continue(); } catch (_) {} }
      });
      await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 18000 });
      try { await page.waitForFunction(() => /TODAY['’]?S\s+SCHEDULE/i.test(document.body?.innerText || ''), { timeout: 9000 }); }
      catch (_) { await new Promise(r => setTimeout(r, 1800)); }
      // v986: extract the schedule from the rendered DOM structure first instead of
      // flattening the whole page into innerText.  Mana-Mana renders each programme
      // title and synopsis as separate styled elements; flattening them was the reason
      // descriptions could be appended to the title even though the frontend rendered
      // only item.title.
      const domParsed = await page.evaluate(() => {
        const norm = v => String(v || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const timeRe = /^(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)$/i;
        const noiseRe = /^(?:LIVE|ON NOW|UP NEXT|TODAY['’]?S SCHEDULE|READ MORE|CH\s*\d+)$/i;
        const visible = el => {
          if (!el || !el.getBoundingClientRect) return false;
          const st = getComputedStyle(el), r = el.getBoundingClientRect();
          return st.display !== 'none' && st.visibility !== 'hidden' && Number(st.opacity || 1) !== 0 && r.width > 0 && r.height > 0;
        };
        const ownText = el => {
          let out = '';
          for (const n of el.childNodes || []) if (n.nodeType === Node.TEXT_NODE) out += ' ' + n.nodeValue;
          return norm(out);
        };
        const exactText = el => norm(el?.textContent || '');
        const all = Array.from(document.querySelectorAll('body *')).filter(visible);
        const exactTimes = all.filter(el => timeRe.test(exactText(el)) && exactText(el).length <= 12);
        const timeCount = el => {
          let n = 0;
          for (const d of el.querySelectorAll('*')) {
            const t = exactText(d);
            if (t.length <= 12 && timeRe.test(t) && visible(d)) n++;
          }
          const self = exactText(el);
          if (!el.children.length && self.length <= 12 && timeRe.test(self)) n = Math.max(n, 1);
          return n;
        };
        let heading = all.find(el => /^TODAY['’]?S SCHEDULE$/i.test(exactText(el)));
        let scope = null;
        if (heading) {
          let cur = heading;
          for (let depth = 0; cur && depth < 8; depth++, cur = cur.parentElement) {
            const c = timeCount(cur);
            const txt = exactText(cur);
            if (c >= 4 && txt.length < 12000) { scope = cur; break; }
          }
        }
        if (!scope) scope = document.body;

        const leaves = root => Array.from(root.querySelectorAll('*')).filter(el => {
          if (!visible(el)) return false;
          const t = exactText(el);
          if (!t || t.length > 500) return false;
          // Prefer true text leaves. If nested, keep only elements that have useful own text.
          return el.children.length === 0 || !!ownText(el);
        });
        const schedule = [];
        const seenRows = new Set();
        const times = Array.from(scope.querySelectorAll('*')).filter(el => visible(el) && timeRe.test(exactText(el)) && exactText(el).length <= 12);
        for (const tEl of times) {
          let row = tEl;
          for (let depth = 0; row && row !== scope && depth < 7; depth++, row = row.parentElement) {
            const txt = exactText(row);
            const ts = (txt.match(/\b(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)\b/gi) || []);
            if (ts.length >= 2 && ts.length <= 3 && txt.length < 1400) break;
          }
          if (!row || row === scope || seenRows.has(row)) continue;
          seenRows.add(row);
          const rowText = exactText(row);
          const tm = rowText.match(/\b(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)\b/gi) || [];
          if (tm.length < 2) continue;
          const candidates = leaves(row).map((el, idx) => {
            const text = norm(ownText(el) || (el.children.length === 0 ? el.textContent : ''));
            const st = getComputedStyle(el);
            const fwRaw = st.fontWeight || '400';
            const fw = /^bold$/i.test(fwRaw) ? 700 : (parseInt(fwRaw, 10) || 400);
            const fs = parseFloat(st.fontSize || '0') || 0;
            return { text, fw, fs, idx };
          }).filter(x => x.text && !timeRe.test(x.text) && !noiseRe.test(x.text) && !/^THU|^MON|^TUE|^WED|^FRI|^SAT|^SUN/i.test(x.text));
          // Deduplicate identical nested text snippets while preserving DOM order.
          const unique = [];
          const seen = new Set();
          for (const c of candidates) {
            const k = c.text.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k); unique.push(c);
          }
          // Programme titles on Mana-Mana are visually stronger than their synopsis.
          // Pick the first high-weight candidate; otherwise the first short candidate.
          let titleCand = unique.find(x => x.fw >= 600 && x.text.length <= 180);
          if (!titleCand) titleCand = unique.find(x => x.text.length <= 180);
          if (!titleCand) continue;
          const title = titleCand.text.replace(/^[-–—•.:\s]+|[-–—•.:\s]+$/g, '').trim();
          if (!title || title.length < 2) continue;
          schedule.push({ start: tm[0].toUpperCase(), end: tm[1].toUpperCase(), title: title.slice(0, 180) });
        }
        // Keep DOM order but remove duplicate start/end/title rows.
        const uniq = [];
        const keys = new Set();
        for (const r of schedule) {
          const k = `${r.start}|${r.end}|${r.title.toLowerCase()}`;
          if (!keys.has(k)) { keys.add(k); uniq.push(r); }
        }

        let currentTitle = '';
        const onNow = all.find(el => /^ON NOW$/i.test(exactText(el)));
        if (onNow) {
          let box = onNow;
          for (let depth = 0; box && depth < 6; depth++, box = box.parentElement) {
            const txt = exactText(box);
            if (txt.length > 20 && txt.length < 2500 && /ON NOW/i.test(txt)) break;
          }
          if (box) {
            const cands = leaves(box).map((el, idx) => {
              const text = norm(ownText(el) || (el.children.length === 0 ? el.textContent : ''));
              const st = getComputedStyle(el); const raw = st.fontWeight || '400';
              return { text, fw: /^bold$/i.test(raw) ? 700 : (parseInt(raw,10)||400), idx };
            }).filter(x => x.text && !noiseRe.test(x.text) && !timeRe.test(x.text) && !/^TV\d?$/i.test(x.text));
            currentTitle = (cands.find(x => x.fw >= 600 && x.text.length <= 180) || cands.find(x => x.text.length <= 180) || {}).text || '';
          }
        }
        return { current_title: currentTitle, schedule: uniq.slice(0, 64) };
      });
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      const textParsed = parseRenderedMana2Text(bodyText);
      const parsed = (domParsed && Array.isArray(domParsed.schedule) && domParsed.schedule.length >= 2)
        ? domParsed : textParsed;
      const nowMin = malaysiaMinuteNow();
      for (const item of parsed.schedule || []) item.current = scheduleItemCurrent(item, nowMin);
      if (!parsed.current_title) parsed.current_title = (parsed.schedule || []).find(x => x.current)?.title || '';
      if (!parsed.schedule.length && !parsed.current_title) throw Object.assign(new Error('Mana-Mana rendered page returned no programme text'), { statusCode: 404 });
      return { ok:true, channel_url:target.toString(), current_title:parsed.current_title||'', schedule:parsed.schedule||[], parser:(parsed===domParsed?'rendered-dom-structured':'rendered-dom-text-fallback'), fetched_at:Date.now(), time_zone:'Asia/Kuala_Lumpur' };
    } finally { try { await page.close({ runBeforeUnload:false }); } catch (_) {} }
  }

  function mana2ApiHeaders(sessionId = '') {
    const headers = {
      'Tenant-Code': 'mytv',
      'Box-Id': MANA2_BOX_ID,
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36'
    };
    if (sessionId) headers['Session-Id'] = sessionId;
    return headers;
  }

  async function fetchJsonTimed(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { redirect: 'follow', ...options, signal: controller.signal });
      const body = await response.text();
      if (!response.ok) {
        const err = new Error(`Upstream API HTTP ${response.status}`);
        err.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        err.responseBody = body.slice(0, 400);
        throw err;
      }
      try { return JSON.parse(body); }
      catch (_) {
        const err = new Error('Upstream API returned invalid JSON');
        err.statusCode = 502;
        throw err;
      }
    } finally { clearTimeout(timer); }
  }


  // v1024: 1Tube public Movies discovery metadata.
  // Metadata only: no player URL, media manifest, DRM token, cookie or account
  // credential is fetched or returned by this integration.
  const oneTubeMovieCache = { items: [], savedAt: 0, pages: 0 };
  function oneTubeHeaders() {
    return {
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'en-MY,en;q=0.9',
      'Referer': 'https://www.1tube.org/movies',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36'
    };
  }
  function oneTubeArtwork(raw) {
    const value = cleanText(raw, 1500);
    if (!value) return '';
    let target = value;
    if (target.startsWith('/')) target = 'https://image.tmdb.org/t/p/w780' + target;
    else if (!/^https?:\/\//i.test(target) && /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(target)) target = 'https://image.tmdb.org/t/p/w780/' + target.replace(/^\/+/, '');
    if (!/^https?:\/\//i.test(target)) return '';
    // Mirror 1Tube's observed metadata-card image style via wsrv.nl.
    if (/^https?:\/\/wsrv\.nl\//i.test(target)) return target;
    if (/image\.tmdb\.org\//i.test(target)) return 'https://wsrv.nl/?url=' + encodeURIComponent(target);
    return target;
  }
  function oneTubeMovieFromObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const rawId = obj.id ?? obj.tmdbId ?? obj.tmdb_id ?? obj.movieId ?? obj.movie_id;
    const id = cleanText(rawId, 40).replace(/[^0-9]/g, '');
    // v1024: TMDB movie rows expose title/original_title. Never accept a
    // generic `name` here: nested production companies also have id+name and
    // were the source of false Movies such as Marvel Studios/Universal Pictures.
    const name = cleanText(obj.title ?? obj.original_title ?? obj.originalTitle, 220);
    if (!id || !name) return null;
    const date = cleanText(obj.release_date ?? obj.releaseDate ?? obj.year ?? obj.first_air_date, 40);
    const yearMatch = date.match(/(?:19|20)\d{2}/);
    const ratingRaw = obj.vote_average ?? obj.voteAverage ?? obj.rating ?? obj.score ?? '';
    let rating = cleanText(ratingRaw, 20);
    if (rating) {
      const n = Number(rating);
      if (Number.isFinite(n)) rating = n.toFixed(1).replace(/\.0$/, '.0');
    }
    const artwork = oneTubeArtwork(obj.backdrop_path ?? obj.backdropPath ?? obj.poster_path ?? obj.posterPath ?? obj.backdrop ?? obj.poster ?? obj.image ?? obj.thumbnail);
    // AZOBSSTV Movies is visual; skip incomplete upstream rows instead of
    // showing a blank initials card in the catalogue.
    if (!artwork) return null;
    const genres = [];
    const rawGenres = Array.isArray(obj.genres) ? obj.genres : (Array.isArray(obj.genre_ids) ? obj.genre_ids : []);
    for (const g of rawGenres) {
      const label = cleanText(g && typeof g === 'object' ? (g.name ?? g.title ?? g.id) : g, 60);
      if (label && !genres.includes(label)) genres.push(label);
      if (genres.length >= 8) break;
    }
    return {
      id: '1tube-movie-' + id,
      tmdbId: id,
      name,
      year: yearMatch ? Number(yearMatch[0]) : null,
      rating,
      logo: artwork,
      sourcePage: 'https://www.1tube.org/watch/' + encodeURIComponent(id),
      categories: ['Movies', '1Tube', ...genres].slice(0, 10),
      sourceProvider: '1tube'
    };
  }
  function collectOneTubeMovies(payload) {
    const out = [];
    const seenObjects = new Set();
    const seenIds = new Set();
    function walk(value, depth = 0) {
      if (value == null || depth > 5) return;
      if (Array.isArray(value)) {
        for (const row of value.slice(0, 1000)) walk(row, depth + 1);
        return;
      }
      if (typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      const movie = oneTubeMovieFromObject(value);
      if (movie && !seenIds.has(movie.tmdbId)) { seenIds.add(movie.tmdbId); out.push(movie); }
      for (const [key, child] of Object.entries(value)) {
        if (['videos','streams','sources','servers','embeds','player','manifest','playback'].includes(String(key).toLowerCase())) continue;
        if (child && (Array.isArray(child) || typeof child === 'object')) walk(child, depth + 1);
      }
    }
    walk(payload, 0);
    return out;
  }
  async function getOneTubeMovies(pageCount = 4, force = false) {
    const pages = Math.max(1, Math.min(8, Number(pageCount) || 4));
    if (!force && oneTubeMovieCache.items.length && oneTubeMovieCache.pages >= pages && Date.now() - oneTubeMovieCache.savedAt < 10 * 60_000) {
      return { items: oneTubeMovieCache.items, pages: oneTubeMovieCache.pages, source: 'cache' };
    }
    const merged = [];
    const seen = new Set();
    const warnings = [];
    for (let page = 1; page <= pages; page++) {
      try {
        const payload = await fetchJsonTimed('https://www.1tube.org/api/discover/movies?page=' + page, { method:'GET', headers:oneTubeHeaders() }, 15000);
        const rows = collectOneTubeMovies(payload);
        if (!rows.length) { warnings.push('page-' + page + '-empty'); break; }
        for (const row of rows) {
          if (!row.tmdbId || seen.has(row.tmdbId)) continue;
          seen.add(row.tmdbId); merged.push(row);
        }
      } catch (err) {
        warnings.push('page-' + page + ':' + cleanText(err && err.message, 120));
        if (!merged.length) throw err;
        break;
      }
    }
    if (!merged.length) throw Object.assign(new Error('1Tube Movies metadata returned no catalogue items'), { statusCode: 502 });
    oneTubeMovieCache.items = merged;
    oneTubeMovieCache.savedAt = Date.now();
    oneTubeMovieCache.pages = pages;
    return { items: merged, pages, source: '1tube-discover-api', warnings };
  }


  // v1028: Radio-Online.my public station catalogue metadata.
  // This integration intentionally handles station metadata and station page/logo
  // URLs only. It does not extract, relay or expose audio stream URLs.
  const RADIO_ONLINE_BASE = 'https://radio-online.my';
  const RADIO_ONLINE_API = RADIO_ONLINE_BASE + '/api/countries/36/radios';
  const radioOnlineCatalogCache = { items: [], savedAt: 0 };
  const radioOnlineLogoCache = new Map();

  function radioOnlineHeaders(accept = 'application/json,text/plain,*/*') {
    return {
      'Accept': accept,
      'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8',
      'Referer': RADIO_ONLINE_BASE + '/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36'
    };
  }

  function radioOnlineAssetUrl(raw) {
    let value = cleanText(raw, 1800);
    if (!value) return '';
    value = value.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    try {
      const u = new URL(value, RADIO_ONLINE_BASE + '/');
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      // Prefer the provider's own artwork CDN/path. External presenter images
      // are not required for station cards.
      if (u.hostname !== 'radio-online.my' && !u.hostname.endsWith('.radio-online.my')) return '';
      return u.toString();
    } catch (_) {
      return '';
    }
  }

  function radioOnlineSlug(raw) {
    const value = cleanText(raw, 500);
    if (!value) return '';
    let path = value;
    try { path = new URL(value, RADIO_ONLINE_BASE + '/').pathname; } catch (_) {}
    path = String(path || '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
    if (!path || path.includes('/')) return '';
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(path)) return '';
    return path.toLowerCase();
  }

  function radioOnlineNonStation(slug, name) {
    const s = String(slug || '').toLowerCase();
    const n = String(name || '').trim().toLowerCase();
    const exact = new Set([
      'terms-of-service','about-us','contact-us','privacy-policy','dmca','help',
      'radio-televisyen-malaysia','indonesia','thailand','singapore','brunei',
      'states','cities','genres','language','by-countries','search','add-radio',
      'alor-setar','cyberjaya','georgetown','ipoh','johor','johor-bahru','kedah',
      'state-kelantan','kota-bharu','kota-kinabalu','kuala-lumpur','kuala-selangor',
      'kuala-terengganu','kuantan','kuching','labuan','langkawi','klang','malacca',
      'miri','negeri-sembilan','pahang','penang','perak','state-perlis','petaling-jaya',
      'putrajaya','sabah','sandakan','sarawak','selangor','seremban','taiping','tawau',
      'terengganu','astro-malaysia-holdings'
    ]);
    if (exact.has(s)) return true;
    if (/^(?:radio stations? in |radio stations? of |malaysian radio stations|list radio stations|about us$|contact us$|privacy policy$)/i.test(n)) return true;
    if (/terms of service$/i.test(n)) return true;
    return false;
  }

  function radioOnlineStationFromObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
    const name = cleanText(
      obj.name ?? obj.title ?? obj.radioName ?? obj.radio_name ?? obj.stationName ?? obj.station_name,
      220
    );
    const rawPage = obj.url ?? obj.slug ?? obj.path ?? obj.link ?? obj.alias ?? obj.code;
    const slug = radioOnlineSlug(rawPage);
    if (!name || !slug || radioOnlineNonStation(slug, name)) return null;

    const logo = radioOnlineAssetUrl(
      obj.image ?? obj.logo ?? obj.logoUrl ?? obj.logo_url ?? obj.imageUrl ?? obj.image_url ??
      obj.picture ?? obj.thumbnail ?? obj.icon
    );
    const frequency = cleanText(obj.frequency ?? obj.freq ?? obj.fm ?? '', 80);
    const rating = cleanText(obj.rating ?? obj.rate ?? obj.votes ?? obj.popularity ?? '', 50);
    const description = cleanText(obj.description ?? obj.about ?? obj.summary ?? '', 420);
    const officialUrl = RADIO_ONLINE_BASE + '/' + encodeURIComponent(slug);
    return {
      id: 'radio-online-' + slug,
      slug,
      name,
      logo: /\/logo\.webp(?:\?|$)/i.test(logo) ? '' : logo,
      frequency,
      rating,
      description,
      group: 'Radio',
      kind: 'radio',
      mode: 'official',
      sourceProvider: 'radio-online.my',
      officialUrl,
      sourcePage: officialUrl,
      url: officialUrl
    };
  }

  function collectRadioOnlineStations(payload) {
    const out = [];
    const seenObjects = new Set();
    const seenSlugs = new Set();
    function walk(value, depth = 0) {
      if (value == null || depth > 5) return;
      if (Array.isArray(value)) {
        for (const row of value.slice(0, 2000)) walk(row, depth + 1);
        return;
      }
      if (typeof value !== 'object' || seenObjects.has(value)) return;
      seenObjects.add(value);
      const station = radioOnlineStationFromObject(value);
      if (station && !seenSlugs.has(station.slug)) {
        seenSlugs.add(station.slug);
        out.push(station);
      }
      for (const child of Object.values(value)) {
        if (child && (Array.isArray(child) || typeof child === 'object')) walk(child, depth + 1);
      }
    }
    walk(payload, 0);
    return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity:'base' }));
  }

  async function getRadioOnlineCatalog(force = false) {
    if (!force && radioOnlineCatalogCache.items.length &&
        Date.now() - radioOnlineCatalogCache.savedAt < 15 * 60_000) {
      return { items: radioOnlineCatalogCache.items, source: 'cache' };
    }
    const payload = await fetchJsonTimed(
      RADIO_ONLINE_API,
      { method:'GET', headers:radioOnlineHeaders() },
      18000
    );
    const items = collectRadioOnlineStations(payload);
    if (!items.length) throw Object.assign(new Error('Radio-Online.my metadata returned no stations'), { statusCode:502 });
    radioOnlineCatalogCache.items = items;
    radioOnlineCatalogCache.savedAt = Date.now();
    return { items, source:'radio-online.my-country-api' };
  }

  async function resolveRadioOnlineLogo(slugRaw) {
    const slug = radioOnlineSlug(slugRaw);
    if (!slug || radioOnlineNonStation(slug, '')) return '';
    const cached = radioOnlineLogoCache.get(slug);
    if (cached && Date.now() - cached.savedAt < 24 * 60 * 60_000) return cached.url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(RADIO_ONLINE_BASE + '/' + encodeURIComponent(slug), {
        method:'GET',
        redirect:'follow',
        signal:controller.signal,
        headers:radioOnlineHeaders('text/html,application/xhtml+xml')
      });
      if (!response.ok) return '';
      let html = await response.text();
      html = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');

      const candidates = [];
      const metaRe = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["'][^>]*>/ig;
      let m;
      while ((m = metaRe.exec(html)) && candidates.length < 8) candidates.push(m[1]);
      const metaRevRe = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]*>/ig;
      while ((m = metaRevRe.exec(html)) && candidates.length < 12) candidates.push(m[1]);

      const storageRe = /(?:https?:\/\/radio-online\.my)?\/storage\/radios\/[^"'<>\\\s]+?\.(?:webp|png|jpe?g)(?:\?[^"'<>\\\s]*)?/ig;
      while ((m = storageRe.exec(html)) && candidates.length < 30) candidates.push(m[0]);

      for (const raw of candidates) {
        const url = radioOnlineAssetUrl(raw);
        if (!url || /\/logo\.webp(?:\?|$)/i.test(url)) continue;
        radioOnlineLogoCache.set(slug, { url, savedAt:Date.now() });
        return url;
      }
      return '';
    } catch (_) {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }


  // v989: public EPG/catalogue API discovered from Mana-Mana's CURRENT public web bundles.
  // The site itself exposes:
  //   API base: https://co3y6iwoio.tenbytecdn.com/api/v1
  //   GET /channels/{slug}
  //   GET /public/epg?channel_id={id}&date=YYYY-MM-DD
  //   GET /public/epg/now?channelType=video
  // This is public schedule metadata only. No login cookie, account token, stream
  // token, DRM key or subscriber credential is copied or required.
  const MANA2_PUBLIC_API_BASE = 'https://co3y6iwoio.tenbytecdn.com/api/v1';
  const mana2PublicChannelCache = new Map();
  const mana2PublicNowCache = { rows: [], savedAt: 0 };
  const mana2PublicCatalogCache = { items: [], savedAt: 0, source: '' };

  // Public VIDEO channel slugs observed by the v5 inspector on 2026-08-20.
  // Used only if Mana-Mana's current /public/channels endpoint is temporarily
  // unavailable. The live public catalogue remains the primary source.
  const MANA2_VIDEO_CATALOG_FALLBACK = [
    ['tv1','TV1'],['tv2','TV2'],['tv-okey','TV OKEY'],['sukan-rtm','SUKAN+'],
    ['berita-rtm','BERITA RTM'],['tvs','TVS'],['tv-alhijrah','TV ALHIJRAH'],
    ['sukma-1','SUKMA 1'],['sukma-2','SUKMA 2'],['free-movies','FREE MOVIES'],
    ['mysport','MySports'],['bernama','BERNAMA'],['cna','CNA'],
    ['the-indonesia-channel','The Indonesia Channel'],
    ['al-jazeera-english-hd','Al JAZEERA ENGLISH HD'],['arirang','ARIRANG'],
    ['euronews','EURONEWS'],['taiwanplus','TaiwanPlus'],['dw','DW'],
    ['nhk-world','NHK WORLD'],['rt-international','RT International'],
    ['al-jazeera-arabic-hd','Al JAZEERA ARABIC HD'],['usim-tv','USIM TV'],
    ['selangor-tv','SELANGOR TV'],['tv-ikim','TVIKIM'],['siara-tv','SIARA TV']
  ];
  // v1024: public Live Radio names visible on mana2.my/radio / homepage.
  // The live /public/channels API is primary; this list is only a static
  // fallback so the Radio tab remains usable during upstream/API outages.
  const MANA2_RADIO_CATALOG_FALLBACK = [
    ['manis-fm','MANIS FM'],['suria-fm','SURIA FM'],['fly-fm','FLY FM'],['rakita-fm','RAKITA FM'],
    ['hot-fm','HOT FM'],['ikim-fm','IKIMfm'],['988-fm','988 FM'],['molek-fm','MOLEK FM'],
    ['eight-fm','EIGHT FM'],['kool-fm','KOOL FM'],['nasional-fm','NASIONAL FM'],['traxx-fm','TRAXX FM'],
    ['minnal-fm','MINNAL FM'],['ai-fm','AI FM'],['radio-klasik','RADIO KLASIK'],['sabah-fm','SABAH FM'],
    ['sabahv-fm','SABAHV FM'],['sarawak-fm','SARAWAK FM'],['bernama-radio','BERNAMA RADIO'],
    ['wai-fm','WAI FM'],['asyik-fm','ASYIK FM'],['best-fm','BEST FM']
  ];

  function mana2PublicApiHeaders() {
    return {
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'en-MY,en;q=0.9,ms;q=0.8',
      'Origin': 'https://mana2.my',
      'Referer': 'https://mana2.my/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'
    };
  }

  function malaysiaDateIso(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const get = type => parts.find(x => x.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function malaysiaClockFromIso(value) {
    const raw = cleanText(value, 80);
    if (!raw) return '';
    if (/^(?:1[0-2]|0?[1-9]):[0-5]\d\s*(?:AM|PM)$/i.test(raw)) return normalizeScheduleTime(raw);
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).formatToParts(new Date(ms));
    const h = parts.find(x => x.type === 'hour')?.value || '';
    const m = parts.find(x => x.type === 'minute')?.value || '';
    const p = (parts.find(x => x.type === 'dayPeriod')?.value || '').toUpperCase();
    return h && m && p ? `${Number(h)}:${m} ${p}` : '';
  }

  function unwrapMana2Api(value) {
    let v = value;
    for (let i = 0; i < 5 && v && typeof v === 'object' && !Array.isArray(v); i++) {
      if (v.data != null && Object.keys(v).length <= 6) { v = v.data; continue; }
      if (v.result != null && Object.keys(v).length <= 6) { v = v.result; continue; }
      break;
    }
    return v;
  }

  function collectMana2Objects(value, out = [], depth = 0) {
    if (depth > 8 || value == null) return out;
    if (Array.isArray(value)) {
      for (const v of value) collectMana2Objects(v, out, depth + 1);
      return out;
    }
    if (typeof value !== 'object') return out;
    out.push(value);
    for (const v of Object.values(value)) {
      if (v && typeof v === 'object') collectMana2Objects(v, out, depth + 1);
    }
    return out;
  }

  function mana2ChannelSlug(rawUrl) {
    const u = mana2ChannelUrl(rawUrl);
    const m = u.pathname.match(/^\/channel\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]).trim() : '';
  }

  function pickMana2ChannelObject(data, slug) {
    const wanted = normalizeMana2ChannelName(slug);
    const objects = collectMana2Objects(unwrapMana2Api(data), []);
    let best = null;
    let bestScore = -1;
    for (const o of objects) {
      const id = cleanText(o.id ?? o.channelId ?? o.channel_id, 180);
      if (!id) continue;
      const s = cleanText(o.slug ?? o.code ?? o.channelSlug ?? o.channel_slug, 180);
      const name = cleanText(o.name ?? o.title ?? o.channelName ?? o.channel_name, 180);
      let score = 0;
      if (s && s.toLowerCase() === slug.toLowerCase()) score += 100;
      if (normalizeMana2ChannelName(s) === wanted) score += 60;
      if (normalizeMana2ChannelName(name) === wanted) score += 40;
      if (o.channelType === 'video' || o.channelType === 'tv') score += 2;
      if (score > bestScore) {
        best = { id, slug: s || slug, name, channelNumber: o.channelNumber ?? o.channel_number ?? null };
        bestScore = score;
      }
    }
    return bestScore > 0 ? best : null;
  }

  async function getMana2PublicChannel(rawUrl) {
    const slug = mana2ChannelSlug(rawUrl);
    if (!slug) throw Object.assign(new Error('Mana-Mana channel slug missing'), { statusCode: 400 });
    const cached = mana2PublicChannelCache.get(slug);
    if (cached && Date.now() - cached.savedAt < 10 * 60_000) return cached.value;

    let detailError = null;
    try {
      const data = await fetchJsonTimed(
        `${MANA2_PUBLIC_API_BASE}/channels/${encodeURIComponent(slug)}`,
        { method: 'GET', headers: mana2PublicApiHeaders() },
        12000
      );
      const hit = pickMana2ChannelObject(data, slug);
      if (hit) {
        mana2PublicChannelCache.set(slug, { savedAt: Date.now(), value: hit });
        return hit;
      }
      detailError = new Error('Mana-Mana channel detail returned no channel id');
    } catch (e) { detailError = e; }

    // Public catalogue fallback. The current Mana-Mana bundle declares
    // channels.list as /public/channels.
    try {
      const data = await fetchJsonTimed(
        `${MANA2_PUBLIC_API_BASE}/public/channels`,
        { method: 'GET', headers: mana2PublicApiHeaders() },
        12000
      );
      const hit = pickMana2ChannelObject(data, slug);
      if (!hit) throw new Error('Mana-Mana public channel catalogue could not resolve slug');
      mana2PublicChannelCache.set(slug, { savedAt: Date.now(), value: hit });
      return hit;
    } catch (e) {
      const err = new Error(`Mana-Mana public channel lookup failed: ${cleanText(e?.message || detailError?.message || '', 180)}`);
      err.statusCode = Number(e?.statusCode || detailError?.statusCode) || 502;
      throw err;
    }
  }

  function mana2PublicAssetUrl(raw) {
    const value = cleanText(raw, 1200);
    if (!value) return '';
    try { return new URL(value, 'https://mana2.my/').toString(); }
    catch (_) { return value; }
  }

  function normalizeMana2CatalogObject(o) {
    if (!o || typeof o !== 'object') return null;
    const type = cleanText(o.channelType ?? o.channel_type ?? o.type, 40).toLowerCase();
    const isRadio = ['radio', 'audio'].includes(type);
    const isVideo = ['video', 'tv'].includes(type);
    if (!isVideo && !isRadio) return null;

    const id = cleanText(o.id ?? o.channelId ?? o.channel_id, 180);
    const slug = cleanText(o.slug ?? o.code ?? o.channelSlug ?? o.channel_slug, 180);
    const name = cleanText(o.name ?? o.title ?? o.channelName ?? o.channel_name, 180);
    if (!id || !slug || !name) return null;
    if (o.isLive === false || o.is_live === false) return null;

    const logo = mana2PublicAssetUrl(
      o.logoUrl ?? o.logo_url ?? o.thumbnailUrl ?? o.thumbnail_url ??
      o.posterUrl ?? o.poster_url ?? o.bannerUrl ?? o.banner_url
    );
    const officialUrl = `https://mana2.my/channel/${encodeURIComponent(slug)}`;
    return {
      id,
      slug,
      name,
      channelNumber: o.channelNumber ?? o.channel_number ?? null,
      logo,
      group: isRadio ? 'Radio' : 'Live TV',
      kind: isRadio ? 'radio' : 'live',
      mode: 'official',
      officialUrl,
      sourcePage: officialUrl,
      url: officialUrl
    };
  }

  function parseMana2PublicCatalog(data) {
    const value = unwrapMana2Api(data);
    const objects = Array.isArray(value) ? value : collectMana2Objects(value, []);
    const out = [];
    const seen = new Set();
    for (const o of objects) {
      const row = normalizeMana2CatalogObject(o);
      if (!row) continue;
      const key = String(row.id || row.slug).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }

    // Preserve Mana-Mana's API order as much as possible, but put numbered
    // channels before unnumbered channels when channelNumber is present.
    return out.sort((a, b) => {
      const an = Number(a.channelNumber), bn = Number(b.channelNumber);
      const af = Number.isFinite(an), bf = Number.isFinite(bn);
      if (af && bf && an !== bn) return an - bn;
      if (af !== bf) return af ? -1 : 1;
      return 0;
    });
  }

  function fallbackMana2Catalog() {
    const video = MANA2_VIDEO_CATALOG_FALLBACK.map(([slug, name]) => {
      const officialUrl = `https://mana2.my/channel/${encodeURIComponent(slug)}`;
      return { id:slug, slug, name, channelNumber:null, logo:'', group:'Live TV', kind:'live', mode:'official', officialUrl, sourcePage:officialUrl, url:officialUrl };
    });
    const radio = MANA2_RADIO_CATALOG_FALLBACK.map(([slug, name]) => {
      const officialUrl = `https://mana2.my/channel/${encodeURIComponent(slug)}`;
      return { id:'radio-'+slug, slug, name, channelNumber:null, logo:'', group:'Radio', kind:'radio', mode:'official', officialUrl, sourcePage:officialUrl, url:officialUrl };
    });
    return [...video, ...radio];
  }

  async function getMana2PublicCatalog(force = false) {
    if (!force && mana2PublicCatalogCache.items.length &&
        Date.now() - mana2PublicCatalogCache.savedAt < 10 * 60_000) {
      return {
        items: mana2PublicCatalogCache.items,
        source: mana2PublicCatalogCache.source || 'cache'
      };
    }

    try {
      const data = await fetchJsonTimed(
        `${MANA2_PUBLIC_API_BASE}/public/channels`,
        { method: 'GET', headers: mana2PublicApiHeaders() },
        15000
      );
      const items = parseMana2PublicCatalog(data);
      if (!items.length) throw new Error('Mana-Mana public TV/Radio catalogue returned no channels');
      mana2PublicCatalogCache.items = items;
      mana2PublicCatalogCache.savedAt = Date.now();
      mana2PublicCatalogCache.source = 'mana2-public-channels-api';
      return { items, source: mana2PublicCatalogCache.source };
    } catch (e) {
      const items = fallbackMana2Catalog();
      mana2PublicCatalogCache.items = items;
      mana2PublicCatalogCache.savedAt = Date.now();
      mana2PublicCatalogCache.source = 'v1024-tv-radio-fallback';
      return {
        items,
        source: mana2PublicCatalogCache.source,
        warning: cleanText(e?.message || 'Mana-Mana public catalogue unavailable', 220)
      };
    }
  }

  function mana2ProgrammeFromObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const p = (obj.programme && typeof obj.programme === 'object') ? obj.programme :
              (obj.program && typeof obj.program === 'object') ? obj.program : obj;
    const title = cleanText(p.title ?? p.name ?? p.programmeTitle ?? p.programTitle, 220);
    const startIso = cleanText(
      p.startIso ?? p.startTime ?? p.start_time ?? p.startsAt ?? p.start_at ?? p.start,
      100
    );
    const endIso = cleanText(
      p.endIso ?? p.endTime ?? p.end_time ?? p.endsAt ?? p.end_at ?? p.end,
      100
    );
    if (!title || !startIso || !endIso) return null;
    const start = malaysiaClockFromIso(startIso);
    const end = malaysiaClockFromIso(endIso);
    if (!start || !end) return null;
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    const current = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Date.now() >= startMs && Date.now() < endMs
      : scheduleItemCurrent({ start, end }, malaysiaMinuteNow());
    return {
      id: cleanText(p.id ?? p.programmeId ?? p.programId ?? obj.id, 180),
      title,
      start,
      end,
      start_iso: startIso,
      end_iso: endIso,
      current
    };
  }

  function parseMana2PublicEpg(data) {
    const objects = collectMana2Objects(unwrapMana2Api(data), []);
    const out = [];
    const seen = new Set();
    for (const o of objects) {
      const row = mana2ProgrammeFromObject(o);
      if (!row) continue;
      const key = `${row.start_iso}|${row.end_iso}|${row.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
    out.sort((a, b) => {
      const am = Date.parse(a.start_iso), bm = Date.parse(b.start_iso);
      if (Number.isFinite(am) && Number.isFinite(bm)) return am - bm;
      return minutesFromScheduleTime(a.start) - minutesFromScheduleTime(b.start);
    });
    return out.slice(0, 96);
  }

  function parseMana2NowRows(data) {
    const value = unwrapMana2Api(data);
    const roots = Array.isArray(value) ? value : collectMana2Objects(value, []).filter(o => o.programme || o.program);
    return roots.map(o => {
      const p = o.programme || o.program;
      if (!p || typeof p !== 'object') return null;
      return {
        channelId: cleanText(o.channelId ?? o.channel_id ?? o.id, 180),
        channelNumber: o.channelNumber ?? o.channel_number ?? null,
        title: cleanText(p.title ?? p.name, 220),
        startIso: cleanText(p.startTime ?? p.startIso ?? p.start_time, 100),
        endIso: cleanText(p.endTime ?? p.endIso ?? p.end_time, 100)
      };
    }).filter(x => x && x.channelId && x.title);
  }

  async function getMana2PublicNow(channelId) {
    if (!mana2PublicNowCache.rows.length || Date.now() - mana2PublicNowCache.savedAt >= 30_000) {
      const data = await fetchJsonTimed(
        `${MANA2_PUBLIC_API_BASE}/public/epg/now?channelType=video`,
        { method: 'GET', headers: mana2PublicApiHeaders() },
        12000
      );
      mana2PublicNowCache.rows = parseMana2NowRows(data);
      mana2PublicNowCache.savedAt = Date.now();
    }
    return mana2PublicNowCache.rows.find(x => String(x.channelId) === String(channelId)) || null;
  }

  async function getMana2PublicEpgSchedule(rawUrl) {
    const target = mana2ChannelUrl(rawUrl);
    const channel = await getMana2PublicChannel(target.toString());
    const date = malaysiaDateIso();

    const data = await fetchJsonTimed(
      `${MANA2_PUBLIC_API_BASE}/public/epg?channel_id=${encodeURIComponent(channel.id)}&date=${encodeURIComponent(date)}`,
      { method: 'GET', headers: mana2PublicApiHeaders() },
      15000
    );
    const schedule = parseMana2PublicEpg(data);

    let now = null;
    try { now = await getMana2PublicNow(channel.id); } catch (_) {}

    if (now?.title) {
      let matched = false;
      for (const row of schedule) {
        const sameTitle = row.title.toLowerCase() === now.title.toLowerCase();
        const sameStart = now.startIso && row.start_iso && row.start_iso === now.startIso;
        row.current = !!(sameStart || (sameTitle && row.current));
        if (row.current) matched = true;
      }
      if (!matched) {
        const hit = schedule.find(row => row.title.toLowerCase() === now.title.toLowerCase());
        if (hit) hit.current = true;
      }
    }

    const currentTitle = now?.title || schedule.find(x => x.current)?.title || '';
    if (!schedule.length && !currentTitle) {
      const err = new Error('Mana-Mana public EPG returned no programmes');
      err.statusCode = 404;
      throw err;
    }

    return {
      ok: true,
      channel_url: target.toString(),
      channel_id: channel.id,
      current_title: currentTitle,
      schedule: schedule.map(x => ({
        id: x.id || undefined,
        start: x.start,
        end: x.end,
        title: x.title,
        current: !!x.current
      })),
      parser: 'mana2-current-public-epg-api',
      api_source: 'co3y6iwoio.tenbytecdn.com/api/v1',
      fetched_at: Date.now(),
      time_zone: 'Asia/Kuala_Lumpur'
    };
  }

  function deepFindStringByKeys(value, keys, depth = 0) {
    if (depth > 14 || value == null) return '';
    if (typeof value !== 'object') return '';
    for (const [k, v] of Object.entries(value)) {
      if (keys.has(String(k).toLowerCase()) && typeof v === 'string' && v.trim()) return v.trim();
    }
    for (const v of Object.values(value)) {
      const found = deepFindStringByKeys(v, keys, depth + 1);
      if (found) return found;
    }
    return '';
  }

  async function getMana2SessionId(force = false) {
    if (!force && mana2SessionCache.sessionId && Date.now() - mana2SessionCache.savedAt < 10 * 60_000) {
      return mana2SessionCache.sessionId;
    }
    const tokenUrl = 'https://mytv-api.revlet.net/service/api/v1/get/token?' + new URLSearchParams({
      tenant_code: 'mytv',
      box_id: MANA2_BOX_ID,
      product: 'mytv',
      device_id: '5',
      display_lang_code: 'ENG',
      device_sub_type: 'Chrome,142.0.0.0,Windows',
      timezone: 'Atlantic/Reykjavik'
    }).toString();
    let data;
    try {
      // Public mana2.my WebGrab+Plus definition uses POST_BACK(GET,GET); POST is the
      // closest first request, with GET retained as a compatibility retry.
      data = await fetchJsonTimed(tokenUrl, { method: 'POST', headers: mana2ApiHeaders() }, 12000);
    } catch (firstError) {
      data = await fetchJsonTimed(tokenUrl, { method: 'GET', headers: mana2ApiHeaders() }, 12000);
    }
    let sessionId = deepFindStringByKeys(data, new Set(['sessionid', 'session_id', 'session']));
    if (!sessionId) {
      try {
        data = await fetchJsonTimed(tokenUrl, { method: 'GET', headers: mana2ApiHeaders() }, 12000);
        sessionId = deepFindStringByKeys(data, new Set(['sessionid', 'session_id', 'session']));
      } catch (_) {}
    }
    if (!sessionId) {
      const err = new Error('Mana-Mana sessionId not found');
      err.statusCode = 502;
      throw err;
    }
    mana2SessionCache.sessionId = sessionId;
    mana2SessionCache.savedAt = Date.now();
    return sessionId;
  }

  function normalizeMana2ChannelName(text) {
    return String(text || '')
      .toUpperCase()
      .replace(/\bHD\b/g, '')
      .replace(/\bMYTV\b/g, '')
      .replace(/\bENJOY\b/g, '')
      .replace(/[^A-Z0-9+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function collectChannelObjects(value, out, depth = 0) {
    if (depth > 12 || value == null) return;
    if (Array.isArray(value)) { for (const x of value) collectChannelObjects(x, out, depth + 1); return; }
    if (typeof value !== 'object') return;
    const id = Number(value.id ?? value.channelId ?? value.channel_id);
    const title = String(value.title ?? value.display ?? value.name ?? '').trim();
    if (Number.isFinite(id) && id > 0 && title) out.push({ id, title, raw: value });
    for (const v of Object.values(value)) if (v && typeof v === 'object') collectChannelObjects(v, out, depth + 1);
  }

  async function getMana2ChannelCatalog(sessionId, force = false) {
    if (!force && mana2ChannelCache.items.length && Date.now() - mana2ChannelCache.savedAt < 10 * 60_000) {
      return mana2ChannelCache.items;
    }
    const endpoint = "https://mytv-api.revlet.net/service/api/v1/tvguide/channels?filter=" + encodeURIComponent("channelType:'subpage'");
    let data;
    try {
      data = await fetchJsonTimed(endpoint, { method: 'GET', headers: mana2ApiHeaders(sessionId) }, 15000);
    } catch (e) {
      if (e.statusCode === 401 || e.statusCode === 403) {
        const fresh = await getMana2SessionId(true);
        data = await fetchJsonTimed(endpoint, { method: 'GET', headers: mana2ApiHeaders(fresh) }, 15000);
      } else throw e;
    }
    const items = [];
    collectChannelObjects(data, items);
    const dedup = [...new Map(items.map(x => [x.id, x])).values()];
    mana2ChannelCache.items = dedup;
    mana2ChannelCache.savedAt = Date.now();
    return dedup;
  }

  function resolveMana2ChannelId(channelName, rawUrl, tvgId, catalog) {
    const known = new Map([
      ['TV1', 1], ['TV 1', 1], ['TV2', 2], ['TV 2', 2],
      ['BERITA RTM', 4], ['SELANGOR TV', 45]
    ]);
    const wanted = normalizeMana2ChannelName(channelName);
    if (known.has(wanted)) return known.get(wanted);

    // Exact normalized title first, then conservative contains matching.
    let hit = catalog.find(x => normalizeMana2ChannelName(x.title) === wanted);
    if (!hit && wanted) hit = catalog.find(x => {
      const t = normalizeMana2ChannelName(x.title);
      return t && (t.includes(wanted) || wanted.includes(t)) && Math.min(t.length, wanted.length) >= 3;
    });
    if (hit) return hit.id;

    // UUID/slug may be present somewhere in the channel object returned by Revlet.
    let slug = '';
    try { slug = new URL(rawUrl).pathname.split('/').filter(Boolean).pop() || ''; } catch (_) {}
    if (slug) {
      const low = slug.toLowerCase();
      hit = catalog.find(x => JSON.stringify(x.raw || {}).toLowerCase().includes(low));
      if (hit) return hit.id;
    }

    // tvg-id is retained as a final hint only if it already looks like a small
    // Revlet guide id (not DVB channel numbers such as 101/102/123).
    const n = Number(tvgId);
    if (Number.isFinite(n) && n > 0 && n < 100 && catalog.some(x => x.id === n)) return n;
    return 0;
  }

  function malaysiaDayBoundsMs(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const y = Number(parts.find(x => x.type === 'year')?.value);
    const m = Number(parts.find(x => x.type === 'month')?.value);
    const d = Number(parts.find(x => x.type === 'day')?.value);
    // Midnight Malaysia is previous-day 16:00 UTC (UTC+8).
    const start = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 8 * 3600_000;
    return { start, end: start + 24 * 3600_000 };
  }

  function findProgramsArray(value, depth = 0) {
    if (depth > 12 || value == null || typeof value !== 'object') return [];
    if (Array.isArray(value.programs)) return value.programs;
    for (const v of Object.values(value)) {
      if (v && typeof v === 'object') {
        const found = findProgramsArray(v, depth + 1);
        if (found.length) return found;
      }
    }
    return [];
  }

  function asEpochMs(value) {
    if (value == null || value === '') return NaN;
    if (typeof value === 'number' || /^\d{10,13}$/.test(String(value))) {
      let n = Number(value); if (n < 1e12) n *= 1000; return n;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function malaysiaTimeLabel(msOrText) {
    const ms = asEpochMs(msOrText);
    if (!Number.isFinite(ms)) return normalizeScheduleTime(msOrText);
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit', hour12: true
      }).format(new Date(ms)).replace(/\s+/g, ' ').toUpperCase();
    } catch (_) { return ''; }
  }

  function parseMana2GuidePrograms(data) {
    const rawPrograms = findProgramsArray(data);
    const now = Date.now();
    const schedule = [];
    for (const p of rawPrograms) {
      if (!p || typeof p !== 'object') continue;
      const startRaw = p.startTime ?? p.start_time ?? p.start ?? p.beginTime;
      const endRaw = p.endTime ?? p.end_time ?? p.end ?? p.stopTime;
      const title = cleanProgramTitle(p.title ?? p.programTitle ?? p.name ?? '');
      if (!title) continue;
      const startMs = asEpochMs(startRaw), endMs = asEpochMs(endRaw);
      const start = malaysiaTimeLabel(startRaw), end = malaysiaTimeLabel(endRaw);
      if (!start || !end) continue;
      schedule.push({
        start, end, title,
        current: Number.isFinite(startMs) && Number.isFinite(endMs) ? now >= startMs && now < endMs : scheduleItemCurrent({ start, end }, malaysiaMinuteNow())
      });
    }
    schedule.sort((a, b) => minutesFromScheduleTime(a.start) - minutesFromScheduleTime(b.start));
    return schedule;
  }

  async function getMana2GuideSchedule(rawUrl, channelName, tvgId) {
    const sessionId = await getMana2SessionId(false);
    const knownOnly = resolveMana2ChannelId(channelName, rawUrl, tvgId, []);
    const catalog = knownOnly ? [] : await getMana2ChannelCatalog(sessionId, false);
    const channelId = knownOnly || resolveMana2ChannelId(channelName, rawUrl, tvgId, catalog);
    if (!channelId) {
      const err = new Error('Mana-Mana guide channel id not found');
      err.statusCode = 404;
      throw err;
    }
    const bounds = malaysiaDayBoundsMs();
    const endpoint = 'https://mytv-tvguide.revlet.net/service/api/v1/static/tvguide?' + new URLSearchParams({
      channel_ids: String(channelId),
      start_time: String(bounds.start),
      end_time: String(bounds.end),
      page: '0'
    }).toString();
    let data;
    try {
      data = await fetchJsonTimed(endpoint, { method: 'GET', headers: mana2ApiHeaders(sessionId) }, 15000);
    } catch (e) {
      if (e.statusCode === 401 || e.statusCode === 403) {
        const fresh = await getMana2SessionId(true);
        data = await fetchJsonTimed(endpoint, { method: 'GET', headers: mana2ApiHeaders(fresh) }, 15000);
      } else throw e;
    }
    const schedule = parseMana2GuidePrograms(data);
    if (!schedule.length) {
      const err = new Error('Mana-Mana guide API returned no programmes');
      err.statusCode = 404;
      throw err;
    }
    return {
      ok: true,
      channel_url: mana2ChannelUrl(rawUrl).toString(),
      channel_id: channelId,
      current_title: schedule.find(x => x.current)?.title || '',
      schedule,
      parser: 'revlet-tvguide-api',
      fetched_at: Date.now(),
      time_zone: 'Asia/Kuala_Lumpur'
    };
  }

  async function getMana2Schedule(rawUrl, channelName = '', tvgId = '') {
    const target = mana2ChannelUrl(rawUrl);
    const key = `${target.toString()}|${channelName}|${tvgId}`;
    const cached = mana2ScheduleCache.get(key);
    if (cached && Date.now() - cached.savedAt < 60_000) return cached.value;

    // v989 primary: exact public EPG flow used by Mana-Mana's current 2026 web app.
    let publicEpgError = null;
    try {
      const value = await getMana2PublicEpgSchedule(target.toString());
      mana2ScheduleCache.set(key, { savedAt: Date.now(), value });
      return value;
    } catch (e) { publicEpgError = e; }

    let renderedError = null;
    try {
      const value = await getMana2RenderedSchedule(target.toString());
      value.public_epg_error = cleanText(publicEpgError?.message || '', 180);
      mana2ScheduleCache.set(key, { savedAt: Date.now(), value });
      return value;
    } catch (e) { renderedError = e; }

    let guideError = null;
    try {
      const value = await getMana2GuideSchedule(target.toString(), channelName, tvgId);
      value.public_epg_error = cleanText(publicEpgError?.message || '', 180);
      value.rendered_dom_error = cleanText(renderedError?.message || '', 160);
      mana2ScheduleCache.set(key, { savedAt: Date.now(), value });
      return value;
    } catch (e) { guideError = e; }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(target.toString(), { method:'GET', redirect:'follow', signal:controller.signal, headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'en-MY,en;q=0.9,ms;q=0.8'
      }});
      if (!response.ok) throw guideError || renderedError || publicEpgError || Object.assign(new Error(`Mana-Mana page HTTP ${response.status}`), { statusCode:response.status });
      const html = await response.text();
      if (html.length > 4 * 1024 * 1024) throw Object.assign(new Error('Mana-Mana page too large'), { statusCode:413 });
      const parsed = extractMana2Schedule(html);
      const value = {
        ok:true,
        channel_url:target.toString(),
        current_title:parsed.current_title||'',
        schedule:parsed.schedule||[],
        parser:(parsed.schedule?.length||parsed.current_title)?'html-nextjs-fallback':'none',
        public_epg_error:cleanText(publicEpgError?.message||'',180),
        rendered_dom_error:cleanText(renderedError?.message||'',160),
        guide_api_error:cleanText(guideError?.message||'',160),
        fetched_at:Date.now(),
        time_zone:'Asia/Kuala_Lumpur'
      };
      mana2ScheduleCache.set(key, { savedAt:Date.now(), value });
      return value;
    } finally { clearTimeout(timer); }
  }

  function limited(req, res, name, maxHits, windowMs) {
    return rateLimitOrSend ? rateLimitOrSend(req, res, name, maxHits, windowMs) : false;
  }



  function decodeHtmlAttr(value) {
    return String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/&#38;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  function looksLikeDirectMediaUrl(raw) {
    return /\.(?:m3u8|mpd|mp4|m4s|ts|webm|mkv|avi|aac)(?:$|[?#])/i.test(String(raw || ''));
  }


  async function fetch123AnimePoster(slug) {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{0,180}$/.test(cleanSlug)) {
      return { ok:false, status:400, reason:'invalid-slug' };
    }

    const candidates = ['jpg','png','webp'];
    for (const ext of candidates) {
      const target = `https://123animehub.cc/imgs/poster/${cleanSlug}.${ext}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(target, {
          method:'GET',
          redirect:'follow',
          signal:controller.signal,
          headers:{
            'User-Agent':'Mozilla/5.0 (compatible; AZOBSSTV/1.0; +https://www.azobss.com/AZOBSSTV/)',
            'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Referer':'https://123animehub.cc/'
          }
        });

        if (!response.ok) continue;
        const type = String(response.headers.get('content-type') || '').toLowerCase();
        if (!/^image\/(?:jpeg|jpg|png|webp|avif)/i.test(type)) continue;

        const ab = await response.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length < 700 || buf.length > 4 * 1024 * 1024) continue;

        return {
          ok:true,
          status:200,
          body:buf,
          type:type.split(';')[0] || 'image/jpeg',
          url:response.url || target
        };
      } catch (_) {
        // Try next extension.
      } finally {
        clearTimeout(timer);
      }
    }

    return { ok:false, status:404, reason:'poster-not-found' };
  }

  async function fetchPublicHtml123AnimeHub(rawUrl) {
    const cleaned = cleanUrl(rawUrl);
    if (!cleaned) throw new Error('invalid-url');
    let current = await assertPublicHttpUrl(cleaned);
    const allowedHost = host => /^(?:www\.)?123animehub\.cc$/i.test(String(host || ''));
    if (!allowedHost(current.hostname) || !/^\/anime\/[^/]+\/episode\/\d{3,4}\/?$/i.test(current.pathname)) {
      throw new Error('unsupported-123animehub-url');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      for (let hop = 0; hop <= 3; hop++) {
        const response = await fetch(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AZOBSSTV/1.0; +https://www.azobss.com/AZOBSSTV/)',
            'Accept': 'text/html,application/xhtml+xml'
          }
        });

        if ([301,302,303,307,308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location || hop === 3) throw new Error('redirect-failed');
          const next = await assertPublicHttpUrl(new URL(location, current).toString());
          if (!allowedHost(next.hostname)) throw new Error('redirect-outside-source');
          current = next;
          continue;
        }

        if (!response.ok) throw new Error('upstream-http-' + response.status);
        const type = String(response.headers.get('content-type') || '');
        if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new Error('non-html-source');
        const html = await response.text();
        return { html: html.slice(0, 1800000), finalUrl: current.toString() };
      }
      throw new Error('redirect-limit');
    } finally {
      clearTimeout(timer);
    }
  }

  function isBlockedEmbedAssetUrl(rawUrl) {
    let u;
    try { u = new URL(String(rawUrl || '')); } catch (_) { return true; }

    const host = String(u.hostname || '').toLowerCase();
    const path = String(u.pathname || '').toLowerCase();

    // A player iframe must resolve to an HTML document, never a JS/CSS/image/font/data asset.
    if (/\.(?:js|mjs|css|map|json|xml|txt|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|otf)(?:$|\/)/i.test(path)) return true;
    if (/(?:^|\/)(?:embed|count|analytics|gtag|ads?|banner|pixel|tracker)(?:[-_.][^/]*)?\.(?:js|mjs)(?:$|\/)/i.test(path)) return true;

    // Known comment/analytics/ad resources are not video players even if their URL contains "embed".
    if (/(?:^|\.)disqus\.com$/i.test(host) || /(?:^|\.)disquscdn\.com$/i.test(host)) return true;
    if (/(?:^|\.)doubleclick\.net$/i.test(host) || /(?:^|\.)googletagmanager\.com$/i.test(host)) return true;
    if (/(?:^|\.)google-analytics\.com$/i.test(host)) return true;

    return false;
  }

  function extractPublicEmbedCandidates(html, baseUrl) {
    const source = String(html || '');
    const out = [];
    const seen = new Set();

    const add = (raw, kind) => {
      raw = decodeHtmlAttr(raw);
      if (!raw || /^javascript:/i.test(raw) || /^data:/i.test(raw)) return;
      let u;
      try { u = new URL(raw, baseUrl); } catch (_) { return; }
      if (!/^https?:$/.test(u.protocol)) return;
      if (/^(?:www\.)?123animehub\.cc$/i.test(u.hostname)) return;
      if (looksLikeDirectMediaUrl(u.toString())) return;
      if (isBlockedEmbedAssetUrl(u.toString())) return;
      if (/(?:token|signature|sig|expires|auth|key)=/i.test(u.search)) return;

      const s = u.toString();
      if (!seen.has(s)) {
        seen.add(s);
        out.push({ url:s, kind:String(kind || 'unknown') });
      }
    };

    // Highest-confidence candidates: actual iframe/data-player attributes.
    const attrs = [
      { kind:'iframe-src', re:/\biframe[^>]+\bsrc\s*=\s*["']([^"']+)["']/gi },
      { kind:'data-player', re:/\b(?:data-src|data-embed|data-player|data-video|data-url)\s*=\s*["'](https?:\/\/[^"']+)["']/gi },
      { kind:'player-var', re:/\b(?:embed_url|embedUrl|player_url|playerUrl)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi }
    ];

    for (const item of attrs) {
      let m;
      while ((m = item.re.exec(source)) && out.length < 30) add(m[1], item.kind);
    }

    // Lower-confidence script-string discovery is intentionally strict.
    // Only HTML-like player routes are accepted; asset URLs such as /embed.js are rejected.
    const generic = /["'](https?:\/\/[^"'<>\\\s]{8,500})["']/gi;
    let gm;
    while ((gm = generic.exec(source)) && out.length < 30) {
      const value = gm[1];
      let u;
      try { u = new URL(value); } catch (_) { continue; }
      const path = String(u.pathname || '');
      const looksLikePlayerRoute =
        /\/(?:embed|player|watch|video)(?:\/|$)/i.test(path) ||
        /[?&](?:embed|player|video)=/i.test(u.search);
      if (looksLikePlayerRoute) add(value, 'script-player-route');
    }

    return out.slice(0, 30);
  }

  async function checkExternalEmbedAllowed(rawUrl) {
    let current;
    try { current = await assertPublicHttpUrl(rawUrl); } catch (_) {
      return { embeddable:false, reason:'invalid-embed-url' };
    }

    if (isBlockedEmbedAssetUrl(current.toString())) {
      return { embeddable:false, reason:'asset-not-html-player' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(current.toString(), {
        method:'GET',
        redirect:'follow',
        signal:controller.signal,
        headers:{
          'User-Agent':'Mozilla/5.0 (compatible; AZOBSSTV/1.0; +https://www.azobss.com/AZOBSSTV/)',
          'Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
        }
      });

      if (!response.ok) {
        try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); } catch (_) {}
        return { embeddable:false, reason:'embed-http-' + response.status };
      }

      const finalUrl = response.url || current.toString();
      if (isBlockedEmbedAssetUrl(finalUrl)) {
        try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); } catch (_) {}
        return { embeddable:false, reason:'redirected-to-asset' };
      }

      // Critical v1004 fix: do not treat JavaScript/text assets as iframe players.
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      const htmlType = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);

      let htmlProbe = '';
      if (!htmlType) {
        // Some small embed providers omit a useful Content-Type. Probe the body and
        // accept it only when it clearly looks like HTML, never raw JS/source text.
        try { htmlProbe = (await response.text()).slice(0, 65536); } catch (_) {}
        const looksHtml = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<iframe[\s>]|<video[\s>]/i.test(htmlProbe);
        const looksJs =
          /^\s*(?:!function|\(function|function\s*\(|var\s+|let\s+|const\s+|window\.|document\.)/i.test(htmlProbe) ||
          /\b(?:createElement|appendChild|getElementsByTagName|disqus|disquscdn)\b/i.test(htmlProbe.slice(0, 12000));

        if (!looksHtml || looksJs) {
          return {
            embeddable:false,
            reason: looksJs ? 'javascript-resource-not-player' : 'non-html-player',
            content_type:contentType
          };
        }
      } else {
        // We only need headers for real HTML responses.
        try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); } catch (_) {}
      }

      const xfo = String(response.headers.get('x-frame-options') || '').trim();
      const csp = String(response.headers.get('content-security-policy') || '').trim();

      if (/\bDENY\b/i.test(xfo)) return { embeddable:false, reason:'x-frame-options-deny' };
      if (/\bSAMEORIGIN\b/i.test(xfo)) return { embeddable:false, reason:'x-frame-options-sameorigin' };

      const fa = csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i);
      if (fa) {
        const policy = String(fa[1] || '').trim();
        if (/'none'/i.test(policy)) return { embeddable:false, reason:'csp-frame-ancestors-none' };
        const allowsAll = /(^|\s)\*(\s|$)/.test(policy);
        const allowsAzobss = /https:\/\/(?:www\.)?azobss\.com\b/i.test(policy);
        if (!allowsAll && !allowsAzobss) return { embeddable:false, reason:'csp-frame-ancestors' };
      }

      return {
        embeddable:true,
        final_url:finalUrl,
        content_type:contentType || 'html-detected'
      };
    } catch (err) {
      return { embeddable:false, reason:err && err.name === 'AbortError' ? 'embed-timeout' : 'embed-check-failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function resolve123AnimeHubPublicPlayer(rawUrl) {
    try {
      const page = await fetchPublicHtml123AnimeHub(rawUrl);
      const candidates = extractPublicEmbedCandidates(page.html, page.finalUrl);
      const rejected = [];
      for (const candidate of candidates) {
        const check = await checkExternalEmbedAllowed(candidate.url);
        if (check.embeddable) {
          return {
            ok:true,
            embeddable:true,
            source:'123animehub',
            embed_url:check.final_url || candidate.url,
            embed_kind:candidate.kind,
            content_type:check.content_type || '',
            source_url:page.finalUrl,
            candidate_count:candidates.length
          };
        }
        rejected.push({ kind:candidate.kind, reason:check.reason || 'rejected' });
      }
      return {
        ok:true,
        embeddable:false,
        source:'123animehub',
        source_url:page.finalUrl,
        candidate_count:candidates.length,
        reason:candidates.length ? 'no-valid-embeddable-html-player' : 'no-public-external-player-found',
        rejected:rejected.slice(0, 8)
      };
    } catch (err) {
      return {
        ok:false,
        embeddable:false,
        source:'123animehub',
        reason:String(err && err.message || 'resolve-failed')
      };
    }
  }

  async function checkAnimeNanaEmbed(rawUrl) {
    const cleaned = cleanUrl(rawUrl);
    if (!cleaned) return { ok:false, embeddable:false, reason:'invalid-url' };
    let current = await assertPublicHttpUrl(cleaned);
    const allowedHost = host => /^(?:www\.)?animenana\.com$/i.test(String(host || ''));
    if (!allowedHost(current.hostname) || !/^\/view\/[^/]+/i.test(current.pathname)) {
      return { ok:false, embeddable:false, reason:'unsupported-source' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      for (let hop = 0; hop <= 3; hop++) {
        const response = await fetch(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'AZOBSSTV/1.0 (+https://www.azobss.com/AZOBSSTV/)',
            'Accept': 'text/html,application/xhtml+xml'
          }
        });

        if ([301,302,303,307,308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location || hop === 3) return { ok:false, embeddable:false, reason:'redirect-failed' };
          const next = await assertPublicHttpUrl(new URL(location, current).toString());
          if (!allowedHost(next.hostname) || !/^\/view\/[^/]+/i.test(next.pathname)) {
            return { ok:false, embeddable:false, reason:'redirect-outside-allowed-source' };
          }
          current = next;
          continue;
        }

        try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); } catch (_) {}
        if (!response.ok) return { ok:false, embeddable:false, reason:'upstream-http-'+response.status };

        const xfo = String(response.headers.get('x-frame-options') || '').trim();
        const csp = String(response.headers.get('content-security-policy') || '').trim();

        if (/\bDENY\b/i.test(xfo)) return { ok:true, embeddable:false, reason:'x-frame-options-deny' };
        if (/\bSAMEORIGIN\b/i.test(xfo)) return { ok:true, embeddable:false, reason:'x-frame-options-sameorigin' };

        const fa = csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i);
        if (fa) {
          const policy = String(fa[1] || '').trim();
          if (/'none'/i.test(policy)) return { ok:true, embeddable:false, reason:'csp-frame-ancestors-none' };
          const allowsAll = /(^|\s)\*(\s|$)/.test(policy);
          const allowsAzobss = /https:\/\/(?:www\.)?azobss\.com\b/i.test(policy);
          const selfOnly = !allowsAll && !allowsAzobss && /'self'/i.test(policy);
          if (selfOnly || (!allowsAll && !allowsAzobss)) {
            return { ok:true, embeddable:false, reason:'csp-frame-ancestors' };
          }
        }
        return { ok:true, embeddable:true, reason:'public-page-allows-frame', final_url:current.toString() };
      }
      return { ok:false, embeddable:false, reason:'redirect-limit' };
    } catch (err) {
      return { ok:false, embeddable:false, reason:err && err.name === 'AbortError' ? 'timeout' : 'check-failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  return async function handleAZOBSSTV(req, res, parsed) {
    const pathname = (parsed && parsed.pathname) || (() => { try { return new URL(req.url, 'http://localhost').pathname; } catch (_) { return ''; } })();
    if (!pathname.startsWith('/api/azobsstv')) return false;

    try {
      if (pathname === '/api/azobsstv/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, { ok: true, service: 'AZOBSSTV', version: '1.0.1005', firestore: !!getDb(), stream_query_parser: 'node-url-parse-compatible', rtm_referer: true, rtm_origin: true, playback_strategy: 'single-official-player-plus-text-schedule', manamana_schedule: true, manamana_schedule_parser: 'current-public-epg-api-primary-rendered-revlet-html-fallback', manamana_catalogue: 'current-public-video-channels-api', time: Date.now() });
        return true;
      }

      if (pathname === '/api/azobsstv/config' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-config', 240, 10 * 60 * 1000)) return true;
        sendJson(res, 200, await getConfig(), { 'Cache-Control': 'no-store' });
        return true;
      }

      if (pathname === '/api/azobsstv/device/ping' && req.method === 'POST') {
        if (limited(req, res, 'azobsstv-device-ping', 180, 10 * 60 * 1000)) return true;
        const b = await readJsonBody(req, 256 * 1024);
        const now = Date.now();
        const payload = {
          device_id: cleanText(b.device_id, 160),
          username: cleanText(b.username, 160),
          account_name: cleanText(b.account_name, 160),
          account_id: cleanText(b.account_id, 160),
          time: Number.isFinite(Number(b.time)) ? Number(b.time) : Math.floor(now / 1000),
          time_ms: Number.isFinite(Number(b.time_ms)) ? Number(b.time_ms) : now,
          reason: cleanText(b.reason || 'heartbeat', 40),
          app_version: cleanText(b.app_version, 40),
          app_version_code: Number.isFinite(Number(b.app_version_code)) ? Number(b.app_version_code) : 0,
          device_model: cleanText(b.device_model, 220),
          android_release: cleanText(b.android_release, 80),
          updated_at: now
        };
        if (!payload.device_id) { sendJson(res, 400, { ok: false, error: 'device_id required' }); return true; }
        await savePing(payload);
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (pathname === '/api/azobsstv/library' && req.method === 'GET') {
        const identity = await ensureUser(req, res, parsed);
        if (!identity) return true;
        const library = await getUserLibrary(identity);
        sendJson(res, 200, { ok:true, favorites:library.favorites, recent:library.recent, storage:'firestore', uid:String(identity.uid) });
        return true;
      }
      if (pathname === '/api/azobsstv/library' && (req.method === 'PUT' || req.method === 'POST')) {
        const identity = await ensureUser(req, res, parsed);
        if (!identity) return true;
        const input = await readJsonBody(req, 96 * 1024);
        const library = await saveUserLibraryCloud(identity, input);
        sendJson(res, 200, { ok:true, favorites:library.favorites, recent:library.recent, storage:'firestore' });
        return true;
      }

      if (pathname === '/api/azobsstv/notifications' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-notifications', 240, 10 * 60 * 1000)) return true;
        sendJson(res, 200, { items: await readNotifications() });
        return true;
      }

      if (pathname === '/api/azobsstv/anime123/poster' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-anime123-poster', 600, 10 * 60 * 1000)) return true;
        const slug = getQueryParam(parsed, 'slug');
        const poster = await fetch123AnimePoster(slug);
        if (!poster.ok) {
          sendJson(res, poster.status || 404, { ok:false, error:poster.reason || 'poster-not-found' }, { 'Cache-Control':'public, max-age=300' });
          return true;
        }
        send(res, 200, poster.body, poster.type, {
          'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800',
          'Access-Control-Allow-Origin':'*'
        });
        return true;
      }

      if (pathname === '/api/azobsstv/anime123/resolve' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-anime123-resolve', 180, 10 * 60 * 1000)) return true;
        const target = getQueryParam(parsed, 'url');
        if (!target) { sendJson(res, 400, { ok:false, embeddable:false, reason:'url-required' }); return true; }
        sendJson(res, 200, await resolve123AnimeHubPublicPlayer(target), { 'Cache-Control':'public, max-age=180' });
        return true;
      }

      if (pathname === '/api/azobsstv/anime/embed-check' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-anime-embed-check', 240, 10 * 60 * 1000)) return true;
        const target = getQueryParam(parsed, 'url');
        if (!target) { sendJson(res, 400, { ok:false, embeddable:false, reason:'url-required' }); return true; }
        sendJson(res, 200, await checkAnimeNanaEmbed(target), { 'Cache-Control':'public, max-age=300' });
        return true;
      }

      if (pathname === '/api/azobsstv/1tube/movies' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-1tube-movies', 180, 10 * 60 * 1000)) return true;
        const pages = Math.max(1, Math.min(8, Number(getQueryParam(parsed, 'pages') || 4) || 4));
        const force = getQueryParam(parsed, 'refresh') === '1';
        const catalog = await getOneTubeMovies(pages, force);
        sendJson(res, 200, {
          ok: true,
          source: catalog.source,
          pages: catalog.pages,
          count: catalog.items.length,
          movies: catalog.items,
          warning: Array.isArray(catalog.warnings) ? catalog.warnings.join('; ') : ''
        }, { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=600' });
        return true;
      }

      if (pathname === '/api/azobsstv/radio-online/radios' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-radio-online-radios', 180, 10 * 60 * 1000)) return true;
        const force = getQueryParam(parsed, 'refresh') === '1';
        const catalog = await getRadioOnlineCatalog(force);
        sendJson(res, 200, {
          ok: true,
          source: catalog.source,
          count: catalog.items.length,
          radios: catalog.items
        }, { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' });
        return true;
      }

      if (pathname === '/api/azobsstv/radio-online/logo' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-radio-online-logo', 900, 10 * 60 * 1000)) return true;
        const slug = getQueryParam(parsed, 'slug');
        const logo = await resolveRadioOnlineLogo(slug);
        if (!logo) {
          sendJson(res, 404, { ok:false, error:'station-logo-not-found' }, { 'Cache-Control':'public, max-age=300' });
          return true;
        }
        res.statusCode = 302;
        res.setHeader('Location', logo);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.end();
        return true;
      }

      if (pathname === '/api/azobsstv/mana2/channels' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-mana2-channels', 240, 10 * 60 * 1000)) return true;
        const catalog = await getMana2PublicCatalog(false);
        sendJson(res, 200, {
          ok: true,
          source: catalog.source,
          count: catalog.items.length,
          channels: catalog.items,
          warning: catalog.warning || ''
        }, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' });
        return true;
      }

      if (pathname === '/api/azobsstv/mana2/schedule' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-mana2-schedule', 300, 10 * 60 * 1000)) return true;
        const target = getQueryParam(parsed, 'url');
        const channelName = cleanText(getQueryParam(parsed, 'name'), 120);
        const tvgId = cleanText(getQueryParam(parsed, 'tvg_id'), 80);
        if (!target) { sendJson(res, 400, { ok: false, error: 'Mana-Mana channel url required' }); return true; }
        sendJson(res, 200, await getMana2Schedule(target, channelName, tvgId), { 'Cache-Control': 'no-store' });
        return true;
      }

      if (pathname === '/api/azobsstv/stream' && (req.method === 'GET' || req.method === 'HEAD')) {
        if (limited(req, res, 'azobsstv-stream-relay', 3000, 10 * 60 * 1000)) return true;
        const target = cleanUrl(getQueryParam(parsed, 'url'));
        if (!target) { sendJson(res, 400, { ok: false, error: 'Valid stream url required' }); return true; }
        await relayStream(req, res, target);
        return true;
      }

      if (pathname === '/api/azobsstv/playlist/free' && (req.method === 'GET' || req.method === 'HEAD')) {
        if (limited(req, res, 'azobsstv-playlist-free', 180, 10 * 60 * 1000)) return true;
        const body = fs.existsSync(playlistPath) ? fs.readFileSync(playlistPath) : Buffer.from('#EXTM3U\n');
        send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : body, 'audio/x-mpegurl; charset=utf-8', { 'Cache-Control': 'no-store' });
        return true;
      }

      if (pathname === '/api/azobsstv/epg' && (req.method === 'GET' || req.method === 'HEAD')) {
        if (limited(req, res, 'azobsstv-epg', 120, 10 * 60 * 1000)) return true;
        const body = fs.existsSync(epgPath) ? fs.readFileSync(epgPath) : Buffer.from('<?xml version="1.0"?><tv></tv>');
        send(res, 200, req.method === 'HEAD' ? Buffer.alloc(0) : body, 'application/xml; charset=utf-8', { 'Cache-Control': 'no-store' });
        return true;
      }

      if ((pathname === '/api/azobsstv/playlist/fetch' || pathname === '/api/azobsstv/epg/fetch') && req.method === 'POST') {
        if (limited(req, res, 'azobsstv-safe-fetch', 60, 10 * 60 * 1000)) return true;
        const purpose = pathname.includes('/epg/') ? 'epg' : 'playlist';
        const body = await readJsonBody(req, 32 * 1024);
        const target = cleanUrl(body.url);
        if (!target) { sendJson(res, 400, { ok: false, error: 'Valid url required' }); return true; }
        const cfg = await getConfig();
        const fetched = await fetchBufferSafe(target, purpose, cfg, purpose === 'epg' ? 20 * 1024 * 1024 : 6 * 1024 * 1024, purpose === 'epg' ? 120_000 : 60_000);
        const out = purpose === 'epg' ? maybeGunzip(fetched.buffer) : fetched.buffer;
        send(res, 200, out, purpose === 'epg' ? 'application/xml; charset=utf-8' : 'audio/x-mpegurl; charset=utf-8', { 'Cache-Control': 'no-store' });
        return true;
      }

      if (pathname.startsWith('/api/azobsstv/admin/')) {
        if (limited(req, res, 'azobsstv-admin', 120, 10 * 60 * 1000)) return true;
        const identity = await ensureAdmin(req, res, parsed);
        if (!identity) return true;

        if (pathname === '/api/azobsstv/admin/config' && req.method === 'GET') {
          sendJson(res, 200, await getConfig()); return true;
        }
        if (pathname === '/api/azobsstv/admin/config' && (req.method === 'POST' || req.method === 'PUT')) {
          const body = await readJsonBody(req, 256 * 1024);
          sendJson(res, 200, { ok: true, config: await saveConfig(body) }); return true;
        }
        if (pathname === '/api/azobsstv/admin/devices' && req.method === 'GET') {
          const items = await readDevices();
          sendJson(res, 200, { ok: true, online: items.filter(x => x.online).length, total: items.length, items }); return true;
        }
        if (pathname === '/api/azobsstv/admin/heartbeats' && req.method === 'GET') {
          const db = getDb();
          let items = [];
          if (db) {
            try {
              const snap = await db.collection('azobsstvHeartbeats').orderBy('updated_at', 'desc').limit(200).get();
              items = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
            } catch (err) { console.warn('AZOBSSTV heartbeat read failed:', err && (err.message || err)); }
          } else {
            const local = readJsonFile(heartbeatFallbackPath, { items: [] });
            items = Array.isArray(local.items) ? local.items.slice(0, 200) : [];
          }
          sendJson(res, 200, { ok: true, items }); return true;
        }
        if (pathname === '/api/azobsstv/admin/notifications' && req.method === 'GET') {
          sendJson(res, 200, { ok: true, items: (await readNotifications()).slice().reverse() }); return true;
        }
        if (pathname === '/api/azobsstv/admin/notifications' && req.method === 'POST') {
          const b = await readJsonBody(req, 64 * 1024);
          const item = {
            title: cleanText(b.title || 'AZOBSSTV', 100),
            message: cleanText(b.message != null ? b.message : b.body, 2000),
            timestamp: Number.isFinite(Number(b.timestamp)) ? Number(b.timestamp) : Date.now()
          };
          if (!item.message) { sendJson(res, 400, { ok: false, error: 'message required' }); return true; }
          const db = getDb();
          let id = crypto.randomUUID();
          if (db) {
            const ref = await db.collection('azobsstvNotifications').add(item);
            id = ref.id;
          } else {
            const local = readJsonFile(notifyPath, { items: [] });
            const arr = Array.isArray(local) ? local : (Array.isArray(local.items) ? local.items : []);
            arr.push({ id, ...item });
            writeJsonFile(notifyPath, { items: arr.slice(-100) });
          }
          sendJson(res, 200, { ok: true, id }); return true;
        }
        const deleteMatch = pathname.match(/^\/api\/azobsstv\/admin\/notifications\/([^/]+)$/);
        if (deleteMatch && req.method === 'DELETE') {
          const id = cleanText(decodeURIComponent(deleteMatch[1]), 180);
          const db = getDb();
          if (db) await db.collection('azobsstvNotifications').doc(id).delete();
          else {
            const local = readJsonFile(notifyPath, { items: [] });
            const arr = Array.isArray(local) ? local : (Array.isArray(local.items) ? local.items : []);
            writeJsonFile(notifyPath, { items: arr.filter(x => String(x.id) !== id) });
          }
          sendJson(res, 200, { ok: true }); return true;
        }
      }

      sendJson(res, 404, { ok: false, error: 'AZOBSSTV endpoint not found' });
      return true;
    } catch (err) {
      const status = Number(err && err.statusCode) || (err && err.name === 'AbortError' ? 504 : 500);
      console.warn('AZOBSSTV API error:', pathname, err && (err.stack || err.message || err));
      const publicError = err && err.publicMessage ? cleanText(err.publicMessage, 300) : (status >= 500 ? 'AZOBSSTV backend request failed' : cleanText(err && err.message, 300));
      sendJson(res, status, { ok: false, error: publicError });
      return true;
    }
  };
}

module.exports = { createAZOBSSTVHandler };
