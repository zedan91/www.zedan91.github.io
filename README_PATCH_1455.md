# AZOBSS v1455 — SSM Business Registration Footer

Baseline: v1454.

## Change
- Adds a compact public business-registration line at the bottom of AZOBSS website pages:
  `AZOBSS ENTERPRISE | SSM: 202603287983 (CT0171167-W)`
- Uses a dedicated shared script: `assets/js/azobss-business-registration-v1455.js`.
- The line is placed after the page's existing footer when available, otherwise at the end of the body.
- Styling is deliberately subdued and responsive so it does not compete with page content.
- Does not display business/owner address, IC, or other private registration data.
- Excludes internal badge test, Impact verification file, and backend license public shell.
- Global website admin version badge/cache-bust advanced to v1455.

## Preserved
- Liyabudun 1.0.51 static dates.
- Software Tools Pin Order.
- PA/BM download auto-reset + anti-spam lifecycle from v1454.
