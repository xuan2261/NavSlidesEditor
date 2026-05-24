---
phase: 8
title: "Final Regression + CI Verification"
status: pending_ci
priority: P1
effort: "2h"
dependencies: [1, 2, 3, 4, 5, 6, 7]
---

# Phase 8: Final Regression + CI Verification

## Overview

After Phases 1-7 land, run a regression sweep + measure final state vs. the baseline captured in Phase 1 Step 0. Gate the plan as completed.

## Requirements

- [x] Full unit + E2E suite green locally (Windows)
- [ ] CI pipeline (Linux) green for all 4 e2e jobs
- [x] Coverage report generated; deltas computed against `reports/baseline-coverage.txt`
- [x] E2E wallclock compared against `reports/baseline-wallclock.txt` — must be ≤ baseline + 5%
- [x] README test docs reflect new conventions
- [x] No external devDependency drift — `plan-completion-gate.test.js` uses plain regex YAML parsing, NOT `gray-matter` (no new devDep introduced just to run a meta-test)

## Local Verification Evidence

- `npm test` → 169 files passed, 1 skipped; 1439 tests passed, 9 skipped.
- `npm run test:e2e` → 454 passed, 17 skipped; wallclock 258.90s.
- `npx playwright test --repeat-each=3` → 1362 passed, 51 skipped; wallclock 725.67s.
- `npm run lint` → 0 errors, 109 existing warnings.
- `npm run build` → passed with existing chunk-size / empty `vendor-reveal` warnings.
- `npm run test:coverage` → 169 files passed, 1 skipped; 1439 tests passed, 9 skipped.
- First PR CI run `26359690209` failed on Linux-only environment gaps: unit/corpus jobs had no Playwright Chromium installed, editor visual snapshots captured a false first-load autosave error, and live presenter/viewer navigation polling was too tight for CI load.
- Follow-up patch verification: `npm run test:coverage` → 169 files passed, 1 skipped; 1439 tests passed, 9 skipped; `npx playwright test tests/e2e/live/present-mode-keyboard-navigation-presenter-to-viewer-sync.spec.js --project=chromium-live` → 4 passed; `npm run lint` → 0 errors, 109 existing warnings; `npm run build` → passed.
- CI remains pending until the follow-up commit is pushed and GitHub Actions reruns green.

## Architecture

This phase is verification-only. No new specs/source code beyond docs updates + a meta-test.

## Related Code Files

**Modify (docs only):**
- `README.md` — testing section: mention `testPresentation` fixture, `wait-helpers.js`, kebab-case page-objects, the `data-testid`-only selector rule
- `docs/code-standards.md` — if exists, append "E2E selectors must be data-testid" subsection
- `docs/project-changelog.md` — entry: "E2E suite cleanup + coverage expansion (260524 plan)"

**Create (meta-test):**
- `tests/unit/plan-completion-gate.test.js` — uses plain regex YAML parser, no `gray-matter` dependency

**Reference (created in Phase 1 Step 0):**
- `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-coverage.txt`
- `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-wallclock.txt`
- `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-waitfortimeout-sites.txt`

**Create (post-run):**
- `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/de-flake-perf.md` (created in Phase 2)
- `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/coverage-delta-260524.md` (created here)

## Implementation Steps

### Verification — Local

1. Clean state:
   ```bash
   git clean -fd
   npm ci
   ```
2. Unit tests:
   ```bash
   npm test
   ```
   Expected: green
3. E2E full sweep — capture wallclock for comparison:
   ```bash
   { time npm run test:e2e; } 2>&1 | tee /tmp/e2e-final-run.log
   ```
   Expected: green; wallclock ≤ baseline + 5% (compared against `reports/baseline-wallclock.txt`)
4. E2E repeatability (de-flake proof):
   ```bash
   npm run test:e2e -- --repeat-each=3
   ```
   Expected: green (3× consecutive runs)
5. Lint:
   ```bash
   npm run lint
   ```
6. Coverage:
   ```bash
   npm run test:coverage > /tmp/coverage-final.txt
   ```
   Compute deltas for files touched by new specs vs. `reports/baseline-coverage.txt`

### Verification — CI

7. Push branch; observe GitHub Actions:
   - `e2e-chromium` (4-shard) — green; shard timing roughly balanced (no shard >2× the median)
   - `e2e-live` (workers:1) — green
   - `e2e-mobile` (a11y) — green
   - `e2e-visual` (Linux baselines) — green
   - `nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml` — references updated path (verified by `nightly-workflow-ribbon-ref-updated.test.js` from Phase 7)
8. If snapshots diverge: regenerate on CI runner, commit baselines

### Shard Balance Profiling (per red-team M15)

9. Inspect `playwright-report/` for per-spec timings. If one shard runs >2× the median, tune `playwright.config.js` shard distribution explicitly. Document in `reports/coverage-delta-260524.md`.

### Documentation

10. Update `README.md` testing section:
    ```markdown
    ## Testing

    - Unit/integration: `npm test` (Vitest)
    - E2E: `npm run test:e2e` (Playwright)
    - Coverage: `npm run test:coverage`

    ### E2E conventions

    - Use the `testPresentation` fixture for auto-create + cleanup
    - Selectors MUST use `data-testid` (no CSS classes / roles / text)
    - Page objects live in `tests/e2e/pages/` (kebab-case)
    - Wait via `expect.poll`, `toBeVisible({timeout})`, `waitForResponse` — never `waitForTimeout`
    ```

11. Append `docs/project-changelog.md`:
    ```markdown
    ## [Unreleased]
    ### Changed
    - E2E test suite cleanup: modernized 4 legacy specs (kept, not deleted), eliminated 20 waitForTimeout sleeps across 10 files, added ~30 data-testid hooks via Phase 3 catalog, migrated to testPresentation fixture
    - Coverage expansion: +9 editor tests (smart guides, clipboard with +20/+20 paste offset, hide/show), +7 export/import/sync tests (PPTX validation, markdown import, rclone Proton Drive at REAL /api/rclone/* contract), +3 game shortcut tests + 36 visual matrix tests
    - Architecture: kebab-case page objects, ribbon-layout split into 8 concern-aligned files, nightly 768px workflow updated to match
    ```

### Whole-Plan Consistency Sweep

12. Re-read `plan.md` and `phase-01` through `phase-08`.
13. Reconcile any phase that contradicts another (e.g. a testid mentioned in Phase 4 must exist after Phase 3).
14. Update phase frontmatter `status: completed` ONLY after that phase's Success Criteria checked off.

### Coverage Delta Report

15. Generate `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/coverage-delta-260524.md`:
    ```markdown
    # E2E Coverage Delta — Post-Phase 8

    | Surface | Before | After | Delta |
    |---|---|---|---|
    | Smart guides | 0 tests | 3 tests | +3 |
    | Clipboard (incl. +20/+20 offset) | 0 tests | 4 tests | +4 |
    | Element hide/show | 0 tests | 2 tests | +2 |
    | PPTX export (with JSZip validation) | 0 tests | 1 test | +1 |
    | Markdown import | 0 tests | 2 tests | +2 |
    | rclone sync (real /api/rclone/*) | 0 tests | 4 tests | +4 |
    | Game shortcuts (G/L real, Enter/R/P stubs) | 0 tests | 3 tests | +3 |
    | Visual matrix (36 structural + 3 snapshots) | N tests | M tests | +Δ |
    | Server contract tests (Vitest) | 0 | 5 | +5 |
    | Source-side testid catalog (Vitest) | 0 | 1 | +1 |
    | **TOTAL E2E added** | | | **+19 specs** |
    | **TOTAL unit verification added** | | | **+8 tests** |

    Removed: 0 LOC (legacy specs kept and modernized per user decision)
    Modernized: 4 legacy specs (elements/slides/export/visual-regression) migrated to fixture + testids

    ## Wallclock comparison

    | Run | Baseline (Phase 1 step 0) | Post-Phase 8 | Delta |
    |---|---|---|---|
    | `npm run test:e2e` | {from baseline-wallclock.txt} | {from /tmp/e2e-final-run.log} | {Δ%} |

    Budget: ≤ +5%. Status: {pass/fail}.

    ## waitForTimeout sites

    | Run | Count |
    |---|---|
    | Baseline (Phase 1 step 0) | 20 (10 files) |
    | Post-Phase 8 | 0 (or documented exceptions) |

    ## Coverage delta (files touched by new specs)

    See full diff: `git diff reports/baseline-coverage.txt /tmp/coverage-final.txt`
    ```

## Success Criteria

- [x] `npm test` green
- [x] `npm run test:e2e` green (single run); wallclock ≤ baseline + 5% (vs `reports/baseline-wallclock.txt`)
- [x] `npx playwright test --repeat-each=3` green (de-flake proof)
- [x] `npm run lint` zero errors
- [ ] All 4 CI e2e jobs green on branch
- [x] Nightly ribbon-layout 768px workflow runs against new split path (verified by Phase 7's unit test)
- [x] Coverage report generated; global lines unchanged, branches slightly higher; statement/function drift documented in `coverage-delta-260524.md`
- [x] README updated with new conventions
- [x] `docs/project-changelog.md` updated
- [x] Coverage delta report created under `plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/`
- [ ] All 8 phase frontmatters `status: completed`
- [x] Zero new devDependencies introduced by Phase 8's own meta-test (no `gray-matter`)

## Tests (verification — meta-test)

```js
// tests/unit/plan-completion-gate.test.js
// Uses plain regex YAML parsing (no gray-matter devDep — per red-team L17)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PLAN_DIR = 'plans/260524-0959-e2e-cleanup-and-coverage-tdd';

function parseFrontmatterStatus(content) {
  // Match the YAML frontmatter block at file start
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const statusMatch = fm.match(/^status:\s*(.+)$/m);
  return statusMatch ? statusMatch[1].trim().replace(/^["']|["']$/g, '') : null;
}

describe.skipIf(!process.env.RUN_PLAN_GATE)('plan completion gate', () => {
  const phases = readdirSync(PLAN_DIR)
    .filter(f => /^phase-\d+/.test(f))
    .sort();

  for (const phase of phases) {
    it(`${phase} status=completed`, () => {
      const content = readFileSync(join(PLAN_DIR, phase), 'utf8');
      const status = parseFrontmatterStatus(content);
      expect(status).toBe('completed');
    });
  }
});
```

Run with `RUN_PLAN_GATE=1 npm test` only when verifying plan finality (not in regular CI).

## Risk Assessment

- **Risk:** CI Linux snapshots diverge from local Windows. Mitigation: `e2e-visual` job ONLY runs on Linux per `playwright.config.js`; Windows local skipped via existing `skipNonLinuxVisualSnapshots` helper.
- **Risk:** Coverage % drops on files NOT touched by this plan. Mitigation: scope delta to touched files only; explain in delta report.
- **Risk:** Test wallclock grows >5%. Mitigation: rebalance shards (per red-team M15); profile slowest tests via `--reporter=list`; revisit Phase 2 selectivity if budget bust.
- **Risk:** Forgetting to set phase frontmatter `status: completed`. Mitigation: `plan-completion-gate.test.js` (gated by `RUN_PLAN_GATE=1`) catches.
- **Risk (RESOLVED post-audit L17):** Original plan imported `gray-matter` for meta-test. Mitigation: replaced with 5-line plain regex YAML parser — no new devDep.
- **Risk:** Baseline files missing if Phase 1 step 0 was skipped. Mitigation: Phase 1 success criteria gate the baseline file existence; Phase 8 fails fast if missing.

## Next Steps

- Recommend `/ck:journal` to record lessons learned (the post-audit corrections journey is worth documenting)
- Optional `/ck:ship` if releasing as part of next version
- Close plan via `/ck:plan archive`
