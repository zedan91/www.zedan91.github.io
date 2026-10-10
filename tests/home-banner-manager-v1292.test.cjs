const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1292 package version', () => {
  assert.equal(pkg.version, '1.0.1292');
});

test('drag and resize auto-save geometry on pointer release', () => {
  assert.match(html, /function persistGeometry\(m,\{auto=false\}=\{\}\)/);
  assert.match(html, /function onPointerUp\(\)\{if\(state\.op\)\{[\s\S]*persistGeometry\(m,\{auto:true\}\)/);
  assert.match(html, /await setDoc\(doc\(db,COLLECTION,m\.id\),payload,\{merge:true\}\)/);
});

test('saved geometry is read back and verified from Firestore', () => {
  assert.match(html, /const verify=await getDoc\(doc\(db,COLLECTION,m\.id\)\)/);
  assert.match(html, /geometryMatches\(verify\.data\(\),m\)/);
  assert.match(html, /DISIMPAN ✓/);
});

test('initial cloud read cannot overwrite a dirty selected banner', () => {
  assert.match(html, /const dirtyId=state\.dirty\?state\.selectedId:''/);
  assert.match(html, /if\(dirtyId&&ds\.id===dirtyId\)return/);
});
