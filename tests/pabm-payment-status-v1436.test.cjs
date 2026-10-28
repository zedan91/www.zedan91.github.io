const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const runtime=source.slice(source.indexOf('// AZOBSS v1436:'),source.indexOf('// AZOBSS 1055: PA/BM payment recovery'));
const response=(data,ok=true)=>({ok,json:async()=>data});
const flush=()=>new Promise(setImmediate);
function fixture(options={}){
 let now=1000000,pending={orderId:'order-A',billCode:'bill-A'},reader=options.fetch||(()=>response({paid:true}));
 const timers=new Map(),events=[],calls=[],consumed=new Set();let timerId=0,clears=0,resets=0;
 const elements={};for(const id of ['paBmToyyibStatus','payPaBmToyyibButton','paBmPaidPurchasesLink','paBmVerifyAgainButton'])elements[id]={dataset:{},hidden:id.includes('Link')||id.includes('Again'),textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}};
 const window={location:{pathname:'/PA-BM/',search:options.search||'',href:'https://example.org/PA-BM/'},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},dispatchEvent(event){events.push(event);this.listeners[event.type]?.(event);}};
 window.azobssPaBmStoreCart={render(){elements.payPaBmToyyibButton.disabled=false;}};
 const context=vm.createContext({window,document:{getElementById:id=>elements[id]||null},URLSearchParams,AbortController,Set,Promise,
  Date:class extends Date{static now(){return now;}},console:{warn(){}},CustomEvent:class{constructor(type,props){this.type=type;this.detail=props.detail;}},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
  fetch:async(url,opts)=>{calls.push({url,opts});return reader(url,opts);},
  auth:{currentUser:{uid:'user-A'}},sessionStorage:{setItem(){}},azobssPaBmReturnKey:(o,b)=>o||b,
  azobssReadPaBmPendingReturn:()=>({...pending}),azobssClearPaBmPendingReturn(){pending={orderId:'',billCode:''};},
  azobssMarkPaBmReturnConsumed:key=>consumed.add(key),azobssPaBmReturnConsumed:key=>consumed.has(key),
  azobssCleanPaBmPaymentReturnUrl(){window.location.search='';},azobssGetBackendBaseUrl:()=>'https://backend.example.org',
  azobssHardClearPaBmCartAfterPaid1371(){clears++;return options.clear?options.clear():Promise.resolve();},
  azobssResetCurrentPurchaseTotalAfterPaid(){resets++;return options.reset?options.reset():Promise.resolve();},
  azobssSchedulePurchaseRecordsRefresh(){},startAzobssPurchaseRealtimeSync(){},azobssShowPaBmPaymentSuccessPopup(){},
  azobssSchedulePaBmReturnCheck(delay){timers.set('retry',{ms:delay});},azobssRecoverPaBmPaymentFromServer1055:async()=>null,
  MutationObserver:class{observe(){}}
 });
 vm.runInContext(runtime,context);
 return {context,window,elements,events,calls,timers,consumed,check:()=>context.azobssCheckPaBmToyyibReturn(),complete:(o='order-A',b='bill-A')=>context.azobssPaBmCompletePaid1436(o,b,'test-verified'),setFetch:fn=>reader=fn,setPending:v=>pending=v,pending:()=>pending,advance:ms=>now+=ms,clears:()=>clears,resets:()=>resets};
}
test('verified paid UI completes immediately while cloud cleanup never settles',{timeout:1000},async()=>{
 const f=fixture({clear:()=>new Promise(()=>{}),reset:()=>new Promise(()=>{})});await f.check();
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');assert.match(f.elements.paBmToyyibStatus.textContent,/Tidak perlu bayar semula/);
 assert.equal(f.elements.payPaBmToyyibButton.disabled,true);assert.equal(f.elements.paBmPaidPurchasesLink.hidden,false);assert.equal(f.elements.paBmVerifyAgainButton.hidden,true);
 assert.equal(f.window.__azobssPaBmReturnCheckActive,false);assert.equal(f.timers.has('retry'),false);assert.equal(f.clears(),1);assert.equal(f.resets(),1);
});
test('rejected cleanup and legacy idle reset cannot downgrade a confirmed payment',async()=>{
 const f=fixture({clear:()=>Promise.reject(Error('cloud offline')),reset:()=>Promise.reject(Error('record refresh'))});await f.check();await flush();
 f.context.azobssResetPaBmPaymentStatusIfIdle(true);
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');assert.equal(f.timers.has('retry'),false);
 assert.equal(f.events.filter(e=>e.type==='azobss:pabm-payment-unpaid').length,0);
});
test('paid recovery wins over a late failed verification request',async()=>{
 let reject;const f=fixture({fetch:()=>new Promise((_,r)=>reject=r)});const request=f.check();await flush();
 f.complete();reject(Error('late network failure'));await request;
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');assert.equal(f.timers.has('retry'),false);assert.equal(f.clears(),1);
});
test('late response for checkout A cannot clear or change checkout B',async()=>{
 let resolve;const f=fixture({fetch:()=>new Promise(r=>resolve=r)});const request=f.check();await flush();
 f.setPending({orderId:'order-B',billCode:'bill-B'});f.context.azobssPaBmBeginView1436('order-B','bill-B');f.context.azobssPaBmVerificationMessage1436('Checking B','checking');
 resolve(response({paid:true}));await request;assert.equal(f.clears(),0);assert.equal(f.elements.paBmToyyibStatus.textContent,'Checking B');assert.equal(f.pending().orderId,'order-B');
});
test('pending beyond two minutes keeps references and offers retry without an unpaid verdict',async()=>{
 const f=fixture({fetch:()=>response({paid:false,status:'pending'})});await f.check();f.timers.delete('retry');f.advance(121000);await f.check();
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'delayed');assert.equal(f.elements.paBmVerifyAgainButton.hidden,false);assert.equal(f.elements.payPaBmToyyibButton.disabled,true);
 assert.equal(f.pending().orderId,'order-A');assert.equal(f.consumed.size,0);assert.equal(f.timers.has('retry'),false);assert.equal(f.events.length,0);
});
test('legacy cart renders cannot re-enable payment while verification is checking or delayed',async()=>{
 const f=fixture({fetch:()=>response({paid:false,status:'pending'})});await f.check();
 for(const advance of [0,121000]){
  f.advance(advance);if(advance)await f.check();
  f.elements.payPaBmToyyibButton.disabled=false;
  f.window.dispatchEvent({type:'azobss:pabm-cart-core-rendered',detail:{count:1}});
  assert.equal(f.elements.payPaBmToyyibButton.disabled,true);
 }
});
test('unresponsive fetch is aborted after 12 seconds and remains an unknown payment',async()=>{
 const f=fixture({fetch:(_,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 const request=f.check();await flush();const deadline=[...f.timers.values()].find(t=>t.ms===12000);assert.ok(deadline);
 f.advance(121000);deadline.fn();await request;
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'delayed');assert.equal(f.pending().orderId,'order-A');assert.equal(f.clears(),0);assert.equal(f.events.length,0);
});
test('HTTP failure or a success-looking callback URL alone cannot mark paid',async()=>{
 const f=fixture({search:'?status_id=1&payment=return',fetch:()=>response({paid:true},false)});await f.check();assert.equal(f.clears(),0);assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'checking');
 const pending=fixture({search:'?status_id=1',fetch:()=>response({paid:false,status:'pending'})});await pending.check();assert.equal(pending.clears(),0);
});
test('explicit failed payment restores the checkout while trusted paid takes priority',async()=>{
 const f=fixture({fetch:()=>response({paid:false,status:'failed'})});await f.check();assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'failed');assert.equal(f.elements.payPaBmToyyibButton.disabled,false);assert.equal(f.clears(),0);
 assert.equal(f.events.filter(e=>e.type==='azobss:pabm-payment-unpaid').length,1);
 const paid=fixture({search:'?status_id=3',fetch:()=>response({paid:true})});await paid.check();assert.equal(paid.elements.paBmToyyibStatus.dataset.paymentState,'paid');
});
test('duplicate confirmation is idempotent and cannot erase a deliberate new cart',async()=>{
 const f=fixture();await f.check();f.complete();assert.equal(f.clears(),1);
 f.window.dispatchEvent({type:'azobss:pabm-cart-core-rendered',detail:{count:0}});f.window.dispatchEvent({type:'azobss:pabm-cart-updated',detail:{count:1}});
 assert.equal(f.elements.payPaBmToyyibButton.disabled,false);f.complete();assert.equal(f.clears(),1);assert.notEqual(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');
});
test('manual retry only verifies the retained order and then displays success',async()=>{
 const f=fixture({fetch:()=>response({status:'pending'})});await f.check();f.advance(121000);await f.check();f.setFetch(()=>response({paid:true}));
 f.elements.paBmVerifyAgainButton.handlers.click();await flush();assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');
 assert.ok(f.calls.every(c=>c.url.includes('/api/verify-payment?')));assert.ok(f.calls.every(c=>!c.opts.method||c.opts.method==='GET'));
});
test('complete production modules parse, including the pre-existing mixed ?? / && regression',()=>{
 for(const file of ['azobss-global-auth.js','azobss-pabm-storefront.js']){
  const checked=spawnSync(process.execPath,['--check',path.join(root,'assets/js',file)],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);
 }
});

function serverSnapshot(row,metadata={fromCache:false,hasPendingWrites:false},itemMetadata={hasPendingWrites:false}){
 return {metadata,forEach(fn){fn({data:()=>row,metadata:itemMetadata});}};
}
const paidRow=()=>({uid:'user-A',orderId:'order-A',billCode:'bill-A',status:'paid',paidAtMs:900000});
test('server paid snapshot clears the cart immediately while HTTP verification is stalled',async()=>{
 const f=fixture({fetch:(_,opts)=>new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
 const request=f.check();await flush();
 assert.equal(f.context.azobssPaBmAcceptServerSnapshot1437(serverSnapshot(paidRow())),true);
 assert.equal(f.elements.paBmToyyibStatus.dataset.paymentState,'paid');assert.equal(f.clears(),1);
 await request;assert.equal(f.window.__azobssPaBmReturnCheckActive,false);assert.equal(f.timers.has('retry'),false);
});
test('cached, local-write, pending, mismatched and other-customer snapshots cannot confirm payment',async()=>{
 const cases=[
  serverSnapshot(paidRow(),{fromCache:true,hasPendingWrites:false}),
  serverSnapshot(paidRow(),{fromCache:false,hasPendingWrites:true}),
  serverSnapshot(paidRow(),undefined,{hasPendingWrites:true}),
  serverSnapshot({...paidRow(),status:'pending'}),serverSnapshot({...paidRow(),paidAtMs:0}),
  serverSnapshot({...paidRow(),orderId:'other-order'}),serverSnapshot({...paidRow(),billCode:'other-bill'}),
  serverSnapshot({...paidRow(),uid:'other-user'}),serverSnapshot(paidRow(),{})
 ];
 for(const snapshot of cases){const f=fixture({fetch:()=>response({status:'pending'})});await f.check();
  assert.equal(f.context.azobssPaBmAcceptServerSnapshot1437(snapshot),false);assert.equal(f.clears(),0);}
});
test('a server snapshot received before return verification avoids a redundant HTTP wait',async()=>{
 const f=fixture({fetch:()=>{throw Error('should not request');}});
 f.context.azobssPaBmAcceptServerSnapshot1437(serverSnapshot(paidRow()));await f.check();
 assert.equal(f.clears(),1);assert.equal(f.calls.length,0);
});
test('a snapshot retained from a previous signed-in user cannot clear the new user cart',async()=>{
 const f=fixture({fetch:()=>response({status:'pending'})});
 f.context.azobssPaBmAcceptServerSnapshot1437(serverSnapshot(paidRow()));f.context.auth.currentUser.uid='user-B';
 await f.check();assert.equal(f.clears(),0);assert.equal(f.calls.length,1);
});
test('an already-consumed return cannot clear a new cart after page reload',async()=>{
 const f=fixture();f.consumed.add('order-A');
 f.context.azobssPaBmAcceptServerSnapshot1437(serverSnapshot(paidRow()));await f.check();
 assert.equal(f.clears(),0);assert.equal(f.calls.length,0);
});
test('purchase link stays on PA/BM despite the root base URL and focuses the list',()=>{
 const html=fs.readFileSync(path.join(root,'PA-BM/index.html'),'utf8');
 const base=html.match(/<base href="([^"]+)"/)[1],href=html.match(/id="paBmPaidPurchasesLink" href="([^"]+)"/)[1];
 const resolved=new URL(href,new URL(base,'https://www.azobss.com/PA-BM/'));
 assert.equal(resolved.pathname,'/PA-BM/');assert.equal(resolved.hash,'#userPaPurchasePanel');
 const f=fixture();let prevented=false,scrolled=false,focused=false;
 f.elements.userPaPurchasePanel={scrollIntoView(){scrolled=true;},setAttribute(){},focus(){focused=true;}};
 f.elements.paBmPaidPurchasesLink.handlers.click({preventDefault(){prevented=true;}});
 assert.ok(prevented&&scrolled&&focused);
});
