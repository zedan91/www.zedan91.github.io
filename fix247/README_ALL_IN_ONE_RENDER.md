Deploy as usual to GitHub Pages / Render static project. No new server environment variables required.


## Patch 247 - Admin Key Test Helper
- Added **Test Key** button in Admin Dashboard → Settings → Backend Admin Key.
- It verifies the saved ADMIN_KEY against `/api/admin/system-health`.
- No Priority 2 flows touched: Cart/Like/Bell/Message, My Purchases, PA/BM user download flow.
- Firebase Rules not required for this patch.
