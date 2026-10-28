const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'admin', 'AZOBSSTV', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin', 'index.html'), 'utf8');

function block(text, start, end) {
  const a = text.indexOf(start); const b = text.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `missing block ${start}`);
  return text.slice(a, b + end.length);
}

test('AZOBSSTV uses canonical Admin market header structure and destinations', () => {
  const expectedHrefs = ['/admin/','/staff/','/PA-BM/','/Perkhidmatan-Ukur-Tanah/','/Software-Tools/','/CAD-Tools-&amp;-Resources/','/AZOBSS-Market/','/affiliate-shop/','/PC-IT-Services/','/PC-Build/','/Tempah-Servis-IT/','/Upgrade-Parts/','/Troubleshoot-PC-Online/','/lucky-draw/','/AZOBSSTV/','/tools/','/Web-Pilihan/','/Sound-Effects/','/Tempah-Website/','/Tempahan-Makanan/'];
  assert.ok(page.includes('class="market-sticky-bar"'));
  assert.ok(page.includes('class="market-nav az-more-enabled"'));
  for (const href of expectedHrefs) assert.ok(page.includes(`href="${href}"`), `missing canonical nav destination ${href}`);
  for (const id of ['siteAuthActions','marketUserTools','userMenu','signedInName','userDropdown']) assert.ok(page.includes(`id="${id}"`), `missing canonical account control ${id}`);
});

test('sidebar matches current Admin labels and removes stale Sales Staff Applications child-shell item', () => {
  for (const label of ['Sales &amp; Receipts','Users','Dashboard','Support Inbox','Service Bookings','Notifications','Commission Manager','Subscription Codes','Membership','Keys &amp; Digital Access','AZOBSSTV','Logs &amp; Activity','Backup / Export','System Health','Maintenance','Settings']) {
    assert.ok(page.includes(label), `missing ${label}`);
  }
  assert.ok(!page.includes('href="/admin/?tab=salesstaffapps"'));
  assert.ok(page.includes('class="home-link aztv-side-link active"'));
});

test('AZOBSSTV has five real content tabs and matching panels', () => {
  for (const tab of ['overview','remote-config','notifications','devices','heartbeat']) {
    assert.ok(page.includes(`data-aztv-tab="${tab}"`));
    assert.ok(page.includes(`data-aztv-panel="${tab}"`));
  }
});

test('existing AZOBSSTV backend contract is retained', () => {
  assert.ok(page.includes('https://azobss-backend.onrender.com/api/azobsstv'));
  for (const route of ['/admin/config','/admin/devices','/admin/heartbeats','/admin/notifications']) assert.ok(page.includes(route), route);
  assert.ok(page.includes('x-azobsstv-admin-token'));
  assert.ok(page.includes('onAuthStateChanged'));
});
