'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const source=fs.readFileSync(require.resolve('../backend/download-gateway/worker-v1534.mjs'),'utf8').replace('export default {','globalThis.worker={');
function fixture(){let paused=false,offline=false,fetches=0,gets=0,puts=0;const secret=crypto.randomBytes(32).toString('hex'),key='software/fixture-private.bin',hash=crypto.createHash('sha256').update(key).digest('hex');
 const context={TextEncoder,TextDecoder,Uint8Array,Headers,Response,Request,URL,AbortSignal,setTimeout,clearTimeout,crypto:crypto.webcrypto,btoa,atob,fetch:async(url,options)=>{if(String(url).endsWith('/api/software-availability')){fetches++;assert.equal(options.cache,'no-store');if(offline)throw Error('Offline');return Response.json({ok:true,pausedIds:paused?['azsw-one']:[],pausedObjectHashes:paused?[hash]:[],revision:1});}return Response.json({ok:true});}};vm.runInNewContext(source,context);
 const bucket={get:async k=>{gets++;if(k.startsWith('__azobss_usage/'))return null;return {body:new Uint8Array([1,2,3]),size:3,httpEtag:'"fixture"',writeHttpMetadata:h=>h.set('Content-Type','application/octet-stream')};},put:async()=>{puts++;}};
 const sign=p=>{const body=Buffer.from(JSON.stringify(p)).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');};
 const payload={key,name:'fixture.bin',exp:Math.floor(Date.now()/1000)+3600,tid:'a'.repeat(48),max:3,used:0};
 return {setPaused:v=>paused=v,setOffline:v=>offline=v,counts:()=>({fetches,gets,puts}),call:async(path,method='GET',patch={},headers={})=>context.worker.fetch(new Request('https://fixture.invalid/'+path+'/'+sign({...payload,...patch}),{method,headers}),{AZOBSS_FILES:bucket,AZOBSS_R2_TOKEN_SECRET:secret},{waitUntil:()=>{}})};
}
test('paused software blocks old gate tokens and old delivery tokens, including HEAD and IDM Range, before quota or bucket reads',async()=>{
 const f=fixture();f.setPaused(true);for(const [path,method] of [['gate','GET'],['gate','HEAD'],['gate','POST'],['dl','GET'],['dl','HEAD']]){const r=await f.call(path,method,path==='gate'?{mode:'gate'}:{},{Range:'bytes=0-1'});assert.equal(r.status,423);assert.equal(f.counts().gets,0);assert.equal(f.counts().puts,0);}
});
test('resume restores the same previously issued token; ordinary unpaused software keeps gate, delivery and range behavior',async()=>{
 const f=fixture();f.setPaused(true);assert.equal((await f.call('dl')).status,423);f.setPaused(false);const preview=await f.call('gate','GET',{mode:'gate'});assert.equal(preview.status,200);assert.equal(f.counts().puts,0);const start=await f.call('gate','POST',{mode:'gate',pid:'AZSW-ONE'});assert.equal(start.status,303);assert.ok(start.headers.get('Location').includes('/dl/'));assert.equal(f.counts().puts,1);assert.equal((await f.call('dl')).status,200);
});
test('policy outage fails closed for software without consuming quota; CAD, vault and sales downloads do not call the new policy service',async()=>{
 const f=fixture();f.setOffline(true);assert.equal((await f.call('dl')).status,503);assert.deepEqual(f.counts(),{fetches:1,gets:0,puts:0});for(const key of ['cad/fixture.zip','tech-vault/fixture.zip','sales-documents/fixture.pdf'])assert.equal((await f.call('dl','GET',{key})).status,200);assert.equal(f.counts().fetches,1);
});
