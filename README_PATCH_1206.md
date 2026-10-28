# AZOBSS v1206 — Firefox PDF Share Fallback Fix

- Built directly from v1205.
- Chrome/Edge actual PDF native sharing is unchanged.
- Detects Firefox Desktop separately instead of sending it through Chromium/Windows file-share logic.
- Firefox **Share Actual PDF** now becomes **Firefox: Download PDF + WhatsApp**.
- The real PDF is re-wrapped as `application/octet-stream` for the fallback download so Firefox does not unexpectedly open its built-in PDF preview.
- WhatsApp is opened with a secure temporary PDF link when available; the invoice/payment message is also copied.
- Firefox **WhatsApp PDF** skips unsupported native-file sharing and directly uses the secure temporary PDF link.
- Mobile/non-Firefox behavior is unchanged.
- Sales & Receipts cache-buster increased to `v=1206`.
