# AZOBSS Patch 1199 — Staff Dashboard Click Reliability

- Fix global role navbar sync so visible Admin/Staff dashboard buttons always receive `pointer-events:auto !important`.
- Add authoritative `body.az-role-is-admin` / `body.az-role-is-staff` classes from live auth state.
- Hidden role buttons receive `pointer-events:none`, `aria-hidden=true`, and `tabindex=-1`.
- Fixes Staff Dashboard icon appearing visible but not clickable from PC & IT Services and other pages that do not have an extra page-local role sync.
- Global auth cache-buster raised to v1199 across website pages.
- Keeps v1198 scalable Commission Manager and v1197 payout QR crop editor unchanged.
