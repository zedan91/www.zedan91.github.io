const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const runtime=fs.readFileSync(path.join(ROOT,'deploy-server.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'affiliate-shop','index.html'),'utf8');
test('v1296 uses the actual Render runtime for Shopee routes',()=>{ assert.ok(['1.0.1296','1.0.1297','1.0.1298','1.0.1299','1.0.1300','1.0.1302','1.0.1303','1.0.1304','1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311','1.0.1312'].includes(pkg.version)); assert.match(runtime,/pathname === "\/api\/shopee-affiliate\/product-metadata"/); assert.match(runtime,/runtime:'deploy-server\.js',patch:13(?:00|03|04|05|06|08)|patch:129(?:6|7|9)/); });
test('v1296 resolver supports short-link HTML redirects and ID recovery',()=>{ assert.match(runtime,/function azShopeeRedirectCandidate/); assert.match(runtime,/function azShopeeIdsFromText/); assert.match(runtime,/api\/v4\/pdp\/get_pc/); assert.match(runtime,/meta\\b/); });
test('v1296 keeps affiliate short link as Buy Now source',()=>{ assert.match(html,/link:check\.link/); assert.match(html,/Affiliate Buy Now dikekalkan/); });
