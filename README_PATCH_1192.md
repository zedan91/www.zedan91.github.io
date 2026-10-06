# AZOBSS v1192 — Staff ↔ Admin Commission Link Sync

This patch explicitly links the four compact Staff Dashboard views with Admin > Commission Manager.

## Staff Dashboard
- Overview ↔ Admin Commission Summary
- Sales View ↔ Admin owner-sale commission records
- Share Link ↔ Admin referral/share commission records
- Payout ↔ Admin Payout Requests
- `?tab=overview|sales|share|payout` deep links are supported.
- Sales and Share rows can jump across related views using the same Order ID.

## Admin Commission Manager
- Staff/Manager summary cards now include Overview / Sales / Share / Payout context buttons.
- Selected Staff context is visible and retained in URL: `?tab=commissions&staff=<username>&mode=<view>`.
- Sales context filters owner-sale records.
- Share context filters referral records.
- Payout context filters payout requests for the same Staff/Manager and scrolls to Payout Requests.
- Payout request rows can jump back to the corresponding commission context.

No financial data is duplicated. Staff and Admin still use the same protected backend commission/payout sources; these additions provide explicit navigation and context relationships.
