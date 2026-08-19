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


  // v983: read programme TEXT from the actually rendered public Mana-Mana page.
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
      const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
      const parsed = parseRenderedMana2Text(bodyText);
      if (!parsed.schedule.length && !parsed.current_title) throw Object.assign(new Error('Mana-Mana rendered page returned no programme text'), { statusCode: 404 });
      return { ok:true, channel_url:target.toString(), current_title:parsed.current_title||'', schedule:parsed.schedule||[], parser:'rendered-dom-headless', fetched_at:Date.now(), time_zone:'Asia/Kuala_Lumpur' };
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
        const err = new Error(`Mana-Mana API HTTP ${response.status}`);
        err.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        err.responseBody = body.slice(0, 400);
        throw err;
      }
      try { return JSON.parse(body); }
      catch (_) {
        const err = new Error('Mana-Mana API returned invalid JSON');
        err.statusCode = 502;
        throw err;
      }
    } finally { clearTimeout(timer); }
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
        description: cleanText(p.subtitle2 ?? p.description ?? p.synopsis ?? '', 800),
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

    let renderedError = null;
    try {
      const value = await getMana2RenderedSchedule(target.toString());
      mana2ScheduleCache.set(key, { savedAt: Date.now(), value });
      return value;
    } catch (e) { renderedError = e; }

    let guideError = null;
    try {
      const value = await getMana2GuideSchedule(target.toString(), channelName, tvgId);
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
      if (!response.ok) throw guideError || renderedError || Object.assign(new Error(`Mana-Mana page HTTP ${response.status}`), { statusCode:response.status });
      const html = await response.text();
      if (html.length > 4 * 1024 * 1024) throw Object.assign(new Error('Mana-Mana page too large'), { statusCode:413 });
      const parsed = extractMana2Schedule(html);
      const value = { ok:true, channel_url:target.toString(), current_title:parsed.current_title||'', schedule:parsed.schedule||[], parser:(parsed.schedule?.length||parsed.current_title)?'html-nextjs-fallback':'none', rendered_dom_error:cleanText(renderedError?.message||'',160), guide_api_error:cleanText(guideError?.message||'',160), fetched_at:Date.now(), time_zone:'Asia/Kuala_Lumpur' };
      mana2ScheduleCache.set(key, { savedAt:Date.now(), value });
      return value;
    } finally { clearTimeout(timer); }
  }

  function limited(req, res, name, maxHits, windowMs) {
    return rateLimitOrSend ? rateLimitOrSend(req, res, name, maxHits, windowMs) : false;
  }

  return async function handleAZOBSSTV(req, res, parsed) {
    const pathname = (parsed && parsed.pathname) || (() => { try { return new URL(req.url, 'http://localhost').pathname; } catch (_) { return ''; } })();
    if (!pathname.startsWith('/api/azobsstv')) return false;

    try {
      if (pathname === '/api/azobsstv/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, { ok: true, service: 'AZOBSSTV', version: '1.0.983', firestore: !!getDb(), stream_query_parser: 'node-url-parse-compatible', rtm_referer: true, rtm_origin: true, playback_strategy: 'single-official-player-plus-text-schedule', manamana_schedule: true, manamana_schedule_parser: 'rendered-dom-headless-primary-revlet-html-fallback', time: Date.now() });
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

      if (pathname === '/api/azobsstv/notifications' && req.method === 'GET') {
        if (limited(req, res, 'azobsstv-notifications', 240, 10 * 60 * 1000)) return true;
        sendJson(res, 200, { items: await readNotifications() });
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
