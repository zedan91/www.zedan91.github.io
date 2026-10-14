'use strict';

const ext = typeof browser !== 'undefined' ? browser : chrome;
const BRIDGE_VERSION = 1318;
const pendingByWhatsappTab = new Map();

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
  try {
    const u = new URL(sender?.url || '');
    return (u.hostname === 'azobss.com' || u.hostname === 'www.azobss.com') && /^\/admin(?:\/|$)/i.test(u.pathname);
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

  if (type === 'AZOBSS_FIREFOX_WA_PDF_SHARE') {
    return (async () => {
      if (!validAzobssSender(sender)) return { ok: false, error: 'AZOBSS admin sender validation failed.' };

      const requestId = String(message.requestId || '').trim();
      const dataUrl = String(message.dataUrl || '');
      const caption = String(message.caption || '').slice(0, 12000);
      const filename = safeFilename(message.filename);
      const phone = cleanPhone(message.phone);

      if (!requestId) return { ok: false, error: 'Missing request ID.' };
      if (!/^data:application\/pdf;base64,/i.test(dataUrl)) return { ok: false, error: 'Invalid PDF payload.' };
      if (dataUrl.length > 12 * 1024 * 1024) return { ok: false, error: 'PDF is too large for the Firefox bridge.' };

      const target = phone
        ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&type=phone_number&app_absent=0`
        : 'https://web.whatsapp.com/';

      const tab = await ext.tabs.create({ url: target, active: true });
      const entry = {
        requestId,
        sourceTabId: sender.tab?.id || null,
        whatsappTabId: tab.id,
        filename,
        mimeType: 'application/pdf',
        dataUrl,
        caption,
        phone,
        createdAt: Date.now()
      };
      pendingByWhatsappTab.set(tab.id, entry);
      await forwardStatus(entry, 'opened', 'WhatsApp Web dibuka. AZOBSS sedang menyediakan PDF sebenar untuk dilampirkan.');
      return { ok: true, bridgeVersion: BRIDGE_VERSION, whatsappTabId: tab.id };
    })().catch(error => ({ ok: false, error: error?.message || String(error) }));
  }

  if (type === 'AZOBSS_FIREFOX_WA_PDF_CLAIM') {
    const tabId = sender.tab?.id;
    const entry = pendingByWhatsappTab.get(tabId);
    if (!entry) return Promise.resolve({ ok: false, pending: false });
    if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
      pendingByWhatsappTab.delete(tabId);
      return Promise.resolve({ ok: false, pending: false, error: 'Share request expired.' });
    }
    return Promise.resolve({
      ok: true,
      pending: true,
      bridgeVersion: BRIDGE_VERSION,
      requestId: entry.requestId,
      filename: entry.filename,
      mimeType: entry.mimeType,
      dataUrl: entry.dataUrl,
      caption: entry.caption,
      phone: entry.phone
    });
  }

  if (type === 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS') {
    const tabId = sender.tab?.id;
    const entry = pendingByWhatsappTab.get(tabId);
    if (!entry) return Promise.resolve({ ok: false });
    const status = String(message.status || '');
    const text = String(message.message || '');
    const extra = { filename: entry.filename, whatsappTabId: tabId };
    if (status === 'attached') pendingByWhatsappTab.delete(tabId);
    return forwardStatus(entry, status, text, extra).then(() => ({ ok: true }));
  }

  return undefined;
});

ext.tabs.onRemoved.addListener(tabId => {
  const entry = pendingByWhatsappTab.get(tabId);
  if (!entry) return;
  pendingByWhatsappTab.delete(tabId);
  forwardStatus(entry, 'closed', 'Tab WhatsApp Web ditutup sebelum PDF selesai dilampirkan.').catch(() => {});
});

console.log(`[AZOBSS] Firefox WhatsApp PDF Bridge v${BRIDGE_VERSION} background ready`);
