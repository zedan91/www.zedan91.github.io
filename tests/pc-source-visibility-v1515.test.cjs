const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function renderer(){
 const source=read('assets/js/azobss-pc-storefront-v1512.js').replace('window.AZOBSSPcStorefront={render};','window.AZOBSSPcStorefront={render,testCard:card,testSetActions:value=>{actions=value}};');
 const context={window:{},URL,Date,Intl};vm.createContext(context);vm.runInContext(source,context);
 return context.window.AZOBSSPcStorefront;
}
const product={id:'fixture-pc',name:'Fixture PC',type:'desktop',category:'Desktop PC',price:2500,
 image:'/PC-Build/images/shop/fixture.webp',priceStatus:'snapshot',priceCheckedAt:'2026-11-05T01:00:00Z',
 sourceName:'SUPPLIER FIXTURE',sourceUrl:'https://supplier.example/product',specs:['Model: Fixture','CPU: Fixture']};
test('supplier references and recorded time fail closed for visitors and disappear after admin access is removed',()=>{
 const app=renderer();let admin=false;
 assert.doesNotMatch(app.testCard(product),/SUPPLIER FIXTURE|supplier\.example|Harga sumber direkod/);
 app.testSetActions({isAdmin:()=>admin});
 assert.doesNotMatch(app.testCard(product),/data-pc-admin-source|05 Nov/);
 admin=true;
 const privileged=app.testCard(product);
 assert.match(privileged,/SUPPLIER FIXTURE/);assert.match(privileged,/https:\/\/supplier\.example\/product/);
 assert.match(privileged,/Harga sumber direkod/);assert.match(privileged,/data-pc-admin-source/);
 admin=false;
 const publicCard=app.testCard(product);
 assert.doesNotMatch(publicCard,/SUPPLIER FIXTURE|supplier\.example|data-pc-admin-source|Harga sumber direkod/);
 assert.match(publicCard,/Buy Now/);assert.match(publicCard,/Add to Cart/);assert.match(publicCard,/2,500/);
});
test('admin source markup escapes supplier text and rejects non-HTTPS links',()=>{
 const app=renderer();app.testSetActions({isAdmin:()=>true});
 const html=app.testCard({...product,sourceName:'<script>supplier</script>',sourceUrl:'javascript:alert(1)'});
 assert.match(html,/&lt;script&gt;supplier&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>|href="javascript:/);
});
test('legacy build helpers hide supplier notes and remove the technical price tagline',()=>{
 const html=read('PC-Build/index.html');
 const functions=['isRetailerBuild','publicBuildTagline','publicBuildNote'].map(name=>html.split('\n').find(line=>line.startsWith('function '+name+'('))).join('\n');
 const ctx={};vm.createContext(ctx);vm.runInContext(functions,ctx);
 const item={retailerSnapshot:true,tagline:'Harga jual AZOBSS • harga sumber jelas',note:'Harga sumber direkod: 26/10/2026, 8:00:00 PG'};
 assert.equal(ctx.publicBuildTagline(item,false),'');assert.equal(ctx.publicBuildTagline(item,true),'');
 assert.equal(ctx.publicBuildNote(item,false),'');assert.equal(ctx.publicBuildNote(item,true),item.note);
});
