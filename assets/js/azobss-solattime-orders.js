(function(){
 'use strict';
 const base='https://azobss-backend.onrender.com/api/solattime/';
 const admin=document.getElementById('solattimePurchaseAdmin');
 let epoch=0,loaded=false,busy=false,cursor='',next=null,history=[],orders=[],detailId='',poll=null,pollCount=0;
 let accountUid='',authSettled=false;
 const $=s=>admin?.querySelector(s),money=v=>'RM'+(Number(v||0)/100).toFixed(2);
 const states={pending:'Menunggu bayaran',paid:'Bayaran diterima',complete:'Serial siap',issued:'Serial siap · e-mel belum selesai',review:'Perlu semakan',prepared:'Sedang diproses',awaiting_payment:'Menunggu bayaran',accepted:'Diterima penyedia e-mel',queued:'Dalam giliran'};
 const label=v=>states[v]||String(v||'—');
 function el(tag,text,cls){const value=document.createElement(tag);if(text!==undefined)value.textContent=String(text);if(cls)value.className=cls;return value;}
 function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
 async function buyerAuth(generation){
  const deadline=Date.now()+12000;
  status.textContent='Sedang mengesahkan sesi akaun anda…';
  while(generation===epoch&&Date.now()<deadline){
   let headers={};
   if(typeof window.azobssWaitForFirebaseAuthToken==='function'){
    const token=await window.azobssWaitForFirebaseAuthToken(false,Math.max(1000,deadline-Date.now()));
    if(token)headers={Authorization:'Bearer '+token};
    else if(generation===epoch)throw Error('Sila log masuk untuk melihat lesen SolatTime anda.');
   }else if(typeof window.azobssGetFirebaseAuthHeaders==='function'){
    headers=await window.azobssGetFirebaseAuthHeaders(false)||{};
   }
   if(generation!==epoch)throw Error('Sesi telah berubah.');
   if(headers.Authorization){accountUid=window.azobssGetCurrentFirebaseUid?.()||accountUid;return headers;}
   if(authSettled)throw Error('Sila log masuk untuk melihat lesen SolatTime anda.');
   await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(generation!==epoch)throw Error('Sesi telah berubah.');
  throw Error('Sesi akaun belum dapat disahkan. Tekan Cuba semula atau log masuk semula.');
 }
 async function api(path,body){
  const generation=epoch;let result;
  if(admin){if(typeof window.azAdminFetchJson!=='function')throw Error('Sesi admin belum tersedia. Cuba semula.');result=await window.azAdminFetchJson(base+'admin/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{}),cache:'no-store',signal:AbortSignal.timeout(60000)});}
  else{const auth=await buyerAuth(generation);if(generation!==epoch)throw Error('Sesi telah berubah.');status.textContent='Sedang memuatkan lesen SolatTime…';const query=new URLSearchParams(body||{});const r=await fetch(base+path+'?'+query,{headers:auth,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(60000)});result=await r.json();if(!r.ok)throw Error(result.error||'Permintaan belum berjaya.');}
  if(generation!==epoch)throw Error('Sesi telah berubah.');if(result.ok===false)throw Error(result.error||'Permintaan belum berjaya.');return result;
 }
 const dialog=el('dialog',undefined,'solat-commerce-dialog');dialog.setAttribute('aria-label',admin?'Butiran pesanan SolatTime':'Lesen SolatTime saya');
 const top=el('div',undefined,'solat-commerce-heading'),heading=el('h2',admin?'Butiran pesanan SolatTime':'Lesen SolatTime saya'),close=button('Tutup',()=>dialog.close());top.append(heading,close);
 const status=el('p','', 'solat-commerce-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const content=el('div'),nav=el('div',undefined,'solat-commerce-actions');dialog.append(top,status,nav,content);document.body.append(dialog);
 function stopPoll(){if(poll)clearTimeout(poll);poll=null;}
 function clear(){epoch++;stopPoll();loaded=false;busy=false;cursor='';next=null;history=[];orders=[];detailId='';accountUid='';content.replaceChildren();status.textContent='';nav.replaceChildren();if(dialog.open)dialog.close();if(admin){$('[data-solat-orders-rows]').replaceChildren();$('[data-solat-orders-status]').textContent='Muat semula selepas log masuk.';$('[data-solat-orders-search]').value='';}}
 window.addEventListener('azobss-auth-changed',clear);window.addEventListener('pagehide',clear);
 window.addEventListener('azobss:auth-state-ready',event=>{
  authSettled=true;if(admin)return;
  const uid=String(event.detail?.uid||'');
  if(accountUid&&accountUid!==uid){clear();return;}
  if(uid)accountUid=uid;
  if(event.detail?.loggedIn&&dialog.open&&!busy&&!loaded)openOrders();
 });
 dialog.addEventListener('close',()=>{epoch++;busy=false;stopPoll();content.replaceChildren();nav.replaceChildren();status.textContent='';detailId='';});
 async function guarded(fn){if(busy)return false;const generation=epoch;busy=true;try{await fn();return true;}catch(e){if(generation===epoch){if(admin)$('[data-solat-orders-status]').textContent=e.message;status.textContent=e.message;}return false;}finally{if(generation===epoch){busy=false;if(admin)pages();}}}
 function openOrders(){if(busy)return;pollCount=0;if(!dialog.open)dialog.showModal();nav.replaceChildren(button('Cuba semula',()=>openOrders()));guarded(()=>load(''));}
 function pages(){if(!admin)return;$('[data-solat-orders-previous]').disabled=busy||!history.length;$('[data-solat-orders-next]').disabled=busy||next===null;}
 function renderAdmin(){
  const target=$('[data-solat-orders-rows]'),term=$('[data-solat-orders-search]').value.trim().toLowerCase();target.replaceChildren();
  let items=orders.filter(o=>[o.customer,o.email,o.phone,o.account_uid,o.order_id,o.payment_reference,o.license_id,o.invoice_no,o.receipt_no].some(x=>String(x||'').toLowerCase().includes(term)));
  const sort=$('[data-solat-orders-sort]')?.value||'newest';items.sort((a,b)=>sort==='name'?String(a.customer||'').localeCompare(String(b.customer||''),'ms'):sort==='amount'?Number(b.amount_cents)-Number(a.amount_cents):sort==='oldest'?(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0):(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
  for(const order of items){
   const row=el('tr'),person=el('td'),proof=el('td'),delivery=el('td'),actions=el('td');
   person.append(el('strong',order.customer),el('small',order.email),el('small',order.phone));
   proof.append(el('strong',order.order_id),el('small',(order.quantity||1)+' lesen · '+[order.invoice_no,order.receipt_no].filter(Boolean).join(' · ')),el('small',order.payment_method+' · '+(order.payment_reference||'—')));
   delivery.append(el('span',label(order.fulfillment_state)),el('small',label(order.email_status)),el('small',order.license_id));
   actions.append(button('Butiran',()=>guarded(()=>showOrder(order.order_id))));
   if(order.status==='paid')actions.append(button('Hantar semula e-mel',()=>{confirmRetry(order);}));
   row.append(person,proof,el('td',money(order.amount_cents)),el('td',label(order.status)),delivery,actions);target.append(row);
  }
  if(!target.children.length){const row=el('tr'),cell=el('td',term?'Tiada pesanan sepadan pada halaman ini.':'Belum ada pesanan SolatTime.');cell.colSpan=6;row.append(cell);target.append(row);}pages();
 }
 async function load(target=''){
  const value=await api('orders',{cursor:target});orders=value.orders||[];cursor=target;next=value.next_cursor;loaded=true;
  if(admin){renderAdmin();$('[data-solat-orders-status]').textContent=orders.length+' pesanan pada halaman ini.';window.dispatchEvent(new CustomEvent('azobss:solattime-orders-loaded',{detail:{orders,next}}));}
  else{content.replaceChildren();status.textContent=orders.length?'Pilih pesanan untuk melihat serial anda.':'Belum ada pembelian SolatTime dalam akaun ini.';nav.replaceChildren(button('Muat semula',()=>guarded(()=>load(cursor))),button('← Sebelumnya',()=>guarded(async()=>{if(!history.length)return;await load(history.pop());})),button('Seterusnya →',()=>guarded(async()=>{if(next===null)return;const old=cursor;await load(next);history.push(old);})));nav.children[1].disabled=!history.length;nav.children[2].disabled=next===null;for(const order of orders){const card=el('article',undefined,'solat-commerce-order');card.append(el('h3','AZOBSS SolatTime · '+money(order.amount_cents)),el('p',order.order_id),el('p',label(order.status)+' · '+label(order.fulfillment_state)),button('Lihat lesen',()=>guarded(()=>showOrder(order.order_id))));content.append(card);}}
 }
 async function showOrder(id){
  stopPoll();const generation=epoch;const value=await api('order',{order_id:id}),order=value.order;detailId=id;if(!dialog.open)dialog.showModal();content.replaceChildren();status.textContent=label(order.fulfillment_state)+' · '+label(order.email_status);
  nav.replaceChildren(button('Muat semula status',()=>guarded(()=>showOrder(id))));if(!admin)nav.append(button('Semua pesanan saya',()=>guarded(()=>load(''))));
  const summary=el('dl');for(const [name,text] of [['Pesanan',order.order_id],['Pelanggan',order.customer],['E-mel',order.email],['Jumlah',money(order.amount_cents)],['Bayaran',label(order.status)],['Kaedah',order.payment_method],['Invois',order.invoice_no],['Resit',order.receipt_no],['ID lesen',order.license_id],...(admin?[['UID akaun',order.account_uid],['Rujukan transaksi',order.payment_reference],['Bayaran disahkan',order.payment_verified_at],['E-mel dihantar',order.email_sent_at]]:[])]){summary.append(el('dt',name),el('dd',text||'—'));}content.append(summary);
  const serials=order.serials?.length?order.serials:order.serial?[{serial:order.serial,license_id:order.license_id}]:[];
  if(serials.length)content.append(el('p',serials.length+' lesen kekal · Setiap serial untuk 1 PC.'));
  for(const [index,item] of serials.entries()){const title=el('label',serials.length>1?'Serial SolatTime · PC '+(index+1):'Serial SolatTime'),input=el('input');input.value=item.serial;input.readOnly=true;input.autocomplete='off';input.spellcheck=false;title.append(input);content.append(title,el('small',item.license_id||''),button(serials.length>1?'Salin serial PC '+(index+1):'Salin serial',async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='Serial disalin.';}catch{input.focus();input.select();status.textContent='Tekan Ctrl+C untuk menyalin serial.';}}));}
  if(order.status==='paid'&&value.download_url){const link=el('a','Muat turun SolatTime');link.href=value.download_url;link.rel='noopener noreferrer';content.append(link);}
  if(!admin&&order.fulfillment_state!=='complete'&&pollCount<12&&generation===epoch){poll=setTimeout(()=>{if(dialog.open&&detailId===id){pollCount++;guarded(()=>showOrder(id));}},4000);}
 }
 function confirmRetry(order){
  content.replaceChildren(el('p','Hantar semula serial pesanan '+order.order_id+' ke '+order.email+'? Serial yang sama akan digunakan.'));
  nav.replaceChildren(button('Hantar semula',()=>guarded(async()=>{await api('retry-email',{order_id:order.order_id});status.textContent='E-mel diterima penyedia penghantaran.';await load(cursor);dialog.close();})),button('Batal',()=>dialog.close()));status.textContent='';dialog.showModal();
 }
 if(admin){
  window.azSolatTimeAdminOrdersLoad=()=>loaded?Promise.resolve(true):guarded(()=>load(''));
  window.azSolatTimeAdminOrdersRefresh=()=>guarded(()=>load(cursor));
  window.azSolatTimeAdminShowOrder=id=>guarded(()=>showOrder(id));
  $('[data-solat-orders-refresh]').addEventListener('click',()=>guarded(()=>load(cursor)));
  $('[data-solat-orders-search]').addEventListener('input',renderAdmin);
  $('[data-solat-orders-sort]')?.addEventListener('change',()=>{renderAdmin();window.dispatchEvent(new CustomEvent('azobss:solattime-orders-loaded',{detail:{orders,next}}));});
  $('[data-solat-orders-next]').addEventListener('click',()=>guarded(async()=>{if(next===null)return;const old=cursor;await load(next);history.push(old);}));
  $('[data-solat-orders-previous]').addEventListener('click',()=>guarded(async()=>{if(!history.length)return;const previous=history[history.length-1];await load(previous);history.pop();}));
  const panel=document.getElementById('solattimeAdminPanel');new MutationObserver(()=>{if(!panel.hidden&&!loaded)guarded(()=>load(''));}).observe(panel,{attributes:true,attributeFilter:['hidden']});pages();
 }else{
  window.azobssOpenSolatTimeOrders=openOrders;
  if(new URLSearchParams(location.search).has('solattime_orders'))openOrders();
  window.addEventListener('azobss-payment-confirmed',event=>{const id=event.detail?.orderId;if(!id)return;pollCount=0;guarded(async()=>{try{await showOrder(id);}catch(e){/* Other products keep their existing success dialog. */}});});
 }
})();
