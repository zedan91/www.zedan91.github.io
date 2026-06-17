# (198)-AZOBSS Payout Timeline Notify Fix

Patch focus:
- Add payout request timeline for staff/admin visibility.
- Add optional email notification to admin when staff submits payout request.
- Add optional email notification to staff when admin updates payout request status.
- Keep notification email optional; no new Render ENV is required.
- No Firebase Rules update required when using backend Admin SDK.

Optional Render ENV:
- AZOBSS_ADMIN_NOTIFY_EMAILS=admin@example.com,second@example.com
