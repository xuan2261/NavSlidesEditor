import React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LiveViewPage from './LiveViewPage.jsx'

const mocks = vi.hoisted(() => {
  const createSocket = () => {
    const handlers = {}
    return {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      handlers,
    }
  }
  const socket = createSocket()

  return {
    createSocket,
    iframeRef: { current: null },
    roomCode: 'ROOM1',
    socket,
    socketQueue: [],
    timerStatesRef: { current: {} },
  }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mocks.socketQueue.shift() || mocks.socket),
}))
vi.mock('react-router-dom', () => ({ useParams: () => ({ roomCode: mocks.roomCode }) }))
vi.mock('../components/black-screen-overlay.jsx', () => ({ BlackScreenOverlay: () => null }))
vi.mock('../hooks/use-annotation-sync.js', () => ({ useAnnotationSync: vi.fn() }))
vi.mock('../hooks/use-live-timer-sync.js', () => ({
  useLiveTimerSync: () => mocks.timerStatesRef,
}))
vi.mock('../hooks/use-reveal-preview-frame', () => ({
  useRevealPreviewFrame: () => ({ iframeRef: mocks.iframeRef }),
}))
vi.mock('../utils/default-keyboard-shortcut-definitions-registry.js', () => ({
  getShortcuts: () => [],
}))

function deferred() {
  let resolve
  const promise = new Promise((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function jsonResponse(body) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('LiveViewPage presenter fallback polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.roomCode = 'ROOM1'
    Object.keys(mocks.socket.handlers).forEach((event) => delete mocks.socket.handlers[event])
    mocks.socket.on.mockClear()
    mocks.socket.emit.mockClear()
    mocks.socket.disconnect.mockClear()
    mocks.socketQueue.length = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not start a later presenter poll while the previous one is pending', async () => {
    const initialRoomCheck = deferred()
    const firstPresenterPoll = deferred()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initialRoomCheck.promise)
      .mockReturnValueOnce(firstPresenterPoll.promise)
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<LiveViewPage />)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      initialRoomCheck.resolve(jsonResponse({ exists: true }))
      await Promise.resolve()
    })
    act(() => mocks.socket.handlers.connect())
    await act(async () => {
      mocks.socket.handlers['presentation-data']({ html: '<section>Live</section>' })
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(2000)
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      firstPresenterPoll.resolve(jsonResponse({ exists: true, hasPresenter: true }))
      await Promise.resolve()
    })
    view.unmount()
  })

  it('does not let an earlier poll override a newer socket reconnect event', async () => {
    const initialRoomCheck = deferred()
    const firstPresenterPoll = deferred()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(initialRoomCheck.promise)
      .mockReturnValueOnce(firstPresenterPoll.promise)
    vi.stubGlobal('fetch', fetchMock)

    const view = render(<LiveViewPage />)
    await act(async () => {
      initialRoomCheck.resolve(jsonResponse({ exists: true }))
      await Promise.resolve()
    })
    act(() => mocks.socket.handlers.connect())
    await act(async () => {
      mocks.socket.handlers['presentation-data']({ html: '<section>Live</section>' })
      await Promise.resolve()
    })

    act(() => mocks.socket.handlers['presenter-disconnected']())
    expect(view.getByText('Presenter reconnecting...')).toBeTruthy()
    act(() => mocks.socket.handlers['presenter-reconnected']())
    expect(view.queryByText('Presenter reconnecting...')).toBeNull()

    await act(async () => {
      firstPresenterPoll.resolve(jsonResponse({
        exists: true,
        hasPresenter: false,
        presenterConnected: true,
      }))
      await Promise.resolve()
    })
    expect(view.queryByText('Presenter reconnecting...')).toBeNull()
    view.unmount()
  })

  it('ignores retained callbacks from a previous room socket', async () => {
    const firstSocket = mocks.createSocket()
    const secondSocket = mocks.createSocket()
    mocks.socketQueue.push(firstSocket, secondSocket)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ exists: true })))

    const view = render(<LiveViewPage />)
    await act(async () => { await Promise.resolve() })
    act(() => firstSocket.handlers.connect())
    expect(view.getByText('Waiting for presenter...')).toBeTruthy()
    expect(view.getByText('Room: ROOM1')).toBeTruthy()

    mocks.roomCode = 'ROOM2'
    view.rerender(<LiveViewPage />)
    await act(async () => { await Promise.resolve() })
    act(() => secondSocket.handlers.connect())
    expect(view.getByText('Waiting for presenter...')).toBeTruthy()
    expect(view.getByText('Room: ROOM2')).toBeTruthy()

    act(() => {
      firstSocket.handlers['presentation-data']({ html: '<section>stale</section>' })
      firstSocket.handlers.navigate({ slideIndex: 7 })
      firstSocket.handlers['presenter-left']()
      firstSocket.handlers['viewer-count']({ count: 99 })
    })

    expect(view.getByText('Waiting for presenter...')).toBeTruthy()
    expect(view.getByText('Room: ROOM2')).toBeTruthy()
    expect(view.queryByText('Presenter has left')).toBeNull()
    view.unmount()
  })
})
