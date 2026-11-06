'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const client=fs.readFileSync(path.join(__dirname,'../assets/js/azobss-pc-shop-v1487.js'),'utf8');
function fixture(anchorSelector){
 const nodes=new Map(),insertions=[];
 const node=()=>({listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},insertAdjacentHTML(position,html){insertions.push({position,html});for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set('#'+id,node());for(const [,attr] of html.matchAll(/(data-pcshop-[\w-]+)(?:[ >])/g))nodes.set('['+attr+']',node());}});
 if(anchorSelector)nodes.set(anchorSelector,node());
 const context={document:{body:node(),querySelector:s=>nodes.get(s)||null},openCart(){},openOrders(){},renderHardware(){},updateCartFab(){},window:{}};
 vm.runInNewContext(client.split('\n').filter(l=>/^function (shellHtml|ensureShell)\(/.test(l)).join('\n'),context);
 return {context,nodes,insertions};
}
test('catalogue mounts and binds cart, orders and filters with a hub navigation and no hero',()=>{
 const {context,nodes,insertions}=fixture('.az-pc-hub-nav');
 context.ensureShell();assert.ok(nodes.has('#az-pc-hardware-shop'));
 for(const [selector,event] of [['#azPcShopSearch','input'],['#azPcShopCategory','change'],['#azPcShopSort','change'],['#azPcShopCartFab','click'],['[data-pcshop-orders]','click']])assert.equal(typeof nodes.get(selector).listeners[event],'function',selector);
 assert.equal(insertions.length,2);context.ensureShell();assert.equal(insertions.length,2);
 nodes.get('[data-pcshop-orders]').listeners.click();nodes.get('#azPcShopCartFab').listeners.click();
});
test('shell retains its legacy anchor fallback and safely skips pages without a catalogue anchor',()=>{
 const fallback=fixture('.hero');fallback.context.ensureShell();assert.ok(fallback.nodes.has('#az-pc-hardware-shop'));
 const absent=fixture();absent.context.ensureShell();assert.equal(absent.insertions.length,0);
});
