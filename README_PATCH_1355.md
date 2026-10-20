# AZOBSS v1355 — Canonical WWW + Lifetime Access Session Fix

- Enforces `https://www.azobss.com` as the single production origin; `https://azobss.com/...` redirects while preserving path, query and hash.
- Prevents Firebase local login persistence from being split across `azobss.com` and `www.azobss.com`.
- Ebook Generator now shows a neutral “Menyemak akses akaun...” state while Firebase auth is restoring instead of briefly showing the RM19 paywall.
- If signed out, the paywall explicitly says existing buyers should login with the same account and **must not pay again**.
- Ebook access is rechecked after the global auth state becomes ready, on `pageshow`, and when the tab regains focus.
- Lifetime entitlement remains server/account based. No local-only unlock was introduced.
- Based on v1354; checkout de-duplication and Sales & Receipts cleanup remain intact.
