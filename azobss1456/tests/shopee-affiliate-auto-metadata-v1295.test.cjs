const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');
const server = fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1295 auto imports Shopee public product metadata after affiliate link paste', () => {
  assert.ok(['1.0.1295','1.0.1296','1.0.1297','1.0.1298','1.0.1299','1.0.1300','1.0.1302','1.0.1303','1.0.1304','1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311','1.0.1312','1.0.1313','1.0.1314','1.0.1315','1.0.1316','1.0.1317','1.0.1318','1.0.1321','1.0.1322','1.0.1323'].includes(pkg.version));
  assert.match(html,/\/api\/shopee-affiliate\/product-metadata/);
  assert.match(html,/importManualShopeeMetadata/);
  assert.match(html,/manualShopeeAutoTimer/);
  assert.match(html,/Reading Product/);
  assert.match(html,/Semak jika perlu, kemudian (?:hanya )?tekan Save & Publish/);
});

test('v1295 backend metadata importer is admin-only and Shopee-host restricted', () => {
  assert.match(server,/app\.post\('\/api\/shopee-affiliate\/product-metadata', requireAdmin/);
  assert.match(server,/function azShopeePublicHost/);
  assert.match(server,/Redirect keluar daripada domain Shopee telah disekat/);
  assert.match(server,/api\/v4\/item\/get/);
  assert.match(server,/azFindProductJsonLd/);
});

test('v1295 preserves affiliate link as final Buy Now URL', () => {
  assert.match(html,/link:check\.link, buttonText:'Buy Now'/);
  assert.match(html,/originLink:m\.(?:sourceUrl \|\| m\.)?productUrl \|\| ''/);
});
