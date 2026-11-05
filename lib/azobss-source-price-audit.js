'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

// The source PDF and its extracted costs are encrypted in the public repository.
// Derive a separate data key; never expose the existing deployment secret.
const deriveKey=secret=>Buffer.from(crypto.hkdfSync('sha256',Buffer.from(String(secret).trim()),Buffer.from('AZOBSS source prices'),Buffer.from('upgrade-source-audit-v1'),32));
function openEnvelope(bytes,secret){
 if(!secret)throw Error('source_price_key_unavailable');
 const e=JSON.parse(bytes),dec=crypto.createDecipheriv('aes-256-gcm',deriveKey(secret),Buffer.from(e.iv,'base64'));
 dec.setAuthTag(Buffer.from(e.tag,'base64'));
 return Buffer.concat([dec.update(Buffer.from(e.data,'base64')),dec.final()]);
}
function createSourcePriceAudit({rootDir,getAdminIdentity,getHardware,getBuilds,sellingPrice,send,env=process.env}){
 let upgrade=null,pdf=null;
 const read=name=>{
  const secret=env.PC_SOURCE_PRICE_KEY||env.SOLATTIME_ORDER_CIPHER_KEY;
  if(!secret)throw Error('source_price_key_unavailable');
  let bytes;try{bytes=fs.readFileSync(path.join(rootDir,'lib','data',name));}catch(_){throw Error('source_price_data_missing');}
  try{return openEnvelope(bytes,secret);}catch(_){throw Error('source_price_decryption_failed');}
 };
 const source=()=>upgrade||(upgrade=JSON.parse(read('upgrade-source-v1520.enc').toString('utf8')));
 const finite=n=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):null;
 const json=(res,status,body)=>send(res,status,JSON.stringify(body),'application/json',{'Cache-Control':'private, no-store','Vary':'Authorization'});
 async function handle(req,res,parsed){
  const route=parsed?.pathname;
  if(!['/api/admin/pc-shop/source-prices','/api/admin/pc-shop/source-pricelist.pdf'].includes(route))return false;
  const admin=await getAdminIdentity(req,parsed);
  if(!admin?.isAdmin){json(res,403,{ok:false,error:'admin_required'});return true;}
  if(String(req.method||'GET').toUpperCase()!=='GET'){json(res,405,{ok:false,error:'method_not_allowed'});return true;}
  try{
   if(route.endsWith('.pdf')){
    pdf=pdf||read('upgrade-source-pdf-v1520.enc');
    send(res,200,pdf,'application/pdf',{'Cache-Control':'private, no-store','Vary':'Authorization','Content-Disposition':'inline; filename="Viewnet-PRICELIST-2026-11-05.pdf"','X-Content-Type-Options':'nosniff'});
    return true;
   }
   const scope=parsed?.query?.scope||'pc';let rows=[];
   if(scope==='upgrade'){
    const data=source();
    rows=data.products.map(p=>({id:p.id,sourceName:data.source,sourceDate:data.date,sourcePage:p.sourcePage,sourceLine:p.sourceLine,sourceSha256:data.sourceSha256,priceStatus:'snapshot',options:p.options.map(o=>({label:o.label,cost:o.cost,expectedPrice:sellingPrice(o.cost,{type:['Mini PC','Office PC'].includes(p.category)?'desktop':'hardware'}).price}))}));
   }else if(scope==='pc'||scope==='builds'){
    const c=scope==='pc'?await getHardware():await getBuilds();
    rows=(c.internalProducts||c.internalBuilds||[]).map(p=>({id:p.id,sourceName:p.sourceName||p.storeName||'',sourceUrl:p.sourceUrl||'',sourceDate:p.priceCheckedAt||p.sourceCheckedAt||p.snapshotCheckedAt||'',priceStatus:p.priceStatus||'unverified',available:p.available===true,options:[{label:'Seunit',cost:finite(p.sourcePrice??p.unitCost),expectedPrice:finite(p.price)}]}));
   }else{json(res,400,{ok:false,error:'invalid_scope'});return true;}
   json(res,200,{ok:true,release:'1521',scope,records:rows});
  }catch(e){const known=['source_price_key_unavailable','source_price_data_missing','source_price_decryption_failed'];json(res,503,{ok:false,error:known.includes(e.message)?e.message:'source_prices_unavailable'});}
  return true;
 }
 let readiness=null,checked=0;
 function status(){
  if(readiness&&(readiness.ready||Date.now()-checked<60000))return readiness;
  checked=Date.now();
  try{const data=source();pdf=pdf||read('upgrade-source-pdf-v1520.enc');readiness={ready:true,records:data.products.length,pdfReady:pdf.subarray(0,5).toString()==='%PDF-'};}
  catch(e){readiness={ready:false,error:['source_price_key_unavailable','source_price_data_missing','source_price_decryption_failed'].includes(e.message)?e.message:'source_prices_unavailable'};}
  return readiness;
 }
 return {handle,status};
}
module.exports={createSourcePriceAudit,deriveKey,openEnvelope};
