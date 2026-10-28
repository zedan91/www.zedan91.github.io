/* AZOBSS v1455: public business registration footer.
   Keeps SSM identity visible across public website pages without exposing owner/private address data. */
(function(){
  'use strict';
  if(window.__AZOBSS_BUSINESS_REGISTRATION_V1455__) return;
  window.__AZOBSS_BUSINESS_REGISTRATION_V1455__ = true;

  var ID='azobssBusinessRegistration1455';
  var STYLE_ID='azobssBusinessRegistrationStyle1455';
  var TEXT='AZOBSS ENTERPRISE | SSM: 202603287983 (CT0171167-W)';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\n'
      +'#'+ID+'{box-sizing:border-box;width:100%;max-width:100%;margin:0;padding:10px 14px 16px;text-align:center;color:#94a3b8;background:transparent;font:600 11px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.015em;}\n'
      +'#'+ID+' .azobss-business-name{color:#cbd5e1;font-weight:800;}\n'
      +'#'+ID+' .azobss-business-sep{margin:0 5px;color:#64748b;}\n'
      +'#'+ID+' .azobss-business-ssm{white-space:nowrap;}\n'
      +'@media(max-width:520px){#'+ID+'{padding:9px 10px 14px;font-size:10px;line-height:1.4;}#'+ID+' .azobss-business-ssm{white-space:normal;}}\n';
    (document.head||document.documentElement).appendChild(style);
  }

  function ensureFooter(){
    if(document.getElementById(ID)) return;
    ensureStyle();
    if(!document.body) return;

    var box=document.createElement('div');
    box.id=ID;
    box.setAttribute('data-az-business-registration','v1455');
    box.setAttribute('role','contentinfo');
    box.setAttribute('aria-label',TEXT);
    box.innerHTML='<span class="azobss-business-name">AZOBSS ENTERPRISE</span>'
      +'<span class="azobss-business-sep" aria-hidden="true">|</span>'
      +'<span class="azobss-business-ssm">SSM: 202603287983 (CT0171167-W)</span>';

    var footers=document.querySelectorAll('footer');
    var footer=footers.length ? footers[footers.length-1] : null;
    if(footer && footer.parentNode){
      footer.insertAdjacentElement('afterend',box);
    }else{
      document.body.appendChild(box);
    }
  }

  function start(){
    ensureFooter();
    setTimeout(ensureFooter,300);
    setTimeout(ensureFooter,1200);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
