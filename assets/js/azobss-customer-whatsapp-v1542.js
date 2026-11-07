(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSCustomerWhatsApp1542=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function phone(value){
 const raw=String(value??'').trim();if(!raw||!/^[+\d\s().-]+$/.test(raw)||/\+/.test(raw.slice(1)))return '';
 let digits=raw.replace(/\D/g,'');const international=raw.startsWith('+')||digits.startsWith('00');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(!international&&digits.startsWith('0'))digits='60'+digits.slice(1);
 else if(!international&&/^1\d{8,9}$/.test(digits))digits='60'+digits;
 if(digits.startsWith('600'))digits='60'+digits.slice(3);
 if(!/^[1-9]\d{7,14}$/.test(digits)||digits.startsWith('60')&&!/^60[1-9]\d{7,9}$/.test(digits))return '';
 return digits;
}
const url=value=>{const digits=phone(value);return digits?'https://web.whatsapp.com/send?phone='+digits:'';};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.4 2.1 4 4.5 4.9l1.2-1.2 1.8.9c-.5 1.6-1.6 2.4-3.2 2-3.7-.9-6-3.2-6.8-6.8-.4-1.6.4-2.7 2-3.2l.9 1.8L9 8.5Z"/></svg>';
function action(value,{className='',iconOnly=false}={}){
 const href=url(value),title=href?'WhatsApp Customer · +'+phone(value):'Customer phone unavailable or invalid';
 const content=svg+'<span'+(iconOnly?' class="az-sr-visually-hidden"':'')+'>WhatsApp Customer</span>';
 const attrs='class="'+esc(className)+'" data-customer-whatsapp title="'+esc(title)+'" aria-label="'+esc(title)+'"';
 return href?'<a '+attrs+' href="'+href+'" target="_blank" rel="noopener noreferrer">'+content+'</a>':'<button '+attrs+' type="button" disabled aria-disabled="true">'+content+'</button>';
}
const browserWindow=typeof window!=='undefined'?window:null,pending=new Map(),inflight=new Map();
function notice(message){
 if(!browserWindow?.document?.body)return;
 let el=document.getElementById('azWhatsappReuseStatus1545');
 if(!el){el=document.createElement('aside');el.id='azWhatsappReuseStatus1545';el.setAttribute('role','status');el.style.cssText='position:fixed;bottom:18px;right:18px;z-index:2147483647;width:min(410px,calc(100vw - 36px));box-sizing:border-box;padding:15px;border:1px solid #3c6578;border-radius:12px;background:#10283a;color:#effaff;font:13px/1.5 Arial,sans-serif;box-shadow:0 12px 40px #0008';document.body.append(el);}
 el.innerHTML='<button type="button" data-wa-notice-close style="float:right;border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer" aria-label="Close WhatsApp status">×</button><p style="margin:0 22px 10px 0">'+esc(message)+'</p><a href="/azobss-firefox-whatsapp-pdf-bridge/INSTALL.html" target="_blank" rel="noopener noreferrer" style="color:#83edc8">Pasang / kemas kini Firefox Bridge ↗</a>';
 el.querySelector('[data-wa-notice-close]').onclick=()=>el.remove();
}
function target(value){
 try{const u=new URL(value);if(u.origin!=='https://web.whatsapp.com'||u.hash||u.username||u.password)return null;
  if(u.pathname==='/'&&!u.search)return {phone:'',home:true};
  const digits=u.searchParams.get('phone');if(u.pathname!=='/send'||u.searchParams.size!==1||!digits||phone(digits)!==digits)return null;
  return {phone:digits,home:false};
 }catch{return null;}
}
async function requestOpen(value){
 if(!browserWindow||!target(value))return false;
 const ready=()=>Number(document.documentElement.getAttribute('data-azobss-firefox-whatsapp-tab-reuse'))>=1552;
 for(let i=0;i<5&&!ready();i++)await new Promise(resolve=>setTimeout(resolve,100));
 if(!ready()){notice('Kemas kini Firefox Bridge v1552 untuk membuka dan mengesahkan nombor pelanggan. Tiada tab tambahan dibuka.');return false;}
 notice('Sedang membuka dan mengesahkan nombor pelanggan di WhatsApp…');
 const destination=target(value),requestId='wa1545-'+(browserWindow.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2));
 return new Promise(resolve=>{
  const timer=setTimeout(()=>{pending.delete(requestId);notice('Chat pelanggan belum dapat disahkan. Semak status/login pada tab WhatsApp sedia ada; tiada tab tambahan dibuka.');resolve(false);},120000);
  pending.set(requestId,{resolve,timer,...destination});browserWindow.postMessage({type:'AZOBSS_FIREFOX_WA_OPEN_CHAT_REQUEST',requestId,...destination},location.origin);
 });
}
function openURL(value){
 if(inflight.has(value))return inflight.get(value);
 const task=requestOpen(value).finally(()=>inflight.delete(value));inflight.set(value,task);return task;
}
if(browserWindow?.document){
 browserWindow.addEventListener('message',event=>{
  if(event.source!==browserWindow||event.origin!==location.origin||event.data?.type!=='AZOBSS_FIREFOX_WA_OPEN_CHAT_STATUS')return;
  const item=pending.get(event.data.requestId);if(!item)return;pending.delete(event.data.requestId);clearTimeout(item.timer);
  const confirmed=event.data.ok===true&&(item.home||event.data.phoneVerified===true&&event.data.phone===item.phone);
  if(confirmed)document.getElementById('azWhatsappReuseStatus1545')?.remove();else notice(event.data.error||'Tab WhatsApp terbuka tetapi nombor penerima belum disahkan. PDF dan nota tidak dihantar.');item.resolve(confirmed);
 });
 const click=event=>{const a=event.target?.closest?.('a[data-customer-whatsapp]');if(!a)return;event.preventDefault();event.stopImmediatePropagation();openURL(a.href);};
 browserWindow.addEventListener('click',click,{capture:true});browserWindow.addEventListener('auxclick',click,{capture:true});
}
return Object.freeze({phone,url,action,openURL});
});
