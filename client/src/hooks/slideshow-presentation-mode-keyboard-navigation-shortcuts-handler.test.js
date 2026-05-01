import { describe, expect, it, vi } from 'vitest'
import { createKeyboardHandler } from './use-keyboard'
import { getShortcuts } from '../utils/default-keyboard-shortcut-definitions-registry'

function createEvent(key, extra = {}) {
  return {
    key,
    preventDefault: vi.fn(),
    ...extra,
  }
}

describe('createKeyboardHandler with isPresenting', () => {
  // All callbacks including new slideshow ones
  const makeCallbacks = () => ({
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
    onDuplicate: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
    onToggleFindReplace: vi.fn(),
    onEscape: vi.fn(),
    onStartSlideshow: vi.fn(),
    onStartSlideshowCurrent: vi.fn(),
    onSlideNext: vi.fn(),
    onSlidePrev: vi.fn(),
    onSlideFirst: vi.fn(),
    onSlideLast: vi.fn(),
    onBlackScreen: vi.fn(),
    onWhiteScreen: vi.fn(),
    onEndSlideshow: vi.fn(),
    getActiveElement: () => null,
  })

  // ── Presentation scope shortcuts only fire when isPresenting=true ──────────
  it('fires slideNext when ArrowRight pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('ArrowRight'))

    expect(cb.onSlideNext).toHaveBeenCalledTimes(1)
  })

  it('fires slidePrev when ArrowLeft pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('ArrowLeft'))

    expect(cb.onSlidePrev).toHaveBeenCalledTimes(1)
  })

  it('fires slideFirst when Home pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('Home'))

    expect(cb.onSlideFirst).toHaveBeenCalledTimes(1)
  })

  it('fires slideLast when End pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('End'))

    expect(cb.onSlideLast).toHaveBeenCalledTimes(1)
  })

  it('fires blackScreen when B pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('b'))

    expect(cb.onBlackScreen).toHaveBeenCalledTimes(1)
  })

  it('fires whiteScreen when W pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('w'))

    expect(cb.onWhiteScreen).toHaveBeenCalledTimes(1)
  })

  it('fires endSlideshow when Escape pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('Escape'))

    expect(cb.onEndSlideshow).toHaveBeenCalledTimes(1)
  })

  // ── Editor scope shortcuts only fire when isPresenting=false ───────────────
  it('fires startSlideshow when F5 pressed in editor mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false })

    handler(createEvent('F5'))

    expect(cb.onStartSlideshow).toHaveBeenCalledTimes(1)
  })

  it('fires startSlideshowCurrent when Shift+F5 pressed in editor mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false })

    handler(createEvent('F5', { shiftKey: true }))

    expect(cb.onStartSlideshowCurrent).toHaveBeenCalledTimes(1)
  })

  // ── Scope isolation: presentation shortcuts don't fire in editor mode ────
  it('does NOT fire slideNext when ArrowRight pressed in editor mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false })

    handler(createEvent('ArrowRight'))

    expect(cb.onSlideNext).not.toHaveBeenCalled()
  })

  it('does NOT fire blackScreen when B pressed in editor mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false })

    handler(createEvent('b'))

    expect(cb.onBlackScreen).not.toHaveBeenCalled()
  })

  it('does NOT fire startSlideshow when F5 pressed in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('F5'))

    expect(cb.onStartSlideshow).not.toHaveBeenCalled()
  })

  // ── Still respects isEditing and activeElement blocking ───────────────────
  it('ignores shortcuts when isEditing=true in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, isEditing: true })

    handler(createEvent('ArrowRight'))

    expect(cb.onSlideNext).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when input is focused in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({
      ...cb,
      shortcuts,
      isPresenting: true,
      getActiveElement: () => ({ tagName: 'INPUT' }),
    })

    handler(createEvent('ArrowRight'))

    expect(cb.onSlideNext).not.toHaveBeenCalled()
  })

  // ── Ctrl chords still work in presentation mode ──────────────────────────
  it('fires undo Ctrl+Z in presentation mode', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })

    handler(createEvent('z', { ctrlKey: true }))

    expect(cb.onUndo).toHaveBeenCalledTimes(1)
  })

  // ── preventDefault called on matched shortcuts ────────────────────────────
  it('calls preventDefault when slideNext fires', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true })
    const event = createEvent('ArrowRight')

    handler(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })

  it('calls preventDefault when startSlideshow fires', () => {
    const cb = makeCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false })
    const event = createEvent('F5')

    handler(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
