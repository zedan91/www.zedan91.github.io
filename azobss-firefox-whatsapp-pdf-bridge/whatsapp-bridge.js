'use strict';

(() => {
  const ext = typeof browser !== 'undefined' ? browser : chrome;
  const BRIDGE_VERSION = 1552;
  if(window.__AZOBSS_WA_CONTENT_1552__)return;window.__AZOBSS_WA_CONTENT_1552__=true;
  const instanceId=crypto.randomUUID();
  let verifiedPhone='';
  let busy = false;
  let activePreviewContext=null;
  let badgeTimer=null;
  const attemptedRequests=new Set();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function showBadge(text, tone = 'info') {
    clearTimeout(badgeTimer);
    let node=document.getElementById('azobss-firefox-wa-pdf-status');
    if(!node){
      node=document.createElement('aside');node.id='azobss-firefox-wa-pdf-status';node.setAttribute('role','status');node.setAttribute('aria-live','polite');
      // Keep the composer free and allow clicks/typing through the notice.
      node.style.cssText='position:fixed;z-index:2147483647;right:14px;top:12px;bottom:auto;max-width:min(390px,calc(100vw - 28px));box-sizing:border-box;padding:10px 38px 10px 12px;border-radius:10px;color:#fff;font:500 12px/1.4 Arial,sans-serif;box-shadow:0 5px 18px #0004;white-space:pre-wrap;pointer-events:none;';
      const message=document.createElement('span');message.dataset.azobssStatusText='';node.append(message);
      const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Close AZOBSS status');close.textContent='×';close.style.cssText='position:absolute;right:5px;top:4px;pointer-events:auto;background:transparent;border:0;color:inherit;font-size:20px;cursor:pointer;padding:3px 6px;';
      close.onclick=()=>{clearTimeout(badgeTimer);node.remove();};node.append(close);document.documentElement.appendChild(node);
    }
    node.style.background=tone==='good'?'#166344':tone==='error'?'#8e2929':'#164b64';
    node.querySelector('[data-azobss-status-text]').textContent=text;
    badgeTimer=setTimeout(()=>node.remove(),tone==='good'?3500:tone==='error'?8500:6500);
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
    const main=document.querySelector('#main');if(!main)return null;
    const footer=main.querySelector('footer');
    const named=['button[aria-label="Attach"]','[role="button"][aria-label="Attach"]','button[title="Attach"]','[role="button"][title="Attach"]','button[aria-label="Lampirkan"]','[role="button"][aria-label="Lampirkan"]'];
    const icons=['span[data-icon="plus-rounded"]','span[data-icon="plus"]','span[data-icon="clip"]','span[data-icon="attach-menu-plus"]'];
    // A sidebar/header plus button must never be mistaken for chat attachment.
    for(const [scope,selectors] of [[footer,[...named,...icons]],[main,named]]){
      if(!scope)continue;
      for(const selector of selectors){const match=[...scope.querySelectorAll(selector)].find(el=>visible(el)&&!el.closest('header'));if(match)return match.closest('button,[role="button"]')||match;}
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

  function chooseDocumentInput(before=new Set(),documentButton=null,beforeDocumentClick=null) {
    const associated=input=>{
      if(!documentButton)return false;
      if(documentButton.contains(input))return true;
      const label=input.closest('label');if(label&&(label===documentButton||label.contains(documentButton)))return true;
      return !!(input.id&&documentButton.getAttribute('for')===input.id);
    };
    const scored=[...document.querySelectorAll('input[type="file"]')].filter(input=>input.isConnected&&!input.disabled).map(input=>{
      const accept=String(input.getAttribute('accept')||'').toLowerCase(),pdf=/application\/pdf|\.pdf|application\/\*/.test(accept),generic=!accept||accept==='*'||accept==='*/*';
      if(!pdf&&!generic)return null;
      const owned=associated(input),fresh=!before.has(input),afterDocument=beforeDocumentClick&&!beforeDocumentClick.has(input);
      if(!owned&&!fresh&&!afterDocument&&!pdf)return null;
      return {input,score:(owned?300:0)+(afterDocument?200:fresh?100:0)+(pdf?40:5)};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    // Ties are ambiguous: wait for the Document control rather than pick an old
    // unrelated generic input (profile/status/contact upload inputs can coexist).
    return scored.length&&(!scored[1]||scored[0].score>scored[1].score)?scored[0].input:null;
  }

  function setInputFile(input, file) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  const editableSelector='[contenteditable="true"],[contenteditable="plaintext-only"],textarea,input[type="text"]';
  const messageSelector='[data-message-id],[data-testid="msg-container"],[data-testid="message-container"],[data-id^="true_"],[data-id^="false_"]';
  function sendButtons(root=document){
    const nodes=[...root.querySelectorAll('button[aria-label="Send"],[role="button"][aria-label="Send"],button[aria-label="Hantar"],[role="button"][aria-label="Hantar"],span[data-icon="send"],span[data-icon="send-filled"]')];
    return [...new Set(nodes.map(el=>el.closest('button,[role="button"]')||el))].filter(visible);
  }
  function captionHint(el,scope){
    for(let node=el,depth=0;node&&depth<4;node=node.parentElement,depth++){
      if(/caption|kapsyen/i.test(['aria-label','aria-placeholder','placeholder','data-testid'].map(attr=>node.getAttribute(attr)||'').join(' ')))return true;
      if(node===scope)break;
    }
    return false;
  }
  function filenameLabels(filename){
    if(!filename)return [];
    return [...document.querySelectorAll('span,div,p,[title],[aria-label],[data-filename]')].filter(node=>visible(node)&&!node.closest(messageSelector)&&(String(node.textContent||'').trim()===filename||['title','aria-label','data-filename'].some(attr=>node.getAttribute(attr)===filename)));
  }
  function findPreviewCaptionBox(scope) {
    if(!scope)return null;
    const context=activePreviewContext;
    const candidates=[...scope.querySelectorAll(editableSelector)].filter(el=>visible(el)&&!el.closest(messageSelector)&&!el.closest('[role="search"]')&&!/search|cari/i.test(['aria-label','aria-placeholder','placeholder'].map(attr=>el.getAttribute(attr)||'').join(' '))&&(!(el===context?.composer||context?.oldEditors?.has(el)||el.closest('[data-testid="conversation-compose-box-input"]')||!context&&el.closest('#main footer'))||captionHint(el,scope)));
    const explicit=candidates.filter(el=>captionHint(el,scope));
    return explicit.length===1?explicit[0]:explicit.length?null:candidates.length===1?candidates[0]:null;
  }
  function previewScope(filename='',context=activePreviewContext) {
    const wanted=filename||context?.filename||'',labels=filenameLabels(wanted).filter(el=>!context?.oldLabels.has(el)),sends=sendButtons().filter(el=>!context?.oldSend.has(el));
    const valid=node=>{
      if(!visible(node)||node===document.body||node===document.documentElement||node.id==='pane-side'||node.querySelector('#pane-side')||node.closest(messageSelector))return false;
      if(context?.composer&&visible(context.composer)&&node.contains(context.composer)&&!captionHint(context.composer,node))return false;
      if(!context&&node.id==='main')return false;
      return (!wanted||labels.some(label=>node===label||node.contains(label)))&&sends.some(send=>node.contains(send));
    };
    const scopes=[],add=node=>{if(node&&!scopes.includes(node)&&valid(node))scopes.push(node);};
    for(const node of document.querySelectorAll('[role="dialog"],[data-testid="media-editor"],[data-testid="media-preview"],[data-testid*="document-preview"],[data-animate-modal-popup="true"]'))add(node);
    if(wanted)for(const label of labels){let node=label.parentElement;for(let i=0;node&&node!==document.body&&i<14;i++,node=node.parentElement)add(node);}
    // Modern WhatsApp can mount its document preview INSIDE #main with its own
    // footer. The old blanket '#main footer' exclusion rejected that real caption.
    return scopes.find(node=>findPreviewCaptionBox(node))||scopes[0]||null;
  }
  function findSendButton(root=document){return sendButtons(root)[0]||null;}

  const captionText=box=>String(box?.value??box?.innerText??box?.textContent??'').replace(/\r\n/g,'\n').replace(/[\u200b-\u200f\uFEFF]/g,'').trim();
  function hasPreview(){return !!previewScope()||sendButtons().some(el=>!el.closest('#main footer')||[...el.closest('footer').querySelectorAll(editableSelector)].some(input=>visible(input)&&captionHint(input,el.closest('footer'))));}
  function captionLines(value) {
    return value.replace(/\u00a0/g,' ').split('\n').map(line=>line.trim()).filter(Boolean).join('\n');
  }

  function placeCaptionCaret(box) {
    box.focus();
    if (document.activeElement !== box) return false;
    const selection=window.getSelection();
    if (!selection) return false;
    const range=document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function pasteCaption(box,value) {
    if (!placeCaptionCaret(box)) return;
    const data=new DataTransfer();
    data.setData('text/plain',value);
    const paste=new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:data});
    if (paste.clipboardData?.getData('text/plain')!==value) {
      Object.defineProperty(paste,'clipboardData',{value:data});
    }
    box.dispatchEvent(paste);
  }

  async function fillCaption(filename,text) {
    const value=String(text||'').replace(/\r\n?/g,'\n').trim();
    if (!value) return false;
    const resolve=()=>findPreviewCaptionBox(previewScope(filename));
    let userEditing=false;
    const interaction=event=>{if(event.isTrusted)userEditing=true;};
    document.addEventListener('keydown',interaction,true);
    document.addEventListener('pointerdown',interaction,true);
    try {
      // The preview and its editor can mount or be replaced independently.
      let box;
      for (let attempt=0;attempt<25&&!userEditing;attempt++) {
        box=resolve();
        if (box) break;
        await sleep(160);
      }
      if (!box||userEditing) return false;
      const matches=editor=>captionLines(captionText(editor))===captionLines(value);
      if (captionText(box)) return matches(box);

      const plainField=box.matches('textarea,input');
      // Let the rich editor handle the entire multiline paste as one edit.
      // Fall back to browser text insertion only if the verified editor stays empty.
      for (let attempt=0;attempt<(plainField?1:2);attempt++) {
        box=resolve();
        if (!box||userEditing||captionText(box)) return false;
        if (plainField) {
          if (!box.matches('textarea,input')) return false;
          const prototype=box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          box.focus();
          Object.getOwnPropertyDescriptor(prototype,'value').set.call(box,value);
          box.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:value}));
        } else if (box.matches('textarea,input')) {
          return false;
        } else if (attempt===0) {
          pasteCaption(box,value);
        } else if (placeCaptionCaret(box)) {
          try { document.execCommand('insertText',false,value); } catch (_) {}
        }

        await sleep(220);
        box=resolve();
        if (!box||userEditing) return false;
        if (matches(box)) {
          box.blur();
          await sleep(260);
          box=resolve();
          if (!box||userEditing) return false;
          if (matches(box)) return true;
        }
        if (captionText(box)) return false;
      }
      return false;
    } finally {
      document.removeEventListener('keydown',interaction,true);
      document.removeEventListener('pointerdown',interaction,true);
    }
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
      const beforeInputs=new Set(document.querySelectorAll('input[type="file"]'));
      activePreviewContext={filename:payload.filename,composer,oldEditors:new Set([...document.querySelectorAll(editableSelector)].filter(visible)),oldLabels:new Set(filenameLabels(payload.filename)),oldSend:new Set(sendButtons())};
      const attach = findAttachButton();
      if (!attach) throw new Error('Butang attachment WhatsApp tidak ditemui.');
      attach.click();

      let input = null;
      let documentMenuClicked = false;
      let beforeDocumentClick=null;
      for (let i = 0; i < 35 && !input; i++) {
        await sleep(180);
        const documentButton=findDocumentMenuButton();
        input = chooseDocumentInput(beforeInputs,documentButton,beforeDocumentClick);
        if (!input && !documentMenuClicked && i >= 3) {
          if (documentButton) {
            documentMenuClicked = true;
            beforeDocumentClick=new Set(document.querySelectorAll('input[type="file"]'));
            documentButton.click();
          }
        }
      }
      if (!input) throw new Error('Input Document WhatsApp tidak ditemui. WhatsApp Web mungkin sudah mengubah UI.');
      if(verifiedPhone!==payload.phone||!window.AZOBSSWhatsappTarget1552?.current(payload.phone))throw new Error('Chat penerima berubah sebelum lampiran. Proses dihentikan.');
      setInputFile(input, file);
      fileDispatched=true;

      let scope=null;
      for (let i = 0; i < 55; i++) {
        await sleep(220);
        scope=previewScope(payload.filename);
        if(scope)break;
      }
      if (!scope) throw new Error('Preview PDF belum dapat disahkan. Semak WhatsApp; fail tidak akan dilampirkan semula secara automatik.');

      if(!await fillCaption(payload.filename,payload.caption))throw new Error('Nota belum dapat diisi atau disahkan. PDF mungkin sudah berada di preview. Tampal nota yang disalin sekali sahaja; jangan ulang lampiran.');

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
      activePreviewContext=null;
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
