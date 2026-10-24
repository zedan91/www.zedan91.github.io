class Denied extends Error { constructor(status,message) {super(message);this.status=status;} }
async function bodyFor(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Denied(415,'JSON required.');
  const length = Number(request.headers.get('Content-Length'));
  if (length > 8192) throw new Denied(413,'Request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new Denied(400,'Invalid request.');
  let size = 0; const chunks = [];
  try {
    while (true) {
      const {value,done} = await reader.read(); if(done) break;
      size += value.length; if(size > 8192) {await reader.cancel(); throw new Denied(413,'Request too large.');}
      chunks.push(value);
    }
    const raw = new Uint8Array(size); let offset = 0;
    for(const chunk of chunks) {raw.set(chunk,offset); offset += chunk.length;}
    const value = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid');
    return value;
  } catch(error) {if(error instanceof Denied) throw error; throw new Denied(400,'Invalid request.');}
}
const PRODUCT='azobss-solattime';
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const NEW_SERIAL=/^AZST-(?:[A-Z2-7]{5}-){5}[A-Z2-7]{5}$/;
const LEGACY_SERIAL=/^AZST-(?:[A-F0-9]{4}-){4}[A-F0-9]{4}$/;
const encoder=new TextEncoder();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"};
const json=(value,status=200)=>Response.json(value,{status,headers});
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=value=>Uint8Array.from(atob(value),x=>x.charCodeAt(0));
let signing,secret;
async function signingKey(env) {
 if(!env.LICENSE_SIGNING_KEY || !HEX.test(env.PUBLIC_KEY||'') || !env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32)throw new Denied(503,'not_configured');
 if(secret!==env.LICENSE_SIGNING_KEY) {
  secret=env.LICENSE_SIGNING_KEY;
  signing=(async()=>{
   const key=await crypto.subtle.importKey('pkcs8',unb64(secret),'Ed25519',false,['sign']);
   const pub=await crypto.subtle.importKey('raw',Uint8Array.from(env.PUBLIC_KEY.match(/../g),x=>parseInt(x,16)),'Ed25519',false,['verify']);
   const proof=encoder.encode('SolatTime licence signing v1');
   if(!await crypto.subtle.verify('Ed25519',pub,await crypto.subtle.sign('Ed25519',key,proof),proof))throw new Error('Identity mismatch');
   return key;
  })();
 }
 return signing;
}
async function signed(env,body,values) {
 const raw=encoder.encode(JSON.stringify({v:1,product:PRODUCT,machine:body.machine,nonce:body.nonce,
  issued:Math.floor(Date.now()/1000),...values}));
 return {payload:b64(raw),signature:b64(await crypto.subtle.sign('Ed25519',await signingKey(env),raw))};
}
function normalSerial(value) {
 if(typeof value!=='string' || value.length>80)throw new Denied(400,'invalid_serial');
 const serial=value.trim().toUpperCase();
 if(!NEW_SERIAL.test(serial)&&!LEGACY_SERIAL.test(serial))throw new Denied(400,'invalid_serial');
 return serial;
}
const claims=(row,activation)=>({state:'active',license_id:row.id,activation_id:activation.id,
 generation:activation.generation,expires:0});
async function activate(body,env,legacySync=false) {
 const serial=normalSerial(body.serial);
 const row=await env.DB.prepare('SELECT * FROM licenses WHERE serial_hash=?').bind(await sha(serial)).first();
 if(!row) {
  if(legacySync&&LEGACY_SERIAL.test(serial))return {response:await signed(env,body,{state:'legacy_unregistered'})};
  throw new Denied(401,'invalid_serial');
 }
 const current=row.current_activation?await env.DB.prepare('SELECT * FROM activations WHERE id=?').bind(row.current_activation).first():null;
 if(row.status!=='active')return {response:await signed(env,body,{state:'blocked',license_id:row.id,activation_id:legacySync?'legacy':(current?.id||'legacy'),generation:row.generation})};
 if(current&&current.machine!==body.machine) {
  if(legacySync)return {response:await signed(env,body,{state:'transferred',license_id:row.id,activation_id:'legacy',generation:row.generation})};
  if(body.transfer!==true)return {response:await signed(env,body,{state:'transfer_required',license_id:row.id,generation:row.generation})};
  if(body.expected_generation!==row.generation)throw new Denied(409,'state_changed');
 }
 // Sync never takes a licence back. Only an explicit activation may change owner.
 const id=crypto.randomUUID(),token=random(),generation=row.generation+1;
 const results=await env.DB.batch([
  env.DB.prepare("UPDATE licenses SET current_activation=?,generation=generation+1 WHERE id=? AND generation=? AND status='active' RETURNING id").bind(id,row.id,row.generation),
  env.DB.prepare('INSERT INTO activations(id,license_id,machine,token_hash,generation,created) SELECT ?,id,?,?,generation,? FROM licenses WHERE id=? AND current_activation=?')
   .bind(id,body.machine,await sha(token),Math.floor(Date.now()/1000),row.id,id),
 ]);
 if(results[0].results.length!==1)throw new Denied(409,'state_changed');
 return {activation_token:token,response:await signed(env,body,claims(row,{id,generation}))};
}
async function sync(body,env) {
 if(!HEX.test(body.activation_token||''))throw new Denied(401,'invalid_activation');
 const row=await env.DB.prepare('SELECT a.id AS activation_id,a.machine,a.generation,l.id,l.status,l.current_activation FROM activations a JOIN licenses l ON l.id=a.license_id WHERE a.token_hash=? AND a.machine=?')
  .bind(await sha(body.activation_token),body.machine).first();
 if(!row)throw new Denied(401,'invalid_activation');
 const state=row.status!=='active'?'blocked':row.current_activation===row.activation_id?'active':'transferred';
 return {response:await signed(env,body,{state,license_id:row.id,activation_id:row.activation_id,generation:row.generation,...(state==='active'?{expires:0}:{})})};
}
async function trial(body,env) {
 const started=Math.floor(Date.now()/1000);
 // One calendar period per machine. Reinstall/retry/concurrent requests never renew it.
 await env.DB.prepare('INSERT INTO trials(machine,id,started,expires) VALUES(?,?,?,?) ON CONFLICT(machine) DO NOTHING')
  .bind(body.machine,crypto.randomUUID(),started,started+2592000).run();
 const row=await env.DB.prepare('SELECT id,started,expires FROM trials WHERE machine=?').bind(body.machine).first();
 return {response:await signed(env,body,{state:'trial',trial_id:row.id,started:row.started,expires:row.expires})};
}
async function admin(path,body,env) {
 if(path==='/admin/commerce-ready') {
  await env.DB.prepare('SELECT purchase_key FROM licenses LIMIT 1').all();
  return {ok:true,commerce_protocol:1};
 }
 if(path==='/admin/issue-order') {
  if(typeof body.order_id!=='string'||!/^[-A-Za-z0-9_]{1,160}$/.test(body.order_id)||!UUID.test(body.license_id||''))throw new Denied(400,'invalid_order');
  if(typeof body.customer!=='string'||!body.customer.trim()||body.customer.length>120)throw new Denied(400,'invalid_customer');
  const serial=normalSerial(body.serial);if(!NEW_SERIAL.test(serial))throw new Denied(400,'new_serial_required');
  const hash=await sha(serial);
  // The server reserves/encrypts this serial durably before calling us. A lost
  // response or concurrent retry reuses the purchase binding, never a new licence.
  await env.DB.prepare("INSERT INTO licenses(id,serial_hash,customer,source,created,purchase_key) VALUES(?,?,?,'new',?,?) ON CONFLICT DO NOTHING")
   .bind(body.license_id,hash,body.customer.trim(),Math.floor(Date.now()/1000),body.order_id).run();
  const row=await env.DB.prepare('SELECT id,serial_hash,customer FROM licenses WHERE purchase_key=?').bind(body.order_id).first();
  if(!row||row.id!==body.license_id||row.serial_hash!==hash||row.customer!==body.customer.trim())throw new Denied(409,'order_conflict');
  return {ok:true,license_id:row.id};
 }
 if(path==='/admin/list') {
  const limit=body.limit??50;
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new Denied(400,'invalid_limit');
  const offset=body.offset??0;if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new Denied(400,'invalid_page');
  const {results}=await env.DB.prepare('SELECT id,customer,source,status,generation,created,CASE WHEN current_activation=\'\' THEN 0 ELSE 1 END AS device_count FROM licenses ORDER BY created DESC,id DESC LIMIT ? OFFSET ?').bind(limit+1,offset).all();
  return {licenses:results.slice(0,limit),next_offset:results.length>limit?offset+limit:null};
 }
 if(path==='/admin/issue'||path==='/admin/import-legacy') {
  if(typeof body.customer!=='string'||!body.customer.trim()||body.customer.length>120)throw new Denied(400,'invalid_customer');
  let serial;
  if(path==='/admin/import-legacy') {
   serial=normalSerial(body.serial);if(!LEGACY_SERIAL.test(serial))throw new Denied(400,'legacy_key_required');
  } else {
   const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
   serial='AZST-'+Array.from(crypto.getRandomValues(new Uint8Array(30)),x=>alphabet[x&31]).join('').match(/.{5}/g).join('-');
  }
  const id=crypto.randomUUID();
  const result=await env.DB.prepare("INSERT INTO licenses(id,serial_hash,customer,source,created) VALUES(?,?,?,?,?) ON CONFLICT(serial_hash) DO NOTHING")
   .bind(id,await sha(serial),body.customer.trim(),path==='/admin/issue'?'new':'legacy',Math.floor(Date.now()/1000)).run();
  if(result.meta.changes!==1)throw new Denied(409,'already_registered');
  return {license_id:id,...(path==='/admin/issue'?{serial}:{}),ok:true};
 }
 if(!['/admin/block','/admin/restore'].includes(path)||!UUID.test(body.license_id||''))throw new Denied(400,'invalid_action');
 const row=await env.DB.prepare('UPDATE licenses SET status=? WHERE id=? RETURNING id').bind(path==='/admin/block'?'blocked':'active',body.license_id).first();
 if(!row)throw new Denied(404,'not_found');return {ok:true};
}
async function dispatch(request,env) {
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='GET') {
  if(path==='/health')return json({ok:true,product:PRODUCT,protocol:1});
  if(['/admin','/admin.js','/admin.css'].includes(path)) {
   const response=await env.ASSETS.fetch(new Request(new URL(path==='/admin'?'/index.html':path,url),request));
   return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}});
  }
  throw new Denied(404,'not_found');
 }
 if(request.method!=='POST')throw new Denied(405,'method_not_allowed');
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)throw new Denied(403,'invalid_origin');
 if(env.IP_LIMIT&&!(await env.IP_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success)throw new Denied(429,'rate_limited');
 if(path.startsWith('/admin/')) {
  const supplied=request.headers.get('Authorization')||'';
  if(!env.ADMIN_TOKEN||await sha(supplied)!==await sha('Bearer '+env.ADMIN_TOKEN))throw new Denied(401,'unauthorized');
  return json(await admin(path,await bodyFor(request),env));
 }
 if(!['/v1/activate','/v1/sync','/v1/legacy-sync','/v1/trial'].includes(path))throw new Denied(404,'not_found');
 const body=await bodyFor(request);
 if(body.product!==PRODUCT||!HEX.test(body.machine||'')||!HEX.test(body.nonce||''))throw new Denied(400,'invalid_request');
 const actor=path==='/v1/trial'?body.machine:body.serial?await sha(String(body.serial)):await sha(String(body.activation_token||''));
 if(env.ACTOR_LIMIT&&!(await env.ACTOR_LIMIT.limit({key:actor})).success)throw new Denied(429,'rate_limited');
 return json(path==='/v1/trial'?await trial(body,env):path==='/v1/sync'?await sync(body,env):await activate(body,env,path==='/v1/legacy-sync'));
}
export default {async fetch(request,env) {
 try{return await dispatch(request,env);}catch(error){return json({error:error instanceof Denied?error.message:'service_unavailable'},error instanceof Denied?error.status:503);}
}};
