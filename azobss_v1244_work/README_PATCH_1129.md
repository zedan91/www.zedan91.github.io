# AZOBSS Patch 1129 — Membership + Referral Invite + Lucky Draw Share Unlock

Package version: **1.0.1129**  
Date: **2026-09-16**

## 1. Account / Settings → Membership

Membership is now a **paid package system**, separate from Invite Code.

- User can view active Membership and available packages in Account / Settings.
- Admin can create/edit/delete Membership packages from Admin Dashboard → Settings.
- Package fields: Package ID, name, RM price, duration in months, active/off, sort order, Software discount %, CAD Tools discount %, and optional benefit note.
- Membership duration can be configured from 1 to 60 months.
- Buying a new package while Membership is still active extends from the current expiry date.
- Membership discount is **strictly limited to Software and CAD Tools**.
- Membership **never grants PA/BM access** and does not discount PA/BM, Lot Kadaster, or Beli Pelan Akui.
- Membership payment is server-side validated using the configured ToyyibPay gateway; package price comes from the backend package record.

## 2. Account / Settings → Redeem Invite Code / Referral

Invite Code is now used only for the referral reward flow.

- Every logged-in user can obtain a personal Invite Code and Invite Link.
- Invite Link opens signup and stores the pending referral code.
- When a genuinely new account registers/logs in through the Invite Link, the code is auto-redeemed where possible.
- A new user can also manually enter a code under Account / Settings → Redeem Invite Code.
- The sharer receives a configurable **one-off Referral Credit** for each successful new registration.
- Admin can configure the reward amount in RM, new-account age limit, and enable/disable the referral program.
- Self-referral is blocked.
- One referred account can reward only once.
- Duplicate redemption is blocked transactionally.
- Invite / Referral Code **never grants PA/BM access**.

## 3. Signup cleanup

- Invite Code has been removed from the Sign up form.
- Signup remains focused on the normal account fields and authentication flow.
- Legacy code `ZX6186` is retained only as historical data compatibility and no longer grants PA/BM access.
- Early pre-auth navigation checks across pages were hardened: PA/BM is visible only to admin or users with an explicit Admin Dashboard PA/BM override.

## 4. Lucky Draw requirement

Lucky Draw participation now follows:

1. Register / login.
2. Share **any** product link from Software Tools or CAD Tools.
3. The share action is recorded.
4. Lucky Draw unlocks for the current month.
5. User can join, subject to the existing duplicate account/device/IP protections.

Notes:
- The product does not need to be paid; free Software/CAD products can also satisfy the share requirement.
- Share action is recorded only after an actual share/copy action from the product Share control.
- Lucky Draw share recording and join are now tied to the authenticated Firebase account rather than trusting a client-supplied username.
- Firestore share-action storage is used when available; JSON fallback remains supported by the Lucky Draw backend.

## 5. PA/BM access guarantee

v1129 intentionally separates all three concepts:

- **Membership** → Software/CAD discounts only.
- **Referral / Invite Code** → one-off referral credit only.
- **PA/BM access** → admin account or explicit per-user Admin Dashboard PA/BM override only.

No Membership package, Invite Code, Referral Code, Lucky Draw share, or Referral Credit can activate PA/BM.

## Deployment

This patch changes all three layers:

1. **Frontend / GitHub Pages** — deploy the website files and hard refresh (`Ctrl + F5`).
2. **AZOBSS main backend / Render** — redeploy because `deploy-server.js` contains Membership + Referral APIs and Membership payment activation.
3. **Lucky Draw backend / Render** — redeploy because `backend/server.js` contains the new authenticated product-share unlock logic.

## Validation performed

- `npm run check` passed.
- `node --check` passed for root backend, Lucky Draw backend, and modified JS modules.
- 38 HTML files / 516 inline scripts were syntax-checked: 0 failures.
- Audit passed for Membership category isolation, Referral endpoints, Lucky Draw share requirement, removal of legacy PA/BM invite-code grant, and v1129 cache-busters.
