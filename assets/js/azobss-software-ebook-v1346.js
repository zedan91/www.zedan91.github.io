/* AZOBSS v1346 — Software Tools > Ebook guide-design wording + prompt logic fix */
(function(){
  'use strict';

  var VERSION='1346';
  var STORAGE_KEY='azobssEbookPromptsV1345';
  var ACTIVE_SIZE='medium';
  var currentPrompt='';
  var toastTimer=0;

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

  function designInstruction(v,lang){
    var ms={
      minimal:'Minimalis moden — banyak ruang putih, hierarki tajuk bersih dan tipografi mudah dibaca.',
      corporate:'Korporat profesional — kemas, formal, tona biru gelap dan struktur konsisten.',
      classic:'Elegan klasik — gaya buku tradisional, serif pada tajuk dan susun atur tenang.',
      bold:'Bold & berwarna — kontras kuat, tajuk besar dan callout yang jelas.',
      editorial:'Majalah / editorial — visual besar, pembahagian seksyen yang kuat dan layout editorial.',
      workbook:'Buku kerja (workbook) — sertakan kotak latihan, checklist, ruang refleksi dan action steps.',
      motivation:'Motivasi / self-help — quote besar, warna hangat, latihan refleksi dan action plan.',
      technical:'Panduan langkah demi langkah — gunakan langkah bernombor, jadual, checklist, kotak nota/peringatan dan contoh praktikal apabila sesuai. Jangan gunakan blok kod kecuali topik memang berkaitan pemprograman atau IT.',
      pastel:'Pastel lembut — visual mesra, ringan dan sesuai untuk lifestyle.',
      premium:'Gelap premium — latar gelap, aksen emas dan rasa mewah tetapi kekal mudah dibaca.'
    };
    var en={
      minimal:'Modern minimalist — generous whitespace, clean heading hierarchy and highly readable typography.',
      corporate:'Professional corporate — clean, formal, dark-blue tone and consistent structure.',
      classic:'Classic elegant — traditional book feel, serif-style headings and calm composition.',
      bold:'Bold & colourful — strong contrast, large headings and clear visual callouts.',
      editorial:'Magazine / editorial — large visuals, strong section breaks and editorial composition.',
      workbook:'Workbook — include exercises, checklists, reflection boxes and actionable worksheets.',
      motivation:'Motivation / self-help — large quotes, warm tone, reflection prompts and action plans.',
      technical:'Step-by-step guide — use numbered procedures, tables, checklists, note/warning boxes and practical examples when useful. Do not use code blocks unless the topic genuinely involves programming or IT.',
      pastel:'Soft pastel — friendly, light visual style suitable for lifestyle content.',
      premium:'Dark premium — dark background, gold accents and a premium feel while staying readable.'
    };
    return (lang==='en'?en:ms)[v]||(lang==='en'?en.minimal:ms.minimal);
  }

  function getFormState(){
    var maxEl=byId('azebookMaxPages1345');
    var maxPages=text(maxEl&&maxEl.value);
    return {
      topic:text(byId('azebookTopic1345')&&byId('azebookTopic1345').value),
      author:text(byId('azebookAuthor1345')&&byId('azebookAuthor1345').value),
      audience:text(byId('azebookAudience1345')&&byId('azebookAudience1345').value),
      tone:text(byId('azebookTone1345')&&byId('azebookTone1345').value)||'professional',
      language:text(byId('azebookLanguage1345')&&byId('azebookLanguage1345').value)||'ms',
      design:text(byId('azebookDesign1345')&&byId('azebookDesign1345').value)||'minimal',
      size:ACTIVE_SIZE,
      maxPages:maxPages
    };
  }

  function generatePrompt(s){
    var meta=sizeMeta(s.size)||sizeMeta('medium');
    var maxPages=s.maxPages?Number(s.maxPages):0;
    var author=s.author||'Tidak dinyatakan';
    var audience=s.audience||'Pembaca umum yang berminat dengan topik ini';
    var design=designInstruction(s.design,s.language);

    if(s.language==='en'){
      return [
        'You are a professional ebook writer, editor, content strategist and publication designer.',
        '',
        'Create a COMPLETE, publication-ready ebook using the specification below. Do not stop at an outline. Write the actual ebook from beginning to end.',
        '',
        'EBOOK BRIEF',
        '- Topic: '+s.topic,
        '- Author: '+author,
        '- Target readers: '+audience,
        '- Writing tone: '+toneLabel(s.tone,'en'),
        '- Language: English',
        '- Ebook size: '+meta.label+' ('+meta.pages+', '+meta.chapters+', '+meta.words+')',
        '- Maximum pages: '+(maxPages?maxPages+' pages (hard ceiling)':'Follow the selected ebook size'),
        '- Design direction: '+design,
        '',
        'CONTENT REQUIREMENTS',
        '1. Propose a strong ebook title and subtitle that fit the topic and audience.',
        '2. Start with a clean cover-page text block: title, subtitle and author.',
        '3. Include a short copyright / disclaimer section appropriate to the topic.',
        '4. Include a table of contents.',
        '5. Write a useful introduction explaining the reader problem, desired outcome and what the ebook will cover.',
        '6. Write the full chapters, not placeholders. Keep each chapter focused, practical and easy to follow.',
        '7. Use examples, mini case studies, tables, checklists, step-by-step instructions and callout notes when they genuinely improve understanding. Use code blocks only when the topic genuinely involves programming, scripts or technical code.',
        '8. End each chapter with a short recap and/or action steps when appropriate.',
        '9. Finish with a conclusion and a practical next-step plan for the reader.',
        '10. Do not invent statistics, quotations, research papers, laws, product specifications or factual claims. If a fact is uncertain, clearly mark it for verification rather than fabricating a source.',
        '11. Avoid repetitive filler. Prioritise useful information and natural transitions between chapters.',
        '',
        'FORMAT & DESIGN',
        '- Format the output in clean Markdown that can be converted into PDF.',
        '- Use H1/H2/H3 headings consistently.',
        '- Use short paragraphs, lists and tables for readability.',
        '- Add [PAGE BREAK] only where a new major section should begin.',
        '- Add [IMAGE SUGGESTION: ...] only where an illustration would genuinely help; do not overuse it.',
        '- Follow this design direction: '+design,
        maxPages?'- Keep the complete ebook within a maximum of '+maxPages+' pages. Condense chapters intelligently if necessary.':'- Keep the depth aligned with the selected '+meta.label+' size.',
        '',
        'QUALITY CHECK BEFORE FINAL ANSWER',
        '- Confirm the chapter count is appropriate for the selected size.',
        '- Check that the content matches the target readers and chosen tone.',
        '- Remove duplicate ideas and generic filler.',
        '- Ensure the ebook is complete enough to copy into a document editor and export as PDF.',
        '',
        'Now write the complete ebook.'
      ].join('\n');
    }

    return [
      'Anda ialah penulis ebook profesional, editor, pakar strategi kandungan dan pereka penerbitan.',
      '',
      'Hasilkan sebuah EBOOK LENGKAP yang sedia untuk diterbitkan berdasarkan spesifikasi di bawah. Jangan berhenti pada outline sahaja. Tulis kandungan sebenar dari awal hingga akhir.',
      '',
      'BRIEF EBOOK',
      '- Topik: '+s.topic,
      '- Nama penulis: '+author,
      '- Sasaran pembaca: '+audience,
      '- Nada penulisan: '+toneLabel(s.tone,'ms'),
      '- Bahasa: Bahasa Melayu',
      '- Saiz ebook: '+meta.label+' ('+meta.pages+', '+meta.chapters+', '+meta.words+')',
      '- Muka surat maksimum: '+(maxPages?maxPages+' muka surat (had keras)':'Ikut saiz ebook yang dipilih'),
      '- Arah reka bentuk: '+design,
      '',
      'KEPERLUAN KANDUNGAN',
      '1. Cadangkan tajuk utama dan subtajuk ebook yang kuat serta sesuai dengan topik dan sasaran pembaca.',
      '2. Mulakan dengan blok muka depan yang kemas: tajuk, subtajuk dan nama penulis.',
      '3. Sertakan bahagian hak cipta / disclaimer ringkas yang sesuai dengan topik.',
      '4. Sertakan isi kandungan.',
      '5. Tulis pengenalan yang menerangkan masalah pembaca, hasil yang mahu dicapai dan apa yang akan dipelajari.',
      '6. Tulis semua bab dengan kandungan penuh, bukan placeholder. Setiap bab mesti fokus, praktikal dan mudah diikuti.',
      '7. Gunakan contoh, mini kajian kes, jadual, checklist, langkah demi langkah dan nota penting apabila benar-benar membantu kefahaman. Gunakan blok kod hanya jika topik memang berkaitan pemprograman, skrip atau kod teknikal.',
      '8. Akhiri setiap bab dengan ringkasan pendek dan/atau tindakan seterusnya jika sesuai.',
      '9. Akhiri ebook dengan kesimpulan serta pelan tindakan praktikal untuk pembaca.',
      '10. Jangan mereka-reka statistik, petikan, kajian, undang-undang, spesifikasi produk atau fakta. Jika sesuatu fakta tidak pasti, tandakan dengan jelas supaya disahkan kemudian dan jangan cipta sumber palsu.',
      '11. Elakkan pengulangan dan ayat pengisi. Utamakan kandungan berguna serta aliran antara bab yang natural.',
      '',
      'FORMAT & REKA BENTUK',
      '- Gunakan Markdown yang kemas supaya mudah ditukar kepada PDF.',
      '- Gunakan hierarki H1/H2/H3 secara konsisten.',
      '- Gunakan perenggan pendek, senarai dan jadual untuk mudah dibaca.',
      '- Masukkan [PAGE BREAK] hanya apabila seksyen utama baharu patut bermula.',
      '- Masukkan [CADANGAN GAMBAR: ...] hanya apabila ilustrasi benar-benar membantu; jangan berlebihan.',
      '- Ikut arah reka bentuk ini: '+design,
      maxPages?'- Pastikan keseluruhan ebook tidak melebihi '+maxPages+' muka surat. Padatkan bab secara bijak jika perlu.':'- Kekalkan kedalaman kandungan mengikut saiz '+meta.label+' yang dipilih.',
      '',
      'SEMAKAN KUALITI SEBELUM JAWAPAN AKHIR',
      '- Pastikan bilangan bab sesuai dengan saiz yang dipilih.',
      '- Pastikan kandungan benar-benar sesuai untuk sasaran pembaca dan nada penulisan.',
      '- Buang idea berulang dan ayat generik yang tidak memberi nilai.',
      '- Pastikan ebook cukup lengkap untuk disalin ke editor dokumen dan dieksport sebagai PDF.',
      '',
      'Sekarang tulis ebook lengkap tersebut.'
    ].join('\n');
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
      box.textContent='Isi maklumat di sebelah dan tekan “Jana Prompt Ebook”. Prompt penuh akan dipaparkan di sini.';
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
    document.querySelectorAll('[data-azebook-main-tab]').forEach(function(b){var active=b.getAttribute('data-azebook-main-tab')===(ebook?'ebook':'software');b.classList.toggle('is-active',active);b.setAttribute('aria-selected',active?'true':'false')});
    try{
      var u=new URL(location.href);
      if(ebook)u.hash='ebook';else if(u.hash==='#ebook')u.hash='';
      history.replaceState(history.state,'',u.pathname+u.search+u.hash);
    }catch(_e){}
    if(ebook&&scroll){
      var shell=byId('azebookTabs1345');
      if(shell){var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;shell.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'})}
    }
  }

  function buildUI(downloadSection){
    var shell=document.createElement('div');
    shell.id='azebookTabs1345';
    shell.className='azebook-tabs-shell';
    shell.innerHTML='<div class="azebook-main-tabs" role="tablist" aria-label="Software Tools sections">'+
      '<button type="button" class="azebook-main-tab is-active" role="tab" aria-selected="true" data-azebook-main-tab="software">Software</button>'+
      '<button type="button" class="azebook-main-tab" role="tab" aria-selected="false" data-azebook-main-tab="ebook">Ebook <span class="azebook-new">NEW</span></button>'+
    '</div>';
    downloadSection.parentNode.insertBefore(shell,downloadSection);

    var ws=document.createElement('section');
    ws.id='azebookWorkspace1345';
    ws.hidden=true;
    ws.innerHTML=[
      '<div class="azebook-hero">',
        '<span class="azebook-eyebrow">AZOBSS Ebook Studio</span>',
        '<h1>Jana Prompt Ebook</h1>',
        '<p>Isi brief ebook, pilih gaya dan saiz, kemudian jana prompt lengkap untuk digunakan dalam ChatGPT. Prompt yang dijana akan disimpan pada browser ini dalam “Prompt Saya”.</p>',
        '<div class="azebook-subtabs" role="tablist" aria-label="Ebook tools">',
          '<button type="button" class="azebook-subtab is-active" role="tab" aria-selected="true" data-azebook-subtab="generator">Jana Ebook</button>',
          '<button type="button" class="azebook-subtab" role="tab" aria-selected="false" data-azebook-subtab="history">Prompt Saya</button>',
        '</div>',
      '</div>',
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
              '<div class="azebook-actions"><button type="submit" class="azebook-btn primary">Jana Prompt Ebook</button><button type="button" class="azebook-btn" id="azebookReset1345">Reset</button></div>',
            '</form>',
          '</section>',
          '<section class="azebook-panel azebook-preview-wrap">',
            '<h2>Prompt Preview</h2><p class="azebook-panel-sub">Boleh terus copy, simpan sebagai TXT atau buka ChatGPT.</p>',
            '<div id="azebookPreview1345" class="azebook-preview is-empty">Isi maklumat di sebelah dan tekan “Jana Prompt Ebook”. Prompt penuh akan dipaparkan di sini.</div>',
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
      '<div id="azebookToast1345" class="azebook-toast" role="status" aria-live="polite"></div>'
    ].join('');
    downloadSection.parentNode.insertBefore(ws,downloadSection.nextSibling);
  }

  function bind(){
    document.addEventListener('click',function(e){
      var main=e.target.closest('[data-azebook-main-tab]');
      if(main){setMainTab(main.getAttribute('data-azebook-main-tab'),true);return}
      var sub=e.target.closest('[data-azebook-subtab]');
      if(sub){switchSub(sub.getAttribute('data-azebook-subtab'));return}
      var size=e.target.closest('[data-azebook-size]');
      if(size){setSize(size.getAttribute('data-azebook-size'));return}
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
      var s=getFormState();
      if(!s.topic){setStatus('Masukkan Topik Ebook dahulu.','error');byId('azebookTopic1345').focus();return}
      if(s.maxPages){var n=Number(s.maxPages);if(!Number.isFinite(n)||n<5||n>300){setStatus('Muka Surat Maksimum mestilah antara 5 hingga 300.','error');byId('azebookMaxPages1345').focus();return}}
      var p=generatePrompt(s);
      updatePreview(p);savePrompt(s,p);setStatus('Prompt berjaya dijana dan disimpan dalam Prompt Saya.','ok');toast('Prompt Ebook siap');
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

  function init(){
    if(byId('azebookTabs1345'))return;
    var downloads=document.querySelector('.downloads-section');
    if(!downloads)return;
    buildUI(downloads);
    bind();
    renderHistory();
    updatePreview('');
    if(String(location.hash||'').toLowerCase()==='#ebook')setMainTab('ebook',false);
    window.addEventListener('hashchange',function(){if(String(location.hash||'').toLowerCase()==='#ebook')setMainTab('ebook',false)});
    try{document.documentElement.setAttribute('data-azobss-ebook-module',VERSION)}catch(_e){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
