'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-solattime-orders.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
 let now=0,id=0;const timers=new Map(),calls=[];
 class Target{constructor(){this.events=new Map();}addEventListener(name,fn){const list=this.events.get(name)||[];list.push(fn);this.events.set(name,list);}dispatchEvent(event){for(const fn of this.events.get(event.type)||[])fn(event);}}
 class Element extends Target{
  constructor(tag){super();this.tagName=tag;this.children=[];this.ownText='';this.open=false;this.hidden=false;}
  set textContent(value){this.ownText=String(value);this.children=[];}get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.ownText='';this.children=[...children];}
  setAttribute(){}before(node){entry=node;}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent({type:'close'});}click(){this.dispatchEvent({type:'click'});}
 }
 const body=new Element('body'),grid=new Element('div');let entry;
 const window=new Target(),document={body,createElement:tag=>new Element(tag),getElementById:id=>id==='softwareDownloadsGrid'?grid:null,querySelector:()=>null};
 const schedule=(fn,delay=0)=>{timers.set(++id,{at:now+delay,fn});return id;};
 Object.assign(window,{setTimeout:schedule,clearTimeout:key=>timers.delete(key)});
 const serial='AZST-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA';
 const order={order_id:'order-fixture',status:'paid',amount_cents:3000,fulfillment_state:'complete',email_status:'accepted',customer:'Customer fixture',email:'fixture@example.com'};
 let response=async url=>({ok:true,json:async()=>new URL(url).pathname.endsWith('/orders')?{orders:[order],next_cursor:null}:{order:{...order,serial},download_url:'https://example.com/installer.exe'}});
 vm.runInNewContext(source,{window,document,URLSearchParams,location:{search:'?solattime_orders=1'},Date:{now:()=>now},setTimeout:schedule,clearTimeout:key=>timers.delete(key),AbortSignal,fetch:async(url,options)=>{calls.push({url,options});return response(url,options);}});
 const dialog=body.children[0];
 const all=(root=body)=>[root,...root.children.flatMap(node=>all(node))];
 return {window,dialog,calls,serial,timers,get text(){return body.textContent;},get entry(){return entry;},button:text=>all().find(node=>node.tagName==='button'&&node.textContent===text),response:fn=>response=fn,auth(uid='buyer-a'){window.azobssGetCurrentFirebaseUid=()=>uid;window.azobssWaitForFirebaseAuthToken=async()=>uid?'fixture-token-'+uid:'';},event(detail){window.dispatchEvent({type:'azobss:auth-state-ready',detail});},async tick(ms){const end=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=end;await flush();}};
}
test('email deep link waits for delayed auth module and restored Firebase user before fetching',async()=>{
 const f=fixture();assert.equal(f.entry,undefined);assert.equal(typeof f.window.azobssOpenSolatTimeOrders,'function');assert.equal(f.dialog.open,true);assert.equal(f.calls.length,0);assert.match(f.text,/Sedang mengesahkan sesi/);assert.doesNotMatch(f.text,/Sila log masuk/);
 const pending=deferred();f.window.azobssWaitForFirebaseAuthToken=()=>pending.promise;f.window.azobssGetCurrentFirebaseUid=()=> 'buyer-a';await f.tick(150);assert.equal(f.calls.length,0);
 pending.resolve('fixture-token');f.event({loggedIn:true,uid:'buyer-a'});await flush();assert.equal(f.calls.length,1);assert.match(f.text,/Pilih pesanan/);assert.equal(f.dialog.open,true);assert.equal(f.calls[0].options.headers.Authorization,'Bearer fixture-token');
});
test('signed-out visitor gets retry and login event reloads the same open panel',async()=>{
 const f=fixture();f.auth('');await f.tick(150);assert.match(f.text,/Sila log masuk/);assert.ok(f.button('Cuba semula'));assert.equal(f.calls.length,0);
 f.auth('buyer-a');f.event({loggedIn:true,uid:'buyer-a'});await flush();assert.equal(f.calls.length,1);assert.equal(f.dialog.open,true);assert.match(f.text,/Pilih pesanan/);
});
test('closing while auth is pending cancels work and login never reopens the panel',async()=>{
 const f=fixture(),pending=deferred();f.window.azobssWaitForFirebaseAuthToken=()=>pending.promise;await f.tick(150);f.dialog.close();pending.resolve('fixture-token');f.event({loggedIn:true,uid:'buyer-a'});await flush();assert.equal(f.calls.length,0);assert.equal(f.dialog.open,false);assert.equal(f.text,'Lesen SolatTime sayaTutup');
});
test('logout discards a late authenticated response without rendering another account data',async()=>{
 const f=fixture(),pending=deferred();f.auth();f.response(()=>pending.promise);await f.tick(150);assert.equal(f.calls.length,1);
 f.window.dispatchEvent({type:'azobss-auth-changed'});pending.resolve({ok:true,json:async()=>({orders:[{customer:'Private old account',order_id:'old',amount_cents:3000}],next_cursor:null})});await flush();assert.equal(f.dialog.open,false);assert.doesNotMatch(f.text,/Private old account|old/);
});
test('switching Firebase UID clears displayed serial and closes the previous account panel',async()=>{
 const f=fixture();f.auth();await f.tick(150);f.button('Lihat lesen').click();await flush();assert.ok(f.dialog.children[3].children.some(node=>node.children.some(child=>child.value===f.serial)));
 f.auth('buyer-b');f.event({loggedIn:true,uid:'buyer-b'});assert.equal(f.dialog.open,false);assert.equal(f.dialog.children[3].children.length,0);assert.doesNotMatch(f.text,/Customer fixture/);
});
test('missing auth module has a bounded wait and offers an explicit retry',async()=>{
 const f=fixture();await f.tick(12150);assert.equal(f.calls.length,0);assert.match(f.text,/Sesi akaun belum dapat disahkan/);assert.ok(f.button('Cuba semula'));assert.equal(f.timers.size,0);
 f.auth();f.button('Cuba semula').click();await flush();assert.equal(f.calls.length,1);assert.match(f.text,/Pilih pesanan/);
});
