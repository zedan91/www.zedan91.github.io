'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');
const {createPcShopRuntime}=require('../lib/azobss-pc-shop-runtime');
function fixture({available=true,ageDays=0}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'azobss-storefront-1512-'));const saved=new Map();const calls=[];
 function write(name,value){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof value==='string'?value:JSON.stringify(value));}
 write('PC-Build/pc-shop-products-v1487.json',{products:[]});write('PC-Build/pc-build-data.json',{builds:[]});write('PC-Build/catalog/v1496/sources.json',{sources:[]});
 const photo='/PC-Build/images/shop/'+'a'.repeat(24)+'.webp';write(photo.slice(1),'local fixture');
 const products=[['laptop','Laptop',1000],['desktop','Desktop PC',2000],['hardware','RAM',100]].map(([type,category,cost],index)=>({id:type,type,category,name:'ASUS Model '+type,variantId:String(101+index),sourceMatch:['ASUS Model '+type],sourceUrl:'https://www.dotatech.com.my/products/model-'+type+'?variant='+(101+index),sourceProvider:'shopify',importedCatalog:true,requiresSupplierConfirmation:true,localImageVerified:true,image:photo,sourceVerified:true,specVerified:true,mediaVerified:true,snapshotPrice:cost,snapshotPriceClear:true,snapshotCheckedAt:new Date(Date.now()-ageDays*86400000).toISOString(),specs:['Model: ASUS Model '+type]}));
 write('lib/data/pc-shop-catalog-v1512.json',{products});
 const collection=name=>({
  doc:id=>({key:name+'/'+id,async get(){const v=saved.get(this.key);return {exists:!!v,data:()=>v};},async set(v,{merge=false}={}){saved.set(this.key,merge?{...saved.get(this.key),...v}:v);},async delete(){saved.delete(this.key);}}),
  where(){return this;},orderBy(){return this;},limit(){return this;},async get(){return {forEach:fn=>{for(const [key,v] of saved)if(key.startsWith(name+'/'))fn({data:()=>v,id:key.split('/')[1]});}}}
 });
 const db={collection,runTransaction:fn=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o)})};let response;
 const runtime=createPcShopRuntime({rootDir:root,getDb:()=>db,getUserIdentity:async()=>({uid:'LOCAL-FIXTURE',email:'buyer@example.invalid'}),getAdminIdentity:async()=>null,readBody:async req=>req.body,
  send:(res,status,body)=>response={status,body:JSON.parse(body)},pcBuildReadShopify:async({sourceUrl})=>{calls.push(sourceUrl);const p=products.find(p=>p.sourceUrl===sourceUrl);return {price:p.snapshotPrice+200,available,productTitle:p.name,sourceText:p.name};}});
 return {root,write,runtime,products,calls,saved,response:()=>response,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('catalog browses laptop, desktop and hardware without scraping every imported SKU; markup stays server-side',async()=>{
 const f=fixture();try{const c=await f.runtime.getLiveCatalog(false);assert.equal(f.calls.length,0);assert.equal(c.publicProducts.length,3);assert.deepEqual(c.publicProducts.map(p=>p.price),[1250,2300,250]);for(const p of c.publicProducts){assert.match(p.image,/^\/PC-Build\/images\/shop\//);for(const key of ['unitCost','sourcePrice','snapshotPrice','markupRate','markupAmount'])assert.equal(Object.hasOwn(p,key),false);}}finally{f.close();}
});
test('checkout rechecks only selected exact variant and ignores client price; supplier confirmation prevents premature invoice',async()=>{
 const f=fixture();try{await f.runtime.getLiveCatalog(false);await f.runtime.handle({method:'POST',body:{items:[{productId:'laptop',qty:2,unitPrice:1}],shippingMethod:'Pickup at AZOBSS',customerName:'Fixture',customerPhone:'0100000000'}},{},{pathname:'/api/pc-shop/orders'});const r=f.response();assert.equal(r.status,201);assert.equal(f.calls.length,1);assert.match(f.calls[0],/variant=101$/);assert.equal(r.body.order.items[0].unitPrice,1450);assert.equal(r.body.order.referenceSubtotal,2900);assert.equal(r.body.order.priceConfirmationRequired,true);assert.equal(r.body.order.invoiceIssued,false);assert.equal(r.body.order.status,'price-confirmation');}finally{f.close();}
});
test('selected out-of-stock product cannot create an order even with a recent displayed snapshot',async()=>{
 const f=fixture({available:false});try{await f.runtime.handle({method:'POST',body:{items:[{productId:'laptop',qty:1}],shippingMethod:'Pickup at AZOBSS'}},{},{pathname:'/api/pc-shop/orders'});assert.equal(f.response().status,409);assert.equal(f.response().body.error,'product_unavailable');assert.equal(f.saved.size,0);}finally{f.close();}
});
test('expired imported snapshots are hidden instead of advertised as current stock',async()=>{
 const f=fixture({ageDays:15});try{assert.equal((await f.runtime.getLiveCatalog(false)).publicProducts.length,0);}finally{f.close();}
});
test('a deleted pinned Shopify variant fails instead of silently purchasing another variant',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../deploy-server.js'),'utf8');const start=source.indexOf('async function azobssPcBuildReadShopify(');const end=source.indexOf('\nasync function ',start+1);const code=source.slice(start,end);
 const sandbox={URL,azobssPcBuildFetch:async()=>({variants:[{id:999,title:'Wrong model',price:10000,available:true}]}),azobssPcBuildShopifyJsUrl:x=>x};vm.createContext(sandbox);vm.runInContext(code+';this.read=azobssPcBuildReadShopify;',sandbox);
 await assert.rejects(sandbox.read({sourceUrl:'https://www.dotatech.com.my/products/example?variant=101'}),/Selected Shopify variant is no longer available/);
});


test('an explicit missing-photo placeholder keeps the product browseable without allowing arbitrary images or changing checkout confirmation',async()=>{
 const f=fixture();try{
  const p=f.products[0];p.image='/assets/images/pc-product-unavailable.svg';p.photoUnavailable=true;p.mediaVerified=false;
  f.write('assets/images/pc-product-unavailable.svg','<svg/>');f.write('lib/data/pc-shop-catalog-v1512.json',{products:f.products});
  const c=await f.runtime.getLiveCatalog(false);const row=c.publicProducts.find(x=>x.id==='laptop');assert.ok(row);assert.equal(row.photoUnavailable,true);assert.equal(row.requiresConfirmation,true);assert.equal(row.price,1250);assert.equal(row.mediaVerified,false);
 }finally{f.close();}
 const g=fixture();try{g.products[0].image='/assets/images/unapproved.svg';g.products[0].photoUnavailable=true;g.write('assets/images/unapproved.svg','<svg/>');g.write('lib/data/pc-shop-catalog-v1512.json',{products:g.products});assert.equal((await g.runtime.getLiveCatalog(false)).publicProducts.some(x=>x.id==='laptop'),false);}finally{g.close();}
});
