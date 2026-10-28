# AZOBSS v1432 — PC Build Verified Price Only

Baseline: v1431 `PC-RETAILER-FILTER-ADMIN-ONLY`.

## Perubahan utama

- PC Build tidak lagi memaparkan nombor harga anggaran/rekaan kepada pelanggan.
- 115 rekod retailer yang mempunyai snapshot harga lengkap ditanda `priceVerified: true` dan masih boleh memaparkan harga kedai sebenar.
- 6 rekod quote/unverified ditanda `priceVerified: false`; nombor RM tidak dipaparkan dan UI menggunakan `Semak harga kedai` / `Harga tidak tersedia`.
- Guard UI `retailerPriceVerified()` memerlukan `priceVerified=true`, harga > 0, tarikh semakan, URL sumber dan jenis harga snapshot sebelum nombor harga boleh dipaparkan.
- Julat harga hanya dipaparkan apabila rekod retailer telah lulus guard verified-price yang sama.
- Build AZOBSS yang menggunakan formula kos + markup tidak lagi dipaparkan sebagai nombor harga pelanggan; UI memaparkan `Semak harga akhir`.
- Build Sendiri utama dan halaman penuh `/PC-Build/Build-Sendiri/` tidak lagi memaparkan `Harga anggaran`, `+~RM...`, jumlah baris anggaran atau jumlah akhir anggaran kepada pelanggan.
- Pengiraan kos/markup lama dikekalkan sebagai maklumat dalaman Administrator sahaja dan dilabel `Kiraan dalaman`.
- Status fallback harga ditukar kepada wording `harga belum disahkan` / `katalog dalaman` supaya tidak dianggap harga pelanggan.
- Katalog retailer manifest/directory dinaikkan ke versi 1432 dan cache-bust PC Build dikemas kini.
- Badge versi website pada aset global dikemas kini kepada `v1432`.

## Polisi harga v1432

**Ada snapshot sumber yang disahkan → paparkan harga.**

**Tiada snapshot yang disahkan → jangan cipta nombor RM; minta semakan harga akhir.**
