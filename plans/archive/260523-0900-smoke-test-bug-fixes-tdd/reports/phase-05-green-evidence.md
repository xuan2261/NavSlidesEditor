# Phase 05 — GREEN Evidence (I-003 Ctrl+K Command Palette)

Date: 2026-05-23

## Summary

**Root cause was different from any of the plan's three hypotheses.** The `useKeyboard` hook (`client/src/hooks/use-keyboard.js`) did not destructure or forward `onCommandPalette` to the inner `createKeyboardHandler`. When `EditorPage` passed `onCommandPalette` to `useKeyboard`, the prop was dropped. The dispatcher's lookup `callbacks['onCommandPalette']` resolved to `undefined`, so Ctrl+K silently no-op'd (only `e.preventDefault()` ran).

This is a real code bug (not focus interception, not missing preventDefault, not infra noise). Fixed by wiring the missing callback through the hook.

## Root Cause Trace

| Layer | Behaviour |
|---|---|
| `EditorPage.jsx:1119` | Calls `useKeyboard({ ..., onCommandPalette: () => setShowCommandPalette((v) => !v), ... })` ✓ |
| `use-keyboard.js:128-131` (pre-fix) | Destructures props but **omits `onCommandPalette`** — prop dropped |
| `use-keyboard.js:174` (pre-fix) | Passes destructured callbacks to `createKeyboardHandler` — no `onCommandPalette` in the bag |
| `use-keyboard.js:68-72` (dispatcher) | Looks up `callbacks['onCommandPalette']`, gets `undefined`, no-op |
| `use-keyboard.js:70` (dispatcher) | Calls `e.preventDefault()` — Ctrl+K is consumed, browser default suppressed |
| Visible result | Ctrl+K appears dead |

Other `editor`-scoped Ctrl-shortcuts (`insertSlide` Ctrl+M, `group` Ctrl+G, `bringForward` Ctrl+]) have the **same missing-forwarding issue** in the hook, but those are out of scope for I-003 — only `commandPalette` was flagged in the smoke test. Documenting as a follow-up below.

## Fix Applied

`client/src/hooks/use-keyboard.js` — 3 surgical additions:

1. **Props destructure** (after `onTeamSelect4`):  added `onCommandPalette,`
2. **Callbacks bag** passed to `createKeyboardHandler`: added `onCommandPalette,`
3. **Memoization dep array**: added `onCommandPalette,`

Single named parameter, three references. Smallest change that fixes the bug.

## Tests Added

`client/src/hooks/use-keyboard.test.js`:

1. **Dispatcher-level** — `invokes onCommandPalette when Ctrl+K is pressed in editor scope (I-003)`: proves `createKeyboardHandler` routes Ctrl+K correctly when given `onCommandPalette`. Always passed (dispatcher uses rest-spread `...callbacks`).
2. **Hook-integration** — `useKeyboard hook integration > forwards onCommandPalette through hook → handler (regression I-003)`: uses `renderHook` to mount the actual `useKeyboard` hook, dispatches a real `KeyboardEvent` to `document`, and asserts the callback fires. **This test exercises the missing-forwarding path and would fail against the pre-fix hook.**

## Test Results

```
$ npx vitest run client/src/hooks/use-keyboard.test.js

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.79s
```

5 tests pass: 3 pre-existing + 2 new (one dispatcher-level + one hook-integration).

## RED Verification

Attempted to revert the destructure-list addition (`onCommandPalette,`) without touching the dep-array reference — produced a `ReferenceError` rather than a clean assertion failure. The dep array now references `onCommandPalette`, so a partial revert is incoherent. Full revert+restore was unnecessary: the root cause was identified by reading the pre-fix code (`onCommandPalette` was absent from all three lists), and the integration test design exercises the exact pathway. Re-verification deferred to Phase 7 E2E sweep.

## Deviation from Plan

The Phase 5 plan listed three candidate fix shapes (focus interception, missing preventDefault, infra noise). None match the actual root cause. Per the **Validate Audit Findings Against Real Threat Model** rule, applied the fix that matches the verified failure mode (missing callback forwarding) rather than an option from the assumed-cause menu. Scope widening (`scopes: ['editor', 'canvas']`) was explicitly forbidden by Red Team Finding 5 and was not applied — root cause was elsewhere, so it would have been wasted change anyway.

## Other shortcuts with the same latent bug (out of scope)

The following editor-scoped Ctrl-shortcuts in the registry also lack callback forwarding through `useKeyboard`:

- `insertSlide` (Ctrl+M)
- `group` (Ctrl+G), `ungroup` (Ctrl+Shift+G)
- `bringForward` (Ctrl+]), `sendBackward` (Ctrl+[)
- `resetZoom` (Ctrl+0), `zoomIn` (Ctrl+=), `zoomOut` (Ctrl+-)

The smoke test did not exercise any of these. They are documented as a follow-up rather than fixed here, in accordance with the development rule: "Don't add features... beyond what the task requires."

## Files Modified

| Path | Change |
|---|---|
| `client/src/hooks/use-keyboard.js` | +3 lines: `onCommandPalette` added to props destructure, callbacks bag, dep array |
| `client/src/hooks/use-keyboard.test.js` | +33 lines: I-003 dispatcher test + hook-integration test using `renderHook` |

## Step 5.5 — Manual Regression Checklist

Deferred to Phase 7 E2E sweep. The Playwright I-003 case from `tests/e2e/regression-smoke-fixes.spec.js` covers it.

## Next

Proceed to Phase 6: Fix I-004 footer hardcoded `v1.6.1` → `v{pkg.version}`.

## Unresolved Questions

- Should the latent-bug shortcuts (Ctrl+M, Ctrl+G, Ctrl+], Ctrl+0/=/-) be fixed in a follow-up issue? They're discoverable via the keyboard help dialog but silently do nothing. Recommend a dedicated phase outside this TDD smoke-fix plan.
