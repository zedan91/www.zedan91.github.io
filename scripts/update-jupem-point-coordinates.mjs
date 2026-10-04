import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import * as tls from 'node:tls';
import { fileURLToPath } from 'node:url';

if (typeof tls.getCACertificates === 'function' && typeof tls.setDefaultCACertificates === 'function') {
  tls.setDefaultCACertificates([
    ...tls.getCACertificates('default'),
    ...tls.getCACertificates('system')
  ]);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkPath = resolve(rootDir, 'stesen-tanda-aras-records.json');
const gpsPath = resolve(rootDir, 'stesen-gps-records.json');
const mapPageUrl = 'https://ebiz.jupem.gov.my/PetaInteraktif?no=1&type=bm&c=pt';
const arcgisBaseUrl = 'https://ebiz.jupem.gov.my/arcgis/rest/services/Geodetik/Produk_Geodetik/MapServer';
const pointFields = 'IdStn,WGS_LatD,WGS_LatM,WGS_LatS,WGS_LonD,WGS_LonM,WGS_LonS';

function cookieHeader(headers) {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => String(value).split(';', 1)[0]).filter(Boolean).join('; ');
}

async function getMapAuth() {
  const pageResponse = await fetch(mapPageUrl, {
    redirect: 'follow',
    headers: { 'user-agent': 'AZOBSS JUPEM coordinate updater' }
  });
  if (!pageResponse.ok) throw new Error(`JUPEM map page returned HTTP ${pageResponse.status}.`);

  const cookie = cookieHeader(pageResponse.headers);
  const html = await pageResponse.text();
  const csrfMatch = html.match(/<input[^>]+name=["']__RequestVerificationToken["'][^>]+value=["']([^"']+)["']/i);
  if (!cookie || !csrfMatch) throw new Error('JUPEM map session token is unavailable.');

  const csrf = csrfMatch[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  const tokenResponse = await fetch('https://ebiz.jupem.gov.my/PetaInteraktif/GetArcGISToken', {
    method: 'POST',
    redirect: 'follow',
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      cookie,
      referer: mapPageUrl,
      'x-csrf-token': csrf,
      'x-requested-with': 'XMLHttpRequest',
      'user-agent': 'AZOBSS JUPEM coordinate updater'
    },
    body: new URLSearchParams({ __RequestVerificationToken: csrf })
  });
  if (!tokenResponse.ok) throw new Error(`JUPEM map token returned HTTP ${tokenResponse.status}.`);
  const payload = await tokenResponse.json();
  if (!payload?.success || !payload.token) throw new Error('JUPEM ArcGIS token is unavailable.');
  return { cookie, token: String(payload.token) };
}

function dmsToDecimal(degrees, minutes, seconds) {
  const d = Number(degrees);
  const m = Number(minutes);
  const s = Number(seconds);
  if (![d, m, s].every(Number.isFinite)) return NaN;
  const sign = d < 0 ? -1 : 1;
  return sign * (Math.abs(d) + (Math.abs(m) / 60) + (Math.abs(s) / 3600));
}

function pointFromFeature(feature) {
  const attributes = feature?.attributes || {};
  let latitude = dmsToDecimal(attributes.WGS_LatD, attributes.WGS_LatM, attributes.WGS_LatS);
  let longitude = dmsToDecimal(attributes.WGS_LonD, attributes.WGS_LonM, attributes.WGS_LonS);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    latitude = Number(feature?.geometry?.y);
    longitude = Number(feature?.geometry?.x);
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7))
  };
}

async function fetchLayer(layer, auth) {
  const coordinates = new Map();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${arcgisBaseUrl}/${layer}/query`);
    url.search = new URLSearchParams({
      where: 'IdStn>0',
      outFields: pointFields,
      returnGeometry: 'true',
      orderByFields: 'ESRI_OID ASC',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      f: 'json',
      token: auth.token
    }).toString();
    const response = await fetch(url, {
      headers: {
        accept: 'application/json,*/*',
        cookie: auth.cookie,
        referer: mapPageUrl,
        'user-agent': 'AZOBSS JUPEM coordinate updater'
      }
    });
    if (!response.ok) throw new Error(`JUPEM layer ${layer} returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`JUPEM layer ${layer}: ${payload.error.message || payload.error.code}.`);
    const features = Array.isArray(payload?.features) ? payload.features : [];
    for (const feature of features) {
      const id = String(feature?.attributes?.IdStn || '').trim();
      const point = pointFromFeature(feature);
      if (id && point) coordinates.set(id, point);
    }
    console.log(`Layer ${layer}: ${coordinates.size.toLocaleString('en-MY')} coordinates`);
    if (!payload?.exceededTransferLimit || features.length < pageSize) break;
  }
  return coordinates;
}

function mergeCoordinates(records, coordinateMaps, layerForRecord) {
  let updated = 0;
  let missing = 0;
  for (const record of records) {
    const layer = layerForRecord(record);
    const point = coordinateMaps.get(layer)?.get(String(record.productId || '').trim());
    if (!point) {
      delete record.latitude;
      delete record.longitude;
      missing += 1;
      continue;
    }
    record.latitude = point.latitude;
    record.longitude = point.longitude;
    updated += 1;
  }
  return { updated, missing };
}

const auth = await getMapAuth();
const coordinateMaps = new Map();
for (const layer of ['0', '1', '2']) {
  coordinateMaps.set(layer, await fetchLayer(layer, auth));
}

const benchmarkRecords = JSON.parse(await readFile(benchmarkPath, 'utf8'));
const gpsRecords = JSON.parse(await readFile(gpsPath, 'utf8'));
const benchmarkResult = mergeCoordinates(
  benchmarkRecords,
  coordinateMaps,
  (record) => String(record.jenis || '1') === '2' ? '2' : '1'
);
const gpsResult = mergeCoordinates(gpsRecords, coordinateMaps, () => '0');

await writeFile(benchmarkPath, JSON.stringify(benchmarkRecords), 'utf8');
await writeFile(gpsPath, JSON.stringify(gpsRecords), 'utf8');
console.log(`BM/SBM: ${benchmarkResult.updated.toLocaleString('en-MY')} updated, ${benchmarkResult.missing.toLocaleString('en-MY')} missing`);
console.log(`GPS: ${gpsResult.updated.toLocaleString('en-MY')} updated, ${gpsResult.missing.toLocaleString('en-MY')} missing`);
