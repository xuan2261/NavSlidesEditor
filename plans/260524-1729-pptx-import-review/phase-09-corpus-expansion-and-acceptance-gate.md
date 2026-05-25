---
phase: 9
title: "Corpus expansion + acceptance gate"
status: complete
priority: P1
effort: "3d"
dependencies: [7, 8]
---

# Phase 9 — Corpus Expansion + Acceptance Gate

Current corpus (4 Vietnamese school decks in `PPTX/`) hides chart/SmartArt/animation/Office365 gaps. Expand to n>=10 in `server/data/test-corpus/`, then enforce strict gates as the final acceptance.

## Context Links

- Brainstorm: P3-P, sections 4.4-4.5
- Source target: `server/data/test-corpus/` (does NOT exist yet — create in this phase)
- Tester: `pptx-import-semantic-and-roundtrip-fidelity-tester.js` (1198 LOC)

## Overview

- Priority: P1 (acceptance gate)
- Current status: Complete
- Brief: Two tracks. (a) Collect or commission 6-11 additional PPTX fixtures covering missing categories. (b) Update tester to default to `server/data/test-corpus/` when no arg given; tighten strict gates; run final acceptance pass.

## Key Insights

- 4-deck corpus is too small to catch chart-heavy / SmartArt-heavy regressions (P1-I, P1-J in findings).
- New corpus dir at `server/data/test-corpus/` is the documented destination — `PPTX/` stays for backward compat as fallback.
- Acceptance gate must enforce per-deck floor (not just avg) — Bai_2_1's 30% image loss was masked by average-only.
- Current parser note: the hand-built chart PPTX files contain native charts, but `pptxtojson` exposes them as shape-backed content in current metrics. This is documented in the corpus README and remains a parser/upstream follow-up, not a fabricated chart score.

## Corpus Targets (6-11 new decks)

| Category | What to capture | Count | Source |
|---|---|---|---|
| Chart-heavy | Column + bar + line + pie + scatter + combo | 2 | hand-built or open-source samples |
| SmartArt-heavy | Org chart, process flow, hierarchy, matrix | 1-2 | hand-built |
| Animation-heavy | Verify drops with warnings | 1 | hand-built |
| Office 365 modern | Icons, 3D models, modern charts | 1 | hand-built or template gallery |
| Background images | Full-bleed slide backgrounds | 1 | hand-built |
| Presenter notes + headers/footers | Speaker view metadata | 1 | hand-built |
| Math-heavy | LaTeX equations, sub/sup, fractions | 1 | hand-built |
| Mixed real-world | Existing Vietnamese decks | (4) | retained in `PPTX/` |

Total target: n >= 10 (incl. existing 4). Ideal: n = 12-15.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/data/test-corpus/` | Create dir + 6-11 .pptx files | binary; no LOC |
| `server/data/test-corpus/README.md` | Create — describes each fixture | +50 |
| `.gitignore` | Modify (allow tracked `server/data/test-corpus/`) | +2 |
| `server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js` | Modify (default dir + per-deck floor + element-class drop check) | +60/-10 |
| `server/services/pptx-import/corpus-baseline.json` | Update (n>=10 baseline) | +120 |
| `server/services/pptx-import/corpus-baseline.test.js` | Modify (assert new floors) | +30 |
| `package.json` | Modify (`test:corpus` script picks up new default dir) | +1 |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `corpus-baseline.test.js` (Phase 1) | Yes — update floors | Aggregate >= 98% / 99%; per-deck >= 95% semantic |
| `pptx-import-e2e-flow.test.js` | Verify still green | |
| `mapper-golden-master.test.js` | No change expected | If snapshot diff appears, root-cause before proceeding |
| New: corpus per-deck integration tests | Optional | Auto-generated from corpus dir |

New tests: tester self-test additions only.

## Function/Interface Checklist

### Tester changes

- Default input dir at top of tester: 
  ```js
  const DEFAULT_CORPUS = path.join(__dirname, '..', '..', 'data', 'test-corpus')
  const corpusDir = argv[0] ?? (fs.existsSync(DEFAULT_CORPUS) ? DEFAULT_CORPUS : './PPTX')
  ```
- Per-deck floor enforcement in `applyStrictPerTypeGates`:
  ```js
  const PER_DECK_MIN_SEMANTIC = 0.95
  if (deckSemantic < PER_DECK_MIN_SEMANTIC) failures.push({ deck, reason: 'below 95% semantic' })
  ```
- Element-class drop check (new):
  ```js
  const MAX_CLASS_DROP_PCT = 0.15
  for (const cls of ['image','shape','table','text','chart','group','diagram','line','other']) {
    const originCount = counts.origin[cls] ?? 0
    const mappedCount = counts.mapped[cls] ?? 0
    if (originCount > 0 && (originCount - mappedCount) / originCount > MAX_CLASS_DROP_PCT) {
      failures.push({ deck, cls, drop: ((originCount - mappedCount) / originCount * 100).toFixed(1) + '%' })
    }
  }
  ```
- CLI flag `--per-deck-min=<pct>` and `--max-class-drop=<pct>` for tuning.

## Dependency Map

- Blocks: nothing (terminal phase)
- Blocked by: Phase 7 (refactored mapper), Phase 8 (async pipeline)

## Tests Before (Characterization Gate)

- [x] Confirm `npm test` green
- [x] Confirm `npm run test:corpus` green on default 10-deck corpus
- [x] Confirm `corpus-baseline.json` reflects Phase 9 final state

## Refactor / Implement

### Sub-step A: Tester updates (Day 1)

- [x] Add `DEFAULT_CORPUS` fallback to `server/data/test-corpus/`.
- [x] Add per-deck semantic floor (>= 95%).
- [x] Add element-class drop check (>= 85% retention per class on counts > 0).
- [x] Add CLI flags `--per-deck-min`, `--max-class-drop`.
- [x] Update `package.json` `test:corpus` script: keep default arg-less to use new default.

### Sub-step B: Corpus collection (Day 1-2)

- [x] Create `server/data/test-corpus/` dir.
- [x] Add 6 PPTX fixtures per categories above plus 4 copied existing decks for n=10.
- [x] Write `server/data/test-corpus/README.md` describing each fixture, source, what it tests.
- [x] Do NOT delete existing `PPTX/` fixtures — kept as fallback.
- [x] Add `.gitignore` exception so `server/data/test-corpus/` can be committed despite runtime `server/data/*` ignores.

### Sub-step C: Acceptance run (Day 3)

- [x] Run `npm run test:corpus` (`--roundtrip --strict`) on n=10 corpus.
- [x] If failures: document each, decide block (real regression) vs accept (corpus too aggressive). No failures.
- [x] Update `corpus-baseline.json` to lock new floors.
- [x] Update `corpus-baseline.test.js` to assert new floors.

## Tests After (New Unit Tests)

- [x] `corpus-baseline.test.js`:
  - `it('aggregate semantic >= 98%')`
  - `it('aggregate round-trip >= 99%')`
  - `it('no deck below 95% semantic')`
  - `it('no element-class drop > 15%')`
  - `it('runs against test-corpus dir by default')`

## Regression Gate (FINAL ACCEPTANCE)

- [x] `npm test` — full suite green: 182 files passed, 1 skipped; 1521 tests passed, 8 skipped.
- [x] `npx vitest run --coverage` — thresholds preserved: statements 37.15%, branches 32.01%, functions 31.77%, lines 38.64%.
- [x] LOC budget: tester <= 1300 LOC; final tester is 1299 LOC and `pptx-import-corpus-cli.js` is 111 LOC.
- [x] **Acceptance gate (verbatim):** `npm run test:corpus -- --strict --roundtrip` MUST satisfy ALL of:
  - Avg semantic fidelity >= 98% AND avg round-trip stability >= 99%
  - NO deck below 95% semantic
  - NO element-class count drop > 15% for any of: image, shape, table, text, chart, group, diagram, line, other/math
  - n >= 10 decks in `server/data/test-corpus/`
- [x] **Geometry-drift abort (red-team verified):** `mapper-golden-master.test.js` snapshots IDENTICAL to pre-Phase-7 baseline. Any snapshot diff after Phase 7 mapper-split MUST BLOCK acceptance — corpus aggregate alone can mask geometry regressions because shape/box drift averages out within a class.
- [x] All gates pass; `corpus-baseline.json` refreshed as final v1 acceptance bar.
- [x] Confirm `package.json:44` `test:corpus` script no longer hardcodes `./PPTX` — defaults to `server/data/test-corpus/` (per Sub-step A tester change).

## Success Criteria

- 6-11 new PPTX fixtures committed to `server/data/test-corpus/`.
- Tester defaults to new dir.
- Acceptance gate passes; documented as v1 baseline.
- Per-deck floor catches regressions average alone hides.
- Element-class drop catches silent image-loss patterns (the original P0-B failure mode).

## Risk Assessment

- **v1 threshold lock (validation-confirmed):** 15% element-class drop threshold is v1 acceptance bar. Tightening to 10% is deferred to v1.1 follow-up plan after Phase 2 (image loss) and Phase 4 (table borders) prove green on n>=10 corpus.
- **Phase 3 contingency wiring:** If Phase 3 diagnostic identifies upstream `pptxtojson` as root cause for shape drift, Phase 9 acceptance gate honors `--exclude-class-drop=shape` flag (per Phase 3 Sub-step B.fallback). Document the exception explicitly in `corpus-baseline.json`.
- Risk: new corpus reveals new regressions (P1-I charts, P1-J SmartArt). Mitigation: triage — if Phase 7-8 didn't address them, document as follow-up scope; tighten gate only on classes the fix did cover.
- Risk: corpus files contain copyrighted content. Mitigation: prefer hand-built; if sourced, document license in `README.md`; reject anything ambiguous.
- Risk: corpus file sizes balloon repo. Mitigation: keep each fixture < 5MB; total corpus < 50MB.
- Risk: `npm run test:corpus` runtime grows to 5+ min with n=10. Mitigation: keep individual fixtures small; consider sharding tester to parallel-run if needed (future).

## Rollback Plan

- Revert tester changes; restore old `corpus-baseline.json`. Keep new fixtures (additive). If acceptance gate fails to land, document each blocker and reduce scope.

## Remaining Notes

1. Current 10-deck strict corpus runtime is about 2 minutes; full Vitest/coverage are now slower because `corpus-baseline.test.js` imports the 10-deck corpus.
2. Generated chart decks are native PPTX charts, but parser metrics currently count them as `shape`; track true chart extraction as a follow-up.
3. CI integration choice remains outside this phase: recommend nightly for `npm run test:corpus` until runtime budget is accepted for PRs.
