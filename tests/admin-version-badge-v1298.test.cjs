const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pkg=require(path.join(root,'package.json'));
const auth=fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('v1298 package exposes admin-only version badge',()=>{
  assert.equal(pkg.version,'1.0.1298');
  assert.match(auth,/AZOBSS v1298: Administrator-only small website version label below navbar/);
  assert.match(auth,/VERSION_TEXT = 'v1298'/);
  assert.match(auth,/body\.az-role-is-admin/);
  assert.match(auth,/body\[data-az-current-role="admin"\]/);
  assert.match(auth,/display:none/);
  assert.match(auth,/display:inline-flex/);
});

test('v1298 badge is small and positioned below navbar without taking layout space',()=>{
  assert.match(auth,/position:fixed/);
  assert.match(auth,/font:600 10px/);
  assert.match(auth,/bottom\+4/);
  assert.match(auth,/pointer-events:none/);
});

test('v1298 home forces fresh global auth asset',()=>{
  assert.match(home,/azobss-global-auth\.js\?v=1298/);
});
