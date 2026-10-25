(function(){
  'use strict';
  const root=document.getElementById('solattimeAdminPanel');if(!root)return;
  const $=id=>root.querySelector('#solat-'+id);
  const apiBase='https://azobss-backend.onrender.com/api/solattime/admin/';
  const licenseButtons=()=>Array.from(root.querySelectorAll('#solat-issue-form button,#solat-workspace-panel-licenses button,#solat-import-form button,#solat-serial-dialog button,#solat-confirm-dialog button,#solat-edit-dialog button,#solat-attach-dialog button'));
  let generation=0,busy=false,loaded=false,loading=null,offset=0,next=null,history=[],licenses=[],serialRecord=null,pending=null;
  let management=false,archived=false,editing=null,attaching=null,issueId='',issueFingerprint='';
  const date=value=>Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)*1000).toLocaleDateString('ms-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric'}):'—';
  function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function pages(){
    $('previous').disabled=busy||!history.length;$('next').disabled=busy||next===null;
  }
  async function api(action,body={}){
    const current=generation;
    for(let i=0;i<40&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(resolve=>setTimeout(resolve,100));
    if(current!==generation)throw Error('Sesi admin telah berubah.');
    if(typeof window.azAdminFetchJson!=='function')throw Error('Sesi admin belum tersedia. Sign in AZOBSS dan cuba semula.');
    const result=await window.azAdminFetchJson(apiBase+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(current!==generation)throw Error('Sesi admin telah berubah.');
    if(result.ok===false)throw Error(result.error||'Servis lesen Liyabudun belum tersedia.');
    return result;
  }
  async function action(fn){
    if(busy)return false;
    const current=generation;busy=true;notice('');
    licenseButtons().forEach(button=>button.disabled=true);
    try{await fn();return true;}catch(error){if(current===generation)notice(error.message||'Tindakan belum berjaya.');return false;}
    finally{if(current===generation){busy=false;licenseButtons().forEach(button=>button.disabled=false);pages();render();}}
  }
  function cell(row,text){const td=document.createElement('td');td.textContent=String(text??'');row.append(td);return td;}
  function control(text,fn,danger=false,enabled=true){const button=document.createElement('button');button.type='button';button.textContent=text;if(danger)button.className='solat-danger';button.disabled=busy||!enabled;button.addEventListener('click',fn);return button;}
  async function copySerial(serial){const current=generation;try{await navigator.clipboard.writeText(serial);if(current===generation)notice('Serial disalin.');}catch{if(current===generation)notice('Salinan automatik belum berjaya. Pilih serial dan tekan Ctrl+C.');}}
  function render(){
    const term=$('search').value.trim().toLocaleLowerCase('ms-MY');
    const items=licenses.filter(item=>typeof window.azSolatTimeWorkspaceLicenseMatches==='function'?window.azSolatTimeWorkspaceLicenseMatches(item,term):[item.customer,item.id].some(value=>String(value||'').toLocaleLowerCase('ms-MY').includes(term)));
    const sort=$('sort')?.value||'newest';items.sort((a,b)=>sort==='name'?String(a.customer||'').localeCompare(String(b.customer||''),'ms'):sort==='name-desc'?String(b.customer||'').localeCompare(String(a.customer||''),'ms'):sort==='status'?Number(b.status==='active')-Number(a.status==='active')||Number(b.created)-Number(a.created):sort==='oldest'?Number(a.created)-Number(b.created):Number(b.created)-Number(a.created));
    $('rows').replaceChildren();
    for(const item of items){
      const row=document.createElement('tr'),name=cell(row,''),title=document.createElement('strong'),id=document.createElement('small');
      title.textContent=item.customer;id.textContent=item.id;name.append(title,id);const type=document.createElement('small');type.textContent=item.source==='legacy'?'Lesen lama':'Baharu';name.append(type);
      const contact=cell(row,'');for(const value of [item.email,item.phone].filter(Boolean)){const label=document.createElement('small');label.textContent=value;contact.append(label);}if(!item.email&&!item.phone)contact.textContent='—';
      const serial=cell(row,'');
      if(item.serial){const key=document.createElement('code');key.className='solat-serial-key';key.textContent=item.serial;serial.append(key,control('Salin',()=>copySerial(item.serial)));}
      else{const unavailable=document.createElement('small');unavailable.className='solat-serial-unavailable';unavailable.textContent=item.serial_state==='unreadable'?'Serial tersimpan belum dapat dibaca':'Serial asal belum dipautkan';serial.append(unavailable);if(!archived)serial.append(control('Pautkan serial',()=>openAttach(item),false,management));}
      cell(row,item.status==='active'?'Aktif':item.status==='blocked'?'Disekat':'Tidak diketahui');
      cell(row,Number(item.device_count)>0?'1 / 1':'0 / 1');
      cell(row,'Kekal');cell(row,date(item.created));
      const controls=cell(row,''),buttons=document.createElement('div');buttons.className='solat-license-actions';controls.append(buttons);
      if(archived)buttons.append(control('Pulihkan rekod',()=>confirmLicense(item,'undelete'),false,management));
      else buttons.append(control('Edit',()=>openEdit(item),false,management),control('Reset PC',()=>confirmLicense(item,'reset'),false,management&&Number(item.device_count)>0),control(item.status==='blocked'?'Buka sekatan':'Sekat',()=>confirmLicense(item,item.status==='blocked'?'restore':'block'),item.status!=='blocked'),control('Delete',()=>confirmLicense(item,'delete'),true,management));
      $('rows').append(row);
    }
    if(!items.length){const row=document.createElement('tr'),td=cell(row,term?'Tiada lesen sepadan pada halaman ini.':archived?'Belum ada lesen dalam arkib.':'Belum ada lesen Liyabudun.');td.colSpan=8;td.className='solat-empty';$('rows').append(row);}
    $('page-label').textContent='Halaman '+(history.length+1)+' · '+items.length+' / '+licenses.length+' lesen pada halaman ini';pages();
  }
  async function loadLicenses(target=offset){
    const result=await api('list',{limit:25,offset:target,...(archived?{archived:true}:{})});
    if(!Array.isArray(result.licenses)||(result.next_offset!==null&&!Number.isInteger(result.next_offset)))throw Error('Senarai lesen tidak dapat disahkan.');
    offset=target;next=result.next_offset;licenses=result.licenses;management=result.management_enabled===true;loaded=true;render();
    if(!management)notice('Kemas kini backend Render dan servis lesen diperlukan untuk Edit, Reset PC, Delete dan paparan serial.');
    window.dispatchEvent(new CustomEvent('azobss:solattime-licenses-loaded',{detail:{licenses:licenses.map(({serial,...item})=>item),next}}));
  }
  window.azSolatTimeAdminLoad=()=>{
    if(loaded)return Promise.resolve(true);
    if(loading)return loading;
    const current=generation;
    loading=action(()=>loadLicenses()).finally(()=>{if(current===generation)loading=null;});return loading;
  };
  window.azSolatTimeAdminRefresh=()=>action(()=>loadLicenses());
  $('refresh').addEventListener('click',()=>action(()=>loadLicenses()));
  $('search').addEventListener('input',render);
  $('sort')?.addEventListener('change',render);
  $('license-view').addEventListener('change',()=>{if(busy){$('license-view').value=archived?'archived':'current';return;}archived=$('license-view').value==='archived';offset=0;history=[];action(()=>loadLicenses(0));});
  $('next').addEventListener('click',()=>action(async()=>{
    if(next===null)return;const previous=offset;await loadLicenses(next);history.push(previous);render();
  }));
  $('previous').addEventListener('click',()=>action(async()=>{
    if(!history.length)return;await loadLicenses(history[history.length-1]);history.pop();render();
  }));
  $('issue-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('customer').value.trim();if(!customer)throw Error('Masukkan nama pelanggan.');
    const email=$('email').value.trim(),phone=$('phone').value.trim(),fingerprint=JSON.stringify([customer,email,phone]);if(!issueId||issueFingerprint!==fingerprint){issueId=crypto.randomUUID();issueFingerprint=fingerprint;}
    const result=await api('issue',{customer,email,phone,request_id:issueId});
    if(typeof result.serial!=='string'||typeof result.license_id!=='string')throw Error('Serial tidak dapat disahkan. Semak panel asal sebelum mengeluarkan serial lain.');
    serialRecord={customer,serial:result.serial,id:result.license_id};
    $('serial-customer').textContent=customer+' · Lesen kekal · 1 PC';$('serial-value').value=result.serial;$('serial-status').textContent='';
    $('serial-dialog').showModal();$('customer').value='';$('email').value='';$('phone').value='';issueId='';issueFingerprint='';archived=false;$('license-view').value='current';
    await loadLicenses(0);history=[];$('search').value='';render();
  });});
  $('import-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('legacy-customer').value.trim(),serial=$('legacy-serial').value.trim().toUpperCase();
    if(!customer||!/^AZST-(?:[A-F0-9]{4}-){4}[A-F0-9]{4}$/.test(serial))throw Error('Masukkan nama pelanggan dan serial lama Liyabudun yang sah.');
    await api('import-legacy',{customer,serial});$('legacy-serial').value='';$('legacy-customer').value='';
    await loadLicenses(0);history=[];$('search').value='';render();notice('Serial lama didaftarkan. Pindahan masih perlu disahkan dalam aplikasi pada PC baharu.');
  });});
  function confirmLicense(item,operation){
    if(busy)return;pending={id:item.id,operation,generation:item.generation};
    const copy={block:['Sekat lesen Liyabudun?','PC yang menggunakan lesen ini menerima sekatan apabila online dan sync. PC offline tidak boleh dinyahaktifkan serta-merta.'],restore:['Buka sekatan lesen?','PC pemilik semasa boleh menggunakan lesen selepas sync. Tindakan ini tidak memindahkan lesen.'],reset:['Reset PC lesen ini?','PC lama dilepaskan dan tidak boleh mengambil semula lesen melalui sync. Aktifkan serial secara jelas pada PC yang dikehendaki. PC offline menerima perubahan apabila kembali online.'],delete:['Delete lesen ke arkib?','Lesen disekat dan PC dilepaskan apabila sync. Rekod serta serial disimpan dalam arkib supaya boleh dipulihkan. PC offline menerima perubahan apabila kembali online.'],undelete:['Pulihkan rekod dari arkib?','Rekod dipulihkan dalam keadaan Disekat dan tanpa PC. Semak pelanggan, kemudian buka sekatan dan aktifkan serial pada PC yang dikehendaki.']}[operation];
    $('confirm-title').textContent=copy[0];$('confirm-customer').textContent=item.customer+' · '+item.id;$('confirm-detail').textContent=copy[1];
    $('confirm-action').classList.toggle('solat-danger',['block','delete'].includes(operation));$('confirm-dialog').showModal();
  }
  $('confirm-action').addEventListener('click',()=>action(async()=>{
    if(!pending)return;try{await api(pending.operation,{license_id:pending.id,...(['reset','delete'].includes(pending.operation)?{expected_generation:pending.generation}:{})});$('confirm-dialog').close();await loadLicenses();notice('Status lesen Liyabudun sudah dikemas kini.');}catch(error){$('confirm-detail').textContent=error.message;throw error;}
  }));
  function openEdit(item){if(busy||!management)return;editing=item.id;$('edit-customer').value=item.customer||'';$('edit-email').value=item.email||'';$('edit-phone').value=item.phone||'';$('edit-status').textContent='';$('edit-dialog').showModal();}
  $('edit-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{if(!editing)return;try{await api('edit',{license_id:editing,customer:$('edit-customer').value.trim(),email:$('edit-email').value.trim(),phone:$('edit-phone').value.trim()});$('edit-dialog').close();await loadLicenses();notice('Maklumat pelanggan disimpan.');}catch(error){$('edit-status').textContent=error.message;throw error;}});});
  function openAttach(item){if(busy||!management)return;attaching=item.id;$('attach-customer').textContent=item.customer+' · '+item.id;$('attach-serial').value='';$('attach-status').textContent='';$('attach-dialog').showModal();}
  $('attach-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{if(!attaching)return;try{await api('attach-serial',{license_id:attaching,serial:$('attach-serial').value.trim().toUpperCase()});$('attach-dialog').close();await loadLicenses();notice('Serial asal disahkan dan dipautkan.');}catch(error){$('attach-status').textContent=error.message;throw error;}});});
  $('edit-dialog').addEventListener('close',()=>{editing=null;for(const id of ['edit-customer','edit-email','edit-phone'])$(id).value='';$('edit-status').textContent='';});
  $('attach-dialog').addEventListener('close',()=>{attaching=null;$('attach-serial').value='';$('attach-customer').textContent='';$('attach-status').textContent='';});
  $('copy').addEventListener('click',async()=>{
    if(!serialRecord)return;
    try{await navigator.clipboard.writeText(serialRecord.serial);$('serial-status').textContent='Serial disalin.';}
    catch{$('serial-value').focus();$('serial-value').select();$('serial-status').textContent='Pilih serial dan tekan Ctrl+C untuk menyalin.';}
  });
  $('save').addEventListener('click',()=>{
    if(!serialRecord)return;
    const text='Liyabudun\nPelanggan: '+serialRecord.customer+'\nSerial: '+serialRecord.serial+'\nID lesen: '+serialRecord.id+'\nLesen kekal, 1 PC. Pindahan disahkan melalui aplikasi.\n';
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='Liyabudun-Serial-'+serialRecord.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  root.querySelectorAll('[data-solat-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.solatClose).close()));
  $('serial-dialog').addEventListener('close',()=>{serialRecord=null;$('serial-value').value='';$('serial-status').textContent='';});
  $('confirm-dialog').addEventListener('close',()=>{pending=null;});
  function clear(){
    generation++;busy=false;loaded=false;loading=null;offset=0;next=null;history=[];licenses=[];serialRecord=null;pending=null;
    management=false;archived=false;editing=null;attaching=null;issueId='';issueFingerprint='';$('license-view').value='current';
    root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    for(const id of ['customer','email','phone','search','legacy-customer','legacy-serial','serial-value','edit-customer','edit-email','edit-phone','attach-serial'])$(id).value='';
    for(const id of ['serial-customer','serial-status','confirm-customer','confirm-detail'])$(id).textContent='';
    licenseButtons().forEach(button=>button.disabled=false);notice('');
    $('rows').replaceChildren();$('page-label').textContent='25 lesen setiap halaman';pages();
  }
  window.addEventListener('azobss-auth-changed',()=>{clear();if(!root.hidden&&document.getElementById('softwarekeys')?.classList.contains('active'))window.azSolatTimeAdminLoad();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted&&!root.hidden)window.azSolatTimeAdminLoad();});
  pages();
})();
