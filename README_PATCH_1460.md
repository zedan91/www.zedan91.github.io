# AZOBSS v1460 - Firefox PA/BM canonical download state

Baseline: full, root-ready owner archive (1459), SHA-256
`cfd46d75929cc6f79e7917452b33cc8d72f7492aa32b362ebdffd1e941ce5037`.
Prepared 29 October 2026 (Malaysia). The requested package filename keeps 20261028.

## Root causes found in the source

1. v1458/v1459's idle repair observer observed the same text/attributes its
   normalizer unconditionally rewrote. This produced a continuing mutation /
   animation-frame loop, rather than a stable recovered button. A baseline DOM
   reproduction recorded 134 normalization passes in 250 ms.
2. PA-BM/index.html had an additional DXF-format observer. It unconditionally
   assigned data-default-label, aria-label and textContent, observing its own
   child/attribute changes and competing with the global normalizer.
3. Active download identity was the full serialized payload. A Firestore usage
   update changes that payload, so a replacement button for the very same record
   could be rendered as another locked download while the original attempt ran.
4. The owner's Firefox 159 local test returned NetworkError for attachment
   fetches. The previous retry loop kept the UI busy for up to two minutes.
   The underlying browser/network cancellation has not been attributed to a
   specific extension. This is separate from the confirmed observer defects.
5. The historical combined auth/likes script contained a second full download
   implementation and capture installer. Production HTML already excluded that
   script; it is not claimed to have been running on the production page. Its
   obsolete download implementation/installer is now removed as well.

## Canonical owner and handoff

`azobssPaBmDownloadButtonState(record, format)` computes payment eligibility,
remaining validity, authoritative usage/max, explicit availability/access flags,
and current operation state from purchase records. `azobssApplyPaBmDownloadButtonState`
is the sole DOM presenter. Rendered rows register their current record against a
stable document ID; mutable count/payload strings no longer identify an attempt.

Eligible controls have stale busy/disabled/claimed/locked attributes, loading
classes, inline grey styling and spinner children removed. Original blue CSS
classes, format labels and accessible titles remain. Pending, expired, exhausted
and explicitly unavailable/denied records stay blocked. Labels such as Tamat
are outputs, never evidence of expiry. A cooldown timestamp does not grey a button.

Each completed render explicitly syncs controls. The observer is only a safety
net, disconnects during its own idempotent writes, and schedules via a microtask
instead of depending on animation frames in hidden Firefox tabs. The inline DXF
observer delegates to the same function. One delegated click listener remains.

Successful attachment/Blob/openUrl handoffs release their operation immediately;
finally also releases on failures/early returns. An older completion cannot clear
a newer attempt. Firefox PA/BM/DXF use native attachment delivery after existing
readiness checks, carrying the same downloadAttemptId. Chromium's fetch/Blob path
and the existing ZIP source/CAD generation are retained. A native handoff is not
a claim that the browser finished saving the file. Counts come from refreshed
server records; they are not incremented speculatively in the browser.

pageshow (including BFCache persisted restore), focus and visibility return sync
the same state. A restored operation is invalidated before synchronization.

## Files changed

- assets/js/azobss-global-auth.js: state owner, record identity, handoff/finally,
  renderer integration, timestamp cooldown and global v1460 badge.
- assets/js/azobss-firebase-live-likes-sync.js: remove obsolete download owner and
  delegate purchase rendering when canonical global auth is present.
- PA-BM/index.html: replace competing DXF observer with a canonical delegate.
- Production HTML entry points: only shared global-auth cache-bust to v1460,
  except the PA-BM inline change described above.
- package.json: release metadata 1.0.1460.
- tests/pabm-download-state-v1460.test.cjs: eligibility, stable ownership,
  cooldown, stale payment status and competing-owner regression coverage.
- tests/admin-version-badge-v1315.test.cjs: replace obsolete release whitelist
  with a numeric version check while still requiring package/badge/cache agreement.

## Verification and limits

Node regression tests and DOM simulations cover PA 2/5 -> 3/5, ZIP 1/5 -> 2/5,
DXF, replacement nodes, stale disabled/Tamat/inline styles, observer convergence,
15-second delayed snapshots, focus/visibility/persisted pageshow, failures, Blob
exceptions, both browser fallback branches, and a simulated Firefox UA native
handoff without attachment fetch retries. They also keep 5/5, 0-day, pending and
unavailable rows locked. These simulations are not real Firefox/Chrome/Edge tests.

Native Firefox UI automation was rejected by the Computer Use tool because URL
policy enforcement is unsupported for the Windows Firefox surface. The owner
ran the initial local fixture and supplied its failed trace. Final browser
verification status and exact test totals are recorded outside the deployable
Source in Verification/v1460-*.json. Do not describe an old failed browser report
or a simulated UA branch as final real-browser success.

No real customer data, payment, licence or production quota was used for tests.
Final verification: 60 Node regression tests, 23 DOM simulations, 18 tests in
Firefox 159 and 18 tests in the in-app Chromium 156 browser pass. Actual browser
refresh and Back navigation preserve the 3/5 eligible controls. The Back runs
reported persisted=false; the persisted=true handler was exercised separately
with a synthetic pageshow event. Focus/visibility handlers were event-tested.
A separate installed Edge application was not tested; Chromium coverage is not
described as a native Edge test. The owner only initiated the Firefox fixture;
the local fixture performed its checks and saved the source-hashed report.

Payment/cart/membership/auth flows, prices, Reset 0/5, 5-download/7-day enforcement,
search/maps, invoice/receipt/quotation/SSM footer, Liyabudun, Pin Order, and backend
CHIP/ToyyibPay/CAD generation code remain unchanged from the v1459 baseline.

The full ZIP is flat/root-ready: index.html, assets/, backend/, Software-Tools/,
PA-BM/ and Perkhidmatan-Ukur-Tanah/ are top-level. Render Root Directory backend
is preserved. There is no separate patch ZIP, local test server, development
dependency, owner secret or customer fixture in the deployable archive.
