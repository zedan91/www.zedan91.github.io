(function () {
  'use strict';

  const panel = document.getElementById('businessfinance');
  if (!panel) return;
  const $ = selector => panel.querySelector(selector);
  const status = $('[data-finance-status]');
  const importForm = $('[data-finance-import]');
  const confirm = $('[data-finance-confirm]');
  const reviewForm = $('[data-finance-review]');
  const periodForm = $('[data-finance-period]');
  const reportForm = $('[data-finance-report]');
  const openingForm = $('[data-finance-opening]');
  const upload = $('[data-finance-document]');
  const dialog = $('[data-finance-dialog]');
  const dialogStatus = $('[data-finance-dialog-status]');
  const API = 'https://azobss-backend.onrender.com/api/admin/finance';
  const MYR = new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'});
  const dateTime = new Intl.DateTimeFormat('en-MY',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'});
  const monthKey = new Intl.DateTimeFormat('en-CA',{month:'2-digit',year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).formatToParts();
  const field = (form,name) => form.elements.namedItem(name);
  let preview, selected, activePeriod, cursor, categories, loadVersion = 0;
  field(periodForm,'period').value = monthKey.find(part=>part.type==='year').value+'-'+monthKey.find(part=>part.type==='month').value;

  function element(tag, label) {
    const node=document.createElement(tag);
    if (label !== undefined) node.textContent=String(label ?? '');
    return node;
  }
  function show(message, error=false, target=status) {
    target.textContent=message;
    target.dataset.error=error;
  }
  function money(sen) {
    return Number.isFinite(sen) ? MYR.format(sen/100) : '—';
  }
  function endpoint(path,params={}) {
    const query=new URLSearchParams();
    for (const [name,value] of Object.entries(params)) if (value!==undefined && value!==null && value!=='') query.set(name,String(value));
    return API+path+(query.size?'?'+query:'');
  }
  function call(path,params,options) {
    if (typeof window.azAdminFetchJson!=='function') throw Error('Admin sign-in is still loading. Try again.');
    return window.azAdminFetchJson(endpoint(path,params),options);
  }
  function postJSON(value) {
    return {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)};
  }
  function postFile(file) {
    if (file.size>5*1024*1024) throw Error('Choose a file up to 5 MB.');
    return {method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file,timeoutMs:90000};
  }
  async function doWork(button, job, target=status) {
    if (button.dataset.busy) return;
    button.dataset.busy='true';
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    show('Working…',false,target);
    try { await job(); }
    catch (error) {show(error.message,true,target);}
    finally {
      button.disabled=false;
      button.removeAttribute('aria-busy');
      delete button.dataset.busy;
    }
  }
  function rowCells(tbody, cells) {
    const row=element('tr');
    for (const value of cells) {
      const cell=element('td');
      if (value instanceof Node) cell.append(value);
      else cell.textContent=value ?? '';
      row.append(cell);
    }
    tbody.append(row);
    return row;
  }
  function details(target, fields) {
    target.replaceChildren();
    for (const [label,value] of fields) target.append(element('dt',label),element('dd',value));
  }
  function action(label,handler) {
    const button=element('button',label);
    button.className='btn gray';
    button.type='button';
    button.addEventListener('click',handler);
    return button;
  }

  async function download(button,path,params,fallback,target=status) {
    await doWork(button,async()=>{
      const file=await window.azAdminFetchBlob(endpoint(path,params),{timeoutMs:90000});
      const url=URL.createObjectURL(file.blob);
      const link=element('a');
      link.href=url;
      link.download=file.filename || fallback;
      link.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      show('Download ready.',false,target);
    },target);
  }
  function fileAction(file,target) {
    return action(file.filename,event=>download(event.currentTarget,'/files/'+file.id,{},file.filename,target));
  }

  function showPreview(result) {
    $('[data-finance-preview]').hidden=false;
    const list=$('[data-preview-rows]');
    list.replaceChildren();
    for (const row of result.rows) rowCells(list,[row.date,row.time,row.reference,row.description,money(row.amountSen),money(row.balanceSen),row.duplicate?'Already imported':'Ready to import']);
    const duplicates=result.rows.filter(row=>row.duplicate).length;
    $('[data-preview-summary]').textContent=result.count+' transactions · '+duplicates+' already imported';
    confirm.hidden=result.existingFile;
  }
  importForm.addEventListener('input',()=>{
    preview=null;
    confirm.hidden=true;
    $('[data-finance-preview]').hidden=true;
  });
  importForm.addEventListener('submit',event=>{
    event.preventDefault();
    doWork(event.submitter,async()=>{
      const file=field(importForm,'file').files[0];
      const month=field(importForm,'month').value;
      const result=await call('/statements',{filename:file.name,month},postFile(file));
      if (file!==field(importForm,'file').files[0] || month!==field(importForm,'month').value) return;
      preview={file,month,key:result.previewKey,firstDate:result.rows[0]?.date};
      showPreview(result);
      show(result.existingFile?'This exact statement is already on file.':'Check the dates and amounts, then import the statement.');
    });
  });
  confirm.addEventListener('click',()=>{
    if (!preview) return;
    const {file,month,key,firstDate}=preview;
    doWork(confirm,async()=>{
      const result=await call('/statements',{filename:file.name,month,previewKey:key,action:'commit'},postFile(file));
      preview=null;
      confirm.hidden=true;
      $('[data-finance-preview]').hidden=true;
      if (firstDate && !firstDate.startsWith(field(periodForm,'period').value)) field(periodForm,'period').value=firstDate.slice(0,7);
      await load();
      show(result.imported+' imported · '+result.duplicates+' skipped · '+result.matched+' matched'+
        (result.matchingDeferred?' · Sales matching can be retried from each transaction.':'.'));
    });
  });
  function appendRows(rows,replace) {
    const list=$('[data-finance-rows]');
    if (replace) list.replaceChildren();
    for (const row of rows) {
      const {original,review,sale}=row;
      const date=[original.date,original.time].filter(Boolean).join(' ');
      const state=element('span',review?.reconciled?'Reconciled':'Needs Review');
      state.dataset.state=review?.reconciled?'reconciled':'review';
      const tableRow=rowCells(list,[date,original.description,[original.recipient,original.reference].filter(Boolean).join(' · '),
        original.amountSen>0?money(original.amountSen):'—',original.amountSen<0?money(-original.amountSen):'—',state,
        sale?[sale.document,sale.method].filter(Boolean).join(' · '):'—',action('Review',()=>openReview(row))]);
      tableRow.cells[3].dataset.money='';
      tableRow.cells[4].dataset.money='';
    }
    if (!list.children.length) {
      const row=rowCells(list,['No bank transactions for this period.']);
      row.firstChild.colSpan=8;
    }
  }
  function showStatementList(statements) {
    const list=$('[data-finance-statements]');
    list.replaceChildren();
    for (const file of statements) {
      const item=element('li');
      item.append(fileAction(file,status),document.createTextNode(' · '+dateTime.format(file.importedAt)+' · '+file.imported+' imported'));
      list.append(item);
    }
    if (!statements.length) list.append(element('li','No statements imported yet.'));
  }
  async function load(after='') {
    const key=field(periodForm,'period').value;
    const version=++loadVersion;
    const result=await call('/overview',{period:key,after});
    if (version!==loadVersion) return;
    if (activePeriod!==key) $('[data-finance-report-result]').replaceChildren();
    activePeriod=key;
    categories=result.categories;
    cursor=result.next;
    appendRows(result.rows,!after);
    $('[data-finance-more]').hidden=!cursor;
    $('[data-finance-import-time]').textContent=result.lastImportMs?dateTime.format(result.lastImportMs):'—';
    $('[data-finance-sync-time]').textContent=result.lastSuccessfulSync?dateTime.format(result.lastSuccessfulSync):'—';
    if (result.opening && !field(openingForm,'asOf').value) {
      for (const [name,value] of Object.entries(result.opening)) field(openingForm,name).value=name==='asOf'?value:(value/100).toFixed(2);
    }
    showStatementList(result.statements);
  }

  function lineItem(item={}) {
    const tbody=$('[data-finance-items]');
    if (tbody.children.length>=30) return show('Use up to 30 items.',true,dialogStatus);
    const inputs=[
      {label:'Item name', type:'text', value:item.name || '', maxLength:160,required:true},
      {label:'Quantity', type:'number', value:item.quantity ?? 1, min:'0.001', max:'100000', step:'0.001',required:true},
      {label:'Unit price', type:'number', value:item.unitPriceSen===undefined?'':(item.unitPriceSen/100).toFixed(2), min:'0', step:'0.01',required:true},
      {label:'Item category', type:'text', value:item.itemCategory || '', maxLength:100}
    ].map(({label,...attrs})=>{
      const input=element('input');
      Object.assign(input,attrs);
      input.setAttribute('aria-label',label);
      return input;
    });
    const row=rowCells(tbody,[...inputs,action('Remove',()=>row.remove())]);
  }
  function openReview(row) {
    selected=row;
    reviewForm.reset();
    upload.reset();
    show('',false,dialogStatus);
    const {original,review,sale,attachments}=row;
    details($('[data-finance-original]'),[
      ['Date / time',[original.date,original.time].filter(Boolean).join(' ')],['Bank amount',money(original.amountSen)],
      ['Running balance',money(original.balanceSen)],['Bank reference',original.reference||'—'],['Bank recipient',original.recipient||'—'],
      ['Original description',original.description||'—'],['Sales document',sale?[sale.document,sale.method].filter(Boolean).join(' · '):'—']
    ]);
    const category=field(reviewForm,'category');
    category.replaceChildren(new Option('Needs Review',''));
    for (const [id,rule] of Object.entries(categories)) {
      if (!rule.direction || rule.direction===Math.sign(original.amountSen)) category.append(new Option(rule.label,id));
    }
    category.value=review?.category || '';
    category.disabled=Boolean(sale);
    field(reviewForm,'supplier').value=review?.supplier || '';
    field(reviewForm,'notes').value=review?.notes || '';
    field(reviewForm,'reconciled').checked=review?.reconciled===true;
    $('[data-finance-match]').hidden=Boolean(sale) || original.amountSen<0;
    $('[data-finance-items]').replaceChildren();
    for (const item of review?.items || []) lineItem(item);
    const files=$('[data-finance-files]');
    files.replaceChildren();
    for (const file of attachments) {
      const item=element('li');
      item.append(fileAction(file,dialogStatus));
      files.append(item);
    }
    if (!dialog.open) dialog.showModal();
  }
  async function reloadSelected(id) {
    const result=await call('/entries/'+id);
    await load();
    if (dialog.open && selected?.id===id) openReview(result.row);
  }
  reviewForm.addEventListener('submit',event=>{
    event.preventDefault();
    const row=selected;
    doWork(event.submitter,async()=>{
      const items=[...$('[data-finance-items]').rows].map(line=>{
        const [name,quantity,unitPrice,category]=[...line.querySelectorAll('input')].map(input=>input.value);
        return {name,quantity,unitPrice,category};
      });
      const result=await call('/entries/'+row.id+'/review',{},postJSON({
        revision:row.revision,category:field(reviewForm,'category').value,supplier:field(reviewForm,'supplier').value,
        notes:field(reviewForm,'notes').value,reconciled:field(reviewForm,'reconciled').checked,items
      }));
      await load();
      if (dialog.open && selected?.id===row.id) openReview(result.row);
      show('Review saved.',false,dialogStatus);
    },dialogStatus);
  });
  $('[data-finance-add-item]').addEventListener('click',()=>lineItem());
  $('[data-finance-close]').addEventListener('click',()=>dialog.close());
  $('[data-finance-match]').addEventListener('click',event=>{
    const row=selected;
    doWork(event.currentTarget,async()=>{
      const result=await call('/entries/'+row.id+'/match',{},postJSON({}));
      if (result.sale) await reloadSelected(row.id);
      show(result.sale?'Linked '+result.sale.document+'.':
        result.alreadyLinked?'The sales document is already linked to another bank transaction.':
          'No unique paid sales document matches the bank reference and amount.',false,dialogStatus);
    },dialogStatus);
  });
  upload.addEventListener('submit',event=>{
    event.preventDefault();
    const row=selected;
    doWork(event.submitter,async()=>{
      const file=field(upload,'file').files[0];
      const result=await call('/entries/'+row.id+'/documents',{filename:file.name},postFile(file));
      await reloadSelected(row.id);
      show(result.duplicate?'This document is already attached.':'Document attached.',false,dialogStatus);
    },dialogStatus);
  });

  function reportParams() {
    return {period:field(periodForm,'period').value,closing:field(reportForm,'closing').value};
  }
  function renderReport(result) {
    const target=$('[data-finance-report-result]');
    target.replaceChildren();
    if (!result.openingAsOf) target.append(element('p','Opening balances are missing for this period. The balance sheet is a draft.'));
    const {reconciliation:r,balance:b,profit:p}=result;
    const sections={
      'Bank reconciliation':[
        ['Opening book bank balance',money(r.openingBankSen)],['Closing book bank balance',money(r.closingBookSen)],
        ['Statement ending balance',money(r.bankClosingSen)],['Difference',money(r.differenceSen)],
        ['Matched sales',r.matched],['Reconciled',r.reconciled],['Needs review',r.needsReview]
      ],
      'Cash flow':[
        ['Money in',money(result.cashIn)],['Money out',money(result.cashOut)],['Net bank movement',money(result.cashIn-result.cashOut)],
        ...Object.entries(result.flow).map(([name,value])=>[name,money(value)])
      ],
      'Profit & loss (bank basis)':[['Sales net of refunds',money(p.revenue)],['Expenses',money(p.expenses)],['Net',money(p.net)]],
      'Balance sheet (bank-based draft)':[
        ['Bank',money(b.bank)],['Other bank accounts',money(b.otherBank)],['Gateway clearing',money(b.clearing)],['Inventory',money(b.inventory)],
        ['Fixed assets at cost',money(b.fixedAssets)],['Assets',money(b.assets)],['Financing liabilities',money(b.liabilities)],
        ['Total equity',money(b.totalEquity)],['Unclassified transactions',money(b.suspense)],['Difference',money(b.differenceSen)]
      ]
    };
    for (const [title,fields] of Object.entries(sections)) {
      const section=element('details');
      section.open=title==='Bank reconciliation';
      const listing=element('dl');
      listing.className='finance-details';
      details(listing,fields);
      section.append(element('summary',title),listing);
      target.append(section);
    }
  }
  reportForm.addEventListener('submit',event=>{
    event.preventDefault();
    doWork(event.submitter,async()=>{
      renderReport(await call('/report',reportParams(),{timeoutMs:90000}));
      show('Report calculated.');
    });
  });
  panel.querySelectorAll('[data-finance-export]').forEach(button=>button.addEventListener('click',()=>{
    const format=button.dataset.financeExport;
    download(button,'/report',{...reportParams(),format},'azobss-finance.'+format);
  }));
  openingForm.addEventListener('submit',event=>{
    event.preventDefault();
    doWork(event.submitter,async()=>{
      await call('/opening',{},postJSON(Object.fromEntries(new FormData(openingForm))));
      $('[data-finance-report-result]').replaceChildren();
      show('Opening balances saved.');
    });
  });
  $('[data-finance-audit]').addEventListener('click',event=>{
    doWork(event.currentTarget,async()=>{
      const result=await call('/audit');
      const list=$('[data-finance-audit-rows]');
      list.replaceChildren(...result.events.map(row=>element('li',[dateTime.format(row.ms),row.type,row.actor,row.filename||row.sale?.document].filter(Boolean).join(' · '))));
      if (!result.events.length) list.append(element('li','No audit events yet.'));
      show('Audit log loaded.');
    });
  });
  $('[data-finance-backup]').addEventListener('click',event=>download(event.currentTarget,'/backup',{},'azobss-finance.ndjson'));
  periodForm.addEventListener('submit',event=>{
    event.preventDefault();
    doWork(event.submitter,async()=>{await load();show('');});
  });
  $('[data-finance-more]').addEventListener('click',event=>{
    doWork(event.currentTarget,async()=>{if (cursor) await load(cursor);show('');});
  });
  document.addEventListener('click',event=>{
    const tab=event.target.closest('[data-tab="businessfinance"]');
    if (tab && !activePeriod) doWork(tab,async()=>{await load();show('');});
  });
})();

