# AZOBSS v1205 — Actual PDF Share Capability Fix

Built directly from v1204.

## Admin > Sales & Receipts > Share Invoice/Receipt

- Removed the modal-open dummy 1-byte PDF `navigator.canShare()` gate that could incorrectly show **Share Actual PDF File — unsupported here**.
- **Share Actual PDF File** is always available for a single invoice/receipt.
- On click, AZOBSS generates the real invoice/receipt PDF first, then checks `navigator.canShare({ files: [actualPdfFile] })` using that exact file.
- If native file sharing is supported, the real PDF is sent to the Windows/phone Share sheet and the invoice/receipt message is copied as a caption fallback.
- If native file sharing is not supported (or the OS share sheet rejects the actual file), AZOBSS downloads the real PDF locally and opens WhatsApp with the invoice/payment message, instructing the user to attach the downloaded PDF.
- WhatsApp sharing also tests the actual PDF first; if direct file sharing is unavailable, it falls back to the existing secure temporary PDF link + payment details flow.
- Telegram remains temporary-link based.
- Sales & Receipts cache-buster increased to `v=1205`.

No Lot Kadaster, payout, commission, payment, invoice numbering, or PDF layout logic was changed.
