# AZOBSS Patch 828 — Desktop WhatsApp Web / Mobile App Routing

- Baseline: patch 827.
- Desktop/laptop no longer launches the `whatsapp://` protocol, avoiding Chrome's **Open WhatsApp?** external-app confirmation dialog.
- Desktop/laptop opens the prepared message directly in `https://web.whatsapp.com/send`.
- Phone/tablet still attempts to open the native WhatsApp app; the existing WhatsApp Web fallback remains available.
- Fast 2.5s opening, background booking save, duplicate protection, read-only address and Floor/Unit behavior are preserved.
