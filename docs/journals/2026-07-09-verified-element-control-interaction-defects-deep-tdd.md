# Verified Element Control Interaction Defects — Cook Complete

**Date:** 2026-07-09  
**Plan:** `plans/260709-0917-verified-element-control-interaction-defects-deep-tdd`  
**Status:** Implemented (unit gate 107/107 on phase suites)

## What shipped

1. **Cut/lock parity** — `createCutOperation` + `performCut` skip locked; survivors stay selected.
2. **Table merge preserve** — `preserveValidMerges` keeps in-bounds merges on shape change.
3. **Find/replace tables** — cell text searchable/replaceable; vertical children covered.
4. **Blocked-action notice** — `onBlockedAction` + `showNotice` for group/element/slide lock.
5. **Callout ≥ MIN_SIZE**, mixed opacity label/aria.
6. **Harness** `verified-element-control-defects.repro.test.js` + `docs/code-standards.md` semantics.

## Verify

```
npx vitest run … (9 files, 107 tests) — pass
```

## Out of scope (intentional)

Multi-nudge (already works), game renderer polish, PPTX format limits.
