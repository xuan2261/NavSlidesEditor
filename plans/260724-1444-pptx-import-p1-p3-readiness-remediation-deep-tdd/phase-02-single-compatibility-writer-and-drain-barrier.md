---
phase: 2
title: "Single Compatibility Writer And Drain Barrier"
status: completed
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 2: Single Compatibility Writer And Drain Barrier

## Overview

Make package compatibility outbox the **only** writer on the package-backed import path; await drain before job completion for read-after-write. Aligns code with `docs/export-fidelity-and-limits.md`. Closes audit P1.5 / F-08.

## Context Links

- Research: `../reports/2026-07-24-pptx-p1plus-research-package-job-durability.md` §6 recommended Option A
- `server/services/pptx-import/package-store/import-commit.js` queue outbox
- `server/routes/pptx-import.js` `runImport` still calls `createImportedPresentation`
- `server/services/pptx-import/create-imported-presentation.js` direct `presentations.push`
- `server/services/pptx-import/package-store-runtime.js` `drainPackageCompatibilityOutbox`
- Docs: `docs/export-fidelity-and-limits.md` sole-writer claim

## Requirements

### Functional

- Package-backed import: inject `drainCompatibility` into `runImport` (not only reconcile); **await** after publish before openable complete.
- Do **not** call `presentations.push` on packageCommit path.
- **`stampImportedPresentationFields` mandatory** for outbox payload: same normalization as today’s create path (slide/element IDs, `normalizePresentationNotes`, title fallback, strip template fields, package head stamps). TDD: deep-equal critical fields vs current create output (minus push).
- **Visibility/terminal (locked contract B — Validation V1):** openable client/durable terminal requires presentation listable. Durable GET must not return openable `done`+id while outbox undrained (return `pending-visibility` / drain-verify / withhold presentationId until listable).
- Drain failure after publish → fail job + package rollback (fail closed); concurrent GET during drain throw must not claim openable success.
- Legacy/non-packageCommit test path may still push.
- Docs: sole-writer + visibility contract match code.

### Non-functional

- Preserve generation fencing and mutation results.
- No second storage subsystem.
- Keep lock order: package store + presentations (existing runtime).

## Architecture

```text
prepareImport + publishImport
  -> outbox upsert only (writer A)
  -> durable jobs[] completed receipt
await drainPackageCompatibilityOutbox()
  -> presentations.json row visible
mediaTransaction.commit()
jobManager.completeJob(...)
```

Helper split if needed: pure `stampImportedPresentationFields(mapped, ids)` without push; outbox applies full projection.

## File Inventory

| Path | Action | Notes |
| --- | --- | --- |
| `server/routes/pptx-import.js` | Modify | remove dual write; await drain |
| `server/services/pptx-import/create-imported-presentation.js` | Modify | split stamp vs push |
| `server/services/pptx-import/package-store/import-commit.js` | Verify/modify | outbox payload completeness |
| `server/services/pptx-import/package-store-runtime.js` | Reuse | drain |
| `docs/export-fidelity-and-limits.md` | Patch | sole-writer truth |
| Route + outbox + package-store tests | Modify/create | |

## Dependency Map

- Independent of phase 1.
- **Blocks** phase 3 (report should land on outbox-applied projection).
- **Blocks** phase 4 crash matrix (needs single ordered path).

## Tests Before (TDD)

1. Package path: push **not** called; `drainCompatibility` **awaited** on success path (spy/call order).
2. After success, presentation listable by id without direct push.
3. Drain throws → job failed/cancelled path + rollback; durable/client must not report openable done; no orphan listable row without head policy documented.
4. Stamp parity: critical fields deep-equal stamped vs legacy create (ids, notes, designTokens, package head metadata).
5. Crash between publish and drain: durable GET not openable until drain/reconcile (contract B).
6. Outbox-only then drain → single row.
7. Legacy path without packageCommit still works if supported.

## Refactor / Implementation Steps

1. Extract stamp helper; stop push on package path.
2. Inject `drainCompatibility` into `runImport` (default production drain).
3. Ensure publish outbox payload is complete projection.
4. Order stages: publish → drain → media settle → completeJob.
5. Patch docs narrowly.

## Tests After

- Composition test: outbox empty after complete; one presentation row.
- Regression: package-backed critical journey still passes (E2E later in phase 4/global).

## Regression Gate

```bash
npx vitest run server/routes/pptx-import.test.js server/services/pptx-import/compatibility-outbox.test.js server/services/pptx-import/package-store.test.js
```

## Test Scenario Matrix

| ID | Scenario | Priority |
| --- | --- | --- |
| W1 | Sole writer — no direct push | Critical |
| W2 | Drain before completeJob | Critical |
| W3 | Drain fail → rollback | Critical |
| W4 | Idempotent single row | High |
| W5 | Legacy non-package path | Medium |

## Function / Interface Checklist

- [ ] `runImport` drain barrier
- [ ] Stamp-without-push helper
- [ ] Outbox payload completeness for editor open
- [ ] Docs sole-writer statement true

## Success Criteria

- [ ] W1–W4 green
- [ ] No dual-write on package path in source (grep assert in test)
- [ ] Docs match

## Risk Assessment

| Risk | Mitigation |
| --- | --- |
| Missing fields after removing push | Snapshot compare projection before/after in test |
| Drain latency | Same as other package mutations; accept |
| Dirty docs overwrite | Narrow patch only |

## Security Considerations

- Fail closed on drain error prevents phantom job success without list visibility.

## Todo

- [ ] Tests Before dual-write removal
- [ ] Implement outbox-only + drain
- [ ] Docs patch
- [ ] Regression gate
