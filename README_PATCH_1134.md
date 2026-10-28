# AZOBSS Patch 1134 — Role Naming + Membership Management

Package version: `1.0.1134`

## Account Role terminology

User-facing role order is now:

1. `User` — normal registered account.
2. `Staff` — staff access.
3. `Manager` — higher staff/management access. Internally this remains the legacy `semiAdmin` value so existing permissions and commission logic are not broken.
4. `Administrator` — full admin access.

Paid Membership is not an Account Role. A User, Staff, Manager or Administrator can have or not have an active Membership.

## Dedicated Admin > Membership section

Membership package management was moved out of generic Settings into a dedicated Admin Dashboard `Membership` section. Admin can create/edit/delete packages with:

- Package ID and package name
- Price in RM
- Duration in months
- Software discount %
- CAD Tools discount %
- Active/off status
- Sort order
- Additional benefits (one line per benefit)
- Optional terms/note

PA/BM, Lot Kadaster and Beli Pelan Akui remain outside Membership and cannot be unlocked or discounted by Membership.

## How a user becomes a Member

Normal flow: Account / Settings > Membership > choose package > ToyyibPay payment > after verified payment the Membership activates automatically. If an active user buys another package, duration extends from the current expiry.

Admin manual flow: Admin > Users > Edit Registered User > Membership > choose package > `Activate / Extend`. Admin can also `End Membership`. Manual Membership changes do not alter Account Role or PA/BM access.

## Package benefits

Software and CAD discounts are functional benefits applied by pricing logic. `Additional benefits` are flexible package benefit lines shown to the user in Account / Settings, allowing admin to describe benefits such as priority support, early access, or member-only promotions without changing code.

## Deployment

Deploy frontend/GitHub Pages and main Render backend. Lucky Draw backend and Firebase Rules are unchanged.
