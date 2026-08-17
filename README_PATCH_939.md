# AZOBSS Patch 939 — BM/SBM JSON Truncation Recovery Fix

- Repaired `stesen-tanda-aras-records.json`, which was truncated in the middle of the final record and caused `Unterminated string in JSON at position 5933056`.
- Preserved all 14,701 complete BM records and removed only the incomplete tail record.
- PA/BM and Home BM search now parse the database from text and automatically recover all complete top-level records if a future upload is truncated at the end.
- Backend BM/SBM resolver uses the same recovery logic, so paid-download lookup does not collapse if the JSON tail is incomplete.
- Cache-buster updated to `20260817-json-repair-939`.
- Package version: 1.0.939. CAD converter/cache version: 939.1; health patch: 939.
