(function(){
  'use strict';
  const root=document.getElementById('ebookAccessAdminPanel');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const BACKEND='https://azobss-backend.onrender.com';
  const PAGE_SIZE=25;
  let records=[],filtered=[],page=0,loaded=false,loading=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function notice(text,error=false){const n=$('ebookAccessNotice');if(!n)return;n.textContent=text||'';n.hidden=!text;n.style.borderColor=error?'#a83b3b':'';n.style.color=error?'#ffaaaa':'';}
  function date(value){if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):String(value);}
  async function api(url,options={}){
    for(let i=0;i<40&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(r=>setTimeout(r,100));
    if(typeof window.azAdminFetchJson!=='function')throw new Error('Sesi admin belum tersedia. Sign in semula.');
    const data=await window.azAdminFetchJson(BACKEND+url,{cache:'no-store',...options});
    if(data?.ok===false)throw new Error(data.error||'Ebook access service failed.');
    return data;
  }
  function customerName(r){return r.username||r.email||r.uid||'AZOBSS Customer';}
  function apply(){
    const q=String($('ebookAccessSearch')?.value||'').trim().toLowerCase(),sort=$('ebookAccessSort')?.value||'purchased-desc';
    filtered=records.filter(r=>!q||[r.username,r.email,r.phone,r.uid,r.orderId,r.billCode,r.paymentReference].join(' ').toLowerCase().includes(q));
    filtered.sort((a,b)=>{
      if(sort==='purchased-asc')return (a.purchasedAtMs||0)-(b.purchasedAtMs||0);
      if(sort==='customer-asc')return customerName(a).localeCompare(customerName(b));
      if(sort==='customer-desc')return customerName(b).localeCompare(customerName(a));
      if(sort==='active-first')return Number(b.active)-Number(a.active)||(b.purchasedAtMs||0)-(a.purchasedAtMs||0);
      if(sort==='revoked-first')return Number(a.active)-Number(b.active)||(b.purchasedAtMs||0)-(a.purchasedAtMs||0);
      return (b.purchasedAtMs||0)-(a.purchasedAtMs||0);
    });
    const maxPage=Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1);if(page>maxPage)page=maxPage;render();
  }
  function render(){
    const body=$('ebookAccessRows');if(!body)return;body.replaceChildren();
    const rows=filtered.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
    for(const r of rows){
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><strong>${esc(customerName(r))}</strong><small>${esc(r.uid||'')}</small></td><td>${r.email?`<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`:'—'}${r.phone?`<small>☎ ${esc(r.phone)}</small>`:''}</td><td><span class="ebook-access-status ${r.active?'active':'revoked'}">${r.active?'AKTIF':'DISEKAT'}</span><small>Lifetime · RM${Number(r.priceRM||19).toFixed(2)}</small></td><td>${esc(date(r.purchasedAt))}</td><td>${esc(String(r.paymentMethod||'').toUpperCase()||'—')}<small>${esc(r.billCode||r.paymentReference||'')}</small></td><td><span class="ebook-access-order">${esc(r.orderId||'—')}</span></td><td></td>`;
      const td=tr.lastElementChild,btn=document.createElement('button');btn.type='button';btn.className=r.active?'azdm-danger':'azdm-primary';btn.textContent=r.active?'Sekat':'Pulihkan';btn.addEventListener('click',()=>toggle(r));td.append(btn);body.append(tr);
    }
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='azdm-admin-empty';td.textContent=records.length?'Tiada rekod sepadan dengan carian.':'Belum ada pembeli Ebook Generator.';tr.append(td);body.append(tr);}
    $('ebookAccessPageLabel').textContent=`${filtered.length} rekod · Halaman ${page+1} / ${Math.max(1,Math.ceil(filtered.length/PAGE_SIZE))}`;
    $('ebookAccessPrevious').disabled=page<=0;$('ebookAccessNext').disabled=(page+1)*PAGE_SIZE>=filtered.length;
  }
  async function toggle(r){
    const action=r.active?'revoke':'restore';
    if(!confirm(`${action==='revoke'?'Sekat':'Pulihkan'} akses Ebook Generator untuk ${customerName(r)}?\n\nRekod pembelian tidak dipadam.`))return;
    notice(action==='revoke'?'Menyekat akses...':'Memulihkan akses...');
    try{await api('/api/admin/ebook-generator-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:r.uid,action})});await load(true);notice(action==='revoke'?'Akses disekat.':'Akses dipulihkan.');}
    catch(e){notice(e.message||'Tindakan gagal.',true);}
  }
  async function load(force=false){
    if(loading)return loading;if(loaded&&!force){apply();return;}
    loading=(async()=>{notice('Loading Ebook Generator access...');const data=await api('/api/admin/ebook-generator-access');records=Array.isArray(data.records)?data.records:[];loaded=true;page=0;$('ebookAccessTotal').textContent=String(data.total??records.length);$('ebookAccessActive').textContent=String(data.active??records.filter(x=>x.active).length);$('ebookAccessRevoked').textContent=String(data.revoked??records.filter(x=>!x.active).length);notice('');apply();})().catch(e=>{notice(e.message||'Tidak dapat memuatkan akses Ebook.',true);throw e;}).finally(()=>loading=null);
    return loading;
  }
  $('ebookAccessSearch')?.addEventListener('input',()=>{page=0;apply();});
  $('ebookAccessSort')?.addEventListener('change',()=>{page=0;apply();});
  $('ebookAccessRefresh')?.addEventListener('click',()=>load(true));
  $('ebookAccessPrevious')?.addEventListener('click',()=>{if(page>0){page--;render();}});
  $('ebookAccessNext')?.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render();}});
  window.azEbookAccessAdminLoad=load;
})();
