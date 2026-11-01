const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPcShopRuntime,CAPABILITIES,RELEASE}=require('../lib/azobss-pc-shop-runtime');
const root=path.resolve(__dirname,'..');

function runtimeWith({html='<meta property="og:image" content="https://example.com/p.jpg"><meta property="og:title" content="MSI GeForce RTX 5070 12G VENTUS 2X OC"> MSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989',shopify={price:3099,available:true,variant:'RX7600 8GB',productTitle:'FA-GAMING R5 Radeon RX 7600',image:'https://example.com/dota.jpg',sourceText:'AMD Ryzen 5 5500 Radeon RX 7600'}}={}){
  const sent=[];
  const rt=createPcShopRuntime({
    rootDir:root,
    getDb:()=>({}),
    getUserIdentity:async()=>({uid:'u1',username:'tester'}),
    getAdminIdentity:async()=>({isAdmin:true}),
    readBody:async()=>'',
    send:(res,status,body,type,headers)=>{const row={status,body,type,headers};sent.push(row);return row;},
    cleanText:(v,n=300)=>String(v||'').slice(0,n),
    pcBuildFetch:async()=>html,
    pcBuildReadShopify:async()=>shopify,
    pcBuildPriceFromJsonLd:()=>0,
    pcBuildPriceFromHtml:()=>2989
  });
  return {rt,sent};
}

test('v1485 advertises strict live availability, stale-cart rejection and private pricing',()=>{
  assert.equal(RELEASE,'1485');
  for(const k of ['strictAvailability','staleCartReject','retailerBuildLiveVerification','privatePricing','imageProxy'])assert.equal(CAPABILITIES[k],true,k);
});

test('unknown hardware availability is hidden instead of assumed available',async()=>{
  const {rt}=runtimeWith({html:'MSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989'});
  const c=await rt.getLiveCatalog(true);
  const nb=c.internalProducts.filter(x=>String(x.sourceName||'').includes('NB Plaza'));
  assert.ok(nb.length>=2);assert.ok(nb.every(x=>x.availability==='unknown'));
  assert.ok(c.publicProducts.every(x=>!String(x.sourceName||'').includes('NB Plaza')));
});

test('explicit out-of-stock hardware is hidden even when a price exists',async()=>{
  const {rt}=runtimeWith({html:'MSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989 OUT OF STOCK'});
  const c=await rt.getLiveCatalog(true);
  const nb=c.internalProducts.filter(x=>String(x.sourceName||'').includes('NB Plaza'));
  assert.ok(nb.length>=2);assert.ok(nb.every(x=>x.available===false));
  assert.ok(c.publicProducts.every(x=>!String(x.sourceName||'').includes('NB Plaza')));
});

test('public live hardware contains selling price/spec/source but no cost or markup fields',async()=>{
  const {rt}=runtimeWith({html:'MSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989 IN STOCK ADD TO CART'});
  const c=await rt.getLiveCatalog(true);
  assert.ok(c.publicProducts.length>=1);
  for(const p of c.publicProducts){
    assert.equal(p.priceStatus,'live');assert.equal(p.availability,'available');assert.ok(p.price>0);assert.ok(p.sourceName);assert.ok(p.specs.length);
    for(const k of ['sourcePrice','unitCost','markupRate','markupAmount','cost'])assert.equal(Object.hasOwn(p,k),false,`${p.id}:${k}`);
  }
});

test('retailer PC Builds are served only through backend live verification and public output hides cost',async()=>{
  const {rt,sent}=runtimeWith();
  await rt.handle({method:'GET'}, {}, {pathname:'/api/pc-shop/builds',query:{}});
  assert.equal(sent.at(-1).status,200);
  const body=JSON.parse(sent.at(-1).body);
  assert.equal(body.ok,true);assert.ok(body.builds.length>=1);
  for(const b of body.builds){
    assert.equal(b.priceStatus,'live');assert.equal(b.availability,'available');assert.equal(b.priceVerified,true);
    for(const k of ['sourcePrice','unitCost','markupRate','markupAmount','cost'])assert.equal(Object.hasOwn(b,k),false,`${b.id}:${k}`);
  }
});

test('client Buy Now uses single-item checkout and stale cart is sanitized against live catalog',()=>{
  const js=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1485.js'),'utf8');
  assert.match(js,/if\(buyNow\)\{\s*openCheckout\('checkout',\[item\]\);\s*return\s*\}/);
  assert.match(js,/function syncCartPrices\(strict=false\)/);
  assert.match(js,/if\(!p\)\{if\(strict\)\{removed\+\+/);
  assert.match(js,/next\.priceStatus!=='live'/);
  assert.match(js,/removed\+\+/);
});

test('checkout revalidates live catalog before duplicate reuse and image viewer supports tap/click',()=>{
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  const client=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1485.js'),'utf8');
  const revalidate=runtime.indexOf('const live = await getLiveCatalog(true)');
  const duplicate=runtime.indexOf('const duplicate = await findRecentDuplicate',revalidate);
  assert.ok(revalidate>0&&duplicate>revalidate);
  assert.match(client,/function openImageViewer\(p\)/);
  assert.match(client,/azobssOpenPcProductImage/);
  assert.match(client,/data-shop-image/);
});
