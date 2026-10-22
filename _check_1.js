
(function(){
  try{
    function parse(raw){try{return JSON.parse(raw||'null')}catch(_){return null}}
    var u=parse(sessionStorage.getItem('azobssCurrentUser'))||
          parse(localStorage.getItem('azobssCurrentUser'))||
          parse(sessionStorage.getItem('azobssUser'))||
          parse(localStorage.getItem('azobssUser'));
    var html=document.documentElement;
    var auth=!!u;
    var key=String(u&&(u.usernameKey||u.username||u.name)||'').trim().toLowerCase();
    var email=String(u&&(u.email||u.authEmail)||'').trim().toLowerCase();
    var role=String(u&&(u.role||u.userRole||u.accountRole||u.staffRole)||'').trim().toLowerCase();
    var isAdmin=!!u&&(role==='admin'||key==='zedan91'||key==='zedan9107'||email==='zedan91@azobss.local'||email==='zedan9107@gmail.com');
    function truthy(v){
      if(v===true||v===1)return true;
      return ['true','yes','y','1','allow','allowed','on','enabled','enable'].indexOf(String(v==null?'':v).trim().toLowerCase())>=0;
    }
    var adminDecisionPresent=!!u&&(u.adminPaBmAllowed===true||u.adminPaBmAllowed===false||['true','false','yes','no','y','n','1','0','allow','allowed','on','off','enabled','enable','disabled','disable','hide'].indexOf(String(u.adminPaBmAllowed==null?'':u.adminPaBmAllowed).trim().toLowerCase())>=0);
    var adminManaged=!!u&&(adminDecisionPresent||u.adminPaBmOverride===true||String(u.paBmManagedBy||'').toLowerCase()==='admin');
    var adminAllowed=adminManaged&&(
      truthy(u.adminPaBmAllowed)||truthy(u.paBmAccess)||truthy(u.paBmAllowed)||
      truthy(u.allowPABM)||truthy(u.allowPaBm)||truthy(u.allowPaBmTab)||
      truthy(u.paBmTabAllowed)||truthy(u.showPaBmTab)||truthy(u.canAccessPaBm)
    );
    if(adminDecisionPresent) adminAllowed=truthy(u.adminPaBmAllowed);
    var flagAllowed=!!u&&(
      truthy(u.paBmAccess)||truthy(u.paBmAllowed)||truthy(u.allowPABM)||
      truthy(u.allowPaBm)||truthy(u.allowPaBmTab)||truthy(u.paBmTabAllowed)||
      truthy(u.showPaBmTab)||truthy(u.canAccessPaBm)||truthy(u.paAccess)
    );
    var codes=[
      u&&u.invitedByCode,u&&u.memberCode,u&&u.paMemberCode,u&&u.accessCode,
      u&&u.inviteCodeUsed,u&&u.signupCode,u&&u.member_code,u&&u.referralCode,u&&u.inviteCode
    ].map(function(v){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')});
    var pa=!!u&&(isAdmin||(adminManaged?adminAllowed:false));
    var roleFlat=role.replace(/[\s_-]+/g,'');
    var publicBlocked=roleFlat==='admin';
    var publicPa=!pa&&!isAdmin&&!publicBlocked;
    html.setAttribute('data-azobss-pre-auth',auth?'1':'0');
    html.setAttribute('data-azobss-pre-pabm',pa?'1':'0');
    html.setAttribute('data-azobss-pre-publicpa',publicPa?'1':'0');
  }catch(_e){}
})();
