---
phase: 7
title: "Verification & Suspected-Bug Confirmation"
status: pending
priority: P2
effort: "0.5d"
dependencies: [1, 2, 3, 4, 5, 6]
---

# Phase 7: Verification & Suspected-Bug Confirmation

## Overview
Close out the suspected findings (need runtime/config confirmation, not yet
fixed), run the full verification gate, and ensure no stray `it.fails`
tripwires remain. This phase confirms-or-dismisses, then certifies the whole fix
set.

## Bugs Addressed (confirm → fix or document)
- **S1 (Suspected→maybe High)** — `contenteditable` (table cell, math/link popover) focused while `editingElementId` is null → global Delete deletes the element, Ctrl+C copies the element instead of text. `use-keyboard.js:31-32`. If a real path exists, escalates to HIGH.
- **S2 (Suspected)** — Escape may not exit text editing (only MathExtension has an Escape handler). `use-keyboard.js:30`.
- **S4 (Suspected)** — `document.querySelector('.slide-canvas')` first-match → wrong rect if multiple canvases mount (overview/transition). `use-canvas-pointer-interaction.js:160,190`.
- **S5 (Suspected)** — switching presentations doesn't reset save-queue refs → status applied to wrong UI. `EditorPage.jsx:379-401`. **NOTE: Phase 1 step 5 already resets `saveInFlightRef`/`queuedSaveRef`/`saveAttemptRef` + drains the queue in the load effect** (needed for the A→B data-loss fix). So S5 is largely fixed by Phase 1 regardless of remount behavior. Phase 7 only VERIFIES the reset covers the status-misapply symptom and documents the router remount finding.

## Requirements
- Functional: each suspected bug is either (a) confirmed + fixed with a test, or (b) proven non-reachable + documented with the evidence that closes it. No "maybe" left open.
- Non-functional: full suite green; build + lint pass; repro file contains zero `it.fails` except items explicitly deferred with a written reason.

## Architecture / Investigation Plan
- S1: read the TipTap editor setup in EditorPage (~627-722) + table/math/link edit entry points. Determine if any `contenteditable` gains focus WITHOUT setting `editingElementId`. If yes → broaden the focus guard to check `event.target.closest('[contenteditable="true"]')` (or `.isContentEditable`) in BOTH the registry guard (`use-keyboard.js:31-32`) and the legacy guard. Add a test.
- S2: inspect TipTap config for an Escape-to-blur handler on ordinary text elements. If absent and desired, add one. Confirm with user whether Escape-exits-editing is wanted (it likely is).
- S4: grep for all `.slide-canvas` mount sites; determine if >1 ever co-exists in the editor route. If yes → use the passed `canvasRef` consistently in move/marquee instead of `document.querySelector`. If single-canvas only → document as non-issue.
- S5: determine if `<Route>` remounts EditorPage on `/editor/:id` change (look for a `key` on the route element / router config). If reused → reset `saveInFlightRef`/`queuedSaveRef`/bump `saveAttemptRef` in the load effect. If remounted → document as non-issue.

## Related Code Files
- Read: `client/src/pages/EditorPage.jsx` (TipTap setup ~627-722; load effect 379-401), `client/src/App.jsx` (route config)
- Modify (conditional): `client/src/hooks/use-keyboard.js` (focus guard), TipTap config (Escape), `use-canvas-pointer-interaction.js` (rect source), `EditorPage.jsx` (save-queue reset)
- Modify: `client/src/editor-interaction-bug-repro.test.js` (ensure all converted; remove file or keep as regression suite)

## Implementation Steps
1. Investigate S1 → confirm/deny with file:line evidence. If confirmed, write test + broaden focus guard.
2. Investigate S2 → confirm/deny; add Escape-to-blur if wanted (ask user).
3. Investigate S4 → grep mount sites; fix or document.
4. Investigate S5 → inspect router; fix or document.
5. **Whole-suite gate:** `npm run test` (unit) → `npm run lint` → `npm run build`. Optionally `npm run test:e2e` for the keyboard/drag flows touched in phase 6.
6. Audit the repro file: every tripwire either converted to a standard passing test or removed; no orphan `it.fails`.
7. Update `docs/` if any user-facing behavior changed (e.g., negative X/Y now allowed, group-duplicate semantics). Update README keyboard table only if a shortcut's behavior changed.

## Success Criteria
- [ ] S1, S2, S4, S5 each confirmed+fixed OR documented non-issue with evidence
- [ ] `npm run test` green, `npm run lint` clean, `npm run build` succeeds
- [ ] No orphan `it.fails` in the repo
- [ ] All 7 original confirmed tripwires now standard passing assertions
- [ ] docs/README reconciled with any behavior changes

## Risk Assessment
- **Risk:** S1 could be a real HIGH hiding as suspected. **Mitigation:** prioritize the S1 investigation first in this phase; if confirmed, consider promoting its fix earlier (it's a one-line guard broadening).
- **Risk:** suspected items get hand-waved closed. **Mitigation:** require file:line evidence to dismiss (per review-audit-self-decision rule: verified decisions need a source note).
- **Risk:** behavior changes drift README/docs. **Mitigation:** explicit docs reconciliation step; element-type count guard test already protects that invariant.
