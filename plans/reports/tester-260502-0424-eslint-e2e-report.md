# ESLint & E2E Test Report — 2026-05-02

## Summary

| Check | Result |
|-------|--------|
| ESLint errors | 0 (down from 0) |
| ESLint warnings | 12 (down from 62) |
| E2E tests passed | 155/155 (100%) |
| Build | ✅ OK |

## ESLint: Fixes Applied

### 1. Root Cause Fix — ESLint Config (`eslint.config.mjs`)
**Problem:** Test files in `client/src/**/*.test.{js,jsx}` had no vitest globals — fell under the client config which only includes browser globals.

**Fix:** Added a new separate ESLint config block for `client/**/*.test.{js,jsx}` that includes both `globals.browser` and `globals.vitest`. Also added separate config for non-test client files to avoid overlap.

### 2. Test Files — Missing Imports (`beforeEach`)
**File:** `client/src/components/annotation-canvas.test.jsx:3`
**Problem:** `beforeEach` was used but not imported from vitest.
**Fix:** Added `beforeEach` to the vitest import.

### 3. Test Files — CommonJS in ES Module Context
**File:** `client/src/hooks/use-game-socket.test.js:51,75`
**Problem:** `require.resolve()` used in an ES module file.
**Fix:** Replaced with `new URL('./use-game-socket.js', import.meta.url).pathname`.

### 4. Unnecessary Escape Character
**File:** `shared/src/element-renderers.js:213`
**Problem:** `\$` in regex char class `[\^$_]` — `$` doesn't need escaping inside `[]`.
**Fix:** Changed `[\^$_]` to `[\^$_]`.

### 5. Unused Variables (50 renames across 17 files)
All function arguments and destructured variables that were unused were renamed with `_` prefix following the ESLint rule `argsIgnorePattern: ^_`.

### 6. Bug Fixes from Rename
The rename process introduced 3 broken references:
- `game-element-renderer.jsx`: `setWagerTeamId` references updated to `_setWagerTeamId`
- `EditorPage.jsx`: `setAnnotationStrokes` references updated to `_setAnnotationStrokes`
- `name-picker-interactive-game-renderer.jsx`: `isLanding` reference at line 275 updated to `_isLanding`
- `tests/e2e/games/game-elements.spec.js`: `page` destructuring pattern restored (Playwright requires `async ({ page })`, not `async (_page)`)

## Remaining ESLint Warnings (12)

All remaining warnings are `react-hooks/exhaustive-deps` or unused `page` in test files. These require intentional design decisions:

### `react-hooks/exhaustive-deps` (9 warnings)
These are design-level decisions — the current implementation intentionally omits dependencies to avoid re-running effects/callbacks on every render, which is a valid (if aggressive) optimization. However, they could cause stale-closure bugs in edge cases.

| File | Location | Issue |
|------|----------|-------|
| `game-element-renderer.jsx` | :316 | `useEffect` missing deps: `activeTeam`, `ddKeys`, `element.teams`, `qLookup` |
| `game-element-renderer.jsx` | :332 | `useEffect` missing dep `timeLeft` + complex dep expression |
| `name-picker-interactive-game-renderer.jsx` | :143, :230, :314 | `items` in useCallback dep array |
| `relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx` | :61 | `teams` in useCallback dep array |
| `use-element-cycle-through-slide-elements-hook.js` | :16, :26 | `currentSlideIndex`, `slides` marked as unnecessary deps |

**Recommendation:** These should be evaluated case-by-case. If the effect/callback is intentionally stable (e.g., timer effects that shouldn't restart on every render), add a comment `// eslint-disable-next-line react-hooks/exhaustive-deps` to suppress the warning intentionally. If they are genuine bugs, add the missing deps.

### Unused `page` in Playwright tests (3 warnings)
**File:** `tests/e2e/games/game-elements.spec.js` lines 42, 56, 248
These tests don't use the Playwright `page` fixture. Since Playwright requires the destructuring pattern `async ({ page })`, the `_page` name can't be used. These can be safely ignored (page fixture is still passed, just unused).

## Unresolved Questions
- Should the `react-hooks/exhaustive-deps` warnings be treated as bugs or intentional optimizations? Each needs a manual review.
