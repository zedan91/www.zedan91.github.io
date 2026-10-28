'use strict';

(() => {
  const ext = typeof browser !== 'undefined' ? browser : chrome;
  const BRIDGE_VERSION = 1318;
  const READY_ATTR = 'data-azobss-firefox-whatsapp-pdf-bridge';

  function announceReady() {
    try {
      document.documentElement?.setAttribute(READY_ATTR, String(BRIDGE_VERSION));
      window.postMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_READY',
        bridgeVersion: BRIDGE_VERSION
      }, location.origin);
    } catch (_) {}
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
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
