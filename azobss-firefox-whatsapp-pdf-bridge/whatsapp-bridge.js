'use strict';

(() => {
  const ext = typeof browser !== 'undefined' ? browser : chrome;
  const BRIDGE_VERSION = 1552;
  if(window.__AZOBSS_WA_CONTENT_1552__)return;window.__AZOBSS_WA_CONTENT_1552__=true;
  const instanceId=crypto.randomUUID();
  let verifiedPhone='';
  let busy = false;
  const attemptedRequests=new Set();

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
      '[aria-label="Dokumen"]',
      '[title="Dokumen"]',
      '[role="button"][aria-label*="document" i]',
      '[role="menuitem"][aria-label*="document" i]'
    ];
    for (const selector of selectors) {
      const match = [...document.querySelectorAll(selector)].find(visible);
      if (match) return match.closest('button,[role="button"],[role="menuitem"]') || match;
    }
    const textMatch = [...document.querySelectorAll('[role="button"],[role="menuitem"],button,li')]
      .find(el => visible(el) && /^(document|dokumen)$/i.test(String(el.innerText || el.textContent || '').trim()));
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
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function previewScope(filename='') {
    const valid=node=>visible(node)&&!node.querySelector('#pane-side,#main footer')&&(!filename||String(node.innerText||node.textContent||'').includes(filename))&&!!findSendButton(node);
    const roots=[...document.querySelectorAll('[role="dialog"],[data-testid="media-editor"],[data-testid="media-preview"],[data-animate-modal-popup="true"]')];
    for(const node of roots)if(valid(node))return node;
    if(filename){
      const labels=[...document.querySelectorAll('span,div,p')].filter(node=>visible(node)&&String(node.textContent||'').trim()===filename);
      for(const label of labels){let node=label.parentElement;for(let i=0;node&&node!==document.body&&i<9;i++,node=node.parentElement)if(valid(node))return node;}
    }
    return null;
  }
  function findPreviewCaptionBox(scope) {
    if(!scope)return null;
    const candidates=[...scope.querySelectorAll('[contenteditable="true"],textarea,input[type="text"]')].filter(el=>visible(el)&&!el.closest('#main footer')&&!/search|cari/i.test(el.getAttribute('aria-label')||''));
    const explicit=candidates.filter(el=>/caption|kapsyen/i.test([el.getAttribute('aria-label'),el.getAttribute('aria-placeholder'),el.getAttribute('placeholder'),el.getAttribute('data-testid')].join(' ')));
    return explicit.length===1?explicit[0]:candidates.length===1?candidates[0]:null;
  }

  function findSendButton(root=document) {
    const selectors = [
      'button[aria-label="Send"]',
      '[role="button"][aria-label="Send"]',
      'span[data-icon="send"]',
      'span[data-icon="send-filled"]'
    ];
    for (const selector of selectors) {
      const match = [...root.querySelectorAll(selector)].find(visible);
      if (match) return match.closest('button,[role="button"]') || match;
    }
    return null;
  }

  const captionText=box=>String(box?.value??box?.innerText??box?.textContent??'').replace(/\r\n/g,'\n').replace(/[\u200b-\u200f\uFEFF]/g,'').trim();
  function hasPreview(){return !!previewScope()||[...document.querySelectorAll('button[aria-label="Send"],[role="button"][aria-label="Send"],span[data-icon="send"],span[data-icon="send-filled"]')].some(el=>visible(el)&&!el.closest('#main footer'));}
  async function fillCaption(box, text) {
    const value = String(text || '').trim();
    if (!box || !value) return false;
    const old=captionText(box);if(old&&old!==value)return false;
    if(old===value)return true;
    box.focus();
    if(box.matches('textarea,input')){
      const prototype=box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype,'value').set.call(box,value);
      box.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:value}));
    }else{
      const range=document.createRange(),selection=window.getSelection();range.selectNodeContents(box);selection.removeAllRanges();selection.addRange(range);
      try{if(!document.execCommand('insertText',false,value))return false;}catch{return false;}
    }
    await sleep(180);box.blur();await sleep(180);
    return box.isConnected&&captionText(box)===value;
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
    if (busy || !payload?.requestId || attemptedRequests.has(payload.requestId)) return;
    attemptedRequests.add(payload.requestId);
    busy = true;
    let fileDispatched=false;
    try {
      showBadge(`AZOBSS: menyediakan ${payload.filename} sebagai fail PDF sebenar…`);
      const chatReady = await waitForChatReady();
      if (!chatReady) throw new Error('WhatsApp Web belum siap selepas 90 saat. Pastikan kamu sudah login dan chat customer boleh dibuka.');
      if(verifiedPhone!==payload.phone||!window.AZOBSSWhatsappTarget1552?.current(payload.phone))throw new Error('Chat penerima berubah atau belum disahkan. PDF tidak dilampirkan.');
      const composer=document.querySelector('#main footer [contenteditable="true"],#main footer textarea');
      if((composer&&captionText(composer))||hasPreview())throw new Error('Ada draf atau attachment sedia ada. Selesaikannya dahulu; tiada PDF baharu dilampirkan.');

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
      fileDispatched=true;

      let scope=null;
      for (let i = 0; i < 55; i++) {
        await sleep(220);
        scope=previewScope(payload.filename);
        if(scope)break;
      }
      if (!scope) throw new Error('Preview PDF belum dapat disahkan. Semak WhatsApp; fail tidak akan dilampirkan semula secara automatik.');

      let caption=null;
      for(let i=0;i<20&&!caption;i++){caption=findPreviewCaptionBox(scope);if(!caption)await sleep(150);}
      if(!caption||!payload.caption||!await fillCaption(caption,payload.caption))throw new Error('Nota belum dapat diisi atau disahkan. PDF mungkin sudah berada di preview. Tampal nota yang disalin sekali sahaja; jangan ulang lampiran.');

      showBadge(`AZOBSS: ${payload.filename} dan nota sudah disediakan sekali ✅\nSemak preview dan tekan Send.`, 'good');
      await ext.runtime.sendMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS',
        requestId: payload.requestId,
        status: 'attached',
        message: `${payload.filename} dan nota sudah disediakan sekali. Semak preview dan tekan Send.`
      }).catch(() => {});
    } catch (error) {
      showBadge(`AZOBSS PDF gagal dilampirkan:\n${error?.message || error}`, 'error');
      await ext.runtime.sendMessage({
        type: 'AZOBSS_FIREFOX_WA_PDF_WHATSAPP_STATUS',
        requestId: payload?.requestId,
        status: fileDispatched?'needs-caption':'error',
        message: error?.message || String(error)
      }).catch(() => {});
    } finally {
      busy = false;
    }
  }

  async function pump() {
    if (busy) return;
    try {
      const response = await ext.runtime.sendMessage({ type: 'AZOBSS_FIREFOX_WA_PDF_CLAIM',bridgeVersion:BRIDGE_VERSION,instanceId,phone:verifiedPhone });
      if (response?.ok && response.pending) attachPayload(response);
    } catch (_) {}
  }

  ext.runtime.onMessage.addListener(message=>{
    if(message?.type==='AZOBSS_WA_ENSURE_CHAT_1552'){
      if(message.instanceId!==instanceId)return Promise.resolve({ok:false,code:'stale_document',instanceId});
      if(!window.AZOBSSWhatsappTarget1552)return Promise.resolve({ok:false,code:'bridge_update_required',error:'Refresh WhatsApp untuk mengaktifkan semakan penerima.'});
      showBadge('AZOBSS: membuka dan mengesahkan chat +'+message.phone+'…');
      return window.AZOBSSWhatsappTarget1552.ensure(message.phone).then(()=>{verifiedPhone=message.phone;showBadge('Chat +'+verifiedPhone+' disahkan. Semak penerima sebelum menghantar mesej.','good');return {ok:true,phone:verifiedPhone,instanceId};}).catch(error=>{showBadge('AZOBSS: '+error.message,'error');return {ok:false,instanceId,code:error.code||'recipient_unverified',error:error.message};});
    }
    if(message?.type==='AZOBSS_WA_PDF_WAKE_1552'){pump();return Promise.resolve({ok:true});}
    if(message?.type!=='AZOBSS_WA_TAB_STATUS_1545')return;
    const dialogs=[...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[data-animate-modal-popup]')].filter(visible);
    const locked=dialogs.some(el=>/WhatsApp is open in another window|WhatsApp.*(?:tetingkap|window).*lain/i.test(el.textContent||''));
    const composer=document.querySelector('#main footer [contenteditable="true"],#main footer textarea');
    const preview=hasPreview();
    const loginRequired=!!document.querySelector('[data-testid="qrcode"]')||[...document.querySelectorAll('h1,h2,[role="heading"]')].some(el=>visible(el)&&/log (?:in|into) (?:to )?WhatsApp|log masuk.*WhatsApp|use WhatsApp on your computer/i.test(el.textContent||''));
    return Promise.resolve({bridgeVersion:BRIDGE_VERSION,instanceId,loginRequired,locked,busy:busy||preview,draft:!!(composer&&String(composer.textContent||'').replace(/[\u200b-\u200f\uFEFF]/g,'').trim()),ready:!locked&&!!document.querySelector('#pane-side,#main,[data-testid="chat-list"],[aria-label="New chat"],[title="New chat"]')});
  });
  pump();
  setInterval(pump, 1300);
  console.log(`[AZOBSS] Firefox WhatsApp PDF Bridge v${BRIDGE_VERSION} WhatsApp content ready`);
})();
