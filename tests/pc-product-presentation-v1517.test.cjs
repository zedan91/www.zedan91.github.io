'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('presentation overlay cannot replace trusted API pricing, identity or availability',()=>{
 const source=fs.readFileSync(require.resolve('../assets/js/azobss-pc-shop-v1487.js'),'utf8');
 const code=source.slice(source.indexOf('function applyLocalProductImage('),source.indexOf('function normalizedItem('));
 const photo='/PC-Build/images/shop/'+'a'.repeat(24)+'.webp';
 const ctx={window:{},presentationById:new Map([['fixture',{displayName:'Short model',specs:['CPU: known'],price:1,id:'other',available:true,requiresConfirmation:false}]]),blockedProductImages:new Set()};
 vm.createContext(ctx);vm.runInContext(code+';this.present=applyLocalProductImage;',ctx);
 const original={id:'fixture',name:'Full original identity',price:2300,available:false,requiresConfirmation:true,image:photo,localImageVerified:true};
 const result=ctx.present(original);assert.equal(result.price,2300);assert.equal(result.id,'fixture');assert.equal(result.name,original.name);assert.equal(result.available,false);assert.equal(result.requiresConfirmation,true);assert.equal(result.displayName,'Short model');assert.equal(original.displayName,undefined);
 ctx.blockedProductImages.add(photo);assert.equal(ctx.present(original).image,'/assets/images/pc-product-unavailable.svg');
});
test('cards show short model titles and labelled specs without filler, price labels or HTML injection',()=>{
 let source=fs.readFileSync(require.resolve('../assets/js/azobss-pc-storefront-v1512.js'),'utf8').replace('window.AZOBSSPcStorefront={render};','window.AZOBSSPcStorefront={card,facts};');
 const ctx={window:{},URL,Date,Intl};vm.createContext(ctx);vm.runInContext(source,ctx);
 const html=ctx.window.AZOBSSPcStorefront.card({id:'fixture',name:'Model (all configuration)',displayName:'MSI PRO DP180 14A-1630',price:3600,category:'Desktop PC',specs:['Model: original','Spesifikasi dan konfigurasi tepat disahkan sebelum pesanan.','CPU: i5-14400','Memory: 8GB DDR5','Storage: 500GB SSD','<script>unsafe</script>']});
 assert.match(html,/<h3>MSI PRO DP180 14A-1630<\/h3>/);assert.match(html,/CPU: i5-14400/);assert.match(html,/500GB SSD/);assert.doesNotMatch(html,/Harga AZOBSS|Spesifikasi dan konfigurasi tepat|<script>/);
});
