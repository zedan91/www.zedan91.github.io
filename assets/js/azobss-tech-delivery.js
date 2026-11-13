(function () {
  'use strict';
  const api='https://azobss-backend.onrender.com/api';
  const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const fallback={name:'AZOBSS',address:'Tingkat 1, 30-1B, Jalan Pinggiran 2/2, Pinggiran Batu Caves, 68100 Batu Caves, Selangor, Malaysia',latitude:3.255498,longitude:101.694146,phone:'+601135600723',website:'https://www.azobss.com',
    hours:'Berdasarkan Tempahan / Sila Hubungi Terlebih Dahulu',instructions:'Urusan pembelian, pengambilan dan perkhidmatan adalah berdasarkan tempahan. Sila hubungi AZOBSS sebelum hadir.'};
  const money=n=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR'}).format(n);
  let config;
  async function getConfig(){
    if(!config)config=fetch(api+'/pc-shop/shipping-settings',{signal:AbortSignal.timeout(8000),cache:'no-store'})
      .then(async response=>{if(!response.ok)throw Error('Lokasi belum dapat dimuatkan.');return response.json();})
      .catch(()=>{config=null;return {location:fallback,pickup:true,delivery:true,places:false};});
    return config;
  }
  function locationCard(location=fallback,embed=false){
    const point=encodeURIComponent(location.latitude+','+location.longitude),phone=String(location.phone).replace(/[^+\d]/g,'');
    const link=(url,label)=>'<a class="az-pc-shop-btn" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>';
    return '<section class="az-tech-location"><strong>'+esc(location.name)+'</strong><p>'+esc(location.address||fallback.address)+
      '<br>'+esc(phone==='+601135600723'?'011-3560 0723':phone)+'<br>'+esc(location.hours)+'</p>'+
      '<p>'+esc(location.instructions)+'</p><div class="az-tech-actions">'+link(location.mapsListingUrl||'https://www.google.com/maps/search/?api=1&query='+point,'Buka Google Maps')+
      link('https://www.google.com/maps/dir/?api=1&destination='+point,'Dapatkan Arah')+link('tel:'+phone,'Hubungi AZOBSS')+
      link('https://wa.me/'+phone.replace(/^\+/,''),'WhatsApp')+link(location.website,'Website')+
      '<button type="button" class="az-pc-shop-btn" data-az-tech-copy="'+esc(location.address||fallback.address)+'">Salin alamat</button>'+
      '<button type="button" class="az-pc-shop-btn" data-az-tech-copy="'+esc(location.latitude+', '+location.longitude)+'">Salin koordinat</button></div><small role="status" data-az-tech-copy-status></small>'+
      (embed?'<iframe title="Lokasi AZOBSS di Google Maps" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q='+point+'&amp;z=17&amp;output=embed"></iframe>':'')+'</section>';
  }
  const mapsSearch=query=>query?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query):'https://www.google.com/maps/';
  const mapLink=p=>mapsSearch(p.latitude+','+p.longitude);
  function validPin(p){
    return p&&p.latitude!==''&&p.longitude!==''&&p.latitude!=null&&p.longitude!=null&&
      Math.abs(Number(p.latitude))<=90&&Math.abs(Number(p.longitude))<=180
      ?{latitude:Number(p.latitude),longitude:Number(p.longitude)}:null;
  }
  const checkout='<div id="azTechPickup" class="span-2" hidden><div data-az-pickup-location>'+locationCard()+'</div>'+
    '<label class="az-tech-pickup-slot">Cadangan waktu pengambilan (waktu Malaysia)<input id="azTechPickupSlot" type="datetime-local"></label>'+
    '<small>AZOBSS akan mengesahkan waktu pengambilan selepas menyemak pesanan.</small></div>'+
    '<div id="azTechDelivery" class="span-2 az-tech-location" hidden>'+
    '<p>Semakan caj penghantaran dibuat sebelum invois dikeluarkan.</p>'+
    '<details id="azTechPinPicker"><summary>Pin penghantaran <small>(pilihan)</small></summary>'+
    '<label for="azTechMapQuery">Cari lokasi</label><div class="az-tech-pin-row">'+
    '<input id="azTechMapQuery" type="search" maxlength="160" placeholder="Nama tempat, jalan atau poskod" autocomplete="off">'+
    '<button class="az-pc-shop-btn" id="azTechAddressSearch" type="button" hidden>Cari dalam borang</button>'+
    '<a class="az-pc-shop-btn" id="azTechMapsOpen" href="https://www.google.com/maps/" target="_blank" rel="noopener noreferrer">Cari di Google Maps ↗</a></div>'+
    '<div id="azTechAddressResults"></div>'+
    '<p>Pilih tempat atau letak pin di Google Maps. Tekan <strong>Kongsi → Salin pautan</strong>, kemudian tampal di sini.</p>'+
    '<label for="azTechMapLink">Pautan Google Maps</label><div class="az-tech-pin-row">'+
    '<input id="azTechMapLink" type="text" inputmode="url" maxlength="2048" placeholder="Tampal pautan Google Maps" autocomplete="off">'+
    '<button class="az-pc-shop-btn" id="azTechImportPin" type="button">Simpan pin</button></div>'+
    '<p id="azTechShippingNotice" role="status"></p></details>'+
    '<div class="az-tech-actions" id="azTechSavedPin" hidden><a id="azTechViewPin" target="_blank" rel="noopener noreferrer">Lihat pin disimpan ↗</a>'+
    '<button class="az-pc-shop-btn" id="azTechClearPin" type="button">Buang pin</button></div></div>';
  const savedPins=new WeakMap();
  function draftKey(uid){return uid?'azobss-tech-receiving:'+uid:'';}
  function attachCheckout(root,uid,headers,update){
    const get=id=>root.querySelector('#'+id),pickup=get('azTechPickup'),delivery=get('azTechDelivery');
    const pickupSlot=get('azTechPickupSlot');
    const address=get('azPcCustomerAddress'),picker=get('azTechPinPicker'),query=get('azTechMapQuery'),open=get('azTechMapsOpen');
    const search=get('azTechAddressSearch'),results=get('azTechAddressResults'),notice=get('azTechShippingNotice');
    const link=get('azTechMapLink'),importPin=get('azTechImportPin');
    const radios=[...root.querySelectorAll('input[name="azPcShipping"]')],key=draftKey(uid);
    const read=()=>{try{return key?JSON.parse(localStorage.getItem(key)||'null'):null;}catch{return null;}};
    const draft=read();
    if(draft){
      const match=radios.find(r=>r.value===draft.method);
      if(match)match.checked=true;
      if(typeof draft.address==='string')address.value=draft.address;
      if(typeof draft.pickupSlot==='string')pickupSlot.value=draft.pickupSlot;
      savedPins.set(root,validPin(draft));
    }
    const save=()=>{if(!key)return;try{localStorage.setItem(key,JSON.stringify({method:radios.find(r=>r.checked)?.value,address:address.value,pickupSlot:pickupSlot.value,...savedPins.get(root)}));}catch{}};
    const showPin=()=>{
      const value=pin(root),view=get('azTechViewPin');
      get('azTechSavedPin').hidden=!value;
      if(value)view.href=mapLink(value);else view.removeAttribute('href');
    };
    const setPin=(value,message)=>{
      value=validPin(value);
      savedPins.set(root,value);showPin();save();notice.textContent=message;
    };
    const refreshSearch=()=>{open.href=mapsSearch((query.value.trim()||address.value.trim()).slice(0,160));};
    const post=async(path,body,timeout)=>{
      const response=await fetch(api+'/pc-shop/'+path,{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},
        body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
      const data=await response.json();
      if(!response.ok||data.ok===false)throw Error(data.message||(response.status===401?'Sesi tamat. Log masuk semula untuk menyimpan pin.':'Perkhidmatan belum tersedia.'));
      return data;
    };
    let addressVersion=0,action=0;
    showPin();refreshSearch();
    address.addEventListener('input',()=>{
      addressVersion++;action++;results.replaceChildren();link.value='';
      setPin(null,pin(root)?'Alamat berubah. Pilih pin baharu jika perlu.':'');
      refreshSearch();
    });
    query.addEventListener('input',()=>{action++;results.replaceChildren();notice.textContent='';refreshSearch();});
    query.addEventListener('keydown',event=>{
      if(event.key!=='Enter')return;
      event.preventDefault();
      if(!search.hidden){if(!search.disabled)search.click();}else open.click();
    });
    link.addEventListener('input',()=>{action++;notice.textContent='';});
    link.addEventListener('keydown',event=>{
      if(event.key==='Enter'){event.preventDefault();if(!importPin.disabled)importPin.click();}
    });
    get('azTechClearPin').onclick=()=>{
      action++;results.replaceChildren();link.value='';setPin(null,'Pin dibuang.');picker.querySelector('summary').focus();
    };
    pickupSlot.addEventListener('input',save);
    radios.forEach(r=>r.addEventListener('change',()=>{action++;update();save();}));
    config=null;
    getConfig().then(value=>{
      if(!root.isConnected)return;
      const cfg=value;pickup.querySelector('[data-az-pickup-location]').innerHTML=locationCard(cfg.location,true);
      for(const [kind,enabled] of [['Pickup at AZOBSS',cfg.pickup],['Courier',cfg.delivery]]){
        const radio=radios.find(r=>r.value===kind);
        if(radio&&!enabled){radio.disabled=true;radio.closest('label').hidden=true;}
      }
      if(radios.some(r=>r.checked&&r.disabled))radios.find(r=>!r.disabled).checked=true;
      search.hidden=!cfg.places;
      if(cfg.subsidyEnabled)delivery.querySelector('p').textContent='Penghantaran Percuma untuk kawasan dan pesanan terpilih. Kelayakan dan caj akhir disahkan dalam sebut harga.';
      update();
    });
    search.onclick=async()=>{
      const term=(query.value.trim()||address.value.trim()).slice(0,160),id=++action,version=addressVersion;
      results.replaceChildren();
      if(term.length<5){notice.textContent='Masukkan sekurang-kurangnya 5 aksara lokasi.';return;}
      search.disabled=true;notice.textContent='Mencari lokasi…';
      try{
        const data=await post('shipping-addresses',{query:term},12000);
        if(id!==action||!root.isConnected)return;
        const places=Array.isArray(data.places)?data.places.filter(place=>validPin(place.pin)):[];
        notice.textContent=places.length?'Pilih hasil carian.':'Tiada padanan. Cuba cari di Google Maps.';
        for(const place of places){
          const button=document.createElement('button');button.type='button';button.className='az-pc-shop-btn';button.textContent=place.address;
          button.onclick=()=>{
            if(addressVersion!==version)return;
            action++;results.replaceChildren();link.value='';
            if(!address.value.trim())address.value=place.address;
            setPin(place.pin,'Pin penghantaran disimpan.');refreshSearch();
          };
          results.append(button);
        }
      }catch{if(id===action)notice.textContent='Carian dalam borang belum tersedia. Cuba cari di Google Maps.';}
      finally{search.disabled=false;}
    };
    importPin.onclick=async()=>{
      const url=link.value.trim(),id=++action;
      if(!url){notice.textContent='Tampal pautan yang disalin daripada Google Maps.';return;}
      importPin.disabled=true;notice.textContent='Menyemak pautan pin…';
      try{
        const data=await post('shipping-map-pin',{url},11000);
        if(id!==action||!root.isConnected)return;
        if(!validPin(data.pin))throw Error('Pin tidak dapat disahkan. Sila salin pautan pin yang baharu.');
        results.replaceChildren();link.value='';
        setPin(data.pin,'Pin penghantaran disimpan.');
      }catch(error){if(id===action)notice.textContent=error instanceof TypeError||error.name==='TimeoutError'?'Pin belum dapat disemak. Cuba lagi.':error.message;}
      finally{importPin.disabled=false;}
    };
  }
  function pin(root){return savedPins.get(root)||null;}
  function checkoutPin(root){
    const link=root.querySelector('#azTechMapLink');
    if(link?.value.trim()){
      root.querySelector('#azTechPinPicker').open=true;
      link.focus();
      throw Error('Tekan Simpan pin dahulu, atau kosongkan pautan untuk teruskan tanpa pin.');
    }
    return pin(root);
  }
  function orderDelivery(order){
    const d=order.delivery;
    if(!d)return '';
    if(d.pickupLocation){
      const state=order.status==='completed'?'Selesai':['cancelled','refunded'].includes(order.status)?'Dibatalkan':order.fulfillmentStatus==='ready-for-pickup'?'Sedia diambil':order.paymentStatus==='paid'?'Sedang disediakan':'Menunggu pengesahan';
      return '<div class="az-pc-shop-note"><strong>Ambil Sendiri · PERCUMA</strong><p>'+state+'</p>'+
        (d.pickupConfirmedSlot?'<p>Waktu disahkan: '+esc(d.pickupConfirmedSlot.replace('T',' '))+' (MYT)</p>':d.pickupRequestedSlot?'<p>Waktu dicadangkan: '+esc(d.pickupRequestedSlot.replace('T',' '))+' (MYT) · Menunggu pengesahan</p>':'')+locationCard(d.pickupLocation)+'</div>';
    }
    return '<div class="az-pc-shop-note"><strong>Penghantaran ke Alamat</strong><p>'+esc(d.address)+'</p>'+
      (d.state==='confirmed'?'<p>Caj penghantaran '+(d.charge===0?'PERCUMA':money(d.charge))+
        (d.subsidy>0?' · Penjimatan '+money(d.subsidy):'')+(d.km!=null?' · '+esc(Math.round(d.km*10)/10)+' km perjalanan':'')+'</p>':'<p>Caj penghantaran sedang disemak.</p>')+
      (d.carrierStatus?'<p>Status Lalamove '+esc(d.carrierStatus)+'</p>':'')+
      (d.trackingUrl?'<a class="az-pc-shop-btn" href="'+esc(d.trackingUrl)+'" target="_blank" rel="noopener noreferrer">Jejak penghantaran</a>':'')+'</div>';
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('[data-az-tech-copy]');
    if(!button)return;
    const status=button.closest('.az-tech-location').querySelector('[data-az-tech-copy-status]');
    try{await navigator.clipboard.writeText(button.dataset.azTechCopy);status.textContent='Disalin.';}
    catch{status.textContent='Salin maklumat ini: '+button.dataset.azTechCopy;}
  });
  window.AZOBSSTechDelivery={checkout,attachCheckout,pin:checkoutPin,orderDelivery};
  document.querySelectorAll('[data-tech-location]').forEach(el=>getConfig().then(cfg=>{el.innerHTML=locationCard(cfg.location,true);}));
}());
