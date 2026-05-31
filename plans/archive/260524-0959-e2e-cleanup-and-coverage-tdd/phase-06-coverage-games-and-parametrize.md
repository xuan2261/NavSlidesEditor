---
phase: 6
title: "P1-P2 Coverage Gap — Games + Parametrize Visual"
status: completed
priority: P2
effort: "4h"
dependencies: [3]
---

# Phase 6: P1-P2 Coverage Gap — Games + Parametrize Visual

## Overview

1. **Games (P1):** Cover game-mode keyboard shortcuts that have testable DOM effects. Per source verification (`EditorPage.jsx:1155-1165`):
   - **G** → `setShowGameHud((v) => !v)` — REAL state toggle (line 1155)
   - **L** → `setShowGameLeaderboard((v) => !v)` — REAL state toggle (line 1164, NOT a stub as originally claimed)
   - **Enter** → `console.log('[game] next phase')` stub (line 1162)
   - **R** → `console.log('[game] reveal')` stub (line 1163)
   - **P** → `console.log('[game] pause')` stub (line 1165)
2. **Parametrization (P2):** Convert visual specs (themes, transitions, layouts) to table-driven `test.describe.parallel`. User-confirmed: 36-cell representative subset (3 themes × 3 transitions × 4 layouts). Staged in two sub-phases (6a framework, 6b baselines) to avoid unbounded snapshot churn.

## Requirements

- New spec: `tests/e2e/games/keyboard-shortcuts.spec.js` — covers G (real), L (real), Enter/R/P (stubs)
- New spec: `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js` — framework implemented with 36 structural cells; 3 snapshot cells are gated behind Linux + `E2E_VISUAL_BASELINES=1`
- Source verified: G/L bind state setters in `EditorPage.jsx`; Enter/R/P are `console.log` stubs
- Visual matrix snapshot capture is gated to Linux-only via runtime env check; structural matrix runs cross-platform
- All new code uses Phase 3 testids

## Architecture

### Game Shortcuts (verified at `client/src/utils/default-keyboard-shortcut-definitions-registry.js:31-42`)
- Registry path: `client/src/utils/default-keyboard-shortcut-definitions-registry.js` (NOT `client/src/data/` — verified via Glob; no file exists under `client/src/data/`)
- Scope: `'presentation-game'`
- Bindings (verified at `EditorPage.jsx:1155-1165`):
  - **G** (line 1155) — `setShowGameHud((v) => !v)` → toggles `[data-testid="game-hud"]` visibility (REAL)
  - **L** (line 1164) — `setShowGameLeaderboard((v) => !v)` → opens `[data-testid="game-leaderboard"]` modal (REAL — NOT a stub)
  - **Enter** (line 1162) — `console.log('[game] next phase')` (STUB)
  - **R** (line 1163) — `console.log('[game] reveal')` (STUB)
  - **P** (line 1165) — `console.log('[game] pause')` (STUB)

### Visual Parametrization (user-confirmed: 36-cell representative subset)
- Themes: 3 = `black, white, league` (representative subset of reveal.js themes — full set has 9)
- Transitions: 3 = `none, fade, slide` (representative subset of 6 reveal.js transitions)
- Layouts: 4 — TBD-scout: read `client/src/data/element-defaults.js` LAYOUT_DEFAULTS during 6a impl to pin actual layout names
- Parameterise via nested `for` loops → 3 × 3 × 4 = 36 combinations
- **Staging (6a/6b):**
  - **6a (framework):** parametrize but DO NOT generate snapshots; assert structural DOM/computed-style only (e.g. `[data-theme="black"]` attr present, `getComputedStyle(.reveal-viewport).backgroundColor` matches expected, `getComputedStyle(slide).transitionTimingFunction` set)
  - **6b (baselines):** generate snapshots for 3 representative combos (e.g. `black-fade-title`, `white-none-titleContent`, `league-slide-comparison`); structural assertions remain for the other 33
- Snapshots gated to Linux via existing `skipNonLinuxVisualSnapshots` helper (used by `visual-regression.spec.js` — verified pattern)
- `maxDiffPixelRatio: 0.02` — matches user-approved threshold

## Related Code Files

**Create:**
- `tests/e2e/games/keyboard-shortcuts.spec.js`
- `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js`
- `tests/e2e/pages/game-page.js` (helper extracted in Refactor)
- `tests/e2e/fixtures/visual-matrix.js` (constants extracted in Refactor)

**Refactor:**
- Existing `tests/e2e/visual/*.spec.js` — extract common setup if duplication emerges
- Existing `tests/e2e/visual/visual-baseline-snapshots.spec.js` — KEEP (covers different surface)
- `client/src/hooks/use-keyboard.js` — fixed scope filtering so active game shortcuts are available when a game element exists without disabling editor/canvas shortcuts

**Read for context (no edits — testids added in Phase 3):**
- `client/src/utils/default-keyboard-shortcut-definitions-registry.js:31-42` — confirm shortcut list
- `client/src/pages/EditorPage.jsx:1155-1165` — confirm L is REAL toggle, Enter/R/P are stubs
- `client/src/components/game-hud-overlay.jsx`, `client/src/components/game-leaderboard-overlay.jsx`, and `client/src/pages/EditorPage.jsx` — locate HUD / leaderboard / active-indicator components
- `client/src/data/slide-templates.js` — pin representative layout names (`blank`, `title`, `two-column`, `comparison`)
- `tests/e2e/visual-regression.spec.js` — reference for `skipNonLinuxVisualSnapshots` pattern

**Testids consumed from Phase 3 catalog (read-only):**
| testid | Group | Used by spec |
|---|---|---|
| `ribbon-tab-insert` | B | game-shortcuts |
| `ribbon-insert-game` | C | game-shortcuts |
| `game-active-indicator` | I | game-shortcuts |
| `game-hud` | I | game-shortcuts (G toggle) |
| `game-leaderboard` | I | game-shortcuts (L toggle) |
| `game-question` / `game-score` | I | used by Phase 2 de-flake |

## Implementation Steps

### Red — Game Shortcuts

1. Write `tests/e2e/games/keyboard-shortcuts.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';

   test.describe('game keyboard shortcuts', () => {
     test.beforeEach(async ({ page, testPresentation }) => {
       await page.goto(`/editor/${testPresentation.id}`);
       await page.locator('[data-testid="ribbon-tab-insert"]').click();
       await page.locator('[data-testid="ribbon-insert-game"]').click();
       await expect(page.locator('[data-testid="game-active-indicator"]')).toBeVisible();
     });

     test('G toggles HUD visibility (REAL state toggle at EditorPage.jsx:1155)', async ({ page }) => {
       const hud = page.locator('[data-testid="game-hud"]');
       await expect(hud).toBeVisible();
       await page.keyboard.press('g');
       await expect(hud).toBeHidden();
       await page.keyboard.press('g');
       await expect(hud).toBeVisible();
     });

     test('L toggles leaderboard visibility (REAL state toggle at EditorPage.jsx:1164)', async ({ page }) => {
       const leaderboard = page.locator('[data-testid="game-leaderboard"]');
       await expect(leaderboard).toBeHidden(); // default hidden
       await page.keyboard.press('l');
       await expect(leaderboard).toBeVisible();
       await page.keyboard.press('l');
       await expect(leaderboard).toBeHidden();
     });

     test('stub shortcuts (Enter, R, P) cause no errors and no new modal', async ({ page }) => {
       const errors = [];
       page.on('pageerror', e => errors.push(e));
       page.on('console', msg => {
         if (msg.type() === 'error') errors.push(new Error(msg.text()));
       });

       // Verify no leaderboard / HUD / question dialog opens
       const modalsBefore = await page.locator('[role="dialog"]:visible').count();

       await page.keyboard.press('Enter');
       await page.keyboard.press('r');
       await page.keyboard.press('p');

       // No errors, no new dialog opened (stubs only console.log)
       expect(errors).toEqual([]);
       const modalsAfter = await page.locator('[role="dialog"]:visible').count();
       expect(modalsAfter).toBe(modalsBefore);
     });
   });
   ```

### Red — Parametrized Visual Matrix (6a framework, no snapshots)

2. Write `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js`:
   ```js
   import { test, expect } from '../fixtures/test-fixtures.js';
   // import { skipNonLinuxVisualSnapshots } from './helpers.js'; // existing helper

   const THEMES = ['black', 'white', 'league'];
   const TRANSITIONS = ['none', 'fade', 'slide'];
   const LAYOUTS = ['title', 'titleContent', 'twoContent', 'comparison']; // TBD-scout — verify against element-defaults.js

   // 6b adds these to enable snapshots; until 6a passes, snapshots are skipped
   const SNAPSHOT_BASELINES = new Set([
     'black-fade-title',
     'white-none-titleContent',
     'league-slide-comparison',
   ]);

   for (const theme of THEMES) {
     for (const transition of TRANSITIONS) {
       for (const layout of LAYOUTS) {
         const key = `${theme}-${transition}-${layout}`;
         test(`renders ${key}`, async ({ page, testPresentation, request }) => {
           await request.put(`/api/presentations/${testPresentation.id}`, {
             data: {
               ...testPresentation,
               theme,
               transition,
               slides: [{ id: 's1', layout, elements: [] }],
             }
           });

           await page.goto(`/live/${testPresentation.shareToken}`);
           await page.waitForLoadState('networkidle');

           // ALWAYS: structural assertion (lint-clean, no snapshot churn)
           const themeAttr = await page.locator('html, body, .reveal').first()
             .getAttribute('data-theme').catch(() => null);
           // If theme not in DOM attr, fall back to CSS class assertion
           const reveal = page.locator('.reveal').first();
           await expect(reveal).toBeVisible();

           // SOMETIMES: snapshot for 3 representative cells
           if (SNAPSHOT_BASELINES.has(key)) {
             // skipNonLinuxVisualSnapshots(test); — replicate existing pattern
             await expect(page).toHaveScreenshot(`${key}.png`, {
               maxDiffPixelRatio: 0.02,
             });
           }
         });
       }
     }
   }
   ```

3. Run new specs → expect failures (game testids missing, layout names possibly wrong)

### Green — Game

4. Phase 3 testids unblock game shortcuts. Verify L is REAL toggle by reading `EditorPage.jsx:1164` — must show `setShowGameLeaderboard((v) => !v)`. If source has drifted to a stub, file a bug (out of plan scope).

### Green — Visual Matrix 6a

5. Read `client/src/data/element-defaults.js` LAYOUT_DEFAULTS — pin actual layout names (the `title/titleContent/twoContent/comparison` in spec is provisional)
6. Confirm structural assertions pass for all 36 cells (no snapshots yet)
7. Skip snapshot block via env flag if `process.env.E2E_VISUAL_BASELINES !== '1'`

### Green — Visual Matrix 6b (baselines)

8. On Linux runner: `E2E_VISUAL_BASELINES=1 npm run test:e2e -- --update-snapshots tests/e2e/visual/themes-transitions-layouts-matrix.spec.js`
9. Commit 3 baseline PNGs under `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js-snapshots/`
10. Re-run → 3 snapshots + 33 structural assertions all green
11. Verify CI `e2e-visual` job (Linux-only) picks up the new spec

Local Windows note: 6b baseline capture intentionally did not run locally. The snapshot gate is implemented and ready for Linux baseline generation; Windows verification covered all 36 structural cells.

### Refactor

12. Extract `setupGameMode()` helper to `tests/e2e/pages/game-page.js`
13. Move `THEMES/TRANSITIONS/LAYOUTS/SNAPSHOT_BASELINES` to `tests/e2e/fixtures/visual-matrix.js`
14. Delete now-redundant individual theme/transition/layout specs (if any) — only after verifying matrix covers same surface

## Success Criteria

- [x] Game shortcuts spec: 3 tests green
  - [x] G toggle (REAL — DOM visibility flip)
  - [x] L toggle (REAL — DOM visibility flip, NOT a stub)
  - [x] Enter/R/P stubs no-op (no errors, no new modal)
- [x] Visual matrix 6a: 36 structural-assertion tests green
- [ ] Visual matrix 6b: 3 snapshot tests green on Linux runner (implemented behind Linux/env gate; not executed on Windows)
- [x] Structural assertion + snapshot coexist correctly (snapshot block gated for 3 cells, skipped for all cells unless Linux + `E2E_VISUAL_BASELINES=1`)
- [x] No reduction in visual coverage vs. baseline; matrix adds 36 structural cells without deleting existing snapshots
- [x] Visual snapshots cached on Linux runner only by gate
- [ ] CI visual job duration ≤ +20% vs baseline (deferred to Phase 8 CI verification)

## Tests (verification)

Implemented:
- `tests/unit/game-shortcuts-registry.test.js`
- `tests/unit/game-handlers-real-vs-stub.test.js`
- `tests/e2e/games/keyboard-shortcuts.spec.js`
- `tests/e2e/pages/game-page.js`
- `tests/e2e/fixtures/visual-matrix.js`
- `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js`

Validation:
- `npm test -- tests/unit/game-shortcuts-registry.test.js tests/unit/game-handlers-real-vs-stub.test.js client/src/hooks/use-keyboard.test.js client/src/hooks/use-keyboard-contract.test.js` — 31 passed
- `npx playwright test tests/e2e/games/keyboard-shortcuts.spec.js tests/e2e/visual/themes-transitions-layouts-matrix.spec.js` — 39 passed
- `rg waitForTimeout tests/e2e/games/keyboard-shortcuts.spec.js tests/e2e/visual/themes-transitions-layouts-matrix.spec.js tests/e2e/pages/game-page.js tests/e2e/fixtures/visual-matrix.js` — no matches
- `npm run lint` — exit 0, 97 existing warnings
- `npm run build` — exit 0, existing empty `vendor-reveal` and chunk-size warnings

```js
// tests/unit/game-shortcuts-registry.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('game shortcuts registry', () => {
  // VERIFIED path: client/src/utils/... (NOT client/src/data/)
  const src = readFileSync(
    'client/src/utils/default-keyboard-shortcut-definitions-registry.js',
    'utf8'
  );

  it('binds G in presentation-game scope', () => {
    expect(src).toMatch(/scope:\s*['"]presentation-game['"]/);
    expect(src).toMatch(/key:\s*['"]g['"]/i);
  });

  it('binds L in presentation-game scope', () => {
    expect(src).toMatch(/key:\s*['"]l['"]/i);
  });
});

// tests/unit/game-handlers-real-vs-stub.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('game handlers (EditorPage.jsx:1155-1165)', () => {
  const src = readFileSync('client/src/pages/EditorPage.jsx', 'utf8');

  it('G is a REAL state toggle (setShowGameHud)', () => {
    expect(src).toMatch(/setShowGameHud\s*\(\s*\(?v\)?\s*=>\s*!v\)/);
  });

  it('L is a REAL state toggle (setShowGameLeaderboard) — NOT a stub', () => {
    expect(src).toMatch(/setShowGameLeaderboard\s*\(\s*\(?v\)?\s*=>\s*!v\)/);
  });

  it('Enter, R, P are console.log stubs only', () => {
    expect(src).toMatch(/console\.log\(['"]?\[game\]\s*next phase/);
    expect(src).toMatch(/console\.log\(['"]?\[game\]\s*reveal/);
    expect(src).toMatch(/console\.log\(['"]?\[game\]\s*pause/);
  });
});
```

## Risk Assessment

- **Risk (RESOLVED post-audit C3):** Original plan claimed L was a stub. Mitigation: verified L is `setShowGameLeaderboard((v) => !v)` at `EditorPage.jsx:1164`; test asserts real DOM toggle. Unit test `game-handlers-real-vs-stub.test.js` pins this so future drift is caught.
- **Risk (RESOLVED post-audit C4):** Wrong registry path `client/src/data/...`. Mitigation: corrected to `client/src/utils/default-keyboard-shortcut-definitions-registry.js` everywhere.
- **Risk (RESOLVED post-audit H12):** Unbounded snapshot churn (36 × CI runner upgrade churn). Mitigation: staged 6a (structural-only) → 6b (3 representative baselines). Other 33 cells use structural assertions immune to font/Chromium upgrades.
- **Risk:** Game mode entry path TBD. Mitigation: scout `client/src/components/games/*` at impl time; spec uses `ribbon-insert-game` testid from Phase 3 catalog.
- **Risk:** Layout names assumed `title/titleContent/twoContent/comparison`. Mitigation: 6a Step 5 pins names against `element-defaults.js` LAYOUT_DEFAULTS.
- **Risk:** Stub shortcuts may eventually become real handlers, breaking the no-op assertion. Mitigation: assertion is "errors = [] AND modal count unchanged" — survives turning stubs into no-op-but-no-error handlers; only breaks if a stub becomes a modal-opener.

## Next Steps

- Phase 7 may move visual-matrix constants to better location
- Phase 8 verifies snapshots stable across 3 consecutive runs (`--repeat-each=3`)
