# Phase 01 QA Report — Zero-loss package & SLA contract

**Date:** 2026-07-09  
**Plan:** `plans/260709-1306-pptx-import-native-ooxml-1to1-fidelity-deep-tdd`  
**Role:** QA Lead (report only, no fixes)  
**Verdict:** **T1.1–T1.10 GREEN** · **Phase verify GREEN** · **G0 FAIL (1 pre-existing corpus drift)** · Presentations + client api GREEN

---

## Test Results Overview

| Suite | Command | Exit | Files | Pass | Fail | Duration |
|-------|---------|------|-------|------|------|----------|
| 1. Phase verify | `vitest run original-package + sla-contract + pptx-import + pptx-original` | **0** | 4 | **23** | 0 | 10.5s |
| 2. G0 guard | `vitest run server/services/pptx-import server/routes/pptx-import` | **1** | 37 | **384** | **1** | 248.7s |
| 3. Presentations | `vitest run server/routes/presentations` | **0** | 1 | **12** | 0 | 3.4s |
| 4. Client api | `vitest run client/src/utils/api.test.js` | **0** | 1 | **3** | 0 | 1.6s |

**Totals (all suites):** 422 tests · **421 pass** · **1 fail** · ~264s wall

---

## T1.1–T1.10 Coverage (all green)

| ID | Assert | File | Status |
|----|--------|------|--------|
| T1.1 | `persistOriginalPptx` writes; `verifySha256` matches | `original-package.test.js` | ✅ |
| T1.2 | path rejects `../` / absolute escape | same | ✅ |
| T1.3 | oversize buffer → 413 semantics | same | ✅ |
| T1.4 | job done → `presentationId` + stats; sha256 bound | `pptx-import.test.js` | ✅ |
| T1.5 | GET download bytes = fixture; client path ignored | `pptx-original.test.js` | ✅ |
| T1.6 | permanent DELETE unlinks; soft-delete keeps for restore | `pptx-original.test.js` | ✅ * |
| T1.7 | cancel → no orphan in `pptx-originals` | `pptx-import.test.js` | ✅ |
| T1.8 | milestone table; phase01 requires P1 only | `sla-contract.test.js` | ✅ |
| T1.9 | wrong id → 404; invalid id rejected | `pptx-original.test.js` | ✅ |
| T1.10 | createPresentation fail → original rollback | `pptx-import.test.js` | ✅ |

\* **T1.6 plan vs impl:** phase doc says soft+hard both unlink; test intentionally keeps original on soft-delete (restore lifecycle). Matches code-review note. Not a test fail — plan wording drift.

Extra non-T1 tests in same files also green (delete/read helpers, persist-from-path, progressive SSIM floors, other pptx-import route cases).

---

## Failed Tests (G0 only)

### `corpus-baseline.test.js` > `does not drift below the checked-in corpus baseline`

```
AssertionError: expected 0.99 to be greater than or equal to 1
  at corpus-baseline.test.js:23
  summary.avgSemanticFidelity (0.99) < baseline.summary.avgSemanticFidelity (1)
```

**Root cause (report-only):**
- Checked-in baseline locks `avgSemanticFidelity: 1` (`corpus-baseline.json`).
- Live corpus run yields **0.99** avg (strict gate floor still 0.95 per-deck; this is **aggregate drift**, not a hard semantic floor breach).
- Corpus dir has **11** decks vs baseline `totalFiles: 10` — new `non-default-4x3-resolution.pptx` not in `perDeck` map.
- **Not caused by Phase 01 original-package / SLA work** (no mapper/scoring changes in T1 scope). Pre-existing G0 fidelity/baseline drift or baseline stale vs corpus.
- Other 6 tests in `corpus-baseline.test.js` pass (math capture, strict gates, lock floors, default corpus dir).

**Impact on Phase 01 success criteria:** phase-01 doc G0 checkbox requires full pptx-import suite pass → **G0 criterion not met** even though T1.* green.

---

## Coverage / Gaps (Phase 01 scope)

| Area | Status |
|------|--------|
| Unit: original-package I/O + jail + size | Covered T1.1–T1.3 |
| Integration: atomic create + presentationId | Covered T1.4 |
| Integration: download / delete / 404 | Covered T1.5 T1.6 T1.9 |
| Failure: cancel + create rollback | Covered T1.7 T1.10 |
| SLA contract phase01 = P1 only | Covered T1.8 |
| Presentations suite (broader CRUD) | 12/12 pass |
| Client `api.test.js` | 3/3 pass (quick smoke) |
| Job IDOR / multi-user auth | Out of scope; prior red-team open |
| Soft-delete unlink policy | Documented intentional keep |

No unmapped T1 IDs. No flaky failures observed (single run each).

---

## Performance Metrics

| Suite | Duration | Notes |
|-------|----------|-------|
| Phase verify | ~10.5s | Fast; fine for PR gate |
| G0 full pptx-import | ~249s (~4.1 min) | Dominated by corpus/fidelity tests |
| Presentations | ~3.4s | |
| Client api | ~1.6s | |

Slowest G0 contributor: corpus baseline + related fidelity (120s timeout budget).

---

## Build Status

- Not run (unit only requested).
- Vitest 4.1.6; no transform/import errors in phase suites.

---

## Critical Issues

1. **G0 FAIL — corpus baseline avg 0.99 < 1** — blocks phase-01 “G0 pass” success criterion.  
   **Action:** re-baseline after intentional corpus add, or fix deck scoring to restore avg=1; separate from T1 package work.  
2. **Baseline/corpus inventory mismatch** — 11 files on disk, baseline tracks 10. New deck not gated per-deck.

---

## Recommendations

1. **Ship T1 gate as green** for package/SLA — T1.1–T1.10 + presentations + client api all pass.
2. **Do not claim Phase 01 complete** until G0 green or explicit waiver that corpus drift is out-of-band.
3. Update `corpus-baseline.json` when accepting new corpus deck / measured avg 0.99 **or** investigate which deck dropped semantic score.
4. Align phase-01 T1.6 wording with soft-delete-keeps-original policy (or change product behavior).
5. Code-review H1 (if still open) orthogonal to this test run — see `from-code-reviewer-phase-01-…md`.

---

## Next Steps (priority)

1. Owner: fidelity/corpus — diagnose which deck(s) pull avg to 0.99; re-baseline or fix.
2. Owner: Phase 01 implementer — re-run G0 after baseline fix; exit 0 required for phase complete.
3. Optional: expand client api tests if HomePage `presentationId` bind changed (current 3 tests only).

---

## Unresolved Questions

1. Is avg 0.99 an intentional post-corpus-add state, or a silent mapper regression?
2. Should soft-delete unlink original (plan) or keep for restore (current test)? Product decision needed.
3. Was G0 already red before Phase 01 land, or did Phase 01 timing coincide with corpus change?
