/* AZOBSS Radio Player - compact floating radio widget
   Patch 347: adds a lightweight radio player with Radio Browser resolving + custom stream URL.
*/
(function(){
  'use strict';
  if (window.__AZOBSS_RADIO_PLAYER_LOADED__) return;
  window.__AZOBSS_RADIO_PLAYER_LOADED__ = true;

  const STATIONS = [
    // Top / paling popular di Malaysia diletakkan dahulu.
    { id:'era', name:'ERA', label:'⭐ ERA', query:'ERA', country:'MY', group:'Top Malaysia', web:'https://audio1.syok.my/era' },
    { id:'hotfm', name:'Hot FM', label:'⭐ Hot FM', query:'Hot FM', country:'MY', group:'Top Malaysia', web:'https://www.hotfm.audio/' },
    { id:'sinar', name:'SINAR', label:'⭐ SINAR', query:'SINAR', country:'MY', group:'Top Malaysia', web:'https://audio1.syok.my/sinar' },
    { id:'suria', name:'Suria FM', label:'⭐ Suria FM', query:'Suria FM', country:'MY', group:'Top Malaysia', web:'https://dengar.suria.my/' },
    { id:'zayan', name:'ZAYAN', label:'⭐ ZAYAN', query:'ZAYAN', country:'MY', group:'Top Malaysia', web:'https://audio1.syok.my/zayan' },
    { id:'ikim', name:'IKIM FM', label:'⭐ IKIM FM', query:'IKIM FM', country:'MY', group:'Top Malaysia', web:'https://ikimfm.my/' },
    { id:'radioklasik', name:'Radio Klasik', label:'⭐ Radio Klasik', query:'Radio Klasik', country:'MY', group:'Top Malaysia', web:'https://radio.rtm.gov.my/klasik' },
    { id:'gegar', name:'GEGAR', label:'⭐ GEGAR', query:'GEGAR', country:'MY', group:'Top Malaysia', web:'https://audio1.syok.my/gegar' },

    { id:'hitz', name:'HITZ', label:'HITZ', query:'HITZ', country:'MY', group:'English / Astro', web:'https://audio1.syok.my/hitz' },
    { id:'flyfm', name:'Fly FM', label:'Fly FM', query:'Fly FM', country:'MY', group:'English / Media Prima', web:'https://www.flyfm.audio/' },
    { id:'lite', name:'LITE', label:'LITE', query:'LITE', country:'MY', group:'English / Astro', web:'https://audio1.syok.my/lite' },
    { id:'mix', name:'MIX', label:'MIX', query:'MIX', country:'MY', group:'English / Astro', web:'https://audio1.syok.my/mix' },
    { id:'traxx', name:'TraXX FM', label:'TraXX FM', query:'TraXX FM', country:'MY', group:'English / RTM', web:'https://radio.rtm.gov.my/traxx' },
    { id:'bfm', name:'BFM 89.9', label:'BFM 89.9', query:'BFM 89.9', country:'MY', group:'English / Business', web:'https://www.bfm.my/' },

    { id:'myfm', name:'MY FM', label:'MY FM', query:'MY FM', country:'MY', group:'Chinese', web:'https://audio1.syok.my/my' },
    { id:'fm988', name:'988 FM', label:'988 FM', query:'988 FM', country:'MY', group:'Chinese', web:'https://www.988.com.my/' },
    { id:'melody', name:'MELODY', label:'MELODY', query:'MELODY', country:'MY', group:'Chinese', web:'https://audio1.syok.my/melody' },
    { id:'goxuan', name:'GOXUAN', label:'GOXUAN', query:'GOXUAN', country:'MY', group:'Chinese', web:'https://audio1.syok.my/goxuan' },
    { id:'aifm', name:'Ai FM', label:'Ai FM', query:'Ai FM', country:'MY', group:'Chinese / RTM', web:'https://radio.rtm.gov.my/ai' },
    { id:'cityplus', name:'CityPlus FM', label:'CityPlus FM', query:'CityPlus FM', country:'MY', group:'Chinese', web:'https://cityplusfm.my/' },

    { id:'raaga', name:'RAAGA', label:'RAAGA', query:'RAAGA', country:'MY', group:'Tamil / Indian', web:'https://audio1.syok.my/raaga' },
    { id:'minnalfm', name:'Minnal FM', label:'Minnal FM', query:'Minnal FM', country:'MY', group:'Tamil / Indian', web:'https://radio.rtm.gov.my/minnal' },

    { id:'era_sabah', name:'ERA Sabah', label:'ERA Sabah', query:'ERA Sabah', country:'MY', group:'Sabah / Sarawak', web:'https://audio1.syok.my/erasabah' },
    { id:'era_sarawak', name:'ERA Sarawak', label:'ERA Sarawak', query:'ERA Sarawak', country:'MY', group:'Sabah / Sarawak', web:'https://audio1.syok.my/erasarawak' },
    { id:'sabahfm', name:'Sabah FM', label:'Sabah FM', query:'Sabah FM', country:'MY', group:'Sabah / Sarawak', web:'https://radio.rtm.gov.my/sabah' },
    { id:'sabahvfm', name:'Sabah V FM', label:'Sabah V FM', query:'Sabah V FM', country:'MY', group:'Sabah / Sarawak', web:'https://radio.rtm.gov.my/sabahvfm' },
    { id:'labuanfm', name:'Labuan FM', label:'Labuan FM', query:'Labuan FM', country:'MY', group:'Sabah / Sarawak', web:'https://radio.rtm.gov.my/labuan' },
    { id:'sarawakfm', name:'Sarawak FM', label:'Sarawak FM', query:'Sarawak FM', country:'MY', group:'Sabah / Sarawak', web:'https://radio.rtm.gov.my/sarawak' },
    { id:'waifm', name:'Wai FM', label:'Wai FM', query:'Wai FM', country:'MY', group:'Sabah / Sarawak', web:'https://radio.rtm.gov.my/wai' },
    { id:'catsfm', name:'Cats FM', label:'Cats FM', query:'Cats FM', country:'MY', group:'Sabah / Sarawak', web:'https://catsfm.my/' },
    { id:'kupikupifm', name:'Kupi-Kupi FM', label:'Kupi-Kupi FM', query:'Kupi-Kupi FM', country:'MY', group:'Sabah / Sarawak', web:'https://kupikupifm.my/' },

    { id:'nasionalfm', name:'Nasional FM', label:'Nasional FM', query:'Nasional FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/nasional' },
    { id:'selangorfm', name:'Selangor FM', label:'Selangor FM', query:'Selangor FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/selangor' },
    { id:'klfm', name:'KL FM', label:'KL FM', query:'KL FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/klfm' },
    { id:'johorfm', name:'Johor FM', label:'Johor FM', query:'Johor FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/johor' },
    { id:'kedahfm', name:'Kedah FM', label:'Kedah FM', query:'Kedah FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/kedah' },
    { id:'kelantanfm', name:'Kelantan FM', label:'Kelantan FM', query:'Kelantan FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/kelantan' },
    { id:'melakafm', name:'Melaka FM', label:'Melaka FM', query:'Melaka FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/melaka' },
    { id:'negerifm', name:'Negeri FM', label:'Negeri FM', query:'Negeri FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/negeri' },
    { id:'pahangfm', name:'Pahang FM', label:'Pahang FM', query:'Pahang FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/pahang' },
    { id:'perakfm', name:'Perak FM', label:'Perak FM', query:'Perak FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/perak' },
    { id:'perlisfm', name:'Perlis FM', label:'Perlis FM', query:'Perlis FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/perlis' },
    { id:'mutiarafm', name:'Mutiara FM', label:'Mutiara FM', query:'Mutiara FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/mutiara' },
    { id:'terengganufm', name:'Terengganu FM', label:'Terengganu FM', query:'Terengganu FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/terengganu' },
    { id:'asyikfm', name:'Asyik FM', label:'Asyik FM', query:'Asyik FM', country:'MY', group:'RTM Nasional / Negeri', web:'https://radio.rtm.gov.my/asyik' },

    { id:'bernama', name:'Bernama Radio', label:'Bernama Radio', query:'Bernama Radio', country:'MY', group:'News / Talk / Local', web:'https://bernama.com/radio/' },
    { id:'buletinfm', name:'Buletin FM', label:'Buletin FM', query:'Buletin FM', country:'MY', group:'News / Talk / Local', web:'https://www.buletinfm.audio/' },
    { id:'molekfm', name:'Molek FM', label:'Molek FM', query:'Molek FM', country:'MY', group:'News / Talk / Local', web:'https://www.molekfm.audio/' },
    { id:'manisfm', name:'Manis FM', label:'Manis FM', query:'Manis FM', country:'MY', group:'News / Talk / Local', web:'https://www.manis.fm/' },
    { id:'bestfm', name:'Best FM', label:'Best FM', query:'Best FM', country:'MY', group:'News / Talk / Local', web:'https://bestfm.com.my/' },
    { id:'kool101', name:'Kool 101', label:'Kool 101', query:'Kool 101', country:'MY', group:'News / Talk / Local', web:'https://www.kool101.audio/' },
    { id:'eightfm', name:'Eight FM', label:'Eight FM', query:'Eight FM', country:'MY', group:'News / Talk / Local', web:'https://www.eight.audio/' },

    { id:'custom', name:'Custom URL', label:'Custom URL', query:'', country:'', group:'Custom', web:'' }
  ];
  const API_BASES = [
    'https://de1.api.radio-browser.info/json/stations/search',
    'https://nl1.api.radio-browser.info/json/stations/search',
    'https://at1.api.radio-browser.info/json/stations/search'
  ];

  const STORE_KEY = 'azobss_radio_player_v1';
  const CACHE_PREFIX = 'azobss_radio_stream_cache_';
  const CACHE_TTL = 24 * 60 * 60 * 1000;

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function readStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY)||'{}') || {}; } catch(e){ return {}; } }
  function writeStore(v){ try { localStorage.setItem(STORE_KEY, JSON.stringify(v||{})); } catch(e){} }
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
      .az-radio-player{position:fixed;right:14px;bottom:86px;z-index:3999;font-family:Arial,sans-serif;color:#e5e7eb;}
      .az-radio-player *{box-sizing:border-box;}
      .az-radio-pill{border:1px solid rgba(34,197,94,.48);background:linear-gradient(135deg,#06131f,#0f172a);color:#f8fafc;border-radius:999px;min-height:38px;padding:0 13px;display:inline-flex;align-items:center;gap:7px;font-weight:900;font-size:13px;letter-spacing:.02em;box-shadow:0 12px 28px rgba(0,0,0,.38),inset 0 0 0 1px rgba(255,255,255,.05);cursor:pointer;}
      .az-radio-pill:hover{border-color:#22c55e;color:#bbf7d0;transform:translateY(-1px);}
      .az-radio-dot{width:7px;height:7px;border-radius:50%;background:#64748b;box-shadow:0 0 0 3px rgba(100,116,139,.18);}
      .az-radio-player.is-playing .az-radio-dot{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.18),0 0 14px rgba(34,197,94,.8);}
      .az-radio-panel{display:none;width:min(330px,calc(100vw - 24px));margin-top:9px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.97);backdrop-filter:blur(14px);border-radius:18px;padding:12px;box-shadow:0 20px 46px rgba(0,0,0,.5);}
      .az-radio-player.is-open .az-radio-panel{display:block;}
      .az-radio-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;}
      .az-radio-title{font-size:14px;font-weight:1000;color:#fff;line-height:1.15;}
      .az-radio-sub{font-size:10.5px;color:#94a3b8;font-weight:800;margin-top:2px;}
      .az-radio-x{width:28px;height:28px;border:1px solid rgba(148,163,184,.28);border-radius:10px;background:#0f172a;color:#e5e7eb;font-weight:900;cursor:pointer;}
      .az-radio-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin:8px 0;}
      .az-radio-select,.az-radio-custom{width:100%;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:#020617;color:#f8fafc;min-height:36px;padding:0 10px;font-size:13px;font-weight:800;outline:none;}
      .az-radio-custom{display:none;margin-top:8px;}
      .az-radio-player.is-custom .az-radio-custom{display:block;}
      .az-radio-btns{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:8px;}
      .az-radio-btn{border:1px solid rgba(34,197,94,.36);background:#052e16;color:#bbf7d0;border-radius:12px;min-height:36px;padding:0 9px;font-size:12px;font-weight:1000;cursor:pointer;}
      .az-radio-btn.stop{border-color:rgba(248,113,113,.35);background:#450a0a;color:#fecaca;}
      .az-radio-btn.open{border-color:rgba(56,189,248,.35);background:#082f49;color:#bae6fd;}
      .az-radio-btn:disabled{opacity:.55;cursor:not-allowed;}
      .az-radio-vol{display:flex;align-items:center;gap:8px;margin-top:9px;padding:8px 9px;border-radius:13px;background:rgba(15,23,42,.78);border:1px solid rgba(148,163,184,.14);}
      .az-radio-vol span{font-size:12px;font-weight:900;color:#cbd5e1;white-space:nowrap;}
      .az-radio-vol input{width:100%;accent-color:#22c55e;}
      .az-radio-status{min-height:28px;margin-top:9px;border-radius:12px;padding:7px 9px;background:rgba(15,23,42,.82);color:#cbd5e1;font-size:11.5px;font-weight:800;line-height:1.25;border:1px solid rgba(148,163,184,.14);}
      .az-radio-status.ok{color:#bbf7d0;border-color:rgba(34,197,94,.22);}
      .az-radio-status.err{color:#fecaca;border-color:rgba(248,113,113,.22);}
      .az-radio-note{margin-top:7px;color:#94a3b8;font-size:10.5px;line-height:1.25;text-align:center;}
      @media(max-width:720px){.az-radio-player{right:10px;bottom:76px}.az-radio-pill{min-height:36px;font-size:12px;padding:0 11px}.az-radio-panel{border-radius:16px;padding:10px}.az-radio-btns{grid-template-columns:1fr 1fr}.az-radio-btn.open{grid-column:1 / -1}}
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
      <button type="button" class="az-radio-pill" id="azRadioToggle" aria-expanded="false" aria-controls="azRadioPanel"><span class="az-radio-dot"></span><span>📻 Radio</span></button>
      <div class="az-radio-panel" id="azRadioPanel" role="dialog" aria-label="AZOBSS Radio Player">
        <div class="az-radio-head">
          <div><div class="az-radio-title">AZOBSS Radio</div><div class="az-radio-sub">Mini online radio player</div></div>
          <button type="button" class="az-radio-x" id="azRadioClose" aria-label="Close radio player">×</button>
        </div>
        <div class="az-radio-row">
          <select class="az-radio-select" id="azRadioStation" aria-label="Select radio station">${STATIONS.map(s=>`<option value="${esc(s.id)}" ${s.id===selected?'selected':''}>${esc(s.label)}</option>`).join('')}</select>
          <span class="az-radio-dot" aria-hidden="true"></span>
        </div>
        <input class="az-radio-custom" id="azRadioCustom" type="url" placeholder="Paste direct stream URL (.mp3/.aac/.m3u8)" value="${esc(store.customUrl||'')}">
        <div class="az-radio-btns">
          <button type="button" class="az-radio-btn play" id="azRadioPlay">▶ Play</button>
          <button type="button" class="az-radio-btn stop" id="azRadioStop">■ Stop</button>
          <button type="button" class="az-radio-btn open" id="azRadioOpen">Open</button>
        </div>
        <div class="az-radio-vol"><span>Volume</span><input id="azRadioVolume" type="range" min="0" max="1" step="0.05" value="${Math.min(1,Math.max(0,volume))}"></div>
        <div class="az-radio-status" id="azRadioStatus">Pilih stesen dan tekan Play.</div>
        <div class="az-radio-note">Jika stream tidak boleh autoplay, tekan Play sekali lagi atau guna butang Open.</div>
        <audio id="azRadioAudio" preload="none" crossorigin="anonymous"></audio>
      </div>`;
    document.body.appendChild(el);
    wire(el);
  }

  function getStation(id){ return STATIONS.find(s=>s.id===id) || STATIONS[0]; }
  async function fetchWithTimeout(url, ms){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), ms || 6500);
    try { return await fetch(url, {signal:ctrl.signal, cache:'no-store'}); }
    finally { clearTimeout(timer); }
  }
  function pickBest(rows){
    const list = (Array.isArray(rows)?rows:[])
      .filter(r => r && (r.url_resolved || r.url))
      .map(r => ({...r, stream:String(r.url_resolved || r.url || '').trim()}));
    const https = list.filter(r => /^https:\/\//i.test(r.stream));
    const ok = https.length ? https : list;
    ok.sort((a,b)=>{
      const ap=(String(a.codec||'').match(/mp3|aac|ogg/i)?2:0)+(Number(a.clickcount||0)/100000)+(a.lastcheckok?2:0);
      const bp=(String(b.codec||'').match(/mp3|aac|ogg/i)?2:0)+(Number(b.clickcount||0)/100000)+(b.lastcheckok?2:0);
      return bp-ap;
    });
    return ok[0]?.stream || '';
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
    const params = new URLSearchParams({
      countrycode: station.country || 'MY',
      name: station.query || station.name,
      hidebroken: 'true',
      order: 'clickcount',
      reverse: 'true',
      limit: '8'
    });
    let lastErr='';
    for(const base of API_BASES){
      try{
        const res = await fetchWithTimeout(base + '?' + params.toString(), 6500);
        if(!res.ok) { lastErr = 'HTTP '+res.status; continue; }
        const rows = await res.json();
        const url = pickBest(rows);
        if(url){ writeCache(station.id,url); return url; }
      }catch(e){ lastErr = e?.message || String(e); }
    }
    throw new Error('Stream tidak dijumpai. Cuba Open station page.' + (lastErr ? ' (' + lastErr + ')' : ''));
  }

  function wire(root){
    const toggle=root.querySelector('#azRadioToggle');
    const close=root.querySelector('#azRadioClose');
    const select=root.querySelector('#azRadioStation');
    const custom=root.querySelector('#azRadioCustom');
    const play=root.querySelector('#azRadioPlay');
    const stop=root.querySelector('#azRadioStop');
    const open=root.querySelector('#azRadioOpen');
    const vol=root.querySelector('#azRadioVolume');
    const audio=root.querySelector('#azRadioAudio');
    const status=root.querySelector('#azRadioStatus');

    function setStatus(text, cls){ status.textContent=text; status.className='az-radio-status '+(cls||''); }
    function save(){ const s=readStore(); s.station=select.value; s.customUrl=custom.value; s.volume=Number(vol.value)||0.7; writeStore(s); }
    function syncCustom(){ root.classList.toggle('is-custom', select.value==='custom'); save(); }
    function setOpen(v){ root.classList.toggle('is-open', !!v); toggle.setAttribute('aria-expanded', v?'true':'false'); }

    audio.volume = Math.min(1, Math.max(0, Number(vol.value)||0.7));
    toggle.addEventListener('click', ()=>setOpen(!root.classList.contains('is-open')));
    close.addEventListener('click', ()=>setOpen(false));
    select.addEventListener('change', ()=>{ syncCustom(); setStatus('Pilih stesen dan tekan Play.'); });
    custom.addEventListener('change', save);
    custom.addEventListener('input', save);
    vol.addEventListener('input', ()=>{ audio.volume=Number(vol.value)||0; save(); });

    play.addEventListener('click', async ()=>{
      const station=getStation(select.value);
      try{
        save();
        play.disabled=true;
        setStatus('Loading ' + station.label + '...', '');
        const url=await resolveStream(station, status);
        if(audio.src !== url) audio.src=url;
        audio.volume=Number(vol.value)||0.7;
        await audio.play();
        root.classList.add('is-playing');
        setStatus('Playing: ' + station.label, 'ok');
      }catch(e){
        root.classList.remove('is-playing');
        setStatus(e?.message || 'Radio gagal dimainkan.', 'err');
      }finally{
        play.disabled=false;
      }
    });
    stop.addEventListener('click', ()=>{ try{ audio.pause(); audio.removeAttribute('src'); audio.load(); }catch(e){} root.classList.remove('is-playing'); setStatus('Radio dihentikan.',''); });
    open.addEventListener('click', ()=>{
      const st=getStation(select.value);
      const url = st.id==='custom' ? (custom.value || '') : (st.web || 'https://audio1.syok.my/');
      if(url) window.open(url, '_blank', 'noopener');
    });
    audio.addEventListener('playing', ()=>root.classList.add('is-playing'));
    audio.addEventListener('pause', ()=>root.classList.remove('is-playing'));
    audio.addEventListener('error', ()=>{ root.classList.remove('is-playing'); setStatus('Stream gagal dimainkan. Cuba pilih stesen lain atau tekan Open.', 'err'); });
    syncCustom();
  }

  function init(){
    if(!document.body) return setTimeout(init, 50);
    build();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
