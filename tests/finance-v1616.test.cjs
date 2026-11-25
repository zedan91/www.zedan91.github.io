'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const Excel = require('exceljs');
const model = require('../lib/azobss-finance-model.cjs');
const { makeService,COLLECTIONS } = require('../lib/azobss-finance-service.cjs');
const { exportReport } = require('../lib/azobss-finance-reports.cjs');
const { financeRoute } = require('../lib/azobss-finance-route.cjs');

const csv = Buffer.from('Date,Time,Reference,Recipient,Description,Debit,Credit,Balance\r\n'+
 '02/11/2026,10:32,AZR-20261102-000044,Fixture buyer,CHIP customer payment,,100.00,1100.00\r\n'+
 '02/11/2026,,PUR001,Fixture vendor,"Hardware, stock",60.00,,1040.00\r\n'+
 '03/11/2026,,,Owner,Owner drawings,20.00,,1020.00\r\n');
const secret='finance-test-fixture-not-used-in-runtime';
const admin={uid:'fixture-administrator'};

function pdfStatement() {
  const pdf = new PDFDocument({size:'A4',margin:30});
  const parts=[];
  const buffer = new Promise(resolve=>{
    pdf.on('data',part=>parts.push(part));
    pdf.on('end',()=>resolve(Buffer.concat(parts)));
  });
  const headers=['Entry Date','Description','Debit','Credit','Balance'];
  const positions=[35,145,325,401,484];
  headers.forEach((header,i)=>pdf.text(header,positions[i],42,{lineBreak:false}));
  [['02/11','Customer payment','','100.00','1100.00'],['03/11','Owner drawings','20.00','','1080.00']]
    .forEach((row,n)=>row.forEach((value,i)=>pdf.text(value,positions[i],64+n*19,{lineBreak:false})));
  pdf.end();
  return buffer;
}

function fakeFirestore() {
  const records=new Map();
  const snapshot=ref=>{
    const value=records.get(ref.path);
    return {id:ref.id,ref,exists:Boolean(value),data:()=>value};
  };
  let autokey=0;
  function makeQuery(name, filters=[], order=null, cursor='', size=Infinity) {
    const own = key => ['__name__',key].join(':');
    return {
      doc(id='auto-'+ ++autokey) {
        const ref={id,path:name+'/'+id,get:async()=>snapshot(ref)};
        return ref;
      },
      where(key,op,value) {return makeQuery(name,[...filters,{key,op,value}],order,cursor,size);},
      orderBy(key,dir='asc') {return makeQuery(name,filters,{key,dir},cursor,size);},
      startAfter(doc) {return makeQuery(name,filters,order,doc.id,size);},
      limit(max) {return makeQuery(name,filters,order,cursor,max);},
      async get() {
        const docs=[...records.keys()].filter(key=>key.startsWith(name+'/'))
          .map(key=>snapshot({id:key.slice(name.length+1),path:key}))
          .filter(doc=>filters.every(({key,op,value})=>{
            const actual=doc.data()[key];
            if (op==='in') return value.includes(actual);
            return op==='>='?actual>=value:actual<=value;
          }));
        if (order) {
          docs.sort((a,b)=>{
            const value=doc=>order.key==='__name__'?own(doc.id):doc.data()[order.key];
            const result=value(a)>value(b)?1:value(a)<value(b)?-1:a.id.localeCompare(b.id);
            return order.dir==='desc'?-result:result;
          });
        }
        const after=cursor?docs.findIndex(doc=>doc.id===cursor)+1:0;
        return {docs:docs.slice(after,after+size)};
      }
    };
  }
  const db={
    records,
    collection:name=>makeQuery(name),
    getAll:async(...refs)=>refs.map(snapshot),
    async runTransaction(callback) {
      const writes=[];
      const result=await callback({
        get:async ref=>snapshot(ref),getAll:async(...refs)=>refs.map(snapshot),
        create:(ref,value)=>writes.push(()=>{
          assert.equal(records.has(ref.path),false,'transaction must not overwrite an immutable record');
          records.set(ref.path,value);
        }),
        set:(ref,value,options)=>writes.push(()=>records.set(ref.path,options?.merge?{...records.get(ref.path),...value}:value)),
        update:(ref,value)=>writes.push(()=>{
          assert.ok(records.has(ref.path));
          records.set(ref.path,{...records.get(ref.path),...value});
        })
      });
      for (const write of writes) write();
      return result;
    }
  };
  return db;
}

test('finance parses CSV, XLSX and text-based PDF without trusting incomplete transaction amounts',async()=>{
  const records=await model.parseStatement('maybank.csv',csv);
  assert.deepEqual(records.map(row=>row.amountSen),[10000,-6000,-2000]);
  assert.equal(records[0].time,'10:32:00');
  assert.equal(records[1].description,'Hardware, stock');
  assert.throws(()=>model.cents('12,34.00'),/separator/);
  assert.throws(()=>model.parseTable(model.csvRows(csv.toString().replace('1040.00','999.00'))),/running balances/);
  assert.throws(()=>model.dateOnly('2026-02-31'),/valid date/);
  const workbook=new Excel.Workbook();
  const sheet=workbook.addWorksheet('Maybank');
  sheet.addRows([['Date','Reference','Description','Amount','Balance'],[new Date('2026-11-02'),'AZR-20261102-000044','CHIP customer payment',100,1100],
    [new Date('2026-11-03'),'REF2','Operating expense',-5,1095]]);
  const excel=await model.parseStatement('maybank.xlsx',Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.deepEqual(excel.map(r=>[r.date,r.amountSen]),[['2026-11-02',10000],['2026-11-03',-500]]);
  const pdf=await pdfStatement();
  await assert.rejects(model.parseStatement('maybank.pdf',pdf),/statement month/);
  const pdfRows=await model.parseStatement('maybank.pdf',pdf,'2026-11');
  assert.deepEqual(pdfRows.map(r=>[r.date,r.description,r.amountSen,r.balanceSen]),[
    ['2026-11-02','Customer payment',10000,110000],['2026-11-03','Owner drawings',-2000,108000]
  ]);
});

test('finance authorizes before reading data and leaves provider sync pending',async()=>{
  let status, body;
  const env={
    pathname:'/api/admin/finance/overview',parsed:{query:{}},getDb:()=>assert.fail('Anonymous cannot reach Firestore'),
    adminIdentity:async()=>null,send:(_res,code,json)=>{status=code;body=JSON.parse(json);}
  };
  await financeRoute({method:'GET'},{},env);
  assert.equal(status,403);
  assert.equal(body.ok,false);
  env.adminIdentity=async()=>({isAdmin:true,authMethod:'api-secret'});
  await financeRoute({method:'GET'},{},env);
  assert.equal(status,403);
  env.adminIdentity=async()=>({isAdmin:true,authMethod:'firebase-admin-token'});
  env.pathname='/api/admin/finance/sync';
  await financeRoute({method:'POST'},{},env);
  assert.equal(status,409);
});

test('finance preserves originals, deduplicates imports and links only paid exact matches',async()=>{
  const db=fakeFirestore();
  db.records.set('premiumOrders/chip-1',{orderId:'chip-1',receiptNo:'AZR-20261102-000044',amountSen:10000,status:'paid',paymentMethod:'chip'});
  db.records.set('purchaseLogs/chip-order-log',{orderId:'chip-1',receiptNo:'AZR-20261102-000044',amountSen:10000,status:'paid',paymentMethod:'chip'});
  db.records.set('receipts/pending',{receiptNo:'PUR001',gross:60,status:'pending',paymentMethod:'bank-transfer'});
  const service=makeService(db,secret);
  const {previewKey,rows}=await service.importStatement(csv,'fixture.csv',admin);
  assert.equal(rows.length,3);
  assert.equal([...db.records.keys()].filter(k=>k.startsWith(COLLECTIONS.entries)).length,0);
  await assert.rejects(service.importStatement(csv,'fixture.csv',admin,true,'bad'),/Preview/);
  assert.deepEqual(await service.importStatement(csv,'fixture.csv',admin,true,previewKey),{imported:3,duplicates:0,matched:1,matchingDeferred:false});
  const repeated=await service.importStatement(csv,'fixture.csv',admin,true,previewKey);
  assert.equal(repeated.imported,0);
  const alternate=Buffer.from(csv.toString().replace('Hardware, stock','Hardware, stock ').replace('CHIP customer payment','chip customer payment'));
  const other=await service.importStatement(alternate,'other.csv',admin);
  assert.ok(other.rows.every(row=>row.duplicate));
  assert.equal((await service.importStatement(alternate,'other.csv',admin,true,other.previewKey)).imported,0);
  await assert.rejects(makeService(db,secret+'-changed').overview('2026-11'),/does not match the ledger/);
  const list=await service.overview('2026-11');
  assert.equal(list.rows.length,3);
  assert.equal(list.lastSuccessfulSync,null);
  assert.equal(list.syncAvailable,false);
  const sales=list.rows.find(row=>row.sale);
  assert.equal(sales.sale.document,'AZR-20261102-000044');
  assert.equal(sales.sale.method,'chip');
  assert.equal(sales.review.reconciled,true);
  const expense=list.rows.find(row=>row.original.reference==='PUR001');
  const before=db.records.get(COLLECTIONS.entries+'/'+expense.id).original;
  await assert.rejects(service.changes(expense.id,{revision:0,category:'stock'},admin),/changed/);
  await assert.rejects(service.changes(expense.id,{revision:1,category:'expense',reconciled:true,items:[{name:'A',quantity:1,unitPrice:10}]},admin),/item total/);
  const reviewed=await service.changes(expense.id,{revision:1,category:'stock',supplier:'Vendor',notes:'Fixture only',reconciled:true,
    items:[{name:'Item A',quantity:2,unitPrice:'20.00'},{name:'Item B',quantity:1,unitPrice:'20.00'}]},admin);
  assert.equal(reviewed.review.itemsTotalSen,6000);
  assert.deepEqual(db.records.get(COLLECTIONS.entries+'/'+expense.id).original,before);
  assert.equal((await service.matchSale(expense.id,admin)).sale,null);
  const pdf=await pdfStatement();
  const attachment=await service.addAttachment(expense.id,pdf,'fixture.pdf',admin);
  assert.equal(attachment.attachments.length,1);
  assert.equal((await service.addAttachment(expense.id,pdf,'copy.pdf',admin)).duplicate,true);
  assert.deepEqual((await service.download(attachment.attachments[0].id)).body,pdf);
  assert.deepEqual((await service.download(list.statements.find(item=>item.filename==='fixture.csv').id)).body,csv);

  const drawings=list.rows.find(row=>row.original.amountSen===-2000);
  await service.changes(drawings.id,{revision:1,category:'drawings',reconciled:true},admin);
  await service.saveOpening({asOf:'2026-10-31',bank:'1000',liabilities:0},admin);
  const report=await service.report('2026-11','1020.00');
  assert.equal(report.reconciliation.differenceSen,0);
  assert.equal(report.reconciliation.needsReview,0);
  assert.equal(report.profit.net,10000);
  assert.equal(report.balance.inventory,6000);
  assert.equal(report.balance.equity,98000);
  assert.equal(report.balance.differenceSen,0);
  assert.ok((await service.audit()).some(event=>event.type==='review-update'));
  assert.ok((await service.audit()).some(event=>event.type==='document-upload'));
  const backup=[];
  for await (const line of service.backupStream()) backup.push(JSON.parse(line));
  assert.ok(backup.some(row=>row.collection===COLLECTIONS.parts && row.data.data.$bytes));
  assert.ok(!JSON.stringify(backup).includes('Fixture buyer'));
  assert.ok(backup.at(-1).end);

  for (const format of ['pdf','csv','xlsx']) {
    const output=await exportReport(report,format,PDFDocument);
    assert.equal(output.filename,'azobss-finance-2026-11.'+format);
    assert.ok(output.body.length>100);
    if (format==='pdf') assert.equal(output.body.subarray(0,5).toString(),'%PDF-');
    if (format==='csv') assert.match(output.body.toString(),/Balance sheet \(bank-based draft\)/);
    if (format==='xlsx') {
      const parsed=new Excel.Workbook();
      await parsed.xlsx.load(output.body);
      assert.deepEqual(parsed.worksheets.map(sheet=>sheet.name),['Summary','Transactions','Items','Evidence files']);
    }
  }
});

