---
phase: 4
title: "Coverage Roadmap + Per-Package Threshold (DEFERRED to follow-up plan)"
status: deferred
priority: P2
effort: "2d"
dependencies: [1]
deferred_reason: "MVP scope cut (validated 2026-05-22). Coverage roadmap requires per-glob baseline measurement + 6-sprint commitment from team — not critical-path for v1.9.2 release gate. File retained as blueprint for follow-up plan."
---

# Phase 4: Coverage Roadmap + Per-Package Threshold (DEFERRED)

> **STATUS: DEFERRED to follow-up plan** (validated 2026-05-22). Not part of MVP. File retained as blueprint — when picking up, copy to new plan dir, re-measure baseline, re-validate threshold targets against current `EditorPage.jsx` / `HomePage.jsx` state.

## Overview

Threshold hiện tại (lines:33, branches:28, functions:26, statements:33) là **anti-regression baseline**, không phải target. Trung bình bị dilute bởi `EditorPage.jsx` 77k LOC + `HomePage.jsx` 68k LOC. Phase này (a) tạo lộ trình 33→50→65→80 trong 6 sprint, (b) split threshold theo glob để stores/utils/hooks có ngưỡng cao, components có ngưỡng lower nhưng vẫn ratchet, (c) thêm ratchet test ngăn ngược regression.

## Requirements

**Functional:**
- `docs/coverage-roadmap.md`: bảng 6-sprint với target từng package
- `vitest.config.mjs` sửa thành per-glob threshold (4 groups: stores/utils, hooks/extensions, server/routes, components/pages)
- `scripts/coverage-ratchet-checker.cjs`: đọc baseline `coverage-baseline.json`, fail nếu giảm
- CI step mới: `coverage-ratchet` job dùng script, gate PR
- `coverage-baseline.json` committed, update by automated script (not manual)

**Non-functional:**
- Per-glob coverage report runtime ≤ 2× current (acceptable)
- Ratchet allows +5pt drop tolerance per sprint (planned debt) via env override `COVERAGE_RATCHET_TOLERANCE`
- Documentation explain when to bump baseline (post-sprint review)

## Architecture

**Threshold groups (proposed initial values, baseline from `npm run test:coverage:summary`):**

| Glob | Current est. | Initial threshold | Sprint 2 | Sprint 4 | Sprint 6 |
|---|---|---|---|---|---|
| `client/src/stores/**` | ~75% | 70% | 78% | 85% | 90% |
| `client/src/utils/**` | ~65% | 60% | 70% | 80% | 85% |
| `client/src/hooks/**` | ~55% | 50% | 60% | 70% | 80% |
| `client/src/extensions/**` | ~70% | 65% | 75% | 82% | 85% |
| `server/routes/**` | ~50% | 45% | 55% | 65% | 75% |
| `server/services/**` | ~40% | 35% | 45% | 55% | 65% |
| `shared/src/**` | ~55% | 50% | 60% | 70% | 80% |
| `client/src/components/**` (excl pages) | ~40% | 35% | 45% | 55% | 65% |
| `client/src/pages/**` | ~15% | 15% | 18% | 25% | 35% |

Pages excluded từ aggressive ratchet vì `EditorPage.jsx` cần refactor trước (separate epic).

**File layout:**

```
docs/coverage-roadmap.md             # 6-sprint plan
scripts/
├── coverage-ratchet-checker.cjs    # compare current vs baseline
└── coverage-baseline-updater.cjs   # safe update (only if improved)
coverage-baseline.json               # committed baseline numbers (auto-update)
vitest.config.mjs                    # per-glob threshold via thresholdPerFile or custom logic
```

**Vitest config approach:**

Vitest's `coverage.thresholds` supports glob-keyed entries (matched by `picomatch` against file paths) introduced in [vitest PR #4442](https://github.com/vitest-dev/vitest/pull/4442), available from **Vitest v1.0+ in the `thresholdsPerFile`-adjacent shape**, **with breaking refinements in v4**. Project is on `vitest ^4.1.4` (`package.json:72`) so the syntax works. **Note:** glob-keyed files still count toward `global` thresholds — global is NOT a "safety floor" below glob, but an aggregate ceiling. Use global as a final sanity check, not as escape valve.

```js
coverage: {
  thresholds: {
    'client/src/stores/**/*.js': {lines: 70, branches: 65, functions: 65, statements: 70},
    'client/src/utils/**/*.js': {lines: 60, branches: 55, functions: 55, statements: 60},
    // ... per glob
    // Global thresholds also enforced on the same files (aggregate)
    lines: 33, branches: 28, functions: 26, statements: 33,
  }
}
```

## Related Code Files

**Create:**
- `docs/coverage-roadmap.md`
- `scripts/coverage-ratchet-checker.cjs`
- `scripts/coverage-baseline-updater.cjs`
- `coverage-baseline.json`
- `tests/unit/qa-foundation/coverage-config-has-per-glob-thresholds.test.js`
- `tests/unit/qa-foundation/coverage-ratchet-script-fails-on-regression.test.js`

**Modify:**
- `vitest.config.mjs` (per-glob thresholds)
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` (add `coverage-ratchet` job)
- `package.json` (add `test:coverage:ratchet` + `coverage:baseline:update` scripts)

**Read for context:**
- `vitest.config.mjs:21-26` (current threshold)
- `scripts/summarize-vitest-coverage.js` (existing summary tool)
- `coverage/coverage-summary.json` (sample structure from json-summary reporter)

## Implementation Steps (TDD)

### Red — Failing tests

1. **Test: config has per-glob thresholds**
   - Spec: import vitest.config.mjs, assert `coverage.thresholds` has keys matching `client/src/stores/**`, `client/src/utils/**`, etc. (4+ keys)
   - Run → **FAIL** (current config has only global)
   - Commit: `red: phase-4 add failing test for per-glob coverage thresholds`

2. **Test: ratchet script fails on simulated regression**
   - Spec: spawn `node scripts/coverage-ratchet-checker.cjs` với `--baseline=fixtures/high-baseline.json` và `--current=fixtures/low-summary.json`
   - Assert exit code !== 0, stderr contains "regression"
   - Run → **FAIL** (script chưa tồn tại)
   - Commit: `red: phase-4 add failing test for ratchet script`

### Green — Minimal impl

3. **Measure current coverage baseline**
   - Run `npm run test:coverage` locally, get `coverage/coverage-summary.json`
   - Run `npm run test:coverage:summary` (existing)
   - Pivot results vào per-glob aggregates manually (one-time)
   - Create `coverage-baseline.json` với current numbers per glob
   - Commit: `chore: phase-4 record initial per-glob coverage baseline`

4. **Update `vitest.config.mjs`**
   - Add per-glob thresholds với initial values từ roadmap table (Sprint 0 column = current -3pt = floor)
   - Keep global threshold lower (33/28/26/33) as safety net
   - Run `npm run test:coverage` → expect pass (since thresholds set ≤ current)
   - Test 1 **PASSES**
   - Commit: `green: phase-4 add per-glob coverage thresholds in vitest config`

5. **Write `coverage-ratchet-checker.cjs`**
   - CLI: `--baseline <path>` `--current <path>` `--tolerance <pt>` (default 0)
   - Algorithm:
     - Load baseline JSON: `{glob: {lines, branches, ...}}`
     - Load current `coverage-summary.json`, group by glob
     - For each glob in baseline: if `current[glob][metric] < baseline[glob][metric] - tolerance` → error
     - Exit 1 if any regression
   - Add `npm run test:coverage:ratchet` script
   - Test 2 **PASSES**
   - Commit: `green: phase-4 implement coverage ratchet checker`

6. **Add CI job `coverage-ratchet`**
   - In `github-actions-ci-pipeline-...yml`, new job after `unit-coverage`:
     ```yaml
     coverage-ratchet:
       needs: [unit-coverage]
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/download-artifact@v4
           with: {name: coverage-html, path: coverage/}
         - run: npm run test:coverage:ratchet -- --baseline coverage-baseline.json --current coverage/coverage-summary.json
     ```
   - Add to `required-checks` `needs` list
   - Commit: `green: phase-4 add coverage-ratchet CI gate`

7. **Write `docs/coverage-roadmap.md`**
   - Section: Current state (numbers from baseline)
   - Section: 6-sprint table (above)
   - Section: How to bump (procedure: improve coverage → run baseline updater → PR)
   - Section: Emergency override (env var, requires reviewer approval label)
   - Commit: `docs: phase-4 add coverage roadmap with 6-sprint targets`

### Refactor

8. **`coverage-baseline-updater.cjs`**: safe-update script — only increase, never decrease baseline. Used post-sprint by team lead.
9. **Add badge** to README showing current coverage vs roadmap target.
10. Commit: `refactor: phase-4 add baseline updater + README badge`

## Todo List

- [ ] Failing test: per-glob threshold config (red)
- [ ] Failing test: ratchet script regression (red)
- [ ] Measure & commit `coverage-baseline.json` (green)
- [ ] Update `vitest.config.mjs` per-glob thresholds (green)
- [ ] Implement `coverage-ratchet-checker.cjs` (green)
- [ ] Add `coverage-ratchet` CI job, wire to required-checks (green)
- [ ] Write `docs/coverage-roadmap.md` (green)
- [ ] Add `coverage-baseline-updater.cjs` (refactor)
- [ ] Add coverage badge to README (refactor)
- [ ] Verify CI gate by intentionally adding uncovered code in test PR, expect ratchet job fail

## Success Criteria

- [ ] `npm run test:coverage` enforces per-glob threshold; old global threshold remains as floor
- [ ] `npm run test:coverage:ratchet` exits 0 on current state, exits 1 on simulated regression
- [ ] CI `coverage-ratchet` job runs ≤ 3 min, gates PR via required-checks
- [ ] Baseline JSON has entries for ≥ 8 globs (matching roadmap table)
- [ ] Roadmap doc explains how to bump baseline (no manual edit)
- [ ] Verify: deliberately remove a test → CI fails with clear "ratchet regression in {glob}" message

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Vitest per-glob threshold syntax không support trong version đang dùng | M | M | Verify vitest >= 1.6.0 via `package.json`; if not, upgrade trong sprint trước Phase 4 |
| Ratchet block legit refactor reducing coverage temporarily | M | M | Tolerance env var; emergency override PR label `coverage-debt-accepted` |
| Per-glob make CI report noisy | L | L | Group output by severity (errors first, warnings collapsed) |
| Baseline JSON merge conflict trên parallel PR | M | M | Use `coverage-baseline-updater.cjs` as single writer; deny manual edit via CI lint |
| EditorPage.jsx pulls down components/** average | H | M | Excluded from aggressive ratchet (pages glob has slowest ramp) until refactor epic |

## Security Considerations

- Coverage JSON exposes file structure — no secrets risk
- Baseline updater runs in CI only on `master` branch (no PR-side baseline bumps)

## Open Questions

1. Vitest version ≥ 4.0 supports keyed thresholds — **CONFIRMED** (`package.json:72` `vitest ^4.1.4`). Open: do we want to separate `EditorPage.jsx` + `HomePage.jsx` into own glob with explicit floor (per QA red-team feedback) instead of bundling under `pages/**`?
2. Roadmap target 80% — agreed, hay user muốn 70% là đủ?
3. Components/pages glob: tách EditorPage + HomePage thành own glob để track? (vì 2 file kéo trung bình xuống nặng)
4. Server routes WITHOUT existing tests (`ai.js`, `upload.js`, `sync.js`, `analytics.js`, `explore.js`, `live.js`, `games-rest-api-handler.js` — ~901 LOC untested per scout) — should baseline pin at current measured value (likely 0-10%) instead of blanket 45%? Otherwise ratchet allows them to STAY untested.

## Next Steps

- Phase 5 CI split: ratchet job sẽ stay trong PR fast lane (cheap, ~3min)
- Future sprint: refactor EditorPage/HomePage (out of scope plan này) → tăng aggressive ratchet cho pages glob
