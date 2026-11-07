'use strict';

const ext = typeof browser !== 'undefined' ? browser : chrome;
const BRIDGE_VERSION = 1552;
const pendingByWhatsappTab = new Map();
const pdfRequests=new Map();
const router=createAzobssWhatsappTabRouter1545(ext,{pendingTabs:pendingByWhatsappTab});

function cleanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('60')) return digits;
  if (digits.startsWith('0')) return '6' + digits;
  return digits;
}

function safeFilename(value) {
  const name = String(value || 'AZOBSS-Document.pdf').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim();
  return name.toLowerCase().endsWith('.pdf') ? name : `${name || 'AZOBSS-Document'}.pdf`;
}

function validAzobssSender(sender) {
  if(!Number.isInteger(sender?.tab?.id)||sender.frameId>0)return false;
  try {
    const u = new URL(sender?.url || '');
    return ['https://azobss.com','https://www.azobss.com'].includes(u.origin) && /^\/admin(?:\/|$)/i.test(u.pathname);
  } catch (_) {
    return false;
  }
}

async function forwardStatus(entry, status, message, extra = {}) {
  if (!entry?.sourceTabId) return;
  try {
    await ext.tabs.sendMessage(entry.sourceTabId, {
      type: 'AZOBSS_FIREFOX_WA_PDF_BRIDGE_STATUS',
      bridgeVersion: BRIDGE_VERSION,
      requestId: entry.requestId,
      status,
      message: String(message || ''),
      ...extra
    });
  } catch (_) {}
}

ext.runtime.onMessage.addListener((message, sender) => {
  const type = String(message?.type || '');

  if(type==='AZOBSS_FIREFOX_WA_CONTACT_PING')return Promise.resolve(validAzobssSender(sender)?{ok:true,bridgeVersion:BRIDGE_VERSION,tabReuse:true}:{ok:false});
  if(type==='AZOBSS_FIREFOX_WA_OPEN_CHAT')return router.route(sender,{phone:message.phone,home:message.home===true,requestId:message.requestId}).catch(error=>({ok:false,bridgeVersion:BRIDGE_VERSION,error:error.message,code:error.code}));

  if (type === 'AZOBSS_FIREFOX_WA_PDF_SHARE') {
    return (async () => {
      if (!validAzobssSender(sender)) return { ok: false, error: 'AZOBSS admin sender validation failed.' };

      const requestId = String(message.requestId || '').trim();
      const dataUrl = String(message.dataUrl || '');
      const caption = String(message.caption || '');
      if(caption.length>12000)return {ok:false,error:'Nota terlalu panjang untuk bridge. Gunakan nota yang disalin untuk tampal secara manual.'};
      const filename = safeFilename(message.filename);
      const phone = cleanPhone(message.phone);
      if(!phone)return {ok:false,error:'A valid customer phone is required before attaching a PDF.'};

      if (!requestId) return { ok: false, error: 'Missing request ID.' };
      if(!/^[-a-zA-Z0-9_]{1,120}$/.test(requestId))return {ok:false,error:'Invalid request ID.'};
      if(!caption.trim())return {ok:false,error:'Nota dokumen kosong. Refresh AZOBSS Admin untuk menggunakan versi baharu.'};
      if (!/^data:application\/pdf;base64,/i.test(dataUrl)) return { ok: false, error: 'Invalid PDF payload.' };
      if (dataUrl.length > 12 * 1024 * 1024) return { ok: false, error: 'PDF is too large for the Firefox bridge.' };

      const now=Date.now();
      for(const [key,item] of pdfRequests)if(now-item.createdAt>10*60*1000)pdfRequests.delete(key);
      const key=sender.tab.id+':'+requestId,previous=pdfRequests.get(key);
      if(previous)return {ok:!['error','closed'].includes(previous.phase),duplicate:true,bridgeVersion:BRIDGE_VERSION,status:previous.phase,error:previous.phase==='error'?'Permintaan ini sudah dihentikan; tiada retry automatik.':''};
      if(pdfRequests.size>=256)return {ok:false,error:'Terlalu banyak permintaan PDF. Tunggu sebentar.'};
      let entry={requestId,sourceTabId:sender.tab.id,filename,mimeType:'application/pdf',dataUrl,caption,phone,createdAt:now,phase:'opening'};
      pdfRequests.set(key,entry);
      const result=await router.route(sender,{phone,home:!phone,requestId,beforeNavigate:async tab=>{
        entry.whatsappTabId=tab.id;entry.phase='opening';
        pendingByWhatsappTab.set(tab.id, entry);
      }}).catch(error=>{if(entry){entry.phase='error';entry.dataUrl='';entry.caption='';pendingByWhatsappTab.delete(entry.whatsappTabId);}throw error;});
      const tab={id:result.whatsappTabId};
      if(!result.phoneVerified||result.phone!==phone||!result.instanceId){entry.phase='error';entry.dataUrl='';entry.caption='';pendingByWhatsappTab.delete(tab.id);throw new Error('Penerima WhatsApp belum disahkan. PDF tidak dilampirkan.');}
      entry.instanceId=result.instanceId;entry.phase='queued';
      await forwardStatus(entry, 'opened', 'Chat pelanggan disahkan. PDF dan nota sedang disediakan sekali sahaja.');
      await ext.tabs.sendMessage(tab.id,{type:'AZOBSS_WA_PDF_WAKE_1552'}).catch(()=>{});
      return { ok: true, bridgeVersion: BRIDGE_VERSION, whatsappTabId: tab.id };
    })().catch(error => ({ ok: false, error: error?.message || String(error) }));
  }

  if (type === 'AZOBSS_FIREFOX_WA_PDF_CLAIM') {
    if(!router.whatsappUrl(sender?.url)||sender.frameId>0||message.bridgeVersion!==BRIDGE_VERSION)return Promise.resolve({ok:false,pending:false});
    const tabId = sender.tab?.id;
    const entry = pendingByWhatsappTab.get(tabId);
    if (!entry) return Promise.resolve({ ok: false, pending: false });
    if(message.instanceId!==entry.instanceId||message.phone!==entry.phone)return Promise.resolve({ok:false,pending:false});
    if(entry.phase!=='queued')return Promise.resolve({ok:true,pending:false});
    if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
      pendingByWhatsappTab.delete(tabId);
      entry.phase='error';entry.dataUrl='';entry.caption='';
      return Promise.resolve({ ok: false, pending: false, error: 'Share request expired.' });
    }
    // Claim synchronously before answering: polling, reloads and duplicate content
    // scripts can never receive the same bytes twice, even after an error.
    entry.phase='claimed';
    const payload={
      ok: true,
      pending: true,
      bridgeVersion: BRIDGE_VERSION,
      requestId: entry.requestId,
      filename: entry.filename,
      mimeType: entry.mimeType,
      dataUrl: entry.dataUrl,
      caption: entry.caption,
      phone: entry.phone
    };
    entry.dataUrl='';entry.caption='';
    return Promise.resolve(payload);
  }

  if (type === 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS') {
    if(!router.whatsappUrl(sender?.url))return Promise.resolve({ok:false});
    const tabId = sender.tab?.id;
    const entry = pendingByWhatsappTab.get(tabId);
    if (!entry||entry.requestId!==message.requestId||sender.frameId>0) return Promise.resolve({ ok: false });
    const status = String(message.status || '');
    if(!['attached','needs-caption','error'].includes(status))return Promise.resolve({ok:false});
    const text = String(message.message || '');
    const extra = { filename: entry.filename, whatsappTabId: tabId };
    entry.phase=status;entry.dataUrl='';entry.caption='';
    pendingByWhatsappTab.delete(tabId);
    return forwardStatus(entry, status, text, extra).then(() => ({ ok: true }));
  }

  return undefined;
});

ext.tabs.onRemoved.addListener(tabId => {
  const entry = pendingByWhatsappTab.get(tabId);
  if (!entry) return;
  pendingByWhatsappTab.delete(tabId);
  entry.phase='closed';entry.dataUrl='';entry.caption='';
  forwardStatus(entry, 'closed', 'Tab WhatsApp Web ditutup sebelum PDF selesai dilampirkan.').catch(() => {});
});

setInterval(()=>{for(const [tabId,entry] of pendingByWhatsappTab){if(Date.now()-entry.createdAt>10*60*1000){pendingByWhatsappTab.delete(tabId);entry.phase='error';entry.dataUrl='';entry.caption='';forwardStatus(entry,'error','Permintaan PDF tamat. Tiada retry automatik.').catch(()=>{});}}},30000);

console.log(`[AZOBSS] Firefox WhatsApp PDF Bridge v${BRIDGE_VERSION} background ready`);
