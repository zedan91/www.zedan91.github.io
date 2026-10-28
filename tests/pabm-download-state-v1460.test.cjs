const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const section = (a,b) => source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function runtime(){
  const listeners={};
  const context={console, Map, Date, URL, setTimeout, clearTimeout, Promise, AZOBSS_PA_BM_MAX_DOWNLOADS:5,AZOBSS_PA_BM_VALID_MS:7*86400000,
    azobssIsPurchaseStatusPaid:()=>false,purchaseRecordMs:r=>r.createdAtMs||0,
    document:{readyState:'loading',addEventListener:(n,f)=>listeners[n]=f,querySelectorAll:()=>[],body:{classList:{toggle(){}}}},
    window:{addEventListener:(n,f)=>listeners[n]=f}};
  vm.createContext(context);
  vm.runInContext(section('function azobssIsPurchasePaidForDownload(','function azobssCanUncartPurchase(')
    +section('function azobssBuildPaidPurchaseDownloadUrl(','async function azobssLoadAdminPaBmPurchaseRecordsFromBackend(')
    +section('// AZOBSS v1460: one record-driven owner','// AZOBSS v1146: single DOM spinner'),context);
  return {context,listeners};
}
const row=(changes={})=>({id:'fixture-pa',productType:'PA',negeri:'Selangor',itemCode:'123',status:'paid',downloadCount:2,maxDownloads:5,paidAtMs:Date.now(),downloadExpiresAtMs:Date.now()+7*86400000,...changes});
for(const [name,changes,allowed,reason] of [
  ['7 days 2/5',{},true,''],['7 days 3/5',{downloadCount:3},true,''],['7 days 1/5',{downloadCount:1},true,''],
  ['3 days 1/5',{downloadExpiresAtMs:Date.now()+3*86400000,downloadCount:1},true,''],
  ['5/5',{downloadCount:5},false,'Had download telah digunakan'],['over quota',{downloadCount:6},false,'Had download telah digunakan'],
  ['0 days',{downloadExpiresAtMs:Date.now()-1},false,'Tamat'],['server expired',{downloadStatus:'expired'},false,'Tamat'],
  ['pending',{status:'pending',paidAtMs:0,createdAtMs:Date.now()},false,'Pending Payment'],
  ['pending with stale old paid timestamp',{status:'pending'},false,'Pending Payment'],
  ['file unavailable',{fileAvailable:false},false,'Fail tidak tersedia'],['access denied',{accessAllowed:false},false,'Fail tidak tersedia'],
  ['server revoked',{accessStatus:'revoked'},false,'Fail tidak tersedia']
])test('record eligibility: '+name,()=>{const {context:c}=runtime();const state=c.azobssPaBmDownloadButtonState(row(changes),'original');assert.equal(state.canDownload,allowed);assert.equal(state.reason,reason);});
test('stable identity is independent of mutable download count and serialized payload',()=>{
  const {context:c}=runtime(),r=row(),key=c.azobssPaBmDownloadRecordKey(r);
  c.window.__azobssPaBmActiveDownload={recordKey:key,format:'original',phase:'preparing'};
  assert.equal(c.azobssPaBmDownloadButtonState({...r,downloadCount:3},'original').busy,true);
  assert.equal(c.azobssPaBmDownloadButtonState({...r,id:'another'},'original').busy,false);
  assert.equal(c.azobssPaBmDownloadButtonState(r,'dxf').busy,false);
});
test('delayed release cannot clear a newer attempt',()=>{
  const {context:c}=runtime(),old={},current={};c.window.__azobssPaBmActiveDownload=current;
  assert.equal(c.azobssReleasePaBmDownloadUi(old),false);assert.equal(c.window.__azobssPaBmActiveDownload,current);
  assert.equal(c.azobssReleasePaBmDownloadUi(current),true);assert.equal(c.window.__azobssPaBmActiveDownload,null);
});
test('cooldown does not mutate DOM or quota and expires by timestamp',()=>{
  const {context:c}=runtime();c.azobssStartPaBmDownloadCooldown('id:1|dxf',3500);
  assert.equal(c.azobssPaBmDownloadCoolingDown('id:1|dxf'),true);
  assert.equal(c.azobssPaBmDownloadCoolingDown('id:1|original'),false);
  c.window.__azobssPaBmDownloadCooldowns['id:1|dxf']=Date.now()-1;
  assert.equal(c.azobssPaBmDownloadCoolingDown('id:1|dxf'),false);
});
test('combined historical runtime cannot install a download handler or owner',()=>{
  const legacy=fs.readFileSync(path.join(root,'assets/js/azobss-firebase-live-likes-sync.js'),'utf8');
  assert.doesNotMatch(legacy,/window\.azobssClientControlledDownload\s*=/);
  assert.doesNotMatch(legacy,/function azobssSetPaBmDownloadUiLock\(/);
  assert.doesNotMatch(legacy,/__azobssPaBmDownloadCaptureInstalled/);
});
test('PA/BM inline format helper delegates without a competing mutation observer',()=>{
  const html=fs.readFileSync(path.join(root,'PA-BM/index.html'),'utf8');
  const inline=html.match(/<script id="azobss-lot-format-two-button-v1154-script">([\s\S]*?)<\/script>/)[1];
  assert.match(inline,/window\.azobssSyncPaBmDownloadButtons\(\)/);
  assert.doesNotMatch(inline,/new MutationObserver|textContent\s*=|setAttribute\(/);
});
