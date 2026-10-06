# AZOBSS v1210 — Pakej software universal

Panel besar pembelian AZDM telah dipindahkan ke pilihan pakej pada kad software biasa. Add/Edit Software mempunyai tetapan per item yang boleh digunakan untuk software lain.

## Mengubah pakej

1. Buka Software, tekan ikon Edit pada kad atau Add Software Item.
2. Aktifkan **Pakej & bilangan PC**.
3. Pilih **Pembelian & download software** untuk jualan software biasa, atau **Serial lesen AZDM** untuk lesen AZDM.
4. Tambah sehingga 10 pakej. Nama, harga, tempoh dan bilangan PC boleh diubah kemudian.
5. **PC 0**: customer pilih bilangan PC, harga ialah setiap PC. **PC tetap** seperti 3: harga ialah jumlah pakej. Contoh: 3 PC, RM100.
6. Tempoh 0 bermaksud tiada tamat; tempoh lain menggunakan hari. Untuk pembelian download biasa, tempoh ialah maklumat pakej; software tersebut perlu mengurus lesen sendiri. Tempoh serial AZDM dikuatkuasakan oleh servis lesen AZDM.
7. Diskaun kuantiti pilihan digunakan untuk pakej tiada tamat dengan PC pilihan customer. Minimum 0 mematikan diskaun.
8. Maksimum PC setiap pembelian boleh ditetapkan sehingga 100.
9. Simpan. Customer menekan **Pilihan pakej** pada kad untuk melihat tetapan semasa dari server dan membayar menggunakan akaun AZOBSS.

Harga pakej mesti disimpan pada katalog, bukan ditentukan oleh browser customer. Perubahan harga tidak mengubah bil yang sudah dikeluarkan atau lesen lama; pembelian baru menggunakan tetapan baru. Pakej yang dinyahaktifkan tidak lagi ditawarkan pada kad.

## Support

Toggle **Paparkan butang Support** boleh ditetapkan bagi setiap item. Butang itu membuka email zedan9107@gmail.com, WhatsApp +601135600723, dan chat support AZOBSS. Nama software disertakan dalam pautan email/WhatsApp.

## Harga awal AZDM

- 1 Tahun: RM25 setiap PC.
- Lifetime 1 PC: RM50.
- Lifetime 2 PC atau lebih dalam satu pembelian: RM40 setiap PC.

## Keadaan servis

Checkout software biasa menggunakan servis ToyyibPay/download sedia ada. Pembelian serial AZDM dan email automatik kekal belum dibuka sehingga konfigurasi ToyyibPay, penghantar email dan rahsia sambungan lengkap. Butang pembayaran menunjukkan keadaan sebenar servis. Kemas kini ini tidak menghantar email atau membuat bayaran sebenar.

Cloudflare v1210 menambah migration 0004_package_terms.sql sahaja kepada struktur pesanan sedia ada. Kolum tempoh pakej baru membolehkan tempoh bebas tanpa menukar rekod, CHECK asal atau hubungan lesen lama. Jangan menukar kunci tandatangan atau token admin sedia ada. SHOP_ENABLED kekal false dalam konfigurasi penghantaran.

Website ZIP lengkap disimpan terus dalam folder Github Zip Store. Tiada fail diekstrak dalam folder itu.
