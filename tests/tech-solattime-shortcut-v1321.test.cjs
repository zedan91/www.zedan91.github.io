const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tech = fs.readFileSync(path.join(root, 'tech', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const auth = fs.readFileSync(path.join(root, 'assets', 'js', 'azobss-global-auth.js'), 'utf8');

test('v1321 package and badge are current', () => {
  assert.equal(pkg.version, '1.0.1321');
  assert.match(auth, /VERSION_TEXT\s*=\s*'v1321'/);
});

test('Tech Vault contains the AZOBSS SolatTime featured download shortcut', () => {
  assert.match(tech, /id="solatTimeCard"/);
  assert.match(tech, /AZOBSS SolatTime/);
  assert.match(tech, /id="solatTimeDownloadBtn"/);
  assert.match(tech, /function isSolatTimeFile\(file\)/);
  assert.match(tech, /name\.includes\('azobsssolattime'\) \|\| name\.includes\('solattime'\)/);
});

test('SolatTime shortcut uses existing secure Tech Vault token flow', () => {
  assert.match(tech, /downloadFile\(String\(solatTimeFile\.id\),\$\('solatTimeDownloadBtn'\)\)/);
  assert.match(tech, /api\('\/api\/tech-vault\/download-token'/);
  assert.doesNotMatch(tech, /AZOBSS[-_ ]SolatTime[^\n]{0,120}https?:\/\//i);
});
