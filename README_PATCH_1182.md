# AZOBSS Patch 1182 — Full 29-Category PC Builder

Date: 2026-10-01
Package: 1.0.1182
Baseline: v1181

## Why v1181 was incomplete

v1181 only exposed a curated 10-group customizer (CPU, cooler, motherboard, RAM, GPU, storage, PSU, casing, Windows and Office). The public reference builder actually exposes 29 categories, including HDD, monitor, keyboard, mouse, combo, headset, mousepad, speaker, extra fans, Wi-Fi receiver/router, optical drive, multiple accessory groups, drawing tablet, chair, desk and recommended new-PC accessories.

## v1182

- Adds `/PC-Build/Build-Sendiri/` as a dedicated full builder.
- Uses the same 29-category structure observed on the public reference builder.
- Each category supports search, product selection, quantity, per-line estimated AZOBSS selling total and `+` additional line.
- `Ctrl + K` searches the full catalog.
- `Next` opens a quotation-style summary.
- Share Build, Copy Spec and WhatsApp actions are included.
- Existing ready-build cards now send `Ubah / Build Sendiri` to the full builder with a preset hint.

## Live catalog architecture

- New production endpoint: `GET /api/pc-build/full-catalog`.
- Uses `puppeteer-core` + system Chromium already present in the Render Docker image.
- Opens the public builder as a real rendered browser so client-side product lists can be read.
- First reads native `<select>/<option>` data; if sparse, it opens Select2-style dropdowns and captures visible product rows.
- Extracts the last `RM` amount as the current market reference price and captures the public `Price list last updated` timestamp.
- Cached for 15 minutes by default (`PC_FULL_CATALOG_CACHE_MS`).
- If the reference builder is down or changes structure, a local 29-category fallback catalog keeps the page usable.

## Pricing / privacy

- AZOBSS tiered markup remains 15% / 12% / 10% / 9% / 8% / 7%, minimum RM250.
- Markup is applied once to the full selected market-cost subtotal.
- Customer UI shows AZOBSS estimated prices, not the raw source line price.
- Raw market cost and source details remain visible only in Administrator UI.

## Compatibility checks

- Intel vs AMD platform conflicts.
- LGA1700 / LGA1851 / AM4 / AM5 socket matching.
- DDR4 / DDR5 mismatch checks.
- GPU vs PSU wattage checks for common current GPU classes.
- Missing core parts produce warnings.
