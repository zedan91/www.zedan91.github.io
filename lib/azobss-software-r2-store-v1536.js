'use strict';
const crypto=require('node:crypto');
function createSoftwareR2Store({baseUrl,secret,fetchImpl=fetch,now=Date.now}){
 async function call(data){
  const base=String(baseUrl()||'').replace(/\/+$/,''),key=secret();if(!base||!key)throw Error('Private availability storage is not configured.');
  const body=JSON.stringify({...data,atMs:now()}),signature=crypto.createHmac('sha256',key).update('azobss-availability-v1536\n'+body).digest('base64url');
  const r=await fetchImpl(base+'/software-availability-admin',{method:'POST',headers:{'Content-Type':'application/json','x-azobss-availability-signature':signature},body,redirect:'error',signal:AbortSignal.timeout(15000)});let d;try{d=await r.json();}catch{throw Object.assign(Error('Private availability storage could not be updated.'),{statusCode:r.status});}
  if(!r.ok||!d.ok)throw Object.assign(Error('Private availability storage could not be updated.'),{statusCode:r.status});return d.state;
 }
 return {read:()=>call({action:'read'}),update:async change=>{for(let i=0;i<5;i++){const previous=await call({action:'read'}),next=change(previous);try{return await call({action:'write',expectedRevision:Number(previous.revision)||0,state:next});}catch(e){if(e.statusCode!==409||i===4)throw e;await new Promise(r=>setTimeout(r,250*(i+1)));}}}};
}
module.exports={createSoftwareR2Store};
