#!/usr/bin/env bash
set -e
npm config set registry https://registry.npmjs.org/
npm install --include=optional --no-audit --no-fund
node -e "console.log('pdfkit:', require.resolve('pdfkit')); console.log('sharp:', require.resolve('sharp')); console.log('qrcode:', require.resolve('qrcode'))"
