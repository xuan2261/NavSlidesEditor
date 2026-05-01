import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTouchGestures } from './use-touch-gestures'

function makePointerEvent(type, clientX, clientY, extra = {}) {
  return {
    pointerId: 1,
    clientX,
    clientY,
    preventDefault: vi.fn(),
    ...extra,
  }
}

describe('useTouchGestures hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('tap detection', () => {
    it('calls onTap after quick pointer down and up', () => {
      const onTap = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap,
          onDoubleTap: vi.fn(),
          onLongPress: vi.fn(),
          onDragStart: vi.fn(),
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      const down = makePointerEvent('pointerdown', 100, 100)
      const up = makePointerEvent('pointerup', 100, 100)
      result.current.pointerDownProps.onPointerDown(down)
      act(() => { vi.advanceTimersByTime(100) })
      result.current.pointerUpProps.onPointerUp(up)
      // onTap is deferred 300ms to check for double-tap; flush the timer
      act(() => { vi.advanceTimersByTime(300) })

      expect(onTap).toHaveBeenCalledOnce()
      expect(onTap).toHaveBeenCalledWith(100, 100)
    })

    it('calls onDoubleTap after two rapid taps', () => {
      const onTap = vi.fn()
      const onDoubleTap = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap,
          onDoubleTap,
          onLongPress: vi.fn(),
          onDragStart: vi.fn(),
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      // First tap
      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      act(() => { vi.advanceTimersByTime(100) })
      result.current.pointerUpProps.onPointerUp(makePointerEvent('pointerup', 100, 100))

      // Second tap (within 300ms)
      act(() => { vi.advanceTimersByTime(50) })
      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      act(() => { vi.advanceTimersByTime(100) })
      result.current.pointerUpProps.onPointerUp(makePointerEvent('pointerup', 100, 100))

      expect(onDoubleTap).toHaveBeenCalledOnce()
      expect(onTap).not.toHaveBeenCalled()
    })

    it('does not call onTap after slow press (>200ms)', () => {
      const onTap = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap,
          onDoubleTap: vi.fn(),
          onLongPress: vi.fn(),
          onDragStart: vi.fn(),
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      act(() => { vi.advanceTimersByTime(201) })
      result.current.pointerUpProps.onPointerUp(makePointerEvent('pointerup', 100, 100))

      expect(onTap).not.toHaveBeenCalled()
    })
  })

  describe('long press', () => {
    it('calls onLongPress after 500ms hold', () => {
      const onLongPress = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap: vi.fn(),
          onDoubleTap: vi.fn(),
          onLongPress,
          onDragStart: vi.fn(),
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      act(() => { vi.advanceTimersByTime(500) })

      expect(onLongPress).toHaveBeenCalledOnce()
      expect(onLongPress).toHaveBeenCalledWith(100, 100)
    })

    it('cancels long press if pointer moves past threshold', () => {
      const onLongPress = vi.fn()
      const onDragStart = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap: vi.fn(),
          onDoubleTap: vi.fn(),
          onLongPress,
          onDragStart,
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      act(() => { vi.advanceTimersByTime(400) })
      // Move past DRAG_THRESHOLD (5px)
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 110, 110))

      expect(onDragStart).toHaveBeenCalledOnce()
      expect(onLongPress).not.toHaveBeenCalled()
    })
  })

  describe('drag', () => {
    it('calls onDragStart when pointer moves past threshold', () => {
      const onDragStart = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap: vi.fn(),
          onDoubleTap: vi.fn(),
          onLongPress: vi.fn(),
          onDragStart,
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 110, 110))

      expect(onDragStart).toHaveBeenCalledOnce()
      expect(onDragStart).toHaveBeenCalledWith(110, 110)
    })

    it('calls onDrag while pointer moves during drag', () => {
      const onDrag = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap: vi.fn(),
          onDoubleTap: vi.fn(),
          onLongPress: vi.fn(),
          onDragStart: vi.fn(),
          onDrag,
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 110, 110))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 120, 130))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 135, 145))

      expect(onDrag).toHaveBeenCalledTimes(3)
    })

    it('calls onDragEnd on pointer up after drag', () => {
      const onDragEnd = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          onTap: vi.fn(),
          onDoubleTap: vi.fn(),
          onLongPress: vi.fn(),
          onDragStart: vi.fn(),
          onDrag: vi.fn(),
          onDragEnd,
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 110, 110))
      result.current.pointerUpProps.onPointerUp(makePointerEvent('pointerup', 110, 110))

      expect(onDragEnd).toHaveBeenCalledOnce()
      expect(onDragEnd).toHaveBeenCalledWith(110, 110)
    })
  })

  describe('disabled state', () => {
    it('ignores all events when enabled=false', () => {
      const onTap = vi.fn()
      const onLongPress = vi.fn()
      const onDragStart = vi.fn()
      const { result } = renderHook(() =>
        useTouchGestures({
          enabled: false,
          onTap,
          onDoubleTap: vi.fn(),
          onLongPress,
          onDragStart,
          onDrag: vi.fn(),
          onDragEnd: vi.fn(),
        })
      )

      result.current.pointerDownProps.onPointerDown(makePointerEvent('pointerdown', 100, 100))
      result.current.pointerMoveProps.onPointerMove(makePointerEvent('pointermove', 110, 110))
      result.current.pointerUpProps.onPointerUp(makePointerEvent('pointerup', 110, 110))
      act(() => { vi.advanceTimersByTime(500) })

      expect(onTap).not.toHaveBeenCalled()
      expect(onLongPress).not.toHaveBeenCalled()
      expect(onDragStart).not.toHaveBeenCalled()
    })
  })
})
