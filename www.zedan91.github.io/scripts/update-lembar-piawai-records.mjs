import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://ebiz.jupem.gov.my/Produk/LembarPiawai';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(rootDir, 'lembar-piawai-records.json');

const states = [
  ['1', 'JOHOR'],
  ['2', 'KEDAH'],
  ['3', 'KELANTAN'],
  ['4', 'MELAKA'],
  ['5', 'NEGERI SEMBILAN'],
  ['6', 'PAHANG'],
  ['7', 'PULAU PINANG'],
  ['8', 'PERAK'],
  ['9', 'PERLIS'],
  ['10', 'SELANGOR'],
  ['11', 'TERENGGANU'],
  ['14', 'WILAYAH PERSEKUTUAN KUALA LUMPUR'],
  ['14', 'WILAYAH PERSEKUTUAN PUTRAJAYA'],
  ['15', 'WILAYAH PERSEKUTUAN LABUAN']
];

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function requestState(stateCode) {
  const landing = await fetch(SOURCE_URL, { headers: { 'user-agent': 'AZOBSS JUPEM index updater' } });
  if (!landing.ok) throw new Error(`JUPEM landing request failed (${landing.status}).`);
  const landingHtml = await landing.text();
  const token = landingHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i)?.[1] || '';
  if (!token) throw new Error('JUPEM request verification token was not found.');

  const response = await fetch(SOURCE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'cookie': cookieHeader(landing),
      'origin': 'https://ebiz.jupem.gov.my',
      'referer': SOURCE_URL,
      'user-agent': 'AZOBSS JUPEM index updater'
    },
    body: new URLSearchParams({ __RequestVerificationToken: token, negeri: stateCode })
  });
  if (!response.ok) throw new Error(`JUPEM state ${stateCode} request failed (${response.status}).`);
  return response.text();
}

function parseRows(html, stateCode, negeri) {
  const rows = html.match(/<tr\s+class="gardex"[\s\S]*?<\/tr>/gi) || [];
  return rows.flatMap((row) => {
    const product = row.match(/GetLembarPiawaiDigital\/(\d+)\?Negeri=(\d+)&amp;type=1&amp;name=([^'"&<)]+)/i);
    if (!product) return [];
    const productId = product[1];
    const sheetName = decodeHtml(product[3]);
    const mapPath = decodeHtml(row.match(/href="([^"]*PetaInteraktif[^"]*)"/i)?.[1] || '');
    const detailPath = decodeHtml(row.match(/createModal\('([^']*SyitPiawaiDetail[^']*)'\)/i)?.[1] || '');
    return [{
      sheetName,
      productId,
      negeri,
      stateCode: String(stateCode).padStart(2, '0'),
      mapUrl: mapPath ? new URL(mapPath, SOURCE_URL).href : '',
      detailUrl: detailPath ? new URL(detailPath, SOURCE_URL).href : '',
      sourceUrl: SOURCE_URL
    }];
  });
}

const htmlCache = new Map();
const records = [];
for (const [stateCode, negeri] of states) {
  let html = htmlCache.get(stateCode);
  if (!html) {
    html = await requestState(stateCode);
    htmlCache.set(stateCode, html);
  }
  const stateRows = parseRows(html, stateCode, negeri);
  records.push(...stateRows);
  console.log(`${negeri}: ${stateRows.length.toLocaleString('en-MY')} records`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
}

records.sort((a, b) => a.negeri.localeCompare(b.negeri) || a.sheetName.localeCompare(b.sheetName, undefined, { numeric: true }));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(records), 'utf8');
console.log(`Saved ${records.length.toLocaleString('en-MY')} records to ${outputPath}`);
