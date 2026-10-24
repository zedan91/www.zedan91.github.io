ALTER TABLE licenses ADD COLUMN purchase_key TEXT;
CREATE UNIQUE INDEX licenses_purchase_key ON licenses(purchase_key);
