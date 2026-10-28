
(function(){
  if(window.__azStaffRoleFirestoreBadgeRenderer)return;
  window.__azStaffRoleFirestoreBadgeRenderer=true;

  const PERMS=[
    ['canManageSoftware','💻','Software'],
    ['canManageCAD','📐','CAD'],
    ['canViewPayments','💳','View Payments'],
    ['canApprovePayment','✅','Approve Payment'],
    ['canEditUsers','👥','Edit Users']
  ];

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function roleLabel(role){
    const r=String(role||'user').toLowerCase();
    if(r==='admin')return 'Administrator';
    if(r==='semiadmin'||r==='semi-admin')return 'Manager';
    if(r==='staff')return 'Staff';
    return 'User';
  }

  function badges(perms){
    perms=perms||{};
    return '<div class="staff-role-badges">'+PERMS.map(([key,icon,label])=>{
      const on=perms[key]===true;
      return `<span class="staff-role-badge ${on?'':'off'}">${icon} ${on?'✅':'❌'} ${label}</span>`;
    }).join('')+'</div>';
  }

  function card(username,x){
    const perms=x.permissions||{};
    return `<div class="staff-role-card" data-staff-username="${esc(username)}">
      <div class="staff-role-name">👤 ${esc(username)}</div>
      <div class="staff-role-meta">Role: <b>${esc(roleLabel(x.role))}</b></div>
      ${badges(perms)}
      <div class="staff-role-actions">
        <button class="staff-role-edit" data-staff-edit="${esc(username)}">Edit</button>
        <button class="staff-role-reset" data-staff-reset="${esc(username)}">Reset</button>
      </div>
    </div>`;
  }

  function getUsernameFromDoc(doc){
    const x=doc.data ? doc.data() : doc;
    return x.usernameKey||x.username||x.id||x.name||doc.id||'unknown';
  }

  async function renderFromFirestore(){
    if(typeof db==='undefined'||typeof collection==='undefined'||typeof getDocs==='undefined')return false;
    const box=document.querySelector('#staffRoleList,#latestStaffUsers,#staffUsersList,#staffRolesList') || findStaffBox();
    if(!box)return false;
    try{
      const snap=await getDocs(collection(db,'users'));
      const rows=[];
      snap.forEach(d=>{
        const x=d.data()||{};
        const role=String(x.role||'').toLowerCase();
        if(role==='admin'||role==='semiadmin'||role==='staff'||x.permissions){
          rows.push(card(getUsernameFromDoc({id:d.id,data:()=>x}),x));
        }
      });
      box.classList.add('staff-role-list');
      box.innerHTML=rows.join('')||'<div class="staff-role-card">No staff users.</div>';
      if(window.azAdminApplyPager) window.azAdminApplyPager(box,{key:'staffRolesList',pageSize:8,label:'staff users',reset:true});
      return true;
    }catch(e){
      console.warn('staff role badge firestore render failed',e);
      return false;
    }
  }

  function findStaffBox(){
    const headings=[...document.querySelectorAll('h1,h2,h3')].find(h=>/Latest Staff Users|Staff Users|Staff Roles/i.test(h.textContent||''));
    if(!headings)return null;
    let p=headings.parentElement;
    for(let i=0;i<4&&p;i++,p=p.parentElement){
      const candidates=[...p.querySelectorAll('div')].filter(d=>d!==p && /Role:|Permissions:|canManage/i.test(d.textContent||''));
      if(candidates.length)return candidates[0].parentElement||candidates[0];
    }
    return null;
  }

  function fillForm(username){
    const card=document.querySelector(`[data-staff-username="${CSS.escape(username)}"]`);
    const input=document.querySelector('input[placeholder*="Username"],#staffRoleUsername,#roleUsername');
    if(input)input.value=username;
    const roleText=card?.querySelector('.staff-role-meta')?.textContent||'';
    const roleSelect=document.querySelector('select#staffRoleSelect,select#roleSelect,select');
    if(roleSelect){
      const role=(roleText.toLowerCase().includes('manager')||roleText.toLowerCase().includes('semi'))?'semiAdmin':roleText.toLowerCase().includes('staff')?'staff':'user';
      roleSelect.value=role;
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }

  async function resetRole(username){
    if(!confirm('Reset role '+username+' kepada user biasa?'))return;
    if(typeof db==='undefined'||typeof doc==='undefined'||typeof updateDoc==='undefined')return alert('Firestore belum ready.');
    await updateDoc(doc(db,'users',username),{role:'user',permissions:{}});
    await renderFromFirestore();
  }

  document.addEventListener('click',e=>{
    const edit=e.target.closest('[data-staff-edit]');
    if(edit)fillForm(edit.getAttribute('data-staff-edit'));
    const reset=e.target.closest('[data-staff-reset]');
    if(reset)resetRole(reset.getAttribute('data-staff-reset'));
  });

  function removeJsonFallback(){
    document.querySelectorAll('.staff-role-card pre, .staff-role-card code').forEach(el=>el.remove());
    document.querySelectorAll('.staff-role-card').forEach(el=>{
      el.innerHTML=el.innerHTML.replace(/\{[\s\S]*?\}/g,'');
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{renderFromFirestore().then(ok=>{if(!ok)removeJsonFallback();});},900);});
  if(document.readyState!=='loading')setTimeout(()=>{renderFromFirestore().then(ok=>{if(!ok)removeJsonFallback();});},900);
})();
