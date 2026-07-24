---
phase: 3
title: "Golden Fixtures And State Assertions"
status: pending
priority: P0
effort: "2-3d"
dependencies: [2]
---

# Phase 3: Golden Fixtures And State Assertions

## Context Links

- [Phase 2 matrix](./phase-02-feature-parity-matrix-and-test-map.md)
- `tests/e2e/fixtures/test-fixtures.js`

## Overview

Create upstream-derived fixture decks and state assertions so tests verify data correctness, not only visible UI.

## Requirements

<!-- Updated: Validation Session 1 - golden fixture provenance strategy confirmed -->

**Functional:**
- Add golden fixture decks covering editor core, elements, export/import, live/game.
- Golden fixtures used for parity must be generated from the approved upstream SHA or include documented upstream provenance and checksum.
- Preferred path: generate parity fixtures from the approved upstream SHA, then store checksum/provenance. Manual fixtures are smoke-only unless they include upstream provenance.
- Manual fixtures may be used for smoke only, not as upstream parity oracle.
- Add helper to snapshot normalized presentation state.
- Assert selection, element properties, slide JSON, persistence, export metadata, uploaded media references, server metadata, browser storage, and live/socket replay state where relevant.
- Run fixtures in isolated per-test temp data/upload/export roots.

**Non-functional:**
- Fixtures must be deterministic.
- No real API keys, external credentials, or production URLs.
- Normalize IDs, timestamps, random values, platform paths, and generated filenames.
- Cleanup must touch only allowlisted temp paths and assert no orphan artifacts remain.

## Architecture

```text
approved upstream SHA -> generated fixture + checksum
    -> isolated temp data root
    -> user action
    -> normalized subsystem state
    -> compare with expected JSON/artifact manifest
    -> teardown + orphan check
```

## Related Code Files

**Read:**
- `tests/e2e/fixtures/test-fixtures.js`
- `client/src/stores/presentation-store.test.js`
- `client/src/stores/editor-store.test.js`
- `client/src/utils/export-project.test.js`

**Create/Modify:**
- `tests/e2e/fixtures/upstream-golden-fixtures.js`
- `tests/e2e/helpers/presentation-state-assertions.js`
- targeted fixture tests under `tests/e2e/`

## Implementation Steps

1. Define normalized state fields:
   - slide count
   - element count/type/order
   - x/y/width/height/rotation
   - content/style fields
   - hidden/fragments/background/footer
   - uploaded asset references and file existence
   - export/import manifest metadata
   - relevant localStorage/UI settings
   - version history metadata
   - live annotations and replay state for live-specific checks
2. Define fixture provenance:
   - upstream SHA
   - generation command
   - generated artifact checksum
   - owner/date
3. Add a bounded fixture set:
   - `editor-core-golden`
   - representative `elements-golden`
   - `export-import-golden`
   - live/game smoke fixture only if state is stable enough for deterministic assertion
4. Add actions that mutate fixtures.
5. Compare normalized state before/after reload.
6. Save expected JSON snapshots and artifact manifests.
7. Use unique temp storage per spec and teardown with orphan checks.

## TDD / Tests

- Red: failing test where normalized state helper expects a known persisted field or artifact manifest field not implemented.
- Green: implement minimal normalization and fixture load.
- Refactor: extract helper, remove duplicated assertions.

## Todo List

- [ ] Add golden fixture module.
- [ ] Add normalized state helper.
- [ ] Add reload/persistence assertions.
- [ ] Add fixture docs in matrix.

## Success Criteria

- Golden fixtures load in Playwright.
- Parity fixtures record upstream provenance and checksum.
- State assertions fail when key element fields drift.
- Persistence check catches save/reload regressions.
- Temp storage cleanup prevents cross-test contamination.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Snapshot churn | Medium | Normalize IDs/timestamps/random fields |
| Over-testing implementation details | Medium | Assert public presentation schema, not React internals |
| Fixture encodes current behavior instead of upstream | Critical | Generate from approved upstream SHA or mark fixture smoke-only |
| Stale artifacts cause false pass | Critical | Use per-test storage roots and teardown orphan checks |

## Security Considerations

- Fixtures must use local assets or inert data URLs.
- Fixture artifacts must not include real credentials or private local paths.

## Red Team Adjustment

- Golden fixtures now require upstream provenance. Checked-in/manual fixtures cannot be called upstream parity oracles without SHA/checksum evidence.
- State assertions are expanded beyond element JSON and must run under isolated temp storage with cleanup verification.

## Next Steps

- Use fixtures in Phase 4 and 5.

## Unresolved Questions

- None. Validation chose upstream-generated fixtures with checksum/provenance.
