const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1304 package',()=>assert.ok(['1.0.1304','1.0.1305','1.0.1306','1.0.1307','1.0.1308','1.0.1309','1.0.1310','1.0.1311','1.0.1312','1.0.1313','1.0.1314','1.0.1315','1.0.1316','1.0.1317','1.0.1318','1.0.1321','1.0.1322'].includes(pkg.version)));
test('challenge URLs recover the Shopee next product URL without trusting external hosts',()=>{
  assert.match(runtime,/function azShopeeChallengeInfo/);
  assert.match(runtime,/\['next','redirect','redirect_url','url','target'\]/);
  assert.match(runtime,/azShopeePublicHost\(candidate\)/);
});
test('HTTP resolver accepts useful SEO metadata before Shopee internal APIs',()=>{
  assert.match(runtime,/function azShopeeSeoMetadataFromPage/);
  assert.match(runtime,/const firstSeo=azShopeeSeoMetadataFromPage\(first\.url,first\.html\)/);
  assert.match(runtime,/if\(azShopeeMetadataHasRequiredProduct\(firstSeo\.metadata\)\)/);
  const seoPos=runtime.indexOf('const firstSeo=azShopeeSeoMetadataFromPage(first.url,first.html)');
  const apiPos=runtime.indexOf('const apiData=await azShopeeItemApi(productUrl,ids)',seoPos);
  assert.ok(seoPos>=0 && apiPos>seoPos,'SEO-first branch must appear before item API fallback');
});
test('challenge-page canonical/og metadata remains the product sourceUrl',()=>{
  assert.match(runtime,/const htmlCanonical=azCanonicalUrl\(html,productUrl\)\|\|meta\['og:url'\]\|\|challenge\.nextUrl/);
  assert.match(runtime,/meta\['og:title'\]/);
  assert.match(runtime,/meta\['og:description'\]/);
  assert.match(runtime,/meta\['og:image'\]/);
  assert.match(runtime,/sourceUrl:canonicalUrl/);
});
test('browser fallback no longer treats traffic challenge as automatic metadata failure',()=>{
  assert.match(runtime,/azShopeeChallengeInfo\(current\)\.isChallenge/);
  assert.match(runtime,/browser-seo-challenge/);
  assert.match(runtime,/seoRecovered/);
});
test('secondary Express backend carries the same SEO challenge helpers',()=>{
  assert.match(backend,/function azShopeeSeoMetadataFromPage/);
  assert.match(backend,/http-seo-challenge/);
  assert.match(backend,/patch:13(?:04|05|06|07|08)/);
});
