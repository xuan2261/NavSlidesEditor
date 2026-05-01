import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSwipeNavigation } from './use-swipe-navigation'

function makeTouchEvent(type, clientX, clientY) {
  const touch = { clientX, clientY, identifier: 0 }
  const touches = type === 'touchstart' ? [touch] : []
  const changedTouches = [touch]
  return new TouchEvent(type, {
    bubbles: true,
    touches,
    changedTouches,
  })
}

describe('useSwipeNavigation hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onSwipeLeft when swiping left (deltaX < -threshold)', () => {
    const onSwipeLeft = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
        onSwipeDown: vi.fn(),
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 200, 100))
    act(() => { vi.advanceTimersByTime(50) })
    document.dispatchEvent(makeTouchEvent('touchend', 100, 100))

    expect(onSwipeLeft).toHaveBeenCalledOnce()
  })

  it('calls onSwipeRight when swiping right (deltaX > threshold)', () => {
    const onSwipeRight = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft: vi.fn(),
        onSwipeRight,
        onSwipeDown: vi.fn(),
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 100, 100))
    act(() => { vi.advanceTimersByTime(50) })
    document.dispatchEvent(makeTouchEvent('touchend', 200, 100))

    expect(onSwipeRight).toHaveBeenCalledOnce()
  })

  it('calls onSwipeDown when swiping down (deltaY > threshold)', () => {
    const onSwipeDown = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft: vi.fn(),
        onSwipeRight: vi.fn(),
        onSwipeDown,
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 100, 100))
    act(() => { vi.advanceTimersByTime(50) })
    document.dispatchEvent(makeTouchEvent('touchend', 100, 200))

    expect(onSwipeDown).toHaveBeenCalledOnce()
  })

  it('ignores slow swipes (>1000ms)', () => {
    const onSwipeLeft = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        onSwipeRight: vi.fn(),
        onSwipeDown: vi.fn(),
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 200, 100))
    act(() => { vi.advanceTimersByTime(1001) })
    document.dispatchEvent(makeTouchEvent('touchend', 100, 100))

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores swipes below threshold distance', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        onSwipeLeft,
        onSwipeRight,
        onSwipeDown: vi.fn(),
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 100, 100))
    act(() => { vi.advanceTimersByTime(50) })
    document.dispatchEvent(makeTouchEvent('touchend', 130, 100))

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })

  it('does nothing when enabled=false', () => {
    const onSwipeLeft = vi.fn()
    renderHook(() =>
      useSwipeNavigation({
        enabled: false,
        onSwipeLeft,
        onSwipeRight: vi.fn(),
        onSwipeDown: vi.fn(),
        threshold: 50,
      })
    )

    document.dispatchEvent(makeTouchEvent('touchstart', 200, 100))
    act(() => { vi.advanceTimersByTime(50) })
    document.dispatchEvent(makeTouchEvent('touchend', 100, 100))

    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
