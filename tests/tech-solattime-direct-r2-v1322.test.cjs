const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const server=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const tech=fs.readFileSync(path.join(root,'tech','index.html'),'utf8');
const auth=fs.readFileSync(path.join(root,'assets','js','azobss-global-auth.js'),'utf8');

test('v1322 package and visible badge are current',()=>{
  assert.ok(['1.0.1322','1.0.1323'].includes(pkg.version));
  assert.match(auth,/VERSION_TEXT = 'v1323'/);
});

test('SolatTime points to the exact existing private R2 object supplied by admin',()=>{
  assert.match(server,/AZOBSS_SOLATTIME_R2_OBJECT_KEY = "software\/Azobss_SolatTime_Setup\.exe"/);
  assert.match(server,/AZOBSS_SOLATTIME_FILENAME = "Azobss_SolatTime_Setup\.exe"/);
  assert.doesNotMatch(server,/software\/Azobss_SolatTime_Setup_v1_0_2\.exe/);
});

test('Tech Vault issues a signed direct R2 download for SolatTime without requiring Tech Vault metadata registration',()=>{
  assert.match(server,/pathname === "\/api\/tech-vault\/solattime-download"/);
  assert.match(server,/azSolatTimeR2DownloadUrl\(\)/);
  assert.match(server,/azTechVaultSignPayload\(\{/);
  assert.match(server,/`\$\{azR2DownloadBaseUrl\(\)\}\/dl\/\$\{encodeURIComponent\(token\)\}`/);
  assert.match(tech,/api\('\/api\/tech-vault\/solattime-download',\{method:'POST'\}\)/);
});

test('direct SolatTime route remains protected by Tech Vault session',()=>{
  const route=server.slice(server.indexOf('pathname === "/api/tech-vault/solattime-download"'), server.indexOf('pathname === "/api/tech-vault/download-token"'));
  assert.match(route,/azTechVaultSessionFromRequest\(req\)/);
  assert.match(route,/Tech Vault session required/);
});
