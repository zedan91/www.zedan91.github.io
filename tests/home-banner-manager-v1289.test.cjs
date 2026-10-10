const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1289 package version', () => {
  assert.equal(pkg.version, '1.0.1289');
});

test('desktop banner manager uses an in-flow non-overlapping dock', () => {
  assert.match(html, /id="azobss-home-banner-inline-dock-1289"/);
  assert.match(html, /\.az-home-banner-admin-modal\.az-banner-inline-dock-1289[\s\S]*position:relative!important/);
  assert.match(html, /\.az-home-banner-admin-modal\.az-banner-inline-dock-1289[\s\S]*pointer-events:auto!important/);
});

test('manager is physically moved directly after hero on desktop', () => {
  assert.match(html, /function placeEditorDock\(\)/);
  assert.match(html, /hero\.insertAdjacentElement\('afterend',modal\)/);
  assert.match(html, /modal\.classList\.add\('az-banner-inline-dock-1289'\)/);
  assert.match(html, /placeEditorDock\(\);state\.editorOpen=true/);
});

test('desktop panel side docking is bypassed when inline dock is active', () => {
  assert.match(html, /if\(modal\.classList\.contains\('az-banner-inline-dock-1289'\)\)\{modal\.classList\.remove\('az-banner-panel-left'\);return;\}/);
});

test('resize keeps editor dock placement synchronized', () => {
  assert.match(html, /window\.addEventListener\('resize',\(\)=>\{placeEditorDock\(\);renderAll\(\)/);
});
