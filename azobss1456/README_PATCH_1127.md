# AZOBSS v1127 — PA / Lot Exact-Pair Resolver Fix

Package version: 1.0.1127
Date: 2026-09-15
Baseline: v1126

## Fix

Peta Pilihan PA kini hanya memaparkan geometri lot yang benar-benar sepadan dengan Nombor PA yang dicari.

Sebelum ini, apabila satu PA menyenaraikan nombor lot yang pendek / biasa seperti Lot 1, 2, 3, 4, 5, resolver geometri boleh mengambil lot bernombor sama dari mukim/seksyen lain apabila padanan PA tepat tidak dijumpai. Selepas itu row tersebut dilabel semula dengan PA yang dicari, menyebabkan silang pautan seperti PA820 • Lot 5 tetapi geometri sebenar ialah PA8158 • Lot 5.

v1127 membetulkan perkara ini dengan:

- exact PA + exact Lot diwajibkan untuk carian yang bermula daripada Nombor PA;
- carian Lot Kadaster digunakan dahulu untuk mendapatkan object ID/map target bagi pasangan PA+Lot yang tepat;
- query geometri tidak lagi fallback kepada lot bernombor sama yang mempunyai PA lain;
- fallback HTML juga hanya menerima row lot yang mempunyai PA tepat;
- final safety gate membuang geometri jika atributnya secara jelas menunjukkan PA berlainan;
- jika sesuatu lot dalam PA lama tidak lagi boleh dipadankan dengan selamat, lot itu tidak dipaparkan daripada menunjukkan lokasi yang salah.

Contoh sasaran regression:

- Carian PA820, Kelantan: Lot 69 / Lot 2 yang benar-benar PA820 kekal.
- Lot 5 yang sebenarnya PA8158 tidak boleh dipaparkan sebagai PA820.
- Lot 4 yang sebenarnya PA51778 tidak boleh dipaparkan sebagai PA820.

## Deploy

Perubahan backend sahaja. Redeploy Render/backend diperlukan. Frontend v1126 boleh kekal; refresh halaman selepas backend siap.
