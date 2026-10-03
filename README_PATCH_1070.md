# AZOBSS Patch 1070 — 50% Deposit Invoice Status

A new **Deposit 50% Paid** status is available for Manual Invoices.

### Status flow
- **Pending** — no payment received
- **Deposit 50% Paid** — 50% received, remaining 50% still due
- **Paid** — full payment received and the document becomes a Receipt

### Accounting
Deposit-paid invoices remain outside full Gross Sales / Costs / Net Profit until the invoice is fully Paid.

### PDF invoice
Pending invoice:
> A 50% deposit is required to confirm the order and cover initial costs. The remaining 50% is payable upon completion of the work or before handover to the customer.

Deposit-paid invoice:
> 50% deposit received. The remaining balance is payable upon completion of the work or before handover to the customer.

The totals area also shows the deposit received and the remaining balance.

Package version: `1.0.1070`
