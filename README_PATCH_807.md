# Patch 807 — WhatsApp App Auto-Close Launcher

- Berdasarkan baseline `(806)`.
- Tab perantara `api.whatsapp.com` tidak lagi digunakan sebagai laluan utama apabila aplikasi WhatsApp tersedia.
- Selepas rekod tempahan disimpan atau fallback pantas 2.5 saat dicapai, popup terkawal membuka pautan aplikasi `whatsapp://send` secara terus.
- Apabila aplikasi WhatsApp mengambil fokus / halaman launcher menjadi tersembunyi, tab launcher ditutup secara automatik.
- Jika aplikasi WhatsApp tidak dapat dibuka, launcher memaparkan butang `Teruskan ke WhatsApp Web` dan `Tutup tab`.
- Sistem simpanan background, `clientRequestId`, perlindungan rekod pendua dan semua fungsi patch `(806)` dikekalkan.

> Nota: Browser tidak membenarkan laman AZOBSS membaca status sebenar butang Send di dalam WhatsApp. Oleh itu auto-close berlaku selepas aplikasi WhatsApp berjaya dibuka, bukan selepas server WhatsApp mengesahkan mesej telah dihantar.
