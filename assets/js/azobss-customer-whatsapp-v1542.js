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
const url=value=>{const digits=phone(value);return digits?'https://wa.me/'+digits:'';};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.4 2.1 4 4.5 4.9l1.2-1.2 1.8.9c-.5 1.6-1.6 2.4-3.2 2-3.7-.9-6-3.2-6.8-6.8-.4-1.6.4-2.7 2-3.2l.9 1.8L9 8.5Z"/></svg>';
function action(value,{className='',iconOnly=false}={}){
 const href=url(value),title=href?'WhatsApp Customer · +'+phone(value):'Customer phone unavailable or invalid';
 const content=svg+'<span'+(iconOnly?' class="az-sr-visually-hidden"':'')+'>WhatsApp Customer</span>';
 const attrs='class="'+esc(className)+'" data-customer-whatsapp title="'+esc(title)+'" aria-label="'+esc(title)+'"';
 return href?'<a '+attrs+' href="'+href+'" target="_blank" rel="noopener noreferrer">'+content+'</a>':'<button '+attrs+' type="button" disabled aria-disabled="true">'+content+'</button>';
}
return Object.freeze({phone,url,action});
});
