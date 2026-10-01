# AZOBSS Patch 968 — AZOBSSTV RTM Browser CORS / Stream Relay Fix

## Punca
Screenshot v967 mengesahkan overlay player sudah hilang, tetapi `dash.js` melaporkan `manifest.mpd is not available`. Stream RTM masih aktif di luar browser, jadi kegagalan ini sepadan dengan akses cross-origin/browser pada manifest CDN, bukan event klik UI.

## Fix
- Tukar 5 entry RTM bawaan daripada DASH `.mpd` kepada HLS rasmi CDN (`playlist.m3u8?id=1..5`).
- Entry RTM ditanda `x-mode="proxy"`.
- Tambah endpoint `GET /api/azobsstv/stream?url=...` untuk HLS relay same-origin.
- Relay hanya menerima host CDN RTM yang di-hardcode; bukan open proxy.
- Tidak menambah Referer palsu, token, credential atau DRM key. Jika upstream sendiri 401/403/offline, AZOBSSTV tetap gagal dengan diagnostics.
- HLS manifest direwrite secara rekursif supaya variant playlist, segment, key/map URI melalui relay yang sama dan bebas CORS browser.
- Range/Content-Range dipassthrough untuk media binary.
- Cache/service worker/version dinaikkan ke 968.

## Tidak diubah
- 25 kad katalog Mana-Mana dikekalkan.
- TV ALHIJRAH dan TVS kekal direct; channel web-only kekal buka halaman rasmi Mana-Mana.
- PA/BM, JUPEM, payment, CAD converter, Repair PC, auth dan More menu tidak disentuh.
