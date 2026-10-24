const el=id=>document.getElementById(id);let offset=0;
async function post(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+el('token').value},body:JSON.stringify(body),cache:'no-store'});
 const value=await response.json();if(!response.ok)throw new Error(value.error||'service_unavailable');return value;
}
async function busy(action){
 for(const b of document.querySelectorAll('button'))b.disabled=true;
 try{await action();el('status').textContent='Selesai.';}catch(e){el('status').textContent='Tidak selesai: '+e.message;}
 finally{for(const b of document.querySelectorAll('button'))b.disabled=false;}
}
async function list(reset=true){
 if(reset){offset=0;el('rows').replaceChildren();}
 const result=await post('/admin/list',{offset});
 for(const row of result.licenses){
  const tr=document.createElement('tr');
  for(const text of [row.customer,row.source,row.status,String(row.device_count)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
  const td=document.createElement('td'),button=document.createElement('button');
  button.textContent=row.status==='active'?'Sekat lesen':'Pulihkan lesen';
  button.onclick=()=>{if(confirm(button.textContent+' untuk pelanggan ini? PC offline hanya menerima perubahan selepas sync.'))busy(async()=>{await post(row.status==='active'?'/admin/block':'/admin/restore',{license_id:row.id});await list();});};
  td.append(button);tr.append(td);el('rows').append(tr);
 }
 offset=result.next_offset;el('more').hidden=offset===null;
}
el('connect').onclick=()=>busy(()=>list());el('more').onclick=()=>busy(()=>list(false));
el('issue').onclick=()=>busy(async()=>{const value=await post('/admin/issue',{customer:el('customer').value});el('issued').textContent='Serial baharu (simpan sekarang):\n'+value.serial;await list();});
el('import').onclick=()=>busy(async()=>{await post('/admin/import-legacy',{customer:el('legacyCustomer').value,serial:el('legacySerial').value});el('legacySerial').value='';await list();});
