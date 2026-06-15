
(function(){
  if(window.__azExclusiveTopbarPanelsFinal) return;
  window.__azExclusiveTopbarPanelsFinal = true;

  function qs(sel){return document.querySelector(sel);}
  function bellPanel(){return qs('#azBellModal');}
  function chatPanel(){return qs('#azSupportModal');}
  function cartPanel(){return qs('.az-shop-cart-panel,#azShopCartPanel,#shopCartPanel,[data-az-shop-cart-panel]');}

  function isBellBtn(el){
    return !!(el && el.closest && el.closest('[title="Notifications"],[aria-label="Notifications"]'));
  }

  function isChatBtn(el){
    return !!(el && el.closest && el.closest('[title="Contact Admin / Support"],[title="Contact Admin"],[title="Support"],[aria-label="Contact Admin / Support"]'));
  }

  function isCartBtn(el){
    return !!(el && el.closest && el.closest('[data-az-shop-cart-toggle],[title="My Cart"],[aria-label="My Cart"],.market-icon-btn.cart,.cart-toggle,.shop-cart-toggle'));
  }

  function closeBell(){ var p=bellPanel(); if(p) p.classList.remove('is-open'); }
  function closeChat(){ var p=chatPanel(); if(p) p.classList.remove('is-open'); }
  function closeCart(){
    var p=cartPanel();
    if(p){
      p.classList.remove('is-open');
      p.classList.remove('open');
    }
  }

  function openBell(){
    closeChat(); closeCart();
    var p=bellPanel(); if(p) p.classList.add('is-open');
    if(typeof window.azobssLoadNotifications==='function') window.azobssLoadNotifications();
    if(typeof window.azobssMarkNotificationsSeen==='function') window.azobssMarkNotificationsSeen();
  }

  function openChat(){
    closeBell(); closeCart();
    var p=chatPanel(); if(p) p.classList.add('is-open');
    if(typeof window.azobssLoadSupportMessages==='function') window.azobssLoadSupportMessages();
    if(typeof window.azMarkSupportSeen==='function') window.azMarkSupportSeen();
  }

  function toggleBell(){
    var p=bellPanel();
    var already=!!(p && p.classList.contains('is-open'));
    closeChat(); closeCart();
    if(already) closeBell(); else openBell();
  }

  function toggleChat(){
    var p=chatPanel();
    var already=!!(p && p.classList.contains('is-open'));
    closeBell(); closeCart();
    if(already) closeChat(); else openChat();
  }

  document.addEventListener('click',function(e){
    if(isBellBtn(e.target)){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      toggleBell();
      return;
    }

    if(isChatBtn(e.target)){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      toggleChat();
      return;
    }

    if(isCartBtn(e.target)){
      closeBell();
      closeChat();
      setTimeout(function(){closeBell();closeChat();},80);
      return;
    }
  },true);

  document.addEventListener('click',function(e){
    var bp=bellPanel(), cp=chatPanel();
    var insideBell=bp && bp.contains(e.target);
    var insideChat=cp && cp.contains(e.target);
    var topIcon=isBellBtn(e.target)||isChatBtn(e.target)||isCartBtn(e.target);
    if(!insideBell && !insideChat && !topIcon){
      closeBell();
      closeChat();
    }
  },false);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){
      closeBell();
      closeChat();
      closeCart();
    }
  });

  window.azobssCloseTopbarPanels=function(){closeBell();closeChat();closeCart();};
})();
