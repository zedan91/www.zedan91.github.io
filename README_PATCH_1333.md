# AZOBSS v1333 — Affiliate Shop Separate Bookmarks

Changes:
- Affiliate Shop product bookmark is now separate from the global navbar `/Bookmarks/` collection.
- New `Bookmarked` filter button inside `/affiliate-shop/` with live bookmark count.
- Every Affiliate Shop card has its own local bookmark button at the top-right.
- Bookmark filter combines with search/category filters.
- Bookmark data is stored in a dedicated per-user browser key: `azobss_affiliate_bookmarks_v1333:<user>`.
- Global `azobss-live-likes-only.js` skips Affiliate Shop only; Software/CAD/PC Build global bookmarks are unchanged.
- Existing v1332 trust notice, v1331 image hover preview, v1330 Show More scroll lock, and Shopee/admin functions are preserved.

Note: existing Affiliate items that were already saved to the old global Bookmarks collection are not automatically deleted from Firestore; remove them once from `/Bookmarks/` if desired. New Affiliate Shop bookmarks do not enter that collection.
