const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1288 package version', () => {
  assert.ok(/^1\.0\.(1288|1289|1290)$/.test(pkg.version));
});

test('both existing right-side homepage banners are registered in the banner manager', () => {
  assert.match(html, /data-az-banner-id="builtin-software-promo"/);
  assert.match(html, /data-az-banner-id="builtin-lucky-draw"/);
  assert.match(html, /const SOFTWARE_ID='builtin-software-promo'/);
  assert.match(html, /const LUCKY_ID='builtin-lucky-draw'/);
  assert.match(html, /ensureBuiltinModels\(\)/);
});

test('right-side banners support the same geometry, drag and resize flow', () => {
  assert.match(html, /\.hero \.az-home-system-managed-banner\{[\s\S]*left:var\(--az-banner-x\)!important[\s\S]*width:var\(--az-banner-w\)!important/);
  assert.match(html, /function applySystemBanner\(m\)/);
  assert.match(html, /function bindExisting\(\)\{hero\?\.querySelectorAll\('\.az-home-managed-banner\[data-az-banner-id\]'/);
  assert.match(html, /state\.op=\{type:'move'/);
  assert.match(html, /state\.op=\{type:'resize'/);
});

test('admin panel moves away from a selected right-side banner', () => {
  assert.match(html, /\.az-home-banner-admin-modal\.az-banner-panel-left\{[\s\S]*justify-content:flex-start!important/);
  assert.match(html, /function updatePanelDock\(m\)/);
  assert.match(html, /modal\.classList\.toggle\('az-banner-panel-left',rightSide\)/);
});

test('software promo keeps automatic product content while allowing layout edits', () => {
  assert.match(html, /Software Promo kekal automatik/);
  assert.match(html, /fileInput\.disabled=auto;linkInput\.disabled=auto;newTabInput\.disabled=auto/);
  assert.match(html, /if\(!isSoftware\(m\)\)m\.targetUrl=/);
});

test('lucky draw remains editable for image and destination link', () => {
  assert.match(html, /imageUrl:'images\/lucky-draw-floating\.svg'/);
  assert.match(html, /targetUrl:'\/lucky-draw\/'/);
  assert.match(html, /if\(m\.id===LUCKY_ID\)[\s\S]*const img=el\.querySelector\('img'\)/);
});

test('right-side banners avoid first-load geometry flash', () => {
  assert.match(html, /\.hero:not\(\.az-system-banner-config-ready\) \.az-home-system-managed-banner\{[\s\S]*visibility:hidden!important/);
  assert.match(html, /hero\.classList\.add\('az-system-banner-config-ready'\)/);
});
