# AZOBSS v1312 — Admin Debt & Loan Tracker

Baseline: v1311.

## Added
- New **Debt & Loan** tab beside **Payment Alerts** under Admin > Sales & Receipts.
- Seeded current known obligations:
  - AmBank HP Act - Fixed / vehicle VDD5378 — outstanding RM11,896.15, principal RM11,188.35, installment RM479, 3.61%, 26 installments remaining, 114 original tenure, RM8.15 late charge, next due 14 Nov 2026, last payment 14 Oct 2026.
  - Nava Shankara — RM600, POS System payment.
  - Omar bin Akasah — RM5,000, family loan.
- Initial total known debt: **RM17,496.15**.
- Initial split: vehicle loan RM11,896.15 + personal debts RM5,600.00.
- Monthly planner: known fixed commitment + personal debts divided by selected target months (default 12 months = RM945.67/month total target).
- Detailed vehicle-loan calculations including principal/outstanding difference, remaining scheduled installments, tenure progress and estimated final installment month.
- Add / edit / delete debts, record payments, payment history, CSV export, due dates and notes.
- Data saves to browser local storage and attempts Firestore sync at `adminFinance/debtLoanTracker`; if Firestore rules do not allow this document, the module remains usable in browser-local mode and shows that state in the UI.
- Full account number is intentionally not displayed; vehicle reference uses VDD5378.

## Calculation notes
- The car-loan total uses AmBank **Outstanding Balance** as the source balance.
- Late charges are shown separately and are **not added again** to avoid double counting.
- Outstanding minus principal = RM707.80 (displayed only as a difference, not labelled as pure interest).
- 26 × RM479 = RM12,454.00 scheduled remaining installments if the installment stays unchanged.
- Scheduled installments minus current outstanding = RM557.85.
- Tenure progress: 88 / 114 months = 77.2% elapsed, based on 26 remaining installments.
