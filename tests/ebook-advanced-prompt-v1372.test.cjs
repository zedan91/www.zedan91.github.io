const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v1372 exposes refreshed Ebook Prompt Studio and Advanced controls',()=>{
  const html=read('Software-Tools/index.html');
  assert.match(html,/azobss-software-ebook-v1372\.css\?v=1372/);
  assert.match(html,/azobss-software-ebook-v1372\.js\?v=1372/);
  const js=read('assets/js/azobss-software-ebook-v1372.js');
  for(const marker of [
    'Ebook Prompt Studio','Bina Prompt Ebook Terbaik','Advanced Prompt Controls','BEST PROMPT',
    'azebookGoal1372','azebookProblem1372','azebookReaderLevel1372','azebookApproach1372',
    'azebookMustInclude1372','azebookAvoid1372','azebookResearch1372','azebookVisualDensity1372',
    'azebookCTA1372','azebookDesignNotes1372','advancedPromptSpec','researchInstruction',
    'hala_tuju_editorial_advanced','advanced_editorial_direction','standard_kualiti_tinggi','quality_bar'
  ]) assert.ok(js.includes(marker),`missing ${marker}`);
});

test('v1372 leaves lifetime/payments and historical base stylesheet intact',()=>{
  const html=read('Software-Tools/index.html');
  assert.match(html,/azobss-software-ebook-v1351\.css\?v=1351/);
  const js=read('assets/js/azobss-software-ebook-v1372.js');
  assert.match(js,/api\/ebook-generator\/access-status/);
  assert.match(js,/api\/ebook-generator\/create-bill/);
  assert.match(js,/EBOOK_PRICE='RM19'/);
});
