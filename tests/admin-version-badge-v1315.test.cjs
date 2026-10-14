const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const auth=fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('v1315 visible admin version badge follows current package',()=>{
  assert.ok(['1.0.1315','1.0.1316','1.0.1317'].includes(pkg.version));
  assert.match(auth,new RegExp(`VERSION_TEXT = 'v${pkg.version.split('.').pop()}'`));
  assert.doesNotMatch(auth,/VERSION_TEXT = 'v1307'/);
});

test('v1315 cache-busts the shared auth asset on primary pages',()=>{
  const v=pkg.version.split('.').pop();
  assert.match(admin,new RegExp(`azobss-global-auth\\.js\\?v=${v}`));
  assert.match(home,new RegExp(`azobss-global-auth\\.js\\?v=${v}`));
});
