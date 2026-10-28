# AZOBSS Patch 872 — Unicode MP3 Download Header + Full Sound Titles

- Fixes `/api/sound-effects/download` error `Invalid character in header content [Content-Disposition]` for sound names containing curly quotes, Japanese/Chinese text, emoji or other Unicode characters.
- Uses an ASCII-safe `filename=` fallback plus RFC 5987 `filename*=UTF-8''...` for the original Unicode filename.
- Keeps forced MP3 download through the AZOBSS Render gateway.
- Sound titles are no longer clamped to two lines or shown with `...`; the full title wraps inside the card.
- Cards use flex layout so short-title cards keep the play area/action row aligned while long titles can grow vertically.
- Multi-select download, infinite scroll, Recent update, category repair and single-play are retained from previous patches.
- Render backend must be redeployed for the Content-Disposition fix to take effect.
