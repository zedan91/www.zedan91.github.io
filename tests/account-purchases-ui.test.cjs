'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-account-purchases.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],routes=[];let fetchImpl=async()=>({ok:true,json:async()=>({ok:true,orders:[]})});
 class Target{constructor(){this.events=new Map();}addEventListener(type,fn){this.events.set(type,[...(this.events.get(type)||[]),fn]);}dispatchEvent(event){for(const fn of this.events.get(event.type)||[])fn(event);}}
 class Element extends Target{constructor(tag){super();this.tagName=tag;this.children=[];this.ownText='';this.open=false;}set textContent(text){this.ownText=String(text);this.children=[];}get textContent(){return this.ownText+this.children.map(node=>node.textContent).join('');}set innerHTML(_){throw Error('Untrusted HTML rendering');}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.ownText='';this.children=nodes;}setAttribute(){}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent({type:'close'});}click(){this.dispatchEvent({type:'click'});}}
 const document={head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag)},window=new Target();
 window.location={assign:url=>routes.push(url)};
 vm.runInNewContext(script,{window,document,AbortSignal,AbortController,fetch:async(url,options)=>{calls.push({url,options});return fetchImpl(url,options);}});
 const all=root=>[root,...root.children.flatMap(all)];
 return {window,document,calls,routes,open:()=>window.azobssAccountPurchasesOpen(),get dialog(){return document.body.children[0];},get text(){return document.body.textContent;},button:name=>all(document.body).find(node=>node.tagName==='button'&&node.textContent.startsWith(name)),auth(uid='buyer-a'){window.azobssWaitForFirebaseAuthToken=async()=>uid?'token-'+uid:'';window.azobssGetCurrentFirebaseUid=()=>uid;},fetch:fn=>fetchImpl=fn,event(type,detail){window.dispatchEvent({type,detail});}};
}
test('account landing is one reusable dialog with three categories and no background account requests',()=>{
 const f=fixture();f.open();f.open();assert.equal(f.document.body.children.length,1);assert.equal(f.document.head.children.length,1);assert.match(f.text,/Lesen & Pembelian Saya/);for(const label of ['Liyabudun','AZDM','Pembelian lain'])assert.ok(f.button(label));assert.equal(f.calls.length,0);
});
test('Liyabudun opens existing license dialog on Software Tools and preserves the email route on other pages',()=>{
 const f=fixture();let opened=0;f.window.azobssOpenSolatTimeOrders=()=>opened++;f.open();f.button('Liyabudun').click();assert.equal(opened,1);assert.equal(f.dialog.open,false);assert.equal(f.routes.length,0);
 delete f.window.azobssOpenSolatTimeOrders;f.open();f.button('Liyabudun').click();assert.deepEqual(f.routes,['/Software-Tools/?solattime_orders=1']);
});
test('other purchases retain the original receipts/downloads view',()=>{
 const f=fixture();let opened=0;f.window.azobssOpenMyPurchases=()=>opened++;f.open();f.button('Pembelian lain').click();assert.equal(opened,1);assert.equal(f.dialog.open,false);
});
test('AZDM reads only authenticated customer orders and safely renders server-provided names',async()=>{
 const f=fixture();f.auth();f.fetch(async()=>({ok:true,json:async()=>({ok:true,orders:[{product_name:'<img src=x onerror=alert(1)>',order_id:'fixture-order',quantity:2,amount_cents:8000,status:'paid',email_status:'accepted'}]})}));f.open();f.button('AZDM').click();await flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'https://azobss-backend.onrender.com/api/azdm/orders');assert.equal(f.calls[0].options.headers.Authorization,'Bearer token-buyer-a');assert.equal(f.calls[0].options.cache,'no-store');assert.match(f.text,/RM80.00/);assert.match(f.text,/<img src=x onerror=alert\(1\)>/);assert.match(f.text,/Bayaran diterima/);
});
test('guest AZDM view never sends an unauthenticated request',async()=>{
 const f=fixture();f.auth('');f.open();f.button('AZDM').click();await flush();assert.equal(f.calls.length,0);assert.match(f.text,/Sila log masuk/);assert.ok(f.button('Muat semula'));
});
test('changing account while AZDM request is pending aborts and discards the previous account response',async()=>{
 const f=fixture();let resolve;f.auth();f.fetch(()=>new Promise(r=>resolve=r));f.open();f.button('AZDM').click();await flush();f.event('azobss:auth-state-ready',{loggedIn:true,uid:'buyer-b'});assert.equal(f.dialog.open,false);assert.equal(f.calls[0].options.signal.aborted,true);resolve({ok:true,json:async()=>({ok:true,orders:[{product_name:'PRIVATE OLD ACCOUNT',order_id:'old'}]})});await flush();assert.doesNotMatch(f.text,/PRIVATE OLD ACCOUNT/);
});
test('both legacy and renamed account menu entries route to the shared hub once',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-global-auth.js'),'utf8');
 const start=source.indexOf("  document.addEventListener('click', function(e){\n    const a = e.target && e.target.closest ? e.target.closest('a.user-dropdown-item[href=\"/#purchases\"]");assert.ok(start>0);
 const end=source.indexOf('  }, true);',start)+'  }, true);'.length;let listener,calls=0,legacy=0;
 vm.runInNewContext(source.slice(start,end),{document:{addEventListener:(_,fn)=>listener=fn,querySelectorAll:()=>[]},window:{azobssOpenAccountPurchases:()=>calls++,azobssOpenMyPurchases:()=>legacy++}});
 for(const textContent of ['My Purchases','Lesen & Pembelian Saya'])listener({target:{closest:()=>({textContent})},preventDefault(){},stopPropagation(){}});
 assert.equal(calls,2);assert.equal(legacy,0);
});
