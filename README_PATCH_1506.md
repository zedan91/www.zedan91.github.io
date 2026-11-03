# AZOBSS v1506 — GitHub Hardware Image Vendor Resilience

Fixes the v1505 GitHub Action failure where 13/14 exact hardware images downloaded successfully but one Gigabyte B860M EAGLE WIFI6 failure kept the entire local image map NOT READY.

Changes:
- Adds two verified exact-model fallback image URLs for Gigabyte B860M EAGLE WIFI6.
- Publishes all successfully verified local hardware images even if one CDN/source fails.
- A failed item remains a placeholder instead of hiding every other hardware image.
- GitHub Action exits successfully when at least one verified image is available, allowing the local image map and images to be committed.
- Adds detailed attempt errors to the vendor report.
- PC-Build local hardware map cache-buster updated to v1506.
