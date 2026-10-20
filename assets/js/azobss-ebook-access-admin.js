(function(){
  'use strict';
  const root=document.getElementById('ebookAccessAdminPanel');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const BACKEND='https://azobss-backend.onrender.com';
  const PAGE_SIZE=25;
  let records=[],filtered=[],page=0,loaded=false,loading=null,currentUid='',previousBodyOverflow='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safe=v=>String(v??'').trim();
  const customerName=r=>r?.username||r?.email||r?.uid||'AZOBSS Customer';
  function notice(text,error=false){const n=$('ebookAccessNotice');if(!n)return;n.textContent=text||'';n.hidden=!text;n.style.borderColor=error?'#a83b3b':'';n.style.color=error?'#ffaaaa':'';}
  function date(value){if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):String(value);}
  function shortDate(value){if(!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric'}):String(value);}
  function compactId(v,max=16){v=safe(v);if(!v)return '—';if(v.length<=max)return v;return v.slice(0,Math.max(6,max-5))+'…'+v.slice(-4);}
  function paymentLabel(v){const x=safe(v).toUpperCase();return x||'—';}
  async function api(url,options={}){
    for(let i=0;i<40&&typeof window.azAdminFetchJson!=='function';i++)await new Promise(r=>setTimeout(r,100));
    if(typeof window.azAdminFetchJson!=='function')throw new Error('Sesi admin belum tersedia. Sign in semula.');
    const data=await window.azAdminFetchJson(BACKEND+url,{cache:'no-store',...options});
    if(data?.ok===false)throw new Error(data.error||'Ebook access service failed.');
    return data;
  }
  function apply(){
    const q=safe($('ebookAccessSearch')?.value).toLowerCase();
    const status=$('ebookAccessStatus')?.value||'all';
    const sort=$('ebookAccessSort')?.value||'purchased-desc';
    filtered=records.filter(r=>{
      if(status==='active'&&!r.active)return false;
      if(status==='revoked'&&r.active)return false;
      if(!q)return true;
      return [r.username,r.email,r.phone,r.uid,r.orderId,r.billCode,r.paymentReference,r.paymentMethod,r.revokedReason,r.revokedBy].join(' ').toLowerCase().includes(q);
    });
    filtered.sort((a,b)=>{
      if(sort==='purchased-asc')return (a.purchasedAtMs||0)-(b.purchasedAtMs||0);
      if(sort==='used-desc')return (b.lastAccessAtMs||0)-(a.lastAccessAtMs||0)||(b.purchasedAtMs||0)-(a.purchasedAtMs||0);
      if(sort==='customer-asc')return customerName(a).localeCompare(customerName(b));
      if(sort==='customer-desc')return customerName(b).localeCompare(customerName(a));
      if(sort==='active-first')return Number(b.active)-Number(a.active)||(b.purchasedAtMs||0)-(a.purchasedAtMs||0);
      if(sort==='revoked-first')return Number(a.active)-Number(b.active)||(b.purchasedAtMs||0)-(a.purchasedAtMs||0);
      return (b.purchasedAtMs||0)-(a.purchasedAtMs||0);
    });
    const maxPage=Math.max(0,Math.ceil(filtered.length/PAGE_SIZE)-1);if(page>maxPage)page=maxPage;render();
  }
  function actionButtons(r){
    const wrap=document.createElement('div');wrap.className='ebook-access-actions';
    const view=document.createElement('button');view.type='button';view.className='ebook-access-btn view';view.textContent='View ›';view.addEventListener('click',()=>openDrawer(r));wrap.append(view);
    const state=document.createElement('button');state.type='button';state.className='ebook-access-btn '+(r.active?'danger':'restore');state.textContent=r.active?'Sekat':'Pulihkan';state.addEventListener('click',()=>toggle(r));wrap.append(state);
    return wrap;
  }
  function render(){
    const body=$('ebookAccessRows');if(!body)return;body.replaceChildren();
    const rows=filtered.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
    for(const r of rows){
      const tr=document.createElement('tr');
      const contact=[r.email?`<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>`:'',r.phone?`<small>☎ ${esc(r.phone)}</small>`:''].filter(Boolean).join('')||'—';
      const lastUsed=r.lastAccessAt?`<small>Last used: ${esc(shortDate(r.lastAccessAt))}</small>`:'<small>Last used: belum direkod</small>';
      tr.innerHTML=`
        <td data-label="Customer"><strong>${esc(customerName(r))}</strong><small>${esc(compactId(r.uid,18))}</small></td>
        <td data-label="Contact">${contact}</td>
        <td data-label="Access"><span class="ebook-access-status ${r.active?'active':'revoked'}">${r.active?'AKTIF':'DISEKAT'}</span>${lastUsed}</td>
        <td data-label="Purchase"><strong>${esc(shortDate(r.purchasedAt))}</strong><small>Lifetime · RM${Number(r.priceRM||19).toFixed(2)}</small></td>
        <td data-label="Payment"><span class="ebook-access-payment">${esc(paymentLabel(r.paymentMethod))}</span><small>${esc(compactId(r.billCode||r.paymentReference,18))}</small></td>
        <td data-label="Tindakan"></td>`;
      tr.lastElementChild.append(actionButtons(r));body.append(tr);
    }
    if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.className='ebook-access-empty';td.textContent=records.length?'Tiada rekod sepadan dengan filter/carian.':'Belum ada pembeli Ebook Generator.';tr.append(td);body.append(tr);}
    const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
    $('ebookAccessPageLabel').textContent=`${filtered.length} rekod • Halaman ${page+1} / ${pages}`;
    $('ebookAccessPrevious').disabled=page<=0;$('ebookAccessNext').disabled=(page+1)*PAGE_SIZE>=filtered.length;
    const pager=$('ebookAccessPager');if(pager)pager.hidden=filtered.length<=PAGE_SIZE;
    if(currentUid){const latest=records.find(x=>x.uid===currentUid);if(latest&&!$('ebookAccessDrawer')?.hidden)populateDrawer(latest);}
  }
  function copyValue(value,label='Maklumat'){
    const text=safe(value);if(!text)return;
    navigator.clipboard?.writeText(text).then(()=>notice(`${label} disalin.`)).catch(()=>notice('Tidak dapat salin automatik. Gunakan Ctrl+C.',true));
  }
  function line(label,value,copy=false){const raw=safe(value)||'—';return `<div class="ebook-access-line"><span>${esc(label)}</span><b>${esc(raw)}</b>${copy&&raw!=='—'?`<button class="ebook-access-copy" type="button" data-copy-value="${esc(raw)}" data-copy-label="${esc(label)}">Copy</button>`:''}</div>`;}
  function populateDrawer(r){
    currentUid=r.uid||'';
    const title=$('ebookAccessDrawerTitle'),sub=$('ebookAccessDrawerSubtitle'),body=$('ebookAccessDrawerBody');if(!body)return;
    if(title)title.textContent=customerName(r);
    if(sub)sub.textContent=`${r.active?'ACTIVE':'REVOKED'} • Lifetime RM${Number(r.priceRM||19).toFixed(2)}`;
    const reason=r.revokedReason||'—';
    body.innerHTML=`
      <div class="ebook-access-drawer-metrics">
        <div class="ebook-access-drawer-metric"><span>Status</span><b>${r.active?'AKTIF':'DISEKAT'}</b></div>
        <div class="ebook-access-drawer-metric"><span>Harga</span><b>RM${Number(r.priceRM||19).toFixed(2)}</b></div>
        <div class="ebook-access-drawer-metric"><span>Last Used</span><b>${esc(r.lastAccessAt?shortDate(r.lastAccessAt):'Belum')}</b></div>
      </div>
      <div class="ebook-access-drawer-section"><h4>👤 Akaun Customer</h4>
        ${line('Username',r.username)}${line('Email',r.email)}${line('Phone',r.phone)}${line('Firebase UID',r.uid,true)}
      </div>
      <div class="ebook-access-drawer-section"><h4>💳 Pembelian & Payment</h4>
        ${line('Purchased',date(r.purchasedAt))}${line('Payment',paymentLabel(r.paymentMethod))}${line('Order ID',r.orderId,true)}${line('BillCode',r.billCode,true)}${line('Payment Ref',r.paymentReference,true)}
      </div>
      <div class="ebook-access-drawer-section"><h4>🕘 Access Audit</h4>
        ${line('Last Used',r.lastAccessAt?date(r.lastAccessAt):'Belum direkod')}${line('Last Updated',r.accessUpdatedAt?date(r.accessUpdatedAt):'—')}${line('Blocked At',r.revokedAt?date(r.revokedAt):'—')}${line('Blocked By',r.revokedBy||'—')}${line('Block Reason',reason)}${line('Restored At',r.restoredAt?date(r.restoredAt):'—')}${line('Restored By',r.restoredBy||'—')}
        <p class="ebook-access-audit-note">Last Used mula direkod apabila akaun berjaya melepasi semakan akses Ebook Generator. Rekod lama mungkin menunjukkan “Belum direkod” sehingga customer menggunakan generator semula.</p>
      </div>
      <div class="ebook-access-drawer-actions">
        <button class="ebook-access-btn view" type="button" data-ebook-resync="${esc(r.uid||'')}">↻ Re-sync Access</button>
        <button class="ebook-access-btn ${r.active?'danger':'restore'}" type="button" data-ebook-toggle="${esc(r.uid||'')}">${r.active?'Sekat Akses':'Pulihkan Akses'}</button>
        <a class="ebook-access-btn" href="/Software-Tools/#ebook" target="_blank" rel="noopener" style="text-decoration:none">↗ Open Generator</a>
      </div>`;
  }
  function openDrawer(r){
    populateDrawer(r);const back=$('ebookAccessDrawerBackdrop'),drawer=$('ebookAccessDrawer');if(back)back.hidden=false;if(drawer)drawer.hidden=false;previousBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';setTimeout(()=>$('ebookAccessDrawerClose')?.focus(),0);
  }
  function closeDrawer(){const back=$('ebookAccessDrawerBackdrop'),drawer=$('ebookAccessDrawer');if(back)back.hidden=true;if(drawer)drawer.hidden=true;document.body.style.overflow=previousBodyOverflow||'';currentUid='';}
  async function toggle(r){
    const action=r.active?'revoke':'restore';
    if(!confirm(`${action==='revoke'?'Sekat':'Pulihkan'} akses Ebook Generator untuk ${customerName(r)}?\n\nRekod pembelian tidak akan dipadam.`))return;
    let reason='';
    if(action==='revoke')reason=safe(prompt('Sebab sekatan (optional):',''));
    notice(action==='revoke'?'Menyekat akses...':'Memulihkan akses...');
    try{await api('/api/admin/ebook-generator-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:r.uid,action,reason})});await load(true);notice(action==='revoke'?'Akses disekat.':'Akses dipulihkan.');}
    catch(e){notice(e.message||'Tindakan gagal.',true);}
  }
  async function resync(r){
    if(!r)return;
    if(!r.active){notice('Akses sedang disekat. Pulihkan akses dahulu sebelum Re-sync.',true);return;}
    if(!confirm(`Re-sync entitlement Ebook Generator untuk ${customerName(r)} daripada rekod pembayaran PAID?`))return;
    notice('Re-sync akses daripada rekod pembayaran...');
    try{await api('/api/admin/ebook-generator-access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid:r.uid,action:'resync'})});await load(true);notice('Akses berjaya diselaraskan semula.');}
    catch(e){notice(e.message||'Re-sync gagal.',true);}
  }
  async function load(forceArg=false){
    const force=typeof forceArg==='object'?!!forceArg.force:!!forceArg;
    if(loading)return loading;if(loaded&&!force){apply();return;}
    loading=(async()=>{notice('Loading Ebook Generator access...');const data=await api('/api/admin/ebook-generator-access');records=Array.isArray(data.records)?data.records:[];loaded=true;page=0;$('ebookAccessTotal').textContent=String(data.total??records.length);$('ebookAccessActive').textContent=String(data.active??records.filter(x=>x.active).length);$('ebookAccessRevoked').textContent=String(data.revoked??records.filter(x=>!x.active).length);notice('');apply();})().catch(e=>{notice(e.message||'Tidak dapat memuatkan akses Ebook.',true);throw e;}).finally(()=>loading=null);
    return loading;
  }
  $('ebookAccessSearch')?.addEventListener('input',()=>{page=0;apply();});
  $('ebookAccessStatus')?.addEventListener('change',()=>{page=0;apply();});
  $('ebookAccessSort')?.addEventListener('change',()=>{page=0;apply();});
  $('ebookAccessRefresh')?.addEventListener('click',()=>load(true));
  $('ebookAccessPrevious')?.addEventListener('click',()=>{if(page>0){page--;render();}});
  $('ebookAccessNext')?.addEventListener('click',()=>{if((page+1)*PAGE_SIZE<filtered.length){page++;render();}});
  $('ebookAccessDrawerClose')?.addEventListener('click',closeDrawer);
  $('ebookAccessDrawerBackdrop')?.addEventListener('click',closeDrawer);
  $('ebookAccessDrawerBody')?.addEventListener('click',event=>{
    const copy=event.target.closest('[data-copy-value]');if(copy){copyValue(copy.getAttribute('data-copy-value'),copy.getAttribute('data-copy-label')||'Maklumat');return;}
    const uid=event.target.closest('[data-ebook-toggle]')?.getAttribute('data-ebook-toggle');if(uid){const r=records.find(x=>x.uid===uid);if(r)toggle(r);return;}
    const syncUid=event.target.closest('[data-ebook-resync]')?.getAttribute('data-ebook-resync');if(syncUid){const r=records.find(x=>x.uid===syncUid);if(r)resync(r);}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('ebookAccessDrawer')?.hidden)closeDrawer();});
  window.azEbookAccessAdminLoad=load;
})();
