# AZOBSS v1386 - Customer Clean CMD + UltraViewer-only Screenshot

- Removes long EncodedCommand/Base64 text from the customer-facing CMD.
- PowerShell helpers are decoded silently to temporary `.ps1` files in small safe chunks.
- Customer CMD now only shows four simple progress steps.
- Technical URL/path/exit-code details go to `%TEMP%\AZOBSS_UltraViewer_Remote.log`.
- Before capture, the CMD console is minimized and UltraViewer is restored/foregrounded.
- Screenshot uses Win32 `PrintWindow` to capture UltraViewer only; screen-copy is only a fallback.
- Waits 6 seconds after UltraViewer appears so ID/password fields have time to populate.
- WhatsApp sending is run silently after screenshot creation.
