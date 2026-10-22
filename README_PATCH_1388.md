# AZOBSS v1388 — UltraViewer Screenshot + WhatsApp Reliability Fix

- Fix PowerShell reserved `$PID` collision by using `$procId`.
- Capture exact visible UltraViewer top-level window after restore/foreground.
- Wait for UltraViewer ID/Password to populate before screenshot.
- Validate PNG exists and is non-trivial.
- WhatsApp automation now detects real top-level WhatsApp window for up to 30 seconds.
- Clicks the chat input area before paste.
- Pastes/sends screenshot first, then sends support text.
- Falls back from WhatsApp Desktop to WhatsApp Web.
- Keeps the clean customer CMD flow from v1387.
