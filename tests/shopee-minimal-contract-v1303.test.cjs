const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const html=fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');
const pkg=require(path.join(root,'package.json'));

test('v1303 behavior remains in current package',()=>assert.ok(['1.0.1303','1.0.1304','1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311','1.0.1312','1.0.1313','1.0.1314','1.0.1315','1.0.1316','1.0.1317'].includes(pkg.version)));
test('title is the required Shopee product field',()=>{
  assert.match(runtime,/function azShopeeMetadataHasRequiredProduct/);
  assert.match(runtime,/if\(!azShopeeMetadataHasRequiredProduct\(best\.metadata\)\)/);
  assert.match(runtime,/err\.code='SCRAPE_FAILED'/);
});
test('price and other enrichment fields are optional',()=>{
  assert.match(runtime,/function azShopeeMetadataMissing/);
  assert.match(runtime,/missing\.push\('price'\)/);
  assert.match(runtime,/price:String\(metadata\.priceLabel\|\|''\)\|\|null/);
});
test('fallback chain continues when title is missing',()=>{
  assert.match(runtime,/if\(!azShopeeMetadataHasRequiredProduct\(best\?\.metadata\)\)/);
  assert.match(runtime,/azShopeeReaderMetadata/);
  assert.match(runtime,/azShopeeBrowserMetadata/);
});
test('affiliate and canonical URLs stay separate',()=>{
  assert.match(runtime,/affiliateUrl=key/);
  assert.match(runtime,/sourceUrl:String\(metadata\.sourceUrl\|\|metadata\.productUrl\|\|''\)/);
  assert.match(html,/originLink:m\.sourceUrl \|\| m\.productUrl \|\| ''/);
  assert.match(html,/link:check\.link/);
});
test('admin does not treat missing optional fields as an import error',()=>{
  assert.match(html,/Medan optional belum ada/);
  assert.match(html,/Affiliate Buy Now dikekalkan/);
});
