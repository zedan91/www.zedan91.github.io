const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../assets/js/azobss-pc-retailers.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../PC-Build/pc-retailers.json'),'utf8'));
test('all curated retailers have usable HTTPS destinations and matching search scopes',()=>{
 assert.equal(data.stores.length,15);assert.equal(new Set(data.stores.map(s=>s.id)).size,15);
 for(const s of data.stores)assert.equal(api.validStore(s),true,s.name);
 for(const id of ['all-it','ideal-tech','tmt','viewnet','pc-image','sri-computers','c-zone'])assert.ok(data.stores.some(s=>s.id===id));
});
test('store and category filters intersect; absent matches are not silently expanded',()=>{
 assert.equal(api.filter(data.stores,'all','ideal-tech').length,1);
 assert.equal(api.filter(data.stores,'workstation','sri-computers').length,0);
 assert.ok(api.filter(data.stores,'workstation').every(s=>s.categories.includes('workstation')));
 assert.equal(api.searchURL([], 'RTX 5070'),'');
});
test('combined searches remain a single encoded Google URL scoped to selected stores',()=>{
 const selected=api.filter(data.stores,'all','all-it');
 const url=new URL(api.searchURL(selected,'RTX 5070 & 32GB #"<>'));
 assert.equal(url.origin,'https://www.google.com');
 assert.equal(url.searchParams.get('q'),'(site:allithypermarket.com.my) RTX 5070 & 32GB #"<>');
 const query=new URL(api.searchURL(data.stores,'Ryzen 7')).searchParams.get('q');
 assert.ok(query.includes('site:idealtech.com.my'));assert.ok(query.includes('site:rextechpc.com.my'));
 assert.equal((query.match(/site:/g)||[]).length,15);
});
test('blank terms use the chosen category and long terms are bounded',()=>{
 assert.ok(new URL(api.searchURL(data.stores,'','laptop')).searchParams.get('q').endsWith(' laptop'));
 assert.ok(new URL(api.searchURL(data.stores,'x'.repeat(10000))).searchParams.get('q').endsWith('x'.repeat(160)));
});
test('malformed and mismatched outbound destinations cannot enter search results',()=>{
 const store=data.stores[0];
 for(const url of ['javascript:alert(1)','http://allithypermarket.com.my/','https://user:pass@allithypermarket.com.my/','https://allithypermarket.com.my.evil.test/'])assert.equal(api.validStore({...store,url}),false,url);
 assert.equal(api.validStore({...store,categories:['fake']}),false);
 assert.equal(api.validStore({...store,scope:'google.com'}),false);
});
test('main filter keyword is composed from the same PC-Build controls',()=>{
 const q=api.mainFilterKeyword({search:'AutoCAD',segment:'workstation',cpuBrand:'amd',resolution:'1440p',gpuBrand:'nvidia',gpuModel:'RTX 5070',category:'performance',budget:'7000'});
 for(const term of ['AutoCAD','workstation AI','AMD Ryzen','RTX 5070','1440p','creator performance','bawah RM7000'])assert.ok(q.includes(term),term);
});
test('build compare keyword carries useful CPU/GPU/RAM/storage details',()=>{
 const q=api.buildSearchKeyword({name:'AZOBSS Performance RTX',gpuModel:'RTX 5070',parts:[['CPU','AMD Ryzen 7 7700'],['RAM','32GB DDR5'],['Storage','1TB NVMe']],softwareFit:['AutoCAD 2026','Revit']});
 for(const term of ['AZOBSS Performance RTX','AMD Ryzen 7 7700','RTX 5070','32GB DDR5','1TB NVMe','AutoCAD 2026'])assert.ok(q.includes(term),term);
});
test('main PC-Build exposes public integrated 15-store search while Build-Sendiri keeps admin supplier panel',()=>{
 const main=fs.readFileSync(path.join(__dirname,'../PC-Build/index.html'),'utf8');
 assert.match(main,/id="pc-retailer-panel"[^>]*data-public="1"[^>]*data-integrated="1"/);
 assert.match(main,/id="retailerStore"/);
 assert.match(main,/data-retailer-compare/);
 assert.match(main,/azobss-pc-retailers\.js\?v=1428/);
 const builder=fs.readFileSync(path.join(__dirname,'../PC-Build/Build-Sendiri/index.html'),'utf8');
 assert.match(builder,/<details[^>]*id="pc-retailer-panel"[^>]*hidden/);
 assert.doesNotMatch(builder,/id="pc-retailer-panel"[^>]*data-public="1"/);
 assert.match(builder,/azobss-pc-retailers\.js\?v=1428/);
 assert.match(builder,/function isAdminViewer\(/);
});
