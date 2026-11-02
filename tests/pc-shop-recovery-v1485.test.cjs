const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('v1487 keeps exact live retailer mappings as an enhancement to the broad clear-price catalog',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-build-data.json'),'utf8'));
  const exact=(d.builds||[]).filter(x=>/^https:\/\//i.test(String(x.sourceUrl||''))&&/\/(?:product|products)\//i.test(String(x.sourceUrl||'')));
  assert.ok(exact.length>=18,`only ${exact.length} exact mappings`);
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(runtime,/extractPcParts/);assert.match(runtime,/hasCorePcSpecs/);assert.match(runtime,/buildUrlIdentityMatches/);
  assert.match(runtime,/clearSnapshotBuilds/);assert.match(runtime,/snapshotBuildPublic/);
});

test('v1487 reader fallback still parses Markdown title/image and Shopify can select an available exact variant',()=>{
  const deploy=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(deploy,/https:\/\/r\.jina\.ai\/\$\{String\(url/);
  assert.match(deploy,/first-available-variant/);
  assert.ok(runtime.includes('Title:\\s*'));assert.match(runtime,/matchAll\(\/!\\\[/);
  assert.match(runtime,/sourceListUrl/);assert.match(runtime,/availability==='available'/);
});

test('v1487 hardware candidates carry clear snapshot prices for display fallback but checkout remains live-only',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-shop-products-v1487.json'),'utf8'));
  assert.ok(d.products.length>=4);
  for(const p of d.products){
    assert.match(String(p.sourceUrl||''),/^https:\/\//);
    assert.ok(Number(p.snapshotPrice)>0,p.id);assert.equal(p.snapshotPriceClear,true,p.id);
  }
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(runtime,/product\.available !== true/);assert.match(runtime,/priceStatus \|\| ''\) !== 'live'/);
  assert.ok(d.products.some(p=>p.sourceListUrl),'NB Plaza listing fallback missing');
});
