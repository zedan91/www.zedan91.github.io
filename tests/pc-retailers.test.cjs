const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../assets/js/azobss-pc-retailers.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../PC-Build/pc-retailers.json'),'utf8'));

test('15 curated retailers have valid HTTPS source metadata and local catalog files',()=>{
 assert.equal(data.version,1430);assert.equal(data.stores.length,15);assert.equal(new Set(data.stores.map(s=>s.id)).size,15);
 for(const s of data.stores){
  assert.equal(api.validStore(s),true,s.name);
  assert.match(s.catalogFile,/^\.\/retailers\/[a-z0-9-]+\.json$/);
  assert.ok(Number(s.productCount)>=1,s.name);
  assert.ok(['active','quote'].includes(s.catalogStatus),s.name);
 }
});

test('store/category filters still intersect correctly',()=>{
 assert.equal(api.filter(data.stores,'all','ideal-tech').length,1);
 assert.equal(api.filter(data.stores,'workstation','sri-computers').length,0);
 assert.ok(api.filter(data.stores,'workstation').every(s=>s.categories.includes('workstation')));
});

test('malformed and mismatched retailer source destinations are rejected',()=>{
 const store=data.stores[0];
 for(const url of ['javascript:alert(1)','http://allithypermarket.com.my/','https://user:pass@allithypermarket.com.my/','https://allithypermarket.com.my.evil.test/'])assert.equal(api.validStore({...store,url}),false,url);
 assert.equal(api.validStore({...store,categories:['fake']}),false);
 assert.equal(api.validStore({...store,scope:'google.com'}),false);
});

test('main filter keyword represents PC-Build controls',()=>{
 const q=api.mainFilterKeyword({search:'AutoCAD',segment:'workstation',cpuBrand:'amd',resolution:'1440p',gpuBrand:'nvidia',gpuModel:'RTX 5070',category:'performance',budget:'7000'});
 for(const term of ['AutoCAD','workstation AI','AMD Ryzen','RTX 5070','1440p','creator performance','bawah RM7000'])assert.ok(q.includes(term),term);
});

test('build comparison keyword focuses on comparable CPU/GPU rather than retailer URL',()=>{
 const q=api.buildSearchKeyword({name:'AZOBSS Performance RTX',gpuModel:'RTX 5070',parts:[['CPU','AMD Ryzen 7 7700'],['RAM','32GB DDR5'],['Storage','1TB NVMe']]});
 assert.ok(q.includes('AMD Ryzen 7 7700'));
 assert.ok(q.includes('RTX 5070'));
 assert.ok(q.includes('32GB DDR5'));
 assert.doesNotMatch(q,/https?:\/\//);
});

test('main PC-Build keeps 15-store directory admin-only and loads v1430 internal integration',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../PC-Build/index.html'),'utf8');
 assert.match(main,/id="pc-retailer-panel"[^>]*data-public="0"[^>]*data-integrated="1"[^>]*hidden/);
 assert.match(main,/id="retailerStore"/);
 assert.match(main,/Semua sumber/);
 assert.match(main,/loadRetailerCatalogBuilds/);
 assert.match(main,/\.\/retailers\/index\.json\?v=1430/);
 assert.match(main,/azobss-pc-retailers\.js\?v=1430/);
 assert.match(main,/data-retailer-compare/);
 const builder=fs.readFileSync(path.join(__dirname,'../PC-Build/Build-Sendiri/index.html'),'utf8');
 assert.match(builder,/<details[^>]*id="pc-retailer-panel"[^>]*hidden/);
 assert.match(builder,/azobss-pc-retailers\.js\?v=1430/);
});
