const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const model=import('../backend/lucky-draw-model.js'),service=import('../backend/lucky-draw-settings.js');
test('settings reject invalid ranges, unknown fields and CSS injection; presets retain safe defaults',async()=>{
 const {validateSettings,DEFAULTS}=await model;assert.deepEqual(validateSettings({}),DEFAULTS);
 for(const value of [{minParticipants:0},{minShares:11},{drawHour:24},{drawDay:29},{spinSeconds:2},{registrationOpen:'false'},{accent:'red;url(x)'},{theme:'unknown'},{winner:'fixed'},{titleMs:''}])assert.throws(()=>validateSettings(value));
 assert.equal(validateSettings({registrationOpen:false,theme:'royal',accent:'#123ABC'}).registrationOpen,false);
});
test('Malaysia schedule handles last day, leap year, midnight, month boundaries and manual mode',async()=>{
 const {DEFAULTS,scheduledAt,nextScheduledAt,malaysiaMonth}=await model;
 assert.equal(scheduledAt(DEFAULTS,'2028-02'),Date.parse('2028-02-29T22:00:00+08:00'));
 assert.equal(scheduledAt({...DEFAULTS,drawDay:1,drawHour:0},'2026-10'),Date.parse('2026-10-01T00:00:00+08:00'));
 assert.equal(malaysiaMonth(Date.parse('2026-10-31T16:00:00Z')),'2026-11');
 assert.equal(nextScheduledAt(DEFAULTS,Date.parse('2026-12-31T23:00:00+08:00')),Date.parse('2027-01-31T22:00:00+08:00'));
 assert.equal(scheduledAt({...DEFAULTS,scheduleMode:'manual'},'2026-10'),null);
});
test('one account has one chance, deleted and other-month participants are excluded',async()=>{
 const {eligibleEntries}=await model;const rows=[{usernameKey:'a',uid:'one',monthKey:'2026-10'},{usernameKey:'alias',uid:'one',monthKey:'2026-10'},{usernameKey:'b',monthKey:'2026-10',deleted:true},{usernameKey:'c',monthKey:'2026-09'},{usernameKey:'d',monthKey:'2026-10'}];assert.deepEqual(eligibleEntries(rows,'2026-10').map(row=>row.usernameKey),['a','d']);
});
test('public projections never expose email, phone, uid, device or IP',async()=>{
 const {publicEntry,publicWinner}=await model;const privateRow={id:'entry',name:'Name',usernameKey:'name',uid:'private',phone:'private',contactEmail:'private',ipAddress:'private',deviceFingerprint:'private',monthKey:'2026-10',selectedAt:'date'};
 for(const result of [publicEntry(privateRow),publicWinner(privateRow)])assert.ok(!JSON.stringify(result).includes('private'));assert.equal(publicEntry(null),null);
});
function temporary(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'azobss-lucky-qa-'));t.after(()=>{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});});return directory;}
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file));}catch{return fallback;}};
test('JSON settings use optimistic revisions and preserve a private bounded edit record',async t=>{
 const {createSettingsStore}=await service,dir=temporary(t),file=path.join(dir,'settings.json'),store=createSettingsStore({file,readJson});
 assert.equal((await store.get()).revision,0);await store.save({minParticipants:2},0,'admin');await assert.rejects(()=>store.save({minParticipants:9},0,'other'),error=>error.status===409);assert.equal((await store.get()).config.minParticipants,2);assert.ok(!JSON.stringify(await store.get()).includes('updatedBy'));assert.equal(readJson(file,{}).audit.length,1);
});
test('JSON draw enforces minimum, persists one cryptographic selection and ignores redraw attempts',async t=>{
 const {createSettingsStore,createDrawRunner,atomicJson}=await service,dir=temporary(t),now=()=>Date.parse('2026-10-24T12:00:00+08:00');
 const settings=createSettingsStore({file:path.join(dir,'settings.json'),readJson,now});await settings.save({minParticipants:2},0,'admin');
 const getWinnerFile=key=>path.join(dir,key+'-winner.json'),getEntriesFile=key=>path.join(dir,key+'-entries.json');
 const rows=[{usernameKey:'a',uid:'a',monthKey:'2026-10'},{usernameKey:'b',uid:'b',monthKey:'2026-10'}];let calls=0;
 const runner=createDrawRunner({settings,readJson,getWinnerFile,getEntriesFile,now,randomInt:size=>{calls++;assert.equal(size,2);return 1;}});
 await assert.rejects(()=>runner.run('2026-10'),error=>error.status===409);atomicJson(getEntriesFile('2026-10'),rows);
 await assert.rejects(()=>runner.run('2026-10','schedule'),error=>error.status===409);
 const results=await Promise.all(Array.from({length:10},()=>runner.run('2026-10')));assert.equal(calls,1);assert.equal(results[0].winner.usernameKey,'b');assert.ok(results.every(result=>result.winner.drawId===results[0].winner.drawId));assert.equal(results[0].winner.method,'crypto.randomInt');
 await assert.rejects(()=>runner.run('2026-09'),error=>error.status===400);
});
class Firestore{
 constructor(){this.values=new Map();this.queue=Promise.resolve();}
 collection(name){return {doc:id=>({key:name+'/'+id,get:async()=>this.snapshot(name+'/'+id)})};}
 snapshot(key){return {exists:this.values.has(key),data:()=>structuredClone(this.values.get(key))};}
 runTransaction(fn){const promise=this.queue.then(async()=>{const writes=[];const result=await fn({get:async ref=>ref.query?{docs:ref.rows().map((data,i)=>({id:String(i),data:()=>structuredClone(data)}))}:this.snapshot(ref.key),set:(ref,value,options)=>writes.push([ref.key,value,options])});for(const [key,value,options] of writes)this.values.set(key,{...(options?.merge?this.values.get(key):{}),...value});return result;});this.queue=promise.catch(()=>{});return promise;}
}
test('Firestore transaction serializes concurrent draws and keeps one immutable winner',async()=>{
 const {createSettingsStore,createDrawRunner}=await service,db=new Firestore(),now=()=>Date.parse('2026-10-24T12:00:00+08:00');
 const settings=createSettingsStore({db,now});await settings.save({minParticipants:2,scheduleMode:'manual'},0,'admin');
 const rows=[{usernameKey:'a',monthKey:'2026-10'},{usernameKey:'b',monthKey:'2026-10'}];let calls=0;
 const runner=createDrawRunner({db,settings,now,monthRef:key=>({key:'month/'+key}),winnerRef:key=>({key:'winner/'+key}),participantsRef:()=>({where:()=>({query:true,rows:()=>rows})}),randomInt:()=>{calls++;return 0;}});
 const results=await Promise.all(Array.from({length:12},()=>runner.run('2026-10')));assert.equal(calls,1);assert.equal(new Set(results.map(result=>result.winner.drawId)).size,1);assert.equal(db.values.get('month/2026-10').drawStatus,'closed');
});
test('concurrent Firestore settings edits accept one revision and reject a stale admin edit',async()=>{
 const {createSettingsStore}=await service,db=new Firestore(),settings=createSettingsStore({db});
 const results=await Promise.allSettled([settings.save({minParticipants:75},0,'first-admin'),settings.save({minParticipants:25},0,'other-admin')]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.status,409);assert.equal((await settings.get()).revision,1);assert.equal((await settings.get()).config.minParticipants,75);
});
