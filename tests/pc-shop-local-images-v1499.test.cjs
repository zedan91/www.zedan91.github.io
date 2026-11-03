const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
test('v1499 local PC image manifest is complete and frontend resolver is wired',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'PC-Build/images/products/source-map-v1499.json'),'utf8'));
 assert.equal(m.expectedImages,64);assert.equal(m.images.length,64);assert.equal(new Set(m.images.map(x=>x.sourceUrl)).size,64);assert.equal(new Set(m.images.map(x=>x.filename)).size,64);
 for(const x of m.images){assert.match(x.localPath,/^\/PC-Build\/images\/products\//);assert.match(x.sourceUrl,/^https:\/\//)}
 const html=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');assert.match(html,/local-image-map-v1499\.js\?v=1499/);assert.match(html,/function applyLocalBuildImage\(b\)/);assert.match(html,/m\.byId/);assert.match(html,/m\.byUrl/);assert.match(html,/m\.byName/);assert.match(html,/m\.enforceLocal/);assert.match(html,/d\.builds\.map\(applyLocalBuildImage\)\.filter\(retailerPriceVerified\)/);assert.match(html,/map\.values\(\)\]\.map\(applyLocalBuildImage\)\.filter\(retailerPriceVerified\)/);
 const dl=fs.readFileSync(path.join(root,'tools/localize-pc-build-images-v1499.cjs'),'utf8');assert.match(dl,/All.*images downloaded/);assert.match(dl,/No deployment ZIP was created/);assert.match(dl,/imageMagic/);assert.match(dl,/enforceLocal:true/);const shop=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1487.js'),'utf8');assert.match(shop,/applyLocalProductImage/);assert.match(shop,/Gambar produk belum tersedia/);assert.doesNotMatch(shop,/Gambar produk sedang dimuat semula/);
});
