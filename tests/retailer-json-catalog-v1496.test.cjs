'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const os=require('os');
const {createRetailerCatalogService,extractSpecs,cleanStorePrefix}=require('../lib/azobss-retailer-json-catalog');

test('v1496 catalog keeps retailer name separate and extracts structured PC facts',()=>{
  assert.equal(cleanStorePrefix('DOTATECH FA-GAMING R5','DOTATECH'),'FA-GAMING R5');
  const s=extractSpecs('CPU: AMD Ryzen 5 5500\nGPU: RTX 5060 8GB\nMotherboard: A520M\nRAM: 16GB DDR4\nStorage: 500GB NVMe\nPSU: 600W Bronze\nCase: Tecware');
  assert.match(s.cpu,/Ryzen 5 5500/i);assert.match(s.gpu,/RTX 5060/i);assert.equal(s.motherboard,'A520M');
});

test('v1496 Shopify refresh produces exact product URL, image, variants and specs without generic image guessing',async()=>{
  const root=path.resolve(__dirname,'..');
  const calls=[];
  const fakeFetch=async url=>{
    calls.push(String(url));
    if(String(url).includes('dotatech.com.my/collections/pre-build-pc-package/products.json')){
      return {ok:true,json:async()=>({products:[{id:1,title:'DOTATECH Test Gaming PC',handle:'test-gaming-pc',vendor:'DOTATECH',product_type:'Gaming PC',body_html:'<p>CPU: AMD Ryzen 5 7500F</p><p>GPU: RTX 5070 12GB</p><p>RAM: 16GB DDR5</p>',images:[{src:'https://cdn.example.com/exact-pc.jpg'}],options:[{name:'GPU',values:['RTX 5070']}],variants:[{id:'v1',title:'RTX 5070',sku:'TEST-5070',price:'4999.00',available:true,options:['RTX 5070']}]}]}),text:async()=>'',headers:new Map()};
    }
    return {ok:true,json:async()=>({products:[]}),text:async()=>'<html></html>',headers:new Map()};
  };
  const out=path.join(os.tmpdir(),`azobss-cat-test-${Date.now()}.json`);
  const svc=createRetailerCatalogService({rootDir:root,fetchImpl:fakeFetch,outputFile:out,perStoreDir:out+'-stores'});
  const cat=await svc.refresh({force:true,storeIds:['dotatech'],persist:false});
  const p=cat.products.find(x=>x.storeId==='dotatech'&&x.dataLevel==='exact');
  assert.ok(p);assert.match(p.productUrl,/\/products\/test-gaming-pc$/);assert.equal(p.imageUrl,'https://cdn.example.com/exact-pc.jpg');assert.equal(p.variants[0].price,4999);assert.match(p.specs.cpu,/7500F/);assert.match(p.specs.gpu,/5070/);
});

test('v1496 public PC Build page consumes canonical retailer JSON in addition to old snapshot fallback',()=>{
  const html=fs.readFileSync(path.resolve(__dirname,'../PC-Build/index.html'),'utf8');
  const runtime=fs.readFileSync(path.resolve(__dirname,'../lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(html,/RETAILER_JSON_API=.*\/api\/pc-shop\/retailer-catalog/);
  assert.match(html,/canonicalBuildRows/);
  assert.match(runtime,/\/api\/pc-shop\/retailer-catalog/);
  assert.match(runtime,/\/api\/admin\/pc-shop\/retailer-catalog\/refresh/);
  assert.match(runtime,/imagePolicy:'local-locked'/);assert.match(runtime,/publicRetailerHotlink: false/);
});

test('v1496 raw catalog is not committed as a public static source-price database',()=>{
  assert.equal(fs.existsSync(path.resolve(__dirname,'../PC-Build/catalog/v1496/catalog.json')),false);
  const sources=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../PC-Build/catalog/v1496/sources.json'),'utf8'));
  assert.equal(sources.release,'1496');
  assert.equal(sources.policy.noAssumedImages,true);
});
