# Patch 922 — Large Radius Lot Drawing Export Fix

- Membetulkan isu apabila kawasan rujukan bulatan/petak yang besar memilih banyak lot pada peta tetapi drawing/ZIP JUPEM yang dibuka hanya mengandungi beberapa polygon.
- Punca sebenar berada pada penghantaran ArcGIS GP **Extract Data / Clip-and-Ship**: versi lama menghantar `Layers_to_Clip=[]` dan menghantar ribuan feature lot sebagai `Area_of_Interest`. Untuk kawasan besar, output boleh menjadi hanya beberapa polygon terlarut/terpotong.
- v922 menggunakan kontrak GP yang betul: **lapisan Lot Kadaster sebenar** dihantar melalui `Layers_to_Clip`, manakala bulatan/petak/polygon yang pengguna lukis dihantar sebagai satu `Area_of_Interest` polygon.
- Nama lapisan eksport tidak di-hardcode. Backend membaca parameter `Layers_to_Clip` daripada metadata GP JUPEM; jika metadata GP tidak memberikan nama, ia fallback kepada nama layer daripada `Produk_Kadaster/MapServer/<lotLayer>`.
- Ditambah `/api/jupem-lot-selection/capabilities` v2 dan frontend membuat preflight sebelum `prepare`, supaya backend lama tidak digunakan tanpa disedari.
- Response/token Lot Kadaster menyimpan `exportMode=clip-layer-by-aoi-v922`.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=922`.

Render backend perlu redeploy kerana pembetulan utama berada dalam `deploy-server.js`.
