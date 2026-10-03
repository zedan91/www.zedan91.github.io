/* AZDM uses the existing AZOBSS Firebase login. No guest email/name form. */
(function(){
  'use strict';
  const root=document.getElementById('azdm-license');
  if(!root)return;
  const api='https://azobss-backend.onrender.com/api/azdm/';
  const plan=root.querySelector('[name="azdm-plan"]'),quantity=root.querySelector('[name="azdm-quantity"]');
  const buy=root.querySelector('[data-azdm-buy]'),message=root.querySelector('[data-azdm-message]');
  const summary=root.querySelector('[data-azdm-summary]'),orders=root.querySelector('[data-azdm-orders]');
  let available=false,requestId='',requestSelection='',pollCount=0,pollTimer;
  const money=cents=>'RM'+(cents/100).toFixed(2);
  const qty=()=>Number(quantity.value);
  function calculate(){
    const n=qty(),valid=Number.isInteger(n)&&n>=1&&n<=100;
    const unit=plan.value==='annual'?2500:n>=2?4000:5000;
    summary.textContent=valid?`${n} PC × ${money(unit)} = ${money(n*unit)}`:'Masukkan bilangan PC antara 1 hingga 100.';
    root.querySelector('[data-azdm-saving]').textContent=plan.value==='lifetime'&&valid&&n>=2?`Jimat ${money(n*1000)} berbanding membeli ${n} lesen berasingan.`:plan.value==='lifetime'?'Beli 2 PC atau lebih sekaligus untuk harga RM40 setiap PC.':'RM25 setiap PC untuk 1 tahun.';
    buy.disabled=!valid||!available;
  }
  async function authHeaders(waitForRestore=false){
    for(let attempt=0;attempt<(waitForRestore?20:1);attempt++){
      const headers=typeof window.azobssGetFirebaseAuthHeaders==='function'?await window.azobssGetFirebaseAuthHeaders(false):{};
      if(headers?.Authorization)return {...headers,'Content-Type':'application/json'};
      if(waitForRestore)await new Promise(resolve=>setTimeout(resolve,200));
    }
    throw new Error('Sila sign in ke akaun AZOBSS dahulu.');
  }
  function signIn(){
    const trigger=document.querySelector('#loginButton,#loginBtn,#openLogin,[data-open-login],[data-auth-action="login"],.login-button,.az-login-btn');
    if(trigger)trigger.click();
    else if(typeof window.openSiteAuth==='function')window.openSiteAuth('login');
  }
  async function call(action,options={}){
    const response=await fetch(api+action,{...options,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});
    const data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||'Servis belum tersedia. Cuba semula.');
    return data;
  }
  const emailLabels={accepted:'Email serial diterima oleh servis email. Semak inbox atau spam.',queued:'Serial siap. Email sedang menunggu penghantaran.',sending:'Serial siap. Email sedang dihantar.',review:'Serial siap. Penghantaran email perlu semakan support.'};
  function statusText(row){return row.status==='paid'?(emailLabels[row.email_status]||'Bayaran disahkan. Serial sedang disediakan.'):row.status==='creation_failed'?'Bil tidak berjaya dicipta. Tiada lesen dikeluarkan.':row.status==='creating'?'Bil sedang disediakan.':'Bayaran belum disahkan.';}
  async function refreshOrders(){
    try{
      const data=await call('orders',{headers:await authHeaders()});
      orders.replaceChildren();
      if(!data.orders.length){orders.textContent='Belum ada pesanan AZDM untuk akaun ini.';return;}
      for(const row of data.orders){
        const card=document.createElement('div');card.className='azdm-order';
        const title=document.createElement('strong');title.textContent=`${row.product_name} · ${row.quantity} PC · ${money(row.amount_cents)}`;
        const state=document.createElement('p');state.textContent=statusText(row);
        const ref=document.createElement('small');ref.textContent='No. pesanan: '+row.order_id;
        card.append(title,state,ref);
        if(row.status==='pending'){
          const check=document.createElement('button');check.type='button';check.textContent='Semak bayaran';
          check.addEventListener('click',()=>checkStatus(row.order_id));card.append(check);
        }
        const support=document.createElement('a');support.href='https://wa.me/601135600723?text='+encodeURIComponent('Saya perlukan bantuan AZDM. No. pesanan: '+row.order_id);support.target='_blank';support.rel='noopener';support.textContent='Hubungi support';card.append(support);
        orders.append(card);
      }
    }catch(error){orders.textContent=error.message;}
  }
  async function checkStatus(id){
    clearTimeout(pollTimer);
    try{
      const data=await call('status?azdm_order='+encodeURIComponent(id),{headers:await authHeaders(true)});
      message.textContent=statusText(data)+(data.status==='paid'?' Email akaun: '+data.email:'')+' No. pesanan: '+id;
      if(data.status==='paid'){
        try{sessionStorage.removeItem('azdm-pending-order');sessionStorage.removeItem('azdm-checkout-request');}catch(_){}
        requestId='';requestSelection='';await refreshOrders();
      }
      if(data.status==='pending'&&pollCount++<12)pollTimer=setTimeout(()=>checkStatus(id),5000);
    }catch(error){message.textContent=error.message;}
  }
  plan.addEventListener('change',calculate);quantity.addEventListener('input',calculate);
  root.querySelector('[data-azdm-signin]').addEventListener('click',signIn);
  root.querySelector('[data-azdm-refresh]').addEventListener('click',async()=>{
    await refreshOrders();
    let id=new URLSearchParams(location.search).get('azdm_order');
    try{id=id||sessionStorage.getItem('azdm-pending-order');}catch(_){}
    if(id){pollCount=0;await checkStatus(id);}
  });
  buy.addEventListener('click',async()=>{
    message.textContent='';buy.disabled=true;
    try{
      const headers=await authHeaders();
      const selection=plan.value+':'+qty();
      try{
        const saved=JSON.parse(sessionStorage.getItem('azdm-checkout-request')||'null');
        if(saved&&saved.selection===selection&&Date.now()-saved.created<3*86400000){requestId=saved.id;requestSelection=selection;}
      }catch(_){}
      if(!requestId||requestSelection!==selection){requestId=crypto.randomUUID();requestSelection=selection;}
      try{sessionStorage.setItem('azdm-checkout-request',JSON.stringify({id:requestId,selection,created:Date.now()}));}catch(_){}
      message.textContent='Menyediakan pembayaran ToyyibPay…';
      const data=await call('checkout',{method:'POST',headers,body:JSON.stringify({plan:plan.value,quantity:qty(),request_id:requestId})});
      const url=new URL(data.payment_url);
      if(!['toyyibpay.com','dev.toyyibpay.com'].includes(url.hostname)||url.protocol!=='https:')throw new Error('Pautan bayaran tidak sah.');
      try{sessionStorage.setItem('azdm-pending-order',data.order_id);}catch(_){}
      location.assign(url.href);
    }catch(error){
      message.textContent=error.message;
      if(error.message.includes('Bil terdahulu gagal')||error.message.includes('Bil terdahulu tamat')||error.message.includes('Pesanan sudah berubah')||error.message.includes('Pesanan ini sudah dibayar')){
        requestId='';requestSelection='';try{sessionStorage.removeItem('azdm-checkout-request');}catch(_){}
      }
      if(error.message.includes('sign in'))signIn();calculate();
    }
  });
  async function init(){
    calculate();
    try{
      const data=await call('catalog');available=data.enabled===true;calculate();
      if(!available)message.textContent='Pembelian lesen belum dibuka. Hubungi support untuk bantuan.';
      else if(data.sandbox)message.textContent='Mod ujian pembayaran. Bayaran sebenar belum dibuka.';
      const id=new URLSearchParams(location.search).get('azdm_order');
      if(id){root.scrollIntoView({block:'start'});await checkStatus(id);}
    }catch(error){message.textContent='Pembelian belum tersedia. Hubungi support untuk bantuan.';}
  }
  async function syncAccount(){
    try{await authHeaders();root.querySelector('[data-azdm-signin]').hidden=true;}
    catch{root.querySelector('[data-azdm-signin]').hidden=false;orders.replaceChildren();orders.textContent='Sign in untuk melihat pesanan akaun anda.';if(message.textContent.includes('Email akaun:'))message.textContent='';clearTimeout(pollTimer);}
  }
  window.addEventListener('azobss-auth-changed',syncAccount);
  window.addEventListener('storage',syncAccount);
  setTimeout(syncAccount,1000);
  init();
})();
