---
phase: 6
title: "Fix I-004 Footer Version Source"
status: pending
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 6: Fix I-004 — Footer Version Source (GREEN + REFACTOR)

## Overview

Replace the hardcoded `v1.6.1` string in the status bar with a build-time-injected value derived from `package.json`, so footer cannot drift from the real release version again.

## Severity & Scope

- **Severity:** Low (cosmetic; visible to every user)
- **Root cause:** `client/src/components/layout/StatusBar.jsx:60` — `v1.6.1` is a string literal, not derived from package.json
- **Current state:** package.json is at `1.9.4`; footer shows `1.6.1` — three patch versions behind, drift since refactor

## Requirements

### Functional
- Footer displays version equal to `package.json` `version` field, prefixed with `v`.
- Works in `npm run dev` (Vite dev server).
- Works in `npm run build` + `npm start` (production bundle served by Express).
- Works in Electron build (which bundles the same client).

### Non-functional
- One source of truth: root `package.json`.
- No runtime fetch of package.json (would add unnecessary HTTP call); inject at build time.
- No new dependency.

## Architecture

Use Vite's `define` option in `client/vite.config.js` to inject `__APP_VERSION__` as a string constant:

```
client/vite.config.js → define: { __APP_VERSION__: JSON.stringify(pkg.version) }
client/src/components/layout/StatusBar.jsx → use __APP_VERSION__ with dev fallback
```

`__APP_VERSION__` becomes a real string literal at build time. In dev mode Vite resolves it the same way (the value is available immediately, not via HMR). Source: standard Vite pattern.

## Related Code Files

- Modify: `client/vite.config.js` (add `define` block + import root package.json)
- Modify: `client/src/components/layout/StatusBar.jsx` (replace literal at line 60)
- Optional: `client/src/vite-env.d.ts` if TypeScript types exist — declare `__APP_VERSION__` (this project is JS, but check for jsconfig)
- Read for context: `package.json` (root)
- Tests verifying this fix: `tests/e2e/regression-smoke-fixes.spec.js` I-004 case from Phase 1.3

## Implementation Steps

### Step 6.1 — Inject version at build time (createRequire primary per Red Team Finding 8)

Node 22 deprecates the `assert { type: 'json' }` import attribute syntax in favor of `with { type: 'json' }`, and across Node 18/20/22 the `createRequire` pattern is the most stable cross-version approach for reading a sibling `package.json`. Use `createRequire` as the primary path:

Edit `client/vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json')

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3002'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react()],
  // ... existing server / build config unchanged
})
```

`createRequire(import.meta.url)` works in Node 18, 20, 22, and 24 — both ESM and CommonJS contexts. No deprecation warnings, no import-attribute experimental-flag issues.

If preserving an existing `existing server / build config` block: keep the surrounding object intact, only add the `define` key.

### Step 6.2 — Consume the constant in StatusBar

Edit `client/src/components/layout/StatusBar.jsx`, replace line 60 (`v1.6.1`):

```jsx
{/* eslint-disable-next-line no-undef */}
{`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`}
```

The `typeof` check guards against any environment where define wasn't applied (e.g. unit tests using jsdom without Vite plugin). Fallback is `vdev`.

If the project has ESLint globals config for Vite defines, declare `__APP_VERSION__: 'readonly'` in `eslint.config.js` to remove the per-line disable. Quick grep first:

```powershell
grep -n "__APP_VERSION__\|globals:" eslint.config.js client/eslint.config.js 2>$null
```

### Step 6.3 — Run Phase 1 RED → GREEN

```powershell
npx playwright test tests/e2e/regression-smoke-fixes.spec.js --grep "I-004"
```

Test reads package.json at runtime and expects footer to match. Expected: passes.

### Step 6.4 — Visual smoke

1. `npm run dev` → open http://localhost:5174 → footer shows `v1.9.4`.
2. `npm run build && npm start` → open http://localhost:3002 → footer shows `v1.9.4`.
3. Bump package.json to `1.9.5-test` (temp) → rebuild → confirm footer reflects bump → revert.

### Step 6.5 — Commit

```text
fix(footer): derive version from package.json via Vite define (I-004)

Status bar previously hardcoded v1.6.1, drifting from the actual
release version (1.9.4). Vite now injects __APP_VERSION__ from
the root package.json at build time, with a 'dev' fallback for
non-Vite contexts (unit tests). One source of truth.
```

## Success Criteria

- [ ] `client/vite.config.js` injects `__APP_VERSION__` from root package.json
- [ ] `StatusBar.jsx` consumes the constant with `'dev'` fallback
- [ ] ESLint globals declared if config exists (no per-line disable left dangling)
- [ ] Phase 1.3 I-004 test passes
- [ ] Visual smoke at dev and production
- [ ] `npm run build` succeeds; no warnings about undefined globals

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `__APP_VERSION__` clashes with another global defined elsewhere | Grep for prior use; rename if conflict (unlikely — convention is unique) |
| Electron build doesn't apply the define | Electron consumes `client/dist/` which is built by the same Vite config — verified by checking `electron/electron.js` for asset path |
| Tests using jsdom complain about undefined `__APP_VERSION__` | The `typeof` guard returns `'dev'`. Tests pass either way |
| Unit test of `StatusBar.jsx` exists and expects v1.6.1 | Grep first: `grep -rn "v1.6.1" client/src/` — update any test that asserts on hardcoded version |

## Security Considerations

- Version string injection is at build time; no runtime side effects.
- `package.json` content is non-sensitive.

## Red Team Adjustment

### Session 2 — 2026-05-23 (post-draft review)

| Finding | Severity | Disposition | Applied |
|---|---|---|---|
| 8. `assert { type: 'json' }` is deprecated in Node 22 (replaced by `with { type: 'json' }`); not present in Node 18 ESM at all without `--experimental-import-attributes`. Using it as primary makes the build fragile across Node versions | Medium | Accept | Step 6.1 promoted `createRequire(import.meta.url)` to the primary import. Works unchanged on Node 18/20/22/24, no flags, no deprecations |

Pre-emptive considerations (kept):
- If reviewer asks "why not display git commit SHA too": out of scope; a follow-up.
- If reviewer asks about i18n of the "v" prefix: tiny scope, not worth wiring into i18n machinery.

## Next Steps

Phase 7 picks up this fix in the regression sweep.
