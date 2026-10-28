# AZOBSS v1322 — Tech SolatTime Exact R2 Download

## Punca
`Azobss_SolatTime_Setup.exe` telah di-upload terus melalui Cloudflare R2 Dashboard pada object key:

`software/Azobss_SolatTime_Setup.exe`

Tech Vault biasa menyenaraikan metadata fail yang di-upload melalui flow Tech Vault (`tech-vault/...`), jadi v1321 tidak semestinya nampak fail yang dimasukkan terus ke folder `software/` melalui Cloudflare Dashboard.

## Fix
- Featured card **AZOBSS SolatTime** di `/tech/` kini menggunakan object key R2 rasmi secara terus.
- Object key: `software/Azobss_SolatTime_Setup.exe`
- Download masih private: browser menerima URL `/dl/<signed-token>` daripada Cloudflare Worker, bukan URL bucket/public.
- Endpoint baru: `POST /api/tech-vault/solattime-download`.
- Endpoint kekal dilindungi oleh Tech Vault password session.
- Mapping R2 lama SolatTime yang menunjuk `_v1_0_2.exe` turut dibetulkan ke nama object semasa.
- Fail tidak perlu didaftarkan dalam koleksi `techVaultFiles` untuk shortcut ini.

## Security
Cloudflare Dashboard URL bukan link download untuk pengguna dan tidak digunakan dalam frontend. R2 bucket kekal private.
