# AZOBSS Lucky Draw Backend for Render

## Deploy
1. Upload folder `backend` ke GitHub repo baru.
2. Render → New Web Service → connect repo.
3. Build Command: `npm install`
4. Start Command: `npm start`

## Environment Variables
- `ADMIN_KEY` = optional sahaja, versi ini NO PASSWORD MODE
- `PUBLIC_BASE_URL` = URL backend Render, contoh `https://azobss-lucky-draw.onrender.com`
- `CORS_ORIGIN` = `https://azobss.com`
- `TZ` = `Asia/Kuala_Lumpur`

## Frontend
Dalam `website/index.html`, cari:
`window.AZOBSS_LUCKY_DRAW_API`

Tukar URL kepada URL Render sebenar.

## No Password Mode
Versi ini tidak akan minta ADMIN_KEY. Pastikan `CORS_ORIGIN` di Render ditetapkan kepada domain website anda sahaja, contoh `https://azobss.com`.


## NetworkError Fix
Jika keluar `NetworkError when attempting to fetch resource`, tekan button `Set Backend URL` di admin prize panel dan masukkan URL Render backend sebenar, contoh:
`https://azobss-lucky-draw-backend-xxxx.onrender.com`

Render `CORS_ORIGIN` dalam ZIP ini diset kepada `*` supaya GitHub Pages/custom domain lebih mudah connect.


## Fix included
This version adds:
- GET `/` root info endpoint
- GET `/api/prize` endpoint
- ES module-safe code only, no `require()`
- `image` and `imageUrl` compatibility
