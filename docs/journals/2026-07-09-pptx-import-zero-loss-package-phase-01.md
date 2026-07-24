# Journal: PPTX Import Zero-Loss Package (Phase 01)

**Date:** 2026-07-09  
**Plan:** `plans/archive/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`
**Mode:** `/ck:cook --auto --tdd`  
**Slice:** Phase 01 only (MVP-A)

## What landed

- Server persists original `.pptx` under `server/data/pptx-originals/{uuid}.pptx` with sha256 meta on the presentation (`pptxOriginal`).
- Import job atomically: map → persist original → create presentation → `completeJob({ presentationId, stats, warnings })`.
- Rollback original if create fails; cancel before create leaves no orphan.
- `GET /api/presentations/:id/pptx-original` streams bytes (id→uuid only).
- Permanent delete unlinks original; soft-delete keeps for restore.
- Duplicate does copy-on-write of original package (no shared uuid).
- PUT/POST strip client `pptxOriginal` path injection (RT-04).
- `sla-contract.js` engineering milestones; Phase 01 requires **P1** only.
- HomePage opens `presentationId` from job result (legacy client-create fallback retained).

## Verify

- Phase T1 suite: **23+** tests green (original-package, sla-contract, pptx-import route, pptx-original).
- Presentations + H1/M1: green.
- G0 `server/services/pptx-import` + routes: previously **400** green in-session; corpus-baseline re-check **7/7** green.

## Not done (later phases)

- Visual oracle SSIM (Phase 02), scene graph (03), primitives/charts/SmartArt/EMF/roundtrip (04–08).
- Product “1:1 SLA” claim still **forbidden**.

## Review follow-ups applied

- H1 shared original on duplicate → COW.
- M1 PUT rebind hole → freeze server `pptxOriginal`.
- Cancel-after-create → still `done`.

## Follow-up cook (same day)

Committed `efb7efa2` with Phase 02–08 **foundations** (not full SLA):
- Oracle SSIM + CLI (`test:pptx:oracle`)
- OOXML scene graph + strict reconcile
- Theme/color harden, chart matrix, EMF sandbox policy, roundtrip policy

## Unresolved (honest)

1. Full product 1:1 claim still needs multi-month depth (goldens capture, primitives ban, native charts/SmartArt/EMF, layout/animation).
2. Unrelated UI remediation files remain dirty in worktree (out of scope).
