import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SlideCanvas from '../SlideCanvas'
import { useUIStore } from '../../stores/ui-store'

const shape = (id, x) => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y: 40,
  width: 120,
  height: 80,
})

function pointer(target, type, options = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: 0,
    clientX: options.clientX ?? 50,
    clientY: options.clientY ?? 60,
    pointerId: options.pointerId ?? 7,
    pointerType: options.pointerType ?? 'touch',
    shiftKey: options.shiftKey ?? false,
  })
  fireEvent(target, event)
}

function renderCanvas({ elements = [shape('a', 40)], selectedElementIds = ['a'] } = {}) {
  const handlers = {
    onUpdateElement: vi.fn(),
    onUpdateElements: vi.fn(),
  }
  render(
    <SlideCanvas
      editor={null}
      slide={{ id: 'slide-1', elements }}
      selectedElementIds={selectedElementIds}
      editingElementId={null}
      showGrid={false}
      resolution={{ width: 960, height: 540 }}
      persistentGuides={[]}
      onToggleSelectElement={vi.fn()}
      onStartEdit={vi.fn()}
      onStopEdit={vi.fn()}
      onUpdateElement={handlers.onUpdateElement}
      onUpdateElements={handlers.onUpdateElements}
      onDeleteElement={vi.fn()}
      onDeleteSelectedElements={vi.fn()}
    />
  )
  return handlers
}

beforeEach(() => {
  vi.useFakeTimers()
  useUIStore.setState({ zoom: 1, userZoomMode: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('SlideCanvas pointer geometry transaction', () => {
  it('renders move preview without persistence and commits final geometry once', () => {
    const handlers = renderCanvas()
    const element = screen.getByTestId('slide-element-a')

    pointer(element, 'pointerdown', { clientX: 50, clientY: 60 })
    act(() => pointer(document, 'pointermove', { clientX: 90, clientY: 60 }))

    expect(element.style.left).toBe('80px')
    act(() => vi.advanceTimersByTime(2000))
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()

    act(() => pointer(document, 'pointerup', { clientX: 90, clientY: 60 }))

    expect(handlers.onUpdateElement).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdateElement).toHaveBeenCalledWith('a', { x: 80, y: 40 })
    expect(element.style.left).toBe('40px')
  })

  it('discards preview on pointercancel and ignores later owner events', () => {
    const handlers = renderCanvas()
    const element = screen.getByTestId('slide-element-a')

    pointer(element, 'pointerdown', { clientX: 50, clientY: 60 })
    act(() => pointer(document, 'pointermove', { clientX: 90, clientY: 60 }))
    expect(element.style.left).toBe('80px')

    act(() => pointer(document, 'pointercancel', { clientX: 90, clientY: 60 }))
    act(() => pointer(document, 'pointerup', { clientX: 90, clientY: 60 }))

    expect(element.style.left).toBe('40px')
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()
  })

  it('commits a multi-select move once through the batch callback', () => {
    const handlers = renderCanvas({
      elements: [shape('a', 40), shape('b', 220)],
      selectedElementIds: ['a', 'b'],
    })
    const element = screen.getByTestId('slide-element-a')

    pointer(element, 'pointerdown', { clientX: 50, clientY: 60 })
    act(() => pointer(document, 'pointermove', { clientX: 90, clientY: 60 }))
    expect(screen.getByTestId('slide-element-b').style.left).toBe('260px')
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()

    act(() => pointer(document, 'pointerup', { clientX: 90, clientY: 60 }))

    expect(handlers.onUpdateElements).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdateElements).toHaveBeenCalledWith([
      { id: 'a', x: 80, y: 40 },
      { id: 'b', x: 260, y: 40 },
    ])
  })

  it.each([
    ['resize', 'resize-handle-se'],
    ['rotate', 'rotation-handle'],
  ])('keeps %s preview local and commits once on owner pointerup', (_, testId) => {
    const handlers = renderCanvas()
    const handle = screen.getByTestId(testId)

    pointer(handle, 'pointerdown', { clientX: 150, clientY: 120 })
    act(() => pointer(document, 'pointermove', { clientX: 180, clientY: 150 }))
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()

    act(() => pointer(document, 'pointerup', { clientX: 180, clientY: 150 }))

    expect(handlers.onUpdateElement).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdateElement).toHaveBeenCalledWith(
      'a',
      expect.objectContaining(testId === 'rotation-handle' ? { rotation: expect.any(Number) } : { width: expect.any(Number), height: expect.any(Number) })
    )
  })

  it('does not commit a stationary pending press', () => {
    const handlers = renderCanvas()
    const element = screen.getByTestId('slide-element-a')

    pointer(element, 'pointerdown')
    act(() => pointer(document, 'pointerup'))

    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()
  })
})
