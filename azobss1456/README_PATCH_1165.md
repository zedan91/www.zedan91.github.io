# AZOBSS Patch 1165 — Firefox WhatsApp Invoice PDF Share Fallback

Package version: `1.0.1165`

Baseline: v1164.

## Fix

- Chrome/Edge/mobile browsers that support Web Share file attachments keep the existing **WhatsApp Actual PDF + Payment Link** flow.
- Firefox/other browsers that cannot attach PDF files through Web Share no longer show the dead-end `This browser cannot share PDF files directly` error for the WhatsApp action.
- On unsupported browsers, the WhatsApp action automatically falls back to opening WhatsApp with the **secure temporary backend PDF link** plus the invoice/receipt message and payment details.
- The WhatsApp tab is pre-opened from the user click before async PDF preparation, avoiding Firefox popup-blocking after an `await`.
- The Share panel changes the WhatsApp label/description on unsupported browsers so it does not falsely promise an attached PDF.
- **Share Actual PDF File** is disabled on browsers that do not support native file sharing; Chrome-compatible behavior is unchanged.
- Telegram/bulk direct-link flows also benefit from the pre-opened window reliability fix.
- Backend, ToyyibPay, invoice/receipt generation, accounting, Firestore and temporary-PDF storage behavior are unchanged.
