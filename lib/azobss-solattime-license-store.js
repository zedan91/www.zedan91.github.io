'use strict';
const crypto=require('node:crypto');
const {codec,isOrder,COLLECTION,purchaseContext,licensesOf}=require('./azobss-solattime-commerce');
const NEW=/^AZST-(?:[A-Z2-7]{5}-){5}[A-Z2-7]{5}$/,OLD=/^AZST-(?:[A-F0-9]{4}-){4}[A-F0-9]{4}$/;
const fail=(status,message)=>Object.assign(new Error(message),{statusCode:status});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function vaultCodec(secret){
 if(!/^[a-fA-F0-9]{64}$/.test(String(secret||'').trim()))throw fail(503,'Simpanan serial SolatTime belum dikonfigurasi.');
 const key=crypto.hkdfSync('sha256',Buffer.from(secret.trim(),'hex'),Buffer.alloc(0),Buffer.from('solattime-license-admin-v1'),32);
 return {
  encrypt(serial,id){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('solattime-license-vault-v1:'+id));const raw=Buffer.concat([cipher.update(serial,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),raw.toString('base64url')].join('.');},
  decrypt(value,id){const [v,iv,tag,raw,...extra]=String(value||'').split('.');if(v!=='v1'||extra.length||!iv||!tag||!raw)throw Error('Invalid cipher');const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAAD(Buffer.from('solattime-license-vault-v1:'+id));decipher.setAuthTag(Buffer.from(tag,'base64url'));const serial=Buffer.concat([decipher.update(Buffer.from(raw,'base64url')),decipher.final()]).toString('utf8');if(!NEW.test(serial)&&!OLD.test(serial))throw Error('Invalid serial');return serial;}
 };
}
function createLicenseStore({getDb,findOrder,env=process.env,now=Date.now}){
 let readyUntil=0;
 const store=()=>{const db=getDb();if(!db)throw fail(503,'Simpanan lesen SolatTime belum tersedia.');return db;};
 const ref=id=>store().collection(COLLECTION).doc('license_'+id);
 const crypt=()=>vaultCodec(env.SOLATTIME_ORDER_CIPHER_KEY);
 async function read(id){const snapshot=await ref(id).get();return snapshot.exists?snapshot.data():{};}
 async function merge(id,patch){await store().runTransaction(async tx=>{const doc=ref(id),snapshot=await tx.get(doc);tx.set(doc,{...(snapshot.exists?snapshot.data():{}),kind:'license-admin-v1',license_id:id,...patch});});}
 async function call(upstream,action,body){const result=await upstream(action,body);if(!result.ok)throw fail(result.status===404?404:result.status===409?409:503,result.data?.error==='state_changed'?'Status lesen berubah. Refresh dan cuba semula.':'Tindakan lesen belum berjaya. Refresh dan semak status sebelum mencuba semula.');return result.data;}
 async function ready(upstream){crypt();store();if(now()<readyUntil)return;const data=await call(upstream,'management-ready',{});if(data.management_protocol!==1)throw fail(503,'Servis pengurusan lesen perlu dikemas kini.');readyUntil=now()+30000;}
 async function enrich(row){
  const saved=await read(row.id),result={...row,email:saved.email||'',phone:saved.phone||'',serial:'',serial_state:'unavailable',deleted:row.deleted===1};
  if(saved.serial_cipher){try{const serial=crypt().decrypt(saved.serial_cipher,row.id);if(hash(serial)===row.serial_hash){result.serial=serial;result.serial_state='available';}}catch{result.serial_state='unreadable';}}
  if(row.purchase_key&&!String(row.purchase_key).startsWith('admin-')&&typeof findOrder==='function'){
   try{
    let orderId=row.purchase_key;
    if(String(orderId).startsWith('stp-')){const found=await store().collection(COLLECTION).where('purchase_keys','array-contains',orderId).limit(1).get();if(!found.docs.length)return result;orderId=found.docs[0].id;}
    const order=await findOrder(orderId);if(!order||!isOrder(order)||order.status!=='paid'||!(order.paymentVerifiedAt||order.toyyibVerifiedAt||order.stripeVerifiedAt))return result;
    const snapshot=await store().collection(COLLECTION).doc(orderId).get(),record=snapshot.exists?snapshot.data():{};
    const context=purchaseContext(order);
    if(record.issued_at&&(record.license_ids||[record.license_id]).includes(row.id)&&record.context===context){
     if(saved.email===undefined)result.email=String(order.email||order.user?.email||'');if(saved.phone===undefined)result.phone=String(order.user?.phone||'');
     if(!result.serial){const value=licensesOf(codec(env.SOLATTIME_ORDER_CIPHER_KEY).decrypt(record.cipher,context)).find(x=>x.license_id===row.id);if(value&&hash(value.serial)===row.serial_hash){result.serial=value.serial;result.serial_state='available';}}
    }
   }catch{result.serial_state='unreadable';}
  }
  return result;
 }
 async function run(action,payload,upstream,identity){
  if(action==='list'){
   const response=await upstream(action,payload);if(!response.ok)return response;
   if(!Array.isArray(response.data.licenses))throw Error('Invalid list');
   const licenses=await Promise.all(response.data.licenses.map(enrich));
   return {...response,data:{...response.data,licenses,management_enabled:response.data.management_protocol===1}};
  }
  if(!['issue','import-legacy','edit','attach-serial','reset','delete','undelete'].includes(action))return upstream(action,payload);
  await ready(upstream);
  let data;
  if(action==='issue'){
   const id=payload.request_id||crypto.randomUUID(),fingerprint=hash(JSON.stringify([identity.uid,payload.customer,payload.email||'',payload.phone||''])),doc=ref(id);
   const record=await store().runTransaction(async tx=>{
    const snapshot=await tx.get(doc);if(snapshot.exists){const old=snapshot.data();if(old.request_fingerprint!==fingerprint)throw fail(409,'Permintaan serial ini sudah digunakan untuk maklumat lain.');return old;}
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',serial='AZST-'+Array.from(crypto.randomBytes(30),x=>alphabet[x&31]).join('').match(/.{5}/g).join('-');
    const next={kind:'license-admin-v1',license_id:id,request_fingerprint:fingerprint,customer:payload.customer,email:payload.email||'',phone:payload.phone||'',serial_cipher:crypt().encrypt(serial,id),state:'vault-prepared',created_at:new Date(now()).toISOString()};tx.set(doc,next);return next;
   });
   const serial=crypt().decrypt(record.serial_cipher,id);
   if(record.state!=='vault-issued'){data=await call(upstream,'issue-order',{order_id:'admin-'+id,license_id:id,customer:record.customer,serial});if(data.license_id!==id)throw Error('Issue mismatch');await merge(id,{state:'vault-issued'});}
   else{const existing=await call(upstream,'license',{license_id:id});if(existing.license?.deleted)throw fail(409,'Lesen ini berada dalam arkib. Pulihkan rekod melalui senarai arkib.');}
   return {ok:true,status:200,data:{ok:true,license_id:id,serial}};
  }
  if(action==='edit'){
   await call(upstream,'edit',{license_id:payload.license_id,customer:payload.customer});
   await merge(payload.license_id,{customer:payload.customer,email:payload.email,phone:payload.phone,updated_at:new Date(now()).toISOString()});data={ok:true};
  }else if(action==='attach-serial'){
   const value=await call(upstream,'license',{license_id:payload.license_id}),row=value.license;
   if(!row||row.deleted||hash(payload.serial)!==row.serial_hash)throw fail(409,'Serial tidak sepadan dengan lesen yang dipilih.');
   await merge(row.id,{serial_cipher:crypt().encrypt(payload.serial,row.id),updated_at:new Date(now()).toISOString()});data={ok:true};
  }else if(action==='import-legacy'){
   data=await call(upstream,action,payload);if(!data.license_id)throw Error('Missing ID');
   await merge(data.license_id,{serial_cipher:crypt().encrypt(payload.serial,data.license_id),state:'vault-imported'});
  }else data=await call(upstream,action,payload);
  return {ok:true,status:200,data};
 }
 return {run};
}
module.exports={createLicenseStore,vaultCodec};
