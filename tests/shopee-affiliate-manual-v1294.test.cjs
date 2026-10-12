const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1294 exposes manual Shopee Get Link workflow without Open API', () => {
  assert.ok(['1.0.1294','1.0.1295','1.0.1296','1.0.1297','1.0.1298','1.0.1299','1.0.1300','1.0.1301'].includes(pkg.version));
  assert.match(html, /Paste Get Link → Auto Import — tak perlu App ID \/ Secret/);
  assert.match(html, /adminShopeeManualAffiliateLink/);
  assert.match(html, /adminShopeeUseManualLink/);
  assert.match(html, /Save &amp; Publish/);
  assert.match(html, /validateManualShopeeAffiliateLink/);
  assert.match(html, /Publish dibatalkan: link Shopee biasa/);
});

test('v1294 preserves future Open API automation', () => {
  assert.match(html, /\/api\/shopee-affiliate\/status/);
  assert.match(html, /\/api\/shopee-affiliate\/generate-link/);
  assert.match(html, /\/api\/shopee-affiliate\/product-offers/);
  assert.match(html, /Open API automation — aktif selepas Shopee approve/);
});
