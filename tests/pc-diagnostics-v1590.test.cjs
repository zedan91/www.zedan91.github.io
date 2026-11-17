const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {normalizeReport,dealerMessage,createDiagnosticStore} = require('../lib/azobss-pc-diagnostics');
const id = crypto.randomUUID();
const fixture = {id,report:'AZOBSS CUSTOMER PC DIAGNOSTIC\nCPU: test',manufacturer:'Example',model:'Laptop X 15',serial:'TEST123',batteries:[{name:'BIF0_9'}]};
test('PC report validates identifiers, size, plain text and battery metadata',()=>{
  const row = normalizeReport(fixture);
  assert.equal(row.batteries[0].name,'BIF0_9');
  for (const edit of [{id:'../private'},{report:'other'},{report:fixture.report+'\0'},{report:fixture.report+'X'.repeat(262144)}]) {
    assert.throws(()=>normalizeReport({...fixture,...edit}));
  }
  const dealer = dealerMessage(row);
  assert.equal(dealer,'Jenama: Example\nModel: Laptop X 15\nSerial Number: TEST123\nBattery Name: BIF0_9');
  assert.ok(!dealer.includes('CPU'));
});
test('PC report storage signs all requests and surfaces errors',async()=>{
  let last;
  const store = createDiagnosticStore({baseUrl:()=> 'https://private.example',secret:()=> 'test-secret',
    fetchImpl:async(url,request)=>{
      last={url,...request}; return {ok:true,status:200,json:async()=>({ok:true,id})};
    }});
  await store({action:'write',row:normalizeReport(fixture)});
  assert.equal(last.url,'https://private.example/pc-diagnostics-storage');
  const hash=crypto.createHmac('sha256','test-secret').update('azobss-pc-diagnostics-v1590\n'+last.body).digest('base64url');
  assert.equal(last.headers['x-azobss-diagnostic-signature'],hash);
});
test('Cloudflare PC report endpoint is authenticated, private and retry-idempotent',async()=>{
  const {default:worker}=await import('../backend/download-gateway/worker-v1534.mjs');
  const objects=new Map();
  const env={AZOBSS_R2_TOKEN_SECRET:'test-secret',AZOBSS_FILES:{
    get:async key=>objects.get(key) ? {json:async()=>JSON.parse(objects.get(key).body)} : null,
    head:async key=>objects.get(key)?.meta || null,
    put:async(key,body,options)=>{
      if(objects.has(key))return null;
      objects.set(key,{body,meta:{customMetadata:options.customMetadata}});
      return {};
    },
    list:async()=>({objects:[...objects].map(([key,value])=>({key,customMetadata:value.meta.customMetadata})),truncated:false})
  }};
  async function send(payload,signed=true) {
    const body=JSON.stringify({...payload,atMs:Date.now()});
    const signature=signed?crypto.createHmac('sha256','test-secret').update('azobss-pc-diagnostics-v1590\n'+body).digest('base64url'):'';
    return worker.fetch(new Request('https://gateway.example/pc-diagnostics-storage',{method:'POST',headers:{'x-azobss-diagnostic-signature':signature},body}),env,{});
  }
  assert.equal((await send({action:'write',row:fixture},false)).status,403);
  assert.equal((await send({action:'write',row:fixture})).status,200);
  assert.equal((await send({action:'write',row:fixture})).status,200);
  assert.equal(objects.size,1);
  assert.equal((await send({action:'write',row:{...fixture,model:'different'}})).status,409);
  const list=await (await send({action:'list'})).json();
  assert.equal(list.reports[0].id,id);
  assert.equal(list.reports[0].report,undefined);
  const data=await (await send({action:'read',id})).json();
  assert.equal(data.row.report,fixture.report);
});
