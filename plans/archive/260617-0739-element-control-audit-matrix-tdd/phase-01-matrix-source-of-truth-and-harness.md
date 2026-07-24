# Phase 01 Matrix Source Of Truth And Harness

## Context Links

- [Current audit report](../260609-0830-element-control-functional-fixes-tdd/reports/260617-element-control-audit-matrix-current-state-report.md)
- [Feature coverage matrix rules](../../docs/code-standards.md)
- `C:/Work/NavSlidesEditor/client/src/data/element-defaults.js`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json`

## Overview

Priority: P0
Status: Completed
Goal: create a machine-readable audit matrix and a small validator so statuses are explicit, not trapped in prose.

## Key Insights

- The repo already has a feature inventory pipeline. Do not replace it.
- The element-control matrix is more detailed than current capability tags.
- The matrix must distinguish `works`, `partial`, `broken`, and `export-gap`.

## Requirements

<!-- Updated: Validation Session 1 - Phase 01 gate requires full expected-control inventory and full 19-element matrix rows before control fixes; evidence-backed partial/export-gap rows are allowed. -->

Functional:
- Add the matrix source file under `scripts/feature-inventory/` and generate readable reports into `plans/260617-0739-element-control-audit-matrix-tdd/reports/`.
- Add an expected-control inventory that defines every included, deferred, and out-of-scope user-facing control per canonical element type and surface.
- Cover all 19 canonical element types from `ELEMENT_DEFAULTS`.
- Complete expected inventory and matrix row coverage before any control fixes start; do not use a skeleton matrix with missing expected rows as a pass condition.
- Use one row per `element/control/surface`; never mix multiple surfaces with conflicting status in one row.
- Include columns: `id`, `element`, `control`, `surface`, `status`, `evidence`, `testCoverage`, `decision`.
- For content-bearing controls, include security columns: `trustBoundary`, `inputSource`, `sink`, `sanitizerOrEscaper`, `urlSchemePolicy`, `negativeSecurityTests`.
- Generate or validate a markdown report from the source.
- Integrate the validator into `npm run matrix:gate` through a dedicated script path.

Non-functional:
- Keep script simple Node.js, no new dependency.
- Matrix row IDs stable: `element.control.surface` style.
- Validator must reject aggregate/mixed-surface statuses.
- No hand edits to generated `docs/feature-coverage-matrix.md`.

## Architecture

```text
expected-control inventory
  -> matrix source json
  -> validator script
  -> generated/checked markdown report
  -> npm run matrix:gate
  -> tests verify canonical element coverage + control + surface + security invariants
```

## Related Code Files

Modify/create:
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/element-control-audit-matrix.json`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/element-control-expected-controls.json`
- `C:/Work/NavSlidesEditor/plans/260617-0739-element-control-audit-matrix-tdd/reports/element-control-audit-matrix-current.md`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/validate-element-control-audit-matrix.mjs`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs` or Vitest equivalent
- `C:/Work/NavSlidesEditor/package.json`

Read:
- `C:/Work/NavSlidesEditor/client/src/data/element-defaults.js`
- `C:/Work/NavSlidesEditor/scripts/feature-inventory/feature-manifest.json`

Delete:
- None.

## Tests First

1. Add validator test that fails when a canonical element type has zero matrix rows.
2. Add validator test that fails when an expected control/surface has no matrix row.
3. Add validator test that fails for unknown status outside `works|partial|broken|export-gap`.
4. Add validator test that fails when a row has `surfaces` array or otherwise mixes surface status.
5. Add validator test that fails when a row lacks evidence and at least one target test.
6. Add validator test that fails when content-bearing rows lack security fields or negative security test decisions.
7. Add snapshot or inline assertion for current 19-element coverage count.

Suggested command:

```bash
npm run test -- scripts/feature-inventory/validate-element-control-audit-matrix
```

## Implementation Steps

1. Define expected-control inventory as plain JSON:
   - `element`
   - `control`
   - `surfaces`
   - `scope`: `included`, `deferred`, or `out-of-scope`
   - `rationale`
2. Define matrix schema as plain JSON:
   - `id`
   - `element`
   - `control`
   - `surface`
   - `status`
   - `evidence`
   - `tests`
   - `notes`
   - `security` object for content-bearing controls
3. Seed rows from the current audit report.
4. Write validator script and generated markdown report.
5. Add a dedicated npm script and call it from `npm run matrix:gate`.
6. Keep generated report deterministic and git-diffable.

## Todo List

- [x] Write matrix schema.
- [x] Write expected-control inventory.
- [x] Seed rows for all 19 element types.
- [x] Add validator test coverage.
- [x] Generate/readable report.
- [x] Wire validator into `npm run matrix:gate`.

## Completion Notes

- Added `element-control-expected-controls.json` with included, deferred, and out-of-scope controls.
- Added `element-control-audit-matrix.json` with 76 explicit `element/control/surface` rows across all 19 canonical element types.
- Added validator CLI + Vitest coverage and wired it through `npm run matrix:element-control` and `npm run matrix:gate`.
- Generated `reports/element-control-audit-matrix-current.md` from the source matrix.

## Success Criteria

- Validator fails on missing element type.
- Validator fails on missing expected control/surface row.
- Validator allows evidence-backed `partial` and `export-gap` rows, but fails rows with missing evidence or placeholder-only decisions.
- Validator fails on invalid status.
- Validator fails on ambiguous aggregate surface status.
- Validator fails on missing required security fields for content-bearing controls.
- Matrix explicitly lists current high-risk rows A1-A8.
- No stale 2026-06-09 fixed defects remain marked `broken`.

## Risk Assessment

- Risk: matrix becomes another manual artifact.
  Mitigation: validator enforces minimum structure.
- Risk: too many rows block progress.
  Mitigation: expected-control inventory explicitly marks controls as included, deferred, or out-of-scope; no silent omissions.

## Red Team Review Applied

- Finding 1: status is per `element/control/surface`; aggregate mixed-surface rows are invalid.
- Finding 2: expected-control inventory is mandatory so the gate can catch missing controls.
- Finding 3: validator and generated report are required repo tooling and must run through `matrix:gate`.
- Finding 5: content-bearing controls require explicit security invariants and negative-test decisions.

## Security Considerations

- Matrix stores paths/status only. No secrets.
- Do not include sample auth tokens, uploaded file contents, or private presentation data.
- Content-bearing rows must identify trust boundary, sink, sanitizer/escaper, URL scheme policy, and adversarial payload coverage before they can be marked `works`.

## Next Steps

Phase 02 uses matrix IDs for cross-cutting control tests.
