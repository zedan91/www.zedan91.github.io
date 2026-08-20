# AZOBSS Patch 893 — Compact Software Key Cards, Sorting & Customer Reference

## Admin > Software Key

- Kad dipadatkan dan disusun secara responsif: dua kad sebaris pada ruang desktop yang sesuai, satu kad pada skrin sempit, dan sehingga tiga kad pada paparan lebih lebar.
- Setiap kad hanya menggunakan grid kecil 2 × 2 untuk System ID, Systemcode, Motherboard ID dan Key Serial.
- Nama pelanggan dan nombor telefon dipaparkan terus di sebelah nama PC.
- Butang `Edit` pada setiap kad membuka borang khas untuk menambah, mengubah atau membuang maklumat pelanggan tanpa mengubah ID atau key.
- Carian merangkumi nama pelanggan, telefon dengan atau tanpa dash/ruang, nama PC, System ID, Systemcode, key dan motherboard.
- Pilihan susunan merangkumi tarikh dikemas kini, tarikh rekod, pelanggan, nama PC dan status; pilihan terakhir disimpan pada browser.
- Export CSV kini menyertakan nama pelanggan, nombor telefon serta tarikh dicipta dan dikemas kini.

## Backend

- Medan baharu: `customerName`, `customerPhone` dan `customerPhoneDigits`.
- Tindakan Admin `update-customer` mengemas kini maklumat pelanggan bagi Record ID sedia ada.
- Capture awam daripada installer tidak dibenarkan menulis maklumat pelanggan; butiran ini hanya boleh diubah melalui Admin.
- Pemetaan tepat System ID/Systemcode serta pembuangan Onetimecode daripada patch 892 kekal aktif.
