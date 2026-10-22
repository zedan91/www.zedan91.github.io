# AZOBSS v1385 - UltraViewer Main Window Screenshot Fix

- Fix screenshot `0x0` by enumerating visible top-level Windows windows instead of trusting `Process.MainWindowHandle`.
- Selects the largest valid UltraViewer window (minimum 200x150), restores it, brings it to foreground, and captures only that window.
- Screenshot PowerShell is embedded as `-EncodedCommand` to avoid fragile BAT quoting.
- WhatsApp auto-send PowerShell is also encoded.
- Installer non-zero exit is shown as warning if UltraViewer is actually detected READY.
- Existing real download progress and install elapsed progress are retained.
