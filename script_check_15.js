
(function(){
  if(window.__azobssRoleHardening041) return;
  window.__azobssRoleHardening041 = true;

  function lower(v){ return String(v || '').trim().toLowerCase(); }

  function readStoredObjects(){
    var out = [];
    var keys = [
      'azobssCurrentUser','azobssUser','azobss_current_user','azobssSavedUser',
      'azobss_user_profile','azobssProfile','currentUser','userProfile',
      'azobss_auth_user','azobssLoginUser','azobss_logged_user'
    ];
    keys.forEach(function(k){
      try{
        var raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        if(!raw) return;
        try{
          var obj = JSON.parse(raw);
          if(obj && typeof obj === 'object') out.push(obj);
        }catch(e){
          out.push({username:raw, raw:raw});
        }
      }catch(e){}
    });
    return out;
  }

  function detectRole(){
    var adminNames = ['zedan91'];
    var adminEmails = ['zedan9107@gmail.com','zedan91@azobss.local'];

    var visibleName = lower((document.querySelector('#signedInName') || {}).textContent);
    var userNameBox = lower((document.querySelector('.user-name') || {}).textContent);

    if(adminNames.indexOf(visibleName) !== -1 || adminNames.indexOf(userNameBox) !== -1 || userNameBox.indexOf('zedan91') !== -1){
      return 'admin';
    }

    var objs = readStoredObjects();
    for(var i=0;i<objs.length;i++){
      var u = objs[i] || {};
      var role = lower(u.role || u.userRole || u.accountRole || u.type || u.accessRole);
      var username = lower(u.usernameKey || u.username || u.userName || u.id || u.name || u.displayName || u.raw);
      var email = lower(u.email || u.authEmail || u.realEmail || u.userEmail);

      if(adminNames.indexOf(username) !== -1 || adminEmails.indexOf(email) !== -1){
        return 'admin';
      }

      if(role === 'admin' || u.isAdmin === true || u.admin === true || u.owner === true){
        return 'admin';
      }

      if(
        role === 'staff' || role === 'semiadmin' || role === 'semi-admin' ||
        role === 'semi_admin' || role === 'seller' || role === 'editor' ||
        u.isStaff === true || u.staff === true || u.staffDashboard === true ||
        u.canAccessStaffDashboard === true || u.canAddSoftware === true
      ){
        return 'staff';
      }
    }

    try{
      if(localStorage.getItem('azobss_admin_role_cache') === '1') return 'admin';
      if(localStorage.getItem('azobss_staff_role_cache') === '1') return 'staff';
    }catch(e){}

    return 'none';
  }

  function setRoleClass(role){
    document.body.classList.toggle('az-role-is-admin', role === 'admin');
    document.body.classList.toggle('is-admin', role === 'admin');
    document.body.classList.toggle('az-role-is-staff', role === 'staff');
    document.body.classList.toggle('az-role-is-stafflike', role === 'staff');
    document.body.setAttribute('data-az-current-role', role);
  }

  function hardHide(el){
    if(!el) return;
    el.style.setProperty('display','none','important');
    el.style.setProperty('visibility','hidden','important');
    el.style.setProperty('pointer-events','none','important');
    el.setAttribute('aria-hidden','true');
    el.tabIndex = -1;
  }

  function hardShow(el){
    if(!el) return;
    el.style.setProperty('display','inline-flex','important');
    el.style.setProperty('visibility','visible','important');
    el.style.setProperty('pointer-events','auto','important');
    el.removeAttribute('aria-hidden');
    el.tabIndex = 0;
  }

  function applyButtons(){
    var role = detectRole();
    setRoleClass(role);

    document.querySelectorAll('.azAdminDashboardBtn,.admin-dashboard-btn,.market-nav a[href="/admin/"],a[href="/admin/"].azobss-nav-chip').forEach(function(el){
      role === 'admin' ? hardShow(el) : hardHide(el);
    });

    document.querySelectorAll('.azStaffDashboardBtn,.staff-dashboard-btn,.market-nav a[href="/staff/"],a[href="/staff/"].azobss-nav-chip').forEach(function(el){
      role === 'staff' ? hardShow(el) : hardHide(el);
    });

    return role;
  }

  function showDenied(required, role){
    if(document.getElementById('azRoleDenyOverlay041')) return;
    var div = document.createElement('div');
    div.id = 'azRoleDenyOverlay041';
    div.innerHTML = '<div class="box"><h2>Access Restricted</h2><p>This page is for '+required+' only.<br>Current role: '+role+'</p><a href="/">Go to Home</a></div>';
    document.body.appendChild(div);
    setTimeout(function(){ location.href = '/'; }, 1800);
  }

  function guardPage(){
    var path = location.pathname.toLowerCase();
    var required = '';
    if(path === '/admin/' || path === '/admin/index.html') required = 'admin';
    if(path === '/staff/' || path === '/staff/index.html') required = 'staff';
    if(!required) return;

    var role = applyButtons();

    if(role === required) return;

    // Allow a short delay for auth UI/localStorage to initialize before blocking.
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      role = applyButtons();
      if(role === required){
        clearInterval(timer);
        return;
      }
      if(tries >= 8){
        clearInterval(timer);
        showDenied(required, role);
      }
    }, 350);
  }

  function run(){
    applyButtons();
    guardPage();
  }

  document.addEventListener('DOMContentLoaded', run);
  if(document.readyState !== 'loading') run();
  window.addEventListener('storage', run);
  window.addEventListener('focus', run);
  setTimeout(run, 300);
  setTimeout(run, 1200);
  setTimeout(run, 2500);
})();
