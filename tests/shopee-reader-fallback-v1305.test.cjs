const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const html=fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1305 package',()=>assert.ok(['1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311'].includes(pkg.version)));
test('Reader fallback is public-URL-only and optional',()=>{
  assert.match(runtime,/AZOBSS_SHOPEE_READER_ENDPOINT/);
  assert.match(runtime,/AZOBSS_SHOPEE_READER_ENABLED/);
  assert.match(runtime,/async function azShopeeReaderMetadata/);
  assert.match(runtime,/const firstTarget=azShopeeUrl\(affiliateUrl\)/);
  assert.doesNotMatch(runtime,/azShopeeReaderMetadata[\s\S]{0,5000}(?:Cookie|cookie|credentials:\s*['\"]include['\"])/);
});
test('Reader is tried after native HTTP and before local Chromium',()=>{
  const pos=runtime.indexOf('async function azShopeeResolveMetadataAuto');
  const chunk=runtime.slice(pos,pos+9000);
  const http=chunk.indexOf('azShopeeResolveHttpMetadata');
  const reader=chunk.indexOf('azShopeeReaderMetadata');
  const browser=chunk.indexOf('azShopeeBrowserMetadata');
  assert.ok(http>=0&&reader>http&&browser>reader,{http,reader,browser});
});
test('Reader result can satisfy minimal title contract without price',()=>{
  assert.match(runtime,/jina-reader-canonical/);
  assert.match(runtime,/if\(!azShopeeMetadataHasRequiredProduct\(best\?\.metadata\)\)/);
  assert.match(runtime,/priceLabel:''/);
});
test('Express fallback mirrors Reader support and diagnostics',()=>{
  assert.match(backend,/azShopeeReaderMetadata\((?:affiliateUrl|readerTarget)/);
  assert.match(backend,/externalFallback:String\(source\|\|''\)\.startsWith\('jina-reader'\)/);
  assert.match(backend,/attempts/);
  assert.match(backend,/patch:130(?:5|6|7|8)/);
});
test('Admin reports Reader fallback and safe failed-attempt messages',()=>{
  assert.match(html,/Reader fallback/);
  assert.match(html,/out\.attempts/);
});
