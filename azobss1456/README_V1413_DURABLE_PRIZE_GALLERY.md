# (1413) Durable prize gallery records

Includes the complete v1412 drag/drop gallery manager. Live rollout revealed that
the old prize route used local JSON even though the rest of Lucky Draw used
Firestore. A Render redeploy therefore lost the prize record.

Prize reads, gallery saves, folder sync and the legacy /api/prize alias now share
the same prize store. With the existing Lucky Draw Firestore configuration,
records live in luckyDrawPrizes/{YYYY-MM} and survive a fresh deployment without
local files. A valid current-month legacy local record migrates once; a transaction
prevents it overwriting a concurrent durable save. Database errors fail the save
instead of silently falling back to temporary JSON. JSON-only deployments retain
an atomic local fallback and show an explicit admin warning.

Image uploads still reuse the existing Cloudinary configuration. The frontend
warns if an image falls back to temporary backend storage. No new credentials,
client database permissions, participation rules, draw results or payments change.
19 targeted tests cover gallery ordering, the production save handler, durable
record reads after recreation, migration, failures and existing Lucky Draw rules.

Full website ZIP only. The current Philips cooker gallery is restored through
the authenticated admin interface after the durable backend is live.
