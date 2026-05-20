(function(){
  const STORAGE_KEY = 'azobss_affiliate_products_v4';
  const ADMIN_USERNAME = 'zedan91';

  function qs(s){return document.querySelector(s);}
  function qsa(s){return Array.from(document.querySelectorAll(s));}
  function clean(v){return String(v || '').trim().toLowerCase();}

  function getCurrentUserObject(){
    const raw = sessionStorage.getItem('azobssCurrentUser');
    if(!raw) return null;
    try{
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }

  function adminDetected(){
    // Must be signed in first
    if(sessionStorage.getItem('azobssLoggedIn') !== '1'){
      return false;
    }

    const currentUser = getCurrentUserObject();

    // Your existing login system uses usernameKey
    if(currentUser && clean(currentUser.usernameKey) === ADMIN_USERNAME){
      return true;
    }

    // Fallback if visible username is exactly zedan91
    const signedInName = clean(qs('#signedInName')?.textContent || qs('.user-name')?.textContent);
    if(signedInName === ADMIN_USERNAME){
      return true;
    }

    return false;
  }

  function refreshAdminState(){
    if(adminDetected()){
      document.body.classList.add('is-admin');
    }else{
      document.body.classList.remove('is-admin');
    }
  }

  function esc(text){
    return String(text || '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[c]));
  }

  function getWrap(){return qs('.affiliate-products');}

  function ensureCardAdminButtons(){
    qsa('.affiliate-product-card').forEach((card, index) => {
      if(!card.dataset.affiliateId){
        card.dataset.affiliateId = 'aff-' + index + '-' + Date.now();
      }

      if(!card.querySelector('.affiliate-card-admin-actions')){
        const actions = document.createElement('div');
        actions.className = 'affiliate-card-admin-actions';
        actions.innerHTML = `
          <button class="edit" type="button" data-affiliate-edit="${esc(card.dataset.affiliateId)}">Edit</button>
          <button class="delete" type="button" data-affiliate-delete="${esc(card.dataset.affiliateId)}">Delete</button>
        `;
        card.prepend(actions);
      }
    });

    refreshAdminState();
  }

  function cardToProduct(card, index){
    const link = card.querySelector('a.btn, a[href]');
    return {
      id: card.dataset.affiliateId || ('aff-' + index + '-' + Date.now()),
      icon: (card.querySelector('.affiliate-product-icon')?.textContent || 'AZ').trim(),
      badge: (card.querySelector('.affiliate-badge')?.textContent || 'Affiliate').trim(),
      title: (card.querySelector('h3')?.textContent || 'Affiliate Product').trim(),
      desc: (card.querySelector('p')?.textContent || '').trim(),
      category: (card.dataset.category || '').trim(),
      meta: (card.querySelector('.affiliate-product-meta')?.textContent || '').trim(),
      link: link ? link.href : '#'
    };
  }

  function getProductsFromDOM(){
    ensureCardAdminButtons();
    return qsa('.affiliate-product-card').map(cardToProduct);
  }

  function saveProducts(products){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }

  function loadSavedProducts(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if(Array.isArray(saved) && saved.length){
        return saved;
      }
    }catch(e){}
    return null;
  }

  function productHTML(p){
    return `
      <article class="affiliate-product-card" data-affiliate-id="${esc(p.id)}" data-category="${esc(p.category || '')}">
        <div class="affiliate-card-admin-actions">
          <button class="edit" type="button" data-affiliate-edit="${esc(p.id)}">Edit</button>
          <button class="delete" type="button" data-affiliate-delete="${esc(p.id)}">Delete</button>
        </div>

        <div class="affiliate-product-top">
          <div class="affiliate-product-icon">${esc(p.icon || 'AZ')}</div>
          <span class="affiliate-badge">${esc(p.badge || 'Affiliate')}</span>
        </div>

        <h3>${esc(p.title)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="affiliate-product-meta">${esc(p.meta || '')}</div>
        <a class="btn blue" href="${esc(p.link || '#')}" target="_blank" rel="noopener">View on Shopee</a>
      </article>
    `;
  }

  let products = [];

  function renderProducts(){
    const wrap = getWrap();
    if(!wrap) return;

    wrap.innerHTML = products.map(productHTML).join('');
    refreshAdminState();
    document.dispatchEvent(new CustomEvent('azobssAffiliateUpdated'));
  }

  function openModal(product){
    qs('#affiliateAdminTitle').textContent = product ? 'Edit Affiliate' : 'Add Affiliate';
    qs('#affiliateEditId').value = product ? product.id : '';
    qs('#affiliateIcon').value = product ? product.icon : '';
    qs('#affiliateBadge').value = product ? product.badge : '';
    qs('#affiliateTitleInput').value = product ? product.title : '';
    qs('#affiliateDescInput').value = product ? product.desc : '';
    qs('#affiliateCategoryInput').value = product ? product.category : 'computer';
    qs('#affiliateMetaInput').value = product ? product.meta : '';
    qs('#affiliateLinkInput').value = product ? product.link : '';
    if(qs('#affiliateManualTitleInput')) qs('#affiliateManualTitleInput').value = product ? product.title : '';
    setDetectStatus('Paste full Shopee product link, click Auto Detect. Jika Shopee block, tekan Open dan copy tajuk produk ke backup.', false);
    setTitleFillStatus('Backup paling stabil: paste tajuk produk Shopee, kemudian Auto Fill untuk isi category, badge, icon, description dan meta.', false);
    qs('#affiliateAdminModal').classList.add('is-open');
  }



  function setDetectStatus(message, isError){
    const status = qs('#affiliateDetectStatus');
    if(!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function setTitleFillStatus(message, isError){
    const status = qs('#affiliateTitleFillStatus');
    if(!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function affiliateRule(title){
    const t = String(title || '').toLowerCase();
    const has = (re) => re.test(t);

    /* Kitchen / cookware must be checked before generic computer words like "set" */
    if(has(/tefal|supercook|cookware|frypan|frying pan|wok|stewpot|soup pot|casserole|saucepan|pan\b|\bpot\b|spatula|ladle|knife|chopper|cutlery|kitchen|dapur|periuk|kuali|penggoreng|senduk|pinggan|mangkuk|bekas makanan|food container|lunch box|tupperware|thermos|flask/)){
      return {category:'home-living', badge:'Kitchen Essentials', icon:'🍳', meta:'Best for cooking and daily kitchen use', desc:'sesuai untuk kegunaan dapur harian. Praktikal untuk memasak, penyediaan makanan dan kegunaan rumah.'};
    }

    if(has(/air fryer|rice cooker|pressure cooker|multi cooker|slow cooker|induction cooker|microwave|oven|toaster|blender|mixer|food processor|meat grinder|grinder|kettle|water dispenser|coffee maker|juicer|appliance|mesin basuh|washing machine|refrigerator|fridge|freezer|iron|steam iron/)){
      return {category:'home-appliances', badge:'Home Appliance', icon:'🔌', meta:'Best for easier daily home use', desc:'sesuai untuk memudahkan kerja harian di rumah. Berguna untuk menjimatkan masa dan lebih praktikal digunakan setiap hari.'};
    }

    if(has(/vacuum|cordless vacuum|handheld vacuum|cleaner|mop|spin mop|robot vacuum|penyapu|habuk|dust|lint remover|washer|cleaning|pembersih|detergent|sabun lantai|trash bin|tong sampah/)){
      return {category:'home-living', badge:'Cleaning Gadget', icon:'🧹', meta:'Best for home and car cleaning', desc:'sesuai untuk pembersihan rumah atau kereta. Mudah digunakan untuk habuk, celah kecil dan kegunaan harian.'};
    }

    if(has(/ssd|nvme|m\.2|hard disk|hdd|ram|ddr4|ddr5|gpu|rtx|gtx|radeon|processor|cpu|motherboard|pc case|power supply|psu|monitor|keyboard|mouse|gaming mouse|printer|scanner|webcam|usb hub|type-c hub|laptop stand|thermal paste|cooling fan|cooler|speaker|headset|earphone|microphone|mic|capture card/)){
      return {category:'computer', badge: has(/ssd|nvme|m\.2|storage/) ? 'Fast Storage' : 'Computer & Accessories', icon:'💻', meta: has(/ssd|nvme|m\.2/) ? 'Best for Windows and game loading' : 'Best for PC setup and daily use', desc:'sesuai untuk setup PC, laptop atau kerja harian. Berguna untuk upgrade, produktiviti dan penggunaan digital.'};
    }

    if(has(/router|wifi|wi-fi|mesh|modem|lan cable|ethernet|network|5g router|4g router|repeater|extender|switch hub/)){
      return {category:'computer', badge:'Networking', icon:'5G', meta:'Best for stronger home internet setup', desc:'sesuai untuk setup internet rumah atau pejabat dengan sambungan rangkaian yang lebih stabil.'};
    }

    if(has(/iphone|android|smartphone|phone|telefon|phone case|casing|screen protector|tempered glass|charger|fast charger|powerbank|power bank|usb c|type c|lightning cable|cable|adapter|magsafe|holder phone|phone holder|tripod phone/)){
      return {category:'mobile', badge:'Daily Tech', icon:'📱', meta:'Useful mobile gadget for daily use', desc:'sesuai untuk kegunaan telefon harian. Praktikal untuk caj, perlindungan, aksesori dan penggunaan mudah alih.'};
    }

    if(has(/dashcam|dash cam|car camera|car vacuum|car charger|jump starter|tyre|tire|tayar|automotive|kereta|motor|motorcycle|car mat|carpet car|seat cover|car holder|windshield|wiper|engine oil|minyak hitam|polish|wax|coating/)){
      return {category:'automotive', badge:'Car Essential', icon:'🚗', meta:'Best for daily car use', desc:'sesuai untuk kegunaan kereta harian. Berguna sebagai aksesori tambahan yang praktikal dan membantu perjalanan.'};
    }

    if(has(/camera|dslr|mirrorless|action cam|gopro|drone|dji|cctv|ip camera|webcam|lens|tripod|gimbal|stabilizer|ring light|lighting/)){
      return {category:'cameras-drones', badge:'Camera Gear', icon:'CAM', meta:'Best for photo, video and content setup', desc:'sesuai untuk rakaman gambar, video, keselamatan atau content creation. Berguna untuk kerja harian dan setup kreatif.'};
    }

    if(has(/ps5|ps4|xbox|nintendo|switch|console|controller|gamepad|gaming chair|gaming desk|game\b|games\b/)){
      return {category:'gaming-consoles', badge:'Gaming Gear', icon:'🎮', meta:'Best for gaming setup', desc:'sesuai untuk setup gaming dan hiburan. Berguna untuk pengalaman bermain yang lebih selesa.'};
    }

    if(has(/watch|smartwatch|smart watch|jam tangan|casio|seiko|g-shock|gshock/)){
      return {category:'watches', badge:'Watch Pick', icon:'⌚', meta:'Daily watch and style item', desc:'sesuai untuk kegunaan harian, gaya dan kemudahan semak masa atau fungsi pintar.'};
    }

    if(has(/handbag|tote bag|women bag|beg wanita|purse|sling bag wanita|shoulder bag/)){
      return {category:'womens-bags', badge:'Bag Pick', icon:'👜', meta:'Useful bag for daily carry', desc:'sesuai untuk kegunaan harian, kerja atau travel. Mudah bawa barang penting dengan lebih kemas.'};
    }

    if(has(/wallet|dompet|men bag|beg lelaki|sling bag lelaki|crossbody bag|card holder/)){
      return {category:'mens-bags', badge:'Daily Carry', icon:'👝', meta:'Best for wallet and daily carry', desc:'sesuai untuk simpan barang penting harian seperti kad, duit dan aksesori kecil.'};
    }

    if(has(/dress|blouse|skirt|women clothes|baju perempuan|kurung|kebaya|abaya|jubah wanita/)){
      return {category:'women-clothes', badge:'Women Fashion', icon:'👗', meta:'Popular fashion item', desc:'sesuai untuk gaya harian, kerja atau majlis. Pilihan pakaian wanita yang mudah dipadankan.'};
    }

    if(has(/shirt|tshirt|t-shirt|polo|men clothes|baju lelaki|seluar lelaki|pants|jeans|shorts|hoodie|jacket/)){
      return {category:'men-clothes', badge:'Men Fashion', icon:'👕', meta:'Daily men fashion item', desc:'sesuai untuk pakaian harian, santai atau kerja. Mudah dipadankan dengan gaya ringkas.'};
    }

    if(has(/tudung|hijab|shawl|telekung|kopiah|sejadah|muslim|jubah|abaya/)){
      return {category:'muslim', badge:'Muslim Fashion', icon:'🧕', meta:'Useful Muslim fashion item', desc:'sesuai untuk kegunaan harian, ibadah atau gaya muslimah/muslim yang kemas.'};
    }

    if(has(/women shoe|heels|high heel|flat shoe|kasut wanita|sandal wanita/)){
      return {category:'women-shoes', badge:'Women Shoes', icon:'👠', meta:'Daily footwear pick', desc:'sesuai untuk kegunaan harian, kerja atau gaya santai. Pilihan kasut yang mudah dipadankan.'};
    }

    if(has(/shoe|shoes|sneaker|kasut|sandal|slipper|boots/)){
      return {category:'men-shoes', badge:'Shoes Pick', icon:'👟', meta:'Daily footwear pick', desc:'sesuai untuk kegunaan harian, berjalan atau gaya santai. Pilihan kasut yang praktikal.'};
    }

    if(has(/beauty|skincare|skin care|makeup|serum|sunscreen|moisturizer|cleanser|lipstick|perfume|health|supplement|masker|facial|shampoo|hair dryer|trimmer|shaver/)){
      return {category:'health', badge:'Self Care', icon:'✨', meta:'Best for self care and daily routine', desc:'sesuai untuk penjagaan diri, kesihatan atau rutin harian. Semak kesesuaian sebelum membeli.'};
    }

    if(has(/baby|kids|kid|toy|toys|mainan|stroller|milk bottle|botol susu|diaper|lampin|school bag|beg sekolah/)){
      return {category:'baby-toys', badge:'Baby & Kids', icon:'🧸', meta:'Useful for baby and kids', desc:'sesuai untuk bayi, kanak-kanak atau kegunaan keluarga. Praktikal untuk keperluan harian.'};
    }

    if(has(/food|coklat|chocolate|snack|biscuit|cookies|kopi|coffee|tea|grocery|groceries|minuman|makanan|instant noodle|pet food|cat food|dog food|kibble/)){
      return {category:'groceries-pets', badge: has(/chocolate|coklat/) ? 'Chocolate' : 'Groceries', icon:'🍫', meta:'Best for snack, grocery or daily stock', desc:'sesuai untuk stok harian, kudapan atau keperluan rumah. Semak detail produk sebelum membeli.'};
    }

    if(has(/gym|dumbbell|fitness|yoga|cycling|bicycle|sport|sports|outdoor|camping|camp|tent|hiking|fishing|badminton|football/)){
      return {category:'sports', badge:'Sports & Outdoor', icon:'🏕️', meta:'Best for workout and outdoor activity', desc:'sesuai untuk aktiviti sukan, workout atau outdoor. Berguna untuk gaya hidup aktif.'};
    }

    if(has(/book|books|novel|komik|comic|stationery|alat tulis|hobby|puzzle|lego|model kit/)){
      return {category:'books', badge:'Books & Hobby', icon:'📚', meta:'Best for reading and hobby', desc:'sesuai untuk bacaan, pembelajaran atau hobi masa lapang.'};
    }

    if(has(/travel|luggage|bagasi|suitcase|passport holder|neck pillow|travel bag|organizer travel/)){
      return {category:'travel', badge:'Travel Essential', icon:'🧳', meta:'Best for travel and packing', desc:'sesuai untuk travel, balik kampung atau susun barang perjalanan dengan lebih kemas.'};
    }

    if(has(/ticket|voucher|coupon|topup|reload|gift card/)){
      return {category:'tickets', badge:'Voucher', icon:'🎟️', meta:'Ticket, voucher or digital item', desc:'sesuai untuk baucar, tiket atau item digital. Semak terma dan syarat sebelum membeli.'};
    }

    return {category:'others', badge:'Useful Item', icon:'🛒', meta:'Best for useful daily item', desc:'sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.'};
  }

  function affiliateTitleToIcon(title){
    return affiliateRule(title).icon;
  }

  function affiliateTitleToCategory(title){
    return affiliateRule(title).category;
  }

  function affiliateTitleToBadge(title, category){
    const rule = affiliateRule(title);
    return rule.badge || 'Useful Item';
  }

  function affiliateTitleToMeta(title, category){
    return affiliateRule(title).meta;
  }

  function affiliateTitleToDescription(title, category){
    const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim();
    const rule = affiliateRule(cleanTitle);
    return cleanTitle + ' ' + rule.desc;
  }

  function autoFillAffiliateFromTitle(){
    if(!adminDetected()) return;
    const manualInput = qs('#affiliateManualTitleInput');
    const titleInput = qs('#affiliateTitleInput');
    const rawTitle = (manualInput?.value || titleInput?.value || '').trim();

    if(!rawTitle){
      setTitleFillStatus('Sila paste tajuk produk dahulu.', true);
      return;
    }

    const category = affiliateTitleToCategory(rawTitle);
    qs('#affiliateTitleInput').value = rawTitle;
    qs('#affiliateIcon').value = affiliateTitleToIcon(rawTitle);
    qs('#affiliateBadge').value = affiliateTitleToBadge(rawTitle, category);
    qs('#affiliateDescInput').value = affiliateTitleToDescription(rawTitle, category);
    qs('#affiliateCategoryInput').value = category;
    qs('#affiliateMetaInput').value = affiliateTitleToMeta(rawTitle, category);
    setTitleFillStatus('✅ Auto filled daripada tajuk produk. Sila semak sebelum Save.', false);
  }

  function applyDetectedProduct(data){
    if(!data || !data.ok) return;
    if(data.icon) qs('#affiliateIcon').value = data.icon;
    if(data.badge) qs('#affiliateBadge').value = data.badge;
    if(data.title) qs('#affiliateTitleInput').value = data.title;
    if(data.description) qs('#affiliateDescInput').value = data.description;
    if(data.category) qs('#affiliateCategoryInput').value = data.category;
    if(data.meta) qs('#affiliateMetaInput').value = data.meta;
    if(data.finalUrl) qs('#affiliateLinkInput').value = data.finalUrl;
  }
    if(affiliateInput && !affiliateInput.value.trim()) affiliateInput.value = link;
    window.open(link, '_blank', 'noopener');
    const manual = qs('#affiliateManualTitleInput');
    if(manual){
      setTimeout(() => manual.focus(), 300);
    }
    setTitleFillStatus('Lepas produk terbuka, copy tajuk produk Shopee dan paste di sini, kemudian tekan ✨ Auto Fill.', false);
  }

  async function autoDetectAffiliateProduct(){
    if(!adminDetected()) return;

    const affiliateInput = qs('#affiliateLinkInput');
    const link = (fullInput?.value || affiliateInput?.value || '').trim();

    if(!link){
      setDetectStatus('Sila paste Shopee product link dahulu.', true);
      return;
    }

    const oldText = btn ? btn.textContent : '';
    if(btn){
      btn.disabled = true;
      btn.textContent = '⏳ Detecting...';
    }
    setDetectStatus('Sedang baca link produk melalui backend...', false);

    try{
      const detectApi = 'https://azobss-backend.onrender.com/api/detect-product';
      const res = await fetch(detectApi, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({url: link})
      });

      const rawText = await res.text();
      let data;
      try{
        data = JSON.parse(rawText);
      }catch(parseErr){
        throw new Error('Backend Render tidak pulangkan JSON. Deploy semula backend atau semak endpoint /api/detect-product.');
      }

      if(!res.ok || !data.ok){
        throw new Error(data.error || 'Auto detect gagal');
      }

      applyDetectedProduct(data);
      if(fullInput && data.finalUrl) fullInput.value = data.finalUrl;
      setDetectStatus(data.note || ('Auto filled guna ' + (data.source || 'metadata') + '. Sila semak sebelum Save.'), data.source === 'url-fallback');
      if(data.source === 'url-fallback'){
        const manual = qs('#affiliateManualTitleInput');
        if(manual) manual.focus();
        setTitleFillStatus('Shopee block metadata. Untuk hasil tepat, paste tajuk produk Shopee di sini dan tekan ✨ Auto Fill.', false);
      }
    }catch(err){
      setDetectStatus('Auto detect gagal: ' + err.message + '. Shopee mungkin block. Tekan Open, copy tajuk produk, paste di backup, kemudian Auto Fill.', true);
      const manual = qs('#affiliateManualTitleInput');
      if(manual) manual.focus();
      setTitleFillStatus('Paste tajuk produk Shopee di sini untuk auto isi form dengan lebih tepat.', false);
    }finally{
      if(btn){
        btn.disabled = false;
        btn.textContent = oldText || '🔍 Auto Detect';
      }
    }
  }


  function setJsonImportStatus(message, isError){
    const status = qs('#affiliateJsonImportStatus');
    if(!status) return;
    status.textContent = message || '';
    status.classList.toggle('is-error', !!isError);
  }

  function buildShopeeConsoleExtractorScript(){
    return `(function(){
  function clean(v){
    return String(v || '').replace(/\\s+/g,' ').trim();
  }

  function unique(arr){
    return [...new Set(arr.map(clean).filter(Boolean))];
  }

  function pick(){
    for(const s of arguments){
      try{
        const el = document.querySelector(s);
        const v = el && (el.content || el.innerText || el.textContent || el.getAttribute('content'));
        if(v && clean(v)) return clean(v);
      }catch(e){}
    }
    return '';
  }

  function pickAllText(selectors){
    const arr = [];
    selectors.forEach(sel=>{
      try{
        document.querySelectorAll(sel).forEach(el=>{
          const t = clean(el.innerText || el.textContent || el.getAttribute('content') || '');
          if(t) arr.push(t);
        });
      }catch(e){}
    });
    return unique(arr);
  }

  function validCategoryText(t){
    t = clean(t);
    return t &&
      t.length >= 3 &&
      t.length <= 120 &&
      !/^(category|stock|brand|warranty|rating|sold|quantity|variation|shipping|description|product specifications)$/i.test(t) &&
      !/shopee|homepage|search|login|cart|voucher|coins|free shipping|mall|preferred/i.test(t);
  }

  function findJsonTitle(){
    const scripts = [...document.scripts].map(s=>s.textContent || '').filter(Boolean);
    const patterns = [
      /"name"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i,
      /"title"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i,
      /"itemName"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i,
      /"productName"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/i
    ];

    for(const txt of scripts){
      if(!/Shopee|product|item|name|title/i.test(txt)) continue;
      for(const re of patterns){
        const m = txt.match(re);
        if(m && m[1]){
          try{return JSON.parse('"'+m[1]+'"');}catch(e){return m[1];}
        }
      }
    }
    return '';
  }

  function findCategoryFromVisibleSpecs(){
    const bodyText = document.body ? document.body.innerText : '';
    const lines = bodyText.split(/\\n+/).map(clean).filter(Boolean);
    const found = [];

    // Cara 1: cari label "Category" dalam Product Specifications
    for(let i=0; i<lines.length; i++){
      if(/^category$/i.test(lines[i])){
        for(let j=i+1; j<Math.min(i+8, lines.length); j++){
          const line = lines[j];
          if(validCategoryText(line) && /[>›]/.test(line)){
            found.push(...line.split(/[>›]/).map(clean).filter(validCategoryText));
            break;
          }
          if(validCategoryText(line) && /mobile|accessories|wearables|smartwatch|fitness|home|appliances|computer|camera|automotive|fashion|beauty|baby|groceries|sports/i.test(line)){
            found.push(line);
          }
        }
      }
    }

    // Cara 2: cari text breadcrumb yang ada arrow
    const breadcrumbLines = lines.filter(line =>
      /[>›]/.test(line) &&
      /mobile|accessories|wearables|smartwatch|fitness|home|appliances|computer|camera|automotive|fashion|beauty|baby|groceries|sports/i.test(line)
    );
    breadcrumbLines.forEach(line => found.push(...line.split(/[>›]/).map(clean).filter(validCategoryText)));

    return unique(found);
  }

  function findCategoryFromBreadcrumb(){
    const selectors = [
      'a[href*="cat."]',
      'a[href*="/cat"]',
      'a[href*="category"]',
      '[class*="breadcrumb"] a',
      '[class*="Breadcrumb"] a',
      '[data-testid*="breadcrumb"] a',
      '[aria-label*="breadcrumb"] a',
      '[class*="product-detail"] a',
      '[class*="spec"] a',
      'nav a'
    ];

    const texts = pickAllText(selectors).filter(validCategoryText);
    return unique(texts);
  }

  function findCategoryFromJson(){
    const scripts = [...document.scripts].map(s=>s.textContent || '').filter(Boolean);
    const found = [];

    const regexes = [
      /"display_name"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/ig,
      /"cat_name"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/ig,
      /"category_name"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/ig,
      /"categoryName"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/ig,
      /"breadcrumb"\\s*:\\s*\\[(.*?)\\]/ig,
      /"categories"\\s*:\\s*\\[(.*?)\\]/ig
    ];

    for(const txt of scripts){
      if(!/category|catid|breadcrumb|display_name|cat_name|categoryName/i.test(txt)) continue;

      for(const re of regexes){
        let m;
        while((m = re.exec(txt)) !== null){
          const chunk = m[1] || '';
          const names = [...chunk.matchAll(/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"/g)].map(x=>x[1]);
          if(names.length){
            names.forEach(v=>{
              try{ v = JSON.parse('"'+v+'"'); }catch(e){}
              if(validCategoryText(v)) found.push(v);
            });
          }else{
            let val = chunk;
            try{ val = JSON.parse('"'+val+'"'); }catch(e){}
            if(validCategoryText(val)) found.push(val);
          }
        }
      }
    }

    return unique(found);
  }

  function guessCategoryFromText(text){
    const lower = clean(text).toLowerCase();

    // Priority: breadcrumb/category Shopee
    if(/mobile\\s*&\\s*accessories|mobile accessories|wearables|smartwatches?\\s*&\\s*fitness trackers?|fitness trackers?/.test(lower)){
      return 'mobile';
    }

    if(/home appliances|kitchen appliances|oven|steam oven|microwave|air fryer|rice cooker|pressure cooker|induction cooker|kettle|toaster|blender|mixer|chopper|juicer|food processor|vacuum|washing machine|refrigerator/.test(lower)){
      return 'home-appliances';
    }

    if(/home\\s*&\\s*living|home living|cookware|frypan|wok|pan|pot|bottle|drinkware|bedding|storage|organizer/.test(lower)){
      return 'home-living';
    }

    if(/computer\\s*&\\s*accessories|computer accessories|ssd|nvme|ram|router|wifi|keyboard|mouse|monitor|laptop|pc|usb|hard disk|printer/.test(lower)){
      return 'computer';
    }

    if(/cameras?\\s*&\\s*drones?|camera|cctv|drone|dashcam|lens|4k/.test(lower)){
      return 'cameras-drones';
    }

    if(/gaming\\s*&\\s*consoles?|playstation|ps5|xbox|nintendo|console|gamepad/.test(lower)){
      return 'gaming-consoles';
    }

    if(/automotive|car|motor|tyre|tire|jump starter|kereta/.test(lower)){
      return 'automotive';
    }

    if(/watches|watch|smartwatch|smart watch|huawei band|mi band/.test(lower)){
      return 'watches';
    }

    if(/baby\\s*&\\s*toys|baby|kids|toy|stroller|milk bottle|diaper/.test(lower)){
      return 'baby-toys';
    }

    if(/groceries\\s*&\\s*pets|groceries|grocery|chocolate|snack|food|drink|pets/.test(lower)){
      return 'groceries-pets';
    }

    if(/sports\\s*&\\s*outdoor|sports|outdoor|gym|fitness|cycling|camping/.test(lower)){
      return 'sports-outdoor';
    }

    if(/fashion accessories|shoe|sandal|shirt|dress|bag|wallet|fashion|blouse|pants|jeans/.test(lower)){
      return 'fashion-accessories';
    }

    return '';
  }

  const title = clean(
    pick('meta[property="og:title"]','meta[name="title"]','h1','[data-testid="pdp-product-title"]','.product-briefing h1') ||
    findJsonTitle() ||
    document.title.replace(/\\|.*$/,'')
  );

  const description = clean(pick('meta[property="og:description"]','meta[name="description"]'));
  const image = pick('meta[property="og:image"]','meta[name="twitter:image"]');

  const specCategories = findCategoryFromVisibleSpecs();
  const breadcrumbCategories = findCategoryFromBreadcrumb();
  const jsonCategories = findCategoryFromJson();

  const categoryCandidates = unique([
    ...specCategories,
    ...breadcrumbCategories,
    ...jsonCategories
  ]);

  const guessedCategory = guessCategoryFromText([
    categoryCandidates.join(' '),
    title,
    description
  ].join(' '));

  const data = {
    source:'shopee-console-json',
    title:title,
    description:description,
    image:image,
    url:location.href,
    category: guessedCategory,
    categoryCandidates: categoryCandidates,
    specCategories: specCategories,
    breadcrumbCategories: breadcrumbCategories,
    jsonCategories: jsonCategories,
    capturedAt:new Date().toISOString()
  };

  console.log('AZOBSS Shopee JSON:', data);

  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  const safe = (title || 'shopee-product').replace(/[\\\\/:*?"<>|]+/g,' ').replace(/\\s+/g,' ').trim().slice(0,80) || 'shopee-product';
  a.href = URL.createObjectURL(blob);
  a.download = safe + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
})();`;
  }

  async function copyShopeeJsonExtractorScript(){
    if(!adminDetected()) return;
    const script = buildShopeeConsoleExtractorScript();
    const copied = await copyTextToClipboardRobust(script);
    if(copied){
      setJsonImportStatus('✅ Console script copied. Tekan Open → Shopee page → F12 Console → paste → Enter. JSON akan auto download.', false);
    }else{
      setJsonImportStatus('Copy gagal. Browser block clipboard. Sila cuba lagi atau guna manual console.', true);
    }
  }


  async function openShopeeForJsonExtension(){
    if(!adminDetected()) return;
    const input = getShopeeJsonSourceInput();
    let url = (input?.value || '').trim();
    if(!url){
      setJsonImportStatus('Paste link Shopee dalam kotak Affiliate Link dahulu sebelum tekan Accept & Open.', true);
      input?.focus();
      return;
    }
    if(!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if(!/shopee\./i.test(url)){
      setJsonImportStatus('Link mesti link Shopee.', true);
      input?.focus();
      return;
    }
    if(input) input.value = url;

    // Link yang dipaste di Affiliate Link ialah link affiliate/product utama.
    // Auto isi Affiliate Link jika masih kosong, tetapi jangan overwrite jika user sudah edit manual.
    const affiliateInput = qs('#affiliateLinkInput');
    if(affiliateInput) affiliateInput.value = url;
    if(fullInput) fullInput.value = url;

    const script = buildShopeeConsoleExtractorScript();
    const copied = await copyTextToClipboardRobust(script);

    try{ localStorage.setItem('azobss_pending_shopee_json_link', url); }catch(e){}
    const win = window.open(url, '_blank', 'noopener,noreferrer');

    if(copied){
      setJsonImportStatus('✅ Script auto copied + Shopee dibuka. Di Shopee: F12 → Console → Ctrl+V → Enter. JSON akan auto download.', false);
    }else{
      setJsonImportStatus('Shopee dibuka, tetapi browser block copy script. Tekan button Copy Console Script dahulu, kemudian F12 → Console → Ctrl+V → Enter.', true);
    }
    if(!win){
      setJsonImportStatus('Popup diblock browser. Script ' + (copied ? 'sudah copied. ' : 'belum copied. ') + 'Allow popup dan tekan semula.', true);
    }
  }


  function mapImportedCategoryToAffiliateCategory(categoryText, titleText, descText){
    const text = String([categoryText, titleText, descText].join(' ')).toLowerCase();

    if(/chocolate|coklat|candy|snack|food|grocery|groceries|minuman|drink|coffee|tea|biscuit|milk|halal|caramel/.test(text)){
      return { category:'groceries-pets', badge:'Groceries', icon:'🛒', meta:'Best for daily food and grocery items' };
    }

    if(/oven|steam oven|microwave|air fryer|rice cooker|pressure cooker|induction cooker|kettle|toaster|air conditioner|aircond|vacuum|washing machine|fridge|refrigerator|blender|mixer|chopper|juicer|food processor/.test(text)){
      return { category:'home-appliances', badge:'Home Appliances', icon:'🏠', meta:'Best for kitchen and home use' };
    }

    if(/cookware|frypan|wok|pan|pot|tefal|spatula|lunch box|food container|meal prep|bottle|drinkware|bedding|toto|narita|bed|pillow|storage|organizer|rack/.test(text)){
      return { category:'home-living', badge:'Home & Living', icon:'🏡', meta:'Best for home and daily use' };
    }

    if(/computer|accessories|ssd|nvme|ram|router|wifi|keyboard|mouse|monitor|laptop|pc|usb|hard disk|printer|desktop|gaming pc|rig/.test(text)){
      return { category:'computer', badge:'Computer & Accessories', icon:'🖥️', meta:'Best for PC setup and daily use' };
    }

    if(/mobile|mobile accessories|wearables|smartwatch|smart watch|fitness tracker|phone|smartphone|iphone|android|charger|powerbank|cable|case|screen protector|earbuds|bluetooth|vivo|samsung|xiaomi|oppo|honor|huawei/.test(text)){
      return { category:'mobile', badge:'Mobile Accessories', icon:'📱', meta:'Best for phone and daily charging' };
    }

    if(/dashcam|camera|cctv|tapo|drone|gopro|lens|4k|cam/.test(text)){
      return { category:'cameras-drones', badge:'Camera', icon:'📷', meta:'Best for recording and monitoring' };
    }

    if(/playstation|ps5|xbox|nintendo|console|gamepad|gaming console/.test(text)){
      return { category:'gaming-consoles', badge:'Gaming Console', icon:'🎮', meta:'Best for home gaming setup' };
    }

    if(/automotive|dashcam|car|motor|tyre|tire|jump starter|kereta|sandal car|car mat|car vacuum/.test(text)){
      return { category:'automotive', badge:'Car Essential', icon:'🚗', meta:'Useful for car and travel' };
    }

    if(/smartwatch|smart watch|watch|ultra watch|t900|t800|t500|huawei band|mi band|fitness tracker|health watch|sport watch|bluetooth call/.test(text)){
      return { category:'watches', badge:'Smartwatch', icon:'⌚', meta:'Best for fitness and daily tracking' };
    }

    if(/baby|kids|toy|stroller|milk bottle|milk powder|bekas susu|diaper|formula/.test(text)){
      return { category:'baby-toys', badge:'Baby Essentials', icon:'🍼', meta:'Best for baby and kids use' };
    }

    if(/sport|sports|gym|fitness|dumbbell|cycling|outdoor|camping|exercise/.test(text)){
      return { category:'sports-outdoor', badge:'Sports & Outdoor', icon:'🏋️', meta:'Best for workout and outdoor' };
    }

    if(/shoe|sandal|shirt|dress|bag|wallet|watch|fashion|blouse|pants|jeans|men|women/.test(text)){
      return { category:'fashion-accessories', badge:'Fashion Accessories', icon:'👜', meta:'Popular fashion item' };
    }

    return { category:'others', badge:'Useful Item', icon:'🛒', meta:'Best for useful daily item' };
  }

  function cleanShopeeImportedTitle(title){
    return String(title || '')
      .replace(/\s*\|\s*Shopee\s*(Malaysia)?\s*$/i, '')
      .replace(/^\[[^\]]+\]\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shortenShopeeDescription(desc, title, category){
    const cleanDesc = String(desc || '').replace(/\s+/g, ' ').trim();
    const cleanTitle = cleanShopeeImportedTitle(title);
    if(cleanDesc && cleanDesc.length <= 280) return cleanDesc;

    if(category === 'home-appliances'){
      return cleanTitle + ' sesuai untuk kegunaan dapur dan rumah harian. Praktikal untuk memasak, penyediaan makanan dan penggunaan keluarga.';
    }
    if(category === 'home-living'){
      return cleanTitle + ' sesuai untuk kegunaan rumah harian, susun atur, penyimpanan dan keselesaan ruang kediaman.';
    }
    if(category === 'computer'){
      return cleanTitle + ' sesuai untuk setup PC, kerja harian, gaming dan upgrade komputer.';
    }
    if(category === 'mobile'){
      return cleanTitle + ' sesuai untuk kegunaan telefon, charging, travel dan gadget harian.';
    }
    if(category === 'automotive'){
      return cleanTitle + ' sesuai untuk kegunaan kereta, travel dan penjagaan kenderaan harian.';
    }
    if(category === 'groceries'){
      return cleanTitle + ' sesuai untuk kegunaan harian, makanan, minuman atau barang dapur.';
    }
    return cleanTitle + ' sesuai untuk kegunaan harian. Semak detail produk di Shopee sebelum membeli.';
  }

  function normalizeAffiliateSlug(text){
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'product';
  }

  function normalizeShopeeImportedData(raw){
    const data = Array.isArray(raw) ? raw[0] : (raw || {});
    const item = data.item || data.data || data.product || data.item_basic || {};
    const title = String(data.title || data.name || data.productTitle || data.product_title || item.title || item.name || item.product_name || '').replace(/\s+/g,' ').trim();
    const description = String(data.description || data.desc || data.productDescription || item.description || item.desc || '').trim();
    const link = String(data.url || data.link || data.finalUrl || data.affiliateLink || '').trim();
    const image = String(data.image || data.imageUrl || data.thumbnail || item.image || '').trim();
    const category = String(data.category || data.categoryName || data.category_name || item.category || item.categoryName || item.category_name || '').trim();
    const categoryCandidates = Array.isArray(data.categoryCandidates) ? data.categoryCandidates.join(' ') : '';
    const breadcrumbCategories = Array.isArray(data.breadcrumbCategories) ? data.breadcrumbCategories.join(' ') : '';
    const jsonCategories = Array.isArray(data.jsonCategories) ? data.jsonCategories.join(' ') : '';
    return {title, description, link, image, category, categoryCandidates, breadcrumbCategories, jsonCategories};
  }

  function applyShopeeJsonToForm(raw){
    if(!adminDetected()) return;
    const data = normalizeShopeeImportedData(raw);
    if(!data.title){
      setJsonImportStatus('JSON tiada product title. Cuba copy tajuk produk dan guna Auto Fill backup.', true);
      return;
    }
    const categoryText = [
      data.category,
      data.categoryCandidates,
      data.breadcrumbCategories,
      data.jsonCategories
    ].filter(Boolean).join(' ');

    const cleanTitle = cleanShopeeImportedTitle(data.title);
    const mapped = mapImportedCategoryToAffiliateCategory(categoryText, cleanTitle, data.description);
    const category = mapped.category;

    qs('#affiliateTitleInput').value = cleanTitle;
    qs('#affiliateIcon').value = mapped.icon;
    qs('#affiliateBadge').value = mapped.badge;
    qs('#affiliateCategoryInput').value = category;
    qs('#affiliateMetaInput').value = mapped.meta;
    qs('#affiliateDescInput').value = shortenShopeeDescription(data.description, cleanTitle, category);
    const jsonSourceLink = (qs('#affiliateLinkInput')?.value || '').trim();
    const preferredLink = jsonSourceLink || data.link;
    if(preferredLink){
      // Link dari Affiliate Link ialah link yang user mahu simpan sebagai Affiliate Link.
      // Isi hanya jika Affiliate Link masih kosong supaya link yang user edit manual tidak hilang.
      const affiliateInput = qs('#affiliateLinkInput');
      if(affiliateInput && !affiliateInput.value.trim()) affiliateInput.value = preferredLink;
      if(full && !full.value.trim()) full.value = preferredLink;
    }
    const manual = qs('#affiliateManualTitleInput');
    if(manual) manual.value = data.title;
    setJsonImportStatus('✅ JSON imported. Form auto filled daripada data Shopee. Sila semak sebelum Save.', false);
  }

  function importShopeeJsonFile(file){
    if(!adminDetected()) return;
    if(!file){
      setJsonImportStatus('Sila pilih fail JSON Shopee dahulu.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const raw = JSON.parse(reader.result);
        applyShopeeJsonToForm(raw);
      }catch(err){
        setJsonImportStatus('Fail JSON tidak sah atau rosak.', true);
      }
    };
    reader.readAsText(file);
  }




  function syncJsonImportBoxToAffiliateLinkBox(){
    // JSON import link now uses Affiliate Link box directly.
  }

  function closeModal(){
    if(isImportingShopeeJson || isChoosingShopeeJsonFile) return;
    qs('#affiliateAdminModal')?.classList.remove('is-open');
  }

  function bindAdmin(){
    syncJsonImportBoxToAffiliateLinkBox();
    qs('#affiliateAddButton')?.addEventListener('click', () => {
      if(!adminDetected()) return;
      openModal(null);
    });

    qs('#affiliateAdminClose')?.addEventListener('click', closeModal);

    qs('#affiliateTitleAutoFillButton')?.addEventListener('click', autoFillAffiliateFromTitle);
    qs('#affiliateCopyJsonExtractorButton')?.addEventListener('click', copyShopeeJsonExtractorScript);
    qs('#affiliateJsonOpenLinkButton')?.addEventListener('click', openShopeeForJsonExtension);
    qs('#affiliateImportJsonButton')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if(!adminDetected()) return;
      if(isChoosingShopeeJsonFile) return;

      const fileInput = qs('#affiliateShopeeJsonFile');
      if(!fileInput) return;

      isChoosingShopeeJsonFile = true;
      isImportingShopeeJson = true;

      // Reset value first so choosing the same JSON file still triggers change once.
      fileInput.value = '';

      // Delay click slightly to avoid modal outside-click/focus blink on Windows file picker.
      setTimeout(() => {
        fileInput.click();
      }, 80);

      // If user cancels file picker, release lock.
      setTimeout(() => {
        if(isChoosingShopeeJsonFile){
          isChoosingShopeeJsonFile = false;
          isImportingShopeeJson = false;
        }
      }, 4000);
    });
    qs('#affiliateShopeeJsonFile')?.addEventListener('click', e => {
      e.stopPropagation();
    });

    qs('#affiliateShopeeJsonFile')?.addEventListener('change', function(e){
      e.stopPropagation();
      if(!adminDetected()) return;

      const file = this.files && this.files[0];

      // If user cancels picker, just unlock. Do not close/reopen modal.
      if(!file){
        isChoosingShopeeJsonFile = false;
        isImportingShopeeJson = false;
        return;
      }

      isImportingShopeeJson = true;
      importShopeeJsonFile(file);

      // Keep modal open and release lock after import settles.
      setTimeout(() => {
        this.value = '';
        isChoosingShopeeJsonFile = false;
        isImportingShopeeJson = false;
      }, 900);
    });

    qs('#affiliateAdminModal')?.addEventListener('click', e => {
      if(isImportingShopeeJson || isChoosingShopeeJsonFile) return;
      if(e.target.id === 'affiliateAdminModal') closeModal();
    });

    qs('#affiliateAdminForm')?.addEventListener('submit', e => {
      e.preventDefault();
      if(!adminDetected()) return;

      const existingId = qs('#affiliateEditId').value;
      const titleForId = qs('#affiliateTitleInput').value.trim();
      const id = existingId || ('aff-' + normalizeAffiliateSlug(titleForId) + '-' + Date.now());

      const item = {
        id,
        icon: qs('#affiliateIcon').value.trim() || 'AZ',
        badge: qs('#affiliateBadge').value.trim() || 'Affiliate',
        title: qs('#affiliateTitleInput').value.trim(),
        desc: qs('#affiliateDescInput').value.trim(),
        category: qs('#affiliateCategoryInput').value,
        meta: qs('#affiliateMetaInput').value.trim(),
        link: qs('#affiliateLinkInput').value.trim()
      };

      const idx = products.findIndex(p => p.id === id);
      if(idx >= 0){
        products[idx] = item;
      }else{
        products.unshift(item);
      }

      saveProducts(products);
      renderProducts();
      closeModal();
    });

    document.addEventListener('click', e => {
      if(!adminDetected()) return;

      const editId = e.target.getAttribute('data-affiliate-edit');
      const deleteId = e.target.getAttribute('data-affiliate-delete');

      if(editId){
        const item = products.find(p => p.id === editId);
        if(item) openModal(item);
      }

      if(deleteId){
        const item = products.find(p => p.id === deleteId);
        const title = item ? item.title : deleteId;

        if(confirm('Delete affiliate item: ' + title + '?')){
          products = products.filter(p => p.id !== deleteId);
          saveProducts(products);
          renderProducts();
        }
      }
    });

    qs('#affiliateExportButton')?.addEventListener('click', () => {
      if(!adminDetected()) return;

      const blob = new Blob([JSON.stringify(products, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'affiliate-products.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    qs('#affiliateImportButton')?.addEventListener('click', () => {
      if(!adminDetected()) return;
      qs('#affiliateImportFile')?.click();
    });

    qs('#affiliateImportFile')?.addEventListener('change', function(){
      if(!adminDetected()) return;

      const file = this.files[0];
      if(!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        try{
          const imported = JSON.parse(reader.result);
          if(!Array.isArray(imported)) throw new Error('Invalid file');

          products = imported;
          saveProducts(products);
          renderProducts();
          alert('Affiliate backup imported.');
        }catch(err){
          alert('Invalid affiliate backup file.');
        }
      };

      reader.readAsText(file);
    });

    qs('#affiliateResetButton')?.addEventListener('click', () => {
      if(!adminDetected()) return;

      if(confirm('Reset affiliate local changes?')){
        localStorage.removeItem(STORAGE_KEY);
        products = getProductsFromDOM();
        saveProducts(products);
        renderProducts();
      }
    });

    // ── Deploy to GitHub button ──────────────────────────────────────────
    qs('#affiliateDeployButton')?.addEventListener('click', async () => {
      if(!adminDetected()) return;

      const btn = qs('#affiliateDeployButton');

      // 1. Check server aktif
      let serverOk = false;
      try{
        const health = await fetch('https://127.0.0.1:7821/health', {signal: AbortSignal.timeout(2500)});
        serverOk = health.ok;
      }catch(e){}

      if(!serverOk){
        alert(
          '\u274C Deploy Server tidak aktif!\n\n' +
          'Sila jalankan deploy-server.js dahulu:\n\n' +
          '  1. Buka Command Prompt\n' +
          '  2. cd ke folder website anda\n' +
          '  3. Taip: node deploy-server.js\n' +
          '  4. Cuba semula button ini'
        );
        return;
      }

      if(!confirm('Deploy ' + products.length + ' produk ke GitHub sekarang?\n\nIni akan:\n\u2022 Tulis affiliate-products.json\n\u2022 Tulis affiliate-backup.json\n\u2022 Git commit + push')) return;

      // 2. Deploy
      const origHTML = btn.innerHTML;
      btn.textContent = '\u23F3 Deploying...';
      btn.disabled = true;

      try{
        const res = await fetch('https://127.0.0.1:7821/deploy', {
          method : 'POST',
          headers: {'Content-Type':'application/json'},
          body   : JSON.stringify(products),
        });

        const data = await res.json();

        if(data.ok){
          btn.innerHTML = '\uD83D\uDE80 Deploy to GitHub <span style="position:absolute;top:-9px;right:-9px;background:#22c55e;color:#052e16;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:999px;white-space:nowrap;">\u2713 Done</span>';
          alert('\u2705 ' + data.message);
        }else{
          alert('\u274C Deploy gagal:\n' + data.message);
          btn.innerHTML = origHTML;
        }

      }catch(err){
        alert('\u274C Ralat semasa deploy:\n' + err.message);
        btn.innerHTML = origHTML;
      }

      btn.disabled = false;
    });
    // ────────────────────────────────────────────────────────────────────
  }

  function init(){
    if(!getWrap()) return;

    const saved = loadSavedProducts();

    if(saved){
      products = saved;
      renderProducts();
    }else{
      ensureCardAdminButtons();
      products = getProductsFromDOM();
      saveProducts(products);
    }

    bindAdmin();
    refreshAdminState();

    setInterval(() => {
      refreshAdminState();
      ensureCardAdminButtons();
    }, 500);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
