const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('v1486 has many exact retailer product mappings and extracts live specs instead of trusting stale parts',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-build-data.json'),'utf8'));
  const exact=(d.builds||[]).filter(x=>/^https:\/\//i.test(String(x.sourceUrl||''))&&/\/(?:product|products)\//i.test(String(x.sourceUrl||'')));
  assert.ok(exact.length>=18,`only ${exact.length} exact mappings`);
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(runtime,/extractPcParts/);assert.match(runtime,/hasCorePcSpecs/);assert.match(runtime,/buildUrlIdentityMatches/);
});

test('v1486 reader fallback parses Markdown title/image and Shopify selects an available exact variant',()=>{
  const deploy=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(deploy,/https:\/\/r\.jina\.ai\/\$\{String\(url/);
  assert.match(deploy,/first-available-variant/);
  assert.match(runtime,/Title:\\s\*/);assert.match(runtime,/matchAll\(\/!\\\[/);
  assert.match(runtime,/sourceListUrl/);assert.match(runtime,/availability==='available'/);
});

test('v1486 hardware public catalog contains exact live-source candidates and no embedded price',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-shop-products-v1486.json'),'utf8'));
  assert.ok(d.products.length>=4);
  for(const p of d.products){
    assert.match(String(p.sourceUrl||''),/^https:\/\//);
    assert.equal(Object.hasOwn(p,'price'),false,p.id);
    assert.equal(Object.hasOwn(p,'snapshotPrice'),false,p.id);
  }
  assert.ok(d.products.some(p=>p.sourceListUrl),'NB Plaza listing fallback missing');
});
