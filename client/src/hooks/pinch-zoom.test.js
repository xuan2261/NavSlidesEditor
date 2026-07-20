import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePinchZoom } from './use-pinch-zoom'

function pointer(pointerId, clientX, clientY, pointerType = 'touch') {
  return { pointerId, clientX, clientY, pointerType }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePinchZoom Pointer Events transport', () => {
  it('exposes capture-phase Pointer Event handlers only', () => {
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef: { current: { dataset: { zoom: '1' } } },
        onZoomChange: vi.fn(),
      })
    )

    expect(typeof result.current.containerProps.onPointerDownCapture).toBe('function')
    expect(typeof result.current.containerProps.onPointerMoveCapture).toBe('function')
    expect(typeof result.current.containerProps.onPointerUpCapture).toBe('function')
    expect(typeof result.current.containerProps.onPointerCancelCapture).toBe('function')
    expect(result.current.containerProps).not.toHaveProperty('onTouchStart')
    expect(result.current.containerProps).not.toHaveProperty('onTouchMove')
    expect(result.current.containerProps).not.toHaveProperty('onTouchEnd')
    expect(result.current.containerProps).not.toHaveProperty('onTouchCancel')
    expect(result.current.containerProps.style).toEqual({ touchAction: 'none' })
  })

  it('ignores mouse and pen contacts, then starts only for a touch pair', () => {
    const onPinchStart = vi.fn()
    const onZoomChange = vi.fn()
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef: { current: { dataset: { zoom: '1' } } },
        onZoomChange,
        onPinchStart,
      })
    )
    const handlers = result.current.containerProps

    act(() => {
      handlers.onPointerDownCapture(pointer(1, 100, 100, 'mouse'))
      handlers.onPointerDownCapture(pointer(2, 200, 100, 'pen'))
      handlers.onPointerDownCapture(pointer(3, 100, 100))
      handlers.onPointerDownCapture(pointer(4, 200, 100))
      handlers.onPointerMoveCapture(pointer(3, 80, 100))
      handlers.onPointerMoveCapture(pointer(4, 220, 100))
    })

    expect(onPinchStart).toHaveBeenCalledTimes(1)
    expect(onZoomChange).toHaveBeenCalled()
  })

  it('rebaselines safely after third-touch and release changes the pair', () => {
    const onPinchStart = vi.fn()
    const onZoomChange = vi.fn()
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef: { current: { dataset: { zoom: '2' } } },
        onZoomChange,
        onPinchStart,
      })
    )
    const handlers = result.current.containerProps

    act(() => {
      handlers.onPointerDownCapture(pointer(1, 100, 100))
      handlers.onPointerDownCapture(pointer(2, 200, 100))
      handlers.onPointerMoveCapture(pointer(1, 80, 100))
      handlers.onPointerMoveCapture(pointer(2, 220, 100))
    })
    const callsBeforeThirdContact = onZoomChange.mock.calls.length

    act(() => {
      handlers.onPointerDownCapture(pointer(3, 300, 100))
      handlers.onPointerMoveCapture(pointer(1, 60, 100))
      handlers.onPointerUpCapture(pointer(3, 300, 100))
      handlers.onPointerMoveCapture(pointer(1, 60, 100))
      handlers.onPointerMoveCapture(pointer(2, 240, 100))
    })

    expect(onPinchStart).toHaveBeenCalledTimes(1)
    expect(onZoomChange.mock.calls.length).toBeGreaterThan(callsBeforeThirdContact)
  })

  it('clears tracked contacts on disable and unmount', () => {
    const onPinchStart = vi.fn()
    const onZoomChange = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) =>
        usePinchZoom({
          containerRef: { current: { dataset: { zoom: '1' } } },
          onZoomChange,
          onPinchStart,
          enabled,
        }),
      { initialProps: { enabled: true } }
    )

    act(() => {
      result.current.containerProps.onPointerDownCapture(pointer(1, 100, 100))
      result.current.containerProps.onPointerDownCapture(pointer(2, 200, 100))
    })
    expect(onPinchStart).toHaveBeenCalledTimes(1)

    rerender({ enabled: false })
    act(() => result.current.containerProps.onPointerMoveCapture(pointer(1, 80, 100)))
    expect(onZoomChange).not.toHaveBeenCalled()
    unmount()
  })
})
