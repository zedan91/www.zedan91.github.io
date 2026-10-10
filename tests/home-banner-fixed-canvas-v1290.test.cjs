const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('v1292 keeps a compact fixed desktop banner area and directly raises services', () => {
  assert.match(html, /id="azobss-home-banner-fixed-canvas-1292"/);
  assert.match(html, /--az-banner-canvas-h:330px/);
  assert.match(html, /height:var\(--az-banner-canvas-h\)!important/);
  assert.match(html, /const DESKTOP_BANNER_CANVAS_HEIGHT=330/);
  assert.match(html, /\.services-section#Software\{[\s\S]*margin-top:-48px!important[\s\S]*padding-top:18px!important/);
});

test('v1291 no longer computes hero height from banner y plus height', () => {
  const start = html.indexOf('function updateHeroHeight(){');
  const end = html.indexOf('function updateResizeHandle(){', start);
  assert.ok(start >= 0 && end > start);
  const fn = html.slice(start, end);
  assert.doesNotMatch(fn, /e\.y\+e\.height/);
  assert.match(fn, /DESKTOP_BANNER_CANVAS_HEIGHT/);
});

test('v1291 clamps banners inside fixed desktop canvas', () => {
  const start = html.indexOf('function effectiveDesktop(m){');
  const end = html.indexOf('function applyGeometry', start);
  assert.ok(start >= 0 && end > start);
  const fn = html.slice(start, end);
  assert.match(fn, /canvasH=DESKTOP_BANNER_CANVAS_HEIGHT/);
  assert.match(fn, /canvasH-h-8/);
  assert.match(html, /function clampFormModelToCanvas\(m\)/);
});
