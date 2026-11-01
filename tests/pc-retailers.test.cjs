const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/retailers/index.json'),'utf8'));
const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
const main=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'PC-Build/Build-Sendiri/index.html'),'utf8');

test('retailer catalogs remain price-private while current candidates come from exact product mappings',()=>{
 assert.equal(String(manifest.version),'1485');assert.ok(manifest.catalogs.length>=1);
 assert.match(runtime,/const base=readJson\(buildFile,\{builds:\[\]\}\)/);
 assert.ok(runtime.includes('product|products'));
 assert.match(runtime,/sourceIdentityMatches/);assert.match(runtime,/availability==='available'/);
 assert.match(runtime,/mediaOk/);assert.match(runtime,/specOk/);
});

test('main PC-Build has one retailer data owner and fetches live builds from backend',()=>{
 assert.match(main,/const BUILD_API='https:\/\/azobss-backend\.onrender\.com\/api\/pc-shop\/builds'/);
 assert.match(main,/loadRetailerLiveBuilds/);
 assert.doesNotMatch(main,/azobss-pc-retailers\.js/);
 assert.doesNotMatch(builder,/azobss-pc-retailers\.js/);
});

test('public builder/catalog files contain no pricing secrets',()=>{
 for(const rel of ['PC-Build/pc-build-data.json','PC-Build/pc-custom-builder-data.json','PC-Build/pc-full-builder-fallback.json','PC-Build/pc-shop-products-v1485.json']){
  const text=fs.readFileSync(path.join(root,rel),'utf8');
  assert.doesNotMatch(text,/"(?:marketPrice|snapshotPrice|unitCost|markupRate|markupAmount|marketDelta|liveMarketDelta|cost|price)"\s*:/,rel);
 }
});

test('Build Sendiri is quote-only in browser and strips accidental pricing fields',()=>{
 assert.match(builder,/Minta Sebut Harga/);assert.match(builder,/function publicOption/);
 assert.doesNotMatch(builder,/function currentSell|function lineRetail|\[ADMIN DALAMAN\] Kos/);
});
