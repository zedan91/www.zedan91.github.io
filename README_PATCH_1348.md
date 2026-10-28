# AZOBSS Patch v1348 — Ebook Direct PDF Production Prompt

Baseline: v1347.

## Changes
- Upgraded Ebook Generator from a manuscript/Markdown prompt to a Direct PDF Production Prompt.
- Generated prompt now instructs the AI to write the complete ebook and create ONE downloadable PDF artifact.
- Uses structured JSON execution configuration similar in strictness to professional publication workflows, while keeping AZOBSS wording and logic.
- Added hard anti-loop instructions: do not regenerate the prompt, do not stop at an outline, and do not return only Markdown/code.
- Added full-page A4 cover production instructions, copyright page, synopsis, TOC, chapter standards, conclusion/action plan, PDF verification and download-link requirement.
- Added adaptive publication-design profiles for Minimalist, Corporate, Classic, Bold, Editorial, Workbook, Motivation, Step-by-step Guide, Pastel and Dark Premium.
- Editorial style now explicitly requests selective two-column layouts, hero/visual blocks and magazine rhythm.
- Workbook style requests actual worksheet/checklist space.
- Step-by-step style requests numbered procedures, tables, checklists and note/warning boxes.
- Hard maximum page count overrides the selected preset estimate when they conflict.
- Added factual-integrity rules and high-stakes-topic disclaimer guidance.
- Added truthful fallback if the target AI platform genuinely cannot create files; it must not pretend a PDF exists.
- Updated Ebook UI wording to `Jana Prompt PDF Ebook` and `Direct PDF Prompt Preview`.
- Existing More navigation, Ebook category button, Software Type=Ebook, Prompt Saya history and v1347 functionality are preserved.

## Version
- package.json: 1.0.1348
