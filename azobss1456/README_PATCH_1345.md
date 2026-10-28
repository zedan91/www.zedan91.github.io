# AZOBSS v1345 — Software Tools Ebook Module

Baseline: v1344.

## Added
- New top-level `Ebook` tab inside `/Software-Tools/` beside the existing Software view.
- `Jana Ebook` workspace using AZOBSS-native UI rather than copying KrafBuku branding.
- Ebook brief fields:
  - Topik Ebook
  - Nama Penulis
  - Sasaran Pembaca
  - Nada Penulisan
  - Bahasa Melayu / English
  - 10 design directions
  - Ringkas / Sederhana / Mendalam size presets
  - Optional maximum page limit (5–300)
- Full prompt generator for ChatGPT, including complete-book instructions, content structure, layout guidance, factual-safety checks and page-size constraints.
- Prompt Preview panel.
- Copy Prompt.
- Download `.TXT`.
- Open in ChatGPT: prompt is copied first; a short prompt may be prefilled through the URL, while longer prompts open ChatGPT ready to paste.
- `Prompt Saya` history stored locally in the current browser/device.
- History actions: Open, Copy, TXT, Delete, Clear All.
- Direct URL support: `/Software-Tools/#ebook` opens Ebook automatically.
- Responsive one-column mobile layout.
- Reduced-motion support.

## Files changed
- `Software-Tools/index.html`
- `package.json` -> `1.0.1345`

## Files added
- `assets/css/azobss-software-ebook-v1345.css`
- `assets/js/azobss-software-ebook-v1345.js`
- `README_PATCH_1345.md`
- `AZOBSS-v1345-EBOOK-MODULE-AUDIT.json`

## Not changed
The held Upgrade & Parts detailed selector / single-source price-sync work is NOT included in v1345.
