const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const desktop={manufacturer:'Micro-Star International Co., Ltd.',model:'MS-7D99 1.0',report:`AZOBSS CUSTOMER PC DIAGNOSTIC
RINGKASAN SPESIFIKASI
CPU                        : Intel Core i7-14700 2.10 GHz 20C / 28T
Motherboard Product        : PRO B760M-A WIFI DDR4 (MS-7D99)
Motherboard Version        : 1.0
`};
async function parser(){
 const fs=require('node:fs'),vm=require('node:vm');
 const code=fs.readFileSync(require.resolve('../backend/download-gateway/worker-v1534.mjs'),'utf8');
 return vm.runInNewContext('('+code.slice(code.indexOf('function diagnosticHardware1597('),code.indexOf('async function controlPcDiagnostics1590(')).trim()+')');
}
test('desktop card derives full motherboard model, revision and CPU from report without a model lookup',async()=>{
 const parse=await parser(),hardware=parse(desktop);
 assert.equal(hardware.deviceType,'Desktop');assert.equal(hardware.displayModel,'PRO B760M-A WIFI DDR4 (MS-7D99 1.0)');assert.equal(hardware.cpuSummary,'Intel Core i7-14700 2.10 GHz 20C / 28T');
 assert.equal(parse({...desktop,report:desktop.report.replace('(MS-7D99)','(MS-7D99 1.0)')}).displayModel,hardware.displayModel);
});
test('laptop card preserves detailed system model instead of substituting its internal motherboard',async()=>{
 const parse=await parser();const hardware=parse({...desktop,model:'GE66 Raider 10SFS REV:1.0',report:desktop.report+'\nDevice Type: Laptop'});
 assert.equal(hardware.deviceType,'Laptop');assert.equal(hardware.displayModel,'GE66 Raider 10SFS REV:1.0');
 assert.equal(parse({...desktop,model:'GE66 Raider 10SFS REV:1.0',report:'AZOBSS CUSTOMER PC DIAGNOSTIC'}).deviceType,'Laptop');
});
test('missing hardware is explicitly unknown and never expands MS board codes into invented model names',async()=>{
 const parse=await parser();const hardware=parse({model:'MS-7D99 1.0',report:'AZOBSS CUSTOMER PC DIAGNOSTIC'});
 assert.equal(hardware.deviceType,'Peranti');assert.equal(hardware.displayModel,'MS-7D99 1.0');assert.equal(hardware.cpuSummary,'');
 assert.equal(parse({model:'Default string',report:''}).displayModel,'');
});
test('legacy CPU section is parsed without confusing GPU or battery names with the processor',async()=>{
 const parse=await parser();const report=`AZOBSS CUSTOMER PC DIAGNOSTIC\n4. CPU\nCPU 1\nName : Intel(R) Core(TM) i7-14700\nCores / Logical : 20 / 28\nMaximum Clock : 2.10 GHz\n5. GPU / DISPLAY\nName : NVIDIA RTX 5060\n10. BATTERY\nName: BIF0_9`;
 assert.equal(parse({report}).cpuSummary,'Intel Core i7-14700 2.10 GHz 20C / 28T');
});
test('old battery absence alone does not mislabel an unknown device as desktop',async()=>{
 const parse=await parser();assert.equal(parse({model:'Unknown',batteries:[],report:''}).deviceType,'Peranti');
 assert.equal(parse({model:'ThinkPad T14 Gen 4',report:''}).deviceType,'Laptop');
 assert.equal(parse({model:'OptiPlex 7010',report:''}).deviceType,'Desktop');
 assert.equal(parse({model:'Example',report:'Device Type: Server'}).deviceType,'Server');
});
test('private legacy lists derive hardware without changing saved objects or exposing full report contents',async()=>{
 const {default:worker}=await import('../backend/download-gateway/worker-v1534.mjs'),id=crypto.randomUUID();
 const row={...desktop,id,serial:'TEST',batteries:[],receivedAt:'2026-11-18T00:00:00Z'};
 const key='__azobss_pc_diagnostics/'+id+'.json',body=JSON.stringify(row),summary={...row};delete summary.report;
 let writes=0;
 const env={AZOBSS_R2_TOKEN_SECRET:'fixture-secret',AZOBSS_FILES:{get:async k=>k===key?{json:async()=>JSON.parse(body)}:null,list:async()=>({objects:[{key,customMetadata:{summary:JSON.stringify(summary)}}],truncated:false}),put:async()=>{writes++;}}};
 const raw=JSON.stringify({action:'list',atMs:Date.now()}),signature=crypto.createHmac('sha256','fixture-secret').update('azobss-pc-diagnostics-v1590\n'+raw).digest('base64url');
 const response=await worker.fetch(new Request('https://fixture.example/pc-diagnostics-storage',{method:'POST',headers:{'x-azobss-diagnostic-signature':signature},body:raw}),env,{});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.reports[0].hardware.deviceType,'Desktop');assert.ok(result.reports[0].hardware.cpuSummary.includes('20C / 28T'));assert.equal(result.reports[0].report,undefined);assert.equal(writes,0);assert.equal(body,JSON.stringify(row));
});
test('CPU and full motherboard names participate in existing search and model sorting',()=>{
 const filters=require('../assets/js/azobss-pc-diagnostic-filters');
 const row={id:'a',manufacturer:'MSI',model:'MS-7D99',hardware:{displayModel:'PRO B760M-A WIFI DDR4',cpuSummary:'Intel Core i7-14700 20C / 28T'}};
 assert.equal(filters.select([row],{query:'14700 b760'}).length,1);
});
