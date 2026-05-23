# Contract Test Pattern — Keyboard Shortcut Registry vs Hook Forwarding

**Date:** 2026-05-23  
**Researcher:** researcher-01

---

## Recommended Approach: A — `test.each(editorScopeShortcuts)`

**Rationale:** Approach A fails with a named test per shortcut (e.g., `"insertSlide (Ctrl+M) — callback forwarded"`), making CI output immediately actionable. Approach B gives the same runtime coverage but hides which shortcut broke. Approach C catches the static destructure omission but skips the actual `createKeyboardHandler` dispatch path — it would not catch a regression where the callback is destructured but not forwarded into the handler. A exercises the full signal path: registry → hook destructure → `createKeyboardHandler` spread → `callbacks[cbName]?.()`. Cost vs B: negligible. Cost vs C: adds real event dispatch, but `parseChord()` (see below) makes that straightforward.

---

## `parseChord(chord)` — How to Build `KeyboardEvent` Init from Registry Keys

`normalizeKey(e)` in `shortcut-normalizer.js` constructs: `[...mods, key].join('+')` where:
- `Ctrl` from `e.ctrlKey || e.metaKey`
- `Shift` from `e.shiftKey`
- `Alt` from `e.altKey`
- `key` = `e.key.toUpperCase()` if `e.key.length === 1`, else `e.key` as-is

So to reconstruct a `KeyboardEvent` init object that round-trips correctly:

```js
function parseChord(chord) {
  const parts = chord.split('+')
  const init = { bubbles: true, cancelable: true }
  const keyParts = []
  for (const p of parts) {
    if (p === 'Ctrl')  { init.ctrlKey = true }
    else if (p === 'Shift') { init.shiftKey = true }
    else if (p === 'Alt')   { init.altKey = true }
    else keyParts.push(p)
  }
  // Re-join non-modifier parts (handles "Ctrl+Shift+G" → key "G")
  init.key = keyParts.join('+')
  return init
}
```

**JSDOM concern:** `new KeyboardEvent('keydown', { ctrlKey: true, key: 'C', ... })` — JSDOM correctly populates `e.ctrlKey`, `e.shiftKey`, `e.key` from the init dict. Verified via the existing test at line 117–126 of `use-keyboard.test.js` which already uses `new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })` successfully. No issues.

**Tricky chords and their `key` values (verified against normalizer logic):**

| Registry `defaultKey` | `key` init value | Notes |
|---|---|---|
| `Ctrl+=` | `=` | Single char → uppercased to `=`; JSDOM emits `key: "="` correctly |
| `Ctrl+-` | `-` | Same; key stays `-` |
| `Ctrl+]` | `]` | Same; key stays `]` |
| `Ctrl+[` | `[` | Same; key stays `[` |
| `Ctrl+Shift+G` | `G` | shiftKey=true; normalizer uppercases single-char key → `G`; result `Ctrl+Shift+G` |
| `Ctrl+0` | `0` | Single char digit → uppercase `0`; matches `Ctrl+0` |
| `F5` | `F5` | len > 1, no mods → normalizer returns `F5` directly |
| `Shift+F5` | `F5` | shiftKey=true, key `F5` → `Shift+F5` |

`parseChord` handles all of these correctly because it splits on `+` and joins remaining tokens as `key`. For `Ctrl+=`, splitting `Ctrl+=` on `+` yields `['Ctrl', '=']`, so `key='='`. For `Ctrl+Shift+G`, splitting yields `['Ctrl', 'Shift', 'G']`, mods consumed, `key='G'`. For `F5`, no mods, `key='F5'`. For `Shift+F5`, `shiftKey=true`, `key='F5'`.

---

## Full Contract Test Template

```js
// client/src/hooks/use-keyboard-contract.test.js
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { useKeyboard } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

/**
 * Parses a chord string (e.g. "Ctrl+Shift+G") into KeyboardEvent init.
 * Mirrors the inverse of normalizeKey() in shortcut-normalizer.js.
 */
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

// Editor-scope shortcuts: those with scopes including 'editor' (pure editor)
// or 'canvas' (which is also active in editor mode per createKeyboardHandler line 40-41).
// Contract: every such shortcut must have its on<Id> callback forwarded.
const EDITOR_SHORTCUTS = getShortcuts({}).filter(
  (s) => s.scopes.includes('editor') || s.scopes.includes('canvas')
)

// Shortcuts handled by special-case code paths outside on<Id> dispatch:
//   - 'delete' uses e.key === 'Delete' branch (line 76-80 of use-keyboard.js)
//   - 'escape' uses e.key === 'Escape' branch (line 83-85)
//   These are still verified but via their own event shape.
const SKIP_CHORD_DISPATCH = new Set(['delete', 'escape'])

describe('contract: every editor-scope shortcut in registry is forwarded by useKeyboard', () => {
  afterEach(() => cleanup())

  test.each(
    EDITOR_SHORTCUTS
      .filter((s) => !SKIP_CHORD_DISPATCH.has(s.id))
      .map((s) => [s.id, s.activeKey, s])
  )('%s (%s) — on%s callback is invoked', (id, chord, shortcut) => {
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)
    const cbName = `on${capitalize(id)}`
    const cb = vi.fn()

    renderHook(() => useKeyboard({
      [cbName]: cb,
      isEditing: false,
      isPresenting: false,
      activeGameType: null,
    }))

    const eventInit = parseChord(chord)
    document.dispatchEvent(new KeyboardEvent('keydown', eventInit))

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

---

## Failure-Mode List: 8 Currently Missing Shortcuts

Each of these will fail with `Expected onXxx to have been called 1 time, but was called 0 times`:

| Shortcut ID | Chord | Missing callback |
|---|---|---|
| `insertSlide` | `Ctrl+M` | `onInsertSlide` |
| `group` | `Ctrl+G` | `onGroup` |
| `ungroup` | `Ctrl+Shift+G` | `onUngroup` |
| `bringForward` | `Ctrl+]` | `onBringForward` |
| `sendBackward` | `Ctrl+[` | `onSendBackward` |
| `resetZoom` | `Ctrl+0` | `onResetZoom` |
| `zoomIn` | `Ctrl+=` | `onZoomIn` |
| `zoomOut` | `Ctrl+-` | `onZoomOut` |

All 8 are in `DEFAULT_SHORTCUTS` with `scopes: ['editor']`, their `activeKey` matches their `defaultKey` (no overrides), and `createKeyboardHandler` dispatches via `callbacks[cbName]?.()` which silently no-ops when `cbName` is not destructured by `useKeyboard`. `e.preventDefault()` fires regardless (the `if (shortcut) { ... e.preventDefault() }` block at line 67-72 of the hook).

---

## Edge Cases

**`Ctrl+=` on non-US keyboards:** Some keyboards emit `key: "+"` for the equals key when Shift is not held. `parseChord('Ctrl+=')` produces `key: "="`. If a user's keyboard emits `key: "+"` for this chord, the shortcut won't fire — but this is a pre-existing registry/normalizer concern, not a test concern. Tests run in JSDOM which uses the `key` value you pass explicitly, so `key: "="` is deterministic.

**`parseChord` splitting `Ctrl+=`:** `'Ctrl+='.split('+')` → `['Ctrl', '=']` — correct, `key` becomes `=`.

**`parseChord` splitting `Ctrl+Shift+G`:** `'Ctrl+Shift+G'.split('+')` → `['Ctrl', 'Shift', 'G']` — correct.

**ESM module caching:** `getShortcuts(loadOverrides())` is a pure computation over `DEFAULT_SHORTCUTS` with no side effects. No `vi.resetModules()` needed between cases. `renderHook` + `afterEach(cleanup)` is sufficient for isolation — each render installs a fresh `document.addEventListener` listener and `cleanup()` unmounts, triggering the `useEffect` teardown which removes it.

**`teamSelect` explicit map:** The hook uses an `explicitMap` for camelCase ids (`teamSelect1..4`). These are `presentation-game` scope only, so they do not appear in `EDITOR_SHORTCUTS` and are not tested by this contract test. A separate contract test for presentation-game scope would be the right place.

---

## What This Research Did Not Cover

- Whether `EditorPage.jsx` passes the 8 missing callbacks to `useKeyboard` (that is Phase 2 fix work, not contract test design).
- Presentation-scope and canvas-scope contract tests (separate concern).
- Override/localStorage path — contract test uses `getShortcuts({})` (no overrides), which is the correct baseline.
