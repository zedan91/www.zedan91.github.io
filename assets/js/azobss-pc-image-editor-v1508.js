/* AZOBSS v1509 - PC Build / Hardware photo editor with secure admin publishing.
 * Edited images can be downloaded or sent to Render for atomic GitHub asset + map commit.
 * GitHub credentials live ONLY in Render environment variables.
 */
(function () {
  'use strict';
  if (window.azobssPcImageEditor) return;
  const MAX_SIDE = 3200, MAX_PIXELS = 8000000, MAX_HISTORY = 11;
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
  const looksLikeAdmin = () => {
    try { if (typeof window.isAdminViewer === 'function') return window.isAdminViewer() === true; } catch (_) {}
    return document.body.classList.contains('az-role-is-admin') || document.body.classList.contains('is-admin') || document.body.dataset.role === 'admin';
  };
  const formatFromFile = name => /\.jpe?g$/i.test(name) ? 'image/jpeg' : /\.png$/i.test(name) ? 'image/png' : 'image/webp';
  const extension = mime => mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
  const baseName = raw => {
    const last = String(raw || '').split(/[\\/]/).pop().split(/[?#]/)[0];
    const val = last.replace(/\.(png|webp|jpe?g|gif|avif)$/i, '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
    return val || 'azobss-product-image';
  };
  const getPath = url => { try { const u = new URL(String(url), location.href); return u.origin === location.origin ? u.pathname : ''; } catch (_) { return ''; } };
  let active = null;

  function editorHtml(title, url, opts = {}) {
    const sourcePath = /^https?:/i.test(url) ? getPath(url) : '';
    const file = sourcePath.split('/').pop() || 'azobss-product-image.webp';
    const mime = formatFromFile(file);
    return `<section class="az-photo-editor-dialog" role="dialog" aria-modal="true" aria-label="Edit gambar: ${h(title)}">
      <header class="az-photo-editor-head"><div><b>🎨 AZOBSS Photo Editor</b><small>${h(title)}</small></div><button class="az-photo-editor-close" data-photo-close type="button" aria-label="Tutup editor">×</button></header>
      <div class="az-photo-editor-toolbar" aria-label="Alat suntingan">
        <div class="az-photo-editor-group az-photo-editor-tools" role="group" aria-label="Pilihan alat">
          <button type="button" data-photo-tool="crop" class="is-selected">✂️ Crop</button><button type="button" data-photo-tool="brush">✏️ Berus</button><button type="button" data-photo-tool="erase">◻ Pemadam</button><button type="button" data-photo-tool="text">T Teks</button><button type="button" data-photo-tool="rect">▭ Kotak</button><button type="button" data-photo-tool="circle">◯ Bulatan</button><button type="button" data-photo-tool="line">╱ Garisan</button>
        </div>
        <div class="az-photo-editor-group"><label>Warna <input data-photo-color type="color" value="#10b981" aria-label="Warna lukisan"></label><label>Saiz <input data-photo-size type="range" min="2" max="72" value="12" aria-label="Saiz berus / teks"></label><output data-photo-size-value>12</output><label class="az-photo-editor-text-field">Teks <input data-photo-text type="text" maxlength="120" placeholder="Tulis teks dahulu"></label></div>
        <div class="az-photo-editor-group"><label>Nisbah <select data-photo-ratio><option value="free">Bebas</option><option value="1">1:1</option><option value="1.333333">4:3</option><option value="1.777778">16:9</option><option value="0.75">3:4</option></select></label><button type="button" data-photo-crop-apply disabled>✓ Potong pilihan</button></div>
        <div class="az-photo-editor-group"><button type="button" data-photo-rotate="left">↶ 90°</button><button type="button" data-photo-rotate="right">↷ 90°</button><button type="button" data-photo-flip="h">⇄ Flip H</button><button type="button" data-photo-flip="v">⇅ Flip V</button></div>
        <div class="az-photo-editor-group"><button type="button" data-photo-undo disabled>↶ Undo</button><button type="button" data-photo-redo disabled>↷ Redo</button><button type="button" data-photo-reset>⟲ Reset Asal</button><label class="az-photo-editor-upload">📁 Tukar Gambar<input data-photo-upload type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden></label></div>
        <div class="az-photo-editor-group az-photo-editor-filters"><label>Cerah <input data-photo-filter="brightness" type="range" min="50" max="160" value="100"><output data-photo-filter-label="brightness">100%</output></label><label>Kontras <input data-photo-filter="contrast" type="range" min="50" max="160" value="100"><output data-photo-filter-label="contrast">100%</output></label><label>Warna <input data-photo-filter="saturate" type="range" min="0" max="180" value="100"><output data-photo-filter-label="saturate">100%</output></label><label>Kelabu <input data-photo-filter="grayscale" type="range" min="0" max="100" value="0"><output data-photo-filter-label="grayscale">0%</output></label></div>
      </div>
      <div class="az-photo-editor-workspace"><div class="az-photo-editor-viewport" data-photo-viewport><div class="az-photo-editor-canvas-wrap" data-photo-wrap><canvas data-photo-canvas aria-label="Kanvas gambar boleh diedit"></canvas><canvas data-photo-overlay aria-label="Kawasan memilih crop" ></canvas></div></div><aside class="az-photo-editor-side"><b>Fail & Eksport</b><p data-photo-size-info>Memuatkan gambar…</p><label>Zoom paparan <input data-photo-zoom type="range" min="50" max="200" value="100"><output data-photo-zoom-label>100%</output></label><label>Format <select data-photo-format><option value="image/webp" ${mime === 'image/webp' ? 'selected' : ''}>WebP</option><option value="image/png" ${mime === 'image/png' ? 'selected' : ''}>PNG</option><option value="image/jpeg" ${mime === 'image/jpeg' ? 'selected' : ''}>JPEG</option></select></label><label>Nama fail download <input data-photo-name type="text" value="${h(baseName(file))}" maxlength="90" autocapitalize="off" spellcheck="false"></label><button class="az-photo-editor-publish" type="button" data-photo-publish disabled>☁ Simpan & Terbitkan (WebP)</button><button class="az-photo-editor-download" type="button" data-photo-download disabled>⬇ Muat Turun Gambar Siap</button><small class="az-photo-editor-warn"><b>Penerbitan automatik (WebP):</b> Simpan & Terbitkan menghantar gambar ke backend Render (akaun Administrator) lalu GitHub mengemaskini gambar lokal + map secara serentak. GitHub Pages mungkin mengambil masa sebelum perubahan kelihatan.</small><div data-photo-publish-result aria-live="polite"></div>${sourcePath ? `<code class="az-photo-editor-source">${h(sourcePath)}</code>` : '<small>Imej ini berasal daripada sumber luar. Butang Simpan & Terbitkan akan mencipta aset WebP lokal yang dipadankan secara automatik menggunakan ID produk.</small>'}</aside></div>
      <footer class="az-photo-editor-foot"><div data-photo-status role="status" aria-live="polite">Memuatkan imej asal…</div><button data-photo-close type="button">Tutup Editor</button></footer>
    </section>`;
  }

  function status(s, message) { if (s?.root?.isConnected) s.root.querySelector('[data-photo-status]').textContent = message; }
  function node(s, selector) { return s.root.querySelector(selector); }
  function filters(s) { return `brightness(${s.filters.brightness}%) contrast(${s.filters.contrast}%) saturate(${s.filters.saturate}%) grayscale(${s.filters.grayscale}%)`; }
  function fitViewport(s) {
    if (!s.root.isConnected || !s.canvas.width) return;
    const vp = node(s, '[data-photo-viewport]');
    const fit = Math.min(1, Math.max(0.03, (vp.clientWidth - 34) / s.canvas.width), Math.max(0.03, (vp.clientHeight - 34) / s.canvas.height));
    const factor = fit * s.zoom;
    const w = Math.max(40, Math.round(s.canvas.width * factor)), hh = Math.max(30, Math.round(s.canvas.height * factor));
    const wrap = node(s, '[data-photo-wrap]');
    wrap.style.width = `${w}px`; wrap.style.height = `${hh}px`;
    s.canvas.style.width = `${w}px`; s.canvas.style.height = `${hh}px`;
    s.overlay.style.width = `${w}px`; s.overlay.style.height = `${hh}px`;
    s.overlay.width = s.canvas.width; s.overlay.height = s.canvas.height;
    drawOverlay(s);
  }
  function updateState(s) {
    if (!s.root.isConnected) return;
    const dim = node(s, '[data-photo-size-info]');
    dim.textContent = `${s.canvas.width.toLocaleString()} × ${s.canvas.height.toLocaleString()} px`;
    node(s, '[data-photo-undo]').disabled = s.locked || s.historyIndex <= 0;
    node(s, '[data-photo-redo]').disabled = s.locked || s.historyIndex >= s.history.length - 1;
    node(s, '[data-photo-crop-apply]').disabled = !s.crop || s.crop.w < 5 || s.crop.h < 5 || s.tool !== 'crop';
    node(s, '[data-photo-download]').disabled = s.locked || s.publishing;
    node(s, '[data-photo-publish]').disabled = s.locked || s.publishing || !s.productId;
    s.canvas.style.filter = filters(s);
  }
  function setTool(s, tool) {
    s.tool = tool;
    s.crop = null;
    node(s,'[data-photo-crop-apply]').disabled = true;
    s.root.querySelectorAll('[data-photo-tool]').forEach(b => b.classList.toggle('is-selected', b.dataset.photoTool === tool));
    node(s, '[data-photo-overlay]').style.cursor = tool === 'text' ? 'text' : 'crosshair';
    drawOverlay(s);
    status(s, tool === 'crop' ? 'Seret pada gambar untuk memilih kawasan crop; kemudian tekan Potong pilihan.' : tool === 'text' ? 'Tulis teks di atas, kemudian klik lokasi pada gambar.' : 'Seret pada gambar untuk menggunakan alat.');
    updateState(s);
  }
  function snapshot(s) {
    if (!s.canvas.width || s.locked) return;
    try {
      const item = {data: s.canvas.toDataURL('image/png'), filters: {...s.filters}};
      s.history = s.history.slice(0, s.historyIndex + 1);
      s.history.push(item);
      if (s.history.length > MAX_HISTORY) s.history.shift();
      s.historyIndex = s.history.length - 1;
      s.dirty = s.historyIndex > 0;
      s.exported = false;
      s.published = false;
      updateState(s);
    } catch (_) { status(s, 'Tidak dapat menyimpan sejarah edit. Jika gambar luar, cuba Tukar Gambar (fail lokal).'); }
  }
  function drawImageData(canvas, img, w, height) {
    canvas.width = w; canvas.height = height;
    const ctx = canvas.getContext('2d', {willReadFrequently: false});
    ctx.clearRect(0, 0, w, height);
    ctx.drawImage(img, 0, 0, w, height);
  }
  function bitmapFrom(url, crossOrigin = true) {
    return new Promise((resolve,reject)=>{
      const image = new Image();
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => image.naturalWidth && image.naturalHeight ? resolve(image) : reject(new Error('Imej tidak mempunyai resolusi.'));
      image.onerror = () => reject(new Error('Tidak dapat membaca gambar ini. Sila pilih fail melalui “Tukar Gambar”.'));
      image.src = url;
    });
  }
  async function initializeImage(s, url, isOriginal = false) {
    s.locked = true; updateState(s);
    try {
      const image = await bitmapFrom(url, !url.startsWith('blob:') && !url.startsWith('data:'));
      if (!s.root.isConnected) return;
      const ratio = Math.min(1, MAX_SIDE / image.naturalWidth, MAX_SIDE / image.naturalHeight, Math.sqrt(MAX_PIXELS / (image.naturalWidth * image.naturalHeight)));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio)), height = Math.max(1, Math.round(image.naturalHeight * ratio));
      drawImageData(s.canvas, image, width, height);
      // Verify that export is permitted (cross-origin images might taint a canvas).
      s.canvas.toDataURL('image/png');
      s.filters = {brightness:100,contrast:100,saturate:100,grayscale:0};
      for (const kind of Object.keys(s.filters)) {
        node(s,`[data-photo-filter="${kind}"]`).value = s.filters[kind];
        node(s,`[data-photo-filter-label="${kind}"]`).textContent = s.filters[kind] + '%';
      }
      s.history = []; s.historyIndex = -1; s.crop = null; s.drag = null; s.zoom = 1;
      node(s,'[data-photo-zoom]').value = 100; node(s,'[data-photo-zoom-label]').textContent='100%';
      s.locked = false; snapshot(s); s.original = s.history[0]; s.dirty = false; setTool(s,'crop'); fitViewport(s);
      if (ratio < 1) status(s,`Imej besar dikecilkan untuk kestabilan browser: ${image.naturalWidth}×${image.naturalHeight} → ${width}×${height}.`);
      else status(s, isOriginal ? 'Gambar asal dimuatkan. Pilih alat dan mula edit.' : 'Gambar baharu dimuatkan.');
    } catch (err) {
      s.locked = false;
      status(s, err.message || 'Gambar gagal dibuka.');
      node(s,'[data-photo-download]').disabled = true;
    }
  }
  function loadHistory(s, index, originalOnly = false) {
    if ((!originalOnly && (index < 0 || index >= s.history.length)) || s.locked) return;
    s.locked = true;
    const chosen = originalOnly ? s.original : s.history[index];
    if (!chosen) { s.locked = false; return; }
    updateState(s);
    bitmapFrom(chosen.data,false).then(img=>{
      if (!s.root.isConnected) return;
      drawImageData(s.canvas,img,img.naturalWidth,img.naturalHeight);
      s.filters = {...chosen.filters};
      for (const kind in s.filters) {
        node(s,`[data-photo-filter="${kind}"]`).value=s.filters[kind];
        node(s,`[data-photo-filter-label="${kind}"]`).textContent=s.filters[kind]+'%';
      }
      s.historyIndex=index; s.crop=null; s.locked=false; s.dirty=index!==0;
      if (originalOnly) { snapshot(s); s.dirty=false; s.exported=false; }
      fitViewport(s); updateState(s);
      status(s,originalOnly?'Imej dipulihkan kepada gambar asal (sebelum edit).':index===0?'Imej kembali ke keadaan asal.':'Undo/redo berjaya.');
    }).catch(()=>{s.locked=false;updateState(s);status(s,'Gagal membuka sejarah suntingan.');});
  }
  function drawOverlay(s) {
    const c = s.overlay, ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    const rect=s.crop;
    if (s.tool!=='crop'||!rect) return;
    ctx.fillStyle='rgba(1,6,16,.48)';ctx.fillRect(0,0,c.width,c.height);
    ctx.clearRect(rect.x,rect.y,rect.w,rect.h);
    ctx.strokeStyle='#00dcff'; ctx.lineWidth=Math.max(1, c.width / 1400); ctx.setLineDash([9,6]);
    ctx.strokeRect(rect.x,rect.y,rect.w,rect.h); ctx.setLineDash([]);
  }
  function pt(s,evt) {
    const r=s.overlay.getBoundingClientRect();
    return {x:clamp(Math.round((evt.clientX-r.left)*s.canvas.width / Math.max(1,r.width)),0,s.canvas.width), y:clamp(Math.round((evt.clientY-r.top)*s.canvas.height / Math.max(1,r.height)),0,s.canvas.height)};
  }
  function cropSelection(s,a,b) {
    let dx=b.x-a.x,dy=b.y-a.y;
    const ratioText=node(s,'[data-photo-ratio]').value;
    if (ratioText!=='free') {
      const ratio=Number(ratioText);
      const mx = dx < 0 ? a.x : s.canvas.width-a.x;
      const my = dy < 0 ? a.y : s.canvas.height-a.y;
      const w=Math.min(Math.abs(dx),mx,my*ratio);
      dx=Math.sign(dx||1)*w;
      dy=Math.sign(dy||1)*(w/ratio);
    }
    const x=Math.max(0,Math.min(a.x,a.x+dx)),y=Math.max(0,Math.min(a.y,a.y+dy));
    return {x:Math.round(x),y:Math.round(y),w:Math.round(Math.abs(dx)),h:Math.round(Math.abs(dy))};
  }
  function beginStroke(s,x,y) {
    const ctx=s.canvas.getContext('2d');
    ctx.save();ctx.lineWidth=Number(node(s,'[data-photo-size]').value);ctx.lineJoin='round';ctx.lineCap='round';
    ctx.strokeStyle=node(s,'[data-photo-color]').value;
    if(s.tool==='erase')ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.01,y+.01);ctx.stroke();ctx.restore();
  }
  function extendStroke(s,a,b) {
    const ctx=s.canvas.getContext('2d');ctx.save();
    ctx.lineWidth=Number(node(s,'[data-photo-size]').value);ctx.lineJoin='round';ctx.lineCap='round';
    ctx.strokeStyle=node(s,'[data-photo-color]').value;
    if(s.tool==='erase')ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
  }
  function shape(s,a,b,target) {
    const ctx=target.getContext('2d');
    ctx.save();ctx.strokeStyle=node(s,'[data-photo-color]').value;ctx.lineWidth=Number(node(s,'[data-photo-size]').value);
    ctx.lineCap='round';ctx.lineJoin='round';
    if(s.tool==='rect')ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
    else if(s.tool==='circle'){ctx.beginPath();ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(0.5,Math.abs(a.x-b.x)/2),Math.max(0.5,Math.abs(a.y-b.y)/2),0,0,2*Math.PI);ctx.stroke();}
    else {ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.restore();
  }
  function paintText(s,x,y) {
    const str=node(s,'[data-photo-text]').value.trim();
    if(!str){status(s,'Isi ruangan “Teks”, kemudian klik gambar.');return;}
    const ctx=s.canvas.getContext('2d');
    ctx.save();ctx.fillStyle=node(s,'[data-photo-color]').value;
    ctx.font=`bold ${Math.max(14,Number(node(s,'[data-photo-size]').value)*2)}px Arial,sans-serif`;
    ctx.textBaseline='top';
    for(const [i,line] of str.split('\n').slice(0,4).entries()) ctx.fillText(line,x,y+i*ctx.measureText('M').width*1.4,s.canvas.width-x);
    ctx.restore();snapshot(s);
  }
  function bindPointer(s) {
    const o=s.overlay;
    o.addEventListener('pointerdown',e=>{
      if(s.locked || !s.canvas.width || e.button>0)return;
      e.preventDefault();
      try {o.setPointerCapture(e.pointerId);}catch(_){}
      const p=pt(s,e);s.drag={pointer:e.pointerId,start:p,last:p};
      if(s.tool==='text'){paintText(s,p.x,p.y);s.drag=null;return;}
      if(s.tool==='crop'){s.crop=null;drawOverlay(s);}
      if(s.tool==='brush'||s.tool==='erase')beginStroke(s,p.x,p.y);
    });
    o.addEventListener('pointermove',e=>{
      const d=s.drag;if(!d || d.pointer!==e.pointerId)return;
      e.preventDefault();const p=pt(s,e);
      if(s.tool==='crop'){s.crop=cropSelection(s,d.start,p);drawOverlay(s);}
      else if(s.tool==='brush'||s.tool==='erase')extendStroke(s,d.last,p);
      else if(['rect','circle','line'].includes(s.tool)){
        s.overlay.getContext('2d').clearRect(0,0,o.width,o.height);
        shape(s,d.start,p,o);
      }
      d.last=p;
    });
    const end=e=>{
      const d=s.drag;if(!d || d.pointer!==e.pointerId)return;
      s.drag=null;const p=pt(s,e);
      if(s.tool==='crop'){
        s.crop=cropSelection(s,d.start,p);drawOverlay(s);
        if(s.crop.w<5||s.crop.h<5)status(s,'Kawasan crop terlalu kecil. Seret sekali lagi.');
        else status(s,`Pilihan crop: ${s.crop.w}×${s.crop.h}px. Tekan “Potong pilihan”.`);
        updateState(s);
      }else if(['rect','circle','line'].includes(s.tool)){
        o.getContext('2d').clearRect(0,0,o.width,o.height);
        if(Math.abs(p.x-d.start.x)+Math.abs(p.y-d.start.y)>3){shape(s,d.start,p,s.canvas);snapshot(s);}
      }else if(s.tool==='brush'||s.tool==='erase')snapshot(s);
    };
    o.addEventListener('pointerup',end);
    o.addEventListener('pointercancel',e=>{if(s.drag?.pointer===e.pointerId){s.drag=null;drawOverlay(s);}});
  }
  function cropNow(s) {
    if(s.tool!=='crop'||!s.crop||s.crop.w<5||s.crop.h<5||s.locked)return;
    const r=s.crop;
    const temp=document.createElement('canvas');temp.width=r.w;temp.height=r.h;
    temp.getContext('2d').drawImage(s.canvas,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
    drawImageData(s.canvas,temp,r.w,r.h);
    s.crop=null;fitViewport(s);snapshot(s);status(s,`Imej berjaya di-crop kepada ${r.w}×${r.h}px.`);
  }
  function transform(s, rotate, flip) {
    if(!s.canvas.width||s.locked)return;
    const src=s.canvas, w=src.width, hh=src.height, temp=document.createElement('canvas');
    temp.width=rotate?hh:w;temp.height=rotate?w:hh;
    const ctx=temp.getContext('2d');ctx.save();
    if(rotate==='right'){ctx.translate(hh,0);ctx.rotate(Math.PI/2);}
    if(rotate==='left'){ctx.translate(0,w);ctx.rotate(-Math.PI/2);}
    if(flip==='h'){ctx.translate(w,0);ctx.scale(-1,1);}
    if(flip==='v'){ctx.translate(0,hh);ctx.scale(1,-1);}
    ctx.drawImage(src,0,0);ctx.restore();
    drawImageData(src,temp,temp.width,temp.height);s.crop=null;fitViewport(s);snapshot(s);
  }
  function exportBlob(s, mime = 'image/webp') {
    return new Promise((resolve, reject) => {
      if (s.locked || !s.canvas.width) return reject(new Error('Gambar belum boleh disimpan.'));
      try {
        const out = document.createElement('canvas');
        out.width = s.canvas.width; out.height = s.canvas.height;
        const ctx = out.getContext('2d');
        if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,out.width,out.height); }
        ctx.filter = filters(s); ctx.drawImage(s.canvas,0,0);
        out.toBlob(blob => blob ? resolve(blob) : reject(new Error('Browser gagal menjana gambar.')), mime, .91);
      } catch (e) { reject(new Error('Gagal eksport imej. Cuba gunakan Tukar Gambar.')); }
    });
  }
  async function publish(s) {
    if (s.locked || s.publishing || !s.canvas.width) return;
    if (!s.productId || !['hardware','build'].includes(s.productKind)) { status(s,'Produk tidak dikenali. Guna Download dahulu.'); return; }
    if (typeof window.azobssGetFirebaseAuthHeaders !== 'function') { status(s,'Sistem login Firebase belum tersedia. Login sebagai Administrator dan refresh.'); return; }
    if (!window.confirm(`Terbitkan gambar ${s.productTitle} ke GitHub AZOBSS?\n\nGambar lokal produk ini akan digantikan. Perubahan dapat dilihat pelanggan selepas GitHub Pages siap deploy.`)) return;
    s.publishing = true;
    updateState(s);
    const btn = node(s,'[data-photo-publish]'); btn.textContent = '⏳ Sedang simpan ke GitHub…';
    const result = node(s,'[data-photo-publish-result]'); result.textContent = '';
    status(s,'Menyemak identiti Administrator dan menyiarkan gambar…');
    try {
      const headers = await window.azobssGetFirebaseAuthHeaders(true);
      if (!headers?.Authorization || !/^Bearer /i.test(headers.Authorization)) throw new Error('Sila login semula sebagai Administrator AZOBSS.');
      const blob = await exportBlob({...s, locked:false},'image/webp');
      if (blob.size > 7 * 1024 * 1024) throw new Error('Fail melebihi 7MB. Cuba crop atau kecilkan gambar.');
      const form = new FormData();
      form.append('image',blob,`azobss-${s.productId}.webp`);
      form.append('productKind',s.productKind);
      form.append('productId',s.productId);
      form.append('productName',s.productTitle);
      const ctrl = new AbortController(); const timer = setTimeout(()=>ctrl.abort(),110000);
      let response;
      try {
        response = await fetch('https://azobss-backend.onrender.com/api/admin/pc-shop/image-publish',{
          method:'POST',headers:{Authorization:headers.Authorization},body:form,signal:ctrl.signal,cache:'no-store'
        });
      } finally {clearTimeout(timer);}
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.ok) throw new Error(data.message || `Penerbitan gagal (HTTP ${response.status}).`);
      s.published = true; s.exported = true;
      status(s,`✅ Berjaya commit ke GitHub (${String(data.commit||'').slice(0,9)}). GitHub Pages akan terbit secara automatik.`);
      const a = document.createElement('a');a.href=String(data.commitUrl||'');a.target='_blank';a.rel='noopener noreferrer';a.textContent='🔗 Lihat commit GitHub';
      result.replaceChildren(document.createTextNode(`Aset: ${data.imagePath} • `),a);
      // Keep browser map in memory current for this session. Published HTML map has a revisioned URL.
      const map = s.productKind==='hardware' ? window.AZOBSS_PC_LOCAL_HARDWARE_IMAGES : window.AZOBSS_PC_LOCAL_IMAGES;
      if (map && typeof map==='object') {map.ready=true;map.byId=map.byId||{};map.byId[s.productId]=data.imageUrl;}
    } catch (error) {
      const message = error?.name==='AbortError'?'Timeout menunggu server/GitHub. Semak GitHub sebelum ulang simpan.':(error.message||'Gagal menerbitkan gambar.');
      status(s,'❌ '+message);
      result.textContent = 'Tiada pengesahan commit. Gambar asal di website tidak diubah oleh editor.';
    } finally {
      s.publishing=false; btn.textContent='☁ Simpan & Terbitkan (WebP)';updateState(s);
    }
  }
  function download(s) {
    if(s.locked||!s.canvas.width)return;
    const mime=node(s,'[data-photo-format]').value;
    const out=document.createElement('canvas');out.width=s.canvas.width;out.height=s.canvas.height;
    const ctx=out.getContext('2d');
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);}
    ctx.filter=filters(s);ctx.drawImage(s.canvas,0,0);ctx.filter='none';
    const filename=baseName(node(s,'[data-photo-name]').value)+'.'+extension(mime);
    const finish=blob=>{
      if(!blob){status(s,'Format ini tidak disokong oleh browser. Cuba PNG.');return;}
      const href=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=href;a.download=filename;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),12000);
      s.exported=true;
      status(s,`Fail ${filename} dimuat turun (${(blob.size/1024).toFixed(0)} KB). Untuk siar pada website, gantikan fail imej asal dalam GitHub.`);
    };
    try{out.toBlob(finish,mime,mime==='image/jpeg'?.92:.93);}catch(_){status(s,'Gagal eksport. Pilih gambar lokal melalui “Tukar Gambar”.');}
  }
  function close(s, force=false) {
    if(!s||!s.root.isConnected)return;
    if(s.publishing && !force){status(s,'Proses GitHub masih berjalan.');return;}
    if(!force && s.dirty && !s.exported && !window.confirm('Suntingan belum dimuat turun. Tutup dan buang perubahan?'))return;
    s.controller.abort();if(s.observer)try{s.observer.disconnect()}catch(_){}
    s.root.remove();document.body.classList.remove('az-photo-editor-active');active=null;
    const target=s.returnFocus;
    if(target?.isConnected)requestAnimationFrame(()=>{try{target.focus({preventScroll:true})}catch(_){}});
  }
  function bind(s) {
    const signal=s.controller.signal;
    s.root.querySelectorAll('[data-photo-close]').forEach(b=>b.addEventListener('click',()=>close(s),{signal}));
    s.root.addEventListener('click',e=>{if(e.target===s.root)close(s);},{signal});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape' && active===s){e.preventDefault();e.stopImmediatePropagation();close(s);}
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&active===s){
        if(e.key.toLowerCase()==='z'){e.preventDefault();loadHistory(s,s.historyIndex-1);}
        if(e.key.toLowerCase()==='y'){e.preventDefault();loadHistory(s,s.historyIndex+1);}
      }
    },{capture:true,signal});
    s.root.querySelectorAll('[data-photo-tool]').forEach(b=>b.addEventListener('click',()=>setTool(s,b.dataset.photoTool),{signal}));
    node(s,'[data-photo-crop-apply]').addEventListener('click',()=>cropNow(s),{signal});
    s.root.querySelectorAll('[data-photo-rotate]').forEach(b=>b.addEventListener('click',()=>transform(s,b.dataset.photoRotate,null),{signal}));
    s.root.querySelectorAll('[data-photo-flip]').forEach(b=>b.addEventListener('click',()=>transform(s,null,b.dataset.photoFlip),{signal}));
    node(s,'[data-photo-undo]').addEventListener('click',()=>loadHistory(s,s.historyIndex-1),{signal});
    node(s,'[data-photo-redo]').addEventListener('click',()=>loadHistory(s,s.historyIndex+1),{signal});
    node(s,'[data-photo-reset]').addEventListener('click',()=>{if(s.original)loadHistory(s,0,true);},{signal});
    node(s,'[data-photo-size]').addEventListener('input',e=>{node(s,'[data-photo-size-value]').textContent=e.target.value;},{signal});
    node(s,'[data-photo-ratio]').addEventListener('change',()=>{s.crop=null;drawOverlay(s);updateState(s);},{signal});
    s.root.querySelectorAll('[data-photo-filter]').forEach(b=>{
      b.addEventListener('input',()=>{const kind=b.dataset.photoFilter;s.filters[kind]=Number(b.value);node(s,`[data-photo-filter-label="${kind}"]`).textContent=b.value+'%';updateState(s);},{signal});
      b.addEventListener('change',()=>snapshot(s),{signal});
    });
    node(s,'[data-photo-zoom]').addEventListener('input',e=>{s.zoom=clamp(e.target.value,50,200)/100;node(s,'[data-photo-zoom-label]').textContent=e.target.value+'%';fitViewport(s);},{signal});
    node(s,'[data-photo-download]').addEventListener('click',()=>download(s),{signal});
    node(s,'[data-photo-publish]').addEventListener('click',()=>publish(s),{signal});
    node(s,'[data-photo-upload]').addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)||file.size>25*1024*1024){status(s,'Pilih gambar PNG/JPEG/WebP/GIF/AVIF sehingga 25 MB.');return;}
      const temp=URL.createObjectURL(file);
      try {await initializeImage(s,temp);node(s,'[data-photo-name]').value=baseName(file.name);node(s,'[data-photo-format]').value=formatFromFile(file.name);} finally {URL.revokeObjectURL(temp);}
      e.target.value='';
    },{signal});
    bindPointer(s);
    if('ResizeObserver' in window){s.observer=new ResizeObserver(()=>fitViewport(s));s.observer.observe(node(s,'[data-photo-viewport]'));}
    else window.addEventListener('resize',()=>fitViewport(s),{signal});
  }
  async function open(options) {
    if(!looksLikeAdmin()){return false;}
    const url=String(options?.url||'');if(!url)return false;
    if(active)close(active,true);
    const title=String(options?.title||'Gambar Produk');
    const root=document.createElement('div');root.className='az-photo-editor-backdrop';root.setAttribute('data-azobss-photo-editor','1509');
    root.innerHTML=editorHtml(title,url,options);document.body.appendChild(root);document.body.classList.add('az-photo-editor-active');
    const s={root,controller:new AbortController(),returnFocus:options?.returnFocus||document.activeElement,canvas:root.querySelector('[data-photo-canvas]'),overlay:root.querySelector('[data-photo-overlay]'),tool:'crop',zoom:1,productKind:String(options?.productKind||''),productId:String(options?.productId||''),productTitle:title,publishing:false,published:false,history:[],historyIndex:-1,filters:{brightness:100,contrast:100,saturate:100,grayscale:0},crop:null,drag:null,locked:true,dirty:false,exported:false};
    active=s;bind(s);setTool(s,'crop');
    node(s,'[data-photo-close]')?.focus({preventScroll:true});
    await initializeImage(s,url,true);
    return true;
  }
  window.azobssPcImageEditor={open,isAdministrator:looksLikeAdmin};
})();
