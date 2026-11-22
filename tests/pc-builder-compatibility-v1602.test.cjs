const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const builder=require('../assets/js/azobss-pc-builder-v1546'),compat=require('../assets/js/azobss-pc-compatibility');
const snapshot=JSON.parse(fs.readFileSync(require.resolve('../PC-Build/viewnet-storefront-v1526.json'),'utf8')).products;
const templates=JSON.parse(fs.readFileSync(require.resolve('../PC-Build/pc-full-builder-fallback.json'),'utf8')).categories;
const policy={ok:true,hiddenProductIds:[],hiddenStoreIds:[]};
const item=(cat,label,specs=[],extra={})=>({cat,p:{id:cat+'-'+label,label,specs,...extra},qty:1,lineIndex:0});
const has=(entries,code)=>compat.inspect(entries).issues.some(i=>i.level==='error'&&i.code===code);
test('partial price refresh cannot empty processor or motherboard quote selections',()=>{
 const live=snapshot.filter(p=>!['Intel CPUs','AMD CPUs','Intel Motherboards','AMD Motherboards'].includes(p.category));
 const before=builder.catalog(snapshot,templates),after=builder.catalog(builder.mergeProducts(snapshot,live,policy),templates);
 for(const id of ['intel-cpu','amd-cpu','intel-mobo','amd-mobo'])assert.deepEqual(after.categories.find(c=>c.id===id).options.map(p=>p.id),before.categories.find(c=>c.id===id).options.map(p=>p.id),id);
 assert.ok(after.categories.find(c=>c.id==='hdd').options.length>0);
});
test('reference merging honors hidden variants, hidden records, hidden supplier and explicit unavailable rows',()=>{
 const refs=snapshot.slice(0,3),hide={...policy,hiddenProductIds:[refs[0].id.toLowerCase(),refs[1].sourceRecordId.toLowerCase()]};
 assert.ok(builder.mergeProducts(refs,[],hide).every(p=>p.id!==refs[0].id&&p.sourceRecordId!==refs[1].sourceRecordId));
 assert.equal(builder.mergeProducts(refs,[],{...policy,hiddenStoreIds:['viewnet']}).length,0);
 assert.ok(!builder.mergeProducts(refs,[{...refs[2],availability:'unavailable'}],policy).some(p=>p.id===refs[2].id));
});
test('normalized API category aliases do not silently remove CPUs, boards, drives or monitors',()=>{
 for(const [category,name,expected] of [['CPUs','Intel Core i5-12400','intel-cpu'],['CPU','AMD Ryzen 5 7600','amd-cpu'],['Motherboards','ASUS B650M-K','amd-mobo'],['Motherboards','MSI B760M D4','intel-mobo'],['LCD Monitors','AOC 24 inch','monitor'],['Portable Hard Drives','USB 2TB','hdd']])assert.equal(builder.categoryFor({category,name}),expected,name);
});
test('reference price dates stay intact; only a dated newer price or live price replaces them',()=>{
 const a={...snapshot[0],price:123,priceCheckedAt:'2026-11-14'},old={...a,price:50,priceCheckedAt:'2026-11-05'};
 const kept=builder.mergeProducts([a],[old],policy)[0];assert.equal(kept.price,123);assert.equal(kept.priceCheckedAt,'2026-11-14');assert.equal(kept.requiresConfirmation,true);
 assert.equal(builder.mergeProducts([a],[{...old,priceStatus:'live'}],policy)[0].price,50);
});
test('socket and platform mismatch is blocked in either direction, same socket still requires BIOS review',()=>{
 const cpu=item('intel-cpu','Intel Core i5-12400F'),am=item('amd-mobo','ASUS B650M-K'),im=item('intel-mobo','MSI B760M DDR4');
 assert.equal(compat.fit(am.cat,am.p,[cpu]).ok,false);assert.equal(compat.fit(cpu.cat,cpu.p,[am]).ok,false);
 assert.equal(compat.fit(im.cat,im.p,[cpu]).ok,true);assert.ok(compat.inspect([cpu,im]).warnings.some(s=>/BIOS/.test(s)));
 assert.equal(compat.fit('intel-mobo',item('intel-mobo','ASUS B860M').p,[cpu]).ok,false);
 assert.equal(compat.cpuSocket('Intel Core Ultra 5 245K'),'LGA1851');assert.equal(compat.cpuSocket('AMD Ryzen 7 5700X3D'),'AM4');
});
test('DDR generation, laptop DIMMs and registered desktop memory cannot be mixed',()=>{
 const board=item('intel-mobo','ASUS B760M D4'),r4=item('ram','Kingston DDR4 16GB'),r5=item('ram','Kingston DDR5 16GB');
 assert.equal(compat.fit('ram',r5.p,[board]).ok,false);assert.equal(compat.fit('ram',r4.p,[board]).ok,true);
 assert.equal(compat.fit('ram',item('ram','DDR4 SO-DIMM 16GB').p,[board]).ok,false);
 assert.equal(compat.fit('ram',item('ram','DDR4 RDIMM 16GB').p,[board]).ok,false);
 assert.ok(has([r4,{...r5,lineIndex:1}],'ram-mix'));
});
test('RAM kits count modules, capacity and quantity against motherboard limits',()=>{
 const board=item('intel-mobo','B760M DDR4',['Memory slots: 2 x DDR4 DIMM slots','Maximum memory: 64GB']),kit=item('ram','DDR4 32GB (2x16GB)');
 assert.equal(compat.fit('ram',kit.p,[board],{qty:1}).ok,true);assert.equal(compat.fit('ram',kit.p,[board],{qty:2}).ok,false);
 const large=item('ram','DDR4 128GB (2x64GB)');assert.ok(has([board,large],'ram-capacity'));
});
test('cooler mounting compatibility uses actual socket lists',()=>{
 const cpu=item('intel-cpu','Intel Core i5-12400'),cool=item('cooler','AM4 cooler',['Supported sockets: AM4 / AM5']);
 assert.equal(compat.fit('cooler',cool.p,[cpu]).ok,false);
 const fit=item('cooler','Dual platform cooler',['CPU socket support: LGA1700, AM4, AM5']);assert.equal(compat.fit('cooler',fit.p,[cpu]).ok,true);
});
test('mid-tower names do not invent radiator support; explicit case support rejects wrong radiator and height',()=>{
 const cs=item('case','Generic Mid Tower'),aio=item('cooler','AIO 360',{},{section:'Liquid Cooling'});aio.p.specs=['Radiator size: 360'];
 assert.equal(compat.fit('cooler',aio.p,[cs]).ok,true);assert.ok(compat.inspect([cs,aio]).warnings.some(s=>/radiator/.test(s)));
 const small=item('case','Small case',['Radiator support: 120, 240 mm','CPU cooler height: 155 mm']);assert.equal(compat.fit('cooler',aio.p,[small]).ok,false);
 assert.equal(compat.fit('cooler',item('cooler','Tower cooler',['Height: 165 mm']).p,[small]).ok,false);
});
test('motherboard form factor, GPU length and PSU form factor use case specifications',()=>{
 const cs=item('case','Compact case',['Motherboard support: Mini-ITX','GPU clearance: 280 mm','PSU support: SFX']);
 assert.equal(compat.fit('intel-mobo',item('intel-mobo','ATX B760 motherboard').p,[cs]).ok,false);
 assert.equal(compat.fit('gpu',item('gpu','RTX board',['Card length: 305 mm']).p,[cs]).ok,false);
 assert.equal(compat.fit('psu',item('psu','700W PSU',['Form factor: ATX']).p,[cs]).ok,false);
});
test('GPU PSU limits work regardless of selection order and 5060Ti does not require an invented 650W minimum',()=>{
 const gpu=item('gpu','ZOTAC RTX5060Ti 16GB'),small=item('psu','550W PSU'),enough=item('psu','600W PSU');
 assert.equal(compat.fit('gpu',gpu.p,[small]).ok,false);assert.equal(compat.fit('psu',small.p,[gpu]).ok,false);assert.equal(compat.fit('gpu',gpu.p,[enough]).ok,true);
 const specific=item('gpu','RTX5060Ti custom',['Recommended PSU: 650 W']);assert.equal(compat.fit('gpu',specific.p,[enough]).ok,false);
});
test('storage slot and port counts reject excess drives, not PCIe generation alone',()=>{
 const board=item('intel-mobo','B760 DDR5',['NVMe slots: 1','SATA ports: 2']),ssd=item('ssd','Gen5 NVMe 1TB',[],{section:'NVMe SSDs'});
 assert.equal(compat.fit('ssd',ssd.p,[board],{qty:1}).ok,true);assert.equal(compat.fit('ssd',ssd.p,[board],{qty:2}).ok,false);
 const sata=item('hdd','SATA 2TB',[],{section:'Hard Drives'});assert.equal(compat.fit('hdd',sata.p,[board],{qty:3}).ok,false);
 assert.equal(compat.fit('ssd',ssd.p,[item('intel-mobo','Old board',['NVMe slots: 0'])]).ok,false);
});
test('a CPU without graphics can be selected first but an incomplete display path prevents a final quote',()=>{
 const cpu=item('intel-cpu','Intel Core i5-12400F');assert.equal(compat.fit(cpu.cat,cpu.p,[]).ok,true);assert.ok(has([cpu],'display'));
 assert.equal(has([cpu,item('gpu','RTX5060')],'display'),false);assert.equal(has([item('intel-cpu','Intel Core i5-12400')],'display'),false);
});
test('actual builder selection and copied spec retain the CPU after partial API refresh without dealer wording',()=>{
 const html=fs.readFileSync(require.resolve('../PC-Build/Build-Sendiri/index.html'),'utf8'),code=html.slice(html.indexOf("const API='"),html.indexOf('const builderHeader='));
 const els=new Map(),element=id=>{if(!els.has(id))els.set(id,{innerHTML:'',textContent:'',hidden:false,disabled:false,classList:{add(){},remove(){},toggle(){},contains(){return false;}}});return els.get(id);};
 const ctx={Map,Set,URL,Date,Number,String,Math,Intl,console,document:{body:{dataset:{},classList:{contains:()=>false}},querySelector:element,querySelectorAll:()=>[]},window:{AZOBSSPcBuilder1546:builder,AZOBSSPcCompatibility:compat}};
 vm.runInNewContext(code+"globalThis.app={init(rows){CATALOG=window.AZOBSSPcBuilder1546.catalog(rows,BUILDER_TEMPLATES);normalizeCatalog();ensureState();sanitizeLoadedState();},chooseProduct,specText,get:()=>STATE.lines,fit:optionCompatibility};",ctx);
 ctx.app.init(snapshot);const id='VNP-ca9647a4cfea--0';ctx.app.chooseProduct('intel-cpu',0,id);assert.equal(ctx.app.get()['intel-cpu'][0].productId,id);
 ctx.app.init(builder.mergeProducts(snapshot,snapshot.filter(p=>p.category!=='Intel CPUs'),policy));assert.equal(ctx.app.get()['intel-cpu'][0].productId,id);
 assert.match(ctx.app.specText(),/12400/);assert.doesNotMatch(ctx.app.specText(),/viewnet|pricelist|dealer/i);
});
