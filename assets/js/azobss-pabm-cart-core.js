(function(){
  'use strict';

  if(window.__AZOBSS_PABM_CART_CORE_V1267__) return;
  window.__AZOBSS_PABM_CART_CORE_V1267__ = true;

  var CART_PREFIX = 'azobss_pabm_store_cart_v1_';
  var MAX_CART_ITEMS = 50;
  var VALID_TYPES = { PA:1, BM:1, SBM:1, GPS:1, NDCDB:1, NDCDB_C3:1, SYIT_PIAWAI:1 };
  var TYPE_LABELS = {
    PA:'PA', BM:'BM', SBM:'SBM', GPS:'GPS',
    NDCDB:'Lot Kadaster Berdigit', NDCDB_C3:'Lot Kadaster Berdigit C3',
    SYIT_PIAWAI:'Syit Piawai (Gambar)'
  };
  var STATE_LABELS = {
    JOHOR:'Johor', KEDAH:'Kedah', KELANTAN:'Kelantan', MELAKA:'Melaka',
    'NEGERI SEMBILAN':'N. Sembilan', PAHANG:'Pahang', PERAK:'Perak', PERLIS:'Perlis',
    'PULAU PINANG':'P. Pinang', SABAH:'Sabah', SARAWAK:'Sarawak', SELANGOR:'Selangor',
    TERENGGANU:'Terengganu', 'WILAYAH PERSEKUTUAN KUALA LUMPUR':'W.P. KL',
    'WILAYAH PERSEKUTUAN LABUAN':'W.P. Labuan', 'WILAYAH PERSEKUTUAN PUTRAJAYA':'W.P. Putrajaya'
  };

  function parseJson(raw){ try{ var x=JSON.parse(raw||''); return x && typeof x==='object' ? x : null; }catch(_){ return null; } }
  function savedUser(){
    try{
      if(typeof window.getSavedUser === 'function'){
        var direct = window.getSavedUser();
        if(direct) return direct;
      }
    }catch(_){ }
    try{
      var stores=[window.sessionStorage, window.localStorage];
      var keys=['azobssCurrentUser','azobssUser'];
      for(var s=0;s<stores.length;s++) for(var k=0;k<keys.length;k++){
        var row=parseJson(stores[s].getItem(keys[k]));
        if(row) return row;
      }
    }catch(_){ }
    return null;
  }
  function normKey(value){ return String(value||'').trim(); }
  function cartKeys(){
    var u=savedUser()||{};
    // Canonical owner is AZOBSS username first; Firebase UID is legacy fallback only.
    // This keeps the key stable before/after Firebase auth hydration.
    var raw=[u.usernameKey,u.username,u.userName,u.uid];
    var seen={}; var out=[];
    raw.forEach(function(v){ v=normKey(v); if(v && !seen[v]){ seen[v]=1; out.push(CART_PREFIX+v); } });
    if(!out.length) out.push(CART_PREFIX+'guest');
    return out;
  }
  function primaryCartKey(){ return cartKeys()[0]; }

  function escapeHtml(value){ return String(value==null?'':value).replace(/[&<>"']/g,function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]; }); }
  function normalizeType(value){ var t=String(value||'PA').trim().toUpperCase(); if(!VALID_TYPES[t]) throw new Error('Unsupported document category.'); return t; }
  function normalizeCode(value,type){
    var raw=String(value||'').trim();
    if(type==='PA') return raw.toUpperCase().replace(/^PA/i,'').replace(/\.TIF$/i,'').replace(/[^0-9]/g,'');
    if(type==='NDCDB'||type==='NDCDB_C3') return raw.replace(/\s+/g,' ');
    return raw.toUpperCase().replace(/\s+/g,' ');
  }
  function normalizeVariant(value,type){
    if(type!=='NDCDB'&&type!=='NDCDB_C3') return '';
    var v=String(value||'').trim().toUpperCase();
    return (v==='FULL_SHEET'||v==='AREA_BASED') ? v : '';
  }
  function defaultAmount(type,variant,supplied){
    var n=Number(supplied);
    if(Number.isFinite(n)&&n>0) return n;
    if(type==='PA') return 5;
    if(type==='BM'||type==='SBM') return 3;
    if(type==='GPS') return 9;
    if(type==='SYIT_PIAWAI') return 7;
    if(type==='NDCDB'||type==='NDCDB_C3') return variant==='FULL_SHEET'?50:15;
    return 0;
  }
  function normalizeItem(payload){
    payload=payload||{};
    var type=normalizeType(payload.productType||payload.product||payload.type);
    var code=normalizeCode(payload.itemCode||payload.stationNo||payload.stesen||payload.productId||payload.id,type);
    var state=String(payload.negeri||payload.state||'').trim().toUpperCase();
    var variant=normalizeVariant(payload.variant||payload.areaSize,type);
    if(!code||!state) throw new Error('Select a state and enter a valid document number.');
    var amount=defaultAmount(type,variant,payload.amount!=null?payload.amount:payload.baseAmount);
    var base=defaultAmount(type,variant,payload.baseAmount!=null?payload.baseAmount:amount);
    return {
      id:[type,code,state,variant].filter(Boolean).join('|'),
      productType:type,itemCode:code,negeri:state,variant:variant,
      baseAmount:base,amount:amount,
      priceAdjustmentCategory:(type==='NDCDB'||type==='NDCDB_C3')?'lotKadaster':'paBm',
      priceAdjustmentPercent:Number(payload.priceAdjustmentPercent||0),
      productId:String(payload.productId||payload.id||'').trim(),
      stationNo:String(payload.stationNo||payload.stesen||'').trim().toUpperCase(),
      jenis:String(payload.jenis||(type==='SBM'?'2':'1'))==='2'?'2':'1',
      downloadUrl:String(payload.downloadUrl||payload.url||'').trim(),
      filename:String(payload.filename||'').trim(),
      selectionToken:String(payload.selectionToken||'').trim(),
      areaRatio:Number(payload.areaRatio||0)||0,
      addedAtMs:Date.now()
    };
  }

  var TABLE_CART_BUTTON_SELECTOR = [
    '.pabm-table-cart-button[data-benchmark-record]',
    '.pabm-table-cart-button[data-pa-search-record]',
    '.pabm-table-cart-button[data-gps-record]',
    '.pabm-table-cart-button[data-syit-record]'
  ].join(',');
  var tableCartSyncTimer = 0;
  var tableCartObserver = null;

  function decodeButtonPayload(button){
    if(!button) return null;
    var raw = (button.dataset && (button.dataset.benchmarkRecord || button.dataset.paSearchRecord || button.dataset.gpsRecord || button.dataset.syitRecord)) || '';
    if(!raw) return null;
    try{ return JSON.parse(decodeURIComponent(raw)); }catch(_){ return null; }
  }
  function buttonItemId(button){
    var payload=decodeButtonPayload(button);
    if(!payload) return '';
    try{ return normalizeItem(payload).id; }catch(_){ return ''; }
  }
  function syncTableCartButtons(){
    var ids={};
    readCart().forEach(function(item){ var id=String(item&&item.id||''); if(id) ids[id]=1; });
    document.querySelectorAll(TABLE_CART_BUTTON_SELECTOR).forEach(function(button){
      var id=buttonItemId(button);
      var active=!!(id && ids[id]);
      button.classList.toggle('is-in-cart',active);
      button.setAttribute('aria-pressed',active?'true':'false');
      button.setAttribute('data-cart-selected',active?'1':'0');
      if(active){
        if(!button.dataset.cartOriginalTitle) button.dataset.cartOriginalTitle=button.getAttribute('title')||'Tambah ke Troli';
        if(!button.dataset.cartOriginalAriaLabel) button.dataset.cartOriginalAriaLabel=button.getAttribute('aria-label')||'Tambah ke Troli';
        button.setAttribute('title','Sudah dalam Troli — tekan lagi untuk buang');
        button.setAttribute('aria-label','Item sudah dalam troli. Tekan lagi untuk buang daripada troli');
      }else{
        button.setAttribute('title',button.dataset.cartOriginalTitle||'Tambah ke Troli');
        button.setAttribute('aria-label',button.dataset.cartOriginalAriaLabel||button.getAttribute('aria-label')||'Tambah ke Troli');
        delete button.dataset.cartOriginalTitle;
        delete button.dataset.cartOriginalAriaLabel;
      }
    });
  }
  function scheduleTableCartButtonSync(delay){
    if(tableCartSyncTimer) clearTimeout(tableCartSyncTimer);
    tableCartSyncTimer=setTimeout(function(){ tableCartSyncTimer=0; syncTableCartButtons(); },Math.max(0,Number(delay)||0));
  }
  function watchTableCartButtons(){
    if(tableCartObserver || !window.MutationObserver || !document.body) return;
    tableCartObserver=new MutationObserver(function(mutations){
      var changed=mutations.some(function(m){
        return Array.prototype.some.call(m.addedNodes||[],function(node){
          if(!node || node.nodeType!==1) return false;
          return (node.matches && node.matches(TABLE_CART_BUTTON_SELECTOR)) || (node.querySelector && node.querySelector(TABLE_CART_BUTTON_SELECTOR));
        });
      });
      if(changed) scheduleTableCartButtonSync(0);
    });
    tableCartObserver.observe(document.body,{childList:true,subtree:true});
  }

  function readKey(key){
    try{ var rows=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(rows)?rows.filter(Boolean):[]; }catch(_){ return []; }
  }
  function readCart(){
    var keys=cartKeys(); var merged=[]; var ids={};
    for(var i=0;i<keys.length;i++){
      readKey(keys[i]).forEach(function(item){
        var id=String(item&&item.id||'');
        if(id && !ids[id]){ ids[id]=1; merged.push(item); }
      });
    }
    merged.sort(function(a,b){ return Number(b&&b.addedAtMs||0)-Number(a&&a.addedAtMs||0); });
    return merged.slice(0,MAX_CART_ITEMS);
  }
  function persistCart(items){
    var rows=Array.isArray(items)?items.filter(Boolean).slice(0,MAX_CART_ITEMS):[];
    var json=JSON.stringify(rows);
    var keys=cartKeys();
    try{ localStorage.setItem(keys[0],json); }catch(_){ }
    // Once canonical username storage is written, delete legacy UID aliases so a
    // later renderer cannot resurrect a removed item from a stale second key.
    for(var i=1;i<keys.length;i++){ try{ localStorage.removeItem(keys[i]); }catch(_){ } }
    return rows;
  }
  function money(value){ var n=Number(value||0); return 'RM'+(Number.isInteger(n)?String(n):n.toFixed(2)); }
  function title(item){ var label=TYPE_LABELS[item.productType]||item.productType; return label+' '+String(item.itemCode||''); }
  function render(){
    var items=readCart();
    var list=document.getElementById('pabmStoreCartItems');
    var count=document.getElementById('pabmStoreCartCount');
    var total=document.getElementById('pabmStoreCartTotal');
    var paymentTotal=document.getElementById('paBmToyyibTotal');
    var pay=document.getElementById('payPaBmToyyibButton');
    var sum=items.reduce(function(a,b){ return a+Number(b&&b.amount||0); },0);
    if(count) count.textContent=items.length+' item';
    if(total) total.textContent=money(sum);
    if(paymentTotal) paymentTotal.textContent=money(sum);
    if(list){
      list.innerHTML=items.length?items.map(function(item,index){
        return '<div class="pabm-cart-item"><div><strong>'+escapeHtml(title(item))+'</strong><small>'+escapeHtml(STATE_LABELS[item.negeri]||item.negeri||'')+'</small></div><div class="pabm-cart-item-side"><span class="pabm-cart-item-price">'+money(item.amount)+'</span><button class="pabm-cart-remove" type="button" data-pabm-core-remove="'+index+'" aria-label="Buang" title="Buang">&times;</button></div></div>';
      }).join(''):'<div class="pabm-cart-empty">Troli anda kosong.</div>';
    }
    if(pay) pay.disabled=!items.length;
    scheduleTableCartButtonSync(0);
    try{ window.dispatchEvent(new CustomEvent('azobss:pabm-cart-core-rendered',{detail:{count:items.length,total:sum,key:primaryCartKey()}})); }catch(_){ }
    return items;
  }
  function writeCart(items){
    var rows=persistCart(items); render();
    try{ window.dispatchEvent(new CustomEvent('azobss:pabm-cart-updated',{detail:{count:rows.length,source:'classic-core-v1267'}})); }catch(_){ }
    return rows;
  }
  function hasLogin(){
    if(savedUser()) return true;
    try{ if(typeof window.hasSavedLogin==='function' && window.hasSavedLogin()) return true; }catch(_){ }
    return false;
  }
  function openLogin(){ try{ if(typeof window.openSiteAuth==='function') return window.openSiteAuth('signin'); }catch(_){ } var b=document.getElementById('siteSignInButton'); if(b) b.click(); }
  function add(payload){
    return Promise.resolve().then(function(){
      if(!hasLogin()){
        openLogin();
        throw new Error('Sila log masuk sebelum menambah item ke troli anda.');
      }
      var item=normalizeItem(payload||{}); var items=readCart();
      var exists=items.some(function(row){ return String(row&&row.id||'')===item.id; });
      if(!exists){
        if(items.length>=MAX_CART_ITEMS) throw new Error('Cart limit reached. Remove an item before adding another.');
        items.unshift(item); writeCart(items);
      }else render();
      var status=document.getElementById('paBmToyyibStatus');
      if(status && /login again|cart is not ready|sesi log masuk/i.test(String(status.textContent||''))) status.textContent='Item tersedia dalam Troli Anda.';
      return Object.assign({},item,{__azobssAlreadyInCart:exists});
    });
  }
  function removeIndex(index){
    var items=readCart(); var i=Number(index);
    if(!Number.isInteger(i)||i<0||i>=items.length) return false;
    items.splice(i,1); writeCart(items);
    var status=document.getElementById('paBmToyyibStatus'); if(status) status.textContent=items.length?'Troli telah dikemas kini.':'Troli anda kosong.';
    return true;
  }

  // Migrate any old UID-key cart to the canonical username key before the ES module starts.
  (function migrateLegacyKey(){
    var keys=cartKeys(); if(keys.length<2) return;
    var primary=readKey(keys[0]); if(primary.length) return;
    var merged=readCart(); if(merged.length) persistCart(merged);
  })();

  window.azobssPaBmCartCore={read:readCart,write:writeCart,render:render,add:add,removeIndex:removeIndex,keys:cartKeys,syncTableButtons:syncTableCartButtons,version:1267};
  window.azobssAddToPaBmCart=add;
  window.azobssRecordPurchase=add;
  window.__AZOBSS_PABM_CART_OWNER__='classic-core-v1267';

  document.addEventListener('click',function(event){
    var b=event.target&&event.target.closest?event.target.closest('[data-pabm-core-remove]'):null;
    if(!b) return;
    event.preventDefault(); event.stopPropagation(); removeIndex(b.getAttribute('data-pabm-core-remove'));
  },true);
  window.addEventListener('storage',render);
  window.addEventListener('azobss:pabm-cart-updated',function(){ setTimeout(render,0); });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ watchTableCartButtons(); render(); },{once:true}); else { watchTableCartButtons(); render(); }
})();
