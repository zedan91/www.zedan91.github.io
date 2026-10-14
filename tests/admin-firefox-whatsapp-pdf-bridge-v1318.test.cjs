const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const sales=fs.readFileSync(path.join(root,'assets','js','azobss-admin-sales-receipts.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const extRoot=path.join(root,'azobss-firefox-whatsapp-pdf-bridge');
const manifest=JSON.parse(fs.readFileSync(path.join(extRoot,'manifest.json'),'utf8'));
const bg=fs.readFileSync(path.join(extRoot,'background.js'),'utf8');
const siteBridge=fs.readFileSync(path.join(extRoot,'azobss-bridge.js'),'utf8');
const wa=fs.readFileSync(path.join(extRoot,'whatsapp-bridge.js'),'utf8');

test('v1318 package exposes fresh admin share assets and visible version',()=>{
  assert.equal(pkg.version,'1.0.1318');
  assert.match(admin,/azobss-admin-sales-receipts\.js\?v=1318/);
  assert.match(admin,/azobss-admin-sales-receipt-pdf\.js\?v=1318/);
  const auth=fs.readFileSync(path.join(root,'assets','js','azobss-global-auth.js'),'utf8');
  assert.match(auth,/VERSION_TEXT = 'v1318'/);
});

test('Firefox single-document WhatsApp/native actions use local physical-PDF bridge, not temporary Render URL',()=>{
  assert.match(sales,/function firefoxWhatsAppBridgeReady\(\)/);
  assert.match(sales,/async function firefoxPhysicalPdfToWhatsAppWeb\(context,button=null\)/);
  assert.match(sales,/type:'AZOBSS_FIREFOX_WA_PDF_SHARE_REQUEST'/);
  assert.match(sales,/if\(isFirefoxDesktop\(\)\)return firefoxPhysicalPdfToWhatsAppWeb\(context,button\);/g);
  const fn=sales.match(/async function firefoxPhysicalPdfToWhatsAppWeb\(context,button=null\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.ok(fn);
  assert.doesNotMatch(fn,/ensureSharePanelTemporary|shareUrl|createDocumentTemporary/);
  assert.match(fn,/blobToDataUrl\(payload\.file\)/);
});

test('Firefox extension is scoped to AZOBSS admin and WhatsApp Web',()=>{
  assert.equal(manifest.manifest_version,2);
  assert.equal(manifest.version,'1.0.0');
  assert.ok(manifest.permissions.includes('https://www.azobss.com/admin/*'));
  assert.ok(manifest.permissions.includes('https://web.whatsapp.com/*'));
  const joined=manifest.content_scripts.flatMap(x=>x.matches).join('\n');
  assert.match(joined,/www\.azobss\.com\/admin/);
  assert.match(joined,/web\.whatsapp\.com/);
  assert.match(manifest.browser_specific_settings.gecko.id,/azobss-firefox-whatsapp-pdf@azobss\.com/);
});

test('bridge opens WhatsApp Web and transfers the generated PDF payload locally',()=>{
  assert.match(bg,/https:\/\/web\.whatsapp\.com\/send\?phone=/);
  assert.match(bg,/pendingByWhatsappTab\.set\(tab\.id, entry\)/);
  assert.match(siteBridge,/AZOBSS_FIREFOX_WA_PDF_SHARE_REQUEST/);
  assert.match(siteBridge,/AZOBSS_FIREFOX_WA_PDF_SHARE/);
  assert.match(wa,/new File\(\[bytes\]/);
  assert.match(wa,/new DataTransfer\(\)/);
  assert.match(wa,/input\.files = transfer\.files/);
  assert.match(wa,/input\.dispatchEvent\(new Event\('change'/);
});

test('WhatsApp bridge stops at preview and asks admin to press Send manually',()=>{
  assert.match(wa,/Semak preview dan tekan Send/);
  assert.doesNotMatch(wa,/send\.click\(\)/);
  assert.match(wa,/findPreviewCaptionBox/);
  assert.match(wa,/fillCaption\(caption, payload\.caption\)/);
});
