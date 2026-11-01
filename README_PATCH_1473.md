# AZOBSS v1473 — PC Build / Hardware Checkout Cleanup + Real Product Images

Full website based on v1472.

## Checkout
- Payment choices reduced to Maybank, ToyyibPay and Stripe only.
- Removed CHIP Online Payment, Cash / Pickup and Other from the PC/Hardware shop checkout.
- Shipping and payment are displayed as full-width choice cards instead of native dropdowns, preventing the checkout modal from feeling cramped or dropdowns covering nearby fields.
- Shipping choices remain Courier, Pickup AZOBSS and Arrange with AZOBSS.
- Checkout body has its own stable scroll area while the modal header stays fixed.

## Product images
- Curated PC/Hardware shop products now use real product photos instead of generic SVG illustrations wherever a suitable current product photo is available.
- `object-fit: contain` remains in use so the entire product stays visible.
- Every real photo has a local fallback image if a remote source fails or blocks loading.
- The customer UI still hides competitor/source names; source metadata remains internal/admin.

## Preserved
- Add to Cart
- Buy Now
- Request Quote
- Proceed to Checkout
- secure customer orders
- Admin order management
- Price Confirmation Required flow
- Processing -> Packed -> Shipped -> In Transit -> Delivered
- Sales & Receipts integration
- v1470 Upgrade Parts focus layout
- v1471 Free Download File Link


## Laptop additions
- Added real-photo catalog entries for MSI Cyborg 15 RTX 5060, ASUS TUF Gaming A16 RTX 5060 and Acer Predator Helios Neo 16 AI RTX 5060.
- Laptop prices remain reference prices and require AZOBSS confirmation before payment when marked as confirmation-required.

## Server validation
- PC/Hardware order API accepts only Maybank, ToyyibPay or Stripe as payment methods. Unsupported/manipulated payment values are normalized to Maybank.
