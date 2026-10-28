# AZOBSS v1392 — UltraViewer Silent Install + Missing Label Fix

- Restores the missing `:FIND_ULTRAVIEWER` subroutine.
- Adds `:WAIT_FIND_ULTRAVIEWER` so UltraViewer can finish installing before launch.
- Primary installation uses `/SP- /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`.
- Silent retry/fallback uses the same switches; it no longer opens the normal Setup wizard.
- Keeps v1391 manual handoff popup: customer sends screenshot OR ID + Password manually.
- No automatic screenshot and no automatic WhatsApp.
