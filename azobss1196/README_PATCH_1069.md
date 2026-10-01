# AZOBSS Patch 1069 — Invoice Exact Alignment + Neutral Colour Balance

## Alignment
The PDF generator now uses exact Helvetica font metrics instead of approximate character widths.

This fixes the visible offset for narrow-looking values such as digit `1`.

- NO. values: centered accurately
- DESCRIPTION: left aligned
- CATEGORY: centered accurately
- QTY: centered accurately
- UNIT PRICE: right aligned accurately
- AMOUNT: right aligned accurately

## Colour balance
- AMOUNT text changed from strong green to neutral dark text
- Totals card changed from green to neutral light grey / white
- TOTAL PAYABLE changed to neutral dark text
- NOTES changed from yellow/orange to white with a light grey border
- Maybank payment card remains neutral white
- PENDING badge and AZOBSS brand accent are retained as useful semantic accents

## Preserved
- Maybank payment method and QR
- v1066 navbar/logout fixes
- registered-customer autocomplete
- ToyyibPay flow

Package version: `1.0.1069`
