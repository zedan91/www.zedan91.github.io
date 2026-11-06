'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {loadViewnetProducts,publicViewnetProducts}=require('../lib/azobss-viewnet-catalog-v1526');
const {createPcShopRuntime}=require('../lib/azobss-pc-shop-runtime');
const {deriveKey}=require('../lib/azobss-source-price-audit');
const root=path.resolve(__dirname,'..');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'azobss-hub-1526-')),saved=new Map();let result;const calls=[];
 const write=(n,x)=>{const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x));};
 write('PC-Build/pc-shop-products-v1487.json',{products:[]});write('PC-Build/pc-build-data.json',{builds:[]});
 write('PC-Build/catalog/v1496/sources.json',{sources:[]});
 write('Upgrade-Parts/catalog-v1518.json',{date:new Date().toISOString().slice(0,10),products:[{id:'VNP-fixture',category:'RAM desktop',name:'Fixture DDR5 5600',imageKind:'illustration',options:[{label:'16GB',price:150},{label:'32GB',price:270}],specs:['Memory type: DDR5','Rated speed: 5600']} ,{id:'VNP-PROMO-i31388',category:'Office PC',name:'Fixture PC',imageKind:'illustration',options:[{label:'Configuration',price:1640}],specs:['CPU: Fixture']} ]});
 const collection=name=>({doc:id=>({key:name+'/'+id,async get(){const value=saved.get(this.key);return {exists:!!value,data:()=>value};},async set(value,{merge=false}={}){saved.set(this.key,merge?{...saved.get(this.key),...value}:value);}}),where(){return this;},orderBy(){return this;},limit(){return this;},async get(){return {forEach(){}};}});
 const db={collection,runTransaction:fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};
 const runtime=createPcShopRuntime({rootDir:dir,getDb:()=>db,getUserIdentity:async()=>({uid:'FIXTURE',email:'fixture@example.invalid'}),getAdminIdentity:async()=>null,readBody:async req=>req.body,send:(_res,status,body)=>result={status,body:JSON.parse(body)},pcBuildFetch:async url=>{calls.push(url);throw Error('Unexpected retailer request');}});
 return {dir,write,runtime,saved,calls,result:()=>result,close:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
test('all 1,619 pricelist options keep their IDs, exact selling prices and independent configurations in the shared catalogue',()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(root,'Upgrade-Parts/catalog-v1518.json'),'utf8')).products;
 const products=loadViewnetProducts({rootDir:root,env:{}}),pub=publicViewnetProducts(products);assert.equal(products.length,1619);assert.equal(new Set(products.map(p=>p.id)).size,1619);
 for(const row of raw)row.options.forEach((o,i)=>{const p=pub.find(p=>p.id===row.id+'--'+i);assert.ok(p,row.id);assert.equal(p.price,o.price);assert.equal(p.optionLabel,o.label);assert.equal(p.sourceRecordId,row.id);assert.equal(p.available,false);assert.equal(p.requiresConfirmation,true);for(const k of ['unitCost','sourcePrice','snapshotPrice','sourcePage','sourceLine'])assert.equal(Object.hasOwn(p,k),false);});
 for(const row of raw.filter(p=>['CPU Intel','CPU AMD'].includes(p.category))){assert.ok(row.specs.length>=6,row.name);assert.notEqual(row.imageKind,'illustration',row.name);assert.ok(fs.existsSync(path.join(root,row.shopImage)));}
});
test('sealed source costs are verified independently, stay private and cannot silently change an original selling price',()=>{
 const f=fixture();try{
  const secret='LOCAL-FIXTURE-ONLY',iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',deriveKey(secret),iv);
  const costs={products:[{id:'VNP-fixture',sourcePage:2,sourceLine:19,options:[{label:'16GB',cost:100},{label:'32GB',cost:200}]}]};
  const data=Buffer.concat([cipher.update(JSON.stringify(costs)),cipher.final()]);f.write('lib/data/upgrade-source-v1520.enc',{iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
  const p=loadViewnetProducts({rootDir:f.dir,env:{PC_SOURCE_PRICE_KEY:secret},sellingPrice:cost=>({price:cost===100?150:270})});assert.equal(p[0].snapshotPrice,100);assert.equal(p[1].sourcePage,2);assert.equal(p[1].sourceLine,19);
  assert.throws(()=>loadViewnetProducts({rootDir:f.dir,env:{PC_SOURCE_PRICE_KEY:secret},sellingPrice:()=>({price:1})}),/price_policy_mismatch/);
  assert.equal(loadViewnetProducts({rootDir:f.dir,env:{PC_SOURCE_PRICE_KEY:'WRONG'}})[0].snapshotPrice,0);
 }finally{f.close();}
});
test('pricelist variants checkout at trusted prices, never fetch an unrelated page, and require confirmation before an invoice',async()=>{
 const f=fixture();try{
  const c=await f.runtime.getLiveCatalog(false);assert.equal(c.publicProducts.length,3);
  await f.runtime.handle({method:'POST',body:{items:[{productId:'VNP-fixture--1',qty:2,unitPrice:1,sourcePrice:1}],shippingMethod:'Pickup at AZOBSS',customerName:'Fixture',customerPhone:'0100000000'}},{},{pathname:'/api/pc-shop/orders'});
  const r=f.result();assert.equal(r.status,201);assert.equal(r.body.order.items[0].unitPrice,270);assert.equal(r.body.order.referenceSubtotal,540);assert.equal(r.body.order.priceConfirmationRequired,true);assert.equal(r.body.order.invoiceIssued,false);assert.equal(r.body.order.status,'price-confirmation');assert.equal(f.calls.length,0);
 }finally{f.close();}
});
test('an unknown variant cannot create an order',async()=>{const f=fixture();try{await f.runtime.handle({method:'POST',body:{items:[{productId:'VNP-fixture--99',qty:1,unitPrice:1}],shippingMethod:'Pickup at AZOBSS',customerName:'Fixture',customerPhone:'0100000000'}},{},{pathname:'/api/pc-shop/orders'});assert.equal(f.result().status,400);assert.equal(f.result().body.error,'unknown_product');assert.equal(f.saved.size,0);}finally{f.close();}});
test('trusted sealed Viewnet costs below RM20 stay available to the admin audit while public prices and confirmation remain correct',async()=>{
 const f=fixture(),previous=process.env.PC_SOURCE_PRICE_KEY;try{
  const secret='LOCAL-LOW-COST-FIXTURE',iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',deriveKey(secret),iv);
  const raw={date:new Date().toISOString().slice(0,10),products:[{id:'VNP-fixture',category:'USB flash drive',name:'Fixture USB Drive',imageKind:'illustration',options:[{label:'16GB',price:40}],specs:['Connection: USB']}]};f.write('Upgrade-Parts/catalog-v1518.json',raw);
  const costs={products:[{id:'VNP-fixture',sourcePage:2,sourceLine:'Fixture low-cost record',options:[{label:'16GB',cost:10}]}]};const data=Buffer.concat([cipher.update(JSON.stringify(costs)),cipher.final()]);f.write('lib/data/upgrade-source-v1520.enc',{iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});process.env.PC_SOURCE_PRICE_KEY=secret;
  const c=await f.runtime.getLiveCatalog(false);assert.equal(c.internalProducts[0].sourcePrice,10);assert.equal(c.internalProducts[0].unitCost,10);assert.equal(c.publicProducts[0].price,40);assert.equal(c.publicProducts[0].requiresConfirmation,true);assert.equal(Object.hasOwn(c.publicProducts[0],'sourcePrice'),false);assert.equal(Object.hasOwn(c.publicProducts[0],'unitCost'),false);
 }finally{if(previous===undefined)delete process.env.PC_SOURCE_PRICE_KEY;else process.env.PC_SOURCE_PRICE_KEY=previous;f.close();}
});
test('legacy model links stay within the canonical hub and retain their model, search and filter state',()=>{
 const html=fs.readFileSync(path.join(root,'Upgrade-Parts/index.html'),'utf8');const code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('location.replace(next.href)'));
 const anchor={};let redirected='';const loc=new URL('https://www.azobss.com/Upgrade-Parts/?q=14100#VNP-fixture');loc.replace=u=>redirected=u;
 vm.runInNewContext(code,{URL,location:loc,document:{getElementById:()=>anchor}});const next=new URL(redirected);assert.equal(next.pathname,'/PC-Build/');assert.equal(next.searchParams.get('q'),'14100');assert.equal(next.searchParams.get('section'),'components');assert.equal(next.searchParams.get('catalog'),'pricelist');assert.equal(next.hash,'#VNP-fixture');assert.equal(anchor.href,next.href);
});
test('the four hub sections filter the same products and restore all brands/categories after leaving a pricelist model link',()=>{
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'all',innerHTML:'',textContent:'',listeners:{},classList:{add(){}},get options(){return [...this.innerHTML.matchAll(/<option value="([^"]+)"/g)].map(m=>({value:m[1]}));},addEventListener(k,fn){this.listeners[k]=fn;},insertAdjacentHTML(){},scrollIntoView(){}});return els.get(id);}
 const location=new URL('https://www.azobss.com/PC-Build/?section=components&catalog=pricelist&model=VNP-fixture');
 const context={URL,Date,Intl,location,history:{replaceState(_a,_b,url){location.href=String(url);}},document:{getElementById:el,querySelector:s=>el(s.replace(/^#/,'')),querySelectorAll:()=>[],addEventListener(){}},window:{location,addEventListener(){}}};
 el('azPcShopSearch').value='';el('azPcShopSort').value='recommended';vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/azobss-pc-storefront-v1512.js'),'utf8'),context);
 const p=(id,name,group,category)=>({id,name,type:group==='prebuilt'?'laptop':'hardware',catalogGroup:group,category,brand:'Fixture',price:100,image:'/photo.webp',specs:['Capacity: 16GB']});
 const rows=[{...p('VNP-fixture--0','Exact CPU','components','Intel CPUs'),sourceRecordId:'VNP-fixture'},p('ram','Memory','components','RAM'),{...p('keyboard','Keyboard','accessories','Keyboards'),sourceRecordId:'VNP-keyboard'},p('laptop','Laptop','prebuilt','Laptop')];
 const app=context.window.AZOBSSPcStorefront;app.render(rows,{});assert.match(el('azPcShopGrid').innerHTML,/Exact CPU/);assert.doesNotMatch(el('azPcShopGrid').innerHTML,/>Memory<|>Keyboard<|>Laptop</);
 location.href='https://www.azobss.com/PC-Build/?section=components&catalog=pricelist#VNP-keyboard';app.render(rows,{});assert.match(el('azPcShopGrid').innerHTML,/>Keyboard</);assert.doesNotMatch(el('azPcShopGrid').innerHTML,/Exact CPU/);assert.equal(location.searchParams.get('section'),'accessories');
 app.setHubGroup('accessories');assert.equal(location.searchParams.has('catalog'),false);assert.equal(location.searchParams.has('model'),false);assert.match(el('azPcShopGrid').innerHTML,/>Keyboard</);assert.doesNotMatch(el('azPcShopGrid').innerHTML,/Exact CPU/);assert.match(el('azPcShopCategory').innerHTML,/Keyboards/);assert.doesNotMatch(el('azPcShopCategory').innerHTML,/Intel CPUs/);
 app.setHubGroup('components');assert.match(el('azPcShopGrid').innerHTML,/Exact CPU/);assert.match(el('azPcShopGrid').innerHTML,/>Memory</);app.setHubGroup('prebuilt');assert.match(el('azPcShopGrid').innerHTML,/>Laptop</);app.setHubGroup('all');assert.match(el('azStoreResults').textContent,/4/);
});
