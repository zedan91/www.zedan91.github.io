
(function(){
  try{
    if(localStorage.getItem('azobss_admin_role_cache')==='1'){
      document.documentElement.classList.add('azobss-admin-cache');
    }
  }catch(e){}
})();
