'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {createSourcePriceAudit,deriveKey,openEnvelope}=require('../lib/azobss-source-price-audit');
const source=path.resolve(__dirname,'..');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-price-audit-'));
 const secret='local-test-only-source-price-key';let admin=false,response,reads=0;
 function seal(name,bytes){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',deriveKey(secret),iv);const data=Buffer.concat([cipher.update(bytes),cipher.final()]);fs.mkdirSync(path.join(root,'lib/data'),{recursive:true});fs.writeFileSync(path.join(root,'lib/data',name),JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));}
 seal('upgrade-source-v1520.enc',Buffer.from(JSON.stringify({source:'Private supplier',date:'2026-11-05',sourceSha256:'fixture',products:[{id:'VNP-test',category:'RAM',sourcePage:2,sourceLine:'model 8GB 259 / 16GB 500',options:[{label:'8GB',cost:259},{label:'16GB',cost:500}]}]})));
 seal('upgrade-source-pdf-v1520.enc',Buffer.from('%PDF-1.7 local fixture'));
 const api=createSourcePriceAudit({rootDir:root,env:{PC_SOURCE_PRICE_KEY:secret},getAdminIdentity:async()=>({isAdmin:admin}),getHardware:async()=>{reads++;return {internalProducts:[{id:'pc',sourcePrice:259,price:330,sourceName:'Fixture',priceStatus:'snapshot',snapshotCheckedAt:'2026-11-05'}]};},getBuilds:async()=>({internalBuilds:[]}),sellingPrice:cost=>({price:cost===259?330:590}),send:(res,status,body,type,headers)=>{response={status,body:type==='application/json'?JSON.parse(body):body,type,headers};}});
 return {root,api,seal,setAdmin:v=>{admin=v;},response:()=>response,reads:()=>reads,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('visitor, customer and staff cannot read source costs or original PDF; authentication runs before private file reads',async()=>{
 const f=fixture();try{
  fs.rmSync(path.join(f.root,'lib'),{recursive:true,force:true});
  for(const route of ['source-prices','source-pricelist.pdf']){await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/'+route,query:{scope:'upgrade'}});assert.equal(f.response().status,403);assert.deepEqual(f.response().body,{ok:false,error:'admin_required'});}
  assert.equal(f.reads(),0);
 }finally{f.close();}
});
test('authenticated audit preserves every option label, original cost, PDF page and source evidence',async()=>{
 const f=fixture();try{f.setAdmin(true);await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'upgrade'}});
  const r=f.response();assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.body.records[0].sourcePage,2);
  assert.deepEqual(r.body.records[0].options,[{label:'8GB',cost:259,expectedPrice:330},{label:'16GB',cost:500,expectedPrice:590}]);
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-pricelist.pdf'});assert.equal(f.response().type,'application/pdf');assert.equal(f.response().body.toString(),'%PDF-1.7 local fixture');
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'pc'}});assert.equal(f.response().body.records[0].options[0].cost,259);assert.equal(f.response().body.records[0].sourceDate,'2026-11-05');
 }finally{f.close();}
});
test('wrong key or tampered encrypted data fail closed and never return plaintext costs',async()=>{
 const f=fixture();try{f.setAdmin(true);const p=path.join(f.root,'lib/data/upgrade-source-v1520.enc');const e=JSON.parse(fs.readFileSync(p));assert.throws(()=>openEnvelope(JSON.stringify(e),'wrong-secret'));e.tag=Buffer.alloc(16).toString('base64');fs.writeFileSync(p,JSON.stringify(e));await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'upgrade'}});assert.equal(f.response().status,503);assert.equal(JSON.stringify(f.response().body).includes('259'),false);}finally{f.close();}
});
function frontend(){
 const listeners={},elements=[];let admin=false,requestCount=0,resolveRequest;
 const window={addEventListener:(name,fn)=>{listeners[name]=fn;},dispatchEvent:()=>{},isAdminViewer:()=>admin,azobssGetFirebaseAuthHeaders:async()=>({Authorization:'Bearer local-fixture'})};
 const document={readyState:'complete',body:{},querySelectorAll:()=>elements,addEventListener:()=>{}};
 const context={window,document,location:{pathname:'/Upgrade-Parts/'},URL,Date,Number,Map,Set,Event,AbortController,setTimeout,clearTimeout,MutationObserver:class{observe(){}},fetch:async()=>{requestCount++;return await new Promise(resolve=>{resolveRequest=resolve;});}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(source,'assets/js/azobss-source-prices-v1520.js'),'utf8'),context);
 return {app:window.AZOBSSSourcePrices,setAdmin:v=>{admin=v;},requests:()=>requestCount,resolve:records=>resolveRequest({ok:true,json:async()=>({ok:true,records})}),elements};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('admin sees recorded costs, markup and mismatch; snapshots never claim current supplier sync',async()=>{
 const f=frontend();const p={id:'VNP-test',options:[{label:'8GB',price:330}]};
 assert.equal(f.app.panel(p),'');assert.equal(f.requests(),0);f.setAdmin(true);f.app.refresh();await tick();assert.equal(f.requests(),1);
 f.resolve([{id:p.id,sourceName:'<supplier>',sourceDate:'2026-11-05',priceStatus:'snapshot',sourcePage:1,options:[{label:'8GB',cost:259,expectedPrice:330}]}]);await tick();
 let html=f.app.panel(p);assert.match(html,/RM259.00/);assert.match(html,/\+RM71.00/);assert.match(html,/Harga jual sepadan/);assert.match(html,/bukan sync automatik/);assert.match(html,/&lt;supplier&gt;/);
 html=f.app.panel({...p,options:[{label:'8GB',price:350}]});assert.match(html,/Harga jual tidak sepadan/);assert.match(html,/Perbezaan: RM20.00/);
 html=f.app.panel({...p,options:[{label:'16GB',price:330}]});assert.match(html,/Varian pricelist tidak sepadan/);assert.doesNotMatch(html,/RM259/);
 f.setAdmin(false);assert.equal(f.app.panel(p),'');
});
test('an admin response arriving after sign-out cannot repopulate privileged pricing',async()=>{
 const f=frontend();f.setAdmin(true);f.app.refresh();await tick();f.setAdmin(false);f.app.refresh();f.resolve([{id:'VNP-test',options:[{label:'8GB',cost:259,expectedPrice:330}]}]);await tick();assert.equal(f.app.panel({id:'VNP-test',options:[{label:'8GB',price:330}]}),'');
});
