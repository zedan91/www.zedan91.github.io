# v1390 UltraViewer screenshot + WhatsApp hardening

- WhatsApp target fixed/validated as 601135600723 (011-3560 0723).
- UltraViewer capture uses native PrintWindow first, exact-window CopyFromScreen fallback.
- WhatsApp step does not start until PNG exists and is >12 KB.
- Direct Chrome WhatsApp Web route only.
- Focuses WhatsApp composer, pastes screenshot, sends image, then sends support text.
- On failure, customer CMD shows the actual concise capture/WhatsApp error and the PNG path.
