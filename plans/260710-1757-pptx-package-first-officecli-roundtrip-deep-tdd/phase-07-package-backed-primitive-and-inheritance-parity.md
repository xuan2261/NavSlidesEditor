---
phase: 7
title: 'Package-backed primitive and inheritance parity'
status: in-progress
effort: '6-8 weeks'
dependsOn: [1, 5]
priority: P1
gates: [G2-seed, G4-primitives]
---

# Phase 7: Package-backed primitive and inheritance parity

## Overview

Deliver package-backed import and mutation parity for the primitive feature matrix: slides, text, shapes, groups, connectors, images, tables, placeholders, backgrounds, and master/layout/theme inheritance. Each promoted lower-level property is proven through import, edit, journal, patch, re-import, and untouched-part tests. PowerPoint provider tests are additionally required only when promoting the row for claim level 5.

The existing plain text, basic transform, solid fill/stroke, and image
replacement adapters are `candidate` rows, not level-4 promotions, until they
pass the canonical Phase 1 row protocol through the production transaction.
Image crop is excluded from G2 because its client/server canonical representation
is not yet singular.

## Scope

- Slide dimensions, background, orientation, z-order, visibility references.
- Text boxes, runs, paragraphs, bullets/numbering, tabs, margins, autofit, language, fields, hyperlinks, and text transforms.
- AutoShapes, freeforms, fills, lines, effects, rotation, flips, crop, transparency, and alternative text.
- Nested groups and child transforms without flattening source identity.
- Connectors and endpoint semantics.
- Images including crop and supported SVG/EMF/WMF preservation behavior.
- Tables, merged cells, row/column sizing, borders, fills, margins, and text.
- Placeholders and explicit versus inherited properties across slide, layout, master, and theme.
- Theme colors, fonts, color transforms, and font fallback provenance.

Out of scope for this phase: native chart data edits, SmartArt semantic edits, active OLE, full animation timing trees, and complex presentation show settings.

## Delivery Slices

- **G2 seed row:** exactly one `primitive.text.run.plain-replacement` operation
  for a source text body containing one paragraph and one run. The production
  TipTap JSON/HTML input must parse to one paragraph containing only unmarked text
  nodes, with no hard breaks, inline nodes, marks, fields, hyperlinks, lists,
  tabs, or style changes. The adapter changes only the run text and preserves its
  run/paragraph properties. Any richer structure is ineligible and fails closed.
  This row needs qualified adapter plus transaction-validator eligibility to close
  G2, but remains absent from level-4 claims until separately promoted.
- **Later candidate rows:** basic position/size/rotation, solid fill/stroke, and
  whole-image replacement may follow through the production transaction. Crop
  waits for one canonical representation.
- **Matrix expansion:** rich run/paragraph structure, freeforms/effects, nested-group editing, connectors, tables, placeholders, and inheritance edits. Until promoted, preserve source XML and expose the correct non-editable tier.
- Lower claim milestones do not wait for matrix expansion; the full phase remains pending until every contracted row is resolved as editable, preserved, or explicitly excluded.

## Property Contract

For every supported property, record:

- source part/path/native ID;
- raw OOXML value and normalized NavSlides value;
- unit conversion and precision;
- style origin: explicit, placeholder, layout, master, theme, or default;
- whether editing creates an override or mutates shared inheritance;
- affected part/relationship closure;
- editability tier and known render limitations;
- semantic and visual tolerances.

Shared master/theme mutation must never occur as an accidental side effect of editing one slide. The UI must distinguish local override from intentional shared-style edit before such operations are supported.

## TDD Matrix

| Feature family       | Red fixtures and mutations                       | Required green assertions                                         |
| -------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Geometry             | fractional EMU, rotate/flip, crop, nested groups | exact normalized geometry; bounded provider diff for level 5      |
| Text                 | mixed runs, bullets, RTL/CJK, autofit, fields    | run/paragraph semantics and style origin retained                 |
| Shapes               | presets/freeforms, gradient/pattern, effects     | supported edits patch exact properties; unknown effects preserved |
| Groups               | nested transforms/reorder/child edit             | group structure and identities preserved                          |
| Connectors           | endpoints, reroute, arrows                       | relationship/end semantics retained or tiered                     |
| Images               | crop, transparency, SVG/EMF/WMF                  | media bytes untouched unless replacement requested                |
| Tables               | merges, borders, sizing, cell text               | grid and merges survive edit/export                               |
| Placeholders         | title/body/date/footer/slide number              | inheritance and placeholder kind retained                         |
| Theme chain          | scheme colors/fonts/transforms                   | explicit versus inherited behavior proven                         |
| Unsupported property | edit adjacent property                           | unsupported XML remains untouched                                 |
| G2 plain-run seed    | TipTap marks, multi-paragraph, hard break, field | strict eligibility rejects; exact single-run text patches only    |

Add negative tests for duplicate IDs, malformed transforms, missing layouts, absent fonts, font substitution, theme cycles, and precision drift across repeated exports.

## Implementation Steps

1. Consume the canonical Phase 1 schema and migrate primitive rows without
   broadening their current support.
2. Define the exact G2 plain-run seed row and write strict production TipTap
   parser/eligibility failures before the successful transaction case.
3. Extend native scene graph and mapper models to retain raw source/style origin.
4. Extend source references to fragments such as runs, paragraphs, table cells, and group children.
5. Add journal adapters per property family with exact impact closure.
6. Implement the G2 seed through the native OOXML adapter. Add other native or
   qualified OfficeCLI adapters only when their exact row requires them.
7. Re-import each staged package and compare canonical semantics.
8. Hash all unrelated parts and media to detect collateral drift.
9. For claim-level-5 promotion only, render exact exports through the protected PowerPoint provider for representative and boundary fixtures.
10. Surface unsupported properties as preserved/tiered, never silently normalized.
11. Add repeated-edit tests to detect cumulative rounding and canonicalization drift.
12. Promote feature rows only after all required evidence passes.
13. Keep `adapterQualified`, `transactionEligible`, and `level4Promoted`
    independent. G2 checks the first two for the seed row; product claim wording
    checks the third.

## File Plan

- Extend `ooxml-scene-graph/`, `mapper/`, theme/layout/master parsers, and focused shared types.
- Add mutation adapters under a package patching service, split by primitive family.
- Update canvas/property editors only when a property is safely roundtrippable.
- Add corpus fixtures and provider expectations without replacing source goldens.
- Keep each new module within repository size guidance.

## Verification

```powershell
npx vitest run server/services/pptx-import/ooxml-scene-graph/
npx vitest run server/services/pptx-import/mapper/
npx vitest run server/services/pptx-import/primitive-roundtrip.test.js
npm run test:corpus
npm run lint
npm run test
npm run build
```

Run edited-roundtrip suites for every promoted matrix row. Run protected PowerPoint visual suites only for rows seeking claim level 5. The touched-part report must be empty outside each operation's declared closure.

## Deep File Inventory

| Action | File/interface                                    | Planned change                                           | Test impact            |
| ------ | ------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| Modify | `primitive-feature-matrix.js`                     | Canonical exact rows and candidate state                 | Matrix migration tests |
| Modify | `primitive-adapter-registry.js`                   | Become planner dispatch source                           | Registry/planner tests |
| Modify | `transactional-patch-planner.js`                  | Dispatch by row and adapter ID                           | Plan/unknown-row tests |
| Modify | Native text/primitive adapters                    | Split broad properties when evidence differs             | Adapter tests          |
| Modify | `source-map.js` and scene graph                   | Run/paragraph/cell/group fragment identities             | Import identity tests  |
| Modify | `fidelity-contract.js`                            | Exact safe row capability summary                        | DTO/route tests        |
| Create | `primitive-roundtrip.test.js` and row fixtures    | Full transaction and adjacent preservation               | G4 evidence            |
| Create | strict TipTap plain-run eligibility adapter/tests | Reject rich HTML/JSON; emit one canonical text operation | G2 seed evidence       |
| Delete | None                                              | Legacy matrix terms migrate before removal               | Compatibility tests    |

## Function and Interface Checklist

- [ ] Preserve native text and primitive adapter contracts.
- [ ] Bind the adapter registry to planner dispatch.
- [ ] Split rows whose listed properties do not share complete evidence.
- [ ] Add source-fragment refs before rich text/table/group promotion.
- [ ] Emit exact touched-part closure and matrix hash per result.
- [ ] Prove the production TipTap transport, not a test-only plain string,
      satisfies or fails the exact seed eligibility contract.

## Tests Before

1. The plain-text adapter receives TipTap HTML/JSON that its plain-run contract
   does not currently validate.
2. Planner and adapter registry can drift.
3. Broad row properties can be overclaimed.
4. Adjacent unknown XML/media preservation is incomplete per row.

## Refactor

Complete only the strict plain-run G2 seed first. Migrate later candidates after
the seed transaction closes; add richer rows only after source-fragment authority
exists. Keep unsupported rows `preserved-opaque` or blocking.

## Tests After

- Full import, journal, patch, native re-import, roundtrip, and untouched-part
  evidence for every promoted row.
- Repeated edits remain within exact precision bounds.
- Unsupported siblings/extensions remain byte-identical.
- DTO and claim list only exact promoted row IDs.

## Dependency Map

```text
G0 canonical rows + Phase 5 authoritative source/journal
  -> exact plain-run G2 seed eligibility
  -> Phase 11 production transaction/validators
Phase 6 differential evidence
  -> later primitive candidate adapters
  -> G4 primitive row evidence
```

## Debug and Reports

- `reports/phase-07/primitive-feature-matrix.json`
- `reports/phase-07/inheritance-origin-audit.json`
- `reports/phase-07/rounding-drift.json`
- `reports/phase-07/touched-part-diffs.json`
- `reports/phase-07/powerpoint-visual-results.json`

## Risks and Controls

- **Shared inheritance mutation:** local override by default; shared edits require distinct operations.
- **Font-dependent layout:** pin test fonts, record substitutions, and separate semantic from provider visual results.
- **Precision accumulation:** retain EMU/raw values and test repeated exports.
- **Silent effect loss:** preserve unknown XML fragments and downgrade editability rather than regenerate.
- **Transport mismatch:** validate the real TipTap structure at the server
  boundary; never let a test-only plain string qualify the production adapter.

## Success Criteria

- [ ] Every promoted primitive property has import, edit, journal, patch, re-import, and untouched-part evidence; rows promoted to level 5 also have protected provider evidence.
- [ ] The exact plain-run seed is adapter-qualified and transaction-eligible only
      for the strict TipTap subset; it is not level-4 promoted by G2.
- [ ] Later candidates remain candidates until complete production transaction
      evidence passes; unfinished rows remain preserve-only and cannot block G2.
- [ ] Nested groups, placeholders, and inheritance retain authoritative identity and style origin.
- [x] Repeated exports do not accumulate out-of-tolerance geometry or text drift.
- [x] Editing supported adjacent properties preserves unsupported XML/media bytes.
- [x] Product capability rows match the actual tested editability tier.
- [ ] Focused, corpus, lint, unit, and client build validators pass; visual validators additionally pass for level-5 rows.

## Session 4 Local Scope Rebase: Active Phase Contract

This section supersedes contradictory active protected-provider wording above.

- Preserve the existing primitive, inheritance, strict TipTap transport, and
  package-backed adapter details. The first plain-run seed must traverse the real
  save, server-derived journal, part-aware patch, direct OfficeCLI validation,
  native re-import, semantic comparison, untouched-part, and atomic publication
  path.
- Keep adapter qualification, transaction eligibility, and row promotion
  independent. Family or sibling evidence never promotes another canonical row.
- Preserve authoritative OOXML identities and raw units. Adjacent unsupported
  properties and unknown XML/media remain byte-identical outside declared impact
  closure.
- Central row gating covers every primitive mutation surface and the server
  independently reauthorizes the exact row and current matrix subject.
- A row requesting the local PowerPoint claim must pass the Phase 13 local oracle
  for the exact package and environment subject. This evidence is environment
  bound and does not imply independent isolation or universal compatibility.

Run focused adapter, inheritance, normalization, journal, repeated-roundtrip,
untouched-part, matrix-row, and mutation-surface tests, then corpus, lint, unit,
and client build validators. Run local PowerPoint visual checks only for rows
requesting `G5`. Completion requires all named evidence for each promoted row,
with unfinished rows remaining explicitly unpromoted or preserve-only.
