---
phase: 1
title: "TDD foundation: honest metric + golden masters"
status: complete
priority: P1
effort: "2d"
dependencies: []
---

# Phase 1 — TDD Foundation: Honest Metric + Golden Masters

Re-baseline what "passing" means before touching behavior. The fidelity tester silently scores `other`/`latex` at 0% property coverage; fix that lie. Capture golden master snapshots of current mapper output so subsequent bug fixes show diff explicitly, not by accident.

## Context Links

- Brainstorm: `plans/260524-1729-pptx-import-review/reports/findings.md` sections P0-C, P3-R
- Research: `plans/260524-1729-pptx-import-review/research/researcher-260524-tdd-refactor.md` sections 1, 5

## Overview

- Priority: P1
- Brief: Two-track work. Track A: fix metric honesty in fidelity tester for `other`/`group`/`diagram`. Track B: lay snapshot tests for mapper outputs so behavior drift is detectable.

## Key Insights

- **Red-team verified:** `propertyCoverage` at `pptx-import-semantic-and-roundtrip-fidelity-tester.js:377-385` already extends to `other`/`group`/`diagram`. The real dishonest-score bug is in `evaluateCapture` (~line 556+) which dispatches to shape-criteria for `latex` elements instead of latex-specific criteria. Fix targets `evaluateCapture` dispatch, NOT the propertyCoverage block.
- Snapshots must strip non-deterministic fields: `id` (uuid), `_pptxImportMeta._pptxSharpen` (float precision).
- Vitest snapshot support already present (`globals: true`); no library install needed.
- Two callers of mapper: `importer.js:4` and the tester at line 13. Keep both green.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | Modify | +30/-5 |
| `server/services/pptx-import/mapper-golden-master.test.js` | Create | +120 |
| `server/services/pptx-import/__snapshots__/mapper-golden-master.test.js.snap` | Create (auto) | +400 |
| `server/services/pptx-import/corpus-baseline.json` | Create | +60 |
| `server/services/pptx-import/corpus-baseline.test.js` | Create | +90 |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `mapper.test.js` (1508 LOC) | No | Stays green |
| `geometry-drift.test.js` | No | Stays green |
| `pptx-import-e2e-flow.test.js` | No | Stays green |
| New: `mapper-golden-master.test.js` | New | 6-8 snapshots: shape, image, table, text, math, group, line, diagram |
| New: `corpus-baseline.test.js` | New | Run corpus tester against `PPTX/`, assert metrics not below baseline |

New test count: +2 files, +12 assertions approx.

## Function/Interface Checklist

- Locate `evaluateCapture` (~line 556+) — it dispatches to per-type scoring criteria. Verify branch for `latex`/`other` either misses or routes to shape criteria, producing the 0% score.
- Add dedicated latex/math criteria: required props = `latex`, `fontSize`; optional = `mathml` fallback.
- Add per-type criteria for `group` (`children` length > 0, `transform` matrix) and `diagram` (`children`, `connectorMode`) if also missing from dispatch.
- Verify `propertyCoverage` aggregation at ~line 377-385 includes all 9 types AFTER the dispatch fix.
- New `stripIds(elements)` utility in golden-master test:
  - Recursively strips `id`, `_pptxImportMeta._pptxSharpen`, any uuid-shaped strings.

## Dependency Map

- Blocks: Phases 2-8 (snapshot baseline must exist before behavior-changing edits)
- Blocked by: none

## Tests Before (Characterization Gate)

- [x] Confirm `npm test` green on current master
- [x] Run `npm run test:corpus` and snapshot output to `corpus-baseline.json`: `{ semantic: 0.98, roundTrip: 0.99, perDeck: {...} }`
- [x] Run mapper tests `npx vitest run server/services/pptx-import/mapper.test.js` — green

## Refactor / Implement

- [x] **First**: Read `evaluateCapture` body (~line 556+) and trace dispatch for `latex`/`other` elements. Record current behavior in a characterization comment in the test file.
- [x] Add latex/math criteria branch in `evaluateCapture`. For `other` with `latex` string: required props = `latex`, `fontSize`. For `group`: `children`, `transform`. For `diagram`: `children`, `connectorMode`.
- [x] Verify category list `['text','shape','image','table','chart','group','diagram','line','other']` appears in scoring branches (~line 223, ~line 598).
- [x] Add CLI flag `--baseline-out=<path>` to tester to emit JSON metrics summary.
- [x] Create `mapper-golden-master.test.js`:
  - 8 deterministic synthetic inputs (one per element type) reused from `mapper.test.js` fixtures.
  - Each `it` calls `mapPptxOutput()`, strips ids, `toMatchSnapshot()`.
- [x] Create `corpus-baseline.test.js`:
  - `it.skip(!fs.existsSync('./PPTX'), ...)` pattern from `harness-integration-real-export-path.test.js:12`.
  - Calls tester programmatically; asserts metrics >= baseline from `corpus-baseline.json`.

## Tests After (New Unit Tests)

- [x] `mapper-golden-master.test.js` -> 8 snapshots created; rerun must match.
- [x] `corpus-baseline.test.js` -> baseline asserted; failing if any deck drops > 1pp.
- [x] `propertyCoverage` for `other` on Bai_2_2 now reports non-zero (verifies the fix).

## Regression Gate

- [x] `npm test` — full suite green
- [x] `npm test -- --coverage` — thresholds preserved (lines:33, branches:28, fns:26 per vitest.config.mjs)
- [x] LOC budget: new files <= 180 LOC
- [x] `npm run test:corpus` — green, but expect numeric shift in `other` coverage (document expected delta in `corpus-baseline.json`)

## Success Criteria

- Tester reports non-zero property coverage on `other`/`group`/`diagram` for all corpus decks.
- 8 golden snapshots exist; `npm test` re-baselines them as failing if mapper output changes.
- `corpus-baseline.json` committed; CI gate ready.

## Risk Assessment

- Risk: snapshot brittleness on `_pptxImportMeta._pptxSharpen` floating-point. Mitigation: stripper rounds to 4 decimals.
- Risk: existing tester baseline (98%/99%) silently relied on dishonest score; new score may dip. Mitigation: re-derive baseline AFTER metric fix, commit new floor.
- Risk: nondeterministic `id` field leaks into snapshot. Mitigation: recursive `stripIds` walk including nested `children`, `cells`.

## Rollback Plan

- All Phase 1 changes are additive (new files + tester scoring extension). Revert the tester scoring branch + delete the 4 new files; no migration needed.

## Completion Notes

1. Latex/math branch uses the same required-property weighting as other element criteria.
2. Phase 9 finalized the corpus gate with aggregate floors plus per-deck semantic floor >= 95%.
3. Final reviewer-fix validation confirmed math/LaTeX HTML cleanup strips both opening and closing tags; focused mapper regression tests and full `npm test` passed.
