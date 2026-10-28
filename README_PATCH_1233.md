# AZOBSS v1233 — Commission Eligible Labels + AZDM Referral Commission

- Staff Dashboard now explains that only paid Software Tools cards marked **Commission Eligible** can earn referral commission.
- Free software is explicitly excluded from commission.
- Every paid/premium Software Tools card shows a **💰 Commission Eligible** badge, except while a premium item is in an active free-promo state.
- AZOBSS Download Manager (AZDM) package checkout now carries the Staff/Manager referral into the trusted backend order.
- Referral username is sanitized server-side and still verified against the Firestore user role before commission is created.
- Existing paid-order commission finalization now gives the normal admin/AZOBSS product share rate (20% sharer / 80% AZOBSS) for AZDM referral purchases.
- Other staff-owned/semi-admin commission rules remain unchanged.
