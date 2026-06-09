import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createKeyboardHandler, useKeyboard } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'
import { resolveLegacyEditorShortcut } from '../utils/legacy-editor-keydown-resolver'

function createEvent(key, extra = {}) {
  return { key, preventDefault: vi.fn(), ...extra }
}

const baseCallbacks = () => ({
  onCommandPalette: vi.fn(),
  onGroup: vi.fn(),
  onInsertSlide: vi.fn(),
  onArrow: vi.fn(),
  onGameHud: vi.fn(),
  onGameReveal: vi.fn(),
  onGameLeaderboard: vi.fn(),
  onGameTimer: vi.fn(),
  onTeamSelect1: vi.fn(),
  getActiveElement: () => null,
})

// ── Auto-repeat suppression for discrete chords (held key should fire once) ──
describe('discrete chord shortcuts ignore keyboard auto-repeat', () => {
  const shortcuts = getShortcuts({})

  it('does not re-toggle the command palette while Ctrl+K is held down', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({ ...cb, shortcuts })
    handler(createEvent('k', { ctrlKey: true, repeat: true }))
    expect(cb.onCommandPalette).not.toHaveBeenCalled()
  })

  it('does not re-group while Ctrl+G is held down', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({ ...cb, shortcuts })
    handler(createEvent('g', { ctrlKey: true, repeat: true }))
    expect(cb.onGroup).not.toHaveBeenCalled()
  })

  it('does not re-insert slides while Ctrl+M is held down', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({ ...cb, shortcuts })
    handler(createEvent('m', { ctrlKey: true, repeat: true }))
    expect(cb.onInsertSlide).not.toHaveBeenCalled()
  })

  it('still fires the command palette on a non-repeat Ctrl+K press', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({ ...cb, shortcuts })
    handler(createEvent('k', { ctrlKey: true, repeat: false }))
    expect(cb.onCommandPalette).toHaveBeenCalledTimes(1)
  })
})

// ── Held arrow keys must keep nudging / walking (continuous behavior) ────────
describe('held arrow keys keep dispatching for continuous nudge', () => {
  it('fires onArrow on every auto-repeat of a held arrow key', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({ ...cb, shortcuts: getShortcuts({}) })
    handler(createEvent('ArrowRight', { repeat: true }))
    handler(createEvent('ArrowRight', { repeat: true }))
    expect(cb.onArrow).toHaveBeenCalledTimes(2)
  })
})

// ── Game bare-keys that hijack canvas typing are inert while authoring ───────
describe('game bare-keys are scoped out of the authoring canvas', () => {
  const shortcuts = getShortcuts({})

  it('does not start the game timer when Space is pressed in the editor', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({
      ...cb, shortcuts, isPresenting: false, activeGameType: 'jeopardy',
    })
    handler(createEvent(' '))
    expect(cb.onGameTimer).not.toHaveBeenCalled()
  })

  it('does not select a team when a number key is pressed in the editor', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({
      ...cb, shortcuts, isPresenting: false, activeGameType: 'jeopardy',
    })
    handler(createEvent('1'))
    expect(cb.onTeamSelect1).not.toHaveBeenCalled()
  })

  it('keeps HUD, reveal and leaderboard reachable in-editor with a game element', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({
      ...cb, shortcuts, isPresenting: false, activeGameType: 'jeopardy',
    })
    handler(createEvent('g'))
    handler(createEvent('r'))
    handler(createEvent('l'))
    expect(cb.onGameHud).toHaveBeenCalledTimes(1)
    expect(cb.onGameReveal).toHaveBeenCalledTimes(1)
    expect(cb.onGameLeaderboard).toHaveBeenCalledTimes(1)
  })

  it('still starts the game timer with Space while actually presenting a game', () => {
    const cb = baseCallbacks()
    const handler = createKeyboardHandler({
      ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy',
    })
    handler(createEvent(' '))
    expect(cb.onGameTimer).toHaveBeenCalledTimes(1)
  })
})

// ── Legacy editor listener owns slide-sorter only (find/replace de-duped) ────
describe('legacy editor keydown resolver', () => {
  it('maps Ctrl+Shift+S to the slide-sorter toggle', () => {
    expect(resolveLegacyEditorShortcut({ ctrlKey: true, shiftKey: true, key: 's' })).toBe('toggle-sorter')
  })

  it('no longer claims Ctrl+F so the shortcut registry owns find/replace', () => {
    expect(resolveLegacyEditorShortcut({ ctrlKey: true, key: 'f' })).toBeNull()
  })

  it('ignores bare keys without a control modifier', () => {
    expect(resolveLegacyEditorShortcut({ key: 's', shiftKey: true })).toBeNull()
    expect(resolveLegacyEditorShortcut({ ctrlKey: true, key: 's' })).toBeNull()
  })
})

// ── Listener subscribes once and always reads the freshest callbacks ─────────
describe('useKeyboard keeps a single stable subscription with fresh callbacks', () => {
  it('does not re-subscribe the document listener across re-renders', () => {
    const add = vi.spyOn(document, 'addEventListener')
    const { rerender } = renderHook((props) => useKeyboard(props), {
      initialProps: { onCommandPalette: vi.fn() },
    })
    const initialKeydownSubs = add.mock.calls.filter((c) => c[0] === 'keydown').length
    rerender({ onCommandPalette: vi.fn() })
    rerender({ onCommandPalette: vi.fn() })
    const afterKeydownSubs = add.mock.calls.filter((c) => c[0] === 'keydown').length
    expect(afterKeydownSubs).toBe(initialKeydownSubs)
    add.mockRestore()
  })

  it('invokes the latest callback after a re-render (no stale closure)', () => {
    const stale = vi.fn()
    const fresh = vi.fn()
    const { rerender } = renderHook((props) => useKeyboard(props), {
      initialProps: { onCommandPalette: stale },
    })
    rerender({ onCommandPalette: fresh })

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })
    )

    expect(stale).not.toHaveBeenCalled()
    expect(fresh).toHaveBeenCalledTimes(1)
  })
})
