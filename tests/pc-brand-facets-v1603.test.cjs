'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function fixture(){
 const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:'all',innerHTML:'',textContent:'',listeners:{},classList:{add(){}},get options(){return [...this.innerHTML.matchAll(/<option value="([^"]+)"/g)].map(m=>({value:m[1]}));},addEventListener(k,fn){this.listeners[k]=fn;},insertAdjacentHTML(){},scrollIntoView(){}});return els.get(id);}
 const location=new URL('https://www.azobss.com/PC-Build/');
 const context={URL,Date,Intl,location,history:{replaceState(_a,_b,url){location.href=String(url);}},document:{getElementById:el,querySelector:s=>el(s.replace(/^#/,'')),querySelectorAll:()=>[],addEventListener(){}},window:{location,addEventListener(){},AZOBSSPcModel:require('../assets/js/azobss-pc-model-v1537'),AZOBSSPcVisibility:{setRows(){},visible:p=>!p.hidden}}};
 el('azPcShopSearch').value='';el('azPcShopSort').value='recommended';
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/js/azobss-pc-storefront-v1512.js'),'utf8'),context);
 const app=context.window.AZOBSSPcStorefront;
 const row=(id,brand,category,group='components')=>({id,brand,category,catalogGroup:group,type:group==='prebuilt'?'laptop':'hardware',name:brand+' '+id,price:100,specs:[],image:'/photo.webp'});
 const rows=[row('gpu-asus','ASUS','GPU'),row('gpu-msi','MSI','Graphics Cards'),row('ram','KINGSTON','RAM'),row('board','ASROCK','Motherboard'),row('keyboard','LOGITECH','Keyboard','accessories'),row('laptop','ACER','Laptop','prebuilt'),{...row('hidden-gpu','ZOTAC','GPU'),hidden:true}];
 const brands=()=>el('azPcShopBrand').options.map(o=>o.value);
 const select=cat=>{el('azPcShopCategory').value=cat;app.render(rows,{});};
 return {el,app,rows,brands,select};
}
test('every category limits brands to visible matching products, including graphics aliases',()=>{
 const f=fixture();f.app.render(f.rows,{});
 for(const [cat,brands] of [['Graphics Cards',['all','ASUS','MSI']],['Desktop Memory',['all','KINGSTON']],['Motherboards',['all','ASROCK']],['Keyboards',['all','LOGITECH']],['Laptop',['all','ACER']]]){
  f.select(cat);assert.deepEqual(f.brands(),brands,cat);
 }
});
test('changing category resets an invalid brand and restores all brands on All categories',()=>{
 const f=fixture();f.app.render(f.rows,{});f.select('Graphics Cards');f.el('azPcShopBrand').value='MSI';f.select('Desktop Memory');
 assert.equal(f.el('azPcShopBrand').value,'all');assert.match(f.el('azPcShopGrid').innerHTML,/KINGSTON ram/);
 f.select('all');assert.ok(f.brands().includes('MSI'));assert.ok(f.brands().includes('KINGSTON'));assert.ok(!f.brands().includes('ZOTAC'));
});
test('refresh preserves valid category and brand; hub change drops incompatible filters',()=>{
 const f=fixture();f.app.render(f.rows,{});f.select('Graphics Cards');f.el('azPcShopBrand').value='ASUS';f.app.render(f.rows,{});
 assert.equal(f.el('azPcShopBrand').value,'ASUS');assert.deepEqual(f.brands(),['all','ASUS','MSI']);
 f.app.setHubGroup('accessories');assert.equal(f.el('azPcShopCategory').value,'all');assert.equal(f.el('azPcShopBrand').value,'all');assert.deepEqual(f.brands(),['all','LOGITECH']);
});
