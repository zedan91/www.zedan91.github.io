# AZOBSS v1193 — Direct Bank Payout (Billplz Payment Order)

## Added
- Admin Commission Manager: `Pay to Bank` for Approved payout requests.
- Billplz Payment Order V5 integration; credentials stay backend-only.
- Status flow: `Approved → Processing → Paid` from verified Billplz status/callback.
- `Refunded` releases linked commission back to Approved so Staff can request again.
- `Sync Bank Status` fallback and Payment Order Limit indicator.
- Existing `Record Manual Payment` kept as fallback.
- Staff Bank Transfer profile now uses a Malaysia bank list and stores SWIFT bank code.
- Callback verification uses HMAC-SHA512 with the Billplz X Signature key.
- Double-payment guard: once a Payment Order is linked/processing, manual paid is blocked.

## Render environment variables
Set these on **azobss-backend** and redeploy:

```
AZOBSS_BILLPLZ_PAYOUT_ENABLED=1
BILLPLZ_BASE_URL=https://www.billplz-sandbox.com/api
BILLPLZ_SECRET_KEY=<sandbox secret key>
BILLPLZ_X_SIGNATURE_KEY=<sandbox X Signature key>
BILLPLZ_PAYMENT_ORDER_COLLECTION_ID=<sandbox Payment Order Collection ID>
```

For production, after sandbox testing, switch all Billplz values to the production account and use:

```
BILLPLZ_BASE_URL=https://www.billplz.com/api
```

Configure the Payment Order Collection callback URL as:

```
https://azobss-backend.onrender.com/api/billplz/payment-order-callback
```

Do not place Secret Key or X Signature Key in frontend files.
