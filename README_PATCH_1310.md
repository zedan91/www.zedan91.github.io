# AZOBSS v1310 — Homepage Banner Permanent Delete

Date: 2026-10-14
Package: 1.0.1310
Baseline: v1309

## Masalah
Banner asal Exabytes dianggap sebagai built-in banner. Sebab itu Homepage Banner Manager hanya memberi `Hide Banner`. Walaupun rekod Firestore dibuang, kod fallback akan mencipta semula banner tersebut pada reload.

## Fix
- Banner Exabytes kini mempunyai tindakan `Delete Banner`, bukan `Hide Banner`.
- Delete memadam banner terus daripada paparan dan dropdown Admin.
- Untuk banner seed/hardcoded seperti Exabytes, sistem menyimpan tombstone kecil `deleted:true` dalam `homeBanners` supaya banner tidak dicipta semula selepas refresh, browser lain atau deploy seterusnya.
- Custom banner terus menggunakan Firestore `deleteDoc()` sebenar.
- `Software Promo (Auto)` dan `Monthly Lucky Draw` kekal sebagai system-managed banner dan masih menggunakan `Hide Banner`, supaya komponen sistem tidak terpadam secara tidak sengaja.
- `Paparkan banner` + `Simpan` masih boleh digunakan untuk show/hide banner yang bukan dipadam.
- Selepas delete, pilihan Admin berpindah automatik ke banner seterusnya dan UI terus refresh.

## Firebase
Rules sedia ada sudah membenarkan Administrator create/update/delete pada `/homeBanners/{bannerId}`, jadi tiada rules baru diperlukan.
