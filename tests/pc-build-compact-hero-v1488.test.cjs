const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'PC-Build/index.html'),'utf8');
test('v1488 PC Build hero is compact and keeps important status/actions',()=>{
  assert.match(html,/\.hero\{padding:18px 0 12px\}/);
  assert.match(html,/\.hero h1\{font-size:clamp\(30px,4\.1vw,46px\)/);
  assert.match(html,/\.hero p\{max-width:1040px[^}]*font-size:13px/);
  assert.match(html,/\.status\{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px\}/);
  assert.match(html,/\.hero-build-btn\{height:36px/);
  assert.match(html,/Build Sendiri Lengkap/);
  assert.match(html,/Build dipaparkan:/);
  assert.doesNotMatch(html,/Kegagalan sync sementara tidak membuang pilihan/);
});
