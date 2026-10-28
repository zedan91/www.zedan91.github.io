const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../PC-Build');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'retailers/index.json'),'utf8'));

test('retailer manifest contains 15 individual JSON catalogs and 121 internal records',()=>{
 assert.equal(manifest.version,1430);assert.equal(manifest.catalogs.length,15);
 const ids=new Set(),productIds=new Set();let total=0,priced=0,quote=0;
 for(const row of manifest.catalogs){
  assert.ok(!ids.has(row.id),row.id);ids.add(row.id);
  const file=path.join(root,row.file.replace(/^\.\//,''));assert.ok(fs.existsSync(file),row.file);
  const cat=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(cat.storeId,row.id);assert.equal(cat.products.length,row.count);assert.ok(cat.products.length>=1,row.id);
  for(const p of cat.products){
   assert.equal(p.retailerSnapshot,true,p.id);assert.equal(p.origin,'retailer',p.id);assert.equal(p.storeId,row.id,p.id);
   assert.ok(Array.isArray(p.parts)&&p.parts.length,p.id);assert.ok(p.sourceName,p.id);assert.ok(p.sourceCheckedAt,p.id);
   assert.ok(!productIds.has(p.id),p.id);productIds.add(p.id);total++;
   if(p.quoteRequired){quote++;assert.ok(p.price==null||Number(p.price)<=0,p.id)}
   else{priced++;assert.ok(Number(p.price)>0,p.id)}
  }
 }
 assert.equal(total,121);assert.equal(priced,115);assert.equal(quote,6);
});

test('retailer directory metadata matches each catalog count/status',()=>{
 const dir=JSON.parse(fs.readFileSync(path.join(root,'pc-retailers.json'),'utf8'));
 const byId=new Map(manifest.catalogs.map(x=>[x.id,x]));
 assert.equal(dir.stores.length,15);
 for(const s of dir.stores){const m=byId.get(s.id);assert.ok(m,s.id);assert.equal(s.productCount,m.count);assert.equal(s.catalogStatus,m.catalogStatus);assert.equal(s.catalogFile,m.file)}
});

test('public PC cards use internal catalog and external source links are admin-only metadata',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/DATA=\{builds:\[\],azobssBuilds:\[\],retailerBuilds:\[\]\}/);
 assert.match(html,/retailerSnapshot/);
 assert.match(html,/Harga kedai/);
 assert.match(html,/Harga perlu semakan/);
 assert.match(html,/sourceAdmin=admin/);
 assert.doesNotMatch(html,/Cari produk ↗/);
});
