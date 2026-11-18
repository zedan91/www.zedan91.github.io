const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
async function fixture(){
 const {default:worker}=await import('../backend/download-gateway/worker-v1534.mjs');
 const objects=new Map();let version=0,conflicts=0,failDelete=false;
 const env={AZOBSS_R2_TOKEN_SECRET:'fixture-secret',AZOBSS_FILES:{
  get:async key=>{const object=objects.get(key);return object?{etag:object.etag,json:async()=>JSON.parse(object.body)}:null;},
  head:async key=>objects.get(key)||null,
  put:async(key,body,options)=>{
   const old=objects.get(key),condition=options.onlyIf;
   if(condition instanceof Headers && condition.get('If-None-Match')==='*' && old)return null;
   if(condition?.etagMatches && condition.etagMatches!==old?.etag)return null;
   if(key.includes('_states/') && conflicts>0){conflicts--;return null;}
   const object={body,etag:String(++version),customMetadata:options.customMetadata};objects.set(key,object);return object;
  },
  delete:async key=>{if(failDelete)throw Error('R2 unavailable');objects.delete(key);},
  list:async({prefix})=>({objects:[...objects].filter(([key])=>key.startsWith(prefix)).map(([key,row])=>({key,customMetadata:row.customMetadata})),truncated:false})
 }};
 async function send(payload,signed=true){const body=JSON.stringify({...payload,atMs:Date.now()});const signature=signed?crypto.createHmac('sha256','fixture-secret').update('azobss-pc-diagnostics-v1590\n'+body).digest('base64url'):'';
 const res=await worker.fetch(new Request('https://fixture.example/pc-diagnostics-storage',{method:'POST',headers:{'x-azobss-diagnostic-signature':signature},body}),env,{});const raw=await res.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:res.status,...data};}
 const id=crypto.randomUUID(),row={id,report:'AZOBSS CUSTOMER PC DIAGNOSTIC\nSYNTHETIC ONLY',manufacturer:'Synthetic',model:'Example',serial:'TEST',batteries:[]};
 assert.equal((await send({action:'write',row})).status,200);
 return {id,row,send,objects,conflict:count=>{conflicts=count;},failDelete:value=>{failDelete=value;}};
}
test('old reports default to unsent; manual tick and untick persist across reads',async()=>{
 const f=await fixture();assert.equal((await f.send({action:'list'})).reports[0].status.sent,false);
 const tick=await f.send({action:'sent',id:f.id,sent:true});assert.equal(tick.status.manualRevision,1);assert.equal(tick.status.sent,true);
 const read=await f.send({action:'read',id:f.id});assert.equal(read.row.status.sent,true);
 const untick=await f.send({action:'sent',id:f.id,sent:false});assert.equal(untick.status.manualRevision,2);assert.equal(untick.status.sentAt,'');
});
test('verified send receipt is idempotent and a late receipt cannot override manual untick',async()=>{
 const f=await fixture(),event={action:'sent',id:f.id,sent:true,automatic:true,eventId:crypto.randomUUID(),manualRevision:0,phone:'60182491182'};
 const auto=await f.send(event);assert.equal(auto.status.source,'bridge');assert.equal(auto.status.dealerPhone,event.phone);
 assert.equal((await f.send(event)).status.sentAt,auto.status.sentAt);
 await f.send({action:'sent',id:f.id,sent:false});
 assert.equal((await f.send({...event,eventId:crypto.randomUUID()})).status.sent,false);
});
test('state uses conditional writes and retries contention without overwriting newer state',async()=>{
 const f=await fixture();f.conflict(2);assert.equal((await f.send({action:'sent',id:f.id,sent:true})).status.sent,true);
 f.conflict(6);assert.equal((await f.send({action:'sent',id:f.id,sent:false})).status,409);
 assert.equal((await f.send({action:'read',id:f.id})).row.status.sent,true);
});
test('bulk deletion removes TXT, hides reports and prevents upload retry resurrection',async()=>{
 const f=await fixture();const result=await f.send({action:'delete',ids:[f.id,f.id]});assert.deepEqual(result.deleted,[f.id]);
 assert.equal(f.objects.has('__azobss_pc_diagnostics/'+f.id+'.json'),false);
 assert.equal((await f.send({action:'list'})).reports.length,0);
 assert.equal((await f.send({action:'read',id:f.id})).status,410);
 assert.equal((await f.send({action:'write',row:f.row})).status,410);
 assert.equal((await f.send({action:'sent',id:f.id,sent:true})).status,404);
 assert.deepEqual((await f.send({action:'delete',ids:[f.id]})).deleted,[f.id]);
});
test('partial delete failure is reported and can retry without exposing deleted content',async()=>{
 const f=await fixture();f.failDelete(true);const first=await f.send({action:'delete',ids:[f.id]});assert.equal(first.failed.length,1);assert.equal(first.deleted.length,0);
 assert.equal((await f.send({action:'list'})).reports.length,0);
 f.failDelete(false);assert.deepEqual((await f.send({action:'delete',ids:[f.id]})).deleted,[f.id]);
});
test('mutation validation and gateway authorization reject malformed or unauthorized changes',async()=>{
 const f=await fixture();for(const payload of [{action:'delete',ids:[]},{action:'delete',ids:['../x']},{action:'delete',ids:Array(51).fill(f.id)},{action:'sent',id:f.id,sent:'yes'},{action:'sent',id:f.id,sent:true,automatic:true}])assert.equal((await f.send(payload)).status,400);
 assert.equal((await f.send({action:'delete',ids:[f.id]},false)).status,403);
});
