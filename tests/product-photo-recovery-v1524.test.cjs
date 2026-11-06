'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),json=p=>JSON.parse(read(p));
const upgrade=json('Upgrade-Parts/catalog-v1518.json').products,store=json('PC-Build/pc-shop-storefront-v1512.json'),internal=json('lib/data/pc-shop-catalog-v1512.json').products;
test('the four reported Intel CPUs and two Lenovo laptops have locally served real model photos',()=>{
 for(const name of ['Intel I5 14400F','Intel I5 14400','Intel I7 12700F','Intel I7 12700']){
  const p=upgrade.find(p=>p.name===name);assert.ok(p,name);assert.equal(p.imageKind,'model');assert.equal(p.imageModel,name);assert.match(p.image,/\.webp$/);assert.ok(fs.existsSync(path.join(root,p.image)));
 }
 for(const id of ['nb-plaza-p14138','nb-plaza-p14887']){
  const p=store.products.find(p=>p.id===id),server=internal.find(p=>p.id===id);
  assert.equal(p.photoUnavailable,false);assert.equal(server.photoUnavailable,false);assert.equal(p.image,server.image);assert.equal(p.localImageVerified,true);assert.match(p.image,/^\/PC-Build\/images\/shop\/[a-f0-9]{24}\.webp$/);assert.equal(store.blockedImagePaths.includes(p.image),false);
  const bytes=fs.readFileSync(path.join(root,p.image));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
});
test('current presentation recovers a stale missing-photo API response without altering commerce fields',()=>{
 const source=read('assets/js/azobss-pc-shop-v1487.js'),code=source.slice(source.indexOf('function applyLocalProductImage('),source.indexOf('function normalizedItem('));
 const card=store.products.find(p=>p.id==='nb-plaza-p14138');
 const ctx={window:{},presentationById:new Map([[card.id,card]]),blockedProductImages:new Set(store.blockedImagePaths)};
 vm.createContext(ctx);vm.runInContext(code+';this.present=applyLocalProductImage;',ctx);
 const old={id:card.id,image:'/assets/images/pc-product-unavailable.svg',photoUnavailable:true,localImageVerified:true,name:'Original order identity',price:2045,available:false,requiresConfirmation:true};
 const result=ctx.present(old);assert.equal(result.image,card.image);assert.equal(result.photoUnavailable,false);for(const key of ['id','name','price','available','requiresConfirmation'])assert.equal(result[key],old[key]);assert.equal(old.photoUnavailable,true);
 // A separately approved admin image remains authoritative.
 const custom={...old,image:'/PC-Build/images/shop/'+'a'.repeat(24)+'.webp',photoUnavailable:false};assert.equal(ctx.present(custom).image,custom.image);
});
test('missing model photos remain honest and the zoom viewer has no helper caption',()=>{
 assert.equal(upgrade.some(p=>p.imageKind==='example'),false);
 for(const p of upgrade){assert.ok(fs.existsSync(path.join(root,p.image)),p.id);if(p.imageKind==='illustration')assert.match(p.image,/\.svg$/);}
 const html=read('Upgrade-Parts/index.html'),start=html.indexOf('<dialog class="vnp-viewer"'),viewer=html.slice(start,html.indexOf('</dialog>',start));assert.doesNotMatch(viewer,/<p[ >]/);assert.doesNotMatch(read('assets/js/azobss-upgrade-catalog-v1518.js'),/Foto contoh kategori, bukan gambar model ini/);
});
