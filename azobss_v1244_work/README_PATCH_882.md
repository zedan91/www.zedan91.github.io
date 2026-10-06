# AZOBSS Patch 882 — Software Key Manual Add

- Baseline: patch 881.
- Admin > Software Key gets a green `＋ Add Manual` button.
- Manual form supports Computer Name, System ID, Systemcode, Onetimecode, Key Serial, Motherboard ID, motherboard manufacturer and motherboard product/model.
- System ID, Systemcode and Motherboard ID are required; at least one of Onetimecode or Key Serial is required.
- Manual records use the same `softwareKeyRecords` collection and same record fingerprint/deduplication as installer-captured records.
- Manual records are marked `source: AZOBSS_Admin_Manual` and `entryMode: manual`.
- Backend admin action `create-manual` is protected by the existing admin authorization check.
- Render backend must be redeployed for manual save to work.
