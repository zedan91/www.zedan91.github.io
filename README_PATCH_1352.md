# AZOBSS v1352 — Ebook Login Return Fix

- Fix Ebook paywall Login/Register flow returning to Home after authentication.
- `?next=/Software-Tools/#ebook` is now consumed after successful password or Google login.
- Safe same-origin relative redirect validation prevents open redirects.
- Return target is kept in sessionStorage + localStorage so register/email verification flow can recover it.
- Verification email return preserves the `next` destination and opens login; successful login then returns to Ebook.
- Global auth cache-bust updated to v1352.
- All v1351 RM19 lifetime entitlement/payment logic remains unchanged.
