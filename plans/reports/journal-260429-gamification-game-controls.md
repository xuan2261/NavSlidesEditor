# Gamification Game Controls — 11 Phases Complete

**Date**: 2026-04-29 21:17
**Severity**: Medium
**Component**: client/src/components/element-renderers/game-element-renderer.jsx, e2e tests
**Status**: Resolved

## What Happened

Implemented a full gamification layer for the presentation editor: game elements (quiz, poll, word cloud, timer, spinner, leaderboard), a player join page, and 27 E2E tests. The commit touched 706 files (68,257 insertions, 4,628 deletions). All 27 E2E tests pass.

## The Brutal Truth

This was a meaty feature done in 11 phases, and the usual suspects bit us. ESM/CommonJS incompatibilities, wrong import depths, and selector mistakes in tests cost hours each. Nothing exotic — just the kind of friction that compounds when working across a large monorepo with a Vite build pipeline.

## Key Technical Decisions and Failures

**ESM vs CommonJS (game-element-renderer.jsx)**
The file used `require()` for lazy-loading — five calls for Quiz, Poll, WordCloud, Timer, and Spinner components. Failed silently in Vite's ESM context. Fixed by replacing all five with dynamic `import()` promises driven by React `useState`/`useEffect`. Correct pattern:
```jsx
const [QuizComponent, setQuizComponent] = useState(null);
useEffect(() => { import('./games/Quiz.jsx').then(m => setQuizComponent(() => m.default)); }, []);
```

**Wrong import depth**
`../../hooks/use-game-socket.js` resolved to `client/src/components/hooks/` instead of the hooks root. Fixed to `../../../hooks/use-game-socket.js` — three levels up from `element-renderers/`.

**E2E selector discipline**
Used `clickInsertMenuItem('Insert')` (dropdown-item pattern) when the trigger is a plain `<button className="insert-trigger">`. Fixed to `page.click('button.insert-trigger:has-text("Insert")')`.

**Player join route**
App route is `/player/:slideId/:elementId` — two URL params, not three. The input placeholder reads `"e.g. Minh or Team Red"`, not a `/name/i` regex pattern.

**Game element selection in tests**
Game elements are SVG-heavy and resist standard `.click()` selection for property panel verification. Test strategy shifted to verifying element insertion and DOM rendering instead of trying to select-and-inspect.

**Playwright dropdown state**
The Insert menu does not persist open across tests. Every test must explicitly open it before interacting with items.

## Lessons Learned

- When using dynamic imports in React components under Vite, always use the `import()` promise + state pattern. No exceptions.
- Count your directory depth carefully when importing from nested component subdirectories.
- E2E selector patterns must match the actual DOM, not the mental model. Inspect before writing selectors.
- SVG-heavy elements are hard to select in automated tests — test insertion and rendering, not interaction.

## Next Steps

- Consider extracting the dynamic import pattern into a reusable `useDynamicImport` hook to prevent future ESM footguns.
- Standardize the Insert menu trigger selector across all tests.
- Write a test utility for game-element insertion to DRY up the E2E suite.
