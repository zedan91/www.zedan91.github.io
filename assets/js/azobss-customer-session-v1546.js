(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.AZOBSSCustomerSession1546=api;})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const uid=()=>String(root.azobssGetCurrentFirebaseUid?.()||'');
 async function headers(){
  const deadline=Date.now()+12000;
  while(typeof root.azobssWaitForFirebaseAuthToken!=='function'&&typeof root.azobssGetFirebaseAuthHeaders!=='function'&&Date.now()<deadline)await pause(50);
  if(typeof root.azobssGetFirebaseAuthHeaders!=='function')throw Object.assign(Error('Your account is still loading. Please retry.'),{code:'session_unavailable'});
  let h=await root.azobssGetFirebaseAuthHeaders(false)||{};
  if(h.Authorization)return h;
  if(typeof root.azobssWaitForFirebaseAuthToken==='function'){
   const token=await root.azobssWaitForFirebaseAuthToken(false,12000);
   if(token)return {...h,Authorization:'Bearer '+token};
  }
  if(uid()){
   h=await root.azobssGetFirebaseAuthHeaders(true)||{};
   if(h.Authorization)return h;
   throw Object.assign(Error('Unable to verify your session. Please retry.'),{code:'session_unavailable'});
  }
  throw Object.assign(Error('Please sign in to continue.'),{code:'login_required'});
 }
 return {headers};
});
