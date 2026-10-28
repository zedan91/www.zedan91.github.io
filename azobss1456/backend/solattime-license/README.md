# SolatTime licensing Worker — management/commerce protocol 1 / backend 0.9.5

This deployable copy matches the canonical AZOBSS-SolatTime/Backend/Cloudflare
project. It updates the EXISTING solattime-license Worker/D1, not AZDM. It contains
no private credentials, signing keys or wrangler session files. Existing Worker
secrets stay in Cloudflare. The desktop installer remains v1.0.32.

The existing Worker has migrations 0001 through 0004 applied and 0.9.5 deployed
on 24 October 2026. Do not replay ALTER TABLE migrations on this database. For a
separate new database, apply each numbered migration exactly once, in order.
Existing paid, legacy, activation and trial records remain intact. See the root
README_V1405_SOLATTIME_FULL_LICENSE_MANAGEMENT.md for website/Render deployment
and the two existing Render-only secrets. Do not generate or rotate either key.

POST /admin/commerce-ready checks the schema/capability with existing admin auth.
POST /admin/issue-order receives a server-reserved serial, license_id, customer and
order_id. It stores only the serial hash and a UNIQUE purchase_key. Retries must
match the original binding and do not alter activation/status. This route is for
the Render server, including the durable manual-issue vault. Customer name may be
edited; retries validate the immutable ID/hash/purchase binding and cannot restore
blocked/archived status or activation.

POST /admin/management-ready checks migration 0004. New admin-only actions edit,
reset, delete, undelete and internal license lookup support the website bridge.
Reset/Delete require expected_generation. Delete archives/blocks/releases PC;
undelete returns a blocked record with no PC. Hash and purchase binding returned
by Worker list/license are internal proof: the website bridge strips them and
only returns authorised customer/contact/plain serial fields. New manual serials
are encrypted in the website's existing private Firestore collection; D1 remains
hash-only. There is no new public access grant or new environment variable.

Run npm ci and npm test for local Miniflare/D1 regressions before deployment.
