const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('v1485 has many exact retailer product mappings instead of one strict snapshot candidate',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-build-data.json'),'utf8'));
  const exact=(d.builds||[]).filter(x=>/^https:\/\//i.test(String(x.sourceUrl||''))&&/\/(?:product|products)\//i.test(String(x.sourceUrl||''))&&Array.isArray(x.parts)&&x.parts.length>=7);
  assert.ok(exact.length>=18,`only ${exact.length} exact mappings`);
  assert.ok(exact.every(x=>!/^azobss\b/i.test(String(x.sourceName||''))));
});

test('v1485 retries blocked retailer HTML through reader fallback without using snapshot prices',()=>{
  const deploy=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  assert.match(deploy,/https:\/\/r\.jina\.ai\/\$\{String\(url/);
  assert.match(runtime,/sourceIdentityMatches/);
  assert.match(runtime,/availability==='available'/);
  assert.match(runtime,/sourceImage/);
  assert.doesNotMatch(runtime,/verifiedSnapshotFresh\(.*true/);
});

test('v1485 hardware public catalog contains only exact live-source candidates and no embedded price',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/pc-shop-products-v1485.json'),'utf8'));
  assert.ok(d.products.length>=4);
  for(const p of d.products){
    assert.match(String(p.sourceUrl||''),/^https:\/\//);
    assert.equal(Object.hasOwn(p,'price'),false,p.id);
    assert.equal(Object.hasOwn(p,'snapshotPrice'),false,p.id);
  }
});
