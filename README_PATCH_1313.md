# AZOBSS v1313 — SPayLater / SLoan Auto Reconcile

Baseline: v1312.

## Added to Admin > Sales & Receipts > Debt & Loan
- Two managed Shopee finance records:
  - SPayLater
  - SLoan / SPay Loan
- Existing v1312 data is migrated from `azobssAdminDebtLoanTrackerV1312` to `azobssAdminDebtLoanTrackerV1313` without changing the existing car/person debt balances.
- New KPI cards and breakdown for SPayLater and SLoan.
- Current due / monthly due fields, Shopee link status, last sync time and sync confidence.

## Shopee Browser Capture v1313
- Existing affiliate product capture is preserved.
- Extension now also runs on `/admin/*` to bridge finance captures into Debt & Loan.
- On Shopee web, it watches for SPayLater / SLoan pages and locally parses only selected summary fields such as:
  - outstanding / total balance when visible,
  - current bill / amount due,
  - due date,
  - monthly installment,
  - remaining installments.
- Passwords and cookies are not read or bridged.
- When a new captured balance is lower than the previous tracked balance, AZOBSS automatically records the difference as a payment and updates the debt balance.
- When the balance increases, AZOBSS updates the balance and records a sync adjustment instead of treating it as payment.
- First capture establishes the opening balance and does not create a fake payment.
- Repeated identical captures are deduplicated by capture ID.

## Fallbacks
- Manual paste parser for SPayLater / SLoan summary text if Shopee web does not expose enough data to the extension.
- Conservative bank CSV/TXT import. It only auto-matches linked Shopee finance debts when transaction text contains explicit configured keywords such as `SPAYLATER`, `SPAY LATER`, `SLOAN`, `SPAY LOAN` or `SHOPEE LOAN` and a debit/payment amount can be identified.
- Bank CSV matches are provisional; the next Shopee capture reconciles the tracked balance to Shopee's latest visible balance.
- Live Open Finance / bank API is not enabled in this package because it requires provider onboarding/credentials and a real bank data feed.

## Important limitation
Shopee finance pages are not guaranteed to expose the same information on every web/app flow. The automatic path works when the logged-in Shopee web page exposes the relevant figures to the browser. If it does not, use paste/manual edit until a supported data source is available.

## Tests
- `npm run check` passed.
- `npm test`: **168/168 passed**.
