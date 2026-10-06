# AZOBSS v1237 — Stable Sales Partner Form + Locked Account Identity

## Fixed
- Sales Partner application modal no longer closes unexpectedly while the user is filling it in.
- Background auth/role sync is paused while the modal is intentionally open, so Firefox focus/visibility changes and role-class mutations cannot dismiss the form.
- Clicking the dark backdrop no longer closes the modal. The form closes only via the **X** button, a successful submission, or a confirmed authoritative Staff-or-higher state.
- Full Name and Email are locked to the logged-in AZOBSS account and cannot be edited in the application form.
- Phone Number is also locked when a phone number already exists in the AZOBSS account.
- If the account has no phone number, Phone Number remains editable so the applicant can provide one.
- Submission re-reads the authoritative account profile and uses the account Full Name / Email / existing Phone, so altering readonly inputs through DevTools or autofill cannot change those identity values.

## Preserved
- User -> Pending -> Approved/Rejected application workflow.
- Staff/Manager/Admin and higher roles do not see the application banner.
- Existing v1228 Firestore Rules remain compatible.
- All v1236 role-sync fixes, v1235 commission symbol behavior and prior AZDM/website fixes remain unchanged.
