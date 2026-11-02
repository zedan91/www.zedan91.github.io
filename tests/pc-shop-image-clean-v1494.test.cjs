const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1494 assigns retailer-aware clean crop profiles and penalizes promotional imagery',()=>{
  const runtime=read('lib/azobss-pc-shop-runtime.js');
  assert.match(runtime,/const RELEASE = '1494'/);
  assert.match(runtime,/cleanImageCropProfile/);
  assert.match(runtime,/product-clean-crop-strong/);
  assert.match(runtime,/pc-clean-crop-strong/);
  assert.match(runtime,/banner\|hero\|slider[\s\S]*score-=32/);
});

test('v1494 PC Build cards pass crop profile into dedicated fullscreen viewer',()=>{
  const html=read('PC-Build/index.html');
  const client=read('assets/js/azobss-pc-shop-v1487.js');
  const css=read('assets/css/azobss-pc-shop-v1487.css');
  assert.match(html,/azobssOpenPcProductImage\(publicBuildName\(b,false\),b\.image,b\.sourceName\|\|b\.storeName\|\|'sumber rasmi',b\.imageCrop\|\|'pc-focus'\)/);
  assert.match(client,/dedicatedImageViewer/);
  assert.match(client,/az-pc-image-lightbox/);
  assert.match(client,/stage\.classList\.toggle\('is-zoomed'\)/);
  assert.match(css,/width:min\(98vw,1600px\)/);
  assert.match(css,/is-zoomed img\{transform:scale\(1\.55\)!important/);
});

test('v1494 hardware product cards retain image click viewer with clean crop class support',()=>{
  const client=read('assets/js/azobss-pc-shop-v1487.js');
  const css=read('assets/css/azobss-pc-shop-v1487.css');
  assert.match(client,/data-shop-image/);
  assert.match(client,/p\.imageCrop\|\|'product-focus'/);
  assert.match(css,/product-clean-crop-strong/);
});
