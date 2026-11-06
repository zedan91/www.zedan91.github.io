'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRetailerCatalogService } = require('./azobss-retailer-json-catalog');
const { createSourcePriceAudit } = require('./azobss-source-price-audit');
const { loadViewnetProducts } = require('./azobss-viewnet-catalog-v1526');
let sharp = null;
try { sharp = require('sharp'); } catch (_) { sharp = null; }

const RELEASE = '1529';
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
  imageProxy: true,
  clearPriceSnapshotFallback: true,
  singlePriceRetailerCatalog: true,
  pcBuildCart: true,
  snapshotCheckoutToPriceConfirmation: true,
  strictExactImageIdentity: true,
  fullImageNoCrop: true,
  retailerTextRedaction: true,
  canonicalRetailerJsonCatalog: true,
  exactProductUrlJson: true,
  retailerCatalogAdminRefresh: true,
  memorySafeImagePipeline: true,
  singleFlightCatalogRefresh: true,
  boundedRuntimeCaches: true,
  lastKnownImageFallback: true,
  localImageLock: true,
  liveImageMutation: false,
  publicRetailerHotlink: false,
  expandedCatalog1512: true,
  unifiedPcHardware1526: true,
  viewnetPricelistCart: true
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

  const catalogCandidates = [path.join(rootDir, 'PC-Build', 'pc-shop-products-v1487.json')];
  const buildFile = path.join(rootDir, 'PC-Build', 'pc-build-data.json');
  const retailerDir = path.join(rootDir, 'PC-Build', 'retailers');
  const cacheMs = Math.max(60_000, Number(process.env.PC_SHOP_PRICE_CACHE_MS || 600_000) || 600_000);
  const duplicateWindowMs = Math.max(60_000, Number(process.env.PC_SHOP_DUPLICATE_WINDOW_MS || 15 * 60_000) || 15 * 60_000);
  const retailerCatalogService = createRetailerCatalogService({ rootDir });
  // v1498: never force a retailer scrape immediately after a Render boot/restart by default.
  // The committed/bootstrap JSON is available immediately and Admin can still request an explicit refresh.
  const retailerBootRefreshEnabled=/^(1|true|yes)$/i.test(String(process.env.PC_RETAILER_BOOT_REFRESH||''));
  let retailerCatalogBootTimer=null;
  if(retailerBootRefreshEnabled){
    retailerCatalogBootTimer=setTimeout(() => retailerCatalogService.refresh({ force:true, storeIds:['dotatech','emarque','all-it','brightstar','ideal-tech'], persist:true }).catch(()=>{}), 30_000);
    if(typeof retailerCatalogBootTimer?.unref==='function')retailerCatalogBootTimer.unref();
  }

  let catalogCache = null;
  let buildLookupCache = null;
  let liveCache = { fetchedAtMs: 0, publicProducts: [], internalProducts: [], stats: { live: 0, snapshot: 0, total: 0 } };
  let buildLiveCache = { fetchedAtMs: 0, publicBuilds: [], internalBuilds: [], stats: { live: 0, total: 0, hidden: 0 } };
  let liveCatalogInflight=null;
  let buildCatalogInflight=null;
  const imageResolveCache = new Map();
  const sourceDocumentCache = new Map();
  const imageCacheMs = Math.max(60_000, Number(process.env.PC_SHOP_IMAGE_CACHE_MS || 24 * 60 * 60_000) || 24 * 60 * 60_000);
  const imageResolveCacheMs = Math.max(60_000, Number(process.env.PC_SHOP_IMAGE_RESOLVE_CACHE_MS || 6 * 60 * 60_000) || 6 * 60 * 60_000);
  const sourceDocumentCacheMs = Math.max(60_000, Number(process.env.PC_SHOP_SOURCE_DOC_CACHE_MS || 30 * 60_000) || 30 * 60_000);
  const liveConcurrency=Math.max(1,Math.min(6,Number(process.env.PC_SHOP_LIVE_CONCURRENCY||3)||3));
  const sourceDocumentCacheMaxEntries=Math.max(2,Math.min(30,Number(process.env.PC_SHOP_SOURCE_DOC_CACHE_MAX_ENTRIES||12)||12));
  const sourceDocumentCacheMaxTextBytes=Math.max(128*1024,Math.min(2*1024*1024,Number(process.env.PC_SHOP_SOURCE_DOC_CACHE_MAX_TEXT_BYTES||1024*1024)||1024*1024));
  const imageWorkConcurrency=Math.max(1,Math.min(4,Number(process.env.PC_SHOP_IMAGE_WORK_CONCURRENCY||2)||2));
  let imageWorkActive=0; const imageWorkQueue=[];
  const imageFetchInflight=new Map(); const imageCleanInflight=new Map();

  function createBoundedBufferCache(maxBytes,maxEntries){
    const map=new Map();let bytes=0;
    const remove=key=>{const row=map.get(key);if(!row)return;bytes=Math.max(0,bytes-(Number(row.bytes)||0));map.delete(key);};
    return {
      getFresh(key,ttl){const row=map.get(key);if(!row)return null;if(Date.now()-row.at>=ttl){remove(key);return null;}map.delete(key);map.set(key,row);return row;},
      set(key,row){const body=Buffer.isBuffer(row?.body)?row.body:Buffer.from(row?.body||'');const next={...row,body,bytes:body.length};remove(key);while(map.size>=maxEntries||bytes+next.bytes>maxBytes){const first=map.keys().next().value;if(first==null)break;remove(first);}if(next.bytes<=maxBytes){map.set(key,next);bytes+=next.bytes;}return next;},
      size(){return map.size;},bytes(){return bytes;}
    };
  }
  const imageCache=createBoundedBufferCache(Math.max(4*1024*1024,Number(process.env.PC_SHOP_IMAGE_CACHE_MAX_BYTES||16*1024*1024)||16*1024*1024),8);
  const cleanedImageCache=createBoundedBufferCache(Math.max(4*1024*1024,Number(process.env.PC_SHOP_CLEAN_IMAGE_CACHE_MAX_BYTES||12*1024*1024)||12*1024*1024),6);
  function pruneTimedMap(map,maxEntries,ttl){const now=Date.now();for(const [k,v] of map){if(!v||now-Number(v.at||0)>=ttl)map.delete(k);}while(map.size>maxEntries){const k=map.keys().next().value;if(k==null)break;map.delete(k);}}
  async function mapWithConcurrency(items,limit,fn){const arr=Array.from(items||[]),out=new Array(arr.length);let next=0;const workers=Array.from({length:Math.min(Math.max(1,limit),Math.max(1,arr.length))},async()=>{while(true){const i=next++;if(i>=arr.length)break;out[i]=await fn(arr[i],i);}});await Promise.all(workers);return out;}
  async function withImageWorkSlot(fn){if(imageWorkActive>=imageWorkConcurrency)await new Promise(resolve=>imageWorkQueue.push(resolve));imageWorkActive++;try{return await fn();}finally{imageWorkActive--;const next=imageWorkQueue.shift();if(next)next();}}
  if(sharp){try{sharp.cache({memory:16,files:8,items:32});sharp.concurrency(Math.max(1,Math.min(2,imageWorkConcurrency)));}catch(_){}}

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
    const imported=readJson(path.join(rootDir,'lib','data','pc-shop-catalog-v1512.json'),{products:[]});
    const extra=(Array.isArray(imported.products)?imported.products:[]).filter(p=>
      p.importedCatalog===true && /^\d+$/.test(String(p.variantId||'')) &&
      p.localImageVerified===true && (/^\/PC-Build\/images\/shop\/[a-f0-9]{24}\.webp$/.test(String(p.image||'')) || (p.photoUnavailable===true && p.requiresSupplierConfirmation===true && p.image==='/assets/images/pc-product-unavailable.svg')) &&
      fs.existsSync(path.join(rootDir,p.image.replace(/^\//,''))));
    catalogCache = [...new Map([...(Array.isArray(raw.products)?raw.products:[]),...extra,...loadViewnetProducts({rootDir,sellingPrice})].map(p=>[String(p.id),p])).values()];
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
    // A few imported barebone/workstation systems carry component categories.
    // Keep their previous system selling price without treating actual PC parts as systems.
    const legacySystem = /Mini Desktop PC.*Barebone$|Workstation PC$/i.test(String(product.productTitle || product.name || ''));
    if (!system && !legacySystem) {
      const extra = cost <= 50 ? 30 : cost <= 150 ? 50 : cost < 500 ? 70 : cost <= 700 ? 90 : cost * 0.15;
      const price = Math.ceil(Number((cost + extra).toFixed(8)) / 5) * 5;
      return { cost, rate: cost > 700 ? 0.15 : 0, markup: money(price - cost), price: money(price), minMarkup: 0 };
    }
    const rate = markupRate(cost);
    const minMarkup = system ? 250 : 150;
    const markup = Math.max(cost * rate, minMarkup);
    const price = Math.ceil((cost + markup) / 10) * 10;
    return { cost, rate, markup: money(price - cost), price: money(price), minMarkup };
  };
  const decodeEntities = v => String(v||'')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>');
  const sourceLines = html => decodeEntities(String(html || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article|dt|dd)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[Button:[^\]]*\]/gi, ' ')
    .replace(/\[Input(?::[^\]]*)?\]/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const htmlText = html => sourceLines(html).replace(/\s+/g, ' ').trim();
  const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const metaFromHtml = (html, sourceUrl='') => {
    const raw=String(html||'');
    const meta=(key)=>{
      const escKey=String(key).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const a=raw.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escKey}["'][^>]+content=["']([^"']+)["']`,'i'));
      const b=raw.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escKey}["']`,'i'));
      return decodeEntities((a&&a[1])||(b&&b[1])||'').trim();
    };
    let title=meta('og:title')||meta('twitter:title');
    if(!title){const m=raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);title=decodeEntities((m&&m[1])||'').replace(/\s+/g,' ').trim();}
    // Jina/reader fallback returns Markdown, not HTML. Recover title from its metadata/heading.
    if(!title){
      const m=raw.match(/(?:^|\n)\s*Title:\s*([^\n]+)/i)||raw.match(/(?:^|\n)\s*#\s+([^\n]+)/);
      title=decodeEntities((m&&m[1])||'').replace(/\s+/g,' ').trim();
    }
    let image=meta('og:image')||meta('twitter:image');
    const wanted=norm(title).split(' ').filter(t=>t.length>=4).slice(0,7);
    const rankImages=(images)=>images.filter(x=>/^https?:\/\//i.test(String(x.url||''))&&!/logo|icon|payment|noctua|badge|avatar|spinner|placeholder/i.test(`${x.alt} ${x.url}`)).sort((a,b)=>{
      const score=x=>wanted.reduce((n,t)=>n+(norm(x.alt).includes(t)?1:0),0);
      return score(b)-score(a);
    });
    if(!image){
      const jsonImage=raw.match(/[\"']image[\"']\s*:\s*[\"'](https?:\/\/[^\"']+)[\"']/i);
      if(jsonImage) image=jsonImage[1];
    }
    if(!image){
      const imgs=[];
      for(const m of raw.matchAll(/<img[^>]+>/gi)){
        const tag=m[0], alt=(tag.match(/\balt=[\"']([^\"']*)[\"']/i)||[])[1]||'';
        const url=(tag.match(/\b(?:src|data-src|data-lazy-src)=[\"'](https?:\/\/[^\"']+)[\"']/i)||[])[1]||'';
        if(url) imgs.push({alt,url});
      }
      image=rankImages(imgs)[0]?.url||'';
    }
    if(!image){
      const images=[...raw.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)].map(m=>({alt:String(m[1]||''),url:String(m[2]||'')}));
      image=rankImages(images)[0]?.url||'';
    }
    try{if(image) image=new URL(image,sourceUrl).toString();}catch{image='';}
    return {title,image,text:sourceLines(raw)};
  };

  const cleanSpecValue = value => String(value||'')
    .replace(/^[:\-–—|]+\s*/,'')
    .replace(/\b(?:UPGRADE|Customize|Copy Specs|View More|Selected Specs)\b/gi,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,180);
  const extractPcParts = (sourceText, variantTitle='') => {
    const lines=sourceLines(sourceText).split(/\n+/).map(x=>x.replace(/^\s*[-*•]+\s*/,'').trim()).filter(Boolean);
    const defs=[
      ['CPU',/^(?:PROCESSOR|CPU)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['GPU',/^(?:GRAPHICS\s*CARD|GRAPHIC\s*CARD|GPU)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['Motherboard',/^(?:MOTHERBOARD|MAINBOARD)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['RAM',/^(?:MEMORY|RAM)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['Storage',/^(?:STORAGE|SSD|SOLID\s*STATE\s*DRIVE)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['PSU',/^(?:POWER\s*SUPPLY|PSU)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['Cooler',/^(?:COOLER|CPU\s*COOLER|COOLING)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['Case',/^(?:CASE|CASING|CHASSIS)\b\s*[:\-–—|]?\s*(.*)$/i],
      ['OS',/^(?:OS|OPERATING\s*SYSTEM)\b\s*[:\-–—|]?\s*(.*)$/i]
    ];
    const noise=/^(?:Image|Sale|Summary|Accessories|None|Misc|Quantity|FAQs?|Product price|Total options|Order total|Reset|Customize)$/i;
    const parts=[], seen=new Set();
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      for(const [label,re] of defs){
        const m=line.match(re); if(!m||seen.has(label)) continue;
        let value=cleanSpecValue(m[1]||'');
        if(!value){
          for(let j=i+1;j<Math.min(lines.length,i+5);j++){
            if(noise.test(lines[j])||/^Image\b/i.test(lines[j])) continue;
            if(defs.some(([,r])=>r.test(lines[j]))) break;
            value=cleanSpecValue(lines[j]); if(value) break;
          }
        }
        if(value && value.length>=2){parts.push([label,value]);seen.add(label);}
      }
    }
    const variant=cleanSpecValue(variantTitle);
    if(variant && !/^default title$/i.test(variant)) parts.push(['Variant',variant]);
    return parts.slice(0,10);
  };
  const hasCorePcSpecs = parts => {
    const labels=new Set((Array.isArray(parts)?parts:[]).map(x=>String(x?.[0]||'').toLowerCase()));
    return labels.has('cpu') && labels.has('gpu') && (Array.isArray(parts)?parts.length:0)>=6;
  };
  const deriveLivePcMeta = parts => {
    const rows=Array.isArray(parts)?parts:[];
    const value=label=>String(rows.find(x=>String(x?.[0]||'').toLowerCase()===label)?.[1]||'');
    const cpu=value('cpu'), gpu=value('gpu'), mb=value('motherboard');
    const cpuBrand=/amd|ryzen/i.test(cpu)?'amd':/intel|core ultra|core i/i.test(cpu)?'intel':'';
    const gpuBrand=/nvidia|geforce|rtx|gtx/i.test(gpu)?'nvidia':/amd|radeon|\brx\b/i.test(gpu)?'amd':/intel|arc/i.test(gpu)?'intel':'';
    let gpuModel='';
    const gm=gpu.match(/\b(RTX\s*(?:PRO\s*)?\d{4}(?:\s*Ti)?|RX\s*\d{4}(?:\s*XT)?|GTX\s*\d{3,4}(?:\s*Ti)?|ARC\s*[AB]\d{3})\b/i);
    if(gm) gpuModel=gm[1].replace(/\s+/g,' ').toUpperCase().replace('RTX PRO','RTX PRO');
    else if(/integrated|radeon graphics|uhd graphics/i.test(gpu)) gpuModel='Integrated';
    const platform=/\b(?:A620|B650|B850|X670|X870)\b/i.test(mb)?'AM5':/\b(?:A520|B450|B550|X570)\b/i.test(mb)?'AM4':/\b(?:B860|Z890|H810)\b/i.test(mb)?'LGA1851':/\b(?:H610|B660|B760|Z690|Z790)\b/i.test(mb)?'LGA1700':'';
    return {cpuBrand,gpuBrand,gpuModel,platform};
  };
  const hardwareIdentityMatches = (product, productTitle='', sourceText='') => {
    const hay=norm(`${productTitle||''} ${sourceText||''}`);
    if(!hay) return false;
    const seeds=[]; for(const raw of [product.sourceMatch,product.name]){if(Array.isArray(raw))seeds.push(...raw);else if(raw)seeds.push(raw);}
    for(const seed of seeds){
      const toks=norm(seed).split(' ').filter(t=>t.length>=4 && !/^(reference|graphics|gaming|motherboard|desktop|chassis)$/.test(t));
      if(toks.length && toks.slice(0,Math.min(4,toks.length)).filter(t=>hay.includes(t)).length>=Math.min(2,toks.length)) return true;
    }
    return false;
  };
  const buildUrlIdentityMatches = (build, productTitle='', sourceText='') => {
    const hayCompact=norm(`${productTitle||''} ${sourceText||''}`).replace(/\s+/g,'');
    if(!hayCompact) return false;
    let slug=''; try{slug=new URL(String(build.sourceUrl||'')).pathname.split('/').filter(Boolean).pop()||'';}catch{}
    const compact=norm(slug).replace(/\s+/g,'');
    const modelTokens=[];
    for(const m of compact.matchAll(/(?:rtxpro|rtx|rx|arc|gtx)?\d{3,5}(?:ti|xt)?/g)){if(m[0]&&/\d/.test(m[0]))modelTokens.push(m[0]);}
    if(modelTokens.length) return modelTokens.some(t=>hayCompact.includes(t));
    if(/officepc/.test(compact)) return hayCompact.includes('office');
    if(/workstation/.test(compact)) return hayCompact.includes('workstation')||hayCompact.includes('rtxpro');
    // Exact product URL with no model token: require meaningful title overlap rather than trusting a generic page.
    const nameTokens=norm(build.name).split(' ').filter(t=>t.length>=5 && !/^(gaming|desktop|custom|build)$/.test(t));
    return nameTokens.some(t=>hayCompact.includes(t.replace(/\s+/g,'')));
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
    for(const n of names.filter(Boolean)){
      const esc=String(n).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      out=out.replace(new RegExp('^'+esc+'(?:\\s*[-–—:|]\\s*|\\s+)','i'),'').trim();
      out=out.replace(new RegExp('(?:\\s*[-–—:|]\\s*|\\s+)'+esc+'(?:\\s+PC)?$','i'),'').trim();
    }
    out=out.replace(/\s*[-–—|]\s*Ideal Tech PC$/i,'').trim();
    return out||String(value||'').trim();
  };
  // Legacy field name kept for compatibility, but v1495 NEVER crops product images.
  // Text/price/logo cleanup is performed server-side while preserving the full image canvas.
  const cleanImageCropProfile = (sourceName='', kind='build') => kind==='hardware' ? 'product-focus' : 'pc-focus';
  const retailerImageRedactionProfile = (sourceName='') => {
    const n=norm(sourceName);
    if(/all it|jayacom|ideal tech|idealtech|viewnet|tech hypermart|techhypermart/.test(n)) return 'edge-strong';
    if(/dotatech|emarque|illegear|brightstar/.test(n)) return 'edge-light';
    return 'none';
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

  const absoluteImageUrl = (value, baseUrl='') => {
    let raw=decodeEntities(String(value||'').trim()).replace(/^['"]|['"]$/g,'');
    if(!raw || /^data:/i.test(raw) || /^javascript:/i.test(raw)) return '';
    if(raw.startsWith('//')) raw='https:'+raw;
    try { return new URL(raw,baseUrl||undefined).toString(); } catch (_) { return ''; }
  };
  const imageProductTokens = product => {
    const seeds=[];
    for(const v of [product?.sourceMatch,product?.name,product?.gpuModel]){if(Array.isArray(v))seeds.push(...v);else if(v)seeds.push(v);}
    const generic=/^(graphics|gaming|desktop|custom|build|motherboard|chassis|package|computer|system|office|budget|balanced|basic|entry|pro|set|pc)$/;
    const toks=[];
    for(const seed of seeds){for(const t of norm(seed).split(' ')){if(t.length>=3&&!generic.test(t)&&!toks.includes(t))toks.push(t);}}
    return toks.slice(0,16);
  };
  const imageModelTokens = product => imageProductTokens(product).filter(t=>/\d/.test(t)&&t.length>=3);
  const imageExpectedModelKeys = product => {
    const raw=[];
    if(Array.isArray(product?.parts)) for(const row of product.parts){ if(Array.isArray(row)&&/^(cpu|gpu|processor|graphics)/i.test(String(row[0]||''))) raw.push(String(row[1]||'')); }
    raw.push(String(product?.gpuModel||''),String(product?.name||''));
    const textRaw=raw.join(' '), keys=[];
    const pats=[/\b(?:RTX|RX)\s*\d{4}(?:\s*(?:TI|XT|GRE))?\b/gi,/\bI[3579][\s-]*\d{4,5}[A-Z]{0,2}\b/gi,/\bCORE\s+ULTRA\s+[3579]\s+\d{3}[A-Z]{0,2}\b/gi,/\bRYZEN\s+[3579]\s+\d{4}[A-Z0-9]{0,3}\b/gi,/\bARC\s+[AB]\d{3}\b/gi];
    for(const re of pats){ for(const m of textRaw.matchAll(re)){ const k=norm(m[0]).replace(/ /g,''); if(k&&!keys.includes(k))keys.push(k); } }
    return keys.slice(0,8);
  };
  const imageCandidateModelKeys = candidate => {
    const textRaw=`${candidate?.alt||''} ${candidate?.context||''} ${candidate?.url||''}`, keys=[];
    const pats=[/\b(?:RTX|RX)\s*\d{4}(?:\s*(?:TI|XT|GRE))?\b/gi,/\bI[3579][\s-]*\d{4,5}[A-Z]{0,2}\b/gi,/\bCORE\s+ULTRA\s+[3579]\s+\d{3}[A-Z]{0,2}\b/gi,/\bRYZEN\s+[3579]\s+\d{4}[A-Z0-9]{0,3}\b/gi,/\bARC\s+[AB]\d{3}\b/gi];
    for(const re of pats){ for(const m of textRaw.matchAll(re)){ const k=norm(m[0]).replace(/ /g,''); if(k&&!keys.includes(k))keys.push(k); } }
    return keys.slice(0,12);
  };
  const imageCandidateIdentityOk = (candidate,product) => {
    const hay=norm(`${candidate?.alt||''} ${candidate?.context||''} ${candidate?.url||''}`);
    const full=norm(product?.name||'');
    const nameToks=imageProductTokens(product).filter(t=>!/^intel|amd|nvidia|geforce|radeon$/.test(t)).slice(0,8);
    const nameHits=nameToks.filter(t=>hay.includes(t)).length;
    const expected=imageExpectedModelKeys(product), got=imageCandidateModelKeys(candidate);
    const modelHits=expected.filter(k=>got.includes(k)||hay.replace(/ /g,'').includes(k)).length;
    if(expected.length){
      if(modelHits===0 && !(full&&hay.includes(full))) return false;
      if(got.length && modelHits===0) return false;
    }
    if(full&&hay.includes(full)) return true;
    if(expected.length && modelHits>0 && nameHits>=1) return true;
    return nameHits>=Math.min(3,Math.max(2,nameToks.length));
  };
  const imageCandidatesFromRaw = (raw, sourceUrl='') => {
    const source=String(raw||''), out=[];
    const add=(url,alt='',context='')=>{
      const abs=absoluteImageUrl(url,sourceUrl); if(!abs) return;
      if(/logo|icon|payment|badge|avatar|spinner|placeholder|favicon|loading|sprite/i.test(`${alt} ${abs}`)) return;
      if(/\.svg(?:[?#]|$)/i.test(abs)) return;
      out.push({url:abs,alt:decodeEntities(alt),context:decodeEntities(context)});
    };
    for(const m of source.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) add(m[2],m[1],source.slice(Math.max(0,m.index-450),Math.min(source.length,m.index+m[0].length+650)));
    for(const m of source.matchAll(/<img\b[^>]*>/gi)){
      const tag=m[0], alt=(tag.match(/\balt=["']([^"']*)["']/i)||[])[1]||'', title=(tag.match(/\btitle=["']([^"']*)["']/i)||[])[1]||'';
      const ctx=source.slice(Math.max(0,m.index-650),Math.min(source.length,m.index+tag.length+850));
      const attrs=['src','data-src','data-lazy-src','data-original','data-image','data-original-src'];
      for(const a of attrs){const mm=tag.match(new RegExp('\\b'+a+'=["\\\']([^"\\\']+)["\\\']','i'));if(mm)add(mm[1],`${alt} ${title}`,ctx);}
      for(const a of ['srcset','data-srcset']){const mm=tag.match(new RegExp('\\b'+a+'=["\\\']([^"\\\']+)["\\\']','i'));if(mm){for(const piece of mm[1].split(',')){const u=piece.trim().split(/\s+/)[0];if(u)add(u,`${alt} ${title}`,ctx);}}}
    }
    for(const m of source.matchAll(/<source\b[^>]*(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)){
      const ctx=source.slice(Math.max(0,m.index-500),Math.min(source.length,m.index+m[0].length+700));
      for(const piece of m[1].split(',')){const u=piece.trim().split(/\s+/)[0];if(u)add(u,'',ctx);}
    }
    for(const m of source.matchAll(/background-image\s*:\s*url\((['"]?)([^)'"\s]+)\1\)/gi)) add(m[2],'',source.slice(Math.max(0,m.index-450),Math.min(source.length,m.index+m[0].length+600)));
    for(const m of source.matchAll(/["'](?:featured_image|image|image_url|src)["']\s*:\s*["']([^"']+)["']/gi)) add(m[1],'',source.slice(Math.max(0,m.index-350),Math.min(source.length,m.index+m[0].length+450)));
    const seen=new Set();return out.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;});
  };
  const imageCandidateScore = (candidate, product) => {
    const tokens=imageProductTokens(product), models=imageModelTokens(product);
    const alt=norm(candidate.alt), ctx=norm(candidate.context), url=norm(candidate.url), hay=`${alt} ${ctx} ${url}`;
    let score=0;
    for(const t of tokens){if(alt.includes(t))score+=4;else if(url.includes(t))score+=3;else if(ctx.includes(t))score+=1;}
    for(const t of models){if(hay.includes(t))score+=5;}
    const whole=norm(product?.name||''); if(whole && (ctx.includes(whole)||alt.includes(whole)))score+=12;
    if(/product|products|catalog|collection|shop|cdn|media/i.test(candidate.url))score+=1;
    const direct=`${candidate.alt||''} ${candidate.url||''}`;
    if(/banner|hero|slider|blog|article|advert|promo|promotion|campaign|category|header|homepage|voucher|sale-event/i.test(direct))score-=32;
    if(/\brm\s?\d|price|discount|off\b|voucher/i.test(direct))score-=12;
    return score;
  };
  const imageNearProduct = (raw, product, sourceUrl='') => {
    const candidates=imageCandidatesFromRaw(raw,sourceUrl).map(x=>({...x,score:imageCandidateScore(x,product)})).filter(x=>imageCandidateIdentityOk(x,product)).sort((a,b)=>b.score-a.score);
    const tokens=imageProductTokens(product), models=imageExpectedModelKeys(product);
    const threshold=models.length?8:Math.max(6,Math.min(10,tokens.length+2));
    return candidates.length&&candidates[0].score>=threshold?candidates[0].url:'';
  };
  const cachedSourceDocument = async (url, asJson=false) => {
    const key=`${asJson?'json':'text'}:${String(url||'')}`; const hit=sourceDocumentCache.get(key);
    if(hit&&Date.now()-hit.at<sourceDocumentCacheMs)return hit.body;
    if(typeof pcBuildFetch!=='function')throw new Error('live_fetch_unavailable');
    const body=await pcBuildFetch(url,asJson);
    // v1498: cache only bounded/small source documents. Large catalog payloads are allowed to GC.
    let cacheable=false;
    if(typeof body==='string')cacheable=Buffer.byteLength(body,'utf8')<=sourceDocumentCacheMaxTextBytes;
    else if(asJson){const rows=Array.isArray(body?.products)?body.products:null;cacheable=!rows||rows.length<=40;}
    if(cacheable){pruneTimedMap(sourceDocumentCache,sourceDocumentCacheMaxEntries-1,sourceDocumentCacheMs);sourceDocumentCache.set(key,{at:Date.now(),body});}
    return body;
  };
  const productNameScore = (title, product) => {
    const hay=norm(title), tokens=imageProductTokens(product), models=imageModelTokens(product); let score=0;
    for(const t of tokens)if(hay.includes(t))score+=/\d/.test(t)?4:2;
    for(const t of models)if(hay.includes(t))score+=5;
    const whole=norm(product?.name||''); if(whole&&hay.includes(whole))score+=15;
    return score;
  };
  async function resolveShopifyCollectionImage(product){
    const sourceUrl=String(product?.sourceUrl||'').trim(); if(!/^https:\/\//i.test(sourceUrl)||!/\/collections\//i.test(sourceUrl))return '';
    let u;try{u=new URL(sourceUrl);}catch{return '';}
    const m=u.pathname.match(/\/collections\/([^/?#]+)/i);if(!m)return '';
    const api=`${u.origin}/collections/${m[1]}/products.json?limit=250`;
    try{
      const data=await cachedSourceDocument(api,true), products=Array.isArray(data?.products)?data.products:[];
      let best=null,bestScore=0;
      for(const row of products){const sc=productNameScore(row?.title||'',product);if(sc>bestScore){best=row;bestScore=sc;}}
      if(!best||bestScore<6)return '';
      const raw=best?.featured_image?.src||best?.featured_image||best?.image?.src||(Array.isArray(best?.images)?(best.images[0]?.src||best.images[0]):'')||'';
      const pseudo={url:String(raw||''),alt:String(best?.title||''),context:String(best?.title||'')};
      return imageCandidateIdentityOk(pseudo,product)?absoluteImageUrl(raw,sourceUrl):'';
    }catch(_){return '';}
  }
  async function resolveShopifySearchImage(product){
    const sourceUrl=String(product?.sourceUrl||'').trim();let u;try{u=new URL(sourceUrl);}catch{return '';}
    if(!/allithypermarket\.com\.my|emarque\.co|dotatech\.com\.my|brightstarcomp\.com/i.test(u.hostname))return '';
    const q=encodeURIComponent(cleanRetailTitle(product?.name||'',product?.storeName||product?.sourceName||''));
    const api=`${u.origin}/search/suggest.json?q=${q}&resources[type]=product&resources[limit]=10`;
    try{
      const data=await cachedSourceDocument(api,true);
      const products=data?.resources?.results?.products||data?.resources?.results?.product||[];
      let best=null,bestScore=0;
      for(const row of (Array.isArray(products)?products:[])){const sc=productNameScore(row?.title||row?.name||'',product);if(sc>bestScore){best=row;bestScore=sc;}}
      if(!best||bestScore<6)return '';
      const pseudo={url:String(best?.image||best?.featured_image?.url||best?.featured_image||''),alt:String(best?.title||best?.name||''),context:String(best?.title||best?.name||'')};
      if(!imageCandidateIdentityOk(pseudo,product))return '';
      return absoluteImageUrl(pseudo.url,sourceUrl);
    }catch(_){return '';}
  }
  async function resolveWooStoreImage(product){
    const sourceUrl=String(product?.sourceUrl||'').trim();let u;try{u=new URL(sourceUrl);}catch{return '';}
    if(!/idealtech\.com\.my/i.test(u.hostname))return '';
    const q=encodeURIComponent(cleanRetailTitle(product?.name||'',product?.storeName||product?.sourceName||''));
    const api=`${u.origin}/wp-json/wc/store/v1/products?search=${q}&per_page=20`;
    try{
      const products=await cachedSourceDocument(api,true);let best=null,bestScore=0;
      for(const row of (Array.isArray(products)?products:[])){const sc=productNameScore(row?.name||'',product);if(sc>bestScore){best=row;bestScore=sc;}}
      if(!best||bestScore<6)return '';
      const img=Array.isArray(best?.images)?String(best.images[0]?.src||''):'';
      const pseudo={url:img,alt:String(best?.name||''),context:String(best?.name||'')};
      return imageCandidateIdentityOk(pseudo,product)?absoluteImageUrl(img,sourceUrl):'';
    }catch(_){return '';}
  }
  const retailerImageSearchUrls = product => {
    const sourceUrl=String(product?.sourceUrl||'').trim();let u;try{u=new URL(sourceUrl);}catch{return [];}
    const q=encodeURIComponent(cleanRetailTitle(product?.name||'',product?.storeName||product?.sourceName||'').replace(/[\/|]+/g,' ').trim());
    const h=u.hostname.toLowerCase(), out=[];
    if(h.includes('idealtech'))out.push(`${u.origin}/?s=${q}&post_type=product`);
    else if(h.includes('nbplaza'))out.push(`${u.origin}/search?controller=search&s=${q}`);
    else if(h.includes('techhypermart'))out.push(`${u.origin}/index.php?route=product/search&search=${q}`);
    else if(h.includes('illegear'))out.push(`${u.origin}/shop?search=${q}`);
    else if(h.includes('dotatech')||h.includes('emarque')||h.includes('brightstar'))out.push(`${u.origin}/search?q=${q}`);
    return out;
  };
  const availabilityNearProduct = (html, product) => {
    const pageText = sourceLines(html), lower = pageText.toLowerCase();
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
      if (i < 0) {
        const toks=norm(raw).split(' ').filter(t=>t.length>=4).slice(0,4);
        if(toks.length){
          const first=lower.indexOf(toks[0]);
          if(first>=0){const probe=norm(pageText.slice(first,first+1200));if(toks.slice(1).filter(t=>probe.includes(t)).length>=Math.min(2,toks.length-1)) i=first;}
        }
      }
      if (i >= 0) break;
    }
    const probe = (i >= 0 ? pageText.slice(Math.max(0, i - 250), Math.min(pageText.length, i + 3200)) : pageText.slice(0, 4500));
    const p=probe.toLowerCase();
    const unavailable=[/out[\s-]*of[\s-]*stock/g,/sold out/g,/currently unavailable/g,/notify me when available/g,/notify me/g,/back in stock/g];
    const available=[/\bin stock\b/g,/stock adequate/g,/ready to ship/g,/\badd to cart\b/g,/available now/g];
    const firstIndex=(arr)=>{let best=Infinity;for(const re of arr){re.lastIndex=0;const m=re.exec(p);if(m&&m.index<best)best=m.index;}return best;};
    const bad=firstIndex(unavailable), good=firstIndex(available);
    if(bad!==Infinity && (good===Infinity || bad<good)) return 'unavailable';
    if(good!==Infinity) return 'available';
    return 'unknown';
  };


  async function readLiveSource(product, pageCache) {
    const sourceUrl = String(product.sourceUrl || '').trim();
    if (product.sourceProvider === 'viewnet-pdf') throw new Error('supplier_confirmation_required');
    if (!sourceUrl) throw new Error('source_url_missing');
    const provider = String(product.sourceProvider || product.provider || '').toLowerCase();
    const exactShopify = /\/products\//i.test(sourceUrl) && (provider === 'shopify' || /emarque\.co|dotatech\.com\.my|allithypermarket\.com\.my/i.test(sourceUrl));
    if (exactShopify && typeof pcBuildReadShopify === 'function') {
      const data = await pcBuildReadShopify({ sourceUrl, variantKeywords: Array.isArray(product.variantKeywords) ? product.variantKeywords : [] });
      const availability = data.available === true ? 'available' : (data.available === false ? 'unavailable' : 'unknown');
      return { price: data.price, availability, variant: data.variant || '', productTitle:data.productTitle||'', sourceImage:data.image||'', sourceText:data.sourceText||data.productTitle||'', verificationPath:'shopify-product-json' };
    }
    if (typeof pcBuildFetch !== 'function') throw new Error('live_fetch_unavailable');
    const fetchPage = async url => {
      let promise = pageCache.get(url);
      if (!promise) { promise = pcBuildFetch(url, false); pageCache.set(url, promise); }
      return await promise;
    };
    let html='', primaryError=null;
    try { html=await fetchPage(sourceUrl); } catch(err){ primaryError=err; }
    const listingUrl=String(product.sourceListUrl||product.listingUrl||'').trim();
    let listing='';
    if((!html || html.length<80) && listingUrl){
      try{listing=await fetchPage(listingUrl);}catch(_){}
    }
    if(!html && !listing) throw primaryError||new Error('source_fetch_failed');
    const primary=html||listing;
    const categoryLike = /\/collections\//i.test(sourceUrl) || /\/145-pc-components(?:[/?#]|$)/i.test(sourceUrl) || /\/24-acer-desktop(?:[/?#]|$)/i.test(sourceUrl) || /\/12-hp-desktop(?:[/?#]|$)/i.test(sourceUrl) || /\/29-msi-laptop(?:[/?#]|$)/i.test(sourceUrl);
    let price = 0;
    if (html && !categoryLike && typeof pcBuildPriceFromJsonLd === 'function') price = pcBuildPriceFromJsonLd(html) || 0;
    if (!price && html && !categoryLike && typeof pcBuildPriceFromHtml === 'function') price = pcBuildPriceFromHtml(html) || 0;
    if (!price && html) price = priceNearProduct(html, product);
    let availability = html ? availabilityNearProduct(html, product) : 'unknown';
    let meta = html ? metaFromHtml(html,sourceUrl) : {title:'',image:'',text:''};
    // v1486: exact listing/category page may be easier for retailer anti-bot systems than product page.
    // It is only used to recover price/stock for the SAME exact product name; spec/image identity still comes from the exact product page or curated exact SKU media.
    const preferListingMedia = listingUrl && String(product.origin||'')==='retailer';
    if((!price || availability==='unknown' || !meta.image || preferListingMedia) && listingUrl){
      try{
        if(!listing) listing=await fetchPage(listingUrl);
        const listProbe = meta.title ? { ...product, name:meta.title, sourceMatch:[meta.title, product.name].filter(Boolean) } : product;
        if(!price) price=priceNearProduct(listing,listProbe);
        if(availability==='unknown') availability=availabilityNearProduct(listing,listProbe);
        const img=imageNearProduct(listing,listProbe,listingUrl);
        if(img && (preferListingMedia || !meta.image)) meta={...meta,image:img};
      }catch(_){}
    }
    if (!price) throw new Error('live_price_not_found');
    return { price, availability, variant: '', productTitle:meta.title||'', sourceImage:meta.image||'', sourceText:meta.text||sourceLines(primary), verificationPath:html?'exact-page':'exact-listing' };
  }


  const verifiedSnapshotFresh = () => false; // v1484: public checkout never trusts stored snapshot prices.

  async function getLiveCatalog(force = false, selectedIds = null) {
    const now = Date.now();
    const liveCacheLimit = liveCache?.stats?.visible > 0 ? cacheMs : Math.min(cacheMs, 10_000);
    if (!force && liveCache.fetchedAtMs && now - liveCache.fetchedAtMs < liveCacheLimit) return liveCache;
    if(liveCatalogInflight){await liveCatalogInflight;if(!force)return liveCache;}
    const work=(async()=>{
    const base = catalog(), pageCache = new Map();
    const rows = await mapWithConcurrency(base,liveConcurrency,async product => {
      let sourcePrice = 0, priceStatus = 'unverified', liveError = '', availability = 'unknown', checkedAt = '', sourceImage='', sourceTitle='', sourceText='', verificationPath='';
      let liveIdentityOk = false;
      try {
        // Imported exact variants browse from the dated verified snapshot. Only
        // selected checkout items are re-fetched, never thousands of products.
        const selected=selectedIds?selectedIds.has(String(product.id)):product.importedCatalog!==true;
        if(force&&selected){
        const live = await readLiveSource(product, pageCache);
        if (live.price > 0) {
          sourcePrice = money(live.price);
          priceStatus = 'live';
          availability = String(live.availability || 'unknown');
          checkedAt = new Date().toISOString();
          sourceImage = String(live.sourceImage || product.image || '');
          sourceTitle = String(live.productTitle || '');
          sourceText = String(live.sourceText || '');
          verificationPath = String(live.verificationPath || '');
          liveIdentityOk = hardwareIdentityMatches(product, sourceTitle, sourceText || sourceTitle);
        }
        }
      } catch (err) { liveError = text(err?.message || err, 160); }

      const confirmedUnavailable = (priceStatus === 'live' && availability === 'unavailable' && liveIdentityOk) || /Selected Shopify variant is no longer available/.test(liveError);
      const liveSellable = priceStatus === 'live' && availability === 'available' && liveIdentityOk && sourcePrice > 0;
      const snapshotSourcePrice = product.sourceProvider === 'viewnet-pdf' ? money(product.snapshotPrice) : cleanSourcePrice(product.snapshotPrice);
      const snapshotFreshMs = Date.parse(String(product.snapshotCheckedAt || product.sourceCheckedAt || ''));
      const snapshotFresh = Number.isFinite(snapshotFreshMs) && (Date.now() - snapshotFreshMs) <= 14 * 24 * 60 * 60 * 1000;
      const snapshotEligible = !confirmedUnavailable && product.snapshotPriceClear === true && snapshotFresh && (snapshotSourcePrice > 0 || (product.sourceProvider === 'viewnet-pdf' && Number(product.snapshotSellingPrice)>0));

      let effectiveSourcePrice = 0;
      if (liveSellable) {
        effectiveSourcePrice = sourcePrice;
        priceStatus = 'live';
      } else if (snapshotEligible) {
        effectiveSourcePrice = snapshotSourcePrice;
        priceStatus = 'snapshot';
        checkedAt = String(product.snapshotCheckedAt || product.sourceCheckedAt || '');
        if (!sourceImage) sourceImage = String(product.image || '');
      } else {
        priceStatus = confirmedUnavailable ? 'unavailable' : 'unverified';
      }

      const identityForDisplay = liveSellable ? liveIdentityOk : (product.sourceVerified === true);
      const sell = product.sourceProvider === 'viewnet-pdf' ? {price:priceStatus==='snapshot'?money(product.snapshotSellingPrice):0,rate:0,markup:effectiveSourcePrice>0?money(Number(product.snapshotSellingPrice)-effectiveSourcePrice):0} : effectiveSourcePrice > 0 ? sellingPrice(effectiveSourcePrice, product) : { price:0, rate:0, markup:0 };
      const mediaOk = /^https:\/\//i.test(sourceImage) && (liveSellable ? liveIdentityOk : product.mediaVerified === true);
      const specOk = liveSellable ? (product.specVerified === true && liveIdentityOk) : product.specVerified === true;
      const displayable = !confirmedUnavailable && sell.price > 0 && specOk && identityForDisplay;
      const checkoutReady = liveSellable && displayable && product.requiresSupplierConfirmation!==true;

      const internal = {
        ...product,
        sourcePrice: effectiveSourcePrice,
        unitCost: effectiveSourcePrice,
        sourceImage, sourceTitle, sourceText, verificationPath,
        price: displayable ? sell.price : 0,
        markupRate: displayable ? sell.rate : 0,
        markupAmount: displayable ? sell.markup : 0,
        priceStatus,
        livePrice: checkoutReady,
        livePriceError: liveError,
        priceCheckedAt: checkedAt,
        availability: confirmedUnavailable ? 'unavailable' : (checkoutReady ? 'available' : 'unknown'),
        available: checkoutReady,
        displayable,
        requiresConfirmation: !checkoutReady,
        mediaVerified: mediaOk,
        specVerified: specOk,
        sourceIdentityVerified: identityForDisplay,
        snapshotFallbackUsed: priceStatus === 'snapshot'
      };
      const pub = {
        id: internal.id, type: internal.type, category: internal.category, name: internal.name, displayName:internal.displayName||'', photoUnavailable:internal.photoUnavailable===true, brand:internal.brand||'',
        price: internal.price, priceStatus: internal.priceStatus, priceCheckedAt: internal.priceCheckedAt,
        requiresConfirmation: internal.requiresConfirmation,
        stock: internal.available ? 'in-stock' : (confirmedUnavailable ? 'out-of-stock' : 'check'),
        specs: Array.isArray(internal.specs) ? internal.specs : [],
        catalogGroup:internal.catalogGroup||'',sourceRecordId:internal.sourceRecordId||'',sourceOptionIndex:internal.sourceOptionIndex,optionLabel:internal.optionLabel||'',specSourceUrl:internal.specSourceUrl||'',imageKind:internal.imageKind||'',imageModel:internal.imageModel||'',
        image: internal.localImageVerified===true ? internal.image : '',
        localImageVerified: internal.localImageVerified===true,
        imageFallback: '', imageKey:String(internal.id||''), imagePolicy:'local-locked',
        imageType: internal.imageType || '', imageCrop: (internal.imageCrop && internal.imageCrop!=='product-focus') ? internal.imageCrop : cleanImageCropProfile(internal.sourceName||'', 'hardware'),
        available: internal.available === true,
        availability: internal.availability,
        sourceName: internal.sourceName || '', sourceUrl: internal.sourceUrl || '',
        mediaVerified: internal.mediaVerified === true, specVerified: internal.specVerified === true,
        snapshotFallbackUsed: internal.snapshotFallbackUsed === true
      };
      return { internal, pub };
    });
    const internalProducts = rows.map(x => x.internal);
    const publicHardware = rows.filter(x => ['hardware','laptop','desktop'].includes(String(x.internal.type || '').toLowerCase()));
    const publicProducts = publicHardware
      .filter(x => x.internal.displayable === true && money(x.internal.price) > 0 && String(x.internal.priceStatus) !== 'unavailable')
      .map(x => x.pub);
    const stats = {
      live: publicProducts.filter(x=>x.priceStatus==='live').length,
      snapshot: publicProducts.filter(x=>x.priceStatus==='snapshot').length,
      visible: publicProducts.length,
      total: publicHardware.length,
      hiddenUnverified: Math.max(0, publicHardware.length - publicProducts.length),
      internalTotal: internalProducts.length
    };
    liveCache = { fetchedAtMs: Date.now(), internalProducts, publicProducts, stats };
    return liveCache;
    })();
    liveCatalogInflight=work;
    try{return await work;}finally{if(liveCatalogInflight===work)liveCatalogInflight=null;}
  }

  function resolveItem(raw = {}, liveProducts = []) {
    const productId = text(raw.productId || raw.id, 160);
    const qty = Math.max(1, Math.min(20, Math.round(Number(raw.qty || raw.quantity || 1) || 1)));
    const product = liveProducts.find(x => String(x.id) === productId);
    if (!product || !['hardware','laptop','desktop'].includes(String(product.type || '').toLowerCase()) || money(product.price) <= 0 || String(product.priceStatus || '') === 'unavailable' || String(product.availability || '') === 'unavailable') return null;
    const liveReady = product.available === true && String(product.availability || '') === 'available' && String(product.priceStatus || '') === 'live' && product.requiresConfirmation !== true;
    const sourceCost = money(product.sourcePrice || product.unitCost);
    return { productId, name: text(product.name, 180), category: text(product.category || 'Hardware', 80), itemType: String(product.type||'hardware'), qty, unitPrice: money(product.price), unitCost: sourceCost, markupRate: Number(product.markupRate) || 0, markupAmount: money(product.markupAmount), priceMode: 'azobss-selling', priceStatus: liveReady ? 'live' : 'snapshot', priceCheckedAt: text(product.priceCheckedAt, 60), requiresConfirmation: !liveReady, sourceCheckedAt: text(product.sourceCheckedAt,60), sourceName: text(product.sourceName, 100), sourceUrl: text(product.sourceUrl, 500), image: product.localImageVerified===true?product.image:'', specs: Array.isArray(product.specs) ? product.specs.slice(0, 16).map(x => text(x, 180)) : [] };
  }

  function resolveBuildItem(raw = {}, liveBuilds = []) {
    const productId=text(raw.productId||raw.id,160);
    const qty=Math.max(1,Math.min(20,Math.round(Number(raw.qty||raw.quantity||1)||1)));
    const product=liveBuilds.find(x=>String(x.id)===productId);
    if(!product || money(product.price)<=0 || String(product.priceStatus||'')==='unavailable' || String(product.availability||'')==='unavailable')return null;
    const liveReady=String(product.priceStatus||'')==='live'&&product.available===true&&String(product.availability||'')==='available';
    const specs=Array.isArray(product.parts)?product.parts.slice(0,18).map(x=>Array.isArray(x)?`${text(x[0],60)}: ${text(x[1],160)}`:text(x,180)):[];
    return {productId,name:text(cleanRetailTitle(product.name,product.storeName||product.sourceName||''),180),category:'PC Build',itemType:'pc-build',qty,unitPrice:money(product.price),unitCost:money(product.sourcePrice||product.unitCost),markupRate:Number(product.markupRate)||0,markupAmount:money(product.markupAmount),priceMode:'azobss-selling',priceStatus:liveReady?'live':'snapshot',priceCheckedAt:text(product.priceCheckedAt||product.sourceCheckedAt,60),requiresConfirmation:!liveReady,sourceCheckedAt:text(product.sourceCheckedAt,60),sourceName:text(product.sourceName||product.storeName,100),sourceUrl:text(product.sourceUrl,500),image:'',specs};
  }



  const retailerBuildCandidates = () => {
    const out = [], seen=new Set();
    const base=readJson(buildFile,{builds:[]});
    // Exact live candidates are used to ENHANCE clear-price snapshots, not to gate the full catalog.
    for(const raw of (base.builds||[])){
      const sourceUrl=String(raw?.sourceUrl||'');
      if(!raw?.id || !/^https:\/\//i.test(sourceUrl) || !/\/(?:product|products)\//i.test(sourceUrl)) continue;
      const storeName=storeNameFromUrl(sourceUrl,raw.sourceName);
      const sourceListUrl=/idealtech\.com\.my/i.test(sourceUrl)?'https://idealtech.com.my/desktop-pcs/':String(raw.sourceListUrl||'');
      const row={...raw, sourceListUrl, origin:'retailer', retailerSnapshot:false, storeName, storeId:norm(storeName).replace(/ /g,'-'), sourceVerified:true, mediaVerified:false, specVerified:false, variantVerified:true, availabilityVerified:false};
      out.push(row); seen.add(String(row.id));
    }
    try {
      for (const file of fs.readdirSync(retailerDir)) {
        if (!file.endsWith('.json') || file === 'index.json') continue;
        const cat = readJson(path.join(retailerDir, file), { products: [] });
        for (const raw of (cat.products || [])) {
          if(!raw?.id || seen.has(String(raw.id))) continue;
          const sourceUrl=String(raw.sourceUrl||''), exactUrl=/\/(?:product|products)\//i.test(sourceUrl);
          if(!exactUrl || !Array.isArray(raw.parts) || raw.parts.length<2) continue;
          out.push({ ...raw, retailerSnapshot:true, storeId:raw.storeId||cat.storeId, storeName:raw.storeName||cat.storeName, sourceVerified:true }); seen.add(String(raw.id));
        }
      }
    } catch (_) {}
    return out;
  };

  const clearSnapshotBuilds = () => {
    const out=[];
    const maxAgeMs=14*24*60*60*1000;
    try{
      for(const file of fs.readdirSync(retailerDir)){
        if(!file.endsWith('.json')||file==='index.json')continue;
        const cat=readJson(path.join(retailerDir,file),{products:[]});
        for(const raw of (cat.products||[])){
          const sourcePrice=cleanSourcePrice(raw?.price);
          const mn=cleanSourcePrice(raw?.priceMin||raw?.price);
          const mx=cleanSourcePrice(raw?.priceMax||raw?.price);
          const checkedMs=Date.parse(String(raw?.sourceCheckedAt||cat?.checkedAt||''));
          const fresh=Number.isFinite(checkedMs)&&Date.now()-checkedMs<=maxAgeMs;
          const clearSingle=sourcePrice>0 && (!mn || !mx || Math.abs(mx-mn)<0.01);
          if(!raw?.id || raw?.quoteRequired===true || raw?.priceVerified!==true || !clearSingle || !fresh || !String(raw?.sourceUrl||''))continue;
          if(String(raw?.availability||'').toLowerCase()==='unavailable')continue;
          out.push({...raw,origin:'retailer',retailerSnapshot:true,storeId:raw.storeId||cat.storeId,storeName:raw.storeName||cat.storeName,sourceName:raw.sourceName||cat.storeName,sourcePrice,snapshotPriceClear:true});
        }
      }
    }catch(_){}
    return out;
  };

  const pcGpuKey = value => {
    const s=String(value||'').toUpperCase();
    const m=s.match(/\b(?:RTX(?:\s+PRO)?|RX)\s*\d{4}(?:\s*(?:TI|XT|GRE))?/);
    return m ? m[0].replace(/\s+/g,'') : '';
  };
  const nameWords = value => norm(value).split(' ').filter(x=>x.length>=4&&!/^(gaming|desktop|custom|build|prebuilt|package|radiance|workstation)$/.test(x));
  const matchSnapshotBuild = (liveRow,snapshots) => {
    const store=norm(liveRow?.storeName||liveRow?.sourceName||'').replace(/ /g,'');
    const gpu=pcGpuKey(`${liveRow?.gpuModel||''} ${liveRow?.name||''}`);
    const words=nameWords(liveRow?.name||'');
    let best=null,bestScore=0;
    for(const s of snapshots){
      const sstore=norm(s?.storeName||s?.sourceName||'').replace(/ /g,'');
      if(store&&sstore&&store!==sstore)continue;
      let score=0;
      const sgpu=pcGpuKey(`${s?.gpuModel||''} ${s?.name||''}`);
      if(gpu&&sgpu&&gpu===sgpu)score+=6;
      const sw=new Set(nameWords(s?.name||''));
      for(const w of words)if(sw.has(w))score+=2;
      if(norm(s?.name||'')===norm(liveRow?.name||''))score+=10;
      if(score>bestScore){best=s;bestScore=score;}
    }
    return bestScore>=4?best:null;
  };

  const snapshotBuildPublic = row => {
    const sell=sellingPrice(row.sourcePrice,{type:'pc-build',category:'PC Build'});
    const storeName=String(row.storeName||row.sourceName||'Kedai');
    const parts=Array.isArray(row.parts)?row.parts:[];
    return {
      id:String(row.id),origin:'retailer',retailerSnapshot:true,storeId:row.storeId||norm(storeName).replace(/ /g,'-'),storeName,
      tier:row.tier||'',name:cleanRetailTitle(row.name,storeName)||'PC Build',tagline:String(row.tagline||'').replace(/snapshot harga kedai/gi,'harga sumber'),
      category:row.category||'gaming',resolution:row.resolution||'',price:sell.price,priceStatus:'snapshot',priceCheckedAt:String(row.sourceCheckedAt||''),
      sourceCheckedAt:String(row.sourceCheckedAt||''),sourceName:storeName,sourceUrl:String(row.sourceUrl||''),badge:row.badge||'PC BUILD',
      accent:row.accent||'cyan',parts,bestFor:Array.isArray(row.bestFor)?row.bestFor:[],softwareFit:Array.isArray(row.softwareFit)?row.softwareFit:[],
      note:'Harga tunggal daripada sumber kedai dikekalkan. Live sync akan mengemas kini harga atau menyembunyikan produk jika disahkan tidak tersedia.',
      image:'',
      imageFallback:'',imageKey:String(row.id||''),imagePolicy:'local-locked',
      imageAlt:cleanRetailTitle(row.imageAlt||row.name,storeName),imageType:row.mediaVerified===true?'exact-source-product-image':'',
      imageCrop:cleanImageCropProfile(storeName,'build'),segment:row.segment||'package',cpuBrand:row.cpuBrand||'',platform:row.platform||'',gpuBrand:row.gpuBrand||'',
      gpuModel:row.gpuModel||'',resolutionTags:Array.isArray(row.resolutionTags)?row.resolutionTags:[],
      availability:String(row.availability||'unknown'),availabilityVerified:false,priceVerified:true,mediaVerified:row.mediaVerified===true,
      specVerified:parts.length>=2,variantVerified:true,sourceVerified:true,snapshotPriceClear:true
    };
  };

  async function getLiveBuildCatalog(force = false) {
    const now = Date.now();
    const buildCacheLimit = buildLiveCache?.stats?.total > 0 ? cacheMs : Math.min(cacheMs, 10_000);
    if (!force && buildLiveCache.fetchedAtMs && now - buildLiveCache.fetchedAtMs < buildCacheLimit) return buildLiveCache;
    if(buildCatalogInflight)return buildCatalogInflight;
    const work=(async()=>{

    const snapshots=clearSnapshotBuilds();
    const publicMap=new Map();
    const internalMap=new Map();
    for(const s of snapshots){
      const pub=snapshotBuildPublic(s);
      publicMap.set(String(pub.id),pub);
      const sell=sellingPrice(s.sourcePrice,{type:'pc-build',category:'PC Build'});
      internalMap.set(String(pub.id),{...s,price:sell.price,unitCost:s.sourcePrice,sourcePrice:s.sourcePrice,markupRate:sell.rate,markupAmount:sell.markup,priceStatus:'snapshot',available:false,availability:String(s.availability||'unknown'),priceCheckedAt:String(s.sourceCheckedAt||''),snapshotPriceClear:true});
    }

    const base = retailerBuildCandidates(), pageCache = new Map();
    const liveRows = await mapWithConcurrency(base,liveConcurrency,async build => {
      let sourcePrice = 0, availability = 'unknown', liveError = '', checkedAt = '', sourceImage='', productTitle='', sourceText='', variant='', verificationPath='';
      try {
        const live = await readLiveSource(build, pageCache);
        sourcePrice = money(live.price); availability = String(live.availability || 'unknown'); checkedAt = new Date().toISOString(); sourceImage=String(live.sourceImage||''); productTitle=String(live.productTitle||''); sourceText=String(live.sourceText||''); variant=String(live.variant||''); verificationPath=String(live.verificationPath||'');
      } catch (err) { liveError = text(err?.message || err, 160); }

      const liveParts=extractPcParts(sourceText,variant);
      const liveMeta=deriveLivePcMeta(liveParts);
      const identityOk=buildUrlIdentityMatches(build,productTitle,sourceText);
      const mediaOk=/^https:\/\//i.test(sourceImage) && identityOk;
      const specOk=hasCorePcSpecs(liveParts) && identityOk;
      const storeName=storeNameFromUrl(build.sourceUrl,build.storeName||build.sourceName||'');
      const cleanName=cleanRetailTitle(productTitle||build.name,storeName);
      const valid=availability==='available'&&sourcePrice>0&&specOk&&identityOk;
      const sell = valid ? sellingPrice(sourcePrice, { type:'pc-build', category:'PC Build' }) : { price:0, rate:0, markup:0 };
      const internal={...build,...liveMeta,parts:liveParts,name:cleanName,storeName,sourceName:storeName,sourceImage,productTitle,sourceText,variant,verificationPath,sourcePrice,unitCost:sourcePrice,price:sell.price,markupRate:sell.rate,markupAmount:sell.markup,availability,available:valid,priceStatus:sourcePrice>0?'live':'unverified',priceCheckedAt:checkedAt,livePriceError:liveError,mediaVerified:mediaOk,specVerified:specOk,availabilityVerified:availability!=='unknown',sourceVerified:identityOk,sourceIdentityVerified:identityOk,variantVerified:true};
      let pub=null;
      if(valid){
        const liveCpu=String(liveParts.find(x=>String(x?.[0]||'').toLowerCase()==='cpu')?.[1]||'');
        const liveGpu=String(liveParts.find(x=>String(x?.[0]||'').toLowerCase()==='gpu')?.[1]||'');
        const liveCategory=/workstation|creator/i.test(`${productTitle} ${cleanName}`)?'workstation':/office|business/i.test(`${productTitle} ${cleanName}`)?'office':'gaming';
        pub={id:internal.id,origin:'retailer',retailerSnapshot:false,storeId:internal.storeId||norm(storeName).replace(/ /g,'-'),storeName,tier:'',name:cleanName||'PC Build',tagline:[liveCpu,liveGpu].filter(Boolean).join(' • '),category:liveCategory,resolution:'',price:internal.price,priceStatus:'live',priceCheckedAt:internal.priceCheckedAt,sourceCheckedAt:internal.priceCheckedAt,sourceName:storeName,sourceUrl:internal.sourceUrl||'',badge:liveMeta.gpuModel||'PC BUILD',accent:internal.accent||'cyan',parts:liveParts,bestFor:[],softwareFit:[],note:'Harga, stok dan spesifikasi disemak live. Gambar dikunci kepada aset lokal AZOBSS.',image:'',imageFallback:'',imageKey:String(internal.id||''),imagePolicy:'local-locked',imageAlt:cleanName||'PC Build',imageType:'exact-source-product-image',imageCrop:cleanImageCropProfile(storeName,'build'),segment:'package',cpuBrand:liveMeta.cpuBrand||'',platform:liveMeta.platform||'',gpuBrand:liveMeta.gpuBrand||'',gpuModel:liveMeta.gpuModel||'',resolutionTags:[],availability:'available',availabilityVerified:true,priceVerified:true,mediaVerified:true,specVerified:true,variantVerified:true,sourceVerified:true,snapshotPriceClear:true};
      }
      return {build,internal,pub,identityOk,availability,cleanName,storeName};
    });

    for(const row of liveRows){
      const match=matchSnapshotBuild({...row.internal,name:row.cleanName,storeName:row.storeName},[...publicMap.values()]);
      if(row.identityOk && row.availability==='unavailable'){
        if(match){publicMap.delete(String(match.id));internalMap.delete(String(match.id));}
        continue;
      }
      if(!row.pub)continue;
      if(match){
        const replacement={...row.pub,id:String(match.id)};
        publicMap.set(String(match.id),replacement);
        internalMap.set(String(match.id),{...row.internal,id:String(match.id)});
      }else{
        const duplicate=[...publicMap.values()].some(x=>norm(x.storeName)===norm(row.pub.storeName)&&norm(x.name)===norm(row.pub.name));
        if(!duplicate){publicMap.set(String(row.pub.id),row.pub);internalMap.set(String(row.internal.id),row.internal);}
      }
    }

    const publicBuilds=[...publicMap.values()];
    const internalBuilds=[...internalMap.values()];
    const liveCount=publicBuilds.filter(x=>x.priceStatus==='live').length;
    const snapshotCount=publicBuilds.filter(x=>x.priceStatus==='snapshot').length;
    buildLiveCache={fetchedAtMs:Date.now(),publicBuilds,internalBuilds,stats:{live:liveCount,snapshot:snapshotCount,total:publicBuilds.length,hidden:Math.max(0,121-publicBuilds.length),removedUnclear:10}};
    return buildLiveCache;
    })();
    buildCatalogInflight=work;
    try{return await work;}finally{if(buildCatalogInflight===work)buildCatalogInflight=null;}
  }


  async function cachedImage(url) {
    const key=String(url||'');
    if(!key || !/^https:\/\//i.test(key)) throw new Error('image_url_invalid');
    const hit=imageCache.getFresh(key,imageCacheMs);
    if(hit)return hit;
    if(imageFetchInflight.has(key))return imageFetchInflight.get(key);
    if(typeof fetch!=='function')throw new Error('fetch_unavailable');
    const work=(async()=>{
      const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),12000);
      try{
        let referer='';
        try{const u=new URL(key);const h=u.hostname.toLowerCase();referer=h.includes('nbplaza')?'https://www.nbplaza.com.my/':h.includes('idealtech')?'https://idealtech.com.my/':h.includes('emarque')?'https://emarque.co/':`${u.protocol}//${u.hostname}/`;}catch(_){}
        const r=await fetch(key,{signal:ctrl.signal,redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36','Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',...(referer?{'Referer':referer}:{})}});
        if(!r.ok) throw new Error(`image_http_${r.status}`);
        const type=String(r.headers.get('content-type')||'image/jpeg').split(';')[0];
        if(!/^image\//i.test(type)) throw new Error('image_content_type_invalid');
        const ab=await r.arrayBuffer();
        if(ab.byteLength<512 || ab.byteLength>5*1024*1024) throw new Error('image_size_invalid');
        return imageCache.set(key,{at:Date.now(),type,body:Buffer.from(ab)});
      } finally { clearTimeout(timer); }
    })();
    imageFetchInflight.set(key,work);
    try{return await work;}finally{if(imageFetchInflight.get(key)===work)imageFetchInflight.delete(key);}
  }
  async function redactRetailerTextOnly(imageRow, sourceName='', kind='build') {
    const row=imageRow||{}; const body=Buffer.isBuffer(row.body)?row.body:Buffer.from(row.body||'');
    const profile=retailerImageRedactionProfile(sourceName);
    if(!body.length || profile==='none' || !sharp) return {body,type:row.type||'image/jpeg',profile:'none'};
    const cacheKey=crypto.createHash('sha1').update(body).digest('hex')+':'+profile+':'+kind;
    const hit=cleanedImageCache.getFresh(cacheKey,imageCacheMs); if(hit)return hit;
    if(imageCleanInflight.has(cacheKey))return imageCleanInflight.get(cacheKey);
    const work=(async()=>{try{
      const meta=await sharp(body,{failOn:'none'}).metadata();
      const width=Math.max(1,Number(meta.width)||0),height=Math.max(1,Number(meta.height)||0);
      if(width<160||height<120)return {body,type:row.type||'image/jpeg',profile:'none'};
      // Preserve the complete canvas. Only narrow edge zones where retailers commonly print
      // store names / original prices are heavily blurred. No resize, crop or content scaling.
      const topRatio=profile==='edge-strong'?0.085:0.06;
      const bottomRatio=profile==='edge-strong'?0.13:0.085;
      const topH=Math.max(1,Math.min(height,Math.round(height*topRatio)));
      const bottomH=Math.max(1,Math.min(height-topH,Math.round(height*bottomRatio)));
      const blurred=await sharp(body,{failOn:'none'}).blur(profile==='edge-strong'?22:16).toBuffer();
      const overlays=[];
      if(topH>0){
        const patch=await sharp(blurred,{failOn:'none'}).extract({left:0,top:0,width,height:topH}).toBuffer();
        overlays.push({input:patch,left:0,top:0});
      }
      if(bottomH>0){
        const top=Math.max(0,height-bottomH);
        const patch=await sharp(blurred,{failOn:'none'}).extract({left:0,top,width,height:bottomH}).toBuffer();
        overlays.push({input:patch,left:0,top});
      }
      const out=await sharp(body,{failOn:'none'}).composite(overlays).webp({quality:92,smartSubsample:true}).toBuffer();
      const clean={at:Date.now(),body:out,type:'image/webp',profile}; return cleanedImageCache.set(cacheKey,clean);
    }catch(_){return {body,type:row.type||'image/jpeg',profile:'none'};}})();
    imageCleanInflight.set(cacheKey,work);
    try{return await work;}finally{if(imageCleanInflight.get(cacheKey)===work)imageCleanInflight.delete(cacheKey);}
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
  async function resolvePublicImage(product, kind='hardware') {
    if (!product) return '';
    const cacheKey=`${kind}:${String(product.id||product.name||product.sourceUrl||'')}`;
    const cached=imageResolveCache.get(cacheKey);
    if(cached&&Date.now()-cached.at<imageResolveCacheMs)return cached.url||'';
    const save=url=>{const clean=absoluteImageUrl(url,String(product.sourceUrl||''));pruneTimedMap(imageResolveCache,199,imageResolveCacheMs);imageResolveCache.set(cacheKey,{at:Date.now(),url:clean});return clean;};
    const direct=String(product.sourceImage||product.image||'').trim();
    if (/^https:\/\//i.test(direct) && (product.mediaVerified===true || product.imageType)) return save(direct);
    const sourceUrl=String(product.sourceUrl||'').trim();
    if (!/^https:\/\//i.test(sourceUrl)) return save('');
    try {
      const provider=String(product.sourceProvider||product.provider||'').toLowerCase();
      const exactShopify=/\/products\//i.test(sourceUrl) && (provider==='shopify'||/allithypermarket\.com\.my|emarque\.co|dotatech\.com\.my|brightstarcomp\.com/i.test(sourceUrl));
      if(exactShopify && typeof pcBuildReadShopify==='function'){
        try{const d=await pcBuildReadShopify({sourceUrl,variantKeywords:Array.isArray(product.variantKeywords)?product.variantKeywords:[]});if(/^https:\/\//i.test(String(d?.image||'')))return save(String(d.image));}catch(_){}
      }
      if(kind==='build'){
        const shopifySearch=await resolveShopifySearchImage(product);
        if(shopifySearch)return save(shopifySearch);
        const wooImage=await resolveWooStoreImage(product);
        if(wooImage)return save(wooImage);
        const shopifyCollection=await resolveShopifyCollectionImage(product);
        if(shopifyCollection)return save(shopifyCollection);
      }
      try{
        const raw=await cachedSourceDocument(sourceUrl,false);
        const near=imageNearProduct(raw,product,sourceUrl);if(near)return save(near);
        const meta=metaFromHtml(raw,sourceUrl);
        if(kind!=='build'&&/^https:\/\//i.test(String(meta.image||'')))return save(meta.image);
      }catch(_){}
      for(const searchUrl of retailerImageSearchUrls(product)){
        try{const raw=await cachedSourceDocument(searchUrl,false);const near=imageNearProduct(raw,product,searchUrl);if(near)return save(near);}catch(_){}
      }
    } catch(_) {}
    return save('');
  }

  const publicCanonicalProduct = p => {
    const priceBase = Number(p?.price ?? p?.priceMin ?? 0) || 0;
    const priceMaxBase = Number(p?.priceMax ?? priceBase) || priceBase;
    const sellMin = priceBase > 0 ? sellingPrice(priceBase,{type:p.itemType==='pc-build'?'pc-build':'hardware',category:p.category||'',name:p.name||''}).price : 0;
    const sellMax = priceMaxBase > 0 ? sellingPrice(priceMaxBase,{type:p.itemType==='pc-build'?'pc-build':'hardware',category:p.category||'',name:p.name||''}).price : sellMin;
    const variants=(p.variants||[]).map(v=>({
      id:text(v.id,80),title:text(v.title,180),sku:text(v.sku,100),available:v.available===true,
      price:Number(v.price)>0?sellingPrice(Number(v.price),{type:p.itemType==='pc-build'?'pc-build':'hardware',category:p.category||'',name:p.name||''}).price:0,
      currency:'MYR',options:v.options||{}
    }));
    return {
      id:p.id,storeId:p.storeId,storeName:p.storeName,dataLevel:p.dataLevel,productUrl:p.productUrl,
      name:p.name,brand:p.brand,model:p.model,sku:p.sku,category:p.category,itemType:p.itemType,
      price:sellMin&&sellMin===sellMax?sellMin:null,priceMin:sellMin||null,priceMax:sellMax||null,
      priceType:p.priceType,currency:'MYR',availability:p.availability,stockText:p.stockText,
      imageUrl:'',imageUrls:[],imageVerified:false,imageKey:String(p.id||''),imagePolicy:'local-locked',
      specs:p.specs||{},attributes:p.attributes||{},variants,checkedAt:p.checkedAt
    };
  };

  const healthPayload = async () => {
    const total = catalog().length;
    const catalogStatus = liveCache.fetchedAtMs ? { ...liveCache.stats, cachedAtMs: liveCache.fetchedAtMs } : { live: 0, snapshot: total, total, cachedAtMs: 0 };
    return { ok: true, release: RELEASE, version: RELEASE, apiVersion: API_VERSION, capabilities: CAPABILITIES, runtime: 'deploy-server.js', sourcePriceAudit:sourcePriceAudit.status(), firestore: !!getDb(), retailerJsonCatalog: !!retailerCatalogService, catalog: catalogStatus, builds: buildLiveCache.fetchedAtMs ? { ...buildLiveCache.stats, cachedAtMs:buildLiveCache.fetchedAtMs } : { live:0,total:retailerBuildCandidates().length,hidden:retailerBuildCandidates().length,cachedAtMs:0 } };
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

  const sourcePriceAudit=createSourcePriceAudit({rootDir,getAdminIdentity,getHardware:()=>getLiveCatalog(false),getBuilds:()=>getLiveBuildCatalog(false),sellingPrice,send});

  async function handle(req, res, parsed) {
    const pathname = parsed?.pathname || '/';
    const method = String(req.method || 'GET').toUpperCase();
    if (!pathname.startsWith('/api/pc-shop/') && !pathname.startsWith('/api/admin/pc-shop/')) return false;
    if(await sourcePriceAudit.handle(req,res,parsed))return true;

    if (pathname === '/api/pc-shop/health' && method === 'GET') return json(res, 200, await healthPayload());

    if (pathname === '/api/pc-shop/retailer-catalog' && method === 'GET') {
      try {
        const c = await retailerCatalogService.get({ force: false });
        return json(res,200,{ok:true,release:RELEASE,schemaVersion:c.schemaVersion,generatedAt:c.generatedAt,currency:'MYR',stats:c.stats,sources:c.sources,products:(c.products||[]).map(publicCanonicalProduct)});
      } catch(err) { return json(res,502,{ok:false,error:'retailer_catalog_sync_failed',message:text(err?.message||err,180)}); }
    }

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

    const retailerImageMatch = pathname.match(/^\/api\/pc-shop\/retailer-image\/([^/]+)$/);
    if (retailerImageMatch && method === 'GET') {
      try {
        const id=text(decodeURIComponent(retailerImageMatch[1]||''),180);
        const c=retailerCatalogService.peek?.()||await retailerCatalogService.get({force:false});
        const product=(c?.products||[]).find(x=>String(x.id)===id);
        const source=String(product?.imageUrl||'');
        if(!source)return json(res,404,{ok:false,error:'retailer_image_not_found'});
        const cleaned=await withImageWorkSlot(async()=>{const img=await cachedImage(source);return redactRetailerTextOnly(img,String(product?.storeName||''),String(product?.itemType||'')==='pc-build'?'build':'hardware');});
        return send(res,200,cleaned.body,cleaned.type,{'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','X-AZOBSS-Image-Clean':cleaned.profile||'none','X-AZOBSS-Catalog':'v1498'});
      } catch(err){return json(res,502,{ok:false,error:'retailer_image_proxy_failed',message:text(err?.message||err,160)});}
    }

    const imageMatch = pathname.match(/^\/api\/pc-shop\/(image|build-image)\/([^/]+)$/);
    if (imageMatch && method === 'GET') {
      try {
        const id=text(decodeURIComponent(imageMatch[2]||''),160);
        let source='',sourceName='',product=null;
        if(imageMatch[1]==='image'){
          const internal=(liveCache.internalProducts||[]).find(x=>String(x.id)===id), base=catalog().find(x=>String(x.id)===id);
          product=internal||base; sourceName=String(product?.sourceName||product?.storeName||'');
        } else {
          const internal=(buildLiveCache.internalBuilds||[]).find(x=>String(x.id)===id), base=buildLookup().get(id);
          product=internal||base; sourceName=String(product?.sourceName||product?.storeName||'');
        }
        if(!product)return json(res,404,{ok:false,error:'image_product_not_found'});
        const cleaned=await withImageWorkSlot(async()=>{
          source=String(product?.sourceImage||'') || await resolvePublicImage(product,imageMatch[1]==='image'?'hardware':'build');
          if(!source)return null;
          const img=await cachedImage(source);
          return redactRetailerTextOnly(img,sourceName,imageMatch[1]==='image'?'hardware':'build');
        });
        if(!cleaned)return json(res,404,{ok:false,error:'image_not_found'});
        return send(res,200,cleaned.body,cleaned.type,{'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff','X-AZOBSS-Image-Clean':cleaned.profile||'none'});
      } catch(err){ return json(res,502,{ok:false,error:'image_proxy_failed',message:text(err?.message||err,160)}); }
    }

    if (pathname === '/api/admin/pc-shop/retailer-catalog' && method === 'GET') {
      const admin=await getAdminIdentity(req,parsed);
      if(!admin?.isAdmin)return json(res,403,{ok:false,error:'admin_required'});
      try{const c=await retailerCatalogService.get({force:String(parsed?.query?.refresh||'')==='1'});return json(res,200,{ok:true,release:RELEASE,...c});}
      catch(err){return json(res,502,{ok:false,error:'retailer_catalog_sync_failed',message:text(err?.message||err,180)});}
    }
    if (pathname === '/api/admin/pc-shop/retailer-catalog/refresh' && method === 'POST') {
      const admin=await getAdminIdentity(req,parsed);
      if(!admin?.isAdmin)return json(res,403,{ok:false,error:'admin_required'});
      try{const c=await retailerCatalogService.refresh({force:true,persist:true});return json(res,200,{ok:true,release:RELEASE,generatedAt:c.generatedAt,stats:c.stats,sources:c.sources});}
      catch(err){return json(res,502,{ok:false,error:'retailer_catalog_refresh_failed',message:text(err?.message||err,180)});}
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
        const selectedIds=new Set(requested.map(x=>String(x?.productId||x?.id||'')));
        const live = await getLiveCatalog(true,selectedIds);
        const needsBuilds=requested.some(x=>!catalog().some(p=>String(p.id)===String(x?.productId||x?.id||'')));
        const liveBuilds=needsBuilds?await getLiveBuildCatalog(true):{internalBuilds:[]}, items = [];
        for (const raw of requested) {
          const item = resolveItem(raw, live.internalProducts) || resolveBuildItem(raw, liveBuilds.internalBuilds);
          if (!item) {
            const productId=text(raw?.productId || raw?.id,160), known=catalog().some(x=>String(x.id)===productId)||buildLookup().has(productId);
            return json(res, known?409:400, { ok:false, error:known?'product_unavailable':'unknown_product', productId, message:known?'Produk ini tidak lagi tersedia atau harga/stok live tidak dapat disahkan. Ia telah dikeluarkan daripada checkout.':'Produk tidak dikenali.' });
          }
          items.push(item);
        }

        const duplicate = await findRecentDuplicate(db, identity.uid, fingerprint);
        if (duplicate) return json(res, 200, { ok: true, duplicate: true, release: RELEASE, apiVersion: API_VERSION, order: publicOrder(duplicate) });

        const referenceSubtotal = money(items.reduce((s, x) => s + x.unitPrice * x.qty, 0));
        const paymentMethod = 'Maybank';
        const priceConfirmationRequired = intent === 'quote' || items.some(x => x.requiresConfirmation === true || String(x.priceStatus || '') !== 'live');
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
