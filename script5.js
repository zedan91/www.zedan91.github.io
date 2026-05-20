
(function(){
  var ADMIN_USERNAME = 'zedan91';

  function clean(v){
    return String(v || '').trim().toLowerCase();
  }

  function getCurrentUserObject(){
    try{
      return getSavedUser();
    }catch(e){
      return null;
    }
  }

  function adminDetected(){
    if(!hasSavedLogin()){
      return false;
    }

    var currentUser = getCurrentUserObject();
    if(currentUser && clean(currentUser.usernameKey) === ADMIN_USERNAME){
      return true;
    }

    var signedInNameEl = document.getElementById('signedInName') || document.querySelector('.user-name');
    if(clean(signedInNameEl && signedInNameEl.textContent) === ADMIN_USERNAME){
      return true;
    }

    return false;
  }

  function restorePurchaseRecordsPanel(){
    var isAdmin = adminDetected();

    if(isAdmin){
      document.body.classList.add('is-admin');
    }else{
      document.body.classList.remove('is-admin');
    }
    document.body.classList.add('has-pa-access');

    var panel = document.getElementById('adminPurchasePanel');
    if(panel){
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.style.display = 'block';
      panel.style.visibility = 'visible';
      panel.style.opacity = '1';
    }

    var title = document.getElementById('purchasePanelTitle');
    if(title){
      title.textContent = isAdmin ? 'Purchase Records Users' : 'Purchase Records Saya';
    }

    var note = document.getElementById('purchasePanelNote');
    if(note){
      note.style.display = isAdmin ? 'block' : 'none';
      if(isAdmin && !note.textContent.trim()){
        note.textContent = 'Price: PA RM5/unit, BM/SBM RM3/unit. Admin can view all active user purchase records.';
      }
    }

    var tools = document.getElementById('purchaseRecordTools');
    if(tools){
      tools.hidden = !isAdmin;
      if(isAdmin){
        tools.removeAttribute('hidden');
        tools.style.display = 'grid';
      }else{
        tools.setAttribute('hidden', '');
        tools.style.display = 'none';
      }
    }

    var actions = document.querySelector('.purchase-record-actions');
    if(actions){
      actions.style.display = isAdmin ? '' : 'none';
    }

    var refreshBtn = document.getElementById('refreshPurchaseButton');
    var toggleBtn = document.getElementById('togglePurchaseRecordsButton');

    if(refreshBtn) refreshBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if(toggleBtn){
      toggleBtn.style.display = isAdmin ? 'inline-block' : 'none';
      if(isAdmin) toggleBtn.textContent = 'Hide Records';
    }

    var list = document.getElementById('purchaseSummaryList');
    if(list){
      list.hidden = false;
      list.removeAttribute('hidden');
      list.style.display = 'grid';
    }

    if(isAdmin && refreshBtn && !refreshBtn.dataset.azobssAutoRefreshDone){
      refreshBtn.dataset.azobssAutoRefreshDone = '1';
      setTimeout(function(){
        try{ refreshBtn.click(); }catch(e){}
      }, 600);
    }
  }

  function restoreAdminHistoryPanels(){
    var isAdmin = adminDetected();
    var requestCard = document.querySelector('.request-card') || document.getElementById('requestCard');
    if(isAdmin){
      document.body.classList.add('is-admin');
      if(requestCard) requestCard.classList.add('is-admin');
    }

    var panelIds = isAdmin
      ? ['registeredUsersPanel','liveUsersPanel','loginHistoryPanel','guestHistoryPanel']
      : ['liveUsersPanel','loginHistoryPanel','guestHistoryPanel'];

    panelIds.forEach(function(id){
      var panel = document.getElementById(id);
      if(!panel) return;
      if(isAdmin){
        panel.hidden = false;
        panel.removeAttribute('hidden');
        panel.style.display = 'block';
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
      }else{
        panel.hidden = true;
        panel.style.display = 'none';
      }
    });
  }

  function restoreAllAdminPanels(){
    restorePurchaseRecordsPanel();
    restoreAdminHistoryPanels();
  }

  document.addEventListener('DOMContentLoaded', restoreAllAdminPanels);
  window.addEventListener('load', restoreAllAdminPanels);
  window.addEventListener('storage', restoreAllAdminPanels);
  setTimeout(restoreAllAdminPanels, 300);
  setTimeout(restoreAllAdminPanels, 1200);
  setTimeout(restoreAllAdminPanels, 2500);
})();
