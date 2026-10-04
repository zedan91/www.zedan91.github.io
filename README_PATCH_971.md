# AZOBSS Patch 971 — AZOBSSTV RTM Official Player Fallback

## Punca yang disahkan
- v970 berjaya membezakan kegagalan direct/relay dan menerima HTTP 403 daripada upstream RTM.
- HTTP 403 bermaksud raw CDN endpoint tidak membenarkan request AZOBSSTV seperti URL awam biasa; menambah header lagi bukan penyelesaian yang boleh dipercayai.

## Perubahan
- TV1, TV2, TV OKEY, SUKAN+ dan BERITA RTM ditukar kepada `x-mode="official"`.
- AZOBSSTV tidak lagi cuba memintas 403 raw CDN untuk lima channel RTM tersebut.
- Player area memuatkan halaman channel rasmi Mana-Mana dalam panel iframe dan menyediakan butang `Buka Mana-Mana` serta fallback `Buka RTMKlik`.
- Jika laman penyedia menghalang iframe dengan CSP/X-Frame-Options, butang rasmi masih tersedia untuk buka channel dalam tab baharu.
- TV ALHIJRAH dan TVS kekal direct HLS.
- Relay backend dikekalkan untuk custom/public streams yang memang membenarkan relay; ia tidak digunakan oleh lima RTM entries bundled.
- Tiada cookie, token, auth key, signed URL atau DRM credential ditiru/dijana.

## Cache / version
- App + SW: 1.0.971 / v971.
