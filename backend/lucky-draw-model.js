// Shared configuration and calendar rules. No credentials or participant data.
export const DEFAULTS=Object.freeze({
 titleMs:'Rezeki anda, giliran seterusnya.',titleEn:'Your next lucky moment.',
 subtitleMs:'Hadiah istimewa. Komuniti hebat. Sertai cabutan bulanan AZOBSS dan nantikan detik nama anda diumumkan.',
 subtitleEn:'Great prizes. An incredible community. Join the AZOBSS monthly draw and look forward to your winning moment.',
 badgeMs:'CABUTAN EKSKLUSIF AZOBSS',badgeEn:'THE AZOBSS GIVEAWAY',
 announcementMs:'',announcementEn:'',termsMs:'Khas untuk pembeli Liyabudun dengan bayaran disahkan pada akaun yang sama. Pembelian terdahulu yang sah diterima. Satu penyertaan bagi setiap akaun setiap bulan; lesen tambahan tidak menambah peluang. Pembelian dibatalkan, dipulangkan atau ujian tidak layak. Pemenang dipilih secara rawak daripada penyertaan yang layak dan dihubungi oleh AZOBSS. Pembelian bukan jaminan menang.',
 termsEn:'For Liyabudun customers with a verified payment on the same account. Valid previous purchases qualify. One entry per account per month; extra licences do not increase your chances. Cancelled, refunded and test purchases do not qualify. Winners are randomly selected from eligible entries and contacted by AZOBSS. A purchase does not guarantee a win.',
 theme:'emerald',accent:'#e8c878',registrationOpen:true,minParticipants:100,shareRequired:false,minShares:1,
 scheduleMode:'monthly',drawDay:0,drawHour:22,drawMinute:0,spinSeconds:6,
 soundEnabled:false,confettiEnabled:true,showParticipants:true,showHistory:true
});
export function validateSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Tetapan tidak sah.');
 const result={...DEFAULTS};
 for(const [key,raw] of Object.entries(value)){
  if(!Object.hasOwn(DEFAULTS,key))throw Error('Tetapan tidak dikenali: '+key);
  if(typeof DEFAULTS[key]==='boolean'){if(typeof raw!=='boolean')throw Error(key+' mesti boolean.');result[key]=raw;}
  else if(typeof DEFAULTS[key]==='number'){
   const bounds={minParticipants:[1,20000],minShares:[1,10],drawDay:[0,28],drawHour:[0,23],drawMinute:[0,59],spinSeconds:[3,20]}[key];
   if(!Number.isInteger(raw)||!bounds||raw<bounds[0]||raw>bounds[1])throw Error('Nilai '+key+' di luar julat.');result[key]=raw;
  }else{
   if(typeof raw!=='string')throw Error(key+' mesti teks.');const text=raw.trim();
   const maximum=key.startsWith('terms')?2000:key.startsWith('subtitle')?420:key.startsWith('announcement')?240:100;
   if(text.length>maximum||(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)))throw Error('Teks '+key+' terlalu panjang/tidak sah.');
   if(key==='theme'&&!['emerald','royal','midnight'].includes(text))throw Error('Tema tidak sah.');
   if(key==='scheduleMode'&&!['monthly','manual'].includes(text))throw Error('Jadual tidak sah.');
   if(key==='accent'&&!/^#[\da-f]{6}$/i.test(text))throw Error('Warna mestilah #RRGGBB.');
   if((key.startsWith('title')||key.startsWith('badge'))&&!text)throw Error('Tajuk/lencana diperlukan.');result[key]=text;
  }
 }
 // Retain legacy config fields for compatibility; sharing cannot bypass purchase eligibility.
 result.shareRequired=false;
 const oldMs='Satu penyertaan bagi setiap akaun. Pemenang akan dihubungi oleh AZOBSS. Tiada bayaran diperlukan untuk menyertai.';
 const oldEn='One entry per account. Winners will be contacted by AZOBSS. No purchase is required to enter.';
 if(result.termsMs===oldMs)result.termsMs=DEFAULTS.termsMs;
 if(result.termsEn===oldEn)result.termsEn=DEFAULTS.termsEn;
 return result;
}
export function malaysiaMonth(now=Date.now()){
 const date=new Date(Number(now)+8*3600000);return date.getUTCFullYear()+'-'+String(date.getUTCMonth()+1).padStart(2,'0');
}
export function scheduledAt(config,key=malaysiaMonth()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(key))throw Error('Bulan tidak sah.');
 if(config.scheduleMode!=='monthly')return null;
 const [year,month]=key.split('-').map(Number),day=config.drawDay||new Date(Date.UTC(year,month,0)).getUTCDate();
 return Date.UTC(year,month-1,day,config.drawHour-8,config.drawMinute,0);
}
export function nextScheduledAt(config,now=Date.now()){
 const key=malaysiaMonth(now),current=scheduledAt(config,key);if(current===null||current>=now)return current;
 const date=new Date(Number(now)+8*3600000);date.setUTCMonth(date.getUTCMonth()+1,1);
 return scheduledAt(config,malaysiaMonth(date.getTime()-8*3600000));
}
export function eligibleEntries(entries,key){
 const seen=new Set();return entries.filter(row=>{
  if(!row||row.deleted||row.monthKey!==key||!row.usernameKey)return false;
  const identity=row.uid?'uid:'+row.uid:'username:'+row.usernameKey;if(seen.has(identity))return false;seen.add(identity);return true;
 });
}
export function publicEntry(row){
 if(!row)return null;return {id:row.id,usernameKey:row.usernameKey,name:row.name||row.usernameKey,monthKey:row.monthKey,joinedAt:row.joinedAt,joinedAtMs:row.joinedAtMs,deleted:!!row.deleted};
}
export function publicWinner(row){
 if(!row)return null;return Object.fromEntries(['monthKey','monthName','usernameKey','name','participantTotal','selectedAtMs','selectedAt','selectedBy','method','drawId'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
}
