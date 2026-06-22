# (268)-AZOBSS-PROMO-PRICE-BUTTON-ONLY-UI-FIX_20260622

Patch kecil selepas (267).

## Tujuan
Buang paparan harga final promo yang berdiri sendiri di atas button supaya mobile card tidak nampak bertindih/sekerat.

## Perubahan
- Software Tools: promo block kini hanya papar harga asal dipalang + badge Save %.
- CAD Tools: promo block kini hanya papar harga asal dipalang + badge Save %.
- Harga final kekal dipaparkan dalam button Buy Now sahaja, contoh `RM20 Buy Now`.
- Tambah CSS safety `.az-promo-no-sale-text` supaya `.az-price-new` tidak muncul jika ada sisa markup lama.

## Tidak disentuh
- PA/BM paid/verified download flow.
- My Purchases.
- Cart / Like / Bell / Message badge logic.
- Firebase Rules.
- Render ENV.
