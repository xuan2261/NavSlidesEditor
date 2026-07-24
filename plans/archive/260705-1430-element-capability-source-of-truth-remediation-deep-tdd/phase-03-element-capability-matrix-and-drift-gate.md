---
phase: 3
title: "Element Capability Matrix and Drift Gate"
status: completed
priority: P0
dependencies: [1, 2]
---

# Phase 03: Element Capability Matrix and Drift Gate

## Overview

Create an executable element capability matrix so every canonical element type has explicit create/render/control/export coverage or an accepted limit.

## Requirements

- Functional: each canonical element type must have a matrix row for create path, canvas render path, Properties Panel route, Format ribbon policy, shared HTML renderer, and PPTX policy.
- Functional: the matrix gate must fail for untracked element types or missing capability decisions.
- Non-functional: matrix should reuse existing feature inventory scripts where possible.

## Architecture

Extend the existing feature-inventory matrix system first. The repo already has `scripts/feature-inventory/element-control-expected-controls.json`, `element-control-audit-matrix.json`, and `validate-element-control-audit-matrix.mjs`; creating a parallel `client/src/data/element-capability-matrix.js` is forbidden unless the existing validator cannot express a required policy.

Possible status vocabulary:
- `implemented`
- `fallback`
- `accepted-limit`
- `not-applicable`
- `missing`

`missing` must fail the gate.

Required row fields:
- `element`
- `surface`
- `status`
- `policy`
- `evidence`
- `testCoverage`
- `decision`

## Related Code Files

- Modify: `scripts/feature-inventory/element-control-expected-controls.json`
- Modify: `scripts/feature-inventory/element-control-audit-matrix.json` only through generation or audited deterministic script output
- Modify: `scripts/feature-inventory/validate-element-control-audit-matrix.mjs`
- Modify: `scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs`
- Modify: `scripts/feature-inventory/build-matrix.mjs`
- Modify: `package.json` only if a new script is necessary

## TDD Steps

1. Add failing validator test that every `Object.keys(ELEMENT_DEFAULTS)` has capability rows in the existing element-control matrix.
2. Add failing validator test that rows cover these surfaces: `create`, `canvas`, `properties`, `formatRibbon`, `htmlExport`, `pptxExport`.
3. Add failing validator test for required row fields.
4. Add failing test that no surface status is `missing`.
5. Add or generate matrix rows for all 19 types.
6. Wire matrix validation into existing `npm run matrix:gate` or `npm run matrix:element-control`.
7. Regenerate reports through scripts, never by hand-editing generated JSON.

## Targeted Tests

```powershell
npx vitest run scripts/feature-inventory/validate-element-control-audit-matrix.test.mjs
npm run matrix:element-control
npm run matrix:gate
```

## Success Criteria

- [x] 19 element types have complete capability rows.
- [x] New element type without matrix coverage fails tests.
- [x] Format ribbon and PPTX gaps are explicit policy decisions, not accidental omissions.
- [x] Generated matrix output is deterministic.
- [x] No second independent matrix source is introduced.

## Risk Assessment

Risk: overfitting matrix to current implementation and blocking legitimate fallback behavior. Mitigation: allow `accepted-limit` and `fallback`, but require a reason and test-backed policy.
