# AZOBSS Patch 1242 — User Apply Banner Async Approved-State Fix

## Root cause
The banner could appear immediately after refresh and then disappear about a second later. The first render correctly saw the current account as an ordinary User. A later Firestore read then found an older `salesStaffApplications/{uid}` document with `status: approved` from a previous Staff approval and hid the banner again, even though the current `users/{username}` role had already been changed back to User.

## Fix
- Current account role is now authoritative over historical Sales Partner application status.
- If the current Firestore user profile is `User`/member/customer, an old `approved` application no longer hides the banner.
- Ordinary users see **Apply Now** and can submit a fresh application.
- Current Staff / Manager / Admin / Administrator / Owner accounts still hide the entire Sales Partner section.
- Pending applications still show **Application Pending**.
- Rejected applications still show **Reapply**.
- No Firestore Rules change is required.

## Cache
- Sales Partner module cache-buster bumped to `v=1242`.
