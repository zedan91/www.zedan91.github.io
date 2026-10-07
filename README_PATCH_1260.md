# AZOBSS Patch 1260 — Secure Firebase Checkout Token Verification Hard Fix

## Fixed
- Fixes `Please login again before proceeding to payment.` when the AZOBSS navbar is already logged in and the browser has a Firebase ID token.
- Root cause addressed on the backend: Firebase Admin verification can reject a legitimate AZOBSS token when the Render Admin project/service-account configuration is mismatched or incomplete; the previous Identity Toolkit fallback can also fail when the Web API key is restricted for server-side use.
- Adds a second independent **cryptographic** verifier for Firebase ID tokens using Google's official Secure Token public certificates. It verifies RS256 signature, `kid`, audience `azobss`, issuer `https://securetoken.google.com/azobss`, subject, expiry, issued-at and auth-time before accepting the identity.
- The existing Firebase Admin verifier stays first, and Identity Toolkit remains the final fallback. No localStorage username or client-submitted user object is accepted as authentication.
- Implemented in both `deploy-server.js` and `backend/server.js`.
- **No PA/BM cart frontend file was changed from v1259**, so the now-working Add-to-Cart behavior is preserved byte-for-byte.

## Deployment
Deploy the full package to Render/backend. A frontend-only upload cannot fix this 401 because the rejection happens at `/api/toyyib/create-pa-bm-bill`.

Package version: `1.0.1260`
