const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const rules = fs.readFileSync(path.join(root, 'FIREBASE-RULES-AZOBSS-v1285-HOME-BANNER-ADMIN-MANAGER.txt'), 'utf8');

test('v1285 package version', () => {
  assert.ok(/^1\.0\.(1285|1286|1287|1288|1289)$/.test(pkg.version));
});

test('homepage has admin-only banner manager UI', () => {
  assert.match(html, /id="azHomeBannerAdminToggle1285"[^>]*hidden/);
  assert.match(html, /id="azHomeBannerAdminModal1285"[^>]*hidden/);
  assert.match(html, /function storedAdmin\(\)/);
  assert.match(html, /function firebaseAdmin\(user\)/);
  assert.match(html, /setAdmin\(storedAdmin\(\)\|\|firebaseAdmin/);
});

test('banner manager supports multiple uploaded linked banners', () => {
  assert.match(html, /const COLLECTION='homeBanners'/);
  assert.match(html, /id="azHomeBannerFile1285"[^>]*type="file"[^>]*accept="image\/\*"/);
  assert.match(html, /id="azHomeBannerLink1285"/);
  assert.match(html, /function newBanner\(\)/);
  assert.match(html, /setDoc\(doc\(db,COLLECTION,m\.id\)/);
  assert.match(html, /(?:imageData:m\.imageData|payload\.imageData=m\.imageData)/);
  assert.match(html, /(?:targetUrl:m\.targetUrl|payload\.targetUrl=m\.targetUrl)/);
});

test('banner manager supports drag move and resize plus numeric controls', () => {
  for (const id of ['azHomeBannerX1285','azHomeBannerY1285','azHomeBannerW1285','azHomeBannerH1285']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /state\.op=\{type:'move'/);
  assert.match(html, /state\.op=\{type:'resize'/);
  assert.match(html, /azHomeBannerResizeHandle1285/);
  assert.match(html, /document\.addEventListener\('pointermove'/);
});

test('managed banners preserve centered social safe zone and mobile stacking', () => {
  assert.match(html, /avoidSocial/);
  assert.match(html, /function effectiveDesktop\(m\)/);
  assert.match(html, /\.hero \.az-home-banner-layer\{position:relative!important/);
  assert.match(html, /display:grid!important;grid-template-columns:1fr!important/);
});

test('upload pipeline preserves normal images and compresses larger images', () => {
  assert.match(html, /if\(raw\.length<=420000\)return raw/);
  assert.match(html, /createImageBitmap/);
  assert.match(html, /canvas\.toBlob/);
  assert.match(html, /'image\/webp'/);
});

test('Firestore rules make home banners public-read and admin-write only', () => {
  assert.match(rules, /match \/homeBanners\/\{bannerId\}/);
  assert.match(rules, /allow read: if true;/);
  assert.match(rules, /allow create, update, delete: if isAdmin\(\);/);
  assert.match(rules, /zedan91@azobss\.local/);
  assert.match(rules, /zedan9107@gmail\.com/);
});
