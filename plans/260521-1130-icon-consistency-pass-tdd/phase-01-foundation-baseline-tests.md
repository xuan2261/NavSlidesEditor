---
phase: 1
title: "Foundation & Regression Guard"
status: completed
priority: P1
effort: "0.5-1h"
dependencies: []
---

<!-- Updated: Red Team Review 2026-05-21 — F2/F3/F5/F8/F10 accepted: dropped ESLint plugin, Babel inventory script, baseline snapshots (×8), axe smoke spec. Replaced with single grep-based invariants test. -->

# Phase 1: Foundation & Regression Guard

## Overview

Build the regression net for the icon consistency pass with a single Vitest source-scan test. No custom ESLint plugin, no Babel inventory script, no baseline component snapshots, no axe smoke spec — all dropped per Red Team review (5 findings accepted). The same regression guarantees come from one test that greps the source tree for the post-merge invariants.

## Requirements

### Functional
- One Vitest test (`client/src/__tests__/icon-policy-invariants.test.js`) asserts the post-merge icon policy by reading source files directly:
  - Zero Extended_Pictographic emoji code points in `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`.
  - Zero unicode arrow chars (`↖↑↗←⊕→↙↓↘↺`) in same file.
  - Zero inline `<svg>` blocks in `client/src/components/QuickAccessToolbar.jsx`.
  - Zero `Sparkles` lucide-react import sites in non-AI files (whitelist: `HomePage.jsx`, `AIGeneratorModal.jsx`, `AICopywriterModal.jsx`, `ribbon-header-bar.jsx`, plus test fixtures).
  - Zero `BarChart2` lucide-react usage in `client/src/**/*.{jsx,js}` (excluding tests).
  - Zero bare `Image` imports from `lucide-react` across `client/src/**` (must use `Image as ImageIcon`).
- Test starts FAILING on master (current state has all the violations) and goes GREEN as later phases land each fix.

### Non-functional
- Runs in <1s as part of `npm run test`.
- Plain Node `fs.readFile` + regex; no Babel, no AST.

## Architecture

### Test shape
```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { globSync } from 'glob'

describe('icon-policy invariants', () => {
  it('canvas ctx-menu has no emoji or unicode-arrow icons', () => { ... })
  it('QuickAccessToolbar has no inline <svg>', () => { ... })
  it('Sparkles is confined to AI files + test fixtures', () => { ... })
  it('BarChart2 has zero usage in client/src', () => { ... })
  it('all lucide-react Image imports use the ImageIcon alias', () => { ... })
})
```

Each `it` is a separate assertion driving one of the later phases. As later phases land their fixes, the corresponding `it` flips to green.

## Related Code Files

### Create
- `client/src/__tests__/icon-policy-invariants.test.js`

### Modify
- None.

### Delete
- None.

## Implementation Steps

### TDD: Test first
1. Write the test file with 5 `it` blocks, each performing a fs read + regex/substring check.
2. Run `npm run test -- icon-policy-invariants` — fails with current master state on every assertion (proves the guard works).

### No implementation in this phase
3. The test stays red. Each later phase makes one or more `it` go green.

### Green
4. `npm run lint` clean (this phase only adds one test file).

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| `icon-policy-invariants.test.js` | Vitest source-scan | All 5 post-merge invariants in one file |

## Success Criteria

- [x] One regression-guard test file committed
- [x] Test fails on pre-change master with 5 failing `it` blocks
- [x] `npm run lint` and `npm run test` both run; final suite green
- [x] No new ESLint plugins, no scripts, no JSON baselines, no Playwright specs

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Test is too coarse and misses regressions | Each `it` targets a specific known-violation site; later phases either flip green or expose missed scope |
| Whitelist drift (e.g., new AI file added) | Whitelist is short and lives in the test file; readers see it on PR review |
| Glob-package availability | `glob` is already a transitive dep via Vitest; verify in package.json before commit, fall back to `fs.readdirSync` recursion if not |

## Notes

- This phase intentionally adds **no** icon changes — only the regression guard.
- Replaces the originally-planned ESLint plugin (2 rules), Babel inventory script, 8 baseline component snapshot tests, and axe smoke spec — all rejected as over-engineering for a 9-issue cleanup PR.
