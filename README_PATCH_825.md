# Patch 825 — Invoice Notes Lower, Clean and Structured

- Based on Patch 824.
- Moves the `NOTES` card farther down into the available lower-page space, close to the footer while preserving the thank-you line and one-page layout.
- Removes the automatically generated sentence `Draf invois daripada Tempahan Servis ...` from new drafts and from PDFs generated from existing saved drafts.
- Preserves real line breaks in Notes instead of converting them into artificial `?` characters.
- Removes unsupported characters silently rather than inserting artificial question marks; customer-entered `?` characters remain unchanged.
- Organizes Peranti, Serial, Masalah, Catatan, Permintaan tambahan, Anggaran asal and Cara serahan on separate wrapped lines.
- Uses adaptive Notes font sizing, dynamic box height and safer inner margins so text stays inside the Notes border.
- Retains all Patch 824 functionality.
