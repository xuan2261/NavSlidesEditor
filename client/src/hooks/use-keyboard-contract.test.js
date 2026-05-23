import { describe, expect, it, test, vi, afterEach } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useKeyboard } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

function parseChord(chord) {
  const parts = chord.split('+')
  const init = { bubbles: true, cancelable: true }
  const keyParts = []
  for (const p of parts) {
    if (p === 'Ctrl') init.ctrlKey = true
    else if (p === 'Shift') init.shiftKey = true
    else if (p === 'Alt') init.altKey = true
    else keyParts.push(p)
  }
  init.key = keyParts.join('+')
  return init
}

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

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
  )('%s (%s) — on<Id> callback is invoked', (id, chord) => {
    const cbName = `on${capitalize(id)}`
    const cb = vi.fn()
    renderHook(() =>
      useKeyboard({
        [cbName]: cb,
        isEditing: false,
        isPresenting: false,
        activeGameType: null,
      })
    )
    document.dispatchEvent(new KeyboardEvent('keydown', parseChord(chord)))
    expect(cb, `${cbName} must be called once for chord "${chord}"`).toHaveBeenCalledTimes(1)
  })

  it('delete — onDelete forwarded via Delete key path', () => {
    const onDelete = vi.fn()
    renderHook(() => useKeyboard({ onDelete }))
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })
    )
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('escape — onEscape forwarded via Escape key path', () => {
    const onEscape = vi.fn()
    renderHook(() => useKeyboard({ onEscape }))
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
