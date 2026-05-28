# AZOBSS All-In-One GitHub + Render Setup

Folder ini boleh terus replace/paste ke repo:

www.zedan91.github.io

Struktur:
- index.html + assets = GitHub Pages website
- backend/ = Render backend API
- render.yaml = Render blueprint direct dari repo sama

## Cara guna

1. Copy semua isi ZIP ini ke folder:
   Documents/GitHub/www.zedan91.github.io

2. Commit & push ke GitHub.

3. Di Render:
   - New > Blueprint
   - pilih repo `www.zedan91.github.io`
   - Render akan baca `render.yaml`
   - service akan guna folder `/backend`

4. Set Environment Variables di Render:
   - ADMIN_KEY = optional sahaja, versi ini NO PASSWORD MODE
   - PUBLIC_BASE_URL = URL Render backend selepas deploy
   - CORS_ORIGIN = https://azobss.com
   - TZ = Asia/Kuala_Lumpur

5. Selepas Render backend siap:
   buka `index.html`
   cari:
   window.AZOBSS_LUCKY_DRAW_API

   Tukar kepada URL Render backend sebenar.
   Contoh:
   window.AZOBSS_LUCKY_DRAW_API = 'https://azobss-lucky-draw-backend.onrender.com';

## Nota penting
GitHub Pages hanya guna file website.
Render hanya guna folder backend.
Jadi kedua-duanya boleh duduk dalam repo yang sama tanpa kacau antara satu sama lain.


## NetworkError Fix
Jika keluar `NetworkError when attempting to fetch resource`, tekan button `Set Backend URL` di admin prize panel dan masukkan URL Render backend sebenar, contoh:
`https://azobss-lucky-draw-backend-xxxx.onrender.com`

Render `CORS_ORIGIN` dalam ZIP ini diset kepada `*` supaya GitHub Pages/custom domain lebih mudah connect.
