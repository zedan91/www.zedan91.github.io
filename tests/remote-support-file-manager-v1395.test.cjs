const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const server=fs.readFileSync('deploy-server.js','utf8');
const page=fs.readFileSync('Troubleshoot-PC-Online/index.html','utf8');

test('v1395 backend exposes public status/download and admin protected mutation routes',()=>{
  assert.match(server,/\/api\/remote-support-file\/status/);
  assert.match(server,/\/api\/remote-support-file\/download/);
  assert.match(server,/\/api\/remote-support-file\/admin-upload-token/);
  assert.match(server,/\/api\/remote-support-file\/admin-register/);
  assert.match(server,/\/api\/remote-support-file\/admin-delete/);
  assert.match(server,/azAdminIdentityFromRequest\(req,parsed\)/);
  assert.match(server,/Administrator authorization required\./);
});

test('v1395 restricts managed upload to BAT and persists active metadata',()=>{
  assert.match(server,/Only a Windows \.bat file can be uploaded here\./);
  assert.match(server,/AZOBSS_REMOTE_SUPPORT_SETTING_DOC = "remoteSupportFile"/);
  assert.match(server,/cloudflare-r2/);
  assert.match(server,/azRemoteSupportDeleteR2\(previous\)/);
});

test('v1395 page has admin-only manager controls and Firebase auth headers',()=>{
  assert.match(page,/id="remoteSupportAdminPanel"/);
  assert.match(page,/ADMIN ONLY/);
  assert.match(page,/id="remoteSupportFileInput"/);
  assert.match(page,/Upload \/ Replace BAT/);
  assert.match(page,/Delete Fail Aktif/);
  assert.match(page,/azobssGetFirebaseAuthHeaders/);
  assert.match(page,/admin-upload-token/);
  assert.match(page,/admin-register/);
  assert.match(page,/admin-delete/);
});

test('v1395 public button no longer depends only on a static href',()=>{
  assert.match(page,/id="remoteSupportDownloadBtn"/);
  assert.match(page,/\/api\/remote-support-file\/download/);
  assert.match(page,/Fail Remote Support belum tersedia/);
});
