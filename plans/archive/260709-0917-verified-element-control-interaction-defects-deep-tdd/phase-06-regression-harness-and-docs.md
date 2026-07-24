---
phase: 6
title: "Regression Harness And Docs"
status: pending
priority: P2
effort: "0.5d"
dependencies: [1, 2, 3, 4, 5]
---

# Phase 6: Regression Harness And Docs

## Overview

Consolidate Phase 1–5 behaviors into a durable regression harness, document lock/cut/merge/find-replace semantics, and explicitly mark non-bugs (export limits, game renderers present, multi-nudge OK) so future audits do not re-open them.

## Requirements

- Functional:
  - Extend `client/src/editor-interaction-bug-repro.test.js` (or sibling `verified-element-control-defects.repro.test.js`) with **passing** assertions for V1–V3 at pure-function level.
  - Docs: short section in `docs/code-standards.md` or `docs/codebase-summary.md` on lock semantics (cut=delete=dup skip locked; copy may include locked).
  - Table merge policy one-liner in code comment above `normalizeTableShape`.
  - Optional: note find-replace type whitelist in FindReplaceBar file header.
- Non-functional:
  - Full `npm run test` green.
  - `npm run lint` 0 errors.
  - No new flaky E2E required; unit-only harness preferred (Playwright marquee flake history).

## Architecture

Harness file structure:

```js
// verified-element-control-defects.repro.test.js
describe('V1 cut lock', ...)
describe('V2 table merge preserve', ...) // import preserveValidMerges
describe('V3 find replace table', ...)
// document V4-V6 covered in phase unit files
```

## Related Code Files

- Create: `client/src/verified-element-control-defects.repro.test.js` (optional if extending existing harness)
- Modify: `client/src/editor-interaction-bug-repro.test.js`
- Modify: `docs/code-standards.md` or `docs/codebase-summary.md`
- Modify: `docs/export-fidelity-and-limits.md` only if clarifying "not a defect" cross-links (optional)
- Journal: `docs/journals/` entry after cook complete (via `/ck:journal`)

## TDD — Tests First (RED/GREEN)

Most tests already green from prior phases. Phase 6 adds **meta** tests:

```js
it('createCutOperation and createDuplicateOperation share lock skip policy')
it('normalizeTableShape preserves a 2x2 merge across append row')
it('replaceAllInSlides updates table.data')
```

If any phase shipped without a cross-file assert, add it here first then confirm still green.

## Implementation Steps

1. Add consolidated repro file or extend existing.
2. Document lock + merge + find-replace whitelist.
3. Run full unit suite + lint.
4. Update plan statuses via `ck plan check` when cooking.
5. Write journal entry summarizing defects fixed.

## Success Criteria

- [ ] Consolidated regression tests exist and pass
- [ ] Docs describe lock cut/delete/dup parity
- [ ] Docs or comments describe merge preserve policy
- [ ] `npm run test` pass
- [ ] `npm run lint` 0 errors
- [ ] Explicit "wontfix" list for export limits / multi-nudge / game TODOs in plan or docs

## VERIFY Gate (plan completion)

```bash
npx vitest run client/src/hooks/use-clipboard.test.js
npx vitest run client/src/components/properties/table-properties-utils.test.js
npx vitest run client/src/components/find-replace-helpers.test.js
npx vitest run client/src/editor-interaction-bug-repro.test.js
npm run test
npm run lint
```

## Stretch (only if time remains after green gate)

- Find/replace `timeline` event titles
- Remap merges on mid-column delete
- ui-store global notice for blocked actions if Phase 4 used local state

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Full suite time | Run full suite once at end |
| Doc drift | Keep semantics short; link plan dir |

## Risk: Low | Blast: tests + docs
