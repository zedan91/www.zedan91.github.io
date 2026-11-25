'use strict';

const { CATEGORIES,fail } = require('./azobss-finance-model.cjs');
const decimal = value => value === null || value === undefined ? '' : (value/100).toFixed(2);

function sheets(report) {
  const {range,openingAsOf,cashIn,cashOut,flow,reconciliation,profit,balance,detail} = report;
  const rm = (label,value) => [label,decimal(value)];
  const overview = [
    ['AZOBSS ENTERPRISE','Bank-based management report'],
    ['Period',range.from+' to '+range.to],
    ['Currency','MYR'],
    ['Opening balances as at',openingAsOf || 'Missing'],
    ['Basis','Bank movements and reviewed entries. Unreviewed amounts stay in suspense.'],
    [],['Bank reconciliation','MYR / count'],
    rm('Opening book bank balance',reconciliation.openingBankSen),
    rm('Closing book bank balance',reconciliation.closingBookSen),
    rm('Statement ending bank balance',reconciliation.bankClosingSen),
    rm('Unreconciled difference',reconciliation.differenceSen),
    ['Matched with Sales & Receipts',reconciliation.matched],
    ['Reconciled transactions',reconciliation.reconciled],
    ['Transactions needing review',reconciliation.needsReview],
    [],['Cash flow','MYR'],
    rm('Money in',cashIn),rm('Money out',cashOut),rm('Net bank movement',cashIn-cashOut),
    ...Object.entries(flow).map(([name,sum])=>rm(name,sum)),
    [],['Profit & loss (reviewed bank transactions)','MYR'],
    rm('Income net of bank refunds',profit.revenue),rm('Expenses',profit.expenses),rm('Net profit / loss',profit.net),
    ...Object.entries(profit.byCategory).filter(([id])=>CATEGORIES[id].account==='sales'||CATEGORIES[id].account==='expenses')
      .map(([id,sum])=>rm(CATEGORIES[id].label,sum)),
    [],['Balance sheet (bank-based draft)','MYR'],
    rm('Bank',balance.bank),rm('Other bank accounts',balance.otherBank),rm('Gateway clearing',balance.clearing),
    rm('Inventory',balance.inventory),rm('Fixed assets at cost',balance.fixedAssets),rm('Total assets',balance.assets),
    rm('Financing liabilities',balance.liabilities),rm('Owner capital and drawings',balance.equity),
    rm('Retained earnings',balance.retainedEarnings),rm('Total equity',balance.totalEquity),
    rm('Unclassified bank movements in suspense',balance.suspense),rm('Balance sheet difference',balance.differenceSen)
  ];
  const transactions = [['Date','Time','Reference','Recipient','Bank description','Amount MYR','Bank balance MYR',
    'Category','Supplier','Notes','Status','Sales & Receipts','Files']];
  const items = [['Date','Bank reference','Item','Quantity','Unit price MYR','Total MYR','Item category']];
  const files = [['Date','Bank reference','File ID','Filename','Size bytes']];
  for (const row of detail) {
    const {original,review,sale,attachments} = row;
    transactions.push([original.date,original.time,original.reference,original.recipient,original.description,
      decimal(original.amountSen),decimal(original.balanceSen),CATEGORIES[review?.category]?.label || '',
      review?.supplier || '',review?.notes || '',review?.reconciled ? 'Reconciled' : 'Needs Review',
      sale?.document || '', attachments.length]);
    items.push(...(review?.items || []).map(item=>[original.date,original.reference,item.name,item.quantity,
      decimal(item.unitPriceSen),decimal(item.lineSen),item.itemCategory]));
    files.push(...attachments.map(file=>[original.date,original.reference,file.id,file.filename,file.size]));
  }
  return {Summary:overview,Transactions:transactions,Items:items,'Evidence files':files};
}

function cell(value) {
  let printable = String(value ?? '');
  if (/^[\s\p{Cc}]*[=+\-@]/u.test(printable) && !/^-?\d+(?:\.\d+)?$/.test(printable)) printable="'"+printable;
  return '"'+printable.replace(/"/g,'""')+'"';
}

async function exportReport(report, format, PDFDocument) {
  const data = sheets(report);
  const filename = 'azobss-finance-'+report.range.key+'.'+format;
  if (format === 'csv') {
    const lines = Object.entries(data).flatMap(([name,rows])=>[[name],...rows,[]]);
    return { body:Buffer.from('\uFEFF'+lines.map(row=>row.map(cell).join(',')).join('\r\n')),filename,type:'text/csv; charset=utf-8' };
  }
  if (format === 'xlsx') {
    if (Object.values(data).reduce((sum,rows)=>sum+rows.length,0)>20_000) {
      throw fail('This Excel export is too large. Export CSV or choose a smaller period.',413);
    }
    const workbook = new (require('exceljs').Workbook)();
    for (const [name,rows] of Object.entries(data)) {
      const sheet = workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
      const moneyColumns = name==='Transactions' ? [6,7] : name==='Items' ? [5,6] : [];
      for (const values of rows) {
        const row = sheet.addRow(values.map((value,i)=>moneyColumns.includes(i+1) && typeof value==='string' && /^-?\d+\.\d\d$/.test(value) ? Number(value) : value));
        for (const column of moneyColumns) if (typeof row.getCell(column).value==='number') row.getCell(column).numFmt='#,##0.00;[Red](#,##0.00)';
      }
      sheet.getRow(1).font = {bold:true,color:{argb:'FFFFFFFF'}};
      sheet.getRow(1).fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF15314E'}};
      sheet.columns.forEach((column,index)=>{column.width=index===0?25:(name==='Transactions'&&index===4?50:24);});
    }
    const body=Buffer.from(await workbook.xlsx.writeBuffer());
    return {body,filename,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
  }
  const pdf = new PDFDocument({size:'A4',margin:39,info:{Title:'AZOBSS Finance '+report.range.key}});
  const chunks=[];
  const created=new Promise((resolve,reject)=>{
    pdf.on('data',chunk=>chunks.push(chunk));
    pdf.on('end',()=>resolve(Buffer.concat(chunks)));
    pdf.on('error',reject);
  });
  pdf.font('Helvetica-Bold').fontSize(19).fillColor('#123250').text('AZOBSS Finance & Accounting');
  pdf.font('Helvetica').fontSize(10).text(report.range.from+' to '+report.range.to+'  |  MYR');
  pdf.text('Opening balances as at: '+(report.openingAsOf || 'Missing')).moveDown();
  pdf.text('Bank movements and reviewed entries. Unreviewed amounts stay in suspense.').moveDown();
  for (const row of data.Summary.slice(5)) {
    if (!row.length) {
      pdf.moveDown(.5);
      continue;
    }
    pdf.font(row[1] === 'MYR' || row[1] === 'MYR / count'?'Helvetica-Bold':'Helvetica').fontSize(9);
    pdf.text(row.filter(value=>value !== '').join('   |   '));
  }
  pdf.addPage();
  pdf.font('Helvetica-Bold').fontSize(15).text('Transaction register').moveDown(.5);
  for (const row of data.Transactions.slice(1)) {
    if (pdf.y > 705) pdf.addPage();
    pdf.font('Helvetica-Bold').fontSize(9).text([row[0],row[1],row[5]+' MYR',row[10],row[11]].filter(Boolean).join('  |  '));
    pdf.font('Helvetica').fontSize(8).text([row[2],row[3],row[4],row[7],row[8],row[9],row[12]+' evidence files'].filter(Boolean).join('  |  '));
    pdf.moveDown(.5);
  }
  pdf.end();
  return {body:await created,filename,type:'application/pdf'};
}

module.exports={exportReport,sheets};

