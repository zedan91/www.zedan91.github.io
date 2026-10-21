const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'Software-Tools','index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets','js','azobss-software-ebook-v1373.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets','css','azobss-software-ebook-v1373.css'),'utf8');

test('v1373 uses its own Publisher Lab visual/copy direction',()=>{
  for(const phrase of [
    'Ebook Prompt Architect','AZOBSS • PUBLISHER LAB','Asas Projek','Arah Penulisan','Skala Ebook',
    'Kawalan Ketepatan','Arahan AI Siap Guna','Hasilkan Arahan AI','Arkib Arahan','Bina Arahan'
  ]) assert.ok(js.includes(phrase),phrase);
  assert.ok(css.includes('azebook-architect-shell1373'));
  assert.ok(css.includes('azebook-output-deck1373'));
});

test('v1373 keeps the established prompt engine fields and PDF goal',()=>{
  for(const id of [
    'azebookTopic1345','azebookAuthor1345','azebookAudience1345','azebookTone1345','azebookLanguage1345',
    'azebookDesign1345','azebookMaxPages1345','azebookGoal1372','azebookProblem1372','azebookResearch1372',
    'azebookVisualDensity1372','azebookCTA1372','azebookDesignNotes1372'
  ]) assert.ok(js.includes(id),id);
  assert.ok(js.includes('SATU fail PDF yang kemas dan boleh dimuat turun'));
  assert.ok(js.includes('ONE polished PDF file ready to download'));
});

test('direct #ebook route receives fast boot and catalog purge',()=>{
  assert.ok(html.includes('azebook-direct-boot-1373'));
  assert.ok(html.includes("window.__AZOBSS_EBOOK_DIRECT=direct"));
  assert.ok(html.includes('azebook-direct-catalog-purge-1373'));
  assert.ok(html.includes("section.replaceChildren()"));
  assert.ok(html.includes("if(window.__AZOBSS_EBOOK_DIRECT)return"));
});

test('catalog-only inline patch scripts are bypassed on direct ebook boot',()=>{
  for(const marker of [
    'azobss-pagination-8-final-js','azobss-shop-cart-js','azobss-software-desc-inline-more-097-js',
    'azobss-software-more-real-overflow-only-fix-551-js'
  ]) assert.ok(html.includes(marker),marker);
  const guarded=(html.match(/if\(!window\.__AZOBSS_EBOOK_DIRECT\)\{/g)||[]).length;
  assert.ok(guarded>=20,`expected >=20 guarded catalog patches, got ${guarded}`);
  // Normal Software Tools still keeps its original external module references.
  assert.ok(html.includes('/assets/js/azobss-software-packages.js?v=1323'));
  assert.ok(html.includes('/assets/js/azobss-live-likes-only.js?v=1272'));
});

test('first interaction uses longer access cache and delayed background revalidation',()=>{
  assert.ok(js.includes('var ACCESS_CACHE_TTL=20*60*1000;'));
  assert.ok(js.includes("setTimeout(function(){checkLifetimeAccess(false,{background:true})},1800)"));
  assert.ok(!js.includes("    renderHistory();\n    updatePreview('');"));
});

test('Software Tools loads one combined ebook stylesheet and v1373 runtime',()=>{
  assert.ok(html.includes('/assets/css/azobss-software-ebook-v1373.css?v=1373'));
  assert.ok(!/<link[^>]+azobss-software-ebook-v1351\.css\?v=1351/.test(html));
  assert.ok(!/<link[^>]+azobss-software-ebook-v1372\.css\?v=1372/.test(html));
  assert.ok(html.includes('/assets/js/azobss-software-ebook-v1373.js?v=1373'));
});
