# SolatTime licensing Worker — commerce protocol 1 / backend 0.9.4

This deployable copy matches the canonical AZOBSS-SolatTime/Backend/Cloudflare
project. It updates the EXISTING solattime-license Worker/D1, not AZDM. It contains
no private credentials, signing keys or wrangler session files. Existing Worker
secrets stay in Cloudflare. The desktop installer remains v1.0.32.

Apply migrations/0003_purchase_issues.sql ONCE to the existing database, then deploy
the Worker. Do not replay 0001/0002 on an existing database. Existing paid, legacy,
activation and trial records remain intact. See the root website README_V1399 for
the deployment order and the two Render-only secrets.

POST /admin/commerce-ready checks the schema/capability with existing admin auth.
POST /admin/issue-order receives a server-reserved serial, license_id, customer and
order_id. It stores only the serial hash and a UNIQUE purchase_key. Retries must
match the original binding and do not alter activation/status. This route is for
the Render server only and is not exposed by the website's manual licence bridge.

Run npm ci and npm test for local Miniflare/D1 regressions before deployment.
