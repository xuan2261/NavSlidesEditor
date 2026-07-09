# Journal: PPTX Import Zero-Loss Package (Phase 01)

**Date:** 2026-07-09  
**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
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

## Unresolved

1. HomePage working tree also contains import-button a11y ref changes beyond presentationId wiring — confirm whether to ship together.
2. Other UI remediation files dirty in worktree are **out of scope** for this phase commit.
