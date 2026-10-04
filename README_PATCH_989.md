# AZOBSS Patch v989 — Mana-Mana Current Video Catalogue Auto Sync

## Perubahan
- AZOBSSTV kini mengambil senarai Live TV secara dinamik daripada public catalogue semasa Mana-Mana:
  `GET https://co3y6iwoio.tenbytecdn.com/api/v1/public/channels`
- Backend endpoint baharu:
  `GET /api/azobsstv/mana2/channels`
- Hanya `channelType=video` / `tv` dimasukkan ke tab Live TV.
- `channelType=audio` tidak dicampur ke Live TV; integrasi Radio boleh dibuat berasingan.
- Nama, slug, channel ID, nombor channel dan logo menggunakan metadata public Mana-Mana.
- Semua channel dimainkan melalui halaman rasmi:
  `https://mana2.my/channel/{slug}`
- Duplicate dibuang berdasarkan channel ID.
- Cache catalogue backend: 10 minit.
- Frontend mengambil catalogue semasa setiap kali default AZOBSSTV Free dimuatkan.
- Jika public catalogue gagal, fallback statik 26 channel video hasil Deep Inspector v5 digunakan.
- Fallback M3U frontend/backend juga diselaraskan kepada 26 slug video semasa.
- Existing Public EPG v987, Today's Schedule, NOW PLAYING, single official iframe,
  Favorites/Recent sign-in-only dan Home stickybar kekal.

## Channel video fallback v989
TV1, TV2, TV OKEY, SUKAN+, BERITA RTM, TVS, TV ALHIJRAH, SUKMA 1, SUKMA 2,
FREE MOVIES, MySports, BERNAMA, CNA, The Indonesia Channel,
Al JAZEERA ENGLISH HD, ARIRANG, EURONEWS, TaiwanPlus, DW, NHK WORLD,
RT International, Al JAZEERA ARABIC HD, USIM TV, SELANGOR TV, TVIKIM, SIARA TV.

## Deploy
Deploy website dan Render backend. Dockerfile path fix v988 dikekalkan:
`./render-backend.dockerfile`.
