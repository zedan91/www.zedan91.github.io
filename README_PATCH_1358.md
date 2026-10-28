# AZOBSS v1358 — Software Key / Digital Access + Ebook Access Manager

Built after v1357 Stripe Actual Fee Sync.

- Admin nav/page renamed from `Software Key` to `Software Key / Digital Access`.
- Added third product tab: `Ebook Access` beside AZDM and SurveyCAD.
- Ebook Access manager lists lifetime RM19 purchasers with username, UID, email/phone, purchase time, gateway, bill/payment ref and Order ID.
- Search, sort, pagination, totals, Active and Revoked KPIs.
- Admin can `Sekat` or `Pulihkan` Ebook Generator access without deleting the purchase record.
- Revoked entitlement is authoritative: paid-order recovery will NOT silently re-enable an admin-revoked account.
- Legacy paid Ebook Generator orders missing an entitlement are recovered into the management list.
- v1357 Stripe real-fee sync/backfill remains included.
