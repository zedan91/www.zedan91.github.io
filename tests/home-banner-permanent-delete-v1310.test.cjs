const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1310 package version', () => assert.ok(['1.0.1310','1.0.1311'].includes(pkg.version)));

test('legacy Exabytes seed is deletable while system banners remain hide-only', () => {
  assert.match(html, /const BUILTIN_IDS=new Set\(\[SOFTWARE_ID,LUCKY_ID\]\)/);
  assert.match(html, /const DELETABLE_SEED_IDS=new Set\(\[DEFAULT_ID\]\)/);
  assert.match(html, /deleteBtn\.textContent=isBuiltIn\(m\)\?'Hide Banner':'Delete Banner'/);
});

test('deleted seed persists as a tombstone and is not recreated on reload', () => {
  assert.match(html, /deletedIds:new Set\(\)/);
  assert.match(html, /if\(data\.deleted===true\)\{state\.deletedIds\.add\(ds\.id\);state\.items\.delete\(ds\.id\);return;\}/);
  assert.match(html, /if\(state\.deletedIds\.has\(id\)\)\{state\.items\.delete\(id\);continue;\}/);
  assert.match(html, /\{deleted:true,enabled:false,deletedAt:serverTimestamp\(\),updatedAt:serverTimestamp\(\)\}/);
});

test('deleted legacy DOM banner is removed from homepage and dropdown', () => {
  assert.match(html, /if\(!state\.items\.has\(id\)\)el\.remove\(\)/);
  assert.match(html, /state\.items\.delete\(m\.id\);bannerEl\(m\.id\)\?\.remove\(\)/);
  assert.match(html, /Banner dipadam secara kekal dan dibuang daripada senarai\./);
});
