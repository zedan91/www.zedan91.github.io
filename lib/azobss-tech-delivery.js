'use strict';

const {createHmac,randomUUID,timingSafeEqual}=require('node:crypto');

const PICKUP='Pickup at AZOBSS';
const COURIER='Courier';
const VEHICLES={
  motorcycle:{kg:10,cm:[40,40,40],min:500,cap:15},
  car:{kg:40,cm:[50,50,50],min:500,cap:25},
  van:{kg:500,cm:[170,100,120],min:2000,cap:50}
};
const DEFAULTS={
  location:{name:'AZOBSS',address:'Tingkat 1, 30-1B, Jalan Pinggiran 2/2, Pinggiran Batu Caves, 68100 Batu Caves, Selangor, Malaysia',mapsListingUrl:'',latitude:3.255498,longitude:101.694146,phone:'+601135600723',website:'https://www.azobss.com',
    hours:'Berdasarkan Tempahan / Sila Hubungi Terlebih Dahulu',instructions:'Urusan pembelian, pengambilan dan perkhidmatan adalah berdasarkan tempahan. Sila hubungi AZOBSS sebelum hadir.'},
  pickup:true,delivery:true,manual:true,subsidyEnabled:false,maxKm:10,marginReserve:0,marginShare:0,
  minCharge:0,maxCharge:0,categories:[],vehicles:Object.fromEntries(Object.entries(VEHICLES).map(([k,v])=>[k,{min:v.min,cap:v.cap}]))
};
const clean=(v,max)=>String(v??'').trim().slice(0,max);
function fail(code,message,status=400){throw Object.assign(new Error(message),{code,status});}
function number(value,max,min=0){
  const n=Number(value);
  if(value===''||value==null||typeof value==='boolean'||!Number.isFinite(n)||n<min||n>max)fail('invalid_shipping_value','Masukkan nilai penghantaran yang sah.');
  return n;
}
const rm=value=>Math.round(number(value,1e7)*100)/100;
function pin(raw){
  if(raw==null)return null;
  return {latitude:number(raw.latitude,90,-90),longitude:number(raw.longitude,180,-180)};
}
function pickupSlot(value){
  const slot=clean(value,32);
  if(!slot)return '';
  const localTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  const time=new Date(slot+'Z');
  if(!localTime.test(slot)||!Number.isFinite(time.getTime())||time.toISOString().slice(0,16)!==slot)
    fail('pickup_slot','Pilih tarikh dan masa pengambilan yang sah (waktu Malaysia).');
  return slot;
}
function listingUrl(value){
  const text=clean(value,2048);
  if(!text)return '';
  let url;
  try{url=new URL(text);}catch{}
  if(url?.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(
    (url.hostname==='maps.app.goo.gl'&&/^\/[a-zA-Z0-9_-]{5,100}\/?$/.test(url.pathname))||
    (['www.google.com','maps.google.com','www.google.com.my'].includes(url.hostname)&&/^\/maps\/place\/[^/]+/.test(url.pathname))
  ))return url.href;
  fail('pickup_listing','Gunakan pautan Kongsi daripada profil perniagaan Google Maps yang sudah disahkan.');
}
function normalizeSettings(raw={}){
  const location={...DEFAULTS.location,...raw.location};
  const address=clean(location.address,400)||DEFAULTS.location.address,phone=clean(location.phone,20);
  if(address&&(!/\bTingkat\s+1\b/i.test(address)||address.length<18))fail('pickup_address','Alamat penuh mesti menyertakan Tingkat 1.');
  if(!/^\+60\d{8,10}$/.test(phone))fail('pickup_phone','Gunakan nombor telefon format +60.');
  let website;
  try {website=new URL(location.website);} catch {fail('pickup_website','Masukkan URL HTTPS yang sah.');}
  if(website.protocol!=='https:'||website.username||website.password)fail('pickup_website','Masukkan URL HTTPS yang sah.');
  const result={
    location:{...pin(location),name:clean(location.name,60)||'AZOBSS',address,phone,mapsListingUrl:listingUrl(location.mapsListingUrl),website:website.href,hours:clean(location.hours,150),instructions:clean(location.instructions,400)},
    pickup:raw.pickup!==false,delivery:raw.delivery!==false,manual:raw.manual!==false,subsidyEnabled:raw.subsidyEnabled===true,
    maxKm:number(raw.maxKm??10,100),marginReserve:rm(raw.marginReserve??0),marginShare:number(raw.marginShare??0,100),
    minCharge:rm(raw.minCharge??0),maxCharge:rm(raw.maxCharge??0),
    categories:[...new Set((Array.isArray(raw.categories)?raw.categories:[]).slice(0,150).map(x=>clean(x,80).toLowerCase()).filter(Boolean))],
    vehicles:Object.fromEntries(Object.entries(DEFAULTS.vehicles).map(([k,v])=>[k,{min:rm(raw.vehicles?.[k]?.min??v.min),cap:rm(raw.vehicles?.[k]?.cap??v.cap)}]))
  };
  if(result.maxCharge&&result.minCharge>result.maxCharge)fail('shipping_range','Caj minimum melebihi caj maksimum.');
  return result;
}
function packageDetails(raw){
  if(!raw||typeof raw!=='object')fail('package_required','Masukkan berat dan dimensi bungkusan sebenar.');
  return {kg:number(raw.kg,1000,0.001),length:number(raw.length,500,0.1),width:number(raw.width,500,0.1),height:number(raw.height,500,0.1),
    type:clean(raw.type,80),fragile:raw.fragile===true,handling:clean(raw.handling,200),eligible:raw.eligible===true};
}
function vehicleFits(key,box){
  const v=VEHICLES[key];
  const sorted=values=>values.slice().sort((a,b)=>a-b);
  return !!v&&box.kg<=v.kg&&sorted([box.length,box.width,box.height]).every((n,i)=>n<=sorted(v.cm)[i])&&(key!=='motorcycle'||!box.fragile&&!box.handling);
}
function packing(items,packages,measured){
  const units=items.flatMap(item=>Array.from({length:item.qty},()=>packages[item.productId]||null));
  if(!units.length)return null;
  if(measured){
    const box=packageDetails(measured);
    if(units.every(Boolean)&&box.kg+0.001<units.reduce((sum,x)=>sum+x.kg,0))fail('package_weight','Berat gabungan kurang daripada jumlah berat item.');
    const measuredDimensions=[box.length,box.width,box.height].sort((a,b)=>a-b);
    if(units.some(x=>x&&[x.length,x.width,x.height].sort((a,b)=>a-b).some((n,i)=>n>measuredDimensions[i])))fail('package_size','Ukuran gabungan lebih kecil daripada bungkusan produk.');
    return {...box,fragile:box.fragile||units.some(x=>x?.fragile),handling:box.handling||units.find(x=>x?.handling)?.handling||''};
  }
  if(units.some(x=>!x))return null;
  // Each prepacked carton rests flat on the same stack. Only height adds up.
  const dimensions=units.map(x=>[x.length,x.width,x.height].sort((a,b)=>b-a));
  return {kg:units.reduce((sum,x)=>sum+x.kg,0),length:Math.max(...dimensions.map(x=>x[0])),width:Math.max(...dimensions.map(x=>x[1])),
    height:dimensions.reduce((sum,x)=>sum+x[2],0),fragile:units.some(x=>x.fragile),handling:units.find(x=>x.handling)?.handling||''};
}
function calculate(settings,items,packages,{itemTotal,cost,km,vehicle}){
  const subtotal=rm(itemTotal),actual=rm(cost),rule=settings.vehicles[vehicle];
  const knownCosts=items.length>0&&items.every(x=>Number.isFinite(x.unitCost)&&x.unitCost>0&&Number.isInteger(x.qty)&&x.qty>0);
  const margin=knownCosts?subtotal-items.reduce((sum,x)=>sum+x.unitCost*x.qty,0):0;
  const eligible=settings.subsidyEnabled&&rule&&subtotal>=rule.min&&Number.isFinite(km)&&km>=0&&km<=settings.maxKm&&knownCosts&&
    items.every(x=>packages[x.productId]?.eligible&&settings.categories.includes(String(x.category||'').toLowerCase()));
  const budget=Math.max(0,Math.min(margin-settings.marginReserve,margin*settings.marginShare/100));
  const subsidy=eligible?Math.floor(Math.min(actual,rule.cap,budget)*100+1e-7)/100:0;
  const charge=rm(actual-subsidy);
  if((charge>0&&charge<settings.minCharge)||(settings.maxCharge&&charge>settings.maxCharge))fail('shipping_outside_limits','Caj penghantaran di luar had. Semak tetapan atau quotation.');
  return {cost:actual,subsidy,charge,km:Number.isFinite(km)?km:null,vehicle};
}
async function providerJson(fetcher,url,options){
  const response=await fetcher(url,{...options,signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error('Provider unavailable');
  return response.json();
}
function integration(env=process.env,fetcher=fetch){
  const maps=env.PC_SHIPPING_GOOGLE_MAPS_KEY;
  const mode=env.PC_SHIPPING_LALAMOVE_MODE;
  const live=mode==='production'&&!!env.PC_SHIPPING_LALAMOVE_KEY&&!!env.PC_SHIPPING_LALAMOVE_SECRET;
  const sandbox=mode==='sandbox'&&!!env.PC_SHIPPING_LALAMOVE_KEY&&!!env.PC_SHIPPING_LALAMOVE_SECRET;
  const serviceTypes={motorcycle:env.PC_SHIPPING_LALAMOVE_MOTORCYCLE,car:env.PC_SHIPPING_LALAMOVE_CAR,van:env.PC_SHIPPING_LALAMOVE_VAN};
  async function carrier(method,path,data,requestId=randomUUID()){
    const ts=String(Date.now()),body=data?JSON.stringify({data}):'';
    const signature=createHmac('sha256',env.PC_SHIPPING_LALAMOVE_SECRET).update(ts+'\r\n'+method+'\r\n'+path+'\r\n\r\n'+body).digest('hex');
    return providerJson(fetcher,(live?'https://rest.lalamove.com':'https://rest.sandbox.lalamove.com')+path,{method,
      headers:{'Content-Type':'application/json',Authorization:'hmac '+env.PC_SHIPPING_LALAMOVE_KEY+':'+ts+':'+signature,Market:'MY','Request-ID':requestId},
      ...(body?{body}:{})});
  }
  return {
    maps:!!maps,lalamove:live?'production':sandbox?'sandbox':'off',booking:live&&env.PC_SHIPPING_LALAMOVE_BOOKING==='1',
    webhook(path,event,now=Date.now()){
      if(!live||event?.apiKey!==env.PC_SHIPPING_LALAMOVE_KEY||!event.data||!/^[0-9a-f]{64}$/i.test(event.signature||''))return false;
      const stamp=Number(event.timestamp);
      const at=stamp<1e12?stamp*1000:stamp;
      if(!Number.isFinite(at)||at>now+300000||at<now-86400000)return false;
      const signed=[String(event.timestamp),'POST',path,'',JSON.stringify(event.data)].join('\n');
      const expected=createHmac('sha256',env.PC_SHIPPING_LALAMOVE_SECRET).update(signed).digest();
      return timingSafeEqual(expected,Buffer.from(event.signature,'hex'));
    },
    async addresses(query,location){
      if(!maps) return [];
      const result=await providerJson(fetcher,'https://places.googleapis.com/v1/places:searchText',{method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':maps,'X-Goog-FieldMask':'places.formattedAddress,places.location'},
        body:JSON.stringify({textQuery:query,regionCode:'MY',pageSize:5,locationBias:{circle:{center:{latitude:location.latitude,longitude:location.longitude},radius:25000}}})});
      return (result.places||[]).slice(0,5).flatMap(p=>p.location&&p.formattedAddress?[{address:clean(p.formattedAddress,500),pin:pin(p.location)}]:[]);
    },
    async roadKm(from,to){
      if(!maps||!to)return null;
      const waypoint=({latitude,longitude})=>({location:{latLng:{latitude,longitude}}});
      const result=await providerJson(fetcher,'https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',
        headers:{'Content-Type':'application/json','X-Goog-Api-Key':maps,'X-Goog-FieldMask':'routes.distanceMeters'},
        body:JSON.stringify({origin:waypoint(from),destination:waypoint(to),travelMode:'DRIVE'})});
      const distance=result.routes?.[0]?.distanceMeters;
      return Number.isFinite(distance)&&distance>=0?distance/1000:null;
    },
    async quotation(from,to,vehicle,box){
      if(!(live||sandbox)||!serviceTypes[vehicle]||!to)return null;
      const stop=({latitude,longitude,address})=>({coordinates:{lat:String(latitude),lng:String(longitude)},...(address?{address}:{})});
      const result=await carrier('POST','/v3/quotations',{serviceType:serviceTypes[vehicle],stops:[stop(from),stop(to)],language:'en_MY',
        ...(box.fragile?{item:{quantity:'1',handlingInstructions:['FRAGILE']}}:{})});
      const data=result.data,expiresAtMs=Date.parse(data?.expiresAt);
      if(!data?.quotationId||data.priceBreakdown?.currency!=='MYR'||!(expiresAtMs>Date.now()))return null;
      const meters=data.distance?.unit==='m'?Number(data.distance.value):NaN;
      return {id:clean(data.quotationId,100),expiresAtMs,cost:rm(data.priceBreakdown.total),source:live?'lalamove':'sandbox',
        stopIds:(data.stops||[]).map(x=>clean(x.stopId,100)),km:Number.isFinite(meters)&&meters>=0?meters/1000:null};
    },
    async book(quote,from,row,requestId){
      if(!this.booking||quote.stopIds.length!==2||quote.stopIds.some(id=>!id))throw Error('Booking unavailable');
      const phone=String(row.customerPhone||'').replace(/[^+\d]/g,'').replace(/^0/,'+60').replace(/^60/,'+60');
      const result=await carrier('POST','/v3/orders',{quotationId:quote.id,
        sender:{stopId:quote.stopIds[0],name:from.name,phone:from.phone},
        recipients:[{stopId:quote.stopIds[1],name:row.customerName,phone}],metadata:{azobssOrderId:row.orderId}},requestId);
      return carrierOrder(result);
    },
    async track(id){return carrierOrder(await carrier('GET','/v3/orders/'+encodeURIComponent(id)));}
  };
}
function carrierOrder(result){
  const data=result?.data;
  if(!/^\d{1,100}$/.test(String(data?.orderId||'')))throw Error('Carrier order unavailable');
  let link='';
  try{
    const url=new URL(data.shareLink);
    if(url.protocol==='https:'&&url.hostname==='share.lalamove.com')link=url.href;
  }catch{}
  return {id:clean(data.orderId,100),status:clean(data.status,60),link};
}
function customerDelivery(row){
  if(!row.delivery)return undefined;
  const {state,charge,subsidy,km,vehicle,expiresAtMs}=row.delivery;
  return {state,charge,subsidy,km:km??null,vehicle:vehicle||'',expiresAtMs:expiresAtMs||0,
    address:row.shippingMethod===COURIER?row.customerAddress||'':'',pickupLocation:row.pickupLocation||null,pickupRequestedSlot:row.pickupRequestedSlot||'',pickupConfirmedSlot:row.pickupConfirmedSlot||'',
    trackingUrl:row.carrierBooking?.link||'',carrierStatus:row.carrierBooking?.id?row.carrierBooking.status:''};
}
module.exports={PICKUP,COURIER,VEHICLES,DEFAULTS,normalizeSettings,pickupSlot,pin,packageDetails,vehicleFits,packing,calculate,integration,customerDelivery,carrierOrder,fail,rm,clean};
