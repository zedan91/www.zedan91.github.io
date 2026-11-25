'use strict';

const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const {
  MAX_ROWS, MAX_FILE, CATEGORIES, OPENING_FIELDS, fail, text, fingerprintText,
  parseStatement, dateOnly, reviewData, openingData, period, reports, cents
} = require('./azobss-finance-model.cjs');

const COLLECTIONS = {
  entries:'azFinanceBankEntries', duplicates:'azFinanceBankKeys', statements:'azFinanceBankStatements',
  files:'azFinanceFiles', parts:'azFinanceFileParts', settings:'azFinanceSettings',
  links:'azFinanceSaleLinks', audit:'azFinanceAudit'
};
const FILE_CHUNK = 256 * 1024;
const SALE_REFS = ['receiptNo','invoiceNo','documentNo','orderId','paymentOrderId','paymentReference','billCode','chipPurchaseId','transactionId'];
const ID = /^[a-f0-9]{64}$/;
const MAX_REPORT_ROWS = 5_000;
const maxAttachments = 20;

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function encryptionKey(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 24) throw fail('Finance encryption is not configured on Render.', 503);
  return Buffer.from(crypto.hkdfSync('sha256',secret,'AZOBSS','business-finance-storage-v1',32));
}

function codec(secret) {
  const key = encryptionKey(secret);
  function seal(bytes, context) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm',key,iv);
    cipher.setAAD(Buffer.from(context));
    const encrypted = Buffer.concat([cipher.update(bytes),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
  }
  function open(bytes, context) {
    const b = Buffer.from(bytes);
    const decipher = crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(b.subarray(12,28));
    return Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]);
  }
  return {
    id: (...parts) => crypto.createHmac('sha256',key).update(JSON.stringify(parts)).digest('hex'),
    seal, open,
    pack:(data,context) => seal(Buffer.from(JSON.stringify(data)),context),
    unpack:(data,context) => JSON.parse(open(data,context).toString('utf8'))
  };
}

function saleProjection(doc, collection) {
  const data = doc.data();
  const state = text(data.status || data.paymentStatus,60).toLowerCase();
  if (data.hiddenFromSalesReceipts || data.autoDuplicateSuperseded || data.adminTest === true ||
      data.testMode === true || /admin[- ]test/i.test(text(data.paymentVerificationSource)) ||
      !(['paid','success','completed','verified','settled','approved','confirmed'].includes(state) ||
        (!state && (data.paid === true || data.isPaid === true)))) return null;
  const value = data.verifiedAmountSen ?? data.paymentAmountSen ?? data.amountSen;
  let amountSen = Number(value);
  if (!Number.isSafeInteger(amountSen) || amountSen <= 0) {
    try { amountSen = cents(data.paidGross ?? data.gross ?? data.totalAmount ?? data.amountRm ?? data.total ?? data.saleAmount ?? data.amount ?? data.amountText); }
    catch (_) {return null;}
  }
  if (amountSen <= 0) return null;
  const references = [...new Set([doc.id,...SALE_REFS.map(key => text(data[key],180)).filter(Boolean)])];
  const method = text(data.paymentMethod || data.paymentSource || data.gateway,60);
  const identity = data.orderId || data.paymentOrderId || data.receiptNo || data.billCode || data.invoiceNo || doc.id;
  return {
    key:fingerprintText(identity), references, amountSen, method, source:collection,
    document:text(data.receiptNo || data.invoiceNo || data.documentNo || doc.id,180)
  };
}

function referencesFor(original) {
  const references = [original.reference, ...original.description.matchAll(/\bAZ[IR]-\d{8}-\d{4,}\b/gi)].map(value => text(typeof value==='string'?value:value[0],180));
  return [...new Set(references.filter(value=>/^[a-z0-9][a-z0-9_.:/-]{4,179}$/i.test(value)))];
}

async function saleCandidates(db, records) {
  const references = [...new Set(records.filter(row=>row.amountSen>0).flatMap(referencesFor))];
  if (!references.length) return [];
  const ids = [...new Set(references.flatMap(ref=>[ref,ref.toUpperCase()]))];
  const candidates = new Map();
  const tasks = [];
  // Finance uses the backend-owned order records shared with Sales & Receipts.
  // Customer-writable historical collections are not a payment authority.
  const collection = 'premiumOrders';
  for (let i=0;i<ids.length;i+=28) {
    const batch=ids.slice(i,i+28);
    for (const field of SALE_REFS) tasks.push({field,batch});
  }
  const cursor = { index:0 };
  async function worker() {
    for (;;) {
      const task = tasks[cursor.index++];
      if (!task) return;
      const {field,batch} = task;
      const snap = await db.collection(collection).where(field,'in',batch).limit(90).get();
      for (const doc of snap.docs) {
        const sale=saleProjection(doc,collection);
        if (sale) candidates.set(collection+'/'+doc.id,sale);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(tasks.length,9)},worker));
  return [...candidates.values()];
}

function exactMatch(original,candidates) {
  if (original.amountSen <= 0) return null;
  const tokens = new Set(referencesFor(original).map(fingerprintText));
  const matches = candidates.filter(sale=>sale.amountSen === original.amountSen &&
    sale.references.some(reference=>tokens.has(fingerprintText(reference))));
  if (!matches.length) return null;
  const common = new Set(matches[0].references.map(fingerprintText));
  for (const sale of matches.slice(1)) {
    const aliases = new Set(sale.references.map(fingerprintText));
    for (const ref of common) if (!aliases.has(ref)) common.delete(ref);
  }
  if (matches.length > 1 && !common.size) return null;
  const preferred = matches[0];
  if (matches.some(sale => sale.key !== preferred.key)) {
    const keys = new Set(matches.map(sale=>sale.key));
    const sameCanonical = [...keys].some(key => common.has(key));
    if (!sameCanonical) return null;
  }
  return {
    key:preferred.key, document:preferred.document, amountSen:preferred.amountSen,
    method:preferred.method, source:preferred.source
  };
}

function makeService(db, secret) {
  if (!db) throw fail('Finance database is unavailable.',503);
  const store=codec(secret);
  const collection=key=>db.collection(COLLECTIONS[key]);
  const setting=collection('settings').doc('current');
  const keyCheck=store.id('finance-key-version',1);
  function verifyKey(config) {
    if (config?.keyCheck && config.keyCheck!==keyCheck) {
      throw fail('The configured finance encryption key does not match the ledger. Restore the previous key before continuing.',503);
    }
  }
  const who=identity=>text(identity.uid || identity.email || identity.username,180);

  function event(writer, identity, type, target, details={}) {
    const ref = collection('audit').doc();
    writer.create(ref,{ms:Date.now(),data:store.pack({actor:who(identity),type,target,...details},ref.id)});
  }

  function sourceFile(writer, id, filename, format, raw) {
    const count = Math.ceil(raw.length / FILE_CHUNK);
    const metadata = { filename, format, count, size:raw.length, sha256:digest(raw) };
    writer.create(collection('files').doc(id), {data:store.pack(metadata,id)});
    for (let index=0;index<count;index++) {
      const key=id+'_'+index;
      writer.create(collection('parts').doc(key), {data:store.seal(raw.subarray(index*FILE_CHUNK,(index+1)*FILE_CHUNK),key)});
    }
    return metadata;
  }

  function unpackEntry(doc) {
    const data=doc.data();
    return {
      id:doc.id, revision:data.revision,
      original:store.unpack(data.original,doc.id+':original'),
      review:data.review ? store.unpack(data.review,doc.id+':review') : null,
      sale:data.sale ? store.unpack(data.sale,doc.id+':sale') : null,
      attachments:data.attachments ? store.unpack(data.attachments,doc.id+':attachments') : []
    };
  }

  function filesForRows(records) {
    return records.map(original=>{
      const description = original.reference || original.description || original.recipient;
      const base=store.id('bank-txn',original.date,original.amountSen,fingerprintText(description));
      return {base,original};
    });
  }

  function candidateLists(records,copies) {
    const byBase=new Map(copies.map(doc=>[doc.id,doc.exists?store.unpack(doc.data().data,doc.id):[]]));
    const used=new Map();
    return records.map(row=>{
      const available=byBase.get(row.base);
      const consumed=used.get(row.base) || new Set();
      used.set(row.base,consumed);
      const {balanceSen,time}=row.original;
      const index=available.findIndex((prior,i)=>!consumed.has(i) &&
        (balanceSen===null || prior.balanceSen===null || balanceSen===prior.balanceSen) &&
        (!time || !prior.time || time===prior.time));
      if (index !== -1) {
        consumed.add(index);
        return {...row,duplicate:true};
      }
      const id=store.id('bank-entry',row.base,available.length);
      consumed.add(available.length);
      available.push({id,balanceSen,time});
      return {...row,id,duplicate:false};
    }).map(row=>({...row,variants:byBase.get(row.base)}));
  }

  async function importStatement(raw, filename, identity, confirm=false, expectedHash='', month='') {
    const sha=digest(raw);
    const previewKey=store.id('preview',sha,month);
    if (confirm && expectedHash!==previewKey) throw fail('Preview the selected file before importing.',409);
    const rows=await parseStatement(filename,raw,month);
    const sourceId=store.id('statement',sha);
    const reference=collection('statements').doc(sourceId);
    const requested=filesForRows(rows);
    const groups=[...new Set(requested.map(row=>row.base))].map(id=>collection('duplicates').doc(id));
    if (!confirm) {
      const [statement,copies,config]=await Promise.all([reference.get(),db.getAll(...groups),setting.get()]);
      verifyKey(config.data());
      const preview=candidateLists(requested,copies);
      return {previewKey, existingFile:statement.exists, count:rows.length, rows:preview.map(row=>({...row.original,duplicate:row.duplicate}))};
    }
    if ((await reference.get()).exists) return {imported:0,duplicates:rows.length,matched:0};
    let matches=[];
    let matchingDeferred=false;
    try { matches=await saleCandidates(db,rows); }
    catch (_) { matchingDeferred=true; }
    return db.runTransaction(async tx=>{
      const [statement,copies,config]=await Promise.all([tx.get(reference),tx.getAll(...groups),tx.get(setting)]);
      verifyKey(config.data());
      if (statement.exists) return {imported:0,duplicates:rows.length,matched:0};
      const candidates=candidateLists(requested,copies).filter(row=>!row.duplicate);
      const proposed = candidates.map(row=>{
        const sale=exactMatch(row.original,matches);
        return sale ? {row,sale,lock:collection('links').doc(store.id('sale',sale.key))} : {row};
      });
      const locks = [...new Map(proposed.filter(item=>item.lock).map(item=>[item.lock.id,item.lock])).values()];
      const reserved = new Set(locks.length ? (await tx.getAll(...locks)).filter(doc=>doc.exists).map(doc=>doc.id) : []);
      const updated=new Map();
      let matched=0;
      for (const {row,sale,lock} of proposed) {
        const entry=collection('entries').doc(row.id);
        const payload = {
          date:row.original.date, revision:1, sourceId,
          original:store.pack(row.original,row.id+':original')
        };
        if (sale && !reserved.has(lock.id)) {
          reserved.add(lock.id);
          tx.create(lock,{data:store.pack({entry:row.id},lock.id)});
          payload.sale=store.pack(sale,row.id+':sale');
          payload.review=store.pack(reviewData({
            category:'sales',reconciled:Boolean(row.original.reference && (row.original.description || row.original.recipient))
          },row.original),row.id+':review');
          matched++;
        }
        tx.create(entry,payload);
        updated.set(row.base,row.variants);
      }
      for (const [id,variants] of updated) tx.set(collection('duplicates').doc(id),{data:store.pack(variants,id)});
      const file=sourceFile(tx,sourceId,filename,'statement',raw);
      tx.create(reference,{ms:Date.now(),data:store.pack({...file,imported:candidates.length,count:rows.length},sourceId)});
      const duplicateCount=rows.length-candidates.length;
      tx.set(setting,{keyCheck,lastImportMs:Date.now()},{merge:true});
      event(tx,identity,'statement-import',sourceId,{imported:candidates.length,duplicates:duplicateCount,matched,matchingDeferred});
      return {imported:candidates.length,duplicates:duplicateCount,matched,matchingDeferred};
    });
  }

  async function entry(id) {
    const doc=await collection('entries').doc(id).get();
    if (!doc.exists) throw fail('Transaction could not be found.',404);
    return unpackEntry(doc);
  }

  async function changes(id, input, identity) {
    const ref=collection('entries').doc(id);
    return db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if (!doc.exists) throw fail('Transaction could not be found.',404);
      const row=unpackEntry(doc);
      if (Number(input.revision)!==row.revision) throw fail('The transaction changed. Reload before saving.',409);
      const review=reviewData(input,row.original);
      if (row.sale && review.category!=='sales') throw fail('A linked sales receipt must use Sales income.');
      tx.update(ref,{revision:row.revision+1,review:store.pack(review,id+':review')});
      event(tx,identity,'review-update',id,{before:row.review,after:review});
      return { ...row, review, revision:row.revision+1 };
    });
  }

  async function matchSale(id, identity) {
    const ref=collection('entries').doc(id);
    const snapshot=await ref.get();
    if (!snapshot.exists) throw fail('Transaction could not be found.',404);
    const row=unpackEntry(snapshot);
    if (row.sale) return {sale:row.sale};
    const sale=exactMatch(row.original,await saleCandidates(db,[row.original]));
    if (!sale) return {sale:null};
    return db.runTransaction(async tx=>{
      const lock=collection('links').doc(store.id('sale',sale.key));
      const [doc,claim]=await tx.getAll(ref,lock);
      const current=unpackEntry(doc);
      if (current.sale) return {sale:current.sale};
      if (claim.exists) return {sale:null,alreadyLinked:true};
      if (current.review?.category && current.review.category !== 'sales') throw fail('Review the current accounting classification before linking the sale.',409);
      const review=current.review?.category ? current.review : reviewData({
        category:'sales',reconciled:Boolean(row.original.reference && (row.original.description || row.original.recipient))
      },row.original);
      tx.create(lock,{data:store.pack({entry:id},lock.id)});
      tx.update(ref,{revision:current.revision+1,sale:store.pack(sale,id+':sale'),review:store.pack(review,id+':review')});
      event(tx,identity,'sale-match',id,{sale});
      return {sale};
    });
  }

  async function addAttachment(id, file, filename, identity) {
    const signature=file.subarray(0,8);
    const type = /\.pdf$/i.test(filename) && signature.subarray(0,5).toString()==='%PDF-' ? 'application/pdf' :
      /\.jpe?g$/i.test(filename) && signature[0]===255 && signature[1]===216 && signature[2]===255 ? 'image/jpeg' :
      /\.png$/i.test(filename) && signature.equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : '';
    if (!type || !file.length || file.length>MAX_FILE) throw fail('Choose a PDF, JPG or PNG document up to 5 MB.');
    const ref=collection('entries').doc(id);
    const attachmentId=store.id('attachment',id,digest(file));
    return db.runTransaction(async tx=>{
      const doc=await tx.get(ref);
      if (!doc.exists) throw fail('Transaction could not be found.',404);
      const row=unpackEntry(doc);
      if (row.attachments.some(item=>item.id===attachmentId)) return {attachments:row.attachments,duplicate:true};
      if (row.attachments.length>=maxAttachments) throw fail('This transaction already has 20 supporting files.');
      sourceFile(tx,attachmentId,filename,type,file);
      const attachments=[...row.attachments,{id:attachmentId,filename,type,size:file.length}];
      tx.update(ref,{revision:row.revision+1,attachments:store.pack(attachments,id+':attachments')});
      event(tx,identity,'document-upload',id,{documentId:attachmentId,filename});
      return {attachments};
    });
  }

  async function download(id) {
    const doc=await collection('files').doc(id).get();
    if (!doc.exists) throw fail('Finance document could not be found.',404);
    const metadata=store.unpack(doc.data().data,id);
    const parts=await db.getAll(...Array.from({length:metadata.count},(_,index)=>collection('parts').doc(id+'_'+index)));
    const file=Buffer.concat(parts.map(part=>store.open(part.data().data,part.id)));
    if (file.length!==metadata.size || digest(file)!==metadata.sha256) throw fail('The stored document could not be verified.',503);
    return {body:file,filename:metadata.filename,type:'application/octet-stream'};
  }

  async function settings() {
    const config=(await setting.get()).data() || {};
    verifyKey(config);
    return {
      lastImportMs:config.lastImportMs || null, lastSuccessfulSync:null, autoSync:false, syncAvailable:false,
      provider:'statement-import', opening:config.opening ? store.unpack(config.opening,'opening') : null
    };
  }

  async function saveOpening(input,identity) {
    const opening=openingData(input);
    return db.runTransaction(async tx=>{
      const previous=(await tx.get(setting)).data() || {};
      verifyKey(previous);
      tx.set(setting,{keyCheck,opening:store.pack(opening,'opening')},{merge:true});
      event(tx,identity,'opening-balances','settings',{before:previous.opening?store.unpack(previous.opening,'opening'):null,after:opening});
      return {opening};
    });
  }

  async function rowsBetween(from,to,highest=MAX_REPORT_ROWS) {
    let query=collection('entries').where('date','<=',to).orderBy('date','desc');
    if (from) query=query.where('date','>=',from);
    const docs=(await query.limit(highest+1).get()).docs;
    if (docs.length>highest) throw fail('Too many records for this report. Add a recent opening balance or select a smaller period.',413);
    return docs.map(unpackEntry);
  }

  async function overview(value, cursor='') {
    const range=period(value);
    const config=await settings();
    let query=collection('entries').where('date','>=',range.from).where('date','<=',range.to).orderBy('date','desc').limit(101);
    if (cursor) {
      const last=await collection('entries').doc(cursor).get();
      if (!last.exists || last.data().date<range.from || last.data().date>range.to) throw fail('Refresh to open this page.');
      query=query.startAfter(last);
    }
    const [snapshot,sourceDocs]=await Promise.all([query.get(),collection('statements').orderBy('ms','desc').limit(10).get()]);
    return {
      range,...config, categories:CATEGORIES, rows:snapshot.docs.slice(0,100).map(unpackEntry),
      next:snapshot.docs.length>100?snapshot.docs[99].id:null,
      statements:sourceDocs.docs.map(doc=>({id:doc.id,importedAt:doc.data().ms,...store.unpack(doc.data().data,doc.id)}))
    };
  }

  async function report(value, closing) {
    const range=period(value);
    const config=await settings();
    const end=config.opening?.asOf;
    if (end && end>=range.from && end<range.to) {
      throw fail('Opening balances are inside this reporting period. Select a later period or move the opening date to the prior period end.');
    }
    const opening=end && end<range.from?config.opening:null;
    const records=await rowsBetween(opening?.asOf,range.to);
    const closingSen=cents(closing,true);
    return reports(records,range,opening,closingSen);
  }

  async function audit() {
    const result=await collection('audit').orderBy('ms','desc').limit(100).get();
    return result.docs.map(doc=>({id:doc.id,ms:doc.data().ms,...store.unpack(doc.data().data,doc.id)}));
  }

  function backupStream() {
    async function* dump() {
      yield JSON.stringify({format:'azobss-finance-encrypted-ndjson',version:1,createdAt:new Date().toISOString()})+'\n';
      for (const name of Object.values(COLLECTIONS)) {
        let last;
        for (;;) {
          let query=db.collection(name).orderBy('__name__').limit(name===COLLECTIONS.parts?16:150);
          if (last) query=query.startAfter(last);
          const list=(await query.get()).docs;
          for (const doc of list) yield JSON.stringify({collection:name,id:doc.id,data:doc.data()},(_key,value)=>{
            if (value?.type==='Buffer' && Array.isArray(value.data)) return {$bytes:Buffer.from(value.data).toString('base64')};
            return value;
          })+'\n';
          if (!list.length) break;
          last=list.at(-1);
        }
      }
      yield JSON.stringify({end:true})+'\n';
    }
    return Readable.from(dump());
  }

  return {importStatement,entry,changes,matchSale,addAttachment,download,settings,saveOpening,overview,report,audit,backupStream};
}

function assertId(value) {
  if (!ID.test(value)) throw fail('Invalid finance record identifier.');
  return value;
}

module.exports = { makeService,assertId,codec,exactMatch,saleProjection,referencesFor,COLLECTIONS };

