const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const purchase=import('../backend/lucky-draw-purchase.js'),model=import('../backend/lucky-draw-model.js'),settings=import('../backend/lucky-draw-settings.js');
const buyer='qa-buyer-1550',paid=()=>({orderId:'QA-PAID-1550',user:{uid:buyer},product:{licenseProduct:'solattime',fulfilment:'solattime'},status:'paid',amountSen:3900,paymentVerifiedAt:'2026-10-01T00:00:00Z'});
test('only a private verified paid Liyabudun order owned by the signed-in UID qualifies',async()=>{
 const {qualifyingPurchase:q}=await purchase;assert.equal(q(paid(),buyer),true);assert.equal(q(paid(),'another-user'),false);
 for(const patch of [{status:'pending'},{status:'refunded'},{paymentStatus:'refunded'},{paymentVerifiedAt:''},{amountSen:0},{amountSen:3900.5},{deleted:true},{isAdminTestPayment:true},{testPayment:true},{testMode:true},{refundedAt:'date'},{chargebackAt:'date'},{product:{id:'AZSW-372165',name:'Liyabudun'}},{product:{licenseProduct:'other',fulfilment:'solattime'}},{user:{uid:'someone-else'}}])assert.equal(q({...paid(),...patch},buyer),false,JSON.stringify(patch));
 assert.equal(q({...paid(),paymentVerifiedAt:'',toyyibVerifiedAt:'date'},buyer),true);assert.equal(q({...paid(),paymentVerifiedAt:'',stripeVerifiedAt:'date'},buyer),true);
});
test('Firestore purchase lookup paginates the signed UID only and reveals no licence, amount or email',async()=>{
 const {createPurchaseChecker}=await purchase;let gets=0;const secret={serial:'NEVER-PUBLIC',email:'private@example.invalid'};
 const query={where(field,op,uid){assert.equal(field,'user.uid');assert.equal(uid,buyer);return this;},orderBy(name){assert.equal(name,'__name__');return this;},limit(n){assert.equal(n,100);return this;},startAfter(){return this;},async get(){gets++;return {docs:gets===1?Array.from({length:100},(_,i)=>({id:'pending-'+i,data:()=>({...paid(),status:'pending'})})):[{id:'QA-FOUND',data:()=>({...paid(),...secret})}]};}};
 const find=createPurchaseChecker({getDb:()=>({collection(name){assert.equal(name,'premiumOrders');return query;}})});
 assert.deepEqual(await find({uid:buyer}),{orderId:'QA-FOUND'});assert.equal(gets,2);assert.equal(await find({}),null);
});
test('purchase failures are propagated and no client share or local flags are consulted',async()=>{
 const {createPurchaseChecker}=await purchase;const find=createPurchaseChecker({getDb:()=>({collection(){throw Error('offline');}})});await assert.rejects(()=>find({uid:buyer}),/offline/);
 const local=createPurchaseChecker({getDb:()=>null,readOrders:()=>[paid()]});assert.deepEqual(await local({uid:buyer}),{orderId:'QA-PAID-1550'});assert.equal(await local({uid:'other'}),null);
});
test('legacy share settings cannot bypass the purchase rule; old free-entry terms are migrated',async()=>{
 const {validateSettings,DEFAULTS}=await model;const c=validateSettings({shareRequired:true,termsEn:'One entry per account. Winners will be contacted by AZOBSS. No purchase is required to enter.'});assert.equal(c.shareRequired,false);assert.equal(c.termsEn,DEFAULTS.termsEn);assert.ok(c.termsEn.includes('verified payment'));assert.equal(validateSettings({titleMs:'Owner campaign'}).titleMs,'Owner campaign');
});
test('draw rechecks purchase truth, excludes legacy unpaid entries, deduplicates UIDs and locks a concurrent result',async()=>{
 const {createDrawRunner}=await settings;let winner=null,calls=0,refund=false;const rows=[{usernameKey:'first',uid:buyer,monthKey:'2026-11'},{usernameKey:'alias',uid:buyer,monthKey:'2026-11'},{usernameKey:'unpaid',uid:'no-purchase',monthKey:'2026-11'},{usernameKey:'refund',uid:'refunded',monthKey:'2026-11'},{usernameKey:'no-uid',monthKey:'2026-11'}];
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'azobss-lucky-1550-'));const file=path.join(dir,'winner.json');
 try{
  const config={...(await model).DEFAULTS,minParticipants:1,scheduleMode:'manual'},runner=createDrawRunner({settings:{get:async()=>({config})},readJson:(p,fallback)=>p===file?(fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):fallback):rows,getWinnerFile:()=>file,getEntriesFile:()=>path.join(dir,'entries.json'),now:()=>Date.parse('2026-11-07T12:00:00+08:00'),findPurchase:async({uid})=>{await new Promise(resolve=>setTimeout(resolve,2));return uid===buyer&&!refund?{orderId:'paid'}:null;},randomInt:size=>{calls++;assert.equal(size,1);return 0;}});
  const results=await Promise.all(Array.from({length:8},()=>runner.run('2026-11')));assert.equal(calls,1);assert.equal(results[0].winner.usernameKey,'first');assert.equal(results[0].winner.participantTotal,1);assert.equal(new Set(results.map(r=>r.winner.drawId)).size,1);
  refund=true;assert.equal((await runner.run('2026-11')).alreadySelected,true);assert.equal(calls,1);
 }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(require('node:os').tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});
test('draw without a purchase verifier fails closed even if an entry claims purchaseVerified',async()=>{
 const {createDrawRunner}=await settings,{DEFAULTS}=await model;
 const runner=createDrawRunner({settings:{get:async()=>({config:{...DEFAULTS,minParticipants:1}})},readJson:(file,f)=>file==='winner'?f:[{usernameKey:'fake',uid:buyer,monthKey:'2026-11',purchaseVerified:true}],getWinnerFile:()=>'winner',getEntriesFile:()=>'entries',now:()=>Date.parse('2026-11-07T12:00:00+08:00')});await assert.rejects(()=>runner.run('2026-11'),e=>e.status===409);
});
async function routes(){
 const source=fs.readFileSync(path.join(__dirname,'../backend/server.js'),'utf8'),{DEFAULTS,validateSettings,scheduledAt}=await model,{PURCHASE_POLICY,createPurchaseChecker}=await purchase;
 let identity={uid:buyer,username:'qa-buyer',emailVerified:true},orders=[],entries=[];const handlers={};
 const sandbox={app:{post:(route,...fn)=>handlers['POST '+route]=fn.at(-1),get:(route,...fn)=>handlers['GET '+route]=fn.at(-1),delete:(route,...fn)=>handlers['DELETE '+route]=fn.at(-1)},requireAdmin:()=>{},PURCHASE_POLICY,luckyPurchase:createPurchaseChecker({getDb:()=>null,readOrders:()=>orders}),getFirebaseAdminIdentity:async()=>identity,luckySettings:{get:async()=>({config:{...DEFAULTS,scheduleMode:'manual'}})},monthKey:()=> '2026-11',scheduledAt,cleanShareUsername:x=>String(x||'').toLowerCase(),cleanText:(x,n)=>String(x||'').slice(0,n),getClientIp:()=> '192.0.2.15',useLuckyDrawFirestore:()=>false,getEntriesFile:()=> 'entries',getWinnerFile:()=> 'winner',readJson:(file,fallback)=>file==='entries'?entries:fallback,writeJson:(file,value)=>{assert.equal(file,'entries');entries=value;},logLuckyDrawAbuse:()=>{},Date};
 vm.createContext(sandbox);
 for(const [start,end] of [['app.get("/api/lucky-draw/eligibility"','app.get("/api/lucky-draw/settings"'],['app.post("/api/lucky-draw/entries"','app.patch("/api/lucky-draw/entries/:id"'],['app.delete("/api/lucky-draw/winner"','// Best effort while']]){const a=source.indexOf(start);assert.ok(a>=0);vm.runInContext(source.slice(a,source.indexOf(end,a)),sandbox);}
 return {identity:v=>identity=v,orders:v=>orders=v,entries:()=>entries,async call(key,body={}){let status=200,value;const req={body,query:{},get:()=> 'QA'},res={setHeader(){},status(n){status=n;return this;},json(v){value=v;return this;}};await handlers[key](req,res);return {status,value};}};
}
test('actual join handler blocks forged paid/share claims, other accounts, guests and unverified emails',async()=>{
 const r=await routes();let result=await r.call('POST /api/lucky-draw/entries',{uid:buyer,purchaseVerified:true,paid:true,productShareConfirmed:true,deviceFingerprint:'qa-device'});assert.equal(result.status,403);assert.equal(result.value.code,'LIYABUDUN_PURCHASE_REQUIRED');assert.equal(r.entries().length,0);
 r.orders([paid()]);r.identity({uid:'other',username:'other',emailVerified:true});assert.equal((await r.call('POST /api/lucky-draw/entries',{})).status,403);
 r.identity(null);assert.equal((await r.call('POST /api/lucky-draw/entries',{})).status,401);
 r.identity({uid:buyer,username:'qa-buyer',emailVerified:false});assert.equal((await r.call('POST /api/lucky-draw/entries',{})).value.code,'EMAIL_VERIFICATION_REQUIRED');
});
test('actual eligibility/join handlers accept a confirmed buyer once and expose no private purchase data',async()=>{
 const r=await routes();r.orders([paid()]);const eligibility=await r.call('GET /api/lucky-draw/eligibility');assert.equal(eligibility.status,200);assert.equal(eligibility.value.eligible,true);assert.equal(JSON.stringify(eligibility.value).includes('QA-PAID'),false);
 const request={usernameKey:'qa-buyer',deviceFingerprint:'qa-device',uid:'forged-other'};assert.equal((await r.call('POST /api/lucky-draw/entries',request)).status,200);assert.equal(r.entries()[0].uid,buyer);assert.equal(r.entries()[0].purchaseOrderId,'QA-PAID-1550');assert.equal((await r.call('POST /api/lucky-draw/entries',request)).status,409);
 r.orders([{...paid(),status:'refunded'}]);assert.equal((await r.call('GET /api/lucky-draw/eligibility')).value.eligible,false);
});
test('official result deletion is refused by the actual handler',async()=>{
 const r=await routes(),result=await r.call('DELETE /api/lucky-draw/winner');assert.equal(result.status,409);assert.equal(result.value.code,'OFFICIAL_RESULT_LOCKED');
});
test('participant identity and purchase proof cannot be rewritten through the admin editor',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../backend/server.js'),'utf8'),start=source.indexOf('app.patch("/api/lucky-draw/entries/:id"'),end=source.indexOf('app.delete("/api/lucky-draw/entries/:id"',start),route=source.slice(start,end);
 let handler;const sandbox={app:{patch:(route,...fn)=>handler=fn.at(-1)},requireAdmin:()=>{},monthKey:()=> '2026-11'};vm.createContext(sandbox);vm.runInContext(route,sandbox);
 return Promise.all(['uid','usernameKey','purchaseOrderId','purchasePolicy','deleted','joinedAtMs'].map(async field=>{let status=200;const res={status(n){status=n;return this;},json(){}};await handler({body:{[field]:'forged'},query:{}},res);assert.equal(status,400,field);}));
});
