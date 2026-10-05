# AZOBSS Patch 1219 — AZDM Purchase Flow + Direct Installer Download

Baseline: v1218.

## Flow pembelian AZDM
- Customer membeli dari `/Software-Tools/` menggunakan akaun AZOBSS yang sedang login.
- Nama, email verified dan no. telefon diambil server-side daripada Firebase Auth / profil AZOBSS; browser tidak boleh menggantikan identiti checkout sesuka hati.
- ToyyibPay menerima maklumat customer dan order disimpan sebagai pending.
- Selepas bayaran disahkan, Render memanggil Worker `azdm-license` melalui API admin server-only.
- Worker mengeluarkan satu Serial Key unik bagi setiap PC dan menyimpan customer + email + phone + serial di rekod lesen D1.
- Render menyimpan salinan serial order secara encrypted dan menghantar Serial Key kepada email customer.
- Admin > Software Key > AZDM terus memaparkan Nama, Gmail/Phone dan Serial Key untuk lesen baharu.

## Perubahan UI
- Kad AZOBSS Download Manager kini mempunyai butang `Download` di sebelah `Pilihan pakej`.
- Butang terus membuka `https://files.azobss.com/AZDM-Setup.exe`.
- Butang Support dikekalkan.
- Layout dikompakkan supaya `Pilihan pakej`, `Download` dan `Support` muat pada kad.

## Deploy
1. Deploy full package v1219 ke website/Render seperti biasa.
2. Worker Cloudflare tidak perlu ditukar jika Worker v1218 sudah deploy.
3. Buat Ctrl+F5 pada `/Software-Tools/`.
