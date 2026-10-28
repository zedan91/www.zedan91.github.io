# AZOBSS Patch 1243 — Admin Commission Banner Hide + Compact Software Filter Row

## Changes
- `Commission & Share Link` is now for commission-earning Sales Staff roles only.
- Admin / Administrator / Owner / Super Admin never see the commission/share banner.
- Added CSS hard-hide for admin body role classes and JS role-state guard.
- Added role-class MutationObserver sync so changing to Admin hides the banner immediately.
- Reduced banner height, spacing, icon, text and Share Link button size.
- Desktop Software platform/type/account filter is compacted to a single row at >=1000px.
- Reduced filter gaps, button padding/font size, and owner account select width while keeping mobile layout unchanged.
- No Firestore Rules change required.

Package version: `1.0.1243`.
