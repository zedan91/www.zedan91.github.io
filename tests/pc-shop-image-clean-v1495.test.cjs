const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1495 preserves complete image canvas and cleans retailer edge text server-side',()=>{
  const runtime=read('lib/azobss-pc-shop-runtime.js');
  const html=read('PC-Build/index.html');
  const css=read('assets/css/azobss-pc-shop-v1487.css');
  assert.match(runtime,/const RELEASE = '1502'/);
  assert.match(runtime,/retailerImageRedactionProfile/);
  assert.match(runtime,/redactRetailerTextOnly/);
  assert.match(runtime,/No resize, crop or content scaling/);
  assert.match(runtime,/X-AZOBSS-Image-Clean/);
  assert.match(html,/never crop product media/i);
  assert.doesNotMatch(css,/product-clean-crop img\{[^}]*object-fit:cover/);
  assert.doesNotMatch(css,/product-clean-crop-strong img\{[^}]*object-fit:cover/);
});

test('v1495 fullscreen viewer keeps full image and still supports click zoom',()=>{
  const client=read('assets/js/azobss-pc-shop-v1487.js');
  const css=read('assets/css/azobss-pc-shop-v1487.css');
  assert.match(client,/saiz penuh dikekalkan; teks\/harga retailer dibersihkan tanpa crop/);
  assert.match(client,/stage\.classList\.toggle\('is-zoomed'\)/);
  assert.match(css,/width:min\(98vw,1600px\)/);
  assert.match(css,/is-zoomed img\{transform:scale\(1\.55\)!important/);
});

test('v1495 keeps promo/banner rejection in exact image resolver',()=>{
  const runtime=read('lib/azobss-pc-shop-runtime.js');
  assert.match(runtime,/banner\|hero\|slider[\s\S]*score-=32/);
  assert.match(runtime,/strictExactImageIdentity: true/);
});
