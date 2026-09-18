---
phase: 5
title: 'Stable source identity and mutation journal'
status: in-progress
effort: '4-5 weeks'
dependsOn: [1, 3]
priority: P0
gates: [G2-foundation]
---

# Phase 5: Stable source identity and mutation journal

<!-- Updated: Validation Session 1 - canonical server-side snapshot diff selected as the first-release mutation transport. -->

> **Session 4 local-scope supersession:** Phase 5 owns source identity and the
> mutation journal only. Phase 11 consumes that identity and journal for
> transactional export. Phase 13 owns local PowerPoint evidence. This note
> supersedes only conflicting Session 4 local-scope assignments; the historical
> text below is preserved.

## Overview

Replace deck-wide `_pptxEdited` and heuristic `slideIndex:nodeId` authority with
server-owned stable source references, optimistic concurrency, canonical snapshot
diffing, and a net mutation journal. This phase stops at production-ready identity,
journal, generation, idempotency, and transaction interfaces. Phase 11 exclusively
closes the validated-export vertical slice.

## Context Links

- [Approved claim-driven roadmap](./reports/260711-1705-pptx-claim-roadmap-brainstorm.md)
- [Phase 11 validated export](./phase-11-part-aware-transactional-patch-export.md)

## Existing Seams

- `shared/src/types/presentation.js`
- `server/routes/presentations.js`
- `server/services/pptx-import/importer.js`
- `server/services/pptx-import/ooxml-scene-graph/attach-source-nodes.js`
- `server/services/pptx-import/ooxml-scene-graph/index.js`
- `server/services/pptx-import/roundtrip-policy.js`
- `server/services/pptx-import/roundtrip-original-parts.js`
- `client/src/hooks/use-export-actions.js`

Current name/kind/order matching remains useful as diagnostic confidence, but only exact source references may authorize package mutation.

## Source Identity Contract

`SourceRef` includes:

- schema/package generation;
- owning package revision and part URI;
- object kind and native non-visual property ID where present;
- relationship chain for dependent parts;
- group ancestry and fragment/occurrence path;
- source XML or canonical source hash;
- authoritative match method and confidence;
- tombstone/replacement lineage for structural edits.

Slide identity uses the presentation relationship and slide part URI, not slide index. Reorder changes sequence, not identity. Duplicate creates a new lineage and new native IDs. Ambiguous, duplicate, missing, or source-hash-mismatched identity is non-patchable until reconciled.

## Save and Journal Contract

- Client submits editable presentation state plus the aggregate-head generation; it does not submit authoritative `_pptx*` fields.
- Server loads the canonical prior projection, strips/ignores client authority metadata, validates schemas, and computes a canonical diff.
- The first release exposes no separate explicit operation API. All authoritative journal operations derive from the canonical server-side snapshot diff; explicit/hybrid transport is deferred.
- Server rejects stale saves with a typed conflict and current aggregate generation.
- Projection revision, base package revision, source-map version, pending journal hash, and per-claim evidence subjects are published together through the Phase 3 metadata-root transaction after checking the expected aggregate generation.
- A successful save returns the authoritative successor generation and request idempotency outcome. The client rebases current and queued edits before sending another save.
- A 409 response returns the current generation and typed conflict reason. Teardown never blindly retries a stale generation.
- Journal operations have stable operation IDs, source refs, canonical before/after values, affected properties, impact closure, inverse/recovery data, and patchability reason.
- Repeated saves collapse to the final net effect. Edit then revert produces no patch.
- Journal replay is deterministic and idempotent against the declared base revision.
- Public/share/history payload policies explicitly include or exclude internal fields.

## TDD Matrix

| Test first                    | Expected red                           | Green behavior                                                          |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Client forges source ref      | Full snapshot trusted                  | Server-owned mapping wins; tamper logged/rejected                       |
| Concurrent stale save         | Last writer wins                       | Metadata transaction's generation predicate returns conflict            |
| Slide reorder                 | Identity changes by index              | Part URI identity remains stable                                        |
| Object duplicate/delete       | IDs collide/reuse                      | New lineage or tombstone is explicit                                    |
| Nested groups                 | Order heuristic authorizes edit        | Ancestry/native ID required                                             |
| Duplicate names/IDs           | Wrong node patched                     | Ambiguity blocks mutation                                               |
| Parser drops names            | Source attachment weakens              | Native names/IDs retained before reconciliation                         |
| Edit then revert              | Deck remains dirty                     | Net journal empty and original path restored                            |
| Retry same operation          | Patch applies twice                    | Idempotent operation ID                                                 |
| Public/share GET              | Internal paths leak                    | Authority metadata removed                                              |
| Legacy `_pptxEdited`          | Old deck cannot migrate                | Conservative journal migration/fallback                                 |
| Source hash drift             | Stale ref patches new XML              | Precondition failure, no publication                                    |
| Save crash during head update | Projection/journal generations split   | State-root predecessor remains the only visible consistent aggregate    |
| Queued self-conflict          | Save B retains Save A's old generation | Save response rebases current and queued snapshots                      |
| Teardown stale retry          | Keepalive resends obsolete body        | Idempotency result is reconciled; stale teardown is not retried blindly |
| Pathological snapshot         | Canonical diff multiplies 50 MB body   | Structural budgets reject before canonicalization                       |

## G2 Contract Handoff

Before Phase 11:

1. Production import publishes R0, canonical projection, and authoritative source map.
2. Save one text change using the current aggregate-head generation token.
3. Derive one deterministic journal operation and exact impact closure.
4. Replay and compact the journal without touching package bytes.
5. Verify forged, stale, ambiguous, or source-hash-mismatched authority blocks.
6. Return the successor generation and reconcile queued/idempotent saves.
7. Hand the immutable base revision, source map, compacted journal, matrix hash,
   and expected projection to the existing transaction interface.

No staged patch, OfficeCLI process, native re-import, R1 publication, or release
claim closes in this phase.

This slice is intentionally narrow but proves the architecture before broad feature implementation. Phase 11 generalizes and hardens publication.

## Implementation Steps

1. Define and test versioned source-reference and journal schemas.
2. Preserve parser names/native IDs before source attachment.
3. Build a server-side source-map store keyed by presentation/revision.
4. Refactor reconciliation to distinguish authoritative, diagnostic, ambiguous, and missing matches.
5. Add aggregate generation/idempotency tokens, deterministic 409 payloads, and one lock-scoped metadata-root transaction for projection/package/source-map/journal/per-claim-evidence subjects.
6. Add strict pre-diff budgets for slides, elements, nesting, strings, passthrough data, journal operations, inverse size, runtime, and aggregate storage.
7. Update normal autosave and teardown transport to adopt successor generations, rebase queued snapshots, distinguish self-issued versus remote conflicts, and reconcile idempotency outcomes.
8. Canonicalize editable presentation snapshots before diffing.
9. Implement property, element, slide, reorder, duplicate, delete, and net-zero journal operations.
10. Strip source/package/journal authority from incoming and public payloads through Phase 3 DTO schemas.
11. Add legacy migration and explicit package-export fallback when identity is not authoritative.
12. Protect the existing authoritative export transaction interface and endpoint,
    but leave validator injection and availability in Phase 11.
13. Implement and fault-test the G2 contract handoff without package mutation.
14. Add audit diagnostics for source ambiguity without exposing content or paths.
15. Update roundtrip policy to consume revision/journal state instead of `_pptxEdited`.

## File Plan

- Extend shared schemas in `shared/src/types/presentation.js` only with a safe public aggregate-head generation token.
- Add server-only source-map and journal modules under `server/services/pptx-import/`.
- Modify `presentations.js` save/load paths for metadata-root generation predicates and authority stripping.
- Modify editor autosave, queue, teardown, and API error contracts for generation rebasing and idempotency.
- Refactor scene-graph attachment/reconciliation modules.
- Modify roundtrip policy and focused client save conflict handling.
- Add unit, route, migration, property, and end-to-end fixture tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/source-map.test.js
npx vitest run server/services/pptx-import/mutation-journal.test.js
npx vitest run server/routes/presentations.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Run the source/journal handoff command with deterministic journal and generation
reports. Phase 11 owns package hash and local diagnostic PowerPoint probes. Fault
injection covers save publication and operation retry.

## Deep File Inventory

| Action | File/interface                               | Planned change                                                   | Test impact              |
| ------ | -------------------------------------------- | ---------------------------------------------------------------- | ------------------------ |
| Modify | `ooxml-scene-graph/attach-source-nodes.js`   | Replace heuristic authority with exact part/native identity      | Import identity fixtures |
| Modify | `source-map.js`                              | Persist revision-bound authoritative refs                        | Source-map tests         |
| Modify | `mutation-journal.js`                        | Canonical row-addressed net operations                           | Property/replay tests    |
| Modify | `generation-safe-save.js`                    | Successor generation and durable idempotency reconciliation      | Save/route tests         |
| Modify | `presentations.js` and client save transport | Strip forged authority; typed 409/rebase                         | Route/store tests        |
| Modify | `transactional-patch-planner.js`             | Accept canonical matrix row IDs at interface boundary            | Planner contract tests   |
| Create | Production source-map builder/store          | One server-owned authority seam                                  | Import integration tests |
| Create | Save/journal fault harness                   | Every state-root save boundary                                   | Fault tests              |
| Delete | None                                         | `_pptxSource` and `_pptxEdited` remain diagnostic/migration only | Architecture tests       |

## Function and Interface Checklist

- [ ] Preserve `createSourceRef()`, `createSourceMap()`, and `assertPatchableSource()`.
- [ ] Preserve `deriveMutationJournal()` and `replayJournal()`.
- [ ] Build refs from slide part URI, native ID, ancestry, and source hash.
- [ ] Return deterministic current/successor generation and conflict reasons.
- [ ] Bind idempotency key to request hash.
- [ ] Produce the exact Phase 11 transaction handoff envelope.

## Tests Before

1. Production imports still expose heuristic `_pptxSource` instead of authoritative refs.
2. Ambiguous duplicate IDs/names and parser identity loss can reach journal derivation.
3. Queued/teardown saves can reuse stale generations or ambiguous idempotency results.
4. Matrix row/hash mismatch is absent from journal preconditions.
5. Faulted save can expose split projection/source-map/journal generations.

## Refactor

Move source authority and journal derivation behind server-owned services. Keep the
current save API and snapshot-diff transport. Do not build another operation API.

## Tests After

- Reorder preserves part identity; duplicate creates lineage; delete creates tombstone.
- Forged client authority has no effect and never leaks.
- Journal replay is deterministic, idempotent, compacted, and matrix-addressed.
- Every successful save rebases queued work to the successor generation.
- The Phase 11 handoff is complete but cannot publish package bytes itself.

## Dependency Map

```text
G0 canonical rows + Phase 3 R0/head
  -> authoritative source map
  -> canonical server snapshot diff
  -> generation-safe mutation journal
  -> Phase 11 transaction handoff
```

## Debug and Reports

- `reports/phase-05/source-identity-collision-matrix.json`
- `reports/phase-05/journal-replay-property-tests.json`
- `reports/phase-05/authority-boundary-audit.md`
- `reports/phase-05/text-edit-vertical-slice.json`
- `reports/phase-05/transaction-fault-injection.json`

## Risks and Controls

- **Wrong-object mutation:** only authoritative identity may patch; ambiguity blocks.
- **Lost updates:** one metadata-root generation predicate under the exclusive writer lock with typed conflict UX.
- **Journal explosion:** canonical net-effect compaction and bounded history.
- **Snapshot amplification:** reject structural/resource budgets before canonicalization or inverse generation.
- **Client tampering:** server-owned maps and explicit serialization boundaries.
- **Legacy incompatibility:** conservative fallback retains original and labels regenerated export.

## Success Criteria

- [x] Slide reorder, element reorder, nested groups, duplicate names/IDs, and deletion cannot misauthorize a patch.
- [x] Stale saves conflict instead of overwriting newer work.
- [x] Successful saves rebase current and queued snapshots to the successor generation.
- [ ] Teardown cannot replay a stale generation or lose an ambiguous idempotent outcome.
- [ ] Over-budget snapshots fail before canonicalization, diffing, inverse generation, or package cloning.
- [ ] Save fault injection cannot expose a projection, package, source-map, or journal from different generations.
- [x] Client-forged package/source/journal fields have no authority and do not leak publicly.
- [x] Journal replay is deterministic, idempotent, and net-zero aware.
- [x] Every first-release journal entry is server-derived from the canonical snapshot diff; no client operation payload has package authority.
- [ ] Production R0, authoritative source map, canonical projection, compacted
      journal, matrix hash, and expected projection form one deterministic Phase 11
      handoff; this phase does not publish R1.
- [x] Phase 5 and Phase 11 use one authoritative transaction engine and endpoint.
- [ ] Focused identity/journal/route tests, corpus, lint, unit, and client build validators pass.

## Session 4 Local Scope Rebase: Active Phase Contract

The canonical server diff emits only exact G0 row IDs and the full matrix
schema/version/hash subject. It binds each operation to that row's current
impact, production transport/schema, normalization/version, and eligibility
policy/version. A missing, unknown, duplicate, contradictory, stale, or
noncanonical row binding is a typed fail-closed journal result and never reaches
adapter selection or a claim.

Row qualification, transaction eligibility, and promotion remain separate
immutable journal inputs. A sibling, family, historical, or rolled-back subject
cannot supply any state. Matrix or policy evolution creates a new journal subject
and leaves historical journals and their original matrix bytes unchanged; pending
journals require rederivation against the current package head and matrix before
Phase 11 can execute or publish an edited revision.

Every derived journal binds the package data directory's current global
`matrixAuthorityEpoch`. Crash recovery may never lower that high-water value.
After matrix evolution or a restore-forward authority change, journal derivation,
save, and export stay blocked until an atomic state-root publication has reissued
current authority to every live presentation head or marked unreissued heads
invalid fail-closed.

Inventory every planner and journal worker's non-success return. Each must emit
registered `reasonCodes` and the current `reasonCodeSubject`; no missing,
unregistered, or stale reason-code subject may cross the Phase 11 handoff.
