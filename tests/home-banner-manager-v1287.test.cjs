const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1287 package version', () => {
  assert.ok(/^1\.0\.(1287|1288|1289|1290|1291|1292)$/.test(pkg.version));
});

test('managed banners are hidden until stored Firestore geometry is applied', () => {
  assert.match(html, /\.az-home-banner-layer:not\(\.az-banner-config-ready\) \.az-home-managed-banner\{[\s\S]*visibility:hidden!important/);
  assert.match(html, /function setBannerConfigReady\(\)/);
  assert.match(html, /layer\.classList\.add\('az-banner-config-ready'\)/);
});

test('cloud loader reveals banner only from finally after render', () => {
  assert.match(html, /async function loadCloud\(\)\{[\s\S]*finally\{[\s\S]*requestAnimationFrame\(\(\)=>requestAnimationFrame\(setBannerConfigReady\)\)/);
});
