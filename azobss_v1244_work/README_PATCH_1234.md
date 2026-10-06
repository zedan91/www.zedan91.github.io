# AZOBSS v1234 — Staff+ Commission Marker Without Card Reflow

- Guest and normal User accounts no longer see **Commission Eligible** indicators.
- Staff, Manager, Semi-admin legacy roles, Administrator/Admin and higher owner roles can see commission eligibility.
- The old standalone Commission Eligible element is no longer rendered as a Flexbox row. This removes the layout shift that pushed product logo/title/meta/description downward.
- For eligible paid software, **💰 COMMISSION ELIGIBLE** is now integrated into the existing Staff/Admin-only `OWNED:` chip, which is already absolutely positioned.
- Paid software in an active free-promo state remains excluded from the commission marker.
- AZOBSS Download Manager remains commission-eligible for valid Staff/Manager referral purchases; backend commission logic from v1233 is unchanged.
