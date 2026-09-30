# AZOBSS 1050 — Automatic ToyyibPay Invoice → Receipt Idempotency Fix

## Scope
- Automatic website ToyyibPay checkout only: PA/BM/JUPEM, Public PA, Software/CAD digital payment.
- Manual Invoice/Receipt 6-digit sequence from v1047/v1049 remains unchanged.
- Historical automatic document IDs remain unchanged.

## Fix
1. Adds a deterministic SHA-256 checkout fingerprint from buyer + cart/product + amount.
2. Reuses an existing valid Pending ToyyibPay order for the same fingerprint instead of creating another bill/invoice.
3. Adds a server-side per-fingerprint create lock to stop double-click/retry races in the same backend instance.
4. PA/BM purchaseLogs now resolve by exact `paymentOrderId` / `orderId` first. The Pending row for that order is updated to Paid, so the same `AZI-...-######` becomes the paired `AZR-...-######`.
5. When a paid automatic order is finalized, any other still-Pending automatic order with the same fingerprint is marked `cancelled` + `superseded` rather than being left as an active invoice.
6. Purchase-log supersede cleanup is performed only by duplicate `paymentOrderId`, avoiding accidental changes to the paid row.

## Expected flow
```text
AZI-20260830-000007  PENDING
        ↓ ToyyibPay verified
AZR-20260830-000007  PAID
```

Repeated checkout clicks for the same cart reuse the same `orderId`, `billCode`, payment URL and Invoice No. while the ToyyibPay bill is still valid.

## Deployment
`deploy-server.js` changed, so redeploy the Render backend. Deploy the website package as usual so the Admin cache-buster/module version also moves to 1050.
