---
phase: 3
title: "Package-Backed Critical Journey"
status: completed
priority: P1
effort: "2-3 days"
dependencies: [1, 2]
---

# Phase 3: Package-Backed Critical Journey

## Overview

Replace copy-to-legacy E2E flows with one real package-backed lifecycle: import, edit, generation-fenced save, reload, immutable-original verification and validated-export success or typed fail-closed behavior.

## Status — Authority Repairs Closed; Phase 4 Still Evidence-Blocked (2026-07-24)

The serialized real-ID Playwright journey passed all 3 covered specs. The authority follow-up binds rollback receipts to the exact committed head, rejects rollback after a same-R0 generation-2 successor, and treats an already-complete rollback as a durable no-op only when job and presentation identities match. Legacy receipts lacking immutable outcome coordinates remain loadable but fail closed with `LEGACY_IMPORT_RECEIPT_UNSUPPORTED`. Job-lifecycle timeout/cleanup reporting now preserves sanitized server `409` reconciliation `reasonCode` values (not only the legacy sentinel). Focused authority suites: package-store + oracle actuals + HTTP boundary + durable-job route = 71/71. Phase 4 remains blocked on trusted PowerPoint evidence and plan-level claim gates. The separate broad-suite matrix-path triage remains open and is not attributed to this journey.

### P0 Authority Completion Checklist

- [x] Replace unsafe automatic migration for legacy import receipts lacking immutable outcome coordinates with explicit fail-closed operational handling.
- [x] Prove a matrix/fencing epoch change cannot authorize rollback, while preserving the package-store typed reconciliation `reasonCode`.
- [x] Preserve server `409` reconciliation `reasonCode` through job-lifecycle timeout/reconciliation errors and cleanup reporting, then obtain blocker-only re-review.
- [x] Validate the import receipt's job/presentation binding before accepting an already-rolled-back no-op, then obtain blocker-only re-review.

<!-- Updated: Red Team Review 1 + Validation Session 1 - strict generation advance and serialized imports -->

## Context Links

- Current bypass: `tests/e2e/pptx-import-fidelity.spec.js:43-58`.
- Current critical bypass: `tests/e2e/critical-pptx-journey.spec.js:36-59`.
- Package routes: `server/routes/presentations.js:377-474`.
- Validated export contract: `server/routes/pptx-edited-export.js:29-94`.
- Generation commit: `server/services/generation-safe-save.js:139-185`.
- Single import slot: `server/services/pptx-import-job-manager.js:3-15`.
- Existing real-ID precedent: `tests/e2e/pptx-import-async.spec.js:4-23`.

## Requirements

### Functional

- Every covered PPTX E2E retains the actual terminal `presentationId`.
- No `apiUpdatePresentation(testPresentation.id, imported)` copy or early imported-ID deletion.
- Read initial authoritative generation `G1` and raw original bytes/hash.
- Edit a deterministic supported text primitive through the UI.
- Wait for save quiescence and require final authoritative `G2 > G1`; do not accept no-op equality.
- Reload the same ID; marker persists and editor/fidelity generation equals stable `G2`.
- Original hash after edit equals pre-edit/source hash exactly.
- Query fidelity DTO after save.
- If validated edited export is available, send exact generation/idempotency headers and require PPTX bytes plus successor generation.
- If unavailable, require the exact typed status/reason; never silently return reconstructed export.
- Keep reconstructed export as an independent assertion when retained.
- Delete only the imported presentation in `finally`.

### Non-functional

- Use a deterministic corpus fixture and source-identity-aware text selection.
- No direct package-store mutation from E2E.
- No conditional assertion that accepts contradictory outcomes; branch only from authoritative fidelity DTO.
- Run all import E2Es with `--workers=1` because the application has one import slot.
- Product source changes are conditional on a reproduced red defect, not pre-authorized refactors.

## Architecture

```text
POST /api/pptx/import
  -> poll terminal job
  -> package-backed presentationId
  -> authoritative GET + generation G1
  -> GET pptx-original -> SHA-256 H0 == source hash
  -> edit supported text at /editor/:presentationId
  -> poll marker + stable generation G2, require G2 > G1
  -> reload same ID -> marker and generation G2
  -> GET pptx-original -> H1 == H0
  -> GET pptx-fidelity at G2
  -> POST pptx-edited with If-Pptx-Generation + Idempotency-Key
       available: 2xx package + X-Pptx-Generation
       unavailable: exact typed fail-closed response
```

Save quiescence means the marker exists and the same generation is observed in two consecutive authoritative polls after the UI reports save completion. This permits multiple autosaves but establishes one final `G2` for reload assertions.

## File Inventory

| Action | File | Rough change | Test impact |
| --- | --- | --- | --- |
| Modify | `tests/e2e/helpers/pptx-import-api-helper.js` | M, keep <200 LOC | Shared terminal wait/cleanup |
| Modify | `tests/e2e/critical-pptx-journey.spec.js` | L; extract helpers if >200 LOC | Real lifecycle |
| Modify | `tests/e2e/pptx-import-fidelity.spec.js` | M | Real imported ID for bounds |
| Modify if needed | `tests/e2e/fixtures/test-fixtures.js` | S | Raw byte/hash helpers |
| Modify if needed | `tests/e2e/pages/editor-page.js` | S | Stable edit/save selectors |
| Verify | `tests/e2e/pptx-import-async.spec.js` | No behavior change | Real-ID upload flow |
| Verify | `server/routes/pptx-original.test.js` | Existing gate | Immutable original |
| Verify | `server/routes/pptx-edited-export.test.js` | Existing gate | Generation/idempotency/fail-closed |
| Verify | `server/services/validated-edited-export-materialization.test.js` | Existing gate | Package materialization |
| Verify | `client/src/hooks/use-export-actions.test.js` | Existing gate | Generation adoption |
| Conditional | `client/src/hooks/editor-controller/use-editor-save-controller.js` | Only after red E2E | Save authority defect |
| Conditional | `client/src/stores/presentation-store.js` | Only after red E2E | DTO generation defect |
| Conditional | `server/routes/presentations.js` | Only after red E2E | Route/DTO defect |

## Function and Interface Checklist

- [x] Import helper returns `{ jobId, presentationId, result }`; never clones JSON.
- [x] Wait helper centralizes terminal status and honors product admission contract.
- [x] Cleanup takes only IDs created by the test.
- [x] Authoritative read obtains generation from the documented editor/fidelity DTO field.
- [x] Raw response bytes and source file use the same SHA-256 algorithm.
- [x] Save wait records stable `G2` and asserts `G2 > G1`.
- [x] Reload and fidelity DTO report exact stable `G2`.
- [x] Validated request sends `If-Pptx-Generation: G2` and unique `Idempotency-Key`.
- [x] Success validates PPTX package signature/content type and successor header.
- [x] Unavailable validates exact status/code/reason and zero fallback download.

## Dependency Map

```text
Phase 1 transport -----------> serialized import helper
Phase 2 truthful stats ------> fidelity DTO assertions
package-backed ID -----------> save controller ----------> G2 > G1
immutable R0 ---------------> original hash invariant
fidelity DTO ---------------> validated export outcome
Phase 3 ---------------------> Phase 4 package-backed actual capture
```

## Tests Before

1. Remove one legacy copy and show current test assumptions fail on actual imported ID.
2. Add source/first-original SHA-256 equality.
3. Capture `G1`, edit marker, poll stable `G2`, require `G2 > G1`.
4. Reload and assert marker plus exact `G2`.
5. Assert second-original hash remains equal.
6. Drive validated export from current fidelity DTO and assert one exact outcome.
7. Update bounds/fidelity spec to keep actual ID through render.
8. Run the three specs with `--workers=1` before conditional source changes.

## Refactor

1. Consolidate duplicated job polling into existing PPTX E2E helper.
2. Remove target legacy presentation parameters from import helpers.
3. Navigate actual imported ID.
4. Add stable generation and raw-byte hash utilities.
5. Keep original, validated and reconstructed export surfaces explicit.
6. Add cleanup in `finally` only.
7. Fix the smallest owning source function only if red journey proves a product defect.

## Tests After

- One imported ID persists from terminal job through cleanup.
- Marker edit produces stable `G2 > G1`.
- Reload reads package-backed projection at `G2`.
- Original R0 hash never changes.
- Validated export cannot succeed without generation evidence and cannot silently become reconstructed export.
- Serial execution avoids one-slot retry contention.

## Test Scenario Matrix

| Priority | Scenario | Expected |
| --- | --- | --- |
| Critical | Import → edit → save same ID | Marker persists; `G2 > G1` |
| Critical | Reload same ID | Marker and exact `G2` retained |
| Critical | Original before/after | Both hashes equal source |
| Critical | Validated export available | 2xx PPTX + successor generation |
| Critical | Validated export unavailable | Exact typed fail-closed result |
| High | Stale generation | Existing unit gate returns conflict/current generation |
| High | Repeated idempotency key | Existing unit gate proves replay/no extra mutation |
| High | Bounds audit | Real imported ID only |
| Medium | Assertion failure | `finally` cleanup still removes created ID |

## Implementation Steps

1. Extend E2E import helper.
2. Rewrite critical journey without fixture copy.
3. Add stable generation/hash/reload assertions.
4. Add exact validated-export outcome.
5. Rewrite fidelity spec to keep imported ID.
6. Run executable gate with `--workers=1`.
7. Run package route/client unit gates.
8. Diagnose any product red path before changing source.

## Todo

- [x] Centralize package-backed import wait/cleanup.
- [x] Remove legacy fixture copies.
- [x] Require stable `G2 > G1` and reload equality.
- [x] Verify immutable original hash.
- [x] Verify validated export success/fail-closed.
- [x] Serialize import E2Es.
- [x] Run package/browser gates.

## Success Criteria

- [x] No covered PPTX spec copies imported JSON to `testPresentation.id`.
- [x] Critical journey uses one real imported ID.
- [x] Supported edit produces `G2 > G1` and survives reload at `G2`.
- [x] R0 hash remains exact source bytes.
- [x] Validated export matches fidelity DTO/generation contract exactly.
- [x] All focused E2E runs use one worker and pass without retry-order flake.

## Regression Gate

```bash
npx vitest run server/routes/pptx-original.test.js server/routes/pptx-edited-export.test.js server/services/validated-edited-export-materialization.test.js client/src/hooks/use-export-actions.test.js client/src/hooks/editor-controller/use-editor-save-controller.test.jsx
npx playwright test --workers=1 tests/e2e/pptx-import-async.spec.js tests/e2e/pptx-import-fidelity.spec.js tests/e2e/critical-pptx-journey.spec.js
```

## Risk Assessment

- **Autosave flake:** marker plus two stable authoritative generation polls; no blind sleeps.
- **No-op laundering:** marker is a real content change; generation equality is failure.
- **Conditional branch masks defect:** derive exactly one expected route outcome from fidelity DTO.
- **Hash encoding error:** hash raw bytes only.
- **Import contention:** mandatory single worker.
- **Cleanup hides failure:** `finally` only; do not delete before render/assertions.

## Rollback

Helper/spec changes are isolated. If source work is required, revert it independently while retaining the red package-backed journey as a documented blocker.
