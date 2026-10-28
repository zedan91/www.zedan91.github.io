const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tech = fs.readFileSync(path.join(root, 'tech', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const auth = fs.readFileSync(path.join(root, 'assets', 'js', 'azobss-global-auth.js'), 'utf8');

test('SolatTime featured shortcut remains present in current package', () => {
  assert.ok(['1.0.1321','1.0.1322','1.0.1323'].includes(pkg.version));
  assert.match(auth, new RegExp(`VERSION_TEXT\\s*=\\s*'v${pkg.version.split('.').pop()}'`));
  assert.match(tech, /id="solatTimeCard"/);
  assert.match(tech, /AZOBSS SolatTime/);
  assert.match(tech, /id="solatTimeDownloadBtn"/);
});

test('current SolatTime shortcut uses a private backend-issued R2 URL, never a public bucket URL', () => {
  assert.match(tech, /\/api\/tech-vault\/solattime-download/);
  assert.doesNotMatch(tech, /dash\.cloudflare\.com\/.*Azobss_SolatTime_Setup/i);
  assert.doesNotMatch(tech, /r2\.cloudflarestorage\.com/i);
});
