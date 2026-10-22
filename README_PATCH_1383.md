# v1383 — UltraViewer BAT no-auto-close stability fix

- Replaces fragile self-elevating/hybrid BAT from v1382.
- BAT stays open and always pauses on success/error.
- UAC is left to the official UltraViewer installer instead of relaunching the whole BAT as Administrator.
- Detects current official installer URL from UltraViewer download page.
- Secondary detection reads `UltraViewer_setup_X.X_en.exe` from HTML, so future 6.7/6.8 naming can be followed automatically.
- Official 6.6 URL remains only as last-resort fallback.
- Silent install uses UltraViewer/Inno Setup switches `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART` and writes installer log.
- Detects UltraViewer from normal install folders and uninstall registry.
- Opens UltraViewer then opens WhatsApp with an ID/Password template.
- Removed fragile automatic screenshot/SendKeys flow to prevent CMD closing/crashing and wrong-window automation.
- Troubleshoot-PC-Online instructions updated: BAT itself no longer needs Run as administrator.
