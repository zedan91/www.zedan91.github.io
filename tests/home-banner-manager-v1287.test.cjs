const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1287 package version', () => {
  assert.ok(/^1\.0\.(1287|1288|1289|1290|1291|1292|1293|1294|1295|1296|1297|1298|1299|1300|1301|1302|1303|1304|1305|1306|1307|1308|1309|1310|1311|1312|1313|1314|1315|1316|1317|1318|1321|1322)$/.test(pkg.version));
});

test('managed banners are hidden until stored Firestore geometry is applied', () => {
  assert.match(html, /\.az-home-banner-layer:not\(\.az-banner-config-ready\) \.az-home-managed-banner\{[\s\S]*visibility:hidden!important/);
  assert.match(html, /function setBannerConfigReady\(\)/);
  assert.match(html, /layer\.classList\.add\('az-banner-config-ready'\)/);
});

test('cloud loader reveals banner only from finally after render', () => {
  assert.match(html, /async function loadCloud\(\)\{[\s\S]*finally\{[\s\S]*requestAnimationFrame\(\(\)=>requestAnimationFrame\(setBannerConfigReady\)\)/);
});
