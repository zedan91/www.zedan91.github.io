const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('v1496 web-enriched canonical JSON carries exact official images for DOTATECH and EMARQUE',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/catalog/v1496/web-enriched-current.json'),'utf8'));
  assert.equal(d.release,'1496');
  assert.ok(d.products.length>=60);
  const exact=d.products.filter(p=>p.dataLevel==='exact'&&/^https:\/\//.test(p.productUrl||'')&&/^https:\/\//.test(p.imageUrl||''));
  assert.ok(exact.length>=60);
  assert.ok(exact.some(p=>p.storeId==='dotatech'));
  assert.ok(exact.some(p=>p.storeId==='emarque'));
  assert.ok(exact.every(p=>!/^AZOBSS\b/i.test(p.name||'')));
});

test('v1496 bootstrap loads web-enriched data after legacy fallback and package version is aligned',()=>{
  const src=fs.readFileSync(path.join(root,'lib/azobss-retailer-json-catalog.js'),'utf8');
  assert.match(src,/web-enriched-current\.json/);
  assert.match(src,/if\(Array\.isArray\(web\?\.products\)\)products\.push/);
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'backend/package.json'),'utf8'));
  assert.equal(pkg.version,'1.0.1496');
});

test('PC Build frontend loads canonical JSON first and a live-sync failure does not erase it',()=>{
  const html=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');
  assert.match(html,/loadCanonicalRetailerJson\(\);setTimeout\(\(\)=>loadRetailerLiveBuilds\(\),350\)/);
  assert.doesNotMatch(html,/catch\(e\)\{console\.warn\('AZOBSS live retailer builds:',e\);DATA\.retailerBuilds=\[\];DATA\.builds=\[\]/);
});
