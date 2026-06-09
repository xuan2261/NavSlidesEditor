---
title: "EditorPage Element Interaction Bug Fixes (TDD)"
status: completed
created: 2026-06-08
completed: 2026-06-09
mode: deep
tdd: true
scope: project
blockedBy: []
blocks: []
---

# EditorPage Element Interaction Bug Fixes (TDD)

## Goal

Fix the element/control interaction defects on EditorPage found by the 5-agent
debug audit (2026-06-08). 7 bugs are **runtime-confirmed** via `it.fails`
tripwires in `client/src/editor-interaction-bug-repro.test.js`; the rest are
source-traced. TDD: every phase writes failing tests first, then fixes until green.

## Source of Truth

- Audit findings: this conversation's 5 debugger reports (canvas, autosave,
  clipboard, properties/ribbon, keyboard).
- Confirmed repros: `client/src/editor-interaction-bug-repro.test.js`
  (H3, H5×2, L1, M1×2, M4 — currently passing as `it.fails`, i.e. bug-present).
- Accepted decisions: groupId **remap to new id per paste/dup** (Option A);
  fix-first hybrid (no broad E2E scaffolding before fixes).

## User Decisions (2026-06-08, locked)

1. **Multi-select numeric entry:** X/Y apply as **delta** (preserve relative
   layout — safe with group auto-select); W/H apply **absolute** (PowerPoint
   "make same size"). [Phase 2]
2. **Duplicate/copy a group containing a locked member:** duplicate the
   **non-locked** members, skip locked (consistent with delete). NOT abort-all.
   [Phase 3, requires changing `createDuplicateOperation:71`]
3. **Ctrl+D must NOT overwrite the copy/cut clipboard.** [Phase 3]
4. **Paste a single member of a group:** **drop groupId**. Only mint a new
   shared groupId when ≥2 pasted elements share the same source group. [Phase 3]

## Red-Team Amendments (2026-06-08)

3 hostile reviewers found 6 BLOCKER design defects + several under-scoped seams.
Corrections folded into the phases below. Key reversals from the first draft:

- **P1 transport:** `navigator.sendBeacon` is POST-only; save route is **PUT**
  (`presentations.js:261`). Use `fetch(url,{method:'PUT',keepalive:true})`. Check
  payload <64KB (data-URL media risk); fall back to sync flush + warn if larger.
- **P1 flush placement:** flush belongs in the **unmount-only** effect (~521-527),
  NOT the per-edit autosave cleanup (~507-519) which runs every keystroke.
- **P1 M11:** needs a dedicated one-shot `seededRef` read by the history effect.
  A `historyRef.length===1` guard eats the first edit's undo (autosave effect
  consumes `isFirstLoad` before the history effect runs).
- **P1 A→B nav:** same component instance on `/editor/:id` change → no unmount →
  pending save dropped. Drain queue in the load effect before overwriting state.
- **P3 L1:** `createPasteOperation` is pure → can't cascade across identical
  calls. Add `pasteIndex` param; reset counter on copy/cut.
- **P5 clampToSlide:** runs AFTER `applyResize` on the unrotated box → undoes the
  rotated world-anchor near slide edges. Must be made rotation-aware too.
- **P6 e.repeat:** scope the guard to discrete chords (Ctrl+K/Ctrl+G), NOT the
  global handler — a blanket guard kills held-arrow nudge.
- **P6 F8:** game keys in-editor are **deliberately wired** (HUD/reveal/timer);
  blanket present-mode gating removes a feature. Gate only the nuisance bare-keys
  (Space/1-4) behind a preview toggle; keep HUD/reveal.
- **Verified-sound (keep as-is):** H6 (remove only the Ctrl+F branch, keep legacy
  slide-sorter listener), center-anchor assumption, H1+H4 no collision.
- **Reviewer attacks that did NOT hold (don't over-correct):** FP drift at 0°
  rotation (exact in IEEE-754), transform-origin mismatch, stale-doc write on nav.

## Severity Legend

`C`=Critical (data loss) · `H`=High · `M`=Medium · `L`=Low · `S`=Suspected

## Phases

| # | Phase | Bugs | Priority | Status |
|---|-------|------|----------|--------|
| 1 | [Critical Autosave & History Lifecycle](phase-01-critical-autosave-history-lifecycle.md) | C1, M11, M12, L4 | P1 | completed |
| 2 | [Apply-to-Selection Unification](phase-02-apply-to-selection-unification.md) | H1, M7, M8 | P1 | completed |
| 3 | [Clipboard & Grouping Correctness](phase-03-clipboard-grouping-correctness.md) | H5, L1, L2 | P1 | completed |
| 4 | [Locked/Hidden Guards & Z-Order](phase-04-locked-hidden-guards-z-order.md) | M1, M4, M6, L3 | P2 | completed |
| 5 | [Rotation-Aware Geometry & Crop](phase-05-rotation-aware-geometry-crop.md) | H3, M2, M5, M3, S3 | P2 | completed |
| 6 | [Keyboard, Focus & Undo Reconciliation](phase-06-keyboard-focus-undo-reconciliation.md) | H6, H2, H4, F2, F3, F8 | P1 | completed |
| 7 | [Verification & Suspected-Bug Confirmation](phase-07-verification-suspected-bug-confirmation.md) | S1, S2, S4, S5 | P2 | completed |

## Execution Order

1 (Critical) → 3 → 2 (P1 user-facing) → 6 (P1 keyboard) → 4 → 5 → 7 (verify/confirm).

**Hard ordering constraint (not "independent"):** Phases 4 and 5 BOTH edit
`alignElements` (`use-slide-operations.js:140-215`) — P4 adds the locked-filter,
P5 rewrites the bbox math to rotated AABB. Run **4 before 5**, and write P5's
rotated-bbox math against the **post-P4 (locked-filtered) `els` set**. Do NOT run
4 and 5 in parallel branches. Phase 6 touches EditorPage selection state shared
with 1/2 — run after 2.

## Key Dependencies

- Vitest + `@testing-library/react` (`renderHook`, `act`) — already in repo.
- Phase 2 introduces `updateSelectedElements` consumed by panel + ribbon; phases
  4/5 reuse the locked/rotation helpers it does NOT add (keep them local).
- Repro tripwires flip **red** when their bug is fixed → convert to standard
  regression tests in the same phase (do not leave `it.fails` once green-correct).

## Global Success Criteria

- [x] All 7 confirmed tripwires converted to passing standard assertions
- [x] `npm run test` green; `npm run lint` clean; `npm run build` succeeds
- [x] No new `it.fails` left in the repo except genuinely-deferred items (phase 7)
- [x] README/docs unchanged in behavior claims, or updated if behavior changes
