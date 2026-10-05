'use strict';
// AZDM purchase bridge: the browser supplies a Firebase token; only this server
// sends the private integration credential and verified account email to D1.
const PATHS = new Set(['/api/azdm/catalog', '/api/azdm/checkout', '/api/azdm/status', '/api/azdm/orders']);
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const SUPPORT = {email:'zedan9107@gmail.com', whatsapp:'601135600723', website:'https://www.azobss.com/?azdmSupport=1'};
const PLANS = [
  {id:'annual', name:'AZDM 1 Tahun', days:365, amount_cents:2500},
  {id:'lifetime', name:'AZDM Lifetime', days:0, amount_cents:5000, bulk_minimum:2, bulk_unit_cents:4000}
];
function createAzdmHandler({getIdentity, getOffer, readBody, send, rateLimit, env=process.env, fetchImpl=globalThis.fetch, localShop=null}) {
  const reply = (res,status,data) => send(res,status,JSON.stringify(data),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  return async function handleAzdm(req,res,parsed) {
    const path=parsed.pathname;
    if(!PATHS.has(path))return false;
    if(req.method!==(path==='/api/azdm/checkout'?'POST':'GET')) {reply(res,405,{ok:false,error:'Kaedah permintaan tidak sah.'});return true;}
    if(rateLimit(req,res,'azdm-'+path, path.endsWith('/checkout')?10:60,60000))return true;
    let offer;
    if(path.endsWith('/catalog')&&getOffer){
      try{offer=await getOffer(String(parsed.query?.product_id||'AZDM'));if(!offer?.enabled||offer.fulfilment!=='azdm')throw Error();}
      catch{reply(res,404,{ok:false,error:'Pakej lesen belum tersedia.'});return true;}
    }
    const serviceToken=String(env.AZDM_SHOP_SERVICE_TOKEN||'').trim();
    const useLocalShop=!!(localShop&&typeof localShop==='object');
    if(!useLocalShop&&!/^[a-f0-9]{64}$/.test(serviceToken)) {
      reply(res,path.endsWith('/catalog')?200:503,path.endsWith('/catalog')?{ok:true,enabled:false,offer,plans:PLANS,support:SUPPORT}:{ok:false,error:'Pembelian lesen belum dibuka. Hubungi support AZDM.'});return true;
    }
    try {
      const action=path.slice('/api/azdm/'.length);
      let body={};
      if(action!=='catalog') {
        const identity=await getIdentity(req);
        if(!identity?.uid) {reply(res,401,{ok:false,error:'Sila sign in ke akaun AZOBSS.'});return true;}
        if(identity.emailVerified!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email||'')||identity.email.endsWith('.local')) {
          reply(res,403,{ok:false,error:'Akaun anda sudah login, tetapi alamat email sebenar belum disahkan dalam akaun AZOBSS.'});return true;
        }
        body={account_uid:identity.uid};
        if(action==='checkout') {
          const raw=await readBody(req);
          if(Buffer.byteLength(raw)>8192) {reply(res,413,{ok:false,error:'Permintaan terlalu besar.'});return true;}
          const data=JSON.parse(raw);
          if((getOffer?!/^[-A-Za-z0-9_]{1,40}$/.test(data.plan||''):!['annual','lifetime'].includes(data.plan))||!Number.isInteger(data.quantity)||data.quantity<1||data.quantity>100||!UUID.test(data.request_id||'')) {
            reply(res,400,{ok:false,error:'Pilih pakej dan bilangan PC antara 1 hingga 100.'});return true;
          }
          // Ignore browser-supplied email, name, amount and user identifier.
          body={...body,product_id:data.plan,software_id:String(data.software_id||'AZDM').slice(0,100),quantity:data.quantity,request_id:data.request_id,
            customer:String(identity.name||identity.email).slice(0,120),email:identity.email,phone:String(identity.phone||'')};
          if(getOffer){
            try{const config=await getOffer(String(data.software_id||'AZDM'));if(config.fulfilment!=='azdm')throw Error();body.trusted_quote=require('./azobss-azdm-offers').model.quote(config,data.plan,data.quantity);}
            catch{reply(res,400,{ok:false,error:'Pakej atau bilangan PC tidak sah. Muatkan pilihan pakej semula.'});return true;}
          }
        }
        if(action==='status') {
          if(!UUID.test(parsed.query.azdm_order||'')) {reply(res,404,{ok:false,error:'Pesanan tidak ditemui.'});return true;}
          body.order_id=parsed.query.azdm_order;
        }
      }
      if(useLocalShop){
        const fn=localShop[action];
        if(typeof fn!=='function'){reply(res,503,{ok:false,error:'Servis pembelian AZDM belum tersedia.'});return true;}
        const data=await fn({req,parsed,body,offer,plans:PLANS,support:SUPPORT});
        const status=Number(data&&data.statusCode)||200;
        const payload=data&&data.body&&typeof data.body==='object'?data.body:(data||{});
        reply(res,status,{...payload,...(offer?{offer}:{}),ok:status>=200&&status<300&&(payload.ok!==false)});
        return true;
      }
      const origin=new URL(env.AZDM_LICENSE_URL||'https://azdm-license.zedan9107.workers.dev');
      if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error('Invalid license URL');
      const response=await fetchImpl(origin.origin+'/integration/'+action,{method:'POST',headers:{Authorization:'Bearer '+serviceToken,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});
      const data=await response.json();
      if(!response.ok) {reply(res,response.status,{ok:false,error:data.error||'Servis lesen belum tersedia.'});return true;}
      reply(res,200,{...data,...(offer?{offer}:{}),ok:true});
    } catch(error) {
      reply(res,error instanceof SyntaxError?400:503,{ok:false,error:error instanceof SyntaxError?'Maklumat pesanan tidak sah.':'Servis lesen belum tersedia. Cuba semula atau hubungi support.'});
    }
    return true;
  };
}
module.exports={createAzdmHandler};
