const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const sales=fs.readFileSync(path.join(root,'assets','js','azobss-admin-sales-receipts.js'),'utf8');
const pdf=fs.readFileSync(path.join(root,'assets','js','azobss-admin-sales-receipt-pdf.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');

test('v1317 package and admin force fresh share assets',()=>{
  assert.ok(['1.0.1317','1.0.1318'].includes(pkg.version));
  assert.match(admin,/azobss-admin-sales-receipts\.js\?v=1318/);
  assert.match(admin,/azobss-admin-sales-receipt-pdf\.js\?v=1318/);
});

test('ToyyibPay URL is only exposed when ToyyibPay is the active payment method',()=>{
  assert.match(sales,/function toyyibPayPaymentUrl\(row,type='invoice'\)\{[\s\S]*?!rowUsesToyyibPay\(row\)\)return ''/);
  assert.match(sales,/const maybankText=docType==='invoice'\?pendingMaybankPaymentText\(row\):''/);
  assert.match(sales,/Pay via ToyyibPay: \$\{paymentUrl\}/);
});

test('temporary WhatsApp and Telegram text reuse payment-aware document share text',()=>{
  assert.match(sales,/function temporaryShareText\(row,type,shareUrl\)\{[\s\S]*?return documentShareText\(row,type,shareUrl\);/);
  assert.match(sales,/isMaybankInvoice\?'WhatsApp PDF \+ Maybank'/);
  assert.match(sales,/isMaybankInvoice\?'Telegram Invoice \+ Maybank'/);
});

test('PDF never renders dormant ToyyibPay QR when active method is Maybank',()=>{
  assert.match(pdf,/const activeMethod=clean\(row\.paymentMethod\|\|row\.verifiedPaymentMethod\)\.toLowerCase\(\);/);
  assert.match(pdf,/const canPay=activeMethod\.includes\('toyyib'\)/);
  assert.match(pdf,/const method=clean\(row\.paymentMethod\|\|row\.verifiedPaymentMethod\)\.toLowerCase\(\);/);
  assert.match(pdf,/method==='maybank'/);
});
