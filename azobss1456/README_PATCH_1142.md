# AZOBSS v1142 — Download Button Spinner + Correct API Health Wake Fix

Baseline: v1141.

Punca sebenar spinner v1141 boleh nampak seperti stuck:
- v1140/v1141 memanggil `https://azobss-backend.onrender.com/health`.
- Backend sebenar dalam `backend/server.js` menyediakan health endpoint pada `/api/health`.
- Oleh itu frontend boleh menunggu sehingga timeout walaupun backend sebenarnya sudah hidup.

Perubahan v1142:
- Betulkan wake endpoint kepada `/api/health`.
- Buang keseluruhan full-screen blur/modal/spinner overlay.
- Loading hanya dipaparkan sebagai spinner di dalam button Download yang ditekan.
- Administrator `Test ↓` menggunakan spinner button yang sama.
- Health check kekal quota-free dan tidak menambah counter 5 kali.
- Maksimum wake wait 70 saat; setiap request dihadkan maksimum 20 saat dan retry ~0.9 saat.
- Selepas `/api/health` pulangkan `{ok:true}`, barulah endpoint download sebenar dipanggil.
- Jika backend sudah warm, spinner hanya muncul sekejap sebelum download bermula.
- Jika backend cold start, halaman AZOBSS kekal boleh dilihat dan hanya button yang menunjukkan loading.
- Reset 0/5, Test Download, counter exact-once dan Purchase Records fixes terdahulu dikekalkan.

Deploy: frontend sahaja untuk patch ini. Hard refresh `Ctrl + Shift + R` selepas deploy.
