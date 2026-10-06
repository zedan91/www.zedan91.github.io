'use strict';
const model=require('../assets/js/azobss-azdm-offer-model');
function createOfferHandler({getIdentity,readBody,send,saveOffer,getOffer,rateLimit}){
  return async(req,res,parsed)=>{
    if(!['/api/azdm/offers','/api/software-packages/catalog'].includes(parsed.pathname))return false;
    const reply=(status,body)=>send(res,status,JSON.stringify(body),'application/json',{'Cache-Control':'no-store'});
    if(parsed.pathname==='/api/software-packages/catalog'){
      if(req.method!=='GET'){reply(405,{ok:false,error:'GET diperlukan.'});return true;}
      try{const offer=await getOffer(String(parsed.query?.product_id||''));if(!offer?.enabled)throw Error();reply(200,{ok:true,offer,enabled:true});}
      catch{reply(404,{ok:false,error:'Pakej software belum tersedia. Simpan tetapan software pada server dahulu.'});}return true;
    }
    if(req.method!=='POST'){reply(405,{ok:false,error:'POST diperlukan.'});return true;}
    if(rateLimit(req,res,'azdm-offers',20,60000))return true;
    const owner=await getIdentity(req);if(!owner?.uid||owner.isAdmin!==true){reply(owner?.uid?403:401,{ok:false,error:'Tetapan pakej lesen hanya boleh disimpan oleh owner AZOBSS.'});return true;}
    let offer;
    try{const raw=await readBody(req);if(Buffer.byteLength(raw)>16000)throw new Error('Tetapan terlalu besar.');offer=model.normalize(JSON.parse(raw));}
    catch(e){reply(400,{ok:false,error:e.message||'Tetapan tidak sah.'});return true;}
    if(offer.fulfilment!=='azdm'){reply(400,{ok:false,error:'Sambungan ini khusus untuk tetapan serial AZDM.'});return true;}
    try{await saveOffer(offer,owner);reply(200,{ok:true,offer});}catch{reply(503,{ok:false,error:'Tetapan belum dapat disimpan pada server. Cuba semula.'});}
    return true;
  };
}
module.exports={createOfferHandler,model};
