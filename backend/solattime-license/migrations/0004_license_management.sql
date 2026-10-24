ALTER TABLE licenses ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1));
CREATE INDEX licenses_archive_created ON licenses(deleted,created DESC,id DESC);
