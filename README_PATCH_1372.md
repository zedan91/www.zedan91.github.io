# AZOBSS v1372 — Ebook Prompt Studio UI + Advanced Prompt Controls

Date: 21 Oct 2026
Baseline: v1371

## Scope
Only the `/Software-Tools/#ebook` Ebook Generator front-end/prompt builder is changed. Existing RM19 one-time lifetime access, ToyyibPay checkout, account entitlement, Software catalogue, AZDM, and PA/BM payment/cart fixes are preserved.

## UI wording refresh
- `Jana Prompt PDF Ebook` -> `Ebook Prompt Studio`.
- `Maklumat Ebook` -> `Brief Ebook`.
- Reworded the form labels while keeping the same intent: topic/title, author/brand, target readers, writing style, language, visual identity, content depth and optional page cap.
- Preview is now labelled `Prompt Produksi AI`.
- Buttons are clearer in Malay: `Bina Prompt Ebook Terbaik`, `Salin Prompt`, `Muat Turun .TXT`, `Buka di ChatGPT`, `Kosongkan`.
- `Prompt Saya` is presented as `Prompt Tersimpan`.

## New Smart / Advanced modes
### Smart
- Keeps the fast workflow.
- Only the topic is mandatory.
- Missing editorial details are inferred conservatively from the topic and audience.

### Advanced
Adds optional controls for:
- desired reader outcome,
- main reader problem,
- reader level,
- content approach,
- must-include topics/elements,
- things to avoid,
- research/source strategy,
- visual density,
- final CTA/next step,
- extra visual/design direction.

## Prompt quality upgrade
The generated production prompt now also contains:
- an editorial planning workflow,
- non-repetition and reader-progression rules,
- a high-quality editing bar,
- sensible missing-detail assumptions without unnecessary follow-up questions,
- selectable research behaviour (`Smart verification`, `Research-first`, or `Evidence-led`),
- stronger factual-integrity/source rules,
- advanced editorial direction in both Malay and English prompts.

## Compatibility
- Existing saved prompts still load; old records simply open in Smart mode unless they already contain the new advanced state.
- Base v1351 Ebook stylesheet remains loaded for historical compatibility; v1372 adds a small override stylesheet for the new interface.
- No backend schema or payment endpoint changes.

## Verification
- `node --check assets/js/azobss-software-ebook-v1372.js` — PASS.
- Ebook targeted regression tests — 5/5 PASS.
- AZDM regression — 25/25 PASS.
- PA/BM/runtime regression — 10/10 PASS.
