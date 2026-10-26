const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const globalAuth = fs.readFileSync(path.join(root,'assets/js/azobss-global-auth.js'),'utf8');
const storefront = fs.readFileSync(path.join(root,'assets/js/azobss-pabm-storefront.js'),'utf8');
const html = fs.readFileSync(path.join(root,'PA-BM/index.html'),'utf8');

test('verified payment starts direct local cart clearing before paid event dispatch without awaiting cloud sync', () => {
  assert.match(globalAuth, /async function azobssHardClearPaBmCartAfterPaid1371/);
  const paid = globalAuth.indexOf("background(()=>azobssHardClearPaBmCartAfterPaid1371(orderId || key,billCode,source || 'verified-paid'))");
  const event = globalAuth.indexOf("window.dispatchEvent(new CustomEvent('azobss:pabm-payment-paid'", paid);
  assert.ok(paid >= 0, 'direct return paid clear missing');
  assert.ok(event > paid, 'paid event must happen after local hard clear starts');
});

test('v1371 server recovery and admin test also use hard paid clear', () => {
  assert.match(globalAuth, /azobssPaBmCompletePaid1436\(data\.orderId \|\| verifiedKey,data\.billCode \|\| '',data\.recovered \? 'server-recovery-paid' : 'server-sync-paid'\)/);
  assert.match(globalAuth, /await azobssHardClearPaBmCartAfterPaid1371\(data\.orderId \|\| data\.recordId \|\| '', data\.billCode \|\| '', 'admin-test-paid'\)/);
});

test('v1371 late storefront init cannot restore just-paid backup', () => {
  const marker = storefront.indexOf("if (readRecentPaidCartClearMarker1371()) await clearPaidCartEverywhere('late-storefront-init-after-paid')");
  const restore = storefront.indexOf('else restorePaymentCartBackup()', marker);
  assert.ok(marker >= 0 && restore > marker);
  assert.match(storefront, /function restorePaymentCartBackup\(\) \{\s*if \(readRecentPaidCartClearMarker1371\(\)\)/);
  assert.match(storefront, /const backup = readPaymentCartBackup\(\);\s*const orderId = [\s\S]*backup && backup\.orderId/);
});

test('v1371 cache-busters force browsers to load paid-cart race fix', () => {
  assert.match(html, /azobss-global-auth\.js\?v=1436/);
  assert.match(html, /azobss-pabm-storefront\.js\?v=1436/);
});
