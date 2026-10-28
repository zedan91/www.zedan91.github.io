import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,randomBytes,verify} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const root=fileURLToPath(new URL('../',import.meta.url));
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const admin=randomBytes(32).toString('hex');let mf,db,ip=1;
const A='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64),D='d'.repeat(64);
before(async()=>{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:root+'src/worker.js',compatibilityDate:'2026-10-03',d1Databases:{DB:'solat-test'},bindings:{ADMIN_TOKEN:admin,LICENSE_SIGNING_KEY:privateKey.export({type:'pkcs8',format:'der'}).toString('base64'),PUBLIC_KEY:publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex')},assets:{directory:root+'public',binding:'ASSETS',assetConfig:{html_handling:'none'},routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}}}));
 db=await mf.getD1Database('DB');
 for(const sql of (await readFile(root+'migrations/0001_licenses.sql','utf8')).split(/;\s*(?=CREATE|$)/i))if(sql.trim())await db.prepare(sql).run();
 await db.prepare(await readFile(root+'migrations/0002_trials.sql','utf8')).run();
 for(const sql of (await readFile(root+'migrations/0003_purchase_issues.sql','utf8')).split(';'))if(sql.trim())await db.prepare(sql).run();
 for(const sql of (await readFile(root+'migrations/0004_license_management.sql','utf8')).split(';'))if(sql.trim())await db.prepare(sql).run();
});
after(async()=>{await mf?.dispose();});
async function post(path,body={},headers={}){
 const response=await mf.dispatchFetch('https://test.local'+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+(ip++%250+1),...(path.startsWith('/admin/')?{Authorization:'Bearer '+admin}:{}),...headers},body:JSON.stringify(body)});
 return {status:response.status,value:await response.json()};
}
function response(value){
 const raw=Buffer.from(value.response.payload,'base64');assert.ok(verify(null,raw,publicKey,Buffer.from(value.response.signature,'base64')));return JSON.parse(raw);
}
const body=(machine,extra={})=>({machine,product:'azobss-solattime',nonce:randomBytes(32).toString('hex'),...extra});
async function issue(){const r=await post('/admin/issue',{customer:'Isolated test'});assert.equal(r.status,200);return r.value;}
const activate=(serial,machine,extra={})=>post('/v1/activate',body(machine,{serial,...extra}));
const sync=(token,machine)=>post('/v1/sync',body(machine,{activation_token:token}));
test('perpetual receipt, explicit transfer, old PC sync cannot take ownership back',async()=>{
 const item=await issue(),first=await activate(item.serial,A);assert.equal(first.status,200);assert.equal(response(first.value).expires,0);
 const offered=await activate(item.serial,B);assert.equal(response(offered.value).state,'transfer_required');assert.equal(response((await sync(first.value.activation_token,A)).value).state,'active');
 const moved=await activate(item.serial,B,{transfer:true,expected_generation:response(offered.value).generation});assert.equal(response(moved.value).state,'active');
 for(let i=0;i<2;i++)assert.equal(response((await sync(first.value.activation_token,A)).value).state,'transferred');
 assert.equal(response((await sync(moved.value.activation_token,B)).value).state,'active');
 const stored=await db.prepare('SELECT * FROM licenses WHERE id=?').bind(item.license_id).first();assert.ok(!JSON.stringify(stored).includes(item.serial));
});
test('simultaneous activations and transfers have exactly one winner',async()=>{
 const item=await issue(),first=await Promise.all([activate(item.serial,A),activate(item.serial,B)]);assert.equal(first.filter(x=>x.status===200&&response(x.value).state==='active').length,1);assert.ok(first.some(x=>x.status===409||(x.status===200&&response(x.value).state==='transfer_required')));
 const offered=await activate(item.serial,C),generation=response(offered.value).generation;
 const moved=await Promise.all([activate(item.serial,C,{transfer:true,expected_generation:generation}),activate(item.serial,D,{transfer:true,expected_generation:generation})]);assert.deepEqual(moved.map(x=>x.status).sort(),[200,409]);
});
test('legacy import is explicit, unknown legacy stays local, superseded legacy gets signed notice',async()=>{
 const serial='AZST-1234-5678-9ABC-DEF0-1234';
 const unknown=await post('/v1/legacy-sync',body(A,{serial}));assert.equal(response(unknown.value).state,'legacy_unregistered');
 assert.equal((await post('/admin/import-legacy',{customer:'Legacy fixture',serial})).status,200);
 const first=await activate(serial,B);assert.equal(response(first.value).state,'active');
 const old=await post('/v1/legacy-sync',body(A,{serial}));assert.equal(response(old.value).state,'transferred');
 assert.equal(response((await sync(first.value.activation_token,B)).value).state,'active');
 assert.equal((await post('/admin/import-legacy',{customer:'Duplicate',serial})).status,409);
});
test('admin block and restore return signed device-bound states; sync is read-only',async()=>{
 const item=await issue(),active=await activate(item.serial,A);
 const count=await db.prepare('SELECT count(*) n FROM audit').first();await sync(active.value.activation_token,A);assert.deepEqual(await db.prepare('SELECT count(*) n FROM audit').first(),count);
 await post('/admin/block',{license_id:item.license_id});assert.equal(response((await sync(active.value.activation_token,A)).value).state,'blocked');
 await post('/admin/restore',{license_id:item.license_id});assert.equal(response((await sync(active.value.activation_token,A)).value).state,'active');
 assert.equal((await sync(active.value.activation_token,B)).status,401);
});
test('admin authentication, origins, bounded body, nonce and product checks',async()=>{
 assert.equal((await post('/admin/list',{}, {Authorization:'Bearer wrong'})).status,401);
 assert.equal((await post('/admin/list',{}, {Origin:'https://evil.test'})).status,403);
 assert.equal((await post('/v1/activate',{big:'x'.repeat(9000)})).status,413);
 assert.equal((await post('/v1/activate',body(A,{product:'azdm'}))).status,400);
 assert.equal((await post('/v1/activate',body(A,{nonce:'bad'}))).status,400);
 assert.equal((await mf.dispatchFetch('https://test.local/admin')).status,200);
});
test('trial is signed, 30 calendar days, separate per PC, never resets or alters paid licences',async()=>{
 const machine='e'.repeat(64),other='f'.repeat(64);
 const paidBefore=await db.prepare('SELECT count(*) n FROM licenses').first();
 const [a,b]=await Promise.all([post('/v1/trial',body(machine)),post('/v1/trial',body(machine))]);
 assert.equal(a.status,200);assert.equal(b.status,200);
 const first=response(a.value),second=response(b.value);
 assert.equal(first.state,'trial');assert.equal(first.machine,machine);
 assert.equal(first.expires-first.started,30*86400);assert.equal(first.trial_id,second.trial_id);
 assert.equal(first.expires,second.expires);
 const another=response((await post('/v1/trial',body(other))).value);
 assert.notEqual(another.trial_id,first.trial_id);
 await db.prepare('UPDATE trials SET started=started-2592001,expires=expires-2592001 WHERE machine=?').bind(machine).run();
 const expired=response((await post('/v1/trial',body(machine))).value);
 assert.ok(expired.expires<expired.issued);assert.equal(expired.trial_id,first.trial_id);
 assert.deepEqual(await db.prepare('SELECT count(*) n FROM licenses').first(),paidBefore);
});
test('purchase issuance is idempotent across concurrency/lost responses and keeps only hashes',async()=>{
 assert.equal((await post('/admin/commerce-ready')).value.commerce_protocol,1);
 const value={order_id:'tp-test-purchase',license_id:crypto.randomUUID(),customer:'Purchase fixture',serial:'AZST-ABCDE-FGHIJ-KLMNO-PQRST-UVWXY-Z2345'};
 const results=await Promise.all([post('/admin/issue-order',value),post('/admin/issue-order',value)]);
 assert.deepEqual(results.map(x=>x.status),[200,200]);
 assert.equal((await post('/admin/issue-order',value)).value.license_id,value.license_id);
 const rows=await db.prepare('SELECT * FROM licenses WHERE purchase_key=?').bind(value.order_id).all();
 assert.equal(rows.results.length,1);assert.ok(!JSON.stringify(rows.results).includes(value.serial));
 assert.equal(response((await activate(value.serial,'9'.repeat(64))).value).expires,0);
 await post('/admin/block',{license_id:value.license_id});await post('/admin/issue-order',value);
 assert.equal(response((await activate(value.serial,'9'.repeat(64))).value).state,'blocked');
 assert.equal((await post('/admin/issue-order',{...value,serial:'AZST-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA'})).status,409);
 assert.equal((await post('/admin/issue-order',{...value,order_id:'another-order'})).status,409);
 assert.equal((await post('/admin/issue-order',{...value,order_id:'bad/id'})).status,400);
 assert.equal((await post('/admin/issue-order',value,{Authorization:'Bearer wrong'})).status,401);
 await post('/admin/edit',{license_id:value.license_id,customer:'Renamed after purchase'});
 assert.equal((await post('/admin/issue-order',value)).status,200);
 assert.equal((await post('/admin/license',{license_id:value.license_id})).value.license.customer,'Renamed after purchase');
});
test('admin edit preserves activation; reset uses generation and old PC cannot take ownership back',async()=>{
 assert.equal((await post('/admin/management-ready')).value.management_protocol,1);
 const item=await issue(),active=await activate(item.serial,A),generation=response(active.value).generation;
 assert.equal((await post('/admin/edit',{license_id:item.license_id,customer:'Updated fixture'})).status,200);
 assert.equal(response((await sync(active.value.activation_token,A)).value).state,'active');
 assert.equal((await post('/admin/reset',{license_id:item.license_id,expected_generation:generation-1})).status,409);
 assert.equal((await post('/admin/reset',{license_id:item.license_id,expected_generation:generation})).status,200);
 assert.equal(response((await sync(active.value.activation_token,A)).value).state,'transferred');
 const moved=await activate(item.serial,B);assert.equal(response(moved.value).state,'active');
 assert.equal((await post('/admin/reset',{license_id:item.license_id,expected_generation:generation})).status,409);
 assert.equal(response((await sync(moved.value.activation_token,B)).value).state,'active');
});
test('legacy sync after reset stays deactivated until explicit activation',async()=>{
 const serial='AZST-2345-6789-ABCD-EF01-2345',imported=await post('/admin/import-legacy',{customer:'Legacy reset fixture',serial});
 const first=await post('/v1/legacy-sync',body(A,{serial}));assert.equal(response(first.value).state,'active');
 await post('/admin/reset',{license_id:imported.value.license_id,expected_generation:response(first.value).generation});
 assert.equal(response((await post('/v1/legacy-sync',body(A,{serial}))).value).state,'transferred');
 assert.equal(response((await activate(serial,B)).value).state,'active');
});
test('delete archives a tombstone, prevents reuse/retry resurrection and can restore as blocked',async()=>{
 const value={order_id:'tp-archive-fixture',license_id:crypto.randomUUID(),customer:'Archive fixture',serial:'AZST-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE-FFFFF'};
 await post('/admin/issue-order',value);const active=await activate(value.serial,A);
 assert.equal((await post('/admin/delete',{license_id:value.license_id,expected_generation:response(active.value).generation})).status,200);
 assert.equal(response((await sync(active.value.activation_token,A)).value).state,'blocked');
 await post('/admin/issue-order',value);assert.equal(response((await activate(value.serial,B)).value).state,'blocked');
 assert.equal((await post('/admin/restore',{license_id:value.license_id})).status,404);
 assert.equal((await post('/admin/edit',{license_id:value.license_id,customer:'Wrong'})).status,409);
 assert.ok(!(await post('/admin/list',{limit:100})).value.licenses.some(row=>row.id===value.license_id));
 assert.ok((await post('/admin/list',{limit:100,archived:true})).value.licenses.some(row=>row.id===value.license_id));
 assert.equal((await post('/admin/undelete',{license_id:value.license_id})).status,200);
 assert.equal(response((await activate(value.serial,B)).value).state,'blocked');await post('/admin/restore',{license_id:value.license_id});
 assert.equal(response((await sync(active.value.activation_token,A)).value).state,'transferred');
 assert.equal(response((await activate(value.serial,B)).value).state,'active');
});
