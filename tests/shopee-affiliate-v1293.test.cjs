const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'affiliate-shop', 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend', 'server.js'), 'utf8');
const env = fs.readFileSync(path.join(root, 'backend', '.env.example'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1293 package exposes admin Shopee Product Offer integration', () => {
  assert.ok(['1.0.1293','1.0.1294','1.0.1295','1.0.1296','1.0.1297','1.0.1298','1.0.1299'].includes(pkg.version));
  assert.match(html, /id="adminShopeeOffersButton"/);
  assert.match(html, /Shopee Product Offer → AZOBSS Affiliate/);
  assert.match(html, /\/api\/shopee-affiliate\/product-offers/);
  assert.match(html, /data-shopee-add=/);
});

test('normal Shopee URL is auto-converted before an affiliate product is saved', () => {
  assert.match(html, /async function runShopeeAutoGetLink\(/);
  assert.match(html, /\/api\/shopee-affiliate\/generate-link/);
  assert.match(html, /await runShopeeAutoGetLink\(\)/);
  assert.match(html, /buttonText[^\n]*Buy Now|value="Buy Now"/);
});

test('Shopee Affiliate secret stays on backend and backend signs GraphQL requests', () => {
  assert.doesNotMatch(html, /SHOPEE_AFFILIATE_SECRET\s*=/);
  assert.match(server, /process\.env\.SHOPEE_AFFILIATE_SECRET/);
  assert.match(server, /crypto\.createHash\("sha256"\)/);
  assert.match(server, /generateShortLink\(input:/);
  assert.match(server, /productOfferV2\(/);
  assert.match(env, /SHOPEE_AFFILIATE_APP_ID=/);
  assert.match(env, /SHOPEE_AFFILIATE_SECRET=/);
});

test('customer cards use the stored affiliate link directly for Buy Now', () => {
  assert.match(html, /href="\$\{esc\(item\.link\)\}"/);
  assert.match(html, /offerLink/);
});
