const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1351 gates Ebook Generator behind RM19 one-time lifetime account access',()=>{
  assert.ok(Number(JSON.parse(read('package.json')).version.split('.').pop())>=1351);
  const html=read('Software-Tools/index.html');
  const jsRef=html.match(/src=\"\/assets\/js\/(azobss-software-ebook-v\d+\.js)\?v=\d+\"/);
  assert.ok(jsRef,'current Ebook Generator JS ref missing');
  assert.match(html,/azobss-software-ebook-v1351\.css\?v=1351/);
  const js=read('assets/js/'+jsRef[1]);
  assert.match(js,/RM19/);
  assert.match(js,/api\/ebook-generator\/access-status/);
  assert.match(js,/api\/ebook-generator\/create-bill/);
  assert.match(js,/azobssWaitForFirebaseAuthToken/);
  assert.match(js,/azebookPaidContent1351/);
  assert.match(js,/Bayar sekali dan akses kekal/);
});

test('v1351 backend fixes price server-side and grants lifetime entitlement after verified payment',()=>{
  for(const file of ['deploy-server.js','backend/server.js']){
    const src=read(file);
    assert.match(src,/AZOBSS_EBOOK_GENERATOR_PRICE_SEN\s*=\s*1900/);
    assert.match(src,/ebookGeneratorAccess/);
    assert.match(src,/ebook-generator\/access-status/);
    assert.match(src,/ebook-generator\/create-bill/);
    assert.match(src,/lifetime:true/);
    assert.match(src,/accessGranted:true/);
  }
});
