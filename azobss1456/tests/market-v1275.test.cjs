const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'AZOBSS-Market','index.html'),'utf8');

test('Market detail uses a large Carousell-style two-column layout',()=>{
  assert.match(html,/azobss-market-v1275/);
  assert.match(html,/width:min\(1180px,96vw\)/);
  assert.match(html,/grid-template-columns:minmax\(0,1\.48fr\) minmax\(330px,\.88fr\)/);
  assert.match(html,/az-market-detail-info/);
  assert.match(html,/object-fit:contain!important/);
});

test('Market share uses Software Tools style round controls and share sheet',()=>{
  assert.match(html,/function openMarketShareModal\(x\)/);
  assert.match(html,/class="az-market-share-icon wa"/);
  assert.match(html,/data-market-social="tg"/);
  assert.match(html,/data-market-social="fb"/);
  assert.match(html,/az-market-share-copy-btn/);
  assert.match(html,/function isMobileMarketShare\(\)/);
  assert.match(html,/navigator\.share\(data\)/);
  assert.match(html,/data-share-label="Share listing"/);
});

test('Admin card delete exists and requires explicit OK confirmation',()=>{
  assert.match(html,/data-market-delete=/);
  assert.match(html,/function deleteMarketListing\(id,x\)/);
  assert.match(html,/if\(!confirm\(`/);
  assert.match(html,/Press OK to permanently delete this listing/);
  assert.match(html,/deleteMarketListing\(x\.id,x\)/);
});
