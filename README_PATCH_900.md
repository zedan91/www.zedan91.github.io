# AZOBSS Patch 900

## Software Key — forced dark navy cards

- Forces every Software Key record card to use a dark navy background.
- Uses a new `az900-key-dark` class and a final-cascade, high-specificity style block so older white-card rules cannot override it.
- Darkens the four value fields, labels, copy buttons and metadata while preserving readable contrast.
- Adds no-cache metadata to the Admin page to reduce reuse of an older HTML/CSS copy.
- Retains the compact vertical card list, 3-record pagination, AM/PM time, Malaysian phone spacing and existing Software Key functions.

## Deployment note

Replace the deployed `admin/index.html` with this build, then use `Ctrl+F5` once in the browser so any copy cached before patch 900 is discarded.
