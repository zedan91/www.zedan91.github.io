const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Software-Tools', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1293 package version', () => {
  assert.equal(pkg.version, '1.0.1293');
});

test('Software Tools no longer rebuilds static admin actions every 1.5 seconds', () => {
  assert.match(html, /AZOBSS v1293: idempotent admin controls/);
  assert.doesNotMatch(html, /azobssLongSessionInterval\(refreshAdminState,\s*1500\)/);
  assert.match(html, /azSoftwareAdminStateCheck1293/);
  assert.match(html, /azobssLongSessionInterval\(\(\)=>azSoftwareAdminStateCheck1293\(false\),\s*30000\)/);
});

test('static admin button sync is idempotent instead of remove-and-recreate', () => {
  const start = html.indexOf('AZOBSS v1293: idempotent admin controls');
  const end = html.indexOf("document.addEventListener('click'", start);
  const block = html.slice(start, end);
  assert.match(block, /if\(!wrap\)\{/);
  assert.match(block, /ensureBtn\(/);
  assert.doesNotMatch(block, /querySelectorAll\('\[data-software-static-edit-wrap\]'\)\.forEach\(el => el\.remove\(\)\)/);
});

test('admin observer no longer watches style and class attributes', () => {
  const start = html.indexOf('AZOBSS v1293: observe structural card changes only');
  const end = html.indexOf('window.azobssRestoreSoftwareAdminActions', start);
  const block = html.slice(start, end);
  assert.match(block, /observe\(root,\{childList:true,subtree:true\}\)/);
  assert.doesNotMatch(block, /attributeFilter:\['style','class'\]/);
});

test('mobile layout no longer polls every 1.2 seconds or watches whole document', () => {
  const start = html.indexOf('azobss-mobile-one-card-real-fix-js-153');
  const end = html.indexOf('azobss-gif-hover-preview-154', start);
  const block = html.slice(start, end);
  assert.doesNotMatch(block, /azobssLongSessionInterval\(forceOneCardRow,\s*1200\)/);
  assert.doesNotMatch(block, /observe\(document\.documentElement,\s*\{childList:true,\s*subtree:true\}\)/);
  assert.match(block, /azOneCardObserved1293/);
});
