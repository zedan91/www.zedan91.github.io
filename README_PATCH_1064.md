# AZOBSS Patch 1064 — Manual Invoice Registered Customer Autocomplete

Admin > Sales & Receipts > Create Manual Invoice now supports registered-customer lookup.

- Type in **Customer Name** to search the Firestore `users` collection.
- Suggestions match name, username, phone, and email.
- Selecting a registered user auto-fills **Customer Name**, **Phone**, and **Email**.
- Up to 500 registered users are cached for the lookup.
- Keyboard navigation supports Arrow Up / Arrow Down / Enter.
- The lookup is active only for manual invoice/receipt mode.
- No changes to payment, ToyyibPay, accounting totals, document numbering, backend, or verified website transactions.

Package version: `1.0.1064`
