'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createLicenseStore,vaultCodec}=require('../lib/azobss-solattime-license-store');
const {codec,COLLECTION}=require('../lib/azobss-solattime-commerce');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
class Store{
 constructor(){this.values=new Map();this.queue=Promise.resolve();}
 collection(name){return {doc:id=>{const key=name+'/'+id;return {key,get:async()=>({exists:this.values.has(key),data:()=>structuredClone(this.values.get(key))})};}};}
 runTransaction(fn){const next=this.queue.then(()=>fn({get:ref=>ref.get(),set:(ref,value)=>this.values.set(ref.key,structuredClone(value))}));this.queue=next.catch(()=>{});return next;}
}
function fixture(){
 const db=new Store(),rows=new Map(),orders=new Map(),calls=[];let lost=false;
 const env={SOLATTIME_ORDER_CIPHER_KEY:crypto.randomBytes(32).toString('hex')};
 const manager=createLicenseStore({getDb:()=>db,findOrder:async id=>orders.get(id),env});
 const upstream=async(action,payload)=>{
  calls.push({action,payload:structuredClone(payload)});let data={ok:true};
  if(action==='management-ready')data.management_protocol=1;
  else if(action==='issue-order'){let row=rows.get(payload.license_id);if(!row){row={id:payload.license_id,customer:payload.customer,serial_hash:sha(payload.serial),purchase_key:payload.order_id,status:'active',source:'new',deleted:0,generation:0};rows.set(row.id,row);}if(row.serial_hash!==sha(payload.serial))return {ok:false,status:409,data:{error:'order_conflict'}};if(lost){lost=false;throw Error('Lost response');}data.license_id=row.id;}
  else if(action==='license')data.license=rows.get(payload.license_id);
  else if(action==='list')data={licenses:[...rows.values()],next_offset:null,management_protocol:1};
  else if(action==='edit')rows.get(payload.license_id).customer=payload.customer;
  return {ok:true,status:200,data};
 };
 return {db,rows,orders,calls,env,manager,run:(action,payload)=>manager.run(action,payload,upstream,{uid:'owner'}),lose:()=>lost=true};
}
const request=()=>({request_id:crypto.randomUUID(),customer:'Customer fixture',email:'fixture@example.com',phone:'01112345678'});
test('concurrent manual issue reserves one encrypted serial and lists that same serial/contact data',async()=>{
 const f=fixture(),input=request(),results=await Promise.all([f.run('issue',input),f.run('issue',input)]);assert.equal(f.rows.size,1);assert.equal(results[0].data.serial,results[1].data.serial);assert.ok(!JSON.stringify([...f.db.values]).includes(results[0].data.serial));assert.ok([...f.db.values.values()].every(value=>value.state==='vault-issued'));
 const list=(await f.run('list',{})).data;assert.equal(list.licenses[0].serial,results[0].data.serial);assert.equal(list.licenses[0].email,input.email);assert.equal(list.management_enabled,true);
});
test('lost Worker response retries the durable serial instead of issuing another licence',async()=>{
 const f=fixture(),input=request();f.lose();await assert.rejects(()=>f.run('issue',input));const first=f.calls.find(call=>call.action==='issue-order').payload.serial;
 const retry=await f.run('issue',input);assert.equal(retry.data.serial,first);assert.equal(f.rows.size,1);
 await assert.rejects(()=>f.run('issue',{...input,customer:'Other'}));assert.equal(f.rows.size,1);
 f.rows.get(input.request_id).deleted=1;await assert.rejects(()=>f.run('issue',input));assert.equal(f.rows.get(input.request_id).deleted,1);
});
test('paid serial recovery requires the original payment context, issued marker and Worker hash',async()=>{
 const f=fixture(),id=crypto.randomUUID(),serial='AZST-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE-FFFFF';
 const order={orderId:'stripe-fixture',product:{licenseProduct:'solattime',fulfilment:'solattime'},status:'paid',paymentVerifiedAt:'verified',amountSen:3000,user:{uid:'buyer',phone:'011123'},email:'buyer@example.com'};
 const context=JSON.stringify(['solattime-purchase-v1',order.orderId,'buyer',3000]);f.orders.set(order.orderId,order);f.rows.set(id,{id,customer:'Buyer',purchase_key:order.orderId,serial_hash:sha(serial),deleted:0});f.db.values.set(COLLECTION+'/'+order.orderId,{license_id:id,context,issued_at:'issued',cipher:codec(f.env.SOLATTIME_ORDER_CIPHER_KEY).encrypt({license_id:id,serial},context)});
 let list=(await f.run('list',{})).data;assert.equal(list.licenses[0].serial,serial);assert.equal(list.licenses[0].email,'buyer@example.com');
 order.amountSen=1;list=(await f.run('list',{})).data;assert.equal(list.licenses[0].serial,'');order.amountSen=3000;f.rows.get(id).serial_hash=sha('another');list=(await f.run('list',{})).data;assert.equal(list.licenses[0].serial,'');
});
test('wrong key and tampered vault fail without replacing an existing serial',async()=>{
 const f=fixture(),input=request(),issued=await f.run('issue',input),snapshot=JSON.stringify([...f.db.values]);f.env.SOLATTIME_ORDER_CIPHER_KEY='b'.repeat(64);await assert.rejects(()=>f.run('issue',input));assert.equal(JSON.stringify([...f.db.values]),snapshot);assert.equal(f.rows.size,1);assert.equal((await f.run('list',{})).data.licenses[0].serial,'');
 assert.throws(()=>vaultCodec('a'.repeat(64)).decrypt(vaultCodec('a'.repeat(64)).encrypt(issued.data.serial,input.request_id),crypto.randomUUID()));
});
test('attaching a known legacy serial verifies its hash and does not change device ownership',async()=>{
 const f=fixture(),id=crypto.randomUUID(),serial='AZST-1234-5678-9ABC-DEF0-1234';f.rows.set(id,{id,customer:'Legacy',source:'legacy',serial_hash:sha(serial),generation:4,device_count:1,deleted:0});
 await assert.rejects(()=>f.run('attach-serial',{license_id:id,serial:'AZST-AAAA-BBBB-CCCC-DDDD-EEEE'}));await f.run('attach-serial',{license_id:id,serial});assert.equal((await f.run('list',{})).data.licenses[0].serial,serial);assert.equal(f.rows.get(id).generation,4);assert.equal(f.rows.get(id).device_count,1);
});
test('editing metadata preserves serial and payment owner while reset/delete keep expected generation',async()=>{
 const f=fixture(),input=request(),issued=await f.run('issue',input);
 await f.run('edit',{license_id:input.request_id,customer:'Updated',email:'new@example.com',phone:'012345'});const row=(await f.run('list',{})).data.licenses[0];assert.equal(row.serial,issued.data.serial);assert.equal(row.email,'new@example.com');assert.equal(row.customer,'Updated');
 await f.run('reset',{license_id:row.id,expected_generation:7});assert.deepEqual(f.calls.at(-1).payload,{license_id:row.id,expected_generation:7});
});
