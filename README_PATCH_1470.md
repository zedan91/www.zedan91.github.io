# AZOBSS v1470 — Upgrade Parts Single-Screen Hardware Focus Panel

Baseline: v1469.

## Perubahan
- Header/hero Upgrade Parts dipadatkan dengan ketara supaya ruang atas lebih kecil.
- Bahagian hardware ditukar daripada grid kad panjang kepada `hardware focus panel`.
- 9 kategori hardware dipaparkan sebagai butang kecil dengan thumbnail, nama dan harga semasa.
- Hanya satu hardware aktif dipaparkan besar pada satu masa.
- Bila kategori lain ditekan, panel lama ditutup/minimize dan panel baru menjadi fokus.
- Panel besar menggunakan layout dua kolum: foto/info di kiri dan jadual/pilihan harga di kanan.
- RAM dan Storage yang mempunyai banyak baris menggunakan scroll dalaman panel jika perlu; pengguna tidak perlu scroll halaman hanya untuk menukar kategori.
- Harga live yang dikemas kini pada kad asal turut dicerminkan pada butang kategori melalui MutationObserver.
- Keyboard navigation pada category rail: Arrow keys, Home, End.
- Mobile/tablet menggunakan horizontal category rail + satu active panel di bawah.
- Semua 9 kategori, live price API, estimator, service info, compatibility info dan CTA lama dikekalkan di bawah focus panel.

## Versi/cache
- Global version badge: v1470.
- `azobss-global-auth.js?v=1470` pada 39 halaman.
- `azobss-mobile-view-switcher.js?v=1470` pada 39 halaman.

## Validation
- Focus panel JavaScript: `node --check` lulus.
- Global auth JavaScript: `node --check` lulus.
- Mobile view switcher JavaScript: `node --check` lulus.
- 9 hardware cards dikesan dalam Upgrade Parts.
- ZIP root-ready; tiada wrapper folder.
