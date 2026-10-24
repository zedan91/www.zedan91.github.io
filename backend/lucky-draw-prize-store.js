import {atomicJson,problem} from './lucky-draw-settings.js';
export function createPrizeStore({db,getFile,readJson}){
 function keyOf(key){if(typeof key!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw problem(400,'Bulan hadiah tidak sah.');return key;}
 const reference=key=>db.collection('luckyDrawPrizes').doc(keyOf(key));
 async function get(key,fallback=null){
  keyOf(key);
  if(!db)return readJson(getFile(key),fallback);
  const ref=reference(key),snapshot=await ref.get();
  if(snapshot.exists)return snapshot.data();
  const local=readJson(getFile(key),null);
  if(!local||typeof local!=='object'||local.monthKey!==key)return fallback;
  // Migrate a legacy local record once, without overwriting a concurrent admin save.
  return db.runTransaction(async tx=>{const latest=await tx.get(ref);if(latest.exists)return latest.data();tx.set(ref,local);return local;});
 }
 async function save(key,prize){
  keyOf(key);const record={...prize,monthKey:key};
  // A configured Firestore error must fail the save; never claim a temporary copy is durable.
  if(db){await reference(key).set(record);return record;}
  atomicJson(getFile(key),record);return record;
 }
 return {get,save,storage:db?'firestore':'json'};
}
