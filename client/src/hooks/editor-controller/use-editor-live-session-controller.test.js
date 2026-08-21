import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorLiveSessionController } from './use-editor-live-session-controller'

const h = vi.hoisted(() => ({
  bridge: {
    clear: vi.fn(),
    handleMessage: vi.fn(() => false),
    isActiveFor: vi.fn(() => true),
    post: vi.fn(() => true),
    register: vi.fn(() => true),
  },
}))

vi.mock('../../utils/presenter-popup-bridge', () => ({
  createPresenterPopupBridge: () => h.bridge,
}))

vi.mock('../../utils/app-feedback', () => ({ showError: vi.fn() }))

describe('useEditorLiveSessionController game shortcut emitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the emitter and publishes the same typed action locally and to the presenter popup', () => {
    const received = []
    const listener = (event) => received.push(event.detail)
    window.addEventListener('navslides:game-shortcut', listener)

    const { result, unmount } = renderHook(() =>
      useEditorLiveSessionController({
        presentationId: 'deck-1',
        setShowLiveModal: vi.fn(),
        activeGameElement: { id: 'game-1' },
        currentGameType: 'jeopardy',
      })
    )

    act(() => result.current.emitGameShortcutAction('selectTeam', { teamIndex: 2 }))

    expect(received).toEqual([
      { action: 'selectTeam', elementId: 'game-1', gameType: 'jeopardy', teamIndex: 2 },
    ])
    expect(h.bridge.post).toHaveBeenCalledWith({
      type: 'navslides:game-shortcut',
      presentationId: 'deck-1',
      detail: received[0],
    })

    window.removeEventListener('navslides:game-shortcut', listener)
    unmount()
  })
})
