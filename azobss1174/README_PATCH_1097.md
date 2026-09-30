# AZOBSS Patch 1097 — Google Sitelinks / Private Page Deindex SEO Fix

Tarikh: 13 September 2026
Package version: 1.0.1097

## Tujuan
Kurangkan kebarangkalian Google memaparkan halaman khas/privat `PA / BM` dan `AZOBSS Admin Dashboard` sebagai sitelink di bawah hasil utama AZOBSS, sambil menguatkan isyarat untuk halaman awam `Software Tools` dan `Lucky Draw`.

## Perubahan
- `/PA-BM/` ditambah `robots: noindex,follow,noarchive` dan canonical sendiri. Fungsi serta akses pengguna PA/BM tidak diubah.
- `/admin/` ditambah `robots: noindex,nofollow,noarchive,nosnippet` dan canonical sendiri. Fungsi Admin Dashboard tidak diubah.
- `/Software-Tools/` dan `/lucky-draw/` ditetapkan secara eksplisit `index,follow` dan metadata description diperkemas.
- Home page title/description diperkemas supaya menonjolkan `Software Tools`, `Lucky Draw` dan digital resources berbanding PA/BM.
- Home page ditambah structured WebSite navigation yang memberi pautan awam utama kepada Software Tools, Lucky Draw, Tempah Servis IT dan Affiliate Shop.
- Ditambah `sitemap.xml` yang mengutamakan halaman awam dan sengaja tidak memasukkan `/PA-BM/` serta `/admin/`.
- Ditambah `robots.txt` dengan pautan sitemap. PA/BM/Admin tidak disekat di robots.txt supaya crawler masih boleh membaca arahan `noindex` pada halaman tersebut.
- Package version dinaikkan kepada `1.0.1097`.

## Nota Google
Google menentukan sitelinks secara automatik. Patch ini tidak boleh memaksa dua sitelink tertentu muncul serta-merta. Selepas Google crawl semula, PA/BM dan Admin sepatutnya keluar daripada indeks/sitelinks kerana `noindex`; Software Tools dan Lucky Draw diberi isyarat awam yang lebih kuat.

## Deploy
Frontend/static sahaja. Push GitHub Pages seperti biasa. Render backend tidak perlu redeploy khusus untuk patch ini.
