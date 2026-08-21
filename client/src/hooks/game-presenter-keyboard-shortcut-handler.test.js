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

const makeGameCallbacks = () => ({
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
  // Game callbacks
  onGameHud: vi.fn(),
  onGameTimer: vi.fn(),
  onGameNext: vi.fn(),
  onGameReveal: vi.fn(),
  onGameLeaderboard: vi.fn(),
  onGamePause: vi.fn(),
  onTimerAdd: vi.fn(),
  onTimerSub: vi.fn(),
  getActiveElement: () => null,
})

describe('createKeyboardHandler with presentation-game scope', () => {
  // Game shortcuts fire when isPresenting=true AND activeGameType is set

  it('[cap:shortcut.gameHud] fires gameHud when G pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('g'))
    expect(cb.onGameHud).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.gameTimer] fires gameTimer when Space pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent(' '))
    expect(cb.onGameTimer).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.gameNext] fires gameNext when Enter pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('Enter'))
    expect(cb.onGameNext).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.gameReveal] fires gameReveal only for a game with reveal support', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'poll' })
    handler(createEvent('r'))
    expect(cb.onGameReveal).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.gameLeaderboard] fires gameLeaderboard when L pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('l'))
    expect(cb.onGameLeaderboard).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.gamePause] fires gamePause when P pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('p'))
    expect(cb.onGamePause).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.timerAdd] fires timerAdd when + pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('+'))
    expect(cb.onTimerAdd).toHaveBeenCalledTimes(1)
  })

  it('[cap:shortcut.timerSub] fires timerSub when - pressed with isPresenting=true and activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: 'jeopardy' })
    handler(createEvent('-'))
    expect(cb.onTimerSub).toHaveBeenCalledTimes(1)
  })

  it('does not register unsupported direct team-selection shortcuts', () => {
    const ids = getShortcuts({}).map((shortcut) => shortcut.id)
    expect(ids).not.toContain('teamSelect1')
    expect(ids).not.toContain('teamSelect2')
    expect(ids).not.toContain('teamSelect3')
    expect(ids).not.toContain('teamSelect4')
  })

  // Game shortcuts do NOT fire without activeGameType

  it('does NOT fire gameHud when G pressed with isPresenting=true but activeGameType=null', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: null })
    handler(createEvent('g'))
    expect(cb.onGameHud).not.toHaveBeenCalled()
  })

  it('does NOT fire gameTimer when Space pressed with isPresenting=true but activeGameType=null', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: true, activeGameType: null })
    handler(createEvent(' '))
    expect(cb.onGameTimer).not.toHaveBeenCalled()
  })

  // Active game shortcuts fire when a game element is active, even outside present mode

  it('fires gameHud when G pressed in editor mode with activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({ ...cb, shortcuts, isPresenting: false, activeGameType: 'jeopardy' })
    handler(createEvent('g'))
    expect(cb.onGameHud).toHaveBeenCalledTimes(1)
  })

  // Still respects isEditing blocking

  it('ignores game shortcuts when isEditing=true even with activeGameType set', () => {
    const cb = makeGameCallbacks()
    const shortcuts = getShortcuts({})
    const handler = createKeyboardHandler({
      ...cb,
      shortcuts,
      isPresenting: true,
      activeGameType: 'jeopardy',
      isEditing: true,
    })
    handler(createEvent('g'))
    expect(cb.onGameHud).not.toHaveBeenCalled()
  })
})
