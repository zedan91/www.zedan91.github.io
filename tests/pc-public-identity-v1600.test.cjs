const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('../assets/js/azobss-pc-model-v1537');
test('unidentified brands and product model codes group under Others',()=>{
 for(const brand of ['221V8LB','24G4','360','OFFICE','LAIN-LAIN','HEADSET','unlisted-brand',''])assert.equal(model.brand({brand,name:'Unidentified device'}),'Others',brand);
 assert.equal(model.brand({brand:'221V8LB',name:'221V8LB monitor'}),'Others');
});
test('explicit manufacturers and aliases remain separate from unclear brands',()=>{
 for(const [p,expected] of [[{brand:'24G4',name:'AOC 24G4 Gaming Monitor'},'AOC'],[{brand:'WD',name:'WD Blue SSD'},'WESTERN DIGITAL'],[{brand:'COOLERMASTER',name:'GPU Brace'},'COOLER MASTER'],[{brand:'INTEL',name:'Microsoft Surface Pro Intel Core i5'},'MICROSOFT'],[{brand:'ASUS',name:'RTX 5060 JOI Gaming PC Powered by ASUS'},'JOI'],[{brand:'Unknown',name:'Gaming desktop with ASUS motherboard'},'Others']])assert.equal(model.brand(p),expected,p.name);
});
test('share URLs have stable neutral IDs and retain exact variants',()=>{
 const p={id:'brightstar-v45591216652335'},url=model.productUrl(p),code=new URL(url,'https://www.azobss.com').searchParams.get('model');
 assert.match(code,/^azp-[a-f0-9]{16}$/);assert.doesNotMatch(url,/brightstar|section|45591216652335/);
 assert.equal(code,model.publicProductId(p));assert.equal(code,model.publicProductId(code));assert.ok(model.matchesProduct(p,code));
 assert.notEqual(model.publicProductId('VNP-fixture--0'),model.publicProductId('VNP-fixture--1'));
 assert.equal(model.matchesProduct({id:'VNP-fixture--1'},model.publicProductId('VNP-fixture--0')),false);
});
test('legacy model and source-record links still resolve alongside neutral links',()=>{
 const p={id:'VNP-fixture--0',sourceRecordId:'VNP-fixture'};
 for(const query of [p.id,p.sourceRecordId,model.publicProductId(p),model.publicProductId(p.sourceRecordId)])assert.ok(model.matchesProduct(p,query),query);
 assert.equal(model.matchesProduct(p,'unrelated'),false);assert.equal(model.matchesProduct(p,''),false);
});
test('neutral IDs do not collide across the current supplier and Viewnet catalogues',()=>{
 const seen=new Map();let count=0;
 for(const file of ['PC-Build/pc-shop-storefront-v1512.json','PC-Build/viewnet-storefront-v1526.json','lib/data/pc-shop-catalog-v1512.json']){
  const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
  for(const p of data.products||[]){for(const id of [p.productId,p.id,p.sourceRecordId].filter(Boolean)){
   const code=model.publicProductId(String(id));assert.ok(!seen.has(code)||seen.get(code)===String(id),id);seen.set(code,String(id));count++;
  }}
 }
 assert.ok(count>6000);
});
