/* AZOBSS PATCH 764: Left-aligned item descriptions in invoice/receipt PDF */
(function(global){
  'use strict';

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 42;
  const CONTENT_W = PAGE_W - (MARGIN_X * 2);
  const BOTTOM_LIMIT = 758;
  const LOGO_JPEG_BASE64 = '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';
  const LOGO_PIXEL_W = 128;
  const LOGO_PIXEL_H = 128;

  function clean(value){ return String(value == null ? '' : value).trim(); }
  function ascii(value){
    return clean(value)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/×/g, 'x')
      .replace(/•/g, '-')
      .replace(/…/g, '...')
      .replace(/\u00a0/g, ' ')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '?');
  }
  function pdfEscape(value){ return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function number(value){ const parsed = Number(value || 0); return Number.isFinite(parsed) ? parsed : 0; }
  function money(value){ return `RM${number(value).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }
  function formatQty(value){ const n=number(value); return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/,'').replace(/\.$/,''); }
  function formatDateTime(ms){
    const date = new Date(Number(ms) || Date.now());
    if(Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
  }
  function parseTime(value){
    if(!value)return 0;if(typeof value==='number'&&Number.isFinite(value))return value;
    if(value&&typeof value.toDate==='function'){const d=value.toDate();return d&&typeof d.getTime==='function'?d.getTime():0}
    if(typeof value==='object'){if(Number(value.seconds)>0)return Number(value.seconds)*1000;if(Number(value._seconds)>0)return Number(value._seconds)*1000}
    const parsed=Date.parse(String(value));return Number.isNaN(parsed)?0:parsed;
  }
  function malaysiaParts(ms){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
    const out={};parts.forEach(part=>{if(part.type!=='literal')out[part.type]=part.value});return out;
  }
  function legacyActualTime(primary,row){
    const raw=parseTime(primary);if(!raw)return parseTime(row.createdAtMs||row.createdAt||row.updatedAtMs||row.updatedAt)||Date.now();
    if(number(row.dateTimeVersion)>=739)return raw;
    const created=parseTime(row.createdAtMs||row.createdAt);if(!created)return raw;
    const a=malaysiaParts(raw),b=malaysiaParts(created);
    return a.hour==='12'&&a.minute==='00'&&a.second==='00'&&a.year===b.year&&a.month===b.month&&a.day===b.day?created:raw;
  }
  function documentDateTime(row,type){
    const docType=normalizeDocumentType(type);
    const primary=docType==='receipt'?(parseTime(row.paidAtMs||row.paymentPaidAtMs||row.paidAt)||parseTime(row.saleDateMs)):(parseTime(row.invoiceDateMs)||parseTime(row.saleDateMs));
    return String(row.source||'').toLowerCase()==='manual'?legacyActualTime(primary,row):(primary||Date.now());
  }
  function categoryLabel(value){
    return ({physical:'Physical','computer-it':'Computer & IT',software:'Software',service:'Service',cad:'CAD Tools',pabm:'PA/BM',mixed:'Mixed',other:'Other'})[clean(value).toLowerCase()] || 'Other';
  }
  function normalizeDocumentType(value){ return clean(value).toLowerCase()==='invoice' ? 'invoice' : 'receipt'; }
  function receiptNumber(row){
    const explicit=clean(row.receiptNo); if(explicit&&!/^AZI-/i.test(explicit)&&!/^INV-/i.test(explicit)) return explicit;
    const source=clean(row.documentNo||row.invoiceNo||explicit||'Receipt');
    if(/^AZI-/i.test(source)) return source.replace(/^AZI-/i,'AZR-');
    if(/^INV-/i.test(source)) return source.replace(/^INV-/i,'RCP-');
    return source;
  }
  function invoiceNumber(row){
    const explicit=clean(row.invoiceNo); if(explicit) return explicit;
    const source=clean(row.documentNo||row.receiptNo||'Invoice');
    if(/^AZR-/i.test(source)) return source.replace(/^AZR-/i,'AZI-');
    if(/^INV-/i.test(source)||/^AZI-/i.test(source)) return source;
    return `INV-${source}`;
  }
  function documentNumber(row,type){ return normalizeDocumentType(type)==='invoice' ? invoiceNumber(row) : receiptNumber(row); }
  function statusLabel(value){ return (clean(value) || 'pending').toUpperCase(); }
  function statusColors(value){
    const status=clean(value).toLowerCase();
    if(status==='paid') return {bg:[220,252,231],border:[34,197,94],text:[22,101,52]};
    if(status==='pending') return {bg:[254,249,195],border:[234,179,8],text:[133,77,14]};
    return {bg:[254,226,226],border:[239,68,68],text:[153,27,27]};
  }
  function rgb(r,g,b){ return `${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)}`; }
  function estimateWidth(value,size,bold){
    const textValue=ascii(value); let units=0;
    for(const ch of textValue){
      if(ch===' ') units+=0.28;
      else if(/[ilI1.,:;'|]/.test(ch)) units+=0.27;
      else if(/[mwMW@%&]/.test(ch)) units+=0.82;
      else if(/[A-Z]/.test(ch)) units+=0.62;
      else if(/[0-9]/.test(ch)) units+=0.56;
      else units+=0.52;
    }
    return units*size*(bold?1.035:1);
  }
  function wrapText(value,maxWidth,size,bold){
    const source=ascii(value)||'-'; const lines=[]; const paragraphs=source.split(/\r?\n/);
    paragraphs.forEach((paragraph,pIndex)=>{
      const words=paragraph.split(/\s+/).filter(Boolean);
      if(!words.length){ lines.push(''); return; }
      let current='';
      words.forEach(word=>{
        const candidate=current?`${current} ${word}`:word;
        if(estimateWidth(candidate,size,bold)<=maxWidth){ current=candidate; return; }
        if(current){ lines.push(current); current=''; }
        if(estimateWidth(word,size,bold)<=maxWidth){ current=word; return; }
        let chunk='';
        for(const char of word){
          const next=chunk+char;
          if(chunk && estimateWidth(next,size,bold)>maxWidth){ lines.push(chunk); chunk=char; } else chunk=next;
        }
        current=chunk;
      });
      if(current) lines.push(current);
      if(pIndex<paragraphs.length-1) lines.push('');
    });
    return lines.length?lines:['-'];
  }
  function createPage(){ return []; }
  function add(commands,command){ commands.push(command); }
  function fillRect(commands,x,yTop,width,height,color){ add(commands,`${rgb(...color)} rg ${x.toFixed(2)} ${(PAGE_H-yTop-height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`); }
  function strokeRect(commands,x,yTop,width,height,color,lineWidth){ add(commands,`${rgb(...color)} RG ${(lineWidth||1).toFixed(2)} w ${x.toFixed(2)} ${(PAGE_H-yTop-height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`); }
  function line(commands,x1,y1,x2,y2,color,lineWidth){ add(commands,`${rgb(...color)} RG ${(lineWidth||1).toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_H-y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H-y2).toFixed(2)} l S`); }
  function text(commands,value,x,yTop,options){
    const opts=options||{}; const size=opts.size||10; const font=opts.bold?'F2':'F1'; const color=opts.color||[55,65,81];
    let targetX=x; const width=estimateWidth(value,size,opts.bold);
    if(opts.align==='right') targetX=x-width; else if(opts.align==='center') targetX=x-(width/2);
    add(commands,`BT /${font} ${size.toFixed(2)} Tf ${rgb(...color)} rg 1 0 0 1 ${targetX.toFixed(2)} ${(PAGE_H-yTop).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);
  }
  function textLines(commands,lines,x,yTop,options){ const opts=options||{}; const lh=opts.lineHeight||((opts.size||10)*1.35); lines.forEach((v,i)=>text(commands,v,x,yTop+(i*lh),opts)); return yTop+(lines.length*lh); }
  function image(commands,name,x,yTop,width,height){ add(commands,`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${(PAGE_H-yTop-height).toFixed(2)} cm /${name} Do Q`); }
  function centeredBaseline(y,height,size){ return y + ((height-size)/2) + (size*0.78); }

  function documentTitle(type){ return normalizeDocumentType(type)==='invoice' ? 'INVOICE' : 'RECEIPT'; }
  function drawHeader(commands,row,continuation,type){
    const docType=normalizeDocumentType(type);
    fillRect(commands,0,0,PAGE_W,92,[238,241,245]);
    fillRect(commands,0,92,PAGE_W,4,[16,185,129]);
    image(commands,'Logo',MARGIN_X,18,31,31);
    text(commands,'AZOBSS',MARGIN_X+41,42,{size:31,bold:true,color:[55,65,81]});
    text(commands,documentTitle(docType),PAGE_W-MARGIN_X,34,{size:16,bold:true,align:'right',color:[55,65,81]});
    text(commands,continuation?`${docType==='invoice'?'Invoice':'Receipt'} continuation`:documentNumber(row,docType),PAGE_W-MARGIN_X,57,{size:9,align:'right',color:[71,85,105]});
  }
  function drawStatusBadge(commands,row,x,y){
    const colors=statusColors(row.status); const label=statusLabel(row.status); const w=Math.max(72,estimateWidth(label,8,true)+22);
    fillRect(commands,x-w,y,w,23,colors.bg); strokeRect(commands,x-w,y,w,23,colors.border,0.8);
    text(commands,label,x-(w/2),y+15,{size:8,bold:true,align:'center',color:colors.text});
  }
  function drawInfoBox(commands,row,type){
    const docType=normalizeDocumentType(type); const x=MARGIN_X,y=116,w=CONTENT_W,h=128,mid=x+(w/2);
    fillRect(commands,x,y,w,h,[248,250,252]); strokeRect(commands,x,y,w,h,[203,213,225],0.8); line(commands,mid,y+14,mid,y+h-14,[226,232,240],0.8);
    const label=[100,116,139],value=[55,65,81],left=x+16,right=mid+16;
    text(commands,docType==='invoice'?'BILL TO':'CUSTOMER',left,y+22,{size:7.5,bold:true,color:label});
    text(commands,clean(row.customerName||'Customer'),left,y+40,{size:11,bold:true,color:value});
    text(commands,'PHONE',left,y+64,{size:7.5,bold:true,color:label});
    text(commands,clean(row.customerPhone)||'-',left,y+80,{size:8.8,color:value});
    text(commands,'EMAIL',left,y+96,{size:7.5,bold:true,color:label});
    textLines(commands,wrapText(clean(row.customerEmail)||'-',(w/2)-32,7.8,false).slice(0,2),left,y+112,{size:7.8,lineHeight:9.5,color:value});
    text(commands,docType==='invoice'?'INVOICE NO.':'RECEIPT NO.',right,y+22,{size:7.5,bold:true,color:label});
    text(commands,documentNumber(row,docType),right,y+40,{size:10.2,bold:true,color:value});
    text(commands,docType==='invoice'?'ISSUE DATE':'DATE',right,y+64,{size:7.5,bold:true,color:label});
    text(commands,formatDateTime(documentDateTime(row,docType)),right,y+80,{size:9.2,bold:true,color:value});
    text(commands,docType==='invoice'?'PAYMENT TERMS':'PAYMENT METHOD',right,y+104,{size:7.5,bold:true,color:label});
    text(commands,docType==='invoice'?(clean(row.paymentTerms)||'Due upon receipt'):clean(row.paymentMethod||'-'),right,y+120,{size:9.2,bold:true,color:value});
    drawStatusBadge(commands,row,x+w-12,y-10);
  }

  const TABLE={x:MARGIN_X,widths:[28,190,78,45,78,92],headers:['NO.','DESCRIPTION','CATEGORY','QTY','UNIT PRICE','AMOUNT']};
  function tableX(index){ let x=TABLE.x; for(let i=0;i<index;i+=1)x+=TABLE.widths[i]; return x; }
  function drawTableHeader(commands,y){
    const h=30; fillRect(commands,TABLE.x,y,CONTENT_W,h,[226,232,240]); strokeRect(commands,TABLE.x,y,CONTENT_W,h,[203,213,225],0.6);
    let dx=TABLE.x; TABLE.widths.slice(0,-1).forEach(width=>{dx+=width;line(commands,dx,y,dx,y+h,[203,213,225],0.55)});
    TABLE.headers.forEach((header,index)=>{ const cellX=tableX(index),cellW=TABLE.widths[index]; text(commands,header,cellX+(cellW/2),centeredBaseline(y,h,7.3),{size:7.3,bold:true,align:'center',color:[51,65,85]}); });
    return y+h;
  }
  function normalizedItems(row){
    const items=Array.isArray(row.items)?row.items:[];
    if(items.length) return items.map(item=>({name:clean(item.name||item.product||'Item'),category:clean(item.category||'other'),qty:number(item.qty)||1,unitPrice:number(item.unitPrice||item.price),amount:(number(item.qty)||1)*number(item.unitPrice||item.price)}));
    return [{name:'Purchase',category:clean(row.category||'other'),qty:1,unitPrice:number(row.gross),amount:number(row.gross)}];
  }
  function itemRowHeight(item){ const lines=wrapText(item.name,TABLE.widths[1]-18,8.9,true); return Math.max(40,18+(lines.length*11.5)); }
  function drawCenteredLines(commands,lines,cellX,cellW,y,h,size,bold,color){
    const lineHeight=11.5; const total=(lines.length-1)*lineHeight+size; const first=y+((h-total)/2)+(size*0.78);
    textLines(commands,lines,cellX+(cellW/2),first,{size,bold,lineHeight,align:'center',color});
  }
  function drawLeftLines(commands,lines,cellX,y,h,size,bold,color){
    const lineHeight=11.5; const total=(lines.length-1)*lineHeight+size; const first=y+((h-total)/2)+(size*0.78);
    textLines(commands,lines,cellX+9,first,{size,bold,lineHeight,color});
  }
  function drawItemRow(commands,item,index,y){
    const h=itemRowHeight(item),bg=index%2===0?[255,255,255]:[248,250,252];
    fillRect(commands,TABLE.x,y,CONTENT_W,h,bg); strokeRect(commands,TABLE.x,y,CONTENT_W,h,[226,232,240],0.55);
    let dx=TABLE.x; TABLE.widths.slice(0,-1).forEach(width=>{dx+=width;line(commands,dx,y,dx,y+h,[226,232,240],0.55)});
    text(commands,String(index+1),tableX(0)+(TABLE.widths[0]/2),centeredBaseline(y,h,8.7),{size:8.7,bold:true,align:'center',color:[55,65,81]});
    drawLeftLines(commands,wrapText(item.name,TABLE.widths[1]-18,8.9,true),tableX(1),y,h,8.9,true,[55,65,81]);
    text(commands,categoryLabel(item.category),tableX(2)+(TABLE.widths[2]/2),centeredBaseline(y,h,7.8),{size:7.8,align:'center',color:[51,65,85]});
    text(commands,formatQty(item.qty),tableX(3)+(TABLE.widths[3]/2),centeredBaseline(y,h,8.8),{size:8.8,bold:true,align:'center'});
    text(commands,money(item.unitPrice),tableX(4)+TABLE.widths[4]-7,centeredBaseline(y,h,8.1),{size:8.1,align:'right'});
    text(commands,money(item.amount),tableX(5)+TABLE.widths[5]-7,centeredBaseline(y,h,8.7),{size:8.7,bold:true,align:'right',color:[4,120,87]});
    return y+h;
  }
  function totalLines(row,type){
    const docType=normalizeDocumentType(type); const lines=[['Subtotal',number(row.subtotal||row.gross)]];
    if(number(row.discount)>0) lines.push(['Discount',-number(row.discount)]);
    if(number(row.shippingCharge)>0) lines.push(['Shipping',number(row.shippingCharge)]);
    const finalLabel=docType==='invoice'?'TOTAL PAYABLE':(clean(row.status).toLowerCase()==='paid'?'TOTAL PAID':'TOTAL');
    lines.push([finalLabel,number(row.gross)]); return lines;
  }
  function drawTotals(commands,row,y,type){
    const lines=totalLines(row,type),boxW=260,boxX=PAGE_W-MARGIN_X-boxW,boxH=22+(lines.length*24);
    fillRect(commands,boxX,y,boxW,boxH,[236,253,245]); strokeRect(commands,boxX,y,boxW,boxH,[16,185,129],0.9);
    lines.forEach((entry,index)=>{
      const last=index===lines.length-1,yy=y+20+(index*24);
      if(last) line(commands,boxX+12,yy-14,boxX+boxW-12,yy-14,[110,231,183],0.9);
      text(commands,entry[0],boxX+14,yy,{size:last?10:8.5,bold:last,color:last?[6,95,70]:[51,65,85]});
      const amount=entry[1]; const display=amount<0?`- ${money(Math.abs(amount))}`:money(amount);
      text(commands,display,boxX+boxW-14,yy,{size:last?14:9.5,bold:true,align:'right',color:last?[4,120,87]:[15,23,42]});
    });
    return y+boxH;
  }
  function hasToyyibPayQr(row,type){
    return normalizeDocumentType(type)==='invoice' && clean(row.status).toLowerCase()==='pending' && clean(row.paymentUrl||row.toyyibPaymentUrl) && clean(row.toyyibQrJpegBase64);
  }
  function drawToyyibPayQr(commands,row,y,type){
    if(!hasToyyibPayQr(row,type))return y;
    const h=116,qr=88,x=MARGIN_X;
    fillRect(commands,x,y,CONTENT_W,h,[248,250,252]);strokeRect(commands,x,y,CONTENT_W,h,[148,163,184],0.8);
    image(commands,'PayQR',x+14,y+14,qr,qr);
    const tx=x+118;
    text(commands,'PAY WITH TOYYIBPAY',tx,y+27,{size:11.5,bold:true,color:[30,64,175]});
    text(commands,`Amount: ${money(row.gross)}`,tx,y+49,{size:11,bold:true,color:[4,120,87]});
    text(commands,'Scan the QR code to open the secure payment page.',tx,y+69,{size:8.4,color:[71,85,105]});
    if(clean(row.billCode||row.toyyibBillCode))text(commands,`Bill Code: ${clean(row.billCode||row.toyyibBillCode)}`,tx,y+87,{size:8.2,bold:true,color:[55,65,81]});
    text(commands,'Invoice changes to a PAID receipt automatically after verification.',tx,y+103,{size:7.5,color:[100,116,139]});
    return y+h;
  }

  function drawNotes(commands,row,y){
    const notes=clean(row.notes); if(!notes)return y;
    const lines=wrapText(notes,CONTENT_W-24,8.8,false),h=Math.max(50,32+(lines.length*12));
    fillRect(commands,MARGIN_X,y,CONTENT_W,h,[255,251,235]); strokeRect(commands,MARGIN_X,y,CONTENT_W,h,[245,158,11],0.75);
    text(commands,'NOTES',MARGIN_X+12,y+19,{size:8,bold:true,color:[146,64,14]});
    textLines(commands,lines,MARGIN_X+12,y+36,{size:8.8,lineHeight:12,color:[69,26,3]});
    return y+h;
  }
  function addFooter(commands,pageNumber,pageCount,row,type){
    const docType=normalizeDocumentType(type);
    line(commands,MARGIN_X,786,PAGE_W-MARGIN_X,786,[203,213,225],0.7);
    text(commands,'AZOBSS | www.azobss.com',MARGIN_X,805,{size:7.7,bold:true,color:[71,85,105]});
    text(commands,`Page ${pageNumber} / ${pageCount}`,PAGE_W-MARGIN_X,805,{size:7.5,align:'right',color:[71,85,105]});
    let note='';
    if(docType==='invoice') note='This invoice is a request for payment and is not proof that payment has been received.';
    else note=clean(row.status).toLowerCase()==='paid'?`Payment status: PAID. Computer-generated receipt${clean(row.invoiceNo)?` converted from invoice ${clean(row.invoiceNo)}`:''}.`:'This receipt does not confirm payment until its status is PAID.';
    text(commands,note,MARGIN_X,821,{size:7.2,color:[100,116,139]});
  }
  function buildPages(row,type){
    const docType=normalizeDocumentType(type); const pages=[]; let commands=createPage(); pages.push(commands);
    drawHeader(commands,row,false,docType); drawInfoBox(commands,row,docType); let y=drawTableHeader(commands,265);
    normalizedItems(row).forEach((item,index)=>{
      const h=itemRowHeight(item);
      if(y+h>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true,docType); y=drawTableHeader(commands,120); }
      y=drawItemRow(commands,item,index,y);
    });
    y+=16; const totalsHeight=22+(totalLines(row,docType).length*24);
    if(y+totalsHeight>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true,docType); y=120; }
    y=drawTotals(commands,row,y,docType); y+=15;
    if(hasToyyibPayQr(row,docType)){
      if(y+116>BOTTOM_LIMIT){commands=createPage();pages.push(commands);drawHeader(commands,row,true,docType);y=120}
      y=drawToyyibPayQr(commands,row,y,docType);y+=15;
    }
    if(clean(row.notes)){
      const noteHeight=Math.max(50,32+(wrapText(row.notes,CONTENT_W-24,8.8,false).length*12));
      if(y+noteHeight>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true,docType); y=120; }
      y=drawNotes(commands,row,y);
    }
    if(y+45<BOTTOM_LIMIT){
      const closing=docType==='invoice'?'Thank you. Please use the invoice number as your payment reference.':'Thank you for your purchase.';
      text(commands,closing,MARGIN_X,y+26,{size:10.5,bold:true,color:[4,120,87]});
    }
    pages.forEach((page,index)=>addFooter(page,index+1,pages.length,row,docType)); return pages;
  }
  function stringToBytes(value){ const bytes=new Uint8Array(value.length); for(let i=0;i<value.length;i+=1)bytes[i]=value.charCodeAt(i)&0xff; return bytes; }
  function concatBytes(parts){ const total=parts.reduce((sum,part)=>sum+part.length,0),output=new Uint8Array(total); let offset=0; parts.forEach(part=>{output.set(part,offset);offset+=part.length}); return output; }
  function base64ToBytes(value){
    const raw=typeof atob==='function'?atob(value):Buffer.from(value,'base64').toString('binary');
    const bytes=new Uint8Array(raw.length); for(let i=0;i<raw.length;i+=1)bytes[i]=raw.charCodeAt(i)&0xff; return bytes;
  }
  function buildBytes(row,type='receipt'){
    const pages=buildPages(row||{},type),objects=[]; objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const logoBytes=base64ToBytes(LOGO_JPEG_BASE64);
    objects[5]=concatBytes([stringToBytes(`<< /Type /XObject /Subtype /Image /Width ${LOGO_PIXEL_W} /Height ${LOGO_PIXEL_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`),logoBytes,stringToBytes('\nendstream')]);
    const qrRaw=clean(row&&row.toyyibQrJpegBase64).replace(/^data:image\/jpeg;base64,/i,'');
    const hasQr=hasToyyibPayQr(row||{},type)&&!!qrRaw;
    let pageStart=6;let xObjects='/Logo 5 0 R';
    if(hasQr){
      const qrBytes=base64ToBytes(qrRaw);
      objects[6]=concatBytes([stringToBytes(`<< /Type /XObject /Subtype /Image /Width 300 /Height 300 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${qrBytes.length} >>\nstream\n`),qrBytes,stringToBytes('\nendstream')]);
      pageStart=7;xObjects+=' /PayQR 6 0 R';
    }
    const kids=[];
    pages.forEach((commands,index)=>{
      const pageObject=pageStart+(index*2),contentObject=pageObject+1,stream=commands.join('\n')+'\n';
      kids.push(`${pageObject} 0 R`);
      objects[pageObject]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xObjects} >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
    });
    objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    const parts=[stringToBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0]; let currentOffset=parts[0].length;
    for(let index=1;index<objects.length;index+=1){
      const body=objects[index] instanceof Uint8Array?objects[index]:stringToBytes(objects[index]);
      const bytes=concatBytes([stringToBytes(`${index} 0 obj\n`),body,stringToBytes('\nendobj\n')]);
      offsets[index]=currentOffset;parts.push(bytes);currentOffset+=bytes.length;
    }
    const xrefOffset=currentOffset;let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let index=1;index<objects.length;index+=1)xref+=`${String(offsets[index]).padStart(10,'0')} 00000 n \n`;
    xref+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;parts.push(stringToBytes(xref));return concatBytes(parts);
  }
  function safeFilename(value){ return ascii(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'Document'; }
  function filename(row,type='receipt'){ const docType=normalizeDocumentType(type); const label=docType==='invoice'?'Invoice':'Receipt'; return `AZOBSS-${label}-${safeFilename(documentNumber(row,docType))}-${safeFilename(row?.customerName||'Customer').slice(0,28)}.pdf`; }
  function createBlob(row,type='receipt'){ return new Blob([buildBytes(row,type)],{type:'application/pdf'}); }
  function createFile(row,type='receipt'){ return new File([buildBytes(row,type)],filename(row,type),{type:'application/pdf',lastModified:Date.now()}); }
  function download(row,type='receipt'){
    const blob=createBlob(row,type),url=URL.createObjectURL(blob),anchor=document.createElement('a'); anchor.href=url; anchor.download=filename(row,type); document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1800); return anchor.download;
  }

  global.AZOBSSAdminSalesReceiptPDF=Object.freeze({buildBytes,createBlob,createFile,download,filename,documentNumber});
})(typeof window!=='undefined'?window:globalThis);
