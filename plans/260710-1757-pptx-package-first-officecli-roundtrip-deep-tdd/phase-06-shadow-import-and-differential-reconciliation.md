---
phase: 6
title: 'Shadow import and differential reconciliation'
status: in-progress
effort: '3-4 weeks'
dependsOn: [1, 2, 4, 5]
priority: P1
gates: [G0-consumer, G4-evidence]
---

# Phase 6: Shadow import and differential reconciliation

## Overview

Run the contained production native importer and separately qualified,
contained OfficeCLI read-only inspection against the same immutable revision,
normalize their inventories, and reconcile differences without silently preferring
either source. Shadow mode produces diagnostics and stronger source maps first;
promotion to authoritative behavior is feature-by-feature and evidence-driven.

Reconciliation output uses canonical Phase 1 row IDs and matrix hash. It can
strengthen source authority only for exact, unambiguous, evidence-complete
matches; it cannot promote a claim row or authorize a patch by itself.

## Existing Seams

- `server/services/pptx-import/importer.js`
- `server/services/pptx-import/ooxml-scene-graph/`
- `server/services/pptx-import/mapper/`
- `server/services/pptx-import/ooxml-chart-parser.js`
- `server/services/pptx-import/ooxml-diagram-parser.js`
- `server/services/pptx-import/ooxml-animation.js`
- `server/routes/pptx-import.js`
- PPTX corpus and semantic coverage runners

Phase 1 must already route the corpus through the production scene-graph importer. This phase keeps that invariant and adds OfficeCLI shadow comparison; it must not reintroduce a corpus-only importer.

## Normalized Inventory

Per slide and package:

- stable slide part identity, size, layout/master/theme chain;
- object kind, native ID, name, group ancestry, z-order, transform in EMU and normalized canvas units;
- text/runs/paragraphs, style origin, placeholders, tables, connectors, media, charts, diagrams, OLE, transitions, animations, notes, comments, and hyperlinks;
- relationship targets and dependent part hashes;
- unsupported/unknown classification and editability tier candidate;
- source method, confidence, parser warnings, and evidence lineage;
- canonical feature row ID, matrix hash, required evidence IDs, and promotion
  impact.

Normalization must resolve the current 96-DPI scene-graph versus 72-point mapper conflict through one documented unit conversion at boundaries. Raw values remain available for diagnostics.

## Adjudication Rules

1. Package XML and OPC relationships remain the preservation authority.
2. Existing native parsing remains production import authority until a feature row is promoted.
3. OfficeCLI shadow results may detect omissions or provide an alternate structured view.
4. Exact native IDs/part references can strengthen identity; name/kind/order remain diagnostic.
5. Conflicts become typed reconciliation records, not silent overwrites.
6. Promotion requires corpus, semantic, roundtrip, and drift evidence for the feature row; protected provider evidence is additional only for claim-level-5 promotion.
7. OfficeCLI read operations must leave the package byte-identical.

## TDD Matrix

| Test first                | Expected red                   | Green behavior                            |
| ------------------------- | ------------------------------ | ----------------------------------------- |
| Production/corpus parity  | Corpus bypasses scene graph    | Same importer and flags used              |
| Unit conversion           | Geometry differs 96 vs 72      | One exact EMU boundary contract           |
| Object count/kind         | Parsers disagree silently      | Typed diff with source lineage            |
| Duplicate ID/name         | Reconciler guesses             | Ambiguity recorded, no patch authority    |
| Groups/fragments          | Flattened nodes misalign       | Ancestry/fragment-aware mapping           |
| Layout/master inheritance | Explicit/inherited conflated   | Style origin retained                     |
| Unknown part              | Shadow omits object            | OPC preservation record remains           |
| OfficeCLI read drift      | Inspection rewrites package    | Hash gate fails command                   |
| Unsupported CLI feature   | Import fails                   | Native path proceeds with capability flag |
| Determinism               | Diff order varies              | Canonically sorted stable report          |
| Large deck                | Two parsers exhaust host       | Bounded queue/memory and cancellation     |
| Promotion regression      | New source silently takes over | Feature flag and evidence requirement     |

## Implementation Steps

1. Define a versioned normalized inventory independent of either parser's output shape.
2. Consume and continuously assert the Phase 1 production/corpus entrypoint invariant.
3. Add explicit EMU/point/pixel conversion utilities and property tests.
4. Implement native inventory adapters from scene graph and supplemental parsers.
5. Implement bounded OfficeCLI shadow adapters through Phase 4 only.
   This phase supplies the inspection fixtures, no-op drift, typed output, and
   qualification receipt omitted from G1/G2; failure cannot revoke version/validate
   qualification or block the native projection.
6. Compare objects, styles, relationships, dependent parts, and unsupported content.
7. Emit typed reconciliation records with severity and patch-authority impact.
8. Replace broad feature promotion flags with canonical row-scoped evidence,
   defaulting to native/no-promotion and `patchAuthority: false`.
9. Add deterministic report snapshots for the full corpus.
10. Track import latency, memory, OfficeCLI overhead, and cancellation.
11. Feed authoritative reconciliation results into the server source map.
12. Add regression fixtures for every resolved discrepancy.

## File Plan

- Add small modules under `server/services/pptx-import/reconciliation/`.
- Refactor `importer.js` orchestration without duplicating import pipelines.
- Reuse scene-graph, mapper, chart, diagram, theme/layout, and animation modules.
- Update corpus harness to call the production import entrypoint.
- Add unit, differential, corpus, determinism, and resource tests.

## Verification

```powershell
npx vitest run server/services/pptx-import/reconciliation/
npm run test:corpus
npm run lint
npm run test
```

Run the corpus twice and compare canonical report hashes. Confirm OfficeCLI shadow-disabled and unavailable modes produce the same native projection and preserve exact original access.

## Deep File Inventory

| Action | File/interface                    | Planned change                                          | Test impact            |
| ------ | --------------------------------- | ------------------------------------------------------- | ---------------------- |
| Modify | `reconciliation/inventory.js`     | Add canonical row/matrix lineage                        | Inventory schema tests |
| Modify | `reconciliation/orchestrator.js`  | Bound failures/resources and preserve native projection | Shadow/corpus tests    |
| Modify | `reconciliation/promotion.js`     | Row evidence only; no broad patch authority             | Promotion tests        |
| Modify | `source-map.js`                   | Strengthen only exact evidence-complete matches         | Authority tests        |
| Modify | `importer.js`                     | Keep one production/corpus orchestration                | Parity tests           |
| Create | Corpus determinism/resource tests | Two-run hash and budget evidence                        | Corpus lane            |
| Delete | None                              | Broad compatibility flags migrate before removal        | Migration tests        |

## Function and Interface Checklist

- [ ] Preserve `createInventory()`, `reconcileInventories()`, and `reportHash()`.
- [ ] Attach canonical row ID and matrix hash to every relevant discrepancy.
- [ ] Keep `patchAuthority: false` unless source-map criteria are exact and complete.
- [ ] Continue native import when optional OfficeCLI inspection is unavailable.
- [ ] Enforce time, object, memory, output, and cancellation budgets.

## Tests Before

1. Broad `geometry`/`text`/`charts` promotion can outscope tested rows.
2. Corpus reports are not proven deterministic across complete runs.
3. Optional OfficeCLI errors can abort native import.
4. Reconciliation cannot safely strengthen the authoritative source map.

## Refactor

Move reconciliation to canonical row evidence without changing native projection
authority. Keep OfficeCLI shadow read-only and contained.

## Tests After

- Full corpus runs twice with the same report hash.
- Unknown/ambiguous matches never acquire patch authority.
- Exact reconciled identities may strengthen source refs with full lineage.
- Disabled/unavailable OfficeCLI leaves projection and original access unchanged.

## Dependency Map

```text
G0 canonical rows + Phase 3 guarded revision
  + Phase 4 typed read gateway + Phase 5 source refs
  -> deterministic reconciliation
  -> row-scoped source evidence
  -> candidate inputs for Phases 7-10
```

## Debug and Reports

- `reports/phase-06/native-officecli-diff.json`
- `reports/phase-06/geometry-unit-audit.json`
- `reports/phase-06/source-authority-promotions.json`
- `reports/phase-06/production-corpus-parity.md`
- `reports/phase-06/import-resource-profile.json`

## Risks and Controls

- **Dual-parser complexity:** one normalized model, explicit source lineage, feature flags.
- **OfficeCLI becoming accidental authority:** promotion gate and default read-only shadow mode.
- **Performance regression:** one concurrent import, bounded outputs, corpus resource budgets.
- **Nondeterministic matching:** canonical sort and ambiguity as a first-class result.

## Success Criteria

- [x] Production uploads and corpus tests use the same importer and scene-graph path.
- [ ] Geometry conversion is exact, documented, and property-tested.
- [x] Every native/OfficeCLI conflict is visible and deterministically classified.
- [x] No heuristic reconciliation result authorizes a package patch.
- [x] OfficeCLI inspection causes zero package drift and is safely optional.
- [ ] Reconciliation emits canonical row IDs/matrix hash and cannot independently
      promote a claim or authorize a patch.
- [ ] Differential, corpus, determinism, resource, lint, and unit tests pass.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active provider wording above.

- Keep native import authoritative. Direct locally qualified OfficeCLI inspection
  is optional, read-only shadow evidence and never authorizes source identity,
  mutation, row promotion, or package publication.
- Bind every normalized inventory and reconciliation result to the canonical
  matrix schema/version/hash, exact package revision, source-map generation,
  parser/OfficeCLI identity, and local evidence authority.
- Resolve disagreements only through deterministic reviewed row policy. Ambiguous
  identity or mismatched subjects block the affected row rather than patching
  heuristically.
- Promote a row only after its corpus, semantic, roundtrip, drift, adapter,
  transaction, and untouched-part evidence passes. Local PowerPoint evidence is
  additionally required only when that exact row requests the local-oracle claim.
- Run OfficeCLI comparisons through the Phase 4 direct bounded gateway. Record the
  local residual limitations and make no sandbox or independent-attestation claim.

Run focused differential, ambiguity, read-drift, matrix-subject, determinism,
resource, and production-import parity tests, followed by corpus, lint, and unit
validators. Completion requires deterministic reconciliation with zero accidental
OfficeCLI authority and no row promotion from comparison evidence alone.
