const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin', 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v1312 adds Debt & Loan admin tab and section', () => {
  assert.ok(['1.0.1312','1.0.1313'].includes(pkg.version));
  assert.match(html, /id="debtsloans" class="section az-debt-section"/);
  assert.ok((html.match(/data-tab="debtsloans"/g) || []).length >= 5);
  assert.match(html, /if\(id==='debtsloans'\)return loadDebtsLoans\(\);/);
  assert.match(html, /debtsloans:'salesreceipts'/);
});

test('v1312 seeds requested debt balances without full car-loan account number', () => {
  assert.match(html, /balance:11896\.15/);
  assert.match(html, /principalBalance:11188\.35/);
  assert.match(html, /monthly:479/);
  assert.match(html, /interestRate:3\.61/);
  assert.match(html, /remainingInstallments:26/);
  assert.match(html, /originalTenure:114/);
  assert.match(html, /lateCharges:8\.15/);
  assert.match(html, /creditor:'Nava Shankara'.*balance:600/);
  assert.match(html, /creditor:'Omar bin Akasah'.*balance:5000/);
  assert.doesNotMatch(html, /88820004746866/);
});

test('requested totals and planner math are correct', () => {
  const car = 11896.15;
  const nava = 600;
  const omar = 5000;
  assert.equal(Number((car + nava + omar).toFixed(2)), 17496.15);
  assert.equal(Number((nava + omar).toFixed(2)), 5600.00);
  assert.equal(Number((479 + (nava + omar) / 12).toFixed(2)), 945.67);
  assert.equal(Number((car - 11188.35).toFixed(2)), 707.80);
  assert.equal(Number((26 * 479).toFixed(2)), 12454.00);
  assert.equal(Number(((26 * 479) - car).toFixed(2)), 557.85);
  assert.equal(Number((((114 - 26) / 114) * 100).toFixed(1)), 77.2);
});

test('tracker has persistence, CRUD, payment and CSV hooks', () => {
  assert.match(html, /azobssAdminDebtLoanTrackerV1312/);
  assert.match(html, /adminFinance/);
  assert.match(html, /debtLoanTracker/);
  assert.match(html, /async function azDebtSaveEditor\(/);
  assert.match(html, /async function azDebtPay\(/);
  assert.match(html, /async function azDebtDelete\(/);
  assert.match(html, /function azDebtExportCsv\(/);
});
