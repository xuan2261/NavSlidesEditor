import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpeakerViewPage from './SpeakerViewPage.jsx'

const mocks = vi.hoisted(() => {
  const createSocket = () => {
    const listeners = {}
    const handlers = {}
    const reset = () => {
      Object.keys(listeners).forEach((event) => delete listeners[event])
      Object.keys(handlers).forEach((event) => delete handlers[event])
    }
    return {
      on: vi.fn((event, handler) => {
        listeners[event] ||= new Set()
        listeners[event].add(handler)
        handlers[event] = (...args) => {
          listeners[event]?.forEach((listener) => listener(...args))
        }
      }),
      off: vi.fn((event, handler) => {
        if (!listeners[event]) return
        if (handler) listeners[event].delete(handler)
        else listeners[event].clear()
        if (listeners[event].size === 0) {
          delete listeners[event]
          delete handlers[event]
        }
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      handlers,
      reset,
    }
  }
  const socket = createSocket()
  return { createSocket, socket, socketQueue: [], roomCode: 'ROOM1' }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mocks.socketQueue.shift() || mocks.socket),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ roomCode: mocks.roomCode }),
}))
vi.mock('../hooks/use-keyboard', () => ({ useKeyboard: vi.fn() }))
vi.mock('../hooks/use-reveal-preview-frame', () => ({
  useRevealPreviewFrame: () => ({ iframeRef: { current: null } }),
}))
vi.mock('../components/annotation-toolbar.jsx', () => ({
  AnnotationToolbar: ({ onToolChange }) => onToolChange ? (
    <button type="button" onClick={() => onToolChange('pen')}>Pen</button>
  ) : null,
}))

class MockPointerEvent extends Event {
  constructor(type, props) {
    super(type, props)
    this.clientX = props?.clientX ?? 0
    this.clientY = props?.clientY ?? 0
    this.pointerId = props?.pointerId ?? 1
  }
}

describe('SpeakerViewPage annotations', () => {
  beforeEach(() => {
    mocks.roomCode = 'ROOM1'
    mocks.socket.reset()
    mocks.socket.on.mockClear()
    mocks.socket.off.mockClear()
    mocks.socket.emit.mockClear()
    mocks.socket.disconnect.mockClear()
    mocks.socketQueue.length = 0
    window.PointerEvent = MockPointerEvent
    SVGElement.prototype.setPointerCapture = vi.fn()
    SVGElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 200,
    }))
  })

  async function renderConnectedSpeaker() {
    const view = render(<SpeakerViewPage />)
    act(() => mocks.socket.handlers.connect())
    await waitFor(() => expect(view.container.querySelector('.annotation-canvas')).not.toBeNull())
    return view
  }

  it('renders legacy pixel paths separately from normalized paths', async () => {
    const { container } = await renderConnectedSpeaker()

    act(() => {
      mocks.socket.handlers['annotations:sync']({
        slideAnnotations: {
          0: [
            { id: 'legacy', d: 'M 100 50 L 300 150', color: '#f00' },
            {
              id: 'normalized',
              d: 'M 0.25 0.25 L 0.75 0.75',
              color: '#0f0',
              coordinateSpace: 'normalized',
            },
          ],
        },
      })
    })

    const legacyOverlay = container.querySelector('[data-testid="speaker-legacy-annotation-overlay"]')
    const normalizedCanvas = container.querySelector('.annotation-canvas')
    expect(legacyOverlay).not.toBeNull()
    expect(legacyOverlay.querySelector('path').getAttribute('d')).toBe('M 100 50 L 300 150')
    expect(normalizedCanvas.querySelectorAll('path')).toHaveLength(1)
    expect(normalizedCanvas.querySelector('path').getAttribute('d')).toBe('M 0.25 0.25 L 0.75 0.75')
  })

  it('keeps one local stroke when the server echoes the same annotation', async () => {
    const { container, getByRole } = await renderConnectedSpeaker()
    act(() => mocks.socket.handlers['presenter-status']({
      hasPresenter: true,
      presenterConnected: true,
    }))
    fireEvent.click(getByRole('button', { name: 'Pen' }))
    const canvas = container.querySelector('.annotation-canvas')

    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 150, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 150, pointerId: 1 })

    const addCall = mocks.socket.emit.mock.calls.find(([event]) => event === 'annotation:add')
    expect(addCall).toBeDefined()
    act(() => mocks.socket.handlers['annotation:add'](addCall[1]))

    expect(container.querySelector('.annotation-canvas').querySelectorAll('path')).toHaveLength(1)

    act(() => {
      mocks.socket.handlers['annotation:add']({
        slideIndex: 0,
        annotation: {
          ...addCall[1].annotation,
          id: 'another-presenter-stroke',
          d: 'M 0.1 0.1 L 0.2 0.2',
        },
      })
    })
    expect(container.querySelector('.annotation-canvas').querySelectorAll('path')).toHaveLength(2)
  })

  it('shows a reconnecting state without ending the session on presenter disconnect', async () => {
    const view = await renderConnectedSpeaker()

    act(() => mocks.socket.handlers['presenter-status']({
      hasPresenter: false,
      presenterConnected: true,
    }))
    expect(view.getByText('Presenter reconnecting...')).toBeTruthy()

    act(() => mocks.socket.handlers['presenter-status']({
      hasPresenter: true,
      presenterConnected: true,
    }))
    expect(view.queryByText('Presenter reconnecting...')).toBeNull()

    act(() => mocks.socket.handlers['presenter-disconnected']())
    expect(view.getByText('Presenter reconnecting...')).toBeTruthy()

    act(() => mocks.socket.handlers['presenter-reconnected']())
    expect(view.queryByText('Presenter reconnecting...')).toBeNull()
  })

  it('disables slide navigation until a presenter is available', async () => {
    const view = await renderConnectedSpeaker()

    act(() => mocks.socket.handlers['presentation-meta']({
      slideCount: 1,
      slides: [{ slideIndex: 0, verticalIndex: 0, label: '1', title: 'Slide 1' }],
    }))

    const slideButton = await view.findByRole('button', { name: '1' })
    expect(slideButton.disabled).toBe(true)
    fireEvent.click(slideButton)
    expect(mocks.socket.emit.mock.calls.some(([event]) => event === 'control-navigate')).toBe(false)

    act(() => mocks.socket.handlers['presenter-status']({
      hasPresenter: true,
      presenterConnected: true,
    }))
    expect(slideButton.disabled).toBe(false)

    fireEvent.click(slideButton)
    expect(mocks.socket.emit.mock.calls.some(([event]) => event === 'control-navigate')).toBe(true)
  })

  it('does not emit annotations after the presenter disappears', async () => {
    const { container, getByRole } = await renderConnectedSpeaker()
    act(() => mocks.socket.handlers['presenter-status']({
      hasPresenter: true,
      presenterConnected: true,
    }))
    fireEvent.click(getByRole('button', { name: 'Pen' }))
    act(() => mocks.socket.handlers['presenter-disconnected']())

    const canvas = container.querySelector('.annotation-canvas')
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 150, pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 150, pointerId: 1 })

    expect(mocks.socket.emit.mock.calls.some(([event]) => event === 'annotation:add')).toBe(false)
  })

  it('shows a terminal state when the room ends', async () => {
    const view = await renderConnectedSpeaker()

    act(() => mocks.socket.handlers['room-ended']())
    expect(view.getByText('Session ended')).toBeTruthy()
  })

  it('clears terminal room state before joining a different room in place', async () => {
    const view = await renderConnectedSpeaker()
    act(() => mocks.socket.handlers['room-ended']())
    expect(view.getByText('Session ended')).toBeTruthy()

    mocks.roomCode = 'ROOM2'
    view.rerender(<SpeakerViewPage />)
    expect(view.queryByText('Session ended')).toBeNull()
    expect(mocks.socket.disconnect).toHaveBeenCalled()

    act(() => mocks.socket.handlers.connect())
    const joinCall = mocks.socket.emit.mock.calls.filter(([event]) => event === 'join-room').at(-1)
    expect(joinCall[1]).toMatchObject({ roomId: 'ROOM2', role: 'controller' })
  })

  it('ignores retained callbacks from a previous room socket', async () => {
    const firstSocket = mocks.createSocket()
    const secondSocket = mocks.createSocket()
    mocks.socketQueue.push(firstSocket, secondSocket)

    const view = render(<SpeakerViewPage />)
    act(() => firstSocket.handlers.connect())
    await waitFor(() => expect(view.getByText('Waiting for presenter...')).toBeTruthy())

    mocks.roomCode = 'ROOM2'
    view.rerender(<SpeakerViewPage />)
    act(() => secondSocket.handlers.connect())
    await waitFor(() => expect(view.getByText('Waiting for presenter...')).toBeTruthy())

    act(() => {
      firstSocket.handlers['presentation-meta']({
        slideCount: 1,
        slides: [{ slideIndex: 0, verticalIndex: 0, label: 'stale', title: 'Stale' }],
      })
      firstSocket.handlers['presentation-data']({ html: '<section>stale</section>' })
      firstSocket.handlers['navigate']({ slideIndex: 8 })
      firstSocket.handlers['presenter-left']()
      firstSocket.handlers['viewer-count']({ count: 99 })
    })

    expect(view.queryByRole('button', { name: 'stale' })).toBeNull()
    expect(view.container.querySelector('iframe')).toBeNull()
    expect(view.getByText(/^Slide 1$/)).toBeTruthy()
    expect(view.queryByText('Presenter has left')).toBeNull()
  })
})
