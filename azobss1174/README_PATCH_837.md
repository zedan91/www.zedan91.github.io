# Patch 837 — Permintaan Tambahan 70 Aksara

- Mengehadkan medan `Permintaan tambahan (opsyenal)` kepada maksimum 70 aksara pada borang Tempah Servis IT.
- Frontend memotong nilai kepada 70 aksara sebagai perlindungan tambahan.
- Backend turut mengehadkan `extraRequests` kepada 70 aksara supaya had tidak boleh dipintas melalui request manual.
- Semua fungsi daripada patch 836 dikekalkan.
