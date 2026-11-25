'use strict';

const MAX_ROWS = 140;
const MAX_FILE = 5 * 1024 * 1024;
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const MAX_AMOUNT = 100_000_000_000;
const CATEGORIES = {
  sales: { label:'Sales income', direction:1, account:'sales', cashFlow:'Operating' },
  refund: { label:'Customer refunds', direction:-1, account:'sales', cashFlow:'Operating' },
  expense: { label:'Operating expenses', direction:-1, account:'expenses', cashFlow:'Operating' },
  fees: { label:'Bank and gateway fees', direction:-1, account:'expenses', cashFlow:'Operating' },
  cogs: { label:'Direct costs', direction:-1, account:'expenses', cashFlow:'Operating' },
  capital: { label:'Owner capital', direction:1, account:'equity', cashFlow:'Financing' },
  drawings: { label:'Owner drawings', direction:-1, account:'equity', cashFlow:'Financing' },
  borrowing: { label:'Financing proceeds', direction:1, account:'liabilities', cashFlow:'Financing' },
  repayment: { label:'Financing principal repaid', direction:-1, account:'liabilities', cashFlow:'Financing' },
  transfer: { label:'Internal bank transfer', account:'otherBank', cashFlow:'Internal transfers' },
  clearing: { label:'Gateway clearing / settlement', account:'clearing', cashFlow:'Gateway clearing' },
  stock: { label:'Stock purchases / returns', account:'inventory', cashFlow:'Operating' },
  asset: { label:'Fixed-asset purchases / disposals at cost', account:'fixedAssets', cashFlow:'Investing' }
};
const OPENING_FIELDS = ['bank','otherBank','clearing','inventory','fixedAssets','liabilities'];

function fail(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function text(value, max = 600) {
  return String(value ?? '').trim().replace(/\u0000/g, '').slice(0, max);
}

function fingerprintText(value) {
  return text(value).normalize('NFKC').toUpperCase().replace(/\s+/gu, ' ');
}

function dateOnly(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const input = text(value);
  let parts = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  let [y, m, d] = parts?.slice(1).map(Number) || [];
  if (!parts) {
    parts = input.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})(?:[T\s].*)?$/);
    if (parts) {
      [d,m,y] = parts.slice(1).map(Number);
      if (y < 100) y += 2000;
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2200 || date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) {
    throw fail('Use a valid date in YYYY-MM-DD or DD/MM/YYYY format.');
  }
  return date.toISOString().slice(0, 10);
}

function timeOnly(value) {
  const raw = text(value);
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) throw fail('Use a valid 24-hour time or AM/PM time.');
  let hour = Number(match[1]);
  const [, , minute,second = '00', half] = match;
  if (half) {
    if (hour < 1 || hour > 12) throw fail('Invalid time.');
    hour = hour % 12 + (half.toUpperCase() === 'PM' ? 12 : 0);
  }
  if (hour > 23 || Number(minute) > 59 || Number(second) > 59) throw fail('Invalid time.');
  return [String(hour).padStart(2,'0'),minute,second].join(':');
}

function cents(value, allowEmpty = false) {
  let raw = text(value).replace(/^(?:RM|MYR)\s*/i, '').trim();
  if (allowEmpty && (!raw || /^[-—]$/.test(raw))) return null;
  if (/^\(.*\)$/.test(raw)) raw = '-' + raw.slice(1,-1).trim();
  const side = raw.match(/\s*(DR|CR|[+-])$/i);
  if (side) {
    raw = raw.slice(0, side.index).trim();
    if (/^(?:DR|-)$/i.test(side[1])) raw = '-' + raw;
  }
  if (raw.includes(',')) {
    if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw)) throw fail('Invalid thousands separator.');
    raw=raw.replace(/,/g,'');
  }
  if (/^\.\d{1,2}$/.test(raw)) raw = '0'+raw;
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(raw)) throw fail('Invalid amount. Use MYR with up to two decimal places.');
  const result = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_AMOUNT) throw fail('Amount is outside the supported range.');
  return result;
}

function csvRows(input) {
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (source.includes('\u0000')) throw fail('Save the CSV as UTF-8 before importing.');
  const first = source.split('\n').find(line => line.trim()) || '';
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted && char === '"' && source[i+1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"' && (quoted || !cell)) {
      quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n')) {
      row.push(cell);
      cell = '';
      if (char === '\n') {
        if (row.some(part => part.trim())) rows.push(row);
        row = [];
      }
    } else {
      cell += char;
    }
  }
  if (quoted) throw fail('CSV contains an unclosed quoted field.');
  if (cell || row.length) rows.push([...row,cell]);
  return rows;
}

const HEADERS = {
  date:['date','date time','transaction date','transaction date time','posting date','value date','tarikh','tarikh transaksi','tarikh urus niaga','tarikh urusniaga','tarikh masuk','entry date','tran date'],
  time:['time','transaction time','masa','masa transaksi'],
  credit:['credit','credit amount','cr','deposit','deposits','deposit amount','money in','masuk','kredit','wang masuk','paid in'],
  debit:['debit','debit amount','dr','withdrawal','withdrawals','withdrawal amount','money out','keluar','wang keluar','paid out'],
  amount:['amount','transaction amount','jumlah','amaun','amaun transaksi','jumlah transaksi'],
  direction:['direction','type','dr cr','debit credit','credit debit','transaction type','jenis','aliran'],
  balance:['balance','running balance','available balance','baki','baki penyata','ledger balance','statement balance'],
  description:['description','transaction description','transaction details','particulars','details','narrative','keterangan','butiran','keterangan transaksi','butir urusniaga','butir urus niaga','transaction particulars','transaction'],
  recipient:['payee','recipient','beneficiary','counterparty','recipient name','penerima','nama penerima','payer'],
  reference:['reference','reference number','reference no','transaction id','transaction reference','transaction reference no','ref','ref no','rujukan','no rujukan','nombor rujukan']
};

function headerKey(value) {
  const clean = text(value).toLowerCase().replace(/\((?:myr|rm)\)/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
  return Object.keys(HEADERS).find(key => HEADERS[key].includes(clean));
}

function headerIndexes(row) {
  const columns = {};
  row.forEach((cell,index) => {
    const key = headerKey(cell);
    if (key && columns[key] === undefined) columns[key] = index;
  });
  return columns;
}

function isHeader(columns) {
  return columns.date !== undefined && (columns.amount !== undefined || (columns.credit !== undefined && columns.debit !== undefined));
}

function directionFor(value) {
  const valueKey = fingerprintText(value);
  if (/^(?:CR|C|CREDIT|IN|MONEY IN|DEPOSIT|MASUK|KREDIT|\+)$/.test(valueKey)) return 1;
  if (/^(?:DR|D|DEBIT|OUT|MONEY OUT|WITHDRAWAL|KELUAR|-)$/.test(valueKey)) return -1;
  throw fail('The direction column must say Credit/Debit, CR/DR or In/Out.');
}

function transaction(row, columns) {
  const get = name => row[columns[name]] ?? '';
  const rawDate = get('date');
  const date = dateOnly(rawDate);
  const inlineTime = !(rawDate instanceof Date) && text(rawDate).match(/[T\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i)?.[1];
  const time = timeOnly(get('time') || inlineTime || '');
  let amountSen;
  if (columns.credit !== undefined && columns.debit !== undefined) {
    const credit = cents(get('credit'), true) || 0;
    const debit = cents(get('debit'), true) || 0;
    if (credit < 0 || (credit && debit)) throw fail('Every row needs one amount in either debit or credit.');
    amountSen = credit || -Math.abs(debit);
  } else {
    amountSen = cents(get('amount'));
    if (text(get('direction'))) amountSen = Math.abs(amountSen) * directionFor(get('direction'));
  }
  if (!amountSen) throw fail('Zero-value transaction.');
  const description = text(get('description'), 1600);
  const reference = text(get('reference'), 180);
  const recipient = text(get('recipient'), 240);
  return {date,time,amountSen,balanceSen:cents(get('balance'), true),description,reference,recipient};
}

function parseTable(rows, { statement = false } = {}) {
  const header = rows.findIndex(row => isHeader(headerIndexes(row)));
  if (header === -1) throw fail('No supported transaction headers found. Use Date, Debit, Credit or Date and signed Amount. Balance, Time, Reference, Recipient and Description are optional.');
  let columns = headerIndexes(rows[header]);
  const data = [];
  for (let index = header + 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.every(cell => !text(cell))) continue;
    const repeated = headerIndexes(row);
    if (isHeader(repeated)) {
      columns = repeated;
      continue;
    }
    const combined = fingerprintText(row.filter(Boolean).join(' '));
    if (/^(?:(?:OPENING|BEGINNING|CLOSING|ENDING|PREVIOUS|TOTAL)\s+BALANCE|BAKI\s+(?:AWAL|AKHIR)|BALANCE\s+(?:B\/F|C\/F))\b/.test(combined)) continue;
    if (statement && !/^\s*\d/.test(text(row[columns.date]))) continue;
    try {
      data.push(transaction(row, columns));
    } catch (error) {
      throw fail('Row '+(index+1)+': '+error.message);
    }
    if (data.length > MAX_ROWS) throw fail('Split the statement into files of at most '+MAX_ROWS+' transactions.');
  }
  if (!data.length) throw fail('The statement has no transactions.');
  if (data.length>1 && data.every(row=>row.balanceSen!==null)) {
    const ascending=data.every((row,index)=>!index || row.balanceSen===data[index-1].balanceSen+row.amountSen);
    const descending=data.every((row,index)=>!index || data[index-1].balanceSen===row.balanceSen+data[index-1].amountSen);
    if (!ascending && !descending) throw fail('The running balances do not agree with the imported amounts. Check that the file contains consecutive rows with the correct debit and credit columns.');
  }
  return data;
}

function parsePdfLines(lines,month) {
  if (month && !/^\d{4}-\d{2}$/.test(month)) throw fail("Use a statement month in YYYY-MM format.");
  if (month) dateOnly(month+"-01");
  const rawRows = [];
  let marks = null;
  let current = null;
  function flush() {
    if (current) rawRows.push(current);
    current = null;
  }
  for (const words of lines) {
    const tokens = words.filter(word => text(word.value));
    const found = tokens.map(word => ({x:word.x,key:headerKey(word.value)})).filter(word => word.key);
    const keys = Object.fromEntries(found.map(word => [word.key,true]));
    if (isHeader(keys)) {
      flush();
      marks = found.sort((a,b) => a.x-b.x).filter((item,i,all) => all.findIndex(peer => peer.key===item.key)===i);
      rawRows.push(marks.map(mark => mark.key));
      continue;
    }
    if (!marks || !tokens.length) continue;
    const dateCell = text(tokens[0].value);
    const hasDate = /^\d{1,4}[\/.-]\d{1,2}[\/.-]\d{2,4}(?:$|\s)/.test(dateCell) || /^\d{1,2}[\/]\d{1,2}$/.test(dateCell);
    if (/^\d{1,2}[\/]\d{1,2}$/.test(dateCell)) {
      if (!month) throw fail('This PDF lists dates without a year. Enter the statement month and year.');
      const [day,rawMonth]=dateCell.split('/').map(Number);
      const statementMonth=Number(month.slice(5));
      const year=Number(month.slice(0,4))-(statementMonth===1 && rawMonth===12 ? 1 : 0);
      if (rawMonth!==statementMonth && rawMonth!==(statementMonth===1?12:statementMonth-1)) throw fail('The PDF transaction dates do not match the selected statement month.');
      tokens[0]={...tokens[0],value:day+'/'+rawMonth+'/'+year};
    }
    const wording = fingerprintText(tokens.map(token => token.value).join(' '));
    if (!hasDate && (/\b(?:BALANCE B\/F|BALANCE C\/F|OPENING BALANCE|CLOSING BALANCE|TOTAL DEBIT|TOTAL CREDIT|END OF STATEMENT|BAKI AWAL|BAKI AKHIR)\b/.test(wording))) {
      flush();
      continue;
    }
    if (!hasDate) {
      const description = marks.findIndex(mark => mark.key==='description');
      if (current && description >= 0 && tokens.every(word => word.x >= marks[description].x-5 && word.x < (marks[description+1]?.x ?? Infinity)-3)) {
        current[description] = [current[description],tokens.map(word => word.value).join(' ')].filter(Boolean).join('\n');
      }
      continue;
    }
    flush();
    current = marks.map(() => '');
    for (const word of tokens) {
      const column = marks.findLastIndex(mark => word.x >= mark.x-10);
      if (column >= 0) current[column] = [current[column],word.value].filter(Boolean).join(' ');
    }
  }
  flush();
  return parseTable(rawRows, {statement:true});
}

async function readPdf(file,month) {
  const root=path.dirname(require.resolve('pdfjs-dist/package.json'));
  const pdf = await import(pathToFileURL(path.join(root,'legacy/build/pdf.mjs')).href);
  const task = pdf.getDocument({
    data:Uint8Array.from(file), useSystemFonts:false, isEvalSupported:false, disableFontFace:true,
    useWasm:false, stopAtErrors:true,standardFontDataUrl:path.join(root,'standard_fonts')+path.sep
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 30) throw fail('Split PDF statements into files of at most 30 pages.');
    const lines = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const {items} = await page.getTextContent();
      const grouped = [];
      for (const item of items) {
        if (!item.str?.trim()) continue;
        const [,,,,x,y] = item.transform;
        let line = grouped.find(candidate => Math.abs(candidate.y-y) <= 2);
        if (!line) {
          line = {y,words:[]};
          grouped.push(line);
        }
        line.words.push({x, value:item.str.trim()});
      }
      lines.push(...grouped.sort((a,b)=>b.y-a.y).map(line=>line.words.sort((a,b)=>a.x-b.x)));
    }
    return parsePdfLines(lines,month);
  } catch (error) {
    if (error.statusCode) throw error;
    throw fail('The PDF could not be read. Use a text-based, unlocked statement or export a CSV or XLSX file.');
  } finally {
    await task.destroy();
  }
}

function validateXlsx(file) {
  const yauzl = require('yauzl');
  return new Promise((resolve,reject) => {
    yauzl.fromBuffer(file,{lazyEntries:true,validateEntrySizes:true},(error,archive) => {
      if (error) return reject(fail('Invalid XLSX workbook.'));
      let uncompressed = 0;
      let count = 0;
      archive.on('entry',entry => {
        count++;
        uncompressed += entry.uncompressedSize;
        if (entry.isEncrypted() || count > 200 || uncompressed > 20*1024*1024) {
          archive.close();
          reject(fail('XLSX workbook exceeds the size limit or is encrypted.'));
          return;
        }
        if (entry.fileName.endsWith('/')) {
          archive.readEntry();
          return;
        }
        archive.openReadStream(entry,(streamError,stream)=>{
          const invalid=()=>{
            archive.close();
            reject(fail('Invalid XLSX workbook.'));
          };
          if (streamError) return invalid();
          stream.on('error',invalid);
          stream.on('end',()=>archive.readEntry());
          stream.resume();
        });
      });
      archive.on('error',() => reject(fail('Invalid XLSX workbook.')));
      archive.on('end',resolve);
      archive.readEntry();
    });
  });
}

function parseDocument(filename,file,month) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(__filename,{
      workerData:{filename,file,month},
      resourceLimits:{maxOldGenerationSizeMb:96,maxYoungGenerationSizeMb:12}
    });
    let finished=false;
    const timer=setTimeout(()=>{
      finish(fail('Statement processing timed out. Use a smaller file or export CSV.',408));
      worker.terminate();
    },15_000);
    function finish(error,rows) {
      if (finished) return;
      finished=true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(rows);
    }
    worker.once('message',result=>finish(result.error?fail(result.error,result.statusCode||400):null,result.rows));
    worker.once('error',()=>finish(fail('The statement exceeded the processing limit or could not be read.')));
    worker.once('exit',()=>finish(fail('The statement processing stopped before completion.')));
  });
}

async function readStatement(filename, file, month) {
  if (!Buffer.isBuffer(file) || !file.length || file.length > MAX_FILE) throw fail('Choose a statement file up to 5 MB.');
  if (/\.csv$/i.test(filename)) {
    let decoded;
    try { decoded = new TextDecoder('utf-8',{fatal:true}).decode(file); }
    catch (_) {throw fail('Save the CSV as UTF-8 before importing.');}
    return parseTable(csvRows(decoded));
  }
  if (/\.pdf$/i.test(filename) && file.subarray(0,5).toString() === '%PDF-') return readPdf(file,month);
  if (/\.xlsx$/i.test(filename)) {
    await validateXlsx(file);
    const workbook = new (require('exceljs').Workbook)();
    try { await workbook.xlsx.load(file); }
    catch (_) { throw fail('The XLSX workbook could not be read.'); }
    if (workbook.worksheets.length !== 1) throw fail('Use a workbook with a single statement worksheet.');
    const rows = [];
    workbook.worksheets[0].eachRow(row => rows.push(row.values.slice(1).map(cell => {
      if (cell && typeof cell === 'object' && !(cell instanceof Date)) return cell.result ?? cell.text ?? cell.richText?.map(run=>run.text).join('') ?? '';
      return cell;
    })));
    return parseTable(rows);
  }
  throw fail('Supported statement files are PDF, CSV and Excel (.xlsx).');
}

async function parseStatement(filename,file,month) {
  if (!Buffer.isBuffer(file) || !file.length || file.length>MAX_FILE) throw fail('Choose a statement file up to 5 MB.');
  if (/\.(pdf|xlsx)$/i.test(filename)) return parseDocument(filename,file,month);
  return readStatement(filename,file,month);
}

if (!isMainThread && workerData?.filename) {
  readStatement(workerData.filename,Buffer.from(workerData.file),workerData.month)
    .then(rows=>parentPort.postMessage({rows}),error=>parentPort.postMessage({
      error:error.statusCode?error.message:'The document could not be read.',
      statusCode:error.statusCode || 400
    }));
}

function reviewData(input, transaction) {
  const category = text(input.category,40);
  const rule = Object.hasOwn(CATEGORIES,category) ? CATEGORIES[category] : null;
  if (category && (!rule || (rule.direction && Math.sign(transaction.amountSen) !== rule.direction))) {
    throw fail('Choose a category that matches the direction of the transaction.');
  }
  if (input.items !== undefined && (!Array.isArray(input.items) || input.items.length > 30)) throw fail('Use up to 30 line items.');
  const items = (input.items || []).map(item => {
    const name = text(item?.name,160);
    const itemCategory = text(item?.category,100);
    const quantity = Number(item?.quantity);
    const unitPriceSen = cents(item?.unitPrice);
    if (!name || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000 || Math.abs(quantity*1000-Math.round(quantity*1000)) > 0.00001 || unitPriceSen < 0) {
      throw fail('Each item needs a name, positive quantity with up to three decimal places, and a non-negative unit price.');
    }
    const lineSen = Math.round(quantity * unitPriceSen);
    if (!Number.isSafeInteger(lineSen) || lineSen > MAX_AMOUNT) throw fail('Item total is outside the supported range.');
    return {name,itemCategory,quantity,unitPriceSen,lineSen};
  });
  const itemsTotalSen = items.reduce((sum,line) => sum+line.lineSen,0);
  const reconciled = input.reconciled === true;
  if (reconciled && (!rule || (items.length && itemsTotalSen !== Math.abs(transaction.amountSen)))) {
    throw fail('Select a category and make the item total match the bank amount before reconciling.');
  }
  return {category, supplier:text(input.supplier,200),notes:text(input.notes,2400),items,itemsTotalSen,reconciled};
}

function period(value) {
  const raw = text(value,10);
  if (/^\d{4}$/.test(raw)) return {from:dateOnly(raw+'-01-01'), to:dateOnly(raw+'-12-31'), key:raw};
  if (!/^\d{4}-\d{2}$/.test(raw)) throw fail('Use a month (YYYY-MM) or a year (YYYY).');
  const from = dateOnly(raw+'-01');
  const end = new Date(Date.UTC(Number(raw.slice(0,4)),Number(raw.slice(5)),0));
  return {from,to:end.toISOString().slice(0,10),key:raw};
}

function openingData(input) {
  const opening = { asOf:dateOnly(input.asOf) };
  for (const name of OPENING_FIELDS) opening[name] = cents(input[name],true) || 0;
  if (['inventory','fixedAssets','liabilities'].some(name=>opening[name]<0)) throw fail('Inventory, assets and financing opening balances cannot be negative.');
  return opening;
}

function reports(rows, range, opening = null, bankClosingSen = null) {
  const sums = Object.fromEntries(Object.keys(CATEGORIES).map(key => [key,0]));
  const flow = {Operating:0,Investing:0,Financing:0,'Internal transfers':0,'Gateway clearing':0,'Needs review':0};
  const balances = Object.fromEntries([...OPENING_FIELDS,'sales','expenses','equity','suspense'].map(key=>[key, opening?.[key] || 0]));
  balances.equity = balances.bank+balances.otherBank+balances.clearing+balances.inventory+balances.fixedAssets-balances.liabilities;
  let cashIn = 0;
  let cashOut = 0;
  let openingBankSen = balances.bank;
  let matched = 0;
  let reconciled = 0;
  const detail = [];
  for (const row of rows) {
    const {original,review,sale} = row;
    if ((opening && original.date <= opening.asOf) || original.date > range.to) continue;
    const amount = original.amountSen;
    balances.bank += amount;
    const category = review?.reconciled ? review.category : '';
    const rule = category ? CATEGORIES[category] : null;
    if (rule) {
      const sign = ['sales','expenses','equity','liabilities'].includes(rule.account) ? 1 : -1;
      balances[rule.account] += amount * sign;
    } else balances.suspense += amount;
    if (original.date < range.from) {
      openingBankSen += amount;
      continue;
    }
    if (amount > 0) cashIn += amount;
    else cashOut -= amount;
    if (sale) matched++;
    if (rule) {
      sums[category] += amount;
      reconciled++;
    }
    flow[rule?.cashFlow || 'Needs review'] += amount;
    detail.push(row);
  }
  const revenue = sums.sales+sums.refund;
  const expenses = -(sums.expense+sums.fees+sums.cogs);
  const assets = balances.bank+balances.otherBank+balances.clearing+balances.inventory+balances.fixedAssets;
  const retainedEarnings = balances.sales+balances.expenses;
  const totalEquity = balances.equity+retainedEarnings;
  return {
    range,openingAsOf:opening?.asOf || null,detail,cashIn,cashOut,flow,
    reconciliation:{ openingBankSen,closingBookSen:balances.bank,bankClosingSen,
      differenceSen:bankClosingSen === null ? null : bankClosingSen-balances.bank,
      matched,reconciled,needsReview:detail.length-reconciled },
    profit:{ revenue, expenses, net:revenue-expenses, byCategory:sums },
    balance:{...balances,assets,retainedEarnings,totalEquity, differenceSen:assets-balances.liabilities-totalEquity-balances.suspense}
  };
}

module.exports = {MAX_ROWS,MAX_FILE,CATEGORIES,OPENING_FIELDS,fail,text,fingerprintText,dateOnly,cents,parseStatement,
  csvRows,parseTable,parsePdfLines,reviewData,period,openingData,reports};

