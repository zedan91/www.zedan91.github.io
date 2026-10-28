# AZOBSS Patch 831 — Restore WhatsApp App Launch

- Built from patch 830.
- Restores the previous WhatsApp app-launch flow for desktop/laptop instead of forcing WhatsApp Web.
- Desktop/laptop now uses `whatsapp://send` again, so users who already have WhatsApp Desktop can open the app directly.
- The browser may show its normal external-app confirmation (`Open WhatsApp?`); this is controlled by Chrome/Windows and cannot be auto-clicked by the website.
- WhatsApp Web remains available only as a manual fallback from the launcher.
- All patch 830 changes are retained, including mandatory Floor/Unit and default `Ada data penting`.
