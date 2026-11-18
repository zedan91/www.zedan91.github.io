'use strict';
// Durable confirmation outbox: nothing is acknowledged until authenticated Admin saves it.
const dealerDelivery1594=(()=>{
  const ext=typeof browser!=='undefined'?browser:chrome;
  const watches=new Map();
  let queue=Promise.resolve();
  const serial=fn=>{const task=queue.then(fn);queue=task.catch(()=>{});return task;};
  const admin=sender=>{try{return sender.frameId<=0 && Number.isInteger(sender.tab?.id) && ['https://azobss.com','https://www.azobss.com'].includes(new URL(sender.url).origin) && /^\/admin(?:\/|$)/.test(new URL(sender.url).pathname);}catch{return false;}};
  const key='azobssDealerSentOutbox1594';
  async function broadcast() {
    const outbox=(await ext.storage.local.get(key))[key]||[];
    const tabs=await ext.tabs.query({url:['https://azobss.com/admin/*','https://www.azobss.com/admin/*']});
    for(const tab of tabs) for(const receipt of outbox) {
      try {await ext.tabs.sendMessage(tab.id,{type:'AZOBSS_PC_DEALER_SENT_1594',receipt});}catch{}
    }
  }
  function register(tabId,requestId,phone,delivery) {
    if(!delivery)return;
    if(!/^[a-f0-9-]{36}$/.test(delivery.reportId||'') || !/^[a-f0-9-]{36}$/.test(delivery.eventId||'') || !Number.isSafeInteger(delivery.manualRevision) || delivery.manualRevision<0)throw Error('Invalid dealer send tracking.');
    for(const [id,value] of watches)if(value.expires<Date.now())watches.delete(id);
    watches.set(requestId,{tabId,phone,delivery,expires:Date.now()+86400000});
  }
  ext.runtime.onMessage.addListener((message,sender)=>{
    if(message?.type==='AZOBSS_PC_DEALER_SENT_READY_1594' && admin(sender))return broadcast().then(()=>({ok:true}));
    if(message?.type==='AZOBSS_PC_DEALER_SENT_ACK_1594' && admin(sender))return serial(async()=>{
      const outbox=(await ext.storage.local.get(key))[key]||[];
      await ext.storage.local.set({[key]:outbox.filter(row=>row.eventId!==message.eventId)});
      return {ok:true};
    });
    if(message?.type!=='AZOBSS_WA_DEALER_SENT_1594')return;
    return serial(async()=>{
      const watch=watches.get(message.requestId), receipt=message.receipt;
      if(sender.frameId>0 || !/^https:\/\/web\.whatsapp\.com\//.test(sender.url||'') || !watch || watch.tabId!==sender.tab?.id || watch.expires<Date.now()
        || receipt?.phone!==watch.phone || receipt?.eventId!==watch.delivery.eventId || typeof receipt.messageId!=='string' || !receipt.messageId.startsWith('true_'))return {ok:false};
      const outbox=(await ext.storage.local.get(key))[key]||[];
      if(!outbox.some(row=>row.eventId===watch.delivery.eventId))outbox.push({...watch.delivery,phone:watch.phone});
      await ext.storage.local.set({[key]:outbox});
      watches.delete(message.requestId);
      void broadcast().catch(()=>{});
      return {ok:true};
    });
  });
  setInterval(()=>void broadcast().catch(()=>{}),15000);
  return Object.freeze({register});
})();
