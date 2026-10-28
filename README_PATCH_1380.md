# AZOBSS v1380 — Admin Analytics Canonical Sales Ledger Reconciliation

## Main fix
- Admin > Analytics no longer calculates revenue from the old standalone `purchaseLogs + premiumOrders` summary.
- Analytics now reads the exact normalized ledger from Admin > Sales & Receipts through a canonical bridge.
- This includes manual quotation/invoice/receipt rows, website sales, admin Paid overrides, stale-duplicate cleanup, payment fees, commissions and internal costs.
- With Sales Records on `All` and no date/category filter, Paid Gross Sales, Total Costs and Net Profit now use the same source/formula in both tabs.

## Financial reconciliation
Analytics now shows:
- Paid Gross Sales
- Product Cost
- Shipping Cost
- Payment Fees (actual stored/normalized fee, not `paid count x RM1`)
- Commission
- Other Costs
- Total Costs
- Net Profit
- Discount Given
- Shipping Charged

Formula:
`Net Profit = Paid Gross Sales - Total Costs`

`Total Costs = Product Cost + Shipping Cost + Payment Fee + Commission + Other Cost`

## Category coverage
Revenue breakdown now includes:
- PA/BM
- Software
- CAD Tools
- Hardware / Computer & IT
- Service
- Other

## Period analytics
Today / This Month / This Year now show Gross, Costs and Net Profit from the canonical ledger. Monthly payment fees use the actual fee values stored on paid records instead of assuming every paid transaction is ToyyibPay RM1.

## Status / records
- Paid, Pending and Quotation counts come from the same Sales & Receipts ledger.
- Total Records now reflects the canonical Sales Records dataset rather than raw payment-log collection counts.
- Quick Filter affects only the latest-record list; headline KPIs remain whole-ledger totals.

## Refresh
- `Refresh Overview` forces a fresh Sales & Receipts ledger load before recalculating Analytics.
