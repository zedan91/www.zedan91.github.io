# Patch 786 — Website Auto Receipt Sent + Paid (Not Sent) Filter

- Paid records from Source `Website` are shown as `RECEIPT SENT` automatically because the website payment flow sends/delivers the receipt automatically.
- Paid records from Source `Manual` default to `RECEIPT NOT SENT` until the admin shares the receipt or manually marks it as sent.
- An explicit manual SENT / NOT SENT state always overrides the automatic Website default.
- Adds `Paid (Not Sent)` to the Status filter for quickly finding paid receipts that still need to be sent.
- No backend change is required. Upload the website files and press Ctrl + F5 on the Admin page.
