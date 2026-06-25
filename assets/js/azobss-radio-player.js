/* AZOBSS Radio Player - compact floating radio widget
   Patch 365: remove radio search box for cleaner compact panel; keep verified streams.
*/
(function(){
  'use strict';
  if (window.__AZOBSS_RADIO_PLAYER_LOADED__) return;
  window.__AZOBSS_RADIO_PLAYER_LOADED__ = true;

  const STATIONS = [
    // Patch 364: verified Malaysia radio list only. Stations below are kept because they are
    // commonly available via online stream directories; risky/website-only channels were removed.
    // Top channels stay at the top.
    { id:'era', name:'ERA', label:'⭐ ERA', group:'Top Malaysia', country:'MY', query:'ERA', aliases:['ERA FM','ERA Malaysia','Era FM Malaysia'], web:'https://audio1.syok.my/era' },
    { id:'hotfm', name:'Hot FM', label:'⭐ Hot FM', group:'Top Malaysia', country:'MY', query:'Hot FM', aliases:['Hot FM Malaysia','Dengar Hot FM','HotFM'], web:'https://dengar.hotfm.audio/' },
    { id:'sinar', name:'SINAR', label:'⭐ SINAR', group:'Top Malaysia', country:'MY', query:'Sinar FM', aliases:['SINAR','Radio Sinar FM','Sinar Malaysia'], web:'https://audio1.syok.my/sinar' },
    { id:'suria', name:'Suria FM', label:'⭐ Suria FM', group:'Top Malaysia', country:'MY', query:'Suria FM', aliases:['Suria Malaysia'], web:'https://suria.my/' },
    { id:'zayan', name:'ZAYAN', label:'⭐ ZAYAN', group:'Top Malaysia', country:'MY', query:'ZAYAN', aliases:['Zayan FM','Zayan Malaysia'], web:'https://audio1.syok.my/zayan' },
    { id:'ikim', name:'IKIM FM', label:'⭐ IKIM FM', group:'Top Malaysia', country:'MY', query:'IKIM FM', aliases:['Radio IKIM','Radio Ikim FM','IKIMfm'], web:'https://ikimfm.my/' },
    { id:'radioklasik', name:'Radio Klasik', label:'⭐ Radio Klasik', group:'Top Malaysia', country:'MY', query:'Radio Klasik', aliases:['Klasik Nasional','Klasik FM','RTM Klasik'], web:'https://radio.rtm.gov.my/klasik' },
    { id:'gegar', name:'GEGAR', label:'⭐ GEGAR', group:'Top Malaysia', country:'MY', query:'GEGAR', aliases:['THR Gegar','Gegar FM'], web:'https://audio1.syok.my/gegar' },

    { id:'hitz', name:'HITZ', label:'HITZ', group:'English', country:'MY', query:'HITZ', aliases:['Hitz FM','Hitz Malaysia'], web:'https://audio1.syok.my/hitz' },
    { id:'flyfm', name:'Fly FM', label:'Fly FM', group:'English', country:'MY', query:'Fly FM', aliases:['Fly Malaysia'], web:'https://www.flyfm.audio/' },
    { id:'lite', name:'LITE', label:'LITE', group:'English', country:'MY', query:'LITE', aliases:['Lite FM','Lite Malaysia'], web:'https://audio1.syok.my/lite' },
    { id:'mix', name:'MIX', label:'MIX', group:'English', country:'MY', query:'MIX', aliases:['Mix FM','Mix Malaysia'], web:'https://audio1.syok.my/mix' },
    { id:'traxx', name:'TraXX FM', label:'TraXX FM', group:'English', country:'MY', query:'TraXX FM', aliases:['Traxx','RTM Traxx'], web:'https://radio.rtm.gov.my/traxx' },
    { id:'bfm', name:'BFM 89.9', label:'BFM 89.9', group:'English', country:'MY', query:'BFM 89.9', aliases:['BFM Radio','BFM Malaysia'], web:'https://www.bfm.my/' },

    { id:'myfm', name:'MY FM', label:'MY FM', group:'Chinese', country:'MY', query:'MY FM', aliases:['MyFM','MY Malaysia'], web:'https://audio1.syok.my/my' },
    { id:'fm988', name:'988 FM', label:'988 FM', group:'Chinese', country:'MY', query:'988 FM', aliases:['Radio 988','988 Malaysia'], web:'https://www.988.com.my/' },
    { id:'melody', name:'MELODY', label:'MELODY', group:'Chinese', country:'MY', query:'MELODY', aliases:['Melody FM','Melody Malaysia'], web:'https://audio1.syok.my/melody' },
    { id:'goxuan', name:'GOXUAN', label:'GOXUAN', group:'Chinese', country:'MY', query:'GOXUAN', aliases:['Go Xuan','GoXuan FM'], web:'https://audio1.syok.my/goxuan' },
    { id:'aifm', name:'Ai FM', label:'Ai FM', group:'Chinese', country:'MY', query:'Ai FM', aliases:['Radio Ai FM','RTM Ai'], web:'https://radio.rtm.gov.my/ai' },

    { id:'raaga', name:'RAAGA', label:'RAAGA', group:'Tamil / Indian', country:'MY', query:'RAAGA', aliases:['Raaga FM','THR Raaga'], web:'https://audio1.syok.my/raaga' },
    { id:'minnalfm', name:'Minnal FM', label:'Minnal FM', group:'Tamil / Indian', country:'MY', query:'Minnal FM', aliases:['RTM Minnal','Radio Minnal'], web:'https://radio.rtm.gov.my/minnal' },

    { id:'nasionalfm', name:'Nasional FM', label:'Nasional FM', group:'RTM / Negeri', country:'MY', query:'Nasional FM', aliases:['RTM Nasional','Radio Nasional'], web:'https://radio.rtm.gov.my/nasional' },
    { id:'klfm', name:'KL FM', label:'KL FM', group:'RTM / Negeri', country:'MY', query:'KL FM', aliases:['RTM KL FM','Kuala Lumpur FM'], web:'https://radio.rtm.gov.my/klfm' },
    { id:'selangorfm', name:'Selangor FM', label:'Selangor FM', group:'RTM / Negeri', country:'MY', query:'Selangor FM', aliases:['RTM Selangor'], web:'https://radio.rtm.gov.my/selangor' },
    { id:'johorfm', name:'Johor FM', label:'Johor FM', group:'RTM / Negeri', country:'MY', query:'Johor FM', aliases:['RTM Johor'], web:'https://radio.rtm.gov.my/johor' },
    { id:'kedahfm', name:'Kedah FM', label:'Kedah FM', group:'RTM / Negeri', country:'MY', query:'Kedah FM', aliases:['RTM Kedah'], web:'https://radio.rtm.gov.my/kedah' },
    { id:'kelantanfm', name:'Kelantan FM', label:'Kelantan FM', group:'RTM / Negeri', country:'MY', query:'Kelantan FM', aliases:['RTM Kelantan'], web:'https://radio.rtm.gov.my/kelantan' },
    { id:'melakafm', name:'Melaka FM', label:'Melaka FM', group:'RTM / Negeri', country:'MY', query:'Melaka FM', aliases:['RTM Melaka'], web:'https://radio.rtm.gov.my/melaka' },
    { id:'negerifm', name:'Negeri FM', label:'Negeri FM', group:'RTM / Negeri', country:'MY', query:'Negeri FM', aliases:['Negeri Sembilan FM','RTM Negeri'], web:'https://radio.rtm.gov.my/negeri' },
    { id:'pahangfm', name:'Pahang FM', label:'Pahang FM', group:'RTM / Negeri', country:'MY', query:'Pahang FM', aliases:['RTM Pahang'], web:'https://radio.rtm.gov.my/pahang' },
    { id:'perakfm', name:'Perak FM', label:'Perak FM', group:'RTM / Negeri', country:'MY', query:'Perak FM', aliases:['RTM Perak'], web:'https://radio.rtm.gov.my/perak' },
    { id:'mutiarafm', name:'Mutiara FM', label:'Mutiara FM', group:'RTM / Negeri', country:'MY', query:'Mutiara FM', aliases:['RTM Mutiara','Penang Mutiara FM'], web:'https://radio.rtm.gov.my/mutiara' },
    { id:'terengganufm', name:'Terengganu FM', label:'Terengganu FM', group:'RTM / Negeri', country:'MY', query:'Terengganu FM', aliases:['RTM Terengganu'], web:'https://radio.rtm.gov.my/terengganu' },
    { id:'sabahfm', name:'Sabah FM', label:'Sabah FM', group:'Sabah / Sarawak', country:'MY', query:'Sabah FM', aliases:['RTM Sabah FM','Radio Sabah'], web:'https://radio.rtm.gov.my/sabah' },
    { id:'sarawakfm', name:'Sarawak FM', label:'Sarawak FM', group:'Sabah / Sarawak', country:'MY', query:'Sarawak FM', aliases:['RTM Sarawak FM','Radio Sarawak'], web:'https://radio.rtm.gov.my/sarawak' },

    { id:'bernama', name:'Bernama Radio', label:'Bernama Radio', group:'News / Local', country:'MY', query:'Bernama Radio', aliases:['Bernama'], web:'https://bernama.com/radio/' },
    { id:'catsfm', name:'Cats FM', label:'Cats FM', group:'News / Local', country:'MY', query:'Cats FM', aliases:['Cats Radio','Cats FM Malaysia'], web:'https://catsfm.my/' },
    { id:'manisfm', name:'Manis FM', label:'Manis FM', group:'News / Local', country:'MY', query:'Manis FM', aliases:['Manis Radio'], web:'https://www.manis.fm/' },
    { id:'bestfm', name:'Best FM', label:'Best FM', group:'News / Local', country:'MY', query:'Best FM', aliases:['Best 104','Best Radio'], web:'https://bestfm.com.my/' },
    { id:'kool101', name:'Kool 101', label:'Kool 101', group:'News / Local', country:'MY', query:'Kool 101', aliases:['Kool FM','Kool Malaysia'], web:'https://www.kool101.audio/' },
    { id:'eightfm', name:'Eight FM', label:'Eight FM', group:'News / Local', country:'MY', query:'Eight FM', aliases:['8FM','Eight Radio','8 FM Malaysia'], web:'https://www.eight.audio/' },

    { id:'custom', name:'Custom URL', label:'Custom URL', group:'Custom', country:'', query:'', aliases:[], web:'' }
  ];
  const API_BASES = [
    'https://de1.api.radio-browser.info/json/stations/search',
    'https://nl1.api.radio-browser.info/json/stations/search',
    'https://at1.api.radio-browser.info/json/stations/search'
  ];

  const STORE_KEY = 'azobss_radio_player_v1';
  const CACHE_PREFIX = 'azobss_radio_stream_cache_';
  const CACHE_TTL = 24 * 60 * 60 * 1000;
  const BROKEN_KEY = 'azobss_radio_broken_station_v1';
  const BROKEN_TTL = 12 * 60 * 60 * 1000;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function readBrokenMap(){
    try{
      const raw = JSON.parse(localStorage.getItem(BROKEN_KEY) || '{}') || {};
      const now = Date.now();
      let changed = false;
      Object.keys(raw).forEach(k => { if(!raw[k] || now - Number(raw[k] || 0) > BROKEN_TTL){ delete raw[k]; changed = true; } });
      if(changed) localStorage.setItem(BROKEN_KEY, JSON.stringify(raw));
      return raw;
    }catch(e){ return {}; }
  }
  function isStationBroken(id){ return !!readBrokenMap()[id]; }
  function markStationBroken(id){
    if(!id || id === 'custom') return;
    try{ const raw = readBrokenMap(); raw[id] = Date.now(); localStorage.setItem(BROKEN_KEY, JSON.stringify(raw)); }catch(e){}
  }
  function clearStationBroken(id){
    if(!id) return;
    try{ const raw = readBrokenMap(); if(raw[id]){ delete raw[id]; localStorage.setItem(BROKEN_KEY, JSON.stringify(raw)); } }catch(e){}
  }
  function refreshBrokenStationUi(){ try{ window.dispatchEvent(new CustomEvent('azobss-radio-broken-list-changed')); }catch(e){} }
  function renderStationOptions(selected, keyword){
    const q = String(keyword || '').trim().toLowerCase();
    const rows = STATIONS.filter(st => {
      if(st.id !== 'custom' && isStationBroken(st.id)) return false;
      if(!q) return true;
      return [st.name, st.label, st.group, st.query, st.id, ...(Array.isArray(st.aliases) ? st.aliases : [])].join(' ').toLowerCase().includes(q);
    });
    const groups = [];
    rows.forEach(st => {
      const g = st.group || 'Other';
      let bucket = groups.find(x => x.group === g);
      if(!bucket){ bucket = {group:g, items:[]}; groups.push(bucket); }
      bucket.items.push(st);
    });
    if(!groups.length){
      return '<option value="custom">No station found - Custom URL</option>';
    }
    return groups.map(g => `<optgroup label="${esc(g.group)}">${g.items.map(st => `<option value="${esc(st.id)}" ${st.id===selected?'selected':''}>${esc(st.label)}</option>`).join('')}</optgroup>`).join('');
  }
  function readStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||'{}') || {}; } catch(e){ return {}; } }
  function writeStore(v){ try { localStorage.setItem(STORE_KEY, JSON.stringify(v||{})); } catch(e){} }
  function patchStore(fn){
    const s = readStore();
    const next = fn ? (fn(s) || s) : s;
    writeStore(next);
    return next;
  }
  function isInternalAzobssLink(a){
    try{
      if(!a || !a.href) return false;
      const u = new URL(a.href, location.href);
      if(u.origin !== location.origin) return false;
      if(a.target && a.target !== '_self') return false;
      if(a.hasAttribute('download')) return false;
      return true;
    }catch(e){ return false; }
  }
  function readCache(id){
    try{
      const raw = JSON.parse(localStorage.getItem(CACHE_PREFIX + id) || 'null');
      if(!raw || !raw.url || !raw.t || Date.now() - raw.t > CACHE_TTL) return '';
      return raw.url;
    }catch(e){ return ''; }
  }
  function writeCache(id,url){ try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({url, t: Date.now()})); } catch(e){} }

  function injectCss(){
    if(document.getElementById('azobss-radio-player-css')) return;
    const css = `
      .az-radio-player{z-index:10050;font-family:Arial,sans-serif;color:#e5e7eb;display:inline-flex;flex-direction:column;align-items:flex-end;width:auto;max-width:calc(100vw - 16px);flex:0 0 auto;}
      .az-radio-player.az-radio-navbar{position:relative;right:auto;bottom:auto;margin:0 4px 0 0;vertical-align:middle;min-width:28px;max-width:28px;width:28px;align-items:center;}
      .az-radio-player.az-radio-floating{position:fixed;right:8px;bottom:86px;}
      .az-radio-player > .az-radio-pill{align-self:flex-end;}
      .az-radio-player > .az-radio-panel{align-self:flex-end;}
      .az-radio-player *{box-sizing:border-box;}
      .az-radio-pill{border:1px solid rgba(34,197,94,.46);background:rgba(2,6,23,.72);color:#f8fafc;border-radius:50%;width:30px;height:30px;min-width:30px;min-height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;gap:0;font-weight:900;font-size:0;letter-spacing:0;box-shadow:0 4px 10px rgba(0,0,0,.26),0 0 8px rgba(34,197,94,.10),inset 0 0 0 1px rgba(255,255,255,.06);cursor:pointer;overflow:hidden;position:relative;}
      .az-radio-pill img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;filter:saturate(1.08) contrast(1.04) brightness(.98);}
      .az-radio-pill::after{content:'';position:absolute;right:2px;top:2px;width:5px;height:5px;border-radius:50%;background:#64748b;box-shadow:0 0 0 2px rgba(100,116,139,.15);}
      .az-radio-player.is-playing .az-radio-pill::after{background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.22),0 0 9px rgba(34,197,94,.75);}
      .az-radio-pill:hover{border-color:#22c55e;transform:translateY(-1px);box-shadow:0 8px 18px rgba(0,0,0,.34),0 0 14px rgba(34,197,94,.18),inset 0 0 0 1px rgba(255,255,255,.08);}
      .az-radio-player.is-open .az-radio-pill{opacity:0;visibility:hidden;pointer-events:none;min-height:0!important;height:0!important;max-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;transform:translateY(4px) scale(.96);box-shadow:none!important;}
      .az-radio-player.is-open .az-radio-panel{margin-top:0;}
      .az-radio-dot{display:none;}
      .az-radio-panel{width:min(330px,calc(100vw - 24px));margin-top:9px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.97);backdrop-filter:blur(14px);border-radius:18px;padding:12px;box-shadow:0 20px 46px rgba(0,0,0,.5);opacity:0;visibility:hidden;pointer-events:none;max-height:0;overflow:hidden;transform:translateY(6px);transition:opacity .16s ease,transform .16s ease,visibility .16s ease,max-height .16s ease,padding .16s ease,margin .16s ease;}
      .az-radio-player.az-radio-navbar .az-radio-panel{position:absolute;top:calc(100% + 10px);right:0;margin-top:0;}
      .az-radio-player.az-radio-navbar.is-open{min-width:28px;max-width:28px;width:28px;}
      .az-radio-player.az-radio-navbar .az-radio-pill{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;font-size:0;border-radius:50%;}
      .az-radio-player.is-open .az-radio-panel{opacity:1;visibility:visible;pointer-events:auto;max-height:520px;overflow:visible;transform:translateY(0);}
      .az-radio-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
      .az-radio-title{font-size:14px;font-weight:1000;color:#fff;line-height:1.15;}
      .az-radio-sub{font-size:10.5px;color:#94a3b8;font-weight:800;margin-top:2px;}
      .az-radio-x{min-width:82px;height:28px;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:#0f172a;color:#e5e7eb;font-weight:900;cursor:pointer;padding:0 9px;font-size:11.5px;line-height:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;}
      .az-radio-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:8px 0;}.az-radio-row-no-search{margin-top:4px;}
      .az-radio-search{width:100%;border:1px solid rgba(34,197,94,.22);border-radius:12px;background:#020617;color:#f8fafc;min-height:34px;padding:0 10px;font-size:12.5px;font-weight:800;outline:none;margin:7px 0 8px;}
      .az-radio-search::placeholder{color:#64748b;}
      .az-radio-select,.az-radio-custom{width:100%;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:#020617;color:#f8fafc;min-height:36px;padding:0 10px;font-size:13px;font-weight:800;outline:none;}
      .az-radio-select optgroup{background:#020617;color:#93c5fd;font-weight:1000;}
      .az-radio-select option{background:#020617;color:#f8fafc;font-weight:800;}
      .az-radio-random{width:38px;height:36px;border:1px solid rgba(34,197,94,.42);border-radius:12px;background:linear-gradient(135deg,#052e16,#075985);color:#ecfeff;font-size:15px;font-weight:1000;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);}
      .az-radio-random:hover{border-color:#22c55e;filter:brightness(1.08);transform:translateY(-1px);}
      .az-radio-random:disabled{opacity:.55;cursor:not-allowed;transform:none;}
      .az-radio-count{display:block;margin-top:5px;text-align:center;color:#94a3b8;font-size:10.5px;font-weight:900;}
      .az-radio-custom{display:none;margin-top:8px;}
      .az-radio-player.is-custom .az-radio-custom{display:block;}
      .az-radio-btns{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px;}
      .az-radio-btn{border:1px solid rgba(34,197,94,.36);background:#052e16;color:#bbf7d0;border-radius:12px;min-height:36px;padding:0 9px;font-size:12px;font-weight:1000;cursor:pointer;}
      .az-radio-btn.stop{border-color:rgba(248,113,113,.35);background:#450a0a;color:#fecaca;}
      .az-radio-btn:disabled{opacity:.55;cursor:not-allowed;}
      .az-radio-vol{display:flex;align-items:center;gap:8px;margin-top:9px;padding:8px 9px;border-radius:13px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.14);}
      .az-radio-vol span{font-size:12px;font-weight:900;color:#cbd5e1;white-space:nowrap;}
      .az-radio-vol input{width:100%;accent-color:#22c55e;}
      .az-radio-status{min-height:28px;margin-top:9px;border-radius:12px;padding:7px 9px;background:rgba(15,23,42,.82);color:#cbd5e1;font-size:11px;font-weight:800;line-height:1.22;border:1px solid rgba(148,163,184,.14);max-width:100%;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;word-break:break-word;hyphens:auto;overflow:hidden;text-align:left;}
      .az-radio-status.ok{color:#bbf7d0;border-color:rgba(34,197,94,.22);}
      .az-radio-status.err{color:#fecaca;border-color:rgba(248,113,113,.22);}
      .az-radio-note{margin-top:7px;color:#94a3b8;font-size:10px;line-height:1.22;text-align:center;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;}
      @media(max-width:720px){.az-radio-player.az-radio-floating{right:6px;bottom:76px;max-width:calc(100vw - 12px)}.az-radio-player.az-radio-navbar{margin-right:3px;min-width:26px;max-width:26px;width:26px}.az-radio-pill{width:28px;height:28px;min-width:28px;min-height:28px;padding:0;font-size:0;border-radius:50%}.az-radio-pill img{border-radius:50%}.az-radio-player.az-radio-navbar .az-radio-pill{width:26px;height:26px;min-width:26px;min-height:26px;padding:0;font-size:0;border-radius:50%}.az-radio-player.az-radio-navbar .az-radio-panel{position:fixed;top:54px;right:8px;width:min(330px,calc(100vw - 16px));}.az-radio-panel{border-radius:16px;padding:10px}.az-radio-btns{grid-template-columns:1fr 1fr}}
    `;
    const style=document.createElement('style');
    style.id='azobss-radio-player-css';
    style.textContent=css;
    document.head.appendChild(style);
  }

  function build(){
    if(document.getElementById('azobssRadioPlayer')) return;
    injectCss();
    const store=readStore();
    const selected=store.station || 'sinar';
    const volume=Number(store.volume ?? 0.7);
    const el=document.createElement('div');
    el.id='azobssRadioPlayer';
    el.className='az-radio-player';
    el.innerHTML=`
      <button type="button" class="az-radio-pill" id="azRadioToggle" aria-expanded="false" aria-controls="azRadioPanel" aria-label="Open AZOBSS Radio" title="AZOBSS Radio"><span class="az-radio-dot"></span><img src="/assets/img/azobss-radio-headphone.png" alt="Radio"></button>
      <div class="az-radio-panel" id="azRadioPanel" role="dialog" aria-label="AZOBSS Radio Player">
        <div class="az-radio-head">
          <div><div class="az-radio-title">AZOBSS Radio</div><div class="az-radio-sub">Mini online radio player</div></div>
          <button type="button" class="az-radio-x" id="azRadioClose" aria-label="Minimize radio panel" title="Minimize radio panel">− Minimize</button>
        </div>
        <div class="az-radio-row az-radio-row-no-search">
          <select class="az-radio-select" id="azRadioStation" aria-label="Select radio station">${renderStationOptions(selected)}</select>
          <button type="button" class="az-radio-random" id="azRadioRandom" title="Random channel" aria-label="Random channel">🔀</button>
        </div>
        <span class="az-radio-count" id="azRadioCount">${Math.max(0, STATIONS.length - 1)} verified Malaysia channels + Custom URL</span>
        <input class="az-radio-custom" id="azRadioCustom" type="url" placeholder="Paste direct stream URL (.mp3/.aac/.m3u8)" value="${esc(store.customUrl||'')}">
        <div class="az-radio-btns">
          <button type="button" class="az-radio-btn play" id="azRadioPlay">▶ Play</button>
          <button type="button" class="az-radio-btn stop" id="azRadioStop">■ Stop</button>
        </div>
        <div class="az-radio-vol"><span>Volume</span><input id="azRadioVolume" type="range" min="0" max="1" step="0.05" value="${Math.min(1,Math.max(0,volume))}"></div>
        <div class="az-radio-status" id="azRadioStatus">Pilih stesen dan tekan Play.</div>
        <div class="az-radio-note">Jika tukar page, radio akan cuba sambung semula. Jika browser block autoplay, tekan Play sekali.</div>
        <audio id="azRadioAudio" preload="none" crossorigin="anonymous"></audio>
      </div>`;
    const tools = document.getElementById('marketUserTools') || document.querySelector('.market-user-tools');
    const authActions = document.getElementById('siteAuthActions') || document.querySelector('.site-auth-actions');
    const marketRow = (tools && tools.parentElement) || (authActions && authActions.parentElement) || document.querySelector('.market-main-row');
    if(marketRow && (tools || authActions)){
      // Keep radio outside #marketUserTools because that container is hidden for guests.
      // Mount before Register/Login on guest view, and before the username tools after login.
      el.classList.add('az-radio-navbar');
      marketRow.insertBefore(el, authActions || tools);
    }else{
      el.classList.add('az-radio-floating');
      document.body.appendChild(el);
    }
    wire(el);
  }

  function getStation(id){ return STATIONS.find(s=>s.id===id) || STATIONS[0]; }
  async function fetchWithTimeout(url, ms){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), ms || 6500);
    try { return await fetch(url, {signal:ctrl.signal, cache:'no-store'}); }
    finally { clearTimeout(timer); }
  }
  function stationSearchTerms(station){
    const terms = [station.query, station.name, station.label, ...(Array.isArray(station.aliases) ? station.aliases : [])]
      .map(v => String(v || '').replace(/^⭐\s*/, '').trim())
      .filter(Boolean);
    return [...new Set(terms)];
  }
  function stationScore(row, station){
    const stream = String(row?.url_resolved || row?.url || '').trim();
    if(!stream) return -999;
    let score = 0;
    if(/^https:\/\//i.test(stream)) score += 6;
    if(/^http:\/\//i.test(stream)) score -= 2;
    if(row?.lastcheckok === 1 || row?.lastcheckok === true) score += 8;
    if(String(row?.countrycode || '').toUpperCase() === 'MY') score += 5;
    if(String(row?.codec || '').match(/mp3|aac|ogg|opus/i)) score += 3;
    score += Math.min(6, Number(row?.clickcount || 0) / 5000);
    const name = String(row?.name || '').toLowerCase();
    for(const term of stationSearchTerms(station)){
      const t = term.toLowerCase();
      if(t && name === t) score += 8;
      else if(t && name.includes(t)) score += 4;
    }
    return score;
  }
  function pickBest(rows, station){
    const list = (Array.isArray(rows)?rows:[])
      .filter(r => r && (r.url_resolved || r.url))
      .map(r => ({...r, stream:String(r.url_resolved || r.url || '').trim()}))
      .filter(r => /^https?:\/\//i.test(r.stream))
      .filter(r => String(r.countrycode || '').toUpperCase() === 'MY' || !r.countrycode);
    list.sort((a,b)=>stationScore(b, station)-stationScore(a, station));
    return list[0]?.stream || '';
  }
  async function tryDirectStreams(station){
    const direct = Array.isArray(station.streams) ? station.streams : [];
    for(const url of direct){
      const clean = String(url || '').trim();
      if(/^https?:\/\//i.test(clean)){ clearStationBroken(station.id); writeCache(station.id, clean); return clean; }
    }
    return '';
  }
  async function queryRadioBrowser(station, term){
    const variants = [
      {countrycode: station.country || 'MY', name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'16'},
      {country: 'Malaysia', name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'16'},
      {name: term, hidebroken:'true', order:'clickcount', reverse:'true', limit:'16'}
    ];
    let lastErr = '';
    for(const paramsObj of variants){
      const params = new URLSearchParams(paramsObj);
      for(const base of API_BASES){
        try{
          const res = await fetchWithTimeout(base + '?' + params.toString(), 6500);
          if(!res.ok){ lastErr = 'HTTP '+res.status; continue; }
          const rows = await res.json();
          const url = pickBest(rows, station);
          if(url){ clearStationBroken(station.id); writeCache(station.id,url); return url; }
        }catch(e){ lastErr = e?.message || String(e); }
      }
    }
    if(lastErr) station.__lastLookupError = lastErr;
    return '';
  }

  async function resolveStream(station, status){
    if(station.id === 'custom'){
      const url = String(document.getElementById('azRadioCustom')?.value || '').trim();
      if(!url) throw new Error('Sila paste direct stream URL dahulu.');
      return url;
    }
    const cached = readCache(station.id);
    if(cached) return cached;
    if(status) status.textContent = 'Mencari stream radio...';

    // 1) Use direct vetted URL if provided in future edits.
    const direct = await tryDirectStreams(station);
    if(direct) return direct;

    // 2) Try several station aliases against RadioBrowser instead of one rigid name only.
    const terms = stationSearchTerms(station);
    for(const term of terms){
      const url = await queryRadioBrowser(station, term);
      if(url) return url;
    }

    // 3) If a station fails, mark it locally so the dropdown can hide it on the same browser.
    markStationBroken(station.id);
    refreshBrokenStationUi();
    throw new Error('Stream stesen ini tidak aktif sekarang. Stesen itu telah disorok sementara. Pilih channel lain.');
  }

  function wire(root){
    const toggle=root.querySelector('#azRadioToggle');
    const close=root.querySelector('#azRadioClose');
    const search=root.querySelector('#azRadioSearch');
    const select=root.querySelector('#azRadioStation');
    const count=root.querySelector('#azRadioCount');
    const custom=root.querySelector('#azRadioCustom');
    const play=root.querySelector('#azRadioPlay');
    const random=root.querySelector('#azRadioRandom');
    const stop=root.querySelector('#azRadioStop');
    const vol=root.querySelector('#azRadioVolume');
    const audio=root.querySelector('#azRadioAudio');
    const status=root.querySelector('#azRadioStatus');

    function setStatus(text, cls){
      const raw = String(text || '');
      let clean = raw.replace(/\s+/g, ' ').trim();
      // Keep the card neat: never allow technical fetch/error text to overflow the radio panel.
      if(clean.length > 105) clean = clean.slice(0, 102).trim() + '...';
      status.textContent = clean;
      status.title = raw.length > clean.length ? raw : '';
      status.className='az-radio-status '+(cls||'');
    }
    function updateStationOptions(){
      const current = select.value || readStore().station || 'sinar';
      select.innerHTML = renderStationOptions(current, search ? search.value : '');
      if([...select.options].some(o => o.value === current)) select.value = current;
      else if(select.options.length) select.value = select.options[0].value;
      const visible = Math.max(0, [...select.options].filter(o => o.value !== 'custom').length);
      if(count) count.textContent = `${Math.max(0, STATIONS.length - 1)} verified Malaysia channels + Custom URL`;
      syncCustom();
    }
    function getRandomStationId(){
      const opts = [...select.options].map(o => o.value).filter(v => v && v !== 'custom');
      const pool = (opts.length ? opts : STATIONS.map(st => st.id).filter(id => id !== 'custom'));
      if(!pool.length) return 'sinar';
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if(pool.length > 1 && pick === select.value){
        const alt = pool.filter(v => v !== select.value);
        pick = alt[Math.floor(Math.random() * alt.length)] || pick;
      }
      return pick;
    }
    async function playCurrentStation(){
      const station=getStation(select.value);
      try{
        save();
        play.disabled=true;
        if(random) random.disabled=true;
        setStatus('Loading ' + station.label + '...', '');
        const url=await resolveStream(station, status);
        if(audio.src !== url) audio.src=url;
        audio.volume=Number(vol.value)||0.7;
        await audio.play();
        root.classList.add('is-playing');
        markPlaying(url);
        setStatus('Playing: ' + station.label, 'ok');
      }catch(e){
        root.classList.remove('is-playing');
        setStatus(e?.message || 'Radio gagal dimainkan.', 'err');
      }finally{
        play.disabled=false;
        if(random) random.disabled=false;
      }
    }
    function save(extra){
      const s=readStore();
      s.station=select.value;
      s.customUrl=custom.value;
      s.volume=Number(vol.value)||0.7;
      if(extra && typeof extra === 'object') Object.assign(s, extra);
      writeStore(s);
      return s;
    }
    function markPlaying(url){
      save({
        playing:true,
        streamUrl:url || audio.currentSrc || audio.src || '',
        stationName:(getStation(select.value).label || getStation(select.value).name || select.value),
        updatedAt:Date.now()
      });
    }
    function markStopped(){ save({playing:false, streamUrl:'', updatedAt:Date.now()}); }
    function syncCustom(){ root.classList.toggle('is-custom', select.value==='custom'); save(); }
    function setOpen(v){
      root.classList.toggle('is-open', !!v);
      toggle.setAttribute('aria-expanded', v?'true':'false');
      // Do not pause/reload audio when the radio panel is minimized/opened.
      // Only Stop button should stop playback.
      if(!audio.paused && audio.src){ root.classList.add('is-playing'); }
    }

    audio.volume = Math.min(1, Math.max(0, Number(vol.value)||0.7));
    toggle.addEventListener('click', ()=>setOpen(!root.classList.contains('is-open')));
    close.addEventListener('click', ()=>setOpen(false));
    select.addEventListener('change', ()=>{ syncCustom(); setStatus('Pilih stesen dan tekan Play.'); });
    window.addEventListener('azobss-radio-broken-list-changed', ()=>{ updateStationOptions(); });
    custom.addEventListener('change', save);
    custom.addEventListener('input', save);
    vol.addEventListener('input', ()=>{ audio.volume=Number(vol.value)||0; save(); });

    play.addEventListener('click', playCurrentStation);
    if(random) random.addEventListener('click', async ()=>{
      const wasPlaying = audio && !audio.paused && (audio.currentSrc || audio.src);
      const nextId = getRandomStationId();
      select.value = nextId;
      syncCustom();
      const st = getStation(nextId);
      setStatus('Random: ' + (st.label || st.name) + (wasPlaying ? ' — switching...' : ' dipilih. Tekan Play.'), wasPlaying ? '' : 'ok');
      if(wasPlaying) await playCurrentStation();
    });
    stop.addEventListener('click', ()=>{ try{ audio.pause(); audio.removeAttribute('src'); audio.load(); }catch(e){} root.classList.remove('is-playing'); markStopped(); setStatus('Radio dihentikan.',''); });
    audio.addEventListener('playing', ()=>{ root.classList.add('is-playing'); markPlaying(audio.currentSrc || audio.src || ''); });
    audio.addEventListener('pause', ()=>{ root.classList.remove('is-playing'); if(!document.hidden) { /* Stop button handles persistent stopped state. */ } });
    audio.addEventListener('error', ()=>{ root.classList.remove('is-playing'); setStatus('Stream gagal. Pilih stesen lain atau paste Custom URL.', 'err'); });

    // Save playing state before normal AZOBSS page navigation. A full page reload
    // cannot keep the same <audio> element alive, so the next page restores it.
    document.addEventListener('click', (ev)=>{
      const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if(!a || !isInternalAzobssLink(a)) return;
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    }, true);
    window.addEventListener('pagehide', ()=>{
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    });
    window.addEventListener('beforeunload', ()=>{
      if(audio && !audio.paused && (audio.currentSrc || audio.src)) markPlaying(audio.currentSrc || audio.src || '');
    });

    async function restoreIfNeeded(){
      const s = readStore();
      if(!s || !s.playing) return;
      if(Date.now() - Number(s.updatedAt || 0) > 6 * 60 * 60 * 1000) return;
      try{
        if(s.station && [...select.options].some(o => o.value === s.station)) select.value = s.station;
        if(s.customUrl) custom.value = s.customUrl;
        if(s.volume != null){ vol.value = Math.min(1, Math.max(0, Number(s.volume)||0.7)); audio.volume=Number(vol.value)||0.7; }
        syncCustom();
        const station=getStation(select.value);
        const url=s.streamUrl || await resolveStream(station, status);
        if(url && audio.src !== url) audio.src=url;
        setStatus('Menyambung radio semula...', '');
        await audio.play();
        root.classList.add('is-playing');
        markPlaying(url);
        setStatus('Playing: ' + (station.label || s.stationName || 'Radio'), 'ok');
      }catch(e){
        root.classList.remove('is-playing');
        setStatus('Radio sedia untuk sambung. Tekan Play sekali.', 'err');
      }
    }
    updateStationOptions();
    setTimeout(restoreIfNeeded, 350);
  }

  function init(){
    if(!document.body) return setTimeout(init, 50);
    build();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
