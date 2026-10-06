# AZOBSS Patch 1218 — AZDM Gmail / Phone + Search + Sort

Baseline: v1217.

## Perubahan
- Senarai lesen AZDM kini memaparkan `Gmail / Phone` bersama setiap customer.
- Borang `Keluarkan serial AZDM` kini mempunyai `Gmail / Email` dan `No. Phone`.
- Dialog `Edit lesen AZDM` juga boleh edit Gmail/email dan no. phone.
- Carian lesen kini menyokong nama customer, Gmail/email, no. phone (digit dinormalisasi) dan ID lesen penuh.
- Tambah `Sort by` untuk tarikh dikeluarkan, nama customer, Gmail, phone, tarikh tamat dan status.
- Jadual kekal compact pada desktop tanpa horizontal scroll; mobile masih boleh horizontal scroll.
- Worker v1218 auto-migrate D1 untuk `email`, `email_key`, `phone`, `phone_key` dan index carian.
- Pembelian AZDM melalui flow Render-native kini menghantar email/phone customer ke Worker semasa serial dikeluarkan.
- Rekod lama yang belum mempunyai Gmail/phone boleh diisi melalui butang `Edit`.

## Deploy
1. Deploy full package v1218 ke website/Render seperti biasa.
2. Cloudflare `azdm-license` > Edit Code: copy semua kandungan `AZDM-Cloudflare-Worker-v1218.txt` ke `worker.js`, kemudian Deploy.
3. Ctrl+F5 pada `/admin/`.

Worker source diberikan sebagai `.txt` supaya boleh dibuka dan copy terus tanpa extract.
