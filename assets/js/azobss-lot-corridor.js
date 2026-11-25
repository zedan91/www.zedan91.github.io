import './vendor/polygon-clipping-0.15.7.js';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_KML_BYTES = 8 * 1024 * 1024;
const MAX_ROUTE_POINTS = 10000;
const MAX_SELECTION_POINTS = 1000;
const EARTH_RADIUS = 6378137;
const RADIANS = Math.PI / 180;

function isMalaysiaPoint(point) {
  return point[0] >= 95 && point[0] <= 125 && point[1] >= -2 && point[1] <= 8.5;
}

function samePoint(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function readCoordinate(value, separator) {
  const fields = value.trim().split(separator);
  if (fields.length < 2 || !fields[0] || !fields[1]) {
    throw new Error('Koordinat laluan dalam fail tidak sah.');
  }
  const point = [Number(fields[0]), Number(fields[1])];
  if (!isMalaysiaPoint(point)) throw new Error('Laluan mesti berada dalam kawasan Malaysia.');
  return point;
}

function parseKml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Fail KML mengandungi deklarasi XML yang tidak disokong.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.documentElement.localName !== 'kml' || document.getElementsByTagName('parsererror').length) {
    throw new Error('Fail KML tidak dapat dibaca. Semak format XML fail.');
  }

  const lines = [];
  let pointCount = 0;
  function append(values, separator) {
    pointCount += values.length;
    if (pointCount > MAX_ROUTE_POINTS) throw new Error('Laluan melebihi 10,000 titik. Bahagikan fail kepada beberapa bahagian.');
    lines.push(values.map((value) => readCoordinate(value, separator)));
  }
  for (const element of document.getElementsByTagNameNS('*', 'LineString')) {
    const coordinates = Array.from(element.children).find((node) => node.localName === 'coordinates');
    if (!coordinates || !coordinates.textContent.trim()) continue;
    append(coordinates.textContent.trim().split(/\s+/, MAX_ROUTE_POINTS + 1), ',');
  }
  for (const element of document.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Track')) {
    const coordinates = Array.from(element.children).filter((node) => node.localName === 'coord');
    if (!coordinates.length) continue;
    append(coordinates.map((node) => node.textContent), /\s+/);
  }
  return lines;
}

function decodeKml(bytes) {
  // TextDecoder handles a UTF-8 BOM and the two BOM-marked UTF-16 variants.
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch (_) {
    throw new Error('Teks KML tidak dapat dibaca. Simpan fail dalam format UTF-8 dan cuba lagi.');
  }
}

function normalizeLines(lines) {
  const count = lines.reduce((sum, line) => sum + line.length, 0);
  if (count > MAX_ROUTE_POINTS) throw new Error('Laluan melebihi 10,000 titik. Bahagikan fail kepada beberapa bahagian.');
  const paths = lines.map((line) => {
    if (!line.every(isMalaysiaPoint)) throw new Error('Laluan mesti berada dalam kawasan Malaysia.');
    return line.filter((point, index) => index === 0 || !samePoint(point, line[index - 1]));
  }).filter((line) => line.length >= 2);
  if (!paths.length) throw new Error('Tiada garisan atau poligaris yang sah ditemui.');
  return paths;
}

export async function importLotRoute(file) {
  const extension = String(file.name || '').split('.').pop().toLowerCase();
  if (extension !== 'kml' && extension !== 'kmz') throw new Error('Pilih fail KML atau KMZ.');
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Saiz fail KML atau KMZ mestilah antara 1 bait dan 5 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (extension === 'kml') return normalizeLines(parseKml(decodeKml(bytes)));

  const { unzipSync } = await import('./vendor/fflate-0.8.2.js');
  let files;
  let totalKmlBytes = 0;
  let kmlCount = 0;
  let limitExceeded = false;
  try {
    files = unzipSync(bytes, { filter(entry) {
      if (!/\.kml$/i.test(entry.name) || /(?:^|\/)__MACOSX\//.test(entry.name)) return false;
      totalKmlBytes += entry.originalSize;
      kmlCount += 1;
      if (totalKmlBytes > MAX_KML_BYTES || kmlCount > 32) limitExceeded = true;
      return !limitExceeded;
    } });
  } catch (_) {
    throw new Error('Fail KMZ tidak dapat dibuka. Pastikan fail ialah arkib KMZ yang sah.');
  }
  if (limitExceeded) throw new Error('Arkib KMZ melebihi had 32 fail KML atau 8 MB selepas dinyahmampat.');
  const entries = Object.values(files);
  if (!entries.length) throw new Error('Tiada fail KML ditemui di dalam arkib KMZ.');
  return normalizeLines(entries.flatMap((entry) => parseKml(decodeKml(entry))));
}

function bearing(from, to) {
  const lat1 = from[1] * RADIANS;
  const lat2 = to[1] * RADIANS;
  const deltaLon = (to[0] - from[0]) * RADIANS;
  return Math.atan2(Math.sin(deltaLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon));
}

function offsetPoint(point, distance, direction) {
  if (distance === 0) return point;
  const latitude = point[1] * RADIANS;
  const angle = distance / EARTH_RADIUS;
  const offsetLatitude = Math.asin(Math.sin(latitude) * Math.cos(angle) +
    Math.cos(latitude) * Math.sin(angle) * Math.cos(direction));
  const offsetLongitude = point[0] + Math.atan2(Math.sin(direction) * Math.sin(angle) * Math.cos(latitude),
    Math.cos(angle) - Math.sin(latitude) * Math.sin(offsetLatitude)) / RADIANS;
  return [offsetLongitude, offsetLatitude / RADIANS];
}

function simplifyLine(line, tolerance) {
  const scale = EARTH_RADIUS * RADIANS;
  const longitudeScale = scale * Math.cos(line[0][1] * RADIANS);
  const keep = new Uint8Array(line.length);
  const last = line.length - 1;
  keep[0] = keep[last] = 1;
  const spans = [[0, last]];
  while (spans.length) {
    const [start, end] = spans.pop();
    const a = line[start];
    const b = line[end];
    const dx = (b[0] - a[0]) * longitudeScale;
    const dy = (b[1] - a[1]) * scale;
    const lengthSquared = dx * dx + dy * dy;
    let furthest = -1;
    let distanceSquared = tolerance * tolerance;
    for (let i = start + 1; i < end; i++) {
      const x = (line[i][0] - a[0]) * longitudeScale;
      const y = (line[i][1] - a[1]) * scale;
      const t = lengthSquared ? Math.max(0, Math.min(1, (x * dx + y * dy) / lengthSquared)) : 0;
      const distance = (x - t * dx) ** 2 + (y - t * dy) ** 2;
      if (distance <= distanceSquared) continue;
      distanceSquared = distance;
      furthest = i;
    }
    if (furthest >= 0) {
      keep[furthest] = 1;
      spans.push([start, furthest], [furthest, end]);
    }
  }
  return line.filter((point, index) => keep[index]);
}

function selectionPolygon(points) {
  const ring = points.map(([lng, lat]) => [Number(lng.toFixed(8)), Number(lat.toFixed(8))]);
  return [[...ring, ring[0]]];
}

export function buildLotCorridor(lines, leftMeters, rightMeters) {
  if (![leftMeters, rightMeters].every((width) => Number.isFinite(width) && width >= 0) ||
      leftMeters + rightMeters <= 0) {
    throw new Error('Masukkan offset kiri dan kanan dalam meter. Sekurang-kurangnya satu mesti lebih daripada 0.');
  }
  let paths = normalizeLines(lines);
  const positiveWidths = [leftMeters, rightMeters].filter((width) => width > 0);
  if (paths.reduce((sum, line) => sum + line.length, 0) > 300) {
    const tolerance = Math.min(0.25, Math.min(...positiveWidths) / 10);
    paths = normalizeLines(paths.map((line) => simplifyLine(line, tolerance)));
  }
  if (paths.reduce((sum, line) => sum + line.length, 0) > MAX_SELECTION_POINTS) {
    throw new Error('Laluan terlalu terperinci. Bahagikan kepada beberapa pilihan lot.');
  }

  const pieces = [];
  for (const path of paths) {
    let previousLeft;
    let previousRight;
    for (let i = 1; i < path.length; i++) {
      const start = path[i - 1];
      const end = path[i];
      const startBearing = bearing(start, end);
      const endBearing = bearing(end, start) + Math.PI;
      const leftStart = offsetPoint(start, leftMeters, startBearing - Math.PI / 2);
      const leftEnd = offsetPoint(end, leftMeters, endBearing - Math.PI / 2);
      const rightStart = offsetPoint(start, rightMeters, startBearing + Math.PI / 2);
      const rightEnd = offsetPoint(end, rightMeters, endBearing + Math.PI / 2);
      pieces.push(selectionPolygon([leftStart, rightStart, rightEnd, leftEnd]));
      // Bevel joins fill gaps on bends without extending the corridor at its ends.
      if (previousLeft && leftMeters) pieces.push(selectionPolygon([start, previousLeft, leftStart]));
      if (previousRight && rightMeters) pieces.push(selectionPolygon([start, previousRight, rightStart]));
      previousLeft = leftEnd;
      previousRight = rightEnd;
    }
  }
  const polygons = globalThis.polygonClipping.union(...pieces);
  // The union uses GeoJSON winding. ArcGIS expects clockwise outer rings and
  // counterclockwise holes. This also keeps the current area calculation correct.
  const rings = polygons.flatMap((polygon) => polygon.map((ring) => ring.slice().reverse()));
  if (!rings.length) throw new Error('Kawasan laluan terlalu kecil. Besarkan offset dan cuba lagi.');
  if (!rings.every((ring) => ring.every(isMalaysiaPoint))) {
    throw new Error('Offset menghasilkan kawasan di luar julat peta Malaysia.');
  }
  if (rings.reduce((sum, ring) => sum + ring.length, 0) > MAX_SELECTION_POINTS) {
    throw new Error('Kawasan laluan terlalu terperinci. Bahagikan kepada beberapa pilihan lot.');
  }
  return { polygons, geometry: { rings, spatialReference: { wkid: 4326 } } };
}
