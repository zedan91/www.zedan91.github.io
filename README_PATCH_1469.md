# AZOBSS v1469 — Phone Desktop View / Mobile View Switcher

Baseline: v1468.

## Perubahan
- Tambah butang terapung khas untuk telefon: `Desktop View`.
- Selepas ditekan, halaman menggunakan viewport desktop 1280px supaya lebih banyak kandungan kelihatan serentak dan layout menyerupai PC.
- Dalam Desktop View, butang bertukar kepada `Mobile View` untuk kembali ke paparan telefon biasa.
- Pilihan disimpan dalam `localStorage` dan kekal apabila pengguna berpindah halaman atau refresh.
- Pertukaran view reload sekali supaya semua CSS responsive dan JavaScript yang bergantung pada viewport mengira layout semula dengan betul.
- Pinch zoom kekal dibenarkan dalam Desktop View.
- Butang hanya muncul pada peranti telefon/touch bersaiz telefon; desktop biasa tidak memaparkannya.
- Script dimuat sejurus selepas viewport meta pada 39 halaman utama supaya pilihan Desktop View digunakan sebelum body selesai dirender dan mengurangkan layout flash.
- Halaman backend dalaman `backend/solattime-license/public/` tidak disentuh.

## Fail baru
- `assets/js/azobss-mobile-view-switcher.js`

## Versioning
- `azobss-global-auth.js` badge: v1469.
- Semua 39 rujukan `azobss-global-auth.js` customer/admin utama menggunakan cache-bust `v=1469`.
- Semua 39 halaman viewport utama memuatkan `azobss-mobile-view-switcher.js?v=1469`.

## Regression safety
- Tiada perubahan kepada auth, checkout, payment, PA/BM, mini accounting, Upgrade Parts, Liyabudun atau logic bisnes lain.
- Desktop biasa kekal menggunakan layout asal kerana switcher tidak aktif di desktop.
