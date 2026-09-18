---
phase: 8
title: 'Native charts and embedded workbooks'
status: in-progress
effort: '5-7 weeks'
dependsOn: [4, 5, 6]
priority: P1
gates: [G4-charts]
---

# Phase 8: Native charts and embedded workbooks

<!-- Updated: Validation Session 1 - embedded workbook selected as authority for the basic chart row; caches synchronize atomically. -->

## Overview

Preserve and safely edit native PowerPoint charts together with their relationship closure and embedded workbook. Eliminate current lossy chart coercion, define authority between chart caches and workbook cells, and make unsupported chart families preserve-only instead of silently converting them.

The existing non-shared bar/column implementation is a candidate row. It is not
claim-level-4 promoted until the authoritative planner, transaction, native
re-import, untouched-part, corpus, and matrix-hash gates pass.

## Existing Seams

- `server/services/pptx-import/ooxml-chart-parser.js`
- scene-graph chart inventory and relationship parsing
- client chart element/editor components
- package relationship and embedded media handling
- Phase 3 recursively guarded embedded-package inventory and Phase 4 contained
  native parser workers. OfficeCLI chart operations remain deferred unless an
  exact row later selects and qualifies them.

Current scatter and other chart coercions must become explicit tier decisions. OfficeCLI chart edits do not guarantee embedded workbook synchronization, so NavSlides must own and test the atomic update contract.

## Authority Policy

Confirmed first-release policy:

- If a valid embedded workbook is present and formulas reference it, workbook cells/formulas are authoritative for edited data.
- Chart caches are updated atomically to match the resulting workbook values for PowerPoint rendering and consumers that read caches.
- If no workbook exists, caches may be authoritative only for chart families explicitly supported by tests.
- External workbook links are never fetched or executed. Preserve them and mark data editing blocked unless the user explicitly detaches to an embedded copy through a future reviewed flow.
- Styling edits do not rewrite workbook data.
- Multiple charts sharing one embedding require reference-aware updates and conflict tests.

This policy is final for the first-release basic chart row. Other authority models remain preserve-only expansion work.

## Delivery Slices

- **Preservation baseline:** retain every chart, style, extension, relationship, and embedded workbook byte-for-byte; expose replace-whole-chart when safe.
- **Blocking MVP row:** one non-shared embedded-workbook family (column/bar) with simple literal ranges, no external links/macros/signatures, atomic workbook/cache update, and style-only no-data drift.
- **Matrix expansion:** additional families, formulas/range growth, shared embeddings, combo/scatter/stock, modern extension charts, and advanced styling. Each remains preserve-only until its exact row passes.
- No level-3/G2 milestone requires a chart row. The declared chart candidate is
  required only for its exact G4 chart claim, and full chart editability is never
  inferred from it.

## Supported Data Model

- Chart part, style/color parts, workbook embedding, relationship IDs, formulas, caches, number formats, axes, legends, labels, series, markers, trendlines, error bars, and chart-space properties.
- Native families evaluated separately: column/bar, line, area, pie/doughnut, scatter/bubble, combo, radar, stock, surface, histogram/Pareto, waterfall, funnel, box/whisker, treemap/sunburst, and extension-based charts.
- Editability may differ by family. No family is promoted by similarity to another.

## TDD Matrix

| Test first                  | Expected red                           | Green behavior                                          |
| --------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Cache/workbook disagreement | One source silently chosen             | Policy chooses and reports authority                    |
| Edit chart data             | Cache only changes                     | Workbook and caches patch atomically                    |
| Formula/range expansion     | Relationships break                    | Formulas, cells, dimensions, caches align               |
| Scatter/combo/stock         | Coerced to simpler chart               | Native family preserved or edit blocked                 |
| Date/value axes             | Category strings flatten               | Axis types/number formats retained                      |
| Shared workbook             | One chart corrupts another             | Reference-aware update and conflict handling            |
| Missing/corrupt workbook    | Export fails late                      | Preserve/tier result with clear reason                  |
| External link               | Network access attempted               | No fetch; preserve and block unsafe edit                |
| Style-only edit             | Data/workbook rewrites                 | Only declared chart/style parts touched                 |
| Macro/signature             | Active/signed content altered silently | Edited export blocked; exact original remains available |
| Repeated edit               | Numeric/style drift                    | Deterministic canonical result                          |
| Unsupported extension       | XML dropped                            | Opaque extension preserved                              |

## Implementation Steps

1. Consume the canonical Phase 1 schema, define one exact candidate row, and
   default every other chart/authority/property row to preserve-only.
2. Extend native parser to retain native family, formulas, caches, number formats, style origin, and relationship closure.
3. Consume the Phase 3 recursive ZIP/XML verdict before opening an embedded
   workbook, then inventory it without formula execution or external link
   resolution. Apply nested and aggregate entry/byte/depth/ratio budgets again at
   the parser boundary.
4. Finalize and encode workbook/cache authority policy.
5. Write fixture-backed adapters for supported data and style mutations.
6. Stage workbook and chart/cache mutations in one transaction.
7. Validate workbook ZIP structure, chart relationships, formulas/ranges, and package OPC graph.
8. Re-import and compare chart semantics without coercion.
9. For claim-level-5 promotion only, render representative charts through the protected PowerPoint provider and compare exact evidence subjects.
10. Mark unsupported families/properties as preserved opaque or structured partial with clear UX.
11. Add shared-embedding, concurrent-save, rollback, large-series, and malformed-workbook tests.
12. Promote only family/property rows that pass all gates.

## File Plan

- Refactor/extend `ooxml-chart-parser.js` into focused chart and workbook modules if size requires.
- Add chart/workbook patch adapters under the package mutation service.
- Extend shared chart types only for properties the editor can represent safely.
- Update client chart editing controls based on capability/tier metadata.
- Add chart corpus fixtures and semantic/provider test suites.

## Verification

```powershell
npx vitest run server/services/pptx-import/chart-roundtrip.test.js
npx vitest run server/services/pptx-import/workbook-sync.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

For each promoted family, inspect touched parts, open workbook relationships, and native re-import semantics. For rows seeking claim level 5, also inspect protected PowerPoint visual output. Test rollback after workbook patch but before chart-cache patch.

## Deep File Inventory

| Action | File/interface                                      | Planned change                                        | Test impact              |
| ------ | --------------------------------------------------- | ----------------------------------------------------- | ------------------------ |
| Modify | `chart-support-matrix.js`                           | Exact canonical family/authority/property rows        | Matrix tests             |
| Modify | `ooxml-chart-parser.js`, `chart-native-metadata.js` | Preserve exact native semantics and lineage           | Parser tests             |
| Modify | `embedded-workbook-inventory.js`                    | Security and authority predicates                     | Workbook tests           |
| Modify | `native-chart-adapter.js`                           | Production transaction-compatible adapter             | Adapter/rollback tests   |
| Modify | `transactional-patch-planner.js`                    | Register exact chart operation row                    | Planner tests            |
| Create | Chart transaction/native-reimport fixtures          | G4 semantic and preservation evidence                 | Integration/corpus tests |
| Create | Range/shared/resource tests                         | Keep expansion rows preserve-only                     | Negative tests           |
| Delete | None                                                | Remove no family until migration proves exact mapping | Compatibility tests      |

## Function and Interface Checklist

- [ ] Define one exact bar/column embedded-literal-workbook row.
- [ ] Preserve `supportRow()`, workbook inspection, and chart adapter seams.
- [ ] Register chart journal/planner/transaction dispatch.
- [ ] Patch workbook and caches atomically.
- [ ] Keep external/shared/macro/signed/malformed modes non-editable.

## Tests Before

1. The chart adapter is not reachable from the authoritative planner.
2. Broad `bar` support overstates workbook predicates.
3. No production native re-import verifies chart semantics.
4. Shared workbook and relationship closure lack complete production evidence.
5. A hostile nested XLSX currently bypasses outer PPTX-only guards.

## Refactor

Integrate only the exact MVP row first. Do not generalize family support from
display mapping or isolated adapter tests.

## Tests After

- Atomic workbook/cache update through Phase 11 with rollback on every boundary.
- Style-only edits leave workbook/data parts byte-identical.
- Native re-import preserves family, formulas, ranges, number formats, and data.
- Unsupported families and authority modes retain exact source bytes.

## Dependency Map

```text
G0 chart row + Phase 3 relationship inventory
  + Phase 5 journal + Phase 6 source evidence
  -> native chart adapter
  -> Phase 11 transaction/validators
  -> G4 exact chart row
```

## Debug and Reports

- `reports/phase-08/chart-capability-matrix.json`
- `reports/phase-08/workbook-cache-authority.md`
- `reports/phase-08/chart-relationship-closure.json`
- `reports/phase-08/chart-roundtrip-results.json`
- `reports/phase-08/chart-visual-results.json`

## Risks and Controls

- **Data inconsistency:** workbook/cache changes are one transaction with post-validation.
- **Formula execution/security:** parse references only; never calculate or follow external links.
- **Family greenwashing:** capability rows are exact, no coercive promotion.
- **Large data/resource use:** series/cell/embedding limits and bounded parsing.
- **Nested archive bypass:** recursively guard XLSX ZIP/XML before the workbook
  parser and account its expansion against the outer job budget.
- **Signed/macro workbook changes:** first-release edited export is blocked; no invalidation flow exists.

## Success Criteria

- [x] Workbook/cache authority is explicit and enforced for every supported edit.
- [x] The basic chart row treats embedded workbook cells/formulas as authoritative and updates chart caches in the same transaction.
- [x] All chart/workbook bytes are preserved before any data-edit row is enabled.
- [x] The single non-shared basic-chart MVP row passes independently; unsupported families remain preserve-only without coercion.
- [x] No chart family is silently coerced during import or edited export.
- [x] Supported data edits atomically update all required chart/workbook parts and roll back on failure.
- [x] Style-only edits leave workbook/data parts byte-identical.
- [x] External, malformed, shared, signed, and unsupported embeddings have tested preserve/block behavior.
- [ ] Embedded XLSX content cannot reach a workbook parser without recursive
      ZIP/XML/relationship and aggregate resource verdicts.
- [ ] No chart row is promoted until planner, transaction, native re-import,
      untouched closure, corpus, and matrix-hash evidence pass.
- [ ] Focused, corpus, lint, unit, and client build validators pass; protected provider visual validators additionally pass for level-5 rows.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active protected-provider wording above.

- Keep the embedded workbook authoritative for the approved non-shared basic
  chart row and update workbook cells/formulas and chart caches in one transaction.
- Recursively apply ZIP/XML/relationship, active-content, and aggregate expansion
  guards before any embedded workbook parser runs. Never calculate formulas or
  retrieve external links.
- Bind chart and workbook adapters, journals, impact closure, re-import,
  untouched-part evidence, and promotion to the exact canonical row and matrix
  subject. Shared, external, malformed, signed, macro-bearing, and unsupported
  embeddings preserve or block according to explicit policy.
- Execute edited-package validation through the Phase 4 direct local OfficeCLI
  gateway and the Phase 11 layered transaction. OfficeCLI does not become chart
  or workbook authority.
- For a row requesting `G5`, run the local Microsoft PowerPoint oracle against the
  exact published package and record the bounded local environment. No remote or
  protected provider is required.

Run focused workbook/cache authority, recursive guard, transaction rollback,
style-only drift, row-independence, native re-import, untouched-part, and
roundtrip tests, then corpus, lint, unit, and client build validators. Run local
PowerPoint chart visual checks only for the exact rows requesting `G5`.
Completion requires independent evidence for each promoted chart row and no
coercive family promotion.
