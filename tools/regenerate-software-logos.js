#!/usr/bin/env node
/*
  AZOBSS Software Logo Regenerator
  - Reads a software export JSON file.
  - Downloads a 128px favicon/logo from each software website.
  - Saves files to: Software-Tools/images/logo/<productId>.png
  - Updates item.imageUrl to the local logo path: images/logo/<productId>.png

  Usage:
    node tools/regenerate-software-logos.js "azobss-software-tools-export (5).json"

  Notes:
    GitHub Pages cannot write files by itself, so this script must be run locally
    before git add/commit/push if you want logos saved in your repo folder.
*/

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const inputArg = process.argv[2] || 'azobss-software-tools-export (5).json';
const inputPath = path.isAbsolute(inputArg) ? inputArg : path.join(ROOT, inputArg);
const outputDir = path.join(ROOT, 'Software-Tools', 'images', 'logo');

function safeName(value) {
  return String(value || 'software-logo')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'software-logo';
}

function domainFromUrl(url) {
  try { return new URL(String(url || '')).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function faviconUrl(url) {
  const domain = domainFromUrl(url);
  if (!domain) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, { headers: { 'User-Agent': 'AZOBSS-Logo-Regenerator/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).toString(), dest));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('Timeout')));
  });
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error('Input JSON not found:', inputPath);
    process.exit(1);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const items = Array.isArray(raw) ? raw : (Array.isArray(raw.items) ? raw.items : []);
  if (!items.length) {
    console.error('No items found in JSON.');
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const item of items) {
    const productId = item.productId || item.id || safeName(item.name);
    const link = item.secureDownloadLink || item.downloadLink || item.paymentLink || item.stripeLink || item.link || '';
    const src = faviconUrl(link);
    if (!src) {
      console.log('SKIP no link:', item.name || productId);
      fail++;
      continue;
    }

    const fileName = `${safeName(productId)}.png`;
    const dest = path.join(outputDir, fileName);

    try {
      await download(src, dest);
      item.imageUrl = `images/logo/${fileName}`;
      item.logoSource = domainFromUrl(link);
      ok++;
      console.log('OK', item.name || productId, '=>', item.imageUrl);
    } catch (err) {
      fail++;
      console.log('FAIL', item.name || productId, '-', err.message);
    }
  }

  const outPath = inputPath.replace(/\.json$/i, '.with-logos.json');
  fs.writeFileSync(outPath, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`\nDone. Saved logos: ${ok}, failed/skipped: ${fail}`);
  console.log('Updated JSON:', outPath);
  console.log('Logo folder:', outputDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/* Logo Priority: Upload Image > Image URL > Favicon Domain > Default AZOBSS Logo */
