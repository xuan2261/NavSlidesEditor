---
phase: 7
title: "Validate on 4-Deck Corpus + Targets"
status: completed
priority: P1
effort: 3h
dependencies: ["6"]
---

# Phase 7: Validate on 4-Deck Corpus + Targets

## Overview

Chạy fidelity tester trên 4 deck corpus với production pipeline, mandatory rasterization, and improved matching. Verify official targets được meet, update documentation.

## Requirements

- Functional: Round-trip stability ≥ 98% overall, report updated
- Non-functional: Results reproducible, report đầy đủ

## Architecture

```bash
# Strict production export + mandatory rasterization + improved matching
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict
```

## Related Code Files

- Modify: `docs/pptx-import-fidelity-report.md` — update stability scores
- Read: `plans/reports/baseline-roundtrip-report.md` — Phase 0 baseline
- Read: `plans/reports/final-roundtrip-report.md` — final strict corpus report
- Read: Phase 0 baseline scores

## Implementation Steps

### Step 1: Run full corpus with --roundtrip --strict

```bash
node server/services/pptx-import/pptx-import-semantic-and-roundtrip-fidelity-tester.js ./PPTX --roundtrip --strict
```

### Step 2: Collect metrics

Record per deck:
- Overall stability %
- Per-element type breakdown (text, shape, line, table, image)
- Export method (must be 'production')
- Raster status (must be available; no minimal fallback)
- Timing (ms)

### Step 3: Compare against targets

| Metric | Target | Baseline | Result | Pass? |
|--------|--------|----------|--------|-------|
| Overall Stability | ≥98% | 1–7% | 99.0% | Pass |
| Text Stability | ≥99% | ~7% | 100.0% | Pass |
| Shape Stability | ≥99% | ~3% | 100.0% | Pass |
| Line Stability | ≥99% | ~5% | n/a in corpus report | N/A |
| Table Stability | ≥95% | ~2% | 100.0% | Pass |
| Image Stability | ≥99% | ~60% | 100.0% | Pass |
| Background Stability | ≥98% | 0% | strict raster path used | Pass |
| Chart Stability | ≥90% | unknown | n/a in corpus report | N/A |
| Semantic Fidelity | ≥95% | 95% | 97.0% | Pass |

### Step 4: Analyze remaining gaps

Final strict corpus run met the official target. No blocking gaps remained; deck-specific warnings are documented in `plans/reports/final-roundtrip-report.md`.

### Step 5: Update documentation

Update `docs/pptx-import-fidelity-report.md`:

**Round-trip Results section:**
```
| Corpus | Semantic Fidelity | Round-trip Stability | Method |
|--------|-----------------|---------------------|--------|
| PPTX/ (4 files) | 97.0% | 99.0% | Production Export + Mandatory Raster |

Per-deck breakdown:
- Bai_2_1.pptx: 96.0% / 98.0%
- Bai_2_2.pptx: 95.0% / 99.0%
- Bai_2_5.pptx: 97.0% / 97.0%
- STTre_Duc.pptx: 98.0% / 100.0%
```

**Round-trip Gaps (Post-Unification):**
```
- Production export pipeline now used via `server/utils/server-export.js`
- Final strict corpus run: semantic 97.0%, round-trip 99.0%, export method production
- Per-element breakdown recorded in the final report
- Remaining warnings are documented per deck in the final report
```

**Next Steps:**
```
## Next Steps

1. **Achieved:** Unify round-trip harness with production export pipeline
2. **Achieved:** Final strict corpus run at 97.0% semantic / 99.0% round-trip
3. **Remaining:** Add 5+ corpus files (diverse compositions)
4. **Remaining:** Extract shared utilities to shared/src/ (DRY improvement)
5. **Long-term:** Expand corpus beyond 4 files and keep ≥98 target unchanged
```

### Step 6: Run all tests

```bash
npm run test
```

Ensure: all tests pass, no regressions.

## Final Summary

- Corpus: `./PPTX` (4/4 passed)
- Semantic fidelity: 97.0%
- Round-trip stability: 99.0%
- Export method: production
- Reports: `plans/reports/baseline-roundtrip-report.md`, `plans/reports/final-roundtrip-report.md`

## Success Criteria

- [x] Overall round-trip stability ≥ 98% on 4-deck corpus
- [x] Semantic fidelity unchanged at ≥ 95%
- [x] Export method is production for every deck
- [x] Mandatory rasterization available; no minimal fallback in final report
- [x] `docs/pptx-import-fidelity-report.md` updated with new scores
- [x] All new tests pass
- [x] Remaining gaps documented with root cause analysis
- [x] `plans/reports/final-roundtrip-report.md` created

## Risk Assessment

- **Risk:** Stability < 98% — **Mitigation:** Analyze gaps; distinguish implementation defects from PPTX/import format limits; do not lower target silently
- **Risk:** Tests fail on CI — **Mitigation:** Ensure Playwright/vendor assets are installed and strict raster validation can run; do not use `--allow-fallback` for official target jobs
- **Risk:** Corpus too small for reliable metrics — **Mitigation:** Document n=4 limitation; recommend corpus expansion as next step
