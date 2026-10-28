# AZOBSS Patch 1047 — Invoice / Receipt 6-Digit Global Sequence

Manual Sales & Receipts now use a six-digit running sequence that continues across dates instead of restarting at `0001` each day.

Examples:
- `AZI-20260828-000047`
- `AZR-20260828-000047`
- next new document: `AZI-20260829-000048`

The date remains embedded for quick reference. Existing legacy 4-digit document numbers remain supported.
