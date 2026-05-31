# Phase 9 Acceptance Gate Report

Date: 2026-05-25
Plan: `plans/260524-1729-pptx-import-review`

## Scope

- Expanded the default PPTX corpus to `server/data/test-corpus/`.
- Added strict corpus gates for aggregate fidelity, per-deck semantic floor,
  element-class retention, production round-trip, and corpus size.
- Updated `npm run test:corpus` to use the default corpus.

## Corpus

- Total decks: 10
- Existing copied decks: 4 from `PPTX/`
- Hand-built synthetic decks: 6
- Largest deck: `STTre_Duc.pptx`, about 2.88MB

Current parser note: `chart-bars-lines.pptx` and `chart-pie-scatter.pptx`
contain native PPTX charts, but `pptxtojson` exposes them as shape-backed
content in current metrics. True chart extraction remains a follow-up.

## Final Gate Results

- `npm run test:corpus`: 10/10 passed, semantic 100.0%, round-trip 99.0%.
- `npx vitest run server/services/pptx-import/mapper-golden-master.test.js`: 8 passed.
- `npm run build`: passed.
- `npm test`: 182 files passed, 1 skipped; 1521 tests passed, 8 skipped.
- `npx vitest run --coverage`: 182 files passed, 1 skipped; 1521 tests passed, 8 skipped.
- Coverage: statements 37.15%, branches 32.01%, functions 31.77%, lines 38.64%.

## Remaining Notes

- Full Vitest and coverage are slower because `corpus-baseline.test.js` now
  imports the 10-deck corpus.
- CI placement for `npm run test:corpus` remains a policy decision; nightly is
  safer until PR runtime budget is accepted.

**Status:** DONE
**Summary:** Phase 9 acceptance is complete with n=10 corpus and final strict gates passing.
**Concerns/Blockers:** True chart/SmartArt parser coverage remains follow-up scope.
