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


## Patch 300 - Admin Payment Logs Pro Filter + Export

- Upgraded Admin > Payment Logs with stronger search, date filter, status filter, CSV export, and View Details modal.
- Keeps PA/BM reset download limit button unchanged.
- No Firebase Rules update required.
- No Render backend deploy required.

PATCH (303) - Premium Orders Firestore Backup / Sync
----------------------------------------------------
- Strengthens Software/CAD premiumOrders persistence with Firestore backup/sync.
- Admin export now merges Firestore + local premium-orders.json.
- Admin Maintenance adds Backup local premiumOrders to Firestore and Restore local premiumOrders from Firestore.
- Firebase Rules update is not required because access uses Render backend Firebase Admin SDK.
- Render backend deploy is required because deploy-server.js changed.
