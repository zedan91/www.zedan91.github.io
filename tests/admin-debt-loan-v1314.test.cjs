const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1314 package and migration storage are present',()=>{
  assert.ok(['1.0.1314','1.0.1315','1.0.1316','1.0.1317'].includes(pkg.version));
  assert.match(html,/azobssAdminDebtLoanTrackerV1314/);
  assert.match(html,/AZ_DEBT_LEGACY_STORAGE_KEY='azobssAdminDebtLoanTrackerV1313'/);
  assert.match(html,/azDebtApplyV1314Migration/);
});

test('v1314 seeds requested due schedule and balances',()=>{
  assert.match(html,/balance:3469/);
  assert.match(html,/monthly:157\.68/);
  assert.match(html,/remainingInstallments:22/);
  assert.match(html,/nextDue:'2026-11-01'/);
  assert.match(html,/balance:7146/);
  assert.match(html,/monthly:397/);
  assert.match(html,/remainingInstallments:18/);
  assert.match(html,/nextDue:'2026-11-11'/);
  assert.match(html,/nextDue:'2026-11-14'/);
  assert.equal(Number((3469/22).toFixed(2)),157.68);
  assert.equal(397*18,7146);
  assert.equal(Number((11896.15+3469+7146+600+5000).toFixed(2)),28111.15);
  assert.equal(Number((479+157.68+397).toFixed(2)),1033.68);
});

test('debt list has no forced horizontal slide and supports direct due edit',()=>{
  assert.match(html,/\.az-debt-table\{width:100%;border-collapse:collapse;table-layout:fixed;min-width:0\}/);
  assert.match(html,/data-debt-due-input/);
  assert.match(html,/async function azDebtUpdateDue/);
  assert.match(html,/root\.addEventListener\('change'/);
});

test('each debt supports manual subtract and add with signed history',()=>{
  assert.match(html,/− Tolak \/ Bayar/);
  assert.match(html,/data-debt-action="add-balance"/);
  assert.match(html,/async function azDebtAddBalance/);
  assert.match(html,/direction:'increase'/);
  assert.match(html,/direction:'decrease'/);
});
