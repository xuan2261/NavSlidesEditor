import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLiveTimerSync } from './use-live-timer-sync.js'
import { gameInstanceKey } from 'revealjs-shared'
function socket() {
  const handlers = {}
  return {
    on: (event, handler) => {
      handlers[event] = handler
    },
    off: (event) => {
      delete handlers[event]
    },
    receive: (event, data) => handlers[event]?.(data),
    handler: (event) => handlers[event],
  }
}
const timer = (effectiveSlideId, remaining) => ({
  effectiveSlideId,
  elementId: 'layout-fixed:lesson:timer',
  remaining,
  duration: 30,
  running: true,
  endedAt: null,
})

describe('effective server timer state consumption', () => {
  it('keeps inherited copies independent through pause and completion and reports the completed tuple', () => {
    const transport = socket(),
      onEnded = vi.fn()
    const { result } = renderHook(() => useLiveTimerSync(transport, onEnded))
    const parent = timer('parent', 20),
      child = timer('child', 25)
    transport.receive('timer:sync', parent)
    transport.receive('timer:sync', child)
    transport.receive('timer:sync', { ...parent, running: false, pausedRemaining: 7 })
    expect(result.current.current[gameInstanceKey(parent)]).toMatchObject({
      running: false,
      pausedRemaining: 7,
    })
    expect(result.current.current[gameInstanceKey(child)]).toMatchObject({
      running: true,
      remaining: 25,
    })
    transport.receive('timer:ended', { effectiveSlideId: 'unknown', elementId: parent.elementId })
    transport.receive('timer:sync', { elementId: parent.elementId, remaining: 0 })
    expect(Object.keys(result.current.current)).toHaveLength(2)
    expect(onEnded).not.toHaveBeenCalled()
    transport.receive('timer:ended', { effectiveSlideId: 'parent', elementId: parent.elementId })
    expect(result.current.current[gameInstanceKey(parent)]).toBeUndefined()
    expect(result.current.current[gameInstanceKey(child)].remaining).toBe(25)
    expect(onEnded).toHaveBeenCalledWith({
      effectiveSlideId: 'parent',
      elementId: parent.elementId,
    })
  })
  it('clears former room state and ignores callbacks retained after socket replacement or unmount', () => {
    const first = socket(),
      second = socket(),
      onEnded = vi.fn(),
      parent = timer('parent', 20)
    const { result, rerender, unmount } = renderHook(
      ({ transport }) => useLiveTimerSync(transport, onEnded),
      { initialProps: { transport: first } }
    )
    first.receive('timer:sync', parent)
    const staleSync = first.handler('timer:sync'),
      staleEnded = first.handler('timer:ended')
    rerender({ transport: second })
    staleSync(parent)
    staleEnded(parent)
    expect(result.current.current).toEqual({})
    expect(onEnded).not.toHaveBeenCalled()
    const child = timer('child', 25)
    second.receive('timer:sync', child)
    expect(result.current.current[gameInstanceKey(child)].remaining).toBe(25)
    const unmountedSync = second.handler('timer:sync')
    unmount()
    unmountedSync(parent)
    expect(result.current.current).toEqual({})
  })
})
