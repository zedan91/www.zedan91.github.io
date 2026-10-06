# AZOBSS v1228 — Login Click-Through Fix + Sales Partner Applications

## Login modal fix
- Fixes v1223 long-session recovery leaving `pointer-events:none!important` on the hidden auth modal.
- Active login/register modal now always restores pointer events and uses a topmost z-index.
- Prevents clicks on Login / Google / Register from passing through to the page behind the modal.

## Sales Partner → Staff workflow
- Software Tools adds **Become an AZOBSS Sales Partner**.
- Logged-in users can submit name, email, phone, sales channel and reason/experience.
- Firestore collection: `salesStaffApplications/{firebaseUid}`.
- Admin adds **Sales Staff Applications** with Pending / Approved / Rejected review.
- Approve automatically changes `users/{username}.role` to `staff`.
- Existing Software Tools staff affiliate/share/commission flow then recognises the approved account.

## Required deployment
Deploy the included Firestore rules file:
`AZOBSS-Developer-Files/FIREBASE-RULES-AZOBSS-PRODUCTION-LOCKED-v1228-SALES-STAFF-APPLICATIONS.txt`
