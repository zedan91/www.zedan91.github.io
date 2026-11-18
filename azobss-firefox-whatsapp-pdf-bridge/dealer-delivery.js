'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createAzobssDealerDelivery1594=factory;})(typeof globalThis!=='undefined'?globalThis:this,function({messages,composer,verifyPhone,deliver,now=Date.now}){
  const normalize=value=>String(value||'').replace(/[\u200b-\u200f\uFEFF]/g,'').replace(/\s+/g,' ').trim();
  let watch=null,checking=false;
  function arm({phone,text,delivery}) {
    if(!delivery || !/^[a-f0-9-]{36}$/.test(delivery.reportId||'') || !/^[a-f0-9-]{36}$/.test(delivery.eventId||'') || !Number.isSafeInteger(delivery.manualRevision) || delivery.manualRevision<0)return false;
    watch={phone,text:normalize(text),delivery,expires:now()+86400000,intent:null};
    return true;
  }
  function intent(trusted) {
    if(!trusted || !watch || normalize(composer())!==watch.text)return false;
    watch.intent={at:now(),baseline:new Set(messages().map(row=>row.id))};
    return true;
  }
  async function tick() {
    if(checking || !watch || !watch.intent)return;
    if(now()>watch.expires){watch=null;return;}
    const current=watch;
    // No opening a draft, historical bubble, queued clock, or different text counts as sent.
    const row=messages().find(row=>row.outgoing && row.sent && row.id && !current.intent.baseline.has(row.id)
      && normalize(row.text)===current.text && (!row.phone || row.phone===current.phone));
    if(!row)return;
    checking=true;
    try {
      if(!await verifyPhone(current.phone) || watch!==current)return;
      const result=await deliver({...current.delivery,phone:current.phone,messageId:row.id});
      if(result?.ok && watch===current)watch=null;
    } finally {checking=false;}
  }
  return Object.freeze({arm,intent,tick});
});
