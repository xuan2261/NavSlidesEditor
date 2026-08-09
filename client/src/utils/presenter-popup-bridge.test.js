import { describe, expect, it, vi } from 'vitest'
import { createPresenterPopupBridge } from './presenter-popup-bridge'

const origin = 'https://app.test'

function createPopup() {
  return { closed: false, postMessage: vi.fn() }
}

function createShortcutMessage(presentationId = 'deck-a', roomCode = 'ROOM-A') {
  return {
    type: 'navslides:game-shortcut',
    presentationId,
    roomCode,
    detail: { action: 'startPoll', elementId: 'game-1', gameType: 'poll' },
  }
}

describe('presenter popup bridge', () => {
  it('queues a scoped shortcut until the matching popup proves ready', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)
    const message = createShortcutMessage()

    expect(bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })).toBe(true)
    expect(bridge.post(message)).toBe(true)
    expect(popup.postMessage).not.toHaveBeenCalled()

    expect(bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-b', roomCode: 'ROOM-A' },
    })).toBe(false)
    expect(popup.postMessage).not.toHaveBeenCalled()

    expect(bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(true)
    expect(popup.postMessage).toHaveBeenCalledWith(message, origin)

    bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })
    expect(popup.postMessage).toHaveBeenCalledTimes(1)
  })

  it('queues commands across a same-window reload until the replacement document is ready', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)
    const message = createShortcutMessage()

    bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })
    bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })
    expect(bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-unready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(true)

    expect(bridge.post(message)).toBe(true)
    expect(popup.postMessage).not.toHaveBeenCalled()

    expect(bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(true)
    expect(popup.postMessage).toHaveBeenCalledWith(message, origin)

    bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })
    expect(popup.postMessage).toHaveBeenCalledTimes(1)
  })

  it('never routes a deck B command through deck A popup state', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)

    bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })

    expect(bridge.post(createShortcutMessage('deck-b', 'ROOM-B'))).toBe(false)
    expect(popup.postMessage).not.toHaveBeenCalled()
  })

  it('keeps the launched room authoritative when a later launch is cancelled', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)
    bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })
    bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })

    bridge.post(createShortcutMessage('deck-a', 'ROOM-B'))

    expect(popup.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ presentationId: 'deck-a', roomCode: 'ROOM-A' }),
      origin
    )
  })

  it('rejects an unready message from another window without dropping readiness', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)
    bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })
    bridge.handleMessage({
      origin,
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })

    expect(bridge.handleMessage({
      origin,
      source: createPopup(),
      data: { type: 'navslides:presenter-unready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(false)
    expect(bridge.post(createShortcutMessage())).toBe(true)
    expect(popup.postMessage).toHaveBeenCalledTimes(1)
  })

  it('rejects readiness messages from another window or origin', () => {
    const popup = createPopup()
    const bridge = createPresenterPopupBridge(origin)
    bridge.register({ presenterWindow: popup, presentationId: 'deck-a', roomCode: 'ROOM-A' })

    expect(bridge.handleMessage({
      origin: 'https://evil.test',
      source: popup,
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(false)
    expect(bridge.handleMessage({
      origin,
      source: createPopup(),
      data: { type: 'navslides:presenter-ready', presentationId: 'deck-a', roomCode: 'ROOM-A' },
    })).toBe(false)
    expect(bridge.post(createShortcutMessage())).toBe(true)
    expect(popup.postMessage).not.toHaveBeenCalled()
  })
})
