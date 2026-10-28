# AZOBSS Patch 782

## Live Location Suggestions

- Carian lokasi dalam modal kini memaparkan senarai cadangan secara automatik semasa pelanggan menaip, seperti carian Google Maps. Cadangan live menggunakan Photon yang memang direka untuk search-as-you-type; reverse geocoding peta kekal menggunakan OpenStreetMap/Nominatim hanya selepas pengguna memilih titik.
- Carian bermula selepas sekurang-kurangnya 2 aksara dengan debounce 500 ms untuk mengurangkan permintaan API.
- Senarai menunjukkan nama tempat, alamat penuh, jarak dari kedai AZOBSS dan label lokasi di luar radius 10 km.
- Hasil dalam radius servis disusun dahulu, diikuti lokasi terdekat.
- Sokongan papan kekunci: Arrow Up/Down, Enter dan Escape.
- Butang Cari Lokasi masih tersedia untuk carian manual.
- Peta, pin, Lokasi Semasa, WGS84 tersembunyi, validasi radius frontend/backend, WhatsApp dan Admin dikekalkan.
