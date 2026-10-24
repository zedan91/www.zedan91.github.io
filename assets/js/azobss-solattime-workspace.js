(function(){
 'use strict';
 const orderMatches=(order,term)=>[order.customer,order.email,order.phone,order.account_uid,order.order_id,order.payment_reference,order.license_id,order.invoice_no,order.receipt_no].some(value=>String(value||'').toLowerCase().includes(term));
 function auditEvents(order,license){
  const events=[{label:'Pesanan dibuat',time:order.created_at,detail:order.order_id,state:'done'}];
  events.push(order.status==='paid'?{label:'Bayaran disahkan',time:order.payment_verified_at||order.paid_at,detail:String(order.payment_method||'').toUpperCase(),state:'done'}:{label:order.status==='pending'?'Menunggu pengesahan bayaran':'Status bayaran',time:'',detail:order.status,state:'pending'});
  if(['issued','complete'].includes(order.fulfillment_state))events.push({label:'Serial siap',time:'',detail:order.license_id,state:'done'});
  if(order.email_status==='accepted')events.push({label:'E-mel diterima penyedia',time:order.email_sent_at,detail:order.email,state:'done'});
  else if(order.status==='paid')events.push({label:'Status e-mel',time:'',detail:order.email_status==='review'?'Perlu semakan':'Dalam proses penghantaran',state:order.email_status==='review'?'warning':'pending'});
  if(license){if(Number(license.device_count)>0)events.push({label:'PC didaftarkan',time:'',detail:'1 / 1 PC · '+license.id,state:'done'});if(license.status==='blocked')events.push({label:'Status semasa: lesen disekat',time:'',detail:license.customer,state:'warning'});}
  return events;
 }
 window.azSolatTimeWorkspaceModel={orderMatches,auditEvents};
 const root=document.getElementById('solattimeAdminPanel');if(!root)return;
 const $=name=>root.querySelector('#solat-'+name),tabs=Array.from(root.querySelectorAll('[data-solat-workspace]'));
 let licenses=[],orders=[],active='licenses',refreshing=false,epoch=0;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;};
 const term=()=>$('workspace-search').value.trim().toLowerCase();
 const date=value=>{const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toLocaleString('ms-MY',{timeZone:'Asia/Kuala_Lumpur'}):'';};
 window.azSolatTimeWorkspaceLicenseMatches=(license,q)=>[license.customer,license.id].some(value=>String(value||'').toLowerCase().includes(q))||orders.some(order=>order.license_id===license.id&&orderMatches(order,q));
 function search(){
  const query=$('workspace-search').value;
  $('search').value=query;$('search').dispatchEvent(new Event('input'));
  const field=root.querySelector('[data-solat-orders-search]');field.value=query;field.dispatchEvent(new Event('input'));renderAudit();
 }
 function renderAudit(){
  const host=$('audit-rows');host.replaceChildren();
  const query=term(),items=orders.filter(order=>orderMatches(order,query));
  const sort=root.querySelector('[data-solat-orders-sort]')?.value||'newest';items.sort((a,b)=>sort==='name'?String(a.customer||'').localeCompare(String(b.customer||''),'ms'):sort==='amount'?Number(b.amount_cents)-Number(a.amount_cents):sort==='oldest'?(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0):(Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0));
  for(const order of items){
   const card=el('article',undefined,'solat-audit-card'),head=el('div',undefined,'solat-audit-head'),person=el('div'),view=el('button','Butiran');view.type='button';view.addEventListener('click',()=>window.azSolatTimeAdminShowOrder?.(order.order_id));
   person.append(el('strong',order.customer||order.email||'Pelanggan SolatTime'),el('small',[order.email,order.order_id].filter(Boolean).join(' · ')));head.append(person,view);card.append(head);
   const timeline=el('ol',undefined,'solat-audit-timeline');
   for(const event of auditEvents(order,licenses.find(license=>license.id===order.license_id))){const row=el('li',undefined,'solat-audit-event '+event.state);row.append(el('strong',event.label),el('small',[event.detail,date(event.time)].filter(Boolean).join(' · ')));timeline.append(row);}
   card.append(timeline);host.append(card);
  }
  if(!items.length)host.append(el('p',query?'Tiada audit sepadan pada halaman ini.':'Belum ada audit pembelian pada halaman ini.','solat-empty'));
 }
 function select(name,focus=false){
  active=['licenses','orders','audit'].includes(name)?name:'licenses';
  tabs.forEach(tab=>{const selected=tab.dataset.solatWorkspace===active;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();});
  for(const name of ['licenses','orders','audit'])$('workspace-panel-'+name).hidden=name!==active;
  if(active!=='licenses')window.azSolatTimeAdminOrdersLoad?.();
 }
 tabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>select(tab.dataset.solatWorkspace));
  tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=(index+1)%tabs.length;if(event.key==='ArrowLeft')target=(index-1+tabs.length)%tabs.length;if(event.key==='Home')target=0;if(event.key==='End')target=tabs.length-1;if(target!==undefined){event.preventDefault();select(tabs[target].dataset.solatWorkspace,true);}});
 });
 $('workspace-controls').addEventListener('submit',event=>{event.preventDefault();search();});
 $('workspace-search').addEventListener('input',search);
 $('workspace-clear').addEventListener('click',()=>{$('workspace-search').value='';search();});
 $('workspace-refresh').addEventListener('click',async()=>{
  if(refreshing)return;const generation=epoch;refreshing=true;$('workspace-refresh').disabled=true;
  const results=await Promise.allSettled([window.azSolatTimeAdminRefresh?.(),window.azSolatTimeAdminOrdersRefresh?.()]);
  if(generation!==epoch)return;refreshing=false;$('workspace-refresh').disabled=false;
  if(results.some(result=>result.status==='rejected'||result.value===false)){$('notice').textContent='Sebahagian rekod belum dapat dimuat semula. Cuba Refresh sekali lagi.';$('notice').hidden=false;}
 });
 window.addEventListener('azobss:solattime-licenses-loaded',event=>{licenses=event.detail.licenses||[];$('license-count').textContent=String(licenses.length)+(event.detail.next!==null?'+':'');search();});
 window.addEventListener('azobss:solattime-orders-loaded',event=>{orders=event.detail.orders||[];$('order-count').textContent=String(orders.length)+(event.detail.next!==null?'+':'');search();});
 function clear(){epoch++;refreshing=false;licenses=[];orders=[];$('workspace-search').value='';$('license-count').textContent='—';$('order-count').textContent='—';$('workspace-refresh').disabled=false;$('audit-rows').replaceChildren();select('licenses');}
 window.addEventListener('azobss-auth-changed',clear);window.addEventListener('pagehide',clear);
 select('licenses');renderAudit();
})();
