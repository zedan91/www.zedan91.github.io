import {DEFAULTS,validateSettings,scheduledAt,malaysiaMonth} from '/backend/lucky-draw-model.js';
const $=id=>document.getElementById(id),bridge=window.azLuckyBridge;
if(!bridge)throw Error('Lucky Draw integration unavailable');
let saved={...DEFAULTS},config={...DEFAULTS},revision=0,ready=false,loading=false,saving=false,preview=false,sound=false;
let spinning=false,testSpin=false,wheelNames=[],animation=null,audio=null,lastWheelKey='',alive=true,confettiTimer=null;
const dialog=$('ld-settings'),form=$('ld-settings-form'),canvas=$('ld-wheel'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
// The prize editor has its own validated requests; its hidden URL/file inputs
// must not block configuration submits. validateSettings checks all config fields.
form.noValidate=true;
const en=()=>bridge.state().language==='en';
const text=(id,ms,english)=>{if($(id))$(id).textContent=en()?english:ms;};
function status(message,error=false){$('ld-settings-status').textContent=message;$('ld-settings-status').classList.toggle('error',error);}
function paint(){
 const state=bridge.state(),english=en(),total=state.total||0,deadline=scheduledAt(config,malaysiaMonth()),closed=!!state.winner||!config.registrationOpen||(deadline!==null&&Date.now()>=deadline);
 document.body.dataset.ldTheme=config.theme;document.body.style.setProperty('--ld-accent',config.accent);
 $('ld-title').textContent=config[english?'titleEn':'titleMs'];$('ld-intro').textContent=config[english?'subtitleEn':'subtitleMs'];$('ld-campaign-badge').textContent=config[english?'badgeEn':'badgeMs'];
 $('ld-edition').textContent=new Intl.DateTimeFormat(english?'en-MY':'ms-MY',{timeZone:'Asia/Kuala_Lumpur',month:'short',year:'numeric'}).format(new Date()).toUpperCase();
 const announcement=config[english?'announcementEn':'announcementMs'];$('ld-announcement').hidden=!announcement;$('ld-announcement').textContent=announcement;
 $('ld-terms').textContent=config[english?'termsEn':'termsMs'];
 text('ld-hero-join','Sertai cabutan ↗','Enter the draw ↗');text('ld-view-prize','Lihat hadiah ↓','Explore the prize ↓');
 text('ld-free-label','Percuma untuk menyertai','Free to enter');text('ld-account-label','Satu akaun, satu penyertaan','One account, one entry');
 text('ld-draw-status',state.winner?'PEMENANG DIUMUMKAN':closed?'PENYERTAAN DITUTUP':'PENYERTAAN DIBUKA',state.winner?'WINNER ANNOUNCED':closed?'ENTRIES CLOSED':'ENTRIES OPEN');
 text('ld-discover-label','ADA SESUATU UNTUK ANDA','SOMETHING TO LOOK FORWARD TO');text('ld-experience-title','Hadiah yang dinantikan.','A prize worth waiting for.');text('ld-join-kicker','TIGA LANGKAH MUDAH','THREE SIMPLE STEPS');text('ld-join-title','Peluang anda bermula di sini.','Your chance starts here.');
 text('ld-details-label','Butiran penyertaan & syarat cabutan','Entry details & draw terms');text('ld-terms-title','Terma penyertaan','Entry terms');
 document.querySelector('label[for="ld-participant-search"]').textContent=english?'Search the latest participants':'Cari dalam peserta terkini';$('ld-participant-search').placeholder=english?'Search participant names…':'Cari nama peserta…';
 $('ld-stage').setAttribute('aria-label',english?'Draw stage':'Pentas cabutan');$('ld-fullscreen').setAttribute('aria-label',english?'Fullscreen':'Paparan penuh');$('ld-sound').setAttribute('aria-label',english?(sound?'Mute sound':'Enable sound'):(sound?'Matikan bunyi':'Aktifkan bunyi'));
 if(!spinning)text('ld-stage-note',testSpin?'SIMULASI · Tiada keputusan rasmi disimpan':'Roda menampilkan peserta terkini. Semua penyertaan sah berpeluang menang.',testSpin?'SIMULATION · No official result is saved':'The wheel shows recent entries. All eligible entries have a chance to win.');
 text('ld-progress-title','Menuju detik cabutan','On the way to draw day');text('ld-progress-label',total+' / '+config.minParticipants+' peserta',total+' / '+config.minParticipants+' entries');
 $('ld-progress').max=config.minParticipants;$('ld-progress').value=Math.min(total,config.minParticipants);
 text('ld-progress-note',total>=config.minParticipants?'Minimum peserta dicapai. Nantikan keputusan.':(config.minParticipants-total)+' lagi untuk capai minimum',total>=config.minParticipants?'Minimum reached. Stay tuned for the result.':(config.minParticipants-total)+' more entries to reach the minimum');
 text('minimumParticipantsNote','Cabutan memerlukan minimum '+config.minParticipants+' peserta. Jika belum cukup, keputusan tidak dikeluarkan.','At least '+config.minParticipants+' entries are required. No winner is drawn below this minimum.');
 text('drawSummaryStatus',state.winner?'Cabutan selesai':closed?'Penyertaan ditutup':'Penyertaan dibuka',state.winner?'Draw completed':closed?'Entries closed':'Entries open');
 const share=config.shareRequired;
 text('productShareRequirementText',share?'Kongsi sekurang-kurangnya '+config.minShares+' produk Software / CAD yang berbeza selepas login, kemudian semak status dan sertai.':'Login ke akaun AZOBSS, kemudian tekan Join Lucky Draw. Syarat share tidak diperlukan untuk kempen ini.',share?'Share at least '+config.minShares+' different Software / CAD products after signing in, then check your status and enter.':'Sign in to your AZOBSS account, then select Join Lucky Draw. Sharing is optional for this campaign.');
 const notes=$('referralInfoNote')?.querySelectorAll('li');if(notes?.[0])notes[0].textContent=share?(english?'Share '+config.minShares+' different products to unlock entry.':'Kongsi '+config.minShares+' produk berbeza untuk membuka penyertaan.'):(english?'Sharing is optional for this campaign.':'Share adalah pilihan untuk kempen ini.');if(notes?.[1])notes[1].textContent=english?'No need to wait for others to open your shared link.':'Tidak perlu menunggu orang lain membuka pautan anda.';if(notes?.[2])notes[2].textContent=english?'One entry per account for the current month.':'Satu penyertaan bagi setiap akaun untuk bulan semasa.';
 if(!share){const label=$('luckyStepReferral')?.querySelector('strong'),desc=$('luckyStepReferral')?.querySelector('small');if(label)label.textContent=english?'No sharing required':'Share tidak diwajibkan';if(desc)desc.textContent=english?'Sign in and enter.':'Login dan terus sertai.';}
 if(closed){$('joinLuckyDrawButton').disabled=true;if(!state.winner){text('joinStatus',config.registrationOpen?'Tempoh penyertaan tamat. Nantikan keputusan.':'Penyertaan dijeda oleh penganjur.',config.registrationOpen?'Entries have closed. Stay tuned for the result.':'Entries are paused by the organizer.');const step=$('luckyStepJoin');step.querySelector('strong').textContent=english?'Entries closed':'Penyertaan ditutup';step.querySelector('small').textContent=english?'Wait for an update from AZOBSS.':'Nantikan makluman daripada AZOBSS.';step.classList.remove('ok');step.classList.add('closed');}}
 document.querySelector('.ld-community-grid .participants').hidden=!config.showParticipants;document.querySelector('.ld-community-grid .winner-history-panel').hidden=!config.showHistory;
 $('ld-sound').disabled=!config.soundEnabled;$('ld-sound').title=config.soundEnabled?(english?'Toggle sound':'Hidup/matikan bunyi'):(english?'Sound is disabled by the organizer':'Bunyi dimatikan oleh penganjur');
 if(!bridge.isAdmin()&&dialog.open)dialog.close();
 if(!spinning){const names=config.showParticipants?state.entries.map(item=>item.name||item.usernameKey):[];const key=JSON.stringify([names,config.theme,config.accent]);if(lastWheelKey!==key){lastWheelKey=key;drawWheel(names);}}
 filterParticipants();
}
function activate(value){config={...value};window.azLuckyConfig=config;window.azLuckyNextDrawAt=scheduledAt(config,malaysiaMonth());bridge.apply();paint();}
function fill(){for(const key of Object.keys(DEFAULTS)){const field=form.elements.namedItem(key);if(!field)continue;if(field.type==='checkbox')field.checked=config[key];else field.value=String(config[key]);}for(const button of document.querySelectorAll('[data-ld-preset]'))button.setAttribute('aria-pressed',String(button.dataset.ldPreset===config.theme));$('ld-settings-revision').textContent='Versi tetapan '+revision+(preview?' · Pratonton belum disimpan':' · Disimpan pada server');}
function read(){const value={};for(const [key,def] of Object.entries(DEFAULTS)){const field=form.elements.namedItem(key);value[key]=typeof def==='boolean'?field.checked:typeof def==='number'?Number(field.value):field.value;}return validateSettings(value);}
async function loadSettings({force=false}={}){
 if(loading||(!force&&dialog.open))return;loading=true;
 try{const response=await bridge.apiFetch('/api/lucky-draw/settings',{cache:'no-store'}),data=await response.json();if(!response.ok||!data.ok||data.settingsProtocol!==1)throw Error();
  saved=validateSettings(data.config);revision=data.revision;ready=true;preview=false;activate(saved);fill();status('Tetapan semasa dimuatkan. Perubahan diterbitkan selepas Simpan tetapan.');
 }catch{ready=false;status('Servis tetapan belum tersedia. Backend Lucky Draw perlu dikemas kini sebelum tetapan boleh disimpan.',true);}
 finally{loading=false;$('ld-save-settings').disabled=!ready||saving;}
}
function showTab(key){for(const button of document.querySelectorAll('[data-ld-tab]')){const active=button.dataset.ldTab===key;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}for(const panel of document.querySelectorAll('[data-ld-panel]'))panel.hidden=panel.dataset.ldPanel!==key;}
for(const button of document.querySelectorAll('[data-ld-tab]')){button.addEventListener('click',()=>showTab(button.dataset.ldTab));button.addEventListener('keydown',event=>{const keys=Array.from(document.querySelectorAll('[data-ld-tab]'));let index=keys.indexOf(button);if(event.key==='ArrowRight')index=(index+1)%keys.length;else if(event.key==='ArrowLeft')index=(index+keys.length-1)%keys.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=keys.length-1;else return;event.preventDefault();showTab(keys[index].dataset.ldTab);keys[index].focus();});}
$('ld-open-settings').addEventListener('click',async()=>{if(!bridge.isAdmin())return;dialog.showModal();await loadSettings({force:true});});
$('ld-close-settings').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{if(preview){preview=false;activate(saved);fill();}});
$('ld-reload-settings').addEventListener('click',()=>{if(!saving)loadSettings({force:true});});
$('ld-preview-settings').addEventListener('click',()=>{try{activate(read());preview=true;fill();status('Pratonton pada browser ini sahaja. Tutup panel untuk kembali ke tetapan disimpan.');}catch(error){status(error.message,true);}});
for(const button of document.querySelectorAll('[data-ld-preset]'))button.addEventListener('click',()=>{form.elements.namedItem('theme').value=button.dataset.ldPreset;try{activate(read());preview=true;fill();status('Tema dipratonton. Simpan untuk diterbitkan kepada semua pelawat.');}catch(error){status(error.message,true);}});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(saving||!ready||!bridge.isAdmin())return;
 let next;try{next=read();}catch(error){status(error.message,true);return;}
 saving=true;$('ld-save-settings').disabled=true;$('ld-reload-settings').disabled=true;status('Menyimpan tetapan…');
 try{const response=await bridge.apiFetch('/api/lucky-draw/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config:next,expectedRevision:revision})}),data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Tetapan belum berjaya disimpan.');saved=validateSettings(data.config);revision=data.revision;preview=false;activate(saved);fill();status('Tetapan disimpan. Paparan dan peraturan server sudah dikemas kini.');await bridge.refresh();}
 catch(error){status(error.message,true);}
 finally{saving=false;$('ld-save-settings').disabled=!ready;$('ld-reload-settings').disabled=false;}
});
function filterParticipants(){const term=$('ld-participant-search').value.trim().toLocaleLowerCase();for(const row of $('participantList').querySelectorAll('.participant-card'))row.hidden=term&&!row.textContent.toLocaleLowerCase().includes(term);}
$('ld-participant-search').addEventListener('input',filterParticipants);
function drawWheel(names=[]){
 wheelNames=names.slice(0,24);const count=Math.max(12,wheelNames.length),size=760,c=size/2,r=351,colors=config.theme==='royal'?['#30223d','#453055','#21232e','#785472']:config.theme==='midnight'?['#17374e','#1c4b66','#10283f','#29647c']:['#143c31','#205a44','#142d28','#377759'];
 ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);
 for(let i=0;i<count;i++){
  const a=-Math.PI/2+i*2*Math.PI/count,b=a+2*Math.PI/count;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,a,b);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();ctx.strokeStyle='#ead49d25';ctx.lineWidth=1;ctx.stroke();
  ctx.save();ctx.rotate((a+b)/2);ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle=i%3===0?config.accent:'#c5d9ca';ctx.font='600 '+(count>18?14:17)+'px Segoe UI,Arial';const name=wheelNames[i]||'✦';ctx.fillText(name.length>16?name.slice(0,15)+'…':name,r-40,0);ctx.restore();
 }
 ctx.beginPath();ctx.arc(0,0,r+8,0,Math.PI*2);ctx.strokeStyle=config.accent;ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.arc(0,0,r+17,0,Math.PI*2);ctx.strokeStyle='#a38b4a70';ctx.lineWidth=2;ctx.stroke();
 for(let i=0;i<48;i++){const a=i*Math.PI*2/48;ctx.beginPath();ctx.arc(Math.cos(a)*(r+8),Math.sin(a)*(r+8),2.5,0,Math.PI*2);ctx.fillStyle='#fff0c5';ctx.fill();}ctx.restore();
 canvas.setAttribute('aria-label',en()?'Draw visualization. The official result is selected on the server.':'Visual cabutan. Keputusan rasmi dipilih pada server.');
}
function startSpin(detail){spinning=true;testSpin=!!detail.test;lastWheelKey='';if(animation)animation.cancel();if(!reduced.matches)animation=canvas.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1300,iterations:Infinity});text('ld-stage-note',testSpin?'SIMULASI · Keputusan tidak disimpan':'Cabutan sedang berlangsung…',testSpin?'SIMULATION · No result is saved':'The draw is in progress…');if(sound)tone(330,.08);}
function landSpin(detail){
 const names=bridge.state().entries.map(item=>item.name||item.usernameKey).slice(0,23);if(!names.includes(detail.name))names.push(detail.name);drawWheel(names);if(animation)animation.cancel();
 const count=Math.max(12,wheelNames.length),index=wheelNames.indexOf(detail.name),angle=2160-(index+.5)*360/count;
 if(!reduced.matches)animation=canvas.animate([{transform:'rotate(0deg)'},{transform:'rotate('+angle+'deg)'}],{duration:Math.max(300,detail.duration||600),easing:'cubic-bezier(.12,.72,.12,1)',fill:'forwards'});
}
function finishSpin(detail){const celebrate=spinning;spinning=false;if(celebrate&&testSpin&&!reduced.matches)landSpin({...detail,duration:550});if(!celebrate&&animation){animation.cancel();animation=null;}text('ld-stage-note',detail.test?'SIMULASI · Tiada pemenang rasmi disimpan':'Keputusan rasmi dipilih pada server.',detail.test?'SIMULATION · No official winner is saved':'The official result is selected on the server.');
 if(celebrate&&alive&&!document.hidden){if(config.confettiEnabled&&!reduced.matches)confetti();if(sound&&config.soundEnabled){tone(523,.12);setTimeout(()=>tone(659,.15),140);setTimeout(()=>tone(784,.22),300);}}
 paint();
}
function tone(frequency,duration){if(!config.soundEnabled||!sound)return;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=audio||new Context();audio.resume().catch(()=>{});const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.connect(gain);gain.connect(audio.destination);oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.start();oscillator.stop(audio.currentTime+duration);}catch{}}
function confetti(){document.querySelector('.ld-confetti')?.remove();clearTimeout(confettiTimer);const box=document.createElement('div');box.className='ld-confetti';box.setAttribute('aria-hidden','true');const random=crypto.getRandomValues(new Uint32Array(72));for(let i=0;i<48;i++){const piece=document.createElement('i');piece.style.left=(random[i]%100)+'%';piece.style.background=[config.accent,'#42ddb0','#fff8dc'][i%3];piece.style.animationDelay=(random[i]%650)+'ms';piece.style.transform='rotate('+(random[i]%180)+'deg)';box.append(piece);}document.body.append(box);confettiTimer=setTimeout(()=>box.remove(),3500);}
$('ld-sound').addEventListener('click',()=>{if(!config.soundEnabled)return;sound=!sound;$('ld-sound').setAttribute('aria-pressed',String(sound));$('ld-sound').setAttribute('aria-label',sound?'Matikan bunyi':'Aktifkan bunyi');if(sound)tone(440,.1);});
$('ld-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('ld-stage').requestFullscreen();}catch{text('ld-stage-note','Paparan penuh tidak disokong dalam browser ini.','Fullscreen is not supported by this browser.');}});
window.addEventListener('ld:updated',paint);window.addEventListener('ld:language',paint);window.addEventListener('ld:spin-start',event=>startSpin(event.detail));window.addEventListener('ld:spin-result',event=>landSpin(event.detail));window.addEventListener('ld:spin-finish',event=>finishSpin(event.detail));window.addEventListener('ld:spin-error',()=>{spinning=false;animation?.cancel();text('ld-stage-note','Cabutan belum berjaya. Semak mesej admin.','The draw did not complete. Check the admin message.');paint();});
let refreshTimer=setInterval(()=>{if(alive&&!document.hidden&&!dialog.open&&!spinning)loadSettings();},60000);
window.addEventListener('pagehide',()=>{alive=false;clearInterval(refreshTimer);animation?.cancel();clearTimeout(confettiTimer);document.querySelector('.ld-confetti')?.remove();if(audio)audio.close().catch(()=>{});});
window.addEventListener('pageshow',event=>{if(event.persisted){alive=true;refreshTimer=setInterval(()=>{if(!document.hidden&&!dialog.open&&!spinning)loadSettings();},60000);loadSettings();}});
showTab('brand');activate(saved);fill();loadSettings();
