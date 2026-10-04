# AZOBSS v1208 — Software Key: SurveyCAD / AZDM

Dibina daripada pakej v1207 dalam chat ini, yang menggunakan ZIP asal v1206 owner. Semua perubahan pakej lesen, harga dan support v1207 disertakan.

Di `www.azobss.com/admin/`, bahagian **Software Key** kini mempunyai dua butang tab sebelah-sebelah:

- **SurveyCAD**: rekod asal, carian, susunan, Edit, Add Manual, Delete, pagination dan Export CSV. Tab ini dipilih secara default.
- **AZDM**: senarai lesen AZDM, keluarkan serial manual, carian/pagination, Edit nama/tarikh tamat, Lifetime, Reset PC, Sekat/Buka sekatan dan rekod pesanan/email. Serial baru boleh disalin atau disimpan sebagai `.txt` ketika dikeluarkan.

Data kedua-dua program kekal dalam sumber masing-masing. Membuka tab AZDM tidak menulis atau memadam rekod SurveyCAD. Auto refresh SurveyCAD berjalan hanya ketika tab SurveyCAD kelihatan. Butang tab turut menyokong anak panah kiri/kanan, Home dan End.

Panel AZDM berada dalam halaman AZOBSS yang sama. Link **Buka panel asal AZDM** masih tersedia untuk akses terus ke `https://azdm-license.zedan9107.workers.dev/admin`.

## Pengaktifan sambungan admin

1. Upload/deploy pakej website v1208 ini seperti pakej AZOBSS biasa. Entry point Render kekal `node deploy-server.js`.
2. Dalam **Render → AZOBSS backend → Environment**, tambah `AZDM_ADMIN_TOKEN` dengan kod akses admin AZDM sedia ada yang digunakan di panel asal Cloudflare. Simpan melalui Environment sahaja. Jangan masukkan nilainya dalam HTML, JavaScript, GitHub, ZIP atau chat.
3. `AZDM_LICENSE_URL` menggunakan default `https://azdm-license.zedan9107.workers.dev` jika tiada override. Sambungan admin tidak menggunakan `AZDM_SHOP_SERVICE_TOKEN`; itu ialah sambungan pembelian customer yang berasingan.
4. Login sebagai owner/admin AZOBSS yang dibenarkan oleh allow-list backend. Tetamu, customer dan staff yang tidak dibenarkan tidak boleh mengurus lesen AZDM melalui endpoint ini walaupun mereka mengubah role dalam browser.
5. Setelah Render siap, buka **Admin → Software Key → AZDM → Refresh**. Senarai lesen menggunakan D1 Cloudflare sedia ada. Key dan lesen tidak perlu dipindahkan/import ke SurveyCAD.
6. Senarai pesanan/email memerlukan backend Cloudflare pakej v1207 yang diberikan sebelum ini. Jika endpoint pesanan belum tersedia, pengurusan lesen asas masih boleh berfungsi dan panel memaparkan status pesanan belum tersedia. Rujuk `README_PATCH_1207.md` untuk persediaan ToyyibPay dan email automatik.

Kod akses Cloudflare kekal di server Render; browser menggunakan sesi Firebase admin AZOBSS. Backend menyemak token Firebase termasuk token yang dibatalkan dan allow-list UID/email owner. Tiada kod admin sebenar dimasukkan dalam pakej ini.

## Status ujian dan penerbitan

Pakej belum dideploy ke website atau Render. Ujian dilakukan secara tempatan dengan respons simulasi; tiada serial sebenar dikeluarkan, reset PC production, rekod customer production diubah atau email sebenar dihantar.

- 4 ujian baru bridge admin: owner authorization, rahsia server tidak dipulangkan ke browser, senarai tindakan dibenarkan, penolakan permintaan tidak sah.
- 5 ujian bridge pembelian v1207 lulus semula.
- Ujian browser pada HTML admin sebenar: SurveyCAD/AZDM tab switching, rekod SurveyCAD kekal, serial/dialog, Edit, Reset, Sekat/Buka sekatan, retry email, pagination, keyboard, akaun berubah dan paparan telefon.
- Server sebenar dimulakan secara tempatan: endpoint baru meminta login; endpoint SurveyCAD dan subscription asal masih tersedia.

ZIP website disimpan terus dalam folder `C:\Users\MSI\Downloads\Github Zip Store`. Tiada fail pakej diextract ke folder itu.
