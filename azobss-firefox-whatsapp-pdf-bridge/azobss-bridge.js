'use strict';

(() => {
  const ext = typeof browser !== 'undefined' ? browser : chrome;
  const BRIDGE_VERSION = 1552;
  const READY_ATTR = 'data-azobss-firefox-whatsapp-pdf-bridge';

  async function announceReady() {
    try{const response=await ext.runtime.sendMessage({type:'AZOBSS_FIREFOX_WA_CONTACT_PING'});if(!response?.ok||!response.tabReuse)return;document.documentElement?.setAttribute('data-azobss-firefox-whatsapp-tab-reuse',String(BRIDGE_VERSION));}catch{return;}
    try {
      document.documentElement?.setAttribute(READY_ATTR, String(BRIDGE_VERSION));
      document.documentElement?.setAttribute('data-azobss-firefox-whatsapp-extension-version',ext.runtime.getManifest().version);
      window.postMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_READY',
        bridgeVersion: BRIDGE_VERSION
      }, location.origin);
    } catch (_) {}
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if(data?.type==='AZOBSS_FIREFOX_WA_OPEN_CHAT_REQUEST'){
      ext.runtime.sendMessage({type:'AZOBSS_FIREFOX_WA_OPEN_CHAT',requestId:String(data.requestId||''),phone:data.phone,home:data.home===true}).then(response=>{
        window.postMessage({type:'AZOBSS_FIREFOX_WA_OPEN_CHAT_STATUS',requestId:data.requestId,ok:response?.ok===true,error:response?.error||'',phoneVerified:response?.phoneVerified===true,phone:response?.phone||'',reused:response?.reused===true,bridgeVersion:BRIDGE_VERSION},location.origin);
      }).catch(error=>window.postMessage({type:'AZOBSS_FIREFOX_WA_OPEN_CHAT_STATUS',requestId:data.requestId,ok:false,error:String(error?.message||error),bridgeVersion:BRIDGE_VERSION},location.origin));return;
    }
    if (!data || data.type !== 'AZOBSS_FIREFOX_WA_PDF_SHARE_REQUEST') return;

    const requestId = String(data.requestId || '');
    ext.runtime.sendMessage({
      type: 'AZOBSS_FIREFOX_WA_PDF_SHARE',
      requestId,
      filename: data.filename,
      dataUrl: data.dataUrl,
      caption: data.caption,
      phone: data.phone
    }).then(response => {
      window.postMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_STATUS',
        bridgeVersion: BRIDGE_VERSION,
        requestId,
        status: response?.ok ? 'accepted' : 'error',
        message: response?.ok
          ? 'Firefox bridge menerima PDF dan membuka WhatsApp Web.'
          : (response?.error || 'Firefox bridge gagal menerima PDF.')
      }, location.origin);
    }).catch(error => {
      window.postMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_STATUS',
        bridgeVersion: BRIDGE_VERSION,
        requestId,
        status: 'error',
        message: error?.message || String(error)
      }, location.origin);
    });
  });

  ext.runtime.onMessage.addListener(message => {
    if (message?.type !== 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_STATUS') return;
    window.postMessage({
      type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_STATUS',
      bridgeVersion: BRIDGE_VERSION,
      requestId: message.requestId,
      status: message.status,
      message: message.message,
      filename: message.filename,
      whatsappTabId: message.whatsappTabId
    }, location.origin);
  });

  announceReady();
  document.addEventListener('DOMContentLoaded', announceReady, { once: true });
  setTimeout(announceReady, 750);
})();
