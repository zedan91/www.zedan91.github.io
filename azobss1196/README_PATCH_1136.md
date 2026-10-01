# AZOBSS v1136 — PA Latest Purchase Download Reliability Fix

## Masalah

Sesetengah pelanggan menekan butang download PA pada **Senarai Pembelian Terkini / Latest Purchase List** tetapi fail tidak keluar. Aduan berlaku pada PA yang baru dibeli (contoh PA8174) dan juga PA lain, jadi pembaikan dibuat pada aliran download PA secara umum dan bukan pada satu nombor PA sahaja.

## Pembaikan

- Download PA berbayar kini menggunakan **native browser attachment download**. Frontend tidak lagi menunggu seluruh PDF dimuat ke dalam JavaScript Blob sebelum mencetuskan download. Ini mengurangkan kes respons backend berjaya tetapi browser/telefon kelihatan seperti tidak melakukan apa-apa.
- Backend PA kini menerima sumber yang sudah berupa **PDF** atau sumber imej/TIF. Jika sumber sudah PDF, fail dihantar terus dan tidak dipaksa melalui converter TIF→PDF.
- Resolver PA dipercepatkan:
  - URL sumber yang paling munasabah dicuba secara selari;
  - setiap fetch mempunyai timeout keras;
  - authenticated/session retry hanya dibuat jika perlu;
  - curl fallback PA dihadkan;
  - PA yang sama dalam format `8174`, `PA8174`, `PA 8174.TIF`, dll. tidak lagi menyebabkan retry berulang yang boleh mengambil masa beberapa minit.
- Sumber PA yang berjaya disimpan dalam cache memori backend selama 30 minit supaya percubaan seterusnya lebih cepat.
- Respons PA PDF menambah `Content-Length` dan `Cache-Control: private, no-store` untuk delivery attachment yang lebih konsisten.
- Had download sedia ada **5 kali / 7 hari** dikekalkan. Jika fail sumber gagal diperoleh atau conversion gagal sebelum PDF sah tersedia, quota download tidak digunakan.

## Tidak Diubah

- Harga / payment flow PA/BM.
- Tempoh dan had 5 kali download.
- BM, SBM, GPS, Syit Piawai dan Lot Kadaster.
- Membership, Referral, Lucky Draw dan kawalan PA/BM Admin.
- Peta BM/SBM v1135.

## Deploy

Versi ini memerlukan:

1. Push/deploy frontend GitHub Pages.
2. Redeploy **main Render backend** (`deploy-server.js`).

Lucky Draw backend dan Firebase Rules tidak perlu redeploy.

## Validation

- `node --check deploy-server.js` — lulus.
- `node --check assets/js/azobss-global-auth.js` — lulus.
- `node --check assets/js/azobss-firebase-live-likes-sync.js` — lulus.
- `npm run check` — lulus.
- 38 HTML / 516 inline JavaScript blocks — 0 syntax failure.
- Semantic checks: native PA attachment, PDF/TIF source handling, PA timeout/cache, v1136 auth cache-busters — lulus.
