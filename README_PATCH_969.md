# AZOBSS Patch 969 — AZOBSSTV Relay Query Parser + RTM Request Compatibility Fix

## Punca HTTP 400 sebenar
`deploy-server.js` menggunakan `url.parse(req.url, true)`, yang menyediakan query pada `parsed.query`.
Handler AZOBSSTV v968 pula membaca hanya `parsed.searchParams`, jadi parameter `url=` untuk `/api/azobsstv/stream` sentiasa dianggap kosong dan backend sendiri membalas HTTP 400 sebelum cuba mengambil stream.

## Fix
- Tambah helper query yang menyokong kedua-dua WHATWG `URLSearchParams` dan legacy Node `url.parse(..., true).query`.
- `/api/azobsstv/stream?url=...` kini menerima URL encoded dengan betul pada backend AZOBSS sebenar.
- Untuk host RTM CDN yang sudah di-hardcode sahaja, relay menghantar `Referer: https://rtmklik.rtm.gov.my/` bagi keserasian dengan request public player RTMKlik.
- Tiada cookie, token, auth key, password atau DRM key ditambah. Relay kekal bukan open proxy.
- Health endpoint melaporkan `stream_query_parser: node-url-parse-compatible`.
- Cache/service worker/app version dinaikkan ke 969.

## Tidak disentuh
PA/BM, JUPEM, payment, CAD converter, Repair PC, auth, More menu dan katalog 25 channel Mana-Mana.
