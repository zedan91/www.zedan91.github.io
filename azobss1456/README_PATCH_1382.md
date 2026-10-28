# AZOBSS v1382 — UltraViewer Remote Support

- Baseline: v1381.
- Troubleshoot PC Online now uses UltraViewer as the primary/only remote support app.
- New BAT: `Tempah-Servis-IT/downloads/AZOBSS_UltraViewer_Remote_Support.bat`.
- The BAT parses UltraViewer's official download page for the current installer link (`UltraViewer_setup_X.Y_en.exe`) so future 6.7+ changes do not require a website edit.
- Official fallback remains `https://dl2.ultraviewer.net/UltraViewer_setup_6.6_en.exe` if the download page cannot be parsed.
- Uses UltraViewer's Inno Setup silent switches `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`.
- Detects installed UltraViewer in common Program Files / LocalAppData locations, with recursive fallback.
- Opens UltraViewer, captures its visible ID/Password window, copies screenshot to clipboard, and opens/sends to AZOBSS WhatsApp when possible.
- If WhatsApp automation fails, UltraViewer remains open and WhatsApp fallback opens with instructions; BAT does not falsely report installation failure.
- Legacy `Remote_PC_and_send_WS.bat` is replaced with the same UltraViewer flow for old cached links/bookmarks.
