const {test}=require('node:test'),assert=require('node:assert/strict');
const service=import('../backend/lucky-draw-prize-store.js');
function database(){const docs=new Map();const db={collection:name=>({doc:key=>({key:name+'/'+key,get:async()=>snapshot(name+'/'+key),set:async value=>docs.set(name+'/'+key,structuredClone(value))})}),runTransaction:async fn=>fn({get:async ref=>snapshot(ref.key),set:(ref,value)=>docs.set(ref.key,structuredClone(value))})};const snapshot=key=>({exists:docs.has(key),data:()=>structuredClone(docs.get(key))});return {db,docs};}
test('Firestore prize survives a fresh process/store with no local files, preserving full gallery order and explicit empty gallery',async()=>{
 const {createPrizeStore}=await service,{db}=database(),options={db,getFile:()=> 'gone.json',readJson:(_,fallback)=>fallback};
 const store=createPrizeStore(options),prize={title:'Current prize',imageUrls:['https://example.com/b.jpg','https://example.com/a.jpg'],imageUrl:'https://example.com/b.jpg',description:'Details'};
 await store.save('2026-10',prize);assert.equal(store.storage,'firestore');assert.deepEqual(await createPrizeStore(options).get('2026-10'),{...prize,monthKey:'2026-10'});
 await store.save('2026-10',{...prize,imageUrls:[],imageUrl:''});assert.deepEqual((await createPrizeStore(options).get('2026-10')).imageUrls,[]);
});
test('legacy local prizes migrate once and never replace a newer durable prize or cross month boundaries',async()=>{
 const {createPrizeStore}=await service,{db,docs}=database(),local={monthKey:'2026-10',title:'Legacy',imageUrls:['old']},store=createPrizeStore({db,getFile:key=>key,readJson:()=>local});
 assert.equal((await store.get('2026-10')).title,'Legacy');assert.equal(docs.size,1);await store.save('2026-10',{title:'New',imageUrls:['new']});assert.equal((await store.get('2026-10')).title,'New');assert.equal(await store.get('2026-11',null),null);
});
test('configured database failure is reported without quietly saving to temporary files',async()=>{
 const {createPrizeStore}=await service,store=createPrizeStore({db:{collection:()=>({doc:()=>({get:async()=>{throw Error('offline');},set:async()=>{throw Error('offline');}})})},getFile:()=>assert.fail('temporary fallback used'),readJson:()=>assert.fail('temporary fallback used')});
 await assert.rejects(()=>store.save('2026-10',{title:'Prize'}),/offline/);await assert.rejects(()=>store.get('2026-10'),/offline/);
});
test('invalid month cannot choose a filesystem path or document ID',async()=>{
 const {createPrizeStore}=await service,store=createPrizeStore({getFile:()=>assert.fail('invalid key used'),readJson:()=>{}});
 for(const key of ['../secret','2026-13','x','2026-1']){await assert.rejects(()=>store.get(key),error=>error.status===400);await assert.rejects(()=>store.save(key,{}),error=>error.status===400);}
});
