---
phase: 1
title: "P0 Quick Wins (config + modernize 4 legacy specs + baseline capture)"
status: completed
priority: P0
effort: "3h"
dependencies: []
---

# Phase 1: P0 Quick Wins

## Overview

Foundation phase. **Scope changed post-audit (user-confirmed):** the 4 "dead" specs in the original plan all have real assertions and are CI-referenced — they are KEPT and modernized in place, NOT deleted. Adds baseline capture so Phase 8 has real comparison data.

## Requirements

- Capture baseline `npm run test:coverage` + `npm run test:e2e` wallclock for Phase 8 comparison
- Fix `playwright.config.js` regex bug so `tests/e2e/live.spec.js` is excluded from chromium project — without over-matching `mobile/`, `visual/`, `a11y/` siblings
- Modernize 4 legacy specs in place (migrate to `testPresentation` fixture, swap CSS class selectors for testids, remove any `waitForTimeout`) — do NOT delete
- Remove dead code: `API_BASE.replace('/api','/api')` identity-replace inside `apiRevokeShareToken` (NOT `apiCreateShareToken` — function does not exist)
- Wire `assertLoopback()` into `apiGetPresentation` for parity with `apiCreatePresentation`

## Architecture

No source/app code touched. Test infra only. Risk profile: near-zero (verifiable by running CI).

## Related Code Files

**Modify:**
- `playwright.config.js:40` — `testIgnore` regex (narrower than original proposal — preserves `mobile/`, `visual/`, `a11y/` in chromium project)
- `tests/e2e/fixtures/test-fixtures.js:57-63` — `apiGetPresentation` (add `assertLoopback`)
- `tests/e2e/fixtures/test-fixtures.js:102-106` — `apiRevokeShareToken` (drop identity-replace)
- `tests/e2e/elements.spec.js` (44 LOC) — modernize (REAL assertions verified)
- `tests/e2e/slides.spec.js` (25 LOC) — modernize (REAL assertions verified)
- `tests/e2e/export.spec.js` (45 LOC) — modernize (REAL assertions verified)
- `tests/e2e/visual-regression.spec.js` (108 LOC) — modernize (active `toHaveScreenshot` baseline; CI-referenced by `manual-update-playwright-visual-baselines.yml:38,45,53`)

**Create:**
- `reports/baseline-coverage.txt` — pre-change `npm run test:coverage` output
- `reports/baseline-wallclock.txt` — pre-change `time npm run test:e2e` output

## Implementation Steps

### Step 0 — Baseline Capture (NEW — prereq for Phase 8)

1. Capture pre-change baseline (run BEFORE any other Phase 1 changes):
   ```bash
   npm run test:coverage > plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-coverage.txt 2>&1
   { time npm run test:e2e; } > plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-wallclock.txt 2>&1
   grep -rn "waitForTimeout(" tests/e2e/ > plans/260524-0959-e2e-cleanup-and-coverage-tdd/reports/baseline-waitfortimeout-sites.txt
   ```

### Red (write failing assertions first)

2. Add unit test `tests/unit/playwright-config.test.js` asserting `config.projects[0].testIgnore.test('tests/e2e/live.spec.js') === true` AND `testIgnore.test('tests/e2e/visual/x.spec.js') === false` (preserve visual specs in chromium project)
3. Run `npm test -- tests/unit/playwright-config.test.js` → confirm failure (initial regex too narrow)

### Green (make it pass)

4. Update `playwright.config.js:40`:
   - From: `testIgnore: /tests\/e2e\/live\/.*\.spec\.js/`
   - To: `testIgnore: /tests\/e2e\/(live(\.spec\.js$|\/)|live\/.*\.spec\.js$)/`
   - Rationale: covers BOTH flat `tests/e2e/live.spec.js` AND nested `tests/e2e/live/*.spec.js`. Does NOT exclude `mobile/`, `visual/`, `a11y/` (preserves existing chromium coverage).
5. Re-run the unit test → green
6. Edit `tests/e2e/fixtures/test-fixtures.js`:
   - **Line 102-106** (`apiRevokeShareToken`): replace `${API_BASE.replace('/api', '/api')}/shares/${token}` with `${API_BASE}/shares/${token}`
   - **Lines 57-63** (`apiGetPresentation`): prepend `assertLoopback(API_BASE);` at function entry, matching the pattern in `apiCreatePresentation`

### Green — Modernize Legacy Specs

7. For each of the 4 legacy specs, apply this modernization (run + commit per file, do NOT batch):
   - Switch to `testPresentation` fixture (auto-create + auto-cleanup) — drop manual `apiCreatePresentation` calls
   - Replace any CSS class / role / text selectors with Phase 3 `data-testid` equivalents (defer to Phase 3 if testid missing — add a TODO marker comment for cross-phase tracking)
   - Replace any `waitForTimeout` with state-based assertions
   - Preserve all existing `expect` assertions (these specs have REAL value — verified)
   - Run that single spec → green

### Refactor

8. Run `git grep "API_BASE.replace"` — assert zero remaining
9. Run `npm run lint` → green
10. Confirm CI visual baseline workflow still references `tests/e2e/visual-regression.spec.js` (`grep -n "visual-regression" .github/workflows/manual-update-playwright-visual-baselines.yml`) → should still match lines 38, 45, 53

## Success Criteria

- [x] `reports/baseline-coverage.txt` exists with full coverage report
- [x] `reports/baseline-wallclock.txt` exists with full E2E suite timing
- [x] `reports/baseline-waitfortimeout-sites.txt` lists all 20 occurrences across 10 files
- [x] `tests/unit/playwright-config.test.js` passes (3+ assertions)
- [x] `tests/unit/test-fixtures-loopback.test.js` passes (verifies `apiGetPresentation` calls `assertLoopback` + identity-replace removed)
- [x] `npx playwright test --list` confirms `tests/e2e/live.spec.js` excluded from chromium project
- [x] `npx playwright test --list` confirms `tests/e2e/visual/**` STILL INCLUDED in chromium project (regression guard)
- [x] 4 legacy specs still green after modernization (`npx playwright test tests/e2e/elements.spec.js tests/e2e/slides.spec.js tests/e2e/export.spec.js tests/e2e/visual-regression.spec.js`)
- [x] `npm run lint` passes
- [x] CI visual baseline workflow references intact

## Verification Notes

- `npm test -- tests/unit/playwright-config.test.js tests/unit/test-fixtures-loopback.test.js tests/unit/electron-release-readiness-contract.test.js` -> 3 files / 17 tests passed.
- `npx playwright test tests/e2e/elements.spec.js tests/e2e/slides.spec.js tests/e2e/export.spec.js tests/e2e/visual-regression.spec.js` -> 5 passed, 1 skipped on Windows visual guard.
- `npm run test:coverage` -> exit 0 after fixing release-doc version drift in `docs/codebase-summary.md`; baseline summary: statements 38.39%, branches 32.17%, functions 33.04%, lines 39.99%.
- `npm run test:e2e` baseline wallclock captured 291.05s with exit 1 from existing `coverage-gaps.spec.js`; retained as Phase 1 baseline evidence for Phase 8 comparison.
- Code review concern resolved: `testPresentation` no longer swallows cleanup failures; regression assertion added to `tests/unit/test-fixtures-loopback.test.js`.

## Tests (verification — TDD Red phase)

```js
// tests/unit/playwright-config.test.js
import { describe, it, expect } from 'vitest';
import config from '../../playwright.config.js';

describe('playwright config testIgnore', () => {
  const chromium = config.projects.find(p => p.name === 'chromium');

  it('ignores tests/e2e/live.spec.js (flat path)', () => {
    expect(chromium.testIgnore.test('tests/e2e/live.spec.js')).toBe(true);
  });

  it('ignores tests/e2e/live/annotation.spec.js (nested)', () => {
    expect(chromium.testIgnore.test('tests/e2e/live/annotation-sync-and-persistence.spec.js')).toBe(true);
  });

  it('does NOT ignore tests/e2e/keyboard.spec.js (sibling)', () => {
    expect(chromium.testIgnore.test('tests/e2e/keyboard.spec.js')).toBe(false);
  });

  it('does NOT ignore tests/e2e/visual/*.spec.js (preserved in chromium project)', () => {
    expect(chromium.testIgnore.test('tests/e2e/visual/editor-canvas-states-snapshot.spec.js')).toBe(false);
  });

  it('does NOT ignore tests/e2e/mobile/*.spec.js (preserved in chromium project)', () => {
    expect(chromium.testIgnore.test('tests/e2e/mobile/touch-gestures.spec.js')).toBe(false);
  });
});
```

```js
// tests/unit/test-fixtures-loopback.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('test-fixtures loopback guard', () => {
  const src = readFileSync('tests/e2e/fixtures/test-fixtures.js', 'utf8');

  it('apiGetPresentation calls assertLoopback', () => {
    const fn = src.match(/apiGetPresentation[\s\S]*?\n\}/)[0];
    expect(fn).toMatch(/assertLoopback/);
  });

  it('apiRevokeShareToken does not contain identity-replace dead code', () => {
    expect(src).not.toMatch(/API_BASE\.replace\(['"]\/api['"],\s*['"]\/api['"]\)/);
  });
});
```

## Risk Assessment

- **Risk (RESOLVED post-audit):** new `testIgnore` over-matches mobile/visual/a11y. Mitigation: regex now anchors `live` specifically; unit test guards visual/mobile preservation.
- **Risk (CHANGED post-user-decision):** Modernization may introduce real bugs missed by passing tests. Mitigation: per-spec commit; bisect easy.
- **Risk:** `assertLoopback` rejects in CI if `API_BASE` is not loopback. Mitigation: verified CI uses loopback per `playwright.config.js:5` `PLAYWRIGHT_TEST_BASE_URL`.
- **Risk:** Baseline captures slow Phase 1 by ~3-5 min. Mitigation: acceptable — gives Phase 8 real comparison instead of "hopes-and-prayers" success criterion.

## Next Steps

- Phase 2 (de-flake) can start in parallel; no file overlap
- Phase 3 (selector hardening) can start; no file overlap
- Phase 7 may further migrate modernized specs to extracted helpers
