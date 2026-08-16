'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const childProcess = require('child_process');
const zlib = require('zlib');

const CONVERTER_VERSION = '932.1';
const MAX_ZIP_BYTES = Math.max(8 * 1024 * 1024, Number(process.env.AZOBSS_LOT_CAD_MAX_ZIP_BYTES || 80 * 1024 * 1024) || 80 * 1024 * 1024);
const MAX_ENTRY_BYTES = Math.max(32 * 1024 * 1024, Number(process.env.AZOBSS_LOT_CAD_MAX_ENTRY_BYTES || 220 * 1024 * 1024) || 220 * 1024 * 1024);
const MAX_FEATURES = Math.max(1000, Number(process.env.AZOBSS_LOT_CAD_MAX_FEATURES || 120000) || 120000);

function safeText(value) {
  return String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    sum += Number(a[0]) * Number(b[1]) - Number(b[0]) * Number(a[1]);
  }
  return sum / 2;
}

function pointInRing(point, ring) {
  const x = Number(point[0]);
  const y = Number(point[1]);
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);
    const crosses = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function ringBounds(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring || []) {
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function polygonCentroid(ring) {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length; i < n; i += 1) {
    const p = ring[i];
    const q = ring[(i + 1) % n];
    const cross = Number(p[0]) * Number(q[1]) - Number(q[0]) * Number(p[1]);
    twiceArea += cross;
    cx += (Number(p[0]) + Number(q[0])) * cross;
    cy += (Number(p[1]) + Number(q[1])) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) {
    const b = ringBounds(ring);
    return [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

function interiorLabelPoint(ring) {
  const centroid = polygonCentroid(ring);
  if (pointInRing(centroid, ring)) return centroid;

  const b = ringBounds(ring);
  const center = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  if (pointInRing(center, ring)) return center;

  const steps = 25;
  for (let radius = 0; radius <= Math.ceil(steps / 2); radius += 1) {
    for (let iy = -radius; iy <= radius; iy += 1) {
      for (let ix = -radius; ix <= radius; ix += 1) {
        if (Math.max(Math.abs(ix), Math.abs(iy)) !== radius) continue;
        const x = center[0] + (ix / steps) * b.width;
        const y = center[1] + (iy / steps) * b.height;
        if (pointInRing([x, y], ring)) return [x, y];
      }
    }
  }

  if (ring.length) {
    const p = ring[0];
    const fallback = [(Number(p[0]) + centroid[0]) / 2, (Number(p[1]) + centroid[1]) / 2];
    if (pointInRing(fallback, ring)) return fallback;
  }
  return centroid;
}

function parseDbf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 64) throw new Error('DBF tidak sah atau terlalu kecil.');
  const recordCount = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  if (headerLength < 33 || recordLength < 2 || headerLength > buffer.length) throw new Error('Header DBF tidak sah.');

  const fields = [];
  for (let off = 32; off + 32 <= headerLength && buffer[off] !== 0x0d; off += 32) {
    const rawName = buffer.subarray(off, off + 11);
    const nul = rawName.indexOf(0);
    const name = rawName.subarray(0, nul >= 0 ? nul : rawName.length).toString('latin1').trim();
    const type = String.fromCharCode(buffer[off + 11] || 0);
    const length = buffer[off + 16] || 0;
    const decimals = buffer[off + 17] || 0;
    if (name && length > 0) fields.push({ name, type, length, decimals });
  }

  const records = [];
  const possible = Math.min(recordCount, Math.floor((buffer.length - headerLength) / recordLength));
  for (let i = 0; i < possible; i += 1) {
    const start = headerLength + i * recordLength;
    const deleted = buffer[start] === 0x2a;
    let cursor = start + 1;
    const row = {};
    for (const field of fields) {
      const raw = buffer.subarray(cursor, cursor + field.length);
      cursor += field.length;
      let value = raw.toString('latin1').replace(/\0/g, '').trim();
      if ((field.type === 'N' || field.type === 'F') && value && field.decimals === 0) value = value.replace(/\.0+$/, '');
      row[field.name] = value;
      row[field.name.toUpperCase()] = value;
    }
    records.push(deleted ? null : row);
  }
  return records;
}

function parseShp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 100) throw new Error('SHP tidak sah atau terlalu kecil.');
  if (buffer.readInt32BE(0) !== 9994) throw new Error('SHP header tidak dikenali.');

  const features = [];
  let off = 100;
  while (off + 8 <= buffer.length) {
    const contentWords = buffer.readInt32BE(off + 4);
    const contentBytes = contentWords * 2;
    const recStart = off + 8;
    const recEnd = recStart + contentBytes;
    if (contentBytes < 4 || recEnd > buffer.length) break;

    const shapeType = buffer.readInt32LE(recStart);
    if (shapeType === 0) {
      features.push({ rings: [] });
      off = recEnd;
      continue;
    }
    if (![5, 15, 25].includes(shapeType)) throw new Error(`Jenis geometri SHP ${shapeType} tidak disokong. Lot Kadaster perlu Polygon.`);

    const base = recStart + 4;
    if (base + 40 > recEnd) throw new Error('Rekod polygon SHP tidak lengkap.');
    const numParts = buffer.readInt32LE(base + 32);
    const numPoints = buffer.readInt32LE(base + 36);
    if (numParts < 1 || numPoints < 3 || numParts > 100000 || numPoints > 5000000) throw new Error('Bilangan part/point SHP tidak munasabah.');

    const partsStart = base + 40;
    const pointsStart = partsStart + numParts * 4;
    if (pointsStart + numPoints * 16 > recEnd) throw new Error('Koordinat SHP tidak lengkap.');

    const parts = [];
    for (let p = 0; p < numParts; p += 1) parts.push(buffer.readInt32LE(partsStart + p * 4));
    parts.push(numPoints);

    const points = new Array(numPoints);
    for (let p = 0; p < numPoints; p += 1) {
      const po = pointsStart + p * 16;
      points[p] = [buffer.readDoubleLE(po), buffer.readDoubleLE(po + 8)];
    }

    const rings = [];
    for (let p = 0; p < numParts; p += 1) {
      const start = parts[p];
      const end = parts[p + 1];
      if (start < 0 || end > points.length || end - start < 3) continue;
      const ring = points.slice(start, end);
      if (ring.length > 1) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12) ring.pop();
      }
      if (ring.length >= 3) rings.push(ring);
    }
    features.push({ rings });
    if (features.length > MAX_FEATURES) throw new Error(`Terlalu banyak lot untuk conversion (${features.length}).`);
    off = recEnd;
  }
  return features;
}

function coordKey(value) {
  const n = Math.round(Number(value) * 100000) / 100000;
  return Object.is(n, -0) ? '0' : n.toFixed(5);
}

function segmentKey(a, b) {
  const p1 = `${coordKey(a[0])},${coordKey(a[1])}`;
  const p2 = `${coordKey(b[0])},${coordKey(b[1])}`;
  return p1 <= p2 ? `${p1}|${p2}` : `${p2}|${p1}`;
}

function dxfPair(code, value) { return `${String(code).padStart(3, ' ')}\n${value}\n`; }
function dxfNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(8)).toString();
}
function dxfLayer(name, color) {
  return dxfPair(0, 'LAYER') + dxfPair(2, name) + dxfPair(70, 0) + dxfPair(62, color) + dxfPair(6, 'CONTINUOUS');
}
function dxfLine(layer, a, b) {
  return dxfPair(0, 'LINE') + dxfPair(8, layer) +
    dxfPair(10, dxfNumber(a[0])) + dxfPair(20, dxfNumber(a[1])) + dxfPair(30, 0) +
    dxfPair(11, dxfNumber(b[0])) + dxfPair(21, dxfNumber(b[1])) + dxfPair(31, 0);
}
function dxfText(layer, text, x, y, height) {
  const clean = safeText(text).replace(/[^\x20-\x7E]/g, '?');
  return dxfPair(0, 'TEXT') + dxfPair(8, layer) +
    dxfPair(10, dxfNumber(x)) + dxfPair(20, dxfNumber(y)) + dxfPair(30, 0) +
    dxfPair(40, dxfNumber(height)) + dxfPair(1, clean) + dxfPair(7, 'STANDARD') +
    dxfPair(72, 1) + dxfPair(73, 2) +
    dxfPair(11, dxfNumber(x)) + dxfPair(21, dxfNumber(y)) + dxfPair(31, 0);
}

function buildDxf(features, records, options = {}) {
  const areas = [];
  const prepared = [];
  const segmentMap = new Map();

  for (let i = 0; i < features.length; i += 1) {
    const feature = features[i] || { rings: [] };
    const record = records[i] || {};
    const rings = (feature.rings || []).filter(r => Array.isArray(r) && r.length >= 3);
    if (!rings.length) continue;

    let labelRing = rings[0];
    let maxArea = Math.abs(ringArea(labelRing));
    for (const ring of rings.slice(1)) {
      const a = Math.abs(ringArea(ring));
      if (a > maxArea) { maxArea = a; labelRing = ring; }
    }
    if (maxArea > 0) areas.push(maxArea);

    for (const ring of rings) {
      for (let p = 0; p < ring.length; p += 1) {
        const a = ring[p];
        const b = ring[(p + 1) % ring.length];
        if (!Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) continue;
        if (Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10) continue;
        const key = segmentKey(a, b);
        if (!segmentMap.has(key)) segmentMap.set(key, [a, b]);
      }
    }
    prepared.push({ labelRing, record, area: maxArea });
  }

  const medianArea = median(areas);
  const configuredHeight = Number(options.textHeight || process.env.AZOBSS_LOT_CAD_TEXT_HEIGHT || 0);
  const textHeight = configuredHeight > 0 ? configuredHeight : Math.max(0.65, Math.min(2.8, Math.sqrt(Math.max(1, medianArea)) * 0.12));

  let entities = '';
  for (const pair of segmentMap.values()) entities += dxfLine('PER NDCDB', pair[0], pair[1]);

  let lotTextCount = 0;
  let paTextCount = 0;
  let missingPaCount = 0;
  let minOffset = Infinity;
  let maxOffset = 0;

  for (const item of prepared) {
    const record = item.record || {};
    const lot = safeText(record.LOT || record.NOLOT || record.NO_LOT || record.LOT_NO || record.LOTNO || record.UPI || '');
    let pa = safeText(record.PA || record.NOPA || record.NO_PA || record.PA_NO || record.PANO || '');
    if (pa && !/^PA/i.test(pa) && /^\d+$/.test(pa)) pa = `PA${pa}`;
    if (!pa) missingPaCount += 1;

    const point = interiorLabelPoint(item.labelRing);
    const b = ringBounds(item.labelRing);
    const localMin = Math.max(0, Math.min(Math.abs(b.width), Math.abs(b.height)));
    const offset = Math.max(0.10, Math.min(textHeight * 0.82, localMin > 0 ? localMin * 0.16 : textHeight * 0.82));
    minOffset = Math.min(minOffset, offset);
    maxOffset = Math.max(maxOffset, offset);

    if (lot) {
      entities += dxfText('NOLOT', lot, point[0], point[1] + offset, textHeight);
      lotTextCount += 1;
    }
    if (pa) {
      entities += dxfText('NOPA', pa, point[0], point[1] - offset, textHeight);
      paTextCount += 1;
    }
  }

  let dxf = '';
  dxf += dxfPair(0, 'SECTION') + dxfPair(2, 'HEADER');
  dxf += dxfPair(9, '$ACADVER') + dxfPair(1, 'AC1009');
  dxf += dxfPair(9, '$TEXTSIZE') + dxfPair(40, dxfNumber(textHeight));
  dxf += dxfPair(0, 'ENDSEC');
  dxf += dxfPair(0, 'SECTION') + dxfPair(2, 'TABLES');
  dxf += dxfPair(0, 'TABLE') + dxfPair(2, 'LTYPE') + dxfPair(70, 1);
  dxf += dxfPair(0, 'LTYPE') + dxfPair(2, 'CONTINUOUS') + dxfPair(70, 0) + dxfPair(3, 'Solid line') + dxfPair(72, 65) + dxfPair(73, 0) + dxfPair(40, 0);
  dxf += dxfPair(0, 'ENDTAB');
  dxf += dxfPair(0, 'TABLE') + dxfPair(2, 'LAYER') + dxfPair(70, 4);
  dxf += dxfLayer('0', 7);
  dxf += dxfLayer('PER NDCDB', 7);
  dxf += dxfLayer('NOLOT', 7);
  dxf += dxfLayer('NOPA', 2);
  dxf += dxfPair(0, 'ENDTAB');
  dxf += dxfPair(0, 'TABLE') + dxfPair(2, 'STYLE') + dxfPair(70, 1);
  dxf += dxfPair(0, 'STYLE') + dxfPair(2, 'STANDARD') + dxfPair(70, 0) + dxfPair(40, 0) + dxfPair(41, 1) + dxfPair(50, 0) + dxfPair(71, 0) + dxfPair(42, 2.5) + dxfPair(3, 'txt') + dxfPair(4, '');
  dxf += dxfPair(0, 'ENDTAB');
  dxf += dxfPair(0, 'ENDSEC');
  dxf += dxfPair(0, 'SECTION') + dxfPair(2, 'ENTITIES') + entities + dxfPair(0, 'ENDSEC') + dxfPair(0, 'EOF');

  return {
    buffer: Buffer.from(dxf, 'latin1'),
    report: {
      converterVersion: CONVERTER_VERSION,
      sourceRecords: features.length,
      lineEntities: segmentMap.size,
      noLotTextCount: lotTextCount,
      noPaTextCount: paTextCount,
      paMissingCount: missingPaCount,
      textHeight,
      paPosition: 'below LOT for every lot',
      geometry: 'LINE only; no LWPOLYLINE/POLYLINE generated',
      layerColors: { 'PER NDCDB': 'white', NOLOT: 'white', NOPA: 'yellow' },
      labelOffsetRangeM: [Number.isFinite(minOffset) ? minOffset : 0, maxOffset]
    }
  };
}

function commandExists(command) {
  try {
    childProcess.execFileSync('sh', ['-lc', `command -v ${JSON.stringify(command)} >/dev/null 2>&1`], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch (_) { return false; }
}

function findDxf2Dwg(root) {
  const candidates = [
    process.env.AZOBSS_DXF2DWG_PATH,
    root && path.join(root, '.azobss-libredwg', 'bin', 'dxf2dwg'),
    '/usr/local/bin/dxf2dwg',
    '/usr/bin/dxf2dwg'
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate; } catch (_) {}
  }
  if (commandExists('dxf2dwg')) return 'dxf2dwg';
  return '';
}

function makeTempPath(tempDir, ext) {
  const resolvedDir = path.resolve(String(tempDir || os.tmpdir()));
  fs.mkdirSync(resolvedDir, { recursive: true });
  return path.join(resolvedDir, `azobss-lot-cad-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
}

function parseZipDirectory(zipBuffer) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) throw new Error('ZIP Lot Kadaster tidak sah.');
  const min = Math.max(0, zipBuffer.length - 65557);
  let eocd = -1;
  for (let off = zipBuffer.length - 22; off >= min; off -= 1) {
    if (zipBuffer.readUInt32LE(off) === 0x06054b50) { eocd = off; break; }
  }
  if (eocd < 0) throw new Error('Central directory ZIP tidak ditemui.');

  const totalEntries = zipBuffer.readUInt16LE(eocd + 10);
  const centralSize = zipBuffer.readUInt32LE(eocd + 12);
  const centralOffset = zipBuffer.readUInt32LE(eocd + 16);
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 belum disokong untuk conversion Lot Kadaster.');
  }
  if (centralOffset + centralSize > zipBuffer.length) throw new Error('Central directory ZIP tidak lengkap.');

  const entries = [];
  let off = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (off + 46 > zipBuffer.length || zipBuffer.readUInt32LE(off) !== 0x02014b50) throw new Error('Rekod central directory ZIP tidak sah.');
    const flags = zipBuffer.readUInt16LE(off + 8);
    const method = zipBuffer.readUInt16LE(off + 10);
    let compressedSize = zipBuffer.readUInt32LE(off + 20);
    let uncompressedSize = zipBuffer.readUInt32LE(off + 24);
    const nameLength = zipBuffer.readUInt16LE(off + 28);
    const extraLength = zipBuffer.readUInt16LE(off + 30);
    const commentLength = zipBuffer.readUInt16LE(off + 32);
    let localOffset = zipBuffer.readUInt32LE(off + 42);
    const end = off + 46 + nameLength + extraLength + commentLength;
    if (end > zipBuffer.length) throw new Error('Nama/extra ZIP tidak lengkap.');
    const nameBytes = zipBuffer.subarray(off + 46, off + 46 + nameLength);
    const name = nameBytes.toString((flags & 0x800) ? 'utf8' : 'latin1').replace(/\\/g, '/');

    // JUPEM ZIPs may use ZIP64 extra fields even when the complete archive is small.
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      const extraStart = off + 46 + nameLength;
      const extraEnd = extraStart + extraLength;
      let ex = extraStart;
      let zip64 = null;
      while (ex + 4 <= extraEnd) {
        const headerId = zipBuffer.readUInt16LE(ex);
        const dataSize = zipBuffer.readUInt16LE(ex + 2);
        const dataStart = ex + 4;
        const dataEnd = dataStart + dataSize;
        if (dataEnd > extraEnd) break;
        if (headerId === 0x0001) { zip64 = zipBuffer.subarray(dataStart, dataEnd); break; }
        ex = dataEnd;
      }
      if (!zip64) throw new Error(`ZIP64 metadata tidak lengkap untuk ${path.basename(name)}.`);
      let zo = 0;
      const read64 = () => {
        if (zo + 8 > zip64.length) throw new Error(`ZIP64 metadata tidak lengkap untuk ${path.basename(name)}.`);
        const value = Number(zip64.readBigUInt64LE(zo));
        zo += 8;
        if (!Number.isSafeInteger(value)) throw new Error(`ZIP64 value terlalu besar untuk ${path.basename(name)}.`);
        return value;
      };
      if (uncompressedSize === 0xffffffff) uncompressedSize = read64();
      if (compressedSize === 0xffffffff) compressedSize = read64();
      if (localOffset === 0xffffffff) localOffset = read64();
    }
    entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
    off = end;
  }
  return entries;
}

function readZipEntry(zipBuffer, entry) {
  if (!entry || !Number.isFinite(entry.localOffset)) throw new Error('Entry ZIP tidak sah.');
  if (entry.flags & 0x1) throw new Error(`Fail ${path.basename(entry.name)} dalam ZIP terenkripsi dan tidak boleh diproses.`);
  if (entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`${path.basename(entry.name)} terlalu besar untuk conversion.`);
  const off = entry.localOffset;
  if (off + 30 > zipBuffer.length || zipBuffer.readUInt32LE(off) !== 0x04034b50) throw new Error('Local header ZIP tidak sah.');
  const nameLength = zipBuffer.readUInt16LE(off + 26);
  const extraLength = zipBuffer.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > zipBuffer.length) throw new Error(`Data ${path.basename(entry.name)} dalam ZIP tidak lengkap.`);
  const packed = zipBuffer.subarray(dataStart, dataEnd);
  let output;
  if (entry.method === 0) output = Buffer.from(packed);
  else if (entry.method === 8) output = zlib.inflateRawSync(packed, { maxOutputLength: MAX_ENTRY_BYTES });
  else throw new Error(`Kaedah compression ZIP ${entry.method} tidak disokong.`);
  if (output.length > MAX_ENTRY_BYTES) throw new Error(`${path.basename(entry.name)} terlalu besar untuk conversion.`);
  return output;
}

function chooseShapefileEntries(entries) {
  const shpEntries = entries.filter(entry => /\.shp$/i.test(entry.name) && !/__MACOSX/i.test(entry.name));
  if (!shpEntries.length) throw new Error('Fail .SHP tidak ditemui dalam ZIP Lot Kadaster.');
  shpEntries.sort((a, b) => {
    const aScore = /(^|\/)NDCDB\.shp$/i.test(a.name) ? 0 : (/NDCDB/i.test(a.name) ? 1 : 2);
    const bScore = /(^|\/)NDCDB\.shp$/i.test(b.name) ? 0 : (/NDCDB/i.test(b.name) ? 1 : 2);
    return aScore - bScore || a.name.localeCompare(b.name);
  });
  const shp = shpEntries[0];
  const base = shp.name.replace(/\.shp$/i, '');
  const dbf = entries.find(entry => entry.name.toLowerCase() === `${base}.dbf`.toLowerCase()) ||
    entries.find(entry => /\.dbf$/i.test(entry.name) && path.basename(entry.name, path.extname(entry.name)).toLowerCase() === path.basename(base).toLowerCase());
  if (!dbf) throw new Error('Fail .DBF pasangan tidak ditemui dalam ZIP Lot Kadaster.');
  return { shp, dbf };
}

function parseLotZip(zipBuffer, tempDir) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4b) throw new Error('ZIP Lot Kadaster tidak sah.');
  if (zipBuffer.length > MAX_ZIP_BYTES) throw new Error(`ZIP Lot Kadaster terlalu besar untuk conversion (${Math.ceil(zipBuffer.length / 1024 / 1024)} MB).`);

  const entries = parseZipDirectory(zipBuffer);
  const chosen = chooseShapefileEntries(entries);
  const shpBuffer = readZipEntry(zipBuffer, chosen.shp);
  const dbfBuffer = readZipEntry(zipBuffer, chosen.dbf);
  const features = parseShp(shpBuffer);
  const records = parseDbf(dbfBuffer);
  if (!features.length) throw new Error('Tiada polygon lot ditemui dalam SHP.');
  return { features, records, entries: { shp: chosen.shp.name, dbf: chosen.dbf.name } };
}

function convertDxfToDwg(dxfBuffer, options = {}) {
  const root = options.root || process.cwd();
  const tempDir = options.tempDir || path.join(os.tmpdir(), 'azobss-lot-cad');
  const executable = findDxf2Dwg(root);
  if (!executable) {
    const error = new Error('DWG converter belum tersedia pada Render. Deploy semula selepas scripts/install-libredwg.sh berjaya dijalankan. DXF masih boleh dimuat turun.');
    error.code = 'DWG_CONVERTER_UNAVAILABLE';
    throw error;
  }

  const dxfPath = makeTempPath(tempDir, '.dxf');
  const dwgPath = makeTempPath(tempDir, '.dwg');
  try {
    fs.writeFileSync(dxfPath, dxfBuffer);
    const result = childProcess.spawnSync(executable, ['-v0', '-y', '--as', 'r2000', '-o', dwgPath, dxfPath], {
      cwd: tempDir,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
      env: Object.assign({}, process.env, { LC_ALL: 'C' })
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || !fs.existsSync(dwgPath)) {
      const detail = String(result.stderr || result.stdout || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      throw new Error('Conversion DXF ke DWG gagal' + (detail ? `: ${detail}` : '.'));
    }
    const buffer = fs.readFileSync(dwgPath);
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (buffer.length < 128 || !/^AC10\d\d$/.test(signature)) throw new Error('DWG yang dijana tidak mempunyai signature AutoCAD yang sah.');
    return { buffer, executable, signature };
  } finally {
    try { if (fs.existsSync(dxfPath)) fs.unlinkSync(dxfPath); } catch (_) {}
    try { if (fs.existsSync(dwgPath)) fs.unlinkSync(dwgPath); } catch (_) {}
  }
}

function convertLotZip(zipBuffer, format, options = {}) {
  const normalized = String(format || 'dxf').trim().toLowerCase();
  if (!['dxf', 'dwg'].includes(normalized)) throw new Error('Format CAD tidak disokong.');
  const tempDir = options.tempDir || path.join(os.tmpdir(), 'azobss-lot-cad');
  const parsed = parseLotZip(zipBuffer, tempDir);
  const dxf = buildDxf(parsed.features, parsed.records, options);
  if (normalized === 'dxf') return { format: 'dxf', buffer: dxf.buffer, report: dxf.report };
  const dwg = convertDxfToDwg(dxf.buffer, options);
  return { format: 'dwg', buffer: dwg.buffer, report: Object.assign({}, dxf.report, { dwgSignature: dwg.signature }) };
}

function dwgAvailable(root) { return !!findDxf2Dwg(root || process.cwd()); }

module.exports = { CONVERTER_VERSION, convertLotZip, buildDxf, parseShp, parseDbf, dwgAvailable, findDxf2Dwg };
