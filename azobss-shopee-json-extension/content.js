(() => {
  const ext = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!ext?.storage?.local) return;

  const PENDING_KEY = 'azobssShopeePendingCaptureV1309';
  const ACK_EVENT = 'azobss-shopee-capture-ack';
  const READY_EVENT = 'azobss-shopee-capture-ready';
  const BRIDGE_ID = 'azobss-shopee-extension-bridge-v1309';
  const host = String(location.hostname || '').toLowerCase();
  const isAzobss = host === 'azobss.com' || host === 'www.azobss.com';
  const isShopee = host === 'shopee.com.my' || host.endsWith('.shopee.com.my');

  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const pickAttr = (selector, attr='content') => {
    try { const el=document.querySelector(selector); return clean(el?.getAttribute?.(attr) || ''); } catch { return ''; }
  };
  const pickText = selector => {
    try { const el=document.querySelector(selector); return clean(el?.innerText || el?.textContent || ''); } catch { return ''; }
  };
  const decodeMaybe = value => { try { return decodeURIComponent(String(value||'')); } catch { return String(value||''); } };
  function canonicalFromChallenge(){
    try{
      const u=new URL(location.href);
      for(const key of ['next','url','redirect','redirect_uri','target','jump_url','nav_url']){
        const raw=u.searchParams.get(key); if(!raw) continue;
        const d=decodeMaybe(raw); if(/https?:\/\/(?:www\.)?shopee\.com\.my\//i.test(d)) return d;
      }
    }catch{}
    return '';
  }
  function stripShopeeSuffix(title){
    return clean(String(title||'')
      .replace(/\s*[|｜]\s*Shopee\s+Malaysia\s*$/i,'')
      .replace(/\s*[-–—]\s*Shopee\s+Malaysia\s*$/i,''));
  }
  function isGenericTitle(title){
    const t=clean(title).toLowerCase();
    if(!t || t.length < 5) return true;
    if(t==='shopee' || t==='shopee malaysia') return true;
    if(/^shopee malaysia\s*[|–—-]\s*(?:free shipping|buy|online shopping)/i.test(clean(title))) return true;
    if(/^buy everything on shopee/i.test(t)) return true;
    if(/^free shipping (?:across|in) malaysia/i.test(t)) return true;
    return false;
  }
  function findJsonTitle(){
    const patterns=[/"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,/"itemName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i,/"productName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i];
    for(const s of [...document.scripts]){
      const txt=s.textContent||''; if(!/product|item|name|title/i.test(txt)) continue;
      for(const re of patterns){ const m=txt.match(re); if(m?.[1]){ try{return JSON.parse('"'+m[1]+'"')}catch{return m[1]} } }
    }
    return '';
  }
  function idsFromUrl(value){
    const text=decodeMaybe(value);
    let m=text.match(/-i\.(\d+)\.(\d+)/i) || text.match(/\/product\/(\d+)\/(\d+)/i);
    return m ? {shopId:m[1],itemId:m[2]} : {shopId:'',itemId:''};
  }
  function extractShopee(){
    const canonical=pickAttr('link[rel="canonical"]','href') || pickAttr('meta[property="og:url"]') || canonicalFromChallenge();
    let title=stripShopeeSuffix(
      pickAttr('meta[property="og:title"]') || pickAttr('meta[name="title"]') ||
      pickText('[data-testid="pdp-product-title"]') || pickText('.product-briefing h1') || pickText('h1') ||
      findJsonTitle() || document.title
    );
    if(isGenericTitle(title)) title='';
    let description=pickAttr('meta[property="og:description"]') || pickAttr('meta[name="description"]');
    if(/paste an affiliate product link|free shipping across malaysia/i.test(description)) description='';
    const image=pickAttr('meta[property="og:image"]') || pickAttr('meta[name="twitter:image"]');
    const ids=idsFromUrl(canonical || location.href);
    return {
      bridgeVersion:1309,
      source:'azobss-local-browser-capture',
      title, description, image,
      canonicalUrl:canonical || '', sourceUrl:canonical || location.href,
      browserUrl:location.href, shopId:ids.shopId, itemId:ids.itemId,
      capturedAt:new Date().toISOString()
    };
  }
  function badge(text,good=true){
    document.getElementById('azobss-shopee-capture-badge')?.remove();
    const d=document.createElement('div'); d.id='azobss-shopee-capture-badge'; d.textContent=text;
    d.style.cssText=`position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:360px;padding:12px 14px;border-radius:12px;background:${good?'#15803d':'#b91c1c'};color:#fff;font:600 14px/1.35 Arial;box-shadow:0 10px 30px rgba(0,0,0,.4)`;
    document.documentElement.appendChild(d); setTimeout(()=>d.remove(),7000);
  }
  async function capture(){
    await new Promise(r=>setTimeout(r,2800));
    let data=extractShopee();
    if(!data.title){ await new Promise(r=>setTimeout(r,2200)); data=extractShopee(); }
    // Important: Shopee verification pages can still retain real SEO metadata.
    if(!data.title){ badge('AZOBSS: metadata produk belum kelihatan pada browser ini.',false); return; }
    await ext.storage.local.set({[PENDING_KEY]:data});
    badge('AZOBSS: produk ditangkap ✅ Kembali ke tab AZOBSS; form akan diisi automatik.',true);
  }
  function exposeBridge(data){
    let el=document.getElementById(BRIDGE_ID);
    if(!el){ el=document.createElement('meta'); el.id=BRIDGE_ID; document.documentElement.appendChild(el); }
    el.setAttribute('data-extension','ready');
    if(data) el.setAttribute('data-payload',encodeURIComponent(JSON.stringify(data)));
    document.dispatchEvent(new Event(READY_EVENT,{bubbles:true}));
  }
  if(isAzobss){
    let last='';
    const pump=async()=>{
      const obj=await ext.storage.local.get(PENDING_KEY).catch(()=>({})); const data=obj?.[PENDING_KEY];
      if(data){ const sig=JSON.stringify(data); if(sig!==last){last=sig;exposeBridge(data);} }
      else exposeBridge(null);
    };
    document.addEventListener(ACK_EVENT,async()=>{ await ext.storage.local.remove(PENDING_KEY).catch(()=>{}); last=''; exposeBridge(null); });
    pump(); setInterval(pump,1200); return;
  }
  if(isShopee) capture();
})();
