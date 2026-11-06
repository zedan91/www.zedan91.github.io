(function(){
 'use strict';
 const base='https://azobss-backend.onrender.com',paused=new Set();let ready=false,failed=false,sequence=0,revision=-1,flight=null,mode='all',saving=false;
 const key=v=>String(v||'').trim().toLowerCase(),fullAdmin=()=>document.body?.classList.contains('az-software-full-admin');
 const ids=v=>typeof v==='string'?[key(v)]:[v?.productId,v?.id,v?.sku].map(key).filter(Boolean);
 const isPaused=v=>ids(v).some(id=>paused.has(id));
 function visible(item,admin=false){if(admin)return mode==='all'||(mode==='paused'?isPaused(item):!isPaused(item));return ready&&!isPaused(item);}
 function changed(){document.documentElement.classList.toggle('az-sw-pending1534',!ready);document.dispatchEvent(new CustomEvent('az-software-availability-change'));decorate();}
 async function refresh(force=false){
  if(flight&&!force)return flight;const generation=++sequence;
  flight=(async()=>{try{const r=await fetch(base+'/api/software-availability',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)}),d=await r.json();if(!r.ok||!d.ok||!Array.isArray(d.pausedIds)||!Number.isFinite(d.revision))throw Error('Availability check failed.');if(generation!==sequence||d.revision<revision)return;paused.clear();d.pausedIds.forEach(id=>paused.add(key(id)));revision=d.revision;ready=true;failed=false;changed();}catch(e){if(generation!==sequence)return;ready=false;failed=true;changed();}finally{if(generation===sequence)flight=null;}})();return flight;
 }
 function decorate(){
  const admin=fullAdmin();
  const grid=document.getElementById('softwareDownloadsGrid')||document.getElementById('softwareGrid');if(grid){let status=document.getElementById('azSwAvailabilityStatus1534');if(!status){status=document.createElement('p');status.id='azSwAvailabilityStatus1534';status.setAttribute('role','status');grid.before(status);}status.hidden=ready;const text=failed?'Software availability could not be checked. Refresh this page to try again.':'Checking software availability…';if(status.textContent!==text)status.textContent=text;}
  for(const card of document.querySelectorAll('#softwareDownloadsGrid .download-card,#softwareGrid .download-card')){
   const id=card.dataset.productId;if(!id)continue;const blocked=isPaused(id);
   card.classList.toggle('az-sw-paused1534',blocked);card.dataset.softwarePaused=blocked?'1':'0';
   if(!admin){card.querySelectorAll('[data-sw-pause1534],.az-sw-pause-label1534').forEach(e=>e.remove());continue;}
   let label=card.querySelector('.az-sw-pause-label1534');if(blocked&&!label){label=document.createElement('p');label.className='az-sw-pause-label1534';label.textContent='Paused · Hidden from customers · Downloads blocked';card.append(label);}if(!blocked)label?.remove();
   let button=card.querySelector('[data-sw-pause1534]');if(!button){button=document.createElement('button');button.type='button';button.className='az-sw-pause-button1534';button.dataset.swPause1534=id;(card.querySelector('.software-card-admin-actions')||card).append(button);}const text=blocked?'▶':'⏸',title=blocked?'Resume software':'Pause / Hide software';if(button.textContent!==text)button.textContent=text;button.title=title;button.setAttribute('aria-label',title);
  }
  const toolbar=document.querySelector('.software-admin-toolbar');
  if(admin&&toolbar&&!document.getElementById('azSwPauseFilter1534')){const label=document.createElement('label');label.className='az-sw-filter1534';label.textContent='Availability ';const select=document.createElement('select');select.id='azSwPauseFilter1534';select.setAttribute('aria-label','Software availability');for(const [value,text] of [['all','All software'],['active','Available'],['paused','Paused / Hidden']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o);}select.value=mode;select.onchange=()=>{mode=select.value;document.dispatchEvent(new CustomEvent('az-software-availability-change'));};label.append(select);toolbar.append(label);}
  document.querySelector('.az-sw-filter1534')?.toggleAttribute('hidden',!admin);
 }
 async function auth(){const h=await window.azobssGetFirebaseAuthHeaders?.(true);if(!h?.Authorization)throw Error('Sign in as administrator first.');return {...h,'Content-Type':'application/json'};}
 function dialog(){let d=document.getElementById('azSwPauseDialog1534');if(d)return d;d=document.createElement('dialog');d.id='azSwPauseDialog1534';d.innerHTML='<form><h2 id="azSwPauseTitle1534">Pause software</h2><p data-sw-name></p><p data-sw-help></p><label>Internal reason (optional)<textarea name="reason" maxlength="240" rows="3" placeholder="Maintenance, broken installer, licensing update, or another reason"></textarea></label><p data-sw-message role="status"></p><div><button type="button" data-sw-close>Cancel</button><button type="submit" data-sw-save>Pause / Hide</button></div></form>';d.setAttribute('aria-labelledby','azSwPauseTitle1534');d.querySelector('[data-sw-close]').onclick=()=>{if(!saving)d.close();};d.addEventListener('cancel',e=>{if(saving)e.preventDefault();});d.querySelector('form').onsubmit=save;document.body.append(d);return d;}
 async function open(id,card){
  if(!fullAdmin())return;const d=dialog();d.dataset.productId=id;d.dataset.paused=isPaused(id)?'0':'1';const pause=d.dataset.paused==='1';d.querySelector('h2').textContent=pause?'Pause software':'Resume software';d.querySelector('[data-sw-name]').textContent=card.querySelector('h3')?.textContent||id;d.querySelector('[data-sw-help]').textContent=pause?'Hide this card from customers and stop new purchases and website downloads until you resume it. Product details and purchase history are kept.':'Make this card available again. Existing Draft / Hidden publishing status still applies.';d.querySelector('[data-sw-save]').textContent=pause?'Pause / Hide':'Resume software';d.querySelector('[name="reason"]').value='';d.querySelector('[data-sw-message]').textContent='';d.showModal();
  try{const r=await fetch(base+'/api/admin/software-availability',{headers:await auth(),cache:'no-store',signal:AbortSignal.timeout(15000)}),data=await r.json();if(r.ok&&data.ok&&d.open&&d.dataset.productId===id){const row=data.items.find(x=>key(x.productId)===key(id));d.querySelector('[name="reason"]').value=row?.reason||'';}}catch(e){}
 }
 async function save(e){
  e.preventDefault();if(saving)return;const d=e.currentTarget.closest('dialog'),message=d.querySelector('[data-sw-message]');saving=true;d.querySelectorAll('button').forEach(x=>x.disabled=true);message.textContent='Saving…';
  try{const r=await fetch(base+'/api/admin/software-availability',{method:'POST',headers:await auth(),body:JSON.stringify({productId:d.dataset.productId,paused:d.dataset.paused==='1',reason:d.querySelector('[name="reason"]').value.trim()}),signal:AbortSignal.timeout(20000)}),data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Unable to update software.');await refresh(true);if(!ready)throw Error('Saved, but the updated availability could not be loaded. Refresh this page to verify.');try{localStorage.removeItem('azobss_software_fast_card_html_v1471');localStorage.setItem('azobss-software-availability-update1534',String(Date.now()));}catch(e){}d.close();}catch(e){message.textContent=e.message||'Unable to update software.';}finally{saving=false;d.querySelectorAll('button').forEach(x=>x.disabled=false);}
 }
 window.azSoftwareAvailability={refresh,visible,isPaused,ready:()=>ready};
 document.documentElement.classList.add('az-sw-pending1534');
 document.addEventListener('click',e=>{
  const pause=e.target.closest?.('[data-sw-pause1534]');if(pause){e.preventDefault();e.stopImmediatePropagation();open(pause.dataset.swPause1534,pause.closest('.download-card'));return;}
  const card=e.target.closest?.('.download-card'),button=e.target.closest?.('a,button');if(!card||!button||button.closest('.software-card-admin-actions')||button.matches('[data-software-edit],[data-software-delete]'))return;
  if((!ready||isPaused(card.dataset.productId)||!['','active'].includes(key(card.dataset.status)))&&button.matches('.download-btn,[data-software-package-buy],[data-azobss-premium-buy],[data-azobss-promo-free],.az-card-cart-slot button,.az-card-cart-slot a')){e.preventDefault();e.stopImmediatePropagation();alert(ready?'This software is temporarily unavailable. Please try again later.':'Software availability could not be checked. Please refresh and try again.');}
 },true);
 function start(){decorate();new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});new MutationObserver(decorate).observe(document.body,{attributes:true,attributeFilter:['class']});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('storage',e=>{if(e.key==='azobss-software-availability-update1534')refresh(true);});window.addEventListener('focus',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(()=>{if(!document.hidden)refresh();},30000);refresh();
})();
