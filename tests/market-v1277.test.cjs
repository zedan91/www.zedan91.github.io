const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'AZOBSS-Market','index.html'),'utf8');

test('Market hero is extra slim and single-line on desktop',()=>{
  assert.match(html,/azobss-market-v1277/);
  assert.match(html,/padding:9px 16px!important/);
  assert.match(html,/font-size:clamp\(24px,2\.55vw,32px\)!important/);
  assert.match(html,/white-space:nowrap!important/);
  assert.match(html,/text-overflow:ellipsis!important/);
});

test('Marketplace image pipeline avoids Firefox synchronous canvas black output',()=>{
  assert.match(html,/function readFileDataUrl\(file\)/);
  assert.match(html,/if\(raw\.length<=targetChars\)return raw/);
  assert.match(html,/typeof createImageBitmap==='function'/);
  assert.match(html,/canvas\.toBlob\(/);
  assert.match(html,/getContext\('2d',\{alpha:true,willReadFrequently:true\}\)/);
  assert.doesNotMatch(html,/getContext\('2d',\{alpha:false\}\)/);
  assert.match(html,/MAX_IMAGE_CHARS=420000/);
  assert.match(html,/MAX_TOTAL_IMAGE_CHARS=820000/);
});

test('Transparent images render on neutral background instead of black',()=>{
  assert.match(html,/\.az-market-photo,\.az-market-detail-photo,\.az-market-edit-photo\{background:#e5e7eb!important\}/);
  assert.match(html,/\.az-market-photo img,\.az-market-detail-photo img,\.az-market-edit-photo img\{background:#fff!important\}/);
});
