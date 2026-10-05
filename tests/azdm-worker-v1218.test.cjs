const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'..','AZOBSS-Developer-Files','AZDM-Cloudflare-Worker-v1218.txt'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','assets','js','azobss-azdm-admin.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','admin','index.html'),'utf8');

test('v1218 migrates and stores customer email and phone with each license',()=>{
  for(const field of ['email','email_key','phone','phone_key']) assert.match(worker,new RegExp(`ADD COLUMN ${field}`));
  assert.match(worker,/customerEmail\(body\.email\)/);
  assert.match(worker,/customerPhone\(body\.phone\)/);
  assert.match(worker,/INSERT INTO licenses\(id,serial_hash,serial_cipher,customer,customer_key,email,email_key,phone,phone_key/);
  assert.match(worker,/UPDATE licenses SET customer=\?,customer_key=\?,email=\?,email_key=\?,phone=\?,phone_key=\?/);
});

test('v1218 list can search customer, email and normalized phone',()=>{
  assert.match(worker,/instr\(customer_key,\?\)>0/);
  assert.match(worker,/instr\(email_key,\?\)>0/);
  assert.match(worker,/instr\(phone_key,\?\)>0/);
  assert.match(worker,/const phoneSearch = phoneKey\(search\)/);
});

test('v1218 list sort is server-whitelisted and pagination is tied to sort/search',()=>{
  for(const sort of ['created-desc','created-asc','customer-asc','customer-desc','email-asc','email-desc','phone-asc','phone-desc','expires-asc','expires-desc','status-active','status-revoked']) assert.match(worker,new RegExp(`"${sort}"`));
  assert.match(worker,/licenseSortSql\[sort\]/);
  assert.match(worker,/listCursorFor\(offset \+ limit, sort, search\)/);
});

test('v1218 AZOBSS admin shows contact fields, search and Sort by controls',()=>{
  assert.match(html,/id="azdm-email"/);
  assert.match(html,/id="azdm-phone"/);
  assert.match(html,/id="azdm-edit-email"/);
  assert.match(html,/id="azdm-edit-phone"/);
  assert.match(html,/id="azdm-sort"/);
  assert.match(html,/Cari nama, Gmail, no\. phone atau ID/);
  assert.match(ui,/api\('list',\{limit:25,search,sort,cursor:cursors\[page\]\}\)/);
  assert.match(ui,/item\.email/);
  assert.match(ui,/item\.phone/);
});
