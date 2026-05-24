---
phase: 2
title: "P1 De-flake (waitForTimeout removal)"
status: completed
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: P1 De-flake (waitForTimeout removal)

## Overview

Replace **20 `waitForTimeout` occurrences across 10 files** (verified post-audit; original "34/17" baseline was stale) with state-based assertions (`expect.poll`, `toHaveCount`, `toBeVisible`, `request.waitForResponse`). Sleeps are the #1 source of E2E flake on slow CI runners.

## Requirements

- Net change: `tests/e2e/**` shows zero `waitForTimeout(` calls outside `pages/RibbonInsertHelper.js:75` (documented exception for native file-dialog open delay — replaced by `expect.poll` if practical)
- Suite wallclock unchanged or faster vs. Phase 1 baseline (captured in `reports/baseline-wallclock.txt`)
- No reduction in assertion count
- NO `Promise.race(transitionend, waitForTimeout(500))` fallback pattern — purely state-based polling (would self-contradict lint rule)

## Architecture

Sleeps fall into 3 categories:
1. **Wait-for-DOM-ready** → replace with `expect(locator).toBeVisible({timeout})` / `toHaveCount(n)`
2. **Wait-for-animation** → use `await locator.waitFor({state:'visible'})` + (if needed) `expect.poll(() => locator.evaluate(el => getComputedStyle(el).opacity), { intervals:[50], timeout:1000 }).toBe('1')`
3. **Wait-for-async-network** → use `page.waitForResponse(/api\/.../)` or `expect.poll(async () => await api.getSomething(), { intervals:[250], timeout:10_000 })`

## Related Code Files

**Modify (waitForTimeout hotspots — VERIFIED actual files via `grep -rn "waitForTimeout(" tests/e2e/`):**
- `tests/e2e/games/game-elements.spec.js` — game spawn/sync waits
- `tests/e2e/undo-redo.spec.js` — undo/redo settling
- `tests/e2e/live/annotation-sync-and-persistence.spec.js` (CORRECTED name) — socket broadcast
- `tests/e2e/live/live-timer-broadcast-via-game-timer-socket-events.spec.js` (CORRECTED name) — timer sync
- `tests/e2e/animation-preview.spec.js` — animation playback
- `tests/e2e/visual/*.spec.js` — settle delays
- `tests/e2e/a11y/axe-core-accessibility-scan.spec.js` — axe injection delay
- `tests/e2e/pages/RibbonInsertHelper.js` — modal open delay (legitimate exception — document; replaced by testid wait in Phase 3 if possible)
- `tests/e2e/pages/ribbon-tab-toolbar-helper.js` — tab switch delay

**Note:** Exact line numbers are deliberately NOT pinned here — re-verify via `cat reports/baseline-waitfortimeout-sites.txt` (captured in Phase 1 step 0) before each edit.

**Add:**
- `tests/e2e/pages/wait-helpers.js` — shared utilities (`waitForAnimationEnd`, `waitForApiResponse`, `waitForElementSnapshot`)

## Implementation Steps

### Red (failing lint rule)

1. Add ESLint rule `playwright/no-wait-for-timeout` to `eslint.config.js` (or `.eslintrc`) targeting `tests/e2e/**`
2. Run `npm run lint` → expect 20 errors
3. Add unit test `tests/unit/no-waitForTimeout.test.js` that greps the directory and asserts count = 0 (initially fails with count=20)

### Green (one file per commit)

For each hotspot — read the file FIRST to pin actual line numbers from `reports/baseline-waitfortimeout-sites.txt`:

4. **`game-elements.spec.js`** (game spawn → element appears):
   ```js
   // BEFORE
   await page.waitForTimeout(2000);
   // AFTER
   await expect(page.locator('[data-testid="game-question"]')).toBeVisible({ timeout: 5000 });
   ```

5. **`game-elements.spec.js`** (state sync via score):
   ```js
   await expect.poll(
     async () => page.locator('[data-testid="game-score"]').textContent(),
     { timeout: 5000 }
   ).toMatch(/^\d+$/);
   ```

6. **`undo-redo.spec.js`** (undo settling — multiple sites):
   ```js
   // AFTER
   await page.keyboard.press('Control+Z');
   await expect(page.locator('[data-element-type]')).toHaveCount(prevCount);
   ```

7. **`annotation-sync-and-persistence.spec.js`** (socket broadcast):
   ```js
   await page.waitForFunction(
     () => window.__lastAnnotation && window.__lastAnnotation.timestamp > 0,
     { timeout: 5000 }
   );
   ```
   **Instrumentation:** Wire via Playwright `page.addInitScript(() => { window.__E2E__ = true })` in the test fixture (or `test.beforeEach`); the client annotation handler in `client/src/hooks/use-annotation-sync.js` reads `window.__E2E__` and only writes `window.__lastAnnotation = {...}` when true. NO `import.meta.env.MODE` check (Vite has no 'test' mode during Playwright runs).

8. **`live-timer-broadcast-via-game-timer-socket-events.spec.js`** (timer sync):
   ```js
   await expect.poll(
     () => viewer.locator('[data-testid="presenter-timer"]').textContent(),
     { intervals: [250], timeout: 5000 }
   ).toMatch(/00:0[1-9]/);
   ```

9. **`animation-preview.spec.js`** (paint settle — state-based, NO `Promise.race(waitForTimeout)`):
   ```js
   // AFTER — pure state-based polling
   await expect.poll(
     () => page.locator('[data-testid="animation-preview"]').evaluate(el => getComputedStyle(el).opacity),
     { intervals: [50], timeout: 1000 }
   ).toBe('1');
   ```

10. **`a11y/axe-core-accessibility-scan.spec.js`** (axe injection):
    ```js
    await page.waitForFunction(() => !!window.axe, { timeout: 5000 });
    ```

11. **`pages/RibbonInsertHelper.js`** (modal open — depends on Phase 3 testids):
    ```js
    await this.page.locator('[data-testid="modal-shell-dialog"]').waitFor({ state: 'visible' });
    ```

12. **`pages/ribbon-tab-toolbar-helper.js`** (tab switch — depends on Phase 3 testids):
    ```js
    await this.page.locator(`[data-testid="ribbon-tab-${name}-content"]`).waitFor({ state: 'visible' });
    ```

13. **`visual/*.spec.js`** (paint settle): Use `await page.waitForLoadState('networkidle')` + `await expect(page).toHaveScreenshot()` (Playwright auto-retries screenshot internally).

### Refactor

14. Move shared waits to `tests/e2e/pages/wait-helpers.js`
15. Re-run full E2E locally (`npm run test:e2e`) — expect green or known failures unrelated to this phase
16. Measure wallclock: `time npm run test:e2e` and diff against `reports/baseline-wallclock.txt` — record delta in `reports/de-flake-perf.md`

## Success Criteria

- [x] `npm run lint` produces zero `playwright/no-wait-for-timeout` errors
- [x] `tests/unit/no-wait-for-timeout.test.js` passes (greps directory, asserts 0)
- [x] Full E2E run wallclock ≤ baseline + 5% (per `reports/de-flake-perf.md`)
- [x] No new flakes in affected de-flaked specs with `--repeat-each=3` (full-suite repeat is blocked by pre-existing `coverage-gaps.spec.js:104`)
- [x] De-flaked specs run locally without retry consumption in targeted repeat sanity
- [x] Zero `Promise.race(transitionend, waitForTimeout(...))` patterns in `tests/e2e/**` (would contradict lint rule)

## Verification Notes

- `rg -n "waitForTimeout\\(" tests\\e2e` -> no matches.
- `rg -n "Promise\\.race|waitForTimeout\\(" tests\\e2e` -> no matches.
- `npm test -- tests/unit/no-wait-for-timeout.test.js tests/unit/playwright-config.test.js tests/unit/test-fixtures-loopback.test.js` -> 3 files / 15 tests passed.
- `npm run lint` -> exit 0, 97 existing warnings, 0 errors.
- `npx playwright test tests/e2e/undo-redo.spec.js` -> 4 passed.
- `npx playwright test tests/e2e/games/game-elements.spec.js` -> 27 passed after code-review no-op wait cleanup.
- `npx playwright test tests/e2e/games/game-elements.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js` -> 41 passed.
- `npx playwright test tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js` -> 10 passed.
- `npx playwright test tests/e2e/visual/mobile-editor-explicit-device-scale-factor-pinned.spec.js tests/e2e/visual/present-speaker-share-and-live-viewer-baselines.spec.js tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js` -> 12 skipped on Windows visual guard.
- Affected spec repeat sanity: 165 passed with `--repeat-each=3`.
- Full E2E: 251.22s, exit 1 from pre-existing `coverage-gaps.spec.js:104`, faster than Phase 1 baseline 291.05s.

## Tests (verification)

```js
// tests/unit/no-waitForTimeout.test.js
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('e2e suite is sleep-free', () => {
  it('contains zero waitForTimeout calls', () => {
    const result = execSync(
      'git grep -c "waitForTimeout(" tests/e2e/ || true',
      { encoding: 'utf8' }
    );
    const total = result.split('\n')
      .filter(Boolean)
      .map(line => parseInt(line.split(':').pop(), 10))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});
```

```js
// tests/e2e/pages/wait-helpers.js
import { expect } from '@playwright/test';

export async function waitForOpacity(page, locator, target = '1') {
  await expect.poll(
    () => locator.evaluate(el => getComputedStyle(el).opacity),
    { intervals: [50], timeout: 1000 }
  ).toBe(target);
}

export async function waitForApiResponse(page, pattern) {
  return page.waitForResponse(r => pattern.test(r.url()) && r.status() === 200);
}

export async function waitForElementSnapshot(page, locator, snapshotName) {
  await page.waitForLoadState('networkidle');
  await expect(locator).toHaveScreenshot(snapshotName, {
    maxDiffPixelRatio: 0.02,
  });
}
```

## Risk Assessment

- **Risk:** `expect.poll` interval too aggressive → CPU spike on CI. Mitigation: default `intervals:[250]` (4 Hz), max `timeout:10_000`.
- **Risk (RESOLVED post-audit):** `window.__lastAnnotation` instrumentation leak. Mitigation: gated by `window.__E2E__` flag set by Playwright via `page.addInitScript` (NO source-side `import.meta.env.MODE` check needed — never fires under Playwright). The handler reads `if (window.__E2E__) window.__lastAnnotation = {...}` — falsy by default → zero prod impact.
- **Risk (RESOLVED post-audit):** Lint contradiction from `Promise.race(transitionend, waitForTimeout)` fallback. Mitigation: pattern eliminated entirely; replaced with `expect.poll(() => getComputedStyle.opacity)` which IS lint-clean.
- **Risk:** Reduced-motion users see `transitionend` never firing. Mitigation: `expect.poll` on `opacity` reads the final state regardless of how the browser got there — no race.
- **Risk:** Flakes increase before they decrease (regression). Mitigation: land each file as own commit; bisect easy.

## Next Steps

- Phase 7 architecture cleanup further consolidates wait helpers
- After this phase, e2e wallclock should reduce by ~20s aggregate (20 × ~1s average)
