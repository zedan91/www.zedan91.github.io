const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('v1250 purchase history excludes unpaid payment attempts', () => {
  const server = read('deploy-server.js');
  const fn = server.slice(server.indexOf('async function azobssUpdatePaBmPurchaseLogsForOrder'), server.indexOf('function azobssPaBmDownloadError'));
  assert.match(fn, /if \(!paid\)[\s\S]*unpaid_not_purchase_history/);
  assert.ok(fn.indexOf('if (!paid)') < fn.indexOf('initFirebaseAdmin()'));
});

test('v1250 user purchase lists use paid-only records in both auth modules', () => {
  for (const file of ['assets/js/azobss-global-auth.js','assets/js/azobss-firebase-live-likes-sync.js']) {
    const src = read(file);
    assert.match(src, /const recentPurchaseRecords = records\.filter\(r => azobssIsPurchasePaidForDownload\(r\)\)/);
    assert.match(src, /filterPurchaseRows\(recentPurchaseRecords, userSearch\)/);
    assert.match(src, /azobss:pabm-payment-unpaid/);
    assert.match(src, /gatewayStatusId === '3'/);
  }
});

test('v1250 cart is backed up before ToyyibPay and restored on unpaid return', () => {
  const src = read('assets/js/azobss-pabm-storefront.js');
  assert.match(src, /PAYMENT_CART_BACKUP_PREFIX/);
  assert.match(src, /savePaymentCartBackup\(items, \{ orderId:/);
  assert.match(src, /restorePaymentCartBackup/);
  assert.match(src, /azobss:pabm-payment-unpaid/);
  assert.match(src, /version:1250/);
});

test('PA-BM page cache-busts all v1250 payment/cart scripts', () => {
  const html = read('PA-BM/index.html');
  assert.match(html, /azobss-global-auth\.js\?v=1250/);
  assert.match(html, /azobss-firebase-live-likes-sync\.js\?v=1250/);
  assert.match(html, /azobss-pabm-storefront\.js\?v=1250/);
});
