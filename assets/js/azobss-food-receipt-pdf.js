(function(global){
  'use strict';

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 42;
  const CONTENT_W = PAGE_W - (MARGIN_X * 2);
  const BOTTOM_LIMIT = 760;

  function clean(value){
    return String(value == null ? '' : value).trim();
  }

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

  function pdfEscape(value){
    return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  function number(value){
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value){
    const amount = Math.round((number(value) + Number.EPSILON) * 100) / 100;
    return `RM${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`;
  }

  function orderStatusLabel(status){
    return ({
      new: 'Baharu',
      contacted: 'Dihubungi',
      confirmed: 'Disahkan',
      completed: 'Selesai',
      cancelled: 'Dibatalkan'
    })[clean(status)] || 'Baharu';
  }

  function formatDateTime(value, fallbackMs){
    let date = null;
    if(value && typeof value.toDate === 'function') date = value.toDate();
    else if(value instanceof Date) date = value;
    else if(fallbackMs) date = new Date(Number(fallbackMs));
    if(!date || Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ms-MY', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    }).format(date);
  }

  function rgb(r, g, b){
    return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
  }

  function estimateWidth(value, size, bold){
    const text = ascii(value);
    let units = 0;
    for(const ch of text){
      if(ch === ' ') units += 0.28;
      else if(/[ilI1.,:;'|]/.test(ch)) units += 0.27;
      else if(/[mwMW@%&]/.test(ch)) units += 0.82;
      else if(/[A-Z]/.test(ch)) units += 0.62;
      else if(/[0-9]/.test(ch)) units += 0.56;
      else units += 0.52;
    }
    return units * size * (bold ? 1.035 : 1);
  }

  function wrapText(value, maxWidth, size, bold){
    const source = ascii(value) || '-';
    const paragraphs = source.split(/\r?\n/);
    const lines = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if(!words.length){
        lines.push('');
        return;
      }

      let current = '';
      words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if(estimateWidth(candidate, size, bold) <= maxWidth){
          current = candidate;
          return;
        }

        if(current){
          lines.push(current);
          current = '';
        }

        if(estimateWidth(word, size, bold) <= maxWidth){
          current = word;
          return;
        }

        let chunk = '';
        for(const char of word){
          const next = chunk + char;
          if(chunk && estimateWidth(next, size, bold) > maxWidth){
            lines.push(chunk);
            chunk = char;
          }else{
            chunk = next;
          }
        }
        current = chunk;
      });

      if(current) lines.push(current);
      if(paragraphIndex < paragraphs.length - 1) lines.push('');
    });

    return lines.length ? lines : ['-'];
  }

  function createPage(){
    return [];
  }

  function add(commands, command){
    commands.push(command);
  }

  function fillRect(commands, x, yTop, width, height, color){
    add(commands, `${rgb(...color)} rg ${x.toFixed(2)} ${(PAGE_H - yTop - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`);
  }

  function strokeRect(commands, x, yTop, width, height, color, lineWidth){
    add(commands, `${rgb(...color)} RG ${(lineWidth || 1).toFixed(2)} w ${x.toFixed(2)} ${(PAGE_H - yTop - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }

  function line(commands, x1, y1, x2, y2, color, lineWidth){
    add(commands, `${rgb(...color)} RG ${(lineWidth || 1).toFixed(2)} w ${x1.toFixed(2)} ${(PAGE_H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(PAGE_H - y2).toFixed(2)} l S`);
  }

  function text(commands, value, x, yTop, options){
    const opts = options || {};
    const size = opts.size || 10;
    const font = opts.bold ? 'F2' : 'F1';
    const color = opts.color || [15, 23, 42];
    let targetX = x;
    const width = estimateWidth(value, size, opts.bold);
    if(opts.align === 'right') targetX = x - width;
    if(opts.align === 'center') targetX = x - (width / 2);
    add(commands, `BT /${font} ${size.toFixed(2)} Tf ${rgb(...color)} rg 1 0 0 1 ${targetX.toFixed(2)} ${(PAGE_H - yTop).toFixed(2)} Tm (${pdfEscape(value)}) Tj ET`);
  }

  function textLines(commands, lines, x, yTop, options){
    const opts = options || {};
    const lineHeight = opts.lineHeight || ((opts.size || 10) * 1.35);
    lines.forEach((value, index) => text(commands, value, x, yTop + (index * lineHeight), opts));
    return yTop + (lines.length * lineHeight);
  }

  function drawPageHeader(commands, continuation){
    fillRect(commands, 0, 0, PAGE_W, 92, [4, 78, 50]);
    fillRect(commands, 0, 92, PAGE_W, 4, [245, 158, 11]);
    text(commands, 'AZOBSS', MARGIN_X, 39, { size:22, bold:true, color:[255,255,255] });
    text(commands, 'RESIT TEMPAHAN MAKANAN', PAGE_W - MARGIN_X, 36, { size:15, bold:true, align:'right', color:[255,255,255] });
    text(commands, continuation ? 'Sambungan butiran tempahan' : 'Premium Brownies - Lynn', PAGE_W - MARGIN_X, 58, { size:9, align:'right', color:[209,250,229] });
  }

  function drawInfoBox(commands, order){
    const x = MARGIN_X;
    const y = 118;
    const w = CONTENT_W;
    const h = 122;
    fillRect(commands, x, y, w, h, [248, 250, 252]);
    strokeRect(commands, x, y, w, h, [203, 213, 225], 0.8);
    line(commands, x + (w / 2), y + 12, x + (w / 2), y + h - 12, [226,232,240], 0.8);

    const leftX = x + 16;
    const rightX = x + (w / 2) + 16;
    const labelColor = [100,116,139];
    const valueColor = [15,23,42];
    const orderId = clean(order.id || order.clientOrderId || '-');

    text(commands, 'NO. RESIT / REKOD', leftX, y + 23, { size:7.5, bold:true, color:labelColor });
    text(commands, orderId, leftX, y + 39, { size:9.5, bold:true, color:valueColor });
    text(commands, 'PELANGGAN', leftX, y + 62, { size:7.5, bold:true, color:labelColor });
    text(commands, clean(order.customerName || '-'), leftX, y + 78, { size:10.5, bold:true, color:valueColor });
    text(commands, 'NO. TELEFON', leftX, y + 96, { size:7.5, bold:true, color:labelColor });
    text(commands, clean(order.customerPhone || '-'), leftX, y + 112, { size:9.5, bold:true, color:valueColor });

    text(commands, 'DIREKODKAN', rightX, y + 23, { size:7.5, bold:true, color:labelColor });
    text(commands, formatDateTime(order.createdAt, order.createdAtMs), rightX, y + 39, { size:9.5, bold:true, color:valueColor });
    text(commands, 'TARIKH DIPERLUKAN', rightX, y + 62, { size:7.5, bold:true, color:labelColor });
    text(commands, clean(order.requiredDateLabel || order.requiredDate || '-'), rightX, y + 79, { size:10, bold:true, color:valueColor });

    fillRect(commands, x + w - 95, y - 9, 95, 22, [220, 252, 231]);
    strokeRect(commands, x + w - 95, y - 9, 95, 22, [34,197,94], 0.7);
    text(commands, orderStatusLabel(order.status || 'new').toUpperCase(), x + w - 47.5, y + 5, { size:8, bold:true, align:'center', color:[22,101,52] });
  }

  const TABLE = {
    x:MARGIN_X,
    widths:[30,260,45,70,85],
    headers:['NO.','TEMPAHAN','QTY','HARGA','JUMLAH']
  };

  function tableX(index){
    let value = TABLE.x;
    for(let i = 0; i < index; i += 1) value += TABLE.widths[i];
    return value;
  }

  function drawTableHeader(commands, y){
    const height = 28;
    fillRect(commands, TABLE.x, y, TABLE.widths.reduce((a,b) => a + b, 0), height, [15, 23, 42]);
    TABLE.headers.forEach((header, index) => {
      const cellX = tableX(index);
      const cellW = TABLE.widths[index];
      const align = index === 1 ? 'left' : 'center';
      text(commands, header, align === 'left' ? cellX + 9 : cellX + (cellW / 2), y + 18, {
        size:8,
        bold:true,
        align,
        color:[255,255,255]
      });
    });
    return y + height;
  }

  function itemRowHeight(item){
    const title = `${clean(item.category || 'Brownies')} - ${clean(item.product || '-')}`;
    const lines = wrapText(title, TABLE.widths[1] - 18, 9.2, true);
    return Math.max(38, 17 + (lines.length * 12));
  }

  function drawItemRow(commands, item, index, y){
    const height = itemRowHeight(item);
    const bg = index % 2 === 0 ? [255,255,255] : [248,250,252];
    fillRect(commands, TABLE.x, y, TABLE.widths.reduce((a,b) => a + b, 0), height, bg);
    strokeRect(commands, TABLE.x, y, TABLE.widths.reduce((a,b) => a + b, 0), height, [226,232,240], 0.55);

    let dividerX = TABLE.x;
    TABLE.widths.slice(0, -1).forEach(width => {
      dividerX += width;
      line(commands, dividerX, y, dividerX, y + height, [226,232,240], 0.55);
    });

    text(commands, String(index + 1), tableX(0) + (TABLE.widths[0] / 2), y + 22, { size:9, bold:true, align:'center' });

    const itemTitle = `${clean(item.category || 'Brownies')} - ${clean(item.product || '-')}`;
    const titleLines = wrapText(itemTitle, TABLE.widths[1] - 18, 9.2, true);
    textLines(commands, titleLines, tableX(1) + 9, y + 16, { size:9.2, bold:true, lineHeight:12, color:[15,23,42] });

    const qty = number(item.qty);
    const price = number(item.price);
    const subtotal = number(item.subtotal || (price * qty));
    text(commands, String(qty), tableX(2) + (TABLE.widths[2] / 2), y + 22, { size:9.5, bold:true, align:'center' });
    text(commands, money(price), tableX(3) + TABLE.widths[3] - 8, y + 22, { size:9, align:'right' });
    text(commands, money(subtotal), tableX(4) + TABLE.widths[4] - 8, y + 22, { size:9.5, bold:true, align:'right', color:[4,120,87] });

    return y + height;
  }

  function drawTotals(commands, order, y){
    const boxW = 245;
    const boxX = PAGE_W - MARGIN_X - boxW;
    const boxH = 66;
    fillRect(commands, boxX, y, boxW, boxH, [236,253,245]);
    strokeRect(commands, boxX, y, boxW, boxH, [34,197,94], 0.9);
    text(commands, 'KUANTITI', boxX + 14, y + 22, { size:8, bold:true, color:[22,101,52] });
    text(commands, String(number(order.totalBoxes)), boxX + boxW - 14, y + 22, { size:10, bold:true, align:'right', color:[15,23,42] });
    line(commands, boxX + 12, y + 32, boxX + boxW - 12, y + 32, [187,247,208], 0.8);
    text(commands, 'ANGGARAN JUMLAH', boxX + 14, y + 53, { size:9, bold:true, color:[22,101,52] });
    text(commands, money(order.totalPrice), boxX + boxW - 14, y + 53, { size:15, bold:true, align:'right', color:[4,120,87] });
    return y + boxH;
  }

  function drawNotes(commands, order, y){
    const notes = clean(order.notes || '-');
    const lines = wrapText(notes, CONTENT_W - 24, 9, false);
    const boxH = Math.max(48, 30 + (lines.length * 12));
    fillRect(commands, MARGIN_X, y, CONTENT_W, boxH, [255,251,235]);
    strokeRect(commands, MARGIN_X, y, CONTENT_W, boxH, [245,158,11], 0.75);
    text(commands, 'CATATAN', MARGIN_X + 12, y + 18, { size:8, bold:true, color:[146,64,14] });
    textLines(commands, lines, MARGIN_X + 12, y + 34, { size:9, lineHeight:12, color:[69,26,3] });
    return y + boxH;
  }

  function addPageFooter(commands, pageNumber, pageCount){
    line(commands, MARGIN_X, 786, PAGE_W - MARGIN_X, 786, [203,213,225], 0.7);
    text(commands, 'Penjual: Lynn | WhatsApp: 017-880 9488 | azobss.com/Tempahan-Makanan/', MARGIN_X, 804, { size:7.5, color:[71,85,105] });
    text(commands, `Halaman ${pageNumber} / ${pageCount}`, PAGE_W - MARGIN_X, 804, { size:7.5, align:'right', color:[71,85,105] });
    text(commands, 'Resit ini ialah rekod tempahan dan bukan bukti bayaran. Harga akhir tertakluk kepada pengesahan penjual.', MARGIN_X, 820, { size:7.2, color:[100,116,139] });
  }

  function buildPages(order){
    const pages = [];
    let commands = createPage();
    pages.push(commands);
    drawPageHeader(commands, false);
    drawInfoBox(commands, order);
    let y = drawTableHeader(commands, 262);

    const items = Array.isArray(order.items) ? order.items : [];
    const safeItems = items.length ? items : [{ category:'Brownies', product:'Tiada butiran menu', qty:number(order.totalBoxes), price:number(order.totalPrice), subtotal:number(order.totalPrice) }];

    safeItems.forEach((item, index) => {
      const rowHeight = itemRowHeight(item);
      if(y + rowHeight > BOTTOM_LIMIT){
        commands = createPage();
        pages.push(commands);
        drawPageHeader(commands, true);
        y = drawTableHeader(commands, 122);
      }
      y = drawItemRow(commands, item, index, y);
    });

    y += 15;
    if(y + 66 > BOTTOM_LIMIT){
      commands = createPage();
      pages.push(commands);
      drawPageHeader(commands, true);
      y = 122;
    }
    y = drawTotals(commands, order, y);

    y += 14;
    const noteLines = wrapText(clean(order.notes || '-'), CONTENT_W - 24, 9, false);
    const noteHeight = Math.max(48, 30 + (noteLines.length * 12));
    if(y + noteHeight + 46 > BOTTOM_LIMIT){
      commands = createPage();
      pages.push(commands);
      drawPageHeader(commands, true);
      y = 122;
    }
    y = drawNotes(commands, order, y);

    const disclaimerY = y + 18;
    text(commands, 'Terima kasih atas tempahan anda.', MARGIN_X, disclaimerY, { size:10.5, bold:true, color:[4,120,87] });
    text(commands, 'Sila tunggu pengesahan penjual untuk harga akhir dan ketersediaan.', MARGIN_X, disclaimerY + 17, { size:8.5, color:[71,85,105] });

    pages.forEach((pageCommands, index) => addPageFooter(pageCommands, index + 1, pages.length));
    return pages;
  }

  function stringToBytes(value){
    const bytes = new Uint8Array(value.length);
    for(let i = 0; i < value.length; i += 1) bytes[i] = value.charCodeAt(i) & 0xff;
    return bytes;
  }

  function concatBytes(parts){
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach(part => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  }

  function buildBytes(order){
    const normalizedOrder = order || {};
    const pages = buildPages(normalizedOrder);
    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    const kids = [];
    pages.forEach((commands, index) => {
      const pageObject = 5 + (index * 2);
      const contentObject = pageObject + 1;
      const stream = commands.join('\n') + '\n';
      kids.push(`${pageObject} 0 R`);
      objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
      objects[contentObject] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
    });
    objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

    const parts = [stringToBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
    const offsets = [0];
    let currentOffset = parts[0].length;

    for(let index = 1; index < objects.length; index += 1){
      const objectText = `${index} 0 obj\n${objects[index]}\nendobj\n`;
      offsets[index] = currentOffset;
      const objectBytes = stringToBytes(objectText);
      parts.push(objectBytes);
      currentOffset += objectBytes.length;
    }

    const xrefOffset = currentOffset;
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let index = 1; index < objects.length; index += 1){
      xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(stringToBytes(xref));
    return concatBytes(parts);
  }

  function safeFilename(value){
    return ascii(value)
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'Tempahan';
  }

  function download(order){
    const bytes = buildBytes(order);
    const blob = new Blob([bytes], { type:'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const orderId = clean(order?.id || order?.clientOrderId || 'Rekod');
    const customer = clean(order?.customerName || 'Pelanggan');
    anchor.href = url;
    anchor.download = `AZOBSS-Resit-Tempahan-${safeFilename(customer)}-${safeFilename(orderId).slice(0,24)}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return anchor.download;
  }

  global.AZOBSSFoodReceipt = Object.freeze({ buildBytes, download });
})(typeof window !== 'undefined' ? window : globalThis);
