
(function(){
  const API = 'https://azobss-backend.onrender.com';
  function el(id){return document.getElementById(id)}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function subNotice(msg){ const n=el('subCodeListNotice'); if(n) n.textContent=msg; }
  function subCodeRef(row){ return row.activationCode || row.orderId || ''; }
  async function azSubFetch(path, options={}){
    if(typeof azAdminFetchJson === 'function') return await azAdminFetchJson(API+path, options);
    const res = await fetch(API+path, options);
    const data = await res.json().catch(()=>({ok:false,error:'Invalid response'}));
    if(!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function generateSubCode(){
    const body={
      productId:(el('subCodeProductId')?.value||'').trim(),
      productName:(el('subCodeProductName')?.value||'').trim(),
      planId:el('subCodePlan')?.value||'1m',
      buyerEmail:(el('subCodeBuyerEmail')?.value||'').trim(),
      username:(el('subCodeUsername')?.value||'').trim(),
      activationCodePrefix:(el('subCodePrefix')?.value||'AZOBSS').trim()||'AZOBSS',
      deviceLimit:1,
      transferLimitPerYear:3
    };
    if(!body.productId) return toast?.('Enter Product ID first.');
    if(!body.buyerEmail) return toast?.('Enter buyer email first.');
    const box=el('subCodeGenerateResult');
    if(box){box.hidden=false;box.textContent='Generating activation code...'}
    try{
      const j=await azSubFetch('/api/subscription/admin/create-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const code=j.activationCode||j.code||'';
      if(box){
        box.innerHTML='<div>Activation code generated:</div><div class="az-sub-code-big">'+esc(code)+'</div><div>Verify API: <b>'+esc(j.verifyApi||'/api/subscription/verify')+'</b></div>';
      }
      try{await navigator.clipboard.writeText(code)}catch(_e){}
      toast?.('Activation code generated.');
      loadSubCodes();
    }catch(e){
      if(box) box.textContent=e?.message||'Generate failed.';
      toast?.(e?.message||'Generate failed.');
    }
  }
  function renderSubCodes(rows=[]){
    const box=el('subCodeList'); if(!box) return;
    if(!rows.length){box.innerHTML='<div class="az-sub-code-row"><div class="az-sub-code-title">No subscription codes found.</div></div>';return}
    box.innerHTML=rows.map(r=>{
      const status=String(r.codeStatus||r.status||'active').toLowerCase();
      const active=status==='active'||status==='paid';
      const code=esc(r.activationCode||'');
      return '<div class="az-sub-code-row">'+
        '<div>'+
          '<div class="az-sub-code-title">'+esc(r.productName||r.productId||'Subscription Code')+'</div>'+
          '<div class="az-sub-code-meta">'+
            '<b>Code:</b> <span style="font-family:Consolas,monospace;color:#facc15">'+code+'</span><br>'+
            '<b>Plan:</b> '+esc(r.plan||r.planId||'-')+' • <b>Expiry:</b> '+esc(r.expiresAt||'-')+'<br>'+
            '<b>Email:</b> '+esc(r.buyerEmail||'-')+' • <b>Username:</b> '+esc(r.username||'-')+'<br>'+
            '<span class="az-sub-pill '+(active?'active':'revoked')+'">'+esc(status||'-')+'</span> '+
            '<span class="az-sub-pill device">Device: '+esc(r.activeDeviceMasked||'not activated')+'</span> '+
            '<span class="az-sub-pill">Transfer: '+esc(r.transferCountThisYear||0)+'/'+esc(r.transferLimitPerYear||3)+'</span>'+
          '</div>'+
        '</div>'+
        '<div class="az-sub-code-actions">'+
          '<button class="btn gray" data-sub-copy="'+code+'" type="button">Copy</button>'+
          '<button class="btn gray" data-sub-reset="'+code+'" type="button">Reset Device</button>'+
          '<button class="btn gray" data-sub-extend="'+code+'" type="button">Extend</button>'+
          '<button class="btn '+(active?'red':'green')+'" data-sub-revoke="'+code+'" data-status="'+(active?'revoked':'active')+'" type="button">'+(active?'Revoke':'Reactivate')+'</button>'+
        '</div>'+
      '</div>';
    }).join('');
  }
  async function loadSubCodes(){
    const q=encodeURIComponent((el('subCodeSearch')?.value||'').trim());
    subNotice('Loading subscription codes...');
    try{
      const j=await azSubFetch('/api/subscription/admin/list?limit=250&search='+q,{cache:'no-store'});
      renderSubCodes(j.records||[]);
      subNotice('Loaded '+(j.records?.length||0)+' subscription code(s).');
    }catch(e){
      subNotice(e?.message||'Failed to load subscription codes.');
      renderSubCodes([]);
    }
  }
  async function resetSubDevice(code){
    if(!confirm('Reset active device for this code? Customer can activate on a new PC after this.')) return;
    try{ await azSubFetch('/api/subscription/admin/reset-device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activationCode:code,reason:'admin dashboard reset'})}); toast?.('Device reset.'); loadSubCodes(); }
    catch(e){ toast?.(e?.message||'Reset failed.'); }
  }
  async function revokeSubCode(code,status){
    const label=status==='active'?'reactivate':'revoke';
    if(!confirm('Confirm '+label+' this activation code?')) return;
    try{ await azSubFetch('/api/subscription/admin/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activationCode:code,status})}); toast?.('Code updated.'); loadSubCodes(); }
    catch(e){ toast?.(e?.message||'Update failed.'); }
  }
  async function extendSubCode(code){
    const days=prompt('Extend by how many days?','30');
    if(!days) return;
    try{ await azSubFetch('/api/subscription/admin/extend',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({activationCode:code,days:Number(days)||0})}); toast?.('Expiry extended.'); loadSubCodes(); }
    catch(e){ toast?.(e?.message||'Extend failed.'); }
  }
  document.addEventListener('click',function(ev){
    const t=ev.target;
    if(t?.id==='generateSubCodeBtn') generateSubCode();
    if(t?.id==='refreshSubCodesBtn') loadSubCodes();
    if(t?.dataset?.subCopy){ navigator.clipboard?.writeText(t.dataset.subCopy); toast?.('Code copied.'); }
    if(t?.dataset?.subReset) resetSubDevice(t.dataset.subReset);
    if(t?.dataset?.subRevoke) revokeSubCode(t.dataset.subRevoke,t.dataset.status||'revoked');
    if(t?.dataset?.subExtend) extendSubCode(t.dataset.subExtend);
  });
  document.addEventListener('keydown',function(ev){
    if(ev.key==='Enter' && ev.target?.id==='subCodeSearch') loadSubCodes();
  });
  window.loadSubCodes=loadSubCodes;
})();
