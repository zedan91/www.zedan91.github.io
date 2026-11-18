(function(){
 'use strict';
 const icons={"wa": "<svg viewBox=\"0 0 448 512\" aria-hidden=\"true\"><path d=\"M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z\"/></svg>", "tg": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M21.8 4.2 18.6 19c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 12.5 1.1 11c-1.1-.3-1.1-1.1.2-1.6L20.4 2c.9-.3 1.7.2 1.4 2.2z\"/></svg>", "fb": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M14.2 8.2V6.9c0-.7.5-.9.9-.9h2V2.6l-2.8-.1c-3.1 0-4.8 1.9-4.8 5.2v.5H6.6v3.8h2.9v9.5h4.1v-9.5h3.1l.5-3.8h-3z\"/></svg>", "ms": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 2.8C6.8 2.8 2.8 6.6 2.8 11.7c0 2.7 1.1 5 3 6.6v3l2.9-1.6c1 .3 2.1.6 3.3.6 5.2 0 9.2-3.8 9.2-8.9S17.2 2.8 12 2.8zm.9 11.7-2.3-2.4-4.4 2.4 4.8-5.1 2.4 2.4 4.3-2.4-4.8 5.1z\"/></svg>", "th": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12.3 2C6.4 2 3 5.8 3 12.2 3 18.4 6.5 22 12.4 22c5.1 0 8.5-2.8 8.5-7 0-3.2-1.9-5.2-5.1-5.7-.4-2.4-1.9-3.7-4.4-3.7-2.1 0-3.8.9-4.8 2.5l2.1 1.5c.6-.9 1.5-1.5 2.6-1.5 1.3 0 2 .6 2.2 1.8h-1.9c-3 0-5 1.7-5 4.2 0 2.3 1.8 4 4.4 4 3 0 4.8-1.9 5-5.1 1.5.4 2.3 1.3 2.3 2.8 0 2.5-2.3 4.1-5.8 4.1-4.4 0-6.8-2.8-6.8-7.6 0-4.9 2.3-7.8 6.6-7.8 3 0 5.1 1.4 6.4 4.1l2.3-1.2C19.4 3.9 16.5 2 12.3 2zm-.8 13.9c-1.3 0-2.1-.7-2.1-1.8 0-1.2.9-2 2.4-2h2c-.1 2.5-.9 3.8-2.3 3.8z\"/></svg>", "li": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.4 8.1h4.2V24H.4zM8.1 8.1h4v2.2h.1c.6-1.1 2-2.6 4.2-2.6 4.5 0 5.3 3 5.3 6.8V24h-4.2v-8.4c0-2 0-4.5-2.8-4.5s-3.2 2.2-3.2 4.4V24H7.3z\" transform=\"scale(.9) translate(1 0)\"/></svg>", "x": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M14.3 10.4 22.1 2h-1.9l-6.8 7.3L8 2H1.8l8.2 11-8.2 8.9h1.9l7.1-7.7 5.7 7.7h6.2l-8.4-11.5zm-2.5 2.7-.8-1.1L4.4 3.4h2.7l5.3 7 .8 1.1 6.9 9h-2.7l-5.6-7.4z\"/></svg>", "em": "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm8 7.4L4.2 7.2V17h15.6V7.2L12 12.4zm0-2.2L18.8 7H5.2L12 10.2z\"/></svg>"};
 let active=null;
 function open(payload,trigger){
  if(active){active.close();active.remove();}
  const url=new URL(payload.url,location.origin);
  if(!['http:','https:'].includes(url.protocol))return;
  const link=url.href,title=String(payload.title||'AZOBSS Tech Product'),text=String(payload.text||title);
  const enc=encodeURIComponent;
  const targets=[
   ['wa','WhatsApp','https://wa.me/?text='+enc(text+'\n'+link)],
   ['tg','Telegram','https://t.me/share/url?url='+enc(link)+'&text='+enc(text)],
   ['fb','Facebook','https://www.facebook.com/sharer/sharer.php?u='+enc(link)],
   ['ms','Messenger','https://www.messenger.com/t/?link='+enc(link)],
   ['th','Threads','https://www.threads.net/intent/post?text='+enc(text+'\n'+link)],
   ['li','LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+enc(link)],
   ['x','X','https://twitter.com/intent/tweet?text='+enc(text)+'&url='+enc(link)],
   ['em','Email','mailto:?subject='+enc(title)+'&body='+enc(text+'\n\n'+link)]
  ];
  const dialog=document.createElement('dialog');dialog.className='az-pc-share-dialog';
  dialog.setAttribute('aria-labelledby','azPcShareHeading');
  dialog.innerHTML='<header><h2 id="azPcShareHeading">Share product link</h2><button type="button" data-share-close aria-label="Close share popup">×</button></header><p class="az-pc-share-product"></p><div class="az-pc-share-platforms"></div><label for="azPcShareLink">Copy product link</label><div class="az-pc-share-copy"><input id="azPcShareLink" readonly><button type="button" data-share-copy aria-label="Copy link" title="Copy link">⧉</button></div><p class="az-pc-share-note" role="status" aria-live="polite"></p>';
  dialog.querySelector('.az-pc-share-product').textContent=title;
  dialog.querySelector('input').value=link;
  const list=dialog.querySelector('.az-pc-share-platforms');
  for(const [key,name,href] of targets){
   const a=document.createElement('a');a.className='az-pc-share-platform '+key;
   a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.title=name;a.setAttribute('aria-label',name);
   a.innerHTML=icons[key];list.append(a);
  }
  const previous=trigger||document.activeElement;
  const note=dialog.querySelector('.az-pc-share-note'),input=dialog.querySelector('input');
  dialog.querySelector('[data-share-copy]').addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(link);note.textContent='Product link copied.';}
   catch{input.focus();input.select();note.textContent='Pilih pautan ini dan tekan Ctrl+C untuk salin.';}
  });
  dialog.querySelector('[data-share-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{if(active===dialog)active=null;dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});
  document.body.append(dialog);active=dialog;dialog.showModal();dialog.querySelector('[data-share-close]').focus();
 }
 window.AZOBSSPcShare={open};
})();
