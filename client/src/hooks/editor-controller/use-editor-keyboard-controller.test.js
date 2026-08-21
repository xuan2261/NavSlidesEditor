import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEditorKeyboardController } from './use-editor-keyboard-controller'

function createController(overrides = {}) {
  return {
    disabled: false,
    editingElementId: null,
    currentGameType: 'name-picker',
    isPresenterPopupActive: () => true,
    activeGameElement: { id: 'game-1', gameType: 'name-picker' },
    emitGameShortcutAction: vi.fn(),
    ...overrides,
  }
}

function press(key) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('useEditorKeyboardController presenter popup scope', () => {
  it('enables configured game shortcuts only while its matching popup remains active', () => {
    const active = createController()
    const inactive = createController({ isPresenterPopupActive: () => false })
    const activeHook = renderHook(() => useEditorKeyboardController(active))

    press(' ')
    expect(active.emitGameShortcutAction).toHaveBeenCalledWith('startSpin', {})

    activeHook.unmount()
    const inactiveHook = renderHook(() => useEditorKeyboardController(inactive))
    press(' ')

    expect(inactive.emitGameShortcutAction).not.toHaveBeenCalled()
    inactiveHook.unmount()
  })

  it('routes timer commands through the presenter popup contract', () => {
    const controller = createController({
      currentGameType: 'hot-potato',
      activeGameElement: { id: 'game-2', gameType: 'hot-potato', timerDuration: 45 },
    })
    const hook = renderHook(() => useEditorKeyboardController(controller))

    press(' ')
    press('p')

    expect(controller.emitGameShortcutAction).toHaveBeenNthCalledWith(1, 'startTimer', { duration: 45 })
    expect(controller.emitGameShortcutAction).toHaveBeenNthCalledWith(2, 'pauseGame', {})
    hook.unmount()
  })

  it('keeps editor shortcuts active while the presenter popup is open', () => {
    const controller = createController({
      handleManualSave: vi.fn(),
      selectedElementIdsRef: { current: [] },
      activeSlideRef: { current: { elements: [] } },
      presentation: { slides: [{ id: 'slide-1' }] },
      setCurrentSlideIndex: vi.fn(),
      showCommandPalette: false,
      showGameHud: false,
      showGameLeaderboard: false,
      setShowCommandPalette: vi.fn(),
      setShowGameHud: vi.fn(),
      setShowGameLeaderboard: vi.fn(),
      setSelectedElementIds: vi.fn(),
      setEditingElementId: vi.fn(),
    })
    const hook = renderHook(() => useEditorKeyboardController(controller))

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }))
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      }))
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }))
    })

    expect(controller.handleManualSave).toHaveBeenCalledTimes(1)
    expect(controller.setCurrentSlideIndex).toHaveBeenCalledTimes(1)
    expect(controller.setSelectedElementIds).toHaveBeenCalledWith([])
    expect(controller.setEditingElementId).toHaveBeenCalledWith(null)
    hook.unmount()
  })
})
