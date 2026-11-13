'use strict';
const {fail}=require('./azobss-tech-delivery');
const SHORT=new Set(['maps.app.goo.gl','goo.gl']);
const GOOGLE=new Set(['www.google.com','google.com','maps.google.com','www.google.com.my','maps.google.com.my','google.com.my']);
function mapsUrl(value){
  let url;
  try{if(typeof value==='string'&&value.length<=2048)url=new URL(value.trim());}catch{}
  if(!url||url.protocol!=='https:'||url.username||url.password||url.port)return null;
  if(url.hostname==='maps.app.goo.gl'&&/^\/[a-zA-Z0-9_-]{5,100}\/?$/.test(url.pathname))return url;
  if(url.hostname==='goo.gl'&&/^\/maps\/[a-zA-Z0-9_-]{5,100}\/?$/.test(url.pathname))return url;
  if(GOOGLE.has(url.hostname)&&(/^\/maps(?:\/|$)/.test(url.pathname)||(/^maps\./.test(url.hostname)&&url.pathname==='/')))return url;
  return null;
}
const DEC='[+-]?\\d+(?:\\.\\d+)?';
const pair=new RegExp('^\\s*('+DEC+')\\s*,\\s*('+DEC+')\\s*$');
const placePair=new RegExp('!3d('+DEC+')!4d('+DEC+')(?=!|/|$)','g');
function readPoint(url){
  if(/\/maps\/(?:dir|preview|streetview)(?:\/|$)/.test(url.pathname))return null;
  function point(match){
    if(!match)return null;
    const latitude=Number(match[1]),longitude=Number(match[2]);
    return Math.abs(latitude)<=90&&Math.abs(longitude)<=180?{latitude,longitude}:null;
  }
  for(const name of ['query','q']){
    const coords=point(pair.exec(url.searchParams.get(name)||''));
    if(coords)return coords;
  }
  let path;
  try{path=decodeURIComponent(url.pathname);}catch{return null;}
  if(/^\/maps\/place\//.test(path)){
    const matches=[...path.matchAll(placePair)];
    if(matches.length===1)return point(matches[0]);
  }
  const coordPath=path.match(/^\/maps\/(?:place|search)\/([^/]+)(?:\/|$)/);
  return coordPath?point(pair.exec(coordPath[1])):null;
}
async function resolveMapPin(value,fetcher=fetch){
  let url=mapsUrl(value);
  if(!url)fail('maps_link_invalid','Tampal pautan Google Maps yang disalin melalui Kongsi.');
  const signal=AbortSignal.timeout(7000);
  for(let hop=0;SHORT.has(url.hostname);hop++){
    if(hop>=3)fail('maps_link_unavailable','Pautan pendek tidak dapat dibuka. Salin semula pautan melalui Kongsi.',422);
    let response;
    try{response=await fetcher(url.href,{redirect:'manual',signal});}catch{}
    const next=response?.headers.get('location');
    if(response?.body)await response.body.cancel().catch(()=>{});
    let target;
    try{if(next)target=mapsUrl(new URL(next,url).href);}catch{}
    if(!response||![301,302,303,307,308].includes(response.status)||!target)fail('maps_link_unavailable','Pautan pendek tidak dapat dibuka. Salin semula pautan melalui Kongsi.',422);
    url=target;
  }
  const pin=readPoint(url);
  if(!pin)fail('maps_pin_missing','Pautan ini belum menunjukkan pin yang tepat. Pilih titik pada peta, kemudian tekan Kongsi → Salin pautan.',422);
  return pin;
}
module.exports={resolveMapPin};
