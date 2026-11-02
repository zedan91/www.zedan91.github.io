const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../PC-Build');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'retailers/index.json'),'utf8'));

test('v1487 restores the broad retailer catalog but only keeps single clear numeric prices',()=>{
 assert.equal(String(manifest.version),'1487');assert.equal(manifest.catalogs.length,10);assert.equal(manifest.totalProducts,111);
 const ids=new Set(),productIds=new Set();let total=0;
 for(const row of manifest.catalogs){
  assert.ok(!ids.has(row.id),row.id);ids.add(row.id);
  const file=path.join(root,row.file.replace(/^\.\/retailers\//,'retailers/'));assert.ok(fs.existsSync(file),row.file);
  const cat=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(cat.storeId,row.id);assert.equal(cat.products.length,row.count);
  for(const p of cat.products){
   assert.equal(p.origin,'retailer',p.id);assert.equal(p.storeId,row.id,p.id);assert.ok(Array.isArray(p.parts)&&p.parts.length>=1,p.id);
   assert.ok(p.sourceName,p.id);assert.ok(!productIds.has(p.id),p.id);productIds.add(p.id);total++;
   assert.equal(p.quoteRequired,false,p.id);assert.equal(p.priceVerified,true,p.id);assert.equal(p.snapshotPriceClear,true,p.id);
   assert.ok(Number(p.price)>0,p.id);assert.equal(Number(p.priceMin),Number(p.priceMax),`${p.id} must not expose a price range`);
   if(p.image)assert.match(String(p.image),/^https:\/\//,`${p.id} must not use generic local PC art`);
  }
 }
 assert.equal(total,111);
 assert.match(manifest.pricePolicy,/single-clear-price-only/i);
});

test('the 10 ALL IT range-price records are removed from snapshot display and may return only through exact live pricing',()=>{
 const allit=JSON.parse(fs.readFileSync(path.join(root,'retailers/all-it.json'),'utf8'));
 assert.equal(allit.products.length,0);
 assert.match(String(manifest.pricePolicy),/10 range-price records removed/i);
 const runtime=fs.readFileSync(path.join(__dirname,'../lib/azobss-pc-shop-runtime.js'),'utf8');
 assert.match(runtime,/retailerBuildCandidates/);assert.match(runtime,/clearSnapshotBuilds/);
 assert.match(runtime,/priceStatus:'live'/);assert.match(runtime,/priceStatus:'snapshot'/);
});

test('public PC Builds keep clear-price snapshots when live sync fails, while confirmed OOS can still remove a match',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'../lib/azobss-pc-shop-runtime.js'),'utf8');
 assert.match(html,/\/api\/pc-shop\/builds/);
 assert.match(html,/status==='snapshot'/);assert.match(html,/snapshotPriceClear/);
 assert.match(runtime,/clearSnapshotBuilds/);assert.match(runtime,/availability==='unavailable'/);
 assert.match(runtime,/publicMap\.delete/);
 assert.doesNotMatch(html,/azobss-pc-retailers\.js/);
 assert.doesNotMatch(html,/Kos rujukan:|Markup \d+%/);
});
