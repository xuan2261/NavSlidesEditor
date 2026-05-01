import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePinchZoom } from './use-pinch-zoom'

function makePointerEvent(pointerId, clientX, clientY) {
  return { pointerId, clientX, clientY }
}

describe('usePinchZoom hook', () => {
  it('returns container props with pointer handlers', () => {
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef: { current: { dataset: { zoom: '1' } } },
        onZoomChange: vi.fn(),
      })
    )

    expect(result.current.containerProps).toBeDefined()
    expect(typeof result.current.containerProps.onPointerDown).toBe('function')
    expect(typeof result.current.containerProps.onPointerMove).toBe('function')
    expect(typeof result.current.containerProps.onPointerUp).toBe('function')
    expect(result.current.containerProps.style).toEqual({ touchAction: 'none' })
  })

  it('changes zoom when two pointers move apart', () => {
    const onZoomChange = vi.fn()
    const containerRef = { current: { dataset: { zoom: '2' } } }
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef,
        onZoomChange,
        minZoom: 0.25,
        maxZoom: 4.0,
      })
    )

    // First pointer down
    result.current.containerProps.onPointerDown(makePointerEvent(1, 100, 100))
    // Second pointer down — sets initial distance
    result.current.containerProps.onPointerDown(makePointerEvent(2, 200, 100))
    // Move both pointers apart (pinch out)
    result.current.containerProps.onPointerMove(makePointerEvent(1, 80, 100))
    result.current.containerProps.onPointerMove(makePointerEvent(2, 220, 100))

    expect(onZoomChange).toHaveBeenCalled()
  })

  it('clamps zoom to [minZoom, maxZoom]', () => {
    const onZoomChange = vi.fn()
    const containerRef = { current: { dataset: { zoom: '1' } } }
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef,
        onZoomChange,
        minZoom: 0.25,
        maxZoom: 4.0,
      })
    )

    result.current.containerProps.onPointerDown(makePointerEvent(1, 100, 100))
    result.current.containerProps.onPointerDown(makePointerEvent(2, 200, 100))
    // Very large pinch out
    result.current.containerProps.onPointerMove(makePointerEvent(1, 0, 100))
    result.current.containerProps.onPointerMove(makePointerEvent(2, 900, 100))

    const lastCall = onZoomChange.mock.calls[onZoomChange.mock.calls.length - 1]
    expect(lastCall[0]).toBeLessThanOrEqual(4.0)
    expect(lastCall[0]).toBeGreaterThanOrEqual(0.25)
  })

  it('resets initial distance when pointers drop below 2', () => {
    const onZoomChange = vi.fn()
    const containerRef = { current: { dataset: { zoom: '1' } } }
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef,
        onZoomChange,
        minZoom: 0.25,
        maxZoom: 4.0,
      })
    )

    result.current.containerProps.onPointerDown(makePointerEvent(1, 100, 100))
    result.current.containerProps.onPointerDown(makePointerEvent(2, 200, 100))
    result.current.containerProps.onPointerUp(makePointerEvent(2)) // drop second pointer
    // Zoom should not change with only one pointer
    result.current.containerProps.onPointerMove(makePointerEvent(1, 80, 100))

    expect(onZoomChange).not.toHaveBeenCalled()
  })

  it('returns empty handlers when enabled=false', () => {
    const onZoomChange = vi.fn()
    const { result } = renderHook(() =>
      usePinchZoom({
        containerRef: { current: null },
        onZoomChange,
        enabled: false,
      })
    )

    // Should not throw, should not call onZoomChange
    result.current.containerProps.onPointerDown(makePointerEvent(1, 100, 100))
    result.current.containerProps.onPointerDown(makePointerEvent(2, 200, 100))
    result.current.containerProps.onPointerMove(makePointerEvent(1, 80, 100))
    result.current.containerProps.onPointerMove(makePointerEvent(2, 220, 100))
    result.current.containerProps.onPointerUp(makePointerEvent(1))
    result.current.containerProps.onPointerUp(makePointerEvent(2))

    expect(onZoomChange).not.toHaveBeenCalled()
  })
})
