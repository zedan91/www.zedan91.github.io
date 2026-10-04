# AZOBSS 1059 — Sales & Receipts Net Profit Gold Bar Highlight

## Baseline
- Built from v1058.
- Keeps all Website Auto Invoice / Receipt override, Render wake, ToyyibPay recovery and previous fixes.

## Scope
- Admin → Sales & Receipts only.
- No accounting, payment, Firestore, invoice/receipt, ToyyibPay or backend logic changes.

## UI change
- The `Net Profit` KPI is now styled as a metallic gold bar/ingot so the true net profit stands out immediately.
- Tapered gold-bar silhouette with metallic highlights and depth.
- Stronger gold glow/drop shadow while staying within the existing KPI row.
- Dark embossed-style text for high readability on the gold surface.
- Small `AZOBSS • NET` stamp reinforces that this is the final net profit figure.
- Responsive shape remains readable on smaller screens.

## Deployment
Website deploy only.
`deploy-server.js` is unchanged, so Render backend redeploy is not required.

## Version
`1.0.1059`
