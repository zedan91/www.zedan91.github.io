const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../PC-Build');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'retailers/index.json'),'utf8'));
const sensitive=new Set(['price','marketPrice','snapshotPrice','cost','unitCost','markupRate','markupAmount','marketDelta','liveMarketDelta']);

test('v1485 retailer manifest keeps curated catalogs but stores no public source/selling price',()=>{
 assert.equal(String(manifest.version),'1485');assert.equal(manifest.catalogs.length,10);
 const ids=new Set(),productIds=new Set();let total=0,exact=0;
 for(const row of manifest.catalogs){
  assert.ok(!ids.has(row.id),row.id);ids.add(row.id);
  const file=path.join(root,row.file.replace(/^\.\//,''));assert.ok(fs.existsSync(file),row.file);
  const cat=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(cat.storeId,row.id);assert.equal(cat.products.length,row.count);assert.ok(cat.products.length>=1,row.id);
  for(const p of cat.products){
   assert.equal(p.origin,'retailer',p.id);assert.equal(p.storeId,row.id,p.id);assert.ok(Array.isArray(p.parts)&&p.parts.length,p.id);
   assert.ok(p.sourceName,p.id);assert.ok(!productIds.has(p.id),p.id);productIds.add(p.id);total++;
   for(const key of sensitive)assert.equal(Object.hasOwn(p,key),false,`${p.id} exposes ${key}`);
   if(p.sourceVerified&&p.availabilityVerified&&p.mediaVerified&&p.specVerified&&p.variantVerified)exact++;
  }
 }
 assert.equal(total,108);assert.equal(exact,1);
 assert.match(manifest.pricePolicy,/backend-live-only/i);
});

test('archived retailer snapshots stay non-pricing inputs while exact legacy DOTATECH metadata remains intact',()=>{
 const dot=JSON.parse(fs.readFileSync(path.join(root,'retailers/dotatech.json'),'utf8'));
 assert.equal(dot.products.length,1);const p=dot.products[0];
 assert.match(p.sourceUrl,/^https:\/\//);assert.match(p.image,/^https:\/\//);assert.ok(p.parts.length>=7);
 for(const key of sensitive)assert.equal(Object.hasOwn(p,key),false,`${p.id} exposes ${key}`);
});

test('public PC Builds use backend live verification and no static price fallback',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/\/api\/pc-shop\/builds/);
 assert.match(html,/priceStatus[^\n]{0,80}'live'/);
 assert.match(html,/availability[^\n]{0,80}'available'/);
 assert.doesNotMatch(html,/loadRetailerCatalogBuilds/);
 assert.doesNotMatch(html,/azobss-pc-retailers\.js/);
 assert.doesNotMatch(html,/marketPrice|snapshotPrice|markupRate/);
});
