# Patch 839 — Mandatory Customer Email

- Medan `E-mel` pada `/Tempah-Servis-IT/` kini wajib diisi.
- Label `E-mel (opsyenal)` ditukar kepada `E-mel *`.
- Input menggunakan validasi HTML `required` + `type=email`.
- Backend `/api/service-bookings` turut menolak tempahan tanpa e-mel atau format e-mel tidak sah.
- Semua fungsi daripada patch 838 dikekalkan.
