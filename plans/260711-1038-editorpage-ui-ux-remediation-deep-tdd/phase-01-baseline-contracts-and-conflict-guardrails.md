---
phase: 1
title: "Baseline Contracts And Conflict Guardrails"
status: complete
priority: P0
effort: "2-3 dev-days"
dependencies: []
---

# Phase 1: Baseline Contracts And Conflict Guardrails

<!-- Updated: Validation Session 1 - failed oversized-unload receipt mandates a blocking P0 persistence plan -->

## Overview

Create an evidence-backed safety net before refactoring. Characterize current EditorPage behavior, especially the uncommitted generation-aware save and PPTX fidelity work, and record an immutable implementation boundary for later phases.

## Context Links

- Plan: [EditorPage UI UX Remediation Deep TDD](./plan.md)
- Current orchestration: `client/src/pages/EditorPage.jsx`
- Existing autosave tests: `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx`
- Save queue: `client/src/hooks/use-editor-save-queue.js`
- Generation/conflict store: `client/src/stores/presentation-store.js`

## Requirements

### Functional

- Characterize load, edit, autosave, retry, conflict, teardown, history, vertical-slide, modal, export, game, AI, and PPTX fidelity wiring.
- Characterize current aggregate-generation and idempotency behavior, including verified gaps that become RED tests in Phase 2.
- Capture the current shell landmarks and conditional panel/modal composition.
- Establish a baseline of pre-existing validator failures without weakening gates.

### Non-functional

- No production behavior changes.
- No broad restore/reset/stash/checkout operations.
- New test files remain focused; split before 200 LOC when practical.
- Tests use deterministic fake timers and fixtures, never arbitrary waits.

## Architecture And Dependency Map

```text
Editor mutation
  -> local presentation snapshot
  -> debounce / serialized save queue
  -> api.updatePresentation
  -> generation-safe server route
  -> aggregateGeneration response
  -> queued snapshot adoption

409 STALE_GENERATION
  -> API conflict metadata
  -> presentation-store saveConflict
  -> rejected local snapshot retained

route switch / unload
  -> flush outgoing presentation snapshot once
```

Phase 1 blocks every later phase. It does not depend on application changes.

## File Inventory

| Action | File | Planned impact | Test impact |
|---|---|---:|---|
| Modify | `client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx` | +80-120 LOC | Add generation, idempotency, queue and teardown cases |
| Modify | `client/src/pages/__tests__/editor-page-renderability-spike.test.jsx` | +35-55 LOC | Lock shell landmarks and conditional regions |
| Modify | `client/src/stores/presentation-store.test.js` | +20-35 LOC | Complete conflict clear/adopt/reset behavior |
| Create if needed | `client/src/pages/__tests__/editor-page-conflict-guardrails.test.jsx` | 140-190 LOC | Split high-risk save contracts from oversized suite |
| Delete | None | 0 | No production cleanup in baseline phase |

## Interfaces And Functions To Protect

- `EditorPage({ presentationId, isTemplate, onGoHome })`.
- `persistPresentation`, `processSaveQueue`, `schedulePresentationSave`, `flushPendingSaveNow`.
- `api.updatePresentation(id, data)`, with `data.idempotencyKey` mapped to the `Idempotency-Key` header.
- `adoptAggregateGeneration`, `setSaveConflict`, `clearSaveConflict`.
- Public helper exports used by element/game characterization tests.
- Existing `data-testid`, accessible names, ribbon/panel/modal mounting, and route behavior.

## TDD Test Scenario Matrix

| Priority | Scenario | RED evidence | Expected contract |
|---|---|---|---|
| Critical | Idle sequential generation | Later save uses pre-response generation | Record verified defect; Phase 2 adds RED test and fixes call-time authority |
| Critical | Idempotency continuity | Retry creates unrelated key | Record verified defect; Phase 2 adds RED test and `retryPendingSave` |
| Critical | Queued successor | First response returns new generation | Newer queued snapshot adopts it before dispatch |
| Critical | Stale conflict | 409 becomes generic error | Local snapshot retained; conflict store includes remote generation |
| Critical | Route switch | Save targets incoming ID | Outgoing presentation flushes exactly once |
| Critical | Stale route load | Older request resolves after newer route | Record verified defect; Phase 8 adds load epoch/abort RED test |
| Critical | Teardown | Duplicate request occurs | In-flight save is not duplicated |
| High | Initial load | Mount triggers PUT | No save until a user-visible mutation |
| High | Template save | Presentation route is used | Template path remains generation-agnostic |
| High | Shell landmarks | Refactor can remove regions silently | Header, ribbon, canvas, panels, modals, tour characterized |
| Medium | Save status | Timer/message drift | Saved/error timing and fallback text remain stable |

## Tests Before

1. Add passing characterization for current request bodies, queue counts and generation behavior.
2. Add explicit `STALE_GENERATION` response fixtures that document current unresolved recovery state.
3. Add route-switch and unmount tests with controlled in-flight promises; document stale-load ordering as Phase 8 RED scope.
4. Add landmark/slot assertions to the renderability test.
5. Persist a defect ledger for idle-generation, retry-key, stale-conflict recovery, stale load and oversized unload transport. Do not commit intentionally failing tests in this no-production-change phase.

## Refactor

No production refactor. Test-only seams may be introduced only if they do not change runtime behavior, exported APIs, or event ordering. Phase 2 must recreate the verified generation/retry defects as failing tests before fixing them.

## Tests After

- Confirm no new test is skipped, todo, or marked expected-failure.
- Confirm characterization covers the current PPTX fidelity controls and generation-aware save flow.
- Confirm the API wrapper assertion verifies the actual request body and `Idempotency-Key` header.
- Measure oversized unload behavior in a real browser. If receipt cannot be proven, create a blocking P0 persistence follow-up instead of claiming durability.
- Record exact pre-existing full-suite failures if unrelated, with command and evidence.

## Implementation Steps

1. Capture `git status --short --branch`, focused diffs and a per-phase ownership manifest for every dirty target.
2. Inventory current EditorPage tests and tag each protected workflow.
3. Write RED/characterization cases in risk order.
4. Make test harness changes only where required for determinism.
5. Run targeted unit/component tests.
6. Run autosave/editor E2E.
7. Run lint, full unit, and build.
8. Do not start Phase 2 until all characterization tests pass and verified defects are listed as mandatory Phase 2/8 RED cases.

## Regression Gate

```powershell
npx vitest run client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/__tests__/editor-page-conflict-guardrails.test.jsx client/src/pages/__tests__/editor-page-renderability-spike.test.jsx client/src/hooks/use-editor-save-queue.test.js client/src/stores/presentation-store.test.js
npx playwright test tests/e2e/autosave-flush-on-leave.spec.js tests/e2e/editor.spec.js --project=chromium
git diff --check
npm run lint
npm run test
npm run build
```

## Success Criteria

- [x] Current generation, idempotency, conflict, retry, queue and teardown behavior is characterized without pretending known defects are correct.
- [x] Idle sequential generation and retry-key continuity are mandatory Phase 2 RED cases.
- [x] Stale route load is a mandatory Phase 8 RED case.
- [x] Current PPTX fidelity/save controls remain characterized.
- [x] Shell composition and public EditorPage interface are protected.
- [x] Newly added tests pass against the current working tree.
- [x] No production source file changed.
- [x] Baseline report distinguishes pre-existing failures from plan regressions.
- [x] Oversized unload durability is proven or recorded as a blocking P0 follow-up.

## Completion Evidence

Completed 2026-07-13. Save lifecycle, conflict, retry, generation, teardown, shell, and PPTX fidelity characterization contracts are present and included in the passing focused editor gates. Full release validation remains tracked separately in Phase 9.

## Risk Assessment

- **User-owned diff loss:** use narrow patches only; compare focused diffs before/after.
- **Fake-timer false confidence:** flush timers and microtasks explicitly.
- **Store-only tests miss UI divergence:** assert outgoing requests and rendered outcomes through mounted EditorPage.
- **Oversized test files:** split by lifecycle rather than appending indefinitely.
- **Unsafe rollback across dirty phases:** retain the Phase 1 diff/ownership manifest and generate a focused reverse patch per implementation phase.

## Security And Data Integrity

Generation conflict and idempotency tests are data-loss controls. Never weaken 409 handling, remove conflict metadata, log presentation content, or expose save payloads in durable artifacts.

## Rollback

Remove only newly introduced test files/hunks. Never restore whole dirty source files.

## Next Steps

Proceed to Phase 2 only after this gate is green.
