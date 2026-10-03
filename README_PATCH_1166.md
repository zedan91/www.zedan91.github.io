# AZOBSS Patch 1166 — Software Key Created Date Preserve Fix

## Admin > Software Key
- Tarikh dan Masa pada setiap kad kini memaparkan masa asal rekod/key dijana (`createdAtMs` / `createdAt`).
- Edit / Save Changes tidak lagi menukar Tarikh dan Masa yang dipaparkan.
- `updatedAtMs` / `updatedAt` masih dikemas kini oleh backend untuk audit dan sorting `Dikemas kini`.
- Jika rekod legacy tiada `createdAt`, UI fallback kepada `updatedAt`.
- CSV kekal mempunyai kolum `Created` dan `Updated` secara berasingan.

Baseline: 1.0.1165
Version: 1.0.1166
