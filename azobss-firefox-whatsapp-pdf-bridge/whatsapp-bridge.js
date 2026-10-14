'use strict';

(() => {
  const ext = typeof browser !== 'undefined' ? browser : chrome;
  const BRIDGE_VERSION = 1318;
  let busy = false;
  let completedRequestId = '';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function showBadge(text, tone = 'info') {
    let node = document.getElementById('azobss-firefox-wa-pdf-status');
    if (!node) {
      node = document.createElement('div');
      node.id = 'azobss-firefox-wa-pdf-status';
      node.style.cssText = 'position:fixed;z-index:2147483647;right:18px;bottom:18px;max-width:430px;padding:13px 15px;border-radius:12px;color:#fff;font:600 14px/1.4 Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.38);white-space:pre-wrap;';
      document.documentElement.appendChild(node);
    }
    const bg = tone === 'good' ? '#15803d' : tone === 'error' ? '#b91c1c' : '#075985';
    node.style.background = bg;
    node.textContent = text;
  }

  function dataUrlToFile(dataUrl, filename, mimeType) {
    const raw = String(dataUrl || '');
    const comma = raw.indexOf(',');
    if (comma < 0) throw new Error('Invalid PDF payload.');
    const binary = atob(raw.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename || 'AZOBSS-Document.pdf', { type: mimeType || 'application/pdf', lastModified: Date.now() });
  }

  function findAttachButton() {
    const selectors = [
      'button[aria-label="Attach"]',
      '[role="button"][aria-label="Attach"]',
      'button[title="Attach"]',
      '[role="button"][title="Attach"]',
      'span[data-icon="plus-rounded"]',
      'span[data-icon="plus"]',
      'span[data-icon="clip"]'
    ];
    for (const selector of selectors) {
      const match = [...document.querySelectorAll(selector)].find(visible);
      if (!match) continue;
      return match.closest('button,[role="button"]') || match;
    }
    return null;
  }

  function findDocumentMenuButton() {
    const selectors = [
      '[aria-label="Document"]',
      '[title="Document"]',
      '[role="button"][aria-label*="document" i]',
      '[role="menuitem"][aria-label*="document" i]'
    ];
    for (const selector of selectors) {
      const match = [...document.querySelectorAll(selector)].find(visible);
      if (match) return match.closest('button,[role="button"],[role="menuitem"]') || match;
    }
    const textMatch = [...document.querySelectorAll('[role="button"],[role="menuitem"],button,li')]
      .find(el => visible(el) && /^document$/i.test(String(el.innerText || el.textContent || '').trim()));
    return textMatch || null;
  }

  function chooseDocumentInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    if (!inputs.length) return null;
    const scored = inputs.map(input => {
      const accept = String(input.getAttribute('accept') || '').toLowerCase();
      let score = 0;
      if (!accept || accept === '*' || accept === '*/*') score += 8;
      if (/application\/pdf|\.pdf|application\/\*/.test(accept)) score += 10;
      if (/image|video/.test(accept) && !/application|pdf/.test(accept)) score -= 12;
      if (input.multiple) score += 1;
      return { input, score };
    }).sort((a, b) => b.score - a.score);
    return scored[0]?.score >= 0 ? scored[0].input : null;
  }

  function setInputFile(input, file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function findPreviewCaptionBox() {
    const candidates = [...document.querySelectorAll('[contenteditable="true"][role="textbox"], div[contenteditable="true"]')].filter(visible);
    if (!candidates.length) return null;
    const send = findSendButton();
    if (send) {
      const sendRect = send.getBoundingClientRect();
      const nearby = candidates
        .map(el => ({ el, rect: el.getBoundingClientRect() }))
        .filter(x => Math.abs(x.rect.bottom - sendRect.bottom) < 180 || Math.abs(x.rect.top - sendRect.top) < 180)
        .sort((a, b) => Math.abs(a.rect.left - sendRect.left) - Math.abs(b.rect.left - sendRect.left));
      if (nearby.length) return nearby[0].el;
    }
    return candidates[candidates.length - 1];
  }

  function findSendButton() {
    const selectors = [
      'button[aria-label="Send"]',
      '[role="button"][aria-label="Send"]',
      'span[data-icon="send"]',
      'span[data-icon="send-filled"]'
    ];
    for (const selector of selectors) {
      const match = [...document.querySelectorAll(selector)].find(visible);
      if (match) return match.closest('button,[role="button"]') || match;
    }
    return null;
  }

  function fillCaption(box, text) {
    const value = String(text || '').trim();
    if (!box || !value) return false;
    box.focus();
    let ok = false;
    try {
      document.execCommand('selectAll', false, null);
      ok = document.execCommand('insertText', false, value);
    } catch (_) {}
    if (!ok || !String(box.innerText || box.textContent || '').trim()) {
      box.textContent = value;
      try {
        box.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: value }));
      } catch (_) {
        box.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      }
    }
    return true;
  }

  async function waitForChatReady(timeoutMs = 90000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (findAttachButton()) return true;
      showBadge('AZOBSS: menunggu WhatsApp Web siap / login…');
      await sleep(1200);
    }
    return false;
  }

  async function attachPayload(payload) {
    if (busy || !payload?.requestId || completedRequestId === payload.requestId) return;
    busy = true;
    try {
      showBadge(`AZOBSS: menyediakan ${payload.filename} sebagai fail PDF sebenar…`);
      const chatReady = await waitForChatReady();
      if (!chatReady) throw new Error('WhatsApp Web belum siap selepas 90 saat. Pastikan kamu sudah login dan chat customer boleh dibuka.');

      const file = dataUrlToFile(payload.dataUrl, payload.filename, payload.mimeType);
      const attach = findAttachButton();
      if (!attach) throw new Error('Butang attachment WhatsApp tidak ditemui.');
      attach.click();

      let input = null;
      let documentMenuClicked = false;
      for (let i = 0; i < 35 && !input; i++) {
        await sleep(180);
        input = chooseDocumentInput();
        if (!input && !documentMenuClicked && i >= 5) {
          const documentButton = findDocumentMenuButton();
          if (documentButton) {
            documentMenuClicked = true;
            documentButton.click();
          }
        }
      }
      if (!input) throw new Error('Input Document WhatsApp tidak ditemui. WhatsApp Web mungkin sudah mengubah UI.');
      setInputFile(input, file);

      let send = null;
      let filenameVisible = false;
      for (let i = 0; i < 55; i++) {
        await sleep(220);
        filenameVisible = String(document.body?.innerText || '').includes(payload.filename);
        send = filenameVisible ? findSendButton() : null;
        if (send && filenameVisible) break;
      }
      if (!filenameVisible || !send) throw new Error('Preview PDF WhatsApp tidak muncul selepas attachment dipilih.');

      const caption = findPreviewCaptionBox();
      if (caption && payload.caption) fillCaption(caption, payload.caption);

      completedRequestId = payload.requestId;
      showBadge(`AZOBSS: ${payload.filename} sudah dilampirkan ✅\nSemak preview dan tekan Send.`, 'good');
      await ext.runtime.sendMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS',
        requestId: payload.requestId,
        status: 'attached',
        message: `${payload.filename} sudah dilampirkan sebagai physical PDF. Semak preview dan tekan Send.`
      }).catch(() => {});
    } catch (error) {
      showBadge(`AZOBSS PDF gagal dilampirkan:\n${error?.message || error}`, 'error');
      await ext.runtime.sendMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS',
        requestId: payload?.requestId,
        status: 'error',
        message: error?.message || String(error)
      }).catch(() => {});
    } finally {
      busy = false;
    }
  }

  async function pump() {
    if (busy) return;
    try {
      const response = await ext.runtime.sendMessage({ type: 'AZOBSS_FIREFOX_WA_PDF_CLAIM' });
      if (response?.ok && response.pending) attachPayload(response);
    } catch (_) {}
  }

  pump();
  setInterval(pump, 1300);
  console.log(`[AZOBSS] Firefox WhatsApp PDF Bridge v${BRIDGE_VERSION} WhatsApp content ready`);
})();
