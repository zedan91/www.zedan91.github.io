(function () {
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=(name,text,value,type='text')=>'<label>'+text+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(type==='number'?'step="any"':'')+'></label>';
  const check=(name,text,value)=>'<label class="az-tech-check"><input type="checkbox" name="'+name+'" '+(value?'checked':'')+'> '+text+'</label>';
  const vehicles={motorcycle:'Motosikal',car:'Kereta',van:'Van'};
  const vehicleOptions='<option value="">Pilih automatik</option>'+Object.entries(vehicles).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
  const packingFields=(b={})=>label('kg','Berat (kg)',b.kg,'number')+label('length','Panjang (cm)',b.length,'number')+
    label('width','Lebar (cm)',b.width,'number')+label('height','Tinggi (cm)',b.height,'number');
  const readPacking=f=>({kg:f.kg.value,length:f.length.value,width:f.width.value,height:f.height.value});
  function request(api,headers){
    return async (path,method='GET',body)=>{
      const res=await fetch(api+'/api/admin/pc-shop/'+path,{method,headers:await headers(),
        ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000),cache:'no-store'});
      const data=await res.json();
      if(!res.ok||!data.ok)throw Error(data.message||data.error||'Permintaan gagal.');
      return data;
    };
  }
  function pane(title){
    const dialog=document.createElement('dialog');
    dialog.className='az-tech-admin-dialog';
    dialog.innerHTML='<div class="az-tech-actions"><h3>'+title+'</h3><button type="button" data-close class="az-pc-admin-btn">Tutup</button></div><p role="status"></p><div data-body></div>';
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.showModal();
    return {dialog,notice:dialog.querySelector('[role=status]'),body:dialog.querySelector('[data-body]')};
  }
  async function settings(api,headers){
    const call=request(api,headers),{notice,body}=pane('Shipping & Pickup Settings');
    notice.textContent='Memuatkan tetapan…';
    try{
      const data=await call('shipping-settings'),s=data.settings,l=s.location;
      notice.textContent='Lalamove '+data.providers.lalamove+' · Google Places '+(data.providers.places?'aktif':'belum dikonfigurasi');
      body.innerHTML='<form class="az-tech-admin-grid"><h4>Lokasi pengambilan</h4>'+
        label('name','Nama paparan',l.name)+label('address','Alamat penuh termasuk Tingkat 1',l.address)+
        label('latitude','Latitud',l.latitude,'number')+label('longitude','Longitud',l.longitude,'number')+
        label('phone','Telefon (+60)',l.phone)+label('website','Website',l.website,'url')+
        label('hours','Waktu',l.hours)+label('instructions','Arahan pengambilan',l.instructions)+
        '<h4>Penghantaran</h4>'+check('pickup','Ambil sendiri',s.pickup)+check('delivery','Penghantaran ke alamat',s.delivery)+
        check('manual','Benarkan quotation manual',s.manual)+check('subsidyEnabled','Aktifkan subsidi',s.subsidyEnabled)+
        label('maxKm','Had perjalanan (km)',s.maxKm,'number')+label('marginReserve','Margin minimum disimpan (RM)',s.marginReserve,'number')+
        label('marginShare','Had subsidi daripada margin (%)',s.marginShare,'number')+
        label('minCharge','Caj minimum berbayar (RM)',s.minCharge,'number')+label('maxCharge','Caj maksimum (0 = tiada had)',s.maxCharge,'number')+
        label('categories','Kategori layak, pisahkan dengan koma',s.categories.join(', '))+
        Object.entries(s.vehicles).map(([k,v])=>label(k+'Min',vehicles[k]+' minimum (RM)',v.min,'number')+label(k+'Cap',vehicles[k]+' subsidi maksimum (RM)',v.cap,'number')).join('')+
        '<button class="az-pc-admin-btn" type="submit">Preview perubahan</button><div data-preview hidden></div></form>'+
        '<hr><h4>Ukuran bungkusan produk</h4><form class="az-tech-admin-grid" data-package>'+label('sku','Product ID','')+
        '<button class="az-pc-admin-btn" data-load-package type="button">Muatkan rekod</button>'+packingFields()+label('type','Jenis produk','')+
        label('handling','Pengendalian khas','')+check('fragile','Fragile',false)+check('eligible','Layak dipertimbangkan untuk subsidi',false)+
        '<button class="az-pc-admin-btn" type="submit">Simpan ukuran</button></form>';
      const form=body.querySelector('form'),preview=form.querySelector('[data-preview]');
      form.oninput=()=>{preview.hidden=true;preview.replaceChildren();};
      form.onsubmit=e=>{
        e.preventDefault();const f=form.elements;
        const cfg={location:Object.fromEntries(Object.keys(l).map(key=>[key,f.namedItem(key).value])),
          ...Object.fromEntries(['pickup','delivery','manual','subsidyEnabled'].map(key=>[key,f[key].checked])),
          ...Object.fromEntries(['maxKm','marginReserve','marginShare','minCharge','maxCharge'].map(key=>[key,f[key].value])),
          categories:f.categories.value.split(',').map(x=>x.trim()).filter(Boolean),
          vehicles:Object.fromEntries(Object.keys(vehicles).map(key=>[key,{min:f[key+'Min'].value,cap:f[key+'Cap'].value}]))};
        preview.hidden=false;
        preview.innerHTML='<p>'+esc(cfg.location.name)+' · '+esc(cfg.location.address||'Tingkat 1, Batu Caves / Gombak')+
          '<br>'+esc(cfg.location.latitude)+', '+esc(cfg.location.longitude)+' · '+esc(cfg.location.phone)+
          '<br>'+esc(cfg.location.hours)+'<br>'+esc(cfg.location.instructions)+'</p><p>'+
          [cfg.pickup?'Ambil sendiri':'',cfg.delivery?'Penghantaran':'',cfg.manual?'Quotation manual':''].filter(Boolean).join(' · ')+
          '<br>Subsidi '+(cfg.subsidyEnabled?'aktif':'belum aktif')+' · '+esc(cfg.maxKm)+' km · margin minimum RM'+esc(cfg.marginReserve)+' · had '+esc(cfg.marginShare)+'%'+
          '<br>Julat caj RM'+esc(cfg.minCharge)+'–'+(Number(cfg.maxCharge)?'RM'+esc(cfg.maxCharge):'tiada had')+
          '<br>Kategori '+esc(cfg.categories.join(', ')||'Tiada')+'</p><ul>'+
          Object.entries(cfg.vehicles).map(([k,v])=>'<li>'+vehicles[k]+' · minimum RM'+esc(v.min)+' · had RM'+esc(v.cap)+'</li>').join('')+
          '</ul><button type="button" class="az-pc-admin-btn">Simpan tetapan</button>';
        preview.querySelector('button').onclick=async e=>{
          const button=e.currentTarget;button.disabled=true;
          try{await call('shipping-settings','PUT',{settings:cfg});notice.textContent='Tetapan disimpan.';preview.hidden=true;}
          catch(err){notice.textContent=err.message;}
          finally{button.disabled=false;}
        };
      };
      const pkg=body.querySelector('[data-package]'),f=pkg.elements;
      const packagePath=()=>{if(!/^[a-zA-Z0-9_.-]{1,160}$/.test(f.sku.value.trim()))throw Error('Masukkan Product ID yang sah.');return 'shipping-packages/'+encodeURIComponent(f.sku.value.trim());};
      pkg.querySelector('[data-load-package]').onclick=async()=>{
        try{const b=(await call(packagePath())).package;for(const key of ['kg','length','width','height','type','handling'])f[key].value=b?.[key]??'';
          for(const key of ['fragile','eligible'])f[key].checked=b?.[key]===true;
          notice.textContent=b?'Rekod dimuatkan.':'Belum ada rekod ukuran.';
        }catch(err){notice.textContent=err.message;}
      };
      pkg.onsubmit=async e=>{
        e.preventDefault();const button=e.submitter;button.disabled=true;
        try{await call(packagePath(),'PUT',{...readPacking(f),type:f.type.value,handling:f.handling.value,fragile:f.fragile.checked,eligible:f.eligible.checked});notice.textContent='Ukuran bungkusan disimpan.';}
        catch(err){notice.textContent=err.message;}
        finally{button.disabled=false;}
      };
    }catch(err){notice.textContent=err.message;}
  }
  async function quote(api,headers,order,card){
    const call=request(api,headers),{dialog,body,notice}=pane('Semak quotation penghantaran');
    const saved=order.deliveryRate||{};
    body.innerHTML='<p>'+esc(order.customerAddress)+(order.deliveryPin?' · '+esc(order.deliveryPin.latitude)+', '+esc(order.deliveryPin.longitude):'')+'</p>'+
      '<form class="az-tech-admin-grid"><label>Kenderaan<select name="vehicle">'+vehicleOptions+'</select></label>'+
      '<label>Sumber<select name="source"><option value="manual">Quotation manual</option><option value="lalamove">Lalamove produksi</option></select></label>'+
      label('cost','Kos sebenar termasuk caj tambahan (RM)',saved.cost,'number')+
      label('roadKm','Jarak jalan raya disahkan jika Routes tiada (km)',saved.km,'number')+
      '<h4>Ukuran gabungan sebenar (pilihan jika produk telah diukur)</h4>'+packingFields(saved.measured)+
      check('fragile','Fragile',saved.measured?.fragile)+label('handling','Pengendalian khas',saved.measured?.handling)+
      check('confirmed','Saya telah sahkan kos manual termasuk tol dan surcaj',false)+
      '<button class="az-pc-admin-btn" type="submit">Semak dan simpan kadar</button></form>';
    const form=body.querySelector('form'),f=form.elements;
    f.vehicle.value=saved.vehicle||'';
    form.onsubmit=async e=>{
      e.preventDefault();const button=e.submitter;button.disabled=true;
      try{
        const measured=readPacking(f),some=Object.values(measured).some(Boolean);
        const input={vehicle:f.vehicle.value,source:f.source.value,cost:f.cost.value,roadKm:f.roadKm.value,confirmed:f.confirmed.checked,
          itemTotal:card.querySelector('[data-f="confirmedItemTotal"]').value,
          ...(some?{measured:{...measured,fragile:f.fragile.checked,handling:f.handling.value}}:{})};
        const {rate}=await call('shipping-quotes/'+encodeURIComponent(order.orderId),'POST',input);
        card.querySelector('[data-f="shippingCharge"]').value=rate.charge;
        card.querySelector('[data-f="shippingCost"]').value=rate.cost;
        const confirmed=card.querySelector('[data-f="shippingConfirmed"]');if(confirmed)confirmed.checked=true;
        const state=card.querySelector('[data-delivery-rate-status]');
        if(state)state.textContent='Caj pelanggan RM'+rate.charge.toFixed(2)+' · subsidi RM'+rate.subsidy.toFixed(2)+' · sah hingga '+new Date(rate.expiresAtMs).toLocaleString('ms-MY');
        dialog.close();
      }catch(err){notice.textContent=err.message;}
      finally{button.disabled=false;}
    };
  }
  async function booking(api,headers,order,button){
    const refresh=!!order.carrierBooking?.id;
    if(!refresh&&!confirm('Tempah rider Lalamove untuk pesanan berbayar ini?'))return;
    button.disabled=true;
    try{
      const {booking:record}=await request(api,headers)('shipping-bookings/'+encodeURIComponent(order.orderId),'POST',refresh?{refresh:true}:{approved:true});
      alert('Lalamove '+record.id+' · '+record.status);
      return true;
    }catch(err){alert(err.message);return false;}
    finally{button.disabled=false;}
  }
  window.AZOBSSTechDeliveryAdmin={settings,quote,booking};
}());
