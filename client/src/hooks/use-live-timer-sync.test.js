import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLiveTimerSync } from './use-live-timer-sync.js'

function createMockSocket() {
  const handlers = {}
  return {
    on: (event, handler) => { handlers[event] = handler },
    off: (event) => { handlers[event] = null },
    _trigger: (event, data) => { handlers[event]?.(data) },
  }
}

describe('useLiveTimerSync', () => {
  it('subscribes to timer:sync and timer:ended events', () => {
    const socket = createMockSocket()
    const onEnded = vi.fn()
    const { result } = renderHook(() => useLiveTimerSync(socket, onEnded))

    socket._trigger('timer:sync', {
      elementId: 'game-1',
      remaining: 20,
      duration: 30,
      running: true,
      endedAt: Date.now() + 20000,
    })

    expect(result.current.current['game-1']).toBeDefined()
    expect(result.current.current['game-1'].remaining).toBe(20)
    expect(result.current.current['game-1'].duration).toBe(30)
    expect(result.current.current['game-1'].running).toBe(true)
  })

  it('stores multiple timer states keyed by elementId', () => {
    const socket = createMockSocket()
    const { result } = renderHook(() => useLiveTimerSync(socket, vi.fn()))

    socket._trigger('timer:sync', {
      elementId: 'game-1',
      remaining: 20,
      duration: 30,
      running: true,
      endedAt: null,
    })
    socket._trigger('timer:sync', {
      elementId: 'game-2',
      remaining: 45,
      duration: 60,
      running: true,
      endedAt: null,
    })

    expect(result.current.current['game-1'].remaining).toBe(20)
    expect(result.current.current['game-2'].remaining).toBe(45)
  })

  it('removes timer state on timer:ended and calls onTimerEnded', () => {
    const socket = createMockSocket()
    const onEnded = vi.fn()
    const { result } = renderHook(() => useLiveTimerSync(socket, onEnded))

    socket._trigger('timer:sync', {
      elementId: 'game-1',
      remaining: 20,
      duration: 30,
      running: true,
      endedAt: Date.now() + 20000,
    })
    expect(result.current.current['game-1']).toBeDefined()

    socket._trigger('timer:ended', { elementId: 'game-1' })
    expect(result.current.current['game-1']).toBeUndefined()
    expect(onEnded).toHaveBeenCalledWith('game-1')
  })

  it('returns early when socket is null', () => {
    const { result } = renderHook(() => useLiveTimerSync(null, vi.fn()))
    expect(result.current.current).toEqual({})
  })

  it('cleans up listeners on unmount', () => {
    const socket = createMockSocket()
    const offSpy = vi.spyOn(socket, 'off')
    const { unmount } = renderHook(() => useLiveTimerSync(socket, vi.fn()))
    unmount()
    expect(offSpy).toHaveBeenCalledWith('timer:sync', expect.any(Function))
    expect(offSpy).toHaveBeenCalledWith('timer:ended', expect.any(Function))
  })
})
