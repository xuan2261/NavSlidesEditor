---
phase: 3
title: "Align ProductTour Test with v3 API"
status: completed
priority: P2
effort: "20m"
dependencies: []
---

# Phase 03: Align ProductTour Test with Joyride v3 API

## Overview

Rewrite `ProductTour.test.js` to match the actual Joyride v3 API used in `ProductTour.jsx`. The test currently asserts the old v2 API, causing 1 persistent test failure.

## Root Cause

`ProductTour.jsx` was migrated to Joyride v3 API:
- `run` starts as `false`, set to `true` after 800ms delay
- Uses `onEvent` instead of `callback`
- Options moved into `options` prop object
- Steps use `skipBeacon` instead of `disableBeacon`
- `stepIndex` is now a controlled prop

But the test still asserts v2 behavior:
- `props.run === true` immediately (fails because `useEffect` hasn't fired in SSR)
- `hideCloseButton`, `disableCloseOnEsc`, `disableOverlayClose` as top-level props
- `disableBeacon` on each step
- `steps[4].placement === 'top'` (actually `'center'`)

## Requirements

- Functional: All ProductTour test cases must pass
- Non-functional: Test must accurately validate the current component API

## Related Code Files

- Modify: `client/src/components/ProductTour.test.js`
- Reference: `client/src/components/ProductTour.jsx` (source of truth for API shape)

## Detailed API Diff: What the test must assert

| Property | Old (test expects) | New (component actually uses) |
|:---------|:-------------------|:------------------------------|
| `run` | `true` immediately | `false` → `true` after 800ms useEffect |
| `hideCloseButton` | top-level `true` | not present |
| `disableCloseOnEsc` | top-level `true` | `options.dismissKeyAction = false` |
| `disableOverlayClose` | top-level `true` | `options.overlayClickAction = false` |
| `showProgress` | top-level `true` | `options.showProgress = true` |
| `spotlightClicks` | `false` | not present (replaced by `options.blockTargetInteraction`) |
| `stepIndex` | `undefined` | `0` (controlled) |
| `callback` | present | replaced by `onEvent` |
| `steps[*].disableBeacon` | `true` on every step | `skipBeacon: true` on every step |
| `steps[4].placement` | `'top'` | `'center'` |

## Implementation Steps

### 1. Rewrite test case: "uses a continuous guided tour with explicit placements"

The test uses `renderToString` (SSR), so `useEffect` doesn't fire → `run` will be `false` at SSR render time. This is correct v3 behavior and should be asserted as such.

**New test code:**
```js
it('uses a continuous guided tour with explicit placements', () => {
  localStorageMock.getItem.mockReturnValue(null)

  renderToString(React.createElement(ProductTour))

  expect(joyrideMock).toHaveBeenCalledTimes(1)
  const props = joyrideMock.mock.calls[0][0]

  // v3: run starts false, useEffect sets true after delay (SSR = no effects)
  expect(props.run).toBe(false)
  expect(props.continuous).toBe(true)
  expect(props.stepIndex).toBe(0)

  // v3: options object replaces top-level props
  expect(props.options.showProgress).toBe(true)
  expect(props.options.overlayClickAction).toBe(false)
  expect(props.options.dismissKeyAction).toBe(false)
  expect(props.options.blockTargetInteraction).toBe(true)

  // v3: onEvent replaces callback
  expect(typeof props.onEvent).toBe('function')

  // Steps validation
  expect(props.steps).toHaveLength(6)
  expect(props.steps.every((step) => step.skipBeacon === true)).toBe(true)
  expect(props.steps[0].placement).toBe('center')
  expect(props.steps[1].placement).toBe('bottom-end')
  expect(props.steps[2].placement).toBe('right')
  expect(props.steps[3].placement).toBe('bottom-start')
  expect(props.steps[4].placement).toBe('center')
  expect(props.steps[5].placement).toBe('left')
})
```

### 2. Update mock to include missing exports

The mock needs to export `ACTIONS` and `EVENTS` in addition to `STATUS` since `ProductTour.jsx` imports them:

```js
vi.mock('react-joyride', () => ({
  Joyride: (props) => {
    joyrideMock(props)
    return null
  },
  STATUS: joyrideStatus,
  ACTIONS: { NEXT: 'next', PREV: 'prev', CLOSE: 'close' },
  EVENTS: { STEP_AFTER: 'step:after' },
}))
```

### 3. Keep second test case intact

The "does not rerun once the tutorial has been seen" test should remain unchanged — it correctly asserts `run === false` when localStorage has `'true'`.

## Verification

### Automated

```bash
# 1. Run ProductTour test specifically
npx vitest run client/src/components/ProductTour.test.js --reporter=verbose
# Result: 2 passed, 0 failed

# 2. Run full test suite
npm run test
# Result: 55 passed, 0 failed

# 3. Build
npm run build
# Result: success
```

### Cross-check with component

```bash
# Confirm component shape matches test assertions
Select-String -Path "client/src/components/ProductTour.jsx" -Pattern "skipBeacon|onEvent|options|MOUNT_DELAY"
# Expected: all present
```

## Success Criteria

- [x] `npx vitest run client/src/components/ProductTour.test.js` → 2 passed, 0 failed
- [x] Test assertions match actual Joyride v3 API
- [x] Mock exports `ACTIONS` and `EVENTS` to prevent import errors
- [x] `npm run test` → 0 failures overall
- [x] `npm run build` passes

## Risk Assessment

**Risk:** Low. This is a test-only change — no production code is modified. The test becomes more accurate (it now validates the actual API contract rather than a stale one).
