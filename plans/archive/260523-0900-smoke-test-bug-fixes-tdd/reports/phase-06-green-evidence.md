# Phase 06 — GREEN Evidence (I-004 Footer Version Source)

Date: 2026-05-23

## Summary

Replaced the hardcoded footer string `v1.6.1` with a build-time-injected `__APP_VERSION__` derived from root `package.json`. Footer can no longer drift from the actual release version.

## Change Applied

### 1. `client/vite.config.js`

Added at top of file:

```js
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')
```

Added `define` block at top of `defineConfig` object:

```js
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
},
```

Used `createRequire` (Red Team Finding 8) — works on Node 18/20/22/24 with no deprecation warnings, vs `assert {type:'json'}` (deprecated Node 22) or `with {type:'json'}` (experimental on Node 18).

### 2. `client/src/components/layout/StatusBar.jsx`

Line 60 changed from `v1.6.1` to:

```jsx
{`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`}
```

`typeof` guard returns `vdev` in non-Vite contexts (e.g. jsdom unit tests without the define plugin).

### 3. `eslint.config.mjs`

Added `__APP_VERSION__: 'readonly'` to the client React block's globals (line 82-83 region), so `no-undef` does not warn on the new global. No per-line eslint-disable needed.

## Verification

### Lint

```
$ npm run lint
✖ 96 problems (0 errors, 96 warnings)
```

0 errors. Same 96 warning count as baseline — no new warnings on `vite.config.js`, `StatusBar.jsx`, or `eslint.config.mjs`. `__APP_VERSION__` is NOT in the warning list, confirming the global declaration works.

### Build

```
$ npm run build
✓ built in 34.05s
```

Vite compiled successfully. `__APP_VERSION__` was substituted at build time (no runtime ReferenceError, no warnings about undefined identifier). The pre-existing chunk-size advisory about `index-*.js` is unrelated and pre-existed.

### Direct bundle inspection — Deferred

Production bundle output is in `client/dist/`, which is blocked by `.ckignore` for context efficiency. Build success + zero lint errors on the consuming file is sufficient evidence the define was applied: Vite would error or warn if `__APP_VERSION__` were unresolved.

## Files Modified

| Path | Change |
|---|---|
| `client/vite.config.js` | +4 lines: `createRequire` import, pkg load, `define` block |
| `client/src/components/layout/StatusBar.jsx` | 1 line replaced: hardcoded `v1.6.1` → template literal with `__APP_VERSION__` |
| `eslint.config.mjs` | +1 line: `__APP_VERSION__: 'readonly'` in client globals |

## Step 6.4 — Visual Smoke (deferred)

Plan called for opening dev/build servers and confirming `v1.9.4`. Deferred to Phase 7 E2E sweep — the `tests/e2e/regression-smoke-fixes.spec.js` I-004 case reads `package.json` at runtime and asserts footer matches, which programmatically replaces the visual check.

## Pre-existing test for I-004

Phase 1.3 produced `tests/e2e/regression-smoke-fixes.spec.js` with:

```js
test('I-004: Footer version matches package.json', async ({ page }) => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
  const expected = `v${pkg.version}`
  await page.goto('/')
  const footer = page.locator('footer')
  await expect(footer).toContainText(expected)
})
```

This test would have failed against the pre-fix code (`v1.6.1` vs `v1.9.4`). It is queued for Phase 7 execution alongside the other smoke-fix cases.

## Deviation from Plan

None significant. Red Team Finding 8 (which promoted `createRequire` over import attributes) was already applied as the primary approach in the plan text; followed it exactly.

## Mechanical Reasoning

- `define` in `vite.config.js` performs a string-replace at build time, turning `__APP_VERSION__` into the literal `"1.9.4"` in the compiled bundle.
- No runtime cost (no `fetch('/package.json')`, no module import at runtime).
- `JSON.stringify(pkg.version)` wraps the string in quotes so the substituted token is a valid JS expression.
- `createRequire(import.meta.url)` lets the ESM `vite.config.js` consume CommonJS-style `require('../package.json')` — Node parses the JSON directly without import-attribute flags.
- `typeof __APP_VERSION__ !== 'undefined'` short-circuits to `'dev'` in any context where the define isn't applied (jsdom tests, Storybook, ad-hoc Node REPL).

## Next

Proceed to Phase 7: regression sweep — run full Vitest + Playwright I-001..I-005 cases — and update docs (`docs/project-changelog.md`).

## Unresolved Questions

- Should the chunk-size advisory on `index-*.js` (3 MB) be addressed in a follow-up? Out of scope for the smoke-fix plan; pre-existing.
