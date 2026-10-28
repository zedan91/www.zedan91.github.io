# AZOBSS Patch 1124

## PA 1-2 digit / legacy short-number search

- Removes the old minimum **3 digit** restriction for Pelan Akui searches. PA numbers with 1 or 2 digits (for example `PA22`) are now valid.
- The main PA search accepts 1-12 digits. For 1-2 digit input it shows only the exact PA match instead of flooding the table with thousands of prefix matches.
- **Tambah Terus ke Troli** also accepts valid 1-2 digit PA numbers.
- Peta Pilihan PA/BM/SBM/GPS already recognises explicit `PAxxxx`; backend exact matching is strengthened so short PA numbers are not lost behind the normal 100-row prefix-result cap.
- The selected negeri remains authoritative, consistent with v1122. Bare numbers in map search remain Lot searches; `PA` prefix is still mandatory for map PA searches.
- Existing historical-lot wording from v1121 remains: if the PA exists but current cadastral geometry cannot be matched, the user sees the historical lot-change explanation instead of a false `0 pilihan` result whenever the source confirms the PA.
- Cache-busters for `azobss-pabm-map-search.js` and `azobss-pa-search.js` bumped to v1124.

Package version: 1.0.1124
Frontend + backend deploy required.
