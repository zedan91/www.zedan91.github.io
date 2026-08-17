# AZOBSS Patch 944 — DWG canonical Middle Center + R2000 writer refresh

- Keeps NOLOT/NOPA as real AutoCAD `TEXT` with `Justify = Middle Center`.
- Internal DXF now uses the canonical representation: 10/20 and 11/21 share the exact lot-centre point, with 72=1 and 73=2.
- Final DWG targets AutoCAD 2000 / AC1015. LibreDWG upstream documents R2000 as its primary encode target; R14 rewrite from v943 is removed.
- Installer prefers official LibreDWG 0.14.8580 and verifies the release asset digest through GitHub Releases API; falls back to the previously pinned/verified 0.14.8531 only if the newest digest cannot be verified.
- Final output is passed through `dwgrewrite --as r2000` and must retain AC1015 signature.
- Public DXF remains AC1027 and is unchanged.
- Docker layer caching/build filter from v941 remains.

Important: LibreDWG is a reverse-engineered DWG writer. This patch removes AZOBSS-side non-canonical text anchors and uses LibreDWG's best-supported R2000 target, but AutoCAD is still the final compatibility test.
