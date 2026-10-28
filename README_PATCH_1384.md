# AZOBSS v1384 — UltraViewer progress + screenshot WhatsApp

Baseline: v1383.

Changes:
- Step 1 only detects current official UltraViewer installer URL.
- Step 2 displays real download percentage and MB/MB progress.
- Installation displays an animated activity bar plus elapsed seconds until installer exits.
- Step 3 waits for the real UltraViewer window and captures that window only to PNG.
- Step 4 opens WhatsApp AZOBSS, attempts to paste/send the UltraViewer screenshot, then sends a support message.
- Screenshot is retained in TEMP as a fallback if WhatsApp auto-send cannot be completed.
- BAT window remains open on errors.
- Troubleshoot-PC-Online copy updated from AnyDesk/TeamViewer/RustDesk references to UltraViewer-only flow.
