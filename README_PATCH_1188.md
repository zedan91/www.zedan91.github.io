# AZOBSS v1188 — Software Tools Staff / Manager Share Commission

- Staff and Manager are eligible share-commission roles.
- Added a Staff/Manager-only **Share Software Tools & Earn** control on `/Software-Tools/`.
- Catalog share link format: `/Software-Tools/?ref=<username>&src=staff-manager-share`.
- A catalog referral applies to paid software opened from that shared catalog link and is retained locally for up to 30 days.
- Product-specific share links continue to take priority.
- Commission rules remain:
  - 20% to Staff/Manager sharer for paid AZOBSS/admin-owned products.
  - 10% to Staff/Manager sharer for paid products owned by another normal Staff account.
  - Existing semi-admin-owner split policy remains unchanged.
- Backend now verifies the sharer against the Firestore `users` role before creating any share commission record. Normal User referrals cannot generate share commission.
- Manager is now included in staff-dashboard backend access so a Manager can access permitted commission views.
- Existing self-referral and product-owner self-share protection remains.
