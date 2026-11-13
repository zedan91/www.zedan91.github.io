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
 seal('upgrade-source-pdf-v1564.enc',Buffer.from('%PDF-1.7 latest fixture'));
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
test('browser preflight reaches the outer CORS handler without an admin token or private data read',async()=>{
 const f=fixture();try{
  fs.rmSync(path.join(f.root,'lib'),{recursive:true,force:true});
  for(const route of ['source-prices','source-pricelist.pdf']){
   const handled=await f.api.handle({method:'OPTIONS',headers:{origin:'https://www.azobss.com','access-control-request-method':'GET','access-control-request-headers':'authorization'}},{},{pathname:'/api/admin/pc-shop/'+route,query:{scope:'upgrade'}});
   assert.equal(handled,false);assert.equal(f.response(),undefined);
  }
  assert.equal(f.reads(),0);
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'upgrade'}});assert.equal(f.response().status,403);
 }finally{f.close();}
});
test('authenticated audit preserves every option label, original cost, PDF page and source evidence',async()=>{
 const f=fixture();try{f.setAdmin(true);await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'upgrade'}});
  const r=f.response();assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.body.records[0].sourcePage,2);
  assert.deepEqual(r.body.records[0].options,[{label:'8GB',cost:259,expectedPrice:330},{label:'16GB',cost:500,expectedPrice:590}]);
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-pricelist.pdf'});assert.equal(f.response().type,'application/pdf');assert.equal(f.response().body.toString(),'%PDF-1.7 local fixture');
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-pricelist.pdf',query:{date:'2026-11-13'}});assert.equal(f.response().body.toString(),'%PDF-1.7 latest fixture');
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-pricelist.pdf',query:{date:'unknown'}});assert.equal(f.response().status,400);
  await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'pc'}});assert.equal(f.response().body.records[0].options[0].cost,259);assert.equal(f.response().body.records[0].sourceDate,'2026-11-05');
 }finally{f.close();}
});
test('wrong key or tampered encrypted data fail closed and never return plaintext costs',async()=>{
 const f=fixture();try{f.setAdmin(true);const p=path.join(f.root,'lib/data/upgrade-source-v1520.enc');const e=JSON.parse(fs.readFileSync(p));assert.throws(()=>openEnvelope(JSON.stringify(e),'wrong-secret'));e.tag=Buffer.alloc(16).toString('base64');fs.writeFileSync(p,JSON.stringify(e));await f.api.handle({method:'GET'},{},{pathname:'/api/admin/pc-shop/source-prices',query:{scope:'upgrade'}});assert.equal(f.response().status,503);assert.equal(JSON.stringify(f.response().body).includes('259'),false);}finally{f.close();}
});
function frontend(options={}){
 const listeners={},elements=[];let admin=false,requestCount=0,resolveRequest;
 const window={addEventListener:(name,fn)=>{listeners[name]=fn;},dispatchEvent:()=>{},isAdminViewer:()=>admin,azobssGetFirebaseAuthHeaders:options.headers|| (async()=>({Authorization:'Bearer local-fixture'})),azobssWaitForFirebaseAuthToken:options.waitForToken,sessionStorage:options.sessionStorage};
 const document={readyState:'complete',body:{},querySelectorAll:()=>elements,addEventListener:()=>{}};
 const context={window,document,location:{pathname:options.pathname||'/Upgrade-Parts/'},URL,Date,Number,Map,Set,Event,AbortController,setTimeout,clearTimeout,MutationObserver:class{observe(){}},fetch:async(...args)=>{requestCount++;if(options.fetch)return options.fetch(...args);return await new Promise(resolve=>{resolveRequest=resolve;});}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(source,'assets/js/azobss-source-prices-v1520.js'),'utf8'),context);
 return {app:window.AZOBSSSourcePrices,setAdmin:v=>{admin=v;},requests:()=>requestCount,resolve:records=>resolveRequest({ok:true,json:async()=>({ok:true,records})}),elements,event:name=>listeners[name]?.()};
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
test('a restored admin view waits for Firebase hydration before requesting protected prices',async()=>{
 let restore;const f=frontend({headers:async()=>({}),waitForToken:()=>new Promise(resolve=>{restore=resolve;})});f.setAdmin(true);f.app.refresh();await tick();assert.equal(f.requests(),0);assert.match(f.app.panel({id:'VNP-test',price:330}),/Memuatkan/);restore('local-restored-id-token');await tick();assert.equal(f.requests(),1);f.resolve([{id:'VNP-test',priceStatus:'snapshot',options:[{label:'Seunit',cost:259,expectedPrice:330}]}]);await tick();assert.match(f.app.panel({id:'VNP-test',price:330}),/RM259.00/);
});
test('auth-ready automatically recovers a login-race error without a manual retry click',async()=>{
 let ready=false;const f=frontend({headers:async()=>ready?{Authorization:'Bearer local-fixture'}:{}});f.setAdmin(true);f.app.refresh();await tick();assert.equal(f.requests(),0);assert.match(f.app.panel({id:'VNP-test',price:330}),/Sesi login admin belum tersedia/);ready=true;f.event('azobss:auth-state-ready');await tick();assert.equal(f.requests(),1);f.resolve([{id:'VNP-test',options:[{label:'Seunit',cost:259,expectedPrice:330}]}]);await tick();assert.match(f.app.panel({id:'VNP-test',price:330}),/RM259.00/);
});
test('expired tokens are refreshed once; server errors are not described as an unverified product price',async()=>{
 const refreshes=[];let attempts=0;const f=frontend({headers:async force=>{refreshes.push(force);return {Authorization:'Bearer local-fixture'};},fetch:async()=>{attempts++;return attempts===1?{ok:false,status:401}:{ok:false,status:503,json:async()=>({error:'source_price_decryption_failed'})};}});f.setAdmin(true);f.app.refresh();await tick();await tick();assert.deepEqual(refreshes,[false,true]);assert.equal(attempts,2);const html=f.app.panel({id:'VNP-test',price:330});assert.match(html,/masalah pemuatan data/);assert.doesNotMatch(html,/Harga asal belum dapat disahkan/);
});
test('the existing configured admin-key fallback is accepted without weakening server verification',async()=>{
 let seen;const f=frontend({headers:async()=>({}),sessionStorage:{getItem:key=>key==='azobssAdminApiKey'?'local-fixture-key':null},fetch:async(url,opts)=>{seen=opts.headers;return {ok:true,json:async()=>({ok:true,records:[]})};}});f.setAdmin(true);f.app.refresh();await tick();assert.equal(seen['x-admin-key'],'local-fixture-key');assert.equal(f.requests(),1);f.setAdmin(false);f.app.refresh();assert.equal(f.app.panel({id:'VNP-test',price:330}),'');
});
test('price source readiness reports decryptability without exposing original data or keys',()=>{
 const f=fixture();try{const status=f.api.status();assert.deepEqual(status,{ready:true,records:1,pdfReady:true});assert.doesNotMatch(JSON.stringify(status),/259|fixture-key|Private supplier/);}finally{f.close();}
});
test('PC Build independently loads component and complete-build source prices',async()=>{
 const scopes=[];const f=frontend({pathname:'/PC-Build/',fetch:async url=>{const scope=new URL(url).searchParams.get('scope');scopes.push(scope);return {ok:true,json:async()=>({ok:true,records:[{id:scope==='pc'?'part-fixture':'build-fixture',sourceName:'Fixture',priceStatus:'snapshot',options:[{label:'Seunit',cost:scope==='pc'?399:2000,expectedPrice:scope==='pc'?470:2300}]}]})};}});
 f.setAdmin(true);f.app.refresh();await tick();assert.deepEqual(scopes.sort(),['builds','pc']);assert.match(f.app.panel({id:'part-fixture',price:470}),/RM399.00/);assert.match(f.app.panel({id:'build-fixture',price:2300}),/RM2,000.00/);
});

test('unified pricelist variants show their selected source cost and original PDF through PC scope without mixing capacity labels',async()=>{
 const id='VNP-fixture--1',scopes=[];const f=frontend({pathname:'/PC-Build/',fetch:async url=>{const scope=new URL(url).searchParams.get('scope');scopes.push(scope);return {ok:true,json:async()=>({ok:true,records:scope==='pc'?[{id,sourceRecordId:'VNP-fixture',sourceName:'Viewnet pricelist',sourcePage:2,sourceLine:'Fixture original line',priceStatus:'snapshot',options:[{label:'32GB',cost:399,expectedPrice:470}]}]:[]})};}});
 f.setAdmin(true);f.app.refresh();await tick();const p={id,price:470,optionLabel:'32GB'};const html=f.app.panel(p);assert.match(html,/RM399.00/);assert.match(html,/Harga jual sepadan/);assert.match(html,/data-source-price-pdf="2"/);assert.match(html,/Fixture original line/);assert.doesNotMatch(html,/Semakan diperlukan/);assert.deepEqual(scopes.sort(),['builds','pc']);
 assert.match(f.app.panel({...p,optionLabel:'16GB'}),/Varian pricelist tidak sepadan/);f.setAdmin(false);assert.equal(f.app.panel(p),'');
});
