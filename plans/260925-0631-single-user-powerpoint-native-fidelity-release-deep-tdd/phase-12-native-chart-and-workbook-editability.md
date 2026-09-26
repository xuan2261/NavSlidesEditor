---
phase: 12
title: 'Native chart and workbook editability'
description: 'Promote one physically manifested bar/column embedded-workbook literal-range numeric-value row with exact property-path gating and atomic workbook/cache publication.'
status: pending
priority: P1
effort: '5-7 weeks'
issue: null
branch: master
dependencies: [9, 10, 11]
gates: [G4-chart-bar-column-literal-range]
tags: [frontend, backend, pptx, charts, xlsx, native-editability, security, tdd]
created: 2026-09-25
---

# Phase 12: Native Chart and Workbook Editability

## Context

- The canonical candidate row already exists: `chart.bar-column.embedded-workbook.literal-range`.
- `native-chart-adapter.js` and `workbook-sync.test.js` prove isolated cache/workbook patch behavior, but the adapter is not in the authoritative planner/transaction.
- Current client chart panel treats a chart as wholly editable or wholly preserve-only. The target contract permits data values only.
- Current chart source-map entries remain missing/diagnostic.
- Current workbook inventory blocks macros/signatures/external links but does not fully prove exact literal range shape, shared embedding ownership, cell types/styles, or cache correspondence.
- Phase 11 supplies central mutation gating and ordered matrix evolution. This phase adds one chart property row only.
- Phase 10/11 supply the canonical physical native-editability manifest and the atomic client document/capability reducer. This phase extends both; it does not introduce chart-wide capability or another fixture authority.

## Goal

Enable only numeric value replacement for one exact native bar/column chart configuration:

```text
non-3D bar/column chart
  + one non-shared embedded .xlsx
  + one existing worksheet
  + fixed existing numeric literal range
  + no formulas/external links/macros/signatures
  + unchanged family/type/series/categories/styles/range dimensions
  -> atomically patch workbook cells and matching chart caches
```

Everything else remains preserve-only or blocked.

## Scope

- Exact source identity for chart part, workbook relationship, and literal value ranges.
- Property-level client gating: values enabled; type, labels, series, style, legend, axes, stacking, colors, add/remove disabled.
- Server canonical diff/journal for value-only same-shape data changes.
- Atomic in-memory workbook and chart-cache patch inside the Phase 9 transaction.
- Full native re-import comparison and untouched-part proof.
- One real checked-in chart fixture and exact-row physical qualification.
- One checked-in expected R1, physical boundary negatives, exact chart/workbook IDs/parts/relationships/ranges, R0/R1 hashes, and chart-property PowerPoint expected-evidence contract in the canonical manifest.
- Matrix promotion and authority epoch bump for this row only.

## Non-goals

- No formulas or formula evaluation.
- No external workbook retrieval or detachment.
- No macro-enabled or signed workbook.
- No shared workbook/embedding.
- No range growth/shrink, sheet creation, cell insertion, type conversion, shared strings, date conversion, or recalculation.
- No chart family/type change, combo, 3D, line, area, pie, scatter, stock, radar, modern extension chart, or secondary axis expansion.
- No category/series add/remove/rename/reorder.
- No chart style, color, label, legend, axis, number-format, marker, trendline, error-bar, or layout editing.
- No broad “bar charts are editable” claim.

## Key Insights

1. “Chart data” is too broad. The row is literal numeric values in a fixed pre-existing range.
2. Workbook cells are authoritative; caches are rendering replicas that must commit atomically.
3. Chart `<c:f>` range references are preserved literals, not editable formulas.
4. The UI must gate properties, not the whole element.
5. Repacking an inner XLSX can change unrelated ZIP bytes. Validation must compare semantic inner parts and preserve untouched outer package parts; reviewed canonicalization cannot hide worksheet/style drift.
6. Shared embeddings make one edit affect multiple charts. First row requires exclusive ownership.
7. Capability applies only to concrete leaf paths `chartData.datasets[i].data[j]` in the atomically bound client tuple. A chart-level `editable` Boolean is forbidden.
8. Chart promotion cannot be inferred from parser metadata or synthetic XLSX tests; every positive/negative/R0/R1/native relationship declared by the canonical physical manifest must resolve first.

## Requirements

### Exact eligibility

- Native family is one non-3D `barChart` or `column` orientation represented by the same canonical row.
- Chart has an internal relationship to exactly one embedded `.xlsx`.
- Embedding is referenced by exactly one chart in the package.
- Workbook passes recursive archive/XML/relationship budgets before parser access.
- No external relationships, VBA, signatures, OLE, protection/encryption, formulas, array formulas, tables requiring resize, or calculation chain mutation.
- Target cells exist, are numeric literals, use supported simple number/general format, and form the exact existing rectangular/contiguous series ranges.
- Cache formulas exactly correspond to approved workbook ranges.
- Dataset/series/category counts and range dimensions do not change.
- Values are finite numbers within configured magnitude/count budgets.

### Property gate

- Safe capability is a closed property-path set identifying only concrete existing `chartData.datasets[i].data[j]` leaves plus expected dataset/value cardinalities. Wildcard or whole-element `editable` authority is not accepted.
- Capability is atomically bound to the same local presentation snapshot/revision/generation/matrix subject by the Phase 11 document reducer; chart panel props may not cache or derive independent authority.
- Imported eligible chart keeps these controls disabled:
  - chart type;
  - labels/categories;
  - series labels/order/add/remove;
  - colors/style;
  - stacked/area;
  - legend and axis titles.
- Runtime gate rejects any crafted mixed update.
- Server recomputes eligibility and diff from current authority.
- `chart-properties.jsx` emits one explicit `chart.numeric-literal-value.replace` intent per changed leaf. Paste/fill-across may emit a batch only when every leaf already exists and every operation belongs to this exact row; mixed labels/type/style/range changes reject atomically.
- Client tests enumerate every rendered chart mutation control and assert only numeric value inputs dispatch. Adding a new chart control without an explicit blocked/allowed property-path contract fails the surface audit.

### Canonical physical evidence

- Extend only `server/data/test-corpus/native-editability/native-editability-manifest.json`.
- The chart row entry must resolve:
  - positive R0 and checked-in expected R1 paths, lengths, SHA-256 values, and fixed numeric before/after vectors;
  - physical negatives for formula-driven cells, shared workbook ownership, range/series expansion, and mixed chart type/style/property change;
  - exact slide part, graphic-frame native ID/name, chart part URI, chart relationship ID/type/target, workbook part URI/content type, workbook relationship ID/type/target, worksheet part, sheet name, fixed A1 ranges, series/category cache paths, and exclusive ownership count;
  - exact allowed outer changed parts `[chartPart, workbookPart]`, exact inner changed worksheet cell nodes, and unchanged relationship/style/type/range hashes;
  - R0/R1 package hashes plus inner workbook/chart part hashes;
  - `powerpoint-expected.json` for selecting the chart, editing only existing numeric cells, saving/reopening, and observing unchanged type/series/categories/style/ranges. It is mandatory expected evidence, not an observed G5 claim.
- The matrix row cannot be promoted unless `native-editability-manifest.js` resolves and verifies every file/hash/locator and the physical qualifier reproduces the declared expected-R1 hash. Missing evidence returns `PHYSICAL_EVIDENCE_INCOMPLETE`; no matrix epoch bump.

### Atomicity

- Read candidate outer PPTX and inner XLSX into private transaction workspace/memory.
- Patch all workbook cells first in a candidate inner archive.
- Patch all matching caches in candidate chart XML.
- Validate unchanged range refs, cell types/styles, series/categories, and workbook structure.
- Replace outer workbook and chart parts together in one candidate PPTX.
- Phase 9 publishes only after OfficeCLI, full native re-import, impact, and collateral gates.
- Any failure discards/quarantines the entire candidate; no cache-only or workbook-only successor.

## Architecture and Data Flow

### Import/source authority

1. Chart parser records exact family, chart part, relationship ID, workbook part, range refs, cache cardinality, and exclusive ownership verdict.
2. Source map creates a chart authority record bound to native graphic-frame identity plus dependent-part hashes.
3. Safe editor DTO exposes only property capability, never paths/relationship IDs/hashes.

### Save/journal

1. Phase 11 registry classifies value-only same-shape diff.
2. Server verifies chart source authority and current workbook eligibility.
3. Journal operation binds:
   - exact row/property/operation;
   - before/after numeric vectors;
   - chart/workbook source hashes;
   - fixed range/cache mapping;
   - impact closure `[chartPart, workbookPart]`.
   - exact concrete property paths and current capability/manifest row-entry subjects.

### Transaction

1. Planner resolves `native-chart-embedded-workbook`.
2. Adapter applies all cell/cache changes to private bytes.
3. Inner workbook validator proves only target worksheet cell `<v>` values changed; workbook relationships/styles/types/ranges remain.
4. Outer validator proves only chart and workbook parts changed.
5. Native re-import proves same chart family/type/series/categories/styles and expected values.
6. State-root publication follows Phase 9 unchanged.

## Absolute File Inventory

### Modify

| Absolute path                                                                                         | Change                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\shared\src\pptx-native-mutation-registry.js`                                 | Add exact chart value-only mutation definition.                                          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-feature-matrix.js`                     | Promote only exact chart row after evidence; bump matrix subject/epoch.                  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\chart-support-matrix.js`                         | Replace broad bar aliases with exact eligibility verdict.                                |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\chart-native-metadata.js`                        | Capture family, refs, caches, relationship closure, ownership inputs.                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\ooxml-chart-parser.js`                           | Preserve exact row metadata and safe value projection without coercion.                  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\embedded-workbook-inventory.js`                  | Literal-range, cell-type/style, formula, sharing, and budget verdicts.                   |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\source-map.js`                                   | Authoritative chart ref with dependent chart/workbook hashes.                            |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-chart-adapter.js`                         | Transaction adapter contract; atomic workbook/cache patch and receipts.                  |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\primitive-adapter-registry.js`                   | Register chart adapter without separate orchestrator.                                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\transactional-patch-planner.js`                  | Authorize exact chart row and two-part closure.                                          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-reimport-comparator.js`                   | Exact chart family/range/series/value and collateral comparison.                         |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-mutation-policy.js`                       | Value-only chart diff and server eligibility.                                            |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\fidelity-contract.js`                            | Safe chart property capability.                                                          |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\package-store\dto.js`                            | Expose safe property capability; strip forged fields.                                    |
| `C:\Work\NavSlidesEditor\client\src\components\properties\chart-properties.jsx`                       | Property-level disabling and exact eligibility explanation.                              |
| `C:\Work\NavSlidesEditor\client\src\components\properties\chart-properties.test.jsx`                  | Value-only enabled; all expansion controls disabled.                                     |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\use-editor-mutation-gate.js`              | Chart value intent classification.                                                       |
| `C:\Work\NavSlidesEditor\client\src\hooks\editor-controller\editor-document-reducer.js`               | Consume chart property capability only as part of the same atomic server snapshot tuple. |
| `C:\Work\NavSlidesEditor\package.json`                                                                | Add exact chart qualification command.                                                   |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\native-editability-manifest.json` | Add exact chart positive/R1/negative/native-locator/PowerPoint entry.                    |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\native-editability-manifest.js`                  | Validate chart/workbook/range/relationship physical evidence.                            |

### Create

| Absolute path                                                                                                                               | Purpose                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-chart-data-journal.js`                                                       | Exact fixed-range numeric value journal.                 |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\canonical-chart-data-journal.test.js`                                                  | Same-shape/value-only and negative expansion tests.      |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\workbook-cache-atomicity.test.js`                                                      | Every failure boundary and inner/outer collateral proof. |
| `C:\Work\NavSlidesEditor\server\services\pptx-import\chart-row-qualification.test.js`                                                       | Planner/transaction/native/public exact-row evidence.    |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\positive-r0.pptx`                        | Real exact-row chart/workbook R0.                        |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\expected-r1.pptx`                        | Checked-in expected numeric-value R1.                    |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\negative-formula-cells.pptx`             | Formula-driven boundary negative.                        |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\negative-shared-workbook.pptx`           | Shared embedding boundary negative.                      |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\negative-range-or-series-expansion.pptx` | Fixed-range/cardinality boundary negative.               |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\negative-type-or-style-mixed.pptx`       | Mixed property/family boundary negative.                 |
| `C:\Work\NavSlidesEditor\server\data\test-corpus\native-editability\chart-bar-column-literal-range\powerpoint-expected.json`                | Chart numeric-value PowerPoint expectation.              |
| `C:\Work\NavSlidesEditor\tests\e2e\pptx-native-chart-values.spec.js`                                                                        | Public UI/API value-only scenario.                       |
| `C:\Work\NavSlidesEditor\scripts\pptx-g4-chart-qualification.js`                                                                            | Physical exact-row qualification/receipt.                |

### Delete

- None. Preserve existing isolated adapter tests as lower-level regression coverage.

## RED Tests

1. Eligible imported chart still has all controls disabled because capability is whole-element only.
2. Client enables type/label/series/color/style controls when values are eligible.
3. Crafted PUT changes values plus label/style/type and server accepts it.
4. Workbook has a formula cell, external link, macro, signature, shared embedding, or second chart reference and is considered editable.
5. Range grows/shrinks or series count changes.
6. Numeric cell changes type/style/number format.
7. Chart cache update succeeds but workbook update fails, or inverse, and partial candidate leaks.
8. Cache formula/range does not match workbook target.
9. Inner XLSX unrelated part changes during repack and collateral gate misses it.
10. Native re-import returns coerced line/pie/combo family or changed style with correct values.
11. Matrix promotes broad bar aliases or sibling chart rows.
12. Missing OfficeCLI/native/impact evidence still promotes the row.
13. Capability enables a wildcard dataset path, entire chart element, new data index, labels, type, style, color, legend, axis, stacking, category, or series operation.
14. Chart snapshot and property capability come from different reducer subjects, yet controls remain enabled.
15. Canonical manifest has a missing positive/R1/negative/PowerPoint file, wrong package hash, wrong graphic-frame/chart/workbook relationship, wrong A1 range/cache path, or non-exclusive ownership and still permits promotion.
16. Physical export is semantically similar but does not match the checked-in expected-R1 hash.

## Implementation Steps

1. Freeze positive R0, expected R1, formula/shared/range-expansion/type-style negatives, and PowerPoint expected-evidence JSON in the canonical manifest; add strict integrity assertions for exact chart/workbook relationships, IDs, hashes, ranges, and literals.
2. Extend workbook inventory to return a typed eligibility receipt, never merely `editable: true`.
3. Add package-wide relationship reference counting; require exclusive workbook ownership.
4. Extend chart metadata/source map with exact dependent-part authority.
5. Add shared registry concrete chart numeric leaf property and safe DTO capability bound to the current document tuple; reject chart-wide/wildcard capabilities.
6. Update chart panel to enable only existing numeric value inputs; enumerate every control and keep every expansion control disabled with reason.
7. Write canonical chart journal that rejects all non-value or shape-changing diffs.
8. Register chart adapter through existing planner/transaction registry.
9. Refactor adapter to patch all workbook/cache values in one private candidate and return inner/outer impact receipts.
10. Add inner workbook semantic diff and unchanged-part hashes.
11. Add native re-import chart comparator for family, bar direction, series/category identity, refs, formats, style hashes, and values.
12. Run positive and every physical boundary-negative through the Phase 9 public job flow; require downloaded R1 to match the canonical expected-R1 hash.
13. Promote only the exact row after manifest resolution and receipt binding; bump matrix version/hash and authority epoch, reissue/invalidate heads.
14. Run primitive-row regression plus all chart negative cases.

## Refactor

- Keep workbook inspection, journal derivation, adapter, and comparison separate.
- Avoid regex-only authority decisions; parse enough bounded XML structure to identify exact cells/ranges/caches.
- Reuse Phase 9 transaction and Phase 11 registry/gate.
- Keep imported display mapping separate from native edit eligibility.
- Do not create a second chart export endpoint.

## GREEN Tests

- Eligible chart shows value inputs enabled and every other imported-chart control disabled.
- Capability exposes only concrete existing numeric leaf paths from the same atomic client snapshot tuple; no wildcard/whole-chart capability exists.
- Server accepts only same-count finite numeric value changes.
- Workbook cells and matching caches change together.
- Chart/workbook refs, types, formats, styles, categories, series, and ranges remain exact.
- Native re-import returns same native family and expected values.
- Unexpected inner or outer part drift blocks publication.
- External/formula/macro/signed/shared/type/style/series/range cases stay preserve-only.
- Only exact row becomes Level-4 promoted.
- Canonical manifest resolves positive R0, expected R1, all boundary negatives, exact chart/workbook identities/relationships/ranges, and PowerPoint expectation; exported R1 hash matches.

## Scenario Matrix

| Chart/workbook state                                                    | Values editable? | Result                                     |
| ----------------------------------------------------------------------- | ---------------: | ------------------------------------------ |
| Non-3D bar/column, exclusive embedded XLSX, fixed numeric literal range |              Yes | Exact row only.                            |
| Formula cell or formula-driven target                                   |               No | Preserve-only.                             |
| External workbook link                                                  |               No | Preserve-only; no network.                 |
| Macro/signature/protection                                              |               No | Edited export blocked/original recovery.   |
| Shared workbook embedding                                               |               No | Preserve-only.                             |
| Range/series/category count change                                      |               No | Save rejected.                             |
| Chart type/style/color/legend/axis change                               |               No | Save rejected.                             |
| Cache mismatch                                                          |               No | Transaction fails, no publish.             |
| Combo/3D/line/pie/scatter/unknown                                       |               No | Preserve-only.                             |
| Exact values, validator success                                         |              Yes | Atomic R1 and exact G4 receipt.            |
| Missing/mismatched physical manifest evidence                           |               No | Promotion rejected; epoch unchanged.       |
| Snapshot/capability subject mismatch                                    |               No | Reload required; server remains authority. |

## Exact Failure Responses

| Boundary                                                                 | Response                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Client non-value or non-concrete chart path                              | No local mutation/dirty state; accessible property-specific denial.                                                       |
| Client snapshot/capability subject mismatch                              | `reload-required`; all chart mutation controls disabled.                                                                  |
| Server mixed/non-value/range-shape chart diff                            | `422` with `CHART_PROPERTY_NOT_PROMOTED` or exact registered eligibility reason; no journal/generation bump.              |
| Formula/external/macro/signed/shared/type/style/range ineligible package | Preserve-only capability plus exact bounded reason; crafted PUT remains `422`.                                            |
| Missing physical file/hash/native locator/relationship/range             | Qualifier non-zero with `PHYSICAL_EVIDENCE_INCOMPLETE`/`PHYSICAL_EVIDENCE_IDENTITY_MISMATCH`; matrix and epoch unchanged. |
| Downloaded R1 hash mismatch                                              | `PHYSICAL_R1_HASH_MISMATCH`; row remains unpromoted.                                                                      |
| Cache/workbook or inner/outer collateral mismatch                        | Export job terminal `failed` with registered impact/native reason; no successor/download.                                 |

## Regression Commands

```powershell
npx vitest run server/services/pptx-import/embedded-workbook-safety.test.js server/services/pptx-import/workbook-sync.test.js server/services/pptx-import/workbook-cache-atomicity.test.js
npx vitest run server/services/pptx-import/canonical-chart-data-journal.test.js server/services/pptx-import/chart-row-qualification.test.js
npx vitest run server/services/pptx-import/ooxml-chart-inject.test.js server/services/pptx-import/chart-support-matrix.test.js server/services/pptx-import/source-map.test.js
npx vitest run server/services/pptx-import/transactional-patch.test.js server/services/pptx-import/native-reimport-comparator.test.js
npx vitest run client/src/components/properties/chart-properties.test.jsx client/src/hooks/editor-controller/use-editor-mutation-gate.test.jsx
npx vitest run client/src/hooks/editor-controller/editor-document-reducer.test.js server/services/pptx-import/native-editability-manifest.test.js
npx playwright test tests/e2e/pptx-native-chart-values.spec.js --project=chromium --workers=1
npm run test:pptx:g4:chart -- --row chart.bar-column.embedded-workbook.literal-range
npm run test:pptx:g4:primitive
npm run test:pptx:g2:physical
npm run test:pptx:importer-qualification
npm run test:pptx:package:no-officecli
npm run lint
npm run test
npm run build
```

## Todos

- [ ] Freeze exact real chart fixture and manifest.
- [ ] Check in expected R1, four physical boundary negatives, and chart PowerPoint expected-evidence contract.
- [ ] Implement typed literal-range workbook eligibility.
- [ ] Add exclusive embedding ownership proof.
- [ ] Add chart source-map authority.
- [ ] Add property-level client/server gating.
- [ ] Add canonical chart journal.
- [ ] Integrate adapter with existing planner/transaction.
- [ ] Prove inner and outer atomicity/collateral.
- [ ] Add native chart comparator and physical qualification.
- [ ] Promote exact row and bump matrix epoch.

## Success Criteria

- [ ] Exactly one bar/column embedded-workbook literal-range row is Level-4 promoted.
- [ ] Promotion is impossible until canonical physical positive/R1/negative/native-locator/range/PowerPoint evidence resolves and R1 hash matches.
- [ ] Only numeric values in fixed existing ranges are editable.
- [ ] Workbook cells and chart caches publish atomically or not at all.
- [ ] Chart family/type/series/categories/style/range/cell types remain unchanged.
- [ ] Formula, external, macro, signed, shared, type, style, series, and range expansion remains unavailable.
- [ ] Full Phase 9 validation and Phase 11 central gating apply.
- [ ] No sibling chart row or broad chart-family claim is promoted.

## Risks, Signals, Responses

| Risk                                 | Signal                               | Response                                                                          |
| ------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------- |
| XLSX repack causes unrelated drift   | Inner part hashes change             | Inner semantic/hash gate; block until reviewed.                                   |
| Shared workbook corruption           | More than one incoming chart ref     | First row ineligible.                                                             |
| Cache/workbook disagreement          | Re-import values differ              | Block publication; report bounded mismatch.                                       |
| UI implies broad editability         | Non-value control enabled            | Property capability tests and runtime gate.                                       |
| Numeric coercion                     | Dates/strings/NaN accepted           | Literal numeric cell/type and finite-value checks.                                |
| Family alias overpromotion           | 3D/combo alias resolves row          | Exact OOXML family/bar-direction predicates.                                      |
| Whole-chart capability escapes scope | Any non-value control dispatches     | Concrete leaf-path capabilities, exhaustive control audit, server diff authority. |
| Manifest metadata outruns files      | Row entry exists but path/hash fails | Strict resolver blocks qualification/promotion and leaves epoch unchanged.        |

## Security

- Recursively guard embedded XLSX before any workbook parser.
- Never calculate formulas, load add-ins, execute macros, or fetch external links.
- Bound nested entries, bytes, ratio, depth, sheets, cells, series, and values.
- Reject path traversal, duplicate ZIP names, DTD/entity content, and malformed relationships.
- Keep workbook/chart paths and source hashes server-only.
- Active/signed/protected packages remain fail-closed with immutable original recovery.

## Dependencies and Next

- Requires Phase 11 shared registry/server gate and Phase 9 atomic transaction.
- Reuses Phase 10 physical evidence discipline.
- Phase 13 may align reconstructed chart export but cannot expand this native row.
- Phase 15 adds G5 PowerPoint evidence for this exact published subject only.
