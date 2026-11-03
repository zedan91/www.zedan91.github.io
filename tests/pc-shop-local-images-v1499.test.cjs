const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
test('v1502 local PC image manifest is complete and frontend resolver is wired',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/images/products/source-map-v1502.json'),'utf8'));
 assert.ok(m.expectedImages>=64);assert.equal(m.images.length,m.expectedImages);assert.equal(new Set(m.images.map(x=>x.sourceUrl)).size,m.images.length);assert.equal(new Set(m.images.map(x=>x.filename)).size,m.images.length);
 for(const x of m.images){assert.match(x.localPath,/^\/PC-Build\/images\/products\//);assert.match(x.sourceUrl,/^https:\/\//)}
 const html=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');assert.match(html,/local-image-map-v1502\.js\?v=1502/);assert.match(html,/function applyLocalBuildImage\(b\)/);assert.match(html,/m\.byId/);assert.match(html,/m\.byUrl/);assert.match(html,/m\.byName/);assert.match(html,/m\.enforceLocal/);assert.match(html,/d\.builds\.map\(applyLocalBuildImage\)\.filter\(retailerPriceVerified\)/);assert.match(html,/map\.values\(\)\]\.map\(applyLocalBuildImage\)\.filter\(retailerPriceVerified\)/);
 const dl=fs.readFileSync(path.join(root,'tools/localize-pc-build-images-v1502.cjs'),'utf8');assert.match(dl,/PARTIAL SUCCESS IS ALLOWED/);assert.match(dl,/deployment ZIP will still be created/);assert.match(dl,/imageMagic/);assert.match(dl,/enforceLocal:true/);const shop=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1487.js'),'utf8');assert.match(shop,/applyLocalProductImage/);assert.match(shop,/Gambar produk belum tersedia/);assert.doesNotMatch(shop,/Gambar produk sedang dimuat semula/);
});
