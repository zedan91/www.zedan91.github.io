AZOBSS WhatsApp Tab Reuse & PDF Bridge v1545 (1.1.0)

Pasang dalam Firefox yang sama dengan WhatsApp Web:
1. Buka about:debugging#/runtime/this-firefox
2. Klik Load Temporary Add-on...
3. Pilih AZOBSS-Firefox-WhatsApp-Bridge-v1545.zip (manifest.json berada di root ZIP).
4. Refresh tab AZOBSS Admin dan WhatsApp Web sekali.
5. Klik WhatsApp Customer. Tab WhatsApp sedia ada digunakan semula.

Jika tiada tab WhatsApp dalam private/container yang sama, satu tab dicipta.
Klik berulang tidak mencipta tab tambahan. Tab di browser/profil lain tidak
boleh digunakan semula. Tiada teks ditambah dan tiada Send ditekan automatik.
Jika WhatsApp menunjukkan konflik sesi atau ada draf/attachment belum selesai,
selesaikan keadaan itu dalam tab WhatsApp; extension tidak menutup tab anda.

Kebenaran tabs dan cookies digunakan untuk metadata tab/container. Kod tidak
membaca nilai cookies atau menghantar kandungan chat ke AZOBSS/backend.
Akses halaman hanya AZOBSS Admin dan WhatsApp Web.
PDF lama kekal berhenti pada preview; admin sendiri menekan Send.

Pemasangan sementara hilang apabila Firefox ditutup. Untuk pemasangan kekal
dalam Firefox biasa, extension perlu ditandatangani oleh Mozilla. Jangan ubah
atau matikan semakan tandatangan Firefox. ZIP ini belum ditandatangani.
Panduan: https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/
