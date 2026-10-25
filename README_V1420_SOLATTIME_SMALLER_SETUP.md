# SolatTime v1.0.38 — smaller setup and guided first run

Installer 194,272,276 → 89,988,893 bytes (53.68% smaller). The Windows screensaver
uses a 5 KB bridge to the registered installed app, without a second Qt bundle.
The desktop app adds a reversible location → sound → display setup with a
15-second audio preview. Existing profiles are not forced through it.

Public trial/reinstall and purchase email links use v1.0.38. A focused
/solattime/ product page explains verified features, offline limits and trial
expiry, with a link from the Software Tools description modal. The product
price, account requirement and serial-per-PC checkout remain unchanged.

271 desktop regression tests and 15 compiled bridge checks passed. Short,
isolated Qt resource measurements are documented locally; this release makes
no comparative speed, user-count or long-term reliability claims.
