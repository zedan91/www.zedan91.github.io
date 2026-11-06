'use strict';
const crypto=require('node:crypto');
const objectHash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const MESSAGE='This software is temporarily unavailable while it is being updated. Please try again later.';
const fail=(statusCode,message=MESSAGE)=>Object.assign(new Error(message),{statusCode,code:statusCode===423?'SOFTWARE_PAUSED':'SOFTWARE_AVAILABILITY_UNAVAILABLE'});
function key(value){return String(value||'').trim().toLowerCase();}
function productIds(value={}){
 if(typeof value==='string')return [key(value)].filter(Boolean);
 return [...new Set([value.productId,value.id,value.sku,value.product?.productId,value.product?.id].map(key).filter(Boolean))];
}
function createSoftwareAvailability({getDb,getAdminIdentity,findProduct,readBody,send,store,now=Date.now}){
 const ref=()=>{const db=getDb();if(!db)throw fail(503,'Software availability could not be checked. Please try again.');return {db,doc:db.collection('settings').doc('softwareAvailabilityV1534')};};
 async function read(){try{if(store)return await store.read();const {doc}=ref(),snap=await doc.get();return snap.exists?snap.data()||{}:{};}catch(e){throw fail(503,'Software availability could not be checked. Please try again.');}}
 async function assertAvailable(value){
  const ids=productIds(value),keys=typeof value==='object'?[value.r2ObjectKey,value.r2Key,value.sourceTarget,value.product?.r2ObjectKey].filter(Boolean):[];if(!ids.length&&!keys.length)return;
  const state=await read();if(ids.some(id=>state.items?.[id]?.paused===true)||Object.values(state.items||{}).some(row=>row.paused===true&&(row.objectKeys||[]).some(k=>keys.includes(k))))throw fail(423);
 }
 async function handle(req,res,parsed){
  const pathname=parsed.pathname,adminRoute=pathname==='/api/admin/software-availability',publicRoute=pathname==='/api/software-availability';
  if(!adminRoute&&!publicRoute)return false;
  const reply=(status,value)=>send(res,status,JSON.stringify(value),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  try{
   let admin;if(adminRoute){admin=await getAdminIdentity(req,parsed);if(!admin?.isAdmin){reply(403,{ok:false,error:'Administrator authorization required.'});return true;}}
   if(req.method==='GET'){
    const state=await read();
    if(adminRoute)reply(200,{ok:true,items:Object.values(state.items||{}),revision:Number(state.revision)||0});
    else {const paused=Object.entries(state.items||{}).filter(([,x])=>x.paused===true);reply(200,{ok:true,pausedIds:paused.map(([id])=>id),pausedObjectHashes:[...new Set(paused.flatMap(([,x])=>x.objectKeys||[]).map(objectHash))],revision:Number(state.revision)||0});}
   }else if(adminRoute&&req.method==='POST'){
    let body;try{body=JSON.parse(await readBody(req)||'{}');}catch{throw fail(400,'Invalid JSON.');}
    const id=String(body.productId||'').trim(),reason=String(body.reason||'').trim();
    if(!/^[A-Za-z0-9][A-Za-z0-9_. -]{0,179}$/.test(id)||typeof body.paused!=='boolean'||reason.length>240)throw fail(400,'Choose a valid product, pause state and reason of up to240 characters.');
    const product=await findProduct(id,body);if(!product)throw fail(404,'Software product not found. Reload the catalogue.');
    const canonical=String(product.productId||product.id||id),ids=[...new Set([...productIds(product),key(id)])];
    let result;
    const change=old=>{
     const items={...(old.items||{})},revision=(Number(old.revision)||0)+1,at=now();
     const objectKeys=[...new Set([product.r2ObjectKey,product.r2Key,product.downloadObjectKey,product.privateObjectKey,...(product.additionalObjectKeys||[])].map(x=>String(x||'').trim()).filter(Boolean))].slice(0,4);
     const row={productId:canonical,name:String(product.name||product.title||canonical).slice(0,180),paused:body.paused,reason,objectKeys,updatedAtMs:at,updatedBy:String(admin.uid||admin.username||'admin').slice(0,160)};
     for(const alias of ids)items[alias]=row;
     result={ok:true,...row,revision};return {items,revision,updatedAtMs:at};
    };
    if(store)await store.update(change);else {const {db,doc}=ref();await db.runTransaction(async tx=>{const snap=await tx.get(doc);tx.set(doc,change(snap.exists?snap.data()||{}:{}),{merge:false});});}
    reply(200,result);
   }else reply(405,{ok:false,error:'Method not allowed.'});
  }catch(e){reply(Number(e.statusCode)||503,{ok:false,error:e.statusCode?e.message:'Software availability could not be updated.',code:e.code||'SOFTWARE_AVAILABILITY_UNAVAILABLE'});}
  return true;
 }
 return {read,assertAvailable,handle};
}
module.exports={createSoftwareAvailability,productIds,MESSAGE};
