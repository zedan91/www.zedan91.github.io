'use strict';
(() => {
 if(window.AZOBSSWhatsappTarget1552)return;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const visible=el=>!!(el&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
 const text=el=>String(el?.value??el?.innerText??el?.textContent??'').replace(/[\u200b-\u200f\uFEFF]/g,'').trim();
 const digits=value=>String(value||'').replace(/\D/g,'');
 const fault=(code,message)=>Object.assign(new Error(message),{code});
 let proof=null,task=null;
 function header(){return document.querySelector('#main header');}
 function signature(el){return el?text(el)+'|'+[...el.querySelectorAll('[title],[data-jid]')].map(n=>n.getAttribute('data-jid')||n.getAttribute('title')).join('|'):'';}
 function hasPhone(node,phone){
  if(!node)return false;
  return [node,...node.querySelectorAll('[title],span,p,a,div')].some(el=>{
   if(!visible(el))return false;
   const value=String(el.getAttribute?.('title')||text(el));
   return /^[+\d\s().-]{8,28}$/.test(value)&&digits(value)===phone;
  });
 }
 function phoneInChat(phone){
  const head=header();if(!head||!visible(head))return false;
  if(/@g\.us/.test(String(document.querySelector('#main')?.getAttribute('data-jid')||document.querySelector('#main')?.getAttribute('data-id')||'')))return false;
  if(hasPhone(head,phone))return true;
  const ids=[head.getAttribute('data-jid'),document.querySelector('#main')?.getAttribute('data-jid'),document.querySelector('#main')?.getAttribute('data-id')].filter(Boolean);
  return ids.some(id=>{const match=String(id).match(/(?:^|_)([\d-]+)@(c\.us|s\.whatsapp\.net|g\.us)(?:_|$)/);return match&&match[2]!=='g.us'&&match[1]===phone;});
 }
 function remember(phone){const el=header();if(!el)throw fault('chat_not_ready','Chat pelanggan belum siap.');proof={phone,header:el,signature:signature(el),at:Date.now()};return true;}
 function current(phone){return phoneInChat(phone)||!!(proof&&proof.phone===phone&&proof.header===header()&&proof.header.isConnected&&proof.signature===signature(header())&&Date.now()-proof.at<10000);}
 function existingDraft(){const composer=document.querySelector('#main footer [contenteditable="true"],#main footer textarea');return !!(composer&&text(composer));}
 async function edit(box,value){
  box.focus();
  if(box.matches('input,textarea')){const proto=box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(box,value);box.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}
  else{const range=document.createRange(),sel=window.getSelection();range.selectNodeContents(box);sel.removeAllRanges();sel.addRange(range);if(!document.execCommand('insertText',false,value))throw fault('search_input_failed','Carian nombor WhatsApp belum dapat diisi.');}
  await sleep(850);if(digits(text(box))!==digits(value))throw fault('search_input_failed','Carian nombor WhatsApp berubah. Cuba semula secara manual.');
 }
 function button(selectors){for(const selector of selectors){const el=[...document.querySelectorAll(selector)].find(visible);if(el)return el.closest('button,[role="button"]')||el;}return null;}
 async function openByNumber(phone){
  const start=button(['button[aria-label="New chat"]','[role="button"][aria-label="New chat"]','[title="New chat"]','[aria-label="Sembang baharu"]','[aria-label="Chat baharu"]','[aria-label="Chat baru"]','span[data-icon="new-chat-outline"]','span[data-icon="new-chat"]','span[data-icon="chat"]']);
  if(!start)throw fault('chat_launcher_unavailable','WhatsApp belum memaparkan New chat. Pastikan WhatsApp sudah login dan tiada popup sesi.');
  start.click();let box=null;
  for(let i=0;i<35&&!box;i++){await sleep(150);box=[...document.querySelectorAll('input[placeholder],input[aria-label],[contenteditable="true"][role="textbox"]')].find(el=>visible(el)&&!el.closest('#main')&&/search|cari|nama|number|nombor/i.test([el.getAttribute('aria-label'),el.getAttribute('data-placeholder'),el.getAttribute('placeholder')].join(' ')));}
  if(!box)throw fault('phone_search_unavailable','Ruangan carian kenalan WhatsApp tidak ditemui.');
  await edit(box,'+'+phone);
  for(let i=0;i<35;i++){
   if(!box.isConnected||digits(text(box))!==phone)throw fault('phone_search_changed','Carian penerima berubah. PDF tidak dilampirkan.');
   const allRows=[...document.querySelectorAll('[role="listitem"],[role="row"],[data-testid="cell-frame-container"]')].filter(el=>visible(el)&&!el.closest('#main')&&!el.contains(box)&&!/^(new (?:group|contact|community)|kenalan (?:baru|baharu)|kumpulan (?:baru|baharu)|invite to whatsapp|jemput)/i.test(text(el)));
   const rows=allRows.filter(el=>!allRows.some(other=>other!==el&&el.contains(other)));
   const matching=rows.filter(el=>hasPhone(el,phone));
   let result=matching.length===1?matching[0]:null;
   // A saved contact can hide its number in search results. A unique result from
   // this exact phone query is opened, then independently verified in Contact info.
   if(!result&&matching.length===0&&rows.length===1)result=rows[0];
   if(result){result.click();await sleep(400);return;}
   await sleep(220);
  }
  throw fault('recipient_not_found','Nombor pelanggan belum ditemui di WhatsApp. Semak kod negara dan akaun WhatsApp pelanggan.');
 }
 async function verifyInfo(phone){
  if(phoneInChat(phone))return remember(phone);
  const head=header();if(!head)return false;
  const title=[...head.querySelectorAll('[data-testid="conversation-info-header"],span[title]')].find(el=>visible(el)&&text(el)&&!/call|panggil|search|cari|menu/i.test(el.getAttribute('title')||''));
  if(!title)return false;
  title.click();let pane=null;
  for(let i=0;i<25&&!pane;i++){
   await sleep(150);
   const named=[...document.querySelectorAll('h1,h2,h3,[role="heading"],span,div')].filter(el=>visible(el)&&/^(Contact info|Info kontak|Maklumat kenalan|Info kenalan)$/i.test(text(el)));
   for(const label of named){let p=label.parentElement;for(let j=0;p&&p!==document.body&&j<8;j++,p=p.parentElement){if(p.querySelector('#main,#pane-side'))break;const numberVisible=hasPhone(p,phone)||[...p.querySelectorAll('span,p,a')].some(el=>visible(el)&&/^\+[\d\s().-]{7,26}$/.test(text(el)));if(numberVisible&&p.querySelector('[aria-label="Close"],[aria-label="Tutup"],[data-icon="x"]')){pane=p;break;}}if(pane)break;}
  }
  if(!pane)return false;
  const matched=hasPhone(pane,phone),close=[...pane.querySelectorAll('[aria-label="Close"],[aria-label="Tutup"],[data-icon="x"]')].find(visible);
  if(close)(close.closest('button,[role="button"]')||close).click();
  if(!matched)return false;
  return remember(phone);
 }
 async function ensure(phone){
  if(!/^[1-9]\d{7,14}$/.test(phone))throw fault('invalid_phone','Nombor pelanggan tidak sah.');
  if(task){if(task.phone===phone)return task.promise;throw fault('chat_busy','Chat pelanggan lain sedang disediakan.');}
  const promise=(async()=>{
   if(existingDraft())throw fault('unfinished_draft','Selesaikan draf WhatsApp dahulu. Ia tidak akan dipadam secara automatik.');
   if(current(phone))return remember(phone);
   if(await verifyInfo(phone))return true;
   await openByNumber(phone);
   if(!await verifyInfo(phone))throw fault('recipient_unverified','Chat dibuka tetapi nombor penerima belum dapat disahkan. PDF dan nota tidak dilampirkan untuk mengelakkan tersalah pelanggan.');
   return true;
  })();task={phone,promise};try{return await promise;}finally{if(task?.promise===promise)task=null;}
 }
 window.AZOBSSWhatsappTarget1552=Object.freeze({ensure,current});
})();
