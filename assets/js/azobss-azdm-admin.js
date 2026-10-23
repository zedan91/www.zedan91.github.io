(function(){
  'use strict';
  const root=document.getElementById('azdmAdminPanel');
  if(!root)return;
  const $=id=>root.querySelector('#azdm-'+id);
  const tabs=[...document.querySelectorAll('[data-software-key-product]')];
  let product='azdm',loaded=false,loading=null,page=0,cursors=[null],next=null,search='',sort='created-desc',activeWorkspace='licenses',licenseCache=[];
  let orderPage=0,orderCursors=[null],orderNext=null,orderSearch='',orderCache=[],serialRecord=null,editing=null,pending=null,generation=0,currentOrder=null,previousBodyOverflow='';
  const apiBase='https://azobss-backend.onrender.com/api/azdm/admin/';
  const date=seconds=>seconds?new Date(seconds*1000).toLocaleDateString('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric'}):'Lifetime';
  const dateTime=value=>{if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):String(value)};
  const safe=v=>String(v??'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
  async function api(action,body={}){
    for(let i=0;i<40&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(resolve=>setTimeout(resolve,100));
    if(typeof window.azAdminFetchJson!=='function')throw new Error('Sesi admin belum tersedia. Sign in AZOBSS dan cuba semula.');
    const current=generation;
    const result=await window.azAdminFetchJson(apiBase+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    if(current!==generation)throw new Error('Sesi admin berubah. Sign in semula sebelum meneruskan.');
    if(result.ok===false)throw new Error(result.error||'Servis lesen belum tersedia.');
    return result;
  }
  async function action(fn){
    notice('');const controls=[...root.querySelectorAll('button')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);
    try{await fn();}catch(error){notice(error.message||'Tindakan belum berjaya.');}
    finally{controls.forEach(([el,state])=>el.disabled=state);updatePages();}
  }
  function updatePages(){
    $('previous').disabled=page===0;$('next').disabled=!next;
    $('orders-previous').disabled=orderPage===0;$('orders-next').disabled=!orderNext;
    $('audit-previous').disabled=orderPage===0;$('audit-next').disabled=!orderNext;
  }
  function cell(row,value){const td=document.createElement('td');td.textContent=value;row.append(td);return td;}
  function button(text,fn,danger=false){const el=document.createElement('button');el.type='button';el.textContent=text;if(danger)el.className='azdm-danger';el.addEventListener('click',fn);return el;}
  async function copySerial(serial){try{await navigator.clipboard.writeText(serial);notice('Serial disalin.');}catch{notice('Tidak dapat salin automatik. Pilih serial dan tekan Ctrl+C.');}}
  async function loadLicenses(){
    const current=generation,result=await api('list',{limit:25,search,sort,cursor:cursors[page]});
    if(current!==generation)return;
    next=result.next_cursor;licenseCache=Array.isArray(result.licenses)?result.licenses:[];$('rows').replaceChildren();
    for(const item of result.licenses){
      const row=document.createElement('tr'),name=cell(row,'');const title=document.createElement('strong');title.textContent=item.customer;
      const id=document.createElement('small');id.textContent=item.id;name.append(title,id);
      const contact=cell(row,'');contact.className='azdm-contact-cell';
      if(item.email){const email=document.createElement('a');email.className='azdm-contact-email';email.href='mailto:'+item.email;email.textContent=item.email;contact.append(email);}
      if(item.phone){const phone=document.createElement('small');phone.className='azdm-contact-phone';phone.textContent='☎ '+item.phone;contact.append(phone);}
      if(!item.email&&!item.phone){const blank=document.createElement('small');blank.className='azdm-contact-empty';blank.textContent='—';contact.append(blank);}
      const serialCell=cell(row,'');
      if(item.serial){const key=document.createElement('code');key.className='azdm-serial-key';key.textContent=item.serial;serialCell.append(key,button('Salin',()=>copySerial(item.serial)));}
      else{const legacy=document.createElement('small');legacy.className='azdm-serial-legacy';legacy.textContent=item.serial_state==='unreadable'?'Serial tersimpan tetapi tidak dapat dibaca':'Legacy — key lama tidak dapat dipulihkan';serialCell.append(legacy);}
      cell(row,item.status==='revoked'?'Disekat':item.expires&&item.expires<=Date.now()/1000?'Tamat':'Aktif');
      cell(row,item.device_count+' / 1');cell(row,date(item.expires));cell(row,date(item.created));
      const td=cell(row,''),actions=document.createElement('div');actions.className='azdm-admin-actions';td.append(actions);
      actions.append(button('Edit',()=>openEdit(item)),button('Reset PC',()=>confirm(item,'reset')),button(item.status==='revoked'?'Buka sekatan':'Sekat',()=>confirm(item,item.status==='revoked'?'restore':'revoke'),item.status!=='revoked'),button('Delete',()=>openDelete(item),true));
      $('rows').append(row);
    }
    if(!result.licenses.length){const row=document.createElement('tr');const td=cell(row,search?'Tiada lesen sepadan dengan carian.':'Belum ada lesen AZDM.');td.colSpan=8;td.className='azdm-admin-empty';$('rows').append(row);}
    $('page-label').textContent='Halaman '+(page+1)+' · '+result.licenses.length+' lesen';$('license-count').textContent=next?String(result.licenses.length)+'+':String(result.licenses.length);renderAudit();updatePages();
  }
  async function loadOrders(suppress=true){
    try{
      const current=generation,result=await api('orders',{limit:25,cursor:orderCursors[orderPage],search:orderSearch});
      if(current!==generation)return;
      orderNext=result.next_cursor;orderCache=Array.isArray(result.orders)?result.orders:[];$('order-rows').replaceChildren();
      $('shop-state').textContent=result.enabled?'Pembelian online aktif.':'Pembelian online belum diaktifkan.';
      const states={creating:'Sedang disediakan',pending:'Belum disahkan',creation_failed:'Bil gagal',paid:'Disahkan'};
      const emails={queued:'Menunggu',sending:'Sedang dihantar',accepted:'Diterima servis email',review:'Perlu semakan'};
      for(const item of result.orders){
        const row=document.createElement('tr'),name=cell(row,'');const strong=document.createElement('strong');strong.textContent=item.customer;name.append(strong);
        for(const value of [item.email,item.id]){const small=document.createElement('small');small.textContent=value;name.append(small);}
        cell(row,item.product_name+' · '+item.quantity+' PC · RM'+(item.amount_cents/100).toFixed(2));cell(row,states[item.status]||item.status);cell(row,emails[item.email_status]||'Selepas bayaran');
        const td=cell(row,''),actions=document.createElement('div');actions.className='azdm-admin-actions';td.append(actions);
        const viewBtn=button('View',()=>openOrderAudit(item));viewBtn.classList.add('azdm-order-view');actions.append(viewBtn);
        if(item.email_status==='review')actions.append(button('Hantar semula',()=>confirm(item,'order-email-retry')));
        $('order-rows').append(row);
      }
      if(!result.orders.length){const row=document.createElement('tr'),td=cell(row,'Belum ada pesanan AZDM online.');td.colSpan=5;td.className='azdm-admin-empty';$('order-rows').append(row);}
      $('orders-page-label').textContent=(result.total??result.orders.length)+' rekod · Halaman '+(orderPage+1)+' · '+result.orders.length+' dipaparkan';$('audit-page-label').textContent=$('orders-page-label').textContent;$('order-count').textContent=String(result.total??result.orders.length);renderAudit();updatePages();
    }catch(error){$('shop-state').textContent='Pesanan online belum tersedia: '+error.message;if(!suppress)throw error;}
  }
  function auditLine(label,value,copy=false){const raw=safe(value)||'—';return `<div class="azdm-audit-line"><span>${esc(label)}</span><b>${esc(raw)}</b>${copy&&raw!=='—'?`<button type="button" class="azdm-audit-copy" data-azdm-copy="${esc(raw)}">Copy</button>`:''}</div>`;}
  function openOrderAudit(item){
    currentOrder=item;const drawer=$('order-audit-drawer'),back=$('order-audit-backdrop'),body=$('order-audit-body');if(!drawer||!back||!body)return;
    $('order-audit-title').textContent=item.customer||item.email||'AZDM Customer';$('order-audit-subtitle').textContent=(item.status||'').toUpperCase()+' • RM'+(Number(item.amount_cents||0)/100).toFixed(2);
    const licenses=Array.isArray(item.issued_licenses)&&item.issued_licenses.length?item.issued_licenses.map(x=>x.license_id||'').filter(Boolean).join(', '):'—';
    body.innerHTML=`<div class="azdm-audit-section"><h4>👤 Akaun Customer</h4>${auditLine('Customer',item.customer)}${auditLine('Username',item.username)}${auditLine('Email',item.email)}${auditLine('Phone',item.phone)}${auditLine('Firebase UID',item.firebase_uid,true)}</div>
      <div class="azdm-audit-section"><h4>💳 Pembelian & Payment</h4>${auditLine('Order ID',item.order_id,true)}${auditLine('Status',item.status)}${auditLine('Amount','RM'+(Number(item.amount_cents||0)/100).toFixed(2))}${auditLine('Payment',String(item.payment_method||'').toUpperCase())}${auditLine('BillCode',item.bill_code,true)}${auditLine('Payment Ref',item.payment_reference,true)}${auditLine('Transaction ID',item.transaction_id,true)}${auditLine('Stripe PI',item.stripe_payment_intent,true)}${auditLine('Stripe Session',item.stripe_checkout_session,true)}${auditLine('Purchased',dateTime(item.created_at))}${auditLine('Paid At',dateTime(item.paid_at))}${auditLine('Verified At',dateTime(item.payment_verified_at))}${auditLine('Invoice',item.invoice_no,true)}${auditLine('Receipt',item.receipt_no,true)}</div>
      <div class="azdm-audit-section"><h4>🔑 Fulfilment & Lesen</h4>${auditLine('Issued Count',item.issued_count)}${auditLine('License ID(s)',licenses,true)}${auditLine('Fulfilment',item.fulfillment_state)}${auditLine('Email Status',item.email_status)}${auditLine('Error',item.fulfillment_error||'—')}</div>`;
    back.hidden=false;drawer.hidden=false;previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';setTimeout(()=>$('order-audit-close')?.focus(),0);
  }
  function closeOrderAudit(){const drawer=$('order-audit-drawer'),back=$('order-audit-backdrop');if(drawer)drawer.hidden=true;if(back)back.hidden=true;document.body.style.overflow=previousBodyOverflow||'';currentOrder=null;}
  function setWorkspace(value,focus=false){
    activeWorkspace=['licenses','orders','audit'].includes(value)?value:'licenses';
    root.querySelectorAll('[data-azdm-workspace]').forEach(tab=>{const active=tab.dataset.azdmWorkspace===activeWorkspace;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
    for(const name of ['licenses','orders','audit']){const panel=$('workspace-panel-'+name);if(panel)panel.hidden=name!==activeWorkspace;}
    if(activeWorkspace==='audit')renderAudit();
  }
  function auditEvent(label,time,state='done',detail=''){return {label,time:time||'',state,detail};}
  function renderAudit(){
    const host=$('audit-rows');if(!host)return;host.replaceChildren();
    if(!orderCache.length){const empty=document.createElement('div');empty.className='azdm-admin-empty azdm-audit-empty';empty.textContent=orderSearch?'Tiada audit sepadan dengan carian.':'Belum ada rekod audit AZDM.';host.append(empty);return;}
    const licenseById=new Map(licenseCache.map(item=>[String(item.id||''),item]));
    for(const item of orderCache){
      const card=document.createElement('article');card.className='azdm-audit-card';
      const head=document.createElement('div');head.className='azdm-audit-card-head';
      const identity=document.createElement('div');const title=document.createElement('strong');title.textContent=item.customer||item.email||'AZDM Customer';const meta=document.createElement('small');meta.textContent=[item.email,item.order_id||item.id].filter(Boolean).join(' · ');identity.append(title,meta);
      const view=button('View',()=>openOrderAudit(item));view.classList.add('azdm-order-view');head.append(identity,view);card.append(head);
      const events=[];
      events.push(auditEvent('Purchased',item.created_at,'done',item.product_name||'AZDM'));
      if(item.status==='paid')events.push(auditEvent('Payment confirmed',item.payment_verified_at||item.paid_at,'done',String(item.payment_method||'').toUpperCase()));
      else events.push(auditEvent(item.status==='pending'?'Payment pending':'Payment '+(item.status||'pending'),item.updated_at||item.created_at,item.status==='pending'?'pending':'warning'));
      if(Number(item.issued_count||0)>0)events.push(auditEvent('Serial issued',item.updated_at||item.payment_verified_at||item.paid_at,'done',String(item.issued_count)+' serial'));
      if(item.email_status==='accepted')events.push(auditEvent('Email sent',item.email_sent_at||item.updated_at||item.paid_at,'done',item.email||''));
      else if(item.email_status)events.push(auditEvent('Email '+item.email_status,item.updated_at||item.paid_at,item.email_status==='review'?'warning':'pending'));
      const issued=Array.isArray(item.issued_licenses)?item.issued_licenses:[];
      for(const issuedItem of issued){const license=licenseById.get(String(issuedItem.license_id||''));if(license&&Number(license.device_count||0)>0)events.push(auditEvent('PC active',license.activated?new Date(Number(license.activated)*1000).toISOString():'','done',license.customer||issuedItem.license_id));}
      const line=document.createElement('div');line.className='azdm-audit-timeline';
      for(const ev of events){const node=document.createElement('div');node.className='azdm-audit-event '+ev.state;const dot=document.createElement('span');dot.className='azdm-audit-dot';const copy=document.createElement('div');const label=document.createElement('b');label.textContent=ev.label;const detail=document.createElement('small');detail.textContent=[ev.detail,ev.time?dateTime(ev.time):''].filter(Boolean).join(' · ');copy.append(label,detail);node.append(dot,copy);line.append(node);}
      card.append(line);host.append(card);
    }
  }
  root.querySelectorAll('[data-azdm-workspace]').forEach((tab,i,all)=>{tab.addEventListener('click',()=>setWorkspace(tab.dataset.azdmWorkspace));tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=(i+1)%all.length;if(event.key==='ArrowLeft')target=(i-1+all.length)%all.length;if(event.key==='Home')target=0;if(event.key==='End')target=all.length-1;if(target!==undefined){event.preventDefault();setWorkspace(all[target].dataset.azdmWorkspace,true);}});});
  function load(force=false){
    if(loading)return loading;
    if(loaded&&!force)return Promise.resolve();
    loading=action(async()=>{await loadLicenses();loaded=true;await loadOrders();}).finally(()=>loading=null);
    return loading;
  }
  function selectProduct(value,focus=false){
    product=['azdm','surveycad','ebook'].includes(value)?value:'azdm';
    document.getElementById('surveycadKeyPanel').hidden=product!=='surveycad';
    document.getElementById('ebookAccessAdminPanel').hidden=product!=='ebook';
    root.hidden=product!=='azdm';
    tabs.forEach(tab=>{const active=tab.dataset.softwareKeyProduct===product;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
    if(document.getElementById('softwarekeys').classList.contains('active'))window.azSoftwareKeyTabsLoad();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>selectProduct(tab.dataset.softwareKeyProduct));
    tab.addEventListener('keydown',event=>{
      let target;
      if(event.key==='ArrowRight')target=(i+1)%tabs.length;
      if(event.key==='ArrowLeft')target=(i-1+tabs.length)%tabs.length;
      if(event.key==='Home')target=0;
      if(event.key==='End')target=tabs.length-1;
      if(target!==undefined){event.preventDefault();selectProduct(tabs[target].dataset.softwareKeyProduct,true);}
    });
  });
  window.azSoftwareKeyTabsLoad=()=>product==='azdm'?load():product==='ebook'?(typeof window.azEbookAccessAdminLoad==='function'?window.azEbookAccessAdminLoad({force:false}):Promise.resolve()):(typeof window.azSoftwareKeysLoad==='function'?window.azSoftwareKeysLoad({force:false}):Promise.resolve());
  $('issue-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('customer').value.trim(),email=$('email').value.trim(),phone=$('phone').value.trim();const result=await api('issue',{customer,email,phone,days:Number($('duration').value)});
    serialRecord={...result,customer,email,phone};$('serial-customer').textContent=[customer,email,phone,date(result.expires)].filter(Boolean).join(' · ');$('serial-value').value=result.serial;$('serial-dialog').showModal();$('customer').value='';$('email').value='';$('phone').value='';
    search='';orderSearch='';$('unified-search').value='';page=0;cursors=[null];orderPage=0;orderCursors=[null];await loadLicenses();
  });});
  $('unified-search-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{const term=$('unified-search').value.trim();search=term;orderSearch=term;page=0;cursors=[null];orderPage=0;orderCursors=[null];await Promise.all([loadLicenses(),loadOrders(false)]);});});
  $('unified-clear').addEventListener('click',()=>action(async()=>{search='';orderSearch='';$('unified-search').value='';page=0;cursors=[null];orderPage=0;orderCursors=[null];await Promise.all([loadLicenses(),loadOrders(false)]); }));
  $('unified-refresh').addEventListener('click',()=>action(async()=>{page=0;cursors=[null];orderPage=0;orderCursors=[null];await Promise.all([loadLicenses(),loadOrders(false)]); }));
  $('sort').addEventListener('change',()=>action(async()=>{sort=$('sort').value||'created-desc';page=0;cursors=[null];await loadLicenses();}));
  $('next').addEventListener('click',()=>action(async()=>{const old=page;cursors[page+1]=next;page++;try{await loadLicenses();}catch(error){page=old;throw error;}}));
  $('previous').addEventListener('click',()=>action(async()=>{const old=page;page--;try{await loadLicenses();}catch(error){page=old;throw error;}}));
  function openEdit(item){
    editing=item;$('edit-name').value=item.customer;$('edit-email').value=item.email||'';$('edit-phone').value=item.phone||'';$('edit-serial').value=item.serial||'';$('edit-serial').dataset.original=item.serial||'';$('edit-serial-note').textContent=item.serial?'Jika Serial Key tidak diubah, key semasa kekal. Jika ditukar, PC lama akan dilepaskan.':'Key asal ialah legacy dan tidak boleh dipulihkan. Masukkan key baru jika mahu mula menyimpan/paparkan serial.';$('edit-lifetime').checked=!item.expires;
    const d=new Date((item.expires||Math.floor(Date.now()/1000)+365*86400)*1000);
    $('edit-expiry').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);$('edit-expiry').disabled=!item.expires;$('edit-expiry').required=!!item.expires;$('edit-dialog').showModal();
  }
  $('edit-lifetime').addEventListener('change',()=>{$('edit-expiry').disabled=$('edit-lifetime').checked;$('edit-expiry').required=!$('edit-lifetime').checked;});
  $('edit-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const payload={license_id:editing.id,customer:$('edit-name').value.trim(),email:$('edit-email').value.trim(),phone:$('edit-phone').value.trim(),expires:$('edit-lifetime').checked?0:Math.floor(new Date($('edit-expiry').value).getTime()/1000)};
    const entered=$('edit-serial').value.trim().toUpperCase(),original=$('edit-serial').dataset.original||'';if(entered&&entered!==original)payload.serial=entered;
    await api('update',payload);
    $('edit-dialog').close();await loadLicenses();notice(payload.serial?'Lesen disimpan dan Serial Key ditukar. PC lama sudah dilepaskan.':'Maklumat lesen disimpan.');
  });});
  function openDelete(item){
    pending={item,operation:'delete'};$('delete-customer').textContent=item.customer;$('delete-dialog').showModal();
  }
  $('delete-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    await api('delete',{license_id:pending.item.id,confirm_customer:pending.item.customer});$('delete-dialog').close();await loadLicenses();notice('Customer / lesen AZDM sudah dipadam.');
  });});
  function confirm(item,operation){
    pending={item,operation};const descriptions={reset:'Customer boleh mengaktifkan serial asal pada PC baharu.',revoke:'Lesen disekat pada semakan online seterusnya.',restore:'Customer boleh mengaktifkan semula serial selepas sekatan dibuka.','order-email-retry':'Serial asal akan dihantar semula. Customer mungkin menerima email berulang jika cubaan terdahulu sudah berjaya.'};
    const titles={reset:'Reset PC customer?',revoke:'Sekat lesen?',restore:'Buka sekatan lesen?','order-email-retry':'Hantar semula email serial?'};
    $('confirm-title').textContent=titles[operation];$('confirm-detail').textContent=item.customer+' — '+descriptions[operation];$('confirm-dialog').showModal();
  }
  $('confirm-action').addEventListener('click',()=>action(async()=>{
    await api(pending.operation,pending.operation==='order-email-retry'?{order_id:pending.item.id}:{license_id:pending.item.id});$('confirm-dialog').close();
    if(pending.operation==='order-email-retry')await loadOrders();else await loadLicenses();notice('Perubahan sudah diproses.');
  }));
  $('copy-serial').addEventListener('click',()=>action(async()=>{try{await navigator.clipboard.writeText($('serial-value').value);notice('Serial disalin.');}catch{$('serial-value').focus();$('serial-value').select();notice('Pilih serial dan tekan Ctrl+C untuk menyalin.');}}));
  $('save-serial').addEventListener('click',()=>{
    if(!serialRecord)return;
    const text='AZDM — '+serialRecord.customer+'\nSerial: '+serialRecord.serial+'\nTamat: '+date(serialRecord.expires)+'\nID lesen: '+serialRecord.license_id+'\n1 PC untuk setiap serial.\n';
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='AZDM-Serial-'+serialRecord.license_id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  root.querySelectorAll('[data-azdm-close]').forEach(el=>el.addEventListener('click',()=>$(el.dataset.azdmClose).close()));
  $('serial-dialog').addEventListener('close',()=>{serialRecord=null;$('serial-value').value='';});
  $('order-audit-close')?.addEventListener('click',closeOrderAudit);
  $('order-audit-backdrop')?.addEventListener('click',closeOrderAudit);
  $('order-audit-body')?.addEventListener('click',async event=>{const btn=event.target.closest('[data-azdm-copy]');if(!btn)return;try{await navigator.clipboard.writeText(btn.getAttribute('data-azdm-copy')||'');notice('Maklumat disalin.');}catch{notice('Tidak dapat salin automatik.');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('order-audit-drawer')?.hidden)closeOrderAudit();});
  $('orders-next').addEventListener('click',()=>action(async()=>{const old=orderPage;orderCursors[orderPage+1]=orderNext;orderPage++;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  $('orders-previous').addEventListener('click',()=>action(async()=>{const old=orderPage;orderPage--;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  $('audit-next').addEventListener('click',()=>action(async()=>{const old=orderPage;orderCursors[orderPage+1]=orderNext;orderPage++;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  $('audit-previous').addEventListener('click',()=>action(async()=>{const old=orderPage;orderPage--;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  window.addEventListener('azobss-auth-changed',()=>{generation++;loaded=false;serialRecord=null;licenseCache=[];orderCache=[];$('rows').replaceChildren();$('order-rows').replaceChildren();$('audit-rows').replaceChildren();$('serial-value').value='';root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());closeOrderAudit();});
  window.addEventListener('pagehide',()=>{serialRecord=null;$('serial-value').value='';});
  selectProduct('azdm');setWorkspace('licenses');updatePages();
})();
