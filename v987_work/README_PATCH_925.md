# AZOBSS Patch 925 — Natural Lot Geometry Export

- Garisan Bulatan/Petak/Polygon kini digunakan untuk **memilih lot yang bersilang sahaja**.
- Drawing akhir **tidak lagi dipotong pada garisan biru rujukan**. Setiap lot terpilih dikekalkan dengan sempadan/geometri kadaster asal sepenuhnya.
- Backend menghantar layer Lot Kadaster JUPEM dengan filter OBJECTID untuk lot terpilih sahaja. Ini mengelakkan lot lain dalam bounding box turut masuk.
- `Area_of_Interest` GP ditukar kepada envelope berpadding yang meliputi keseluruhan geometri lot terpilih supaya proses JUPEM tidak memotong lot di tepi.
- Fallback masih menggunakan feature set penuh lot terpilih jika input URL+filter ditolak oleh task JUPEM.
- Capabilities dinaikkan ke v4: `exportMode=natural-selected-lots-v925`, `naturalLotGeometry=true`, `exactBoundaryClip=false`.
- UI menerangkan bahawa lot yang bersilang akan dipilih tetapi drawing mengekalkan sempadan lot asal.
- Cache `azobss-lot-selection-map.js` dinaikkan ke `v=925`.
- Render backend perlu redeploy kerana perubahan eksport berada dalam `deploy-server.js`.
