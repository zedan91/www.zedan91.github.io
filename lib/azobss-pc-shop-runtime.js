'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RELEASE = '1485';
const API_VERSION = 'pc-shop-v1';
const CAPABILITIES = Object.freeze({
  catalog: true,
  orders: true,
  adminOrders: true,
  livePricing: true,
  markup: true,
  maybankOnly: true,
  salesReceiptSync: true,
  verifiedPriceOnly: true,
  hardwareCatalogOnly: true,
  deferredInvoice: true,
  courierAddressRequired: true,
  duplicateGuard: true,
  prematureInvoiceRepair: true,
  strictAvailability: true,
  staleCartReject: true,
  retailerBuildLiveVerification: true,
  privatePricing: true,
  imageProxy: true
});

function createPcShopRuntime(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const getDb = options.getDb;
  const getUserIdentity = options.getUserIdentity;
  const getAdminIdentity = options.getAdminIdentity;
  const readBody = options.readBody;
  const send = options.send;
  const cleanTextBase = options.cleanText || ((v, max = 300) => String(v || '').slice(0, max));
  const pcBuildFetch = options.pcBuildFetch;
  const pcBuildReadShopify = options.pcBuildReadShopify;
  const pcBuildPriceFromJsonLd = options.pcBuildPriceFromJsonLd;
  const pcBuildPriceFromHtml = options.pcBuildPriceFromHtml;
  const publicApiBase = String(process.env.AZOBSS_PUBLIC_BACKEND_URL || 'https://azobss-backend.onrender.com').replace(/\/$/,'');

  if (typeof getDb !== 'function' || typeof getUserIdentity !== 'function' || typeof getAdminIdentity !== 'function' || typeof readBody !== 'function' || typeof send !== 'function') {
    throw new Error('PC Shop runtime dependencies are incomplete.');
  }

  const catalogCandidates = [path.join(rootDir, 'PC-Build', 'pc-shop-products-v1485.json')];
  const buildFile = path.join(rootDir, 'PC-Build', 'pc-build-data.json');
  const retailerDir = path.join(rootDir, 'PC-Build', 'retailers');
  const cacheMs = Math.max(60_000, Number(process.env.PC_SHOP_PRICE_CACHE_MS || 600_000) || 600_000);
  const duplicateWindowMs = Math.max(60_000, Number(process.env.PC_SHOP_DUPLICATE_WINDOW_MS || 15 * 60_000) || 15 * 60_000);

  let catalogCache = null;
  let buildLookupCache = null;
  let liveCache = { fetchedAtMs: 0, publicProducts: [], internalProducts: [], stats: { live: 0, snapshot: 0, total: 0 } };
  let buildLiveCache = { fetchedAtMs: 0, publicBuilds: [], internalBuilds: [], stats: { live: 0, total: 0, hidden: 0 } };
  const imageCache = new Map();
  const imageCacheMs = Math.max(60_000, Number(process.env.PC_SHOP_IMAGE_CACHE_MS || 24 * 60 * 60_000) || 24 * 60 * 60_000);

  const text = (v, max = 300) => cleanTextBase(String(v || ''), max);
  const money = v => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  };
  const cleanSourcePrice = v => {
    const n = Number(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n >= 20 && n <= 100000 ? Math.round(n * 100) / 100 : 0;
  };
  const readJson = (file, fallback) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
  };
  const currentCatalogFile = () => catalogCandidates.find(file => fs.existsSync(file)) || catalogCandidates[0];
  const catalog = () => {
    if (catalogCache) return catalogCache;
    const raw = readJson(currentCatalogFile(), { products: [] });
    catalogCache = Array.isArray(raw.products) ? raw.products : [];
    return catalogCache;
  };
  const buildLookup = () => {
    if (buildLookupCache) return buildLookupCache;
    const map = new Map();
    const base = readJson(buildFile, { builds: [] });
    for (const row of (base.builds || [])) if (row && row.id) map.set(String(row.id), row);
    try {
      for (const file of fs.readdirSync(retailerDir)) {
        if (!file.endsWith('.json') || file === 'index.json') continue;
        const cat = readJson(path.join(retailerDir, file), { products: [] });
        for (const row of (cat.products || [])) {
          if (!row || !row.id) continue;
          map.set(String(row.id), { ...row, retailerSnapshot: true, storeId: row.storeId || cat.storeId, storeName: row.storeName || cat.storeName });
        }
      }
    } catch (_) {}
    buildLookupCache = map;
    return map;
  };
  const markupRate = cost => {
    cost = Number(cost) || 0;
    if (cost <= 2500) return 0.15;
    if (cost <= 4000) return 0.12;
    if (cost <= 6000) return 0.10;
    if (cost <= 8000) return 0.09;
    if (cost <= 10000) return 0.08;
    return 0.07;
  };
  const sellingPrice = (cost, product = {}) => {
    cost = money(cost);
    if (!cost) return { cost: 0, rate: 0, markup: 0, price: 0 };
    const system = /^(desktop|laptop|pc-build)$/i.test(String(product.type || product.itemType || '')) || /(desktop pc|custom pc|laptop|pc build)/i.test(String(product.category || ''));
    const rate = markupRate(cost);
    const minMarkup = system ? 250 : 150;
    const markup = Math.max(cost * rate, minMarkup);
    const price = Math.ceil((cost + markup) / 10) * 10;
    return { cost, rate, markup: money(price - cost), price: money(price), minMarkup };
  };
  const htmlText = html => String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const decodeEntities = v => String(v||'').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'\"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
  const metaFromHtml = (html, sourceUrl='') => {
    const raw=String(html||'');
    const meta=(key)=>{
      const escKey=String(key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const a=raw.match(new RegExp(`<meta[^>]+(?:property|name)=[\"']${escKey}[\"'][^>]+content=[\"']([^\"']+)[\"']`,'i'));
      const b=raw.match(new RegExp(`<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${escKey}[\"']`,'i'));
      return decodeEntities((a&&a[1])||(b&&b[1])||'').trim();
    };
    let title=meta('og:title')||meta('twitter:title');
    if(!title){const m=raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);title=decodeEntities((m&&m[1])||'').replace(/\s+/g,' ').trim();}
    let image=meta('og:image')||meta('twitter:image');
    try{if(image) image=new URL(image,sourceUrl).toString();}catch{image='';}
    return {title,image,text:htmlText(raw)};
  };
  const storeNameFromUrl = (sourceUrl, fallback='') => {
    let host=''; try{host=new URL(String(sourceUrl||'')).hostname.toLowerCase();}catch{}
    if(host.includes('idealtech')) return 'Ideal Tech';
    if(host.includes('allithypermarket')) return 'ALL IT Hypermarket';
    if(host.includes('dotatech')) return 'DOTATECH';
    if(host.includes('emarque')) return 'EMARQUE';
    if(host.includes('nbplaza')) return 'NB Plaza';
    if(host.includes('illegear')) return 'ILLEGEAR';
    if(host.includes('viewnet')) return 'Viewnet';
    if(host.includes('jayacom')) return 'Jayacom';
    if(host.includes('techhypermart')) return 'Tech Hypermart';
    if(host.includes('brightstar')) return 'Brightstar Computer';
    return String(fallback||'').trim();
  };
  const cleanRetailTitle = (value, store='') => {
    let out=String(value||'').replace(/\s+/g,' ').trim();
    const names=[store,'AZOBSS','IDEALTECH','Ideal Tech','ALL IT Hypermarket','ALL IT','DOTATECH','EMARQUE','ILLEGEAR','NB Plaza','Viewnet','Jayacom','Tech Hypermart','Brightstar Computer'];
    for(const n of names.filter(Boolean)){const re=new RegExp('^'+String(n).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s*[-–—:|]\\s*|\\s+)','i');out=out.replace(re,'').trim();}
    return out||String(value||'').trim();
  };
  const keyModelTokens = parts => {
    const rows=Array.isArray(parts)?parts:[]; const out=[];
    for(const [label,val] of rows){
      if(!/^(cpu|gpu)$/i.test(String(label||''))) continue;
      const tokens=norm(val).split(' ').filter(t=>/\d/.test(t)&&t.length>=4);
      if(tokens.length) out.push(tokens[tokens.length-1]);
    }
    return [...new Set(out)];
  };
  const sourceIdentityMatches = (build, sourceText, productTitle='') => {
    const hay=norm(`${productTitle||''} ${sourceText||''}`);
    if(!hay) return false;
    const tokens=keyModelTokens(build.parts);
    if(!tokens.length) return norm(build.name).split(' ').filter(x=>x.length>=5).some(x=>hay.includes(x));
    return tokens.every(t=>hay.includes(t));
  };
  const priceNearProduct = (html, product) => {
    const pageText = htmlText(html), lower = pageText.toLowerCase();
    if (!lower) return 0;
    const seeds = [];
    for (const raw of [product.sourceMatch, product.name]) {
      if (Array.isArray(raw)) seeds.push(...raw); else if (raw) seeds.push(raw);
    }
    for (const raw of seeds) {
      const direct = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!direct) continue;
      let i = lower.indexOf(direct);
      if (i < 0) {
        const tokens = norm(raw).split(' ').filter(x => x.length >= 4).slice(0, 5);
        if (tokens.length) {
          i = lower.indexOf(tokens[0]);
          if (i >= 0) {
            const probe = norm(pageText.slice(i, i + 500));
            if (!tokens.slice(1).every(t => probe.includes(t))) i = -1;
          }
        }
      }
      if (i < 0) continue;
      const windowText = pageText.slice(Math.max(0, i - 120), Math.min(pageText.length, i + 1400));
      const vals = [];
      for (const m of windowText.matchAll(/RM\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi)) {
        const n = cleanSourcePrice(m[1]);
        if (n) vals.push(n);
      }
      if (vals.length) return vals[0];
    }
    return 0;
  };

  const availabilityNearProduct = (html, product) => {
    const pageText = htmlText(html), lower = pageText.toLowerCase();
    if (!lower) return 'unknown';
    const seeds = [];
    for (const raw of [product.sourceMatch, product.name]) {
      if (Array.isArray(raw)) seeds.push(...raw); else if (raw) seeds.push(raw);
    }
    let i = -1;
    for (const raw of seeds) {
      const direct = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!direct) continue;
      i = lower.indexOf(direct);
      if (i >= 0) break;
    }
    const probe = (i >= 0 ? pageText.slice(Math.max(0, i - 350), Math.min(pageText.length, i + 2600)) : pageText.slice(0, 3200)).toLowerCase();
    if (/out[\s-]*of[\s-]*stock|sold out|currently unavailable|notify me when available|back in stock/.test(probe)) return 'unavailable';
    if (/stock adequate|ready to ship|in stock|add to cart|available now/.test(probe)) return 'available';
    return 'unknown';
  };


  async function readLiveSource(product, pageCache) {
    const sourceUrl = String(product.sourceUrl || '').trim();
    if (!sourceUrl) throw new Error('source_url_missing');
    const provider = String(product.sourceProvider || product.provider || '').toLowerCase();
    const exactShopify = /\/products\//i.test(sourceUrl) && (provider === 'shopify' || /emarque\.co|dotatech\.com\.my|allithypermarket\.com\.my/i.test(sourceUrl));
    if (exactShopify && typeof pcBuildReadShopify === 'function') {
      const data = await pcBuildReadShopify({ sourceUrl, variantKeywords: Array.isArray(product.variantKeywords) ? product.variantKeywords : [] });
      const availability = data.available === true ? 'available' : (data.available === false ? 'unavailable' : 'unknown');
      return { price: data.price, availability, variant: data.variant || '', productTitle:data.productTitle||'', sourceImage:data.image||'', sourceText:data.sourceText||data.productTitle||'' };
    }
    if (typeof pcBuildFetch !== 'function') throw new Error('live_fetch_unavailable');
    let promise = pageCache.get(sourceUrl);
    if (!promise) { promise = pcBuildFetch(sourceUrl, false); pageCache.set(sourceUrl, promise); }
    const html = await promise;
    const categoryLike = /\/collections\//i.test(sourceUrl) || /\/145-pc-components(?:[/?#]|$)/i.test(sourceUrl) || /\/24-acer-desktop(?:[/?#]|$)/i.test(sourceUrl) || /\/12-hp-desktop(?:[/?#]|$)/i.test(sourceUrl) || /\/29-msi-laptop(?:[/?#]|$)/i.test(sourceUrl);
    let price = 0;
    if (!categoryLike && typeof pcBuildPriceFromJsonLd === 'function') price = pcBuildPriceFromJsonLd(html) || 0;
    if (!price && !categoryLike && typeof pcBuildPriceFromHtml === 'function') price = pcBuildPriceFromHtml(html) || 0;
    if (!price) price = priceNearProduct(html, product);
    if (!price && !categoryLike && typeof pcBuildPriceFromHtml === 'function') price = pcBuildPriceFromHtml(html) || 0;
    if (!price) throw new Error('live_price_not_found');
    const meta=metaFromHtml(html,sourceUrl);
    return { price, availability: availabilityNearProduct(html, product), variant: '', productTitle:meta.title||'', sourceImage:meta.image||'', sourceText:meta.text||'' };
  }

  const verifiedSnapshotFresh = () => false; // v1484: public checkout never trusts stored snapshot prices.

  async function getLiveCatalog(force = false) {
    const now = Date.now();
    if (!force && liveCache.fetchedAtMs && now - liveCache.fetchedAtMs < cacheMs) return liveCache;
    const base = catalog(), pageCache = new Map();
    const rows = await Promise.all(base.map(async product => {
      let sourcePrice = 0, priceStatus = 'unverified', liveError = '', availability = 'unknown', checkedAt = '', sourceImage='', sourceTitle='';
      try {
        const live = await readLiveSource(product, pageCache);
        if (live.price > 0) {
          sourcePrice = money(live.price); priceStatus = 'live'; availability = String(live.availability || 'unknown'); checkedAt = new Date().toISOString(); sourceImage=String(live.sourceImage||product.image||''); sourceTitle=String(live.productTitle||'');
        }
      } catch (err) { liveError = text(err?.message || err, 160); }
      const sell = sellingPrice(sourcePrice, product), finalPrice=priceStatus==='live' && availability==='available';
      const mediaOk=/^https:\/\//i.test(sourceImage);
      const internal = { ...product, sourcePrice, unitCost: sourcePrice, sourceImage, sourceTitle, price: finalPrice ? sell.price : 0, markupRate: finalPrice ? sell.rate : 0, markupAmount: finalPrice ? sell.markup : 0, priceStatus, livePrice: priceStatus === 'live', livePriceError: liveError, priceCheckedAt: checkedAt, availability, available: availability==='available', requiresConfirmation: !finalPrice || sell.price <= 0, mediaVerified:mediaOk };
      const pub = { id: internal.id, type: internal.type, category: internal.category, name: internal.name, price: internal.price, priceStatus: internal.priceStatus, priceCheckedAt: internal.priceCheckedAt, requiresConfirmation: internal.requiresConfirmation, stock: internal.available ? 'in-stock' : 'unavailable', specs: Array.isArray(internal.specs) ? internal.specs : [], image: `${publicApiBase}/api/pc-shop/image/${encodeURIComponent(String(internal.id||''))}`, imageType: internal.imageType || '', imageCrop: internal.imageCrop || '', available: internal.available === true, availability: internal.availability, sourceName: internal.sourceName || '', sourceUrl: internal.sourceUrl || '', mediaVerified: internal.mediaVerified === true, specVerified: internal.specVerified === true };
      return { internal, pub };
    }));
    const internalProducts = rows.map(x => x.internal);
    const publicHardware = rows.filter(x => String(x.internal.type || '').toLowerCase() === 'hardware');
    const publicProducts = publicHardware.filter(x => x.internal.priceStatus === 'live' && x.internal.requiresConfirmation !== true && x.internal.available === true && x.internal.availability === 'available' && x.internal.mediaVerified===true && x.internal.specVerified===true && money(x.internal.price) > 0).map(x => x.pub);
    const stats = { live: publicProducts.filter(x=>x.priceStatus==='live').length, verified: publicProducts.filter(x=>x.priceStatus==='verified').length, visible: publicProducts.length, snapshot: Math.max(0, publicHardware.length - publicProducts.length), total: publicHardware.length, hiddenUnverified: Math.max(0, publicHardware.length - publicProducts.length), internalTotal: internalProducts.length };
    liveCache = { fetchedAtMs: Date.now(), internalProducts, publicProducts, stats };
    return liveCache;
  }

  function resolveItem(raw = {}, liveProducts = []) {
    const productId = text(raw.productId || raw.id, 160);
    const qty = Math.max(1, Math.min(20, Math.round(Number(raw.qty || raw.quantity || 1) || 1)));
    const product = liveProducts.find(x => String(x.id) === productId);
    if (product) {
      if (String(product.type || '').toLowerCase() !== 'hardware' || product.available !== true || String(product.availability || '') !== 'available' || String(product.priceStatus || '') !== 'live' || product.requiresConfirmation === true || money(product.price) <= 0) return null;
      const sourceCost = money(product.sourcePrice || product.unitCost);
      return { productId, name: text(product.name, 180), category: text(product.category || 'Hardware', 80), itemType: 'hardware', qty, unitPrice: money(product.price), unitCost: sourceCost, markupRate: Number(product.markupRate) || 0, markupAmount: money(product.markupAmount), priceMode: 'azobss-selling', priceStatus: 'live', priceCheckedAt: text(product.priceCheckedAt, 60), requiresConfirmation: false, sourceCheckedAt: '', sourceName: text(product.sourceName, 100), sourceUrl: text(product.sourceUrl, 500), image: text(product.image, 500), specs: Array.isArray(product.specs) ? product.specs.slice(0, 16).map(x => text(x, 180)) : [] };
    }
    // v1484: PC Builds are enquiry-only on the public page and are never resolved from static retailer snapshots during checkout.
    return null;
  }


  const retailerBuildCandidates = () => {
    const out = [], seen=new Set();
    const base=readJson(buildFile,{builds:[]});
    // v1485: the 18 curated builds already point to exact live retailer product URLs.
    // They are presented under the original retailer, never as an AZOBSS source.
    for(const raw of (base.builds||[])){
      const sourceUrl=String(raw?.sourceUrl||'');
      if(!raw?.id || !/^https:\/\//i.test(sourceUrl) || !/\/(?:product|products)\//i.test(sourceUrl)) continue;
      const row={...raw, origin:'retailer', retailerSnapshot:false, storeName:storeNameFromUrl(sourceUrl,raw.sourceName), storeId:norm(storeNameFromUrl(sourceUrl,raw.sourceName)).replace(/ /g,'-'), sourceVerified:true, mediaVerified:false, specVerified:Array.isArray(raw.parts)&&raw.parts.length>=7, variantVerified:true, availabilityVerified:false};
      out.push(row); seen.add(String(row.id));
    }
    // Keep additional exact retailer records (for example DOTATECH) when they have full specs.
    try {
      for (const file of fs.readdirSync(retailerDir)) {
        if (!file.endsWith('.json') || file === 'index.json') continue;
        const cat = readJson(path.join(retailerDir, file), { products: [] });
        for (const raw of (cat.products || [])) {
          if(!raw?.id || seen.has(String(raw.id))) continue;
          const sourceUrl=String(raw.sourceUrl||''), exactUrl=/\/(?:product|products)\//i.test(sourceUrl);
          if(!exactUrl || !Array.isArray(raw.parts) || raw.parts.length<7) continue;
          out.push({ ...raw, retailerSnapshot:true, storeId:raw.storeId||cat.storeId, storeName:raw.storeName||cat.storeName, sourceVerified:true }); seen.add(String(raw.id));
        }
      }
    } catch (_) {}
    return out;
  };


  async function getLiveBuildCatalog(force = false) {
    const now = Date.now();
    if (!force && buildLiveCache.fetchedAtMs && now - buildLiveCache.fetchedAtMs < cacheMs) return buildLiveCache;
    const base = retailerBuildCandidates(), pageCache = new Map();
    const rows = await Promise.all(base.map(async build => {
      let sourcePrice = 0, availability = 'unknown', liveError = '', checkedAt = '', sourceImage='', productTitle='', sourceText='';
      try {
        const live = await readLiveSource(build, pageCache);
        sourcePrice = money(live.price); availability = String(live.availability || 'unknown'); checkedAt = new Date().toISOString(); sourceImage=String(live.sourceImage||''); productTitle=String(live.productTitle||''); sourceText=String(live.sourceText||'');
      } catch (err) { liveError = text(err?.message || err, 160); }
      const identityOk=sourceIdentityMatches(build,sourceText,productTitle);
      const mediaOk=/^https:\/\//i.test(sourceImage);
      const specOk=Array.isArray(build.parts)&&build.parts.length>=7&&identityOk;
      const valid=availability==='available'&&sourcePrice>0&&mediaOk&&specOk;
      const sell = valid ? sellingPrice(sourcePrice, { type:'pc-build', category:'PC Build' }) : { price:0, rate:0, markup:0 };
      const storeName=storeNameFromUrl(build.sourceUrl,build.storeName||build.sourceName||'');
      const cleanName=cleanRetailTitle(productTitle||build.name,storeName);
      const internal = { ...build, name:cleanName, storeName, sourceName:storeName, sourceImage, productTitle, sourcePrice, unitCost:sourcePrice, price:sell.price, markupRate:sell.rate, markupAmount:sell.markup, availability, available:valid, priceStatus:sourcePrice>0?'live':'unverified', priceCheckedAt:checkedAt, livePriceError:liveError, mediaVerified:mediaOk, specVerified:specOk, availabilityVerified:availability!=='unknown', sourceVerified:true, variantVerified:true };
      const pub = valid ? {
        id: internal.id, origin:'retailer', retailerSnapshot:false, storeId:internal.storeId||norm(storeName).replace(/ /g,'-'), storeName, tier:internal.tier||'', name:cleanName||'PC Build', tagline:internal.tagline||'', category:internal.category||'gaming', resolution:internal.resolution||'', price:internal.price, priceStatus:'live', priceCheckedAt:internal.priceCheckedAt, sourceName:storeName, sourceUrl:internal.sourceUrl||'', badge:internal.badge||'PC BUILD', accent:internal.accent||'cyan', parts:Array.isArray(internal.parts)?internal.parts:[], bestFor:Array.isArray(internal.bestFor)?internal.bestFor:[], softwareFit:Array.isArray(internal.softwareFit)?internal.softwareFit:[], note:'Harga, stok, gambar dan spec utama disahkan daripada halaman produk yang sama.', image:`${publicApiBase}/api/pc-shop/build-image/${encodeURIComponent(String(internal.id||''))}`, imageAlt:cleanName||'PC Build', imageType:'exact-source-product-image', imageCrop:'pc-focus', segment:internal.segment||'package', cpuBrand:internal.cpuBrand||'', platform:internal.platform||'', gpuBrand:internal.gpuBrand||'', gpuModel:internal.gpuModel||'', resolutionTags:Array.isArray(internal.resolutionTags)?internal.resolutionTags:[], availability:'available', availabilityVerified:true, priceVerified:true, mediaVerified:true, specVerified:true, variantVerified:true, sourceVerified:true
      } : null;
      return { internal, pub };
    }));
    const publicBuilds = rows.map(x=>x.pub).filter(Boolean);
    const internalBuilds = rows.map(x=>x.internal);
    buildLiveCache = { fetchedAtMs:Date.now(), publicBuilds, internalBuilds, stats:{ live:publicBuilds.length, total:base.length, hidden:Math.max(0,base.length-publicBuilds.length) } };
    return buildLiveCache;
  }


  async function cachedImage(url) {
    const key=String(url||'');
    if(!key || !/^https:\/\//i.test(key)) throw new Error('image_url_invalid');
    const hit=imageCache.get(key);
    if(hit && Date.now()-hit.at<imageCacheMs) return hit;
    if(typeof fetch!=='function') throw new Error('fetch_unavailable');
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),12000);
    try{
      const r=await fetch(key,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 AZOBSSImageCache/1.0','Accept':'image/avif,image/webp,image/*,*/*;q=0.8'}});
      if(!r.ok) throw new Error(`image_http_${r.status}`);
      const type=String(r.headers.get('content-type')||'image/jpeg').split(';')[0];
      if(!/^image\//i.test(type)) throw new Error('image_content_type_invalid');
      const ab=await r.arrayBuffer();
      if(ab.byteLength<512 || ab.byteLength>8*1024*1024) throw new Error('image_size_invalid');
      const row={at:Date.now(),type,body:Buffer.from(ab)};imageCache.set(key,row);return row;
    } finally { clearTimeout(timer); }
  }
  async function nextSequence(db) {
    const year = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric' });
    const ref = db.collection('settings').doc('pcShopCounters');
    let seq = 1;
    try {
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref), data = snap.exists ? (snap.data() || {}) : {}, key = `orderSeq${year}`;
        seq = Math.max(0, Number(data[key] || 0)) + 1;
        tx.set(ref, { [key]: seq, updatedAtMs: Date.now() }, { merge: true });
      });
    } catch (_) { seq = Number(String(Date.now()).slice(-6)); }
    return { year, seq, serial: String(seq).padStart(6, '0') };
  }

  function publicOrder(row = {}) {
    return {
      orderId: row.orderId || '', documentNo: row.documentNo || '', quoteNo: row.quoteNo || '', invoiceNo: row.invoiceNo || '', receiptNo: row.receiptNo || '',
      invoiceIssued: !!row.invoiceNo, intent: row.intent || 'checkout', status: row.status || '', paymentStatus: row.paymentStatus || '', fulfillmentStatus: row.fulfillmentStatus || '',
      priceConfirmed: row.priceConfirmed === true, priceConfirmationRequired: row.priceConfirmationRequired === true, shippingConfirmationRequired: row.shippingConfirmationRequired === true,
      referenceSubtotal: money(row.referenceSubtotal), confirmedItemTotal: money(row.confirmedItemTotal), confirmedTotal: money(row.confirmedTotal), shippingCharge: money(row.shippingCharge), currency: 'MYR',
      items: Array.isArray(row.items) ? row.items.map(x => ({ productId: x.productId || '', name: x.name || '', category: x.category || '', qty: Number(x.qty || 1), unitPrice: money(x.unitPrice), priceMode: x.priceMode || '', priceStatus: x.priceStatus || '' })) : [],
      shippingMethod: row.shippingMethod || '', paymentMethod: row.paymentMethod || '', courier: row.courier || '', trackingNumber: row.trackingNumber || '', customerName: row.customerName || '',
      createdAtMs: Number(row.createdAtMs || 0), updatedAtMs: Number(row.updatedAtMs || 0), statusHistory: Array.isArray(row.statusHistory) ? row.statusHistory.slice(-20) : []
    };
  }

  function purchaseLogId(order) { return `pcshop-${text(order?.orderId, 120)}`; }
  function invoiceReady(order) {
    return !!(order && order.intent === 'checkout' && order.priceConfirmed === true && order.shippingConfirmationRequired !== true && String(order.invoiceNo || '').trim());
  }

  async function syncPurchaseLog(db, order) {
    if (!db || !order || order.intent !== 'checkout') return;
    const docId = purchaseLogId(order);
    if (!invoiceReady(order)) {
      try { await db.collection('purchaseLogs').doc(docId).delete(); } catch (_) {}
      return;
    }
    const gross = money(order.confirmedTotal || (money(order.confirmedItemTotal || order.referenceSubtotal) + money(order.shippingCharge)));
    const paid = String(order.paymentStatus || '').toLowerCase() === 'paid';
    const items = (order.items || []).map(x => ({ category: 'computer-it', name: x.name || 'PC / Hardware', qty: Number(x.qty || 1), unitPrice: money(x.confirmedUnitPrice || x.unitPrice), unitCost: money(x.unitCost || 0) }));
    await db.collection('purchaseLogs').doc(docId).set({
      source: 'pc-shop', sourceName: 'AZOBSS PC Build & Hardware', orderId: order.orderId, invoiceNo: order.invoiceNo || '', receiptNo: paid ? (order.receiptNo || '') : '',
      productName: items.map(x => x.name).slice(0, 3).join(' + ') || 'PC / Hardware Order', category: 'computer-it', items,
      amount: gross, total: gross, totalAmount: gross, status: paid ? 'paid' : 'pending', paymentStatus: paid ? 'paid' : 'pending', paid,
      priceConfirmationRequired: order.priceConfirmationRequired === true, priceConfirmed: order.priceConfirmed === true,
      customerName: order.customerName || '', customerPhone: order.customerPhone || '', customerEmail: order.customerEmail || '', customerAddress: order.customerAddress || '',
      paymentMethod: order.paymentMethod || 'Maybank', shippingCharge: money(order.shippingCharge), shippingCost: money(order.shippingCost), fulfillmentStatus: order.fulfillmentStatus || '',
      trackingNumber: order.trackingNumber || '', courier: order.courier || '', createdAtMs: Number(order.createdAtMs || Date.now()), updatedAtMs: Date.now(), paidAtMs: paid ? Number(order.paidAtMs || Date.now()) : 0
    }, { merge: true });
  }

  const normalizeFingerprintPart = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function orderFingerprint(identity, intent, requested, shippingMethod, body) {
    const itemKey = requested.map(x => `${normalizeFingerprintPart(x.productId || x.id)}:${Math.max(1, Math.min(20, Math.round(Number(x.qty || x.quantity || 1) || 1)))}`).sort().join('|');
    const raw = [identity.uid, intent, itemKey, shippingMethod, normalizeFingerprintPart(body.customerPhone), normalizeFingerprintPart(body.customerEmail), normalizeFingerprintPart(body.customerAddress)].join('~');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40);
  }


  async function newestUserOrders(db, uid, limitN=100) {
    try { return await db.collection('pcShopOrders').where('uid','==',uid).orderBy('createdAtMs','desc').limit(limitN).get(); }
    catch (_) { return await db.collection('pcShopOrders').where('uid','==',uid).limit(limitN).get(); }
  }
  async function findRecentDuplicate(db, uid, fingerprint) {
    try {
      const snap = await newestUserOrders(db, uid, 40);
      const cutoff = Date.now() - duplicateWindowMs;
      let found = null;
      snap.forEach(d => {
        const row = d.data() || {};
        if (found || row.clientFingerprint !== fingerprint || Number(row.createdAtMs || 0) < cutoff) return;
        if (['cancelled', 'refunded'].includes(String(row.status || '').toLowerCase())) return;
        found = row;
      });
      return found;
    } catch (_) { return null; }
  }

  async function parseBody(req) {
    try {
      const raw = await readBody(req);
      if (!raw) return {};
      if (Buffer.isBuffer(raw)) return JSON.parse(raw.toString('utf8'));
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) { return null; }
  }

  const json = (res, status, body) => send(res, status, JSON.stringify(body), 'application/json', { 'Cache-Control': 'no-store' });
  const healthPayload = async () => {
    const total = catalog().length;
    const catalogStatus = liveCache.fetchedAtMs ? { ...liveCache.stats, cachedAtMs: liveCache.fetchedAtMs } : { live: 0, snapshot: total, total, cachedAtMs: 0 };
    return { ok: true, release: RELEASE, version: RELEASE, apiVersion: API_VERSION, capabilities: CAPABILITIES, runtime: 'deploy-server.js', firestore: !!getDb(), catalog: catalogStatus, builds: buildLiveCache.fetchedAtMs ? { ...buildLiveCache.stats, cachedAtMs:buildLiveCache.fetchedAtMs } : { live:0,total:retailerBuildCandidates().length,hidden:retailerBuildCandidates().length,cachedAtMs:0 } };
  };

  async function repairPrematureInvoices(db) {
    const snap = await db.collection('pcShopOrders').orderBy('createdAtMs','desc').limit(250).get();
    let scanned = 0, repaired = 0, logsRemoved = 0, skippedPaid = 0;
    const tasks = [];
    snap.forEach(d => {
      scanned += 1;
      const row = d.data() || {};
      if (String(row.intent || 'checkout') !== 'checkout') return;
      const ready = row.priceConfirmed === true && row.shippingConfirmationRequired !== true;
      const paid = String(row.paymentStatus || '').toLowerCase() === 'paid';
      if (ready) return;
      if (paid) { skippedPaid += 1; return; }
      const hasPrematureInvoice = !!String(row.invoiceNo || '').trim() || /^AZI-/i.test(String(row.documentNo || ''));
      tasks.push((async () => {
        if (hasPrematureInvoice || String(row.paymentStatus || '') !== 'not-ready') {
          const status = row.priceConfirmed === true ? 'shipping-confirmation' : 'price-confirmation';
          await d.ref.set({ invoiceNo: '', documentNo: row.quoteNo || row.orderId || d.id, paymentStatus: 'not-ready', status, updatedAtMs: Date.now() }, { merge: true });
          repaired += 1;
        }
        try { await db.collection('purchaseLogs').doc(`pcshop-${text(row.orderId || d.id, 120)}`).delete(); logsRemoved += 1; } catch (_) {}
      })());
    });
    await Promise.all(tasks);
    return { scanned, repaired, logsRemoved, skippedPaid };
  }

  async function handle(req, res, parsed) {
    const pathname = parsed?.pathname || '/';
    const method = String(req.method || 'GET').toUpperCase();
    if (!pathname.startsWith('/api/pc-shop/') && !pathname.startsWith('/api/admin/pc-shop/')) return false;

    if (pathname === '/api/pc-shop/health' && method === 'GET') return json(res, 200, await healthPayload());

    if (pathname === '/api/pc-shop/catalog' && method === 'GET') {
      try {
        const c = await getLiveCatalog(false);
        return json(res, 200, { ok: true, release: RELEASE, version: RELEASE, apiVersion: API_VERSION, capabilities: CAPABILITIES, currency: 'MYR', cached: Date.now() - c.fetchedAtMs < cacheMs, fetchedAt: new Date(c.fetchedAtMs).toISOString(), cacheSeconds: Math.round(cacheMs / 1000), stats: c.stats, products: c.publicProducts });
      } catch (err) { return json(res, 502, { ok: false, error: 'catalog_sync_failed', message: text(err?.message || err, 180) }); }
    }


    if (pathname === '/api/pc-shop/builds' && method === 'GET') {
      try {
        const c = await getLiveBuildCatalog(false);
        return json(res, 200, { ok:true, release:RELEASE, apiVersion:API_VERSION, currency:'MYR', fetchedAt:new Date(c.fetchedAtMs).toISOString(), stats:c.stats, builds:c.publicBuilds });
      } catch (err) { return json(res, 502, { ok:false, error:'build_catalog_sync_failed', message:text(err?.message||err,180), builds:[] }); }
    }

    const imageMatch = pathname.match(/^\/api\/pc-shop\/(image|build-image)\/([^/]+)$/);
    if (imageMatch && method === 'GET') {
      try {
        const id=text(decodeURIComponent(imageMatch[2]||''),160);
        let source='';
        if(imageMatch[1]==='image'){ const c=await getLiveCatalog(false); source=String(c.internalProducts.find(x=>String(x.id)===id)?.sourceImage||catalog().find(x=>String(x.id)===id)?.image||''); }
        else { const c=await getLiveBuildCatalog(false); source=String(c.internalBuilds.find(x=>String(x.id)===id)?.sourceImage||''); }
        if(!source) return json(res,404,{ok:false,error:'image_not_found'});
        const img=await cachedImage(source);
        return send(res,200,img.body,img.type,{'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff'});
      } catch(err){ return json(res,502,{ok:false,error:'image_proxy_failed',message:text(err?.message||err,160)}); }
    }

    if (pathname === '/api/admin/pc-shop/catalog' && method === 'GET') {
      const admin = await getAdminIdentity(req, parsed);
      if (!admin?.isAdmin) return json(res, 403, { ok: false, error: 'admin_required' });
      try {
        const c = await getLiveCatalog(String(parsed?.query?.refresh || '') === '1');
        return json(res, 200, { ok: true, release: RELEASE, version: RELEASE, apiVersion: API_VERSION, capabilities: CAPABILITIES, fetchedAt: new Date(c.fetchedAtMs).toISOString(), stats: c.stats, products: c.internalProducts });
      } catch (err) { return json(res, 502, { ok: false, error: 'catalog_sync_failed', message: text(err?.message || err, 180) }); }
    }


    if (pathname === '/api/admin/pc-shop/builds' && method === 'GET') {
      const admin = await getAdminIdentity(req, parsed);
      if (!admin?.isAdmin) return json(res,403,{ok:false,error:'admin_required'});
      try { const c=await getLiveBuildCatalog(String(parsed?.query?.refresh||'')==='1'); return json(res,200,{ok:true,release:RELEASE,apiVersion:API_VERSION,fetchedAt:new Date(c.fetchedAtMs).toISOString(),stats:c.stats,builds:c.internalBuilds}); }
      catch(err){ return json(res,502,{ok:false,error:'build_catalog_sync_failed',message:text(err?.message||err,180)}); }
    }

    if (pathname === '/api/pc-shop/orders' && method === 'POST') {
      try {
        const identity = await getUserIdentity(req);
        if (!identity?.uid) return json(res, 401, { ok: false, error: 'login_required' });
        const db = getDb();
        if (!db) return json(res, 503, { ok: false, error: 'firestore_unavailable' });
        const body = await parseBody(req);
        if (body == null) return json(res, 400, { ok: false, error: 'invalid_json' });
        const intent = String(body.intent || 'checkout').toLowerCase() === 'quote' ? 'quote' : 'checkout';
        const requested = Array.isArray(body.items) ? body.items.slice(0, 24) : [];
        if (!requested.length) return json(res, 400, { ok: false, error: 'cart_empty' });

        const allowedShippingMethods = new Set(['Courier', 'Pickup at AZOBSS', 'Arrange with AZOBSS']);
        const shippingRaw = text(body.shippingMethod || 'Courier', 80);
        const shippingMethod = allowedShippingMethods.has(shippingRaw) ? shippingRaw : 'Courier';
        const customerAddress = text(body.customerAddress, 500).trim();
        if (shippingMethod === 'Courier' && !customerAddress) {
          return json(res, 400, { ok: false, error: 'courier_address_required', message: 'Sila masukkan alamat penghantaran untuk penghantaran melalui Courier.' });
        }

        const fingerprint = orderFingerprint(identity, intent, requested, shippingMethod, body);
        // v1484: always revalidate current live price/availability before duplicate reuse or checkout.
        const live = await getLiveCatalog(true), items = [];
        for (const raw of requested) {
          const item = resolveItem(raw, live.internalProducts);
          if (!item) {
            const productId=text(raw?.productId || raw?.id,160), known=catalog().some(x=>String(x.id)===productId);
            return json(res, known?409:400, { ok:false, error:known?'product_unavailable':'unknown_product', productId, message:known?'Produk ini tidak lagi tersedia atau harga/stok live tidak dapat disahkan. Ia telah dikeluarkan daripada checkout.':'Produk tidak dikenali.' });
          }
          items.push(item);
        }

        const duplicate = await findRecentDuplicate(db, identity.uid, fingerprint);
        if (duplicate) return json(res, 200, { ok: true, duplicate: true, release: RELEASE, apiVersion: API_VERSION, order: publicOrder(duplicate) });

        if (intent === 'checkout') {
          const unverified = items.find(x => x.requiresConfirmation || x.unitPrice <= 0);
          if (unverified) return json(res, 409, { ok: false, error: 'verified_price_required', productId: unverified.productId || '', message: 'Produk ini tidak mempunyai harga yang dapat disahkan sekarang dan tidak boleh dibeli sehingga harga live tersedia.' });
        }
        const referenceSubtotal = money(items.reduce((s, x) => s + x.unitPrice * x.qty, 0));
        const paymentMethod = 'Maybank';
        const priceConfirmationRequired = intent === 'quote';
        const shippingConfirmationRequired = intent === 'checkout' && shippingMethod === 'Courier';
        const priceConfirmed = !priceConfirmationRequired;
        const invoiceCanIssue = intent === 'checkout' && priceConfirmed && !shippingConfirmationRequired;
        const seq = await nextSequence(db), orderId = `AZO-${seq.year}-${seq.serial}`, quoteNo = intent === 'quote' ? `AZQ-${seq.year}-${seq.serial}` : '', invoiceNo = invoiceCanIssue ? `AZI-${seq.year}-${seq.serial}` : '', now = Date.now();
        const status = intent === 'quote' ? 'quote-requested' : (!priceConfirmed ? 'price-confirmation' : (shippingConfirmationRequired ? 'shipping-confirmation' : 'awaiting-payment'));
        const row = {
          orderId, documentNo: quoteNo || invoiceNo || orderId, quoteNo, invoiceNo, receiptNo: '', intent, status,
          paymentStatus: invoiceCanIssue ? 'pending' : 'not-ready', fulfillmentStatus: 'order-received',
          priceConfirmationRequired, shippingConfirmationRequired, priceConfirmed,
          referenceSubtotal, confirmedItemTotal: priceConfirmed ? referenceSubtotal : 0, confirmedTotal: priceConfirmed ? referenceSubtotal : 0,
          shippingCharge: 0, shippingCost: 0, currency: 'MYR', items, shippingMethod, paymentMethod,
          customerName: text(body.customerName || identity.username || identity.email, 140), customerPhone: text(body.customerPhone, 60),
          customerEmail: text(body.customerEmail || identity.authEmail || identity.email, 180).toLowerCase(), customerAddress,
          notes: text(body.notes, 800), uid: identity.uid, username: identity.username || '', authEmail: identity.authEmail || identity.email || '',
          clientFingerprint: fingerprint, createdAtMs: now, updatedAtMs: now, statusHistory: [{ status, atMs: now, by: 'customer' }]
        };
        await db.collection('pcShopOrders').doc(orderId).set(row);
        let warning = '';
        if (invoiceCanIssue) { try { await syncPurchaseLog(db, row); } catch (err) { warning = text(err?.message || err, 180); } }
        return json(res, 201, { ok: true, release: RELEASE, apiVersion: API_VERSION, order: publicOrder(row), warning: warning || undefined });
      } catch (err) { return json(res, 500, { ok: false, error: 'order_create_failed', message: text(err?.message || err, 200) }); }
    }

    if (pathname === '/api/pc-shop/orders' && method === 'GET') {
      try {
        const identity = await getUserIdentity(req);
        if (!identity?.uid) return json(res, 401, { ok: false, error: 'login_required' });
        const db = getDb();
        if (!db) return json(res, 503, { ok: false, error: 'firestore_unavailable' });
        const snap = await newestUserOrders(db, identity.uid, 100), rows = [];
        snap.forEach(d => rows.push(publicOrder(d.data() || {})));
        rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
        return json(res, 200, { ok: true, release: RELEASE, apiVersion: API_VERSION, orders: rows });
      } catch (err) { return json(res, 500, { ok: false, error: 'order_list_failed', message: text(err?.message || err, 200) }); }
    }

    if (pathname === '/api/admin/pc-shop/orders' && method === 'GET') {
      const admin = await getAdminIdentity(req, parsed);
      if (!admin?.isAdmin) return json(res, 403, { ok: false, error: 'admin_required' });
      try {
        const db = getDb();
        if (!db) return json(res, 503, { ok: false, error: 'firestore_unavailable' });
        const snap = await db.collection('pcShopOrders').orderBy('createdAtMs','desc').limit(250).get(), rows = [];
        snap.forEach(d => {
          const raw = d.data() || {}, pub = publicOrder(raw);
          rows.push({ ...pub,
            items: Array.isArray(raw.items) ? raw.items.map(x => ({ ...(pub.items.find(p => p.productId === x.productId) || {}), unitCost: money(x.unitCost), markupRate: Number(x.markupRate || 0), markupAmount: money(x.markupAmount), priceStatus: x.priceStatus || '', priceCheckedAt: x.priceCheckedAt || '', sourceName: x.sourceName || '', sourceUrl: x.sourceUrl || '', sourceCheckedAt: x.sourceCheckedAt || '' })) : pub.items,
            uid: raw.uid || '', customerPhone: raw.customerPhone || '', customerEmail: raw.customerEmail || '', customerAddress: raw.customerAddress || '', notes: raw.notes || '', adminNote: raw.adminNote || '', shippingCost: money(raw.shippingCost)
          });
        });
        rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
        return json(res, 200, { ok: true, release: RELEASE, apiVersion: API_VERSION, orders: rows });
      } catch (err) { return json(res, 500, { ok: false, error: 'admin_order_list_failed', message: text(err?.message || err, 200) }); }
    }

    if (pathname === '/api/admin/pc-shop/repair-premature-invoices' && method === 'POST') {
      const admin = await getAdminIdentity(req, parsed);
      if (!admin?.isAdmin) return json(res, 403, { ok: false, error: 'admin_required' });
      try {
        const db = getDb();
        if (!db) return json(res, 503, { ok: false, error: 'firestore_unavailable' });
        const result = await repairPrematureInvoices(db);
        return json(res, 200, { ok: true, release: RELEASE, apiVersion: API_VERSION, ...result });
      } catch (err) { return json(res, 500, { ok: false, error: 'repair_failed', message: text(err?.message || err, 200) }); }
    }

    const adminOrderMatch = pathname.match(/^\/api\/admin\/pc-shop\/orders\/([^/]+)$/);
    if (adminOrderMatch && method === 'PATCH') {
      const admin = await getAdminIdentity(req, parsed);
      if (!admin?.isAdmin) return json(res, 403, { ok: false, error: 'admin_required' });
      try {
        const db = getDb();
        if (!db) return json(res, 503, { ok: false, error: 'firestore_unavailable' });
        const orderId = text(decodeURIComponent(adminOrderMatch[1] || ''), 120), ref = db.collection('pcShopOrders').doc(orderId), snap = await ref.get();
        if (!snap.exists) return json(res, 404, { ok: false, error: 'order_not_found' });
        const row = snap.data() || {}, body = await parseBody(req);
        if (body == null) return json(res, 400, { ok: false, error: 'invalid_json' });

        const now = Date.now(), allowedPayment = new Set(['not-ready', 'pending', 'paid', 'refunded', 'cancelled']), allowedFulfil = new Set(['order-received', 'processing', 'packed', 'shipped', 'in-transit', 'delivered', 'completed', 'cancelled']);
        const intent = body.convertToOrder === true ? 'checkout' : String(row.intent || 'checkout');
        const fulfillmentStatus = allowedFulfil.has(String(body.fulfillmentStatus || '')) ? String(body.fulfillmentStatus) : String(row.fulfillmentStatus || 'order-received');
        const shippingCharge = body.shippingCharge !== undefined ? money(body.shippingCharge) : money(row.shippingCharge);
        const existingItemTotal = money(row.confirmedItemTotal || (money(row.confirmedTotal) > 0 ? Math.max(0, money(row.confirmedTotal) - money(row.shippingCharge)) : 0) || row.referenceSubtotal);
        let itemTotal = existingItemTotal;
        if (body.confirmedItemTotal !== undefined) itemTotal = money(body.confirmedItemTotal);
        else if (body.confirmedTotal !== undefined) itemTotal = money(Math.max(0, money(body.confirmedTotal) - shippingCharge));
        const priceConfirmed = body.priceConfirmed === true || row.priceConfirmed === true || (itemTotal > 0 && (body.confirmedItemTotal !== undefined || body.confirmedTotal !== undefined));
        const shippingConfirmationRequired = intent === 'checkout' && String(row.shippingMethod || '') === 'Courier' && shippingCharge <= 0;
        const canIssueInvoice = intent === 'checkout' && priceConfirmed && !shippingConfirmationRequired;
        let requestedPayment = allowedPayment.has(String(body.paymentStatus || '')) ? String(body.paymentStatus) : String(row.paymentStatus || 'not-ready');
        if (!canIssueInvoice && requestedPayment === 'paid') return json(res, 400, { ok: false, error: 'invoice_not_ready', message: 'Invoice belum boleh dikeluarkan. Sahkan harga dan caj Courier dahulu.' });
        if (!canIssueInvoice && !['cancelled', 'refunded'].includes(requestedPayment)) requestedPayment = 'not-ready';
        if (canIssueInvoice && requestedPayment === 'not-ready') requestedPayment = 'pending';

        const serial = String(orderId).split('-').pop() || String(Date.now()).slice(-6), year = String(orderId).split('-')[1] || new Date().getFullYear();
        const invoiceNo = canIssueInvoice ? (row.invoiceNo || `AZI-${year}-${serial}`) : '';
        const grandTotal = priceConfirmed ? money(itemTotal + shippingCharge) : 0;
        const receiptNo = requestedPayment === 'paid' && canIssueInvoice ? (row.receiptNo || `AZR-${year}-${serial}`) : (row.receiptNo || '');

        let status = String(row.status || '');
        if (requestedPayment === 'cancelled' || fulfillmentStatus === 'cancelled') status = 'cancelled';
        else if (requestedPayment === 'refunded') status = 'refunded';
        else if (['completed', 'delivered', 'in-transit', 'shipped', 'packed', 'processing'].includes(fulfillmentStatus) && requestedPayment === 'paid') status = fulfillmentStatus;
        else if (requestedPayment === 'paid') status = 'payment-received';
        else if (intent === 'quote' && !priceConfirmed) status = 'quote-requested';
        else if (!priceConfirmed) status = 'price-confirmation';
        else if (shippingConfirmationRequired) status = 'shipping-confirmation';
        else status = 'awaiting-payment';

        const history = Array.isArray(row.statusHistory) ? row.statusHistory.slice(-19) : [];
        if (status !== row.status) history.push({ status, atMs: now, by: 'admin' });
        const patch = {
          intent, invoiceNo, documentNo: invoiceNo || row.quoteNo || orderId, paymentStatus: requestedPayment, fulfillmentStatus, status,
          priceConfirmed, priceConfirmationRequired: !priceConfirmed, shippingConfirmationRequired,
          confirmedItemTotal: priceConfirmed ? itemTotal : 0, confirmedTotal: grandTotal, shippingCharge,
          shippingCost: body.shippingCost !== undefined ? money(body.shippingCost) : money(row.shippingCost), paymentMethod: 'Maybank',
          courier: text(body.courier || row.courier, 100), trackingNumber: text(body.trackingNumber || row.trackingNumber, 160), adminNote: text(body.adminNote || row.adminNote, 800),
          receiptNo, updatedAtMs: now, statusHistory: history
        };
        if (requestedPayment === 'paid' && !row.paidAtMs) patch.paidAtMs = now;
        await ref.set(patch, { merge: true });
        const latest = { ...row, ...patch };
        try { await syncPurchaseLog(db, latest); } catch (_) {}
        return json(res, 200, { ok: true, release: RELEASE, apiVersion: API_VERSION, order: publicOrder(latest) });
      } catch (err) { return json(res, 500, { ok: false, error: 'admin_order_update_failed', message: text(err?.message || err, 200) }); }
    }

    return false;
  }

  return { handle, getLiveCatalog, healthPayload, release: RELEASE, apiVersion: API_VERSION, capabilities: CAPABILITIES };
}

module.exports = { createPcShopRuntime, RELEASE, API_VERSION, CAPABILITIES };
