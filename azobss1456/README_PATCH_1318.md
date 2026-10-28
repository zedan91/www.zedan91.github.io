# AZOBSS v1318 — Firefox WhatsApp Physical PDF Bridge

## Tujuan
Firefox Desktop tidak menyediakan Chromium/Windows Web Share actual-file flow yang digunakan oleh Chrome/Edge. v1318 menambah WebExtension Firefox lokal supaya invoice/receipt AZOBSS boleh dihantar ke WhatsApp Web sebagai fail PDF sebenar, bukan temporary Render link.

## Flow baharu Firefox
1. Admin klik Share Invoice/Receipt.
2. AZOBSS jana PDF sebenar terus dalam browser.
3. Page menghantar PDF sebagai data lokal kepada `AZOBSS Firefox WhatsApp PDF Bridge v1318`.
4. Extension membuka `web.whatsapp.com` pada nombor customer.
5. Extension memilih attachment Document, memasukkan `File(..., application/pdf)`, dan mengisi caption mengikut payment method aktif.
6. Extension berhenti pada preview. Admin semak dan tekan **Send** sendiri.

Firefox physical-PDF flow ini tidak menggunakan temporary Render PDF URL.

## Fallback
Jika extension tidak dikesan, AZOBSS akan:
- download physical PDF ke Downloads;
- copy caption;
- buka WhatsApp Web;
- minta admin attach PDF secara manual.

Ia tidak kembali kepada temporary Render link untuk butang Firefox WhatsApp/physical-PDF.

## Extension
Folder: `azobss-firefox-whatsapp-pdf-bridge/`

Pemasangan ujian Firefox:
`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on...** → pilih `manifest.json` atau XPI yang dibekalkan.

Temporary Add-on Firefox akan hilang selepas Firefox restart. Untuk pemasangan kekal pada Firefox release, extension perlu ditandatangani oleh Mozilla atau dipasang melalui kaedah organisasi yang sah.

## Chrome / Edge
Tiada perubahan pada flow actual physical PDF melalui Windows Share.

## Version/cache
- package: `1.0.1318`
- visible badge: `v1318`
- `azobss-global-auth.js?v=1318`
- `azobss-admin-sales-receipt-pdf.js?v=1318`
- `azobss-admin-sales-receipts.js?v=1318`
