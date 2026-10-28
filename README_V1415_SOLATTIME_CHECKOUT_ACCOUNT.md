# SolatTime checkout account and installer v1.0.33

SolatTime continues to require a real Firebase session and a verified email on
the backend. The general guest email field is now hidden for this product.
Guests see Daftar akaun / Log masuk using the existing authentication modal.
The product, quantity and payment method remain in the open checkout during
authentication. Only a real Firebase UID reveals Open Payment; stored profile
flags alone cannot reveal it. The backend still verifies the ID token, verified
email, account ownership and payment before issuing any serial.

Auth changes refresh this visible checkout through existing events; no polling
timer, automatic payment or new authentication provider is introduced. Other
products retain their existing guest checkout. The repeated Email Address label
is corrected. Trial/reinstall download stays public without signup, now using
the verified 1.0.33 public Setup. Purchase emails also link to this version.

Purchases retain the existing account UID, order/payment records and encrypted
distinct serials; admin and account purchase views are unchanged. This release
does not issue licences, send emails, make payments or change customer data.
