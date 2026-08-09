# AZOBSS Patch 868 — Sound Effects full-width controls + recent category repair

- Expands `/Sound-Effects/` desktop shell from 1260px to 1740px so search/category buttons use wide screens and are less likely to be clipped.
- Tightens category chip spacing on large screens while preserving horizontal scroll on smaller displays.
- Replaces the Recent category parser with a breadcrumb-aware parser. It prefers JSON-LD `BreadcrumbList`, then falls back to the category link nearest the sound page H1 instead of accidentally using the global category menu.
- `Update Sounds` now revisits Recent items on the scanned pages and repairs category metadata for records already stored by older builds, while still adding genuinely new items and skipping base-catalog duplicates.
- Existing Recent timestamps are preserved during category repair so old records are not falsely promoted as newly added.
- Update status now reports new sounds, category fixes, and unchanged records.
