# AZOBSS Patch 1132 — Account Role Cleanup + Safe Username Rename/Merge

Package version: `1.0.1132`

## Account Role is now separate from paid Membership

The Admin Dashboard no longer uses `member` as the normal account role.

Account Role labels are now:

- `User` — normal registered account, whether or not it has a paid Membership.
- `Staff`
- `Semi Admin`
- `Administrator`

Paid Membership remains a separate subscription/status controlled by the Membership package system. A user with an active paid Membership still has Account Role `User` unless an admin explicitly promotes that account to Staff / Semi Admin / Administrator.

Existing legacy Firestore profiles with `role: "member"` are treated as `User` immediately and are gradually normalized to `role: "user"` when the account profile is loaded. New registrations are saved as `role: "user"`.

Registered User Records in Admin Dashboard now also shows a Membership badge (`Membership: None` or the active package/expiry) separately from the Account Role badge.

## Admin username rename / duplicate merge

The Username field in Admin Dashboard > Users > Edit Registered User is now editable.

When an admin changes a username, the frontend calls the authenticated backend route:

`POST /api/admin/user/rename`

The backend keeps the Firebase Auth UID unchanged and safely moves/merges username-scoped Firestore data.

Migrated/merged data includes:

- `users/{oldUsername}` -> `users/{newUsername}`
- `usernameAuthEmails/{oldUsername}` -> `usernameAuthEmails/{newUsername}`
- `purchaseSummaries/{oldUsername}` -> `purchaseSummaries/{newUsername}`
- `onlineUsers/{oldUsername}` -> `onlineUsers/{newUsername}`
- `users/{username}/likes/*`
- `users/{username}/soundFavorites/*`
- Referral Invite Code owner mapping
- Referral references that point to the renamed user
- Membership fields and applied Membership order IDs
- Embedded PA/BM purchase history
- Referral credit/count without double-crediting duplicate records
- Verification/password-provider state

If the destination username already exists with the same Firebase UID, both profiles are merged instead of creating another duplicate. If the destination belongs to a different UID, the rename is blocked with a conflict error.

This means a duplicate situation such as `zedann0002` + `zedan0002` can be cleaned safely by editing the old duplicate and changing its username to `zedan0002`, provided both records belong to the same Firebase UID.

## PA/BM access

No PA/BM access rule was loosened. Manual Admin Dashboard PA/BM Allow/Off remains the source of truth for normal users. Membership and referral codes do not grant PA/BM access.

## Deploy

- Frontend / GitHub Pages: **required**
- Main Render backend (`deploy-server.js`): **required**
- Lucky Draw backend: not changed
- Firebase Rules: no rule change required

After frontend deploy, hard refresh the website (`Ctrl + F5`).
