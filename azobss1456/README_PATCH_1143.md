# AZOBSS v1143 — Download/Test Button Spinner Re-render Fix

Baseline: v1142.

Punca sebenar:
- Spinner v1142 ditambah pada DOM button yang diklik, tetapi Purchase Records boleh re-render semasa request berjalan.
- Button baharu hasil re-render membawa `data-busy=1`/spinner markup untuk customer row tetapi tidak membawa class `azobss-download-button-spinning`, sedangkan CSS v1142 bergantung pada class itu.
- Admin `Test ↓` pula dirender semula sebagai teks `Test ↓` tanpa membaca `window.__azobssPaBmActiveDownload`.
- Jika backend sudah warm, /api/health juga boleh siap terlalu cepat sehingga spinner tidak sempat dilihat.

Fix v1143:
- Button aktif hasil re-render membawa class spinner secara kekal.
- CSS spinner turut membaca `data-busy=1`, jadi tidak bergantung pada satu class sahaja.
- `Test ↓` admin kini render spinner semula jika payload itu sedang aktif.
- Download customer juga preserve spinner selepas live refresh/re-render.
- UI lock add/remove class spinner secara konsisten.
- Spinner button-only dipastikan kelihatan minimum ~650 ms jika backend sudah warm.
- Tiada fullscreen overlay/modal.
- Health check kekal quota-free melalui `/api/health`.
- Backend tidak berubah.
