const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createPcShopRuntime,CAPABILITIES,RELEASE}=require('../lib/azobss-pc-shop-runtime');
const root=path.resolve(__dirname,'..');

const buildHtml=`Title: IDEALTECH Radiance Stellar NVIDIA® GeForce RTX™ 5070 — Ideal Tech PC\n# IDEALTECH Radiance Stellar NVIDIA® GeForce RTX™ 5070\n![Selected Case](https://idealtech.com.my/wp-content/uploads/case.jpg)\nProcessor\nAMD Ryzen 5 7500F\nGPU\nNVIDIA GeForce RTX 5070 12GB\nCooler\nDEEPCOOL AG400 G2 ARGB\nMotherboard\nMSI B650M GAMING WIFI\nRAM\n16GB DDR5 6000MHz\nSSD\n500GB Gen4 NVMe M.2 SSD\nPower Supply\nANTEC CSK750 750W 80+ Bronze\nCase\nANTEC C2M ARGB\nOS\nWindows 11 Home Free Unactivated\nOrder Total RM6,299.00\nAdd to cart`;

function runtimeWith({html='Title: MSI GeForce RTX 5070 12G VENTUS 2X OC\n# MSI GeForce RTX 5070 12G VENTUS 2X OC\n![GPU](https://example.com/p.jpg)\nMSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989',shopify={price:3099,available:true,variant:'RX 7600 8GB',productTitle:'FA-GAMING R5 Radeon RX 7600',image:'https://example.com/dota.jpg',sourceText:'PROCESSOR: AMD Ryzen 5 5500\nGRAPHICS CARD: Radeon RX 7600\nMOTHERBOARD: B550M\nMEMORY: 16GB DDR4\nSTORAGE: 500GB NVMe SSD\nPOWER SUPPLY: 650W Bronze\nCASE: mATX Airflow'}}={}){
  const sent=[];
  const rt=createPcShopRuntime({
    rootDir:root,
    getDb:()=>({}),
    getUserIdentity:async()=>({uid:'u1',username:'tester'}),
    getAdminIdentity:async()=>({isAdmin:true}),
    readBody:async()=>'',
    send:(res,status,body,type,headers)=>{const row={status,body,type,headers};sent.push(row);return row;},
    cleanText:(v,n=300)=>String(v||'').slice(0,n),
    pcBuildFetch:async(url)=>String(url).includes('amd-rtx5070-gamingpc')?buildHtml:html,
    pcBuildReadShopify:async()=>shopify,
    pcBuildPriceFromJsonLd:()=>0,
    pcBuildPriceFromHtml:(text)=>String(text).includes('6,299')?6299:2989
  });
  return {rt,sent};
}

test('v1487 keeps checkout hardening while adding clear-price snapshot fallback for display',()=>{
  assert.equal(RELEASE,'1496');
  for(const k of ['strictAvailability','staleCartReject','retailerBuildLiveVerification','privatePricing','imageProxy','clearPriceSnapshotFallback','singlePriceRetailerCatalog'])assert.equal(CAPABILITIES[k],true,k);
});

test('unknown hardware availability may use a fresh clear snapshot for display but is not checkout-ready',async()=>{
  const {rt}=runtimeWith({html:'Title: MSI GeForce RTX 5070 12G VENTUS 2X OC\nMSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989'});
  const c=await rt.getLiveCatalog(true);
  const nb=c.internalProducts.filter(x=>String(x.sourceName||'').includes('NB Plaza'));
  assert.ok(nb.length>=2);assert.ok(nb.some(x=>x.priceStatus==='snapshot'));
  assert.ok(nb.filter(x=>x.priceStatus==='snapshot').every(x=>x.available===false&&x.requiresConfirmation===true));
  assert.ok(c.publicProducts.some(x=>String(x.sourceName||'').includes('NB Plaza')&&x.priceStatus==='snapshot'));
});

test('explicit out-of-stock hardware is hidden even when a price exists',async()=>{
  const {rt}=runtimeWith({html:'Title: MSI GeForce RTX 5070 12G VENTUS 2X OC\nMSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989 OUT OF STOCK'});
  const c=await rt.getLiveCatalog(true);
  const nb=c.internalProducts.filter(x=>String(x.sourceName||'').includes('NB Plaza'));
  assert.ok(nb.length>=2);assert.ok(nb.every(x=>x.available===false));
  assert.ok(c.publicProducts.every(x=>String(x.id)!=='nb-msi-rtx5070-ventus-12g'));
});

test('public hardware contains selling price/spec/source but no cost or markup fields',async()=>{
  const {rt}=runtimeWith({html:'Title: MSI GeForce RTX 5070 12G VENTUS 2X OC\n# MSI GeForce RTX 5070 12G VENTUS 2X OC\n![GPU](https://example.com/p.jpg)\nMSI GeForce RTX 5070 12G VENTUS 2X OC RM 2989 IN STOCK ADD TO CART'});
  const c=await rt.getLiveCatalog(true);
  assert.ok(c.publicProducts.length>=1);
  for(const p of c.publicProducts){
    assert.ok(['live','snapshot'].includes(p.priceStatus));assert.ok(p.price>0);assert.ok(p.sourceName);assert.ok(p.specs.length);
    for(const k of ['sourcePrice','unitCost','markupRate','markupAmount','cost'])assert.equal(Object.hasOwn(p,k),false,`${p.id}:${k}`);
  }
});

test('retailer PC Builds use live page specs instead of stale static parts and hide cost',async()=>{
  const {rt,sent}=runtimeWith();
  await rt.handle({method:'GET'}, {}, {pathname:'/api/pc-shop/builds',query:{refresh:'1'}});
  assert.equal(sent.at(-1).status,200);
  const body=JSON.parse(sent.at(-1).body);
  assert.equal(body.ok,true);assert.ok(body.builds.length>=1);
  const b=body.builds.find(x=>String(x.sourceUrl||'').includes('amd-rtx5070-gamingpc'))||body.builds[0];
  assert.equal(b.priceStatus,'live');assert.equal(b.availability,'available');assert.equal(b.priceVerified,true);
  assert.ok(b.parts.some(x=>x[0]==='CPU'&&/7500F/i.test(x[1])));assert.ok(b.parts.some(x=>x[0]==='GPU'&&/5070/i.test(x[1])));
  for(const k of ['sourcePrice','unitCost','markupRate','markupAmount','cost'])assert.equal(Object.hasOwn(b,k),false,`${b.id}:${k}`);
});

test('client Buy Now uses single-item checkout while clear-price snapshot items stay eligible for Price Confirmation',()=>{
  const js=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1487.js'),'utf8');
  assert.match(js,/if\(buyNow\)\{openCheckout\('checkout',\[item\]\);return\}/);
  assert.match(js,/window\.azobssPcShopAddExternalItem/);
  assert.match(js,/externalBuildsLoaded/);
  assert.match(js,/requiresConfirmation:raw\?\.requiresConfirmation===true\|\|String\(raw\?\.priceStatus/);
  assert.match(js,/String\(p\.availability\|\|''\)==='unavailable'/);
});

test('checkout revalidates live catalog before duplicate reuse and image viewer supports tap/click',()=>{
  const runtime=fs.readFileSync(path.join(root,'lib/azobss-pc-shop-runtime.js'),'utf8');
  const client=fs.readFileSync(path.join(root,'assets/js/azobss-pc-shop-v1487.js'),'utf8');
  const revalidate=runtime.indexOf('const live = await getLiveCatalog(true)');
  const duplicate=runtime.indexOf('const duplicate = await findRecentDuplicate',revalidate);
  assert.ok(revalidate>0&&duplicate>revalidate);
  assert.match(client,/function openImageViewer\(p\)/);
  assert.match(client,/azobssOpenPcProductImage/);
  assert.match(client,/data-shop-image/);
});
