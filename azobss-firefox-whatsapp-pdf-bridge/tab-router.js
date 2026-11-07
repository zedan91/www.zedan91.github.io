'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createAzobssWhatsappTabRouter1545=factory;})(typeof globalThis!=='undefined'?globalThis:this,function(ext,{pendingTabs=new Map()}={}){
let queue=Promise.resolve();const requests=new Map();
const validPhone=v=>typeof v==='string'&&/^[1-9]\d{7,14}$/.test(v);
const adminUrl=v=>{try{const u=new URL(v);return ['https://azobss.com','https://www.azobss.com'].includes(u.origin)&&/^\/admin(?:\/|$)/.test(u.pathname);}catch{return false;}};
const whatsappUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='web.whatsapp.com';}catch{return false;}};
const fault=(code,message)=>Object.assign(new Error(message),{code});
const timeout=(work,ms)=>{let timer;return Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fault('probe_timeout','WhatsApp tab status unavailable.')),ms);})]).finally(()=>clearTimeout(timer));};
async function status(tab){
 if(pendingTabs.has(tab.id))return {busy:true,known:true};
 const probe=async()=>{try{return await ext.tabs.sendMessage(tab.id,{type:'AZOBSS_WA_TAB_STATUS_1545'});}catch{await ext.tabs.executeScript(tab.id,{file:'whatsapp-bridge.js'});return ext.tabs.sendMessage(tab.id,{type:'AZOBSS_WA_TAB_STATUS_1545'});}};
 try{const s=await timeout(probe(),1500);return s?.bridgeVersion>=1545?{known:true,ready:s.ready===true,locked:s.locked===true,busy:s.busy===true,draft:s.draft===true}:{};}catch{return {};}
}
async function focus(tab){await ext.tabs.update(tab.id,{active:true});try{await ext.windows.update(tab.windowId,{focused:true});}catch{} }
async function routeNow(sender,phone,home,beforeNavigate){
 if(!adminUrl(sender?.url)||!Number.isInteger(sender?.tab?.id)||(sender.frameId!==undefined&&sender.frameId!==0))throw fault('untrusted_sender','Only the AZOBSS admin page can open this chat.');
 if(!(home===true&&phone==='')&&!validPhone(phone))throw fault('invalid_phone','Customer phone unavailable or invalid.');
 const source=await ext.tabs.get(sender.tab.id);
 if(!adminUrl(source?.url)||!source.cookieStoreId)throw fault('source_unavailable','Refresh the AZOBSS admin page and try again.');
 const query={url:'https://web.whatsapp.com/*',cookieStoreId:source.cookieStoreId};
 const all=await ext.tabs.query(query),tabs=all.filter(t=>whatsappUrl(t.url)&&t.cookieStoreId===source.cookieStoreId&&!!t.incognito===!!source.incognito);
 const states=await Promise.all(tabs.map(async tab=>({tab,status:await status(tab)})));
 states.sort((a,b)=>Number(b.status.ready)-Number(a.status.ready)||Number(a.status.locked)-Number(b.status.locked)||Number(b.tab.active)-Number(a.tab.active)||(Number(b.tab.lastAccessed)||0)-(Number(a.tab.lastAccessed)||0));
 let choice=home?states[0]:states.find(x=>!x.status.locked&&!x.status.busy&&!x.status.draft&&(x.status.known||x.tab.discarded||x.tab.status==='loading'));
 if(!choice&&states.length){const best=states[0];await focus(best.tab);throw fault(best.status.locked?'session_locked':!best.status.known?'probe_unavailable':'unfinished_draft',!best.status.known?'Refresh the existing WhatsApp tab once to activate the bridge, then try again.':best.status.locked?'WhatsApp is active in another session. Use the existing WhatsApp window to resolve its session prompt.':'Finish or cancel the draft/attachment in WhatsApp, then click the customer again.');}
 let tab=choice?.tab,reused=!!tab;
 if(!tab)tab=await ext.tabs.create({url:'about:blank',active:true,windowId:source.windowId,cookieStoreId:source.cookieStoreId});
 if(beforeNavigate)await beforeNavigate(tab);
 const target=phone?'https://web.whatsapp.com/send?phone='+phone:'https://web.whatsapp.com/';
 try{
  // Always navigate the selected tab for a phone: a stale send URL can remain
  // after the user manually switches chats. Never infer the recipient from it.
  await ext.tabs.update(tab.id,{active:true,...(home&&reused?{}:{url:target})});
  try{await ext.windows.update(tab.windowId,{focused:true});}catch{}
 }catch(error){throw fault('tab_update_failed','The WhatsApp tab could not be activated. Refresh and retry; no extra tab was opened.');}
 return {ok:true,bridgeVersion:1545,whatsappTabId:tab.id,reused};
}
function route(sender,{phone='',home=false,requestId='',beforeNavigate}={}){
 if(!adminUrl(sender?.url)||!Number.isInteger(sender?.tab?.id)||(sender.frameId!==undefined&&sender.frameId!==0))return Promise.reject(fault('untrusted_sender','Only the AZOBSS admin page can open this chat.'));
 if(typeof requestId!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(requestId))return Promise.reject(fault('invalid_request','Invalid contact request.'));
 const key=String(sender?.tab?.id)+':'+requestId,now=Date.now();
 for(const [id,item] of requests)if(item.expires<=now)requests.delete(id);
 if(requests.has(key)){const item=requests.get(key);if(item.phone!==phone||item.home!==home)return Promise.reject(fault('request_changed','Contact request changed. Click again.'));return item.promise;}
 if(requests.size>=256)return Promise.reject(fault('too_many_requests','Wait a moment and retry.'));
 const promise=queue.then(()=>routeNow(sender,phone,home,beforeNavigate));queue=promise.catch(()=>{});
 requests.set(key,{phone,home,promise,expires:now+120000});return promise;
}
return Object.freeze({route,adminUrl,whatsappUrl});
});
