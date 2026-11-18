const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const shop=fs.readFileSync(require.resolve('../assets/js/azobss-pc-shop-v1487.js'),'utf8');
function catalogFixture(){
 let admin=false;const requests=[],renders=[];
 const ctx={Promise,AbortSignal,Map,Number,String,Date,console,setTimeout:()=>0,clearTimeout(){},CATALOG_API:'https://fixture/catalog',pcShopIsAdmin:()=>admin,authHeaders:async()=>admin?{Authorization:'Bearer fixture'}:{},document:{querySelector:()=>null},window:{AZOBSSPcVisibility:{accept(){}}},applyLocalProductImage:p=>p,syncCartPrices(){},setSyncStatus(){},renderHardware(){renders.push(ctx.app.state());},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))};
 vm.runInNewContext("let catalogRequest=null,catalogRetry,catalogAuthRevision=0,adminCatalogReload=null,adminCatalogReloadAgain=false,catalog=[],storefrontSnapshot=[],catalogMeta={mode:'loading'};"+shop.slice(shop.indexOf('function retryCatalogue(){'),shop.indexOf('async function loadStorefrontSnapshot(){'))+"globalThis.app={loadCatalog,onCatalogAuthReady,state:()=>({ids:catalog.map(p=>p.id),...catalogMeta})};",ctx);
 return {app:ctx.app,requests,renders,setAdmin:v=>admin=v,respond(index,ids){requests[index].resolve({ok:true,json:async()=>({ok:true,capabilities:{expandedCatalog1512:true,unifiedPcHardware1526:true},products:ids.map(id=>({id,type:'laptop',price:100})),visibility:{ok:true}})});}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('restored admin authentication refetches the full catalogue after a public request',async()=>{
 const f=catalogFixture();const first=f.app.loadCatalog();await tick();assert.equal(f.requests[0].url,'https://fixture/catalog');
 f.setAdmin(true);const reload=f.app.onCatalogAuthReady();f.respond(0,['visible']);await first;await tick();
 assert.match(f.requests[1].url,/includeHidden=1/);assert.equal(f.requests[1].options.headers.Authorization,'Bearer fixture');assert.equal(f.renders.length,0,'stale public response must not overwrite restored session');
 f.respond(1,['visible','hidden-emarque']);await reload;assert.deepEqual(Array.from(f.app.state().ids),['visible','hidden-emarque']);assert.equal(f.app.state().includesHidden,true);
});
test('sign-out during an admin fetch discards its response and reloads public rows',async()=>{
 const f=catalogFixture();f.setAdmin(true);const first=f.app.loadCatalog();await tick();
 f.setAdmin(false);const reload=f.app.onCatalogAuthReady();f.respond(0,['hidden-emarque']);await first;await tick();assert.equal(f.requests[1].url,'https://fixture/catalog');
 f.respond(1,['visible']);await reload;assert.deepEqual(Array.from(f.app.state().ids),['visible']);assert.equal(f.app.state().includesHidden,false);assert.ok(!f.renders.some(state=>state.ids.includes('hidden-emarque')));
});
function storefrontFixture(){
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'all',innerHTML:'',textContent:'',listeners:{},dataset:{},classList:{add(){}},get options(){return [...this.innerHTML.matchAll(/<option value="([^"]+)"/g)].map(m=>({value:m[1]}));},addEventListener(k,fn){this.listeners[k]=fn;},insertAdjacentHTML(){},scrollIntoView(){},querySelector(){return null;},querySelectorAll(){return[];}});return els.get(id);}
 const loc=new URL('https://www.azobss.com/PC-Build/?model=azp-a13fe2a123132cfe&section=prebuilt'),visibility={status:()=> 'ready',visible:p=>p.id!=='hidden',hidden:p=>p.id==='hidden',setRows(){}};
 const ctx={URL,Date,Intl,location:loc,history:{replaceState(_a,_b,url){loc.href=String(url);}},document:{getElementById:el,querySelector:s=>el(s.replace(/^#/,'')),querySelectorAll:()=>[],addEventListener(){}},window:{location:loc,AZOBSSPcVisibility:visibility,AZOBSSPcModel:require('../assets/js/azobss-pc-model-v1537'),addEventListener(){}}};
 el('azPcShopSearch').value='';el('azPcShopSort').value='recommended';
 const source=fs.readFileSync(require.resolve('../assets/js/azobss-pc-storefront-v1512.js'),'utf8').replace('window.AZOBSSPcStorefront={render};','window.AZOBSSPcStorefront={render,shareProduct};');vm.runInNewContext(source,ctx);return {app:ctx.window.AZOBSSPcStorefront,el};
}
test('missing shared products show an availability message and recovery actions',()=>{
 const f=storefrontFixture();f.app.render([],{catalogMode:'live',isAdmin:()=>false});const html=f.el('azPcShopGrid').innerHTML;assert.match(html,/Produk belum tersedia/);assert.match(html,/data-store-browse/);assert.match(html,/data-store-retry/);assert.doesNotMatch(html,/No matching products/);
 f.app.render([],{catalogMode:'live',isAdmin:()=>true,adminCatalogPending:true});assert.match(f.el('azPcShopGrid').innerHTML,/Memuatkan katalog admin/);
});
test('a hidden product cannot open the customer Share popup',()=>{
 const f=storefrontFixture(),notices=[];f.app.render([],{isAdmin:()=>true,modal:(title,body)=>notices.push({title,body})});
 f.app.shareProduct({id:'hidden',name:'Hidden device'},null);assert.equal(notices.length,1);assert.match(notices[0].body,/disembunyikan/);assert.match(notices[0].body,/Show/);
});
