import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpeakerViewPage from './SpeakerViewPage.jsx'

const mocks = vi.hoisted(() => {
  const handlers = {}
  const socket = {
    on: vi.fn((event, handler) => { handlers[event] = handler }),
    off: vi.fn((event) => { delete handlers[event] }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    handlers,
  }
  return { socket }
})

vi.mock('socket.io-client', () => ({ io: vi.fn(() => mocks.socket) }))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ roomCode: 'ROOM1' }),
}))
vi.mock('../hooks/use-keyboard', () => ({ useKeyboard: vi.fn() }))
vi.mock('../hooks/use-reveal-preview-frame', () => ({
  useRevealPreviewFrame: () => ({ iframeRef: { current: null } }),
}))
vi.mock('../components/annotation-toolbar.jsx', () => ({
  AnnotationToolbar: ({ onToolChange }) => (
    <button type="button" onClick={() => onToolChange('pen')}>Pen</button>
  ),
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
    Object.keys(mocks.socket.handlers).forEach((event) => delete mocks.socket.handlers[event])
    mocks.socket.on.mockClear()
    mocks.socket.off.mockClear()
    mocks.socket.emit.mockClear()
    mocks.socket.disconnect.mockClear()
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
})
