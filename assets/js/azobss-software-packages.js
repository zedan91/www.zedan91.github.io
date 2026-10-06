(function(){
 'use strict';
 const model=window.azdmOfferModel,dialog=document.getElementById('softwarePackageDialog'),root=document.getElementById('azdm-license');
 if(!model||!dialog||!root)return;
 const $=s=>root.querySelector(s),plan=$('[name="azdm-plan"]'),quantity=$('[name="azdm-quantity"]'),buy=$('[data-azdm-buy]'),message=$('[data-azdm-message]');
 const base='https://azobss-backend.onrender.com',money=v=>'RM'+(v/100).toFixed(2);
 function cleanRef(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,40);}
 function parse(v){try{return v?JSON.parse(v):null}catch(_e){return null}}
 function staffReferral(productId){
  try{
   const id=String(productId||'').trim();
   const qs=new URLSearchParams(location.search);
   const urlProduct=String(qs.get('p')||qs.get('product')||'').trim();
   const urlRef=cleanRef(qs.get('r')||qs.get('ref')||'');
   if(urlRef&&(!urlProduct||!id||urlProduct===id)) return {username:urlRef,ref:urlRef,productId:id||urlProduct,sourcePage:'Software',openedAt:new Date().toISOString(),source:'package-url-ref'};
   if(id){
    const direct=parse(localStorage.getItem('azobssStaffShareReferral_'+id)||sessionStorage.getItem('azobssStaffShareReferral_'+id)||'');
    const ref=cleanRef(direct?.username||direct?.ref||'');if(ref)return {...direct,username:ref,ref,productId:id,sourcePage:'Software'};
   }
   const catalog=parse(localStorage.getItem('azobssSoftwareCatalogReferral')||'');
   const catalogRef=cleanRef(catalog?.username||catalog?.ref||'');
   const exp=Number(catalog?.expiresAtMs||0)||0;
   if(catalogRef&&(!exp||exp>Date.now()))return {...catalog,username:catalogRef,ref:catalogRef,productId:id||catalog?.productId||'',sourcePage:'Software',source:catalog?.source||'software-catalog-share'};
   const last=parse(localStorage.getItem('azobssLuckyLastProductShareOpen')||'');
   const lastRef=cleanRef(last?.ref||'');
   if(lastRef&&(!id||!last?.productId||String(last.productId)===id)&&last?.noCommission!==true&&last?.shareKind!=='free')return {username:lastRef,ref:lastRef,productId:id||last?.productId||'',sourcePage:last?.sourcePage||'Software',openedAt:last?.at||'',source:'last-product-open'};
  }catch(_e){}
  return null;
 }
 let offer=null,available=false,requestId='',requestSelection='',pollTimer,pollCount=0,generation=0;
 const rows=document.getElementById('softwarePackageRows'),enabled=document.getElementById('softwarePackagesEnabled'),fields=document.getElementById('softwarePackageFields');
 let oldOffer=null;
 function toggleEditorFields(){fields.hidden=!enabled.checked;fields.querySelectorAll('input,select,button').forEach(x=>x.disabled=!enabled.checked);}
 async function headers(wait=false){
  for(let i=0;i<(wait?20:1);i++){
   const h=typeof window.azobssGetFirebaseAuthHeaders==='function'?await window.azobssGetFirebaseAuthHeaders(!!wait):{};
   if(h?.Authorization)return {...h,'Content-Type':'application/json'};
   if(wait)await new Promise(r=>setTimeout(r,200));
  }throw Error('Please sign in to your AZOBSS account first.');
 }
 async function call(path,options={}){
  const r=await fetch(base+path,{...options,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});
  const d=await r.json();if(!r.ok||d.ok===false)throw Error(d.error||'Service is currently unavailable.');return d;
 }
 function signIn(){document.querySelector('#siteSignInButton,#loginButton,#loginBtn,[data-open-login]')?.click();}
 function row(p){
  const block=document.createElement('div');block.className='az-package-plan';block.dataset.planId=p.id;
  for(const [key,title,value,type,min,max] of [['label','Nama pakej',p.label,'text'],['days','Tempoh (hari)',p.days,'number',0,36500],['quantity','Bilangan PC',p.quantity,'number',0,100],['price','Harga (RM)',p.amount_cents/100,'number',0.01,100000]]){
   const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.dataset.packageField=key;input.value=value;input.type=type;
   if(type==='number'){input.min=min;input.max=max;input.step=key==='price'?'0.01':'1';}else input.maxLength=60;
   label.append(input);block.append(label);
  }
  const hint=document.createElement('small');hint.textContent='Tempoh 0 = tiada tamat. PC 0 = customer pilih, harga setiap PC. PC tetap = harga jumlah pakej.';
  const remove=document.createElement('button');remove.type='button';remove.textContent='Buang pakej';remove.addEventListener('click',()=>block.remove());block.append(hint,remove);rows.append(block);
 }
 function loadEditor(item){
  oldOffer=item?.softwarePackages||null;
  const current=oldOffer||{...model.defaults(),enabled:false,product_id:item?.productId||'NEW',name:item?.name||'Software',fulfilment:'download',bulk_minimum:0,bulk_unit_cents:0,plans:[{id:'standard',label:'Standard',days:0,quantity:0,amount_cents:Math.max(100,Math.round(Number(String(item?.price||'10').replace(/[^\d.]/g,''))*100)||1000)}]};
  enabled.checked=current.enabled===true;fields.hidden=!enabled.checked;rows.replaceChildren();current.plans.forEach(row);
  document.getElementById('softwarePackageFulfilment').value=current.fulfilment||'azdm';
  document.getElementById('softwarePackageMax').value=current.max_quantity||100;
  document.getElementById('softwarePackageBulkMin').value=current.bulk_minimum||0;
  document.getElementById('softwarePackageBulkPrice').value=(current.bulk_unit_cents||0)/100;
  document.getElementById('softwareSupportEnabled').checked=item?.supportEnabled!==false;
  toggleEditorFields();
 }
 function readEditor(){
  const name=document.getElementById('softwareAdminName').value.trim(),id=document.getElementById('softwareAdminProductId').value.trim();
  const plans=[...rows.children].map(x=>{const v=k=>x.querySelector('[data-package-field="'+k+'"]').value;return {id:x.dataset.planId,label:v('label'),days:Number(v('days')),quantity:Number(v('quantity')),amount_cents:Math.round(Number(v('price'))*100)};});
  const value={enabled:enabled.checked,product_id:id,name,fulfilment:document.getElementById('softwarePackageFulfilment').value,max_quantity:Number(document.getElementById('softwarePackageMax').value),bulk_minimum:Number(document.getElementById('softwarePackageBulkMin').value),bulk_unit_cents:Math.round(Number(document.getElementById('softwarePackageBulkPrice').value)*100),plans};
  const result=enabled.checked?model.normalize(value):null;
  if(result&&document.getElementById('softwareAdminSubscriptionEnabled')?.checked)throw Error('Choose one sales method: software plans or the existing activation-code system.');
  return {softwarePackages:result,supportEnabled:document.getElementById('softwareSupportEnabled').checked};
 }
 async function saveEditor(item){
  const value=item.softwarePackages;
  if(oldOffer?.fulfilment==='azdm'&&oldOffer.enabled&&(!value||value.fulfilment!=='azdm'||value.product_id!==oldOffer.product_id))
   await call('/api/azdm/offers',{method:'POST',headers:await headers(),body:JSON.stringify({...oldOffer,enabled:false})});
  if(value?.fulfilment==='azdm')await call('/api/azdm/offers',{method:'POST',headers:await headers(),body:JSON.stringify(value)});
 }
 window.azdmSoftwareEditorLoad=loadEditor;window.azdmSoftwareEditorRead=readEditor;window.azdmSoftwareEditorSave=saveEditor;
 enabled.addEventListener('change',()=>{toggleEditorFields();if(enabled.checked){const type=document.getElementById('softwareAdminType');if(type.value!=='premium'){type.value='premium';type.dispatchEvent(new Event('change'));}}});
 document.getElementById('softwarePackageAdd').addEventListener('click',()=>{if(rows.children.length<10)row({id:'pack-'+crypto.randomUUID().slice(0,12),label:'New Plan',days:0,quantity:0,amount_cents:1000});});loadEditor(null);
 function calculate(){
  if(!offer){buy.disabled=true;return;}const p=offer.plans.find(x=>x.id===plan.value);if(!p){buy.disabled=true;return;}
  quantity.min=1;quantity.max=offer.max_quantity;quantity.disabled=p.quantity>0;if(p.quantity)quantity.value=p.quantity;
  try{const q=model.quote(offer,plan.value,Number(quantity.value));
   $('[data-azdm-summary]').textContent=q.fixed?`${q.quantity} PC = ${money(q.total_cents)}`:`${q.quantity} PC × ${money(q.unit_cents)} = ${money(q.total_cents)}`;
   $('[data-azdm-saving]').textContent=q.discount?'Bulk purchase discount applied.':!p.quantity&&p.days===0&&offer.bulk_minimum?`Buy ${offer.bulk_minimum} PCs or more in one purchase: ${money(offer.bulk_unit_cents)} per PC.`:'';buy.disabled=!available;
  }catch(e){$('[data-azdm-summary]').textContent=e.message;buy.disabled=true;}
 }
 function support(name='Software'){
  const d=document.getElementById('softwareSupportDialog');d.querySelector('[data-support-name]').textContent='Support for '+name;
  d.querySelector('[data-support-email]').href='mailto:zedan9107@gmail.com?subject='+encodeURIComponent('Support '+name);
  d.querySelector('[data-support-whatsapp]').href='https://wa.me/601135600723?text='+encodeURIComponent('I need help with '+name+'.');d.showModal();
 }
 async function open(productId,name='',mode='download'){
  const current=++generation;offer=null;available=false;plan.replaceChildren();message.textContent='Loading plan options…';$('[data-azdm-summary]').textContent='';buy.disabled=true;
  document.getElementById('softwarePackageTitle').textContent=name?name+' · Choose Plan':'Choose Plan';if(!dialog.open)dialog.showModal();
  try{const d=await call((mode==='azdm'?'/api/azdm/catalog':'/api/software-packages/catalog')+'?product_id='+encodeURIComponent(productId));if(current!==generation)return;
   offer=model.normalize(d.offer);available=d.enabled===true;
   for(const p of offer.plans){const o=document.createElement('option');o.value=p.id;o.textContent=p.label+(p.quantity?' · '+p.quantity+' PC':'')+' · '+money(p.amount_cents)+(p.quantity?'':' / PC');plan.append(o);}
   document.getElementById('softwarePackageTitle').textContent=offer.name+' · Choose Plan';quantity.value=1;
   $('[data-package-order-box]').hidden=offer.fulfilment!=='azdm';$('[data-azdm-orders]').replaceChildren();
   $('[data-package-activation]').textContent=offer.fulfilment==='azdm'?'After payment is verified, each PC receives one unique serial key via your AZOBSS account email.':'Payment and download use your AZOBSS account. Any account-specific pricing will be verified during checkout.';
   message.textContent=!available?'Purchasing is not available yet. Contact Support for assistance.':d.sandbox?'Payment test mode.':'';calculate();syncAccount();
  }catch(e){if(current===generation)message.textContent=e.message;}
 }
 window.azSoftwarePackagesOpen=open;
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-software-package-buy]');if(b){e.preventDefault();e.stopImmediatePropagation();open(b.dataset.softwarePackageBuy,b.dataset.productName,b.dataset.packageMode);return;}
  const help=e.target.closest('[data-software-support]');if(help){e.preventDefault();e.stopImmediatePropagation();support(help.dataset.productName||'Software');}
 },true);
 root.querySelector('[data-package-close]').addEventListener('click',()=>dialog.close());document.querySelector('[data-support-close]').addEventListener('click',()=>document.getElementById('softwareSupportDialog').close());
 $('[data-package-support]').addEventListener('click',()=>support(offer?.name||'Software'));$('[data-azdm-signin]').addEventListener('click',signIn);plan.addEventListener('change',calculate);quantity.addEventListener('input',calculate);
 const states={paid:'Payment verified.',pending:'Payment not yet verified.',creating:'Payment bill is being prepared.',creation_failed:'Payment bill could not be created.'};
 async function refreshOrders(){try{const d=await call('/api/azdm/orders',{headers:await headers(true)}),out=$('[data-azdm-orders]');out.replaceChildren();for(const r of d.orders){const p=document.createElement('p');p.textContent=r.product_name+' · '+r.quantity+' PC · '+money(r.amount_cents)+' — '+(states[r.status]||r.status);out.append(p);}if(!d.orders.length)out.textContent='No orders yet.';}catch(e){$('[data-azdm-orders]').textContent=e.message;}}
 async function checkStatus(id){clearTimeout(pollTimer);try{const d=await call('/api/azdm/status?azdm_order='+encodeURIComponent(id),{headers:await headers(true)});message.textContent=(states[d.status]||d.status)+' Order ID: '+id;if(d.status==='paid'){requestId='';await refreshOrders();}else if(d.status==='pending'&&pollCount++<12)pollTimer=setTimeout(()=>checkStatus(id),5000);}catch(e){message.textContent=e.message;}}
 $('[data-azdm-refresh]').addEventListener('click',refreshOrders);
 buy.addEventListener('click',async()=>{
  if(!offer||!available)return;buy.disabled=true;
  try{const h=await headers(true),q=model.quote(offer,plan.value,Number(quantity.value));message.textContent='Preparing payment…';let result;
   if(offer.fulfilment==='azdm'){
    const selection=JSON.stringify([offer,plan.value,q.quantity]);if(!requestId||requestSelection!==selection){requestId=crypto.randomUUID();requestSelection=selection;}
    try{const old=JSON.parse(sessionStorage.getItem('azdm-package-request')||'null');if(old?.selection===selection&&Date.now()-old.created<3*86400000)requestId=old.id;sessionStorage.setItem('azdm-package-request',JSON.stringify({id:requestId,selection,created:Date.now()}));}catch{}
    result=await call('/api/azdm/checkout',{method:'POST',headers:h,body:JSON.stringify({software_id:offer.product_id,plan:plan.value,quantity:q.quantity,request_id:requestId,staff_referral:staffReferral(offer.product_id)})});
   }else{const ref=staffReferral(offer.product_id);result=await call('/api/create-payment',{method:'POST',headers:h,body:JSON.stringify({product:{productId:offer.product_id,staffReferral:ref},productId:offer.product_id,softwarePackageId:plan.value,packageQuantity:q.quantity,staffReferral:ref,returnUrl:location.href.split('#')[0]})});}
   const url=new URL(result.payment_url||result.paymentUrl||result.url);if(url.protocol!=='https:'||!['toyyibpay.com','dev.toyyibpay.com'].includes(url.hostname))throw Error('Invalid payment link.');location.assign(url.href);
  }catch(e){message.textContent=e.message;if(/sign in/i.test(e.message))signIn();if(/order has changed|already been paid|previous bill/i.test(e.message)){requestId='';try{sessionStorage.removeItem('azdm-package-request');}catch{}}calculate();}
 });
 async function syncAccount(){try{await headers();$('[data-azdm-signin]').hidden=true;}catch{$('[data-azdm-signin]').hidden=false;$('[data-azdm-orders]').replaceChildren();clearTimeout(pollTimer);requestId='';}}
 window.addEventListener('azobss-auth-changed',()=>{generation++;clearTimeout(pollTimer);$('[data-azdm-orders]').replaceChildren();message.textContent='';requestId='';syncAccount();});dialog.addEventListener('close',()=>{generation++;clearTimeout(pollTimer);});
 const query=new URLSearchParams(location.search);if(query.get('azdm_order'))open(query.get('azdm_software')||'AZDM','AZDM','azdm').then(()=>checkStatus(query.get('azdm_order')));
})();
