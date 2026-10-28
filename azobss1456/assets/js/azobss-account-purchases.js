(function(){
 'use strict';
 if(window.azobssAccountPurchasesOpen)return;
 let dialog,content,status,epoch=0,controller=null,accountUid='';
 const states={paid:'Bayaran diterima',pending:'Menunggu bayaran',creating:'Sedang menyediakan pembayaran',creation_failed:'Pembayaran belum berjaya',accepted:'E-mel serial diterima penyedia',queued:'E-mel serial dalam giliran',sending:'E-mel serial sedang dihantar',review:'Penghantaran e-mel perlu semakan'};
 function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;}
 function button(text,fn,cls){const node=el('button',text,cls);node.type='button';node.addEventListener('click',fn);return node;}
 function reset(){epoch++;controller?.abort();controller=null;accountUid='';content?.replaceChildren();if(status)status.textContent='';}
 function close(){if(dialog?.open)dialog.close();else reset();}
 function ensure(){
  if(dialog)return;
  const css=el('link');css.rel='stylesheet';css.href='/assets/css/azobss-account-purchases.css?v=1402';document.head.append(css);
  dialog=el('dialog',undefined,'az-account-purchases');dialog.setAttribute('aria-label','Lesen & Pembelian Saya');
  const heading=el('div',undefined,'az-account-purchases-heading');heading.append(el('h2','Lesen & Pembelian Saya'),button('Tutup',close));
  status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');content=el('div');dialog.append(heading,status,content);document.body.append(dialog);
  dialog.addEventListener('close',reset);
 }
 function openSolatTime(){
  close();
  if(typeof window.azobssOpenSolatTimeOrders==='function')window.azobssOpenSolatTimeOrders();
  else window.location.assign('/Software-Tools/?solattime_orders=1');
 }
 function home(){
  reset();status.textContent='Pilih software atau buka rekod pembelian anda.';
  const choices=el('div',undefined,'az-account-purchases-choices');
  for(const [name,note,action] of [
   ['Liyabudun','Serial, status pembelian dan installer.',openSolatTime],
   ['AZDM','Pesanan lesen dan status penghantaran e-mel serial.',loadAzdm],
   ['Pembelian lain','Rekod pembelian, resit dan muat turun.',()=>{close();window.azobssOpenMyPurchases?.();}]
  ]){const card=button('',action);card.append(el('strong',name),el('span',note));choices.append(card);}
  content.replaceChildren(choices);
 }
 async function loadAzdm(){
  reset();const generation=epoch;controller=new AbortController();const signal=controller.signal;
  status.textContent='Sedang mengesahkan sesi akaun anda…';
  const actions=el('div',undefined,'az-account-purchases-actions'),rows=el('div');actions.append(button('← Kembali',home),button('Muat semula',loadAzdm));content.append(el('h3','Pesanan lesen AZDM'),actions,rows);
  try{
   const token=typeof window.azobssWaitForFirebaseAuthToken==='function'?await window.azobssWaitForFirebaseAuthToken(false,10000):'';
   const headers=token?{Authorization:'Bearer '+token}:await window.azobssGetFirebaseAuthHeaders?.(false)||{};
   if(generation!==epoch)return;
   if(!headers.Authorization)throw Error('Sila log masuk untuk melihat pesanan AZDM anda.');
   accountUid=window.azobssGetCurrentFirebaseUid?.()||'';status.textContent='Sedang memuatkan pesanan AZDM…';
   const response=await fetch('https://azobss-backend.onrender.com/api/azdm/orders',{headers,cache:'no-store',credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
   const data=await response.json();if(generation!==epoch)return;
   if(!response.ok||data.ok===false)throw Error(data.error||'Pesanan belum dapat dimuatkan. Cuba semula.');
   const orders=Array.isArray(data.orders)?data.orders:[];
   status.textContent=orders.length?'Serial AZDM dihantar melalui e-mel pembelian.':'Belum ada pesanan AZDM dalam akaun ini.';
   for(const order of orders){
    const card=el('article',undefined,'az-account-purchases-order');card.append(el('h4',order.product_name||'AZOBSS Download Manager'),el('p',String(order.quantity||1)+' PC · RM'+(Number(order.amount_cents||0)/100).toFixed(2)),el('p',states[order.status]||'Status belum tersedia'),el('small',order.order_id||''));
    if(order.email_status)card.append(el('p',states[order.email_status]||'Semak e-mel pembelian anda.'));rows.append(card);
   }
  }catch(error){if(generation===epoch)status.textContent=error.name==='AbortError'?'Permintaan terhenti. Tekan Muat semula.':error.message;}
 }
 window.addEventListener('azobss-auth-changed',()=>{close();reset();});
 window.addEventListener('pagehide',()=>{close();reset();});
 window.addEventListener('azobss:auth-state-ready',event=>{if(accountUid&&accountUid!==String(event.detail?.uid||'')){close();reset();}});
 window.azobssAccountPurchasesOpen=function(){ensure();if(!dialog.open)dialog.showModal();home();};
})();
