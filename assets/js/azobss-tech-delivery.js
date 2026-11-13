(function () {
  'use strict';
  const api='https://azobss-backend.onrender.com/api';
  const esc=value=>String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const fallback={name:'AZOBSS',address:'',latitude:3.255498,longitude:101.694146,phone:'+601135600723',website:'https://www.azobss.com',
    hours:'Berdasarkan Tempahan / Sila Hubungi Terlebih Dahulu',instructions:'Pengambilan sendiri adalah berdasarkan tempahan. Sila hubungi AZOBSS terlebih dahulu sebelum hadir.'};
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
    return '<section class="az-tech-location"><strong>'+esc(location.name)+'</strong><p>'+esc(location.address||'Tingkat 1')+
      '<br>Batu Caves / Gombak, Selangor, Malaysia<br>'+esc(phone==='+601135600723'?'011-3560 0723':phone)+'<br>'+esc(location.hours)+'</p>'+
      '<p>'+esc(location.instructions)+'</p><div class="az-tech-actions">'+link('https://www.google.com/maps/search/?api=1&query='+point,'Buka Google Maps')+
      link('https://www.google.com/maps/dir/?api=1&destination='+point,'Dapatkan Arah')+link('tel:'+phone,'Hubungi AZOBSS')+
      link('https://wa.me/'+phone.replace(/^\+/,''),'WhatsApp')+link(location.website,'Website')+'</div>'+
      (embed?'<iframe title="Lokasi AZOBSS di Google Maps" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q='+point+'&amp;z=17&amp;output=embed"></iframe>':'')+'</section>';
  }
  const checkout='<div id="azTechPickup" class="span-2" hidden></div><div id="azTechDelivery" class="span-2 az-tech-location" hidden>'+
    '<p>Semakan caj penghantaran dibuat sebelum invois dikeluarkan.</p><button class="az-pc-shop-btn" id="azTechAddressSearch" type="button" hidden>Cari alamat di Google Maps</button>'+
    '<div id="azTechAddressResults"></div><p id="azTechShippingNotice" role="status"></p>'+
    '<details><summary>Pin penghantaran (pilihan)</summary><div class="az-tech-actions">'+
    '<label>Latitud<input id="azTechLatitude" type="number" min="-90" max="90" step="any"></label>'+
    '<label>Longitud<input id="azTechLongitude" type="number" min="-180" max="180" step="any"></label></div></details></div>';
  function draftKey(uid){return uid?'azobss-tech-receiving:'+uid:'';}
  function attachCheckout(root,uid,headers,update){
    const pickup=root.querySelector('#azTechPickup'),delivery=root.querySelector('#azTechDelivery');
    const address=root.querySelector('#azPcCustomerAddress'),lat=root.querySelector('#azTechLatitude'),lng=root.querySelector('#azTechLongitude');
    const radios=[...root.querySelectorAll('input[name="azPcShipping"]')],key=draftKey(uid);
    const read=()=>{try{return key?JSON.parse(localStorage.getItem(key)||'null'):null;}catch{return null;}};
    const draft=read();
    if(draft){
      const match=radios.find(r=>r.value===draft.method);
      if(match)match.checked=true;
      if(typeof draft.address==='string')address.value=draft.address;
      lat.value=draft.latitude??'';lng.value=draft.longitude??'';
    }
    const save=()=>{if(!key)return;try{localStorage.setItem(key,JSON.stringify({method:radios.find(r=>r.checked)?.value,address:address.value,latitude:lat.value,longitude:lng.value}));}catch{}};
    const search=root.querySelector('#azTechAddressSearch');
    root.addEventListener('input',e=>{
      if(e.target===address){
        lat.value='';lng.value='';
        root.querySelector('#azTechAddressResults').replaceChildren();
        root.querySelector('#azTechShippingNotice').textContent='';
      }
      if([address,lat,lng].includes(e.target))save();
    });
    radios.forEach(r=>r.addEventListener('change',()=>{update();save();}));
    config=null;
    getConfig().then(cfg=>{
      if(!root.isConnected)return;
      pickup.innerHTML=locationCard(cfg.location,true);
      for(const [method,enabled] of [['Pickup at AZOBSS',cfg.pickup],['Courier',cfg.delivery]]){
        const radio=radios.find(r=>r.value===method);
        if(radio&&!enabled){radio.disabled=true;radio.closest('label').hidden=true;}
      }
      if(radios.some(r=>r.checked&&r.disabled))radios.find(r=>!r.disabled).checked=true;
      search.hidden=!cfg.places;
      if(cfg.subsidyEnabled)delivery.querySelector('p').textContent='Penghantaran Percuma untuk kawasan dan pesanan terpilih. Kelayakan dan caj akhir disahkan dalam sebut harga.';
      update();
    });
    search.onclick=async()=>{
      const notice=root.querySelector('#azTechShippingNotice'),results=root.querySelector('#azTechAddressResults');
      const query=address.value.trim();
      results.replaceChildren();
      if(query.length<5){notice.textContent='Masukkan sekurang-kurangnya 5 aksara alamat.';return;}
      search.disabled=true;
      try{
        const response=await fetch(api+'/pc-shop/shipping-addresses',{method:'POST',headers:{...await headers(),'Content-Type':'application/json'},
          body:JSON.stringify({query}),signal:AbortSignal.timeout(12000)});
        const data=await response.json();
        if(!response.ok)throw Error(data.message||'Carian tidak tersedia.');
        if(address.value.trim()!==query)return;
        notice.textContent=data.places.length?'Pilih alamat penghantaran.':'Tiada padanan. Masukkan alamat penuh secara manual.';
        for(const place of data.places){
          const button=document.createElement('button');button.type='button';button.className='az-pc-shop-btn';button.textContent=place.address;
          button.onclick=()=>{address.value=place.address;lat.value=place.pin.latitude;lng.value=place.pin.longitude;results.replaceChildren();notice.textContent='Pin penghantaran disimpan.';save();};
          results.append(button);
        }
      }catch(err){notice.textContent=err.message;}
      finally{search.disabled=false;}
    };
  }
  function pin(root){
    const latitude=root.querySelector('#azTechLatitude'),longitude=root.querySelector('#azTechLongitude');
    if(!latitude?.value&&!longitude?.value)return null;
    if(!latitude.value||!longitude.value||!latitude.validity.valid||!longitude.validity.valid)throw Error('Masukkan latitud dan longitud yang sah.');
    return {latitude:Number(latitude.value),longitude:Number(longitude.value)};
  }
  function orderDelivery(order){
    const d=order.delivery;
    if(!d)return '';
    if(d.pickupLocation){
      const state=order.fulfillmentStatus==='ready-for-pickup'?'Sedia diambil':order.status==='completed'?'Selesai':order.status==='cancelled'?'Dibatalkan':order.paymentStatus==='paid'?'Sedang disediakan':order.priceConfirmed?'Disahkan':'Menunggu pengesahan';
      return '<div class="az-pc-shop-note"><strong>Ambil Sendiri · PERCUMA</strong><p>'+state+'</p>'+
        (state==='Sedia diambil'?'<p>Sila hubungi AZOBSS untuk waktu pengambilan.</p>':'')+locationCard(d.pickupLocation)+'</div>';
    }
    return '<div class="az-pc-shop-note"><strong>Penghantaran ke Alamat</strong><p>'+esc(d.address)+'</p>'+
      (d.state==='confirmed'?'<p>Caj penghantaran '+(d.charge===0?'PERCUMA':money(d.charge))+
        (d.subsidy>0?' · Penjimatan '+money(d.subsidy):'')+(d.km!=null?' · '+esc(Math.round(d.km*10)/10)+' km perjalanan':'')+'</p>':'<p>Caj penghantaran sedang disemak.</p>')+
      (d.carrierStatus?'<p>Status Lalamove '+esc(d.carrierStatus)+'</p>':'')+
      (d.trackingUrl?'<a class="az-pc-shop-btn" href="'+esc(d.trackingUrl)+'" target="_blank" rel="noopener noreferrer">Jejak penghantaran</a>':'')+'</div>';
  }
  window.AZOBSSTechDelivery={checkout,attachCheckout,pin,orderDelivery};
  document.querySelectorAll('[data-tech-location]').forEach(el=>getConfig().then(cfg=>{el.innerHTML=locationCard(cfg.location,true);}));
}());
