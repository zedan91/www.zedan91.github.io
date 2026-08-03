/* AZOBSS PATCH 722: Customer Sales Receipt PDF generator (no external library) */
(function(global){
  'use strict';

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 42;
  const CONTENT_W = PAGE_W - (MARGIN_X * 2);
  const BOTTOM_LIMIT = 758;

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
    return new Intl.DateTimeFormat('en-MY',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
  }
  function categoryLabel(value){
    return ({physical:'Physical',software:'Software',service:'Service',cad:'CAD Tools',pabm:'PA/BM',mixed:'Mixed',other:'Other'})[clean(value).toLowerCase()] || 'Other';
  }
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
    const source=ascii(value)||'-'; const lines=[];
    source.split(/\r?\n/).forEach((paragraph,pIndex)=>{
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
          if(chunk && estimateWidth(next,size,bold)>maxWidth){ lines.push(chunk); chunk=char; }
          else chunk=next;
        }
        current=chunk;
      });
      if(current) lines.push(current);
      if(pIndex<source.split(/\r?\n/).length-1) lines.push('');
    });
    return lines.length?lines:['-'];
  }
  function createPage(){ return []; }
  function add(commands,command){ commands.push(command); }
  function fillRect(commands,x,yTop,width,height,color){ add(commands,`${rgb(...color)} rg ${x.toFixed(2)} ${(PAGE_H-yTop-height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`); }
  function strokeRect(commands,x,yTop,width,height,color,lineWidth){ add(commands,`${rgb(...color)} RG ${(lineWidth||1).toFixed(2)} w ${x.toFixed(2)} ${(PAGE_H-yTop-height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`); }
  function line(commands,x1,y1,x2,y2,color,lineWidth){ add(commands,`${rgb(...color)} RG ${(lineWidth||1).toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_H-y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H-y2).toFixed(2)} l S`); }
  function text(commands,value,x,yTop,options){
    const opts=options||{}; const size=opts.size||10; const font=opts.bold?'F2':'F1'; const color=opts.color||[15,23,42];
    let targetX=x; const width=estimateWidth(value,size,opts.bold);
    if(opts.align==='right') targetX=x-width; else if(opts.align==='center') targetX=x-(width/2);
    add(commands,`BT /${font} ${size.toFixed(2)} Tf ${rgb(...color)} rg 1 0 0 1 ${targetX.toFixed(2)} ${(PAGE_H-yTop).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);
  }
  function textLines(commands,lines,x,yTop,options){ const opts=options||{}; const lh=opts.lineHeight||((opts.size||10)*1.35); lines.forEach((v,i)=>text(commands,v,x,yTop+(i*lh),opts)); return yTop+(lines.length*lh); }

  function drawHeader(commands,row,continuation){
    fillRect(commands,0,0,PAGE_W,92,[8,24,45]);
    fillRect(commands,0,92,PAGE_W,4,[16,185,129]);
    text(commands,'AZOBSS',MARGIN_X,38,{size:23,bold:true,color:[255,255,255]});
    text(commands,'SALES RECEIPT',PAGE_W-MARGIN_X,34,{size:16,bold:true,align:'right',color:[255,255,255]});
    text(commands,continuation?'Receipt continuation':clean(row.receiptNo||'Receipt'),PAGE_W-MARGIN_X,57,{size:9,align:'right',color:[167,243,208]});
  }
  function drawStatusBadge(commands,row,x,y){
    const colors=statusColors(row.status); const label=statusLabel(row.status); const w=Math.max(72,estimateWidth(label,8,true)+22);
    fillRect(commands,x-w,y,w,23,colors.bg); strokeRect(commands,x-w,y,w,23,colors.border,0.8);
    text(commands,label,x-(w/2),y+15,{size:8,bold:true,align:'center',color:colors.text});
  }
  function drawInfoBox(commands,row){
    const x=MARGIN_X,y=116,w=CONTENT_W,h=128,mid=x+(w/2);
    fillRect(commands,x,y,w,h,[248,250,252]); strokeRect(commands,x,y,w,h,[203,213,225],0.8); line(commands,mid,y+14,mid,y+h-14,[226,232,240],0.8);
    const label=[100,116,139],value=[15,23,42],left=x+16,right=mid+16;
    text(commands,'CUSTOMER',left,y+22,{size:7.5,bold:true,color:label});
    text(commands,clean(row.customerName||'Customer'),left,y+40,{size:11,bold:true,color:value});
    text(commands,'PHONE / EMAIL',left,y+64,{size:7.5,bold:true,color:label});
    const contact=[clean(row.customerPhone),clean(row.customerEmail)].filter(Boolean).join(' / ')||'-';
    const contactLines=wrapText(contact,(w/2)-32,8.8,false).slice(0,2); textLines(commands,contactLines,left,y+80,{size:8.8,lineHeight:12,color:value});
    text(commands,'RECEIPT NO.',right,y+22,{size:7.5,bold:true,color:label});
    text(commands,clean(row.receiptNo||'-'),right,y+40,{size:10.2,bold:true,color:value});
    text(commands,'DATE',right,y+64,{size:7.5,bold:true,color:label});
    text(commands,formatDateTime(row.saleDateMs),right,y+80,{size:9.2,bold:true,color:value});
    text(commands,'PAYMENT METHOD',right,y+104,{size:7.5,bold:true,color:label});
    text(commands,clean(row.paymentMethod||'-'),right,y+120,{size:9.2,bold:true,color:value});
    drawStatusBadge(commands,row,x+w-12,y-10);
  }

  const TABLE={x:MARGIN_X,widths:[211,78,48,82,92],headers:['ITEM','CATEGORY','QTY','UNIT PRICE','AMOUNT']};
  function tableX(index){ let x=TABLE.x; for(let i=0;i<index;i+=1)x+=TABLE.widths[i]; return x; }
  function drawTableHeader(commands,y){
    const h=28; fillRect(commands,TABLE.x,y,CONTENT_W,h,[15,23,42]);
    TABLE.headers.forEach((header,index)=>{ const cellX=tableX(index),cellW=TABLE.widths[index]; const align=index===0?'left':'center'; text(commands,header,align==='left'?cellX+9:cellX+(cellW/2),y+18,{size:7.5,bold:true,align,color:[255,255,255]}); });
    return y+h;
  }
  function normalizedItems(row){
    const items=Array.isArray(row.items)?row.items:[];
    if(items.length) return items.map(item=>({name:clean(item.name||item.product||'Item'),category:clean(item.category||'other'),qty:number(item.qty)||1,unitPrice:number(item.unitPrice||item.price),amount:(number(item.qty)||1)*number(item.unitPrice||item.price)}));
    return [{name:'Purchase',category:clean(row.category||'other'),qty:1,unitPrice:number(row.gross),amount:number(row.gross)}];
  }
  function itemRowHeight(item){ const lines=wrapText(item.name,TABLE.widths[0]-18,9.1,true); return Math.max(38,17+(lines.length*12)); }
  function drawItemRow(commands,item,index,y){
    const h=itemRowHeight(item),bg=index%2===0?[255,255,255]:[248,250,252];
    fillRect(commands,TABLE.x,y,CONTENT_W,h,bg); strokeRect(commands,TABLE.x,y,CONTENT_W,h,[226,232,240],0.55);
    let dx=TABLE.x; TABLE.widths.slice(0,-1).forEach(width=>{dx+=width;line(commands,dx,y,dx,y+h,[226,232,240],0.55)});
    const nameLines=wrapText(item.name,TABLE.widths[0]-18,9.1,true); textLines(commands,nameLines,tableX(0)+9,y+16,{size:9.1,bold:true,lineHeight:12,color:[15,23,42]});
    text(commands,categoryLabel(item.category),tableX(1)+(TABLE.widths[1]/2),y+22,{size:8,align:'center',color:[51,65,85]});
    text(commands,formatQty(item.qty),tableX(2)+(TABLE.widths[2]/2),y+22,{size:9,bold:true,align:'center'});
    text(commands,money(item.unitPrice),tableX(3)+TABLE.widths[3]-8,y+22,{size:8.3,align:'right'});
    text(commands,money(item.amount),tableX(4)+TABLE.widths[4]-8,y+22,{size:9,bold:true,align:'right',color:[4,120,87]});
    return y+h;
  }
  function totalLines(row){
    const lines=[['Subtotal',number(row.subtotal||row.gross)]];
    if(number(row.discount)>0) lines.push(['Discount',-number(row.discount)]);
    if(number(row.shippingCharge)>0) lines.push(['Shipping',number(row.shippingCharge)]);
    lines.push(['TOTAL',number(row.gross)]);
    return lines;
  }
  function drawTotals(commands,row,y){
    const lines=totalLines(row),boxW=260,boxX=PAGE_W-MARGIN_X-boxW,boxH=22+(lines.length*24);
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
  function drawNotes(commands,row,y){
    const notes=clean(row.notes); if(!notes)return y;
    const lines=wrapText(notes,CONTENT_W-24,8.8,false),h=Math.max(50,32+(lines.length*12));
    fillRect(commands,MARGIN_X,y,CONTENT_W,h,[255,251,235]); strokeRect(commands,MARGIN_X,y,CONTENT_W,h,[245,158,11],0.75);
    text(commands,'NOTES',MARGIN_X+12,y+19,{size:8,bold:true,color:[146,64,14]});
    textLines(commands,lines,MARGIN_X+12,y+36,{size:8.8,lineHeight:12,color:[69,26,3]});
    return y+h;
  }
  function addFooter(commands,pageNumber,pageCount,row){
    line(commands,MARGIN_X,786,PAGE_W-MARGIN_X,786,[203,213,225],0.7);
    text(commands,'AZOBSS | www.azobss.com',MARGIN_X,805,{size:7.7,bold:true,color:[71,85,105]});
    text(commands,`Page ${pageNumber} / ${pageCount}`,PAGE_W-MARGIN_X,805,{size:7.5,align:'right',color:[71,85,105]});
    const note=clean(row.status).toLowerCase()==='paid'?'Payment status: PAID. This is a computer-generated receipt.':'This receipt does not confirm payment until its status is PAID.';
    text(commands,note,MARGIN_X,821,{size:7.2,color:[100,116,139]});
  }
  function buildPages(row){
    const pages=[]; let commands=createPage(); pages.push(commands); drawHeader(commands,row,false); drawInfoBox(commands,row); let y=drawTableHeader(commands,265);
    normalizedItems(row).forEach((item,index)=>{
      const h=itemRowHeight(item);
      if(y+h>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true); y=drawTableHeader(commands,120); }
      y=drawItemRow(commands,item,index,y);
    });
    y+=16; const totalsHeight=22+(totalLines(row).length*24);
    if(y+totalsHeight>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true); y=120; }
    y=drawTotals(commands,row,y); y+=15;
    if(clean(row.notes)){
      const noteHeight=Math.max(50,32+(wrapText(row.notes,CONTENT_W-24,8.8,false).length*12));
      if(y+noteHeight>BOTTOM_LIMIT){ commands=createPage(); pages.push(commands); drawHeader(commands,row,true); y=120; }
      y=drawNotes(commands,row,y);
    }
    if(y+45<BOTTOM_LIMIT){ text(commands,'Thank you for your purchase.',MARGIN_X,y+26,{size:11,bold:true,color:[4,120,87]}); }
    pages.forEach((page,index)=>addFooter(page,index+1,pages.length,row)); return pages;
  }
  function stringToBytes(value){ const bytes=new Uint8Array(value.length); for(let i=0;i<value.length;i+=1)bytes[i]=value.charCodeAt(i)&0xff; return bytes; }
  function concatBytes(parts){ const total=parts.reduce((sum,part)=>sum+part.length,0),output=new Uint8Array(total); let offset=0; parts.forEach(part=>{output.set(part,offset);offset+=part.length}); return output; }
  function buildBytes(row){
    const pages=buildPages(row||{}),objects=[]; objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids=[];
    pages.forEach((commands,index)=>{ const pageObject=5+(index*2),contentObject=pageObject+1,stream=commands.join('\n')+'\n'; kids.push(`${pageObject} 0 R`); objects[pageObject]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`; objects[contentObject]=`<< /Length ${stream.length} >>\nstream\n${stream}endstream`; });
    objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
    const parts=[stringToBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=[0]; let currentOffset=parts[0].length;
    for(let index=1;index<objects.length;index+=1){ const objectText=`${index} 0 obj\n${objects[index]}\nendobj\n`; offsets[index]=currentOffset; const bytes=stringToBytes(objectText); parts.push(bytes); currentOffset+=bytes.length; }
    const xrefOffset=currentOffset; let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let index=1;index<objects.length;index+=1)xref+=`${String(offsets[index]).padStart(10,'0')} 00000 n \n`;
    xref+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`; parts.push(stringToBytes(xref)); return concatBytes(parts);
  }
  function safeFilename(value){ return ascii(value).replace(/[^A-Za-z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'Receipt'; }
  function filename(row){ return `AZOBSS-Receipt-${safeFilename(row?.receiptNo||'Receipt')}-${safeFilename(row?.customerName||'Customer').slice(0,28)}.pdf`; }
  function createBlob(row){ return new Blob([buildBytes(row)],{type:'application/pdf'}); }
  function createFile(row){ return new File([buildBytes(row)],filename(row),{type:'application/pdf',lastModified:Date.now()}); }
  function download(row){
    const blob=createBlob(row),url=URL.createObjectURL(blob),anchor=document.createElement('a'); anchor.href=url; anchor.download=filename(row); document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),1800); return anchor.download;
  }

  global.AZOBSSAdminSalesReceiptPDF=Object.freeze({buildBytes,createBlob,createFile,download,filename});
})(typeof window!=='undefined'?window:globalThis);
