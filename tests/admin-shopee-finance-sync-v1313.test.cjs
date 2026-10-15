const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const content = fs.readFileSync(path.join(root,'azobss-shopee-json-extension','content.js'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'azobss-shopee-json-extension','manifest.json'),'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1313 package and Debt & Loan finance types exist',()=>{
  assert.ok(['1.0.1313','1.0.1314','1.0.1315','1.0.1316','1.0.1317','1.0.1318','1.0.1321','1.0.1322'].includes(pkg.version));
  assert.match(html,/azobssAdminDebtLoanTrackerV1313/);
  assert.match(html,/azobssAdminDebtLoanTrackerV1312/);
  assert.match(html,/shopee-spaylater/);
  assert.match(html,/shopee-sloan/);
  assert.match(html,/value="spaylater"/);
  assert.match(html,/value="sloan"/);
});

test('admin has Shopee finance bridge, manual fallback and bank CSV import',()=>{
  assert.match(html,/azobss-shopee-finance-bridge-v1313/);
  assert.match(html,/Shopee Finance Auto Sync/);
  assert.match(html,/azDebtApplyFinanceSnapshot/);
  assert.match(html,/Auto reconcile: baki Shopee turun/);
  assert.match(html,/azDebtShopeePaste/);
  assert.match(html,/azDebtBankCsv/);
  assert.match(html,/bank-csv-estimate/);
});

test('extension exposes finance capture to AZOBSS admin while preserving product capture',()=>{
  assert.ok(manifest.content_scripts[0].matches.includes('https://www.azobss.com/admin/*'));
  assert.ok(manifest.content_scripts[0].matches.includes('https://azobss.com/admin/*'));
  assert.match(content,/azobssShopeeFinancePendingV1313/);
  assert.match(content,/payloadType:'finance'/);
  assert.match(content,/financeType:kind/);
  assert.match(content,/azobss-shopee-finance-ready/);
  assert.match(content,/azobssShopeePendingCaptureV1309/);
});

test('finance parser covers SPayLater and SLoan summary fields',()=>{
  assert.match(content,/Total Outstanding/);
  assert.match(content,/Current Bill/);
  assert.match(content,/Due Date/);
  assert.match(content,/Remaining Installment/);
  assert.match(content,/browser-good/);
  assert.match(content,/browser-partial/);
});

test('privacy design bridges selected fields rather than Shopee cookies or passwords',()=>{
  assert.doesNotMatch(content,/document\.cookie/);
  assert.doesNotMatch(content,/password/i);
  assert.match(content,/balance,currentDue/);
});
