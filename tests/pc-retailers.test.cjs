const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/retailers/index.json'),'utf8'));
const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
const main=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'PC-Build/Build-Sendiri/index.html'),'utf8');

test('retailer catalog keeps 111 clear-price choices and uses exact live mappings only as enhancement',()=>{
 assert.equal(String(manifest.version),'1487');assert.equal(manifest.totalProducts,111);
 assert.match(runtime,/clearSnapshotBuilds/);assert.match(runtime,/retailerBuildCandidates/);
 assert.match(runtime,/snapshotBuildPublic/);assert.match(runtime,/matchSnapshotBuild/);
 assert.match(runtime,/confirmed OOS|availability==='unavailable'/i);
});

test('main PC-Build has one retailer data owner and fetches combined clear-price/live builds from backend',()=>{
 assert.match(main,/const BUILD_API='https:\/\/azobss-backend\.onrender\.com\/api\/pc-shop\/builds'/);
 assert.match(main,/loadRetailerLiveBuilds/);
 assert.match(main,/harga sumber jelas/i);
 assert.doesNotMatch(main,/azobss-pc-retailers\.js/);
 assert.doesNotMatch(builder,/azobss-pc-retailers\.js/);
});

test('public builder files remain quote-only and sensitive markup is not rendered into PC Build HTML',()=>{
 assert.match(builder,/Minta Sebut Harga/);assert.match(builder,/function publicOption/);
 assert.doesNotMatch(builder,/function currentSell|function lineRetail|\[ADMIN DALAMAN\] Kos/);
 assert.doesNotMatch(main,/Kos rujukan:|markupRate|markupAmount/);
});
