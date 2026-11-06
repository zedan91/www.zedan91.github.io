'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),catalog=JSON.parse(read('Upgrade-Parts/catalog-v1518.json'));
test('M350S uses its manufacturer model photo and no category borrows another product photo',()=>{
 const p=catalog.products.find(p=>p.name==='LOGITECH M350S WIRELESS');assert.equal(p.imageKind,'model');assert.equal(p.image,'/Upgrade-Parts/assets/catalog/logitech-m350s.png');assert.match(p.imageModel,/M350s/);assert.equal(catalog.products.some(p=>p.imageKind==='example'),false);
 for(const p of catalog.products){if(p.imageKind==='illustration')assert.match(p.image,/\.svg$/);assert.ok(fs.existsSync(path.join(root,p.image)),p.id);}
});
test('illustrations do not expose a product-photo button or open a model viewer',()=>{
 const src=read('assets/js/azobss-upgrade-catalog-v1518.js');const start=src.indexOf('const canZoom='),end=src.indexOf('function draw()');const ctx={esc:x=>String(x)};vm.createContext(ctx);vm.runInContext(src.slice(start,end)+'\nthis.testMedia=media;this.testZoom=canZoom;',ctx);
 const generic={id:'fixture',name:'Logitech model',category:'Mouse',image:'/Upgrade-Parts/assets/catalog/mouse.svg',imageKind:'illustration'};
 assert.equal(ctx.testZoom(generic),false);const html=ctx.testMedia(generic,0);assert.doesNotMatch(html,/<button|data-vnp-image/);assert.match(html,/Gambar model belum tersedia/);
 const exact={...generic,imageKind:'model',image:'/Upgrade-Parts/assets/catalog/logitech-m350s.png'};assert.equal(ctx.testZoom(exact),true);assert.match(ctx.testMedia(exact,0),/data-vnp-image/);assert.match(ctx.testMedia(exact,0),/Foto model/);
 assert.doesNotMatch(src,/Foto contoh kategori, bukan gambar model ini/);assert.match(src,/if\(!p\|\|!canZoom\(p\)\)return/);
});
test('all products shown in G1 plus the i5-12400F in G2 use inspected model photos',()=>{
 const names=['MINIX NUC PC NR660 LP R5 6600H 16GB 512GB W11P','MS WINDOW 11 HOME OEM','MS WINDOW 11 PRO OEM','WINDOW SERVER ESSENTIALS 2016','MS OFFICE 365 PERSONAL ESD','MS OFFICE 365 HOME/FAMILY (6-DEVICES) ESD','MS OFFICE 365 BUSINESS STANDARD','MS OFFICE HOME 2024 ESD (WIN & MAC)','Intel I5 12400F'];
 for(const name of names){const p=catalog.products.find(p=>p.name===name);assert.ok(p,name);assert.equal(p.imageKind,'model',name);assert.match(p.image,/^\/Upgrade-Parts\/assets\/models\//);assert.equal(p.imageModel,name);}
 const html=read('Upgrade-Parts/index.html');assert.match(html,/location\.replace\(next\.href\)/);assert.match(html,/new URL\('\/PC-Build\/'/);
 assert.doesNotMatch(read('assets/js/azobss-pc-storefront-v1512.js'),/Foto contoh kategori, bukan gambar model ini/);
 assert.doesNotMatch(read('assets/js/azobss-upgrade-catalog-v1518.js'),/viewer\.querySelector\('p'\)/);
});
