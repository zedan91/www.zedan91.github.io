const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'Software-Tools','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets','css','azobss-software-ebook-v1374.css'),'utf8');

test('v1374 loads cache-busted compact Ebook stylesheet',()=>{
  assert.ok(html.includes('/assets/css/azobss-software-ebook-v1374.css?v=1374'));
});

test('v1374 keeps desktop workflow in a compact two-column form grid',()=>{
  assert.ok(css.includes('AZOBSS v1374 — Compact no-page-scroll desktop workspace'));
  assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
  assert.ok(css.includes('nth-of-type(1){grid-column:1;grid-row:1}'));
  assert.ok(css.includes('nth-of-type(2){grid-column:2;grid-row:1}'));
  assert.ok(css.includes('nth-of-type(3){grid-column:1;grid-row:2}'));
  assert.ok(css.includes('.azebook-buildbar1373{grid-column:2;grid-row:2;align-self:stretch}'));
});

test('v1374 compacts hero, controls and output without removing existing fields',()=>{
  for(const marker of [
    'grid-template-areas:"main flow" "tabs flow"',
    'min-height:40px',
    'min-height:42px',
    'min-height:45px',
    'height:calc(100vh - 342px)',
    'Extra-tight desktop mode'
  ]) assert.ok(css.includes(marker),marker);
});

test('v1374 keeps Pro precision controls accessible in dense desktop grid',()=>{
  assert.ok(css.includes('.azebook-stage1373.azebook-advanced1372'));
  assert.ok(css.includes('grid-template-columns:repeat(4,minmax(0,1fr))'));
  assert.ok(css.includes('textarea{\n    min-height:43px'));
});
