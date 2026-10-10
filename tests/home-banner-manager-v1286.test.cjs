const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1286 package version', () => {
  assert.ok(/^1\.0\.(1286|1287|1288|1289|1290|1291)$/.test(pkg.version));
});

test('admin banner editor no longer blocks homepage pointer interaction', () => {
  assert.match(html, /id="azobss-home-banner-drag-resize-fix-1286"/);
  assert.match(html, /\.az-home-banner-admin-modal\{[\s\S]*pointer-events:none!important/);
  assert.match(html, /\.az-home-banner-admin-panel\{[\s\S]*pointer-events:auto!important/);
  assert.match(html, /justify-content:flex-end!important/);
  assert.match(html, /background:transparent!important/);
});

test('drag and resize disable native browser drag and use active pointer handling', () => {
  assert.match(html, /el\.draggable=false/);
  assert.match(html, /img\.draggable=false/);
  assert.match(html, /addEventListener\('dragstart'/);
  assert.match(html, /state\.op=\{type:'move',id,pointerId:e\.pointerId/);
  assert.match(html, /state\.op=\{type:'resize',id:m\.id,pointerId:e\.pointerId/);
  assert.match(html, /document\.addEventListener\('pointermove',e=>\{if\(state\.op\)e\.preventDefault\(\);onPointerMove\(e\)\},\{passive:false\}\)/);
  assert.match(html, /touch-action:none!important/);
});

test('Administrator role is accepted by banner manager', () => {
  assert.match(html, /role==='admin'\|\|role==='administrator'/);
});
