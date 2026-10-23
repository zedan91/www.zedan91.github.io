'use strict';
const ACTIONS=new Set(['list','issue','import-legacy','block','restore']);
const ORIGIN='https://solattime-license.zedan9107.workers.dev';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

function payloadFor(action,body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SyntaxError();
  if(action==='list'){
    const limit=body.limit??25,offset=body.offset??0;
    if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>1000000)throw new SyntaxError();
    return {limit,offset};
  }
  if(action==='issue'||action==='import-legacy'){
    if(typeof body.customer!=='string'||!body.customer.trim()||body.customer.length>120)throw new SyntaxError();
    const result={customer:body.customer.trim()};
    if(action==='import-legacy'){
      if(typeof body.serial!=='string'||body.serial.length>80)throw new SyntaxError();
      result.serial=body.serial.trim().toUpperCase();
      if(!/^AZST-(?:[A-F0-9]{4}-){4}[A-F0-9]{4}$/.test(result.serial))throw new SyntaxError();
    }
    return result;
  }
  if(typeof body.license_id!=='string'||!UUID.test(body.license_id))throw new SyntaxError();
  return {license_id:body.license_id};
}

function createSolatTimeAdminHandler({getAdminIdentity,readBody,send,rateLimit,env=process.env,fetchImpl=globalThis.fetch}){
  const reply=(res,status,value)=>send(res,status,JSON.stringify(value),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  return async function handleSolatTimeAdmin(req,res,parsed){
    const prefix='/api/solattime/admin/';
    if(!parsed.pathname.startsWith(prefix))return false;
    const action=parsed.pathname.slice(prefix.length);
    if(!ACTIONS.has(action)){reply(res,404,{ok:false,error:'Tindakan SolatTime tidak ditemui.'});return true;}
    if(req.method!=='POST'){reply(res,405,{ok:false,error:'POST diperlukan.'});return true;}
    if(rateLimit(req,res,'solattime-admin-'+action,action==='list'?60:20,60000))return true;
    try{
      const identity=await getAdminIdentity(req);
      if(!identity?.uid){reply(res,401,{ok:false,error:'Sila sign in sebagai admin AZOBSS.'});return true;}
      if(identity.isAdmin!==true){reply(res,403,{ok:false,error:'Akses pengurusan lesen SolatTime terhad kepada admin yang dibenarkan.'});return true;}
      const token=String(env.SOLATTIME_ADMIN_TOKEN||'').trim();
      if(token.length<32||token.length>400){reply(res,503,{ok:false,error:'Sambungan pengurusan SolatTime belum tersedia. Gunakan panel asal SolatTime sementara ini.'});return true;}
      const raw=await readBody(req);
      if(Buffer.byteLength(raw)>8192){reply(res,413,{ok:false,error:'Permintaan terlalu besar.'});return true;}
      const payload=payloadFor(action,JSON.parse(raw));
      const response=await fetchImpl(ORIGIN+'/admin/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(25000)});
      const data=await response.json();
      // Return only the actual public admin fields, never upstream headers/debug data.
      if(!response.ok){
        const errors={already_registered:'Serial lama ini sudah didaftarkan.',legacy_key_required:'Masukkan serial SolatTime lama yang sah.',invalid_customer:'Nama pelanggan tidak sah.',not_found:'Lesen tidak ditemui.'};
        reply(res,response.status,{ok:false,error:errors[data?.error]||'Servis lesen SolatTime belum tersedia. Cuba semula sebentar lagi.'});
      }else if(action==='list'){
        if(!Array.isArray(data.licenses))throw Error('Invalid response');
        const licenses=data.licenses.map(item=>({id:item.id,customer:item.customer,source:item.source,status:item.status,generation:item.generation,created:item.created,device_count:item.device_count}));
        const offset=data.next_offset;
        if(offset!==null&&(!Number.isInteger(offset)||offset<0||offset>1000000))throw Error('Invalid pagination');
        reply(res,200,{ok:true,licenses,next_offset:offset});
      }else if(action==='issue'){
        if(!UUID.test(data.license_id||'')||!/^AZST-(?:[A-Z2-7]{5}-){5}[A-Z2-7]{5}$/.test(data.serial||''))throw Error('Invalid response');
        reply(res,200,{ok:true,license_id:data.license_id,serial:data.serial});
      }else reply(res,200,{ok:true});
    }catch(error){reply(res,error instanceof SyntaxError?400:503,{ok:false,error:error instanceof SyntaxError?'Maklumat SolatTime tidak sah.':'Servis lesen SolatTime belum tersedia. Semak status sebelum mencuba tindakan sekali lagi.'});}
    return true;
  };
}
module.exports={createSolatTimeAdminHandler};
