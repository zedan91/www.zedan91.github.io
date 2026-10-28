const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1367 package version and one-email-card layout are present',()=>{
  assert.equal(pkg.version,'1.0.1367');
  assert.match(html,/az1367-users-column-head/);
  assert.match(html,/az1367-email-card/);
  assert.match(html,/TERKINI \/ TINDAKAN/);
  assert.match(html,/username dalam email sama/);
});

test('v1367 merges non-default settings at email-group level',()=>{
  assert.match(html,/function azRegGroupChangedStatusHtml\(g\)/);
  assert.match(html,/ids\.some\(azRegPaAllowed\)/);
  assert.match(html,/ids\.some\(azRegFoodOrdersAllowed\)/);
  assert.match(html,/azRegGroupPricePillsHtml\(ids\)/);
  assert.match(html,/Semua setting kekal default/);
});

test('v1367 action menu targets exact usernames for edit and delete',()=>{
  assert.match(html,/data-reg-menu-toggle/);
  assert.match(html,/Edit username/);
  assert.match(html,/Delete username/);
  assert.match(html,/data-reg-edit=/);
  assert.match(html,/data-reg-delete=/);
  assert.match(html,/Hanya username \$\{username\} akan dipadam/);
});

test('v1367 renderer emits one card per group instead of grouped child rows',()=>{
  const start=html.indexOf('function renderRegisteredUsersAdmin(){');
  const end=html.indexOf('\nasync function azRegRenderMembershipAdmin',start);
  const renderer=html.slice(start,end);
  assert.match(renderer,/page\.map\(g=>/);
  assert.match(renderer,/az1367-email-card/);
  assert.doesNotMatch(renderer,/az1363-email-group/);
  assert.doesNotMatch(renderer,/g\.identities\.map\(x=>azRegIdentityRowHtml/);
});
