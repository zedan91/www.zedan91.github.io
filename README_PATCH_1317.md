# AZOBSS v1317 — WhatsApp Payment Method Share Fix

## Issue
A manual Pending invoice could be edited from ToyyibPay to Maybank, but the WhatsApp share text still showed `Pay via ToyyibPay:`. The old ToyyibPay URL/QR fields can remain stored on the invoice after the payment method changes, and the temporary-link share builder was reading that URL without checking the active payment method.

## Fix
- `toyyibPayPaymentUrl()` now exposes a ToyyibPay URL only when the active `paymentMethod` is ToyyibPay.
- Temporary WhatsApp/Telegram share text now reuses the same payment-aware `documentShareText()` used by actual-PDF sharing.
- Maybank Pending invoices now include Maybank payment details instead of a stale ToyyibPay link.
- Share panel labels become payment-aware: `WhatsApp PDF + Maybank` / `Telegram Invoice + Maybank` for Maybank invoices.
- PDF generation now suppresses a dormant ToyyibPay QR when the current payment method is Maybank, preventing both payment rails from appearing together.
- Patched Sales & Receipts JS/PDF assets are cache-busted to `v=1317`.
- Website version badge/package bumped to v1317.

## Expected behavior
For a Pending invoice with `Payment Method = Maybank`, WhatsApp text should contain the invoice details, Maybank payment details, and temporary PDF link. It must not contain `Pay via ToyyibPay:` even if an older ToyyibPay bill URL remains stored in Firestore.
