'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
let undiciFetch = null;
try { undiciFetch = require('undici').fetch; } catch (_) {}

const RELEASE = '1496';
const SCHEMA_VERSION = 'azobss-retailer-catalog-v1';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36 AZOBSSCatalog/1496';

const text = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const norm = v => text(v, 1000).toLowerCase().replace(/&amp;/g,'and').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const decode = v => String(v || '')
  .replace(/&nbsp;|&#160;/gi,' ')
  .replace(/&amp;/gi,'&')
  .replace(/&quot;|&#34;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,'<')
  .replace(/&gt;/gi,'>');
const stripHtml = v => decode(String(v || ''))
  .replace(/<script[\s\S]*?<\/script>/gi,' ')
  .replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<br\s*\/?>/gi,'\n')
  .replace(/<\/(?:p|div|li|tr|h[1-6]|dt|dd|section|article)>/gi,'\n')
  .replace(/<[^>]+>/g,' ')
  .replace(/[ \t]+/g,' ')
  .replace(/\n[ \t]+/g,'\n')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
const money = v => {
  if (v == null || v === '') return null;
  const s = String(v).replace(/,/g,'').replace(/[^0-9.]/g,'');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};
const unique = arr => [...new Set((arr || []).filter(Boolean))];
const isoNow = () => new Date().toISOString();
const safeUrl = (value, base = '') => {
  const raw=String(value||'').trim(); if(!raw)return '';
  try { return new URL(raw, base || undefined).toString(); } catch (_) { return ''; }
};
const slug = v => norm(v).replace(/\s+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
const idFor = (storeId, productUrl, name) => `${storeId}-${crypto.createHash('sha1').update(String(productUrl || name || '')).digest('hex').slice(0,12)}`;

function cleanStorePrefix(name, storeName) {
  let out = text(name, 250);
  const prefixes = unique([
    storeName,
    'AZOBSS','ALL IT Hypermarket','ALL IT','Ideal Tech','IDEALTECH','DOTATECH','EMARQUE','ILLEGEAR',
    'Viewnet','Jayacom','Tech Hypermart','Brightstar Computer','Brightstar','NB Plaza'
  ]).sort((a,b)=>b.length-a.length);
  for (const prefix of prefixes) {
    const p = String(prefix || '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    out = out.replace(new RegExp(`^\\s*${p}\\s*(?:[-–—:|]+\\s*)?`,'i'),'').trim();
  }
  return out || text(name,250);
}

function classifyItem(name = '', productType = '', categoryText = '') {
  const hay = norm(`${name} ${productType} ${categoryText}`);
  if (/\b(desktop|gaming pc|workstation|pre built|prebuilt|custom pc|pc package|office pc|gaming package|computer set|pc set)\b/.test(hay)) return 'pc-build';
  if (/\b(gpu|graphics card|motherboard|mainboard|ram|memory|ssd|nvme|power supply|psu|case|casing|chassis|cpu|processor|cooler|fan)\b/.test(hay)) return 'hardware';
  return 'unknown';
}

function inferCategory(name='', specs={}) {
  const hay=norm(`${name} ${Object.values(specs||{}).join(' ')}`);
  if (/workstation|rtx pro|quadro|threadripper|xeon/.test(hay)) return 'workstation';
  if (/office|business|productivity|aio|all in one/.test(hay)) return 'office';
  if (/gaming|rtx|radeon|rx \d|geforce/.test(hay)) return 'gaming';
  return 'general';
}

function extractSpecs(value) {
  const raw = stripHtml(value || '');
  const lines = raw.split(/\n+/).map(x=>x.replace(/^[-*•✓✔]+\s*/,'').trim()).filter(Boolean);
  const specs = {};
  const add=(key,val)=>{ val=text(val,220); if(val && !specs[key]) specs[key]=val; };
  const defs = [
    ['cpu', /^(?:processor|cpu)\s*[:\-–—|]?\s*(.+)$/i],
    ['gpu', /^(?:graphics(?:\s*card)?|graphic card|gpu|vga)\s*[:\-–—|]?\s*(.+)$/i],
    ['motherboard', /^(?:motherboard|mainboard|mobo)\s*[:\-–—|]?\s*(.+)$/i],
    ['ram', /^(?:memory|ram)\s*[:\-–—|]?\s*(.+)$/i],
    ['storage', /^(?:storage|ssd|nvme|solid state drive|hard drive|hdd)\s*[:\-–—|]?\s*(.+)$/i],
    ['psu', /^(?:power supply|psu)\s*[:\-–—|]?\s*(.+)$/i],
    ['case', /^(?:case|casing|chassis)\s*[:\-–—|]?\s*(.+)$/i],
    ['cooler', /^(?:cooler|cpu cooler|cooling)\s*[:\-–—|]?\s*(.+)$/i],
    ['os', /^(?:os|operating system|windows)\s*[:\-–—|]?\s*(.+)$/i],
    ['warranty', /^(?:warranty|waranti)\s*[:\-–—|]?\s*(.+)$/i]
  ];
  for (const line of lines) {
    for (const [k,re] of defs) {
      const m=line.match(re); if(m){add(k,m[1]);break;}
    }
  }
  // Product titles frequently carry useful structured facts even when descriptions are table-heavy.
  const hay=text(raw,5000);
  if(!specs.cpu){
    const m=hay.match(/\b((?:AMD\s+)?Ryzen\s+(?:3|5|7|9)\s+[A-Z0-9-]+|Intel\s+(?:Core\s+)?(?:Ultra\s+)?(?:i[3579]|[3579])[-\s]?[A-Z0-9-]+)\b/i); if(m)add('cpu',m[1]);
  }
  if(!specs.gpu){
    const m=hay.match(/\b((?:NVIDIA\s+)?(?:GeForce\s+)?RTX\s*(?:PRO\s*)?\d{4}(?:\s*Ti|\s*SUPER)?(?:\s*\d+GB)?|(?:AMD\s+)?Radeon\s+RX\s*\d{4}\s*(?:XT)?(?:\s*\d+GB)?|Intel\s+Arc(?:\s+Pro)?\s+[A-Z0-9-]+)\b/i); if(m)add('gpu',m[1]);
  }
  if(!specs.ram){const m=hay.match(/\b(\d{1,3}GB\s+(?:DDR[345]|RAM)(?:\s+\d{4,5}MHz)?)\b/i);if(m)add('ram',m[1]);}
  if(!specs.storage){const m=hay.match(/\b((?:\d+(?:\.\d+)?\s*(?:TB|GB))\s+(?:PCIe\s*)?(?:Gen\s*[345]\s*)?(?:NVMe|SSD|M\.2)[^,;|\n]*)/i);if(m)add('storage',m[1]);}
  return specs;
}

function normalizeVariants(variants, currency='MYR') {
  return (variants || []).map((v, idx) => {
    const price = money(v.price ?? v.prices?.price);
    const compare = money(v.compare_at_price ?? v.compareAtPrice ?? v.prices?.regular_price);
    const available = v.available === true || v.is_in_stock === true || v.in_stock === true;
    return {
      id: text(v.id ?? idx, 80),
      title: text(v.title || v.name || '', 180),
      sku: text(v.sku || '', 100),
      price,
      originalPrice: compare && price && compare > price ? compare : null,
      currency,
      available,
      options: Array.isArray(v.options) ? v.options.map(x=>text(x,100)) : (v.attributes || {})
    };
  });
}

function priceSummary(variants, fallbackPrice = null, fallbackOriginal = null) {
  const vals=(variants||[]).map(v=>money(v.price)).filter(v=>Number.isFinite(v));
  const min=vals.length?Math.min(...vals):money(fallbackPrice);
  const max=vals.length?Math.max(...vals):money(fallbackPrice);
  const originals=(variants||[]).map(v=>money(v.originalPrice)).filter(v=>Number.isFinite(v));
  const original=originals.length?Math.max(...originals):money(fallbackOriginal);
  const price = min != null && max != null && min === max ? min : (vals.length===1?vals[0]:null);
  return {price,originalPrice:original && price && original>price?original:null,priceMin:min,priceMax:max,priceType:min==null?'unknown':(max!==min?'variant':'single')};
}

function detectAvailability({variants=[], textValue='', explicit=null}={}) {
  if (explicit === true) return 'available';
  if (explicit === false) return 'unavailable';
  if (variants.length) {
    if (variants.some(v=>v.available===true)) return 'available';
    if (variants.every(v=>v.available===false)) return 'unavailable';
  }
  const s=norm(textValue);
  if (/out of stock|sold out|unavailable|habis stok|stok habis|discontinued/.test(s)) return 'unavailable';
  if (/in stock|ready to ship|stock adequate|available|add to cart|stok ada/.test(s)) return 'available';
  return 'unknown';
}

function canonicalProduct(base={}) {
  const storeName=text(base.storeName,100), rawName=text(base.rawName||base.name,240);
  const variants=normalizeVariants(base.variants||[],base.currency||'MYR');
  const ps=priceSummary(variants,base.price,base.originalPrice);
  const imageUrls=unique((base.imageUrls||[]).map(x=>safeUrl(x,base.productUrl||base.sourceCollectionUrl))).slice(0,16);
  const imageUrl=safeUrl(base.imageUrl||imageUrls[0]||'',base.productUrl||base.sourceCollectionUrl);
  const specs={...(base.specs||{})};
  const availability=base.availability || detectAvailability({variants,textValue:base.stockText,explicit:base.available});
  const itemType=base.itemType||classifyItem(rawName,base.productType,base.category);
  return {
    id:text(base.id||idFor(base.storeId||slug(storeName),base.productUrl,rawName),160),
    storeId:text(base.storeId||slug(storeName),80), storeName,
    sourceType:text(base.sourceType||'official',40), dataLevel:base.dataLevel||'exact',
    productUrl:safeUrl(base.productUrl), sourceCollectionUrl:safeUrl(base.sourceCollectionUrl),
    rawName, name:cleanStorePrefix(rawName,storeName), brand:text(base.brand,100), model:text(base.model,120), sku:text(base.sku,100),
    category:text(base.category||inferCategory(rawName,specs),80), itemType,
    price:ps.price, originalPrice:ps.originalPrice, priceMin:ps.priceMin, priceMax:ps.priceMax, priceType:base.priceType||ps.priceType, currency:base.currency||'MYR',
    availability, stockText:text(base.stockText,180),
    imageUrl, imageUrls, imageVerified:base.imageVerified===true || (!!imageUrl && base.dataLevel==='exact'),
    specs, attributes:base.attributes&&typeof base.attributes==='object'?base.attributes:{}, variants,
    checkedAt:base.checkedAt||isoNow()
  };
}

async function fetchWithTimeout(fetchImpl, url, opts={}) {
  const ctrl=new AbortController(); const timeout=setTimeout(()=>ctrl.abort(),opts.timeoutMs||15000);
  try {
    const r=await fetchImpl(url,{redirect:'follow',signal:ctrl.signal,headers:{'User-Agent':UA,'Accept':opts.accept||'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8','Accept-Language':'en-MY,en;q=0.9,ms;q=0.7',...(opts.headers||{})}});
    if(!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r;
  } finally { clearTimeout(timeout); }
}

async function fetchJson(fetchImpl,url,opts={}) { const r=await fetchWithTimeout(fetchImpl,url,{...opts,accept:'application/json,text/plain,*/*'}); return r.json(); }
async function fetchText(fetchImpl,url,opts={}) { const r=await fetchWithTimeout(fetchImpl,url,opts); return r.text(); }

function shopifyCollectionApi(collectionUrl,page=1) {
  const u=new URL(collectionUrl); u.pathname=u.pathname.replace(/\/$/,'')+'/products.json'; u.search=''; u.searchParams.set('limit','250'); u.searchParams.set('page',String(page)); return u.toString();
}

function shopifyProductToCanonical(source, collection, p) {
  const base=source.baseUrl.replace(/\/$/,'');
  const productUrl=`${base}/products/${encodeURIComponent(p.handle||'')}`;
  const variants=normalizeVariants(p.variants||[],'MYR');
  const images=(p.images||[]).map(x=>x.src||x.url).filter(Boolean);
  const specs=extractSpecs(p.body_html||p.body||'');
  const attrs={};
  for(const o of p.options||[]){if(o?.name)attrs[text(o.name,80)]=(o.values||[]).map(x=>text(x,100));}
  const vendor=text(p.vendor,100);
  const productType=text(p.product_type,100);
  return canonicalProduct({
    storeId:source.id,storeName:source.name,sourceType:'official',dataLevel:'exact',sourceCollectionUrl:collection.url,productUrl,
    rawName:p.title,brand:vendor,sku:(p.variants||[]).find(v=>v.sku)?.sku||'',category:productType,itemType:collection.type||classifyItem(p.title,productType,''),
    variants,imageUrl:images[0]||'',imageUrls:images,imageVerified:!!images[0],specs,attributes:attrs,
    availability:detectAvailability({variants,textValue:p.body_html||''}),stockText:variants.some(v=>v.available)?'Available variant(s)':'No available variants',checkedAt:isoNow()
  });
}

async function scrapeShopifySource(fetchImpl, source) {
  const products=[]; const errors=[];
  for(const collection of source.collections||[]){
    try{
      for(let page=1;page<=8;page++){
        const payload=await fetchJson(fetchImpl,shopifyCollectionApi(collection.url,page));
        const rows=Array.isArray(payload?.products)?payload.products:[];
        for(const p of rows) products.push(shopifyProductToCanonical(source,collection,p));
        if(rows.length<250) break;
      }
    }catch(err){errors.push(`${collection.url}: ${err.message}`);}
  }
  return {products:dedupeProducts(products),errors};
}

function wooMoney(prices) {
  if(!prices) return null;
  const minor=Number(prices.currency_minor_unit??2); const raw=Number(prices.price);
  if(Number.isFinite(raw)) return raw/Math.pow(10,minor);
  return money(prices.price);
}
function wooProductToCanonical(source,p){
  const imageUrls=(p.images||[]).map(x=>x.src).filter(Boolean);
  const specs=extractSpecs(`${p.short_description||''}\n${p.description||''}`);
  const attrs={};
  for(const a of p.attributes||[]){if(a?.name)attrs[text(a.name,80)]=(a.terms||[]).map(x=>text(x.name||x,100));}
  const price=wooMoney(p.prices); const regular=p.prices?(()=>{const minor=Number(p.prices.currency_minor_unit??2),r=Number(p.prices.regular_price);return Number.isFinite(r)?r/Math.pow(10,minor):null;})():null;
  return canonicalProduct({storeId:source.id,storeName:source.name,sourceType:'official',dataLevel:'exact',productUrl:p.permalink||`${source.baseUrl}/?p=${p.id}`,sourceCollectionUrl:(source.collections||[])[0]?.url||'',rawName:p.name,brand:(p.brands||[])[0]?.name||'',sku:p.sku||'',category:(p.categories||[])[0]?.name||'',itemType:classifyItem(p.name,(p.categories||[]).map(x=>x.name).join(' '),''),price,originalPrice:regular,imageUrl:imageUrls[0]||'',imageUrls,imageVerified:!!imageUrls[0],specs,attributes:attrs,availability:p.is_in_stock===true?'available':p.is_in_stock===false?'unavailable':'unknown',stockText:p.is_in_stock===true?'In stock':p.is_in_stock===false?'Out of stock':'',checkedAt:isoNow()});
}
async function scrapeWooSource(fetchImpl,source){
  const products=[],errors=[]; const api=source.storeApi;
  if(api){
    for(let page=1;page<=10;page++){
      try{
        const u=new URL(api);u.searchParams.set('per_page','100');u.searchParams.set('page',String(page));
        const rows=await fetchJson(fetchImpl,u.toString()); if(!Array.isArray(rows)||!rows.length)break;
        for(const p of rows)products.push(wooProductToCanonical(source,p));
        if(rows.length<100)break;
      }catch(err){errors.push(`${api}: ${err.message}`);break;}
    }
  }
  return {products:dedupeProducts(products),errors};
}

function jsonLdObjects(html){
  const out=[];
  for(const m of String(html||'').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{
      const obj=JSON.parse(m[1]);
      const walk=x=>{if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object'){if(x['@type']==='Product'||(Array.isArray(x['@type'])&&x['@type'].includes('Product')))out.push(x); if(x['@graph'])walk(x['@graph']); if(x.itemListElement)walk(x.itemListElement);}}; walk(obj);
    }catch(_){}
  }
  return out;
}
function jsonLdToCanonical(source,collection,obj,pageUrl){
  const offers=Array.isArray(obj.offers)?obj.offers:[obj.offers].filter(Boolean);
  const variants=offers.map((o,i)=>({id:o.sku||o.url||i,title:o.name||'',sku:o.sku||'',price:money(o.price||o.lowPrice),available:/instock/i.test(String(o.availability||'')),options:{}}));
  const imgs=Array.isArray(obj.image)?obj.image:[obj.image].filter(Boolean); const brand=typeof obj.brand==='string'?obj.brand:obj.brand?.name||'';
  const productUrl=safeUrl(obj.url||pageUrl,pageUrl); const specs=extractSpecs(obj.description||'');
  const availability=offers.some(o=>/instock/i.test(String(o.availability||'')))?'available':offers.length&&offers.every(o=>/outofstock|soldout/i.test(String(o.availability||'')))?'unavailable':'unknown';
  return canonicalProduct({storeId:source.id,storeName:source.name,sourceType:'official',dataLevel:'exact',sourceCollectionUrl:collection.url,productUrl,rawName:obj.name,brand,sku:obj.sku||obj.mpn||'',category:'',itemType:collection.type||classifyItem(obj.name,'',''),price:money(offers[0]?.price||offers[0]?.lowPrice),originalPrice:null,variants,imageUrl:imgs[0]||'',imageUrls:imgs,imageVerified:!!imgs[0],specs,availability,stockText:String(offers[0]?.availability||''),checkedAt:isoNow()});
}

function extractLinks(html, baseUrl, source) {
  const out=[];
  for(const m of String(html||'').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
    const href=safeUrl(decode(m[1]),baseUrl); if(!href)continue;
    try{if(new URL(href).hostname!==new URL(source.baseUrl).hostname)continue;}catch{continue;}
    const label=text(stripHtml(m[2]),200); const p=new URL(href).pathname.toLowerCase();
    const likely=/\/product\//.test(p)||/\/products\//.test(p)||/\/shop\/[^/]+/.test(p)||/product_id=\d+/.test(href)||/\/\d+-[^/]+\.html?$/.test(p);
    if(likely && label.length>=3) out.push({url:href,label});
  }
  return out;
}

async function scrapeHtmlProduct(fetchImpl,source,collection,link){
  const html=await fetchText(fetchImpl,link.url,{timeoutMs:15000});
  const ld=jsonLdObjects(html);
  if(ld.length){
    const exact=ld.map(x=>jsonLdToCanonical(source,collection,x,link.url)).filter(x=>x.name&&x.productUrl);
    if(exact.length)return exact;
  }
  const plain=stripHtml(html); const title=(()=>{const og=html.match(/<meta[^>]+(?:property|name)=["']og:title["'][^>]+content=["']([^"']+)/i);if(og)return decode(og[1]);const t=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);return t?stripHtml(t[1]):link.label;})();
  const image=(()=>{const m=html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)/i);return m?safeUrl(decode(m[1]),link.url):'';})();
  const prices=[...plain.matchAll(/(?:RM|MYR)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi)].map(m=>money(m[1])).filter(v=>v!=null&&v>=20&&v<=200000);
  const price=prices.length?Math.min(...prices):null;
  const specs=extractSpecs(plain); const availability=detectAvailability({textValue:plain});
  return [canonicalProduct({storeId:source.id,storeName:source.name,sourceType:'official',dataLevel:'exact',sourceCollectionUrl:collection.url,productUrl:link.url,rawName:title,category:'',itemType:collection.type||classifyItem(title,'',''),price,imageUrl:image,imageUrls:image?[image]:[],imageVerified:!!image,specs,availability,stockText:availability==='available'?'Available':availability==='unavailable'?'Out of stock':'',checkedAt:isoNow()})];
}

async function poolMap(items,limit,fn){
  const out=new Array(items.length);let next=0;
  const workers=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const i=next++;if(i>=items.length)break;try{out[i]=await fn(items[i],i);}catch(err){out[i]={__error:err};}}});
  await Promise.all(workers);return out;
}
async function scrapeHtmlSource(fetchImpl,source){
  const products=[],errors=[];
  for(const collection of source.collections||[]){
    try{
      const html=await fetchText(fetchImpl,collection.url,{timeoutMs:18000});
      const listingLd=jsonLdObjects(html);
      for(const obj of listingLd){
        const row=jsonLdToCanonical(source,collection,obj,collection.url); if(row.productUrl && row.productUrl!==collection.url)products.push(row);
      }
      const links=dedupeLinks(extractLinks(html,collection.url,source)).slice(0,160);
      const chunks=await poolMap(links,5,async link=>scrapeHtmlProduct(fetchImpl,source,collection,link));
      for(const chunk of chunks){if(chunk?.__error){errors.push(`${collection.url}: ${chunk.__error.message}`);continue;}for(const row of chunk||[])products.push(row);}
    }catch(err){errors.push(`${collection.url}: ${err.message}`);}
  }
  return {products:dedupeProducts(products),errors};
}
function dedupeLinks(rows){const m=new Map();for(const r of rows||[]){const k=(r.url||'').replace(/[?#].*$/,'');if(k&&!m.has(k))m.set(k,r);}return [...m.values()];}
function dedupeProducts(rows){
  const map=new Map();
  for(const row of rows||[]){
    if(!row||!row.name)continue;
    const exactUrl=row.dataLevel==='exact'&&row.productUrl&&row.productUrl!==row.sourceCollectionUrl;
    const key=exactUrl?`${row.storeId}|${String(row.productUrl).replace(/[?#].*$/,'')}`:`${row.storeId}|${norm(row.name)}`;
    const prev=map.get(key);
    const rowScore=scoreProduct(row), prevScore=prev?scoreProduct(prev):-1;
    const rowTs=Date.parse(row.checkedAt||0)||0, prevTs=prev?(Date.parse(prev.checkedAt||0)||0):0;
    if(!prev||rowScore>prevScore||(rowScore===prevScore&&rowTs>=prevTs))map.set(key,row);
  }
  return [...map.values()];
}

function scoreProduct(p){return (p.dataLevel==='exact'?10:0)+(p.imageUrl?3:0)+(p.priceMin!=null?2:0)+(p.availability!=='unknown'?2:0)+Object.keys(p.specs||{}).length;}

function readSnapshotFallback(rootDir){
  const retailerDir=path.join(rootDir,'PC-Build','retailers'); const products=[]; const sources=[];
  let files=[];try{files=fs.readdirSync(retailerDir).filter(x=>x.endsWith('.json')&&x!=='index.json');}catch(_){return {products,sources};}
  for(const file of files){
    try{
      const cat=JSON.parse(fs.readFileSync(path.join(retailerDir,file),'utf8')); const storeName=cat.storeName||file.replace(/\.json$/,''); const storeId=cat.storeId||slug(storeName);
      sources.push({id:storeId,name:storeName,status:'snapshot-fallback',error:'',productCount:(cat.products||[]).length});
      for(const r of cat.products||[]){
        const variants=[]; const specs={}; for(const pair of r.parts||[]){if(Array.isArray(pair)&&pair[0]&&pair[1])specs[slug(pair[0]).replace(/-/g,'_')]=text(pair[1],220);}
        products.push(canonicalProduct({id:r.id,storeId,storeName,sourceType:r.sourceType||'snapshot',dataLevel:'snapshot',productUrl:r.sourceUrl||'',sourceCollectionUrl:r.sourceUrl||'',rawName:r.name,category:r.category||'',itemType:'pc-build',price:r.priceMin===r.priceMax?r.price:null,priceType:r.priceType==='range'?'range':'single',imageUrl:'',imageUrls:[],imageVerified:false,specs,variants,availability:r.availability||'unknown',stockText:'Snapshot; live stock not confirmed',checkedAt:r.sourceCheckedAt||cat.checkedAt||''}));
      }
    }catch(_){}
  }
  return {products:dedupeProducts(products),sources};
}

function sourcePublicStatus(source,result){return {id:source.id,name:source.name,official:source.official!==false,platform:source.platform,status:result?.products?.length?'ok':(result?.errors?.length?'error':'empty'),productCount:result?.products?.length||0,errors:(result?.errors||[]).slice(0,8)};}

function createRetailerCatalogService(options={}){
  const rootDir=options.rootDir||process.cwd();
  const fetchImpl=options.fetchImpl||global.fetch||undiciFetch;
  if(typeof fetchImpl!=='function')throw new Error('fetch unavailable');
  const catalogDir=path.join(rootDir,'PC-Build','catalog','v1496');
  const sourceFile=path.join(catalogDir,'sources.json');
  const outputFile=options.outputFile||process.env.PC_RETAILER_CATALOG_FILE||path.join(os.tmpdir(),'azobss-retailer-catalog-v1496.json');
  const perStoreDir=options.perStoreDir||process.env.PC_RETAILER_CATALOG_STORE_DIR||path.join(os.tmpdir(),'azobss-retailer-catalog-v1496-stores');
  const config=JSON.parse(fs.readFileSync(sourceFile,'utf8'));
  const ttlMs=Math.max(60_000,Number(options.ttlMs||process.env.PC_RETAILER_CATALOG_TTL_MS||DEFAULT_TTL_MS));
  const loadDisk=()=>{try{return JSON.parse(fs.readFileSync(outputFile,'utf8'));}catch(_){return null;}};
  const loadBootstrap=()=>{
    const snapPath=path.join(catalogDir,'snapshot-fallback.json'), livePath=path.join(catalogDir,'live-seed-current.json'), webPath=path.join(catalogDir,'web-enriched-current.json');
    let snap=null,seed=null,web=null;
    try{snap=JSON.parse(fs.readFileSync(snapPath,'utf8'));}catch(_){}
    try{seed=JSON.parse(fs.readFileSync(livePath,'utf8'));}catch(_){}
    try{web=JSON.parse(fs.readFileSync(webPath,'utf8'));}catch(_){}
    const products=[];
    if(Array.isArray(snap?.products))products.push(...snap.products.map(canonicalProduct));
    if(Array.isArray(seed?.products))products.push(...seed.products.map(canonicalProduct));
    if(Array.isArray(web?.products))products.push(...web.products.map(canonicalProduct));
    const merged=dedupeProducts(products); const sourceMap=new Map(); for(const s of config.sources||[])sourceMap.set(s.id,{id:s.id,name:s.name,official:s.official!==false,platform:s.platform,status:'bootstrap',productCount:merged.filter(p=>p.storeId===s.id).length,errors:[]});
    if(!merged.length)return null;
    return {schemaVersion:SCHEMA_VERSION,release:RELEASE,generatedAt:web?.checkedAt||seed?.checkedAt||snap?.generatedAt||isoNow(),currency:'MYR',policy:config.policy||{},sources:[...sourceMap.values()],stats:{total:merged.length,exact:merged.filter(p=>p.dataLevel==='exact').length,listing:merged.filter(p=>p.dataLevel==='listing').length,snapshot:merged.filter(p=>p.dataLevel==='snapshot').length,withImage:merged.filter(p=>!!p.imageUrl).length,available:merged.filter(p=>p.availability==='available').length,unavailable:merged.filter(p=>p.availability==='unavailable').length,unknown:merged.filter(p=>p.availability==='unknown').length,pcBuilds:merged.filter(p=>p.itemType==='pc-build').length,hardware:merged.filter(p=>p.itemType==='hardware').length},products:merged};
  };
  let memory=loadDisk()||loadBootstrap();
  const writeCatalog=catalog=>{
    fs.mkdirSync(perStoreDir,{recursive:true}); fs.mkdirSync(path.dirname(outputFile),{recursive:true});
    fs.writeFileSync(outputFile,JSON.stringify(catalog,null,2));
    for(const s of catalog.sources||[]){const rows=(catalog.products||[]).filter(p=>p.storeId===s.id);fs.writeFileSync(path.join(perStoreDir,`${s.id}.json`),JSON.stringify({schemaVersion:SCHEMA_VERSION,release:RELEASE,generatedAt:catalog.generatedAt,source:s,products:rows},null,2));}
  };
  const refresh=async({force=false,storeIds=null,persist=true}={})=>{
    const now=Date.now();
    if(!force&&memory&&now-Date.parse(memory.generatedAt||0)<ttlMs)return memory;
    const disk=loadDisk(); if(!force&&!memory&&disk&&now-Date.parse(disk.generatedAt||0)<ttlMs){memory=disk;return disk;}
    const wanted=Array.isArray(storeIds)&&storeIds.length?new Set(storeIds):null;
    const allProducts=[],statuses=[];
    for(const source of config.sources||[]){
      if(wanted&&!wanted.has(source.id))continue;
      if(source.official===false||source.platform==='third-party-disabled'){statuses.push({id:source.id,name:source.name,official:false,platform:source.platform,status:'disabled',productCount:0,errors:[source.notes||'Non-official source disabled']});continue;}
      let result={products:[],errors:[]};
      try{
        if(source.platform==='shopify')result=await scrapeShopifySource(fetchImpl,source);
        else if(source.platform==='woocommerce')result=await scrapeWooSource(fetchImpl,source);
        else result=await scrapeHtmlSource(fetchImpl,source);
      }catch(err){result={products:[],errors:[err.message]};}
      allProducts.push(...result.products); statuses.push(sourcePublicStatus(source,result));
    }
    let products=dedupeProducts(allProducts);
    const fallback=readSnapshotFallback(rootDir);
    if(wanted){
      const base=memory||loadBootstrap()||{products:[],sources:[]}; const keep=(base.products||[]).filter(p=>!wanted.has(p.storeId)); products=dedupeProducts([...keep,...products]);
      const statusMap=new Map((base.sources||[]).map(x=>[x.id,x])); for(const st of statuses)statusMap.set(st.id,st); statuses.splice(0,statuses.length,...statusMap.values());
    }else if(!products.length){products=fallback.products;statuses.push(...fallback.sources.filter(s=>!statuses.some(x=>x.id===s.id)));}
    const catalog={schemaVersion:SCHEMA_VERSION,release:RELEASE,generatedAt:isoNow(),currency:'MYR',policy:config.policy||{},sources:statuses,stats:{total:products.length,exact:products.filter(p=>p.dataLevel==='exact').length,listing:products.filter(p=>p.dataLevel==='listing').length,snapshot:products.filter(p=>p.dataLevel==='snapshot').length,withImage:products.filter(p=>!!p.imageUrl).length,available:products.filter(p=>p.availability==='available').length,unavailable:products.filter(p=>p.availability==='unavailable').length,unknown:products.filter(p=>p.availability==='unknown').length,pcBuilds:products.filter(p=>p.itemType==='pc-build').length,hardware:products.filter(p=>p.itemType==='hardware').length},products};
    memory=catalog; if(persist&&!wanted){try{writeCatalog(catalog);}catch(_){} } return catalog;
  };
  const get=async({force=false}={})=>refresh({force});
  const getStore=async(storeId,{force=false}={})=>{const cat=await refresh({force});return {schemaVersion:cat.schemaVersion,release:cat.release,generatedAt:cat.generatedAt,source:(cat.sources||[]).find(s=>s.id===storeId)||null,products:(cat.products||[]).filter(p=>p.storeId===storeId)};};
  return {refresh,get,getStore,loadDisk,config,outputFile,perStoreDir};
}

module.exports={RELEASE,SCHEMA_VERSION,createRetailerCatalogService,canonicalProduct,extractSpecs,cleanStorePrefix,classifyItem};
