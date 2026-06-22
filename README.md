# (296) AZOBSS ToyyibPay Strict Verified Payment Only Fix

Critical security/payment patch.

Fixes:
- Cancelled/abandoned ToyyibPay payment must NOT show Payment Successful popup.
- Cancelled/abandoned ToyyibPay payment must NOT generate/send software download link.
- Receipt/download for Software/CAD premium orders is released only after ToyyibPay API confirms paid.
- Generic `status=success` or API `success:true` is no longer treated as paid.
- Callback trust bypass is disabled unless explicitly enabled by `AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK=1`.
- CAD manual complete purchase button no longer calls backend complete-purchase for normal buyers.

Notes:
- Firebase Rules: no update required.
- Render backend: deploy required because deploy-server.js changed.
- Keep AZOBSS_VERIFY_TOYYIB_CALLBACK default ON.
- Do not set AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK unless emergency.
