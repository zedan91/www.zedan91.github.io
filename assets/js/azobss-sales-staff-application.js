/* AZOBSS v1237 Sales Partner -> Staff application workflow */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

const firebaseConfig={apiKey:'AIzaSyDuf03esBSpddXAOwuP-uOmHVRp54pZyr8',authDomain:'azobss.firebaseapp.com',projectId:'azobss',storageBucket:'azobss.firebasestorage.app',messagingSenderId:'159277716405',appId:'1:159277716405:web:17d8924b6b6380e2b77ffc'};
const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parse(v){try{return v?JSON.parse(v):null}catch(_){return null}}
function savedUser(){try{if(typeof window.getSavedUser==='function'){const u=window.getSavedUser();if(u&&typeof u==='object')return u}}catch(_){}return parse(sessionStorage.getItem('azobssCurrentUser'))||parse(localStorage.getItem('azobssCurrentUser'))||parse(sessionStorage.getItem('azobssUser'))||parse(localStorage.getItem('azobssUser'))||{};}
function roleKey(u){return String(u&&(u.role||u.userRole||u.accountRole||u.staffRole||u.memberRole||u.accessRole)||'user').toLowerCase().replace(/[\s_-]+/g,'')}
function usernameOf(u,firebaseUser){return String((u&&(u.usernameKey||u.username||u.name||u.displayName||u.profileDocId))||window.azobssCurrentUsername||(firebaseUser&&firebaseUser.displayName)||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,40)}
function isStaffLike(u){const r=roleKey(u);return ['staff','manager','semiadmin','semistaff','seller','editor','admin','administrator','owner','superadmin'].includes(r)||r.includes('staff')}
function domSaysStaff(){const b=document.body;if(!b)return false;return b.classList.contains('az-role-is-staff')||b.classList.contains('az-role-is-admin')||b.classList.contains('az-role-is-stafflike')||b.classList.contains('az-software-staff-role-ok')||b.classList.contains('az-software-full-admin')||b.classList.contains('is-admin')}
function toast(msg,ok=true){let el=$('#azSalesPartnerToast1228');if(!el){el=document.createElement('div');el.id='azSalesPartnerToast1228';el.style.cssText='position:fixed;left:50%;bottom:26px;z-index:2147483646;transform:translateX(-50%);max-width:min(92vw,620px);padding:11px 16px;border-radius:999px;background:#0f172a;color:#fff;border:1px solid rgba(148,163,184,.4);box-shadow:0 18px 55px rgba(0,0,0,.45);font:800 13px/1.35 Arial,sans-serif;text-align:center';document.body.appendChild(el)}el.textContent=msg;el.style.borderColor=ok?'rgba(52,211,153,.65)':'rgba(248,113,113,.72)';el.hidden=false;clearTimeout(window.__azSalesPartnerToastTimer1228);window.__azSalesPartnerToastTimer1228=setTimeout(()=>el.hidden=true,3500)}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function waitForFirebaseUser(timeoutMs=1800){const started=Date.now();while(Date.now()-started<timeoutMs){if(auth.currentUser)return auth.currentUser;await sleep(80)}return auth.currentUser||null}

function injectSoftwareUi(){
 if(!/\/Software-Tools\//i.test(location.pathname)||$('#azSalesPartnerApplyBar1228')) return;
 const anchor=$('.software-platform-card')||$('#softwarePlatformFilter')||document.querySelector('main'); if(!anchor)return;
 const bar=document.createElement('div');bar.id='azSalesPartnerApplyBar1228';bar.className='az-sales-partner-bar';
 bar.innerHTML=`<div><strong>Become an AZOBSS Sales Partner</strong><span>Apply to join the AZOBSS sales team. Approved applicants receive Staff access and can earn commission from eligible product and software sales.</span></div><button type="button" id="azSalesPartnerApplyBtn1228">Apply Now</button>`;
 anchor.parentNode.insertBefore(bar,anchor);
 const style=document.createElement('style');style.id='azSalesPartnerStyle1228';style.textContent=`
 .az-sales-partner-bar{position:relative;z-index:20;isolation:isolate;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:12px 0 16px;padding:14px 16px;border:1px solid rgba(34,211,238,.38);border-radius:15px;background:linear-gradient(135deg,rgba(8,145,178,.13),rgba(37,99,235,.10));box-shadow:0 14px 35px rgba(0,0,0,.18)}.az-sales-partner-bar>div{display:grid;gap:4px}.az-sales-partner-bar strong{color:#a5f3fc;font-size:14px;font-weight:950}.az-sales-partner-bar span{color:#cbd5e1;font-size:12px;line-height:1.5}.az-sales-partner-bar button{position:relative!important;z-index:3!important;pointer-events:auto!important;touch-action:manipulation;flex:0 0 auto;border:1px solid rgba(34,211,238,.7);border-radius:999px;background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff;padding:10px 16px;font-size:12px;font-weight:950;cursor:pointer;box-shadow:0 8px 22px rgba(37,99,235,.25)}.az-sales-partner-bar button:disabled{opacity:.62;cursor:default;pointer-events:none!important}.az-sales-partner-modal{position:fixed;inset:0;z-index:2147483601;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.80);backdrop-filter:blur(8px);pointer-events:none}.az-sales-partner-modal.is-open{display:flex;pointer-events:auto!important}.az-sales-partner-card{position:relative;z-index:1;pointer-events:auto!important;width:min(590px,96vw);max-height:92vh;overflow:auto;border:1px solid rgba(34,211,238,.42);border-radius:18px;background:#142033;color:#fff;padding:20px;box-shadow:0 28px 90px rgba(0,0,0,.55)}.az-sales-partner-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.az-sales-partner-head h2{margin:0;font-size:20px}.az-sales-partner-close{width:36px;height:36px;border:1px solid rgba(148,163,184,.35);border-radius:10px;background:#263449;color:#fff;font-size:22px;cursor:pointer}.az-sales-partner-form{display:grid;gap:12px;margin-top:14px}.az-sales-partner-form label{display:grid;gap:6px;color:#dbeafe;font-size:12px;font-weight:850}.az-sales-partner-form input,.az-sales-partner-form select,.az-sales-partner-form textarea{width:100%;box-sizing:border-box;border:1px solid #43536b;border-radius:10px;background:#0b1424;color:#fff;padding:12px;font:inherit;outline:none}.az-sales-partner-form input.az-account-locked{cursor:default;background:#101a2a;color:#cbd5e1;border-color:#334155;box-shadow:inset 3px 0 0 rgba(34,211,238,.45)}.az-sales-partner-form textarea{min-height:100px;resize:vertical}.az-sales-partner-submit{border:0;border-radius:11px;background:#22c55e;color:#052e16;padding:13px 16px;font-weight:950;cursor:pointer}.az-sales-partner-note{margin:0;color:#93c5fd;font-size:11px;line-height:1.45}.az-sales-partner-error{min-height:18px;margin:0;color:#fda4af;font-size:12px;font-weight:800}@media(max-width:700px){.az-sales-partner-bar{align-items:stretch;flex-direction:column}.az-sales-partner-bar button{width:100%}}`;(document.head||document.documentElement).appendChild(style);
 const modal=document.createElement('div');modal.id='azSalesPartnerModal1228';modal.className='az-sales-partner-modal';modal.setAttribute('aria-hidden','true');modal.innerHTML=`<div class="az-sales-partner-card"><div class="az-sales-partner-head"><h2>Apply as AZOBSS Sales Partner</h2><button type="button" class="az-sales-partner-close" aria-label="Close">×</button></div><form class="az-sales-partner-form" id="azSalesPartnerForm1228"><label>Full Name<input id="azSalesPartnerName1228" required></label><label>Email<input id="azSalesPartnerEmail1228" type="email" required></label><label>Phone Number<input id="azSalesPartnerPhone1228" inputmode="tel" required></label><label>Primary Sales Channel<select id="azSalesPartnerChannel1228" required><option value="">Choose one</option><option>WhatsApp</option><option>TikTok</option><option>Facebook</option><option>Instagram</option><option>Website / Blog</option><option>Physical / Direct Sales</option><option>Other</option></select></label><label>Experience / Reason for Joining<textarea id="azSalesPartnerReason1228" placeholder="Tell us how you plan to promote or sell AZOBSS products." required></textarea></label><p class="az-sales-partner-note">Approved applicants will receive AZOBSS Staff access. Commission applies only to eligible sales under AZOBSS rules.</p><p class="az-sales-partner-error" id="azSalesPartnerError1228"></p><button class="az-sales-partner-submit" id="azSalesPartnerSubmit1228" type="submit">Submit Application</button></form></div>`;document.body.appendChild(modal);
 const btn=$('#azSalesPartnerApplyBtn1228');
 bar.hidden=true;
 let syncGeneration=0,syncTimer=null,modalIntentOpen=false;
 let lockedIdentity={fullName:'',email:'',phone:'',phoneLocked:false};
 function closeModalUi(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');modal.style.setProperty('pointer-events','none','important')}
 function hidePartnerSection(forceClose=false){bar.hidden=true;if(forceClose||!modalIntentOpen)closeModalUi()}
 function showPartnerSection(){bar.hidden=false;bar.style.setProperty('pointer-events','auto','important');btn.style.setProperty('pointer-events',btn.disabled?'none':'auto','important')}
 function setLockedField(el,value,locked){if(!el)return;el.value=String(value||'');el.readOnly=!!locked;el.setAttribute('aria-readonly',locked?'true':'false');el.classList.toggle('az-account-locked',!!locked);el.title=locked?'Locked to your AZOBSS account information':''}
 function applyIdentityLocks(u,fu){
   const fullName=String(u?.fullName||u?.displayName||u?.name||fu?.displayName||u?.username||u?.usernameKey||'').trim();
   const email=String(u?.email||u?.authEmail||fu?.email||'').trim().toLowerCase();
   const phone=String(u?.phone||u?.phoneNumber||'').trim();
   lockedIdentity={fullName,email,phone,phoneLocked:!!phone};
   setLockedField($('#azSalesPartnerName1228'),fullName,true);
   setLockedField($('#azSalesPartnerEmail1228'),email,true);
   setLockedField($('#azSalesPartnerPhone1228'),phone,!!phone);
   const phoneEl=$('#azSalesPartnerPhone1228');if(phoneEl&&!phone){phoneEl.placeholder='Enter your phone number';phoneEl.title='Your AZOBSS account does not have a phone number yet. Enter it here for this application.'}
 }
 async function authoritativeProfile(u,fu){
   const candidates=[];
   const primary=usernameOf(u,fu);if(primary)candidates.push(primary);
   const profileId=String(u?.profileDocId||'').trim().toLowerCase();if(profileId&&/^[a-z0-9_]{1,40}$/.test(profileId)&&!candidates.includes(profileId))candidates.push(profileId);
   for(const key of candidates){try{const snap=await getDoc(doc(db,'users',key));if(snap.exists())return {id:snap.id,...snap.data()}}catch(_){} }
   return null;
 }
 async function sync(){
   if(modalIntentOpen&&modal.classList.contains('is-open'))return;
   const generation=++syncGeneration;
   const u=savedUser(),fu=auth.currentUser;
   if(domSaysStaff()||isStaffLike(u)){hidePartnerSection(true);return}
   let profile=null;
   if(fu){profile=await authoritativeProfile(u,fu);if(generation!==syncGeneration)return;if(profile&&isStaffLike(profile)){hidePartnerSection(true);return}}
   if(!fu){showPartnerSection();btn.textContent='Apply Now';btn.disabled=false;btn.style.setProperty('pointer-events','auto','important');return}
   try{
     const snap=await getDoc(doc(db,'salesStaffApplications',fu.uid));if(generation!==syncGeneration)return;
     if(snap.exists()){
       const st=String(snap.data().status||'pending').toLowerCase();
       if(st==='approved'){hidePartnerSection(true);return}
       showPartnerSection();
       if(st==='pending'){btn.textContent='Application Pending';btn.disabled=true;btn.style.setProperty('pointer-events','none','important')}
       else{btn.textContent='Reapply';btn.disabled=false;btn.style.setProperty('pointer-events','auto','important')}
     }else{showPartnerSection();btn.textContent='Apply Now';btn.disabled=false;btn.style.setProperty('pointer-events','auto','important')}
   }catch(_){if(generation!==syncGeneration)return;showPartnerSection();btn.textContent='Apply Now';btn.disabled=false;btn.style.setProperty('pointer-events','auto','important')}
 }
 function scheduleSync(delay=60){clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(),delay)}
 async function open(event){
   try{event?.preventDefault?.();event?.stopPropagation?.()}catch(_){}
   if(btn.disabled)return;
   let fu=auth.currentUser;
   const cached=savedUser();
   if(!fu&&Object.keys(cached||{}).length)fu=await waitForFirebaseUser(1800);
   if(!fu){toast('Please sign in first before applying.',false);try{window.openSiteAuth&&window.openSiteAuth('signin')}catch(_){}return}
   const profile=await authoritativeProfile(cached,fu);
   if(domSaysStaff()||isStaffLike(cached)||isStaffLike(profile)){hidePartnerSection(true);return}
   const u={...cached,...(profile||{})};
   applyIdentityLocks(u,fu);
   $('#azSalesPartnerError1228').textContent='';
   modalIntentOpen=true;
   modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');modal.style.setProperty('pointer-events','auto','important');modal.style.setProperty('z-index','2147483601','important');
 }
 function close(){modalIntentOpen=false;closeModalUi();scheduleSync(80)}
 btn.addEventListener('click',open);
 btn.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();open(e)}});
 modal.querySelector('.az-sales-partner-close').addEventListener('click',close);
 // Keep the form stable: backdrop clicks, focus changes and background role-sync checks must not dismiss an in-progress application.
 modal.addEventListener('click',e=>{if(e.target===modal){e.preventDefault();e.stopPropagation()}});
 $('#azSalesPartnerForm1228').addEventListener('submit',async e=>{
   e.preventDefault();
   const fu=auth.currentUser,err=$('#azSalesPartnerError1228'),submit=$('#azSalesPartnerSubmit1228');
   if(!fu){err.textContent='Please sign in again.';return}
   const cached=savedUser(),usernameKey=usernameOf(cached,fu);
   if(!usernameKey){err.textContent='AZOBSS username could not be detected.';return}
   submit.disabled=true;submit.textContent='Checking account...';err.textContent='';
   try{
     const profile=await authoritativeProfile(cached,fu);
     if(domSaysStaff()||isStaffLike(cached)||isStaffLike(profile)){modalIntentOpen=false;hidePartnerSection(true);return}
     const u={...cached,...(profile||{})};
     const officialFullName=String(u.fullName||u.displayName||u.name||fu.displayName||u.username||u.usernameKey||lockedIdentity.fullName||'').trim();
     const officialEmail=String(u.email||u.authEmail||fu.email||lockedIdentity.email||'').trim().toLowerCase();
     const officialPhone=String(u.phone||u.phoneNumber||'').trim();
     const typedPhone=$('#azSalesPartnerPhone1228').value.trim();
     const phone=officialPhone||typedPhone;
     const channel=$('#azSalesPartnerChannel1228').value,reason=$('#azSalesPartnerReason1228').value.trim();
     // Re-apply account values immediately before save so readonly fields cannot be altered through DevTools/autofill.
     applyIdentityLocks(u,fu);
     if(!officialPhone){const phoneEl=$('#azSalesPartnerPhone1228');if(phoneEl)phoneEl.value=typedPhone}
     if(!officialFullName||!officialEmail||!phone||!channel||!reason){err.textContent='Please complete all fields. If your account has no phone number, enter it in the Phone Number field.';return}
     const payload={uid:fu.uid,usernameKey,fullName:officialFullName,email:officialEmail,phone,channel,reason,status:'pending',source:'Software-Tools',submittedAt:serverTimestamp(),updatedAt:serverTimestamp()};
     submit.textContent='Submitting...';
     await setDoc(doc(db,'salesStaffApplications',fu.uid),payload,{merge:true});
     modalIntentOpen=false;closeModalUi();toast('Application submitted. AZOBSS Admin will review it.');await sync();
   }catch(ex){console.error(ex);err.textContent=ex?.code==='permission-denied'?'Application could not be saved. Deploy the v1228 Firestore rules first.':(ex?.message||'Unable to submit application.')}
   finally{submit.disabled=false;submit.textContent='Submit Application'}
 });
 onAuthStateChanged(auth,()=>scheduleSync(80));
 window.addEventListener('storage',()=>scheduleSync(50));
 window.addEventListener('azobss-auth-changed',()=>scheduleSync(50));
 window.addEventListener('focus',()=>scheduleSync(80));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync(80)});
 if(document.body&&window.MutationObserver){const mo=new MutationObserver(muts=>{if(muts.some(m=>m.type==='attributes'&&m.attributeName==='class'))scheduleSync(40)});mo.observe(document.body,{attributes:true,attributeFilter:['class']})}
 sync();setTimeout(sync,350);setTimeout(sync,1200);setTimeout(sync,2600);
}

function injectAdminUi(){
 if(!/\/admin\//i.test(location.pathname)||$('#salesstaffapps')) return;
 const nav=$('.sidebar .nav'); if(nav&&!nav.querySelector('[data-tab="salesstaffapps"]')){const b=document.createElement('button');b.type='button';b.dataset.tab='salesstaffapps';b.innerHTML='🤝 Sales Staff Applications <span id="salesStaffAppBadge1228" class="az-nav-badge" hidden>0</span>';const commissions=nav.querySelector('[data-tab="commissions"]');commissions?.insertAdjacentElement('afterend',b)}
 const main=$('main.main')||$('main');if(!main)return;const sec=document.createElement('section');sec.id='salesstaffapps';sec.className='section';sec.innerHTML=`<h2>🤝 Sales Staff Applications</h2><p class="az-section-help">Review applications from users who want to become AZOBSS Sales Partners. Approve will automatically change the account role to <b>Staff</b>.</p><div class="card"><div class="toolbar"><input id="salesStaffAppSearch1228" placeholder="Search name / username / email / phone..." style="flex:1;min-width:240px"><select id="salesStaffAppFilter1228"><option value="pending">Pending</option><option value="all">All</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button class="btn" id="salesStaffAppRefresh1228" type="button">Refresh</button></div><div id="salesStaffAppList1228" class="list"></div></div>`;main.appendChild(sec);
 const style=document.createElement('style');style.textContent=`#salesstaffapps .sales-staff-app-card{padding:14px;margin:10px 0;border:1px solid #334155;border-radius:14px;background:#111c2d}#salesstaffapps .sales-staff-app-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}#salesstaffapps .sales-staff-app-name{font-weight:950;color:#fff}#salesstaffapps .sales-staff-app-meta{margin-top:5px;color:#a9bad1;font-size:12px;line-height:1.5}#salesstaffapps .sales-staff-app-reason{margin-top:10px;padding:10px 12px;border-radius:10px;background:#0b1424;color:#dbeafe;font-size:12px;line-height:1.5}#salesstaffapps .sales-staff-app-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}#salesstaffapps .sales-staff-app-actions button{border:0;border-radius:9px;padding:9px 12px;font-weight:900;cursor:pointer}#salesstaffapps .approve{background:#22c55e;color:#052e16}#salesstaffapps .reject{background:#b91c1c;color:#fff}#salesstaffapps .pending-pill,#salesstaffapps .approved-pill,#salesstaffapps .rejected-pill{display:inline-flex;border-radius:999px;padding:4px 9px;font-size:10px;font-weight:950;text-transform:uppercase}#salesstaffapps .pending-pill{background:#78350f;color:#fde68a}#salesstaffapps .approved-pill{background:#064e3b;color:#a7f3d0}#salesstaffapps .rejected-pill{background:#7f1d1d;color:#fecaca}`;(document.head||document.documentElement).appendChild(style);
 let cache=[];
 async function load(){const box=$('#salesStaffAppList1228');if(!box)return;box.innerHTML='<div class="tabs-note">Loading applications...</div>';try{const snap=await getDocs(collection(db,'salesStaffApplications'));cache=[];snap.forEach(d=>cache.push({id:d.id,...d.data()}));cache.sort((a,b)=>{const av=a.submittedAt?.toMillis?.()||0,bv=b.submittedAt?.toMillis?.()||0;return bv-av});render()}catch(ex){box.innerHTML='<div class="tabs-note">Unable to load applications: '+esc(ex?.message||ex)+'</div>'}}
 function render(){const q=String($('#salesStaffAppSearch1228')?.value||'').trim().toLowerCase(),filter=$('#salesStaffAppFilter1228')?.value||'pending',box=$('#salesStaffAppList1228');let rows=cache.filter(x=>{const st=String(x.status||'pending').toLowerCase();if(filter!=='all'&&st!==filter)return false;if(!q)return true;return [x.fullName,x.usernameKey,x.email,x.phone,x.channel].some(v=>String(v||'').toLowerCase().includes(q))});box.innerHTML=rows.map(x=>{const st=String(x.status||'pending').toLowerCase();return `<div class="sales-staff-app-card" data-app-id="${esc(x.id)}"><div class="sales-staff-app-top"><div><div class="sales-staff-app-name">${esc(x.fullName||x.usernameKey||'Applicant')}</div><div class="sales-staff-app-meta">Username: <b>${esc(x.usernameKey||'-')}</b> · ${esc(x.email||'-')} · ${esc(x.phone||'-')}<br>Channel: ${esc(x.channel||'-')}</div></div><span class="${esc(st)}-pill">${esc(st)}</span></div><div class="sales-staff-app-reason">${esc(x.reason||'-')}</div>${st==='pending'?`<div class="sales-staff-app-actions"><button type="button" class="approve" data-app-approve="${esc(x.id)}">Approve → Staff</button><button type="button" class="reject" data-app-reject="${esc(x.id)}">Reject</button></div>`:''}</div>`}).join('')||'<div class="tabs-note">No applications found.</div>';const pending=cache.filter(x=>String(x.status||'pending').toLowerCase()==='pending').length,badge=$('#salesStaffAppBadge1228');if(badge){badge.textContent=String(pending);badge.hidden=pending<1}}
 async function act(id,approve){const row=cache.find(x=>x.id===id);if(!row)return;if(approve){if(!row.usernameKey){alert('Username is missing.');return}if(!confirm('Approve '+(row.fullName||row.usernameKey)+' and change account role to Staff?'))return;try{const userRef=doc(db,'users',String(row.usernameKey).toLowerCase());const us=await getDoc(userRef);if(!us.exists())throw new Error('User profile not found: '+row.usernameKey);await updateDoc(userRef,{role:'staff',salesStaffApprovedAt:serverTimestamp(),salesStaffApplicationUid:row.uid||row.id,updatedAt:serverTimestamp(),updatedByAdmin:'sales-staff-application-v1237'});await updateDoc(doc(db,'salesStaffApplications',id),{status:'approved',reviewedAt:serverTimestamp(),reviewedBy:'admin'});toast('Approved. Account role is now Staff.');await load()}catch(ex){alert(ex?.message||String(ex))}}else{if(!confirm('Reject this application?'))return;try{await updateDoc(doc(db,'salesStaffApplications',id),{status:'rejected',reviewedAt:serverTimestamp(),reviewedBy:'admin'});toast('Application rejected.');await load()}catch(ex){alert(ex?.message||String(ex))}}}
 sec.addEventListener('click',e=>{const a=e.target.closest('[data-app-approve]'),r=e.target.closest('[data-app-reject]');if(a)act(a.dataset.appApprove,true);if(r)act(r.dataset.appReject,false)});$('#salesStaffAppSearch1228')?.addEventListener('input',render);$('#salesStaffAppFilter1228')?.addEventListener('change',render);$('#salesStaffAppRefresh1228')?.addEventListener('click',load);window.azSalesStaffApplicationsLoad=load;setTimeout(load,1200);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectSoftwareUi();injectAdminUi()},{once:true});else{injectSoftwareUi();injectAdminUi()}
