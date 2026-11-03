const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
test('v1501 backend/server keeps exact Shopify product image from product JSON',()=>{
  const s=fs.readFileSync(path.join(ROOT,'backend','server.js'),'utf8');
  assert.match(s,/variant\?\.featured_image\?\.src/);
  assert.match(s,/product\?\.featured_image/);
  assert.match(s,/productTitle:[\s\S]{0,180}image,/);
});
test('v1501 local preparer discovers missing exact Shopify images by product id',()=>{
  const s=fs.readFileSync(path.join(ROOT,'tools','localize-pc-build-images-v1501.cjs'),'utf8');
  assert.match(s,/discoverMissingShopifyImages/);
  assert.match(s,/shopifyJsUrl/);
  assert.match(s,/ids:\[id\]/);
  assert.match(s,/featured_image/);
});
test('v1501 frontend loads the v1501 local image map',()=>{
  const s=fs.readFileSync(path.join(ROOT,'PC-Build','index.html'),'utf8');
  assert.match(s,/local-image-map-v1502\.js\?v=1504/);
});
