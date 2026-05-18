---
date: 2026-05-18
type: journal
topic: editor-ribbon-layout-hardening-tdd
---

# Editor Ribbon Layout Hardening TDD

## Context

Session hardening `plans/260517-2252-editor-ribbon-layout-hardening-tdd/` after ribbon review exposed clipping and compact-layout regressions.

## What Happened

- Added and validated the `ribbon` `Button` variant so visible-label triggers keep their sizing contract instead of inheriting icon-only padding.
- Compacted Insert by grouping Media/Embed/Advanced; games now route through `Advanced -> Games...` and still satisfy the existing E2E helper contract.
- Compacted Home paragraph controls and kept TipTap selection alive across the dropdown.
- Fixed header AI/Share trigger sizing and added keyboard activation for the dropdown trigger.

## The Brutal Truth

This was layout hardening, not feature work. The annoying part is that the code mostly worked already; the failure mode was visual contract drift, which is easy to miss and expensive to chase once it leaks into E2E. It felt like polishing a small edge while still having to prove nothing else broke.

## Technical Details

- `ribbon` variant added to preserve label-bearing button sizing.
- Insert grouping kept game routing stable through `Advanced -> Games...`.
- Home compact controls preserved TipTap selection state.
- Header dropdown triggers now support keyboard activation.
- Verification: lint PASS, build PASS, unit `119/119`, targeted E2E `73/73`.
- Tester also verified `165` tests before final reviewer findings reopened follow-up fixes.

## What We Tried

- Hardened the `Button` variant instead of patching each trigger ad hoc.
- Moved Insert clutter into grouped dropdowns instead of widening the ribbon.
- Kept paragraph controls compact without unmounting the editor selection state.
- Fixed trigger behavior at the component boundary rather than by CSS overrides alone.

## Root Cause Analysis

The root cause was a bad fit between shared button styling and ribbon-specific interaction contracts. Icon-only defaults bled into label-bearing triggers, compact layouts got too dense, and keyboard activation was missing on a dropdown path that still looked clickable.

## Lessons Learned

- Shared UI primitives need explicit variants when the contract changes.
- Compacting a ribbon by CSS alone is brittle; interaction contracts must stay covered by E2E helpers.
- If a dropdown is keyboard-accessible by spec, wire it in the component, not in test glue.

## Next Steps

- Keep the reviewer follow-up fixes in sync with the existing ribbon test gates.
- No further action unless a later review reopens a sizing or routing regression.
