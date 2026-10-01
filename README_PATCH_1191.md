# AZOBSS v1191 — Compact Staff Dashboard 4-Tab UX

Baseline: v1190.

## Changes
- Compact desktop Staff Dashboard: narrower sidebar, tighter spacing, smaller cards and controls.
- Overview redesigned into 6 primary KPIs; secondary details moved into collapsible panels so nothing is removed.
- Added Unique Sales value and Approved / Ready-to-Pay commission KPI.
- Sales View adds compact KPI summary, search, payout-status filter and sale-type filter.
- Share Link adds direct Software/CAD referral links, Copy/Share actions, compact KPI summary, search/status filters and per-product Copy Link.
- Payout adds compact balance KPIs, Ready-to-Pay inline value, collapsible payout profile, request area, request history and full commission history.
- Payout refresh now refreshes payout records, profile and payout requests together.
- Fixed payout-request eligibility calculation so filtering the history list does not hide approved commission from the Request Payout calculation.
- Friendly loading, empty and error states; labels standardized toward Malay while preserving existing backend fields and commission logic.
- No backend schema changes required; v1189/v1190 protected APIs remain compatible.

## Safety / scope
- Staff/Manager still only see their own scoped data.
- PA/BM remains excluded from Software/CAD staff commission.
- Existing payout profile/request API and audit-safe workflow are preserved.
