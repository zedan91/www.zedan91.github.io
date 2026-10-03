# AZOBSS Patch v1012 — Anime Resolver Hard Timeout + Fresh Iframe Race Fix

## Punca yang dikenal pasti daripada screenshot
- Player boleh kekal pada `Checking whether the source allows embedding…` terlalu lama sementara resolver/upstream menunggu.
- v1011 mengosongkan iframe melalui `about:blank` sebelum memasang handler player seterusnya. Event load lama berpotensi berlumba dengan navigasi player baharu dan tidak patut dianggap sebagai bukti player sebenar sudah dimuatkan.
- Semasa semakan, panel terlalu nipis dan kelihatan seperti kosong.

## Fix v1012
- Resolver frontend kini mempunyai request timeout 9.5 saat dan hard UI deadline 10 saat. Selepas itu AZOBSSTV mesti beralih ke fallback; status `Checking…` tidak boleh tergantung tanpa had.
- Setiap percubaan Anime mencipta iframe baharu, jadi tiada stale `about:blank` load event daripada percubaan sebelumnya.
- Semasa resolver berjalan, compact panel memaparkan spinner + `Preparing player…` supaya pengguna nampak ia sedang bekerja.
- Embed watchdog v1011 kekal. Jika URL player yang telah disahkan masih gagal dimuatkan, ia kembali ke fallback.
- Fallback blocked/timeout kekal membuka sumber di tab baharu; AZOBSSTV tidak dinavigasi keluar.
- Tiada bypass X-Frame-Options/CSP, DRM, token atau direct media extraction.
- WCOFun `/anime/` tidak digunakan sebagai nested iframe kerana halaman itu sendiri ialah wrapper kepada domain lain dan menambah satu lagi lapisan cross-origin.

## Version
- AZOBSSTV app version: `1.0.1012`
- Service worker cache: `azobsstv-v1012`
