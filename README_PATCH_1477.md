# AZOBSS v1477 — PC Build & Hardware Modal Pointer Ownership Fix

## Root cause
The global Long Session Stability watchdog treated the active `.az-pc-shop-backdrop` as an inactive/orphan backdrop because the PC Shop modal did not carry an active state class. On watchdog/resume cycles it could apply `pointer-events:none` to a still-visible modal. The result matched the reported symptom: the dialog remained visible but all controls became unclickable until page refresh.

## Fix
- PC Shop backdrop now uses `is-open` + `aria-hidden=false` while active.
- Long Session Stability explicitly recognizes active PC Shop/Admin PC Shop modals and will not disable their pointer events.
- Active modal pointer events are explicitly restored if an older recovery marker is found.
- Duplicate/orphan PC Shop backdrops are removed automatically.
- A 2.5s modal-only watchdog repairs stale overlay/body-lock state while a modal exists.
- Recovery also runs on focus, pageshow, visibility resume, and `azobss:session-resume`.
- Close removes every stale PC Shop backdrop and releases `az-pc-shop-modal-open`.
- Admin PC Shop modal also receives explicit active-state semantics.

## Scope
Covers PC Build & Hardware Cart, Checkout, Request Quote, My Orders, and Admin PC Shop Orders. Maybank-only checkout and all v1476 pricing/order behavior are retained.
