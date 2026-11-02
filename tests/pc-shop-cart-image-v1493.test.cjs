const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');

test('v1493 PC Build cards expose Add to Cart, Buy Now, Share and enquiry actions',()=>{
  const html=fs.readFileSync(path.join(ROOT,'PC-Build','index.html'),'utf8');
  for(const token of ['data-build-add','data-build-buy','Add to Cart','Buy Now','Tanya / Tempah','data-share']) assert.match(html,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(html,/azobssPcShopAddExternalItem/);
  assert.match(html,/requiresConfirmation:!live/);
});

test('v1493 backend accepts clear snapshot Hardware/PC Build only through Price Confirmation',()=>{
  const runtime=fs.readFileSync(path.join(ROOT,'lib','azobss-pc-shop-runtime.js'),'utf8');
  assert.match(runtime,/pcBuildCart: true/);
  assert.match(runtime,/snapshotCheckoutToPriceConfirmation: true/);
  assert.match(runtime,/function resolveBuildItem/);
  assert.match(runtime,/priceConfirmationRequired = intent === 'quote' \|\| items\.some/);
  assert.doesNotMatch(runtime,/verified_price_required/);
});

test('v1493 exact-image resolver rejects conflicting model imagery and adds structured retailer image sources',()=>{
  const runtime=fs.readFileSync(path.join(ROOT,'lib','azobss-pc-shop-runtime.js'),'utf8');
  for(const token of ['imageExpectedModelKeys','imageCandidateModelKeys','imageCandidateIdentityOk','resolveShopifySearchImage','resolveWooStoreImage']) assert.match(runtime,new RegExp(token));
  assert.match(runtime,/filter\(x=>imageCandidateIdentityOk\(x,product\)\)/);
  assert.match(runtime,/strictExactImageIdentity: true/);
});
