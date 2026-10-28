-- AZDM v1218 optional manual D1 migration.
-- The v1218 Worker runs this migration automatically; use manually only if needed.
ALTER TABLE licenses ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE licenses ADD COLUMN email_key TEXT NOT NULL DEFAULT '';
ALTER TABLE licenses ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE licenses ADD COLUMN phone_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_azdm_licenses_customer_key ON licenses(customer_key);
CREATE INDEX IF NOT EXISTS idx_azdm_licenses_email_key ON licenses(email_key);
CREATE INDEX IF NOT EXISTS idx_azdm_licenses_phone_key ON licenses(phone_key);
