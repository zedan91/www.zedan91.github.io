const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'..','AZOBSS-Developer-Files','AZDM-Cloudflare-Worker-v1215.js'),'utf8');
test('v1215 worker stores encrypted serials and never exposes serial_cipher',()=>{
  assert.match(worker,/serial_cipher TEXT NOT NULL DEFAULT/);
  assert.match(worker,/sealLicenseSerial/);
  assert.match(worker,/openLicenseSerial/);
  assert.match(worker,/const \{ serial_cipher, \.\.\.safeRow \} = row/);
});
test('v1215 enforces serial uniqueness and blocks same-current-key edits',()=>{
  assert.match(worker,/CREATE UNIQUE INDEX IF NOT EXISTS idx_azdm_licenses_serial_hash_unique/);
  assert.match(worker,/New serial must be different from the current serial/);
  assert.match(worker,/Serial key is already used by another customer/);
});
test('v1215 provides delete endpoint with customer-name confirmation',()=>{
  assert.match(worker,/\"\/admin\/delete\"/);
  assert.match(worker,/Customer name confirmation does not match/);
  assert.match(worker,/DELETE FROM licenses WHERE id=\?/);
});
