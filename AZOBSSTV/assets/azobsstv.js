(()=>{'use strict';
const API_BASE=(window.AZOBSSTV_API_BASE||'https://azobss-backend.onrender.com/api/azobsstv').replace(/\/$/,'');
const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const state={config:null,channels:[],filtered:[],trustedDemoUrls:new Set(),favorites:new Set(),recent:[],authUser:null,current:null,tab:'live',hls:null,dash:null,epg:new Map(),heartbeatTimer:null,noticeTimer:null,deferredInstall:null,videoCheckTimer:null,officialResizeObserver:null,heroSideResizeObserver:null,officialWide:false,scheduleRequestId:0,scheduleCache:new Map(),animeDetail:null,animePage:1,animeEpisodeSearch:'',animeEmbedRequestId:0};
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

const hostOf=u=>{try{return new URL(u,location.href).hostname.toLowerCase()}catch{return''}};
function isAllowed(url){if(state.trustedDemoUrls.has(String(url||'')))return true;if(!state.config)return true;if(state.config.allow_all_domains)return true;const host=hostOf(url);return (state.config.allowed_domains||[]).some(d=>host===d||host.endsWith('.'+d))}
function proxiedStreamUrl(url){return API_BASE+'/stream?url='+encodeURIComponent(String(url||''))}
function playbackUrl(c){return c&&String(c.mode||'').toLowerCase()==='proxy'?proxiedStreamUrl(c.url):c.url}
async function fetchWithTimeout(url,opts={},timeout=20000){const c=new AbortController();const t=setTimeout(()=>c.abort(),timeout);try{return await fetch(url,{cache:'no-store',...opts,signal:c.signal})}finally{clearTimeout(t)}}
async function jget(url,timeout=20000){const r=await fetchWithTimeout(url,{},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
async function textDirect(url,timeout=60000){const r=await fetchWithTimeout(url,{},timeout);if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
async function backendFetchText(kind,url,timeout){const r=await fetchWithTimeout(API_BASE+'/'+kind+'/fetch',{method:'POST',headers:{'Content-Type':'application/json','Accept':'text/plain,*/*'},body:JSON.stringify({url})},timeout);if(!r.ok){let msg='HTTP '+r.status;try{const j=await r.json();if(j.error)msg=j.error}catch{}throw new Error(msg)}return await r.text()}
async function smartTextGet(url,kind,timeout=60000){if(!url)throw new Error('URL kosong');try{return await textDirect(url,timeout)}catch(directErr){if(url.startsWith(API_BASE))throw directErr;try{return await backendFetchText(kind,url,timeout)}catch(proxyErr){throw new Error(proxyErr.message||directErr.message)}}}
async function loadConfig(){try{state.config=await jget(API_BASE+'/config');$('#serviceStatus').textContent='Online';$('#serviceStatus').className='ok'}catch(e){state.config={allow_all_domains:false,allowed_domains:['azobss.com'],free_playlist_url:API_BASE+'/playlist/free',epg_url:API_BASE+'/epg',notification_url:API_BASE+'/notifications',device_ping_url:API_BASE+'/device/ping'};$('#serviceStatus').textContent='Fallback';$('#serviceStatus').className='warn'}}
function parseM3U(raw){const lines=String(raw||'').replace(/\r/g,'').split('\n');const out=[];let meta=null;let opts={};for(const src of lines){const line=src.trim();if(!line)continue;if(line.startsWith('#EXTINF:')){const comma=line.indexOf(',');const name=(comma>=0?line.slice(comma+1):'Unnamed').trim()||'Unnamed';const attrs={};line.replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>(attrs[k]=v,''));meta={name,logo:attrs['tvg-logo']||'',id:attrs['tvg-id']||attrs['tvg-name']||'',group:attrs['group-title']||'Other',sourcePage:attrs['x-source-page']||attrs['source-page']||'',webOnly:String(attrs['x-web-only']||'')==='1',mode:attrs['x-mode']||'',officialUrl:attrs['x-official-url']||'',altUrl:attrs['x-alt-url']||''};opts={}}else if(line.startsWith('#EXTVLCOPT:')){const p=line.slice(11).split('=');opts[p.shift().trim().toLowerCase()]=p.join('=').trim()}else if(line.startsWith('#KODIPROP:')){const p=line.slice(10).split('=');opts[p.shift().trim().toLowerCase()]=p.join('=').trim()}else if(!line.startsWith('#')&&meta){out.push({...meta,url:line,headers:{userAgent:opts['http-user-agent']||'',referer:opts['http-referrer']||opts['http-referer']||'',origin:opts['http-origin']||'',authorization:opts['http-authorization']||''},drm:{licenseType:opts['inputstream.adaptive.license_type']||opts['license_type']||'',licenseKey:opts['inputstream.adaptive.license_key']||opts['license_key']||''}});meta=null;opts={}}}return out}
async function loadMana2PublicCatalog(){const data=await jget(API_BASE+'/mana2/channels',25000);const rows=Array.isArray(data?.channels)?data.channels:[];return rows.map((x,index)=>{const url=String(x?.officialUrl||x?.sourcePage||x?.url||'').trim();const name=String(x?.name||x?.title||`Channel ${index+1}`).trim();if(!url||!name)return null;return{name,logo:String(x?.logo||'').trim(),id:String(x?.id||x?.channelId||x?.slug||'').trim(),group:String(x?.group||'Live TV').trim()||'Live TV',kind:String(x?.kind||'live').toLowerCase()==='radio'?'radio':'live',sourcePage:url,webOnly:false,mode:'official',officialUrl:url,altUrl:'',url,headers:{userAgent:'',referer:'',origin:'',authorization:''},drm:{licenseType:'',licenseKey:''},slug:String(x?.slug||'').trim(),channelNumber:x?.channelNumber??null}}).filter(Boolean)}
async function loadAnimeCatalog(){try{const data=await jget('./data/anime-catalog.json?v=1000',18000);const rows=Array.isArray(data?.items)?data.items:[];return rows.map((x,index)=>{const url=String(x?.sourcePage||x?.url||'').trim();const name=String(x?.name||`Anime ${index+1}`).trim();if(!url||!name)return null;const categories=Array.isArray(x?.categories)?x.categories.map(v=>String(v||'').trim()).filter(Boolean):[];const episodes=Array.isArray(x?.episodes)?x.episodes.map((ep,epIndex)=>({id:String(ep?.id||`ep-${epIndex+1}`),number:String(ep?.number||'').trim(),title:String(ep?.title||'').trim(),label:String(ep?.label||ep?.title||`Episode ${epIndex+1}`).trim(),url:String(ep?.url||'').trim()})).filter(ep=>/^https:\/\/(?:www\.)?animenana\.com\/view\//i.test(ep.url)):[];return{name,logo:String(x?.logo||'').trim(),id:String(x?.id||x?.slug||`anime-${index+1}`).trim(),group:'Anime',kind:'series',categories,year:x?.year??null,rating:String(x?.rating||'').trim(),episodeCount:Number(x?.episodeCount||episodes.length)||episodes.length,episodes,sourcePage:url,webOnly:true,mode:'web',officialUrl:url,altUrl:'',url,headers:{userAgent:'',referer:'',origin:'',authorization:''},drm:{licenseType:'',licenseKey:''},slug:String(x?.slug||'').trim()}}).filter(Boolean)}catch(e){console.warn('AZOBSSTV anime catalogue fallback:',e?.message||e);return[]}}
function contentCategories(c){const own=Array.isArray(c?.categories)?c.categories.map(v=>String(v||'').trim()).filter(Boolean):[];if(own.length)return own;const group=String(c?.group||'').trim();return group?[group]:[]}
function cardSubline(c){if(mediaType(c)==='series'){const bits=[];if(c?.year)bits.push(String(c.year));bits.push(...contentCategories(c).slice(0,3));return bits.join(' • ')||'Anime'}return String(c?.mode||'').toLowerCase()==='official'?'Official player':c?.webOnly?'Open source':'Direct'}
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
function render(){state.animeDetail=null;$('#animeDetailView').hidden=true;$('#browserToolbar').hidden=false;const q=$('#searchInput').value.trim().toLowerCase();const grp=$('#groupSelect').value;if((state.tab==='favorites'||state.tab==='recent')&&!isSignedIn()){state.filtered=[];$('#channelGrid').hidden=false;$('#guideView').hidden=true;$('#channelGrid').innerHTML='';$('#contentState').hidden=false;$('#contentState').textContent=state.tab==='favorites'?'Sign in to save and view Favorites.':'Sign in to save and view Recent.';renderChannelRail([]);updateFavoriteAvailability();return}let list=state.channels.filter(c=>{if(!tabFilter(c))return false;const cats=contentCategories(c);if(grp&&!cats.includes(grp))return false;if(!q)return true;const hay=[c.name,c.group,...cats].join(' ').toLowerCase();return hay.includes(q)});if(state.tab==='favorites')list=list.filter(c=>state.favorites.has(channelKey(c)));if(state.tab==='recent'){const order=new Map(state.recent.map((u,i)=>[u,i]));list=list.filter(c=>order.has(channelKey(c))).sort((a,b)=>order.get(channelKey(a))-order.get(channelKey(b)))}state.filtered=list;$('#channelGrid').hidden=false;$('#guideView').hidden=true;$('#contentState').hidden=!!list.length;$('#contentState').textContent=list.length?'':'No content found.';$('#channelGrid').innerHTML=list.map((c,i)=>{const badge=channelBadgeText(c.name),isAnime=mediaType(c)==='series';return `<article class="channel-card ${isAnime?'anime-card':''}" data-index="${i}">${c.logo?`<img class="channel-logo" loading="lazy" referrerpolicy="no-referrer" src="${esc(c.logo)}" data-fallback="${esc(badge)}" alt="">`:`<div class="channel-logo fallback">${esc(badge)}</div>`}<div class="channel-text"><div class="channel-name">${esc(c.name)}</div><div class="channel-group">${esc(cardSubline(c))}</div></div><button class="fav-mini ${state.favorites.has(channelKey(c))?'active':''}" data-fav="${i}" type="button" aria-label="Favorite">♥</button></article>`}).join('');$$('.channel-logo').filter(x=>x.tagName==='IMG').forEach(img=>img.addEventListener('error',()=>{const d=document.createElement('div');d.className='channel-logo fallback';d.textContent=img.dataset.fallback||'TV';img.replaceWith(d)}));$$('.channel-card').forEach(el=>el.addEventListener('click',e=>{const i=Number(el.dataset.index);if(e.target.closest('[data-fav]')){toggleFav(list[i]);e.stopPropagation();return}play(list[i])}));renderChannelRail(list);updateFavoriteAvailability()}
function toggleFav(c){if(!c||!requireSignIn('Favorites'))return;const key=channelKey(c);if(!key)return;if(state.favorites.has(key))state.favorites.delete(key);else state.favorites.add(key);saveUserLibrary();$('#favCurrentBtn').classList.toggle('active',!!(state.current&&state.favorites.has(channelKey(state.current))));if(state.animeDetail&&state.tab==='series')showAnimeDetail(state.animeDetail,false);else render()}
function markRecent(c){if(!c||!isSignedIn())return;const key=channelKey(c);if(!key)return;state.recent=[key,...state.recent.filter(x=>x!==key)].slice(0,30);saveUserLibrary()}
function stopHls(){if(state.hls){state.hls.destroy();state.hls=null}if(state.dash){try{state.dash.reset()}catch{}state.dash=null}}
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

function animeEpisodeDisplay(ep,index){
  if(ep?.number)return `Episode ${ep.number}${ep.title?' — '+ep.title:''}`;
  return ep?.label||ep?.title||`Episode ${index+1}`;
}
function animeEpisodeMatches(ep,q){
  if(!q)return true;
  return [ep?.number,ep?.title,ep?.label].join(' ').toLowerCase().includes(q);
}
function renderAnimeSideEpisodes(series,currentUrl=''){
  const box=$('#todayScheduleList'),label=$('#todayScheduleChannel'),head=$('#todayScheduleCard .today-schedule-head strong');
  $('#todayScheduleCard')?.classList.add('anime-episode-mode');
  if(head)head.textContent='Episodes';
  if(label)label.textContent=series?.name||'Anime';
  if(!box)return;
  const eps=Array.isArray(series?.episodes)?series.episodes:[];
  if(!eps.length){box.innerHTML='<div class="today-schedule-empty">No episodes are available.</div>';return}
  let start=0;
  const currentIndex=currentUrl?eps.findIndex(ep=>ep.url===currentUrl):-1;
  if(currentIndex>=0)start=Math.max(0,currentIndex-8);
  const subset=eps.slice(start,start+24);
  box.innerHTML=subset.map((ep,i)=>{
    const absolute=start+i,active=ep.url===currentUrl;
    return `<button class="anime-side-episode ${active?'current':''}" type="button" data-anime-side-episode="${absolute}"><span>${esc(ep.number?`EP ${ep.number}`:`EP ${absolute+1}`)}</span><strong>${esc(ep.title||ep.label||`Episode ${absolute+1}`)}</strong></button>`;
  }).join('');
  $$('[data-anime-side-episode]',box).forEach(btn=>btn.addEventListener('click',()=>{
    const ep=eps[Number(btn.dataset.animeSideEpisode)];
    if(ep)playAnimeEpisode(series,ep);
  }));
  requestAnimationFrame(()=>box.querySelector('.anime-side-episode.current')?.scrollIntoView({block:'nearest'}));
}
function restoreTodayScheduleHeading(){
  const card=$('#todayScheduleCard'),head=$('#todayScheduleCard .today-schedule-head strong');
  if(card)card.classList.remove('anime-episode-mode');
  if(head)head.textContent="Today's Schedule";
}
function setAnimeEpisodesDocked(on){
  const card=$('#todayScheduleCard'),side=$('#heroSide'),hero=document.querySelector('.hero-grid');
  if(!card||!side||!hero)return;
  if(on){
    if(!card.classList.contains('anime-episodes-docked')){
      hero.insertAdjacentElement('afterend',card);
      card.classList.add('anime-episodes-docked');
    }
  }else{
    if(card.classList.contains('anime-episodes-docked')){
      side.appendChild(card);
      card.classList.remove('anime-episodes-docked');
    }
  }
}

function setAnimeEmbedCompactMode(on){
  const wrap=$('#videoWrap'),panel=$('#animePlayerPanel'),hero=document.querySelector('.hero-grid');
  if(wrap)wrap.classList.toggle('anime-embed-compact-mode',!!on);
  if(panel)panel.classList.toggle('anime-embed-compact',!!on);
  if(hero)hero.classList.toggle('anime-compact-hero',!!on);
  setAnimeEpisodesDocked(!!on);
  requestAnimationFrame(()=>{syncHeroSideHeight();setTimeout(syncHeroSideHeight,40)});
}
function hideAnimePlayer(clearFrame=true){
  const panel=$('#animePlayerPanel'),frame=$('#animePlayerFrame'),blocked=$('#animeEmbedBlocked');
  setAnimeEmbedCompactMode(false);
  if(panel)panel.hidden=true;
  if(blocked)blocked.hidden=true;
  if(clearFrame&&frame){try{frame.src='about:blank'}catch{}}
}
async function checkAnimeEmbed(url){
  try{
    const data=await jget(API_BASE+'/anime/embed-check?url='+encodeURIComponent(url),15000);
    return data&&typeof data.embeddable==='boolean'?data:{embeddable:true,reason:'unknown'};
  }catch{
    return{embeddable:true,reason:'backend-check-unavailable'};
  }
}
async function showAnimeEpisodePlayer(series,ep){
  hideOfficialPlayer();
  stopHls();
  clearTimeout(state.videoCheckTimer);
  const v=$('#tvPlayer');
  try{v.pause()}catch{}
  v.removeAttribute('src');v.load();
  hidePlayerPlaceholder();hidePlayerError();

  const panel=$('#animePlayerPanel'),frame=$('#animePlayerFrame'),blocked=$('#animeEmbedBlocked');
  const openBtn=$('#animeOpenSourceBtn'),label=$('#animePlayerEpisodeLabel'),status=$('#animePlayerSourceStatus');
  if(!panel||!frame)return;
  panel.hidden=false;
  setAnimeEmbedCompactMode(true);
  if(blocked)blocked.hidden=true;
  frame.hidden=true;
  frame.src='about:blank';
  if(openBtn)openBtn.href=ep.url;
  if(label)label.textContent=animeEpisodeDisplay(ep,0);
  if(status)status.textContent='Checking whether the source allows embedding…';
  $('#pipBtn').disabled=true;

  const requestId=++state.animeEmbedRequestId;
  const check=await checkAnimeEmbed(ep.url);
  if(requestId!==state.animeEmbedRequestId)return;
  if(check.embeddable){
    setAnimeEmbedCompactMode(false);
    if(status)status.textContent='Displayed in AZOBSSTV • public source';
    frame.hidden=false;
    frame.src=ep.url;
  }else{
    setAnimeEmbedCompactMode(true);
    frame.hidden=true;
    if(blocked)blocked.hidden=false;
    if(status)status.textContent='Embedding blocked by source';
  }
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
  window.scrollTo({top:Math.max(0,document.querySelector('.hero-grid')?.getBoundingClientRect().top+window.scrollY-58),behavior:'smooth'});
}
function renderAnimeEpisodePage(series){
  const view=$('#animeDetailView');
  if(!view||!series)return;
  const eps=Array.isArray(series.episodes)?series.episodes:[];
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
function showAnimeDetail(series,scroll=true){
  if(!series)return;
  state.animeDetail=series;
  state.animePage=1;
  state.animeEpisodeSearch='';
  markRecent(series);
  $('#channelGrid').hidden=true;
  $('#guideView').hidden=true;
  $('#contentState').hidden=true;
  $('#browserToolbar').hidden=true;
  const view=$('#animeDetailView');
  view.hidden=false;
  const cats=contentCategories(series);
  const favorite=state.favorites.has(channelKey(series));
  view.innerHTML=`<div class="anime-detail-head">
    <button class="anime-back-btn" type="button" id="animeBackBtn">← Back to Anime</button>
    <a class="anime-source-link" href="${esc(series.sourcePage||series.url)}" target="_blank" rel="noopener noreferrer">Source Page</a>
  </div>
  <div class="anime-detail-hero">
    <img class="anime-detail-poster" src="${esc(series.logo||'')}" alt="" loading="lazy" referrerpolicy="no-referrer">
    <div class="anime-detail-copy">
      <div class="anime-detail-title-row"><h2>${esc(series.name)}</h2><button class="anime-detail-fav ${favorite?'active':''}" id="animeDetailFavBtn" type="button" aria-label="Favorite">♥</button></div>
      <div class="anime-detail-meta">${series.year?`<span>${esc(String(series.year))}</span>`:''}${series.rating?`<span>${esc(series.rating)}</span>`:''}<span>${esc(String(series.episodeCount||series.episodes?.length||0))} episodes</span></div>
      <div class="anime-genre-chips">${cats.map(g=>`<span>${esc(g)}</span>`).join('')}</div>
      <p class="anime-detail-note">Choose an episode below. AZOBSSTV will try to display the public episode page in the player above. If the provider blocks embedding, the “Open Source” button will remain available.</p>
    </div>
  </div>
  <div class="anime-episode-tools">
    <div><strong>Episode List</strong><span id="animeEpisodeCount">${esc(String(series.episodes?.length||0))} episodes</span></div>
    <input id="animeEpisodeSearch" type="search" placeholder="Search episode number / title…" autocomplete="off">
  </div>
  <div id="animeEpisodeList" class="anime-episode-list"></div>
  <div id="animeEpisodePager" class="anime-episode-pager"></div>`;

  $('#animeBackBtn')?.addEventListener('click',()=>{state.animeDetail=null;render()});
  $('#animeDetailFavBtn')?.addEventListener('click',()=>toggleFav(series));
  $('#animeEpisodeSearch')?.addEventListener('input',e=>{state.animeEpisodeSearch=e.target.value;state.animePage=1;renderAnimeEpisodePage(series)});
  renderAnimeEpisodePage(series);
  renderAnimeSideEpisodes(series);
  if(scroll)view.scrollIntoView({behavior:'smooth',block:'start'});
}

function hideOfficialPlayer(){setOfficialWide(false);const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');if(wrap)wrap.classList.remove('official-mode');if(panel)panel.hidden=true;if(state.officialResizeObserver){try{state.officialResizeObserver.disconnect()}catch{}state.officialResizeObserver=null}if(frame){frame.style.transform='';frame.style.left='0';frame.style.top='0';try{frame.src='about:blank'}catch{}}}
function showOfficialPlayer(c){hideAnimePlayer();restoreTodayScheduleHeading();const wrap=$('#videoWrap'),panel=$('#officialPlayerPanel'),frame=$('#officialPlayerFrame');const url=c.officialUrl||c.sourcePage||c.url;stopHls();clearTimeout(state.videoCheckTimer);const v=$('#tvPlayer');try{v.pause()}catch{}v.removeAttribute('src');v.load();hidePlayerPlaceholder();hidePlayerError();if(wrap)wrap.classList.add('official-mode');if(panel)panel.hidden=false;if(frame&&url)frame.src=url;startOfficialAutoFit();loadCurrentSchedule(c);$('#pipBtn').disabled=true}
function play(c){
  if(!c)return;
  if(mediaType(c)==='series'&&c.webOnly){showAnimeDetail(c);return}
  if(c.webOnly){const target=c.sourcePage||c.url;if(target)window.open(target,'_blank','noopener,noreferrer');return}
  hideAnimePlayer();restoreTodayScheduleHeading();
  const mode=String(c.mode||'').toLowerCase();
  state.current=c;markRecent(c);renderChannelRail();hidePlayerPlaceholder();hidePlayerError();$('#nowTitle').textContent=c.name;$('#nowMeta').textContent='Loading program title…';$('#favCurrentBtn').classList.toggle('active',state.favorites.has(channelKey(c)));
  if(mode==='official'){showOfficialPlayer(c);return}
  hideOfficialPlayer();$('#pipBtn').disabled=false;
  if(!isAllowed(c.url)){alert('This stream domain is not allowed by the AZOBSSTV configuration.');return}
  const v=$('#tvPlayer');stopHls();clearTimeout(state.videoCheckTimer);v.removeAttribute('src');v.load();v.onerror=null;
  v.onloadedmetadata=()=>{setPlaybackMeta();watchVideoPicture(v)};v.onplaying=()=>watchVideoPicture(v);v.onresize=()=>setPlaybackMeta();
  v.onerror=()=>{setPlaybackMeta('Playback failed / incompatible format');showPlayerError('The browser cannot play this stream. Try another channel or check the stream source.')};

  const isHls=/\.m3u8($|\?)/i.test(c.url);
  if(isHls&&window.Hls&&Hls.isSupported()){
    const candidates=mode==='auto'?[{url:c.url,label:'Direct'},{url:proxiedStreamUrl(c.url),label:'Relay'}]:[{url:mode==='proxy'?proxiedStreamUrl(c.url):c.url,label:mode==='proxy'?'Relay':'Direct'}];
    let idx=0;
    const tryCandidate=()=>{
      if(idx>=candidates.length){setPlaybackMeta('HLS failed');showPlayerError('HLS failed through both the direct connection and backend relay. The source may be temporarily rejecting browser/server connections.');return}
      const candidate=candidates[idx++];
      stopHls();hidePlayerError();setPlaybackMeta('HLS • '+candidate.label+' • Loading…');
      state.hls=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,startLevel:-1,maxBufferLength:30,xhrSetup:xhr=>{if(c.headers.authorization&&candidate.label!=='Relay'){try{xhr.setRequestHeader('Authorization',c.headers.authorization)}catch{}}}});
      state.hls.loadSource(candidate.url);state.hls.attachMedia(v);
      let manifestReady=false;
      state.hls.on(Hls.Events.MANIFEST_PARSED,(_,data)=>{manifestReady=true;hidePlayerError();const av=(data.levels||[]).filter(x=>(x.videoCodec||'').length);if(av.length){const h264=av.findIndex(x=>/^avc1/i.test(x.videoCodec||''));if(h264>=0)state.hls.startLevel=h264}setPlaybackMeta('HLS • '+candidate.label);v.play().catch(()=>{})});
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
async function loadPlaylist(url,name='AZOBSSTV Free'){if(!url)throw new Error('Playlist URL is empty');if(!isAllowed(url)&&!url.startsWith(API_BASE))throw new Error('Playlist domain not allowed');$('#playlistStatus').textContent='Loading…';$('#playlistStatus').className='';let raw=await smartTextGet(url,'playlist',60000);let parsed=parseM3U(raw);const isDefaultFree=url===(state.config?.free_playlist_url||API_BASE+'/playlist/free')||url===API_BASE+'/playlist/free';if(!parsed.length&&isDefaultFree){try{raw=await textDirect('./data/free.m3u?v=1000',15000);parsed=parseM3U(raw);name='Mana-Mana / AZOBSSTV'}catch{}}if(isDefaultFree){try{const liveCatalog=await loadMana2PublicCatalog();if(liveCatalog.length){parsed=liveCatalog;name='Mana-Mana Live / AZOBSSTV'}}catch(e){console.warn('Mana-Mana live catalogue fallback:',e?.message||e)}parsed.filter(c=>!c.webOnly).forEach(c=>state.trustedDemoUrls.add(c.url));if(!name)name='Mana-Mana / AZOBSSTV'}try{const animeCatalog=await loadAnimeCatalog();if(animeCatalog.length)parsed=[...parsed,...animeCatalog]}catch(e){console.warn('Anime catalogue load skipped:',e?.message||e)}state.channels=parsed;$('#channelCount').textContent=String(state.channels.length);$('#playlistStatus').textContent=name;$('#playlistStatus').className=state.channels.length?'ok':'warn';fillGroups();render();if(isSignedIn())setTimeout(()=>loadCloudUserLibrary(false),30)}
function parseXmltvDate(value){const s=String(value||'').trim();const m=s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-]\d{4}))?/);if(!m)return 0;const [,Y,M,D,h,mi,se='00',tz='+0000']=m;const sign=tz[0]==='-'?-1:1;const off=(Number(tz.slice(1,3))*60+Number(tz.slice(3,5)))*sign;return Date.UTC(+Y,+M-1,+D,+h,+mi,+se)-off*60000}
async function loadEpg(){const url=state.config?.epg_url;if(!url)return;try{const xml=await smartTextGet(url,'epg',120000);const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('Invalid XMLTV');state.epg.clear();const now=Date.now();[...doc.querySelectorAll('programme')].slice(0,50000).forEach(p=>{const id=p.getAttribute('channel')||'';if(!id)return;const start=parseXmltvDate(p.getAttribute('start'));const stop=parseXmltvDate(p.getAttribute('stop'));const title=p.querySelector('title')?.textContent?.trim()||'';if(!title)return;const bucket=state.epg.get(id)||{current:null,next:null};if(start<=now&&(!stop||stop>now))bucket.current={title,start,stop};else if(start>now&&(!bucket.next||start<bucket.next.start))bucket.next={title,start,stop};state.epg.set(id,bucket)});$('#epgStatus').textContent=state.epg.size?'Ready':'No data';$('#epgStatus').className=state.epg.size?'ok':''}catch(e){$('#epgStatus').textContent='Failed';$('#epgStatus').className='warn'}}
function renderGuide(){renderChannelRail(state.channels.filter(c=>mediaType(c)==='live'));const rows=state.channels.filter(c=>mediaType(c)==='live').map(c=>({c,e:state.epg.get(c.id)||{}}));$('#channelGrid').hidden=true;$('#contentState').hidden=!!rows.length;$('#guideView').hidden=false;$('#guideView').innerHTML=rows.slice(0,800).map(x=>`<div class="guide-row"><div class="guide-channel">${esc(x.c.name)}</div><div class="guide-program"><strong>${esc(x.e.current?.title||'No EPG information')}</strong>${x.e.next?`<small>Next: ${esc(x.e.next.title)}</small>`:''}</div></div>`).join('')}
function getInstallId(){let id=localStorage.getItem('azobsstv_install_id');if(!id){id=(crypto.randomUUID?crypto.randomUUID():'web-'+Date.now()+'-'+Math.random().toString(16).slice(2));localStorage.setItem('azobsstv_install_id',id)}return id}
function extractUsername(raw){try{const u=new URL(raw);for(const k of ['username','user','login']){const v=u.searchParams.get(k);if(v)return v}if(u.username)return decodeURIComponent(u.username);const p=u.pathname;let m=p.match(/\/(?:player_api\.php|get\.php|panel_api\.php)\/([^/?\s]+)\/([^/?\s]+)/i);if(m)return decodeURIComponent(m[1]);m=p.match(/\/(?:live|movie|series)\/([^/?\s]+)\/([^/?\s]+)\//i);if(m)return decodeURIComponent(m[1])}catch{}return''}
async function ping(reason){if(document.visibilityState==='hidden'&&reason==='heartbeat')return;const url=state.config?.device_ping_url||API_BASE+'/device/ping';const account=JSON.parse(localStorage.getItem('azobsstv_playlist')||'null');const source=account?.url||state.config?.free_playlist_url||'';const payload={device_id:getInstallId(),username:account?extractUsername(source):'free',account_name:account?.name||'AZOBSSTV Free',account_id:account?'custom':'free_azobsstv',time:Math.floor(Date.now()/1000),time_ms:Date.now(),reason,app_version:'1.0.1000',app_version_code:1000,device_model:navigator.userAgent.slice(0,180),android_release:''};try{await fetchWithTimeout(url,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),keepalive:true},15000)}catch{}}
function normalizeNotice(item,index){if(!item||typeof item!=='object')return null;const message=String(item.message??item.body??'').trim();if(!message)return null;return{id:String(item.id??item.uuid??index),title:String(item.title||'AZOBSSTV'),message,timestamp:Number(item.timestamp||item.time||Date.now())||Date.now()}}
async function loadNotice(){if(document.visibilityState==='hidden')return;try{const data=await jget(state.config?.notification_url||API_BASE+'/notifications',30000);const raw=Array.isArray(data)?data:(Array.isArray(data.items)?data.items:[]);const items=raw.map(normalizeNotice).filter(Boolean);const item=items.at(-1);if(item){const last=localStorage.getItem('azobsstv_notice_last_id');$('#serverNotice').hidden=false;$('#serverNotice').innerHTML=`<strong>${esc(item.title)}</strong><span>${esc(item.message)}</span>`;if(last!==item.id)localStorage.setItem('azobsstv_notice_last_id',item.id)}else $('#serverNotice').hidden=true}catch{}}
function startForegroundLoops(){if(state.heartbeatTimer)clearInterval(state.heartbeatTimer);if(state.noticeTimer)clearInterval(state.noticeTimer);state.heartbeatTimer=setInterval(()=>ping('heartbeat'),30000);state.noticeTimer=setInterval(loadNotice,60000)}
function stopForegroundLoops(){if(state.heartbeatTimer)clearInterval(state.heartbeatTimer);if(state.noticeTimer)clearInterval(state.noticeTimer);state.heartbeatTimer=null;state.noticeTimer=null}
function setTab(tab){state.tab=tab;state.animeDetail=null;$('#animeDetailView').hidden=true;$('#browserToolbar').hidden=false;$('#channelGrid')?.classList.toggle('anime-grid',tab==='series');$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));fillGroups();tab==='guide'?renderGuide():render()}

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

function bind(){[$('#searchInput'),$('#groupSelect')].forEach(el=>el.addEventListener('input',()=>state.tab==='guide'?renderGuide():render()));$$('.tab').forEach(t=>t.addEventListener('click',()=>setTab(t.dataset.tab)));$('#favCurrentBtn').addEventListener('click',()=>toggleFav(state.current));$('#officialExpandHotspot')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();toggleOfficialWide()});$('#animeClosePlayerBtn')?.addEventListener('click',()=>{hideAnimePlayer();$('#playerEmpty').hidden=false;$('#nowTitle').textContent='AZOBSSTV';$('#nowMeta').textContent='Choose content to start watching.';$('#pipBtn').disabled=true});$('#pipBtn').addEventListener('click',async()=>{const v=$('#tvPlayer');try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else if(document.pictureInPictureEnabled&&!v.paused)await v.requestPictureInPicture()}catch{}});$('#accountBtn').addEventListener('click',()=>$('#playlistDialog').showModal());$('#refreshBtn').addEventListener('click',()=>boot(true));$('#installBtn').addEventListener('click',async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('#installBtn').hidden=true});$('#playlistForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('#playlistName').value.trim()||'My Playlist';const url=$('#playlistUrl').value.trim();if(!url)return;localStorage.setItem('azobsstv_playlist',JSON.stringify({name,url}));$('#playlistDialog').close();try{await loadPlaylist(url,name)}catch(err){alert(err.message)}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.officialWide)setOfficialWide(false)});bindOfficialScrollBridge();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){ping('heartbeat');loadNotice();startForegroundLoops()}else stopForegroundLoops()});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('#installBtn').hidden=false});window.addEventListener('azobss-auth-changed',syncAuthLibrary);window.addEventListener('storage',syncAuthLibrary);window.addEventListener('focus',syncAuthLibrary)}
async function boot(){loadUserLibrary();updateFavoriteAvailability();$('#channelGrid')?.classList.toggle('anime-grid',state.tab==='series');const s=$('#contentState');s.hidden=false;s.textContent='Loading AZOBSSTV…';await loadConfig();await ping('launch');const custom=JSON.parse(localStorage.getItem('azobsstv_playlist')||'null');if(custom){$('#playlistName').value=custom.name||'';$('#playlistUrl').value=custom.url||''}try{await loadPlaylist(custom?.url||state.config.free_playlist_url||API_BASE+'/playlist/free',custom?.name||'AZOBSSTV Free')}catch(e){$('#playlistStatus').textContent='Failed';$('#playlistStatus').className='warn';s.hidden=false;s.textContent='Playlist failed to load: '+e.message}loadEpg().then(()=>{if(state.tab==='guide')renderGuide()});loadNotice();if(state.authUser)setTimeout(()=>loadCloudUserLibrary(false),80)}
window.addEventListener('DOMContentLoaded',()=>{bindEnglishAZOBSSTVNavigation();bind();startHeroSideSync();boot();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=1000').catch(()=>{});if(document.visibilityState==='visible')startForegroundLoops()});
})();
