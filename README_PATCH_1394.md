# AZOBSS v1394 — UltraViewer Screenshot Reliability Fix

Date: 2026-10-23
Baseline: v1393

Changes:
- Fixed UltraViewer screenshot reliability: removed the brittle 3-pixel image test that could reject a valid screenshot.
- UltraViewer window is maximized/foregrounded before capture, with up to 5 capture retries.
- Screenshot PNG is validated by real file existence, minimum file size, and image dimensions.
- Clipboard copy has retry handling before WhatsApp automation starts.
- BAT now prints the actual screenshot path after a successful capture.
- `Remote_PC_and_send_WS.bat` legacy path now contains the exact same current flow as `AZOBSS_UltraViewer_Remote_Support.bat`, preventing old cached links from running the obsolete no-screenshot script.
- Troubleshoot-PC-Online copy updated to describe auto screenshot + auto WhatsApp send.
