# AZOBSS v1335 — Affiliate Shop Rating & Sold Sync

- Fix paparan `— sold`: sold hanya dipaparkan apabila nilai jualan sebenar tersedia.
- Shopee JSON import membaca `historical_sold`, `historicalSold`, `shopeeSold`, `soldCount`, `sold_count`, `sold`, `historical_sold_text`, dan `sold_text`.
- Import semula produk dengan Shop ID + Item ID yang sama akan update rekod Firestore sedia ada dan menyelaraskan harga, rating, jumlah penilaian dan sold.
- Matching produk lama diperluas kepada logical ID `shopee:MY:<shopId>:<itemId>` selain `shopeeKey`/Shop ID/Item ID/retail URL.
- Rating + sold dipaparkan dalam format marketplace, contoh `★ 4.9 (387K) • 1M sold`.
- Count formatter menyokong nombor penuh serta format K/M.
- Semua fungsi v1334/v1333/v1332/v1330/v1328 dikekalkan.
