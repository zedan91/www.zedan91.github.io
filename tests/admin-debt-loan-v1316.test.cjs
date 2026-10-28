const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));

test('v1316 debt money values stay on one line',()=>{
  assert.ok(['1.0.1316','1.0.1317','1.0.1318','1.0.1321','1.0.1322','1.0.1323'].includes(pkg.version));
  assert.match(html,/\.az-debt-money-line\{[^}]*white-space:nowrap/);
  assert.match(html,/\.az-debt-money-line\{[^}]*word-break:normal/);
  assert.match(html,/class=\\?"az-debt-money-line\\?"/);
});

test('v1316 gives balance and monthly columns more room without horizontal slide',()=>{
  assert.match(html,/\.az-debt-table th:nth-child\(3\)\{width:14%\}/);
  assert.match(html,/\.az-debt-table th:nth-child\(4\)\{width:14%\}/);
  assert.match(html,/\.az-debt-table td:nth-child\(4\)\{white-space:nowrap/);
  assert.match(html,/\.az-debt-table-wrap\{overflow:visible/);
});
