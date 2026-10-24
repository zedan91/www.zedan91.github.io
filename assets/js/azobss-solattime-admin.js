(function(){
  'use strict';
  const root=document.getElementById('solattimeAdminPanel');if(!root)return;
  const $=id=>root.querySelector('#solat-'+id);
  const apiBase='https://azobss-backend.onrender.com/api/solattime/admin/';
  const licenseButtons=()=>Array.from(root.querySelectorAll('#solat-issue-form button,#solat-workspace-panel-licenses button,#solat-import-form button,#solat-serial-dialog button,#solat-confirm-dialog button'));
  let generation=0,busy=false,loaded=false,loading=null,offset=0,next=null,history=[],licenses=[],serialRecord=null,pending=null;
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
    if(result.ok===false)throw Error(result.error||'Servis lesen SolatTime belum tersedia.');
    return result;
  }
  async function action(fn){
    if(busy)return false;
    const current=generation;busy=true;notice('');
    licenseButtons().forEach(button=>button.disabled=true);
    try{await fn();return true;}catch(error){if(current===generation)notice(error.message||'Tindakan belum berjaya.');return false;}
    finally{if(current===generation){busy=false;licenseButtons().forEach(button=>button.disabled=false);pages();}}
  }
  function cell(row,text){const td=document.createElement('td');td.textContent=String(text??'');row.append(td);return td;}
  function render(){
    const term=$('search').value.trim().toLocaleLowerCase('ms-MY');
    const items=licenses.filter(item=>typeof window.azSolatTimeWorkspaceLicenseMatches==='function'?window.azSolatTimeWorkspaceLicenseMatches(item,term):[item.customer,item.id].some(value=>String(value||'').toLocaleLowerCase('ms-MY').includes(term)));
    const sort=$('sort')?.value||'newest';items.sort((a,b)=>sort==='name'?String(a.customer||'').localeCompare(String(b.customer||''),'ms'):sort==='name-desc'?String(b.customer||'').localeCompare(String(a.customer||''),'ms'):sort==='status'?Number(b.status==='active')-Number(a.status==='active')||Number(b.created)-Number(a.created):sort==='oldest'?Number(a.created)-Number(b.created):Number(b.created)-Number(a.created));
    $('rows').replaceChildren();
    for(const item of items){
      const row=document.createElement('tr'),name=cell(row,''),title=document.createElement('strong'),id=document.createElement('small');
      title.textContent=item.customer;id.textContent=item.id;name.append(title,id);
      cell(row,item.status==='active'?'Aktif':item.status==='blocked'?'Disekat':'Tidak diketahui');
      cell(row,Number(item.device_count)>0?'1 / 1':'0 / 1');
      cell(row,item.source==='legacy'?'Lesen lama':'Baharu');cell(row,date(item.created));
      const controls=cell(row,''),button=document.createElement('button');button.type='button';
      button.textContent=item.status==='blocked'?'Buka sekatan':'Sekat';
      button.classList.toggle('solat-danger',item.status!=='blocked');button.disabled=busy;
      button.addEventListener('click',()=>confirmLicense(item,item.status==='blocked'?'restore':'block'));controls.append(button);$('rows').append(row);
    }
    if(!items.length){const row=document.createElement('tr'),td=cell(row,term?'Tiada lesen sepadan pada halaman ini.':'Belum ada lesen SolatTime.');td.colSpan=6;td.className='solat-empty';$('rows').append(row);}
    $('page-label').textContent='Halaman '+(history.length+1)+' · '+items.length+' / '+licenses.length+' lesen pada halaman ini';pages();
  }
  async function loadLicenses(target=offset){
    const result=await api('list',{limit:25,offset:target});
    if(!Array.isArray(result.licenses)||(result.next_offset!==null&&!Number.isInteger(result.next_offset)))throw Error('Senarai lesen tidak dapat disahkan.');
    offset=target;next=result.next_offset;licenses=result.licenses;loaded=true;render();
    window.dispatchEvent(new CustomEvent('azobss:solattime-licenses-loaded',{detail:{licenses,next}}));
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
  $('next').addEventListener('click',()=>action(async()=>{
    if(next===null)return;const previous=offset;await loadLicenses(next);history.push(previous);render();
  }));
  $('previous').addEventListener('click',()=>action(async()=>{
    if(!history.length)return;await loadLicenses(history[history.length-1]);history.pop();render();
  }));
  $('issue-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('customer').value.trim();if(!customer)throw Error('Masukkan nama pelanggan.');
    const result=await api('issue',{customer});
    if(typeof result.serial!=='string'||typeof result.license_id!=='string')throw Error('Serial tidak dapat disahkan. Semak panel asal sebelum mengeluarkan serial lain.');
    serialRecord={customer,serial:result.serial,id:result.license_id};
    $('serial-customer').textContent=customer+' · Lesen kekal · 1 PC';$('serial-value').value=result.serial;$('serial-status').textContent='';
    $('serial-dialog').showModal();$('customer').value='';
    await loadLicenses(0);history=[];$('search').value='';render();
  });});
  $('import-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
    const customer=$('legacy-customer').value.trim(),serial=$('legacy-serial').value.trim().toUpperCase();
    if(!customer||!/^AZST-(?:[A-F0-9]{4}-){4}[A-F0-9]{4}$/.test(serial))throw Error('Masukkan nama pelanggan dan serial lama SolatTime yang sah.');
    await api('import-legacy',{customer,serial});$('legacy-serial').value='';$('legacy-customer').value='';
    await loadLicenses(0);history=[];$('search').value='';render();notice('Serial lama didaftarkan. Pindahan masih perlu disahkan dalam aplikasi pada PC baharu.');
  });});
  function confirmLicense(item,operation){
    if(busy)return;pending={id:item.id,operation};
    $('confirm-title').textContent=operation==='block'?'Sekat lesen SolatTime?':'Buka sekatan lesen SolatTime?';
    $('confirm-customer').textContent=item.customer;
    $('confirm-detail').textContent=operation==='block'?'PC yang menggunakan lesen ini akan menerima sekatan apabila online dan sync. PC yang masih offline tidak boleh dinyahaktifkan serta-merta.':'Selepas sync, PC pemilik semasa boleh menggunakan lesen ini semula. Tindakan ini tidak memindahkan lesen ke PC lain.';
    $('confirm-action').classList.toggle('solat-danger',operation==='block');$('confirm-dialog').showModal();
  }
  $('confirm-action').addEventListener('click',()=>action(async()=>{
    if(!pending)return;await api(pending.operation,{license_id:pending.id});$('confirm-dialog').close();await loadLicenses();notice('Status lesen SolatTime sudah dikemas kini.');
  }));
  $('copy').addEventListener('click',async()=>{
    if(!serialRecord)return;
    try{await navigator.clipboard.writeText(serialRecord.serial);$('serial-status').textContent='Serial disalin.';}
    catch{$('serial-value').focus();$('serial-value').select();$('serial-status').textContent='Pilih serial dan tekan Ctrl+C untuk menyalin.';}
  });
  $('save').addEventListener('click',()=>{
    if(!serialRecord)return;
    const text='AZOBSS SolatTime\nPelanggan: '+serialRecord.customer+'\nSerial: '+serialRecord.serial+'\nID lesen: '+serialRecord.id+'\nLesen kekal, 1 PC. Pindahan disahkan melalui aplikasi.\n';
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='SolatTime-Serial-'+serialRecord.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  root.querySelectorAll('[data-solat-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.solatClose).close()));
  $('serial-dialog').addEventListener('close',()=>{serialRecord=null;$('serial-value').value='';$('serial-status').textContent='';});
  $('confirm-dialog').addEventListener('close',()=>{pending=null;});
  function clear(){
    generation++;busy=false;loaded=false;loading=null;offset=0;next=null;history=[];licenses=[];serialRecord=null;pending=null;
    root.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    for(const id of ['customer','search','legacy-customer','legacy-serial','serial-value'])$(id).value='';
    for(const id of ['serial-customer','serial-status','confirm-customer','confirm-detail'])$(id).textContent='';
    licenseButtons().forEach(button=>button.disabled=false);notice('');
    $('rows').replaceChildren();$('page-label').textContent='25 lesen setiap halaman';pages();
  }
  window.addEventListener('azobss-auth-changed',()=>{clear();if(!root.hidden&&document.getElementById('softwarekeys')?.classList.contains('active'))window.azSolatTimeAdminLoad();});
  window.addEventListener('pagehide',clear);
  window.addEventListener('pageshow',event=>{if(event.persisted&&!root.hidden)window.azSolatTimeAdminLoad();});
  pages();
})();
