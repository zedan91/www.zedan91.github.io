/* AZOBSS v1349 — Direct PDF Production Prompt; category Ebook is product filter only */
(function(){
  'use strict';

  var VERSION='1360';
  var STORAGE_KEY='azobssEbookPromptsV1345';
  var ACTIVE_SIZE='medium';
  var currentPrompt='';
  var toastTimer=0;
  var ACCESS_GRANTED=false;
  var ACCESS_LOADING=true;
  var ACCESS_STATE=null;
  var EBOOK_PRICE='RM19';
  var EBOOK_PENDING_KEY='azobssEbookGeneratorPendingV1351';
  var ACCESS_CACHE_KEY='azobssEbookAccessCacheV1360';
  var ACCESS_CACHE_TTL=5*60*1000;

  function esc(v){
    return String(v==null?'':v).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});
  }
  function byId(id){return document.getElementById(id)}
  function text(v){return String(v==null?'':v).trim()}

  function toast(msg){
    var el=byId('azebookToast1345');
    if(!el)return;
    el.textContent=String(msg||'');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){el.classList.remove('show')},2600);
  }

  function setStatus(msg,state){
    var el=byId('azebookStatus1345');
    if(!el)return;
    el.textContent=msg||'';
    el.className='azebook-status'+(state?' is-'+state:'');
  }

  function safeHistory(){
    try{
      var raw=localStorage.getItem(STORAGE_KEY);
      var arr=raw?JSON.parse(raw):[];
      return Array.isArray(arr)?arr:[];
    }catch(_e){return []}
  }
  function writeHistory(arr){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(arr.slice(0,50)));return true}catch(_e){return false}
  }


  function apiBase(){
    return String(window.API_BASE_URL || window.AZOBSS_BACKEND_BASE || 'https://azobss-backend.onrender.com').replace(/\/$/,'');
  }
  async function authHeaders(force){
    try{
      // v1360: use the already-restored Firebase user immediately when available.
      if(typeof window.azobssGetFirebaseAuthHeaders==='function'){
        var h=await window.azobssGetFirebaseAuthHeaders(!!force);if(h&&h.Authorization)return h;
      }
      if(typeof window.azobssWaitForFirebaseAuthToken==='function'){
        var token=await window.azobssWaitForFirebaseAuthToken(!!force,3000);
        if(token)return {'Authorization':'Bearer '+token};
      }
    }catch(_e){}
    return {};
  }
  function authWait(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function waitForAuthHeaders(force,maxMs){
    var started=Date.now(), h={};
    do{
      h=await authHeaders(!!force);
      if(h&&h.Authorization)return h;
      // Global auth is a module and may still be restoring Firebase persistence.
      // Do not render a false RM19 paywall while that restoration is in progress.
      if(Date.now()-started>=maxMs)break;
      await authWait(250);
    }while(true);
    return h||{};
  }
  function pendingPayment(){
    try{var x=JSON.parse(localStorage.getItem(EBOOK_PENDING_KEY)||'null');return x&&typeof x==='object'?x:null}catch(_e){return null}
  }
  function setPendingPayment(v){try{if(v)localStorage.setItem(EBOOK_PENDING_KEY,JSON.stringify(v));else localStorage.removeItem(EBOOK_PENDING_KEY)}catch(_e){}}
  function currentFirebaseUid(){
    try{if(typeof window.azobssGetCurrentFirebaseUid==='function')return String(window.azobssGetCurrentFirebaseUid()||'').trim()}catch(_e){}
    return '';
  }
  function readAccessCache(){try{var x=JSON.parse(sessionStorage.getItem(ACCESS_CACHE_KEY)||localStorage.getItem(ACCESS_CACHE_KEY)||'null');return x&&typeof x==='object'?x:null}catch(_e){return null}}
  function writeAccessCache(uid){
    uid=String(uid||'').trim();if(!uid)return;
    var row={uid:uid,access:true,lifetime:true,checkedAtMs:Date.now()};
    try{sessionStorage.setItem(ACCESS_CACHE_KEY,JSON.stringify(row));localStorage.setItem(ACCESS_CACHE_KEY,JSON.stringify(row))}catch(_e){}
  }
  function clearAccessCache(){try{sessionStorage.removeItem(ACCESS_CACHE_KEY);localStorage.removeItem(ACCESS_CACHE_KEY)}catch(_e){}}
  function restoreCachedAccess(){
    var uid=currentFirebaseUid(),row=readAccessCache();
    if(!uid||!row||row.uid!==uid||row.access!==true||Date.now()-Number(row.checkedAtMs||0)>ACCESS_CACHE_TTL)return false;
    updateGate({access:true,lifetime:true,source:'short-cache',reason:'cached'});return true;
  }
  function gateEl(){return byId('azebookAccessGate1351')}
  function paidContent(){return byId('azebookPaidContent1351')}
  function updateGate(state){
    ACCESS_STATE=state||{};ACCESS_LOADING=ACCESS_STATE.reason==='loading';ACCESS_GRANTED=!!ACCESS_STATE.access;
    var gate=gateEl(), paid=paidContent(), subtabs=document.querySelector('.azebook-subtabs');
    if(paid)paid.hidden=!ACCESS_GRANTED;
    if(subtabs)subtabs.hidden=!ACCESS_GRANTED;
    if(!gate)return;
    if(ACCESS_GRANTED){gate.hidden=true;setPendingPayment(null);return}
    gate.hidden=false;
    if(ACCESS_LOADING){
      gate.innerHTML='<div class="azebook-paywall-card azebook-paywall-loading">'+
        '<div class="azebook-paywall-icon">📚</div><span class="azebook-paywall-kicker">AZOBSS EBOOK GENERATOR PRO</span>'+
        '<h2>Menyemak akses akaun...</h2>'+
        '<p class="azebook-paywall-copy">Sistem sedang memulihkan sesi login dan menyemak akses lifetime kamu.</p>'+
        '<div id="azebookPayStatus1351" class="azebook-paywall-status">Sila tunggu sebentar.</div></div>';
      return;
    }
    var loginRequired=!!ACCESS_STATE.loginRequired || ACCESS_STATE.reason==='login_required';
    var pending=ACCESS_STATE.pending||pendingPayment();
    if(loginRequired){
      gate.innerHTML='<div class="azebook-paywall-card">'+
        '<div class="azebook-paywall-icon">📚</div><span class="azebook-paywall-kicker">AZOBSS EBOOK GENERATOR PRO</span>'+
        '<h2>Login untuk Akses Ebook Generator</h2>'+
        '<div class="azebook-paywall-price">RM19 <small>sekali sahaja</small></div>'+
        '<p class="azebook-paywall-copy"><strong>Sudah pernah bayar RM19?</strong> Login menggunakan akaun yang sama dan akses lifetime akan dibuka automatik. Jangan buat bayaran kali kedua.</p>'+
        '<div class="azebook-paywall-points"><span>✓ Direct PDF Production Prompt</span><span>✓ Semua gaya ebook adaptive</span><span>✓ Prompt Saya &amp; export TXT</span><span>✓ Akses seumur hidup untuk akaun ini</span></div>'+
        '<button type="button" class="azebook-btn primary azebook-paywall-main" id="azebookLogin1351">Login / Register</button>'+
        '<p class="azebook-paywall-note">Akses lifetime disimpan pada akaun AZOBSS, bukan pada satu browser sahaja.</p>'+
        '<div id="azebookPayStatus1351" class="azebook-paywall-status"></div></div>';
      var lb=byId('azebookLogin1351');if(lb)lb.onclick=function(){try{sessionStorage.setItem('azobssReturnAfterLogin','/Software-Tools/#ebook')}catch(_e){}try{localStorage.setItem('azobssReturnAfterLogin','/Software-Tools/#ebook')}catch(_e){};location.href='/?next='+encodeURIComponent('/Software-Tools/#ebook')+'#login'};
      return;
    }
    gate.innerHTML='<div class="azebook-paywall-card">'+
      '<div class="azebook-paywall-icon">📚</div><span class="azebook-paywall-kicker">AZOBSS EBOOK GENERATOR PRO</span>'+
      '<h2>Unlock Ebook Generator</h2><div class="azebook-paywall-price">RM19 <small>sekali sahaja</small></div>'+
      '<p class="azebook-paywall-copy">Bayar sekali dan akses kekal pada akaun AZOBSS kamu. Tiada yuran bulanan atau tahunan.</p>'+
      '<div class="azebook-paywall-points"><span>✓ Direct PDF Production Prompt</span><span>✓ Semua gaya ebook adaptive</span><span>✓ Prompt Saya &amp; export TXT</span><span>✓ Akses seumur hidup untuk akaun ini</span></div>'+
      '<button type="button" class="azebook-btn primary azebook-paywall-main" id="azebookBuy1351">'+(pending?'Semak / Sambung Pembayaran':'Unlock Sekarang — RM19')+'</button>'+
      '<p class="azebook-paywall-note">Pembayaran melalui ToyyibPay / FPX. Selepas disahkan, generator dibuka automatik.</p>'+
      '<div id="azebookPayStatus1351" class="azebook-paywall-status"></div></div>';
    var bb=byId('azebookBuy1351');if(bb)bb.onclick=function(){ if(pending&&pending.paymentUrl){location.href=pending.paymentUrl;return} buyLifetimeAccess(); };
  }
  function gateStatus(msg,error){var el=byId('azebookPayStatus1351');if(!el)return;el.textContent=msg||'';el.className='azebook-paywall-status'+(error?' is-error':'')}
  async function checkLifetimeAccess(force,options){
    options=options||{};var background=!!options.background;
    if(!background)ACCESS_LOADING=true;
    var headers=await waitForAuthHeaders(!!force,background?1200:3000);
    if(!headers.Authorization){
      if(background&&ACCESS_GRANTED)return true;
      clearAccessCache();updateGate({access:false,loginRequired:true,reason:'login_required'});return false;
    }
    var pending=pendingPayment();
    var url=apiBase()+'/api/ebook-generator/access-status'+(pending&&pending.billCode?'?billCode='+encodeURIComponent(pending.billCode):'');
    var controller=typeof AbortController!=='undefined'?new AbortController():null;
    var timeout=setTimeout(function(){try{controller&&controller.abort()}catch(_e){}},background?2800:5000);
    try{
      var res=await fetch(url,{headers:Object.assign({'Accept':'application/json'},headers),cache:'no-store',signal:controller?controller.signal:undefined});
      var data=await res.json().catch(function(){return {}});
      if(res.status===401){clearAccessCache();updateGate({access:false,loginRequired:true,reason:'login_required'});return false}
      if(!res.ok||data.ok===false)throw new Error(data.error||'Access check failed');
      var uid=currentFirebaseUid()||String(data&&data.entitlement&&data.entitlement.uid||'');
      if(data.access)writeAccessCache(uid);else clearAccessCache();
      updateGate(data);
      if(!data.access&&data.reason==='payment_pending')gateStatus('Pembayaran belum disahkan. Jika baru selesai bayar, tunggu beberapa saat dan tekan semula.',false);
      return !!data.access;
    }catch(err){
      if(background&&ACCESS_GRANTED)return true;
      updateGate({access:false,reason:'check_failed'});
      gateStatus((err&&err.name==='AbortError'?'Semakan mengambil masa lebih lama daripada biasa. Cuba semula.':'Tak dapat semak akses sekarang: '+(err.message||err)),true);
      return false;
    }finally{clearTimeout(timeout)}
  }
  async function buyLifetimeAccess(){
    var btn=byId('azebookBuy1351');if(btn){btn.disabled=true;btn.textContent='Menyediakan pembayaran...'}
    gateStatus('Menyediakan bil RM19 sekali sahaja...',false);
    try{
      var headers=await authHeaders(true);if(!headers.Authorization){updateGate({access:false,loginRequired:true});return}
      var res=await fetch(apiBase()+'/api/ebook-generator/create-bill',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},headers),body:JSON.stringify({source:'Software-Tools Ebook Generator'})});
      var data=await res.json().catch(function(){return {}});
      if(res.status===401){updateGate({access:false,loginRequired:true});return}
      if(!res.ok||data.ok===false)throw new Error(data.error||'Tidak dapat menyediakan pembayaran');
      if(data.accessGranted||data.alreadyOwned){await checkLifetimeAccess(true);toast('Akses Ebook Generator sudah aktif');return}
      if(!data.paymentUrl)throw new Error('Payment URL tidak diterima');
      setPendingPayment({orderId:data.orderId||'',billCode:data.billCode||'',paymentUrl:data.paymentUrl,createdAtMs:Date.now()});
      gateStatus('Membuka ToyyibPay...',false);location.href=data.paymentUrl;
    }catch(err){gateStatus('Pembayaran gagal dibuka: '+(err.message||err),true);if(btn){btn.disabled=false;btn.textContent='Cuba Lagi — RM19'}}
  }

  function formatDate(ts){
    try{return new Intl.DateTimeFormat('ms-MY',{dateStyle:'medium',timeStyle:'short'}).format(new Date(ts))}catch(_e){return new Date(ts).toLocaleString()}
  }

  function sizeMeta(size){
    return {
      short:{label:'Ringkas',pages:'15–20 muka surat',chapters:'5–7 bab',words:'kira-kira 4,500–7,000 patah perkataan'},
      medium:{label:'Sederhana',pages:'30–40 muka surat',chapters:'10–12 bab',words:'kira-kira 9,000–14,000 patah perkataan'},
      deep:{label:'Mendalam',pages:'50–80 muka surat',chapters:'15–20 bab',words:'kira-kira 16,000–28,000 patah perkataan'}
    }[size]||null;
  }

  function designProfile(v,lang){
    var ms={
      minimal:{label:'Minimalis moden — banyak ruang putih, tulisan bersih',cover:'Latar penuh yang sangat bersih, satu warna utama lembut, tipografi besar dan satu bentuk geometri ringkas.',layout:'Satu lajur utama dengan whitespace luas; gunakan dua lajur hanya untuk senarai atau perbandingan pendek.',background:'Putih lembut / off-white dengan aksen warna halus.',typography:'Sans-serif moden, hierarki tajuk jelas dan perenggan lapang.',special:'Elakkan hiasan berlebihan; fokus pada keterbacaan dan susunan yang tenang.'},
      corporate:{label:'Korporat profesional — biru gelap, kemas, formal',cover:'Latar biru gelap atau navy penuh, bentuk geometri kemas, tajuk putih yang kuat dan aksen profesional.',layout:'Grid korporat kemas; satu lajur untuk naratif dan dua lajur terkawal untuk fakta, jadual atau ringkasan.',background:'Off-white dengan aksen biru gelap pada header, garis dan nombor halaman.',typography:'Sans-serif profesional dengan tajuk tebal dan body yang neutral.',special:'Gunakan callout data, jadual dan kotak ringkasan secara sederhana.'},
      classic:{label:'Elegan klasik — serif, gaya buku tradisional',cover:'Latar tona neutral penuh, bingkai/garis klasik yang sangat ringkas dan tipografi serif besar.',layout:'Satu lajur seperti buku tradisional dengan lebar bacaan selesa; elakkan elemen terlalu moden.',background:'Krim atau off-white lembut dengan aksen gelap yang halus.',typography:'Serif untuk tajuk, body mudah dibaca dan jarak perenggan konsisten.',special:'Gunakan drop-cap atau divider klasik hanya jika tidak mengganggu keterbacaan.'},
      bold:{label:'Bold & berwarna — kontras kuat, tajuk besar',cover:'Warna latar penuh berkontras tinggi, tajuk sangat besar dan satu atau dua blok geometri kuat.',layout:'Satu lajur dinamik dengan section break besar, pull quote dan callout berwarna; dua lajur untuk bahagian pendek sahaja.',background:'Putih/off-white dengan aksen warna tepu yang konsisten.',typography:'Sans-serif tebal untuk tajuk dan body neutral yang mudah dibaca.',special:'Pastikan kontras tinggi dan jangan gunakan terlalu banyak warna serentak.'},
      editorial:{label:'Majalah / editorial — visual besar, susun atur editorial',cover:'Kulit gaya editorial dengan tajuk besar, satu kawasan visual/warna dominan dan komposisi majalah yang kuat.',layout:'Gunakan susun atur dua lajur pada halaman yang sesuai, visual/hero block besar, pull quote dan section break editorial. Naratif panjang boleh kekal satu lajur jika lebih mudah dibaca.',background:'Off-white dengan aksen editorial yang konsisten dan garis pemisah nipis.',typography:'Tajuk display besar digabung dengan body font yang sangat mudah dibaca.',special:'Utamakan ritma majalah: tajuk besar, deck/subtajuk, pull quote, dua lajur dan ruang visual yang terkawal.'},
      workbook:{label:'Buku kerja (workbook) — latihan & checklist',cover:'Kulit terang dan praktikal dengan tajuk jelas, satu bentuk geometri ringkas serta label workbook.',layout:'Satu lajur modular dengan worksheet, checklist, ruang jawapan, jadual dan kotak refleksi.',background:'Putih/off-white dengan garis dan kotak kerja yang ringan.',typography:'Sans-serif neutral dan jelas untuk cetakan serta penulisan tangan.',special:'Sediakan ruang sebenar untuk latihan; jangan hanya menyebut bahawa latihan perlu dibuat.'},
      motivation:{label:'Motivasi / self-help — quote & action plan',cover:'Kulit emosional tetapi ringkas: warna hangat, tajuk besar dan satu elemen geometri/hero yang kuat.',layout:'Satu lajur dengan pull quote besar, refleksi, action plan dan checklist kemajuan.',background:'Off-white dengan aksen hangat yang konsisten.',typography:'Tajuk ekspresif tetapi body tenang dan mudah dibaca.',special:'Gunakan quote hanya jika dicipta sebagai kata-kata editorial sendiri atau sumbernya benar-benar disahkan.'},
      technical:{label:'Panduan langkah demi langkah — jadual, checklist & nota penting',cover:'Kulit panduan moden dan bersih dengan tajuk besar, nombor/ikon ringkas dan satu warna aksen.',layout:'Satu lajur utama dengan langkah bernombor, jadual, checklist, kotak nota/peringatan dan contoh praktikal. Dua lajur hanya untuk rujukan pantas.',background:'Off-white dengan aksen jelas untuk label langkah dan peringatan.',typography:'Sans-serif teknikal yang jelas, heading bernombor dan caption ringkas.',special:'Jangan gunakan blok kod kecuali topik benar-benar berkaitan pemprograman, skrip atau kod IT.'},
      pastel:{label:'Pastel lembut — lifestyle & mesra',cover:'Latar pastel penuh, bentuk organik/geometri sangat ringkas dan tipografi mesra.',layout:'Satu lajur ringan dengan card/callout lembut, checklist dan ruang visual sederhana.',background:'Off-white/pastel sangat lembut dengan kontras teks yang tinggi.',typography:'Sans-serif mesra dan bersih; elakkan font dekoratif pada body.',special:'Pastikan warna pastel tidak mengurangkan kebolehbacaan ketika dicetak.'},
      premium:{label:'Gelap premium — aksen emas, mewah',cover:'Latar gelap penuh dengan aksen emas/keemasan yang minimum, tajuk besar dan komposisi eksklusif.',layout:'Satu lajur premium dengan divider halus, pull quote dan section break elegan; dua lajur terpilih untuk ringkasan.',background:'Halaman isi kekal cerah/off-white untuk kebolehbacaan, dengan aksen gelap dan emas yang sangat terkawal.',typography:'Tajuk elegan dengan body yang neutral dan profesional.',special:'Jangan jadikan semua halaman berlatar hitam; utamakan keselesaan membaca dan kos cetakan.'}
    };
    var en={
      minimal:{label:'Modern minimalist — generous whitespace and clean typography',cover:'Full-page clean background, one soft primary colour, large typography and one simple geometric shape.',layout:'Primarily single-column with generous whitespace; use two columns only for short lists or comparisons.',background:'Soft white/off-white with a subtle accent colour.',typography:'Modern sans-serif, clear heading hierarchy and relaxed body spacing.',special:'Avoid decorative clutter; prioritise readability and calm composition.'},
      corporate:{label:'Professional corporate — dark blue, clean and formal',cover:'Full-page navy/dark-blue background, clean geometric shapes, strong white title and restrained corporate accent.',layout:'Clean corporate grid; one column for narrative and controlled two-column blocks for facts, tables or summaries.',background:'Off-white with dark-blue accents in headers, rules and page numbers.',typography:'Professional sans-serif with bold headings and neutral body text.',special:'Use data callouts, tables and summary boxes sparingly.'},
      classic:{label:'Classic elegant — serif, traditional book style',cover:'Full-page neutral-toned cover, very simple classic rule/frame and large serif typography.',layout:'Traditional single-column book layout with comfortable measure; avoid overly modern card-heavy design.',background:'Cream/off-white with subtle dark accents.',typography:'Serif headings with highly readable body text and consistent paragraph rhythm.',special:'Use classic dividers or a drop cap only when they do not reduce readability.'},
      bold:{label:'Bold & colourful — strong contrast and large headings',cover:'High-contrast full-page colour, oversized title and one or two strong geometric blocks.',layout:'Dynamic single-column pages with large section breaks, pull quotes and coloured callouts; two columns only for short sections.',background:'White/off-white with a consistent saturated accent.',typography:'Bold sans-serif headings with neutral readable body copy.',special:'Maintain strong contrast and avoid using too many colours at once.'},
      editorial:{label:'Magazine / editorial — large visuals and editorial composition',cover:'Editorial cover with oversized title, one dominant visual/colour field and strong magazine-style composition.',layout:'Use two-column layouts where appropriate, large hero/visual blocks, pull quotes and strong editorial section breaks. Keep long narrative passages single-column when more readable.',background:'Off-white with a consistent editorial accent and thin divider rules.',typography:'Large display headings paired with highly readable body typography.',special:'Create magazine rhythm with headline, deck, pull quote, selective two-column sections and controlled visual space.'},
      workbook:{label:'Workbook — exercises and checklists',cover:'Bright practical cover with clear title, one simple geometric device and an obvious workbook cue.',layout:'Modular single-column pages with worksheets, checklists, answer space, tables and reflection boxes.',background:'White/off-white with light rules and worksheet boxes.',typography:'Neutral readable sans-serif suitable for print and handwriting.',special:'Provide real usable exercise space instead of merely suggesting exercises.'},
      motivation:{label:'Motivation / self-help — quotes and action plans',cover:'Simple emotional cover using a warm full-page colour, large title and one strong geometric/hero element.',layout:'Single column with large pull quotes, reflection prompts, action plans and progress checklists.',background:'Off-white with consistent warm accents.',typography:'Expressive headings with calm readable body copy.',special:'Use quotations only when they are original editorial copy or the source is genuinely verified.'},
      technical:{label:'Step-by-step guide — tables, checklists and important notes',cover:'Clean modern guide cover with large title, simple numbered/icon motif and one accent colour.',layout:'Mainly single-column with numbered procedures, tables, checklists, note/warning boxes and practical examples. Use two columns only for quick reference.',background:'Off-white with clear accents for steps and warnings.',typography:'Clear technical sans-serif, numbered headings and concise captions.',special:'Do not use code blocks unless the topic genuinely involves programming, scripts or IT code.'},
      pastel:{label:'Soft pastel — friendly lifestyle style',cover:'Full-page pastel background, very simple organic/geometric shapes and friendly typography.',layout:'Light single-column pages with soft callouts, checklists and moderate visual space.',background:'Very soft off-white/pastel with high text contrast.',typography:'Friendly clean sans-serif; avoid decorative body fonts.',special:'Pastel colours must remain readable in print.'},
      premium:{label:'Dark premium — gold accents and luxury feel',cover:'Full-page dark cover with restrained gold accents, oversized title and exclusive composition.',layout:'Premium single-column layout with subtle dividers, pull quotes and elegant section breaks; selective two-column summaries.',background:'Keep interior pages light/off-white for readability, using dark and gold accents sparingly.',typography:'Elegant headings with neutral professional body type.',special:'Do not make every interior page black; prioritise reading comfort and print practicality.'}
    };
    var set=lang==='en'?en:ms;
    return set[v]||set.minimal;
  }

  function getFormState(){
    return {
      topic:text(byId('azebookTopic1345')?.value),
      author:text(byId('azebookAuthor1345')?.value),
      audience:text(byId('azebookAudience1345')?.value),
      tone:text(byId('azebookTone1345')?.value)||'professional',
      language:text(byId('azebookLanguage1345')?.value)||'ms',
      design:text(byId('azebookDesign1345')?.value)||'minimal',
      size:ACTIVE_SIZE||'medium',
      maxPages:text(byId('azebookMaxPages1345')?.value)
    };
  }

  function generatePrompt(s){
    var meta=sizeMeta(s.size)||sizeMeta('medium');
    var maxPages=s.maxPages?Number(s.maxPages):0;
    var author=s.author||'Tidak dinyatakan';
    var audience=s.audience||'Pembaca umum yang berminat dengan topik ini';
    var profile=designProfile(s.design,s.language);
    var hardLimit=s.language==='en'
      ? (maxPages?'MAXIMUM '+maxPages+' pages — this is a hard ceiling and overrides the selected size estimate if the two conflict. Adjust chapter count, density and layout to stay within it.':'Follow the selected ebook size; choose a practical final page count within that range.')
      : (maxPages?'MAKSIMUM '+maxPages+' muka surat — ini had keras dan mengatasi anggaran saiz ebook jika kedua-duanya bercanggah. Laraskan bilangan bab, kepadatan kandungan dan susun atur supaya tidak melebihinya.':'Ikut saiz ebook yang dipilih dan pilih jumlah muka surat akhir yang praktikal dalam julat tersebut.');

    if(s.language==='en'){
      var cfgEn={
        task:'Write ONE COMPLETE EBOOK now — do not write another prompt, do not ask follow-up questions, do not stop at an outline, and finish by creating one downloadable PDF file.',
        role:'Professional book writer, editor, content strategist and publication designer.',
        critical_instructions:[
          'Execute these instructions now. Do not regenerate or explain this prompt.',
          'Write the actual book from beginning to end. Do not return only Markdown, an outline, code or production instructions.',
          'Use the document/file creation capabilities available on the AI platform to create the final PDF.',
          'The PDF itself is the primary deliverable. After creating it, provide a download link.',
          'If the platform genuinely has no file-creation capability, state that limitation truthfully and provide the complete publication-ready manuscript as fallback; never pretend a PDF was created.'
        ],
        publication_specification:{topic:s.topic,author:author,target_readers:audience,writing_tone:toneLabel(s.tone,'en')+' — natural flowing prose, strong openings and no robotic filler',language:'English',scope:meta.label+' — '+meta.chapters+', estimated '+meta.pages+' ('+meta.words+')',page_limit:hardLimit,design_style:profile.label,page_size:'A4 portrait (210 mm × 297 mm)'},
        ebook_structure:[
          'Full-page cover as page ONE',
          'Short copyright / disclaimer page under the author name',
          'A short marketable synopsis of 3–5 paragraphs',
          'Complete table of contents',
          'An introduction that frames the reader problem, desired outcome and what will be learned',
          'All complete chapters appropriate to the selected scope',
          'Conclusion plus a practical action plan / next steps',
          'Final call to action appropriate to the subject'
        ],
        chapter_standard:{note:'Every chapter must be fully written, not notes or placeholders.',required_content:['An engaging opening such as a story, verified fact, scenario or question','Well-organised main content with useful subheadings','At least one practical example, mini case study or worked scenario when appropriate','Tips, steps, checklist or actions the reader can apply','A concise chapter recap and/or next action'],titles:'Create the book title, subtitle and chapter titles yourself so they are logical, compelling and commercially presentable.'},
        cover_design:{direction:profile.cover,size_and_bleed:'Cover must occupy one full A4 portrait page (210 mm × 297 mm) edge-to-edge with no white border. Force a page break after the cover.',must_include:['Large readable title','Short subtitle','Author: '+author],production_method:'Create the cover directly inside the final PDF. Prefer a full-page colour field, one or two simple geometric elements and strong typography. Do not create a separate cover artifact. Do not stall on complex illustration.',effort_limit:'Complete the cover in one short design pass. If a visual element fails, fall back immediately to colour + typography + simple geometry and continue the book.',print_setting:'If HTML/CSS is used to generate the PDF, use @page { size: A4; margin: 0; }, html/body margin:0, a 210mm × 297mm cover, box-sizing:border-box, overflow:hidden, page-break-after:always and print-color-adjust:exact.'},
        interior_design:{layout:profile.layout,background:profile.background,typography:profile.typography,special_direction:profile.special,page_identity:['Show the current chapter/section name subtly at the top of normal content pages','Use clean page numbers at the bottom','Use a thin accent rule as a separator rather than heavy decoration','Keep internal margins, paragraph width, heading spacing and line spacing consistent'],layout_control:'Each interior page must be A4 with its own internal padding of about 17–20 mm because the global print margin is zero. Avoid orphan headings, awkward paragraph breaks, unnecessary blank space and overflow.',pdf_cleanliness:'Do not show browser-generated URL, date, filename or automatic browser headers/footers. Cover and copyright pages do not need running chapter headers or page numbers.',visual_fallback:'Use simple CSS, typography, rules and geometric blocks. If image-generation or suitable licensed imagery is unavailable, do not delay completion; use typographic/shape-based editorial visuals instead.'},
        factual_integrity:['Do not invent statistics, studies, quotations, laws, religious rulings, medical claims, product specifications or sources.','When a claim needs current or specialist verification, verify it with reliable sources if web/research tools are available.','If verification cannot be completed, mark the point clearly for verification or omit it rather than fabricating evidence.','For medical, legal, financial, religious or other high-stakes topics, include an appropriate concise disclaimer and distinguish general education from professional advice.'],
        visual_consistency:'Apply the selected '+profile.label+' direction consistently to the cover, chapter openers, typography, spacing, accents, tables, callouts and page rhythm.',
        final_quality_check:['Keep the chapter count appropriate to the selected scope.','Ensure every chapter contains actual useful content rather than repeated filler.','Check that the tone and depth match the target readers.','Check the final PDF page count and obey the hard page limit when one is specified.','Check for clipping, overflow, broken glyphs, blank accidental pages and unreadable contrast.','Ensure the first page is the cover and the final artifact is a single PDF.'],
        final_output:{format:'ONE polished PDF file ready to download',platform_instruction:'Use the platform file/document creation capability and return the downloadable PDF. Do not merely return source code, Markdown, an outline or another prompt.',start_order:'Start with the cover, continue through copyright, synopsis, contents, all chapters and the ending, then build and verify the PDF before answering.',response_after_file_creation:'Keep the chat response brief: confirm completion and provide the PDF download link.'}
      };
      return 'You are a professional book writer and publication designer. Read the JSON configuration below and EXECUTE it now — write the full ebook, finish the publication layout and create one downloadable PDF. Do not regenerate this prompt.\n\n'+JSON.stringify(cfgEn,null,2);
    }

    var cfg={
      tugas:'Tulis SEBUAH EBOOK LENGKAP sekarang juga — jangan tulis prompt baharu, jangan tanya soalan susulan, jangan berhenti pada rangka, dan siapkan satu fail PDF yang boleh dimuat turun.',
      peranan:'Penulis buku profesional, editor, pakar strategi kandungan dan pereka bentuk penerbitan.',
      arahan_kritikal:[
        'Laksanakan arahan ini sekarang. Jangan jana semula atau terangkan prompt ini.',
        'Tulis kandungan buku sebenar dari awal hingga akhir. Jangan beri Markdown sahaja, rangka, kod atau arahan produksi sahaja.',
        'Gunakan fungsi penciptaan dokumen atau fail yang tersedia dalam platform AI untuk menghasilkan PDF akhir.',
        'PDF ialah hasil utama. Selepas siap, berikan pautan muat turun.',
        'Jika platform benar-benar tiada fungsi penciptaan fail, nyatakan batasan itu dengan jujur dan berikan manuskrip lengkap sedia diterbitkan sebagai fallback; jangan mendakwa PDF telah dibuat jika sebenarnya tidak.'
      ],
      spesifikasi_penerbitan:{
        topik_utama:s.topic,
        nama_penulis:author,
        pembaca_sasaran:audience,
        nada_penulisan:toneLabel(s.tone,'ms')+' — ayat mengalir semula jadi, pembukaan kuat dan elakkan bahasa robotik atau ayat pengisi',
        bahasa_penulisan:'Bahasa Melayu',
        skop_penerbitan:meta.label+' — '+meta.chapters+', anggaran '+meta.pages+' ('+meta.words+')',
        had_muka_surat:hardLimit,
        gaya_reka_bentuk:profile.label,
        saiz_halaman:'A4 potret (210 mm × 297 mm)'
      },
      struktur_ebook:[
        'Kulit buku penuh satu muka surat sebagai muka surat PERTAMA',
        'Halaman hak cipta / disclaimer ringkas atas nama '+author,
        'Sinopsis pendek yang menjual dalam 3–5 perenggan',
        'Halaman isi kandungan lengkap',
        'Pengenalan yang menerangkan masalah pembaca, hasil yang mahu dicapai dan apa yang akan dipelajari',
        'Semua bab lengkap mengikut skop yang dipilih',
        'Kesimpulan serta pelan tindakan / langkah seterusnya yang praktikal',
        'Ajakan bertindak akhir yang sesuai dengan topik'
      ],
      standard_penulisan_setiap_bab:{
        nota:'Setiap bab mesti ditulis PENUH, bukan ringkasan, placeholder atau titik-titik nota.',
        kandungan_wajib:[
          'Pembukaan yang menarik perhatian melalui cerita, fakta yang telah disahkan, situasi atau soalan',
          'Isi utama yang tersusun dengan sub-tajuk yang berguna',
          'Sekurang-kurangnya satu contoh praktikal, mini kajian kes atau situasi kerja jika sesuai',
          'Tips, langkah, checklist atau tindakan yang boleh terus dipraktikkan',
          'Ringkasan padat dan/atau tindakan seterusnya di hujung bab'
        ],
        tajuk:'Cipta sendiri tajuk utama, subtajuk dan tajuk setiap bab supaya logik, menarik dan sesuai dipasarkan.'
      },
      reka_bentuk_kulit_buku:{
        arahan:profile.cover,
        saiz_dan_bleed:'Kulit WAJIB memenuhi SATU halaman A4 potret (210 mm × 297 mm) dari tepi ke tepi tanpa margin atau bingkai putih. Paksa page break selepas kulit.',
        wajib_ada:['Tajuk utama besar dan mudah dibaca','Subtajuk pendek','Nama penulis: '+author],
        cara_hasilkan:'Hasilkan cover terus di dalam PDF akhir. Utamakan satu warna latar penuh, satu atau dua bentuk geometri mudah dan tipografi besar. Jangan hasilkan artifact cover berasingan dan jangan tersangkut pada ilustrasi kompleks.',
        had_usaha:'Siapkan kulit dalam satu percubaan reka bentuk yang ringkas. Jika elemen visual gagal, terus guna warna + tipografi + geometri mudah dan sambung menyiapkan ebook.',
        tetapan_cetak:'Jika menggunakan HTML/CSS untuk PDF, gunakan @page { size: A4; margin: 0; }, html dan body margin:0, cover 210mm × 297mm, box-sizing:border-box, overflow:hidden, page-break-after:always serta print-color-adjust:exact.'
      },
      reka_bentuk_halaman_dalaman:{
        susun_atur:profile.layout,
        latar_halaman:profile.background,
        tipografi:profile.typography,
        arahan_khas:profile.special,
        identiti_halaman:[
          'Letakkan nama bab atau seksyen semasa secara kecil dan kemas di bahagian atas halaman isi biasa',
          'Letakkan nombor muka surat yang kemas di bahagian bawah',
          'Gunakan satu garis aksen nipis sebagai pemisah; jangan hias setiap halaman dengan kotak berat',
          'Kekalkan margin dalaman, lebar perenggan, jarak tajuk dan jarak baris yang konsisten'
        ],
        kawalan_susun_atur:'Setiap halaman isi bersaiz A4 dengan padding dalaman kira-kira 17–20 mm kerana margin cetakan global ialah 0. Elakkan tajuk yatim, perenggan terpotong dengan buruk, ruang kosong besar yang tidak perlu dan kandungan melimpah.',
        kebersihan_pdf:'Jangan paparkan URL, tarikh, nama fail atau header/footer automatik pelayar. Kulit dan halaman hak cipta tidak perlu running header atau nombor halaman.',
        fallback_visual:'Gunakan CSS ringkas, tipografi, garis dan bentuk geometri. Jika fungsi imej atau imej berlesen yang sesuai tiada, jangan melambatkan kerja; gunakan visual editorial berasaskan tipografi/bentuk sahaja.'
      },
      kawalan_fakta:[
        'Jangan mereka-reka statistik, kajian, petikan, undang-undang, hukum agama, dakwaan perubatan, spesifikasi produk atau sumber.',
        'Jika fakta memerlukan pengesahan semasa atau kepakaran khusus, sahkan melalui sumber dipercayai apabila alat web/research tersedia.',
        'Jika pengesahan tidak dapat dibuat, tandakan dengan jelas untuk disahkan atau gugurkan fakta tersebut; jangan cipta sumber palsu.',
        'Untuk topik perubatan, undang-undang, kewangan, agama atau bidang berisiko tinggi, sertakan disclaimer ringkas yang sesuai dan bezakan pendidikan umum daripada nasihat profesional.'
      ],
      konsistensi_visual:'Gunakan gaya '+profile.label+' secara konsisten pada kulit, pembukaan bab, tipografi, spacing, aksen, jadual, callout dan ritma halaman.',
      semakan_kualiti_sebelum_siap:[
        'Pastikan bilangan bab sesuai dengan skop yang dipilih.',
        'Pastikan setiap bab mempunyai kandungan sebenar yang berguna dan bukan pengulangan.',
        'Pastikan nada serta kedalaman sesuai dengan pembaca sasaran.',
        'Semak jumlah muka surat PDF akhir dan patuhi had keras jika ditetapkan.',
        'Semak clipping, overflow, glyph rosak, halaman kosong tidak sengaja dan kontras yang sukar dibaca.',
        'Pastikan muka surat pertama ialah kulit dan hasil akhir hanya SATU fail PDF.'
      ],
      output_akhir:{
        format:'SATU fail PDF yang kemas dan boleh dimuat turun',
        arahan_platform_ai:'Gunakan fungsi penciptaan dokumen/fail yang tersedia dan kembalikan PDF yang boleh dimuat turun. Jangan sekadar beri source code, Markdown, rangka atau prompt baharu.',
        urutan_mula:'Mulakan dengan kulit, kemudian hak cipta, sinopsis, isi kandungan, semua bab dan penutup. Selepas itu bina dan semak PDF sebelum memberi jawapan.',
        jawapan_selepas_fail_siap:'Jawapan chat hendaklah ringkas: maklumkan ebook siap dan berikan pautan muat turun PDF.'
      }
    };
    return 'Anda ialah penulis buku profesional merangkap pereka bentuk penerbitan. Baca konfigurasi JSON di bawah dan LAKSANAKAN tugasnya sekarang — tulis ebook penuh sehingga siap, bina susun atur penerbitan dan hasilkan satu fail PDF yang boleh dimuat turun. Jangan jana semula prompt ini.\n\n'+JSON.stringify(cfg,null,2);
  }

  function toneLabel(v,lang){
    var ms={friendly:'Santai & mesra',professional:'Profesional',motivation:'Motivasi',humour:'Jenaka',technical:'Teknikal & mendalam'};
    var en={friendly:'Friendly & conversational',professional:'Professional',motivation:'Motivational',humour:'Humorous',technical:'Technical & in-depth'};
    return (lang==='en'?en:ms)[v]||(lang==='en'?'Professional':'Profesional');
  }

  function updatePreview(prompt){
    currentPrompt=String(prompt||'');
    var box=byId('azebookPreview1345');
    if(!box)return;
    if(!currentPrompt){
      box.classList.add('is-empty');
      box.textContent='Isi maklumat di sebelah dan tekan “Jana Prompt PDF Ebook”. Direct PDF Production Prompt akan dipaparkan di sini.';
    }else{
      box.classList.remove('is-empty');
      box.textContent=currentPrompt;
    }
    ['azebookCopy1345','azebookDownload1345','azebookChatgpt1345'].forEach(function(id){var b=byId(id);if(b)b.disabled=!currentPrompt});
  }

  function savePrompt(s,prompt){
    var arr=safeHistory();
    var id='ebook-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    arr.unshift({id:id,createdAt:Date.now(),topic:s.topic||'Ebook',state:s,prompt:prompt});
    writeHistory(arr);
    renderHistory();
  }

  function renderHistory(){
    var host=byId('azebookHistoryList1345');
    var count=byId('azebookHistoryCount1345');
    if(!host)return;
    var arr=safeHistory();
    if(count)count.textContent=arr.length+' prompt';
    if(!arr.length){
      host.innerHTML='<div class="azebook-history-empty">Belum ada prompt tersimpan. Jana prompt pertama kamu dan ia akan muncul di sini.</div>';
      return;
    }
    host.innerHTML=arr.map(function(item){
      var st=item.state||{};
      return '<article class="azebook-history-item" data-azebook-id="'+esc(item.id)+'">'+
        '<div class="azebook-history-main"><h3>'+esc(item.topic||'Ebook')+'</h3><p>'+esc(formatDate(item.createdAt))+' • '+esc(st.language==='en'?'English':'Bahasa Melayu')+' • '+esc(sizeMeta(st.size||'medium').label)+'</p></div>'+
        '<div class="azebook-history-actions">'+
          '<button type="button" class="azebook-btn" data-azebook-action="load">Buka</button>'+
          '<button type="button" class="azebook-btn" data-azebook-action="copy">Copy</button>'+
          '<button type="button" class="azebook-btn" data-azebook-action="download">TXT</button>'+
          '<button type="button" class="azebook-btn danger" data-azebook-action="delete">Delete</button>'+
        '</div></article>';
    }).join('');
  }

  function populateForm(s){
    if(!s)return;
    var map={
      azebookTopic1345:s.topic||'',azebookAuthor1345:s.author||'',azebookAudience1345:s.audience||'',
      azebookTone1345:s.tone||'professional',azebookLanguage1345:s.language||'ms',azebookDesign1345:s.design||'minimal',azebookMaxPages1345:s.maxPages||''
    };
    Object.keys(map).forEach(function(id){var el=byId(id);if(el)el.value=map[id]});
    setSize(s.size||'medium');
  }

  function setSize(size){
    ACTIVE_SIZE=sizeMeta(size)?size:'medium';
    document.querySelectorAll('[data-azebook-size]').forEach(function(btn){btn.classList.toggle('is-active',btn.getAttribute('data-azebook-size')===ACTIVE_SIZE)});
  }

  function copyText(value){
    value=String(value||'');
    if(!value)return Promise.resolve(false);
    if(navigator.clipboard&&navigator.clipboard.writeText){return navigator.clipboard.writeText(value).then(function(){return true}).catch(function(){return fallbackCopy(value)})}
    return Promise.resolve(fallbackCopy(value));
  }
  function fallbackCopy(value){
    try{var ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();var ok=document.execCommand('copy');ta.remove();return ok}catch(_e){return false}
  }

  function downloadText(prompt,topic){
    if(!prompt)return;
    var blob=new Blob([prompt],{type:'text/plain;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    var safe=(topic||'ebook-prompt').replace(/[^a-z0-9\-_]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'ebook-prompt';
    a.href=url;a.download=safe+'-AZOBSS.txt';document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},2000);
  }

  function switchSub(view){
    var isHistory=view==='history';
    var gen=byId('azebookGeneratorView1345');
    var hist=byId('azebookHistoryView1345');
    if(gen)gen.hidden=isHistory;
    if(hist)hist.hidden=!isHistory;
    document.querySelectorAll('[data-azebook-subtab]').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-azebook-subtab')===view);b.setAttribute('aria-selected',b.classList.contains('is-active')?'true':'false')});
    if(isHistory)renderHistory();
  }

  function setMainTab(tab,scroll){
    var ebook=tab==='ebook';
    var ws=byId('azebookWorkspace1345');
    document.body.classList.toggle('azebook-mode-on',ebook);
    if(ws)ws.hidden=!ebook;
    try{
      var u=new URL(location.href);
      if(ebook)u.hash='ebook';else if(u.hash==='#ebook')u.hash='';
      history.replaceState(history.state,'',u.pathname+u.search+u.hash);
    }catch(_e){}
    if(ebook&&scroll){
      if(ws){var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;ws.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'})}
    }
  }

  function buildUI(downloadSection){
    var ws=document.createElement('section');
    ws.id='azebookWorkspace1345';
    ws.hidden=true;
    ws.innerHTML=[
      '<div class="azebook-hero">',
        '<span class="azebook-eyebrow">AZOBSS Ebook Studio</span>',
        '<h1>Jana Prompt PDF Ebook</h1>',
        '<p>Isi brief ebook, pilih gaya dan saiz, kemudian jana Direct PDF Production Prompt yang meminta AI menulis ebook penuh dan menghasilkan satu fail PDF. Prompt akan disimpan pada browser ini dalam “Prompt Saya”.</p>',
        '<div class="azebook-subtabs" role="tablist" aria-label="Ebook tools">',
          '<button type="button" class="azebook-subtab is-active" role="tab" aria-selected="true" data-azebook-subtab="generator">Jana Ebook</button>',
          '<button type="button" class="azebook-subtab" role="tab" aria-selected="false" data-azebook-subtab="history">Prompt Saya</button>',
        '</div>',
      '</div>',
      '<div id="azebookAccessGate1351" class="azebook-access-gate"><div class="azebook-paywall-card is-loading"><div class="azebook-paywall-icon">📚</div><h2>Semak akses Ebook Generator...</h2><p class="azebook-paywall-copy">Akses Pro ialah bayaran sekali sahaja RM19.</p></div></div>',
      '<div id="azebookPaidContent1351" hidden>',
      '<div id="azebookGeneratorView1345" class="azebook-view">',
        '<div class="azebook-grid">',
          '<section class="azebook-panel">',
            '<h2>Maklumat Ebook</h2><p class="azebook-panel-sub">Topik wajib. Maklumat lain membantu AI menghasilkan ebook yang lebih tepat.</p>',
            '<form id="azebookForm1345" class="azebook-form">',
              '<label class="azebook-field"><span>Topik Ebook <b class="azebook-required">*</b></span><input id="azebookTopic1345" type="text" maxlength="180" placeholder="Contoh: Cara bina PC gaming bajet untuk beginner"></label>',
              '<div class="azebook-row">',
                '<label class="azebook-field"><span>Nama Penulis</span><input id="azebookAuthor1345" type="text" maxlength="100" placeholder="Contoh: AZOBSS"></label>',
                '<label class="azebook-field"><span>Sasaran Pembaca</span><input id="azebookAudience1345" type="text" maxlength="180" placeholder="Contoh: Beginner, pelajar, pemilik bisnes"></label>',
              '</div>',
              '<div class="azebook-row">',
                '<label class="azebook-field"><span>Nada Penulisan</span><select id="azebookTone1345"><option value="friendly">Santai &amp; mesra</option><option value="professional" selected>Profesional</option><option value="motivation">Motivasi</option><option value="humour">Jenaka</option><option value="technical">Teknikal &amp; mendalam</option></select></label>',
                '<label class="azebook-field"><span>Bahasa Ebook</span><select id="azebookLanguage1345"><option value="ms" selected>Bahasa Melayu</option><option value="en">English</option></select></label>',
              '</div>',
              '<label class="azebook-field"><span>Gaya Reka Bentuk Ebook</span><select id="azebookDesign1345">',
                '<option value="minimal">Minimalis moden — banyak ruang putih, tulisan bersih</option>',
                '<option value="corporate">Korporat profesional — biru gelap, kemas, formal</option>',
                '<option value="classic">Elegan klasik — serif, gaya buku tradisional</option>',
                '<option value="bold">Bold &amp; berwarna — kontras kuat, tajuk besar</option>',
                '<option value="editorial">Majalah / editorial — visual besar, editorial</option>',
                '<option value="workbook">Buku kerja (workbook) — latihan &amp; checklist</option>',
                '<option value="motivation">Motivasi / self-help — quote &amp; action plan</option>',
                '<option value="technical">Panduan langkah demi langkah — jadual, checklist &amp; nota penting</option>',
                '<option value="pastel">Pastel lembut — lifestyle &amp; mesra</option>',
                '<option value="premium">Gelap premium — aksen emas, mewah</option>',
              '</select></label>',
              '<div class="azebook-field"><span>Saiz Ebook</span><div class="azebook-size-grid">',
                '<button type="button" class="azebook-size-btn" data-azebook-size="short"><strong>Ringkas</strong><span>15–20 m/s<br>5–7 bab</span></button>',
                '<button type="button" class="azebook-size-btn is-active" data-azebook-size="medium"><strong>Sederhana</strong><span>30–40 m/s<br>10–12 bab</span></button>',
                '<button type="button" class="azebook-size-btn" data-azebook-size="deep"><strong>Mendalam</strong><span>50–80 m/s<br>15–20 bab</span></button>',
              '</div></div>',
              '<label class="azebook-field"><span>Muka Surat Maksimum (pilihan)</span><input id="azebookMaxPages1345" type="number" min="5" max="300" step="1" placeholder="Contoh: 45"><small>Jika diisi, prompt akan meminta AI supaya ebook tidak melebihi jumlah ini.</small></label>',
              '<div class="azebook-actions"><button type="submit" class="azebook-btn primary">Jana Prompt PDF Ebook</button><button type="button" class="azebook-btn" id="azebookReset1345">Reset</button></div>',
            '</form>',
          '</section>',
          '<section class="azebook-panel azebook-preview-wrap">',
            '<h2>Direct PDF Prompt Preview</h2><p class="azebook-panel-sub">Prompt ini meminta AI menghasilkan ebook lengkap + satu fail PDF, bukan sekadar Markdown atau outline.</p>',
            '<div id="azebookPreview1345" class="azebook-preview is-empty">Isi maklumat di sebelah dan tekan “Jana Prompt PDF Ebook”. Direct PDF Production Prompt akan dipaparkan di sini.</div>',
            '<div class="azebook-preview-tools">',
              '<button type="button" class="azebook-btn green" id="azebookCopy1345" disabled>Copy Prompt</button>',
              '<button type="button" class="azebook-btn" id="azebookDownload1345" disabled>Download .TXT</button>',
              '<button type="button" class="azebook-btn yellow" id="azebookChatgpt1345" disabled>Open in ChatGPT</button>',
            '</div>',
            '<div id="azebookStatus1345" class="azebook-status" aria-live="polite"></div>',
          '</section>',
        '</div>',
      '</div>',
      '<div id="azebookHistoryView1345" class="azebook-view" hidden>',
        '<section class="azebook-panel">',
          '<div class="azebook-history-top"><div><h2>Prompt Saya</h2><p class="azebook-panel-sub" style="margin:4px 0 0">Disimpan pada browser/peranti ini.</p></div><div><span id="azebookHistoryCount1345" class="azebook-history-count">0 prompt</span> <button type="button" class="azebook-btn danger" id="azebookClearHistory1345" style="margin-left:8px;min-height:34px">Clear All</button></div></div>',
          '<div id="azebookHistoryList1345" class="azebook-history-list"></div>',
        '</section>',
      '</div>',
      '</div>',
      '<div id="azebookToast1345" class="azebook-toast" role="status" aria-live="polite"></div>'
    ].join('');
    downloadSection.parentNode.insertBefore(ws,downloadSection);
  }

  function bind(){
    document.addEventListener('click',function(e){
      var entry=e.target.closest('[data-azebook-entry]');
      if(entry){e.preventDefault();setMainTab('ebook',true);return}
      var sub=e.target.closest('[data-azebook-subtab]');
      if(sub){if(!ACCESS_GRANTED){toast('Unlock Ebook Generator dahulu');return}switchSub(sub.getAttribute('data-azebook-subtab'));return}
      var size=e.target.closest('[data-azebook-size]');
      if(size){if(!ACCESS_GRANTED)return;setSize(size.getAttribute('data-azebook-size'));return}
      var action=e.target.closest('[data-azebook-action]');
      if(action){
        var item=action.closest('[data-azebook-id]');
        if(!item)return;
        var id=item.getAttribute('data-azebook-id');
        var arr=safeHistory();
        var rec=arr.find(function(x){return x&&x.id===id});
        if(!rec)return;
        var act=action.getAttribute('data-azebook-action');
        if(act==='load'){
          populateForm(rec.state||{});updatePreview(rec.prompt||'');switchSub('generator');setStatus('Prompt lama dimuatkan.','ok');toast('Prompt dibuka');
        }else if(act==='copy'){
          copyText(rec.prompt||'').then(function(ok){toast(ok?'Prompt disalin':'Copy gagal')});
        }else if(act==='download'){
          downloadText(rec.prompt||'',rec.topic||'ebook-prompt');toast('Fail TXT disediakan');
        }else if(act==='delete'){
          writeHistory(arr.filter(function(x){return x&&x.id!==id}));renderHistory();toast('Prompt dipadam');
        }
      }
    });

    var form=byId('azebookForm1345');
    if(form)form.addEventListener('submit',function(e){
      e.preventDefault();
      try{
        if(!ACCESS_GRANTED){setStatus('Akses Ebook Generator belum dibuka.','error');toast('Unlock RM19 dahulu');return}
        var s=getFormState();
        if(!s.topic){setStatus('Masukkan Topik Ebook dahulu.','error');byId('azebookTopic1345').focus();return}
        if(s.maxPages){var n=Number(s.maxPages);if(!Number.isFinite(n)||n<5||n>300){setStatus('Muka Surat Maksimum mestilah antara 5 hingga 300.','error');byId('azebookMaxPages1345').focus();return}}
        var p=generatePrompt(s);
        updatePreview(p);savePrompt(s,p);setStatus('Direct PDF Production Prompt berjaya dijana dan disimpan dalam Prompt Saya.','ok');toast('Prompt PDF Ebook siap');
      }catch(err){
        console.error('[AZOBSS Ebook] Prompt generation failed:',err);
        setStatus('Gagal jana prompt: '+(err&&err.message?err.message:'ralat JavaScript tidak diketahui')+'. Cuba refresh halaman dan tekan semula.','error');
        toast('Gagal jana prompt');
      }
    });

    var reset=byId('azebookReset1345');
    if(reset)reset.addEventListener('click',function(){
      if(form)form.reset();setSize('medium');updatePreview('');setStatus('','');
    });
    var copy=byId('azebookCopy1345');
    if(copy)copy.addEventListener('click',function(){copyText(currentPrompt).then(function(ok){setStatus(ok?'Prompt disalin ke clipboard.':'Tidak dapat copy prompt.',''+(ok?'ok':'error'));toast(ok?'Prompt disalin':'Copy gagal')})});
    var dl=byId('azebookDownload1345');
    if(dl)dl.addEventListener('click',function(){var s=getFormState();downloadText(currentPrompt,s.topic);toast('Fail TXT disediakan')});
    var chat=byId('azebookChatgpt1345');
    if(chat)chat.addEventListener('click',function(){
      if(!currentPrompt)return;
      var url='https://chatgpt.com/';
      if(currentPrompt.length<=1800)url+='?q='+encodeURIComponent(currentPrompt);
      var opened=null;
      try{opened=window.open(url,'_blank','noopener')}catch(_e){}
      copyText(currentPrompt).then(function(ok){
        if(opened){
          setStatus('ChatGPT dibuka. Prompt '+(ok?'juga telah disalin; paste jika ia tidak terisi secara automatik.':'tidak dapat disalin secara automatik.'),'warn');
          toast(ok?'Prompt disalin + ChatGPT dibuka':'ChatGPT dibuka');
        }else{
          setStatus('Popup ChatGPT disekat browser. Benarkan popup dan cuba lagi.','error');
          toast('Popup ChatGPT disekat');
        }
      });
    });
    var clear=byId('azebookClearHistory1345');
    if(clear)clear.addEventListener('click',function(){
      var arr=safeHistory();if(!arr.length){toast('Tiada prompt untuk dipadam');return}
      if(window.confirm('Padam semua Prompt Saya pada browser ini?')){writeHistory([]);renderHistory();toast('Semua prompt dipadam')}
    });
  }

  function readEbookPaymentReturn(){
    var out={isReturn:false,statusId:'',billCode:'',orderId:'',transactionId:'',message:''};
    try{
      var u=new URL(location.href);
      var merged=new URLSearchParams(u.search||'');
      var hash=String(u.hash||'').replace(/^#/,'');
      if(/^ebook(?:&|$)/i.test(hash)){
        out.isReturn=true;
        var extra=hash.replace(/^ebook&?/i,'');
        if(extra){var hp=new URLSearchParams(extra);hp.forEach(function(v,k){if(!merged.has(k))merged.set(k,v)})}
      }
      if(String(merged.get('ebook_payment')||'').toLowerCase()==='return')out.isReturn=true;
      out.statusId=text(merged.get('status_id'));
      out.billCode=text(merged.get('billcode')||merged.get('billCode'));
      out.orderId=text(merged.get('order_id')||merged.get('orderId'));
      out.transactionId=text(merged.get('transaction_id')||merged.get('transactionId'));
      out.message=text(merged.get('msg'));
    }catch(_e){}
    return out;
  }
  function canonicalEbookUrl(){
    try{history.replaceState(history.state,'','/Software-Tools/#ebook')}catch(_e){location.hash='ebook'}
  }
  function waitMs(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function handleEbookPaymentReturn(info){
    if(!info||!info.isReturn)return false;
    setMainTab('ebook',false);
    var old=pendingPayment()||{};
    if(info.billCode||info.orderId){
      setPendingPayment(Object.assign({},old,{billCode:info.billCode||old.billCode||'',orderId:info.orderId||old.orderId||'',transactionId:info.transactionId||old.transactionId||'',returnedAtMs:Date.now()}));
    }
    updateGate({access:false,reason:'payment_pending',pending:pendingPayment()});
    gateStatus(info.statusId==='1'?'Bayaran diterima. Sedang mengesahkan akses seumur hidup...':'Sedang menyemak status pembayaran...',false);
    var tries=info.statusId==='1'?5:2;
    for(var i=0;i<tries;i++){
      var ok=await checkLifetimeAccess(true);
      if(ok){canonicalEbookUrl();gateStatus('Pembayaran disahkan. Akses Ebook Generator aktif.',false);toast('Akses Ebook Generator aktif');return true}
      if(i<tries-1)await waitMs(1200);
    }
    canonicalEbookUrl();
    if(info.statusId==='1')gateStatus('Bayaran berjaya tetapi pengesahan gateway masih diproses. Tunggu beberapa saat; halaman ini akan semak semula apabila dibuka.',false);
    else gateStatus('Pembayaran belum disahkan. Jika wang sudah ditolak, tunggu sebentar dan buka semula Ebook Generator.',false);
    return false;
  }

  function init(){
    if(byId('azebookWorkspace1345'))return;
    var downloads=document.querySelector('.downloads-section');
    if(!downloads)return;
    buildUI(downloads);
    bind();
    renderHistory();
    updatePreview('');
    updateGate({access:false,reason:'loading'});
    var paymentReturn=readEbookPaymentReturn();
    if(paymentReturn.isReturn){handleEbookPaymentReturn(paymentReturn);}
    else{
      var cached=restoreCachedAccess();
      checkLifetimeAccess(false,cached?{background:true}:{});
      if(String(location.hash||'').toLowerCase()==='#ebook')setMainTab('ebook',false);
    }
    window.addEventListener('hashchange',function(){
      if(String(location.hash||'').toLowerCase()==='#ebook')setMainTab('ebook',false);
      else if(document.body.classList.contains('azebook-mode-on'))setMainTab('software',false);
    });
    window.addEventListener('azobss:auth-state-ready',function(event){
      if(String(location.hash||'').toLowerCase()!=='#ebook')return;
      if(event&&event.detail&&event.detail.loggedIn===false){clearAccessCache();updateGate({access:false,loginRequired:true,reason:'login_required'});return;}
      var cached=restoreCachedAccess();if(!cached)updateGate({access:false,reason:'loading'});
      checkLifetimeAccess(true,cached?{background:true}:{});
    });
    window.addEventListener('pageshow',function(){if(String(location.hash||'').toLowerCase()==='#ebook'){var cached=restoreCachedAccess();checkLifetimeAccess(false,cached?{background:true}:{})}});
    window.addEventListener('focus',function(){if(String(location.hash||'').toLowerCase()==='#ebook'){var cached=restoreCachedAccess();if(!ACCESS_GRANTED||!cached)checkLifetimeAccess(false,cached?{background:true}:{})}});
    try{document.documentElement.setAttribute('data-azobss-ebook-module',VERSION)}catch(_e){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
