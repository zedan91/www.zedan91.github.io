'use strict';
const model=require('../assets/js/azobss-pc-model-v1537');
function createPcCatalogVisibility({store,getAdminIdentity,readBody,send,now=Date.now}){
 const key=id=>String(id||'').trim().toLowerCase();
 const hidden=(p,state)=>state.items?.[key(p.id||p.productId)]?.paused===true||state.stores?.[model.storeKey(p)]?.paused===true;
 async function read(){return await store.read();}
 async function handle(req,res,parsed){
  const adminPath=parsed.pathname==='/api/admin/pc-shop/visibility',publicPath=parsed.pathname==='/api/pc-shop/visibility';if(!adminPath&&!publicPath)return false;
  const reply=(status,data)=>send(res,status,JSON.stringify(data),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  try{
   let admin;if(adminPath){admin=await getAdminIdentity(req,parsed);if(!admin?.isAdmin){reply(403,{ok:false,error:'Administrator authorization required.'});return true;}}
   if(req.method==='GET'){const state=await read();reply(200,{ok:true,hiddenProductIds:Object.entries(state.items||{}).filter(([,x])=>x.paused).map(([id])=>id),hiddenStoreIds:Object.entries(state.stores||{}).filter(([,x])=>x.paused).map(([id])=>id),revision:Number(state.revision)||0,...(adminPath?{stores:model.stores}:{} )});}
   else if(adminPath&&req.method==='POST'){
    let body;try{body=JSON.parse(await readBody(req)||'{}');}catch{reply(400,{ok:false,error:'Invalid JSON.'});return true;}
    const ids=Array.isArray(body.ids)?[...new Set(body.ids.map(key))]:[],storeId=key(body.storeId);
    if(typeof body.hidden!=='boolean'||(storeId&&!Object.hasOwn(model.stores,storeId))||(!storeId&&(!ids.length||ids.length>100||ids.some(id=>!/^[-a-z0-9_]{1,180}$/.test(id))))||(storeId&&ids.length)){reply(400,{ok:false,error:'Choose up to100 cards or one valid supplier.'});return true;}
    const state=await store.update(old=>{const items={...(old.items||{})},stores={...(old.stores||{})},at=now(),record={paused:body.hidden,updatedAtMs:at,updatedBy:String(admin.uid||admin.username||'admin').slice(0,160)};if(storeId)stores[storeId]=record;else for(const id of ids)items[id]=record;return {items,stores,revision:(Number(old.revision)||0)+1,updatedAtMs:at};});
    reply(200,{ok:true,changed:storeId?1:ids.length,revision:state.revision});
   }else reply(405,{ok:false,error:'Method not allowed.'});
  }catch(e){reply(503,{ok:false,error:'Catalogue visibility could not be checked or saved. Please retry.'});}
  return true;
 }
 return {read,hidden,handle};
}
module.exports={createPcCatalogVisibility};
