const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'AZOBSS-Market','index.html'),'utf8');

test('Market Buy & Sell hero is compact on desktop and mobile',()=>{
  assert.match(html,/azobss-market-v1276/);
  assert.match(html,/padding:16px 20px!important/);
  assert.match(html,/font-size:clamp\(27px,3\.15vw,40px\)!important/);
  assert.match(html,/font-size:13\.5px!important/);
  assert.match(html,/padding:11px 16px!important/);
  assert.match(html,/@media\(max-width:720px\)/);
});
