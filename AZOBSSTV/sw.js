const CACHE='azobsstv-v981';
const CORE=['./','./index.html','./assets/azobsstv.css?v=981','./assets/azobsstv.js?v=981','./assets/logo.svg','./manifest.webmanifest?v=981','./data/free.m3u?v=981'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin)return;
  if(u.pathname.startsWith('/api/')||/\.(m3u8?|ts|mpd|m4s|mp4|aac|mp3)(\?|$)/i.test(u.pathname))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&['document','script','style','image','manifest'].includes(e.request.destination)){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return r}).catch(()=>caches.match(e.request)));
});
