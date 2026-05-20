// AZOBSS Render Backend Server
// Supports: website hosting + affiliate online sync + JUPEM PA hold system

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");

const sharp = require("sharp");
const PDFDocument = require("pdfkit");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

const AFFILIATE_JSON = path.join(ROOT, "affiliate-products.json");
const TEMP_DIR = path.join(ROOT, "temp");
const DOWNLOAD_TOKENS = new Map();

// AUTO DELETE FILE > 30 DAYS
const FILE_EXPIRE_MS =
  30 * 24 * 60 * 60 * 1000;
  
function send(res, status, body, type = "text/plain; charset=utf-8") {

  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });

  res.end(body);
}

function readBody(req) {

  return new Promise((resolve, reject) => {

    let body = "";

    req.on("data", chunk => {

      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
      }

    });

    req.on("end", () => resolve(body));
    req.on("error", reject);

  });
}

function mimeType(filePath) {

  const ext = path.extname(filePath).toLowerCase();

  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".pdf": "application/pdf"
  };

  return types[ext] || "application/octet-stream";
}

function safePath(requestPath) {

  let cleanPath =
    decodeURIComponent(requestPath.split("?")[0]);

  if (cleanPath === "/") {
    cleanPath = "/index.html";
  }

  const resolved =
    path.normalize(path.join(ROOT, cleanPath));

  if (!resolved.startsWith(ROOT)) {
    return null;
  }

  return resolved;
}

function cleanPA(noPA) {

  let v = String(noPA || "")
    .trim()
    .toUpperCase();

  v = v.replace(/\.TIF$/i, "");
  v = v.replace(/[^A-Z0-9_-]/g, "");

  return v;
}

function cleanState(negeri) {

  let v = String(negeri || "")
    .trim()
    .toUpperCase();

  v = v.replace(/[^A-Z0-9 _-]/g, "");

  return v;
}



function cleanBenchmarkProduct(value) {
  const v = String(value || '').trim().toUpperCase();
  return v === 'SBM' ? 'SBM' : 'BM';
}

function cleanSearch(value) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 120);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeJupemUrl(rawUrl) {
  if (!rawUrl) return '';
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('/')) return 'https://ebiz.jupem.gov.my' + rawUrl;
  return 'https://ebiz.jupem.gov.my/' + rawUrl.replace(/^\/+/, '');
}

function parseBenchmarkRows(html, produkFallback, negeriFallback) {
  const rows = [];
  const tableRowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = tableRowPattern.exec(html))) {
    const rowHtml = rowMatch[1];
    const cellMatches = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (cellMatches.length < 5) continue;
    const cells = cellMatches.map(item => stripHtml(item[1]));
    const joined = cells.join(' ').toLowerCase();
    if (joined.includes('no. stesen') || joined.includes('tambah ke troli')) continue;

    const linkMatch = rowHtml.match(/href=["']([^"']*(?:Lokasi|Peta|Map|Koordinat|location)[^"']*)["']/i) || rowHtml.match(/href=["']([^"']*)["']/i);
    const stationNo = cells[1] || cells[0] || '';
    if (!stationNo || /^no\.?$/i.test(stationNo)) continue;

    rows.push({
      product: produkFallback,
      stationNo,
      negeri: cells[2] || negeriFallback,
      daerah: cells[3] || '',
      bandar: cells[4] || '',
      huraian: cells[5] || '',
      harga: cells[6] || '',
      locationUrl: linkMatch ? absolutizeJupemUrl(linkMatch[1]) : '',
      raw: cells
    });
  }
  return rows.slice(0, 60);
}

async function fetchJupem(jupemUrl) {
  return await fetch(jupemUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept": "image/tiff,image/*,*/*",
      "Referer": "https://ebiz.jupem.gov.my/"
    }
  });
}



function normalizeAffiliateUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) return 'https://' + value;
  return value;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
}

function pickTitleFromHtml(html) {
  return decodeHtmlEntities(
    pickMeta(html, 'og:title') ||
    pickMeta(html, 'twitter:title') ||
    ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
  ).replace(/\s*\|\s*Shopee.*$/i, '').replace(/\s*-\s*Shopee.*$/i, '').trim();
}

function shortenDescription(text, fallbackTitle) {
  const clean = decodeHtmlEntities(text || '').replace(/\s+/g, ' ').trim();
  if (clean && !/^Shopee/i.test(clean)) return clean.slice(0, 260);
  return `${fallbackTitle || 'Produk ini'} sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.`;
}


function titleRule(title) {
  const t = String(title || '').toLowerCase();
  const has = (re) => re.test(t);

  if (has(/tefal|supercook|cookware|frypan|frying pan|wok|stewpot|soup pot|casserole|saucepan|pan\b|\bpot\b|spatula|ladle|knife|chopper|cutlery|kitchen|dapur|periuk|kuali|penggoreng|senduk|pinggan|mangkuk|bekas makanan|food container|lunch box|tupperware|thermos|flask/)) {
    return { category:'home-living', badge:'Kitchen Essentials', icon:'🍳', meta:'Best for cooking and daily kitchen use' };
  }
  if (has(/air fryer|rice cooker|pressure cooker|multi cooker|slow cooker|induction cooker|microwave|oven|toaster|blender|mixer|food processor|meat grinder|grinder|kettle|water dispenser|coffee maker|juicer|appliance|mesin basuh|washing machine|refrigerator|fridge|freezer|iron|steam iron/)) {
    return { category:'home-appliances', badge:'Home Appliance', icon:'🔌', meta:'Best for easier daily home use' };
  }
  if (has(/vacuum|cordless vacuum|handheld vacuum|cleaner|mop|spin mop|robot vacuum|penyapu|habuk|dust|lint remover|washer|cleaning|pembersih|detergent|sabun lantai|trash bin|tong sampah/)) {
    return { category:'home-living', badge:'Cleaning Gadget', icon:'🧹', meta:'Best for home and car cleaning' };
  }
  if (has(/ssd|nvme|m\.2|hard disk|hdd|ram|ddr4|ddr5|gpu|rtx|gtx|radeon|processor|cpu|motherboard|pc case|power supply|psu|monitor|keyboard|mouse|gaming mouse|printer|scanner|webcam|usb hub|type-c hub|laptop stand|thermal paste|cooling fan|cooler|speaker|headset|earphone|microphone|mic|capture card/)) {
    return { category:'computer', badge: has(/ssd|nvme|m\.2|storage/) ? 'Fast Storage' : 'Computer & Accessories', icon:'💻', meta: has(/ssd|nvme|m\.2/) ? 'Best for Windows and game loading' : 'Best for PC setup and daily use' };
  }
  if (has(/router|wifi|wi-fi|mesh|modem|lan cable|ethernet|network|5g router|4g router|repeater|extender|switch hub/)) {
    return { category:'computer', badge:'Networking', icon:'5G', meta:'Best for stronger home internet setup' };
  }
  if (has(/iphone|android|smartphone|phone|telefon|phone case|casing|screen protector|tempered glass|charger|fast charger|powerbank|power bank|usb c|type c|lightning cable|cable|adapter|magsafe|holder phone|phone holder|tripod phone/)) {
    return { category:'mobile', badge:'Daily Tech', icon:'📱', meta:'Useful mobile gadget for daily use' };
  }
  if (has(/dashcam|dash cam|car camera|car vacuum|car charger|jump starter|tyre|tire|tayar|automotive|kereta|motor|motorcycle|car mat|carpet car|seat cover|car holder|windshield|wiper|engine oil|minyak hitam|polish|wax|coating/)) {
    return { category:'automotive', badge:'Car Essential', icon:'🚗', meta:'Best for daily car use' };
  }
  if (has(/camera|dslr|mirrorless|action cam|gopro|drone|dji|cctv|ip camera|webcam|lens|tripod|gimbal|stabilizer|ring light|lighting/)) {
    return { category:'camera', badge:'Camera Gear', icon:'CAM', meta:'Best for photo, video and content setup' };
  }
  if (has(/ps5|ps4|xbox|nintendo|switch|console|controller|gamepad|gaming chair|gaming desk|game\b|games\b/)) {
    return { category:'gaming', badge:'Gaming Gear', icon:'🎮', meta:'Best for gaming setup' };
  }
  if (has(/watch|smartwatch|smart watch|jam tangan|casio|seiko|g-shock|gshock/)) return { category:'watches', badge:'Watch Pick', icon:'⌚', meta:'Daily watch and style item' };
  if (has(/handbag|tote bag|women bag|beg wanita|purse|sling bag wanita|shoulder bag/)) return { category:'womens-bags', badge:'Bag Pick', icon:'👜', meta:'Useful bag for daily carry' };
  if (has(/wallet|dompet|men bag|beg lelaki|sling bag lelaki|crossbody bag|card holder/)) return { category:'mens-bags', badge:'Daily Carry', icon:'👝', meta:'Best for wallet and daily carry' };
  if (has(/dress|blouse|skirt|women clothes|baju perempuan|kurung|kebaya|abaya|jubah wanita/)) return { category:'women-clothes', badge:'Women Fashion', icon:'👗', meta:'Popular fashion item' };
  if (has(/shirt|tshirt|t-shirt|polo|men clothes|baju lelaki|seluar lelaki|pants|jeans|shorts|hoodie|jacket/)) return { category:'men-clothes', badge:'Men Fashion', icon:'👕', meta:'Daily men fashion item' };
  if (has(/tudung|hijab|shawl|telekung|kopiah|sejadah|muslim|jubah|abaya/)) return { category:'muslim', badge:'Muslim Fashion', icon:'🧕', meta:'Useful Muslim fashion item' };
  if (has(/women shoe|heels|high heel|flat shoe|kasut wanita|sandal wanita/)) return { category:'women-shoes', badge:'Women Shoes', icon:'👠', meta:'Daily footwear pick' };
  if (has(/shoe|shoes|sneaker|kasut|sandal|slipper|boots/)) return { category:'men-shoes', badge:'Shoes Pick', icon:'👟', meta:'Daily footwear pick' };
  if (has(/beauty|skincare|skin care|makeup|serum|sunscreen|moisturizer|cleanser|lipstick|perfume|health|supplement|masker|facial|shampoo|hair dryer|trimmer|shaver/)) return { category:'health', badge:'Self Care', icon:'✨', meta:'Best for self care and daily routine' };
  if (has(/baby|kids|kid|toy|toys|mainan|stroller|milk bottle|botol susu|diaper|lampin|school bag|beg sekolah/)) return { category:'baby', badge:'Baby & Kids', icon:'🧸', meta:'Useful for baby and kids' };
  if (has(/food|coklat|chocolate|snack|biscuit|cookies|kopi|coffee|tea|grocery|groceries|minuman|makanan|instant noodle|pet food|cat food|dog food|kibble/)) return { category:'groceries', badge: has(/chocolate|coklat/) ? 'Chocolate' : 'Groceries', icon:'🍫', meta:'Best for snack, grocery or daily stock' };
  if (has(/gym|dumbbell|fitness|yoga|cycling|bicycle|sport|sports|outdoor|camping|camp|tent|hiking|fishing|badminton|football/)) return { category:'sports', badge:'Sports & Outdoor', icon:'🏕️', meta:'Best for workout and outdoor activity' };
  if (has(/book|books|novel|komik|comic|stationery|alat tulis|hobby|puzzle|lego|model kit/)) return { category:'books', badge:'Books & Hobby', icon:'📚', meta:'Best for reading and hobby' };
  if (has(/travel|luggage|bagasi|suitcase|passport holder|neck pillow|travel bag|organizer travel/)) return { category:'travel', badge:'Travel Essential', icon:'🧳', meta:'Best for travel and packing' };
  if (has(/ticket|voucher|coupon|topup|reload|gift card/)) return { category:'tickets', badge:'Voucher', icon:'🎟️', meta:'Ticket, voucher or digital item' };
  return { category:'others', badge:'Useful Item', icon:'🛒', meta:'Best for useful daily item' };
}

function titleToIcon(title) {
  return titleRule(title).icon;
}

function titleToCategory(title) {
  return titleRule(title).category;
}

function titleToBadge(title, category) {
  return titleRule(title).badge;
}

function titleToMeta(title, category) {
  return titleRule(title).meta;
}

function cleanShopeeTitle(title) {
  return decodeHtmlEntities(String(title || ''))
    .replace(/^Shopee\s+/i, '')
    .replace(/\s*\|\s*Shopee.*$/i, '')
    .replace(/\s*-\s*Shopee.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}


function extractShopeeIds(productUrl) {
  const u = String(productUrl || '');
  let m = u.match(/\/product\/(\d+)\/(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/-i\.(\d+)\.(\d+)/i) || u.match(/i\.(\d+)\.(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/[?&]shopid=(\d+).*?[?&]itemid=(\d+)/i);
  if (m) return { shopid: m[1], itemid: m[2] };
  m = u.match(/[?&]itemid=(\d+).*?[?&]shopid=(\d+)/i);
  if (m) return { shopid: m[2], itemid: m[1] };
  return null;
}

function normalizeShopeeImage(img) {
  if (!img) return '';
  const v = Array.isArray(img) ? img[0] : img;
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://down-my.img.susercontent.com/file/${v}`;
}

function makeShopeeDescription(title, rawDesc) {
  const d = decodeHtmlEntities(rawDesc || '').replace(/\s+/g, ' ').trim();
  if (d && d.length > 20) return d.slice(0, 280);
  const t = title || 'Produk ini';
  return `${t} sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.`;
}

async function fetchJsonSafe(apiUrl, refererUrl) {
  try {
    const r = await fetch(apiUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8',
        'Referer': refererUrl || 'https://shopee.com.my/',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    const text = await r.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function unwrapShopeeItemJson(json) {
  if (!json) return null;
  // /api/v4/item/get usually: { data: { name, description, image, categories... } }
  if (json.data && (json.data.name || json.data.item)) return json.data.item || json.data;
  // /api/v4/pdp/get_pc variants
  if (json.data && json.data.item) return json.data.item;
  if (json.item) return json.item;
  if (json.name) return json;
  return null;
}

async function detectFromShopeeApi(finalUrl, ids) {
  if (!ids) return null;
  const { shopid, itemid } = ids;
  const apis = [
    `https://shopee.com.my/api/v4/item/get?itemid=${encodeURIComponent(itemid)}&shopid=${encodeURIComponent(shopid)}`,
    `https://shopee.com.my/api/v4/pdp/get_pc?shop_id=${encodeURIComponent(shopid)}&item_id=${encodeURIComponent(itemid)}`,
    `https://shopee.com.my/api/v2/item/get?itemid=${encodeURIComponent(itemid)}&shopid=${encodeURIComponent(shopid)}`
  ];

  for (const api of apis) {
    const json = await fetchJsonSafe(api, finalUrl);
    const item = unwrapShopeeItemJson(json);
    if (!item) continue;
    const title = cleanShopeeTitle(item.name || item.title || item.item_name || '');
    if (!title || /^product$/i.test(title)) continue;
    const description = makeShopeeDescription(title, item.description || item.desc || '');
    const categoryText = Array.isArray(item.categories)
      ? item.categories.map(c => c.display_name || c.name || '').filter(Boolean).join(' > ')
      : '';
    const image = normalizeShopeeImage(item.image || item.images || item.image_url);
    return { title, description, image, categoryText, source: 'shopee-api' };
  }
  return null;
}

async function detectFromJinaReader(finalUrl) {
  try {
    // r.jina.ai can convert public pages into readable text.  It is only a
    // fallback because Shopee sometimes returns a generic/captcha page.
    const cleanUrl = String(finalUrl || '').replace(/^https?:\/\//i, '');
    const readerUrls = [
      'https://r.jina.ai/http://' + cleanUrl,
      'https://r.jina.ai/http://http://' + cleanUrl.replace(/^http:\/\//i, ''),
      'https://r.jina.ai/http://https://' + cleanUrl.replace(/^https:\/\//i, '')
    ];

    for (const readerUrl of readerUrls) {
      const r = await fetch(readerUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 AZOBSS Product Detector',
          'Accept': 'text/plain,*/*'
        }
      });
      const text = await r.text();
      if (!text || text.trim().startsWith('<')) continue;

      const titleLine = (text.match(/^Title:\s*(.+)$/mi) || [])[1] || '';
      let title = cleanShopeeTitle(titleLine);

      if (!title || /Shopee Malaysia|Free Shipping Across Malaysia|Malaysia\s*\|\s*Free Shipping/i.test(title)) {
        const h1 = (text.match(/^#\s+(.+)$/mi) || [])[1] || '';
        title = cleanShopeeTitle(h1);
      }

      // Reject generic Shopee reader pages. Do not use these as product title.
      if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) continue;

      return {
        title,
        description: makeShopeeDescription(title, ''),
        image: '',
        categoryText: '',
        source: 'reader'
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function detectFromPlaywright(finalUrl) {
  let chromium;
  try {
    chromium = require('playwright-chromium').chromium;
  } catch (e) {
    try { chromium = require('playwright').chromium; } catch (e2) { return null; }
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-MY',
      timezoneId: 'Asia/Kuala_Lumpur',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-MY,en;q=0.9,ms-MY;q=0.8,ms;q=0.7',
        'Referer': 'https://shopee.com.my/'
      }
    });

    const page = await context.newPage();

    // Reduce heavy resources but keep scripts/styles because Shopee renders product data with JS.
    await page.route('**/*', route => {
      const type = route.request().resourceType();
      if (['font', 'media'].includes(type)) return route.abort().catch(() => {});
      return route.continue().catch(() => {});
    });

    await page.goto(finalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (e) {}
    try { await page.waitForSelector('meta[property="og:title"], h1, [data-sqe="name"], div[class*="product"]', { timeout: 15000 }); } catch (e) {}

    // Trigger lazy React rendering.
    await page.mouse.move(300, 300).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 650)).catch(() => {});
    await page.waitForTimeout(7000);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(2500);

    const data = await page.evaluate(() => {
      const pickMeta = (name) => {
        const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
        return el ? (el.getAttribute('content') || '').trim() : '';
      };

      const txt = (el) => el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      const visibleText = (selector) => txt(document.querySelector(selector));

      const selectors = [
        'h1',
        '[data-sqe="name"]',
        'section h1',
        'main h1',
        'div[class*="product-briefing"] h1',
        'div[class*="ProductBriefing"] h1',
        'div[class*="product"] h1',
        'div[class*="title"]',
        'span[class*="title"]',
        'div[class*="name"]',
        'span[class*="name"]'
      ];

      const titleCandidates = [
        pickMeta('og:title'),
        pickMeta('twitter:title'),
        ...selectors.map(visibleText),
        document.title || ''
      ].filter(Boolean);

      // Last resort: scan visible body text for a product-like line.
      const bodyLines = (document.body?.innerText || '')
        .split('\n')
        .map(s => s.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter(s => s.length >= 12 && s.length <= 180);

      const badLine = /^(shopee|search|cart|login|sign up|free shipping|malaysia|categories|sold|rating|voucher|add to cart|buy now|chat|share|report)$/i;
      const productLine = bodyLines.find(line => {
        if (badLine.test(line)) return false;
        if (/^RM\s?\d/i.test(line)) return false;
        if (/^\d+(\.\d+)?k? sold$/i.test(line)) return false;
        if (/^(shipping|quantity|variation|product ratings|description)$/i.test(line)) return false;
        return /[a-zA-Z]/.test(line) && (line.includes(' ') || line.includes('-'));
      }) || '';

      const descCandidates = [
        pickMeta('og:description'),
        pickMeta('description'),
        visibleText('[data-sqe="product-description"]'),
        visibleText('div[class*="product-detail"]'),
        visibleText('section[class*="description"]')
      ].filter(Boolean);

      return {
        title: titleCandidates.find(Boolean) || productLine || '',
        productLine,
        description: descCandidates.find(Boolean) || '',
        image: pickMeta('og:image') || pickMeta('twitter:image') || '',
        pageTitle: document.title || '',
        bodySample: bodyLines.slice(0, 30)
      };
    });

    const rejectTitle = (value) => {
      const t = cleanShopeeTitle(value || '');
      if (!t) return '';
      if (/^product$/i.test(t)) return '';
      if (/^shopee$/i.test(t)) return '';
      if (/^malaysia\s*\|\s*free shipping/i.test(t)) return '';
      if (/free shipping across malaysia/i.test(t)) return '';
      if (/^\d+$/.test(t)) return '';
      if (t.length < 8) return '';
      return t;
    };

    let title = rejectTitle(data.title);
    if (!title) title = rejectTitle(data.productLine);
    if (!title) title = rejectTitle(data.pageTitle);
    if (!title && Array.isArray(data.bodySample)) {
      for (const line of data.bodySample) {
        title = rejectTitle(line);
        if (title) break;
      }
    }

    if (!title) return null;

    return {
      title,
      description: makeShopeeDescription(title, data.description || ''),
      image: data.image || '',
      categoryText: '',
      source: 'playwright-browser'
    };

  } catch (e) {
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

async function detectAffiliateProduct(rawUrl) {
  const targetUrl = normalizeAffiliateUrl(rawUrl);
  if (!targetUrl) throw new Error('Missing URL');

  let finalUrl = targetUrl;
  let html = '';

  // First request is mainly to resolve Shopee shortlink and get meta if available.
  try {
    const response = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ms;q=0.8',
        'Cache-Control': 'no-cache',
        'Referer': 'https://shopee.com.my/'
      }
    });
    finalUrl = response.url || targetUrl;
    html = await response.text();
  } catch (e) {}

  const ids = extractShopeeIds(finalUrl) || extractShopeeIds(targetUrl);

  // Stronger detection: Shopee item APIs by shop_id + item_id.
  const apiResult = await detectFromShopeeApi(finalUrl, ids);
  let title = apiResult?.title || '';
  let description = apiResult?.description || '';
  let image = apiResult?.image || '';
  let source = apiResult?.source || '';
  let categoryText = apiResult?.categoryText || '';

  // Fallback: HTML metadata if Shopee allows it.
  if (!title && html) {
    title = cleanShopeeTitle(pickTitleFromHtml(html));
    description = shortenDescription(pickMeta(html, 'og:description') || pickMeta(html, 'description'), title);
    image = pickMeta(html, 'og:image') || pickMeta(html, 'twitter:image');
    source = title ? 'meta' : '';

    const ldMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ldMatches) {
      try {
        const json = JSON.parse(m[1]);
        const arr = Array.isArray(json) ? json : [json];
        for (const obj of arr) {
          if (obj && obj.name && (!title || title.toLowerCase() === 'shopee')) {
            title = cleanShopeeTitle(obj.name);
            source = 'jsonld';
          }
          if (obj && obj.description && (!description || description.includes('Semak detail'))) {
            description = shortenDescription(obj.description, title);
          }
          if (obj && obj.image && !image) image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
        }
      } catch(e) {}
    }
  }

  // Last external fallback: reader service can sometimes read JS-heavy pages as markdown.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title)) {
    const reader = await detectFromJinaReader(finalUrl);
    if (reader?.title && !/^\d+$/.test(reader.title)) {
      title = reader.title;
      description = reader.description;
      image = image || reader.image;
      source = reader.source;
    }
  }

  // Strongest fallback: Playwright opens Shopee like a real browser.
  // Use this after API/meta/reader because it is slower but can read JS-rendered pages.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    const browserResult = await detectFromPlaywright(finalUrl);
    if (browserResult?.title && !/^\d+$/.test(browserResult.title)) {
      title = browserResult.title;
      description = browserResult.description;
      image = image || browserResult.image;
      source = browserResult.source;
    }
  }

  // Fallback from old Shopee slug format: product-name-i.shopid.itemid
  // This cannot help with /product/shopid/itemid links because they have no title,
  // but it is useful for older/full product URLs that include the product name.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    try {
      const pathPart = new URL(finalUrl).pathname || '';
      const slugMatch = pathPart.match(/\/([^\/]+)-i\.\d+\.\d+/i);
      if (slugMatch && slugMatch[1]) {
        const slugTitle = cleanShopeeTitle(decodeURIComponent(slugMatch[1]).replace(/-/g, ' '));
        if (slugTitle && !/^product$/i.test(slugTitle) && !/^shopee$/i.test(slugTitle)) {
          title = slugTitle;
          description = makeShopeeDescription(title, '');
          source = 'url-slug';
        }
      }
    } catch(e) {}
  }

  // Clean fallback: do NOT use item id or generic Shopee page as a fake title. Let user know if Shopee blocks.
  if (!title || /^product$/i.test(title) || /^shopee$/i.test(title) || /^\d+$/.test(title) || /^malaysia\s*\|\s*free shipping/i.test(title)) {
    title = '';
    description = 'Shopee tidak benarkan sistem baca nama produk penuh. Paste tajuk produk atau isi manual sebelum Save.';
    source = 'blocked';
  }

  const category = titleToCategory((categoryText ? categoryText + ' ' : '') + title);
  return {
    ok: true,
    url: targetUrl,
    finalUrl,
    shopid: ids?.shopid || '',
    itemid: ids?.itemid || '',
    source,
    title,
    description,
    category,
    badge: title ? titleToBadge(title, category) : 'Useful Item',
    icon: title ? titleToIcon(title) : '🛒',
    meta: title ? titleToMeta(title, category) : 'Semak manual sebelum Save',
    image: image || '',
    note: source === 'shopee-api'
      ? 'Auto filled daripada Shopee item API. Sila semak sebelum Save.'
      : source === 'blocked'
        ? 'Shopee block metadata produk. Sistem tidak guna ID sebagai title. Paste tajuk produk atau isi manual.'
        : source === 'reader'
          ? 'Auto filled guna reader fallback. Sila semak sebelum Save.'
          : source === 'url-slug'
            ? 'Auto filled guna nama produk daripada URL slug. Sila semak sebelum Save.'
            : source === 'playwright-browser'
              ? 'Auto filled guna Playwright browser mode. Sila semak sebelum Save.'
              : 'Auto filled daripada metadata page + keyword mapping. Sila semak sebelum Save.'
  };
}


async function handler(req, res) {

  try {

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname || "/";

    if (req.method === "OPTIONS") {
      return send(res, 204, "");
    }

    // =========================
    // HEALTH
    // =========================

    if (pathname === "/health") {

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          server: "AZOBSS Backend Running",
          port: PORT
        }, null, 2),
        "application/json"
      );
    }


    // =========================
    // AFFILIATE PRODUCT AUTO DETECT
    // =========================

    if (
      pathname === "/api/detect-product" &&
      (req.method === "GET" || req.method === "POST")
    ) {
      let productUrl = parsed.query.url || parsed.query.link || "";

      if (req.method === "POST") {
        try {
          const body = await readBody(req);
          const data = JSON.parse(body || "{}");
          productUrl = data.url || data.link || productUrl;
        } catch (e) {}
      }

      try {
        const detected = await detectAffiliateProduct(productUrl);
        return send(res, 200, JSON.stringify(detected, null, 2), "application/json");
      } catch (err) {
        return send(res, 502, JSON.stringify({
          ok: false,
          error: err.message || "Auto detect failed",
          note: "Shopee mungkin block request. Paste product title atau isi manual jika gagal."
        }, null, 2), "application/json");
      }
    }

    // =========================
    // LOAD AFFILIATES
    // =========================

    if (
      pathname === "/api/affiliates" &&
      req.method === "GET"
    ) {

      if (!fs.existsSync(AFFILIATE_JSON)) {
        fs.writeFileSync(
          AFFILIATE_JSON,
          "[]",
          "utf8"
        );
      }

      return send(
        res,
        200,
        fs.readFileSync(AFFILIATE_JSON, "utf8"),
        "application/json"
      );
    }

    // =========================
    // SAVE AFFILIATES
    // =========================

    if (
      pathname === "/api/save-affiliates" &&
      req.method === "POST"
    ) {

      const body = await readBody(req);

      let data;

      try {
        data = JSON.parse(body);
      } catch (err) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Invalid JSON"
          }),
          "application/json"
        );
      }

      fs.writeFileSync(
        AFFILIATE_JSON,
        JSON.stringify(data, null, 2),
        "utf8"
      );

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          saved: data.length
        }),
        "application/json"
      );
    }


    // =========================
    // JUPEM STESEN TANDA ARAS SEARCH
    // =========================

    if (
      pathname === "/api/stesen-tanda-aras" &&
      req.method === "GET"
    ) {
      const produk = cleanBenchmarkProduct(parsed.query.produk);
      const negeri = cleanState(parsed.query.negeri);
      const q = cleanSearch(parsed.query.q || parsed.query.carian);

      if (!negeri) {
        return send(
          res,
          400,
          JSON.stringify({ ok: false, error: "Missing negeri" }),
          "application/json"
        );
      }

      const sourceUrl =
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?produk=${encodeURIComponent(produk)}&negeri=${encodeURIComponent(negeri)}&carian=${encodeURIComponent(q)}`;

      const candidates = [
        sourceUrl,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?jenis=${encodeURIComponent(produk)}&negeri=${encodeURIComponent(negeri)}&carian=${encodeURIComponent(q)}`,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras?product=${encodeURIComponent(produk)}&state=${encodeURIComponent(negeri)}&search=${encodeURIComponent(q)}`,
        `https://ebiz.jupem.gov.my/Produk/StesenTandaAras`
      ];

      let lastError = "";

      for (const targetUrl of candidates) {
        try {
          console.log("Benchmark search:", targetUrl);
          const response = await fetch(targetUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Referer": "https://ebiz.jupem.gov.my/Produk/StesenTandaAras"
            }
          });

          if (!response.ok) {
            lastError = `HTTP ${response.status}`;
            continue;
          }

          const html = await response.text();
          const results = parseBenchmarkRows(html, produk, negeri);

          if (results.length || targetUrl === candidates[candidates.length - 1]) {
            return send(
              res,
              200,
              JSON.stringify({
                ok: true,
                produk,
                negeri,
                q,
                sourceUrl,
                results,
                note: results.length ? "Results parsed from JUPEM eBiz page." : "No parsable table returned. Open sourceUrl to continue in eBiz JUPEM."
              }, null, 2),
              "application/json"
            );
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      return send(
        res,
        502,
        JSON.stringify({ ok: false, error: lastError || "Benchmark search failed", sourceUrl }),
        "application/json"
      );
    }

    // =========================
    // JUPEM PA HOLD SYSTEM
    // =========================

    if (
      pathname === "/api/pa" &&
      req.method === "GET"
    ) {

      const noPA =
        cleanPA(parsed.query.noPA);

      const negeri =
        cleanState(parsed.query.negeri);

      if (!noPA) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Missing noPA"
          }),
          "application/json"
        );
      }

      if (!negeri) {

        return send(
          res,
          400,
          JSON.stringify({
            ok: false,
            error: "Missing negeri"
          }),
          "application/json"
        );
      }

      fs.mkdirSync(
        TEMP_DIR,
        { recursive: true }
      );

      const fileName =
        `${noPA}.TIF`;

      const jupemUrl =
`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`;

      console.log(
        "Fetching:",
        jupemUrl
      );

      const response =
        await fetchJupem(jupemUrl);

      if (!response.ok) {

        return send(
          res,
          404,
          JSON.stringify({
            ok: false,
            error: "PA not found"
          }),
          "application/json"
        );
      }

      const buffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      const firstText =
        buffer
          .slice(0, 120)
          .toString("utf8")
          .toLowerCase();

      const looksHTML =
        firstText.includes("<html");

      if (
        !buffer.length ||
        looksHTML
      ) {

        return send(
          res,
          404,
          JSON.stringify({
            ok: false,
            error: "Invalid PA file"
          }),
          "application/json"
        );
      }

      const tempName =
`${noPA}.tif`;

      const tempPath =
        path.join(
          TEMP_DIR,
          tempName
        );

      // HOLD FILE
      fs.writeFileSync(
        tempPath,
        buffer
      );

      console.log(
        "PA Held:",
        tempName
      );

      const token =
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      DOWNLOAD_TOKENS.set(token, {
        file: tempName,
        expires: Date.now() + 5 * 60 * 1000
      });

      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          noPA,
          negeri,
          filename: tempName,
          size: buffer.length,
          download:
            `/api/download-pa/${tempName}?token=${token}`
        }, null, 2),
        "application/json"
      );
    }



// =========================
// JUPEM BM / SBM SECURE DOWNLOAD PROXY
// =========================

if (
  pathname === "/api/download-stesen-tanda-aras" &&
  req.method === "GET"
) {
  const productId = String(parsed.query.productId || parsed.query.id || "")
    .trim()
    .replace(/[^0-9]/g, "");

  const jenis = String(parsed.query.jenis || "1").trim() === "2" ? "2" : "1";

  if (!productId) {
    return send(
      res,
      400,
      JSON.stringify({ ok: false, error: "Missing productId" }),
      "application/json"
    );
  }

  const jupemUrl =
    `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenTandaAras/${encodeURIComponent(productId)}?jenis=${encodeURIComponent(jenis)}`;

  console.log("Fetching BM/SBM:", jupemUrl);

  const response = await fetchJupem(jupemUrl);

  if (!response.ok) {
    return send(
      res,
      404,
      JSON.stringify({ ok: false, error: "BM/SBM not found" }),
      "application/json"
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const firstText = buffer.slice(0, 160).toString("utf8").toLowerCase();

  if (!buffer.length || firstText.includes("<html")) {
    return send(
      res,
      404,
      JSON.stringify({ ok: false, error: "Invalid BM/SBM file" }),
      "application/json"
    );
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const safePrefix = jenis === "2" ? "SBM" : "BM";
  const ext = contentType.includes("pdf") ? "pdf" : (contentType.includes("zip") ? "zip" : "dat");

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${safePrefix}-${productId}.${ext}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(buffer);
  return;
}

// =========================
// JUPEM PA PDF CONVERTER
// =========================

if (
  pathname === "/api/pa-pdf" &&
  req.method === "GET"
) {

  const noPA =
    cleanPA(parsed.query.noPA);

  const negeri =
    cleanState(parsed.query.negeri);

  if (!noPA) {
    return send(
      res,
      400,
      JSON.stringify({
        ok: false,
        error: "Missing noPA"
      }),
      "application/json"
    );
  }

  if (!negeri) {
    return send(
      res,
      400,
      JSON.stringify({
        ok: false,
        error: "Missing negeri"
      }),
      "application/json"
    );
  }

  const fileName =
    `${noPA}.TIF`;

  const jupemUrl =
`https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunPelanAkui?noPa=${encodeURIComponent(fileName)}&negeri=${encodeURIComponent(negeri)}`;

  console.log(
    "Fetching PDF:",
    jupemUrl
  );

  const response =
    await fetchJupem(jupemUrl);

  if (!response.ok) {
    return send(
      res,
      404,
      JSON.stringify({
        ok: false,
        error: "PA not found"
      }),
      "application/json"
    );
  }

  const tifBuffer =
    Buffer.from(
      await response.arrayBuffer()
    );

  const firstText =
    tifBuffer
      .slice(0, 120)
      .toString("utf8")
      .toLowerCase();

  if (
    !tifBuffer.length ||
    firstText.includes("<html")
  ) {
    return send(
      res,
      404,
      JSON.stringify({
        ok: false,
        error: "Invalid PA file"
      }),
      "application/json"
    );
  }

  const pngBuffer =
    await sharp(tifBuffer)
      .png()
      .toBuffer();

  const meta =
    await sharp(pngBuffer)
      .metadata();

  const doc =
    new PDFDocument({
      autoFirstPage: false,
      margin: 0
    });

  const chunks = [];

  doc.on("data", chunk => chunks.push(chunk));

  doc.on("end", () => {
    const pdfBuffer =
      Buffer.concat(chunks);

const safeName =
      `${noPA}`.replace(/[^A-Z0-9_-]/gi, "");

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="${safeName}.pdf"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(pdfBuffer);
  });

  doc.addPage({
    size: [meta.width, meta.height],
    margin: 0
  });

  doc.image(
    pngBuffer,
    0,
    0,
    {
      width: meta.width,
      height: meta.height
    }
  );

  doc.end();

  return;
}

// =========================
// SECURE PA DOWNLOAD
// =========================

if (
  pathname.startsWith("/api/download-pa/") &&
  req.method === "GET"
) {

  const fileName =
    path.basename(pathname);

  const token =
    parsed.query.token;

  const saved =
    DOWNLOAD_TOKENS.get(token);

  if (
    !saved ||
    saved.file !== fileName ||
    saved.expires < Date.now()
  ) {

    return send(
      res,
      403,
      "Unauthorized"
    );
  }

  // DOWNLOAD_TOKENS.delete(token); // allow IDM/browser retry

const filePath =
    path.join(TEMP_DIR, fileName);

  if (!fs.existsSync(filePath)) {

    return send(
      res,
      404,
      "File not found"
    );
  }

  res.writeHead(200, {
    "Content-Type": "image/tiff",
    "Content-Disposition":
      `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  fs.createReadStream(filePath)
    .pipe(res);

  return;
}


    // =========================
    // BLOCK DIRECT TEMP ACCESS
    // =========================

    if (
      pathname === "/temp" ||
      pathname.startsWith("/temp/")
    ) {
      return send(
        res,
        403,
        "Forbidden"
      );
    }

    // =========================
    // STATIC FILES
    // =========================

    const filePath =
      safePath(pathname);

    if (!filePath) {
      return send(res, 403, "Forbidden");
    }

    if (
      !fs.existsSync(filePath) ||
      fs.statSync(filePath).isDirectory()
    ) {

      return send(
        res,
        404,
        "File Not Found"
      );
    }

    const data =
      fs.readFileSync(filePath);

    return send(
      res,
      200,
      data,
      mimeType(filePath)
    );

  } catch (err) {

    console.error(err);

return send(
  res,
  500,
  JSON.stringify({
    ok: false,
    error: err.message,
    name: err.name,
    cause: err.cause
      ? String(err.cause)
      : null,
    stack: err.stack
  }, null, 2),
  "application/json"
);
  }
}

// =========================
// AUTO CLEAN TEMP FILES
// =========================

function cleanupTempFiles() {

  try {

    if (!fs.existsSync(TEMP_DIR)) {
      return;
    }

    const files =
      fs.readdirSync(TEMP_DIR);

    const now = Date.now();

    for (const file of files) {

      const fullPath =
        path.join(TEMP_DIR, file);

      try {

        const stat =
          fs.statSync(fullPath);

        const age =
          now - stat.mtimeMs;

        // DELETE FILE > 30 DAYS
        if (age > FILE_EXPIRE_MS) {

          fs.unlinkSync(fullPath);

          console.log(
            "Deleted old file:",
            file
          );
        }

      } catch (err) {

        console.error(
          "Cleanup file error:",
          file,
          err.message
        );
      }
    }

  } catch (err) {

    console.error(
      "Cleanup temp error:",
      err.message
    );
  }
}

// RUN EVERY 12 HOURS
setInterval(
  cleanupTempFiles,
  12 * 60 * 60 * 1000
);

// RUN ON STARTUP
cleanupTempFiles();

http.createServer(handler)
.listen(PORT, "0.0.0.0", () => {

  console.log("");
  console.log("================================");
  console.log(" AZOBSS BACKEND RUNNING");
  console.log("================================");
  console.log("PORT:", PORT);
  console.log("ROOT:", ROOT);
  console.log("================================");
  console.log("");

});