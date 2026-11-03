const fs=require('fs');
const path=require('path');
const https=require('https');
const http=require('http');
const zlib=require('zlib');
const {spawnSync}=require('child_process');
const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..');
const PRODUCT_DIR=path.join(ROOT,'PC-Build','images','products');
const MANIFEST_PATH=path.join(PRODUCT_DIR,'source-map-v1502.json');
const MAP_JS=path.join(PRODUCT_DIR,'local-image-map-v1502.js');
const READY_JSON=path.join(PRODUCT_DIR,'local-images-ready-v1502.json');
const manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
let items=manifest.images||[];
// v1501 merge-upgrade: keep any extra exact images already discovered by a prepared v1500 folder.
try{
  const legacyPath=path.join(PRODUCT_DIR,'source-map-v1500.json');
  if(fs.existsSync(legacyPath)){
    const legacy=JSON.parse(fs.readFileSync(legacyPath,'utf8'));
    const lockedIds=new Set(items.flatMap(x=>x.ids||[]).map(String));
    const lockedUrls=new Set(items.map(x=>String(x.sourceUrl||'')));
    for(const x of (legacy.images||[])){
      const ids=(x.ids||[]).map(String);
      if(ids.some(id=>lockedIds.has(id))||lockedUrls.has(String(x.sourceUrl||'')))continue;
      items.push(x); for(const id of ids)lockedIds.add(id); lockedUrls.add(String(x.sourceUrl||''));
    }
  }
}catch(e){console.warn('[LEGACY MAP]',e.message)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function refererFor(u){try{return new URL(u).origin+'/';}catch{return 'https://www.google.com/';}}
function requestOnce(url,redirects=0){return new Promise((resolve,reject)=>{
  if(redirects>6)return reject(new Error('too many redirects'));
  const U=new URL(url); const client=U.protocol==='http:'?http:https;
  const req=client.request(U,{method:'GET',headers:{
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36',
    'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Encoding':'gzip, deflate, br','Referer':refererFor(url),'Cache-Control':'no-cache'
  },timeout:30000},res=>{
    const code=res.statusCode||0;
    if([301,302,303,307,308].includes(code)&&res.headers.location){res.resume();return resolve(requestOnce(new URL(res.headers.location,url).toString(),redirects+1));}
    if(code<200||code>=300){res.resume();return reject(new Error('HTTP '+code));}
    const chunks=[]; let total=0; const max=12*1024*1024;
    res.on('data',c=>{total+=c.length;if(total>max){req.destroy(new Error('image too large'));return;}chunks.push(c)});
    res.on('end',()=>{
      let body=Buffer.concat(chunks); const enc=String(res.headers['content-encoding']||'').toLowerCase();
      try{if(enc==='gzip')body=zlib.gunzipSync(body);else if(enc==='deflate')body=zlib.inflateSync(body);else if(enc==='br')body=zlib.brotliDecompressSync(body);}catch(e){return reject(new Error('decode failed: '+e.message));}
      resolve({body,type:String(res.headers['content-type']||'')});
    });
  });
  req.on('timeout',()=>req.destroy(new Error('timeout'))); req.on('error',reject); req.end();
})}
function imageMagic(buf,type=''){
  if(!buf||buf.length<512)return false;
  if(buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return true;
  if(buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return true;
  if(buf.slice(0,4).toString()==='RIFF'&&buf.slice(8,12).toString()==='WEBP')return true;
  if(buf.slice(4,8).toString()==='ftyp')return true;
  if(buf.slice(0,6).toString().toUpperCase().startsWith('GIF8'))return true;
  return /^image\//i.test(type)&&buf.length>1024;
}
async function downloadOne(it){
  const dest=path.join(PRODUCT_DIR,it.filename); fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest)){const b=fs.readFileSync(dest);if(imageMagic(b,''))return {ok:true,cached:true,size:b.length};try{fs.unlinkSync(dest)}catch{}}
  let last='';
  for(let a=1;a<=4;a++){
    try{const r=await requestOnce(it.sourceUrl);if(!imageMagic(r.body,r.type))throw new Error('response is not a valid image ('+r.type+', '+r.body.length+' bytes)');
      const part=dest+'.part';fs.writeFileSync(part,r.body);fs.renameSync(part,dest);return {ok:true,size:r.body.length};
    }catch(e){last=e.message; if(a<4)await sleep(700*a);}
  }
  return {ok:false,error:last};
}
async function pool(list,limit,fn){let next=0;const out=new Array(list.length);async function worker(){while(true){const i=next++;if(i>=list.length)return;out[i]=await fn(list[i],i)}}await Promise.all(Array.from({length:Math.min(limit,list.length)},worker));return out;}

function absoluteUrl(raw,base){try{let x=String(raw||'').trim();if(!x)return'';if(x.startsWith('//'))x='https:'+x;return new URL(x,base).toString()}catch{return''}}
function shopifyJsUrl(sourceUrl){try{const u=new URL(String(sourceUrl||''));u.search='';u.hash='';u.pathname=u.pathname.replace(/\/$/,'');if(!/\.js$/i.test(u.pathname))u.pathname+='.js';return u.toString()}catch{return''}}
function extFromImageUrl(url){try{const m=new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|avif)$/i);return m?m[1].toLowerCase().replace('jpeg','jpg'):'jpg'}catch{return'jpg'}}
function fileSlug(v){return String(v||'product').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'product'}
async function discoverMissingShopifyImages(){
  const catPath=path.join(ROOT,'PC-Build','pc-shop-products-v1487.json');
  let products=[];try{products=JSON.parse(fs.readFileSync(catPath,'utf8')).products||[]}catch{return}
  const known=new Set();for(const it of items)for(const id of (it.ids||[]))known.add(String(id));
  let nextIndex=items.reduce((m,x)=>Math.max(m,Number(x.index)||0),0)+1;
  let added=0;
  for(const p of products){
    const id=String(p?.id||'');if(!id||known.has(id))continue;
    const src=String(p?.sourceUrl||'');const provider=String(p?.sourceProvider||'').toLowerCase();
    if(provider!=='shopify'||!/\/products\//i.test(src))continue;
    const js=shopifyJsUrl(src);if(!js)continue;
    try{
      const r=await requestOnce(js);const d=JSON.parse(r.body.toString('utf8'));
      const vars=Array.isArray(d?.variants)?d.variants:[];
      let variant=null;const kws=Array.isArray(p?.variantKeywords)?p.variantKeywords.filter(Boolean).map(x=>String(x).toLowerCase()):[];
      if(kws.length)variant=vars.find(v=>kws.every(k=>String(v?.title||'').toLowerCase().includes(k)))||null;
      if(!variant)variant=vars.find(v=>v?.available!==false)||vars[0]||null;
      const raw=variant?.featured_image?.src||variant?.featured_image||d?.featured_image||(Array.isArray(d?.images)?(d.images[0]?.src||d.images[0]):'')||'';
      const imageUrl=absoluteUrl(raw,src);if(!/^https?:\/\//i.test(imageUrl))throw new Error('Shopify product JSON has no image');
      const hash=crypto.createHash('sha1').update(imageUrl).digest('hex').slice(0,10);
      const ext=extFromImageUrl(imageUrl);const filename=`${String(nextIndex).padStart(3,'0')}-${fileSlug(id)}-${hash}.${ext}`;
      items.push({index:nextIndex,sourceUrl:imageUrl,filename,localPath:'/PC-Build/images/products/'+filename,ids:[id],names:[String(p?.name||'').trim()].filter(Boolean),jsonFiles:['PC-Build/pc-shop-products-v1487.json'],discoveredFrom:js});
      known.add(id);nextIndex++;added++;console.log(`[DISCOVER] ${id} -> exact Shopify featured image`);
    }catch(e){console.warn(`[DISCOVER FAIL] ${id}: ${e.message}`)}
  }
  manifest.version='1502';manifest.expectedImages=items.length;manifest.images=items;manifest.discoveredExactShopifyImages=added;manifest.updatedAt=new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n','utf8');
}

function walkJsonFiles(dir,out=[]){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walkJsonFiles(p,out);else if(ent.isFile()&&ent.name.endsWith('.json')&&p!==MANIFEST_PATH&&p!==READY_JSON)out.push(p)}return out;}
function replaceDeep(v,map){if(Array.isArray(v))return v.map(x=>replaceDeep(x,map));if(v&&typeof v==='object'){for(const k of Object.keys(v))v[k]=replaceDeep(v[k],map);return v;}if(typeof v==='string'&&map.has(v))return map.get(v);return v;}
function patchJsons(urlMap){let changed=0;for(const p of walkJsonFiles(path.join(ROOT,'PC-Build'))){let d;try{d=JSON.parse(fs.readFileSync(p,'utf8'))}catch{continue}const before=JSON.stringify(d);replaceDeep(d,urlMap);const after=JSON.stringify(d);if(after!==before){fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n','utf8');changed++;}}return changed;}
function normName(v){return String(v||'').toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function writeMap(readyItems){
  const byUrl={},byId={},byName={};
  for(const it of readyItems){
    byUrl[it.sourceUrl]=it.localPath;
    try{const u=new URL(it.sourceUrl);u.search='';u.hash='';byUrl[u.toString()]=it.localPath;}catch{}
    for(const id of (it.ids||[])){if(!id)continue;byId[id]=it.localPath;byId['json-'+id]=it.localPath;}
    for(const name of (it.names||[])){const k=normName(name);if(k)byName[k]=it.localPath;}
  }
  const obj={version:'1502',policy:'local-locked-resilient',ready:readyItems.length>0,manifestReady:true,enforceLocal:true,liveImageMutation:false,partialAllowed:true,expected:items.length,downloaded:readyItems.length,missing:Math.max(0,items.length-readyItems.length),byId,byUrl,byName};
  fs.writeFileSync(MAP_JS,'window.AZOBSS_PC_LOCAL_IMAGES='+JSON.stringify(obj)+';\n','utf8');return obj;
}
function buildZip(){
  const parent=path.dirname(ROOT); const out=path.join(parent,'(1502)-AZOBSS-FULL-WEBSITE-RESILIENT-LOCAL-IMAGES_20261103.zip');
  try{if(fs.existsSync(out))fs.unlinkSync(out)}catch{}
  if(process.platform==='win32'){
    const esc=s=>s.replace(/'/g,"''");
    const ps=`$src='${esc(ROOT)}';$out='${esc(out)}';Compress-Archive -Path ($src+'\\*') -DestinationPath $out -CompressionLevel Optimal -Force`;
    const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{stdio:'inherit'});if(r.status!==0)throw new Error('Compress-Archive failed');
  }else{
    const r=spawnSync('zip',['-qr',out,'.'],{cwd:ROOT,stdio:'inherit'});if(r.status!==0)throw new Error('zip failed');
  }
  return out;
}
(async()=>{
  console.log('AZOBSS v1502 — build RESILIENT local PC / Hardware image library');
  await discoverMissingShopifyImages();
  console.log('Target:',PRODUCT_DIR); console.log('Images:',items.length);
  const results=await pool(items,4,async(it,i)=>{const r=await downloadOne(it);console.log(`[${String(i+1).padStart(2,'0')}/${items.length}] ${r.ok?'OK':'FAIL'} ${it.filename}${r.ok?' ('+r.size+' bytes)':' — '+r.error}`);return r;});
  const failures=results.map((r,i)=>!r.ok?{item:items[i],error:r.error}:null).filter(Boolean);
  const readyItems=items.filter((it,i)=>results[i]?.ok===true);
  if(!readyItems.length){console.error('\nFAILED: no valid local images are available yet. Run this BAT again after checking internet access.');for(const f of failures)console.error('-',f.item.filename,':',f.error);process.exit(2);}
  const urlMap=new Map(readyItems.map(x=>[x.sourceUrl,x.localPath])); const changed=patchJsons(urlMap); const localMap=writeMap(readyItems);
  fs.writeFileSync(READY_JSON,JSON.stringify({ok:true,complete:failures.length===0,version:'1502',policy:'local-locked-resilient',downloaded:readyItems.length,expected:items.length,missing:failures.length,missingItems:failures.map(f=>({id:(f.item.ids||[])[0]||'',filename:f.item.filename,error:f.error})),preparedAt:new Date().toISOString(),jsonFilesLocalized:changed},null,2)+'\n');
  console.log(`\nREADY: ${readyItems.length}/${items.length} exact local images are valid.`);console.log('JSON files localized:',changed);console.log('PARTIAL SUCCESS IS ALLOWED: successful local images stay visible; only missing hardware images use placeholders.');
  if(failures.length){console.warn(`Missing ${failures.length} image(s); deployment ZIP will still be created.`);for(const f of failures)console.warn('-',f.item.filename,':',f.error);}
  try{const z=buildZip();console.log('\nREADY DEPLOY ZIP:',z);}catch(e){console.error('Local images are ready, but ZIP creation failed:',e.message);process.exit(3)}
})().catch(e=>{console.error(e);process.exit(1)});
