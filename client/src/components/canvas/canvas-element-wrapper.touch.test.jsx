import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SlideCanvas from '../SlideCanvas'
import { useUIStore } from '../../stores/ui-store'
import CanvasElement from './canvas-element-wrapper'

const shape = (id, x) => ({
  id,
  type: 'shape',
  shape: 'rect',
  x,
  y: 40,
  width: 120,
  height: 80,
})

function renderSlide({ elements, selectedElementIds }) {
  const handlers = {
    onToggleSelectElement: vi.fn(),
    onStartEdit: vi.fn(),
    onUpdateElement: vi.fn(),
    onUpdateElements: vi.fn(),
  }
  render(
    <SlideCanvas
      editor={null}
      slide={{ id: 's1', elements }}
      selectedElementIds={selectedElementIds}
      editingElementId={null}
      showGrid={false}
      resolution={{ width: 960, height: 540 }}
      persistentGuides={[]}
      onToggleSelectElement={handlers.onToggleSelectElement}
      onStartEdit={handlers.onStartEdit}
      onStopEdit={vi.fn()}
      onUpdateElement={handlers.onUpdateElement}
      onUpdateElements={handlers.onUpdateElements}
      onDeleteElement={vi.fn()}
      onDeleteSelectedElements={vi.fn()}
    />
  )
  return handlers
}

function dispatchTouchPointer(target, type, options = {}) {
  const event = new PointerEvent(type, {
    bubbles: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 40,
    clientY: options.clientY ?? 50,
    pointerId: options.pointerId ?? 7,
    pointerType: 'touch',
  })
  Object.defineProperty(event, 'shiftKey', { value: options.shiftKey ?? false })
  fireEvent(target, event)
  return event
}

beforeEach(() => {
  vi.useFakeTimers()
  useUIStore.setState({ zoom: 1 })
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('CanvasElement touch pointer consumer path', () => {
  it.each([
    ['normal', false],
    ['Shift', true],
  ])('delivers a stationary move %s click to the real selection consumer', (_, shiftKey) => {
    const handlers = renderSlide({
      elements: [shape('a', 40), shape('b', 220)],
      selectedElementIds: ['a'],
    })
    const target = screen.getByTestId(shiftKey ? 'slide-element-b' : 'slide-element-a')

    const down = dispatchTouchPointer(target, 'pointerdown', { shiftKey })
    dispatchTouchPointer(target, 'pointerup', { shiftKey })
    fireEvent.click(target, { shiftKey })

    expect(down.pointerType).toBe('touch')
    expect(handlers.onToggleSelectElement).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleSelectElement).toHaveBeenCalledWith(shiftKey ? 'b' : 'a', shiftKey)
  })

  it.each([
    ['resize', 'resize-handle-se', false],
    ['rotate', 'rotation-handle', true],
  ])(
    'suppresses a stationary touch %s handle click before it can change multi-selection',
    (_, testId, shiftKey) => {
      const handlers = renderSlide({
        elements: [shape('a', 40), shape('b', 220)],
        selectedElementIds: ['a', 'b'],
      })
      const handle = screen.getAllByTestId(testId)[0]

      const down = dispatchTouchPointer(handle, 'pointerdown')
      dispatchTouchPointer(handle, 'pointerup')
      fireEvent.click(handle, { shiftKey })

      expect(down.pointerType).toBe('touch')
      expect(handlers.onToggleSelectElement).not.toHaveBeenCalled()
      expect(handlers.onStartEdit).not.toHaveBeenCalled()
    }
  )

  it('suppresses a table resize-handle click before the real consumer enters edit mode', () => {
    const table = {
      id: 'table-1',
      type: 'table',
      x: 40,
      y: 40,
      width: 240,
      height: 120,
      data: [['A', 'B']],
    }
    const handlers = renderSlide({ elements: [table], selectedElementIds: ['table-1'] })
    const handle = screen.getByTestId('resize-handle-se')

    dispatchTouchPointer(handle, 'pointerdown')
    dispatchTouchPointer(handle, 'pointerup')
    fireEvent.click(handle)

    expect(handlers.onStartEdit).not.toHaveBeenCalled()
    expect(handlers.onToggleSelectElement).not.toHaveBeenCalled()
  })

  it('routes a touch resize drag through the wrapper handle without mouse fallback', () => {
    const handlers = renderSlide({
      elements: [shape('a', 40)],
      selectedElementIds: ['a'],
    })
    const handle = screen.getByTestId('resize-handle-se')

    const down = dispatchTouchPointer(handle, 'pointerdown')
    dispatchTouchPointer(handle, 'pointermove', { clientX: 60, clientY: 70 })
    dispatchTouchPointer(handle, 'pointerup', { clientX: 60, clientY: 70 })

    expect(down.pointerType).toBe('touch')
    expect(handlers.onUpdateElement).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })
    )
  })

  it('routes a touch crop handle through the pointer callback without touch fallback', () => {
    const onCropHandleDown = vi.fn()
    const onTouchCropHandleDown = vi.fn()
    render(
      <CanvasElement
        element={{
          id: 'image-1',
          type: 'image',
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          src: '/image.png',
        }}
        isSelected
        isEditing={false}
        isCropping
        cropState={{ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }}
        isDragging={false}
        editor={null}
        onPointerDown={vi.fn()}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        onCropHandleDown={onCropHandleDown}
        onTouchCropHandleDown={onTouchCropHandleDown}
        onCommitCrop={vi.fn()}
        onUpdateElement={vi.fn()}
        iconPaths={{}}
      />
    )
    const handle = screen.getByTestId('crop-handle-se')
    handle.setPointerCapture = vi.fn()

    const down = dispatchTouchPointer(handle, 'pointerdown', { clientX: 55, clientY: 65 })

    expect(down.pointerType).toBe('touch')
    expect(handle.setPointerCapture).toHaveBeenCalledWith(7)
    expect(onCropHandleDown).toHaveBeenCalledWith('se', 55, 65, 7, handle)
    expect(onTouchCropHandleDown).not.toHaveBeenCalled()
  })

  it('cancels the first touch session in container capture before a second touch can select', () => {
    const handlers = renderSlide({
      elements: [shape('a', 40), shape('b', 220)],
      selectedElementIds: ['a'],
    })
    const first = screen.getByTestId('slide-element-a')
    const second = screen.getByTestId('slide-element-b')

    dispatchTouchPointer(first, 'pointerdown', { pointerId: 7 })
    fireEvent(document, new PointerEvent('pointermove', {
      bubbles: true,
      button: 0,
      clientX: 70,
      clientY: 70,
      pointerId: 7,
      pointerType: 'touch',
    }))
    handlers.onToggleSelectElement.mockClear()

    dispatchTouchPointer(second, 'pointerdown', { pointerId: 8 })

    expect(handlers.onToggleSelectElement).not.toHaveBeenCalled()
  })

  it('rejects non-primary element pointer input before it reaches interaction dispatch', () => {
    const onPointerDown = vi.fn()
    render(
      <CanvasElement
        element={shape('shape-1', 40)}
        isSelected={false}
        isEditing={false}
        isCropping={false}
        isDragging={false}
        editor={null}
        onPointerDown={onPointerDown}
        onClick={vi.fn()}
        onDoubleClick={vi.fn()}
        onContextMenu={vi.fn()}
        iconPaths={{}}
      />
    )

    dispatchTouchPointer(screen.getByTestId('slide-element-shape-1'), 'pointerdown', { button: 2 })
    expect(onPointerDown).not.toHaveBeenCalled()
  })

  it('keeps resize handle compatibility click and double-click inert for a table', () => {
    const onClick = vi.fn()
    const onDoubleClick = vi.fn()
    render(
      <CanvasElement
        element={{
          id: 'table-1',
          type: 'table',
          x: 40,
          y: 40,
          width: 240,
          height: 120,
          data: [['A']],
        }}
        isSelected
        isEditing={false}
        isCropping={false}
        isDragging={false}
        editor={null}
        onPointerDown={vi.fn()}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={vi.fn()}
        iconPaths={{}}
      />
    )

    const handle = screen.getByTestId('resize-handle-se')
    fireEvent.click(handle)
    fireEvent.doubleClick(handle)

    expect(onClick).not.toHaveBeenCalled()
    expect(onDoubleClick).not.toHaveBeenCalled()
  })
})
