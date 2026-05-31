---
title: "PPTX Import Unit-Conversion + Scale-Propagation Fixes — Deep TDD Plan"
description: "Fix 12 fidelity bugs discovered post v1.9.7: pt→px CSS unit leak (Bug #1, #4), resolution mismatch (Bug #2), raw pt scale propagation in shadow/border/stroke (Bug #5, #6, #7, #8), SVG path scaling (Bug #9), table fontSize/fontFamily loss (Bug #3), shape rich-text → plain text loss (Bug #10), single-run metadata capture (Bug #11), and unapplied text insets (Bug #12)."
status: implemented
priority: P0
effort: "6-9 dev-days"
branch: master
tags: [pptx-import, fidelity, units, tdd, deep]
created: 2026-05-25
createdBy: ck-plan-skill
source: skill
mode: "--deep --tdd"
blockedBy: []
blocks: []
related_plans:
  - 260524-1729-pptx-import-review (completed — addressed image loss, geometry drift, mapper split; this plan addresses bugs discovered AFTER that plan landed)
---

# PPTX Import Unit-Conversion + Scale-Propagation Fixes

## Overview

User symptom: PPTX-imported text renders about 33% too large and overflows. Root cause: pptxtojson emits lengths in `pt`; NavSlides stores/renders canvas data in `px`; current importer leaks `pt` CSS and raw `pt` numeric fields into render/export surfaces.

Plan mode: `--tdd`. Each phase starts Red -> Green -> Refactor and includes explicit verification.

## Scope

Fix 12 importer fidelity bugs: CSS `pt` leaks, non-default slide-size mismatch, raw `pt` propagation in numeric fields, table font metadata loss, shape rich-text loss, SVG path uncertainty, unapplied text insets, and missing corpus/visual gates.

## Phase Index

| # | Phase | Status | File |
|---|---|---|---|
| 1 | Sanitizer pt->px conversion | implemented | `phase-01-sanitizer-pt-to-px-conversion.md` |
| 2 | Non-default slide-size resolution | implemented | `phase-02-resolution-mismatch-for-non-default-slide-sizes.md` |
| 3 | Shadow/border/stroke scale propagation | implemented | `phase-03-raw-pt-scale-propagation-in-shadows-borders-strokes.md` |
| 4 | SVG path scaling verification | implemented | `phase-04-svg-path-scaling-verification.md` |
| 5 | Table font + size fidelity | implemented | `phase-05-table-fontsize-and-fontfamily-fidelity.md` |
| 6 | Shape rich-text + multi-run metadata | implemented | `phase-06-shape-rich-text-preservation-and-multi-run-metadata.md` |
| 7 | Text insets on client | implemented | `phase-07-text-insets-application-on-client.md` |
| 8 | Acceptance gate + rollout | implemented | `phase-08-acceptance-gate-corpus-visual-regression-and-rollout.md` |

## Dependencies

`Phase 1 -> Phase 2/3/4/5/6/7 -> Phase 8`; Phase 5 also depends on Phase 3. Total nominal: 7.5 dev-days.

## Success Criteria

- Unit and integration tests added first for every phase.
- `npm run test:corpus` keeps existing strict gate: aggregate semantic >= 98%, no deck < 95%, class drop <= 15%, n >= 10.
- New source-to-DOM trace gates prove font-size and letter-spacing within +/-1 px.
- Non-default slide fixture passes import, render, export, and re-import.
- Numeric length fields follow one documented pt-to-canvas-px contract.
- Visual regression spec passes within 0.2% pixel diff, with reviewed baselines.
- Docs updated: `docs/project-changelog.md` and `docs/pptx-import-fidelity-report.md`.

## Constraints

- KISS/YAGNI/DRY; kebab-case files; CJS server, ESM tests; no default exports.
- Tests-first per phase: Red, Green, Refactor.
- Unit conversion is single-direction at importer boundary: CSS `pt` -> `px` at `x4/3`; numeric PPTX fields -> canvas-px through field-specific contracts.
- Backward compatibility covers old imported rich HTML in client canvas and shared present/export.
- Golden-master snapshots re-baselined only in Phase 8 after corpus proves fidelity improved.

## Cross-Plan Dependencies

- **`260524-1729-pptx-import-review`** — Completed 2026-05-25. Established mapper split, golden-master infrastructure, corpus baseline gate, and async import flow that this plan builds on. NOT blocking.
- **`260523-0500-upstream-parity-verification-tdd`** — In progress, upstream parity scope; touches a different layer (E2E + corpus expansion). No file overlap.
- **`260524-0959-e2e-cleanup-and-coverage-tdd`** — Completed. This plan's Phase 8 adds a new visual-regression spec under `tests/e2e/` and must follow the completed e2e-cleanup conventions.

## Evidence And Reports

- Red-team/validation summary: `reports/planner-validation-and-red-team-summary.md`
- Detailed red-team reports: `reports/from-code-reviewer-to-planner-red-team-*.md`
- Visual baseline review: `reports/visual-baseline-review.md`

## Handoff

Next command: `/ck:cook C:\Work\NavSlidesEditor\plans\260525-1450-pptx-import-unit-conversion-and-scale-fixes\plan.md`
