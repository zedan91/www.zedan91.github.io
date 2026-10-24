CREATE TABLE trials (
 machine TEXT PRIMARY KEY,
 id TEXT NOT NULL UNIQUE,
 started INTEGER NOT NULL,
 expires INTEGER NOT NULL CHECK(expires = started + 2592000)
);
