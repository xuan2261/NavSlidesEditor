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

function renderCanvas({ elements = [shape('a', 40)], selectedElementIds = ['a'], smartGuidesEnabled = false } = {}) {
  const handlers = {
    onUpdateElement: vi.fn(),
    onUpdateElements: vi.fn(),
    onToggleSelectElement: vi.fn(),
  }
  render(
    <SlideCanvas
      editor={null}
      slide={{ id: 'slide-1', elements }}
      selectedElementIds={selectedElementIds}
      editingElementId={null}
      showGrid={false}
      smartGuidesEnabled={smartGuidesEnabled}
      resolution={{ width: 960, height: 540 }}
      persistentGuides={[]}
      onToggleSelectElement={handlers.onToggleSelectElement}
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

  it('scales a whole group from the primary east handle and persists it as one transaction', () => {
    const handlers = renderCanvas({
      elements: [{ ...shape('a', 40), groupId: 'g' }, { ...shape('b', 220), groupId: 'g' }],
      selectedElementIds: ['a', 'b'],
    })
    const a = screen.getByTestId('slide-element-a')
    const b = screen.getByTestId('slide-element-b')
    pointer(a.querySelector('[data-testid="resize-handle-e"]'), 'pointerdown', { clientX: 160, clientY: 80 })
    act(() => pointer(document, 'pointermove', { clientX: 220, clientY: 80 }))
    expect(a.style.width).toBe('180px')
    expect(b.style.left).toBe('310px')
    expect(b.style.width).toBe('180px')
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()
    act(() => pointer(document, 'pointerup', { clientX: 220, clientY: 80 }))
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).toHaveBeenCalledTimes(1)
    expect(handlers.onUpdateElements).toHaveBeenCalledWith([
      { id: 'a', x: 40, y: 40, width: 180, height: 80 },
      { id: 'b', x: 310, y: 40, width: 180, height: 80 },
    ])
  })

  it('rotates member centers and orientations together around the group center', () => {
    const handlers = renderCanvas({
      elements: [{ ...shape('a', 40), y: 200, groupId: 'g' }, { ...shape('b', 220), y: 200, groupId: 'g' }],
      selectedElementIds: ['a', 'b'],
    })
    const a = screen.getByTestId('slide-element-a')
    const b = screen.getByTestId('slide-element-b')
    pointer(a.querySelector('[data-testid="rotation-handle"]'), 'pointerdown', { clientX: 100, clientY: 160 })
    act(() => pointer(document, 'pointermove', { clientX: 200, clientY: 240 }))
    expect(a.style.transform).toBe('rotate(90deg)')
    expect(b.style.transform).toBe('rotate(90deg)')
    expect(Number.parseFloat(a.style.top)).toBeCloseTo(110)
    expect(Number.parseFloat(b.style.top)).toBeCloseTo(290)
    act(() => pointer(document, 'pointerup', { clientX: 200, clientY: 240 }))
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).toHaveBeenCalledTimes(1)
    const [first, second] = handlers.onUpdateElements.mock.calls[0][0]
    expect(first).toMatchObject({ id: 'a', rotation: 90 })
    expect(second).toMatchObject({ id: 'b', rotation: 90 })
    expect(first.x).toBeCloseTo(130)
    expect(second.x).toBeCloseTo(130)
    expect(second.y - first.y).toBeCloseTo(180)
  })

  it.each(['hidden', 'locked'])('does not resize a group with a %s sibling', (flag) => {
    const handlers = renderCanvas({
      elements: [{ ...shape('a', 40), groupId: 'g' }, { ...shape('b', 220), groupId: 'g', [flag]: true }],
      selectedElementIds: ['a'],
    })
    const a = screen.getByTestId('slide-element-a')
    pointer(a.querySelector('[data-testid="resize-handle-e"]'), 'pointerdown', { clientX: 160, clientY: 80 })
    act(() => pointer(document, 'pointermove', { clientX: 220, clientY: 80 }))
    act(() => pointer(document, 'pointerup', { clientX: 220, clientY: 80 }))
    expect(a.style.width).toBe('120px')
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()
  })

  it('ignores selected peers and hidden elements when attracting a batch move', () => {
    const handlers = renderCanvas({
      elements: [shape('a', 100), shape('b', 300), { ...shape('hidden', 296), hidden: true }],
      selectedElementIds: ['a', 'b'], smartGuidesEnabled: true,
    })
    pointer(screen.getByTestId('slide-element-a'), 'pointerdown', { clientX: 110, clientY: 60 })
    act(() => pointer(document, 'pointermove', { clientX: 306, clientY: 67 }))
    expect(screen.getByTestId('slide-element-a').style.left).toBe('296px')
    expect(screen.getByTestId('slide-element-b').style.left).toBe('496px')
    expect(screen.queryByTestId('smart-guide-x')).toBeNull()
    expect(screen.queryByTestId('smart-guide-y')).toBeNull()
    act(() => pointer(document, 'pointerup', { clientX: 306, clientY: 67 }))
    expect(handlers.onUpdateElements).toHaveBeenCalledWith([
      { id: 'a', x: 296, y: 47 }, { id: 'b', x: 496, y: 47 },
    ])
  })

  it.each(['chart', 'latex'])('routes selected %s preview center gestures to the canvas owner', (type) => {
    const handlers = renderCanvas({ elements: [{ ...shape('a', 40), type, content: 'x^2' }] })
    const wrapper = screen.getByTestId('slide-element-a')
    pointer(wrapper.querySelector('[data-canvas-preview-hit-area]'), 'pointerdown', { clientX: 100, clientY: 80 })
    act(() => pointer(document, 'pointermove', { clientX: 140, clientY: 80 }))
    expect(wrapper.style.left).toBe('80px')
    act(() => pointer(document, 'pointerup', { clientX: 140, clientY: 80 }))
    expect(handlers.onUpdateElement).toHaveBeenCalledWith('a', { x: 80, y: 40 })
  })

  it('rescales explicit line endpoints and control points with the resize preview and commit', () => {
    const handlers = renderCanvas({ elements: [{ ...shape('a', 40), type: 'line', y: 200,
      width: 400, height: 40, x1: 0, y1: 20, x2: 400, y2: 20, cx: 200, cy: 20 }] })
    const wrapper = screen.getByTestId('slide-element-a')
    pointer(wrapper.querySelector('[data-testid="resize-handle-e"]'), 'pointerdown', { clientX: 440, clientY: 220 })
    act(() => pointer(document, 'pointermove', { clientX: 240, clientY: 220 }))
    expect(wrapper.style.width).toBe('200px')
    act(() => pointer(document, 'pointerup', { clientX: 240, clientY: 220 }))
    expect(handlers.onUpdateElement).toHaveBeenCalledWith('a', {
      x: 40, y: 200, width: 200, height: 40, x1: 0, y1: 20, x2: 200, y2: 20, cx: 100, cy: 20,
    })
  })

  it('discards every group resize preview when its owner is cancelled', () => {
    const handlers = renderCanvas({
      elements: [{ ...shape('a', 40), groupId: 'g' }, { ...shape('b', 220), groupId: 'g' }],
      selectedElementIds: ['a', 'b'],
    })
    const a = screen.getByTestId('slide-element-a')
    const b = screen.getByTestId('slide-element-b')
    pointer(a.querySelector('[data-testid="resize-handle-e"]'), 'pointerdown', { clientX: 160, clientY: 80 })
    act(() => pointer(document, 'pointermove', { clientX: 220, clientY: 80 }))
    expect(b.style.width).toBe('180px')
    act(() => pointer(document, 'pointercancel', { clientX: 220, clientY: 80 }))
    expect(a.style.width).toBe('120px')
    expect(b.style.width).toBe('120px')
    expect(b.style.left).toBe('220px')
    act(() => pointer(document, 'pointerup', { clientX: 220, clientY: 80 }))
    expect(handlers.onUpdateElements).not.toHaveBeenCalled()
    expect(handlers.onUpdateElement).not.toHaveBeenCalled()
  })
})
