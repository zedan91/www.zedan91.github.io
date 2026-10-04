# AZOBSS v1119 — Duplicate PA Negeri Priority + Historical PA Lot Resolver Fix

Baseline: `(1118)-AZOBSS-LOT-KADASTER-TILE-LOAD-STABILIZATION-FIX_20260915.zip`

## Masalah
Nombor Pelan Akui tidak semestinya unik di seluruh Malaysia. Contoh ujian `PA215371` wujud di **Selangor** dan juga **Terengganu**. Dalam v1117/v1118, sistem mula-mula cuba negeri dipilih, tetapi jika geometri negeri itu gagal diselesaikan, resolver menganggap PA tiada lalu auto-detect negeri lain. Akibatnya carian ketika **Selangor dipilih** boleh tersalah memaparkan PA Terengganu dan mesej `PA ini berada di TERENGGANU, bukan SELANGOR` walaupun PA215371 Selangor memang sah.

Sesetengah PA lama juga boleh memaparkan senarai lot sebagai teks/range (contoh `LOT 77387 - 77397`) dan bukan satu pautan peta bagi setiap lot. Parser lama hanya membaca `<a>` dalam jadual `exampleMini`, menyebabkan geometri PA negeri yang betul kadang-kadang gagal.

## Pembetulan
- Negeri yang pengguna pilih menjadi **keutamaan mutlak** apabila carian rasmi Pelan Akui JUPEM mengesahkan PA tepat memang wujud di negeri itu.
- Kegagalan geometri sementara tidak lagi menyebabkan sistem senyap-senyap menukar kepada PA nombor sama di negeri lain.
- Auto-detect negeri hanya dijalankan selepas carian rasmi negeri dipilih **positif tiada PA tepat**.
- Auto-detect kini mengimbas **semua negeri** dahulu sebelum memilih. Jika PA sama wujud di lebih daripada satu negeri, sistem tidak meneka dan meminta pengguna pilih negeri yang betul.
- Jika semakan negeri dipilih gagal sementara, sistem fail-safe dan tidak auto-switch negeri.
- Parser `exampleMini` PA ditambah fallback yang membaca kolum Lot walaupun tiada link peta.
- Range lot numerik seperti `77387 - 77397` dikembangkan secara selamat kepada lot individu untuk proses geometri.
- Jika PA memang wujud di negeri dipilih tetapi geometri JUPEM belum dapat dimuat, mesej kini menyatakan keadaan sebenar dan meminta cuba lagi; bukan menunjukkan PA negeri lain.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1119`.

## Deploy
Perubahan melibatkan frontend dan backend:
1. Push/deploy GitHub Pages.
2. Redeploy Render backend AZOBSS.
3. Buat `Ctrl + F5` selepas deploy.

## Semakan
- `node --check deploy-server.js`
- `node --check assets/js/azobss-pabm-map-search.js`
- `npm run check`
