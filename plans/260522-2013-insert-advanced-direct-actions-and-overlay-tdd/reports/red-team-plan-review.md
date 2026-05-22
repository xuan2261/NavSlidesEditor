---
title: "Red-Team Plan Review"
created: 2026-05-22
scope: "Pre-implementation review for Insert Advanced direct actions and ribbon overlay migration"
status: done_with_concerns
---

# Red-Team Plan Review

## Summary

Plan is directionally correct but needed scope and sequencing fixes before implementation. Main issue: plan claimed every `absolute top-full` ribbon popup but omitted Header `AI` and `Share` dropdowns.

## Findings

1. `client/src/components/ribbon/ribbon-header-bar.jsx`
   - Risk: `RibbonActionDropdown` for `AI` and `Share` uses `absolute right-0 top-full`.
   - Impact: migration could falsely claim all ribbon popups are clipping-safe while header popups remain clipped.
   - Fix: add Header AI/Share to Phase 04/05 migration and verification.

2. `phase-03-games-and-plugin-launcher.md` and `phase-04-ribbon-overlay-clipping-hardening.md`
   - Risk: Phase 03 required Games Escape/outside-click/focus-return behavior before Phase 04 creates the shared overlay primitive.
   - Impact: phase-by-phase TDD can create unavoidable red/green conflict.
   - Fix: Phase 03 keeps launcher split/callback tests; overlay-dependent Games/plugin close/focus behavior moves to Phase 04.

3. `client/src/components/ribbon/ribbon-plugin-insert.test.jsx`
   - Risk: current plugin test only checks callback, not popup close or focus return.
   - Impact: keyboard users can land on removed menu nodes after plugin selection.
   - Fix: add explicit plugin selection close and focus-return tests.

4. `tests/e2e/pages/ribbon-tab-toolbar-helper.js`
   - Risk: existing metrics inspect active ribbon row, not portal overlay geometry.
   - Impact: tests can pass while overlay is offscreen or clipped.
   - Fix: define a popup geometry helper/selector contract before accepting Phase 04/05.

5. `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
   - Risk: centered Games popup conflicts with launcher focus-return acceptance.
   - Impact: focus behavior and geometry become harder to test deterministically.
   - Fix: require Games surface anchored to launcher trigger unless tests prove centered behavior.

## Plan Updates Applied

- Added Header `AI` and `Share` to all ribbon-wide overlay surface lists.
- Moved overlay-dependent Games/plugin focus tests from Phase 03 to Phase 04.
- Added explicit plugin selection close/focus-return requirement.
- Added popup geometry helper/selector contract requirement.
- Required Games surface to be anchored to launcher trigger unless proven otherwise.

## Verification

- Read-only review plus `rg "absolute\\s+top-full|top-full" client/src/components/ribbon tests/e2e -S`.
- Tests not run; no production code changed.

## Unresolved Questions

- None.
