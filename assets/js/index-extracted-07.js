// Extracted from index.html. Order preserved.

/* AZOBSS FIX: make Shopee JSON buttons definitely clickable */
(function(){
  function $(id){ return document.getElementById(id); }
  function status(msg, bad){
    var el=$('affiliateJsonImportStatus');
    if(!el) return;
    el.textContent=msg||'';
    el.classList.toggle('is-error', !!bad);
  }
  function cleanText(v){ return String(v||'').replace(/\s+/g,' ').trim(); }
  function setVal(id,val){ var el=$(id); if(el) el.value=val||''; }
  function titleCategory(title){
    var t=String(title||'').toLowerCase();
    if(/ssd|nvme|ram|router|wifi|keyboard|mouse|monitor|gpu|rtx|pc|computer|laptop|usb hub|pendrive/.test(t)) return 'computer';
    if(/iphone|android|phone|charger|powerbank|cable|case|screen protector|earbud|airpod|type c|usb c/.test(t)) return 'mobile';
    if(/dashcam|car|kereta|tyre|tayar|jump starter|car vacuum|seat|vehicle/.test(t)) return 'automotive';
    if(/frypan|wok|cookware|kitchen|tefal|spatula|blender|grinder|chopper|mixer|mincer|pan|pot|knife|air fryer|rice cooker/.test(t)) return 'home-living';
    if(/vacuum|cleaner|mop|dust|cleaning|penyedut/.test(t)) return 'home-living';
    if(/baby|stroller|milk bottle|toys|kids|diaper|lampin/.test(t)) return 'baby';
    if(/gym|dumbbell|fitness|cycling|sport|outdoor|camping|tent/.test(t)) return 'sports';
    if(/bag|wallet|dress|shirt|shoe|sneaker|fashion|watch|baju|kasut/.test(t)) return 'fashion';
    return 'others';
  }
  function labelFromCategory(v){
    return ({
      'computer':'Computer & Accessories','mobile':'Mobile & Accessories','automotive':'Automotive',
      'home-living':'Home & Living','baby':'Baby & Toys','sports':'Sports & Outdoor','fashion':'Fashion Accessories','others':'Others'
    })[v] || 'Others';
  }
  function iconFor(title,cat){
    var t=String(title||'').toLowerCase();
    if(/frypan|wok|cookware|kitchen|tefal|spatula|blender|grinder|chopper|mixer|mincer|pan|pot|air fryer/.test(t)) return '🍳';
    if(/vacuum|cleaner|mop|dust/.test(t)) return '🧹';
    if(cat==='computer') return '💻';
    if(cat==='mobile') return '📱';
    if(cat==='automotive') return '🚗';
    if(cat==='baby') return '🧸';
    if(cat==='sports') return '🏋️';
    if(cat==='fashion') return '👜';
    return '🛒';
  }
  function badgeFor(title,cat){
    var t=String(title||'').toLowerCase();
    if(/frypan|wok|cookware|kitchen|tefal|spatula|blender|grinder|chopper|mixer|mincer|pan|pot|air fryer/.test(t)) return 'Kitchen Essentials';
    if(/vacuum|cleaner|mop|dust/.test(t)) return 'Useful Gadget';
    if(/ssd|nvme/.test(t)) return 'Fast Storage';
    if(/router|wifi/.test(t)) return 'Networking';
    if(cat==='computer') return 'Computer & Accessories';
    if(cat==='mobile') return 'Daily Tech';
    if(cat==='automotive') return 'Car Essential';
    if(cat==='baby') return 'Baby Essentials';
    if(cat==='sports') return 'Fitness';
    if(cat==='fashion') return 'Trending Fashion';
    return 'Useful Item';
  }
  function metaFor(title,cat){
    var t=String(title||'').toLowerCase();
    if(/frypan|wok|cookware|kitchen|tefal|spatula|blender|grinder|chopper|mixer|mincer|pan|pot|air fryer/.test(t)) return 'Best for cooking and daily kitchen use';
    if(/vacuum|cleaner|mop|dust/.test(t)) return 'Portable cleaning and daily use';
    if(cat==='computer') return 'Best for PC setup and daily use';
    if(cat==='mobile') return 'Useful mobile gadget';
    if(cat==='automotive') return 'Useful for car and travel';
    if(cat==='baby') return 'Useful for baby and kids';
    if(cat==='sports') return 'Best for workout and outdoor';
    if(cat==='fashion') return 'Popular fashion item';
    return 'Best for useful daily item';
  }
  function descFor(title,cat){
    var name=cleanText(title);
    var t=name.toLowerCase();
    if(/frypan|wok|cookware|kitchen|tefal|spatula|blender|grinder|chopper|mixer|mincer|pan|pot|air fryer/.test(t)) return name+' sesuai untuk kegunaan dapur harian. Praktikal untuk memasak, penyediaan makanan dan kegunaan rumah.';
    if(/vacuum|cleaner|mop|dust/.test(t)) return name+' sesuai untuk pembersihan harian rumah atau kereta. Mudah digunakan dan praktikal untuk kawasan kecil.';
    if(cat==='computer') return name+' sesuai untuk setup PC, kerja harian dan penggunaan komputer.';
    if(cat==='mobile') return name+' sesuai untuk kegunaan telefon harian dan aksesori mobile.';
    if(cat==='automotive') return name+' sesuai untuk kegunaan kereta, travel dan penjagaan kenderaan.';
    return name+' sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.';
  }
  function consoleScript(){
    return `(function(){\n  function pick(){for(const s of arguments){try{const el=document.querySelector(s);const v=el&&(el.content||el.innerText||el.textContent||el.getAttribute('content'));if(v&&String(v).trim())return String(v).trim();}catch(e){}}return '';}\n  function clean(v){return String(v||'').replace(/\\s+/g,' ').trim();}\n  function findJsonTitle(){const scripts=[...document.scripts].map(s=>s.textContent||'').filter(Boolean);const patterns=[/"name"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i,/"title"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i,/"itemName"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i];for(const txt of scripts){if(!/Shopee|product|item|name|title/i.test(txt))continue;for(const re of patterns){const m=txt.match(re);if(m&&m[1]){try{return JSON.parse('"'+m[1]+'"');}catch(e){return m[1];}}}}return '';}\n  const title=clean(pick('meta[property="og:title"]','meta[name="title"]','h1','[data-testid="pdp-product-title"]','.product-briefing h1')||findJsonTitle()||document.title.replace(/\\|.*$/,''));\n  const description=clean(pick('meta[property="og:description"]','meta[name="description"]'));\n  const image=pick('meta[property="og:image"]','meta[name="twitter:image"]');\n  const data={source:'shopee-console-json',title,description,image,url:location.href,capturedAt:new Date().toISOString()};\n  console.log('AZOBSS Shopee JSON:',data);\n  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});\n  const a=document.createElement('a');\n  const safe=(title||'shopee-product').replace(/[\\\\/:*?"<>|]+/g,' ').replace(/\\s+/g,' ').trim().slice(0,80)||'shopee-product';\n  a.href=URL.createObjectURL(blob);a.download=safe+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);\n})();`;
  }
  function copyScript(){
    var s=consoleScript();
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(s).then(function(){status('✅ Script copied. Buka Shopee → F12 Console → paste → Enter. JSON akan auto download.',false);}).catch(function(){fallbackCopy(s);});
    }else fallbackCopy(s);
  }
  function fallbackCopy(s){
    var ta=document.createElement('textarea');ta.value=s;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.focus();ta.select();
    try{document.execCommand('copy');status('✅ Script copied. Buka Shopee → F12 Console → paste → Enter.',false);}catch(e){status('Copy gagal. Sila cuba browser lain atau copy manual.',true);}finally{ta.remove();}
  }
  function normalize(raw){
    var d=Array.isArray(raw)?raw[0]:(raw||{});var item=d.item||d.data||d.product||d.item_basic||{};
    return {title:cleanText(d.title||d.name||d.productTitle||d.product_title||item.title||item.name||item.product_name||''),description:cleanText(d.description||d.desc||d.productDescription||item.description||item.desc||''),link:cleanText(d.url||d.link||d.finalUrl||d.affiliateLink||''),image:cleanText(d.image||d.imageUrl||d.thumbnail||item.image||'')};
  }
  function apply(raw){
    var d=normalize(raw);if(!d.title){status('JSON tiada product title. Cuba copy tajuk produk dan guna Auto Fill backup.',true);return;}
    var cat=titleCategory(d.title);
    setVal('affiliateTitleInput',d.title);setVal('affiliateIcon',iconFor(d.title,cat));setVal('affiliateBadge',badgeFor(d.title,cat));setVal('affiliateCategoryInput',cat);setVal('affiliateMetaInput',metaFor(d.title,cat));setVal('affiliateDescInput',d.description||descFor(d.title,cat));
    if(d.link){var full=$('affiliateFullLinkInput');if(full && !full.value.trim()) setVal('affiliateFullLinkInput',d.link);}
    setVal('affiliateManualTitleInput',d.title);
    status('✅ JSON imported. Form auto filled daripada data Shopee. Sila semak sebelum Save.',false);
  }
  function importFile(file){
    if(!file){status('Sila pilih fail JSON Shopee dahulu.',true);return;}
    var r=new FileReader();r.onload=function(){try{apply(JSON.parse(r.result));}catch(e){status('Fail JSON tidak sah atau rosak.',true);}};r.readAsText(file);
  }
  function openLink(){
    var url=($('affiliateFullLinkInput')?.value||$('affiliateLinkInput')?.value||'').trim();
    if(!url){status('Paste link Shopee dulu sebelum Open.',true);return;}
    window.open(url,'_blank','noopener');
  }
  function bind(){
    var copy=$('affiliateCopyJsonExtractorButton'), imp=$('affiliateImportJsonButton'), file=$('affiliateShopeeJsonFile'), open=$('affiliateOpenProductButton');
    if(copy && !copy.dataset.azobssFixed){copy.dataset.azobssFixed='1';copy.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();copyScript();});}
    if(imp && !imp.dataset.azobssFixed){imp.dataset.azobssFixed='1';imp.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(file){file.value='';file.click();}else status('Input file JSON tidak dijumpai.',true);});}
    if(file && !file.dataset.azobssFixed){file.dataset.azobssFixed='1';file.addEventListener('change',function(){importFile(this.files&&this.files[0]);this.value='';});}
    if(open && !open.dataset.azobssFixed){open.dataset.azobssFixed='1';open.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openLink();});}
  }
  document.addEventListener('DOMContentLoaded',bind);
  window.addEventListener('load',bind);
  setTimeout(bind,300);setTimeout(bind,1200);setTimeout(bind,2500);
})();
