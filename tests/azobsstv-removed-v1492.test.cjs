const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('AZOBSSTV active app/backend/admin implementation is removed',()=>{
  assert.equal(fs.existsSync(path.join(root,'azobsstv-backend')),false);
  assert.equal(fs.existsSync(path.join(root,'admin','AZOBSSTV')),false);
  assert.equal(fs.existsSync(path.join(root,'AZOBSSTV','assets')),false);
  assert.equal(fs.existsSync(path.join(root,'AZOBSSTV','data')),false);
});

test('legacy public URL contains no streaming player and only retirement notice',()=>{
  const page=read('AZOBSSTV/index.html');
  assert.match(page,/Perkhidmatan media telah ditamatkan/i);
  assert.doesNotMatch(page,/<video\b|<audio\b|\.m3u8?|playlist|channel|epg/i);
});

test('More menu and admin navigation no longer expose AZOBSSTV',()=>{
  const more=read('assets/js/azobss-more-nav.js');
  const admin=read('admin/index.html');
  assert.doesNotMatch(more,/data-azobsstv-link|href\s*=\s*["']\/AZOBSSTV\//i);
  assert.doesNotMatch(admin,/\/admin\/AZOBSSTV\/|>[^<]*AZOBSSTV[^<]*</i);
});

test('legacy AZOBSSTV API is explicitly retired with 410',()=>{
  const server=read('deploy-server.js');
  assert.match(server,/pathname\.startsWith\("\/api\/azobsstv"\)/);
  assert.match(server,/service_retired/);
  assert.doesNotMatch(server,/createAZOBSSTVHandler|azobsstvApiHandler/);
});
