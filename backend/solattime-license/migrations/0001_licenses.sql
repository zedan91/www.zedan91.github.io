CREATE TABLE licenses (
 id TEXT PRIMARY KEY,
 serial_hash TEXT NOT NULL UNIQUE,
 customer TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('new','legacy')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
 current_activation TEXT NOT NULL DEFAULT '',
 generation INTEGER NOT NULL DEFAULT 0,
 created INTEGER NOT NULL
);
CREATE TABLE activations (
 id TEXT PRIMARY KEY,
 license_id TEXT NOT NULL REFERENCES licenses(id),
 machine TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 generation INTEGER NOT NULL,
 created INTEGER NOT NULL
);
CREATE INDEX activations_license ON activations(license_id, generation);
CREATE TABLE audit (
 id INTEGER PRIMARY KEY,
 time INTEGER NOT NULL,
 action TEXT NOT NULL,
 license_id TEXT NOT NULL
);
CREATE TRIGGER activation_changed AFTER UPDATE OF current_activation ON licenses
WHEN OLD.current_activation <> NEW.current_activation BEGIN
 INSERT INTO audit(time,action,license_id) VALUES(unixepoch(),'activation_changed',NEW.id);
END;
