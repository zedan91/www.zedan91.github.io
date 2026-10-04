# Patch 806 — WhatsApp Fast Open + Background Booking Save

- Berdasarkan baseline `(804)` dan tidak membawa perubahan susunan stickybar daripada patch `(805)` yang telah diabaikan.
- Rekod utama `serviceBookings` masih wajib disimpan terlebih dahulu apabila backend bertindak balas dengan cepat.
- Penulisan `adminNotifications` tidak lagi menahan respons pelanggan; ia dijalankan secara asynchronous selepas rekod utama berjaya disimpan.
- Frontend menunggu maksimum kira-kira **2.5 saat** sebelum membuka WhatsApp menggunakan mesej tempatan jika Render/backend masih lambat atau sedang cold start.
- Permintaan simpanan backend terus berjalan di belakang menggunakan `fetch(..., { keepalive: true })` dan `clientRequestId` yang sama untuk mengelakkan rekod pendua.
- Jika respons backend tiba sebelum 2.5 saat, WhatsApp dibuka menggunakan URL dan mesej rasmi backend yang mengandungi ID tempahan.
- Jika WhatsApp sudah dibuka lebih awal, respons backend tidak akan membuka tab WhatsApp kali kedua.
- Jika simpanan gagal selepas WhatsApp dibuka, halaman memaparkan amaran serta pautan fallback tanpa menutup WhatsApp.
