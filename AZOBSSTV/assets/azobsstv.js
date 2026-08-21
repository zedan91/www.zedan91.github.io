(()=>{'use strict';
const API_BASE=(window.AZOBSSTV_API_BASE||'https://azobss-backend.onrender.com/api/azobsstv').replace(/\/$/,'');
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const state={config:null,channels:[],filtered:[],trustedDemoUrls:new Set(),favorites:new Set(),recent:[],authUser:null,current:null,tab:'live',hls:null,dash:null,epg:new Map(),heartbeatTimer:null,noticeTimer:null,deferredInstall:null,videoCheckTimer:null,officialResizeObserver:null,heroSideResizeObserver:null,officialWide:false,scheduleRequestId:0,scheduleCache:new Map(),animeDetail:null,movieDetail:null,animePage:1,animeEpisodeSearch:'',animeEmbedRequestId:0,animeFrameTimer:null,avSyncTimer:null,avSyncCooldown:0,avStallTimer:null,hiddenAt:0,avOfficialReloadId:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function readJsonStorage(key){for(const store of [sessionStorage,localStorage]){try{const raw=store.getItem(key);if(raw){const v=JSON.parse(raw);if(v&&typeof v==='object')return v}}catch{}}return null}
function getSignedInUser(){try{const live=typeof window.getSavedUser==='function'?window.getSavedUser():null;if(live&&String(live.uid||live.usernameKey||live.username||live.name||live.email||'').trim())return live}catch{}const u=readJsonStorage('azobssCurrentUser')||readJsonStorage('azobssUser')||readJsonStorage('azobss_user')||readJsonStorage('currentUser');if(!u)return null;const key=String(u.uid||u.usernameKey||u.username||u.name||u.email||'').trim();if(!key)return null;let flag=false;for(const store of [sessionStorage,localStorage]){try{if(store.getItem('azobssLoggedIn')==='1')flag=true}catch{}}return flag?u:null}
function userStorageId(user){const raw=String(user?.uid||user?.usernameKey||user?.username||user?.name||user?.email||'').trim().toLowerCase();return raw.replace(/[^a-z0-9_.@-]+/g,'_')}
function userStoreKey(kind,user=state.authUser){const id=userStorageId(user);return id?`azobsstv_${kind}:${id}`:''}
function isSignedIn(){return !!state.authUser}
function channelKey(c){if(!c)return'';const raw=String(c.officialUrl||c.sourcePage||c.url||'').trim();try{const u=new URL(raw,location.href);const m=u.pathname.match(/^\/channel\/([^/?#]+)/i);if(m&&/(?:^|\.)mana2\.my$/i.test(u.hostname))return'mana2:'+decodeURIComponent(m[1]).trim().toLowerCase();u.hash='';u.search='';return'url:'+u.href.replace(/\/$/,'').toLowerCase()}catch{}const id=String(c.id||c.slug||'').trim().toLowerCase();return id?'id:'+id:'name:'+String(c.name||'').trim().toLowerCase()}
function normalizeLibraryValue(value){const raw=String(value||'').trim();if(!raw)return'';if(/^(?:mana2|url|id|name):/i.test(raw))return raw.toLowerCase();try{const u=new URL(raw,location.href);const m=u.pathname.match(/^\/channel\/([^/?#]+)/i);if(m&&/(?:^|\.)mana2\.my$/i.test(u.hostname))return'mana2:'+decodeURIComponent(m[1]).trim().toLowerCase();u.hash='';u.search='';return'url:'+u.href.replace(/\/$/,'').toLowerCase()}catch{return raw.toLowerCase()}}
function normalizeLibraryArray(values,limit=300){const out=[];const seen=new Set();for(const value of Array.isArray(values)?values:[]){const key=normalizeLibraryValue(value);if(!key||seen.has(key))continue;seen.add(key);out.push(key);if(out.length>=limit)break}return out}
let libraryCloudSaveTimer=null;
function loadUserLibrary(){state.authUser=getSignedInUser();state.favorites=new Set();state.recent=[];try{localStorage.removeItem('azobsstv_favorites');localStorage.removeItem('azobsstv_recent')}catch{}if(!state.authUser)return;try{const fk=userStoreKey('favorites'),rk=userStoreKey('recent');const fav=normalizeLibraryArray(JSON.parse(localStorage.getItem(fk)||'[]'),500);const rec=normalizeLibraryArray(JSON.parse(localStorage.getItem(rk)||'[]'),60);state.favorites=new Set(fav);state.recent=rec}catch{state.favorites=new Set();state.recent=[]}}
function saveLocalUserLibrary(){if(!isSignedIn())return false;try{localStorage.setItem(userStoreKey('favorites'),JSON.stringify([...state.favorites]));localStorage.setItem(userStoreKey('recent'),JSON.stringify(state.recent));return true}catch{return false}}
async function firebaseHeaders(force=false){try{if(typeof window.azobssGetFirebaseAuthHeaders==='function')return await window.azobssGetFirebaseAuthHeaders(!!force)}catch{}return{}}
async function loadCloudUserLibrary(force=false){if(!isSignedIn())return false;try{let headers=Object.assign({'Accept':'application/json'},await firebaseHeaders(force));if(!headers.Authorization)return false;let r=await fetch(API_BASE+'/library',{method:'GET',headers,cache:'no-store'});if((r.status===401||r.status===403)&&!force)return loadCloudUserLibrary(true);const data=await r.json().catch(()=>null);if(!r.ok||!data?.ok)return false;const cloudFav=normalizeLibraryArray(data.favorites,500),cloudRec=normalizeLibraryArray(data.recent,60);const localFav=[...state.favorites],localRec=[...state.recent];const fav=normalizeLibraryArray([...cloudFav,...localFav],500),rec=normalizeLibraryArray([...localRec,...cloudRec],60);state.favorites=new Set(fav);state.recent=rec;saveLocalUserLibrary();if(state.tab==='favorites'||state.tab==='recent')render();else{renderChannelRail();$('#favCurrentBtn')?.classList.toggle('active',!!(state.current&&state.favorites.has(channelKey(state.current))))}updateFavoriteAvailability();if(fav.length!==cloudFav.length||rec.length!==cloudRec.length)setTimeout(()=>pushCloudUserLibrary(false),80);return true}catch(e){console.warn('AZOBSSTV cloud library load fallback:',e?.message||e);return false}}
async function pushCloudUserLibrary(force=false){if(!isSignedIn())return false;try{let headers=Object.assign({'Content-Type':'application/json','Accept':'application/json'},await firebaseHeaders(force));if(!headers.Authorization)return false;let r=await fetch(API_BASE+'/library',{method:'PUT',headers,body:JSON.stringify({favorites:[...state.favorites],recent:state.recent})});if((r.status===401||r.status===403)&&!force)return pushCloudUserLibrary(true);return r.ok}catch(e){console.warn('AZOBSSTV cloud library save fallback:',e?.message||e);return false}}
function saveUserLibrary(){if(!isSignedIn())return false;const ok=saveLocalUserLibrary();clearTimeout(libraryCloudSaveTimer);libraryCloudSaveTimer=setTimeout(()=>{pushCloudUserLibrary(false)},120);return ok}
function requireSignIn(feature='Favorites'){if(isSignedIn())return true;alert(`Please sign in to your AZOBSS account to save ${feature}.`);return false}
function syncAuthLibrary(){const before=userStorageId(state.authUser);const next=getSignedInUser();const after=userStorageId(next);if(before===after&&!!state.authUser===!!next){state.authUser=next||state.authUser;updateFavoriteAvailability();if(state.authUser)setTimeout(()=>loadCloudUserLibrary(false),50);return}loadUserLibrary();if(state.tab==='favorites'||state.tab==='recent')render();else{renderChannelRail();$('#favCurrentBtn')?.classList.toggle('active',!!(state.current&&state.favorites.has(channelKey(state.current))))}updateFavoriteAvailability();if(state.authUser)setTimeout(()=>loadCloudUserLibrary(false),50)}
function updateFavoriteAvailability(){const signed=isSignedIn();const current=$('#favCurrentBtn');if(current){current.classList.toggle('auth-locked',!signed);current.setAttribute('aria-disabled',signed?'false':'true');current.title=signed?'Favorite':'Sign in to save Favorite'}$$('.fav-mini,.channel-rail-fav').forEach(btn=>{btn.classList.toggle('auth-locked',!signed);btn.setAttribute('aria-disabled',signed?'false':'true');btn.title=signed?'Favorite':'Sign in to save Favorite'})}
function channelBadgeText(name){
  const raw=String(name||'TV').trim();
  const known={'TV5 ENJOY TV':'TV5','FREE MOVIES':'FM','MySports':'MS','BERNAMA':'BER','The Indonesia Channel':'TIC','CNA':'CNA','Al JAZEERA ENGLISH HD':'AJE','EURONEWS':'EN','ARIRANG':'ARI','TaiwanPlus':'T+','NHK WORLD':'NHK','RT International':'RT','Al JAZEERA ARABIC HD':'AJA','SELANGOR TV':'STV','TVIKIM':'IKIM','SIARA TV':'SIARA','BORNEO TV':'BTV','USIM TV':'USIM','TV ALHIJRAH':'ALH','TVS':'TVS','BERITA RTM':'RTM','SUKAN+':'S+','TV OKEY':'OKEY','TV1':'TV1','TV2':'TV2'};
  if(known[raw])return known[raw];
  const words=raw.replace(/[^A-Za-z0-9+ ]/g,' ').split(/\s+/).filter(Boolean);
  if(words.length===1)return words[0].slice(0,5).toUpperCase();
  return words.map(w=>w[0]).join('').slice(0,5).toUpperCase()||'TV';
}

// v1013: keep known Live TV artwork local so an online catalogue refresh cannot
// replace working thumbnails with empty/hotlink-blocked remote logo URLs.
const LOCAL_LIVE_ARTWORK={
  'tv1':'./assets/channel-icons/tv1-card.png',
  'tv2':'./assets/channel-icons/tv2-card.png',
  'tv-okey':'./assets/channel-icons/tv-okey-card.jpg',
  'sukan-rtm':'./assets/channel-icons/sukan-rtm-card.jpg',
  'berita-rtm':'./assets/channel-icons/berita-rtm-card.svg',
  'tvs':'./assets/channel-icons/tvs-card.svg',
  'tv-alhijrah':'./assets/channel-icons/tv-alhijrah-card.png',
  'sukma-1':'./assets/channel-icons/sukma-1-card.svg',
  'sukma-2':'./assets/channel-icons/sukma-2-card.svg',
  'free-movies':'./assets/channel-icons/free-movies-card.svg',
  'mysport':'./assets/channel-icons/mysports-card.svg',
  'bernama':'./assets/channel-icons/bernama-card.png',
  'cna':'./assets/channel-icons/cna-card.png',
  'the-indonesia-channel':'./assets/channel-icons/indonesia-channel-card.png',
  'al-jazeera-english-hd':'./assets/channel-icons/aljazeera-card.png',
  'arirang':'./assets/channel-icons/arirang-card.png',
  'euronews':'./assets/channel-icons/euronews-card.png',
  'taiwanplus':'./assets/channel-icons/taiwanplus-card.png',
  'dw':'./assets/channel-icons/dw-card.svg',
  'nhk-world':'./assets/channel-icons/nhk-world-card.svg',
  'rt-international':'./assets/channel-icons/rt-card.png',
  'al-jazeera-arabic-hd':'./assets/channel-icons/aljazeera-card.png',
  'usim-tv':'./assets/channel-icons/usim-tv-card.svg',
  'selangor-tv':'./assets/channel-icons/selangor-tv-card.svg',
  'tv-ikim':'./assets/channel-icons/ikim-card.png',
  'siara-tv':'./assets/channel-icons/siara-tv-card.svg'
};

// v1020: Movies are rendered as a native AZOBSSTV catalogue from a local
// metadata snapshot. 7Movies remains only the original detail/source link;
// AZOBSSTV does not proxy, extract, or bypass third-party media streams.
function builtInMovieSources(){return[]}
function appendBuiltInMovieSources(list){return Array.isArray(list)?[...list]:[]}

function liveChannelSlug(c){
  const direct=String(c?.slug||'').trim().toLowerCase();
  if(direct)return direct;
  for(const raw of [c?.officialUrl,c?.sourcePage,c?.url]){
    try{
      const u=new URL(String(raw||''),location.href);
      const m=u.pathname.match(/^\/channel\/([^/?#]+)/i);
      if(m&&/(?:^|\.)mana2\.my$/i.test(u.hostname))return decodeURIComponent(m[1]).trim().toLowerCase();
    }catch{}
  }
  return'';
}
function applyLocalLiveArtwork(c){
  if(!c)return c;
  const local=LOCAL_LIVE_ARTWORK[liveChannelSlug(c)]||'';
  if(!local)return c;
  return {...c,remoteLogo:String(c.logo||''),logo:local};
}

const hostOf=u=>{try{return new URL(u,location.href).hostname.toLowerCase()}catch{return''}};
function isAllowed(url){if(state.trustedDemoUrls.has(String(url||'')))return true;if(!state.config)return true;if(state.config.allow_all_domains)return true;const host=hostOf(url);return (state.config.allowed_domains||[]).some(d=>host===d||host.endsWith('.'+d))}
function proxiedStreamUrl(url){return API_BASE+'/stream?url='+encodeURIComponent(String(url||''))}
function playbackUrl(c){return c&&String(c.mode||'').toLowerCase()==='proxy'?proxiedStreamUrl(c.url):c.url}
async function fetchWithTimeout(url,opts={},timeout=20000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{return await fetch(url,{cache:'no-store',...opts,signal:c.signal})}finally{clearTimeout(t)}}
async function jget(url,timeout=20000){const r=await fetchWithTimeout(url,{},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
async function localJget(url,timeout=8000){const r=await fetchWithTimeout(url,{cache:'force-cache'},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
async function localTextGet(url,timeout=5000){const r=await fetchWithTimeout(url,{cache:'force-cache'},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
async function textDirect(url,timeout=60000){const r=await fetchWithTimeout(url,{},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
async function backendFetchText(kind,url,timeout){const r=await fetchWithTimeout(API_BASE+'/'+kind+'/fetch',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/plain,*/*'},body:JSON.stringify({url})},timeout);if(!r.ok){let msg='HTTP '+r.status;try{const j=await r.json();if(j.error)msg=j.error}catch{}throw new Error(msg)}return await r.text()}
async function smartTextGet(url,kind,timeout=60000){if(!url)throw new Error('URL kosong');try{return await textDirect(url,timeout)}catch(directErr){if(url.startsWith(API_BASE))throw directErr;try{return await backendFetchText(kind,url,timeout)}catch(proxyErr){throw new Error(proxyErr.message||directErr.message)}}}
async function loadConfig(){try{state.config=await jget(API_BASE+'/config');$('#serviceStatus').textContent='Online';$('#serviceStatus').className='ok'}catch(e){state.config={allow_all_domains:false,allowed_domains:['azobss.com'],free_playlist_url:API_BASE+'/playlist/free',epg_url:API_BASE+'/epg',notification_url:API_BASE+'/notifications',device_ping_url:API_BASE+'/device/ping'};$('#serviceStatus').textContent='Fallback';$('#serviceStatus').className='warn'}}
function parseM3U(raw){const lines=String(raw||'').replace(/\r/g,'').split('\n');const out=[];let meta=null;let opts={};for(const src of lines){const line=src.trim();if(!line)continue;if(line.startsWith('#EXTINF:')){const comma=line.indexOf(',');const name=(comma>=0?line.slice(comma+1):'Unnamed').trim()||'Unnamed';const attrs={};line.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>(attrs[k]=v,''));meta={name,logo:attrs['tvg-logo']||'',id:attrs['tvg-id']||attrs['tvg-name']||'',group:attrs['group-title']||'Other',sourcePage:attrs['x-source-page']||attrs['source-page']||'',webOnly:String(attrs['x-web-only']||'')==='1',mode:attrs['x-mode']||'',officialUrl:attrs['x-official-url']||'',altUrl:attrs['x-alt-url']||''};opts={}}else if(line.startsWith('#EXTVLCOPT:')){const p=line.slice(11).split('=');opts[p.shift().trim().toLowerCase()]=p.join('=').trim()}else if(line.startsWith('#KODIPROP:')){const p=line.slice(10).split('=');opts[p.shift().trim().toLowerCase()]=p.join('=').trim()}else if(!line.startsWith('#')&&meta){out.push({...meta,url:line,headers:{userAgent:opts['http-user-agent']||'',referer:opts['http-referrer']||opts['http-referer']||'',origin:opts['http-origin']||'',authorization:opts['http-authorization']||''},drm:{licenseType:opts['inputstream.adaptive.license_type']||opts['license_type']||'',licenseKey:opts['inputstream.adaptive.license_key']||opts['license_key']||''}});meta=null;opts={}}}return out}
async function loadMana2PublicCatalog(){const data=await jget(API_BASE+'/mana2/channels',25000);const rows=Array.isArray(data?.channels)?data.channels:[];return rows.map((x,index)=>{const url=String(x?.officialUrl||x?.sourcePage||x?.url||'').trim();const name=String(x?.name||x?.title||`Channel ${index+1}`).trim();if(!url||!name)return null;return{name,logo:String(x?.logo||'').trim(),id:String(x?.id||x?.channelId||x?.slug||'').trim(),group:String(x?.group||'Live TV').trim()||'Live TV',kind:String(x?.kind||'live').toLowerCase()==='radio'?'radio':'live',sourcePage:url,webOnly:false,mode:'official',officialUrl:url,altUrl:'',url,headers:{userAgent:'',referer:'',origin:'',authorization:''},drm:{licenseType:'',licenseKey:''},slug:String(x?.slug||'').trim(),channelNumber:x?.channelNumber??null}}).filter(Boolean).map(applyLocalLiveArtwork)}
async function loadMovieCatalog(){
  try{
    const data=await localJget('./data/movies-7movies-catalog.json?v=1021',8000);
    const rows=Array.isArray(data?.items)?data.items:[];
    return rows.map((x,index)=>{
      const url=String(x?.sourcePage||x?.url||'').trim();
      const name=String(x?.name||`Movie ${index+1}`).trim();
      if(!url||!name)return null;
      const categories=Array.isArray(x?.categories)?x.categories.map(v=>String(v||'').trim()).filter(Boolean):['Movies','7Movies'];
      return{
        name,
        logo:String(x?.logo||'').trim(),
        id:String(x?.id||`7movies-movie-${index+1}`).trim(),
        group:'Movies',kind:'movies',categories,
        year:x?.year??null,rating:String(x?.rating||'').trim(),
        tmdbId:String(x?.tmdbId||'').trim(),sourceProvider:'7movies',
        sourcePage:url,webOnly:false,mode:'movie-detail',officialUrl:'',altUrl:'',url,
        headers:{userAgent:'',referer:'',origin:'',authorization:''},
        drm:{licenseType:'',licenseKey:''}
      };
    }).filter(Boolean);
  }catch(e){
    console.warn('AZOBSSTV Movies catalogue fallback:',e?.message||e);
    return[];
  }
}
async function loadAnimeCatalog(){try{const data=await localJget('./data/anime-catalog.json?v=1021',8000);const rows=Array.isArray(data?.items)?data.items:[];return rows.map((x,index)=>{const url=String(x?.sourcePage||x?.url||'').trim();const name=String(x?.name||`Anime ${index+1}`).trim();const slug=String(x?.slug||'').trim();if(!url||!name)return null;const categories=Array.isArray(x?.categories)?x.categories.map(v=>String(v||'').trim()).filter(Boolean):[];const poster=slug?API_BASE+'/anime123/poster?slug='+encodeURIComponent(slug):String(x?.logo||'').trim();return{name,logo:poster,id:String(x?.id||x?.slug||`anime-${index+1}`).trim(),group:'Anime',kind:'series',categories,year:x?.year??null,rating:'',episodeCount:Number(x?.episodeCount||0)||0,episodeBase:String(x?.episodeBase||'').trim(),episodes:[],sourceProvider:String(x?.sourceProvider||'123animehub'),sourcePage:url,webOnly:true,mode:'web',officialUrl:url,altUrl:'',url,headers:{userAgent:'',referer:'',origin:'',authorization:''},drm:{licenseType:'',licenseKey:''},slug,status:String(x?.status||''),animeType:String(x?.type||''),tags:Array.isArray(x?.tags)?x.tags:[]}}).filter(Boolean)}catch(e){console.warn('AZOBSSTV anime catalogue fallback:',e?.message||e);return[]}}
function contentCategories(c){const own=Array.isArray(c?.categories)?c.categories.map(v=>String(v||'').trim()).filter(Boolean):[];if(own.length)return own;const group=String(c?.group||'').trim();return group?[group]:[]}
function cardSubline(c){if(mediaType(c)==='series'){const bits=[];if(c?.year)bits.push(String(c.year));bits.push(...contentCategories(c).slice(0,3));return bits.join(' • ')||'Anime'}if(mediaType(c)==='movies'){const bits=[];if(c?.year)bits.push(String(c.year));if(c?.rating)bits.push('★ '+String(c.rating));return bits.join(' • ')||'Movie'}return String(c?.mode||'').toLowerCase()==='official'?'Official player':c?.webOnly?'Open source':'Direct'}
function mediaType(c){const explicit=String(c?.kind||'').toLowerCase();if(['live','radio','movies','series'].includes(explicit))return explicit;const text=((c.group||'')+' '+(c.name||'')).toLowerCase();if(/\bradio\b|radio|fm\b/.test(text))return'radio';if(/series|siri|episode|episod|drama/.test(text))return'series';if(/movie|movies|vod|filem|cinema/.test(text))return'movies';return'live'}
function tabFilter(c){return ['live','movies','series','radio'].includes(state.tab)?mediaType(c)===state.tab:true}
function railListForCurrentView(){
  if(state.tab==='guide')return state.channels.filter(c=>mediaType(c)==='live');
  return state.filtered
}
function renderChannelRail(list=railListForCurrentView()){
  const rail=$('#channelRailList'),count=$('#railChannelCount');if(!rail)return;
  const items=Array.isArray(list)?list:[];if(count)count.textContent=String(items.length);
  rail.innerHTML=items.map((c,i)=>{const badge=channelBadgeText(c.name);return `<div class="channel-rail-card ${state.current&&state.current.url===c.url?'active':''}" role="listitem" data-rail-index="${i}" title="${esc(c.name)}">${c.logo?`<img class="channel-rail-logo" loading="lazy" referrerpolicy="no-referrer" src="${esc(c.logo)}" data-fallback="${esc(badge)}" alt="">`:`<div class="channel-rail-logo fallback">${esc(badge)}</div>`}<div class="channel-rail-text"><div class="channel-rail-name">${esc(c.name)}</div></div><button class="channel-rail-fav ${state.favorites.has(channelKey(c))?'active':''}" type="button" data-rail-fav="${i}" aria-label="Favorite">♥</button></div>`}).join('');
  [...rail.querySelectorAll('img.channel-rail-logo')].forEach(img=>img.addEventListener('error',()=>{const d=document.createElement('div');d.className='channel-rail-logo fallback';d.textContent=img.dataset.fallback||'TV';img.replaceWith(d)}));
  [...rail.querySelectorAll('.channel-rail-card')].forEach(el=>el.addEventListener('click',e=>{const i=Number(el.dataset.railIndex),c=items[i];if(!c)return;if(e.target.closest('[data-rail-fav]')){toggleFav(c);e.stopPropagation();return}play(c)}));updateFavoriteAvailability();
}
function syncHeroSideHeight(){
  const player=document.querySelector('.player-card'),side=$('#heroSide'),hero=document.querySelector('.hero-grid');
  if(!player||!side||!hero)return;
  const playerHeight=Math.max(0,Math.round(player.getBoundingClientRect().height));
  if(playerHeight)hero.style.setProperty('--az-player-card-height',playerHeight+'px');
  if(matchMedia('(max-width:800px)').matches||hero.classList.contains('anime-compact-hero')){
    side.style.height='';
    return;
  }
  side.style.height=playerHeight+'px';
}
function startHeroSideSync(){
  const player=document.querySelector('.player-card');if(state.heroSideResizeObserver){try{state.heroSideResizeObserver.disconnect()}catch{}state.heroSideResizeObserver=null}
  if(window.ResizeObserver&&player){state.heroSideResizeObserver=new ResizeObserver(()=>syncHeroSideHeight());state.heroSideResizeObserver.observe(player)}
  window.addEventListener('resize',syncHeroSideHeight,{passive:true});requestAnimationFrame(syncHeroSideHeight);setTimeout(syncHeroSideHeight,500)
}
function fillGroups(){const sel=$('#groupSelect');const groups=[...new Set(state.channels.filter(tabFilter).flatMap(c=>contentCategories(c)))].filter(Boolean).sort((a,b)=>a.localeCompare(b));const old=sel.value;const allLabel=state.tab==='series'?'All anime genres':'All categories';sel.innerHTML=`<option value="">${allLabel}</option>`+groups.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');if(groups.includes(old))sel.value=old}
function render(){
  state.animeDetail=null;
  state.movieDetail=null;
  $('#animeDetailView').hidden=true;
  $('#animeDetailView').innerHTML='';
  $('#browserToolbar').hidden=false;
  const grid=$('#channelGrid');
  grid?.classList.toggle('anime-grid',state.tab==='series');
  grid?.classList.toggle('movie-grid',state.tab==='movies');
  const q=$('#searchInput').value.trim().toLowerCase();
  const grp=$('#groupSelect').value;
  if((state.tab==='favorites'||state.tab==='recent')&&!isSignedIn()){
    state.filtered=[];grid.hidden=false;$('#guideView').hidden=true;grid.innerHTML='';
    $('#contentState').hidden=false;
    $('#contentState').textContent=state.tab==='favorites'?'Sign in to save and view Favorites.':'Sign in to save and view Recent.';
    renderChannelRail([]);updateFavoriteAvailability();return;
  }
  let list=state.channels.filter(c=>{
    if(!tabFilter(c))return false;
    const cats=contentCategories(c);
    if(grp&&!cats.includes(grp))return false;
    if(!q)return true;
    return [c.name,c.group,c.year,c.rating,...cats].join(' ').toLowerCase().includes(q);
  });
  if(state.tab==='favorites')list=list.filter(c=>state.favorites.has(channelKey(c)));
  if(state.tab==='recent'){
    const order=new Map(state.recent.map((u,i)=>[u,i]));
    list=list.filter(c=>order.has(channelKey(c))).sort((a,b)=>order.get(channelKey(a))-order.get(channelKey(b)));
  }
  state.filtered=list;
  grid.hidden=false;$('#guideView').hidden=true;
  $('#contentState').hidden=!!list.length;$('#contentState').textContent=list.length?'':'No content found.';
  grid.innerHTML=list.map((c,i)=>{
    const badge=channelBadgeText(c.name),type=mediaType(c),isAnime=type==='series',isMovie=type==='movies';
    const classes=['channel-card',isAnime?'anime-card':'',isMovie?'movie-card':''].filter(Boolean).join(' ');
    const img=c.logo?`<img class="channel-logo" loading="lazy" referrerpolicy="no-referrer" src="${esc(c.logo)}" data-fallback="${esc(badge)}" alt="${esc(c.name)}">`:`<div class="channel-logo fallback">${esc(badge)}</div>`;
    return `<article class="${classes}" data-index="${i}">${img}<div class="channel-text"><div class="channel-name">${esc(c.name)}</div><div class="channel-group">${esc(cardSubline(c))}</div></div><button class="fav-mini ${state.favorites.has(channelKey(c))?'active':''}" data-fav="${i}" type="button" aria-label="Favorite">♥</button></article>`;
  }).join('');
  $$('.channel-logo').filter(x=>x.tagName==='IMG').forEach(img=>img.addEventListener('error',()=>{const d=document.createElement('div');d.className='channel-logo fallback';d.textContent=img.dataset.fallback||'TV';img.replaceWith(d)}));
  $$('.channel-card').forEach(el=>el.addEventListener('click',e=>{const i=Number(el.dataset.index);if(e.target.closest('[data-fav]')){toggleFav(list[i]);e.stopPropagation();return}play(list[i])}));
  renderChannelRail(list);updateFavoriteAvailability();
}
function toggleFav(c){if(!c||!requireSignIn('Favorites'))return;const key=channelKey(c);if(!key)return;if(state.favorites.has(key))state.favorites.delete(key);else state.favorites.add(key);saveUserLibrary();$('#favCurrentBtn').classList.toggle('active',!!(state.current&&state.favorites.has(channelKey(state.current))));if(state.animeDetail&&state.tab==='series'){renderChannelRail();renderAnimeSideEpisodes(state.animeDetail,state.current?.url||'')}else if(state.movieDetail&&state.tab==='movies'){renderChannelRail(state.channels.filter(x=>mediaType(x)==='movies'));const b=document.querySelector('.movie-fav-btn');if(b)b.classList.toggle('active',state.favorites.has(channelKey(state.movieDetail)))}else render()}
function markRecent(c){if(!c||!isSignedIn())return;const key=channelKey(c);if(!key)return;state.recent=[key,...state.recent.filter(x=>x!==key)].slice(0,30);saveUserLibrary()}
function stopHls(){if(state.avSyncTimer){clearInterval(state.avSyncTimer);state.avSyncTimer=null}if(state.avStallTimer){clearTimeout(state.avStallTimer);state.avStallTimer=null}if(state.hls){state.hls.destroy();state.hls=null}if(state.dash){try{state.dash.reset()}catch{}state.dash=null}}
function currentIsLive(){return !!(state.current&&mediaType(state.current)==='live')}
function syncButtonState(){const b=$('#avSyncBtn');if(b)b.disabled=!currentIsLive()}
function seekLiveEdge(v,preferred=null){if(!v||v.paused||v.ended)return false;let target=Number(preferred);if(!Number.isFinite(target)){try{if(v.seekable&&v.seekable.length)target=Number(v.seekable.end(v.seekable.length-1))-0.75}catch{}}if(!Number.isFinite(target)||target<=0)return false;const lag=target-Number(v.currentTime||0);if(lag<2.5)return false;try{v.currentTime=Math.max(0,target-0.35);return true}catch{return false}}
function reloadOfficialForAvSync(c,reason='manual'){
  const panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');
  if(!c||!panel||panel.hidden||!frame)return false;
  const url=c.officialUrl||c.sourcePage||c.url;if(!url)return false;
  const token=++state.avOfficialReloadId;
  $('#nowMeta').textContent=reason==='manual'?'Resyncing audio / video…':'Restoring live sync…';
  try{frame.src='about:blank'}catch{}
  setTimeout(()=>{if(token!==state.avOfficialReloadId||state.current!==c)return;frame.src=url;startOfficialAutoFit();setTimeout(()=>{if(state.current===c)loadCurrentSchedule(c)},900)},140);
  return true;
}
function resyncCurrentPlayback(reason='manual'){
  const c=state.current;if(!c||mediaType(c)!=='live')return false;
  const now=Date.now();if(reason!=='manual'&&now-state.avSyncCooldown<7000)return false;state.avSyncCooldown=now;
  const mode=String(c.mode||'').toLowerCase();
  if(mode==='official')return reloadOfficialForAvSync(c,reason);
  const v=$('#tvPlayer');if(!v)return false;
  let repaired=false;
  if(state.hls){
    try{state.hls.recoverMediaError();repaired=true}catch{}
    const live=Number(state.hls.liveSyncPosition);
    if(seekLiveEdge(v,Number.isFinite(live)?live:null))repaired=true;
  }else if(state.dash){
    if(seekLiveEdge(v))repaired=true;
  }else if(seekLiveEdge(v))repaired=true;
  try{if(v.paused&&!v.ended)v.play().catch(()=>{})}catch{}
  if(repaired)setPlaybackMeta(reason==='manual'?'A/V sync repaired':'Live sync restored');
  return repaired;
}
function startDirectAvSyncGuard(c,v,label='Live'){
  if(state.avSyncTimer){clearInterval(state.avSyncTimer);state.avSyncTimer=null}
  if(!c||mediaType(c)!=='live'||!v)return;
  state.avSyncTimer=setInterval(()=>{
    if(state.current!==c||v.paused||v.ended||document.visibilityState!=='visible')return;
    if(state.hls){
      const live=Number(state.hls.liveSyncPosition);
      if(Number.isFinite(live)&&live-Number(v.currentTime||0)>8){
        if(seekLiveEdge(v,live)){state.avSyncCooldown=Date.now();setPlaybackMeta('HLS • '+label+' • Live sync corrected')}
      }
    }else{
      try{if(v.seekable&&v.seekable.length){const end=Number(v.seekable.end(v.seekable.length-1));if(end-Number(v.currentTime||0)>10&&seekLiveEdge(v,end)){state.avSyncCooldown=Date.now();setPlaybackMeta('Live sync corrected')}}}catch{}
    }
  },4000);
}
function timeToMinutes(value){const m=String(value||'').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return null;let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return h*60+Number(m[2])}
function malaysiaMinutesNow(){try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kuala_Lumpur',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(new Date());const h=parts.find(x=>x.type==='hour')?.value,m=parts.find(x=>x.type==='minute')?.value,p=parts.find(x=>x.type==='dayPeriod')?.value;return timeToMinutes(`${h}:${m} ${p}`)}catch{return new Date().getHours()*60+new Date().getMinutes()}}
function isScheduleCurrent(item,nowMin=malaysiaMinutesNow()){const a=timeToMinutes(item?.start),b=timeToMinutes(item?.end);if(a==null||b==null||nowMin==null)return false;return a<=b?(nowMin>=a&&nowMin<b):(nowMin>=a||nowMin<b)}
function currentTitleFromSchedule(data){if(data?.current_title)return String(data.current_title).trim();const list=Array.isArray(data?.schedule)?data.schedule:[];const hit=list.find(x=>x.current)||list.find(x=>isScheduleCurrent(x));return hit?.title||''}
function renderTodaySchedule(data,c){restoreTodayScheduleHeading();const box=$('#todayScheduleList'),label=$('#todayScheduleChannel');if(!box)return;if(label)label.textContent=c?.name||'—';const list=Array.isArray(data?.schedule)?data.schedule:[];if(!list.length){box.innerHTML='<div class="today-schedule-empty">Today&#39;s schedule is not available for this channel.</div>';return}box.innerHTML=list.slice(0,48).map(item=>{const cur=!!item.current||isScheduleCurrent(item);return `<div class="today-schedule-row ${cur?'current':''}"${cur?' aria-current="true"':''}><div class="today-schedule-time">${esc(item.start||'')}<br>${esc(item.end||'')}</div><div class="today-schedule-title">${esc(item.title||'')}</div></div>`}).join('');requestAnimationFrame(()=>box.querySelector('.today-schedule-row.current')?.scrollIntoView({block:'nearest'}))}
async function loadCurrentSchedule(c){const target=c?.officialUrl||c?.sourcePage||'';const label=$('#todayScheduleChannel'),box=$('#todayScheduleList');if(label)label.textContent=c?.name||'—';const epgTitle=state.epg.get(c?.id||'')?.current?.title||'';if(!target||!/(?:^|\.)mana2\.my$/i.test(hostOf(target))){$('#nowMeta').textContent=epgTitle||'Program information is unavailable';if(box)box.innerHTML='<div class="today-schedule-empty">Today&#39;s schedule is not available for this channel.</div>';return}const reqId=++state.scheduleRequestId;$('#nowMeta').textContent='Loading program title…';if(box)box.innerHTML='<div class="today-schedule-empty">Loading today&#39;s schedule…</div>';try{let data=state.scheduleCache.get(target);if(!data||Date.now()-Number(data._cachedAt||0)>60000){data=await jget(API_BASE+'/mana2/schedule?url='+encodeURIComponent(target)+'&name='+encodeURIComponent(c?.name||'')+'&tvg_id='+encodeURIComponent(c?.id||''),28000);data._cachedAt=Date.now();state.scheduleCache.set(target,data)}if(reqId!==state.scheduleRequestId||state.current!==c)return;$('#nowMeta').textContent=currentTitleFromSchedule(data)||epgTitle||'Program information is unavailable';renderTodaySchedule(data,c)}catch(e){if(reqId!==state.scheduleRequestId||state.current!==c)return;$('#nowMeta').textContent=epgTitle||'Program information is unavailable';if(box)box.innerHTML='<div class="today-schedule-empty">Today&#39;s schedule failed to load.</div>'}}
function providerGuideUrl(c){const target=c?.officialUrl||c?.sourcePage||'';return target&&/(?:^|\.)mana2\.my$/i.test(hostOf(target))?target:''}
function setPlaybackMeta(extra=''){const c=state.current;if(!c)return;const v=$('#tvPlayer');const res=(v.videoWidth&&v.videoHeight)?`${v.videoWidth}×${v.videoHeight}`:'';$('#nowMeta').textContent=[res,extra].filter(Boolean).join(' • ')||'AZOBSSTV'}
function watchVideoPicture(v){clearTimeout(state.videoCheckTimer);state.videoCheckTimer=setTimeout(()=>{if(!state.current||v.paused||v.ended)return;if(v.videoWidth===0){setPlaybackMeta('Audio is active, but video is not available yet');showPlayerError('Audio was detected, but video is not available. This usually happens when the video codec or cross-origin stream access is not compatible with the browser.');}else{setPlaybackMeta();hidePlayerError()}},4500)}
function showPlayerError(message){const el=$('#playerError');if(!el)return;el.textContent=String(message||'Playback failed.');el.hidden=false}
function hidePlayerError(){const el=$('#playerError');if(!el)return;el.hidden=true;el.textContent=''}
function hidePlayerPlaceholder(){const el=$('#playerEmpty');if(!el)return;el.hidden=true;el.style.display='none'}
function showPlayerPlaceholder(){const el=$('#playerEmpty');if(!el)return;el.hidden=false;el.style.removeProperty('display')}
function setOfficialWide(enabled){
  const hero=document.querySelector('.hero-grid'),hotspot=$('#officialExpandHotspot');
  state.officialWide=!!enabled;
  if(hero)hero.classList.toggle('az-player-wide',state.officialWide);
  if(hotspot){const label=state.officialWide?'Restore normal size':'Expand player';hotspot.setAttribute('aria-pressed',state.officialWide?'true':'false');hotspot.setAttribute('aria-label',label);hotspot.title=label}
  requestAnimationFrame(()=>{fitOfficialFrame();syncHeroSideHeight();if(state.officialWide){document.querySelector('.player-card')?.scrollIntoView({block:'start',behavior:'smooth'})}});
  setTimeout(()=>{fitOfficialFrame();syncHeroSideHeight()},260);
}
function toggleOfficialWide(){setOfficialWide(!state.officialWide)}
function fitOfficialFrame(){const stage=$('#officialPlayerStage'),frame=$('#officialPlayerFrame');if(!stage||!frame||$('#officialPlayerPanel')?.hidden)return;const cw=Math.max(1,stage.clientWidth),ch=Math.max(1,stage.clientHeight);/* v974: Mana-Mana is cross-origin, so AZOBSSTV cannot legally/scriptably click its cookie/expand controls. Instead use a taller virtual viewport so the fixed cookie banner sits below the visible crop, then auto-focus the provider's 16:9 video region (same visual result as its expand control). */const virtualW=1280,virtualH=1080;const focusX=40,focusY=175,focusW=700,focusH=394;const scale=Math.min(cw/focusW,ch/focusH);const shownW=focusW*scale,shownH=focusH*scale;frame.style.width=virtualW+'px';frame.style.height=virtualH+'px';frame.style.left=((cw-shownW)/2-focusX*scale)+'px';frame.style.top=((ch-shownH)/2-focusY*scale)+'px';frame.style.transform='scale('+scale+')'}
function startOfficialAutoFit(){const stage=$('#officialPlayerStage'),frame=$('#officialPlayerFrame');if(state.officialResizeObserver){try{state.officialResizeObserver.disconnect()}catch{}state.officialResizeObserver=null}if(window.ResizeObserver&&stage){state.officialResizeObserver=new ResizeObserver(()=>fitOfficialFrame());state.officialResizeObserver.observe(stage)}if(frame&&!frame.dataset.azFitBound){frame.dataset.azFitBound='1';frame.addEventListener('load',()=>{fitOfficialFrame();tryAutoAcceptOfficialCookies()})}requestAnimationFrame(()=>{fitOfficialFrame();setTimeout(fitOfficialFrame,350);setTimeout(fitOfficialFrame,1200)})}
function tryAutoAcceptOfficialCookies(){const frame=$('#officialPlayerFrame');if(!frame)return false;try{const doc=frame.contentDocument||frame.contentWindow?.document;if(!doc)return false;const buttons=[...doc.querySelectorAll('button,[role=button],input[type=button],input[type=submit]')];const btn=buttons.find(el=>/^(accept|accept all|agree|allow|terima|setuju)$/i.test(String(el.textContent||el.value||'').trim()));if(btn){btn.click();return true}}catch{}return false}

function ensureAnimeEpisodes(series){
  if(!series)return[];
  if(Array.isArray(series.episodes)&&series.episodes.length)return series.episodes;
  const count=Math.max(0,Math.min(5000,Number(series.episodeCount||0)||0));
  const base=String(series.episodeBase||'').trim();
  if(!count||!base)return[];
  series.episodes=Array.from({length:count},(_,i)=>{
    const n=i+1,code=String(n).padStart(3,'0');
    return{id:`ep-${code}`,number:String(n),title:'',label:`Episode ${n}`,url:base+code};
  });
  return series.episodes;
}

function animeEpisodeDisplay(ep,index){
  if(ep?.number)return `Episode ${ep.number}${ep.title?' — '+ep.title:''}`;
  return ep?.label||ep?.title||`Episode ${index+1}`;
}
function animeEpisodeMatches(ep,q){
  if(!q)return true;
  return [ep?.number,ep?.title,ep?.label].join(' ').toLowerCase().includes(q);
}
function renderAnimeSideEpisodes(series,currentUrl=''){
  const card=$('#todayScheduleCard'),box=$('#todayScheduleList'),label=$('#todayScheduleChannel'),head=$('#todayScheduleCard .today-schedule-head strong');
  card?.classList.add('anime-episode-mode');
  if(head)head.textContent='Episodes';
  if(label)label.textContent=series?.name||'Anime';
  if(!card||!box)return;

  let tools=card.querySelector('.anime-side-episode-tools');
  if(!tools){
    tools=document.createElement('div');
    tools.className='anime-side-episode-tools';
    tools.innerHTML='<input id="animeSideEpisodeSearch" type="search" placeholder="Search episode number / title..." autocomplete="off" aria-label="Search episodes">';
    box.insertAdjacentElement('beforebegin',tools);
  }

  const search=tools.querySelector('#animeSideEpisodeSearch');
  if(search&&search.value!==String(state.animeEpisodeSearch||''))search.value=String(state.animeEpisodeSearch||'');

  const eps=ensureAnimeEpisodes(series);
  const q=String(state.animeEpisodeSearch||'').trim().toLowerCase();
  const filtered=eps.map((ep,index)=>({ep,index})).filter(x=>animeEpisodeMatches(x.ep,q));

  if(!eps.length){
    box.innerHTML='<div class="today-schedule-empty">No episodes are available.</div>';
  }else{
    box.innerHTML=filtered.map(({ep,index})=>{
      const active=ep.url===currentUrl;
      return `<button class="anime-side-episode ${active?'current':''}" type="button" data-anime-side-episode="${index}" aria-current="${active?'true':'false'}"><span>${esc(ep.number?`EP ${ep.number}`:`EP ${index+1}`)}</span><strong>${esc(ep.title||ep.label||`Episode ${index+1}`)}</strong></button>`;
    }).join('')||'<div class="today-schedule-empty">No matching episodes.</div>';
  }

  if(search&&!search.dataset.bound){
    search.dataset.bound='1';
    search.addEventListener('input',e=>{
      state.animeEpisodeSearch=e.target.value;
      const pos=e.target.selectionStart||0;
      renderAnimeSideEpisodes(series,currentUrl);
      const next=$('#animeSideEpisodeSearch');
      if(next){
        next.focus({preventScroll:true});
        try{next.setSelectionRange(pos,pos)}catch{}
      }
    });
  }

  $$('[data-anime-side-episode]',box).forEach(btn=>btn.addEventListener('click',()=>{
    const ep=eps[Number(btn.dataset.animeSideEpisode)];
    if(ep)playAnimeEpisode(series,ep);
  }));
}
function restoreTodayScheduleHeading(){
  const card=$('#todayScheduleCard'),head=$('#todayScheduleCard .today-schedule-head strong');
  if(card){
    card.classList.remove('anime-episode-mode');
    card.querySelector('.anime-side-episode-tools')?.remove();
  }
  state.animeEpisodeSearch='';
  if(head)head.textContent="Today's Schedule";
}
function setAnimeEpisodesDocked(on){
  const card=$('#todayScheduleCard'),side=$('#heroSide');
  if(!card||!side)return;
  // v1008: Episodes must always live directly below Channels in the right rail.
  if(card.parentElement!==side)side.appendChild(card);
  card.classList.remove('anime-episodes-docked');
  card.classList.toggle('anime-episodes-side',!!on);
}

function setAnimeEmbedCompactMode(on){
  const wrap=$('#videoWrap'),panel=$('#animePlayerPanel'),hero=document.querySelector('.hero-grid');
  if(wrap)wrap.classList.toggle('anime-embed-compact-mode',!!on);
  if(panel)panel.classList.toggle('anime-embed-compact',!!on);
  if(hero)hero.classList.toggle('anime-compact-hero',!!on);
  setAnimeEpisodesDocked(!!on);
  requestAnimationFrame(()=>{syncHeroSideHeight();setTimeout(syncHeroSideHeight,40)});
}
function setAnimeFallbackDisplayMode(on){
  const wrap=$('#videoWrap'),hero=document.querySelector('.hero-grid');
  if(wrap)wrap.classList.toggle('anime-fallback-display-mode',!!on);
  if(hero)hero.classList.toggle('anime-fallback-hero',!!on);
  if(on)setAnimeEpisodesDocked(true);
  requestAnimationFrame(()=>{syncHeroSideHeight();setTimeout(syncHeroSideHeight,40)});
}

function hideAnimePlayer(clearFrame=true){
  clearAnimeFrameWatchdog();
  const panel=$('#animePlayerPanel'),frame=$('#animePlayerFrame'),blocked=$('#animeEmbedBlocked');
  setAnimeFallbackDisplayMode(false);
  setAnimeEmbedCompactMode(false);
  if(panel)panel.hidden=true;
  if(blocked)blocked.hidden=true;
  if(clearFrame&&frame){try{frame.src='about:blank'}catch{}}
}
function isSafeAnimeEmbedPageUrl(raw){
  try{
    const u=new URL(String(raw||''),location.href);
    if(!/^https?:$/.test(u.protocol))return false;
    if(/\.(?:js|mjs|css|map|json|xml|txt|jpg|jpeg|png|gif|webp|svg|ico|woff2?|ttf|otf)(?:$|[?#])/i.test(u.pathname))return false;
    if(/(?:^|\.)disqus\.com$/i.test(u.hostname)||/(?:^|\.)disquscdn\.com$/i.test(u.hostname))return false;
    return true;
  }catch{return false}
}

async function checkAnimeEmbed(url){
  try{
    // v1012: keep the UI responsive even when Render is waking up or an upstream
    // provider stalls. The player UI has its own deadline too, so this request is
    // deliberately shorter than the old 18-second wait.
    const data=await jget(API_BASE+'/anime123/resolve?url='+encodeURIComponent(url),9500);
    if(data&&data.ok&&data.embeddable&&data.embed_url&&isSafeAnimeEmbedPageUrl(data.embed_url))return data;
    if(data&&data.embeddable&&data.embed_url&&!isSafeAnimeEmbedPageUrl(data.embed_url))return{...data,embeddable:false,reason:'unsafe-non-html-embed-url'};
    return data&&typeof data.embeddable==='boolean'?data:{ok:false,embeddable:false,reason:'resolver-no-player'};
  }catch(e){
    const timeout=String(e?.name||'')==='AbortError';
    return{ok:false,embeddable:false,reason:timeout?'resolver-timeout':'resolver-unavailable'};
  }
}

function animeResolveWithDeadline(url,ms=10000){
  let timer=null;
  return Promise.race([
    checkAnimeEmbed(url),
    new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,embeddable:false,reason:'frontend-resolve-timeout'}),ms)})
  ]).finally(()=>{if(timer)clearTimeout(timer)});
}

function openAnimeSourceNewTab(ep){
  const url=String(ep?.url||'').trim();
  if(!url)return false;
  try{
    const w=window.open(url,'_blank','noopener,noreferrer');
    return !!w;
  }catch{return false}
}

function clearAnimeFrameWatchdog(){
  if(state.animeFrameTimer){clearTimeout(state.animeFrameTimer);state.animeFrameTimer=null}
  const frame=$('#animePlayerFrame');
  if(frame){frame.onload=null;frame.onerror=null}
}

function createFreshAnimeFrame(){
  const old=$('#animePlayerFrame');
  if(!old)return null;
  clearAnimeFrameWatchdog();
  const frame=document.createElement('iframe');
  frame.id='animePlayerFrame';
  frame.title=old.title||'Anime episode public page';
  frame.setAttribute('allow',old.getAttribute('allow')||'autoplay; fullscreen; picture-in-picture');
  frame.setAttribute('referrerpolicy',old.getAttribute('referrerpolicy')||'strict-origin-when-cross-origin');
  frame.hidden=true;
  old.replaceWith(frame);
  return frame;
}

function showAnimeCheckingState(series,ep){
  const blocked=$('#animeEmbedBlocked');
  if(!blocked)return;
  blocked.hidden=false;
  blocked.innerHTML=`<div class="anime-checking-inline" role="status" aria-live="polite">
    <span class="anime-checking-spinner" aria-hidden="true"></span>
    <div><strong>Preparing player…</strong><span>Checking whether this episode can play inside AZOBSSTV. This will not stay here indefinitely.</span></div>
  </div>`;
}

function startAnimeFrameWatchdog(series,ep,check,requestId){
  const frame=$('#animePlayerFrame'),status=$('#animePlayerSourceStatus');
  if(!frame)return;
  clearAnimeFrameWatchdog();
  let finished=false;
  const fail=()=>{
    if(finished||requestId!==state.animeEmbedRequestId)return;
    finished=true;
    clearAnimeFrameWatchdog();
    try{frame.src='about:blank'}catch{}
    frame.hidden=true;
    setAnimeEmbedCompactMode(false);
    setAnimeFallbackDisplayMode(true);
    setupAnimeSourceFallback(series,ep,{...(check||{}),embeddable:false,reason:'iframe-load-failed'});
    if(status)status.textContent='Player could not load in-page • source available in a new tab';
  };
  frame.onload=()=>{
    if(finished||requestId!==state.animeEmbedRequestId)return;
    finished=true;
    if(state.animeFrameTimer){clearTimeout(state.animeFrameTimer);state.animeFrameTimer=null}
    frame.onload=null;frame.onerror=null;
    if(status)status.textContent='Player loaded in AZOBSSTV • use Open Source if playback is refused';
  };
  frame.onerror=fail;
  state.animeFrameTimer=setTimeout(fail,12000);
}

function setupAnimeSourceFallback(series,ep,check){
  const blocked=$('#animeEmbedBlocked'),openBtn=$('#animeOpenSourceBtn'),status=$('#animePlayerSourceStatus');
  const cats=contentCategories(series);
  const meta=[series?.year?String(series.year):'',series?.episodeCount?`${series.episodeCount} episodes`:'',...cats.slice(0,4)].filter(Boolean).join(' • ');

  if(openBtn){
    openBtn.textContent='Open Source';
    openBtn.href=ep.url;
    openBtn.target='_blank';
    openBtn.rel='noopener noreferrer';
    openBtn.onclick=null;
  }

  if(blocked){
    blocked.hidden=false;
    blocked.innerHTML=`<div class="anime-live-fallback-poster" aria-hidden="true"></div>
      <div class="anime-live-fallback-shade" aria-hidden="true"></div>
      <div class="anime-live-fallback-content">
        <button type="button" class="anime-live-fallback-play anime-live-fallback-play-blocked" id="animeSourceFallbackBtn" aria-label="Open source in a new tab">↗</button>
        <strong>${esc(series?.name||'Anime')}</strong>
        <span class="anime-live-fallback-episode">${esc(animeEpisodeDisplay(ep,0))}</span>
        ${meta?`<span class="anime-live-fallback-meta">${esc(meta)}</span>`:''}
        <span class="anime-live-fallback-note">This provider does not permit reliable in-page playback. Open Source launches the provider in a new tab while AZOBSSTV stays open.</span>
      </div>`;

    const poster=blocked.querySelector('.anime-live-fallback-poster');
    if(poster&&series?.logo){
      try{poster.style.backgroundImage=`url("${String(series.logo).replace(/["\\]/g,'')}")`}catch{}
    }

    $('#animeSourceFallbackBtn')?.addEventListener('click',()=>{
      const opened=openAnimeSourceNewTab(ep);
      if(status)status.textContent=opened?'Source opened in a new tab • AZOBSSTV remains here':'Popup blocked • use Open Source above';
    });
  }

  const reason=String(check?.reason||'');
  if(status){
    status.textContent=/timeout|unavailable/i.test(reason)
      ?'Player check timed out • source is still available in a new tab'
      :'In-page playback unavailable • source can open in a new tab';
  }
}

async function showAnimeEpisodePlayer(series,ep){
  hideOfficialPlayer();
  stopHls();
  clearTimeout(state.videoCheckTimer);
  clearAnimeFrameWatchdog();
  const v=$('#tvPlayer');
  try{v.pause()}catch{}
  v.removeAttribute('src');v.load();
  hidePlayerPlaceholder();hidePlayerError();

  const panel=$('#animePlayerPanel'),blocked=$('#animeEmbedBlocked');
  let frame=createFreshAnimeFrame();
  const openBtn=$('#animeOpenSourceBtn'),label=$('#animePlayerEpisodeLabel'),status=$('#animePlayerSourceStatus');
  if(!panel||!frame)return;
  panel.hidden=false;
  setAnimeFallbackDisplayMode(false);
  setAnimeEmbedCompactMode(true);
  if(blocked){
    blocked.hidden=true;
    blocked.innerHTML='';
  }
  frame.hidden=true;
  showAnimeCheckingState(series,ep);
  if(openBtn){
    openBtn.href=ep.url;
    openBtn.textContent='Open Source';
    openBtn.onclick=null;
    openBtn.target='_blank';
    openBtn.rel='noopener noreferrer';
  }
  if(label)label.textContent=animeEpisodeDisplay(ep,0);
  if(status)status.textContent='Checking whether the source allows embedding…';
  $('#pipBtn').disabled=true;

  const requestId=++state.animeEmbedRequestId;
  const check=await animeResolveWithDeadline(ep.url,10000);
  if(requestId!==state.animeEmbedRequestId)return;
  if(check.embeddable&&check.embed_url&&isSafeAnimeEmbedPageUrl(check.embed_url)){
    setAnimeFallbackDisplayMode(false);
    setAnimeEmbedCompactMode(false);
    if(status)status.textContent='Loading verified HTML player…';
    frame.hidden=false;
    startAnimeFrameWatchdog(series,ep,check,requestId);
    frame.src=check.embed_url;
    if(openBtn){
      openBtn.textContent='Open Source';
      openBtn.onclick=null;
      openBtn.target='_blank';
      openBtn.rel='noopener noreferrer';
    }
  }else{
    setAnimeEmbedCompactMode(false);
    setAnimeFallbackDisplayMode(true);
    frame.hidden=true;
    setupAnimeSourceFallback(series,ep,check);
  }
}
function focusAnimePlayerArea(){
  const hero=document.querySelector('.hero-grid'),player=document.querySelector('.player-card');
  const target=player||hero;
  if(!target)return;
  const sticky=document.querySelector('.market-sticky-bar');
  const stickyHeight=Math.max(0,Math.round(sticky?.getBoundingClientRect().height||0));
  const top=Math.max(0,target.getBoundingClientRect().top+window.scrollY-stickyHeight-10);
  window.scrollTo({top,behavior:'smooth'});
  player?.classList.remove('anime-player-focus-pulse');
  requestAnimationFrame(()=>player?.classList.add('anime-player-focus-pulse'));
  setTimeout(()=>player?.classList.remove('anime-player-focus-pulse'),1300);
}
function playAnimeEpisode(series,ep){
  if(!series||!ep||!ep.url)return;
  state.current=series;
  markRecent(series);
  $('#nowTitle').textContent=series.name;
  $('#nowMeta').textContent=animeEpisodeDisplay(ep,0);
  $('#favCurrentBtn').classList.toggle('active',state.favorites.has(channelKey(series)));
  renderAnimeSideEpisodes(series,ep.url);
  showAnimeEpisodePlayer(series,ep);
  focusAnimePlayerArea();
  setTimeout(focusAnimePlayerArea,120);
}
function renderAnimeEpisodePage(series){
  const view=$('#animeDetailView');
  if(!view||!series)return;
  const eps=ensureAnimeEpisodes(series);
  const q=String(state.animeEpisodeSearch||'').trim().toLowerCase();
  const filtered=eps.map((ep,index)=>({ep,index})).filter(x=>animeEpisodeMatches(x.ep,q));
  const perPage=60;
  const pages=Math.max(1,Math.ceil(filtered.length/perPage));
  state.animePage=Math.min(Math.max(1,state.animePage||1),pages);
  const start=(state.animePage-1)*perPage;
  const pageRows=filtered.slice(start,start+perPage);

  const list=view.querySelector('#animeEpisodeList');
  const pager=view.querySelector('#animeEpisodePager');
  const count=view.querySelector('#animeEpisodeCount');
  if(count)count.textContent=q?`${filtered.length} / ${eps.length} episodeses`:`${eps.length} episodes`;
  if(list){
    list.innerHTML=pageRows.map(({ep,index})=>`<button class="anime-episode-row" type="button" data-anime-episode="${index}"><span class="anime-episode-no">${esc(ep.number?`EP ${ep.number}`:`EP ${index+1}`)}</span><span class="anime-episode-title">${esc(ep.title||ep.label||`Episode ${index+1}`)}</span><span class="anime-episode-play">▶</span></button>`).join('')||'<div class="anime-episode-empty">No matching episodes.</div>';
    $$('[data-anime-episode]',list).forEach(btn=>btn.addEventListener('click',()=>{
      const ep=eps[Number(btn.dataset.animeEpisode)];
      if(ep)playAnimeEpisode(series,ep);
    }));
  }
  if(pager){
    pager.innerHTML=pages>1?`<button type="button" data-anime-page="prev" ${state.animePage<=1?'disabled':''}>‹ Previous</button><span>Page ${state.animePage} / ${pages}</span><button type="button" data-anime-page="next" ${state.animePage>=pages?'disabled':''}>Next ›</button>`:'';
    $$('[data-anime-page]',pager).forEach(btn=>btn.addEventListener('click',()=>{
      state.animePage+=btn.dataset.animePage==='next'?1:-1;
      renderAnimeEpisodePage(series);
      view.querySelector('.anime-episode-tools')?.scrollIntoView({block:'nearest'});
    }));
  }
}
function hideMoviePlayer(){
  const panel=$('#moviePlayerPanel');
  if(panel)panel.hidden=true;
  const wrap=$('#videoWrap');
  if(wrap)wrap.classList.remove('movie-detail-mode');
}
function ensureMoviePlayerPanel(){
  const wrap=$('#videoWrap');
  if(!wrap)return null;
  let panel=$('#moviePlayerPanel');
  if(panel)return panel;
  panel=document.createElement('div');
  panel.id='moviePlayerPanel';
  panel.className='movie-player-panel';
  panel.hidden=true;
  wrap.appendChild(panel);
  return panel;
}
function renderMoviePlayer(movie){
  const panel=ensureMoviePlayerPanel();
  const wrap=$('#videoWrap');
  if(!panel||!wrap)return;
  const source=movie.sourcePage||movie.url||'#';
  const art=String(movie.logo||'').trim();
  wrap.classList.add('movie-detail-mode');
  panel.hidden=false;
  panel.innerHTML=`<div class="movie-player-backdrop" ${art?`style="background-image:linear-gradient(90deg,rgba(5,9,17,.94) 0%,rgba(5,9,17,.72) 46%,rgba(5,9,17,.16) 100%),url('${esc(art)}')"`:''}></div>
    <div class="movie-player-content">
      <span class="movie-player-kicker">MOVIE • 7MOVIES</span>
      <h2>${esc(movie.name||'Movie')}</h2>
      <div class="movie-player-meta">${movie.year?`<span>${esc(movie.year)}</span>`:''}${movie.rating?`<span>★ ${esc(movie.rating)}</span>`:''}</div>
      <p>Movie details are shown inside AZOBSSTV. The original source opens separately because the provider does not allow its full page to be embedded here.</p>
      <div class="movie-player-actions">
        <a class="movie-player-open" href="${esc(source)}" target="_blank" rel="noopener noreferrer">Open Source ↗</a>
        <button class="movie-player-fav ${state.favorites.has(channelKey(movie))?'active':''}" type="button">♥ Favorite</button>
      </div>
    </div>`;
  panel.querySelector('.movie-player-fav')?.addEventListener('click',()=>{
    toggleFav(movie);
    const b=panel.querySelector('.movie-player-fav');
    if(b)b.classList.toggle('active',state.favorites.has(channelKey(movie)));
  });
}
function showMovieDetail(movie,scroll=true){
  if(!movie)return;
  state.movieDetail=movie;state.animeDetail=null;state.current=movie;markRecent(movie);
  hideAnimePlayer();hideOfficialPlayer();stopHls();clearTimeout(state.videoCheckTimer);
  const v=$('#tvPlayer');try{v.pause()}catch{}v.removeAttribute('src');try{v.load()}catch{}
  hidePlayerPlaceholder();hidePlayerError();
  renderMoviePlayer(movie);
  $('#nowTitle').textContent=movie.name;
  $('#nowMeta').textContent=cardSubline(movie)+' • 7Movies source';
  $('#pipBtn').disabled=true;syncButtonState();
  $('#favCurrentBtn').classList.toggle('active',state.favorites.has(channelKey(movie)));

  // v1021: keep the native Movies catalogue visible below the player, like Live TV.
  const detail=$('#animeDetailView');if(detail){detail.hidden=true;detail.innerHTML=''}
  $('#browserToolbar').hidden=false;$('#channelGrid').hidden=false;$('#guideView').hidden=true;$('#contentState').hidden=true;
  renderChannelRail(state.channels.filter(c=>mediaType(c)==='movies'));
  restoreTodayScheduleHeading();
  const label=$('#todayScheduleChannel'),box=$('#todayScheduleList');
  if(label)label.textContent='Movies';
  if(box)box.innerHTML='<div class="today-schedule-empty">Movie selected. Use “Open Source ↗” in the player area to open the original 7Movies detail page.</div>';
  if(scroll){
    const card=document.querySelector('.player-card');
    card?.scrollIntoView({behavior:'smooth',block:'start'});
  }
}

function showAnimeDetail(series,scroll=true){
  if(!series)return;
  hideMoviePlayer();
  state.animeDetail=series;
  state.animePage=1;
  state.animeEpisodeSearch='';
  markRecent(series);

  // v1008: no separate Anime detail card at the bottom.
  // Keep the Anime grid/search visible and use the main player + right rail only.
  $('#animeDetailView').hidden=true;
  $('#animeDetailView').innerHTML='';
  $('#browserToolbar').hidden=false;
  $('#channelGrid').hidden=false;
  $('#guideView').hidden=true;
  $('#contentState').hidden=true;

  renderAnimeSideEpisodes(series);
  const eps=ensureAnimeEpisodes(series);
  if(eps.length){
    playAnimeEpisode(series,eps[0]);
  }else{
    state.current=series;
    $('#nowTitle').textContent=series.name;
    $('#nowMeta').textContent='No episodes are available.';
    renderChannelRail();
    if(scroll)focusAnimePlayerArea();
  }
}
function hideOfficialPlayer(){setOfficialWide(false);const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');if(wrap){wrap.classList.remove('official-mode');wrap.classList.remove('portal-mode')}if(panel)panel.hidden=true;if(state.officialResizeObserver){try{state.officialResizeObserver.disconnect()}catch{}state.officialResizeObserver=null}if(frame){frame.style.transform='';frame.style.left='0';frame.style.top='0';frame.style.width='';frame.style.height='';frame.setAttribute('scrolling','no');try{frame.src='about:blank'}catch{}}const btn=$('#portalOpenExternalBtn');if(btn)btn.hidden=true}
function showPortalPlayer(c){
  hideAnimePlayer();restoreTodayScheduleHeading();
  const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame'),url=c.officialUrl||c.sourcePage||c.url;
  stopHls();clearTimeout(state.videoCheckTimer);
  const v=$('#tvPlayer');try{v.pause()}catch{}v.removeAttribute('src');v.load();hidePlayerPlaceholder();hidePlayerError();
  if(wrap){wrap.classList.add('official-mode');wrap.classList.add('portal-mode')}
  if(panel)panel.hidden=false;
  if(state.officialResizeObserver){try{state.officialResizeObserver.disconnect()}catch{}state.officialResizeObserver=null}
  if(frame&&url){
    frame.style.transform='none';frame.style.left='0';frame.style.top='0';frame.style.width='100%';frame.style.height='100%';
    frame.setAttribute('scrolling','yes');
    frame.src=url;
  }
  let btn=$('#portalOpenExternalBtn');
  if(!btn&&panel){btn=document.createElement('a');btn.id='portalOpenExternalBtn';btn.className='portal-open-external';btn.target='_blank';btn.rel='noopener noreferrer';btn.textContent='Open in new tab ↗';panel.appendChild(btn)}
  if(btn){btn.href=url||'#';btn.hidden=!url}
  const label=$('#todayScheduleChannel'),box=$('#todayScheduleList');if(label)label.textContent=c?.name||'Movies';if(box)box.innerHTML='<div class="today-schedule-empty">Browse movies in the player area. If the provider blocks embedding, use “Open in new tab”.</div>';
  $('#nowMeta').textContent='Embedded movie source';
  $('#pipBtn').disabled=true;syncButtonState();
}
function hideOfficialPlayer(){setOfficialWide(false);const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');if(wrap)wrap.classList.remove('official-mode');if(panel)panel.hidden=true;if(state.officialResizeObserver){try{state.officialResizeObserver.disconnect()}catch{}state.officialResizeObserver=null}if(frame){frame.style.transform='';frame.style.left='0';frame.style.top='0';try{frame.src='about:blank'}catch{}}}
function showOfficialPlayer(c){hideAnimePlayer();restoreTodayScheduleHeading();const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');const url=c.officialUrl||c.sourcePage||c.url;stopHls();clearTimeout(state.videoCheckTimer);const v=$('#tvPlayer');try{v.pause()}catch{}v.removeAttribute('src');v.load();hidePlayerPlaceholder();hidePlayerError();if(wrap)wrap.classList.add('official-mode');if(panel)panel.hidden=false;if(frame&&url)frame.src=url;startOfficialAutoFit();loadCurrentSchedule(c);$('#pipBtn').disabled=true;syncButtonState()}
function play(c){
  if(!c)return;
  if(mediaType(c)==='movies'&&String(c.mode||'').toLowerCase()==='movie-detail'){showMovieDetail(c);return}
  hideMoviePlayer();
  if(mediaType(c)==='series'&&c.webOnly){showAnimeDetail(c);return}
  if(c.webOnly){const target=c.sourcePage||c.url;if(target)window.open(target,'_blank','noopener,noreferrer');return}
  hideAnimePlayer();restoreTodayScheduleHeading();
  const mode=String(c.mode||'').toLowerCase();
  state.current=c;markRecent(c);renderChannelRail();hidePlayerPlaceholder();hidePlayerError();$('#nowTitle').textContent=c.name;$('#nowMeta').textContent='Loading program title…';$('#favCurrentBtn').classList.toggle('active',state.favorites.has(channelKey(c)));syncButtonState();
  if(mode==='portal'){showPortalPlayer(c);return}
  if(mode==='official'){showOfficialPlayer(c);return}
  hideOfficialPlayer();$('#pipBtn').disabled=false;
  if(!isAllowed(c.url)){alert('This stream domain is not allowed by the AZOBSSTV configuration.');return}
  const v=$('#tvPlayer');stopHls();clearTimeout(state.videoCheckTimer);v.removeAttribute('src');v.load();v.onerror=null;
  v.onloadedmetadata=()=>{setPlaybackMeta();watchVideoPicture(v)};v.onplaying=()=>{watchVideoPicture(v);if(mediaType(c)==='live')startDirectAvSyncGuard(c,v,'Direct')};v.onresize=()=>setPlaybackMeta();
  v.onwaiting=v.onstalled=()=>{if(mediaType(c)!=='live')return;clearTimeout(state.avStallTimer);state.avStallTimer=setTimeout(()=>{if(state.current===c&&!v.paused&&v.readyState<3)resyncCurrentPlayback('stall')},2400)};
  v.oncanplay=()=>{if(state.avStallTimer){clearTimeout(state.avStallTimer);state.avStallTimer=null}};
  v.onerror=()=>{setPlaybackMeta('Playback failed / incompatible format');showPlayerError('The browser cannot play this stream. Try another channel or check the stream source.')};

  const isHls=/\.m3u8($|\?)/i.test(c.url);
  if(isHls&&window.Hls&&Hls.isSupported()){
    const candidates=mode==='auto'?[{url:c.url,label:'Direct'},{url:proxiedStreamUrl(c.url),label:'Relay'}]:[{url:mode==='proxy'?proxiedStreamUrl(c.url):c.url,label:mode==='proxy'?'Relay':'Direct'}];
    let idx=0;
    const tryCandidate=()=>{
      if(idx>=candidates.length){setPlaybackMeta('HLS failed');showPlayerError('HLS failed through both the direct connection and backend relay. The source may be temporarily rejecting browser/server connections.');return}
      const candidate=candidates[idx++];
      stopHls();hidePlayerError();setPlaybackMeta('HLS • '+candidate.label+' • Loading…');
      state.hls=new Hls({enableWorker:true,lowLatencyMode:true,capLevelToPlayerSize:true,startLevel:-1,maxBufferLength:18,backBufferLength:15,liveSyncDurationCount:3,liveMaxLatencyDurationCount:6,maxLiveSyncPlaybackRate:1.05,maxAudioFramesDrift:1,forceKeyFrameOnDiscontinuity:true,stretchShortVideoTrack:true,xhrSetup:xhr=>{if(c.headers.authorization&&candidate.label!=='Relay'){try{xhr.setRequestHeader('Authorization',c.headers.authorization)}catch{}}}});
      state.hls.loadSource(candidate.url);state.hls.attachMedia(v);
      let manifestReady=false;
      state.hls.on(Hls.Events.MANIFEST_PARSED,(_,data)=>{manifestReady=true;hidePlayerError();const av=(data.levels||[]).filter(x=>(x.videoCodec||'').length);if(av.length){const h264=av.findIndex(x=>/^avc1/i.test(x.videoCodec||''));if(h264>=0)state.hls.startLevel=h264}setPlaybackMeta('HLS • '+candidate.label);if(mediaType(c)==='live')startDirectAvSyncGuard(c,v,candidate.label);v.play().catch(()=>{})});
      state.hls.on(Hls.Events.LEVEL_SWITCHED,(_,d)=>{const lvl=state.hls?.levels?.[d.level];if(lvl){const detail=[candidate.label,lvl.width&&lvl.height?`${lvl.width}×${lvl.height}`:'',lvl.videoCodec||''].filter(Boolean).join(' ');setPlaybackMeta(detail)}});
      state.hls.on(Hls.Events.ERROR,(_,d)=>{
        if(!d.fatal)return;
        if(d.type===Hls.ErrorTypes.MEDIA_ERROR){state.hls.recoverMediaError();return}
        const code=d?.response?.code||d?.response?.status||'';
        if(mode==='auto'&&idx<candidates.length){showPlayerError('Connection '+candidate.label+' failed'+(code?' (HTTP '+code+')':'')+'. Trying '+candidates[idx].label+'…');setTimeout(tryCandidate,250);return}
        stopHls();setPlaybackMeta('HLS failed');showPlayerError('HLS failed to load'+(code?' (HTTP '+code+')':'')+'. '+(mode==='auto'?'Direct and relay were both tried.':'The source may be temporarily unavailable.'));
      });
      // Some CORS/network failures can stall before a fatal callback on certain Chromium builds.
      setTimeout(()=>{if(state.current===c&&!manifestReady&&state.hls&&mode==='auto'&&idx<candidates.length){tryCandidate()}},12000);
    };
    tryCandidate();
  }else if(/\.mpd($|\?)/i.test(c.url)&&window.dashjs){
    try{state.dash=dashjs.MediaPlayer().create();state.dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED,()=>{hidePlayerError();setPlaybackMeta('MPEG-DASH');v.play().catch(()=>{})});state.dash.on(dashjs.MediaPlayer.events.ERROR,e=>{const msg=e?.error?.message||e?.event?.message||e?.message||'DASH playback error';setPlaybackMeta('DASH failed');showPlayerError('MPEG-DASH failed: '+msg)});state.dash.initialize(v,playbackUrl(c),true);setPlaybackMeta('MPEG-DASH • Loading…')}catch(e){setPlaybackMeta('DASH failed');showPlayerError('DASH failed: '+(e&&e.message?e.message:'unknown'))}
  }else if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=playbackUrl(c);v.play().catch(()=>{setPlaybackMeta('Press Play, or the stream may not be compatible with this browser.')})}
  else{v.src=playbackUrl(c);v.play().catch(()=>{setPlaybackMeta('Press Play, or the stream may not be compatible with this browser.')})}
}
async function loadPlaylist(url,name='AZOBSSTV Free'){
  if(!url)throw new Error('Playlist URL is empty');
  if(!isAllowed(url)&&!url.startsWith(API_BASE))throw new Error('Playlist domain not allowed');
  $('#playlistStatus').textContent='Loading…';
  $('#playlistStatus').className='';

  const defaultUrl=state.config?.free_playlist_url||API_BASE+'/playlist/free';
  const isDefaultFree=url===defaultUrl||url===API_BASE+'/playlist/free';
  let parsed=[];
  let primaryError=null;
  let usedLocalFallback=false;

  try{
    const raw=await smartTextGet(url,'playlist',60000);
    parsed=parseM3U(raw).map(applyLocalLiveArtwork);
  }catch(e){
    primaryError=e;
    if(!isDefaultFree)throw e;
    console.warn('AZOBSSTV primary playlist unavailable; using local fallback:',e?.message||e);
  }

  if(isDefaultFree&& !parsed.length){
    try{
      const raw=await localTextGet('./data/free.m3u?v=1021',5000);
      parsed=parseM3U(raw).map(applyLocalLiveArtwork);
      if(parsed.length){
        usedLocalFallback=true;
        name='Mana-Mana Local / AZOBSSTV';
      }
    }catch(e){
      console.warn('AZOBSSTV local Live TV fallback unavailable:',e?.message||e);
    }
  }

  if(isDefaultFree){
    try{
      const liveCatalog=await loadMana2PublicCatalog();
      if(liveCatalog.length){
        parsed=liveCatalog;
        usedLocalFallback=false;
        name='Mana-Mana Live / AZOBSSTV';
      }
    }catch(e){
      console.warn('Mana-Mana dynamic catalogue unavailable; keeping local fallback:',e?.message||e);
    }
    parsed.filter(c=>!c.webOnly).forEach(c=>state.trustedDemoUrls.add(c.url));
    if(!name)name='Mana-Mana / AZOBSSTV';
  }

  parsed=appendBuiltInMovieSources(parsed);

  try{
    const movieCatalog=await loadMovieCatalog();
    if(movieCatalog.length)parsed=[...parsed,...movieCatalog];
  }catch(e){
    console.warn('Movies catalogue load skipped:',e?.message||e);
  }

  try{
    const animeCatalog=await loadAnimeCatalog();
    if(animeCatalog.length)parsed=[...parsed,...animeCatalog];
  }catch(e){
    console.warn('Anime catalogue load skipped:',e?.message||e);
  }

  if(!parsed.length){
    throw primaryError||new Error('No local or online catalogue is available');
  }

  state.channels=parsed;
  $('#channelCount').textContent=String(state.channels.length);
  $('#playlistStatus').textContent=usedLocalFallback?name+' • Offline fallback':name;
  $('#playlistStatus').className=state.channels.length?'ok':'warn';
  fillGroups();
  render();
  if(isSignedIn())setTimeout(()=>loadCloudUserLibrary(false),30);
}
function parseXmltvDate(value){const s=String(value||'').trim();const m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-]\d{4}))?/);if(!m)return 0;const [,Y,M,D,h,mi,se='00',tz='+0000']=m;const sign=tz[0]==='-'?-1:1;const off=(Number(tz.slice(1,3))*60+Number(tz.slice(3,5)))*sign;return Date.UTC(+Y,+M-1,+D,+h,+mi,+se)-off*60000}
async function loadEpg(){const url=state.config?.epg_url;if(!url)return;try{const xml=await smartTextGet(url,'epg',120000);const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Invalid XMLTV');state.epg.clear();const now=Date.now();[...doc.querySelectorAll('programme')].slice(0,50000).forEach(p=>{const id=p.getAttribute('channel')||'';if(!id)return;const start=parseXmltvDate(p.getAttribute('start'));const stop=parseXmltvDate(p.getAttribute('stop'));const title=p.querySelector('title')?.textContent?.trim()||'';if(!title)return;const bucket=state.epg.get(id)||{current:null,next:null};if(start<=now&&(!stop||stop>now))bucket.current={title,start,stop};else if(start>now&&(!bucket.next||start<bucket.next.start))bucket.next={title,start,stop};state.epg.set(id,bucket)});$('#epgStatus').textContent=state.epg.size?'Ready':'No data';$('#epgStatus').className=state.epg.size?'ok':''}catch(e){$('#epgStatus').textContent='Failed';$('#epgStatus').className='warn'}}
function renderGuide(){renderChannelRail(state.channels.filter(c=>mediaType(c)==='live'));const rows=state.channels.filter(c=>mediaType(c)==='live').map(c=>({c,e:state.epg.get(c.id)||{}}));$('#channelGrid').hidden=true;$('#contentState').hidden=!!rows.length;$('#guideView').hidden=false;$('#guideView').innerHTML=rows.slice(0,800).map(x=>`<div class="guide-row"><div class="guide-channel">${esc(x.c.name)}</div><div class="guide-program"><strong>${esc(x.e.current?.title||'No EPG information')}</strong>${x.e.next?`<small>Next: ${esc(x.e.next.title)}</small>`:''}</div></div>`).join('')}
function getInstallId(){let id=localStorage.getItem('azobsstv_install_id');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()+'-'+Math.random().toString(16).slice(2));localStorage.setItem('azobsstv_install_id',id)}return id}
function extractUsername(raw){try{const u=new URL(raw);for(const k of ['username','user','login']){const v=u.searchParams.get(k);if(v)return v}if(u.username)return decodeURIComponent(u.username);const p=u.pathname;let m=p.match(/\/(?:player_api\.php|get\.php|panel_api\.php)\/([^/?\s]+)\/([^/?\s]+)/i);if(m)return decodeURIComponent(m[1]);m=p.match(/\/(?:live|movie|series)\/([^/?\s]+)\/([^/?\s]+)\//i);if(m)return decodeURIComponent(m[1])}catch{}return''}
async function ping(reason){if(document.visibilityState==='hidden'&&reason==='heartbeat')return;const url=state.config?.device_ping_url||API_BASE+'/device/ping';const account=JSON.parse(localStorage.getItem('azobsstv_playlist')||'null');const source=account?.url||state.config?.free_playlist_url||'';const payload={device_id:getInstallId(),username:account?extractUsername(source):'free',account_name:account?.name||'AZOBSSTV Free',account_id:account?'custom':'free_azobsstv',time:Math.floor(Date.now()/1000),time_ms:Date.now(),reason,app_version:'1.0.1021',app_version_code:1021,device_model:navigator.userAgent.slice(0,180),android_release:''};try{await fetchWithTimeout(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),keepalive:true},15000)}catch{}}
function normalizeNotice(item,index){if(!item||typeof item!=='object')return null;const message=String(item.message??item.body??'').trim();if(!message)return null;return{id:String(item.id??item.uuid??index),title:String(item.title||'AZOBSSTV'),message,timestamp:Number(item.timestamp||item.time||Date.now())||Date.now()}}
async function loadNotice(){if(document.visibilityState==='hidden')return;try{const data=await jget(state.config?.notification_url||API_BASE+'/notifications',30000);const raw=Array.isArray(data)?data:(Array.isArray(data.items)?data.items:[]);const items=raw.map(normalizeNotice).filter(Boolean);const item=items.at(-1);if(item){const last=localStorage.getItem('azobsstv_notice_last_id');$('#serverNotice').hidden=false;$('#serverNotice').innerHTML=`<strong>${esc(item.title)}</strong><span>${esc(item.message)}</span>`;if(last!==item.id)localStorage.setItem('azobsstv_notice_last_id',item.id)}else $('#serverNotice').hidden=true}catch{}}
function startForegroundLoops(){if(state.heartbeatTimer)clearInterval(state.heartbeatTimer);if(state.noticeTimer)clearInterval(state.noticeTimer);state.heartbeatTimer=setInterval(()=>ping('heartbeat'),30000);state.noticeTimer=setInterval(loadNotice,60000)}
function stopForegroundLoops(){if(state.heartbeatTimer)clearInterval(state.heartbeatTimer);if(state.noticeTimer)clearInterval(state.noticeTimer);state.heartbeatTimer=null;state.noticeTimer=null}
function setTab(tab){const leavingMovie=tab!=='movies'&&state.current&&mediaType(state.current)==='movies';state.tab=tab;state.animeDetail=null;state.movieDetail=null;$('#animeDetailView').hidden=true;$('#animeDetailView').innerHTML='';$('#browserToolbar').hidden=false;$('#channelGrid')?.classList.toggle('anime-grid',tab==='series');$('#channelGrid')?.classList.toggle('movie-grid',tab==='movies');if(tab!=='movies'){hideMoviePlayer();if(leavingMovie){state.current=null;$('#nowTitle').textContent='AZOBSSTV';$('#nowMeta').textContent='No channel selected.';showPlayerPlaceholder();$('#pipBtn').disabled=true;$('#favCurrentBtn').classList.remove('active');syncButtonState()}}$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));fillGroups();tab==='guide'?renderGuide():render()}

function setEnglishNavLabel(el,text,title=''){
  if(!el)return;
  const spans=[...el.querySelectorAll('span')].filter(s=>String(s.textContent||'').trim());
  const target=spans.length?spans[spans.length-1]:null;
  if(target)target.textContent=text;else el.textContent=text;
  if(title)el.title=title;
  el.setAttribute('aria-label',text);
}
function localizeAZOBSSTVNavigation(){
  const bar=document.querySelector('.market-sticky-bar');
  if(!bar)return;
  bar.querySelectorAll('a[href="/Perkhidmatan-Ukur-Tanah/"],a[href="/Perkhidmatan-Ukur-Tanah"]').forEach(a=>
    setEnglishNavLabel(a,'Land Survey','Certified Plan & Land Survey Services'));
  bar.querySelectorAll('a[href="/Tempah-Website/"],a[href="/Tempah-Website"],a[data-az-website-order-link="1"]').forEach(a=>
    setEnglishNavLabel(a,'Build Website','Website Services for Business'));
  bar.querySelectorAll('[data-az-repair-physical-link="1"]').forEach(a=>{
    const strong=a.querySelector('strong'),small=a.querySelector('small');
    if(strong)strong.textContent='PC & Laptop Service';
    if(small)small.textContent='Physical repairs, formatting and in-store service';
    a.title='Book Laptop / PC Service';
    a.setAttribute('aria-label','PC & Laptop Service');
  });
  bar.querySelectorAll('[data-az-repair-online-link="1"]').forEach(a=>{
    const strong=a.querySelector('strong'),small=a.querySelector('small');
    if(strong)strong.textContent='Online PC Troubleshooting';
    if(small)small.textContent='Remote PC diagnostics and repair';
    a.setAttribute('aria-label','Online PC Troubleshooting');
  });
  bar.querySelectorAll('.az-repair-trigger').forEach(b=>b.setAttribute('aria-label','Repair PC menu'));
  bar.querySelectorAll('.az-repair-dropdown').forEach(d=>d.setAttribute('aria-label','Repair PC options'));
  bar.querySelectorAll('a[data-az-repair-service-link="1"],a[href="/Tempah-Servis-IT/"],a[href="/Tempah-Servis-IT"]').forEach(a=>{
    if(!a.closest('.az-repair-dropdown'))setEnglishNavLabel(a,'Repair PC','Book Laptop / PC Service');
  });
}
function bindEnglishAZOBSSTVNavigation(){
  localizeAZOBSSTVNavigation();
  const bar=document.querySelector('.market-sticky-bar');
  if(!bar)return;
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;localizeAZOBSSTVNavigation()});
  });
  observer.observe(bar,{subtree:true,childList:true,attributes:true,attributeFilter:['href','title','aria-label']});
}

function bindOfficialScrollBridge(){
  const zones=$$('[data-official-scroll-bridge]');
  if(!zones.length)return;
  const forwardWheel=e=>{
    const panel=$('#officialPlayerPanel');
    if(!panel||panel.hidden)return;
    e.preventDefault();
    e.stopPropagation();
    const scale=e.deltaMode===1?16:e.deltaMode===2?Math.max(window.innerHeight,1):1;
    const dx=(Number(e.deltaX)||0)*scale;
    const dy=(Number(e.deltaY)||0)*scale;
    window.scrollBy({left:dx,top:dy,behavior:'auto'});
  };
  zones.forEach(zone=>zone.addEventListener('wheel',forwardWheel,{passive:false}));
}

function bind(){[$('#searchInput'),$('#groupSelect')].forEach(el=>el.addEventListener('input',()=>state.tab==='guide'?renderGuide():render()));$$('.tab').forEach(t=>t.addEventListener('click',()=>setTab(t.dataset.tab)));$('#favCurrentBtn').addEventListener('click',()=>toggleFav(state.current));$('#officialExpandHotspot')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggleOfficialWide()});$('#animeClosePlayerBtn')?.addEventListener('click',()=>{hideAnimePlayer();$('#playerEmpty').hidden=false;$('#nowTitle').textContent='AZOBSSTV';$('#nowMeta').textContent='Choose content to start watching.';$('#pipBtn').disabled=true});$('#avSyncBtn').addEventListener('click',()=>{if(!resyncCurrentPlayback('manual')){const c=state.current;if(c&&mediaType(c)==='live')setPlaybackMeta('A/V sync is already near live')}});$('#pipBtn').addEventListener('click',async()=>{const v=$('#tvPlayer');try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(document.pictureInPictureEnabled&&!v.paused)await v.requestPictureInPicture()}catch{}});$('#accountBtn').addEventListener('click',()=>$('#playlistDialog').showModal());$('#refreshBtn').addEventListener('click',()=>boot(true));$('#installBtn').addEventListener('click',async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('#installBtn').hidden=true});$('#playlistForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('#playlistName').value.trim()||'My Playlist';const url=$('#playlistUrl').value.trim();if(!url)return;localStorage.setItem('azobsstv_playlist',JSON.stringify({name,url}));$('#playlistDialog').close();try{await loadPlaylist(url,name)}catch(err){alert(err.message)}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.officialWide)setOfficialWide(false)});bindOfficialScrollBridge();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const away=state.hiddenAt?Date.now()-state.hiddenAt:0;state.hiddenAt=0;ping('heartbeat');loadNotice();startForegroundLoops();if(away>12000&&currentIsLive())setTimeout(()=>resyncCurrentPlayback('resume'),260)}else{state.hiddenAt=Date.now();stopForegroundLoops()}});window.addEventListener('online',()=>{if(currentIsLive())setTimeout(()=>resyncCurrentPlayback('network'),700)});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('#installBtn').hidden=false});window.addEventListener('azobss-auth-changed',syncAuthLibrary);window.addEventListener('storage',syncAuthLibrary);window.addEventListener('focus',syncAuthLibrary)}

function catalogNonAnime(){
  return state.channels.filter(c=>mediaType(c)!=='series');
}
function catalogAnime(){
  return state.channels.filter(c=>mediaType(c)==='series');
}
function catalogMovies(){
  return state.channels.filter(c=>mediaType(c)==='movies');
}

function refreshCatalogView(statusText=''){
  $('#channelCount').textContent=String(state.channels.length);
  if(statusText){
    $('#playlistStatus').textContent=statusText;
    $('#playlistStatus').className=state.channels.length?'ok':'warn';
  }
  fillGroups();

  // Avoid destroying an Anime detail page that the user has already opened
  // while a slow background Render request finally completes.
  if(state.movieDetail&&state.tab==='movies'){
    const movies=state.channels.filter(c=>mediaType(c)==='movies');
    state.filtered=movies;renderChannelRail(movies);return;
  }
  if(state.animeDetail&&state.tab==='series'){
    const q=$('#searchInput').value.trim().toLowerCase();
    const grp=$('#groupSelect').value;
    const list=state.channels.filter(c=>{
      if(mediaType(c)!=='series')return false;
      const cats=contentCategories(c);
      if(grp&&!cats.includes(grp))return false;
      if(!q)return true;
      return [c.name,c.group,...cats].join(' ').toLowerCase().includes(q);
    });
    state.filtered=list;
    renderChannelRail(list);
    return;
  }
  render();
}
function replaceLiveCatalog(live,statusText=''){
  const rows=Array.isArray(live)?live.filter(Boolean).map(applyLocalLiveArtwork):[];
  if(!rows.length)return false;
  rows.filter(c=>!c.webOnly).forEach(c=>state.trustedDemoUrls.add(c.url));
  state.channels=[...rows,...catalogMovies(),...catalogAnime()];
  refreshCatalogView(statusText);
  return true;
}
function replaceMovieCatalog(movies,statusText=''){
  const rows=Array.isArray(movies)?movies.filter(Boolean):[];
  if(!rows.length)return false;
  state.channels=[...state.channels.filter(c=>mediaType(c)!=='movies'),...rows];
  refreshCatalogView(statusText||$('#playlistStatus').textContent);
  return true;
}
function replaceAnimeCatalog(anime,statusText=''){
  const rows=Array.isArray(anime)?anime.filter(Boolean):[];
  if(!rows.length)return false;
  state.channels=[...catalogNonAnime(),...rows];
  refreshCatalogView(statusText||$('#playlistStatus').textContent);
  return true;
}
async function loadInstantLocalLive(){
  const raw=await localTextGet('./data/free.m3u?v=1021',5000);
  return parseM3U(raw).map(applyLocalLiveArtwork);
}
async function refreshDefaultLiveInBackground(){
  try{
    const rows=await loadMana2PublicCatalog();
    if(rows.length){
      replaceLiveCatalog(rows,'Mana-Mana Live / AZOBSSTV');
      return true;
    }
  }catch(e){
    console.warn('AZOBSSTV background Live TV sync:',e?.message||e);
  }
  return false;
}

async function boot(){
  loadUserLibrary();
  updateFavoriteAvailability();
  $('#channelGrid')?.classList.toggle('anime-grid',state.tab==='series');
  $('#channelGrid')?.classList.toggle('movie-grid',state.tab==='movies');
  const s=$('#contentState');
  s.hidden=false;
  s.textContent='Loading AZOBSSTV…';

  const custom=JSON.parse(localStorage.getItem('azobsstv_playlist')||'null');
  if(custom){
    $('#playlistName').value=custom.name||'';
    $('#playlistUrl').value=custom.url||'';
  }

  // Start all potentially slow network work immediately, but NEVER await it
  // before showing the local catalogue.
  const configPromise=loadConfig();
  const remoteLivePromise=custom?Promise.resolve([]):loadMana2PublicCatalog().catch(e=>{
    console.warn('AZOBSSTV early Mana-Mana sync:',e?.message||e);
    return[];
  });
  const animePromise=loadAnimeCatalog().catch(e=>{
    console.warn('AZOBSSTV fast Anime load:',e?.message||e);
    return[];
  });
  const moviePromise=loadMovieCatalog().catch(e=>{
    console.warn('AZOBSSTV fast Movies load:',e?.message||e);
    return[];
  });

  // First paint: tiny local Live TV playlist. This should normally complete
  // in milliseconds and immediately removes the central loading message.
  let localLive=[];
  try{
    localLive=await loadInstantLocalLive();
  }catch(e){
    console.warn('AZOBSSTV instant local Live TV unavailable:',e?.message||e);
  }

  state.channels=[...localLive];
  if(localLive.length){
    localLive.filter(c=>!c.webOnly).forEach(c=>state.trustedDemoUrls.add(c.url));
    refreshCatalogView(custom?'Local channels • loading custom playlist…':'Local channels • syncing online…');
  }else if(state.channels.length){
    refreshCatalogView(custom?'Movies source ready • loading custom playlist…':'Movies source ready • syncing Live TV…');
  }

  // Movies metadata snapshot is local and small; merge it immediately after first paint.
  moviePromise.then(movies=>{
    if(movies.length)replaceMovieCatalog(movies,$('#playlistStatus').textContent||'AZOBSSTV');
  });

  // Anime catalog is local/static but larger (~1.4 MB), so merge it after
  // the Live TV first paint instead of blocking Live TV on it.
  animePromise.then(anime=>{
    if(anime.length)replaceAnimeCatalog(anime,$('#playlistStatus').textContent||'AZOBSSTV');
  });

  // If Render/Mana-Mana has already returned, switch to the fresher live list.
  remoteLivePromise.then(rows=>{
    if(rows.length)replaceLiveCatalog(rows,'Mana-Mana Live / AZOBSSTV');
  });

  // Config, telemetry, EPG and notices are background-only startup work.
  // A sleeping Render instance can no longer hold the whole page at Loading.
  configPromise.then(()=>{
    ping('launch'); // fire-and-forget
    loadEpg().then(()=>{if(state.tab==='guide')renderGuide()});
    loadNotice();

    if(custom?.url){
      loadPlaylist(custom.url,custom.name||'Custom Playlist').catch(e=>{
        console.warn('AZOBSSTV custom playlist background load:',e?.message||e);
        if(!state.channels.length){
          s.hidden=false;
          s.textContent='Playlist failed to load: '+e.message;
        }
      });
    }
  });

  // If even the tiny local playlist could not load, wait only for whichever
  // already-started source becomes available first enough to give the UI data.
  if(!state.channels.length){
    const [anime,remote,movies]=await Promise.all([animePromise,remoteLivePromise,moviePromise]);
    state.channels=[...(remote||[]),...(movies||[]),...(anime||[])];
    if(state.channels.length)refreshCatalogView(remote?.length?'Mana-Mana Live / AZOBSSTV':'Anime catalog ready');
    else{
      s.hidden=false;
      s.textContent='Unable to load the local catalog. Please refresh.';
    }
  }

  if(state.authUser)setTimeout(()=>loadCloudUserLibrary(false),80);
}
window.addEventListener('DOMContentLoaded',()=>{bindEnglishAZOBSSTVNavigation();bind();startHeroSideSync();boot();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=1021').catch(()=>{});if(document.visibilityState==='visible')startForegroundLoops()});
})();
