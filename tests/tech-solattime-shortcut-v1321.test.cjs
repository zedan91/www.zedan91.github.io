const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tech = fs.readFileSync(path.join(root, 'tech', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const auth = fs.readFileSync(path.join(root, 'assets', 'js', 'azobss-global-auth.js'), 'utf8');

test('Liyabudun featured shortcut remains present in current package', () => {
  assert.ok(Number(String(pkg.version||'').split('.').pop()) >= 1321);
  assert.match(auth, new RegExp(`VERSION_TEXT\\s*=\\s*'v${pkg.version.split('.').pop()}'`));
  assert.match(tech, /id="solatTimeCard"/);
  assert.match(tech, /<h3>Liyabudun<\/h3>/);
  assert.doesNotMatch(tech, /AZOBSS SolatTime/);
  assert.match(tech, /id="solatTimeDownloadBtn"/);
});

test('Liyabudun shortcut uses the stable public Latest installer', () => {
  assert.match(tech, /href="https:\/\/files\.azobss\.com\/liyabudun\/releases\/Latest\/Liyabudun_Setup\.exe"/);
  assert.doesNotMatch(tech, /\/api\/tech-vault\/solattime-download/);
  assert.doesNotMatch(tech, /dash\.cloudflare\.com\/.*Azobss_SolatTime_Setup/i);
  assert.doesNotMatch(tech, /r2\.cloudflarestorage\.com/i);
});
