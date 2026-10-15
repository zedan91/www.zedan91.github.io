const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const nav = fs.readFileSync(path.join(root, 'assets/js/azobss-more-nav.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'PC-IT-Services/index.html'), 'utf8');

test('v1311 package version', () => assert.ok(['1.0.1311','1.0.1312','1.0.1313','1.0.1314','1.0.1315','1.0.1316','1.0.1317','1.0.1318','1.0.1321','1.0.1322'].includes(pkg.version)));

test('Upgrade & Parts keeps canonical deep-link href and a real target', () => {
  assert.match(nav, /makeLink\('\/PC-IT-Services\/#upgrade-parts'/);
  assert.match(page, /id="upgrade-parts"/);
});

test('same-page Upgrade & Parts click keeps hash and scrolls instead of falling back to overview', () => {
  assert.match(nav, /history\.pushState\(null, document\.title, next\)/);
  assert.match(nav, /window\.location\.pathname \+ window\.location\.search \+ '#upgrade-parts'/);
  assert.match(nav, /activateUpgradeParts\(wrap, 'smooth'\)/);
  assert.match(nav, /scrollToUpgradeParts\('auto'\)/);
});

test('deep-link scroll accounts for sticky navbar height', () => {
  assert.match(nav, /querySelector\('\.market-sticky-bar'\)/);
  assert.match(nav, /stickyHeight/);
  assert.match(nav, /target\.getBoundingClientRect\(\)\.top/);
});

test('PC IT page cache-busts the shared nav fix', () => {
  assert.match(page, /azobss-more-nav\.js\?v=1311/);
});
