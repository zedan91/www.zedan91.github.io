AZOBSS Firefox WhatsApp PDF Bridge v1318
========================================

Tujuan
------
Membolehkan Firefox menghantar invoice/receipt AZOBSS sebagai PHYSICAL PDF melalui WhatsApp Web.
PDF dijana terus di browser AZOBSS dan dihantar secara lokal kepada extension. Customer tidak menerima temporary Render link.

Cara test/install dalam Firefox
-------------------------------
1. Buka Firefox dan taip: about:debugging#/runtime/this-firefox
2. Klik "Load Temporary Add-on..."
3. Pilih fail manifest.json di folder:
   azobss-firefox-whatsapp-pdf-bridge
   ATAU pilih fail AZOBSS-Firefox-WhatsApp-PDF-Bridge-v1318.xpi jika disediakan.
4. Buka semula https://www.azobss.com/admin/
5. Share Invoice/Receipt.
6. Dalam Firefox, butang akan menunjukkan "Firefox: Physical PDF -> WhatsApp Web" apabila bridge dikesan.
7. Klik butang itu. WhatsApp Web akan dibuka, PDF sebenar dilampirkan, caption diisi, kemudian SEMAK PREVIEW dan tekan Send.

Penting
-------
- Kamu mesti sudah login ke https://web.whatsapp.com/ dalam Firefox.
- Firefox "Temporary Add-on" akan hilang selepas Firefox ditutup/restart. Untuk pemasangan kekal di Firefox release, extension perlu ditandatangani (signed) oleh Mozilla atau dipasang melalui polisi enterprise yang sesuai.
- Extension tidak memuat naik PDF ke Render untuk flow Firefox ini.
- Extension hanya aktif pada AZOBSS Admin dan WhatsApp Web.
- Extension TIDAK auto tekan Send. Ia berhenti pada preview supaya kamu boleh semak customer, PDF dan caption dahulu.

Jika WhatsApp mengubah UI
--------------------------
Jika attachment gagal selepas update WhatsApp Web, AZOBSS akan tunjuk mesej error. Kamu masih boleh guna Download PDF sebagai fallback sementara selector extension dikemas kini.
