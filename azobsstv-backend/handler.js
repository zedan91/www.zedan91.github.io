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

  function limited(req, res, name, maxHits, windowMs) {
    return rateLimitOrSend ? rateLimitOrSend(req, res, name, maxHits, windowMs) : false;
  }

  return async function handleAZOBSSTV(req, res, parsed) {
    const pathname = (parsed && parsed.pathname) || (() => { try { return new URL(req.url, 'http://localhost').pathname; } catch (_) { return ''; } })();
    if (!pathname.startsWith('/api/azobsstv')) return false;

    try {
      if (pathname === '/api/azobsstv/health' && (req.method === 'GET' || req.method === 'HEAD')) {
        sendJson(res, 200, { ok: true, service: 'AZOBSSTV', version: '1.0.971', firestore: !!getDb(), stream_query_parser: 'node-url-parse-compatible', rtm_referer: true, rtm_origin: true, playback_strategy: 'official-player-for-protected-rtm', time: Date.now() });
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
