import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://ebiz.jupem.gov.my/Produk/StesenGPS';
const DATA_URL = 'https://ebiz.jupem.gov.my/Produk/StesenGPSDataTable';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(rootDir, 'stesen-gps-records.json');
const states = [
  'JOHOR', 'KEDAH', 'KELANTAN', 'MELAKA', 'NEGERI SEMBILAN', 'PAHANG', 'PERAK', 'PERLIS',
  'PULAU PINANG', 'SABAH', 'SARAWAK', 'SELANGOR', 'TERENGGANU',
  'WILAYAH PERSEKUTUAN KUALA LUMPUR', 'WILAYAH PERSEKUTUAN LABUAN', 'WILAYAH PERSEKUTUAN PUTRAJAYA'
];
const aliases = new Map([
  ['W.P KUALA LUMPUR', 'WILAYAH PERSEKUTUAN KUALA LUMPUR'], ['W.P. KUALA LUMPUR', 'WILAYAH PERSEKUTUAN KUALA LUMPUR'], ['KUALA LUMPUR', 'WILAYAH PERSEKUTUAN KUALA LUMPUR'],
  ['W.P LABUAN', 'WILAYAH PERSEKUTUAN LABUAN'], ['W.P. LABUAN', 'WILAYAH PERSEKUTUAN LABUAN'], ['LABUAN', 'WILAYAH PERSEKUTUAN LABUAN'],
  ['W.P PUTRAJAYA', 'WILAYAH PERSEKUTUAN PUTRAJAYA'], ['W.P. PUTRAJAYA', 'WILAYAH PERSEKUTUAN PUTRAJAYA'], ['PUTRAJAYA', 'WILAYAH PERSEKUTUAN PUTRAJAYA']
]);
function canonicalState(value) {
  const key = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return aliases.get(key) || key;
}
function requestBody(negeri, start = 0, length = 2000) {
  const body = new URLSearchParams({
    draw: '1', start: String(start), length: String(length), negeri, carian: '',
    'search[value]': '', 'search[regex]': 'false', 'order[0][column]': '1', 'order[0][dir]': 'asc'
  });
  const columns = [
    ['IdStn', false, false], ['NoStn', true, true], ['Negeri', true, true], ['Daerah', true, true],
    ['Tempat', true, true], ['Harga', true, true], ['', false, false], ['', false, false]
  ];
  columns.forEach(([data, searchable, orderable], index) => {
    body.set(`columns[${index}][data]`, String(data)); body.set(`columns[${index}][name]`, '');
    body.set(`columns[${index}][searchable]`, String(searchable)); body.set(`columns[${index}][orderable]`, String(orderable));
    body.set(`columns[${index}][search][value]`, ''); body.set(`columns[${index}][search][regex]`, 'false');
  });
  return body;
}
async function fetchPage(negeri, start = 0, length = 2000) {
  const response = await fetch(DATA_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded', 'origin': 'https://ebiz.jupem.gov.my',
      'referer': SOURCE_URL, 'user-agent': 'Mozilla/5.0 AZOBSS JUPEM GPS index updater'
    },
    body: requestBody(negeri, start, length)
  });
  if (!response.ok) throw new Error(`JUPEM GPS request for ${negeri} failed (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error(`JUPEM GPS response for ${negeri} is invalid.`);
  return payload;
}
async function fetchState(negeri) {
  const first = await fetchPage(negeri, 0, 2000);
  const rows = first.data.slice();
  const total = Number(first.recordsFiltered ?? first.recordsTotal ?? rows.length) || rows.length;
  for (let start = rows.length; start < total; start += 2000) {
    const page = await fetchPage(negeri, start, 2000);
    rows.push(...page.data);
  }
  const wanted = canonicalState(negeri);
  return rows.filter((row) => {
    const returned = canonicalState(row.Negeri);
    return !returned || returned === wanted;
  });
}

const records = [];
const seen = new Set();
for (const negeri of states) {
  const rows = await fetchState(negeri);
  rows.forEach((row) => {
    const stationNo = String(row.NoStn || '').trim().toUpperCase();
    const productId = String(row.IdStn || '').trim();
    if (!stationNo || !productId) return;
    const canonicalNegeri = canonicalState(row.Negeri || negeri) || negeri;
    const key = `${productId}|${canonicalNegeri}|${stationNo}`;
    if (seen.has(key)) return;
    seen.add(key);
    records.push({
      stationNo, productId, objectId: String(row.IdObjek || '').trim(), negeri: canonicalNegeri,
      daerah: String(row.Daerah || '').trim(), tempat: String(row.Tempat || '').trim(),
      mapUrl: `https://ebiz.jupem.gov.my/PetaInteraktif?no=${encodeURIComponent(productId)}&type=gps&c=pt`,
      googleMapsUrl: `https://azobss-backend.onrender.com/api/stesen-gps/maps?productId=${encodeURIComponent(productId)}`,
      downloadUrl: `https://ebiz.jupem.gov.my/MuatTurunPembelian/MuatTurunStesenGPS/${encodeURIComponent(stationNo)}`,
      sourceUrl: SOURCE_URL, source: 'azobss-local'
    });
  });
  console.log(`${negeri}: ${rows.length.toLocaleString('en-MY')} records`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
}
records.sort((a, b) => a.negeri.localeCompare(b.negeri) || a.stationNo.localeCompare(b.stationNo, undefined, { numeric: true }));
await writeFile(outputPath, JSON.stringify(records), 'utf8');
console.log(`Saved ${records.length.toLocaleString('en-MY')} records to ${outputPath}`);
