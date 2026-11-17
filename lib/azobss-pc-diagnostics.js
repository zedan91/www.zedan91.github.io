'use strict';
const crypto = require('node:crypto');
const LIMIT = 256 * 1024;
function invalid(message, statusCode = 400) { throw Object.assign(new Error(message), {statusCode}); }
function short(value, max = 180) {
  return String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max);
}
function normalizeReport(input) {
  if (!input || typeof input !== 'object') invalid('Invalid PC report.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id || '')) invalid('Invalid report ID.');
  const report = input.report;
  if (typeof report !== 'string' || !report.includes('AZOBSS CUSTOMER PC DIAGNOSTIC') || report.includes('\0')) invalid('Invalid diagnostic text.');
  if (Buffer.byteLength(report, 'utf8') > LIMIT) invalid('Report exceeds 256 KB.', 413);
  const manufacturer = short(input.manufacturer), model = short(input.model), serial = short(input.serial);
  const batteries = Array.isArray(input.batteries) ? input.batteries.slice(0, 8).map(x => ({name:short(x?.name),manufacturer:short(x?.manufacturer),serial:short(x?.serial)})) : [];
  return {id:input.id.toLowerCase(),report,manufacturer,model,serial,batteries};
}
function dealerMessage(row) {
  return ['Jenama: ' + (row.manufacturer || 'Tidak tersedia'),
    'Model: ' + (row.model || 'Tidak tersedia'),
    'Serial Number: ' + (row.serial || 'Tidak tersedia'),
    'Battery Name: ' + (row.batteries?.map(x => x.name).filter(Boolean).join(', ') || 'Tidak dikesan')].join('\n');
}
function createDiagnosticStore({baseUrl, secret, fetchImpl = fetch}) {
  return async function call(data) {
    const base = String(baseUrl() || '').replace(/\/+$/, ''), key = secret();
    if (!base || !key) invalid('Private Cloudflare storage is unavailable.', 503);
    const body = JSON.stringify({...data,atMs:Date.now()});
    const signature = crypto.createHmac('sha256', key).update('azobss-pc-diagnostics-v1590\n' + body).digest('base64url');
    const response = await fetchImpl(base + '/pc-diagnostics-storage', {
      method:'POST',headers:{'Content-Type':'application/json','x-azobss-diagnostic-signature':signature},
      body,redirect:'error',signal:AbortSignal.timeout(25000)
    });
    let result;
    try { result = await response.json(); } catch { invalid('Cloudflare report storage did not respond.', 502); }
    if (!response.ok || !result.ok) invalid(result.error || 'Cloudflare report storage failed.', response.status || 502);
    return result;
  };
}
module.exports = {LIMIT,normalizeReport,dealerMessage,createDiagnosticStore};
