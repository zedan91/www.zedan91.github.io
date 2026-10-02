# AZOBSS v1202 — PA + Lot Kadaster Unified Backend Session Recovery

## Isu
Pada PA/BM, dua simptom boleh berlaku serentak:
- `Cari PA` memaparkan `Carian PA tidak tersedia buat sementara waktu`.
- Peta Pilihan Lot Kadaster memaparkan basemap OpenStreetMap tetapi garisan/polygon Lot Kadaster tidak muncul walaupun layer diaktifkan.

Audit kod v1201 menunjukkan carian PA biasa masih POST terus dari browser ke `ebiz.jupem.gov.my`, dan carian lot masih cuba direct browser sebelum fallback backend. Laluan ini bergantung pada polisi CORS/session sumber luar. Pada masa yang sama, tile kadaster menggunakan ArcGIS token/session dan v1201 boleh mencetuskan beberapa forced refresh serentak apabila banyak tile gagal bersama-sama.

## Fix v1202
1. Tambah backend `GET /api/search-pa` sebagai laluan utama carian PA.
2. `azobss-pa-search.js` kini backend-first; browser-direct hanya emergency fallback.
3. `azobss-lot-kadaster-search.js` kini backend-first; browser-direct hanya emergency fallback.
4. Search form PA/Lot backend kini bootstrap session, ikut redirect secara manual, merge cookie, kekalkan hidden `__RequestVerificationToken`/hidden field, dan retry sekali menggunakan sesi fresh jika respons tidak usable.
5. `azobssGetJupemMapAuth()` kini cuba halaman PetaInteraktif kadaster dahulu, kemudian fallback BM; cookie/redirect digabung dengan helper auth yang sama.
6. Forced ArcGIS auth refresh kini dikongsi melalui satu pending promise untuk elak token-refresh stampede apabila banyak tile gagal serentak.
7. Tile frontend memaparkan status `sedang sambung semula` dan status success bila cadastral layer kembali.
8. Cache-buster `azobss-pa-search.js`, `azobss-lot-kadaster-search.js`, `azobss-lot-selection-map.js` dinaikkan ke `v=1202`.

## Deploy
Perlu deploy kedua-dua:
- GitHub Pages / frontend
- Render backend (`deploy-server.js`)

## Tidak diubah
Harga, cart/payment, strict positive-area selection, natural boundary, DXF/DWG generation, PA/BM membership/access, Commission Manager dan Payout tidak diubah.
