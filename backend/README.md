# AZOBSS Lucky Draw Backend for Render

## Deploy
1. Upload folder `backend` ke GitHub repo baru.
2. Render → New Web Service → connect repo.
3. Build Command: `npm install`
4. Start Command: `npm start`

## Environment Variables
- `ADMIN_KEY` = wajib untuk route admin backend. Guna secret panjang/random dan jangan letak dalam source code.
- `PUBLIC_BASE_URL` = URL backend Render, contoh `https://azobss-lucky-draw.onrender.com`
- `CORS_ORIGIN` = `https://azobss.com`
- `TZ` = `Asia/Kuala_Lumpur`

## Frontend
Dalam `website/index.html`, cari:
`window.AZOBSS_LUCKY_DRAW_API`

Tukar URL kepada URL Render sebenar.

## Admin API Key Mode
Route admin backend kini dikunci. Tetapkan `ADMIN_KEY` di Render Environment Variables.

Untuk guna panel admin yang panggil backend, simpan key yang sama di browser admin sahaja:

```js
localStorage.setItem('azobssAdminApiKey','PASTE_ADMIN_KEY_RENDER_DI_SINI')
```

Jika mahu buang semula dari browser:

```js
localStorage.removeItem('azobssAdminApiKey')
```

Jangan letak nilai sebenar `ADMIN_KEY` dalam HTML/JS repo.


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
