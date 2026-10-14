const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pkg=require(path.join(root,'package.json'));
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const html=fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');

test('v1299 uses a backend-first Shopee affiliate landing resolver',()=>{
  assert.ok(['1.0.1299','1.0.1300','1.0.1302','1.0.1303','1.0.1304','1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311','1.0.1312','1.0.1313','1.0.1314'].includes(pkg.version));
  assert.match(runtime,/function azShopeeTrackingLanding/);
  assert.match(runtime,/origin_link/);
  assert.match(runtime,/const directLanding=azShopeeTrackingLanding\(affiliateUrl\)/);
  assert.match(runtime,/resolvedProductUrl/);
  assert.match(runtime,/priceAvailable/);
  assert.match(runtime,/patch:1300/);
});

test('v1299 recognizes official an_redir landing parameters but preserves the affiliate Buy Now URL',()=>{
  assert.match(runtime,/\['origin_link','originLink','origin_url','originUrl'/);
  assert.match(runtime,/const trackingLanding=azShopeeTrackingLanding\(current\)/);
  assert.match(backend,/function azShopeeTrackingLanding/);
  assert.match(html,/originLink:m\.(?:sourceUrl \|\| m\.)?productUrl \|\| ''/);
  assert.match(html,/link:check\.link/);
});

test('v1299 browser fallback starts from the decoded Shopee product landing when available',()=>{
  assert.match(runtime,/await page\.goto\(directLanding \|\| affiliateUrl/);
  assert.match(runtime,/const redirectedLanding=azShopeeTrackingLanding\(current\)/);
});

test('v1299 lets metadata import succeed without a price and reports the resolved product identity',()=>{
  assert.match(html,/(?:Harga tidak dipulangkan oleh Shopee|Medan optional belum ada)/);
  assert.match(html,/Produk dikesan: shop/);
  assert.match(runtime,/priceAvailable:!!String\(metadata\.priceLabel/);
});
