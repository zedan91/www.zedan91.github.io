# AZOBSS Patch 923 — Precise Reference Boundary Selection / Drawing Clip

- Baseline: v922.
- Pemilihan Bulatan/Petak masih menggunakan lot yang bersilang untuk kiraan lot, tetapi geometri drawing kini dipotong tepat pada garisan bentuk rujukan yang dilukis.
- `Layers_to_Clip` tidak lagi dihantar sebagai senarai nama layer. Backend kini menghantar input ArcGIS `GPFeatureRecordSetLayer` menggunakan URL layer Lot Kadaster JUPEM sebenar, dengan fallback kepada feature set lot yang telah di-query.
- `Area_of_Interest` dibina sebagai FeatureSet polygon WGS84 lengkap dan menggunakan ring yang sama dengan garisan Bulatan/Petak pada peta.
- Endpoint capabilities dinaikkan kepada v3 dan `exportMode=exact-boundary-clip-v923`; frontend menolak backend lama sebelum menyediakan drawing.
- UI menerangkan bahawa drawing akan dipotong tepat pada garisan rujukan.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=923`.
- Render backend mesti redeploy selepas patch ini.
