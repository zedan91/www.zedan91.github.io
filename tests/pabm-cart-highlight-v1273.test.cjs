const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'PA-BM', 'index.html'), 'utf8');

test('canonical classic cart core owns cart-button highlight state', () => {
  assert.match(html, /function syncTableCartButtons\(\)/);
  assert.match(html, /button\.classList\.toggle\('is-in-cart',active\)/);
  assert.match(html, /button\.setAttribute\('aria-pressed',active\?'true':'false'\)/);
  assert.match(html, /scheduleTableCartButtonSync\(\);/);
  assert.match(html, /MutationObserver/);
  assert.match(html, /syncTableCartButtons:syncTableCartButtons,version:1273/);
});
