# AZOBSS Patch 1240 — Sales Partner Hidden-State Collision Fix

## Root cause
The Sales Partner module used `bar.hidden = true`, but its own author CSS also declared `.az-sales-partner-bar { display:flex; }`. CSS `display` can override the HTML hidden state, so the Staff-only role logic could correctly decide to hide the banner while the banner still rendered. The affiliate commission bar already had an explicit `[hidden]{display:none!important}` rule, which is why Commission & Share Link could show at the same time as the stale Apply Now banner.

## Fix
- Added `.az-sales-partner-bar[hidden]{display:none!important;visibility:hidden!important;pointer-events:none!important}`.
- `hidePartnerSection()` now hard-hides with inline `display:none!important`, visibility and pointer-events in addition to the `hidden` attribute.
- `showPartnerSection()` explicitly restores display only after the role check permits User/Pending/Rejected state.
- Banner starts hard-hidden before the first async auth/Firestore role sync.
- Updated cache-buster to `v=1240`.
- No Firestore Rules change required.

## Expected behaviour
- User: Apply Now.
- Pending: Application Pending.
- Rejected: Reapply.
- Staff / Manager / Semi-admin / Administrator / Admin / Owner: no Sales Partner banner.
