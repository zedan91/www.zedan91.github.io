const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const sales=fs.readFileSync(path.join(root,'assets/js/azobss-admin-sales-receipts.js'),'utf8');
const checks=[
  ['canonical bridge exported',sales.includes('window.azSalesReceiptsAnalyticsSnapshot=async function')],
  ['ledger includes manual + website',sales.includes('[...manualRows,...websiteRows]')],
  ['module v1380',sales.includes('window.__azSalesReceiptsModuleVersion=1380')],
  ['admin loads v1380 module',html.includes('azobss-admin-sales-receipts.js?v=1380')],
  ['analytics uses canonical ledger',html.includes('azAdminLoadCanonicalSalesLedger')&&html.includes('window.azSalesReceiptsAnalyticsSnapshot')],
  ['gross KPI retained',html.includes('id="payTotalAll"')],
  ['total cost KPI added',html.includes('id="payTotalCost"')],
  ['net profit KPI canonical',html.includes('id="payTotalNet"')&&html.includes('Net Profit RM')],
  ['product cost detail',html.includes('id="payTotalProductCost"')],
  ['shipping cost detail',html.includes('id="payTotalShippingCost"')],
  ['payment fee detail',html.includes('id="payTotalFee"')],
  ['commission detail',html.includes('id="payTotalCommission"')],
  ['other cost detail',html.includes('id="payTotalOtherCost"')],
  ['period costs added',html.includes('salesTodayCostTotal')&&html.includes('salesThisMonthCostTotal')&&html.includes('salesThisYearCostTotal')],
  ['refresh forces canonical reload',html.includes("addEventListener('click',()=>loadPayments(true))")],
  ['old analytics fee wording removed',!html.includes('Net = selepas tolak caj ToyyibPay RM1 setiap transaksi.')],
];
let fail=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)fail++;}
if(fail)process.exit(1);
