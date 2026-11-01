const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pkg=require(path.join(root,'package.json'));
const auth=fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('v1298 package exposes admin-only version badge',()=>{
  assert.ok(Number(String(pkg.version||'').split('.').pop()) >= 1298);
  assert.match(auth,/AZOBSS v1301: Administrator-only website version label, slightly larger and lower below navbar/);
  assert.match(auth,new RegExp(`VERSION_TEXT = 'v${pkg.version.split('.').pop()}'`));
  assert.match(auth,/body\.az-role-is-admin/);
  assert.match(auth,/body\[data-az-current-role="admin"\]/);
  assert.match(auth,/display:none/);
  assert.match(auth,/display:inline-flex/);
});

test('v1298 badge is small and positioned below navbar without taking layout space',()=>{
  assert.match(auth,/position:fixed/);
  assert.match(auth,/bottom\+7/);
  assert.match(auth,/font:600 12px/);
    assert.match(auth,/pointer-events:none/);
});

test('v1298 home forces fresh global auth asset',()=>{
  assert.match(home,new RegExp(`azobss-global-auth\\.js\\?v=${pkg.version.split('.').pop()}`));
});
