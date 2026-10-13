const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const pkg=require(path.join(root,'package.json'));
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');

test('v1300 deploy-server does not call an undefined Express app',()=>{
  assert.ok(['1.0.1300','1.0.1302','1.0.1303','1.0.1304','1.0.1305','1.0.1306'].includes(pkg.version));
  assert.doesNotMatch(runtime,/^app\.(?:get|post|put|delete|patch)\(/m);
  assert.match(runtime,/async function handler\(req, res\)/);
  assert.match(runtime,/pathname === "\/api\/shopee-affiliate\/product-metadata" && req\.method === "POST"/);
  assert.match(runtime,/runtime:'deploy-server\.js',patch:1300/);
});
