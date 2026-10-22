# AZOBSS v1389 — Direct Chrome WhatsApp Web Send Fix

- Removes api.whatsapp.com / wa.me / whatsapp:// intermediary flow.
- Prefers Google Chrome and opens direct WhatsApp Web chat.
- Falls back to the default browser only when Chrome is not installed.
- Waits for a visible WhatsApp browser window.
- Pastes and sends the UltraViewer screenshot first.
- Sends the AZOBSS Remote Support text after the screenshot.
- Keeps v1388 screenshot capture and v1387 clean CMD.
