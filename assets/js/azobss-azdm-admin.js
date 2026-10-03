(function(){
  'use strict';
  const root=document.getElementById('azdmAdminPanel');
  if(!root)return;
  const $=id=>root.querySelector('#azdm-'+id);
  const tabs=[...document.querySelectorAll('[data-software-key-product]')];
  let product='surveycad',loaded=false,loading=null,page=0,cursors=[null],next=null,search='';
  let orderPage=0,orderCursors=[null],orderNext=null,serialRecord=null,editing=null,pending=null,generation=0;
  const apiBase='https://azobss-backend.onrender.com/api/azdm/admin/';
  const date=seconds=>seconds?new Date(seconds*1000).toLocaleDateString('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric'}):'Lifetime';
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
  }
  function cell(row,value){const td=document.createElement('td');td.textContent=value;row.append(td);return td;}
  function button(text,fn,danger=false){const el=document.createElement('button');el.type='button';el.textContent=text;if(danger)el.className='azdm-danger';el.addEventListener('click',fn);return el;}
  async function loadLicenses(){
    const current=generation,result=await api('list',{limit:25,search,cursor:cursors[page]});
    if(current!==generation)return;
    next=result.next_cursor;$('rows').replaceChildren();
    for(const item of result.licenses){
      const row=document.createElement('tr'),name=cell(row,'');const title=document.createElement('strong');title.textContent=item.customer;
      const id=document.createElement('small');id.textContent=item.id;name.append(title,id);
      cell(row,item.status==='revoked'?'Disekat':item.expires&&item.expires<=Date.now()/1000?'Tamat':'Aktif');
      cell(row,item.device_count+' / 1');cell(row,date(item.expires));cell(row,date(item.created));
      const td=cell(row,''),actions=document.createElement('div');actions.className='azdm-admin-actions';td.append(actions);
      actions.append(button('Edit',()=>openEdit(item)),button('Reset PC',()=>confirm(item,'reset')),button(item.status==='revoked'?'Buka sekatan':'Sekat',()=>confirm(item,item.status==='revoked'?'restore':'revoke'),item.status!=='revoked'));
      $('rows').append(row);
    }
    if(!result.licenses.length){const row=document.createElement('tr');const td=cell(row,search?'Tiada lesen sepadan dengan carian.':'Belum ada lesen AZDM.');td.colSpan=6;td.className='azdm-admin-empty';$('rows').append(row);}
    $('page-label').textContent='Halaman '+(page+1)+' · '+result.licenses.length+' lesen';updatePages();
  }
  async function loadOrders(suppress=true){
    try{
      const current=generation,result=await api('orders',{limit:25,cursor:orderCursors[orderPage]});
      if(current!==generation)return;
      orderNext=result.next_cursor;$('order-rows').replaceChildren();
      $('shop-state').textContent=result.enabled?'Pembelian online aktif.':'Pembelian online belum diaktifkan.';
      const states={creating:'Sedang disediakan',pending:'Belum disahkan',creation_failed:'Bil gagal',paid:'Disahkan'};
      const emails={queued:'Menunggu',sending:'Sedang dihantar',accepted:'Diterima servis email',review:'Perlu semakan'};
      for(const item of result.orders){
        const row=document.createElement('tr'),name=cell(row,'');const strong=document.createElement('strong');strong.textContent=item.customer;name.append(strong);
        for(const value of [item.email,item.id]){const small=document.createElement('small');small.textContent=value;name.append(small);}
        cell(row,item.product_name+' · '+item.quantity+' PC · RM'+(item.amount_cents/100).toFixed(2));cell(row,states[item.status]||item.status);cell(row,emails[item.email_status]||'Selepas bayaran');
        const td=cell(row,'');if(item.email_status==='review')td.append(button('Hantar semula',()=>confirm(item,'order-email-retry')));
        $('order-rows').append(row);
      }
      if(!result.orders.length){const row=document.createElement('tr'),td=cell(row,'Belum ada pesanan AZDM online.');td.colSpan=5;td.className='azdm-admin-empty';$('order-rows').append(row);}
      $('orders-page-label').textContent='Halaman '+(orderPage+1)+' · '+result.orders.length+' pesanan';updatePages();
    }catch(error){$('shop-state').textContent='Pesanan online belum tersedia: '+error.message;if(!suppress)throw error;}
  }
  function load(force=false){
    if(loading)return loading;
    if(loaded&&!force)return Promise.resolve();
    loading=action(async()=>{await loadLicenses();loaded=true;await loadOrders();}).finally(()=>loading=null);
    return loading;
  }
  function selectProduct(value,focus=false){
    product=value==='azdm'?'azdm':'surveycad';
    document.getElementById('surveycadKeyPanel').hidden=product!=='surveycad';root.hidden=product!=='azdm';
    tabs.forEach(tab=>{const active=tab.dataset.softwareKeyProduct===product;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();});
    if(document.getElementById('softwarekeys').classList.contains('active'))window.azSoftwareKeyTabsLoad();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>selectProduct(tab.dataset.softwareKeyProduct));
    tab.addEventListener('keydown',event=>{
      let target;if(event.key==='ArrowRight'||event.key==='ArrowLeft')target=1-i;if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;
      if(target!==undefined){event.preventDefault();selectProduct(tabs[target].dataset.softwareKeyProduct,true);}
    });
  });
  window.azSoftwareKeyTabsLoad=()=>product==='azdm'?load():typeof window.azSoftwareKeysLoad==='function'?window.azSoftwareKeysLoad({force:false}):Promise.resolve();
  $('refresh').addEventListener('click',()=>load(true));
  $('issue-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('customer').value.trim();const result=await api('issue',{customer,days:Number($('duration').value)});
    serialRecord={...result,customer};$('serial-customer').textContent=customer+' · '+date(result.expires);$('serial-value').value=result.serial;$('serial-dialog').showModal();$('customer').value='';
    search='';$('search').value='';page=0;cursors=[null];await loadLicenses();
  });});
  $('search-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{search=$('search').value.trim();page=0;cursors=[null];await loadLicenses();});});
  $('clear-search').addEventListener('click',()=>action(async()=>{search='';$('search').value='';page=0;cursors=[null];await loadLicenses();}));
  $('next').addEventListener('click',()=>action(async()=>{const old=page;cursors[page+1]=next;page++;try{await loadLicenses();}catch(error){page=old;throw error;}}));
  $('previous').addEventListener('click',()=>action(async()=>{const old=page;page--;try{await loadLicenses();}catch(error){page=old;throw error;}}));
  function openEdit(item){
    editing=item;$('edit-name').value=item.customer;$('edit-lifetime').checked=!item.expires;
    const d=new Date((item.expires||Math.floor(Date.now()/1000)+365*86400)*1000);
    $('edit-expiry').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);$('edit-expiry').disabled=!item.expires;$('edit-expiry').required=!!item.expires;$('edit-dialog').showModal();
  }
  $('edit-lifetime').addEventListener('change',()=>{$('edit-expiry').disabled=$('edit-lifetime').checked;$('edit-expiry').required=!$('edit-lifetime').checked;});
  $('edit-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    await api('update',{license_id:editing.id,customer:$('edit-name').value.trim(),expires:$('edit-lifetime').checked?0:Math.floor(new Date($('edit-expiry').value).getTime()/1000)});
    $('edit-dialog').close();await loadLicenses();notice('Maklumat lesen disimpan.');
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
  $('refresh-orders').addEventListener('click',()=>action(async()=>{orderPage=0;orderCursors=[null];await loadOrders();}));
  $('orders-next').addEventListener('click',()=>action(async()=>{const old=orderPage;orderCursors[orderPage+1]=orderNext;orderPage++;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  $('orders-previous').addEventListener('click',()=>action(async()=>{const old=orderPage;orderPage--;try{await loadOrders(false);}catch(error){orderPage=old;throw error;}}));
  window.addEventListener('azobss-auth-changed',()=>{generation++;loaded=false;serialRecord=null;$('rows').replaceChildren();$('order-rows').replaceChildren();$('serial-value').value='';root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());});
  window.addEventListener('pagehide',()=>{serialRecord=null;$('serial-value').value='';});
  selectProduct('surveycad');updatePages();
})();
