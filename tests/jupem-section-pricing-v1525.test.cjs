'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const server=read('deploy-server.js'),browser=read('assets/js/azobss-user-price-adjustment.js'),storefront=read('assets/js/azobss-pabm-storefront.js');
function fn(src,name){src=src.replace(/\bexport (?=(?:async )?function)/g,'');const found=src.match(new RegExp('(?:^|\\n)((?:async )?function '+name+'\\()'));assert.ok(found,name);const start=found.index+(found[0].startsWith('\n')?1:0);const end=src.slice(start+10).search(/\n(?:async )?function \w+\(/);assert.ok(end>=0,'function boundary '+name);return src.slice(start,end+start+10);}
function context(code,values={}){const c={console,...values};vm.createContext(c);vm.runInContext(code,c);return c;}
const serverHelpers=server.slice(server.indexOf('function azNormalizeUserPriceAdjustment('),server.indexOf('function azTrustedPremiumPriceCategory('));
const browserHelpers=browser.slice(browser.indexOf('const PRICE_CATEGORIES'),browser.indexOf('function savedUser('));
function adminHelpers(src){return src.slice(src.indexOf('const AZ_REG_PRICE_CATEGORIES='),src.indexOf('function azRegPricePillHtml('));}
const admins=['admin/index.html','admin-preview-1189.html'];
function resolvers(){return [context(serverHelpers).azIdentityPriceAdjustments,context(browserHelpers+';this.resolve=profilePercents;').resolve,...admins.map(n=>context(adminHelpers(read(n))).azRegPricePercents)];}
const base={pa:0,bmSbm:0,syitPiawai:0,paBm:0,lotKadaster:0,publicPa:0,software:0,cadTools:0};
for(const [name,profile,expected] of [
 ['guest',{},base],
 ['old single rate',{priceAdjustmentPercent:-20},Object.fromEntries(Object.keys(base).map(k=>[k,-20]))],
 ['old category map',{adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{paBm:-20,lotKadaster:5,publicPa:0,software:10,cadTools:-5}},{...base,pa:-20,bmSbm:-20,syitPiawai:-20,paBm:-20,lotKadaster:5,software:10,cadTools:-5}],
 ['independent zero',{adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:0,bmSbm:0,syitPiawai:0,paBm:-30,lotKadaster:5}},{...base,paBm:-30,lotKadaster:5}],
 ['distinct rates',{adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:-10,bmSbm:-50,syitPiawai:25,paBm:10,lotKadaster:-20,publicPa:5,software:15,cadTools:-5}},{pa:-10,bmSbm:-50,syitPiawai:25,paBm:10,lotKadaster:-20,publicPa:5,software:15,cadTools:-5}],
 ['direct legacy aliases',{adminPriceAdjustmentOverride:true,adminPaPriceAdjustmentPercent:0,adminBmSbmPriceAdjustmentPercent:-12.345,adminSyitPiawaiPriceAdjustmentPercent:10,adminPaBmPriceAdjustmentPercent:-5},{...base,pa:0,bmSbm:-12.34,syitPiawai:10,paBm:-5,lotKadaster:-5}],
 ['managed profile precedence',{adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:0,bmSbm:-20,syitPiawai:5,paBm:0},priceAdjustmentByCategory:{pa:-90,bmSbm:-90,syitPiawai:-90}},{...base,bmSbm:-20,syitPiawai:5}]
])test('browser, trusted server and both admin pages agree: '+name,()=>{for(const resolve of resolvers())assert.deepEqual(plain(resolve(profile)),expected);});
test('membership still discounts only Software and CAD Tools; document rates are independent',()=>{
 const p={adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:-10,bmSbm:0,syitPiawai:20,paBm:5,lotKadaster:0,publicPa:0,software:10,cadTools:5},membershipBenefitActive:true,membershipBenefitExpiresAtMs:Date.now()+60000,membershipDiscountByCategory:{pa:99,bmSbm:99,syitPiawai:99,software:20,cadTools:10}};
 const expected={pa:-10,bmSbm:0,syitPiawai:20,paBm:5,lotKadaster:0,publicPa:0,software:-10,cadTools:-5};
 assert.deepEqual(plain(context(serverHelpers).azIdentityPriceAdjustments(p)),expected);assert.deepEqual(plain(context(browserHelpers+';this.resolve=profilePercents;').resolve(p)),expected);
});
function pricingFixture(){
 const cleanPremiumText=(v,n)=>String(v??'').trim().slice(0,n),getPremiumUser=()=>({}),azobssSafeJupemDownloadUrl=()=>'';
 const verified=raw=>raw.selectionToken==='verified-fixture'?{amount:raw.variant==='FULL_SHEET'?50:15,variant:raw.variant,downloadUrl:'https://example.invalid/file',jobId:'fixture-job',areaRatio:raw.variant==='FULL_SHEET'?1:.2}:null;
 const realStart=server.lastIndexOf('const allowedStates = new Set(['),realEnd=server.indexOf('const clientExpectedAmountSen',realStart);assert.ok(realStart>0&&realEnd>realStart);
 return context(serverHelpers+'\n'+fn(server,'azBuildAdminPaBmTestCheckout')+'\nfunction realPricing(rawItems,identity){\n'+server.slice(realStart,realEnd)+'\nreturn {items,totalAmount,amountSen,priceAdjustmentByCategory};\n}',{cleanPremiumText,getPremiumUser,azobssSafeJupemDownloadUrl,azobssVerifiedLotCheckout:verified,res:{},send:(_r,status,body)=>{throw Object.assign(new Error(JSON.parse(body).error),{statusCode:status});}});
}
const types=['PA','BM','SBM','SYIT_PIAWAI','GPS','NDCDB','NDCDB_C3'];
function items(){return types.map((productType,i)=>({productType,itemCode:productType==='PA'?'PA1234.TIF':'FIXTURE'+i,negeri:'JOHOR',variant:'FULL_SHEET',selectionToken:'verified-fixture',amount:.01,baseAmount:.01,priceAdjustmentCategory:'software',priceAdjustmentPercent:-99}));}
test('real customer checkout and admin test use trusted rates by document type and ignore client prices/categories',()=>{
 const c=pricingFixture(),identity={uid:'fixture',adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:-10,bmSbm:-50,syitPiawai:25,paBm:10,lotKadaster:-20,publicPa:5,software:-99}};
 const expected=[['pa',4.5],['bmSbm',1.5],['bmSbm',1.5],['syitPiawai',8.75],['paBm',9.9],['lotKadaster',40],['lotKadaster',40]];
 for(const result of [c.realPricing(items(),identity),c.azBuildAdminPaBmTestCheckout({items:items()},identity)]){
  assert.deepEqual(plain(result.items.map(p=>[p.priceAdjustmentCategory,p.amount])),expected);assert.equal(result.amountSen,10615);assert.equal(result.totalAmount,106.15);
 }
 const bad=items();bad[0].productType='software';assert.throws(()=>c.realPricing(bad,identity),/Unsupported JUPEM/);
 const noSelection=items();noSelection[5].selectionToken='client-forged';assert.throws(()=>c.realPricing(noSelection,identity),/selection is missing/);
});
test('browser cart recalculates old group rates by type while preserving a resumed bill amount',()=>{
 const map={pa:-10,bmSbm:-50,syitPiawai:25,paBm:10,lotKadaster:-20};let stored=JSON.stringify(items().map((x,i)=>({...x,baseAmount:[5,3,3,7,9,50,50][i],amount:1,priceAdjustmentCategory:'paBm',addedAtMs:Date.now()})));
 const code=storefront.slice(storefront.indexOf('const JUPEM_PRICE_KEYS'),storefront.indexOf('async function getPaBmAuthToken'))+fn(storefront,'baseProductPrice')+'\n'+fn(storefront,'readCart');
 const c=context(code,{getCachedPriceAdjustment:k=>({percent:map[k]}),CART_MAX_AGE_MS:60000,MAX_CART_ITEMS:50,PRODUCT_TYPES:new Set(types),cartKey:()=> 'fixture',selectionAreaRatio:()=>0,localStorage:{getItem:()=>stored,setItem:(_k,v)=>{stored=v;}},applyPriceAdjustment:context(serverHelpers).azApplyUserPriceAdjustment});
 // Use the actual browser amount helper, whose signature takes a percent.
 vm.runInContext(fn(browser.replace('export function applyPriceAdjustment','function applyPriceAdjustment'),'applyPriceAdjustment'),c);
 vm.runInContext(fn(browser,'normalisePercent'),c);
 assert.deepEqual(plain(c.readCart().map(x=>[x.priceAdjustmentCategory,x.amount])),[['pa',4.5],['bmSbm',1.5],['bmSbm',1.5],['syitPiawai',8.75],['paBm',9.9],['lotKadaster',40],['lotKadaster',40]]);
 stored=JSON.stringify([{...items()[0],amount:4,baseAmount:5,restoredFromPending:true,resumeOrderId:'existing',resumePaymentUrl:'https://example.invalid/bill'}]);assert.equal(c.readCart()[0].amount,4);
 const initCode=storefront.slice(storefront.indexOf('const JUPEM_PRICE_KEYS'),storefront.indexOf('async function getPaBmAuthToken'));
 const f=context(initCode,{getCachedPriceAdjustment:()=>({percent:0})});assert.deepEqual(plain(f.jupemPricePercents({percentByCategory:{paBm:-20,pa:0}})),{pa:0,bmSbm:-20,syitPiawai:-20,paBm:-20,lotKadaster:-20});
});
for(const file of admins)test(file+' saves independent rates, reloads the same values, and rejects invalid input',async()=>{
 const src=read(file),writes=[],notices=[],nodes={};const node=id=>nodes[id]??={value:'',classList:{add(){},remove(){}}};
 const profile={docId:'fixture',username:'fixture',role:'user',adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:-10,bmSbm:0,syitPiawai:15,paBm:-20,lotKadaster:5,publicPa:0,software:2,cadTools:3}};
 const c=context(adminHelpers(src)+'\n'+fn(src,'openRegisteredEdit')+'\n'+fn(src,'saveRegisteredEdit'),{$:s=>node(s),adminRegisteredUsersCache:[profile],azRegCloseActionMenus(){},azRegUser:x=>x.username,azRegUid:()=>'',azRegRole:x=>x.role,azRegLoginMethod:()=> 'normal',azRegPaAllowed:()=>true,azRegFoodOrdersAllowed:()=>false,azRegRenderMembershipAdmin(){},toast:x=>notices.push(x),db:{},doc:(_db,col,id)=>({col,id}),serverTimestamp:()=> 'fixture-timestamp',updateDoc:async(ref,body)=>{writes.push({ref,body:plain(body)});Object.assign(profile,plain(body));},loadRegisteredUsersAdmin:async()=>{}});
 c.openRegisteredEdit('fixture');assert.equal(node('#azRegEditPriceBmSbm').value,'0');assert.equal(node('#azRegEditPricePa').value,'-10');assert.equal(node('#azRegEditPriceSyitPiawai').value,'15');
 await c.saveRegisteredEdit();assert.equal(writes.length,1);assert.equal(writes[0].body.adminPriceAdjustmentByCategory.bmSbm,0);assert.equal(writes[0].body.adminPaPriceAdjustmentPercent,-10);assert.equal(writes[0].body.adminSyitPiawaiPriceAdjustmentPercent,15);c.openRegisteredEdit('fixture');assert.equal(node('#azRegEditPriceBmSbm').value,'0');
 for(const v of ['-100','501','bad-number']){node('#azRegEditPricePa').value=v;await c.saveRegisteredEdit();}assert.equal(writes.length,1);assert.equal(notices.length,3);
 for(const id of ['Pa','BmSbm','SyitPiawai','LotKadaster','PaBm','PublicPa','Software','Cad'])assert.match(src,new RegExp('label for="azRegEditPrice'+id+'"'));
});
test('an explicit 0 survives duplicate UID profile merging instead of resurrecting an inherited discount',()=>{
 const src=read('admin/index.html');const c=context(adminHelpers(src)+'\n'+fn(src,'azRegMergeIdentityRecords'),{azRegDateValue:r=>r.createdAtMs||0,azRegRoleRank:()=>1,azRegRole:()=> 'user',azRegUid:r=>r.uid||'',azRegEmail:()=>'',azRegFoodOrdersAllowed:()=>false,azRegPaAllowed:()=>false,azRegMembershipInfo:()=>({active:false})});
 const merged=c.azRegMergeIdentityRecords([{uid:'same',createdAtMs:200,priceAdjustmentByCategory:{paBm:-20}},{uid:'same',createdAtMs:100,priceAdjustmentUpdatedAtMs:300,adminPriceAdjustmentOverride:true,adminPriceAdjustmentByCategory:{pa:0,bmSbm:0,syitPiawai:0,paBm:-20}}]);
 const p=c.azRegPricePercents(merged);assert.equal(p.pa,0);assert.equal(p.bmSbm,0);assert.equal(p.syitPiawai,0);assert.equal(p.paBm,-20);
});
test('classic cart fallbacks identify separate categories before module startup',()=>{
 for(const src of [read('assets/js/azobss-pabm-cart-core.js'),read('PA-BM/index.html')]){
  const start=src.indexOf('  function normalizeType('),end=src.indexOf('  function readKey(',start);const c=context(src.slice(start,end),{VALID_TYPES:Object.fromEntries(types.map(t=>[t,1]))});assert.deepEqual(types.map(t=>c.normalizeItem({productType:t,itemCode:'123',negeri:'JOHOR',variant:'FULL_SHEET'}).priceAdjustmentCategory),['pa','bmSbm','bmSbm','syitPiawai','paBm','lotKadaster','lotKadaster']);
 }
});
