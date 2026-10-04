# AZOBSS Patch 1073 — Google Sign-In + Required Phone Profile

Baseline: v1072

## Added
- **Continue with Google** on Sign in.
- **Sign up with Google** on Register.
- Google identity is authenticated by Firebase Authentication.
- New Google users are created as normal `member` accounts only; Google does not grant PA/BM, Staff or Admin roles.
- If phone is missing, AZOBSS opens a **Complete Profile** modal and requires the phone number once.
- Phone is saved to Firestore `users` as both `phone` and `phoneNumber`.
- Subsequent Google logins skip the phone prompt when a phone already exists.
- Existing PA/BM/role/profile fields are preserved.
- For an older Firebase account whose AZOBSS username cannot be resolved safely, the completion modal asks for the existing AZOBSS username instead of silently creating a duplicate profile.

## Firebase Console setup required once
1. Firebase Console → Authentication → Sign-in method → **Google** → Enable.
2. Authentication → Settings → Authorized domains: make sure `azobss.com` and `www.azobss.com` are present.
3. Save/publish.

No backend, payment, invoice, JUPEM, lot selection or pricing logic was changed.

Package version: `1.0.1073`
