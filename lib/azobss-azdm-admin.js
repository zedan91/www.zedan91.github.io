'use strict';
const ACTIONS=new Set(['list','issue','update','reset','revoke','restore','orders','order-email-retry']);
function createAzdmAdminHandler({getAdminIdentity,readBody,send,rateLimit,env=process.env,fetchImpl=globalThis.fetch}) {
  const reply=(res,status,body)=>send(res,status,JSON.stringify(body),'application/json; charset=utf-8',{'Cache-Control':'no-store'});
  return async function handleAzdmAdmin(req,res,parsed) {
    if(!parsed.pathname.startsWith('/api/azdm/admin/'))return false;
    const action=parsed.pathname.slice('/api/azdm/admin/'.length);
    if(!ACTIONS.has(action)){reply(res,404,{ok:false,error:'Tindakan tidak ditemui.'});return true;}
    if(req.method!=='POST'){reply(res,405,{ok:false,error:'POST diperlukan.'});return true;}
    if(rateLimit(req,res,'azdm-admin-'+action,['list','orders'].includes(action)?60:20,60000))return true;
    try {
      // Owner permission comes from the existing server allow-list and verified
      // Firebase token, never from browser role/name or submitted admin keys.
      const identity=await getAdminIdentity(req);
      if(!identity?.uid){reply(res,401,{ok:false,error:'Sila sign in sebagai admin AZOBSS.'});return true;}
      if(identity.isAdmin!==true){reply(res,403,{ok:false,error:'Akses pengurusan lesen AZDM terhad kepada admin yang dibenarkan.'});return true;}
      const token=env.AZDM_ADMIN_TOKEN||'';
      if(token.length<32||token.length>400){reply(res,503,{ok:false,error:'Sambungan admin AZDM belum ditetapkan. Gunakan panel asal AZDM sementara ini.'});return true;}
      const raw=await readBody(req);
      if(Buffer.byteLength(raw)>8192){reply(res,413,{ok:false,error:'Permintaan terlalu besar.'});return true;}
      const body=JSON.parse(raw);
      if(!body||Array.isArray(body)||typeof body!=='object'){reply(res,400,{ok:false,error:'Maklumat tidak sah.'});return true;}
      const origin=new URL(env.AZDM_LICENSE_URL||'https://azdm-license.zedan9107.workers.dev');
      if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('Invalid license origin');
      const response=await fetchImpl(origin.origin+'/admin/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});
      const result=await response.json();
      reply(res,response.status,response.ok?{...result,ok:true}:{ok:false,error:result.error||'Servis lesen belum tersedia.'});
    }catch(error){reply(res,error instanceof SyntaxError?400:503,{ok:false,error:error instanceof SyntaxError?'Maklumat tidak sah.':'Servis lesen belum tersedia. Cuba semula sebentar lagi.'});}
    return true;
  };
}
module.exports={createAzdmAdminHandler};
