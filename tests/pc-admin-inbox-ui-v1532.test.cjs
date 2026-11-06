'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function app(){
 const elements=new Map(),requests=[];let answer=true;
 const element=()=>({value:'',hidden:false,innerHTML:'',textContent:'',classList:{add(){},remove(){}},setAttribute(){},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const context={URLSearchParams,Intl,Date,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,confirm:()=>answer,alert(){},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},window:{azobssGetFirebaseAuthHeaders:async()=>({Authorization:'LOCAL-FIXTURE-ONLY'})},document:{readyState:'loading',addEventListener(){},querySelector:s=>el(s),querySelectorAll:()=>[],getElementById:id=>el('#'+id),body:{classList:{add(){},remove(){}}}},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve:value=>resolve({ok:true,json:async()=>value})}))};
 const source=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-admin-pc-shop-orders-v1487.js'),'utf8').replace("if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();","window.testApp={load,openDetail,close,closeDetail,markDirty(){formDirty=true},state(){return {orders,selectedId,selectedRecord,formDirty}}};");
 el('#azPcInboxPageSize').value='25';el('#azPcAdminStatus').value='all';el('#azPcInboxSort').value='newest';vm.runInNewContext(source,context);
 return {api:context.window.testApp,el,requests,setConfirm:v=>answer=v,tick:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('a late search response cannot replace the latest list even if its fetch ignores cancellation',async()=>{
 const f=app();f.el('#azPcAdminSearch').value='slow';const slow=f.api.load();await f.tick();f.el('#azPcAdminSearch').value='new';const latest=f.api.load();await f.tick();f.requests[1].resolve({ok:true,pageSize:25,hasMore:false,orders:[{orderId:'latest',items:[]}]});await latest;f.requests[0].resolve({ok:true,pageSize:25,hasMore:false,orders:[{orderId:'stale',items:[]}]});await slow;assert.equal(f.api.state().orders[0].orderId,'latest');assert.equal(f.requests[0].options.signal.aborted,true);
});
test('late detail responses cannot replace the selected customer record',async()=>{
 const f=app(),slow=f.api.openDetail('old',{focus:false});await f.tick();const latest=f.api.openDetail('current',{focus:false});await f.tick();f.requests[1].resolve({ok:true,order:{orderId:'current',requestOnly:true,items:[]}});await latest;f.requests[0].resolve({ok:true,order:{orderId:'old',requestOnly:true,items:[]}});await slow;assert.equal(f.api.state().selectedId,'current');assert.equal(f.api.state().selectedRecord.orderId,'current');
});
test('background list refresh and cancelled close preserve a dirty detail form',async()=>{
 const f=app(),open=f.api.openDetail('editing',{focus:false});await f.tick();f.requests[0].resolve({ok:true,order:{orderId:'editing',requestOnly:true,items:[]}});await open;f.api.markDirty();const refresh=f.api.load({refreshSelected:true,background:true});await f.tick();f.requests[1].resolve({ok:true,pageSize:25,hasMore:false,orders:[]});await refresh;assert.equal(f.requests.length,2);assert.equal(f.api.state().formDirty,true);assert.equal(f.api.state().selectedRecord.orderId,'editing');f.setConfirm(false);assert.equal(f.api.close(),false);assert.equal(f.api.state().selectedId,'editing');f.setConfirm(true);assert.equal(f.api.close(),true);assert.equal(f.api.state().selectedRecord,null);
});
test('closing the workspace invalidates a response already in flight',async()=>{
 const f=app(),load=f.api.load();await f.tick();f.api.close();f.requests[0].resolve({ok:true,pageSize:25,hasMore:false,orders:[{orderId:'late',items:[]}]});await load;assert.equal(f.api.state().orders.length,0);
});
