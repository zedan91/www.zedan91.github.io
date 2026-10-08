const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

function allHtml(){
  const out=[];
  const walk=(dir)=>{ for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name); if(ent.isDirectory()) walk(p); else if(ent.name.endsWith('.html')) out.push(p);
  }}; walk(root); return out;
}

test('legacy combined auth+likes module is not loaded by any HTML page', () => {
  for(const file of allHtml()) assert.doesNotMatch(fs.readFileSync(file,'utf8'), /azobss-firebase-live-likes-sync\.js/, path.relative(root,file));
});

test('likes-only runtime contains no canonical auth/cart/purchase ownership assignments', () => {
  const src=read('assets/js/azobss-live-likes-only.js');
  for(const name of ['getSavedUser','hasSavedLogin','azobssRecordPurchase','azobssAddToPaBmCart','azobssRenderPurchaseRecords']){
    assert.doesNotMatch(src, new RegExp('window\\.'+name+'\\s*='), name);
  }
  assert.match(src, /__AZOBSS_LIKES_RUNTIME__\s*=\s*'likes-only-v1272'/);
});

test('PA-BM classic core remains canonical cart owner and storefront does not normally overwrite it', () => {
  const html=read('PA-BM/index.html');
  const sf=read('assets/js/azobss-pabm-storefront.js');
  assert.match(html, /__AZOBSS_PABM_CART_OWNER__='classic-core-v1273'/);
  assert.match(html, /azobssPaBmCartCore=.*version:1273/);
  assert.match(sf, /if \(!window\.azobssPaBmCartCore \|\| typeof window\.azobssPaBmCartCore\.add !== 'function'\)/);
  assert.match(sf, /__AZOBSS_PABM_CART_OWNER__ = 'classic-core-v1273'/);
});

test('Lot Kadaster map has one effective click owner', () => {
  const eb=read('assets/js/azobss-pabm-early-bridge.js');
  const sf=read('assets/js/azobss-pabm-storefront.js');
  assert.match(eb, /closest\('\[data-jupem-lot-map\]'\)/);
  assert.match(eb, /stopImmediatePropagation/);
  assert.doesNotMatch(sf, /const mapButton = event\.target\.closest\('\[data-jupem-lot-map\]'\)/);
});

test('Firebase Hosting excludes server, tests, audits and patch-history files', () => {
  const cfg=JSON.parse(read('firebase.json'));
  const ig=cfg.hosting.ignore || [];
  for(const required of ['deploy-server.js','backend/**','tests/**','AZOBSS-Developer-Files/**','README*.md','*-AUDIT-*.json']) assert.ok(ig.includes(required), required);
});


test('production HTML has no duplicate element ids', () => {
  for(const file of allHtml()){
    const rel=path.relative(root,file).replace(/\\/g,'/');
    if(rel === 'admin-preview-1189.html' || rel === '_badge-test.html') continue;
    const raw=fs.readFileSync(file,'utf8');
    // Ignore markup-like strings inside JS/CSS templates; only inspect actual HTML tags.
    const html=raw.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
    const counts=new Map();
    for(const match of html.matchAll(/\sid=["']([^"']+)["']/g)) counts.set(match[1],(counts.get(match[1])||0)+1);
    const dup=[...counts.entries()].filter(([,n])=>n>1);
    assert.deepEqual(dup,[], rel + ' duplicate ids: ' + JSON.stringify(dup));
  }
});
