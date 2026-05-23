---
phase: 1
title: "RED Contract Test + Wiring Test"
status: completed
priority: P0
effort: "3-4h"
dependencies: []
---

# Phase 1: RED Contract Test + Wiring Test

## Overview

Author the RED failing contract test:
- Registry-driven, asserts every editor-scope shortcut in `default-keyboard-shortcut-definitions-registry.js` is forwarded by `useKeyboard`.
- Filter: `scopes.includes('editor') || scopes.includes('canvas')`.
- Pre-fix: fails for exactly these 8 IDs — `insertSlide`, `group`, `ungroup`, `bringForward`, `sendBackward`, `resetZoom`, `zoomIn`, `zoomOut`. Other editor/canvas-scope shortcuts (copy, cut, paste, duplicate, undo, redo, selectAll, toggleFindReplace, escape, delete, commandPalette) stay green.
- Post-Phase-2/3: full table green.

## Red-Team Adjustments (Session 1 — 2026-05-23)

- **F3:** Pre-fix RED expectation is exactly 8 named IDs (enumerated above). Document explicitly so reviewers can verify against `test.each` output.
- **F6:** `parseChord` round-trip VERIFIED against `normalizeKey` for all 8 chord strings — drop JSDOM fallback hedge.
- **F9:** Removed the "wiring smoke test" in step 1.2 — JS does not throw on extra hook props, so the test would pass trivially before any fix. Contract test is the only signal needed.

## Requirements

### Functional
- Contract test enumerates editor-scope shortcuts via `getShortcuts({}).filter(s => s.scopes.includes('editor') || s.scopes.includes('canvas'))`.
- Uses `test.each` for per-shortcut failure clarity.
- Dispatches real `KeyboardEvent` on `document` and asserts callback invoked once.
- Skips `delete`/`escape` (special-case paths) — covered by dedicated `it()` blocks.
- Wiring test imports EditorPage's `useKeyboard` consumer-shape via a lightweight inspection (mock `useKeyboard` and assert callbacks bag contains the 8 keys).

### Non-functional
- Tests must pass when Phase 2+3 turn GREEN; no flakiness across runs.
- ESM-safe: no `require.cache` hackery (Vitest is ESM).
- JSDOM-only — no browser dependency.

## Architecture

**`parseChord(chord)` — inverse of `normalizeKey`:**
- Splits on `+`, consumes `Ctrl|Shift|Alt` as modifier flags, joins remaining tokens as `key`.
- Handles `Ctrl+Shift+G` → `{ ctrlKey: true, shiftKey: true, key: 'G' }`, `Ctrl+=` → `{ ctrlKey: true, key: '=' }`, `F5` → `{ key: 'F5' }`.

**Test isolation:** `renderHook` + `afterEach(cleanup)` — each render installs fresh listener, cleanup unmounts and removes it.

## Related Code Files

- **Create:** `client/src/hooks/use-keyboard-contract.test.js`
- **Modify:** `client/src/hooks/use-keyboard.test.js` (append wiring test block, do not rewrite existing tests)
- **Read for context:** `client/src/hooks/use-keyboard.js`, `client/src/utils/default-keyboard-shortcut-definitions-registry.js`, `client/src/utils/shortcut-normalizer.js`

## Implementation Steps

### 1.1 — Create contract test (`use-keyboard-contract.test.js`)

```js
// client/src/hooks/use-keyboard-contract.test.js
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useKeyboard } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

function parseChord(chord) {
  const parts = chord.split('+')
  const init = { bubbles: true, cancelable: true }
  const keyParts = []
  for (const p of parts) {
    if (p === 'Ctrl')       init.ctrlKey = true
    else if (p === 'Shift') init.shiftKey = true
    else if (p === 'Alt')   init.altKey = true
    else                    keyParts.push(p)
  }
  init.key = keyParts.join('+')
  return init
}

const EDITOR_SHORTCUTS = getShortcuts({}).filter(
  (s) => s.scopes.includes('editor') || s.scopes.includes('canvas')
)
const SKIP_CHORD_DISPATCH = new Set(['delete', 'escape'])

describe('contract: every editor-scope shortcut in registry is forwarded by useKeyboard', () => {
  afterEach(() => cleanup())

  test.each(
    EDITOR_SHORTCUTS
      .filter((s) => !SKIP_CHORD_DISPATCH.has(s.id))
      .map((s) => [s.id, s.activeKey])
  )('%s (%s) — on{Id} callback is invoked', (id, chord) => {
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)
    const cbName = `on${capitalize(id)}`
    const cb = vi.fn()
    renderHook(() => useKeyboard({
      [cbName]: cb,
      isEditing: false,
      isPresenting: false,
      activeGameType: null,
    }))
    document.dispatchEvent(new KeyboardEvent('keydown', parseChord(chord)))
    expect(cb, `${cbName} must be called once for chord "${chord}"`).toHaveBeenCalledTimes(1)
  })

  it('delete — onDelete forwarded via Delete key path', () => {
    const onDelete = vi.fn()
    renderHook(() => useKeyboard({ onDelete }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('escape — onEscape forwarded via Escape key path', () => {
    const onEscape = vi.fn()
    renderHook(() => useKeyboard({ onEscape }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
```

### 1.2 — Verify RED state (renumbered from 1.3, prior step removed per Red-Team F9)

Run `npx vitest run client/src/hooks/use-keyboard-contract.test.js`. Expected:
- Exactly 8 failing subtests, IDs: `insertSlide`, `group`, `ungroup`, `bringForward`, `sendBackward`, `resetZoom`, `zoomIn`, `zoomOut`.
- All other editor/canvas-scope shortcuts pass: `copy`, `cut`, `paste`, `duplicate`, `undo`, `redo`, `selectAll`, `toggleFindReplace`, `commandPalette` (proves the harness works).
- `delete`/`escape` pass via dedicated `it()` blocks (direct key-branch dispatch in hook).

If the failure count is anything other than 8, STOP and reconcile — either the registry has drifted or the test has a bug. Document failure count in commit message: "RED: 8 editor-scope shortcuts unforwarded".

## Success Criteria

- [x] `use-keyboard-contract.test.js` exists, `test.each` enumerates from registry.
- [x] Running the test reports exactly 8 failures matching the 8 known shortcut IDs (no more, no less).
- [x] `parseChord` correctly produces init dicts for `Ctrl+=`, `Ctrl+-`, `Ctrl+]`, `Ctrl+[`, `Ctrl+Shift+G`, `Ctrl+0`, `Ctrl+M`, `Ctrl+G`.
- [x] No false positives: any non-editor-scope shortcut absent from the filtered list.
- [x] No existing tests broken in `use-keyboard.test.js`.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `Ctrl+=` JSDOM dispatch | RESOLVED — `parseChord` produces `key: '='`; JSDOM honors init dict regardless of platform keyboard layout. Pattern verified by existing I-003 test at line 117-126 of `use-keyboard.test.js`. No fallback needed. |
| Adding `canvas` scope filter may pick up shortcuts that special-case in handler | Verified: `createKeyboardHandler` line 40-41 treats `canvas` scope active when in editor; no special-case path bypasses callback dispatch. |
| Future presenter-scope shortcuts mistakenly match filter | Filter is explicit on `'editor'` or `'canvas'` only. Presenter-only scopes (`'presentation-game'`) excluded by design. |
| Test imports trigger registry side effects in CI | `getShortcuts({})` is pure (no overrides, no localStorage read). Safe. |

## Next Steps

After RED is confirmed: Phase 2 (hook forwarding) and Phase 3 (EditorPage wiring) can run in parallel by file ownership.
