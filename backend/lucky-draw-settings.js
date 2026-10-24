import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DEFAULTS,validateSettings,scheduledAt,eligibleEntries,malaysiaMonth} from './lucky-draw-model.js';
export const problem=(status,message)=>Object.assign(new Error(message),{status});
export function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(value,null,2));fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
export function createSettingsStore({db,file,readJson,now=Date.now}){
 const reference=()=>db.collection('luckyDrawConfig').doc('current');
 function clean(record){return {config:validateSettings(record?.config||{}),revision:Number.isInteger(record?.revision)?record.revision:0};}
 async function get(){if(db){const snap=await reference().get();return clean(snap.exists?snap.data():{});}return clean(readJson(file,{}));}
 async function save(value,expected,actor){
  const config=validateSettings(value);if(!Number.isInteger(expected)||expected<0)throw problem(400,'Versi tetapan tidak sah.');
  const update=old=>{const previous=clean(old);if(previous.revision!==expected)throw problem(409,'Tetapan telah berubah. Muat semula sebelum menyimpan.');return {config,revision:expected+1,updatedAt:new Date(now()).toISOString(),updatedBy:String(actor||'admin').slice(0,160),audit:[...(old?.audit||[]).slice(-49),{revision:expected+1,time:new Date(now()).toISOString(),by:String(actor||'admin').slice(0,160)}]};};
  if(db)return db.runTransaction(async tx=>{const doc=reference(),snapshot=await tx.get(doc),next=update(snapshot.exists?snapshot.data():{});tx.set(doc,next);return clean(next);});
  const next=update(readJson(file,{}));atomicJson(file,next);return clean(next);
 }
 return {get,save,reference,defaults:DEFAULTS};
}
export function createDrawRunner({db,settings,readJson,getWinnerFile,getEntriesFile,monthRef,participantsRef,winnerRef,now=Date.now,randomInt=crypto.randomInt}){
 function select(key,rows,config,source){
  const pool=eligibleEntries(rows,key);if(pool.length<config.minParticipants)throw problem(409,'Minimum '+config.minParticipants+' peserta diperlukan. Kini '+pool.length+'.');
  if(source==='schedule'&&(scheduledAt(config,key)===null||now()<scheduledAt(config,key)))throw problem(409,'Cabutan belum dijadualkan.');
  const winner=pool[randomInt(pool.length)];return {monthKey:key,monthName:new Date(key+'-01T00:00:00+08:00').toLocaleDateString('ms-MY',{timeZone:'Asia/Kuala_Lumpur',month:'long',year:'numeric'}),usernameKey:winner.usernameKey,name:winner.name||winner.usernameKey,participantTotal:pool.length,selectedAtMs:now(),selectedAt:new Date(now()).toISOString(),selectedBy:source,method:'crypto.randomInt',drawId:crypto.randomUUID()};
 }
 async function run(key,source='admin'){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)||key!==malaysiaMonth(now()))throw problem(400,'Cabutan hanya untuk bulan semasa Malaysia.');
  if(db)return db.runTransaction(async tx=>{
   const wref=winnerRef(key),mref=monthRef(key),[existing,month,configRecord,entries]=await Promise.all([tx.get(wref),tx.get(mref),tx.get(settings.reference()),tx.get(participantsRef(key).where('deleted','==',false))]);
   if(existing.exists)return {winner:existing.data(),alreadySelected:true};
   const config=validateSettings(configRecord.exists?configRecord.data().config:{}),rows=entries.docs.map(doc=>({id:doc.id,...doc.data()})),winner=select(key,rows,config,source);
   tx.set(wref,winner);tx.set(mref,{winnerUsername:winner.usernameKey,winnerSelectedAt:winner.selectedAt,drawStatus:'closed',updatedAtMs:now()},{merge:true});return {winner,alreadySelected:false};
  });
  const {config}=await settings.get();
  // No asynchronous boundary between the JSON snapshot and atomic result commit.
  const existing=readJson(getWinnerFile(key),null);if(existing)return {winner:existing,alreadySelected:true};
  const winner=select(key,readJson(getEntriesFile(key),[]),config,source);atomicJson(getWinnerFile(key),winner);return {winner,alreadySelected:false};
 }
 return {run};
}
