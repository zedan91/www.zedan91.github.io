const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');

test('purchase history excludes unpaid payment attempts', () => {
  const server = read('deploy-server.js');
  const fn = server.slice(server.indexOf('async function azobssUpdatePaBmPurchaseLogsForOrder'), server.indexOf('function azobssPaBmDownloadError'));
  assert.match(fn, /if \(!paid\)[\s\S]*unpaid_not_purchase_history/);
  assert.ok(fn.indexOf('if (!paid)') < fn.indexOf('initFirebaseAdmin()'));
});

test('canonical global auth keeps user purchase lists paid-only', () => {
  const src = read('assets/js/azobss-global-auth.js');
  assert.match(src, /const recentPurchaseRecords = records\.filter\(r => azobssIsPurchasePaidForDownload\(r\)\)/);
  assert.match(src, /filterPurchaseRows\(recentPurchaseRecords, userSearch\)/);
  assert.match(src, /azobss:pabm-payment-unpaid/);
  assert.match(src, /gatewayStatusId === '3'/);
});

test('cart is backed up before ToyyibPay and restored on unpaid return', () => {
  const src = read('assets/js/azobss-pabm-storefront.js');
  assert.match(src, /PAYMENT_CART_BACKUP_PREFIX/);
  assert.match(src, /savePaymentCartBackup\(items, \{ orderId:/);
  assert.match(src, /restorePaymentCartBackup/);
  assert.match(src, /azobss:pabm-payment-unpaid/);
});

test('PA-BM cache-busts stabilization runtimes and never loads the legacy combined likes/auth module', () => {
  const html = read('PA-BM/index.html');
  assert.match(html, /azobss-global-auth\.js\?v=1272/);
  assert.match(html, /azobss-pabm-storefront\.js\?v=1272/);
  assert.match(html, /azobss-pabm-early-bridge\.js\?v=1272/);
  assert.doesNotMatch(html, /azobss-firebase-live-likes-sync\.js/);
});
