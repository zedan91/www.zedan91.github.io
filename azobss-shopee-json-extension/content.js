(() => {
  const ext = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);
  if (!ext?.storage?.local) return;

  const PRODUCT_KEY = 'azobssShopeePendingCaptureV1309';
  const PRODUCT_ACK = 'azobss-shopee-capture-ack';
  const PRODUCT_READY = 'azobss-shopee-capture-ready';
  const PRODUCT_BRIDGE = 'azobss-shopee-extension-bridge-v1309';

  const FINANCE_KEY = 'azobssShopeeFinancePendingV1313';
  const FINANCE_ACK = 'azobss-shopee-finance-ack';
  const FINANCE_READY = 'azobss-shopee-finance-ready';
  const FINANCE_BRIDGE = 'azobss-shopee-finance-bridge-v1313';

  const host = String(location.hostname || '').toLowerCase();
  const path = String(location.pathname || '');
  const isAzobss = host === 'azobss.com' || host === 'www.azobss.com';
  const isShopee = host === 'shopee.com.my' || host.endsWith('.shopee.com.my');
  const isAzobssAdmin = isAzobss && /^\/admin(?:\/|$)/i.test(path);
  const isAzobssAffiliate = isAzobss && /^\/affiliate-shop(?:\/|$)/i.test(path);

  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const pickAttr = (selector, attr='content') => { try { const el=document.querySelector(selector); return clean(el?.getAttribute?.(attr) || ''); } catch { return ''; } };
  const pickText = selector => { try { const el=document.querySelector(selector); return clean(el?.innerText || el?.textContent || ''); } catch { return ''; } };
  const decodeMaybe = value => { try { return decodeURIComponent(String(value||'')); } catch { return String(value||''); } };
  const hash = s => { let h=2166136261; for (const ch of String(s||'')) { h ^= ch.charCodeAt(0); h = Math.imul(h,16777619); } return (h>>>0).toString(16); };
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
    return clean(String(title||'').replace(/\s*[|｜]\s*Shopee\s+Malaysia\s*$/i,'').replace(/\s*[-–—]\s*Shopee\s+Malaysia\s*$/i,''));
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
    const text=decodeMaybe(value); const m=text.match(/-i\.(\d+)\.(\d+)/i) || text.match(/\/product\/(\d+)\/(\d+)/i);
    return m ? {shopId:m[1],itemId:m[2]} : {shopId:'',itemId:''};
  }
  function extractProduct(){
    const canonical=pickAttr('link[rel="canonical"]','href') || pickAttr('meta[property="og:url"]') || canonicalFromChallenge();
    let title=stripShopeeSuffix(pickAttr('meta[property="og:title"]') || pickAttr('meta[name="title"]') || pickText('[data-testid="pdp-product-title"]') || pickText('.product-briefing h1') || pickText('h1') || findJsonTitle() || document.title);
    if(isGenericTitle(title)) title='';
    let description=pickAttr('meta[property="og:description"]') || pickAttr('meta[name="description"]');
    if(/paste an affiliate product link|free shipping across malaysia/i.test(description)) description='';
    const image=pickAttr('meta[property="og:image"]') || pickAttr('meta[name="twitter:image"]');
    const ids=idsFromUrl(canonical || location.href);
    return {bridgeVersion:1313,payloadType:'product',source:'azobss-local-browser-capture',title,description,image,canonicalUrl:canonical || '',sourceUrl:canonical || location.href,browserUrl:location.href,shopId:ids.shopId,itemId:ids.itemId,capturedAt:new Date().toISOString()};
  }

  function visibleText(){
    try { return String(document.body?.innerText || document.documentElement?.innerText || '').replace(/\u00a0/g,' ').replace(/\r/g,'\n').slice(0,180000); }
    catch { return ''; }
  }
  function detectFinanceKind(raw=''){
    const url=(location.href+' '+document.title+' '+raw.slice(0,30000)).toLowerCase();
    if(/\bs\s*loan\b|spay\s*loan|shopee\s*loan|loan repayment/.test(url)) return 'sloan';
    if(/spay\s*later|paylater|buy now pay later/.test(url)) return 'spaylater';
    return '';
  }
  function normalizeDate(v){
    const s=String(v||'').trim(); if(!s) return '';
    let m=s.match(/(20\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)/); if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
    m=s.match(/([0-3]?\d)[\/\-]([01]?\d)[\/\-](20\d{2})/); if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    const d=new Date(s); if(!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return '';
  }
  function parseFinance(raw, kind){
    const text=String(raw||'').replace(/[ \t]+/g,' ');
    const money=(labels)=>{
      for(const label of labels){
        const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        let m=text.match(new RegExp(esc+'[\\s\\S]{0,90}?(?:RM\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)','i'));
        if(m) return Number(m[1].replace(/,/g,''));
        m=text.match(new RegExp('(?:RM\\s*)?([0-9][0-9,]*(?:\\.[0-9]{1,2})?)[\\s\\S]{0,45}?'+esc,'i'));
        if(m) return Number(m[1].replace(/,/g,''));
      }
      return null;
    };
    const date=(labels)=>{
      for(const label of labels){
        const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const m=text.match(new RegExp(esc+'[\\s:–-]{0,30}([0-3]?\\d[\\/-][01]?\\d[\\/-]20\\d{2}|20\\d{2}[\\/-][01]?\\d[\\/-][0-3]?\\d|[0-3]?\\d\\s+[A-Za-z]{3,9}\\s+20\\d{2})','i'));
        if(m) return normalizeDate(m[1]);
      }
      return '';
    };
    const integer=(labels)=>{
      for(const label of labels){
        const esc=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const m=text.match(new RegExp(esc+'[^0-9]{0,30}(\\d{1,3})','i')); if(m) return parseInt(m[1],10);
      }
      return 0;
    };
    const balance = kind==='spaylater'
      ? money(['Total Outstanding','Outstanding Balance','Total Balance','Jumlah Tertunggak','Baki Tertunggak','Total Amount Due'])
      : money(['Outstanding Balance','Total Outstanding','Outstanding Amount','Remaining Balance','Baki Pinjaman','Loan Balance','Principal Outstanding']);
    const currentDue=money(['Current Bill','Current Due','Amount Due','Total Due','Bil Semasa','Jumlah Bil','Bayaran Bulan Ini','Next Payment Amount','Instalment Amount','Installment Amount']);
    const monthly=money(['Monthly Instalment','Monthly Installment','Instalment Amount','Installment Amount','Monthly Payment','Bayaran Bulanan']);
    const nextDue=date(['Due Date','Next Due','Payment Due Date','Tarikh Akhir Pembayaran','Tarikh Bayaran','Next Payment Due']);
    const remainingInstallments=integer(['Remaining Installment','Remaining Instalment','Installments Remaining','Instalments Remaining','Baki Ansuran']);
    const usable=balance!==null||currentDue!==null||monthly!==null||!!nextDue||remainingInstallments>0;
    if(!usable) return null;
    const core=`${kind}|${balance}|${currentDue}|${monthly}|${nextDue}|${remainingInstallments}|${location.href}`;
    return {bridgeVersion:1313,payloadType:'finance',financeType:kind,balance,currentDue:currentDue||0,monthly:monthly||0,nextDue,remainingInstallments,capturedAt:new Date().toISOString(),captureId:'shopee-'+hash(core),confidence:balance!==null?'browser-good':'browser-partial',source:'shopee-browser-finance',sourceUrl:location.href,pageTitle:clean(document.title)};
  }
  function badge(text,good=true){
    document.getElementById('azobss-shopee-capture-badge')?.remove();
    const d=document.createElement('div'); d.id='azobss-shopee-capture-badge'; d.textContent=text;
    d.style.cssText=`position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:390px;padding:12px 14px;border-radius:12px;background:${good?'#15803d':'#b91c1c'};color:#fff;font:600 14px/1.35 Arial;box-shadow:0 10px 30px rgba(0,0,0,.4)`;
    document.documentElement.appendChild(d); setTimeout(()=>d.remove(),7000);
  }
  function exposeBridge(id, readyEvent, data){
    let el=document.getElementById(id);
    if(!el){ el=document.createElement('meta'); el.id=id; document.documentElement.appendChild(el); }
    el.setAttribute('data-extension','ready');
    if(data) el.setAttribute('data-payload',encodeURIComponent(JSON.stringify(data))); else el.removeAttribute('data-payload');
    document.dispatchEvent(new Event(readyEvent,{bubbles:true}));
  }
  function setupAzobssBridge(key, bridgeId, readyEvent, ackEvent){
    let last='';
    const pump=async()=>{
      const obj=await ext.storage.local.get(key).catch(()=>({})); const data=obj?.[key];
      if(data){ const sig=JSON.stringify(data); if(sig!==last){last=sig;exposeBridge(bridgeId,readyEvent,data);} }
      else exposeBridge(bridgeId,readyEvent,null);
    };
    document.addEventListener(ackEvent,async()=>{ await ext.storage.local.remove(key).catch(()=>{}); last=''; exposeBridge(bridgeId,readyEvent,null); });
    pump(); setInterval(pump,1200);
  }

  if(isAzobssAdmin){ setupAzobssBridge(FINANCE_KEY,FINANCE_BRIDGE,FINANCE_READY,FINANCE_ACK); return; }
  if(isAzobssAffiliate){ setupAzobssBridge(PRODUCT_KEY,PRODUCT_BRIDGE,PRODUCT_READY,PRODUCT_ACK); return; }
  if(!isShopee) return;

  let lastFinanceSig='';
  let financeSeen=false;
  async function captureFinanceIfRelevant(){
    const raw=visibleText(); const kind=detectFinanceKind(raw); if(!kind) return false;
    financeSeen=true; const data=parseFinance(raw,kind); if(!data) return false;
    const sig=JSON.stringify([data.financeType,data.balance,data.currentDue,data.monthly,data.nextDue,data.remainingInstallments,data.sourceUrl]);
    if(sig===lastFinanceSig) return true;
    lastFinanceSig=sig; await ext.storage.local.set({[FINANCE_KEY]:data});
    badge(`AZOBSS: ${kind==='spaylater'?'SPayLater':'SLoan'} finance captured ✅ Kembali ke Admin > Debt & Loan.`,true);
    return true;
  }
  async function captureProductOnce(){
    await new Promise(r=>setTimeout(r,2800));
    if(financeSeen || await captureFinanceIfRelevant()) return;
    let data=extractProduct(); if(!data.title){ await new Promise(r=>setTimeout(r,2200)); if(financeSeen || await captureFinanceIfRelevant()) return; data=extractProduct(); }
    if(!data.title) return;
    await ext.storage.local.set({[PRODUCT_KEY]:data});
    badge('AZOBSS: produk ditangkap ✅ Kembali ke tab AZOBSS; form akan diisi automatik.',true);
  }
  captureProductOnce();
  setInterval(captureFinanceIfRelevant,2200);
})();
