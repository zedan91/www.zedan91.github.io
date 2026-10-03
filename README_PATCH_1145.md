# AZOBSS v1145 — PA/BM Auto Wake Backend On Entry

Baseline: v1144.

Perubahan:
- Apabila `https://www.azobss.com/PA-BM/` mula dibuka, browser terus menghantar GET quota-free ke `https://azobss-backend.onrender.com/health`.
- Request wake dimulakan dari `<head>` supaya Render mula bangun seawal mungkin, sebelum user sampai ke senarai pembelian atau menekan Download.
- Ditambah `preconnect` ke host Render untuk mula DNS/TCP/TLS lebih awal.
- Wake request adalah fire-and-forget dan tidak memaparkan popup/spinner page.
- Ia tidak memanggil endpoint download dan tidak menggunakan quota 5 kali.
- Jika user tekan Download sebelum cold start selesai, spinner dalam button v1144 masih mengambil alih sehingga backend ready.
- Endpoint kekal `/health` seperti backend semasa.
- Frontend sahaja; backend tidak perlu redeploy.
