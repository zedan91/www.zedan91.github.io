'use strict';
const D=require('./azobss-tech-delivery');
const {resolveMapPin}=require('./azobss-delivery-map-link');
const {randomUUID}=require('node:crypto');
const {writeTransitionTx}=require('./azobss-pc-customer-notifications-v1538');

function createTechDelivery({getDb,getUserIdentity,getAdminIdentity,parseBody,json,provider=D.integration()}){
  const ref=db=>db.collection('settings').doc('pcShopDelivery');
  const packages=db=>db.collection('pcShopPackages');
  const carrierIndex=(db,id)=>db.collection('pcShopCarrierBookings').doc(id);
  async function settings(db,tx){
    if(!db)return D.DEFAULTS;
    const snapshot=await (tx?tx.get(ref(db)):ref(db).get());
    return snapshot.exists?D.normalizeSettings(snapshot.data()):D.DEFAULTS;
  }
  async function packageMap(db,items,tx){
    const ids=[...new Set(items.map(x=>x.productId))];
    const rows=await Promise.all(ids.map(id=>tx?tx.get(packages(db).doc(id)):packages(db).doc(id).get()));
    return Object.fromEntries(rows.flatMap((row,i)=>row.exists?[[ids[i],D.packageDetails(row.data())]]:[]));
  }
  function validateRequest(cfg,method,body){
    if(method===D.PICKUP){
      if(!cfg.pickup)D.fail('pickup_disabled','Pengambilan sendiri tidak tersedia.',409);
      return {customerAddress:'',deliveryPin:null,pickupLocation:cfg.location,pickupRequestedSlot:D.pickupSlot(body.pickupRequestedSlot),delivery:{state:'pickup',charge:0,subsidy:0}};
    }
    if(method!==D.COURIER)return {customerAddress:D.clean(body.customerAddress,500)};
    if(!cfg.delivery)D.fail('delivery_disabled','Penghantaran ke alamat tidak tersedia.',409);
    const address=D.clean(body.customerAddress,500);
    if(address.length<10)D.fail('courier_address_required','Masukkan alamat penghantaran lengkap.');
    return {customerAddress:address,deliveryPin:D.pin(body.deliveryPin),delivery:{state:'pending',charge:null,subsidy:0}};
  }
  async function submitDeliveryDetails(db,tx,row,uid,body,decide){
    if(row.uid!==uid||row.adminTrashed)D.fail('order_not_found','Permintaan tidak dijumpai.',404);
    if(row.invoiceNo||['cancelled','refunded','quote-declined'].includes(row.status))D.fail('request_closed','Permintaan ini telah ditutup.',409);
    if(row.deliveryDetailsPending!==true&&Number(row.deliveryDetailsFromQuoteVersion)===Number(body.quoteVersion)&&row.shippingMethod===body.shippingMethod)return {};
    if(row.deliveryDetailsPending!==true)D.fail('delivery_details_already_saved','Cara penerimaan telah disimpan.',409);
    if(!Number.isSafeInteger(body.quoteVersion)||body.quoteVersion<1)D.fail('quote_changed','Muat semula dan semak sebut harga terkini.',409);
    const approval=decide({...row,deliveryDetailsPending:false},uid,{action:'accept',quoteVersion:body.quoteVersion});
    const shippingMethod=body.shippingMethod;
    if(![D.PICKUP,D.COURIER].includes(shippingMethod))D.fail('delivery_method','Pilih penghantaran atau ambil sendiri.');
    const contact=body.checkoutContact;
    let customer={};
    let receivingBody=body;
    if(contact!==undefined){
      if(!contact||typeof contact!=='object'||Array.isArray(contact))D.fail('checkout_contact','Masukkan butiran hubungan yang lengkap.');
      const first=D.clean(contact.firstName,100),last=D.clean(contact.lastName,100);
      const email=D.clean(contact.email,180).toLowerCase();
      if(!first||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('@azobss.local'))
        D.fail('checkout_contact','Masukkan nama dan alamat e-mel yang sah.');
      const company=D.clean(contact.company,100);
      customer={customerName:[first,last].filter(Boolean).join(' '),customerEmail:email,...(company?{customerCompany:company}:{})};
      if(shippingMethod===D.COURIER){
        const street=D.clean(body.customerAddress,300),city=D.clean(contact.city,80),state=D.clean(contact.state,60),postcode=D.clean(contact.postcode,20);
        const states=new Set(['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Labuan','Putrajaya']);
        if(street.length<5||!city||!states.has(state)||!/^\d{5}$/.test(postcode))D.fail('checkout_address','Masukkan alamat, bandar, negeri dan poskod yang sah.');
        receivingBody={...body,customerAddress:[street,postcode+' '+city,state,'Malaysia'].join(', ')};
      }
    }
    const receiving=validateRequest(await settings(db,tx),shippingMethod,receivingBody);
    if(shippingMethod===D.PICKUP&&!receiving.pickupRequestedSlot)D.fail('pickup_slot','Pilih cadangan waktu pengambilan.');
    const phone=D.clean(body.customerPhone,60);
    if(!phone||!/^\+?[\d ()-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7)D.fail('delivery_phone','Masukkan nombor telefon untuk urusan pesanan.');
    const next={...receiving,...customer,shippingMethod,customerPhone:phone,deliveryDetailsPending:false,deliveryDetailsFromQuoteVersion:Number(row.quoteVersion),updatedAtMs:Date.now()};
    if(shippingMethod===D.PICKUP)return {...next,...approval};
    if(row.fixedDeliveryOffer){
      const offer=row.fixedDeliveryOffer;
      const total=D.rm(Number(row.confirmedItemTotal)+offer.charge);
      if(typeof body.acceptedTotal!=='number'||body.acceptedTotal!==total)
        D.fail('delivery_total_changed','Muat semula dan semak jumlah termasuk penghantaran sebelum bersetuju.',409);
      return {...next,...approval,shippingCharge:offer.charge,confirmedTotal:total,shippingConfirmationRequired:false,
        delivery:{state:'confirmed',source:'fixed',vehicle:offer.vehicle,charge:offer.charge,subsidy:0}};
    }
    return {...next,confirmedTotal:row.confirmedItemTotal,status:'quote-requested',shippingConfirmationRequired:true,priceConfirmed:false,priceConfirmationRequired:true,
      customerApproval:'pending',customerApprovedAtMs:0,customerApprovedQuoteVersion:0,quoteExpiresAtMs:0,
      quoteVersion:Number(row.quoteVersion)+1,statusHistory:[...(row.statusHistory||[]).slice(-19),{status:'quote-requested',by:'customer',atMs:next.updatedAtMs}]};
  }
  async function carrierQuote(db,row,body){
    const cfg=await settings(db);
    if(row.shippingMethod!==D.COURIER||!row.delivery||row.adminTrashed||row.invoiceNo||['cancelled','refunded'].includes(row.status))D.fail('shipping_order_closed','Quotation penghantaran tidak tersedia untuk rekod ini.',409);
    const map=await packageMap(db,row.items);
    const box=D.packing(row.items,map,body.measured);
    const vehicle=body.vehicle||Object.keys(D.VEHICLES).find(key=>box&&D.vehicleFits(key,box));
    if(!box||!vehicle||!D.vehicleFits(vehicle,box))D.fail('packing_required','Sahkan berat, ukuran bungkusan dan kenderaan yang sesuai.');
    const itemTotal=D.rm(body.itemTotal);
    const pin=row.deliveryPin;
    const [road,live]=await Promise.all([provider.roadKm(cfg.location,pin).catch(()=>null),body.source==='lalamove'&&pin?provider.quotation(cfg.location,{...pin,address:row.customerAddress},vehicle,box).catch(()=>null):null]);
    if(body.source==='lalamove'&&(!live||live.source!=='lalamove'))D.fail('carrier_rate_unavailable','Kadar produksi Lalamove belum tersedia. Semak harga sebenar dan gunakan quotation manual jika dibenarkan.',503);
    if(!live&&!cfg.manual)D.fail('manual_shipping_disabled','Quotation manual tidak diaktifkan.',409);
    if(!live&&body.confirmed!==true)D.fail('shipping_confirmation_required','Sahkan kos sebenar termasuk caj tambahan sebelum menyimpan.');
    const km=road??live?.km??(body.confirmed!==true||body.roadKm==null||body.roadKm===''?null:Number(body.roadKm));
    if(km!==null&&(!Number.isFinite(km)||km<0||km>10000))D.fail('invalid_road_distance','Jarak perjalanan tidak sah.');
    const now=Date.now();
    const priced=D.calculate(cfg,row.items,map,{itemTotal,cost:live?.cost??body.cost,km,vehicle});
    return {...priced,state:'confirmed',source:live?.source||'manual',id:live?.id||'',expiresAtMs:live?.expiresAtMs||now+86400000,itemTotal,measured:box,verifiedAtMs:now,
      origin:{latitude:cfg.location.latitude,longitude:cfg.location.longitude,address:cfg.location.address}};
  }
  async function fixedOffer(db,tx,row,vehicle){
    if(!Object.hasOwn(D.VEHICLES,vehicle))D.fail('delivery_vehicle_required','Pilih motor, kereta atau van untuk penghantaran.');
    const cfg=await settings(db,tx);
    if(!cfg.delivery)D.fail('delivery_disabled','Penghantaran ke alamat tidak tersedia.',409);
    const map=await packageMap(db,row.items||[],tx);
    const box=D.packing(row.items||[],map);
    const v=D.VEHICLES[vehicle];
    const known=(row.items||[]).map(item=>map[item.productId]).filter(Boolean);
    if(known.some(parcel=>!D.vehicleFits(vehicle,parcel))||
       (row.items||[]).reduce((sum,item)=>sum+(map[item.productId]?.kg||0)*item.qty,0)>v.kg||
       (box&&!D.vehicleFits(vehicle,box)))
      D.fail('packing_required','Bungkusan ini memerlukan kenderaan yang lebih besar.');
    return {vehicle,charge:D.rm(cfg.fixedDelivery[vehicle])};
  }
  async function applyQuote(db,tx,row,body){
    if(!row.delivery)return body;
    if(row.shippingMethod===D.PICKUP)return {...body,shippingCharge:0,shippingCost:0,shippingConfirmed:true};
    if(row.invoiceNo)return {...body,shippingCost:row.shippingCost,shippingCharge:row.shippingCharge};
    if(!body.publishQuote&&!body.issueInvoice&&!body.convertToOrder)return {...body,shippingCost:row.shippingCost,shippingCharge:row.shippingCharge};
    if(body.publishQuote===true&&body.stockConfirmed!==true)return body;
    if(!body.publishQuote&&row.customerApproval!=='accepted')return {...body,shippingCharge:row.shippingCharge,shippingCost:row.shippingCost};
    const rate=row.deliveryRate;
    if(!rate||rate.expiresAtMs<=Date.now())D.fail('shipping_quote_expired','Sahkan quotation penghantaran yang masih sah dahulu.',409);
    const itemTotal=D.rm(body.confirmedItemTotal??row.confirmedItemTotal);
    const cfg=await settings(db,tx);
    const map=await packageMap(db,row.items,tx);
    if(!cfg.delivery||!['latitude','longitude','address'].every(key=>cfg.location[key]===rate.origin?.[key]))D.fail('shipping_origin_changed','Lokasi atau tetapan penghantaran berubah. Sahkan semula kadar.',409);
    const computed=D.calculate(cfg,row.items,map,{...rate,itemTotal});
    if(!D.vehicleFits(rate.vehicle,D.packing(row.items,map,rate.measured)))D.fail('packing_required','Sahkan ukuran dan kenderaan sekali lagi.',409);
    if(rate.itemTotal!==itemTotal||computed.charge!==rate.charge||computed.subsidy!==rate.subsidy)D.fail('shipping_quote_changed','Harga item atau kelayakan subsidi berubah. Sahkan quotation penghantaran sekali lagi.',409);
    if(!body.publishQuote&&(row.shippingCharge!==rate.charge||row.delivery?.subsidy!==rate.subsidy))D.fail('shipping_quote_changed','Caj penghantaran berubah. Terbitkan sebut harga baharu dahulu.',409);
    return {...body,shippingCharge:rate.charge,shippingCost:rate.cost,shippingConfirmed:true};
  }
  async function book(db,doc,body){
    if(!provider.booking)D.fail('carrier_booking_disabled','Tempahan Lalamove belum diaktifkan.',503);
    if(body.approved!==true)D.fail('carrier_approval_required','Sahkan tempahan rider dahulu.');
    const snapshot=await doc.get(),row=snapshot.data();
    if(!snapshot.exists||row.adminTrashed||row.shippingMethod!==D.COURIER||!row.deliveryPin||!row.invoiceNo||row.paymentStatus!=='paid'||['cancelled','refunded','completed','delivered'].includes(row.status))D.fail('carrier_payment_required','Pesanan berbayar dan pin penghantaran diperlukan.',409);
    if(row.carrierBooking?.id)return row.carrierBooking;
    if(row.carrierBooking)D.fail('carrier_reconcile','Semak tempahan sedia ada di Lalamove sebelum membuat tempahan lain.',409);
    const cfg=await settings(db),vehicle=row.delivery?.vehicle,box=row.deliveryRate?.measured;
    if(!cfg.delivery||!cfg.location.address||!vehicle||!box||!D.vehicleFits(vehicle,box))D.fail('carrier_address_required','Sahkan alamat premis dan bungkusan dahulu.',409);
    const fresh=await provider.quotation(cfg.location,{...row.deliveryPin,address:row.customerAddress},vehicle,box).catch(()=>null);
    if(!fresh||fresh.source!=='lalamove'||fresh.stopIds.length!==2||fresh.stopIds.some(id=>!id))D.fail('carrier_rate_unavailable','Quotation Lalamove tidak tersedia.',503);
    if(!Number.isFinite(row.shippingCost)||fresh.cost>row.shippingCost)D.fail('carrier_rate_changed','Kos rider meningkat. Semak quotation dan kelulusan kos sebelum membuat tempahan.',409);
    const requestId=randomUUID(),pending={requestId,state:'pending',createdAtMs:Date.now(),quoteId:fresh.id};
    const reserved=await db.runTransaction(async tx=>{
      const latest=await tx.get(doc),current=latest.data();
      if(!latest.exists||current.updatedAtMs!==row.updatedAtMs||current.paymentStatus!=='paid'||current.carrierBooking)D.fail('carrier_order_changed','Pesanan atau tempahan telah berubah.',409);
      tx.set(doc,{carrierBooking:pending,updatedAtMs:Date.now()},{merge:true});
      return pending;
    });
    let booking;
    try{booking=await provider.book(fresh,cfg.location,row,reserved.requestId);}
    catch{
      await doc.set({carrierBooking:{...pending,state:'reconcile'},updatedAtMs:Date.now()},{merge:true});
      D.fail('carrier_reconcile','Keputusan tempahan belum pasti. Semak portal Lalamove menggunakan ID permintaan sebelum meneruskan.',502);
    }
    const result={...pending,...booking,state:'booked'};
    await db.runTransaction(async tx=>{
      tx.set(doc,{carrierBooking:result,courier:'Lalamove',trackingNumber:result.id,updatedAtMs:Date.now()},{merge:true});
      tx.set(carrierIndex(db,result.id),{orderId:row.orderId});
    });
    return result;
  }
  async function storeTracking(db,doc,update,updatedAtMs){
    return db.runTransaction(async tx=>{
      const row=(await tx.get(doc)).data();
      if(row?.carrierBooking?.id!==update.id)return null;
      if(updatedAtMs&&Number(row.carrierBooking.eventAtMs||0)>=updatedAtMs)return row.carrierBooking;
      const booking={...row.carrierBooking,...update,link:update.link||row.carrierBooking.link||'',eventAtMs:updatedAtMs||row.carrierBooking.eventAtMs||0};
      const patch={carrierBooking:booking,updatedAtMs:Date.now()};
      const status={PICKED_UP:'in-transit',COMPLETED:'delivered'}[update.status];
      if(status&&row.paymentStatus==='paid'&&!['cancelled','refunded','completed','delivered'].includes(row.status)){
        patch.status=status;
        patch.fulfillmentStatus=status;
      }
      tx.set(doc,patch,{merge:true});
      writeTransitionTx(db,tx,row,{...row,...patch},'carrier');
      return booking;
    });
  }
  async function receiveWebhook(req,res,path){
    const event=await parseBody(req);
    if(event&&Object.keys(event).length===0)return json(res,200,{ok:true});
    if(!provider.webhook?.(path,event))return json(res,403,{ok:false,error:'invalid_carrier_signature'});
    const order=event.data.order;
    const at=Date.parse(event.data.updatedAt);
    if(!/^\d{1,100}$/.test(order?.orderId||'')||!Number.isFinite(at))return json(res,200,{ok:true});
    const db=getDb();
    if(!db)return json(res,503,{ok:false,error:'firestore_unavailable'});
    const index=(await carrierIndex(db,order.orderId).get()).data();
    if(index?.orderId&&order.status)await storeTracking(db,db.collection('pcShopOrders').doc(index.orderId),D.carrierOrder({data:order}),at);
    return json(res,200,{ok:true});
  }
  async function handle(req,res,parsed){
    const path=parsed.pathname,method=req.method;
    const settingsPath=path==='/api/admin/pc-shop/shipping-settings';
    const packageMatch=path.match(/^\/api\/admin\/pc-shop\/shipping-packages\/([a-zA-Z0-9_.-]{1,160})$/);
    const quoteMatch=path.match(/^\/api\/admin\/pc-shop\/shipping-quotes\/([-a-zA-Z0-9_]{1,120})$/);
    const bookingMatch=path.match(/^\/api\/admin\/pc-shop\/shipping-bookings\/([-a-zA-Z0-9_]{1,120})$/);
    const publicSettings=path==='/api/pc-shop/shipping-settings'&&method==='GET';
    const addressLookup=path==='/api/pc-shop/shipping-addresses'&&method==='POST';
    const pinLookup=path==='/api/pc-shop/shipping-map-pin'&&method==='POST';
    const webhook=path==='/api/pc-shop/lalamove-webhook'&&method==='POST';
    if(method==='OPTIONS'||!(settingsPath||packageMatch||quoteMatch||bookingMatch||publicSettings||addressLookup||pinLookup||webhook))return false;
    try{
      if(webhook)return await receiveWebhook(req,res,path);
      const admin=publicSettings||addressLookup||pinLookup?null:await getAdminIdentity(req,parsed);
      if(!publicSettings&&!addressLookup&&!pinLookup&&!admin?.isAdmin)return json(res,403,{ok:false,error:'admin_required'});
      if((addressLookup||pinLookup)&&!(await getUserIdentity(req))?.uid)return json(res,401,{ok:false,error:'login_required'});
      if(pinLookup){
        const body=await parseBody(req);
        return json(res,200,{ok:true,pin:await resolveMapPin(body?.url)});
      }
      const db=getDb();
      if(!db)return json(res,503,{ok:false,error:'firestore_unavailable'});
      if(publicSettings){
        const cfg=await settings(db);
        return json(res,200,{ok:true,location:cfg.location,pickup:cfg.pickup,delivery:cfg.delivery,subsidyEnabled:cfg.subsidyEnabled,places:provider.maps,fixedDelivery:cfg.delivery?cfg.fixedDelivery:null});
      }
      if(addressLookup){
        const body=await parseBody(req),query=D.clean(body?.query,160);
        if(query.length<5)D.fail('address_query','Masukkan sekurang-kurangnya 5 aksara.');
        const cfg=await settings(db);
        if(!cfg.delivery||!provider.maps)return json(res,200,{ok:true,places:[]});
        return json(res,200,{ok:true,places:await provider.addresses(query,cfg.location)});
      }
      if(settingsPath&&method==='GET')return json(res,200,{ok:true,settings:await settings(db),providers:{places:provider.maps,lalamove:provider.lalamove,booking:provider.booking},vehicles:D.VEHICLES});
      if(settingsPath&&method==='PUT'){
        const body=await parseBody(req);
        if(!body||typeof body.settings!=='object'||!body.settings)D.fail('invalid_settings','Tetapan diperlukan.');
        const cfg=D.normalizeSettings(body.settings);
        await db.runTransaction(async tx=>{
          const before=await settings(db,tx);
          const fields=Object.keys(cfg).filter(key=>JSON.stringify(before[key])!==JSON.stringify(cfg[key]));
          tx.set(ref(db),cfg);
          if(fields.length)tx.set(db.collection('pcShopDeliveryAudit').doc(randomUUID()),{
            atMs:Date.now(),by:admin.uid||admin.username||admin.email||'admin',action:'shipping-settings',fields
          });
        });
        return json(res,200,{ok:true,settings:cfg});
      }
      if(packageMatch){
        const doc=packages(db).doc(packageMatch[1]);
        if(method==='GET'){
          const record=await doc.get();
          return json(res,200,{ok:true,package:record.exists?record.data():null});
        }
        if(method==='PUT'){
          const value=D.packageDetails(await parseBody(req));
          await doc.set(value);
          return json(res,200,{ok:true,package:value});
        }
      }
      if(quoteMatch&&method==='POST'){
        const doc=db.collection('pcShopOrders').doc(quoteMatch[1]),snap=await doc.get();
        if(!snap.exists)D.fail('order_not_found','Permintaan tidak dijumpai.',404);
        const body=await parseBody(req);
        if(!body)D.fail('invalid_json','Quotation diperlukan.');
        const row=snap.data(),rate=await carrierQuote(db,row,body);
        await db.runTransaction(async tx=>{
          const latest=await tx.get(doc),order=latest.data();
          if(!latest.exists||order.invoiceNo||order.adminTrashed||order.updatedAtMs!==row.updatedAtMs)D.fail('shipping_order_changed','Pesanan berubah. Muat semula dan cuba lagi.',409);
          tx.set(doc,{deliveryRate:rate,updatedAtMs:Date.now()},{merge:true});
        });
        return json(res,200,{ok:true,rate});
      }
      if(bookingMatch&&method==='POST'){
        const doc=db.collection('pcShopOrders').doc(bookingMatch[1]),body=await parseBody(req);
        if(!body)D.fail('invalid_json','Arahan tempahan diperlukan.');
        if(body.refresh===true){
          const row=(await doc.get()).data();
          if(!row?.carrierBooking?.id||provider.lalamove!=='production')D.fail('carrier_order_missing','Tempahan Lalamove belum tersedia.',404);
          const update=await provider.track(row.carrierBooking.id);
          const booking=await storeTracking(db,doc,update);
          if(!booking)D.fail('carrier_order_changed','Tempahan telah berubah.',409);
          return json(res,200,{ok:true,booking});
        }
        return json(res,200,{ok:true,booking:await book(db,doc,body)});
      }
      return json(res,405,{ok:false,error:'method_not_allowed'});
    }catch(err){
      return json(res,err.status||503,{ok:false,error:err.code||'shipping_unavailable',message:err.code?err.message:'Perkhidmatan penghantaran belum tersedia. Semak secara manual.'});
    }
  }
  return {settings,validateRequest,submitDeliveryDetails,fixedOffer,applyQuote,handle};
}
module.exports={createTechDelivery};
