# AZOBSS Patch 926 — Strict Reference Intersection + Natural Lot Geometry

- Membetulkan drawing yang masih mengandungi lot luar yang langsung tidak bersilang dengan petak/bulatan rujukan.
- Punca utama v925: input GP `layer URL + filter OBJECTID` boleh diterima oleh JUPEM tetapi filter tersebut boleh diabaikan. Oleh sebab AOI eksport ialah envelope berpadding, lot lain di dalam envelope turut boleh masuk ke SHP.
- v926 tidak lagi menggunakan `layer URL + filter` untuk `Layers_to_Clip`. Backend menghantar **feature set tepat bagi lot terpilih sahaja**.
- Ditambah semakan geometri kedua di backend: setiap lot daripada JUPEM diuji semula terhadap polygon rujukan sebenar (inside / boundary intersection / reference-inside-lot). Lot yang hanya berada dalam bounding box tetapi tidak benar-benar bersilang akan dibuang.
- Lot di dalam petak/bulatan kekal dipilih. Lot yang melintasi garisan biru juga dipilih dan **geometri lot penuh/natural dikekalkan**. Lot di luar yang tidak menyentuh atau masuk kawasan tidak akan dihantar ke drawing.
- Capabilities dinaikkan ke v5: `exportMode=natural-exact-selected-lots-v926`, `strictReferenceIntersection=true`, `exactSelectedFeatureSetExport=true`, `naturalLotGeometry=true`, `exactBoundaryClip=false`.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=926`.
- Render backend perlu redeploy kerana pembetulan utama berada dalam `deploy-server.js`.
