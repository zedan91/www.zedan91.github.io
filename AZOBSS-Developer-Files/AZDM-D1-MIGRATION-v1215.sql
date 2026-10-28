-- AZDM v1215 serial vault migration
-- Optional manual migration. The v1215 Worker also runs this migration automatically on admin/payment paths.
ALTER TABLE licenses ADD COLUMN serial_cipher TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_azdm_licenses_serial_hash_unique ON licenses(serial_hash);
