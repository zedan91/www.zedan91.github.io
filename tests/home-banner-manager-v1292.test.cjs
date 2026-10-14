const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1292 package version', () => {
  assert.ok(/^1\.0\.(1292|1293|1294|1295|1296|1297|1298|1299|1300|1301|1302|1303|1304|1305|1306|1307|1308|1309|1310|1311|1312|1313|1314|1315|1316|1317|1318)$/.test(pkg.version));
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
