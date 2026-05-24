---
phase: 3
title: "Shape geometry drift diagnostic + fix"
status: pending
priority: P1
effort: "3d"
dependencies: [1]
---

# Phase 3 — Shape Geometry Drift Diagnostic + Fix

Shape median drift 121-364 px (Bai_2_1 364px = 38% of 960px canvas). Text drift 0.5px (fine), so drift is shape-specific. Root cause unverified — three candidates from findings. Instrument before fixing.

## Context Links

- Brainstorm: P0-D
- Source files: `mapper.js:494` (`mapShape`), `geometry.js`, `geometry-drift.test.js`
- Candidates: `clampBox` in `mapLineGeometry`, group flattening nested rotations, `mapBox` rounding.

## Overview

- Priority: P1
- Brief: Two sub-steps. (a) instrument tester to emit per-shape drift JSON so we know if it's one bad group or distributed. (b) once root cause confirmed, fix it. Likely candidate from research: group flattening drops the parent transform on nested rotated children.

## Key Insights

- Median 364px on Bai_2_1 means HALF of shapes are off by ~38% of canvas. Concentrated in groups (1 bad group with N children) is most plausible.
- Existing `geometry-drift.test.js` (215 LOC) already scaffolds the test surface — extend it.
- `clampBox` is the prime suspect because line/connector mapping uses it differently than shape (`mapper.js:783-786` connector detection).

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | Modify | +50 (instrument) |
| `server/services/pptx-import/geometry.js` | Modify (after diagnosis) | +20/-15 |
| `server/services/pptx-import/mapper.js` (or relevant chunk pre-split) | Possibly modify | +10/-5 |
| `server/services/pptx-import/geometry.test.js` | New OR extend `geometry-drift.test.js` | +80 |
| `server/services/pptx-import/geometry-drift.test.js` | Modify | +40 |
| `plans/260524-1729-pptx-import-review/reports/geometry-drift-diagnostic.md` | Create | +60 |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `geometry-drift.test.js` (215 LOC) | Yes | Add per-shape drift export + assertions on median < 50px |
| `group-transform.test.js` (164 LOC) | Verify still green | Likely changes if root cause is group flattening |
| `mapper-golden-master.test.js` | Re-baseline | Shape `left`/`top`/`width`/`height` will shift |
| New: `geometry.test.js` | Create | Unit tests for `clampBox`, `mapBox`, `mapLineGeometry` boundary cases |

New tests: +1 file, +8-12 cases.

## Function/Interface Checklist

- Tester: add per-shape drift JSON emission via `--drift-out=<path>`. Format: `{ deckName, slideIdx, shapeIdx, kind, origin: {x,y,w,h}, mapped: {x,y,w,h}, deltaPx: {...} }[]`.
- `geometry.js`: review `clampBox`, `mapBox`, `mapLineGeometry` for math errors at canvas edges and nested rotations.
- `flattenGroupElement` / `buildGroupMatrix` in `mapper.js:674`: verify transform composition correctness with nested groups.

## Dependency Map

- Blocks: Phase 7 (split must reflect fixed behavior), Phase 9 (acceptance gate)
- Blocked by: Phase 1 (golden master baseline)

## Tests Before (Characterization Gate)

- [ ] Confirm `npm test` green
- [ ] `npx vitest run server/services/pptx-import/geometry-drift.test.js` — green
- [ ] Run tester with new `--drift-out=drift-baseline.json` flag; commit baseline showing current 364px median

## Refactor / Implement

### Sub-step A: Instrument (Day 1)

- [ ] Add `--drift-out=<path>` CLI flag to fidelity tester.
- [ ] Emit per-shape drift JSON during `computeDetailedFidelityMetrics`.
- [ ] Run against `PPTX/Bai_2_1.pptx`; write findings to `reports/geometry-drift-diagnostic.md`.
- [ ] Identify root cause: is it (i) one outlier group, (ii) connector clampBox, or (iii) rotation matrix?

### Sub-step B: Fix (Day 2-3, depends on A)

- [ ] If cause is `clampBox` in `mapLineGeometry`: fix bounds calculation; verify with new `geometry.test.js` boundary cases.
- [ ] If cause is group rotation: fix `buildGroupMatrix` matrix composition; verify with `group-transform.test.js`.
- [ ] If cause is `mapBox` rounding: stop rounding `left`/`top` to integers in the EMU->px conversion.
- [ ] Pick ONE root cause first; don't shotgun.

### Sub-step B.fallback: Upstream root cause (validated contingency)

If sub-step A diagnostic proves root cause lies in `pptxtojson` parser output (drift originates BEFORE mapper sees coordinates), apply this contingency instead of attempting fix:

- [ ] Emit per-shape `geometry-drift-detected` warning in mapper when shape mapped drift exceeds 50px threshold (compare origin vs mapped box). Surfaced in import-dialog warnings list.
- [ ] Document upstream limitation explicitly in `reports/geometry-drift-diagnostic.md` with reproduction recipe + minimal failing fixture.
- [ ] Coordinate with Phase 9 to add per-class exception: if upstream-root-cause flag set, exclude `shape` class from element-class drop gate for v1. New CLI flag in tester: `--exclude-class-drop=shape`.
- [ ] Open follow-up issue against `pptxtojson` upstream OR replace with `pptx2json` for affected shape types (out of scope; future plan).

## Tests After (New Unit Tests)

- [ ] `geometry.test.js`:
  - `it('clampBox preserves shape entirely inside canvas')`
  - `it('clampBox handles negative coords correctly')`
  - `it('mapBox does not round EMU values inappropriately')`
  - `it('mapLineGeometry handles diagonal connectors')`
  - `it('buildGroupMatrix composes nested rotations correctly')`
- [ ] Extend `geometry-drift.test.js` assertion: median shape drift < 50px on Bai_2_1 fixture.

## Regression Gate

- [ ] `npm test` — full suite green
- [ ] `npm test -- --coverage` — thresholds preserved
- [ ] LOC budget: `geometry.js` <= 180 LOC
- [ ] `npm run test:corpus` — Bai_2_1 median shape drift <= 50px; max <= 200px; re-baseline `corpus-baseline.json`
- [ ] Re-baseline `mapper-golden-master.test.js` for shape elements (review diff carefully)
- [ ] `group-transform.test.js` still green

## Success Criteria

- Bai_2_1 median shape drift drops from 364px to <= 50px.
- Bai_2_5 median drift drops from 326px to <= 50px.
- Bai_2_2 stays <= 121px.
- All four corpus decks pass strict gates.

## Risk Assessment

- High risk: fixing geometry can cascade into shape-positioning regressions across ALL decks. Mitigation: per-shape drift JSON gives surgical diff; review every changed snapshot.
- Risk: root cause is multiple candidates compounding. Mitigation: instrument fully first, then fix the dominant one and re-measure.
- Risk: `clampBox` change breaks `geometry-drift.test.js` baseline. Mitigation: that test exists to lock in current state; expected to update.

## Rollback Plan

- Revert `geometry.js` and any mapper.js delta. Snapshots: `git checkout` on `__snapshots__/`. Per-deck drift JSON retained for future investigation.

## Unresolved Questions

1. Is shape drift on Bai_2_2 (median 121px) acceptable, or part of same root cause?
2. Connector clampBox: connectors at very-edge of canvas — current `clampBox` may legitimately need to be looser for them.
